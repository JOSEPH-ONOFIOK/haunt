// The cellar: the second room, unlocked at launch. Answers are shuffled from a seed like the study.

export const POTIONS = [
  { name: "slime green", fill: "#5cff6a" },
  { name: "pumpkin orange", fill: "#ff8a1e" },
  { name: "witch purple", fill: "#a259ff" },
  { name: "bone white", fill: "#efe9d6" },
] as const;

// Four barrels sit along the floor. Each is either marked with an X or plain.
export const BARREL_X = [240, 365, 490, 615];

export type Cellar = {
  seed: number;
  /** Potion indexes in the order they must be poured. */
  order: number[];
  /** Which barrels are marked. A marked barrel means its lever is pulled down. */
  marks: boolean[];
  /** Lever positions that open the gate: 1 = down. */
  code: number[];
};

function rng(seed: number) {
  let a = (seed ^ 0x9e3779b9) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeCellar(seed: number): Cellar {
  const r = rng(seed);
  const order = [0, 1, 2, 3];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  // Between one and three marked barrels, so the answer is never all up or all down.
  let marks: boolean[];
  do marks = BARREL_X.map(() => r() < 0.5);
  while (marks.every(Boolean) || !marks.some(Boolean));
  return { seed, order, marks, code: marks.map((m) => (m ? 1 : 0)) };
}
