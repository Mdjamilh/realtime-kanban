import { expect, test, type Page } from "@playwright/test";

const column = (page: Page, name: string) => page.getByRole("region", { name });
const cardButton = (page: Page, title: string) => page.getByRole("button", { name: new RegExp(`^${title}\\.`) });

/** Opens the same new board in two tabs of one browser, so BroadcastChannel connects them. */
async function twoTabs(context: import("@playwright/test").BrowserContext) {
  const a = await context.newPage();
  await a.goto("/");
  await a.getByRole("button", { name: "New board" }).click();
  await expect(column(a, "To do")).toBeVisible();
  const b = await context.newPage();
  await b.goto(a.url());
  await expect(column(b, "To do")).toBeVisible();
  return { a, b };
}

test("a new board starts with example columns and cards", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New board" }).click();
  await expect(page).toHaveURL(/#\/b\/[\w-]+$/);
  for (const name of ["To do", "In progress", "Done"]) await expect(column(page, name)).toBeVisible();
  await expect(cardButton(page, "Drag a card between columns")).toBeVisible();
});

test("renaming a brand-new board right away keeps the starter columns", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New board" }).click();
  await page.getByRole("button", { name: "Untitled board" }).click();
  await page.getByLabel("Board name").fill("Quick rename");
  await page.keyboard.press("Enter");
  await expect(column(page, "To do")).toBeVisible();
});

test("cards added in one tab appear in the other", async ({ context }) => {
  const { a, b } = await twoTabs(context);
  await column(a, "To do").getByRole("button", { name: "Add a card" }).click();
  await a.getByLabel("New card title").fill("Write the README");
  await a.keyboard.press("Enter");
  await expect(cardButton(b, "Write the README")).toBeVisible();
});

test("dragging a card to another column syncs", async ({ context }) => {
  const { a, b } = await twoTabs(context);
  const card = cardButton(a, "Drag a card between columns");
  const target = column(a, "Done").getByRole("list");

  const from = (await card.boundingBox())!;
  const to = (await target.boundingBox())!;
  await a.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await a.mouse.down();
  await a.mouse.move(from.x + 20, from.y + 20, { steps: 5 });
  await a.mouse.move(to.x + to.width / 2, to.y + to.height - 10, { steps: 15 });
  await a.mouse.up();

  await expect(column(a, "Done").getByText("Drag a card between columns")).toBeVisible();
  await expect(column(b, "Done").getByText("Drag a card between columns")).toBeVisible();
  await expect(column(b, "To do").getByText("Drag a card between columns")).toHaveCount(0);
});

test("cards can be moved with the keyboard", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New board" }).click();
  const card = cardButton(page, "Open this board in a second tab");
  await card.focus();
  await page.keyboard.press("Alt+ArrowDown");
  await expect
    .poll(async () => (await column(page, "To do").getByRole("listitem").allInnerTexts()).map((t) => t.trim()))
    .toEqual(["Drag a card between columns", "Open this board in a second tab"]);

  // Focus stays on the card, so it can keep moving: over to the next column.
  await page.keyboard.press("Alt+ArrowRight");
  await expect(column(page, "In progress").getByText("Open this board in a second tab")).toBeVisible();
  await expect(cardButton(page, "Open this board in a second tab")).toBeFocused();
});

test("editing and deleting a card syncs, and boards survive a reload", async ({ context }) => {
  const { a, b } = await twoTabs(context);
  await cardButton(a, "Create a board").click();
  const dialog = a.getByRole("dialog");
  await dialog.getByLabel("Title").fill("Ship v1");
  await dialog.getByLabel("Description").fill("Tag the release");
  await dialog.getByRole("button", { name: "green label" }).click();
  await dialog.getByRole("button", { name: "Close" }).click();

  await expect(cardButton(b, "Ship v1")).toContainText("Tag the release");

  await b.reload();
  await expect(cardButton(b, "Ship v1")).toBeVisible();

  await cardButton(b, "Ship v1").click();
  await b.getByRole("dialog").getByRole("button", { name: "Delete card" }).click();
  await expect(cardButton(a, "Ship v1")).toHaveCount(0);
});

test("naming a board syncs and shows up in recent boards", async ({ context }) => {
  const { a, b } = await twoTabs(context);
  await a.getByRole("button", { name: "Untitled board" }).click();
  await a.getByLabel("Board name").fill("Launch plan");
  await a.keyboard.press("Enter");

  await expect(b.getByRole("button", { name: "Launch plan" })).toBeVisible();
  await expect(b).toHaveTitle("Launch plan · Realtime Kanban");

  const [download] = await Promise.all([
    b.waitForEvent("download"),
    b.getByRole("button", { name: "Export as Markdown" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("launch-plan.md");

  await b.getByRole("link", { name: "Realtime Kanban" }).click();
  await expect(b.getByRole("link", { name: /Launch plan/ })).toBeVisible();
});

test("renaming a column and seeing who else is here", async ({ context }) => {
  const { a, b } = await twoTabs(context);
  await column(a, "In progress").getByRole("button", { name: "In progress" }).click();
  await a.getByLabel("Column name").fill("Doing");
  await a.keyboard.press("Enter");
  await expect(column(b, "Doing")).toBeVisible();

  // Each tab has its own identity, so each sees the other as a second viewer.
  await expect(a.getByLabel("2 viewing")).toBeVisible();
  await expect(b.getByLabel("2 viewing")).toBeVisible();
});
