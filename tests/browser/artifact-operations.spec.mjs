import { test, expect } from "@playwright/test";

const openArtifact = async (page) => {
  await page.getByRole("button", { name: /^Artifacts/ }).click();
  await page.locator('[data-record-id="arc01_pass1"]').click();
};

test("local artifact checks and revision proposals remain distinct from recorded evidence across projections and navigation", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: /^Sources/ }).click();
  await page.locator('[data-record-id="notion_fragment"]').click();
  const sourceDetails = page.getByLabel("Source details", { exact: true });
  await sourceDetails.getByRole("button", { name: "Edit metadata" }).click();
  await sourceDetails
    .getByLabel("Display title", { exact: true })
    .fill("Accepted intake brief");
  await sourceDetails.getByRole("button", { name: "Save metadata" }).click();
  await openArtifact(page);
  const work = page.getByRole("region", { name: "Local artifact work" });
  await work
    .getByRole("button", { name: "Check local references", exact: true })
    .click();
  await expect(work.getByRole("status")).toHaveText("3/3 local checks passed");
  await expect(
    work.getByText("Accepted intake brief", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("DRAGEN and GATK resolve different GRCh37/38 builds", {
      exact: true,
    }),
  ).toBeVisible();
  await work
    .getByRole("button", { name: "Prepare revision", exact: true })
    .click();
  await work
    .getByLabel("Proposal title", { exact: true })
    .fill("Review regional deployment");
  await work
    .getByRole("textbox", { name: "Planned change", exact: true })
    .fill("Compare the regional network requirements.");
  await work
    .getByRole("button", { name: "Save proposal", exact: true })
    .click();
  await expect(page.locator('[data-record-id="arc01_pass1"]')).toContainText(
    "Proposal: Review regional deployment",
  );
  await expect(
    page.locator('[data-record-id="arc01_pass2"]'),
  ).not.toContainText("Proposal:");
  await page.getByRole("button", { name: "lineage", exact: true }).click();
  await expect(
    page.getByText(/derived from: Accepted intake brief/),
  ).toBeVisible();
  await expect(
    page.getByText("Proposal: Review regional deployment", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "comparison", exact: true }).click();
  await expect(
    page.getByText("Proposal: Review regional deployment", { exact: true }),
  ).toBeVisible();
  const pinning = page
    .getByRole("row")
    .filter({ hasText: "Reference bundle pinned" });
  await expect(pinning.getByTitle("fail")).toHaveCount(1);
  await expect(pinning.getByTitle("pass")).toHaveCount(4);
  await page.getByRole("button", { name: /^Sources/ }).click();
  await openArtifact(page);
  await expect(work.getByLabel("Proposal title", { exact: true })).toHaveValue(
    "Review regional deployment",
  );
  await expect(work.getByRole("status")).toHaveText("3/3 local checks passed");
  await page.locator("#initial-load").waitFor({ state: "hidden" });
  await page.locator(".deferred-reveal").waitFor({ state: "hidden" });
  await page.screenshot({ path: ".visual-runs/artifact-proposal.png" });
  await page.getByRole("radio", { name: "Light", exact: true }).click();
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.screenshot({ path: ".visual-runs/artifact-proposal-light.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("button", { name: "Corridor", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 1512, height: 982 });
  await openArtifact(page);
  await expect(work.getByLabel("Proposal title", { exact: true })).toHaveValue(
    "Review regional deployment",
  );
  await work
    .getByRole("button", { name: "Discard proposal", exact: true })
    .click();
  await expect(
    work.getByRole("button", { name: "Prepare revision", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator('[data-record-id="arc01_pass1"]'),
  ).not.toContainText("Proposal:");
  await expect(
    page.getByText("Recorded acceptance checks", { exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("read-only environment refuses proposal and local-check commands without changing the artifact", async ({
  page,
}) => {
  await page.goto("/");
  await openArtifact(page);
  await page.getByRole("button", { name: /RES.*us-west/ }).click();
  await page.getByRole("option", { name: /PROD.*Production/ }).click();
  const work = page.getByRole("region", { name: "Local artifact work" });
  await work
    .getByRole("button", { name: "Prepare revision", exact: true })
    .click();
  await expect(
    page.getByText(/Update revision proposal blocked/),
  ).toBeVisible();
  await expect(
    work.getByRole("form", { name: "Revision proposal" }),
  ).toHaveCount(0);
  await work
    .getByRole("button", { name: "Check local references", exact: true })
    .click();
  await expect(
    page.getByText(/Check artifact references blocked/),
  ).toBeVisible();
  await expect(work.getByRole("status")).toHaveCount(0);
});
