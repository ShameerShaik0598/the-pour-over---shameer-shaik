import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/lib/db/schema";
import type { AppDatabase } from "@/lib/db";
import { appUsers, appEvents, deviceLinks, identityConflicts, quarantine, subscribers, visitors, webEvents } from "@/lib/db/schema";
import { SOURCES } from "@/lib/sources";
import { seedData, getSeedStats } from "@/lib/ingest/seed";

describe("CSV ingestion and subscriber facts", () => {
  let client: PGlite;
  let database: AppDatabase;

  beforeAll(async () => {
    client = new PGlite();
    await client.waitReady;
    database = drizzle(client, { schema });
    await migrate(database, { migrationsFolder: "./drizzle" });
  }, 120_000);

  afterAll(async () => { await client.close(); });

  it("matches all applicable PRD golden numbers and seeds idempotently", async () => {
    const ingestion = await seedData(database);
    const stats = await getSeedStats(database, ingestion.input.webRowsWithEmail);
    expect(ingestion.input).toMatchObject({ subscribers: 2995, webEvents: 10000, appUsers: 930, blankSubscriberRows: 8, malformedSubscriberEmails: 2, uppercaseSubscriberEmails: 63, whitespaceSubscriberEmails: 22, webRowsWithEmail: 1400, webEmailRowsOnSubscribe: 1400, duplicateGroupsWithConflictingValues: 0 });
    expect(ingestion.subscriberRowsValid).toBe(2985);
    expect(ingestion.duplicateRowsRemoved).toBe(85);
    expect(stats).toMatchObject({ subscriberRows: 2900, quarantined: 10, duplicatesRemoved: 85, active: 2610, unsubscribed: 290, sourceCounts: { Instagram: 899, Facebook: 552, Referral: 538, Google: 346, Podcast: 226, Direct: 225, X: 114 } });
    expect(stats.cold).toEqual({ total: 464, lapsed: 252, neverOpened: 212, activeNeverOpened: 315, notYetCold: 103, newUnopened: 103 });
    expect(stats.instagramActive).toBe(806);
    expect(stats.instagramCold).toEqual({ total: 141, lapsed: 79, neverOpened: 62 });
    expect(stats.instagramWentColdAugust).toEqual({ total: 44, lapsed: 16, neverOpened: 28 });
    expect(stats.web).toMatchObject({ rows: 10000, distinctVisitors: 2028, rowsWithEmail: 1400, linkedRows: 8441, unlinkedRows: 1559, anonymousVisitors: 628, conflictingVisitors: 0, subscribersWithActivity: 1400, linkedRows30: 4600, linkedSubscribers30: 1017 });
    expect(stats.app).toEqual({ users: 930, matched: 900, unmatched: 30, bothWebAndApp: 431 });
    expect(stats.newSubscribers).toEqual({ total: 984, withWeb: 452 });
    expect(stats.firstPages).toEqual({ "/": 87, "/subscribe": 83, "/shadrachs-picks": 38, "/about": 38, "/news/church-attendance-study": 32 });
    expect(stats.engagement).toEqual({ atLeast70: 139, max: 90 });
    const rawRows = await Promise.all([database.select().from(subscribers), database.select().from(visitors), database.select().from(webEvents), database.select().from(appUsers), database.select().from(appEvents), database.select().from(deviceLinks), database.select().from(identityConflicts), database.select().from(quarantine)]);
    expect(rawRows.map((rows) => rows.length)).toEqual([2900, 2028, 10000, 930, 0, 0, 0, 10]);
    expect(rawRows[0]!.every((row) => !row.lastOpenDate || row.lastOpenDate >= row.signupDate)).toBe(true);
    expect(rawRows[2]!.every((row) => row.occurredAt.toISOString() <= "2026-09-28T23:59:59.999Z")).toBe(true);
    expect(rawRows[2]!.every((row) => row.utmSource === null || (SOURCES as readonly string[]).includes(row.utmSource))).toBe(true);

    await seedData(database);
    const statsAgain = await getSeedStats(database, ingestion.input.webRowsWithEmail);
    const rawRowsAgain = await Promise.all([database.select().from(subscribers), database.select().from(visitors), database.select().from(webEvents), database.select().from(appUsers), database.select().from(quarantine)]);
    expect(statsAgain).toEqual(stats);
    expect(rawRowsAgain.map((rows) => rows.length)).toEqual([2900, 2028, 10000, 930, 10]);
  }, 300_000);
});
