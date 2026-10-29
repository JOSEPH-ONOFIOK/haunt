import { Bat, GlowFilter, HandFilter, Pumpkin } from "./art";

const INK = "#050405";
const WALL = "#0f0d12";

// The drawing runs from x = -900 to 1500 and y = -420 to 640. The wide sky and ground on the left
// leave room for the hero text beside the mansion, so the scene fits one screen.
const STARS = [
  [-860, -360], [-700, -250], [-560, -390], [-420, -200], [-300, -330], [-140, -260], [-820, -80], [-620, -120],
  [-480, 40], [-260, -40], [-80, 80], [-760, 200], [-360, 160], [1300, -350], [1420, -180], [1360, 60], [1460, 260],
  [90, -380], [260, -300], [430, -400], [610, -340], [800, -390], [980, -310], [1130, -370], [60, -180],
  [520, -230], [700, -150], [1150, -200], [880, -60], [40, -40], [470, -60],
  [60, 40], [140, 110], [220, 60], [310, 150], [390, 50], [470, 120], [540, 30], [680, 90],
  [760, 40], [820, 140], [1100, 60], [1160, 160], [1060, 250], [30, 220], [250, 240], [700, 180],
];

type Glow = "orange" | "green" | "dark";
const FILL: Record<Glow, string> = { orange: "#ffb347", green: "#a6ff6a", dark: "#1b1922" };

function Window({ x, y, w = 34, h = 50, glow }: { x: number; y: number; w?: number; h?: number; glow: Glow }) {
  const r = w / 2;
  const d = `M${x} ${y + h} L${x} ${y + r} A${r} ${r} 0 0 1 ${x + w} ${y + r} L${x + w} ${y + h} Z`;
  return (
    <g className={glow === "dark" ? undefined : "flicker"}>
      <path d={d} fill={FILL[glow]} stroke={INK} strokeWidth="3.5" filter={glow === "dark" ? undefined : "url(#m-glow)"} />
      <path d={`M${x + r} ${y + 4} L${x + r} ${y + h} M${x} ${y + h * 0.62} L${x + w} ${y + h * 0.62}`} stroke={INK} strokeWidth="3" />
    </g>
  );
}

