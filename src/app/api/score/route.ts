import store, { dayOf, publicScore } from "@/lib/store";
import { body, cleanName, cleanWallet, fail, ipOf, isRunId } from "@/lib/api";
import { getSession, verifyTurnstile } from "@/lib/auth";

// Posts a finished run to the boards under the signed in X account. Each run can be posted once.
export async function POST(req: Request) {
  const ip = ipOf(req);
  const input = await body<{ id: string; name: string; wallet: string; cf: string }>(req);
  if (!isRunId(input.id)) return fail("Unknown run.");
  const session = await getSession();
  if (!session) return fail("Sign in with X to post your time.", 401);
  const name = cleanName(input.name);
  if (!name) return fail("Pick a nickname of 2 to 16 letters or numbers.");
  const wallet = cleanWallet(input.wallet);
  if (!wallet) return fail("Add the wallet address (0x...) where $HAUNT rewards should be sent.");
  if (!(await store.limit(`score:${ip}`, 20, 600))) return fail("Too many posts. Try again in a few minutes.", 429);
  if (!(await verifyTurnstile(input.cf, ip))) return fail("The bot check failed. Please try again.");

  const account = await store.getAccount(session.xid);
  if (!account) return fail("Sign in with X again to post your time.", 401);
  if (await store.banned(account.xid)) return fail("This account can't post to the leaderboard.", 403);

  const run = await store.getRun(input.id);
  if (!run || run.ms === undefined) return fail("Finish the room before posting a time.");
  if (run.void) return fail(`This run can't be ranked: ${run.void}`);
  if (!(await store.once(`post:${input.id}`))) return fail("This run is already on the board.");

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
  return Response.json({ ...publicScore(score), eligible: account.eligible, verified: account.verified });
}
