"use client";

import { useState, type FormEvent } from "react";
import Turnstile from "./Turnstile";
import { TURNSTILE_SITE_KEY } from "@/lib/site";

/**
 * Sign in with X, or, before the X app is set up, a typed handle (marked unverified).
 * `next` is where X sends the player back to; onSignedIn runs after a typed handle is accepted.
 */
export default function SignIn({ mode, next, lead, onSignedIn }: { mode: "x" | "handle"; next: string; lead: string; onSignedIn: () => void }) {
  const [handle, setHandle] = useState("");
  const [cf, setCf] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (mode === "x") {
    return (
      <div className="name-form">
        <p className="form-note">{lead}</p>
        <a className="btn btn-green" href={`/api/auth/x/start?next=${encodeURIComponent(next)}`}>Sign in with X</a>
      </div>
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/handle", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ handle, cf }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Something went wrong.");
      onSignedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="name-form" onSubmit={submit}>
      <p className="form-note">{lead}</p>
      <label htmlFor="xh">Your X handle (preview mode, not verified)</label>
      <div className="name-row">
        <input id="xh" className="input" value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@yourhandle" required autoCapitalize="off" spellCheck={false} />
        <button className="btn btn-green" disabled={busy}>{busy ? "..." : "Continue"}</button>
      </div>
      {TURNSTILE_SITE_KEY && <Turnstile siteKey={TURNSTILE_SITE_KEY} onToken={setCf} />}
      {error && <p className="form-error">{error}</p>}
    </form>
  );
}
