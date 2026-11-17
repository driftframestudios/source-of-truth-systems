/** A selected-history request owns its cancellation, deadline and publication. */
export function requestLatestHistory<T>(
  load: (signal: AbortSignal) => Promise<T>,
  publish: (result: { value: T } | { error: true }) => void,
  timeoutMs = 8_000,
): () => void {
  const controller = new AbortController();
  let current = true;
  const finish = (result: { value: T } | { error: true }) => {
    if (!current) return;
    current = false;
    clearTimeout(timer);
    publish(result);
  };
  const timer = setTimeout(() => {
    controller.abort();
    finish({ error: true });
  }, timeoutMs);
  Promise.resolve().then(() => load(controller.signal)).then(
    (value) => finish({ value }),
    () => finish({ error: true }),
  );
  return () => {
    current = false;
    clearTimeout(timer);
    controller.abort();
  };
}
