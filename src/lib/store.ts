import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { join } from "node:path";
import { connection } from "next/server";
import type { AppStatus, Application, Claim, ClaimList, Snapshot } from "./airdrop";
import type { RoomId } from "./rooms";
import { ROUND, roundOpen } from "./rewards";

// Storage, first one configured wins:
//   Upstash Redis   UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN   (drop-in for heavy traffic)
//   Google Sheets   GOOGLE_SHEETS_WEBAPP_URL (Apps Script web app, see scripts/apps-script), like the militia site
//   JSON file       .data/ for local development
//
// Runs in progress are not stored at all: they live in signed tickets (see runs.ts). Only the two things a
// player could hide by replaying an old ticket, hints and wrong codes, are counted here.

/** The player behind a score. xid is the X account id, or "h:handle" for typed (developer test) handles. */
export type Account = {
  xid: string;
  handle: string;
  verified: boolean;
  /** Old and established enough on X to win $HAUNT. */
  eligible: boolean;
  xCreatedAt?: string;
  followers?: number;
  wallet?: string;
  /** X profile picture, full size. */
  avatar?: string;
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
  /** Position on the prize round's board, when posted during the round. */
  roundRank?: number;
  /** Escape number in this room, counting every posted run. */
  n: number;
  hidden?: boolean;
};

export type Stats = { escapes: number; souls: number; fastestMs: number | null };
/** A board is all time ("all"), the prize round (ROUND.id) or a single UTC day ("2026-10-31"). */
export type Period = string;
export type RunMarks = { hints: number; wrong: number };

export const dayOf = (at: number) => new Date(at).toISOString().slice(0, 10);
export const today = () => dayOf(Date.now());

const RUN_TTL = 60 * 60; // seconds: a run's hint and wrong-code counts are only needed for an hour
const DAY_TTL = 30 * 86400; // daily boards are kept a month

type NewScore = Omit<Score, "rank" | "dayRank" | "roundRank" | "n">;

interface Store {
  runMarks(id: string): Promise<RunMarks>;
  markRun(id: string, field: keyof RunMarks): Promise<RunMarks>;
  getAccount(xid: string): Promise<Account | null>;
  putAccount(a: Account): Promise<void>;
  banned(xid: string): Promise<boolean>;
  // Bans an account and takes all its entries off every board.
  ban(xid: string): Promise<void>;
  getScore(id: string): Promise<Score | null>;
  // Saves the score and returns it with its ranks. Null if this run was already posted.
  postScore(score: NewScore): Promise<Score | null>;
  // Takes one run off the boards.
  hide(score: Score): Promise<void>;
  top(room: RoomId, period: Period, n: number): Promise<Score[]>;
  recent(room: RoomId, n: number): Promise<Score[]>;
  stats(room: RoomId): Promise<Stats>;
  // Fixed-window rate limit. Returns true when the call is allowed.
  limit(key: string, max: number, windowSec: number): Promise<boolean>;

  // ---- $HAUNT allocation applications ----
  getApp(xid: string): Promise<Application | null>;
  // The application behind a card's permit id.
  appByPermit(permit: string): Promise<Application | null>;
  // Creates an application or changes a pending one's wallet. A wallet can belong to one application only.
  saveApp(app: Application): Promise<"ok" | "wallet_taken">;
  // Pending and rejected in the order they applied; approved in the order they were approved.
  listApps(status: AppStatus, offset: number, n: number): Promise<Application[]>;
  countApps(): Promise<Record<AppStatus, number>>;
  // Moves applications to a status in one go. Approvals stop at the cap; `capped` counts the ones refused.
  decide(xids: string[], status: AppStatus, cap: number): Promise<{ changed: number; capped: number }>;
  // A frozen claim list. Airdrop claims are looked up by wallet, reward claims by X account.
  getSnapshotMeta(list: ClaimList): Promise<Omit<Snapshot, "claims"> | null>;
  getClaim(list: ClaimList, key: string): Promise<Claim | null>;
  allClaims(list: ClaimList): Promise<Claim[]>;
  putSnapshot(list: ClaimList, s: Snapshot | null): Promise<void>;
}

const STATUSES: AppStatus[] = ["pending", "approved", "rejected"];
const appScore = (a: Application) => (a.status === "approved" ? (a.decidedAt ?? a.appliedAt) : a.appliedAt);
/** How a claim is found: airdrop entries by wallet, game reward entries by X account (one wallet could win twice). */
const claimKey = (list: ClaimList, c: Claim) => (list === "rewards" ? c.xid! : c.account.toLowerCase());
const metaOf = (s: Snapshot): Omit<Snapshot, "claims"> => ({ merkleRoot: s.merkleRoot, tokenTotal: s.tokenTotal, decimals: s.decimals, frozenAt: s.frozenAt });

