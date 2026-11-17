import { createHash } from "node:crypto";
import { assertPlateCatalog } from "../../shared/plate-records.mjs";
import {
  CATALOG_TABLES,
  SCHEMA_SIGNATURE,
  SCHEMA_STATEMENTS,
  SCHEMA_VERSION,
  catalogError,
} from "./catalog-schema.mjs";
import { createMySqlRepository } from "./mysql-repository.mjs";

import { prepareCatalogSeed } from "./prepare-catalog-seed.mjs";
export { prepareCatalogSeed } from "./prepare-catalog-seed.mjs";

async function existingTables(connection) {
  const [rows] = await connection.execute(
    `SELECT TABLE_NAME AS name FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${CATALOG_TABLES.map(() => "?").join(",")})`,
    CATALOG_TABLES,
  );
  return new Set(rows.map((row) => row.name));
}

async function verifyCompleteCatalog(connection) {
  const repository = await createMySqlRepository(connection);
  const [plates] = await connection.execute(
    "SELECT id FROM showcase_plates LIMIT 2",
  );
  if (plates.length !== 1)
    throw catalogError("Stored catalog must contain one showcase plate.");
  const plate = await repository.getPlate(plates[0].id);
  const wells = await repository.listWells(plate.id);
  const results = [];
  for (const well of wells)
    results.push(...(await repository.listHistory(plate.id, well.id)));
  const catalog = assertPlateCatalog({
    plateId: plate.id,
    asOf: plate.asOf,
    wells,
    results,
  });
  return {
    initialized: false,
    plateId: plate.id,
    wells: catalog.wells.length,
    results: catalog.results.length,
  };
}

export function catalogSeedStatements(seed) {
  return [
    {
      sql: "INSERT INTO showcase_plates (id, as_of) SELECT ?, ?",
      values: [seed.plateId, seed.asOf],
    },
    ...seed.wells.map((well) => ({
      sql: "INSERT INTO showcase_wells (plate_id, id, row_index, column_index, metadata) SELECT ?, ?, ?, ?, ?",
      values: [
        seed.plateId,
        well.id,
        well.row,
        well.col,
        JSON.stringify(well.metadata),
      ],
    })),
    ...seed.results.map((result) => ({
      sql: `INSERT INTO showcase_results
      (id, anchor_plate_id, well_id, sequence_index, supersedes_id, supersedes_sequence, metadata) SELECT ?, ?, ?, ?, ?, ?, ?`,
      values: [
        result.id,
        seed.plateId,
        result.wellId,
        result.sequence,
        result.supersedes,
        result.supersedesSequence,
        JSON.stringify(result.metadata),
      ],
    })),
    ...seed.files.map((file) => ({
      sql: "INSERT INTO showcase_files (object_key, metadata) SELECT ?, ?",
      values: [file.key, JSON.stringify(file.metadata)],
    })),
    ...seed.artifacts.map((artifact) => ({
      sql: `INSERT INTO showcase_artifacts
      (result_id, ordinal, object_key, anchor_plate_id, well_id, result_sequence, reused_from_id, reused_sequence, metadata)
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?`,
      values: [
        artifact.resultId,
        artifact.ordinal,
        artifact.key,
        seed.plateId,
        artifact.wellId,
        artifact.sequence,
        artifact.reusedFrom,
        artifact.reusedSequence,
        JSON.stringify(artifact.metadata),
      ],
    })),
  ];
}

export function completionStatement(seed) {
  return {
    sql: `UPDATE showcase_catalog SET schema_version = ? WHERE singleton = 1 AND schema_version = 0 AND schema_signature = ?
    AND (SELECT COUNT(*) FROM showcase_plates) = 1 AND (SELECT COUNT(*) FROM showcase_wells) = ?
    AND (SELECT COUNT(*) FROM showcase_results) = ? AND (SELECT COUNT(*) FROM showcase_files) = ?
    AND (SELECT COUNT(*) FROM showcase_artifacts) = ?`,
    values: [
      SCHEMA_VERSION,
      SCHEMA_SIGNATURE,
      seed.wells.length,
      seed.results.length,
      seed.files.length,
      seed.artifacts.length,
    ],
  };
}

/** Explicit administration only. A complete stored catalog is never reseeded. */
export async function initializeCatalog(connection, data) {
  const [[database]] = await connection.execute("SELECT DATABASE() AS name");
  if (!database.name)
    throw catalogError("Select a database before initializing the showcase.");
  const lockName = `sot-catalog:${createHash("sha256").update(database.name).digest("hex").slice(0, 32)}`;
  const [[lock]] = await connection.execute(
    "SELECT GET_LOCK(?, 5) AS acquired",
    [lockName],
  );
  if (lock.acquired !== 1)
    throw catalogError(
      "Another catalog initialization is in progress.",
      "CATALOG_BUSY",
    );
  try {
    const tables = await existingTables(connection);
    if (tables.size && !tables.has("showcase_catalog"))
      throw catalogError(
        "Unmarked showcase tables require explicit schema review.",
      );
    if (tables.has("showcase_catalog")) {
      const [markers] = await connection.execute(
        "SELECT schema_version, schema_signature FROM showcase_catalog WHERE singleton = 1",
      );
      const marker = markers[0];
      if (
        markers.length !== 1 ||
        marker.schema_signature !== SCHEMA_SIGNATURE ||
        ![0, SCHEMA_VERSION].includes(marker.schema_version)
      ) {
        throw catalogError(
          "Stored catalog schema does not match this initializer.",
          "CATALOG_SCHEMA_MISMATCH",
        );
      }
      if (marker.schema_version === SCHEMA_VERSION)
        return await verifyCompleteCatalog(connection);
      // A recognized interrupted migration is resumable only while all its data tables are empty.
      for (const table of CATALOG_TABLES.slice(1).filter((table) =>
        tables.has(table),
      )) {
        const [rows] = await connection.query(`SELECT 1 FROM ${table} LIMIT 1`);
        if (rows.length)
          throw catalogError(
            "Incomplete catalog contains records and requires explicit recovery.",
          );
      }
    }
    // Validate before creating a fresh schema or changing an interrupted one.
    const seed = prepareCatalogSeed(data);
    if (!tables.has("showcase_catalog")) {
      await connection.query(SCHEMA_STATEMENTS[0]);
      await connection.execute(
        "INSERT INTO showcase_catalog (singleton, schema_version, schema_signature) VALUES (1, 0, ?)",
        [SCHEMA_SIGNATURE],
      );
    }
    // MySQL commits DDL separately. The version-zero marker keeps partial setup unreadable.
    for (const statement of SCHEMA_STATEMENTS.slice(1))
      await connection.query(statement);
    await connection.beginTransaction();
    try {
      for (const statement of catalogSeedStatements(seed))
        await connection.execute(statement.sql, statement.values);
      const completion = completionStatement(seed);
      const [updated] = await connection.execute(
        completion.sql,
        completion.values,
      );
      if (updated.affectedRows !== 1)
        throw catalogError(
          "Catalog completion marker changed during initialization.",
        );
      await connection.commit();
    } catch (error) {
      try {
        await connection.rollback();
      } catch {
        /* Disconnect also rolls back the unfinished seed. */
      }
      throw error;
    }
    return {
      initialized: true,
      plateId: seed.plateId,
      wells: seed.wells.length,
      results: seed.results.length,
    };
  } finally {
    try {
      await connection.execute("SELECT RELEASE_LOCK(?)", [lockName]);
    } catch {
      /* Closing the owning connection releases this advisory lock. */
    }
  }
}
