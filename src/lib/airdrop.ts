// The $HAUNT allocation: 2,000 approved souls get 100,000 each. Safe to import in the browser.
import { defineChain, getAddress, isAddress } from "viem";
import { EXPLORER_URL } from "./site";

export const ALLOCATION = 100_000;
export const MAX_APPROVED = 2_000;
export const TOKEN_DECIMALS = Number(process.env.NEXT_PUBLIC_TOKEN_DECIMALS || 18);
/** One allocation in the token's base units, as the claim contract counts it. */
export const allocationUnits = () => BigInt(ALLOCATION) * 10n ** BigInt(TOKEN_DECIMALS);

export type AppStatus = "pending" | "approved" | "rejected";

/** An application for the allocation. One per X account and one per wallet. */
export type Application = {
  xid: string;
  handle: string;
  /** Checksummed Robinhood Chain (EVM) address. */
  wallet: string;
  status: AppStatus;
  appliedAt: number;
  decidedAt?: number;
  verified: boolean;
  eligible: boolean;
  xCreatedAt?: string;
  followers?: number;
};

/** One wallet's entry in the frozen list that the claim contract was deployed with. */
export type Claim = { index: number; account: string; amount: string; proof: string[] };

export type Snapshot = {
  merkleRoot: string;
  /** Sum of all amounts in base units: what the contract must be funded with. */
  tokenTotal: string;
  decimals: number;
  frozenAt: number;
  claims: Claim[];
};

export const cleanAddress = (v: unknown) => (typeof v === "string" && isAddress(v.trim(), { strict: false }) ? getAddress(v.trim()) : null);
export const sameAddress = (a?: string | null, b?: string | null) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
export const shortAddress = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

// ---------- the claim contract on Robinhood Chain ----------
// Claims stay off until the team sets the contract and flips NEXT_PUBLIC_CLAIM_OPEN after funding it.
export const CLAIM_CONTRACT = cleanAddress(process.env.NEXT_PUBLIC_CLAIM_CONTRACT || "");
export const CLAIM_OPEN = process.env.NEXT_PUBLIC_CLAIM_OPEN === "true";
const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 0);
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "";
export const claimConfigured = Boolean(CLAIM_CONTRACT && CHAIN_ID && RPC_URL);

export const chain = defineChain({
  id: CHAIN_ID || 1,
  name: process.env.NEXT_PUBLIC_CHAIN_NAME || "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL || "http://localhost"] } },
  blockExplorers: EXPLORER_URL ? { default: { name: "Explorer", url: EXPLORER_URL } } : undefined,
});

export const explorerTx = (hash: string) => (EXPLORER_URL ? `${EXPLORER_URL}/tx/${hash}` : "");

/** The standard Merkle distributor interface (Uniswap's MerkleDistributor and its many forks). */
export const distributorAbi = [
  { type: "function", name: "token", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "merkleRoot", stateMutability: "view", inputs: [], outputs: [{ type: "bytes32" }] },
  { type: "function", name: "isClaimed", stateMutability: "view", inputs: [{ name: "index", type: "uint256" }], outputs: [{ type: "bool" }] },
  {
    type: "function",
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [
      { name: "index", type: "uint256" },
      { name: "account", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "merkleProof", type: "bytes32[]" },
    ],
    outputs: [],
  },
] as const;

export const erc20Abi = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;
