import store from "@/lib/store";
import { body, fail } from "@/lib/api";
import { isAdmin } from "@/lib/auth";
import { MAX_APPROVED, type AppStatus } from "@/lib/airdrop";

// Approves, rejects or returns applications to pending, in bulk. Approvals stop at the cap.
export async function POST(req: Request) {
  if (!(await isAdmin())) return fail("Not signed in as admin.", 403);
  const { xids, status } = await body<{ xids: string[]; status: AppStatus }>(req);
  if (!Array.isArray(xids) || !xids.length || xids.length > 500 || !["pending", "approved", "rejected"].includes(status!)) return fail("Bad request.");
  if (await store.getSnapshotMeta("airdrop")) return fail("The list is frozen. Unfreeze it before changing decisions.", 409);

  const { changed, capped } = await store.decide(xids.filter((x): x is string => typeof x === "string"), status!, MAX_APPROVED);
  return Response.json({ changed, capped, counts: await store.countApps() });
}
