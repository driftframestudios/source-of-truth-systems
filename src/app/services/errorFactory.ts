import type { AppError, AppErrorCode, ErrorSeverity } from '../types';

function nowIso(): string {
  return new Date().toISOString();
}

function rid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

interface ErrorRecipe {
  readonly severity: ErrorSeverity;
  readonly title: string;
  readonly recoverable: boolean;
  readonly suggestedAction?: string;
}

const RECIPES: Record<AppErrorCode, ErrorRecipe> = {
  SOURCE_FETCH_FAILED:      { severity: 'error',    title: 'Source fetch failed',          recoverable: true,  suggestedAction: 'Check the source connection and retry the fetch.' },
  SOURCE_PARSE_INVALID:     { severity: 'error',    title: 'Source parse invalid',         recoverable: false, suggestedAction: 'Inspect the source file; check schema version.' },
  INSTRUCTION_CONFLICT:     { severity: 'warning',  title: 'Instruction conflict',         recoverable: true,  suggestedAction: 'Open Comparisons to review the conflicting requirements.' },
  ARTIFACT_HASH_MISMATCH:   { severity: 'critical', title: 'Artifact hash mismatch',       recoverable: false, suggestedAction: 'Compare the artifact with its recorded release revision.' },
  STREAM_TIMEOUT:           { severity: 'warning',  title: 'Stream timeout',               recoverable: true,  suggestedAction: 'Increase the timeout window or check upstream lane health.' },
  CONNECTION_AUTH_EXPIRED:  { severity: 'error',    title: 'Connection auth expired',      recoverable: true,  suggestedAction: 'Re-authenticate the connection in Preferences → Connections.' },
  CONNECTION_OFFLINE:       { severity: 'warning',  title: 'Connection offline',           recoverable: true,  suggestedAction: 'Check network reachability for the vendor.' },
  LANE_GEOMETRY_VIOLATION:  { severity: 'warning',  title: 'Pipeline topology violation',  recoverable: true,  suggestedAction: 'Re-run schema validation; re-bind misaligned run steps.' },
  COMPARISON_UNRESOLVED:    { severity: 'info',     title: 'Comparison unresolved',        recoverable: true,  suggestedAction: 'Resolve in the Comparison Engine before the next revision.' },
  PACKET_VALIDATION_FAILED: { severity: 'critical', title: 'Release checks failed',     recoverable: false, suggestedAction: 'Review the release plan requirements and checks before delivery.' },
  PERMISSION_DENIED:        { severity: 'error',    title: 'Permission denied',            recoverable: false, suggestedAction: 'Request elevated access from the workspace admin.' },
  RATE_LIMITED:             { severity: 'warning',  title: 'Rate limited',                 recoverable: true,  suggestedAction: 'Back off and retry after the cooldown window.' },
  INTERNAL_UNEXPECTED:      { severity: 'critical', title: 'Internal unexpected error',    recoverable: false, suggestedAction: 'Report to engineering with the correlation ID.' },
};

export function createError(
  code: AppErrorCode,
  message: string,
  opts: { subjectId?: string; overrideSeverity?: ErrorSeverity } = {},
): AppError {
  const recipe = RECIPES[code];
  return {
    id: rid('err'),
    code,
    severity: opts.overrideSeverity ?? recipe.severity,
    title: recipe.title,
    message,
    subjectId: opts.subjectId,
    recoverable: recipe.recoverable,
    suggestedAction: recipe.suggestedAction,
    timestamp: nowIso(),
  };
}

export const ERROR_CODES: ReadonlyArray<AppErrorCode> = Object.keys(RECIPES) as AppErrorCode[];

// Sample error messages for the manual trigger panel
export const SAMPLE_ERRORS: Record<AppErrorCode, string> = {
  SOURCE_FETCH_FAILED:      'The program brief in S3 is temporarily unavailable (503).',
  SOURCE_PARSE_INVALID:     'The Release 02 manifest failed schema validation at key activeInstructions.',
  INSTRUCTION_CONFLICT:     'PIPE-STAGE-001 and a deferred instruction disagree on the default compute environment.',
  ARTIFACT_HASH_MISMATCH:   'The Release 01 architecture baseline differs from its recorded content hash.',
  STREAM_TIMEOUT:           'FASTQ stream from lane_sequencer exceeded 90s window.',
  CONNECTION_AUTH_EXPIRED:  'BaseSpace token expired 12 minutes ago.',
  CONNECTION_OFFLINE:       'COSMIC endpoint unreachable.',
  LANE_GEOMETRY_VIOLATION:  'A pipeline step is assigned to a stage outside its controlling specimen workflow.',
  COMPARISON_UNRESOLVED:    'Run-step alignment comparison still pending resolution.',
  PACKET_VALIDATION_FAILED: 'Release 02 failed 2 of 8 review checks.',
  PERMISSION_DENIED:        'You do not have write access to the genomics workspace.',
  RATE_LIMITED:             'OncoKB API rate limit hit — back off 60s.',
  INTERNAL_UNEXPECTED:      'Unhandled exception in MapGraph edge layout (correlation 7f31a2).',
};

// Generate a paginated history of historical errors for the Profile error log
export function buildErrorLog(count: number): ReadonlyArray<AppError> {
  const codes = ERROR_CODES;
  const out: AppError[] = [];
  for (let i = 0; i < count; i++) {
    const code = codes[i % codes.length];
    const err = createError(code, SAMPLE_ERRORS[code]);
    // Backdate
    const minutesAgo = (i + 1) * 7;
    out.push({
      ...err,
      id: `errlog_${i}`,
      timestamp: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
    });
  }
  return out;
}
