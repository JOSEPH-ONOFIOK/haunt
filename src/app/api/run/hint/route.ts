import store from "@/lib/store";
import { body, fail } from "@/lib/api";
import { readRun } from "@/lib/runs";

// Counts a hint against the run in the database, so replaying an older ticket can't drop the penalty.
export async function POST(req: Request) {
  const run = readRun((await body<{ ticket: string }>(req)).ticket);
  if (!run || run.ms !== undefined) return fail("Unknown run.");
  await store.markRun(run.id, "hints");
  return Response.json({ ok: true });
}
