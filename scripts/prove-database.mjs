import { spawnSync } from "node:child_process";
import { accessSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { readDatabaseConfig } from "../server/data/connection.mjs";

const repository = fileURLToPath(new URL("../", import.meta.url));
const testPhase = (label, ...files) => ({
  label,
  args: ["--test", "--test-concurrency=1", ...files],
});
export const DATABASE_PROOF_PHASES = Object.freeze(
  [
    // This suite clears both table families, including an earlier proof's seed.
    testPhase("workspace storage", "tests/mysql-workspaces.mjs"),
    // Catalog setup deliberately inspects an otherwise empty showcase schema.
    testPhase(
      "catalog storage and HTTP",
      "tests/persistent-data.test.mjs",
      "tests/mysql-http.mjs",
    ),
    { label: "catalog initialization", args: ["scripts/database.mjs", "init"] },
    {
      label: "workspace initialization",
      args: ["scripts/database.mjs", "workspace-init"],
    },
    testPhase(
      "workspace HTTP",
      "tests/mysql-workspace-http.mjs",
    ),
  ].map((phase) =>
    Object.freeze({ ...phase, args: Object.freeze(phase.args) }),
  ),
);

/** The explicit proof command owns its disposable transport and every test opt-in. */
export function databaseProofEnvironment(env) {
  const config = readDatabaseConfig(env);
  if (config.mode !== "mysql")
    throw new Error(
      "Database proof requires DB_HOST, DB_NAME, DB_USER and DB_PASSWORD.",
    );
  if (!["localhost", "127.0.0.1", "::1"].includes(config.options.host))
    throw new Error(
      "Database proof requires a disposable MySQL server on loopback.",
    );
  if (
    config.options.database.length > 64 ||
    !/^sot_[a-z0-9_]+_(?:test|proof)$/.test(config.options.database)
  )
    throw new Error(
      "Database proof requires a disposable sot_*_test or sot_*_proof database.",
    );
  if (!config.options.user.trim())
    throw new Error("Database proof requires a database user.");

  const prepared = {
    ...env,
    // Resolve the familiar local name here so DNS cannot redirect the proof.
    DB_HOST:
      config.options.host === "localhost" ? "127.0.0.1" : config.options.host,
    DB_PORT: String(config.options.port),
    MYSQL_CATALOG_TEST: "1",
    MYSQL_WORKSPACE_TEST: "1",
    MYSQL_WORKSPACE_HTTP: "1",
    // Presence selects the actual SQL-import test; a missing binary fails it.
    MYSQL_CLIENT: env.MYSQL_CLIENT || "mysql",
  };
  delete prepared.MYSQL_WORKSPACE_SOCKET;
  return prepared;
}

export function proveDatabase({
  env = process.env,
  run = spawnSync,
  report = console.log,
} = {}) {
  const childEnv = databaseProofEnvironment(env);
  try {
    accessSync(new URL("../build/server/example-data.mjs", import.meta.url));
    accessSync(new URL("../dist/index.html", import.meta.url));
  } catch {
    throw new Error("Build the application before running the database proof.");
  }
  for (const phase of DATABASE_PROOF_PHASES) {
    report(`Database proof: ${phase.label}.`);
    const result = run(process.execPath, phase.args, {
      cwd: repository,
      env: childEnv,
      stdio: "inherit",
    });
    if (result.error || result.signal || result.status !== 0)
      throw new Error(
        `Database proof stopped during ${phase.label}; inspect that phase before retrying.`,
      );
  }
  report(
    "Database proof passed. The disposable catalog and workspace schema remain initialized.",
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    if (process.argv.length !== 2)
      throw new Error(
        "Usage: node scripts/prove-database.mjs (with disposable DB_* settings).",
      );
    proveDatabase();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
