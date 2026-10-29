import type { Metadata } from "next";
import TopBar from "../_components/TopBar";
import AirdropPanel from "./AirdropPanel";
import { ALLOCATION } from "@/lib/airdrop";

const AMOUNT = `${ALLOCATION.toLocaleString("en-US")} $HAUNT`;

export const metadata: Metadata = {
  title: `Claim ${AMOUNT}`,
  description: `Complete 5 tasks to unlock your allocation. Enter your X username, add your Robinhood Chain wallet and claim ${AMOUNT}.`,
};

export default function AirdropPage() {
  return (
    <>
      <TopBar />
      <main className="wrap section airdrop">
        <p className="eyebrow">$HAUNT airdrop</p>
        <h1 className="section-title">Claim <em>{ALLOCATION.toLocaleString("en-US")}</em> $HAUNT</h1>
        <p className="section-lead">Complete 5 tasks to unlock your allocation, then get your permit card and post it in the comments.</p>
        <AirdropPanel />
      </main>
    </>
  );
}
