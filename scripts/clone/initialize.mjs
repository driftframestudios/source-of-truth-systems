import { assertRuntimeRole } from "./runtime-role.mjs";
import { connectPostgres } from "../../server/postgres/connection.mjs";
import { readDatabaseConfig } from "../../server/data/connection.mjs";
import { initializePostgresCatalog } from "../../server/data/postgres-initialize.mjs";
import { initializePostgresWorkspaces } from "../../server/workspaces/postgres-initialize.mjs";
import { exampleData } from "../../build/server/example-data.mjs";

const config = readDatabaseConfig();
if (config.mode !== "postgres")
  throw new Error("Local clone setup requires PostgreSQL settings.");
const runtimeRole = process.env.SOT_RUNTIME_ROLE || "sot_runtime";
const client = await connectPostgres(config.options);
try {
  const runtime = await assertRuntimeRole(client, runtimeRole);
  const catalog = await initializePostgresCatalog(client, exampleData);
  const workspace = await initializePostgresWorkspaces(client);
  await client.query("BEGIN");
  try {
    await client.query(`GRANT SELECT ON public.showcase_catalog,public.showcase_plates,public.showcase_wells,
      public.showcase_results,public.showcase_files,public.showcase_artifacts,public.showcase_workspace_schema TO ${runtime}`);
    // Row-level quota admission locks the marker; only its singleton can be updated.
    await client.query(
      `GRANT UPDATE(singleton) ON public.showcase_workspace_schema TO ${runtime}`,
    );
    await client.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON public.showcase_visitor_workspaces,
      public.showcase_workspace_sources,public.showcase_workspace_receipts TO ${runtime}`);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
  console.log(
    `${catalog.initialized ? "Initialized" : "Retained"} catalog and ${workspace.initialized ? "initialized" : "retained"} Source workspaces. Runtime grants are ready.`,
  );
} catch (error) {
  const code = /^[A-Z0-9_]{1,64}$/.test(error.code ?? "")
    ? error.code
    : "SETUP_FAILED";
  console.error(
    `Local database setup needs review (${code}). Existing records remain in this clone’s volume; inspect the schema and rerun setup after repair.`,
  );
  process.exitCode = 1;
} finally {
  await client.end();
}
