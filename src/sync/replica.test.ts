import { describe, expect, it } from "vitest";

import type { Op } from "./ops";
import { Replica } from "./replica";

const titles = (r: Replica) => r.view().map((c) => [c.title, c.cards.map((k) => k.title)]);

describe("Replica", () => {
  it("turns actions into ops with increasing stamps", () => {
    const sent: Op[] = [];
    const r = new Replica("alice", (op) => sent.push(op));
    const col = r.addColumn("To do");
    r.addCard(col, "One");
    r.addCard(col, "Two");
    expect(titles(r)).toEqual([["To do", ["One", "Two"]]]);
    expect(sent.map((op) => op.stamp.lamport)).toEqual([1, 2, 3]);
    expect(r.log).toHaveLength(3);
  });

  it("reorders within a column and moves across columns", () => {
    const r = new Replica("alice");
    const a = r.addColumn("A");
    const b = r.addColumn("B");
    const [one, two, three] = ["1", "2", "3"].map((t) => r.addCard(a, t));
    r.moveCard(three!, a, 0);
    expect(titles(r)).toEqual([
      ["A", ["3", "1", "2"]],
      ["B", []],
    ]);
    r.moveCard(one!, b, 0);
    r.moveCard(two!, b, 5); // past the end clamps to the end
    expect(titles(r)).toEqual([
      ["A", ["3"]],
      ["B", ["1", "2"]],
    ]);
  });

  it("reorders columns", () => {
    const r = new Replica("alice");
    const [x] = ["X", "Y", "Z"].map((t) => r.addColumn(t));
    r.moveColumn(x!, 2);
    expect(r.view().map((c) => c.title)).toEqual(["Y", "Z", "X"]);
  });

  it("converges with a peer and advances its clock past remote ops", () => {
    const toBob: Op[] = [];
    const toAlice: Op[] = [];
    const alice = new Replica("alice", (op) => toBob.push(op));
    const bob = new Replica("bob", (op) => toAlice.push(op));

    const col = alice.addColumn("Shared");
    const card = alice.addCard(col, "Draft");
    bob.receive(toBob.splice(0));

    // Concurrent edits to the same title, then exchange.
    alice.editCard(card, "title", "Alice's title");
    bob.editCard(card, "title", "Bob's title");
    bob.receive(toBob.splice(0));
    alice.receive(toAlice.splice(0));

    expect(alice.view()).toEqual(bob.view());
    expect(alice.view()[0]?.cards[0]?.title).toBe("Bob's title"); // same Lamport time, "bob" > "alice"

    // A later local edit wins because the clock moved past what it has seen.
    alice.editCard(card, "title", "Final");
    bob.receive(toBob.splice(0));
    expect(bob.view()[0]?.cards[0]?.title).toBe("Final");
  });

  it("names the board with a last-writer-wins title", () => {
    const alice = new Replica("alice");
    const bob = new Replica("bob");
    expect(alice.title()).toBe("");
    alice.renameBoard("Sprint 12");
    bob.renameBoard("Launch");
    alice.receive(bob.log);
    bob.receive(alice.log);
    expect(alice.title()).toBe("Launch"); // same Lamport time, "bob" wins the tie
    expect(bob.title()).toBe("Launch");
  });

  it("seeds a starter board only once", () => {
    const r = new Replica("alice");
    r.seedIfEmpty();
    r.seedIfEmpty();
    expect(r.view().map((c) => c.title)).toEqual(["To do", "In progress", "Done"]);
  });

  it("does not duplicate the starter board when two replicas seed at once", () => {
    const sent: Op[] = [];
    const alice = new Replica("alice", (op) => sent.push(op));
    const bob = new Replica("bob");
    alice.seedIfEmpty();
    bob.seedIfEmpty();
    expect(sent).toHaveLength(alice.log.length); // seed ops are shared with peers

    expect(bob.receive(alice.log)).toBe(0);
    expect(alice.receive(bob.log)).toBe(0);
    expect(bob.view()).toEqual(alice.view());
    expect(bob.view()).toHaveLength(3);

    // Seeded cards behave like any other card afterwards.
    const card = bob.view()[0]!.cards[0]!.id;
    bob.moveCard(card, bob.view()[2]!.id, 0);
    alice.receive(bob.log);
    expect(alice.view()[2]?.cards[0]?.id).toBe(card);
  });
});
