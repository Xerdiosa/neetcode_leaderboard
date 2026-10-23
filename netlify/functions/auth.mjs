import { authenticationResponse } from '../shared/auth.mjs';

export default async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  return authenticationResponse(request, process.env.secret);
};
