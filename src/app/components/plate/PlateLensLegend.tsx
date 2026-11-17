import { discBackground, legendFor, LENS_OPTIONS } from "./stackLens";
import type { StackLens } from "./stackLens";
import { useTheme } from '../../theme/ThemeProvider';

/** One color vocabulary follows the active lens in both plate presentations. */
export function PlateLensLegend({ lens }: { lens: StackLens }) {
  const { theme } = useTheme();
  const option = LENS_OPTIONS.find((item) => item.id === lens)!;
  return (
    <div className="plate-lens-legend" aria-label={`${option.label} color key`}>
      <span className="plate-lens-legend__title">{option.label} key</span>
      {legendFor(lens, theme.mode).map((item) => (
        <span key={item.label}>
          <i
            aria-hidden="true"
            style={{
              background: discBackground({
                base: item.color,
                pattern: item.pattern,
                mark: item.mark,
              }),
              borderColor: item.ring ?? item.color,
            }}
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}
