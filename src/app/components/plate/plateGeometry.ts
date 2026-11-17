// ============================================================
// Plate geometry + a JS replica of the CSS 3D projection.
//
// The upright scene is plain CSS 3D (perspective root → plate
// group with preserve-3d). 2D overlays — the gossamer thread,
// stack labels, tip badges — must land exactly on the discs, so
// rather than measuring transformed DOM (which lags during the
// extrusion transitions) we project points with the same math
// the browser uses for the transform list in PlateScene3D:
//   translate3d(pan) scale3d(zoom) rotateX(rx) rotateY(ry) rotateZ(rz)
// under a perspective root offset by (rootX, rootY).
// ============================================================

import type { WellResult } from '../../types';
import { daysBetween } from '../../services/dataAvailability';

export const TILE = 38;
export const ROWS = 8;
export const COLS = 12;
export const PLATE_W = COLS * TILE;
export const PLATE_H = ROWS * TILE;
export const PLATE_MARGIN = 20;
export const PLATE_THICKNESS = 14;
export const DISC_R = 13;
export const SEAT_Z = 3;
export const ORDINAL_GAP = 20;

export const ROW_LABELS = 'ABCDEFGH';

export function wellCenter(row: number, col: number): { x: number; y: number } {
  return { x: col * TILE - PLATE_W / 2 + TILE / 2, y: row * TILE - PLATE_H / 2 + TILE / 2 };
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export interface Camera {
  readonly rx: number;
  readonly ry: number;
  readonly rz: number;
  readonly zoom: number;
  readonly panX: number;
  readonly panY: number;
  readonly rootX: number;
  readonly rootY: number;
  readonly persp: number;
}

export const FLAT_CAMERA: Camera = { rx: 52, ry: 0, rz: -8, zoom: 1, panX: 0, panY: 0, rootX: 0, rootY: 0, persp: 1600 };

/** Bottom tray height for the upright layout. */
export function trayHeight(containerH: number): number {
  return Math.round(clamp(containerH * 0.46, 260, 380));
}

/** Typical outward reach of a tall stack (8 ordinal discs ≈ 143 px), used for horizontal framing. */
const STACK_REACH = 150;
/** Space kept clear above the plate for the lock HUD. */
const HUD_CLEARANCE = 46;

/**
 * The locked upright camera: plate on edge, yawed to an extreme angle, parked
 * above the tray. Zoom and offsets are fitted against the *projected* plate
 * corners, so perspective enlargement of the near edge never slides the plate
 * under the tray or the HUD.
 */
export function uprightCamera(w: number, h: number, compact = false, reachDepth = compact ? 240 : STACK_REACH): Camera {
  const top = HUD_CLEARANCE;
  const bottom = h - (compact ? 70 : trayHeight(h) + 66);
  const hw = PLATE_W / 2 + PLATE_MARGIN;
  const hh = PLATE_H / 2 + PLATE_MARGIN;
  const corners: ReadonlyArray<readonly [number, number, number]> = [
    [-hw, -hh, 0], [hw, -hh, 0], [-hw, hh, 0], [hw, hh, 0],
  ];
  const reach: ReadonlyArray<readonly [number, number, number]> = [
    ...corners, [-hw, -hh, reachDepth], [-hw, hh, reachDepth], [hw, -hh, reachDepth], [hw, hh, reachDepth],
  ];
  const bounds = (cam: Camera, pts: ReadonlyArray<readonly [number, number, number]>) => {
    const ps = pts.map(([x, y, z]) => project(cam, x, y, z, w, h));
    return {
      minX: Math.min(...ps.map((p) => p.x)), maxX: Math.max(...ps.map((p) => p.x)),
      minY: Math.min(...ps.map((p) => p.y)), maxY: Math.max(...ps.map((p) => p.y)),
    };
  };
  let cam: Camera = { rx: -9, ry: 68, rz: 0, zoom: 1, panX: 0, panY: 0, rootX: 0, rootY: 0, persp: 1150 };
  // Perspective makes height non-linear in zoom; two refinement passes converge.
  for (let i = 0; i < 2; i++) {
    const b = bounds(cam, corners);
    const horizontal = bounds(cam, reach);
    const fit = ((bottom - top) * 0.97) / (b.maxY - b.minY);
    const fitWidth = compact ? (w - 36) / (horizontal.maxX - horizontal.minX) : Infinity;
    cam = { ...cam, zoom: clamp(cam.zoom * Math.min(fit, fitWidth), compact ? 0.25 : 0.45, 1.25) };
  }
  const v = bounds(cam, corners);
  const hz = bounds(cam, reach);
  return {
    ...cam,
    rootX: w / 2 - (hz.minX + hz.maxX) / 2,
    rootY: (top + bottom) / 2 - (v.minY + v.maxY) / 2,
  };
}

const RAD = Math.PI / 180;

export interface Projected {
  readonly x: number;
  readonly y: number;
  /** Perspective scale at this depth (1 = on the projection plane). */
  readonly k: number;
}

/** Projects a plate-local point to container pixels for the given camera. */
export function project(cam: Camera, px: number, py: number, pz: number, containerW: number, containerH: number): Projected {
  const cz = Math.cos(cam.rz * RAD), sz = Math.sin(cam.rz * RAD);
  const cy = Math.cos(cam.ry * RAD), sy = Math.sin(cam.ry * RAD);
  const cx = Math.cos(cam.rx * RAD), sx = Math.sin(cam.rx * RAD);
  // rotateZ
  const x1 = px * cz - py * sz;
  const y1 = px * sz + py * cz;
  const z1 = pz;
  // rotateY
  const x2 = x1 * cy + z1 * sy;
  const y2 = y1;
  const z2 = -x1 * sy + z1 * cy;
  // rotateX
  const x3 = x2;
  const y3 = y2 * cx - z2 * sx;
  const z3 = y2 * sx + z2 * cx;
  // scale3d + translate
  const X = x3 * cam.zoom + cam.panX;
  const Y = y3 * cam.zoom + cam.panY;
  const Z = z3 * cam.zoom;
  const k = cam.persp / (cam.persp - Z);
  return { x: containerW / 2 + cam.rootX + X * k, y: containerH / 2 + cam.rootY + Y * k, k };
}

export type StackSpacing = 'ordinal' | 'time';

/** Disc depths (plate-local z) for a stack — evenly spaced, or proportional to time between results. */
export function stackDepths(results: ReadonlyArray<WellResult>, spacing: StackSpacing, spread = 1): number[] {
  if (results.length === 0) return [];
  if (spacing === 'ordinal') return results.map((_, i) => SEAT_Z + i * ORDINAL_GAP * spread);
  const gaps = results.slice(1).map((r, i) => clamp(Math.abs(daysBetween(results[i].runDate, r.runDate)) * 0.9, 9, 70));
  const total = gaps.reduce((a, b) => a + b, 0);
  const k = total > 230 ? 230 / total : 1;
  const out = [SEAT_Z];
  for (const g of gaps) out.push(out[out.length - 1] + Math.max(8, g * k) * spread);
  return out;
}

/** Lighten (amt > 0) or darken (amt < 0) a #rrggbb color. */
export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) =>
    Math.round(amt >= 0 ? c + (255 - c) * amt : c * (1 + amt)));
  return `#${ch.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

export function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/** Mobile framing reserves touch controls while the full record lives below the scene. */
export function compactFlatCamera(width: number): Camera {
  return { ...FLAT_CAMERA, zoom: clamp((width - 40) / (PLATE_W + PLATE_MARGIN * 2), 0.45, 1.1), rootY: 8 };
}
