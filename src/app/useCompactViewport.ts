import { useSyncExternalStore } from 'react';

// Narrow tablets share the touch-first composition. The existing desktop
// workspace keeps its broader navigation; shared exploration intent lives above the boundary.
const COMPACT_QUERY = '(max-width: 1023px)';
function subscribeViewport(onChange: () => void) {
  const query = window.matchMedia(COMPACT_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}
const compactSnapshot = () => window.matchMedia(COMPACT_QUERY).matches;
export function useCompactViewport() {
  return useSyncExternalStore(subscribeViewport, compactSnapshot, () => false);
}
