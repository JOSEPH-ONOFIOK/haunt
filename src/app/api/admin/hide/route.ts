import store from "@/lib/store";
import { body, fail, isRunId } from "@/lib/api";
import { isAdmin } from "@/lib/auth";

// Takes one run off the boards (a rude nickname, a suspicious time).
export async function POST(req: Request) {
  if (!(await isAdmin())) return fail("Not signed in as admin.", 403);
  const { id } = await body<{ id: string }>(req);
  const score = isRunId(id) ? await store.getScore(id) : null;
  if (!score) return fail("Unknown run.");
  await store.hide(score);
  return Response.json({ ok: true });
}
