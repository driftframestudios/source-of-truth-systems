import { test, expect } from "@playwright/test";

test("comparison decisions survive navigation, preserve other records, and can return to review", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: /^Comparisons/ }).click();
  const selected = page.getByRole("region", {
    name: "Pipeline Stage Bound to LIMS Specimen State",
    exact: true,
  });
  const other = page.getByRole("region", {
    name: "Provenance Record Capture",
    exact: true,
  });
  const summary = page.getByLabel("Comparison summary");
  await expect(summary).toContainText("2 pending");
  const proposal = await selected
    .getByText(/Release 02 primary task/)
    .textContent();
  await selected.getByRole("button", { name: "Resolve", exact: true }).click();
  await expect(selected.getByRole("status")).toHaveText("Resolved");
  await expect(summary).toContainText("4 resolved");
  await expect(other.getByRole("status")).toHaveText("Pending");
  await expect(selected.getByText(proposal, { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Source vs Source", exact: true })
    .click();
  await expect(selected).toHaveCount(0);
  await page.getByRole("button", { name: "All Modes", exact: true }).click();
  await selected.getByRole("button", { name: "Reopen", exact: true }).click();
  await selected.getByRole("button", { name: "Defer", exact: true }).click();
  await expect(selected.getByRole("status")).toHaveText("Deferred");
  await expect(summary).toContainText("1 deferred");
  await page.getByRole("button", { name: /^Sources/ }).click();
  await page.getByRole("button", { name: /^Comparisons/ }).click();
  await expect(selected.getByRole("status")).toHaveText("Deferred");
  await expect(other.getByRole("status")).toHaveText("Pending");
  await selected.getByRole("button", { name: "Reopen", exact: true }).click();
  await expect(selected.getByRole("status")).toHaveText("Pending");
  await expect(summary).toContainText("0 deferred");
  await expect(summary).toContainText("2 pending");
  await page.screenshot({ path: ".visual-runs/comparison-actions.png" });
  expect(errors).toEqual([]);
});

test("a read-only environment refuses a comparison command and keeps the record pending", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Comparisons/ }).click();
  const selected = page.getByRole("region", {
    name: "Pipeline Stage Bound to LIMS Specimen State",
    exact: true,
  });
  await page.getByRole("button", { name: /RES.*us-west/ }).click();
  await page.getByRole("option", { name: /PROD.*Production/ }).click();
  await selected.getByRole("button", { name: "Resolve", exact: true }).click();
  await expect(selected.getByRole("status")).toHaveText("Pending");
  await expect(page.getByText(/Resolve comparison blocked/)).toBeVisible();
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(page.getByLabel("Comparison summary")).toContainText(
    "2 pending",
  );
  await selected.scrollIntoViewIfNeeded();
  const geometry = await selected.evaluate((element) => ({
    width: element.scrollWidth,
    available: element.clientWidth,
    right: element.getBoundingClientRect().right,
  }));
  expect(geometry.width).toBeLessThanOrEqual(geometry.available + 1);
  expect(geometry.right).toBeLessThanOrEqual(1024);
});
