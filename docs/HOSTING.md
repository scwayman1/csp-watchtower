# Frontend hosting

The frontend is a Vite single-page application. `wrangler.toml` provides an
account-neutral Cloudflare Pages build configuration, and `public/_redirects`
preserves client-side routes after deployment. `public/_headers` adds baseline
browser security headers without constraining the external services used by
the application.

## Local setup

1. Copy `.env.example` to `.env.local` and fill in the Supabase project URL and
   browser-safe publishable/anon key.
2. Install with `npm ci`.
3. Run `npm run build`, `npm test`, and `npm run lint`.

Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are expected by
the browser client. Supabase remains the auth, database, realtime, and Edge
Functions backend; this configuration does not proxy, replace, or migrate
those services.

## Cloudflare Pages review checklist

- Configure the Pages project in Cloudflare without committing an account ID,
  API token, or project-specific secret.
- Use `npm run build` as the build command and `dist` as the output directory.
- Provide the two `VITE_*` values as Pages environment variables for each
  environment. They are public client configuration, but must still be kept
  environment-specific.
- Verify Supabase Auth redirect URLs and site URL include the final Pages or
  custom-domain URL before production launch.
- Deploy a preview first and verify sign-in, PKCE callback routing, database
  access, realtime subscriptions, and Supabase Edge Function calls.

This repository change prepares configuration only. It does not create or
modify a Cloudflare project, delete existing hosting, or perform a cutover.
