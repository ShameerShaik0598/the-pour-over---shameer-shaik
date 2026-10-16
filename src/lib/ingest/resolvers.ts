import { eq, sql } from "drizzle-orm";
import type { AppDatabase } from "@/lib/db";
import { appUsers, deviceLinks, identityConflicts, subscribers } from "@/lib/db/schema";
import { normalizeEmail } from "@/lib/email";

type AppUserInput = { userId: string; email: string | null; createdAt: Date; origin: "csv" | "webhook" };

async function upsertResolvedAppUser(database: AppDatabase, input: AppUserInput, subscriberId: string | null) {
  await database.insert(appUsers).values({ userId: input.userId, email: input.email, subscriberId, createdAt: input.createdAt, origin: input.origin })
    .onConflictDoUpdate({ target: appUsers.userId, set: { email: sql`excluded.email`, subscriberId: sql`excluded.subscriber_id`, createdAt: sql`excluded.created_at` } });
  const [user] = await database.select().from(appUsers).where(eq(appUsers.userId, input.userId)).limit(1);
  return user ?? null;
}

export async function resolveAppUser(database: AppDatabase, input: AppUserInput) {
  const email = normalizeEmail(input.email);
  const [subscriber] = email ? await database.select({ id: subscribers.id }).from(subscribers).where(eq(subscribers.email, email)).limit(1) : [];
  return upsertResolvedAppUser(database, { ...input, email }, subscriber?.id ?? null);
}

export async function resolveAppUsers(database: AppDatabase, inputs: AppUserInput[]) {
  const emails = [...new Set(inputs.map((input) => normalizeEmail(input.email)).filter((email): email is string => email !== null))];
  const matches = emails.length ? await database.select({ id: subscribers.id, email: subscribers.email }).from(subscribers) : [];
  const ids = new Map(matches.map((row) => [row.email, row.id]));
  const rows = inputs.map((input) => ({ ...input, email: normalizeEmail(input.email), subscriberId: ids.get(normalizeEmail(input.email) ?? "") ?? null }));
  for (let offset = 0; offset < rows.length; offset += 500) {
    await database.insert(appUsers).values(rows.slice(offset, offset + 500)).onConflictDoUpdate({ target: appUsers.userId, set: { email: sql`excluded.email`, subscriberId: sql`excluded.subscriber_id`, createdAt: sql`excluded.created_at` } });
  }
}

export async function linkDevice(database: AppDatabase, deviceId: string, userId: string, occurredAt: Date) {
  const [existing] = await database.select().from(deviceLinks).where(eq(deviceLinks.deviceId, deviceId)).limit(1);
  if (existing && existing.userId !== userId) {
    const [a, b] = [existing.userId, userId].sort();
    await database.insert(identityConflicts).values({ kind: "device_user_conflict", refA: deviceId, refB: `${a}|${b}` }).onConflictDoNothing();
  }
  await database.insert(deviceLinks).values({ deviceId, userId, firstSeenAt: occurredAt })
    .onConflictDoUpdate({ target: deviceLinks.deviceId, set: { userId: sql`excluded.user_id`, firstSeenAt: sql`excluded.first_seen_at` },
      setWhere: sql`excluded.first_seen_at < ${deviceLinks.firstSeenAt}` });
}
