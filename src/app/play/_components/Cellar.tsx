import type { KeyboardEvent } from "react";
import { Cobweb, GlowFilter, HandFilter } from "../../_components/art";
import { BARREL_X, POTIONS, type Cellar as CellarRoom } from "@/lib/cellar";

const INK = "#050405";

export type CellarSpot = "coffin" | "well" | "shelf" | "levers" | "gate" | "barrels" | "torch";

type Props = {
  room: CellarRoom;
  coffinOpen: boolean;
  bucketUp: boolean;
  shelfOpen: boolean;
  levers: number[];
  gateOpen: boolean;
  onPick: (spot: CellarSpot) => void;
};

function Barrel({ x, marked }: { x: number; marked: boolean }) {
  return (
    <g transform={`translate(${x} 0)`}>
      <path d="M-50 530 Q -60 585 -50 640 L 50 640 Q 60 585 50 530 Z" fill="#5a3516" stroke={INK} strokeWidth="4" />
      <ellipse cx="0" cy="530" rx="50" ry="12" fill="#6b4220" stroke={INK} strokeWidth="4" />
      <path d="M-55 560 Q 0 568 55 560 M-56 612 Q 0 620 56 612" fill="none" stroke="#2a2a2e" strokeWidth="6" />
      {[-28, 0, 28].map((dx) => (
        <path key={dx} d={`M${dx} 540 Q ${dx * 1.1} 585 ${dx} 636`} fill="none" stroke="#3e2410" strokeWidth="2" />
      ))}
      {marked && <path d="M-20 568 L 20 604 M20 568 L -20 604" stroke="#f1efe6" strokeWidth="7" strokeLinecap="round" opacity="0.9" />}
    </g>
  );
}

function Torch({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M-6 0 L 6 0 L 3 46 L -3 46 Z" fill="#4a2e17" stroke={INK} strokeWidth="3" />
      <path d="M-12 46 L 12 46" stroke="#2a2a2e" strokeWidth="6" />
      <g className="flicker" filter="url(#c-glow)">
        <path d="M0 -40 Q -16 -14 -8 2 Q 0 8 8 2 Q 16 -14 0 -40 Z" fill="#ff8a1e" />
        <path d="M0 -24 Q -7 -8 -3 0 Q 0 3 3 0 Q 7 -8 0 -24 Z" fill="#ffe27a" />
      </g>
    </g>
  );
}

