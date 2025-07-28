import { Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { CardView } from "../sync/board";
import { CARD_COLORS } from "../sync/ops";
import type { Replica } from "../sync/replica";
import { COLOR_CLASS } from "./colors";

type Props = { card: CardView | undefined; replica: Replica; onClose: () => void };

/**
 * Edits commit on blur, so other viewers see a finished title rather than
 * every keystroke. If someone else deletes the card, the dialog closes.
 */
export function CardDialog({ card, replica, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState(card?.title ?? "");
  const [description, setDescription] = useState(card?.description ?? "");

  useEffect(() => {
    if (!card) return onClose();
    if (!ref.current?.open) ref.current?.showModal();
  }, [card, onClose]);

  // Pick up remote edits to fields this user isn't currently editing.
  useEffect(() => {
    if (card && document.activeElement?.id !== "card-title") setTitle(card.title);
    if (card && document.activeElement?.id !== "card-description") setDescription(card.description);
  }, [card]);

  if (!card) return null;

  const save = () => {
    if (title.trim() && title !== card.title) replica.editCard(card.id, "title", title.trim());
    if (description !== card.description) replica.editCard(card.id, "description", description);
  };

  return (
    <dialog
      ref={ref}
      onClose={() => {
        save();
        onClose();
      }}
      onClick={(e) => e.target === ref.current && ref.current?.close()}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-xl border border-zinc-200 bg-white p-0 text-zinc-900 shadow-2xl backdrop:bg-black/50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
    >
      <div className="space-y-4 p-5">
        <div className="flex items-start gap-2">
          <label htmlFor="card-title" className="sr-only">
            Title
          </label>
          <input
            id="card-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={save}
            className="flex-1 rounded-md border border-transparent bg-transparent px-1 py-0.5 text-lg font-semibold hover:border-zinc-300 focus:border-zinc-300 dark:hover:border-zinc-700 dark:focus:border-zinc-700"
          />
          <button onClick={() => ref.current?.close()} aria-label="Close" className="rounded p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <X className="size-4" />
          </button>
        </div>

        <div>
          <label htmlFor="card-description" className="mb-1 block text-xs font-medium text-zinc-500">
            Description
          </label>
          <textarea
            id="card-description"
            rows={5}
            value={description}
            placeholder="Add more detail…"
            onChange={(e) => setDescription(e.target.value)}
            onBlur={save}
            className="w-full rounded-lg border border-zinc-300 bg-white p-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </div>

        <fieldset>
          <legend className="mb-1.5 text-xs font-medium text-zinc-500">Label</legend>
          <div className="flex gap-2">
            {CARD_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => replica.colorCard(card.id, color)}
                aria-label={color === "none" ? "No label" : `${color} label`}
                aria-pressed={card.color === color}
                className={`size-7 rounded-full border-2 ${COLOR_CLASS[color]} ${
                  card.color === color ? "border-zinc-900 dark:border-white" : "border-zinc-300 dark:border-zinc-700"
                } ${color === "none" ? "bg-[repeating-linear-gradient(45deg,transparent,transparent_3px,rgb(161_161_170/0.4)_3px,rgb(161_161_170/0.4)_4px)]" : ""}`}
              />
            ))}
          </div>
        </fieldset>
      </div>

      <footer className="flex justify-end border-t border-zinc-200 px-5 py-3 dark:border-zinc-800">
        <button
          onClick={() => {
            replica.deleteCard(card.id);
            onClose();
          }}
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
        >
          <Trash2 className="size-4" /> Delete card
        </button>
      </footer>
    </dialog>
  );
}
