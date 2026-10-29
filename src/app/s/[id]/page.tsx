import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import TopBar from "../../_components/TopBar";
import ShareButtons from "../../_components/ShareButtons";
import store from "@/lib/store";
import { isRunId } from "@/lib/api";
import { formatScore } from "@/lib/room";

type Props = { params: Promise<{ id: string }> };

async function load(params: Props["params"]) {
  const { id } = await params;
  return isRunId(id) ? store.getScore(id) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const score = await load(params);
  if (!score) return { title: "Scorecard" };
  const title = `${score.name} escaped in ${formatScore(score.ms)}`;
  return { title, description: "Think you can escape the HAUNT study faster?", openGraph: { title }, twitter: { title } };
}

async function Card({ params }: Props) {
  const score = await load(params);
  if (!score) notFound();
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- a generated PNG, not a static asset */}
      <img className="scorecard" src={`/api/card/${score.id}`} width={1200} height={630} alt={`${score.name} escaped the study in ${formatScore(score.ms)}`} />
      <ShareButtons id={score.id} ms={score.ms} />
    </>
  );
}

export default function ScorePage({ params }: Props) {
  return (
    <>
      <TopBar>
        <Link href="/leaderboard" className="btn btn-ghost btn-sm">Leaderboard</Link>
      </TopBar>
      <main className="wrap section score-page">
        <Suspense fallback={<div className="scorecard scorecard-wait" />}>
          <Card params={params} />
        </Suspense>
        <div className="hero-cta">
          <Link href="/play" className="btn btn-green btn-big">Beat this time</Link>
        </div>
      </main>
    </>
  );
}
