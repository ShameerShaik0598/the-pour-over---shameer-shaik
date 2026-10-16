# PROMPTS.md — copy-paste prompts for Codex

## How to use these

1. Create an empty repo folder. Put these files in it: `AGENTS.md`, `PRD.md`, `PROMPTS.md`, `SUBMISSION_CHECKLIST.md`. Put the assessment PDF in the repo root as `TPO_Developer_Assessment.pdf`, and the three CSVs in `data/raw/`.
2. Open the folder in Codex. Paste the **Kickoff** prompt once. Then paste **one milestone per session**, in order.
3. Free-tier tip: Codex's free allowance resets on a rolling 5-hour window with weekly limits, so keep prompts short, do one milestone per session, never ask it to re-read the CSVs, and let `AGENTS.md` carry the rules. If you hit a limit, continue the same milestone in the Claude chat by pasting the relevant files.
4. After each milestone, run the app yourself for two minutes. If something is wrong, use the **Fix-forward** prompt at the bottom.
5. Cut line if time runs short (build in this order and stop when you must): M0 → M1 → M2 → M3 → M4 → M5 → M8 (deploy) → M6 → M7. A deployed, working core beats a beautiful unfinished one.

---

## Kickoff (paste once)

```
Read AGENTS.md, PRD.md, and TPO_Developer_Assessment.pdf completely. Then inspect the repo (it may be nearly empty) and the three CSVs in data/raw/ (headers and about 5 rows each; do not paste whole files into chat).
Reply with: (1) a 10-line summary of what we are building, (2) any ambiguity or contradiction you see between the PDF and the PRD (the PRD wins unless the PDF is stricter), (3) the milestone order you will follow from PROMPTS.md. Do not write code yet.
```

---

## M0 — Scaffold, design system, auth shell

```
Milestone M0. Goal: a running Next.js app with the design system and auth, deployed-ready, no business logic yet.

Do:
1. Scaffold Next.js (App Router) + TypeScript strict + Tailwind. Add scripts: dev, build, start, lint, typecheck, test, seed, db:push. Add Vitest.
2. Drizzle + database wiring per AGENTS.md: use PGlite when DATABASE_URL is unset (file at .data/pglite, gitignored), Neon serverless when set. Create src/lib/db.ts with one exported db. Implement the full schema from PRD section 6 and a db:push script.
3. src/lib/clock.ts (TODAY = 2026-09-28 and helpers), src/lib/email.ts (normalizeEmail per PRD section 5), src/lib/sources.ts. Unit tests for all three, including the edge cases listed in PRD section 16.
4. Design system per PRD section 13: CSS variables and Tailwind tokens, next/font (Fraunces, Instrument Sans, JetBrains Mono), and these components with a /dev/styleguide page (not linked from nav): Masthead, StatFigure, SourceChip, DataTable (stacks to cards under 640px), FilterChip, Skeleton, EmptyState, Toast.
5. Auth per PRD section 12: login route, logout route, jose session cookie, middleware protecting everything except the public routes, roles admin/viewer, login rate limit using the rate_limits table, same-origin check helper. Create a minimal /login page and a placeholder /app page showing the masthead and the logged-in role.
6. Security headers in next.config (CSP, HSTS, nosniff, referrer policy, frame-ancestors). Create .env.example with every variable from PRD section 17 and a script scripts/hash-password.ts that prints a scrypt hash.
7. README skeleton with run-locally steps.

Acceptance: npm run dev works with no env except SESSION_SECRET and the user variables; admin and demo logins work; unauthenticated /app redirects to /login; styleguide page renders at 375, 768, and 1280px; typecheck, lint, tests pass.
Commit: "feat: scaffold, design system, auth".
```

---

## M1 — Data layer and seed

