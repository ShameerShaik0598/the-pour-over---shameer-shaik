import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, type AppDatabase } from "@/lib/db";
import { appEvents, appUsers, deviceLinks, identityConflicts, webhookDeliveries } from "@/lib/db/schema";
import { linkDevice } from "@/lib/ingest/resolvers";
import { allowRateLimit } from "@/lib/rate-limit";
import { logSecurityEvent } from "@/lib/log";

const MAX_BYTES = 16 * 1024;
const eventSchema = z.object({
  event_id: z.string().min(1), event: z.enum(["app_open", "read_story", "link_click", "login"]),
  user_id: z.string().min(1).nullable(), device_id: z.string().min(1),
  timestamp: z.string().datetime({ offset: false }), properties: z.record(z.string(), z.unknown()),
}).strict();
type CleanValue = null | boolean | number | string | CleanValue[] | { [key: string]: CleanValue };

const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE = /(?<!\w)(?:\+?\d[\d().\s-]{7,}\d)(?!\w)/g;

function cleanProperties(value: unknown, depth = 0): CleanValue | null {
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    if (value.length > 200) throw new Error("invalid");
    return value.replace(EMAIL, "[redacted]").replace(PHONE, "[redacted]");
  }
  if (Array.isArray(value)) {
    if (depth > 2) throw new Error("invalid");
    return value.map((item) => cleanProperties(item, depth + 1));
  }
  if (typeof value === "object") {
    if (depth > 2) throw new Error("invalid");
    const result: Record<string, CleanValue> = {};
    for (const [key, item] of Object.entries(value)) {
      if (key.length > 200) throw new Error("invalid");
      const safeKey = key.replace(EMAIL, "[redacted]").replace(PHONE, "[redacted]");
      result[safeKey] = cleanProperties(item, depth + 1);
    }
    return result;
  }
  throw new Error("invalid");
}

function stable(value: CleanValue): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key]!)}`).join(",")}}`;
  return JSON.stringify(value);
}

async function delivery(database: AppDatabase, outcome: "accepted" | "duplicate" | "invalid" | "bad_signature" | "stale" | "too_large" | "rate_limited", eventId: string | null = null) {
  await database.insert(webhookDeliveries).values({ outcome, eventId });
}

