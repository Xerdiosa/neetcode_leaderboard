import { createHmac, timingSafeEqual } from 'node:crypto';

export const authCookieName = 'neetcode_dashboard_auth';

function sessionToken(secret) {
  return createHmac('sha256', secret)
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

export function isAuthenticated(request, secret) {
  return Boolean(secret) && equalValues(cookieValue(request, authCookieName), sessionToken(secret));
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
          'Set-Cookie': `${authCookieName}=${sessionToken(secret)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`,
        },
      },
    );
  } catch {
    return Response.json({ error: 'A password is required.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }
}
