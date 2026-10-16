import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { sql } from "drizzle-orm";
import type { AppDatabase } from "@/lib/db";
import { appUsers, identityConflicts, quarantine, subscribers, visitors, webEvents } from "@/lib/db/schema";
import { normalizeEmail } from "@/lib/email";
import { normalizeSource, type Source } from "@/lib/sources";
import { resolveAppUsers } from "@/lib/ingest/resolvers";
import { getSubscriberFacts } from "@/lib/facts";
import { last30DaysStartDate, previousMonthRange, TODAY } from "@/lib/clock";

type RawRow = Record<string, string>;
type CsvRow = { raw: RawRow; rowNumber: number };
type SubscriberRow = { email: string; signupDate: string; status: "active" | "unsubscribed"; source: Source; lastOpenDate: string | null; rowNumber: number };
type WebRow = { visitorId: string; page: string; occurredAt: Date; utmSource: string | null; email: string | null; rowNumber: number };
type AppUserRow = { userId: string; email: string; createdAt: Date };

function records(text: string, expectedHeader: string[]): CsvRow[] {
  const rows = parse(text, { bom: true, skip_empty_lines: false, relax_column_count: true, trim: false }) as string[][];
  const header = rows.shift()?.map((item) => item.trim()) ?? [];
  if (header.join("|") !== expectedHeader.join("|")) throw new Error(`Unexpected CSV headers: ${header.join(",")}`);
  return rows.map((fields, index) => ({ raw: Object.fromEntries(header.map((key, i) => [key, fields[i] ?? ""])), rowNumber: index + 2 }));
}

function isDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const dateValue = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(dateValue.getTime()) && dateValue.toISOString().slice(0, 10) === value;
}

function parseUtcTimestamp(value: string): Date | null {
  const normalized = value.trim().replace(" ", "T");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/.test(normalized)) return null;
  const dateValue = new Date(normalized.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(normalized) ? normalized : `${normalized}Z`);
  return Number.isNaN(dateValue.getTime()) ? null : dateValue;
}

function blankRow(raw: RawRow): boolean {
  return Object.values(raw).every((value) => !value.trim());
}

function parseSubscribers(rows: CsvRow[]) {
  const valid: SubscriberRow[] = [];
  const bad: Array<CsvRow & { reason: string }> = [];
  for (const row of rows) {
    const emailRaw = row.raw.email ?? "";
    const email = normalizeEmail(emailRaw);
    const reasons: string[] = [];
    if (blankRow(row.raw)) reasons.push("blank row");
    else if (!email) reasons.push(/\S/.test(emailRaw) ? "malformed email" : "missing email");
    const signupDate = row.raw.signup_date?.trim() ?? "";
    if (!isDate(signupDate)) reasons.push("missing or invalid signup date");
    const statusRaw = row.raw.status?.trim().toLowerCase() ?? "";
    if (statusRaw !== "active" && statusRaw !== "unsubscribed") reasons.push("missing or unrecognized status");
    const source = normalizeSource(row.raw.acquisition_source);
    if (!source) reasons.push("missing or unrecognized source");
    const lastOpenRaw = row.raw.last_open_date?.trim() ?? "";
    if (lastOpenRaw && !isDate(lastOpenRaw)) reasons.push("invalid last open date");
    if (reasons.length || !email || !source || (statusRaw !== "active" && statusRaw !== "unsubscribed")) {
      bad.push({ ...row, reason: [...new Set(reasons)].join("; ") });
      continue;
    }
    valid.push({ email, signupDate, status: statusRaw, source, lastOpenDate: lastOpenRaw || null, rowNumber: row.rowNumber });
  }
  const grouped = new Map<string, SubscriberRow[]>();
  for (const row of valid) grouped.set(row.email, [...(grouped.get(row.email) ?? []), row]);
  const merged = [...grouped.entries()].map(([email, members]) => {
    const earliest = members.reduce((best, row) => row.signupDate < best.signupDate ? row : best);
    const opens = members.map((row) => row.lastOpenDate).filter((value): value is string => value !== null).sort();
    return { email, signupDate: earliest.signupDate, status: members.some((row) => row.status === "unsubscribed") ? "unsubscribed" as const : "active" as const,
      source: earliest.source, lastOpenDate: opens.at(-1) ?? null, duplicateCount: members.length };
  });
  const conflictingGroups = [...grouped.values()].filter((members) => new Set(members.map((row) => `${row.signupDate}|${row.status}|${row.source}|${row.lastOpenDate ?? ""}`)).size > 1).length;
  return { validRows: valid, quarantined: bad, merged, conflictingGroups };
}

