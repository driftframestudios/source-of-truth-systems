import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

test('mobile entry defers Plate and a failed download keeps Corridor and reload recovery available', async ({ page }) => {
  const modules = [];
  page.on('request', request => {
    if (request.resourceType() === 'script') modules.push(new URL(request.url()).pathname);
  });
  await page.route('**/MobilePlate-*.js', route => route.abort('failed'));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Accession + Plate' })).toBeVisible();
  expect(modules.some(path => /DesktopWorkspace-|MobilePlate-/.test(path))).toBe(false);
  await page.getByRole('button', { name: 'Plate', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('The plate couldn’t load.');
  await expect(page.getByRole('button', { name: 'Reload to try again' })).toBeVisible();
  expect(modules.some(path => /MobilePlate-/.test(path))).toBe(true);
  expect(modules.some(path => /DesktopWorkspace-/.test(path))).toBe(false);
  await page.getByRole('button', { name: 'Corridor', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Accession + Plate' })).toBeVisible();
  await page.getByRole('button', { name: 'Plate', exact: true }).click();
  await page.unroute('**/MobilePlate-*.js');
  await page.getByRole('button', { name: 'Reload to try again' }).click();
  await expect(page.getByRole('heading', { name: 'Accession + Plate' })).toBeVisible();
  await page.getByRole('button', { name: 'Plate', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Inside the plate.' })).toBeVisible();
});
