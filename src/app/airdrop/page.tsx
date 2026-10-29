import type { Metadata } from "next";
import TopBar from "../_components/TopBar";
import AirdropPanel from "./AirdropPanel";
import { ALLOCATION, MAX_APPROVED } from "@/lib/airdrop";

export const metadata: Metadata = {
  title: "The 2,000",
  description: `2,000 approved souls get ${ALLOCATION.toLocaleString("en-US")} $HAUNT each. Sign in with X and apply with your Robinhood Chain wallet.`,
};

const fmt = (n: number) => n.toLocaleString("en-US");

export default function AirdropPage() {
  return (
    <>
      <TopBar />
      <main className="wrap section airdrop">
        <p className="eyebrow">$HAUNT airdrop</p>
        <h1 className="section-title">The <em>{fmt(MAX_APPROVED)}</em></h1>
        <p className="section-lead">
          {fmt(MAX_APPROVED)} approved users get {fmt(ALLOCATION)} $HAUNT each. Sign in with X, submit your Robinhood Chain wallet and
          we&apos;ll review your application.
        </p>
        <AirdropPanel />
      </main>
    </>
  );
}
