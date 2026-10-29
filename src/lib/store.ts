import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { join } from "node:path";
import { connection } from "next/server";
import type { RoomId } from "./rooms";

// Storage, first one configured wins:
//   Upstash Redis   UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
//   JSON file       .data/ for local development

/** One play of a room, created by the server when the player presses Begin. */
export type Run = {
  id: string;
  room: RoomId;
  seed: number;
  startedAt: number;
  hints: number;
  /** Ms after the start at which each checkpoint was reached. */
  steps: Record<string, number>;
  /** Wrong final codes sent to the server. Real players never send one, so a few voids the run. */
  wrong: number;
  /** Official time in ms, set once the server has checked the final code. */
  ms?: number;
  /** Set when the run broke a rule and can no longer be posted. */
  void?: string;
};

/** The player behind a score. xid is the X account id, or "h:handle" for typed (unverified) handles. */
export type Account = {
  xid: string;
  handle: string;
  verified: boolean;
  /** Old and established enough on X to win prizes. */
  eligible: boolean;
  xCreatedAt?: string;
  followers?: number;
  wallet?: string;
  firstSeen: number;
};

/** A finished run posted to the board. */
export type Score = {
  id: string;
  room: RoomId;
  xid: string;
  handle: string;
  name: string;
  wallet: string;
  verified: boolean;
  ms: number;
  hints: number;
  at: number;
  /** UTC day it was posted, for the daily board. */
  day: string;
  steps: Record<string, number>;
  /** Positions when posted, printed on the scorecard. */
  rank: number;
  dayRank: number;
  /** Escape number in this room, counting every posted run. */
  n: number;
  hidden?: boolean;
};

export type Stats = { escapes: number; souls: number; fastestMs: number | null };
/** A board is all time ("all") or a single UTC day ("2026-10-31"). */
export type Period = string;

export const dayOf = (at: number) => new Date(at).toISOString().slice(0, 10);
export const today = () => dayOf(Date.now());

const RUN_TTL = 60 * 60; // a run can be finished and posted within an hour of starting
const DAY_TTL = 30 * 86400; // daily boards are kept a month for prize records

type NewScore = Omit<Score, "rank" | "dayRank" | "n">;

interface Store {
  getRun(id: string): Promise<Run | null>;
  putRun(run: Run): Promise<void>;
  // Claims a one-off action (finishing or posting a run). Returns false if it was already taken.
  once(key: string): Promise<boolean>;
  getAccount(xid: string): Promise<Account | null>;
  putAccount(a: Account): Promise<void>;
  banned(xid: string): Promise<boolean>;
  // Bans an account and takes all its entries off every board.
  ban(xid: string): Promise<void>;
  getScore(id: string): Promise<Score | null>;
  // Saves the score; on each board it replaces the account's entry only if it is faster.
  postScore(score: NewScore): Promise<Score>;
  // Hides one run and takes it off the boards it was leading for that account.
  hide(score: Score): Promise<void>;
  top(room: RoomId, period: Period, n: number): Promise<Score[]>;
  recent(room: RoomId, n: number): Promise<Score[]>;
  stats(room: RoomId): Promise<Stats>;
  // Fixed-window rate limit. Returns true when the call is allowed.
  limit(key: string, max: number, windowSec: number): Promise<boolean>;
}

const periodsOf = (s: { day: string }) => ["all", s.day];

