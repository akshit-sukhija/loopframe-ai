import {
  AuditEvent,
  ClipCandidate,
  CreatorProfile,
  EvaluationTestCase,
  FeedbackEvent,
  LibraryItem,
  LoopframeStoreState,
  PreferenceRule,
  ProjectRecord,
} from '../types/loopframe';
import { evaluateContextIntegrity } from './contextChecks';
import { evaluateAllRulesForOutput, getApplicableActiveRules } from './ruleEngine';
import {
  assembleCandidateFromSegments,
  formatTimecode,
  parseTimestampedTranscript,
} from './transcriptParser';

export const SAMPLE_TRANSCRIPT_RAW = `[00:00:05] Marcus Vance: Welcome back to Deep Work Architecture. Today we are joined by cognitive science educator Dr. Elena Rostova to unpack how adults actually learn complex technical subjects without burning out.
[00:00:19] Dr. Elena Rostova: Thanks Marcus. The biggest misconception I see in adult learners is treating a dense textbook or documentation set like a novel you read from page one to page four hundred.
[00:00:34] Dr. Elena Rostova: When novices study a complex system, they often highlight every second sentence because everything feels equally urgent. That creates familiarity, not retrieval strength.
[00:00:49] Marcus Vance: So if linear reading and highlighting fail, what does the research say we should do during the first hour with a new subject?
[00:01:01] Dr. Elena Rostova: Start by building a coarse mental model of the problem space. Write down three concrete questions the system is designed to solve before you memorize any terminology.
[00:01:18] Dr. Elena Rostova: In our classroom trials, students who sketched a rough concept map before reading the chapter recalled core mechanisms much better a week later.
[00:01:33] Dr. Elena Rostova: You can compress initial orientation by mapping how three core concepts connect on a single blank page.
[00:01:46] Dr. Elena Rostova: However, that rapid mapping only works if you have already built the foundational vocabulary first; without basic definitions, a concept map turns into guesswork.
[00:02:04] Marcus Vance: That is a critical distinction. People love the shortcut of drawing a quick map, but they skip the vocabulary prerequisite.
[00:02:16] Dr. Elena Rostova: Exactly. Unless you can define the three or four primary nouns in plain language, jumping straight to synthesis creates fragile illusions of competence.
[00:02:32] Dr. Elena Rostova: Once those definitions are solid, the most reliable lever is self-explanation. Close the notes and explain out loud why step A forces step B to happen.
[00:02:49] Dr. Elena Rostova: Where your explanation stalls or gets vague is the exact boundary of your understanding. That friction is not failure; it is diagnostic signal.
[00:03:05] Dr. Elena Rostova: In deliberate practice, ten minutes of honest retrieval with closed notes beats two hours of passive re-reading almost every time.
[00:03:21] Marcus Vance: How do you keep learners from getting discouraged when they hit those retrieval gaps?
[00:03:32] Dr. Elena Rostova: Normalize the stall. Tell yourself before you open the notebook that finding two specific blind spots is the entire win condition for today's thirty-minute session.`;

export const SECOND_SAMPLE_TRANSCRIPT_RAW = `[00:00:04] Host: In systems engineering, why do post-mortems so often fail to prevent repeat incidents?
[00:00:15] Priya Nair: Because teams stop at "human error" as the root cause instead of asking why the interface made the dangerous action look routine.
[00:00:31] Priya Nair: However, adding more confirmation dialogs rarely fixes the issue unless the underlying state feedback is visible before the operator clicks.
[00:00:48] Priya Nair: Good resilience engineering changes the constraints of the tool, not just the checklist in the wiki.`;

