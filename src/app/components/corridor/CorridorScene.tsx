import { projectCorridor } from './corridorProjection';
import type {
  Lane, LaneCard, LaneCardKind, LaneId, LaneArrow, Pennant,
  LaneFlag, LaneFlagKind, LaneSurfaceLabel,
} from '../../types';

// ===== Shared corridor card palette ============================

interface CardStyle {
  bg: string;
  fg: string;
  border: string;
  topStripe: string;
  faceWidth: number;   // across the lane (V dimension)
  faceHeight: number;  // upright height (Z dimension)
  label: string;
}

export function cardStyle(kind: LaneCardKind): CardStyle {
  switch (kind) {
    case 'process':     return { bg: '#f5f1e6', fg: '#1a1a1a', border: '#8a7a4a', topStripe: '#1a1a1a', faceWidth: 86,  faceHeight: 52, label: 'Process' };
    case 'state_major': return { bg: '#e8d36a', fg: '#1a1100', border: '#8a7a2a', topStripe: '#1a1100', faceWidth: 118, faceHeight: 60, label: 'Major' };
    case 'state_minor': return { bg: '#d8854a', fg: '#2a1100', border: '#8a4a1a', topStripe: '#2a1100', faceWidth: 96,  faceHeight: 54, label: 'Minor' };
    case 'control':     return { bg: '#cfd1cc', fg: '#1a1a1a', border: '#6a6a66', topStripe: '#1a1a1a', faceWidth: 78,  faceHeight: 48, label: 'Control' };
    case 'nested':      return { bg: '#ffffff', fg: '#1a1a1a', border: '#4a4a4a', topStripe: '#000000', faceWidth: 40,  faceHeight: 28, label: 'Nested' };
  }
}

export const PENNANT_COLOR: Record<Pennant['kind'], { bg: string; fg: string }> = {
  spe:    { bg: '#d63838', fg: '#ffffff' },
  per:    { bg: '#000000', fg: '#ffffff' },
  drean:  { bg: '#d63838', fg: '#ffffff' },
  review: { bg: '#1f2a5a', fg: '#ffffff' },
  qc:     { bg: '#2a7a5a', fg: '#ffffff' },
};

export const FLAG_STYLE: Record<LaneFlagKind, { bg: string; fg: string }> = {
  milestone: { bg: '#38bdf8', fg: '#062b27' },
  gate:      { bg: '#2a7a5a', fg: '#ffffff' },
  handoff:   { bg: '#f59e0b', fg: '#1a1100' },
  checkered: { bg: '#1a1a1a', fg: '#ffffff' },
  caution:   { bg: '#d63838', fg: '#ffffff' },
};

// ===== Control state =========================================================

type ViewMode = 'all' | 'wet_lab' | 'dry_lab' | 'interpretation';
export type SceneMode = 'corridor' | 'plate';

export interface ControlState {
  hidden: ReadonlySet<LaneId>;
  focused: LaneId | null;
  viewMode: ViewMode;
  hideKinds: ReadonlySet<LaneCardKind>;
  tiltX: number;
  tiltZ: number;
  zoom: number;
  panX: number;
  panY: number;
  travel: boolean;
  showArrows: boolean;
  scene: SceneMode;
}

export const DEFAULT_CONTROL: ControlState = {
  hidden: new Set(),
  focused: null,
  viewMode: 'all',
  hideKinds: new Set(),
  tiltX: 56,
  tiltZ: -32,
  zoom: 0.62,
  panX: 0,
  panY: 0,
  travel: false,
  showArrows: true,
  scene: 'corridor',
};

// ===== Geometry ==============================================================

export const LANE_LENGTH_PX = 2640;   // doubled
const LANE_WIDTH_PX = 140;
const LANE_GAP_PX = 16;

// =============================================================================
// Corridor scene
// =============================================================================