// ---------- Upstash ----------
const URL_ = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis<T = unknown>(...cmd: (string | number)[]): Promise<T> {
  const res = await fetch(URL_!, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify(cmd),
    cache: "no-store",
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json.result as T;
}

const lbKey = (room: RoomId, period: Period) => `lb:${room}:${period}`;
const bestKey = (room: RoomId, period: Period, xid: string) => `best:${room}:${period}:${xid}`;
const getJson = async <T,>(key: string) => {
  const v = await redis<string | null>("GET", key);
  return v ? (JSON.parse(v) as T) : null;
};

async function scoresByIds(ids: (string | null)[]) {
  const found = ids.filter((id): id is string => Boolean(id));
  if (!found.length) return [];
  const vals = await redis<(string | null)[]>("MGET", ...found.map((id) => `score:${id}`));
  return vals.filter(Boolean).map((v) => JSON.parse(v!) as Score);
}

const upstash: Store = {
  getRun: (id) => getJson<Run>(`run:${id}`),
  async putRun(run) {
    await redis("SET", `run:${run.id}`, JSON.stringify(run), "EX", RUN_TTL);
  },
  async once(key) {
    return (await redis<string | null>("SET", `once:${key}`, "1", "NX", "EX", RUN_TTL)) === "OK";
  },
  getAccount: (xid) => getJson<Account>(`acct:${xid}`),
  async putAccount(a) {
    await redis("SET", `acct:${a.xid}`, JSON.stringify(a));
  },
  async banned(xid) {
    return (await redis<number>("EXISTS", `ban:${xid}`)) === 1;
  },
  async ban(xid) {
    await redis("SET", `ban:${xid}`, Date.now());
    for (const room of ["study", "cellar"] as RoomId[]) {
      const days = Array.from({ length: 31 }, (_, i) => dayOf(Date.now() - i * 864e5));
      for (const p of ["all", ...days]) {
        await redis("ZREM", lbKey(room, p), xid);
        await redis("DEL", bestKey(room, p, xid));
      }
    }
  },
  getScore: (id) => getJson<Score>(`score:${id}`),
  async postScore(s) {
    const ranks: number[] = [];
    for (const p of periodsOf(s)) {
      // LT only replaces the account's time when the new one is lower.
      await redis("ZADD", lbKey(s.room, p), "LT", s.ms, s.xid);
      if (p !== "all") await redis("EXPIRE", lbKey(s.room, p), DAY_TTL);
      const best = await redis<string | null>("ZSCORE", lbKey(s.room, p), s.xid);
      if (Number(best) === s.ms) await redis("SET", bestKey(s.room, p, s.xid), s.id, ...(p === "all" ? [] : ["EX", DAY_TTL]));
      ranks.push((await redis<number>("ZCOUNT", lbKey(s.room, p), "-inf", `(${s.ms}`)) + 1);
    }
    const n = await redis<number>("INCR", `escapes:${s.room}`);
    const score: Score = { ...s, rank: ranks[0], dayRank: ranks[1], n };
    await redis("SET", `score:${s.id}`, JSON.stringify(score));
    await redis("LPUSH", `recent:${s.room}`, s.id);
    await redis("LTRIM", `recent:${s.room}`, 0, 49);
    return score;
  },
  async hide(s) {
    await redis("SET", `score:${s.id}`, JSON.stringify({ ...s, hidden: true }));
    for (const p of periodsOf(s)) {
      if ((await redis<string | null>("GET", bestKey(s.room, p, s.xid))) === s.id) {
        await redis("ZREM", lbKey(s.room, p), s.xid);
        await redis("DEL", bestKey(s.room, p, s.xid));
      }
    }
  },
  async top(room, period, n) {
    const xids = await redis<string[]>("ZRANGE", lbKey(room, period), 0, n - 1);
    if (!xids.length) return [];
    const ids = await redis<(string | null)[]>("MGET", ...xids.map((x) => bestKey(room, period, x)));
    return (await scoresByIds(ids)).filter((s) => !s.hidden).map((s, i) => ({ ...s, rank: i + 1 }));
  },
  async recent(room, n) {
    const list = await scoresByIds(await redis<string[]>("LRANGE", `recent:${room}`, 0, n * 2 - 1));
    if (!list.length) return [];
    const bans = await redis<(string | null)[]>("MGET", ...list.map((s) => `ban:${s.xid}`));
    return list.filter((s, i) => !s.hidden && !bans[i]).slice(0, n);
  },
  async stats(room) {
    const [escapes, souls, first] = await Promise.all([
      redis<string | null>("GET", `escapes:${room}`),
      redis<number>("ZCARD", lbKey(room, "all")),
      redis<string[]>("ZRANGE", lbKey(room, "all"), 0, 0, "WITHSCORES"),
    ]);
    return { escapes: Number(escapes ?? 0), souls, fastestMs: first.length ? Number(first[1]) : null };
  },
  async limit(key, max, windowSec) {
    const n = await redis<number>("INCR", `rl:${key}`);
    if (n === 1) await redis("EXPIRE", `rl:${key}`, windowSec);
    return n <= max;
  },
};

// ---------- Local file ----------
// For local development only. Reads the file fresh on every call: Next.js loads each
// route as its own bundle, so an in-memory copy would go stale between routes.
type Db = {
  runs: Record<string, Run>;
  once: Record<string, number>;
  scores: Record<string, Score>;
  accounts: Record<string, Account>;
  bans: Record<string, number>;
  /** "room|period|xid" → id of that account's fastest score on that board */
  best: Record<string, string>;
};
const EMPTY: Db = { runs: {}, once: {}, scores: {}, accounts: {}, bans: {}, best: {} };
const DIR = join(process.cwd(), ".data");
const FILE = join(DIR, "haunt.json");
const windows = new Map<string, { n: number; reset: number }>();
let queue: Promise<unknown> = Promise.resolve();

async function db(): Promise<Db> {
  try {
    return { ...structuredClone(EMPTY), ...JSON.parse(await readFile(FILE, "utf8")) };
  } catch {
    return structuredClone(EMPTY);
  }
}

// Read, change and write back as one step.
function mutate<T>(fn: (d: Db) => T) {
  const run = queue.then(async () => {
    const d = await db();
    const out = fn(d);
    await mkdir(DIR, { recursive: true });
    const tmp = `${FILE}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tmp, JSON.stringify(d));
    await rename(tmp, FILE);
    return out;
  });
  queue = run.catch(() => {}); // keep the queue alive after a failure
  return run;
}

const bk = (room: string, period: string, xid: string) => `${room}|${period}|${xid}`;

function board(d: Db, room: RoomId, period: Period) {
  const prefix = `${room}|${period}|`;
  return Object.entries(d.best)
    .filter(([k]) => k.startsWith(prefix))
    .map(([, id]) => d.scores[id])
    .filter((s) => s && !s.hidden && !d.bans[s.xid])
    .sort((a, b) => a.ms - b.ms || a.at - b.at);
}

const file: Store = {
  async getRun(id) {
    return (await db()).runs[id] ?? null;
  },
  async putRun(run) {
    await mutate((d) => {
      d.runs[run.id] = run;
    });
  },
  async once(key) {
    return mutate((d) => {
      if (d.once[key]) return false;
      d.once[key] = Date.now();
      return true;
    });
  },
  async getAccount(xid) {
    return (await db()).accounts[xid] ?? null;
  },
  async putAccount(a) {
    await mutate((d) => {
      d.accounts[a.xid] = a;
    });
  },
  async banned(xid) {
    return Boolean((await db()).bans[xid]);
  },
  async ban(xid) {
    await mutate((d) => {
      d.bans[xid] = Date.now();
    });
  },
  async getScore(id) {
    return (await db()).scores[id] ?? null;
  },
  async postScore(s) {
    return mutate((d) => {
      const n = Object.values(d.scores).filter((o) => o.room === s.room).length + 1;
      const score: Score = { ...s, rank: 0, dayRank: 0, n };
      d.scores[s.id] = score;
      for (const p of periodsOf(s)) {
        const prev = d.scores[d.best[bk(s.room, p, s.xid)]];
        if (!prev || prev.hidden || s.ms < prev.ms) d.best[bk(s.room, p, s.xid)] = s.id;
      }
      score.rank = board(d, s.room, "all").filter((o) => o.ms < s.ms).length + 1;
      score.dayRank = board(d, s.room, s.day).filter((o) => o.ms < s.ms).length + 1;
      return score;
    });
  },
  async hide(s) {
    await mutate((d) => {
      if (d.scores[s.id]) d.scores[s.id].hidden = true;
      for (const p of periodsOf(s)) if (d.best[bk(s.room, p, s.xid)] === s.id) delete d.best[bk(s.room, p, s.xid)];
    });
  },
  async top(room, period, n) {
    return board(await db(), room, period)
      .slice(0, n)
      .map((s, i) => ({ ...s, rank: i + 1 }));
  },
  async recent(room, n) {
    const d = await db();
    return Object.values(d.scores)
      .filter((s) => s.room === room && !s.hidden && !d.bans[s.xid])
      .sort((a, b) => b.at - a.at)
      .slice(0, n);
  },
  async stats(room) {
    const d = await db();
    const b = board(d, room, "all");
    return { escapes: Object.values(d.scores).filter((s) => s.room === room).length, souls: b.length, fastestMs: b[0]?.ms ?? null };
  },
  async limit(key, max, windowSec) {
    const now = Date.now();
    const w = windows.get(key);
    if (!w || w.reset < now) {
      windows.set(key, { n: 1, reset: now + windowSec * 1000 });
      return true;
    }
    return ++w.n <= max;
  },
};

const store: Store = URL_ && TOKEN ? upstash : file;

export type BoardData = { room: RoomId; day: string; latest: Score[]; fastest: Score[]; today: Score[]; stats: Stats };

/** Everything the homepage board shows for a room, read live. Null when storage can't be reached. */
export async function boardData(room: RoomId): Promise<BoardData | null> {
  await connection();
  const day = today();
  try {
    const [latest, fastest, todays, stats] = await Promise.all([store.recent(room, 8), store.top(room, "all", 8), store.top(room, day, 8), store.stats(room)]);
    return { room, day, latest, fastest, today: todays, stats };
  } catch {
    return null;
  }
}

/** A leaderboard read for server components. Never prerendered. */
export async function topScores(room: RoomId, period: Period, n: number) {
  await connection();
  try {
    return await store.top(room, period, n);
  } catch {
    return null;
  }
}

/** What anyone may see of a score: no wallet, no account id, no step timeline. */
export const publicScore = (s: Score) => ({
  id: s.id, room: s.room, name: s.name, handle: s.handle, verified: s.verified,
  ms: s.ms, hints: s.hints, at: s.at, day: s.day, rank: s.rank, dayRank: s.dayRank, n: s.n,
});
export type PublicScore = ReturnType<typeof publicScore>;

export default store;
