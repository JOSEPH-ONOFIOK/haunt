import { NextResponse } from "next/server";
import store from "@/lib/store";
import { ipOf } from "@/lib/api";
import { OAUTH_COOKIE, authMode, authorizeUrl, cookieBase, newOAuth, safeNext, sign, siteOrigin } from "@/lib/auth";

// GET /api/auth/x/start?next=/claim/abc → redirects to X
export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = siteOrigin(req);
  const next = safeNext(url.searchParams.get("next"));
  const fail = (code: string) => NextResponse.redirect(`${origin}${next}${next.includes("?") ? "&" : "?"}auth_error=${code}`);

  if (authMode !== "x") return fail("unavailable");
  if (!(await store.limit(`signin:${ipOf(req)}`, 20, 600))) return fail("rate_limited");

  const o = newOAuth(next);
  const res = NextResponse.redirect(authorizeUrl(o, `${origin}/api/auth/x/callback`));
  res.cookies.set({ name: OAUTH_COOKIE, value: sign(o), ...cookieBase, path: "/api/auth", maxAge: 600 });
  return res;
}
