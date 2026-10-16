import { bigint, boolean, date, integer, jsonb, pgEnum, pgTable, serial, text, timestamp, uuid, primaryKey, index, uniqueIndex } from "drizzle-orm/pg-core";

export const subscriberStatus = pgEnum("subscriber_status", ["active", "unsubscribed"]);
export const appOrigin = pgEnum("app_origin", ["csv", "webhook"]);
export const appEventType = pgEnum("app_event_type", ["app_open", "read_story", "link_click", "login"]);
export const deliveryOutcome = pgEnum("delivery_outcome", ["accepted", "duplicate", "invalid", "bad_signature", "stale", "too_large", "rate_limited"]);

export const subscribers = pgTable("subscribers", {
  id: uuid("id").defaultRandom().primaryKey(), email: text("email").notNull().unique(), signupDate: date("signup_date").notNull(),
  status: subscriberStatus("status").notNull(), source: text("source").notNull(), lastOpenDate: date("last_open_date"),
  duplicateCount: integer("duplicate_count").notNull().default(1), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const visitors = pgTable("visitors", {
  visitorId: text("visitor_id").primaryKey(), email: text("email"), subscriberId: uuid("subscriber_id").references(() => subscribers.id),
  conflict: boolean("conflict").notNull().default(false), firstSeen: timestamp("first_seen", { withTimezone: true }).notNull(),
});
export const webEvents = pgTable("web_events", {
  id: bigint("id", { mode: "number" }).generatedAlwaysAsIdentity().primaryKey(), visitorId: text("visitor_id").notNull().references(() => visitors.visitorId),
  page: text("page").notNull(), occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(), utmSource: text("utm_source"), rowKey: text("row_key").notNull().unique(),
}, (t) => [index("web_events_visitor_time_idx").on(t.visitorId, t.occurredAt)]);
export const appUsers = pgTable("app_users", {
  userId: text("user_id").primaryKey(), email: text("email"), subscriberId: uuid("subscriber_id").references(() => subscribers.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(), origin: appOrigin("origin").notNull().default("csv"),
});
export const deviceLinks = pgTable("device_links", { deviceId: text("device_id").primaryKey(), userId: text("user_id").notNull(), firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull() });
export const appEvents = pgTable("app_events", {
  eventId: text("event_id").primaryKey(), event: appEventType("event").notNull(), userId: text("user_id"), deviceId: text("device_id").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(), receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(), properties: jsonb("properties").notNull().default({}),
}, (t) => [index("app_events_device_idx").on(t.deviceId), index("app_events_user_idx").on(t.userId), index("app_events_occurred_idx").on(t.occurredAt)]);
export const webhookDeliveries = pgTable("webhook_deliveries", { id: bigint("id", { mode: "number" }).generatedAlwaysAsIdentity().primaryKey(), eventId: text("event_id"), outcome: deliveryOutcome("outcome").notNull(), receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow() });
export const identityConflicts = pgTable("identity_conflicts", { id: serial("id").primaryKey(), kind: text("kind").notNull(), refA: text("ref_a").notNull(), refB: text("ref_b").notNull(), detectedAt: timestamp("detected_at", { withTimezone: true }).notNull().defaultNow() }, (t) => [uniqueIndex("identity_conflicts_kind_refs_unique_idx").on(t.kind, t.refA, t.refB)]);
export const quarantine = pgTable("quarantine", { id: serial("id").primaryKey(), sourceFile: text("source_file").notNull(), rowNumber: integer("row_number").notNull(), raw: jsonb("raw").notNull(), reason: text("reason").notNull(), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow() }, (t) => [uniqueIndex("quarantine_source_row_unique_idx").on(t.sourceFile, t.rowNumber)]);
export const segments = pgTable("segments", { id: uuid("id").defaultRandom().primaryKey(), name: text("name").notNull(), filter: jsonb("filter").notNull(), createdBy: text("created_by").notNull(), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow() });
export const assistantAudit = pgTable("assistant_audit", { id: serial("id").primaryKey(), sessionId: text("session_id").notNull(), sentPrompt: text("sent_prompt").notNull(), plan: jsonb("plan"), outcome: text("outcome").notNull(), provider: text("provider").notNull(), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow() });
export const rateLimits = pgTable("rate_limits", { key: text("key").notNull(), windowStart: timestamp("window_start", { withTimezone: true }).notNull(), count: integer("count").notNull().default(1) }, (t) => [primaryKey({ columns: [t.key, t.windowStart] })]);
