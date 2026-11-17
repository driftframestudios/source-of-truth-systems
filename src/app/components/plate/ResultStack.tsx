// ============================================================
// One well's result stack — coin-like discs extruded along the
// plate normal, seated result first. Rendered inside the plate's
// preserve-3d group: the per-disc wrappers carry preserve-3d and
// therefore never take opacity / filter / overflow; fades and
// glows live on the leaf faces only.
// ============================================================

import { memo } from 'react';
import type { WellResult } from '../../types';
import type { DiscPaint } from './stackLens';
import { STATUS_LABEL, discBackground } from './stackLens';
import { DISC_R, shade, withAlpha } from './plateGeometry';
import { useTheme } from '../../theme/ThemeProvider';

export interface ResultStackProps {
  readonly wellId: string;
  readonly x: number;
  readonly y: number;
  readonly results: ReadonlyArray<WellResult>;
  readonly depths: ReadonlyArray<number>;
  readonly paints: ReadonlyArray<DiscPaint>;
  readonly extruded: boolean;
  readonly focusedId: string | null;
  readonly pinned: boolean;
  readonly dimmed: boolean;
  readonly interactive: boolean;
  readonly stagger: number;
  readonly instant: boolean;
}

const COIN_EDGE = 3;

export const ResultStack = memo(function ResultStack(p: ResultStackProps) {
  const { theme } = useTheme();
  const tip = p.depths[p.depths.length - 1] ?? 0;
  const multi = p.results.length > 1;
  const stackFocused = p.focusedId != null;
  return (
    <>
      {multi && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: p.x,
            top: p.y - 1,
            width: Math.max(1, tip + 6),
            height: 2,
            transformOrigin: '0 50%',
            transform: `rotateY(-90deg) scaleX(${p.extruded ? 1 : 0.001})`,
            transition: p.instant ? 'none' : `transform 520ms cubic-bezier(0.22,1,0.36,1) ${p.extruded ? p.stagger : 0}ms`,
            background: `linear-gradient(90deg, ${withAlpha(theme.scene.label, 0.12)}, ${withAlpha(theme.scene.label, stackFocused ? 0.95 : 0.6)})`,
            opacity: p.dimmed ? 0.1 : 1,
            pointerEvents: 'none',
          }}
        />
      )}
      {p.results.map((r, i) => {
        const paint = p.paints[i];
        const focused = p.focusedId === r.id;
        const z = p.extruded ? p.depths[i] : 0.5;
        const delay = p.stagger + i * 42;
        const faceOpacity = p.dimmed ? 0.14 : paint.faded && !focused ? 0.5 : 1;
        const hollow = paint.pattern === 'hollow';
        return (
          <div
            key={r.id}
            style={{
              position: 'absolute',
              left: p.x - DISC_R,
              top: p.y - DISC_R,
              width: DISC_R * 2,
              height: DISC_R * 2,
              transformStyle: 'preserve-3d',
              transform: `translateZ(${z}px)`,
              transition: p.instant
                ? 'none'
                : p.extruded
                ? `transform 560ms cubic-bezier(0.34,1.56,0.64,1) ${delay}ms`
                : 'transform 220ms cubic-bezier(0.4,0,1,1)',
            }}
          >
            {/* coin edge — a darker twin a few px behind the face reads as thickness */}
            <div
              aria-hidden
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                background: hollow ? 'transparent' : shade(paint.base, -0.58),
                border: hollow ? `1px dashed ${withAlpha(paint.base, 0.5)}` : 'none',
                transform: `translateZ(-${COIN_EDGE}px)`,
                opacity: faceOpacity,
                pointerEvents: 'none',
              }}
            />
            <div
              data-result-id={r.id}
              data-well-id={p.wellId}
              role="button"
              tabIndex={p.interactive && !p.dimmed ? 0 : -1}
              aria-label={`${p.wellId} ${r.label}: ${r.title} — ${STATUS_LABEL[r.status]}`}
              aria-pressed={focused && p.pinned}
              className={paint.pulse && !p.dimmed && !focused ? 'result-disc disc-pulse' : 'result-disc'}
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                background: discBackground(paint),
                border: hollow ? `1.5px dashed ${paint.base}` : `1px solid ${shade(paint.base, -0.45)}`,
                boxShadow: focused
                  ? `0 0 0 2px ${theme.shell.focus}, 0 0 20px ${withAlpha(paint.base, 0.95)}`
                  : paint.ring
                  ? `0 0 0 2px ${paint.ring}, 0 0 10px ${withAlpha(paint.ring, 0.6)}`
                  : paint.sot
                  ? 'inset 0 0 0 1.5px rgba(255,255,255,0.78)'
                  : 'none',
                opacity: faceOpacity,
                cursor: p.interactive ? 'pointer' : 'default',
                outline: 'none',
                pointerEvents: p.interactive && !p.dimmed ? 'auto' : 'none',
              }}
            />
          </div>
        );
      })}
    </>
  );
});
