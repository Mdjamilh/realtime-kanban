/**
 * Every change to a board is an immutable operation. Operations carry a
 * Lamport timestamp so all replicas order concurrent edits the same way.
 */
export type Stamp = { lamport: number; client: string };

/** Total order: Lamport time first, client id as a deterministic tie-break. */
export function compareStamps(a: Stamp, b: Stamp): number {
  return a.lamport - b.lamport || (a.client < b.client ? -1 : a.client > b.client ? 1 : 0);
}

export const CARD_COLORS = ["none", "red", "amber", "green", "sky", "violet"] as const;
export type CardColor = (typeof CARD_COLORS)[number];

export type OpPayload =
  | { kind: "column.create"; columnId: string; title: string; position: string }
  | { kind: "column.rename"; columnId: string; title: string }
  | { kind: "column.move"; columnId: string; position: string }
  | { kind: "column.delete"; columnId: string }
  | { kind: "card.create"; cardId: string; columnId: string; title: string; position: string }
  | { kind: "card.edit"; cardId: string; field: "title" | "description"; value: string }
  | { kind: "card.color"; cardId: string; color: CardColor }
  | { kind: "card.move"; cardId: string; columnId: string; position: string }
  | { kind: "card.delete"; cardId: string };

export type Op = OpPayload & { id: string; stamp: Stamp };

/** Runtime check for ops arriving from other tabs or the network. */
export function isOp(value: unknown): value is Op {
  if (typeof value !== "object" || value === null) return false;
  const op = value as Partial<Op>;
  return (
    typeof op.id === "string" &&
    typeof op.kind === "string" &&
    typeof op.stamp === "object" &&
    op.stamp !== null &&
    Number.isInteger(op.stamp.lamport) &&
    typeof op.stamp.client === "string"
  );
}