function parseWeb(rows: CsvRow[]) {
  const parsed: WebRow[] = [];
  const quarantined: Array<CsvRow & { reason: string }> = [];
  for (const row of rows) {
    const visitorId = row.raw.visitor_id?.trim() ?? "";
    const page = row.raw.page?.trim() ?? "";
    const occurredAt = parseUtcTimestamp(row.raw.timestamp ?? "");
    const reason = !visitorId ? "missing visitor id" : !page ? "missing page" : !occurredAt ? "invalid timestamp" : null;
    if (reason || !occurredAt) { quarantined.push({ ...row, reason: reason ?? "invalid timestamp" }); continue; }
    const emailRaw = row.raw.email ?? "";
    const emailPresent = /\S/.test(emailRaw);
    const email = emailPresent ? normalizeEmail(emailRaw) : null;
    if (emailPresent && !email) { quarantined.push({ ...row, reason: "malformed email" }); continue; }
    parsed.push({ visitorId, page, occurredAt, utmSource: normalizeSource(row.raw.utm_source), email, rowNumber: row.rowNumber });
  }
  return { parsed, quarantined };
}

function parseAppUsers(rows: CsvRow[]) {
  const valid: AppUserRow[] = [];
  const quarantined: Array<CsvRow & { reason: string }> = [];
  for (const row of rows) {
    const userId = row.raw.user_id?.trim() ?? "";
    const email = normalizeEmail(row.raw.email);
    const createdAtRaw = row.raw.created_at?.trim() ?? "";
    if (!userId || !email || !isDate(createdAtRaw)) {
      quarantined.push({ ...row, reason: !userId ? "missing user id" : !email ? "missing or malformed email" : "invalid created date" });
      continue;
    }
    valid.push({ userId, email, createdAt: new Date(`${createdAtRaw}T00:00:00.000Z`) });
  }
  return { valid, quarantined };
}

async function insertQuarantine(database: AppDatabase, sourceFile: string, items: Array<CsvRow & { reason: string }>) {
  for (let offset = 0; offset < items.length; offset += 200) {
    const batch = items.slice(offset, offset + 200).map((item) => ({ sourceFile, rowNumber: item.rowNumber, raw: item.raw, reason: item.reason }));
    if (batch.length) await database.insert(quarantine).values(batch).onConflictDoUpdate({ target: [quarantine.sourceFile, quarantine.rowNumber], set: { raw: sql`excluded.raw`, reason: sql`excluded.reason` } });
  }
}

function groupVisitors(rows: WebRow[]) {
  const grouped = new Map<string, WebRow[]>();
  for (const row of rows) grouped.set(row.visitorId, [...(grouped.get(row.visitorId) ?? []), row]);
  return [...grouped.entries()].map(([visitorId, events]) => {
    const seenEmails = new Map<string, WebRow>();
    for (const event of events) if (event.email && !seenEmails.has(event.email)) seenEmails.set(event.email, event);
    const earliest = [...seenEmails.entries()].sort((a, b) => a[1].occurredAt.getTime() - b[1].occurredAt.getTime() || a[1].rowNumber - b[1].rowNumber)[0]?.[0] ?? null;
    const firstSeen = events.reduce((best, row) => row.occurredAt < best ? row.occurredAt : best, events[0]!.occurredAt);
    return { visitorId, email: earliest, firstSeen, conflict: seenEmails.size > 1, distinctEmails: [...seenEmails.keys()] };
  });
}

