import React, { useState } from 'react';
import {
  ArrowRight,
  BrainCircuit,
  FileText,
  FolderPlus,
  Search,
  Sparkles,
} from 'lucide-react';
import { useLoopframe } from '../context/LoopframeContext';

export const ProjectsHomePage: React.FC = () => {
  const { state, navigate } = useLoopframe();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const activeRules = state.preferences.filter(
    (r) => r.status === 'active' && r.confirmed_by_user
  );
  const pendingConfirmations = state.projects.flatMap((p) =>
    p.feedback_events.filter(
      (fe) => fe.confirmation_status === 'pending_confirmation'
    )
  );

  const sampleProject = state.projects.find(
    (p) => p.project_id === 'proj-sample-01'
  );

  const filteredProjects = state.projects.filter((proj) => {
    const matchesSearch =
      !searchQuery.trim() ||
      proj.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      proj.source_type.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === 'all' || proj.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* 1. Page Title and One Clear Primary Action */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200/90 pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
            <span>WORKSPACE</span>
            <span aria-hidden="true">·</span>
            <span>TRANSCRIPT-FIRST P0</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Projects
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 max-w-2xl">
            Review transcript-grounded clip candidates, verify surrounding
            source context, and test whether generated copy obeys your confirmed
            editorial rules.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => navigate('/welcome')}
            className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors cursor-pointer"
          >
            Onboarding Guide
          </button>
          <button
            type="button"
            onClick={() => navigate('/projects/new')}
            className="px-4 py-2.5 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs sm:text-sm font-semibold transition-colors flex items-center gap-2 cursor-pointer"
          >
            <FolderPlus className="w-4 h-4" />
            <span>New project</span>
          </button>
        </div>
      </div>

      {/* Visually Distinct "Open Sample Project" Card */}
      {sampleProject && (
        <div className="bg-white rounded-2xl border border-slate-300/90 p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5 shadow-2xs">
          <div className="space-y-2 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-600">
              <span className="font-semibold text-[#0D9488]">
                SEEDED SAMPLE PROJECT
              </span>
              <span aria-hidden="true">·</span>
              <span>DEMO DATA</span>
              <span aria-hidden="true">·</span>
              <span>{sampleProject.segments.length} SEGMENTS</span>
              <span aria-hidden="true">·</span>
              <span>{sampleProject.candidates.length} CANDIDATES</span>
            </div>
            <h2 className="text-lg font-bold text-slate-900">
              {sampleProject.name}
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Includes 3 initial candidates: (1) an exaggerated hook with a
              pending rule proposal awaiting confirmation, (2) a missing
              qualification warning where segment seg-08 starts with “However…”,
              and (3) a self-contained acceptable candidate.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => navigate('/projects/proj-sample-01')}
              className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
            >
              <span>Open sample project</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 2. Recent Projects + Search/Filter */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-base font-bold text-slate-900">
              All Transcript Projects ({filteredProjects.length})
            </h2>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  aria-label="Search projects by name"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search projects..."
                  className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                />
              </div>

              <div
                role="group"
                aria-label="Filter projects by status"
                className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl"
              >
                {(['all', 'In review', 'Rules verified', 'Ready to export'] as const).map(
                  (st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStatusFilter(st)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                        statusFilter === st
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {st === 'all' ? 'All' : st}
                    </button>
                  )
                )}
              </div>
            </div>
          </div>

          {filteredProjects.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
              <FileText className="w-7 h-7 text-slate-400 mx-auto" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-900">
                  No matching transcript projects found
                </p>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Create a new project from a pasted timestamped transcript or
                  clear your active search filter.
                </p>
              </div>
              <div className="flex items-center justify-center gap-3 pt-2">
                {searchQuery || statusFilter !== 'all' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setStatusFilter('all');
                    }}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Clear Filters
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => navigate('/projects/new')}
                  className="px-4 py-2 rounded-xl bg-[#0D9488] text-white text-xs font-semibold hover:bg-[#0F766E]"
                >
                  Create New Project
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredProjects.map((proj) => {
                const approvedCount = proj.candidates.filter(
                  (c) => c.review_status === 'Approved'
                ).length;
                const flaggedCount = proj.candidates.filter(
                  (c) =>
                    c.context_status === 'Review recommended' ||
                    c.review_status === 'Flagged for context review'
                ).length;

                return (
                  <div
                    key={proj.project_id}
                    className="bg-white rounded-2xl border border-slate-200/90 hover:border-slate-300 p-5 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-mono tabular-nums">
                        <span>{proj.source_type}</span>
                        <span aria-hidden="true">·</span>
                        <span>{proj.generation_mode}</span>
                        <span aria-hidden="true">·</span>
                        <span>
                          Updated{' '}
                          {new Date(proj.updated_at).toLocaleDateString(
                            undefined,
                            {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            }
                          )}
                        </span>
                      </div>

                      <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                        {proj.name}
                      </h3>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 tabular-nums">
                        <span>{proj.candidates.length} candidates</span>
                        <span aria-hidden="true">·</span>
                        <span>{proj.segments.length} transcript segments</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-medium text-slate-800">
                          Status: {proj.status}
                        </span>
                        {approvedCount > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-emerald-700 font-medium">
                              {approvedCount} approved
                            </span>
                          </>
                        )}
                        {flaggedCount > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-amber-700 font-medium">
                              {flaggedCount} flagged for context review
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0">
                      <button
                        type="button"
                        onClick={() => navigate(`/projects/${proj.project_id}`)}
                        className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-900 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <span>Open Studio</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: 3. Compact "Memory rules active" summary & 4. Helpful next-step panel */}
        <div className="space-y-5">
          {/* 3. Compact "Memory rules active" summary */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BrainCircuit className="w-4 h-4 text-violet-600" />
                <h2 className="text-sm font-bold text-slate-900">
                  Memory Rules Active
                </h2>
              </div>
              <span className="font-mono text-xs font-semibold text-slate-900 tabular-nums">
                {activeRules.length} confirmed
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Confirmed rules are injected into future candidate generation and
              verified with deterministic post-generation tests.
            </p>

            <div className="space-y-2 pt-1 border-t border-slate-100">
              {activeRules.slice(0, 3).map((rule) => (
                <div
                  key={rule.rule_id}
                  className="text-xs py-1.5 border-b border-slate-100 last:border-b-0"
                >
                  <div className="flex items-center justify-between font-mono text-[11px] text-slate-500">
                    <span>{rule.rule_type}</span>
                    <span>Scope: {rule.scope}</span>
                  </div>
                  <p className="text-slate-800 mt-0.5 line-clamp-2">
                    {rule.human_readable_description}
                  </p>
                </div>
              ))}
            </div>

            {pendingConfirmations.length > 0 && (
              <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200/80 text-xs text-amber-900 space-y-1">
                <p className="font-semibold">
                  {pendingConfirmations.length} Rule Proposal Awaiting
                  Confirmation
                </p>
                <p className="text-[11px] text-amber-800">
                  Open Project Studio to confirm or edit the proposed rule from
                  recent creator feedback.
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => navigate('/memory')}
              className="w-full py-2 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-800 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>Inspect Preference Ledger</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 4. Helpful Next-Step Panel */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#0D9488]" />
              <h2 className="text-sm font-bold text-slate-900">
                Recommended Next Steps
              </h2>
            </div>

            <ol className="text-xs text-slate-600 space-y-2.5 list-decimal list-inside leading-relaxed">
              <li>
                Open{' '}
                <button
                  type="button"
                  onClick={() => navigate('/projects/proj-sample-01')}
                  className="font-semibold text-[#0D9488] hover:underline"
                >
                  Ep. 42 Sample Studio
                </button>{' '}
                and inspect Candidate 1’s exaggerated hook.
              </li>
              <li>
                Confirm the proposed{' '}
                <span className="font-mono text-[11px] text-slate-800">
                  AVOID_EXAGGERATED_HOOKS
                </span>{' '}
                rule in the right-hand review panel.
              </li>
              <li>
                Click <strong>Regenerate with Active Rules</strong> and verify
                the deterministic rule test receipt.
              </li>
              <li>
                Inspect Candidate 2’s missing qualification warning and expand
                the clip to include segment{' '}
                <span className="font-mono text-[11px]">seg-08</span>.
              </li>
              <li>
                Approve a verified candidate and export copy & timecodes in{' '}
                <button
                  type="button"
                  onClick={() => navigate('/library')}
                  className="font-semibold text-[#0D9488] hover:underline"
                >
                  Library
                </button>
                .
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};
