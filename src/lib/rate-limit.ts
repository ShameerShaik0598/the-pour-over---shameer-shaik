import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { rateLimits } from "@/lib/db/schema";

export async function allowLoginAttempt(key: string, maximum = 10): Promise<boolean> {
  const bucket = sql`to_timestamp(floor(extract(epoch from now()) / 600) * 600)`;
  const [entry] = await db.insert(rateLimits).values({ key, windowStart: bucket, count: 1 })
    .onConflictDoUpdate({ target: [rateLimits.key, rateLimits.windowStart], set: { count: sql`${rateLimits.count} + 1` } })
    .returning({ count: rateLimits.count });
  return (entry?.count ?? maximum + 1) <= maximum;
}
