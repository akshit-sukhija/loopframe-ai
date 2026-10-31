import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import {
  ClipCandidate,
  FeedbackReasonChip,
  GenerationSourceLabel,
  PreferenceRule,
  RuleType,
  TranscriptSegment,
} from './src/types/loopframe';
import {
  assembleCandidateFromSegments,
  parseTimestampedTranscript,
} from './src/lib/transcriptParser';
import { evaluateContextIntegrity } from './src/lib/contextChecks';
import {
  CLOSED_RULE_TAXONOMY,
  evaluateAllRulesForOutput,
  getApplicableActiveRules,
  mapCreatorFeedbackToProposedRule,
} from './src/lib/ruleEngine';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

function getGenAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim().length < 10) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

/**
 * Deterministic fallback candidate builder when Gemini API key is not configured or model call fails.
 * Always clearly labelled as 'DEMO FALLBACK'.
 */
function buildDeterministicFallbackCandidates(params: {
  projectId: string;
  segments: TranscriptSegment[];
  activeRules: PreferenceRule[];
  instagramRules: PreferenceRule[];
  youtubeRules: PreferenceRule[];
}): ClipCandidate[] {
  const { projectId, segments, activeRules, instagramRules, youtubeRules } = params;
  const total = segments.length;
  if (total === 0) return [];

  // Divide transcript into 3 sensible segment windows
  const ranges: [number, number, string, string][] = [];
  if (total >= 6) {
    const third = Math.floor(total / 3);
    ranges.push([
      0,
      Math.max(1, third - 1),
      'Opening Problem & Core Thesis',
      'Opening Framing',
    ]);
    ranges.push([
      third,
      Math.max(third, third * 2 - 1),
      'Mechanism & Boundary Conditions',
      'Core Mechanism',
    ]);
    ranges.push([
      third * 2,
      total - 1,
      'Actionable Synthesis & Takeaway',
      'Practical Application',
    ]);
  } else {
    ranges.push([
      0,
      Math.min(total - 1, 1),
      'Opening Premise & Framing',
      'Opening Framing',
    ]);
    if (total > 2) {
      ranges.push([
        1,
        Math.min(total - 1, 2),
        'Core Mechanism Breakdown',
        'Core Mechanism',
      ]);
    }
    if (total > 3) {
      ranges.push([
        Math.max(0, total - 2),
        total - 1,
        'Closing Takeaway & Practice',
        'Practical Application',
      ]);
    }
  }

  if (ranges.length === 0 && total > 0) {
    ranges.push([0, total - 1, 'Full Transcript Review', 'Full Transcript']);
  }


  return ranges.map(([sIdx, eIdx, defaultTitle, cType], index) => {
    const startSeg = segments[sIdx];
    const endSeg = segments[eIdx];
    const asm = assembleCandidateFromSegments(
      segments,
      startSeg.segment_id,
      endSeg.segment_id
    );

    const firstSentence =
      startSeg.text.split(/[.?!]/)[0]?.trim() || startSeg.text.slice(0, 80);

    const buildFallbackHook = (rules: PreferenceRule[]) => {
      const avoidsExaggeration = rules.some((r) => r.rule_type === 'AVOID_EXAGGERATED_HOOKS');
      const maxWordsRule = rules.find((r) => r.rule_type === 'PREFER_CONCISE_HOOKS');
      const topicRule = rules.find((r) => r.rule_type === 'INCLUDE_CLEAR_TOPIC');
      let result = avoidsExaggeration
        ? `How ${firstSentence.slice(0, 65)}`
        : index === 0
          ? `Why Standard Approaches Fail: ${firstSentence.slice(0, 55)}`
          : `Key Mechanism: ${firstSentence.slice(0, 62)}`;
      const topicPhrase = topicRule?.rule_parameters.requiredTopicPhrase ?? '';
      if (topicPhrase && asm.sourceExcerpt.toLowerCase().includes(topicPhrase.toLowerCase()) && !result.toLowerCase().includes(topicPhrase.toLowerCase())) {
        result = `${topicPhrase}: ${result}`;
      }
      if (maxWordsRule?.rule_parameters.maxWords) {
        const words = result.trim().split(' ').filter(Boolean);
        if (words.length > maxWordsRule.rule_parameters.maxWords) {
          result = words.slice(0, maxWordsRule.rule_parameters.maxWords).join(' ');
        }
      }
      return result;
    };
    const igHook = buildFallbackHook(instagramRules);
    const ytHook = buildFallbackHook(youtubeRules);
    const hook = igHook;

    const igCaption = `${asm.sourceExcerpt.slice(0, 220)}${
      asm.sourceExcerpt.length > 220 ? '...' : ''
    }`;
    const ytCaption = `${defaultTitle}: ${asm.sourceExcerpt.slice(0, 240)}${
      asm.sourceExcerpt.length > 240 ? '...' : ''
    }`;

    const ctx = evaluateContextIntegrity({
      allSegments: segments,
      startSegmentId: startSeg.segment_id,
      endSegmentId: endSeg.segment_id,
      assembledExcerpt: asm.sourceExcerpt,
      suggestedHook: igHook,
      captionText: igCaption,
    });

    const igRules = evaluateAllRulesForOutput({
      rules: instagramRules,
      hook: igHook,
      caption: igCaption,
      sourceExcerpt: asm.sourceExcerpt,
    });

    const ytRules = evaluateAllRulesForOutput({
      rules: youtubeRules,
      hook: ytHook,
      caption: ytCaption,
      sourceExcerpt: asm.sourceExcerpt,
    });

    return {
      candidate_id: `cand-${Date.now().toString(36)}-0${index + 1}`,
      project_id: projectId,
      title: defaultTitle,
      start_segment_id: startSeg.segment_id,
      end_segment_id: endSeg.segment_id,
      source_segment_ids: asm.sourceSegmentIds,
      source_excerpt: asm.sourceExcerpt,
      start_ms: asm.startMs,
      end_ms: asm.endMs,
      duration_sec: asm.durationSec,
      reason: `Selected segments ${startSeg.segment_id}–${endSeg.segment_id} covering a complete thematic unit from the transcript.`,
      suggested_hook: igHook,
      platform_targets: ['instagram_reels', 'youtube_shorts'],
      platform_copy: {
        instagram_reels: {
          destination: 'instagram_reels',
          hook: igHook,
          caption: igCaption,
          cta: 'Share your thoughts on this breakdown below.',
          hashtags: ['#CreatorStudio', '#DeepWork', '#Education'],
          rule_tests: igRules,
          updated_at: new Date().toISOString(),
        },
        youtube_shorts: {
          destination: 'youtube_shorts',
          hook: ytHook,
          caption: ytCaption,
          cta: 'Watch the full session for all context.',
          hashtags: ['#Shorts', '#Explainer', '#Learning'],
          rule_tests: ytRules,
          updated_at: new Date().toISOString(),
        },
      },
      risk_flags: ctx.advisory_checks
        .filter((a) => a.flagged)
        .map((a) => a.label),
      candidate_type: cType,
      context_status: ctx.context_status,
      review_status: 'Needs review',
      deterministic_checks: ctx.deterministic_checks,
      advisory_checks: ctx.advisory_checks,
      active_rules_applied: activeRules.map((r) => r.rule_id),
      rule_test_results: igRules,
      revisions: [],
      generation_source: 'DEMO FALLBACK',
    };
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Health & runtime capability inspection endpoint
  app.get('/api/health', (_req, res) => {
    const hasGeminiKey = Boolean(getGenAIClient());
    res.json({
      status: 'ok',
      liveAiConfigured: hasGeminiKey,
      persistenceMode: 'local-demo-store-adapter',
      model: 'gemini-3.8-flash',
    });
  });

  // 1. Parse and validate transcript endpoint
  app.post('/api/parse-transcript', (req, res) => {
    const rawTranscript = String(req.body?.rawTranscript ?? '');
    const parsed = parseTimestampedTranscript(rawTranscript);
    res.json(parsed);
  });

  // 2. Generate source-grounded candidates (with schema validation, 1 retry, and labelled DEMO FALLBACK)
  app.post('/api/generate-candidates', async (req, res) => {
    const {
      projectId = 'proj-custom',
      segments = [],
      preferences = [],
      creatorProfile,
    } = req.body as {
      projectId: string;
      segments: TranscriptSegment[];
      preferences: PreferenceRule[];
      creatorProfile?: { creatorName?: string; preferredTone?: string };
    };

    if (!Array.isArray(segments) || segments.length === 0) {
      res.status(400).json({ error: 'Transcript segments are required.' });
      return;
    }

    const instagramRules = getApplicableActiveRules(preferences, projectId, 'instagram_reels');
    const youtubeRules = getApplicableActiveRules(preferences, projectId, 'youtube_shorts');
    const activeRuleMap = new Map<string, PreferenceRule>();
    [...instagramRules, ...youtubeRules].forEach((rule) => activeRuleMap.set(rule.rule_id, rule));
    const activeRules = [...activeRuleMap.values()];
    const ai = getGenAIClient();

    if (!ai) {
      const fallbackCandidates = buildDeterministicFallbackCandidates({
        projectId,
        segments,
        activeRules,
        instagramRules,
        youtubeRules,
      });
      res.json({
        candidates: fallbackCandidates,
        generationSource: 'DEMO FALLBACK' as GenerationSourceLabel,
        fallbackReason:
          'GEMINI_API_KEY is not configured in environment; generated deterministic source-grounded candidates (DEMO FALLBACK).',
      });
      return;
    }

    const lineBreak = String.fromCharCode(10);
    const formatRules = (rules: PreferenceRule[]) =>
      rules.length > 0
        ? rules
            .map(
              (r, i) =>
                `${i + 1}. [${r.scope}:${r.scope_reference} | ${r.rule_type}] ${r.human_readable_description} (Params: ${JSON.stringify(r.rule_parameters)})`
            )
            .join(lineBreak)
        : 'No custom creator rules active for this platform.';
    const rulesPrompt =
      'INSTAGRAM REELS RULES (MUST OBEY):' + lineBreak + formatRules(instagramRules) +
      lineBreak + lineBreak + 'YOUTUBE SHORTS RULES (MUST OBEY):' + lineBreak + formatRules(youtubeRules);

    const transcriptListing = segments
      .map(
        (s) =>
          `${s.segment_id} [${Math.round(s.start_ms / 1000)}s-${Math.round(
            s.end_ms / 1000
          )}s] ${s.speaker_label ? `${s.speaker_label}: ` : ''}${s.text}`
      )
      .join('\n');

    const buildPrompt = (correctionNote?: string) => `
You are LOOPFRAME AI, an explainable clip candidate selector for expert-led creators.
Select 3 to 4 source-grounded clip candidates from the provided transcript segments.

CRITICAL CONSTRAINTS:
1. Return ONLY valid segment IDs from the list (${segments[0].segment_id} to ${
      segments[segments.length - 1].segment_id
    }).
2. start_segment_id MUST come before or equal to end_segment_id.
3. Do NOT invent timestamps or rewrite the source transcript—our server builds the exact quote from your selected segment IDs.
4. Provide distinct copy for instagram_reels (concise, conversational) and youtube_shorts (clear topic framing and searchable caption). Apply each platform-scoped rule ONLY to its named platform; global/project rules apply to both.
5. ${rulesPrompt}
${
  creatorProfile?.preferredTone
    ? `Creator preferred tone: ${creatorProfile.preferredTone}`
    : ''
}
${correctionNote ? `\nCORRECTION FROM PREVIOUS ATTEMPT: ${correctionNote}` : ''}

TRANSCRIPT SEGMENTS:
${transcriptListing}
`;

    const tryModelCall = async (correctionNote?: string) => {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: buildPrompt(correctionNote),
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                candidate_id: { type: Type.STRING },
                title: { type: Type.STRING },
                start_segment_id: { type: Type.STRING },
                end_segment_id: { type: Type.STRING },
                reason: { type: Type.STRING },
                suggested_hook: { type: Type.STRING },
                instagram_caption: { type: Type.STRING },
                youtube_hook: { type: Type.STRING },
                youtube_caption: { type: Type.STRING },
                risk_flags: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                candidate_type: { type: Type.STRING },
              },
              required: [
                'title',
                'start_segment_id',
                'end_segment_id',
                'reason',
                'suggested_hook',
                'instagram_caption',
                'youtube_hook',
                'youtube_caption',
                'candidate_type',
              ],
            },
          },
        },
      });

      const rawJson = JSON.parse((response.text ?? '[]').trim());
      if (!Array.isArray(rawJson) || rawJson.length < 3 || rawJson.length > 5) {
        throw new Error(
          `Expected 3–5 candidates, model returned ${
            Array.isArray(rawJson) ? rawJson.length : 'non-array'
          }.`
        );
      }

      const validated: ClipCandidate[] = [];
      for (let i = 0; i < rawJson.length; i++) {
        const item = rawJson[i];
        const asm = assembleCandidateFromSegments(
          segments,
          item.start_segment_id,
          item.end_segment_id
        );
        if (!asm.valid) {
          throw new Error(asm.error || 'Invalid segment IDs in model output.');
        }

        const hook = String(item.suggested_hook || item.title);
        const igCap = String(item.instagram_caption || asm.sourceExcerpt);
        const ytHook = String(item.youtube_hook || hook);
        const ytCap = String(item.youtube_caption || asm.sourceExcerpt);

        const ctx = evaluateContextIntegrity({
          allSegments: segments,
          startSegmentId: item.start_segment_id,
          endSegmentId: item.end_segment_id,
          assembledExcerpt: asm.sourceExcerpt,
          suggestedHook: hook,
          captionText: igCap,
        });

        const igRuleTests = evaluateAllRulesForOutput({
          rules: instagramRules,
          hook,
          caption: igCap,
          sourceExcerpt: asm.sourceExcerpt,
        });

        const ytRuleTests = evaluateAllRulesForOutput({
          rules: youtubeRules,
          hook: ytHook,
          caption: ytCap,
          sourceExcerpt: asm.sourceExcerpt,
        });

        validated.push({
          candidate_id: `cand-live-${Date.now().toString(36)}-${i + 1}`,
          project_id: projectId,
          title: String(item.title),
          start_segment_id: item.start_segment_id,
          end_segment_id: item.end_segment_id,
          source_segment_ids: asm.sourceSegmentIds,
          source_excerpt: asm.sourceExcerpt,
          start_ms: asm.startMs,
          end_ms: asm.endMs,
          duration_sec: asm.durationSec,
          reason: String(item.reason),
          suggested_hook: hook,
          platform_targets: ['instagram_reels', 'youtube_shorts'],
          platform_copy: {
            instagram_reels: {
              destination: 'instagram_reels',
              hook,
              caption: igCap,
              cta: 'What part of this stood out to you?',
              hashtags: ['#CreatorInsights', '#DeepWork'],
              rule_tests: igRuleTests,
              updated_at: new Date().toISOString(),
            },
            youtube_shorts: {
              destination: 'youtube_shorts',
              hook: ytHook,
              caption: ytCap,
              cta: 'Full discussion in the main episode.',
              hashtags: ['#Shorts', '#Education'],
              rule_tests: ytRuleTests,
              updated_at: new Date().toISOString(),
            },
          },
          risk_flags: Array.isArray(item.risk_flags)
            ? item.risk_flags.map(String)
            : [],
          candidate_type: String(item.candidate_type || 'Key Insight'),
          context_status: ctx.context_status,
          review_status: 'Needs review',
          deterministic_checks: ctx.deterministic_checks,
          advisory_checks: ctx.advisory_checks,
          active_rules_applied: activeRules.map((r) => r.rule_id),
          rule_test_results: igRuleTests,
          revisions: [],
          generation_source: 'LIVE AI',
        });
      }
      return validated;
    };

    try {
      const candidates = await tryModelCall();
      res.json({
        candidates,
        generationSource: 'LIVE AI' as GenerationSourceLabel,
      });
    } catch (firstErr: unknown) {
      const errMsg =
        firstErr instanceof Error ? firstErr.message : 'Validation failed';
      try {
        // Retry once with correction instruction per Section 6
        const retryCandidates = await tryModelCall(
          `Your previous response failed validation: ${errMsg}. Return 3 to 4 candidates using ONLY valid segment IDs (${segments
            .map((s) => s.segment_id)
            .join(', ')}) where start_segment_id <= end_segment_id.`
        );
        res.json({
          candidates: retryCandidates,
          generationSource: 'LIVE AI' as GenerationSourceLabel,
        });
      } catch (secondErr: unknown) {
        const secondMsg =
          secondErr instanceof Error ? secondErr.message : 'Model call failed';
        const fallbackCandidates = buildDeterministicFallbackCandidates({
          projectId,
          segments,
          activeRules,
          instagramRules,
          youtubeRules,
        });
        res.json({
          candidates: fallbackCandidates,
          generationSource: 'DEMO FALLBACK' as GenerationSourceLabel,
          fallbackReason: `Live model validation failed after 1 retry (${secondMsg}). Loaded labelled deterministic DEMO FALLBACK.`,
        });
      }
    }
  });

  // 3. Parse creator feedback and map to closed rule taxonomy
  app.post('/api/parse-feedback', async (req, res) => {
    const {
      feedbackId = `fb-${Date.now().toString(36)}`,
      projectId = 'proj-sample-01',
      reasonChips = [],
      freeText = '',
    } = req.body as {
      feedbackId?: string;
      projectId: string;
      reasonChips: FeedbackReasonChip[];
      freeText: string;
    };

    const deterministicResult = mapCreatorFeedbackToProposedRule({
      feedbackId,
      projectId,
      reasonChips,
      freeText,
    });

    const ai = getGenAIClient();
    if (!ai || deterministicResult.reliableMapping) {
      res.json({
        ...deterministicResult,
        mappingSource: 'DETERMINISTIC_MAPPER',
      });
      return;
    }

    // If freeText wasn't caught by regex, ask Gemini to map into the closed taxonomy
    try {
      const allowedTypes = CLOSED_RULE_TAXONOMY.map((t) => t.type);
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Map the creator's clip review feedback into ONE of the closed taxonomy rule types: ${allowedTypes.join(
          ', '
        )}.
If the feedback does not clearly map to an editorial rule, select CUSTOM_REVIEW_REQUIRED.
Creator reason chips: ${reasonChips.join(', ')}
Creator feedback text: "${freeText}"`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              rule_type: { type: Type.STRING },
              human_readable_description: { type: Type.STRING },
              reliable_mapping: { type: Type.BOOLEAN },
            },
            required: [
              'rule_type',
              'human_readable_description',
              'reliable_mapping',
            ],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      const candidateType = allowedTypes.includes(parsed.rule_type as RuleType)
        ? (parsed.rule_type as RuleType)
        : 'CUSTOM_REVIEW_REQUIRED';

      const taxonomyEntry =
        CLOSED_RULE_TAXONOMY.find((t) => t.type === candidateType) ??
        CLOSED_RULE_TAXONOMY[CLOSED_RULE_TAXONOMY.length - 1];

      const proposedRule: PreferenceRule = {
        ...deterministicResult.proposedRule,
        rule_type: candidateType,
        human_readable_description:
          parsed.human_readable_description ||
          taxonomyEntry.defaultDescription,
        rule_parameters: { ...taxonomyEntry.defaultParameters },
      };

      res.json({
        reliableMapping:
          candidateType !== 'CUSTOM_REVIEW_REQUIRED' &&
          Boolean(parsed.reliable_mapping),
        proposedRule,
        mappingSource: 'LIVE AI' as GenerationSourceLabel,
      });
    } catch {
      res.json({
        ...deterministicResult,
        mappingSource: 'DEMO FALLBACK' as GenerationSourceLabel,
      });
    }
  });

  // 4. Regenerate candidate hook & copy with confirmed active rules + run deterministic tests
  app.post('/api/regenerate-candidate', async (req, res) => {
    const {
      candidate,
      segments = [],
      activeRules = [],
      simulateRuleFailure = false,
    } = req.body as {
      candidate: ClipCandidate;
      segments: TranscriptSegment[];
      activeRules: PreferenceRule[];
      simulateRuleFailure?: boolean;
    };

    if (!candidate) {
      res.status(400).json({ error: 'Candidate is required.' });
      return;
    }

    const asm = assembleCandidateFromSegments(
      segments,
      candidate.start_segment_id,
      candidate.end_segment_id
    );
    const sourceExcerpt = asm.valid ? asm.sourceExcerpt : candidate.source_excerpt;

    // If user explicitly tests the honest failure mode ("Test Failure Scenario")
    if (simulateRuleFailure) {
      const failingHook =
        'This 10x Secret Learning Hack Guarantees Instant Recall Overnight';
      const failingCaption =
        'Use this 10x secret hack to master complex systems effortlessly with 100% guaranteed recall.';

      const ruleTests = evaluateAllRulesForOutput({
        rules: activeRules,
        hook: failingHook,
        caption: failingCaption,
        sourceExcerpt,
      });

      res.json({
        hook: failingHook,
        instagramCaption: failingCaption,
        youtubeHook: failingHook,
        youtubeCaption: failingCaption,
        ruleTests,
        generationSource: 'DEMO FALLBACK' as GenerationSourceLabel,
        summary:
          'Simulated rule-violating output to verify honest deterministic failure reporting.',
      });
      return;
    }

    const ai = getGenAIClient();
    let newHook = '';
    let newIgCaption = '';
    let newYtHook = '';
    let newYtCaption = '';
    let generationSource: GenerationSourceLabel = 'DEMO FALLBACK';

    if (ai) {
      try {
        const lineBreak = String.fromCharCode(10);
        const rulesList = activeRules
          .map(
            (r, idx) =>
              `${idx + 1}. [${r.scope}:${r.scope_reference} | ${r.rule_type}] ${r.human_readable_description} (Parameters: ${JSON.stringify(r.rule_parameters)})`
          )
          .join(lineBreak);

        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: `Rewrite the hook and platform captions for this clip while preserving the exact meaning and qualifications of the source excerpt. Apply global/project rules to both platforms and each platform-scoped rule only to its named platform.

SOURCE EXCERPT (verbatim from transcript):
"${sourceExcerpt}"

PREVIOUS HOOK:
"${candidate.suggested_hook}"

ACTIVE CONFIRMED RULES TO OBEY:
${rulesList || 'Preserve educational context and avoid exaggeration.'}

Requirements:
- Do NOT use any forbidden terms listed in the rules.
- If a maxWords limit is present, keep the hook strictly under that word count.
- If a requiredTopicPhrase or qualification term is specified, include it naturally.
- Do NOT invent numbers or statistics not in the source excerpt.`,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                hook: { type: Type.STRING },
                instagram_caption: { type: Type.STRING },
                youtube_hook: { type: Type.STRING },
                youtube_caption: { type: Type.STRING },
              },
              required: [
                'hook',
                'instagram_caption',
                'youtube_hook',
                'youtube_caption',
              ],
            },
          },
        });

        const parsed = JSON.parse((response.text ?? '{}').trim());
        if (parsed.hook && parsed.instagram_caption) {
          newHook = String(parsed.hook);
          newIgCaption = String(parsed.instagram_caption);
          newYtHook = String(parsed.youtube_hook || parsed.hook);
          newYtCaption = String(
            parsed.youtube_caption || parsed.instagram_caption
          );
          generationSource = 'LIVE AI';
        }
      } catch {
        // Fall through to deterministic rule-compliant generator labelled DEMO FALLBACK
      }
    }

    if (!newHook) {
      generationSource = 'DEMO FALLBACK';
      // Deterministic rule-aware regeneration for the sample candidates or custom transcripts
      const topicRule = activeRules.find(
        (r) => r.rule_type === 'INCLUDE_CLEAR_TOPIC'
      );
      const qualRule = activeRules.find(
        (r) => r.rule_type === 'PRESERVE_QUALIFICATIONS'
      );
      const conciseRule = activeRules.find(
        (r) => r.rule_type === 'PREFER_CONCISE_HOOKS'
      );

      if (candidate.candidate_id === 'cand-sample-01') {
        newHook =
          'Write Down Three Problem-Space Questions Before Memorizing Terminology';
        newIgCaption =
          'Reading a dense technical book from page one creates familiarity, not retrieval strength. Start by building a coarse mental model first: write down three concrete questions the system is designed to solve.';
        newYtHook =
          'How to Build a Coarse Mental Model Before Reading Technical Books';
        newYtCaption =
          'Cognitive science educator Dr. Elena Rostova explains why linear highlighting fails and how starting with three problem-space questions builds retrieval strength.';
      } else if (candidate.candidate_id === 'cand-sample-02') {
        newHook =
          'Why Concept Maps Only Work After You Build Foundational Vocabulary First';
        newIgCaption =
          'Sketching how three core concepts connect on a blank page compresses initial orientation—however, that rapid mapping only works if you build the foundational vocabulary first.';
        newYtHook =
          'Concept Mapping Caveat: Build Foundational Vocabulary First';
        newYtCaption =
          'Classroom trials show sketching concept maps improves recall a week later, unless learners skip the foundational vocabulary prerequisite.';
      } else if (candidate.candidate_id === 'cand-sample-03') {
        newHook =
          'Use Closed-Note Self-Explanation to Pinpoint Your Learning Boundary';
        newIgCaption =
          'Close your notes and explain out loud why step A forces step B to happen. Where your explanation stalls is diagnostic signal—and ten minutes of retrieval beats two hours of passive re-reading.';
        newYtHook =
          'Closed-Note Self-Explanation vs. Passive Re-Reading in Technical Study';
        newYtCaption =
          'Dr. Elena Rostova breaks down how self-explanation stalls act as diagnostic signals during deliberate practice.';
      } else {
        // For user transcripts, never substitute unrelated sample copy.
        // The fallback stays close to the selected source excerpt and is labelled DEMO FALLBACK.
        const sourceLead = sourceExcerpt.split(/[.!?]/)[0]?.trim() || sourceExcerpt.trim();
        const safeLead = sourceLead.length > 100
          ? `${sourceLead.slice(0, 97).trimEnd()}…`
          : sourceLead;
        newHook = safeLead ? `Key idea: ${safeLead}` : 'Key idea from this transcript';
        newIgCaption = sourceExcerpt;
        newYtHook = safeLead ? `Understanding: ${safeLead}` : newHook;
        newYtCaption = sourceExcerpt;
      }

      // A required topic phrase is added only when it is grounded in the source excerpt.
      if (topicRule?.rule_parameters.requiredTopicPhrase) {
        const phrase = topicRule.rule_parameters.requiredTopicPhrase;
        if (
          sourceExcerpt.toLowerCase().includes(phrase.toLowerCase()) &&
          !newHook.toLowerCase().includes(phrase.toLowerCase())
        ) {
          newHook = `${phrase}: ${newHook}`;
        }
      }

      if (conciseRule?.rule_parameters.maxWords) {
        const maxW = conciseRule.rule_parameters.maxWords;
        const words = newHook.split(/\s+/).filter(Boolean);
        if (words.length > maxW) {
          newHook = words.slice(0, maxW).join(' ');
        }
      }
    }

    const ruleTests = evaluateAllRulesForOutput({
      rules: activeRules,
      hook: newHook,
      caption: newIgCaption,
      sourceExcerpt,
    });

    res.json({
      hook: newHook,
      instagramCaption: newIgCaption,
      youtubeHook: newYtHook,
      youtubeCaption: newYtCaption,
      ruleTests,
      generationSource,
      summary: `Regenerated with ${activeRules.length} active confirmed rule(s) [${generationSource}].`,
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`LOOPFRAME AI V4 server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
