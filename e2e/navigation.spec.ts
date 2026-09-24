import { expect, test } from "@playwright/test";

const panel = "section";

async function setSyncedState(page: import("@playwright/test").Page): Promise<void> {
  const search = page.getByPlaceholder("Search products…");
  await search.click();
  await search.pressSequentially("boots");
  await expect(search).toHaveValue("boots");
  await page.getByLabel("Filters open").check();
  await page.getByLabel("Tab:").selectOption("books");
  await page.getByRole("button", { name: "Open modal" }).click();
}

test("preserves client state across an RSC navigation", async ({ page }) => {
  await page.goto("/?mode=synced");
  await setSyncedState(page);
  await page.getByRole("button", { name: "Navigate (server re-render)" }).click();
  await expect(page).toHaveURL(/search=boots/);
  await expect(page.getByPlaceholder("Search products…")).toHaveValue("boots");
  await expect(page.getByLabel("Filters open")).toBeChecked();
  await expect(page.getByLabel("Tab:")).toHaveValue("books");
  await expect(page.getByText("Modal is OPEN (restored across navigation)")).toBeVisible();
});

test("plain React state resets across a full navigation", async ({ page }) => {
  await page.goto("/?mode=plain");
  await setSyncedState(page);
  await page.getByRole("button", { name: "Navigate (server re-render)" }).click();
  await expect(page).toHaveURL(/search=boots/);
  await expect(page.getByPlaceholder("Search products…")).toHaveValue("");
  await expect(page.getByLabel("Filters open")).not.toBeChecked();
  await expect(page.getByLabel("Tab:")).toHaveValue("all");
  await expect(page.getByText("Modal is OPEN (restored across navigation)")).toHaveCount(0);
});

test("keeps state on browser back navigation", async ({ page }) => {
  await page.goto("/?mode=synced");
  await setSyncedState(page);
  await page.getByRole("button", { name: "Navigate (server re-render)" }).click();
  await expect(page).toHaveURL(/search=boots/);
  await page.goBack();
  await expect(page.getByPlaceholder("Search products…")).toHaveValue("boots");
  await expect(page.getByText("Modal is OPEN (restored across navigation)")).toBeVisible();
});

test("exposes a stable demo panel", async ({ page }) => {
  await page.goto("/?mode=synced");
  await expect(page.locator(panel)).toBeVisible();
});
