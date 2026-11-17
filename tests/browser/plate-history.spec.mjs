import { test, expect } from '@playwright/test';

for (const mobile of [false, true]) {
  test.describe(mobile ? 'Mobile selected history' : 'Desktop selected history', () => {
    test.use(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : {});

    test('stored records render through opaque IDs and recover explicitly from an unavailable read', async ({ page }) => {
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      let reads = 0, unavailable = true;
      await page.route('**/graphql', async (route) => {
        const { variables } = route.request().postDataJSON();
        if (variables.id === 'E3' && unavailable) {
          await route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
          return;
        }
        const response = await route.fetch();
        const body = await response.json();
        if (variables.id === 'C3') {
          reads++;
          body.data.dataSource.mode = 'STORED';
          const nodes = body.data.well.history.edges.map(({ node }) => node);
          const ids = new Map(nodes.map((node, index) => [node.id, `stored-record-${index}`]));
          for (const node of nodes) {
            node.id = ids.get(node.id);
            node.title = `Stored result ${node.label}`;
            if (node.supersedes) node.supersedes.id = ids.get(node.supersedes.id);
            for (const { node: artifact } of node.artifacts.edges) {
              if (artifact.reusedFrom) artifact.reusedFrom.id = ids.get(artifact.reusedFrom.id);
            }
          }
        }
        await route.fulfill({ response, json: body });
      });
      await page.goto('/');
      if (mobile) {
        await page.getByRole('button', { name: 'Plate', exact: true }).click();
        await page.getByText('All result stories & lifecycle policies', { exact: true }).click();
      } else {
        await page.getByRole('button', { name: 'plate', exact: true }).click();
        await page.getByRole('button', { name: /Sample history/ }).click();
        await expect(page.locator('[data-plate-phase]')).toHaveAttribute('data-plate-phase', 'locked');
        await page.locator('[data-result-id="RES-C3-00"]').dispatchEvent('pointerover', { pointerId: 1, pointerType: 'mouse', bubbles: true });
        await expect(page.getByRole('tab', { name: 'R1', exact: true })).toBeVisible();
        expect(reads).toBe(0);
        await expect(page.locator('.plate-history-source')).toContainText('C3 history');
        await expect(page.locator('.plate-history-source')).toHaveAttribute('data-history-phase', 'idle');
      }
      await page.getByRole('button', { name: /^C3 VUS reanalysis/ }).first().click();
      const source = page.locator('.plate-history-source');
      await expect(source).toContainText('Stored history');
      const record = mobile ? page.locator('.plate-compact-record') : page.locator('[data-scene-controls]');
      await record.getByRole('tab', { name: 'R1', exact: true }).click();
      await expect(record).toContainText('Stored result R1');
      if (mobile) await record.getByRole('button', { name: 'Files', exact: true }).click();
      const bam = record.getByRole('button', { name: 'Copy S3 URI for BAM', exact: true }).locator('..').locator('..');
      await bam.getByRole('button', { name: 'restore', exact: true }).click();
      await record.getByRole('button', { name: /^Standard 3–5 h/ }).click();
      await record.getByRole('tab', { name: 'R2', exact: true }).click();
      await expect(record).toContainText('Stored result R2');
      await expect(bam).toContainText('≈ 4.0 h');
      if (mobile) {
        await page.getByRole('button', { name: 'Corridor', exact: true }).click();
        await page.getByRole('button', { name: 'Plate', exact: true }).click();
      } else {
        await page.getByRole('button', { name: /^Biomarkers/ }).click();
        await page.getByRole('button', { name: /^Lanes/ }).click();
        await page.getByRole('button', { name: 'plate', exact: true }).click();
        await page.getByRole('button', { name: /^C3 VUS reanalysis/ }).first().click();
      }
      await expect(source).toContainText('Stored history');
      expect(reads).toBe(1);
      await page.getByRole('button', { name: /^E3 / }).first().click();
      await expect(source).toContainText('Example history · source unavailable');
      unavailable = false;
      await source.getByRole('button', { name: 'Retry history' }).click();
      await expect(source).toContainText('Example history');
      await expect(source).not.toContainText('unavailable');
      if (!mobile) {
        await record.getByTitle('Unpin — hover follows the cursor again').click();
        await page.locator('[data-result-id="stored-record-0"]').dispatchEvent('pointerover', { pointerId: 1, pointerType: 'mouse', bubbles: true });
        await expect(record).toContainText('Stored result R1');
        await expect(source).toContainText('C3 history');
        await expect(source).toContainText('Stored history');
        await expect(source).toHaveAttribute('data-history-phase', 'ready');
        expect(reads).toBe(1);
      }
      if (mobile) expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
      expect(errors).toEqual([]);
    });
  });
}