// Every board a score belongs on: all time, its day, and the prize round if it was posted before the round ended.
const periodsOf = (s: { day: string; at: number }) => ["all", s.day, ...(roundOpen(s.at) ? [ROUND.id] : [])];
const onBoard = (s: Score, period: Period) => period === "all" || (period === ROUND.id ? roundOpen(s.at) : s.day === period);

/**
 * A board computed from a full list of scores: each account's fastest visible run, fastest first.
 * Used by the file and sheet stores; Upstash keeps sorted sets instead.
 */
function boardFrom(scores: Score[], bans: Set<string>, room: RoomId, period: Period) {
  const best = new Map<string, Score>();
  for (const s of scores) {
    if (s.room !== room || s.hidden || bans.has(s.xid) || !onBoard(s, period)) continue;
    const prev = best.get(s.xid);
    if (!prev || s.ms < prev.ms || (s.ms === prev.ms && s.at < prev.at)) best.set(s.xid, s);
  }
  return [...best.values()].sort((a, b) => a.ms - b.ms || a.at - b.at);
}

/** Ranks for a new score against everything already posted, then the score itself. */
function ranked(scores: Score[], bans: Set<string>, s: NewScore): Score {
  const rankIn = (period: Period) => boardFrom(scores, bans, s.room, period).filter((o) => o.xid !== s.xid && o.ms < s.ms).length + 1;
  return {
    ...s,
    rank: rankIn("all"),
    dayRank: rankIn(s.day),
    ...(roundOpen(s.at) ? { roundRank: rankIn(ROUND.id) } : {}),
    n: scores.filter((o) => o.room === s.room).length + 1,
  };
}

const statsFrom = (scores: Score[], bans: Set<string>, room: RoomId): Stats => {
  const b = boardFrom(scores, bans, room, "all");
  return { escapes: scores.filter((s) => s.room === room).length, souls: b.length, fastestMs: b[0]?.ms ?? null };
};

