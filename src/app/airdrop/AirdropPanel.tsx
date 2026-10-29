"use client";

import { useEffect, useState, type FormEvent } from "react";
import ClaimPanel from "../_components/ClaimPanel";
import SignIn from "../_components/SignIn";
import Turnstile from "../_components/Turnstile";
import { ALLOCATION, CLAIM_CONTRACT, CLAIM_OPEN, MAX_APPROVED, shortAddress, type AppStatus, type Claim } from "@/lib/airdrop";
import { TURNSTILE_SITE_KEY } from "@/lib/site";

type Me = {
  mode: "x" | "handle";
  account: { handle: string; verified: boolean; eligible: boolean } | null;
  app: { handle: string; wallet: string; status: AppStatus; appliedAt: number } | null;
  frozen: boolean;
  applicationsOpen: boolean;
  closesAt: string;
  merkleRoot: string | null;
  claim: Claim | null;
};

const fmt = (n: number) => n.toLocaleString("en-US");
const STATUS_TEXT: Record<AppStatus, string> = { pending: "Application received", approved: "Approved", rejected: "Not approved" };

function Check({ done, label, detail }: { done: boolean; label: string; detail?: React.ReactNode }) {
  return (
    <li className={`check${done ? " check-done" : ""}`}>
      <span className="check-mark" aria-hidden="true">{done ? "✓" : ""}</span>
      <span className="check-label">{label}</span>
      {detail && <span className="check-detail">{detail}</span>}
    </li>
  );
}

/** The airdrop page: application, allocation details and claim status, in that order. */
export default function AirdropPanel() {
  const [me, setMe] = useState<Me | null>(null);
  const [wallet, setWallet] = useState("");
  const [editing, setEditing] = useState(false);
  const [cf, setCf] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function load() {
    return fetch("/api/airdrop/me", { cache: "no-store" })
      .then((r) => r.json())
      .then(setMe)
      .catch(() => setError("Couldn't reach the crypt. Refresh to try again."));
  }

  useEffect(() => {
    load();
  }, []);

  async function apply(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/airdrop/apply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ wallet, cf }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Something went wrong.");
      setEditing(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const app = me?.app ?? null;
  const approved = app?.status === "approved";

  let step: React.ReactNode = null;
  if (!me) step = <p className="muted">{error || "Opening the crypt..."}</p>;
  else if (!me.account) step = <SignIn mode={me.mode} next="/airdrop" lead="One application per X account." onSignedIn={load} />;
  else if ((!app && me.applicationsOpen) || (editing && me.applicationsOpen)) {
    step = (
      <form className="name-form" onSubmit={apply}>
        <label htmlFor="rh-wallet">Your Robinhood Chain wallet address</label>
        <input id="rh-wallet" className="input input-mono" value={wallet} onChange={(e) => setWallet(e.target.value)} placeholder="0x..." required autoCapitalize="off" spellCheck={false} />
        <p className="muted">Your {fmt(ALLOCATION)} $HAUNT goes here if you&apos;re approved, and it&apos;s the wallet you connect to claim. One application per wallet.</p>
        {TURNSTILE_SITE_KEY && <Turnstile siteKey={TURNSTILE_SITE_KEY} onToken={setCf} />}
        <div className="panel-actions" style={{ justifyContent: "flex-start" }}>
          <button className="btn btn-green" disabled={busy || (Boolean(TURNSTILE_SITE_KEY) && !cf)}>{busy ? "Sending..." : app ? "Save wallet" : "Submit application"}</button>
          {editing && <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>Cancel</button>}
        </div>
        {error && <p className="form-error">{error}</p>}
      </form>
    );
  } else if (!app) step = <p>Applications are closed. They closed 2 hours before Halloween.</p>;
  else if (app.status === "pending") {
    step = (
      <div className="status-box">
        <p>We&apos;re reviewing every application. Check back here for your result.</p>
        {me.applicationsOpen && (
          <button className="btn btn-sm btn-ghost" onClick={() => { setWallet(app.wallet); setEditing(true); }}>Change wallet</button>
        )}
      </div>
    );
  } else if (app.status === "rejected") {
    step = <p>Your application wasn&apos;t approved this time. The mansion is still open: the fastest souls can still win $HAUNT in the game.</p>;
  }

  return (
    <div className="ad-grid">
      <section className="ad-card" aria-labelledby="ad-apply">
        <h2 id="ad-apply" className="ad-title"><span className="ad-num">1</span> Airdrop application</h2>
        <ul className="checks">
          <Check done={Boolean(me?.account)} label="Sign in with X" detail={me?.account && <>@{me.account.handle}{!me.account.verified && " (preview, not verified)"}</>} />
          <Check done={Boolean(app)} label="Submit your wallet" detail={app && <span className="mono-inline">{shortAddress(app.wallet)}</span>} />
          <Check
            done={Boolean(app)}
            label="Application status"
            detail={<span className={`status-pill status-${app?.status ?? "none"}`}>{app ? STATUS_TEXT[app.status] : "Not applied yet"}</span>}
          />
        </ul>
        {step}
        {me?.applicationsOpen && (
          <p className="fine">Applications close {new Date(me.closesAt).toUTCString().replace(":00 GMT", " UTC")}, 2 hours before Halloween.</p>
        )}
      </section>

      <section className="ad-card" aria-labelledby="ad-alloc">
        <h2 id="ad-alloc" className="ad-title"><span className="ad-num">2</span> Allocation details</h2>
        <dl className="facts">
          <div><dt>Approved users</dt><dd>{fmt(MAX_APPROVED)}</dd></div>
          <div><dt>Each receives</dt><dd>{fmt(ALLOCATION)} $HAUNT</dd></div>
          <div><dt>Chain</dt><dd>Robinhood Chain</dd></div>
        </dl>
        {approved && (
          <div className="allocation">
            <span className="allocation-num spooky">{fmt(ALLOCATION)}</span>
            <span className="allocation-unit">$HAUNT is yours</span>
          </div>
        )}
      </section>

      <section className="ad-card" aria-labelledby="ad-claim">
        <h2 id="ad-claim" className="ad-title"><span className="ad-num">3</span> Claim status</h2>
        {approved && me?.claim && me.merkleRoot ? (
          <ClaimPanel claim={me.claim} root={me.merkleRoot} contract={CLAIM_CONTRACT} open={CLAIM_OPEN} amountLabel={`${fmt(ALLOCATION)} $HAUNT`} />
        ) : (
          <div className="claim-box">
            <button className="btn btn-green btn-big" disabled>Claim disabled</button>
            <p className="muted">Disabled until launch and claims open. Approved users connect the same wallet they applied with and claim once.</p>
          </div>
        )}
      </section>
    </div>
  );
}
