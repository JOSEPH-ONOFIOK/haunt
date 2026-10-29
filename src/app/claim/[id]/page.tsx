import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import TopBar from "../../_components/TopBar";
import PostScore from "../../_components/PostScore";
import store from "@/lib/store";
import { isRunId } from "@/lib/api";
import { formatScore } from "@/lib/room";
import { ROOMS } from "@/lib/rooms";

export const metadata: Metadata = { title: "Claim your time", robots: { index: false } };

type Props = { params: Promise<{ id: string }> };

// Where a player lands after signing in with X from the escape screen.
async function Claim({ params }: Props) {
  const { id } = await params;
  const run = isRunId(id) ? await store.getRun(id) : null;
  if (!run || run.ms === undefined || run.void) {
    return (
      <div className="panel">
        <h1 className="spooky panel-title">This run has faded</h1>
        <p>{run?.void ? `It can't be ranked: ${run.void}` : "Runs can be posted for an hour after they start."}</p>
        <Link href="/play" className="btn btn-green btn-big">Play again</Link>
      </div>
    );
  }
  return (
    <div className="panel panel-wide">
      <h1 className="spooky panel-title">{ROOMS[run.room].name}</h1>
      <div className="big-time spooky">{formatScore(run.ms)}</div>
      <PostScore runId={run.id} />
      <div className="panel-actions">
        <Link href={ROOMS[run.room].path} className="btn btn-ghost">Play again</Link>
      </div>
    </div>
  );
}

export default function ClaimPage({ params }: Props) {
  return (
    <>
      <TopBar />
      <main className="wrap section claim-page">
        <Suspense fallback={<p className="muted">Finding your run...</p>}>
          <Claim params={params} />
        </Suspense>
      </main>
    </>
  );
}
