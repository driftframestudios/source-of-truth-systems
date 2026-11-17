import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1024, height: 768 } });

test('compact desktop rails keep the Plate, selected result and request feedback in place', async ({ page }) => {
  const errors = [];
  let selectedReads = 0;
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (request.url().endsWith('/graphql') && request.postDataJSON()?.variables?.id === 'C3') selectedReads++;
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'plate', exact: true }).click();
  const scene = page.locator('[data-plate-phase]');
  const histories = page.getByRole('button', { name: 'Sample histories', exact: true });
  const sample = page.getByRole('button', { name: /^Sample details/ });
  await expect(histories).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('complementary', { name: 'Sample histories', exact: true })).toBeHidden();
  const sceneBounds = await scene.boundingBox();
  expect(sceneBounds.width).toBeGreaterThan(800);

  await histories.click();
  await expect(page.getByRole('button', { name: 'Close sample histories', exact: true })).toBeFocused();
  await page.getByRole('button', { name: /^C3 VUS reanalysis/ }).first().click();
  await expect(histories).toHaveAttribute('aria-expanded', 'false');
  await expect(histories).toBeFocused();
  await expect(scene).toHaveAttribute('data-plate-phase', 'locked');
  const tray = page.locator('[data-result-tray]');
  const source = tray.locator('.plate-history-source');
  await expect(source).toContainText('C3 history');
  await expect(source).toHaveAttribute('data-history-phase', 'ready');
  await tray.getByRole('tab', { name: 'R2', exact: true }).click();

  // Opening either reading rail leaves the scene geometry and its source strip intact.
  await sample.click();
  await expect(sample).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('complementary', { name: 'Sample details · C3' })).toContainText('SPX-2026-0495');
  expect((await scene.boundingBox()).width).toBe(sceneBounds.width);
  await expect(page.getByRole('button', { name: 'Close sample details', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(sample).toBeFocused();
  await expect(sample).toHaveAttribute('aria-expanded', 'false');
  await expect(tray.getByRole('tab', { name: 'R2', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(tray.getByRole('button', { name: 'pinned', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await histories.click();
  await sample.click();
  await expect(histories).toHaveAttribute('aria-expanded', 'false');
  await expect(sample).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('button', { name: 'Close sample details', exact: true }).click();
  await expect(source).toHaveAttribute('data-history-phase', 'ready');
  expect(selectedReads).toBe(1);

  // The close action and result identity remain inside the tray instead of clipping.
  const bounds = await tray.boundingBox();
  const close = await tray.getByRole('button', { name: 'Close record', exact: true }).boundingBox();
  expect(close.x + close.width).toBeLessThanOrEqual(bounds.x + bounds.width);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1024);

  await page.setViewportSize({ width: 1512, height: 982 });
  await expect(histories).toBeHidden();
  await expect(page.getByRole('complementary', { name: 'Sample histories', exact: true })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Sample details · C3' })).toBeVisible();
  await expect(tray.getByRole('tab', { name: 'R2', exact: true })).toHaveAttribute('aria-selected', 'true');

  await page.setViewportSize({ width: 1023, height: 768 });
  await expect(page.getByRole('button', { name: 'Plate', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.plate-compact-record').getByRole('tab', { name: 'R2', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(scene).toHaveAttribute('data-plate-phase', 'locked');
  await expect(tray.getByRole('tab', { name: 'R2', exact: true })).toHaveAttribute('aria-selected', 'true');
  expect(errors).toEqual([]);
});
