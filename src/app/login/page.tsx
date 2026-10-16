"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: form.get("username"), password: form.get("password") }) });
    if (response.ok) router.push("/app"); else setError("Those credentials did not match.");
    setBusy(false);
  }
  return <main id="main" className="page-shell grid min-h-screen place-items-center py-10"><section className="w-full max-w-md"><p className="section-label">THE POUR OVER · READER EDITION</p><h1 className="mt-3 font-display text-5xl">Welcome back.</h1><p className="mt-3 text-ink-muted">Sign in to the Carafe reader desk.</p><form onSubmit={login} className="mt-8 space-y-5 border-y border-line py-6"><label className="block text-sm">Username<input required autoComplete="username" name="username" className="mt-2 min-h-12 w-full border border-line bg-transparent px-3" /></label><label className="block text-sm">Password<input required autoComplete="current-password" type="password" name="password" className="mt-2 min-h-12 w-full border border-line bg-transparent px-3" /></label><button disabled={busy} className="min-h-12 bg-ink px-5 text-paper disabled:opacity-60">{busy ? "Signing in…" : "Sign in"}</button>{error && <p role="alert" className="text-danger">{error}</p>}</form><a href="/" className="mt-5 inline-block">Back to Carafe</a></section></main>;
}