export async function seedData(database: AppDatabase, rawDir = path.join(process.cwd(), "data", "raw")) {
  const [subsText, webText, appText] = await Promise.all([
    readFile(path.join(rawDir, "subscribers.csv"), "utf8"), readFile(path.join(rawDir, "web_events.csv"), "utf8"), readFile(path.join(rawDir, "app_users.csv"), "utf8"),
  ]);
  const subscriberCsv = records(subsText, ["email", "signup_date", "status", "acquisition_source", "last_open_date"]);
  const webCsv = records(webText, ["visitor_id", "page", "timestamp", "utm_source", "email"]);
  const appCsv = records(appText, ["user_id", "email", "created_at"]);
  const subscriberResult = parseSubscribers(subscriberCsv);
  const webResult = parseWeb(webCsv);
  const appResult = parseAppUsers(appCsv);
  await insertQuarantine(database, "subscribers.csv", subscriberResult.quarantined);
  await insertQuarantine(database, "web_events.csv", webResult.quarantined);
  await insertQuarantine(database, "app_users.csv", appResult.quarantined);

  for (let offset = 0; offset < subscriberResult.merged.length; offset += 500) {
    const batch = subscriberResult.merged.slice(offset, offset + 500).map((row) => ({ email: row.email, signupDate: row.signupDate, status: row.status, source: row.source, lastOpenDate: row.lastOpenDate, duplicateCount: row.duplicateCount }));
    if (batch.length) await database.insert(subscribers).values(batch).onConflictDoUpdate({ target: subscribers.email, set: { signupDate: sql`excluded.signup_date`, status: sql`excluded.status`, source: sql`excluded.source`, lastOpenDate: sql`excluded.last_open_date`, duplicateCount: sql`excluded.duplicate_count` } });
  }
  const subscriberRecords = await database.select({ id: subscribers.id, email: subscribers.email }).from(subscribers);
  const subscriberIds = new Map(subscriberRecords.map((row) => [row.email, row.id]));
  const groupedVisitors = groupVisitors(webResult.parsed);
  for (let offset = 0; offset < groupedVisitors.length; offset += 500) {
    const batch = groupedVisitors.slice(offset, offset + 500).map((row) => ({ visitorId: row.visitorId, email: row.email, subscriberId: row.email ? subscriberIds.get(row.email) ?? null : null, conflict: row.conflict, firstSeen: row.firstSeen }));
    if (batch.length) await database.insert(visitors).values(batch).onConflictDoUpdate({ target: visitors.visitorId, set: { email: sql`excluded.email`, subscriberId: sql`excluded.subscriber_id`, conflict: sql`excluded.conflict`, firstSeen: sql`excluded.first_seen` } });
  }
  const visitorConflicts = groupedVisitors.flatMap((visitor) => visitor.conflict ? visitor.distinctEmails.map((email) => ({ kind: "visitor_email_conflict", refA: visitor.visitorId, refB: email })) : []);
  for (let offset = 0; offset < visitorConflicts.length; offset += 500) {
    await database.insert(identityConflicts).values(visitorConflicts.slice(offset, offset + 500)).onConflictDoNothing();
  }
  const eventValues = webResult.parsed.map((row) => ({ visitorId: row.visitorId, page: row.page, occurredAt: row.occurredAt, utmSource: row.utmSource, emailCaptured: row.email !== null, rowKey: `${row.visitorId}|${row.page}|${row.occurredAt.toISOString()}` }));
  for (let offset = 0; offset < eventValues.length; offset += 400) {
    await database.insert(webEvents).values(eventValues.slice(offset, offset + 400)).onConflictDoUpdate({ target: webEvents.rowKey, set: { emailCaptured: sql`excluded.email_captured` } });
  }
  await resolveAppUsers(database, appResult.valid.map((row) => ({ ...row, origin: "csv" as const })));
  return { input: { subscribers: subscriberCsv.length, webEvents: webCsv.length, appUsers: appCsv.length,
    webRowsWithEmail: webResult.parsed.filter((row) => row.email).length, webEmailRowsOnSubscribe: webResult.parsed.filter((row) => row.email && row.page === "/subscribe").length,
    blankSubscriberRows: subscriberResult.quarantined.filter((row) => row.reason.startsWith("blank row")).length,
    malformedSubscriberEmails: subscriberResult.quarantined.filter((row) => row.reason.includes("malformed email")).length,
    uppercaseSubscriberEmails: subscriberCsv.filter((row) => /[A-Z]/.test(row.raw.email ?? "")).length,
    whitespaceSubscriberEmails: subscriberCsv.filter((row) => /^\s|\s$/.test(row.raw.email ?? "")).length,
    duplicateGroupsWithConflictingValues: subscriberResult.conflictingGroups },
    quarantined: { subscribers: subscriberResult.quarantined.length, webEvents: webResult.quarantined.length, appUsers: appResult.quarantined.length }, subscriberRowsValid: subscriberResult.validRows.length, duplicateRowsRemoved: subscriberResult.validRows.length - subscriberResult.merged.length };
}

