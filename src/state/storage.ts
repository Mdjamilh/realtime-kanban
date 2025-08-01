import { createStore, get, set } from "idb-keyval";

import { isOp, type Op } from "../sync/ops";

const db = createStore("realtime-kanban", "boards");

export type BoardMeta = { id: string; name: string; lastOpened: number };

/** The op log for a board, as saved in this browser. */
export async function loadOps(board: string): Promise<Op[]> {
  try {
    const ops = await get<unknown[]>(`ops:${board}`, db);
    return Array.isArray(ops) ? ops.filter(isOp) : [];
  } catch {
    // Private mode or blocked storage: start empty rather than failing.
    return [];
  }
}

export async function saveOps(board: string, ops: Op[]): Promise<void> {
  try {
    await set(`ops:${board}`, ops, db);
  } catch {
    // Non-fatal: the board still works in memory and through other tabs.
  }
}

export async function recentBoards(): Promise<BoardMeta[]> {
  try {
    return ((await get<BoardMeta[]>("recent", db)) ?? []).sort((a, b) => b.lastOpened - a.lastOpened);
  } catch {
    return [];
  }
}

export async function rememberBoard(meta: BoardMeta): Promise<void> {
  const others = (await recentBoards()).filter((b) => b.id !== meta.id);
  try {
    await set("recent", [meta, ...others].slice(0, 12), db);
  } catch {
    // Ignore storage failures.
  }
}

/**
 * An id per tab (kept across reloads of that tab). Every replica needs its
 * own id for Lamport tie-breaks, and it lets two tabs show up as two people.
 */
export function clientId(): string {
  const key = "realtime-kanban:client";
  try {
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const id = crypto.randomUUID();
    sessionStorage.setItem(key, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}
