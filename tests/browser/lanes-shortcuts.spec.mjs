import { test, expect } from '@playwright/test';

test('Lanes scene keys preserve history, leave typing alone and release the hidden workspace', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  const corridor = page.getByRole('button', { name: 'corridor', exact: true });
  const plate = page.getByRole('button', { name: 'plate', exact: true });
  await expect(corridor).toHaveAttribute('aria-keyshortcuts', 'C');
  await expect(plate).toHaveAttribute('aria-keyshortcuts', 'P');
  await expect(corridor.locator('kbd')).toHaveText('C');
  await expect(plate.locator('kbd')).toHaveText('P');

  const search = page.getByRole('searchbox', { name: 'Find corridor cards', exact: true });
  await search.focus();
  await page.keyboard.type('pc');
  await expect(search).toHaveValue('pc');
  await expect(corridor).toHaveAttribute('aria-pressed', 'true');
  await search.fill('');
  await corridor.focus();
  // Modified, composing, repeated or already-handled input must not navigate.
  for (const options of [
    { ctrlKey: true }, { metaKey: true }, { altKey: true }, { shiftKey: true },
    { repeat: true }, { isComposing: true }, { prevented: true },
  ]) {
    await corridor.evaluate((element, options) => {
      const event = new KeyboardEvent('keydown', { key: 'p', bubbles: true, cancelable: true, ...options });
      if (options.prevented) event.preventDefault();
      element.dispatchEvent(event);
    }, options);
    await expect(corridor).toHaveAttribute('aria-pressed', 'true');
  }

  await page.keyboard.press('p');
  const scene = page.locator('[data-plate-phase]');
  await expect(plate).toHaveAttribute('aria-pressed', 'true');
  await expect(scene).toHaveAttribute('data-plate-phase', 'flat');
  await plate.focus();
  await page.keyboard.press('u');
  await expect(scene).toHaveAttribute('data-plate-phase', 'locked');
  await page.keyboard.press('Escape');
  await expect(scene).toHaveAttribute('data-plate-phase', 'flat');
  await page.getByRole('button', { name: /^C3 VUS reanalysis/ }).first().click();
  await expect(scene).toHaveAttribute('data-plate-phase', 'locked');
  await scene.getByRole('tab', { name: 'R2', exact: true }).click();
  await page.getByRole('radio', { name: 'Why', exact: true }).click();
  await page.keyboard.press('c');
  await expect(corridor).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('p');
  await expect(scene).toHaveAttribute('data-plate-phase', 'locked');
  await expect(scene.getByRole('tab', { name: 'R2', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('radio', { name: 'Why', exact: true })).toHaveAttribute('aria-checked', 'true');

  await page.keyboard.press('c');
  await page.getByRole('button', { name: 'Accession + Plate', exact: true }).locator('..').getByTitle('Focus').click();
  for (let step = 0; step < 3; step++) await page.getByRole('button', { name: 'Zoom corridor out', exact: true }).click();
  await search.fill('Sample Intake');
  await page.getByText('Sample Intake', { exact: true }).first().click();
  await page.getByRole('button', { name: 'Genomics program brief', exact: true }).click();
  await expect(page.locator('[data-record-id="notion_fragment"]')).toBeFocused();
  await page.keyboard.press('p');
  await page.getByRole('button', { name: /Return to corridor/ }).click();
  await expect(corridor).toHaveAttribute('aria-pressed', 'true');
  await expect(search).toHaveValue('Sample Intake');
  await expect(page.locator('[data-corridor-card="lc_acc_intake"]')).toBeFocused();
  expect(errors).toEqual([]);
});
