import { isAuthenticated, unauthenticatedResponse } from '../shared/auth.mjs';

const endpoint = 'https://neetcode.io/api/callableFunctionHttp';

function configuredUsers(value) {
  const entries = [];
  (value || '').split(',').forEach((part) => {
    if (/^[^,:]+:[^,:]+(?::|$)/.test(part.trim())) entries.push(part);
    else if (entries.length) entries[entries.length - 1] += `,${part}`;
  });

  return entries
    .map((entry) => {
      const firstSeparator = entry.indexOf(':');
      const secondSeparator = entry.indexOf(':', firstSeparator + 1);
      const handle = entry.slice(0, firstSeparator).trim();
      const name = entry.slice(firstSeparator + 1, secondSeparator === -1 ? undefined : secondSeparator).trim();
      const rawAvatarUrl = entry.match(/https?:\/\/[^\s"']+/)?.[0] || '';

      try {
        const avatarUrl = new URL(rawAvatarUrl);
        return { handle, name, avatarUrl: ['http:', 'https:'].includes(avatarUrl.protocol) ? avatarUrl.href : undefined };
      } catch {
        return { handle, name };
      }
    })
    .filter(({ handle, name }) => handle && name);
}

async function getProfile(user) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: { functionId: 'getProfileByHandle', handle: user.handle } }),
  });

  if (!response.ok) throw new Error(`NeetCode request failed (${response.status})`);
  const payload = await response.json();
  if (!payload.data?.anonUsername) throw new Error('Profile was not found');
  return { name: user.name, avatarUrl: user.avatarUrl, profile: payload.data };
}

export default async (request) => {
  if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });
  if (!await isAuthenticated(request, process.env.secret)) return unauthenticatedResponse();

  const users = configuredUsers(process.env.users);
  if (!users.length) {
    return Response.json(
      { error: 'No users are configured. Set users=handle:Name,handle:Name in Netlify environment variables.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const profiles = await Promise.all(users.map(async (user) => {
    try {
      return await getProfile(user);
    } catch (error) {
      return { name: user.name, handle: user.handle, error: error.message };
    }
  }));

  return Response.json({ profiles }, { headers: { 'Cache-Control': 'no-store' } });
};
