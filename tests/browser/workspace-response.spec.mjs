import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// The route supplies protocol fixtures; engine persistence has its separate hosted proof.
test('a malformed history refresh retains the accepted same-scope history and saved metadata', async ({ page }) => {
  const names = ['WorkspaceStatus', 'WorkspaceSnapshot', 'WorkspaceHistory', 'SaveSource'];
  const hashes = new Map(await Promise.all(names.map(async name => [createHash('sha256').update(await readFile(new URL(`../../server/workspaces/operations/${name}.graphql`, import.meta.url))).digest('hex'), name])));
  const workspace = { id: 'fixture-workspace', createdAt: '2026-11-20T00:00:00Z', expiresAt: '2026-11-21T00:00:00Z', eventCount: 1 };
  let reads = 0;
  await page.route('**/workspace/graphql', async route => {
    const request = route.request().postDataJSON();
    const name = hashes.get(request.extensions.persistedQuery.sha256Hash);
    if (!name) return route.continue();
    const value = { code: 'OK', message: 'Accepted', workspace };
    if (name === 'WorkspaceStatus') value.available = true;
    if (name === 'WorkspaceSnapshot') value.sources = [];
    if (name === 'WorkspaceHistory') value.events = ++reads === 1 ? [{ id: 'event1', sourceId: 'yaml_context', action: 'save', createdAt: workspace.createdAt, expectedRevision: 0, resultRevision: 1, actor: { principalId: 'prin_self', roleId: 'arc_lead', environment: 'res' } }] : { malformed: true };
    if (name === 'SaveSource') Object.assign(value, { workspace: { ...workspace, eventCount: 2 }, source: { id: request.variables.input.id, revision: 1, ...request.variables.input.metadata }, changed: true, replayed: false });
    await route.fulfill({ json: { data: { [name[0].toLowerCase() + name.slice(1)]: value } } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: /^Sources/ }).click();
  await page.locator('[data-record-id="yaml_context"]').click();
  const details = page.getByLabel('Source details', { exact: true });
  await details.getByText('Saved source edits', { exact: true }).click();
  await expect(details).toContainText('Metadata saved · revision 1');
  await details.getByRole('button', { name: 'Edit metadata', exact: true }).click();
  const editor = details.getByRole('form', { name: 'Edit source metadata' });
  await editor.getByLabel('Display title', { exact: true }).fill('Accepted metadata');
  await editor.getByRole('button', { name: 'Save metadata' }).click();
  await expect(details.getByRole('heading', { name: 'Accepted metadata' })).toBeVisible();
  await expect(details.locator('.sources-view__history')).toContainText('Keep your draft and retry');
  await expect(details).toContainText('Metadata saved · revision 1');
});
