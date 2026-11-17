import assert from "node:assert/strict";
import test from "node:test";
import { exampleData } from "../build/server/example-data.mjs";
import { createReadApi } from "../server/graphql/api.mjs";
import { createScopedRepository } from "../server/data/scoped-repository.mjs";
import { createExampleRepository } from "../server/data/example-repository.mjs";
import {
  deriveScenario,
  effectiveGrant,
  DEFAULT_SCENARIO,
  decideScopedPermission,
  resolveResultOwner,
  resolveGeography,
  projectResultFields,
} from "../shared/permission-scope.mjs";

const catalog = exampleData.permissionCatalog;
const actor = { principalId: "prin_self", roleId: "admin", environment: "res" };
const change = (resource, geography, level = "none", overrides = {}) => ({
  actor,
  targetPrincipalId: "prin_self",
  resource,
  geography,
  level,
  ...overrides,
});
const scenario = (grantChanges = [], overrides = {}) => ({
  ...DEFAULT_SCENARIO,
  grantChanges,
  ...overrides,
});
const scope = (input) => {
  const result = deriveScenario(catalog, input);
  assert.equal(result.ok, true, JSON.stringify(result));
  return result.scope;
};
const { yoga } = createReadApi({ data: exampleData, explore: true });
async function query(document, variables = {}, input = DEFAULT_SCENARIO) {
  const response = await yoga.fetch("http://localhost/graphql", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      query: document,
      variables,
      extensions: { scenario: input },
    }),
  });
  return response.json();
}
const plateId = exampleData.plateId;
const wellQuery =
  "query($plate:ID!,$id:ID!){well(plateId:$plate,id:$id){id history{totalCount edges{node{id title reason patientCode finding metrics{label} artifacts{totalCount edges{node{file{id kind}}}}}}}}}";
const resultQuery =
  "query($id:ID!){result(id:$id){id title reason patientCode finding metrics{label} artifacts{totalCount edges{node{file{id kind} reusedFrom{id}}}} supersedes{id}}}";

test("finite scenario replay validates each acting administrator and creates exact scope identity", () => {
  const first = scope(scenario([change("plate_map", "us_east")]));
  const second = scope(scenario([change("plate_map", "eu_west")]));
  assert.notEqual(first.key, second.key);
  assert.equal(
    first.key,
    scope(
      JSON.parse(JSON.stringify(scenario([change("plate_map", "us_east")]))),
    ).key,
  );
  assert.equal(
    decideScopedPermission(first, {
      action: "resource.read",
      resource: "plate_map",
      geography: "us_east",
    }).kind,
    "grant",
  );
  assert.equal(
    decideScopedPermission(first, {
      action: "resource.read",
      resource: "plate_map",
      geography: "eu_west",
    }).ok,
    true,
  );
  for (const input of [
    null,
    {},
    scenario([], { roleId: "constructor" }),
    { ...scenario(), capabilities: ["policy.edit"] },
    scenario(Array.from({ length: 65 }, () => change("plate_map", "us_east"))),
    scenario([
      change("plate_map", "us_east", "none", {
        actor: { ...actor, roleId: "viewer" },
      }),
    ]),
    scenario([change("patient_linkage", "us_east", "write")]),
  ])
    assert.equal(deriveScenario(catalog, input).ok, false);
  assert.equal(resolveGeography("APAC"), "apac");
  assert.equal(resolveGeography("constructor"), undefined);
});

test("wells are filtered before count/cursor projection and direct reads use the same scope", async () => {
  const input = scenario([change("plate_map", "eu_west")]);
  const first = await query(
    "query($id:ID!){plate(id:$id){wells(first:2){totalCount edges{node{id}} pageInfo{endCursor}}}}",
    { id: plateId },
    input,
  );
  assert.equal(first.errors, undefined, JSON.stringify(first));
  const expected = exampleData.wells.filter(
    (well) =>
      !exampleData.ownership.specimens.some(
        (specimen) =>
          specimen.plateWell === well.id && specimen.geographyCode === "EUW",
      ),
  ).length;
  assert.equal(first.data.plate.wells.totalCount, expected);
  const denied = await query(wellQuery, { plate: plateId, id: "A9" }, input);
  assert.equal(denied.data.well, null);
  assert.equal(denied.errors[0].extensions.code, "FORBIDDEN");
  const a9 = exampleData.results.find((result) => result.wellId === "A9");
  const direct = await query(resultQuery, { id: a9.id }, input);
  assert.equal(direct.data.result, null);
  assert.equal(direct.errors[0].extensions.code, "FORBIDDEN");
  const mismatch = await query(
    "query($id:ID!,$after:String){plate(id:$id){wells(first:2,after:$after){totalCount}}}",
    { id: plateId, after: first.data.plate.wells.pageInfo.endCursor },
  );
  assert.match(mismatch.errors[0].message, /cursor/i);
});

