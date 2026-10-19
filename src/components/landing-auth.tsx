"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function LandingAuth({ username, password }: { username: string; password: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: form.get("username"), password: form.get("password") }) });
    if (response.ok) router.push("/app"); else { setMessage("Those credentials did not match."); setBusy(false); }
  }
  async function openDemo() {
    setBusy(true); setMessage("");
    const response = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, password }) });
    if (response.ok) router.push("/app"); else { setMessage("The demo sign-in is not configured. Use Sign in below."); setBusy(false); }
  }
  async function copy(value: string, label: string) {
    try { await navigator.clipboard.writeText(value); setMessage(`${label} copied.`); }
    catch { setMessage(`Copy is unavailable. Select the ${label.toLowerCase()} text to copy it.`); }
  }
  return <div className="landing-auth">
    <div className="landing-auth-actions mt-6 flex flex-wrap gap-3"><button onClick={() => void openDemo()} disabled={busy} className="min-h-12 bg-ink px-5 text-paper disabled:opacity-60">{busy ? "Opening demo…" : "Open recruiter demo"}</button><a href="#login" className="min-h-12 inline-flex items-center border border-line px-5">Recruiter access</a></div>
    {message && <p className="mt-3 text-sm" role="status">{message}</p>}
    <section id="login" className="landing-login-card mt-8 scroll-mt-8" aria-labelledby="demo-login-title">
      <div className="landing-login-heading"><p className="section-label">RECRUITER ACCESS · READ-ONLY</p><h2 id="demo-login-title" className="mt-2 font-display text-3xl">Take the morning edition for a spin.</h2><p className="mt-2 text-sm text-ink-muted">Use the local demo seat or enter another account below.</p></div>
      <div className="landing-credentials mt-5"><div className="landing-credential-row"><span><span className="block text-xs text-ink-muted">Username</span><code>{username || "Not configured"}</code></span><button aria-label="Copy recruiter username" disabled={!username} onClick={() => void copy(username, "Username")} className="min-h-11 px-2 text-sm underline">Copy</button></div><div className="landing-credential-row"><span><span className="block text-xs text-ink-muted">Password</span><code>{password || "Not configured"}</code></span><button aria-label="Copy recruiter password" disabled={!password} onClick={() => void copy(password, "Password")} className="min-h-11 px-2 text-sm underline">Copy</button></div></div>
      <form onSubmit={signIn} className="landing-signin-form mt-5 border-t border-line pt-4"><label className="text-sm">Username<input required autoComplete="username" name="username" className="mt-2 min-h-12 w-full border border-line bg-transparent px-3" /></label><label className="text-sm">Password<input required autoComplete="current-password" type="password" name="password" className="mt-2 min-h-12 w-full border border-line bg-transparent px-3" /></label><button disabled={busy} className="min-h-12 w-full bg-ink px-5 text-paper disabled:opacity-60">Sign in to Carafe</button></form>
    </section>
  </div>;
}
