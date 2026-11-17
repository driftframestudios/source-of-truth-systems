import assert from "node:assert/strict";
import test from "node:test";
import { exampleData } from "../build/server/example-data.mjs";
import {
  assertPlateCatalog,
  parseWellResult,
  parseWell,
} from "../shared/plate-records.mjs";
import { readDatabaseConfig } from "../server/data/connection.mjs";

test("the stored record contract retains the full display projection and owns its nested values", () => {
  const catalog = assertPlateCatalog(exampleData);
  for (const [index, result] of catalog.results.entries()) {
    assert.deepEqual(
      result,
      JSON.parse(JSON.stringify(exampleData.results[index])),
      result.id,
    );
  }
  const read = parseWellResult(exampleData.results[0]);
  read.metrics[0].value = 999;
  assert.notEqual(exampleData.results[0].metrics[0].value, 999);
});

test("broken relationships and divergent physical files are rejected before publication", () => {
  const broken = structuredClone(exampleData);
  broken.results[0].wellId = "missing";
  assert.throws(() => assertPlateCatalog(broken), /result well/);
  const duplicate = structuredClone(exampleData);
  duplicate.results.push(duplicate.results[0]);
  assert.throws(() => assertPlateCatalog(duplicate), /duplicate result/);
  const shared = structuredClone(exampleData);
  const alias = shared.results
    .flatMap((r) => r.artifacts)
    .find((a) => a.reusedFrom);
  alias.sizeBytes += 1;
  assert.throws(() => assertPlateCatalog(shared), /physical file identity/);
  const wrong = structuredClone(exampleData.results[0]);
  wrong.metrics[0].value = Infinity;
  assert.throws(() => parseWellResult(wrong), /metric value/);
  assert.throws(
    () => parseWell({ ...exampleData.wells[0], assay: "unrecognized" }),
    /assay/,
  );
  assert.throws(
    () => parseWell({ ...exampleData.wells[0], priority: "unrecognized" }),
    /priority/,
  );
});

test("Hosted Database configuration distinguishes absent from incomplete and validates the port", () => {
  assert.deepEqual(readDatabaseConfig({}), { mode: "example" });
  assert.throws(() => readDatabaseConfig({ DB_HOST: "host" }), /incomplete/);
  const env = {
    DB_HOST: "host",
    DB_NAME: "catalog",
    DB_USER: "reader",
    DB_PASSWORD: "test-only",
    DB_PORT: "3306",
  };
  assert.equal(readDatabaseConfig(env).options.multipleStatements, false);
  assert.equal(readDatabaseConfig(env).options.port, 3306);
  assert.throws(
    () => readDatabaseConfig({ ...env, DB_PORT: "3306oops" }),
    /DB_PORT/,
  );
});

test("record text retains supported Unicode and rejects PostgreSQL-incompatible scalars before SQL", () => {
  const title = "Patient’s café — α, 日本語, 🧬";
  assert.equal(
    parseWellResult({ ...exampleData.results[0], title }).title,
    title,
  );
  assert.equal(parseWell({ ...exampleData.wells[0], note: title }).note, title);
  for (const invalid of [
    "bad\u0000value",
    "bad\ud800value",
    "bad\udfffvalue",
  ]) {
    assert.throws(
      () => parseWellResult({ ...exampleData.results[0], title: invalid }),
      /Invalid plate record/,
    );
    assert.throws(
      () => parseWell({ ...exampleData.wells[0], note: invalid }),
      /Invalid plate record/,
    );
    assert.throws(
      () => assertPlateCatalog({ ...exampleData, plateId: invalid }),
      /Invalid plate record/,
    );
  }
});
