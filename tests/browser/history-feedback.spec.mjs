import { test, expect } from '@playwright/test';

async function openHistory(page, mobile = false) {
  await page.goto('/');
  await page.getByRole('button', { name: mobile ? 'Plate' : 'plate', exact: true }).click();
  if (mobile) await page.getByText('All result stories & lifecycle policies', { exact: true }).click();
  else {
    await page.getByRole('button', { name: /Sample history/ }).click();
    await expect(page.locator('[data-plate-phase]')).toHaveAttribute('data-plate-phase', 'locked');
  }
}

test('the record companion arrives during camera motion and local previews have no request animation', async ({ page }) => {
  let reads = 0;
  page.on('request', request => { if (request.url().endsWith('/graphql')) reads++; });
  await page.goto('/');
  await page.getByRole('button', { name: 'plate', exact: true }).click();
  await page.evaluate(() => {
    window.trayDuringCamera = false;
    const observer = new MutationObserver(() => {
      if (document.querySelector('[data-result-tray]') && document.querySelector('[data-plate-phase]')?.dataset.platePhase !== 'locked') {
        window.trayDuringCamera = true;
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
  });
  await page.getByRole('button', { name: /Sample history/ }).click();
  await expect(page.locator('[data-plate-phase]')).toHaveAttribute('data-plate-phase', 'locked');
  expect(await page.evaluate(() => window.trayDuringCamera)).toBe(true);
  const tray = page.locator('[data-result-tray]');
  const source = tray.locator('.plate-history-source');
  for (const id of ['RES-C3-00', 'RES-B4-00', 'RES-C3-01']) {
    await page.locator(`[data-result-id="${id}"]`).dispatchEvent('pointerover', { pointerId: 1, pointerType: 'mouse', bubbles: true });
    await expect(source).toContainText(`${id.split('-')[1]} history`);
    await expect(source).toHaveAttribute('data-history-phase', 'idle');
    await expect(tray.locator('.plate-history-source__activity')).toHaveAttribute('data-pending', 'false');
    await expect(tray.getByRole('button', { name: 'Close record', exact: true })).toBeVisible();
  }
  expect(reads).toBe(0);
  await expect(page.locator('.plate-history-source')).toHaveCount(1);
});

for (const mobile of [false, true]) {
  test.describe(mobile ? 'Compact request feedback' : 'Primary tray request feedback', () => {
    test.use(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' } : {});
    test('a pending read stays keyed, a late response cannot replace it, and cached history has no loading flash', async ({ page }) => {
      const releases = new Map();
      const reads = new Map();
      await page.route('**/graphql', async route => {
        const id = route.request().postDataJSON().variables.id;
        reads.set(id, (reads.get(id) ?? 0) + 1);
        const response = await route.fetch();
        const body = await response.json();
        body.data.dataSource.mode = 'STORED';
        if (id === 'C3' || id === 'E3') await new Promise(resolve => releases.set(id, resolve));
        await route.fulfill({ response, json: body });
      });
      try {
        await openHistory(page, mobile);
        await page.getByRole('button', { name: /^C3 VUS reanalysis/ }).first().click();
        const source = page.locator('.plate-history-source');
        await expect(source).toContainText('C3 history');
        await expect(source).toHaveAttribute('data-history-phase', 'loading');
        await expect(source.locator('[data-pending="true"]')).toBeVisible();
        if (mobile) {
          expect(await source.locator('i').first().evaluate(el => getComputedStyle(el).animationName)).toBe('none');
        } else {
          // A preview of another well must never borrow the selected well's request.
          await page.locator('[data-result-tray]').getByRole('button', { name: 'pinned', exact: true }).click();
          await page.locator('[data-result-id="RES-B4-00"]').dispatchEvent('pointerover', { pointerId: 1, pointerType: 'mouse', bubbles: true });
          await expect(source).toContainText('B4 history');
          await expect(source).toHaveAttribute('data-history-phase', 'idle');
        }
        await expect.poll(() => releases.has('C3')).toBe(true);
        await page.getByRole('button', { name: /^E3 / }).first().click();
        await expect(source).toContainText('E3 history');
        await expect(source).toHaveAttribute('data-history-phase', 'loading');
        await expect.poll(() => releases.has('E3')).toBe(true);
        releases.get('E3')();
        await expect(source).toContainText('Stored history');
        releases.get('C3')();
        await expect(source).toHaveAttribute('data-history-phase', 'ready');
        await expect(source).toContainText('E3 history');
        await expect(source.locator('.plate-history-source__activity')).toHaveAttribute('data-pending', 'false');
        // Cache returning to E3 is ready in the selection render, not one effect later.
        await page.getByRole('button', { name: /^B4 / }).first().click();
        await expect(source).toHaveAttribute('data-history-phase', 'ready');
        await page.evaluate(() => {
          window.cachedLoading = false;
          const source = document.querySelector('.plate-history-source');
          new MutationObserver(() => {
            if (source.textContent.includes('E3 history') && source.dataset.historyPhase === 'loading') window.cachedLoading = true;
          }).observe(source, { attributes: true, childList: true, subtree: true });
        });
        await page.getByRole('button', { name: /^E3 / }).first().click();
        await expect(source).toContainText('E3 history');
        await expect(source).toHaveAttribute('data-history-phase', 'ready');
        expect(await page.evaluate(() => window.cachedLoading)).toBe(false);
        expect(reads.get('E3')).toBe(1);
        if (mobile) expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
      } finally {
        releases.forEach(release => release());
      }
    });
  });
}
