import store, { freshReads } from "@/lib/store";
import { isAdmin } from "@/lib/auth";

// GET → the frozen winners, for deploying and funding the rewards claim contract.
export async function GET() {
  if (!(await isAdmin())) return new Response("Forbidden", { status: 403 });
  freshReads();
  const meta = await store.getSnapshotMeta("rewards");
  if (!meta) return new Response("Freeze the winners first.", { status: 409 });
  const claims = await store.allClaims("rewards");
  const out = {
    merkleRoot: meta.merkleRoot,
    tokenTotal: meta.tokenTotal,
    decimals: meta.decimals,
    frozenAt: new Date(meta.frozenAt).toISOString(),
    claims: Object.fromEntries(claims.map((c) => [c.account, { index: c.index, amount: c.amount, proof: c.proof }])),
  };
  return new Response(JSON.stringify(out, null, 2), {
    headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="haunt-rewards-${meta.merkleRoot.slice(0, 10)}.json"` },
  });
}
