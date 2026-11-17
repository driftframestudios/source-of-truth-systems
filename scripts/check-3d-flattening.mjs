#!/usr/bin/env node
// Guards the CSS-3D corridor against "grouping" properties that silently
// flatten transform-style: preserve-3d. Any style object that declares
// preserve-3d must not also declare a flattening property — and blend modes
// are banned outright in 3D scene files, because they isolate the parent
// context even when set on a leaf sibling (the cause of the travel-mode
// card collapse). Leaf-only effects (e.g. the blurred provenance marker)
// are fine because they carry no preserve-3d.
//
// Usage: node scripts/check-3d-flattening.mjs   (exit 1 on violation)
import { readFileSync } from 'node:fs';

const FILES = [
  'src/app/components/views/LanesView.tsx',
  'src/app/components/corridor/CorridorScene.tsx',
  'src/app/components/plate/PlateScene3D.tsx',
  'src/app/components/plate/ResultStack.tsx',
  'src/app/components/mobile/MobileCorridor.tsx',
];
const FLATTENING = /\b(opacity\s*:\s*(0?\.\d+|0)\b|filter\s*:|overflow\s*:\s*['"]?(hidden|clip|scroll|auto)|clipPath\s*:|mixBlendMode\s*:|isolation\s*:\s*['"]isolate)/;
const BANNED_ANYWHERE = /\bmixBlendMode\s*:/;

let failures = 0;
for (const file of FILES) {
  const src = readFileSync(file, 'utf8');
  const lines = src.split('\n');
  lines.forEach((line, i) => {
    if (BANNED_ANYWHERE.test(line) && !line.trim().startsWith('//')) {
      console.error(`${file}:${i + 1}  mix-blend-mode in a 3D scene file — flattens preserve-3d`);
      failures++;
    }
  });
  // Inspect each style={{ … }} object that opts into preserve-3d.
  const styleRe = /style=\{\{([\s\S]*?)\}\}/g;
  for (let m; (m = styleRe.exec(src)); ) {
    const body = m[1];
    if (!/preserve-3d/.test(body)) continue;
    const hit = body.split('\n').find((l) => FLATTENING.test(l) && !l.trim().startsWith('//'));
    if (hit) {
      const line = src.slice(0, m.index).split('\n').length;
      console.error(`${file}:${line}  preserve-3d element also sets "${hit.trim()}" — this flattens its 3D children`);
      failures++;
    }
  }
}
if (failures) { console.error(`\n${failures} 3D-flattening violation(s).`); process.exit(1); }
console.log('3D flattening check: OK');
