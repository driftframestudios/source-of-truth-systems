import { useEffect } from 'react';
import type { SceneMode } from './corridor/CorridorScene';

export const LANES_SCENE_SHORTCUTS = [
  { scene: 'corridor', key: 'C' },
  { scene: 'plate', key: 'P' },
] as const satisfies ReadonlyArray<{ scene: SceneMode; key: string }>;

/** The visible Lanes workspace owns these keys; native editing keeps its input. */
export function useLanesShortcuts(enabled: boolean, onScene: (scene: SceneMode) => void) {
  useEffect(() => {
    if (!enabled) return;
    function navigate(event: KeyboardEvent) {
      if (document.hidden || event.defaultPrevented || event.repeat || event.isComposing ||
          event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.target instanceof Element && event.target.closest(
        'input,textarea,select,[contenteditable]:not([contenteditable="false"])',
      )) return;
      const shortcut = LANES_SCENE_SHORTCUTS.find(({ key }) => key.toLowerCase() === event.key.toLowerCase());
      if (!shortcut) return;
      event.preventDefault();
      onScene(shortcut.scene);
    }
    window.addEventListener('keydown', navigate);
    return () => window.removeEventListener('keydown', navigate);
  }, [enabled, onScene]);
}
