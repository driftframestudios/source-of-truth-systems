import { useCallback, useEffect, useRef, useState } from 'react';
import type { MouseEvent, PointerEvent } from 'react';
import { createSceneDrag } from './sceneDrag';
import type { SceneDragDelta, SceneDragMode } from './sceneDrag';

export function ownsSceneInput(target: EventTarget | null) {
  return target instanceof Element && !!target.closest('button,input,select,textarea,a,[contenteditable="true"],[data-no-drag],[data-scene-controls]');
}

/** Event wiring shared by the two desktop cameras; touch pinch keeps its own controller. */
export function useSceneDrag({ enabled, threshold, onMove }: {
  enabled: boolean;
  threshold: number;
  onMove: (delta: SceneDragDelta) => void;
}) {
  const controller = useRef(createSceneDrag(threshold));
  const owner = useRef<HTMLElement | null>(null);
  const suppressClick = useRef(false);
  const moveRef = useRef(onMove);
  moveRef.current = onMove;
  const [mode, setMode] = useState<SceneDragMode | null>(null);

  const release = useCallback((id?: number, completed = false) => {
    const ended = id == null ? controller.current.reset() : controller.current.end(id);
    if (!ended) return;
    suppressClick.current = completed && ended.moved;
    const el = owner.current;
    owner.current = null;
    if (el?.hasPointerCapture(ended.id)) el.releasePointerCapture(ended.id);
    setMode(null);
  }, []);

  useEffect(() => {
    if (!enabled) release();
  }, [enabled, release]);
  useEffect(() => {
    const cancel = () => release();
    const visibility = () => { if (document.hidden) cancel(); };
    const end = (event: globalThis.PointerEvent) => release(event.pointerId);
    window.addEventListener('blur', cancel);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      cancel();
      window.removeEventListener('blur', cancel);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [release]);

  return {
    mode,
    isDragging: () => controller.current.isDragging(),
    onPointerDown(event: PointerEvent<HTMLElement>) {
      suppressClick.current = false;
      if (!enabled || event.button > 2 || ownsSceneInput(event.target)) return;
      const nextMode = event.shiftKey || event.button === 1 || event.button === 2 ? 'pan' : 'orbit';
      if (controller.current.begin(event.pointerId, event.clientX, event.clientY, nextMode)) {
        owner.current = event.currentTarget;
        suppressClick.current = false;
      }
    },
    onPointerMove(event: PointerEvent<HTMLElement>) {
      if (event.pointerType === 'mouse' && event.buttons === 0) { release(event.pointerId); return; }
      const delta = controller.current.move(event.pointerId, event.clientX, event.clientY);
      if (!delta) return;
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.setPointerCapture(event.pointerId);
      setMode(delta.mode);
      moveRef.current(delta);
    },
    onPointerUp: (event: PointerEvent<HTMLElement>) => release(event.pointerId, true),
    onPointerCancel: (event: PointerEvent<HTMLElement>) => release(event.pointerId),
    onLostPointerCapture: (event: PointerEvent<HTMLElement>) => release(event.pointerId),
    onPointerLeave(event: PointerEvent<HTMLElement>) {
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) release(event.pointerId);
    },
    onClickCapture(event: MouseEvent) {
      if (!suppressClick.current) return;
      event.stopPropagation();
      event.preventDefault();
      suppressClick.current = false;
    },
  };
}
