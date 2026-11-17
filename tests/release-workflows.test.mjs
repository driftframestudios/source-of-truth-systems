import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
async function moduleUrl(path, imports = {}) {
  let { outputText } = ts.transpileModule(await readFile(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } });
  for (const [key, value] of Object.entries(imports)) outputText = outputText.replaceAll(`'${key}'`, `'${value}'`).replaceAll(`"${key}"`, `"${value}"`);
  return `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
}
const command = await moduleUrl('../src/app/services/command.ts');
const {createReleaseWorkflows,createReleaseCommands}=await import(await moduleUrl('../src/app/services/releaseWorkflows.ts', {'./command':command}));
function fixture() {
  const initial=createReleaseWorkflows([
    {id:'A',status:'active',arc:'arc_01',text:'Keep source lineage'},
    {id:'B',status:'target_state',arc:'arc_02',text:'Use recorded evidence'},
    {id:'C',status:'superseded',arc:'arc_01',text:'Historical rule'},
  ],[{id:'D',status:'tentative',rationale:'Retain the source decision'}]);
  let state=initial, access={ok:true}, commits=0;
  const commands=createReleaseCommands({initial,getState:()=>state,commit:next=>{state=next;commits++;},checkPermission:request=>{assert.equal(request.action,'release.manage');return access;}});
  return {initial,commands,state:()=>state,commits:()=>commits,deny:()=>{access={ok:false,kind:'role',reason:'Read-only role'};}};
}
test('requirement changes retain exact identity, explicit target and replacement with recovery',()=>{
  const f=fixture();
  assert.equal(f.commands.execute({type:'requirement.defer',id:'A',revision:0,target:'arc_03'}).ok,true);
  assert.equal(f.state().requirements.A.status,'deferred');
  assert.equal(f.state().requirements.A.arc,'arc_03');
  assert.equal(f.state().requirements.B,f.initial.requirements.B);
  assert.equal(f.commands.execute({type:'requirement.supersede',id:'A',revision:1,replacementId:'B'}).ok,true);
  assert.equal(f.state().requirements.A.replacementId,'B');
  assert.equal(f.state().requirements.A.text,'Keep source lineage');
  assert.equal(f.commands.execute({type:'requirement.restore',id:'A',revision:2}).ok,true);
  assert.equal(f.state().requirements.A.status,'active');
  assert.equal(f.state().requirements.A.arc,'arc_01');
  assert.equal(f.state().requirements.A.replacementId,undefined);
  assert.equal(f.commands.execute({type:'requirement.restore',id:'A',revision:3}).kind,'transition');
});
test('permission changes, stale revisions and invalid replacement identities leave accepted records intact',()=>{
  const f=fixture();
  for(const replacementId of ['A','C','missing','toString']) assert.equal(f.commands.execute({type:'requirement.supersede',id:'A',revision:0,replacementId}).ok,false);
  assert.equal(f.commands.execute({type:'requirement.defer',id:'A',revision:0,target:'not-a-release'}).ok,false);
  for(const invalid of [null,{type:'constructor',id:'A',revision:0},{type:'decision.confirm',id:'toString',revision:0}]) assert.equal(f.commands.execute(invalid).ok,false);
  assert.equal(f.commands.execute({type:'decision.confirm',id:'D',revision:0}).ok,true);
  const accepted=f.state();
  assert.equal(f.commands.execute({type:'decision.revisit',id:'D',revision:0}).kind,'transition');
  f.deny();
  assert.equal(f.commands.execute({type:'decision.revisit',id:'D',revision:1}).kind,'role');
  assert.equal(f.state(),accepted);
  assert.equal(f.commits(),1);
});
test('decision review is reversible and retains supplied rationale',()=>{
  const f=fixture();
  assert.equal(f.commands.execute({type:'decision.revisit',id:'D',revision:0}).ok,false);
  assert.equal(f.commands.execute({type:'decision.confirm',id:'D',revision:0}).ok,true);
  assert.equal(f.commands.execute({type:'decision.revisit',id:'D',revision:1}).ok,true);
  assert.equal(f.state().decisions.D.status,'revisited');
  assert.equal(f.state().decisions.D.rationale,'Retain the source decision');
  assert.equal(f.commands.execute({type:'decision.restore',id:'D',revision:2}).ok,true);
  assert.equal(f.state().decisions.D.status,'tentative');
});
