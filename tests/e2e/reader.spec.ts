import { expect, test } from "@playwright/test";

test("reader opens directly, switches files with the keyboard, copies code, and reloads selection", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/snippets/seed-timed-lines");
  await expect(page.getByRole("heading", { name: "Timed startup lines" })).toBeVisible();
  await expect(page.getByRole("button", { name: "src/main.ts" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "src/main.ts" }).focus();
  await page.keyboard.press("ArrowDown");
  await expect(page).toHaveURL(/file=src%2Fformat\.ts/);
  await expect(page.locator("pre[aria-label='Code for src/format.ts']")).toContainText(
    "formatLine",
  );

  await page.getByRole("button", { name: "Copy code" }).click();
  await expect(page.getByRole("status")).toContainText("Copied code to clipboard.");
  await page.reload();
  await expect(page).toHaveURL(/file=src%2Fformat\.ts/);
  await expect(page.locator("pre[aria-label='Code for src/format.ts']")).toContainText(
    "formatLine",
  );
});

test("invalid selected file falls back to the first file; missing and read failures recover", async ({
  page,
}) => {
  await page.goto("/snippets/seed-timed-lines?file=unknown.ts");
  await expect(page.locator("pre[aria-label='Code for src/main.ts']")).toBeVisible();

  await page.goto("/snippets/not-a-real-snippet");
  await expect(page.getByRole("heading", { name: "Snippet not found" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to snippets" })).toBeVisible();

  await page.goto("/snippets/seed-timed-lines?scenario=read-failure");
  await expect(page.locator("main").getByRole("alert")).toContainText("Couldn’t load this snippet");
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
});

test("unknown language renders escaped plain text and clipboard failure offers manual copy", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/snippets/new");
  await page.getByLabel("Snippet title").fill("Plain text example");
  await page.getByLabel("File path").fill("notes.source");
  await page.locator("textarea").fill("<script>not executable</script>");
  await page.getByRole("button", { name: "Save snippet" }).click();
  await expect(page).toHaveURL(/\/snippets\/(?!new(?:\/|$))[A-Za-z0-9_-]+$/);
  await expect(
    page.getByRole("region", { name: "Snippet files and code" }).getByText("Plain text", { exact: true }).last(),
  ).toBeVisible();
  await expect(page.locator("pre[aria-label='Code for notes.source']")).toContainText(
    "<script>not executable</script>",
  );
  await expect(page.locator("pre[aria-label='Code for notes.source']").locator("img, script")).toHaveCount(0);

  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async () => Promise.reject(new Error("clipboard unavailable")) },
    });
  });
  await page.reload();
  await page.getByRole("button", { name: "Copy code" }).click();
  await expect(page.getByRole("status")).toContainText("Select the code and copy it manually.");
});
