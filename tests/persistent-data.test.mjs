import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import mysql from "mysql2/promise";
import { exampleData } from "../build/server/example-data.mjs";
import { assertPlateCatalog } from "../shared/plate-records.mjs";
import { CATALOG_TABLES } from "../server/data/catalog-schema.mjs";
import { initializeCatalog } from "../server/data/initialize-catalog.mjs";
import { createMySqlRepository } from "../server/data/mysql-repository.mjs";
import { exportCatalogSql } from "../server/data/export-catalog.mjs";
import { readDatabaseConfig } from "../server/data/connection.mjs";

const enabled = process.env.MYSQL_CATALOG_TEST === "1";
const baseline = assertPlateCatalog(exampleData);

function equalDisplay(actual, expected, path = "record") {
  if (typeof expected === "number" && typeof actual === "number") {
    // MySQL JSON prints doubles in its canonical decimal representation.
    assert.ok(
      Math.abs(actual - expected) <=
        Number.EPSILON * Math.max(1, Math.abs(expected)),
      path,
    );
  } else if (expected && typeof expected === "object") {
    assert.deepEqual(
      Object.keys(actual).sort(),
      Object.keys(expected).sort(),
      path,
    );
    for (const key of Object.keys(expected))
      equalDisplay(actual[key], expected[key], `${path}.${key}`);
  } else assert.deepEqual(actual, expected, path);
}

test("the SQL artifact shares the validated seed and contains no destructive or account administration commands", () => {
  const sql = exportCatalogSql(exampleData);
  assert.match(sql, /SET NAMES utf8mb4/);
  assert.match(sql, /START TRANSACTION/);
  assert.ok(
    Buffer.byteLength(sql) < 650_000,
    "Ordinary text stays compact instead of becoming hex",
  );
  assert.doesNotMatch(
    sql,
    /^\s*(?:USE\s|CREATE\s+DATABASE|SET\s+@@(?:GLOBAL\.GTID_PURGED|SESSION\.SQL_LOG_BIN))/im,
  );
  assert.doesNotMatch(sql, /DEFINER\s*=|GTID_PURGED|SQL_LOG_BIN/i);
  assert.doesNotMatch(
    sql,
    /^\s*(?:(?:CREATE|ALTER|DROP)\s+TABLESPACE|(?:UN)?LOCK\s+TABLES)\b/im,
  );
  assert.match(sql, /showcase_catalog_import_allowed/);
  assert.match(sql, /COMMIT;\s*$/);
  assert.doesNotMatch(
    sql,
    /\b(DROP|REPLACE|TRUNCATE|GRANT|DEFINER)\b|CREATE\s+(DATABASE|USER)|SET\s+GLOBAL/i,
  );
});

