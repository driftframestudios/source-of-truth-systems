import { test, expect } from "@playwright/test";

const enter = async (page) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Specimens/ }).click();
};
const switchTable = (page) =>
  page.getByRole("button", { name: "Table", exact: true }).click();
const rowIds = (page) =>
  page
    .locator(".specimen-table tbody tr")
    .evaluateAll((rows) => rows.map((row) => row.dataset.specimenId));
const closeDetails = (page) =>
  page
    .getByRole("button", { name: "Close specimen details", exact: true })
    .click();

test("cards are the default; cell topics open exact current records and return focus without expanding a row", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await enter(page);
  await expect(
    page.getByRole("button", { name: "Cards", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("article")).toHaveCount(10);
  const card = page.getByRole("article", {
    name: "SPX-2026-0481 card",
    exact: true,
  });
  await expect(card).toContainText("NSCLC, stage IV");
  await expect(card).toContainText("KRAS G12C candidate");
  await switchTable(page);
  const table = page.getByRole("table", { includeHidden: true });
  await expect(table.getByRole("columnheader")).toHaveText([
    "Specimen / patient",
    "Assay / material",
    "Sample",
    "Review",
    "Order",
    "Quality",
    "History",
    "Consent / region",
  ]);
  const record = table.locator('tr[data-specimen-id="SPX-2026-0481"]');
  await expect(record.getByRole("rowheader")).toHaveAttribute("scope", "row");
  await expect(record.getByRole("cell")).toHaveCount(7);
  const trigger = record.getByRole("button", {
    name: "SPX-2026-0481 · Quality & coverage",
    exact: true,
  });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", {
    name: "SPX-2026-0481",
    exact: true,
  });
  await expect(
    dialog.getByRole("heading", { name: "Quality & coverage", exact: true }),
  ).toBeVisible();
  await expect(dialog).toContainText("No QC flags");
  await expect(
    dialog.getByRole("button", { name: "hold", exact: true }),
  ).toHaveCount(0);
  await expect(table.locator("tbody tr")).toHaveCount(10);
  await dialog.getByRole("button", { name: "Next specimen", exact: true }).click();
  const nextDialog = page.getByRole("dialog", { name: "SPX-2026-0483", exact: true });
  await expect(nextDialog.getByRole("heading", { name: "Quality & coverage", exact: true })).toBeVisible();
  await expect(nextDialog).toContainText("off_target_elevated");
  await nextDialog.getByRole("button", { name: "Previous specimen", exact: true }).click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await record
    .getByRole("button", {
      name: "SPX-2026-0481 · Order workflow",
      exact: true,
    })
    .click();
  await dialog.getByRole("button", { name: "hold", exact: true }).click();
  await expect(record.locator('.specimen-state[data-kind="order"]')).toHaveText(
    "on hold",
  );
  await expect(
    page.getByText("orders held", { exact: true }).locator(".."),
  ).toContainText("3");
  await closeDetails(page);
  await page.getByRole("button", { name: "Cards", exact: true }).click();
  await expect(
    card.getByRole("button", { name: "→ release hold", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^Biomarkers/ }).click();
  await page.getByRole("button", { name: /^Specimens/ }).click();
  await expect(
    card.getByRole("button", { name: "→ release hold", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("shared sorting and combined filters have independent expected records and a recoverable empty result", async ({
  page,
}) => {
  await enter(page);
  await switchTable(page);
  const original = [
    "0481",
    "0483",
    "0485",
    "0486",
    "0487",
    "0489",
    "0491",
    "0493",
    "0495",
    "0497",
  ].map((id) => `SPX-2026-${id}`);
  // The accessioned dates are intentionally different from accession ID order.
  await page
    .getByRole("columnheader", { name: "History", exact: true })
    .getByRole("button")
    .click();
  await expect
    .poll(() => rowIds(page))
    .toEqual(
      [
        "0497",
        "0485",
        "0495",
        "0481",
        "0487",
        "0483",
        "0486",
        "0493",
        "0489",
        "0491",
      ].map((id) => `SPX-2026-${id}`),
    );
  await expect(
    page.getByRole("columnheader", { name: "History", exact: true }),
  ).toHaveAttribute("aria-sort", "ascending");
  await page
    .getByRole("columnheader", { name: "History", exact: true })
    .getByRole("button")
    .click();
  await expect.poll(async () => (await rowIds(page))[0]).toBe("SPX-2026-0491");
  await page
    .getByRole("columnheader", { name: "History", exact: true })
    .getByRole("button")
    .click();
  await expect.poll(() => rowIds(page)).toEqual(original);
  await page
    .getByRole("combobox", { name: "Assay", exact: true })
    .selectOption("wes");
  await page
    .getByRole("combobox", { name: "Consent", exact: true })
    .selectOption("active");
  await page
    .getByRole("combobox", { name: "Quality", exact: true })
    .selectOption("flagged");
  await expect
    .poll(() => rowIds(page))
    .toEqual(["SPX-2026-0483", "SPX-2026-0495"]);
  await page.getByRole("button", { name: "Cards", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(2);
  await page
    .getByRole("searchbox", { name: "Find a specimen" })
    .fill("PT-2119");
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(page.getByRole("article")).toHaveAttribute(
    "data-specimen-id",
    "SPX-2026-0483",
  );
  await page
    .getByRole("searchbox", { name: "Find a specimen" })
    .fill("nothing matches");
  await expect(
    page.getByText("No specimens match these filters."),
  ).toBeVisible();
  await page
    .locator(".specimen-table__empty")
    .getByRole("button", { name: "Clear filters" })
    .click();
  await expect(page.getByRole("article")).toHaveCount(10);
  await expect(
    page.getByRole("status").filter({ hasText: "10 of 10 shown" }),
  ).toBeVisible();
});

test("a held-consent cell keeps its action refused and the modal readable in Light at 1024", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await enter(page);
  await page.getByRole("radio", { name: "Light", exact: true }).check();
  await switchTable(page);
  await page
    .getByRole("combobox", { name: "Consent", exact: true })
    .selectOption("rescinded");
  const row = page.locator('tr[data-specimen-id="SPX-2026-0487"]');
  await row
    .getByRole("button", {
      name: "SPX-2026-0487 · Consent & provenance",
      exact: true,
    })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Consent rescinded — analysis held");
  await expect(dialog).toContainText("Consent Registry");
  await dialog
    .getByRole("button", { name: "Sample workflow", exact: true })
    .click();
  const before = await row
    .locator('.specimen-state[data-kind="sample"]')
    .innerText();
  await dialog
    .locator(".specimen-detail__workflow")
    .getByRole("button")
    .first()
    .click();
  await expect(row.locator('.specimen-state[data-kind="sample"]')).toHaveText(
    before,
  );
  await expect(dialog).toContainText(/consent (is )?rescinded/i);
  const bounds = await dialog.boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(1024);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(768);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await closeDetails(page);
  const scroll = page.getByRole("region", {
    name: "Specimen comparison",
    exact: true,
  });
  await scroll.evaluate((element) => {
    element.scrollLeft = element.scrollWidth;
  });
  await expect(
    row.getByRole("button", {
      name: "SPX-2026-0487 · Consent & provenance",
      exact: true,
    }),
  ).toBeInViewport();
});

test("an edit that leaves a filtered collection keeps its current modal and reduced-motion dismissal reachable", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await enter(page);
  await switchTable(page);
  await page
    .getByRole("combobox", { name: "Order state", exact: true })
    .selectOption("in_progress");
  await page
    .getByRole("button", {
      name: "SPX-2026-0481 · Order workflow",
      exact: true,
    })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "SPX-2026-0481",
    exact: true,
  });
  await dialog.getByRole("button", { name: "hold", exact: true }).click();
  await expect(dialog).toContainText("Outside current filters");
  await expect(
    dialog.getByRole("button", { name: "→ release hold", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator('tr[data-specimen-id="SPX-2026-0481"]'),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".specimen-register")).toBeFocused();
  await page.getByRole("button", { name: /Clear filters/ }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.locator(
      'tr[data-specimen-id="SPX-2026-0481"] .specimen-state[data-kind="order"]',
    ),
  ).toHaveText("on hold");
});