export default function Mansion() {
  return (
    <svg viewBox="-900 -420 2400 1060" preserveAspectRatio="xMidYMax slice" role="img" aria-label="A haunted mansion on a hill under an orange moon, watched by a hooded figure with glowing green eyes">
      <defs>
        <HandFilter id="m-hand" scale={5} />
        <GlowFilter id="m-glow" blur={7} />
        <GlowFilter id="m-pglow" blur={4} />
        <linearGradient id="m-sky" x1="0" y1="0" x2="0" y2="1">
          {/* Never darker than the mascot art's #151515 backdrop, so the lighten blend hides it */}
          <stop offset="0" stopColor="#151515" />
          <stop offset="0.65" stopColor="#161c15" />
          <stop offset="1" stopColor="#1b2a14" />
        </linearGradient>
        <radialGradient id="m-moon-halo">
          <stop offset="0.45" stopColor="#ff9a3c" stopOpacity="0.35" />
          <stop offset="1" stopColor="#ff7a1a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="m-door">
          <stop offset="0" stopColor="#ffe08a" />
          <stop offset="1" stopColor="#ff7a1a" />
        </radialGradient>
      </defs>

      <rect x="-900" y="-420" width="2400" height="1060" fill="url(#m-sky)" />
      {STARS.map(([x, y], i) => (
        <path
          key={i}
          d={`M${x} ${y - 4} L${x + 1.2} ${y - 1.2} L${x + 4} ${y} L${x + 1.2} ${y + 1.2} L${x} ${y + 4} L${x - 1.2} ${y + 1.2} L${x - 4} ${y} L${x - 1.2} ${y - 1.2} Z`}
          fill="#f1ece1"
          opacity={0.35 + (i % 4) * 0.15}
        />
      ))}

      {/* Moon */}
      <g className="moon">
      <circle cx="1060" cy="-230" r="210" fill="url(#m-moon-halo)" />
      <g filter="url(#m-hand)">
        <circle cx="1060" cy="-230" r="90" fill="#f6d79a" stroke={INK} strokeWidth="4" />
        <circle cx="1026" cy="-256" r="14" fill="#e8bf78" />
        <circle cx="1090" cy="-198" r="20" fill="#e8bf78" />
        <circle cx="1086" cy="-272" r="8" fill="#e8bf78" />
      </g>
      </g>

      {/* The hooded one, looming over the hill behind the east wing */}
      <g className="float-slow">
        <image href="/mascot-900.png" x="770" y="20" width="440" height="440" style={{ mixBlendMode: "lighten" }} />
      </g>

      <g transform="translate(330 -230) scale(0.9)"><g className="float"><Bat /></g></g>
      <g transform="translate(880 -300) scale(0.8)"><g className="float-slow"><Bat /></g></g>
      <g transform="translate(420 230) scale(0.6)"><g className="float"><Bat /></g></g>
      <g transform="translate(1250 -120) scale(0.6)"><g className="float-slow"><Bat /></g></g>

      {/* Far hills */}
      <path d="M-900 640 L-900 468 Q -620 420 -330 452 T 0 470 Q 200 410 420 450 T 820 430 T 1200 455 Q 1360 430 1500 452 L1500 640 Z" fill="#0c120c" />

      {/* Mansion */}
      <g filter="url(#m-hand)" strokeLinejoin="round">
        <rect x="700" y="210" width="28" height="80" fill={WALL} stroke={INK} strokeWidth="4" />
        <rect x="430" y="300" width="340" height="245" fill={WALL} stroke={INK} strokeWidth="4" />
        <path d="M405 308 L 600 196 L 795 308 Z" fill="#0a090c" stroke={INK} strokeWidth="4" />
        <rect x="555" y="168" width="90" height="140" fill={WALL} stroke={INK} strokeWidth="4" />
        <path d="M538 176 L 600 62 L 662 176 Z" fill="#0a090c" stroke={INK} strokeWidth="4" />
        <path d="M600 62 L 600 36 M590 44 L 610 44" stroke={INK} strokeWidth="4" strokeLinecap="round" />

        <rect x="330" y="360" width="110" height="185" fill={WALL} stroke={INK} strokeWidth="4" />
        <rect x="350" y="226" width="62" height="140" fill={WALL} stroke={INK} strokeWidth="4" />
        <path d="M336 232 L 381 128 L 426 232 Z" fill="#0a090c" stroke={INK} strokeWidth="4" />

        <rect x="760" y="352" width="122" height="193" fill={WALL} stroke={INK} strokeWidth="4" />
        <path d="M744 360 L 821 282 L 898 360 Z" fill="#0a090c" stroke={INK} strokeWidth="4" />

        <path d="M418 304 Q 450 330 470 306 M730 306 Q 760 336 782 306" fill="none" stroke="#2a2530" strokeWidth="2" />
      </g>

      <circle cx="600" cy="220" r="18" fill="#a6ff6a" stroke={INK} strokeWidth="3.5" filter="url(#m-glow)" className="flicker" />
      <Window x={365} y={262} w={32} h={46} glow="orange" />
      <Window x={460} y={330} glow="orange" />
      <Window x={520} y={330} glow="dark" />
      <Window x={646} y={330} glow="green" />
      <Window x={706} y={330} glow="orange" />
      <Window x={460} y={420} glow="dark" />
      <Window x={706} y={420} glow="orange" />
      <Window x={355} y={410} glow="green" />
      <Window x={790} y={385} glow="orange" />
      <Window x={840} y={385} glow="dark" />
      <Window x={815} y={460} glow="green" />

      {/* Door */}
      <path d="M572 545 L 572 488 A 28 28 0 0 1 628 488 L 628 545 Z" fill="url(#m-door)" stroke={INK} strokeWidth="4" filter="url(#m-glow)" />
      <path d="M600 462 L 600 545" stroke={INK} strokeWidth="3" />
      <path d="M552 545 L 648 545 L 656 560 L 544 560 Z" fill="#141118" stroke={INK} strokeWidth="3.5" />

      {/* Dead tree */}
      <g filter="url(#m-hand)" stroke={INK} strokeLinecap="round" fill="none">
        <path d="M150 560 Q 160 470 140 380 Q 132 330 150 290" strokeWidth="16" />
        <path d="M145 400 Q 100 370 70 320 M60 330 L 52 300" strokeWidth="8" />
        <path d="M148 330 Q 190 300 230 300 Q 250 296 262 278" strokeWidth="7" />
        <path d="M150 292 Q 140 250 160 220 M150 292 Q 176 268 186 240" strokeWidth="5" />
        <path d="M100 368 Q 92 350 98 334" strokeWidth="4" />
      </g>

      {/* Foreground */}
      <path d="M-900 640 L-900 566 Q -600 532 -300 552 T 0 560 Q 300 528 600 556 T 1200 546 Q 1360 534 1500 552 L1500 640 Z" fill="#050605" />
      <g stroke={INK} strokeWidth="3" filter="url(#m-hand)">
        {[440, 480, 520, 680, 720, 760].map((x) => (
          <path key={x} d={`M${x} 590 L${x} 548 L${x + 6} 538 L${x + 12} 548 L${x + 12} 590 Z`} fill="#121014" />
        ))}
        <path d="M432 560 L 778 560" stroke="#121014" strokeWidth="6" />
      </g>
      <g filter="url(#m-hand)" stroke={INK} strokeWidth="4">
        <path d="M40 610 L 40 560 Q 40 528 72 528 Q 104 528 104 560 L 104 610 Z" fill="#2b2a2e" />
        <path d="M60 560 L 84 560 M72 548 L 72 584" stroke="#14131a" strokeWidth="4" strokeLinecap="round" />
        <path d="M1090 616 L 1094 572 Q 1098 548 1122 550 Q 1148 554 1146 580 L 1142 618 Z" fill="#2b2a2e" />
      </g>

      <g filter="url(#m-hand)" stroke={INK} strokeWidth="4">
        <path d="M-520 612 L -520 572 Q -520 546 -494 546 Q -468 546 -468 572 L -468 612 Z" fill="#2b2a2e" />
        <path d="M-180 618 L -176 584 Q -172 562 -150 564 Q -128 568 -130 590 L -134 620 Z" fill="#2b2a2e" />
      </g>
      <g transform="translate(-330 600) scale(0.9)"><Pumpkin lit glowId="m-pglow" /></g>
      <g transform="translate(-700 606) scale(0.75)"><Pumpkin /></g>
      <g transform="translate(250 588) scale(1.05)"><Pumpkin lit glowId="m-pglow" /></g>
      <g transform="translate(330 604) scale(0.8)"><Pumpkin /></g>
      <g transform="translate(870 596) scale(0.95)"><Pumpkin lit glowId="m-pglow" /></g>
      <g transform="translate(965 610) scale(1.15)"><Pumpkin lit glowId="m-pglow" /></g>
    </svg>
  );
}
