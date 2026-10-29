"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useClock } from "./useClock";
import { formatScore } from "@/lib/room";
import { REWARDS, ROUND, fmtHaunt, rewardFor } from "@/lib/rewards";
import { ROOMS, ROOM_IDS, type RoomId } from "@/lib/rooms";
import type { PublicScore, Stats } from "@/lib/store";

export type PublicBoard = { room: RoomId; latest: PublicScore[]; fastest: PublicScore[]; round: PublicScore[]; stats: Stats };

const REFRESH_MS = 15_000;

function ago(at: number, now: number | null) {
  if (now === null) return "";
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const hintText = (h: number) => (h ? `${h} hint${h === 1 ? "" : "s"}` : "no hints");

function untilEnd(now: number | null) {
  if (now === null) return "--";
  const s = Math.max(0, Math.floor((new Date(ROUND.endsAt).getTime() - now) / 1000));
  if (s === 0) return "Ended";
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m ${s % 60}s`;
}

export default function LiveBoard({ initial }: { initial: Record<RoomId, PublicBoard> }) {
  const [boards, setBoards] = useState(initial);
  const [room, setRoom] = useState<RoomId>("study");
  const [period, setPeriod] = useState<"round" | "all">("round");
  const now = useClock();

  useEffect(() => {
    const id = setInterval(async () => {
      if (document.hidden) return;
      try {
        const res = await fetch(`/api/board?room=${room}`, { cache: "no-store" });
        if (res.ok) {
          const data: PublicBoard = await res.json();
          setBoards((b) => ({ ...b, [room]: data }));
        }
      } catch {
        // keep showing the last board
      }
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, [room]);

  const { latest, fastest, round, stats } = boards[room];
  const ranked = period === "round" ? round : fastest;
  const ended = untilEnd(now) === "Ended";

  return (
    <>
      <div className="tabs" role="tablist" aria-label="Room">
        {ROOM_IDS.map((r) => (
          <button key={r} role="tab" aria-selected={r === room} className={`tab${r === room ? " tab-on" : ""}`} onClick={() => setRoom(r)}>
            {ROOMS[r].name}
          </button>
        ))}
      </div>

      <div className="stats">
        <div className="stat stat-hot">
          <span className="stat-label">Fastest escape</span>
          <span className="stat-value">{stats.fastestMs === null ? "--" : formatScore(stats.fastestMs)}</span>
          <span className="stat-sub">{fastest[0] ? `by ${fastest[0].name}` : "Still unclaimed"}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Top {REWARDS.length} win</span>
          <span className="stat-value">{REWARDS[0].toLocaleString("en-US")}</span>
          <span className="stat-sub">$HAUNT each</span>
        </div>
        <div className="stat">
          <span className="stat-label">{ROUND.name} {ended ? "" : "ends in"}</span>
          <span className="stat-value">{untilEnd(now)}</span>
          <span className="stat-sub">{ended ? "Winners are being verified" : "2 hours before Halloween"}</span>
        </div>
      </div>

      <div className="board-grid">
        <section className="board-panel" aria-labelledby="latest-title">
          <header className="panel-head">
            <h3 id="latest-title">Latest winners</h3>
            <span className="live-pill"><i />Live</span>
          </header>
          {latest.length ? (
            <ul className="feed">
              {latest.map((s) => (
                <li key={s.id} className="feed-row">
                  <Image className="feed-avatar" src="/mascot.png" alt="" width={36} height={36} />
                  <div className="feed-who">
                    <Link href={`/s/${s.id}`} className="feed-name">{s.name}</Link>
                    <span className="feed-sub">Escape #{s.n} · {hintText(s.hints)}</span>
                  </div>
                  <span className="feed-time">{formatScore(s.ms)}</span>
                  <span className="feed-ago">{ago(s.at, now)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="panel-empty">No one has escaped {ROOMS[room].name.toLowerCase()} yet. The door is waiting.</p>
          )}
        </section>

        <section className="board-panel" aria-labelledby="fastest-title">
          <header className="panel-head">
            <h3 id="fastest-title">Fastest souls</h3>
            <div className="mini-tabs" role="tablist" aria-label="Period">
              {(["round", "all"] as const).map((p) => (
                <button key={p} role="tab" aria-selected={p === period} className={`mini-tab${p === period ? " mini-tab-on" : ""}`} onClick={() => setPeriod(p)}>
                  {p === "round" ? ROUND.name : "All time"}
                </button>
              ))}
            </div>
          </header>
          {ranked.length ? (
            <ol className="feed">
              {ranked.map((s) => (
                <li key={s.id} className={`feed-row${s.rank <= 3 ? " feed-podium" : ""}`}>
                  <span className="feed-rank">{s.rank}</span>
                  <div className="feed-who">
                    <Link href={`/s/${s.id}`} className="feed-name">{s.name}</Link>
                    <span className="feed-sub">{hintText(s.hints)}</span>
                  </div>
                  <span className="feed-time">{formatScore(s.ms)}</span>
                  {period === "round" && rewardFor(s.rank) > 0 && <span className="reward-chip">{fmtHaunt(rewardFor(s.rank))}</span>}
                </li>
              ))}
            </ol>
          ) : (
            <p className="panel-empty">
              {period === "round" ? `No one has claimed a winning spot yet. The top ${REWARDS.length} each win ${fmtHaunt(REWARDS[0])}.` : "The top spot is still unclaimed. Take it."}
            </p>
          )}
          <footer className="panel-foot">
            <span>{period === "round" ? `Top ${REWARDS.length} at the end of ${ROUND.name} win` : "Best time per X account"}</span>
            <Link href={`/leaderboard?room=${room}&period=${period}`} className="panel-link">See all</Link>
          </footer>
        </section>
      </div>
    </>
  );
}
