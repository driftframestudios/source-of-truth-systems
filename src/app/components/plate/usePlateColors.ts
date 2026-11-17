import { useMemo } from 'react';
import { useTheme } from '../../theme/ThemeProvider';
import { ATHENA_COLOR } from '../../services/dataAvailability';
import { KIND_COLOR, STATUS_COLOR, plateColor } from './stackLens';
import type { ThemeMode } from '../../theme/theme';

function palette<Key extends string>(source: Record<Key, string>, mode: ThemeMode): Record<Key, string> {
  const colors = { ...source };
  for (const key in colors) colors[key] = plateColor(colors[key], mode);
  return colors;
}

/** Record ink and disc labels use the same mode-aware hues as the plate legend. */
export function usePlateColors() {
  const { theme } = useTheme();
  return useMemo(() => ({
    theme,
    status: palette(STATUS_COLOR, theme.mode),
    statusInk: { ...palette(STATUS_COLOR, theme.mode), cancelled: theme.shell.muted, superseded: theme.shell.muted },
    kind: palette(KIND_COLOR, theme.mode),
    athena: palette(ATHENA_COLOR, theme.mode),
    athenaInk: { ...palette(ATHENA_COLOR, theme.mode), pending: theme.shell.muted },
    color: (value: string) => plateColor(value, theme.mode),
  }), [theme]);
}
