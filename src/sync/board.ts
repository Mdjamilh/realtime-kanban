import { compareStamps, type CardColor, type Op, type Stamp } from "./ops";

/**
 * A last-writer-wins register: the value written by the highest stamp wins.
 * The op id breaks exact stamp ties, so the order is total even if a faulty
 * client reuses a timestamp; otherwise delivery order would decide.
 */
type Register<T> = { value: T; stamp: Stamp; op: string };

function write<T>(current: Register<T> | undefined, value: T, stamp: Stamp, op: string): Register<T> {
  if (!current) return { value, stamp, op };
  const order = compareStamps(stamp, current.stamp) || (op > current.op ? 1 : op < current.op ? -1 : 0);
  return order > 0 ? { value, stamp, op } : current;
}

type ColumnState = {
  created: boolean;
  deleted: boolean;
  title?: Register<string>;
  position?: Register<string>;
};

type CardState = {
  created: boolean;
  deleted: boolean;
  title?: Register<string>;
  description?: Register<string>;
  color?: Register<CardColor>;
  /** Column and position move together, so they share one register. */
  place?: Register<{ columnId: string; position: string }>;
};

/**
 * Replica state. Applying the same set of ops in any order, any number of
 * times, yields the same state: every field is an LWW register, deletes are
 * permanent (remove-wins), and ops are de-duplicated by id.
 */
export type BoardState = {
  seen: Set<string>;
  columns: Map<string, ColumnState>;
  cards: Map<string, CardState>;
};

export const emptyBoard = (): BoardState => ({ seen: new Set(), columns: new Map(), cards: new Map() });

function column(state: BoardState, id: string): ColumnState {
  let c = state.columns.get(id);
  if (!c) state.columns.set(id, (c = { created: false, deleted: false }));
  return c;
}

function card(state: BoardState, id: string): CardState {
  let c = state.cards.get(id);
  if (!c) state.cards.set(id, (c = { created: false, deleted: false }));
  return c;
}

/** Applies one op in place. Returns false if it was already applied. */
export function applyOp(state: BoardState, op: Op): boolean {
  if (state.seen.has(op.id)) return false;
  state.seen.add(op.id);
  const s = op.stamp;

  switch (op.kind) {
    case "column.create": {
      const c = column(state, op.columnId);
      c.created = true;
      c.title = write(c.title, op.title, s, op.id);
      c.position = write(c.position, op.position, s, op.id);
      break;
    }
    case "column.rename": {
      const c = column(state, op.columnId);
      c.title = write(c.title, op.title, s, op.id);
      break;
    }
    case "column.move": {
      const c = column(state, op.columnId);
      c.position = write(c.position, op.position, s, op.id);
      break;
    }
    case "column.delete":
      column(state, op.columnId).deleted = true;
      break;
    case "card.create": {
      const c = card(state, op.cardId);
      c.created = true;
      c.title = write(c.title, op.title, s, op.id);
      c.place = write(c.place, { columnId: op.columnId, position: op.position }, s, op.id);
      break;
    }
    case "card.edit": {
      const c = card(state, op.cardId);
      c[op.field] = write(c[op.field], op.value, s, op.id);
      break;
    }
    case "card.color": {
      const c = card(state, op.cardId);
      c.color = write(c.color, op.color, s, op.id);
      break;
    }
    case "card.move": {
      const c = card(state, op.cardId);
      c.place = write(c.place, { columnId: op.columnId, position: op.position }, s, op.id);
      break;
    }
    case "card.delete":
      card(state, op.cardId).deleted = true;
      break;
  }
  return true;
}

export type CardView = { id: string; title: string; description: string; color: CardColor; position: string };
export type ColumnView = { id: string; title: string; position: string; cards: CardView[] };

/** Fractional keys can collide when two people insert at the same spot; the id breaks the tie. */
const byPosition = (a: { position: string; id: string }, b: { position: string; id: string }) =>
  a.position < b.position ? -1 : a.position > b.position ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

/**
 * The visible board: created, undeleted columns in order, each with its
 * created, undeleted cards in order. Cards in a deleted column are hidden.
 */
export function materialize(state: BoardState): ColumnView[] {
  const columns: ColumnView[] = [];
  for (const [id, c] of state.columns) {
    if (!c.created || c.deleted || !c.title || !c.position) continue;
    columns.push({ id, title: c.title.value, position: c.position.value, cards: [] });
  }
  const byId = new Map(columns.map((c) => [c.id, c]));
  for (const [id, c] of state.cards) {
    if (!c.created || c.deleted || !c.title || !c.place) continue;
    byId.get(c.place.value.columnId)?.cards.push({
      id,
      title: c.title.value,
      description: c.description?.value ?? "",
      color: c.color?.value ?? "none",
      position: c.place.value.position,
    });
  }
  columns.sort(byPosition);
  for (const c of columns) c.cards.sort(byPosition);
  return columns;
}
