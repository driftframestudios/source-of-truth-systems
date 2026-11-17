import { test, expect } from '@playwright/test';

// The anchor labels must follow an explored camera, rather than the initial preset.
test('sample history can be explored while its selected record and color key remain coherent', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'plate', exact: true }).click();
  await expect(page.locator('.plate-lens-legend')).toContainText('Reportable');
  await page.getByRole('radio', { name: 'Why', exact: true }).click();
  await expect(page.locator('.plate-lens-legend')).toContainText('Reanalysis');
  await page.getByRole('button', { name: /^C3 / }).first().click();
  const scene = page.locator('[data-plate-phase]');
  await expect(scene).toHaveAttribute('data-plate-phase', 'locked');
  await expect(page.locator('.plate-history-badge')).toContainText('Timeline view');
  await expect(page.locator('.plate-history-badge')).toContainText('Esc releases');
  await expect(page.locator('.plate-history-badge')).not.toContainText(/yaw|pitch|locked/i);
  const label = page.getByText('C3 · R1', { exact: true });
  await expect(label).toBeVisible();
  const before = await label.boundingBox();
  const canvas = await scene.boundingBox();
  await page.mouse.move(canvas.x + 20, canvas.y + 130);
  await page.mouse.down();
  await page.mouse.move(canvas.x + 80, canvas.y + 165, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => {
    const current = await label.boundingBox();
    return Math.abs(current.x - before.x) + Math.abs(current.y - before.y);
  }).toBeGreaterThan(5);
  await expect(page.getByRole('tab', { name: 'R1', exact: true })).toBeVisible();
  await page.getByRole('radio', { name: 'Spacious', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Spacious', exact: true })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: 'Center sample', exact: true }).click();
  await page.getByRole('button', { name: 'Zoom plate in', exact: true }).click();
  await page.getByRole('button', { name: 'Fit plate', exact: true }).click();
  await expect(scene).toHaveAttribute('data-plate-phase', 'locked');
  await expect(page.getByRole('tab', { name: 'R1', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Plate overview', exact: false }).click();
  await expect(scene).toHaveAttribute('data-plate-phase', 'flat');
  await expect(page.locator('.plate-lens-legend')).toContainText('Reanalysis');
  expect(errors).toEqual([]);
});

test('plate appearance keeps the visible result paint and its legend in agreement', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'plate', exact: true }).click();
  await page.getByRole('button', { name: /^C3 / }).first().click();
  const scene = page.locator('[data-plate-phase]');
  await expect(scene).toHaveAttribute('data-plate-phase', 'locked');
  const reportable = scene.getByRole('button', { name: /— Reportable · SoT$/ }).first();
  const legend = page.locator('.plate-lens-legend').getByText('Reportable · SoT', { exact: true }).locator('i');
  const paints = [];
  for (const mode of ['dark', 'light', 'contrast']) {
    await page.getByRole('group', { name: 'Appearance', exact: true }).getByRole('radio', { name: { dark: 'Dark', light: 'Light', contrast: 'High contrast' }[mode], exact: true }).check();
    const swatch = await legend.evaluate((element) => getComputedStyle(element).backgroundImage);
    await expect.poll(() => reportable.evaluate((element) => getComputedStyle(element).backgroundImage)).toBe(swatch);
    paints.push(swatch);
    await expect(scene).toHaveAttribute('data-plate-phase', 'locked');
    await expect(page.getByRole('tab', { name: 'R1', exact: true })).toBeVisible();
  }
  expect(new Set(paints).size).toBe(3);
});
