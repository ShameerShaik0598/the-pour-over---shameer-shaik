import { createHmac } from "node:crypto";
import { desc, eq, ilike, inArray } from "drizzle-orm";
import type { AppDatabase } from "@/lib/db";
import { appEvents, appUsers, deviceLinks, subscribers, visitors, webEvents, webhookDeliveries } from "@/lib/db/schema";
import { normalizeEmail } from "@/lib/email";
import { getSubscriberFacts } from "@/lib/facts";
import { maskEmail } from "@/lib/privacy";
import { getAppActivity } from "@/lib/webhook";

export type ProfileHit = { type: "subscriber" | "app" | "visitor"; id: string; email: string | null; status: string | null; label: string };
export type ProfileTimelineEntry = { kind: "web" | "app"; occurredAt: string; label: string; detail: string };

export function opaqueAppProfileId(userId: string): string {
  return createHmac("sha256", profileTokenKey()).update(`app:${userId}`).digest("hex");
}

export function opaqueVisitorProfileId(visitorId: string): string {
  return createHmac("sha256", profileTokenKey()).update(`visitor:${visitorId}`).digest("hex");
}

function profileTokenKey(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("Profile link secret is unavailable.");
  return secret;
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

export async function searchProfiles(database: AppDatabase, query: string): Promise<ProfileHit[]> {
  const results: ProfileHit[] = [];
  if (query.startsWith("v_")) {
    const [visitor] = await database.select().from(visitors).where(eq(visitors.visitorId, query)).limit(1);
    if (visitor?.subscriberId) {
      const [subscriber] = await database.select().from(subscribers).where(eq(subscribers.id, visitor.subscriberId)).limit(1);
      if (subscriber) results.push({ type: "subscriber", id: subscriber.id, email: subscriber.email, status: subscriber.status, label: "Newsletter reader · visitor match" });
    } else if (visitor) results.push({ type: "visitor", id: opaqueVisitorProfileId(visitor.visitorId), email: visitor.email, status: null, label: "Unlinked site visitor" });
  } else if (query.startsWith("u_")) {
    const [user] = await database.select().from(appUsers).where(eq(appUsers.userId, query)).limit(1);
    if (user) {
      if (user.subscriberId) {
        const [subscriber] = await database.select().from(subscribers).where(eq(subscribers.id, user.subscriberId)).limit(1);
        if (subscriber) results.push({ type: "subscriber", id: subscriber.id, email: subscriber.email, status: subscriber.status, label: "Newsletter reader · app account" });
      } else results.push({ type: "app", id: opaqueAppProfileId(user.userId), email: user.email, status: null, label: "App-only reader" });
    }
  } else if (query.startsWith("d_")) {
    const [link] = await database.select().from(deviceLinks).where(eq(deviceLinks.deviceId, query)).limit(1);
    const [user] = link ? await database.select().from(appUsers).where(eq(appUsers.userId, link.userId)).limit(1) : [];
    if (user?.subscriberId) {
      const [subscriber] = await database.select().from(subscribers).where(eq(subscribers.id, user.subscriberId)).limit(1);
      if (subscriber) results.push({ type: "subscriber", id: subscriber.id, email: subscriber.email, status: subscriber.status, label: "Newsletter reader · device link" });
    } else if (user) results.push({ type: "app", id: opaqueAppProfileId(user.userId), email: user.email, status: null, label: "App-only reader · device link" });
  } else {
    const normalized = normalizeEmail(query);
    const pattern = `%${escapeLike(query)}%`;
    const matches = await database.select().from(subscribers).where(ilike(subscribers.email, pattern)).limit(20);
    const [exact] = normalized ? await database.select().from(subscribers).where(eq(subscribers.email, normalized)).limit(1) : [];
    const selected = exact ? [exact, ...matches.filter((row) => row.id !== exact.id)] : matches;
    results.push(...selected.map((row) => ({ type: "subscriber" as const, id: row.id, email: row.email, status: row.status, label: "Newsletter reader" })));
  }
  return results.slice(0, 20);
}

export async function getProfile(database: AppDatabase, type: "subscriber" | "app" | "visitor", id: string) {
  if (type === "visitor") {
    const rows = await database.select().from(visitors);
    const visitor = rows.find((row) => opaqueVisitorProfileId(row.visitorId) === id);
    if (!visitor) return null;
    const web = await database.select().from(webEvents).where(eq(webEvents.visitorId, visitor.visitorId)).orderBy(webEvents.occurredAt);
    return { type, visitor: { email: visitor.email, firstSeen: visitor.firstSeen.toISOString(), conflict: visitor.conflict },
      devices: [], webCount: web.length, appAccounts: 0, whyLinked: [visitor.email ? "site email captured without a subscriber match" : "anonymous visitor identifier"], preSignupJourney: [],
      timeline: web.map((event) => ({ kind: "web" as const, occurredAt: event.occurredAt.toISOString(), label: "Page viewed", detail: event.page })) };
  }
  if (type === "subscriber") {
    const facts = await getSubscriberFacts(database);
    const fact = facts.find((row) => row.id === id);
    if (!fact) return null;
    const linkedVisitors = await database.select().from(visitors).where(eq(visitors.subscriberId, id));
    const visitorIds = linkedVisitors.map((row) => row.visitorId);
    const web = visitorIds.length ? await database.select().from(webEvents).where(inArray(webEvents.visitorId, visitorIds)).orderBy(webEvents.occurredAt) : [];
    const appAccounts = await database.select().from(appUsers).where(eq(appUsers.subscriberId, id));
    const appActivities = await Promise.all(appAccounts.map((user) => getAppActivity({ userId: user.userId }, database)));
    const appRows = appActivities.flat();
    const timeline: ProfileTimelineEntry[] = [
      ...web.map((event) => ({ kind: "web" as const, occurredAt: event.occurredAt.toISOString(), label: "Page viewed", detail: event.page })),
      ...appRows.map((event) => ({ kind: "app" as const, occurredAt: event.occurredAt.toISOString(), label: event.event.replaceAll("_", " "), detail: "App activity" })),
    ].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
    const journey = web.filter((event) => event.occurredAt < new Date(`${fact.signupDate}T00:00:00.000Z`)).map((event) => event.page).slice(-8);
    const whyLinked = [
      ...(linkedVisitors.length ? [`stitched via ${linkedVisitors.length} site visitor${linkedVisitors.length === 1 ? "" : "s"}`] : []),
      ...(appAccounts.some((user) => user.email === fact.email) ? ["email match"] : []),
      ...(appAccounts.length ? ["app account linked"] : []),
    ];
    return { type, subscriber: { id: fact.id, email: fact.email, status: fact.status, source: fact.source, signupDate: fact.signupDate,
      lastOpenDate: fact.lastOpenDate, duplicateCount: fact.duplicateCount, cold: fact.cold, coldBucket: fact.coldBucket,
      coldStartDate: fact.coldStartDate, engagementScore: fact.engagementScore, webVisitCount30: fact.webVisitCount30,
      hasApp: fact.hasApp, appEvents30: fact.appEvents30 }, visitors: linkedVisitors.map((row) => row.visitorId),
      webCount: web.length, appAccounts: appAccounts.length, timeline, whyLinked, preSignupJourney: journey };
  }
  const users = await database.select().from(appUsers);
  const user = users.find((row) => opaqueAppProfileId(row.userId) === id);
  if (!user) return null;
  const activities = await getAppActivity({ userId: user.userId }, database);
  const linkedDevices = await database.select().from(deviceLinks).where(eq(deviceLinks.userId, user.userId));
  return { type, appUser: { userId: user.userId, email: user.email, createdAt: user.createdAt.toISOString(), origin: user.origin },
    devices: linkedDevices.map((row) => row.deviceId), webCount: 0, appAccounts: 1, whyLinked: ["app-only profile"], preSignupJourney: [],
    timeline: activities.map((event) => ({ kind: "app" as const, occurredAt: event.occurredAt.toISOString(), label: event.event.replaceAll("_", " "), detail: "App activity" })) };
}

export async function recentEvents(database: AppDatabase, since: Date | null) {
  const events = await database.select().from(appEvents).orderBy(desc(appEvents.receivedAt)).limit(50);
  const delivered = since ? events.filter((event) => event.receivedAt > since) : events;
  const userRows = await database.select().from(appUsers);
  const deviceRows = await database.select().from(deviceLinks);
  const subscriberRows = await database.select().from(subscribers);
  const subscriberById = new Map(subscriberRows.map((row) => [row.id, row]));
  const userById = new Map(userRows.map((row) => [row.userId, row]));
  const deviceById = new Map(deviceRows.map((row) => [row.deviceId, row.userId]));
  const counts = await database.select().from(webhookDeliveries);
  return { events: delivered.map((event) => {
    const userId = event.userId ?? deviceById.get(event.deviceId) ?? null;
    const user = userId ? userById.get(userId) : null;
    const subscriber = user?.subscriberId ? subscriberById.get(user.subscriberId) : null;
    return { event: event.event, occurredAt: event.occurredAt.toISOString(), receivedAt: event.receivedAt.toISOString(),
      profile: user ? { type: user.subscriberId ? "subscriber" : "app", id: user.subscriberId ?? opaqueAppProfileId(user.userId), label: maskEmail(subscriber?.email ?? user.email) } : null };
  }), counters: { accepted: counts.filter((row) => row.outcome === "accepted").length, duplicate: counts.filter((row) => row.outcome === "duplicate").length,
    rejected: counts.filter((row) => !["accepted", "duplicate"].includes(row.outcome)).length } };
}
