"use client";

import Link from "next/link";
import Countdown from "../../_components/Countdown";
import { useClock } from "../../_components/useClock";
import CellarGame from "./CellarGame";
import { CELLAR_AT } from "@/lib/site";

// The cellar stays shut until launch. The server refuses early runs too; this just shows the wait.
export default function CellarGate() {
  const now = useClock();
  if (now !== null && now >= new Date(CELLAR_AT).getTime()) return <CellarGame />;
  return (
    <div className="game">
      <div className="panel cellar-locked">
        <h2 className="spooky panel-title">The Cellar</h2>
        <p>Something is scratching under the floorboards. This door opens at launch.</p>
        <Countdown target={CELLAR_AT} />
        <div className="panel-actions">
          <Link href="/play" className="btn btn-green">Escape the Study first</Link>
        </div>
      </div>
    </div>
  );
}
