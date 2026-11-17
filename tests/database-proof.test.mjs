import assert from "node:assert/strict";
import test from "node:test";
import {
  databaseProofEnvironment,
  proveDatabase,
} from "../scripts/prove-database.mjs";

const local = {
  DB_HOST: "127.0.0.1",
  DB_PORT: "33317",
  DB_NAME: "sot_runner_test",
  DB_USER: "proof_user",
  DB_PASSWORD: "test-only",
};

test("database proof refuses incomplete, hosted and ordinary database targets before starting a child", () => {
  let calls = 0;
  for (const env of [
    {},
    { ...local, DB_PASSWORD: "" },
    { ...local, DB_HOST: "hosted.example.test" },
    { ...local, DB_HOST: "127.0.0.1.example.test" },
    { ...local, DB_HOST: "192.0.2.1" },
    { ...local, DB_NAME: "production" },
    { ...local, DB_NAME: "sot_shared" },
    { ...local, DB_PORT: "3306oops" },
  ]) {
    assert.throws(() =>
      proveDatabase({
        env,
        run: () => {
          calls += 1;
          return { status: 0 };
        },
        report: () => {},
      }),
    );
  }
  assert.equal(calls, 0);
});

test("the proof owns opt-ins and transport while retaining explicit client configuration", () => {
  const env = databaseProofEnvironment({
    ...local,
    DB_HOST: "localhost",
    MYSQL_CATALOG_TEST: "0",
    MYSQL_WORKSPACE_TEST: "0",
    MYSQL_WORKSPACE_HTTP: "0",
    MYSQL_WORKSPACE_SOCKET: "/outside/proof.sock",
  });
  assert.equal(env.DB_HOST, "127.0.0.1");
  assert.equal(env.DB_PORT, "33317");
  assert.equal(env.MYSQL_CATALOG_TEST, "1");
  assert.equal(env.MYSQL_WORKSPACE_TEST, "1");
  assert.equal(env.MYSQL_WORKSPACE_HTTP, "1");
  assert.equal(env.MYSQL_CLIENT, "mysql");
  assert.equal("MYSQL_WORKSPACE_SOCKET" in env, false);
  assert.equal(
    databaseProofEnvironment({
      ...local,
      DB_HOST: "::1",
      MYSQL_CLIENT: "/tools/mysql",
    }).MYSQL_CLIENT,
    "/tools/mysql",
  );
});

test("the runner covers both storage families and restores their seed before workspace HTTP", () => {
  const commands = [];
  proveDatabase({
    env: local,
    report: () => {},
    run: (binary, args, options) => {
      assert.equal(binary, process.execPath);
      assert.equal(options.env.MYSQL_WORKSPACE_HTTP, "1");
      commands.push(args);
      return { status: 0 };
    },
  });
  assert.deepEqual(commands, [
    ["--test", "--test-concurrency=1", "tests/mysql-workspaces.mjs"],
    [
      "--test",
      "--test-concurrency=1",
      "tests/persistent-data.test.mjs",
      "tests/mysql-http.mjs",
    ],
    ["scripts/database.mjs", "init"],
    ["scripts/database.mjs", "workspace-init"],
    [
      "--test",
      "--test-concurrency=1",
      "tests/mysql-workspace-http.mjs",
    ],
  ]);
});

test("a failed phase stops the proof before subsequent destructive or initialization work", () => {
  for (const result of [
    { status: 1 },
    { status: null, signal: "SIGTERM" },
    { error: new Error("start failed") },
  ]) {
    let calls = 0;
    assert.throws(
      () =>
        proveDatabase({
          env: local,
          report: () => {},
          run: () => {
            calls += 1;
            return result;
          },
        }),
      /stopped during workspace storage/,
    );
    assert.equal(calls, 1);
  }
});
