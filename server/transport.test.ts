import type { AddressInfo } from "node:net";

import { afterEach, describe, expect, it } from "vitest";

import { Replica } from "../src/sync/replica.ts";
import { WebSocketTransport, type TransportStatus } from "../src/sync/transport.ts";
import { createSyncServer } from "./server.ts";
import { OpStore } from "./store.ts";

const cleanups: (() => void)[] = [];
afterEach(() => {
  while (cleanups.length) cleanups.pop()!();
});

async function startServer(store: OpStore, port = 0) {
  const server = createSyncServer({ store });
  await new Promise<void>((resolve) => server.listen(port, resolve));
  const close = () => new Promise<void>((resolve) => server.close(() => resolve()));
  return { port: (server.address() as AddressInfo).port, close, server };
}

/** A replica connected through the real client transport, as the browser uses it. */
function connect(url: string, client: string) {
  const statuses: TransportStatus[] = [];
  const transport = new WebSocketTransport(url, "board");
  const replica = new Replica(client, (op) => transport.send([op]));
  transport.start(
    { onOps: (ops) => replica.receive(ops), onPresence: () => {}, onStatus: (s) => statuses.push(s) },
    () => replica.log,
  );
  cleanups.push(() => transport.stop());
  return { replica, statuses };
}

const until = async (check: () => boolean, ms = 3000) => {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw new Error("timed out");
    await new Promise((r) => setTimeout(r, 20));
  }
};

const titles = (r: Replica) => r.view().map((c) => [c.title, c.cards.map((k) => k.title)]);

describe("WebSocketTransport with the sync server", () => {
  it("keeps two replicas in sync", async () => {
    const store = new OpStore();
    const { port, close } = await startServer(store);
    cleanups.push(() => void close());

    const alice = connect(`ws://127.0.0.1:${port}`, "alice");
    const bob = connect(`ws://127.0.0.1:${port}`, "bob");
    await until(() => alice.statuses.includes("online") && bob.statuses.includes("online"));

    const col = alice.replica.addColumn("Backlog");
    await until(() => bob.replica.view().length === 1);
    bob.replica.addCard(col, "From Bob");
    alice.replica.addCard(col, "From Alice");

    await until(() => alice.replica.view()[0]?.cards.length === 2 && bob.replica.view()[0]?.cards.length === 2);
    expect(titles(alice.replica)).toEqual(titles(bob.replica));
  });

  it("delivers edits made while the server was down once it comes back", async () => {
    const store = new OpStore();
    const first = await startServer(store);
    const url = `ws://127.0.0.1:${first.port}`;

    const alice = connect(url, "alice");
    await until(() => alice.statuses.includes("online"));
    const col = alice.replica.addColumn("Backlog");
    await until(() => store.all("board").length === 1);

    await first.close();
    await until(() => alice.statuses.at(-1) !== "online");
    alice.replica.addCard(col, "Written offline");

    const second = await startServer(store, first.port);
    cleanups.push(() => void second.close());
    await until(() => store.all("board").length === 2, 5000);

    // A late joiner gets everything, including the offline edit.
    const bob = connect(url, "bob");
    await until(() => bob.replica.view()[0]?.cards.length === 1);
    expect(titles(bob.replica)).toEqual([["Backlog", ["Written offline"]]]);
  });
});
