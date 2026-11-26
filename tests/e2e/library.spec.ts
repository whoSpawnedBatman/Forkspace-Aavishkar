import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("landing actions route to the composer and library and browser back works", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Keep your best code close." })).toBeVisible();
  await expect(page.getByText("Example snippet · Demo data")).toBeVisible();
  await page.getByRole("link", { name: "Create snippet" }).click();
  await expect(page).toHaveURL(/\/snippets\/new$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await page.locator("#main-content").getByRole("link", { name: "Browse snippets" }).click();
  await expect(page).toHaveURL(/\/snippets$/);
});

test("library lists seeded snippets and is accessible and responsive", async ({ page }) => {
  await page.goto("/snippets");

  await expect(page.getByRole("heading", { level: 1, name: "Snippets" })).toBeVisible();
  await expect(page.getByText("Timed startup lines")).toBeVisible();
  await expect(page.getByText("Retrying fetch helper")).toBeVisible();
  await expect(page.getByText("3 files")).toBeVisible();
  await expect(page.getByText("2 files")).toBeVisible();
  await expect(page.getByText("Local demo")).toBeVisible();

  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  }

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(results.violations.map((violation) => violation.id)).toEqual([]);
});

test("library provides empty and retryable read-failure states", async ({ page }) => {
  await page.goto("/snippets?scenario=slow");
  await expect(page.getByRole("status")).toContainText("Loading snippets");
  await expect(page.getByText("Timed startup lines")).toBeVisible();
  await page.goto("/snippets?scenario=empty");
  await expect(page.getByRole("heading", { name: "No snippets yet" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Snippet library" }).getByRole("link", { name: "Create snippet" })).toBeVisible();

  await page.goto("/snippets?scenario=read-failure");
  await expect(page.locator("main").getByRole("alert")).toContainText("Couldn’t load your snippets");
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
});
