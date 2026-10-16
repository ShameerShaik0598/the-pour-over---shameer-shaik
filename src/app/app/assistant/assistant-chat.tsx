"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { maskEmail } from "@/lib/privacy";
import { SUGGESTED_PROMPTS } from "@/lib/ai/planner";
import type { AssistantPlan } from "@/lib/ai/schema";
import type { AssistantAnswer } from "@/lib/ai/execute";

type AssistantResult = AssistantAnswer & { plan: AssistantPlan; redactedMessage: string; modelWasCalled: boolean; provider: string; assumptions: string[] };
type Turn = { question: string; result?: AssistantResult; error?: string };

export function AssistantChat() {
  const [message, setMessage] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [showEmails, setShowEmails] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  async function ask(question: string) {
    if (!question.trim() || busy) return;
    setBusy(true); setMessage(""); setSaveMessage("");
    setTurns((current) => [...current, { question }]);
    const response = await fetch("/api/assistant", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: question }) });
    const payload = await response.json() as AssistantResult & { error?: string };
    if (response.ok) setTurns((current) => current.map((turn, index) => index === current.length - 1 ? { ...turn, result: payload } : turn));
    else setTurns((current) => current.map((turn, index) => index === current.length - 1 ? { ...turn, error: payload.error ?? "Assistant request failed." } : turn));
    setBusy(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); await ask(message);
  }

  async function saveSegment(segment: NonNullable<AssistantResult["segment"]>) {
    const response = await fetch("/api/segments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: segment.name, filter: segment.filter }) });
    const payload = await response.json() as { error?: string };
    setSaveMessage(response.ok ? `Saved “${segment.name}”. Find it in Segments.` : payload.error ?? "Could not save segment.");
  }

  return <div className="mt-8 max-w-4xl">
    <div className="flex flex-wrap gap-2">{SUGGESTED_PROMPTS.map((prompt) => <button key={prompt} disabled={busy} onClick={() => void ask(prompt)} className="min-h-10 border border-line px-3 py-2 text-left text-sm hover:bg-paper-2">{prompt}</button>)}</div>
    <ol className="mt-8 space-y-6">{turns.map((turn, index) => <li key={`${turn.question}-${index}`} className="border-t border-line pt-4"><p className="text-sm font-medium">{turn.question}</p>
      {turn.error ? <p role="alert" className="mt-3 text-sm text-danger">{turn.error}</p> : turn.result ? <article className="mt-4 border-l-2 border-accent pl-4">
        <p className="text-ink-muted">{turn.result.answer}</p>
        <p className="mt-2 text-xs uppercase tracking-wide text-ink-muted">Answered by {turn.result.provider === "gemini" ? "Gemini plan" : turn.result.provider === "suggested_cache" ? "cached plan" : "rules engine"}</p>
        {turn.result.kind === "metric" && <div className="mt-4"><p className="stat-figure">{turn.result.count?.toLocaleString()}</p>{turn.result.breakdown && <ul className="mt-3 flex flex-wrap gap-4">{turn.result.breakdown.map((item) => <li key={item.label} className="border-t border-line pt-2 text-sm">{item.label.replaceAll("_", " ")}: <strong>{item.value}</strong></li>)}</ul>}</div>}
        {turn.result.kind === "table" && turn.result.table && <div className="mt-4 overflow-x-auto border-y border-line"><table className="w-full text-left text-sm"><thead><tr><th className="py-2">Group</th><th className="py-2">Readers</th></tr></thead><tbody>{turn.result.table.map((row) => <tr key={row.label} className="border-t border-line"><td className="py-2">{row.label}</td><td className="py-2">{row.value}</td></tr>)}</tbody></table></div>}
        {(turn.result.kind === "segment" || turn.result.rows) && <div className="mt-4"><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm">{turn.result.count?.toLocaleString()} readers match.</p><button className="min-h-9 underline text-sm" onClick={() => setShowEmails((value) => !value)}>{showEmails ? "Mask emails" : "Reveal emails"}</button></div>
          {turn.result.segment && <div className="mt-2 flex items-center justify-between gap-3 border-y border-line py-3"><span className="font-medium">{turn.result.segment.name}</span><button onClick={() => void saveSegment(turn.result!.segment!)} className="min-h-10 bg-ink px-3 text-paper">Save segment</button></div>}
          <ul className="mt-2 divide-y divide-line">{(turn.result.segment?.rows ?? turn.result.rows ?? []).map((row) => <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"><span>{showEmails ? row.email : maskEmail(row.email)}</span><span>{row.source} · score {row.engagementScore}</span><Link href={`/app/lookup/subscriber/${row.id}`} className="underline">Profile</Link></li>)}</ul>
        </div>}
        {turn.result.plan.filter && <div className="mt-4"><p className="section-label">FILTERS USED</p><div className="mt-2 flex flex-wrap gap-2">{Object.entries(turn.result.plan.filter).map(([key, value]) => <span key={key} className="border border-line px-2 py-1 text-xs">{key.replaceAll("_", " ")}: {Array.isArray(value) ? value.join(" – ") : String(value)}</span>)}</div></div>}
        {turn.result.assumptions.length > 0 && <div className="mt-4"><p className="section-label">ASSUMPTIONS</p><ul className="mt-1 list-disc pl-5 text-sm text-ink-muted">{turn.result.assumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}</ul></div>}
        <details className="mt-4 border-t border-line pt-3"><summary className="min-h-10 cursor-pointer font-medium">What the model saw</summary><div className="mt-2 space-y-3 text-sm"><p className="text-ink-muted">{turn.result.modelWasCalled ? "Exact redacted question sent to the model:" : "No external model request was made; this answer came from the rules engine. Redacted question:"}</p><pre className="overflow-x-auto whitespace-pre-wrap border border-line bg-paper-2 p-3">{turn.result.redactedMessage}</pre><p className="section-label">VALIDATED PLAN</p><pre className="overflow-x-auto border border-line bg-paper-2 p-3">{JSON.stringify(turn.result.plan, null, 2)}</pre></div></details>
      </article> : null}</li>)}</ol>
    {busy && <p role="status" className="mt-5 text-sm text-ink-muted">Reading the question…</p>}
    {saveMessage && <p role="status" className="mt-3 text-sm text-ink-muted">{saveMessage}</p>}
    <form onSubmit={submit} className="mt-8 border-y border-line py-4"><label htmlFor="assistant-question" className="section-label">ASK ABOUT YOUR READERS</label><textarea id="assistant-question" value={message} onChange={(event) => setMessage(event.currentTarget.value)} maxLength={500} rows={3} placeholder="Ask a count, build a segment, or explore a trend…" className="mt-2 w-full resize-y border border-line bg-transparent p-3" /><div className="mt-3 flex items-center justify-between gap-4"><span className="text-xs text-ink-muted">{message.length} / 500</span><button disabled={busy || !message.trim()} className="min-h-11 bg-ink px-5 text-paper disabled:opacity-50">{busy ? "Working…" : "Ask Carafe"}</button></div></form>
  </div>;
}
