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
const results = await moduleUrl('../src/app/data/wellResults.ts');
const catalog = await moduleUrl('../src/app/data/index.ts', { './wellResults': results });
const { STORE } = await import(catalog);
const { arcLabel, sourceRoleLabel, recordTitle, releasePlanSummary } = await import(await moduleUrl('../src/app/services/cartographyService.ts', { '../data': catalog }));

test('display vocabulary resolves the named collection while preserving reference identities', () => {
  assert.equal(arcLabel('arc_02'), 'Release 02');
  assert.equal(sourceRoleLabel('loam_context'), 'Program context');
  assert.equal(recordTitle('sources', 'notion_fragment'), 'Genomics program brief');
  assert.equal(recordTitle('sources', 'arc01_pass5'), 'Release 01 architecture baseline');
  assert.equal(recordTitle('artifacts', 'arc01_pass5'), 'Validated platform baseline');
  assert.equal(recordTitle('artifacts', 'notion_fragment'), 'Artifact unavailable');
  assert.ok(STORE.generationPacket.activeSources.includes('notion_fragment'));
  assert.ok(STORE.relationships.some(edge => edge.fromId === 'notion_fragment' && edge.toId === 'yaml_context'));
});

test('release preview follows the supplied plan instead of hardcoded generation instructions', () => {
  const plan = { ...STORE.generationPacket, activeSources: ['yaml_context'], activeInstructions: ['BATCH-QUEUE-001'], deferred: ['Capacity review'], validationChecks: ['Review the queue priorities'] };
  const preview = releasePlanSummary(plan);
  assert.match(preview, /Sources \(1\)\n• Pipeline configuration manifest/);
  assert.match(preview, /Secondary-analysis jobs take priority over per-sample QC/);
  assert.match(preview, /Review the queue priorities/);
  assert.match(preview, /Capacity review/);
  assert.doesNotMatch(preview, /notion_fragment|header_safe_zone|python_intersection|PIPE-STAGE-001/);
});


test('release preview reads accepted source names and requirement status within the reference packet', () => {
  const plan = { ...STORE.generationPacket, activeSources: ['yaml_context'], activeInstructions: ['BATCH-QUEUE-001'] };
  const source = STORE.sources.find(item => item.id === 'yaml_context');
  const requirement = STORE.instructions.find(item => item.id === 'BATCH-QUEUE-001');
  const preview = releasePlanSummary(plan, { sources: [{ ...source, title: 'Accepted manifest' }], requirements: [{ ...requirement, status: 'deferred', arc: 'arc_03' }] });
  assert.match(preview, /Accepted manifest/);
  assert.match(preview, /Deferred · Release 03/);
  assert.equal(requirement.status, 'active');
});
