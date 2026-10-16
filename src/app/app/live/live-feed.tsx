"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type FeedEvent = { event: string; occurredAt: string; receivedAt: string; profile: { type: "subscriber" | "app"; id: string; label: string } | null };
type FeedData = { events: FeedEvent[]; counters: { accepted: number; duplicate: number; rejected: number } };

export function LiveFeed() {
  const [data, setData] = useState<FeedData>({ events: [], counters: { accepted: 0, duplicate: 0, rejected: 0 } });
  const [since, setSince] = useState<string | null>(null);
  const [notice, setNotice] = useState("Waiting for activity.");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let active = true;
    async function refresh() {
      const suffix = since ? `?since=${encodeURIComponent(since)}` : "";
      const response = await fetch(`/api/events/recent${suffix}`, { cache: "no-store" });
      if (!response.ok || !active) return;
      const next = await response.json() as FeedData;
      setData((current) => ({ ...next, events: [...next.events, ...current.events].filter((event, index, all) => all.findIndex((item) => `${item.receivedAt}-${item.event}` === `${event.receivedAt}-${event.event}`) === index).slice(0, 50) }));
      const latest = next.events.reduce<string | null>((value, event) => value === null || event.receivedAt > value ? event.receivedAt : value, null);
      if (latest) setSince(latest);
      if (next.events.length) setNotice(`${next.events.length} new event${next.events.length === 1 ? "" : "s"} received.`);
    }
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 2000);
    return () => { active = false; window.clearInterval(timer); };
  }, [since]);

  async function sendTestEvent() {
    setSending(true); setNotice("Sending signed test event…");
    const response = await fetch("/api/demo/send-test-event", { method: "POST" });
    setNotice(response.ok ? "Test event accepted. It will appear in the feed shortly." : "Could not send the test event.");
    setSending(false);
  }

  return <>
    <div className="mt-8 grid grid-cols-3 gap-4 border-y border-line py-5 text-center"><div><p className="stat-figure text-3xl">{data.counters.accepted}</p><p className="mt-1 text-sm text-ink-muted">Accepted</p></div><div><p className="stat-figure text-3xl">{data.counters.duplicate}</p><p className="mt-1 text-sm text-ink-muted">Duplicates</p></div><div><p className="stat-figure text-3xl">{data.counters.rejected}</p><p className="mt-1 text-sm text-ink-muted">Rejected</p></div></div>
    <div className="mt-8 flex flex-wrap items-center justify-between gap-3"><p role="status" className="text-sm text-ink-muted">{notice}</p><button onClick={sendTestEvent} disabled={sending} className="min-h-11 bg-ink px-4 text-paper disabled:opacity-60">{sending ? "Sending…" : "Send test event"}</button></div>
    <h2 className="mt-8 font-display text-2xl">Recent events</h2>
    {data.events.length ? <ol className="mt-3 divide-y divide-line border-y border-line">{data.events.map((event, index) => <li key={`${event.receivedAt}-${event.event}-${index}`} className="grid gap-2 py-4 sm:grid-cols-[1fr_1fr_1fr]"><div><p className="capitalize">{event.event.replaceAll("_", " ")}</p><p className="mt-1 text-xs text-ink-muted">{event.profile?.label ?? "Anonymous device"}</p></div><div><p className="section-label">OCCURRED</p><time className="mt-1 block text-sm">{new Date(event.occurredAt).toISOString()}</time></div><div><p className="section-label">RECEIVED</p><time className="mt-1 block text-sm">{new Date(event.receivedAt).toISOString()}</time>{event.profile && <Link href={`/app/lookup/${event.profile.type}/${event.profile.id}`} className="mt-2 inline-block text-sm">Open profile →</Link>}</div></li>)}</ol> : <p className="mt-4 text-sm text-ink-muted">No app events yet. Send a signed test event to see the feed update.</p>}
  </>;
}
