import store from "@/lib/store";
import { body, fail, ipOf } from "@/lib/api";
import { authMode, getSession, verifyTurnstile } from "@/lib/auth";
import { createHash } from "node:crypto";
import { TASK_IDS, cleanAddress, type TaskId } from "@/lib/airdrop";
import { zeroAddress } from "viem";
import { roundOpen } from "@/lib/rewards";

/** A stable permit id per X account, like HAUNT-07M-DJTI. */
function permitFor(xid: string) {
  const ALPHABET = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const bytes = createHash("sha256").update(`haunt-permit:${xid}`).digest();
  const pick = (n: number, from: number) => Array.from({ length: n }, (_, i) => ALPHABET[bytes[from + i] % ALPHABET.length]).join("");
  return `HAUNT-${pick(3, 0)}-${pick(4, 3)}`;
}

/** The five tasks, each with a believable time. They're on trust (X's API can't check follows for free). */
function cleanTasks(raw: unknown): Record<TaskId, number> | null {
  if (!raw || typeof raw !== "object") return null;
  const now = Date.now();
  const out = {} as Record<TaskId, number>;
  for (const id of TASK_IDS) {
    const t = Number((raw as Record<string, unknown>)[id]);
    if (!Number.isFinite(t) || t > now + 60_000 || t < now - 30 * 864e5) return null;
    out[id] = t;
  }
  return out;
}

// Claims the allocation (registers the application), or changes the wallet on a pending one.
export async function POST(req: Request) {
  const ip = ipOf(req);
  const input = await body<{ wallet: string; cf: string; tasks: unknown }>(req);
  // Applications close when Round 1 of the game ends, 2 hours before Halloween.
  if (!roundOpen()) return fail("Applications are closed. They closed 2 hours before Halloween.", 409);
  const session = await getSession();
  if (!session) return fail("Enter your X username to claim.", 401);
  if (!(await store.limit(`apply:${ip}`, 10, 600))) return fail("Too many attempts. Try again in a few minutes.", 429);
  if (!(await verifyTurnstile(input.cf, ip))) return fail("The bot check failed. Please try again.");

  const tasks = cleanTasks(input.tasks);
  if (!tasks) return fail("Complete all 5 tasks to unlock your allocation.");
  const wallet = cleanAddress(input.wallet);
  if (!wallet || wallet === zeroAddress) return fail("That isn't a valid Robinhood Chain wallet address (0x followed by 40 characters).");

  const account = await store.getAccount(session.xid);
  if (!account) return fail("Enter your X username again to claim.", 401);
  if (await store.banned(account.xid)) return fail("This account can't apply.", 403);
  if (authMode === "x" && !account.eligible) return fail("Your X account is too new or has too few followers to apply.", 403);
  if (await store.getSnapshotMeta("airdrop")) return fail("Applications are closed. The list has been finalised.", 409);

  const prev = await store.getApp(account.xid);
  if (prev && prev.status !== "pending") return fail(`Your claim was already ${prev.status}.`, 409);
  if (prev?.wallet === wallet) return Response.json({ status: prev.status, wallet, permit: prev.permit });

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
    tasks: prev?.tasks ?? tasks,
    permit: prev?.permit ?? permitFor(account.xid),
    avatar: account.avatar,
  });
  if (result === "wallet_taken") return fail("That wallet has already claimed with another X account.", 409);
  return Response.json({ status: "pending", wallet, permit: prev?.permit ?? permitFor(account.xid) });
}
