import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { applyOp, emptyBoard, materialize } from "./board";
import type { Op, OpPayload } from "./ops";

let n = 0;
const op = (payload: OpPayload, lamport: number, client = "a"): Op => ({ ...payload, id: `op${++n}`, stamp: { lamport, client } });

const build = (ops: Op[]) => {
  const state = emptyBoard();
  for (const o of ops) applyOp(state, o);
  return materialize(state);
};

/** Everything a viewer can see: the columns plus the board's name. */
const visible = (ops: Op[]) => {
  const state = emptyBoard();
  for (const o of ops) applyOp(state, o);
  return { title: state.title?.value, columns: materialize(state) };
};

describe("board ops", () => {
  it("creates columns and cards in position order", () => {
    const view = build([
      op({ kind: "column.create", columnId: "done", title: "Done", position: "a2" }, 1),
      op({ kind: "column.create", columnId: "todo", title: "To do", position: "a0" }, 2),
      op({ kind: "card.create", cardId: "c2", columnId: "todo", title: "Second", position: "a1" }, 3),
      op({ kind: "card.create", cardId: "c1", columnId: "todo", title: "First", position: "a0" }, 4),
    ]);
    expect(view.map((c) => c.title)).toEqual(["To do", "Done"]);
    expect(view[0]?.cards.map((c) => c.title)).toEqual(["First", "Second"]);
  });

  it("resolves concurrent edits by Lamport time, then client id", () => {
    const create = op({ kind: "card.create", cardId: "c", columnId: "col", title: "Old", position: "a0" }, 1);
    const col = op({ kind: "column.create", columnId: "col", title: "Col", position: "a0" }, 1);
    const fromA = op({ kind: "card.edit", cardId: "c", field: "title", value: "From A" }, 5, "a");
    const fromB = op({ kind: "card.edit", cardId: "c", field: "title", value: "From B" }, 5, "b");
    expect(build([col, create, fromA, fromB])[0]?.cards[0]?.title).toBe("From B");
    expect(build([col, create, fromB, fromA])[0]?.cards[0]?.title).toBe("From B");
  });

  it("moves cards between columns atomically and keeps deletes permanent", () => {
    const view = build([
      op({ kind: "column.create", columnId: "x", title: "X", position: "a0" }, 1),
      op({ kind: "column.create", columnId: "y", title: "Y", position: "a1" }, 1),
      op({ kind: "card.create", cardId: "c", columnId: "x", title: "Card", position: "a0" }, 2),
      op({ kind: "card.move", cardId: "c", columnId: "y", position: "a5" }, 3),
      op({ kind: "card.create", cardId: "gone", columnId: "x", title: "Gone", position: "a1" }, 2),
      op({ kind: "card.delete", cardId: "gone" }, 3),
      // An edit stamped after the delete must not bring the card back.
      op({ kind: "card.edit", cardId: "gone", field: "title", value: "Zombie" }, 9),
    ]);
    expect(view.map((c) => [c.title, c.cards.map((k) => k.title)])).toEqual([
      ["X", []],
      ["Y", ["Card"]],
    ]);
  });

  it("hides cards whose column was deleted and edits that arrive before their create", () => {
    const edit = op({ kind: "card.edit", cardId: "c", field: "title", value: "Early" }, 1);
    expect(build([edit])).toEqual([]);
    const view = build([
      op({ kind: "column.create", columnId: "x", title: "X", position: "a0" }, 1),
      op({ kind: "card.create", cardId: "c", columnId: "x", title: "Card", position: "a0" }, 2),
      op({ kind: "column.delete", columnId: "x" }, 3),
    ]);
    expect(view).toEqual([]);
  });

  it("ignores duplicate deliveries", () => {
    const state = emptyBoard();
    const create = op({ kind: "column.create", columnId: "x", title: "X", position: "a0" }, 1);
    expect(applyOp(state, create)).toBe(true);
    expect(applyOp(state, create)).toBe(false);
  });
});

describe("convergence (property-based)", () => {
  const COLUMNS = ["c1", "c2"];
  const CARDS = ["k1", "k2", "k3"];
  const POSITIONS = ["a0", "a1", "a2", "a3"];
  const payload = fc.oneof(
    fc.record({ kind: fc.constant("column.create" as const), columnId: fc.constantFrom(...COLUMNS), title: fc.string(), position: fc.constantFrom(...POSITIONS) }),
    fc.record({ kind: fc.constant("column.rename" as const), columnId: fc.constantFrom(...COLUMNS), title: fc.string() }),
    fc.record({ kind: fc.constant("column.delete" as const), columnId: fc.constantFrom(...COLUMNS) }),
    fc.record({ kind: fc.constant("card.create" as const), cardId: fc.constantFrom(...CARDS), columnId: fc.constantFrom(...COLUMNS), title: fc.string(), position: fc.constantFrom(...POSITIONS) }),
    fc.record({ kind: fc.constant("card.edit" as const), cardId: fc.constantFrom(...CARDS), field: fc.constantFrom("title" as const, "description" as const), value: fc.string() }),
    fc.record({ kind: fc.constant("card.move" as const), cardId: fc.constantFrom(...CARDS), columnId: fc.constantFrom(...COLUMNS), position: fc.constantFrom(...POSITIONS) }),
    fc.record({ kind: fc.constant("card.delete" as const), cardId: fc.constantFrom(...CARDS) }),
    fc.record({ kind: fc.constant("board.rename" as const), title: fc.string() }),
  );
  const ops = fc
    .array(fc.tuple(payload, fc.integer({ min: 1, max: 6 }), fc.constantFrom("a", "b", "c")), { maxLength: 40 })
    .map((items) => items.map(([p, lamport, client], i) => ({ ...p, id: `p${i}`, stamp: { lamport, client } }) as Op));

  it("every delivery order produces the same board", () => {
    fc.assert(
      fc.property(ops, fc.func(fc.integer()), (list, rank) => {
        const shuffled = [...list].sort((x, y) => rank(x.id) - rank(y.id));
        expect(visible(shuffled)).toEqual(visible(list));
      }),
      { numRuns: 300 },
    );
  });

  it("re-delivering ops changes nothing", () => {
    fc.assert(
      fc.property(ops, (list) => {
        expect(visible([...list, ...list.slice().reverse()])).toEqual(visible(list));
      }),
    );
  });
});
