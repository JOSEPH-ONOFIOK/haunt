import { connection } from "next/server";
import store from "@/lib/store";
import { authMode, getSession } from "@/lib/auth";

// Who is signed in, and how sign in works on this deployment.
export async function GET() {
  await connection();
  const s = await getSession();
  const a = s ? await store.getAccount(s.xid) : null;
  return Response.json({
    mode: authMode,
    account: a && { handle: a.handle, verified: a.verified, eligible: a.eligible, wallet: a.wallet ?? "" },
  });
}
