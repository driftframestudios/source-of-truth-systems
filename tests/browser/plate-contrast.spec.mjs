import { test, expect } from '@playwright/test';

async function background(locator) {
  return locator.evaluate((element) => getComputedStyle(element).backgroundImage);
}

const key = (page, name) => page.locator('.plate-lens-legend').getByText(name, { exact: true }).locator('i');

test('High contrast history repeats category marks in its key and retains selected results across modes', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'plate', exact: true }).click();
  await page.getByRole('radio', { name: 'Why', exact: true }).click();
  await page.getByRole('button', { name: /^C3 / }).first().click();
  const scene = page.locator('[data-plate-phase]');
  await expect(scene).toHaveAttribute('data-plate-phase', 'locked');
  await page.getByRole('tab', { name: 'R2', exact: true }).click();
  const reanalysis = scene.locator('[data-well-id="C3"][data-result-id]').nth(1);
  const orthogonal = scene.locator('[data-well-id="C3"][data-result-id]').nth(2);
  const appearance = page.getByRole('group', { name: 'Appearance', exact: true });
  for (const mode of ['Dark', 'High contrast', 'Light', 'High contrast']) {
    await appearance.getByRole('radio', { name: mode, exact: true }).check();
    await expect.poll(() => background(reanalysis)).toBe(await background(key(page, 'Reanalysis')));
    await expect.poll(() => background(orthogonal)).toBe(await background(key(page, 'Orthogonal')));
    await expect(page.getByRole('tab', { name: 'R2', exact: true })).toHaveAttribute('aria-selected', 'true');
    if (mode === 'High contrast') {
      expect(await background(reanalysis)).toContain('6px 1.5px');
      expect(await background(orthogonal)).toContain('2px');
    } else {
      expect(await background(reanalysis)).not.toContain('6px 1.5px');
      expect(await background(orthogonal)).not.toContain('2px');
    }
  }
  const failed = scene.getByRole('button', { name: /— Failed QC$/ }).first();
  for (const lens of ['Status', 'Why', 'Storage', 'Query']) {
    await page.getByRole('radio', { name: lens, exact: true }).click();
    await expect.poll(() => background(failed)).toContain('linear-gradient(135deg,');
    const failureKey = key(page, lens === 'Status' ? 'Failed QC' : 'Diagonal · failed QC');
    expect(await background(failureKey)).toContain('linear-gradient(135deg,');
  }
  await page.getByRole('radio', { name: 'Why', exact: true }).click();
  await expect(page.locator('.plate-loading')).toHaveCount(0);
  await expect(page.locator('.deferred-reveal')).toHaveCount(0);
  await page.screenshot({ path: '.visual-runs/contrast-history.png' });
});

test('compact High contrast board shares the category cue with its key and 3D history', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Appearance', exact: true }).selectOption('contrast');
  await page.getByRole('button', { name: 'Plate', exact: true }).click();
  await page.getByRole('group', { name: 'Color plate by' }).getByRole('button', { name: 'Why', exact: true }).click();
  const well = page.getByRole('button', { name: /^Well C3,/ });
  await expect(well).toContainText('3');
  await expect.poll(() => background(well.locator('.mobile-plate-well-face'))).toBe(await background(key(page, 'Orthogonal')));
  await expect(page.locator('.plate-loading')).toHaveCount(0);
  await expect(page.locator('.deferred-reveal')).toHaveCount(0);
  await page.screenshot({ path: '.visual-runs/contrast-mobile-board.png' });
  await well.click();
  await page.getByRole('button', { name: '3D plate', exact: true }).click();
  await page.getByRole('button', { name: /^Sample history/ }).click();
  const scene = page.locator('[data-plate-phase]');
  await expect(scene).toHaveAttribute('data-plate-phase', 'locked');
  await expect.poll(() => background(scene.locator('[data-well-id="C3"][data-result-id]').nth(1))).toBe(await background(key(page, 'Reanalysis')));
  await expect(page.locator('.plate-loading')).toHaveCount(0);
  await expect(page.locator('.deferred-reveal')).toHaveCount(0);
  await page.screenshot({ path: '.visual-runs/contrast-mobile-history.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});
