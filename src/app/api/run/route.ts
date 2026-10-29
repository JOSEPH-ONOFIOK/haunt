import { randomBytes } from "node:crypto";
import store from "@/lib/store";
import { body, fail, ipOf } from "@/lib/api";
import { isOpen, isRoomId } from "@/lib/rooms";
import { newSeed } from "@/lib/room";

// Starts a run. The server picks the seed and keeps the start time, so the clock can't be faked.
export async function POST(req: Request) {
  const { room } = await body<{ room: string }>(req);
  if (!isRoomId(room)) return fail("Unknown room.");
  if (!isOpen(room)) return fail("This door hasn't opened yet.", 403);
  if (!(await store.limit(`start:${ipOf(req)}`, 40, 600))) return fail("Too many runs. Catch your breath and try again soon.", 429);
  const run = { id: randomBytes(12).toString("hex"), room, seed: newSeed(), startedAt: Date.now(), hints: 0, steps: {}, wrong: 0 };
  await store.putRun(run);
  return Response.json({ id: run.id, seed: run.seed });
}
