import { test, expect } from '@playwright/test';

async function settledDepth(disc) {
  const carrier = disc.locator('..');
  await expect.poll(() => carrier.evaluate((element) => {
    const current = new DOMMatrix(getComputedStyle(element).transform).m43;
    const target = new DOMMatrix(element.style.transform).m43;
    return Math.abs(current - target);
  })).toBeLessThan(0.01);
  return carrier.evaluate((element) => new DOMMatrix(getComputedStyle(element).transform).m43);
}

for (const mobile of [false, true]) {
  test.describe(mobile ? 'Mobile history layout' : 'Desktop history layout', () => {
    test.use(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : {});

    test('layout controls reveal their result from overview and retain the selected record', async ({ page }) => {
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto('/');
      await page.getByRole('button', { name: mobile ? 'Plate' : 'plate', exact: true }).click();
      if (mobile) await page.getByRole('button', { name: '3D plate', exact: true }).click();
      const scene = page.locator('[data-plate-phase]');
      await expect(scene).toHaveAttribute('data-plate-phase', 'flat');
      const layoutOption = (name) => page.getByRole(mobile ? 'button' : 'radio', { name, exact: true });

      // Even the currently selected layout value has a visible effect in overview.
      await layoutOption('By result').click();
      await expect(scene).toHaveAttribute('data-plate-phase', 'locked');
      if (mobile) await page.getByText('All result stories & lifecycle policies', { exact: true }).click();
      await page.getByRole('button', { name: /^C3 VUS reanalysis/ }).first().click();
      const record = mobile ? page.locator('.plate-compact-record') : scene.locator('[data-scene-controls]');
      await record.getByRole('tab', { name: 'R2', exact: true }).click();
      const disc = scene.locator('[data-result-id="RES-C3-01"]');
      const evenDepth = await settledDepth(disc);
      expect(evenDepth).toBeGreaterThan(1);

      await page.getByRole('button', { name: /^Plate overview/ }).click();
      await expect(scene).toHaveAttribute('data-plate-phase', 'flat');
      await layoutOption('Over time').click();
      await expect(scene).toHaveAttribute('data-plate-phase', 'locked');
      const timeDepth = await settledDepth(disc);
      expect(timeDepth).toBeGreaterThan(evenDepth); // C3's reanalysis follows its first run by months.
      await expect(record.getByRole('tab', { name: 'R2', exact: true })).toHaveAttribute('aria-selected', 'true');

      await page.getByRole('button', { name: /^Plate overview/ }).click();
      await expect(scene).toHaveAttribute('data-plate-phase', 'flat');
      await layoutOption('Spacious').click();
      await expect(scene).toHaveAttribute('data-plate-phase', 'locked');
      expect(await settledDepth(disc)).toBeGreaterThan(timeDepth);
      await expect(layoutOption('Over time')).toHaveAttribute(mobile ? 'aria-pressed' : 'aria-checked', 'true');
      await expect(record.getByRole('tab', { name: 'R2', exact: true })).toHaveAttribute('aria-selected', 'true');
      expect(errors).toEqual([]);
    });
  });
}
