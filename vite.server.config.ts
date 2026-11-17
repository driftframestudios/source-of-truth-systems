import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    ssr: 'src/server/example-data.ts',
    target: 'node22',
    outDir: 'build/server',
    emptyOutDir: true,
    rollupOptions: { output: { entryFileNames: 'example-data.mjs' } },
  },
});
