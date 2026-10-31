import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  ClipCandidate,
  CreatorProfile,
  DestinationPlatform,
  FeedbackEvent,
  FeedbackReasonChip,
  GenerationSourceLabel,
  LibraryItem,
  LoopframeStoreState,
  PreferenceRule,
  ProjectRecord,
} from '../types/loopframe';
import { buildInitialSeedState } from '../lib/seedData';
import {
  assembleCandidateFromSegments,
  formatTimecode,
  parseTimestampedTranscript,
} from '../lib/transcriptParser';
import { evaluateContextIntegrity } from '../lib/contextChecks';
import {
  evaluateAllRulesForOutput,
  getApplicableActiveRules,
  mapCreatorFeedbackToProposedRule,
} from '../lib/ruleEngine';

const STORAGE_KEY = 'loopframe_v4_store_v1';

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  variant: 'success' | 'warning' | 'error' | 'info';
  undoActionLabel?: string;
  onUndo?: () => void;
}

interface LoopframeContextValue {
  state: LoopframeStoreState;
  currentPath: string;
  navigate: (path: string) => void;
  isLoading: boolean;
  isGenerating: boolean;
  saveError: string | null;
  liveAiConfigured: boolean;
  toasts: ToastMessage[];
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  dismissToast: (id: string) => void;
  retrySave: () => void;
  updateProfile: (updates: Partial<CreatorProfile>) => void;
  createProjectFromTranscript: (params: {
    name: string;
    rawTranscript: string;
    sourceType: 'Sample transcript' | 'Pasted transcript';
  }) => Promise<{ ok: boolean; projectId?: string; error?: string }>;
  expandCandidateSegments: (
    projectId: string,
    candidateId: string,
    direction: 'before' | 'after'
  ) => void;
  submitCandidateFeedback: (params: {
    projectId: string;
    candidateId: string;
    actionTaken: 'rejected' | 'edited' | 'flagged';
    reasonChips: FeedbackReasonChip[];
    freeText: string;
  }) => Promise<FeedbackEvent | null>;
  confirmProposedRule: (params: {
    projectId: string;
    feedbackId: string;
    updatedRule: PreferenceRule;
  }) => void;
  dismissProposedRule: (projectId: string, feedbackId: string) => void;
  regenerateCandidateWithRules: (params: {
    projectId: string;
    candidateId: string;
    simulateRuleFailure?: boolean;
  }) => Promise<void>;
  updateCandidateCopyAndRecheck: (params: {
    projectId: string;
    candidateId: string;
    platform: DestinationPlatform;
    hook: string;
    caption: string;
    cta?: string;
  }) => void;
  setCandidateReviewStatus: (
    projectId: string,
    candidateId: string,
    status: 'Approved' | 'Rejected' | 'Flagged for context review' | 'Needs review'
  ) => void;
  updatePreferenceRule: (
    ruleId: string,
    updates: Partial<PreferenceRule>
  ) => void;
  deletePreferenceRule: (ruleId: string) => void;
  undoDeletePreferenceRule: () => void;
  resetDemoData: () => void;
  exportUserDataJson: () => string;
}

const LoopframeContext = createContext<LoopframeContextValue | null>(null);

function loadStateFromAdapter(): LoopframeStoreState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seed = buildInitialSeedState();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
      return seed;
    }
    const parsed = JSON.parse(raw) as LoopframeStoreState;
    if (!parsed || !Array.isArray(parsed.projects)) {
      const seed = buildInitialSeedState();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
      return seed;
    }
    return parsed;
  } catch {
    return buildInitialSeedState();
  }
}

