import React, { useState } from 'react';
import {
  CheckCircle2,
  Database,
  Download,
  RotateCcw,
  ShieldAlert,
  User,
} from 'lucide-react';
import { useLoopframe } from '../context/LoopframeContext';

export const SettingsPage: React.FC = () => {
  const {
    state,
    liveAiConfigured,
    updateProfile,
    resetDemoData,
    exportUserDataJson,
    addToast,
  } = useLoopframe();

  const [creatorName, setCreatorName] = useState(state.profile.creatorName);
  const [contentCategory, setContentCategory] = useState(
    state.profile.contentCategory
  );
  const [preferredTone, setPreferredTone] = useState(
    state.profile.preferredTone
  );
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile({
      creatorName: creatorName.trim(),
      contentCategory: contentCategory.trim(),
      preferredTone: preferredTone.trim(),
      onboardingCompleted: true,
    });
  };

  const handleDownloadJsonBackup = () => {
    const json = exportUserDataJson();
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `loopframe-v4-workspace-export.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    addToast({
      title: 'Export ready (.json downloaded)',
      description:
        'Exported projects, transcript segments, preference ledger, and library items.',
      variant: 'success',
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="border-b border-slate-200/90 pb-5 space-y-1">
        <span className="text-xs font-mono text-slate-500">
          PROFILE · DEMO MODE · DATA PERSISTENCE
        </span>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
          Settings & Creator Profile
        </h1>
        <p className="text-xs sm:text-sm text-slate-600">
          Manage your three creator onboarding fields, inspect runtime
          persistence, export your workspace JSON, or reset the seeded demo
          scenario.
        </p>
      </div>

      {/* 1. Edit the Three Onboarding Fields */}
      <form
        onSubmit={handleSaveProfile}
        className="bg-white rounded-2xl border border-slate-200/90 p-6 space-y-5"
      >
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-[#0D9488]" />
          <h2 className="text-base font-bold text-slate-900">
            Creator Profile (3 Onboarding Fields)
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label
              htmlFor="settings-creator-name"
              className="block text-xs font-semibold text-slate-800"
            >
              Creator / Channel Name
            </label>
            <input
              id="settings-creator-name"
              type="text"
              value={creatorName}
              onChange={(e) => setCreatorName(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs text-slate-900"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="settings-category"
              className="block text-xs font-semibold text-slate-800"
            >
              Content Category
            </label>
            <input
              id="settings-category"
              type="text"
              value={contentCategory}
              onChange={(e) => setContentCategory(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs text-slate-900"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="settings-tone"
              className="block text-xs font-semibold text-slate-800"
            >
              Preferred Editorial Tone
            </label>
            <input
              id="settings-tone"
              type="text"
              value={preferredTone}
              onChange={(e) => setPreferredTone(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs text-slate-900"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Save Profile Settings</span>
          </button>
        </div>
      </form>

      {/* 2. Demo Mode Indicator & Persistence / Privacy Explanation */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-slate-700" />
            <h2 className="text-base font-bold text-slate-900">
              Persistence Architecture & Demo Mode Status
            </h2>
          </div>
          <span className="font-mono text-xs font-semibold text-[#0D9488]">
            SINGLE-USER LOCAL DEMO STORE
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-600 leading-relaxed">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
            <p className="font-bold text-slate-900">
              Actual Persistence Implementation
            </p>
            <p>
              This prototype isolates persistence behind a local browser storage
              adapter (<code className="font-mono">loopframe_v4_store_v1</code>
              ). Your projects, transcript segments, candidates, feedback
              events, confirmed preferences, library items, and audit events
              persist across browser refreshes on this device.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
            <p className="font-bold text-slate-900">
              Security & AI Runtime Transparency
            </p>
            <p>
              Server-side Gemini API calls run through Express endpoints (
              <code className="font-mono">/api/*</code>) so API keys are never
              exposed in browser bundles. Current server AI status:{' '}
              <strong className="font-mono text-slate-900">
                {liveAiConfigured
                  ? 'LIVE AI CONFIGURED (gemini-3.8-flash)'
                  : 'DEMO FALLBACK ACTIVE (Deterministic Server Engine)'}
              </strong>
              .
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80 flex items-start gap-2.5 text-xs text-amber-900">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p>
            <strong>Honesty & Privacy Disclosure:</strong> This build is a
            single-user prototype store. It does not implement multi-user cloud
            authentication, cross-device cloud sync, or server-side database
            encryption guarantees.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={handleDownloadJsonBackup}
            className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export All Workspace Data (.json)</span>
          </button>

          {!confirmResetOpen ? (
            <button
              type="button"
              onClick={() => setConfirmResetOpen(true)}
              className="px-4 py-2 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Sample Data</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-amber-900">
                Confirm reset to initial DEMO DATA?
              </span>
              <button
                type="button"
                onClick={() => {
                  resetDemoData();
                  setConfirmResetOpen(false);
                }}
                className="px-3 py-1.5 rounded-xl bg-amber-600 text-white text-xs font-semibold cursor-pointer"
              >
                Yes, Reset Now
              </button>
              <button
                type="button"
                onClick={() => setConfirmResetOpen(false)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
