import { test, expect } from '@playwright/test';

test('initial HTML shows the plate while entry downloads, then releases the ready workspace', async ({ page }) => {
  let release;
  const downloading = new Promise(resolve => { release = resolve; });
  await page.route('**/assets/index-*.js', async route => { await downloading; await route.continue(); });
  await page.goto('/', { waitUntil: 'commit' });
  await expect(page.locator('#initial-load')).toContainText('Initializing system');
  await expect(page.locator('.plate-loading__plate')).toBeVisible();
  release();
  await expect(page.getByRole('button', { name: 'Map', exact: true })).toBeVisible();
  await expect(page.locator('#initial-load')).toHaveCount(0);
  await expect(page.locator('.deferred-reveal')).toHaveCount(0);
});

test('a deferred Plate stays local, survives navigation away and settles without motion', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let release;
  const downloading = new Promise(resolve => { release = resolve; });
  await page.route('**/MobilePlate-*.js', async route => { await downloading; await route.continue(); });
  await page.goto('/');
  await page.getByRole('button', { name: 'Plate', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Opening plate…');
  const animation = await page.locator('.plate-loading__plate i').first().evaluate(el => getComputedStyle(el).animationName);
  expect(animation).toBe('none');
  await page.getByRole('button', { name: 'Corridor', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Accession + Plate' })).toBeVisible();
  release();
  await page.getByRole('button', { name: 'Plate', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Inside the plate.' })).toBeVisible();
  await expect(page.locator('.plate-loading')).toHaveCount(0);
});

test('an entry download failure offers reload instead of endless initialization', async ({ page }) => {
  await page.route('**/assets/index-*.js', route => route.abort('failed'));
  await page.goto('/');
  await expect(page.locator('#initial-load')).toHaveAttribute('data-phase', 'failed');
  await expect(page.getByText('The application couldn’t load.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reload to try again' })).toBeVisible();
  await page.unroute('**/assets/index-*.js');
  await page.getByRole('button', { name: 'Reload to try again' }).click();
  await expect(page.getByRole('button', { name: 'Map', exact: true })).toBeVisible();
  await expect(page.locator('#initial-load')).toHaveCount(0);
});

test('production CSP blocks inserted script and event attributes while the app remains usable', async ({page}) => {
  const response = await page.goto('/');
  expect(response.headers()['content-security-policy']).toContain("script-src-attr 'none'");
  await expect(page.getByRole('button', {name:'Map',exact:true})).toBeVisible();
  await page.evaluate(() => {
    window.policyObservations = [];
    document.addEventListener('securitypolicyviolation', event => window.policyObservations.push(event.effectiveDirective));
    const script = document.createElement('script');
    script.textContent = 'window.untrustedScriptRan = true';
    document.body.append(script);
    const button = document.createElement('button');
    button.setAttribute('onclick', 'window.untrustedAttributeRan = true');
    document.body.append(button);
    button.click();
    button.remove(); script.remove();
  });
  await expect.poll(() => page.evaluate(() => window.policyObservations)).toEqual(expect.arrayContaining(['script-src-elem','script-src-attr']));
  expect(await page.evaluate(() => Boolean(window.untrustedScriptRan || window.untrustedAttributeRan))).toBe(false);
  await page.getByRole('button', {name:/^Lanes\b/}).click();
  await page.getByRole('button', {name:'plate',exact:true}).click();
  await expect(page.locator('[data-plate-phase]')).toBeVisible();
});
