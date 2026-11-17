import { useState } from 'react';
import { RELEASE_OPTIONS } from '../services/releaseWorkflows';
import { useNotifications } from '../services/notifications';
import type { ReleaseCommand, DecisionRecord, RequirementRecord } from '../services/releaseWorkflows';
import { useReleaseCommands } from '../services/releaseWorkflowContext';
import { useWriteGate } from '../services/writeGate';
import type { ArcId } from '../types';

const actionClass = 'px-2.5 py-1 rounded border border-[var(--sot-shell-strong-border)]/[0.1] bg-[var(--sot-shell-text)]/[0.03] text-[10px] font-mono text-[var(--sot-shell-secondary)] hover:bg-[var(--sot-shell-text)]/[0.07] disabled:opacity-50';
const fieldClass = 'rounded border border-[var(--sot-shell-strong-border)]/[0.15] bg-[var(--sot-shell-surface)] text-[var(--sot-shell-text)] text-[10px] px-2 py-1 max-w-72';

export function RequirementActions({ record, records }: { record: RequirementRecord; records: ReadonlyArray<RequirementRecord> }) {
  const [target, setTarget] = useState<ArcId>('future');
  const [replacement, setReplacement] = useState('');
  const [notice, setNotice] = useState('');
  const execute = useReleaseCommands();
  const { pushToast } = useNotifications();
  const accept = (command: ReleaseCommand, message: string) => {
    const result = execute(command);
    if (result.ok) { setNotice(message); pushToast({ severity: 'info', title: record.id, message }); }
    return result;
  };
  const { check } = useWriteGate();
  const access = check({ action: 'release.manage', subjectId: record.id });
  const candidates = records.filter(item => item.id !== record.id && ['active', 'target_state'].includes(item.status));
  return <div className="mt-3 space-y-2">
    <div className="flex flex-wrap items-end gap-2">
      {record.status !== 'superseded' && <>
        <label className="grid gap-1 text-[9px] text-[var(--sot-shell-muted)]">Target release
          <select aria-label={`Target release for ${record.id}`} className={fieldClass} value={target} onChange={event => setTarget(event.target.value as ArcId)}>
            {RELEASE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <button className={actionClass} onClick={() => { accept({ type: 'requirement.defer', id: record.id, revision: record.revision, target }, `Deferred to ${RELEASE_OPTIONS.find(option => option.value === target)?.label}.`); }}>Defer</button>
        <label className="grid gap-1 text-[9px] text-[var(--sot-shell-muted)]">Replacement requirement
          <select aria-label={`Replacement for ${record.id}`} className={fieldClass} value={replacement} onChange={event => setReplacement(event.target.value)}>
            <option value="">Choose a requirement</option>
            {candidates.map(item => <option key={item.id} value={item.id}>{item.id} · {item.text}</option>)}
          </select>
        </label>
        <button className={actionClass} disabled={!replacement} onClick={() => { accept({ type: 'requirement.supersede', id: record.id, revision: record.revision, replacementId: replacement }, `Replaced by ${replacement}.`); }}>Supersede</button>
      </>}
      {record.edited && <button className={actionClass} onClick={() => { accept({ type: 'requirement.restore', id: record.id, revision: record.revision }, 'Original example restored.'); }}>Restore original</button>}
    </div>
    {record.replacementId && <p className="text-[10px] text-[var(--sot-shell-secondary)]">Replaced by {record.replacementId}</p>}
    <p role="status" className="text-[9px] text-[var(--sot-shell-muted)]">{!access.ok ? access.reason : notice || 'Changes stay in this browser session.'}</p>
  </div>;
}

export function DecisionActions({ record }: { record: DecisionRecord }) {
  const execute = useReleaseCommands();
  const { pushToast } = useNotifications();
  const accept = (command: ReleaseCommand, message: string) => {
    const result = execute(command);
    if (result.ok) { setNotice(message); pushToast({ severity: 'info', title: record.id, message }); }
    return result;
  };
  const { check } = useWriteGate();
  const access = check({ action: 'release.manage', subjectId: record.id });
  const [notice, setNotice] = useState('');
  const act = (type: 'decision.confirm' | 'decision.revisit' | 'decision.restore', message: string) => {
    accept({ type, id: record.id, revision: record.revision }, message);
  };
  return <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-t border-[var(--sot-shell-strong-border)]/[0.04]">
    <button className={actionClass} disabled={record.status === 'confirmed'} onClick={() => act('decision.confirm', 'Decision confirmed in this session.')}>Confirm</button>
    <button className={actionClass} disabled={record.status !== 'confirmed'} onClick={() => act('decision.revisit', 'Decision returned to review.')}>Revisit</button>
    {record.edited && <button className={actionClass} onClick={() => act('decision.restore', 'Original example restored.')}>Restore original</button>}
    <span role="status" className="text-[9px] text-[var(--sot-shell-muted)]">{!access.ok ? access.reason : notice || 'Changes stay in this browser session.'}</span>
  </div>;
}
