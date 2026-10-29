"use client";

import { useState } from "react";
import GameShell from "./GameShell";
import Study, { hourAngle, type Spot } from "./Study";
import { useRun } from "./useRun";
import { ROMAN, makeRoom } from "@/lib/room";
import * as sound from "@/lib/sound";

type Item = "candle" | "key" | "note";
type View = Spot | "note" | null;

const ITEM_NAMES: Record<Item, string> = { candle: "Candle", key: "Brass key", note: "Torn note" };

function ItemIcon({ item }: { item: Item }) {
  if (item === "candle") {
    return (
      <svg viewBox="0 0 40 40" aria-hidden="true">
        <rect x="15" y="16" width="10" height="20" rx="2" fill="#f1efe6" stroke="#050405" strokeWidth="2.5" />
        <path d="M20 4 Q 14 11 20 15 Q 26 11 20 4 Z" fill="#ffb347" />
      </svg>
    );
  }
  if (item === "key") {
    return (
      <svg viewBox="0 0 40 40" aria-hidden="true">
        <circle cx="12" cy="20" r="7" fill="none" stroke="#d9a43c" strokeWidth="4" />
        <path d="M19 20 L 36 20 M30 20 L 30 27 M35 20 L 35 25" stroke="#d9a43c" strokeWidth="4" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true">
      <path d="M8 6 L 32 6 L 30 18 L 33 22 L 31 34 L 8 34 Z" fill="#e8dcc0" stroke="#050405" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M13 14 L 26 14 M13 20 L 24 20 M13 26 L 22 26" stroke="#6b5a3c" strokeWidth="2" />
    </svg>
  );
}

export default function StudyGame() {
  const [room, setRoom] = useState(() => makeRoom(1));
  const [items, setItems] = useState<Item[]>([]);
  const [view, setView] = useState<View>(null);
  const [portraitLit, setPortraitLit] = useState(false);
  const [clockHour, setClockHour] = useState(12);
  const [clockOpen, setClockOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dials, setDials] = useState([0, 0, 0]);
  const [shake, setShake] = useState(0);

  const run = useRun("study", (seed) => {
    setRoom(makeRoom(seed));
    setItems([]);
    setView(null);
    setPortraitLit(false);
    setClockHour(12);
    setClockOpen(false);
    setDrawerOpen(false);
    setDials([0, 0, 0]);
  });
  const { phase, say } = run;

  const has = (item: Item) => items.includes(item);
  const give = (item: Item) => setItems((list) => (list.includes(item) ? list : [...list, item]));

  function pick(spot: Spot) {
    if (phase !== "playing") return;
    if (spot === "candle") {
      give("candle");
      run.step("candle");
      sound.pickup();
      say("You took the candle. Its light feels... nosy.");
      return;
    }
    if (spot === "window" || spot === "fire") sound.whisper();
    if (spot === "door" || spot === "desk") sound.creak();
    setView(spot);
  }

  function revealPortrait() {
    setPortraitLit(true);
    run.step("portrait");
    sound.whisper();
    say("Hidden words glow in the candlelight.");
  }

  function turnClock(by: number) {
    sound.tick();
    setClockHour((h) => ((h - 1 + by + 12) % 12) + 1);
  }

  function hint() {
    if (!has("candle")) run.hint("Something on the mantel could light the way.");
    else if (!portraitLit) run.hint("Hold the candle up to the portrait.");
    else if (!clockOpen) run.hint(`Set the clock to the hour he died (${ROMAN[room.hour]}), then pull the chain.`);
    else if (!drawerOpen) run.hint("That key fits the desk drawer.");
    else run.hint("Count only the pumpkins that grin, then the cobwebs, then the bats. Dial them into the door lock.");
  }

  function pullChain() {
    sound.bong();
    if (clockHour === room.hour) {
      setClockOpen(true);
      give("key");
      run.step("clock", clockHour);
      say("BONG. The case swings open and a brass key drops out.");
      setView(null);
    } else {
      say("BONG. Wrong hour. Something laughs inside the walls.");
    }
  }

  function unlockDrawer() {
    setDrawerOpen(true);
    give("note");
    run.step("drawer");
    sound.open();
    setView("note");
    say("The drawer creaks open. A torn note was waiting.");
  }

  function tryLock() {
    const [a, b, c] = room.code;
    if (dials[0] === a && dials[1] === b && dials[2] === c) {
      setView(null);
      sound.open();
      run.win(dials);
    } else {
      setShake((n) => n + 1);
      sound.rattle();
      say("The lock rattles and laughs at you.");
    }
  }

  const spin = (i: number, by: number) => {
    sound.clank();
    setDials((d) => d.map((v, j) => (j === i ? (v + by + 10) % 10 : v)));
  };

  return (
    <GameShell
      run={run}
      intro={<p>The door slammed behind you. You have <b>5 minutes</b> before the candles die. Find the clues and crack the lock on the door.</p>}
      scene={
        <Study
          room={room}
          clockHour={clockHour}
          candleTaken={has("candle")}
          clockOpen={clockOpen}
          drawerOpen={drawerOpen}
          doorOpen={phase === "won"}
          onPick={pick}
        />
      }
      pockets={(["candle", "key", "note"] as Item[]).map((item) => ({
        id: item,
        name: ITEM_NAMES[item],
        icon: <ItemIcon item={item} />,
        have: has(item),
        onUse: () => (item === "note" ? setView("note") : say(`${ITEM_NAMES[item]}. Try using it on something.`)),
      }))}
      onHint={hint}
      onCloseSheet={() => setView(null)}
      sheet={
        view && (
          <>
      {view === "portrait" && (
        <>
          <h3 className="sheet-title">A portrait</h3>
          <svg viewBox="0 0 200 240" className="closeup">
            <rect x="6" y="6" width="188" height="228" rx="8" fill="#5a3e18" stroke="#050405" strokeWidth="6" />
            <rect x="22" y="22" width="156" height="196" fill={portraitLit ? "#2a3a2c" : "#13201a"} />
            <path d="M100 110 Q 56 116 50 218 L 150 218 Q 144 116 100 110 Z" fill="#26372d" stroke="#050405" strokeWidth="3" />
            <ellipse cx="100" cy="80" rx="30" ry="38" fill="#9fb59a" stroke="#050405" strokeWidth="3" />
            <ellipse cx="89" cy="80" rx="5" ry="6" fill="#050405" />
            <ellipse cx="111" cy="80" rx="5" ry="6" fill="#050405" />
            <path d="M90 100 Q 100 106 110 100" fill="none" stroke="#050405" strokeWidth="3" />
            {portraitLit && (
              <>
                <ellipse cx="100" cy="186" rx="70" ry="26" fill="#ffb347" opacity="0.25" />
                <text x="100" y="178" textAnchor="middle" fontSize="15" fill="#ffd28a" fontFamily="var(--font-hand)">died at the stroke of</text>
                <text x="100" y="204" textAnchor="middle" fontSize="28" fill="#ffd28a" fontFamily="var(--font-spooky)">{ROMAN[room.hour]}</text>
              </>
            )}
          </svg>
          {portraitLit ? (
            <p>Candlelight reveals words scratched under the paint.</p>
          ) : (
            <p>Lord Grimsby, master of the house. The bottom of the canvas is too dark to read.</p>
          )}
          {has("candle") && !portraitLit && (
            <button className="btn btn-orange" onClick={revealPortrait}>
              Hold up the candle
            </button>
          )}
        </>
      )}

      {view === "clock" && (
        <>
          <h3 className="sheet-title">Grandfather clock</h3>
          <svg viewBox="0 0 200 200" className="closeup">
            <circle cx="100" cy="100" r="88" fill="#efe4c8" stroke="#050405" strokeWidth="6" />
            {ROMAN.slice(1).map((r, i) => {
              const a = ((i + 1) * Math.PI) / 6;
              return (
                <text key={r} x={100 + Math.sin(a) * 68} y={106 - Math.cos(a) * 68} textAnchor="middle" fontSize="15" fill="#050405" fontFamily="var(--font-hand)">
                  {r}
                </text>
              );
            })}
            <path d="M100 100 L 100 50" stroke="#050405" strokeWidth="8" strokeLinecap="round" transform={`rotate(${hourAngle(clockHour)} 100 100)`} style={{ transition: "transform 200ms" }} />
            <circle cx="100" cy="100" r="7" fill="#050405" />
          </svg>
          {clockOpen ? (
            <p>The case hangs open. Nothing else inside but dust.</p>
          ) : (
            <>
              <p>It stopped long ago. The hour hand turns if you push it. A chain hangs below.</p>
              <div className="row">
                <button className="btn" onClick={() => turnClock(-1)} aria-label="Turn hour hand back">⟲</button>
                <span className="spooky dial-read">{ROMAN[clockHour]}</span>
                <button className="btn" onClick={() => turnClock(1)} aria-label="Turn hour hand forward">⟳</button>
              </div>
              <button className="btn btn-orange" onClick={pullChain}>Pull the chain</button>
            </>
          )}
        </>
      )}

      {view === "window" && (
        <>
          <h3 className="sheet-title">The window</h3>
          <p>A pale face presses against the glass, then melts into the fog. Its breath leaves words behind:</p>
          <p className="scrawl">&ldquo;He stopped every clock the night he died.&rdquo;</p>
        </>
      )}

      {view === "fire" && (
        <>
          <h3 className="sheet-title">The fireplace</h3>
          <p>The flames burn green and give off no heat. They whisper:</p>
          <p className="scrawl">&ldquo;Light shows what paint hides.&rdquo;</p>
        </>
      )}

      {view === "desk" && (
        <>
          <h3 className="sheet-title">The desk</h3>
          {drawerOpen ? (
            <>
              <p>The drawer is empty now, apart from a dead spider.</p>
              <button className="btn" onClick={() => setView("note")}>Read the note again</button>
            </>
          ) : (
            <>
              <p>A heavy drawer with a small brass keyhole. It will not budge.</p>
              {has("key") && <button className="btn btn-orange" onClick={unlockDrawer}>Use the brass key</button>}
            </>
          )}
        </>
      )}

      {view === "note" && (
        <>
          <h3 className="sheet-title">A torn note</h3>
          <div className="paper">
            <p>Three numbers bar the door.</p>
            <p>First, count the pumpkins that <b>grin</b>.</p>
            <p>Then the <b>cobwebs</b>.</p>
            <p>Last, the <b>bats</b>.</p>
            <p className="sig">— G.</p>
          </div>
        </>
      )}

      {view === "door" && (
        <>
          <h3 className="sheet-title">The door</h3>
          <p>A padlock with three number dials holds the chain.</p>
          <div className="lock" key={shake} data-shake={shake > 0 || undefined}>
            {dials.map((d, i) => (
              <div className="dial" key={i}>
                <button className="dial-btn" onClick={() => spin(i, 1)} aria-label={`Dial ${i + 1} up`}>▲</button>
                <span className="dial-num">{d}</span>
                <button className="dial-btn" onClick={() => spin(i, -1)} aria-label={`Dial ${i + 1} down`}>▼</button>
              </div>
            ))}
          </div>
          <button className="btn btn-orange" onClick={tryLock}>Try the lock</button>
        </>
      )}
          </>
        )
      }
    />
  );
}
