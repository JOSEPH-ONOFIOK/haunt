import type { Metadata } from "next";
import TopBar from "../_components/TopBar";
import RewardsPanel from "./RewardsPanel";
import { REWARDS, ROUND, ROUND_TOTAL, fmtHaunt } from "@/lib/rewards";

export const metadata: Metadata = {
  title: "Game rewards",
  description: `The fastest souls win ${fmtHaunt(REWARDS[0])}. Top ${REWARDS.length} of ${ROUND.name}.`,
};

export default function RewardsPage() {
  return (
    <>
      <TopBar />
      <main className="wrap section airdrop">
        <p className="eyebrow">Game rewards</p>
        <h1 className="section-title">The fastest souls win <em>{REWARDS[0].toLocaleString("en-US")}</em> $HAUNT</h1>
        <p className="section-lead">
          Top {REWARDS.length} of {ROUND.name}: {fmtHaunt(ROUND_TOTAL)} in total. The round ends 2 hours before Halloween. Winners are checked, then
          claim their $HAUNT here when the coin launches. This is separate from the X airdrop.
        </p>
        <RewardsPanel />
      </main>
    </>
  );
}
