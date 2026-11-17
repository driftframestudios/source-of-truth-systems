/** Concrete colors also serve canvas and alpha-composed drawing consumers. */
export type Color = `#${string}`;
export type ThemeMode = 'dark' | 'light' | 'contrast';

export interface ShellPalette {
  background: Color;
  inset: Color;
  surface: Color;
  raised: Color;
  text: Color;
  secondary: Color;
  muted: Color;
  border: Color;
  strongBorder: Color;
  accent: Color;
  onAccent: Color;
  selected: Color;
  selectedText: Color;
  focus: Color;
}

export interface ScenePalette {
  background: Color;
  grid: Color;
  particle: Color;
  alternateParticle: Color;
  label: Color;
  plate: Color;
  plateEdge: Color;
}

export interface TablePalette {
  background: Color;
  header: Color;
  alternate: Color;
  selected: Color;
  text: Color;
  muted: Color;
  border: Color;
}

export interface StatusPalette {
  success: Color;
  warning: Color;
  danger: Color;
  info: Color;
  violet: Color;
}

export interface ThemePalettes {
  readonly shell: Readonly<ShellPalette>;
  readonly scene: Readonly<ScenePalette>;
  readonly table: Readonly<TablePalette>;
  readonly status: Readonly<StatusPalette>;
}

/** Extend a semantic module here; overrides inherit every unchanged role. */
export type PaletteOverrides = {
  [Module in keyof ThemePalettes]?: Partial<ThemePalettes[Module]>;
};

const dark: ThemePalettes = {
  shell: {
    background: '#0a1120', inset: '#080f1c', surface: '#101927', raised: '#19283c',
    text: '#c8d8ee', secondary: '#9ab5d4', muted: '#91a8c6',
    border: '#2c4058', strongBorder: '#657f9d', accent: '#38bdf8', onAccent: '#040d1a',
    selected: '#183c3b', selectedText: '#8af2dc', focus: '#80f9e4',
  },
  scene: {
    background: '#0a1120', grid: '#203149', particle: '#38bdf8', alternateParticle: '#2dd4bf',
    label: '#c8d8ee', plate: '#0b1728', plateEdge: '#2b4560',
  },
  table: {
    background: '#0c1522', header: '#141e2c', alternate: '#101927', selected: '#183c3b',
    text: '#c8d8ee', muted: '#91a8c6', border: '#344254',
  },
  status: { success: '#34d399', warning: '#fbbf24', danger: '#fb7185', info: '#38bdf8', violet: '#c4b5fd' },
};

const overrides: Record<ThemeMode, PaletteOverrides> = {
  dark: {},
  light: {
    shell: {
      background: '#edf3f8', inset: '#e4edf5', surface: '#ffffff', raised: '#dce8f1',
      text: '#172d45', secondary: '#344f6b', muted: '#49627b',
      border: '#a6b8c8', strongBorder: '#5c7890', accent: '#006a94', onAccent: '#ffffff',
      selected: '#cceae4', selectedText: '#07594d', focus: '#005e80',
    },
    scene: {
      background: '#e4edf3', grid: '#b0c3d2', particle: '#006a94', alternateParticle: '#08745e',
      label: '#172d45', plate: '#cbdbe8', plateEdge: '#63839b',
    },
    table: {
      background: '#ffffff', header: '#dce8f1', alternate: '#f1f6fa', selected: '#cceae4',
      text: '#172d45', muted: '#49627b', border: '#a6b8c8',
    },
    status: { success: '#08734f', warning: '#875700', danger: '#b42342', info: '#006a94', violet: '#6741a5' },
  },
  contrast: {
    shell: {
      background: '#05090f', inset: '#000000', surface: '#0b1420', raised: '#172536',
      text: '#ffffff', secondary: '#e2edfa', muted: '#c6d7ec',
      border: '#819ab7', strongBorder: '#c6d7ec', accent: '#72dcff', onAccent: '#000000',
      selected: '#123f39', selectedText: '#afffe8', focus: '#ffe887',
    },
    scene: {
      background: '#000000', grid: '#334b66', particle: '#72dcff', alternateParticle: '#afffe8',
      label: '#ffffff', plate: '#0b1728', plateEdge: '#819ab7',
    },
    table: {
      background: '#05090f', header: '#172536', alternate: '#0b1420', selected: '#123f39',
      text: '#ffffff', muted: '#c6d7ec', border: '#819ab7',
    },
    status: { success: '#8fffc4', warning: '#ffe887', danger: '#ffabb6', info: '#72dcff', violet: '#deceff' },
  },
};

export function createPalettes(mode: ThemeMode, extension: PaletteOverrides = {}): ThemePalettes {
  const selected = overrides[mode];
  return {
    shell: { ...dark.shell, ...selected.shell, ...extension.shell },
    scene: { ...dark.scene, ...selected.scene, ...extension.scene },
    table: { ...dark.table, ...selected.table, ...extension.table },
    status: { ...dark.status, ...selected.status, ...extension.status },
  };
}
