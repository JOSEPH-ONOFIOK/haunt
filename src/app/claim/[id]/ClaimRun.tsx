"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import PostScore, { ticketKey } from "../../_components/PostScore";
import { formatScore } from "@/lib/room";
import { ROOMS, type RoomId } from "@/lib/rooms";

type TicketView = { room: RoomId; ms?: number };

const noop = () => () => {};
const readTicket = (id: string) => {
  try {
    return sessionStorage.getItem(ticketKey(id));
  } catch {
    return null;
  }
};
// The ticket is signed, not secret: its readable half says which room and what time.
function peek(ticket: string): TicketView | null {
  try {
    return JSON.parse(atob(ticket.split(".")[0].replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}

/** Where a player lands after signing in with X from the escape screen: their run's ticket waited in this tab. */
export default function ClaimRun({ id }: { id: string }) {
  const ticket = useSyncExternalStore(noop, () => readTicket(id), () => undefined);
  if (ticket === undefined) return <p className="muted">Finding your run...</p>;
  const run = ticket ? peek(ticket) : null;
  if (!ticket || !run || run.ms === undefined) {
    return (
      <div className="panel">
        <h1 className="spooky panel-title">This run has faded</h1>
        <p>Runs can be posted for an hour after they start, from the same browser tab.</p>
        <Link href="/play" className="btn btn-green btn-big">Play again</Link>
      </div>
    );
  }
  return (
    <div className="panel panel-wide">
      <h1 className="spooky panel-title">{ROOMS[run.room].name}</h1>
      <div className="big-time spooky">{formatScore(run.ms)}</div>
      <PostScore runId={id} ticket={ticket} />
      <div className="panel-actions">
        <Link href={ROOMS[run.room].path} className="btn btn-ghost">Play again</Link>
      </div>
    </div>
  );
}
