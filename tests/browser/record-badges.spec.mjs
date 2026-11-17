import { test, expect } from '@playwright/test';

function contrast(foreground, background) {
  const luminance = (rgb) => rgb.slice(0, 3).map((channel) => channel / 255)
    .map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
    .reduce((total, value, index) => total + value * [.2126, .7152, .0722][index], 0);
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (light + .05) / (dark + .05);
}

async function readableBadges(page) {
  const paints = await page.locator('.record-badge').evaluateAll((badges) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d');
    const rgba = (color) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      return [...context.getImageData(0, 0, 1, 1).data];
    };
    return badges.map((badge) => {
      const style = getComputedStyle(badge);
      return { label: badge.textContent, foreground: rgba(style.color), background: rgba(style.backgroundColor) };
    });
  });
  expect(paints.length).toBeGreaterThan(0);
  for (const paint of paints) {
    expect(paint.background[3], `${paint.label} retains its own opaque surface on selected and ordinary cards`).toBe(255);
    expect(contrast(paint.foreground, paint.background), `${paint.label} Light label contrast`).toBeGreaterThanOrEqual(4.5);
  }
  return paints.map((paint) => paint.label);
}

test('Light record badges retain readable labels across source, requirement and artifact cards', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('radio', { name: 'Light', exact: true }).check();
  for (const width of [1024, 1512]) {
    await page.setViewportSize({ width, height: 982 });
    await page.getByRole('button', { name: /^Sources/ }).click();
    await expect(page.locator('[data-record-id="notion_fragment"]')).toBeVisible();
    expect(await readableBadges(page)).toEqual(expect.arrayContaining(['S3 Doc', 'YAML', 'Context Only', 'Active']));
    await page.locator('[data-record-id="notion_fragment"]').click();
    expect(await readableBadges(page)).toContain('S3 Doc');
    await page.getByRole('button', { name: /^Requirements/ }).click();
    await expect(page.getByText('PIPE-STAGE-001', { exact: true })).toBeVisible();
    expect(await readableBadges(page)).toEqual(expect.arrayContaining(['Operational', 'Scientific', 'Active']));
    await page.getByRole('button', { name: /^Artifacts/ }).click();
    await page.locator('[data-record-id="arc01_pass1"]').click();
    await expect(page.getByText('Recorded acceptance checks', { exact: true })).toBeVisible();
    expect(await readableBadges(page)).toEqual(expect.arrayContaining(['✓ Pass', '~ Review']));
  }
});
