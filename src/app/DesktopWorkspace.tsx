import type { LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { GuideButton, GuideSlot, useGuide } from './components/guide/GuideProvider';
import { resolveRecordTarget } from './services/recordNavigation';
import type { CorridorReference, RecordRequest, RecordSection } from './services/recordNavigation';

import {
  Map, Database, List, FileCode2, GitCompare, BookMarked,
  Rocket, ChevronRight, Activity, Layers, UserCog, Presentation,
  ChevronDown, Lock, ShieldAlert, Server, Dna, ShieldCheck, Target, Binary,
} from 'lucide-react';
import { MapView } from './components/views/MapView';
import { SourcesView } from './components/views/SourcesView';
import { InstructionsView } from './components/views/InstructionsView';
import { ArtifactsView } from './components/views/ArtifactsView';
import { ComparisonsView } from './components/views/ComparisonsView';
import { DecisionsView } from './components/views/DecisionsView';
import { NextArcView } from './components/views/NextArcView';
import { LanesView } from './components/views/LanesView';
import { ProfileView } from './components/views/ProfileView';
import { PresentationsView } from './components/views/PresentationsView';
import { SpecimenView } from './components/views/SpecimenView';
import { QCView } from './components/views/QCView';
import { BiomarkerView } from './components/views/BiomarkerView';
import { BooleanBuilderView } from './components/views/BooleanBuilderView';
import { STORE } from './data';
import { useReleaseRecords } from './services/releaseWorkflowContext';
import { recordTitle } from './services/cartographyService';
import { SearchProvider, useSearch } from './services/search';
import { useEnvironment } from './services/environment';
import { ComparisonSessionProvider } from './services/comparisonSessionContext';
import { RecordSessionProvider } from './services/recordSessionContext';
import { PlateOverlayProvider } from './components/plate/plateOverlay';
import { PlateHistoryProvider } from './services/plateHistory/context';
import type { EnvironmentId } from './types/access';
import { ThemeSelector } from './theme/ThemeSelector';
import { useExplorationNavigation } from './services/exploration/ExplorationProvider';
import type { AppSection as NavSection } from './services/navigation/navigationUrl';
import { DeveloperDocsLink } from './components/DeveloperDocsLink';

interface NavItem {
  id: NavSection;
  label: string;
  icon: LucideIcon;
  count?: number;
  accent?: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'map', label: 'Map', icon: Map, accent: '#2dd4bf' },
  { id: 'lanes', label: 'Lanes', icon: Layers, accent: '#34d399', count: STORE.lanes.length },
  { id: 'specimens', label: 'Specimens', icon: Dna, accent: '#2dd4bf', count: STORE.specimens.length },
  { id: 'cohort', label: 'Cohort Builder', icon: Binary, accent: '#38bdf8' },
  { id: 'qc', label: 'Quality Control', icon: ShieldCheck, accent: '#34d399', count: STORE.qcGates.length },
  { id: 'biomarkers', label: 'Biomarkers', icon: Target, accent: '#f59e0b', count: STORE.biomarkers.length },
  { id: 'sources', label: 'Sources', icon: Database, count: STORE.sources.length },
  { id: 'instructions', label: 'Requirements', icon: List, count: 0, accent: '#f59e0b' },
  { id: 'artifacts', label: 'Artifacts', icon: FileCode2, count: STORE.artifacts.length },
  { id: 'comparisons', label: 'Comparisons', icon: GitCompare, count: STORE.comparisons.length },
  { id: 'decisions', label: 'Decisions', icon: BookMarked, count: STORE.decisions.length },
  { id: 'next-arc', label: 'Release plan', icon: Rocket, accent: '#38bdf8' },
  { id: 'presentations', label: 'Presentations', icon: Presentation, accent: '#FF5722', count: STORE.artifacts.length },
  { id: 'profile', label: 'Profile', icon: UserCog, accent: '#a78bfa' },
];

const SECTION_LABELS: Record<NavSection, string> = {
  map: 'Source Cartography Map',
  lanes: 'Lane Corridor Atlas',
  specimens: 'Specimen register',
  cohort: 'Cohort Builder · Boolean Specimen Rules',
  qc: 'Quality Control · Gates & Metrics',
  biomarkers: 'Biomarker Board · Actionability',
  sources: 'Source Registry',
  instructions: 'Requirements',
  artifacts: 'Artifact Gallery',
  comparisons: 'Comparison Engine',
  decisions: 'Decision Log',
  'next-arc': 'Release plan',
  presentations: 'Presentations · Scientific Defense Deck',
  profile: 'Profile · Preferences · Error Lab',
};

