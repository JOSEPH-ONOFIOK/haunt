import { HINT_PENALTY_MS, LIMIT_MS } from "./room";

// Fastest believable escape. Anything quicker is a script, not a person.
export const MIN_MS = 20_000;
// Checkpoints closer together than this were not reached by hand.
export const MIN_STEP_GAP_MS = 800;
// From the last checkpoint to the final lock: reading the clue and setting the lock takes a few seconds at least.
export const MIN_FINAL_GAP_MS = 3_000;
// Wrong final codes the server accepts before it voids the run. The game checks codes itself first,
// so only a script guessing at the API ever sends one.
export const MAX_WRONG = 3;
// Allowance for the network between the lock opening and the server hearing about it.
export const GRACE_MS = 4_000;

export const fail = (error: string, status = 400) => Response.json({ error }, { status });

export function ipOf(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
}

export async function body<T>(req: Request): Promise<Partial<T>> {
  try {
    return (await req.json()) as Partial<T>;
  } catch {
    return {};
  }
}

export const officialMs = (startedAt: number, hints: number, now: number) => now - startedAt + hints * HINT_PENALTY_MS;
export const tooSlow = (ms: number) => ms > LIMIT_MS + GRACE_MS;

export const isRunId = (id: unknown): id is string => typeof id === "string" && /^[a-f0-9]{24}$/.test(id);

// Nicknames: 2 to 16 letters, numbers, spaces, dots, dashes or underscores.
const BLOCKED = ["fuck", "shit", "cunt", "nigg", "fag", "rape", "hitler", "nazi", "admin", "official", "moderator"];

export function cleanName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.normalize("NFKC").replace(/\s+/g, " ").trim();
  if (name.length < 2 || name.length > 16 || !/^[A-Za-z0-9 ._-]+$/.test(name)) return null;
  const flat = name.toLowerCase().replace(/[^a-z0-9]/g, "").replace(/0/g, "o").replace(/1/g, "i").replace(/3/g, "e").replace(/4/g, "a").replace(/5/g, "s");
  if (BLOCKED.some((w) => flat.includes(w))) return null;
  return name;
}

/** EVM wallet address for prize payouts. */
export const cleanWallet = (v: unknown) => (typeof v === "string" && /^0x[a-fA-F0-9]{40}$/.test(v.trim()) ? v.trim() : null);
