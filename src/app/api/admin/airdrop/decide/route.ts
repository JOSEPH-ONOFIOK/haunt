import store from "@/lib/store";
import { body, fail } from "@/lib/api";
import { isAdmin } from "@/lib/auth";
import { MAX_APPROVED, type AppStatus } from "@/lib/airdrop";

// Approves, rejects or returns applications to pending, in bulk. Approvals stop at the cap.
export async function POST(req: Request) {
  if (!(await isAdmin())) return fail("Not signed in as admin.", 403);
  const { xids, status } = await body<{ xids: string[]; status: AppStatus }>(req);
  if (!Array.isArray(xids) || !xids.length || xids.length > 500 || !["pending", "approved", "rejected"].includes(status!)) return fail("Bad request.");
  if (await store.getSnapshotMeta()) return fail("The list is frozen. Unfreeze it before changing decisions.", 409);

  let changed = 0;
  let capped = 0;
  for (const xid of xids) {
    if (typeof xid !== "string") continue;
    if (await store.decide(xid, status!, MAX_APPROVED)) changed++;
    else if (status === "approved") capped++;
  }
  return Response.json({ changed, capped, counts: await store.countApps() });
}
