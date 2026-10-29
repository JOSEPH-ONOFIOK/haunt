import { NextResponse } from "next/server";
import store from "@/lib/store";
import { ipOf } from "@/lib/api";
import { OAUTH_COOKIE, authorizeUrl, cookieBase, newOAuth, safeNext, sign, siteOrigin, verifyTurnstile, xReady } from "@/lib/auth";

// GET /api/auth/x/start?next=/claim/abc&cf=turnstileToken → redirects to X
export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = siteOrigin(req);
  const next = safeNext(url.searchParams.get("next"));
  const fail = (code: string) => NextResponse.redirect(`${origin}${next}${next.includes("?") ? "&" : "?"}auth_error=${code}`);

  if (!xReady) return fail("unavailable");
  const ip = ipOf(req);
  if (!(await store.limit(`signin:${ip}`, 20, 600))) return fail("rate_limited");
  if (!(await verifyTurnstile(url.searchParams.get("cf"), ip))) return fail("bot_check");

  const o = newOAuth(next);
  const res = NextResponse.redirect(authorizeUrl(o, `${origin}/api/auth/x/callback`));
  res.cookies.set({ name: OAUTH_COOKIE, value: sign(o), ...cookieBase, path: "/api/auth", maxAge: 600 });
  return res;
}
