import store from "@/lib/store";
import { CARD, renderCard } from "@/lib/card";
import { isRunId } from "@/lib/api";

export const alt = "HAUNT escape scorecard";
export const size = CARD;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const score = isRunId(id) ? await store.getScore(id) : null;
  return renderCard(score ?? { room: "study", name: "A lost soul", ms: 0, hints: 0, rank: 0, dayRank: 0 });
}