```
Milestone M1. Goal: the three CSVs become a clean, linked dataset that exactly matches PRD section 4.

Do:
1. Implement the pipeline in src/lib/ingest/ following PRD sections 5 and 7: parse (csv-parse), normalize, quarantine, dedupe subscribers with the exact merge rule, upsert visitors and web events with row_key idempotency, upsert app users and link by email, and apply the visitor-stitching rule (including conflict detection).
2. Implement the subscriber_facts read model (SQL view or CTE module) with cold bucket, cold_start_date, web visits 30d, app flags, and engagement score exactly as defined in PRD section 5.
3. scripts/seed.ts: runs the pipeline, is idempotent, and prints a summary table matching PRD section 4.
4. Integration tests (PGlite) asserting EVERY golden number in PRD section 4 that applies to this layer (quarantine 10, duplicates 85, unique 2,900, active 2,610, unsubscribed 290, source counts, cold 464 = 252 + 212, Instagram active 806 with cold 141 = 79 + 62, went-cold-in-August 44 = 16 + 28, web 1,400 / 8,441 / 1,559 / 628, app 900 matched and 30 unmatched, 431 with both, linked 30-day rows 4,600 across 1,017, new subscribers 984 with 452 web, first pages list, engagement ≥ 70 count 139). Also test that running seed twice changes nothing.
5. If any golden number does not match, DO NOT edit the expected number. Investigate, explain the discrepancy, and ask me before changing a rule.

Acceptance: `npm run seed` prints the matching summary; all tests pass.
Commit: "feat(ingest): seed pipeline, dedupe, stitching, facts model".
```

---

## M2 — Webhook

```
Milestone M2. Goal: POST /webhooks/app exactly as specified in PRD section 8.

Do:
1. Route at the path that yields exactly /webhooks/app. Implement signature verification over the RAW body (HMAC-SHA256 of "<timestamp>.<raw body>", constant-time compare, 300 s replay window, secret rotation with WEBHOOK_SECRET_PREVIOUS), body size limit, Zod strict validation, and the per-IP rate limit.
2. Idempotent processing with single-statement upserts: events by event_id (ON CONFLICT DO NOTHING), unseen user_id creates an app_users row (origin webhook), device_links keeps the earliest first_seen_at, conflicts logged, webhook_deliveries recorded with the right outcome.
3. Read-time resolution helper: effective_user_id = COALESCE(event.user_id, device_links.user_id). Use it in a function getAppActivity(profile).
4. scripts/send-event.ts that signs and sends an event (for local testing), and put the curl + openssl example in the README.
5. Tests for every scenario in PRD section 16 (new, duplicate 200, duplicate with different payload, out-of-order login, login backfills earlier anonymous events, unknown user_id gets a profile, login without user_id 422, bad signature 401, stale 401, oversize 413, rotation secret accepted, event visible to getAppActivity immediately).
6. Do not log request bodies. Scrub email-like and phone-like substrings from `properties` before storing. Add the concurrency test: send the same signed event 20 times with Promise.all and assert exactly one stored row and 19 duplicate outcomes. Route all logging through src/lib/log.ts (create it now if it does not exist) with email redaction.

Acceptance: all webhook tests pass; a manual curl with a valid signature returns 202 and the same curl again returns 200 duplicate.
Commit: "feat(webhook): signed, idempotent app event ingestion".
```

---

## M3 — Lookup and Live feed

```
Milestone M3. Goal: find anyone, and watch events land.

Do:
1. API: POST /api/profiles/search with the query in the JSON body (email partial or exact, v_/u_/d_ ids; never put the query in the URL so emails stay out of access logs) and GET /api/profiles/[type]/[id] using opaque ids only returning the unified profile (newsletter, site, app, merged timeline, why-linked reasons, duplicate_count, engagement breakdown, pre-signup journey list). Zod-validate params. Max 20 search results.
2. UI per PRD sections 9 and 13: /app/lookup and the profile page with the three panels, the timeline with source filter, WhyLinkedChips, and the pre-signup journey (feature C). Fully responsive and keyboard accessible.
3. /app/live: poll GET /api/events/recent?since= every 2 s; show event, who it resolved to (link to profile), occurred vs received time, and delivery counters (accepted, duplicate, rejected) from webhook_deliveries. Add the "Send test event" button using POST /api/demo/send-test-event (server-side signing; same code path as production; admin and viewer allowed; rate limited).
4. Tests: search by each id type; profile for a subscriber with both web and app data; an app-only profile; a new webhook event appears in lookup without restart.

Acceptance: from the UI I can search an email from the CSV, see web and app data merged, click Send test event, and see it appear in Live and on the profile.
Commit: "feat(lookup): unified profiles and live event feed".
```

