import { createHmac, timingSafeEqual } from 'node:crypto';

const endpoint = 'https://neetcode.io/api/callableFunctionHttp';
const authCookieName = 'neetcode_dashboard_auth';

const staticFiles = new Map([
  ['/dashboard.js', ['dist/dashboard.js', 'application/javascript; charset=utf-8']],
  ['/styles.css', ['dist/styles.css', 'text/css; charset=utf-8']],
  ['/favicon.ico', ['dist/favicon.ico', 'image/x-icon']],
]);

function configuredUsers() {
  return (Bun.env.users || '')
    .split(',')
    .map((entry) => {
      const [handle, ...nameParts] = entry.split(':');
      return { handle: handle?.trim(), name: nameParts.join(':').trim() };
    })
    .filter(({ handle, name }) => handle && name);
}

function configuredSecret() {
  const secret = Bun.env.secret;
  if (!secret) throw new Error('The secret environment variable is not configured.');
  return secret;
}

function sessionToken() {
  return createHmac('sha256', configuredSecret())
    .update('neetcode-dashboard-session')
    .digest('base64url');
}

function equalValues(first, second) {
  const firstValue = Buffer.from(first || '');
  const secondValue = Buffer.from(second || '');
  return firstValue.length === secondValue.length && timingSafeEqual(firstValue, secondValue);
}

function cookieValue(request, name) {
  const cookies = request.headers.get('cookie') || '';
  const entry = cookies.split(';').find((value) => value.trim().startsWith(`${name}=`));
  return entry?.trim().slice(name.length + 1) || '';
}

function isAuthenticated(request) {
  try {
    return equalValues(cookieValue(request, authCookieName), sessionToken());
  } catch {
    return false;
  }
}

function unauthenticatedResponse(message = 'Unauthenticated. Enter the password to continue.') {
  return Response.json({ error: message }, { status: 401 });
}

function shouldSecureCookie(request) {
  const url = new URL(request.url);
  const localHostnames = new Set(['127.0.0.1', '::1', 'localhost']);
  if (url.protocol === 'https:' || !localHostnames.has(url.hostname)) return true;

  if (Bun.env.TRUST_PROXY !== 'true') return false;
  return request.headers.get('x-forwarded-proto')?.split(',')[0].trim() === 'https';
}

async function authenticationResponse(request) {
  try {
    const { password } = await request.json();
    if (!equalValues(password, configuredSecret())) {
      return unauthenticatedResponse('Incorrect password.');
    }

    const secureCookie = shouldSecureCookie(request) ? '; Secure' : '';
    return Response.json(
      { authenticated: true },
      {
        headers: {
          'Set-Cookie': `${authCookieName}=${sessionToken()}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${secureCookie}`,
        },
      },
    );
  } catch {
    return Response.json({ error: 'A password is required.' }, { status: 400 });
  }
}

async function getProfile(user) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: { functionId: 'getProfileByHandle', handle: user.handle },
    }),
  });

  if (!response.ok) throw new Error(`NeetCode request failed (${response.status})`);

  const payload = await response.json();
  if (!payload.data?.anonUsername) throw new Error('Profile was not found');

  return { name: user.name, profile: payload.data };
}

async function profileResponse() {
  const users = configuredUsers();
  if (!users.length) {
    return Response.json(
      { error: 'No users are configured. Set users=handle:Name,handle:Name in .env.' },
      { status: 500 },
    );
  }

  const results = await Promise.all(
    users.map(async (user) => {
      try {
        return await getProfile(user);
      } catch (error) {
        return { name: user.name, handle: user.handle, error: error.message };
      }
    }),
  );

  return Response.json({ profiles: results });
}

async function indexResponse(request) {
  const authenticated = isAuthenticated(request);
  let document = await Bun.file('dist/index.html').text();
  document = document.replace('data-authenticated="false"', `data-authenticated="${authenticated}"`);
  if (authenticated) document = document.replace('<section id="auth-overlay"', '<section id="auth-overlay" hidden');

  return new Response(document, {
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}

function staticResponse(pathname) {
  const asset = staticFiles.get(pathname);
  if (!asset) return null;

  const [fileName, contentType] = asset;
  return new Response(Bun.file(fileName), {
    headers: { 'Content-Type': contentType },
  });
}

const port = Number(Bun.env.PORT || 3000);
const hostname = Bun.env.HOST || '127.0.0.1';

const server = Bun.serve({
  port,
  hostname,
  async fetch(request) {
    const { pathname } = new URL(request.url);

    try {
      if (request.method === 'POST' && pathname === '/api/auth') return await authenticationResponse(request);
      if (request.method === 'GET' && (pathname === '/' || pathname === '/index.html')) return await indexResponse(request);
      if (request.method === 'GET' && pathname === '/api/session') {
        return isAuthenticated(request)
          ? Response.json({ authenticated: true })
          : unauthenticatedResponse();
      }
      if (request.method === 'GET' && pathname === '/api/profiles' && !isAuthenticated(request)) {
        return unauthenticatedResponse();
      }
      if (request.method === 'GET' && pathname === '/api/profiles') return await profileResponse();
      if (request.method === 'GET') return staticResponse(pathname) || await indexResponse(request);
      return new Response('Method not allowed', { status: 405 });
    } catch (error) {
      console.error(error);
      return Response.json({ error: 'Unable to load profiles.' }, { status: 500 });
    }
  },
});

console.log(`NeetCode dashboard server running at http://${server.hostname}:${server.port}`);
