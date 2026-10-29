import type { Metadata } from "next";
import Link from "next/link";
import TopBar from "../_components/TopBar";
import RoomTabs from "./_components/RoomTabs";
import StudyGame from "./_components/StudyGame";

export const metadata: Metadata = {
  title: "Escape the Study",
  description: "Find the clues, solve the puzzles and escape the haunted study before the candles die.",
};

export default function PlayPage() {
  return (
    <>
      <TopBar>
        <Link href="/leaderboard" className="btn btn-ghost btn-sm">Leaderboard</Link>
      </TopBar>
      <main className="wrap play">
        <RoomTabs current="study" />
        <StudyGame />
      </main>
    </>
  );
}
