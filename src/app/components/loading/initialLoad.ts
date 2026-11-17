/** Initial HTML stays visible while the entry or desktop chunk is downloading. */
export function settleInitialLoad(failed = false): void {
  const carrier = document.getElementById('initial-load');
  if (!carrier || carrier.dataset.phase === 'ready') return;
  if (failed || window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.hidden) {
    carrier.remove();
    return;
  }
  carrier.dataset.phase = 'ready';
  carrier.setAttribute('aria-hidden', 'true');
  // The carrier owns a single finite exit; timeout covers interrupted CSS.
  const remove = () => { window.clearTimeout(fallback); carrier.remove(); };
  const fallback = window.setTimeout(remove, 1100);
  carrier.addEventListener('animationend', (event) => {
    if (event.target === carrier) remove();
  });
}
