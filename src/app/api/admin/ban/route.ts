import store from "@/lib/store";
import { body, fail } from "@/lib/api";
import { isAdmin } from "@/lib/auth";

// Bans an account: every entry leaves the boards and it can't post again.
export async function POST(req: Request) {
  if (!(await isAdmin())) return fail("Not signed in as admin.", 403);
  const { xid } = await body<{ xid: string }>(req);
  if (typeof xid !== "string" || !xid) return fail("Unknown account.");
  await store.ban(xid);
  return Response.json({ ok: true });
}
