import { isOp, type Op } from "./ops";

/** Who is looking at a board right now. */
export type Presence = { client: string; name: string; color: string; at: number };

/**
 * Messages exchanged between tabs (BroadcastChannel) and with the server
 * (WebSocket). `hello` carries the sender's whole log so the other side can
 * fill gaps; `ops` carries new operations.
 */
export type Message =
  | { type: "hello"; board: string; ops: Op[] }
  | { type: "ops"; board: string; ops: Op[] }
  | { type: "presence"; board: string; presence: Presence };

const isPresence = (p: unknown): p is Presence =>
  typeof p === "object" &&
  p !== null &&
  typeof (p as Presence).client === "string" &&
  typeof (p as Presence).name === "string" &&
  typeof (p as Presence).color === "string" &&
  typeof (p as Presence).at === "number";

/** Validates untrusted input; invalid ops inside a valid message are dropped. */
export function parseMessage(data: unknown): Message | null {
  let value = data;
  if (typeof data === "string") {
    try {
      value = JSON.parse(data);
    } catch {
      return null;
    }
  }
  if (typeof value !== "object" || value === null) return null;
  const m = value as Record<string, unknown>;
  if (typeof m.board !== "string") return null;
  if ((m.type === "hello" || m.type === "ops") && Array.isArray(m.ops)) {
    return { type: m.type, board: m.board, ops: m.ops.filter(isOp) };
  }
  if (m.type === "presence" && isPresence(m.presence)) {
    return { type: "presence", board: m.board, presence: m.presence };
  }
  return null;
}
