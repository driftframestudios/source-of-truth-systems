import { test as base, expect } from '@playwright/test';

const test = base.extend({
  runtimeErrors: [async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await use(errors);
    expect(errors).toEqual([]);
  }, { auto: true }],
});

test('accepted review and specimen edits survive filtering and navigation', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Profile', exact: true }).first().click();
  await page.getByRole('combobox', { name: 'Showcase persona' }).selectOption('prin_okafor');
  await page.getByRole('button', { name: /^RES ·/ }).click();
  await page.getByRole('option', { name: /^STG/ }).click();
  await page.getByRole('button', { name: /^Biomarkers/ }).click();
  const marker = page.locator('div.p-3.rounded.border').filter({ has: page.getByText('KRAS', { exact: true }) });
  const summary = page.getByText('awaiting review', { exact: true }).locator('..');
  await expect(summary).toContainText('7');
  await marker.getByRole('button', { name: '→ approved', exact: true }).click();
  await expect(summary).toContainText('6');
  await page.getByRole('button', { name: 'germline', exact: true }).click();
  await page.getByRole('button', { name: 'all', exact: true }).first().click();
  await expect(marker.getByRole('button', { name: '→ signed off', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Profile', exact: true }).first().click();
  await page.getByRole('combobox', { name: 'Showcase persona' }).selectOption('prin_self');
  await page.getByRole('button', { name: /^Specimens/ }).click();
  const specimen = page.getByRole('article', { name: 'SPX-2026-0481 card', exact: true });
  await specimen.getByRole('button', { name: 'hold', exact: true }).click();
  await expect(page.getByText('orders held', { exact: true }).locator('..')).toContainText('3');
  await page.getByRole('button', { name: /^Biomarkers/ }).click();
  await expect(summary).toContainText('6');
  await page.getByRole('button', { name: /^Specimens/ }).click();
  await expect(page.getByText('orders held', { exact: true }).locator('..')).toContainText('3');
});

test('filtered corridor references open the exact record and return to the selected card', async ({ page }) => {
  await page.goto('/');
  const arrows = page.locator('path[marker-end]');
  await expect(arrows).toHaveCount(15);
  await page.getByRole('button', { name: 'Process', exact: true }).click();
  await expect(arrows).toHaveCount(5);
  await page.getByRole('button', { name: 'Process', exact: true }).click();
  await expect(arrows).toHaveCount(15);
  await page.getByRole('button', { name: 'Accession + Plate', exact: true }).locator('..').getByTitle('Focus').click();
  for (let step = 0; step < 3; step++) await page.locator('button:has(svg.lucide-zoom-out)').click();
  const search = page.getByRole('searchbox', { name: 'Find corridor cards', exact: true });
  await search.fill('Sample Intake');
  await page.getByText('Sample Intake', { exact: true }).first().click();
  const camera = await page.locator('input[type=range]').evaluateAll(inputs => inputs.map(input => input.value));
  await page.getByRole('button', { name: 'Genomics program brief', exact: true }).click();
  await expect(page.locator('[data-record-id="notion_fragment"]')).toBeFocused();
  await page.getByPlaceholder('Search sources...').fill('nothing matches');
  await page.getByRole('button', { name: /Return to corridor/ }).click();
  await expect(search).toHaveValue('Sample Intake');
  expect(await page.locator('input[type=range]').evaluateAll(inputs => inputs.map(input => input.value))).toEqual(camera);
  await expect(page.locator('[data-corridor-card="lc_acc_intake"]')).toBeFocused();
  await page.getByRole('button', { name: 'Genomics program brief', exact: true }).click();
  await expect(page.getByPlaceholder('Search sources...')).toHaveValue('');
  await expect(page.locator('[data-record-id="notion_fragment"]')).toHaveAttribute('aria-pressed', 'true');
  await page.goBack();
  await expect(search).toHaveValue('Sample Intake');
  await expect(page.getByRole('button', { name: /Return to corridor/ })).toHaveCount(0);
  expect(await page.locator('input[type=range]').evaluateAll(inputs => inputs.map(input => input.value))).toEqual(camera);
});

test('a restored file remains shared across result aliases and workspace navigation', async ({ page }) => {
  await page.goto('/');
  const openPlate = async () => {
    await page.getByRole('button', { name: /^Lanes/ }).click();
    await page.getByRole('button', { name: 'plate', exact: true }).click();
    await page.getByRole('button', { name: /^C3 / }).first().click();
  };
  const bam = () => page.getByRole('button', { name: 'Copy S3 URI for BAM', exact: true }).locator('..').locator('..');
  await openPlate();
  await page.getByRole('tab', { name: 'R1', exact: true }).click();
  await bam().getByRole('button', { name: 'restore', exact: true }).click();
  await page.getByRole('button', { name: /^Standard 3–5 h/ }).click();
  await page.getByRole('tab', { name: 'R2', exact: true }).click();
  await expect(bam()).toContainText('≈ 4.0 h');
  await expect(bam().getByRole('button', { name: 'restore', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: /^Biomarkers/ }).click();
  await openPlate();
  await page.getByRole('tab', { name: 'R2', exact: true }).click();
  await expect(bam()).toContainText('≈ 4.0 h');
});

test('upright plate records scroll locally and interrupted release can reopen', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'plate', exact: true }).click();
  await page.getByRole('button', { name: /^C3 / }).first().click();
  const tray = page.locator('[data-scene-controls]');
  await tray.getByRole('tab', { name: 'R1', exact: true }).click();
  const columns = tray.locator('.overflow-y-auto');
  await expect.poll(() => columns.evaluateAll(elements => elements.findIndex(element => element.scrollHeight > element.clientHeight))).toBeGreaterThanOrEqual(0);
  const scrollable = columns.nth(await columns.evaluateAll(elements => elements.findIndex(element => element.scrollHeight > element.clientHeight)));
  await scrollable.hover();
  await page.mouse.wheel(0, 360);
  await expect.poll(() => scrollable.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  await expect(tray.getByRole('tab', { name: 'R1', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: /Plate overview/ }).click();
  await page.getByRole('button', { name: 'corridor', exact: true }).click();
  await page.getByRole('button', { name: 'plate', exact: true }).click();
  await page.getByRole('button', { name: /Sample history/ }).click();
  await expect(page.getByRole('button', { name: /Plate overview/ })).toBeVisible();
  await page.getByRole('button', { name: /^C3 / }).first().click();
  await expect(tray.getByRole('tab', { name: 'R1', exact: true })).toBeVisible();
});
