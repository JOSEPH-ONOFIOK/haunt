import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import store from "@/lib/store";
import { OAUTH_COOKIE, eligible, exchangeAndFetchUser, sessionCookie, siteOrigin, unsign, type OAuthState } from "@/lib/auth";

// X redirects here after the player approves (or cancels) sign in
export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = siteOrigin(req);
  const o = unsign<OAuthState>((await cookies()).get(OAUTH_COOKIE)?.value);
  const next = o?.next ?? "/play";

  const done = (query: string) => {
    const res = NextResponse.redirect(`${origin}${next}${next.includes("?") ? "&" : "?"}${query}`);
    res.cookies.set({ name: OAUTH_COOKIE, value: "", path: "/api/auth", maxAge: 0 });
    return res;
  };

  if (url.searchParams.get("error")) return done("auth_error=cancelled");
  const code = url.searchParams.get("code");
  if (!o || !code || url.searchParams.get("state") !== o.state || Date.now() - o.ts > 600_000) return done("auth_error=expired");

  try {
    const user = await exchangeAndFetchUser(code, o.verifier, `${origin}/api/auth/x/callback`);
    const prev = await store.getAccount(user.id);
    await store.putAccount({
      xid: user.id,
      handle: user.username,
      verified: true,
      eligible: eligible(user),
      xCreatedAt: user.created_at,
      followers: user.public_metrics?.followers_count,
      // X serves a 48px "_normal" picture by default; the card wants the full size one.
      avatar: user.profile_image_url?.replace("_normal.", "_400x400."),
      wallet: prev?.wallet,
      firstSeen: prev?.firstSeen ?? Date.now(),
    });
    const res = done("signed_in=1");
    res.cookies.set(sessionCookie(user.id, user.username));
    return res;
  } catch (e) {
    console.error("X sign in failed", e);
    return done("auth_error=x_failed");
  }
}