test("field projection matches browser policy and artifact grants cannot be bypassed through direct IDs", async () => {
  const input = scenario([
    change("bam_cram", "us_east"),
    change("vcf_gvcf", "us_east"),
  ]);
  const c3 = exampleData.results.find((result) => result.wellId === "C3");
  const response = await query(resultQuery, { id: c3.id }, input);
  assert.equal(response.errors, undefined, JSON.stringify(response));
  const projected = projectResultFields(
    scope(input),
    c3,
    exampleData.ownership,
  );
  assert.equal(response.data.result.reason, projected.reason);
  assert.equal(response.data.result.finding, null);
  assert.equal(response.data.result.patientCode, null);
  assert.ok(
    response.data.result.artifacts.edges.every(
      ({ node }) =>
        !["bam", "cram", "vcf", "gvcf", "calls"].includes(node.file.kind),
    ),
  );
  const history = await query(wellQuery, { plate: plateId, id: "C3" }, input);
  assert.equal(history.errors, undefined, JSON.stringify(history));
  assert.equal(
    history.data.well.history.edges[0].node.artifacts.totalCount,
    response.data.result.artifacts.totalCount,
  );
});

test("canonical consent and classification redact old stored display metadata without changing the base rows", async () => {
  const original = exampleData.results.find((result) => result.specimenId);
  const heldSpecimen = {
    ...exampleData.ownership.specimens.find(
      (specimen) => specimen.id === original.specimenId,
    ),
    consent: "pending",
    dataClass: "phi",
  };
  const ownership = {
    ...exampleData.ownership,
    specimens: exampleData.ownership.specimens.map((specimen) =>
      specimen.id === heldSpecimen.id ? heldSpecimen : specimen,
    ),
  };
  const raw = {
    ...original,
    consent: "active",
    title: "PRIVATE FINDING",
    reason: "PRIVATE REASON",
    patientCode: "PRIVATE PATIENT",
    finding: "PRIVATE FINDING",
    trigger: { label: "PRIVATE TRIGGER" },
    seriesLabel: "PRIVATE SERIES",
  };
  const projected = projectResultFields(scope(), raw, ownership);
  assert.equal(projected.consent, "pending");
  assert.equal(projected.artifacts.length, 0);
  assert.equal(projected.metrics.length, 0);
  assert.equal(projected.reason, "Result details are outside this scope.");
  assert.equal(projected.trigger, undefined);
  assert.equal(projected.seriesLabel, undefined);
  assert.equal(raw.title, "PRIVATE FINDING");
  assert.equal(
    projectResultFields(
      scope(scenario([], { roleId: "analyst" })),
      raw,
      ownership,
    ),
    null,
  );
  assert.equal(
    resolveResultOwner({ ...raw, specimenId: "unknown-specimen" }, ownership),
    undefined,
  );
});

test("relationship lookup suppresses denied aliases and malformed scenarios have an explicit refusal", async () => {
  const base = createExampleRepository(exampleData);
  const input = scenario([change("plate_map", "eu_west")]);
  const scoped = createScopedRepository(
    base,
    scope(input),
    exampleData.ownership,
  );
  const denied = exampleData.results.find((result) => result.wellId === "A9");
  assert.equal(await scoped.getResult(denied.id, { relation: true }), null);
  await assert.rejects(
    scoped.getResult(denied.id),
    (error) => error.extensions.code === "FORBIDDEN",
  );
  const unknown = {
    ...exampleData.results[0],
    anchorPlateId: plateId,
    specimenId: "unknown",
  };
  const unknownRepo = createScopedRepository(
    { ...base, getResult: () => unknown },
    scope(),
    exampleData.ownership,
  );
  await assert.rejects(
    unknownRepo.getResult(unknown.id),
    (error) => error.extensions.code === "OWNERSHIP_UNAVAILABLE",
  );
  const response = await query('{plate(id:"unknown"){id}}', {}, null);
  assert.equal(response.errors[0].extensions.code, "SCENARIO_INVALID");
});

