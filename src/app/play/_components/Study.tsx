import type { KeyboardEvent } from "react";
import { Bat, Cobweb, GlowFilter, HandFilter, Pumpkin } from "../../_components/art";
import { BAT_SLOTS, PUMPKIN_SLOTS, WEB_SLOTS, type Room } from "@/lib/room";

const INK = "#050405";

export type Spot = "portrait" | "clock" | "window" | "fire" | "candle" | "desk" | "door";

type Props = {
  room: Room;
  clockHour: number;
  candleTaken: boolean;
  clockOpen: boolean;
  drawerOpen: boolean;
  doorOpen: boolean;
  onPick: (spot: Spot) => void;
};

/** Hand angle in degrees for an hour on a clock face. */
export const hourAngle = (h: number) => (h % 12) * 30;

export default function Study({ room, clockHour, candleTaken, clockOpen, drawerOpen, doorOpen, onPick }: Props) {
  const hot = (spot: Spot, label: string) => ({
    className: "hot",
    role: "button",
    tabIndex: 0,
    "aria-label": label,
    onClick: () => onPick(spot),
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onPick(spot);
      }
    },
  });

  return (
    // The room is drawn 1400 wide (x -200 to 1200). Wide screens see all of it; phones crop to x 0 to 1000,
    // so everything that has to be counted stays inside that middle part.
    <svg viewBox="-200 0 1400 800" preserveAspectRatio="xMidYMid slice" className="study" role="img" aria-label="A dark study with a clock, portrait, window, fireplace, desk and a locked door">
      <defs>
        <HandFilter id="s-hand" scale={3} />
        <GlowFilter id="s-glow" blur={9} />
        <GlowFilter id="s-pglow" blur={3} />
        <radialGradient id="s-fire" cx="0.5" cy="1" r="0.9">
          <stop offset="0" stopColor="#d6ff9a" />
          <stop offset="0.45" stopColor="#8cff4a" />
          <stop offset="1" stopColor="#1c4a0c" />
        </radialGradient>
        <radialGradient id="s-dim" cx="0.5" cy="0.55" r="0.75">
          <stop offset="0.55" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.7" />
        </radialGradient>
        <linearGradient id="s-out" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#151515" />
          <stop offset="1" stopColor="#2a3a24" />
        </linearGradient>
        <clipPath id="s-window">
          <path d="M478 300 L 478 180 A 62 62 0 0 1 602 180 L 602 300 Z" />
        </clipPath>
      </defs>

      {/* Room shell */}
      <g filter="url(#s-hand)">
        <rect x="-200" width="1400" height="640" fill="#1b201d" />
        {Array.from({ length: 28 }, (_, i) => (
          <rect key={i} x={i * 50 - 186} y="60" width="20" height="410" fill="#202723" />
        ))}
        <rect x="-200" y="470" width="1400" height="170" fill="#1a1310" stroke={INK} strokeWidth="4" />
        {[-180, 20, 220, 700, 1030].map((x) => (
          <rect key={x} x={x} y="492" width={x === 700 ? 90 : 170} height="126" rx="6" fill="none" stroke="#2c211b" strokeWidth="4" />
        ))}
        <rect x="-200" width="1400" height="60" fill="#0e0b0d" stroke={INK} strokeWidth="4" />
        <path d="M-200 60 L 1200 60" stroke="#2b2430" strokeWidth="3" />
        {/* Pilasters frame the middle of the room, giving the corner cobwebs a corner to sit in */}
        {[0, 1000].map((x) => (
          <rect key={x} x={x - 14} y="56" width="28" height="588" fill="#2a2018" stroke={INK} strokeWidth="4" />
        ))}
        <rect x="-200" y="640" width="1400" height="160" fill="#120d0c" stroke={INK} strokeWidth="4" />
        {[660, 700, 745, 795].map((y) => (
          <path key={y} d={`M-200 ${y} L 1200 ${y}`} stroke="#0a0707" strokeWidth="3" />
        ))}
        {[120, 330, 510, 760, 900].map((x, i) => (
          <path key={x} d={`M${x} ${[640, 660, 700, 745][i % 4]} l 0 ${[20, 40, 45, 50][i % 4]}`} stroke="#0a0707" strokeWidth="3" />
        ))}
      </g>

      {/* Side decor, outside the countable middle: a bookcase on the left, an armchair on the right */}
      <g filter="url(#s-hand)" pointerEvents="none">
        <rect x="-170" y="170" width="140" height="470" fill="#2e1d10" stroke={INK} strokeWidth="4" />
        {[250, 340, 430, 520].map((y) => (
          <rect key={y} x="-162" y={y} width="124" height="10" fill="#3a2414" stroke={INK} strokeWidth="3" />
        ))}
        {[[-156, 196], [-140, 200], [-122, 192], [-100, 204], [-78, 198], [-150, 286], [-126, 290], [-96, 284], [-70, 292],
          [-158, 376], [-136, 372], [-110, 380], [-88, 376], [-146, 466], [-120, 470], [-92, 462], [-66, 468]].map(([x, y], i) => (
          <rect key={i} x={x} y={y} width={i % 3 ? 16 : 20} height={(i % 3 ? 54 : 50) - (y % 10)} fill={["#4a2a2a", "#2f3f2a", "#5a4320", "#2a2f3f"][i % 4]} stroke={INK} strokeWidth="2.5" />
        ))}
        <path d="M1030 640 L 1030 560 Q 1030 500 1060 500 L 1140 500 Q 1170 500 1170 560 L 1170 640" fill="#3b1f1f" stroke={INK} strokeWidth="4" />
        <rect x="1018" y="560" width="164" height="50" rx="14" fill="#4a2626" stroke={INK} strokeWidth="4" />
        <path d="M1040 610 L 1040 640 M1160 610 L 1160 640" stroke={INK} strokeWidth="8" strokeLinecap="round" />
        <path d="M1110 150 L 1110 300 M1080 300 Q 1110 330 1140 300 Z" stroke="#b8862c" strokeWidth="4" fill="#d9a43c" />
      </g>

      {/* Grandfather clock */}
      <g {...hot("clock", "Grandfather clock")}>
        <g filter="url(#s-hand)" strokeLinejoin="round">
          <rect x="66" y="228" width="108" height="112" rx="10" fill="#3a2414" stroke={INK} strokeWidth="4" />
          <rect x="84" y="338" width="72" height="282" fill="#33200f" stroke={INK} strokeWidth="4" />
          <rect x="74" y="616" width="92" height="24" fill="#3a2414" stroke={INK} strokeWidth="4" />
          <circle cx="120" cy="284" r="40" fill="#efe4c8" stroke={INK} strokeWidth="4" />
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i * Math.PI) / 6;
            return (
              <path
                key={i}
                d={`M${120 + Math.sin(a) * 31} ${284 - Math.cos(a) * 31} L${120 + Math.sin(a) * 36} ${284 - Math.cos(a) * 36}`}
                stroke={INK}
                strokeWidth="3"
              />
            );
          })}
          <rect x="98" y="368" width="44" height="200" rx="18" fill={clockOpen ? "#0a0607" : "#22140a"} stroke={INK} strokeWidth="4" />
        </g>
        <path
          d="M120 284 L 120 262"
          stroke={INK}
          strokeWidth="5"
          strokeLinecap="round"
          transform={`rotate(${hourAngle(clockHour)} 120 284)`}
        />
        <path d="M120 284 L 140 270" stroke="#7a0f0f" strokeWidth="3" strokeLinecap="round" />
        <circle cx="120" cy="284" r="4" fill={INK} />
        {!clockOpen && (
          <g className="swing">
            <path d="M120 372 L 120 520" stroke="#b8862c" strokeWidth="3" />
            <circle cx="120" cy="530" r="14" fill="#d9a43c" stroke={INK} strokeWidth="3" />
          </g>
        )}
      </g>

      {/* Portrait */}
      <g {...hot("portrait", "Portrait")}>
        <g filter="url(#s-hand)">
          <rect x="246" y="146" width="158" height="198" rx="6" fill="#5a3e18" stroke={INK} strokeWidth="5" />
          <rect x="262" y="162" width="126" height="166" fill="#13201a" stroke={INK} strokeWidth="3" />
          <path d="M325 236 Q 290 240 286 328 L 364 328 Q 360 240 325 236 Z" fill="#26372d" stroke={INK} strokeWidth="3" />
          <ellipse cx="325" cy="212" rx="24" ry="30" fill="#9fb59a" stroke={INK} strokeWidth="3" />
          <path d="M301 200 Q 325 166 349 200 Q 352 178 325 176 Q 298 178 301 200 Z" fill="#26372d" />
          <ellipse cx="316" cy="212" rx="4" ry="5" fill={INK} />
          <ellipse cx="334" cy="212" rx="4" ry="5" fill={INK} />
          <path d="M318 228 Q 325 233 332 228" fill="none" stroke={INK} strokeWidth="2.5" />
        </g>
        <circle cx="316" cy="212" r="1.6" fill="#8cff4a" className="flicker" />
        <circle cx="334" cy="212" r="1.6" fill="#8cff4a" className="flicker" />
      </g>

      {/* Window */}
      <g {...hot("window", "Window")}>
        <rect x="466" y="112" width="148" height="204" fill="transparent" />
        <g clipPath="url(#s-window)">
          <rect x="470" y="110" width="140" height="200" fill="url(#s-out)" />
          <circle cx="570" cy="160" r="22" fill="#f6d79a" opacity="0.9" />
          <g className="peek">
            <image href="/mascot-900.png" x="476" y="150" width="128" height="128" style={{ mixBlendMode: "lighten" }} />
          </g>
          <rect x="470" y="240" width="140" height="70" fill="#cfd8cf" opacity="0.18" className="fog-band" />
        </g>
        <g filter="url(#s-hand)" fill="none" stroke={INK}>
          <path d="M478 300 L 478 180 A 62 62 0 0 1 602 180 L 602 300 Z" strokeWidth="7" />
          <path d="M540 118 L 540 300 M478 216 L 602 216" strokeWidth="4" />
          <rect x="466" y="300" width="148" height="14" fill="#2c1e14" strokeWidth="4" />
        </g>
      </g>

      {/* Fireplace */}
      <g {...hot("fire", "Fireplace")}>
        <g filter="url(#s-hand)">
          <rect x="440" y="392" width="200" height="248" fill="#2e2a2c" stroke={INK} strokeWidth="4" />
          {[410, 440, 470, 500, 530, 560, 590, 620].map((y, i) => (
            <path key={y} d={`M440 ${y} L 640 ${y} M${i % 2 ? 490 : 465} ${y - 30} L${i % 2 ? 490 : 465} ${y} M${i % 2 ? 590 : 565} ${y - 30} L${i % 2 ? 590 : 565} ${y}`} stroke="#211e20" strokeWidth="2.5" />
          ))}
          <path d="M478 640 L 478 500 Q 540 452 602 500 L 602 640 Z" fill="#070506" stroke={INK} strokeWidth="4" />
          <rect x="420" y="372" width="240" height="22" fill="#3a2414" stroke={INK} strokeWidth="4" />
        </g>
        <g className="flicker" filter="url(#s-glow)">
          <path d="M500 636 Q 498 590 520 570 Q 518 600 532 604 Q 528 560 548 540 Q 552 580 566 590 Q 570 566 582 560 Q 590 600 580 636 Z" fill="url(#s-fire)" />
        </g>
        <path d="M496 638 L 586 626 M500 626 L 584 638" stroke="#2b1a10" strokeWidth="9" strokeLinecap="round" />
      </g>

      {/* Candle on the mantel */}
      {!candleTaken && (
        <g {...hot("candle", "Candle")}>
          <rect x="530" y="300" width="60" height="74" fill="transparent" />
          <ellipse cx="560" cy="370" rx="18" ry="5" fill="#b8862c" stroke={INK} strokeWidth="3" />
          <rect x="552" y="330" width="16" height="40" rx="3" fill="#f1efe6" stroke={INK} strokeWidth="3" />
          <path d="M556 332 q 2 10 0 14" stroke="#d8d2c2" strokeWidth="3" fill="none" />
          <g className="flicker" filter="url(#s-glow)">
            <path d="M560 304 Q 551 318 560 328 Q 569 318 560 304 Z" fill="#ffb347" />
          </g>
        </g>
      )}

      {/* Desk */}
      <g {...hot("desk", "Desk")}>
        <rect x="648" y="440" width="160" height="200" fill="transparent" />
        <g filter="url(#s-hand)">
          <rect x="652" y="494" width="152" height="18" fill="#4a2e17" stroke={INK} strokeWidth="4" />
          <rect x="664" y="512" width="12" height="128" fill="#3a2414" stroke={INK} strokeWidth="3.5" />
          <rect x="780" y="512" width="12" height="128" fill="#3a2414" stroke={INK} strokeWidth="3.5" />
          <rect x="690" y="512" width="80" height="40" fill={drawerOpen ? "#1a0f08" : "#41281a"} stroke={INK} strokeWidth="3.5" />
        </g>
        {drawerOpen ? (
          <path d="M690 552 L 682 572 L 778 572 L 770 552" fill="#41281a" stroke={INK} strokeWidth="3" />
        ) : (
          <g>
            <circle cx="730" cy="528" r="4" fill={INK} />
            <path d="M730 530 L 730 540" stroke={INK} strokeWidth="3" />
          </g>
        )}
        <g transform="translate(772 470)">
          <path d="M-14 22 L -10 -2 L 10 -2 L 14 22 Z" fill="#2f4f2a" stroke={INK} strokeWidth="3" />
          <path d="M-6 -2 L -14 -20 M0 -2 L 2 -26 M6 -2 L 14 -18" stroke="#3f7a22" strokeWidth="3" strokeLinecap="round" />
        </g>
      </g>

      {/* Door */}
      <g {...hot("door", "Locked door")}>
        <g filter="url(#s-hand)">
          <path d="M808 640 L 808 322 A 82 82 0 0 1 972 322 L 972 640 Z" fill="#2a1a10" stroke={INK} strokeWidth="5" />
          {doorOpen ? (
            <path d="M822 640 L 822 326 A 68 68 0 0 1 958 326 L 958 640 Z" fill="#ffe7a0" filter="url(#s-glow)" />
          ) : (
            <>
              <path d="M822 640 L 822 326 A 68 68 0 0 1 958 326 L 958 640 Z" fill="#4a2c16" stroke={INK} strokeWidth="4" />
              <path d="M890 262 L 890 640" stroke={INK} strokeWidth="3" />
              <rect x="836" y="350" width="40" height="110" rx="6" fill="none" stroke="#2a1a10" strokeWidth="4" />
              <rect x="904" y="350" width="40" height="110" rx="6" fill="none" stroke="#2a1a10" strokeWidth="4" />
              <rect x="836" y="500" width="40" height="110" rx="6" fill="none" stroke="#2a1a10" strokeWidth="4" />
              <rect x="904" y="500" width="40" height="110" rx="6" fill="none" stroke="#2a1a10" strokeWidth="4" />
            </>
          )}
        </g>
        {!doorOpen && (
          <g>
            <path d="M846 470 Q 890 496 934 470" fill="none" stroke="#6b6b70" strokeWidth="6" strokeDasharray="10 4" />
            <path d="M878 478 L 878 466 A 12 12 0 0 1 902 466 L 902 478" fill="none" stroke="#8d8d93" strokeWidth="5" />
            <rect x="870" y="476" width="40" height="34" rx="6" fill="#b8862c" stroke={INK} strokeWidth="3.5" />
            <text x="890" y="500" textAnchor="middle" fontSize="13" fill={INK} fontFamily="monospace">? ? ?</text>
          </g>
        )}
      </g>

      {/* Countable things: grinning pumpkins, cobwebs and bats */}
      {room.webs.map((i) => {
        const w = WEB_SLOTS[i];
        return (
          <g key={`w${i}`} transform={`translate(${w.x} ${w.y})`} pointerEvents="none">
            <Cobweb size={w.size} dx={w.dx} dy={w.dy} />
          </g>
        );
      })}
      {room.pumpkins.map(({ slot, lit }) => {
        const p = PUMPKIN_SLOTS[slot];
        return (
          <g key={`p${slot}`} transform={`translate(${p.x} ${p.y}) scale(${p.s})`} pointerEvents="none">
            <Pumpkin lit={lit} glowId="s-pglow" />
          </g>
        );
      })}
      {room.bats.map((i, n) => {
        const b = BAT_SLOTS[i];
        return (
          <g key={`b${i}`} transform={`translate(${b.x} ${b.y}) scale(0.85)`} pointerEvents="none">
            <g className={n % 2 ? "float" : "float-slow"}>
              <Bat />
            </g>
          </g>
        );
      })}

      <rect x="-200" width="1400" height="800" fill="url(#s-dim)" pointerEvents="none" />
    </svg>
  );
}
