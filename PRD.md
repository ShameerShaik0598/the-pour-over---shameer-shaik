# PRD — Carafe: a mini CDP for The Pour Over

Status: final for build. Audience: the coding agent (Codex) and the human owner.
Deadline: applications close **2026-10-19**. Target submission: **2026-10-18 evening**.
"Today" inside the product is fixed at **2026-09-28** (per the assessment).

## 1. Summary

The Pour Over (TPO) is a free, politically neutral Christian news newsletter, sent Monday, Wednesday, and Friday, with a mobile app and a podcast. Its email platform is beehiiv. Subscriber data is scattered across the email platform, the website, and the app, so the Growth team cannot see one person across all three.

Build a hosted web app that:

1. **Pulls it together**: loads three CSVs into one database, dedupes subscribers, and links web visits and app accounts to subscribers.
2. **Finds anyone**: one view per person with newsletter info, site visits, and app activity.
3. **Builds a segment**: a filter builder with a live count, saved segments, and CSV export.
4. **Never sleeps**: `POST /webhooks/app` ingests app events in real time, safely.
5. **Talks back**: a plain-English assistant that answers with a number, a table, or a segment, and **never sees PII**.
6. **Surprises**: three small features that matter to a Growth team (section 3).

Success means a reviewer can open the URL, log in as a recruiter in one click, find a person, build a segment, watch a webhook land live, ask the assistant three sample questions and get correct answers, and read an honest README, in under 10 minutes.

## 2. Users

- **Growth teammate** (primary, non-technical): wants answers without SQL. Needs trust: "why is this person linked?".
- **Reviewer / recruiter** (secondary): evaluates correctness, security, judgment, and polish. Uses the one-click demo login.
- **Owner/admin** (the applicant): full access.

## 3. Scope

**Must** (the five requirements) plus auth, README, tests, deployment.

**Should** (surprise features, build in this order):

- **A. Stitching impact card** on the Overview: shows that linking by email alone connects 1,400 of 10,000 web visits, while visitor stitching connects 8,441 (84%). Includes a "why" popover and the 628 anonymous visitors still unlinked.
- **B. Cold-list cost estimator**: TPO has said it costs about $0.20 per subscriber per month to operate. Show cold subscribers × $0.20 as a monthly cost, with a one-click "Create win-back segment" and "Create sunset candidates" (never-opened) segment. The $0.20 figure is a labeled, editable assumption, not data.
- **C. Pre-signup journey** on profiles: the pages a person viewed before their signup date, shown as a short path.
- **D. Privacy mode**: emails are masked in list views by default (for example `a•••@gmail.com`, via a `maskEmail()` helper) with a visible toggle to reveal; full emails remain on profile pages and in CSV export, which Growth needs. Typed searches still match full emails. This demonstrates PII minimization in the UI, not only in the model path.

**Could** (only if time remains): dark theme; Playwright smoke test; droplet animation on the Live page when an event lands.

**Won't**: real beehiiv/app integrations, multi-tenant accounts, email sending, payments.

## 4. Data findings and golden numbers

Raw files (all synthetic): `subscribers.csv` (2,995 rows), `web_events.csv` (10,000 rows), `app_users.csv` (930 rows). Tests must assert these numbers exactly.

