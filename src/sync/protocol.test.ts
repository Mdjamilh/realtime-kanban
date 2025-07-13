import { describe, expect, it } from "vitest";

import { identityFor, PresenceTracker, PRESENCE_TTL_MS } from "./presence";
import { parseMessage } from "./protocol";

const op = { kind: "card.delete", cardId: "c", id: "o1", stamp: { lamport: 1, client: "a" } };

describe("parseMessage", () => {
  it("accepts valid messages from objects or JSON", () => {
    expect(parseMessage({ type: "ops", board: "b", ops: [op] })).toEqual({ type: "ops", board: "b", ops: [op] });
    expect(parseMessage(JSON.stringify({ type: "hello", board: "b", ops: [] }))?.type).toBe("hello");
  });

  it("drops invalid ops and rejects malformed messages", () => {
    expect(parseMessage({ type: "ops", board: "b", ops: [op, { id: 1 }, null] })).toEqual({
      type: "ops",
      board: "b",
      ops: [op],
    });
    for (const bad of ["{oops", 42, null, { type: "ops", ops: [] }, { type: "nope", board: "b" }, { type: "presence", board: "b" }]) {
      expect(parseMessage(bad)).toBeNull();
    }
  });
});

describe("PresenceTracker", () => {
  it("lists live peers except yourself and expires stale ones", () => {
    const t = new PresenceTracker();
    expect(t.update({ client: "a", name: "Zed", color: "#000", at: 0 })).toBe(true);
    expect(t.update({ client: "a", name: "Zed", color: "#000", at: 1000 })).toBe(false);
    t.update({ client: "b", name: "Amy", color: "#111", at: 1000 });
    t.update({ client: "me", name: "Me", color: "#222", at: 1000 });

    expect(t.list(2000, "me").map((p) => p.name)).toEqual(["Amy", "Zed"]);
    expect(t.list(1000 + PRESENCE_TTL_MS + 1, "me")).toEqual([]);
  });
});

describe("identityFor", () => {
  it("is stable for a client id", () => {
    expect(identityFor("client-1")).toEqual(identityFor("client-1"));
    expect(identityFor("client-1").name).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
  });
});
