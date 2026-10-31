import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileText,
  Sparkles,
} from 'lucide-react';
import { useLoopframe } from '../context/LoopframeContext';
import {
  SAMPLE_TRANSCRIPT_RAW,
  SECOND_SAMPLE_TRANSCRIPT_RAW,
} from '../lib/seedData';
import {
  formatTimecode,
  parseTimestampedTranscript,
} from '../lib/transcriptParser';

const MALFORMED_EXAMPLE_TRANSCRIPT = `[00:00:08] Host: Let's talk about why engineering post-mortems stall.
Line two is missing a bracketed timestamp entirely.
[00:00:78] Speaker: This line has 78 seconds which is invalid.
[00:00:03] Speaker: This timestamp goes backward before 00:00:08.`;

export const NewProjectPage: React.FC = () => {
  const { createProjectFromTranscript, navigate, isGenerating } =
    useLoopframe();

  const [projectName, setProjectName] = useState(
    'Systems Engineering Post-Mortems — Priya Nair Interview'
  );
  const [sourceChoice, setSourceChoice] = useState<
    'Use sample transcript' | 'Paste transcript'
  >('Paste transcript');
  const [rawTranscript, setRawTranscript] = useState(
    SECOND_SAMPLE_TRANSCRIPT_RAW
  );
  const [submitError, setSubmitError] = useState<string | null>(null);

  const parseResult = useMemo(
    () => parseTimestampedTranscript(rawTranscript),
    [rawTranscript]
  );

  const handleSelectSourceChoice = (
    choice: 'Use sample transcript' | 'Paste transcript'
  ) => {
    setSourceChoice(choice);
    setSubmitError(null);
    if (choice === 'Use sample transcript') {
      setProjectName(
        'Ep. 42 — Building Mental Models for Complex Systems (Copy)'
      );
      setRawTranscript(SAMPLE_TRANSCRIPT_RAW);
    } else {
      setProjectName('Systems Engineering Post-Mortems — Priya Nair Interview');
      setRawTranscript(SECOND_SAMPLE_TRANSCRIPT_RAW);
    }
  };

  const handleLoadMalformedExample = () => {
    setSourceChoice('Paste transcript');
    setRawTranscript(MALFORMED_EXAMPLE_TRANSCRIPT);
    setSubmitError(null);
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!projectName.trim()) {
      setSubmitError('Please enter a project name.');
      return;
    }

    if (!parseResult.valid) {
      setSubmitError(
        `Please fix the ${parseResult.errors.length} timestamp validation error(s) listed below before creating the project.`
      );
      return;
    }

    const res = await createProjectFromTranscript({
      name: projectName.trim(),
      rawTranscript,
      sourceType:
        sourceChoice === 'Use sample transcript'
          ? 'Sample transcript'
          : 'Pasted transcript',
    });

    if (!res.ok || !res.projectId) {
      setSubmitError(res.error || 'Could not create project.');
      return;
    }

    navigate(`/projects/${res.projectId}`);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/projects')}
          className="text-xs font-medium text-slate-600 hover:text-slate-900 flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Projects</span>
        </button>

        <span className="text-xs font-mono text-slate-500">
          TRANSCRIPT-FIRST P0 INPUT
        </span>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-8 space-y-6">
        <div className="space-y-1.5 border-b border-slate-100 pb-5">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            Create Transcript-Grounded Project
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            LOOPFRAME V4 P0 is deliberately transcript-first so source quotes,
            segment IDs, and deterministic context checks work without external
            media rendering. Raw video/audio file upload and automatic
            transcription belong to P1 after the core editorial loop.
          </p>
        </div>

        <form onSubmit={handleCreateProject} className="space-y-6">
          {/* Project Name */}
          <div className="space-y-1.5">
            <label
              htmlFor="new-project-name"
              className="block text-xs font-semibold text-slate-800"
            >
              Project Name
            </label>
            <input
              id="new-project-name"
              type="text"
              required
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g., Ep. 45 — Distributed Systems Reliability"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
            />
          </div>

          {/* Source Input Choices */}
          <div className="space-y-2">
            <span className="block text-xs font-semibold text-slate-800">
              Source Input Mode
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleSelectSourceChoice('Paste transcript')}
                className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
                  sourceChoice === 'Paste transcript'
                    ? 'border-[#0D9488] bg-[#0D9488]/5'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <p className="text-xs font-bold text-slate-900">
                  Paste transcript
                </p>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Paste any timestamped transcript ([HH:MM:SS] Speaker: text).
                </p>
              </button>

              <button
                type="button"
                onClick={() =>
                  handleSelectSourceChoice('Use sample transcript')
                }
                className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
                  sourceChoice === 'Use sample transcript'
                    ? 'border-[#0D9488] bg-[#0D9488]/5'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <p className="text-xs font-bold text-slate-900">
                  Use sample transcript (DEMO DATA)
                </p>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Load the 15-segment educator podcast transcript (Dr. Elena
                  Rostova).
                </p>
              </button>
            </div>
          </div>

          {/* Format Guidance & Test Malformed Helper */}
          <div className="bg-slate-50 rounded-xl border border-slate-200/80 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-1">
              <p className="font-semibold text-slate-800">
                Predictable Timestamped Format Guidance
              </p>
              <p className="text-slate-600 font-mono text-[11px]">
                [00:00:05] Speaker 1: First segment text... | [00:00:18] Text
                without speaker label...
              </p>
              <p className="text-[11px] text-slate-500">
                If speaker labels are omitted, LOOPFRAME keeps them null and
                never invents speaker names.
              </p>
            </div>

            <button
              type="button"
              onClick={handleLoadMalformedExample}
              className="px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-[11px] font-medium shrink-0 cursor-pointer"
            >
              Test Malformed Timestamp Validator
            </button>
          </div>

          {/* Transcript Paste Area */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="transcript-textarea"
                className="block text-xs font-semibold text-slate-800"
              >
                Timestamped Transcript Input
              </label>
              <span className="font-mono text-xs text-slate-500 tabular-nums">
                {parseResult.segments.length} valid segments parsed
              </span>
            </div>
            <textarea
              id="transcript-textarea"
              rows={10}
              value={rawTranscript}
              onChange={(e) => setRawTranscript(e.target.value)}
              placeholder="[00:00:05] Speaker 1: Paste your timestamped transcript lines here..."
              className="w-full p-3.5 rounded-xl border border-slate-300 font-mono text-xs text-slate-900 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
            />
          </div>

          {/* Real-time Validation Diagnostics */}
          {parseResult.errors.length > 0 ? (
            <div
              role="alert"
              className="rounded-xl border border-red-300 bg-red-50/80 p-4 space-y-2.5"
            >
              <div className="flex items-center gap-2 text-xs font-bold text-red-900">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>
                  Transcript Structure Validation Failed (
                  {parseResult.errors.length} line
                  {parseResult.errors.length === 1 ? '' : 's'} need correction)
                </span>
              </div>
              <ul className="space-y-1.5 text-xs text-red-800 font-mono">
                {parseResult.errors.map((err, idx) => (
                  <li
                    key={`${err.lineNumber}-${idx}`}
                    className="bg-white/90 rounded-lg p-2 border border-red-200"
                  >
                    <span className="font-bold">Line {err.lineNumber}:</span>{' '}
                    {err.reason}
                    {err.rawLine && (
                      <div className="text-[11px] text-slate-600 mt-0.5 truncate">
                        Source: &ldquo;{err.rawLine}&rdquo;
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-900">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Transcript Validated: {parseResult.segments.length} immutable
                    segments ready
                  </span>
                </div>
                <span className="font-mono text-[11px] text-emerald-800 tabular-nums">
                  Span:{' '}
                  {formatTimecode(parseResult.segments[0]?.start_ms ?? 0)} –{' '}
                  {formatTimecode(
                    parseResult.segments[parseResult.segments.length - 1]
                      ?.end_ms ?? 0
                  )}
                </span>
              </div>

              <div className="max-h-36 overflow-y-auto space-y-1 pt-1 border-t border-emerald-200/60 text-[11px] font-mono text-slate-700">
                {parseResult.segments.slice(0, 5).map((seg) => (
                  <div key={seg.segment_id} className="truncate">
                    <span className="text-slate-500">{seg.segment_id}</span> [
                    {formatTimecode(seg.start_ms)}–{formatTimecode(seg.end_ms)}]{' '}
                    {seg.speaker_label ? (
                      <strong className="text-slate-900">
                        {seg.speaker_label}:
                      </strong>
                    ) : (
                      <span className="italic text-slate-400">
                        (no speaker label)
                      </span>
                    )}{' '}
                    {seg.text}
                  </div>
                ))}
                {parseResult.segments.length > 5 && (
                  <div className="text-slate-500">
                    + {parseResult.segments.length - 5} additional verified
                    segments...
                  </div>
                )}
              </div>
            </div>
          )}

          {submitError && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 font-medium"
            >
              {submitError}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => navigate('/projects')}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!parseResult.valid || isGenerating}
              title={
                !parseResult.valid
                  ? 'Fix transcript validation errors before creating project'
                  : 'Create project and generate source-grounded candidates'
              }
              className="px-5 py-2.5 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] disabled:bg-slate-300 disabled:text-slate-500 text-white text-xs sm:text-sm font-semibold flex items-center gap-2 transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <>
                  <Sparkles className="w-4 h-4 animate-spin" />
                  <span>Generating 3–5 Source-Grounded Candidates...</span>
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  <span>Create Project & Open Studio</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
