// ============================================================
// Gossamer thread — the hairline that drops from a hovered result
// disc to the tray where its record unfurls. One progress value
// drives the stroke reveal and the travelling spark so they stay
// in lock-step; a slow shimmer runs along the strand once it lands.
// 2D overlay, outside the 3D context.
// ============================================================

import { useId, useLayoutEffect, useMemo, useRef } from 'react';
import { animate, motion } from 'motion/react';

export const THREAD_DRAW_S = 0.46;

export interface ThreadPoint {
  readonly x: number;
  readonly y: number;
}

export function GossamerThread({
  from, to, color, instant,
}: {
  from: ThreadPoint;
  to: ThreadPoint;
  color: string;
  instant: boolean;
}) {
  const uid = useId().replace(/:/g, '');
  const mainRef = useRef<SVGPathElement>(null);
  const glowRef = useRef<SVGPathElement>(null);
  const twinRef = useRef<SVGPathElement>(null);
  const shimmerRef = useRef<SVGPathElement>(null);
  const sparkRef = useRef<SVGGElement>(null);

  const { d, twin } = useMemo(() => {
    const dy = Math.max(24, to.y - from.y);
    // Never ruler-straight: a silk strand bellies slightly even when it drops plumb.
    const sway = Math.sign(to.x - from.x || 1) * Math.min(22, Math.abs(to.x - from.x) * 0.25 + 9);
    return {
      d: `M ${from.x} ${from.y} C ${from.x + sway * 0.55} ${from.y + dy * 0.4}, ${to.x - sway * 0.35} ${to.y - dy * 0.48}, ${to.x} ${to.y}`,
      twin: `M ${from.x} ${from.y} C ${from.x - sway * 0.5} ${from.y + dy * 0.34}, ${to.x + sway * 0.45} ${to.y - dy * 0.6}, ${to.x} ${to.y}`,
    };
  }, [from.x, from.y, to.x, to.y]);

  useLayoutEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    const len = main.getTotalLength();
    const strokes = [main, glowRef.current, twinRef.current].filter(Boolean) as SVGPathElement[];
    for (const s of strokes) {
      s.style.strokeDasharray = `${len} ${len}`;
      s.style.strokeDashoffset = `${len}`;
    }
    shimmerRef.current?.style.setProperty('--thread-len', `${len}`);
    if (shimmerRef.current) shimmerRef.current.style.strokeDasharray = `18 ${len}`;
    const place = (v: number) => {
      for (const s of strokes) s.style.strokeDashoffset = `${len * (1 - v)}`;
      const pt = main.getPointAtLength(len * v);
      if (sparkRef.current) {
        sparkRef.current.setAttribute('transform', `translate(${pt.x} ${pt.y})`);
        sparkRef.current.style.opacity = v >= 1 ? '0' : '1';
      }
    };
    if (instant) { place(1); return; }
    place(0);
    const ctrl = animate(0, 1, { duration: THREAD_DRAW_S, ease: [0.65, 0, 0.35, 1], onUpdate: place });
    return () => ctrl.stop();
  }, [d, instant]);

  return (
    <svg className="absolute inset-0 pointer-events-none" width="100%" height="100%" style={{ zIndex: 22, overflow: 'visible' }} aria-hidden>
      <defs>
        <linearGradient id={`g-${uid}`} gradientUnits="userSpaceOnUse" x1={from.x} y1={from.y} x2={to.x} y2={to.y}>
          <stop offset="0" stopColor={color} />
          <stop offset="0.55" stopColor="#e2ecf8" stopOpacity="0.9" />
          <stop offset="1" stopColor="#c8d8ee" stopOpacity="0.75" />
        </linearGradient>
        <filter id={`b-${uid}`} x="-50%" y="-10%" width="200%" height="120%">
          <feGaussianBlur stdDeviation="2.4" />
        </filter>
      </defs>

      {/* attachment knot at the disc */}
      <motion.circle
        cx={from.x} cy={from.y} fill="none" stroke={color} strokeWidth={1}
        initial={{ r: 2, opacity: 0 }} animate={{ r: 9, opacity: [0, 1, 0.55] }}
        transition={{ duration: instant ? 0 : 0.5, ease: 'easeOut' }}
      />
      <circle cx={from.x} cy={from.y} r={2.2} fill="#f8fafc" />

      <path ref={glowRef} d={d} fill="none" stroke={color} strokeOpacity={0.5} strokeWidth={5} filter={`url(#b-${uid})`} />
      <path ref={twinRef} d={twin} fill="none" stroke={color} strokeOpacity={0.45} strokeWidth={0.55} />
      <path ref={mainRef} d={d} fill="none" stroke={`url(#g-${uid})`} strokeWidth={1.05} strokeLinecap="round" />
      {!instant && (
        <path ref={shimmerRef} d={d} fill="none" stroke="#ffffff" strokeOpacity={0.85} strokeWidth={1.3} strokeLinecap="round" className="thread-shimmer" />
      )}

      {/* travelling spark */}
      <g ref={sparkRef} style={{ opacity: 0 }}>
        <circle r={5} fill={color} opacity={0.35} />
        <circle r={1.9} fill="#ffffff" />
      </g>

      {/* landing burst on the tray edge */}
      <motion.circle
        cx={to.x} cy={to.y} fill="none" stroke="#e2ecf8" strokeWidth={0.8}
        initial={{ r: 0, opacity: 0 }} animate={{ r: [0, 10], opacity: [0, 0.9, 0] }}
        transition={{ duration: instant ? 0 : 0.5, delay: instant ? 0 : THREAD_DRAW_S - 0.04, ease: 'easeOut' }}
      />
      <motion.circle
        cx={to.x} cy={to.y} r={2.4} fill={color}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        transition={{ duration: 0.15, delay: instant ? 0 : THREAD_DRAW_S - 0.04 }}
      />
    </svg>
  );
}
