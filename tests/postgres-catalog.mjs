import assert from "node:assert/strict";
import test from "node:test";
import { execute } from "graphql";
import { createReadSchema } from "../server/graphql/schema.mjs";
import { createOperationRegistry } from "../server/graphql/operations.mjs";
import { deriveScenario } from "../shared/permission-scope.mjs";
import pg from "pg";
import { exampleData } from "../build/server/example-data.mjs";
import { assertPlateCatalog } from "../shared/plate-records.mjs";
import { CATALOG_TABLES } from "../server/data/catalog-schema.mjs";
import { readDatabaseConfig } from "../server/data/connection.mjs";
import { createPostgresRepository } from "../server/data/postgres-repository.mjs";
import { initializePostgresCatalog } from "../server/data/postgres-initialize.mjs";
import { existingTables } from "../server/postgres/schema-shape.mjs";
import { createPostgresConnectionScope } from "../server/postgres/connection.mjs";

const enabled = process.env.POSTGRES_TEST === "1";
const baseline = assertPlateCatalog(exampleData);

test(
  "PostgreSQL catalog preserves canonical records, explicit ownership and transactional setup",
  { skip: !enabled, timeout: 60_000 },
  async (t) => {
    const config = readDatabaseConfig();
    assert.equal(config.mode, "postgres");
    assert.ok(
      ["127.0.0.1", "localhost", "::1"].includes(config.options.host),
      "Use an isolated loopback PostgreSQL engine.",
    );
    assert.match(
      config.options.database,
      /^sot_[a-z0-9_]+_(?:proof|test)$/,
      "This proof clears only its explicitly disposable catalog.",
    );
    const connect = async () => {
      const client = new pg.Client(config.options);
      await client.connect();
      return client;
    };
    const client = await connect();
    const clear = async () => {
      for (const table of [...CATALOG_TABLES].reverse())
        await client.query(`DROP TABLE IF EXISTS public.${table}`);
    };
    const countQueries = (client) => {
      let count = 0;
      return {
        get count() {
          return count;
        },
        query(...args) {
          count++;
          return client.query(...args);
        },
      };
    };
    await clear();
    try {
      await t.test(
        "full records, identity and ordering round-trip with one row per physical file",
        async () => {
          const result = await initializePostgresCatalog(client, exampleData);
          assert.deepEqual(result, {
            initialized: true,
            plateId: baseline.plateId,
            wells: 96,
            results: 131,
          });
          const repository = await createPostgresRepository(client);
          assert.deepEqual(await repository.getPlate(baseline.plateId), {
            id: baseline.plateId,
            asOf: baseline.asOf,
            rows: 8,
            columns: 12,
          });
          const wells = await repository.listWells(baseline.plateId);
          assert.deepEqual(
            wells,
            baseline.wells.map((well) => ({
              ...well,
              plateId: baseline.plateId,
              asOf: baseline.asOf,
            })),
          );
          for (const well of wells)
            assert.deepEqual(
              await repository.listHistory(baseline.plateId, well.id),
              baseline.results
                .filter((r) => r.wellId === well.id)
                .map((r) => ({ ...r, anchorPlateId: baseline.plateId }))
                .sort((a, b) => a.seq - b.seq),
            );
          assert.equal(await repository.getWell("other-plate", "C3"), null);
          assert.equal(
            await repository.getWell(baseline.plateId, "c3"),
            null,
            "Opaque coordinates retain case-sensitive equality.",
          );
          assert.equal(await repository.getResult("missing"), null);
          assert.deepEqual(
            await repository.listHistory("other-plate", "C3"),
            [],
          );
          const {
            rows: [counts],
          } = await client.query(
            "SELECT (SELECT count(*)::int FROM public.showcase_files) AS files, (SELECT count(*)::int FROM public.showcase_artifacts) AS references",
          );
          assert.ok(counts.files < counts.references);
          const {
            rows: [version],
          } = await client.query(
            "SELECT current_setting('server_version') AS version, rolsuper FROM pg_catalog.pg_roles WHERE rolname = current_user",
          );
          assert.equal(
            version.rolsuper,
            false,
            "Setup runs as an ordinary database owner, not a cluster superuser.",
          );
          t.diagnostic(
            `PostgreSQL ${version.version}; ordinary role; canonical 96 wells / 131 results.`,
          );
        },
      );

      await t.test(
        "the runtime role reads the catalog with SELECT privileges and keeps setup/write authority separate",
        async () => {
          const user = process.env.PGRUNTIMEUSER;
          const password = process.env.PGRUNTIMEPASSWORD;
          assert.match(
            user ?? "",
            /^sot_[a-z0-9_]+$/,
            "Provide the dedicated ordinary runtime role.",
          );
          assert.ok(password, "Provide the disposable runtime credential.");
          await client.query(
            `GRANT SELECT ON ${CATALOG_TABLES.map((table) => `public.${table}`).join(",")} TO "${user}"`,
          );
          const runtime = new pg.Client({ ...config.options, user, password });
          await runtime.connect();
          try {
            const repository = await createPostgresRepository(runtime);
            assert.equal(
              (await repository.listHistory(baseline.plateId, "C3")).length,
              3,
            );
            const {
              rows: [authority],
            } = await runtime.query(
              "SELECT has_schema_privilege(current_user,'public','CREATE') AS setup",
            );
            assert.equal(authority.setup, false);
            await assert.rejects(
              runtime.query(
                "UPDATE public.showcase_catalog SET seed_version=2",
              ),
              { code: "42501" },
            );
          } finally {
            await runtime.end();
          }
        },
      );

      await t.test(
        "history batches artifacts and populates only its request-local relation cache",
        async () => {
          const counted = countQueries(client);
          const repository = await createPostgresRepository(counted);
          const before = counted.count;
          const history = await repository.listHistory(baseline.plateId, "C3");
          assert.equal(
            counted.count - before,
            2,
            "One result query and one artifact query serve the entire history.",
          );
          const loaded = counted.count;
          await Promise.all(
            history.flatMap((r) => [
              repository.getResult(r.id),
              repository.getResult(r.id),
            ]),
          );
          assert.equal(counted.count, loaded);
          const next = await createPostgresRepository(counted);
          await next.getResult(history[0].id);
          assert.ok(
            counted.count > loaded,
            "A new request owns its own relation cache.",
          );
        },
      );

      await t.test(
        "registered history operations retain bounded query work",
        async () => {
          const schema = createReadSchema(exampleData);
          const registry = createOperationRegistry(schema);
          const parsed = deriveScenario(exampleData.permissionCatalog);
          assert.equal(parsed.ok, true);
          for (const name of ["PlateHistory", "WellHistory", "ResultDetails"]) {
            const counted = countQueries(client);
            const repository = await createPostgresRepository(counted);
            const before = counted.count;
            const descriptor = registry.operations.find(
              (operation) => operation.name === name,
            );
            const result = await execute({
              schema,
              document: registry.get(descriptor.sha256Hash),
              variableValues:
                name === "ResultDetails"
                  ? { id: baseline.results.find((r) => r.wellId === "C3").id }
                  : { plateId: baseline.plateId, id: "C3" },
              contextValue: {
                permissionScope: parsed.scope,
                scopeNamespace: "catalog-proof",
              request: new Request("http://localhost/graphql"),
                dataMode: "STORED",
                plateRepository: () => repository,
              },
            });
            assert.equal(result.errors, undefined);
            assert.ok(
              name === "ResultDetails" ? result.data.result : result.data.well,
            );
            assert.ok(
              counted.count - before <= 6,
              `${name} query work stays bounded`,
            );
            t.diagnostic(
              `${name}: ${counted.count - before} data queries after schema admission.`,
            );
          }
        },
      );

      await t.test(
        "Unicode, JSON numbers and null references retain their shared meaning across reconnect and repeat setup",
        async () => {
          const chosen = baseline.results.find(
            (r) => !r.supersedes && r.artifacts.some((a) => !a.reusedFrom),
          );
          const title = "Patient’s café — α, 日本語, 🧬";
          await client.query(
            "UPDATE public.showcase_results SET metadata = metadata || $1::jsonb WHERE id = $2",
            [JSON.stringify({ title, supersedes: "stale-json-id" }), chosen.id],
          );
          const other = await connect();
          try {
            const repo = await createPostgresRepository(other);
            assert.equal((await repo.getResult(chosen.id)).title, title);
            assert.equal(
              (await repo.getResult(chosen.id)).supersedes,
              undefined,
              "Relational null defeats stale metadata.",
            );
            const unusedInvalidSeed = { ...exampleData, plateId: "" };
            assert.equal(
              (await initializePostgresCatalog(other, unusedInvalidSeed))
                .initialized,
              false,
            );
            assert.equal(
              (await createPostgresRepository(other)).mode,
              "stored",
            );
            assert.equal(
              (
                await (
                  await createPostgresRepository(other)
                ).getResult(chosen.id)
              ).title,
              title,
            );
          } finally {
            await other.end();
          }
          const alias = baseline.results.find((r) =>
            r.artifacts.some((a) => a.reusedFrom),
          );
          const file = alias.artifacts.find((a) => a.reusedFrom);
          await client.query(
            "UPDATE public.showcase_files SET metadata = metadata || $1::jsonb WHERE object_key = $2",
            [JSON.stringify({ sizeBytes: Number.MAX_SAFE_INTEGER }), file.key],
          );
          const histories = await (
            await createPostgresRepository(client)
          ).listHistory(baseline.plateId, alias.wellId);
          const references = histories
            .flatMap((r) => r.artifacts)
            .filter((a) => a.key === file.key);
          assert.ok(references.length >= 2);
          assert.ok(
            references.every((a) => a.sizeBytes === Number.MAX_SAFE_INTEGER),
          );
          await client.query(
            "UPDATE public.showcase_files SET metadata = metadata || $1::jsonb WHERE object_key = $2",
            [JSON.stringify({ sizeBytes: file.sizeBytes }), file.key],
          );
        },
      );

      await t.test(
        "ordinary SQL writers encounter composite scope, reuse, uniqueness and metadata constraints",
        async () => {
          await assert.rejects(
            client.query(
              "INSERT INTO public.showcase_wells (plate_id,id,row_index,column_index,metadata) VALUES ('missing','A1',0,0,'{}')",
            ),
            { code: "23503" },
          );
          await assert.rejects(
            client.query(
              "INSERT INTO public.showcase_results (id,anchor_plate_id,well_id,sequence_index,metadata) SELECT 'duplicate',anchor_plate_id,well_id,sequence_index,metadata FROM public.showcase_results LIMIT 1",
            ),
            { code: "23505" },
          );
          const child = baseline.results.find((r) => r.supersedes);
          const foreign = baseline.results.find(
            (r) => r.wellId !== child.wellId && r.seq === 0,
          );
          await assert.rejects(
            client.query(
              "UPDATE public.showcase_results SET supersedes_id=$1,supersedes_sequence=0 WHERE id=$2",
              [foreign.id, child.id],
            ),
            { code: "23503" },
          );
          const alias = baseline.results.find((r) =>
            r.artifacts.some((a) => a.reusedFrom),
          );
          const file = alias.artifacts.find((a) => a.reusedFrom);
          const otherKey = baseline.results.find(
            (r) => r.wellId !== alias.wellId && r.artifacts.length,
          ).artifacts[0].key;
          await assert.rejects(
            client.query(
              "UPDATE public.showcase_artifacts SET object_key=$1 WHERE result_id=$2 AND object_key=$3",
              [otherKey, alias.id, file.key],
            ),
            { code: "23503" },
          );
          await assert.rejects(
            client.query(
              "UPDATE public.showcase_files SET metadata='[]' WHERE object_key=$1",
              [file.key],
            ),
            { code: "23514" },
          );
          await assert.rejects(
            client.query(
              "UPDATE public.showcase_files SET metadata=$1 WHERE object_key=$2",
              [JSON.stringify({ text: "x".repeat(32769) }), file.key],
            ),
            { code: "23514" },
          );
          const r = baseline.results[0];
          await client.query(
            'UPDATE public.showcase_results SET metadata = metadata || \'{"status":"invented"}\' WHERE id=$1',
            [r.id],
          );
          await assert.rejects(
            (await createPostgresRepository(client)).getResult(r.id),
            /Invalid plate record/,
          );
          await client.query(
            "UPDATE public.showcase_results SET metadata=metadata || $1::jsonb WHERE id=$2",
            [JSON.stringify({ status: r.status }), r.id],
          );
        },
      );

      await t.test(
        "a request snapshot stays consistent while another client commits, and the next request sees it",
        async () => {
          const selected = baseline.results.find((r) => r.wellId === "C3");
          const scope = createPostgresConnectionScope(
            config.options,
            new AbortController().signal,
          );
          let before;
          try {
            const held = await scope.get();
            const repository = await createPostgresRepository(held);
            before = (await repository.getResult(selected.id)).title;
            await client.query(
              "UPDATE public.showcase_results SET metadata=metadata || $1::jsonb WHERE id=$2",
              [
                JSON.stringify({ title: "Committed during an earlier read" }),
                selected.id,
              ],
            );
            // A separate repository defeats the relation cache; the transaction owns consistency.
            assert.equal(
              (
                await (
                  await createPostgresRepository(held)
                ).getResult(selected.id)
              ).title,
              before,
            );
            await assert.rejects(
              held.query("DELETE FROM public.showcase_results WHERE id=$1", [
                selected.id,
              ]),
              { code: "25006" },
            );
          } finally {
            await scope.close();
          }
          const fresh = createPostgresConnectionScope(
            config.options,
            new AbortController().signal,
          );
          try {
            assert.equal(
              (
                await (
                  await createPostgresRepository(await fresh.get())
                ).getResult(selected.id)
              ).title,
              "Committed during an earlier read",
            );
          } finally {
            await fresh.close();
          }
          await client.query(
            "UPDATE public.showcase_results SET metadata=metadata || $1::jsonb WHERE id=$2",
            [JSON.stringify({ title: before }), selected.id],
          );
        },
      );

      await t.test(
        "bounded canonical queries expose observed plans without requiring a particular planner node",
        async () => {
          await client.query("ANALYZE public.showcase_results");
          await client.query("ANALYZE public.showcase_artifacts");
          const plans = [
            [
              "SELECT * FROM public.showcase_results WHERE anchor_plate_id=$1 AND well_id=$2 ORDER BY sequence_index LIMIT 51",
              [baseline.plateId, "C3"],
              3,
            ],
            [
              "SELECT a.result_id,a.ordinal,f.metadata FROM public.showcase_artifacts a JOIN public.showcase_files f ON f.object_key=a.object_key WHERE a.result_id=ANY($1::varchar[]) ORDER BY a.result_id,a.ordinal LIMIT 401",
              [
                baseline.results
                  .filter((r) => r.wellId === "C3")
                  .map((r) => r.id),
              ],
              null,
            ],
          ];
          for (const [sql, values, expected] of plans) {
            const { rows } = await client.query(
              `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`,
              values,
            );
            const plan = rows[0]["QUERY PLAN"][0].Plan;
            assert.equal(plan["Actual Loops"], 1);
            assert.ok(plan["Actual Rows"] <= 400);
            if (expected != null) assert.equal(plan["Actual Rows"], expected);
            t.diagnostic(
              `Bounded catalog plan: ${plan["Node Type"]}, ${plan["Actual Rows"]} rows, ${plan["Actual Loops"]} loop.`,
            );
          }
        },
      );

      await t.test(
        "foreign, partial, newer and physically drifted schemas remain outside setup acceptance",
        async () => {
          await client.query(
            "UPDATE public.showcase_catalog SET schema_version=99",
          );
          await assert.rejects(initializePostgresCatalog(client, exampleData), {
            code: "CATALOG_SCHEMA_MISMATCH",
          });
          await client.query(
            "UPDATE public.showcase_catalog SET schema_version=1",
          );
          await client.query(
            "ALTER TABLE public.showcase_artifacts DROP CONSTRAINT showcase_artifact_origin_file",
          );
          await assert.rejects(initializePostgresCatalog(client, exampleData), {
            code: "CATALOG_SCHEMA_MISMATCH",
          });
          await clear();
          await client.query(
            "CREATE TABLE public.showcase_files (object_key text PRIMARY KEY,metadata jsonb)",
          );
          await assert.rejects(initializePostgresCatalog(client, exampleData), {
            code: "CATALOG_SCHEMA_MISMATCH",
          });
          assert.deepEqual(
            [...(await existingTables(client, CATALOG_TABLES))],
            ["showcase_files"],
          );
          await clear();
        },
      );

      await t.test(
        "failed seed and marker writes roll back DDL and leave a clean retry",
        async () => {
          for (const stop of [
            "INSERT INTO public.showcase_results",
            "INSERT INTO public.showcase_catalog",
          ]) {
            let inserts = 0;
            const failing = {
              query(sql, ...args) {
                if (
                  sql.startsWith(stop) &&
                  ++inserts === (stop.endsWith("results") ? 2 : 1)
                )
                  throw new Error("Controlled setup interruption");
                return client.query(sql, ...args);
              },
            };
            await assert.rejects(
              initializePostgresCatalog(failing, exampleData),
              /Controlled setup interruption/,
            );
            assert.equal(
              (await existingTables(client, CATALOG_TABLES)).size,
              0,
            );
          }
          const invalid = structuredClone(exampleData);
          invalid.results[0].title = "invalid\u0000value";
          await assert.rejects(
            initializePostgresCatalog(client, invalid),
            /Invalid plate record/,
          );
          assert.equal((await existingTables(client, CATALOG_TABLES)).size, 0);
          assert.equal(
            (await initializePostgresCatalog(client, exampleData)).initialized,
            true,
          );
        },
      );

      await t.test(
        "two initializers serialize and the second preserves the accepted catalog",
        async () => {
          await clear();
          const other = await connect();
          try {
            const results = await Promise.all([
              initializePostgresCatalog(client, exampleData),
              initializePostgresCatalog(other, exampleData),
            ]);
            assert.deepEqual(results.map((r) => r.initialized).sort(), [
              false,
              true,
            ]);
            assert.equal(
              (
                await (
                  await createPostgresRepository(client)
                ).listWells(baseline.plateId)
              ).length,
              96,
            );
          } finally {
            await other.end();
          }
        },
      );
    } finally {
      try {
        await clear();
      } finally {
        await client.end();
      }
    }
  },
);
