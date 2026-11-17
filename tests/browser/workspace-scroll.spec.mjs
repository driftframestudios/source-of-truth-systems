import { test, expect } from '@playwright/test';

const viewport = (region) => region.locator('[data-slot="scroll-area-viewport"]');

async function within(element, container) {
  const item = await element.boundingBox();
  const bounds = await container.boundingBox();
  expect(item).not.toBeNull();
  expect(bounds).not.toBeNull();
  expect(item.x).toBeGreaterThanOrEqual(bounds.x - 1);
  expect(item.y).toBeGreaterThanOrEqual(bounds.y - 1);
  expect(item.x + item.width).toBeLessThanOrEqual(bounds.x + bounds.width + 1);
  expect(item.y + item.height).toBeLessThanOrEqual(bounds.y + bounds.height + 1);
}

for (const size of [{ width: 1024, height: 768 }, { width: 1512, height: 982 }]) {
  test(`Map keeps both reference lists above its artifact strip at ${size.width}px`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto('/');
    const mapLink = page.getByRole('button', { name: 'Map', exact: true });
    await mapLink.click();
    await page.locator('#initial-load').waitFor({ state: 'hidden' });
    const linkBefore = await mapLink.boundingBox();
    const strip = page.getByRole('region', { name: 'Artifact lineage', exact: true });
    const requirements = page.getByRole('region', { name: 'Map release requirements', exact: true });
    const landmarks = page.getByRole('region', { name: 'Map landmarks', exact: true });
    const graph = page.getByRole('region', { name: 'Source relationship graph', exact: true });
    await within(strip, page.locator('main'));
    const stripTop = (await strip.boundingBox()).y;
    for (const region of [requirements, landmarks, graph]) {
      const bounds = await region.boundingBox();
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(stripTop + 1);
    }
    const finalRequirement = requirements.getByText('S3-PREFIX-001', { exact: true }).locator('..').locator('..').locator('..').locator('..');
    await finalRequirement.scrollIntoViewIfNeeded();
    await within(finalRequirement, viewport(requirements));
    await expect.poll(() => viewport(requirements).evaluate(el => el.scrollTop)).toBeGreaterThan(0);
    const finalLandmark = landmarks.getByText('The Artifact Lineage', { exact: true }).locator('..').locator('..');
    await finalLandmark.scrollIntoViewIfNeeded();
    await within(finalLandmark, viewport(landmarks));
    await expect.poll(() => viewport(landmarks).evaluate(el => el.scrollTop)).toBeGreaterThan(0);
    const referenceScroll = await viewport(requirements).evaluate(el => el.scrollTop);
    await graph.hover();
    await page.mouse.wheel(240, 300);
    await expect.poll(() => graph.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
    await expect.poll(() => graph.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
    expect(await viewport(requirements).evaluate(el => el.scrollTop)).toBe(referenceScroll);
    expect(await mapLink.boundingBox()).toEqual(linkBefore);
    await within(strip, page.locator('main'));
    await page.screenshot({ path: `.visual-runs/map-contained-${size.width}.png` });
  });

  test(`final requirement and decision remain inspectable after filtering at ${size.width}px`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto('/');
    await page.getByRole('button', { name: /^Requirements/ }).click();
    await page.locator('#initial-load').waitFor({ state: 'hidden' });
    const requirements = page.getByRole('region', { name: 'Requirements records', exact: true });
    const last = requirements.locator('[data-record-id="AUTOSCALE-PRED-001"]');
    await last.click();
    await expect(last).toHaveAttribute('aria-expanded', 'true');
    const detail = last.locator('..');
    const defer = detail.getByRole('button', { name: 'Defer', exact: true });
    await defer.scrollIntoViewIfNeeded();
    await within(defer, viewport(requirements));
    await within(detail.getByRole('status'), viewport(requirements));
    await expect(defer).toBeEnabled();
    if (size.width === 1024) await expect.poll(() => viewport(requirements).evaluate(el => el.scrollTop)).toBeGreaterThan(0);
    await page.getByRole('button', { name: 'Deferred', exact: true }).click();
    await expect(requirements.locator('[data-record-id]')).toHaveCount(3);
    await expect(last).toHaveAttribute('aria-expanded', 'true');
    await page.getByRole('button', { name: 'All', exact: true }).click();
    await defer.scrollIntoViewIfNeeded();
    await within(detail, viewport(requirements));
    await page.screenshot({ path: `.visual-runs/requirements-contained-${size.width}.png` });

    await page.getByRole('button', { name: /^Decisions/ }).click();
    const decisions = page.getByRole('region', { name: 'Decisions records', exact: true });
    const record = decisions.locator('[data-record-id="DEC-003"]');
    const confirm = record.getByRole('button', { name: 'Confirm', exact: true });
    await confirm.scrollIntoViewIfNeeded();
    await within(record, viewport(decisions));
    await expect(confirm).toBeDisabled();
    await expect.poll(() => viewport(decisions).evaluate(el => el.scrollTop)).toBeGreaterThan(0);
    await page.getByRole('button', { name: 'Future', exact: true }).click();
    await expect(decisions.locator('[data-record-id]')).toHaveCount(1);
    await expect(decisions.locator('[data-record-id="DEC-007"]')).toBeVisible();
    await page.getByRole('button', { name: 'All releases', exact: true }).click();
    await confirm.scrollIntoViewIfNeeded();
    await within(record, viewport(decisions));
    await within(page.getByRole('button', { name: 'All releases', exact: true }), page.locator('main'));
    await page.screenshot({ path: `.visual-runs/decisions-contained-${size.width}.png` });

    await page.getByRole('button', { name: /^Comparisons/ }).click();
    const comparison = page.getByRole('region', { name: 'Container Image References', exact: true });
    await comparison.getByRole('button', { name: 'Reopen', exact: true }).scrollIntoViewIfNeeded();
    await within(comparison, page.locator('[data-slot="scroll-area-viewport"]'));
  });

  test(`Cohort compiled rule and consent explanation wrap inside their rail at ${size.width}px`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto('/');
    await page.getByRole('button', { name: 'Cohort Builder', exact: true }).click();
    await page.locator('#initial-load').waitFor({ state: 'hidden' });
    if (size.width < 1280) await page.getByRole('button', { name: 'Rule & saved', exact: true }).click();
    const compiled = page.getByRole('complementary', { name: 'Compiled cohort rule', exact: true });
    const consent = compiled.getByText(/The Consent Registry holds specimens/);
    await consent.scrollIntoViewIfNeeded();
    await within(consent, viewport(compiled));
    const expression = compiled.locator('pre');
    await expression.scrollIntoViewIfNeeded();
    await within(expression, viewport(compiled));
    expect(await expression.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
    expect(await viewport(compiled).evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
    await page.getByRole('button', { name: 'Save rule', exact: true }).click();
    const saved = compiled.getByRole('button', { name: /^Open rule Tumor-board ready/ });
    await saved.scrollIntoViewIfNeeded();
    await within(saved, viewport(compiled));
    await page.screenshot({ path: `.visual-runs/cohort-contained-${size.width}.png` });
  });
}
