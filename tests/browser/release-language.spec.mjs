import { test, expect } from '@playwright/test';

test('release planning uses readable sources and a working read-only summary', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByText('for Life Sciences', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Release plan', exact: true }).click();
  await expect(page.getByText('Release 02 — Genomics platform', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Preview summary', exact: true }).click();
  const summary = page.getByRole('region', { name: 'Release summary', exact: true });
  await expect(summary).toBeInViewport();
  await expect(summary).toContainText('Genomics program brief');
  await expect(summary).toContainText('Spot → On-Demand fallback for STAT orders');
  await expect(summary).not.toContainText('notion_fragment');
  await expect(summary).not.toContainText('header_safe_zone');
  await page.getByRole('button', { name: 'Hide summary', exact: true }).click();
  await expect(summary).toHaveCount(0);
  await page.getByRole('button', { name: /^Sources/ }).click();
  await page.locator('[data-record-id="notion_fragment"]').click();
  await expect(page.locator('[data-record-id="notion_fragment"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Program context', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('notion_fragment', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: /^Map/ }).click();
  await expect(page.getByText('Program brief', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('mobile About identifies the showcase and its copyright holder', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'About this showcase' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Vikrant Varun Kudesia');
  await expect(dialog.locator('footer')).toContainText('© 2026 Vikrant Varun Kudesia · Driftframe Studios, Limited Liability Company');
  await expect(dialog.locator('footer')).toContainText('Figma Make (Claude Opus 5.5) and ChatGPT/Codex (GPT-6 Astra)');
  await expect(dialog).toBeInViewport();
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(dialog.locator('footer')).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Close about this showcase' })).toBeInViewport();
  await page.getByRole('button', { name: 'Close about this showcase' }).click();
  await expect(dialog).toHaveCount(0);
});


for (const width of [1024, 1512]) {
  test(`desktop header stays balanced at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 982 });
    await page.goto('/');
    const theme = page.getByRole('group', { name: 'Appearance' });
    const environment = page.locator('button[aria-haspopup="listbox"]');
    await expect(theme).toBeInViewport();
    await expect(environment).toBeInViewport();
    const a = await theme.boundingBox();
    const b = await environment.boundingBox();
    expect(Math.abs(a.height - b.height)).toBeLessThanOrEqual(1);
    expect(a.x + a.width).toBeLessThan(b.x);
    await expect(page.getByText('Source of Truth', { exact: true })).toHaveCount(1);
  });
}
