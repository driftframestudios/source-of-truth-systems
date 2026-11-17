import { createPalettes, type Color, type PaletteOverrides, type ThemeMode } from './palettes';

export type { Color, PaletteOverrides, ThemeMode } from './palettes';
export const THEME_MODES = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
  { value: 'contrast', label: 'High contrast' },
] as const satisfies readonly { value: ThemeMode; label: string }[];
export const THEME_STORAGE_KEY = 'sot.appearance';

// Mode changes alter color, never scene dimensions, density or motion timing.
const geometry = Object.freeze({ radius: '0.375rem', controlHeight: '32px' });

export function createTheme(mode: ThemeMode, extension?: PaletteOverrides) {
  return { mode, colorScheme: mode === 'light' ? 'light' : 'dark', geometry, ...createPalettes(mode, extension) } as const;
}
export type Theme = ReturnType<typeof createTheme>;

export function parseThemeMode(value: unknown): ThemeMode {
  return value === 'light' || value === 'contrast' ? value : 'dark';
}

export function readThemeMode(storage: Pick<Storage, 'getItem'>): ThemeMode {
  try { return parseThemeMode(storage.getItem(THEME_STORAGE_KEY)); } catch { return 'dark'; }
}

export function saveThemeMode(storage: Pick<Storage, 'setItem'>, mode: ThemeMode): void {
  try { storage.setItem(THEME_STORAGE_KEY, mode); } catch { /* A blocked preference store leaves this session operable. */ }
}

export function withAlpha(color: Color, opacity: number): string {
  const bounded = Math.max(0, Math.min(1, opacity));
  return `${color}${Math.round(bounded * 255).toString(16).padStart(2, '0')}`;
}

export function themeVariables(theme: Theme): Record<string, string> {
  const variables: Record<string, string> = {};
  for (const module of ['shell', 'scene', 'table', 'status'] as const) {
    for (const [role, color] of Object.entries(theme[module])) {
      const name = role.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
      variables[`--sot-${module}-${name}`] = color;
    }
  }
  variables['--radius'] = theme.geometry.radius;
  variables['--sot-control-height'] = theme.geometry.controlHeight;
  return variables;
}
