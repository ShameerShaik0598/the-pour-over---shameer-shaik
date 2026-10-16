import type { AppDatabase } from "@/lib/db";
import type { SubscriberFact } from "@/lib/facts";
import { getSubscriberFacts } from "@/lib/facts";
import { shiftDate, TODAY } from "@/lib/clock";
import { SOURCES } from "@/lib/sources";
import { FilterSchema } from "@/lib/segments/schema";

export { FilterSchema } from "@/lib/segments/schema";
export type { SegmentFilter } from "@/lib/segments/schema";
export type SegmentSort = "engagement_desc" | "signup_desc" | "signup_asc" | "email_asc";
export type SegmentPreview = { count: number; rows: SubscriberFact[]; page: number; pageSize: number };

/** Compiles the validated, allowlisted filter into a predicate over the subscriber_facts read model. */
export function compileFilter(filterInput: unknown): (fact: SubscriberFact) => boolean {
  const filter = FilterSchema.parse(filterInput);
  const rules: Array<(fact: SubscriberFact) => boolean> = [];
  if (filter.sources?.length) rules.push((fact) => filter.sources!.includes(fact.source as (typeof SOURCES)[number]));
  if (filter.status !== "any") rules.push((fact) => fact.status === filter.status);
  if (filter.signup_between) rules.push((fact) => fact.signupDate >= filter.signup_between![0] && fact.signupDate <= filter.signup_between![1]);
  if (filter.cold === "any_cold") rules.push((fact) => fact.cold);
  else if (filter.cold === "lapsed" || filter.cold === "never_opened") rules.push((fact) => fact.cold && fact.coldBucket === filter.cold);
  else if (filter.cold) rules.push((fact) => !fact.cold && fact.coldBucket === filter.cold);
  if (filter.went_cold_between) rules.push((fact) => fact.cold && fact.coldStartDate >= filter.went_cold_between![0] && fact.coldStartDate <= filter.went_cold_between![1]);
  if (filter.last_open_within_days !== undefined) {
    const cutoff = shiftDate(TODAY, -filter.last_open_within_days);
    rules.push((fact) => fact.lastOpenDate !== null && fact.lastOpenDate >= cutoff && fact.lastOpenDate <= TODAY);
  }
  if (filter.has_app !== undefined) rules.push((fact) => fact.hasApp === filter.has_app);
  if (filter.has_web_activity !== undefined) rules.push((fact) => (fact.web.length > 0) === filter.has_web_activity);
  if (filter.min_engagement !== undefined) rules.push((fact) => fact.engagementScore >= filter.min_engagement!);
  if (filter.new_within_days !== undefined) {
    const cutoff = shiftDate(TODAY, -filter.new_within_days);
    rules.push((fact) => fact.signupDate >= cutoff && fact.signupDate <= TODAY);
  }
  return (fact) => rules.every((rule) => rule(fact));
}

function sortFacts(rows: SubscriberFact[], sort: SegmentSort): SubscriberFact[] {
  return [...rows].sort((left, right) => {
    if (sort === "engagement_desc") return right.engagementScore - left.engagementScore || left.email.localeCompare(right.email);
    if (sort === "signup_desc") return right.signupDate.localeCompare(left.signupDate) || left.email.localeCompare(right.email);
    if (sort === "signup_asc") return left.signupDate.localeCompare(right.signupDate) || left.email.localeCompare(right.email);
    return left.email.localeCompare(right.email);
  });
}

export async function getSegmentRows(database: AppDatabase, filterInput: unknown, sort: SegmentSort = "signup_desc") {
  const predicate = compileFilter(filterInput);
  const facts = await getSubscriberFacts(database);
  return sortFacts(facts.filter(predicate), sort);
}

export async function previewSegment(database: AppDatabase, filterInput: unknown, page: number, sort: SegmentSort = "signup_desc", pageSize = 50): Promise<SegmentPreview> {
  const rows = await getSegmentRows(database, filterInput, sort);
  return { count: rows.length, rows: rows.slice((page - 1) * pageSize, page * pageSize), page, pageSize };
}