test("stored reads retain anchor ownership and apply policy after bounded parameterized SELECTs", async () => {
  const { createMySqlRepository } =
    await import("../server/data/mysql-repository.mjs");
  const { SCHEMA_VERSION, SCHEMA_SIGNATURE } =
    await import("../server/data/catalog-schema.mjs");
  const raw = exampleData.results.find((result) => result.wellId === "C3");
  const well = exampleData.wells.find((well) => well.id === "C3");
  const calls = [];
  const connection = {
    execute: async (sql, values) => {
      calls.push({ sql, values });
      if (sql.includes("FROM showcase_catalog"))
        return [
          [
            {
              schema_version: SCHEMA_VERSION,
              schema_signature: SCHEMA_SIGNATURE,
            },
          ],
        ];
      if (sql.includes("FROM showcase_results"))
        return [
          [
            {
              id: raw.id,
              well_id: raw.wellId,
              anchor_plate_id: plateId,
              sequence_index: raw.seq,
              supersedes_id: null,
              metadata: raw,
            },
          ],
        ];
      if (sql.includes("FROM showcase_artifacts"))
        return [
          raw.artifacts.map((artifact, ordinal) => ({
            result_id: raw.id,
            ordinal,
            object_key: artifact.key,
            reused_from_id: null,
            reference_metadata: artifact,
            metadata: artifact,
          })),
        ];
      if (sql.includes("FROM showcase_wells"))
        return [
          [
            {
              id: well.id,
              plate_id: plateId,
              row_index: well.row,
              column_index: well.col,
              as_of: exampleData.asOf,
              metadata: well,
            },
          ],
        ];
      throw new Error("Unexpected SQL shape");
    },
  };
  const repository = await createMySqlRepository(connection);
  const canonical = await repository.getResult(raw.id);
  assert.equal(canonical.anchorPlateId, plateId);
  const scoped = createScopedRepository(
    repository,
    scope(scenario([change("bam_cram", "us_east")])),
    exampleData.ownership,
  );
  const projected = await scoped.getResult(raw.id);
  assert.equal(
    projected.artifacts.some((artifact) =>
      ["bam", "cram"].includes(artifact.kind),
    ),
    false,
  );
  assert.ok(calls.every(({ sql }) => sql.startsWith("SELECT")));
  assert.deepEqual(
    calls.find(({ sql }) => sql.includes("FROM showcase_results")).values,
    [raw.id],
  );
  assert.equal(
    calls.filter(({ sql }) => sql.includes("FROM showcase_results")).length,
    1,
    "request result cache is scope-neutral; every projection rechecks policy",
  );
  await scoped.getResult(raw.id, { relation: true });
  await scoped.getWell(plateId, well.id);
  assert.equal(
    calls.filter(({ sql }) => sql.includes("FROM showcase_wells")).length,
    1,
    "aliases reuse one canonical anchor within the read-only request snapshot",
  );
});

test("redacted quality fields remain absent and analysis denial is distinct from an empty history", async () => {
  const { parseWell } = await import("../shared/plate-records.mjs");
  assert.equal(
    parseWell({ row: 0, col: 0, role: "sample" }).contaminationProb,
    undefined,
  );
  assert.equal(
    parseWell({ row: 0, col: 0, role: "sample", contaminationProb: 0 })
      .contaminationProb,
    0,
  );
  assert.throws(() =>
    parseWell({ row: 0, col: 0, role: "sample", contaminationProb: 2 }),
  );
  const denied = await query(
    wellQuery,
    { plate: plateId, id: "C3" },
    scenario([change("run_metadata", "us_east")]),
  );
  assert.equal(denied.errors[0].extensions.code, "FORBIDDEN");
  const mismatch = await query(
    "{corridor{lanes{totalCount}}}",
    {},
    scenario([], {
      principalId: "prin_okafor",
      roleId: "reviewer",
      environment: "dev",
    }),
  );
  assert.equal(mismatch.errors[0].extensions.code, "FORBIDDEN");
});

