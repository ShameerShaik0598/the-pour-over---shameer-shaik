import Link from "next/link";
import { LandingAuth } from "@/components/landing-auth";
import { PourScene } from "@/components/pour-scene";
import { Masthead } from "@/components/ui";
import { db } from "@/lib/db";
import { getOverviewData } from "@/lib/dashboard";
import { TODAY_LABEL } from "@/lib/clock";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const { stats } = await getOverviewData(db);
  const rawRows = stats.subscriberRows + stats.duplicatesRemoved + stats.quarantined;
  const linkedPercent = stats.web.rows ? Math.round((stats.web.linkedRows / stats.web.rows) * 100) : 0;
  const steps = [
    { label: "Pull together", value: `${rawRows.toLocaleString()} → ${stats.subscriberRows.toLocaleString()}`, detail: "rows become reader profiles" },
    { label: "Find anyone", value: stats.web.rowsWithEmail.toLocaleString(), detail: "email-captured site visits" },
    { label: "Build a segment", value: stats.engagement.atLeast70.toLocaleString(), detail: "active readers scoring 70+" },
    { label: "Never sleeps", value: `${linkedPercent}%`, detail: "of site visits find a reader" },
    { label: "Talks back", value: stats.app.bothWebAndApp.toLocaleString(), detail: "readers with web and app activity" },
  ];
  return <main id="main">
    <Masthead title="Carafe" eyebrow="THE POUR OVER · READER EDITION" />
    <section className="page-shell grid min-h-[min(760px,calc(100svh-84px))] items-center gap-6 py-10 md:grid-cols-[1.1fr_.9fr] lg:gap-10 lg:py-14">
      <div className="max-w-xl"><p className="section-label">{TODAY_LABEL.toUpperCase()} · A QUIETER WAY TO KNOW YOUR READERS</p><h2 className="mt-5 font-display text-5xl leading-[1.02] sm:text-6xl lg:text-7xl">Every reader,<br/><span className="text-accent-strong">one cup.</span></h2><p className="mt-5 max-w-lg text-lg leading-relaxed text-ink-muted">Newsletter, website, and app activity—brought together into one thoughtful view of the people who read The Pour Over.</p>
        <LandingAuth username={process.env.DEMO_USERNAME ?? ""} password={process.env.DEMO_PASSWORD ?? ""} />
      </div>
      <div className="flex min-w-0 justify-center lg:justify-end"><PourScene /></div>
    </section>
    <section className="border-y border-line bg-paper-2 py-8 sm:py-10"><div className="page-shell"><p className="section-label">FIVE STEPS, ONE READER PICTURE</p><ol className="mt-5 grid gap-x-5 gap-y-6 sm:grid-cols-2 lg:grid-cols-5">{steps.map((step, index) => <li key={step.label} className="border-t border-line pt-3"><p className="section-label">0{index + 1} · {step.label}</p><p className="mt-3 font-display text-3xl tabular-nums">{step.value}</p><p className="mt-1 text-sm text-ink-muted">{step.detail}</p></li>)}</ol></div></section>
    <footer className="page-shell flex flex-col gap-3 py-8 text-sm sm:flex-row sm:items-center sm:justify-between"><p className="text-ink-muted">A local-first reader desk built for The Pour Over.</p><nav aria-label="Project links" className="flex gap-5"><Link href="https://github.com/ShameerShaik0598/the-pour-over---shameer-shaik" target="_blank" rel="noreferrer" className="min-h-11 inline-flex items-center underline">Repository</Link><Link href="https://github.com/ShameerShaik0598/the-pour-over---shameer-shaik/blob/main/README.md" target="_blank" rel="noreferrer" className="min-h-11 inline-flex items-center underline">README</Link></nav></footer>
  </main>;
}
