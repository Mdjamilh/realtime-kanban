import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { useBoard } from "../state/board-store";
import { CardDialog } from "./CardDialog";
import { CardFace, type MoveDirection } from "./Card";
import { Column } from "./Column";

export function Board({ boardId }: { boardId: string }) {
  const { columns, replica, open } = useBoard();
  const [dragging, setDragging] = useState<string | null>(null);
  const [openCard, setOpenCard] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [refocus, setRefocus] = useState<string | null>(null);
  const closeCard = useCallback(() => setOpenCard(null), []);

  useEffect(() => {
    let cleanup = () => {};
    let cancelled = false;
    void open(boardId).then((fn) => (cancelled ? fn() : (cleanup = fn)));
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [boardId, open]);

  const sensors = useSensors(
    // A small distance lets a click open the card instead of starting a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const allCards = columns.flatMap((c) => c.cards);
  const findCard = (id: string | null) => allCards.find((c) => c.id === id);

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDragging(null);
    if (!over || !replica) return;
    const overType = over.data.current?.type;
    const toColumnId = overType === "column" ? String(over.id) : (over.data.current?.columnId as string | undefined);
    const target = columns.find((c) => c.id === toColumnId);
    if (!target) return;

    if (active.id === over.id) return;
    // Dropping on a card takes its slot; dropping on the column appends. The
    // index works in every direction because moveCard positions the card
    // among the others with the dragged card removed.
    const index = overType === "card" ? target.cards.findIndex((c) => c.id === over.id) : target.cards.length;
    replica.moveCard(String(active.id), target.id, index);
  };

  /** Keyboard moves: Alt+↑/↓ within a column, Alt+←/→ to the neighbouring column. */
  const moveByKey = (cardId: string, direction: MoveDirection) => {
    if (!replica) return;
    const col = columns.findIndex((c) => c.cards.some((k) => k.id === cardId));
    const column = columns[col];
    if (!column) return;
    const index = column.cards.findIndex((k) => k.id === cardId);
    const title = column.cards[index]?.title ?? "Card";

    if (direction === "up" || direction === "down") {
      const to = direction === "up" ? index - 1 : index + 1;
      if (to < 0 || to >= column.cards.length) return;
      replica.moveCard(cardId, column.id, to);
      setAnnouncement(`${title} moved to position ${to + 1} of ${column.cards.length} in ${column.title}`);
    } else {
      const target = columns[direction === "left" ? col - 1 : col + 1];
      if (!target) return;
      replica.moveCard(cardId, target.id, Math.min(index, target.cards.length));
      setAnnouncement(`${title} moved to ${target.title}`);
    }
    setRefocus(cardId);
  };

  // Keep focus on a card after a keyboard move re-renders it.
  useEffect(() => {
    if (!refocus) return;
    document.querySelector<HTMLElement>(`[data-card-id="${refocus}"]`)?.focus();
    setRefocus(null);
  }, [columns, refocus]);

  if (!replica) return null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={({ active }: DragStartEvent) => setDragging(String(active.id))}
      onDragCancel={() => setDragging(null)}
      onDragEnd={onDragEnd}
    >
      <div className="flex h-[calc(100dvh-3.5rem)] items-start gap-3 overflow-x-auto p-4">
        {columns.map((column, index) => (
          <Column
            key={column.id}
            column={column}
            index={index}
            total={columns.length}
            replica={replica}
            onOpenCard={setOpenCard}
            onMoveCard={moveByKey}
          />
        ))}
        <button
          onClick={() => replica.addColumn("New column")}
          className="flex w-72 shrink-0 items-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 px-3 py-2.5 text-sm text-zinc-500 hover:border-accent hover:text-accent dark:border-zinc-800"
        >
          <Plus className="size-4" /> Add column
        </button>
      </div>

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <DragOverlay>{dragging && findCard(dragging) ? <CardFace card={findCard(dragging)!} dragging /> : null}</DragOverlay>

      {openCard && <CardDialog card={findCard(openCard)} replica={replica} onClose={closeCard} />}
    </DndContext>
  );
}