function Sidebar({
  active,
  onNavigate,
}: {
  active: NavSection;
  onNavigate: (s: NavSection) => void;
}) {
  const { requirements } = useReleaseRecords();
  const activeRequirements = requirements.filter(record => record.status === 'active').length;
  return (
    <div
      className="flex flex-col w-48 flex-shrink-0 border-r"
      style={{ backgroundColor: 'var(--sot-shell-inset)', borderColor: 'color-mix(in srgb, var(--sot-shell-strong-border) 8%, transparent)' }}
    >
      <div className="px-4 py-4 border-b" style={{ borderColor: 'color-mix(in srgb, var(--sot-shell-strong-border) 8%, transparent)' }}>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-5 h-5 rounded border border-teal-500/40 bg-teal-500/10 flex items-center justify-center">
            <Activity size={10} className="text-teal-400" />
          </div>
          <span
            className="text-[11px] font-medium tracking-tight"
            style={{ color: 'var(--sot-shell-text)', fontFamily: 'Playfair Display, serif' }}
          >
            Source of Truth
          </span>
        </div>
        <div className="text-[9px] font-mono text-[var(--sot-shell-muted)] leading-relaxed">
          for Life Sciences
        </div>
      </div>

      <div className="px-4 py-2.5 border-b" style={{ borderColor: 'color-mix(in srgb, var(--sot-shell-strong-border) 6%, transparent)' }}>
        <div className="text-[8px] font-mono text-[var(--sot-shell-muted)] uppercase tracking-wider mb-1">Current release</div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
          <span className="text-[10px] font-mono text-sky-400">Release 02 — Active</span>
        </div>
      </div>

      <nav className="flex-1 py-2 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className="w-full flex items-center gap-2.5 px-4 py-2 transition-all group"
              style={{
                backgroundColor: isActive ? 'rgba(56,189,248,0.08)' : 'transparent',
                borderLeft: isActive ? '2px solid #38bdf8' : '2px solid transparent',
              }}
            >
              <Icon size={13} className="flex-shrink-0 transition-colors"
                style={{ color: isActive ? (item.accent ?? 'var(--sot-status-info)') : 'var(--sot-shell-muted)' }} />
              <span className="flex-1 text-left text-[11px] font-mono transition-colors"
                style={{ color: isActive ? 'var(--sot-shell-text)' : 'var(--sot-shell-muted)' }}>
                {item.label}
              </span>
              {item.count !== undefined && (
                <span className="text-[9px] font-mono flex-shrink-0"
                  style={{ color: isActive ? 'var(--sot-shell-muted)' : 'var(--sot-shell-muted)' }}>
                  {item.id === 'instructions' ? activeRequirements : item.count}
                </span>
              )}
            </button>
          );
        })}
        <DeveloperDocsLink navigation />
      </nav>

      <div className="px-4 py-3 border-t" style={{ borderColor: 'color-mix(in srgb, var(--sot-shell-strong-border) 6%, transparent)' }}>
        <div className="space-y-1">
          <div className="flex justify-between">
            <span className="text-[8px] font-mono text-[var(--sot-shell-muted)]">Requirements</span>
            <span className="text-[8px] font-mono text-teal-400">
              {activeRequirements}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[8px] font-mono text-[var(--sot-shell-muted)]">Deferred</span>
            <span className="text-[8px] font-mono text-amber-400">
              {requirements.filter((i) => i.status === 'deferred').length}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[8px] font-mono text-[var(--sot-shell-muted)]">Lanes</span>
            <span className="text-[8px] font-mono text-[var(--sot-shell-muted)]">{STORE.lanes.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[8px] font-mono text-[var(--sot-shell-muted)]">Streams</span>
            <span className="text-[8px] font-mono text-[var(--sot-shell-muted)]">{STORE.streams.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function EnvSwitcher() {
  const { env, all, setEnv } = useEnvironment();
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-[9px] font-mono px-2 py-1 rounded border transition-colors"
        style={{ color: env.accent, borderColor: `color-mix(in srgb, ${env.accent} 26.667%, transparent)`, backgroundColor: `color-mix(in srgb, ${env.accent} 7.843%, transparent)` }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Server size={10} />
        <span className="uppercase tracking-wider" style={{ fontWeight: 600 }}>{env.label}</span>
        <span className="text-[var(--sot-shell-muted)]">·</span>
        <span className="text-[var(--sot-shell-muted)]">{env.infra.region}</span>
        {!env.writesEnabled && <Lock size={9} className="text-[var(--sot-shell-muted)]" />}
        <ChevronDown size={9} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-full mt-1.5 z-50 w-72 rounded border bg-[var(--sot-shell-background)] shadow-2xl"
            style={{ borderColor: 'color-mix(in srgb, var(--sot-shell-strong-border) 14%, transparent)' }}
            role="listbox"
          >
            <div className="px-3 py-2 border-b text-[8px] font-mono text-[var(--sot-shell-muted)] uppercase tracking-wider" style={{ borderColor: 'color-mix(in srgb, var(--sot-shell-strong-border) 8%, transparent)' }}>
              Environment scenario · example infrastructure & write policy
            </div>
            {all.map((e) => {
              const active = e.id === env.id;
              return (
                <button
                  key={e.id}
                  onClick={() => { setEnv(e.id as EnvironmentId); setOpen(false); }}
                  className="w-full text-left px-3 py-2 border-b transition-colors hover:bg-[var(--sot-shell-text)]/[0.03]"
                  style={{ borderColor: 'color-mix(in srgb, var(--sot-shell-strong-border) 5%, transparent)', backgroundColor: active ? `color-mix(in srgb, ${e.accent} 6.275%, transparent)` : 'transparent' }}
                  role="option"
                  aria-selected={active}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: e.accent, boxShadow: active ? `0 0 8px ${e.accent}` : 'none' }} />
                    <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: e.accent, fontWeight: 600 }}>{e.label}</span>
                    <span className="text-[10px] text-[var(--sot-shell-text)]">{e.longLabel}</span>
                    <span className="ml-auto text-[8px] font-mono px-1.5 py-0.5 rounded" style={{ color: 'var(--sot-shell-muted)', backgroundColor: 'color-mix(in srgb, var(--sot-shell-strong-border) 8%, transparent)' }}>
                      {e.dataClass.replace('_', '-')}
                    </span>
                  </div>
                  <div className="text-[9px] text-[var(--sot-shell-muted)] leading-relaxed mt-1 pl-4">{e.description}</div>
                  <div className="flex items-center gap-2 mt-1 pl-4 text-[8px] font-mono text-[var(--sot-shell-muted)]">
                    <span>{e.infra.region}</span>
                    <span>·</span>
                    <span>{e.infra.ec2Instances} EC2</span>
                    <span>·</span>
                    <span>{e.infra.s3Buckets.length} buckets</span>
                    <span>·</span>
                    <span style={{ color: e.writesEnabled ? 'var(--sot-status-success)' : 'var(--sot-status-danger)' }}>
                      {e.writesEnabled ? 'writes on' : 'read-only'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function TopBar({ section }: { section: NavSection }) {
  const { env } = useEnvironment();
  return (
    <div
      className="flex items-center gap-3 px-5 h-11 border-b flex-shrink-0"
      style={{ backgroundColor: 'var(--sot-shell-inset)', borderColor: 'color-mix(in srgb, var(--sot-shell-strong-border) 7%, transparent)', borderTop: `2px solid ${env.accent}` }}
    >
      <span className="text-[10px] font-mono text-[var(--sot-shell-muted)]">{SECTION_LABELS[section]}</span>

      <div className="ml-auto flex items-center gap-3">
        <GuideButton />
        <ThemeSelector />
        <div
          className="text-[9px] font-mono px-2 py-0.5 rounded border hidden xl:block"
          style={{ color: 'var(--sot-status-success)', borderColor: 'rgba(52,211,153,0.25)', backgroundColor: 'rgba(52,211,153,0.07)' }}
        >
          Readiness: {STORE.generationPacket.readinessScore}%
        </div>
        <EnvSwitcher />
        <div className="text-[9px] font-mono text-[var(--sot-shell-muted)]">2026-09-28</div>
      </div>
    </div>
  );
}

function EnvBanner() {
  const { env } = useEnvironment();
  if (!env.bannerText) return null;
  return (
    <div
      className="flex items-center gap-2 px-5 py-1.5 border-b flex-shrink-0"
      style={{ backgroundColor: `color-mix(in srgb, ${env.accent} 7.059%, transparent)`, borderColor: `color-mix(in srgb, ${env.accent} 18.824%, transparent)` }}
      role="status"
    >
      {env.writesEnabled ? (
        <ShieldAlert size={12} style={{ color: env.accent }} className="flex-shrink-0" />
      ) : (
        <Lock size={12} style={{ color: env.accent }} className="flex-shrink-0" />
      )}
      <span className="text-[10px] font-mono" style={{ color: env.accent }}>
        {env.longLabel}
      </span>
      <span className="text-[10px] text-[var(--sot-shell-secondary)]">{env.bannerText}</span>
      <span className="ml-auto text-[8px] font-mono text-[var(--sot-shell-muted)]">
        {env.infra.vpc} · {env.infra.kmsAlias} · SLA {env.slaTier}
      </span>
    </div>
  );
}

function Shell() {
  const { section: activeSection, selectSection: setActiveSection } = useExplorationNavigation();
  const { request } = useGuide();
  const { query, setQuery } = useSearch();
  const sequence = useRef(0);
  const [visit, setVisit] = useState<{
    reference: CorridorReference; request: RecordRequest; query: string; found: boolean;
  } | null>(null);
  useEffect(() => {
    if (!request) return;
    setVisit(null);
    setQuery('');
    setActiveSection('lanes');
  }, [request, setQuery]);

  useEffect(() => {
    // Browser history chooses a section, so a prior corridor visit relinquishes its local return rail.
    const clearVisit = () => {
      if (visit) setQuery(visit.query);
      setVisit(null);
    };
    window.addEventListener('popstate', clearVisit);
    return () => window.removeEventListener('popstate', clearVisit);
  }, [visit, setQuery]);

  const handleCrossNavigate = (reference: CorridorReference) => {
    const resolution = resolveRecordTarget(reference.target, STORE);
    if (resolution.status === 'unsupported') return;
    setVisit({ reference, request: { entityId: reference.target.entityId, sequence: ++sequence.current }, query, found: resolution.status === 'found' });
    setQuery('');
    setActiveSection(resolution.target.section);
  };
  const returnToCorridor = () => {
    if (visit) setQuery(visit.query);
    setActiveSection('lanes');
    setVisit(null);
  };
  const navigate = (section: NavSection) => {
    if (section === 'lanes' && visit) { returnToCorridor(); return; }
    setVisit(null);
    setActiveSection(section);
  };
  const requestFor = (section: RecordSection) => visit?.found && visit.reference.target.section === section ? visit.request : undefined;

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ backgroundColor: 'var(--sot-shell-background)', color: 'var(--sot-shell-text)', fontFamily: 'DM Sans, sans-serif' }}
    >
      <Sidebar active={activeSection} onNavigate={navigate} />
      <div className="flex flex-col flex-1 min-w-0">
        <TopBar section={activeSection} />
        <EnvBanner />
        <GuideSlot />
        {visit && (
          <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--sot-shell-strong-border)]/[0.06] text-[10px] font-mono">
            <button onClick={returnToCorridor} className="text-sky-300 hover:text-sky-200 underline underline-offset-2">
              ← Return to corridor · {visit.reference.origin.label}
            </button>
            <span className="text-[var(--sot-shell-muted)]" role="status">
              {visit.found ? recordTitle(visit.reference.target.section, visit.reference.target.entityId) : 'Record unavailable'}
            </span>
          </div>
        )}
        <main className="flex-1 min-h-0" style={{ backgroundColor: 'var(--sot-shell-background)' }}>
          {activeSection === 'map' && <MapView />}
          {(activeSection === 'lanes' || visit) && (
            <div hidden={activeSection !== 'lanes'} style={{ height: '100%', display: activeSection === 'lanes' ? undefined : 'none' }}>
              <LanesView active={activeSection === 'lanes'} onCrossNavigate={handleCrossNavigate} />
            </div>
          )}
          {activeSection === 'specimens' && <SpecimenView />}
          {activeSection === 'cohort' && <BooleanBuilderView />}
          {activeSection === 'qc' && <QCView />}
          {activeSection === 'biomarkers' && <BiomarkerView />}
          {activeSection === 'sources' && <SourcesView request={requestFor('sources')} />}
          {activeSection === 'instructions' && <InstructionsView request={requestFor('instructions')} />}
          {activeSection === 'artifacts' && <ArtifactsView request={requestFor('artifacts')} />}
          {activeSection === 'comparisons' && <ComparisonsView request={requestFor('comparisons')} />}
          {activeSection === 'decisions' && <DecisionsView request={requestFor('decisions')} />}
          {activeSection === 'next-arc' && <NextArcView />}
          {activeSection === 'presentations' && <PresentationsView />}
          {activeSection === 'profile' && <ProfileView />}
        </main>
      </div>
    </div>
  );
}

export default function DesktopWorkspace() {
  return (
    <SearchProvider>
      <ComparisonSessionProvider><RecordSessionProvider><PlateHistoryProvider><PlateOverlayProvider><Shell /></PlateOverlayProvider></PlateHistoryProvider></RecordSessionProvider></ComparisonSessionProvider>
    </SearchProvider>
  );
}
