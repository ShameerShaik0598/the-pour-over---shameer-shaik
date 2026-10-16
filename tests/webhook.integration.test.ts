import { createHmac } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/lib/db/schema";
import type { AppDatabase } from "@/lib/db";
import { appEvents, appUsers, deviceLinks, identityConflicts, webhookDeliveries } from "@/lib/db/schema";
import { getAppActivity, processAppWebhook } from "@/lib/webhook";

const primary = "webhook-test-primary-secret";
const previous = "webhook-test-previous-secret";
let client: PGlite;
let database: AppDatabase;
let serial = 0;
const priorSecrets = { current: process.env.WEBHOOK_SECRET, previous: process.env.WEBHOOK_SECRET_PREVIOUS };

function signedRequest(payload: Record<string, unknown>, secret = primary, timestamp = Math.floor(Date.now() / 1000), bodyOverride?: string) {
  const body = bodyOverride ?? JSON.stringify(payload);
  const stamp = String(timestamp);
  const signature = createHmac("sha256", secret).update(stamp).update(".").update(body).digest("hex");
  return new Request("http://localhost/webhooks/app", { method: "POST", headers: {
    "content-type": "application/json", "x-tpo-timestamp": stamp, "x-tpo-signature": `sha256=${signature}`,
    "x-forwarded-for": `192.0.2.${(++serial % 250) + 1}`,
  }, body });
}

function payload(overrides: Record<string, unknown> = {}) {
  return { event_id: `evt_test_${serial + 1}`, event: "read_story", user_id: null, device_id: `d_test_${serial + 1}`,
    timestamp: "2026-09-28T14:22:05Z", properties: { story: "daily-brief" }, ...overrides };
}

async function send(data: Record<string, unknown>, secret = primary, timestamp = Math.floor(Date.now() / 1000), bodyOverride?: string) {
  return processAppWebhook(signedRequest(data, secret, timestamp, bodyOverride), database);
}

describe("signed app webhook", () => {
  beforeAll(async () => {
    process.env.WEBHOOK_SECRET = primary;
    process.env.WEBHOOK_SECRET_PREVIOUS = previous;
    client = new PGlite(); await client.waitReady;
    database = drizzle(client, { schema });
    await migrate(database, { migrationsFolder: "./drizzle" });
  }, 120_000);

  afterAll(async () => {
    if (priorSecrets.current === undefined) delete process.env.WEBHOOK_SECRET; else process.env.WEBHOOK_SECRET = priorSecrets.current;
    if (priorSecrets.previous === undefined) delete process.env.WEBHOOK_SECRET_PREVIOUS; else process.env.WEBHOOK_SECRET_PREVIOUS = priorSecrets.previous;
    await client.close();
  });

  it("accepts, scrubs properties, resolves activity, and deduplicates concurrent retries", async () => {
    const data = payload({ event_id: "evt_same_signed_event", user_id: "u_webhook_one", device_id: "d_webhook_one",
      properties: { note: "Reach me at reader@example.com or +1 (212) 555-0199" } });
    const first = await send(data);
    expect(first.status).toBe(202);
    const saved = await database.select().from(appEvents);
    expect(saved[0]?.properties).toEqual({ note: "Reach me at [redacted] or [redacted]" });
    const concurrent = await Promise.all(Array.from({ length: 19 }, () => send(data)));
    expect(concurrent.every((result) => result.status === 200)).toBe(true);
    expect((await database.select().from(appEvents))).toHaveLength(1);
    expect((await database.select().from(webhookDeliveries)).filter((row) => row.outcome === "duplicate")).toHaveLength(19);
    expect((await database.select().from(appUsers))[0]).toMatchObject({ userId: "u_webhook_one", origin: "webhook", email: null });
    expect((await getAppActivity({ userId: "u_webhook_one" }, database))).toHaveLength(1);
  });

  it("records a different duplicate payload without replacing the original", async () => {
    const data = payload({ event_id: "evt_payload_mismatch", device_id: "d_mismatch" });
    expect((await send(data)).status).toBe(202);
    expect((await send({ ...data, properties: { story: "changed" } })).status).toBe(200);
    expect((await database.select().from(identityConflicts)).some((item) => item.kind === "event_id_payload_mismatch")).toBe(true);
    expect((await database.select().from(appEvents)).find((item) => item.eventId === "evt_payload_mismatch")?.properties).toEqual({ story: "daily-brief" });
  });

  it("supports out-of-order device login and read-time backfill for earlier anonymous activity", async () => {
    const device = "d_out_of_order";
    expect((await send(payload({ event_id: "evt_anon_early", device_id: device, timestamp: "2026-09-01T00:00:00Z" }))).status).toBe(202);
    expect((await send(payload({ event_id: "evt_login_late", event: "login", user_id: "u_out_of_order", device_id: device,
      timestamp: "2026-09-03T00:00:00Z" }))).status).toBe(202);
    expect((await send(payload({ event_id: "evt_user_event_arrives_last", user_id: "u_out_of_order", device_id: device,
      timestamp: "2026-09-02T00:00:00Z" }))).status).toBe(202);
    const activity = await getAppActivity({ userId: "u_out_of_order" }, database);
    expect(activity.map((item) => item.eventId)).toEqual(["evt_anon_early", "evt_user_event_arrives_last", "evt_login_late"]);
    expect(activity[0]?.effectiveUserId).toBe("u_out_of_order");
    expect((await database.select().from(deviceLinks)).find((item) => item.deviceId === device)?.firstSeenAt.toISOString()).toBe("2026-09-02T00:00:00.000Z");
  });

  it("rejects missing login identity, bad and stale signatures, and oversize requests", async () => {
    expect((await send(payload({ event: "login", user_id: null }))).status).toBe(422);
    const bad = signedRequest(payload({ event_id: "evt_bad_signature" }));
    const badHeaders = new Headers(bad.headers); badHeaders.set("x-tpo-signature", "sha256=" + "0".repeat(64));
    expect((await processAppWebhook(new Request(bad.url, { method: "POST", headers: badHeaders, body: await bad.text() }), database)).status).toBe(401);
    expect((await send(payload({ event_id: "evt_stale" }), primary, Math.floor(Date.now() / 1000) - 301)).status).toBe(401);
    const largeBody = "{" + " ".repeat(16 * 1024);
    expect((await send({}, primary, Math.floor(Date.now() / 1000), largeBody)).status).toBe(413);
  });

  it("accepts the previous rotation secret and rejects invalid JSON payloads", async () => {
    expect((await send(payload({ event_id: "evt_previous_secret" }), previous)).status).toBe(202);
    expect((await send(payload(), primary, Math.floor(Date.now() / 1000), "{} not-json")).status).toBe(400);
  });
});
