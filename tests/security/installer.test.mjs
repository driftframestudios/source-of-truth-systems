import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import {
  BETTERLEAKS_RELEASE,
  releaseAsset,
  betterleaksInstallDirectory,
  verifyBetterleaksInstall,
  downloadAsset,
} from "../../scripts/security/install-betterleaks.mjs";

test("installer pins stable 1.10.1 official release assets", () => {
  assert.equal(BETTERLEAKS_RELEASE.version, "1.10.1");
  assert.equal(
    releaseAsset("linux", "x64").sha256,
    "c174b42d7aa60caf58c0c3e555c0e4bed01fe6b0d99a412bce777b5af4ce913e",
  );
  assert.equal(
    releaseAsset("darwin", "arm64").sha256,
    "ca91eb3b006f15478411f235b5e2712fb15cea74f6701ebadc2364efe0af1403",
  );
  assert.throws(() => releaseAsset("linux", "unsupported"));
});

test("installed bytes must match the owned receipt and reported version", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "publication-install-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const options = { repositoryRoot: root, platform: "linux", arch: "x64" },
    asset = releaseAsset("linux", "x64"),
    directory = betterleaksInstallDirectory(options);
  await mkdir(directory, { recursive: true });
  const binary = Buffer.from("synthetic executable");
  await writeFile(join(directory, "betterleaks"), binary);
  await writeFile(
    join(directory, ".install-receipt.json"),
    JSON.stringify({
      format: 1,
      owner: BETTERLEAKS_RELEASE.owner,
      tool: "betterleaks",
      version: "1.10.1",
      platform: "linux",
      arch: "x64",
      asset: asset.name,
      archiveSha256: asset.sha256,
      binarySha256: createHash("sha256").update(binary).digest("hex"),
    }),
  );
  assert.equal(
    (
      await verifyBetterleaksInstall({
        ...options,
        versionRunner: () => "1.10.1",
      })
    ).version,
    "1.10.1",
  );
  await assert.rejects(
    verifyBetterleaksInstall({ ...options, versionRunner: () => "2.0.0" }),
  );
  await writeFile(join(directory, "betterleaks"), "changed");
  await assert.rejects(
    verifyBetterleaksInstall({ ...options, versionRunner: () => "1.10.1" }),
  );
});

test("download preparation bounds bytes and deadline without network access", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "publication-download-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await assert.rejects(
    downloadAsset("https://example.invalid/tool", join(root, "large"), {
      maxBytes: 3,
      fetchImpl: async () => new Response("four"),
    }),
  );
  await assert.rejects(
    downloadAsset("https://example.invalid/tool", join(root, "slow"), {
      timeoutMs: 5,
      fetchImpl: async (_url, { signal }) =>
        new Promise((_resolve, reject) =>
          signal.addEventListener("abort", () => reject(signal.reason)),
        ),
    }),
  );
});
