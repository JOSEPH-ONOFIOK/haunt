// Synthesised sound for the rooms: no audio files to download. Browser only.
// Browsers block audio until a click, so unlock() runs on the Begin button.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let ambience: { stop: () => void } | null = null;
const KEY = "haunt:sound";
const listeners = new Set<() => void>();

let enabled = true;
try {
  enabled = localStorage.getItem(KEY) !== "off";
} catch {}

export const soundOn = () => enabled;
export const serverSoundOn = () => true;
export function subscribeSound(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setSound(on: boolean) {
  enabled = on;
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {}
  if (master && ctx) master.gain.setTargetAtTime(on ? 0.9 : 0, ctx.currentTime, 0.05);
  listeners.forEach((fn) => fn());
}

export function unlock() {
  if (typeof window === "undefined") return;
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = enabled ? 0.9 : 0;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume();
}

function noiseBuffer(seconds: number) {
  const buf = ctx!.createBuffer(1, Math.floor(ctx!.sampleRate * seconds), ctx!.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function tone(freq: number, dur: number, opts: { type?: OscillatorType; vol?: number; at?: number; to?: number; attack?: number } = {}) {
  if (!ctx || !master) return;
  const t = ctx.currentTime + (opts.at ?? 0);
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = opts.type ?? "sine";
  o.frequency.setValueAtTime(freq, t);
  if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(opts.vol ?? 0.1, t + (opts.attack ?? 0.01));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(dur: number, opts: { vol?: number; at?: number; type?: BiquadFilterType; freq?: number; q?: number } = {}) {
  if (!ctx || !master) return;
  const t = ctx.currentTime + (opts.at ?? 0);
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(dur);
  const f = ctx.createBiquadFilter();
  f.type = opts.type ?? "bandpass";
  f.frequency.value = opts.freq ?? 1000;
  f.Q.value = opts.q ?? 1;
  const g = ctx.createGain();
  g.gain.setValueAtTime(opts.vol ?? 0.1, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t);
}

/** Low drone and a slow wind, for as long as a room is being played. */
export function startAmbience() {
  if (!ctx || !master || ambience) return;
  const out = ctx.createGain();
  out.gain.value = 0;
  out.gain.setTargetAtTime(1, ctx.currentTime, 1.5);
  out.connect(master);

  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 260;
  lp.connect(out);
  const drones = [55, 55.6, 82.4].map((f) => {
    const o = ctx!.createOscillator();
    const g = ctx!.createGain();
    o.type = "sawtooth";
    o.frequency.value = f;
    g.gain.value = 0.035;
    o.connect(g).connect(lp);
    o.start();
    return o;
  });

  const wind = ctx.createBufferSource();
  wind.buffer = noiseBuffer(4);
  wind.loop = true;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 500;
  bp.Q.value = 0.8;
  const wg = ctx.createGain();
  wg.gain.value = 0.025;
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.value = 0.08;
  lfoGain.gain.value = 0.02;
  lfo.connect(lfoGain).connect(wg.gain);
  wind.connect(bp).connect(wg).connect(out);
  wind.start();
  lfo.start();

  ambience = {
    stop() {
      if (!ctx) return;
      out.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
      const end = ctx.currentTime + 2;
      [...drones, wind, lfo].forEach((n) => n.stop(end));
    },
  };
}

export function stopAmbience() {
  ambience?.stop();
  ambience = null;
}

export const creak = () => {
  tone(140, 0.55, { type: "sawtooth", vol: 0.05, to: 70, attack: 0.08 });
  tone(146, 0.5, { type: "sawtooth", vol: 0.03, to: 80, attack: 0.1, at: 0.05 });
};
export const pickup = () => [660, 880, 1320].forEach((f, i) => tone(f, 0.18, { type: "triangle", vol: 0.07, at: i * 0.06 }));
export const bong = () => [196, 392, 588, 784].forEach((f, i) => tone(f, 2.6 - i * 0.4, { vol: 0.14 / (i + 1), attack: 0.005 }));
export const rattle = () => Array.from({ length: 6 }, (_, i) => noise(0.05, { vol: 0.12, at: i * 0.055, type: "highpass", freq: 2200 }));
export const wrong = () => tone(90, 0.35, { type: "sawtooth", vol: 0.08, to: 60 });
export const tick = () => noise(0.03, { vol: 0.15, type: "highpass", freq: 3000 });
export const whisper = () => {
  noise(1.4, { vol: 0.06, type: "bandpass", freq: 1800, q: 4 });
  tone(420, 1.2, { vol: 0.03, to: 900, attack: 0.4 });
};
export const bubble = () => Array.from({ length: 5 }, (_, i) => tone(300 + Math.random() * 400, 0.09, { vol: 0.06, at: i * 0.07, to: 900 }));
export const clank = () => {
  tone(300, 0.25, { type: "square", vol: 0.04, to: 180 });
  noise(0.12, { vol: 0.1, type: "highpass", freq: 1500 });
};
export const open = () => {
  creak();
  tone(220, 1.2, { type: "triangle", vol: 0.05, at: 0.3, to: 440 });
};
export const win = () => {
  [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.9, { type: "triangle", vol: 0.08, at: i * 0.09 }));
  bong();
};
export const lose = () => {
  [330, 277, 220].forEach((f, i) => tone(f, 0.7, { type: "sawtooth", vol: 0.05, at: i * 0.25, to: f * 0.94 }));
  noise(1.5, { vol: 0.05, type: "lowpass", freq: 400, at: 0.6 });
};
