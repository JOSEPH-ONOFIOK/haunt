import store, { dayOf, publicScore } from "@/lib/store";
import { body, cleanName, cleanWallet, fail, ipOf } from "@/lib/api";
import { getSession, verifyTurnstile } from "@/lib/auth";
import { readRun } from "@/lib/runs";

// Posts a finished run to the boards under the signed in X account. Each run can be posted once.
export async function POST(req: Request) {
  const ip = ipOf(req);
  const input = await body<{ ticket: string; name: string; wallet: string; cf: string }>(req);
  const run = readRun(input.ticket);
  if (!run) return fail("This run has expired or can't be verified. Runs can be posted for an hour after they start.");
  if (run.ms === undefined || run.hints === undefined) return fail("Finish the room before posting a time.");
  const session = await getSession();
  if (!session) return fail("Enter your X username to post your time.", 401);
  const name = cleanName(input.name);
  if (!name) return fail("Pick a nickname of 2 to 16 letters or numbers.");
  const wallet = cleanWallet(input.wallet);
  if (!wallet) return fail("Add the wallet address (0x...) where $HAUNT rewards should be sent.");
  if (!(await store.limit(`score:${ip}`, 20, 600))) return fail("Too many posts. Try again in a few minutes.", 429);
  if (!(await verifyTurnstile(input.cf, ip))) return fail("The bot check failed. Please try again.");

  const account = await store.getAccount(session.xid);
  if (!account) return fail("Enter your X username again to post your time.", 401);
  if (await store.banned(account.xid)) return fail("This account can't post to the leaderboard.", 403);

  if (account.wallet !== wallet) await store.putAccount({ ...account, wallet });
  const at = Date.now();
  const score = await store.postScore({
    id: run.id,
    room: run.room,
    xid: account.xid,
    handle: account.handle,
    name,
    wallet,
    verified: account.verified && account.eligible,
    ms: run.ms,
    hints: run.hints,
    at,
    day: dayOf(at),
    steps: run.steps,
  });
  if (!score) return fail("This run is already on the board.");
  return Response.json({ ...publicScore(score), eligible: account.eligible, verified: account.verified });
}
