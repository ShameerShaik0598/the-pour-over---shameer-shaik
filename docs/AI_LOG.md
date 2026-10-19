### 2026-10-15 — Keep framework-generated rules out of project instructions
Tool: Codex
What I asked for: Start the Next.js development server to verify the M0 auth shell.
What the AI did wrong or assumed: Next.js automatically appended its own agent guidance to the provided AGENTS.md file during startup, changing a user-supplied planning document.
How I noticed: Checked git status and diff after the dev server booted.
Fix: Restored AGENTS.md byte-for-byte from the supplied attachment and disabled Next.js agentRules generation in next.config.ts.

### 2026-10-15 — Separate cold never-opened from all active never-opened
Tool: Codex
What I asked for: Implement the M1 facts model and print the seeded data summary.
What the AI did wrong or assumed: The first summary labeled the 212 cold never-opened subscribers as all active never-opened subscribers, leaving out the 103 recent signups who are not cold.
How I noticed: Compared the result with PRD section 4, which expects 315 active never-opened and 103 not yet cold.
Fix: Added distinct counts for all active never-opened and the not-yet-cold subset, and asserted both values in the integration test.

### 2026-10-15 — Report blank quarantine rows accurately
Tool: Codex
What I asked for: Add data quality totals to the M1 seed output.
What the AI did wrong or assumed: It counted blank rows only when their reason string was exactly `blank row`, but the quarantine reason also listed the blank fields.
How I noticed: The first report said 0 blank rows despite the PRD's expected 8.
Fix: Count quarantine reasons that begin with `blank row`, and assert all 8 blank rows in the integration test.

### 2026-10-15 — Write local environment values on separate lines
Tool: Codex
What I asked for: Create a gitignored local `.env.local` for recruiter and owner logins.
What the AI did wrong or assumed: The first file-writing command escaped newlines as literal characters, so Next.js loaded only `SESSION_SECRET` and login returned invalid credentials.
How I noticed: Checked the local environment file's line count after the first login request failed.
Fix: Rewrote `.env.local` with actual line breaks, restarted the app, and verified the recruiter login and protected `/app` route.

### 2026-10-15 — Escape scrypt separators in dotenv values
Tool: Codex
What I asked for: Verify both the recruiter and owner login paths locally.
What the AI did wrong or assumed: It copied the `scrypt$...$...` value into `.env.local` without escaping its dollar signs; Next's dotenv expansion removed the separators and the admin login returned 401.
How I noticed: The same password verified against the raw hash but failed after loading it through Next's environment parser.
Fix: Escaped each `$` in `.env.local` and documented that requirement in `.env.example` and the README; both login routes now return 200.
# AI work log

Corrections and assumptions noticed during implementation are recorded here so they can be reviewed alongside the commits.

### 2026-10-16 — Remove build-time Google Fonts network dependency
Tool: Codex
What I asked for: Run the production build for M8.
What the AI did wrong or assumed: The layout used `next/font/google`, which made a successful production build depend on reaching Google Fonts during compilation.
How I noticed: `npm run build` failed while fetching Fraunces, Instrument Sans, and JetBrains Mono in this network-restricted environment.
Fix: Removed remote build-time font fetches and use the documented local system font stacks; the editorial font family names remain first in each CSS stack when installed locally.

### 2026-10-16 — Keep font stack variables valid after removing remote font loader
Tool: Codex
What I asked for: Remove network-dependent `next/font/google` imports so builds work offline.
What the AI did wrong or assumed: It removed the generated font variables but left CSS declarations referencing those undefined variables.
How I noticed: Reviewed the global styles after the offline build fix.
Fix: Pointed body and stat typography at the defined `--font-ui` and `--font-display` fallback stacks.

### 2026-10-16 — Store the email-capture fact per web event
Tool: Codex
What I asked for: Build a query-backed overview card comparing email-captured visits with stitched visits.
What the AI did wrong or assumed: It initially inferred row-level email capture from a visitor's saved email, which counted all 8,441 events for linked visitors instead of the 1,400 CSV rows that captured an email.
How I noticed: The new dashboard integration assertion showed 8,441 where the PRD requires 1,400.
Fix: Added a non-PII `email_captured` flag to each web event, populated it during CSV ingestion, and query that flag for the card; all PRD card counts now pass from seeded data.

### 2026-10-16 — Keep local PGlite outside the Next server bundle
Tool: Codex
What I asked for: Start the app and verify the new dashboard pages locally.
What the AI did wrong or assumed: It assumed passing PGlite's unit/integration tests and production build guaranteed its file-backed WASM runtime would behave inside Next's development server bundle.
How I noticed: Authenticated dashboard requests returned 500 with a filesystem `readFile` URL type error, while login and the tests passed.
Fix: Marked `@electric-sql/pglite` as a server external package so Node loads its supported runtime directly.

