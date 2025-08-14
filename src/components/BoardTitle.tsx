import { useState } from "react";

import { useBoard } from "../state/board-store";

/** The board's name, editable in place. Renames sync like any other change. */
export function BoardTitle() {
  const { title, replica } = useBoard();
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    const next = draft?.trim();
    if (replica && next !== undefined && next !== title) replica.renameBoard(next);
    setDraft(null);
  };

  if (draft !== null) {
    return (
      <input
        autoFocus
        value={draft}
        maxLength={80}
        aria-label="Board name"
        placeholder="Untitled board"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setDraft(null);
        }}
        className="w-48 rounded border border-zinc-300 bg-white px-1.5 py-0.5 text-sm font-medium sm:w-64 dark:border-zinc-700 dark:bg-zinc-950"
      />
    );
  }

  return (
    <button
      onClick={() => setDraft(title)}
      title="Rename board"
      className={`max-w-48 truncate rounded px-1.5 py-0.5 text-sm font-medium hover:bg-zinc-100 sm:max-w-64 dark:hover:bg-zinc-900 ${
        title ? "" : "text-zinc-500"
      }`}
    >
      {title || "Untitled board"}
    </button>
  );
}
