import { connection } from "next/server";
import store from "@/lib/store";
import { authMode, getSession } from "@/lib/auth";
import { REWARDS, ROUND, rewardFor, roundOpen } from "@/lib/rewards";

// The signed in player's standing in the round, and their reward claim once the winners are frozen.
export async function GET() {
  await connection();
  const s = await getSession();
  const account = s ? await store.getAccount(s.xid) : null;
  const meta = await store.getSnapshotMeta("rewards");
  let standing = null;
  if (account) {
    const board = await store.top(ROUND.room, ROUND.id, 100);
    const mine = board.find((b) => b.xid === account.xid);
    if (mine) standing = { rank: mine.rank, ms: mine.ms, name: mine.name, reward: rewardFor(mine.rank) };
  }
  const claim = account && meta ? await store.getClaim("rewards", account.xid) : null;
  return Response.json(
    {
      mode: authMode,
      account: account && { handle: account.handle, verified: account.verified, eligible: account.eligible },
      round: { name: ROUND.name, endsAt: ROUND.endsAt, ended: !roundOpen(), winners: REWARDS.length },
      standing,
      frozen: Boolean(meta),
      merkleRoot: meta?.merkleRoot ?? null,
      claim,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
