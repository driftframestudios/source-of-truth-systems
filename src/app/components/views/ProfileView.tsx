import { useEffect, useMemo, useState } from 'react';
import './profile-layout.css';
import {
  User, Bell, Plug, ShieldCheck, AlertTriangle, AlertOctagon, ShieldAlert, Info,
  ChevronLeft, ChevronRight, Trash2, Zap, CircleCheck, CircleX,
  Grid3x3, Server, Lock, Eye, Pencil, Globe, Loader2, HardDrive, Cpu,
} from 'lucide-react';
import { STORE } from '../../data';
import { matchesQuery } from '../../services/search';
import { SearchField } from '../SearchField';
import { useNotifications } from '../../services/notifications';
import { ThemeSelector } from '../../theme/ThemeSelector';
import { ERROR_CODES, SAMPLE_ERRORS, buildErrorLog, createError } from '../../services/errorFactory';
import { useEnvironment } from '../../services/environment';
import { usePermissionScenario } from '../../services/permissionScenario';
import { effectiveGrant } from '../../../../shared/permission-scope.mjs';
import { CAPABILITY_LABELS, ROLE_CAPABILITIES } from '../../services/permissionPolicy';
import { useWriteGate } from '../../services/writeGate';
import {
  PRINCIPALS, ROLES, POPULATIONS, GEOGRAPHIES, RESOURCES,
  getRole, getPopulation, countGrants,
} from '../../services/accessService';
import {
  cellKey,
} from '../../types/access';
import type {
  AppErrorCode, ErrorSeverity, NotificationKind,
} from '../../types';
import type {
  Principal, PopulationId, AccessLevel, AccessMatrix, ResourceDef, ResourceKind, GeographyId,
} from '../../types/access';

type ProfileTab = 'profile' | 'access' | 'infrastructure' | 'preferences' | 'connections' | 'notifications' | 'error_lab';

const NAVIGATION: ReadonlyArray<{
  label: string;
  items: ReadonlyArray<{ id: ProfileTab; label: string; icon: typeof User }>;
}> = [
  { label: 'Scenario & access', items: [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'access', label: 'Access Grid', icon: Grid3x3 },
  ] },
  { label: 'Your workspace', items: [
    { id: 'preferences', label: 'Preferences', icon: ShieldCheck },
    { id: 'notifications', label: 'Notifications', icon: Bell },
  ] },
  { label: 'Tools & examples', items: [
    { id: 'infrastructure', label: 'Infrastructure', icon: Server },
    { id: 'connections', label: 'Connections', icon: Plug },
    { id: 'error_lab', label: 'Error Lab', icon: Zap },
  ] },
];

const ACCESS_CYCLE: Record<AccessLevel, AccessLevel> = {
  none: 'read',
  read: 'write',
  write: 'none',
};

const ACCESS_STYLE: Record<AccessLevel, { bg: string; fg: string; border: string; label: string }> = {
  none:  { bg: 'transparent',            fg: 'var(--sot-shell-muted)', border: 'color-mix(in srgb, var(--sot-shell-strong-border) 10%, transparent)', label: '—' },
  read:  { bg: 'rgba(56,189,248,0.14)',  fg: 'var(--sot-status-info)', border: 'rgba(56,189,248,0.35)',  label: 'R' },
  write: { bg: 'rgba(52,211,153,0.16)',  fg: 'var(--sot-status-success)', border: 'rgba(52,211,153,0.40)',  label: 'W' },
};

const ERROR_LOG = buildErrorLog(83);
const PAGE_SIZE = 10;

const SEVERITY_COLOR: Record<ErrorSeverity, string> = {
  info: '#60a5fa',
  warning: '#f59e0b',
  error: '#f87171',
  critical: '#fb7185',
};

function SeverityIcon({ severity, size = 12 }: { severity: ErrorSeverity; size?: number }) {
  const c = SEVERITY_COLOR[severity];
  if (severity === 'info') return <Info size={size} style={{ color: c }} />;
  if (severity === 'warning') return <AlertTriangle size={size} style={{ color: c }} />;
  if (severity === 'error') return <AlertOctagon size={size} style={{ color: c }} />;
  return <ShieldAlert size={size} style={{ color: c }} />;
}