---

## M4 — Segments

```
Milestone M4. Goal: segment builder with live count, save, and safe CSV export.

Do:
1. Implement the Filter schema (PRD section 10) in src/lib/segments/ as a Zod schema plus a query compiler that turns a Filter into Drizzle conditions over subscriber_facts using ONLY allowlisted fields. No string concatenation of SQL.
2. API: POST /api/segments/preview (count + page of rows, sortable), GET/POST /api/segments (save, list; viewer cap 10), GET /api/segments/[id]/export.csv with formula-injection protection and a 5,000-row cap for viewers.
3. UI: /app/segments with filter chips, debounced live count, preview table, save dialog, saved list, export button. Include quick-start chips like "Instagram, active, cold 30+ days".
4. Tests: golden counts through the compiler (Instagram active cold = 141; Instagram went-cold-in-Aug = 44; min_engagement 70 = 139; has_app plus has_web_activity with status "any" = 431); CSV escaping test with cells beginning = + - @; unknown filter fields rejected.

Acceptance: I can build "Instagram signups, active, not opened in 30+ days", see 141, save it, export a safe CSV.
Commit: "feat(segments): compiler, preview, save, export".
```

---

## M5 — AI assistant

```
Milestone M5. Goal: the PII-safe assistant exactly as PRD section 11 and Appendix A.

Do:
1. src/lib/ai/ is the ONLY place that may import an LLM client. Create LlmClient (interface), a Gemini provider (GEMINI_API_KEY, GEMINI_MODEL from env; structured JSON output where supported), and a rules-based planner with the same plan shape for fallback and for the suggested prompts. Do not hardcode a model name; document in the README how to pick a free-tier model.
2. Pipeline: input validation and length cap, redaction of emails, phone-like strings, and identifier patterns (u_, d_, v_, evt_, UUIDs), per-session and per-IP rate limit (ASSISTANT_DAILY_LIMIT), cache for suggested prompts, provider call (timeout 8 s), output guard (reject any '@'), Zod plan validation, execution via the segment compiler and new query helpers (count, group_by, first_pages, trend), server-side answer templates, assistant_audit row with the exact redacted prompt text.
3. API POST /api/assistant. UI /app/assistant: chat column, suggested-prompt chips, ResultCards (metric, table, segment with Save button), filter chips, assumptions list, and the "What the model saw" drawer showing the exact redacted prompt and returned plan.
4. Tests (see PRD section 16): the mocked LlmClient records every request. Assert no seeded email, user_id, visitor_id, or device_id substring appears in ANY request; assert user-typed emails are redacted; assert output with an email is rejected; assert the three golden questions (44 with 16/28 breakdown; 139 engaged with first 100 listed; first-pages table) through BOTH the mocked provider path and the rules fallback; add a static test that fails if any file outside src/lib/ai/ imports an LLM SDK.
5. Build every model payload in ONE function, buildModelRequest() in src/lib/ai/request.ts, whose signature accepts only the redacted message and static strings (no database rows). Add a snapshot test of its output. Never send query results, counts, rows, or profile data to the model. The model call happens before execution and its output is only a plan.

Acceptance: the three sample questions return correct answers with the model disabled and with it enabled; the drawer shows exactly what was sent.
Commit: "feat(assistant): plan-only, PII-safe assistant with rules fallback".
```

---

## M6 — Overview and surprise features

```
Milestone M6. Goal: the Overview page and the three surprise features.

Do:
1. /app Overview per PRD section 13: Masthead with the date, 4 StatFigures (readers 2,900; active 2,610; cold 464; linked visits 8,441 of 10,000), source breakdown, recent live events, and a Data Quality summary linking to /app/data-quality.
2. Feature A: Stitching Impact card showing email-only linking (1,400 / 14%) versus stitched (8,441 / 84%), the 1,559 unlinked rows from 628 anonymous visitors, and a short "how stitching works" popover.
3. Feature B: Cold-list Cost card: cold subscribers x COST_PER_SUBSCRIBER_MONTH (default 0.20, editable in the UI as an assumption and clearly labeled as such), split by lapsed and never-opened, with buttons that create the "Win-back (lapsed)" and "Sunset candidates (never opened)" saved segments.
4. Feature C already exists on profiles; make sure it is visible and polished.
5. /app/data-quality page: quarantine rows with reasons, duplicates merged (85), unlinked visitors, identity conflicts.
6. Tests for the card numbers (they must come from queries, not hardcoded constants).

Acceptance: numbers on the cards match PRD section 4 and update when new webhook events change underlying data where relevant.
Commit: "feat(overview): stitching impact, cold-list cost, data quality".
```

