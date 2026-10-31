import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileText,
  Sparkles,
  Mic,
  Keyboard,
  ExternalLink,
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
  const [wisprPlatform, setWisprPlatform] = useState<'windows' | 'mac'>('windows');
  const [wisprPrepared, setWisprPrepared] = useState(false);
  const transcriptInputRef = useRef<HTMLTextAreaElement>(null);

  const handlePrepareWisprFlow = () => {
    setSourceChoice('Paste transcript');
    setSubmitError(null);
    setWisprPrepared(true);
    transcriptInputRef.current?.focus();
    transcriptInputRef.current?.select();
  };

  const parseResult = useMemo(
    () => parseTimestampedTranscript(rawTranscript),
    [rawTranscript]
  );

  const handleSelectSourceChoice = (
    choice: 'Use sample transcript' | 'Paste transcript'
  ) => {
    setSourceChoice(choice);
    setWisprPrepared(false);
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

          {/* Wispr Flow Desktop Dictation */}
          <section
            aria-labelledby="wispr-flow-heading"
            className="rounded-2xl border border-teal-200 bg-gradient-to-br from-teal-50 via-white to-slate-50 p-4 sm:p-5 space-y-4"
          >
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-teal-100 p-2.5 text-teal-800 shrink-0">
                <Mic className="w-5 h-5" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 id="wispr-flow-heading" className="text-sm font-bold text-slate-900">
                    Voice input with Wispr Flow
                  </h2>
                  <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[9px] font-bold tracking-wide text-teal-800">
                    DESKTOP DICTATION
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  Dictate straight into this transcript field. Wispr Flow runs on your computer
                  and types the finished dictation wherever your cursor is focused. LOOPFRAME
                  does not record audio or control Wispr Flow.
                </p>
                <a
                  href="https://docs.wisprflow.ai/articles/6409258247-flow-bubble-requirements"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-teal-800 hover:text-teal-950"
                >
                  First-time Wispr Flow setup
                  <ExternalLink className="w-3 h-3" aria-hidden="true" />
                </a>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="rounded-xl border border-slate-200 bg-white/90 p-3">
                <p className="text-[10px] font-bold tracking-wider text-teal-800">01 · FOCUS</p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
                  Select the transcript text box before starting dictation.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white/90 p-3">
                <p className="text-[10px] font-bold tracking-wider text-teal-800">02 · SPEAK</p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
                  Hold the Wispr Flow shortcut, speak, then release. Or use hands-free mode.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white/90 p-3">
                <p className="text-[10px] font-bold tracking-wider text-teal-800">03 · REVIEW</p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
                  Check the inserted text and fix any timestamp-format errors before creating.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-teal-100 bg-white/90 p-3">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-800">
                  <Keyboard className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                  <span>Default desktop shortcuts</span>
                  <div className="ml-1 inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                    <button
                      type="button"
                      onClick={() => setWisprPlatform('windows')}
                      aria-pressed={wisprPlatform === 'windows'}
                      className={`rounded-md px-2 py-1 text-[10px] font-semibold transition-colors ${wisprPlatform === 'windows' ? 'bg-teal-700 text-white' : 'text-slate-600 hover:bg-white'}`}
                    >
                      Windows
                    </button>
                    <button
                      type="button"
                      onClick={() => setWisprPlatform('mac')}
                      aria-pressed={wisprPlatform === 'mac'}
                      className={`rounded-md px-2 py-1 text-[10px] font-semibold transition-colors ${wisprPlatform === 'mac' ? 'bg-teal-700 text-white' : 'text-slate-600 hover:bg-white'}`}
                    >
                      macOS
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-slate-600">
                  <span>
                    Push-to-talk:{' '}
                    <kbd className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 font-mono font-semibold text-slate-800">
                      {wisprPlatform === 'windows' ? 'Ctrl + Win' : 'Fn'}
                    </kbd>
                    {wisprPlatform === 'mac' && <span className="ml-1">(or Ctrl + Option without Fn)</span>}
                  </span>
                  <span>
                    Hands-free:{' '}
                    <kbd className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 font-mono font-semibold text-slate-800">
                      {wisprPlatform === 'windows' ? 'Ctrl + Win + Space' : 'Fn + Space'}
                    </kbd>
                    {wisprPlatform === 'mac' && <span className="ml-1">(or Ctrl + Option + Space)</span>}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500">
                  Shortcuts can be changed in Wispr Flow → Settings → General → Shortcuts.
                </p>
              </div>

              <button
                type="button"
                onClick={handlePrepareWisprFlow}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
              >
                <Mic className="h-4 w-4" aria-hidden="true" />
                Select text & focus field
              </button>
            </div>

            <p className="text-[10px] leading-relaxed text-slate-600">
              <strong>LOOPFRAME timestamp requirement:</strong> Wispr Flow inserts words, not source
              timecodes. Dictate each segment with its timestamp and speaker, for example
              “open bracket 00:00:05 close bracket Host: Welcome back”, then review the punctuation.
              Plain un-timestamped dictation will fail the transcript validator.
            </p>

            {wisprPrepared && (
              <p role="status" className="rounded-lg bg-teal-100/80 px-3 py-2 text-[11px] font-medium text-teal-900">
                Transcript field focused and current text selected. Start Wispr Flow dictation now;
                the inserted text will replace the selection. Click inside the field to choose a
                different insertion point.
              </p>
            )}
          </section>

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
              ref={transcriptInputRef}
              id="transcript-textarea"
              rows={10}
              value={rawTranscript}
              onChange={(e) => {
                setRawTranscript(e.target.value);
                setSourceChoice('Paste transcript');
                setWisprPrepared(false);
              }}
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
