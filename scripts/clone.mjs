import { randomBytes, createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  readFile,
  writeFile,
  realpath,
  lstat,
  mkdir,
  open,
  unlink,
} from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseEnv } from "node:util";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG = ".env.clone";
const KEYS = [
  "SOT_CLONE_PROJECT",
  "SOT_CLONE_ROOT",
  "SOT_APP_PORT",
  "SOT_ADMIN_PASSWORD",
  "SOT_OWNER_PASSWORD",
  "SOT_RUNTIME_PASSWORD",
];
const rootId = (root) => createHash("sha256").update(root).digest("hex");
function port(value) {
  if (
    !/^\d+$/.test(String(value)) ||
    Number(value) < 1024 ||
    Number(value) > 65535
  )
    throw new Error("Choose a local app port between 1024 and 65535.");
  return String(Number(value));
}
export async function configure(root = ROOT, appPort = "3000") {
  const canonical = await realpath(root);
  const config = {
    SOT_CLONE_PROJECT: `sot-${randomBytes(8).toString("hex")}`,
    SOT_CLONE_ROOT: rootId(canonical),
    SOT_APP_PORT: port(appPort),
    ...Object.fromEntries(
      KEYS.slice(3).map((key) => [key, randomBytes(32).toString("base64url")]),
    ),
  };
  await writeFile(
    resolve(root, CONFIG),
    Object.entries(config)
      .map(([k, v]) => `${k}=${v}\n`)
      .join(""),
    { flag: "wx", mode: 0o600 },
  );
  return config;
}
export async function readConfig(root = ROOT) {
  const path = resolve(root, CONFIG);
  const stat = await lstat(path);
  if (!stat.isFile() || stat.isSymbolicLink())
    throw new Error("Use this clone’s regular generated .env.clone file.");
  if (process.platform !== "win32" && stat.mode & 0o077)
    throw new Error("Keep .env.clone private: chmod 600 .env.clone.");
  const config = parseEnv(await readFile(path, "utf8"));
  if (
    Object.keys(config).length !== KEYS.length ||
    KEYS.some((key) => !config[key]) ||
    !/^sot-[0-9a-f]{16}$/.test(config.SOT_CLONE_PROJECT) ||
    config.SOT_CLONE_ROOT !== rootId(await realpath(root)) ||
    KEYS.slice(3).some((key) => !/^[-_A-Za-z0-9]{43}$/.test(config[key]))
  )
    throw new Error(
      "This configuration belongs to a different or incomplete clone. Preserve it with its volume and configure this checkout separately.",
    );
  port(config.SOT_APP_PORT);
  return config;
}
export function composeCommand(
  config,
  args,
  { root = ROOT, env = process.env } = {},
) {
  const context = env.SOT_DOCKER_CONTEXT;
  if (context && !/^[A-Za-z0-9_.-]+$/.test(context))
    throw new Error("Choose an existing Docker context name.");
  return {
    command: "docker",
    args: [
      ...(context ? ["--context", context] : []),
      "compose",
      "--project-name",
      config.SOT_CLONE_PROJECT,
      "--env-file",
      resolve(root, CONFIG),
      "-f",
      resolve(root, "compose.yml"),
      ...args,
    ],
    options: {
      cwd: root,
      env: { ...env, ...config },
      timeout: 900_000,
      stdio: "inherit",
    },
  };
}
function compose(config, args, options = {}) {
  const call = composeCommand(config, args);
  const result = spawnSync(call.command, call.args, {
    ...call.options,
    ...options,
  });
  if (result.error || result.status !== 0)
    throw new Error(
      "The selected clone operation did not complete. Its local configuration and volume remain available for inspection.",
    );
  return result;
}
export function confirmProject(config, value) {
  if (value !== config.SOT_CLONE_PROJECT)
    throw new Error(
      `This operation replaces this clone’s data. Repeat with --confirm ${config.SOT_CLONE_PROJECT} after saving a backup.`,
    );
}
async function backup(config) {
  const directory = resolve(ROOT, ".clone", "backups");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  if ((await lstat(directory)).isSymbolicLink())
    throw new Error("Use this clone’s regular backup directory.");
  const path = resolve(
    directory,
    `${new Date().toISOString().replaceAll(":", "-")}.dump`,
  );
  const file = await open(path, "wx", 0o600);
  try {
    compose(
      config,
      [
        "exec",
        "-T",
        "database",
        "pg_dump",
        "--username=sot_owner",
        "--dbname=sot_example",
        "--format=custom",
        "--no-owner",
        "--no-acl",
      ],
      { stdio: ["ignore", file.fd, "inherit"] },
    );
  } catch (error) {
    await file.close();
    await unlink(path);
    throw error;
  }
  await file.close();
  console.log(`Saved private local backup: ${path}`);
}
async function restore(config, path, confirmation) {
  confirmProject(config, confirmation);
  const resolved = resolve(path);
  if (!(await lstat(resolved)).isFile())
    throw new Error("Select a regular local PostgreSQL backup.");
  // Stop new commands before the one-transaction restore. The app stays stopped
  // if validation fails, leaving the operator a useful repair boundary.
  compose(config, ["stop", "app"]);
  const file = await open(resolved, "r");
  try {
    compose(
      config,
      [
        "exec",
        "-T",
        "database",
        "pg_restore",
        "--username=sot_owner",
        "--dbname=sot_example",
        "--clean",
        "--if-exists",
        "--no-owner",
        "--no-acl",
        "--single-transaction",
        "--exit-on-error",
      ],
      { stdio: [file.fd, "inherit", "inherit"] },
    );
  } finally {
    await file.close();
  }
  compose(config, ["run", "--rm", "initialize"]);
  compose(config, ["up", "-d", "--no-deps", "--wait", "app"]);
  console.log(
    `Restored and verified this clone at http://localhost:${config.SOT_APP_PORT}. Original browser/origin/expiry still govern Source access.`,
  );
}
export async function main(args = process.argv.slice(2)) {
  const [command, ...rest] = args;
  if (command === "configure") {
    if (rest.length && !(rest.length === 2 && rest[0] === "--port"))
      throw new Error("Usage: configure [--port 3000]");
    const config = await configure(ROOT, rest[1]);
    console.log(
      `Configured ${config.SOT_CLONE_PROJECT} on loopback port ${config.SOT_APP_PORT}. Keep .env.clone with this checkout.`,
    );
    return;
  }
  if (
    !["up", "stop", "status", "logs", "backup", "restore", "reset"].includes(
      command,
    )
  )
    throw new Error(
      "Usage: node scripts/clone.mjs configure [--port N] | up | stop | status | logs | backup | restore <file> --confirm <project> | reset --confirm <project>",
    );
  const config = await readConfig();
  if (command === "restore") {
    if (rest.length !== 3 || rest[1] !== "--confirm")
      throw new Error("Usage: restore <file> --confirm <project>");
    return restore(config, rest[0], rest[2]);
  }
  if (command === "reset") {
    if (rest.length !== 2 || rest[0] !== "--confirm")
      throw new Error("Usage: reset --confirm <project>");
    confirmProject(config, rest[1]);
    compose(config, ["down", "--volumes"]);
    console.log(
      `Removed only ${config.SOT_CLONE_PROJECT} containers and data volume. Run up to create fresh examples.`,
    );
    return;
  }
  if (rest.length)
    throw new Error("This command accepts no additional arguments.");
  if (command === "backup") return backup(config);
  const commands = {
    up: ["up", "--build", "-d", "--wait", "--wait-timeout", "120"],
    stop: ["stop"],
    status: ["ps"],
    logs: ["logs", "--tail", "80", "app", "initialize"],
  };
  compose(config, commands[command]);
  if (command === "up")
    console.log(
      `Ready: http://localhost:${config.SOT_APP_PORT} · ${config.SOT_CLONE_PROJECT}. C3 should show Stored history.`,
    );
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
