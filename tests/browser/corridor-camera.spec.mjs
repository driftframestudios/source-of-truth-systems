import { test, expect } from '@playwright/test';

async function setRange(control, value) {
  await control.evaluate((input, next) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, next);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

async function openControlledCamera(page) {
  // Install before application timers; runFor below fires each animation frame.
  // https://playwright.dev/docs/clock#tick-through-time-manually-firing-all-the-timers-consistently
  await page.clock.install({ time: new Date('2026-11-17T10:00:00Z') });
  await page.goto('/');
  const camera = page.locator('[data-corridor-camera]');
  await expect(camera).toHaveAttribute('style', /rotateX\([\d.]+deg\)/);
  await expect(page.locator('#initial-load')).toHaveCount(0);
  await page.clock.pauseAt(new Date('2026-11-17T10:01:00Z'));
  return camera;
}

async function renderedTransform(camera) {
  return camera.evaluate((node) => new Promise((resolve) => {
    // Let React's queued render task commit while the animation clock stays still.
    const channel = new MessageChannel();
    channel.port1.onmessage = () => {
      channel.port1.close();
      channel.port2.close();
      resolve(node.style.transform);
    };
    channel.port2.postMessage(null);
  }));
}

async function runCameraFor(page, camera, duration) {
  await page.clock.runFor(duration);
  return renderedTransform(camera);
}

async function sampleCameraFrames(page, camera, duration = 2000) {
  const samples = [];
  for (let elapsed = 0; elapsed < duration; elapsed += 16) {
    samples.push(await runCameraFor(page, camera, Math.min(16, duration - elapsed)));
  }
  return samples;
}

test('corridor camera tracks direct controls and keeps flags attached through orbit', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  const camera = page.locator('[data-corridor-camera]');
  const pitch = page.getByRole('slider', { name: 'Corridor pitch' });
  const yaw = page.getByRole('slider', { name: 'Corridor yaw' });
  await expect(pitch).toHaveAttribute('max', '100');
  await expect(page.getByText('lane axis', { exact: false })).toHaveCount(0);
  await expect(camera).toHaveCSS('transition-duration', '0s');
  for (const value of ['87', '89', '91', '93']) {
    await setRange(pitch, value);
    await expect(camera).toHaveAttribute('style', new RegExp(`rotateX\\(${value}deg\\)`));
    // No queued easing runs after the visitor has finished this adjustment.
    expect(await camera.evaluate((node) => node.getAnimations().length)).toBe(0);
  }
  await setRange(yaw, '0');
  await setRange(yaw, '179');
  const canvas = await camera.locator('..').locator('..').boundingBox();
  const x = canvas.x + canvas.width / 2;
  const y = canvas.y + canvas.height - 30;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 10, y, { steps: 2 });
  await page.mouse.up();
  await expect(camera).toHaveAttribute('style', /rotateZ\(183deg\)/);
  await setRange(yaw, '-179');
  await expect(camera).toHaveAttribute('style', /rotateZ\(181deg\)/);
  await page.getByRole('button', { name: 'Isometric', exact: true }).click();
  for (const angle of ['-32', '0', '55']) {
    await setRange(yaw, angle);
    const attachment = await page.locator('[data-corridor-flag]').first().evaluate((flag) => {
      const pole = flag.querySelector('[data-corridor-flag-pole]').getBoundingClientRect();
      const banner = flag.querySelector('[data-corridor-flag-banner]').getBoundingClientRect();
      return {
        xGap: Math.max(0, banner.left - pole.right, pole.left - banner.right),
        yGap: Math.max(0, banner.top - pole.bottom, pole.top - banner.bottom),
      };
    });
    expect(attachment.xGap).toBeLessThan(2);
    expect(attachment.yGap).toBeLessThan(2);
  }
  expect(errors).toEqual([]);
});

