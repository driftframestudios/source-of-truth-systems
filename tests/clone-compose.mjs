import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID, createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  mkdtemp,
  mkdir,
  copyFile,
  lstat,
  readFile,
  writeFile,
  appendFile,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { configure, readConfig, composeCommand } from "../scripts/clone.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const enabled = process.env.CLONE_COMPOSE_TEST === "1";
const hash = async (path) =>
  createHash("sha256")
    .update(await readFile(path))
    .digest("hex");

// This manually selected proof owns two random projects and temporary copies.
// It uses a named existing context and never changes the global Docker selection.
test(
  "two independent PostgreSQL clones retain, restore and isolate synthetic work",
  { skip: !enabled, timeout: 900_000 },
  async (t) => {
    assert.match(
      process.env.SOT_DOCKER_CONTEXT ?? "",
      /^[A-Za-z0-9_.-]+$/,
      "Choose an explicitly owned Docker context for this proof.",
    );
    const ports = [
      process.env.CLONE_APP_PORT || "33305",
      process.env.CLONE_PEER_PORT || "33306",
    ];
    assert.notEqual(ports[0], ports[1]);
    const base = await mkdtemp(join(tmpdir(), "sot-clone-proof-"));
    const source = spawnSync(
      "git",
      ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
      { cwd: root, encoding: "utf8" },
    );
    assert.equal(
      source.status,
      0,
      "The proof requires the current clone’s source index.",
    );
    const files = [...new Set(source.stdout.split("\0").filter(Boolean))];
    const clones = [];
    let complete = false;
    async function compose(clone, args, options = {}) {
      const call = composeCommand(clone.config, args, {
        root: clone.directory,
      });
      const result = spawnSync(call.command, call.args, {
        ...call.options,
        encoding: "utf8",
        stdio: "pipe",
        ...options,
      });
      await appendFile(join(base, "proof.log"), result.stdout ?? "");
      await appendFile(
        join(base, "proof.log"),
        typeof result.stderr === "string" ? result.stderr : "",
      );
      assert.equal(
        result.status,
        0,
        `Owned Compose operation ${args[0]} must complete.`,
      );
      return result.stdout;
    }
    async function cli(clone, args, expectedStatus = 0) {
      const result = spawnSync(
        process.execPath,
        ["scripts/clone.mjs", ...args],
        {
          cwd: clone.directory,
          env: process.env,
          encoding: "utf8",
          timeout: 600_000,
        },
      );
      await appendFile(join(base, "proof.log"), result.stdout ?? "");
      await appendFile(join(base, "proof.log"), result.stderr ?? "");
      assert.equal(
        result.status,
        expectedStatus,
        `Clone command ${args[0]} must complete.`,
      );
      return result.stdout;
    }
    t.after(async () => {
      let cleaned = true;
      for (const clone of clones)
        try {
          await compose(clone, ["down", "--volumes"]);
        } catch {
          cleaned = false;
        }
      if (complete && cleaned) await rm(base, { recursive: true, force: true });
      else
        t.diagnostic(
          `Local proof configuration and bounded logs retained for recovery in ${base}; no automatic volume outside its two project identities was selected.`,
        );
    });
    await writeFile(join(base, "proof.log"), "", { mode: 0o600 });
    for (let i = 0; i < 2; i++) {
      const directory = join(base, String(i), "same-checkout");
      await mkdir(directory, { recursive: true });
      for (const name of files) {
        const src = resolve(root, name),
          dest = resolve(directory, name);
        assert.ok(
          src.startsWith(root + "/") && dest.startsWith(directory + "/"),
        );
        assert.equal(
          (await lstat(src)).isFile(),
          true,
          "Source population contains regular files.",
        );
        await mkdir(dirname(dest), { recursive: true });
        await copyFile(src, dest);
      }
      if (i === 1) {
        let overlay;
        try {
          overlay = JSON.parse(
            await readFile(
              join(directory, "publication/receiving-overlay.json"),
              "utf8",
            ),
          );
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
        }
        if (overlay) {
          for (const { from, to } of overlay.copy) {
            const src = resolve(directory, from),
              dest = resolve(directory, to);
            assert.ok(
              src.startsWith(directory + "/") &&
                dest.startsWith(directory + "/"),
            );
            await mkdir(dirname(dest), { recursive: true });
            await copyFile(src, dest);
          }
          for (const name of overlay.omit) {
            const path = resolve(directory, name);
            assert.ok(path.startsWith(directory + "/"));
            await rm(path, { recursive: true, force: true });
          }
        }
      }
      const clone = {
        directory,
        config: await configure(directory, ports[i]),
        origin: `http://localhost:${ports[i]}`,
      };
      clones.push(clone);
      await cli(clone, ["up"]);
    }
    assert.notEqual(
      clones[0].config.SOT_CLONE_PROJECT,
      clones[1].config.SOT_CLONE_PROJECT,
    );
    const historyHash = await hash(
      join(root, "server/graphql/operations/PlateHistory.graphql"),
    );
    const envelope = (sha, variables) => ({
      variables,
      extensions: { persistedQuery: { version: 1, sha256Hash: sha } },
    });
    async function history(clone) {
      const r = await fetch(clone.origin + "/graphql", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          envelope(historyHash, { plateId: "NVSX-2026-118", id: "C3" }),
        ),
      });
      return r.json();
    }
    async function workspace(clone, name, variables = {}, cookie) {
      const sha = await hash(
        join(root, `server/workspaces/operations/${name}.graphql`),
      );
      const r = await fetch(clone.origin + "/workspace/graphql", {
        method: "POST",
        headers: {
          origin: clone.origin,
          "content-type": "application/json",
          "x-sot-workspace": "1",
          ...(cookie ? { cookie } : {}),
        },
        body: JSON.stringify({
          ...envelope(sha, variables),
          operationName: name,
        }),
      });
      const body = await r.json();
      assert.equal(body.errors, undefined);
      return {
        value: Object.values(body.data)[0],
        cookie: r.headers.get("set-cookie")?.split(";")[0],
      };
    }
    const input = {
      id: "yaml_context",
      expectedRevision: 0,
      idempotencyKey: randomUUID(),
      metadata: {
        title: "First clone accepted title",
        description: "Synthetic clone persistence proof.",
        tags: ["pipeline"],
      },
    };
    for (const [i, clone] of clones.entries()) {
      const h = await history(clone);
      assert.equal(h.errors, undefined);
      assert.equal(h.data.dataSource.mode, "STORED");
      assert.equal(h.data.well.history.edges.length, 3);
      const start = await workspace(clone, "StartWorkspace");
      assert.equal(start.value.code, "OK");
      assert.ok(start.cookie);
      clone.cookie = start.cookie;
      clone.title =
        i === 0 ? input.metadata.title : "Second clone accepted title";
      const saved = await workspace(
        clone,
        "SaveSource",
        {
          input: {
            ...input,
            idempotencyKey: randomUUID(),
            metadata: { ...input.metadata, title: clone.title },
          },
        },
        clone.cookie,
      );
      assert.equal(saved.value.code, "OK");
    }
    const [a, b] = clones;
    const backup = (await cli(a, ["backup"]))
      .trim()
      .split("Saved private local backup: ")[1];
    assert.ok(backup);
    await cli(a, ["stop"]);
    await cli(a, ["up"]);
    assert.equal(
      (await workspace(a, "WorkspaceSource", { id: input.id }, a.cookie)).value
        .source.title,
      a.title,
    );
    assert.equal(
      (
        await workspace(
          a,
          "SaveSource",
          {
            input: {
              ...input,
              expectedRevision: 1,
              idempotencyKey: randomUUID(),
              metadata: { ...input.metadata, title: "After backup" },
            },
          },
          a.cookie,
        )
      ).value.code,
      "OK",
    );
    const broken = join(a.directory, ".clone", "broken.dump");
    await writeFile(broken, "A deliberately incomplete synthetic backup.", {
      mode: 0o600,
    });
    await cli(
      a,
      ["restore", broken, "--confirm", a.config.SOT_CLONE_PROJECT],
      1,
    );
    await assert.rejects(
      fetch(a.origin),
      "Failed restore leaves the app stopped.",
    );
    await cli(a, ["up"]);
    assert.equal(
      (await workspace(a, "WorkspaceSource", { id: input.id }, a.cookie)).value
        .source.title,
      "After backup",
    );
    await cli(a, ["restore", backup, "--confirm", a.config.SOT_CLONE_PROJECT]);
    const restored = (
      await workspace(a, "WorkspaceSource", { id: input.id }, a.cookie)
    ).value;
    assert.equal(restored.source.title, a.title);
    assert.equal(restored.source.revision, 1);
    await cli(a, ["reset", "--confirm", a.config.SOT_CLONE_PROJECT]);
    await cli(a, ["up"]);
    assert.equal(
      (await workspace(a, "WorkspaceSource", { id: input.id }, a.cookie)).value
        .code,
      "EXPIRED",
    );
    assert.equal(
      (await workspace(b, "WorkspaceSource", { id: input.id }, b.cookie)).value
        .source.title,
      b.title,
    );
    await compose(a, ["stop", "database"]);
    try {
      const failed = await history(a);
      assert.equal(failed.data.dataSource.mode, "STORED");
      assert.equal(failed.data.well, null);
      assert.equal(failed.errors[0].extensions.code, "INTERNAL_SERVER_ERROR");
    } finally {
      await compose(a, ["start", "database"]);
    }
    for (let i = 0; i < 30; i++) {
      const h = await history(a);
      if (h.data?.well) {
        assert.equal(h.errors, undefined);
        assert.equal(h.data.well.history.edges.length, 3);
        break;
      }
      assert.ok(i < 29, "Stored history recovers after database start.");
      await new Promise((r) => setTimeout(r, 200));
    }
    complete = true;
    t.diagnostic(
      "Two current-source clones (with the receiving overlay applied when present), same-cookie/origin backup recovery, retained container restart, isolated reset and explicit offline/recovery observations passed.",
    );
  },
);
