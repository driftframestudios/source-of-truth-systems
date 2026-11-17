import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/app/services/recordSession.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } });
const { createRecordSession, recordSessionReducer, selectBiomarkers, selectBiomarkerConsent, selectSpecimens, summarizeSpecimens } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

const markers = Object.freeze([
  Object.freeze({ id: 'marker-a', reviewState: 'in_review', specimenId: 'sample-held' }),
  Object.freeze({ id: 'marker-b', reviewState: 'approved', specimenId: 'sample-active' }),
]);
const specimens = Object.freeze([
  Object.freeze({ id: 'sample-active', consent: 'active', reviewState: 'in_review', sampleState: 'analyzed', orderState: 'in_progress' }),
  Object.freeze({ id: 'sample-held', consent: 'pending', reviewState: 'unreviewed', sampleState: 'accessioned', orderState: 'on_hold' }),
]);
const initial = () => createRecordSession({ biomarkers: markers, specimens });
const review = (state, event, id = 'marker-a') => recordSessionReducer(state, { type: 'biomarker.review', id, event });

test('accepted review updates the shared projection and summary without editing the fixture or another record', () => {
  const before = initial();
  const after = review(before, 'approve');
  const records = selectBiomarkers(after);
  assert.equal(records[0].reviewState, 'approved');
  assert.equal(records.filter((record) => !['approved', 'signed_off'].includes(record.reviewState)).length, 0);
  assert.equal(after.biomarkers.byId['marker-b'], before.biomarkers.byId['marker-b']);
  assert.equal(after.specimens, before.specimens);
  assert.equal(markers[0].reviewState, 'in_review');
  assert.equal(before.biomarkers.byId['marker-a'].reviewState, 'in_review');
  // Re-projecting after a view's local filtering does not reconstruct accepted state.
  selectBiomarkers(after).filter((record) => record.id === 'marker-b');
  assert.equal(selectBiomarkers(after)[0].reviewState, 'approved');
});

test('requested changes branch returns to review; invalid, repeated and terminal events preserve state', () => {
  const requested = review(initial(), 'request_changes');
  assert.equal(requested.biomarkers.byId['marker-a'].reviewState, 'changes_requested');
  assert.equal(review(requested, 'approve'), requested);
  const resubmitted = review(requested, 'resubmit');
  assert.equal(resubmitted.biomarkers.byId['marker-a'].reviewState, 'in_review');
  const approved = review(resubmitted, 'approve');
  assert.equal(review(approved, 'approve'), approved);
  const signed = review(approved, 'sign_off');
  assert.equal(signed.biomarkers.byId['marker-a'].reviewState, 'signed_off');
  assert.equal(review(signed, 'request_changes'), signed);
  assert.equal(review(signed, 'begin', 'missing-marker'), signed);
});

test('biomarker consent follows the related specimen instead of a specific marker ID', () => {
  const state = initial();
  assert.equal(selectBiomarkerConsent(state, 'sample-held'), 'pending');
  assert.equal(selectBiomarkerConsent(state, 'sample-active'), 'active');
  assert.equal(selectBiomarkerConsent(state, 'missing-sample'), undefined);
});

const specimenAction = (state, type, event) => recordSessionReducer(state, { type, id: 'sample-active', event });

test('orders can pause and resume, or fulfill and stop; cancellation is a separate terminal path', () => {
  const before = initial();
  const held = specimenAction(before, 'specimen.order', 'hold');
  assert.equal(held.specimens.byId['sample-active'].orderState, 'on_hold');
  assert.equal(summarizeSpecimens(selectSpecimens(held)).onHold, 2);
  assert.equal(specimenAction(held, 'specimen.order', 'fulfill'), held);
  const resumed = specimenAction(held, 'specimen.order', 'release');
  assert.equal(resumed.specimens.byId['sample-active'].orderState, 'in_progress');
  assert.equal(summarizeSpecimens(selectSpecimens(resumed)).onHold, 1);
  const fulfilled = specimenAction(resumed, 'specimen.order', 'fulfill');
  assert.equal(fulfilled.specimens.byId['sample-active'].orderState, 'fulfilled');
  assert.equal(specimenAction(fulfilled, 'specimen.order', 'cancel'), fulfilled);
  const cancelled = specimenAction(before, 'specimen.order', 'cancel');
  assert.equal(cancelled.specimens.byId['sample-active'].orderState, 'cancelled');
  assert.equal(specimenAction(cancelled, 'specimen.order', 'start'), cancelled);
  assert.equal(cancelled.specimens.byId['sample-held'], before.specimens.byId['sample-held']);
  assert.equal(before.specimens.byId['sample-active'].orderState, 'in_progress');
});

test('sample reporting and specimen review share accepted state while retaining independent fields', () => {
  const before = initial();
  const reported = specimenAction(before, 'specimen.sample', 'advance');
  assert.equal(reported.specimens.byId['sample-active'].sampleState, 'reported');
  assert.equal(summarizeSpecimens(selectSpecimens(reported)).reported, 1);
  const reviewed = specimenAction(reported, 'specimen.review', 'approve');
  assert.equal(reviewed.specimens.byId['sample-active'].reviewState, 'approved');
  assert.equal(reviewed.specimens.byId['sample-active'].sampleState, 'reported');
  assert.equal(reviewed.specimens.byId['sample-active'].orderState, 'in_progress');
  assert.equal(reviewed.biomarkers, before.biomarkers);
  const archived = specimenAction(reviewed, 'specimen.sample', 'advance');
  assert.equal(specimenAction(archived, 'specimen.sample', 'advance'), archived);
  assert.equal(summarizeSpecimens(selectSpecimens(archived)).reported, 1);
});
