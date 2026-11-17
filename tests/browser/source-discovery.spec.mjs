import { test, expect } from "@playwright/test";

for (const width of [1024, 1512]) {
  test(`Sources retains its filters and complete records at ${width}px`, async ({
    page,
  }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: width === 1024 ? 768 : 982 });
    await page.goto("/");
    await page.getByRole("button", { name: /^Sources/ }).click();
    const registry = page.getByRole("region", {
      name: "Source registry",
      exact: true,
    });
    const search = registry.getByRole("searchbox", {
      name: "Find sources",
      exact: true,
    });
    await expect(page.getByRole("searchbox")).toHaveCount(1);
    const filters = registry.getByRole("group", {
      name: "Source type",
      exact: true,
    });
    const buttons = filters.getByRole("button");
    await expect(buttons).toHaveCount(7);
    for (const button of await buttons.all()) {
      await expect(button).toBeInViewport({ ratio: 1 });
      expect((await button.boundingBox()).height).toBeGreaterThan(20);
    }
    await search.fill("  NOTION_FRAGMENT  ");
    await expect(registry.locator("[data-record-id]")).toHaveCount(1);
    await registry.locator('[data-record-id="notion_fragment"]').click();
    const details = registry.getByLabel("Source details", { exact: true });
    await expect(
      details.getByRole("heading", { name: "Genomics program brief" }),
    ).toBeVisible();
    await expect(
      details.getByRole("button", {
        name: "Restore bundled source",
        exact: true,
      }),
    ).toBeEnabled();
    await expect(
      details.getByRole("button", { name: "Edit metadata", exact: true }),
    ).toBeEnabled();
    await registry.getByRole("button", { name: "Clear search" }).click();
    await expect(search).toBeFocused();
    await expect(registry.locator("[data-record-id]")).toHaveCount(8);
    await filters
      .getByRole("button", { name: "Scientific", exact: true })
      .click();
    await expect(
      filters.getByRole("button", { name: "Scientific", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(registry.locator("[data-record-id]")).toHaveCount(1);
    await search.fill("does not match");
    await expect(
      registry.getByRole("status").filter({ hasText: "No sources match" }),
    ).toContainText("No sources match");
    await registry.getByRole("button", { name: "Clear search" }).click();
    await filters
      .getByRole("button", { name: "All Sources", exact: true })
      .click();

    const ids = await registry
      .locator("[data-record-id]")
      .evaluateAll((nodes) => nodes.map((node) => node.dataset.recordId));
    for (const id of ids) {
      const card = registry.locator(`[data-record-id="${id}"]`);
      if ((await card.getAttribute("aria-pressed")) !== "true")
        await card.click();
      const viewport = details.locator('[data-slot="scroll-area-viewport"]');
      expect(
        await viewport.evaluate(
          (node) => node.scrollWidth <= node.clientWidth + 1,
        ),
      ).toBe(true);
      await details.getByText("Tags", { exact: true }).scrollIntoViewIfNeeded();
      await expect(details.getByText("Tags", { exact: true })).toBeInViewport({
        ratio: 1,
      });
      expect(
        await viewport.evaluate(
          (node) => node.getBoundingClientRect().bottom <= innerHeight + 1,
        ),
      ).toBe(true);
    }
    await registry.locator('[data-record-id="notion_fragment"]').click();
    await details
      .getByRole("heading", { name: "Genomics program brief" })
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `.visual-runs/sources-after-${width}.png`,
      animations: "disabled",
    });
    if (width === 1512) {
      await page
        .getByRole("group", { name: "Appearance", exact: true })
        .getByRole("radio", { name: "Light", exact: true })
        .check();
      await expect(
        details.getByRole("heading", { name: "Genomics program brief" }),
      ).toHaveCSS("color", "rgb(23, 45, 69)");
      await expect(
        registry.locator('[data-record-id="notion_fragment"]'),
      ).toHaveAttribute("aria-pressed", "true");
      await page.screenshot({
        path: ".visual-runs/sources-light.png",
        animations: "disabled",
      });
    }
    expect(errors).toEqual([]);
  });
}

test("search stays with its working view and Error Lab starts from its own query", async ({
  page,
}) => {
  await page.goto("/");
  const corridorSearch = page.getByRole("searchbox", {
    name: "Find corridor cards",
    exact: true,
  });
  await corridorSearch.fill("Sample Intake");
  await expect(page.getByText("Sample Intake", { exact: true })).toHaveCount(1);
  await expect(page.getByText("Plate Map 96", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "plate", exact: true }).click();
  await expect(page.getByRole("searchbox")).toHaveCount(0);
  await page.getByRole("button", { name: "corridor", exact: true }).click();
  await expect(corridorSearch).toHaveValue("Sample Intake");
  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(page.getByText("Plate Map 96", { exact: true })).toHaveCount(1);
  await corridorSearch.fill("Sample Intake");
  await page.getByRole("button", { name: /^Profile/ }).click();
  await expect(page.getByRole("searchbox")).toHaveCount(0);
  await page.getByRole("button", { name: "Error Lab", exact: true }).click();
  const errors = page.getByRole("searchbox", {
    name: "Find log entries",
    exact: true,
  });
  await expect(errors).toHaveValue("");
  await page.locator("button:has(svg.lucide-chevron-right)").click();
  await expect(page.getByText("page 2 / 9", { exact: true })).toBeVisible();
  await errors.fill("SOURCE_FETCH_FAILED");
  await expect(
    page.getByText("Example error log · 7 entries", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("page 1 / 1", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(
    page.getByText("Example error log · 83 entries", { exact: true }),
  ).toBeVisible();
  for (const name of [
    "Map",
    "Cohort Builder",
    "Quality Control",
    "Biomarkers",
    "Requirements",
    "Artifacts",
    "Comparisons",
    "Decisions",
    "Release plan",
    "Presentations",
  ]) {
    await page
      .locator("nav")
      .first()
      .getByRole("button", { name: new RegExp(`^${name}`) })
      .click();
    await expect(page.getByRole("searchbox")).toHaveCount(0);
  }
  await page.getByRole("button", { name: /^Specimens/ }).click();
  await expect(
    page.getByRole("searchbox", { name: "Find a specimen", exact: true }),
  ).toHaveCount(1);
});
