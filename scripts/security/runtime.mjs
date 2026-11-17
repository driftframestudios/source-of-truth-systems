import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Match this repository's admitted runtime before evaluating scanner work.
const [major, minor] = process.versions.node.split(".").map(Number);
if (major !== 22 || minor < 15) {
  throw new Error(
    "Publication checks require Node 22.15+ within the 22.x line.",
  );
}
export const isDirectExecution = (url) =>
  Boolean(
    process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === url,
  );
