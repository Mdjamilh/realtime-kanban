import type { AddressInfo } from "node:net";

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";

import type { Op } from "../src/sync/ops.ts";
import type { Message } from "../src/sync/protocol.ts";
import { createSyncServer } from "./server.ts";
import { OpStore } from "./store.ts";

let server: ReturnType<typeof createSyncServer>;
let url: string;
let store: OpStore;

beforeEach(async () => {
  store = new OpStore();
  server = createSyncServer({ store });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  url = `ws://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(async () => {
  await new Promise((resolve) => server.close(resolve));
  store.close();
});

const op = (id: string, lamport = 1): Op => ({ kind: "card.delete", cardId: "c", id, stamp: { lamport, client: "t" } });

/** A test client that records every message it receives. */
async function client() {
  const socket = new WebSocket(url);
  const inbox: Message[] = [];
  socket.on("message", (data) => inbox.push(JSON.parse(data.toString())));
  await new Promise((resolve) => socket.once("open", resolve));
  const next = async (count = inbox.length + 1) => {
    for (let i = 0; i < 100 && inbox.length < count; i++) await new Promise((r) => setTimeout(r, 10));
    return inbox[count - 1];
  };
  return { socket, inbox, next, send: (m: Message) => socket.send(JSON.stringify(m)) };
}

describe("sync server", () => {
  it("replies to hello with the board's full log", async () => {
    store.append("board-1", [op("a"), op("b")]);
    const c = await client();
    c.send({ type: "hello", board: "board-1", ops: [op("c")] });
    const reply = await c.next();
    expect(reply).toMatchObject({ type: "ops", board: "board-1" });
    expect(reply?.type !== "presence" && reply?.ops.map((o) => o.id)).toEqual(["a", "b", "c"]);
    c.socket.close();
  });

  it("relays new ops and presence to other clients on the same board only", async () => {
    const alice = await client();
    const bob = await client();
    const other = await client();
    alice.send({ type: "hello", board: "b", ops: [] });
    bob.send({ type: "hello", board: "b", ops: [] });
    other.send({ type: "hello", board: "elsewhere", ops: [] });
    await Promise.all([alice.next(1), bob.next(1), other.next(1)]);

    alice.send({ type: "ops", board: "b", ops: [op("x")] });
    expect(await bob.next(2)).toEqual({ type: "ops", board: "b", ops: [op("x")] });

    alice.send({ type: "presence", board: "b", presence: { client: "alice", name: "Alice", color: "#f00", at: 1 } });
    expect((await bob.next(3))?.type).toBe("presence");

    await new Promise((r) => setTimeout(r, 50));
    expect(alice.inbox).toHaveLength(1); // never echoed back
    expect(other.inbox).toHaveLength(1); // other boards are isolated
    for (const c of [alice, bob, other]) c.socket.close();
  });

  it("does not re-broadcast ops it already has", async () => {
    const alice = await client();
    const bob = await client();
    alice.send({ type: "hello", board: "b", ops: [op("x")] });
    bob.send({ type: "hello", board: "b", ops: [] });
    await Promise.all([alice.next(1), bob.next(1)]);

    alice.send({ type: "ops", board: "b", ops: [op("x")] }); // duplicate
    await new Promise((r) => setTimeout(r, 100));
    expect(bob.inbox).toHaveLength(1);
    alice.socket.close();
    bob.socket.close();
  });

  it("ignores invalid board ids and malformed messages", async () => {
    const c = await client();
    c.socket.send("not json");
    c.send({ type: "hello", board: "../etc", ops: [] });
    await new Promise((r) => setTimeout(r, 100));
    expect(c.inbox).toEqual([]);
    c.socket.close();
  });
});

describe("OpStore", () => {
  it("persists ops per board and reports only new ones", () => {
    const s = new OpStore();
    expect(s.append("b", [op("1"), op("2")]).map((o) => o.id)).toEqual(["1", "2"]);
    expect(s.append("b", [op("2"), op("3")]).map((o) => o.id)).toEqual(["3"]);
    expect(s.all("b").map((o) => o.id)).toEqual(["1", "2", "3"]);
    expect(s.all("other")).toEqual([]);
    s.close();
  });
});
