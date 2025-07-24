import type { CardColor } from "../sync/ops";

export const COLOR_CLASS: Record<CardColor, string> = {
  none: "bg-transparent",
  red: "bg-red-500",
  amber: "bg-amber-400",
  green: "bg-emerald-500",
  sky: "bg-sky-500",
  violet: "bg-violet-500",
};
