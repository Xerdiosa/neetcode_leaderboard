# NeetCode Leaderboard

This Bun server reads profile mappings from `.env`, fetches their public NeetCode stats server-side, and serves the dashboard.

## Configuration

Use a dashboard password plus comma-separated `handle:real name:avatar URL` entries. The avatar URL is optional; wrap it in double quotes when it contains commas:

```env
secret=choose-a-strong-password
users=NeetCodeHandle:Name:"https://cdn.example.com/name.webp",AnotherHandle:Another Name
```

The authentication cookie is marked `Secure` for every non-local host. If a trusted reverse proxy terminates TLS and forwards requests to this server on localhost, set `TRUST_PROXY=true` so its `X-Forwarded-Proto` value is honored.

## Run locally

```sh
bun run dev
```

Open `http://127.0.0.1:3000`.

## Deploy to Netlify

`netlify.toml` publishes `dist/`, routes the API through Netlify Functions, and uses an Edge Function to render the initial authenticated state. This keeps the password screen from flashing after a refresh on a valid session.

1. Push the repository to GitHub and import it in Netlify.
2. Keep the build settings from `netlify.toml`: publish directory `dist`, functions directory `netlify/functions`, and no build command.
3. In **Site configuration → Environment variables**, add `secret` and `users` with the same format as `.env.example`. Mark `secret` as a secret and make both values available to **Functions**. Do not commit `.env`.
4. Redeploy after setting or changing environment variables.

No `requirements.txt`, Makefile, or domain allowlist is required. The production API is same-origin, so it does not need CORS configuration. Netlify provides the HTTPS certificate and the production session cookie is always `Secure`.

## Custom domain

1. In Netlify, add `neet.akbar.codes` under **Domain management** before changing DNS.
2. At the DNS provider for `akbar.codes`, create a CNAME record with host `neet` that points to the assigned Netlify hostname, for example `your-site-name.netlify.app` (without `https://`).
3. Wait for Netlify to verify DNS and issue the TLS certificate, then visit `https://neet.akbar.codes`.
