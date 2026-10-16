import { eq, inArray, or } from "drizzle-orm";
import type { AppDatabase } from "@/lib/db";
import { appEvents, appUsers, deviceLinks, identityConflicts, quarantine, subscribers, visitors, webEvents, webhookDeliveries } from "@/lib/db/schema";
import { normalizeEmail } from "@/lib/email";
import { opaqueAppProfileId, opaqueVisitorProfileId } from "@/lib/profile";

export type ErasableProfileType = "subscriber" | "app" | "visitor";

function containsEmail(value: unknown, emails: Set<string>): boolean {
  if (typeof value === "string") return emails.has(normalizeEmail(value) ?? "");
  if (Array.isArray(value)) return value.some((entry) => containsEmail(entry, emails));
  if (value && typeof value === "object") return Object.values(value).some((entry) => containsEmail(entry, emails));
  return false;
}

/** Remove a profile and its linked activity. Child rows are deleted before their parent rows. */
export async function eraseProfile(database: AppDatabase, type: ErasableProfileType, id: string): Promise<boolean> {
  let subscriberId: string | null = null;
  let userIds: string[] = [];
  let visitorIds: string[] = [];
  let directEmails: string[] = [];

  if (type === "subscriber") {
    const [subscriber] = await database.select().from(subscribers).where(eq(subscribers.id, id)).limit(1);
    if (!subscriber) return false;
    subscriberId = subscriber.id;
    directEmails = [subscriber.email];
    visitorIds = (await database.select({ id: visitors.visitorId }).from(visitors).where(eq(visitors.subscriberId, subscriberId))).map((row) => row.id);
    userIds = (await database.select({ id: appUsers.userId }).from(appUsers).where(eq(appUsers.subscriberId, subscriberId))).map((row) => row.id);
    directEmails.push(...(await database.select({ email: appUsers.email }).from(appUsers).where(eq(appUsers.subscriberId, subscriberId))).flatMap((row) => row.email ? [row.email] : []));
    directEmails.push(...(await database.select({ email: visitors.email }).from(visitors).where(eq(visitors.subscriberId, subscriberId))).flatMap((row) => row.email ? [row.email] : []));
  } else if (type === "app") {
    const users = await database.select().from(appUsers);
    const user = users.find((row) => opaqueAppProfileId(row.userId) === id);
    if (!user) return false;
    userIds = [user.userId];
    if (user.email) directEmails.push(user.email);
    subscriberId = user.subscriberId;
    if (subscriberId) return false;
  } else {
    const visitorsFound = await database.select().from(visitors);
    const visitor = visitorsFound.find((row) => opaqueVisitorProfileId(row.visitorId) === id);
    if (!visitor) return false;
    visitorIds = [visitor.visitorId];
    if (visitor.email) directEmails.push(visitor.email);
    subscriberId = visitor.subscriberId;
    if (subscriberId) return false;
  }

  const deviceIds = userIds.length ? (await database.select({ id: deviceLinks.deviceId }).from(deviceLinks).where(inArray(deviceLinks.userId, userIds))).map((row) => row.id) : [];
  const eventConditions = [
    ...(userIds.length ? [inArray(appEvents.userId, userIds)] : []),
    ...(deviceIds.length ? [inArray(appEvents.deviceId, deviceIds)] : []),
  ];
  const events = eventConditions.length ? await database.select({ id: appEvents.eventId }).from(appEvents).where(or(...eventConditions)) : [];
  const eventIds = events.map((row) => row.id);

  if (visitorIds.length) await database.delete(webEvents).where(inArray(webEvents.visitorId, visitorIds));
  if (eventIds.length) {
    await database.delete(webhookDeliveries).where(inArray(webhookDeliveries.eventId, eventIds));
    await database.delete(appEvents).where(inArray(appEvents.eventId, eventIds));
  }
  if (deviceIds.length) await database.delete(deviceLinks).where(inArray(deviceLinks.deviceId, deviceIds));
  if (userIds.length) await database.delete(appUsers).where(inArray(appUsers.userId, userIds));
  if (visitorIds.length) await database.delete(visitors).where(inArray(visitors.visitorId, visitorIds));
  if (subscriberId) await database.delete(subscribers).where(eq(subscribers.id, subscriberId));

  const conflictRows = await database.select().from(identityConflicts);
  const sensitiveRefs = new Set([...userIds, ...visitorIds, ...deviceIds, ...eventIds, ...directEmails]);
  const conflictIds = conflictRows.filter((row) => sensitiveRefs.has(row.refA) || row.refB.split("|").some((value) => sensitiveRefs.has(value))).map((row) => row.id);
  if (conflictIds.length) await database.delete(identityConflicts).where(inArray(identityConflicts.id, conflictIds));
  if (directEmails.length) {
    const quarantined = await database.select({ id: quarantine.id, raw: quarantine.raw }).from(quarantine);
    const emailSet = new Set(directEmails.map((email) => normalizeEmail(email)).filter((email): email is string => email !== null));
    const quarantineIds = quarantined.filter((row) => containsEmail(row.raw, emailSet)).map((row) => row.id);
    if (quarantineIds.length) await database.delete(quarantine).where(inArray(quarantine.id, quarantineIds));
  }
  return true;
}
