# Carafe

A mini customer data platform for The Pour Over. Carafe will bring newsletter, website, and app activity into one calm reader view.

## Run locally

1. Install Node.js 20 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local`. Set a random `SESSION_SECRET` with at least 32 characters, `ADMIN_USERNAME`, and an scrypt password hash from `npm run hash-password -- "your-password"`. Escape each `$` in the hash as `\$` so dotenv preserves the scrypt separators. Set `DEMO_USERNAME` and `DEMO_PASSWORD` for the recruiter account.
4. Run `npm run db:push`, then `npm run seed`, then `npm run dev` and open [http://localhost:3000](http://localhost:3000).

When `DATABASE_URL` is unset, local development uses PGlite in `.data/pglite`. Production uses Neon Postgres. A local production build can set a temporary syntactically valid Neon URL to prevent Next's parallel build workers from opening the same PGlite directory; build workers do not connect to it. For example, in PowerShell: `$env:DATABASE_URL='postgres://build:build@127.0.0.1:5432/build'; npm run build`.

If local startup fails at `client.waitReady` with `RuntimeError: Aborted()`, stop the dev server and preserve the broken local database before rebuilding it. In PowerShell, run `Move-Item .data/pglite ".data/pglite-corrupt-backup-$(Get-Date -Format yyyyMMdd-HHmmss)"`, then `npm run db:push`, `npm run seed`, and `npm run dev`. This creates a fresh seeded local demo database; the renamed directory keeps the previous local database available for recovery.

## Architecture

Next.js App Router and strict TypeScript serve the UI and API routes. Drizzle ORM maps the application schema to Postgres, with PGlite locally and Neon as the free-tier production target. The seed pipeline normalizes and deduplicates source CSVs, quarantines invalid subscriber rows, and stitches web and app identities. Shared subscriber facts compute cold status and engagement for lookup, live activity, segments, and the plan-only assistant.

## Data rules

- Email normalization lives in `src/lib/email.ts`: Unicode NFKC, trim, lowercase, then validate. Plus tags and dots are preserved; internationalized text is compatibility-normalized, not converted into provider-specific aliases.
- Subscriber rows merge by normalized email. Signup uses the earliest date, last open uses the latest non-null date, any unsubscribe wins, source comes from the earliest signup row (first file row breaks ties), and `duplicate_count` records merged rows.
- Invalid subscriber rows are retained in `quarantine` with their file, row number, raw values, and reason. Seed upserts are safe to repeat.
- A web visitor binds to the earliest-seen normalized email; its events link to a subscriber when that email matches. Multiple emails for one visitor are flagged and the earliest email wins. Shared browsers or reused cookies can misattribute visits.
- App accounts link by normalized email. Accounts without a subscriber match remain app-only profiles. Device links use the earliest event time; anonymous device events resolve through that link.
- Cold means no open for 31 days, or no open since signup for 31 days, among active subscribers. New never-opened subscribers are not cold. The engagement score uses open recency, recent web visits, app account presence, and recent app events.

## App webhook (M2)

`POST /webhooks/app` accepts signed events using `X-TPO-Timestamp` and `X-TPO-Signature: sha256=<hex>`. The signature is HMAC-SHA256 over the timestamp, a period, and the exact raw request body. Requests are limited to 16 KB and a 300/minute per-IP bucket; timestamps outside the 5-minute replay window are rejected. `WEBHOOK_SECRET_PREVIOUS` allows rotation. Event IDs are idempotent, device links retain the earliest event time, and activity resolves anonymous events through the device link at read time. Free-form properties are scrubbed for email and phone-like values before storage.

For a signed local smoke event, set `WEBHOOK_SECRET` in `.env.local` and run `npm run send-event`. A matching shell example (requires `openssl` and `jq`) is:

```sh
timestamp=$(date +%s)
body='{"event_id":"evt_manual_001","event":"app_open","user_id":"u_manual","device_id":"d_manual","timestamp":"2026-09-28T14:22:05Z","properties":{"source":"curl"}}'
signature=$(printf '%s' "$timestamp.$body" | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" -hex | sed 's/^.* //')
curl -i http://localhost:3000/webhooks/app \
  -H 'content-type: application/json' \
  -H "X-TPO-Timestamp: $timestamp" \
  -H "X-TPO-Signature: sha256=$signature" \
  --data-binary "$body"
```

Repeat the same command with the same body and timestamp while the signature is still fresh to get `200 {"status":"duplicate"}`. The authenticated `POST /api/demo/send-test-event` helper signs a generated event server-side and calls the same handler.

## Lookup and live activity (M3)

Open `/app/lookup` to search by email fragment or exact `v_`, `u_`, and `d_` identifiers. Search terms go in a JSON request body. Five deterministic recruiter samples are shown as masked addresses; selecting one searches by its subscriber UUID without sending its email to the browser. Search result emails remain masked by default, the visible toggle reveals them for the current view, and opening a full profile reveals its email. Subscriber profiles use the subscriber UUID, while app-only and visitor-only profile URLs use a keyed HMAC token derived with `SESSION_SECRET` so the original user/device/visitor identifier stays out of browser history. Profiles combine newsletter facts, site visits, app accounts, an activity timeline, identity explanations, and the pre-signup page path. `/app/live` polls every two seconds and links new events to their resolved profile. The demo event action uses the signed webhook handler.

## Segments (M4)

Open `/app/segments` to combine source, status, date, cold bucket, app, site activity, and engagement filters. The strict filter schema rejects unknown fields, and the compiler evaluates only allowlisted fields on the shared subscriber facts read model. Preview is debounced and paginated at 50 rows. Saved segments are shared with the team; viewers may save up to 10 each. CSV export includes the email Growth needs and prefixes spreadsheet formula cells with a single quote. A viewer export is capped at 5,000 rows.

## Assistant (M5)

Open `/app/assistant` for the three suggested audience questions and the plan-only assistant. Every provider payload is created by `buildModelRequest()` in `src/lib/ai/request.ts` from the redacted question, a static system prompt, and the static JSON schema. No database values or query results enter this function. The output is validated as a plan and executed locally; the rules planner gives the same suggested answers when no provider key is configured. The audit stores only the redacted prompt and validated plan. The UI's “What the model saw” drawer displays those exact values.

To enable Gemini, set `GEMINI_API_KEY` and choose `GEMINI_MODEL` from Google's currently available free-tier models that support structured output; the code does not pin a model. Without these values, the local rules fallback remains available. Redaction covers email-like strings, phone-like strings, and documented identifier patterns. TODO(stub): typed personal names cannot be reliably identified because the source data has no name field.

## Overview and data quality (M6)

`/app` loads reader, status, cold, source, visit-linking, quarantine, and recent-event figures from the database. The email-capture count is stored as a boolean on each `web_events` row; the email itself is not copied there. The cold-list card multiplies the query-backed lapsed and never-opened counts by an editable monthly assumption (default `$0.20`), not billing data. Its two actions save active-only lapsed and never-opened segments. `/app/data-quality` shows quarantine file/row/reason without displaying raw values, duplicate rows merged, unlinked visitors, and identity conflicts. Profile journey and link explanations are visible through Lookup.

## Public landing page (M7)

The public `/` page shows only aggregate figures from the seeded database, public recruiter demo credentials from environment variables, and a one-click viewer sign-in. `/login` redirects to the single public landing page's sign-in section. The 3D streams are lazy-loaded, capped at a 1.5 pixel ratio, and stop rendering while off-screen; reduced-motion and no-WebGL browsers use a static SVG. Google Fonts are not fetched during build: the local editorial font names are followed by system fallbacks. `DEMO_USERNAME` and `DEMO_PASSWORD` are intentionally public and must be configured as low-privilege viewer credentials on any shared deployment. On the 2026-10-16 build, initial shared JS was 443,530 bytes raw (130,095 gzip); the lazy scene chunk was 918,492 raw (242,544 gzip). A Lighthouse run was unavailable because the CLI could not be fetched from npm in this environment.

## Seeded data

`npm run seed` loads 2,995 subscriber rows, 10,000 web events, and 930 app users. It merges 85 duplicate rows into 2,900 subscribers and quarantines 10 invalid/blank subscriber rows. The checked facts include 2,610 active readers, 464 cold readers, 8,441 linked web rows, 900 matched app users, and 139 active readers scoring at least 70. `npm test` includes the complete set of applicable PRD golden-number assertions and a repeat-seed check.

## PII map

| Field | Stored in | Readers | Never put in |
|---|---|---|---|
| Email | `subscribers.email`, `visitors.email`, `app_users.email`, source values in `quarantine.raw` | Admin and viewer | URLs/query strings, logs, error messages, analytics, or model requests/responses |
| `visitor_id` | `visitors`, `web_events` | Admin and viewer | URLs/query strings, logs, error messages, analytics, or model requests/responses |
| `user_id` | `app_users`, `app_events`, `device_links` | Admin and viewer | URLs/query strings, logs, error messages, analytics, or model requests/responses |
| `device_id` | `device_links`, `app_events` | Admin and viewer | URLs/query strings, logs, error messages, analytics, or model requests/responses |

## Security and privacy operations

API mutations enforce same-origin checks and authenticated sessions. Admin-only `DELETE /api/profiles/{subscriber|app|visitor}/{id}` erases a profile and linked web/app activity, identifiers, delivery references, identity-conflict rows, and matching quarantined email values. App-only and visitor-only route IDs are keyed opaque tokens. The application sets CSP, HSTS, nosniff, same-origin referrer, and anti-framing headers; login, webhook, and assistant have rate limits. Web and app event retention intent is 180 days, but automatic expiry is not implemented. See [docs/DEPLOY.md](docs/DEPLOY.md) for Vercel and Neon setup.

## Assumptions

- The product clock is fixed to September 28, 2026, per the assessment.
- Web timestamps will be interpreted as UTC.
- The editable cold-list cost is an estimate supplied by the operator, not billing data.
- Event retention is intended to be 180 days; enforcement requires a future scheduled job.

## Known limitations

- TODO(stub): assistant redaction cannot reliably detect typed personal names because the data has no name field.
- Visitor stitching can misattribute visits on shared browsers; device stitching can misattribute anonymous activity after logout on a shared device.
- Rate-limit buckets use database-backed fixed windows; deployment-level IP forwarding must be configured so forwarded IP headers cannot be spoofed by untrusted clients.
- Profile erasure is a sequence of database statements rather than a transaction because the Neon HTTP driver does not support interactive transactions; an interrupted request may need the erasure retried.
- `npm audit` on 2026-10-16 reported 9 development-tool advisories (4 moderate, 5 high) through Drizzle Kit's esbuild-kit loader and ESLint's braces/fast-glob chain. The registry offered no non-major remediation; its suggested ESLint fix downgrades `eslint-config-next` to 14.2.35, so the app's 16.4.2 toolchain was not downgraded.
