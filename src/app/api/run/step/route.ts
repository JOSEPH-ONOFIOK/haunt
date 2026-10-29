import { MIN_STEP_GAP_MS, body, fail } from "@/lib/api";
import { STEPS, checkStep } from "@/lib/rooms";
import { readRun, signRun } from "@/lib/runs";

// Records a checkpoint in the run's ticket. Checkpoints must come in order, a believable time apart,
// and with the right answer where one applies.
export async function POST(req: Request) {
  const now = Date.now();
  const { ticket, step, value } = await body<{ ticket: string; step: string; value: unknown }>(req);
  const run = readRun(ticket);
  if (!run || run.ms !== undefined) return fail("Unknown run.");

  const order = STEPS[run.room];
  const i = order.indexOf(step ?? "");
  if (i < 0) return fail("Unknown step.");
  if (run.steps[order[i]] !== undefined) return Response.json({ ticket });
  if (i > 0 && run.steps[order[i - 1]] === undefined) return fail("Steps out of order.");
  if (!checkStep(run.room, run.seed, order[i], value)) return fail("That isn't right.");

  const at = now - run.startedAt;
  const prev = i > 0 ? run.steps[order[i - 1]] : 0;
  if (at - prev < MIN_STEP_GAP_MS) return fail("Too fast.");
  return Response.json({ ticket: signRun({ ...run, steps: { ...run.steps, [order[i]]: at } }) });
}
