"use client";

import Link from "next/link";
import { useSyncExternalStore, type ReactNode } from "react";
import Result from "./Result";
import type { RunState } from "./useRun";
import { HINT_PENALTY_MS, LIMIT_MS } from "@/lib/room";
import { ROOMS } from "@/lib/rooms";
import * as sound from "@/lib/sound";

export const formatTime = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export type Pocket = { id: string; name: string; icon: ReactNode; have: boolean; onUse: () => void };

type Props = {
  run: RunState;
  intro: ReactNode;
  scene: ReactNode;
  pockets: Pocket[];
  onHint: () => void;
  /** The open close-up, if any. */
  sheet: ReactNode;
  onCloseSheet: () => void;
};

function SoundToggle() {
  const on = useSyncExternalStore(sound.subscribeSound, sound.soundOn, sound.serverSoundOn);
  return (
    <button className="btn btn-sm btn-ghost sound-btn" onClick={() => { sound.unlock(); sound.setSound(!on); }} aria-label={on ? "Mute sound" : "Turn sound on"} aria-pressed={on}>
      {on ? "🔊" : "🔇"}
    </button>
  );
}

export default function GameShell({ run, intro, scene, pockets, onHint, sheet, onCloseSheet }: Props) {
  const { phase } = run;
  const idle = phase === "intro" || phase === "starting";

  return (
    <div className="game">
      <div className="hud">
        <div className={`timer${phase === "playing" && run.left < 60_000 ? " timer-low" : ""}`} role="timer" aria-label="Time left">
          {idle ? formatTime(LIMIT_MS) : formatTime(phase === "won" ? LIMIT_MS - run.finalMs : run.left)}
        </div>
        <div className="hud-actions">
          <SoundToggle />
          <button className="btn btn-sm btn-orange" onClick={onHint} disabled={phase !== "playing"}>Hint</button>
          <button className="btn btn-sm" onClick={run.start} disabled={idle}>Restart</button>
        </div>
      </div>

      <div className="stage">
        {scene}
        <div className="fog" style={{ bottom: 0, height: "30%" }} />

        {idle && (
          <div className="overlay">
            <div className="panel">
              <h2 className="spooky panel-title">{ROOMS[run.room].name}</h2>
              {intro}
              <ul className="rules">
                <li>Tap or click things in the room to inspect them.</li>
                <li>Collect items. They show up in your pockets below the room.</li>
                <li>Stuck? A hint costs {HINT_PENALTY_MS / 1000} seconds.</li>
              </ul>
              <p className="muted">Every run is shuffled, so the answers change each time.</p>
              <button className="btn btn-green btn-big" onClick={run.start} disabled={phase === "starting"}>
                {phase === "starting" ? "The door creaks..." : "Begin"}
              </button>
            </div>
          </div>
        )}

        {phase === "lost" && (
          <div className="overlay">
            <div className="panel">
              <h2 className="spooky panel-title" style={{ color: "var(--red)" }}>The candles died</h2>
              <p>The mansion keeps you... for now.</p>
              <div className="panel-actions">
                <button className="btn btn-orange btn-big" onClick={run.start}>Try again</button>
                <Link className="btn btn-ghost" href="/">Run home</Link>
              </div>
            </div>
          </div>
        )}

        {phase === "won" && (
          <div className="overlay overlay-light">
            <Result room={run.room} localMs={run.finalMs} hints={run.hints} runId={run.runId} official={run.official} onRestart={run.start} />
          </div>
        )}
      </div>

      <div className="toast" aria-live="polite">{phase === "playing" ? run.toast : " "}</div>

      <div className="pockets" aria-label="Your items">
        {pockets.map((p) => (
          <button
            key={p.id}
            className={`pocket${p.have ? " pocket-full" : ""}`}
            disabled={!p.have || phase !== "playing"}
            onClick={p.onUse}
            aria-label={p.have ? p.name : "Empty pocket"}
          >
            {p.have ? p.icon : <span className="pocket-empty">?</span>}
            <span className="pocket-name">{p.have ? p.name : "Empty"}</span>
          </button>
        ))}
      </div>

      {sheet && phase === "playing" && (
        <div className="sheet-back" onClick={onCloseSheet}>
          <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <button className="sheet-close" onClick={onCloseSheet} aria-label="Close">×</button>
            {sheet}
          </div>
        </div>
      )}
    </div>
  );
}
