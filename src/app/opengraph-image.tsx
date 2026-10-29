import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "HAUNT: escape the haunted mansion";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const asset = (f: string) => readFile(join(process.cwd(), "assets", f));

// The link preview for the homepage: X crops the 3:1 banner badly, so it gets its own 1200 x 630 card.
export default async function Image() {
  const [hand, banner, mascot] = await Promise.all([
    asset("PatrickHand-Regular.ttf"),
    asset("banner-720.png").then((b) => `data:image/png;base64,${b.toString("base64")}`),
    asset("mascot-520.png").then((b) => `data:image/png;base64,${b.toString("base64")}`),
  ]);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", backgroundColor: "#151515", fontFamily: "Hand" }}>
        <img src={mascot} width={600} height={600} alt="" style={{ position: "absolute", right: -40, bottom: -60 }} />
        <div style={{ display: "flex", flexDirection: "column", padding: "60px 0 0 60px", width: 700 }}>
          <img src={banner} width={640} height={213} alt="" />
          <div style={{ fontSize: 46, color: "#ff7a1a", marginTop: 26 }}>Escape the haunted mansion.</div>
          <div style={{ fontSize: 34, color: "#b9b0a3", marginTop: 12 }}>Fastest souls win prizes. Rises October 31.</div>
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: "Hand", data: hand, weight: 400, style: "normal" }] },
  );
}
