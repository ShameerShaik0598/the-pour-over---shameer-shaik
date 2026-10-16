# SUBMISSION_CHECKLIST.md

Applications close **2026-10-19**. Aim to submit by the evening of **2026-10-18**. Questions go to sam@thepourover.org.

## What to send (from the assessment)

- [ ] Live URL
- [ ] Webhook URL (`https://<your-host>/webhooks/app`)
- [ ] Repo link with a README that lets a reviewer run it locally
- [ ] Self-audit output, pasted raw and unedited
- [ ] Loom, 5 to 8 minutes
- [ ] The recruiter demo credentials (they are public on the landing page, but repeat them in the email)
- [ ] The webhook secret, **shared privately in the email body only, never in the repo**, so the team can send their own signed test event

## Self-audit readiness (the audit prompt asks nine questions; make sure the repo answers each one cleanly)

| Audit question | Where the repo should answer it |
|---|---|
| 1. Architecture in 5 sentences | README architecture section |
| 2. Normalization locations | Exactly one: `src/lib/email.ts`; backed by the no-duplicate-normalization test |
| 3. Dedupe and linking rules, missed edge cases | PRD section 5 rules mirrored in README; limitations listed (shared browsers, plus-tags, logout on shared device) |
| 4. Webhook dedupe, ordering, login backfill, unknown user, auth | `src/app/webhooks/app/route.ts` plus the webhook test file |
| 5. PII and the assistant: quote the prompt code, yes or no | `buildModelRequest()` in `src/lib/ai/request.ts` plus the recording test; the honest answer is "no" for emails and rows, with the names limitation stated |
| 6. Tests | Vitest suite with golden numbers; list it in the README |
| 7. Three most serious security issues | Be honest: shared public demo credentials, free-tier rate limits are best-effort, no durable retention job |
| 8. Unfinished or stubbed | Every `TODO(stub):` plus README known limitations |
| 9. Provenance | Honest commit history; `docs/AI_LOG.md` shows where you intervened |

Run the audit yourself once before the final run and fix anything embarrassing, but paste only the final raw output.

## Webhook test command for the reviewers (put this in the README too)

```bash
export WEBHOOK_SECRET='<secret from the email>'
BODY='{"event_id":"evt_demo_001","event":"read_story","user_id":null,"device_id":"d_demo_01","timestamp":"2026-09-28T14:22:05Z","properties":{"story":"supreme-court-ruling-explained"}}'
TS=$(date +%s)
SIG=$(printf '%s.%s' "$TS" "$BODY" | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" -hex | sed 's/^.* //')
curl -i -X POST "https://<your-host>/webhooks/app" \
  -H "Content-Type: application/json" \
  -H "X-TPO-Timestamp: $TS" \
  -H "X-TPO-Signature: sha256=$SIG" \
  -d "$BODY"
```

Expected: `202 {"status":"accepted"}`. Run it again: `200 {"status":"duplicate"}`. Change one character of the body without re-signing: `401`.

## Loom outline (target 7:30)

| Time | Section | Show |
|---|---|---|
| 0:00 | Hook | Landing page and the 3D scene. One sentence on the problem: data scattered across three places. |
| 0:30 | Pull it together | Data Quality page: 2,995 raw rows → 2,900 readers, 10 quarantined, 85 duplicates merged. Stitching card: 14% → 84% of visits linked. |
| 1:30 | Find anyone | Search an email, show the three panels, the timeline, and "Why linked?" chips. |
| 2:15 | Segment | Instagram, active, cold 30+ days = 141. Save it. Export the CSV. |
| 3:00 | **Webhook, live** | Split screen: terminal and the Live page. Send an event, then the duplicate (200), then a bad signature (401). Send a login for a new device and show earlier anonymous events attach. |
| 4:15 | Assistant | Ask the three sample questions. Open "What the model saw". |
| 5:00 | PII | Explain: the model never receives data, only the redacted question and a static schema, and returns a plan. Show the test that records every model request. |
| 5:45 | How I used AI | Be specific. Tools used and for what. Read 2 or 3 entries from `docs/AI_LOG.md`: where the AI was wrong and how you caught it. |
| 6:45 | One other security concern | CSV formula injection on export (show the escaped cell), or prompt injection and why the design contains it. |
| 7:15 | Next steps | Real beehiiv integration, durable job for retention, per-user accounts, richer identity graph, schema for event properties. |

Recording tips: free Loom plans may cap video length, which I have not verified, so check before you record. If the cap is under 8 minutes, aim for the 5 to 6 minute end of the range. Rehearse the webhook demo once, and warm the database first.

## AI_LOG template (`docs/AI_LOG.md`)

```
### <date> — <short title>
Tool: <Codex | Claude chat>
What I asked for: ...
What the AI did wrong or assumed: ...
How I noticed: <test failed | read the diff | ran it | the golden number did not match>
Fix: ...
```

Real examples to look for as you build: an AI that strips Gmail dots or plus tags; one that counts new never-opened subscribers as cold; one that adds a body-parsing step that breaks the signature (signature must be over the raw bytes); one that uses interactive transactions that the Neon HTTP driver does not support; one that sends result rows to the model "to write a nicer answer".

## Pre-submit verification (do all of these in a private window)

- [ ] Warm the database: open `/api/health`, then load the app.
- [ ] Landing page loads; the 3D scene appears; reduced-motion shows the static fallback.
- [ ] "Open recruiter demo" logs in as viewer in one click. Typed demo credentials also work.
- [ ] Viewer cannot delete, and cannot reach admin pages.
- [ ] Lookup finds an email from the CSV and shows web and app data.
- [ ] Segment "Instagram + active + cold" shows **141**; "went cold in Aug" shows **44**.
- [ ] Send test event button: the event appears on Live and on the profile without a refresh.
- [ ] The curl command above returns 202, then 200, and 401 when tampered.
- [ ] The assistant answers all three sample questions with a provider key set, and also with the key removed (rules fallback).
- [ ] Check on a real phone: landing, login, lookup, segments, assistant.
- [ ] No secrets, emails, or real data in the repo; `.env.example` has placeholders only.
- [ ] `npm run typecheck`, `lint`, `test`, `build` pass on a fresh clone.
- [ ] README: run-locally steps work, known limitations are honest.
- [ ] Run the self-audit prompt from the PDF with the repo open and paste the raw output.
- [ ] Re-read the PDF's "How to send it in" list once more before sending.
