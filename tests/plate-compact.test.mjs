import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

async function moduleUrl(path, imports = {}) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  let { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } });
  for (const [specifier, url] of Object.entries(imports)) outputText = outputText.replaceAll(`'${specifier}'`, `'${url}'`);
  return `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
}
const accessTypes = await moduleUrl('../src/app/types/access.ts');
const access = await moduleUrl('../src/app/services/accessService.ts', { '../types/access': accessTypes });
const results = await moduleUrl('../src/app/data/wellResults.ts');
const availability = await moduleUrl('../src/app/services/dataAvailability.ts', { '../types/access': accessTypes, './accessService': access, '../data/wellResults': results });
const { plateFacts, platePosture } = await import(await moduleUrl('../src/app/components/plate/plateProjection.ts', { '../../services/dataAvailability': availability, './plateOverlayState': await moduleUrl('../src/app/components/plate/plateOverlayState.ts') }));
const { uprightCamera, project, PLATE_W, PLATE_H, PLATE_MARGIN } = await import(await moduleUrl('../src/app/components/plate/plateGeometry.ts', { '../../services/dataAvailability': availability, './plateOverlayState': await moduleUrl('../src/app/components/plate/plateOverlayState.ts') }));

test('compact portrait and landscape fit the upright plate and history reach above the receiving record', () => {
  for (const [width, height] of [[324, 430], [354, 430], [784, 330]]) {
    const camera = uprightCamera(width, height, true);
    const x = PLATE_W / 2 + PLATE_MARGIN;
    const y = PLATE_H / 2 + PLATE_MARGIN;
    for (const px of [-x, x]) for (const py of [-y, y]) for (const z of [0, 240]) {
      const point = project(camera, px, py, z, width, height);
      assert.ok(point.x >= 0 && point.x <= width, `History stays within ${width}px width`);
      assert.ok(point.y >= 35 && point.y <= height, 'Plate clears the controls and bottom record boundary');
    }
  }
});

test('shared plate facts and summary receive accepted restores and preserve consent precedence', () => {
  const artifact = { kind: 'bam', key: 'bam/shared.bam', createdAt: '2026-05-31', ruleId: 'lc-bam-v3', sizeBytes: 1e9,
    restore: { state: 'in_progress', tier: 'standard', requestedAt: '2026-09-28T09:00:00Z', readyAt: '2026-09-28T13:00:00Z' } };
  const active = { id: 'active', kind: 'primary', status: 'reportable', consent: 'active', runDate: '2026-05-31', artifacts: [artifact] };
  const held = { ...active, id: 'held', consent: 'rescinded' };
  const stacks = new Map([['A1', [active]], ['A2', [held]]]);
  const facts = plateFacts(stacks, {});
  assert.equal(facts.get('active').reads.state, 'restoring');
  assert.equal(facts.get('held').reads.state, 'held');
  assert.equal(facts.get('held').athena, 'excluded');
  const summary = platePosture(stacks, facts);
  assert.equal(summary.results, 2);
  assert.equal(summary.readsTotal, 1);
  assert.deepEqual(summary.readsByClass.map(({ key, count }) => ({ key, count })), [{ key: 'restoring', count: 1 }]);
});
