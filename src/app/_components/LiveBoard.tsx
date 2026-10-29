"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useClock } from "./useClock";
import { formatScore } from "@/lib/room";
import { ROOMS, ROOM_IDS, type RoomId } from "@/lib/rooms";
import type { PublicScore, Stats } from "@/lib/store";

export type PublicBoard = { room: RoomId; day: string; latest: PublicScore[]; fastest: PublicScore[]; today: PublicScore[]; stats: Stats };

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

export default function LiveBoard({ initial }: { initial: Record<RoomId, PublicBoard> }) {
  const [boards, setBoards] = useState(initial);
  const [room, setRoom] = useState<RoomId>("study");
  const [period, setPeriod] = useState<"today" | "all">("today");
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

  const { latest, fastest, today, stats } = boards[room];
  const ranked = period === "today" ? today : fastest;

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
          <span className="stat-label">Escapes</span>
          <span className="stat-value">{stats.escapes}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Souls on the board</span>
          <span className="stat-value">{stats.souls}</span>
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
              {(["today", "all"] as const).map((p) => (
                <button key={p} role="tab" aria-selected={p === period} className={`mini-tab${p === period ? " mini-tab-on" : ""}`} onClick={() => setPeriod(p)}>
                  {p === "today" ? "Today" : "All time"}
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
                </li>
              ))}
            </ol>
          ) : (
            <p className="panel-empty">{period === "today" ? "Today's top spot is still unclaimed. Take it." : "The top spot is still unclaimed. Take it."}</p>
          )}
          <footer className="panel-foot">
            <span>Today resets at 00:00 UTC</span>
            <Link href={`/leaderboard?room=${room}&period=${period}`} className="panel-link">See all</Link>
          </footer>
        </section>
      </div>
    </>
  );
}
