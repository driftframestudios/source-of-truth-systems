import { defineConfig } from "vite";
import { STORE } from "./src/app/data";
import { PLATE_ID, RESULTS_AS_OF } from "./src/app/data/wellResults";
import { assertFixtureCatalog } from "./scripts/fixtures/catalog-contract";

assertFixtureCatalog(STORE, { plateId: PLATE_ID, asOf: RESULTS_AS_OF });

export default defineConfig({
  build: {
    ssr: "src/server/example-data.ts",
    target: "node22",
    outDir: "build/server",
    emptyOutDir: true,
    rollupOptions: { output: { entryFileNames: "example-data.mjs" } },
  },
});
