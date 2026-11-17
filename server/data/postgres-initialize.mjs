import { createHash } from "node:crypto";
import { assertPlateCatalog } from "../../shared/plate-records.mjs";
import { existingTables, schemaShape } from "../postgres/schema-shape.mjs";
import { CATALOG_TABLES, catalogError } from "./catalog-schema.mjs";
import { prepareCatalogSeed } from "./prepare-catalog-seed.mjs";
import { createPostgresRepository } from "./postgres-repository.mjs";
import {
  POSTGRES_CATALOG_VERSION,
  POSTGRES_CATALOG_SEED_VERSION,
  POSTGRES_CATALOG_SIGNATURE,
  POSTGRES_CATALOG_STATEMENTS,
  requirePostgresCatalog,
} from "./postgres-catalog-schema.mjs";

async function verifyCompleteCatalog(client) {
  const repository = await createPostgresRepository(client);
  const { rows: plates } = await client.query(
    "SELECT id FROM public.showcase_plates LIMIT 2",
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

export function postgresCatalogSeedStatements(seed) {
  return [
    {
      sql: "INSERT INTO public.showcase_plates (id, as_of) VALUES ($1, $2)",
      values: [seed.plateId, seed.asOf],
    },
    ...seed.wells.map((well) => ({
      sql: "INSERT INTO public.showcase_wells (plate_id,id,row_index,column_index,metadata) VALUES ($1,$2,$3,$4,$5)",
      values: [
        seed.plateId,
        well.id,
        well.row,
        well.col,
        JSON.stringify(well.metadata),
      ],
    })),
    ...seed.results.map((result) => ({
      sql: `INSERT INTO public.showcase_results (id,anchor_plate_id,well_id,sequence_index,supersedes_id,supersedes_sequence,metadata)
        VALUES ($1,$2,$3,$4,$5,$6,$7)`,
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
      sql: "INSERT INTO public.showcase_files (object_key,metadata) VALUES ($1,$2)",
      values: [file.key, JSON.stringify(file.metadata)],
    })),
    ...seed.artifacts.map((artifact) => ({
      sql: `INSERT INTO public.showcase_artifacts (result_id,ordinal,object_key,anchor_plate_id,well_id,result_sequence,reused_from_id,reused_sequence,metadata)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
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

/** Explicit setup borrows a fresh connected client. DDL, seed and acceptance
 * share one transaction; a failed first setup leaves no partially owned schema. */
export async function initializePostgresCatalog(client, data) {
  await client.query("BEGIN ISOLATION LEVEL READ COMMITTED");
  try {
    await client.query("SET LOCAL search_path = pg_catalog, public");
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '15s'");
    // Fixed application namespace + catalog ID. Transaction ownership releases it
    // on commit, rollback or disconnect; READ COMMITTED sees a preceding setup.
    await client.query(
      "SELECT pg_catalog.pg_advisory_xact_lock(1936684131, 1)",
    );
    const tables = await existingTables(client, CATALOG_TABLES);
    if (tables.size) {
      if (
        tables.size !== CATALOG_TABLES.length ||
        !tables.has("showcase_catalog")
      )
        throw catalogError(
          "Partial or unmarked catalog tables require explicit schema review.",
          "CATALOG_SCHEMA_MISMATCH",
        );
      const marker = await requirePostgresCatalog(client);
      if (
        marker.shape_signature !== (await schemaShape(client, CATALOG_TABLES))
      )
        throw catalogError(
          "Stored catalog structure has changed. Review its migration before setup.",
          "CATALOG_SCHEMA_MISMATCH",
        );
      const result = await verifyCompleteCatalog(client);
      await client.query("COMMIT");
      return result;
    }
    const seed = prepareCatalogSeed(data);
    for (const statement of POSTGRES_CATALOG_STATEMENTS)
      await client.query(statement);
    for (const { sql, values } of postgresCatalogSeedStatements(seed))
      await client.query(sql, values);
    const shape = await schemaShape(client, CATALOG_TABLES);
    await client.query(
      `INSERT INTO public.showcase_catalog (singleton,schema_version,schema_signature,shape_signature,seed_version,seed_signature)
       VALUES (1,$1,$2,$3,$4,$5)`,
      [
        POSTGRES_CATALOG_VERSION,
        POSTGRES_CATALOG_SIGNATURE,
        shape,
        POSTGRES_CATALOG_SEED_VERSION,
        createHash("sha256").update(JSON.stringify(seed)).digest("hex"),
      ],
    );
    const verified = await verifyCompleteCatalog(client);
    if (
      verified.wells !== seed.wells.length ||
      verified.results !== seed.results.length
    )
      throw catalogError("Stored catalog did not retain the complete seed.");
    await client.query("COMMIT");
    return { ...verified, initialized: true };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* Client owner still closes a failed transport. */
    }
    if (error.code === "55P03")
      throw catalogError(
        "Another catalog setup is in progress. Retry after it completes.",
        "CATALOG_BUSY",
      );
    throw error;
  }
}
