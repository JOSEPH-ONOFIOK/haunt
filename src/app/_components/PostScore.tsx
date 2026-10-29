"use client";

import { useEffect, useState, type FormEvent } from "react";
import ShareButtons from "./ShareButtons";
import Turnstile from "./Turnstile";
import { formatScore } from "@/lib/room";
import { TURNSTILE_SITE_KEY } from "@/lib/site";
import type { PublicScore } from "@/lib/store";

type Me = { mode: "x" | "handle"; account: { handle: string; verified: boolean; eligible: boolean; wallet: string } | null };
const NAME_KEY = "haunt:name";

function savedName() {
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

/** Sign in, nickname, payout wallet and bot check, then the scorecard once the time is posted. */
export default function PostScore({ runId }: { runId: string }) {
  const [me, setMe] = useState<Me | null>(null);
  const [name, setName] = useState(savedName);
  const [wallet, setWallet] = useState("");
  const [handle, setHandle] = useState("");
  const [cf, setCf] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [score, setScore] = useState<(PublicScore & { eligible: boolean }) | null>(null);

  function loadMe() {
    return fetch("/api/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((m: Me) => {
        setMe(m);
        if (m.account) {
          setWallet((w) => w || m.account!.wallet);
          setName((n) => n || m.account!.handle);
        }
      })
      .catch(() => setMe({ mode: "handle", account: null }));
  }

  useEffect(() => {
    loadMe();
  }, []);

  async function send(url: string, data: object) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Something went wrong.");
      return json;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function signInHandle(e: FormEvent) {
    e.preventDefault();
    if (await send("/api/auth/handle", { handle, cf })) await loadMe();
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const res = await send("/api/score", { id: runId, name, wallet, cf });
    if (!res) return;
    try {
      localStorage.setItem(NAME_KEY, res.name);
    } catch {}
    setScore(res);
  }

  if (score) {
    return (
      <>
        <p className="rank-line">
          <b>#{score.dayRank}</b> today · <b>#{score.rank}</b> all time
        </p>
        {!score.eligible && <p className="muted">Your X account is too new or too small to win prizes, but your time still counts.</p>}
        {/* eslint-disable-next-line @next/next/no-img-element -- a generated PNG, not a static asset */}
        <img className="scorecard" src={`/api/card/${score.id}`} width={1200} height={630} alt={`Scorecard: ${score.name} escaped in ${formatScore(score.ms)}`} />
        <ShareButtons id={score.id} ms={score.ms} />
      </>
    );
  }

  if (!me) return <p className="muted">Opening the guest book...</p>;

  const bot = TURNSTILE_SITE_KEY ? <Turnstile siteKey={TURNSTILE_SITE_KEY} onToken={setCf} /> : null;

  if (!me.account) {
    return me.mode === "x" ? (
      <div className="name-form">
        <p className="form-note">Prizes go to the fastest souls. Sign in with X so we know who you are.</p>
        <a className="btn btn-green" href={`/api/auth/x/start?next=${encodeURIComponent(`/claim/${runId}`)}`}>Sign in with X to post</a>
      </div>
    ) : (
      <form className="name-form" onSubmit={signInHandle}>
        <label htmlFor="xh">Your X handle (preview mode, not verified)</label>
        <div className="name-row">
          <input id="xh" className="input" value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@yourhandle" required autoCapitalize="off" spellCheck={false} />
          <button className="btn btn-green" disabled={busy}>{busy ? "..." : "Continue"}</button>
        </div>
        {bot}
        {error && <p className="form-error">{error}</p>}
      </form>
    );
  }

  return (
    <form className="name-form" onSubmit={submit}>
      <p className="form-note">
        Signed in as <b>@{me.account.handle}</b>. Winners are checked before prizes are sent.
      </p>
      <label htmlFor="nick">Nickname on the board</label>
      <input id="nick" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your nickname" maxLength={16} minLength={2} required autoComplete="nickname" autoCapitalize="off" spellCheck={false} />
      <label htmlFor="wallet">Wallet for prizes (kept private)</label>
      <input id="wallet" className="input input-mono" value={wallet} onChange={(e) => setWallet(e.target.value)} placeholder="0x..." required autoCapitalize="off" spellCheck={false} />
      {bot}
      <button className="btn btn-green" disabled={busy || (Boolean(TURNSTILE_SITE_KEY) && !cf)}>{busy ? "Posting..." : "Post my time"}</button>
      {error && <p className="form-error">{error}</p>}
    </form>
  );
}
