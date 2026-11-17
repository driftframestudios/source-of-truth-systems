import { readFileSync } from "node:fs";

const MYSQL_REQUIRED = ["DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD"];
const POSTGRES_REQUIRED = ["PGHOST", "PGDATABASE", "PGUSER", "PGPASSWORD"];
const present = (env, names) =>
  names.some((name) => env[name] != null && env[name] !== "");
function port(value, fallback, label) {
  const text = value || fallback;
  const parsed = Number(text);
  if (
    !/^\d+$/.test(text) ||
    !Number.isInteger(parsed) ||
    parsed < 1 ||
    parsed > 65535
  )
    throw new Error(`${label} must be an integer between 1 and 65535.`);
  return parsed;
}
function required(env, names, message) {
  if (names.some((name) => typeof env[name] !== "string" || !env[name]))
    throw new Error(message);
}

/** Explicit server-only selection preserves the GoDaddy DB_* contract. */
export function readDatabaseConfig(env = process.env) {
  const mysql = present(env, [...MYSQL_REQUIRED, "DB_PORT"]);
  const postgres = present(env, [
    ...POSTGRES_REQUIRED,
    "PGPORT",
    "PGSSLMODE",
    "PGSSLROOTCERT",
  ]);
  const provider = env.DATABASE_PROVIDER || (mysql ? "mysql" : "example");
  if (
    !["example", "mysql", "postgres"].includes(provider) ||
    (mysql && provider !== "mysql") ||
    (postgres && provider !== "postgres")
  )
    throw new Error(
      "Select one database provider and its matching connection settings.",
    );
  if (provider === "example") return { mode: "example" };
  if (provider === "mysql") {
    required(
      env,
      MYSQL_REQUIRED,
      "Hosted Database configuration is incomplete. Check the injected DB_* settings.",
    );
    return {
      mode: "mysql",
      options: {
        host: env.DB_HOST,
        port: port(env.DB_PORT, "3306", "DB_PORT"),
        database: env.DB_NAME,
        user: env.DB_USER,
        password: env.DB_PASSWORD,
        connectTimeout: 2000,
        charset: "utf8mb4",
        multipleStatements: false,
      },
    };
  }
  required(
    env,
    POSTGRES_REQUIRED,
    "PostgreSQL configuration is incomplete. Check the selected PG* settings.",
  );
  const tls = env.PGSSLMODE || "verify-full";
  if (
    !["verify-full", "disable"].includes(tls) ||
    (tls === "disable" && env.PGSSLROOTCERT)
  )
    throw new Error(
      "Choose PGSSLMODE=verify-full for verified TLS or disable for a controlled local network.",
    );
  let ca;
  if (env.PGSSLROOTCERT) {
    try {
      ca = readFileSync(env.PGSSLROOTCERT, "utf8");
    } catch {
      throw new Error("PostgreSQL trusted certificate could not be read.");
    }
  }
  return {
    mode: "postgres",
    options: {
      host: env.PGHOST,
      port: port(env.PGPORT, "5432", "PGPORT"),
      database: env.PGDATABASE,
      user: env.PGUSER,
      password: env.PGPASSWORD,
      connectionTimeoutMillis: 2000,
      ssl:
        tls === "disable"
          ? false
          : { rejectUnauthorized: true, ...(ca ? { ca } : {}) },
      application_name: "source-of-truth",
      client_encoding: "UTF8",
      options: "-c search_path=pg_catalog,public",
    },
  };
}
