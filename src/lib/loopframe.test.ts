import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assembleCandidateFromSegments,
  formatTimecode,
  parseTimestampedTranscript,
} from './transcriptParser';
import { evaluateContextIntegrity } from './contextChecks';
import {
  mapCreatorFeedbackToProposedRule,
  runDeterministicRuleTest,
} from './ruleEngine';
import { buildInitialSeedState, SAMPLE_TRANSCRIPT_RAW } from './seedData';

test('parseTimestampedTranscript parses valid lines and preserves verbatim text without inventing speaker labels', () => {
  const raw = `[00:00:05] Speaker A: First segment text here.
[00:00:18] Second segment without a speaker label.
[00:00:32] Speaker B: Third segment ends cleanly.`;

  const res = parseTimestampedTranscript(raw);
  assert.equal(res.valid, true);
  assert.equal(res.errors.length, 0);
  assert.equal(res.segments.length, 3);

  assert.equal(res.segments[0].segment_id, 'seg-01');
  assert.equal(res.segments[0].speaker_label, 'Speaker A');
  assert.equal(res.segments[0].start_ms, 5000);
  assert.equal(res.segments[0].end_ms, 18000);
  assert.equal(res.segments[0].text, 'First segment text here.');

  // Must not invent speaker label when missing
  assert.equal(res.segments[1].speaker_label, null);
  assert.equal(res.segments[1].text, 'Second segment without a speaker label.');
});

test('parseTimestampedTranscript reports exact line numbers for malformed and non-monotonic timestamps', () => {
  const badRaw = `[00:00:10] Host: Valid opening line.
Host without timestamp on line two.
[00:00:75] Host: Invalid seconds on line three.
[00:00:05] Host: Non-monotonic timestamp on line four.`;

  const res = parseTimestampedTranscript(badRaw);
  assert.equal(res.valid, false);
  assert.equal(res.errors.length, 3);
  assert.equal(res.errors[0].lineNumber, 2);
  assert.equal(res.errors[1].lineNumber, 3);
  assert.equal(res.errors[2].lineNumber, 4);
});

test('assembleCandidateFromSegments builds verbatim quotes and rejects invalid segment IDs or inverted order', () => {
  const parsed = parseTimestampedTranscript(SAMPLE_TRANSCRIPT_RAW);
  const good = assembleCandidateFromSegments(parsed.segments, 'seg-02', 'seg-03');
  assert.equal(good.valid, true);
  assert.deepEqual(good.sourceSegmentIds, ['seg-02', 'seg-03']);
  assert.equal(
    good.sourceExcerpt,
    `${parsed.segments[1].text} ${parsed.segments[2].text}`
  );
  assert.equal(formatTimecode(good.startMs), '00:00:19');

  const unknown = assembleCandidateFromSegments(parsed.segments, 'seg-02', 'seg-99');
  assert.equal(unknown.valid, false);

  const inverted = assembleCandidateFromSegments(parsed.segments, 'seg-05', 'seg-02');
  assert.equal(inverted.valid, false);
});

test('evaluateContextIntegrity separates 7 deterministic checks and 4 AI advisory checks', () => {
  const parsed = parseTimestampedTranscript(SAMPLE_TRANSCRIPT_RAW);
  const asm = assembleCandidateFromSegments(parsed.segments, 'seg-06', 'seg-07');

  // seg-08 starts with "However, that rapid mapping only works if..."
  const evalResult = evaluateContextIntegrity({
    allSegments: parsed.segments,
    startSegmentId: 'seg-06',
    endSegmentId: 'seg-07',
    assembledExcerpt: asm.sourceExcerpt,
    suggestedHook: 'How a Single-Page Concept Map Replaces Hours of Chapter Notes',
    captionText: asm.sourceExcerpt,
  });

  assert.equal(evalResult.deterministic_checks.length, 7);
  assert.equal(evalResult.advisory_checks.length, 4);
  assert.equal(evalResult.context_status, 'Review recommended');

  const windowCheck = evalResult.deterministic_checks.find(
    (c) => c.check_id === 'det-6-surrounding-window'
  );
  assert.equal(windowCheck?.passed, false);
});

test('Creator Edit Intelligence maps feedback to closed taxonomy and runs deterministic Pass/Fail/Advisory tests', () => {
  const mapped = mapCreatorFeedbackToProposedRule({
    feedbackId: 'fb-test-1',
    projectId: 'proj-sample-01',
    reasonChips: ['exaggerated hook'],
    freeText: 'Avoid exaggerated hooks. Keep the original educational context.',
  });

  assert.equal(mapped.reliableMapping, true);
  assert.equal(mapped.proposedRule.rule_type, 'AVOID_EXAGGERATED_HOOKS');
  assert.equal(mapped.proposedRule.confirmed_by_user, false);

  // Test failing output
  const failEval = runDeterministicRuleTest({
    rule: { ...mapped.proposedRule, confirmed_by_user: true },
    hook: 'This 10x Secret Learning Hack Lets You Master Any Topic Instantly',
    caption: 'Try this today.',
    sourceExcerpt: 'Write down three concrete questions.',
  });
  assert.equal(failEval.outcome, 'Fail');
  assert.match(failEval.matched_phrase_or_reason, /10x/i);

  // Test passing output
  const passEval = runDeterministicRuleTest({
    rule: { ...mapped.proposedRule, confirmed_by_user: true },
    hook: 'Write Down Three Concrete Questions Before Memorizing Terminology',
    caption: 'Start by building a coarse mental model of the problem space.',
    sourceExcerpt: 'Write down three concrete questions.',
  });
  assert.equal(passEval.outcome, 'Pass');

  // Unmapped feedback becomes CUSTOM_REVIEW_REQUIRED (Advisory only)
  const unmapped = mapCreatorFeedbackToProposedRule({
    feedbackId: 'fb-test-2',
    projectId: 'proj-sample-01',
    reasonChips: ['other'],
    freeText: 'Ask our audio engineer to check the mic gain on the intro.',
  });
  assert.equal(unmapped.reliableMapping, false);
  assert.equal(unmapped.proposedRule.rule_type, 'CUSTOM_REVIEW_REQUIRED');

  const advEval = runDeterministicRuleTest({
    rule: unmapped.proposedRule,
    hook: 'Any hook here',
    caption: 'Any caption here',
    sourceExcerpt: 'Source text',
  });
  assert.equal(advEval.outcome, 'Advisory');
});

test('Seeded demo state initializes 15 segments, 3 candidates, pending feedback, and 24 evaluation cases', () => {
  const seed = buildInitialSeedState();
  assert.equal(seed.projects.length, 1);
  assert.equal(seed.projects[0].segments.length, 15);
  assert.equal(seed.projects[0].candidates.length, 3);
  assert.equal(seed.evaluationCases.length, 24);
});
