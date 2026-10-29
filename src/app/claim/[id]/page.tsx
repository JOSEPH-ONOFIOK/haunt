import type { Metadata } from "next";
import { Suspense } from "react";
import TopBar from "../../_components/TopBar";
import ClaimRun from "./ClaimRun";

export const metadata: Metadata = { title: "Claim your time", robots: { index: false } };

type Props = { params: Promise<{ id: string }> };

async function Claim({ params }: Props) {
  const { id } = await params;
  return <ClaimRun id={id} />;
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