// Fixed-window rate limits kept in this server's memory. Used by the file and sheet stores: each server
// instance counts on its own, which is enough to slow down scripted floods.
const windows = new Map<string, { n: number; reset: number }>();
function memoryLimit(key: string, max: number, windowSec: number) {
  const now = Date.now();
  const w = windows.get(key);
  if (!w || w.reset < now) {
    windows.set(key, { n: 1, reset: now + windowSec * 1000 });
    return true;
  }
  return ++w.n <= max;
}

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
  async runMarks(id) {
    const [h, w] = await redis<(string | null)[]>("HMGET", `run:${id}`, "hints", "wrong");
    return { hints: Number(h ?? 0), wrong: Number(w ?? 0) };
  },
  async markRun(id, field) {
    await redis("HINCRBY", `run:${id}`, field, 1);
    await redis("EXPIRE", `run:${id}`, RUN_TTL);
    return upstash.runMarks(id);
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
      for (const p of ["all", ROUND.id, ...days]) {
        await redis("ZREM", lbKey(room, p), xid);
        await redis("DEL", bestKey(room, p, xid));
      }
    }
  },
  getScore: (id) => getJson<Score>(`score:${id}`),
  async postScore(s) {
    // Claims the run id first, so the same run can't be posted twice.
    if ((await redis<string | null>("SET", `score:${s.id}`, "{}", "NX")) !== "OK") return null;
    const ranks: number[] = [];
    for (const p of periodsOf(s)) {
      // LT only replaces the account's time when the new one is lower.
      await redis("ZADD", lbKey(s.room, p), "LT", s.ms, s.xid);
      if (p === s.day) await redis("EXPIRE", lbKey(s.room, p), DAY_TTL);
      const best = await redis<string | null>("ZSCORE", lbKey(s.room, p), s.xid);
      if (Number(best) === s.ms) await redis("SET", bestKey(s.room, p, s.xid), s.id, ...(p === s.day ? ["EX", DAY_TTL] : []));
      ranks.push((await redis<number>("ZCOUNT", lbKey(s.room, p), "-inf", `(${s.ms}`)) + 1);
    }
    const n = await redis<number>("INCR", `escapes:${s.room}`);
    const score: Score = { ...s, rank: ranks[0], dayRank: ranks[1], ...(ranks[2] ? { roundRank: ranks[2] } : {}), n };
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

  getApp: (xid) => getJson<Application>(`app:${xid}`),
  async appByPermit(permit) {
    const xid = await redis<string | null>("GET", `permit:${permit}`);
    return xid ? upstash.getApp(xid) : null;
  },
  async saveApp(app) {
    const wkey = `appwallet:${app.wallet.toLowerCase()}`;
    if ((await redis<string | null>("SET", wkey, app.xid, "NX")) !== "OK" && (await redis<string | null>("GET", wkey)) !== app.xid) return "wallet_taken";
    const prev = await upstash.getApp(app.xid);
    if (prev && prev.wallet.toLowerCase() !== app.wallet.toLowerCase()) await redis("DEL", `appwallet:${prev.wallet.toLowerCase()}`);
    await redis("SET", `app:${app.xid}`, JSON.stringify(app));
    await redis("ZADD", `apps:${app.status}`, appScore(app), app.xid);
    if (app.permit) await redis("SET", `permit:${app.permit}`, app.xid);
    return "ok";
  },
  async listApps(status, offset, n) {
    const xids = await redis<string[]>("ZRANGE", `apps:${status}`, offset, offset + n - 1);
    if (!xids.length) return [];
    const vals = await redis<(string | null)[]>("MGET", ...xids.map((x) => `app:${x}`));
    return vals.filter(Boolean).map((v) => JSON.parse(v!) as Application);
  },
  async countApps() {
    const n = await Promise.all(STATUSES.map((st) => redis<number>("ZCARD", `apps:${st}`)));
    return { pending: n[0], approved: n[1], rejected: n[2] };
  },
  async decide(xids, status, cap) {
    let changed = 0;
    let capped = 0;
    for (const xid of xids) {
      const app = await upstash.getApp(xid);
      if (!app || app.status === status) continue;
      if (status === "approved" && (await redis<number>("ZCARD", "apps:approved")) >= cap) {
        capped++;
        continue;
      }
      const next = { ...app, status, decidedAt: Date.now() };
      await redis("ZADD", `apps:${status}`, appScore(next), xid);
      // Two admins approving at once could both pass the check above; the later one steps back.
      if (status === "approved" && (await redis<number>("ZCARD", "apps:approved")) > cap) {
        await redis("ZREM", "apps:approved", xid);
        capped++;
        continue;
      }
      await redis("ZREM", `apps:${app.status}`, xid);
      await redis("SET", `app:${xid}`, JSON.stringify(next));
      changed++;
    }
    return { changed, capped };
  },
  getSnapshotMeta: (list) => getJson<Omit<Snapshot, "claims">>(`${list}:meta`),
  getClaim: (list, key) => getJson<Claim>(`${list}:claim:${key.toLowerCase()}`),
  async allClaims(list) {
    const keys = await redis<string[]>("LRANGE", `${list}:keys`, 0, -1);
    const out: Claim[] = [];
    for (let i = 0; i < keys.length; i += 200) {
      const vals = await redis<(string | null)[]>("MGET", ...keys.slice(i, i + 200).map((k) => `${list}:claim:${k}`));
      out.push(...vals.filter(Boolean).map((v) => JSON.parse(v!) as Claim));
    }
    return out.sort((a, b) => a.index - b.index);
  },
  async putSnapshot(list, snap) {
    // Clear the old list first, in batches small enough for one request each.
    const old = await redis<string[]>("LRANGE", `${list}:keys`, 0, -1);
    for (let i = 0; i < old.length; i += 200) await redis("DEL", ...old.slice(i, i + 200).map((k) => `${list}:claim:${k}`));
    await redis("DEL", `${list}:keys`, `${list}:meta`);
    if (!snap) return;
    for (let i = 0; i < snap.claims.length; i += 200) {
      const batch = snap.claims.slice(i, i + 200);
      await redis("MSET", ...batch.flatMap((c) => [`${list}:claim:${claimKey(list, c).toLowerCase()}`, JSON.stringify(c)]));
      await redis("RPUSH", `${list}:keys`, ...batch.map((c) => claimKey(list, c).toLowerCase()));
    }
    await redis("SET", `${list}:meta`, JSON.stringify(metaOf(snap)));
  },
};

