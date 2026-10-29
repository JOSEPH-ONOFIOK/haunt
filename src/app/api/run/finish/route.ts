import store from "@/lib/store";
import { MAX_WRONG, MIN_FINAL_GAP_MS, MIN_MS, body, fail, officialMs, tooSlow } from "@/lib/api";
import { LIMIT_MS } from "@/lib/room";
import { STEPS, answer, sameCode } from "@/lib/rooms";
import { readRun, signRun } from "@/lib/runs";

// Checks the final code against the run's own seed and signs the official time into a finished ticket.
export async function POST(req: Request) {
  const now = Date.now();
  const { ticket, code } = await body<{ ticket: string; code: number[] }>(req);
  const run = readRun(ticket);
  if (!run) return fail("Unknown run.");
  if (run.ms !== undefined) return Response.json({ ms: run.ms, ticket });

  const marks = await store.runMarks(run.id);
  const unranked = (reason: string) => fail(`This run can't be ranked: ${reason}`);
  if (marks.wrong >= MAX_WRONG) return unranked("too many wrong codes.");
  if (!sameCode(code, answer(run.room, run.seed))) {
    // The game checks codes itself, so only a script guessing at the server ever gets here.
    const { wrong } = await store.markRun(run.id, "wrong");
    return wrong >= MAX_WRONG ? unranked("too many wrong codes.") : fail("That code doesn't open this door.");
  }

  const steps = STEPS[run.room];
  if (steps.some((s) => run.steps[s] === undefined)) return unranked("some clues were never found.");
  if (now - run.startedAt - run.steps[steps[steps.length - 1]] < MIN_FINAL_GAP_MS) return unranked("the lock was opened faster than a person can.");

  const ms = officialMs(run.startedAt, marks.hints, now);
  if (tooSlow(ms)) return fail("The candles had already died.");
  if (ms < MIN_MS) return unranked("nobody escapes that fast.");

  const done = { ...run, ms: Math.min(ms, LIMIT_MS), hints: marks.hints };
  return Response.json({ ms: done.ms, ticket: signRun(done) });
}
