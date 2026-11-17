import { test, expect } from '@playwright/test';

const desktop = { width: 1512, height: 982 };
const mobile = { width: 390, height: 844 };

test('desktop Plate overview and selected history survive narrow and wide layouts', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'plate', exact: true }).click();
  const scene = page.locator('[data-plate-phase]');
  await expect(scene).toHaveAttribute('data-plate-phase', 'flat');
  await page.setViewportSize(mobile);
  await expect(page.getByRole('button', { name: 'Plate', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: '3D plate', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(scene).toBeVisible();
  await expect(scene).toHaveAttribute('data-plate-phase', 'flat');
  await expect(page.locator('.mobile-plate-result-strip')).toHaveCount(0);
  await page.setViewportSize(desktop);
  await expect(scene).toBeVisible();
  await expect(scene).toHaveAttribute('data-plate-phase', 'flat');

  await page.getByRole('button', { name: /^C3 VUS reanalysis/ }).first().click();
  await expect(scene).toHaveAttribute('data-plate-phase', 'locked');
  await scene.getByRole('tab', { name: 'R2', exact: true }).click();
  await page.getByRole('radio', { name: 'Why', exact: true }).click();
  await page.getByRole('radio', { name: 'Over time', exact: true }).click();
  await page.getByRole('radio', { name: 'Spacious', exact: true }).click();
  await page.setViewportSize(mobile);
  await expect(scene).toHaveAttribute('data-plate-phase', 'locked');
  await expect(page.locator('.mobile-plate-detail-heading > .mobile-plate-well-badge')).toHaveText('C3');
  await expect(page.locator('.plate-compact-record').getByRole('tab', { name: 'R2', exact: true })).toHaveAttribute('aria-selected', 'true');
  for (const label of ['Why', 'Over time', 'Spacious']) {
    await expect(page.locator('.mobile-plate-board-section').getByRole('button', { name: label, exact: true })).toHaveAttribute('aria-pressed', 'true');
  }
  await page.setViewportSize(desktop);
  await expect(scene).toHaveAttribute('data-plate-phase', 'locked');
  await expect(scene.getByRole('tab', { name: 'R2', exact: true })).toHaveAttribute('aria-selected', 'true');
  for (const label of ['Why', 'Over time', 'Spacious']) {
    await expect(page.getByRole('radio', { name: label, exact: true })).toHaveAttribute('aria-checked', 'true');
  }
  expect(errors).toEqual([]);
});

test('mobile-first Board intent and explicit Corridor selection survive the desktop boundary', async ({ page }) => {
  await page.setViewportSize(mobile);
  await page.goto('/');
  await page.getByRole('button', { name: 'Plate', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Well board', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: /D6.*QC recovery/ }).click();
  await expect(page.locator('.mobile-plate-detail-heading > .mobile-plate-well-badge')).toHaveText('D6');
  await page.setViewportSize(desktop);
  await expect(page.locator('[data-plate-phase]')).toHaveAttribute('data-plate-phase', 'flat');
  await page.setViewportSize(mobile);
  await expect(page.getByRole('button', { name: 'Plate', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Well board', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.mobile-plate-detail-heading > .mobile-plate-well-badge')).toHaveText('D6');

  await page.getByRole('button', { name: 'Corridor', exact: true }).click();
  await page.setViewportSize(desktop);
  await expect(page.getByRole('slider', { name: 'Corridor pitch', exact: true })).toBeVisible();
  await expect(page.locator('[data-corridor-camera]')).toHaveCount(1);
  await expect(page.locator('[data-plate-phase]')).toHaveCount(0);
  await page.setViewportSize(mobile);
  await expect(page.getByRole('button', { name: 'Corridor', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('heading', { name: 'Accession + Plate', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Plate', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Well board', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.mobile-plate-detail-heading > .mobile-plate-well-badge')).toHaveText('D6');
});
