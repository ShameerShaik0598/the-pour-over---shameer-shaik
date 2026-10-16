"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { maskEmail } from "@/lib/privacy";
import { FilterSchema, type SegmentFilter } from "@/lib/segments/schema";
import { SOURCES } from "@/lib/sources";

type PreviewRow = { id: string; email: string; source: string; status: string; signupDate: string; lastOpenDate: string | null; coldBucket: string; engagementScore: number; hasApp: boolean; webVisitCount30: number };
type SegmentPreview = { count: number; page: number; pageSize: number; rows: PreviewRow[] };
type SavedSegment = { id: string; name: string; filter: unknown; createdAt: string; createdBy: string };

const quickStarts: Array<{ label: string; filter: SegmentFilter }> = [
  { label: "Instagram, active, cold 30+ days", filter: FilterSchema.parse({ sources: ["Instagram"], status: "active", cold: "any_cold" }) },
  { label: "Instagram went cold in August", filter: FilterSchema.parse({ sources: ["Instagram"], status: "active", went_cold_between: ["2026-08-01", "2026-08-31"] }) },
  { label: "Engaged readers · 70+", filter: FilterSchema.parse({ status: "active", min_engagement: 70 }) },
  { label: "App + web readers", filter: FilterSchema.parse({ status: "any", has_app: true, has_web_activity: true }) },
];

