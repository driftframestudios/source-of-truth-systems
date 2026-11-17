import { Component, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { PlateLoading } from './loading/PlateLoading';
import { settleInitialLoad } from './loading/initialLoad';
import './loading/plate-loading.css';
import './deferred-view.css';

interface Props { label: string; children: ReactNode; fallback?: ReactNode }

// Keep the receiving workspace and navigation mounted while its module loads.
// A full reload can fetch a fresh chunk after an interrupted load or deployment;
// resetting this boundary alone would reuse React.lazy's rejected promise.
export class LoadBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { settleInitialLoad(true); }
  render() {
    if (this.state.failed) return this.props.fallback ?? (
      <div className="deferred-view" role="alert">
        <p>The {this.props.label} couldn’t load.</p>
        <button type="button" onClick={() => window.location.reload()}>Reload to try again</button>
      </div>
    );
    return this.props.children;
  }
}

export function InitialViewReady() {
  useEffect(() => { settleInitialLoad(); }, []);
  return null;
}

function ViewReady({ onReady }: { onReady: () => void }) {
  useEffect(onReady, [onReady]);
  return null;
}

function WaitingView({ label, onWaiting }: { label: string; onWaiting: () => void }) {
  useEffect(onWaiting, [onWaiting]);
  return <PlateLoading label={`Opening ${label}…`} />;
}

export function DeferredView({ label, children }: Props) {
  const waited = useRef(false);
  const [revealing, setRevealing] = useState(false);
  const onWaiting = useCallback(() => { waited.current = true; }, []);
  const onReady = useCallback(() => {
    if (waited.current && !document.hidden && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) setRevealing(true);
    waited.current = false;
  }, []);
  const finish = useCallback(() => setRevealing(false), []);
  useEffect(() => {
    if (!revealing) return;
    const timer = window.setTimeout(finish, 1100);
    return () => window.clearTimeout(timer);
  }, [revealing, finish]);
  return (
    <LoadBoundary label={label}>
      <div className="deferred-slot">
        <Suspense fallback={<WaitingView label={label} onWaiting={onWaiting} />}>
          {children}<ViewReady onReady={onReady} />
        </Suspense>
        {revealing && <div className="deferred-reveal"><PlateLoading label="Ready" ready onFinished={finish} /></div>}
      </div>
    </LoadBoundary>
  );
}