export async function getSeedStats(database: AppDatabase, rowsWithEmail = 0) {
  const [visitorRows, eventRows, appRows, badRows] = await Promise.all([
    database.select().from(visitors), database.select().from(webEvents), database.select().from(appUsers), database.select().from(quarantine),
  ]);
  const facts = await getSubscriberFacts(database);
  const visitorById = new Map(visitorRows.map((visitor) => [visitor.visitorId, visitor]));
  const sourceCounts = Object.fromEntries(["Instagram", "Facebook", "Referral", "Google", "Podcast", "Direct", "X"].map((source) => [source, facts.filter((f) => f.source === source).length]));
  const active = facts.filter((fact) => fact.status === "active");
  const cold = active.filter((fact) => fact.cold);
  const instagramCold = cold.filter((fact) => fact.source === "Instagram");
  const [previousMonthStart, previousMonthEnd] = previousMonthRange();
  const augustCold = instagramCold.filter((fact) => fact.coldStartDate >= previousMonthStart && fact.coldStartDate <= previousMonthEnd);
  const linkedEvents = eventRows.filter((event) => visitorById.get(event.visitorId)?.subscriberId);
  const linkedEvents30 = linkedEvents.filter((event) => event.occurredAt.getTime() >= Date.parse(`${last30DaysStartDate()}T00:00:00Z`) && event.occurredAt.getTime() <= Date.parse(`${TODAY}T23:59:59.999Z`));
  const newFacts = facts.filter((fact) => fact.signupDate >= last30DaysStartDate());
  const withWeb = new Set(linkedEvents.map((event) => visitorById.get(event.visitorId)?.subscriberId));
  const newWithWeb = newFacts.filter((fact) => withWeb.has(fact.id));
  const both = new Set(appRows.filter((row) => row.subscriberId).map((row) => row.subscriberId));
  const bothWebApp = facts.filter((fact) => withWeb.has(fact.id) && both.has(fact.id));
  const firstByVisitor = new Map<string, (typeof eventRows)[number]>();
  for (const event of eventRows) {
    const current = firstByVisitor.get(event.visitorId);
    if (!current || event.occurredAt < current.occurredAt || (event.occurredAt.getTime() === current.occurredAt.getTime() && (event.id < current.id || (event.id === current.id && event.page < current.page)))) firstByVisitor.set(event.visitorId, event);
  }
  const firstPageCounts = new Map<string, number>();
  const firstPageOrder = new Map<string, number>();
  const newIds = new Set(newWithWeb.map((fact) => fact.id));
  for (const [visitorId, firstEvent] of firstByVisitor) {
    const subscriberId = visitorById.get(visitorId)?.subscriberId;
    if (subscriberId && newIds.has(subscriberId)) {
      firstPageCounts.set(firstEvent.page, (firstPageCounts.get(firstEvent.page) ?? 0) + 1);
      firstPageOrder.set(firstEvent.page, Math.min(firstPageOrder.get(firstEvent.page) ?? firstEvent.id, firstEvent.id));
    }
  }
  const totalDuplicates = facts.reduce((sum, row) => sum + row.duplicateCount - 1, 0);
  return {
    subscriberRows: facts.length, quarantined: badRows.length, duplicatesRemoved: totalDuplicates, active: active.length, unsubscribed: facts.length - active.length, sourceCounts,
    cold: { total: cold.length, lapsed: cold.filter((f) => f.coldBucket === "lapsed").length, neverOpened: cold.filter((f) => f.coldBucket === "never_opened").length, activeNeverOpened: active.filter((f) => !f.lastOpenDate).length, notYetCold: active.filter((f) => f.coldBucket === "new_unopened").length, newUnopened: active.filter((f) => f.coldBucket === "new_unopened").length },
    instagramActive: active.filter((f) => f.source === "Instagram").length, instagramCold: { total: instagramCold.length, lapsed: instagramCold.filter((f) => f.coldBucket === "lapsed").length, neverOpened: instagramCold.filter((f) => f.coldBucket === "never_opened").length },
    instagramWentColdAugust: { total: augustCold.length, lapsed: augustCold.filter((f) => f.coldBucket === "lapsed").length, neverOpened: augustCold.filter((f) => f.coldBucket === "never_opened").length },
    web: { rows: eventRows.length, distinctVisitors: visitorRows.length, rowsWithEmail, linkedRows: linkedEvents.length, unlinkedRows: eventRows.length - linkedEvents.length, anonymousVisitors: visitorRows.filter((v) => !v.email).length, conflictingVisitors: visitorRows.filter((v) => v.conflict).length,
      subscribersWithActivity: withWeb.size, linkedRows30: linkedEvents30.length, linkedSubscribers30: new Set(linkedEvents30.map((event) => visitorById.get(event.visitorId)?.subscriberId)).size },
    app: { users: appRows.length, matched: appRows.filter((row) => row.subscriberId).length, unmatched: appRows.filter((row) => !row.subscriberId).length, bothWebAndApp: bothWebApp.length },
    newSubscribers: { total: newFacts.length, withWeb: newWithWeb.length }, firstPages: Object.fromEntries([...firstPageCounts].sort((a, b) => b[1] - a[1] || (firstPageOrder.get(a[0]) ?? 0) - (firstPageOrder.get(b[0]) ?? 0) || a[0].localeCompare(b[0])).slice(0, 5)),
    engagement: { atLeast70: active.filter((fact) => fact.engagementScore >= 70).length, max: Math.max(0, ...facts.map((fact) => fact.engagementScore)) },
  };
}
