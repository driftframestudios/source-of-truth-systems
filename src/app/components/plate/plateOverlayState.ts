import type { ArtifactRestore, ResultArtifact, WellResult } from '../../types';
import type { AthenaOverlay, RestoreOption } from '../../services/dataAvailability';

export const ATHENA_REPAIR_DELAY_MS = 2400;
export type AthenaTaskKind = 'repair' | 'rebuild';
export interface AthenaRepairCompletion {
  readonly at: number;
  readonly wellId: string;
  readonly label: string;
  readonly runDate: string;
}
export type RestoreTask = ArtifactRestore & { readonly generation: number };
export type AthenaTask = AthenaOverlay & { readonly generation: number } & (
  | { readonly kind: 'repair'; readonly completion: AthenaRepairCompletion }
  | { readonly kind: 'rebuild' }
);

export interface PlateOverlayState {
  readonly nextGeneration: number;
  readonly restores: Readonly<Record<string, RestoreTask>>;
  readonly athena: Readonly<Record<string, AthenaTask>>;
}

/** Opaque database IDs are keys, including strings that name Object.prototype members. */
export function overlayValue<T>(entries: Readonly<Record<string, T>>, key: string): T | undefined {
  return Object.prototype.hasOwnProperty.call(entries, key) ? entries[key] : undefined;
}

export function createPlateOverlayState(): PlateOverlayState {
  return { nextGeneration: 1, restores: {}, athena: {} };
}

export type PlateOverlayAction =
  | { readonly type: 'restore.request'; readonly artifact: ResultArtifact; readonly option: RestoreOption; readonly now: string }
  | { readonly type: 'athena.start'; readonly resultId: string; readonly kind: 'repair'; readonly completion: AthenaRepairCompletion }
  | { readonly type: 'athena.start'; readonly resultId: string; readonly kind: 'rebuild' }
  | { readonly type: 'athena.complete' | 'athena.replay'; readonly resultId: string; readonly generation: number }
  | { readonly type: 'restore.complete'; readonly key: string; readonly generation: number; readonly now: string }
  | { readonly type: 'restore.replay'; readonly key: string; readonly generation: number };

export function plateOverlayReducer(state: PlateOverlayState, action: PlateOverlayAction): PlateOverlayState {
  switch (action.type) {
    case 'restore.request': {
      const { artifact, option, now } = action;
      if (!artifact.key || overlayValue(state.restores, artifact.key)) return state;
      const existing = artifact.restore;
      if (existing?.state === 'in_progress' || (existing?.state === 'restored' && (!existing.expiresAt || existing.expiresAt >= now.slice(0, 10)))) return state;
      const readyAt = new Date(Date.parse(now) + ((option.minHours + option.maxHours) / 2) * 3_600_000).toISOString();
      return { ...state, nextGeneration: state.nextGeneration + 1, restores: { ...state.restores, [artifact.key]: { generation: state.nextGeneration, state: 'in_progress', tier: option.tier, requestedAt: now, readyAt } } };
    }
    case 'athena.start': {
      if (overlayValue(state.athena, action.resultId)) return state;
      const task: AthenaTask = action.kind === 'repair'
        ? { generation: state.nextGeneration, kind: 'repair', state: 'running', etaLabel: 'running now…', completion: action.completion }
        : { generation: state.nextGeneration, kind: 'rebuild', state: 'running', etaLabel: 'restore requested · CTAS queued' };
      return { ...state, nextGeneration: state.nextGeneration + 1, athena: { ...state.athena, [action.resultId]: task } };
    }
    case 'restore.complete': {
      const task = overlayValue(state.restores, action.key);
      if (!task || task.generation !== action.generation || task.state !== 'in_progress') return state;
      const expiresAt = new Date(Date.parse(action.now) + 7 * 86_400_000).toISOString().slice(0, 10);
      return { ...state, restores: { ...state.restores, [action.key]: { ...task, state: 'restored', readyAt: action.now, expiresAt } } };
    }
    case 'restore.replay': {
      const task = overlayValue(state.restores, action.key);
      if (!task || task.generation !== action.generation) return state;
      const restores = { ...state.restores };
      delete restores[action.key];
      return { ...state, restores };
    }
    case 'athena.replay': {
      const task = overlayValue(state.athena, action.resultId);
      if (!task || task.generation !== action.generation) return state;
      const athena = { ...state.athena };
      delete athena[action.resultId];
      return { ...state, athena };
    }
    case 'athena.complete': {
      const task = overlayValue(state.athena, action.resultId);
      if (!task || task.generation !== action.generation || task.state !== 'running') return state;
      return { ...state, athena: { ...state.athena, [action.resultId]: { ...task, state: 'done', etaLabel: undefined } } };
    }
  }
}

/** Shared files receive one storage state; result-specific consent remains on the result. */
export function applyResultRestores(result: WellResult, restores: Readonly<Record<string, ArtifactRestore>>): WellResult {
  if (!result.artifacts.some((artifact) => overlayValue(restores, artifact.key))) return result;
  return { ...result, artifacts: result.artifacts.map((artifact) => {
    const restore = overlayValue(restores, artifact.key);
    return restore ? { ...artifact, restore } : artifact;
  }) };
}
