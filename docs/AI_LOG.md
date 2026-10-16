### 2026-10-15 — Keep framework-generated rules out of project instructions
Tool: Codex
What I asked for: Start the Next.js development server to verify the M0 auth shell.
What the AI did wrong or assumed: Next.js automatically appended its own agent guidance to the provided AGENTS.md file during startup, changing a user-supplied planning document.
How I noticed: Checked git status and diff after the dev server booted.
Fix: Restored AGENTS.md byte-for-byte from the supplied attachment and disabled Next.js agentRules generation in next.config.ts.
