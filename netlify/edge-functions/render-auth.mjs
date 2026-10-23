import { isAuthenticated } from '../shared/auth.mjs';

export default async (request, context) => {
  const response = await context.next();
  if (!response.headers.get('content-type')?.includes('text/html')) return response;

  const authenticated = await isAuthenticated(request, Netlify.env.get('secret'));
  let document = await response.text();
  document = document.replace('data-authenticated="false"', `data-authenticated="${authenticated}"`);
  if (authenticated) document = document.replace('<section id="auth-overlay"', '<section id="auth-overlay" hidden');

  const headers = new Headers(response.headers);
  headers.delete('content-encoding');
  headers.delete('content-length');
  headers.delete('etag');
  headers.set('Cache-Control', 'private, no-store');
  headers.set('Content-Security-Policy', "default-src 'self'; connect-src 'self'; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
  return new Response(document, { status: response.status, statusText: response.statusText, headers });
};

export const config = { path: '/*' };
