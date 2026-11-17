import { test, expect } from '@playwright/test';

// A cached allowed record must leave every receiving surface on scope downgrade.
test('Plate scope removes selected details and stories, then restores the permitted cache across layouts', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let reads = 0;
  await page.route('**/graphql', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    if (route.request().postDataJSON().variables.id === 'C3' && body.data?.well) {
      reads++;
      body.data.dataSource.mode = 'STORED';
      for (const { node } of body.data.well.history.edges) node.title = `Scoped stored result ${node.label}`;
    }
    await route.fulfill({ response, json: body });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'plate', exact: true }).click();
  await page.getByRole('button', { name: /^C3 VUS reanalysis/ }).first().click();
  const record = page.locator('[data-result-tray]');
  await expect(record).toContainText('Scoped stored result');
  await page.getByRole('button', { name: /RES.*us-west/ }).click();
  await page.getByRole('option', { name: /PROD.*Production/ }).click();
  await expect(page.locator('.plate-history-source').first()).toHaveAttribute('data-history-phase', 'denied');
  await expect(page.getByText(/Scoped stored result/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^C3 VUS reanalysis/ })).toHaveCount(0);
  await expect(page.locator('[data-result-id]')).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.plate-history-source').first()).toHaveAttribute('data-history-phase', 'denied');
  await expect(page.getByText(/Scoped stored result/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^C3 VUS reanalysis/ })).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Plate environment' }).selectOption('res');
  await expect(page.locator('.plate-compact-record')).toContainText('Scoped stored result');
  await page.setViewportSize({ width: 1512, height: 982 });
  await expect(record).toContainText('Scoped stored result');
  expect(reads).toBe(1);
});

test('accepted Access Grid changes reach Plate reads and survive a return to the grid', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await page.getByRole('group', { name: 'Workspace role' }).getByRole('button', { name: 'Administrator', exact: true }).click();
  await page.getByRole('button', { name: 'Access Grid', exact: true }).click();
  await expect(page.getByRole('button', { name: 'requested grants', exact: true })).toBeVisible();
  const grant = page.getByRole('button', { name: /^Plate Map · US East ·/ });
  await expect(grant).toHaveAccessibleName('Plate Map · US East · write');
  await grant.click();
  await page.getByRole('button', { name: 'Save grants', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save grants', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: /^Lanes/ }).click();
  await page.getByRole('button', { name: 'plate', exact: true }).click();
  await expect(page.getByRole('button', { name: /^C3 VUS reanalysis/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^A9 / })).toBeVisible();

  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await page.getByRole('button', { name: 'Access Grid', exact: true }).click();
  await expect(page.getByRole('button', { name: 'requested grants', exact: true })).toBeVisible();
  await expect(grant).toHaveAccessibleName('Plate Map · US East · none');
  await grant.click();
  await page.getByRole('button', { name: 'Save grants', exact: true }).click();
  await page.getByRole('button', { name: /^Lanes/ }).click();
  await expect(page.getByRole('button', { name: /^C3 VUS reanalysis/ })).toBeVisible();
});