export function ProfileView() {
  const [tab, setTab] = useState<ProfileTab>('profile');
  const { env } = useEnvironment();
  const { principal: self, roleId } = usePermissionScenario();
  const selfRole = getRole(roleId);
  const writeDecision = useWriteGate().check();
  return (
    <div className="profile-workspace">
      {/* Navigation groups distinguish the actor, preferences and diagnostic examples. */}
      <aside className="profile-workspace__rail" aria-label="Profile navigation">
        <div className="profile-workspace__identity">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-400 to-sky-500 flex items-center justify-center">
              <span className="text-[12px] text-[#062b27]" style={{ fontWeight: 600 }}>{self.initials}</span>
            </div>
            <div className="min-w-0">
              <div className="text-[11px] text-[var(--sot-shell-text)] truncate">{self.name}</div>
              <div className="text-[9px] font-mono text-[var(--sot-shell-muted)] truncate">{selfRole.label} · showcase persona</div>
            </div>
          </div>
        </div>
        <nav className="profile-workspace__navigation" aria-label="Profile sections">
          {NAVIGATION.map((group) => (
            <div key={group.label} className="profile-workspace__group" role="group" aria-label={group.label}>
              <span className="profile-workspace__group-title">{group.label}</span>
              <div className="profile-workspace__links">
                {group.items.map(({ id, label, icon: Icon }) => (
                  <button key={id} type="button" onClick={() => setTab(id)} aria-current={tab === id ? 'page' : undefined}>
                    <Icon size={13} aria-hidden="true" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="profile-workspace__context text-[9px] font-mono text-[var(--sot-shell-muted)]">
          <div className="profile-workspace__compact-actor"><span>Acting as</span><span className="text-[var(--sot-shell-text)]">{self.name}</span></div>
          <div className="flex justify-between"><span>Environment</span><span style={{ color: env.accent }}>{env.label} · {env.longLabel}</span></div>
          <div className="flex justify-between"><span>Role</span><span className="text-teal-400">{selfRole.label}</span></div>
          <div className="flex justify-between"><span>Clearance</span><span className="text-[var(--sot-shell-muted)]">{self.clearance.replace('_', '-')}</span></div>
          <div className="flex justify-between"><span>Write policy</span><span title={writeDecision.ok ? undefined : writeDecision.reason} style={{ color: writeDecision.ok ? 'var(--sot-status-success)' : 'var(--sot-status-warning)' }}>{writeDecision.ok ? 'local edits' : 'restricted'}</span></div>
        </div>
      </aside>

      <section className="profile-workspace__content" aria-label="Profile workspace">
        {tab === 'profile' && <ProfilePanel />}
        {tab === 'access' && <AccessPanel />}
        {tab === 'infrastructure' && <InfrastructurePanel />}
        {tab === 'preferences' && <PreferencesPanel />}
        {tab === 'connections' && <ConnectionsPanel />}
        {tab === 'notifications' && <NotificationsPanel />}
        {tab === 'error_lab' && <ErrorLabPanel />}
      </section>
    </div>
  );
}

// =====================================================================

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="px-6 py-4 border-b border-[var(--sot-shell-strong-border)]/[0.06]">
      <div className="text-[12px] text-[var(--sot-shell-text)]" style={{ fontFamily: 'Playfair Display, serif' }}>{title}</div>
      {subtitle && <div className="text-[10px] text-[var(--sot-shell-muted)] mt-0.5">{subtitle}</div>}
    </div>
  );
}

function FormRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="profile-form-row py-3 border-b border-[var(--sot-shell-strong-border)]/[0.04]">
      <div>
        <div className="text-[11px] text-[var(--sot-shell-text)]">{label}</div>
        {hint && <div className="text-[9px] text-[var(--sot-shell-muted)] mt-0.5 leading-relaxed">{hint}</div>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function Input({ value, placeholder }: { value?: string; placeholder?: string }) {
  return (
    <input
      defaultValue={value}
      placeholder={placeholder}
      className="w-full max-w-md bg-[var(--sot-shell-text)]/[0.04] border border-[var(--sot-shell-strong-border)]/[0.08] rounded px-2.5 py-1.5 text-[11px] text-[var(--sot-shell-text)] focus:outline-none focus:border-sky-500/40 font-mono"
    />
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="relative w-9 h-5 shrink-0 rounded-full transition-colors"
      style={{ backgroundColor: checked ? '#2dd4bf' : '#2a3a52' }}
    >
      <span
        className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform"
        style={{ transform: checked ? 'translateX(16px)' : 'translateX(0)' }}
      />
    </button>
  );
}

function Button({
  children,
  variant = 'secondary',
  onClick,
  size = 'sm',
  disabled = false,
  label,
}: {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
  onClick?: () => void;
  size?: 'sm' | 'md';
  disabled?: boolean;
  label?: string;
}) {
  const palette =
    variant === 'primary'
      ? { bg: '#2dd4bf', fg: '#062b27', border: '#2dd4bf' }
      : variant === 'danger'
      ? { bg: 'rgba(248,113,113,0.10)', fg: '#f87171', border: 'rgba(248,113,113,0.32)' }
      : { bg: 'transparent', fg: 'var(--sot-shell-text)', border: 'color-mix(in srgb, var(--sot-shell-strong-border) 18%, transparent)' };
  const pad = size === 'md' ? 'px-3.5 py-1.5 text-[11px]' : 'px-2.5 py-1 text-[10px]';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`${pad} font-mono rounded border transition-colors enabled:hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed`}
      style={{ backgroundColor: palette.bg, color: palette.fg, borderColor: palette.border }}
    >
      {children}
    </button>
  );
}

// =====================================================================

function ProfilePanel() {
  const { principal: self, roleId, audienceId, selectPersona, selectRole, selectAudience } = usePermissionScenario();
  const role = getRole(roleId);
  const pop = getPopulation(audienceId);
  const geo = GEOGRAPHIES.find((g) => g.id === self.homeGeography);
  const decision = useWriteGate().check();
  const fieldClass = 'max-w-md w-full bg-[var(--sot-shell-raised)] border border-[var(--sot-shell-border)] rounded px-2.5 py-1.5 text-[11px] text-[var(--sot-shell-text)] font-mono';
  return (
    <div>
      <SectionHeader title="Permission scenario" subtitle="Choose a showcase persona and role. Changes apply immediately to local action decisions; this is not a login." />
      <div className="px-6">
        <FormRow label="Showcase persona" hint="Selecting a persona loads its role, assigned environments and audience perspective.">
          <select aria-label="Showcase persona" className={fieldClass} value={self.id} onChange={(event) => selectPersona(event.target.value)}>
            {PRINCIPALS.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.title}</option>)}
          </select>
          <p className="text-[9px] font-mono text-[var(--sot-shell-muted)] mt-2">{self.handle} · {self.email}</p>
        </FormRow>
        <FormRow label="Workspace role" hint={role.summary}>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Workspace role">
            {ROLES.map((item) => (
              <button key={item.id} type="button" aria-pressed={item.id === roleId} onClick={() => selectRole(item.id)} className="text-[10px] font-mono px-2 py-1 rounded border"
                style={{ color: item.id === roleId ? 'var(--sot-shell-on-accent)' : 'var(--sot-shell-secondary)', backgroundColor: item.id === roleId ? 'var(--sot-shell-accent)' : 'transparent', borderColor: item.id === roleId ? 'var(--sot-shell-accent)' : 'var(--sot-shell-border)' }}>
                {item.label}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-[var(--sot-shell-secondary)] mt-2" role="status" aria-label="Scenario action availability">{decision.ok ? 'Local edits are available for this persona and environment.' : decision.reason}</p>
        </FormRow>
        <FormRow label="Audience perspective" hint="Choose a reading focus. This preference leaves permissions unchanged.">
          <select aria-label="Audience perspective" className={fieldClass} value={audienceId} onChange={(event) => selectAudience(event.target.value as PopulationId)}>
            {POPULATIONS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          <p className="text-[10px] text-[var(--sot-shell-secondary)] mt-2">{pop.firstMove}.</p>
          <p className="text-[9px] font-mono text-[var(--sot-shell-muted)] mt-1">Explore · {pop.route}</p>
        </FormRow>
        <FormRow label="Home geography" hint="The persona's example operating region."><span className="text-[11px] font-mono text-[var(--sot-shell-text)]">{geo?.label}</span></FormRow>
        <FormRow label="Scenario clearance" hint="Clearance limits protected Plate details and supported record actions."><span className="text-[11px] font-mono text-[var(--sot-status-warning)]">{self.clearance.replace('_', '-')}</span></FormRow>
        <FormRow label="Assigned environments" hint="Local actions require membership and an environment that permits writes.">
          <div className="flex gap-1.5">{self.environments.map((id) => <span key={id} className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-[var(--sot-shell-border)] text-[var(--sot-shell-text)] uppercase">{id}</span>)}</div>
        </FormRow>
        <FormRow label="Action capabilities" hint="Consent and environment rules still apply.">
          <div className="flex flex-wrap gap-1.5">
            {ROLE_CAPABILITIES[roleId].length ? ROLE_CAPABILITIES[roleId].map((capability) => <span key={capability} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[var(--sot-shell-raised)] text-[var(--sot-shell-secondary)]">{CAPABILITY_LABELS[capability]}</span>) : <span className="text-[10px] text-[var(--sot-shell-secondary)]">Explore records; local write actions are unavailable.</span>}
          </div>
        </FormRow>
      </div>
    </div>
  );
}

// =====================================================================
// Access Grid — population-cartography read/write across geographies
// =====================================================================

const KIND_LABEL: Record<ResourceKind, string> = {
  specimen: 'Specimen Views',
  sequencing: 'Sequencing Data',
};

function AccessPanel() {
  const { env } = useEnvironment();
  const { pushToast } = useNotifications();
  const gate = useWriteGate();
  const scenario = usePermissionScenario();
  const [principalId, setPrincipalId] = useState<string>(scenario.principal.id);
  const [matrix, setMatrix] = useState<AccessMatrix>(() => ({ ...scenario.scope.matrices[scenario.principal.id] }));
  const [dirty, setDirty] = useState(false);
  const [showEffective, setShowEffective] = useState(false);

  const principal: Principal = PRINCIPALS.find((person) => person.id === principalId)!;
  const role = getRole(principalId === scenario.principal.id ? scenario.roleId : principal.role);
  const permission = gate.check({ action: 'policy.edit' });
  const canEdit = permission.ok;

  function inspect(id: string) {
    if (!PRINCIPALS.some(person => person.id === id)) return;
    setPrincipalId(id);
    setMatrix({ ...scenario.getScope().matrices[id] });
    setDirty(false);
  }

  function display(res: ResourceDef, geography: GeographyId): AccessLevel {
    const requested = matrix[cellKey(res.id, geography)] ?? 'none';
    if (!showEffective) return requested;
    return effectiveGrant({ ...scenario.scope, matrices: { ...scenario.scope.matrices, [principalId]: matrix } }, principalId, res.id, geography);
  }

  function cycle(res: ResourceDef, geography: GeographyId) {
    if (!canEdit || showEffective) return;
    const key = cellKey(res.id, geography);
    setMatrix((previous) => {
      const next = ACCESS_CYCLE[previous[key] ?? 'none'];
      const copy = { ...previous };
      if (next === 'none') delete copy[key];
      else copy[key] = next;
      return copy;
    });
    setDirty(true);
  }

  function bulkGeo(geography: GeographyId, level: AccessLevel) {
    if (!canEdit || showEffective) return;
    setMatrix((previous) => {
      const copy = { ...previous };
      for (const resource of RESOURCES) {
        const key = cellKey(resource.id, geography);
        if (level === 'none') delete copy[key];
        else copy[key] = level;
      }
      return copy;
    });
    setDirty(true);
  }

  function save() {
    const result = scenario.saveGrants(principalId, matrix);
    if (!result.ok) { gate.deny('Save grants', result, principalId); return; }
    setMatrix({ ...scenario.getScope().matrices[principalId] });
    setDirty(false);
    pushToast({ severity: 'info', title: 'Scenario grants saved', message: `Resource access for ${principal.name} now follows these grants in this browser session.` });
  }

  function reset() {
    scenario.resetGrants();
    setMatrix({ ...scenario.getScope().matrices[principalId] });
    setDirty(false);
    pushToast({ severity: 'info', title: 'Example grants restored', message: 'Accepted work and exploration stay in place.' });
  }

  const grants = countGrants(matrix);

  return (
    <div>
      <SectionHeader
        title="Scenario access grid"
        subtitle="Set resource access for this public scenario. Saved grants shape Plate reads and supported record actions."
      />

      <p className="px-6 pt-3 text-[10px] text-[var(--sot-shell-secondary)]">Acting as {scenario.principal.name} · {getRole(scenario.roleId).label} · {env.label}</p>
      {/* Inspection stays separate from the acting scenario. */}
      <div className="px-6 py-3 border-b border-[var(--sot-shell-strong-border)]/[0.06] flex items-center gap-3 flex-wrap">
        <span className="text-[9px] font-mono text-[var(--sot-shell-muted)] uppercase tracking-wider">Inspect person</span>
        <select
          value={principalId}
          aria-label="Inspect access for"
          onChange={(e) => inspect(e.target.value)}
          className="bg-[var(--sot-shell-text)]/[0.04] border border-[var(--sot-shell-strong-border)]/[0.08] rounded px-2 py-1 text-[11px] text-[var(--sot-shell-text)] font-mono"
        >
          {PRINCIPALS.map((p) => <option key={p.id} value={p.id}>{p.name} — {getRole(p.role).label}</option>)}
        </select>
        <span className="text-[9px] font-mono px-2 py-1 rounded border border-[var(--sot-shell-strong-border)]/[0.1] text-[var(--sot-shell-secondary)]">
          ceiling · {role.ceiling.toUpperCase()}
        </span>
        <span className="text-[9px] font-mono px-2 py-1 rounded border border-amber-500/30 text-amber-300">
          clearance · {principal.clearance.replace('_', '-')}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setShowEffective((s) => !s)}
            className="text-[9px] font-mono px-2 py-1 rounded border transition-colors"
            style={{
              color: showEffective ? env.accent : 'var(--sot-shell-muted)',
              borderColor: showEffective ? `color-mix(in srgb, ${env.accent} 33.333%, transparent)` : 'color-mix(in srgb, var(--sot-shell-strong-border) 18%, transparent)',
              backgroundColor: showEffective ? `color-mix(in srgb, ${env.accent} 7.843%, transparent)` : 'transparent',
            }}
          >
            <Eye size={9} className="inline -mt-px mr-1" />
            {showEffective ? `effective scope in ${env.label}` : 'requested grants'}
          </button>
        </div>
      </div>

      {showEffective && (
        <div className="px-6 py-2 text-[9px] font-mono text-[var(--sot-shell-muted)] bg-[var(--sot-shell-text)]/[0.02] border-b border-[var(--sot-shell-strong-border)]/[0.05] flex items-center gap-2">
          <Info size={10} className="text-sky-400" />
          Effective scope applies the inspected role, environment membership and clearance. Task capabilities and consent still govern each action.
        </div>
      )}

      {/* Grid */}
      <div className="px-6 py-4">
          <div className="overflow-x-auto">
            <table className="border-collapse">
              <thead>
                <tr>
                  <th className="text-left px-2 py-1.5 text-[9px] font-mono text-[var(--sot-shell-muted)] uppercase tracking-wider sticky left-0 bg-[var(--sot-shell-background)] z-10">Resource</th>
                  {GEOGRAPHIES.map((g) => (
                    <th key={g.id} className="px-1.5 py-1.5 min-w-[52px]">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-[10px] font-mono text-[var(--sot-shell-text)] flex items-center gap-1"><Globe size={9} className="text-[var(--sot-shell-muted)]" />{g.code}</span>
                        <span className="text-[7px] font-mono text-[var(--sot-shell-muted)]">{g.residency}</span>
                        {canEdit && !showEffective && (
                          <div className="flex gap-0.5 mt-0.5">
                            <button onClick={() => bulkGeo(g.id, 'read')} className="text-[7px] font-mono px-1 rounded bg-sky-500/15 text-sky-400 hover:bg-sky-500/25">R</button>
                            <button onClick={() => bulkGeo(g.id, 'none')} className="text-[7px] font-mono px-1 rounded bg-[var(--sot-shell-text)]/[0.05] text-[var(--sot-shell-muted)] hover:bg-[var(--sot-shell-text)]/[0.1]">·</button>
                          </div>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(['specimen', 'sequencing'] as ResourceKind[]).map((kind) => (
                  <GridGroup
                    key={kind}
                    kind={kind}
                    resources={RESOURCES.filter((r) => r.kind === kind)}
                    display={display}
                    cycle={cycle}
                    canEdit={canEdit && !showEffective}
                    clearance={principal.clearance}
                  />
                ))}
              </tbody>
            </table>
          </div>
      </div>

      <p className="px-6 pb-3 text-[10px] text-[var(--sot-shell-secondary)]">Reset restores all example grants and clears this draft. Accepted work stays in place.</p>
      {/* Footer actions */}
      <div className="profile-access-actions px-6 py-4 border-t border-[var(--sot-shell-strong-border)]/[0.06] flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-3 text-[10px] font-mono">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded flex items-center justify-center text-[8px]" style={{ backgroundColor: ACCESS_STYLE.read.bg, color: ACCESS_STYLE.read.fg, border: `1px solid ${ACCESS_STYLE.read.border}` }}>R</span><span className="text-[var(--sot-shell-muted)]">{grants.read} read</span></span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded flex items-center justify-center text-[8px]" style={{ backgroundColor: ACCESS_STYLE.write.bg, color: ACCESS_STYLE.write.fg, border: `1px solid ${ACCESS_STYLE.write.border}` }}>W</span><span className="text-[var(--sot-shell-muted)]">{grants.write} write</span></span>
        </div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          {!permission.ok && <span className="max-w-[320px] text-[9px] font-mono text-[var(--sot-shell-muted)] flex items-center gap-1"><Lock size={9} className="shrink-0" /> {permission.reason}</span>}
          {dirty && <span className="text-[9px] font-mono text-amber-400">unsaved changes</span>}
          <Button size="md" onClick={reset} disabled={!dirty && !scenario.scope.grantChanges.length}>
            Reset scenario grants
          </Button>
          <Button variant="primary" size="md" onClick={save} disabled={!canEdit || !dirty}>
            Save grants
          </Button>
        </div>
      </div>
    </div>
  );
}

function GridGroup({
  kind, resources, display, cycle, canEdit, clearance,
}: {
  kind: ResourceKind;
  resources: ReadonlyArray<ResourceDef>;
  display: (res: ResourceDef, geoId: GeographyId) => AccessLevel;
  cycle: (res: ResourceDef, geoId: GeographyId) => void;
  canEdit: boolean;
  clearance: string;
}) {
  return (
    <>
      <tr>
        <td colSpan={GEOGRAPHIES.length + 1} className="pt-4 pb-1 px-2 text-[9px] font-mono text-[var(--sot-shell-muted)] uppercase tracking-wider sticky left-0 bg-[var(--sot-shell-background)]">
          {KIND_LABEL[kind]}
        </td>
      </tr>
      {resources.map((res) => {
        const gated = false; // sensitivity gating is reflected via effective view
        return (
          <tr key={res.id} className="group">
            <td className="px-2 py-1 sticky left-0 bg-[var(--sot-shell-background)] z-10">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono text-[var(--sot-shell-text)]">{res.label}</span>
                <span className="text-[7px] font-mono px-1 rounded bg-[var(--sot-shell-text)]/[0.04] text-[var(--sot-shell-muted)]">{res.sensitivity.replace('_', '-')}</span>
              </div>
            </td>
            {GEOGRAPHIES.map((g) => {
              const level = display(res, g.id);
              const st = ACCESS_STYLE[level];
              return (
                <td key={g.id} className="px-1 py-1 text-center">
                  <button
                    onClick={() => cycle(res, g.id)}
                    disabled={!canEdit}
                    aria-label={`${res.label} · ${g.label} · ${level}`}
                    className="w-8 h-7 rounded text-[10px] font-mono transition-all"
                    style={{
                      backgroundColor: st.bg,
                      color: st.fg,
                      border: `1px solid ${st.border}`,
                      cursor: canEdit ? 'pointer' : 'default',
                      opacity: gated ? 0.4 : 1,
                    }}
                  >
                    {level === 'write' ? <Pencil size={10} className="inline" />
                      : level === 'read' ? <Eye size={10} className="inline" />
                      : <span className="text-[var(--sot-shell-muted)]">·</span>}
                  </button>
                </td>
              );
            })}
          </tr>
        );
      })}
    </>
  );
}

// =====================================================================
// Infrastructure — example AWS footprint for the selected environment
// =====================================================================

function InfrastructurePanel() {
  const { env } = useEnvironment();
  const infra = env.infra;
  return (
    <div>
      <SectionHeader title="Example AWS footprint" subtitle={`Reference infrastructure for ${env.longLabel}. Switch environments in the top bar to compare examples.`} />
      <div className="px-6 py-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: Globe, label: 'Region', value: infra.region },
          { icon: ShieldCheck, label: 'Account', value: infra.account },
          { icon: Cpu, label: 'EC2 instances', value: String(infra.ec2Instances) },
          { icon: HardDrive, label: 'S3 buckets', value: String(infra.s3Buckets.length) },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded border border-[var(--sot-shell-strong-border)]/[0.07] bg-[var(--sot-shell-text)]/[0.02] p-3">
              <div className="flex items-center gap-1.5 text-[9px] font-mono text-[var(--sot-shell-muted)] uppercase tracking-wider mb-1.5">
                <Icon size={10} style={{ color: env.accent }} /> {s.label}
              </div>
              <div className="text-[15px] font-mono text-[var(--sot-shell-text)]">{s.value}</div>
            </div>
          );
        })}
      </div>

      <div className="px-6 pb-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="rounded border border-[var(--sot-shell-strong-border)]/[0.07] bg-[var(--sot-shell-text)]/[0.02] p-3">
          <div className="text-[9px] font-mono text-[var(--sot-shell-muted)] uppercase tracking-wider mb-2 flex items-center gap-1.5"><HardDrive size={10} style={{ color: env.accent }} /> S3 buckets</div>
          <div className="space-y-1">
            {infra.s3Buckets.map((b) => (
              <div key={b} className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-[var(--sot-shell-text)]">s3://{b}</span>
                <span className="flex items-center gap-1 text-[var(--sot-shell-muted)]"><span className="w-1.5 h-1.5 rounded-full bg-teal-400" /> sse-kms</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded border border-[var(--sot-shell-strong-border)]/[0.07] bg-[var(--sot-shell-text)]/[0.02] p-3 space-y-2">
          <div className="text-[9px] font-mono text-[var(--sot-shell-muted)] uppercase tracking-wider mb-1 flex items-center gap-1.5"><Server size={10} style={{ color: env.accent }} /> Compute & network</div>
          {[
            ['EC2 types', infra.ec2Types.join(' · ')],
            ['Batch queues', String(infra.batchQueues)],
            ['VPC', infra.vpc],
            ['KMS key', infra.kmsAlias],
            ['Data class', env.dataClass.replace('_', '-')],
            ['PII masking', env.piiMasked ? 'on' : 'off'],
            ['Writes', env.writesEnabled ? 'enabled' : 'disabled'],
            ['Reviewer co-sign', 'not simulated'],
            ['SLA tier', env.slaTier],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between text-[10px] font-mono">
              <span className="text-[var(--sot-shell-muted)]">{k}</span>
              <span className="text-[var(--sot-shell-text)]">{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// =====================================================================

function NotificationPreferenceControls() {
  const { preferences, setInformationalToasts, resetPreferences, pushToast } = useNotifications();
  return <>
    <FormRow label="Informational toasts" hint="Show brief confirmations and informational notices.">
      <Toggle label="Informational toasts" checked={preferences.informationalToasts} onChange={setInformationalToasts} />
      <p role="status" className="mt-2 text-[10px] text-[var(--sot-shell-secondary)]">{preferences.informationalToasts ? 'Informational toasts are on.' : 'Informational toasts are quiet. Turn them on to preview.'}</p>
    </FormRow>
    <p className="mt-3 text-[10px] text-[var(--sot-shell-muted)]">Warnings, errors, permission refusals and banners stay visible.</p>
    <div className="py-4 flex flex-wrap gap-2">
      <Button disabled={!preferences.informationalToasts} onClick={() => pushToast({ severity: 'info', title: 'Informational notice preview', message: 'This notice follows your notification preference.' })}>Preview informational toast</Button>
      <Button onClick={resetPreferences}>Reset notification preferences</Button>
    </div>
  </>;
}

function PreferencesPanel() {
  return (
    <section aria-label="Workspace preferences">
      <SectionHeader title="Preferences" subtitle="Changes apply immediately. Notification preferences last for this browser session." />
      <div className="px-6">
        <FormRow label="Appearance" hint="Use the same color mode across desktop and mobile. This browser remembers your choice.">
          <ThemeSelector />
        </FormRow>
        <NotificationPreferenceControls />
      </div>
    </section>
  );
}

// =====================================================================

function ConnectionsPanel() {
  const { pushToast, pushBanner } = useNotifications();
  return (
    <div>
      <SectionHeader title="Connections" subtitle="Example connections. Preview a notice; live connection checks are unavailable." />
      <div className="px-6 py-3 grid grid-cols-2 gap-3">
        {STORE.connections.map((c) => (
          <div key={c.id} className="border border-[var(--sot-shell-strong-border)]/[0.06] rounded p-3 bg-[var(--sot-shell-text)]/[0.02]">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${c.online ? 'bg-teal-400' : 'bg-rose-400'}`} />
                <span className="text-[11px] text-[var(--sot-shell-text)]">{c.label}</span>
              </div>
              <span className="text-[9px] font-mono text-[var(--sot-shell-muted)]">{c.vendor}</span>
            </div>
            <div className="text-[10px] text-[var(--sot-shell-muted)] leading-relaxed">{c.purpose}</div>
            <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
              <div className="flex items-center gap-1.5 text-[9px] font-mono text-[var(--sot-shell-muted)]">
                {c.online ? <CircleCheck size={10} className="text-teal-400" /> : <CircleX size={10} className="text-rose-400" />}
                {c.online ? 'example · online' : 'example · offline'}
                {c.authRequired && <span className="text-amber-400 ml-2">auth</span>}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Button onClick={() => {
                  pushToast({ severity: 'warning', title: 'Connection notice preview', message: `${c.label}: example ${c.online ? 'authentication-expired' : 'offline'} notice. Connection status and workflows are unchanged.` });
                }}>Preview connection notice</Button>
                {!c.online && (
                  <Button variant="danger" onClick={() => pushBanner({ severity: 'warning', title: 'Connection banner preview', message: `${c.label}: example offline notice. Connection status and workflows are unchanged.`, errorRef: c.id })}>
                    Preview banner
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// =====================================================================

function NotificationsPanel() {
  return (
    <section aria-label="Notification preferences">
      <SectionHeader title="Notification preferences" subtitle="Local notices follow this choice across the workspace for this browser session." />
      <div className="px-6">
        <NotificationPreferenceControls />
        <FormRow label="External delivery" hint="Local notifications remain available in this workspace.">
          <p className="text-[10px] text-[var(--sot-shell-secondary)]">Slack, email and mobile push delivery are unavailable.</p>
        </FormRow>
      </div>
    </section>
  );
}

// =====================================================================

function ErrorLabPanel() {
  const { pushFromError, pushBanner, pushToast, clearAll, preferences } = useNotifications();
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<NotificationKind>('toast');
  const [page, setPage] = useState(1);

  const filtered = useMemo(
    () => ERROR_LOG.filter((e) => matchesQuery(query, e.code, e.message, e.title, e.subjectId)),
    [query],
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function trigger(code: AppErrorCode) {
    const err = createError(code, SAMPLE_ERRORS[code]);
    pushFromError(err, kind);
  }

  return (
    <div>
      <SectionHeader
        title="Error Lab"
        subtitle="Manually fire any error code into the notification system. Use this to feel how each error behaves on screen."
      />

      {/* Trigger panel */}
      <div className="px-6 py-4 border-b border-[var(--sot-shell-strong-border)]/[0.06]">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <span className="text-[10px] font-mono text-[var(--sot-shell-muted)] uppercase">Channel:</span>
          {(['toast', 'banner'] as const).map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className="text-[10px] font-mono px-2 py-0.5 rounded border"
              style={{
                color: kind === k ? '#062b27' : 'var(--sot-shell-muted)',
                backgroundColor: kind === k ? '#2dd4bf' : 'transparent',
                borderColor: kind === k ? '#2dd4bf' : 'color-mix(in srgb, var(--sot-shell-strong-border) 18%, transparent)',
              }}
            >
              {k}
            </button>
          ))}
          <div className="ml-auto flex flex-wrap gap-2">
            <Button onClick={() => pushBanner({ severity: 'info', title: 'Heads up', message: 'This is a passive banner with workspace-wide context.' })}>raise info banner</Button>
            <Button disabled={!preferences.informationalToasts} onClick={() => pushToast({ severity: 'info', title: 'Success notice preview', message: 'This previews the success style; workspace preferences are unchanged.' })}>success toast</Button>
            <Button variant="danger" onClick={clearAll}>clear all</Button>
          </div>
        </div>

        {!preferences.informationalToasts && <p className="mb-3 text-[10px] text-[var(--sot-shell-muted)]">Informational toasts are quiet. Turn them on in Preferences to preview.</p>}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
          {ERROR_CODES.map((code) => (
            <button
              key={code}
              onClick={() => trigger(code)}
              className="text-left rounded border border-[var(--sot-shell-strong-border)]/[0.06] bg-[var(--sot-shell-text)]/[0.02] hover:bg-[var(--sot-shell-text)]/[0.05] p-2.5 transition-colors"
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Zap size={10} className="text-amber-400" />
                <span className="text-[10px] font-mono text-[var(--sot-shell-text)]">{code}</span>
              </div>
              <div className="text-[9px] text-[var(--sot-shell-muted)] leading-relaxed">{SAMPLE_ERRORS[code]}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Paginated error log */}
      <div className="px-6 py-4">
        <SearchField label="Find log entries" placeholder="Code, message or record" value={query} onChange={(value) => { setQuery(value); setPage(1); }} className="mb-3 max-w-sm" />
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] font-mono text-[var(--sot-shell-muted)] uppercase tracking-wider">
            Example error log · {filtered.length} entries
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => setPage((p) => Math.max(1, p - 1))}><ChevronLeft size={10} /></Button>
            <span className="text-[10px] font-mono text-[var(--sot-shell-muted)]">page {page} / {totalPages}</span>
            <Button onClick={() => setPage((p) => Math.min(totalPages, p + 1))}><ChevronRight size={10} /></Button>
            <Button variant="danger" disabled label="Clear example error log"><Trash2 size={10} /></Button>
          </div>
        </div>
        <p className="mb-2 text-[9px] text-[var(--sot-shell-muted)]">Example log entries remain available for inspection.</p>
        <div className="border border-[var(--sot-shell-strong-border)]/[0.06] rounded overflow-x-auto">
          <div className="min-w-[600px] grid grid-cols-[20px_125px_70px_minmax(190px,1fr)_80px] gap-2 px-3 py-1.5 bg-[var(--sot-shell-text)]/[0.03] text-[9px] font-mono text-[var(--sot-shell-muted)] uppercase tracking-wider">
            <span></span><span>Code</span><span>Severity</span><span>Message</span><span className="text-right">When</span>
          </div>
          {pageItems.map((e) => (
            <div key={e.id} className="min-w-[600px] grid grid-cols-[20px_125px_70px_minmax(190px,1fr)_80px] gap-2 px-3 py-1.5 border-t border-[var(--sot-shell-strong-border)]/[0.04] items-center text-[10px]">
              <SeverityIcon severity={e.severity} />
              <span className="font-mono text-[var(--sot-shell-text)] truncate">{e.code}</span>
              <span className="font-mono" style={{ color: SEVERITY_COLOR[e.severity] }}>{e.severity}</span>
              <span className="text-[var(--sot-shell-secondary)] truncate">{e.message}</span>
              <span className="font-mono text-[var(--sot-shell-muted)] text-right truncate">{new Date(e.timestamp).toLocaleTimeString()}</span>
            </div>
          ))}
          {pageItems.length === 0 && (
            <div className="px-3 py-6 text-center text-[10px] text-[var(--sot-shell-muted)]">No errors match this filter.</div>
          )}
        </div>
      </div>
    </div>
  );
}
