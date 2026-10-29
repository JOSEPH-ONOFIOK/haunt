import store from "@/lib/store";
import { fail } from "@/lib/api";
import { isAdmin, xReady } from "@/lib/auth";
import { TOKEN_DECIMALS, cleanAddress } from "@/lib/airdrop";
import { buildSnapshot, verifyProof } from "@/lib/merkle";
import { REWARDS, ROUND, rewardUnits, roundOpen } from "@/lib/rewards";

// After the round ends and the top runs are reviewed, freezes the winners into the rewards claim contract's Merkle tree.
export async function POST() {
  if (!(await isAdmin())) return fail("Not signed in as admin.", 403);
  if (roundOpen()) return fail(`${ROUND.name} hasn't ended yet.`, 409);
  if (await store.getSnapshotMeta("rewards")) return fail("The winners are already frozen.", 409);

  // Hidden runs and banned accounts are already off the board. Unverified entries are skipped too (they only
  // exist in developer test mode), so the next fastest verified soul moves up into the winning places.
  const board = await store.top(ROUND.room, ROUND.id, 100);
  const winners = (xReady ? board.filter((s) => s.verified) : board).slice(0, REWARDS.length);
  if (!winners.length) return fail("No verified winners on the board.");
  const entries = winners.map((s, i) => ({ account: cleanAddress(s.wallet)!, amount: rewardUnits(i + 1), xid: s.xid }));
  if (entries.some((e) => !e.account)) return fail("A winner has no valid wallet.", 409);
  if (new Set(entries.map((e) => e.account)).size !== entries.length) return fail("Two winners share a wallet. Review them before freezing.", 409);

  const snap = buildSnapshot(entries, TOKEN_DECIMALS);
  if (!snap.claims.every((c) => verifyProof(c, snap.merkleRoot))) return fail("A proof failed to verify. Nothing was saved.", 500);
  await store.putSnapshot("rewards", snap);
  return Response.json({ merkleRoot: snap.merkleRoot, tokenTotal: snap.tokenTotal, count: snap.claims.length });
}
