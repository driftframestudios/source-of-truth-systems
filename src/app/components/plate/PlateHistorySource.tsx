import type { PlateHistory } from '../../services/plateHistory/read';
import type { HistoryPhase } from '../../services/plateHistory/context';
import './plate-history.css';

export interface PlateHistorySourceProps {
  wellId: string | null;
  history?: PlateHistory;
  phase: HistoryPhase;
  retry: () => void;
  primary?: boolean;
  fallbackAllowed?: boolean;
}

/** This receipt names the shown history, including a previously fetched hover preview. */
export function PlateHistorySource({ wellId, history, phase, retry, primary = false, fallbackAllowed = true }: PlateHistorySourceProps) {
  const unavailable = phase === 'unavailable';
  const denied = phase === 'denied';
  const source = history?.mode === 'STORED' ? 'Stored history' : 'Example history';
  const detail = !wellId ? 'Select a well to read its history'
    : denied ? 'History unavailable in this scenario'
    : phase === 'loading' ? (fallbackAllowed ? 'Example history · checking source…' : 'Checking source…')
    : unavailable ? (fallbackAllowed ? 'Example history · source unavailable' : 'History source unavailable')
    : history?.missing ? `${source} · well not found`
    : history?.results.length === 0 ? `${source} · no results`
    : source;
  const pending = !!wellId && phase === 'loading';
  return <div className={`plate-history-source${primary ? ' plate-history-source--primary' : ''}`} role="status" aria-live="polite" data-history-source={history?.mode ?? (fallbackAllowed ? 'EXAMPLE' : 'UNAVAILABLE')} data-history-phase={phase}>
    {primary && <span className="plate-history-source__activity" data-pending={pending} aria-hidden="true"><i /><i /><i /><i /><i /><i /></span>}
    <span className="plate-history-source__label"><strong>{wellId ? `${wellId} history` : 'Example plate'}</strong><span>{detail}</span></span>
    <span className="plate-history-source__context">{denied ? 'Choose a permitted scenario' : !fallbackAllowed ? 'Retry this source' : wellId ? 'Read histories stay available' : 'Example data'}</span>
    {unavailable && <button type="button" onClick={retry}>Retry history</button>}
  </div>;
}
