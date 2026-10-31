import {
  DestinationPlatform,
  FeedbackReasonChip,
  PreferenceRule,
  RuleParameters,
  RuleScope,
  RuleTestEvaluation,
  RuleType,
} from '../types/loopframe';

export const CLOSED_RULE_TAXONOMY: {
  type: RuleType;
  label: string;
  defaultDescription: string;
  deterministicSupported: boolean;
  defaultParameters: RuleParameters;
}[] = [
  {
    type: 'AVOID_EXAGGERATED_HOOKS',
    label: 'Avoid Exaggerated Hooks',
    defaultDescription:
      'Do not use superlatives, absolute promises, or hyped multipliers (e.g., "10x", "secret", "instantly", "never fail", "guaranteed", "hack") in hooks or captions.',
    deterministicSupported: true,
    defaultParameters: {
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
  },
  {
    type: 'AVOID_CLICKBAIT',
    label: 'Avoid Clickbait Phrases',
    defaultDescription:
      'Avoid sensational bait phrases such as "you won\'t believe", "shocking", "one weird trick", "stop doing this immediately", or "mind-blowing".',
    deterministicSupported: true,
    defaultParameters: {
      forbiddenTerms: [
        "you won't believe",
        'shocking',
        'one weird trick',
        'stop doing this immediately',
        'mind-blowing',
        'doctors hate',
        'wait until the end',
      ],
    },
  },
  {
    type: 'PRESERVE_QUALIFICATIONS',
    label: 'Preserve Qualifications & Caveats',
    defaultDescription:
      'Retain explicit scope qualifiers from the source transcript (such as "after fundamentals", "in most cases", "for beginners", "unless", "with deliberate practice") when summarizing claims.',
    deterministicSupported: true,
    defaultParameters: {
      requiredQualifications: [
        'fundamentals',
        'foundational',
        'unless',
        'however',
        'in most cases',
        'for beginners',
        'deliberate',
        'context',
        'first',
      ],
    },
  },
  {
    type: 'PRESERVE_EDUCATIONAL_CONTEXT',
    label: 'Preserve Educational Context',
    defaultDescription:
      'Frame hooks and captions around the underlying mechanism and learning boundary rather than isolated takeaway slogans.',
    deterministicSupported: false, // AI advisory only
    defaultParameters: {
      note: 'Requires human/AI editorial review of pedagogical framing.',
    },
  },
  {
    type: 'AVOID_UNSUPPORTED_CLAIMS',
    label: 'Avoid Unsupported Numeric or Absolute Claims',
    defaultDescription:
      'Do not introduce numbers, percentages, or universal negations in hooks/captions that do not appear in the source transcript excerpt.',
    deterministicSupported: true,
    defaultParameters: {
      forbiddenTerms: ['guaranteed', 'always works', 'every single time', 'zero effort'],
    },
  },
  {
    type: 'PREFER_CONCISE_HOOKS',
    label: 'Prefer Concise Hooks',
    defaultDescription:
      'Keep generated hooks at or below the configured maximum word count (default: 12 words).',
    deterministicSupported: true,
    defaultParameters: {
      maxWords: 12,
    },
  },
  {
    type: 'PREFER_CONVERSATIONAL_TONE',
    label: 'Prefer Conversational Tone',
    defaultDescription:
      'Use direct, peer-to-peer spoken phrasing rather than stiff promotional or academic broadcast language.',
    deterministicSupported: false, // AI advisory only
    defaultParameters: {
      note: 'Evaluated via AI advisory tone check.',
    },
  },
  {
    type: 'AVOID_JARGON',
    label: 'Avoid Unexplained Jargon',
    defaultDescription:
      'Avoid dense academic or specialist jargon terms from the user-maintained jargon list in top-line hooks.',
    deterministicSupported: true,
    defaultParameters: {
      jargonTerms: [
        'epistemological',
        'metacognitive',
        'pedagogical',
        'heuristic',
        'ontological',
        'orthogonal',
        'isomorphic',
      ],
    },
  },
  {
    type: 'INCLUDE_CLEAR_TOPIC',
    label: 'Include Clear Topic Keyword',
    defaultDescription:
      'Require an explicit topic keyword or subject phrase in the hook or opening line so viewers immediately know the subject.',
    deterministicSupported: true,
    defaultParameters: {
      requiredTopicPhrase: 'mental model',
    },
  },
  {
    type: 'CUSTOM_REVIEW_REQUIRED',
    label: 'Manual Review Note (Unmapped Feedback)',
    defaultDescription:
      'Saved creator note requiring manual review; not automatically enforced as a deterministic rule.',
    deterministicSupported: false,
    defaultParameters: {
      note: 'Saved as a manual review note.',
    },
  },
];

export const EXAGGERATED_LEXICON = [
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
];

/**
 * Maps creator natural-language feedback and reason chips into a proposed rule from the closed P0 taxonomy.
 * If no reliable mapping exists, maps to CUSTOM_REVIEW_REQUIRED (manual review note, not active enforcement).
 */
export function mapCreatorFeedbackToProposedRule(params: {
  feedbackId: string;
  projectId: string;
  reasonChips: FeedbackReasonChip[];
  freeText: string;
  defaultScope?: RuleScope;
}): {
  reliableMapping: boolean;
  proposedRule: PreferenceRule;
} {
  const {
    feedbackId,
    projectId,
    reasonChips,
    freeText,
    defaultScope = 'project',
  } = params;
  const combined = `${reasonChips.join(' ')} ${freeText}`.toLowerCase();
  const now = new Date().toISOString();

  let matchedType: RuleType = 'CUSTOM_REVIEW_REQUIRED';
  let reliableMapping = true;
  let customParams: RuleParameters = {};
  let customDescription = '';

  if (
    reasonChips.includes('exaggerated hook') ||
    /\b(exaggerat|hype|superlative|10x|secret|overpromise|sensational|dramatic)\b/.test(
      combined
    )
  ) {
    matchedType = 'AVOID_EXAGGERATED_HOOKS';
    customDescription =
      'Avoid exaggerated hooks, superlatives, and hyped multipliers ("10x", "secret", "instantly", "hack"); keep the original educational framing.';
    customParams = {
      forbiddenTerms: [...EXAGGERATED_LEXICON],
    };
  } else if (
    /\b(clickbait|bait|shocking|won't believe|weird trick)\b/.test(combined)
  ) {
    matchedType = 'AVOID_CLICKBAIT';
  } else if (
    reasonChips.includes('missing context') ||
    /\b(qualif|caveat|unless|however|prerequisite|foundation|boundary|condition)\b/.test(
      combined
    )
  ) {
    matchedType = 'PRESERVE_QUALIFICATIONS';
    customDescription =
      'Preserve essential qualifications and boundary conditions from the source transcript ("fundamentals", "unless", "first", "context").';
    customParams = {
      requiredQualifications: [
        'fundamentals',
        'foundational',
        'unless',
        'however',
        'first',
        'context',
        'practice',
      ],
    };
  } else if (
    /\b(educational context|original educational|teaching context|pedagogical)\b/.test(
      combined
    )
  ) {
    matchedType = 'PRESERVE_EDUCATIONAL_CONTEXT';
  } else if (
    /\b(unsupported|unverified|number|statistic|claim|invented)\b/.test(combined)
  ) {
    matchedType = 'AVOID_UNSUPPORTED_CLAIMS';
  } else if (
    reasonChips.includes('too long') ||
    /\b(concise|shorter|too long|wordy|brief|under \d+ words|max \d+ words)\b/.test(
      combined
    )
  ) {
    matchedType = 'PREFER_CONCISE_HOOKS';
    const wordMatch = combined.match(/\b(\d+)\s*words?\b/);
    const maxWords = wordMatch ? Math.max(4, Math.min(25, Number(wordMatch[1]))) : 12;
    customParams = { maxWords };
    customDescription = `Keep hooks concise at or under ${maxWords} words.`;
  } else if (
    reasonChips.includes('jargon') ||
    /\b(jargon|academic|technical term|complex word|terminology)\b/.test(combined)
  ) {
    matchedType = 'AVOID_JARGON';
  } else if (
    reasonChips.includes('wrong tone') ||
    /\b(conversational|natural tone|friendly|less formal|stiff)\b/.test(combined)
  ) {
    matchedType = 'PREFER_CONVERSATIONAL_TONE';
  } else if (
    /\b(clear topic|include topic|keyword|subject|explicit topic|mention)\b/.test(
      combined
    )
  ) {
    matchedType = 'INCLUDE_CLEAR_TOPIC';
    const quoteMatch = freeText.match(/["“']([^"”']+)["”']/);
    const topicPhrase = quoteMatch ? quoteMatch[1].trim() : 'learning';
    customParams = { requiredTopicPhrase: topicPhrase };
    customDescription = `Include explicit topic phrase "${topicPhrase}" in the hook or opening line.`;
  } else {
    matchedType = 'CUSTOM_REVIEW_REQUIRED';
    reliableMapping = false;
    customDescription = freeText.trim()
      ? `Manual review note: "${freeText.trim()}"`
      : 'Manual review note from creator feedback (no deterministic mapping).';
    customParams = {
      note: freeText.trim() || 'Requires manual editorial review.',
    };
  }

  const taxonomyEntry =
    CLOSED_RULE_TAXONOMY.find((t) => t.type === matchedType) ??
    CLOSED_RULE_TAXONOMY[CLOSED_RULE_TAXONOMY.length - 1];

  const proposedRule: PreferenceRule = {
    rule_id: `rule-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    rule_type: matchedType,
    human_readable_description:
      customDescription || taxonomyEntry.defaultDescription,
    scope: defaultScope,
    scope_reference: defaultScope === 'global' ? 'all' : projectId,
    source_feedback_id: feedbackId,
    source_feedback_text:
      freeText.trim() || `Selected chips: ${reasonChips.join(', ')}`,
    created_at: now,
    updated_at: now,
    status: 'active',
    confirmed_by_user: false,
    rule_parameters: {
      ...taxonomyEntry.defaultParameters,
      ...customParams,
    },
  };

  return {
    reliableMapping,
    proposedRule,
  };
}

/**
 * Filters active confirmed rules that apply to a given project and optional destination platform.
 */
export function getApplicableActiveRules(
  preferences: PreferenceRule[],
  projectId: string,
  platform?: DestinationPlatform
): PreferenceRule[] {
  return preferences.filter((rule) => {
    if (rule.status !== 'active' || !rule.confirmed_by_user) return false;
    if (rule.scope === 'global') return true;
    if (rule.scope === 'project' && rule.scope_reference === projectId) {
      return true;
    }
    if (
      rule.scope === 'platform' &&
      platform &&
      rule.scope_reference === platform
    ) {
      return true;
    }
    return false;
  });
}

/**
 * Runs deterministic post-generation test for a single rule against a hook, caption, and source excerpt.
 * Never claims deterministic pass for rules that require advisory evaluation.
 */
export function runDeterministicRuleTest(params: {
  rule: PreferenceRule;
  hook: string;
  caption: string;
  sourceExcerpt: string;
}): RuleTestEvaluation {
  const { rule, hook, caption, sourceExcerpt } = params;
  const combinedCopy = `${hook} ${caption}`;
  const combinedLower = combinedCopy.toLowerCase();
  const hookLower = hook.toLowerCase();
  const sourceLower = sourceExcerpt.toLowerCase();

  switch (rule.rule_type) {
    case 'AVOID_EXAGGERATED_HOOKS': {
      const lexicon =
        rule.rule_parameters.forbiddenTerms &&
        rule.rule_parameters.forbiddenTerms.length > 0
          ? rule.rule_parameters.forbiddenTerms
          : EXAGGERATED_LEXICON;

      const matched = lexicon.find((term) => {
        const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const rx = new RegExp(`(?:^|\\W)${escaped}(?:$|\\W)`, 'i');
        return rx.test(combinedCopy);
      });

      if (matched) {
        return {
          rule_id: rule.rule_id,
          rule_type: rule.rule_type,
          rule_description: rule.human_readable_description,
          outcome: 'Fail',
          matched_phrase_or_reason: `Matched forbidden exaggerated phrase "${matched}" in generated output (heuristic lexicon check).`,
          tested_target: hookLower.includes(matched.toLowerCase())
            ? 'hook'
            : 'caption',
        };
      }
      return {
        rule_id: rule.rule_id,
        rule_type: rule.rule_type,
        rule_description: rule.human_readable_description,
        outcome: 'Pass',
        matched_phrase_or_reason: `0 matches across ${lexicon.length} configured superlative/exaggerated phrases.`,
        tested_target: 'both',
      };
    }

    case 'AVOID_CLICKBAIT': {
      const clickbaitTerms = rule.rule_parameters.forbiddenTerms ?? [
        "you won't believe",
        'shocking',
        'one weird trick',
        'stop doing this immediately',
        'mind-blowing',
      ];
      const matched = clickbaitTerms.find((term) =>
        combinedLower.includes(term.toLowerCase())
      );
      if (matched) {
        return {
          rule_id: rule.rule_id,
          rule_type: rule.rule_type,
          rule_description: rule.human_readable_description,
          outcome: 'Fail',
          matched_phrase_or_reason: `Matched clickbait phrase "${matched}".`,
          tested_target: 'both',
        };
      }
      return {
        rule_id: rule.rule_id,
        rule_type: rule.rule_type,
        rule_description: rule.human_readable_description,
        outcome: 'Pass',
        matched_phrase_or_reason: `No clickbait phrases found (${clickbaitTerms.length} patterns checked).`,
        tested_target: 'both',
      };
    }

    case 'PREFER_CONCISE_HOOKS': {
      const maxWords = rule.rule_parameters.maxWords ?? 12;
      const words = hook.trim().split(/\s+/).filter(Boolean);
      const count = words.length;
      if (count > maxWords) {
        return {
          rule_id: rule.rule_id,
          rule_type: rule.rule_type,
          rule_description: rule.human_readable_description,
          outcome: 'Fail',
          matched_phrase_or_reason: `Hook has ${count} words, exceeding configured maximum of ${maxWords} words.`,
          tested_target: 'hook',
        };
      }
      return {
        rule_id: rule.rule_id,
        rule_type: rule.rule_type,
        rule_description: rule.human_readable_description,
        outcome: 'Pass',
        matched_phrase_or_reason: `Hook word count is ${count}/${maxWords} words.`,
        tested_target: 'hook',
      };
    }

    case 'AVOID_JARGON': {
      const jargonList = rule.rule_parameters.jargonTerms ?? [
        'epistemological',
        'metacognitive',
        'pedagogical',
        'heuristic',
        'ontological',
        'orthogonal',
      ];
      const matched = jargonList.find((j) =>
        combinedLower.includes(j.toLowerCase())
      );
      if (matched) {
        return {
          rule_id: rule.rule_id,
          rule_type: rule.rule_type,
          rule_description: rule.human_readable_description,
          outcome: 'Fail',
          matched_phrase_or_reason: `Matched restricted jargon term "${matched}".`,
          tested_target: 'both',
        };
      }
      return {
        rule_id: rule.rule_id,
        rule_type: rule.rule_type,
        rule_description: rule.human_readable_description,
        outcome: 'Pass',
        matched_phrase_or_reason: `No restricted jargon terms found (${jargonList.length} terms checked).`,
        tested_target: 'both',
      };
    }

    case 'INCLUDE_CLEAR_TOPIC': {
      const requiredPhrase = (
        rule.rule_parameters.requiredTopicPhrase ?? 'learning'
      ).trim();
      if (
        requiredPhrase &&
        !combinedLower.includes(requiredPhrase.toLowerCase())
      ) {
        return {
          rule_id: rule.rule_id,
          rule_type: rule.rule_type,
          rule_description: rule.human_readable_description,
          outcome: 'Fail',
          matched_phrase_or_reason: `Missing required topic phrase "${requiredPhrase}" in hook and caption.`,
          tested_target: 'both',
        };
      }
      return {
        rule_id: rule.rule_id,
        rule_type: rule.rule_type,
        rule_description: rule.human_readable_description,
        outcome: 'Pass',
        matched_phrase_or_reason: `Verified required topic phrase "${requiredPhrase}" is present.`,
        tested_target: 'both',
      };
    }

    case 'PRESERVE_QUALIFICATIONS': {
      const qualTerms = rule.rule_parameters.requiredQualifications ?? [
        'fundamentals',
        'foundational',
        'unless',
        'however',
        'first',
        'context',
        'practice',
        'before',
      ];
      const matchedQual = qualTerms.find((q) =>
        combinedLower.includes(q.toLowerCase())
      );
      if (!matchedQual) {
        return {
          rule_id: rule.rule_id,
          rule_type: rule.rule_type,
          rule_description: rule.human_readable_description,
          outcome: 'Fail',
          matched_phrase_or_reason: `No required qualification markers (${qualTerms.slice(0, 4).join(', ')}) retained in hook or caption.`,
          tested_target: 'both',
        };
      }
      return {
        rule_id: rule.rule_id,
        rule_type: rule.rule_type,
        rule_description: rule.human_readable_description,
        outcome: 'Pass',
        matched_phrase_or_reason: `Retained qualification term "${matchedQual}" from source context.`,
        tested_target: 'both',
      };
    }

    case 'AVOID_UNSUPPORTED_CLAIMS': {
      const numbersInCopy: string[] =
        combinedCopy.match(/\b\d+(?:\.\d+)?%?\b/g) ?? [];
      const unsupportedNum = numbersInCopy.find(
        (num) => !sourceLower.includes(num.toLowerCase())
      );
      const forbidden = rule.rule_parameters.forbiddenTerms ?? [
        'guaranteed',
        'always works',
        'every single time',
      ];
      const matchedForbidden = forbidden.find((f) =>
        combinedLower.includes(f.toLowerCase())
      );
      if (unsupportedNum || matchedForbidden) {
        return {
          rule_id: rule.rule_id,
          rule_type: rule.rule_type,
          rule_description: rule.human_readable_description,
          outcome: 'Fail',
          matched_phrase_or_reason: unsupportedNum
            ? `Numeric claim "${unsupportedNum}" does not appear in source excerpt.`
            : `Unsupported absolute claim "${matchedForbidden}" detected.`,
          tested_target: 'both',
        };
      }
      return {
        rule_id: rule.rule_id,
        rule_type: rule.rule_type,
        rule_description: rule.human_readable_description,
        outcome: 'Pass',
        matched_phrase_or_reason:
          'All numeric figures and scope claims are grounded in the source excerpt.',
        tested_target: 'both',
      };
    }

    case 'PRESERVE_EDUCATIONAL_CONTEXT':
    case 'PREFER_CONVERSATIONAL_TONE':
    case 'CUSTOM_REVIEW_REQUIRED':
    default: {
      return {
        rule_id: rule.rule_id,
        rule_type: rule.rule_type,
        rule_description: rule.human_readable_description,
        outcome: 'Advisory',
        matched_phrase_or_reason:
          'AI advisory only — semantic/tone preference requires human review and cannot claim a deterministic pass.',
        tested_target: 'both',
      };
    }
  }
}

/**
 * Runs all applicable rules against a hook, caption, and source excerpt.
 */
export function evaluateAllRulesForOutput(params: {
  rules: PreferenceRule[];
  hook: string;
  caption: string;
  sourceExcerpt: string;
}): RuleTestEvaluation[] {
  return params.rules.map((rule) =>
    runDeterministicRuleTest({
      rule,
      hook: params.hook,
      caption: params.caption,
      sourceExcerpt: params.sourceExcerpt,
    })
  );
}
