import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { useBoard } from "../state/board-store";
import { CardDialog } from "./CardDialog";
import { CardFace } from "./Card";
import { Column } from "./Column";

export function Board({ boardId }: { boardId: string }) {
  const { columns, replica, open } = useBoard();
  const [dragging, setDragging] = useState<string | null>(null);
  const [openCard, setOpenCard] = useState<string | null>(null);
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
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
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
          />
        ))}
        <button
          onClick={() => replica.addColumn("New column")}
          className="flex w-72 shrink-0 items-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 px-3 py-2.5 text-sm text-zinc-500 hover:border-accent hover:text-accent dark:border-zinc-800"
        >
          <Plus className="size-4" /> Add column
        </button>
      </div>

      <DragOverlay>{dragging && findCard(dragging) ? <CardFace card={findCard(dragging)!} dragging /> : null}</DragOverlay>

      {openCard && <CardDialog card={findCard(openCard)} replica={replica} onClose={closeCard} />}
    </DndContext>
  );
}
