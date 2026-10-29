import { boardData, publicScore } from "@/lib/store";
import { isRoomId } from "@/lib/rooms";

// Feeds the live board on the homepage.
export async function GET(req: Request) {
  const room = new URL(req.url).searchParams.get("room") ?? "study";
  if (!isRoomId(room)) return Response.json({ error: "Unknown room" }, { status: 400 });
  const data = await boardData(room);
  if (!data) return Response.json({ error: "Board unavailable" }, { status: 503 });
  const pub = { ...data, latest: data.latest.map(publicScore), fastest: data.fastest.map(publicScore), round: data.round.map(publicScore) };
  return Response.json(pub, { headers: { "Cache-Control": "no-store" } });
}
