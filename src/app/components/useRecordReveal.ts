import { useEffect, useRef } from 'react';
import type { RecordRequest } from '../services/recordNavigation';

/** Receivers clear their own filters/selection, then reveal the exact rendered record. */
export function useRecordReveal(request: RecordRequest | undefined, reveal: (id: string) => void) {
  const container = useRef<HTMLDivElement>(null);
  const revealRef = useRef(reveal);
  revealRef.current = reveal;
  useEffect(() => {
    if (!request) return;
    revealRef.current(request.entityId);
    const frame = requestAnimationFrame(() => {
      const record = container.current?.querySelector<HTMLElement>(`[data-record-id="${CSS.escape(request.entityId)}"]`);
      record?.focus({ preventScroll: true });
      record?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
    return () => cancelAnimationFrame(frame);
  }, [request]);
  return container;
}
