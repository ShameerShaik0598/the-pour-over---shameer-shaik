import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/lib/db/schema";
import type { AppDatabase } from "@/lib/db";
import { appUsers, deviceLinks, subscribers, visitors } from "@/lib/db/schema";
import { seedData } from "@/lib/ingest/seed";
import type { LlmClient } from "@/lib/ai/client";
import type { ModelRequest } from "@/lib/ai/request";
import { buildModelRequest } from "@/lib/ai/request";
import { redactAssistantMessage } from "@/lib/ai/redact";
import { rulesPlan } from "@/lib/ai/planner";
import { clearSuggestedPlanCache, runAssistant } from "@/lib/ai/service";

class RecordingClient implements LlmClient {
  requests: ModelRequest[] = [];
  async generate(request: ModelRequest): Promise<string> {
    this.requests.push(request);
    const message = request.contents[0]?.parts[0]?.text ?? "";
    return JSON.stringify(rulesPlan(message));
  }
}

let clientDb: PGlite;
let database: AppDatabase;

describe("PII-safe assistant", () => {
  beforeAll(async () => {
    clientDb = new PGlite(); await clientDb.waitReady;
    database = drizzle(clientDb, { schema });
    await migrate(database, { migrationsFolder: "./drizzle" });
    await seedData(database);
    const user = (await database.select().from(appUsers))[0]!;
    await database.insert(deviceLinks).values({ deviceId: "d_seed_sensitive_42", userId: user.userId, firstSeenAt: new Date("2026-09-01T00:00:00Z") });
  }, 300_000);
  afterAll(async () => { await clientDb.close(); });

  it("redacts emails, phones, identifiers, and UUIDs before request construction", async () => {
    const message = "look up Ana@example.com, call +1 (212) 555-0199, check u_483 d_pixel7 v_abc evt_xyz 123e4567-e89b-42d3-a456-426614174000";
    const redacted = redactAssistantMessage(message);
    expect(redacted).not.toContain("Ana@example.com");
    expect(redacted).not.toContain("212");
    expect(redacted).not.toContain("u_483");
    expect(redacted).not.toContain("d_pixel7");
    expect(redacted).not.toContain("v_abc");
    expect(redacted).not.toContain("evt_xyz");
    expect(redacted).not.toContain("123e4567-e89b-42d3-a456-426614174000");
    const recorder = new RecordingClient();
    await runAssistant({ message, sessionKey: "typed-pii", client: recorder, database });
    expect(recorder.requests[0]?.contents[0]?.parts[0]?.text).toBe(redacted);
  });

  it("keeps every seeded email and identity value out of all model requests", async () => {
    clearSuggestedPlanCache();
    const recorder = new RecordingClient();
    for (const prompt of ["How many Instagram signups went cold last month?", "Build me a list of our most engaged readers", "Which pages do new subscribers hit first?"]) {
      await runAssistant({ message: prompt, sessionKey: "test-session", client: recorder, database });
    }
    const outbound = JSON.stringify(recorder.requests);
    const seededEmails = (await database.select({ email: subscribers.email }).from(subscribers)).map((row) => row.email);
    const seededUsers = (await database.select({ id: appUsers.userId }).from(appUsers)).map((row) => row.id);
    const seededVisitors = (await database.select({ id: visitors.visitorId }).from(visitors)).map((row) => row.id);
    const seededDevices = (await database.select({ id: deviceLinks.deviceId }).from(deviceLinks)).map((row) => row.id);
    for (const value of [...seededEmails, ...seededUsers, ...seededVisitors, ...seededDevices]) expect(outbound).not.toContain(value);
    expect(recorder.requests).toHaveLength(3);
  }, 300_000);

  it("answers the three golden questions through the mocked provider path", async () => {
    clearSuggestedPlanCache();
    const recorder = new RecordingClient();
    const cold = await runAssistant({ message: "How many Instagram signups went cold last month?", sessionKey: "provider", client: recorder, database });
    expect(cold.count).toBe(44);
    expect(cold.breakdown).toEqual([{ label: "lapsed", value: 16 }, { label: "never_opened", value: 28 }]);
    const engaged = await runAssistant({ message: "Build me a list of our most engaged readers", sessionKey: "provider", client: recorder, database });
    expect(engaged.count).toBe(139);
    expect(engaged.segment?.rows).toHaveLength(100);
    const firstPages = await runAssistant({ message: "Which pages do new subscribers hit first?", sessionKey: "provider", client: recorder, database });
    expect(firstPages.table?.slice(0, 5).sort((left, right) => left.label.localeCompare(right.label))).toEqual([
      { label: "/", value: 87 }, { label: "/about", value: 38 }, { label: "/news/church-attendance-study", value: 32 },
      { label: "/shadrachs-picks", value: 38 }, { label: "/subscribe", value: 83 },
    ]);
    expect(recorder.requests).toHaveLength(3);
  }, 300_000);

  it("answers all three golden questions through the rules fallback", async () => {
    clearSuggestedPlanCache();
    const cold = await runAssistant({ message: "How many Instagram signups went cold last month?", sessionKey: "rules", database });
    const engaged = await runAssistant({ message: "Build me a list of our most engaged readers", sessionKey: "rules", database });
    const firstPages = await runAssistant({ message: "Which pages do new subscribers hit first?", sessionKey: "rules", database });
    expect(cold.count).toBe(44);
    expect(cold.breakdown?.map((row) => row.value)).toEqual([16, 28]);
    expect(engaged.count).toBe(139);
    expect(engaged.segment?.rows).toHaveLength(100);
    expect(firstPages.table?.slice(0, 5).map((row) => row.value)).toEqual([87, 83, 38, 38, 32]);
  }, 300_000);

  it("rejects model output containing an email and audits only the redacted question", async () => {
    clearSuggestedPlanCache();
    const unsafeClient: LlmClient = { async generate() { return JSON.stringify({ intent: "clarify", clarifying_question: "Email ana@example.com" }); } };
    await expect(runAssistant({ message: "Can you help with ana@example.com?", sessionKey: "unsafe", client: unsafeClient, database })).rejects.toThrow("safely");
    const audits = await database.select().from(schema.assistantAudit);
    expect(audits.at(-1)?.sentPrompt).toBe("Can you help with [redacted]?");
    expect(audits.at(-1)?.plan).toBeNull();
  });

  it("uses the cached plan for an exact suggested prompt while rerunning the query", async () => {
    clearSuggestedPlanCache();
    const recorder = new RecordingClient();
    await runAssistant({ message: "How many Instagram signups went cold last month?", sessionKey: "cache", client: recorder, database });
    const cached = await runAssistant({ message: "How many Instagram signups went cold last month?", sessionKey: "cache", client: recorder, database });
    expect(recorder.requests).toHaveLength(1);
    expect(cached.provider).toBe("suggested_cache");
    expect(cached.count).toBe(44);
  }, 300_000);

  it("snapshots the single static model payload", () => {
    expect(buildModelRequest("Show new readers from [redacted].")).toMatchSnapshot();
  });
});