// ---------- Google Sheets (Apps Script web app) ----------
const SHEETS_URL = process.env.GOOGLE_SHEETS_WEBAPP_URL;
const SHEETS_SECRET = process.env.SHEETS_WEBHOOK_SECRET;
// Lists are cached per server instance to spare Apps Script quota, so boards can lag by up to this long.
const LIST_TTL = 15_000;

async function sheetGet<T>(params: Record<string, string>): Promise<T> {
  const url = new URL(SHEETS_URL!);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  if (SHEETS_SECRET) url.searchParams.set("secret", SHEETS_SECRET);
  const res = await fetch(url, { cache: "no-store", redirect: "follow", signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Sheets web app returned ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(`Sheets web app: ${data.error}`);
  return data as T;
}

async function sheetPost<T>(body: Record<string, unknown>): Promise<T & { error?: string }> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(SHEETS_URL!, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, secret: SHEETS_SECRET }),
      redirect: "follow",
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) throw new Error(`Sheets web app returned ${res.status}`);
    const data = await res.json();
    // "busy" means the script lock was held for 20s; worth a couple of retries
    if (data.error === "busy" && attempt < 2) {
      await new Promise((r) => setTimeout(r, 500 + attempt * 800));
      continue;
    }
    return data;
  }
}

async function sheetWrite(body: Record<string, unknown>) {
  const d = await sheetPost<Record<string, unknown>>(body);
  if (d.error) throw new Error(`Sheets web app: ${d.error}`);
  return d;
}

/** A list read from the sheet, cached per instance and shared between simultaneous requests. */
function cachedList<T>(param: string, field: string) {
  let cache: { at: number; items: T[] } | null = null;
  let loading: Promise<T[]> | null = null;
  return {
    async get(): Promise<T[]> {
      if (cache && Date.now() - cache.at < LIST_TTL) return cache.items;
      loading ??= sheetGet<Record<string, T[]>>({ [param]: "1" })
        .then((d) => {
          cache = { at: Date.now(), items: d[field] };
          return d[field];
        })
        .finally(() => {
          loading = null;
        });
      return loading;
    },
    /** Applies this instance's own write straight away instead of waiting for the next read. */
    update(fn: (items: T[]) => T[]) {
      if (cache) cache = { ...cache, items: fn(cache.items) };
    },
    clear() {
      cache = null;
    },
  };
}

const sheetScores = cachedList<Score>("scores", "scores");
const sheetBans = cachedList<string>("bans", "bans");
const sheetApps = cachedList<Application>("apps", "apps");
const sheetClaims = { airdrop: cachedList<Claim>("claims_airdrop", "claims"), rewards: cachedList<Claim>("claims_rewards", "claims") };
const banSet = async () => new Set(await sheetBans.get());

/**
 * Drops this server's cached sheet lists so the next reads are exact. Admin pages call it: the public board
 * can lag a few seconds, but a review screen has to show a hide or an approval straight away.
 */