---

## M7 — Landing page and 3D scene

```
Milestone M7. Goal: the polished public landing page with a subtle 3D scene and recruiter demo login.

Do:
1. Landing page `/` per PRD section 13: asymmetric hero (headline "Every reader, one cup.", subhead, two buttons: "Open recruiter demo" does a one-click demo login and goes to /app; "Sign in" scrolls to or opens the login card), the five-step strip with real numbers fetched from the database at build/request time (public, aggregate only, no PII), the login card with the PUBLIC demo credentials and copy buttons, and a footer with repo and README links.
2. PourScene with react-three-fiber exactly as specified in PRD section 13: lazy-loaded, about 240 particles (about 100 on mobile), three colored streams passing through a faint wireframe cone into a softly glowing vessel, tiny pointer parallax, paused off-screen, pixel ratio cap 1.5, static SVG fallback for reduced motion or no WebGL, aria-hidden.
3. Responsive polish and accessibility pass on the landing page and the login card. Add a skip link.
4. Check performance: report the landing page's JS size and a Lighthouse performance score. The scene must not block first paint.

Acceptance: at 375, 768, 1280 widths the page looks intentional; reduced motion shows the static SVG; one click on "Open recruiter demo" lands on /app as the viewer role.
Commit: "feat(landing): hero, 3D scene, recruiter demo login".
```

---

## M8 — Hardening, README, deploy

```
Milestone M8. Goal: production-ready submission.

Do:
1. Security review against PRD section 14: confirm headers, rate limits, same-origin checks, CSV protection, admin-only DELETE /api/profiles/[type]/[id] (with a test), no secrets or PII in logs. Run npm audit and report.
2. Finish the README: a PII map (where the email and the three ids live, who can read them, where they must never go), architecture in 5 sentences or fewer, run-locally steps, normalization and linking rules exactly as implemented, webhook docs with the curl+openssl example, PII design explanation with the exact code location where the prompt is built, assumptions, and an honest "Known limitations" list (every TODO(stub), hardcoded value, shortcut).
3. docs/AI_LOG.md: keep the entries you appended; add a short intro.
4. Deployment guide for Vercel + Neon (free tiers) in docs/DEPLOY.md, including how to seed production, how to set env vars, how to warm the database, and how to test the webhook against the live URL.
5. Final verification: npm run typecheck, lint, test, build all pass; list test counts; list any known failing or skipped tests honestly.

Acceptance: a fresh clone runs locally in under 5 minutes following the README alone.
Commit: "chore: hardening, docs, deployment guide".
```

---

## Utility prompts

**Fix-forward** (when something is wrong):
```
Something is wrong: <describe what you saw, what you expected, and the URL or command>. Do not guess. Reproduce it first, write a failing test if it is logic, fix the root cause, run typecheck, lint, and tests, and report what was wrong. If the mistake came from your earlier work, append an entry to docs/AI_LOG.md. Commit with a "fix:" message.
```

**Design critique** (after M3, M6, and M7):
```
Open the running app and review the screens against PRD section 13 and the "avoid" list in AGENTS.md. Take screenshots at 375, 768, and 1280px. List the 8 most visible problems (spacing, hierarchy, contrast, alignment, density, anything that looks generic or AI-template-like). Fix them, keeping changes small and consistent with the tokens. Report before/after.
```

**Self-audit** (final step, after M8): run the exact audit prompt from the last page of `TPO_Developer_Assessment.pdf` in Codex with the repo open, and paste the raw output unedited into your submission. Do not let the tool tidy it.
