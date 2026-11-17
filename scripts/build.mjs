import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildDocumentationSite } from "./documentation/build.mjs";
import { buildDocumentationBundle } from "./documentation-bundle.mjs";

// Browser, server and isolated documentation are rebuilt from current source.
for (const config of ["vite.figma.config.ts", "vite.server.config.ts"]) {
  const build = spawnSync(
    process.execPath,
    [
      fileURLToPath(
        new URL("../node_modules/vite/bin/vite.js", import.meta.url),
      ),
      "build",
      "--mode",
      "production",
      "--config",
      config,
    ],
    {
      cwd: fileURLToPath(new URL("../", import.meta.url)),
      env: { ...process.env, NODE_ENV: "production" },
      stdio: "inherit",
    },
  );
  if (build.error) throw build.error;
  if (build.status !== 0) process.exit(build.status ?? 1);
}

const documentation = await buildDocumentationSite();
await buildDocumentationBundle({
  additionalDocuments: documentation.generatedDocuments,
});
