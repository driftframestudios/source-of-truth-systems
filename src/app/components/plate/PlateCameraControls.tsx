export function PlateCameraControls({
  compact,
  bottom,
  onFit,
  onCenter,
  canCenter,
  onZoom,
  onOrbit,
  onTilt,
}: {
  compact: boolean;
  bottom: number;
  onFit: () => void;
  onCenter: () => void;
  canCenter: boolean;
  onZoom: (direction: number) => void;
  onOrbit: (direction: number) => void;
  onTilt: () => void;
}) {
  return (
    <div
      className={`plate-camera-controls${compact ? " plate-camera-controls--compact" : ""}`}
      style={{ bottom }}
      data-no-drag
      role="group"
      aria-label="Plate camera controls"
    >
      <button type="button" onClick={onFit}>
        Fit plate
      </button>
      <button type="button" disabled={!canCenter} onClick={onCenter}>
        Center sample
      </button>
      <button
        type="button"
        aria-label="Zoom plate out"
        onClick={() => onZoom(-1)}
      >
        −
      </button>
      <button
        type="button"
        aria-label="Zoom plate in"
        onClick={() => onZoom(1)}
      >
        +
      </button>
      <details>
        <summary>Angle</summary>
        <div>
          <button
            type="button"
            aria-label="Rotate plate left"
            onClick={() => onOrbit(-1)}
          >
            ↶
          </button>
          <button
            type="button"
            aria-label="Rotate plate right"
            onClick={() => onOrbit(1)}
          >
            ↷
          </button>
          <button type="button" aria-label="Tilt plate" onClick={onTilt}>
            Tilt
          </button>
        </div>
      </details>
    </div>
  );
}
