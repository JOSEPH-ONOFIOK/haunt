import Link from "next/link";
import LiveBoard, { type PublicBoard } from "./LiveBoard";
import { boardData, publicScore, today, topScores, type BoardData } from "@/lib/store";
import { formatScore } from "@/lib/room";
import { ROOM_IDS, type RoomId } from "@/lib/rooms";

const hintText = (h: number) => (h ? `${h} hint${h === 1 ? "" : "s"}` : "no hints");

/** Strips wallets and account ids: anything handed to a client component ends up in the page. */
export const toPublic = (d: BoardData): PublicBoard => ({
  ...d,
  latest: d.latest.map(publicScore),
  fastest: d.fastest.map(publicScore),
  today: d.today.map(publicScore),
});

export default async function Leaderboard({ room, period, limit }: { room: RoomId; period: string; limit: number }) {
  const scores = await topScores(room, period === "today" ? today() : "all", limit);

  if (scores === null) return <p className="board-empty">The leaderboard is hiding right now. Try again in a moment.</p>;
  if (!scores.length) return <p className="board-empty">No one has escaped yet. Be the first soul on the board.</p>;

  return (
    <ol className="board">
      {scores.map((s) => (
        <li key={s.id} className={`board-row${s.rank <= 3 ? ` board-top board-${s.rank}` : ""}`}>
          <span className="board-rank">{s.rank}</span>
          <Link className="board-name" href={`/s/${s.id}`}>{s.name}</Link>
          <span className="board-hints">{hintText(s.hints)}</span>
          <span className="board-time">{formatScore(s.ms)}</span>
        </li>
      ))}
    </ol>
  );
}

export function BoardSkeleton({ rows }: { rows: number }) {
  return (
    <ol className="board" aria-busy="true">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="board-row board-wait" />
      ))}
    </ol>
  );
}

/** The homepage board: latest winners beside the fastest souls, per room, kept live in the browser. */
export async function HomeBoard() {
  const boards = await Promise.all(ROOM_IDS.map((r) => boardData(r)));
  if (boards.some((b) => b === null)) return <p className="board-empty">The leaderboard is hiding right now. Try again in a moment.</p>;
  return <LiveBoard initial={Object.fromEntries(boards.map((b) => [b!.room, toPublic(b!)])) as Record<RoomId, PublicBoard>} />;
}
