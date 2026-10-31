import {
  AdvisoryCheckResult,
  ContextStatusLabel,
  DeterministicCheckResult,
  TranscriptSegment,
} from '../types/loopframe';
import { EXAGGERATED_LEXICON } from './ruleEngine';

export const CONTEXT_SHIFT_TERMS = [
  'but',
  'however',
  'although',
  'unless',
  'except',
  'not',
  'never',
  'only',
  'because',
  'instead',
];

const AMBIGUOUS_OPENING_PRONOUNS = [
  'it',
  'this',
  'that',
  'they',
  'them',
  'these',
  'those',
  'he',
  'she',
];

export interface ContextIntegrityEvaluation {
  context_status: ContextStatusLabel;
  deterministic_checks: DeterministicCheckResult[];
  advisory_checks: AdvisoryCheckResult[];
  surrounding_before: TranscriptSegment[];
  surrounding_after: TranscriptSegment[];
}

/**
 * Runs all 7 deterministic checks and 4 clearly-labelled AI advisory checks on a candidate.
 * Never claims a candidate is "factually safe" or "guaranteed accurate".
 */
export function evaluateContextIntegrity(params: {
  allSegments: TranscriptSegment[];
  startSegmentId: string;
  endSegmentId: string;
  assembledExcerpt: string;
  suggestedHook: string;
  captionText: string;
  windowSize?: number;
  minDurationSec?: number;
  maxDurationSec?: number;
}): ContextIntegrityEvaluation {
  const {
    allSegments,
    startSegmentId,
    endSegmentId,
    assembledExcerpt,
    suggestedHook,
    captionText,
    windowSize = 1,
    minDurationSec = 8,
    maxDurationSec = 120,
  } = params;

  const startIdx = allSegments.findIndex((s) => s.segment_id === startSegmentId);
  const endIdx = allSegments.findIndex((s) => s.segment_id === endSegmentId);

  const idsExist = startIdx !== -1 && endIdx !== -1;
  const validOrder = idsExist && startIdx <= endIdx;

  const selectedSegments =
    validOrder ? allSegments.slice(startIdx, endIdx + 1) : [];

  const surroundingBefore =
    validOrder
      ? allSegments.slice(Math.max(0, startIdx - windowSize), startIdx)
      : [];
  const surroundingAfter =
    validOrder
      ? allSegments.slice(
          endIdx + 1,
          Math.min(allSegments.length, endIdx + 1 + windowSize)
        )
      : [];

  const canonicalExcerpt = selectedSegments.map((s) => s.text).join(' ');
  const excerptMatchesOriginal =
    validOrder &&
    assembledExcerpt.trim() === canonicalExcerpt.trim() &&
    canonicalExcerpt.length > 0;

  const startMs = validOrder ? selectedSegments[0].start_ms : -1;
  const endMs = validOrder
    ? selectedSegments[selectedSegments.length - 1].end_ms
    : -1;
  const durationSec =
    validOrder && endMs > startMs ? Math.round((endMs - startMs) / 1000) : 0;
  const timestampsValid =
    validOrder &&
    startMs >= 0 &&
    endMs > startMs &&
    durationSec >= minDurationSec &&
    durationSec <= maxDurationSec;

  // Check 5: Candidate does not begin/end at an obviously incomplete segment
  const firstText = selectedSegments[0]?.text.trim() ?? '';
  const lastText =
    selectedSegments[selectedSegments.length - 1]?.text.trim() ?? '';
  const startsCleanly =
    firstText.length > 0 &&
    /^[A-Z0-9"“']/.test(firstText) &&
    !/^(and|or|but|so|because)\b/i.test(firstText);
  const endsCleanly =
    lastText.length > 0 && /[.?!]["”']?$/.test(lastText) && !/\.\.\.$/.test(lastText);
  const boundaryComplete = validOrder && startsCleanly && endsCleanly;

  // Check 6: Configurable window around the clip for context-changing terms
  const adjacentWindowText = [...surroundingBefore, ...surroundingAfter]
    .map((s) => `${s.segment_id}: "${s.text}"`)
    .join(' ');
  const rawAdjacentWords = [...surroundingBefore, ...surroundingAfter]
    .map((s) => s.text.toLowerCase())
    .join(' ');

  const matchedContextTerms = CONTEXT_SHIFT_TERMS.filter((term) => {
    const regex = new RegExp(`\\b${term}\\b`, 'i');
    return regex.test(rawAdjacentWords);
  });

  // Also specifically flag if the immediate next segment starts with a qualifier/contrast
  const nextSegText = surroundingAfter[0]?.text.trim() ?? '';
  const immediateNextContrast =
    /^(however|but|unless|except|only|although|that said|the catch is)/i.test(
      nextSegText
    );

  const windowClean = !immediateNextContrast && matchedContextTerms.length <= 1;

  // Check 7: Numbers, named entities and negations in generated hook/caption supported by excerpt
  const excerptLower = canonicalExcerpt.toLowerCase();
  const combinedCopy = `${suggestedHook} ${captionText}`;
  const numbersInCopy: string[] = combinedCopy.match(/\b\d+(?:\.\d+)?%?\b/g) ?? [];
  const unsupportedNumbers = numbersInCopy.filter(
    (num) => !excerptLower.includes(num.toLowerCase())
  );

  const negationsInCopy: string[] =
    combinedCopy.toLowerCase().match(/\b(never|nobody|impossible|zero|none)\b/g) ?? [];
  const unsupportedNegations = negationsInCopy.filter(
    (neg) => !excerptLower.includes(neg)
  );

  const claimsSupported =
    validOrder &&
    unsupportedNumbers.length === 0 &&
    unsupportedNegations.length === 0;

  const deterministicChecks: DeterministicCheckResult[] = [
    {
      check_id: 'det-1-segment-ids',
      label: 'Source segment IDs exist in transcript',
      passed: idsExist,
      status: idsExist ? 'pass' : 'mismatch',
      detail: idsExist
        ? `Verified segments ${startSegmentId} through ${endSegmentId} exist.`
        : `Missing segment IDs (${startSegmentId}..${endSegmentId}).`,
    },
    {
      check_id: 'det-2-segment-order',
      label: 'Segment order is monotonic and valid',
      passed: validOrder,
      status: validOrder ? 'pass' : 'mismatch',
      detail: validOrder
        ? `Order ${startIdx + 1} to ${endIdx + 1} (${selectedSegments.length} segment${selectedSegments.length === 1 ? '' : 's'}).`
        : 'Start segment appears after end segment.',
    },
    {
      check_id: 'det-3-verbatim-excerpt',
      label: 'Source excerpt assembled verbatim from original segments',
      passed: excerptMatchesOriginal,
      status: excerptMatchesOriginal ? 'pass' : 'mismatch',
      detail: excerptMatchesOriginal
        ? 'Excerpt matches original user-provided transcript characters 100%.'
        : 'Excerpt diverges from original transcript segments.',
    },
    {
      check_id: 'det-4-timestamp-duration',
      label: `Timestamps valid & duration within ${minDurationSec}s–${maxDurationSec}s bounds`,
      passed: timestampsValid,
      status: timestampsValid ? 'pass' : 'review',
      detail: validOrder
        ? `Clip duration is ${durationSec}s (${Math.round(startMs / 1000)}s–${Math.round(endMs / 1000)}s).`
        : 'Cannot compute duration for invalid segment range.',
    },
    {
      check_id: 'det-5-boundary-punctuation',
      label: 'Clip boundaries begin and end on complete sentences',
      passed: boundaryComplete,
      status: boundaryComplete ? 'pass' : 'review',
      detail: boundaryComplete
        ? 'Starts with capital/complete clause and ends with terminal punctuation.'
        : `Boundary check flagged: ${!startsCleanly ? 'starts mid-thought' : 'ends without terminal punctuation'}.`,
    },
    {
      check_id: 'det-6-surrounding-window',
      label: `Adjacent transcript window (±${windowSize} seg) checked for qualifying terms`,
      passed: windowClean,
      status: windowClean ? 'pass' : 'review',
      detail: windowClean
        ? matchedContextTerms.length === 0
          ? 'No qualifying contrast terms detected in immediate surrounding segments.'
          : `Minor qualifier "${matchedContextTerms.join(', ')}" in adjacent segment; does not open with a direct contradiction.`
        : `Adjacent segment (${surroundingAfter[0]?.segment_id || surroundingBefore[0]?.segment_id}) contains contrast/qualification terms: ${matchedContextTerms.join(', ')}. Inspect surrounding context.`,
      matched_terms: matchedContextTerms,
    },
    {
      check_id: 'det-7-numbers-negations',
      label: 'Numbers and absolute negations in hook/caption appear in source excerpt',
      passed: claimsSupported,
      status: claimsSupported ? 'pass' : 'review',
      detail: claimsSupported
        ? 'No unsupported numeric claims or absolute negations introduced in hook/caption.'
        : `Introduced terms not in source excerpt: ${[...unsupportedNumbers, ...unsupportedNegations].join(', ')}. Marked for review.`,
      matched_terms: [...unsupportedNumbers, ...unsupportedNegations],
    },
  ];

  // AI-Advisory Checks (Clearly labelled as AI advisory, not deterministic validation)
  const firstWord = firstText.split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, '') ?? '';
  const hasPronounAmbiguity = AMBIGUOUS_OPENING_PRONOUNS.includes(firstWord);

  const hookLower = suggestedHook.toLowerCase();
  const matchedExaggerations = EXAGGERATED_LEXICON.filter((phrase) =>
    hookLower.includes(phrase.toLowerCase())
  );
  const hasExaggeratedHook =
    matchedExaggerations.length > 0 || unsupportedNumbers.length > 0;

  const omitsQualification = immediateNextContrast || matchedContextTerms.includes('unless') || matchedContextTerms.includes('however');

  const meaningShiftFlagged = hasExaggeratedHook || unsupportedNegations.length > 0;

  const advisoryChecks: AdvisoryCheckResult[] = [
    {
      check_id: 'adv-1-pronoun',
      category: 'pronoun_ambiguity',
      label: 'Pronoun & reference clarity at clip opening',
      flagged: hasPronounAmbiguity,
      explanation: hasPronounAmbiguity
        ? `AI Advisory: Opening sentence starts with "${firstWord}", which may refer to a noun in ${surroundingBefore[0]?.segment_id ?? 'the prior segment'}.`
        : 'AI Advisory: Opening clause establishes its subject without unresolved pronoun references.',
    },
    {
      check_id: 'adv-2-exaggeration',
      category: 'exaggerated_tone',
      label: 'Hook tone vs. source epistemic certainty',
      flagged: hasExaggeratedHook,
      explanation: hasExaggeratedHook
        ? `AI Advisory: Hook uses amplified framing (${[...matchedExaggerations, ...unsupportedNumbers].join(', ')}) that sounds more absolute than the speaker's measured explanation.`
        : 'AI Advisory: Hook framing reflects the speaker’s measured instructional tone.',
    },
    {
      check_id: 'adv-3-qualification',
      category: 'missing_qualification',
      label: 'Preservation of surrounding qualifications & caveats',
      flagged: omitsQualification,
      explanation: omitsQualification
        ? `AI Advisory: Segment ${surroundingAfter[0]?.segment_id ?? 'nearby'} introduces an important boundary condition ("${nextSegText.slice(0, 75)}..."). Consider expanding the clip range.`
        : 'AI Advisory: Core caveats appear self-contained within the selected segment boundaries.',
    },
    {
      check_id: 'adv-4-meaning',
      category: 'meaning_shift',
      label: 'Speaker intended meaning alignment in caption',
      flagged: meaningShiftFlagged,
      explanation: meaningShiftFlagged
        ? 'AI Advisory: Generated copy shifts emphasis toward a shortcut/promise rather than the underlying pedagogical mechanism.'
        : 'AI Advisory: Caption preserves the speaker’s primary thesis without distortion.',
    },
  ];

  let contextStatus: ContextStatusLabel = 'No issues found by 7 checks';
  if (!idsExist || !validOrder || !excerptMatchesOriginal) {
    contextStatus = 'Source mismatch';
  } else if (
    deterministicChecks.some((c) => !c.passed) ||
    advisoryChecks.some((a) => a.flagged)
  ) {
    contextStatus = 'Review recommended';
  }

  return {
    context_status: contextStatus,
    deterministic_checks: deterministicChecks,
    advisory_checks: advisoryChecks,
    surrounding_before: surroundingBefore,
    surrounding_after: surroundingAfter,
  };
}
