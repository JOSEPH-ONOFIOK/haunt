"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import ClaimPanel from "../_components/ClaimPanel";
import SignIn from "../_components/SignIn";
import Turnstile from "../_components/Turnstile";
import { XIcon } from "../_components/art";
import { ALLOCATION, CLAIM_CONTRACT, CLAIM_OPEN, TASKS, commentIntent, shortAddress, type AppStatus, type Claim, type TaskId } from "@/lib/airdrop";
import { SITE_URL, TURNSTILE_SITE_KEY, X_HANDLE } from "@/lib/site";

type Me = {
  mode: "x" | "handle";
  account: { handle: string; verified: boolean; eligible: boolean } | null;
  app: { handle: string; wallet: string; status: AppStatus; appliedAt: number; permit: string | null } | null;
  frozen: boolean;
  applicationsOpen: boolean;
  closesAt: string;
  merkleRoot: string | null;
  claim: Claim | null;
};

const fmt = (n: number) => n.toLocaleString("en-US");
const AMOUNT = `${fmt(ALLOCATION)} $HAUNT`;
// A task counts once the player has been over on X for a few seconds and comes back.
const AWAY_MS = 3000;

type Done = Partial<Record<TaskId, number>>;
const tasksKey = (handle: string) => `haunt:tasks:${handle.toLowerCase()}`;
function loadTasks(handle: string): Done {
  try {
    return JSON.parse(localStorage.getItem(tasksKey(handle)) ?? "{}");
  } catch {
    return {};
  }
}

