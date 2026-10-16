import { mkdir } from "node:fs/promises";
import path from "node:path";
import { drizzle as drizzlePglite, type PgliteDatabase } from "drizzle-orm/pglite";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { PGlite } from "@electric-sql/pglite";
import * as schema from "@/lib/db/schema";

type Database = PgliteDatabase<typeof schema>;

async function createDatabase(): Promise<Database> {
  if (process.env.DATABASE_URL) {
    // Both drivers expose the same PostgreSQL query builder; the PGlite type
    // keeps those builders stable across the local and Neon runtime branches.
    return drizzleNeon(neon(process.env.DATABASE_URL), { schema }) as unknown as Database;
  }
  const dataDir = path.join(process.cwd(), ".data");
  await mkdir(dataDir, { recursive: true });
  const client = new PGlite(path.join(dataDir, "pglite"));
  await client.waitReady;
  return drizzlePglite(client, { schema });
}

export const db = await createDatabase();
