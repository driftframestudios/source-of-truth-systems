import { test, expect } from "@playwright/test";

test("bounded links open the real plate and small adjustments retain one history entry", async ({
  page,
}) => {
  await page.goto(
    "/?scene=plate&plate=history&lens=storage&role=admin&draft=untrusted",
  );
  await expect(page.locator("[data-plate-phase]")).toHaveAttribute(
    "data-plate-phase",
    "locked",
  );
  await expect(
    page
      .getByRole("radiogroup", { name: "Lens", exact: true })
      .getByRole("radio", { name: "Storage", exact: true }),
  ).toHaveAttribute("aria-checked", "true");
  await expect(page).toHaveURL(/\?scene=plate&plate=history&lens=storage$/);
  const entries = await page.evaluate(() => history.length);
  await page
    .getByRole("radiogroup", { name: "Lens", exact: true })
    .getByRole("radio", { name: "Status", exact: true })
    .click();
  await expect(page).toHaveURL(/\?scene=plate&plate=history$/);
  expect(await page.evaluate(() => history.length)).toBe(entries);
  expect(await page.evaluate(() => history.state)).toBeNull();
  await page.reload();
  await expect(page.locator("[data-plate-phase]")).toHaveAttribute(
    "data-plate-phase",
    "locked",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("[data-plate-phase]")).toHaveAttribute(
    "data-plate-phase",
    "locked",
  );
  await page.setViewportSize({ width: 1512, height: 982 });
  await expect(
    page
      .getByRole("radiogroup", { name: "Lens", exact: true })
      .getByRole("radio", { name: "Status", exact: true }),
  ).toHaveAttribute("aria-checked", "true");
});

test("Back and responsive handoff retain an unsaved Source draft while accepted metadata stays separate", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Sources/ }).click();
  await page.locator('[data-record-id="yaml_context"]').click();
  const details = page.getByLabel("Source details", { exact: true });
  await details
    .getByRole("button", { name: "Edit metadata", exact: true })
    .click();
  const editor = details.getByRole("form", { name: "Edit source metadata" });
  await editor
    .getByLabel("Display title", { exact: true })
    .fill("Unfinished pipeline title");
  await editor
    .getByRole("textbox", { name: "Summary", exact: true })
    .fill("Keep this unsaved summary while exploring.");
  await page.getByRole("button", { name: /^Lanes/ }).click();
  await expect(page).not.toHaveURL(/section=sources/);
  await page.goBack();
  await expect(page).toHaveURL(/section=sources/);
  await expect(editor.getByLabel("Display title", { exact: true })).toHaveValue(
    "Unfinished pipeline title",
  );
  await expect(
    details.getByRole("heading", {
      name: "Pipeline configuration manifest",
      exact: true,
    }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("button", { name: "Corridor", exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/section=sources/);
  await page.setViewportSize({ width: 1512, height: 982 });
  await expect(
    editor.getByRole("textbox", { name: "Summary", exact: true }),
  ).toHaveValue("Keep this unsaved summary while exploring.");
  await page.goForward();
  await expect(page).not.toHaveURL(/section=sources/);
  await page.goBack();
  await expect(editor.getByLabel("Display title", { exact: true })).toHaveValue(
    "Unfinished pipeline title",
  );
  expect(await page.evaluate(() => history.state)).toBeNull();
  expect(page.url()).not.toContain("Unfinished");
  await editor
    .getByRole("button", { name: "Save metadata", exact: true })
    .click();
  await expect(editor).toHaveCount(0);
  await expect(
    details.getByRole("heading", {
      name: "Unfinished pipeline title",
      exact: true,
    }),
  ).toBeVisible();
  await page.screenshot({
    path: ".visual-runs/shareable-navigation-source.png",
    animations: "disabled",
  });
});

test("Back takes control before a pending guided history response arrives", async ({
  page,
}) => {
  let release, observed, completed;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const requested = new Promise((resolve) => {
    observed = resolve;
  });
  const delivered = new Promise((resolve) => {
    completed = resolve;
  });
  await page.route("**/graphql", async (route) => {
    const response = await route.fetch();
    observed();
    await gate;
    await route.fulfill({ response }).catch(() => {});
    completed();
  });
  try {
    await page.goto("/?section=sources");
    await page.getByRole("button", { name: "Guide", exact: true }).click();
    await page
      .getByRole("button", { name: "Why was this result revisited?" })
      .click();
    await requested;
    const guide = page.getByRole("region", { name: "Follow a sample guide" });
    await expect(guide).toContainText("Opening the view");
    await expect(page).toHaveURL(/scene=plate/);
    await page.goBack();
    await expect(page).toHaveURL(/section=sources/);
    await expect(guide).toHaveCount(0);
    release();
    await delivered;
    await expect(
      page.getByRole("region", { name: "Source registry", exact: true }),
    ).toBeVisible();
    await expect(page.locator("[data-plate-phase]")).toHaveCount(0);
    await expect(guide).toHaveCount(0);
  } finally {
    release();
  }
});
