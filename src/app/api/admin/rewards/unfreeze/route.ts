import store from "@/lib/store";
import { fail } from "@/lib/api";
import { isAdmin } from "@/lib/auth";
import { REWARDS_CLAIM_OPEN } from "@/lib/airdrop";

// Throws away the frozen winners. Only safe before the rewards contract is deployed with that root.
export async function POST() {
  if (!(await isAdmin())) return fail("Not signed in as admin.", 403);
  if (REWARDS_CLAIM_OPEN) return fail("Reward claims are open. The winners can't change now.", 409);
  await store.putSnapshot("rewards", null);
  return Response.json({ ok: true });
}
