import store, { freshReads } from "@/lib/store";
import { fail } from "@/lib/api";
import { isAdmin } from "@/lib/auth";
import { MAX_APPROVED, TOKEN_DECIMALS, allocationUnits } from "@/lib/airdrop";
import { buildSnapshot, verifyProof } from "@/lib/merkle";

// Freezes the approved list into the Merkle tree the claim contract is deployed with.
export async function POST() {
  if (!(await isAdmin())) return fail("Not signed in as admin.", 403);
  freshReads();
  if (await store.getSnapshotMeta("airdrop")) return fail("The list is already frozen.", 409);
  const approved = await store.listApps("approved", 0, MAX_APPROVED);
  if (!approved.length) return fail("Approve some applications first.");

  const snap = buildSnapshot(approved.map((a) => ({ account: a.wallet, amount: allocationUnits() })), TOKEN_DECIMALS);
  if (!snap.claims.every((c) => verifyProof(c, snap.merkleRoot))) return fail("A proof failed to verify. Nothing was saved.", 500);
  await store.putSnapshot("airdrop", snap);
  return Response.json({ merkleRoot: snap.merkleRoot, tokenTotal: snap.tokenTotal, count: snap.claims.length });
}
