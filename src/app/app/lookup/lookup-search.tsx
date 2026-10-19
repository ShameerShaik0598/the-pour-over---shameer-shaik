"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { maskEmail } from "@/lib/privacy";

type SearchHit = { type: "subscriber" | "app" | "visitor"; id: string; email: string | null; status: string | null; label: string };
type RecruiterExample = { id: string; maskedEmail: string; status: string; source: string };

export function LookupSearch({ examples }: { examples: RecruiterExample[] }) {
  const [results, setResults] = useState<SearchHit[]>([]);
  const [showEmail, setShowEmail] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sampleId, setSampleId] = useState("");

  async function searchRequest(payload: { query: string } | { sampleId: string }) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/profiles/search", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json().catch(() => null) as { results?: SearchHit[]; error?: string } | null;
      setResults(data?.results ?? []);
      setMessage(response.ok ? (data?.results?.length ? `${data.results.length} result${data.results.length === 1 ? "" : "s"}` : "No reader found.") : data?.error ?? "Search failed. Please try again.");
    } catch {
      setResults([]);
      setMessage("Could not reach the reader service. Check that Carafe is running, then try again.");
    } finally {
      setBusy(false);
    }
  }

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const query = form.get("query");
    if (typeof query === "string") await searchRequest({ query });
  }

  return <section className="mt-8 max-w-3xl">
    <form onSubmit={search} className="flex flex-col gap-3 sm:flex-row">
      <label htmlFor="reader-query" className="sr-only">Email fragment, visitor ID, app user ID, or device ID</label>
      <input id="reader-query" name="query" required minLength={3} maxLength={200} placeholder="Email, visitor ID, app user ID, or device ID" className="min-h-12 min-w-0 flex-1 border border-line bg-transparent px-3" />
      <button disabled={busy} className="min-h-12 bg-ink px-6 text-paper disabled:opacity-60">{busy ? "Searching…" : "Find reader"}</button>
    </form>
    <p className="mt-2 text-sm text-ink-muted">Queries are sent in the request body and do not appear in the URL.</p>
    <div className="mt-7 grid gap-3 border-y border-line py-5 sm:grid-cols-[1fr_auto] sm:items-end">
      <label htmlFor="recruiter-sample" className="text-sm">Five masked emails for recruiter testing
        <select id="recruiter-sample" value={sampleId} onChange={(event) => setSampleId(event.target.value)} className="mt-2 min-h-12 w-full border border-line bg-paper px-3">
          <option value="">Choose a masked sample</option>
          {examples.map((example) => <option key={example.id} value={example.id}>{example.maskedEmail} · {example.status} · {example.source}</option>)}
        </select>
      </label>
      <button type="button" disabled={!sampleId || busy} onClick={() => void searchRequest({ sampleId })} className="min-h-12 bg-ink px-5 text-paper disabled:opacity-60">{busy ? "Searching…" : "Search selected email"}</button>
    </div>
    <p className="mt-2 text-sm text-ink-muted">Examples stay masked while searching. Open a matching profile to view its full reader record.</p>
    <div className="mt-7 flex items-center justify-between gap-4"><h2 className="font-display text-2xl">Matches</h2><button type="button" className="min-h-10 underline" onClick={() => setShowEmail((value) => !value)} aria-pressed={showEmail}>{showEmail ? "Mask emails" : "Reveal emails"}</button></div>
    {message && <p role="status" className="mt-2 text-sm text-ink-muted">{message}</p>}
    <ul className="mt-3 divide-y divide-line border-y border-line">
      {results.map((hit) => <li key={`${hit.type}-${hit.id}`} className="flex flex-col justify-between gap-2 py-4 sm:flex-row sm:items-center">
        <div><p className="font-medium">{showEmail && hit.email ? hit.email : maskEmail(hit.email)}</p><p className="mt-1 text-sm text-ink-muted">{hit.label}{hit.status ? ` · ${hit.status}` : ""}</p></div>
        <Link prefetch={false} className="min-h-10 inline-flex items-center" href={`/app/lookup/${hit.type}/${hit.id}`}>Open full profile <span aria-hidden="true" className="ml-2">→</span></Link>
      </li>)}
    </ul>
  </section>;
}
