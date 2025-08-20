import { describe, expect, it } from "vitest";

import { boardToMarkdown, exportFileName } from "./export";

describe("boardToMarkdown", () => {
  it("renders columns, cards, labels and descriptions", () => {
    const md = boardToMarkdown("Launch", [
      {
        id: "a",
        title: "To do",
        position: "a0",
        cards: [
          { id: "1", title: "Write docs", description: "README\n\nand a guide", color: "green", position: "a0" },
          { id: "2", title: "Tag release", description: "", color: "none", position: "a1" },
        ],
      },
      { id: "b", title: "Done", position: "a1", cards: [] },
    ]);
    expect(md).toBe(
      [
        "# Launch",
        "",
        "## To do (2)",
        "",
        "- Write docs `green`",
        "  > README",
        "  > and a guide",
        "- Tag release",
        "",
        "## Done (0)",
        "",
        "_No cards_",
        "",
      ].join("\n"),
    );
  });

  it("names untitled boards", () => {
    expect(boardToMarkdown("", [])).toBe("# Untitled board\n");
  });
});

describe("exportFileName", () => {
  it("makes safe file names", () => {
    expect(exportFileName("Q3 Launch / Plan!")).toBe("q3-launch-plan.md");
    expect(exportFileName("")).toBe("board.md");
    expect(exportFileName("???")).toBe("board.md");
  });
});
