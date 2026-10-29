import store from "@/lib/store";
import { renderCard } from "@/lib/card";
import { isRunId } from "@/lib/api";

// The scorecard PNG. Add ?download=1 to save it as a file.
export async function GET(req: Request, ctx: RouteContext<"/api/card/[id]">) {
  const { id } = await ctx.params;
  const score = isRunId(id) ? await store.getScore(id) : null;
  if (!score) return new Response("Not found", { status: 404 });
  const res = await renderCard(score);
  const headers = new Headers(res.headers);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  if (new URL(req.url).searchParams.has("download")) {
    headers.set("Content-Disposition", `attachment; filename="haunt-${score.name.replace(/[^A-Za-z0-9_-]/g, "") || "scorecard"}.png"`);
  }
  return new Response(res.body, { headers });
}
