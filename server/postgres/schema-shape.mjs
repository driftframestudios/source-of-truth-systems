import { createHash } from "node:crypto";

export async function existingTables(client, tableNames) {
  const { rows } = await client.query(
    `SELECT c.relname AS name, c.relkind AS kind FROM pg_catalog.pg_class c
     JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = ANY($1::text[]) ORDER BY c.relname`,
    [tableNames],
  );
  if (rows.some((row) => row.kind !== "r"))
    throw new Error("Owned PostgreSQL names must refer to ordinary tables.");
  return new Set(rows.map((row) => row.name));
}

/** A source checksum owns the migration; this snapshot detects later physical drift.
 * Created only after our fresh DDL, with no OIDs, data values or role-specific IDs. */
export async function schemaShape(client, tableNames) {
  const { rows } = await client.query(
    `SELECT c.relname, c.relkind, c.relrowsecurity, c.relforcerowsecurity,
      (SELECT jsonb_agg(jsonb_build_array(a.attname, pg_catalog.format_type(a.atttypid,a.atttypmod),
        a.attnotnull, co.collname, pg_catalog.pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attnum)
       FROM pg_catalog.pg_attribute a
       LEFT JOIN pg_catalog.pg_collation co ON co.oid = a.attcollation
       LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
       WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped) AS columns,
      (SELECT jsonb_agg(jsonb_build_array(k.conname, k.contype, k.convalidated,
        pg_catalog.pg_get_constraintdef(k.oid)) ORDER BY k.conname)
       FROM pg_catalog.pg_constraint k WHERE k.conrelid = c.oid) AS constraints,
      (SELECT jsonb_agg(jsonb_build_array((SELECT relname FROM pg_catalog.pg_class WHERE oid = i.indexrelid), i.indisvalid, i.indisready,
        pg_catalog.pg_get_indexdef(i.indexrelid)) ORDER BY (SELECT relname FROM pg_catalog.pg_class WHERE oid = i.indexrelid))
       FROM pg_catalog.pg_index i WHERE i.indrelid = c.oid) AS indexes,
      (SELECT jsonb_agg(jsonb_build_array(t.tgname, t.tgenabled, pg_catalog.pg_get_triggerdef(t.oid)) ORDER BY t.tgname)
       FROM pg_catalog.pg_trigger t WHERE t.tgrelid = c.oid AND NOT t.tgisinternal) AS triggers
     FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = ANY($1::text[]) ORDER BY c.relname`,
    [tableNames],
  );
  return createHash("sha256").update(JSON.stringify(rows)).digest("hex");
}
