import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import TopBar from "../../_components/TopBar";
import { AdminLogin } from "../AdminControls";
import { AppTable, FreezeControls } from "./AppTable";
import store from "@/lib/store";
import { adminConfigured, authMode, isAdmin } from "@/lib/auth";
import { ALLOCATION, CLAIM_CONTRACT, CLAIM_OPEN, MAX_APPROVED, type AppStatus } from "@/lib/airdrop";

export const metadata: Metadata = { title: "Admin: allocation", robots: { index: false, follow: false } };

type Props = { searchParams: Promise<{ status?: string; page?: string }> };
const PAGE = 100;
const fmt = (n: number) => n.toLocaleString("en-US");

async function Review({ searchParams }: Props) {
  await connection();
  if (!adminConfigured) return <p className="form-error">Set ADMIN_KEY and SESSION_SECRET to use this page.</p>;
  if (!(await isAdmin())) return <AdminLogin />;

  const q = await searchParams;
  const status: AppStatus = q.status === "approved" || q.status === "rejected" ? q.status : "pending";
  const page = Math.max(0, Number(q.page) || 0);
  const [counts, apps, meta] = await Promise.all([store.countApps(), store.listApps(status, page * PAGE, PAGE), store.getSnapshotMeta()]);
  const total = counts[status];

  return (
    <>
      <nav className="tabs">
        <Link href="/admin" className="tab">Leaderboards</Link>
        <Link href="/admin/airdrop" className="tab tab-on">Allocation</Link>
      </nav>

      {authMode !== "x" && <p className="form-error">Sign in with X isn&apos;t configured, so applicants typed their handles and none are verified.</p>}

      <div className="stats">
        <div className="stat stat-hot">
          <span className="stat-label">Approved</span>
          <span className="stat-value">{fmt(counts.approved)} / {fmt(MAX_APPROVED)}</span>
          <span className="stat-sub">{fmt(counts.approved * ALLOCATION)} $HAUNT allocated</span>
        </div>
        <div className="stat">
          <span className="stat-label">Pending</span>
          <span className="stat-value">{fmt(counts.pending)}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Rejected</span>
          <span className="stat-value">{fmt(counts.rejected)}</span>
        </div>
      </div>

      <div className="freeze-box">
        {meta ? (
          <>
            <p><b>List frozen</b> {new Date(meta.frozenAt).toISOString().slice(0, 16).replace("T", " ")} UTC. Decisions are locked.</p>
            <p className="mono">Merkle root: {meta.merkleRoot}</p>
            <p className="mono">Fund the contract with: {meta.tokenTotal} (base units, {meta.decimals} decimals)</p>
            <p className="muted">
              Claim contract: {CLAIM_CONTRACT ?? "not set"} · claims {CLAIM_OPEN ? "OPEN" : "closed"}. The claim button only turns on when the contract&apos;s root matches
              this one and it holds the tokens.
            </p>
          </>
        ) : (
          <p className="muted">When review is done, freeze the list. That generates the Merkle root to deploy and fund the claim contract with.</p>
        )}
        <div className="panel-actions" style={{ justifyContent: "flex-start" }}>
          <FreezeControls frozen={Boolean(meta)} canFreeze={counts.approved > 0} />
          {meta && <a className="btn btn-sm btn-green" href="/api/admin/airdrop/export?format=merkle">Download claims JSON</a>}
          <a className="btn btn-sm" href="/api/admin/airdrop/export?status=approved">Export approved CSV</a>
        </div>
      </div>

      <div className="tabs">
        {(["pending", "approved", "rejected"] as AppStatus[]).map((st) => (
          <Link key={st} href={`/admin/airdrop?status=${st}`} className={`tab${st === status ? " tab-on" : ""}`}>
            {st[0].toUpperCase() + st.slice(1)} ({fmt(counts[st])})
          </Link>
        ))}
        <span className="tabs-gap" />
        <a className="btn btn-sm" href={`/api/admin/airdrop/export?status=${status}`}>Export {status} CSV</a>
      </div>

      {!apps.length ? (
        <p className="board-empty">Nothing here.</p>
      ) : (
        <AppTable apps={apps} status={status} frozen={Boolean(meta)} />
      )}

      {total > PAGE && (
        <div className="panel-actions">
          {page > 0 && <Link className="btn btn-sm" href={`/admin/airdrop?status=${status}&page=${page - 1}`}>Previous</Link>}
          <span className="muted">Page {page + 1} of {Math.ceil(total / PAGE)}</span>
          {(page + 1) * PAGE < total && <Link className="btn btn-sm" href={`/admin/airdrop?status=${status}&page=${page + 1}`}>Next</Link>}
        </div>
      )}
    </>
  );
}

export default function AirdropAdminPage(props: Props) {
  return (
    <>
      <TopBar />
      <main className="wrap section admin">
        <Suspense fallback={<p className="muted">Opening the crypt...</p>}>
          <Review {...props} />
        </Suspense>
      </main>
    </>
  );
}
