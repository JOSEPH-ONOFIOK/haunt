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
  /** When each of the five tasks was done, as the player's browser reported it. */
  tasks?: Partial<Record<TaskId, number>>;
  /** Printed on the player's card and its share link. */
  permit?: string;
  /** X profile picture for the card. */
  avatar?: string;
};

/** One entry in a frozen list that a claim contract was deployed with. xid is set on game reward entries. */
export type Claim = { index: number; account: string; amount: string; proof: string[]; xid?: string };

/** The two claim lists. They never share a contract. */
export type ClaimList = "airdrop" | "rewards";

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

// ---------- the claim contracts on Robinhood Chain ----------
// Each stays off until the team sets its contract and flips its OPEN flag after funding it.
export const CLAIM_CONTRACT = cleanAddress(process.env.NEXT_PUBLIC_CLAIM_CONTRACT || "");
export const CLAIM_OPEN = process.env.NEXT_PUBLIC_CLAIM_OPEN === "true";
// Game rewards (top 5 of the round) claim from their own contract, separate from the airdrop.
export const REWARDS_CONTRACT = cleanAddress(process.env.NEXT_PUBLIC_REWARDS_CONTRACT || "");
export const REWARDS_CLAIM_OPEN = process.env.NEXT_PUBLIC_REWARDS_CLAIM_OPEN === "true";
const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 0);
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "";
export const chainReady = Boolean(CHAIN_ID && RPC_URL);

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

// ---------- the five tasks that unlock an allocation ----------
// The airdrop post the like, repost and comment tasks point at. Any x.com or twitter.com status link.
export const AIRDROP_POST_ID = (process.env.NEXT_PUBLIC_AIRDROP_POST || "").match(/status\/(\d+)/)?.[1] ?? "";
const X_USER = "PlayhauntRh";

export type TaskId = "follow" | "like" | "repost" | "comment" | "notify";
export const TASKS: { id: TaskId; title: string; detail: string; href: string }[] = [
  { id: "follow", title: `Follow @${X_USER}`, detail: "Follow the official account", href: `https://x.com/intent/follow?screen_name=${X_USER}` },
  { id: "like", title: "Like the post", detail: "Like the airdrop post", href: AIRDROP_POST_ID ? `https://x.com/intent/like?tweet_id=${AIRDROP_POST_ID}` : `https://x.com/${X_USER}` },
  { id: "repost", title: "Repost the post", detail: "Repost the airdrop post", href: AIRDROP_POST_ID ? `https://x.com/intent/retweet?tweet_id=${AIRDROP_POST_ID}` : `https://x.com/${X_USER}` },
  { id: "comment", title: "Comment on the post", detail: "Write anything, in your own words", href: AIRDROP_POST_ID ? `https://x.com/intent/post?in_reply_to=${AIRDROP_POST_ID}` : `https://x.com/${X_USER}` },
  { id: "notify", title: "Turn on notifications", detail: "Open the profile and tap the bell", href: `https://x.com/${X_USER}` },
];
export const TASK_IDS = TASKS.map((t) => t.id);

/** Where the finished card is posted: as a reply under the airdrop post, so it lands in the comments. */
export const commentIntent = (text: string, url: string) =>
  `https://x.com/intent/post?${new URLSearchParams({ text, url, ...(AIRDROP_POST_ID ? { in_reply_to: AIRDROP_POST_ID } : {}) })}`;

/** A permit id like HAUNT-07M-DJTI, printed on the player's card. */
export const PERMIT_RE = /^HAUNT-[0-9A-Z]{3}-[0-9A-Z]{4}$/;
