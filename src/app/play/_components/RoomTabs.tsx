"use client";

import Link from "next/link";
import { useClock } from "../../_components/useClock";
import { ROOMS, ROOM_IDS, type RoomId } from "@/lib/rooms";

export default function RoomTabs({ current }: { current: RoomId }) {
  const now = useClock();
  return (
    <nav className="room-tabs" aria-label="Rooms">
      {ROOM_IDS.map((id) => {
        const at = ROOMS[id].unlockAt;
        const locked = at !== null && (now === null || now < new Date(at).getTime());
        return (
          <Link key={id} href={ROOMS[id].path} className={`room-tab${id === current ? " room-tab-on" : ""}`} aria-current={id === current ? "page" : undefined}>
            {ROOMS[id].name}
            {locked && <span className="room-lock"> 🔒</span>}
          </Link>
        );
      })}
    </nav>
  );
}
