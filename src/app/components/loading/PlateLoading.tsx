import type { CSSProperties } from 'react';

/** The HTML startup carrier uses the same small grid and CSS composition. */
export function PlateLoading({ label, ready = false, onFinished }: {
  label: string;
  ready?: boolean;
  onFinished?: () => void;
}) {
  return (
    <div className="plate-loading" data-phase={ready ? 'ready' : 'waiting'}
      role={ready ? undefined : 'status'} aria-hidden={ready || undefined}
      onAnimationEnd={(event) => { if (event.target === event.currentTarget && ready) onFinished?.(); }}>
      <div className="plate-loading__tiles" aria-hidden="true">
        {Array.from({ length: 12 }, (_, index) => <i key={index} style={{ '--cell': index } as CSSProperties} />)}
      </div>
      <div className="plate-loading__graphic" aria-hidden="true">
        <div className="plate-loading__plate">{Array.from({ length: 12 }, (_, index) => <i key={index} />)}</div>
      </div>
      <p>{label}</p>
    </div>
  );
}
