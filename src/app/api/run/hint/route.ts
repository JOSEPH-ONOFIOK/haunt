import store from "@/lib/store";
import { body, fail, isRunId } from "@/lib/api";

// Counts a hint against the run so its time penalty can't be skipped.
export async function POST(req: Request) {
  const { id } = await body<{ id: string }>(req);
  if (!isRunId(id)) return fail("Unknown run.");
  const run = await store.getRun(id);
  if (!run || run.ms !== undefined) return fail("Unknown run.");
  await store.putRun({ ...run, hints: run.hints + 1 });
  return Response.json({ ok: true });
}
