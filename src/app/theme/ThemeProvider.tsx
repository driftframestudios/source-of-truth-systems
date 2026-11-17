import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { createTheme, readThemeMode, saveThemeMode, themeVariables, type PaletteOverrides, type Theme, type ThemeMode } from './theme';

const ThemeContext = createContext<{ theme: Theme; setMode: (mode: ThemeMode) => void } | null>(null);

export function ThemeProvider({ children, overrides }: { children: ReactNode; overrides?: PaletteOverrides }) {
  const [mode, updateMode] = useState<ThemeMode>(() => {
    try { return readThemeMode(window.localStorage); } catch { return 'dark'; }
  });
  const setMode = useCallback((next: ThemeMode) => {
    updateMode(next);
    try { saveThemeMode(window.localStorage, next); } catch { /* Storage can be unavailable in private embeds. */ }
  }, []);
  const theme = useMemo(() => createTheme(mode, overrides), [mode, overrides]);
  useLayoutEffect(() => {
    const root = document.documentElement;
    for (const [name, value] of Object.entries(themeVariables(theme))) root.style.setProperty(name, value);
    root.dataset.appearance = mode;
    root.style.colorScheme = theme.colorScheme;
  }, [theme, mode]);
  const value = useMemo(() => ({ theme, setMode }), [theme, setMode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('Theme consumers need the root ThemeProvider.');
  return context;
}
