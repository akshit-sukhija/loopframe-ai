import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BrainCircuit,
  Check,
  CheckCircle2,
  Copy,
  Download,
  Edit3,
  Expand,
  Flag,
  History,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { useLoopframe } from '../context/LoopframeContext';
import {
  CLOSED_RULE_TAXONOMY,
  getApplicableActiveRules,
} from '../lib/ruleEngine';
import { formatTimecode } from '../lib/transcriptParser';
import {
  DestinationPlatform,
  FeedbackReasonChip,
  PreferenceRule,
  RuleScope,
  RuleType,
} from '../types/loopframe';

const REASON_CHIPS: FeedbackReasonChip[] = [
  'exaggerated hook',
  'missing context',
  'wrong tone',
  'irrelevant',
  'too long',
  'jargon',
  'other',
];

export const ProjectStudioPage: React.FC<{ projectId: string }> = ({
  projectId,
}) => {
  const {
    state,
    navigate,
    isGenerating,
    expandCandidateSegments,
    submitCandidateFeedback,
    confirmProposedRule,
    dismissProposedRule,
    regenerateCandidateWithRules,
    updateCandidateCopyAndRecheck,
    setCandidateReviewStatus,
    addToast,
  } = useLoopframe();

  const project =
    state.projects.find((p) => p.project_id === projectId) ??
    state.projects[0];

  const [selectedCandidateId, setSelectedCandidateId] = useState<string>(
    () => project?.candidates[0]?.candidate_id ?? ''
  );

  // Mobile/Tablet active pane tab so columns are never squeezed on narrow viewports
  const [mobilePane, setMobilePane] = useState<
    'candidates' | 'transcript' | 'review'
  >('review');

  // Platform copy destination selector (P0: Instagram Reels & YouTube Shorts only)
  const [activePlatform, setActivePlatform] =
    useState<DestinationPlatform>('instagram_reels');

  // Manual copy editor state
  const [isEditingCopy, setIsEditingCopy] = useState(false);
  const [draftHook, setDraftHook] = useState('');
  const [draftCaption, setDraftCaption] = useState('');
  const [draftCta, setDraftCta] = useState('');

  // Creator feedback form state
  const [selectedChips, setSelectedChips] = useState<FeedbackReasonChip[]>([
    'exaggerated hook',
  ]);
  const [feedbackText, setFeedbackText] = useState(
    'Avoid exaggerated hooks. Keep the original educational context.'
  );
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  // Proposed rule confirmation editor state
  const [editingRuleDesc, setEditingRuleDesc] = useState('');
  const [editingRuleType, setEditingRuleType] = useState<RuleType>(
    'AVOID_EXAGGERATED_HOOKS'
  );
  const [editingRuleScope, setEditingRuleScope] =
    useState<RuleScope>('project');

  const selectedCandidate = useMemo(() => {
    if (!project) return null;
    return (
      project.candidates.find((c) => c.candidate_id === selectedCandidateId) ??
      project.candidates[0] ??
      null
    );
  }, [project, selectedCandidateId]);

  useEffect(() => {
    if (project && project.candidates.length > 0) {
      const exists = project.candidates.some(
        (c) => c.candidate_id === selectedCandidateId
      );
      if (!exists) {
        setSelectedCandidateId(project.candidates[0].candidate_id);
      }
    }
  }, [project, selectedCandidateId]);

  // Sync draft copy fields when candidate or platform changes
  useEffect(() => {
    if (!selectedCandidate) return;
    const copy = selectedCandidate.platform_copy[activePlatform];
    setDraftHook(copy.hook);
    setDraftCaption(copy.caption);
    setDraftCta(copy.cta ?? '');
    setIsEditingCopy(false);
  }, [selectedCandidate, activePlatform]);

  // Find pending rule proposal for this project
  const pendingFeedbackEvent = useMemo(() => {
    if (!project) return null;
    return (
      project.feedback_events.find(
        (fe) =>
          fe.confirmation_status === 'pending_confirmation' &&
          fe.proposed_rule
      ) ?? null
    );
  }, [project]);

  useEffect(() => {
    if (pendingFeedbackEvent?.proposed_rule) {
      setEditingRuleDesc(
        pendingFeedbackEvent.proposed_rule.human_readable_description
      );
      setEditingRuleType(pendingFeedbackEvent.proposed_rule.rule_type);
      setEditingRuleScope(pendingFeedbackEvent.proposed_rule.scope);
    }
  }, [pendingFeedbackEvent]);

  if (!project || !selectedCandidate) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12 text-center space-y-4">
        <p className="text-base font-bold text-slate-900">Project not found</p>
        <button
          type="button"
          onClick={() => navigate('/projects')}
          className="px-4 py-2 rounded-xl bg-[#0D9488] text-white text-xs font-semibold"
        >
          Back to Projects
        </button>
      </div>
    );
  }

  const activeRulesForProject = getApplicableActiveRules(
    state.preferences,
    project.project_id,
    activePlatform
  );

  const startIdx = project.segments.findIndex(
    (s) => s.segment_id === selectedCandidate.start_segment_id
  );
  const endIdx = project.segments.findIndex(
    (s) => s.segment_id === selectedCandidate.end_segment_id
  );
  const segmentBefore = startIdx > 0 ? project.segments[startIdx - 1] : null;
  const segmentAfter =
    endIdx >= 0 && endIdx < project.segments.length - 1
      ? project.segments[endIdx + 1]
      : null;

  const totalTranscriptDurationMs = Math.max(
    1,
    project.segments[project.segments.length - 1]?.end_ms ?? 1
  );

  const toggleReasonChip = (chip: FeedbackReasonChip) => {
    setSelectedChips((prev) =>
      prev.includes(chip) ? prev.filter((c) => c !== chip) : [...prev, chip]
    );
  };

  const handleSubmitFeedback = async (
    e: React.FormEvent,
    actionTaken: 'rejected' | 'edited' | 'flagged' = 'rejected'
  ) => {
    e.preventDefault();
    if (!feedbackText.trim() && selectedChips.length === 0) return;
    setIsSubmittingFeedback(true);
    try {
      await submitCandidateFeedback({
        projectId: project.project_id,
        candidateId: selectedCandidate.candidate_id,
        actionTaken,
        reasonChips: selectedChips,
        freeText: feedbackText,
      });
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const handleConfirmRule = () => {
    if (!pendingFeedbackEvent || !pendingFeedbackEvent.proposed_rule) return;
    const baseRule = pendingFeedbackEvent.proposed_rule;
    const taxonomyEntry = CLOSED_RULE_TAXONOMY.find(
      (t) => t.type === editingRuleType
    );

    const updatedRule: PreferenceRule = {
      ...baseRule,
      rule_type: editingRuleType,
      human_readable_description:
        editingRuleDesc.trim() || baseRule.human_readable_description,
      scope: editingRuleScope,
      scope_reference:
        editingRuleScope === 'global'
          ? 'all'
          : editingRuleScope === 'platform'
          ? activePlatform
          : project.project_id,
      rule_parameters: {
        ...(taxonomyEntry?.defaultParameters ?? {}),
        ...baseRule.rule_parameters,
      },
    };

    confirmProposedRule({
      projectId: project.project_id,
      feedbackId: pendingFeedbackEvent.feedback_id,
      updatedRule,
    });
  };

  const handleSaveEditedCopy = () => {
    updateCandidateCopyAndRecheck({
      projectId: project.project_id,
      candidateId: selectedCandidate.candidate_id,
      platform: activePlatform,
      hook: draftHook,
      caption: draftCaption,
      cta: draftCta,
    });
    setIsEditingCopy(false);
  };

  const handleExportCandidate = (mode: 'clipboard' | 'download') => {
    const copy = selectedCandidate.platform_copy[activePlatform];
    const exportPayload = [
      `LOOPFRAME AI V4 — VERIFIED CLIP EXPORT RECEIPT`,
      `Project: ${project.name}`,
      `Candidate: ${selectedCandidate.title} (${selectedCandidate.candidate_id})`,
      `Platform: ${
        activePlatform === 'instagram_reels'
          ? 'Instagram Reels'
          : 'YouTube Shorts'
      }`,
      `Timecodes: ${formatTimecode(selectedCandidate.start_ms)} – ${formatTimecode(
        selectedCandidate.end_ms
      )} (${selectedCandidate.duration_sec}s)`,
      `Segments: ${selectedCandidate.source_segment_ids.join(', ')}`,
      `Context Status: ${selectedCandidate.context_status}`,
      ``,
      `--- HOOK ---`,
      copy.hook,
      ``,
      `--- CAPTION ---`,
      copy.caption,
      copy.cta ? `\nCTA: ${copy.cta}` : '',
      copy.hashtags?.length ? `Hashtags: ${copy.hashtags.join(' ')}` : '',
      ``,
      `--- VERBATIM SOURCE EXCERPT ---`,
      `"${selectedCandidate.source_excerpt}"`,
    ]
      .filter(Boolean)
      .join('\n');

    if (mode === 'clipboard') {
      navigator.clipboard?.writeText(exportPayload).catch(() => {});
      addToast({
        title: 'Export ready (Copied to clipboard)',
        description: `Copied hook, caption, verbatim excerpt, and timecodes [${formatTimecode(
          selectedCandidate.start_ms
        )}–${formatTimecode(selectedCandidate.end_ms)}].`,
        variant: 'success',
      });
    } else {
      const blob = new Blob([exportPayload], {
        type: 'text/plain;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedCandidate.candidate_id}-${activePlatform}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      addToast({
        title: 'Export ready (.txt downloaded)',
        description: `Downloaded ${selectedCandidate.candidate_id}-${activePlatform}.txt.`,
        variant: 'success',
      });
    }
  };

  const currentPlatformCopy = selectedCandidate.platform_copy[activePlatform];
  const anyRuleFailed = selectedCandidate.rule_test_results.some(
    (r) => r.outcome === 'Fail'
  );

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)]">
      {/* Studio Sub-Header Bar */}
      <div className="bg-white border-b border-slate-200/90 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => navigate('/projects')}
            aria-label="Back to Projects list"
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-slate-500">
              <span>{project.source_type.toUpperCase()}</span>
              <span aria-hidden="true">·</span>
              <span className="font-semibold text-slate-800">
                {project.generation_mode}
              </span>
              <span aria-hidden="true">·</span>
              <span>{project.segments.length} SEGMENTS</span>
              <span aria-hidden="true">·</span>
              <span>
                {activeRulesForProject.length} ACTIVE RULE
                {activeRulesForProject.length === 1 ? '' : 'S'}
              </span>
            </div>
            <h1 className="text-sm sm:text-base font-bold text-slate-900 truncate">
              {project.name}
            </h1>
          </div>
        </div>

        {/* Sticky Primary Actions for Selected Candidate */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setCandidateReviewStatus(
                project.project_id,
                selectedCandidate.candidate_id,
                'Approved'
              )
            }
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              selectedCandidate.review_status === 'Approved'
                ? 'bg-emerald-700 text-white'
                : 'bg-[#0D9488] hover:bg-[#0F766E] text-white'
            }`}
          >
            <Check className="w-3.5 h-3.5" />
            <span>
              {selectedCandidate.review_status === 'Approved'
                ? 'Approved (In Library)'
                : 'Approve Candidate'}
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              setCandidateReviewStatus(
                project.project_id,
                selectedCandidate.candidate_id,
                'Flagged for context review'
              )
            }
            className="px-3 py-1.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
          >
            <Flag className="w-3.5 h-3.5" />
            <span>Flag Context</span>
          </button>

          <button
            type="button"
            onClick={() =>
              setCandidateReviewStatus(
                project.project_id,
                selectedCandidate.candidate_id,
                'Rejected'
              )
            }
            className="px-3 py-1.5 rounded-xl border border-red-200 bg-white hover:bg-red-50 text-red-700 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>Reject</span>
          </button>

          <button
            type="button"
            onClick={() => handleExportCandidate('clipboard')}
            className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Export Copy & Timecodes</span>
          </button>
        </div>
      </div>

      {/* Mobile / Tablet Pane Switcher (Visible below xl breakpoint) */}
      <div className="xl:hidden sticky top-16 z-10 bg-[#F8F7F4] border-b border-slate-200 px-4 py-2">
        <div
          role="tablist"
          aria-label="Project Studio mobile panes"
          className="grid grid-cols-3 gap-1 p-1 bg-slate-200/80 rounded-xl"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mobilePane === 'candidates'}
            onClick={() => setMobilePane('candidates')}
            className={`py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              mobilePane === 'candidates'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600'
            }`}
          >
            1. Candidates ({project.candidates.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mobilePane === 'transcript'}
            onClick={() => setMobilePane('transcript')}
            className={`py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              mobilePane === 'transcript'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600'
            }`}
          >
            2. Source Transcript
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mobilePane === 'review'}
            onClick={() => setMobilePane('review')}
            className={`py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              mobilePane === 'review'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600'
            }`}
          >
            3. Review & Rules
          </button>
        </div>
      </div>

      {/* Three-Pane Desktop Layout */}
      <div className="flex-1 grid grid-cols-1 xl:grid-cols-12 gap-0 xl:divide-x xl:divide-slate-200/90 max-w-[1600px] w-full mx-auto">
        {/* LEFT PANE (3 cols): Candidate List (3–5 explainable cards) */}
        <section
          aria-label="Clip Candidates"
          className={`xl:col-span-3 p-4 sm:p-5 space-y-3.5 bg-[#F8F7F4] ${
            mobilePane === 'candidates' ? 'block' : 'hidden xl:block'
          }`}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              1. Clip Candidates ({project.candidates.length})
            </h2>
            <span className="font-mono text-[11px] text-slate-500">
              Select to inspect
            </span>
          </div>

          <div className="space-y-3">
            {project.candidates.map((cand, index) => {
              const isSelected =
                cand.candidate_id === selectedCandidate.candidate_id;
              const hasFailedRule = cand.rule_test_results.some(
                (t) => t.outcome === 'Fail'
              );

              return (
                <button
                  key={cand.candidate_id}
                  type="button"
                  onClick={() => {
                    setSelectedCandidateId(cand.candidate_id);
                    setMobilePane('review');
                  }}
                  className={`w-full text-left rounded-2xl border p-4 transition-all cursor-pointer space-y-2.5 ${
                    isSelected
                      ? 'bg-white border-[#0D9488] ring-2 ring-[#0D9488]/20 shadow-xs'
                      : 'bg-white/90 border-slate-200/90 hover:border-slate-300'
                  }`}
                >
                  {/* Top metadata line (unboxed clean text with · separators) */}
                  <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] font-mono text-slate-500 tabular-nums">
                    <span>
                      0{index + 1} · {formatTimecode(cand.start_ms)}–
                      {formatTimecode(cand.end_ms)} ({cand.duration_sec}s)
                    </span>
                    <span className="text-slate-600 font-semibold">
                      {cand.generation_source}
                    </span>
                  </div>

                  {/* Candidate Title */}
                  <h3 className="text-sm font-bold text-slate-900 leading-snug">
                    {cand.title}
                  </h3>

                  {/* One-sentence reason for selection */}
                  <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                    {cand.reason}
                  </p>

                  {/* Context Status, Review Status, and Platform Copy Status */}
                  <div className="pt-2 border-t border-slate-100 space-y-1 text-[11px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-500">Context check:</span>
                      <span
                        className={`font-semibold ${
                          cand.context_status === 'No issues found by 7 checks'
                            ? 'text-emerald-700'
                            : cand.context_status === 'Source mismatch'
                            ? 'text-red-700'
                            : 'text-amber-700'
                        }`}
                      >
                        {cand.context_status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-500">Review status:</span>
                      <span
                        className={`font-semibold ${
                          cand.review_status === 'Approved'
                            ? 'text-emerald-700'
                            : cand.review_status === 'Rejected'
                            ? 'text-red-700'
                            : cand.review_status ===
                              'Flagged for context review'
                            ? 'text-amber-700'
                            : 'text-slate-800'
                        }`}
                      >
                        {cand.review_status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-500">Platform copy:</span>
                      <span className="text-slate-700 font-mono">
                        IG Reels · YT Shorts ready
                      </span>
                    </div>

                    {hasFailedRule && (
                      <div className="text-red-700 font-semibold flex items-center gap-1 pt-0.5">
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        <span>Rule test failed — revise required</span>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* CENTRE PANE (4 cols): Source Transcript with Timestamps & Segment Timeline */}
        <section
          aria-label="Source Transcript & Evidence"
          className={`xl:col-span-4 p-4 sm:p-5 space-y-4 bg-white ${
            mobilePane === 'transcript' ? 'block' : 'hidden xl:block'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                2. Source Transcript & Evidence
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Highlighted segments ({selectedCandidate.start_segment_id}–
                {selectedCandidate.end_segment_id}) assemble the verbatim
                excerpt.
              </p>
            </div>
            <span className="font-mono text-xs text-slate-600 tabular-nums">
              {formatTimecode(selectedCandidate.start_ms)} –{' '}
              {formatTimecode(selectedCandidate.end_ms)}
            </span>
          </div>

          {/* Accurate Segment Timestamp Timeline Visualization */}
          <div className="bg-slate-50 rounded-xl border border-slate-200/80 p-3 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 tabular-nums">
              <span>00:00:00</span>
              <span>
                Selected clip: {selectedCandidate.duration_sec}s (
                {selectedCandidate.source_segment_ids.length} segs)
              </span>
              <span>{formatTimecode(totalTranscriptDurationMs)}</span>
            </div>

            <div
              aria-label="Transcript segment timeline map"
              className="h-5 w-full bg-slate-200/80 rounded-lg overflow-hidden flex gap-0.5 p-0.5"
            >
              {project.segments.map((seg) => {
                const isSelectedSeg =
                  selectedCandidate.source_segment_ids.includes(seg.segment_id);
                const isAdjacentSeg =
                  seg.segment_id === segmentBefore?.segment_id ||
                  seg.segment_id === segmentAfter?.segment_id;
                const widthPct = Math.max(
                  3,
                  ((seg.end_ms - seg.start_ms) / totalTranscriptDurationMs) *
                    100
                );

                return (
                  <div
                    key={seg.segment_id}
                    style={{ width: `${widthPct}%` }}
                    title={`${seg.segment_id} [${formatTimecode(
                      seg.start_ms
                    )}–${formatTimecode(seg.end_ms)}]`}
                    className={`h-full rounded-xs transition-colors ${
                      isSelectedSeg
                        ? 'bg-[#0D9488]'
                        : isAdjacentSeg
                        ? 'bg-amber-400/80'
                        : 'bg-slate-300/80'
                    }`}
                  />
                );
              })}
            </div>

            {/* Expand Clip Boundary Controls */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <button
                type="button"
                disabled={!segmentBefore}
                onClick={() =>
                  expandCandidateSegments(
                    project.project_id,
                    selectedCandidate.candidate_id,
                    'before'
                  )
                }
                title={
                  segmentBefore
                    ? `Include ${segmentBefore.segment_id} before clip and re-run checks`
                    : 'Already at first transcript segment'
                }
                className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 text-[11px] font-medium text-slate-700 flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
              >
                <Expand className="w-3 h-3" />
                <span>
                  + Prepend {segmentBefore ? segmentBefore.segment_id : 'Start'}
                </span>
              </button>

              <button
                type="button"
                disabled={!segmentAfter}
                onClick={() =>
                  expandCandidateSegments(
                    project.project_id,
                    selectedCandidate.candidate_id,
                    'after'
                  )
                }
                title={
                  segmentAfter
                    ? `Include ${segmentAfter.segment_id} after clip and re-run checks`
                    : 'Already at final transcript segment'
                }
                className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 text-[11px] font-medium text-slate-700 flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
              >
                <Expand className="w-3 h-3" />
                <span>
                  + Append {segmentAfter ? segmentAfter.segment_id : 'End'}
                </span>
              </button>
            </div>
          </div>

          {/* Full Transcript Segments with Active & Surrounding Highlighting */}
          <div className="space-y-2 max-h-[680px] overflow-y-auto pr-1">
            {project.segments.map((seg) => {
              const isInsideClip =
                selectedCandidate.source_segment_ids.includes(seg.segment_id);
              const isBeforeClip = seg.segment_id === segmentBefore?.segment_id;
              const isAfterClip = seg.segment_id === segmentAfter?.segment_id;

              return (
                <div
                  key={seg.segment_id}
                  className={`p-3 rounded-xl border text-xs leading-relaxed transition-colors ${
                    isInsideClip
                      ? 'bg-[#0D9488]/8 border-[#0D9488]/50 text-slate-900'
                      : isBeforeClip || isAfterClip
                      ? 'bg-amber-50/50 border-amber-200/80 text-slate-800'
                      : 'bg-white border-slate-200/70 text-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 font-mono text-[11px] text-slate-500 mb-1 tabular-nums">
                    <span>
                      {seg.segment_id} · [{formatTimecode(seg.start_ms)} –{' '}
                      {formatTimecode(seg.end_ms)}]
                    </span>
                    {isInsideClip && (
                      <span className="font-semibold text-[#0D9488]">
                        SELECTED SOURCE
                      </span>
                    )}
                    {isBeforeClip && (
                      <span className="text-amber-700">
                        PRECEDING CONTEXT (-1)
                      </span>
                    )}
                    {isAfterClip && (
                      <span className="text-amber-700">
                        FOLLOWING CONTEXT (+1)
                      </span>
                    )}
                  </div>

                  <p>
                    {seg.speaker_label && (
                      <strong className="font-semibold text-slate-900 mr-1.5">
                        {seg.speaker_label}:
                      </strong>
                    )}
                    <span>{seg.text}</span>
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* RIGHT PANE (5 cols): Candidate Details, Creator Edit Intelligence, Context Checks & Platform Copy */}
        <section
          aria-label="Candidate Review, Rules & Copy"
          className={`xl:col-span-5 p-4 sm:p-5 space-y-5 bg-[#F8F7F4] ${
            mobilePane === 'review' ? 'block' : 'hidden xl:block'
          }`}
        >
          {/* A. CREATOR EDIT INTELLIGENCE — RULE PROPOSAL CONFIRMATION PANEL */}
          {pendingFeedbackEvent && pendingFeedbackEvent.proposed_rule && (
            <div className="bg-white rounded-2xl border-2 border-violet-300 p-4 sm:p-5 space-y-3.5 shadow-xs">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-mono text-violet-700 font-semibold">
                    <BrainCircuit className="w-3.5 h-3.5" />
                    <span>
                      PROPOSED RULE AWAITING USER CONFIRMATION (
                      {pendingFeedbackEvent.mapping_source})
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Confirm Editorial Rule Before Saving to Memory
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    dismissProposedRule(
                      project.project_id,
                      pendingFeedbackEvent.feedback_id
                    )
                  }
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  Dismiss
                </button>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600">
                <span className="font-semibold text-slate-800">
                  Source Creator Feedback:
                </span>{' '}
                &ldquo;{pendingFeedbackEvent.free_text}&rdquo;
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label
                    htmlFor="proposed-rule-taxonomy"
                    className="block text-[11px] font-semibold text-slate-700"
                  >
                    Closed Taxonomy Rule Type
                  </label>
                  <select
                    id="proposed-rule-taxonomy"
                    value={editingRuleType}
                    onChange={(e) =>
                      setEditingRuleType(e.target.value as RuleType)
                    }
                    className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-mono text-slate-900"
                  >
                    {CLOSED_RULE_TAXONOMY.map((t) => (
                      <option key={t.type} value={t.type}>
                        {t.type}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="proposed-rule-scope"
                    className="block text-[11px] font-semibold text-slate-700"
                  >
                    Preference Scope (Default: Project)
                  </label>
                  <select
                    id="proposed-rule-scope"
                    value={editingRuleScope}
                    onChange={(e) =>
                      setEditingRuleScope(e.target.value as RuleScope)
                    }
                    className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white text-xs text-slate-900"
                  >
                    <option value="project">Project (this project only)</option>
                    <option value="global">Global (all projects)</option>
                    <option value="platform">
                      Platform ({activePlatform})
                    </option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="proposed-rule-description"
                  className="block text-[11px] font-semibold text-slate-700"
                >
                  Editable Plain-Language Rule Description
                </label>
                <textarea
                  id="proposed-rule-description"
                  rows={2}
                  value={editingRuleDesc}
                  onChange={(e) => setEditingRuleDesc(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs text-slate-900"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <span className="text-[11px] text-slate-500">
                  LOOPFRAME never activates a rule without your explicit
                  confirmation.
                </span>
                <button
                  type="button"
                  onClick={handleConfirmRule}
                  className="px-4 py-2 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Confirm & Save Rule to Memory</span>
                </button>
              </div>
            </div>
          )}

          {/* B. POST-GENERATION RULE VERIFICATION & REGENERATION PANEL */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Rule Verification & Regeneration Receipts
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {activeRulesForProject.length} confirmed rule(s) active for
                  this candidate.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={isGenerating}
                  onClick={() =>
                    regenerateCandidateWithRules({
                      projectId: project.project_id,
                      candidateId: selectedCandidate.candidate_id,
                      simulateRuleFailure: false,
                    })
                  }
                  className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${
                      isGenerating ? 'animate-spin' : ''
                    }`}
                  />
                  <span>Regenerate with Active Rules</span>
                </button>

                <button
                  type="button"
                  disabled={isGenerating}
                  onClick={() =>
                    regenerateCandidateWithRules({
                      projectId: project.project_id,
                      candidateId: selectedCandidate.candidate_id,
                      simulateRuleFailure: true,
                    })
                  }
                  title="Simulate a rule-violating output to verify honest failure reporting"
                  className="px-2.5 py-1.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-[11px] font-medium cursor-pointer"
                >
                  Test Failure Case
                </button>
              </div>
            </div>

            {/* Honest Rule Failure Banner if any test failed */}
            {anyRuleFailed && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-900 space-y-2"
              >
                <div className="flex items-center gap-2 font-bold">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>
                    Deterministic Rule Test Failed — Preference Was NOT Applied
                  </span>
                </div>
                <p className="text-[11px] text-red-800 leading-relaxed">
                  LOOPFRAME does not claim compliance when a post-generation
                  test fails. Click <strong>Regenerate with Active Rules</strong>{' '}
                  or manually revise the hook below.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() =>
                      regenerateCandidateWithRules({
                        projectId: project.project_id,
                        candidateId: selectedCandidate.candidate_id,
                        simulateRuleFailure: false,
                      })
                    }
                    className="px-3 py-1 rounded-lg bg-red-700 hover:bg-red-800 text-white text-[11px] font-semibold cursor-pointer"
                  >
                    Revise & Retry Compliant Generation
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingCopy(true)}
                    className="px-3 py-1 rounded-lg border border-red-300 bg-white text-red-800 text-[11px] font-medium cursor-pointer"
                  >
                    Edit Hook Manually
                  </button>
                </div>
              </div>
            )}

            {/* Rule Test Receipt Rows */}
            <div className="space-y-2">
              {selectedCandidate.rule_test_results.length === 0 ? (
                <p className="text-xs text-slate-500">
                  No active rules tested yet. Confirm a rule and regenerate.
                </p>
              ) : (
                selectedCandidate.rule_test_results.map((rt) => (
                  <div
                    key={rt.rule_id}
                    className={`p-3 rounded-xl border text-xs space-y-1 ${
                      rt.outcome === 'Pass'
                        ? 'bg-emerald-50/50 border-emerald-200'
                        : rt.outcome === 'Fail'
                        ? 'bg-red-50/70 border-red-300'
                        : 'bg-violet-50/50 border-violet-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
                      <span className="font-semibold text-slate-900">
                        {rt.rule_type}
                      </span>
                      <span
                        className={`font-bold ${
                          rt.outcome === 'Pass'
                            ? 'text-emerald-700'
                            : rt.outcome === 'Fail'
                            ? 'text-red-700'
                            : 'text-violet-700'
                        }`}
                      >
                        {rt.outcome === 'Pass'
                          ? 'DETERMINISTIC PASS'
                          : rt.outcome === 'Fail'
                          ? 'DETERMINISTIC FAIL'
                          : 'AI ADVISORY ONLY'}
                      </span>
                    </div>
                    <p className="text-slate-700 text-[11px]">
                      {rt.rule_description}
                    </p>
                    <p className="font-mono text-[11px] text-slate-600 pt-0.5">
                      Receipt: {rt.matched_phrase_or_reason}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* C. PLATFORM COPY & VERBATIM SOURCE COMPARISON (Instagram Reels & YouTube Shorts) */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Platform Copy vs. Source Excerpt
              </h3>

              {/* Two Destinations Only Selector */}
              <div
                role="group"
                aria-label="Select destination platform"
                className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl"
              >
                <button
                  type="button"
                  onClick={() => setActivePlatform('instagram_reels')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    activePlatform === 'instagram_reels'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Instagram Reels
                </button>
                <button
                  type="button"
                  onClick={() => setActivePlatform('youtube_shorts')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    activePlatform === 'youtube_shorts'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  YouTube Shorts
                </button>
              </div>
            </div>

            {/* Verbatim Source Excerpt Side-by-Side Reference */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
                <span>
                  VERBATIM SOURCE EXCERPT (BUILT BY CODE FROM{' '}
                  {selectedCandidate.start_segment_id}–
                  {selectedCandidate.end_segment_id})
                </span>
                <span>{selectedCandidate.duration_sec}s</span>
              </div>
              <p className="text-xs text-slate-800 leading-relaxed italic">
                &ldquo;{selectedCandidate.source_excerpt}&rdquo;
              </p>

              {/* Surrounding Context Preview */}
              {(segmentBefore || segmentAfter) && (
                <div className="pt-2 mt-2 border-t border-slate-200/70 space-y-1 text-[11px] text-slate-600">
                  {segmentBefore && (
                    <p>
                      <strong className="font-mono text-slate-700">
                        Before ({segmentBefore.segment_id}):
                      </strong>{' '}
                      {segmentBefore.text}
                    </p>
                  )}
                  {segmentAfter && (
                    <p>
                      <strong className="font-mono text-amber-800">
                        After ({segmentAfter.segment_id}):
                      </strong>{' '}
                      {segmentAfter.text}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Hook & Caption View / Editor */}
            {!isEditingCopy ? (
              <div className="space-y-3">
                <div className="p-3.5 rounded-xl border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
                    <span>
                      SUGGESTED HOOK (
                      {
                        currentPlatformCopy.hook
                          .trim()
                          .split(/\s+/)
                          .filter(Boolean).length
                      }{' '}
                      words)
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsEditingCopy(true)}
                      className="text-[#0D9488] hover:underline font-sans font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Edit Copy</span>
                    </button>
                  </div>
                  <p className="text-sm font-bold text-slate-900">
                    {currentPlatformCopy.hook}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                  <span className="block text-[11px] font-mono text-slate-500">
                    {activePlatform === 'instagram_reels'
                      ? 'INSTAGRAM REELS CAPTION (CONCISE, CONVERSATIONAL)'
                      : 'YOUTUBE SHORTS CAPTION (TOPIC-FRAMED, SEARCHABLE)'}
                  </span>
                  <p className="text-xs text-slate-800 leading-relaxed">
                    {currentPlatformCopy.caption}
                  </p>
                  {currentPlatformCopy.cta && (
                    <p className="text-[11px] text-slate-600 pt-1">
                      <strong>CTA:</strong> {currentPlatformCopy.cta}
                    </p>
                  )}
                  {currentPlatformCopy.hashtags &&
                    currentPlatformCopy.hashtags.length > 0 && (
                      <p className="text-[11px] font-mono text-slate-500">
                        {currentPlatformCopy.hashtags.join(' ')}
                      </p>
                    )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleExportCandidate('clipboard')}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Hook, Caption & Timecodes</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExportCandidate('download')}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download .txt Receipt</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 border border-slate-300 rounded-xl p-3.5 bg-slate-50/50">
                <div className="space-y-1">
                  <label
                    htmlFor="edit-hook-input"
                    className="block text-xs font-semibold text-slate-800"
                  >
                    Edit Hook ({activePlatform})
                  </label>
                  <input
                    id="edit-hook-input"
                    type="text"
                    value={draftHook}
                    onChange={(e) => setDraftHook(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-900"
                  />
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="edit-caption-input"
                    className="block text-xs font-semibold text-slate-800"
                  >
                    Edit Caption
                  </label>
                  <textarea
                    id="edit-caption-input"
                    rows={3}
                    value={draftCaption}
                    onChange={(e) => setDraftCaption(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-xs text-slate-900"
                  />
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="edit-cta-input"
                    className="block text-xs font-semibold text-slate-800"
                  >
                    Optional CTA
                  </label>
                  <input
                    id="edit-cta-input"
                    type="text"
                    value={draftCta}
                    onChange={(e) => setDraftCta(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs text-slate-900"
                  />
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditingCopy(false)}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEditedCopy}
                    className="px-3.5 py-1.5 rounded-xl bg-[#0D9488] text-white text-xs font-semibold"
                  >
                    Save & Re-Run Rule Checks
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* D. CONTEXT INTEGRITY CHECKS (7 Deterministic + 4 AI Advisory) */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  3. Context Integrity Checks
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Never claims factual correctness; separates code validation
                  from AI advisory checks.
                </p>
              </div>
              <span
                className={`text-xs font-mono font-semibold ${
                  selectedCandidate.context_status ===
                  'No issues found by 7 checks'
                    ? 'text-emerald-700'
                    : selectedCandidate.context_status === 'Source mismatch'
                    ? 'text-red-700'
                    : 'text-amber-700'
                }`}
              >
                {selectedCandidate.context_status}
              </span>
            </div>

            {selectedCandidate.uncertainty_note && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200/80 text-xs text-amber-900 flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Potential Context Risk</p>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    {selectedCandidate.uncertainty_note}
                  </p>
                </div>
              </div>
            )}

            {/* 7 Deterministic Checks */}
            <div className="space-y-2">
              <p className="text-[11px] font-mono font-semibold text-slate-700">
                DETERMINISTIC VALIDATION (7 CODE CHECKS)
              </p>
              <div className="space-y-1.5">
                {selectedCandidate.deterministic_checks.map((chk) => (
                  <div
                    key={chk.check_id}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs flex items-start justify-between gap-3"
                  >
                    <div className="space-y-0.5">
                      <p className="font-semibold text-slate-900">
                        {chk.label}
                      </p>
                      <p className="text-[11px] text-slate-600">{chk.detail}</p>
                    </div>
                    <span
                      className={`font-mono text-[11px] font-semibold shrink-0 ${
                        chk.passed ? 'text-emerald-700' : 'text-amber-700'
                      }`}
                    >
                      {chk.passed ? 'Verified' : 'Review'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 4 AI-Advisory Checks */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-mono font-semibold text-violet-700 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  <span>AI ADVISORY CHECKS (NOT DETERMINISTIC VALIDATION)</span>
                </p>
              </div>
              <div className="space-y-1.5">
                {selectedCandidate.advisory_checks.map((adv) => (
                  <div
                    key={adv.check_id}
                    className={`p-2.5 rounded-xl border text-xs space-y-0.5 ${
                      adv.flagged
                        ? 'bg-violet-50/60 border-violet-200'
                        : 'bg-white border-slate-200/70'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900">
                        {adv.label}
                      </span>
                      <span className="font-mono text-[10px] text-violet-700">
                        {adv.flagged ? 'AI Advisory: Flagged' : 'AI Advisory'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600">
                      {adv.explanation}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* E. CREATOR FEEDBACK & CORRECTION FORM ("What should change next time?") */}
          <form
            onSubmit={(e) => handleSubmitFeedback(e, 'rejected')}
            className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 space-y-3.5"
          >
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                4. Creator Feedback — What Should Change Next Time?
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Maps your correction to a proposed rule in the closed taxonomy
                for confirmation.
              </p>
            </div>

            {/* Concise Reason Chips */}
            <div className="space-y-1.5">
              <span className="block text-[11px] font-semibold text-slate-700">
                Reason Chips (Select one or more)
              </span>
              <div className="flex flex-wrap gap-1.5">
                {REASON_CHIPS.map((chip) => {
                  const active = selectedChips.includes(chip);
                  return (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => toggleReasonChip(chip)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                        active
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {chip}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1">
              <label
                htmlFor="creator-feedback-input"
                className="block text-[11px] font-semibold text-slate-700"
              >
                Correction Instruction (Plain Language)
              </label>
              <textarea
                id="creator-feedback-input"
                rows={2}
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="e.g., Avoid exaggerated hooks. Keep the original educational context."
                className="w-full p-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={(e) => handleSubmitFeedback(e, 'edited')}
                disabled={isSubmittingFeedback}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 cursor-pointer"
              >
                Propose Rule Without Rejecting
              </button>

              <button
                type="submit"
                disabled={isSubmittingFeedback}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
              >
                {isSubmittingFeedback
                  ? 'Mapping Feedback...'
                  : 'Reject & Propose Rule'}
              </button>
            </div>
          </form>

          {/* Revision History if candidate has been edited or regenerated */}
          {selectedCandidate.revisions.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <History className="w-3.5 h-3.5 text-slate-500" />
                <span>
                  Candidate Revision History (
                  {selectedCandidate.revisions.length})
                </span>
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto text-[11px]">
                {selectedCandidate.revisions.map((rev) => (
                  <div
                    key={rev.revision_id}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-0.5"
                  >
                    <div className="flex items-center justify-between font-mono text-slate-500">
                      <span>{rev.summary}</span>
                      <span>
                        {new Date(rev.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="text-slate-700">
                      <strong>New Hook:</strong> &ldquo;{rev.new_hook}&rdquo;
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
