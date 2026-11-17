import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

async function expectHistoryFramed(scene) {
  await expect.poll(async () => {
    const canvas = await scene.boundingBox();
    const plate = await scene.locator('.plate-snap').boundingBox();
    const controls = await scene.locator('.plate-camera-controls').boundingBox();
    return plate.x >= canvas.x && plate.x + plate.width <= canvas.x + canvas.width
      && plate.y >= canvas.y + 35 && plate.y + plate.height < controls.y;
  }).toBe(true);
}

test('mobile upright history, shared file restore and section return stay coherent', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Plate', exact: true }).click();
  await page.getByText('All result stories & lifecycle policies', { exact: true }).click();
  await page.getByRole('button', { name: /^C3 VUS reanalysis/ }).click();
  await expect(page.locator('[data-plate-phase]')).toHaveAttribute('data-plate-phase', 'locked');
  await expectHistoryFramed(page.locator('.plate-scene-compact'));
  await expect(page.locator('.plate-history-badge')).toContainText('Timeline view');
  await expect(page.locator('.plate-history-badge')).not.toContainText('Esc');
  await expect(page.getByRole('button', { name: 'Plate overview', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Over time', exact: true }).click();
  const record = page.locator('.plate-compact-record');
  await record.getByRole('tab', { name: 'R1', exact: true }).click();
  await record.getByRole('button', { name: 'Files', exact: true }).click();
  const bam = record.getByRole('button', { name: 'Copy S3 URI for BAM', exact: true }).locator('..').locator('..');
  await bam.getByRole('button', { name: 'restore', exact: true }).click();
  await record.getByRole('button', { name: /^Standard 3–5 h/ }).click();
  await expect(bam).toContainText('≈ 4.0 h');
  await record.getByRole('tab', { name: 'R2', exact: true }).click();
  await expect(bam).toContainText('≈ 4.0 h');
  const camera = page.locator('.plate-scene-compact div[style*="preserve-3d"]').first();
  await page.locator('.plate-camera-controls summary').click();
  await page.getByRole('button', { name: 'Rotate plate right', exact: true }).click();
  await page.locator('.plate-camera-controls summary').click();
  const exploredCamera = await camera.getAttribute('style');
  await page.getByRole('button', { name: 'Corridor', exact: true }).click();
  await page.keyboard.press('u');
  await page.getByRole('button', { name: 'Plate', exact: true }).click();
  await expect(page.locator('[data-plate-phase]')).toHaveAttribute('data-plate-phase', 'locked');
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(camera).toHaveAttribute('style', exploredCamera);
  await expect(page.getByRole('button', { name: 'Over time', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(record.getByRole('tab', { name: 'R2', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(bam).toContainText('≈ 4.0 h');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  expect(errors).toEqual([]);
});

test('touch capture transfer keeps repeated camera moves and the next control usable', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Plate', exact: true }).click();
  await page.getByRole('button', { name: '3D plate', exact: true }).click();
  const scene = page.locator('.plate-scene-compact');
  await scene.scrollIntoViewIfNeeded();
  const camera = scene.locator('div[style*="preserve-3d"]').first();
  const well = await scene.locator('[data-well-idx="42"] > div').first().boundingBox();
  const x = well.x + well.width / 2, y = well.y + well.height / 2;
  await scene.evaluate((element) => element.addEventListener('lostpointercapture', (event) => {
    if (event.target !== element) element.dataset.childCaptureLost = 'true';
  }));
  const input = await page.context().newCDPSession(page);
  const point = (id, x, y) => ({ id, x, y, radiusX: 4, radiusY: 4, force: 1 });
  const send = async (type, touchPoints) => {
    await input.send('Input.dispatchTouchEvent', { type, touchPoints });
    await page.evaluate(() => new Promise(requestAnimationFrame));
  };
  await send('touchStart', [point(1, x, y)]);
  for (const dx of [15, 35, 55]) {
    const before = await camera.getAttribute('style');
    await send('touchMove', [point(1, x + dx, y - dx / 2)]);
    await expect(camera).not.toHaveAttribute('style', before);
  }
  await expect(scene).toHaveAttribute('data-child-capture-lost', 'true');
  await send('touchEnd', []);
  await send('touchStart', [point(2, 170, y), point(3, 220, y)]);
  for (const spread of [15, 30]) {
    const before = await camera.getAttribute('style');
    await send('touchMove', [point(2, 170 - spread, y), point(3, 220 + spread, y)]);
    await expect(camera).not.toHaveAttribute('style', before);
  }
  await send('touchEnd', []);
  await page.getByRole('button', { name: /^Sample history/ }).click();
  await expect(scene).toHaveAttribute('data-plate-phase', 'locked');
  // History retains the same tactile camera controls after its spring entrance.
  await scene.scrollIntoViewIfNeeded();
  const historyBounds = await scene.boundingBox();
  await expectHistoryFramed(scene);
  const historyX = historyBounds.x + 20, historyY = historyBounds.y + 120;
  const beforeHistoryDrag = await camera.getAttribute('style');
  await send('touchStart', [point(4, historyX, historyY)]);
  await send('touchMove', [point(4, historyX + 32, historyY + 16)]);
  await send('touchEnd', []);
  await expect(camera).not.toHaveAttribute('style', beforeHistoryDrag);
  await page.getByRole('button', { name: 'Fit plate', exact: true }).click();
  await expect(scene).toHaveAttribute('data-plate-phase', 'locked');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});

test('reduced-motion history fits immediately when its depth changes', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Plate', exact: true }).click();
  await page.getByText('All result stories & lifecycle policies', { exact: true }).click();
  await page.getByRole('button', { name: /^C3 VUS reanalysis/ }).click();
  const scene = page.locator('.plate-scene-compact');
  await expect(scene).toHaveAttribute('data-plate-phase', 'locked');
  await expectHistoryFramed(scene);
  await page.getByRole('button', { name: 'Spacious', exact: true }).click();
  await expectHistoryFramed(scene);
  const camera = scene.locator('div[style*="preserve-3d"]').first();
  const settled = await camera.getAttribute('style');
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(camera).toHaveAttribute('style', settled);
});
