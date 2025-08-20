import type { ColumnView } from "./board";

/** The board as a Markdown checklist, one section per column. */
export function boardToMarkdown(title: string, columns: ColumnView[]): string {
  const lines = [`# ${title || "Untitled board"}`, ""];
  for (const column of columns) {
    lines.push(`## ${column.title} (${column.cards.length})`, "");
    if (column.cards.length === 0) lines.push("_No cards_");
    for (const card of column.cards) {
      const label = card.color === "none" ? "" : ` \`${card.color}\``;
      lines.push(`- ${card.title}${label}`);
      for (const line of card.description.split("\n").filter((l) => l.trim())) lines.push(`  > ${line.trim()}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

/** A filesystem-safe file name for the export. */
export const exportFileName = (title: string) =>
  `${(title || "board").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "board"}.md`;
