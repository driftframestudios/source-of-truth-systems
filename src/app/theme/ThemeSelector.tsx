import { useId } from 'react';
import { THEME_MODES, parseThemeMode } from './theme';
import { useTheme } from './ThemeProvider';
import './theme-selector.css';

export function ThemeSelector({ presentation = 'segmented' }: { presentation?: 'segmented' | 'compact' }) {
  const { theme, setMode } = useTheme();
  const name = useId();
  if (presentation === 'segmented') {
    return (
      <fieldset className="theme-switch">
        <legend>Appearance</legend>
        {THEME_MODES.map(({ value, label }) => (
          <label key={value} className="theme-switch__option">
            <input type="radio" name={name} value={value} checked={theme.mode === value} onChange={() => setMode(value)} />
            <span>{label}</span>
          </label>
        ))}
      </fieldset>
    );
  }
  return (
    <label className="theme-selector">
      <span>Appearance</span>
      <select aria-label="Appearance" value={theme.mode} onChange={(event) => setMode(parseThemeMode(event.target.value))}>
        {THEME_MODES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
      </select>
    </label>
  );
}
