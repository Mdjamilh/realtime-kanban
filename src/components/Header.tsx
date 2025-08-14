import { Check, Link2, Moon, Sun } from "lucide-react";
import { useState } from "react";

import { useTheme } from "../hooks/use-theme";
import { useBoard } from "../state/board-store";
import { BoardTitle } from "./BoardTitle";

const STATUS: Record<string, { label: string; dot: string }> = {
  "tabs:online": { label: "Live across your tabs", dot: "bg-emerald-500" },
  "server:online": { label: "Connected", dot: "bg-emerald-500" },
  "server:connecting": { label: "Connecting…", dot: "bg-amber-400 animate-pulse" },
  "server:offline": { label: "Offline, changes will sync later", dot: "bg-red-500" },
};

function Avatar({ name, color, ring }: { name: string; color: string; ring?: boolean }) {
  return (
    <span
      title={name}
      className={`flex size-7 items-center justify-center rounded-full text-xs font-semibold text-white ${ring ? "ring-2 ring-white dark:ring-zinc-950" : ""}`}
      style={{ backgroundColor: color }}
    >
      {name
        .split(" ")
        .map((w) => w[0])
        .join("")}
    </span>
  );
}

export function Header({ onBoard }: { onBoard: boolean }) {
  const { theme, toggle } = useTheme();
  const { peers, status, mode, me } = useBoard();
  const [copied, setCopied] = useState(false);
  const indicator = STATUS[`${mode}:${status}`] ?? STATUS["tabs:online"]!;

  const share = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <header className="flex h-14 items-center gap-3 border-b border-zinc-200 px-4 dark:border-zinc-800">
      <a href="#/" className="flex items-center gap-2 font-semibold">
        <span className="flex gap-0.5" aria-hidden>
          <span className="h-4 w-1.5 rounded-sm bg-accent" />
          <span className="h-3 w-1.5 rounded-sm bg-accent" />
          <span className="h-2 w-1.5 rounded-sm bg-accent" />
        </span>
        Realtime Kanban
      </a>

      {onBoard && (
        <>
          <span className="text-zinc-300 dark:text-zinc-700" aria-hidden>
            /
          </span>
          <BoardTitle />
          <span className="ml-2 hidden items-center gap-2 text-xs text-zinc-500 sm:flex" role="status">
            <span className={`size-2 rounded-full ${indicator.dot}`} />
            {indicator.label}
          </span>
          <div className="ml-auto flex items-center gap-3">
            <div className="flex -space-x-2" aria-label={`${peers.length + 1} viewing`}>
              <Avatar name={`${me.name} (you)`} color={me.color} ring />
              {peers.slice(0, 4).map((p) => (
                <Avatar key={p.client} name={p.name} color={p.color} ring />
              ))}
              {peers.length > 4 && (
                <span className="flex size-7 items-center justify-center rounded-full bg-zinc-200 text-xs ring-2 ring-white dark:bg-zinc-800 dark:ring-zinc-950">
                  +{peers.length - 4}
                </span>
              )}
            </div>
            <button
              onClick={share}
              className="flex items-center gap-1.5 rounded-md border border-zinc-200 px-2.5 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-900"
            >
              {copied ? <Check className="size-4 text-emerald-500" /> : <Link2 className="size-4" />}
              {copied ? "Copied" : "Share"}
            </button>
          </div>
        </>
      )}

      <button
        onClick={toggle}
        aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        className={`rounded-md p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 ${onBoard ? "" : "ml-auto"}`}
      >
        {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
      </button>
    </header>
  );
}
