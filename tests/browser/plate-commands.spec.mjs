import { test, expect } from '@playwright/test';

test('a viewer can copy a permitted file location in a read-only environment while restores stay guarded', async ({ page }) => {
  await page.addInitScript(() => {
    window.copiedPlateUris = [];
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (value) => window.copiedPlateUris.push(value) } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Profile', exact: true }).first().click();
  await page.getByRole('group', { name: 'Workspace role', exact: true }).getByRole('button', { name: 'Viewer', exact: true }).click();
  await page.getByRole('button', { name: /^Lanes/ }).click();
  await page.getByRole('button', { name: 'plate', exact: true }).click();
  await page.getByRole('button', { name: /^C3 VUS reanalysis/ }).first().click();
  const record = page.locator('[data-scene-controls]');
  await expect(page.locator('.plate-history-source')).toHaveAttribute('data-history-phase', 'ready');
  await record.getByRole('tab', { name: 'R1', exact: true }).click();
  await page.getByRole('button', { name: /^RES ·/ }).click();
  await page.getByRole('option', { name: /^VAL / }).click();
  const copy = record.getByRole('button', { name: 'Copy S3 URI for BAM', exact: true });
  const uri = (await copy.getAttribute('title')).replace(/^Copy /, '');
  await copy.click();
  expect(await page.evaluate(() => window.copiedPlateUris)).toEqual([uri]);
  expect(uri).toMatch(/^s3:\/\/[^/]*val[^/]*\//);
  const bam = copy.locator('..').locator('..');
  await bam.getByRole('button', { name: 'restore', exact: true }).click();
  await record.getByRole('button', { name: /^Standard 3–5 h/ }).click();
  await expect(page.getByText(/read-only/i).last()).toBeVisible();
  await expect(bam).toContainText('3–5 h');
  await expect(bam).not.toContainText('≈ 4.0 h');
});
