import { test, expect } from '@playwright/test';

const openProfile = (page) => page.getByRole('button', { name: 'Profile', exact: true }).first().click();
const profileSections = (page) => page.getByRole('navigation', { name: 'Profile sections' });
const chooseRole = (page, name) => page.getByRole('group', { name: 'Workspace role', exact: true }).getByRole('button', { name, exact: true }).click();
const plateGrant = (page) => page.getByRole('button', { name: /^Plate Map · US East ·/ });
const resetGrants = (page) => page.getByRole('button', { name: 'Reset scenario grants', exact: true });
const bamFor = (record) => record.getByRole('button', { name: 'Copy S3 URI for BAM', exact: true }).locator('..').locator('..');

test('resetting scenario grants restores the selected cached history while accepted work stays in place', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors = [];
  let reads = 0;
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/graphql', async (route) => {
    const id = route.request().postDataJSON().variables.id;
    if (id === 'C3') reads++;
    const response = await route.fetch();
    const body = await response.json();
    if (id === 'C3' && body.data?.well) {
      body.data.dataSource.mode = 'STORED';
      for (const { node } of body.data.well.history.edges) node.title = `Retained stored history ${node.label}`;
    }
    await route.fulfill({ response, json: body });
  });
  await page.goto('/');
  await openProfile(page);
  // The initial permitted read belongs to the same Administrator scope that reset restores.
  await chooseRole(page, 'Administrator');
  await page.getByRole('combobox', { name: 'Audience perspective' }).selectOption('biopharma');

  await page.getByRole('button', { name: /^Specimens/ }).click();
  const specimen = page.getByRole('article', { name: 'SPX-2026-0481 card', exact: true });
  await specimen.getByRole('button', { name: 'hold', exact: true }).click();
  await expect(specimen.getByRole('button', { name: '→ release hold', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /^Lanes/ }).click();
  await page.getByRole('button', { name: 'plate', exact: true }).click();
  await page.getByRole('button', { name: /^C3 VUS reanalysis/ }).first().click();
  const record = page.locator('[data-result-tray]');
  await expect(record).toContainText('Retained stored history');
  await record.getByRole('tab', { name: 'R1', exact: true }).click();
  await bamFor(record).getByRole('button', { name: 'restore', exact: true }).click();
  await record.getByRole('button', { name: /^Standard 3–5 h/ }).click();
  await record.getByRole('tab', { name: 'R2', exact: true }).click();
  await expect(bamFor(record)).toContainText('≈ 4.0 h');

  await openProfile(page);
  await profileSections(page).getByRole('button', { name: 'Access Grid', exact: true }).click();
  await expect(resetGrants(page)).toBeDisabled();
  await expect(plateGrant(page)).toHaveAccessibleName('Plate Map · US East · write');
  await plateGrant(page).click();
  await page.getByRole('button', { name: 'Save grants', exact: true }).click();
  await page.getByRole('button', { name: /^Lanes/ }).click();
  await expect(page.getByRole('button', { name: /^C3 VUS reanalysis/ })).toHaveCount(0);
  await expect(page.getByText(/Retained stored history/)).toHaveCount(0);
  await expect(page.locator('.plate-history-source').first()).toHaveAttribute('data-history-phase', 'denied');

  await openProfile(page);
  await profileSections(page).getByRole('button', { name: 'Access Grid', exact: true }).click();
  await expect(resetGrants(page)).toBeEnabled();
  await resetGrants(page).click();
  await expect(plateGrant(page)).toHaveAccessibleName('Plate Map · US East · write');
  await expect(resetGrants(page)).toBeDisabled();
  await expect(page.getByRole('combobox', { name: 'Inspect access for' })).toHaveValue('prin_self');
  await expect(page.getByRole('button', { name: 'requested grants', exact: true })).toBeVisible();
  await expect(page.getByText('Acting as Platform Lead · Administrator · RES', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /^Lanes/ }).click();
  await expect(record).toContainText('Retained stored history R2');
  await expect(record.getByRole('tab', { name: 'R2', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(record.getByRole('button', { name: 'pinned', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(bamFor(record)).toContainText('≈ 4.0 h');
  await expect(page.locator('.plate-history-source')).toHaveAttribute('data-history-source', 'STORED');
  expect(reads).toBe(1);
  await page.getByRole('button', { name: /^Specimens/ }).click();
  await expect(specimen.getByRole('button', { name: '→ release hold', exact: true })).toBeVisible();
  await openProfile(page);
  await profileSections(page).getByRole('button', { name: 'Profile', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Showcase persona' })).toHaveValue('prin_self');
  await expect(page.getByRole('button', { name: 'Administrator', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('combobox', { name: 'Audience perspective' })).toHaveValue('biopharma');
  await expect(page.getByRole('button', { name: /^RES ·/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test('reset clears all accepted grants and the open draft, retaining inspection and read-only scenario choices', async ({ page }) => {
  await page.goto('/');
  await page.locator('#initial-load').waitFor({ state: 'hidden' });
  await openProfile(page);
  await chooseRole(page, 'Administrator');
  await profileSections(page).getByRole('button', { name: 'Access Grid', exact: true }).click();
  const inspect = page.getByRole('combobox', { name: 'Inspect access for' });
  const save = page.getByRole('button', { name: 'Save grants', exact: true });
  // Save one person's change, then leave another person's draft open in effective view.
  await plateGrant(page).click();
  await save.click();
  await inspect.selectOption('prin_okafor');
  await expect(plateGrant(page)).toHaveAccessibleName('Plate Map · US East · none');
  await plateGrant(page).click();
  await expect(plateGrant(page)).toHaveAccessibleName('Plate Map · US East · read');
  await page.getByRole('button', { name: 'requested grants', exact: true }).click();
  await resetGrants(page).click();
  await expect(inspect).toHaveValue('prin_okafor');
  await expect(page.getByRole('button', { name: 'effective scope in RES', exact: true })).toBeVisible();
  await expect(save).toBeDisabled();
  await expect(resetGrants(page)).toBeDisabled();
  await page.getByRole('button', { name: 'effective scope in RES', exact: true }).click();
  await expect(plateGrant(page)).toHaveAccessibleName('Plate Map · US East · none');
  await inspect.selectOption('prin_self');
  await expect(plateGrant(page)).toHaveAccessibleName('Plate Map · US East · write');

  // Recovery remains available after role/environment changes make grant editing unavailable.
  await inspect.selectOption('prin_okafor');
  await plateGrant(page).click();
  await save.click();
  await profileSections(page).getByRole('button', { name: 'Profile', exact: true }).click();
  await chooseRole(page, 'Viewer');
  await page.getByRole('combobox', { name: 'Audience perspective' }).selectOption('biopharma');
  await page.getByRole('button', { name: /^RES ·/ }).click();
  await page.getByRole('option', { name: /^VAL / }).click();
  await profileSections(page).getByRole('button', { name: 'Access Grid', exact: true }).click();
  await inspect.selectOption('prin_okafor');
  await expect(plateGrant(page)).toHaveAccessibleName('Plate Map · US East · read');
  await page.getByRole('button', { name: 'requested grants', exact: true }).click();
  await expect(save).toBeDisabled();
  await expect(resetGrants(page)).toBeEnabled();
  // Dismiss the accepted-action notices through their close controls before inspecting the footer.
  for (const title of ['Scenario grants saved', 'Example grants restored']) {
    const notices = page.getByText(title, { exact: true });
    while (await notices.count()) {
      await notices.first().locator('..').locator('..').getByRole('button').click();
    }
  }
  await resetGrants(page).scrollIntoViewIfNeeded();
  await page.screenshot({ path: '.visual-runs/scenario-grant-reset-footer.png' });
  await resetGrants(page).click();
  await expect(inspect).toHaveValue('prin_okafor');
  await expect(page.getByRole('button', { name: 'effective scope in VAL', exact: true })).toBeVisible();
  await expect(resetGrants(page)).toBeDisabled();
  await expect(page.getByText('Acting as Platform Lead · Viewer · VAL', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'effective scope in VAL', exact: true }).click();
  await expect(plateGrant(page)).toHaveAccessibleName('Plate Map · US East · none');
  await profileSections(page).getByRole('button', { name: 'Profile', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Showcase persona' })).toHaveValue('prin_self');
  await expect(page.getByRole('button', { name: 'Viewer', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('combobox', { name: 'Audience perspective' })).toHaveValue('biopharma');
  await expect(page.getByRole('button', { name: /^VAL ·/ })).toBeVisible();
});
