import type { LucideIcon } from 'lucide-react';
import { Lock } from 'lucide-react';
import type { Transition } from '../services/recordSession';
import type { CommandResult } from '../services/command';

/** A shared display strip with explicit event choices; display order is not a transition rule. */
export function WorkflowStepper<State extends string, Event extends string>({
  label, Icon, value, flow, actions, checkAction, onAction, accent, labelWidth = 'w-12',
}: {
  label: string;
  Icon: LucideIcon;
  value: State;
  flow: ReadonlyArray<State>;
  actions: ReadonlyArray<Transition<Event, State>>;
  checkAction: (event: Event) => CommandResult;
  onAction: (event: Event) => void;
  accent: string;
  labelWidth?: 'w-12' | 'w-14';
}) {
  const idx = flow.indexOf(value);
  const buttons = actions.length ? actions : [null];
  return (
    <div className="flex items-center gap-2 py-1">
      <Icon size={11} className="text-[var(--sot-shell-muted)] flex-shrink-0" />
      <span className={`text-[9px] font-mono text-[var(--sot-shell-muted)] uppercase tracking-wider ${labelWidth} flex-shrink-0`}>{label}</span>
      <div className="flex items-center gap-1 flex-wrap flex-1 min-w-0">
        {flow.map((state, index) => (
          <span key={state} className="text-[8px] font-mono px-1 py-0.5 rounded"
            style={{
              background: index === idx ? `color-mix(in srgb, ${accent} 13.333%, transparent)` : 'color-mix(in srgb, var(--sot-shell-strong-border) 5%, transparent)',
              color: index === idx ? accent : index < idx ? 'var(--sot-shell-muted)' : 'var(--sot-shell-muted)',
              border: index === idx ? `1px solid color-mix(in srgb, ${accent} 33.333%, transparent)` : '1px solid transparent',
            }}>{state.replace(/_/g, ' ')}</span>
        ))}
      </div>
      <div className="flex flex-wrap justify-end gap-1 max-w-[45%]">
        {buttons.map((action, index) => {
          const access = action ? checkAction(action.event) : null;
          const canEdit = access?.ok;
          return <button key={action?.event ?? 'terminal'} onClick={() => action && onAction(action.event)} disabled={!action}
            title={access && !access.ok ? access.reason : undefined}
            className="flex items-center gap-1 text-[8px] font-mono px-1.5 py-0.5 rounded border flex-shrink-0 transition-colors"
            style={{
              borderColor: !action ? 'color-mix(in srgb, var(--sot-shell-strong-border) 10%, transparent)' : canEdit ? `color-mix(in srgb, ${accent} 33.333%, transparent)` : 'color-mix(in srgb, var(--sot-shell-strong-border) 12%, transparent)',
              color: !action ? 'var(--sot-shell-muted)' : canEdit ? accent : 'var(--sot-shell-muted)',
              opacity: action && !canEdit ? 0.6 : 1,
              cursor: !action ? 'not-allowed' : canEdit ? 'pointer' : 'default',
            }}>
            {!canEdit && action && <Lock size={8} />}
            {action ? `${index === 0 ? '→ ' : ''}${action.label}` : 'terminal'}
          </button>;
        })}
      </div>
    </div>
  );
}
