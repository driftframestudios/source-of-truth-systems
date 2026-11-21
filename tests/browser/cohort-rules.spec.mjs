import { test, expect } from "@playwright/test";

const openBuilder = (page) =>
  page.getByRole("button", { name: "Cohort Builder", exact: true }).click();
const savedRule = (page, name) =>
  page.getByRole("button", { name: `Open rule ${name}`, exact: true });

test('the draft canvas preserves its bounded rule when another card would exceed the limit', async ({page}) => {
  test.setTimeout(60000);
  await page.goto('/');
  await openBuilder(page);
  await page.getByRole('button',{name:'Clear canvas',exact:true}).click();
  const add = page.getByTitle('Add Order workflow on_hold to the focused group',{exact:true});
  for (let index = 0; index < 127; index++) await add.click();
  await expect(page.getByText('127 predicates',{exact:true})).toBeVisible();
  await add.click();
  await expect(page.getByRole('status',{name:'Cohort rule result'})).toContainText('within 128 cards and 8 nested levels');
  await expect(page.getByText('127 predicates',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Save rule',exact:true}).click();
  await expect(page.getByRole('status',{name:'Cohort rule result'})).toContainText('Rule saved');
});

test("saved rules reopen across views and resize, update, copy and remove with current counts", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await openBuilder(page);
  await page.getByRole("button", { name: "Clear canvas", exact: true }).click();
  await page
    .getByTitle("Add Order workflow on_hold to the focused group", {
      exact: true,
    })
    .click();
  await page
    .getByRole("textbox", { name: "Rule name", exact: true })
    .fill("Orders on hold");
  await page.getByRole("button", { name: "Save rule", exact: true }).click();
  const saved = savedRule(page, "Orders on hold");
  const before = await saved.textContent();
  const initialEligible = Number(before.match(/(\d+) eligible/)[1]);
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Rule saved for this browser session." }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^Specimens/ }).click();
  const specimen = page.getByRole("article", {
    name: "SPX-2026-0481 card",
    exact: true,
  });
  await specimen.getByRole("button", { name: "hold", exact: true }).click();
  await expect(
    specimen.getByRole("button", { name: "→ release hold", exact: true }),
  ).toBeVisible();
  await openBuilder(page);
  await expect(saved).toContainText(`${initialEligible + 1} eligible`);
  await saved.click();
  await expect(
    page.getByRole("textbox", { name: "Rule name", exact: true }),
  ).toHaveValue("Orders on hold");
  await page
    .getByRole("textbox", { name: "Rule name", exact: true })
    .fill("Held orders to review");
  await page.getByRole("button", { name: "Update rule", exact: true }).click();
  await expect(saved).toHaveCount(0);
  await expect(savedRule(page, "Held orders to review")).toHaveCount(1);
  await page
    .getByRole("textbox", { name: "Rule name", exact: true })
    .fill("Held order copy");
  await page.getByRole("button", { name: "Save a copy", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.setViewportSize({ width: 1512, height: 982 });
  await openBuilder(page);
  await expect(savedRule(page, "Held orders to review")).toContainText(
    `${initialEligible + 1} eligible`,
  );
  await expect(savedRule(page, "Held order copy")).toBeVisible();
  await page
    .getByRole("button", { name: "Remove rule Held order copy", exact: true })
    .click();
  await expect(savedRule(page, "Held order copy")).toHaveCount(0);
  await savedRule(page, "Held orders to review").click();
  await expect(page.locator(".plate-loading")).toHaveCount(0);
  await page.screenshot({ path: ".visual-runs/cohort-retained-desktop.png" });
  await page
    .getByRole("button", {
      name: "Remove rule Held orders to review",
      exact: true,
    })
    .click();
  await expect(savedRule(page, "Held orders to review")).toHaveCount(0);
  await expect(
    page.getByRole("textbox", { name: "Rule name", exact: true }),
  ).toHaveValue("Held orders to review");
  await expect(
    page.getByRole("button", { name: "Save rule", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("denied saves preserve the open rule and consent-held matches remain ineligible", async ({
  page,
}) => {
  await page.goto("/");
  await openBuilder(page);
  await page
    .getByRole("button", { name: "Governance holds", exact: true })
    .click();
  await page.getByRole("button", { name: "Save rule", exact: true }).click();
  await expect(savedRule(page, "Governance holds")).toContainText("0 eligible");
  await page
    .getByRole("textbox", { name: "Rule name", exact: true })
    .fill("Retained draft");
  await page.getByRole("button", { name: /^RES ·/ }).click();
  await page.getByRole("option", { name: /^VAL/ }).click();
  await page.getByRole("button", { name: "Update rule", exact: true }).click();
  await expect(
    page.getByRole("status", { name: "Cohort rule result" }),
  ).toContainText("Write actions are disabled");
  await expect(
    page.getByRole("textbox", { name: "Rule name", exact: true }),
  ).toHaveValue("Retained draft");
  await expect(savedRule(page, "Governance holds")).toBeVisible();
  await page
    .getByRole("button", { name: "Remove rule Governance holds", exact: true })
    .click();
  await expect(savedRule(page, "Governance holds")).toBeVisible();
  await page.getByRole("button", { name: /^VAL ·/ }).click();
  await page.getByRole("option", { name: /^RES/ }).click();
  await page.getByRole("button", { name: "Update rule", exact: true }).click();
  await expect(savedRule(page, "Retained draft")).toContainText("0 eligible");
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(page.locator(".plate-loading")).toHaveCount(0);
  await page.screenshot({ path: ".visual-runs/cohort-retained-1024.png" });
  await page.reload();
  await openBuilder(page);
  await expect(savedRule(page, "Retained draft")).toHaveCount(0);
});


test('removing an ancestor reconciles focus before the next palette action', async ({page}) => {
  await page.goto('/');
  await openBuilder(page);
  const root = page.locator('[data-cohort-group="root"]');
  const seedGroup = root.locator('[data-cohort-group]').first();
  await seedGroup.getByRole('checkbox', {name:'Select group for linking',exact:true}).check();
  await root.getByRole('checkbox', {name:'Select Consent card for linking',exact:true}).last().check();
  await page.getByRole('button',{name:'Link AND',exact:true}).click();
  const outer = root.locator('[data-cohort-group]').first();
  const inner = outer.locator('[data-cohort-group]').first();
  await inner.getByRole('textbox',{name:'Group label',exact:true}).click();
  await expect(inner).toHaveAttribute('data-focused','true');
  await inner.getByRole('checkbox',{name:'Select group for linking',exact:true}).check();
  await outer.getByTitle('Remove group',{exact:true}).first().click();
  await expect(root).toHaveAttribute('data-focused','true');
  await expect(page.getByText('0 selected',{exact:true})).toBeVisible();
  await page.getByTitle('Add Order workflow on_hold to the focused group',{exact:true}).click();
  await expect(page.getByText('2 predicates',{exact:true})).toBeVisible();
  await expect(root.getByRole('combobox').last()).toHaveValue('on_hold');
  await expect(page.locator('.plate-loading')).toHaveCount(0);
  await page.screenshot({path:'.visual-runs/cohort-focus-desktop.png'});
  await page.setViewportSize({width:1024,height:768});
  await expect(root).toBeVisible();
  await page.screenshot({path:'.visual-runs/cohort-focus-compact.png'});
});
