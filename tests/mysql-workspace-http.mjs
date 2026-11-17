import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { runningServer } from "./server-fixture.mjs";
import { createWorkspaceApi } from "../server/workspaces/graphql.mjs";
import {
  exampleData,
  prepareSourceCommand,
} from "../build/server/example-data.mjs";

test(
  "production HTTP persists isolated metadata and exact retries in the disposable MySQL store",
  { skip: process.env.MYSQL_WORKSPACE_HTTP !== "1" },
  async (t) => {
    assert.match(process.env.DB_NAME ?? "", /^sot_[a-z0-9_]+_(test|proof)$/);
    const env = Object.fromEntries(
      ["DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD"].map(
        (name) => [name, process.env[name]],
      ),
    );
    const base = await runningServer(t, { env });
    const { operations } = createWorkspaceApi({
      data: exampleData,
      prepareSourceCommand,
    });
    const hashes = new Map(
      operations.map((operation) => [operation.name, operation.sha256Hash]),
    );
    const cookies = [];
    async function call(name, variables = {}, cookie) {
      const response = await fetch(`${base}/workspace/graphql`, {
        method: "POST",
        headers: {
          origin: base,
          "content-type": "application/json",
          "x-sot-workspace": "1",
          ...(cookie ? { cookie } : {}),
        },
        body: JSON.stringify({
          operationName: name,
          variables,
          extensions: {
            persistedQuery: { version: 1, sha256Hash: hashes.get(name) },
          },
        }),
      });
      assert.equal(response.headers.get("cache-control"), "no-store");
      const body = await response.json();
      assert.equal(body.errors, undefined, JSON.stringify(body));
      return {
        value: Object.values(body.data)[0],
        cookie: response.headers.get("set-cookie")?.split(";")[0],
      };
    }
    // Keep cleanup ahead of server teardown even if a middle assertion fails.
    try {
      for (let index = 0; index < 2; index += 1) {
        const started = await call("StartWorkspace");
        assert.equal(started.value.code, "OK");
        assert.ok(started.cookie);
        cookies.push(started.cookie);
      }
      const original = exampleData.sources.find(
        (source) => source.id === "yaml_context",
      );
      const input = {
        id: original.id,
        expectedRevision: 0,
        idempotencyKey: randomUUID(),
        metadata: {
          title: "<img src=x onerror=alert(1)> — configuration",
          description:
            "SELECT is plain text; pipeline commands remain documentary.",
          tags: ["pipeline"],
        },
      };
      const first = (await call("SaveSource", { input }, cookies[0])).value;
      assert.equal(first.code, "OK", first.message);
      assert.equal(first.source.revision, 1);
      assert.equal(
        (await call("SaveSource", { input }, cookies[0])).value.replayed,
        true,
      );
      const second = (
        await call("WorkspaceSource", { id: original.id }, cookies[1])
      ).value;
      assert.equal(second.source.title, original.title);
      const freshRead = (await call("WorkspaceSnapshot", {}, cookies[0])).value;
      assert.equal(
        freshRead.sources.find((source) => source.id === original.id).title,
        input.metadata.title,
      );
      const history = (
        await call("WorkspaceHistory", { sourceId: original.id }, cookies[0])
      ).value;
      assert.equal(history.events.length, 1);
      assert.equal(history.events[0].resultRevision, 1);
      assert.equal(
        (await call("ResetWorkspace", {}, cookies[0])).value.code,
        "ABSENT",
      );
      assert.equal(
        (await call("WorkspaceSource", { id: original.id }, cookies[0])).value
          .code,
        "EXPIRED",
      );
      assert.equal(
        (await call("WorkspaceStatus", {}, cookies[1])).value.code,
        "OK",
      );
    } finally {
      for (const cookie of cookies) await call("ResetWorkspace", {}, cookie);
    }
  },
);
