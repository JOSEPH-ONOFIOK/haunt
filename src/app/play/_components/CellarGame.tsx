"use client";

import { useState } from "react";
import Cellar, { type CellarSpot } from "./Cellar";
import GameShell from "./GameShell";
import { useRun } from "./useRun";
import { POTIONS, makeCellar } from "@/lib/cellar";
import * as sound from "@/lib/sound";

type Item = "crank" | "scroll" | "chart";
type View = CellarSpot | "scroll" | "chart" | null;

const ITEM_NAMES: Record<Item, string> = { crank: "Iron crank", scroll: "Wet scroll", chart: "Lever chart" };

function ItemIcon({ item }: { item: Item }) {
  if (item === "crank") {
    return (
      <svg viewBox="0 0 40 40" aria-hidden="true">
        <path d="M8 30 L 22 16 L 30 24 M22 16 L 22 6" stroke="#9a9aa2" strokeWidth="5" strokeLinecap="round" fill="none" />
        <circle cx="30" cy="26" r="5" fill="#c0392b" stroke="#050405" strokeWidth="2" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true">
      <rect x="8" y="6" width="24" height="28" rx="3" fill={item === "scroll" ? "#cfe8c0" : "#e8dcc0"} stroke="#050405" strokeWidth="2.5" />
      <path d="M13 14 L 27 14 M13 20 L 25 20 M13 26 L 22 26" stroke="#6b5a3c" strokeWidth="2" />
    </svg>
  );
}

export default function CellarGame() {
  const [room, setRoom] = useState(() => makeCellar(1));
  const [items, setItems] = useState<Item[]>([]);
  const [view, setView] = useState<View>(null);
  const [coffinOpen, setCoffinOpen] = useState(false);
  const [bucketUp, setBucketUp] = useState(false);
  const [poured, setPoured] = useState<number[]>([]);
  const [shelfOpen, setShelfOpen] = useState(false);
  const [leversSeen, setLeversSeen] = useState(false);
  const [levers, setLevers] = useState([0, 0, 0, 0]);
  const [shake, setShake] = useState(0);

  const run = useRun("cellar", (seed) => {
    setRoom(makeCellar(seed));
    setItems([]);
    setView(null);
    setCoffinOpen(false);
    setBucketUp(false);
    setPoured([]);
    setShelfOpen(false);
    setLeversSeen(false);
    setLevers([0, 0, 0, 0]);
  });
  const { phase, say } = run;

  const has = (item: Item) => items.includes(item);
  const give = (item: Item) => setItems((list) => (list.includes(item) ? list : [...list, item]));

  function pick(spot: CellarSpot) {
    if (phase !== "playing") return;
    if (spot === "levers" && has("chart") && !leversSeen) {
      setLeversSeen(true);
      run.step("levers");
    }
    if (spot === "torch" || spot === "barrels") sound.whisper();
    if (spot === "gate" || spot === "coffin") sound.creak();
    setView(spot);
  }

  function takeCrank() {
    give("crank");
    run.step("crank");
    sound.pickup();
    setView(null);
    say("You pried the crank from the skeleton's grip. It didn't let go easily.");
  }

  function windBucket() {
    setBucketUp(true);
    give("scroll");
    run.step("bucket");
    sound.creak();
    setView("scroll");
    say("The bucket rises, dripping. A scroll is stuck to the bottom.");
  }

  function pour(i: number) {
    sound.bubble();
    const next = [...poured, i];
    if (room.order[next.length - 1] !== i) {
      setPoured([]);
      sound.wrong();
      say("The mixture fizzles and turns grey. Start again.");
      return;
    }
    setPoured(next);
    if (next.length === room.order.length) {
      setShelfOpen(true);
      give("chart");
      run.step("potions", next);
      sound.open();
      setView("chart");
      say("The cauldron glows green and a stone slides open behind the shelf.");
    }
  }

  function hint() {
    if (!has("crank")) run.hint("The coffin is not as empty as it looks.");
    else if (!has("scroll")) run.hint("Fit the crank to the well and wind the bucket up.");
    else if (!shelfOpen) run.hint(`Pour the potions in the scroll's order: ${room.order.map((i) => POTIONS[i].name).join(", ")}.`);
    else run.hint("Pull down the lever above each barrel marked with an X, leave the rest up, then turn the wheel.");
  }

  function turnWheel() {
    if (levers.every((v, i) => v === room.code[i])) {
      setView(null);
      sound.open();
      run.win(levers);
    } else {
      setShake((n) => n + 1);
      sound.rattle();
      say("The gate groans, then holds. Something below laughs.");
    }
  }

  function flip(i: number) {
    sound.clank();
    setLevers((l) => l.map((v, j) => (j === i ? 1 - v : v)));
  }

  let sheet: React.ReactNode = null;
  if (view === "coffin") {
    sheet = (
      <>
        <h3 className="sheet-title">A coffin</h3>
        {!coffinOpen ? (
          <>
            <p>Scratches run down the inside of the lid. From the inside.</p>
            <button className="btn btn-orange" onClick={() => { setCoffinOpen(true); sound.open(); }}>Open the lid</button>
          </>
        ) : has("crank") ? (
          <p>The skeleton grins at you. It has nothing else to give.</p>
        ) : (
          <>
            <p>A skeleton clutches an iron crank to its chest.</p>
            <button className="btn btn-orange" onClick={takeCrank}>Take the crank</button>
          </>
        )}
      </>
    );
  } else if (view === "well") {
    sheet = (
      <>
        <h3 className="sheet-title">The well</h3>
        {bucketUp ? (
          <p>The bucket hangs empty now. Something below is still breathing.</p>
        ) : (
          <>
            <p>A rope vanishes into the dark. The winch is missing its handle.</p>
            {has("crank") && <button className="btn btn-orange" onClick={windBucket}>Fit the crank and wind</button>}
          </>
        )}
      </>
    );
  } else if (view === "scroll") {
    sheet = (
      <>
        <h3 className="sheet-title">A wet scroll</h3>
        <div className="paper">
          <p>Pour, in this order, or regret it:</p>
          <ol className="potion-order">
            {room.order.map((i) => (
              <li key={i}><span className="swatch" style={{ background: POTIONS[i].fill }} />{POTIONS[i].name}</li>
            ))}
          </ol>
        </div>
      </>
    );
  } else if (view === "shelf") {
    sheet = (
      <>
        <h3 className="sheet-title">The potion shelf</h3>
        {shelfOpen ? (
          <p>The stone behind the shelf stands open.</p>
        ) : has("scroll") ? (
          <>
            <p>Pour them into the cauldron one by one. {poured.length > 0 && `${poured.length} of 4 poured.`}</p>
            <div className="potions">
              {POTIONS.map((p, i) => (
                <button key={p.name} className="potion" onClick={() => pour(i)} aria-label={`Pour ${p.name}`} disabled={poured.includes(i)}>
                  <span className="swatch swatch-big" style={{ background: p.fill }} />
                  <span>{p.name}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <p>Four potions bubble on the shelf. Mixing them without knowing the order seems like a terrible idea.</p>
        )}
      </>
    );
  } else if (view === "chart") {
    sheet = (
      <>
        <h3 className="sheet-title">A lever chart</h3>
        <div className="paper">
          <p>The barrels remember.</p>
          <p>Where chalk marks an <b>X</b>, pull the lever above it <b>down</b>.</p>
          <p>Leave the others up. Then turn the wheel.</p>
        </div>
      </>
    );
  } else if (view === "levers") {
    sheet = (
      <>
        <h3 className="sheet-title">The lever panel</h3>
        <p>Four levers, one above each barrel, and a rusty wheel.</p>
        <div className="lock" key={shake} data-shake={shake > 0 || undefined}>
          {levers.map((v, i) => (
            <button key={i} className="lever-btn" onClick={() => flip(i)} aria-label={`Lever ${i + 1}: ${v ? "down" : "up"}`} aria-pressed={v === 1}>
              <span className="lever-knob" data-down={v === 1 || undefined} />
              <span className="lever-label">{v ? "down" : "up"}</span>
            </button>
          ))}
        </div>
        <button className="btn btn-orange" onClick={turnWheel}>Turn the wheel</button>
      </>
    );
  } else if (view === "gate") {
    sheet = (
      <>
        <h3 className="sheet-title">The iron gate</h3>
        <p>Beyond the bars: green light and fresh air. The levers on the wall must open it.</p>
      </>
    );
  } else if (view === "barrels") {
    sheet = (
      <>
        <h3 className="sheet-title">Old barrels</h3>
        <p>They smell of something that used to be wine. Someone has scrawled chalk marks on a few.</p>
      </>
    );
  } else if (view === "torch") {
    sheet = (
      <>
        <h3 className="sheet-title">A torch</h3>
        <p className="scrawl">&ldquo;What the water hides, the potions reveal.&rdquo;</p>
      </>
    );
  }

  return (
    <GameShell
      run={run}
      intro={<p>The floor gave way under you. You have <b>5 minutes</b> to find a way out of the cellar before the torches die.</p>}
      scene={<Cellar room={room} coffinOpen={coffinOpen} bucketUp={bucketUp} shelfOpen={shelfOpen} levers={levers} gateOpen={phase === "won"} onPick={pick} />}
      pockets={(["crank", "scroll", "chart"] as Item[]).map((item) => ({
        id: item,
        name: ITEM_NAMES[item],
        icon: <ItemIcon item={item} />,
        have: has(item),
        onUse: () => (item === "crank" ? say("An iron crank. It would fit a winch.") : setView(item)),
      }))}
      onHint={hint}
      sheet={sheet}
      onCloseSheet={() => setView(null)}
    />
  );
}
