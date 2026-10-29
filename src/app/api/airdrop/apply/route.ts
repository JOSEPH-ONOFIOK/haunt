import store from "@/lib/store";
import { body, fail, ipOf } from "@/lib/api";
import { authMode, getSession, verifyTurnstile } from "@/lib/auth";
import { cleanAddress } from "@/lib/airdrop";
import { zeroAddress } from "viem";

// Applies for the allocation, or changes the wallet on a pending application.
export async function POST(req: Request) {
  const ip = ipOf(req);
  const input = await body<{ wallet: string; cf: string }>(req);
  const session = await getSession();
  if (!session) return fail("Sign in with X to apply.", 401);
  if (!(await store.limit(`apply:${ip}`, 10, 600))) return fail("Too many attempts. Try again in a few minutes.", 429);
  if (!(await verifyTurnstile(input.cf, ip))) return fail("The bot check failed. Please try again.");

  const wallet = cleanAddress(input.wallet);
  if (!wallet || wallet === zeroAddress) return fail("That isn't a valid Robinhood Chain wallet address (0x followed by 40 characters).");

  const account = await store.getAccount(session.xid);
  if (!account) return fail("Sign in with X again to apply.", 401);
  if (await store.banned(account.xid)) return fail("This account can't apply.", 403);
  if (authMode === "x" && !account.eligible) return fail("Your X account is too new or has too few followers to apply.", 403);
  if (await store.getSnapshotMeta()) return fail("Applications are closed. The list has been finalised.", 409);

  const prev = await store.getApp(account.xid);
  if (prev && prev.status !== "pending") return fail(`Your application was already ${prev.status}.`, 409);
  if (prev?.wallet === wallet) return Response.json({ status: prev.status, wallet });

  const result = await store.saveApp({
    xid: account.xid,
    handle: account.handle,
    wallet,
    status: "pending",
    appliedAt: prev?.appliedAt ?? Date.now(),
    verified: account.verified,
    eligible: account.eligible,
    xCreatedAt: account.xCreatedAt,
    followers: account.followers,
  });
  if (result === "wallet_taken") return fail("That wallet is already on another application.", 409);
  return Response.json({ status: "pending", wallet });
}
