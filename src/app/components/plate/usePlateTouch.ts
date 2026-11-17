import { useCallback, useEffect, useRef } from 'react';
import type { MouseEvent, PointerEvent } from 'react';
import { createCorridorGesture } from '../mobile/corridorGesture';
import { ownsSceneInput } from '../useSceneDrag';
import type { CorridorGestureDelta } from '../mobile/corridorGesture';

/** The shared two-contact controller drives the compact plate without changing desktop input. */
export function usePlateTouch(enabled: boolean, onMove: (delta: CorridorGestureDelta) => void) {
  const gesture = useRef(createCorridorGesture());
  const owner = useRef<HTMLElement | null>(null);
  const suppressClick = useRef(false);
  const apply = useRef(onMove);
  apply.current = onMove;
  const cancel = useCallback(() => {
    const element = owner.current;
    for (const id of gesture.current.reset()) if (element?.hasPointerCapture(id)) element.releasePointerCapture(id);
    owner.current = null;
    suppressClick.current = false;
  }, []);
  useEffect(() => { if (!enabled) cancel(); }, [enabled, cancel]);
  useEffect(() => {
    const hidden = () => { if (document.hidden) cancel(); };
    const endedOutside = (event: globalThis.PointerEvent) => { gesture.current.end(event.pointerId); };
    window.addEventListener('pointerup', endedOutside);
    window.addEventListener('pointercancel', endedOutside);
    window.addEventListener('blur', cancel);
    document.addEventListener('visibilitychange', hidden);
    return () => { cancel(); window.removeEventListener('pointerup', endedOutside); window.removeEventListener('pointercancel', endedOutside); window.removeEventListener('blur', cancel); document.removeEventListener('visibilitychange', hidden); };
  }, [cancel]);
  const end = (event: PointerEvent<HTMLElement>, completed: boolean) => {
    const moved = gesture.current.end(event.pointerId);
    if (completed) suppressClick.current ||= moved;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return {
    preparePointer() { suppressClick.current = false; },
    onPointerDown(event: PointerEvent<HTMLElement>) {
      if (!enabled || ownsSceneInput(event.target)) return;
      owner.current = event.currentTarget;
      suppressClick.current = false;
      gesture.current.begin(event.pointerId, { x: event.clientX, y: event.clientY });
    },
    onPointerMove(event: PointerEvent<HTMLElement>) {
      if (!enabled) return;
      const delta = gesture.current.move(event.pointerId, { x: event.clientX, y: event.clientY });
      if (!delta) return;
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.setPointerCapture(event.pointerId);
      apply.current(delta);
    },
    onPointerUp: (event: PointerEvent<HTMLElement>) => end(event, true),
    onPointerCancel: (event: PointerEvent<HTMLElement>) => end(event, false),
    onLostPointerCapture(event: PointerEvent<HTMLElement>) {
      // A touch starts with implicit capture on its child. Moving capture to the
      // scene emits a bubbled loss for that child; only scene capture loss ends it.
      if (event.target === event.currentTarget) end(event, false);
    },
    onClickCapture(event: MouseEvent) {
      if (!suppressClick.current) return;
      suppressClick.current = false;
      event.stopPropagation();
      event.preventDefault();
    },
  };
}
