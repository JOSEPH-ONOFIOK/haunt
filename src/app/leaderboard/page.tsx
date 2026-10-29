import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import TopBar from "../_components/TopBar";
import Leaderboard, { BoardSkeleton } from "../_components/Leaderboard";
import { HINT_PENALTY_MS } from "@/lib/room";
import { REWARDS, ROUND, ROUND_TOTAL, fmtHaunt } from "@/lib/rewards";
import { ROOMS, ROOM_IDS, isRoomId, type RoomId } from "@/lib/rooms";

export const metadata: Metadata = {
  title: "Leaderboard",
  description: "The fastest souls to escape the HAUNT mansion.",
};

type Props = { searchParams: Promise<{ room?: string; period?: string }> };

async function Board({ searchParams }: Props) {
  const q = await searchParams;
  const room: RoomId = isRoomId(q.room) ? q.room : "study";
  const period = q.period === "all" ? "all" : "round";
  return (
    <>
      <div className="tabs">
        {ROOM_IDS.map((r) => (
          <Link key={r} href={`/leaderboard?room=${r}&period=${period}`} className={`tab${r === room ? " tab-on" : ""}`}>{ROOMS[r].name}</Link>
        ))}
        <span className="tabs-gap" />
        {(["round", "all"] as const).map((p) => (
          <Link key={p} href={`/leaderboard?room=${room}&period=${p}`} className={`tab${p === period ? " tab-on" : ""}`}>{p === "round" ? ROUND.name : "All time"}</Link>
        ))}
      </div>
      <Leaderboard room={room} period={period} limit={50} />
    </>
  );
}

export default function LeaderboardPage(props: Props) {
  return (
    <>
      <TopBar>
        <Link href="/play" className="btn btn-green btn-sm">Play</Link>
      </TopBar>
      <main className="wrap section">
        <h1 className="section-title">The <em>fastest</em> souls</h1>
        <p className="section-lead">
          The top {REWARDS.length} of {ROUND.name} each win {fmtHaunt(REWARDS[0])} ({fmtHaunt(ROUND_TOTAL)} in total). The round ends 2 hours
          before Halloween ({new Date(ROUND.endsAt).toUTCString().replace(" GMT", " UTC")}). Best escape per X account; hints add {HINT_PENALTY_MS / 1000} seconds
          each. Winners are checked before payouts. Separate from the X airdrop.
        </p>
        <Suspense fallback={<BoardSkeleton rows={10} />}>
          <Board {...props} />
        </Suspense>
      </main>
    </>
  );
}
