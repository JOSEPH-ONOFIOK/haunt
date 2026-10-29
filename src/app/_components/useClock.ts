"use client";

import { useSyncExternalStore } from "react";

function subscribe(tick: () => void) {
  const id = setInterval(tick, 1000);
  return () => clearInterval(id);
}
// Whole seconds so the snapshot stays stable between ticks.
const nowMs = () => Math.floor(Date.now() / 1000) * 1000;
const serverNow = () => null;

/** The current time, ticking each second. Null while rendering on the server. */
export const useClock = () => useSyncExternalStore(subscribe, nowMs, serverNow);
