# Carafe

A mini customer data platform for The Pour Over. Carafe will bring newsletter, website, and app activity into one calm reader view.

## Run locally

1. Install Node.js 20 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local`. Set a random `SESSION_SECRET` with at least 32 characters, `ADMIN_USERNAME`, and an scrypt password hash from `npm run hash-password -- "your-password"`. Escape each `$` in the hash as `\$` so dotenv preserves the scrypt separators. Set `DEMO_USERNAME` and `DEMO_PASSWORD` for the recruiter account.
4. Run `npm run db:push`, then `npm run seed`, then `npm run dev` and open [http://localhost:3000](http://localhost:3000).

When `DATABASE_URL` is unset, local development uses PGlite in `.data/pglite`. Production uses Neon Postgres.

## Architecture

Next.js App Router and strict TypeScript serve the UI and API routes. Drizzle ORM maps the application schema to Postgres. PGlite provides a local embedded database, while Neon is the free-tier production target. The seed pipeline normalizes and deduplicates the source CSVs, quarantines invalid subscriber rows, and stitches web and app identities. A shared subscriber facts read model computes cold status and engagement; later milestones add lookup, segments, and assistant views.

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

## Seeded data

`npm run seed` loads 2,995 subscriber rows, 10,000 web events, and 930 app users. It merges 85 duplicate rows into 2,900 subscribers and quarantines 10 invalid/blank subscriber rows. The checked facts include 2,610 active readers, 464 cold readers, 8,441 linked web rows, 900 matched app users, and 139 active readers scoring at least 70. `npm test` includes the complete set of applicable PRD golden-number assertions and a repeat-seed check.

## PII map

| Field | Stored in | Readers | Never put in |
|---|---|---|---|
| Email | `subscribers.email`, `visitors.email`, `app_users.email`, source values in `quarantine.raw` | Admin and viewer | URLs/query strings, logs, error messages, analytics, or model requests/responses |
| `visitor_id` | `visitors`, `web_events` | Admin and viewer | URLs/query strings, logs, error messages, analytics, or model requests/responses |
| `user_id` | `app_users`, `app_events`, `device_links` | Admin and viewer | URLs/query strings, logs, error messages, analytics, or model requests/responses |
| `device_id` | `device_links`, `app_events` | Admin and viewer | URLs/query strings, logs, error messages, analytics, or model requests/responses |

## Assumptions

- The product clock is fixed to September 28, 2026, per the assessment.
- Web timestamps will be interpreted as UTC.

## Known limitations

- TODO(stub): overview figures remain placeholders until the M6 data-backed dashboard.
- TODO(stub): when Google Fonts cannot be reached during the build, next/font uses system fallbacks instead of Fraunces, Instrument Sans, and JetBrains Mono.
- The name field is not present in the data; future assistant redaction cannot reliably detect a typed personal name.
- Visitor stitching can misattribute visits on shared browsers; device stitching can misattribute anonymous activity after logout on a shared device.
