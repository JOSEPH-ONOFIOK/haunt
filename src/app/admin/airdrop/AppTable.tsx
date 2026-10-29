"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AppStatus, Application } from "@/lib/airdrop";

async function post(url: string, data: object) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Failed");
  return json;
}

const ageDays = (iso?: string, now = Date.now()) => (iso ? Math.floor((now - new Date(iso).getTime()) / 864e5) : null);

export function AppTable({ apps, status, frozen }: { apps: Application[]; status: AppStatus; frozen: boolean }) {
  const router = useRouter();
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const all = apps.length > 0 && picked.length === apps.length;

  async function decide(to: AppStatus) {
    setBusy(true);
    setNote("");
    try {
      const r = await post("/api/admin/airdrop/decide", { xids: picked, status: to });
      setNote(`${r.changed} moved to ${to}.${r.capped ? ` ${r.capped} not approved: the 2,000 cap is full.` : ""}`);
      setPicked([]);
      router.refresh();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  const toggle = (xid: string) => setPicked((p) => (p.includes(xid) ? p.filter((x) => x !== xid) : [...p, xid]));

  return (
    <>
      <div className="bulk-bar">
        <span>{picked.length} selected</span>
        {status !== "approved" && <button className="btn btn-sm btn-green" disabled={!picked.length || busy || frozen} onClick={() => decide("approved")}>Approve</button>}
        {status !== "rejected" && <button className="btn btn-sm btn-danger" disabled={!picked.length || busy || frozen} onClick={() => decide("rejected")}>Reject</button>}
        {status !== "pending" && <button className="btn btn-sm" disabled={!picked.length || busy || frozen} onClick={() => decide("pending")}>Back to pending</button>}
        {note && <span className="muted">{note}</span>}
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th><input type="checkbox" aria-label="Select all on this page" checked={all} onChange={() => setPicked(all ? [] : apps.map((a) => a.xid))} /></th>
              <th>Applicant</th><th>X account</th><th>Wallet</th><th>Applied</th>
            </tr>
          </thead>
          <tbody>
            {apps.map((a) => {
              const days = ageDays(a.xCreatedAt);
              return (
                <tr key={a.xid} onClick={() => toggle(a.xid)} className={picked.includes(a.xid) ? "row-picked" : undefined}>
                  <td><input type="checkbox" checked={picked.includes(a.xid)} onChange={() => toggle(a.xid)} onClick={(e) => e.stopPropagation()} aria-label={`Select @${a.handle}`} /></td>
                  <td><a href={`https://x.com/${a.handle}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>@{a.handle}</a></td>
                  <td className="muted">
                    {a.verified ? (a.eligible ? "verified" : <span className="gap-fast">not eligible</span>) : <span className="gap-fast">unverified</span>}
                    {days !== null && ` · ${days}d · ${a.followers ?? 0} followers`}
                  </td>
                  <td className="mono">{a.wallet}</td>
                  <td className="muted">{new Date(a.appliedAt).toISOString().slice(0, 16).replace("T", " ")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function FreezeControls({ frozen, canFreeze, base = "/api/admin/airdrop", what = "list" }: { frozen: boolean; canFreeze: boolean; base?: string; what?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function act(url: string, ask: string) {
    if (!confirm(ask)) return;
    setBusy(true);
    try {
      await post(url, {});
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }
  return frozen ? (
    <button className="btn btn-sm btn-danger" disabled={busy} onClick={() => act(`${base}/unfreeze`, `Unfreeze the ${what}? Only do this if the claim contract has NOT been deployed with this root.`)}>
      Unfreeze
    </button>
  ) : (
    <button className="btn btn-sm btn-orange" disabled={busy || !canFreeze} onClick={() => act(`${base}/freeze`, `Freeze the ${what}? It locks and the Merkle root is generated for the claim contract.`)}>
      Freeze {what}
    </button>
  );
}
