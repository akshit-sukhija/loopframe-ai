import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, FileText, Sparkles } from 'lucide-react';
import { useLoopframe } from '../context/LoopframeContext';

export const WelcomePage: React.FC = () => {
  const { state, updateProfile, navigate } = useLoopframe();

  const [creatorName, setCreatorName] = useState(state.profile.creatorName);
  const [contentCategory, setContentCategory] = useState(
    state.profile.contentCategory
  );
  const [preferredTone, setPreferredTone] = useState(
    state.profile.preferredTone
  );

  const handleSaveAndOpenSample = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile({
      creatorName: creatorName.trim() || state.profile.creatorName,
      contentCategory: contentCategory.trim() || state.profile.contentCategory,
      preferredTone: preferredTone.trim() || state.profile.preferredTone,
      onboardingCompleted: true,
    });
    navigate('/projects/proj-sample-01');
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-10">
      {/* Editorial Hero & Promise */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-10 space-y-6">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-mono">
          <span>LOOPFRAME AI · V4</span>
          <span aria-hidden="true">·</span>
          <span>CREATOR INTELLIGENCE STUDIO</span>
          <span aria-hidden="true">·</span>
          <span>DEMO DATA READY</span>
        </div>

        <div className="space-y-3 max-w-3xl">
          <h1
            className="text-2xl sm:text-4xl font-bold tracking-tight text-slate-900"
            style={{ textWrap: 'balance' }}
          >
            Clip review that remembers your corrections and shows its receipts.
          </h1>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
            Spend less time repeating the same corrections. See what the AI
            selected, where it came from in your timestamped transcript, which
            confirmed preference it followed, and whether the result passed the
            deterministic rule test.
          </p>
        </div>

        {/* Immediate Primary & Secondary CTAs — Never blocked by onboarding */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate('/projects/proj-sample-01')}
            className="px-5 py-2.5 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white text-sm font-semibold transition-colors flex items-center gap-2 cursor-pointer"
          >
            <span>Open sample project</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => navigate('/projects/new')}
            className="px-5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-900 text-sm font-semibold transition-colors flex items-center gap-2 cursor-pointer"
          >
            <FileText className="w-4 h-4 text-slate-600" />
            <span>Create a project</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/projects')}
            className="px-4 py-2.5 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 underline underline-offset-4 cursor-pointer"
          >
            Skip to Projects Workspace
          </button>
        </div>

        {/* 4-Step Signature Mechanism Summary */}
        <div className="pt-6 border-t border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="space-y-1">
            <p className="font-mono text-slate-500">01. SOURCE EVIDENCE</p>
            <p className="font-semibold text-slate-900">
              Verbatim Transcript Excerpts
            </p>
            <p className="text-slate-600 leading-relaxed">
              Quotes and timecodes are assembled in code from segment IDs—never
              invented by a model.
            </p>
          </div>
          <div className="space-y-1">
            <p className="font-mono text-slate-500">02. CONTEXT INTEGRITY</p>
            <p className="font-semibold text-slate-900">
              7 Deterministic + 4 Advisory Checks
            </p>
            <p className="text-slate-600 leading-relaxed">
              Inspect surrounding segments for missing qualifications like
              “however” or “unless”.
            </p>
          </div>
          <div className="space-y-1">
            <p className="font-mono text-slate-500">03. PREFERENCE LEDGER</p>
            <p className="font-semibold text-slate-900">
              User-Confirmed Editorial Rules
            </p>
            <p className="text-slate-600 leading-relaxed">
              Map natural-language corrections to a closed rule taxonomy and
              confirm before saving.
            </p>
          </div>
          <div className="space-y-1">
            <p className="font-mono text-slate-500">04. RULE VERIFICATION</p>
            <p className="font-semibold text-slate-900">
              Post-Generation Rule Tests
            </p>
            <p className="text-slate-600 leading-relaxed">
              Verify regenerated hooks against active rules with honest
              Pass/Fail/Advisory receipts.
            </p>
          </div>
        </div>
      </div>

      {/* Optional Lightweight Onboarding (Strictly Max 3 Fields) */}
      <form
        onSubmit={handleSaveAndOpenSample}
        className="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-8 space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Optional Creator Context (3 Fields Max)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Used as baseline editorial context during candidate generation.
              You can skip this or edit it any time in Settings.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500">
            OPTIONAL · NEVER BLOCKS SAMPLE
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="space-y-1.5">
            <label
              htmlFor="onboarding-creator-name"
              className="block text-xs font-semibold text-slate-800"
            >
              1. Creator or Channel Name
            </label>
            <input
              id="onboarding-creator-name"
              type="text"
              value={creatorName}
              onChange={(e) => setCreatorName(e.target.value)}
              placeholder="e.g., Deep Work Architecture"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="onboarding-category"
              className="block text-xs font-semibold text-slate-800"
            >
              2. Content Category
            </label>
            <input
              id="onboarding-category"
              type="text"
              value={contentCategory}
              onChange={(e) => setContentCategory(e.target.value)}
              placeholder="e.g., Cognitive Science & Technical Education"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="onboarding-tone"
              className="block text-xs font-semibold text-slate-800"
            >
              3. Preferred Editorial Tone
            </label>
            <input
              id="onboarding-tone"
              type="text"
              value={preferredTone}
              onChange={(e) => setPreferredTone(e.target.value)}
              placeholder="e.g., Measured, Evidence-Grounded, Conversational"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          <p className="text-xs text-slate-500 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-violet-600" />
            <span>
              Primary user segment hypothesis: educators, founder-led podcast
              hosts, and subject-matter experts.
            </span>
          </p>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/projects')}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Skip for now
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Save Profile & Open Sample Project</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
