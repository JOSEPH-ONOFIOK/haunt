"use client";

import Link from "next/link";
import PostScore from "../../_components/PostScore";
import type { Official } from "./useRun";
import { HINT_PENALTY_MS, formatScore } from "@/lib/room";
import type { RoomId } from "@/lib/rooms";

type Props = {
  room: RoomId;
  localMs: number;
  hints: number;
  runId: string | null;
  official: Official | null;
  onRestart: () => void;
};

export default function Result({ room, localMs, hints, runId, official, onRestart }: Props) {
  const ms = official?.ms ?? localMs;

  return (
    <div className="panel panel-wide">
      <h2 className="spooky panel-title">You escaped!</h2>
      <div className="big-time spooky">{formatScore(ms)}</div>
      <p className="muted">
        {hints === 0 ? "No hints. The hooded one is impressed." : `${hints} hint${hints === 1 ? "" : "s"} used (+${(hints * HINT_PENALTY_MS) / 1000}s).`}
      </p>

      {official === null ? (
        <p className="muted">Checking your escape with the spirits...</p>
      ) : official.error || !runId || !official.ticket ? (
        <p className="form-error">{official.error}</p>
      ) : (
        <PostScore runId={runId} ticket={official.ticket} />
      )}

      <div className="panel-actions">
        <button className="btn btn-green btn-big" onClick={onRestart}>Play again</button>
        <Link className="btn btn-ghost" href={`/leaderboard?room=${room}`}>Leaderboard</Link>
      </div>
    </div>
  );
}
