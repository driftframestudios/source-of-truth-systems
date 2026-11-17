import { createHash } from "node:crypto";
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { crc32, deflateRawSync } from "node:zlib";
import {
  inspectZip,
  materializeZip,
  ZIP_LIMITS,
} from "../../scripts/security/zip-snapshot.mjs";

function zip(entries) {
  const locals = [],
    central = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name),
      content = Buffer.from(entry.text ?? "example"),
      data = entry.deflate ? deflateRawSync(content) : content;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(entry.deflate ? 8 : 0, 8);
    local.writeUInt32LE(crc32(content), 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(name.length, 26);
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50);
    cd.writeUInt16LE(0x0314, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(entry.deflate ? 8 : 0, 10);
    cd.writeUInt32LE(crc32(content), 16);
    cd.writeUInt32LE(data.length, 20);
    cd.writeUInt32LE(content.length, 24);
    cd.writeUInt16LE(name.length, 28);
    cd.writeUInt32LE(((entry.mode ?? 0o100644) << 16) >>> 0, 38);
    cd.writeUInt32LE(offset, 42);
    locals.push(local, name, data);
    central.push(cd, name);
    offset += local.length + name.length + data.length;
  }
  const body = Buffer.concat(locals),
    directory = Buffer.concat(central),
    end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(body.length, 16);
  return Buffer.concat([body, directory, end]);
}

test("ordinary stored and deflated ZIP files preserve exact scan bytes", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "publication-zip-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const archive = join(root, "source.zip");
  await writeFile(
    archive,
    zip([
      { name: "root.txt", text: "plain" },
      { name: "docs/readme.md", text: "compressed", deflate: true },
    ]),
  );
  const snapshot = await materializeZip(archive);
  t.after(() => rm(snapshot.root, { recursive: true, force: true }));
  assert.equal(
    snapshot.archiveSha256,
    createHash("sha256")
      .update(await readFile(archive))
      .digest("hex"),
  );
  assert.equal(snapshot.files, 2);
  assert.equal(
    await readFile(join(snapshot.root, "root.txt"), "utf8"),
    "plain",
  );
  assert.equal(
    await readFile(join(snapshot.root, "docs/readme.md"), "utf8"),
    "compressed",
  );
});

test("ZIP admission rejects escape, symlinks, duplicates and file/parent collisions", () => {
  for (const entries of [
    [{ name: "../outside" }],
    [{ name: "/absolute" }],
    [{ name: "C:\\outside" }],
    [{ name: "link", mode: 0o120777 }],
    [{ name: "same" }, { name: "same" }],
    [{ name: "Same" }, { name: "same" }],
    [{ name: "parent" }, { name: "parent/file" }],
    [{ name: "NUL" }],
  ])
    assert.throws(() => inspectZip(zip(entries)));
});

test("ZIP admission and extraction fail closed on malformed size, encryption and CRC", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "publication-zip-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const valid = zip([{ name: "one" }]);
  const central = valid.readUInt32LE(valid.length - 6);
  const tooLarge = Buffer.from(valid);
  tooLarge.writeUInt32LE(ZIP_LIMITS.expandedBytes + 1, central + 24);
  assert.throws(() => inspectZip(tooLarge));
  const encrypted = Buffer.from(valid);
  encrypted.writeUInt16LE(1, central + 8);
  assert.throws(() => inspectZip(encrypted));
  assert.throws(() => inspectZip(valid.subarray(0, valid.length - 1)));
  const corrupt = Buffer.from(valid);
  corrupt[33] ^= 1;
  const path = join(root, "corrupt.zip");
  await writeFile(path, corrupt);
  await assert.rejects(materializeZip(path));
});

test("ZIP directories cannot discard payload and local headers must agree with the directory", () => {
  const empty = zip([{ name: "docs/", mode: 0o040755, text: "" }]);
  assert.equal(inspectZip(empty)[0].directory, true);
  const payload = zip([
    { name: "docs/", mode: 0o040755, text: "discarded payload" },
  ]);
  const central = payload.readUInt32LE(payload.length - 6);
  payload.writeUInt32LE(0, central + 24);
  assert.throws(() => inspectZip(payload));
  const disagreement = zip([{ name: "one" }]);
  disagreement.writeUInt32LE(0, 14);
  assert.throws(() => inspectZip(disagreement));
});
