import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
import { exampleData } from '../build/server/example-data.mjs';
import { runningServer } from './server-fixture.mjs';
import { PLATE_HISTORY_HASH } from '../shared/plate-history-operation.mjs';

async function moduleUrl(path, imports = {}) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  let { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } });
  for (const [specifier, url] of Object.entries(imports)) outputText = outputText.replaceAll(`'${specifier}'`, `'${url}'`);
  return `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
}
const results = await moduleUrl('../src/app/data/wellResults.ts');
const { parsePlateHistory } = await import(await moduleUrl('../src/app/services/plateHistory/read.ts', {
  '../../../../shared/plate-records.mjs': new URL('../shared/plate-records.mjs', import.meta.url).href,
  '../../../../shared/plate-history-operation.mjs': new URL('../shared/plate-history-operation.mjs', import.meta.url).href,
  '../../data/wellResults': results,
}));
const { requestLatestHistory } = await import(await moduleUrl('../src/app/services/plateHistory/request.ts'));
const { indexResultWells } = await import(await moduleUrl('../src/app/components/plate/plateState.ts'));
test('the registered history operation retains permitted records and withholds protected detail', async (t) => {
  const base = await runningServer(t);
  const histories = new Map();
  for (const id of ['B4', 'C3']) {
    const response = await fetch(`${base}/graphql`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ extensions: { persistedQuery: { version: 1, sha256Hash: PLATE_HISTORY_HASH } }, variables: { plateId: exampleData.plateId, id } }),
    });
    const received = parsePlateHistory(await response.json(), exampleData.plateId, id);
    assert.equal(received.mode, 'EXAMPLE');
    assert.equal(received.missing, false);
    histories.set(id, received);
  }

  const b4 = histories.get('B4');
  assert.deepEqual(b4.results.map(({ label }) => label), ['T0', 'N0', 'T1', 'T2', 'T3', 'T4', 'T4r', 'T5']);
  assert.equal(b4.results[0].title, 'primary result');
  for (const result of b4.results) {
    assert.equal(result.artifactsRestricted, true);
    assert.equal(result.reason, 'Result details are outside this scope.');
    assert.equal(result.patientCode, undefined);
    assert.equal(result.finding, undefined);
    assert.equal(result.ctDna, undefined);
    assert.equal(result.trigger, undefined);
    assert.equal(result.seriesLabel, undefined);
    assert.deepEqual(result.metrics, []);
    assert.deepEqual(result.artifacts, []);
  }
  assert.deepEqual(b4.well, { row: 1, col: 3, role: 'sample', sampleId: 'SPX-2026-0481', assay: 'panel_solid', consentStatus: 'active' });

  const c3 = histories.get('C3');
  assert.deepEqual(c3.results.map(({ seq, label }) => [seq, label]), [[0, 'R1'], [1, 'R2'], [2, 'R3']]);
  const [primary, reanalysis] = c3.results;
  assert.equal(primary.artifactsRestricted, undefined);
  assert.equal(primary.title, 'Primary · Exome 100×');
  assert.equal(primary.metrics.find(({ key }) => key === 'cov').value, 90);
  assert.ok(c3.results.every((result) => result.patientCode === undefined), 'Patient linkage remains outside the default persona scope');
  assert.deepEqual(primary.artifacts.map(({ kind }) => kind), ['qc', 'calls', 'vcf', 'gvcf', 'cram', 'bam', 'fastq']);
  const originalBam = primary.artifacts.find(({ kind }) => kind === 'bam');
  const reusedBam = reanalysis.artifacts.find(({ kind }) => kind === 'bam');
  assert.equal(originalBam.key, 'bam/NVSX-2026-118/C3/R1.bam');
  assert.ok(originalBam.sizeBytes > 2 ** 31);
  assert.equal(originalBam.legalHold, false);
  assert.equal(reusedBam.key, originalBam.key);
  assert.equal(reusedBam.reusedFrom, primary.id);
  assert.equal(reanalysis.supersedes, primary.id);
  assert.equal(c3.well.sampleId, 'SPX-2026-0495');
  assert.equal(c3.well.assay, 'wes');
  assert.equal(c3.well.consentStatus, 'active');
  assert.ok(Math.abs(c3.well.contaminationProb - 0.24) < 1e-12);
});

test('empty, missing, truncated and incompatible histories stay distinct at the receiving boundary', () => {
  const envelope = { data: { dataSource: { mode: 'STORED' }, well: { id: 'B4', plateId: exampleData.plateId, asOf: exampleData.asOf,
    row: 1, column: 3, role: 'sample', sampleId: 'SPX-2026-0481', assay: 'panel_solid', consent: 'active', contaminationProbability: 0.12,
    history: { totalCount: 0, pageInfo: { hasNextPage: false }, edges: [] } } } };
  const expectedWell = { row: 1, col: 3, role: 'sample', sampleId: 'SPX-2026-0481', assay: 'panel_solid', consentStatus: 'active', contaminationProb: 0.12 };
  assert.deepEqual(parsePlateHistory(envelope, exampleData.plateId, 'B4'), { mode: 'STORED', missing: false, well: expectedWell, results: [] });
  assert.deepEqual(parsePlateHistory({ data: { ...envelope.data, well: null } }, exampleData.plateId, 'B4'), { mode: 'STORED', missing: true, well: null, results: [] });
  for (const edit of [
    (value) => { value.data.well.history.pageInfo.hasNextPage = true; },
    (value) => { value.data.well.asOf = '2027-01-01'; },
    (value) => { value.data.well.id = 'C3'; },
    (value) => { value.errors = [{ message: 'Unavailable' }]; },
  ]) {
    const value = structuredClone(envelope);
    edit(value);
    assert.throws(() => parsePlateHistory(value, exampleData.plateId, 'B4'));
  }
  assert.equal(indexResultWells(new Map([['B4', [{ id: 'opaque-record-7', wellId: 'B4' }]]])).get('opaque-record-7'), 'B4');
});

test('changing selection cancels the old read and a late response cannot replace the current history', async () => {
  const seen = [];
  let oldSignal, finishOld;
  const oldDone = new Promise((resolve) => { finishOld = resolve; });
  const cancel = requestLatestHistory((signal) => { oldSignal = signal; return oldDone; }, (value) => seen.push(value));
  await Promise.resolve();
  cancel();
  assert.equal(oldSignal.aborted, true);
  await new Promise((resolve) => requestLatestHistory(async () => 'current B4', (value) => { seen.push(value); resolve(); }));
  finishOld('late C3');
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(seen, [{ value: 'current B4' }]);
});
