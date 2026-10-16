# AGENTS.md — project rules (read this first, every session)

Project: **Carafe**, a mini customer data platform (CDP) for The Pour Over (TPO) developer application assessment.
Source of truth: `PRD.md` (requirements, rules, golden numbers) and `TPO_Developer_Assessment.pdf` (the original brief).
Data: `data/raw/subscribers.csv`, `data/raw/web_events.csv`, `data/raw/app_users.csv` (synthetic; copy the three attached CSVs there on first run).

## How to work

1. **One milestone per session.** Follow `PROMPTS.md`. Do not start the next milestone until the current one's acceptance checks pass.
2. **Inspect before editing.** Read the repo tree and the files you will touch. State a plan in 10 lines or fewer, then build.
3. **Commit at the end of every milestone** (and at natural checkpoints inside it) with a conventional message such as `feat(webhook): signature check and idempotent insert`. Never squash or rewrite history; the commit history is audited for AI-versus-human provenance.
4. **Be concise in chat.** Summarize what changed, what you tested, and what is still open. No long explanations of code you just wrote.
5. **Do not invent scope.** If the PRD is silent, choose the simplest option, record it under "Assumptions" in `README.md`, and keep going. Only stop to ask if a decision is irreversible or blocks everything.
6. **Never mark something done without running it.** Run `npm run typecheck`, `npm run lint`, and `npm test` before finishing a milestone and report the results honestly, including failures.

## Stack (fixed)

Next.js (App Router) + TypeScript (strict) + Tailwind CSS, Drizzle ORM, PostgreSQL.
Production DB: Neon (free tier). Local dev and tests: PGlite (embedded Postgres in WASM) when `DATABASE_URL` is unset, so `npm run dev` works with zero setup. If PGlite causes more than 30 minutes of friction, switch local dev to a `docker-compose.yml` Postgres and record the change in `docs/AI_LOG.md`.
Validation: Zod at every boundary. Tests: Vitest. Optional: Playwright smoke test.
Everything must run on **free tiers only**. No paid services, no paid APIs.
Keep dependencies minimal. No component library that gives a generic look; small custom components with Tailwind and design tokens. Allowed helpers: `lucide-react`, `clsx`, `zod`, `jose`, `drizzle-orm`, `@electric-sql/pglite`, `@neondatabase/serverless`, `three` with `@react-three/fiber`, `csv-parse`.

## Non-negotiable engineering rules

- **One email normalizer.** `normalizeEmail()` lives only in `src/lib/email.ts`. Do not call `.toLowerCase()` or `.trim()` on emails anywhere else. A test (`tests/no-duplicate-normalization.test.ts`) greps `src/` and fails if email normalization appears outside that file.
- **One clock.** `src/lib/clock.ts` exports `TODAY = 2026-09-28` and helpers. Business logic never calls `Date.now()` or `new Date()` for "today". Only the webhook replay check and `received_at` use the real clock.
- **Database writes are idempotent single statements** (`INSERT ... ON CONFLICT`). Do not depend on interactive transactions; the Neon HTTP driver does not support them.
- **Dynamic SQL is built only from allowlisted fields** via the Drizzle query builder. Never concatenate user or model output into SQL.
- **The language model never sees data.** Only `src/lib/ai/` may import an LLM client. The model receives the (redacted) user question plus a static schema description, and returns a JSON plan. See PRD section 11. A test must prove no seeded email or row value reaches a model request.
- **No secrets in the repo.** Use `.env.example` with placeholders.
- **PII discipline.** The email is the only direct PII; treat `visitor_id`, `user_id`, `device_id` as sensitive too. Never put them in URLs or query strings, logs, error messages, or model requests. All logging goes through `src/lib/log.ts`, which redacts emails and drops request bodies; do not use `console.log` anywhere else (a test enforces it). Scrub webhook `properties` on ingest. Every model payload is built by `buildModelRequest()` in `src/lib/ai/request.ts`, whose signature must not accept database rows.
- **Keep a PII map current** in the README (where each PII field lives, who can read it, where it must never go).
- **No `any`, no `// @ts-ignore`,** no `dangerouslySetInnerHTML`, no `localStorage` for auth.
- **Mark every stub, hardcoded value, or shortcut** with a `TODO(stub):` comment and list it in `README.md` under "Known limitations". The final self-audit asks for this list, so it must be accurate.
- **Honest README.** Document normalization, dedupe rule, linking rule, webhook behavior, and the PII design exactly as implemented.

## Design rules (UI work)

Follow PRD section 13. In short: warm paper-and-ink editorial look, hairline borders, one accent color, serif display font with a clean sans for UI and mono for IDs. Avoid: purple or blue gradients, glassmorphism, grids of identical rounded cards, emoji used as icons, heavy shadows, centered-everything layouts. Every screen must work at 375px, 768px, and 1280px widths, be keyboard-navigable, and meet WCAG AA contrast.

## Definition of done for any milestone

- Acceptance checks in `PROMPTS.md` pass.
- `npm run typecheck`, `npm run lint`, `npm test` pass.
- New behavior has tests; golden numbers from PRD section 4 are asserted where relevant.
- `README.md` updated for anything a reviewer needs to run or understand.
- If your earlier output was wrong and you corrected it, append an entry to `docs/AI_LOG.md` (what you assumed, what was wrong, how it was fixed). This feeds the "where the AI was wrong" part of the Loom.
- Work is committed.

## Commands (create these in `package.json`)

`dev`, `build`, `start`, `lint`, `typecheck`, `test`, `seed` (idempotent: loads CSVs through the same resolver code the webhook uses), `db:push` (apply schema).
