import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { deriveScenario, effectiveGrant } from '../shared/permission-scope.mjs';

async function moduleUrl(path, imports = {}) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  let { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } });
  for (const [specifier, url] of Object.entries(imports)) outputText = outputText.replaceAll(`'${specifier}'`, `'${url}'`).replaceAll(`"${specifier}"`, `"${url}"`);
  return `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
}
const shared = new URL('../shared/permission-scope.mjs', import.meta.url).href;
const types = await moduleUrl('../src/app/types/access.ts');
const access = await moduleUrl('../src/app/services/accessService.ts', {'../types/access':types});
const { permissionCatalog: catalog, scenarioInput } = await import(await moduleUrl('../src/app/services/permissionScope.ts', {'./accessService':access}));
const { prepareGrantSave, resetScenarioGrants } = await import(await moduleUrl('../src/app/services/scenarioGrants.ts', {'../types/access':types,'../../../shared/permission-scope.mjs':shared}));
const records = await moduleUrl('../src/app/services/plateHistory/records.ts');
const { createHistoryCache, HISTORY_CACHE_LIMITS, cacheFor, publishScopedHistory, projectScopedPlate, canonicalWell } = await import(await moduleUrl('../src/app/services/plateHistory/cache.ts', {'./records':records,'../../../../shared/permission-scope.mjs':shared}));
const { requestLatestHistory } = await import(await moduleUrl('../src/app/services/plateHistory/request.ts'));
const resultData = await moduleUrl('../src/app/data/wellResults.ts');
const { HistoryAccessDenied, HistorySourceUnavailable, parsePlateHistory, readPlateHistory } = await import(await moduleUrl('../src/app/services/plateHistory/read.ts', {
  '../../../../shared/plate-records.mjs': new URL('../shared/plate-records.mjs', import.meta.url).href,
  '../../../../shared/plate-history-operation.mjs': new URL('../shared/plate-history-operation.mjs', import.meta.url).href,
  '../../data/wellResults': resultData,
}));
const selection = {version:1,principalId:'prin_self',roleId:'arc_lead',environment:'res',grantChanges:[]};
function scope(overrides = {}) { const value = deriveScenario(catalog,{...selection,...overrides}); assert.equal(value.ok,true); return value.scope; }
const ownership = {plateId:'plate',geography:'us_east',specimens:[]};
const wells = [{row:0,col:0,role:'sample',contaminationProb:0.1},{row:0,col:1,role:'sample',contaminationProb:0.2}];
const result = (id, wellId, extra = {}) => ({id,wellId,consent:'active',status:'reportable',metrics:[],artifacts:[],...extra});
const examples = new Map([['A1',[result('one','A1',{supersedes:'two'})]],['A2',[result('two','A2')]]]);

test('grant drafts use the current actor, preserve the inspected target and respect effective ceilings', () => {
  const administrator = scope({roleId:'admin'});
  const viewer = scope({roleId:'viewer'});
  const draft = {...administrator.matrices.prin_reyes,'bam_cram::us_east':'write'};
  assert.equal(prepareGrantSave(viewer,'prin_reyes',draft).kind,'role');
  const saved = prepareGrantSave(administrator,'prin_reyes',draft);
  assert.equal(saved.ok,true);
  assert.equal(saved.scope.matrices.prin_reyes['bam_cram::us_east'],'write');
  assert.equal(effectiveGrant(saved.scope,'prin_reyes','bam_cram','us_east'),'none'); // Reyes has no Research membership.
  const inspected = deriveScenario(catalog,{...scenarioInput(saved.scope),principalId:'prin_reyes',roleId:'auditor',environment:'val'});
  assert.equal(inspected.ok,true);
  assert.equal(effectiveGrant(inspected.scope,'prin_reyes','bam_cram','us_east'),'read');
  assert.deepEqual(saved.scope.grantChanges.at(-1).actor,administrator.selection);
  assert.equal(administrator.matrices.prin_reyes['bam_cram::us_east'],'read');
  assert.equal(prepareGrantSave(scope({roleId:'admin',environment:'val'}),'prin_reyes',draft).kind,'environment');
});

test('invalid grant drafts and targets leave the accepted scope intact; canonical policy is deeply immutable', () => {
  const original = scope({roleId:'admin'});
  for (const [target,draft] of [['missing',{}],['constructor',{}],['prin_self',null],['prin_self',[]],['prin_self',{'bogus::us_east':'read'}],['prin_self',{'plate_map::us_east':'owner'}],['prin_self',Object.create({inherited:'write'})]]) {
    assert.equal(prepareGrantSave(original,target,draft).kind,'invalid');
  }
  assert.equal(original.grantChanges.length,0);
  assert.throws(()=>{catalog.principals[0].clearance='phi';},TypeError);
  assert.throws(()=>{catalog.roles[0].ceiling='write';},TypeError);
  assert.throws(()=>{catalog.seeds.prin_self['plate_map::us_east']='none';},TypeError);
  assert.equal(deriveScenario(catalog,scenarioInput(original)).scope.key,original.key);
});

test('reset restores every example matrix and the canonical scope key while retaining current scenario ceilings', () => {
  const original = scope({roleId:'admin'});
  const first = prepareGrantSave(original, 'prin_self', {...original.matrices.prin_self, 'plate_map::us_east':'none'});
  assert.equal(first.ok, true);
  const second = prepareGrantSave(first.scope, 'prin_reyes', {...first.scope.matrices.prin_reyes, 'bam_cram::us_east':'none'});
  assert.equal(second.ok, true);
  // Recovery remains available after the visitor changes persona, role and environment.
  const current = scope({...scenarioInput(second.scope), principalId:'prin_reyes', roleId:'viewer', environment:'val'});
  const reset = resetScenarioGrants(current);
  assert.deepEqual(reset.selection, {principalId:'prin_reyes', roleId:'viewer', environment:'val'});
  assert.deepEqual(reset.matrices, original.matrices);
  assert.deepEqual(reset.grantChanges, []);
  assert.equal(reset.key, scope({principalId:'prin_reyes', roleId:'viewer', environment:'val'}).key);
  assert.equal(current.grantChanges.length, 2);
  assert.equal(current.matrices.prin_self['plate_map::us_east'], 'none');
  assert.equal(effectiveGrant(reset, 'prin_reyes', 'bam_cram', 'us_east'), 'read');
  assert.equal(prepareGrantSave(reset, 'prin_reyes', original.matrices.prin_reyes).ok, false);
  assert.equal(resetScenarioGrants(reset), reset);
});

test('64 accepted cell changes keep no-op saves available; overflow retains the accepted scope and reset opens another experiment', () => {
  let current = scope({roleId:'admin'});
  for (let index = 0; index < 64; index++) {
    const level = index % 2 === 0 ? 'none' : 'read';
    const saved = prepareGrantSave(current, 'prin_self', {...current.matrices.prin_self, 'plate_map::us_east':level});
    assert.equal(saved.ok, true);
    current = saved.scope;
  }
  assert.equal(current.grantChanges.length, 64);
  assert.equal(prepareGrantSave(current, 'prin_self', current.matrices.prin_self).scope, current);
  const draft = {...current.matrices.prin_self, 'plate_map::us_east':'write'};
  const refused = prepareGrantSave(current, 'prin_self', draft);
  assert.equal(refused.kind, 'invalid');
  assert.match(refused.reason, /64 saved cell changes.*Reset scenario grants/);
  assert.equal(current.grantChanges.length, 64);
  assert.equal(current.matrices.prin_self['plate_map::us_east'], 'read');
  assert.equal(draft['plate_map::us_east'], 'write');
  const reset = resetScenarioGrants(current);
  const saved = prepareGrantSave(reset, 'prin_self', {...reset.matrices.prin_self, 'plate_map::us_east':'none'});
  assert.equal(saved.ok, true);
  assert.equal(saved.scope.grantChanges.length, 1);
});

test('late reads cannot populate either scope after the current scenario changes before effect cleanup', async () => {
  const store = createHistoryCache();
  const oldScope = scope();
  const newScope = scope({roleId:'viewer'});
  const oldPartition = cacheFor(store,oldScope.key);
  let currentKey = oldScope.key;
  let finish;
  const response = new Promise(resolve=>{finish=resolve;});
  const notices = [];
  requestLatestHistory(()=>response,receipt=>notices.push(publishScopedHistory(oldPartition,'plate/A1',oldScope.key,currentKey,receipt)));
  await Promise.resolve();
  currentKey = newScope.key;
  finish({kind:'ready',history:{mode:'STORED',missing:false,well:wells[0],results:[]}});
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(notices,[undefined]);
  assert.equal(oldPartition.histories.size,0);
  assert.equal(cacheFor(store,newScope.key).histories.size,0);
});

test('denied, missing and empty reads replace fixture projections while unavailable remains scoped', () => {
  const current = scope();
  const partition = cacheFor(createHistoryCache(),current.key);
  assert.equal(publishScopedHistory(partition,'plate/A1',current.key,current.key,{error:true}),'unavailable');
  assert.equal(projectScopedPlate(current,'plate',wells,examples,partition,ownership).stacks.get('A1').length,1);
  publishScopedHistory(partition,'plate/A1',current.key,current.key,{value:{kind:'denied'}});
  let projection = projectScopedPlate(current,'plate',wells,examples,partition,ownership);
  assert.equal(projection.wells.length,1);
  assert.equal(projection.stacks.has('A1'),false);
  assert.equal(projection.historyFor('A1'),undefined);
  const missing = {mode:'STORED',missing:true,well:null,results:[]};
  publishScopedHistory(partition,'plate/A2',current.key,current.key,{value:{kind:'ready',history:missing}});
  projection = projectScopedPlate(current,'plate',wells,examples,partition,ownership);
  assert.equal(projection.wells.length,0);
  assert.equal(projection.stacks.size,0);
  assert.equal(projection.historyFor('A2').missing,true);
  const fresh = cacheFor(createHistoryCache(),current.key);
  const storedWell = {...wells[0],assay:'rna_seq',sampleId:'stored-sample'};
  publishScopedHistory(fresh,'plate/A1',current.key,current.key,{value:{kind:'ready',history:{mode:'STORED',missing:false,well:storedWell,results:[]}}});
  assert.equal(canonicalWell('plate','A1',wells,fresh).sampleId,'stored-sample');
  projection = projectScopedPlate(current,'plate',wells,examples,fresh,ownership);
  assert.equal(projection.wells[0].assay,'rna_seq');
  assert.deepEqual(projection.stacks.get('A1'),[]);
  assert.equal(projection.historyFor('A1').missing,false);
});

test('revoking plate access removes result indexes and aliases to hidden canonical targets', () => {
  const administrator = scope({roleId:'admin'});
  const saved = prepareGrantSave(administrator,'prin_self',{...administrator.matrices.prin_self,'plate_map::us_east':'none'});
  assert.equal(saved.ok,true);
  const denied = projectScopedPlate(saved.scope,'plate',wells,examples,cacheFor(createHistoryCache(),saved.scope.key),ownership);
  assert.deepEqual(denied.wells,[]);
  assert.equal(denied.stacks.size,0);
  const current = scope();
  const partition = cacheFor(createHistoryCache(),current.key);
  publishScopedHistory(partition,'plate/A2',current.key,current.key,{value:{kind:'denied'}});
  const projection = projectScopedPlate(current,'plate',wells,examples,partition,ownership);
  assert.equal(projection.stacks.get('A1')[0].supersedes,undefined);
  assert.equal(projection.stacks.has('A2'),false);
});

test('history transport carries scenario scope and distinguishes denied from unavailable and missing', async () => {
  const current = scope();
  const original = globalThis.fetch;
  let body;
  try {
    globalThis.fetch = async (_url,options) => {body=JSON.parse(options.body);return {status:200,ok:true,json:async()=>({errors:[{extensions:{code:'FORBIDDEN'}}]})};};
    await assert.rejects(readPlateHistory('plate','A1',new AbortController().signal,scenarioInput(current)),HistoryAccessDenied);
    assert.deepEqual(body.extensions.scenario,scenarioInput(current));
    assert.throws(()=>parsePlateHistory({errors:[{extensions:{code:'SCENARIO_INVALID'}}]},'plate','A1'),HistoryAccessDenied);
    assert.throws(()=>parsePlateHistory({errors:[{message:'Unavailable'}]},'plate','A1'),error=>!(error instanceof HistoryAccessDenied));
    const empty = {data:{dataSource:{mode:'STORED'},well:{id:'A1',plateId:'plate',asOf:'2026-09-28',row:0,column:0,role:'sample',sampleId:'current',assay:'rna_seq',consent:'active',contaminationProbability:null,history:{totalCount:0,pageInfo:{hasNextPage:false},edges:[]}}}};
    assert.equal(parsePlateHistory(empty,'plate','A1').well.sampleId,'current');
    assert.equal(parsePlateHistory(empty,'plate','A1').well.contaminationProb,undefined);
    assert.deepEqual(parsePlateHistory({data:{dataSource:{mode:'STORED'},well:null}},'plate','A1'),{mode:'STORED',missing:true,well:null,results:[]});
  } finally { globalThis.fetch=original; }
});

test('a stored anchor changes result geography, and contradictory specimen links stay outside the projection', () => {
  const administrator = scope({roleId:'admin'});
  const accepted = prepareGrantSave(administrator,'prin_self',{...administrator.matrices.prin_self,'run_metadata::eu_west':'none'});
  assert.equal(accepted.ok,true);
  const localOwnership = {...ownership,specimens:[
    {id:'SPX-US',plateWell:'A1',geographyCode:'USE',consent:'active',dataClass:'limited'},
    {id:'SPX-EU',plateWell:'A2',geographyCode:'EUW',consent:'active',dataClass:'limited'},
  ]};
  const bundled = [{...wells[0],sampleId:'SPX-US'}];
  const stored = {...wells[0],sampleId:'SPX-EU'};
  const partition = cacheFor(createHistoryCache(),accepted.scope.key);
  publishScopedHistory(partition,'plate/A1',accepted.scope.key,accepted.scope.key,{value:{kind:'ready',history:{mode:'STORED',missing:false,well:stored,results:[result('one','A1')]}}});
  let projection = projectScopedPlate(accepted.scope,'plate',bundled,examples,partition,localOwnership);
  assert.equal(projection.wells[0].sampleId,'SPX-EU');
  assert.deepEqual(projection.stacks.get('A1'),[]);
  publishScopedHistory(partition,'plate/A1',accepted.scope.key,accepted.scope.key,{value:{kind:'ready',history:{mode:'STORED',missing:false,well:stored,results:[result('mismatch','A1',{specimenId:'SPX-US'})]}}});
  projection = projectScopedPlate(administrator,'plate',bundled,examples,partition,localOwnership);
  assert.deepEqual(projection.stacks.get('A1'),[]);
});

test('authoritatively unavailable ownership suppresses examples until a confirmed retry succeeds', () => {
  assert.throws(()=>parsePlateHistory({errors:[{extensions:{code:'OWNERSHIP_UNAVAILABLE'}}]},'plate','A1'),HistorySourceUnavailable);
  const current = scope();
  const partition = cacheFor(createHistoryCache(),current.key);
  publishScopedHistory(partition,'plate/A1',current.key,current.key,{value:{kind:'unavailable'}});
  let projection = projectScopedPlate(current,'plate',wells,examples,partition,ownership);
  assert.equal(projection.wells.length,1);
  assert.equal(projection.stacks.has('A1'),false);
  assert.equal(projection.historyFor('A1'),undefined);
  publishScopedHistory(partition,'plate/A1',current.key,current.key,{error:true});
  assert.equal(projectScopedPlate(current,'plate',wells,examples,partition,ownership).stacks.has('A1'),false);
  publishScopedHistory(partition,'plate/A1',current.key,current.key,{value:{kind:'ready',history:{mode:'STORED',missing:false,well:wells[0],results:[]}}});
  projection = projectScopedPlate(current,'plate',wells,examples,partition,ownership);
  assert.equal(partition.blocked.has('plate/A1'),false);
  assert.deepEqual(projection.stacks.get('A1'),[]);
  assert.equal(projection.wells.length,2);
});

test('recent scopes remain bounded and evicted in-flight receipts stay retired even after returning to the same key', async () => {
  const cache = createHistoryCache();
  const first = cacheFor(cache, 'scope-0');
  let finish;
  requestLatestHistory(() => new Promise(resolve => { finish = resolve; }), receipt => publishScopedHistory(first, 'plate/A1', 'scope-0', 'scope-0', receipt));
  await Promise.resolve();
  for (let index = 1; index <= 12; index++) {
    const partition = cacheFor(cache, `scope-${index}`);
    publishScopedHistory(partition, 'plate/A1', `scope-${index}`, `scope-${index}`, { value: { kind: 'ready', history: { mode: 'STORED', missing: false, well: wells[0], results: [] } } });
    assert.ok(cache.size <= HISTORY_CACHE_LIMITS.scopes);
    assert.ok(cache.retainedEntries <= HISTORY_CACHE_LIMITS.scopes);
  }
  assert.equal(first.active, false);
  assert.equal(first.histories.size, 0);
  const replacement = cacheFor(cache, 'scope-0');
  assert.notEqual(replacement, first);
  finish({ kind: 'ready', history: { mode: 'STORED', missing: false, well: wells[0], results: [result('late', 'A1')] } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(first.histories.size, 0);
  assert.equal(replacement.histories.size, 0);
  const recent = cacheFor(cache, 'scope-12');
  assert.equal(recent.histories.size, 1);
  cacheFor(cache, 'new-1'); cacheFor(cache, 'new-2');
  assert.equal(cacheFor(cache, 'scope-12'), recent); // recent use refreshes its retention position
});

test('one eligible publication updates subscribed receivers with one stable projection revision', () => {
  const current = scope();
  const partition = cacheFor(createHistoryCache(), current.key);
  const project = () => projectScopedPlate(current, 'plate', wells, examples, partition, ownership);
  const before = project();
  assert.equal(project(), before);
  const graphic = [], companion = [];
  const stopGraphic = partition.subscribe(() => graphic.push([partition.getSnapshot(), project()]));
  const stopCompanion = partition.subscribe(() => companion.push([partition.getSnapshot(), project()]));
  publishScopedHistory(partition, 'plate/A1', current.key, current.key, { value: { kind: 'ready', history: { mode: 'STORED', missing: false, well: wells[0], results: [result('fresh', 'A1')] } } });
  assert.equal(graphic.length, 1);
  assert.equal(companion.length, 1);
  assert.equal(graphic[0][0], companion[0][0]);
  assert.equal(graphic[0][1], companion[0][1]);
  assert.notEqual(project(), before);
  assert.equal(project().stacks.get('A1')[0].id, 'fresh');
  assert.equal(before.historyFor('A1'), undefined); // an older projection keeps its own complete snapshot
  const accepted = project();
  publishScopedHistory(partition, 'plate/A1', current.key, 'another-scope', { value: { kind: 'denied' } });
  assert.equal(project(), accepted);
  stopGraphic(); stopCompanion();
  partition.retry('plate/A1');
  assert.equal(graphic.length, 1);
  assert.notEqual(project(), accepted);
});

test('fresh 96-well projection uses one coordinate pass and repeated snapshots reuse it', t => {
  let rowReads = 0;
  const fullPlate = Array.from({ length: 96 }, (_, index) => ({ get row() { rowReads++; return Math.floor(index / 12); }, col: index % 12, role: 'sample' }));
  const current = scope();
  const partition = cacheFor(createHistoryCache(), current.key);
  const empty = new Map();
  const projection = projectScopedPlate(current, 'plate', fullPlate, empty, partition, ownership);
  assert.equal(projection.wells.length, 96);
  // Policy/field projection also reads coordinates. This bound distinguishes the former triangular find scans.
  assert.ok(rowReads < 96 * 10, `coordinate work: ${rowReads}`);
  const firstReads = rowReads;
  assert.equal(projectScopedPlate(current, 'plate', fullPlate, empty, partition, ownership), projection);
  assert.equal(rowReads, firstReads);
  canonicalWell('plate', 'H12', fullPlate, partition);
  const indexReads = rowReads;
  canonicalWell('plate', 'A1', fullPlate, partition);
  assert.equal(rowReads, indexReads);
  t.diagnostic(`Fresh 96-well projection: ${firstReads} row reads; unchanged projection: 0 additional reads.`);
});
