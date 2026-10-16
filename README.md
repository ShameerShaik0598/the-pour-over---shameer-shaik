# Carafe

A mini customer data platform for The Pour Over. Carafe will bring newsletter, website, and app activity into one calm reader view.

## Run locally

1. Install Node.js 20 or newer.
2. Copy `.env.example` to `.env.local` and set a 32-character `SESSION_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `DEMO_USERNAME`, and `DEMO_PASSWORD`.
3. Run `npm install`, then `npm run dev` and open [http://localhost:3000](http://localhost:3000).

When `DATABASE_URL` is unset, local development uses PGlite in `.data/pglite`. Production uses Neon Postgres.

## Architecture

Next.js App Router and strict TypeScript serve the UI and API routes. Drizzle ORM maps the application schema to Postgres. PGlite provides a local embedded database, while Neon is the free-tier production target. CSV ingestion, webhook events, and account links will feed a unified read model. The app renders that model through lookup, segments, and assistant views.

## Assumptions

- The product clock is fixed to September 28, 2026, per the assessment.
- Web timestamps will be interpreted as UTC.

## Known limitations

- TODO(stub): overview figures remain placeholders until M1 data seeding is complete.
- TODO(stub): when Google Fonts cannot be reached during the build, next/font uses its system fallback instead of the specified Fraunces, Instrument Sans, and JetBrains Mono files.
