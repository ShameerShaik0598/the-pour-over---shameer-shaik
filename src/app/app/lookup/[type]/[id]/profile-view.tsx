"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { maskEmail } from "@/lib/privacy";

type Timeline = { kind: "web" | "app"; occurredAt: string; label: string; detail: string };
type Subscriber = { id: string; email: string; status: string; source: string; signupDate: string; lastOpenDate: string | null; duplicateCount: number; cold: boolean; coldBucket: string; coldStartDate: string; engagementScore: number; webVisitCount30: number; hasApp: boolean; appEvents30: number };
type Profile = { type: "subscriber" | "app" | "visitor"; subscriber?: Subscriber; appUser?: { email: string | null; createdAt: string; origin: string }; visitor?: { email: string | null; firstSeen: string; conflict: boolean }; visitorCount?: number; deviceCount?: number; webCount: number; appAccounts: number; timeline: Timeline[]; whyLinked: string[]; preSignupJourney: string[] };

export function ProfileView({ profile }: { profile: Profile }) {
  const [source, setSource] = useState<"all" | "web" | "app">("all");
  const [showEmail, setShowEmail] = useState(false);
  const timeline = useMemo(() => profile.timeline.filter((entry) => source === "all" || entry.kind === source), [profile.timeline, source]);
  const reader = profile.subscriber;
  const email = reader?.email ?? profile.visitor?.email ?? profile.appUser?.email ?? null;
  return <div className="page-shell profile-page py-9">
    <Link href="/app/lookup" className="text-sm">← Back to lookup</Link>
    <p className="section-label mt-7">{reader ? "NEWSLETTER READER" : profile.visitor ? "UNLINKED SITE VISITOR" : "APP-ONLY PROFILE"}</p>
    <div className="mt-2 flex flex-wrap items-center gap-3"><h2 className="break-words font-display text-4xl">{email ? (showEmail ? email : maskEmail(email)) : "App-only reader"}</h2>{email && <button type="button" className="min-h-10 underline" onClick={() => setShowEmail((value) => !value)} aria-pressed={showEmail}>{showEmail ? "Mask email" : "Reveal email"}</button>}</div>
    <div className="mt-3 flex flex-wrap gap-2">{profile.whyLinked.map((reason) => <span key={reason} className="border border-line px-3 py-2 text-sm">{reason}</span>)}</div>
    {reader ? <>
      <div className="mt-8 grid grid-cols-2 gap-5 border-y border-line py-5 sm:grid-cols-4">
        <div><p className="section-label">STATUS</p><p className="mt-2">{reader.status}</p></div><div><p className="section-label">SOURCE</p><p className="mt-2">{reader.source}</p></div>
        <div><p className="section-label">SIGNED UP</p><p className="mt-2">{reader.signupDate}</p></div><div><p className="section-label">LAST OPEN</p><p className="mt-2">{reader.lastOpenDate ?? "Never"}</p></div>
        <div><p className="section-label">COLD BUCKET</p><p className="mt-2">{reader.cold ? reader.coldBucket : "Not cold"}</p></div><div><p className="section-label">ENGAGEMENT</p><p className="mt-2">{reader.engagementScore} / 100</p></div>
        <div><p className="section-label">DUPLICATE MERGE</p><p className="mt-2">Merged {reader.duplicateCount} row{reader.duplicateCount === 1 ? "" : "s"}</p></div><div><p className="section-label">LAST 30 DAYS</p><p className="mt-2">{reader.webVisitCount30} web visits · {reader.appEvents30} app events</p></div>
      </div>
      <section className="mt-8 grid gap-6 md:grid-cols-3">
        <article className="border-t border-line pt-4"><p className="section-label">NEWSLETTER</p><p className="mt-3">{reader.status} reader</p><p className="mt-1 text-sm text-ink-muted">{reader.lastOpenDate ? `Last opened ${reader.lastOpenDate}` : "No recorded opens"}</p></article>
        <article className="border-t border-line pt-4"><p className="section-label">SITE</p><p className="mt-3">{profile.webCount} recorded page views</p><p className="mt-1 text-sm text-ink-muted">{profile.visitorCount ?? 0} linked visitor identit{profile.visitorCount === 1 ? "y" : "ies"}</p></article>
        <article className="border-t border-line pt-4"><p className="section-label">APP</p><p className="mt-3">{profile.appAccounts ? `${profile.appAccounts} linked account${profile.appAccounts === 1 ? "" : "s"}` : "No linked app account"}</p><p className="mt-1 text-sm text-ink-muted">{reader.hasApp ? "App identity matched" : "No app identity match"}</p></article>
      </section>
      <section className="mt-9 border-t border-line pt-5"><p className="section-label">BEFORE SIGNUP</p><h3 className="mt-2 font-display text-2xl">The path to the first subscription</h3>{profile.preSignupJourney.length ? <ol className="mt-4 flex flex-wrap gap-2">{profile.preSignupJourney.map((page, index) => <li key={`${page}-${index}`} className="border border-line px-3 py-2 text-sm">{index + 1}. {page}</li>)}</ol> : <p className="mt-3 text-sm text-ink-muted">No linked page views were recorded before signup.</p>}</section>
    </> : profile.visitor ? <section className="mt-8 grid gap-6 border-y border-line py-6 sm:grid-cols-3"><div><p className="section-label">SITE VISITOR</p><p className="mt-2">First seen {profile.visitor.firstSeen.slice(0, 10)}</p></div><div><p className="section-label">PAGE VIEWS</p><p className="mt-2">{profile.webCount}</p></div><div><p className="section-label">IDENTITY</p><p className="mt-2">{profile.visitor.conflict ? "Conflicting email identities" : "No subscriber match"}</p></div></section> : <section className="mt-8 grid gap-6 border-y border-line py-6 sm:grid-cols-3"><div><p className="section-label">APP ACCOUNT</p><p className="mt-2">Account details are linked privately.</p><p className="mt-1 text-sm text-ink-muted">Origin: {profile.appUser?.origin}</p></div><div><p className="section-label">ACCOUNT</p><p className="mt-2">Created {profile.appUser?.createdAt.slice(0, 10)}</p></div><div><p className="section-label">DEVICES</p><p className="mt-2">{profile.deviceCount ?? 0} linked device{profile.deviceCount === 1 ? "" : "s"}</p></div></section>}
    <section className="mt-10 border-t border-line pt-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="section-label">MERGED READER TIMELINE</p><h3 className="mt-2 font-display text-2xl">Activity</h3></div><label className="text-sm">Show <select value={source} onChange={(event) => setSource(event.target.value as typeof source)} className="ml-2 min-h-10 border border-line bg-paper px-2"><option value="all">All sources</option><option value="web">Site</option><option value="app">App</option></select></label></div>
      {timeline.length ? <ol className="mt-4 divide-y divide-line border-y border-line">{timeline.map((entry, index) => <li key={`${entry.kind}-${entry.occurredAt}-${index}`} className="grid gap-1 py-3 sm:grid-cols-[10rem_8rem_1fr]"><time className="text-sm text-ink-muted">{new Date(entry.occurredAt).toLocaleString()}</time><span className="text-xs uppercase tracking-wide">{entry.kind}</span><span>{entry.label} · {entry.detail}</span></li>)}</ol> : <p className="mt-4 text-sm text-ink-muted">No activity in this source.</p>}
    </section>
  </div>;
}
