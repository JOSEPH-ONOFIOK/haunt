import store from "@/lib/store";
import { isRunId } from "@/lib/api";

// A finished run's result, so a player who signed in after escaping can still claim it.
export async function GET(_req: Request, ctx: RouteContext<"/api/run/[id]">) {
  const { id } = await ctx.params;
  const run = isRunId(id) ? await store.getRun(id) : null;
  if (!run) return Response.json({ error: "This run has expired." }, { status: 404 });
  return Response.json({ room: run.room, ms: run.ms ?? null, hints: run.hints, void: run.void ?? null });
}
