import { SourceMetadataEditor } from '../SourceMetadataEditor';
import { SourceWorkspaceControls, SourceWorkspaceHistory } from '../SourceWorkspaceControls';
import { useSourceEditor, useSourceRegistry, useSourceSession } from '../../services/sourceSessionContext';
import { useRecordReveal } from '../useRecordReveal';
import type { RecordRequest } from '../../services/recordNavigation';
import { ExternalLink, TrendingUp, RefreshCw, Pencil } from 'lucide-react';
import { STORE } from '../../data';
import { sourceTypeLabel, sourceRoleLabel, authorityDomainLabel, referenceTitle } from '../../services/cartographyService';
import {
  SourceStatusBadge, SourceRoleBadge, SourceTypeBadge,
} from '../StatusBadge';
import { ScrollArea } from '../ui/scroll-area';
import { SearchField } from '../SearchField';
import { matchesQuery } from '../../services/search';
import './sources-view.css';
import { useEnvironment } from '../../services/environment';
import { getRole } from '../../services/accessService';
import { usePermissionScenario } from '../../services/permissionScenario';
import type { Source, SourceType, AuthorityDomain } from '../../types';

const TYPE_FILTERS: Array<{ value: SourceType | 'all'; label: string }> = [
  { value: 'all', label: 'All Sources' },
  { value: 'notion_page', label: 'S3 Doc' },
  { value: 'uploaded_file', label: 'Uploaded' },
  { value: 'generated_svg', label: 'Generated SVG' },
  { value: 'scientific_ref', label: 'Scientific' },
  { value: 'planning_page', label: 'Planning' },
  { value: 'yaml_manifest', label: 'YAML' },
];

function ConfidenceBar({ score }: { score: number }) {
  const color = score >= 90 ? 'var(--sot-status-success)' : score >= 75 ? 'var(--sot-status-warning)' : 'var(--sot-status-danger)';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 rounded-full bg-[var(--sot-shell-text)]/[0.08]">
        <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, backgroundColor: color }} />
      </div>
      <span className="text-[9px] font-mono" style={{ color }}>{score}%</span>
    </div>
  );
}

function AuthorityPill({ domain, type }: { domain: AuthorityDomain; type: 'trust' | 'not' }) {
  return (
    <span
      className={`inline-block text-[9px] font-mono px-1.5 py-0.5 rounded border ${
        type === 'trust'
          ? 'bg-teal-500/10 text-teal-400 border-teal-500/20'
          : 'bg-red-500/10 text-red-400/70 border-red-500/15 line-through'
      }`}
    >
      {authorityDomainLabel(domain)}
    </span>
  );
}

function SourceCard({ source, isSelected, onClick }: { source: Source; isSelected: boolean; onClick: () => void }) {
  return (
    <button
      data-record-id={source.id}
      aria-pressed={isSelected}
      onClick={onClick}
      className={`w-full text-left rounded border p-3.5 transition-all ${
        isSelected
          ? 'border-sky-500/40 bg-sky-500/10'
          : 'border-[var(--sot-shell-strong-border)]/[0.06] bg-[var(--sot-shell-text)]/[0.02] hover:bg-[var(--sot-shell-text)]/[0.04]'
      }`}
    >
      <div className="flex items-start gap-2 mb-2">
        <div className="sources-view__details min-w-0 min-h-0">
          <div className="text-[11px] font-medium text-[var(--sot-shell-text)] leading-snug line-clamp-2">{source.title}</div>
          <div className="text-[9px] font-mono text-[var(--sot-shell-muted)] mt-0.5">{sourceTypeLabel(source.type)}</div>
        </div>
        <SourceStatusBadge status={source.status} className="flex-shrink-0" />
      </div>
      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        <SourceTypeBadge type={source.type} />
        <SourceRoleBadge role={source.role} />
      </div>
      <ConfidenceBar score={source.confidenceScore} />
      <div className="text-[9px] text-[var(--sot-shell-muted)] mt-1.5 flex flex-wrap gap-1.5 items-center justify-between">
        <span>Source updated {source.lastUpdated}</span>
        <div className="flex flex-wrap gap-1">
          {source.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="px-1 py-0.5 rounded bg-[var(--sot-shell-text)]/[0.04] border border-[var(--sot-shell-strong-border)]/[0.06] text-[8px] font-mono">{tag}</span>
          ))}
        </div>
      </div>
    </button>
  );
}

