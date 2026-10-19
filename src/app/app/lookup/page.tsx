import { Masthead } from "@/components/ui";
import { AppNavigation } from "@/components/app-navigation";
import { LookupSearch } from "./lookup-search";
import { db } from "@/lib/db";
import { getRecruiterLookupExamples } from "@/lib/profile";

export const dynamic = "force-dynamic";

export default async function LookupPage() {
  const examples = await getRecruiterLookupExamples(db);
  return <main id="main"><Masthead title="Find a reader" /><AppNavigation /><div className="page-shell py-9"><p className="section-label">READER DESK · LOOKUP</p><h2 className="mt-2 font-display text-4xl">One reader, across channels.</h2><p className="mt-3 max-w-2xl text-ink-muted">Search a newsletter email, site visitor, app user, or device. Search results mask email addresses until you choose to reveal them.</p><LookupSearch examples={examples} /></div></main>;
}
