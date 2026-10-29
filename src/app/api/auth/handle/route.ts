import store from "@/lib/store";
import { body, fail, ipOf } from "@/lib/api";
import { authMode, getSession, hasSecret, sessionCookie, verifyTurnstile } from "@/lib/auth";

// Sign in by typing an X username (the default). It turns off if the site is switched to Sign in with X (AUTH_MODE=x).
export async function POST(req: Request) {
  if (authMode !== "handle") return fail("Please use Sign in with X.", 404);
  if (!hasSecret) return fail("Sign in is not configured yet (missing SESSION_SECRET).", 503);
  const ip = ipOf(req);
  if (!(await store.limit(`handle:${ip}`, 10, 600))) return fail("Too many sign in attempts. Try again in a few minutes.", 429);

  const input = await body<{ handle: string; cf: string }>(req);
  if (!(await verifyTurnstile(input.cf, ip))) return fail("The bot check failed. Please try again.");
  const handle = String(input.handle ?? "").trim().replace(/^@/, "");
  if (!/^[A-Za-z0-9_]{1,15}$/.test(handle)) return fail("That isn't a valid X username (letters, numbers and _, up to 15).");

  const xid = `h:${handle.toLowerCase()}`;
  const prev = await store.getAccount(xid);
  // Without X to vouch for it, a handle can only be reopened from the browser that first used it.
  if (prev && (await getSession())?.xid !== xid) return fail("That X username is already in use on another device. Use the browser you first used it on.", 409);
  await store.putAccount({ xid, handle, verified: false, eligible: true, wallet: prev?.wallet, firstSeen: prev?.firstSeen ?? Date.now() });

  const res = Response.json({ handle });
  const c = sessionCookie(xid, handle);
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.headers.append("Set-Cookie", `${c.name}=${c.value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${c.maxAge}${secure}`);
  return res;
}
