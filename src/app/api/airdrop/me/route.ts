import { connection } from "next/server";
import store from "@/lib/store";
import { authMode, getSession } from "@/lib/auth";
import { sameAddress } from "@/lib/airdrop";
import { ROUND, roundOpen } from "@/lib/rewards";

// The signed in player's own application, and their claim once the list is frozen.
// Nothing about other applicants, not even how many there are, is ever returned.
export async function GET() {
  await connection();
  const s = await getSession();
  const [account, app, meta] = await Promise.all([s ? store.getAccount(s.xid) : null, s ? store.getApp(s.xid) : null, store.getSnapshotMeta("airdrop")]);
  const claim = app?.status === "approved" && meta ? await store.getClaim("airdrop", app.wallet) : null;
  return Response.json(
    {
      mode: authMode,
      account: account && { handle: account.handle, verified: account.verified, eligible: account.eligible },
      app: app && { handle: app.handle, wallet: app.wallet, status: app.status, appliedAt: app.appliedAt, permit: app.permit ?? null },
      frozen: Boolean(meta),
      // Applications close when Round 1 ends, or earlier if the list is frozen.
      applicationsOpen: roundOpen() && !meta,
      closesAt: ROUND.endsAt,
      merkleRoot: meta?.merkleRoot ?? null,
      claim: claim && sameAddress(claim.account, app?.wallet) ? claim : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