/** The five tasks. Each opens X in a new tab and ticks itself off when the player comes back. */
function Tasks({ handle, done, setDone, locked }: { handle: string; done: Done; setDone: (d: Done) => void; locked: boolean }) {
  const opened = useRef<{ id: TaskId; at: number } | null>(null);

  useEffect(() => {
    const back = () => {
      const o = opened.current;
      if (document.visibilityState !== "visible" || !o || Date.now() - o.at < AWAY_MS) return;
      opened.current = null;
      const next = { ...loadTasks(handle), [o.id]: Date.now() };
      try {
        localStorage.setItem(tasksKey(handle), JSON.stringify(next));
      } catch {}
      setDone(next);
    };
    document.addEventListener("visibilitychange", back);
    window.addEventListener("focus", back);
    return () => {
      document.removeEventListener("visibilitychange", back);
      window.removeEventListener("focus", back);
    };
  }, [handle, setDone]);

  const count = TASKS.filter((t) => done[t.id]).length;
  return (
    <>
      <p className="task-head">Complete 5 tasks to unlock your allocation. <b>{count} / 5</b></p>
      <ol className="tasks">
        {TASKS.map((t, i) => (
          <li key={t.id} className={`task${done[t.id] ? " task-done" : ""}`}>
            <span className="task-num">{String(i + 1).padStart(2, "0")}</span>
            <div className="task-text">
              <b>{t.title}</b>
              <span>{done[t.id] ? `✓ ${t.id === "notify" ? "notifications on" : `${t.id} complete`}` : t.detail}</span>
            </div>
            {!done[t.id] && (
              <a
                className={`btn btn-sm${locked ? " btn-ghost" : ""}`}
                href={t.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-disabled={locked}
                onClick={(e) => {
                  if (locked) return e.preventDefault();
                  opened.current = { id: t.id, at: Date.now() };
                }}
              >
                <span className="btn-icon"><XIcon /></span> Go
              </a>
            )}
          </li>
        ))}
      </ol>
      {count === 5 && <p className="unlocked">✓ All tasks complete. Allocation unlocked.</p>}
    </>
  );
}

const noop = () => () => {};
const canShareFiles = () => {
  try {
    return typeof navigator.canShare === "function" && navigator.canShare({ files: [new File([""], "x.png", { type: "image/png" })] });
  } catch {
    return false;
  }
};

/** The printed permit: download it, or post it in the comments of the airdrop post. */
function PermitCard({ permit, handle }: { permit: string; handle: string }) {
  const native = useSyncExternalStore(noop, canShareFiles, () => false);
  const link = `${SITE_URL}/p/${permit}`;
  const text = `Just claimed my $HAUNT permit 👻 ${AMOUNT} allocation.\n\nPermit ${permit} · ${X_HANDLE}`;
  async function shareImage() {
    try {
      const blob = await (await fetch(`/api/permit/${permit}`)).blob();
      await navigator.share({ files: [new File([blob], `${permit}.png`, { type: "image/png" })], text: `${text} ${link}` });
    } catch {
      // cancelled or refused: the buttons below still work
    }
  }
  return (
    <div className="permit">
      {/* eslint-disable-next-line @next/next/no-img-element -- a generated PNG, not a static asset */}
      <img className="scorecard" src={`/api/permit/${permit}`} width={1200} height={630} alt={`$HAUNT permit for @${handle}`} />
      <div className="share-row">
        {native && <button className="btn btn-green" onClick={shareImage}>Share image</button>}
        <a className="btn btn-orange" href={`/api/permit/${permit}?download=1`} download>Download card</a>
        <a className="btn" href={commentIntent(text, link)} target="_blank" rel="noopener noreferrer">
          <span className="btn-icon"><XIcon /></span> Post in the comments
        </a>
      </div>
      <p className="fine">Keep notifications on for {X_HANDLE}. Distribution is announced there.</p>
    </div>
  );
}

/** The airdrop page: unlock (sign in, tasks, wallet, card), allocation details and claim status. */
export default function AirdropPanel() {
  const [me, setMe] = useState<Me | null>(null);
  const [done, setDone] = useState<Done>({});
  const [wallet, setWallet] = useState("");
  const [editing, setEditing] = useState(false);
  const [cf, setCf] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function load() {
    return fetch("/api/airdrop/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((m: Me) => {
        setMe(m);
        if (m.account) setDone(loadTasks(m.account.handle));
      })
      .catch(() => setError("Couldn't reach the crypt. Refresh to try again."));
  }

  useEffect(() => {
    load();
  }, []);

  async function claim(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/airdrop/apply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ wallet, cf, tasks: done }) });
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
  const allDone = TASKS.every((t) => done[t.id]);

  let unlock: React.ReactNode;
  if (!me) unlock = <p className="muted">{error || "Opening the crypt..."}</p>;
  else if (!me.account) {
    unlock = (
      <>
        <SignIn mode={me.mode} next="/airdrop" lead="Enter your X username to start. One claim per X account." onSignedIn={load} />
        <Tasks handle="" done={{}} setDone={() => {}} locked />
      </>
    );
  } else if (app && !editing) {
    unlock =
      app.status === "rejected" ? (
        <p>This claim wasn&apos;t approved. The mansion is still open: the fastest souls can still win $HAUNT in the game.</p>
      ) : (
        <>
          <p className="unlocked">✓ Claim registered for <span className="mono-inline">{shortAddress(app.wallet)}</span></p>
          {app.permit && <PermitCard permit={app.permit} handle={app.handle} />}
          {app.status === "pending" && me.applicationsOpen && (
            <button className="btn btn-sm btn-ghost" onClick={() => { setWallet(app.wallet); setEditing(true); }}>Change wallet</button>
          )}
        </>
      );
  } else if (!me.applicationsOpen) {
    unlock = <p>Claims for the airdrop closed 2 hours before Halloween.</p>;
  } else {
    unlock = (
      <>
        <Tasks handle={me.account.handle} done={done} setDone={setDone} locked={false} />
        <form className="name-form" onSubmit={claim}>
          <label htmlFor="rh-wallet">Enter your Robinhood Chain wallet address (starts with 0x)</label>
          <input
            id="rh-wallet"
            className="input input-mono"
            value={wallet}
            onChange={(e) => setWallet(e.target.value)}
            placeholder="0x..."
            required
            disabled={!allDone}
            autoCapitalize="off"
            spellCheck={false}
          />
          {TURNSTILE_SITE_KEY && allDone && <Turnstile siteKey={TURNSTILE_SITE_KEY} onToken={setCf} />}
          <div className="panel-actions" style={{ justifyContent: "flex-start" }}>
            <button className="btn btn-green btn-big" disabled={!allDone || busy || (Boolean(TURNSTILE_SITE_KEY) && !cf)}>
              {busy ? "Claiming..." : `Claim ${AMOUNT}`}
            </button>
            {editing && <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>Cancel</button>}
          </div>
          {error && <p className="form-error">{error}</p>}
        </form>
      </>
    );
  }

  return (
    <div className="ad-stack">
      <section className="ad-card" aria-labelledby="ad-unlock">
        <h2 id="ad-unlock" className="ad-title"><span className="ad-num">1</span> Unlock your allocation</h2>
        {me?.account && <p className="form-note">Signed in as <b>@{me.account.handle}</b></p>}
        {unlock}
      </section>

      <div className="ad-grid ad-grid-2">
        <section className="ad-card" aria-labelledby="ad-alloc">
          <h2 id="ad-alloc" className="ad-title"><span className="ad-num">2</span> Allocation details</h2>
          <dl className="facts">
            <div><dt>Each allocation</dt><dd>{AMOUNT}</dd></div>
            <div><dt>Chain</dt><dd>Robinhood Chain</dd></div>
          </dl>
          {me?.applicationsOpen && <p className="fine">Claims close {new Date(me.closesAt).toUTCString().replace(":00 GMT", " UTC")}, 2 hours before Halloween.</p>}
        </section>

        <section className="ad-card" aria-labelledby="ad-claim">
          <h2 id="ad-claim" className="ad-title"><span className="ad-num">3</span> Claim status</h2>
          {app?.status === "approved" && me?.claim && me.merkleRoot ? (
            <ClaimPanel claim={me.claim} root={me.merkleRoot} contract={CLAIM_CONTRACT} open={CLAIM_OPEN} amountLabel={AMOUNT} />
          ) : (
            <div className="claim-box">
              <button className="btn btn-green btn-big" disabled>Claim disabled</button>
              <p className="muted">Disabled until launch and claims open. Then connect the same wallet and claim your $HAUNT once.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
