export const authCookieName = 'neetcode_dashboard_auth';
const textEncoder = new TextEncoder();

function base64Url(bytes) {
  let value = '';
  bytes.forEach((byte) => {
    value += String.fromCharCode(byte);
  });
  return btoa(value).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function equalValues(first, second) {
  const firstValue = textEncoder.encode(first || '');
  const secondValue = textEncoder.encode(second || '');
  let difference = firstValue.length ^ secondValue.length;
  const length = Math.max(firstValue.length, secondValue.length);

  for (let index = 0; index < length; index += 1) {
    difference |= (firstValue[index] || 0) ^ (secondValue[index] || 0);
  }

  return difference === 0;
}

async function sessionToken(secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode('neetcode-dashboard-session'));
  return base64Url(new Uint8Array(signature));
}

function cookieValue(request, name) {
  const cookies = request.headers.get('cookie') || '';
  const entry = cookies.split(';').find((value) => value.trim().startsWith(`${name}=`));
  return entry?.trim().slice(name.length + 1) || '';
}

export async function isAuthenticated(request, secret) {
  return Boolean(secret) && equalValues(cookieValue(request, authCookieName), await sessionToken(secret));
}

export function unauthenticatedResponse(message = 'Unauthenticated. Enter the password to continue.') {
  return Response.json({ error: message }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
}

export async function authenticationResponse(request, secret) {
  if (!secret) return Response.json({ error: 'Server authentication is not configured.' }, { status: 500 });

  try {
    const { password } = await request.json();
    if (!equalValues(password, secret)) return unauthenticatedResponse('Incorrect password.');

    return Response.json(
      { authenticated: true },
      {
        headers: {
          'Cache-Control': 'no-store',
          'Set-Cookie': `${authCookieName}=${await sessionToken(secret)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`,
        },
      },
    );
  } catch {
    return Response.json({ error: 'A password is required.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }
}
