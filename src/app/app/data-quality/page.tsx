import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppNavigation } from "@/components/app-navigation";
import { DataTable, EmptyState, Masthead } from "@/components/ui";
import { db } from "@/lib/db";
import { getOverviewData } from "@/lib/dashboard";
import { readSession, sessionCookieName } from "@/lib/session";

export default async function DataQualityPage() {
  const session = await readSession((await cookies()).get(sessionCookieName)?.value);
  if (!session) redirect("/login");
  const { dataQuality } = await getOverviewData(db);
  return <main id="main"><Masthead title="Data quality" /><AppNavigation /><div className="page-shell py-9">
    <p className="section-label">OPERATIONS · DATA QUALITY</p><h2 className="mt-2 font-display text-4xl">Clean inputs. Clear decisions.</h2>
    <div className="mt-8 grid grid-cols-2 gap-5 md:grid-cols-4">{[[dataQuality.quarantined.length, "Quarantined rows"], [dataQuality.duplicatesMerged, "Duplicate rows merged"], [dataQuality.unlinkedVisitors, "Unlinked visitors"], [dataQuality.identityConflicts, "Identity conflicts"]].map(([value, label]) => <section key={label} className="border-t border-line pt-4"><p className="stat-figure">{Number(value).toLocaleString()}</p><p className="mt-2 text-sm text-ink-muted">{label}</p></section>)}</div>
    <section className="mt-12 border-t border-line pt-5"><p className="section-label">QUARANTINE</p><h3 className="mt-2 font-display text-2xl">Rows excluded during ingestion.</h3>
      {dataQuality.quarantined.length ? <DataTable><thead><tr><th className="p-3">Source file</th><th className="p-3">Row</th><th className="p-3">Reason</th></tr></thead><tbody>{dataQuality.quarantined.map((row) => <tr key={row.id} className="border-t border-line"><td className="p-3">{row.sourceFile}</td><td className="p-3 tabular-nums">{row.rowNumber}</td><td className="p-3">{row.reason}</td></tr>)}</tbody></DataTable> : <EmptyState title="No quarantined rows">All imported rows passed validation.</EmptyState>}
      <p className="mt-3 text-xs text-ink-muted">Raw quarantine values are not displayed here.</p>
    </section>
  </div></main>;
}
