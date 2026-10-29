// Builds the claim list's Merkle tree the way the standard distributor checks it:
// leaf = keccak256(abi.encodePacked(uint256 index, address account, uint256 amount)), pairs hashed in sorted order
// (OpenZeppelin MerkleProof). An odd node at the end of a layer moves up unchanged.
import { concat, encodePacked, keccak256, type Hex } from "viem";
import type { Claim, Snapshot } from "./airdrop";

export const leafOf = (index: number, account: string, amount: bigint) =>
  keccak256(encodePacked(["uint256", "address", "uint256"], [BigInt(index), account as Hex, amount]));

const hashPair = (a: Hex, b: Hex) => keccak256(BigInt(a) < BigInt(b) ? concat([a, b]) : concat([b, a]));

function layers(leaves: Hex[]) {
  const out = [leaves];
  while (out[out.length - 1].length > 1) {
    const prev = out[out.length - 1];
    const next: Hex[] = [];
    for (let i = 0; i < prev.length; i += 2) next.push(i + 1 < prev.length ? hashPair(prev[i], prev[i + 1]) : prev[i]);
    out.push(next);
  }
  return out;
}

/** The frozen claim list: index order is the order given. */
export function buildSnapshot(entries: { account: string; amount: bigint; xid?: string }[], decimals: number): Snapshot {
  if (!entries.length) throw new Error("Nothing to freeze.");
  const leaves = entries.map((e, i) => leafOf(i, e.account, e.amount));
  const tree = layers(leaves);
  const claims: Claim[] = entries.map(({ account, amount, xid }, index) => {
    const proof: Hex[] = [];
    let i = index;
    for (const layer of tree.slice(0, -1)) {
      const sibling = i % 2 ? i - 1 : i + 1;
      if (sibling < layer.length) proof.push(layer[sibling]);
      i = Math.floor(i / 2);
    }
    return { index, account, amount: amount.toString(), proof, ...(xid ? { xid } : {}) };
  });
  return {
    merkleRoot: tree[tree.length - 1][0],
    tokenTotal: entries.reduce((sum, e) => sum + e.amount, BigInt(0)).toString(),
    decimals,
    frozenAt: Date.now(),
    claims,
  };
}

/** Same check the contract runs. Used to test every proof before a snapshot is saved. */
export function verifyProof(claim: Claim, root: string) {
  let h = leafOf(claim.index, claim.account, BigInt(claim.amount));
  for (const p of claim.proof) h = hashPair(h, p as Hex);
  return h.toLowerCase() === root.toLowerCase();
}
