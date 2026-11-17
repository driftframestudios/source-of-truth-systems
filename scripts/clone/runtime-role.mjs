/** Validate the named runtime login before setup or grants change any records.
 * The native operator still owns its other inherited/direct privileges. */
export async function assertRuntimeRole(client, name) {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(name))
    throw new Error("Choose a bounded ordinary PostgreSQL runtime role.");
  const { rows } = await client.query(
    `SELECT rolname, rolcanlogin, rolsuper, rolcreatedb,
    rolcreaterole, rolreplication, rolbypassrls, current_user AS setup_role,
    pg_catalog.pg_has_role(rolname,current_user,'MEMBER') AS owns_setup
    FROM pg_catalog.pg_roles WHERE rolname = $1`,
    [name],
  );
  const role = rows[0];
  if (
    rows.length !== 1 ||
    !role.rolcanlogin ||
    role.rolname === role.setup_role ||
    role.owns_setup ||
    [
      "rolsuper",
      "rolcreatedb",
      "rolcreaterole",
      "rolreplication",
      "rolbypassrls",
    ].some((key) => role[key])
  )
    throw Object.assign(
      new Error(
        "Use a separate ordinary LOGIN role with no membership in the setup owner.",
      ),
      { code: "RUNTIME_ROLE_AUTHORITY" },
    );
  return `"${name}"`;
}
