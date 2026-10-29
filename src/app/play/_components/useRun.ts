"use client";

import { useEffect, useRef, useState } from "react";
import { HINT_PENALTY_MS, LIMIT_MS, newSeed } from "@/lib/room";
import type { RoomId } from "@/lib/rooms";
import * as sound from "@/lib/sound";

export type Phase = "intro" | "starting" | "playing" | "won" | "lost";
/** The server's verdict on a finished run: its official time and signed ticket, or why it can't be ranked. */
export type Official = { ms?: number; ticket?: string; error?: string };

export async function post(url: string, data: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  const json = await res.json().catch(() => ({}));
  return res.ok ? json : { error: json.error ?? "Something went wrong." };
}

/**
 * Everything a room shares: the server side run, the clock, hints, checkpoints and the finish.
 * The room supplies onReset to clear its own puzzle state when a new run starts.
 */
export function useRun(room: RoomId, onReset: (seed: number) => void) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(0);
  const [penalty, setPenalty] = useState(0);
  const [hints, setHints] = useState(0);
  const [finalMs, setFinalMs] = useState(0);
  const [runId, setRunId] = useState<string | null>(null);
  const [official, setOfficial] = useState<Official | null>(null);
  const [toast, setToast] = useState("Tap anything that looks suspicious.");
  // Checkpoint posts run in order so the server sees them in sequence, each one re-signing the run's ticket.
  const steps = useRef<Promise<unknown>>(Promise.resolve());
  const ticket = useRef<string | null>(null);
  const reset = useRef(onReset);
  useEffect(() => {
    reset.current = onReset;
  });

  const left = LIMIT_MS - (now - startedAt) - penalty;

  useEffect(() => {
    if (phase !== "playing") return;
    let lastTick = 0;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      const remaining = LIMIT_MS - (t - startedAt) - penalty;
      const sec = Math.ceil(remaining / 1000);
      if (sec <= 10 && sec > 0 && sec !== lastTick) {
        lastTick = sec;
        sound.tick();
      }
      if (remaining <= 0) {
        setPhase("lost");
        sound.stopAmbience();
        sound.lose();
      }
    }, 200);
    return () => clearInterval(id);
  }, [phase, startedAt, penalty]);

  useEffect(() => () => sound.stopAmbience(), []);

  async function start() {
    sound.unlock();
    setPhase("starting");
    let id: string | null = null;
    let seed = newSeed();
    const res = await post("/api/run", { room }).catch(() => null);
    if (res && !res.error) ({ id, seed } = res);
    const t = Date.now();
    steps.current = Promise.resolve();
    ticket.current = res && !res.error ? res.ticket : null;
    setRunId(id);
    setOfficial(null);
    setStartedAt(t);
    setNow(t);
    setPenalty(0);
    setHints(0);
    setToast(res?.error && res.error !== "Something went wrong." ? res.error : "Tap anything that looks suspicious.");
    reset.current(seed);
    setPhase("playing");
    sound.stopAmbience();
    sound.startAmbience();
    sound.creak();
  }

  function hint(text: string) {
    if (ticket.current) post("/api/run/hint", { ticket: ticket.current }).catch(() => {});
    setPenalty((p) => p + HINT_PENALTY_MS);
    setHints((n) => n + 1);
    setToast(`Hint (-${HINT_PENALTY_MS / 1000}s): ${text}`);
    sound.whisper();
  }

  /** Tells the server a checkpoint was reached. Queued so they arrive in order. */
  function step(name: string, value?: unknown) {
    if (!runId) return;
    steps.current = steps.current.then(() =>
      post("/api/run/step", { ticket: ticket.current, step: name, value })
        .then((r) => {
          if (r.ticket) ticket.current = r.ticket;
        })
        .catch(() => {}),
    );
  }

  function win(code: number[]) {
    setFinalMs(Date.now() - startedAt + penalty);
    setPhase("won");
    sound.stopAmbience();
    sound.win();
    if (!runId) {
      setOfficial({ error: "This run was played offline, so it can't go on the leaderboard." });
      return;
    }
    steps.current
      .then(() => post("/api/run/finish", { ticket: ticket.current, code }))
      .then(setOfficial)
      .catch(() => setOfficial({ error: "Couldn't reach the leaderboard. Your time wasn't saved." }));
  }

  return { room, phase, left, finalMs, hints, runId, official, toast, say: setToast, start, hint, step, win };
}

export type RunState = ReturnType<typeof useRun>;
