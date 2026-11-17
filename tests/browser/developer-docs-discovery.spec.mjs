import { test, expect } from "@playwright/test";

async function openDocs(page, link) {
  await expect(link).toContainText("Opens in a new tab");
  const popupReady = page.waitForEvent("popup");
  await link.click();
  const docs = await popupReady;
  try {
    await expect(docs).toHaveURL(/\/docs\/$/);
    await expect(
      docs.getByRole("heading", {
        name: "Build with Source of Truth",
        exact: true,
      }),
    ).toBeVisible();
    expect(await docs.evaluate(() => window.opener)).toBeNull();
  } finally {
    await docs.close();
  }
}

test("developer documentation opens beside an unsaved Source draft", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#initial-load")).toHaveCount(0);
  await page.getByRole("button", { name: /^Sources/ }).click();
  await page.locator('[data-record-id="notion_fragment"]').click();
  const details = page.getByLabel("Source details", { exact: true });
  await details
    .getByRole("button", { name: "Edit metadata", exact: true })
    .click();
  const editor = details.getByRole("form", { name: "Edit source metadata" });
  const title = editor.getByLabel("Display title", { exact: true });
  await title.fill("An unfinished source draft");
  const workspaceUrl = page.url();
  await openDocs(page, page.getByRole("link", { name: /Developer docs/ }));
  await expect(title).toHaveValue("An unfinished source draft");
  await page.screenshot({ path: ".visual-runs/developer-docs-desktop.png" });
  await expect(page).toHaveURL(workspaceUrl);
  await expect(
    details.getByRole("heading", { name: "Genomics program brief" }),
  ).toBeVisible();
});

test("mobile information and Guide offer docs while retaining the Plate scene", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("#initial-load")).toHaveCount(0);
  const plate = page.getByRole("button", { name: "Plate", exact: true });
  await plate.click();
  await page.getByRole("button", { name: "About this showcase" }).click();
  const about = page.getByRole("dialog");
  await openDocs(page, about.getByRole("link", { name: /Developer docs/ }));
  await expect(about).toBeVisible();
  await about
    .getByRole("button", { name: "Close about this showcase" })
    .click();
  await expect(plate).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Guide", exact: true }).click();
  const guide = page.getByRole("complementary", { name: "Follow a sample." });
  await openDocs(page, guide.getByRole("link", { name: /Developer docs/ }));
  await expect(guide).toBeVisible();
  const link = await guide
    .getByRole("link", { name: /Developer docs/ })
    .boundingBox();
  const credit = await guide.locator("footer").boundingBox();
  expect(link.y + link.height).toBeLessThanOrEqual(credit.y);
  await page.screenshot({ path: ".visual-runs/developer-docs-mobile.png" });
  await expect(plate).toHaveAttribute("aria-pressed", "true");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