export function SourcesView({ request }: { request?: RecordRequest } = {}) {
  const { state: registry, update } = useSourceRegistry();
  const { filter, query, selectedId } = registry;
  const { state, commands, records: sources, workspace, scopeKey, retry, start, reset, history } = useSourceSession();
  const { owner: editor, state: editorState } = useSourceEditor();
  const { activeId: editingId, generation, notice } = editorState;
  const namespace = `${workspace.generation}:${workspace.workspace?.id ?? "local"}`;
  const setFilter = (filter: SourceType | "all") =>
    update((current) => ({ ...current, filter }));
  const setQuery = (query: string) =>
    update((current) => ({ ...current, query }));
  const selectSource = (id: string | null) => {
    update((current) => ({ ...current, selectedId: id }));
    editor.hide();
  };
  const root = useRecordReveal(request, (id) => {
    setFilter('all'); setQuery('');
    selectSource(sources.some((record) => record.id === id) ? id : null);
  });

  const { env } = useEnvironment();
  const { roleId } = usePermissionScenario();
  const role = getRole(roleId);
  const filteredSources = sources.filter((source) =>
    (filter === 'all' || source.type === filter) &&
    matchesQuery(query, source.title, source.id, source.description, sourceTypeLabel(source.type), sourceRoleLabel(source.role), ...source.tags),
  );

  const selectedSource = sources.find((source) => source.id === selectedId);
  const selectedEntry = selectedSource ? state.byId[selectedSource.id] : undefined;

  return (
    <section ref={root} className="sources-view flex flex-col h-full min-h-0 min-w-0" aria-label="Source registry">
      {/* Posture line */}
      <div className="flex items-center justify-end gap-1.5 px-4 py-1.5 border-b border-[var(--sot-shell-strong-border)]/[0.06] flex-shrink-0">
        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border" style={{ color: env.accent, borderColor: `color-mix(in srgb, ${env.accent} 33.333%, transparent)` }}>{env.label}</span>
        <span className="text-[9px] font-mono text-[var(--sot-shell-muted)]">·</span>
        <span className="text-[9px] font-mono text-[var(--sot-shell-muted)]">{role.label}</span>
        <span className="text-[9px] font-mono text-[var(--sot-shell-muted)]">·</span>
        <span className="text-[9px] font-mono text-[var(--sot-shell-muted)]">{workspace.phase === "local" ? "session metadata" : "visitor workspace"}</span>
      </div>

      <SourceWorkspaceControls status={workspace} onRetry={retry} onStart={start} onReset={reset} />
      <div className="sources-view__workspace">
      {/* Left: source list */}
      <div className="sources-view__list border-r border-[var(--sot-shell-strong-border)]/[0.06]">
        <div className="p-3 border-b border-[var(--sot-shell-strong-border)]/[0.06] shrink-0">
          <SearchField label="Find sources" placeholder="Search sources..." value={query} onChange={setQuery} />
        </div>

        {/* Filters */}
        <div role="group" aria-label="Source type" className="flex flex-wrap shrink-0 gap-1 p-2 border-b border-[var(--sot-shell-strong-border)]/[0.06]">
          {TYPE_FILTERS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
              className={`flex-shrink-0 px-2.5 py-1 rounded text-[10px] font-mono transition-colors ${
                filter === value
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                  : 'text-[var(--sot-shell-muted)] hover:text-[var(--sot-shell-muted)] border border-transparent'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="shrink-0 px-3 py-1.5 border-b border-[var(--sot-shell-strong-border)]/[0.05]">
          <span className="text-[9px] font-mono text-[var(--sot-shell-muted)]">{filteredSources.length} of {sources.length} sources</span>
        </div>

        <ScrollArea className="sources-view__scroll flex-1 min-h-0 min-w-0">
          <div className="p-2 space-y-2">
            {filteredSources.length === 0 && <p role="status" className="p-3 text-[11px] text-[var(--sot-shell-muted)]">No sources match. Try another term or source type.</p>}
            {filteredSources.map((source) => (
              <SourceCard
                key={source.id}
                source={source}
                isSelected={selectedId === source.id}
                onClick={() => selectSource(selectedId === source.id ? null : source.id)}
              />
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Right: detail panel */}
      <div className="flex-1 min-w-0">
        {selectedSource && selectedEntry ? (
          <ScrollArea className="sources-view__scroll h-full" aria-label="Source details">
            <div className="sources-view__record">
              {/* Header */}
              <div className="flex items-start gap-3 mb-5">
                <div className="flex-1 min-w-0">
                  <h2 className="text-[15px] font-medium text-[var(--sot-shell-text)] leading-snug">{selectedSource.title}</h2>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className="text-[10px] font-mono text-[var(--sot-shell-muted)]">Source updated {selectedSource.lastUpdated}</span>
                    <span className="text-[10px] text-[var(--sot-shell-muted)]">·</span>
                    <span className="text-[10px] text-[var(--sot-shell-muted)]">{sourceTypeLabel(selectedSource.type)}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <SourceStatusBadge status={selectedSource.status} />
                  <SourceRoleBadge role={selectedSource.role} />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 mb-5">
                <button
                  className="sources-view__action"
                  disabled={workspace.busy || workspace.phase === "checking"}
                  onClick={async () => {
                    const submittedEditor = generation;
                    const result = await commands.execute({
                      type: "restore",
                      id: selectedSource.id,
                      revision: selectedEntry.revision,
                    });
                    const message =
                      result.ok
                        ? result.changed
                          ? workspace.phase === "local" ? "Bundled source restored for this session." : "Bundled source restored in this workspace."
                          : "Bundled source is already current."
                        : result.reason;
                    if (result.ok) editor.finish(selectedSource.id, submittedEditor, message);
                    else editor.notify(submittedEditor, message);
                  }}
                >
                  <RefreshCw size={10} /> Restore bundled source
                </button>
                <button
                  aria-expanded={editingId === selectedSource.id}
                  disabled={workspace.busy || workspace.phase === "checking"}
                  className="sources-view__action"
                  onClick={() => {
                    if (editingId === selectedSource.id) editor.hide();
                    else editor.open(selectedEntry, namespace);
                  }}
                >
                  <Pencil size={10} /> Edit metadata
                </button>
                <span className="text-[10px] text-[var(--sot-shell-muted)]">
                  Bundled example · external refresh unavailable
                </span>
              </div>

              {notice && (
                <p role="status" className="sources-view__notice">
                  {notice}
                </p>
              )}
              {selectedEntry && editingId === selectedSource.id && editorState.drafts.has(selectedSource.id) && (
                <SourceMetadataEditor
                  key={selectedSource.id}
                  entry={selectedEntry}
                  scopeKey={namespace}
                  draft={editorState.drafts.get(selectedSource.id)!}
                  onChange={patch => editor.edit(selectedSource.id, generation, patch)}
                  onRebase={(scope, revision) => editor.rebase(selectedSource.id, generation, scope, revision)}
                  busy={workspace.busy || workspace.phase === "checking"}
                  persistence={workspace.phase === "local" ? "local" : "workspace"}
                  onCancel={() => editor.finish(selectedSource.id, generation)}
                  onSave={async (metadata, revision) => {
                    const submittedEditor = generation;
                    const result = await commands.execute({
                      type: "edit",
                      id: selectedSource.id,
                      revision,
                      metadata,
                    });
                    if (result.ok) {
                      editor.finish(selectedSource.id, submittedEditor,
                        result.changed
                          ? workspace.phase === "local" ? "Metadata saved for this browser session." : "Metadata saved in your visitor workspace."
                          : "Metadata is already current.",
                      );
                    }
                    return result;
                  }}
                />
              )}

              <SourceWorkspaceHistory sourceId={selectedSource.id} status={workspace} scopeKey={scopeKey} read={history} />
              {/* Description */}
              <div className="p-3 rounded border border-[var(--sot-shell-strong-border)]/[0.06] bg-[var(--sot-shell-text)]/[0.02] mb-5">
                <p className="text-[11px] text-[var(--sot-shell-secondary)] leading-relaxed">{selectedSource.description}</p>
              </div>

              {/* Confidence */}
              <div className="mb-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono text-[var(--sot-shell-muted)] uppercase tracking-wider">Confidence Score</span>
                  <div className="flex items-center gap-1">
                    <TrendingUp size={10} className="text-[var(--sot-shell-muted)]" />
                    <span className="text-[10px] font-mono text-[var(--sot-shell-text)]">{selectedSource.confidenceScore} / 100</span>
                  </div>
                </div>
                <ConfidenceBar score={selectedSource.confidenceScore} />
              </div>

              {/* Authority matrix */}
              <div className="mb-5">
                <div className="text-[10px] font-mono text-[var(--sot-shell-muted)] uppercase tracking-wider mb-2.5">Authority Matrix</div>
                <div className="sources-view__authority">
                  <div className="p-3 rounded border border-teal-500/20 bg-teal-500/5">
                    <div className="text-[9px] font-mono text-teal-400 mb-2 uppercase tracking-wider">Authoritative for</div>
                    <div className="flex flex-wrap gap-1">
                      {selectedSource.trustScope.map((d) => (
                        <AuthorityPill key={d} domain={d} type="trust" />
                      ))}
                    </div>
                  </div>
                  <div className="p-3 rounded border border-red-500/15 bg-red-500/5">
                    <div className="text-[9px] font-mono text-red-400/70 mb-2 uppercase tracking-wider">Not authoritative for</div>
                    <div className="flex flex-wrap gap-1">
                      {selectedSource.notAuthoritativeFor.map((d) => (
                        <AuthorityPill key={d} domain={d} type="not" />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Relationships */}
              <div className="mb-5">
                <div className="text-[10px] font-mono text-[var(--sot-shell-muted)] uppercase tracking-wider mb-2.5">Relationships</div>
                <div className="space-y-1.5">
                  {STORE.relationships
                    .filter((r) => r.fromId === selectedSource.id || r.toId === selectedSource.id)
                    .map((rel) => {
                      const isFrom = rel.fromId === selectedSource.id;
                      const otherId = isFrom ? rel.toId : rel.fromId;
                      return (
                        <div key={rel.id} className="sources-view__relationship text-[10px]">
                          <span className="font-mono text-[var(--sot-shell-muted)]">{isFrom ? '→' : '←'}</span>
                          <span className="px-1.5 py-0.5 rounded border border-[var(--sot-shell-strong-border)]/[0.08] font-mono text-sky-400 bg-sky-500/10 text-[9px]">{rel.type}</span>
                          <span className="font-mono text-[var(--sot-shell-secondary)]">{sources.find(source => source.id === otherId)?.title ?? referenceTitle(otherId)}</span>
                          <span className="sources-view__relationship-note text-[var(--sot-shell-muted)]">{rel.description}</span>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Tags */}
              <div>
                <div className="text-[10px] font-mono text-[var(--sot-shell-muted)] uppercase tracking-wider mb-2">Tags</div>
                <div className="flex flex-wrap gap-1">
                  {selectedSource.tags.map((tag) => (
                    <span key={tag} className="text-[10px] font-mono px-2 py-0.5 rounded border border-[var(--sot-shell-strong-border)]/[0.08] text-[var(--sot-shell-muted)] bg-[var(--sot-shell-text)]/[0.02]">{tag}</span>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="text-[#1e2d45] mb-3">
              <ExternalLink size={40} />
            </div>
            <div className="text-[12px] text-[var(--sot-shell-muted)] font-mono">Select a source to inspect its authority matrix and relationships</div>
          </div>
        )}
      </div>
      </div>
    </section>
  );
}
