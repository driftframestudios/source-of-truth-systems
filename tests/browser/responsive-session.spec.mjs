import { test, expect } from '@playwright/test';

const desktop = { width: 1512, height: 982 };
const mobile = { width: 390, height: 844 };
const bamFor = (record) => record.getByRole('button', { name: 'Copy S3 URI for BAM', exact: true }).locator('..').locator('..');

test('accepted records, comparison and refusal context survive a responsive round trip', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /^Specimens/ }).click();
  const specimen = page.getByRole('article', { name: 'SPX-2026-0481 card', exact: true });
  await specimen.getByRole('button', { name: 'hold', exact: true }).click();
  await page.getByRole('button', { name: 'Profile', exact: true }).first().click();
  await page.getByRole('combobox', { name: 'Showcase persona' }).selectOption('prin_okafor');
  await page.getByRole('button', { name: /RES.*us-west/ }).click();
  await page.getByRole('option', { name: /^STG/ }).click();
  await page.getByRole('button', { name: /^Biomarkers/ }).click();
  const marker = page.locator('div.p-3.rounded.border').filter({ has: page.getByText('KRAS', { exact: true }) });
  await marker.getByRole('button', { name: '→ approved', exact: true }).click();
  await page.getByRole('button', { name: /^Comparisons/ }).click();
  const comparison = page.getByRole('region', { name: 'Pipeline Stage Bound to LIMS Specimen State', exact: true });
  await comparison.getByRole('button', { name: 'Resolve', exact: true }).click();
  await page.getByRole('button', { name: /STG.*us-east/ }).click();
  await page.getByRole('option', { name: /PROD.*Production/ }).click();
  await page.getByRole('button', { name: /^Biomarkers/ }).click();
  await marker.getByRole('button', { name: '→ signed off', exact: true }).click();
  const refusal = page.getByText(/Write actions are disabled in the PROD scenario/).first();
  await expect(refusal).toBeVisible();

  await page.setViewportSize(mobile);
  await page.getByRole('button', { name: 'Plate', exact: true }).click();
  const environment = page.getByRole('combobox', { name: 'Plate environment' });
  await expect(environment).toHaveValue('prod');
  // An unsupported caller value retains the accepted read-only environment.
  await environment.evaluate((element) => {
    element.add(new Option('Unsupported environment', 'unsupported'));
    element.value = 'unsupported';
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(environment).toHaveValue('prod');
  // This persona has no Plate-map grant here; the receiving view keeps the refusal and hides record controls.
  await expect(page.locator('.mobile-plate-stories button')).toHaveCount(0);
  await expect(page.locator('.plate-compact-record')).toHaveCount(0);
  await expect(refusal).toBeVisible();

  await page.setViewportSize(desktop);
  await expect(refusal).toBeVisible();
  await expect(page.getByRole('button', { name: /PROD.*us-east/ })).toBeVisible();
  await page.getByRole('button', { name: /^Specimens/ }).click();
  await expect(specimen.getByRole('button', { name: '→ release hold', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /^Biomarkers/ }).click();
  await expect(marker.getByRole('button', { name: '→ signed off', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /^Comparisons/ }).click();
  await expect(comparison.getByRole('status')).toHaveText('Resolved');
  await comparison.getByRole('button', { name: 'Reopen', exact: true }).click();
  await expect(comparison.getByRole('status')).toHaveText('Resolved');

  await page.reload();
  await expect(page.getByRole('button', { name: /RES.*us-west/ })).toBeVisible();
  await page.getByRole('button', { name: /^Specimens/ }).click();
  await expect(specimen.getByRole('button', { name: 'hold', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /^Comparisons/ }).click();
  await expect(comparison.getByRole('status')).toHaveText('Pending');
});

test('stored history and a shared file restore remain available across both layouts', async ({ page }) => {
  let reads = 0;
  await page.route('**/graphql', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    if (route.request().postDataJSON().variables.id === 'C3') {
      reads++;
      body.data.dataSource.mode = 'STORED';
      for (const { node } of body.data.well.history.edges) node.title = `Stored result ${node.label}`;
    }
    await route.fulfill({ response, json: body });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'plate', exact: true }).click();
  await page.getByRole('button', { name: /^C3 VUS reanalysis/ }).first().click();
  const record = page.locator('[data-scene-controls]');
  await expect(record).toContainText('Stored result');
  await record.getByRole('tab', { name: 'R1', exact: true }).click();
  await bamFor(record).getByRole('button', { name: 'restore', exact: true }).click();
  await record.getByRole('button', { name: /^Standard 3–5 h/ }).click();
  await record.getByRole('tab', { name: 'R2', exact: true }).click();

  await page.setViewportSize(mobile);
  const compactRecord = page.locator('.plate-compact-record');
  await expect(compactRecord).toContainText('Stored result R2');
  await compactRecord.getByRole('button', { name: 'Files', exact: true }).click();
  await expect(bamFor(compactRecord)).toContainText('≈ 4.0 h');
  await compactRecord.getByRole('tab', { name: 'R1', exact: true }).click();
  await expect(bamFor(compactRecord)).toContainText('≈ 4.0 h');
  await page.setViewportSize(desktop);
  await expect(record).toContainText('Stored result R1');
  await expect(bamFor(record)).toContainText('≈ 4.0 h');
  expect(reads).toBe(1);
});

test('a repair resumes its accepted deadline after the receiving Plate chunk arrives', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let release;
  const download = new Promise((resolve) => { release = resolve; });
  await page.route('**/MobilePlate-*.js', async (route) => { await download; await route.continue(); });
  await page.goto('/');
  // A9 is clinical data: choose its permitted persona and an analysis role before recovery.
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await page.getByRole('combobox', { name: 'Showcase persona' }).selectOption('prin_okafor');
  await page.getByRole('group', { name: 'Workspace role' }).getByRole('button', { name: 'Analyst', exact: true }).click();
  await page.getByRole('button', { name: /RES.*us-west/ }).click();
  await page.getByRole('option', { name: /^STG/ }).click();
  await page.getByRole('button', { name: /^Lanes/ }).click();
  await page.getByRole('button', { name: 'plate', exact: true }).click();
  await page.getByRole('button', { name: /^A9 / }).first().click();
  const record = page.locator('[data-scene-controls]');
  await record.getByRole('tab', { name: 'T1', exact: true }).click();
  await record.getByRole('button', { name: 'Repair partition', exact: true }).click();
  await page.setViewportSize(mobile);
  await expect(page.getByRole('status').filter({ hasText: 'Opening plate' })).toBeVisible();
  // Hold the receiving module beyond the 2.4s repair deadline; its timer is unmounted.
  await page.waitForTimeout(2600);
  await expect(page.getByText('Partition registered', { exact: true })).toHaveCount(0);
  release();
  const compactRecord = page.locator('.plate-compact-record');
  await compactRecord.getByRole('button', { name: 'Lifecycle', exact: true }).click();
  await expect(compactRecord).toContainText('Queryable — repaired this session', { timeout: 1000 });
  await expect(page.getByText('Partition registered', { exact: true })).toHaveCount(1);
  await page.setViewportSize(desktop);
  await expect(record).toContainText('Queryable — repaired this session');
  await expect(page.getByText('Partition registered', { exact: true })).toHaveCount(1);
});
