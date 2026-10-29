// Hand drawn SVG pieces shared by the homepage and the escape room.
// Everything is drawn around its own origin so callers place it with a transform.

const INK = "#050405";

/** Wobbles straight vector lines so they read as hand drawn. Render once per <svg>. */
export function HandFilter({ id = "hand", scale = 4 }: { id?: string; scale?: number }) {
  return (
    <filter id={id} x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence type="fractalNoise" baseFrequency="0.022" numOctaves="2" seed="7" result="noise" />
      <feDisplacementMap in="SourceGraphic" in2="noise" scale={scale} xChannelSelector="R" yChannelSelector="G" />
    </filter>
  );
}

/** Soft glow used for lit windows, pumpkins and candles. */
export function GlowFilter({ id = "glow", blur = 8 }: { id?: string; blur?: number }) {
  return (
    <filter id={id} x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation={blur} result="b" />
      <feMerge>
        <feMergeNode in="b" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  );
}

/**
 * A pumpkin about 64 wide centred on its origin.
 * Lit pumpkins have a carved, glowing grin; plain ones have no face.
 */
export function Pumpkin({ lit = false, glowId }: { lit?: boolean; glowId?: string }) {
  return (
    <g strokeLinejoin="round" strokeLinecap="round">
      {lit && <ellipse cx="0" cy="2" rx="46" ry="36" fill="#ff7a1a" opacity="0.18" />}
      <path d="M-3 -21 Q -3 -33 7 -37 L 10 -32 Q 3 -29 4 -21 Z" fill="#3f7a22" stroke={INK} strokeWidth="3" />
      <path d="M4 -30 Q 14 -36 18 -28" fill="none" stroke="#3f7a22" strokeWidth="3" />
      <ellipse cx="-14" cy="2" rx="18" ry="22" fill={lit ? "#f5821f" : "#c9661a"} stroke={INK} strokeWidth="3.5" />
      <ellipse cx="14" cy="2" rx="18" ry="22" fill={lit ? "#f5821f" : "#c9661a"} stroke={INK} strokeWidth="3.5" />
      <ellipse cx="0" cy="1" rx="15" ry="23" fill={lit ? "#ff9233" : "#d8721f"} stroke={INK} strokeWidth="3.5" />
      {lit ? (
        <g fill="#ffe27a" stroke={INK} strokeWidth="2" filter={glowId ? `url(#${glowId})` : undefined}>
          <path d="M-19 -4 L -7 -4 L -13 -14 Z" />
          <path d="M19 -4 L 7 -4 L 13 -14 Z" />
          <path d="M-20 5 Q 0 22 20 5 L 14 8 L 10 4 L 5 9 L 0 5 L -5 9 L -10 4 L -14 8 Z" />
        </g>
      ) : (
        <path d="M-8 -12 Q -12 0 -8 14" fill="none" stroke="#f0a050" strokeWidth="2.5" opacity="0.5" />
      )}
    </g>
  );
}

/**
 * Path data for a cobweb tucked into a corner at the origin.
 * dx / dy pick which way it spreads (1 = right / down, -1 = left / up).
 */
export function webPath(size: number, dx = 1, dy = 1) {
  const spokes = 6;
  const rings = [0.28, 0.5, 0.72, 0.94];
  const pt = (r: number, i: number) => {
    const a = (Math.PI / 2) * (i / (spokes - 1));
    return [dx * Math.cos(a) * r * size, dy * Math.sin(a) * r * size] as const;
  };
  let d = "";
  for (let i = 0; i < spokes; i++) {
    const [x, y] = pt(1, i);
    d += `M0 0 L${x.toFixed(1)} ${y.toFixed(1)} `;
  }
  for (const r of rings) {
    for (let i = 0; i < spokes - 1; i++) {
      const [x1, y1] = pt(r, i);
      const [x2, y2] = pt(r, i + 1);
      const [cx, cy] = pt(r * 0.78, i + 0.5);
      d += `M${x1.toFixed(1)} ${y1.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)} `;
    }
  }
  return d;
}

export function Cobweb({ size, dx = 1, dy = 1, opacity = 0.75 }: { size: number; dx?: number; dy?: number; opacity?: number }) {
  return (
    <path
      d={webPath(size, dx, dy)}
      fill="none"
      stroke="#dfe6dc"
      strokeWidth="1.7"
      strokeLinecap="round"
      opacity={opacity}
    />
  );
}

/** A small bat, roughly 64 wide, centred on its origin. */
export function Bat({ flap = true }: { flap?: boolean }) {
  return (
    <g>
      <g className={flap ? "flap" : undefined}>
        <path
          d="M0 -2 Q -8 -10 -16 -6 Q -22 -14 -32 -8 Q -27 -1 -30 7 Q -20 2 -13 9 Q -6 4 0 7 Q 6 4 13 9 Q 20 2 30 7 Q 27 -1 32 -8 Q 22 -14 16 -6 Q 8 -10 0 -2 Z"
          fill="#060506"
          stroke="#56604f"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </g>
      <path d="M-6 -4 L -6 -13 L -2 -7 L 2 -7 L 6 -13 L 6 -4 Q 6 5 0 5 Q -6 5 -6 -4 Z" fill="#060506" stroke="#56604f" strokeWidth="1.4" />
      <circle cx="-2.6" cy="-3" r="1.4" fill="#8cff4a" />
      <circle cx="2.6" cy="-3" r="1.4" fill="#8cff4a" />
    </g>
  );
}

export function XIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function CornerWeb({ className, flip = false }: { className?: string; flip?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 200 200" aria-hidden="true" style={flip ? { transform: "scaleX(-1)" } : undefined}>
      <Cobweb size={196} opacity={0.6} />
      <path d="M118 0 L 118 74" stroke="#dfe6dc" strokeWidth="1.2" opacity="0.6" />
      <g transform="translate(118 80)">
        <ellipse cx="0" cy="0" rx="7" ry="8" fill="#050405" stroke="#56604f" strokeWidth="1.2" />
        <path d="M-6 -2 L -14 -8 M-6 2 L -15 3 M-5 5 L -12 12 M6 -2 L 14 -8 M6 2 L 15 3 M5 5 L 12 12" stroke="#050405" strokeWidth="2" strokeLinecap="round" />
        <circle cx="-2.5" cy="-2" r="1.3" fill="#ff7a1a" />
        <circle cx="2.5" cy="-2" r="1.3" fill="#ff7a1a" />
      </g>
    </svg>
  );
}
