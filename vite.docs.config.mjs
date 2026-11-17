import { defineConfig } from "vite";
import { createTheme, themeVariables } from "./src/app/theme/theme.ts";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
const root = dirname(fileURLToPath(import.meta.url));
const profile = process.env.DOCS_PROFILE ?? "app";
if (!["app", "foundation"].includes(profile))
  throw new Error("Unknown documentation profile.");
const settings = JSON.parse(
  readFileSync(
    join(root, ".docs-build", profile, "build-settings.json"),
    "utf8",
  ),
);
export default defineConfig({
  root: settings.input,
  base: settings.base,
  publicDir: false,
  appType: "mpa",
  plugins: [
    react(),
    {
      name: "documentation-palette",
      generateBundle(_options, bundle) {
        const modules = new Set();
        for (const chunk of Object.values(bundle)) {
          if (chunk.type !== "chunk") continue;
          for (const id of Object.keys(chunk.modules)) {
            const source = relative(root, id).split("\\").join("/");
            if (!source.startsWith("src/")) continue;
            if (
              !/^src\/(documentation\/|app\/theme\/|styles\/fonts\.css)/.test(
                source,
              )
            )
              throw new Error(
                "Documentation imports an application state or scene owner.",
              );
            modules.add(source);
          }
        }
        this.emitFile({
          type: "asset",
          fileName: "module-graph.json",
          source: JSON.stringify({ sources: [...modules].sort() }, null, 2),
        });
      },

      resolveId(id) {
        if (id === "virtual:documentation-theme.css")
          return "\0documentation-theme.css";
      },
      load(id) {
        if (id === "\0documentation-theme.css") {
          const theme = createTheme("dark");
          return `:root{color-scheme:${theme.colorScheme};${Object.entries(
            themeVariables(theme),
          )
            .map(([name, value]) => `${name}:${value}`)
            .join(";")}}`;
        }
      },
    },
  ],
  build: {
    outDir: settings.output,
    emptyOutDir: true,
    manifest: true,
    rollupOptions: {
      input: settings.routes.map((route) => join(settings.input, route.file)),
    },
  },
});
