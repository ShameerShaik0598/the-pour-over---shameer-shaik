import type { AppDatabase } from "@/lib/db";
import { visitors, webEvents } from "@/lib/db/schema";
import type { SubscriberFact } from "@/lib/facts";
import { FilterSchema, type SegmentFilter } from "@/lib/segments/schema";
import { getSegmentRows } from "@/lib/segments/filter";
import type { AssistantPlan } from "@/lib/ai/schema";

type ReaderRow = { id: string; email: string; source: string; status: string; signupDate: string; engagementScore: number };
type TableRow = { label: string; value: number };
export type AssistantAnswer = {
  kind: "metric" | "table" | "segment" | "notice";
  answer: string;
  count?: number;
  breakdown?: Array<{ label: string; value: number }>;
  rows?: ReaderRow[];
  table?: TableRow[];
  segment?: { name: string; filter: SegmentFilter; count: number; rows: ReaderRow[] };
};

function readerRows(rows: SubscriberFact[], limit: number): ReaderRow[] {
  return rows.slice(0, limit).map(({ id, email, source, status, signupDate, engagementScore }) => ({ id, email, source, status, signupDate, engagementScore }));
}

function groupValue(fact: SubscriberFact, groupBy: NonNullable<AssistantPlan["group_by"]>): string {
  if (groupBy === "source") return fact.source;
  if (groupBy === "status") return fact.status;
  if (groupBy === "cold_bucket") return fact.coldBucket;
  const date = new Date(`${fact.signupDate}T00:00:00.000Z`);
  const offset = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - offset);
  return date.toISOString().slice(0, 10);
}

function countsBy(rows: SubscriberFact[], groupBy: NonNullable<AssistantPlan["group_by"]>): TableRow[] {
  const countMap = new Map<string, number>();
  for (const row of rows) {
    const key = groupValue(row, groupBy);
    countMap.set(key, (countMap.get(key) ?? 0) + 1);
  }
  return [...countMap].map(([label, value]) => ({ label, value })).sort((left, right) => right.value - left.value || left.label.localeCompare(right.label));
}

async function firstPages(database: AppDatabase, filterInput: unknown, limit: number): Promise<TableRow[]> {
  const requested = filterInput && typeof filterInput === "object" ? filterInput as Record<string, unknown> : {};
  const filter = FilterSchema.parse({ ...requested, status: Object.hasOwn(requested, "status") ? requested.status : "any", new_within_days: requested.new_within_days ?? 30 });
  const cohort = await getSegmentRows(database, filter);
  const newIds = new Set(cohort.map((row) => row.id));
  const [visitorRows, events] = await Promise.all([database.select().from(visitors), database.select().from(webEvents)]);
  const visitorById = new Map(visitorRows.map((row) => [row.visitorId, row]));
  const firstByVisitor = new Map<string, (typeof events)[number]>();
  for (const event of events) {
    const current = firstByVisitor.get(event.visitorId);
    if (!current || event.occurredAt < current.occurredAt || (event.occurredAt.getTime() === current.occurredAt.getTime() && (event.id < current.id || (event.id === current.id && event.page < current.page)))) firstByVisitor.set(event.visitorId, event);
  }
  const pages = new Map<string, { value: number; firstId: number }>();
  for (const [visitorId, event] of firstByVisitor) {
    const subscriberId = visitorById.get(visitorId)?.subscriberId;
    if (!subscriberId || !newIds.has(subscriberId)) continue;
    const previous = pages.get(event.page);
    pages.set(event.page, { value: (previous?.value ?? 0) + 1, firstId: Math.min(previous?.firstId ?? event.id, event.id) });
  }
  return [...pages].map(([label, data]) => ({ label, ...data })).sort((left, right) => right.value - left.value || left.firstId - right.firstId || left.label.localeCompare(right.label)).slice(0, limit).map(({ label, value }) => ({ label, value }));
}

export async function executePlan(database: AppDatabase, plan: AssistantPlan): Promise<AssistantAnswer> {
  if (plan.intent === "refuse") return { kind: "notice", answer: "For individual readers, use Lookup. The assistant only answers audience questions." };
  if (plan.intent === "clarify") return { kind: "notice", answer: plan.clarifying_question ?? "Could you clarify what audience question you have?" };
  if (plan.intent === "first_pages") {
    const table = await firstPages(database, plan.filter ?? { new_within_days: 30 }, plan.limit ?? 10);
    return { kind: "table", answer: "Here are the first pages seen by new subscribers' linked visitors.", count: table.reduce((sum, row) => sum + row.value, 0), table };
  }
  const filter = FilterSchema.parse(plan.filter ?? {});
  const rows = await getSegmentRows(database, filter, plan.sort ?? "signup_desc");
  if (plan.intent === "count" && plan.group_by) {
    const table = countsBy(rows, plan.group_by);
    return { kind: "table", answer: `A breakdown by ${plan.group_by.replaceAll("_", " ")}.`, count: rows.length, table };
  }
  if (plan.intent === "trend" || (plan.intent === "count" && plan.group_by)) {
    const table = countsBy(rows, plan.group_by ?? "signup_week");
    return { kind: "table", answer: `A breakdown by ${(plan.group_by ?? "signup_week").replaceAll("_", " ")}.`, count: rows.length, table };
  }
  if (plan.intent === "count") {
    const breakdown = filter.went_cold_between ? ["lapsed", "never_opened"].map((label) => ({ label, value: rows.filter((row) => row.coldBucket === label).length })) : undefined;
    return { kind: "metric", answer: `There ${rows.length === 1 ? "is" : "are"} ${rows.length.toLocaleString()} matching reader${rows.length === 1 ? "" : "s"}.`, count: rows.length, ...(breakdown ? { breakdown } : {}) };
  }
  if (plan.intent === "segment") {
    const limit = plan.limit ?? 50;
    return { kind: "segment", answer: `${rows.length.toLocaleString()} readers match this segment.`, count: rows.length,
      segment: { name: plan.segment_name ?? "Assistant segment", filter, count: rows.length, rows: readerRows(rows, limit) } };
  }
  const limit = plan.limit ?? 50;
  return { kind: "table", answer: `Showing ${Math.min(rows.length, limit)} of ${rows.length.toLocaleString()} matching readers.`, count: rows.length, rows: readerRows(rows, limit) };
}

