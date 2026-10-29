import store from "@/lib/store";
import { isAdmin } from "@/lib/auth";
import { isRoomId } from "@/lib/rooms";
import { formatScore } from "@/lib/room";

// GET /api/admin/export?room=study&period=2026-10-31 → CSV of that board with wallets, for paying prizes
export async function GET(req: Request) {
  if (!(await isAdmin())) return new Response("Forbidden", { status: 403 });
  const q = new URL(req.url).searchParams;
  const room = q.get("room") ?? "study";
  const period = q.get("period") ?? "all";
  if (!isRoomId(room) || !/^(all|\d{4}-\d{2}-\d{2})$/.test(period)) return new Response("Bad request", { status: 400 });

  const rows = await store.top(room, period, 500);
  const cols = ["rank", "nickname", "x_handle", "verified", "wallet", "time", "ms", "hints", "posted_utc", "run_id"];
  // A leading = + - @ would run as a formula in Sheets/Excel, so neutralise it
  const esc = (v: unknown) => {
    const t = String(v ?? "");
    return `"${(/^[=+\-@]/.test(t) ? "'" + t : t).replace(/"/g, '""')}"`;
  };
  const lines = rows.map((s) =>
    [s.rank, s.name, s.handle, s.verified ? "yes" : "no", s.wallet, formatScore(s.ms), s.ms, s.hints, new Date(s.at).toISOString(), s.id].map(esc).join(","),
  );
  return new Response([cols.join(","), ...lines].join("\n"), {
    headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="haunt-${room}-${period}.csv"` },
  });
}
