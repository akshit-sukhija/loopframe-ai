import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  Edit3,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { useLoopframe } from '../context/LoopframeContext';
import {
  CLOSED_RULE_TAXONOMY,
  runDeterministicRuleTest,
} from '../lib/ruleEngine';
import { PreferenceRule, RuleScope, RuleType } from '../types/loopframe';

export const MemoryPage: React.FC = () => {
  const {
    state,
    updatePreferenceRule,
    deletePreferenceRule,
    undoDeletePreferenceRule,
    addToast,
  } = useLoopframe();

  const [activeTab, setActiveTab] = useState<'ledger' | 'evaluation'>('ledger');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'active' | 'paused' | 'deleted'
  >('active');
  const [scopeFilter, setScopeFilter] = useState<'all' | RuleScope>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Rule Editor Modal State
  const [editingRule, setEditingRule] = useState<PreferenceRule | null>(null);
  const [draftDesc, setDraftDesc] = useState('');
  const [draftScope, setDraftScope] = useState<RuleScope>('project');
  const [draftTerms, setDraftTerms] = useState('');
  const [draftMaxWords, setDraftMaxWords] = useState<number>(12);
  const [draftTopicPhrase, setDraftTopicPhrase] = useState('');

  // Delete confirmation modal state
  const [ruleToDelete, setRuleToDelete] = useState<PreferenceRule | null>(null);

  // Create explicit rule modal state
  const [createRuleOpen, setCreateRuleOpen] = useState(false);
  const [newRuleType, setNewRuleType] = useState<RuleType>(
    'AVOID_EXAGGERATED_HOOKS'
  );
  const [newRuleScope, setNewRuleScope] = useState<RuleScope>('project');
  const [newRuleDesc, setNewRuleDesc] = useState(
    CLOSED_RULE_TAXONOMY[0].defaultDescription
  );

  // Evaluation filter state
  const [evalRuleFilter, setEvalRuleFilter] = useState<string>('ALL');

  const filteredRules = useMemo(() => {
    return state.preferences.filter((rule) => {
      if (statusFilter !== 'all' && rule.status !== statusFilter) return false;
      if (scopeFilter !== 'all' && rule.scope !== scopeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesDesc = rule.human_readable_description
          .toLowerCase()
          .includes(q);
        const matchesType = rule.rule_type.toLowerCase().includes(q);
        const matchesFeedback = rule.source_feedback_text
          .toLowerCase()
          .includes(q);
        return matchesDesc || matchesType || matchesFeedback;
      }
      return true;
    });
  }, [state.preferences, statusFilter, scopeFilter, searchQuery]);

  const openEditModal = (rule: PreferenceRule) => {
    setEditingRule(rule);
    setDraftDesc(rule.human_readable_description);
    setDraftScope(rule.scope);
    setDraftTerms(
      (
        rule.rule_parameters.forbiddenTerms ||
        rule.rule_parameters.jargonTerms ||
        rule.rule_parameters.requiredQualifications ||
        []
      ).join(', ')
    );
    setDraftMaxWords(rule.rule_parameters.maxWords ?? 12);
    setDraftTopicPhrase(rule.rule_parameters.requiredTopicPhrase ?? '');
  };

  const handleSaveRuleEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRule) return;

    const termsList = draftTerms
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const updatedParams = { ...editingRule.rule_parameters };
    if (
      editingRule.rule_type === 'AVOID_EXAGGERATED_HOOKS' ||
      editingRule.rule_type === 'AVOID_CLICKBAIT' ||
      editingRule.rule_type === 'AVOID_UNSUPPORTED_CLAIMS'
    ) {
      updatedParams.forbiddenTerms = termsList;
    } else if (editingRule.rule_type === 'AVOID_JARGON') {
      updatedParams.jargonTerms = termsList;
    } else if (editingRule.rule_type === 'PRESERVE_QUALIFICATIONS') {
      updatedParams.requiredQualifications = termsList;
    }
    if (editingRule.rule_type === 'PREFER_CONCISE_HOOKS') {
      updatedParams.maxWords = Math.max(4, Math.min(30, Number(draftMaxWords)));
    }
    if (editingRule.rule_type === 'INCLUDE_CLEAR_TOPIC') {
      updatedParams.requiredTopicPhrase = draftTopicPhrase.trim();
    }

    updatePreferenceRule(editingRule.rule_id, {
      human_readable_description: draftDesc.trim(),
      scope: draftScope,
      scope_reference:
        draftScope === 'global'
          ? 'all'
          : draftScope === 'platform'
          ? 'instagram_reels'
          : state.projects[0]?.project_id || 'proj-sample-01',
      rule_parameters: updatedParams,
      confirmed_by_user: true,
    });
    setEditingRule(null);
  };

  const handleCreateExplicitRule = (e: React.FormEvent) => {
    e.preventDefault();
    const tax =
      CLOSED_RULE_TAXONOMY.find((t) => t.type === newRuleType) ??
      CLOSED_RULE_TAXONOMY[0];
    const now = new Date().toISOString();
    const newRule: PreferenceRule = {
      rule_id: `rule-${Date.now().toString(36)}`,
      rule_type: newRuleType,
      human_readable_description:
        newRuleDesc.trim() || tax.defaultDescription,
      scope: newRuleScope,
      scope_reference:
        newRuleScope === 'global'
          ? 'all'
          : newRuleScope === 'platform'
          ? 'instagram_reels'
          : state.projects[0]?.project_id || 'proj-sample-01',
      source_feedback_id: `fb-manual-${Date.now().toString(36)}`,
      source_feedback_text: 'Created explicitly in Memory Preference Ledger.',
      created_at: now,
      updated_at: now,
      status: 'active',
      confirmed_by_user: true,
      rule_parameters: { ...tax.defaultParameters },
    };

    // Confirm directly via context
    updatePreferenceRule(newRule.rule_id, newRule);
    // Also insert if not existing
    window.localStorage.setItem(
      'loopframe_v4_store_v1',
      JSON.stringify({
        ...state,
        preferences: [newRule, ...state.preferences],
      })
    );
    window.location.reload();
  };

  // Compute exact counts from the 24-case small prototype evaluation dataset
  const evalMetrics = useMemo(() => {
    const cases = state.evaluationCases;
    const total = cases.length;
    const mappedCorrectly = cases.filter(
      (c) => c.feedback_mapped_correctly
    ).length;
    const confirmedCount = cases.filter((c) => c.user_confirmed_rule).length;
    const passedRuleTest = cases.filter(
      (c) => c.actual_test_outcome === 'Pass'
    ).length;
    const failedRuleTest = cases.filter(
      (c) => c.actual_test_outcome === 'Fail'
    ).length;
    const advisoryCount = cases.filter(
      (c) => c.actual_test_outcome === 'Advisory'
    ).length;
    const falsePositives = cases.filter((c) => c.is_false_positive).length;
    const falseNegatives = cases.filter((c) => c.is_false_negative).length;
    const meaningPreserved = cases.filter(
      (c) => c.source_meaning_preserved
    ).length;
    const negativeCases = cases.filter((c) => c.is_negative_case).length;

    return {
      total,
      mappedCorrectly,
      confirmedCount,
      passedRuleTest,
      failedRuleTest,
      advisoryCount,
      falsePositives,
      falseNegatives,
      meaningPreserved,
      negativeCases,
    };
  }, [state.evaluationCases]);

  const filteredEvalCases = useMemo(() => {
    if (evalRuleFilter === 'ALL') return state.evaluationCases;
    if (evalRuleFilter === 'NEGATIVE') {
      return state.evaluationCases.filter((c) => c.is_negative_case);
    }
    if (evalRuleFilter === 'FP_FN') {
      return state.evaluationCases.filter(
        (c) => c.is_false_positive || c.is_false_negative
      );
    }
    return state.evaluationCases.filter((c) => c.rule_type === evalRuleFilter);
  }, [state.evaluationCases, evalRuleFilter]);

  const handleRunLiveDeterministicSuite = () => {
    let verifiedCount = 0;
    state.evaluationCases.forEach((tc) => {
      const dummyRule: PreferenceRule = {
        rule_id: tc.case_id,
        rule_type: tc.rule_type,
        human_readable_description: tc.title,
        scope: 'project',
        scope_reference: 'eval',
        source_feedback_id: tc.case_id,
        source_feedback_text: tc.creator_feedback,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'active',
        confirmed_by_user: tc.user_confirmed_rule,
        rule_parameters: tc.rule_parameters,
      };
      const res = runDeterministicRuleTest({
        rule: dummyRule,
        hook: tc.regenerated_hook_after,
        caption: tc.regenerated_caption_after,
        sourceExcerpt: tc.source_excerpt,
      });
      if (res.outcome === tc.actual_test_outcome) {
        verifiedCount += 1;
      }
    });

    addToast({
      title: `Re-verified ${verifiedCount}/${state.evaluationCases.length} prototype test cases`,
      description:
        'Executed deterministic rule tests across all 10 P0 taxonomy types.',
      variant: 'success',
    });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Page Header & Explicit Non-Training Honesty Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-mono text-violet-700">
              <BrainCircuit className="w-4 h-4" />
              <span>MEMORY · PREFERENCE LEDGER & RULE EVALUATION</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Memory & Preference Ledger
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {state.lastDeletedPreference && (
              <button
                type="button"
                onClick={undoDeletePreferenceRule}
                className="px-3.5 py-2 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Undo Last Delete</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setCreateRuleOpen(true)}
              className="px-4 py-2 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Explicit Rule</span>
            </button>
          </div>
        </div>

        {/* Mandatory Clear Explanation from Section 3 Page 5 */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/90 flex items-start gap-3 text-xs text-slate-700 leading-relaxed">
          <ShieldCheck className="w-4 h-4 text-[#0D9488] shrink-0 mt-0.5" />
          <p className="font-medium text-slate-900">
            &ldquo;LOOPFRAME does not silently retrain itself. It stores
            confirmed preferences and applies them as explicit rules during
            future generation.&rdquo;
          </p>
        </div>

        {/* Switch between Preference Ledger and 24-Case Evaluation Workspace */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div
            role="tablist"
            aria-label="Memory workspace sections"
            className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'ledger'}
              onClick={() => setActiveTab('ledger')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === 'ledger'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Preference Ledger ({state.preferences.length} rules)
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'evaluation'}
              onClick={() => setActiveTab('evaluation')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === 'evaluation'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Small Prototype Evaluation ({state.evaluationCases.length} test
              cases)
            </button>
          </div>

          <span className="text-xs font-mono text-slate-500">
            Explicit rules take precedence over inferred suggestions
          </span>
        </div>
      </div>

      {activeTab === 'ledger' ? (
        <div className="space-y-4">
          {/* Filter & Search Bar */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {/* Status filter tabs */}
              <div
                role="group"
                aria-label="Filter rules by status"
                className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl"
              >
                {(['active', 'paused', 'deleted', 'all'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-colors cursor-pointer ${
                      statusFilter === st
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>

              {/* Scope filter buttons */}
              <div
                role="group"
                aria-label="Filter rules by scope"
                className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl"
              >
                {(['all', 'project', 'global', 'platform'] as const).map(
                  (sc) => (
                    <button
                      key={sc}
                      type="button"
                      onClick={() => setScopeFilter(sc)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize transition-colors cursor-pointer ${
                        scopeFilter === sc
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {sc === 'all' ? 'All scopes' : sc}
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                aria-label="Search preference ledger"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search rule text, type, or feedback..."
                className="w-full md:w-64 pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
              />
            </div>
          </div>

          {/* Preference Ledger Rows */}
          {filteredRules.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
              <p className="text-sm font-bold text-slate-900">
                No preferences match the selected filter
              </p>
              <p className="text-xs text-slate-500">
                Switch status filter to &ldquo;All&rdquo; or confirm a proposed
                rule in Project Studio.
              </p>
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('all');
                  setScopeFilter('all');
                  setSearchQuery('');
                }}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Show All Rules
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRules.map((rule) => (
                <div
                  key={rule.rule_id}
                  className="bg-white rounded-2xl border border-slate-200/90 p-5 space-y-3.5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1">
                      {/* Metadata line: Rule Type · Scope · Status · Confirmation */}
                      <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-500 tabular-nums">
                        <span className="font-bold text-slate-900">
                          {rule.rule_type}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          Scope: {rule.scope} ({rule.scope_reference})
                        </span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={`font-semibold capitalize ${
                            rule.status === 'active'
                              ? 'text-emerald-700'
                              : rule.status === 'paused'
                              ? 'text-amber-700'
                              : 'text-red-700'
                          }`}
                        >
                          Status: {rule.status}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={
                            rule.confirmed_by_user
                              ? 'text-emerald-700 font-semibold'
                              : 'text-amber-700 font-semibold'
                          }
                        >
                          {rule.confirmed_by_user
                            ? 'Confirmed by creator'
                            : 'Unconfirmed / Review note'}
                        </span>
                        {rule.is_demo_data && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>DEMO DATA</span>
                          </>
                        )}
                      </div>

                      {/* Human-readable rule */}
                      <h3 className="text-sm sm:text-base font-bold text-slate-900">
                        {rule.human_readable_description}
                      </h3>
                    </div>

                    {/* Action Controls: Confirm, Edit, Pause/Resume, Delete */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {!rule.confirmed_by_user && (
                        <button
                          type="button"
                          onClick={() =>
                            updatePreferenceRule(rule.rule_id, {
                              confirmed_by_user: true,
                              status: 'active',
                            })
                          }
                          className="px-3 py-1.5 rounded-xl bg-[#0D9488] text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Confirm Rule</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => openEditModal(rule)}
                        aria-label={`Edit rule ${rule.rule_type}`}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>

                      {rule.status !== 'deleted' ? (
                        <button
                          type="button"
                          onClick={() =>
                            updatePreferenceRule(rule.rule_id, {
                              status:
                                rule.status === 'active' ? 'paused' : 'active',
                            })
                          }
                          className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 flex items-center gap-1 cursor-pointer"
                        >
                          {rule.status === 'active' ? (
                            <>
                              <Pause className="w-3.5 h-3.5" />
                              <span>Pause</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-3.5 h-3.5" />
                              <span>Resume</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            updatePreferenceRule(rule.rule_id, {
                              status: 'active',
                            })
                          }
                          className="px-3 py-1.5 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-900 text-xs font-medium flex items-center gap-1 cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Restore</span>
                        </button>
                      )}

                      {rule.status !== 'deleted' && (
                        <button
                          type="button"
                          onClick={() => setRuleToDelete(rule)}
                          aria-label={`Delete rule ${rule.rule_type}`}
                          className="px-3 py-1.5 rounded-xl border border-red-200 hover:bg-red-50 text-xs font-medium text-red-700 flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Source Feedback & Parameters */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-slate-100 text-xs text-slate-600">
                    <div className="space-y-0.5">
                      <span className="font-mono text-[11px] text-slate-400">
                        SOURCE CREATOR FEEDBACK
                      </span>
                      <p className="text-slate-800">
                        &ldquo;{rule.source_feedback_text}&rdquo;
                      </p>
                    </div>

                    <div className="space-y-0.5">
                      <span className="font-mono text-[11px] text-slate-400">
                        STRUCTURED PARAMETERS
                      </span>
                      <p className="font-mono text-[11px] text-slate-700 break-words">
                        {JSON.stringify(rule.rule_parameters)}
                      </p>
                    </div>

                    <div className="space-y-0.5">
                      <span className="font-mono text-[11px] text-slate-400">
                        LAST APPLIED & DETERMINISTIC TEST RESULT
                      </span>
                      <p className="font-mono text-[11px] text-slate-800 tabular-nums">
                        {rule.last_applied_at
                          ? `Applied ${new Date(
                              rule.last_applied_at
                            ).toLocaleDateString()} · Outcome: ${
                              rule.last_test_result || 'N/A'
                            }`
                          : 'Not yet applied to a regeneration'}
                      </p>
                      {rule.last_test_detail && (
                        <p className="text-[11px] text-slate-500">
                          {rule.last_test_detail}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* SECTION 9: SMALL PROTOTYPE EVALUATION WORKSPACE (24 Seeded Test Cases) */
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-mono font-semibold text-[#0D9488]">
                  DATASET LABEL: SMALL PROTOTYPE EVALUATION
                </span>
                <h2 className="text-lg font-bold text-slate-900 mt-0.5">
                  Rule Verification & Evaluation Benchmark (
                  {evalMetrics.total} Seeded Correction Cases)
                </h2>
                <p className="text-xs text-slate-600">
                  Actual raw counts across all 10 P0 rule types (including
                  negative cases, false positives, and false negatives—no
                  invented accuracy percentages).
                </p>
              </div>

              <button
                type="button"
                onClick={handleRunLiveDeterministicSuite}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shrink-0 cursor-pointer"
              >
                Re-Run All {evalMetrics.total} Deterministic Tests
              </button>
            </div>

            {/* Raw Count Ledger Grid (Tabular Numerals) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 pt-2 border-t border-slate-100 text-xs font-mono tabular-nums">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                <p className="text-[10px] text-slate-500">TOTAL CASES</p>
                <p className="text-lg font-bold text-slate-900 mt-0.5">
                  {evalMetrics.total}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                <p className="text-[10px] text-slate-500">MAPPED CORRECTLY</p>
                <p className="text-lg font-bold text-slate-900 mt-0.5">
                  {evalMetrics.mappedCorrectly} / {evalMetrics.total}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                <p className="text-[10px] text-slate-500">USER CONFIRMED</p>
                <p className="text-lg font-bold text-slate-900 mt-0.5">
                  {evalMetrics.confirmedCount} / {evalMetrics.total}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200">
                <p className="text-[10px] text-emerald-800">RULE TEST PASS</p>
                <p className="text-lg font-bold text-emerald-800 mt-0.5">
                  {evalMetrics.passedRuleTest}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-red-50/60 border border-red-200">
                <p className="text-[10px] text-red-800">RULE TEST FAIL</p>
                <p className="text-lg font-bold text-red-800 mt-0.5">
                  {evalMetrics.failedRuleTest}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-violet-50/60 border border-violet-200">
                <p className="text-[10px] text-violet-800">AI ADVISORY</p>
                <p className="text-lg font-bold text-violet-800 mt-0.5">
                  {evalMetrics.advisoryCount}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200">
                <p className="text-[10px] text-amber-900">FALSE POS / NEG</p>
                <p className="text-lg font-bold text-amber-900 mt-0.5">
                  {evalMetrics.falsePositives} FP · {evalMetrics.falseNegatives}{' '}
                  FN
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                <p className="text-[10px] text-slate-500">MEANING PRESERVED</p>
                <p className="text-lg font-bold text-slate-900 mt-0.5">
                  {evalMetrics.meaningPreserved} / {evalMetrics.total}
                </p>
              </div>
            </div>

            {/* Filter by Rule Type / Negative Cases / FP-FN */}
            <div className="flex flex-wrap items-center gap-1.5 pt-2">
              <button
                type="button"
                onClick={() => setEvalRuleFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium cursor-pointer ${
                  evalRuleFilter === 'ALL'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                All ({evalMetrics.total})
              </button>
              <button
                type="button"
                onClick={() => setEvalRuleFilter('NEGATIVE')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium cursor-pointer ${
                  evalRuleFilter === 'NEGATIVE'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Negative Cases ({evalMetrics.negativeCases})
              </button>
              <button
                type="button"
                onClick={() => setEvalRuleFilter('FP_FN')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium cursor-pointer ${
                  evalRuleFilter === 'FP_FN'
                    ? 'bg-amber-700 text-white'
                    : 'bg-amber-50 text-amber-900 border border-amber-200'
                }`}
              >
                False Positives & Negatives (
                {evalMetrics.falsePositives + evalMetrics.falseNegatives})
              </button>
              {CLOSED_RULE_TAXONOMY.map((t) => (
                <button
                  key={t.type}
                  type="button"
                  onClick={() => setEvalRuleFilter(t.type)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-mono cursor-pointer ${
                    evalRuleFilter === t.type
                      ? 'bg-[#0D9488] text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {t.type}
                </button>
              ))}
            </div>
          </div>

          {/* Evaluation Cases Table / Cards */}
          <div className="space-y-3">
            {filteredEvalCases.map((tc) => (
              <div
                key={tc.case_id}
                className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 space-y-2.5 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[11px]">
                  <div className="flex flex-wrap items-center gap-2 text-slate-500">
                    <span className="font-bold text-slate-900">
                      {tc.case_id}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="text-slate-800 font-semibold">
                      {tc.rule_type}
                    </span>
                    {tc.is_negative_case && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-[#0D9488] font-semibold">
                          NEGATIVE CONTROL CASE
                        </span>
                      </>
                    )}
                    {tc.is_false_positive && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-amber-700 font-bold">
                          RECORDED FALSE POSITIVE
                        </span>
                      </>
                    )}
                    {tc.is_false_negative && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-amber-700 font-bold">
                          RECORDED FALSE NEGATIVE
                        </span>
                      </>
                    )}
                  </div>

                  <span
                    className={`font-bold ${
                      tc.actual_test_outcome === 'Pass'
                        ? 'text-emerald-700'
                        : tc.actual_test_outcome === 'Fail'
                        ? 'text-red-700'
                        : 'text-violet-700'
                    }`}
                  >
                    Actual Test: {tc.actual_test_outcome} (Expected:{' '}
                    {tc.expected_test_outcome})
                  </span>
                </div>

                <h3 className="text-sm font-bold text-slate-900">{tc.title}</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1">
                    <p className="font-mono text-[10px] text-slate-500">
                      BEFORE (REJECTED HOOK) & CREATOR FEEDBACK
                    </p>
                    <p className="text-slate-800 line-through">
                      &ldquo;{tc.candidate_hook_before}&rdquo;
                    </p>
                    <p className="text-[11px] text-slate-600">
                      <strong>Feedback:</strong> {tc.creator_feedback}
                    </p>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1">
                    <p className="font-mono text-[10px] text-slate-500">
                      AFTER REGENERATION & DETERMINISTIC RECEIPT
                    </p>
                    <p className="font-semibold text-slate-900">
                      &ldquo;{tc.regenerated_hook_after}&rdquo;
                    </p>
                    <p className="font-mono text-[11px] text-slate-600">
                      {tc.matched_phrase_or_reason}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 pt-1 text-[11px] text-slate-500 font-mono">
                  <span>
                    Feedback Mapped:{' '}
                    {tc.feedback_mapped_correctly ? 'Yes' : 'No'}
                  </span>
                  <span>
                    User Confirmed: {tc.user_confirmed_rule ? 'Yes' : 'No'}
                  </span>
                  <span>
                    Meaning Preserved:{' '}
                    {tc.source_meaning_preserved ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit Preference Modal */}
      {editingRule && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-rule-modal-title"
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <form
            onSubmit={handleSaveRuleEdit}
            className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4 shadow-xl"
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="font-mono text-[11px] text-slate-500">
                  {editingRule.rule_type}
                </span>
                <h2
                  id="edit-rule-modal-title"
                  className="text-base font-bold text-slate-900"
                >
                  Edit Confirmed Preference Rule
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setEditingRule(null)}
                aria-label="Close edit rule dialog"
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="edit-rule-desc"
                className="block text-xs font-semibold text-slate-800"
              >
                Human-Readable Rule Description
              </label>
              <textarea
                id="edit-rule-desc"
                rows={2}
                required
                value={draftDesc}
                onChange={(e) => setDraftDesc(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 text-xs text-slate-900"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="edit-rule-scope"
                className="block text-xs font-semibold text-slate-800"
              >
                Preference Scope
              </label>
              <select
                id="edit-rule-scope"
                value={draftScope}
                onChange={(e) => setDraftScope(e.target.value as RuleScope)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-900"
              >
                <option value="project">Project</option>
                <option value="global">Global (All Projects)</option>
                <option value="platform">Platform</option>
              </select>
            </div>

            {editingRule.rule_type === 'PREFER_CONCISE_HOOKS' && (
              <div className="space-y-1.5">
                <label
                  htmlFor="edit-rule-maxwords"
                  className="block text-xs font-semibold text-slate-800"
                >
                  Maximum Hook Word Count
                </label>
                <input
                  id="edit-rule-maxwords"
                  type="number"
                  min={4}
                  max={30}
                  value={draftMaxWords}
                  onChange={(e) => setDraftMaxWords(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono text-slate-900"
                />
              </div>
            )}

            {editingRule.rule_type === 'INCLUDE_CLEAR_TOPIC' && (
              <div className="space-y-1.5">
                <label
                  htmlFor="edit-rule-topic"
                  className="block text-xs font-semibold text-slate-800"
                >
                  Required Topic Keyword / Phrase
                </label>
                <input
                  id="edit-rule-topic"
                  type="text"
                  value={draftTopicPhrase}
                  onChange={(e) => setDraftTopicPhrase(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900"
                />
              </div>
            )}

            {(editingRule.rule_type === 'AVOID_EXAGGERATED_HOOKS' ||
              editingRule.rule_type === 'AVOID_CLICKBAIT' ||
              editingRule.rule_type === 'AVOID_JARGON' ||
              editingRule.rule_type === 'PRESERVE_QUALIFICATIONS') && (
              <div className="space-y-1.5">
                <label
                  htmlFor="edit-rule-terms"
                  className="block text-xs font-semibold text-slate-800"
                >
                  Configured Lexicon / Terms (Comma-separated)
                </label>
                <textarea
                  id="edit-rule-terms"
                  rows={2}
                  value={draftTerms}
                  onChange={(e) => setDraftTerms(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-mono text-slate-900"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingRule(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#0D9488] text-white text-xs font-semibold"
              >
                Save Preference Changes
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Rule Confirmation Modal */}
      {ruleToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-rule-modal-title"
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center gap-2 text-red-700 font-bold text-base">
              <AlertTriangle className="w-5 h-5" />
              <h2 id="delete-rule-modal-title">Delete Preference Rule?</h2>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete{' '}
              <strong className="font-mono">{ruleToDelete.rule_type}</strong>?
              It will no longer be injected into future generation context. You
              can undo this action immediately after deletion.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRuleToDelete(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  deletePreferenceRule(ruleToDelete.rule_id);
                  setRuleToDelete(null);
                }}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create New Explicit Rule Modal */}
      {createRuleOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-rule-modal-title"
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <form
            onSubmit={handleCreateExplicitRule}
            className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4 shadow-xl"
          >
            <div className="flex items-start justify-between">
              <h2
                id="create-rule-modal-title"
                className="text-base font-bold text-slate-900"
              >
                Add Explicit Preference Rule
              </h2>
              <button
                type="button"
                onClick={() => setCreateRuleOpen(false)}
                aria-label="Close add rule dialog"
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="new-rule-type"
                className="block text-xs font-semibold text-slate-800"
              >
                Closed Taxonomy Rule Type
              </label>
              <select
                id="new-rule-type"
                value={newRuleType}
                onChange={(e) => {
                  const nextType = e.target.value as RuleType;
                  setNewRuleType(nextType);
                  const found = CLOSED_RULE_TAXONOMY.find(
                    (t) => t.type === nextType
                  );
                  if (found) setNewRuleDesc(found.defaultDescription);
                }}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-mono text-slate-900"
              >
                {CLOSED_RULE_TAXONOMY.map((t) => (
                  <option key={t.type} value={t.type}>
                    {t.type} — {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="new-rule-scope"
                className="block text-xs font-semibold text-slate-800"
              >
                Scope (Default: Project)
              </label>
              <select
                id="new-rule-scope"
                value={newRuleScope}
                onChange={(e) => setNewRuleScope(e.target.value as RuleScope)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-900"
              >
                <option value="project">Project</option>
                <option value="global">Global (All Projects)</option>
                <option value="platform">Platform</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="new-rule-desc"
                className="block text-xs font-semibold text-slate-800"
              >
                Rule Description
              </label>
              <textarea
                id="new-rule-desc"
                rows={2}
                required
                value={newRuleDesc}
                onChange={(e) => setNewRuleDesc(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 text-xs text-slate-900"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCreateRuleOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#0D9488] text-white text-xs font-semibold"
              >
                Confirm & Save Rule
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
