// Game rewards: the fastest souls in a round win $HAUNT. Separate from the X airdrop (see airdrop.ts).

/** $HAUNT for each winning position, top first. */
export const REWARDS = [50_000, 50_000, 50_000, 50_000, 50_000];
export const ROUND_TOTAL = REWARDS.reduce((a, b) => a + b, 0);

export const ROUND = {
  id: "r1",
  name: "Round 1",
  // Ends 2 hours before Halloween. Set NEXT_PUBLIC_ROUND_END_AT to change the moment or timezone.
  endsAt: process.env.NEXT_PUBLIC_ROUND_END_AT || "2026-10-30T22:00:00Z",
};

export const roundOpen = (at = Date.now()) => at < new Date(ROUND.endsAt).getTime();
/** The reward for a round position, or 0 outside the winning places. */
export const rewardFor = (rank: number) => REWARDS[rank - 1] ?? 0;
export const fmtHaunt = (n: number) => `${n.toLocaleString("en-US")} $HAUNT`;
