"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ClaimPanel from "../_components/ClaimPanel";
import SignIn from "../_components/SignIn";
import { REWARDS_CLAIM_OPEN, REWARDS_CONTRACT, TOKEN_DECIMALS, type Claim } from "@/lib/airdrop";
import { formatScore } from "@/lib/room";
import { REWARDS, fmtHaunt } from "@/lib/rewards";

type Me = {
  mode: "x" | "handle";
  account: { handle: string; verified: boolean } | null;
  round: { name: string; endsAt: string; ended: boolean; winners: number };
  standing: { rank: number; ms: number; name: string; reward: number } | null;
  frozen: boolean;
  merkleRoot: string | null;
  claim: Claim | null;
};

/** Where Round 1 winners check their place and, after launch, claim their $HAUNT. */
export default function RewardsPanel() {
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState("");

  function load() {
    return fetch("/api/rewards/me", { cache: "no-store" })
      .then((r) => r.json())
      .then(setMe)
      .catch(() => setError("Couldn't reach the crypt. Refresh to try again."));
  }
  useEffect(() => {
    load();
  }, []);

  if (!me) return <div className="ad-card"><p className="muted">{error || "Opening the crypt..."}</p></div>;
  if (!me.account) {
    return (
      <div className="ad-card">
        <SignIn mode={me.mode} next="/rewards" lead="Enter the X username you posted your time with." onSignedIn={load} />
      </div>
    );
  }

  const { round, standing } = me;
  const winning = standing && standing.reward > 0;
  const amount = me.claim ? fmtHaunt(Number(BigInt(me.claim.amount) / BigInt(10) ** BigInt(TOKEN_DECIMALS))) : winning ? fmtHaunt(standing.reward) : "";

  let place: React.ReactNode;
  if (me.frozen) {
    place = me.claim ? (
      <>
        <span className="status-pill status-approved">Winner</span>
        <p>You finished in the top {round.winners} of {round.name}.</p>
      </>
    ) : (
      <p>You weren&apos;t one of the {round.winners} winners of {round.name} this time.</p>
    );
  } else if (winning) {
    place = (
      <>
        <span className="status-pill status-pending">#{standing.rank} · {fmtHaunt(standing.reward)}</span>
        <p>
          {round.ended
            ? "The round is over. Winners are being checked before the claim list is finalised."
            : `You're in a winning spot with ${formatScore(standing.ms)}. Hold it until ${round.name} ends.`}
        </p>
      </>
    );
  } else {
    place = (
      <p>
        {standing ? `You're #${standing.rank} with ${formatScore(standing.ms)}. ` : "You haven't posted a time yet. "}
        {round.ended ? `${round.name} is over.` : `The top ${REWARDS.length} each win ${fmtHaunt(REWARDS[0])}.`}
      </p>
    );
  }

  return (
    <div className="ad-grid ad-grid-2">
      <section className="ad-card" aria-labelledby="rw-place">
        <h2 id="rw-place" className="ad-title"><span className="ad-num">1</span> Your place in {round.name}</h2>
        <p className="form-note">Signed in as <b>@{me.account.handle}</b></p>
        {place}
        {!round.ended && <Link href="/play" className="btn btn-orange">Play the Study</Link>}
      </section>

      <section className="ad-card" aria-labelledby="rw-claim">
        <h2 id="rw-claim" className="ad-title"><span className="ad-num">2</span> Claim status</h2>
        {me.claim && me.merkleRoot ? (
          <ClaimPanel claim={me.claim} root={me.merkleRoot} contract={REWARDS_CONTRACT} open={REWARDS_CLAIM_OPEN} amountLabel={amount} />
        ) : (
          <div className="claim-box">
            <button className="btn btn-green btn-big" disabled>Claim disabled</button>
            <p className="muted">Disabled until launch and claims open. Winners claim here with the wallet they posted their time with.</p>
          </div>
        )}
      </section>
    </div>
  );
}
