import { defineConfig } from '@playwright/test';
import base from './playwright.config.mjs';

// A selected engine receiver reuses the ordinary production server and cleanup.
// The default config keeps its Chromium discovery and cost unchanged.
export default defineConfig({
  ...base,
  outputDir: '.visual-runs/webkit-results',
  use: { ...base.use, browserName: 'webkit', launchOptions: {} },
  testMatch: ['corridor-camera.spec.mjs', 'core.spec.mjs', 'mobile-plate.spec.mjs', 'responsive-exploration.spec.mjs'],
  // These journeys use portable browser controls. Chromium CDP touch injection
  // remains with its existing receiver; this selection observes engine/emulation.
  grep: /corridor camera tracks|desktop Reset springs|mobile presets share|upright plate records|mobile upright history|desktop Plate overview/,
});
