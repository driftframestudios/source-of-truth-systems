import { test, expect } from "@playwright/test";

test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});

test("mobile overview reveals an exact record and retains filters through navigation and rotation", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Explore", exact: true }).click();
  await page.getByRole("button", { name: "All lanes", exact: true }).click();
  await page.getByRole("searchbox").fill("Sample Intake");
  await page
    .getByRole("button", { name: "Show corridor", exact: true })
    .click();
  await expect(page.locator(".mobile-corridor-step")).toHaveCount(1);
  await page
    .getByRole("button", { name: /Process.*Sample Intake.*View record/ })
    .click();
  await page.getByRole("button", { name: "sources Genomics program brief" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Genomics program brief",
    }),
  ).toBeVisible();
  await expect(page.locator(".mobile-reference-record")).toBeFocused();
  await page.getByRole("button", { name: "Back to workflow record" }).click();
  await expect(
    page.getByRole("heading", { name: "Sample Intake", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close step details" }).click();
  await page.getByRole("button", { name: "Plate", exact: true }).click();
  await page.getByRole("button", { name: "Corridor", exact: true }).click();
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(
    page.getByRole("heading", { name: "Workflow overview" }),
  ).toBeVisible();
  await expect(page.locator(".mobile-corridor-step")).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    844,
  );
  expect(errors).toEqual([]);
});

test("travel stops rendering when Corridor is hidden and resumes on return", async ({
  page,
}) => {
  await page.goto("/");
  const scene = page
    .locator(".mobile-corridor-canvas > div")
    .nth(1)
    .locator(":scope > div");
  await page.getByRole("button", { name: "Start corridor travel" }).click();
  const starting = await scene.getAttribute("style");
  await expect.poll(() => scene.getAttribute("style")).not.toBe(starting);
  await page.getByRole("button", { name: "Plate", exact: true }).click();
  const hidden = await scene.getAttribute("style");
  await page.waitForTimeout(150);
  expect(await scene.getAttribute("style")).toBe(hidden);
  await page.getByRole("button", { name: "Corridor", exact: true }).click();
  await expect.poll(() => scene.getAttribute("style")).not.toBe(hidden);
  await page.getByRole("button", { name: "Stop corridor travel" }).click();
});
