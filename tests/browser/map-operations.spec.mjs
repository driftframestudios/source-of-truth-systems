import { test, expect } from "@playwright/test";

test("Map retains legal workflow branches through navigation and refuses a later Viewer edit", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#initial-load").waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "Map", exact: true }).click();
  const graph = page.getByRole("region", {
    name: "Source relationship graph",
    exact: true,
  });
  const selectPipeline = () =>
    graph.getByText("Pipeline Orchestrator", { exact: true }).click();
  await selectPipeline();
  const order = page.getByRole("group", {
    name: "order workflow",
    exact: true,
  });
  await order.getByRole("button", { name: "→ hold", exact: true }).click();
  await expect(
    order.getByRole("button", { name: "→ release hold", exact: true }),
  ).toBeVisible();
  await expect(
    order.getByRole("button", { name: "→ fulfilled", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: /^Quality Control/ }).click();
  await page.getByRole("button", { name: "Map", exact: true }).click();
  await selectPipeline();
  await expect(
    order.getByRole("button", { name: "→ release hold", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Profile", exact: true }).click();
  await page
    .getByRole("group", { name: "Workspace role" })
    .getByRole("button", { name: "Viewer", exact: true })
    .click();
  await page.getByRole("button", { name: "Map", exact: true }).click();
  await selectPipeline();
  await order
    .getByRole("button", { name: "→ release hold", exact: true })
    .click();
  await expect(page.getByText(/Viewer does not include/).first()).toBeVisible();
  await expect(
    order.getByRole("button", { name: "→ release hold", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: ".visual-runs/map-retained-workflow.png" });
});
