import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("renders Snip it sign-in matching design and switches to create account", async ({ page }) => {
  await page.goto("/signin");
  await expect(page.getByText("Snip it", { exact: false }).first()).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Sign in to Snip it" })).toBeVisible();
  await expect(page.getByText("Save and share multi-file snippets")).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with GitHub" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with email" })).toBeVisible();

  await page.getByRole("link", { name: "Create an account" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Create your Snip it account" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Sign in to Snip it" })).toBeVisible();
});

test("email sign-in validates fields, requires 6-digit verification, and survives reload", async ({
  page,
}) => {
  await page.goto("/signin");
  await page.getByRole("button", { name: "Continue with email" }).click();

  await page.getByRole("button", { name: "Send verification code" }).click();
  await expect(page.getByText("Enter your email address.")).toBeVisible();
  await expect(page.locator("#auth-email")).toBeFocused();

  await page.locator("#auth-email").fill("rishi@snipit.dev");
  await page.getByRole("button", { name: "Send verification code" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Verify your email" })).toBeVisible();
  await expect(page.getByText("rishi@snipit.dev")).toBeVisible();

  await page.getByRole("textbox", { name: "Digit 1 of 6" }).fill("1");
  await page.getByRole("textbox", { name: "Digit 2 of 6" }).fill("1");
  await page.getByRole("textbox", { name: "Digit 3 of 6" }).fill("1");
  await page.getByRole("textbox", { name: "Digit 4 of 6" }).fill("1");
  await page.getByRole("textbox", { name: "Digit 5 of 6" }).fill("1");
  await page.getByRole("textbox", { name: "Digit 6 of 6" }).fill("1");
  await page.getByRole("button", { name: "Verify & continue" }).click();
  await expect(page.getByText(/Incorrect verification code/)).toBeVisible();

  await page.getByRole("button", { name: "Fill code" }).click();
  await page.getByRole("button", { name: "Verify & continue" }).click();

  await expect(page).toHaveURL(/\/snippets$/);
  await expect(page.getByRole("heading", { level: 1, name: "Snippets" })).toBeVisible();
  await expect(page.getByText("Timed startup lines")).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/\/snippets$/);
  await expect(page.getByText("Timed startup lines")).toBeVisible();

  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/signin$/);
  await expect(page.getByRole("heading", { level: 1, name: "Sign in to Snip it" })).toBeVisible();
});

test("GitHub and Google sign-in also enforce email verification", async ({ page }) => {
  await page.goto("/signin");
  await page.getByRole("button", { name: "Continue with GitHub" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Verify your email" })).toBeVisible();
  await expect(page.getByText(/Confirm your GitHub sign-in/)).toBeVisible();

  await page.getByRole("button", { name: "Fill code" }).click();
  await page.getByRole("button", { name: "Verify & continue" }).click();
  await expect(page).toHaveURL(/\/snippets$/);
  await expect(page.getByText("Timed startup lines")).toBeVisible();

  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/signin$/);
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expect(page.getByText(/Confirm your Google sign-in/)).toBeVisible();
  await page.getByRole("button", { name: "Fill code" }).click();
  await page.getByRole("button", { name: "Verify & continue" }).click();
  await expect(page).toHaveURL(/\/snippets$/);
});

test("create account validates name/email and completes email verification", async ({ page }) => {
  await page.goto("/signup");
  await page.getByRole("button", { name: "Continue with email" }).click();
  await page.getByRole("button", { name: "Send verification code" }).click();
  await expect(page.getByText("Enter your name.")).toBeVisible();
  await expect(page.locator("#auth-name")).toBeFocused();

  await page.locator("#auth-name").fill("Maya Lin");
  await page.locator("#auth-email").fill("maya@example.com");
  await page.getByRole("button", { name: "Send verification code" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Verify your email" })).toBeVisible();
  await page.getByRole("button", { name: "Fill code" }).click();
  await page.getByRole("button", { name: "Verify & continue" }).click();
  await expect(page).toHaveURL(/\/snippets$/);
  await expect(page.getByRole("heading", { level: 1, name: "Snippets" })).toBeVisible();
});

test("demo snippet library is browseable without inventing account permissions", async ({ page }) => {
  await page.goto("/snippets");
  await expect(page.getByRole("heading", { level: 1, name: "Snippets" })).toBeVisible();
  await expect(page.getByText("Timed startup lines")).toBeVisible();
});

test("auth-failure scenario surfaces error cleanly", async ({ page }) => {
  await page.goto("/signin?scenario=auth-failure");
  await page.getByRole("button", { name: "Continue with GitHub" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText(/blocked sign-in/i);
  await expect(page.getByRole("heading", { level: 1, name: "Sign in to Snip it" })).toBeVisible();
});

for (const route of ["/signin", "/signup"]) {
  test(`WCAG AA accessibility scan: ${route}`, async ({ page }) => {
    await page.goto(route);
    await page.locator("main").waitFor();
    await page.waitForTimeout(400);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    expect(
      results.violations.map((violation) => `${violation.id}: ${violation.nodes.length}`),
    ).toEqual([]);
  });
}

for (const width of [320, 390, 768, 1440]) {
  test(`responsive layout has no overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Create snippet" })).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
}
