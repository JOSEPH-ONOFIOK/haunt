"use client";

import { useSyncExternalStore } from "react";
import { SITE_URL, X_HANDLE } from "@/lib/site";
import { formatScore } from "@/lib/room";
import { XIcon } from "./art";

export const shareUrl = (id: string) => `${SITE_URL}/s/${id}`;
const shareText = (ms: number) => `I escaped the HAUNT mansion in ${formatScore(ms)} 👻 Think you can beat me? ${X_HANDLE}`;

export function xIntent(id: string, ms: number) {
  return `https://x.com/intent/post?text=${encodeURIComponent(shareText(ms))}&url=${encodeURIComponent(shareUrl(id))}`;
}

// Phones can hand the card image itself to the X app through the share sheet.
const noop = () => () => {};
const canShareFiles = () => {
  try {
    return typeof navigator.canShare === "function" && navigator.canShare({ files: [new File([""], "x.png", { type: "image/png" })] });
  } catch {
    return false;
  }
};

export default function ShareButtons({ id, ms }: { id: string; ms: number }) {
  const native = useSyncExternalStore(noop, canShareFiles, () => false);

  async function shareImage() {
    try {
      const blob = await (await fetch(`/api/card/${id}`)).blob();
      const file = new File([blob], "haunt-scorecard.png", { type: "image/png" });
      await navigator.share({ files: [file], text: `${shareText(ms)} ${shareUrl(id)}` });
    } catch {
      // cancelled, or the share sheet refused the file: the buttons below still work
    }
  }

  return (
    <div className="share-row">
      {native && <button className="btn btn-green" onClick={shareImage}>Share image</button>}
      <a className="btn btn-orange" href={`/api/card/${id}?download=1`} download>Download card</a>
      <a className="btn" href={xIntent(id, ms)} target="_blank" rel="noopener noreferrer">
        <span className="btn-icon"><XIcon /></span> Share on X
      </a>
    </div>
  );
}
