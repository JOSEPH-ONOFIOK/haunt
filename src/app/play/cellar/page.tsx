import type { Metadata } from "next";
import Link from "next/link";
import TopBar from "../../_components/TopBar";
import RoomTabs from "../_components/RoomTabs";
import CellarGate from "../_components/CellarGate";

export const metadata: Metadata = {
  title: "Escape the Cellar",
  description: "The second room of the HAUNT mansion. Mix the potions, read the barrels and get out before the torches die.",
};

export default function CellarPage() {
  return (
    <>
      <TopBar>
        <Link href="/leaderboard?room=cellar" className="btn btn-ghost btn-sm">Leaderboard</Link>
      </TopBar>
      <main className="wrap play">
        <RoomTabs current="cellar" />
        <CellarGate />
      </main>
    </>
  );
}