| Area | Fact | Value |
|---|---|---|
| Subscribers | Fully blank rows | 8 |
| | Malformed emails (`not-an-email`, `@gmail.com`) | 2 |
| | Quarantined total | **10** |
| | Valid rows | 2,985 |
| | Rows with uppercase in email / with surrounding whitespace | 63 / 22 |
| | Duplicate rows removed (after normalization) | **85** |
| | Unique valid subscribers | **2,900** |
| | Active / unsubscribed | **2,610 / 290** |
| | By source (unique) | Instagram 899, Facebook 552, Referral 538, Google 346, Podcast 226, Direct 225, X 114 |
| | Duplicate groups with conflicting field values | 0 (rule still required) |
| Cold (active only) | Cold total | **464** (lapsed 252, never-opened 212) |
| | Active never-opened total / not yet cold | 315 / 103 |
| | Instagram active | **806** |
| | Instagram active, cold | **141** (lapsed 79, never-opened 62) |
| | Instagram active that **went cold in Aug 2026** | **44** (lapsed 16, never-opened 28) |
| Web | Rows / distinct visitors | 10,000 / 2,028 |
| | Rows carrying an email (all on `/subscribe`) | 1,400 |
| | Rows linked via visitor stitching (includes the 1,400) | **8,441** |
| | Unlinked rows / anonymous visitors | **1,559 / 628** |
| | Subscribers with any web activity | 1,400 |
| | Linked rows in the last 30 days / subscribers | 4,600 / 1,017 |
| | Visitors with more than one distinct email | 0 |
| App | App users / matched to a subscriber | 930 / **900** |
| | Unmatched app users (`appuser#@gmail.com`) | **30** (get their own profiles) |
| | Subscribers with both web activity and an app account | 431 |
| New subscribers | Signed up on or after 2026-08-29 | 984 (452 have web activity) |
| | First page hit by those 452 (by each visitor's first event) | `/` 87, `/subscribe` 83, `/shadrachs-picks` 38, `/about` 38, `/news/church-attendance-study` 32 (ties broken by CSV row order, then path A→Z) |
| Engagement | Active subscribers with score ≥ 70 / max score | 139 / 90 (seed data only, no app events) |

Other observations to preserve: web timestamps have no timezone (treat as UTC); there are no future-dated rows; no `last_open_date` precedes its signup; utm uses `twitter` while subscriber source uses `X`; there are no plus-addressed emails and no Gmail dot collisions, so **do not** strip dots or plus tags.

## 5. Domain rules (single source of truth)

**Email normalization** (`src/lib/email.ts`, the only place): Unicode NFKC, trim, lowercase, then validate with `^[^@\s]+@[^@\s]+\.[^@\s]{2,}$`. Return `null` if invalid. Document the edge cases (plus tags, dots, internationalized addresses) in the README.

**Source taxonomy** (`src/lib/sources.ts`): canonical values Instagram, Facebook, X, Google, Referral, Podcast, Direct. Map case-insensitively. UTM `twitter` → X. A blank UTM stays `null` (never mapped to Direct).

**Dates**: `signup_date`, `last_open_date`, `created_at` are dates; web timestamps and webhook timestamps are UTC instants. "Last 30 days" = `[2026-08-29T00:00:00Z, 2026-09-28T23:59:59.999Z]`.

**Subscriber dedupe rule**: group valid rows by normalized email. Merge to one row: `signup_date` = earliest; `last_open_date` = latest non-null; `status` = `unsubscribed` if any row says so (conservative: never email someone who opted out); `source` = the earliest-signup row's source (ties: first in file); store `duplicate_count`. Rows with a missing or unrecognized status, signup date, or source go to quarantine with a reason.

**Quarantine**: table `quarantine(source_file, row_number, raw, reason)`. Surface counts and rows in a Data Quality page. Never silently drop.

**Cold definition** (active subscribers; unsubscribed are excluded by default):
`cold_start_date = (last_open_date ?? signup_date) + 31 days`; cold when `cold_start_date <= TODAY`.
Buckets: `lapsed` (has opened, now cold), `never_opened` (never opened, signed up more than 30 days ago), `new_unopened` (never opened, signup within 30 days; **not** cold), `warm` (opened within 30 days).
**Went cold in a month M**: cold today and `cold_start_date` falls inside M. "Last month" = the calendar month before TODAY's month = August 2026.

**Engagement score** (active only, 0–100, explainable, show the breakdown in the UI):
open recency (≤7d: 50, ≤14d: 40, ≤30d: 25, else/never: 0) + web visits in the last 30 days (3 points each, cap 30) + app account (10) + app events in the last 30 days (1 point each, cap 10).

**Web linking rule (visitor stitching)**: every web row with an email binds its `visitor_id` to that normalized email. All rows with that `visitor_id` (before or after the email row) link to the subscriber with that email. If the email has no subscriber, the visitor links to the email only. If a visitor ever shows two distinct emails, mark `visitors.conflict = true`, link to the earliest-seen email, and report it in Data Quality. Known limitation: shared browsers or reused cookies; document it.

**App linking rule**: `app_users.email` (normalized) matches a subscriber. No match → an app-only profile keyed by `user_id`.

**Device identity rule**: any event with a non-null `user_id` binds its `device_id` to that user; `login` events are the primary signal. If a device has several users, the earliest by event time wins, and the conflict is logged in `identity_conflicts`. Anonymous events (user_id null) from a device resolve to that device's user **at read time** (`COALESCE(event.user_id, device_links.user_id)`), so late logins and out-of-order arrival attach correctly with no backfill job. Known limitation: logout followed by anonymous use on a shared device attaches to the first user; document it.

**"New subscriber"** = signup within the last 30 days. **"First page hit"** = the page of each linked visitor's earliest web event.

## 6. Data model (Drizzle, Postgres)

- `subscribers(id uuid pk, email text unique not null, signup_date date, status enum(active,unsubscribed), source text, last_open_date date null, duplicate_count int, created_at)`
- `visitors(visitor_id text pk, email text null, subscriber_id uuid null fk, conflict bool default false, first_seen timestamptz)`
- `web_events(id bigserial pk, visitor_id fk, page text, occurred_at timestamptz, utm_source text null, row_key text unique)` where `row_key` = visitor + page + timestamp, so re-seeding is idempotent. Index `(visitor_id, occurred_at)`.
- `app_users(user_id text pk, email text null, subscriber_id uuid null fk, created_at timestamptz, origin enum(csv,webhook))`
- `device_links(device_id text pk, user_id text not null, first_seen_at timestamptz)`
- `app_events(event_id text pk, event enum(app_open,read_story,link_click,login), user_id text null, device_id text not null, occurred_at timestamptz, received_at timestamptz default now(), properties jsonb)`. Indexes on `device_id`, `user_id`, `occurred_at`.
- `webhook_deliveries(id bigserial pk, event_id text null, outcome enum(accepted,duplicate,invalid,bad_signature,stale,too_large,rate_limited), received_at)`. No bodies stored for rejected requests.
- `identity_conflicts(id, kind, ref_a, ref_b, detected_at)`
- `quarantine(id, source_file, row_number, raw jsonb, reason, created_at)`
- `segments(id uuid pk, name, filter jsonb, created_by, created_at)`
- `assistant_audit(id, session_id, sent_prompt text, plan jsonb null, outcome, provider, created_at)`: the exact redacted text sent to the model, for transparency.
- `rate_limits(key text, window_start timestamptz, count int, pk(key, window_start))` for login, assistant, and webhook limits (serverless-safe).

A read model (SQL view or CTE) `subscriber_facts` computes per subscriber: last open, cold bucket, cold_start_date, web visits (30d), app account flag, app events (30d), engagement score. Lookup and segments both use it.

## 7. Ingestion (seed)

`npm run seed` reads the three CSVs and runs them through the **same functions** the webhook uses (`normalizeEmail`, `resolveAppUser`, `linkDevice`). Steps: parse → normalize → quarantine invalid → dedupe subscribers → upsert visitors and web events → upsert app users and link by email → compute DQ stats. Idempotent: running it twice gives identical counts. Print a summary that matches section 4. Seed is a CLI script only; do not expose a re-seed route.

## 8. Webhook: `POST /webhooks/app`

Route file path must yield exactly `/webhooks/app`.

Request body (validate with Zod, strict):
```json
{ "event_id": "evt_9f3a1c", "event": "read_story", "user_id": "u_2b6447a3",
  "device_id": "d_4b21e8", "timestamp": "2026-09-28T14:22:05Z",
  "properties": { "story": "supreme-court-ruling-explained" } }
```
`event` ∈ `app_open | read_story | link_click | login`. `user_id` may be `null`, but `login` requires a non-null `user_id` (422 otherwise). `timestamp` must be ISO-8601 with `Z`. `properties` is an object, at most 2 KB, nesting depth at most 2, string values at most 200 characters. Because free-form properties can leak PII (for example a `link_click` URL carrying an email), **scrub on ingest**: replace any email-like or phone-like substring with `[redacted]` before storing. It is never sent to a model, never logged, and never used in URLs. Do **not** reject events based on how old or new their timestamp is.

Authentication (production-grade): headers `X-TPO-Timestamp` (unix seconds) and `X-TPO-Signature: sha256=<hex>`, where the signature is `HMAC_SHA256(secret, "<timestamp>.<raw body>")` computed over the **raw bytes** of the body. Compare in constant time. Reject if `|now − X-TPO-Timestamp| > 300 s` (replay window). Support `WEBHOOK_SECRET` and an optional `WEBHOOK_SECRET_PREVIOUS` for rotation. Body limit 16 KB. Basic per-IP rate limit (300/min) that never blocks a valid signature under normal load.

Responses: `202 {"status":"accepted"}` for new events; `200 {"status":"duplicate"}` for a repeated `event_id` (safe for retries); `400` invalid payload; `401` bad or missing signature, or a stale timestamp (generic message; record the real outcome `bad_signature` or `stale` only in `webhook_deliveries`); `413` too large; `422` login without user_id; `429` rate limited. Never echo the payload in errors.

Processing (single statements, idempotent):
1. Verify signature, then parse, then validate.
2. `INSERT INTO app_events ... ON CONFLICT (event_id) DO NOTHING RETURNING`. No row returned → duplicate (log the delivery; do nothing else). If a duplicate `event_id` arrives with a different payload, still ignore it and write an `identity_conflicts` row of kind `event_id_payload_mismatch`.
3. If `user_id` is not null: `INSERT INTO app_users (user_id, origin='webhook') ON CONFLICT DO NOTHING` so an **unseen user_id still gets a profile**. If it exists from the CSV it keeps its email link.
4. If `user_id` is not null: upsert `device_links` keeping the **earliest** `first_seen_at` (`ON CONFLICT DO UPDATE ... WHERE excluded.first_seen_at < device_links.first_seen_at`); log a conflict if a different user already owns the device.
5. Insert a `webhook_deliveries` row.

Out-of-order and duplicate handling is therefore: ordering is always by `occurred_at`, never arrival; identity is resolved at read time; duplicates are dropped by primary key.

Demo helper: `POST /api/demo/send-test-event` (session required, admin and demo roles, rate-limited) builds a valid event and sends it to the real webhook handler with a server-side signature, so recruiters can watch a live event land without ever seeing the secret. It must go through the same code path as production events.

## 9. Lookup

Search box accepts: full or partial email (≥ 3 chars), `v_…` visitor id, `u_…` user id, `d_…` device id. Return up to 20 results with type chips. Profile types: **Subscriber** (may have web and app data) and **App-only** (unmatched app user or webhook-created user).

Profile page layout: header (email, status badge, source, signup date, last open, cold bucket, engagement score with breakdown); three panels (Newsletter, Site, App); one merged **timeline** filterable by source; **"Why linked?"** chips (`email match`, `stitched via v_xxxx`, `device d_xxxx → login`); duplicate-merge note ("merged 2 rows"); pre-signup journey (feature C). New events must appear without a restart (client re-fetch or short polling).

## 10. Segments

Filter JSON (also what the assistant emits), validated by Zod:
```
{ sources?: Source[], status?: "active"|"unsubscribed"|"any"  (default "active"),
  signup_between?: [date,date], cold?: "lapsed"|"never_opened"|"any_cold"|"warm"|"new_unopened",
  went_cold_between?: [date,date], last_open_within_days?: int,
  has_app?: bool, has_web_activity?: bool, min_engagement?: int(0-100),
  new_within_days?: int }
```
UI: filter chips; **live count** (debounced); preview table (50 rows per page, sortable); save with name; export CSV. CSV export must neutralize formula injection: prefix any cell starting with `=`, `+`, `-`, `@`, tab, or CR with a single quote, and set `Content-Disposition: attachment`. Cap a viewer's saved segments at 10.

## 11. AI assistant (free, PII-safe by construction)

**Principle: the model never receives data.** It gets the user's question (with emails and phone numbers regex-redacted) plus a static description of the available filters and metrics, and it returns a JSON **plan**. The server validates the plan with Zod, runs it against the database with the allowlisted query builder, and renders the answer from the results using server-side templates. Names, emails, rows, counts, and IDs never enter a model request or response. This is stronger than masking and is the core of the Loom explanation.

Flow for `POST /api/assistant {message, sessionId}`:
1. Reject if message is empty or over 500 characters. Rate limit per session and per IP (default 20/day, configurable by `ASSISTANT_DAILY_LIMIT`) so free quota survives recruiter traffic.
2. **Input redaction**: replace emails, phone-like strings, and identifier patterns (`u_…`, `d_…`, `v_…`, `evt_…`, UUIDs) with `[redacted]`. Names cannot be reliably detected: the database has no name field, only emails that contain name-like text, and none of that is ever sent. State this limitation honestly in the README and Loom. Person-specific questions are refused by the planner (`refuse` intent), so a typed name leads nowhere. Optional hardening: server-side redaction of tokens that match name-like local parts in the database, accepting some false positives; the comparison list itself must never leave the server.
3. Check the **answer cache** for exact suggested prompts; if hit, skip the model.
4. Build every model payload in **one function**, `buildModelRequest(redactedMessage)` in `src/lib/ai/request.ts`. It is the only place a prompt is assembled, so it is easy to quote in the self-audit and to snapshot-test. It takes only the redacted message and static strings; its signature must not accept database rows. Then call the model through `LlmClient` (one file per provider). Primary provider: Gemini free tier via `GEMINI_API_KEY`, model from `GEMINI_MODEL` (check Google's pricing page for a Flash/Flash-Lite model with a free tier; do not hardcode a model name). Use JSON-schema structured output where supported.
5. **Output guard**: reject any model output containing an `@` or an email-like string; Zod-validate the plan; unknown fields rejected.
6. Execute the plan; build the result card.
7. Write `assistant_audit` with the exact redacted text sent to the model.
8. **Fallback**: if the provider errors, times out, or returns 429, use the deterministic rules planner (keyword and pattern matching that produces the same plan shape) and label the answer "answered by rules engine". The three sample questions must work with no provider at all.

Plan schema:
```
{ intent: "count"|"list"|"segment"|"first_pages"|"trend"|"clarify"|"refuse",
  filter?: Filter, group_by?: "source"|"status"|"cold_bucket"|"signup_week",
  sort?: "engagement_desc"|"signup_desc", limit?: int(<=100),
  segment_name?: string, clarifying_question?: string, assumptions?: string[] }
```
Result card shows: the answer; the **filter chips** used; the assumptions (for example "cold = no open in 30+ days; unsubscribed excluded"); a **"What the model saw"** drawer showing the exact text sent and the plan JSON returned; for `segment` intents, a "Save segment" button.

Expected behavior on the three required questions (golden):
1. "How many Instagram signups went cold last month?" → count **44**, broken down 16 lapsed and 28 never-opened, with assumptions displayed.
2. "Build me a list of our most engaged readers" → segment sorted by engagement, active only, score ≥ 70 (**139** people), first 100 previewed.
3. "Which pages do new subscribers hit first?" → table using section 4 values (`/` 87, `/subscribe` 83, …).

Requests for a specific person ("look up ana@x.com") → intent `refuse` with a pointer to Lookup. Prompt-injection attempts cannot do harm because the model has no data and no tools, and its output must pass the plan schema. The planner system prompt is in Appendix A.

## 12. Auth and roles

- Roles: `admin` (owner) and `viewer` (recruiter demo).
- Credentials from env: `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH` (Node `crypto.scrypt` format), `DEMO_USERNAME`, `DEMO_PASSWORD`. The demo credentials are **intentionally public** (shown on the landing page with copy buttons plus a one-click "Open recruiter demo" button).
- Session: signed JWT via `jose` in an HttpOnly, Secure, SameSite=Lax cookie, 8-hour expiry. Middleware protects everything except `/`, `/login`, `/api/auth/*`, `/api/health`, and `/webhooks/app`.
- `viewer` can: read everything, run segments and the assistant, save up to 10 segments, send a test event. `viewer` cannot: delete anything, export more than 5,000 rows, or reach admin routes.
- Login rate limit: 10 attempts per 10 minutes per IP via `rate_limits`.
- Same-origin check (Origin/Host) on all mutating session routes; the webhook is excluded because it uses HMAC.

## 13. UI/UX specification

**Concept: "Morning Edition."** The app reads like a calm newspaper front page about your readers. A dated masthead shows "Monday, September 28, 2026". Sections are labeled like an edition. Numbers are large, serif, and confident. This fits TPO's coffee-and-news identity without copying their site.

**Information architecture**: `/` landing and login; `/app` Overview; `/app/lookup` and `/app/lookup/[type]/[id]`; `/app/segments`; `/app/live`; `/app/assistant`; `/app/data-quality`. Navigation: left sidebar on desktop; bottom tab bar on mobile (Overview, Lookup, Segments, Live, Ask).

**Design tokens** (CSS variables mapped into Tailwind; tune visually, keep text contrast at WCAG AA):
paper `#FAF5EC`, paper-2 `#F3EBDD`, ink `#2A1D14`, ink-muted `#5C4A3D`, line `#E4D8C5`, accent (terracotta) `#D9694B` for large elements and fills only, accent-strong `#B4472D` for text and links, sage `#5E7D63` (positive), amber `#C58A2B` (warning), danger `#B2432F`. Source colors: newsletter `#D9694B`, web `#2F5D6B`, app `#C2993A`.
Type via `next/font/google` (self-hosted at build): display **Fraunces**, UI **Instrument Sans**, mono **JetBrains Mono**. Scale: 12/14/16/20/28/40/64. Spacing on a 4px grid. Hairline 1px borders instead of shadows; radius 6–10px, not everything pill-shaped. Tabular numerals in tables. Small-caps labels for section headings.
Motion: 150–250 ms ease-out; respect `prefers-reduced-motion`.

**Components**: Masthead, StatFigure (big serif number with caption), SourceChip (three source colors), DataTable (sticky header, becomes stacked cards under 640px), FilterChip, ProfileTimeline, WhyLinkedChip, ResultCard, ModelSeenDrawer, EmptyState, Skeleton, Toast.

**Pages**:
- *Landing*: asymmetric hero. Left: serif headline (suggested: "Every reader, one cup."), a one-line subhead, two buttons ("Open recruiter demo" primary, "Sign in" secondary). Right: the 3D scene. Below: a five-step strip (Pull together, Find anyone, Build a segment, Never sleeps, Talks back), each showing one real number from the seeded data (for example "2,995 rows → 2,900 readers", "84% of visits linked"). Login card with demo credentials and copy buttons. Footer with repo and README links.
- *Overview*: masthead, 4 StatFigures (readers, active, cold, linked visits), Stitching Impact card (A), Cold-list Cost card (B), source breakdown, recent live events, Data Quality summary.
- *Lookup*: large search; results as a compact list; profile as described in section 9.
- *Segments*: filter builder left, results right (stack on mobile).
- *Live*: event feed polling every 2 s, delivery counters (accepted, duplicate, rejected), "Send test event" button.
- *Assistant*: chat-like column, suggested-prompt chips, ResultCards, ModelSeenDrawer.
- *Data Quality*: quarantine rows, duplicates merged, unlinked visitors, identity conflicts.

**3D landing scene** (`PourScene`): three thin particle streams (about 80 particles each: newsletter terracotta, web teal, app amber) drift down from three directions, pass through a faint wireframe filter cone, and gather in a softly glowing vessel. Rules: lazy-loaded with `next/dynamic` (`ssr: false`); about 240 particles (about 100 on mobile); slow, calm motion; tiny pointer parallax; pause when off-screen (IntersectionObserver); pixel ratio capped at 1.5; if WebGL is unavailable or `prefers-reduced-motion` is set, render a static SVG of the same composition; the scene must not delay first paint or hurt Lighthouse performance noticeably. The scene must be decorative and `aria-hidden`.

**Accessibility**: semantic landmarks, visible focus rings, keyboard-operable tables, drawers and chips, labels on all inputs, status never conveyed by color alone, minimum 44px touch targets, skip link.

## 14. Security requirements

Authentication and sessions (section 12); webhook HMAC with replay window and constant-time compare; Zod validation on every route; Drizzle parameterized queries only and allowlisted dynamic filters; React escaping with no raw HTML; security headers (CSP without inline script where possible, HSTS, `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`, `frame-ancestors 'none'`); CSV formula-injection protection; rate limits (login, assistant, webhook); no PII or secrets in logs; secrets only in env vars; `npm audit` clean or documented; admin-only delete endpoint `DELETE /api/profiles/[type]/[id]` that removes a person and their linked rows (right to erasure); documented retention intent (web and app events 180 days; enforcement is a "next steps" item, no cron on free tier).
**PII handling (graded heavily; implement explicitly):**
- *PII inventory*: the only direct PII is the email address (subscribers, web rows that carry one, app users). Identifiers `visitor_id`, `user_id`, `device_id` are pseudonymous but treated as sensitive. The README must include a **PII map**: where each lives (tables), who can read it (roles), and where it must never go (model requests and responses, logs, URLs and query strings, error messages, analytics).
- *No PII in URLs*: lookup search uses `POST /api/profiles/search` with the query in the body, and profile pages use opaque ids (subscriber UUID, `user_id`), never an email, so emails stay out of access logs and browser history.
- *Logging*: all logging goes through `src/lib/log.ts`, which redacts email-like strings and drops request bodies. No `console.log` elsewhere (enforced by a lint rule or test).
- *Minimization*: store only fields the product needs; scrub webhook `properties` on ingest; assistant audit stores only the redacted text.
- *Retention and erasure*: documented retention intent plus the admin erase endpoint, which also removes rows derived from the person (visitor links, app events for linked users) and leaves no email behind.
- *Model boundary*: sections 11 and 16 (plan-only model, single request builder, recording test).

**The "one other security concern" for the Loom**: CSV formula injection on export (and prompt injection, mitigated by the no-data design).

## 15. Constraints: cost, performance, free tiers

All services free tier. Dataset is small (about 3,000 subscribers, 10,000 web events), so no caching layer is needed. Neon may scale to zero: show skeleton loaders, and add `/api/health` that runs a trivial query so you can warm it before sharing the link. Keep first-load JS lean; the 3D bundle is lazy.

## 16. Testing plan (Vitest)

Unit: `normalizeEmail` (case, whitespace, malformed, Unicode); source mapping; dedupe merge rule; cold buckets and `went_cold`; engagement score; CSV escaping; signature verification (good, bad, stale, wrong body).
Integration (seeded PGlite): section 4 golden numbers; seed idempotency; webhook scenarios: new event, duplicate (200), duplicate with different payload, out-of-order login (earlier timestamp arrives later), login backfills earlier anonymous events at read time, unknown `user_id` creates a profile, login without `user_id` returns 422, bad signature 401, stale timestamp 401, oversize 413, event visible in lookup and segment counts immediately.
AI/PII: with a mocked `LlmClient` that records requests, run all suggested prompts and assert no seeded email, user_id, visitor_id, or device_id appears in any request; assert user-typed emails are redacted before sending; assert model output containing an email is rejected; assert the three golden questions via both the provider path (mock returns the expected plan) and the rules fallback.
Static: `no-duplicate-normalization` test; `no-llm-import-outside-ai` test; `no-console-log` test (only `src/lib/log.ts` may log).
Concurrency and PII hardening: fire the same signed event 20 times concurrently with `Promise.all` and assert exactly one stored event and 19 duplicate outcomes; assert `properties` containing an email is stored redacted; assert identifier patterns in an assistant message are redacted before the request builder; snapshot-test the output of `buildModelRequest` so a future change that adds data fails loudly; assert the logger redacts emails; assert profile and search routes never put an email in a URL.
Optional: Playwright smoke (landing → demo login → lookup → send test event → assistant).

## 17. Deployment and environment

Vercel (Hobby) + Neon free Postgres. Env vars in `.env.example`: `DATABASE_URL` (optional locally), `SESSION_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `DEMO_USERNAME`, `DEMO_PASSWORD`, `WEBHOOK_SECRET`, `WEBHOOK_SECRET_PREVIOUS` (optional), `GEMINI_API_KEY`, `GEMINI_MODEL`, `ASSISTANT_DAILY_LIMIT`, `COST_PER_SUBSCRIBER_MONTH` (default 0.20). Seed production by running `DATABASE_URL=… npm run seed` from a local machine. README must include: run-locally steps, architecture in 5 sentences, normalization and linking rules, webhook curl example with the signing command, PII design, known limitations, assumptions.

## 18. Open assumptions (record in README)

Web timestamps are UTC. "Cold" means more than 30 days since last open (or since signup if never opened). Unsubscribed people are excluded from cold and engagement by default. The $0.20 per subscriber per month figure comes from a public TPO statement and is an editable assumption. Device-to-user mapping uses the earliest user seen. Reviewer webhook secret is shared privately, not committed.

## Appendix A — Planner system prompt (use verbatim as the starting point)

```
You translate a Growth teammate's question about newsletter subscribers into a JSON query plan.
You never see subscriber data. You only see the question and the definitions below.
Return ONLY one JSON object matching the schema. No prose, no markdown, no code fences.
Never include email addresses, names, or identifiers in your output. If the user asks about a specific person, return intent "refuse".

Today's date is 2026-09-28. "Last month" means August 2026 (2026-08-01 to 2026-08-31).

Definitions:
- Cold: an ACTIVE subscriber with no email open for more than 30 days. If they never opened, the 30 days run from signup.
  cold buckets: lapsed (opened before, now cold), never_opened (never opened, signed up over 30 days ago), new_unopened (never opened, signed up within 30 days; not cold), warm.
- Went cold in a period: became cold during that period and still cold today (use went_cold_between).
- New subscriber: signed up within the last 30 days (use new_within_days: 30).
- Engaged: high engagement score (0-100). "Most engaged" means sort by engagement_desc, min_engagement 70, limit 100.
- Sources: Instagram, Facebook, X, Google, Referral, Podcast, Direct.
- Unsubscribed people are excluded unless the user explicitly asks for them (status: "any" or "unsubscribed").

Intents: count (how many), list (show people), segment (build or save a list), first_pages (which pages do people hit first), trend (counts over time, use group_by), clarify (question is ambiguous; set clarifying_question), refuse (asks for a specific person or private data).
Put any assumption you made in assumptions[] as short plain sentences.

Schema:
{ "intent": "...", "filter": { ...optional fields from the filter schema... },
  "group_by": "source|status|cold_bucket|signup_week" (optional),
  "sort": "engagement_desc|signup_desc" (optional), "limit": number <= 100 (optional),
  "segment_name": string (optional), "clarifying_question": string (optional),
  "assumptions": string[] (optional) }

Examples:
Q: How many Instagram signups went cold last month?
A: {"intent":"count","filter":{"sources":["Instagram"],"status":"active","went_cold_between":["2026-08-01","2026-08-31"]},"assumptions":["Cold means no open for more than 30 days.","Unsubscribed people are excluded."]}
Q: Build me a list of our most engaged readers
A: {"intent":"segment","filter":{"status":"active","min_engagement":70},"sort":"engagement_desc","limit":100,"segment_name":"Most engaged readers"}
Q: Which pages do new subscribers hit first?
A: {"intent":"first_pages","filter":{"new_within_days":30},"limit":10}
```
