import { test, expect } from "@playwright/test";

test("QC retains a gate disposition, leaves failed measurements held, and gates recovery", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#initial-load").waitFor({ state: "hidden" });
  await page.getByRole("button", { name: /^Quality Control/ }).click();
  const gate = page.locator('[data-gate-id="qcg_run"]');
  await gate
    .getByRole("button", { name: "Request rerun", exact: true })
    .click();
  await expect(gate.getByRole("status")).toHaveText("Rerun requested");
  await expect(
    page.getByText("Run held — blocking gate failed", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("· 1 of 4 reviews recorded", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Map", exact: true }).click();
  await page.getByRole("button", { name: /^Quality Control/ }).click();
  await expect(gate.getByRole("status")).toHaveText("Rerun requested");
  await gate
    .getByRole("button", { name: "Reopen review", exact: true })
    .click();
  await gate.getByRole("button", { name: "Keep on hold", exact: true }).click();
  await expect(gate.getByRole("status")).toHaveText("Hold recorded");
  await page.getByRole("button", { name: "Profile", exact: true }).click();
  await page
    .getByRole("group", { name: "Workspace role" })
    .getByRole("button", { name: "Viewer", exact: true })
    .click();
  await page.getByRole("button", { name: /^Quality Control/ }).click();
  await gate
    .getByRole("button", { name: "Reopen review", exact: true })
    .click();
  await expect(page.getByText(/Viewer does not include/).first()).toBeVisible();
  await expect(gate.getByRole("status")).toHaveText("Hold recorded");
  await page.screenshot({ path: ".visual-runs/qc-retained-review.png" });
});
