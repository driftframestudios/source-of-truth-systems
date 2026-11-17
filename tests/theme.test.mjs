import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

async function moduleUrl(name, imports = {}) {
  const source = await readFile(new URL(`../src/app/theme/${name}.ts`, import.meta.url), 'utf8');
  let { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } });
  for (const [path, url] of Object.entries(imports)) outputText = outputText.replace(`'${path}'`, JSON.stringify(url));
  return `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
}
const { createTheme, THEME_MODES, readThemeMode, saveThemeMode, themeVariables, withAlpha } =
  await import(await moduleUrl('theme', { './palettes': await moduleUrl('palettes') }));

function luminance(hex) {
  const channels = hex.slice(1).match(/../g).map((pair) => parseInt(pair, 16) / 255)
    .map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
}
function ratio(a, b) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + .05) / (values[1] + .05);
}

test('each appearance supplies contrast-safe ordinary text and the same geometry and variable roles', () => {
  const baseline = createTheme('dark');
  for (const { value } of THEME_MODES) {
    const theme = createTheme(value);
    assert.equal(theme.geometry, baseline.geometry, 'changing color must retain layout geometry');
    assert.deepEqual(Object.keys(themeVariables(theme)), Object.keys(themeVariables(baseline)));
    const pairs = [
      ...['background', 'inset', 'surface', 'raised'].flatMap((surface) =>
        ['text', 'secondary', 'muted'].map((text) => [theme.shell[text], theme.shell[surface]])),
      [theme.shell.selectedText, theme.shell.selected], [theme.shell.onAccent, theme.shell.accent],
      ...['background', 'header', 'alternate', 'selected'].flatMap((surface) =>
        ['text', 'muted'].map((text) => [theme.table[text], theme.table[surface]])),
      [theme.scene.label, theme.scene.background],
      ...Object.values(theme.status).map((color) => [color, theme.shell.surface]),
    ];
    for (const [foreground, background] of pairs) {
      assert.ok(ratio(foreground, background) >= 4.5, `${value}: ${foreground} on ${background}`);
    }
  }
});

test('a module override changes only that role and concrete colors compose safely with alpha', () => {
  const original = createTheme('light');
  const extended = createTheme('light', { scene: { grid: '#abcdef' } });
  assert.equal(extended.scene.grid, '#abcdef');
  assert.deepEqual(extended.shell, original.shell);
  assert.equal(createTheme('light').scene.grid, original.scene.grid);
  assert.equal(withAlpha('#123456', .5), '#12345680');
});

test('only valid explicit choices persist; blocked or stale storage leaves a working default', () => {
  let stored = 'retired-mode';
  const storage = { getItem: () => stored, setItem: (_key, value) => { stored = value; } };
  assert.equal(readThemeMode(storage), 'dark');
  saveThemeMode(storage, 'contrast');
  assert.equal(readThemeMode(storage), 'contrast');
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.equal(readThemeMode(blocked), 'dark');
  assert.doesNotThrow(() => saveThemeMode(blocked, 'light'));
});
