import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { ChevronDown, X } from 'lucide-react';

export type PlateRail = 'histories' | 'sample' | null;

/** Compact desktop rails overlay the scene without resizing its camera. */
export function PlateWorkspace({
  children,
  histories,
  sample,
  sampleLabel,
  panel,
  onPanelChange,
}: {
  children: ReactNode;
  histories: ReactNode;
  sample: ReactNode;
  sampleLabel: string | null;
  panel: PlateRail;
  onPanelChange: (panel: PlateRail) => void;
}) {
  const id = useId();
  const triggers = useRef<Partial<Record<Exclude<PlateRail, null>, HTMLButtonElement | null>>>({});
  const closeButtons = useRef<Partial<Record<Exclude<PlateRail, null>, HTMLButtonElement | null>>>(
    {},
  );
  const previous = useRef(panel);
  useEffect(() => {
    if (panel && previous.current !== panel)
      closeButtons.current[panel]?.focus({ preventScroll: true });
    else if (previous.current && !panel)
      triggers.current[previous.current]?.focus({ preventScroll: true });
    previous.current = panel;
  }, [panel]);
  const rails = [
    { key: 'histories' as const, label: 'Sample histories', content: histories },
    {
      key: 'sample' as const,
      label: sampleLabel ? `Sample details · ${sampleLabel}` : 'Sample details',
      content: sample,
    },
  ];

  const railNodes = rails.map(({ key, label, content }) => (
    <aside
      key={key}
      id={`${id}-${key}`}
      className={`plate-workspace__rail plate-workspace__rail--${key}`}
      data-open={panel === key}
      aria-label={label}
      onKeyDown={(event) => {
        if (
          event.key === 'Escape' &&
          panel === key &&
          triggers.current[key]?.getClientRects().length
        ) {
          event.stopPropagation();
          onPanelChange(null);
        }
      }}
    >
      <div className="plate-workspace__rail-head">
        <span>{label}</span>
        <button
          type="button"
          ref={(element) => {
            closeButtons.current[key] = element;
          }}
          onClick={() => onPanelChange(null)}
          aria-label={`Close ${key === 'histories' ? 'sample histories' : 'sample details'}`}
        >
          <X size={14} />
        </button>
      </div>
      <div className="plate-workspace__rail-content">{content}</div>
    </aside>
  ));

  return (
    <div className="plate-workspace">
      <div className="plate-workspace__tools" aria-label="Plate panels">
        {rails.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            ref={(element) => {
              triggers.current[key] = element;
            }}
            aria-controls={`${id}-${key}`}
            aria-expanded={panel === key}
            onClick={() => onPanelChange(panel === key ? null : key)}
          >
            {label}
            <ChevronDown size={12} aria-hidden="true" />
          </button>
        ))}
      </div>
      <div className="plate-workspace__body">
        {railNodes[0]}
        {children}
        {railNodes[1]}
      </div>
    </div>
  );
}