export function buildInitialSeedState(): LoopframeStoreState {
  const parsed = parseTimestampedTranscript(SAMPLE_TRANSCRIPT_RAW);
  const segments = parsed.segments;

  const initialPreferences: PreferenceRule[] = [
    {
      rule_id: 'rule-seed-concise',
      rule_type: 'PREFER_CONCISE_HOOKS',
      human_readable_description:
        'Keep generated hooks at or below 14 words so the core educational premise lands immediately.',
      scope: 'global',
      scope_reference: 'all',
      source_feedback_id: 'fb-seed-00',
      source_feedback_text: 'Keep hooks under 14 words without filler.',
      created_at: '2026-10-29T14:20:00.000Z',
      updated_at: '2026-10-29T14:20:00.000Z',
      status: 'active',
      confirmed_by_user: true,
      rule_parameters: { maxWords: 14 },
      last_applied_at: '2026-10-30T18:10:00.000Z',
      last_test_result: 'Pass',
      last_test_detail: 'Hook word count is 11/14 words.',
      is_demo_data: true,
    },
    {
      rule_id: 'rule-seed-jargon',
      rule_type: 'AVOID_JARGON',
      human_readable_description:
        'Avoid dense academic jargon ("epistemological", "metacognitive", "pedagogical", "ontological") in top-line hooks.',
      scope: 'project',
      scope_reference: 'proj-sample-01',
      source_feedback_id: 'fb-seed-01',
      source_feedback_text:
        'Do not put heavy academic jargon like epistemological or metacognitive in the hook.',
      created_at: '2026-10-30T09:15:00.000Z',
      updated_at: '2026-10-30T09:15:00.000Z',
      status: 'active',
      confirmed_by_user: true,
      rule_parameters: {
        jargonTerms: [
          'epistemological',
          'metacognitive',
          'pedagogical',
          'heuristic',
          'ontological',
        ],
      },
      last_applied_at: '2026-10-30T18:10:00.000Z',
      last_test_result: 'Pass',
      last_test_detail: 'No restricted jargon terms found (5 terms checked).',
      is_demo_data: true,
    },
    {
      rule_id: 'rule-seed-paused-topic',
      rule_type: 'INCLUDE_CLEAR_TOPIC',
      human_readable_description:
        'Require explicit mention of "retrieval" or "mental model" in YouTube Shorts copy.',
      scope: 'platform',
      scope_reference: 'youtube_shorts',
      source_feedback_id: 'fb-seed-02',
      source_feedback_text:
        'For YouTube Shorts, always include the phrase "mental model" for search clarity.',
      created_at: '2026-10-28T11:00:00.000Z',
      updated_at: '2026-10-29T16:45:00.000Z',
      status: 'paused',
      confirmed_by_user: true,
      rule_parameters: { requiredTopicPhrase: 'mental model' },
      last_applied_at: '2026-10-29T12:00:00.000Z',
      last_test_result: 'Pass',
      last_test_detail: 'Verified required topic phrase "mental model" is present.',
      is_demo_data: true,
    },
  ];

  const activeRules = getApplicableActiveRules(
    initialPreferences,
    'proj-sample-01'
  );

  // Candidate 1: Exaggerated hook (Demonstrates Signature Loop + Failed Rule Test if AVOID_EXAGGERATED_HOOKS is tested before regeneration)
  const c1Asm = assembleCandidateFromSegments(segments, 'seg-02', 'seg-05');
  const c1Hook =
    'This 10x Secret Learning Hack Lets You Master Any Complex Topic Instantly';
  const c1IgCaption =
    'Stop reading textbooks from page one. Use this 10x secret hack to master any complex system overnight by writing down three concrete questions first.';
  const c1YtCaption =
    'Why linear reading fails for technical subjects: Dr. Elena Rostova explains how starting with three concrete problem-space questions builds a coarse mental model before memorizing terminology.';

  const c1Context = evaluateContextIntegrity({
    allSegments: segments,
    startSegmentId: 'seg-02',
    endSegmentId: 'seg-05',
    assembledExcerpt: c1Asm.sourceExcerpt,
    suggestedHook: c1Hook,
    captionText: c1IgCaption,
  });

  const c1RuleTests = evaluateAllRulesForOutput({
    rules: activeRules,
    hook: c1Hook,
    caption: c1IgCaption,
    sourceExcerpt: c1Asm.sourceExcerpt,
  });

  // Candidate 2: Missing qualification / context warning (seg-06 to seg-07; omits seg-08 which starts with "However, that rapid mapping only works if...")
  const c2Asm = assembleCandidateFromSegments(segments, 'seg-06', 'seg-07');
  const c2Hook =
    'How a Single-Page Concept Map Replaces Hours of Chapter Notes';
  const c2IgCaption =
    'In classroom trials, sketching how three core concepts connect on a blank page before reading helped students recall core mechanisms a week later.';
  const c2YtCaption =
    'Concept Mapping for Technical Learning: How sketching three core concept connections before reading improves one-week recall in adult learners.';

  const c2Context = evaluateContextIntegrity({
    allSegments: segments,
    startSegmentId: 'seg-06',
    endSegmentId: 'seg-07',
    assembledExcerpt: c2Asm.sourceExcerpt,
    suggestedHook: c2Hook,
    captionText: c2IgCaption,
  });

  const c2RuleTests = evaluateAllRulesForOutput({
    rules: activeRules,
    hook: c2Hook,
    caption: c2IgCaption,
    sourceExcerpt: c2Asm.sourceExcerpt,
  });

  // Candidate 3: Acceptable candidate (seg-11 to seg-13; self-contained, accurate, passes all 7 checks)
  const c3Asm = assembleCandidateFromSegments(segments, 'seg-11', 'seg-13');
  const c3Hook =
    'Why 10 Minutes of Closed-Note Retrieval Beats 2 Hours of Re-Reading';
  const c3IgCaption =
    'Close your notes and explain out loud why step A forces step B to happen. Where your explanation stalls is your exact learning boundary—and 10 minutes of retrieval beats 2 hours of passive re-reading.';
  const c3YtCaption =
    'Self-Explanation & Retrieval Practice: Dr. Elena Rostova on using closed-note explanation stalls as diagnostic signals when learning complex systems.';

  const c3Context = evaluateContextIntegrity({
    allSegments: segments,
    startSegmentId: 'seg-11',
    endSegmentId: 'seg-13',
    assembledExcerpt: c3Asm.sourceExcerpt,
    suggestedHook: c3Hook,
    captionText: c3IgCaption,
  });

  const c3RuleTests = evaluateAllRulesForOutput({
    rules: activeRules,
    hook: c3Hook,
    caption: c3IgCaption,
    sourceExcerpt: c3Asm.sourceExcerpt,
  });

  const candidates: ClipCandidate[] = [
    {
      candidate_id: 'cand-sample-01',
      project_id: 'proj-sample-01',
      title: 'Coarse Mental Models vs. Linear Highlighting',
      start_segment_id: 'seg-02',
      end_segment_id: 'seg-05',
      source_segment_ids: c1Asm.sourceSegmentIds,
      source_excerpt: c1Asm.sourceExcerpt,
      start_ms: c1Asm.startMs,
      end_ms: c1Asm.endMs,
      duration_sec: c1Asm.durationSec,
      reason:
        'Contrasts passive textbook highlighting with formulating three concrete problem-space questions.',
      suggested_hook: c1Hook,
      platform_targets: ['instagram_reels', 'youtube_shorts'],
      platform_copy: {
        instagram_reels: {
          destination: 'instagram_reels',
          hook: c1Hook,
          caption: c1IgCaption,
          cta: 'What technical topic are you mapping this week?',
          hashtags: ['#CognitiveScience', '#DeepWork', '#AdultLearning'],
          rule_tests: c1RuleTests,
          updated_at: '2026-10-31T07:30:00.000Z',
        },
        youtube_shorts: {
          destination: 'youtube_shorts',
          hook: 'Why Highlighting Fails & How to Build a Coarse Mental Model First',
          caption: c1YtCaption,
          cta: 'Watch the full episode on Deep Work Architecture.',
          hashtags: ['#LearningSystems', '#MentalModels', '#StudyResearch'],
          rule_tests: evaluateAllRulesForOutput({
            rules: getApplicableActiveRules(
              initialPreferences,
              'proj-sample-01',
              'youtube_shorts'
            ),
            hook: 'Why Highlighting Fails & How to Build a Coarse Mental Model First',
            caption: c1YtCaption,
            sourceExcerpt: c1Asm.sourceExcerpt,
          }),
          updated_at: '2026-10-31T07:30:00.000Z',
        },
      },
      risk_flags: [
        'Exaggerated hook framing ("10x", "Secret", "Hack", "Instantly") not present in source',
      ],
      candidate_type: 'Contrarian Insight',
      context_status: c1Context.context_status,
      review_status: 'Rejected',
      deterministic_checks: c1Context.deterministic_checks,
      advisory_checks: c1Context.advisory_checks,
      active_rules_applied: activeRules.map((r) => r.rule_id),
      rule_test_results: c1RuleTests,
      revisions: [],
      generation_source: 'DEMO DATA',
      uncertainty_note:
        'Hook introduces exaggerated superlatives ("10x", "Secret", "Instantly") not supported by Dr. Rostova’s transcript.',
    },
    {
      candidate_id: 'cand-sample-02',
      project_id: 'proj-sample-01',
      title: 'Concept Mapping Before Reading Chapters',
      start_segment_id: 'seg-06',
      end_segment_id: 'seg-07',
      source_segment_ids: c2Asm.sourceSegmentIds,
      source_excerpt: c2Asm.sourceExcerpt,
      start_ms: c2Asm.startMs,
      end_ms: c2Asm.endMs,
      duration_sec: c2Asm.durationSec,
      reason:
        'Highlights classroom trial evidence on sketching concept maps prior to chapter reading.',
      suggested_hook: c2Hook,
      platform_targets: ['instagram_reels', 'youtube_shorts'],
      platform_copy: {
        instagram_reels: {
          destination: 'instagram_reels',
          hook: c2Hook,
          caption: c2IgCaption,
          cta: 'Try mapping three core concepts before your next chapter.',
          hashtags: ['#ConceptMapping', '#LearningScience'],
          rule_tests: c2RuleTests,
          updated_at: '2026-10-31T07:30:00.000Z',
        },
        youtube_shorts: {
          destination: 'youtube_shorts',
          hook: c2Hook,
          caption: c2YtCaption,
          cta: 'Subscribe for research-backed learning breakdowns.',
          hashtags: ['#ConceptMap', '#CognitivePsychology'],
          rule_tests: c2RuleTests,
          updated_at: '2026-10-31T07:30:00.000Z',
        },
      },
      risk_flags: [
        'Missing qualification in adjacent segment seg-08 ("However, that rapid mapping only works if you have already built the foundational vocabulary first")',
      ],
      candidate_type: 'Empirical Finding',
      context_status: c2Context.context_status,
      review_status: 'Flagged for context review',
      deterministic_checks: c2Context.deterministic_checks,
      advisory_checks: c2Context.advisory_checks,
      active_rules_applied: activeRules.map((r) => r.rule_id),
      rule_test_results: c2RuleTests,
      revisions: [],
      generation_source: 'DEMO DATA',
      uncertainty_note:
        'Adjacent segment seg-08 begins with "However, that rapid mapping only works if..." — expand clip to seg-08 to preserve speaker qualification.',
    },
    {
      candidate_id: 'cand-sample-03',
      project_id: 'proj-sample-01',
      title: 'Self-Explanation & Retrieval Diagnostic Signal',
      start_segment_id: 'seg-11',
      end_segment_id: 'seg-13',
      source_segment_ids: c3Asm.sourceSegmentIds,
      source_excerpt: c3Asm.sourceExcerpt,
      start_ms: c3Asm.startMs,
      end_ms: c3Asm.endMs,
      duration_sec: c3Asm.durationSec,
      reason:
        'Complete, self-contained explanation of closed-note self-explanation with explicit time comparison from the transcript.',
      suggested_hook: c3Hook,
      platform_targets: ['instagram_reels', 'youtube_shorts'],
      platform_copy: {
        instagram_reels: {
          destination: 'instagram_reels',
          hook: c3Hook,
          caption: c3IgCaption,
          cta: 'Try a 10-minute closed-note explanation after your next study block.',
          hashtags: ['#RetrievalPractice', '#SelfExplanation', '#StudyMethod'],
          rule_tests: c3RuleTests,
          updated_at: '2026-10-31T07:30:00.000Z',
        },
        youtube_shorts: {
          destination: 'youtube_shorts',
          hook: c3Hook,
          caption: c3YtCaption,
          cta: 'Full interview in the channel description.',
          hashtags: ['#DeliberatePractice', '#ActiveRecall', '#Education'],
          rule_tests: c3RuleTests,
          updated_at: '2026-10-31T07:30:00.000Z',
        },
      },
      risk_flags: [],
      candidate_type: 'Core Method',
      context_status: c3Context.context_status,
      review_status: 'Needs review',
      deterministic_checks: c3Context.deterministic_checks,
      advisory_checks: c3Context.advisory_checks,
      active_rules_applied: activeRules.map((r) => r.rule_id),
      rule_test_results: c3RuleTests,
      revisions: [],
      generation_source: 'DEMO DATA',
    },
  ];

  // Seeded creator feedback event rejecting exaggerated hooks + proposed rule awaiting confirmation
  const seededProposedRule: PreferenceRule = {
    rule_id: 'rule-seed-proposed-exaggeration',
    rule_type: 'AVOID_EXAGGERATED_HOOKS',
    human_readable_description:
      'Avoid exaggerated hooks, superlatives, and hyped multipliers ("10x", "secret", "instantly", "hack"); keep the original educational context.',
    scope: 'project',
    scope_reference: 'proj-sample-01',
    source_feedback_id: 'fb-sample-01',
    source_feedback_text:
      'Avoid exaggerated hooks. Keep the original educational context.',
    created_at: '2026-10-31T07:45:00.000Z',
    updated_at: '2026-10-31T07:45:00.000Z',
    status: 'active',
    confirmed_by_user: false,
    rule_parameters: {
      forbiddenTerms: [
        '10x',
        'secret',
        'instantly',
        'never fail',
        'guaranteed',
        'hack',
        'destroy',
        'everything you know is wrong',
        'overnight',
        'magic',
        'effortless',
        '100%',
        'unstoppable',
      ],
    },
    is_demo_data: true,
  };

  const initialFeedbackEvents: FeedbackEvent[] = [
    {
      feedback_id: 'fb-sample-01',
      project_id: 'proj-sample-01',
      candidate_id: 'cand-sample-01',
      action_taken: 'rejected',
      reason_chips: ['exaggerated hook', 'missing context'],
      free_text:
        'Avoid exaggerated hooks. Keep the original educational context.',
      created_at: '2026-10-31T07:45:00.000Z',
      proposed_rule: seededProposedRule,
      confirmation_status: 'pending_confirmation',
      mapping_source: 'DEMO DATA',
    },
  ];

  const sampleProject: ProjectRecord = {
    project_id: 'proj-sample-01',
    name: 'Ep. 42 — Building Mental Models for Complex Systems (Dr. Elena Rostova)',
    source_type: 'Sample transcript',
    created_at: '2026-10-31T07:15:00.000Z',
    updated_at: '2026-10-31T07:45:00.000Z',
    status: 'In review',
    raw_transcript: SAMPLE_TRANSCRIPT_RAW,
    segments,
    candidates,
    feedback_events: initialFeedbackEvents,
    is_demo_data: true,
    generation_mode: 'DEMO DATA',
  };

  // Seeded approved item in Library so Library page is immediately demonstrable
  const initialLibraryItems: LibraryItem[] = [
    {
      item_id: 'lib-seed-01',
      project_id: 'proj-sample-01',
      project_name:
        'Ep. 42 — Building Mental Models for Complex Systems (Dr. Elena Rostova)',
      candidate_id: 'cand-sample-03',
      title: 'Self-Explanation & Retrieval Diagnostic Signal',
      source_excerpt: c3Asm.sourceExcerpt,
      start_timecode: formatTimecode(c3Asm.startMs),
      end_timecode: formatTimecode(c3Asm.endMs),
      duration_sec: c3Asm.durationSec,
      status: 'Approved',
      platform_copy: candidates[2].platform_copy,
      approved_at: '2026-10-31T07:50:00.000Z',
      is_demo_data: true,
    },
  ];

  const initialProfile: CreatorProfile = {
    creatorName: 'Deep Work Architecture Podcast',
    contentCategory: 'Cognitive Science & Technical Education',
    preferredTone: 'Measured, Evidence-Grounded, Conversational',
    onboardingCompleted: false,
    updatedAt: '2026-10-31T07:00:00.000Z',
  };

  const initialAuditEvents: AuditEvent[] = [
    {
      event_id: 'aud-01',
      timestamp: '2026-10-31T07:15:00.000Z',
      event_type: 'project_created',
      description:
        'Loaded seeded sample project "Ep. 42 — Building Mental Models for Complex Systems" (15 transcript segments).',
      project_id: 'proj-sample-01',
    },
    {
      event_id: 'aud-02',
      timestamp: '2026-10-31T07:30:00.000Z',
      event_type: 'candidate_generated',
      description:
        'Assembled 3 source-grounded clip candidates from segment IDs with 7 deterministic checks.',
      project_id: 'proj-sample-01',
    },
    {
      event_id: 'aud-03',
      timestamp: '2026-10-31T07:45:00.000Z',
      event_type: 'feedback_submitted',
      description:
        'Creator rejected cand-sample-01 ("Avoid exaggerated hooks. Keep the original educational context.") → Proposed rule AVOID_EXAGGERATED_HOOKS awaiting confirmation.',
      project_id: 'proj-sample-01',
      candidate_id: 'cand-sample-01',
    },
  ];

  return {
    profile: initialProfile,
    projects: [sampleProject],
    preferences: initialPreferences,
    libraryItems: initialLibraryItems,
    auditEvents: initialAuditEvents,
    evaluationCases: SEED_EVALUATION_CASES,
    lastDeletedPreference: null,
  };
}

