# Deploy Carafe on free tiers

This guide targets Vercel and Neon free tiers. Provider limits and free-tier terms change; confirm the current limits in each dashboard before deployment. Do not put real subscriber data in a public demo deployment unless you have authorization to do so.

## 1. Create the database

Create a Neon PostgreSQL project in the same region as the Vercel application. Copy its pooled connection string into Vercel as `DATABASE_URL`. Keep the URL private. Drizzle migrations are in `drizzle/` and `npm run db:push` applies them.

## 2. Configure Vercel

Import the repository and use the default Next.js build settings. Set these environment variables for Production (and Preview only if you want protected previews):

- `DATABASE_URL`: Neon pooled PostgreSQL connection string.
- `SESSION_SECRET`: random secret of at least 32 characters; generate a unique value per environment.
- `ADMIN_USERNAME`: owner login name.
- `ADMIN_PASSWORD_HASH`: output of `npm run hash-password -- "a-unique-password"`; escape each `$` as `\$` in Vercel's value only if its UI expands dollar expressions.
- `DEMO_USERNAME` and `DEMO_PASSWORD`: public, local-only demo credentials. Use non-sensitive credentials for an exposed deployment.
- `WEBHOOK_SECRET`: long random HMAC secret; `WEBHOOK_SECRET_PREVIOUS` is optional during rotation.
- `GEMINI_API_KEY` and `GEMINI_MODEL`: optional. Leave unset for the rules-based assistant. If enabled, select a currently available free-tier Gemini model supporting structured output and monitor provider quotas.
- `ASSISTANT_DAILY_LIMIT`: optional, defaults to 20.
- `COST_PER_SUBSCRIBER_MONTH`: optional, defaults to 0.20 and is an editable planning assumption in the overview.

Do not commit `.env.local` or production values. Vercel's project environment settings are the source for deployed secrets.

## 3. Migrate and seed production

After setting `DATABASE_URL` in a trusted local shell, run `npm run db:push`, then `npm run seed`. The seed command loads the CSVs from `data/raw/`, applies the migration, and is safe to rerun. Restrict access to this shell and database credentials. Verify the printed golden totals before exposing the deployment. Never place a production connection string in a shell transcript or chat.

## 4. Warm and verify

Open `https://YOUR-APP.vercel.app/api/health` to execute a small database query and verify connectivity. Sign in at `/login`, then verify `/app/lookup`, `/app/segments`, `/app/assistant`, and `/app/live`. Check the browser network panel for errors and confirm the configured public demo account has viewer-only access.

## 5. Verify the webhook

Configure the sending system with the deployed endpoint `https://YOUR-APP.vercel.app/webhooks/app` and the same `WEBHOOK_SECRET`. The sender must sign the exact raw JSON request body with HMAC-SHA256 over `<unix-seconds>.<raw-body>`, then send `X-TPO-Timestamp` and `X-TPO-Signature: sha256=<hex>`. Use the included `npm run send-event` locally against the local app first; for production, use the sender's secure secret store and a non-personal synthetic event. Confirm the endpoint returns `202` for a new ID and `200` for an identical retry. Never paste signatures or secrets into logs or tickets.

## Operations and retention

Review Vercel and Neon free-tier quotas before each assessment/demo. The intended retention period for web and app events is 180 days. Automatic retention enforcement is not implemented on the free tier; add a scheduled deletion job if the deployment becomes an ongoing service. The admin profile erasure endpoint deletes the requested profile and linked rows, but production deletion should be verified against the database's backup and retention policies.

## Netlify + Neon branch deployment

Netlify does not load `.env` or `.env.example` from the repository during its build. Enter environment variables in the Netlify site settings (or import them with the Netlify CLI) and make server variables available to both **Builds** and **Functions**, for the deploy context you are testing. On plans where scopes are not configurable, use the default scope. In particular, `DATABASE_URL` must be a non-empty hosted PostgreSQL URL at build time and at function runtime. When it is missing, this project now stops with a direct configuration error instead of trying to start its local PGlite database in a serverless environment.

For a separate `redesign` branch deploy, give it a preview-specific Neon database and preview-only credentials. Apply schema and seed that database with `npm run db:push` and `npm run seed` from a trusted local shell before opening the preview. Keep the stable `main` branch selected for the production context. Netlify's Next.js adapter detects the app and handles App Router, server rendering, and route handlers; use `npm run build` and the Next.js `.next` output, and do not enable static export or skip the Next.js runtime.

Keep `.env.example` as a placeholder template. Generate the admin hash with `npm run hash-password -- "a-unique-password"` and paste the complete generated value into Netlify's variable UI; do not use a shortened sample or include literal escaping backslashes in a value copied directly to the UI. The recruiter credentials are visible on the public landing page, so they must be low-privilege and non-sensitive. Treat a deploy preview the same way if its landing page is public.