function signatureValid(secret: string | undefined, timestamp: string, body: Buffer, supplied: string): boolean {
  if (!secret) return false;
  const match = /^sha256=([a-f0-9]{64})$/i.exec(supplied);
  if (!match) return false;
  const expected = createHmac("sha256", secret).update(timestamp).update(".").update(body).digest();
  const actual = Buffer.from(match[1]!, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function response(status: number, body: Record<string, string>) {
  return Response.json(body, { status });
}

export async function processAppWebhook(request: Request, database: AppDatabase = db): Promise<Response> {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_BYTES) {
    await delivery(database, "too_large"); return response(413, { error: "payload too large" });
  }
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? "unknown";
  const key = createHash("sha256").update(ip).digest("hex");
  if (!(await allowRateLimit(database, `webhook:${key}`, 60, 300))) {
    await delivery(database, "rate_limited"); return response(429, { error: "rate limited" });
  }
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > MAX_BYTES) {
        await reader.cancel(); await delivery(database, "too_large");
        return response(413, { error: "payload too large" });
      }
      chunks.push(value);
    }
  }
  const raw = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
  if (raw.length > MAX_BYTES) { await delivery(database, "too_large"); return response(413, { error: "payload too large" }); }
  const timestamp = request.headers.get("x-tpo-timestamp") ?? "";
  const supplied = request.headers.get("x-tpo-signature") ?? "";
  const secrets = [process.env.WEBHOOK_SECRET, process.env.WEBHOOK_SECRET_PREVIOUS].filter((secret): secret is string => Boolean(secret));
  const valid = /^\d{1,12}$/.test(timestamp) && secrets.some((secret) => signatureValid(secret, timestamp, raw, supplied));
  if (!valid) {
    await delivery(database, "bad_signature"); logSecurityEvent("webhook rejected", "bad_signature");
    return response(401, { error: "unauthorized" });
  }
  if (Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp)) > 300) {
    await delivery(database, "stale"); logSecurityEvent("webhook rejected", "stale");
    return response(401, { error: "unauthorized" });
  }
  let decoded: unknown;
  try { decoded = JSON.parse(raw.toString("utf8")); } catch {
    await delivery(database, "invalid"); return response(400, { error: "invalid payload" });
  }
  const parsed = eventSchema.safeParse(decoded);
  if (!parsed.success) { await delivery(database, "invalid"); return response(400, { error: "invalid payload" }); }
  if (parsed.data.event === "login" && parsed.data.user_id === null) {
    await delivery(database, "invalid", parsed.data.event_id); return response(422, { error: "login requires user_id" });
  }
  let properties: CleanValue;
  try {
    if (Buffer.byteLength(JSON.stringify(parsed.data.properties), "utf8") > 2048) throw new Error("invalid");
    properties = cleanProperties(parsed.data.properties) as CleanValue;
    if (Buffer.byteLength(JSON.stringify(properties), "utf8") > 2048) throw new Error("invalid");
  } catch {
    await delivery(database, "invalid", parsed.data.event_id); return response(400, { error: "invalid payload" });
  }
  const event = { eventId: parsed.data.event_id, event: parsed.data.event, userId: parsed.data.user_id,
    deviceId: parsed.data.device_id, occurredAt: new Date(parsed.data.timestamp), properties };
  const [inserted] = await database.insert(appEvents).values(event).onConflictDoNothing({ target: appEvents.eventId }).returning({ eventId: appEvents.eventId });
  if (!inserted) {
    const [existing] = await database.select().from(appEvents).where(eq(appEvents.eventId, event.eventId)).limit(1);
    if (existing && (existing.event !== event.event || existing.userId !== event.userId || existing.deviceId !== event.deviceId || existing.occurredAt.getTime() !== event.occurredAt.getTime() || stable(existing.properties as CleanValue) !== stable(properties))) {
      const digest = createHash("sha256").update(raw).digest("hex");
      await database.insert(identityConflicts).values({ kind: "event_id_payload_mismatch", refA: event.eventId, refB: digest }).onConflictDoNothing();
    }
    await delivery(database, "duplicate", event.eventId); return response(200, { status: "duplicate" });
  }
  if (event.userId !== null) {
    await database.insert(appUsers).values({ userId: event.userId, email: null, subscriberId: null, createdAt: event.occurredAt, origin: "webhook" }).onConflictDoNothing();
    await linkDevice(database, event.deviceId, event.userId, event.occurredAt);
  }
  await delivery(database, "accepted", event.eventId);
  logSecurityEvent("webhook accepted", "accepted");
  return response(202, { status: "accepted" });
}

export async function getAppActivity(profile: { userId?: string; deviceId?: string }, database: AppDatabase = db) {
  const effectiveUserId = sql<string | null>`coalesce(${appEvents.userId}, ${deviceLinks.userId})`;
  const conditions = [];
  if (profile.userId) conditions.push(sql`${effectiveUserId} = ${profile.userId}`);
  if (profile.deviceId) conditions.push(eq(appEvents.deviceId, profile.deviceId));
  if (!conditions.length) return [];
  return database.select({ eventId: appEvents.eventId, event: appEvents.event, userId: appEvents.userId,
    effectiveUserId, deviceId: appEvents.deviceId, occurredAt: appEvents.occurredAt, receivedAt: appEvents.receivedAt,
    properties: appEvents.properties }).from(appEvents).leftJoin(deviceLinks, eq(appEvents.deviceId, deviceLinks.deviceId))
    .where(and(...conditions)).orderBy(appEvents.occurredAt);
}
