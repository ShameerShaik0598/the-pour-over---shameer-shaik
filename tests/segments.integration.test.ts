import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/lib/db/schema";
import type { AppDatabase } from "@/lib/db";
import { seedData } from "@/lib/ingest/seed";
import { FilterSchema } from "@/lib/segments/schema";
import { getSegmentRows } from "@/lib/segments/filter";
import { csvCell } from "@/lib/segments/csv";

let client: PGlite;
let database: AppDatabase;

describe("segment compiler", () => {
  beforeAll(async () => {
    client = new PGlite(); await client.waitReady;
    database = drizzle(client, { schema });
    await migrate(database, { migrationsFolder: "./drizzle" });
    await seedData(database);
  }, 300_000);
  afterAll(async () => { await client.close(); });

  it("matches every M4 golden segment count", async () => {
    const instagramCold = await getSegmentRows(database, { sources: ["Instagram"], status: "active", cold: "any_cold" });
    const augustCold = await getSegmentRows(database, { sources: ["Instagram"], status: "active", went_cold_between: ["2026-08-01", "2026-08-31"] });
    const highlyEngaged = await getSegmentRows(database, { status: "active", min_engagement: 70 });
    const both = await getSegmentRows(database, { status: "any", has_app: true, has_web_activity: true });
    expect(instagramCold).toHaveLength(141);
    expect(augustCold).toHaveLength(44);
    expect(highlyEngaged).toHaveLength(139);
    expect(both).toHaveLength(431);
  }, 300_000);

  it("rejects unknown fields and invalid date ranges", () => {
    expect(FilterSchema.safeParse({ source: "Instagram" }).success).toBe(false);
    expect(FilterSchema.safeParse({ status: "active", mystery: true }).success).toBe(false);
    expect(FilterSchema.safeParse({ signup_between: ["2026-09-31", "2026-10-01"] }).success).toBe(false);
    expect(FilterSchema.safeParse({ signup_between: ["2026-09-20", "2026-09-10"] }).success).toBe(false);
  });

  it("neutralizes formula cells and quotes CSV syntax", () => {
    expect(csvCell("=SUM(A1:A2)")).toBe('"\'=SUM(A1:A2)"');
    expect(csvCell("+cmd")).toBe('"\'+cmd"');
    expect(csvCell("-1+2")).toBe('"\'-1+2"');
    expect(csvCell("@SUM(A1)")).toBe('"\'@SUM(A1)"');
    expect(csvCell("\tformula")).toBe('"\'\tformula"');
    expect(csvCell("\rformula")).toBe('"\'\rformula"');
    expect(csvCell('Reader "one"')).toBe('"Reader ""one"""');
  });
});
