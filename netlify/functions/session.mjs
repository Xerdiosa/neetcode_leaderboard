import { isAuthenticated, unauthenticatedResponse } from '../shared/auth.mjs';

export default async (request) => {
  if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });
  return await isAuthenticated(request, process.env.secret)
    ? Response.json({ authenticated: true }, { headers: { 'Cache-Control': 'no-store' } })
    : unauthenticatedResponse();
};
