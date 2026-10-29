import { connection } from "next/server";
import store from "@/lib/store";
import { authMode, getSession } from "@/lib/auth";
import { sameAddress } from "@/lib/airdrop";

// The signed in player's own application, and their claim once the list is frozen.
// Nothing about other applicants, not even how many there are, is ever returned.
export async function GET() {
  await connection();
  const s = await getSession();
  const [account, app, meta] = await Promise.all([s ? store.getAccount(s.xid) : null, s ? store.getApp(s.xid) : null, store.getSnapshotMeta()]);
  const claim = app?.status === "approved" && meta ? await store.getClaim(app.wallet) : null;
  return Response.json(
    {
      mode: authMode,
      account: account && { handle: account.handle, verified: account.verified, eligible: account.eligible },
      app: app && { handle: app.handle, wallet: app.wallet, status: app.status, appliedAt: app.appliedAt },
      frozen: Boolean(meta),
      merkleRoot: meta?.merkleRoot ?? null,
      claim: claim && sameAddress(claim.account, app?.wallet) ? claim : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
