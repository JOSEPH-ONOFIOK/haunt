import store from "@/lib/store";
import { MIN_STEP_GAP_MS, body, fail, isRunId } from "@/lib/api";
import { STEPS, checkStep } from "@/lib/rooms";

// Records a checkpoint. They must come in order, a believable time apart, and with the right answer where one applies.
export async function POST(req: Request) {
  const now = Date.now();
  const { id, step, value } = await body<{ id: string; step: string; value: unknown }>(req);
  if (!isRunId(id)) return fail("Unknown run.");
  const run = await store.getRun(id);
  if (!run || run.ms !== undefined || run.void) return fail("Unknown run.");

  const order = STEPS[run.room];
  const i = order.indexOf(step ?? "");
  if (i < 0) return fail("Unknown step.");
  if (run.steps[order[i]] !== undefined) return Response.json({ ok: true });
  if (i > 0 && run.steps[order[i - 1]] === undefined) return fail("Steps out of order.");
  if (!checkStep(run.room, run.seed, order[i], value)) return fail("That isn't right.");

  const at = now - run.startedAt;
  const prev = i > 0 ? run.steps[order[i - 1]] : 0;
  if (at - prev < MIN_STEP_GAP_MS) {
    await store.putRun({ ...run, void: "Steps came faster than a person can click." });
    return fail("Too fast.");
  }
  await store.putRun({ ...run, steps: { ...run.steps, [order[i]]: at } });
  return Response.json({ ok: true });
}
