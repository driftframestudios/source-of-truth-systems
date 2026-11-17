import { test, expect } from '@playwright/test';

const firstDeck = 'KRAS G12C Defense';
const secondDeck = 'T-DXd · HER2-low and Ultralow';
const cover = (page, title) => page.getByRole('article', { name: title, exact: true }).locator(':scope > div').first();
const openDeck = (page, title) => page.getByRole('article', { name: title, exact: true }).getByRole('button', { name: 'Open brief' }).click();

test('curated deck identities remain distinct until a shared style is deliberately selected', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: /^Presentations/ }).click();
  const styles = page.getByRole('group', { name: 'Presentation styles' });
  const originals = styles.getByRole('button', { name: /^Deck styles/ });
  await expect(originals).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('article', { name: firstDeck, exact: true })).toContainText('Blueprint');
  await expect(page.getByRole('article', { name: secondDeck, exact: true })).toContainText('Deep Meridian');
  const blueprint = await cover(page, firstDeck).evaluate(node => getComputedStyle(node).backgroundImage);
  const meridian = await cover(page, secondDeck).evaluate(node => getComputedStyle(node).backgroundImage);
  expect(blueprint).not.toBe(meridian);

  await openDeck(page, firstDeck);
  await expect(page.locator('.presentation-document')).toHaveCSS('background-image', blueprint);
  await page.getByRole('button', { name: 'Next section', exact: true }).click();
  await expect(page.locator('[data-slide]')).toContainText('Switch to RMC-6236 trial arm. Hold ICI.');
  await page.keyboard.press('Escape');
  await expect(originals).toHaveAttribute('aria-pressed', 'true');
  await openDeck(page, secondDeck);
  await expect(page.locator('.presentation-document')).toHaveCSS('background-image', meridian);
  await page.getByRole('button', { name: 'Back to library' }).click();

  const spectrum = styles.getByRole('button', { name: /^Spectrum/ });
  await spectrum.click();
  await expect(spectrum).toHaveAttribute('aria-pressed', 'true');
  const shared = await cover(page, firstDeck).evaluate(node => getComputedStyle(node).backgroundImage);
  expect(shared).not.toBe(blueprint);
  await expect(cover(page, secondDeck)).toHaveCSS('background-image', shared);
  await openDeck(page, secondDeck);
  await expect(page.locator('.presentation-document')).toHaveCSS('background-image', shared);
  await page.getByRole('button', { name: 'Back to library' }).click();
  await expect(spectrum).toHaveAttribute('aria-pressed', 'true');
  await originals.click();
  await expect(cover(page, firstDeck)).toHaveCSS('background-image', blueprint);
  await expect(cover(page, secondDeck)).toHaveCSS('background-image', meridian);
  await expect(originals).toHaveCSS('background-color', 'rgb(24, 60, 59)');
  await page.screenshot({ path: '.visual-runs/presentation-deck-styles.png', fullPage: true });
  await page.getByRole('group', { name: 'Appearance', exact: true }).getByRole('radio', { name: 'Light', exact: true }).check();
  const blueprintStyle = styles.getByRole('button', { name: /^Blueprint/ });
  await blueprintStyle.click();
  await expect(blueprintStyle).toHaveCSS('background-color', 'rgb(204, 234, 228)');
  await expect(blueprintStyle.getByText('Blueprint', { exact: true })).toHaveCSS('color', 'rgb(7, 89, 77)');
  await page.screenshot({ path: '.visual-runs/presentation-style-light.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('artifact briefs retain their picks and use the selected style', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /^Presentations/ }).click();
  const composer = page.getByRole('region', { name: 'Compose an artifact brief' });
  const generate = composer.getByRole('button', { name: /^Generate Brief/ });
  await expect(generate).toBeDisabled();
  const artifact = composer.locator('button[aria-pressed="false"]').first();
  await artifact.click();
  await expect(generate).toHaveText('Generate Brief · 1');
  const blueprint = await cover(page, firstDeck).evaluate(node => getComputedStyle(node).backgroundImage);
  await generate.click();
  await expect(page.locator('.presentation-document')).toHaveCSS('background-image', blueprint);
  await page.getByRole('button', { name: 'Back to library' }).click();
  await expect(composer.getByRole('button', { pressed: true })).toHaveCount(1);

  await page.getByRole('group', { name: 'Presentation styles' }).getByRole('button', { name: /^Deep Meridian/ }).click();
  const meridian = await cover(page, firstDeck).evaluate(node => getComputedStyle(node).backgroundImage);
  await generate.click();
  await expect(page.locator('.presentation-document')).toHaveCSS('background-image', meridian);
  await page.keyboard.press('Escape');
  await expect(generate).toHaveText('Generate Brief · 1');
  await expect(page.getByRole('group', { name: 'Presentation styles' }).getByRole('button', { name: /^Deep Meridian/ })).toHaveAttribute('aria-pressed', 'true');
});
