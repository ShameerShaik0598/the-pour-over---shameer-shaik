"use client";

import { useState } from "react";
import Link from "next/link";
import { SourceChip, StatFigure, Toast } from "@/components/ui";

type OverviewData = Awaited<ReturnType<typeof import("@/lib/dashboard").getOverviewData>>;

function money(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value); }

export function OverviewDashboard({ data, defaultCost }: { data: OverviewData; defaultCost: number }) {
  const [cost, setCost] = useState(defaultCost);
  const [notice, setNotice] = useState("");
  const { stats, dataQuality, live } = data;
  const emailPercent = stats.web.rows ? Math.round((stats.web.rowsWithEmail / stats.web.rows) * 100) : 0;
  const stitchedPercent = stats.web.rows ? Math.round((stats.web.linkedRows / stats.web.rows) * 100) : 0;
  const costInput = Number.isFinite(cost) && cost >= 0 ? cost : 0;

  async function saveSegment(name: string, cold: "lapsed" | "never_opened") {
    setNotice("");
    try {
      const response = await fetch("/api/segments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, filter: { status: "active", cold } }) });
      if (!response.ok) throw new Error("Could not save this segment.");
      setNotice(`${name} saved. Open Segments to preview or export it.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not save this segment."); }
  }

  return <div className="page-shell overview-page py-9">
    <p className="section-label">MONDAY, SEPTEMBER 28, 2026 · OVERVIEW</p>
    <div className="mt-2 flex flex-wrap items-end justify-between gap-4"><h2 className="font-display text-4xl sm:text-5xl">Good morning.</h2><Link href="/app/lookup" className="min-h-11 inline-flex items-center underline">Find a reader</Link></div>
    <p className="mt-3 max-w-2xl text-ink-muted">The whole reader relationship, from newsletter signup to the last page viewed.</p>
    <div className="dashboard-stats mt-10 grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-4">
      <StatFigure value={stats.subscriberRows.toLocaleString()} label="Readers"/><StatFigure value={stats.active.toLocaleString()} label="Active readers"/>
      <StatFigure value={stats.cold.total.toLocaleString()} label="Cold readers"/><StatFigure value={`${stats.web.linkedRows.toLocaleString()} / ${stats.web.rows.toLocaleString()}`} label="Linked visits"/>
    </div>

    <div className="dashboard-columns mt-12 grid gap-10 lg:grid-cols-2">
      <section className="border-t border-line pt-5" aria-labelledby="stitching-title">
        <p className="section-label">STITCHING IMPACT</p><h3 id="stitching-title" className="mt-2 font-display text-2xl">More context, fewer blind spots.</h3>
        <div className="mt-6 grid grid-cols-2 gap-5"><StatFigure value={`${stats.web.rowsWithEmail.toLocaleString()} / ${stats.web.rows.toLocaleString()}`} label={`Email captured · ${emailPercent}%`}/><StatFigure value={`${stats.web.linkedRows.toLocaleString()} / ${stats.web.rows.toLocaleString()}`} label={`Stitched to a reader · ${stitchedPercent}%`}/></div>
        <p className="mt-5 text-sm text-ink-muted">{stats.web.unlinkedRows.toLocaleString()} visits remain unlinked across {stats.web.anonymousVisitors.toLocaleString()} anonymous visitors.</p>
        <details className="mt-3 text-sm"><summary className="min-h-11 cursor-pointer font-medium underline">How stitching works</summary><p className="mt-2 max-w-prose text-ink-muted">A site visitor links when a captured, normalized email matches a newsletter reader. App accounts match by email; anonymous app activity follows the earliest device link. Unmatched activity stays visible without guessing.</p></details>
      </section>

      <section className="border-t border-line pt-5" aria-labelledby="cost-title">
        <p className="section-label">COLD-LIST COST · ESTIMATE</p><h3 id="cost-title" className="mt-2 font-display text-2xl">What could a cold list cost?</h3>
        <p className="mt-2 text-sm text-ink-muted">An editable planning assumption, not billing data.</p>
        <label className="mt-4 flex min-h-11 items-center gap-2 text-sm">Monthly cost per subscriber <span aria-hidden="true">$</span><input aria-label="Assumed monthly cost per subscriber" type="number" min="0" step="0.01" value={cost} onChange={(event) => setCost(Number(event.currentTarget.value))} className="w-24 border border-line bg-transparent px-2 py-2 tabular-nums"/></label>
        <div className="mt-5 grid grid-cols-2 gap-5"><StatFigure value={money(stats.cold.lapsed * costInput)} label={`${stats.cold.lapsed} lapsed readers`}/><StatFigure value={money(stats.cold.neverOpened * costInput)} label={`${stats.cold.neverOpened} never opened`}/></div>
        <p className="mt-3 text-sm text-ink-muted">Estimated total: {money(stats.cold.total * costInput)} per month.</p>
        <div className="mt-4 flex flex-wrap gap-2"><button onClick={() => void saveSegment("Win-back (lapsed)", "lapsed")} className="min-h-11 border border-line px-3 text-sm underline">Save win-back segment</button><button onClick={() => void saveSegment("Sunset candidates (never opened)", "never_opened")} className="min-h-11 border border-line px-3 text-sm underline">Save sunset segment</button></div>
        {notice && <p className="mt-3" role="status"><Toast>{notice}</Toast></p>}
      </section>
    </div>

    <div className="dashboard-columns mt-12 grid gap-10 lg:grid-cols-2">
      <section className="border-t border-line pt-5"><p className="section-label">SOURCE MIX</p><h3 className="mt-2 font-display text-2xl">Where readers found us.</h3><ul className="mt-4 grid gap-3 sm:grid-cols-2">{Object.entries(stats.sourceCounts).map(([source, value]) => <li key={source} className="flex items-center justify-between border-b border-line pb-2"><SourceChip>{source}</SourceChip><span className="tabular-nums">{value.toLocaleString()}</span></li>)}</ul></section>
      <section className="border-t border-line pt-5"><div className="flex items-end justify-between gap-3"><div><p className="section-label">LIVE ACTIVITY</p><h3 className="mt-2 font-display text-2xl">App events arriving now.</h3></div><Link href="/app/live" className="min-h-11 inline-flex items-center underline">Open live feed</Link></div>
        {live.events.length ? <ul className="mt-4 divide-y divide-line">{live.events.slice(0, 6).map((event, index) => <li key={`${event.event}-${event.receivedAt}-${index}`} className="flex justify-between gap-4 py-3 text-sm"><span>{event.event.replaceAll("_", " ")}<span className="block text-ink-muted">{event.profile?.label ?? "Unlinked app activity"}</span></span><time className="text-xs text-ink-muted">{new Date(event.receivedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</time></li>)}</ul> : <p className="mt-4 text-sm text-ink-muted">No app activity received yet.</p>}
        <p className="mt-2 text-xs text-ink-muted">Delivery totals: {live.counters.accepted} accepted · {live.counters.duplicate} duplicate · {live.counters.rejected} rejected</p></section>
    </div>

    <section className="mt-12 border-t border-line pt-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="section-label">DATA QUALITY</p><h3 className="mt-2 font-display text-2xl">Know what needs a closer look.</h3><p className="mt-2 text-sm text-ink-muted">{dataQuality.quarantined.length} quarantined · {dataQuality.duplicatesMerged} duplicate rows merged · {dataQuality.unlinkedVisitors} unlinked visitors · {dataQuality.identityConflicts} identity conflicts</p></div><Link href="/app/data-quality" className="min-h-11 inline-flex items-center underline">Review data quality</Link></div></section>
    <section className="mt-12 border-t border-line pt-5"><p className="section-label">READER JOURNEY</p><h3 className="mt-2 font-display text-2xl">See the whole relationship.</h3><p className="mt-2 max-w-prose text-sm text-ink-muted">Profiles show newsletter facts, linked visitors and app accounts, event history, and the pages readers saw before subscribing.</p><Link href="/app/lookup" className="mt-3 inline-flex min-h-11 items-center underline">Explore a reader profile</Link></section>
  </div>;
}
