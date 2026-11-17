import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

async function moduleUrl(path, imports = {}) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  let { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } });
  for (const [specifier, url] of Object.entries(imports)) outputText = outputText.replaceAll(`'${specifier}'`, `'${url}'`).replaceAll(`"${specifier}"`, `"${url}"`);
  return `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
}
const types = await moduleUrl('../src/app/types/access.ts');
const access = await moduleUrl('../src/app/services/accessService.ts', { '../types/access': types });
const scopeModule = await moduleUrl('../src/app/services/permissionScope.ts', { './accessService': access });
const kernelUrl = new URL('../shared/permission-scope.mjs', import.meta.url).href;
const { decidePermission, capabilityForRecordRole } = await import(await moduleUrl('../src/app/services/permissionPolicy.ts', { '../types/access': types, './accessService': access, './permissionScope': scopeModule, '../../../shared/permission-scope.mjs': kernelUrl }));
const request = Object.freeze({ principalId: 'prin_self', role: 'arc_lead', environment: 'res', action: 'workspace.edit', consent: 'active' });
const decision = (overrides = {}) => decidePermission({ ...request, ...overrides });

test('job capabilities distinguish analysis, clinical review and laboratory work without a role hierarchy', () => {
  for (const [role, action, allowed] of [
    ['viewer', 'workspace.edit', false], ['auditor', 'review.approve', false],
    ['analyst', 'analysis.run', true], ['analyst', 'review.approve', false],
    ['reviewer', 'review.approve', true], ['reviewer', 'sample.manage', false],
    ['lab_operator', 'sample.manage', true], ['lab_operator', 'analysis.run', false],
    ['admin', 'policy.edit', true], ['arc_lead', 'policy.edit', false],
  ]) assert.equal(decision({ role, action }).ok, allowed, `${role}: ${action}`);
});

test('consent outranks broad grants and environment rules, while membership remains persona-specific', () => {
  assert.equal(decision({ role: 'admin', consent: 'rescinded', environment: 'prod' }).kind, 'consent');
  assert.equal(decision({ role: 'admin', environment: 'val' }).kind, 'environment');
  assert.equal(decision({ principalId: 'prin_okafor', role: 'reviewer', action: 'review.approve' }).kind, 'membership');
  assert.equal(decision({ principalId: 'prin_okafor', role: 'reviewer', action: 'review.approve', environment: 'stg' }).ok, true);
  assert.equal(request.role, 'arc_lead');
});

test('unknown identities, actions, roles and declared resources fail closed', () => {
  for (const input of [
    { principalId: 'missing' }, { role: 'constructor' }, { action: 'toString' },
    { environment: 'missing' }, { resource: 'missing' }, { consent: 'missing' },
  ]) assert.equal(decision(input).kind, 'invalid', JSON.stringify(input));
  assert.equal(capabilityForRecordRole('missing'), undefined);
});

test('declared resource sensitivity uses canonical metadata and a persona ceiling', () => {
  assert.equal(decision({ principalId: 'prin_tanaka', role: 'analyst', action: 'analysis.run', resource: 'bam_cram' }).kind, 'clearance');
  assert.equal(decision({ principalId: 'prin_tanaka', role: 'analyst', action: 'analysis.run', resource: 'fastq' }).ok, true);
  assert.equal(decision({ role: 'admin', resource: 'clinical_report' }).kind, 'clearance');
});

test('legacy record gates map to explicit capabilities and retain default working operations', () => {
  assert.equal(capabilityForRecordRole('lab_operator'), 'sample.manage');
  assert.equal(capabilityForRecordRole('reviewer'), 'review.approve');
  for (const role of ['analyst', 'lab_operator', 'reviewer', 'arc_lead', 'auditor']) {
    assert.equal(decision({ action: capabilityForRecordRole(role) }).ok, true);
  }
});

test('reading a permitted artifact location is distinct from changing a protected environment', () => {
  const read = { principalId: 'prin_reyes', role: 'auditor', environment: 'prod', resource: 'bam_cram', action: 'resource.read' };
  assert.equal(decision(read).ok, true);
  assert.equal(decision({ ...read, action: 'analysis.run' }).kind, 'environment');
  assert.equal(decision({ ...read, consent: 'rescinded' }).kind, 'consent');
  assert.equal(decision({ ...read, principalId: 'prin_tanaka' }).kind, 'membership');
  assert.equal(decision({ ...read, principalId: 'prin_tanaka', environment: 'res' }).kind, 'clearance');
});
