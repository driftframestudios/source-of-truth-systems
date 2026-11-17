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
type AthenaTask = AthenaOverlay & (
  | { readonly kind: 'repair'; readonly completion: AthenaRepairCompletion }
  | { readonly kind: 'rebuild' }
);

export interface PlateOverlayState {
  readonly restores: Readonly<Record<string, ArtifactRestore>>;
  readonly athena: Readonly<Record<string, AthenaTask>>;
}

/** Opaque database IDs are keys, including strings that name Object.prototype members. */
export function overlayValue<T>(entries: Readonly<Record<string, T>>, key: string): T | undefined {
  return Object.prototype.hasOwnProperty.call(entries, key) ? entries[key] : undefined;
}

export function createPlateOverlayState(): PlateOverlayState {
  return { restores: {}, athena: {} };
}

export type PlateOverlayAction =
  | { readonly type: 'restore.request'; readonly artifact: ResultArtifact; readonly option: RestoreOption; readonly now: string }
  | { readonly type: 'athena.start'; readonly resultId: string; readonly kind: 'repair'; readonly completion: AthenaRepairCompletion }
  | { readonly type: 'athena.start'; readonly resultId: string; readonly kind: 'rebuild' }
  | { readonly type: 'athena.complete'; readonly resultId: string };

export function plateOverlayReducer(state: PlateOverlayState, action: PlateOverlayAction): PlateOverlayState {
  switch (action.type) {
    case 'restore.request': {
      const { artifact, option, now } = action;
      if (!artifact.key || overlayValue(state.restores, artifact.key)) return state;
      const existing = artifact.restore;
      if (existing?.state === 'in_progress' || (existing?.state === 'restored' && (!existing.expiresAt || existing.expiresAt >= now.slice(0, 10)))) return state;
      const readyAt = new Date(Date.parse(now) + ((option.minHours + option.maxHours) / 2) * 3_600_000).toISOString();
      return { ...state, restores: { ...state.restores, [artifact.key]: { state: 'in_progress', tier: option.tier, requestedAt: now, readyAt } } };
    }
    case 'athena.start': {
      if (overlayValue(state.athena, action.resultId)) return state;
      const task: AthenaTask = action.kind === 'repair'
        ? { kind: 'repair', state: 'running', etaLabel: 'running now…', completion: action.completion }
        : { kind: 'rebuild', state: 'running', etaLabel: 'restore requested · CTAS queued' };
      return { ...state, athena: { ...state.athena, [action.resultId]: task } };
    }
    case 'athena.complete': {
      const task = overlayValue(state.athena, action.resultId);
      if (task?.kind !== 'repair' || task.state !== 'running') return state;
      return { ...state, athena: { ...state.athena, [action.resultId]: { ...task, state: 'done', etaLabel: undefined } } };
    }
  }
}

/** Shared files receive one storage state; result-specific consent remains on the result. */
export function applyResultRestores(result: WellResult, restores: PlateOverlayState['restores']): WellResult {
  if (!result.artifacts.some((artifact) => overlayValue(restores, artifact.key))) return result;
  return { ...result, artifacts: result.artifacts.map((artifact) => {
    const restore = overlayValue(restores, artifact.key);
    return restore ? { ...artifact, restore } : artifact;
  }) };
}