export function CorridorScene({
  ctrl, sceneTransform, visibleLanes, visibleCards, arrows, flags, surfaceLabels,
  travelX, selectedCardId, onCardClick, onLaneClick,
}: {
  ctrl: ControlState;
  sceneTransform: string;
  visibleLanes: ReadonlyArray<Lane>;
  visibleCards: ReadonlyArray<LaneCard>;
  arrows: ReadonlyArray<LaneArrow>;
  flags: ReadonlyArray<LaneFlag>;
  surfaceLabels: ReadonlyArray<LaneSurfaceLabel>;
  travelX: number | null;
  selectedCardId: string | null;
  onCardClick: (id: string) => void;
  onLaneClick: (id: LaneId) => void;
}) {
  const projection = projectCorridor(visibleLanes, visibleCards, arrows);
  function laneYOffset(lane: Lane): number | null {
    const idx = visibleLanes.findIndex((l) => l.id === lane.id);
    if (idx < 0) return null;
    return (idx - (visibleLanes.length - 1) / 2) * (LANE_WIDTH_PX + LANE_GAP_PX);
  }

  function cardCenter(card: LaneCard): { x: number; y: number } | null {
    const lane = visibleLanes.find((l) => l.id === card.laneId);
    if (!lane) return null;
    const yOff = laneYOffset(lane);
    if (yOff == null) return null;
    return { x: card.position * LANE_LENGTH_PX - LANE_LENGTH_PX / 2, y: yOff };
  }

  return (
    <div
      className="absolute left-1/2 top-1/2"
      style={{ perspective: '2200px', perspectiveOrigin: '50% 40%', transformStyle: 'preserve-3d' }}
    >
      <div
        data-corridor-camera
        style={{
          transform: sceneTransform,
          transformStyle: 'preserve-3d',
          // Direct manipulation follows the pointer. Retargeting a long CSS
          // transition on every input event made orbit lag and jump at seams.
          transition: 'none',
        }}
      >
        {visibleLanes.map((lane) => {
          const yOff = laneYOffset(lane);
          if (yOff == null) return null;
          return (
            <LaneSurface
              key={lane.id}
              lane={lane}
              yOff={yOff}
              cards={projection.cards.filter((c) => c.laneId === lane.id)}
              flags={flags.filter((f) => f.laneId === lane.id)}
              surfaceLabels={surfaceLabels.filter((s) => s.laneId === lane.id)}
              travelX={travelX}
              selectedCardId={selectedCardId}
              onCardClick={onCardClick}
              onClick={() => onLaneClick(lane.id)}
            />
          );
        })}

        {ctrl.showArrows && (
          <svg
            width={LANE_LENGTH_PX + 200}
            height={(visibleLanes.length + 1) * (LANE_WIDTH_PX + LANE_GAP_PX) + 80}
            style={{
              position: 'absolute',
              left: -(LANE_LENGTH_PX + 200) / 2,
              top: -((visibleLanes.length + 1) * (LANE_WIDTH_PX + LANE_GAP_PX) + 80) / 2,
              transform: 'translateZ(4px)',
              overflow: 'visible',
              pointerEvents: 'none',
            }}
          >
            <defs>
              <marker id="arrowhead-flow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill="#0a0a0a" />
              </marker>
              <marker id="arrowhead-recip" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill="#d63838" />
              </marker>
              <marker id="arrowhead-review" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill="#1f2a5a" />
              </marker>
            </defs>
            <g transform={`translate(${(LANE_LENGTH_PX + 200) / 2}, ${((visibleLanes.length + 1) * (LANE_WIDTH_PX + LANE_GAP_PX) + 80) / 2})`}>
              {projection.connections.map(({ arrow: a, from: f, to: t }) => {
                const fc = cardCenter(f);
                const tc = cardCenter(t);
                if (!fc || !tc) return null;
                const dy = tc.y - fc.y;
                const cy = Math.min(fc.y, tc.y) - Math.abs(dy) * 0.4 - 30;
                const stroke = a.kind === 'reciprocal' ? '#d63838'
                  : a.kind === 'review' ? '#1f2a5a'
                  : a.kind === 'deferred' ? '#8a8a8a'
                  : '#0a0a0a';
                const head = a.kind === 'reciprocal' ? 'arrowhead-recip'
                  : a.kind === 'review' ? 'arrowhead-review'
                  : 'arrowhead-flow';
                const dx = tc.x - fc.x;
                return (
                  <path
                    key={a.id}
                    d={`M ${fc.x} ${fc.y - 20} Q ${(fc.x + tc.x) / 2 + dx * 0.1} ${cy} ${tc.x} ${tc.y - 20}`}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={a.kind === 'reciprocal' ? 1.8 : 1.4}
                    strokeDasharray={a.kind === 'deferred' ? '4 3' : undefined}
                    opacity={0.85}
                    markerEnd={`url(#${head})`}
                  />
                );
              })}
            </g>
          </svg>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Lane surface — flat plank with striped header, picket comb, label, flags
// =============================================================================

function LaneSurface({
  lane, yOff, cards, flags, surfaceLabels, travelX, selectedCardId, onCardClick, onClick,
}: {
  lane: Lane;
  yOff: number;
  cards: ReadonlyArray<LaneCard>;
  flags: ReadonlyArray<LaneFlag>;
  surfaceLabels: ReadonlyArray<LaneSurfaceLabel>;
  travelX: number | null;
  selectedCardId: string | null;
  onCardClick: (id: string) => void;
  onClick: () => void;
}) {
  const isSequencer = lane.id === 'lane_sequencer';
  return (
    <div
      onClick={onClick}
      style={{
        position: 'absolute',
        left: -LANE_LENGTH_PX / 2,
        top: yOff - LANE_WIDTH_PX / 2,
        width: LANE_LENGTH_PX,
        height: LANE_WIDTH_PX,
        transformStyle: 'preserve-3d',
      }}
    >
      {/* Lane plank — pure flat color */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: lane.color,
          borderTop: `2px solid ${lane.accentColor}`,
          borderBottom: `1px solid ${lane.accentColor}`,
        }}
      />
      {/* 3D thickness side face */}
      <div
        aria-hidden
        style={{
          position: 'absolute', left: 0, right: 0, top: '100%', height: 12,
          backgroundColor: lane.accentColor,
          transform: 'rotateX(-90deg)',
          transformOrigin: 'top',
          opacity: 0.85,
        }}
      />

      {/* Striped header at lane head */}
      <div
        aria-hidden
        style={{
          position: 'absolute', left: 0, top: 0, height: '100%', width: 90,
          background: 'repeating-linear-gradient(90deg, #1a1a1a 0 6px, #f4f1e6 6px 12px)',
          opacity: 0.85,
          borderRight: `1px solid ${lane.accentColor}`,
        }}
      />
      {/* Striped tail (finish) */}
      <div
        aria-hidden
        style={{
          position: 'absolute', right: 0, top: 0, height: '100%', width: 26,
          background: 'repeating-linear-gradient(90deg, #1a1a1a 0 6px, #f4f1e6 6px 12px)',
          opacity: 0.7,
          borderLeft: `1px solid ${lane.accentColor}`,
        }}
      />

      {/* Lane label printed on the lane surface near head — large, light,
          widely tracked so it reads as floor wayfinding rather than UI. */}
      <div
        style={{
          position: 'absolute',
          left: 112,
          bottom: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 28, height: 1, backgroundColor: lane.accentColor, opacity: 0.55 }} />
          <span
            style={{
              color: lane.accentColor,
              fontSize: 9,
              fontFamily: 'JetBrains Mono, monospace',
              letterSpacing: '0.32em',
              textTransform: 'uppercase',
              opacity: 0.6,
            }}
          >
            {String(lane.stage).replace(/_/g, ' ')}
          </span>
        </div>
        <span
          style={{
            color: lane.accentColor,
            fontSize: 32,
            lineHeight: 1,
            fontFamily: 'DM Sans, sans-serif',
            fontWeight: 300,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            opacity: 0.88,
          }}
        >
          {lane.label}
        </span>
      </div>

      {/* Additional surface labels mid-lane */}
      {surfaceLabels.map((s) => {
        const tint = s.tone === 'warn' ? '#a02828' : s.tone === 'muted' ? `${lane.accentColor}80` : lane.accentColor;
        return (
          <div
            key={s.id}
            style={{
              position: 'absolute',
              left: s.position * LANE_LENGTH_PX,
              top: 4,
              transform: 'translateX(-50%)',
              color: tint,
              fontSize: 10,
              fontFamily: 'JetBrains Mono, monospace',
              letterSpacing: '0.08em',
              textTransform: 'lowercase',
              opacity: 0.85,
              fontStyle: 'italic',
            }}
          >
            {s.text}
          </div>
        );
      })}

      {/* Sequencer picket comb */}
      {isSequencer && (
        <div aria-hidden style={{ position: 'absolute', left: 96, right: 30, top: 6, bottom: 24, pointerEvents: 'none' }}>
          {Array.from({ length: 160 }).map((_, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: `${(i / 160) * 100}%`,
                top: 0, bottom: 0,
                width: 2,
                backgroundColor: '#f4f1e6',
                opacity: 0.55,
              }}
            />
          ))}
        </div>
      )}

      {/* Flags planted in the lane */}
      {flags.map((flag) => (
        <LaneFlagEl key={flag.id} flag={flag} laneAccent={lane.accentColor} />
      ))}

      {/* Cards (face-on, perpendicular to lane direction) */}
      {cards.map((card) => (
        <LaneCardEl
          key={card.id}
          card={card}
          laneAccent={lane.accentColor}
          isSelected={selectedCardId === card.id}
          onClick={(e) => { e.stopPropagation(); onCardClick(card.id); }}
        />
      ))}

      {/* Travel light pulse */}
      {travelX != null && (
        <div
          style={{
            position: 'absolute',
            top: 0, bottom: 0,
            left: travelX,
            width: 90,
            background: 'linear-gradient(90deg, transparent, rgba(56,189,248,0.45), transparent)',
            // No mix-blend-mode here: blending is a grouping property and forces
            // the lane's preserve-3d context to flatten, collapsing every upright
            // card into the plank while the camera rails.
            transform: 'translateZ(1px)',
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  );
}

// =============================================================================
// Flag planted in the lane (vertical pole + waving banner)
// =============================================================================

function LaneFlagEl({ flag, laneAccent }: { flag: LaneFlag; laneAccent: string }) {
  const fs = FLAG_STYLE[flag.kind];
  const poleHeight = 56;
  const bannerW = 46;
  const bannerH = 18;
  const leftU = flag.position * LANE_LENGTH_PX;
  return (
    <div
      data-corridor-flag={flag.id}
      style={{
        position: 'absolute',
        left: leftU,
        top: LANE_WIDTH_PX / 2 - 4,
        width: 2,
        height: 2,
        transformStyle: 'preserve-3d',
        pointerEvents: 'none',
      }}
    >
      {/* One rigid upright plane keeps the banner attached at every camera angle. */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: 0, bottom: 0,
          width: bannerW + 2, height: poleHeight,
          transform: 'rotateX(-90deg)',
          transformOrigin: 'bottom left',
        }}
      >
        <div
          data-corridor-flag-pole
          style={{
            position: 'absolute',
            left: 0, top: 0,
            width: 2, height: poleHeight,
            backgroundColor: laneAccent,
            boxShadow: `0 0 0 1px rgba(0,0,0,0.4)`,
          }}
        />
        {/* Banner — checkered for finish flag, solid otherwise */}
        <div
          data-corridor-flag-banner
          style={{
            position: 'absolute',
            left: 2, top: 0,
            width: bannerW, height: bannerH,
            background: flag.kind === 'checkered'
              ? 'repeating-conic-gradient(#1a1a1a 0deg 90deg, #f4f1e6 90deg 180deg) 0 0 / 8px 8px'
              : fs.bg,
            color: fs.fg,
            border: `1px solid ${flag.kind === 'checkered' ? '#1a1a1a' : fs.bg}`,
            padding: '2px 4px',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 8,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textAlign: 'center',
            lineHeight: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <div>{flag.label}</div>
          {flag.sublabel && <div style={{ fontSize: 6, opacity: 0.85, marginTop: 1 }}>{flag.sublabel}</div>}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Lane card — UPRIGHT placard facing the visitor at the lane head (face normal = −U)
// Implementation: div in the XY plane (width=faceWidth, height=faceHeight),
//  transform: translateZ(faceHeight) rotateY(-90deg) rotateZ(90deg) — places the
//  card in the V–Z plane, bottom edge resting on the lane, text reading left→right.
//  Full derivation in the comment inside LaneCardEl.
// 3D invariant: no mix-blend-mode / opacity<1 / filter / overflow / clip-path on
//  any element that has 3D children — each flattens preserve-3d (see
//  scripts/check-3d-flattening.mjs).
// =============================================================================

function LaneCardEl({
  card, laneAccent, isSelected, onClick,
}: {
  card: LaneCard;
  laneAccent: string;
  isSelected: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  const cs = cardStyle(card.kind);
  // Cards must face the viewer standing at the FRONT of the lanes (the
  // checkered start, at leftAlongLane = 0). With the scene tilted via
  // rotateX(+tiltX)·rotateZ(tiltZ), the camera projects back into scene coords
  // along roughly (-0.44, +0.71, +0.56), so a card face-normal pointing toward
  // -X has a positive dot-product with the camera and renders its FRONT face
  // (un-mirrored text). The placard composition is therefore:
  //   translateZ(faceHeight)  → lift card so its bottom rests on the lane (z=0)
  //   rotateY(-90deg)         → swing into V–Z plane (face normal -X = up-lane)
  //   rotateZ(+90deg)         → map local +X→+Y so text reads viewer-left→right
  // Combined mapping  (x,y,0) → (0, x, faceHeight − y) delivers:
  //   • top stripe (local y=0)       → world z=faceHeight  (top of card)
  //   • bottom edge (local y=faceH)  → world z=0           (resting on lane)
  //   • text x=0 → x=faceW           → world y=0 → +faceW  (viewer left→right)
  // Wrapper top placement of LANE_WIDTH/2 - faceWidth/2 re-centers the card
  // on the lane median, since the card extends in the +Y direction.
  const leftAlongLane = card.position * LANE_LENGTH_PX;
  const topAcrossLane = LANE_WIDTH_PX / 2 - cs.faceWidth / 2;

  return (
    <div
      onClick={onClick}
      style={{
        position: 'absolute',
        left: leftAlongLane,
        top: topAcrossLane,
        width: cs.faceHeight,
        height: cs.faceWidth,
        transformStyle: 'preserve-3d',
        backfaceVisibility: 'visible',
        willChange: 'transform',
        cursor: 'pointer',
      }}
    >
      {/* provenance marker under the step's footprint */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: cs.faceHeight * 0.4,
          height: cs.faceWidth,
          background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.32), rgba(0,0,0,0) 65%)',
          filter: 'blur(3px)',
          pointerEvents: 'none',
        }}
      />

      {/* upright placard standing perpendicular to lane direction */}
      <div
        style={{
          position: 'absolute',
          left: 0, top: 0,
          width: cs.faceWidth,
          height: cs.faceHeight,
          transform: `translateZ(${cs.faceHeight}px) rotateY(-90deg) rotateZ(90deg)`,
          transformOrigin: '0 0 0',
          transformStyle: 'preserve-3d',
          backgroundColor: cs.bg,
          color: cs.fg,
          border: `1px solid ${cs.border}`,
          borderTop: `4px solid ${cs.topStripe}`,
          boxShadow: isSelected ? `0 0 0 2px #38bdf8, 0 0 14px rgba(56,189,248,0.4)` : `inset 0 0 0 1px ${laneAccent}33`,
          padding: '5px 6px 3px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backfaceVisibility: 'visible',
          WebkitBackfaceVisibility: 'visible',
          willChange: 'transform',
        }}
      >
        <div className="leading-tight" style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: card.kind === 'state_major' ? 10 : 9,
          fontWeight: card.kind === 'state_major' ? 700 : 600,
        }}>
          {card.label}
        </div>

        {/* nested mini cards */}
        {card.nested && card.nested.length > 0 && (
          <div className="flex gap-0.5 mt-0.5 flex-wrap">
            {card.nested.map((n) => (
              <div
                key={n.id}
                style={{
                  backgroundColor: n.color ?? '#ffffff',
                  color: '#1a1a1a',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 7,
                  padding: '1px 3px',
                  border: '1px solid #4a4a4a',
                  borderTop: '2px solid #000',
                  lineHeight: 1.1,
                }}
              >
                {n.label}
              </div>
            ))}
          </div>
        )}

        {card.note && !card.nested?.length && (
          <div className="text-[7px] opacity-70 truncate" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            {card.note}
          </div>
        )}

        {/* pennants along the top of the card */}
        {card.pennants && card.pennants.map((p, i) => {
          const c = PENNANT_COLOR[p.kind];
          return (
            <div
              key={p.kind + i}
              style={{
                position: 'absolute',
                top: -14,
                left: 4 + i * 22,
                width: 0, height: 0,
                borderLeft: '8px solid transparent',
                borderRight: '8px solid transparent',
                borderTop: `14px solid ${c.bg}`,
              }}
              title={`${p.kind} · ${p.label}`}
            >
              <span
                style={{
                  position: 'absolute',
                  top: -13,
                  left: -7,
                  color: c.fg,
                  fontSize: 7,
                  fontFamily: 'JetBrains Mono, monospace',
                  width: 14,
                  textAlign: 'center',
                  lineHeight: 1,
                }}
              >
                {p.label}
              </span>
            </div>
          );
        })}

        {/* contamination probability dot */}
        {card.contaminationProb != null && card.contaminationProb > 0.1 && (
          <div
            title={`contamination prob ≈ ${(card.contaminationProb * 100).toFixed(0)}%`}
            style={{
              position: 'absolute',
              right: 3, top: 3,
              width: 6, height: 6, borderRadius: 3,
              backgroundColor: card.contaminationProb > 0.4 ? '#d63838' : card.contaminationProb > 0.2 ? '#f59e0b' : '#facc15',
            }}
          />
        )}
      </div>
    </div>
  );
}