test(
  "MySQL catalog preserves records, relationships, atomic seeding and read-only request scope",
  { skip: !enabled },
  async (t) => {
    const config = readDatabaseConfig();
    assert.equal(config.mode, "mysql");
    assert.match(
      config.options.database,
      /^sot_[a-z0-9_]+_(?:proof|test)$/,
      "Use an explicitly disposable sot_*_proof or sot_*_test schema; this test clears its showcase tables.",
    );
    let connection = await mysql.createConnection(config.options);
    const reconnect = async () => {
      await connection.end();
      connection = await mysql.createConnection(config.options);
    };
    const clear = async () => {
      for (const table of [...CATALOG_TABLES].reverse())
        await connection.query(`DROP TABLE IF EXISTS ${table}`);
    };
    await clear();
    try {
      await t.test(
        "full display records round-trip and shared files retain one physical row",
        async () => {
          const result = await initializeCatalog(connection, exampleData);
          assert.deepEqual(result, {
            initialized: true,
            plateId: baseline.plateId,
            wells: 96,
            results: 131,
          });
          const repository = await createMySqlRepository(connection);
          assert.equal(repository.mode, "stored");
          const wells = await repository.listWells(baseline.plateId);
          equalDisplay(
            wells,
            baseline.wells.map((well) => ({
              ...well,
              plateId: baseline.plateId,
              asOf: baseline.asOf,
            })),
          );
          for (const well of wells)
            equalDisplay(
              await repository.listHistory(baseline.plateId, well.id),
              baseline.results
                .filter((result) => result.wellId === well.id)
                .map((result) => ({ ...result, anchorPlateId: baseline.plateId }))
                .sort((a, b) => a.seq - b.seq),
            );
          assert.equal(await repository.getWell("other-plate", "C3"), null);
          assert.deepEqual(
            await repository.listHistory("other-plate", "C3"),
            [],
          );
          assert.equal(await repository.getResult("missing"), null);
          assert.equal(
            await repository.getWell(baseline.plateId, "unknown-well"),
            null,
          );
          assert.deepEqual(
            await repository.listHistory(baseline.plateId, "unknown-well"),
            [],
          );
          const [[counts]] = await connection.query(
            "SELECT (SELECT COUNT(*) FROM showcase_files) AS files, (SELECT COUNT(*) FROM showcase_artifacts) AS references_count",
          );
          assert.ok(counts.files < counts.references_count);
          const [[version]] = await connection.query(
            "SELECT VERSION() AS version",
          );
          t.diagnostic(
            `MySQL ${version.version}, mysql2 ${mysql.version ?? "promise driver"}; actual InnoDB storage.`,
          );
        },
      );

      await t.test(
        "history reads feed request-local relations and physical identity wins over stale metadata",
        async () => {
          let queries = 0;
          const counted = new Proxy(connection, {
            get(target, key) {
              if (key === "execute")
                return (...args) => {
                  queries++;
                  return target.execute(...args);
                };
              const value = target[key];
              return typeof value === "function" ? value.bind(target) : value;
            },
          });
          const repository = await createMySqlRepository(counted);
          const history = await repository.listHistory(baseline.plateId, "C3");
          const historyQueries = queries;
          await Promise.all(
            history.flatMap((result) => [
              repository.getResult(result.id),
              repository.getResult(result.id),
            ]),
          );
          assert.equal(queries, historyQueries);
          const selected = baseline.results.find(
            (result) =>
              !result.supersedes &&
              result.artifacts.some((file) => !file.reusedFrom),
          );
          const file = selected.artifacts.find((file) => !file.reusedFrom);
          await connection.execute(
            "UPDATE showcase_results SET metadata = JSON_SET(metadata, '$.supersedes', 'stale-id') WHERE id = ?",
            [selected.id],
          );
          await connection.execute(
            "UPDATE showcase_artifacts SET metadata = JSON_SET(metadata, '$.sizeBytes', 7, '$.reusedFrom', 'stale-id') WHERE result_id = ? AND object_key = ?",
            [selected.id, file.key],
          );
          const fresh = await createMySqlRepository(connection);
          const reconstructed = await fresh.getResult(selected.id);
          assert.equal(reconstructed.supersedes, undefined);
          const reconstructedFile = reconstructed.artifacts.find(
            (candidate) => candidate.key === file.key,
          );
          assert.equal(reconstructedFile.reusedFrom, undefined);
          assert.equal(reconstructedFile.sizeBytes, file.sizeBytes);
          await connection.execute(
            "UPDATE showcase_results SET metadata = JSON_REMOVE(metadata, '$.supersedes') WHERE id = ?",
            [selected.id],
          );
          await connection.execute(
            "UPDATE showcase_artifacts SET metadata = JSON_REMOVE(metadata, '$.sizeBytes', '$.reusedFrom') WHERE result_id = ? AND object_key = ?",
            [selected.id, file.key],
          );
        },
      );

      await t.test(
        "a fresh application connection retains edits and an explicit second init never resets them",
        async () => {
          const selected = baseline.results.find(
            (result) => result.wellId === "C3",
          );
          await connection.execute(
            "UPDATE showcase_results SET metadata = JSON_SET(metadata, '$.title', ?) WHERE id = ?",
            ["Retained source title", selected.id],
          );
          await reconnect();
          const repository = await createMySqlRepository(connection);
          assert.equal(
            (await repository.getResult(selected.id)).title,
            "Retained source title",
          );
          assert.equal(
            (await initializeCatalog(connection, exampleData)).initialized,
            false,
          );
          assert.equal(
            (await repository.getResult(selected.id)).title,
            "Retained source title",
          );
          await connection.execute(
            "UPDATE showcase_results SET metadata = JSON_SET(metadata, '$.title', ?) WHERE id = ?",
            [selected.title, selected.id],
          );
        },
      );

      await t.test(
        "database foreign keys and unique positions reject invalid owned relationships",
        async () => {
          await assert.rejects(
            connection.execute(
              "INSERT INTO showcase_wells (plate_id, id, row_index, column_index, metadata) VALUES (?, ?, 0, 0, ?)",
              ["missing", "A1", "{}"],
            ),
            (error) => error.errno === 1452,
          );
          await assert.rejects(
            connection.query(`INSERT INTO showcase_results (id, anchor_plate_id, well_id, sequence_index, metadata)
        SELECT 'duplicate-position', anchor_plate_id, well_id, sequence_index, metadata FROM showcase_results LIMIT 1`),
            (error) => error.errno === 1062,
          );
          const child = baseline.results.find((result) => result.supersedes);
          const foreign = baseline.results.find(
            (result) => result.wellId !== child.wellId && result.seq === 0,
          );
          await assert.rejects(
            connection.execute(
              "UPDATE showcase_results SET supersedes_id = ?, supersedes_sequence = 0 WHERE id = ?",
              [foreign.id, child.id],
            ),
            (error) => error.errno === 1452,
          );
          const alias = baseline.results.find((result) =>
            result.artifacts.some((artifact) => artifact.reusedFrom),
          );
          const aliasFile = alias.artifacts.find(
            (artifact) => artifact.reusedFrom,
          );
          const otherKey = baseline.results.find(
            (result) =>
              result.wellId !== alias.wellId && result.artifacts.length,
          ).artifacts[0].key;
          await assert.rejects(
            connection.execute(
              "UPDATE showcase_artifacts SET object_key = ? WHERE result_id = ? AND object_key = ?",
              [otherKey, alias.id, aliasFile.key],
            ),
            (error) => error.errno === 1452,
          );
        },
      );

      await t.test(
        "one physical file update reaches aliases and a read-only transaction rejects writes",
        async () => {
          const alias = baseline.results.find((result) =>
            result.artifacts.some((artifact) => artifact.reusedFrom),
          );
          const file = alias.artifacts.find((artifact) => artifact.reusedFrom);
          await connection.execute(
            "UPDATE showcase_files SET metadata = JSON_SET(metadata, '$.sizeBytes', ?) WHERE object_key = ?",
            [file.sizeBytes + 1, file.key],
          );
          const repository = await createMySqlRepository(connection);
          const history = await repository.listHistory(
            baseline.plateId,
            alias.wellId,
          );
          const aliases = history
            .flatMap((result) => result.artifacts)
            .filter((artifact) => artifact.key === file.key);
          assert.ok(aliases.length >= 2);
          assert.ok(
            aliases.every(
              (artifact) => artifact.sizeBytes === file.sizeBytes + 1,
            ),
          );
          await connection.execute(
            "UPDATE showcase_files SET metadata = JSON_SET(metadata, '$.sizeBytes', ?) WHERE object_key = ?",
            [file.sizeBytes, file.key],
          );
          await connection.query("SET TRANSACTION READ ONLY");
          await connection.beginTransaction();
          assert.equal(
            (await repository.getPlate(baseline.plateId)).id,
            baseline.plateId,
          );
          await assert.rejects(
            connection.execute(
              "DELETE FROM showcase_files WHERE object_key = ?",
              [file.key],
            ),
            (error) => error.errno === 1792,
          );
          await connection.rollback();
        },
      );

      await t.test(
        "wrong schema and invalid stored display data fail at their receiving boundary",
        async () => {
          await connection.query(
            "UPDATE showcase_catalog SET schema_version = 99",
          );
          await assert.rejects(
            createMySqlRepository(connection),
            (error) => error.code === "CATALOG_SCHEMA_MISMATCH",
          );
          await assert.rejects(
            initializeCatalog(connection, exampleData),
            (error) => error.code === "CATALOG_SCHEMA_MISMATCH",
          );
          await connection.query(
            "UPDATE showcase_catalog SET schema_version = 1",
          );
          const selected = baseline.results[0];
          await connection.execute(
            "UPDATE showcase_results SET metadata = JSON_SET(metadata, '$.status', 'invented') WHERE id = ?",
            [selected.id],
          );
          const repository = await createMySqlRepository(connection);
          await assert.rejects(
            repository.getResult(selected.id),
            /Invalid plate record/,
          );
          await connection.execute(
            "UPDATE showcase_results SET metadata = JSON_SET(metadata, '$.status', ?) WHERE id = ?",
            [selected.status, selected.id],
          );
        },
      );

      await t.test(
        "an interrupted real seed rolls back every row and the owned empty schema can retry",
        async () => {
          await clear();
          let inserted = 0;
          const interrupted = new Proxy(connection, {
            get(target, key) {
              if (key === "execute")
                return async (sql, values) => {
                  if (
                    sql.startsWith("INSERT INTO showcase_results") &&
                    ++inserted === 2
                  )
                    throw new Error("Controlled seed interruption");
                  return target.execute(sql, values);
                };
              const value = target[key];
              return typeof value === "function" ? value.bind(target) : value;
            },
          });
          await assert.rejects(
            initializeCatalog(interrupted, exampleData),
            /Controlled seed interruption/,
          );
          for (const table of CATALOG_TABLES.slice(1)) {
            const [[row]] = await connection.query(
              `SELECT COUNT(*) AS count FROM ${table}`,
            );
            assert.equal(row.count, 0);
          }
          await assert.rejects(
            createMySqlRepository(connection),
            (error) => error.code === "CATALOG_NOT_INITIALIZED",
          );
          assert.equal(
            (await initializeCatalog(connection, exampleData)).initialized,
            true,
          );
        },
      );

      await t.test(
        "invalid seed changes no existing records and creates no fresh tables",
        async () => {
          const invalid = structuredClone(exampleData);
          invalid.results[0].wellId = "Z99";
          // A completed catalog is retained regardless of an unused replacement seed.
          assert.equal(
            (await initializeCatalog(connection, invalid)).initialized,
            false,
          );
          await clear();
          await assert.rejects(
            initializeCatalog(connection, invalid),
            /Invalid plate record/,
          );
          const [tables] = await connection.query(
            "SHOW TABLES LIKE 'showcase\\_%'",
          );
          assert.equal(tables.length, 0);
        },
      );

      if (process.env.MYSQL_CLIENT)
        await t.test(
          "the owner SQL import runs on MySQL and a repeated import preserves a changed record",
          async () => {
            const importSql = (data = exampleData, mode = "") =>
              spawnSync(
                process.env.MYSQL_CLIENT,
                [
                  "--protocol=TCP",
                  "--host",
                  config.options.host,
                  "--port",
                  String(config.options.port),
                  "--user",
                  config.options.user,
                  "--database",
                  config.options.database,
                  "--default-character-set=utf8mb4",
                ],
                {
                  input: `SET SESSION sql_mode = '${mode}';\n${exportCatalogSql(data)}`,
                  encoding: "utf8",
                  env: { ...process.env, MYSQL_PWD: config.options.password },
                  timeout: 20000,
                },
              );
            // An unmarked table may have a compatible shape but lack this
            // catalog's constraints. Import must not adopt or certify it.
            await connection.query(`CREATE TABLE showcase_files (
              object_key VARCHAR(512) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL PRIMARY KEY,
              metadata JSON NOT NULL
            ) ENGINE=InnoDB`);
            let imported = importSql();
            assert.ifError(imported.error);
            assert.equal(imported.status, 0, imported.stderr);
            const [[unmarked]] = await connection.query(
              "SELECT COUNT(*) AS count FROM showcase_catalog",
            );
            assert.equal(unmarked.count, 0);
            await assert.rejects(
              createMySqlRepository(connection),
              (error) => error.code === "CATALOG_NOT_INITIALIZED",
            );
            const [[unseeded]] = await connection.query(
              "SELECT COUNT(*) AS count FROM showcase_plates",
            );
            assert.equal(unseeded.count, 0);
            await clear();
            imported = importSql();
            assert.equal(imported.status, 0, imported.stderr);
            const repository = await createMySqlRepository(connection);
            assert.equal(
              (await repository.listWells(baseline.plateId)).length,
              96,
            );
            const selected = baseline.results[0];
            await connection.execute(
              "UPDATE showcase_results SET metadata = JSON_SET(metadata, '$.title', ?) WHERE id = ?",
              ["Preserved through repeated import", selected.id],
            );
            imported = importSql();
            assert.equal(imported.status, 0, imported.stderr);
            assert.equal(
              (await repository.getResult(selected.id)).title,
              "Preserved through repeated import",
            );
            const varied = structuredClone(exampleData);
            varied.results[0].title = "Visitor's café — α";
            varied.results[1].title =
              'Quoted "value", path C:\\records\\sample, line\nbreak';
            for (const mode of [
              "STRICT_TRANS_TABLES",
              "STRICT_TRANS_TABLES,NO_BACKSLASH_ESCAPES",
            ]) {
              await clear();
              imported = importSql(varied, mode);
              assert.ifError(imported.error);
              assert.equal(imported.status, 0, imported.stderr);
              const importedRepository =
                await createMySqlRepository(connection);
              for (const result of varied.results.slice(0, 2)) {
                assert.equal(
                  (await importedRepository.getResult(result.id)).title,
                  result.title,
                );
              }
            }
          },
        );
    } finally {
      await clear();
      await connection.end();
    }
  },
);
