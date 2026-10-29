// The study: one escape room whose answers are shuffled from a seed.
// Keeping generation pure means the server can rebuild a run from its seed to check a score.

export const LIMIT_MS = 5 * 60_000;
export const HINT_PENALTY_MS = 20_000;

export const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

// Places in the scene (1000 x 800) where each kind of thing can appear.
export const PUMPKIN_SLOTS = [
  { x: 240, y: 700, s: 1.1 },
  { x: 420, y: 712, s: 0.95 },
  { x: 600, y: 726, s: 1.2 },
  { x: 470, y: 352, s: 0.6 },
  { x: 650, y: 352, s: 0.6 },
  { x: 718, y: 478, s: 0.62 },
  { x: 770, y: 712, s: 0.9 },
  { x: 120, y: 218, s: 0.5 },
];

export const WEB_SLOTS = [
  { x: 0, y: 60, size: 150, dx: 1, dy: 1 },
  { x: 1000, y: 60, size: 130, dx: -1, dy: 1 },
  { x: 402, y: 148, size: 70, dx: -1, dy: 1 },
  { x: 176, y: 232, size: 62, dx: 1, dy: 1 },
  { x: 670, y: 516, size: 62, dx: 1, dy: 1 },
  { x: 476, y: 296, size: 54, dx: 1, dy: -1 },
];

export const BAT_SLOTS = [
  { x: 172, y: 96 }, { x: 255, y: 82 }, { x: 340, y: 104 }, { x: 430, y: 86 },
  { x: 700, y: 96 }, { x: 790, y: 82 }, { x: 880, y: 104 }, { x: 560, y: 80 },
];

export type Room = {
  seed: number;
  hour: number;
  pumpkins: { slot: number; lit: boolean }[];
  webs: number[];
  bats: number[];
  code: [number, number, number];
};

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const between = (r: () => number, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));

function pickSlots(r: () => number, total: number, count: number) {
  const all = Array.from({ length: total }, (_, i) => i);
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all.slice(0, count).sort((a, b) => a - b);
}

export function makeRoom(seed: number): Room {
  const r = rng(seed);
  const hour = between(r, 1, 12);

  // At least one plain pumpkin so "count the grins" means something.
  const pumpkinCount = between(r, 5, 7);
  const grins = between(r, 1, pumpkinCount - 1);
  const pumpkinSlots = pickSlots(r, PUMPKIN_SLOTS.length, pumpkinCount);
  const litSlots = new Set(pickSlots(r, pumpkinCount, grins).map((i) => pumpkinSlots[i]));
  const pumpkins = pumpkinSlots.map((slot) => ({ slot, lit: litSlots.has(slot) }));

  const webs = pickSlots(r, WEB_SLOTS.length, between(r, 2, 5));
  const bats = pickSlots(r, BAT_SLOTS.length, between(r, 2, 7));

  return { seed, hour, pumpkins, webs, bats, code: [grins, webs.length, bats.length] };
}

export const newSeed = () => Math.floor(Math.random() * 2 ** 31);

/** Escape time with tenths, e.g. 1:23.4. Used for scores and scorecards. */
export function formatScore(ms: number) {
  const t = Math.floor(ms / 100);
  const s = Math.floor(t / 10);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}.${t % 10}`;
}
