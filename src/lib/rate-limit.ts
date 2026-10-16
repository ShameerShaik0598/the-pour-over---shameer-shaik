import { sql } from "drizzle-orm";
import type { AppDatabase } from "@/lib/db";
import { rateLimits } from "@/lib/db/schema";

export async function allowRateLimit(database: AppDatabase, key: string, windowSeconds: number, maximum: number): Promise<boolean> {
  const bucket = sql`to_timestamp(floor(extract(epoch from now()) / ${windowSeconds}) * ${windowSeconds})`;
  const [entry] = await database.insert(rateLimits).values({ key, windowStart: bucket, count: 1 })
    .onConflictDoUpdate({ target: [rateLimits.key, rateLimits.windowStart], set: { count: sql`${rateLimits.count} + 1` } })
    .returning({ count: rateLimits.count });
  return (entry?.count ?? maximum + 1) <= maximum;
}

export function allowLoginAttempt(key: string, maximum = 10): Promise<boolean> {
  return import("@/lib/db").then(({ db }) => allowRateLimit(db, key, 600, maximum));
}
