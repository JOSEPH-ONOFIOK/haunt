// A run lives in a signed ticket the player's browser holds, not in the database, so playing never waits on a
// write. The server re-signs it at each checkpoint. The only things a player could "lose" by replaying an older
// ticket are hints and wrong codes, so those two are counted in the database instead (see markRun in store.ts).
import { sign, unsign } from "./auth";
import type { RoomId } from "./rooms";

export type RunTicket = {
  id: string;
  room: RoomId;
  seed: number;
  startedAt: number;
  /** Ms after the start at which each checkpoint was reached. */
  steps: Record<string, number>;
  /** Set once the server has checked the final code: the official time, and the hints it was charged for. */
  ms?: number;
  hints?: number;
};

const TICKET_TTL_MS = 60 * 60_000; // a run can be finished and posted within an hour of starting

export const signRun = (run: RunTicket) => sign(run);

export function readRun(ticket: unknown): RunTicket | null {
  if (typeof ticket !== "string" || ticket.length > 4000) return null;
  const run = unsign<RunTicket>(ticket);
  if (!run || typeof run.id !== "string" || Date.now() - run.startedAt > TICKET_TTL_MS) return null;
  return run;
}
