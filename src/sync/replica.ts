import { generateKeyBetween } from "fractional-indexing";
import { nanoid } from "nanoid";

import { applyOp, emptyBoard, materialize, type BoardState, type ColumnView } from "./board";
import type { CardColor, Op, OpPayload } from "./ops";

/**
 * One copy of a board. Local actions become ops stamped with this replica's
 * Lamport clock; remote ops advance the clock so later local ops sort after
 * everything already seen.
 */
export class Replica {
  private state: BoardState = emptyBoard();
  private lamport = 0;
  private cached: ColumnView[] | null = null;
  /** Every op applied, in arrival order: persisted locally and replayed to servers. */
  readonly log: Op[] = [];

  readonly clientId: string;
  private readonly onLocalOp: (op: Op) => void;

  constructor(clientId: string, onLocalOp: (op: Op) => void = () => {}) {
    this.clientId = clientId;
    this.onLocalOp = onLocalOp;
  }

  /** Applies ops from storage or the network. Returns how many were new. */
  receive(ops: Op[]): number {
    let applied = 0;
    for (const op of ops) {
      if (!applyOp(this.state, op)) continue;
      this.lamport = Math.max(this.lamport, op.stamp.lamport);
      this.log.push(op);
      applied++;
    }
    if (applied > 0) this.cached = null;
    return applied;
  }

  private emit(payload: OpPayload): Op {
    const op = { ...payload, id: nanoid(), stamp: { lamport: ++this.lamport, client: this.clientId } } as Op;
    this.receive([op]);
    this.onLocalOp(op);
    return op;
  }

  view(): ColumnView[] {
    return (this.cached ??= materialize(this.state));
  }

  /** A key between the neighbours at `index` once `movingId` is taken out of the list. */
  private static positionAt(items: { id: string; position: string }[], index: number, movingId?: string): string {
    const others = items.filter((item) => item.id !== movingId);
    const clamped = Math.max(0, Math.min(index, others.length));
    return generateKeyBetween(others[clamped - 1]?.position ?? null, others[clamped]?.position ?? null);
  }

  addColumn(title: string): string {
    const columnId = nanoid(10);
    const columns = this.view();
    this.emit({ kind: "column.create", columnId, title, position: Replica.positionAt(columns, columns.length) });
    return columnId;
  }

  renameColumn(columnId: string, title: string) {
    this.emit({ kind: "column.rename", columnId, title });
  }

  moveColumn(columnId: string, toIndex: number) {
    this.emit({ kind: "column.move", columnId, position: Replica.positionAt(this.view(), toIndex, columnId) });
  }

  deleteColumn(columnId: string) {
    this.emit({ kind: "column.delete", columnId });
  }

  addCard(columnId: string, title: string): string {
    const cardId = nanoid(10);
    const cards = this.view().find((c) => c.id === columnId)?.cards ?? [];
    this.emit({ kind: "card.create", cardId, columnId, title, position: Replica.positionAt(cards, cards.length) });
    return cardId;
  }

  editCard(cardId: string, field: "title" | "description", value: string) {
    this.emit({ kind: "card.edit", cardId, field, value });
  }

  colorCard(cardId: string, color: CardColor) {
    this.emit({ kind: "card.color", cardId, color });
  }

  /** Moves a card to `toIndex` within `toColumnId` (which may be its current column). */
  moveCard(cardId: string, toColumnId: string, toIndex: number) {
    const cards = this.view().find((c) => c.id === toColumnId)?.cards ?? [];
    this.emit({ kind: "card.move", cardId, columnId: toColumnId, position: Replica.positionAt(cards, toIndex, cardId) });
  }

  deleteCard(cardId: string) {
    this.emit({ kind: "card.delete", cardId });
  }

  /** Seeds an empty board so first-time visitors see something useful. */
  seedIfEmpty() {
    if (this.log.length > 0) return;
    const todo = this.addColumn("To do");
    const doing = this.addColumn("In progress");
    const done = this.addColumn("Done");
    this.addCard(todo, "Open this board in a second tab");
    this.addCard(todo, "Drag a card between columns");
    this.addCard(doing, "Edit a card and watch the other tab update");
    this.addCard(done, "Create a board");
  }
}
