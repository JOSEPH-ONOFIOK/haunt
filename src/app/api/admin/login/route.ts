import { cookies } from "next/headers";
import store from "@/lib/store";
import { body, fail, ipOf } from "@/lib/api";
import { adminConfigured, adminCookie, adminKeyMatches } from "@/lib/auth";

export async function POST(req: Request) {
  if (!adminConfigured) return fail("Set ADMIN_KEY and SESSION_SECRET to use the admin page.", 503);
  if (!(await store.limit(`admin:${ipOf(req)}`, 10, 900))) return fail("Too many attempts. Wait 15 minutes.", 429);
  const { key } = await body<{ key: string }>(req);
  if (!adminKeyMatches(key)) return fail("Wrong key.", 403);
  (await cookies()).set(adminCookie());
  return Response.json({ ok: true });
}
