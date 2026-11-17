// ============================================================
// Plate-scene controls for the atlas control bar: stack lens,
// disc spacing, and the multi-result filter.
// ============================================================

import { Layers3 } from 'lucide-react';
import type { PlateStackUi } from './plateState';
import { historyLayoutPatch } from './plateState';
import { LENS_OPTIONS } from './stackLens';
import { PlateLensLegend } from './PlateLensLegend';
import { useTheme } from '../../theme/ThemeProvider';

function Segmented<T extends string>({
  value, options, onChange, label,
}: {
  value: T;
  options: ReadonlyArray<{ id: T; label: string; hint?: string }>;
  onChange: (v: T) => void;
  label: string;
}) {
  const { theme } = useTheme();
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] font-mono text-[var(--sot-shell-muted)] uppercase">{label}</span>
      <div className="flex border border-[var(--sot-shell-border)] rounded overflow-hidden" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.id}
            role="radio"
            aria-checked={value === o.id}
            title={o.hint}
            onClick={() => onChange(o.id)}
            className="text-[10px] font-mono px-2 py-0.5 transition-colors"
            style={{ backgroundColor: value === o.id ? theme.mode === 'dark' ? '#2dd4bf' : theme.shell.accent : 'transparent', color: value === o.id ? theme.shell.onAccent : theme.shell.secondary }}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function PlateControls({
  ui, onChange, multiCount,
}: {
  ui: PlateStackUi;
  onChange: (patch: Partial<PlateStackUi>) => void;
  multiCount: number;
}) {
  const { theme } = useTheme();
  return (
    <>
      <span className="flex items-center gap-1 text-[9px] font-mono" style={{ color: ui.upright ? theme.shell.selectedText : theme.shell.muted }}>
        <Layers3 size={10} />
        {ui.upright ? 'Sample history' : 'Plate overview'}
      </span>
      <div className="w-px h-4 bg-white/10" />
      <Segmented label="Lens" value={ui.lens} options={LENS_OPTIONS} onChange={(lens) => onChange({ lens })} />
      <Segmented
        label="History spacing"
        value={ui.spacing}
        options={[
          { id: 'ordinal', label: 'By result', hint: 'Evenly spaced — one disc per result' },
          { id: 'time', label: 'Over time', hint: 'Gap between discs proportional to days between results' },
        ]}
        onChange={(spacing) => onChange(historyLayoutPatch({ spacing }))}
      />
      <Segmented label="Depth" value={ui.spread} options={[{ id: 'compact', label: 'Compact' }, { id: 'spacious', label: 'Spacious' }]} onChange={(spread) => onChange(historyLayoutPatch({ spread }))} />
      <button
        onClick={() => onChange({ onlyMulti: !ui.onlyMulti })}
        aria-pressed={ui.onlyMulti}
        className="text-[10px] font-mono px-2 py-0.5 rounded border"
        style={{
          color: ui.onlyMulti ? theme.shell.onAccent : theme.shell.secondary,
          backgroundColor: ui.onlyMulti ? theme.status.warning : 'transparent',
          borderColor: ui.onlyMulti ? theme.status.warning : theme.shell.border,
        }}
        title="Fade wells with a single result so reruns and series stand out"
      >
        multi-result only · {multiCount}
      </button>
      <PlateLensLegend lens={ui.lens} />
    </>
  );
}
