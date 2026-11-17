import { createHash } from "node:crypto";
import {
  lstat,
  mkdtemp,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { inflateRawSync, crc32 } from "node:zlib";

export const ZIP_LIMITS = Object.freeze({
  compressedBytes: 100_000_000,
  expandedBytes: 256_000_000,
  entries: 10_000,
});
const invalid = () =>
  new Error(
    "Publication ZIP requires bounded, unique regular files with safe relative paths.",
  );
export function safeRelativePath(path) {
  return (
    typeof path === "string" &&
    path.length > 0 &&
    !/[\\:\x00-\x1f\x7f]/.test(path) &&
    !path.startsWith("/") &&
    path
      .split("/")
      .every(
        (part) =>
          part &&
          part !== "." &&
          part !== ".." &&
          !/[. ]$/.test(part) &&
          !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part),
      )
  );
}

/** Read ordinary Git/source ZIPs; reject encrypted, multi-disk and ZIP64 archives. */
export function inspectZip(bytes) {
  if (bytes.length > ZIP_LIMITS.compressedBytes || bytes.length < 22)
    throw invalid();
  let end = -1;
  for (
    let i = bytes.length - 22;
    i >= Math.max(0, bytes.length - 65_557);
    i--
  ) {
    if (
      bytes.readUInt32LE(i) === 0x06054b50 &&
      i + 22 + bytes.readUInt16LE(i + 20) === bytes.length
    ) {
      end = i;
      break;
    }
  }
  if (end < 0 || bytes.readUInt16LE(end + 4) || bytes.readUInt16LE(end + 6))
    throw invalid();
  const count = bytes.readUInt16LE(end + 10);
  const directorySize = bytes.readUInt32LE(end + 12);
  let offset = bytes.readUInt32LE(end + 16);
  if (
    count !== bytes.readUInt16LE(end + 8) ||
    count > ZIP_LIMITS.entries ||
    count === 0xffff ||
    offset + directorySize !== end
  )
    throw invalid();
  const entries = [],
    names = new Set(),
    intervals = [];
  let expanded = 0;
  for (let n = 0; n < count; n++) {
    if (offset + 46 > end || bytes.readUInt32LE(offset) !== 0x02014b50)
      throw invalid();
    const flags = bytes.readUInt16LE(offset + 8),
      method = bytes.readUInt16LE(offset + 10);
    const size = bytes.readUInt32LE(offset + 24),
      compressed = bytes.readUInt32LE(offset + 20);
    const nameLength = bytes.readUInt16LE(offset + 28),
      extraLength = bytes.readUInt16LE(offset + 30),
      commentLength = bytes.readUInt16LE(offset + 32);
    const next = offset + 46 + nameLength + extraLength + commentLength;
    if (
      next > end ||
      flags & ~0x0808 ||
      ![0, 8].includes(method) ||
      bytes.readUInt16LE(offset + 34)
    )
      throw invalid();
    const rawName = bytes.subarray(offset + 46, offset + 46 + nameLength);
    const name = new TextDecoder("utf-8", { fatal: true }).decode(rawName);
    const directory = name.endsWith("/"),
      path = directory ? name.slice(0, -1) : name;
    const mode = bytes.readUInt32LE(offset + 38) >>> 16;
    const kind = mode & 0o170000;
    if (
      !safeRelativePath(path) ||
      names.has(path.toLowerCase()) ||
      (kind && kind !== (directory ? 0o040000 : 0o100000))
    )
      throw invalid();
    names.add(path.toLowerCase());
    expanded += size;
    if (
      expanded > ZIP_LIMITS.expandedBytes ||
      size === 0xffffffff ||
      compressed === 0xffffffff ||
      (directory && (size || compressed || bytes.readUInt32LE(offset + 16)))
    )
      throw invalid();
    const local = bytes.readUInt32LE(offset + 42);
    if (
      local + 30 > bytes.length ||
      bytes.readUInt32LE(local) !== 0x04034b50 ||
      bytes.readUInt16LE(local + 6) !== flags ||
      bytes.readUInt16LE(local + 8) !== method
    )
      throw invalid();
    const localNameLength = bytes.readUInt16LE(local + 26);
    const start = local + 30 + localNameLength + bytes.readUInt16LE(local + 28);
    if (
      !rawName.equals(
        bytes.subarray(local + 30, local + 30 + localNameLength),
      ) ||
      start + compressed > bytes.readUInt32LE(end + 16)
    )
      throw invalid();
    if (
      !(flags & 8) &&
      (bytes.readUInt32LE(local + 14) !== bytes.readUInt32LE(offset + 16) ||
        bytes.readUInt32LE(local + 18) !== compressed ||
        bytes.readUInt32LE(local + 22) !== size)
    )
      throw invalid();
    let localEnd = start + compressed;
    if (flags & 8) {
      const signature = bytes.readUInt32LE(localEnd) === 0x08074b50;
      const descriptor = localEnd + (signature ? 4 : 0);
      if (
        descriptor + 12 > bytes.readUInt32LE(end + 16) ||
        bytes.readUInt32LE(descriptor) !== bytes.readUInt32LE(offset + 16) ||
        bytes.readUInt32LE(descriptor + 4) !== compressed ||
        bytes.readUInt32LE(descriptor + 8) !== size
      )
        throw invalid();
      localEnd = descriptor + 12;
    }
    intervals.push([local, localEnd]);
    entries.push({
      path,
      directory,
      size,
      method,
      crc: bytes.readUInt32LE(offset + 16),
      start,
      compressed,
    });
    offset = next;
  }
  if (offset !== end) throw invalid();
  intervals.sort((a, b) => a[0] - b[0]);
  if (
    intervals.some(
      ([start], i) => start !== (i === 0 ? 0 : intervals[i - 1][1]),
    ) ||
    (intervals.at(-1)?.[1] ?? 0) !== bytes.readUInt32LE(end + 16)
  )
    throw invalid();
  const filePaths = new Set(
    entries
      .filter((entry) => !entry.directory)
      .map((entry) => entry.path.toLowerCase()),
  );
  for (const entry of entries) {
    const segments = entry.path.split("/");
    for (let i = 1; i < segments.length; i++) {
      if (filePaths.has(segments.slice(0, i).join("/").toLowerCase()))
        throw invalid();
    }
  }
  return entries;
}

export async function materializeZip(path) {
  const state = await lstat(path);
  if (
    !state.isFile() ||
    state.isSymbolicLink() ||
    state.size > ZIP_LIMITS.compressedBytes
  )
    throw invalid();
  const bytes = await readFile(path),
    entries = inspectZip(bytes);
  const root = await mkdtemp(join(tmpdir(), "publication-zip-"));
  try {
    for (const entry of entries) {
      const target = join(root, entry.path);
      if (entry.directory) {
        await mkdir(target, { recursive: true });
        continue;
      }
      const compressed = bytes.subarray(
        entry.start,
        entry.start + entry.compressed,
      );
      const content =
        entry.method === 0
          ? compressed
          : inflateRawSync(compressed, {
              maxOutputLength: Math.max(1, entry.size),
            });
      if (content.length !== entry.size || crc32(content) !== entry.crc)
        throw invalid();
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, content, { flag: "wx", mode: 0o600 });
    }
    return {
      root,
      files: entries.filter((entry) => !entry.directory).length,
      archiveSha256: createHash("sha256").update(bytes).digest("hex"),
    };
  } catch (error) {
    await rm(root, { recursive: true, force: true });
    throw error;
  }
}