/**
 * 24 seeded correction test cases for Section 9 ("Seed 20–30 correction test cases.
 * Include examples for each P0 rule type. Include negative cases where a rule should not trigger.
 * Label the dataset 'small prototype evaluation'").
 */
export const SEED_EVALUATION_CASES: EvaluationTestCase[] = [
  {
    case_id: 'eval-01',
    title: 'Superlative multiplier ("10x secret hack") stripped on regeneration',
    rule_type: 'AVOID_EXAGGERATED_HOOKS',
    is_negative_case: false,
    creator_feedback: 'Avoid exaggerated hooks. Keep the original educational context.',
    source_excerpt:
      'Start by building a coarse mental model of the problem space. Write down three concrete questions the system is designed to solve.',
    candidate_hook_before:
      'This 10x Secret Learning Hack Lets You Master Any Topic Instantly',
    regenerated_hook_after:
      'Write Down 3 Problem-Space Questions Before Memorizing New Terminology',
    regenerated_caption_after:
      'Before reading a textbook linearly, build a coarse mental model by writing down three concrete questions the system solves.',
    rule_parameters: {
      forbiddenTerms: ['10x', 'secret', 'instantly', 'hack', 'guaranteed'],
    },
    feedback_mapped_correctly: true,
    user_confirmed_rule: true,
    expected_test_outcome: 'Pass',
    actual_test_outcome: 'Pass',
    matched_phrase_or_reason:
      '0 matches across 13 configured superlative/exaggerated phrases.',
    is_false_positive: false,
    is_false_negative: false,
    source_meaning_preserved: true,
  },
  {
    case_id: 'eval-02',
    title: 'Exaggerated phrase ("overnight") caught in failed regeneration',
    rule_type: 'AVOID_EXAGGERATED_HOOKS',
    is_negative_case: false,
    creator_feedback: 'Stop promising instant or overnight mastery in the hook.',
    source_excerpt:
      'In deliberate practice, ten minutes of honest retrieval with closed notes beats two hours of passive re-reading.',
    candidate_hook_before: 'Destroy Exam Anxiety Overnight With One Weird Recall Trick',
    regenerated_hook_after:
      'How Closed-Note Retrieval Transforms Your Study Habits Overnight',
    regenerated_caption_after:
      'Ten minutes of honest retrieval with closed notes beats two hours of passive re-reading.',
    rule_parameters: {
      forbiddenTerms: ['10x', 'secret', 'instantly', 'overnight', 'destroy'],
    },
    feedback_mapped_correctly: true,
    user_confirmed_rule: true,
    expected_test_outcome: 'Fail',
    actual_test_outcome: 'Fail',
    matched_phrase_or_reason:
      'Matched forbidden exaggerated phrase "Overnight" in generated output (heuristic lexicon check).',
    is_false_positive: false,
    is_false_negative: false,
    source_meaning_preserved: true,
  },
  {
    case_id: 'eval-03',
    title: 'Negative control: Measured comparative statement ("beats two hours")',
    rule_type: 'AVOID_EXAGGERATED_HOOKS',
    is_negative_case: true,
    creator_feedback: 'Avoid exaggerated hooks.',
    source_excerpt:
      'In deliberate practice, ten minutes of honest retrieval with closed notes beats two hours of passive re-reading almost every time.',
    candidate_hook_before:
      'Why 10 Minutes of Closed-Note Retrieval Beats 2 Hours of Re-Reading',
    regenerated_hook_after:
      'Why 10 Minutes of Closed-Note Retrieval Beats 2 Hours of Re-Reading',
    regenerated_caption_after:
      'In deliberate practice, ten minutes of honest retrieval with closed notes beats two hours of passive re-reading almost every time.',
    rule_parameters: {
      forbiddenTerms: ['10x', 'secret', 'instantly', 'hack', 'guaranteed'],
    },
    feedback_mapped_correctly: true,
    user_confirmed_rule: true,
    expected_test_outcome: 'Pass',
    actual_test_outcome: 'Pass',
    matched_phrase_or_reason:
      'Negative case verified: rule did not trigger on source-backed numeric comparison.',
    is_false_positive: false,
    is_false_negative: false,
    source_meaning_preserved: true,
  },
  {
    case_id: 'eval-04',
    title: 'Subtle hyperbole ("revolutionary") missed by literal lexicon (False Negative)',
    rule_type: 'AVOID_EXAGGERATED_HOOKS',
    is_negative_case: false,
    creator_feedback: 'Avoid overhyped adjectives in the hook.',
    source_excerpt:
      'Close the notes and explain out loud why step A forces step B to happen.',
    candidate_hook_before: 'The Secret 10x Method for Explaining Technical Concepts',
    regenerated_hook_after:
      'The Revolutionary Breakthrough Method for Explaining Step A to Step B',
    regenerated_caption_after:
      'Close your notes and explain out loud why step A forces step B to happen.',
    rule_parameters: {
      forbiddenTerms: ['10x', 'secret', 'instantly', 'hack', 'guaranteed'],
    },
    feedback_mapped_correctly: true,
    user_confirmed_rule: true,
    expected_test_outcome: 'Fail',
    actual_test_outcome: 'Pass',
    matched_phrase_or_reason:
      'Heuristic limitation: "Revolutionary Breakthrough" was not in the default 13-term lexicon (recorded as false negative).',
    is_false_positive: false,
    is_false_negative: true,
    source_meaning_preserved: true,
  },
  {
    case_id: 'eval-05',
    title: 'Clickbait opener ("You won\'t believe") blocked and rewritten',
    rule_type: 'AVOID_CLICKBAIT',
    is_negative_case: false,
    creator_feedback: 'Remove clickbait phrases like "you won\'t believe".',
    source_excerpt:
      'When novices study a complex system, they often highlight every second sentence because everything feels equally urgent.',
    candidate_hook_before:
      "You Won't Believe Why Highlighting Your Textbook Is Ruining Your Memory",
    regenerated_hook_after:
      'Why Highlighting Every Second Sentence Creates Familiarity Instead of Recall',
    regenerated_caption_after:
      'When everything feels equally urgent, highlighting builds familiarity rather than retrieval strength.',
    rule_parameters: {
      forbiddenTerms: ["you won't believe", 'shocking', 'one weird trick'],
    },
    feedback_mapped_correctly: true,
    user_confirmed_rule: true,
    expected_test_outcome: 'Pass',
    actual_test_outcome: 'Pass',
    matched_phrase_or_reason: 'No clickbait phrases found (7 patterns checked).',
    is_false_positive: false,
    is_false_negative: false,
    source_meaning_preserved: true,
  },
  {
    case_id: 'eval-06',
    title: 'Clickbait tail ("Wait until the end") flagged as failure',
    rule_type: 'AVOID_CLICKBAIT',
    is_negative_case: false,
    creator_feedback: 'Do not use engagement-bait like wait until the end.',
    source_excerpt:
      'Normalize the stall. Finding two specific blind spots is the entire win condition.',
    candidate_hook_before: 'Stop Doing This Immediately When You Hit a Study Wall',
    regenerated_hook_after:
      'How to Handle Retrieval Stalls During Study Sessions — Wait Until the End',
    regenerated_caption_after:
      'Finding two specific blind spots is the win condition for a thirty-minute session.',
    rule_parameters: {
      forbiddenTerms: [
        'stop doing this immediately',
        'wait until the end',
        'shocking',
      ],
    },
    feedback_mapped_correctly: true,
    user_confirmed_rule: true,
    expected_test_outcome: 'Fail',
    actual_test_outcome: 'Fail',
    matched_phrase_or_reason: 'Matched clickbait phrase "wait until the end".',
    is_false_positive: false,
    is_false_negative: false,
    source_meaning_preserved: true,
  },
  {
    case_id: 'eval-07',
    title: 'Missing foundational vocabulary caveat restored in concept map clip',
    rule_type: 'PRESERVE_QUALIFICATIONS',
    is_negative_case: false,
    creator_feedback:
      'Include the qualification that concept mapping only works after foundational vocabulary is built.',
    source_excerpt:
      'You can compress initial orientation by mapping how three core concepts connect on a single blank page. However, that rapid mapping only works if you have already built the foundational vocabulary first.',
    candidate_hook_before:
      'Draw a Concept Map First to Skip Textbook Reading Entirely',
    regenerated_hook_after:
      'Why Concept Maps Only Work After You Build Foundational Vocabulary First',
    regenerated_caption_after:
      'Mapping how three concepts connect compresses orientation—however, it only works if you build foundational vocabulary first.',
    rule_parameters: {
      requiredQualifications: ['foundational', 'however', 'first', 'unless'],
    },
    feedback_mapped_correctly: true,
    user_confirmed_rule: true,
    expected_test_outcome: 'Pass',
    actual_test_outcome: 'Pass',
    matched_phrase_or_reason:
      'Retained qualification term "foundational" from source context.',
    is_false_positive: false,
    is_false_negative: false,
    source_meaning_preserved: true,
  },
  {
    case_id: 'eval-08',
    title: 'Qualification stripped during shortening triggers deterministic failure',
    rule_type: 'PRESERVE_QUALIFICATIONS',
    is_negative_case: false,
    creator_feedback: 'Preserve the "unless" condition from the speaker.',
    source_excerpt:
      'Unless you can define the three or four primary nouns in plain language, jumping straight to synthesis creates fragile illusions of competence.',
    candidate_hook_before: 'Always Jump Straight to Synthesis When Studying',
    regenerated_hook_after: 'Why Synthesis Builds Competence in Technical Fields',
    regenerated_caption_after:
      'Synthesis helps connect big ideas across chapters.',
    rule_parameters: {
      requiredQualifications: ['unless', 'plain language', 'primary nouns'],
    },
    feedback_mapped_correctly: true,
    user_confirmed_rule: true,
    expected_test_outcome: 'Fail',
    actual_test_outcome: 'Fail',
    matched_phrase_or_reason:
      'No required qualification markers (unless, plain language, primary nouns) retained in hook or caption.',
    is_false_positive: false,
    is_false_negative: false,
    source_meaning_preserved: false,
  },
  {
    case_id: 'eval-09',
    title: 'Negative control: Qualification rule on self-contained segment',
    rule_type: 'PRESERVE_QUALIFICATIONS',
    is_negative_case: true,
    creator_feedback: 'Keep the context word "first" when describing question framing.',
    source_excerpt:
      'Write down three concrete questions the system is designed to solve before you memorize any terminology.',
    candidate_hook_before:
      'Write Down 3 Concrete Questions First Before Memorizing Terminology',
    regenerated_hook_after:
      'Write Down 3 Concrete Questions First Before Memorizing Terminology',
    regenerated_caption_after:
      'Build a coarse mental model first by listing three concrete questions.',
    rule_parameters: {
      requiredQualifications: ['first', 'before'],
    },
    feedback_mapped_correctly: true,
    user_confirmed_rule: true,
    expected_test_outcome: 'Pass',
    actual_test_outcome: 'Pass',
    matched_phrase_or_reason:
      'Retained qualification term "first" from source context.',
    is_false_positive: false,
    is_false_negative: false,
    source_meaning_preserved: true,
  },
  {
    case_id: 'eval-10',
    title: 'Educational context preservation marked honestly as AI Advisory',
    rule_type: 'PRESERVE_EDUCATIONAL_CONTEXT',
    is_negative_case: false,
    creator_feedback:
      'Keep the educational explanation of why retrieval friction is a diagnostic signal.',
    source_excerpt:
      'Where your explanation stalls or gets vague is the exact boundary of your understanding. That friction is not failure; it is diagnostic signal.',
    candidate_hook_before: 'Never Stall During an Explanation Again',
    regenerated_hook_after:
      'Why Stalling During Self-Explanation Is a Useful Diagnostic Signal',
    regenerated_caption_after:
      'Where your explanation gets vague marks the exact boundary of your current understanding.',
    rule_parameters: {
      note: 'Verify pedagogical framing around diagnostic signal.',
    },
    feedback_mapped_correctly: true,
    user_confirmed_rule: true,
    expected_test_outcome: 'Advisory',
    actual_test_outcome: 'Advisory',
    matched_phrase_or_reason:
      'AI advisory only — semantic/tone preference requires human review and cannot claim a deterministic pass.',
    is_false_positive: false,
    is_false_negative: false,
    source_meaning_preserved: true,
  },
  {
    case_id: 'eval-11',
    title: 'Educational context check with nuance shift (Advisory review)',
    rule_type: 'PRESERVE_EDUCATIONAL_CONTEXT',
    is_negative_case: false,
    creator_feedback: 'Preserve the classroom trial context.',
    source_excerpt:
      'In our classroom trials, students who sketched a rough concept map before reading the chapter recalled core mechanisms much better a week later.',
    candidate_hook_before: 'Sketching Maps Helps Recall',
    regenerated_hook_after:
      'What Classroom Trials Show About Sketching Concept Maps Before Reading',
    regenerated_caption_after:
      'Students who sketched a rough concept map before reading recalled core mechanisms better one week later.',
    rule_parameters: {
      note: 'Preserve classroom trial framing.',
    },
    feedback_mapped_correctly: true,
    user_confirmed_rule: true,
    expected_test_outcome: 'Advisory',
    actual_test_outcome: 'Advisory',
    matched_phrase_or_reason:
      'AI advisory only — semantic/tone preference requires human review and cannot claim a deterministic pass.',
    is_false_positive: false,
    is_false_negative: false,
    source_meaning_preserved: true,
  },
  {
    case_id: 'eval-12',
    title: 'Unsupported percentage ("87% faster") caught by deterministic numeric check',
    rule_type: 'AVOID_UNSUPPORTED_CLAIMS',
    is_negative_case: false,
    creator_feedback: 'Do not invent percentages or statistics not in the transcript.',
    source_excerpt:
      'In our classroom trials, students who sketched a rough concept map before reading the chapter recalled core mechanisms much better a week later.',
    candidate_hook_before: 'Concept Maps Boost Memory Recall by 87% in 1 Week',
    regenerated_hook_after: 'Concept Maps Boost Memory Recall by 45% in Classroom Trials',
    regenerated_caption_after:
      'Students recalled core mechanisms 45% better a week later.',
    rule_parameters: {
      forbiddenTerms: ['guaranteed', 'always works'],
    },
    feedback_mapped_correctly: true,
    user_confirmed_rule: true,
    expected_test_outcome: 'Fail',
    actual_test_outcome: 'Fail',
    matched_phrase_or_reason:
      'Numeric claim "45%" does not appear in source excerpt.',
    is_false_positive: false,
    is_false_negative: false,
    source_meaning_preserved: false,
  },
  {
    case_id: 'eval-13',
    title: 'Unsupported statistic removed; qualitative source wording preserved',
    rule_type: 'AVOID_UNSUPPORTED_CLAIMS',
    is_negative_case: false,
    creator_feedback: 'Remove invented percentages; use the speaker’s actual wording.',
    source_excerpt:
      'In our classroom trials, students who sketched a rough concept map before reading the chapter recalled core mechanisms much better a week later.',
    candidate_hook_before: 'Concept Maps Boost Recall by 90%',
    regenerated_hook_after:
      'Why Pre-Reading Concept Maps Improved Recall in Classroom Trials',
    regenerated_caption_after:
      'Students who sketched a rough concept map before reading recalled core mechanisms much better a week later.',
    rule_parameters: {
      forbiddenTerms: ['guaranteed', 'always works'],
    },
    feedback_mapped_correctly: true,
    user_confirmed_rule: true,
    expected_test_outcome: 'Pass',
    actual_test_outcome: 'Pass',
    matched_phrase_or_reason:
      'All numeric figures and scope claims are grounded in the source excerpt.',
    is_false_positive: false,
    is_false_negative: true === false,
    source_meaning_preserved: true,
  },
  {
    case_id: 'eval-14',
    title: 'Digit vs. spelled-out number ("3" vs "three") triggers strict check (False Positive)',
    rule_type: 'AVOID_UNSUPPORTED_CLAIMS',
    is_negative_case: true,
    creator_feedback: 'Only use numbers supported by the transcript.',
    source_excerpt:
      'Write down three concrete questions the system is designed to solve before you memorize any terminology.',
    candidate_hook_before: 'Write Down 3 Questions Before Memorizing Terminology',
    regenerated_hook_after: 'Write Down 3 Questions Before Memorizing Terminology',
    regenerated_caption_after:
      'Start by writing down three concrete questions the system is designed to solve.',
    rule_parameters: {
      forbiddenTerms: ['guaranteed'],
    },
    feedback_mapped_correctly: true,
    user_confirmed_rule: true,
    expected_test_outcome: 'Pass',
    actual_test_outcome: 'Fail',
    matched_phrase_or_reason:
      'Numeric claim "3" flagged because transcript spells out "three" (recorded as false positive in strict substring check).',
    is_false_positive: true,
    is_false_negative: false,
    source_meaning_preserved: true,
  },
  {
    case_id: 'eval-15',
    title: 'Concise hook rule (max 10 words) passes with 9-word hook',
    rule_type: 'PREFER_CONCISE_HOOKS',
    is_negative_case: false,
    creator_feedback: 'Too long. Keep hooks under 10 words.',
    source_excerpt:
      'That friction is not failure; it is diagnostic signal.',
    candidate_hook_before:
      'Why Hitting Mental Friction While Studying Technical Topics Is Actually Diagnostic Signal Not Failure',
    regenerated_hook_after:
      'Study Friction Is Diagnostic Signal, Not Failure',
    regenerated_caption_after:
      'Where your explanation stalls is the exact boundary of your understanding.',
    rule_parameters: { maxWords: 10 },
    feedback_mapped_correctly: true,
    user_confirmed_rule: true,
    expected_test_outcome: 'Pass',
    actual_test_outcome: 'Pass',
    matched_phrase_or_reason: 'Hook word count is 7/10 words.',
    is_false_positive: false,
    is_false_negative: false,
    source_meaning_preserved: true,
  },
  {
    case_id: 'eval-16',
    title: 'Concise hook rule (max 10 words) fails when regeneration produces 15 words',
    rule_type: 'PREFER_CONCISE_HOOKS',
    is_negative_case: false,
    creator_feedback: 'Keep hooks under 10 words.',
    source_excerpt:
      'Normalize the stall. Tell yourself before you open the notebook that finding two specific blind spots is the entire win condition.',
    candidate_hook_before:
      'How to Stop Getting Discouraged When You Hit Retrieval Gaps During Technical Study Sessions',
    regenerated_hook_after:
      'Why Finding Two Specific Blind Spots Should Be Your Entire Thirty Minute Study Win Condition',
    regenerated_caption_after:
      'Normalize the stall by making two blind spots your win condition.',
    rule_parameters: { maxWords: 10 },
    feedback_mapped_correctly: true,
    user_confirmed_rule: true,
    expected_test_outcome: 'Fail',
    actual_test_outcome: 'Fail',
    matched_phrase_or_reason:
      'Hook has 15 words, exceeding configured maximum of 10 words.',
    is_false_positive: false,
    is_false_negative: false,
    source_meaning_preserved: true,
  },
  {
    case_id: 'eval-17',
    title: 'Conversational tone preference routed to AI Advisory evaluation',
    rule_type: 'PREFER_CONVERSATIONAL_TONE',
    is_negative_case: false,
    creator_feedback: 'Wrong tone—make the hook sound conversational, not like a syllabus.',
    source_excerpt:
      'Close the notes and explain out loud why step A forces step B to happen.',
    candidate_hook_before:
      'Pedagogical Protocol: Verbalizing Causal Mechanisms Without Reference Material',
    regenerated_hook_after:
      'Close Your Notes and Explain Out Loud Why Step A Causes Step B',
    regenerated_caption_after:
      'Try explaining the mechanism out loud without looking at the page.',
    rule_parameters: { note: 'Conversational peer-to-peer tone.' },
    feedback_mapped_correctly: true,
    user_confirmed_rule: true,
    expected_test_outcome: 'Advisory',
    actual_test_outcome: 'Advisory',
    matched_phrase_or_reason:
      'AI advisory only — semantic/tone preference requires human review and cannot claim a deterministic pass.',
    is_false_positive: false,
    is_false_negative: false,
    source_meaning_preserved: true,
  },
  {
    case_id: 'eval-18',
    title: 'Conversational tone unconfirmed by creator (kept as draft)',
    rule_type: 'PREFER_CONVERSATIONAL_TONE',
    is_negative_case: false,
    creator_feedback: 'Use a slightly warmer intro.',
    source_excerpt:
      'The biggest misconception I see in adult learners is treating a dense textbook like a novel.',
    candidate_hook_before: 'Do Not Read Textbooks Like Novels',
    regenerated_hook_after: 'Why Reading a Technical Book Cover-to-Cover Backfires',
    regenerated_caption_after:
      'Treating a dense textbook like a novel creates familiarity, not retrieval strength.',
    rule_parameters: { note: 'Warmer conversational opening.' },
    feedback_mapped_correctly: true,
    user_confirmed_rule: false,
    expected_test_outcome: 'Advisory',
    actual_test_outcome: 'Advisory',
    matched_phrase_or_reason:
      'Rule was proposed accurately from feedback; user declined global confirmation.',
    is_false_positive: false,
    is_false_negative: false,
    source_meaning_preserved: true,
  },
  {
    case_id: 'eval-19',
    title: 'Jargon filter removes "metacognitive" and "epistemological" from hook',
    rule_type: 'AVOID_JARGON',
    is_negative_case: false,
    creator_feedback:
      'Too much jargon: avoid words like metacognitive and epistemological in the hook.',
    source_excerpt:
      'Where your explanation stalls or gets vague is the exact boundary of your understanding.',
    candidate_hook_before:
      'Using Metacognitive & Epistemological Friction to Diagnose Knowledge Gaps',
    regenerated_hook_after:
      'How Explanation Stalls Pinpoint the Exact Boundary of Your Understanding',
    regenerated_caption_after:
      'Where your spoken explanation gets vague is your diagnostic learning signal.',
    rule_parameters: {
      jargonTerms: ['metacognitive', 'epistemological', 'pedagogical', 'ontological'],
    },
    feedback_mapped_correctly: true,
    user_confirmed_rule: true,
    expected_test_outcome: 'Pass',
    actual_test_outcome: 'Pass',
    matched_phrase_or_reason:
      'No restricted jargon terms found (4 terms checked).',
    is_false_positive: false,
    is_false_negative: false,
    source_meaning_preserved: true,
  },
  {
    case_id: 'eval-20',
    title: 'Jargon filter catches residual "pedagogical" in caption',
    rule_type: 'AVOID_JARGON',
    is_negative_case: false,
    creator_feedback: 'Remove academic jargon like pedagogical.',
    source_excerpt:
      'In deliberate practice, ten minutes of honest retrieval with closed notes beats two hours of passive re-reading.',
    candidate_hook_before: 'Pedagogical Heuristics for Active Recall',
    regenerated_hook_after: '10 Minutes of Closed-Note Retrieval vs. Passive Reading',
    regenerated_caption_after:
      'This pedagogical technique replaces two hours of passive re-reading.',
    rule_parameters: {
      jargonTerms: ['metacognitive', 'epistemological', 'pedagogical'],
    },
    feedback_mapped_correctly: true,
    user_confirmed_rule: true,
    expected_test_outcome: 'Fail',
    actual_test_outcome: 'Fail',
    matched_phrase_or_reason: 'Matched restricted jargon term "pedagogical".',
    is_false_positive: false,
    is_false_negative: false,
    source_meaning_preserved: true,
  },
  {
    case_id: 'eval-21',
    title: 'Required topic phrase ("mental model") verified in YouTube Shorts hook',
    rule_type: 'INCLUDE_CLEAR_TOPIC',
    is_negative_case: false,
    creator_feedback: 'Include the clear topic phrase "mental model" in the hook.',
    source_excerpt:
      'Start by building a coarse mental model of the problem space.',
    candidate_hook_before: 'Do This in Your First Hour With Any New Subject',
    regenerated_hook_after:
      'How to Build a Coarse Mental Model in Your First Hour Studying',
    regenerated_caption_after:
      'Write down three concrete questions the system solves to form a coarse mental model.',
    rule_parameters: { requiredTopicPhrase: 'mental model' },
    feedback_mapped_correctly: true,
    user_confirmed_rule: true,
    expected_test_outcome: 'Pass',
    actual_test_outcome: 'Pass',
    matched_phrase_or_reason:
      'Verified required topic phrase "mental model" is present.',
    is_false_positive: false,
    is_false_negative: false,
    source_meaning_preserved: true,
  },
  {
    case_id: 'eval-22',
    title: 'Missing required topic phrase ("retrieval practice") flagged by test',
    rule_type: 'INCLUDE_CLEAR_TOPIC',
    is_negative_case: false,
    creator_feedback: 'Always mention "retrieval practice" explicitly.',
    source_excerpt:
      'Close the notes and explain out loud why step A forces step B to happen.',
    candidate_hook_before: 'Close Your Notes and Explain Step A to Step B',
    regenerated_hook_after: 'Why Explaining Out Loud Beats Highlighting Notes',
    regenerated_caption_after:
      'Close your notes and test whether you can explain the causal link.',
    rule_parameters: { requiredTopicPhrase: 'retrieval practice' },
    feedback_mapped_correctly: true,
    user_confirmed_rule: true,
    expected_test_outcome: 'Fail',
    actual_test_outcome: 'Fail',
    matched_phrase_or_reason:
      'Missing required topic phrase "retrieval practice" in hook and caption.',
    is_false_positive: false,
    is_false_negative: false,
    source_meaning_preserved: true,
  },
  {
    case_id: 'eval-23',
    title: 'Unmapped free-text feedback saved honestly as manual review note',
    rule_type: 'CUSTOM_REVIEW_REQUIRED',
    is_negative_case: false,
    creator_feedback:
      'Check with Dr. Rostova’s publisher whether we can mention her upcoming book title in the description.',
    source_excerpt:
      'Welcome back to Deep Work Architecture. Today we are joined by cognitive science educator Dr. Elena Rostova.',
    candidate_hook_before: 'Dr. Elena Rostova on Adult Learning',
    regenerated_hook_after: 'Dr. Elena Rostova on Adult Learning',
    regenerated_caption_after:
      'Dr. Elena Rostova unpacks how adults learn complex technical subjects.',
    rule_parameters: {
      note: 'Check with publisher regarding book title mention.',
    },
    feedback_mapped_correctly: true,
    user_confirmed_rule: false,
    expected_test_outcome: 'Advisory',
    actual_test_outcome: 'Advisory',
    matched_phrase_or_reason:
      'AI advisory only — unmapped logistics note saved for manual review, not treated as an enforceable rule.',
    is_false_positive: false,
    is_false_negative: false,
    source_meaning_preserved: true,
  },
  {
    case_id: 'eval-24',
    title: 'Ambiguous stylistic feedback mapped imperfectly (Recorded mapping miss)',
    rule_type: 'CUSTOM_REVIEW_REQUIRED',
    is_negative_case: false,
    creator_feedback: 'Make the rhythm punchier on the second clause.',
    source_excerpt:
      'That friction is not failure; it is diagnostic signal.',
    candidate_hook_before: 'Why Study Friction Is Actually Diagnostic Signal',
    regenerated_hook_after: 'Study Friction Isn’t Failure—It’s Diagnostic Signal',
    regenerated_caption_after:
      'Where your explanation stalls is the boundary of your understanding.',
    rule_parameters: {
      note: 'Rhythm adjustment on second clause.',
    },
    feedback_mapped_correctly: false,
    user_confirmed_rule: false,
    expected_test_outcome: 'Advisory',
    actual_test_outcome: 'Advisory',
    matched_phrase_or_reason:
      'AI advisory only — stylistic cadence note requires human review.',
    is_false_positive: false,
    is_false_negative: false,
    source_meaning_preserved: true,
  },
];