export function freshReads() {
  [sheetScores, sheetBans, sheetApps, sheetClaims.airdrop, sheetClaims.rewards].forEach((l) => l.clear());
}
const fmtMs = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}.${Math.floor(ms / 100) % 10}`;

// Human readable columns written next to the raw record, so the team can read and filter the sheet.
const scoreColumns = (s: Score) => ({ time: fmtMs(s.ms), round: roundOpen(s.at) ? ROUND.name : "" });

const sheets: Store = {
  async runMarks(id) {
    return sheetGet<RunMarks>({ run: id });
  },
  async markRun(id, field) {
    const d = await sheetWrite({ action: "markRun", id, field });
    return { hints: Number(d.hints ?? 0), wrong: Number(d.wrong ?? 0) };
  },
  async getAccount(xid) {
    return (await sheetGet<{ account: Account | null }>({ account: xid })).account;
  },
  async putAccount(a) {
    await sheetWrite({ action: "putAccount", account: a });
  },
  async banned(xid) {
    return (await banSet()).has(xid);
  },
  async ban(xid) {
    await sheetWrite({ action: "ban", xid });
    sheetBans.update((b) => [...b, xid]);
  },
  async getScore(id) {
    const cached = (await sheetScores.get()).find((s) => s.id === id);
    return cached ?? (await sheetGet<{ score: Score | null }>({ score: id })).score;
  },
  async postScore(s) {
    // Ranks come from this instance's view of the board; the sheet only refuses a run posted twice.
    const score = ranked(await sheetScores.get(), await banSet(), s);
    const d = await sheetPost<{ ok?: boolean }>({ action: "postScore", score, display: scoreColumns(score) });
    if (d.error === "duplicate") return null;
    if (d.error) throw new Error(`Sheets web app: ${d.error}`);
    sheetScores.update((list) => [...list, score]);
    return score;
  },
  async hide(s) {
    await sheetWrite({ action: "hideScore", id: s.id });
    sheetScores.update((list) => list.map((o) => (o.id === s.id ? { ...o, hidden: true } : o)));
  },
  async top(room, period, n) {
    return boardFrom(await sheetScores.get(), await banSet(), room, period)
      .slice(0, n)
      .map((s, i) => ({ ...s, rank: i + 1 }));
  },
  async recent(room, n) {
    const bans = await banSet();
    return (await sheetScores.get())
      .filter((s) => s.room === room && !s.hidden && !bans.has(s.xid))
      .sort((a, b) => b.at - a.at)
      .slice(0, n);
  },
  async stats(room) {
    return statsFrom(await sheetScores.get(), await banSet(), room);
  },
  limit: async (key, max, windowSec) => memoryLimit(key, max, windowSec),

  async getApp(xid) {
    return (await sheetGet<{ app: Application | null }>({ app: xid })).app;
  },
  async appByPermit(permit) {
    return (await sheetApps.get()).find((a) => a.permit === permit) ?? null;
  },
  async saveApp(app) {
    // The script checks the wallet isn't on another application inside its lock.
    const d = await sheetPost<{ ok?: boolean }>({ action: "saveApp", app });
    if (d.error === "wallet_taken") return "wallet_taken";
    if (d.error) throw new Error(`Sheets web app: ${d.error}`);
    sheetApps.update((list) => [...list.filter((a) => a.xid !== app.xid), app]);
    return "ok";
  },
  async listApps(status, offset, n) {
    return (await sheetApps.get())
      .filter((a) => a.status === status)
      .sort((a, b) => appScore(a) - appScore(b))
      .slice(offset, offset + n);
  },
  async countApps() {
    const apps = await sheetApps.get();
    return { pending: 0, approved: 0, rejected: 0, ...Object.fromEntries(STATUSES.map((st) => [st, apps.filter((a) => a.status === st).length])) };
  },
  async decide(xids, status, cap) {
    // One call for the whole batch. The cap is checked inside the script's lock, so two admins can't pass it together.
    const d = await sheetWrite({ action: "decide", xids, status, cap, now: Date.now() });
    sheetApps.clear();
    return { changed: Number(d.changed ?? 0), capped: Number(d.capped ?? 0) };
  },
  async getSnapshotMeta(list) {
    return (await sheetGet<{ meta: Omit<Snapshot, "claims"> | null }>({ meta: list })).meta;
  },
  async getClaim(list, key) {
    return (await sheetClaims[list].get()).find((c) => claimKey(list, c).toLowerCase() === key.toLowerCase()) ?? null;
  },
  async allClaims(list) {
    return [...(await sheetClaims[list].get())].sort((a, b) => a.index - b.index);
  },
  async putSnapshot(list, snap) {
    await sheetWrite({ action: "putSnapshot", list, meta: snap ? metaOf(snap) : null, claims: snap?.claims ?? [] });
    sheetClaims[list].clear();
  },
};

// ---------- Local file ----------
// For local development only. Reads the file fresh on every call: Next.js loads each
// route as its own bundle, so an in-memory copy would go stale between routes.
type Db = {
  marks: Record<string, RunMarks & { at: number }>;
  scores: Record<string, Score>;
  accounts: Record<string, Account>;
  bans: Record<string, number>;
  apps: Record<string, Application>;
  /** lowercase wallet → xid of the application using it */
  appWallets: Record<string, string>;
  snapshots: Partial<Record<ClaimList, Snapshot>>;
};
const EMPTY: Db = { marks: {}, scores: {}, accounts: {}, bans: {}, apps: {}, appWallets: {}, snapshots: {} };
const DIR = join(process.cwd(), ".data");
const FILE = join(DIR, "haunt.json");
let queue: Promise<unknown> = Promise.resolve();

async function db(): Promise<Db> {
  try {
    return { ...structuredClone(EMPTY), ...JSON.parse(await readFile(FILE, "utf8")) };
  } catch {
    return structuredClone(EMPTY);
  }
}

// The file store can't work on serverless hosts (read only disk, many instances), so fail loudly there.
const serverless = Boolean(process.env.VERCEL || process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME);

// Read, change and write back as one step.
function mutate<T>(fn: (d: Db) => T) {
  if (serverless) throw new Error("No database configured: set GOOGLE_SHEETS_WEBAPP_URL (see scripts/apps-script/README.md).");
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

const fileBans = (d: Db) => new Set(Object.keys(d.bans));

const file: Store = {
  async runMarks(id) {
    const m = (await db()).marks[id];
    return { hints: m?.hints ?? 0, wrong: m?.wrong ?? 0 };
  },
  async markRun(id, field) {
    return mutate((d) => {
      const m = (d.marks[id] ??= { hints: 0, wrong: 0, at: Date.now() });
      m[field] += 1;
      return { hints: m.hints, wrong: m.wrong };
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
      if (d.scores[s.id]) return null;
      const score = ranked(Object.values(d.scores), fileBans(d), s);
      d.scores[s.id] = score;
      return score;
    });
  },
  async hide(s) {
    await mutate((d) => {
      if (d.scores[s.id]) d.scores[s.id].hidden = true;
    });
  },
  async top(room, period, n) {
    const d = await db();
    return boardFrom(Object.values(d.scores), fileBans(d), room, period)
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
    return statsFrom(Object.values(d.scores), fileBans(d), room);
  },
  limit: async (key, max, windowSec) => memoryLimit(key, max, windowSec),

  async getApp(xid) {
    return (await db()).apps[xid] ?? null;
  },
  async appByPermit(permit) {
    return Object.values((await db()).apps).find((a) => a.permit === permit) ?? null;
  },
  async saveApp(app) {
    return mutate((d) => {
      const w = app.wallet.toLowerCase();
      if (d.appWallets[w] && d.appWallets[w] !== app.xid) return "wallet_taken" as const;
      const prev = d.apps[app.xid];
      if (prev) delete d.appWallets[prev.wallet.toLowerCase()];
      d.appWallets[w] = app.xid;
      d.apps[app.xid] = app;
      return "ok" as const;
    });
  },
  async listApps(status, offset, n) {
    return Object.values((await db()).apps)
      .filter((a) => a.status === status)
      .sort((a, b) => appScore(a) - appScore(b))
      .slice(offset, offset + n);
  },
  async countApps() {
    const apps = Object.values((await db()).apps);
    return { pending: 0, approved: 0, rejected: 0, ...Object.fromEntries(STATUSES.map((st) => [st, apps.filter((a) => a.status === st).length])) };
  },
  async decide(xids, status, cap) {
    return mutate((d) => {
      let changed = 0;
      let capped = 0;
      for (const xid of xids) {
        const app = d.apps[xid];
        if (!app || app.status === status) continue;
        if (status === "approved" && Object.values(d.apps).filter((a) => a.status === "approved").length >= cap) {
          capped++;
          continue;
        }
        d.apps[xid] = { ...app, status, decidedAt: Date.now() };
        changed++;
      }
      return { changed, capped };
    });
  },
  async getSnapshotMeta(list) {
    const snap = (await db()).snapshots[list];
    return snap ? metaOf(snap) : null;
  },
  async getClaim(list, key) {
    return (await db()).snapshots[list]?.claims.find((c) => claimKey(list, c).toLowerCase() === key.toLowerCase()) ?? null;
  },
  async allClaims(list) {
    return (await db()).snapshots[list]?.claims ?? [];
  },
  async putSnapshot(list, snap) {
    await mutate((d) => {
      if (snap) d.snapshots[list] = snap;
      else delete d.snapshots[list];
    });
  },
};

const store: Store = URL_ && TOKEN ? upstash : SHEETS_URL ? sheets : file;
export const storageName = URL_ && TOKEN ? "upstash" : SHEETS_URL ? "sheets" : "file";

export type BoardData = { room: RoomId; latest: Score[]; fastest: Score[]; round: Score[]; stats: Stats };

/** Everything the homepage board shows for a room, read live. Null when storage can't be reached. */
export async function boardData(room: RoomId): Promise<BoardData | null> {
  await connection();
  try {
    const [latest, fastest, round, stats] = await Promise.all([store.recent(room, 8), store.top(room, "all", 8), store.top(room, ROUND.id, 8), store.stats(room)]);
    return { room, latest, fastest, round, stats };
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
  ms: s.ms, hints: s.hints, at: s.at, day: s.day, rank: s.rank, dayRank: s.dayRank, roundRank: s.roundRank, n: s.n,
});
export type PublicScore = ReturnType<typeof publicScore>;

export default store;
