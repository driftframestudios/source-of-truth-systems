import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {exampleData} from '../build/server/example-data.mjs';
import {createReadApi} from '../server/graphql/api.mjs';
import {deriveScenario, projectResultFields, DEFAULT_SCENARIO} from '../shared/permission-scope.mjs';
import {parseWellResult} from '../shared/plate-records.mjs';
import {PLATE_HISTORY_HASH} from '../shared/plate-history-operation.mjs';

async function moduleUrl(path, imports = {}) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  let {outputText} = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}});
  for(const [specifier,url] of Object.entries(imports)) outputText=outputText.replaceAll(`'${specifier}'`,`'${url}'`).replaceAll(`"${specifier}"`,`"${url}"`);
  return `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
}
const types=await moduleUrl('../src/app/types/access.ts');
const access=await moduleUrl('../src/app/services/accessService.ts',{'../types/access':types});
const resultData=await moduleUrl('../src/app/data/wellResults.ts');
const availability=await moduleUrl('../src/app/services/dataAvailability.ts',{'./accessService':access,'../data/wellResults':resultData});
const {resolveResult,athenaPosture,readinessAnswers,availabilitySummary}=await import(availability);
const {parsePlateHistory}=await import(await moduleUrl('../src/app/services/plateHistory/read.ts',{
  '../../../../shared/plate-records.mjs':new URL('../shared/plate-records.mjs',import.meta.url).href,
  '../../../../shared/plate-history-operation.mjs':new URL('../shared/plate-history-operation.mjs',import.meta.url).href,
  '../../data/wellResults':resultData,
}));
function scope(grantChanges=[]) {const result=deriveScenario(exampleData.permissionCatalog,{...DEFAULT_SCENARIO,grantChanges});assert.equal(result.ok,true);return result.scope;}
const anchor=exampleData.wells.find(well=>well.id==='C3');
const original=exampleData.results.find(result=>result.id==='RES-C3-00');

test('partial file projections retain visible files and distinguish unknown readiness from missing output',()=>{
  const restricted=scope([{actor:{principalId:'prin_self',roleId:'admin',environment:'res'},targetPrincipalId:'prin_self',resource:'bam_cram',geography:'us_east',level:'none'}]);
  const projected=projectResultFields(restricted,original,exampleData.ownership,anchor);
  assert.equal(projected.artifactsRestricted,true);
  assert.equal(projected.artifacts.some(file=>file.kind==='vcf'),true);
  assert.equal(projected.artifacts.some(file=>file.kind==='bam'||file.kind==='cram'),false);
  assert.equal(projectResultFields(restricted,projected,exampleData.ownership,anchor).artifactsRestricted,true);
  const resolved=resolveResult(projected);
  assert.match(availabilitySummary(projected,resolved),/permitted files/);
  const posture=athenaPosture(projected);
  assert.equal(posture.state,'ready'); // The permitted VCF still establishes query readiness.
  const answers=readinessAnswers(projected,resolved,posture,'us-east-1');
  assert.match(answers.find(answer=>answer.id==='bam').headline,/outside scope/);
  assert.equal(answers.find(answer=>answer.id==='calls').verdict,'yes');
  assert.match(answers.find(answer=>answer.id==='calls').question,/permitted/);
  assert.equal(parseWellResult(projected).artifactsRestricted,true);
  assert.throws(()=>parseWellResult({...original,artifactsRestricted:'yes'}),/artifactsRestricted/);
});

test('complete permitted records preserve existing readiness and true empty records remain empty',()=>{
  const projected=projectResultFields(scope(),original,exampleData.ownership,anchor);
  assert.equal(projected.artifactsRestricted,undefined);
  assert.deepEqual(projected.artifacts,original.artifacts);
  assert.equal(availabilitySummary(projected,resolveResult(projected)),availabilitySummary(original,resolveResult(original)));
  assert.deepEqual(athenaPosture(projected),athenaPosture(original));
  const empty={...original,artifacts:[]};
  assert.equal(availabilitySummary(empty,[]),'This result produced no data files.');
  assert.equal(athenaPosture(empty).state,'pending');
});

test('registered scoped history retains restriction provenance through the browser adapter',async()=>{
  const {yoga}=createReadApi({data:exampleData});
  const response=await yoga.fetch('http://localhost/graphql',{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({extensions:{persistedQuery:{version:1,sha256Hash:PLATE_HISTORY_HASH},scenario:{...DEFAULT_SCENARIO,grantChanges:['qc_metrics','vcf_gvcf','bam_cram','fastq'].map(resource=>({actor:{principalId:'prin_self',roleId:'admin',environment:'res'},targetPrincipalId:'prin_self',resource,geography:'us_east',level:'none'}))}},variables:{plateId:exampleData.plateId,id:'C3'}}),
  });
  const payload=await response.json();
  assert.equal(payload.errors,undefined,JSON.stringify(payload.errors));
  const history=parsePlateHistory(payload,exampleData.plateId,'C3');
  const projected=history.results.find(result=>result.artifactsRestricted);
  assert.ok(projected);
  assert.deepEqual(projected.artifacts,[]);
  assert.match(availabilitySummary(projected,[]),/outside this scenario/);
  assert.equal(athenaPosture(projected).state,'restricted');
  assert.equal(athenaPosture(projected).action,undefined);
  const answers=readinessAnswers(projected,[],athenaPosture(projected),'us-east-1');
  assert.equal(answers.some(answer=>/Not produced|No BAM|Not in the lake/.test(answer.headline)),false);
});


test('a permitted BAM retains its known availability when variant files are outside scope',()=>{
  const restricted=scope([{actor:{principalId:'prin_self',roleId:'admin',environment:'res'},targetPrincipalId:'prin_self',resource:'vcf_gvcf',geography:'us_east',level:'none'}]);
  const projected=projectResultFields(restricted,original,exampleData.ownership,anchor);
  assert.equal(projected.artifactsRestricted,true);
  assert.equal(projected.artifacts.some(file=>file.kind==='bam'),true);
  const actual=readinessAnswers(projected,resolveResult(projected),athenaPosture(projected),'us-east-1');
  const expected=readinessAnswers(original,resolveResult(original),athenaPosture(original),'us-east-1');
  assert.deepEqual(actual.find(answer=>answer.id==='bam'),expected.find(answer=>answer.id==='bam'));
  assert.match(actual.find(answer=>answer.id==='calls').headline,/outside scope/);
});