export default function Cellar({ room, coffinOpen, bucketUp, shelfOpen, levers, gateOpen, onPick }: Props) {
  const hot = (spot: CellarSpot, label: string) => ({
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
    // Drawn 1400 wide like the study; phones crop to x 0 to 1000, where the marked barrels live.
    <svg viewBox="-200 0 1400 800" preserveAspectRatio="xMidYMid slice" className="study" role="img" aria-label="A stone cellar with a coffin, a well, a potion shelf, four barrels, a lever panel and an iron gate">
      <defs>
        <HandFilter id="c-hand" scale={3} />
        <GlowFilter id="c-glow" blur={9} />
        <radialGradient id="c-dim" cx="0.5" cy="0.55" r="0.75">
          <stop offset="0.5" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.75" />
        </radialGradient>
        <radialGradient id="c-out" cx="0.5" cy="0.6" r="0.6">
          <stop offset="0" stopColor="#c8ffb0" />
          <stop offset="1" stopColor="#1f5a16" />
        </radialGradient>
        <pattern id="c-brick" width="80" height="40" patternUnits="userSpaceOnUse">
          <rect width="80" height="40" fill="#1f2622" />
          <path d="M0 0 L 80 0 M0 20 L 80 20 M20 0 L 20 20 M60 20 L 60 40" stroke="#141a16" strokeWidth="3" />
        </pattern>
      </defs>

      {/* Stone shell with arches */}
      <g filter="url(#c-hand)">
        <rect x="-200" width="1400" height="640" fill="url(#c-brick)" />
        {[-200, 150, 500, 850].map((x) => (
          <path key={x} d={`M${x} 120 Q ${x + 175} -40 ${x + 350} 120`} fill="none" stroke="#0d110f" strokeWidth="26" />
        ))}
        <rect x="-200" width="1400" height="40" fill="#0d110f" />
        <rect x="-200" y="640" width="1400" height="160" fill="#14110e" stroke={INK} strokeWidth="4" />
        {[670, 720, 770].map((y) => (
          <path key={y} d={`M-200 ${y} Q 500 ${y + 10} 1200 ${y}`} stroke="#0c0a08" strokeWidth="3" fill="none" />
        ))}
      </g>
      {[120, 380, 640, 880].map((x, i) => (
        <path key={x} d={`M${x} 40 q 4 ${30 + i * 8} 0 ${48 + i * 10} q -4 8 0 14`} stroke="#5cff6a" strokeWidth="5" fill="none" strokeLinecap="round" opacity="0.65" className="flicker" />
      ))}
      <g pointerEvents="none">
        <Cobweb size={110} dx={1} dy={1} opacity={0.5} />
      </g>

      {/* Side decor outside the middle: wine racks left, chains and skulls right */}
      <g filter="url(#c-hand)" pointerEvents="none">
        <rect x="-180" y="300" width="150" height="340" fill="#2a1a0e" stroke={INK} strokeWidth="4" />
        {Array.from({ length: 12 }, (_, i) => (
          <circle key={i} cx={-150 + (i % 3) * 45} cy={340 + Math.floor(i / 3) * 75} r="16" fill={i % 4 === 1 ? "#5a1a2a" : "#1d2b1a"} stroke={INK} strokeWidth="3" />
        ))}
        <path d="M1060 40 L 1060 300 M1140 40 L 1140 240" stroke="#55555c" strokeWidth="6" strokeDasharray="14 6" />
        {[1040, 1090, 1140, 1065, 1115].map((x, i) => (
          <g key={i} transform={`translate(${x} ${i < 3 ? 616 : 584})`}>
            <path d="M-16 0 Q -18 -26 0 -26 Q 18 -26 16 0 L 8 6 L -8 6 Z" fill="#e8e0c8" stroke={INK} strokeWidth="3" />
            <circle cx="-6" cy="-10" r="4" fill={INK} />
            <circle cx="6" cy="-10" r="4" fill={INK} />
          </g>
        ))}
      </g>

      <g {...hot("torch", "Torch")}>
        <rect x="206" y="124" width="48" height="96" fill="transparent" />
        <Torch x={230} y={170} />
      </g>
      <Torch x={790} y={150} />

      {/* Coffin */}
      <g {...hot("coffin", "Coffin")}>
        <g filter="url(#c-hand)">
          <path d="M60 300 L 120 300 L 150 360 L 135 640 L 45 640 L 30 360 Z" fill={coffinOpen ? "#0b0807" : "#3b2414"} stroke={INK} strokeWidth="5" />
          {coffinOpen ? (
            <g>
              <circle cx="90" cy="360" r="18" fill="#e8e0c8" stroke={INK} strokeWidth="3" />
              <path d="M90 380 L 90 500 M70 410 L 110 410 M74 430 L 106 430 M78 450 L 102 450 M90 500 L 75 600 M90 500 L 105 600" stroke="#e8e0c8" strokeWidth="5" strokeLinecap="round" />
              <path d="M40 300 L 4 296 L -16 360 L 0 640 L 40 640" fill="#3b2414" stroke={INK} strokeWidth="4" />
            </g>
          ) : (
            <path d="M90 330 L 90 420 M66 360 L 114 360" stroke="#b8862c" strokeWidth="6" strokeLinecap="round" />
          )}
        </g>
      </g>

      {/* Potion shelf */}
      <g {...hot("shelf", "Potion shelf")}>
        <rect x="262" y="220" width="316" height="134" fill="transparent" />
        <g filter="url(#c-hand)">
          <rect x="270" y="300" width="300" height="16" fill="#3a2414" stroke={INK} strokeWidth="4" />
          <path d="M290 316 L 300 350 M550 316 L 540 350" stroke={INK} strokeWidth="5" />
          {shelfOpen && <rect x="380" y="190" width="80" height="60" fill="#070506" stroke={INK} strokeWidth="4" />}
        </g>
        {POTIONS.map((p, i) => (
          <g key={p.name} transform={`translate(${310 + i * 74} 300)`}>
            <path d="M-6 -62 L 6 -62 L 6 -44 Q 22 -34 22 -16 Q 22 0 0 0 Q -22 0 -22 -16 Q -22 -34 -6 -44 Z" fill={p.fill} stroke={INK} strokeWidth="3" opacity="0.92" />
            <rect x="-8" y="-70" width="16" height="9" fill="#6b4220" stroke={INK} strokeWidth="2" />
            <path d="M-12 -24 q 6 -6 10 0" stroke="#fff" strokeWidth="3" fill="none" opacity="0.6" />
          </g>
        ))}
      </g>

      {/* Lever panel: the lever drawn over each barrel's column */}
      <g {...hot("levers", "Lever panel")}>
        <g filter="url(#c-hand)">
          <rect x="190" y="400" width="480" height="64" rx="8" fill="#2a2a2e" stroke={INK} strokeWidth="4" />
        </g>
        {BARREL_X.map((x, i) => (
          <g key={x}>
            <circle cx={x} cy="432" r="9" fill="#55555c" stroke={INK} strokeWidth="3" />
            <path d={levers[i] ? `M${x} 432 L ${x} 470` : `M${x} 432 L ${x} 394`} stroke="#9a9aa2" strokeWidth="8" strokeLinecap="round" />
            <circle cx={x} cy={levers[i] ? 474 : 390} r="10" fill="#c0392b" stroke={INK} strokeWidth="3" />
          </g>
        ))}
      </g>

      {/* Barrels: the chalk marks are the lever code */}
      <g {...hot("barrels", "Barrels")}>
        <rect x="186" y="516" width="484" height="126" fill="transparent" />
        {BARREL_X.map((x, i) => (
          <Barrel key={x} x={x} marked={room.marks[i]} />
        ))}
      </g>

      {/* Well with a winch */}
      <g {...hot("well", "Well")}>
        <rect x="684" y="284" width="172" height="370" fill="transparent" />
        <g filter="url(#c-hand)">
          <path d="M700 300 L 700 520 M840 300 L 840 520" stroke="#3a2414" strokeWidth="12" />
          <rect x="690" y="290" width="160" height="16" fill="#3a2414" stroke={INK} strokeWidth="4" />
          <ellipse cx="770" cy="540" rx="82" ry="20" fill="#0a0807" stroke={INK} strokeWidth="4" />
          <path d="M688 540 L 688 630 Q 770 656 852 630 L 852 540" fill="#3c3a40" stroke={INK} strokeWidth="4" />
          {[560, 590, 620].map((y) => (
            <path key={y} d={`M690 ${y} Q 770 ${y + 18} 850 ${y}`} stroke="#28262c" strokeWidth="3" fill="none" />
          ))}
        </g>
        <path d={`M770 306 L 770 ${bucketUp ? 360 : 530}`} stroke="#b8a070" strokeWidth="3" />
        {bucketUp && <path d="M748 360 L 792 360 L 786 400 L 754 400 Z" fill="#6b4220" stroke={INK} strokeWidth="3" />}
      </g>

      {/* Iron gate */}
      <g {...hot("gate", "Iron gate")}>
        <rect x="866" y="236" width="128" height="406" fill="transparent" />
        <path d="M870 640 L 870 300 A 60 60 0 0 1 990 300 L 990 640 Z" fill={gateOpen ? "url(#c-out)" : "#0a1208"} stroke={INK} strokeWidth="5" filter={gateOpen ? "url(#c-glow)" : undefined} />
        {!gateOpen && (
          <g stroke="#55555c" strokeWidth="7" strokeLinecap="round">
            {[890, 915, 940, 965].map((x) => (
              <path key={x} d={`M${x} ${x === 890 || x === 965 ? 280 : 250} L ${x} 636`} />
            ))}
            <path d="M872 400 L 988 400 M872 520 L 988 520" />
          </g>
        )}
      </g>

      <rect x="-200" width="1400" height="800" fill="url(#c-dim)" pointerEvents="none" />
    </svg>
  );
}
