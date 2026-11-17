import { writeFile } from "node:fs/promises";
import mysql from "mysql2/promise";
import { readDatabaseConfig } from "../server/data/connection.mjs";
import { initializeCatalog } from "../server/data/initialize-catalog.mjs";
import { exportCatalogSql } from "../server/data/export-catalog.mjs";
import { initializeWorkspaces } from "../server/workspaces/initialize.mjs";
import { connectPostgres } from "../server/postgres/connection.mjs";
import { initializePostgresCatalog } from "../server/data/postgres-initialize.mjs";
import { initializePostgresWorkspaces } from "../server/workspaces/postgres-initialize.mjs";

const [command, output, ...extra] = process.argv.slice(2);
if (
  !["init", "workspace-init", "export"].includes(command) ||
  extra.length ||
  (["init", "workspace-init"].includes(command) && output) ||
  (command === "export" && !output)
) {
  console.error(
    "Usage: node --env-file-if-exists=.env scripts/database.mjs init | workspace-init | export <new-file.sql>",
  );
  process.exitCode = 1;
} else {
  let connection;
  try {
    const exampleData =
      command === "workspace-init"
        ? undefined
        : (await import("../build/server/example-data.mjs")).exampleData;
    if (command === "export") {
      await writeFile(output, exportCatalogSql(exampleData), { flag: "wx" });
      console.log("Created first-install SQL import artifact.");
    } else {
      const config = readDatabaseConfig();
      const provider = {
        mysql: {
          connect: mysql.createConnection,
          catalog: initializeCatalog,
          workspaces: initializeWorkspaces,
        },
        postgres: {
          connect: connectPostgres,
          catalog: initializePostgresCatalog,
          workspaces: initializePostgresWorkspaces,
        },
      }[config.mode];
      if (!provider)
        throw new Error(
          "Database initialization requires a configured database provider.",
        );
      connection = await provider.connect(config.options);
      if (command === "workspace-init") {
        const result = await provider.workspaces(connection);
        console.log(
          `${result.initialized ? "Initialized" : "Retained"} isolated visitor workspace schema ${result.version}.`,
        );
      } else {
        const result = await provider.catalog(connection, exampleData);
        console.log(
          `${result.initialized ? "Initialized" : "Retained"} showcase catalog: ${result.wells} wells, ${result.results} results.`,
        );
      }
    }
  } catch (error) {
    console.error(
      error instanceof Error
        ? error.message
        : "Database initialization failed.",
    );
    process.exitCode = 1;
  } finally {
    if (connection) await connection.end();
  }
}
