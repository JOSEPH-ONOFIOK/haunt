import store from "@/lib/store";
import { PERMIT_RE } from "@/lib/airdrop";
import { PERMIT_CARD, renderPermit } from "@/lib/permit";

export const alt = "$HAUNT permit";
export const size = PERMIT_CARD;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ permit: string }> }) {
  const { permit } = await params;
  const app = PERMIT_RE.test(permit) ? await store.appByPermit(permit) : null;
  if (!app) return new Response("Not found", { status: 404 });
  return renderPermit(app);
}
