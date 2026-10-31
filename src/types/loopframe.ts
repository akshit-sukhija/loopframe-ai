export type RuleType =
  | 'AVOID_EXAGGERATED_HOOKS'
  | 'AVOID_CLICKBAIT'
  | 'PRESERVE_QUALIFICATIONS'
  | 'PRESERVE_EDUCATIONAL_CONTEXT'
  | 'AVOID_UNSUPPORTED_CLAIMS'
  | 'PREFER_CONCISE_HOOKS'
  | 'PREFER_CONVERSATIONAL_TONE'
  | 'AVOID_JARGON'
  | 'INCLUDE_CLEAR_TOPIC'
  | 'CUSTOM_REVIEW_REQUIRED';

export type RuleScope = 'global' | 'project' | 'platform';

export type DestinationPlatform = 'instagram_reels' | 'youtube_shorts';

export type FeedbackReasonChip =
  | 'exaggerated hook'
  | 'missing context'
  | 'wrong tone'
  | 'irrelevant'
  | 'too long'
  | 'jargon'
  | 'other';

export interface CreatorProfile {
  creatorName: string;
  contentCategory: string;
  preferredTone: string;
  onboardingCompleted: boolean;
  updatedAt: string;
}

export interface TranscriptSegment {
  segment_id: string;
  start_ms: number;
  end_ms: number;
  speaker_label: string | null;
  text: string;
  source_order: number;
}

export interface TranscriptValidationLineError {
  lineNumber: number;
  rawLine: string;
  reason: string;
}

export interface TranscriptParseResult {
  valid: boolean;
  segments: TranscriptSegment[];
  errors: TranscriptValidationLineError[];
}

export interface RuleParameters {
  forbiddenTerms?: string[];
  maxWords?: number;
  requiredTopicPhrase?: string;
  requiredQualifications?: string[];
  jargonTerms?: string[];
  note?: string;
}

export interface PreferenceRule {
  rule_id: string;
  rule_type: RuleType;
  human_readable_description: string;
  scope: RuleScope;
  scope_reference: string; // 'all' | project_id | 'instagram_reels' | 'youtube_shorts'
  source_feedback_id: string;
  source_feedback_text: string;
  created_at: string;
  updated_at: string;
  status: 'active' | 'paused' | 'deleted';
  confirmed_by_user: boolean;
  rule_parameters: RuleParameters;
  last_applied_at?: string | null;
  last_test_result?: 'Pass' | 'Fail' | 'Advisory' | null;
  last_test_detail?: string | null;
  is_demo_data?: boolean;
}

export interface DeterministicCheckResult {
  check_id: string;
  label: string;
  passed: boolean;
  status: 'pass' | 'review' | 'mismatch';
  detail: string;
  matched_terms?: string[];
}

export interface AdvisoryCheckResult {
  check_id: string;
  category:
    | 'pronoun_ambiguity'
    | 'exaggerated_tone'
    | 'missing_qualification'
    | 'meaning_shift';
  label: string;
  flagged: boolean;
  explanation: string;
}

export interface RuleTestEvaluation {
  rule_id: string;
  rule_type: RuleType;
  rule_description: string;
  outcome: 'Pass' | 'Fail' | 'Advisory';
  matched_phrase_or_reason: string;
  tested_target: 'hook' | 'caption' | 'both';
}

export interface PlatformCopy {
  destination: DestinationPlatform;
  hook: string;
  caption: string;
  cta?: string;
  hashtags?: string[];
  rule_tests: RuleTestEvaluation[];
  updated_at: string;
}

export interface CandidateRevision {
  revision_id: string;
  timestamp: string;
  summary: string;
  previous_hook: string;
  new_hook: string;
  previous_segment_range: string;
  new_segment_range: string;
}

export type ContextStatusLabel =
  | 'No issues found by 7 checks'
  | 'Review recommended'
  | 'Source mismatch';

export type ReviewStatusLabel =
  | 'Needs review'
  | 'Approved'
  | 'Rejected'
  | 'Flagged for context review';

