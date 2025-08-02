import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import type { ColumnView } from "../sync/board";
import type { Replica } from "../sync/replica";
import { Card, type MoveDirection } from "./Card";

type Props = {
  column: ColumnView;
  index: number;
  total: number;
  replica: Replica;
  onOpenCard: (id: string) => void;
  onMoveCard: (id: string, direction: MoveDirection) => void;
};

export function Column({ column, index, total, replica, onOpenCard, onMoveCard }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id, data: { type: "column" } });
  const [title, setTitle] = useState<string | null>(null);
  const [draft, setDraft] = useState<string | null>(null);

  const commitTitle = () => {
    if (title !== null && title.trim() && title.trim() !== column.title) replica.renameColumn(column.id, title.trim());
    setTitle(null);
  };
  const addCard = () => {
    if (draft?.trim()) replica.addCard(column.id, draft.trim());
    setDraft("");
  };

  return (
    <section
      aria-label={column.title}
      className={`flex max-h-full w-72 shrink-0 flex-col rounded-xl bg-zinc-100 p-2 dark:bg-zinc-900/60 ${
        isOver ? "ring-2 ring-accent/50" : ""
      }`}
    >
      <header className="group mb-2 flex items-center gap-1 px-1">
        {title === null ? (
          <button onClick={() => setTitle(column.title)} className="min-w-0 flex-1 truncate text-left text-sm font-semibold">
            {column.title}
          </button>
        ) : (
          <input
            autoFocus
            value={title}
            aria-label="Column name"
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitTitle();
              if (e.key === "Escape") setTitle(null);
            }}
            className="min-w-0 flex-1 rounded border border-zinc-300 bg-white px-1.5 py-0.5 text-sm font-semibold dark:border-zinc-700 dark:bg-zinc-950"
          />
        )}
        <span className="rounded-full bg-zinc-200 px-2 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
          {column.cards.length}
        </span>
        <div className="flex opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <button
            disabled={index === 0}
            onClick={() => replica.moveColumn(column.id, index - 1)}
            aria-label="Move column left"
            className="rounded p-1 hover:bg-zinc-200 disabled:opacity-30 dark:hover:bg-zinc-800"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            disabled={index === total - 1}
            onClick={() => replica.moveColumn(column.id, index + 1)}
            aria-label="Move column right"
            className="rounded p-1 hover:bg-zinc-200 disabled:opacity-30 dark:hover:bg-zinc-800"
          >
            <ChevronRight className="size-4" />
          </button>
          <button
            onClick={() => {
              if (column.cards.length === 0 || confirm(`Delete "${column.title}" and its ${column.cards.length} cards?`)) {
                replica.deleteColumn(column.id);
              }
            }}
            aria-label="Delete column"
            className="rounded p-1 text-red-500 hover:bg-zinc-200 dark:hover:bg-zinc-800"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </header>

      <SortableContext items={column.cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <ul ref={setNodeRef} className="flex min-h-12 flex-1 flex-col gap-2 overflow-y-auto px-1 pb-1">
          {column.cards.map((card) => (
            <Card
              key={card.id}
              card={card}
              columnId={column.id}
              onOpen={() => onOpenCard(card.id)}
              onMove={(direction) => onMoveCard(card.id, direction)}
            />
          ))}
        </ul>
      </SortableContext>

      {draft === null ? (
        <button
          onClick={() => setDraft("")}
          className="mt-1 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        >
          <Plus className="size-4" /> Add a card
        </button>
      ) : (
        <div className="mt-1 px-1">
          <textarea
            autoFocus
            rows={2}
            value={draft}
            placeholder="What needs doing?"
            aria-label="New card title"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                addCard();
              }
              if (e.key === "Escape") setDraft(null);
            }}
            onBlur={() => !draft.trim() && setDraft(null)}
            className="w-full resize-none rounded-lg border border-zinc-300 bg-white p-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          <p className="mt-1 text-xs text-zinc-500">Enter to add, Esc to cancel</p>
        </div>
      )}
    </section>
  );
}