### 2026-10-16 — Constrain the hero illustration's mobile intrinsic width
Tool: Codex
What I asked for: Review the landing page at the specified 375, 768, and 1280 pixel widths.
What the AI did wrong or assumed: The 440px max-width scene's grid wrapper kept its intrinsic width on mobile and introduced horizontal page overflow; the 768px layout also waited too long to become asymmetric.
How I noticed: Browser viewport inspection showed a 456px document width at 375px and a stacked scene at 768px.
Fix: Let the scene grid item shrink with `min-w-0`, switch the hero to two columns at the tablet breakpoint, and rechecked all three viewport widths without horizontal overflow.

### 2026-10-16 — Avoid opening the persistent local database during injected test flows
Tool: Codex
What I asked for: Run all integration checks after adding the local 3D dependency and landing page.
What the AI did wrong or assumed: Several modules eagerly initialized the file-backed PGlite singleton even when callers supplied isolated in-memory databases; concurrent initialization in Vitest caused WASM aborts before assertions ran.
How I noticed: The affected suites passed when their modules lazily loaded the default database only for calls without an injected database.
Fix: Made webhook, login rate-limit, assistant, and profile-route database fallbacks lazy; injected-database flows no longer open `.data/pglite` at import time.

### 2026-10-16 — Recover the local demo from an aborted PGlite store
Tool: Codex
What I asked for: Fix the reported `RuntimeError: Aborted()` at `client.waitReady` when starting Carafe locally.
What the AI did wrong or assumed: I previously left the local demo using its existing file-backed PGlite store without checking whether that store could be reopened after the server stopped.
How I noticed: Opening `.data/pglite` directly reproduced the WASM abort after the dev server was stopped, while a fresh PGlite directory initialized successfully.
Fix: Preserved the broken store as a local backup, recreated the schema and seeded the golden dataset, and documented the recovery steps in the README.

### 2026-10-16 — Redirect after browser sign-out
Tool: Codex
What I asked for: Fix the sign-out flow that left the browser showing `{"ok":true}` at the logout endpoint.
What the AI did wrong or assumed: I returned a JSON success response from a route submitted by a regular browser form, so the browser navigated to and displayed that response.
How I noticed: Submitting the sign-out form posts directly to `/api/auth/logout`; the route clears the cookie but does not navigate afterward.
Fix: Keep clearing the session cookie and return an HTTP 303 redirect to `/login` for the form submission.

### 2026-10-16 — Consolidate sign-in and add masked recruiter lookup samples
Tool: Codex
What I asked for: Combine the separate login page with the landing sign-in section and provide five masked sample emails in Lookup.
What the AI did wrong or assumed: I duplicated the credential form at `/login` even though the public landing page already contained recruiter credentials and sign-in.
How I noticed: Navigating from “Back to Carafe” exposed a second login experience instead of returning directly to the existing landing sign-in section.
Fix: Redirect `/login` to `/#login`; add five server-masked samples, search each by subscriber UUID, and keep the full email available only after opening its profile.

- M2 local event sender initially used a named ESM import for `loadEnvConfig` from `@next/env`; Node resolved its CommonJS entry and the smoke command failed before sending. Switched to Node's `createRequire` to call the package's CommonJS export, then reran the sender against the local app.
- M3 profile integration coverage initially assumed the first seeded app account also had web activity and an app event. The seed only guarantees an aggregate overlap, not which account appears first or that CSV users have webhook events, so the test now selects from the actual overlap and adds a test app event for that reader.
- The M2 CLI smoke test created one `u_demo_test` row in the persistent local database, making a later seed summary show 931 app users. Removed the test event, device link, and profile created by that smoke test; reran `npm run seed` and restored the expected 930 app users. Keep future webhook smoke tests in isolated PGlite databases or clean their named local fixture afterward.
- M3's first final lint run stalled while ESLint traversed the generated local `.data` database directory. Added `.data/**` to ESLint's global ignores; the database is generated state and not source code.
- M4's first segment compiler treated `has_web_activity` as a last-30-days condition, yielding 320 instead of the PRD's 431 overlap. The filter means any recorded site activity, so the compiler now checks all linked web history; `webVisitCount30` remains reserved for the score and 30-day metrics.
- M5's first-page assistant query inherited the regular active-only default and returned 80 `/` visits instead of the PRD cohort's 87. Section 4's new-subscriber page counts include all statuses, so the assistant plan now preserves an omitted status and uses `any` for this aggregate only; explicitly requested status filters remain respected.
- Netlify hardening initially relied on the database-mode helper to narrow `process.env.DATABASE_URL`; TypeScript correctly noted that the helper's return value cannot narrow the separate environment expression. Added an explicit presence check in the Neon branch and kept the mode decision in the tested helper.
