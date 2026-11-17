import { resolveResultOwner } from '../../../../shared/permission-scope.mjs';
import { PLATE_OWNERSHIP } from '../../services/plateHistory/ownership';
// ============================================================
// Session overlay for storage actions taken from the plate view.
//
// Glacier restore requests and Athena partition repairs round-trip
// in the retained browser session, so the
// tray, the stack paint and the right-hand detail panel all see the
// same state. Commands resolve current records and permission before effects.
// ============================================================

import { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { ArtifactRestore, WellResult } from '../../types';
import type { AthenaOverlay } from '../../services/dataAvailability';
import { ARTIFACT_LABEL, formatBytes, formatUsd, restoreCost, restoreWindow } from '../../services/dataAvailability';
import { groupResultsByWell, PLATE_ID, RESULTS_NOW_ISO } from '../../data/wellResults';
import { STORE } from '../../data';
import { useEnvironment } from '../../services/environment';
import { useWriteGate } from '../../services/writeGate';
import { usePlateResultResolver, usePlateWellResolver } from '../../services/plateHistory/context';
import type { CommandResult } from '../../services/command';
import { createPlateCommands, type PlateCommand } from './plateCommands';
import { useNotifications } from '../../services/notifications';
import { applyResultRestores, createPlateOverlayState, plateOverlayReducer } from './plateOverlayState';
import type { PlateOverlayAction } from './plateOverlayState';
import { createSessionState } from '../../services/browserSession';
import { useSessionResource, useSessionSnapshot } from '../../services/browserSessionContext';

interface PlateOverlayValue {
  readonly restores: Readonly<Record<string, ArtifactRestore>>;
  readonly athena: Readonly<Record<string, AthenaOverlay>>;
  apply: (r: WellResult) => WellResult;
  preview: (command: PlateCommand) => CommandResult;
  execute: (command: PlateCommand) => Promise<CommandResult>;
}

const PlateOverlayContext = createContext<PlateOverlayValue | null>(null);
const EXAMPLE_RESULTS = groupResultsByWell(STORE.wellResults);
const PLATE_SESSION = { create: () => createSessionState(createPlateOverlayState()) };

export function PlateOverlayProvider({ children }: { children: ReactNode }) {
  const { pushToast } = useNotifications();
  const { getEnvironment } = useEnvironment();
  const gate = useWriteGate();
  const resolve = usePlateResultResolver(PLATE_ID, EXAMPLE_RESULTS);
  const resolveWell = usePlateWellResolver(PLATE_ID, STORE.plate);
  const store = useSessionResource(PLATE_SESSION);
  const state = useSessionSnapshot(store);
  const commit = useCallback((action: PlateOverlayAction) =>
    store.update((current) => plateOverlayReducer(current, action)), [store]);
  const { restores, athena } = state;

  // The accepted deadline survives a layout change. Each receiving view owns
  // only its timers, so remounts resume the remaining delay and cleanup is safe.
  useEffect(() => {
    const timers: number[] = [];
    for (const [resultId, task] of Object.entries(athena)) {
      if (task.kind !== 'repair' || task.state !== 'running') continue;
      const { at, wellId, label, runDate } = task.completion;
      const finish = () => {
        if (!commit({ type: 'athena.complete', resultId })) return;
        // Accepted work completes; its notification still follows the current read scope.
        if (!resolve({ plateId: PLATE_ID, wellId, resultId })) return;
        pushToast({ severity: 'info', title: 'Partition registered', message: `genomics.variants_legacy now sees run_date=${runDate} — ${wellId} · ${label} is queryable.` });
      };
      timers.push(window.setTimeout(finish, Math.max(0, at - Date.now())));
    }
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [athena, commit, pushToast, resolve]);

  const apply = useCallback((r: WellResult) => applyResultRestores(r, restores), [restores]);

  const commands = useMemo(() => createPlateCommands({
    resolve, getState: store.getSnapshot, check: gate.check,
    getOwner: (result) => {
      const well = resolveWell(result.wellId);
      return well ? resolveResultOwner(result, PLATE_OWNERSHIP, well) : undefined;
    },
    getBucket: () => {
      const { s3Buckets } = getEnvironment().infra;
      return s3Buckets.find((bucket) => bucket.includes('streams')) ?? s3Buckets[0];
    },
  }, {
    now: () => RESULTS_NOW_ISO, clock: Date.now, commit,
    accepted: (command) => {
      const result = command.result;
      if (command.type === 'artifact.restore') {
        const { artifact, option } = command;
        pushToast({ severity: 'info', title: `${option.label} restore requested`, message: `${ARTIFACT_LABEL[artifact.kind]} for ${result.wellId} · ${result.label} (${formatBytes(artifact.sizeBytes)}) — readable in ${restoreWindow(option)}, est. ${formatUsd(restoreCost(option, artifact.sizeBytes))}.` });
      } else if (command.type === 'query.rebuild') {
        pushToast({ severity: 'info', title: 'Restore + rebuild queued', message: `Parquet for run_date=${result.runDate} is being restored from Glacier; the CTAS rebuild starts when objects are readable (3–5 h).` });
      }
    },
    copy: (uri) => navigator.clipboard.writeText(uri),
    copied: (uri) => pushToast({ severity: 'info', title: 'S3 URI copied', message: uri }),
  }), [resolve, resolveWell, store, gate.check, getEnvironment, commit, pushToast]);
  const execute = useCallback(async (command: PlateCommand) => {
    const outcome = await commands.execute(command);
    if (!outcome.ok) {
      if (outcome.kind === 'unavailable') pushToast({ severity: 'warning', title: command?.type === 'artifact.copyUri' ? 'Clipboard unavailable' : 'Action unavailable', message: outcome.reason });
      else {
        const label = command?.type === 'artifact.restore' ? 'Glacier restore'
          : command?.type === 'artifact.copyUri' ? 'Copy S3 URI'
          : command?.type === 'query.repair' ? 'Repair partition'
          : command?.type === 'query.rebuild' ? 'Restore + rebuild' : 'Plate action';
        gate.deny(label, outcome, command?.target?.resultId);
      }
    }
    return outcome;
  }, [commands, gate.deny, pushToast]);
  const value = useMemo<PlateOverlayValue>(
    () => ({ restores, athena, apply, preview: commands.preview, execute }),
    [restores, athena, apply, commands, execute],
  );
  return <PlateOverlayContext.Provider value={value}>{children}</PlateOverlayContext.Provider>;
}

export function usePlateOverlay(): PlateOverlayValue {
  const ctx = useContext(PlateOverlayContext);
  if (!ctx) throw new Error('usePlateOverlay must be used within a PlateOverlayProvider');
  return ctx;
}
