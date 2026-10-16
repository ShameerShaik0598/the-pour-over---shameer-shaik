import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Masthead, StatFigure } from "@/components/ui";
import { readSession, sessionCookieName } from "@/lib/auth";

export default async function OverviewPage() {
  const session = await readSession((await cookies()).get(sessionCookieName)?.value);
  if (!session) redirect("/login");
  return <main id="main"><Masthead /><div className="page-shell py-10"><p className="section-label">MONDAY, SEPTEMBER 28, 2026 · OVERVIEW</p><div className="mt-2 flex flex-wrap items-end justify-between gap-4"><h2 className="font-display text-4xl sm:text-5xl">Good morning, {session.role}.</h2><form action="/api/auth/logout" method="post"><button className="min-h-11 border border-line px-4">Sign out</button></form></div><p className="mt-3 text-ink-muted">The reader desk is ready. Seeded data and relationship insights arrive in the next milestones.</p><div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-4"><StatFigure value="—" label="Readers"/><StatFigure value="—" label="Active"/><StatFigure value="—" label="Cold"/><StatFigure value="—" label="Linked visits"/></div><section className="mt-12 border-t border-line pt-6"><p className="section-label">YOUR ROLE</p><p className="mt-2">Signed in as <strong>{session.username}</strong> ({session.role}).</p></section></div></main>;
}
