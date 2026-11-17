import { test, expect } from '@playwright/test';

test('Profile changes action decisions directly while preserving accepted records and independent audience preferences', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  const openProfile = async () => {
    const close = page.getByRole('button', { name: 'Close specimen details', exact: true });
    if (await close.count()) await close.click();
    await page.getByRole('button', { name: 'Profile', exact: true }).first().click();
  };
  const chooseRole = (name) => page.getByRole('group', { name: 'Workspace role', exact: true }).getByRole('button', { name, exact: true }).click();
  const openSpecimen = async () => {
    await page.getByRole('button', { name: /^Specimens/ }).click();
    await page.getByRole('button', { name: 'Table', exact: true }).click();
    await page.getByRole('button', { name: 'SPX-2026-0489 · Order workflow', exact: true }).click();
  };
  const record = page.locator('tr[data-specimen-id="SPX-2026-0489"]');
  const details = page.getByRole('region', { name: 'SPX-2026-0489 Order workflow', exact: true });

  await openProfile();
  await expect(page.getByText('Permission scenario', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save changes', exact: true })).toHaveCount(0);
  await chooseRole('Viewer');
  await page.getByRole('combobox', { name: 'Audience perspective' }).selectOption('biopharma');
  await expect(page.getByRole('status', { name: 'Scenario action availability' })).toContainText('Viewer does not include');
  await openSpecimen();
  await details.getByRole('button', { name: 'hold', exact: true }).click();
  await expect(record.locator('.specimen-state[data-kind="order"]')).toHaveText('in progress');
  await expect(page.getByText(/Viewer does not include/).first()).toBeVisible();

  await openProfile();
  await expect(page.getByRole('combobox', { name: 'Audience perspective' })).toHaveValue('biopharma');
  await chooseRole('Lab Operator');
  await openSpecimen();
  await details.getByRole('button', { name: 'hold', exact: true }).click();
  await expect(record.locator('.specimen-state[data-kind="order"]')).toHaveText('on hold');
  await openProfile();
  await chooseRole('Viewer');
  await openSpecimen();
  await details.getByRole('button', { name: '→ release hold', exact: true }).click();
  await expect(record.locator('.specimen-state[data-kind="order"]')).toHaveText('on hold');
  expect(errors).toEqual([]);
});

test('persona membership is distinct from role and the same scenario reaches the compact Plate', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Profile', exact: true }).first().click();
  await page.getByRole('combobox', { name: 'Showcase persona' }).selectOption('prin_okafor');
  await expect(page.getByRole('status', { name: 'Scenario action availability' })).toContainText('not assigned to RES');
  await expect(page.getByRole('button', { name: 'Clinical Reviewer', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('combobox', { name: 'Showcase persona' }).selectOption('prin_self');
  await page.getByRole('group', { name: 'Workspace role' }).getByRole('button', { name: 'Viewer', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Plate', exact: true }).click();
  await page.getByText('All result stories & lifecycle policies', { exact: true }).click();
  await page.getByRole('button', { name: /^C3 VUS reanalysis/ }).click();
  const record = page.locator('.plate-compact-record');
  await record.getByRole('tab', { name: 'R1', exact: true }).click();
  await record.getByRole('button', { name: 'Files', exact: true }).click();
  const bam = record.getByRole('button', { name: 'Copy S3 URI for BAM', exact: true }).locator('..').locator('..');
  await bam.getByRole('button', { name: 'restore', exact: true }).click();
  await record.getByRole('button', { name: /^Standard 3–5 h/ }).click();
  await expect(page.getByText(/Viewer does not include/).first()).toBeVisible();
  await expect(bam).toContainText('3–5 h');
  await expect(bam).not.toContainText('≈ 4.0 h');
});
