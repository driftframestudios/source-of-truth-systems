import { test, expect } from '@playwright/test';

test('reference collections expose bounded release, artifact and QC actions', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /^Requirements/ }).click();
  await page.getByText('PIPE-STAGE-001', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Defer', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Supersede', exact: true })).toBeDisabled();
  await expect(page.getByRole('combobox', { name: 'Replacement for PIPE-STAGE-001' })).toBeVisible();
  await expect(page.getByText('Every pipeline run inherits', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: /^Artifacts/ }).click();
  await page.locator('[data-record-id="arc01_pass1"]').click();
  await expect(page.getByRole('button', { name: 'Prepare revision', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Check local references', exact: true })).toBeEnabled();
  await expect(page.getByText('Recorded acceptance checks', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /^Decisions/ }).click();
  await expect(page.getByRole('button', { name: 'Confirm', exact: true }).first()).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Revisit', exact: true }).first()).toBeEnabled();
  await expect(page.getByText('Changes stay in this browser session.').first()).toBeVisible();
  await page.getByRole('button', { name: /^Quality Control/ }).click();
  const extraction = page.locator('[data-gate-id="qcg_extract"]');
  await extraction.getByRole('button', { name: 'Acknowledge', exact: true }).click();
  await expect(extraction.getByRole('status')).toHaveText('Acknowledged');
  await expect(page.getByText('Run held — blocking gate failed', { exact: true })).toBeVisible();
});

test('a saved cohort rule reports session lifetime and keeps consent-held specimens excluded', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Cohort Builder', exact: true }).click();
  await page.getByRole('button', { name: 'Save rule', exact: true }).click();
  await expect(page.getByRole('status', { name: 'Cohort rule result' })).toHaveText('Rule saved for this browser session.');
  await expect(page.getByText('Counts follow current records. Reloading the page clears saved rules.', { exact: true })).toBeVisible();
  await expect(page.getByText('Saved this session', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Open rule Tumor-board ready/ })).toBeVisible();
  await expect(page.getByText(/remain excluded from eligible cohort/)).toBeVisible();
  await expect(page.getByText(/Committed to CodeCommit|materialized to S3/)).toHaveCount(0);
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.locator('#initial-load').waitFor({ state: 'hidden' });
  await page.screenshot({ path: '.visual-runs/cohort-truthful-snapshot.png' });
});

test('Profile keeps consumed preferences and explicit external-delivery availability beside diagnostic previews', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await page.getByRole('button', { name: 'Preferences', exact: true }).click();
  const preferences = page.getByRole('region', { name: 'Workspace preferences' });
  await expect(preferences.getByRole('switch', { name: 'Informational toasts', exact: true })).toBeChecked();
  await expect(preferences.getByRole('radio', { name: 'Dark', exact: true })).toBeChecked();
  await expect(preferences.getByRole('button', { name: 'Reset notification preferences' })).toBeEnabled();
  for (const name of ['Compact density', 'Animate lane traversal', 'Mirror reflections', 'Auto-resolve comparisons']) {
    await expect(page.getByRole('switch', { name, exact: true })).toHaveCount(0);
  }
  await expect(page.getByRole('combobox', { name: 'Default view', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Notifications', exact: true }).click();
  await expect(page.getByText('Slack, email and mobile push delivery are unavailable.')).toBeVisible();
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.getByRole('button', { name: 'Connections', exact: true }).click();
  await page.locator('#initial-load').waitFor({ state: 'hidden' });
  await page.screenshot({ path: '.visual-runs/profile-connection-previews.png' });
  await page.getByRole('button', { name: 'Preview connection notice', exact: true }).first().click();
  await expect(page.getByText('Connection notice preview', { exact: true })).toBeVisible();
  await expect(page.getByText(/example authentication-expired notice\. Connection status and workflows are unchanged\./)).toBeVisible();
  await page.getByRole('button', { name: 'Preview banner', exact: true }).first().click();
  await expect(page.getByText('Connection banner preview', { exact: true })).toBeVisible();
  await expect(page.getByText(/example offline notice\. Connection status and workflows are unchanged\./)).toBeVisible();
  await expect(page.getByText(/Workflows depending on it are paused/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Infrastructure', exact: true }).click();
  await expect(page.getByText('Example AWS footprint', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Error Lab', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Clear example error log', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'success toast', exact: true }).click();
  await expect(page.getByText('This previews the success style; workspace preferences are unchanged.')).toBeVisible();
});
