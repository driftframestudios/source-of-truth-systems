import { test, expect } from "@playwright/test";

test("specimen cards and expanded quality distinguish an at-most rate from an at-least coverage target", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Specimens/ }).click();
  const card = page.getByRole("article", {
    name: "SPX-2026-0483 card",
    exact: true,
  });
  const duplication = card
    .locator(".specimen-coverage")
    .filter({ hasText: "Dup rate" });
  await expect(duplication).toHaveAttribute("data-met", "true");
  await expect(duplication).toContainText("22% · Target at most 30%");
  await expect(
    card.locator(".specimen-coverage").filter({ hasText: "Mean target cov" }),
  ).toHaveAttribute("data-met", "false");
  await page.getByRole("button", { name: "Table", exact: true }).click();
  await page
    .getByRole("button", {
      name: "SPX-2026-0483 · Quality & coverage",
      exact: true,
    })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "SPX-2026-0483",
    exact: true,
  });
  const metrics = dialog.locator(".specimen-coverage");
  await expect(metrics.filter({ hasText: "Dup rate" })).toContainText(
    "Target at most 30%",
  );
  await expect(metrics.filter({ hasText: "Mean target cov" })).toContainText(
    "Target at least 80×",
  );
  await expect(metrics.filter({ hasText: "Q30" })).toContainText(
    "Target at least 90%",
  );
  const colors = await metrics.evaluateAll((elements) =>
    elements.map(
      (element) =>
        getComputedStyle(
          element.querySelector(".specimen-coverage__track > span"),
        ).backgroundColor,
    ),
  );
  expect(colors[1]).toBe(colors[2]);
  expect(colors[0]).not.toBe(colors[2]);
  await expect(dialog).toContainText("off_target_elevated");
});
