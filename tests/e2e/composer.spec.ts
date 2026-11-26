import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("authors three files and opens the confirmed saved detail after reload", async ({ page, browser }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/snippets/new");
  await page.getByLabel("Snippet title").fill("Small formatter example");

  await page.getByLabel("File path").fill("src\\main.ts");
  await page.locator("textarea").fill('import { formatLine } from "./format";\n');
  await page.getByRole("button", { name: "Add file" }).click();
  await page.getByLabel("Choose a file").selectOption({ label: "Untitled file 2" });
  await page.getByLabel("File path").fill("src/format.ts");
  await page.locator("textarea").fill("export const formatLine = (value: string) => value.trim();");
  await page.getByRole("button", { name: "Add file" }).click();
  await page.getByLabel("Choose a file").selectOption({ label: "Untitled file 3" });
  await page.getByLabel("File path").fill("README.md");
  await page.locator("textarea").fill("# Formatter\n\nThree related files.");

  await page.getByRole("button", { name: "Save snippet" }).click();
  await expect(page).toHaveURL(/\/snippets\/(?!new(?:\/|$))[A-Za-z0-9_-]+$/);
  await expect(page.getByRole("heading", { name: "Small formatter example" })).toBeVisible();
  const detailUrl = page.url();
  await page.getByLabel("Choose a file").selectOption("README.md");
  await expect(page.locator("pre[aria-label='Code for README.md']")).toContainText("Three related files.");

  await page.reload();
  await expect(page.locator("pre[aria-label='Code for README.md']")).toContainText("Three related files.");
  await page.getByLabel("Choose a file").selectOption("src/main.ts");
  await expect(page).toHaveURL(/file=src%2Fmain\.ts/);
  await expect(page.locator("pre[aria-label='Code for src/main.ts']")).toContainText("./format");

  await page.goto("/snippets");
  await page.getByRole("link", { name: /Small formatter example/ }).click();
  await expect(page).toHaveURL(/\/snippets\/[A-Za-z0-9_-]+$/);
  await expect(page.getByRole("heading", { name: "Small formatter example" })).toBeVisible();

  const freshProfile = await browser.newPage();
  await freshProfile.goto(detailUrl);
  await expect(freshProfile.getByRole("heading", { name: "Snippet not found" })).toBeVisible();
  await freshProfile.getByRole("link", { name: "Back to snippets" }).click();
  await expect(freshProfile.getByText("Timed startup lines")).toBeVisible();
  await expect(freshProfile.getByText("Small formatter example")).toHaveCount(0);
  await freshProfile.close();
});

test("normalizes file paths and rejects normalized duplicates and control characters", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/snippets/new");
  await page.getByLabel("Snippet title").fill("Normalized paths");
  await page.getByLabel("File path").fill(" src\\main.ts ");
  await page.locator("textarea").fill("keep this code");
  await page.getByRole("button", { name: "Save snippet" }).click();
  await expect(page.getByLabel("Choose a file")).toHaveValue("src/main.ts");
  await expect(page.locator("pre[aria-label='Code for src/main.ts']")).toContainText(
    "keep this code",
  );

  await page.goto("/snippets/new");
  await page.getByLabel("Snippet title").fill("Duplicate paths");
  await page.getByLabel("File path").fill("src\\main.ts");
  await page.locator("textarea").fill("first file");
  await page.getByRole("button", { name: "Add file" }).click();
  await page.getByLabel("Choose a file").selectOption({ label: "Untitled file 2" });
  await page.getByLabel("File path").fill("src/main.ts");
  await page.locator("textarea").fill("second file");
  await page.getByRole("button", { name: "Save snippet" }).click();
  await expect(
    page.getByText("Each file needs a different path after normalization.").first(),
  ).toBeVisible();

  await page.getByLabel("File path").fill("src/\u0001main.ts");
  await page.getByRole("button", { name: "Save snippet" }).click();
  await expect(page.getByText(/No leading slash, drive prefix, empty segment, or control character/)).toBeVisible();
  await expect(page.locator("textarea")).toHaveValue("first file");
});

test("validation focuses the first invalid field and keeps draft data on rejected save", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/snippets/new");
  await page.getByRole("button", { name: "Save snippet" }).click();
  await expect(page.getByLabel("Snippet title")).toBeFocused();
  await expect(page.getByText("Add a title for this snippet.")).toBeVisible();

  await page.getByLabel("Snippet title").fill("Path validation sample");
  await page.getByLabel("File path").fill("../unsafe.ts");
  await page.locator("textarea").fill("keep this text");
  await page.getByRole("button", { name: "Save snippet" }).click();
  await expect(page.getByLabel("File path")).toBeFocused();
  await expect(page.getByText(/Use a relative path/)).toBeVisible();

  await page.getByLabel("File path").fill("src/valid.ts");
  await page.goto("/snippets/new?scenario=write-failure");
  await page.getByLabel("Snippet title").fill("Keep this on failure");
  await page.getByLabel("File path").fill("src/keep.ts");
  await page.locator("textarea").fill("draft remains");
  await page.getByRole("button", { name: "Save snippet" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("rejected this save");
  await expect(page.getByLabel("Snippet title")).toHaveValue("Keep this on failure");
  await expect(page.getByLabel("File path")).toHaveValue("src/keep.ts");
  await expect(page.locator("textarea")).toHaveValue("draft remains");
  await expect(page).toHaveURL(/\/snippets\/new\?scenario=write-failure$/);
});

test("confirms content removal, keeps a minimum file, and confirms dirty navigation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/snippets/new");
  await page.getByLabel("Snippet title").fill("Draft to discard");
  await page.getByLabel("File path").fill("src/first.ts");
  await page.locator("textarea").fill("file content");
  await page.getByRole("button", { name: "Add file" }).click();
  await page.getByLabel("Choose a file").selectOption({ label: "Untitled file 2" });
  await page.getByLabel("File path").fill("src/second.ts");
  await page.locator("textarea").fill("second file content");
  await page.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.getByRole("button", { name: "Keep file" }).click();
  await expect(page.getByLabel("File path")).toHaveValue("src/second.ts");

  await page.getByRole("button", { name: "Remove" }).click();
  await page.getByRole("button", { name: "Remove file" }).click();
  await expect(page.getByLabel("Choose a file")).toHaveValue("file-1");
  await expect(page.getByRole("button", { name: "Remove" })).toBeDisabled();

  await page.getByRole("link", { name: "Browse snippets" }).first().click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.getByRole("button", { name: "Keep editing" }).click();
  await expect(page).toHaveURL(/\/snippets\/new$/);
  await expect(page.getByLabel("Snippet title")).toHaveValue("Draft to discard");
  await expect(page.getByRole("link", { name: "Browse snippets" }).first()).toBeFocused();
  await page.getByRole("link", { name: "Browse snippets" }).first().click();
  await page.getByRole("button", { name: "Discard changes" }).click();
  await expect(page).toHaveURL(/\/snippets$/);
});

test("composer has no horizontal overflow at required widths and passes automated accessibility", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/snippets/new");
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    results.violations.flatMap((violation) =>
      violation.nodes.map((node) => ({
        rule: violation.id,
        target: node.target,
        failure: node.failureSummary,
      })),
    ),
  ).toEqual([]);
});

test("desktop composer loads Monaco and keeps textarea available", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/snippets/new");
  await expect(page.locator(".monaco-editor")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Use plain editor" })).toBeVisible();
  await page.getByRole("button", { name: "Use plain editor" }).click();
  await expect(page.getByLabel("Code for untitled file")).toBeVisible();
});
