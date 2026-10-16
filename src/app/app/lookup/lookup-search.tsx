"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { maskEmail } from "@/lib/privacy";

type SearchHit = { type: "subscriber" | "app" | "visitor"; id: string; email: string | null; status: string | null; label: string };

export function LookupSearch() {
  const [results, setResults] = useState<SearchHit[]>([]);
  const [showEmail, setShowEmail] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/profiles/search", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query: form.get("query") }) });
    const data = await response.json() as { results?: SearchHit[]; error?: string };
    setResults(data.results ?? []); setMessage(response.ok ? (data.results?.length ? `${data.results.length} result${data.results.length === 1 ? "" : "s"}` : "No reader found.") : data.error ?? "Search failed.");
    setBusy(false);
  }

  return <section className="mt-8 max-w-3xl">
    <form onSubmit={search} className="flex flex-col gap-3 sm:flex-row">
      <label htmlFor="reader-query" className="sr-only">Email fragment, visitor ID, app user ID, or device ID</label>
      <input id="reader-query" name="query" required minLength={3} maxLength={200} placeholder="Email, visitor ID, app user ID, or device ID" className="min-h-12 min-w-0 flex-1 border border-line bg-transparent px-3" />
      <button disabled={busy} className="min-h-12 bg-ink px-6 text-paper disabled:opacity-60">{busy ? "Searching…" : "Find reader"}</button>
    </form>
    <p className="mt-2 text-sm text-ink-muted">Queries are sent in the request body and do not appear in the URL.</p>
    <div className="mt-7 flex items-center justify-between gap-4"><h2 className="font-display text-2xl">Matches</h2><button type="button" className="min-h-10 underline" onClick={() => setShowEmail((value) => !value)} aria-pressed={showEmail}>{showEmail ? "Mask emails" : "Reveal emails"}</button></div>
    {message && <p role="status" className="mt-2 text-sm text-ink-muted">{message}</p>}
    <ul className="mt-3 divide-y divide-line border-y border-line">
      {results.map((hit) => <li key={`${hit.type}-${hit.id}`} className="flex flex-col justify-between gap-2 py-4 sm:flex-row sm:items-center">
        <div><p className="font-medium">{showEmail && hit.email ? hit.email : maskEmail(hit.email)}</p><p className="mt-1 text-sm text-ink-muted">{hit.label}{hit.status ? ` · ${hit.status}` : ""}</p></div>
        <Link className="min-h-10 inline-flex items-center" href={`/app/lookup/${hit.type}/${hit.id}`}>Open profile <span aria-hidden="true" className="ml-2">→</span></Link>
      </li>)}
    </ul>
  </section>;
}
