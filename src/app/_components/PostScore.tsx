"use client";

import { useEffect, useState, type FormEvent } from "react";
import ShareButtons from "./ShareButtons";
import SignIn from "./SignIn";
import Turnstile from "./Turnstile";
import { formatScore } from "@/lib/room";
import { ROUND, fmtHaunt, rewardFor } from "@/lib/rewards";
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

/** Where a finished run's ticket waits while the player signs in with X (a full page trip to x.com and back). */
export const ticketKey = (runId: string) => `haunt:run:${runId}`;

/** Sign in, nickname, payout wallet and bot check, then the scorecard once the time is posted. */
export default function PostScore({ runId, ticket }: { runId: string; ticket: string }) {
  const [me, setMe] = useState<Me | null>(null);
  const [name, setName] = useState(savedName);
  const [wallet, setWallet] = useState("");
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
    try {
      sessionStorage.setItem(ticketKey(runId), ticket);
    } catch {}
  }, [runId, ticket]);

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

  async function submit(e: FormEvent) {
    e.preventDefault();
    const res = await send("/api/score", { ticket, name, wallet, cf });
    if (!res) return;
    try {
      localStorage.setItem(NAME_KEY, res.name);
      sessionStorage.removeItem(ticketKey(runId));
    } catch {}
    setScore(res);
  }

  if (score) {
    return (
      <>
        <p className="rank-line">
          {score.roundRank ? <><b>#{score.roundRank}</b> in {ROUND.name} · </> : null}<b>#{score.rank}</b> all time
        </p>
        {score.roundRank && rewardFor(score.roundRank) > 0 && (
          <p className="reward-line">
            Currently in a winning spot: {fmtHaunt(rewardFor(score.roundRank))}. <a href="/rewards">Winners claim at launch.</a>
          </p>
        )}
        {!score.eligible && <p className="muted">Your X account is too new or too small to win $HAUNT, but your time still counts.</p>}
        {/* eslint-disable-next-line @next/next/no-img-element -- a generated PNG, not a static asset */}
        <img className="scorecard" src={`/api/card/${score.id}`} width={1200} height={630} alt={`Scorecard: ${score.name} escaped in ${formatScore(score.ms)}`} />
        <ShareButtons id={score.id} ms={score.ms} />
      </>
    );
  }

  if (!me) return <p className="muted">Opening the guest book...</p>;

  const bot = TURNSTILE_SITE_KEY ? <Turnstile siteKey={TURNSTILE_SITE_KEY} onToken={setCf} /> : null;

  if (!me.account) {
    return <SignIn mode={me.mode} next={`/claim/${runId}`} lead={`The top 5 each win ${fmtHaunt(50_000)}. Enter your X username so we know who you are.`} onSignedIn={loadMe} />;
  }

  return (
    <form className="name-form" onSubmit={submit}>
      <p className="form-note">
        Signed in as <b>@{me.account.handle}</b>.
      </p>
      <label htmlFor="nick">Nickname on the board</label>
      <input id="nick" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your nickname" maxLength={16} minLength={2} required autoComplete="nickname" autoCapitalize="off" spellCheck={false} />
      <label htmlFor="wallet">Wallet for $HAUNT rewards (kept private)</label>
      <input id="wallet" className="input input-mono" value={wallet} onChange={(e) => setWallet(e.target.value)} placeholder="0x..." required autoCapitalize="off" spellCheck={false} />
      {bot}
      <button className="btn btn-green" disabled={busy || (Boolean(TURNSTILE_SITE_KEY) && !cf)}>{busy ? "Posting..." : "Post my time"}</button>
      {error && <p className="form-error">{error}</p>}
    </form>
  );
}
