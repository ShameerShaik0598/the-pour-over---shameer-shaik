import type { AppDatabase } from "@/lib/db";
import { appEvents, appUsers, deviceLinks, subscribers, visitors, webEvents } from "@/lib/db/schema";
import { last30DaysStartDate, shiftDate, TODAY } from "@/lib/clock";

const WINDOW_START = Date.parse(`${last30DaysStartDate()}T00:00:00.000Z`);
const WINDOW_END = Date.parse(`${TODAY}T23:59:59.999Z`);

export type ColdBucket = "lapsed" | "never_opened" | "new_unopened" | "warm";
export type SubscriberFact = (typeof subscribers.$inferSelect) & {
  coldStartDate: string;
  cold: boolean;
  coldBucket: ColdBucket;
  webVisitCount30: number;
  hasApp: boolean;
  appEvents30: number;
  engagementScore: number;
  web: (typeof webEvents.$inferSelect)[];
};

function addDays(dateValue: string, days: number) {
  return shiftDate(dateValue, days);
}

function daysSince(dateValue: string) {
  return Math.floor((Date.parse(`${TODAY}T00:00:00.000Z`) - Date.parse(`${dateValue}T00:00:00.000Z`)) / 86_400_000);
}

function openRecencyPoints(lastOpenDate: string | null) {
  if (!lastOpenDate) return 0;
  const days = daysSince(lastOpenDate);
  if (days <= 7) return 50;
  if (days <= 14) return 40;
  if (days <= 30) return 25;
  return 0;
}

export async function getSubscriberFacts(database: AppDatabase): Promise<SubscriberFact[]> {
  const [subscriberRows, visitorRows, webRows, appUserRows, appEventRows, deviceRows] = await Promise.all([
    database.select().from(subscribers), database.select().from(visitors), database.select().from(webEvents),
    database.select().from(appUsers), database.select().from(appEvents), database.select().from(deviceLinks),
  ]);
  const visitorById = new Map(visitorRows.map((row) => [row.visitorId, row]));
  const appUserById = new Map(appUserRows.map((row) => [row.userId, row]));
  const deviceUserById = new Map(deviceRows.map((row) => [row.deviceId, row.userId]));
  const webBySubscriber = new Map<string, (typeof webRows)>();
  for (const event of webRows) {
    const subscriberId = visitorById.get(event.visitorId)?.subscriberId;
    if (subscriberId) webBySubscriber.set(subscriberId, [...(webBySubscriber.get(subscriberId) ?? []), event]);
  }
  const appEventsBySubscriber = new Map<string, number>();
  for (const event of appEventRows) {
    const effectiveUserId = event.userId ?? deviceUserById.get(event.deviceId);
    const subscriberId = effectiveUserId ? appUserById.get(effectiveUserId)?.subscriberId : null;
    if (subscriberId && event.occurredAt.getTime() >= WINDOW_START && event.occurredAt.getTime() <= WINDOW_END) {
      appEventsBySubscriber.set(subscriberId, (appEventsBySubscriber.get(subscriberId) ?? 0) + 1);
    }
  }
  const appSubscribers = new Set(appUserRows.map((row) => row.subscriberId).filter((id): id is string => id !== null));
  return subscriberRows.map((subscriber) => {
    const coldStartDate = addDays(subscriber.lastOpenDate ?? subscriber.signupDate, 31);
    const cold = subscriber.status === "active" && coldStartDate <= TODAY;
    const coldBucket: ColdBucket = cold ? (subscriber.lastOpenDate ? "lapsed" : "never_opened") : subscriber.lastOpenDate ? "warm" : "new_unopened";
    const web = webBySubscriber.get(subscriber.id) ?? [];
    const webVisitCount30 = web.filter((event) => event.occurredAt.getTime() >= WINDOW_START && event.occurredAt.getTime() <= WINDOW_END).length;
    const appEvents30 = appEventsBySubscriber.get(subscriber.id) ?? 0;
    const hasApp = appSubscribers.has(subscriber.id);
    const engagementScore = subscriber.status === "active"
      ? Math.min(100, openRecencyPoints(subscriber.lastOpenDate) + Math.min(30, webVisitCount30 * 3) + (hasApp ? 10 : 0) + Math.min(10, appEvents30))
      : 0;
    return { ...subscriber, coldStartDate, cold, coldBucket, webVisitCount30, hasApp, appEvents30, engagementScore, web };
  });
}

export function isInLast30Days(timestamp: Date): boolean {
  const value = timestamp.getTime();
  return value >= WINDOW_START && value <= WINDOW_END;
}
