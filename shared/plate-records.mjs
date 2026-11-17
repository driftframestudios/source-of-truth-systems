/** Shared admission boundary for persisted records and their browser projection. */
export const PLATE_LIMITS = Object.freeze({
  wells: 96,
  results: 512,
  history: 50,
  artifacts: 8,
  metrics: 32,
});
const enums = {
  kind: [
    "primary",
    "top_up",
    "reprep",
    "reanalysis",
    "longitudinal",
    "matched_normal",
    "orthogonal",
    "reflex",
    "control",
  ],
  status: [
    "reportable",
    "superseded",
    "failed_qc",
    "in_progress",
    "held",
    "cancelled",
    "informational",
  ],
  consent: ["active", "pending", "rescinded", "expired"],
  minWriteRole: [
    "viewer",
    "analyst",
    "reviewer",
    "lab_operator",
    "arc_lead",
    "auditor",
    "admin",
  ],
  fileKind: ["qc", "vcf", "calls", "gvcf", "bam", "cram", "fastq", "idat"],
  ruleId: [
    "lc-qc-pinned",
    "lc-vcf-hot",
    "lc-bam-v3",
    "lc-cram-archive",
    "lc-fastq-deep",
    "lc-idat-hot",
  ],
};
function fail(field) {
  throw new TypeError(`Invalid plate record: ${field}.`);
}
function object(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(field);
  return value;
}
function text(value, field, limit = 4096) {
  if (
    typeof value !== "string" ||
    !value.length ||
    value.length > limit ||
    value.includes("\u0000") ||
    !value.isWellFormed()
  )
    fail(field);
  return value;
}
function number(
  value,
  field,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  integer = false,
) {
  if (
    !Number.isFinite(value) ||
    value < min ||
    value > max ||
    (integer && !Number.isSafeInteger(value))
  )
    fail(field);
  return value;
}
function choice(value, field, choices) {
  if (!choices.includes(value)) fail(field);
  return value;
}
function list(value, field, max) {
  if (!Array.isArray(value) || value.length > max) fail(field);
  return value;
}
function boolean(value, field) {
  if (typeof value !== "boolean") fail(field);
  return value;
}
function boundedRecord(value, limit) {
  if (new TextEncoder().encode(JSON.stringify(value)).length > limit)
    fail("record size");
  return value;
}
function optional(target, source, keys, parse = text) {
  for (const key of keys)
    if (source[key] != null) target[key] = parse(source[key], key);
}
function date(value, field) {
  text(value, field, 10);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value
  )
    fail(field);
  return value;
}
function instant(value, field) {
  text(value, field, 40);
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(Date.parse(value)))
    fail(field);
  return value;
}
export function parseArtifact(value) {
  const source = object(value, "artifact");
  const result = {
    key: text(source.key, "file key", 512),
    kind: choice(source.kind, "file kind", enums.fileKind),
    ruleId: choice(source.ruleId, "ruleId", enums.ruleId),
    sizeBytes: number(
      source.sizeBytes,
      "sizeBytes",
      0,
      Number.MAX_SAFE_INTEGER,
      true,
    ),
    createdAt: date(source.createdAt, "createdAt"),
  };
  optional(result, source, ["reusedFrom"], (v, k) => text(v, k, 160));
  optional(result, source, ["legalHold"], boolean);
  if (source.restore != null) {
    const r = object(source.restore, "restore");
    result.restore = {
      state: choice(r.state, "restore state", ["in_progress", "restored"]),
      tier: choice(r.tier, "restore tier", ["expedited", "standard", "bulk"]),
      requestedAt: instant(r.requestedAt, "requestedAt"),
    };
    optional(result.restore, r, ["readyAt"], instant);
    optional(result.restore, r, ["expiresAt"], date);
  }
  return boundedRecord(result, 16_384);
}
export function parseWellResult(value) {
  const source = object(value, "result");
  const result = {};
  for (const key of ["id", "wellId", "plateId", "plateWell"])
    result[key] = text(source[key], key, 160);
  for (const key of [
    "label",
    "title",
    "specimenType",
    "assayLabel",
    "pipeline",
    "reason",
  ])
    result[key] = text(source[key], key);
  for (const key of ["kind", "status", "consent", "minWriteRole"])
    result[key] = choice(source[key], key, enums[key]);
  result.seq = number(
    source.seq,
    "sequence",
    0,
    PLATE_LIMITS.history - 1,
    true,
  );
  result.runDate = date(source.runDate, "runDate");
  optional(result, source, [
    "flowCell",
    "finding",
    "patientCode",
    "seriesLabel",
  ]);
  optional(result, source, ["specimenId", "supersedes"], (v, k) =>
    text(v, k, 160),
  );
  optional(result, source, ["artifactsRestricted"], boolean);
  result.metrics = list(source.metrics, "metrics", PLATE_LIMITS.metrics).map(
    (value) => {
      const m = object(value, "metric");
      const metric = {
        key: text(m.key, "metric key", 160),
        label: text(m.label, "metric label"),
        value: number(m.value, "metric value", -Number.MAX_SAFE_INTEGER),
        unit:
          typeof m.unit === "string" && m.unit.length <= 80
            ? m.unit
            : fail("metric unit"),
      };
      optional(metric, m, ["target"], (v, k) =>
        number(v, k, -Number.MAX_SAFE_INTEGER),
      );
      optional(metric, m, ["comparator"], (v, k) =>
        choice(v, k, ["gte", "lte"]),
      );
      return metric;
    },
  );
  result.artifacts = list(
    source.artifacts,
    "artifacts",
    PLATE_LIMITS.artifacts,
  ).map(parseArtifact);
  if (
    new Set(result.artifacts.map((a) => a.kind)).size !==
    result.artifacts.length
  )
    fail("duplicate file kind");
  if (source.trigger != null) {
    const trigger = object(source.trigger, "trigger");
    result.trigger = {
      source: text(trigger.source, "trigger source"),
      detail: text(trigger.detail, "trigger detail"),
    };
    optional(result.trigger, trigger, ["refId"]);
  }
  if (source.ctDna != null) {
    const ct = object(source.ctDna, "ctDna");
    result.ctDna = {
      detected: boolean(ct.detected, "detected"),
      meanVafPct: number(ct.meanVafPct, "meanVafPct", 0, 100),
      tracked: number(ct.tracked, "tracked", 0, 100000, true),
      detectedCount: number(
        ct.detectedCount,
        "detectedCount",
        0,
        ct.tracked,
        true,
      ),
    };
    optional(result.ctDna, ct, ["mtmPerMl"], number);
    optional(result.ctDna, ct, ["emerging"]);
  }
  return boundedRecord(result, 65_536);
}
export function parseWell(value) {
  const source = object(value, "well");
  const well = {
    row: number(source.row, "row", 0, 7, true),
    col: number(source.col, "column", 0, 11, true),
    role: choice(source.role, "role", [
      "sample",
      "positive_control",
      "negative_control",
      "empty",
    ]),
  };
  optional(well, source, ["contaminationProb"], (v, k) => number(v, k, 0, 1));
  optional(well, source, [
    "id",
    "sampleId",
    "laneCardId",
    "patientCode",
    "accessionedAt",
    "note",
    "consentSetBy",
    "consentUpdatedAt",
  ]);
  optional(well, source, ["assay"], (v, k) =>
    choice(v, k, [
      "wgs",
      "wes",
      "panel_solid",
      "panel_heme",
      "rna_seq",
      "methylation",
    ]),
  );
  optional(well, source, ["priority"], (v, k) =>
    choice(v, k, ["routine", "expedited", "stat"]),
  );
  optional(well, source, ["tumorPercent"], (v, k) => number(v, k, 0, 100));
  optional(well, source, ["volumeUl", "concentrationNgUl"], number);
  optional(well, source, ["dinScore"], (v, k) => number(v, k, 0, 10));
  optional(well, source, ["consentStatus"], (v, k) =>
    choice(v, k, enums.consent),
  );
  if (well.id != null && well.id !== `${"ABCDEFGH"[well.row]}${well.col + 1}`)
    fail("well coordinate identity");
  return boundedRecord(well, 16_384);
}
export function assertPlateCatalog(value) {
  const source = object(value, "catalog");
  text(source.plateId, "plateId", 160);
  date(source.asOf, "asOf");
  const wells = list(source.wells, "wells", PLATE_LIMITS.wells).map(parseWell);
  const results = list(source.results, "results", PLATE_LIMITS.results).map(
    parseWellResult,
  );
  const wellIds = new Set(wells.map((w) => `${"ABCDEFGH"[w.row]}${w.col + 1}`));
  if (wellIds.size !== wells.length) fail("duplicate well");
  const byId = new Map(results.map((r) => [r.id, r]));
  if (byId.size !== results.length) fail("duplicate result");
  const sequences = new Set(),
    files = new Map();
  for (const result of results) {
    const sequence = `${result.wellId}:${result.seq}`;
    if (!wellIds.has(result.wellId) || sequences.has(sequence))
      fail("result well or sequence");
    sequences.add(sequence);
    if (result.supersedes) {
      const predecessor = byId.get(result.supersedes);
      if (
        !predecessor ||
        predecessor.wellId !== result.wellId ||
        predecessor.seq >= result.seq
      )
        fail("supersession");
    }
    for (const artifact of result.artifacts) {
      const identity = JSON.stringify([
        artifact.kind,
        artifact.sizeBytes,
        artifact.createdAt,
        artifact.ruleId,
      ]);
      if (files.has(artifact.key) && files.get(artifact.key) !== identity)
        fail("physical file identity");
      files.set(artifact.key, identity);
      if (artifact.reusedFrom) {
        const predecessor = byId.get(artifact.reusedFrom);
        if (
          !predecessor ||
          predecessor.wellId !== result.wellId ||
          predecessor.seq >= result.seq ||
          !predecessor.artifacts.some((a) => a.key === artifact.key)
        )
          fail("reused file reference");
      }
    }
  }
  return { plateId: source.plateId, asOf: source.asOf, wells, results };
}
