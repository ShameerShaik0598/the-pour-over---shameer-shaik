import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { migrate as migrateNeon } from "drizzle-orm/neon-http/migrator";
import { db } from "@/lib/db";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "@/lib/db/schema";

if (process.env.DATABASE_URL) {
  await migrateNeon(db as unknown as NeonHttpDatabase, { migrationsFolder: "./drizzle" });
} else {
  await migratePglite(db as unknown as PgliteDatabase<typeof schema>, { migrationsFolder: "./drizzle" });
}
process.stdout.write("Database schema is up to date.\n");