export type GenerationSourceLabel = 'DEMO DATA' | 'DEMO FALLBACK' | 'LIVE AI';

export interface ClipCandidate {
  candidate_id: string;
  project_id: string;
  title: string;
  start_segment_id: string;
  end_segment_id: string;
  source_segment_ids: string[];
  source_excerpt: string;
  start_ms: number;
  end_ms: number;
  duration_sec: number;
  reason: string;
  suggested_hook: string;
  platform_targets: DestinationPlatform[];
  platform_copy: Record<DestinationPlatform, PlatformCopy>;
  risk_flags: string[];
  candidate_type: string;
  context_status: ContextStatusLabel;
  review_status: ReviewStatusLabel;
  deterministic_checks: DeterministicCheckResult[];
  advisory_checks: AdvisoryCheckResult[];
  active_rules_applied: string[];
  rule_test_results: RuleTestEvaluation[];
  revisions: CandidateRevision[];
  generation_source: GenerationSourceLabel;
  uncertainty_note?: string;
}

export interface FeedbackEvent {
  feedback_id: string;
  project_id: string;
  candidate_id: string;
  action_taken: 'rejected' | 'edited' | 'flagged';
  reason_chips: FeedbackReasonChip[];
  free_text: string;
  created_at: string;
  proposed_rule?: PreferenceRule | null;
  confirmation_status:
    | 'pending_confirmation'
    | 'confirmed'
    | 'saved_as_note'
    | 'dismissed';
  mapping_source: GenerationSourceLabel | 'DETERMINISTIC_MAPPER';
}

export interface ProjectRecord {
  project_id: string;
  name: string;
  source_type: 'Sample transcript' | 'Pasted transcript';
  created_at: string;
  updated_at: string;
  status: 'In review' | 'Rules verified' | 'Ready to export';
  raw_transcript: string;
  segments: TranscriptSegment[];
  candidates: ClipCandidate[];
  feedback_events: FeedbackEvent[];
  is_demo_data: boolean;
  generation_mode: GenerationSourceLabel;
}

export interface LibraryItem {
  item_id: string;
  project_id: string;
  project_name: string;
  candidate_id: string;
  title: string;
  source_excerpt: string;
  start_timecode: string;
  end_timecode: string;
  duration_sec: number;
  status: 'Approved' | 'Needs review' | 'Rejected';
  platform_copy: Record<DestinationPlatform, PlatformCopy>;
  approved_at: string;
  is_demo_data?: boolean;
}

export interface AuditEvent {
  event_id: string;
  timestamp: string;
  event_type:
    | 'project_created'
    | 'candidate_generated'
    | 'feedback_submitted'
    | 'rule_confirmed'
    | 'rule_updated'
    | 'candidate_regenerated'
    | 'rule_tested'
    | 'candidate_approved'
    | 'content_exported'
    | 'demo_reset';
  description: string;
  project_id?: string;
  candidate_id?: string;
  rule_id?: string;
}

export interface EvaluationTestCase {
  case_id: string;
  title: string;
  rule_type: RuleType;
  is_negative_case: boolean;
  creator_feedback: string;
  source_excerpt: string;
  candidate_hook_before: string;
  regenerated_hook_after: string;
  regenerated_caption_after: string;
  rule_parameters: RuleParameters;
  feedback_mapped_correctly: boolean;
  user_confirmed_rule: boolean;
  expected_test_outcome: 'Pass' | 'Fail' | 'Advisory';
  actual_test_outcome: 'Pass' | 'Fail' | 'Advisory';
  matched_phrase_or_reason: string;
  is_false_positive: boolean;
  is_false_negative: boolean;
  source_meaning_preserved: boolean;
}

export interface LoopframeStoreState {
  profile: CreatorProfile;
  projects: ProjectRecord[];
  preferences: PreferenceRule[];
  libraryItems: LibraryItem[];
  auditEvents: AuditEvent[];
  evaluationCases: EvaluationTestCase[];
  lastDeletedPreference?: PreferenceRule | null;
}
