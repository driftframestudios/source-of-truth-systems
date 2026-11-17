import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, copyFile, chmod, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  configure,
  readConfig,
  composeCommand,
  confirmProject,
} from "../scripts/clone.mjs";

test("same-named checkouts receive separate project, port and credential identities", async (t) => {
  const base = await mkdtemp(join(tmpdir(), "sot-clone-"));
  t.after(() => rm(base, { recursive: true, force: true }));
  const a = join(base, "a", "project"),
    b = join(base, "b", "project");
  await mkdir(a, { recursive: true });
  await mkdir(b, { recursive: true });
  const first = await configure(a, "3100"),
    second = await configure(b, "3101");
  assert.notEqual(first.SOT_CLONE_PROJECT, second.SOT_CLONE_PROJECT);
  assert.notEqual(first.SOT_OWNER_PASSWORD, second.SOT_OWNER_PASSWORD);
  assert.equal((await readConfig(a)).SOT_APP_PORT, "3100");
  await assert.rejects(configure(a), { code: "EEXIST" });
  await copyFile(join(a, ".env.clone"), join(b, ".env.clone"));
  await assert.rejects(readConfig(b), /different or incomplete clone/);
});
test("private configuration and an exact project confirmation protect local ownership", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "sot-clone-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await assert.rejects(configure(root, "0"), /between/);
  const config = await configure(root);
  assert.throws(
    () => confirmProject(config, "other-project"),
    /replaces this clone/,
  );
  confirmProject(config, config.SOT_CLONE_PROJECT);
  if (process.platform !== "win32") {
    await chmod(join(root, ".env.clone"), 0o644);
    await assert.rejects(readConfig(root), /chmod 600/);
  }
});
test("Compose receives explicit clone selection and configuration over ambient interpolation", () => {
  const config = {
    SOT_CLONE_PROJECT: "sot-0123456789abcdef",
    SOT_APP_PORT: "3305",
  };
  const call = composeCommand(config, ["stop"], {
    root: "/tmp/clone",
    env: { SOT_DOCKER_CONTEXT: "owned-proof", SOT_APP_PORT: "9999" },
  });
  assert.deepEqual(call.args, [
    "--context",
    "owned-proof",
    "compose",
    "--project-name",
    config.SOT_CLONE_PROJECT,
    "--env-file",
    "/tmp/clone/.env.clone",
    "-f",
    "/tmp/clone/compose.yml",
    "stop",
  ]);
  assert.equal(call.options.env.SOT_APP_PORT, "3305");
  assert.equal(call.options.stdio, "inherit");
  assert.throws(
    () =>
      composeCommand(config, [], {
        env: { SOT_DOCKER_CONTEXT: "unbounded context" },
      }),
    /context name/,
  );
});

test("runtime role preflight keeps owner and elevated membership outside application grants", async () => {
  const { assertRuntimeRole } =
    await import("../scripts/clone/runtime-role.mjs");
  const ordinary = {
    rolname: "sot_runtime",
    setup_role: "sot_owner",
    rolcanlogin: true,
    owns_setup: false,
    rolsuper: false,
    rolcreatedb: false,
    rolcreaterole: false,
    rolreplication: false,
    rolbypassrls: false,
  };
  const client = (rows) => ({
    query: async (_sql, values) => {
      assert.deepEqual(values, ["sot_runtime"]);
      return { rows };
    },
  });
  assert.equal(
    await assertRuntimeRole(client([ordinary]), "sot_runtime"),
    '\"sot_runtime\"',
  );
  for (const rows of [
    [],
    [{ ...ordinary, rolcanlogin: false }],
    [{ ...ordinary, setup_role: "sot_runtime" }],
    [{ ...ordinary, owns_setup: true }],
    ...[
      "rolsuper",
      "rolcreatedb",
      "rolcreaterole",
      "rolreplication",
      "rolbypassrls",
    ].map((key) => [{ ...ordinary, [key]: true }]),
  ])
    await assert.rejects(assertRuntimeRole(client(rows), "sot_runtime"), {
      code: "RUNTIME_ROLE_AUTHORITY",
    });
});
