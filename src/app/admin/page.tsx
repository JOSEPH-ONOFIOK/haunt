import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import TopBar from "../_components/TopBar";
import { AdminLogin, RowActions } from "./AdminControls";
import store, { freshReads, today } from "@/lib/store";
import { adminConfigured, authMode, isAdmin } from "@/lib/auth";
import { HINT_PENALTY_MS, formatScore } from "@/lib/room";
import { REWARDS, ROUND, fmtHaunt, rewardFor, roundOpen } from "@/lib/rewards";
import { REWARDS_CLAIM_OPEN, REWARDS_CONTRACT } from "@/lib/airdrop";
import { FreezeControls } from "./airdrop/AppTable";
import { ROOMS, ROOM_IDS, STEPS, isRoomId, type RoomId } from "@/lib/rooms";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

type Props = { searchParams: Promise<{ room?: string; period?: string }> };

const sec = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

/** Gap before each checkpoint, then before the lock. Null where a checkpoint is missing. */
function gaps(room: RoomId, steps: Record<string, number>, ms: number) {
  let prev = 0;
  const out = STEPS[room].map((name) => {
    const at = steps[name];
    if (at === undefined) return { name, gap: null };
    const gap = at - prev;
    prev = at;
    return { name, gap };
  });
  return [...out, { name: "lock", gap: ms - prev }];
}

const ageDays = (iso?: string) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 864e5) : null);

/** Time between checkpoints. Suspiciously tiny gaps are worth a closer look before a payout. */
function Timeline({ room, steps, ms }: { room: RoomId; steps: Record<string, number>; ms: number }) {
  return (
    <span className="timeline">
      {gaps(room, steps, ms).map(({ name, gap }) => (
        <span key={name} className={gap !== null && gap < 2000 ? "gap-fast" : undefined}>
          {name} {gap === null ? "?" : `+${sec(gap)}`}
        </span>
      ))}
    </span>
  );
}

async function Admin({ searchParams }: Props) {
  await connection();
  if (!adminConfigured) return <p className="form-error">Set ADMIN_KEY and SESSION_SECRET to use this page.</p>;
  if (!(await isAdmin())) return <AdminLogin />;
  freshReads();

  const q = await searchParams;
  const room: RoomId = isRoomId(q.room) ? q.room : "study";
  const period = q.period && /^\d{4}-\d{2}-\d{2}$/.test(q.period) ? q.period : q.period === "all" ? "all" : q.period === "today" ? today() : ROUND.id;
  const scores = await store.top(room, period, 50);
  const rewardsMeta = period === ROUND.id && room === ROUND.room ? await store.getSnapshotMeta("rewards") : null;
  const ended = !roundOpen();
  const accounts = await Promise.all(scores.map((s) => store.getAccount(s.xid)));

  return (
    <>
      <nav className="tabs">
        <Link href="/admin" className="tab tab-on">Leaderboards</Link>
        <Link href="/admin/airdrop" className="tab">Allocation</Link>
      </nav>
      {authMode !== "x" && (
        <p className="form-error">Players type their X username, which X doesn&apos;t verify. Open each winner&apos;s X profile and check it before paying.</p>
      )}
      <div className="tabs">
        {ROOM_IDS.map((r) => (
          <Link key={r} href={`/admin?room=${r}&period=${period}`} className={`tab${r === room ? " tab-on" : ""}`}>{ROOMS[r].name}</Link>
        ))}
        <span className="tabs-gap" />
        <Link href={`/admin?room=${room}&period=${ROUND.id}`} className={`tab${period === ROUND.id ? " tab-on" : ""}`}>{ROUND.name}</Link>
        <Link href={`/admin?room=${room}&period=today`} className={`tab${period === today() ? " tab-on" : ""}`}>Today</Link>
        <Link href={`/admin?room=${room}&period=all`} className={`tab${period === "all" ? " tab-on" : ""}`}>All time</Link>
        <form className="day-pick" action="/admin">
          <input type="hidden" name="room" value={room} />
          <input className="input" type="date" name="period" defaultValue={/^\d/.test(period) ? period : today()} aria-label="Pick a day" />
          <button className="btn btn-sm">Go</button>
        </form>
        <a className="btn btn-sm btn-orange" href={`/api/admin/export?room=${room}&period=${period}`}>Export CSV</a>
      </div>

      {period === ROUND.id && room === ROUND.room && (
        <div className="freeze-box">
          {rewardsMeta ? (
            <>
              <p><b>Winners frozen</b> {new Date(rewardsMeta.frozenAt).toISOString().slice(0, 16).replace("T", " ")} UTC.</p>
              <p className="mono">Merkle root: {rewardsMeta.merkleRoot}</p>
              <p className="mono">Fund the rewards contract with: {rewardsMeta.tokenTotal} (base units, {rewardsMeta.decimals} decimals)</p>
              <p className="muted">Rewards contract: {REWARDS_CONTRACT ?? "not set"} · claims {REWARDS_CLAIM_OPEN ? "OPEN" : "closed"}.</p>
            </>
          ) : (
            <p className="muted">
              {ended
                ? `${ROUND.name} is over. Hide or ban anything suspicious first, then freeze the top ${REWARDS.length} into the rewards claim list.`
                : `${ROUND.name} ends ${new Date(ROUND.endsAt).toUTCString().replace(" GMT", " UTC")}. Winners can be frozen after that.`}
            </p>
          )}
          <div className="panel-actions" style={{ justifyContent: "flex-start" }}>
            <FreezeControls frozen={Boolean(rewardsMeta)} canFreeze={ended && scores.length > 0} base="/api/admin/rewards" what="winners" />
            {rewardsMeta && <a className="btn btn-sm btn-green" href="/api/admin/rewards/export">Download rewards claims JSON</a>}
          </div>
        </div>
      )}

      {!scores.length ? (
        <p className="board-empty">No entries on this board.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>#</th><th>Player</th><th>Time</th><th>Wallet</th><th>Checkpoints</th><th />
              </tr>
            </thead>
            <tbody>
              {scores.map((s, i) => {
                const a = accounts[i];
                const days = ageDays(a?.xCreatedAt);
                return (
                  <tr key={s.id}>
                    <td>
                      {s.rank}
                      {period === ROUND.id && rewardFor(s.rank) > 0 && <div className="reward-chip">{fmtHaunt(rewardFor(s.rank))}</div>}
                    </td>
                    <td>
                      <b>{s.name}</b>
                      <div className="muted">
                        <a href={`https://x.com/${s.handle}`} target="_blank" rel="noopener noreferrer">@{s.handle}</a>
                        {" · "}
                        {a?.verified ? (a.eligible ? "verified" : <span className="gap-fast">not eligible</span>) : <span className="gap-fast">unverified</span>}
                        {days !== null && ` · ${days}d old · ${a?.followers ?? 0} followers`}
                      </div>
                    </td>
                    <td>
                      {formatScore(s.ms)}
                      <div className="muted">{s.hints} hints</div>
                    </td>
                    <td className="mono">{s.wallet}</td>
                    <td><Timeline room={s.room} steps={s.steps} ms={s.ms - s.hints * HINT_PENALTY_MS} /></td>
                    <td><RowActions id={s.id} xid={s.xid} handle={s.handle} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export default function AdminPage(props: Props) {
  return (
    <>
      <TopBar />
      <main className="wrap section admin">
        <Suspense fallback={<p className="muted">Opening the crypt...</p>}>
          <Admin {...props} />
        </Suspense>
      </main>
    </>
  );
}
