/* eslint-disable @next/next/no-img-element -- satori renders plain <img>, next/image does not apply */
import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { formatScore } from "./room";
import { ROOMS } from "./rooms";
import { ROUND } from "./rewards";
import type { Score } from "./store";

export const CARD = { width: 1200, height: 630 };

const asset = (f: string) => readFile(join(process.cwd(), "assets", f));
const dataUri = async (f: string) => `data:image/png;base64,${(await asset(f)).toString("base64")}`;
const loaded = Promise.all([
  asset("Creepster-Regular.ttf"),
  asset("Fredoka-Bold.ttf"),
  asset("PatrickHand-Regular.ttf"),
  dataUri("banner-720.png"),
  dataUri("mascot-520.png"),
]);

const GREEN = "#23f74b";
const ORANGE = "#ff7a1a";

/** The branded result card: nickname, escape time, rank and the HAUNT logo. */
export async function renderCard(score: Pick<Score, "room" | "name" | "ms" | "hints" | "rank" | "dayRank" | "roundRank">) {
  const [spooky, round, hand, banner, mascot] = await loaded;
  const hints = score.hints === 0 ? "No hints" : `${score.hints} hint${score.hints === 1 ? "" : "s"}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          // Flat #151515 is the backdrop of both brand images, so they sit on the card without edges.
          backgroundColor: "#151515",
          color: "#f1ece1",
          fontFamily: "Hand",
        }}
      >
        <img src={mascot} width={560} height={560} alt="" style={{ position: "absolute", left: -40, bottom: -40, opacity: 0.95 }} />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginLeft: 470, width: 700, paddingTop: 16 }}>
          <img src={banner} width={600} height={200} alt="" />
          <div style={{ fontSize: 34, color: "#b9b0a3", marginTop: 4 }}>{`escaped ${ROOMS[score.room].name.toLowerCase()} in`}</div>
          <div style={{ fontFamily: "Spooky", fontSize: 150, lineHeight: 1, color: GREEN, textShadow: `0 0 28px ${GREEN}88` }}>
            {formatScore(score.ms)}
          </div>
          <div style={{ fontFamily: "Round", fontSize: 58, color: ORANGE, marginTop: 6 }}>{score.name}</div>
          <div style={{ display: "flex", gap: 18, marginTop: 18, fontSize: 30 }}>
            <div style={{ display: "flex", border: `3px solid ${GREEN}`, color: GREEN, borderRadius: 14, padding: "2px 18px" }}>
              {score.roundRank ? `#${score.roundRank} in ${ROUND.name} · #${score.rank} all time` : `#${score.rank} all time`}
            </div>
            <div style={{ display: "flex", border: "3px solid #3e3e3e", color: "#b9b0a3", borderRadius: 14, padding: "2px 18px" }}>{hints}</div>
          </div>
          <div style={{ fontSize: 26, color: "#7d7569", marginTop: 14 }}>Can you escape faster?</div>
        </div>
      </div>
    ),
    {
      ...CARD,
      fonts: [
        { name: "Spooky", data: spooky, weight: 400, style: "normal" },
        { name: "Round", data: round, weight: 700, style: "normal" },
        { name: "Hand", data: hand, weight: 400, style: "normal" },
      ],
    },
  );
}