test("inspecting another persona uses its own role ceiling", () => {
  const acting = scope(scenario([], { roleId: "admin", environment: "res" }));
  const principal = catalog.principals.find(
    (person) => person.id === "prin_reyes",
  );
  const inspected = {
    ...acting,
    matrices: {
      ...acting.matrices,
      [principal.id]: { "bam_cram::us_east": "write" },
    },
  };
  assert.equal(
    effectiveGrant(inspected, principal.id, "bam_cram", "us_east"),
    "none",
    "membership is checked for the inspected persona",
  );
  // A writable environment isolates the target-role ceiling from environment locking.
  const assigned = {
    ...inspected,
    catalog: {
      ...catalog,
      principals: catalog.principals.map((person) =>
        person.id === principal.id
          ? { ...person, environments: ["res"] }
          : person,
      ),
    },
  };
  assert.equal(
    effectiveGrant(assigned, principal.id, "bam_cram", "us_east"),
    "read",
  );
  assert.equal(
    effectiveGrant(
      {
        ...assigned,
        selection: { ...assigned.selection, principalId: principal.id },
      },
      principal.id,
      "bam_cram",
      "us_east",
    ),
    "write",
    "an explicitly selected active role can change that persona’s own scenario",
  );
});

test("a current stored anchor supplies ownership and stricter consent to history and direct reads", async () => {
  const raw = exampleData.results.find((result) => result.wellId === "C3");
  const originalWell = exampleData.wells.find((well) => well.id === "C3");
  const heldWell = { ...originalWell, consentStatus: "pending" };
  assert.equal(
    resolveResultOwner(raw, exampleData.ownership, heldWell).consent,
    "pending",
  );
  const projected = projectResultFields(
    scope(),
    raw,
    exampleData.ownership,
    heldWell,
  );
  assert.equal(projected.artifacts.length, 0);
  assert.equal(projected.reason, "Result details are outside this scope.");
  const alternative = exampleData.ownership.specimens.find(
    (specimen) => specimen.plateWell === "A9",
  );
  const movedWell = {
    ...originalWell,
    sampleId: alternative.id,
    consentStatus: "active",
  };
  assert.equal(
    resolveResultOwner(
      { ...raw, specimenId: undefined },
      exampleData.ownership,
      movedWell,
    ).geography,
    "eu_west",
  );
  assert.equal(
    resolveResultOwner(raw, exampleData.ownership, movedWell),
    undefined,
    "conflicting explicit owners require a modeled lineage rather than guessed authority",
  );
  const base = createExampleRepository(exampleData);
  const stored = {
    ...base,
    getWell: (id, wellId) =>
      wellId === "C3" ? heldWell : base.getWell(id, wellId),
  };
  const scoped = createScopedRepository(stored, scope(), exampleData.ownership);
  assert.equal((await scoped.getResult(raw.id)).consent, "pending");
  assert.equal(
    (await scoped.listHistory(plateId, "C3"))[0].artifacts.length,
    0,
  );
});

test("unrecognized well ownership is unavailable across direct, history and related reads", async () => {
  const base = createExampleRepository(exampleData);
  const original = exampleData.wells.find((well) => well.id === "C3");
  const invalid = { ...original, sampleId: "SPX-unrecognized" };
  const scoped = createScopedRepository(
    { ...base, getWell: () => invalid },
    scope(),
    exampleData.ownership,
  );
  await assert.rejects(
    scoped.getWell(plateId, "C3"),
    (error) => error.extensions.code === "OWNERSHIP_UNAVAILABLE",
  );
  await assert.rejects(
    scoped.listHistory(plateId, "C3"),
    (error) => error.extensions.code === "OWNERSHIP_UNAVAILABLE",
  );
  await assert.rejects(
    scoped.getResult(
      exampleData.results.find((result) => result.wellId === "C3").id,
    ),
    (error) => error.extensions.code === "OWNERSHIP_UNAVAILABLE",
  );
});
