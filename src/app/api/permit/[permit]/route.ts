import store from "@/lib/store";
import { PERMIT_RE } from "@/lib/airdrop";
import { renderPermit } from "@/lib/permit";

// The permit card PNG. Add ?download=1 to save it as a file.
export async function GET(req: Request, ctx: RouteContext<"/api/permit/[permit]">) {
  const { permit } = await ctx.params;
  const app = PERMIT_RE.test(permit) ? await store.appByPermit(permit) : null;
  if (!app) return new Response("Not found", { status: 404 });
  const res = await renderPermit(app);
  const headers = new Headers(res.headers);
  // Short cache: the status stamp changes when the claim is approved and when it's claimed.
  headers.set("Cache-Control", "public, max-age=300");
  if (new URL(req.url).searchParams.has("download")) headers.set("Content-Disposition", `attachment; filename="${permit}.png"`);
  return new Response(res.body, { headers });
}
