"use client";

import { useSyncExternalStore } from "react";

function subscribe(tick: () => void) {
  const id = setInterval(tick, 1000);
  return () => clearInterval(id);
}

// Whole seconds so the snapshot stays stable between ticks.
const nowSeconds = () => Math.floor(Date.now() / 1000);
const serverSeconds = () => null;

const pad = (n: number) => String(n).padStart(2, "0");

export default function Countdown({ target }: { target: string }) {
  const now = useSyncExternalStore(subscribe, nowSeconds, serverSeconds);
  const end = Math.floor(new Date(target).getTime() / 1000);
  const left = now === null ? null : Math.max(0, end - now);

  if (left === 0) {
    return (
      <div className="countdown" aria-live="polite">
        <div className="countdown-live">The mansion is open</div>
      </div>
    );
  }

  const parts = [
    { unit: "days", value: left === null ? "--" : pad(Math.floor(left / 86400)) },
    { unit: "hours", value: left === null ? "--" : pad(Math.floor((left % 86400) / 3600)) },
    { unit: "mins", value: left === null ? "--" : pad(Math.floor((left % 3600) / 60)) },
    { unit: "secs", value: left === null ? "--" : pad(left % 60) },
  ];

  return (
    <div className="countdown">
      <div className="countdown-label">The doors open in</div>
      <div className="countdown-row" role="timer" aria-label="Time until launch">
        {parts.map((p) => (
          <div className="count-cell" key={p.unit}>
            <span className="count-num">{p.value}</span>
            <span className="count-unit">{p.unit}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
