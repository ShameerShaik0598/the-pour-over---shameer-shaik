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

- M2 local event sender initially used a named ESM import for `loadEnvConfig` from `@next/env`; Node resolved its CommonJS entry and the smoke command failed before sending. Switched to Node's `createRequire` to call the package's CommonJS export, then reran the sender against the local app.
- M3 profile integration coverage initially assumed the first seeded app account also had web activity and an app event. The seed only guarantees an aggregate overlap, not which account appears first or that CSV users have webhook events, so the test now selects from the actual overlap and adds a test app event for that reader.
- The M2 CLI smoke test created one `u_demo_test` row in the persistent local database, making a later seed summary show 931 app users. Removed the test event, device link, and profile created by that smoke test; reran `npm run seed` and restored the expected 930 app users. Keep future webhook smoke tests in isolated PGlite databases or clean their named local fixture afterward.
- M3's first final lint run stalled while ESLint traversed the generated local `.data` database directory. Added `.data/**` to ESLint's global ignores; the database is generated state and not source code.
- M4's first segment compiler treated `has_web_activity` as a last-30-days condition, yielding 320 instead of the PRD's 431 overlap. The filter means any recorded site activity, so the compiler now checks all linked web history; `webVisitCount30` remains reserved for the score and 30-day metrics.
