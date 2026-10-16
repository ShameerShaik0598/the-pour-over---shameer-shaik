import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { migrate as migrateNeon } from "drizzle-orm/neon-http/migrator";
import { closeDatabase, db, type AppDatabase } from "@/lib/db";
import { seedData, getSeedStats } from "@/lib/ingest/seed";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "@/lib/db/schema";

if (process.env.DATABASE_URL) await migrateNeon(db as unknown as NeonHttpDatabase<typeof schema>, { migrationsFolder: "./drizzle" });
else await migratePglite(db as unknown as PgliteDatabase<typeof schema>, { migrationsFolder: "./drizzle" });

const ingest = await seedData(db as AppDatabase);
const stats = await getSeedStats(db as AppDatabase, ingest.input.webRowsWithEmail);
const sourceRows = Object.entries(stats.sourceCounts).map(([source, count]) => `${source.padEnd(12)} ${count}`).join("\n");
const summary = [
  `Raw rows       subscribers ${ingest.input.subscribers} · web ${ingest.input.webEvents} · app ${ingest.input.appUsers}`,
  `Subscribers    ${stats.subscriberRows} unique · ${stats.duplicatesRemoved} duplicate rows removed · ${stats.quarantined} quarantined`,
  `Source rows    blank ${ingest.input.blankSubscriberRows} · malformed email ${ingest.input.malformedSubscriberEmails} · uppercase ${ingest.input.uppercaseSubscriberEmails} · whitespace ${ingest.input.whitespaceSubscriberEmails} · conflicting duplicate groups ${ingest.input.duplicateGroupsWithConflictingValues}`,
  `Status         ${stats.active} active · ${stats.unsubscribed} unsubscribed`,
  `Sources\n${sourceRows}`,
  `Cold           ${stats.cold.total} (${stats.cold.lapsed} lapsed, ${stats.cold.neverOpened} never opened) · active never-opened ${stats.cold.activeNeverOpened} / not yet cold ${stats.cold.notYetCold}`,
  `Instagram      ${stats.instagramActive} active · cold ${stats.instagramCold.total} (${stats.instagramCold.lapsed} lapsed, ${stats.instagramCold.neverOpened} never opened) · went cold in Aug ${stats.instagramWentColdAugust.total} (${stats.instagramWentColdAugust.lapsed}/${stats.instagramWentColdAugust.neverOpened})`,
  `Web            ${stats.web.rows} rows · ${stats.web.distinctVisitors} visitors · ${stats.web.rowsWithEmail} email rows (all ${ingest.input.webEmailRowsOnSubscribe} on /subscribe) · ${stats.web.linkedRows} linked · ${stats.web.unlinkedRows} unlinked (${stats.web.anonymousVisitors} anonymous visitors) · conflicts ${stats.web.conflictingVisitors}`,
  `Web last 30d   ${stats.web.linkedRows30} linked rows · ${stats.web.linkedSubscribers30} subscribers`,
  `App            ${stats.app.users} users · ${stats.app.matched} matched · ${stats.app.unmatched} app-only · ${stats.app.bothWebAndApp} with web and app`,
  `New readers    ${stats.newSubscribers.total} · ${stats.newSubscribers.withWeb} with web activity · engagement ≥70: ${stats.engagement.atLeast70} (max ${stats.engagement.max})`,
  `First pages    ${Object.entries(stats.firstPages).map(([page, count]) => `${page} ${count}`).join(" · ")}`,
].join("\n");
process.stdout.write(`${summary}\n`);
if (!process.env.DATABASE_URL) await closeDatabase();
