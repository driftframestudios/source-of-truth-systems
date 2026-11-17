import { parseWell, parseWellResult, PLATE_LIMITS } from '../../../../shared/plate-records.mjs';
import { PLATE_HISTORY_HASH } from '../../../../shared/plate-history-operation.mjs';
import { RESULTS_AS_OF } from '../../data/wellResults';
import type { Well, WellResult } from '../../types';
import type { ScenarioInput } from '../../../../shared/permission-scope.mjs';

export class HistoryAccessDenied extends Error {
  constructor() { super('This scenario cannot read the selected history.'); this.name = 'HistoryAccessDenied'; }
}

export class HistorySourceUnavailable extends Error {
  constructor() { super('The stored history has no confirmed canonical owner.'); this.name = 'HistorySourceUnavailable'; }
}

function checkReadDenial(value: Record<string, unknown>) {
  if (Array.isArray(value.errors) && value.errors.some((entry) => {
    if (!entry || typeof entry !== 'object') return false;
    const extensions = (entry as { extensions?: { code?: unknown } }).extensions;
    return extensions?.code === 'FORBIDDEN' || extensions?.code === 'SCENARIO_INVALID';
  })) throw new HistoryAccessDenied();
  if (Array.isArray(value.errors) && value.errors.some(entry => entry && typeof entry === 'object'
    && (entry as {extensions?:{code?:unknown}}).extensions?.code === 'OWNERSHIP_UNAVAILABLE')) throw new HistorySourceUnavailable();
}

export interface PlateHistory {
  readonly mode: 'STORED' | 'EXAMPLE';
  readonly missing: boolean;
  readonly well: Well | null;
  readonly results: ReadonlyArray<WellResult>;
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid history record');
  return value as Record<string, unknown>;
}

function completeNodes(value: unknown, limit: number): ReadonlyArray<Record<string, unknown>> {
  const connection = object(value);
  if (!Array.isArray(connection.edges) || connection.edges.length > limit
    || connection.totalCount !== connection.edges.length || object(connection.pageInfo).hasNextPage !== false) {
    throw new Error('History must be complete before it is displayed');
  }
  return connection.edges.map((edge) => object(object(edge).node));
}

const optional = <T,>(value: T | null | undefined): T | undefined => value ?? undefined;
const reference = (value: unknown) => value == null ? undefined : object(value).id;

/** Map the reviewed GraphQL projection into the existing canonical result contract. */
function resultRecord(node: Record<string, unknown>): WellResult {
  const trigger = node.trigger == null ? undefined : object(node.trigger);
  const ctDna = node.ctDna == null ? undefined : object(node.ctDna);
  const metrics = Array.isArray(node.metrics) ? node.metrics.map((value) => {
    const metric = object(value);
    return { ...metric, target: optional(metric.target), comparator: optional(metric.comparator) };
  }) : node.metrics;
  const artifacts = completeNodes(node.artifacts, PLATE_LIMITS.artifacts).map((artifact) => {
    const file = object(artifact.file);
    const restore = artifact.restore == null ? undefined : object(artifact.restore);
    return {
      key: file.id, kind: file.kind, sizeBytes: file.sizeBytes, createdAt: file.createdAt, ruleId: file.lifecycleRuleId,
      legalHold: optional(artifact.legalHold), reusedFrom: reference(artifact.reusedFrom),
      restore: restore && { ...restore, readyAt: optional(restore.readyAt), expiresAt: optional(restore.expiresAt) },
    };
  });
  return parseWellResult({
    id: node.id, wellId: node.wellId, seq: node.sequence, kind: node.kind, status: node.status,
    label: node.label, title: node.title, specimenType: node.specimenType, assayLabel: node.assayLabel,
    plateId: node.physicalPlateId, plateWell: node.physicalWellId, flowCell: optional(node.flowCell),
    pipeline: node.pipeline, runDate: node.runDate, reason: node.reason, finding: optional(node.finding),
    trigger: trigger && { ...trigger, refId: optional(trigger.refId) }, supersedes: reference(node.supersedes), metrics,
    ctDna: ctDna && { ...ctDna, mtmPerMl: optional(ctDna.mtmPerMl), emerging: optional(ctDna.emerging) },
    artifacts, artifactsRestricted: optional(node.artifactsRestricted), consent: node.consent, minWriteRole: node.minWriteRole,
    specimenId: optional(node.specimenId), patientCode: optional(node.patientCode), seriesLabel: optional(node.seriesLabel),
  });
}

export function parsePlateHistory(value: unknown, plateId: string, wellId: string): PlateHistory {
  const envelope = object(value);
  checkReadDenial(envelope);
  if (envelope.errors != null) throw new Error('History source returned an error');
  const data = object(envelope.data);
  const mode = object(data.dataSource).mode;
  if (mode !== 'STORED' && mode !== 'EXAMPLE') throw new Error('History source is unspecified');
  if (data.well === null) return { mode, missing: true, well: null, results: [] };
  const well = object(data.well);
  if (well.plateId !== plateId || well.id !== wellId || well.asOf !== RESULTS_AS_OF) {
    throw new Error('History does not match the selected example plate');
  }
  const canonicalWell = parseWell({ row: well.row, col: well.column, role: well.role,
    sampleId: optional(well.sampleId), assay: optional(well.assay), consentStatus: optional(well.consent),
    contaminationProb: optional(well.contaminationProbability) });
  if (`${'ABCDEFGH'[canonicalWell.row]}${canonicalWell.col + 1}` !== wellId) throw new Error('Well coordinates do not match the selected history');
  const results = completeNodes(well.history, PLATE_LIMITS.history).map(resultRecord);
  const ids = new Set<string>();
  let previousSequence = -1;
  for (const result of results) {
    if (result.wellId !== wellId || ids.has(result.id) || result.seq <= previousSequence) throw new Error('History identity or ordering is invalid');
    ids.add(result.id);
    previousSequence = result.seq;
  }
  return { mode, missing: false, well: canonicalWell, results };
}

export async function readPlateHistory(plateId: string, wellId: string, signal: AbortSignal, scenario?: ScenarioInput): Promise<PlateHistory> {
  const response = await fetch('/graphql', {
    method: 'POST', signal,
    headers: { 'Content-Type': 'application/json', Accept: 'application/graphql-response+json, application/json' },
    body: JSON.stringify({ extensions: { persistedQuery: { version: 1, sha256Hash: PLATE_HISTORY_HASH }, ...(scenario ? { scenario } : {}) }, variables: { plateId, id: wellId } }),
  });
  if (response.status === 401 || response.status === 403) throw new HistoryAccessDenied();
  const body = await response.json();
  checkReadDenial(object(body));
  if (!response.ok) throw new Error('History source is unavailable');
  return parsePlateHistory(body, plateId, wellId);
}
