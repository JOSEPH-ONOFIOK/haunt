/* eslint-disable @next/next/no-img-element -- satori renders plain <img>, next/image does not apply */
// The $HAUNT permit card a player gets after claiming their allocation, to download and post in the comments.
import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { createPublicClient, http, type Hex } from "viem";
import { ALLOCATION, CLAIM_CONTRACT, chain, chainReady, distributorAbi, shortAddress, type Application } from "./airdrop";
import store from "./store";

export const PERMIT_CARD = { width: 1200, height: 630 };

const asset = (f: string) => readFile(join(process.cwd(), "assets", f));
const dataUri = async (f: string) => `data:image/png;base64,${(await asset(f)).toString("base64")}`;
const loaded = Promise.all([asset("Creepster-Regular.ttf"), asset("Fredoka-Bold.ttf"), asset("PatrickHand-Regular.ttf"), dataUri("banner-720.png"), dataUri("mascot-520.png")]);

const GREEN = "#23f74b";
const ORANGE = "#ff7a1a";

/** The X profile picture as a data URI, or null if X is slow or the link is gone. */
async function avatarOf(url?: string) {
  if (!url || !/^https:\/\/pbs\.twimg\.com\//.test(url)) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    return `data:${res.headers.get("content-type") ?? "image/jpeg"};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * What the card's stamp says. Only the chain can say CLAIMED: a registered allocation hasn't been
 * sent anywhere yet, so the card never claims it has.
 */
export async function permitStatus(app: Application): Promise<"REGISTERED" | "APPROVED" | "NOT APPROVED" | "CLAIMED"> {
  if (app.status === "rejected") return "NOT APPROVED";
  if (app.status !== "approved") return "REGISTERED";
  if (chainReady && CLAIM_CONTRACT) {
    try {
      const claim = await store.getClaim("airdrop", app.wallet);
      if (claim) {
        const client = createPublicClient({ chain, transport: http(undefined, { timeout: 3000 }) });
        const done = await client.readContract({ address: CLAIM_CONTRACT as Hex, abi: distributorAbi, functionName: "isClaimed", args: [BigInt(claim.index)] });
        if (done) return "CLAIMED";
      }
    } catch {
      // chain unreachable: fall back to what the review says
    }
  }
  return "APPROVED";
}

/** Barcode bars from the permit id: same id, same stripes. */
function bars(permit: string) {
  const bytes = createHash("sha256").update(permit).digest();
  return Array.from(bytes.subarray(0, 28)).map((b) => ({ w: 2 + (b % 4) * 2, gap: 2 + ((b >> 2) % 3) * 2 }));
}

export async function renderPermit(app: Application) {
  const [spooky, round, hand, banner, mascot] = await loaded;
  const [avatar, status] = await Promise.all([avatarOf(app.avatar), permitStatus(app)]);
  const issued = new Date(app.appliedAt).toISOString().slice(0, 10).split("-").reverse().join(".");
  const stamp = status === "CLAIMED" || status === "APPROVED" ? GREEN : status === "NOT APPROVED" ? "#ff4d3d" : ORANGE;
  const row = (label: string, value: string) => (
    <div style={{ display: "flex", fontSize: 26, marginTop: 6 }}>
      <span style={{ width: 150, color: "#7d7569" }}>{label}</span>
      <span style={{ color: "#f1ece1" }}>{value}</span>
    </div>
  );

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", backgroundColor: "#151515", fontFamily: "Hand", padding: 28 }}>
        <div style={{ display: "flex", width: "100%", height: "100%", border: `4px solid ${GREEN}`, borderRadius: 28, padding: "34px 40px", boxShadow: `0 0 40px ${GREEN}55` }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 330 }}>
            <img
              src={avatar ?? mascot}
              width={300}
              height={300}
              alt=""
              style={{ borderRadius: 26, border: `5px solid ${GREEN}`, objectFit: "cover", backgroundColor: "#0b0a0c" }}
            />
            <div style={{ display: "flex", marginTop: 26, padding: "6px 22px", border: `4px solid ${stamp}`, color: stamp, borderRadius: 12, fontFamily: "Round", fontSize: 34, transform: "rotate(-4deg)" }}>
              {`STATUS: ${status}`}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginLeft: 44, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 26, color: "#7d7569", letterSpacing: 4 }}>$HAUNT PERMIT</span>
              <img src={banner} width={240} height={80} alt="" />
            </div>
            <div style={{ display: "flex", fontFamily: "Round", fontSize: 60, color: "#f1ece1", marginTop: 4 }}>{`@${app.handle}`}</div>
            <div style={{ display: "flex", fontSize: 24, color: "#7d7569", marginTop: 8 }}>allocation</div>
            <div style={{ display: "flex", alignItems: "baseline" }}>
              <span style={{ fontFamily: "Spooky", fontSize: 112, lineHeight: 1, color: GREEN, textShadow: `0 0 26px ${GREEN}88` }}>{ALLOCATION.toLocaleString("en-US")}</span>
              <span style={{ fontFamily: "Round", fontSize: 40, color: ORANGE, marginLeft: 16 }}>$HAUNT</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "auto" }}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                {row("wallet", shortAddress(app.wallet))}
                {row("permit", app.permit ?? "")}
                {row("issued", issued)}
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ display: "flex", height: 92, padding: "8px 10px", backgroundColor: "#f1ece1", borderRadius: 6 }}>
                  {bars(app.permit ?? app.xid).map((b, i) => (
                    <div key={i} style={{ width: b.w, height: "100%", backgroundColor: "#0b0a0c", marginRight: b.gap }} />
                  ))}
                </div>
                <span style={{ fontSize: 18, color: "#7d7569", marginTop: 4 }}>{app.permit ?? ""}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...PERMIT_CARD,
      fonts: [
        { name: "Spooky", data: spooky, weight: 400, style: "normal" },
        { name: "Round", data: round, weight: 700, style: "normal" },
        { name: "Hand", data: hand, weight: 400, style: "normal" },
      ],
    },
  );
}
