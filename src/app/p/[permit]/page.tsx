import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import TopBar from "../../_components/TopBar";
import store from "@/lib/store";
import { ALLOCATION, PERMIT_RE } from "@/lib/airdrop";

type Props = { params: Promise<{ permit: string }> };

async function load(params: Props["params"]) {
  const { permit } = await params;
  return PERMIT_RE.test(permit) ? store.appByPermit(permit) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const app = await load(params);
  if (!app) return { title: "Permit" };
  const title = `@${app.handle} claimed ${ALLOCATION.toLocaleString("en-US")} $HAUNT`;
  return { title, description: "Complete 5 tasks to unlock your $HAUNT allocation.", openGraph: { title }, twitter: { title } };
}

async function Card({ params }: Props) {
  const app = await load(params);
  if (!app) notFound();
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a generated PNG, not a static asset
    <img className="scorecard" src={`/api/permit/${app.permit}`} width={1200} height={630} alt={`$HAUNT permit for @${app.handle}`} />
  );
}

// Where a shared permit link lands: the card, and the way to get your own.
export default function PermitPage({ params }: Props) {
  return (
    <>
      <TopBar />
      <main className="wrap section score-page">
        <Suspense fallback={<div className="scorecard scorecard-wait" />}>
          <Card params={params} />
        </Suspense>
        <div className="hero-cta">
          <Link href="/airdrop" className="btn btn-green btn-big">Claim {ALLOCATION.toLocaleString("en-US")} $HAUNT</Link>
        </div>
      </main>
    </>
  );
}
