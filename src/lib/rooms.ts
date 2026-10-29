// Registry of playable rooms: what each one is called, when it opens, and how the server checks a run.
import { makeCellar } from "./cellar";
import { makeRoom } from "./room";
import { CELLAR_AT } from "./site";

export type RoomId = "study" | "cellar";
export const ROOM_IDS: RoomId[] = ["study", "cellar"];
export const isRoomId = (v: unknown): v is RoomId => v === "study" || v === "cellar";

export const ROOMS: Record<RoomId, { name: string; path: string; unlockAt: string | null }> = {
  study: { name: "The Study", path: "/play", unlockAt: null },
  cellar: { name: "The Cellar", path: "/play/cellar", unlockAt: CELLAR_AT },
};

export const isOpen = (room: RoomId, now = Date.now()) => {
  const at = ROOMS[room].unlockAt;
  return !at || now >= new Date(at).getTime();
};

/** Checkpoints a player passes, in order. The server records when each was reached. */
export const STEPS: Record<RoomId, string[]> = {
  study: ["candle", "portrait", "clock", "drawer"],
  cellar: ["crank", "bucket", "potions", "levers"],
};

/** Answer to the final lock. */
export function answer(room: RoomId, seed: number): number[] {
  return room === "study" ? makeRoom(seed).code : makeCellar(seed).code;
}

/** Steps that carry an answer the server can check: the clock hour and the potion order. */
export function checkStep(room: RoomId, seed: number, step: string, value: unknown): boolean {
  if (room === "study" && step === "clock") return value === makeRoom(seed).hour;
  if (room === "cellar" && step === "potions") {
    const order = makeCellar(seed).order;
    return Array.isArray(value) && value.length === order.length && value.every((v, i) => v === order[i]);
  }
  return value === undefined;
}

export const sameCode = (a: unknown, b: number[]) => Array.isArray(a) && a.length === b.length && a.every((v, i) => v === b[i]);
