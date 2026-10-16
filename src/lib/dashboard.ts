import { count, eq, isNull } from "drizzle-orm";
import type { AppDatabase } from "@/lib/db";
import { identityConflicts, quarantine, visitors, webEvents } from "@/lib/db/schema";
import { getSeedStats } from "@/lib/ingest/seed";
import { recentEvents } from "@/lib/profile";

export async function getOverviewData(database: AppDatabase) {
  const [emailEvents] = await database.select({ count: count() }).from(webEvents).where(eq(webEvents.emailCaptured, true));
  const stats = await getSeedStats(database, emailEvents?.count ?? 0);
  const [qualityRows, unlinkedVisitors, conflicts] = await Promise.all([
    database.select({ id: quarantine.id, sourceFile: quarantine.sourceFile, rowNumber: quarantine.rowNumber, reason: quarantine.reason }).from(quarantine).orderBy(quarantine.sourceFile, quarantine.rowNumber),
    database.select().from(visitors).where(isNull(visitors.subscriberId)),
    database.select().from(identityConflicts),
  ]);
  const dataQuality = {
    quarantined: qualityRows,
    duplicatesMerged: stats.duplicatesRemoved,
    unlinkedVisitors: unlinkedVisitors.length,
    identityConflicts: conflicts.length,
  };
  const live = await recentEvents(database, null);
  return { stats, dataQuality, live };
}
