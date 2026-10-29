"use client";

import { useState, type FormEvent } from "react";
import Turnstile from "./Turnstile";
import { XIcon } from "./art";
import { TURNSTILE_SITE_KEY } from "@/lib/site";

const AUTH_ERRORS: Record<string, string> = {
  cancelled: "Sign in was cancelled on X.",
  expired: "That sign in took too long. Please try again.",
  x_failed: "X didn't confirm your account. Please try again.",
  unavailable: "Sign in with X isn't set up yet. Check back soon.",
  rate_limited: "Too many sign in attempts. Try again in a few minutes.",
  bot_check: "The bot check failed. Please try again.",
};

/**
 * The player types their X username (mode "handle", the default), or, if the site is switched to it,
 * Sign in with X: bot check, then off to X and back to `next`. onSignedIn runs after a typed username is accepted.
 */
export default function SignIn({ mode, next, lead, onSignedIn }: { mode: "x" | "handle"; next: string; lead: string; onSignedIn: () => void }) {
  const [handle, setHandle] = useState("");
  const [cf, setCf] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // X sends people back with ?auth_error=... when something went wrong. This form only renders in the
  // browser (after the session check), so reading the address bar up front is safe.
  const [error, setError] = useState(() => {
    const code = typeof window === "undefined" ? null : new URLSearchParams(location.search).get("auth_error");
    return code ? (AUTH_ERRORS[code] ?? "Sign in didn't work. Please try again.") : "";
  });

  const bot = TURNSTILE_SITE_KEY ? <Turnstile siteKey={TURNSTILE_SITE_KEY} onToken={setCf} /> : null;
  const botPending = Boolean(TURNSTILE_SITE_KEY) && !cf;

  if (mode === "x") {
    const go = () => {
      setBusy(true);
      const q = new URLSearchParams({ next });
      if (cf) q.set("cf", cf);
      // Full page navigation: the route handler redirects to X's consent screen
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      location.assign(`/api/auth/x/start?${q}`);
    };
    return (
      <div className="name-form">
        <p className="form-note">{lead}</p>
        {bot}
        <button className="btn btn-x btn-big" onClick={go} disabled={busy || botPending}>
          <span className="btn-icon btn-icon-lg"><XIcon /></span> {busy ? "Opening X..." : "Sign in with X"}
        </button>
        <p className="fine">🔒 We only read your public profile. We never post for you.</p>
        {error && <p className="form-error">{error}</p>}
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
      <label htmlFor="xh">Your X username</label>
      <div className="name-row">
        <input id="xh" className="input" value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@yourusername" required autoCapitalize="off" autoComplete="username" spellCheck={false} maxLength={16} />
        <button className="btn btn-green" disabled={busy || botPending}>{busy ? "..." : "Continue"}</button>
      </div>
      <p className="fine">Use your real X username. Your allocation and card are tied to it.</p>
      {bot}
      {error && <p className="form-error">{error}</p>}
    </form>
  );
}
