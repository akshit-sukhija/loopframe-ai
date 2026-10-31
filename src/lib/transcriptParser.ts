import { TranscriptParseResult, TranscriptSegment, TranscriptValidationLineError } from '../types/loopframe';

/**
 * Formats milliseconds into [HH:MM:SS] or MM:SS timecode.
 */
export function formatTimecode(ms: number, includeHours = true): string {
  if (!Number.isFinite(ms) || ms < 0) return includeHours ? '00:00:00' : '00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => String(n).padStart(2, '0');
  if (includeHours || hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Parses a single timestamp token like "00:01:24" or "01:24" into milliseconds.
 * Returns null if malformed (e.g. seconds >= 60 or non-numeric).
 */
export function parseTimestampTokenToMs(token: string): number | null {
  const cleaned = token.trim().replace(/^\[|\]$/g, '');
  const parts = cleaned.split(':');
  if (parts.length !== 2 && parts.length !== 3) {
    return null;
  }

  const nums = parts.map((p) => {
    if (!/^\d{1,2}(\.\d{1,3})?$/.test(p)) return NaN;
    return Number(p);
  });

  if (nums.some((n) => Number.isNaN(n) || n < 0)) {
    return null;
  }

  let hours = 0;
  let minutes = 0;
  let seconds = 0;

  if (nums.length === 3) {
    [hours, minutes, seconds] = nums;
  } else {
    [minutes, seconds] = nums;
  }

  if (minutes >= 60 || seconds >= 60) {
    return null;
  }

  return Math.round((hours * 3600 + minutes * 60 + seconds) * 1000);
}

/**
 * Parses a user-pasted or seeded timestamped transcript into immutable segments.
 * Preserves original text verbatim and never invents missing speaker labels.
 * Detects malformed timestamps and non-monotonic ordering with exact line numbers.
 */
export function parseTimestampedTranscript(rawTranscript: string): TranscriptParseResult {
  const lines = rawTranscript.split(/\r?\n/);
  const segments: TranscriptSegment[] = [];
  const errors: TranscriptValidationLineError[] = [];
  const explicitEndSegmentIds = new Set<string>();

  let lastStartMs = -1;
  let orderIndex = 0;

  // Match lines starting with [timestamp] or [start - end] or bare timestamp
  // Examples:
  // [00:00:05] Dr. Elena Rostova: Welcome back...
  // [00:00:05 - 00:00:18] Speaker 1: Text...
  // [00:05] Text without speaker...
  const lineRegex = /^\s*\[([^\]]+)\]\s*(.*)$/;

  lines.forEach((rawLine, idx) => {
    const lineNumber = idx + 1;
    const trimmed = rawLine.trim();
    if (!trimmed) return;

    const match = trimmed.match(lineRegex);
    if (!match) {
      errors.push({
        lineNumber,
        rawLine,
        reason: 'Missing bracketed timestamp at start of line (expected format: [00:00:05] Speaker: text or [00:00:05] text).',
      });
      return;
    }

    const rawTimeBlock = match[1].trim();
    const remainder = match[2].trim();

    if (!remainder) {
      errors.push({
        lineNumber,
        rawLine,
        reason: 'Transcript line has a timestamp but no spoken text.',
      });
      return;
    }

    let startMs: number | null = null;
    let explicitEndMs: number | null = null;

    if (rawTimeBlock.includes('-') || rawTimeBlock.includes('–')) {
      const rangeParts = rawTimeBlock.split(/[-–]/).map((s) => s.trim());
      if (rangeParts.length !== 2) {
        errors.push({
          lineNumber,
          rawLine,
          reason: `Malformed timestamp range "[${rawTimeBlock}]". Use [HH:MM:SS] or [HH:MM:SS - HH:MM:SS].`,
        });
        return;
      }
      startMs = parseTimestampTokenToMs(rangeParts[0]);
      explicitEndMs = parseTimestampTokenToMs(rangeParts[1]);
      if (startMs === null || explicitEndMs === null) {
        errors.push({
          lineNumber,
          rawLine,
          reason: `Invalid timestamp numbers in "[${rawTimeBlock}]". Ensure minutes and seconds are 00–59.`,
        });
        return;
      }
      if (explicitEndMs <= startMs) {
        errors.push({
          lineNumber,
          rawLine,
          reason: `End timestamp must be strictly after start timestamp in "[${rawTimeBlock}]".`,
        });
        return;
      }
    } else {
      startMs = parseTimestampTokenToMs(rawTimeBlock);
      if (startMs === null) {
        errors.push({
          lineNumber,
          rawLine,
          reason: `Malformed timestamp "[${rawTimeBlock}]". Expected [HH:MM:SS] or [MM:SS] with valid minutes/seconds (00–59).`,
        });
        return;
      }
    }

    if (lastStartMs !== -1 && startMs < lastStartMs) {
      errors.push({
        lineNumber,
        rawLine,
        reason: `Non-monotonic timestamp [${formatTimecode(startMs)}] comes before previous segment [${formatTimecode(lastStartMs)}].`,
      });
      return;
    }

    // Extract optional speaker label ONLY if explicitly present ("Speaker Name: text")
    // Do not invent speaker labels if missing.
    let speakerLabel: string | null = null;
    let spokenText = remainder;

    const speakerMatch = remainder.match(/^([A-Za-z0-9_.\s()-]{1,36}):\s+(.+)$/);
    if (speakerMatch) {
      speakerLabel = speakerMatch[1].trim();
      spokenText = speakerMatch[2].trim();
    }

    orderIndex += 1;
    const segmentId = `seg-${String(orderIndex).padStart(2, '0')}`;

    if (explicitEndMs !== null) explicitEndSegmentIds.add(segmentId);

    segments.push({
      segment_id: segmentId,
      start_ms: startMs,
      end_ms: explicitEndMs ?? startMs + 12000, // updated safely in second pass
      speaker_label: speakerLabel,
      text: spokenText,
      source_order: orderIndex,
    });

    lastStartMs = startMs;
  });

  // Derive safe end_ms from next segment's start_ms when not explicitly supplied
  for (let i = 0; i < segments.length; i++) {
    const current = segments[i];
    const next = segments[i + 1];
    if (next && !explicitEndSegmentIds.has(current.segment_id) && next.start_ms > current.start_ms) {
      current.end_ms = next.start_ms;
    } else if (!next && !explicitEndSegmentIds.has(current.segment_id)) {
      // Estimate based on word count (~2.5 words/sec, min 6s, max 25s)
      const wordCount = current.text.split(/\s+/).filter(Boolean).length;
      const estimatedDurationMs = Math.max(6000, Math.min(25000, Math.round((wordCount / 2.5) * 1000)));
      if (current.end_ms <= current.start_ms || current.end_ms === current.start_ms + 12000) {
        current.end_ms = current.start_ms + estimatedDurationMs;
      }
    }
  }

  if (segments.length === 0 && errors.length === 0) {
    errors.push({
      lineNumber: 1,
      rawLine: '',
      reason: 'Transcript is empty. Paste at least 3 timestamped lines such as [00:00:05] Speaker: text.',
    });
  }

  return {
    valid: errors.length === 0 && segments.length > 0,
    segments,
    errors,
  };
}

/**
 * Assembles the exact source excerpt from transcript segments by ID range.
 * Never uses LLM output for quotes; joins original user-provided text directly.
 */
export function assembleCandidateFromSegments(
  allSegments: TranscriptSegment[],
  startSegmentId: string,
  endSegmentId: string
): {
  valid: boolean;
  error?: string;
  selectedSegments: TranscriptSegment[];
  sourceSegmentIds: string[];
  sourceExcerpt: string;
  startMs: number;
  endMs: number;
  durationSec: number;
} {
  const startIdx = allSegments.findIndex((s) => s.segment_id === startSegmentId);
  const endIdx = allSegments.findIndex((s) => s.segment_id === endSegmentId);

  if (startIdx === -1 || endIdx === -1) {
    return {
      valid: false,
      error: `Unknown segment ID(s): start="${startSegmentId}", end="${endSegmentId}"`,
      selectedSegments: [],
      sourceSegmentIds: [],
      sourceExcerpt: '',
      startMs: 0,
      endMs: 0,
      durationSec: 0,
    };
  }

  if (startIdx > endIdx) {
    return {
      valid: false,
      error: `Start segment "${startSegmentId}" (order ${startIdx + 1}) comes after end segment "${endSegmentId}" (order ${endIdx + 1}).`,
      selectedSegments: [],
      sourceSegmentIds: [],
      sourceExcerpt: '',
      startMs: 0,
      endMs: 0,
      durationSec: 0,
    };
  }

  const selectedSegments = allSegments.slice(startIdx, endIdx + 1);
  const sourceSegmentIds = selectedSegments.map((s) => s.segment_id);
  const sourceExcerpt = selectedSegments.map((s) => s.text).join(' ');
  const startMs = selectedSegments[0].start_ms;
  const endMs = selectedSegments[selectedSegments.length - 1].end_ms;
  const durationSec = Math.max(1, Math.round((endMs - startMs) / 1000));

  return {
    valid: true,
    selectedSegments,
    sourceSegmentIds,
    sourceExcerpt,
    startMs,
    endMs,
    durationSec,
  };
}