export const LoopframeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, setState] = useState<LoopframeStoreState>(() =>
    loadStateFromAdapter()
  );
  const [currentPath, setCurrentPath] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1' && window.location.pathname === '/welcome') {
      return '/projects';
    }
    return window.location.pathname || '/projects';
  });
  const [isLoading] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [liveAiConfigured, setLiveAiConfigured] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Persist state through local demo store adapter
  const persistState = useCallback((nextState: LoopframeStoreState) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
      setSaveError(null);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Failed to persist changes to local storage adapter.';
      setSaveError(msg);
    }
  }, []);

  const retrySave = useCallback(() => {
    persistState(state);
    addToast({
      title: 'Changes saved',
      description: 'Local demo store synchronized.',
      variant: 'success',
    });
  }, [persistState, state, addToast]);

  useEffect(() => {
    persistState(state);
  }, [state, persistState]);

  // Check server health & Gemini key configuration
  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((data) => {
        if (data && typeof data.liveAiConfigured === 'boolean') {
          setLiveAiConfigured(data.liveAiConfigured);
        }
      })
      .catch(() => {
        setLiveAiConfigured(false);
      });
  }, []);

  // Browser back/forward navigation listener
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/projects');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = useCallback((path: string) => {
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
    setCurrentPath(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const updateProfile = useCallback(
    (updates: Partial<CreatorProfile>) => {
      setState((prev) => ({
        ...prev,
        profile: {
          ...prev.profile,
          ...updates,
          updatedAt: new Date().toISOString(),
        },
      }));
      addToast({
        title: 'Changes saved',
        description: 'Creator profile preferences updated.',
        variant: 'success',
      });
    },
    [addToast]
  );

  const createProjectFromTranscript = useCallback(
    async (params: {
      name: string;
      rawTranscript: string;
      sourceType: 'Sample transcript' | 'Pasted transcript';
    }): Promise<{ ok: boolean; projectId?: string; error?: string }> => {
      const parsed = parseTimestampedTranscript(params.rawTranscript);
      if (!parsed.valid) {
        return {
          ok: false,
          error: `Transcript validation failed on ${parsed.errors.length} line(s).`,
        };
      }

      setIsGenerating(true);
      const newProjectId = `proj-${Date.now().toString(36)}`;
      try {
        const response = await fetch('/api/generate-candidates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: newProjectId,
            segments: parsed.segments,
            preferences: state.preferences,
            creatorProfile: state.profile,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error || `Candidate generation failed (HTTP ${response.status}).`
          );
        }
        const data = await response.json();
        const candidates: ClipCandidate[] = Array.isArray(data.candidates)
          ? data.candidates
          : [];
        if (candidates.length === 0) {
          throw new Error(
            'Candidate generation returned no valid candidates. Check the transcript length and try again.'
          );
        }
        const generationSource: GenerationSourceLabel =
          data.generationSource || 'DEMO FALLBACK';

        const now = new Date().toISOString();
        const newProject: ProjectRecord = {
          project_id: newProjectId,
          name: params.name.trim() || 'Untitled Transcript Review',
          source_type: params.sourceType,
          created_at: now,
          updated_at: now,
          status: 'In review',
          raw_transcript: params.rawTranscript,
          segments: parsed.segments,
          candidates,
          feedback_events: [],
          is_demo_data: params.sourceType === 'Sample transcript',
          generation_mode: generationSource,
        };

        setState((prev) => ({
          ...prev,
          projects: [newProject, ...prev.projects],
          auditEvents: [
            {
              event_id: `aud-${Date.now().toString(36)}`,
              timestamp: now,
              event_type: 'project_created',
              description: `Created project "${newProject.name}" with ${parsed.segments.length} segments and ${candidates.length} candidates (${generationSource}).`,
              project_id: newProjectId,
            },
            ...prev.auditEvents,
          ],
        }));

        addToast({
          title: 'Project created & candidates generated',
          description: `${candidates.length} source-grounded candidates ready (${generationSource}).`,
          variant: 'success',
        });

        setIsGenerating(false);
        return { ok: true, projectId: newProjectId };
      } catch (err: unknown) {
        setIsGenerating(false);
        return {
          ok: false,
          error:
            err instanceof Error
              ? err.message
              : 'Failed to generate candidates.',
        };
      }
    },
    [state.preferences, state.profile, addToast]
  );

  const expandCandidateSegments = useCallback(
    (
      projectId: string,
      candidateId: string,
      direction: 'before' | 'after'
    ) => {
      setState((prev) => {
        const project = prev.projects.find((p) => p.project_id === projectId);
        if (!project) return prev;

        const candidate = project.candidates.find(
          (c) => c.candidate_id === candidateId
        );
        if (!candidate) return prev;

        const startIdx = project.segments.findIndex(
          (s) => s.segment_id === candidate.start_segment_id
        );
        const endIdx = project.segments.findIndex(
          (s) => s.segment_id === candidate.end_segment_id
        );
        if (startIdx === -1 || endIdx === -1) return prev;

        const newStartIdx =
          direction === 'before' ? Math.max(0, startIdx - 1) : startIdx;
        const newEndIdx =
          direction === 'after'
            ? Math.min(project.segments.length - 1, endIdx + 1)
            : endIdx;

        if (newStartIdx === startIdx && newEndIdx === endIdx) {
          return prev;
        }

        const newStartId = project.segments[newStartIdx].segment_id;
        const newEndId = project.segments[newEndIdx].segment_id;

        const asm = assembleCandidateFromSegments(
          project.segments,
          newStartId,
          newEndId
        );
        if (!asm.valid) return prev;

        const activeRules = getApplicableActiveRules(
          prev.preferences,
          projectId
        );
        const ctx = evaluateContextIntegrity({
          allSegments: project.segments,
          startSegmentId: newStartId,
          endSegmentId: newEndId,
          assembledExcerpt: asm.sourceExcerpt,
          suggestedHook: candidate.suggested_hook,
          captionText: candidate.platform_copy.instagram_reels.caption,
        });

        const updatedRuleTests = evaluateAllRulesForOutput({
          rules: activeRules,
          hook: candidate.suggested_hook,
          caption: candidate.platform_copy.instagram_reels.caption,
          sourceExcerpt: asm.sourceExcerpt,
        });

        const now = new Date().toISOString();
        const updatedCandidate: ClipCandidate = {
          ...candidate,
          start_segment_id: newStartId,
          end_segment_id: newEndId,
          source_segment_ids: asm.sourceSegmentIds,
          source_excerpt: asm.sourceExcerpt,
          start_ms: asm.startMs,
          end_ms: asm.endMs,
          duration_sec: asm.durationSec,
          context_status: ctx.context_status,
          deterministic_checks: ctx.deterministic_checks,
          advisory_checks: ctx.advisory_checks,
          rule_test_results: updatedRuleTests,
          revisions: [
            {
              revision_id: `rev-${Date.now().toString(36)}`,
              timestamp: now,
              summary: `Expanded source boundary ${direction} to ${newStartId}–${newEndId} and re-ran 7 deterministic checks.`,
              previous_hook: candidate.suggested_hook,
              new_hook: candidate.suggested_hook,
              previous_segment_range: `${candidate.start_segment_id}–${candidate.end_segment_id}`,
              new_segment_range: `${newStartId}–${newEndId}`,
            },
            ...candidate.revisions,
          ],
        };

        return {
          ...prev,
          projects: prev.projects.map((p) =>
            p.project_id === projectId
              ? {
                  ...p,
                  updated_at: now,
                  candidates: p.candidates.map((c) =>
                    c.candidate_id === candidateId ? updatedCandidate : c
                  ),
                }
              : p
          ),
        };
      });

      addToast({
        title: 'Context window expanded & re-verified',
        description: `Re-ran all 7 deterministic checks and 4 AI advisory checks on updated segment range.`,
        variant: 'info',
      });
    },
    [addToast]
  );

  const submitCandidateFeedback = useCallback(
    async (params: {
      projectId: string;
      candidateId: string;
      actionTaken: 'rejected' | 'edited' | 'flagged';
      reasonChips: FeedbackReasonChip[];
      freeText: string;
    }): Promise<FeedbackEvent | null> => {
      const feedbackId = `fb-${Date.now().toString(36)}`;
      let proposedRule: PreferenceRule | null = null;
      let reliableMapping = false;
      let mappingSource: GenerationSourceLabel | 'DETERMINISTIC_MAPPER' =
        'DETERMINISTIC_MAPPER';

      try {
        const res = await fetch('/api/parse-feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            feedbackId,
            projectId: params.projectId,
            reasonChips: params.reasonChips,
            freeText: params.freeText,
          }),
        });
        if (!res.ok) {
          throw new Error(`Feedback mapping failed (HTTP ${res.status}).`);
        }
        const data = await res.json();
        if (!data.proposedRule || typeof data.proposedRule !== 'object') {
          throw new Error('Feedback mapper returned no valid rule proposal.');
        }
        proposedRule = data.proposedRule;
        reliableMapping = Boolean(data.reliableMapping);
        mappingSource = data.mappingSource || 'DETERMINISTIC_MAPPER';
      } catch {
        const localMap = mapCreatorFeedbackToProposedRule({
          feedbackId,
          projectId: params.projectId,
          reasonChips: params.reasonChips,
          freeText: params.freeText,
        });
        proposedRule = localMap.proposedRule;
        reliableMapping = localMap.reliableMapping;
      }

      const now = new Date().toISOString();
      const newEvent: FeedbackEvent = {
        feedback_id: feedbackId,
        project_id: params.projectId,
        candidate_id: params.candidateId,
        action_taken: params.actionTaken,
        reason_chips: params.reasonChips,
        free_text: params.freeText,
        created_at: now,
        proposed_rule: proposedRule,
        confirmation_status: reliableMapping
          ? 'pending_confirmation'
          : 'saved_as_note',
        mapping_source: mappingSource,
      };

      setState((prev) => {
        // If no reliable mapping exists, save as a note requiring manual review (status: 'paused', confirmed_by_user: false)
        const nextPreferences =
          !reliableMapping && proposedRule
            ? [
                {
                  ...proposedRule,
                  status: 'paused' as const,
                  confirmed_by_user: false,
                },
                ...prev.preferences,
              ]
            : prev.preferences;

        return {
          ...prev,
          preferences: nextPreferences,
          projects: prev.projects.map((p) =>
            p.project_id === params.projectId
              ? {
                  ...p,
                  updated_at: now,
                  feedback_events: [newEvent, ...p.feedback_events],
                  candidates: p.candidates.map((c) =>
                    c.candidate_id === params.candidateId
                      ? {
                          ...c,
                          review_status:
                            params.actionTaken === 'rejected'
                              ? 'Rejected'
                              : params.actionTaken === 'flagged'
                              ? 'Flagged for context review'
                              : c.review_status,
                        }
                      : c
                  ),
                }
              : p
          ),
          auditEvents: [
            {
              event_id: `aud-${Date.now().toString(36)}`,
              timestamp: now,
              event_type: 'feedback_submitted',
              description: reliableMapping
                ? `Feedback mapped to proposed rule [${proposedRule?.rule_type}] — awaiting user confirmation.`
                : `Unmapped feedback saved as manual review note [CUSTOM_REVIEW_REQUIRED].`,
              project_id: params.projectId,
              candidate_id: params.candidateId,
            },
            ...prev.auditEvents,
          ],
        };
      });

      if (reliableMapping) {
        addToast({
          title: 'Rule proposed from your correction',
          description: `Review and confirm [${proposedRule?.rule_type}] before saving to Memory.`,
          variant: 'info',
        });
      } else {
        addToast({
          title: 'Saved as manual review note',
          description:
            'Feedback did not map to a deterministic rule; stored as a review note in Memory.',
          variant: 'warning',
        });
      }

      return newEvent;
    },
    [addToast]
  );

  const confirmProposedRule = useCallback(
    (params: {
      projectId: string;
      feedbackId: string;
      updatedRule: PreferenceRule;
    }) => {
      const now = new Date().toISOString();
      const confirmedRule: PreferenceRule = {
        ...params.updatedRule,
        confirmed_by_user: true,
        status: 'active',
        updated_at: now,
      };

      setState((prev) => {
        const exists = prev.preferences.some(
          (r) => r.rule_id === confirmedRule.rule_id
        );
        const nextPreferences = exists
          ? prev.preferences.map((r) =>
              r.rule_id === confirmedRule.rule_id ? confirmedRule : r
            )
          : [confirmedRule, ...prev.preferences];

        const instagramRules = getApplicableActiveRules(
          nextPreferences,
          params.projectId,
          'instagram_reels'
        );
        const youtubeRules = getApplicableActiveRules(
          nextPreferences,
          params.projectId,
          'youtube_shorts'
        );
        const allRuleIds = [...new Set([...instagramRules, ...youtubeRules].map((r) => r.rule_id))];

        const nextState: LoopframeStoreState = {
          ...prev,
          preferences: nextPreferences,
          projects: prev.projects.map((p) =>
            p.project_id === params.projectId
              ? {
                  ...p,
                  updated_at: now,
                  feedback_events: p.feedback_events.map((fe) =>
                    fe.feedback_id === params.feedbackId
                      ? {
                          ...fe,
                          proposed_rule: confirmedRule,
                          confirmation_status: 'confirmed',
                        }
                      : fe
                  ),
                  candidates: p.candidates.map((c) => {
                    const instagramTests = evaluateAllRulesForOutput({
                      rules: instagramRules,
                      hook: c.platform_copy.instagram_reels.hook,
                      caption: c.platform_copy.instagram_reels.caption,
                      sourceExcerpt: c.source_excerpt,
                    });
                    const youtubeTests = evaluateAllRulesForOutput({
                      rules: youtubeRules,
                      hook: c.platform_copy.youtube_shorts.hook,
                      caption: c.platform_copy.youtube_shorts.caption,
                      sourceExcerpt: c.source_excerpt,
                    });
                    return {
                      ...c,
                      active_rules_applied: allRuleIds,
                      rule_test_results: instagramTests,
                      platform_copy: {
                        ...c.platform_copy,
                        instagram_reels: {
                          ...c.platform_copy.instagram_reels,
                          rule_tests: instagramTests,
                        },
                        youtube_shorts: {
                          ...c.platform_copy.youtube_shorts,
                          rule_tests: youtubeTests,
                        },
                      },
                    };
                  }),
                }
              : p
          ),
          auditEvents: [
            {
              event_id: `aud-${Date.now().toString(36)}`,
              timestamp: now,
              event_type: 'rule_confirmed',
              description: `Creator confirmed rule [${confirmedRule.rule_type}] (${confirmedRule.scope} scope) in Preference Ledger.`,
              project_id: params.projectId,
              rule_id: confirmedRule.rule_id,
            },
            ...prev.auditEvents,
          ],
        };
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
        return nextState;
      });

      addToast({
        title: 'Preference saved to Memory',
        description: `Confirmed rule [${confirmedRule.rule_type}] is now active for future generation.`,
        variant: 'success',
      });
    },
    [addToast]
  );

  const dismissProposedRule = useCallback(
    (projectId: string, feedbackId: string) => {
      setState((prev) => ({
        ...prev,
        projects: prev.projects.map((p) =>
          p.project_id === projectId
            ? {
                ...p,
                feedback_events: p.feedback_events.map((fe) =>
                  fe.feedback_id === feedbackId
                    ? { ...fe, confirmation_status: 'dismissed' }
                    : fe
                ),
              }
            : p
        ),
      }));
    },
    []
  );

  const regenerateCandidateWithRules = useCallback(
    async (params: {
      projectId: string;
      candidateId: string;
      simulateRuleFailure?: boolean;
    }) => {
      const latestState = loadStateFromAdapter();
      const project =
        latestState.projects.find((p) => p.project_id === params.projectId) ??
        state.projects.find((p) => p.project_id === params.projectId);
      if (!project) return;
      const candidate = project.candidates.find(
        (c) => c.candidate_id === params.candidateId
      );
      if (!candidate) return;

      const savedPreferences =
        latestState.preferences.length >= state.preferences.length
          ? latestState.preferences
          : state.preferences;
      const activeRules = getApplicableActiveRules(
        savedPreferences,
        params.projectId,
        'instagram_reels'
      );
      const youtubeRules = getApplicableActiveRules(
        savedPreferences,
        params.projectId,
        'youtube_shorts'
      );
      const generationRuleMap = new Map<string, PreferenceRule>();
      [...activeRules, ...youtubeRules].forEach((rule) =>
        generationRuleMap.set(rule.rule_id, rule)
      );
      const generationRules = [...generationRuleMap.values()];

      setIsGenerating(true);
      try {
        const res = await fetch('/api/regenerate-candidate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            candidate,
            segments: project.segments,
            activeRules: generationRules,
            simulateRuleFailure: Boolean(params.simulateRuleFailure),
          }),
        });
        if (!res.ok) {
          throw new Error(`Regeneration failed (${res.status}): ${await res.text()}`);
        }
        const data = await res.json();

        const newHook = String(data.hook || candidate.suggested_hook);
        const newIgCaption = String(
          data.instagramCaption || candidate.platform_copy.instagram_reels.caption
        );
        const newYtHook = String(data.youtubeHook || newHook);
        const newYtCaption = String(
          data.youtubeCaption || candidate.platform_copy.youtube_shorts.caption
        );
        const generationSource: GenerationSourceLabel =
          data.generationSource || 'DEMO FALLBACK';

        const now = new Date().toISOString();

        const ctx = evaluateContextIntegrity({
          allSegments: project.segments,
          startSegmentId: candidate.start_segment_id,
          endSegmentId: candidate.end_segment_id,
          assembledExcerpt: candidate.source_excerpt,
          suggestedHook: newHook,
          captionText: newIgCaption,
        });

        const igTests = evaluateAllRulesForOutput({
          rules: activeRules,
          hook: newHook,
          caption: newIgCaption,
          sourceExcerpt: candidate.source_excerpt,
        });

        const ytTests = evaluateAllRulesForOutput({
          rules: youtubeRules,
          hook: newYtHook,
          caption: newYtCaption,
          sourceExcerpt: candidate.source_excerpt,
        });

        const allPlatformTests = [...igTests, ...ytTests];
        const anyFailed = allPlatformTests.some((t) => t.outcome === 'Fail');
        const hasAdvisories = allPlatformTests.some((t) => t.outcome === 'Advisory');

        setState((prev) => ({
          ...prev,
          preferences: prev.preferences.map((r) => {
            const matchingTests = allPlatformTests.filter((t) => t.rule_id === r.rule_id);
            const matchingTest =
              matchingTests.find((t) => t.outcome === 'Fail') ??
              matchingTests.find((t) => t.outcome === 'Advisory') ??
              matchingTests[0];
            if (!matchingTest) return r;
            return {
              ...r,
              last_applied_at: now,
              last_test_result: matchingTest.outcome,
              last_test_detail: matchingTest.matched_phrase_or_reason,
            };
          }),
          projects: prev.projects.map((p) => {
            if (p.project_id !== params.projectId) return p;
            const updatedCandidates = p.candidates.map((c) =>
              c.candidate_id === params.candidateId
                ? {
                    ...c,
                    suggested_hook: newHook,
                    context_status: ctx.context_status,
                    review_status: 'Needs review' as const,
                    deterministic_checks: ctx.deterministic_checks,
                    advisory_checks: ctx.advisory_checks,
                    active_rules_applied: generationRules.map((r) => r.rule_id),
                    rule_test_results: igTests,
                    generation_source: generationSource,
                    risk_flags: [
                      ...(anyFailed ? ['Failed deterministic post-generation rule test — review required'] : []),
                      ...(hasAdvisories ? ['AI advisory outcome — human review required'] : []),
                    ],
                    platform_copy: {
                      instagram_reels: {
                        ...c.platform_copy.instagram_reels,
                        hook: newHook,
                        caption: newIgCaption,
                        rule_tests: igTests,
                        updated_at: now,
                      },
                      youtube_shorts: {
                        ...c.platform_copy.youtube_shorts,
                        hook: newYtHook,
                        caption: newYtCaption,
                        rule_tests: ytTests,
                        updated_at: now,
                      },
                    },
                    revisions: [
                      {
                        revision_id: `rev-${Date.now().toString(36)}`,
                        timestamp: now,
                        summary: data.summary || `Regenerated with ${generationRules.length} active rule(s).`,
                        previous_hook: c.suggested_hook,
                        new_hook: newHook,
                        previous_segment_range: `${c.start_segment_id}–${c.end_segment_id}`,
                        new_segment_range: `${c.start_segment_id}–${c.end_segment_id}`,
                      },
                      ...c.revisions,
                    ],
                  }
                : c
            );
            const allCandidatesVerified =
              updatedCandidates.length > 0 &&
              generationRules.length > 0 &&
              updatedCandidates.every((candidate) =>
                instagramRules.every((rule) =>
                  candidate.platform_copy.instagram_reels.rule_tests.some(
                    (test) => test.rule_id === rule.rule_id && test.outcome === 'Pass'
                  )
                ) &&
                youtubeRules.every((rule) =>
                  candidate.platform_copy.youtube_shorts.rule_tests.some(
                    (test) => test.rule_id === rule.rule_id && test.outcome === 'Pass'
                  )
                )
              );
            return {
              ...p,
              updated_at: now,
              status: allCandidatesVerified ? 'Rules verified' : 'In review',
              candidates: updatedCandidates,
            };
          }),
          auditEvents: [
            {
              event_id: `aud-${Date.now().toString(36)}`,
              timestamp: now,
              event_type: 'rule_tested',
              description: anyFailed
                ? `Post-generation deterministic test FAILED on ${params.candidateId}. Preference was NOT marked as compliant.`
                : hasAdvisories
                  ? `Regenerated ${params.candidateId}; advisory checks still require human review.`
                  : `Regenerated ${params.candidateId} with ${generationRules.length} rules; all checks passed for this candidate.`,
              project_id: params.projectId,
              candidate_id: params.candidateId,
            },
            ...prev.auditEvents,
          ],
        }));

        if (anyFailed) {
          const failedRule = allPlatformTests.find((t) => t.outcome === 'Fail');
          addToast({
            title: 'Rule test failed',
            description: `${failedRule?.rule_type}: ${failedRule?.matched_phrase_or_reason}`,
            variant: 'error',
          });
        } else if (hasAdvisories) {
          addToast({
            title: 'Human review still required',
            description: `${allPlatformTests.filter((t) => t.outcome === 'Advisory').length} advisory result(s) need review. No deterministic failure was detected (${generationSource}).`,
            variant: 'warning',
          });
        } else {
          addToast({
            title: 'Regenerated & verified against active rules',
            description: `All ${allPlatformTests.length} platform rule results passed (${generationSource}).`,
            variant: 'success',
          });
        }
      } finally {
        setIsGenerating(false);
      }
    },
    [state.projects, state.preferences, addToast]
  );

  const updateCandidateCopyAndRecheck = useCallback(
    (params: {
      projectId: string;
      candidateId: string;
      platform: DestinationPlatform;
      hook: string;
      caption: string;
      cta?: string;
    }) => {
      const now = new Date().toISOString();
      setState((prev) => {
        const project = prev.projects.find(
          (p) => p.project_id === params.projectId
        );
        if (!project) return prev;
        const candidate = project.candidates.find(
          (c) => c.candidate_id === params.candidateId
        );
        if (!candidate) return prev;

        const activeRules = getApplicableActiveRules(
          prev.preferences,
          params.projectId,
          params.platform
        );
        const ruleTests = evaluateAllRulesForOutput({
          rules: activeRules,
          hook: params.hook,
          caption: params.caption,
          sourceExcerpt: candidate.source_excerpt,
        });

        const ctx = evaluateContextIntegrity({
          allSegments: project.segments,
          startSegmentId: candidate.start_segment_id,
          endSegmentId: candidate.end_segment_id,
          assembledExcerpt: candidate.source_excerpt,
          suggestedHook: params.hook,
          captionText: params.caption,
        });

        const updatedPlatformCopy = {
          ...candidate.platform_copy,
          [params.platform]: {
            ...candidate.platform_copy[params.platform],
            hook: params.hook,
            caption: params.caption,
            cta: params.cta ?? candidate.platform_copy[params.platform].cta,
            rule_tests: ruleTests,
            updated_at: now,
          },
        };

        const updatedCandidate: ClipCandidate = {
          ...candidate,
          suggested_hook:
            params.platform === 'instagram_reels'
              ? params.hook
              : candidate.suggested_hook,
          platform_copy: updatedPlatformCopy,
          context_status: ctx.context_status,
          deterministic_checks: ctx.deterministic_checks,
          advisory_checks: ctx.advisory_checks,
          rule_test_results: ruleTests,
          revisions: [
            {
              revision_id: `rev-${Date.now().toString(36)}`,
              timestamp: now,
              summary: `Manual edit to ${
                params.platform === 'instagram_reels'
                  ? 'Instagram Reels'
                  : 'YouTube Shorts'
              } copy.`,
              previous_hook: candidate.suggested_hook,
              new_hook: params.hook,
              previous_segment_range: `${candidate.start_segment_id}–${candidate.end_segment_id}`,
              new_segment_range: `${candidate.start_segment_id}–${candidate.end_segment_id}`,
            },
            ...candidate.revisions,
          ],
        };

        // Also sync to libraryItems if this candidate is already in Library
        const nextLibrary = prev.libraryItems.map((item) =>
          item.candidate_id === params.candidateId
            ? {
                ...item,
                platform_copy: updatedPlatformCopy,
              }
            : item
        );

        return {
          ...prev,
          libraryItems: nextLibrary,
          projects: prev.projects.map((p) =>
            p.project_id === params.projectId
              ? {
                  ...p,
                  updated_at: now,
                  candidates: p.candidates.map((c) =>
                    c.candidate_id === params.candidateId
                      ? updatedCandidate
                      : c
                  ),
                }
              : p
          ),
        };
      });

      addToast({
        title: 'Changes saved',
        description: 'Platform copy updated and deterministic rule checks re-evaluated.',
        variant: 'success',
      });
    },
    [addToast]
  );

  const setCandidateReviewStatus = useCallback(
    (
      projectId: string,
      candidateId: string,
      status:
        | 'Approved'
        | 'Rejected'
        | 'Flagged for context review'
        | 'Needs review'
    ) => {
      const now = new Date().toISOString();
      setState((prev) => {
        const project = prev.projects.find((p) => p.project_id === projectId);
        if (!project) return prev;
        const candidate = project.candidates.find(
          (c) => c.candidate_id === candidateId
        );
        if (!candidate) return prev;

        let nextLibraryItems = [...prev.libraryItems];
        const existingIdx = nextLibraryItems.findIndex(
          (item) => item.candidate_id === candidateId
        );

        if (status === 'Approved') {
          const libEntry: LibraryItem = {
            item_id:
              existingIdx >= 0
                ? nextLibraryItems[existingIdx].item_id
                : `lib-${Date.now().toString(36)}`,
            project_id: project.project_id,
            project_name: project.name,
            candidate_id: candidate.candidate_id,
            title: candidate.title,
            source_excerpt: candidate.source_excerpt,
            start_timecode: formatTimecode(candidate.start_ms),
            end_timecode: formatTimecode(candidate.end_ms),
            duration_sec: candidate.duration_sec,
            status: 'Approved',
            platform_copy: candidate.platform_copy,
            approved_at: now,
            is_demo_data: project.is_demo_data,
          };

          if (existingIdx >= 0) {
            nextLibraryItems[existingIdx] = libEntry;
          } else {
            nextLibraryItems = [libEntry, ...nextLibraryItems];
          }
        } else if (existingIdx >= 0) {
          nextLibraryItems[existingIdx] = {
            ...nextLibraryItems[existingIdx],
            status: status === 'Rejected' ? 'Rejected' : 'Needs review',
          };
        }

        return {
          ...prev,
          libraryItems: nextLibraryItems,
          projects: prev.projects.map((p) =>
            p.project_id === projectId
              ? {
                  ...p,
                  updated_at: now,
                  status:
                    status === 'Approved' ? 'Ready to export' : p.status,
                  candidates: p.candidates.map((c) =>
                    c.candidate_id === candidateId
                      ? { ...c, review_status: status }
                      : c
                  ),
                }
              : p
          ),
          auditEvents: [
            {
              event_id: `aud-${Date.now().toString(36)}`,
              timestamp: now,
              event_type: 'candidate_approved',
              description: `Candidate "${candidate.title}" marked as ${status}.`,
              project_id: projectId,
              candidate_id: candidateId,
            },
            ...prev.auditEvents,
          ],
        };
      });

      if (status === 'Approved') {
        addToast({
          title: 'Candidate approved',
          description: 'Added to Library for copy & timecode export.',
          variant: 'success',
        });
      } else {
        addToast({
          title: `Status updated: ${status}`,
          variant: 'info',
        });
      }
    },
    [addToast]
  );

  const updatePreferenceRule = useCallback(
    (ruleId: string, updates: Partial<PreferenceRule>) => {
      const now = new Date().toISOString();
      setState((prev) => ({
        ...prev,
        preferences: prev.preferences.map((r) =>
          r.rule_id === ruleId ? { ...r, ...updates, updated_at: now } : r
        ),
        auditEvents: [
          {
            event_id: `aud-${Date.now().toString(36)}`,
            timestamp: now,
            event_type: 'rule_updated',
            description: `Updated preference rule ${ruleId}.`,
            rule_id: ruleId,
          },
          ...prev.auditEvents,
        ],
      }));
      addToast({
        title: 'Preference saved',
        description: 'Rule ledger updated.',
        variant: 'success',
      });
    },
    [addToast]
  );

  const undoDeletePreferenceRule = useCallback(() => {
    setState((prev) => {
      if (!prev.lastDeletedPreference) return prev;
      const restored: PreferenceRule = {
        ...prev.lastDeletedPreference,
        status: prev.lastDeletedPreference.status,
        updated_at: new Date().toISOString(),
      };
      return {
        ...prev,
        lastDeletedPreference: null,
        preferences: prev.preferences.map((r) =>
          r.rule_id === restored.rule_id ? restored : r
        ),
      };
    });
    addToast({
      title: 'Preference restored',
      description: 'Undo succeeded: the rule’s previous state was restored.',
      variant: 'success',
    });
  }, [addToast]);

  const deletePreferenceRule = useCallback(
    (ruleId: string) => {
      const now = new Date().toISOString();
      setState((prev) => {
        const target = prev.preferences.find((r) => r.rule_id === ruleId) ?? null;
        return {
          ...prev,
          lastDeletedPreference: target,
          preferences: prev.preferences.map((r) =>
            r.rule_id === ruleId
              ? { ...r, status: 'deleted', updated_at: now }
              : r
          ),
        };
      });

      addToast({
        title: 'Preference moved to deleted',
        description: 'Rule will no longer be injected into future generation.',
        variant: 'warning',
        undoActionLabel: 'Undo delete',
        onUndo: undoDeletePreferenceRule,
      });
    },
    [addToast, undoDeletePreferenceRule]
  );

  const resetDemoData = useCallback(() => {
    const freshSeed = buildInitialSeedState();
    setState(freshSeed);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(freshSeed));
    addToast({
      title: 'Demo data reset complete',
      description:
        'Restored original sample project, pending rule confirmation, and seeded preferences.',
      variant: 'info',
    });
  }, [addToast]);

  const exportUserDataJson = useCallback(() => {
    return JSON.stringify(state, null, 2);
  }, [state]);

  const value = useMemo<LoopframeContextValue>(
    () => ({
      state,
      currentPath,
      navigate,
      isLoading,
      isGenerating,
      saveError,
      liveAiConfigured,
      toasts,
      addToast,
      dismissToast,
      retrySave,
      updateProfile,
      createProjectFromTranscript,
      expandCandidateSegments,
      submitCandidateFeedback,
      confirmProposedRule,
      dismissProposedRule,
      regenerateCandidateWithRules,
      updateCandidateCopyAndRecheck,
      setCandidateReviewStatus,
      updatePreferenceRule,
      deletePreferenceRule,
      undoDeletePreferenceRule,
      resetDemoData,
      exportUserDataJson,
    }),
    [
      state,
      currentPath,
      navigate,
      isLoading,
      isGenerating,
      saveError,
      liveAiConfigured,
      toasts,
      addToast,
      dismissToast,
      retrySave,
      updateProfile,
      createProjectFromTranscript,
      expandCandidateSegments,
      submitCandidateFeedback,
      confirmProposedRule,
      dismissProposedRule,
      regenerateCandidateWithRules,
      updateCandidateCopyAndRecheck,
      setCandidateReviewStatus,
      updatePreferenceRule,
      deletePreferenceRule,
      undoDeletePreferenceRule,
      resetDemoData,
      exportUserDataJson,
    ]
  );

  return (
    <LoopframeContext.Provider value={value}>
      {children}
    </LoopframeContext.Provider>
  );
};

export function useLoopframe(): LoopframeContextValue {
  const ctx = useContext(LoopframeContext);
  if (!ctx) {
    throw new Error('useLoopframe must be used within a LoopframeProvider');
  }
  return ctx;
}