export function SegmentBuilder() {
  const [filter, setFilter] = useState<SegmentFilter>(() => FilterSchema.parse({}));
  const [preview, setPreview] = useState<SegmentPreview>({ count: 0, page: 1, pageSize: 50, rows: [] });
  const [saved, setSaved] = useState<SavedSegment[]>([]);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("signup_desc");
  const [name, setName] = useState("");
  const [showEmail, setShowEmail] = useState(false);
  const [notice, setNotice] = useState("Loading segment preview…");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      const response = await fetch("/api/segments/preview", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ filter, page, sort }) });
      const result = await response.json() as SegmentPreview & { error?: string };
      if (!active) return;
      if (response.ok) { setPreview(result); setNotice(`${result.count.toLocaleString()} readers match.`); }
      else setNotice(result.error ?? "Could not preview the segment.");
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [filter, page, sort]);

  useEffect(() => {
    let active = true;
    void fetch("/api/segments").then((response) => response.json()).then((result: { segments?: SavedSegment[] }) => { if (active) setSaved(result.segments ?? []); });
    return () => { active = false; };
  }, []);

  function update<K extends keyof SegmentFilter>(key: K, value: SegmentFilter[K] | undefined) {
    setFilter((current) => FilterSchema.parse({ ...current, [key]: value })); setPage(1);
  }

  function toggleSource(source: (typeof SOURCES)[number], checked: boolean) {
    const sources = new Set(filter.sources ?? []);
    if (checked) sources.add(source); else sources.delete(source);
    update("sources", sources.size ? [...sources] : undefined);
  }

  async function saveSegment() {
    setBusy(true);
    const response = await fetch("/api/segments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, filter }) });
    const result = await response.json() as { segment?: SavedSegment; error?: string };
    if (response.ok && result.segment) { setSaved((current) => [result.segment!, ...current]); setName(""); setNotice("Segment saved."); }
    else setNotice(result.error ?? "Could not save this segment.");
    setBusy(false);
  }

  async function loadSaved(segment: SavedSegment) {
    const parsed = FilterSchema.safeParse(segment.filter);
    if (!parsed.success) { setNotice("This saved filter is no longer valid."); return; }
    setFilter(parsed.data); setPage(1); setNotice(`Loaded ${segment.name}.`);
  }

  const pageCount = Math.max(1, Math.ceil(preview.count / preview.pageSize));
  return <div className="mt-8 grid gap-10 lg:grid-cols-[17rem_1fr]">
    <aside className="space-y-7">
      <section><p className="section-label">QUICK START</p><div className="mt-3 flex flex-col items-start gap-2">{quickStarts.map((item) => <button key={item.label} onClick={() => { setFilter(item.filter); setPage(1); }} className="min-h-10 border border-line px-3 py-2 text-left text-sm hover:bg-paper-2">{item.label}</button>)}</div></section>
      <section><p className="section-label">SOURCES</p><div className="mt-3 grid grid-cols-2 gap-2">{SOURCES.map((source) => <label key={source} className="flex min-h-9 items-center gap-2 text-sm"><input type="checkbox" checked={filter.sources?.includes(source) ?? false} onChange={(event) => toggleSource(source, event.currentTarget.checked)} />{source}</label>)}</div></section>
      <label className="block text-sm">Status<select value={filter.status} onChange={(event) => update("status", event.currentTarget.value as SegmentFilter["status"])} className="mt-2 min-h-11 w-full border border-line bg-paper px-2"><option value="active">Active</option><option value="unsubscribed">Unsubscribed</option><option value="any">Any status</option></select></label>
      <label className="block text-sm">Cold bucket<select value={filter.cold ?? ""} onChange={(event) => update("cold", (event.currentTarget.value || undefined) as SegmentFilter["cold"])} className="mt-2 min-h-11 w-full border border-line bg-paper px-2"><option value="">Any</option><option value="any_cold">Any cold</option><option value="lapsed">Lapsed</option><option value="never_opened">Never opened</option><option value="warm">Warm</option><option value="new_unopened">New, unopened</option></select></label>
      <label className="block text-sm">Minimum engagement<input type="number" min={0} max={100} value={filter.min_engagement ?? ""} onChange={(event) => update("min_engagement", event.currentTarget.value === "" ? undefined : Number(event.currentTarget.value))} className="mt-2 min-h-11 w-full border border-line bg-paper px-3" /></label>
      <label className="block text-sm">App account<select value={filter.has_app === undefined ? "any" : String(filter.has_app)} onChange={(event) => update("has_app", event.currentTarget.value === "any" ? undefined : event.currentTarget.value === "true")} className="mt-2 min-h-11 w-full border border-line bg-paper px-2"><option value="any">Any</option><option value="true">Has app</option><option value="false">No app</option></select></label>
      <label className="block text-sm">Site activity<select value={filter.has_web_activity === undefined ? "any" : String(filter.has_web_activity)} onChange={(event) => update("has_web_activity", event.currentTarget.value === "any" ? undefined : event.currentTarget.value === "true")} className="mt-2 min-h-11 w-full border border-line bg-paper px-2"><option value="any">Any</option><option value="true">Has site activity</option><option value="false">No site activity</option></select></label>
      <button className="min-h-10 underline" onClick={() => { setFilter(FilterSchema.parse({})); setPage(1); }}>Clear filters</button>
    </aside>
    <section className="min-w-0">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4"><div><p className="section-label">LIVE PREVIEW</p><h2 className="mt-2 font-display text-3xl">{preview.count.toLocaleString()} readers</h2><p role="status" className="mt-1 text-sm text-ink-muted">{notice}</p></div><button type="button" className="min-h-10 underline" onClick={() => setShowEmail((value) => !value)} aria-pressed={showEmail}>{showEmail ? "Mask emails" : "Reveal emails"}</button></div>
      <div className="mt-4 flex items-center justify-between gap-3"><label className="text-sm">Sort <select value={sort} onChange={(event) => { setSort(event.currentTarget.value); setPage(1); }} className="ml-2 min-h-10 border border-line bg-paper px-2"><option value="signup_desc">Newest signup</option><option value="signup_asc">Oldest signup</option><option value="engagement_desc">Engagement</option><option value="email_asc">Email</option></select></label><div className="flex gap-2"><button disabled={page <= 1} onClick={() => setPage((current) => current - 1)} className="min-h-10 border border-line px-3 disabled:opacity-40">Previous</button><span className="inline-flex items-center text-sm">{page} / {pageCount}</span><button disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)} className="min-h-10 border border-line px-3 disabled:opacity-40">Next</button></div></div>
      <div className="mt-3 overflow-x-auto border-y border-line"><table className="w-full min-w-[620px] text-left text-sm"><thead><tr className="border-b border-line text-xs uppercase tracking-wide"><th className="py-3 pr-4">Reader</th><th className="py-3 pr-4">Source</th><th className="py-3 pr-4">Status</th><th className="py-3 pr-4">Signed up</th><th className="py-3 pr-4">Cold</th><th className="py-3">Score</th></tr></thead><tbody>{preview.rows.map((row) => <tr key={row.id} className="border-b border-line last:border-0"><td className="py-3 pr-4">{showEmail ? row.email : maskEmail(row.email)}</td><td className="py-3 pr-4">{row.source}</td><td className="py-3 pr-4">{row.status}</td><td className="py-3 pr-4">{row.signupDate}</td><td className="py-3 pr-4">{row.coldBucket.replaceAll("_", " ")}</td><td className="py-3">{row.engagementScore}</td></tr>)}</tbody></table></div>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row"><input aria-label="Segment name" value={name} onChange={(event) => setName(event.currentTarget.value)} maxLength={80} placeholder="Name this segment" className="min-h-11 flex-1 border border-line bg-transparent px-3" /><button disabled={busy || !name.trim()} onClick={saveSegment} className="min-h-11 bg-ink px-4 text-paper disabled:opacity-50">{busy ? "Saving…" : "Save segment"}</button></div>
      <section className="mt-10 border-t border-line pt-5"><p className="section-label">SAVED SEGMENTS</p>{saved.length ? <ul className="mt-3 divide-y divide-line">{saved.map((segment) => <li key={segment.id} className="flex flex-wrap items-center justify-between gap-2 py-3"><button onClick={() => void loadSaved(segment)} className="text-left underline">{segment.name}</button><Link href={`/api/segments/${segment.id}/export.csv`} className="text-sm">Export CSV →</Link></li>)}</ul> : <p className="mt-3 text-sm text-ink-muted">No saved segments yet.</p>}</section>
    </section>
  </div>;
}
