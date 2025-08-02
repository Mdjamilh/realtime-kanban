import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlignLeft } from "lucide-react";

import type { CardView } from "../sync/board";
import { COLOR_CLASS } from "./colors";

/** Card face shared by the list and the drag overlay. */
export function CardFace({ card, dragging = false }: { card: CardView; dragging?: boolean }) {
  return (
    <div
      className={`rounded-lg border border-zinc-200 bg-white p-3 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-900 ${
        dragging ? "rotate-2 shadow-lg ring-2 ring-accent" : ""
      }`}
    >
      {card.color !== "none" && <span className={`mb-2 block h-1.5 w-10 rounded-full ${COLOR_CLASS[card.color]}`} />}
      <p className="break-words">{card.title || <span className="text-zinc-400">Untitled</span>}</p>
      {card.description && (
        <p className="mt-1.5 flex items-start gap-1 text-xs text-zinc-500">
          <AlignLeft className="mt-0.5 size-3 shrink-0" />
          <span className="line-clamp-2">{card.description}</span>
        </p>
      )}
    </div>
  );
}

export type MoveDirection = "up" | "down" | "left" | "right";

const KEY_TO_DIRECTION: Record<string, MoveDirection> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

type CardProps = {
  card: CardView;
  columnId: string;
  onOpen: () => void;
  onMove: (direction: MoveDirection) => void;
};

/**
 * Mouse and touch drag via dnd-kit; keyboard users move cards with
 * Alt + arrow keys, which is predictable across nested columns.
 */
export function Card({ card, columnId, onOpen, onMove }: CardProps) {
  const { listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: "card", columnId },
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? "opacity-40" : ""}
    >
      <button
        {...listeners}
        data-card-id={card.id}
        onClick={onOpen}
        onKeyDown={(event) => {
          const direction = KEY_TO_DIRECTION[event.key];
          if (event.altKey && direction) {
            event.preventDefault();
            onMove(direction);
          }
        }}
        aria-label={`${card.title || "Untitled card"}. Press Enter to open, Alt and arrow keys to move.`}
        className="block w-full cursor-grab rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-accent active:cursor-grabbing"
      >
        <CardFace card={card} />
      </button>
    </li>
  );
}