test('explicit camera presets swoop and settle while a direct adjustment takes over immediately', async ({ page }) => {
  const camera = await openControlledCamera(page);
  await expect(page.getByRole('button', { name: 'Under', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Top', exact: true }).click();
  await runCameraFor(page, camera, 2000);
  await expect(camera).toHaveAttribute('style', /rotateX\(0deg\)/);
  await page.getByRole('button', { name: 'Side', exact: true }).click();
  const samples = (await sampleCameraFrames(page, camera)).map((value) => Number(value.match(/rotateX\(([-\d.]+)deg\)/)?.[1]));
  await expect(camera).toHaveAttribute('style', /rotateX\(90deg\)/);
  expect(samples.some((angle) => angle > 0 && angle < 90)).toBe(true);
  expect(Math.max(...samples)).toBeGreaterThan(90.5);
  await page.getByRole('button', { name: 'Isometric', exact: true }).click();
  await sampleCameraFrames(page, camera, 96);
  await expect.poll(() => camera.evaluate((node) => Number(node.style.transform.match(/rotateX\(([-\d.]+)deg\)/)?.[1]))).toBeLessThan(85);
  await setRange(page.getByRole('slider', { name: 'Corridor pitch' }), '73');
  await expect(camera).toHaveAttribute('style', /rotateX\(73deg\)/);
  const directPose = await camera.getAttribute('style');
  // A cancelled spring cannot reclaim the camera on its later frames/completion.
  await runCameraFor(page, camera, 900);
  await expect(camera).toHaveAttribute('style', directPose);
  await expect(camera).toHaveCSS('transition-duration', '0s');
  await page.getByRole('button', { name: 'Top', exact: true }).click();
  await sampleCameraFrames(page, camera, 96);
  await expect.poll(() => camera.evaluate((node) => Number(node.style.transform.match(/rotateX\(([-\d.]+)deg\)/)?.[1]))).toBeLessThan(60);
  await page.getByRole('button', { name: 'Zoom corridor in', exact: true }).click();
  const zoomPose = await camera.getAttribute('style');
  await runCameraFor(page, camera, 900);
  await expect(camera).toHaveAttribute('style', zoomPose);
});

test('mobile presets share the three camera choices and reduced motion settles directly', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await page.getByText('Camera · presets and angles', { exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: 'Under', exact: true })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Side', exact: true }).click();
  const camera = page.locator('[data-corridor-camera]');
  await expect(camera).toHaveAttribute('style', /rotateX\(90deg\) rotateZ\(-90deg\)/);
  await dialog.getByRole('button', { name: 'Top', exact: true }).click();
  await expect(camera).toHaveAttribute('style', /rotateX\(0deg\) rotateZ\(0deg\)/);
  const pose = await camera.getAttribute('style');
  await page.waitForTimeout(150);
  await expect(camera).toHaveAttribute('style', pose);
  await dialog.getByRole('button', { name: 'Close corridor controls', exact: true }).click();
  await page.getByRole('button', { name: 'Reset corridor camera', exact: true }).click();
  await expect(camera).toHaveAttribute('style', /rotateX\(54deg\) rotateZ\(-60deg\)/);
  const resetPose = await camera.getAttribute('style');
  await page.waitForTimeout(150);
  await expect(camera).toHaveAttribute('style', resetPose);
});

test('desktop Reset springs the complete camera home and keeps its existing reset behavior', async ({ page }) => {
  const camera = await openControlledCamera(page);
  await expect(camera).toHaveAttribute('style', /rotateX\([\d.]+deg\)/);
  const original = await camera.getAttribute('style');
  await page.getByRole('button', { name: 'Process', exact: true }).click();
  await expect(page.locator('path[marker-end]')).toHaveCount(5);
  await page.getByRole('button', { name: 'Side', exact: true }).click();
  await runCameraFor(page, camera, 2000);
  await expect(camera).toHaveAttribute('style', /rotateX\(90deg\)/);
  await page.getByRole('button', { name: 'Zoom corridor in', exact: true }).click();
  const canvas = await camera.locator('..').locator('..').boundingBox();
  await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height - 35);
  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(canvas.x + canvas.width / 2 + 70, canvas.y + canvas.height - 55, { steps: 3 });
  await page.mouse.up({ button: 'middle' });
  await expect.poll(() => camera.evaluate((node) => Number(node.style.transform.match(/translate\(([-\d.]+)px,/)?.[1]))).toBeCloseTo(70, 3);
  await page.getByRole('button', { name: 'reset', exact: true }).click();
  const samples = await sampleCameraFrames(page, camera);
  await expect(camera).toHaveAttribute('style', original);
  await expect(page.locator('path[marker-end]')).toHaveCount(15);
  const pitch = samples.map((value) => Number(value.match(/rotateX\(([-\d.]+)deg\)/)?.[1]));
  expect(pitch.some((value) => value > 56 && value < 90)).toBe(true);
  expect(Math.min(...pitch)).toBeLessThan(55.9);
  expect(Math.min(...pitch)).toBeGreaterThan(52);
  expect(samples.some((value) => {
    const pan = Number(value.match(/translate\(([-\d.]+)px,/)?.[1]);
    const zoom = Number(value.match(/scale\(([-\d.]+)\)/)?.[1]);
    return pan > 0 && pan < 70 && zoom > 0.62 && zoom < 0.72;
  })).toBe(true);

  await page.getByRole('button', { name: 'Side', exact: true }).click();
  await runCameraFor(page, camera, 2000);
  await expect(camera).toHaveAttribute('style', /rotateX\(90deg\)/);
  await page.getByRole('button', { name: 'reset', exact: true }).click();
  await sampleCameraFrames(page, camera, 96);
  await expect.poll(() => camera.evaluate((node) => Number(node.style.transform.match(/rotateX\(([-\d.]+)deg\)/)?.[1]))).toBeLessThan(85);
  await setRange(page.getByRole('slider', { name: 'Corridor pitch' }), '73');
  const directPose = await camera.getAttribute('style');
  await runCameraFor(page, camera, 900);
  await expect(camera).toHaveAttribute('style', directPose);
});

test('mobile Reset returns the explored pose with motion and stops travel', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const camera = page.locator('[data-corridor-camera]');
  await expect(camera).toHaveAttribute('style', /rotateX\([\d.]+deg\)/);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const original = await camera.getAttribute('style');
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await page.getByText('Camera · presets and angles', { exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Side', exact: true }).click();
  await expect(camera).toHaveAttribute('style', /rotateX\(90deg\)/);
  await dialog.getByRole('button', { name: 'Close corridor controls', exact: true }).click();
  await page.getByRole('button', { name: 'Zoom into corridor', exact: true }).click();
  await page.locator('.mobile-corridor-canvas').press('ArrowRight');
  await page.getByRole('button', { name: 'Start corridor travel', exact: true }).click();
  await camera.evaluate((node) => {
    window.mobileResetSamples = [];
    window.mobileResetObserver = new MutationObserver(() => window.mobileResetSamples.push(node.style.transform));
    window.mobileResetObserver.observe(node, { attributes: true, attributeFilter: ['style'] });
  });
  await page.getByRole('button', { name: 'Reset corridor camera', exact: true }).click();
  await expect(camera).toHaveAttribute('style', original);
  await expect(page.getByRole('button', { name: 'Start corridor travel', exact: true })).toBeVisible();
  const samples = await page.evaluate(() => { window.mobileResetObserver.disconnect(); return window.mobileResetSamples; });
  expect(samples.some((value) => {
    const pitch = Number(value.match(/rotateX\(([-\d.]+)deg\)/)?.[1]);
    return pitch > 54 && pitch < 90;
  })).toBe(true);
});
