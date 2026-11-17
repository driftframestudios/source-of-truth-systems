import assert from "node:assert/strict";
import test from "node:test";
import mysql from "mysql2/promise";
import { exampleData } from "../build/server/example-data.mjs";
import { readDatabaseConfig } from "../server/data/connection.mjs";
import { initializeCatalog } from "../server/data/initialize-catalog.mjs";
import { PLATE_HISTORY_HASH } from "../shared/plate-history-operation.mjs";
import { runningServer } from "./server-fixture.mjs";

const enabled = process.env.MYSQL_CATALOG_TEST === "1";
test(
  "stored history survives new HTTP server processes and remains distinct from examples",
  { skip: !enabled },
  async (t) => {
    const config = readDatabaseConfig();
    assert.equal(config.mode, "mysql");
    assert.match(
      config.options.database,
      /^sot_[a-z0-9_]+_(proof|test)$/,
      "Use a dedicated disposable database",
    );
    const connection = await mysql.createConnection(config.options);
    t.after(() => connection.end());
    await initializeCatalog(connection, exampleData);
    const result = exampleData.results.find(
      (record) => record.wellId === "C3" && record.seq === 0,
    );
    const [[stored]] = await connection.execute(
      "SELECT metadata FROM showcase_results WHERE id = ?",
      [result.id],
    );
    const original =
      typeof stored.metadata === "string"
        ? stored.metadata
        : JSON.stringify(stored.metadata);
    const title = "Stored history across application restarts";
    await connection.execute(
      "UPDATE showcase_results SET metadata = JSON_SET(metadata, '$.title', ?) WHERE id = ?",
      [title, result.id],
    );
    try {
      const env = Object.fromEntries(
        ["DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD"].map(
          (key) => [key, process.env[key]],
        ),
      );
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const base = await runningServer(t, { env });
        const response = await fetch(`${base}/graphql`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            extensions: {
              persistedQuery: { version: 1, sha256Hash: PLATE_HISTORY_HASH },
            },
            variables: { plateId: exampleData.plateId, id: "C3" },
          }),
        });
        assert.equal(response.status, 200);
        const body = await response.json();
        assert.equal(body.errors, undefined, JSON.stringify(body));
        assert.equal(body.data.dataSource.mode, "STORED");
        const records = body.data.well.history.edges.map(({ node }) => node);
        assert.equal(records[0].title, title);
        assert.notEqual(records[0].title, result.title);
        assert.equal(records[1].supersedes.id, records[0].id);
        const originalFile = records[0].artifacts.edges.find(
          ({ node }) => node.file.kind === "bam",
        ).node.file;
        const reused = records[1].artifacts.edges.find(
          ({ node }) => node.file.kind === "bam",
        ).node;
        assert.equal(reused.file.id, originalFile.id);
        assert.equal(reused.reusedFrom.id, records[0].id);
        assert.equal(body.data.well.history.pageInfo.hasNextPage, false);
      }
    } finally {
      await connection.execute(
        "UPDATE showcase_results SET metadata = ? WHERE id = ?",
        [original, result.id],
      );
    }
  },
);
