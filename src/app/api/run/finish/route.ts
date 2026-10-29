import store from "@/lib/store";
import { MAX_WRONG, MIN_FINAL_GAP_MS, MIN_MS, body, fail, isRunId, officialMs, tooSlow } from "@/lib/api";
import { LIMIT_MS } from "@/lib/room";
import { STEPS, answer, sameCode } from "@/lib/rooms";

// Checks the final code against the run's own seed and stamps the official time.
export async function POST(req: Request) {
  const now = Date.now();
  const { id, code } = await body<{ id: string; code: number[] }>(req);
  if (!isRunId(id)) return fail("Unknown run.");
  const run = await store.getRun(id);
  if (!run) return fail("Unknown run.");
  if (run.ms !== undefined) return Response.json({ ms: run.ms });
  if (run.void) return fail(`This run can't be ranked: ${run.void}`);

  const void_ = async (reason: string) => {
    await store.putRun({ ...run, void: reason });
    return fail(`This run can't be ranked: ${reason}`);
  };

  if (!sameCode(code, answer(run.room, run.seed))) {
    if (run.wrong + 1 >= MAX_WRONG) return void_("too many wrong codes.");
    await store.putRun({ ...run, wrong: run.wrong + 1 });
    return fail("That code doesn't open this door.");
  }

  const steps = STEPS[run.room];
  if (steps.some((s) => run.steps[s] === undefined)) return void_("some clues were never found.");
  const at = now - run.startedAt;
  if (at - run.steps[steps[steps.length - 1]] < MIN_FINAL_GAP_MS) return void_("the lock was opened faster than a person can.");

  const ms = officialMs(run.startedAt, run.hints, now);
  if (tooSlow(ms)) return fail("The candles had already died.");
  if (ms < MIN_MS) return void_("nobody escapes that fast.");
  if (!(await store.once(`finish:${id}`))) return fail("This run is already finished.");

  const done = { ...run, ms: Math.min(ms, LIMIT_MS) };
  await store.putRun(done);
  return Response.json({ ms: done.ms });
}
