import store from "@/lib/store";
import { fail } from "@/lib/api";
import { isAdmin } from "@/lib/auth";
import { CLAIM_OPEN } from "@/lib/airdrop";

// Throws away the frozen list so decisions can change again. Only safe before the contract is deployed with its root.
export async function POST() {
  if (!(await isAdmin())) return fail("Not signed in as admin.", 403);
  if (CLAIM_OPEN) return fail("Claims are open. The list can't change now.", 409);
  await store.putSnapshot(null);
  return Response.json({ ok: true });
}
