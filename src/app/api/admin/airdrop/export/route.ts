import store, { freshReads } from "@/lib/store";
import { isAdmin } from "@/lib/auth";
import { MAX_APPROVED, type AppStatus } from "@/lib/airdrop";

// GET ?status=approved → CSV of applications.  GET ?format=merkle → the frozen list for deploying the claim contract.
export async function GET(req: Request) {
  if (!(await isAdmin())) return new Response("Forbidden", { status: 403 });
  freshReads();
  const q = new URL(req.url).searchParams;

  if (q.get("format") === "merkle") {
    const meta = await store.getSnapshotMeta("airdrop");
    if (!meta) return new Response("Freeze the list first.", { status: 409 });
    const claims = await store.allClaims("airdrop");
    // Same shape as Uniswap's merkle-distributor output, which most deploy scripts read.
    const out = {
      merkleRoot: meta.merkleRoot,
      tokenTotal: meta.tokenTotal,
      decimals: meta.decimals,
      frozenAt: new Date(meta.frozenAt).toISOString(),
      claims: Object.fromEntries(claims.map((c) => [c.account, { index: c.index, amount: c.amount, proof: c.proof }])),
    };
    return new Response(JSON.stringify(out, null, 2), {
      headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="haunt-claims-${meta.merkleRoot.slice(0, 10)}.json"` },
    });
  }

  const status = (q.get("status") ?? "approved") as AppStatus;
  if (!["pending", "approved", "rejected"].includes(status)) return new Response("Bad request", { status: 400 });
  const apps = await store.listApps(status, 0, status === "approved" ? MAX_APPROVED : 100_000);
  const cols = ["x_handle", "verified", "eligible", "followers", "x_account_created", "wallet", "status", "applied_utc", "decided_utc"];
  // A leading = + - @ would run as a formula in Sheets/Excel, so neutralise it
  const esc = (v: unknown) => {
    const t = String(v ?? "");
    return `"${(/^[=+\-@]/.test(t) ? "'" + t : t).replace(/"/g, '""')}"`;
  };
  const iso = (t?: number) => (t ? new Date(t).toISOString() : "");
  const lines = apps.map((a) =>
    [a.handle, a.verified ? "yes" : "no", a.eligible ? "yes" : "no", a.followers ?? "", a.xCreatedAt ?? "", a.wallet, a.status, iso(a.appliedAt), iso(a.decidedAt)].map(esc).join(","),
  );
  return new Response([cols.join(","), ...lines].join("\n"), {
    headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="haunt-applications-${status}.csv"` },
  });
}
