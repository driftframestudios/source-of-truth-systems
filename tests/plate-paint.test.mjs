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
const availability = await moduleUrl('../src/app/services/dataAvailability.ts', { './accessService': access, '../data/wellResults': results });
const geometry = await moduleUrl('../src/app/components/plate/plateGeometry.ts', { '../../services/dataAvailability': availability });
const { discPaint, discBackground, legendFor, plateColor } = await import(await moduleUrl('../src/app/components/plate/stackLens.ts', {
  '../../services/dataAvailability': availability, '../../data/wellResults': results, './plateGeometry': geometry,
}));
const result = { kind: 'reanalysis', status: 'reportable' };
const facts = { athena: 'ready' };

test('High contrast pairs category color with a face cue and the same labelled key', () => {
  for (const [kind, label, color, pattern] of [
    ['reanalysis', 'Reanalysis', '#87c9ff', 'bar'],
    ['orthogonal', 'Orthogonal', '#ffd166', 'dot'],
  ]) {
    const paint = discPaint({ ...result, kind }, 'kind', facts, 'contrast');
    assert.equal(paint.base, color);
    assert.equal(paint.pattern, pattern);
    const item = legendFor('kind', 'contrast').find((entry) => entry.label.startsWith(label));
    assert.equal(discBackground(paint), discBackground({ base: item.color, pattern: item.pattern }));
  }
  const ready = discPaint(result, 'athena', facts, 'contrast');
  assert.equal(ready.pattern, 'dot', 'the shared green hue keeps its cue in the query lens');
  assert.equal(ready.base, plateColor('#34d399', 'contrast'), 'record companion ink shares the category hue');
});

test('existing consent, cancellation and frozen-file patterns keep priority over category marks', () => {
  assert.equal(discPaint({ ...result, status: 'held' }, 'kind', facts, 'contrast').pattern, 'hatch');
  assert.equal(discPaint({ ...result, status: 'cancelled' }, 'kind', facts, 'contrast').pattern, 'hollow');
  const frozen = { ...facts, reads: { position: { current: 'glacier_flexible' }, state: 'frozen' } };
  assert.equal(discPaint(result, 'storage', frozen, 'contrast').pattern, 'frost');
  assert.equal(legendFor('storage', 'contrast').find((item) => item.label.startsWith('Glacier Flexible')).pattern, 'frost');
});

test('Dark and Light preserve the established green/violet colors and unmarked faces', () => {
  for (const [mode, colors] of [['dark', ['#34d399', '#a78bfa']], ['light', ['#1d7454', '#5c4c8a']]]) {
    for (const [index, kind] of ['orthogonal', 'reanalysis'].entries()) {
      const paint = discPaint({ ...result, kind }, 'kind', facts, mode);
      assert.equal(paint.base, colors[index]);
      assert.equal(paint.pattern, undefined);
      assert.equal(discBackground(paint), discBackground({ base: colors[index] }));
    }
  }
});


test('failed QC retains one High contrast diagonal across lenses, with consent precedence', () => {
  const failed = { ...result, status: 'failed_qc', consent: 'active' };
  const frozen = { ...facts, reads: { position: { current: 'glacier_flexible' }, state: 'frozen' } };
  for (const lens of ['status', 'kind', 'storage', 'athena']) {
    const paint = discPaint(failed, lens, frozen, 'contrast');
    assert.equal(paint.mark, 'failed_qc');
    assert.ok(discBackground(paint).startsWith('linear-gradient(135deg,'));
    assert.equal(legendFor(lens, 'contrast').find((item) => item.mark === 'failed_qc').label.includes('QC'), true);
    for (const consent of ['rescinded', 'pending']) {
      assert.equal(discPaint({ ...failed, consent }, lens, frozen, 'contrast').mark, undefined);
    }
    for (const mode of ['dark', 'light']) assert.equal(discPaint(failed, lens, frozen, mode).mark, undefined);
  }
  assert.equal(discPaint(failed, 'storage', frozen, 'contrast').pattern, 'frost', 'quality and storage keep independent meaning');
});
