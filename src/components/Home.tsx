import { ArrowRight, Columns3, Plus, RefreshCw, WifiOff } from "lucide-react";
import { nanoid } from "nanoid";
import { useEffect, useState } from "react";

import { boardHref, navigate } from "../router";
import { recentBoards, type BoardMeta } from "../state/storage";

const POINTS = [
  { icon: RefreshCw, title: "Live sync", body: "Every change appears instantly in your other tabs, or for everyone when a sync server is configured." },
  { icon: WifiOff, title: "Works offline", body: "Boards are saved in your browser and merge cleanly when you reconnect." },
  { icon: Columns3, title: "Conflict-free", body: "Concurrent edits resolve the same way everywhere, so no copy of the board ever disagrees." },
];

export function Home() {
  const [recent, setRecent] = useState<BoardMeta[]>([]);

  useEffect(() => {
    void recentBoards().then(setRecent);
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-4xl font-semibold tracking-tight text-balance">A Kanban board that stays in sync.</h1>
      <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
        Create a board, open it in two tabs and drag cards around. Changes show up in both, instantly.
      </p>
      <button
        onClick={() => navigate(boardHref(nanoid(10)))}
        className="mt-8 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 font-medium text-white hover:brightness-110"
      >
        <Plus className="size-4" /> New board
      </button>

      {recent.length > 0 && (
        <section className="mt-12" aria-labelledby="recent-heading">
          <h2 id="recent-heading" className="mb-3 text-sm font-medium text-zinc-500">
            Recent boards
          </h2>
          <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {recent.map((board) => (
              <li key={board.id}>
                <a
                  href={boardHref(board.id)}
                  className="flex items-center justify-between px-4 py-3 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                >
                  {board.name ? (
                    <span className="font-medium">{board.name}</span>
                  ) : (
                    <span className="font-mono text-sm text-zinc-500">Untitled · {board.id}</span>
                  )}
                  <span className="flex items-center gap-2 text-xs text-zinc-500">
                    {new Date(board.lastOpened).toLocaleString()} <ArrowRight className="size-4" />
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-16 grid gap-6 sm:grid-cols-3">
        {POINTS.map((p) => (
          <div key={p.title}>
            <p.icon className="size-5 text-accent" />
            <h3 className="mt-3 font-medium">{p.title}</h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{p.body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
