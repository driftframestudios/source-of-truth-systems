import type { Biomarker, OrderState, ReviewState, SampleState, Specimen } from '../types';

export type ReviewEvent = 'begin' | 'approve' | 'request_changes' | 'resubmit' | 'sign_off';
export interface Transition<Event extends string, State extends string> {
  readonly event: Event;
  readonly next: State;
  readonly label: string;
}

// The display flow lists the vocabulary; these events define the demo's
// permitted paths. Requested changes are an explicit branch, not a mandatory step.
const REVIEW_TRANSITIONS: Record<ReviewState, ReadonlyArray<Transition<ReviewEvent, ReviewState>>> = {
  unreviewed: [{ event: 'begin', next: 'in_review', label: 'in review' }],
  in_review: [
    { event: 'approve', next: 'approved', label: 'approved' },
    { event: 'request_changes', next: 'changes_requested', label: 'request changes' },
  ],
  changes_requested: [{ event: 'resubmit', next: 'in_review', label: 'resubmit' }],
  approved: [{ event: 'sign_off', next: 'signed_off', label: 'signed off' }],
  signed_off: [],
};

export function reviewTransitions(state: ReviewState) {
  return REVIEW_TRANSITIONS[state];
}

export type SampleEvent = 'advance';
const SAMPLE_TRANSITIONS: Record<SampleState, ReadonlyArray<Transition<SampleEvent, SampleState>>> = {
  received: [{ event: 'advance', next: 'accessioned', label: 'accessioned' }],
  accessioned: [{ event: 'advance', next: 'in_process', label: 'in process' }],
  in_process: [{ event: 'advance', next: 'sequenced', label: 'sequenced' }],
  sequenced: [{ event: 'advance', next: 'analyzed', label: 'analyzed' }],
  analyzed: [{ event: 'advance', next: 'reported', label: 'reported' }],
  reported: [{ event: 'advance', next: 'archived', label: 'archived' }],
  archived: [],
};

export function sampleTransitions(state: SampleState) {
  return SAMPLE_TRANSITIONS[state];
}

export type OrderEvent = 'place' | 'start' | 'hold' | 'release' | 'fulfill' | 'cancel';
const ORDER_TRANSITIONS: Record<OrderState, ReadonlyArray<Transition<OrderEvent, OrderState>>> = {
  draft: [{ event: 'place', next: 'placed', label: 'placed' }, { event: 'cancel', next: 'cancelled', label: 'cancel' }],
  placed: [{ event: 'start', next: 'in_progress', label: 'in progress' }, { event: 'cancel', next: 'cancelled', label: 'cancel' }],
  in_progress: [
    { event: 'fulfill', next: 'fulfilled', label: 'fulfilled' },
    { event: 'hold', next: 'on_hold', label: 'hold' },
    { event: 'cancel', next: 'cancelled', label: 'cancel' },
  ],
  on_hold: [{ event: 'release', next: 'in_progress', label: 'release hold' }, { event: 'cancel', next: 'cancelled', label: 'cancel' }],
  fulfilled: [],
  cancelled: [],
};

export function orderTransitions(state: OrderState) {
  return ORDER_TRANSITIONS[state];
}

interface Records<T> {
  readonly order: ReadonlyArray<string>;
  readonly byId: Readonly<Record<string, T>>;
}

function indexRecords<T extends { readonly id: string }>(records: ReadonlyArray<T>): Records<T> {
  return { order: records.map((record) => record.id), byId: Object.fromEntries(records.map((record) => [record.id, record])) };
}

export interface RecordSessionState {
  readonly biomarkers: Records<Biomarker>;
  readonly specimens: Records<Specimen>;
}

export function createRecordSession(records: {
  readonly biomarkers: ReadonlyArray<Biomarker>;
  readonly specimens: ReadonlyArray<Specimen>;
}): RecordSessionState {
  return { biomarkers: indexRecords(records.biomarkers), specimens: indexRecords(records.specimens) };
}

export type RecordSessionAction =
  | { readonly type: 'biomarker.review'; readonly id: string; readonly event: ReviewEvent }
  | { readonly type: 'specimen.review'; readonly id: string; readonly event: ReviewEvent }
  | { readonly type: 'specimen.sample'; readonly id: string; readonly event: SampleEvent }
  | { readonly type: 'specimen.order'; readonly id: string; readonly event: OrderEvent };

export function recordSessionReducer(state: RecordSessionState, action: RecordSessionAction): RecordSessionState {
  if (action.type !== 'biomarker.review') return reduceSpecimen(state, action);
  const record = Object.prototype.hasOwnProperty.call(state.biomarkers.byId, action.id) ? state.biomarkers.byId[action.id] : undefined;
  if (!record) return state;
  const next = reviewTransitions(record.reviewState).find((transition) => transition.event === action.event)?.next;
  if (!next) return state;
  return {
    ...state,
    biomarkers: {
      ...state.biomarkers,
      byId: { ...state.biomarkers.byId, [record.id]: { ...record, reviewState: next } },
    },
  };
}

function reduceSpecimen(state: RecordSessionState, action: Exclude<RecordSessionAction, { type: 'biomarker.review' }>): RecordSessionState {
  const specimen = Object.prototype.hasOwnProperty.call(state.specimens.byId, action.id) ? state.specimens.byId[action.id] : undefined;
  if (!specimen) return state;
  let updated: Specimen;
  switch (action.type) {
    case 'specimen.review': {
      const next = reviewTransitions(specimen.reviewState).find((transition) => transition.event === action.event)?.next;
      if (!next) return state;
      updated = { ...specimen, reviewState: next };
      break;
    }
    case 'specimen.sample': {
      const next = sampleTransitions(specimen.sampleState).find((transition) => transition.event === action.event)?.next;
      if (!next) return state;
      updated = { ...specimen, sampleState: next };
      break;
    }
    case 'specimen.order': {
      const next = orderTransitions(specimen.orderState).find((transition) => transition.event === action.event)?.next;
      if (!next) return state;
      updated = { ...specimen, orderState: next };
      break;
    }
    default: return state;
  }
  return { ...state, specimens: { ...state.specimens, byId: { ...state.specimens.byId, [specimen.id]: updated } } };
}

export function selectBiomarkers(state: RecordSessionState): ReadonlyArray<Biomarker> {
  return state.biomarkers.order.map((id) => state.biomarkers.byId[id]);
}

export function selectBiomarkerConsent(state: RecordSessionState, specimenId: string) {
  return Object.prototype.hasOwnProperty.call(state.specimens.byId, specimenId) ? state.specimens.byId[specimenId].consent : undefined;
}

export function selectSpecimens(state: RecordSessionState): ReadonlyArray<Specimen> {
  return state.specimens.order.map((id) => state.specimens.byId[id]);
}

export function summarizeSpecimens(specimens: ReadonlyArray<Specimen>) {
  return {
    total: specimens.length,
    onHold: specimens.filter((specimen) => specimen.orderState === 'on_hold').length,
    rescinded: specimens.filter((specimen) => specimen.consent === 'rescinded').length,
    reported: specimens.filter((specimen) => specimen.sampleState === 'reported' || specimen.sampleState === 'archived').length,
  };
}
