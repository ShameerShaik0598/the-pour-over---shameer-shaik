import { createHmac } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/lib/db/schema";
import type { AppDatabase } from "@/lib/db";
import { appEvents, appUsers, deviceLinks, quarantine, visitors, webhookDeliveries } from "@/lib/db/schema";
import { seedData } from "@/lib/ingest/seed";
import { getProfile, opaqueAppProfileId, recentEvents, searchProfiles } from "@/lib/profile";
import { eraseProfile } from "@/lib/erase-profile";
import { processAppWebhook } from "@/lib/webhook";

let client: PGlite;
let database: AppDatabase;
let secretBefore: string | undefined;
let sessionSecretBefore: string | undefined;

describe("profile lookup and live activity", () => {
  beforeAll(async () => {
    secretBefore = process.env.WEBHOOK_SECRET;
    sessionSecretBefore = process.env.SESSION_SECRET;
    process.env.WEBHOOK_SECRET = "profile-test-webhook-secret";
    process.env.SESSION_SECRET = "profile-test-session-secret-at-least-32-characters";
    client = new PGlite(); await client.waitReady;
    database = drizzle(client, { schema });
    await migrate(database, { migrationsFolder: "./drizzle" });
    await seedData(database);
  }, 300_000);

  afterAll(async () => {
    if (secretBefore === undefined) delete process.env.WEBHOOK_SECRET; else process.env.WEBHOOK_SECRET = secretBefore;
    if (sessionSecretBefore === undefined) delete process.env.SESSION_SECRET; else process.env.SESSION_SECRET = sessionSecretBefore;
    await client.close();
  });

  it("searches subscriber email, visitor ID, app user ID, and device ID", async () => {
    const allVisitors = await database.select().from(visitors);
    const joined = await database.select().from(appUsers);
    const linkedUser = joined.find((row) => row.subscriberId !== null)!;
    await database.insert(appUsers).values({ userId: "u_lookup_app_only", email: null, subscriberId: null, createdAt: new Date("2026-09-01T00:00:00Z"), origin: "webhook" });
    await database.insert(deviceLinks).values({ deviceId: "d_lookup_app_only", userId: "u_lookup_app_only", firstSeenAt: new Date("2026-09-01T00:00:00Z") });
    const visitorHit = await searchProfiles(database, allVisitors.find((row) => row.subscriberId)?.visitorId ?? "v_missing");
    const anonymousVisitor = allVisitors.find((row) => row.subscriberId === null);
    const visitorOnlyHit = anonymousVisitor ? await searchProfiles(database, anonymousVisitor.visitorId) : [];
    const userHit = await searchProfiles(database, linkedUser.userId);
    const deviceHit = await searchProfiles(database, "d_lookup_app_only");
    const emailHit = await searchProfiles(database, linkedUser.email ?? "reader@example.com");
    expect(visitorHit[0]?.type).toBe("subscriber");
    expect(visitorOnlyHit[0]?.type).toBe("visitor");
    expect(userHit[0]?.type).toBe("subscriber");
    expect(deviceHit[0]?.type).toBe("app");
    expect(emailHit[0]?.type).toBe("subscriber");
    expect(deviceHit[0]?.id).toMatch(/^[a-f0-9]{64}$/);
  });

  it("returns one profile with newsletter, site, app, timeline, and pre-signup journey", async () => {
    const visitedSubscriberIds = new Set((await database.select().from(visitors)).map((row) => row.subscriberId).filter((id): id is string => id !== null));
    const user = (await database.select().from(appUsers)).find((row) => row.subscriberId !== null && visitedSubscriberIds.has(row.subscriberId))!;
    await database.insert(appEvents).values({ eventId: "evt_profile_linked_test", event: "read_story", userId: user.userId,
      deviceId: "d_profile_linked_test", occurredAt: new Date("2026-09-20T12:00:00Z"), properties: { story: "test" } });
    const profile = await getProfile(database, "subscriber", user.subscriberId!);
    expect(profile?.type).toBe("subscriber");
    if (!profile || profile.type !== "subscriber") throw new Error("expected a subscriber profile");
    expect(profile.webCount).toBeGreaterThan(0);
    expect(profile.appAccounts).toBeGreaterThan(0);
    expect(profile.timeline.some((entry) => entry.kind === "web")).toBe(true);
    expect(profile.timeline.some((entry) => entry.kind === "app")).toBe(true);
    expect(profile).toHaveProperty("preSignupJourney");
  });

  it("creates a webhook profile and exposes its new event through search, profile, and recent feed", async () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const event = { event_id: "evt_profile_live", event: "app_open", user_id: "u_live_lookup", device_id: "d_live_lookup",
      timestamp: "2026-09-28T10:00:00Z", properties: { source: "test" } };
    const body = JSON.stringify(event);
    const signature = createHmac("sha256", process.env.WEBHOOK_SECRET!).update(timestamp).update(".").update(body).digest("hex");
    const response = await processAppWebhook(new Request("http://localhost/webhooks/app", { method: "POST", headers: {
      "x-tpo-timestamp": timestamp, "x-tpo-signature": `sha256=${signature}`, "x-forwarded-for": "192.0.2.111", "content-type": "application/json",
    }, body }), database);
    expect(response.status).toBe(202);
    expect((await searchProfiles(database, "u_live_lookup"))[0]?.type).toBe("app");
    const hit = (await searchProfiles(database, "u_live_lookup"))[0]!;
    const profile = await getProfile(database, "app", hit.id);
    expect(profile?.timeline.some((entry) => entry.label === "app open")).toBe(true);
    const feed = await recentEvents(database, null);
    expect(feed.events.some((entry) => entry.event === "app_open" && entry.profile?.id === hit.id)).toBe(true);
    expect((await database.select().from(appEvents)).some((entry) => entry.eventId === "evt_profile_live")).toBe(true);
  });

  it("erases an app-only profile and linked activity, devices, and quarantine email", async () => {
    await database.insert(appUsers).values({ userId: "u_erase_fixture", email: "erase.fixture@example.com", subscriberId: null,
      createdAt: new Date("2026-09-01T00:00:00Z"), origin: "webhook" });
    await database.insert(deviceLinks).values({ deviceId: "d_erase_fixture", userId: "u_erase_fixture", firstSeenAt: new Date("2026-09-01T00:00:00Z") });
    await database.insert(appEvents).values({ eventId: "evt_erase_fixture", event: "app_open", userId: null, deviceId: "d_erase_fixture",
      occurredAt: new Date("2026-09-02T00:00:00Z"), properties: {} });
    await database.insert(webhookDeliveries).values({ eventId: "evt_erase_fixture", outcome: "accepted" });
    await database.insert(quarantine).values({ sourceFile: "test.csv", rowNumber: 9001, raw: { email: "erase.fixture@example.com" }, reason: "test" });
    const opaqueId = opaqueAppProfileId("u_erase_fixture");
    expect(await eraseProfile(database, "app", opaqueId)).toBe(true);
    expect((await database.select().from(appUsers)).some((row) => row.userId === "u_erase_fixture")).toBe(false);
    expect((await database.select().from(deviceLinks)).some((row) => row.deviceId === "d_erase_fixture")).toBe(false);
    expect((await database.select().from(appEvents)).some((row) => row.eventId === "evt_erase_fixture")).toBe(false);
    expect((await database.select().from(webhookDeliveries)).some((row) => row.eventId === "evt_erase_fixture")).toBe(false);
    expect((await database.select().from(quarantine)).some((row) => JSON.stringify(row.raw).includes("erase.fixture@example.com"))).toBe(false);
  });
});
