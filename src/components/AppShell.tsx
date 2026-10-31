import React, { useState } from 'react';
import {
  BookMarked,
  BrainCircuit,
  ChevronRight,
  FolderKanban,
  HelpCircle,
  Menu,
  Plus,
  RotateCcw,
  Settings,
  User,
  X,
  AlertTriangle,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { useLoopframe } from '../context/LoopframeContext';

export const AppShell: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const {
    state,
    currentPath,
    navigate,
    saveError,
    retrySave,
    toasts,
    dismissToast,
    resetDemoData,
  } = useLoopframe();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [aboutModalOpen, setAboutModalOpen] = useState(false);

  const activeConfirmedRulesCount = state.preferences.filter(
    (r) => r.status === 'active' && r.confirmed_by_user
  ).length;

  const approvedLibraryCount = state.libraryItems.filter(
    (i) => i.status === 'Approved'
  ).length;

  const hasSeededData = state.projects.some((p) => p.is_demo_data);

  // Determine current page context & breadcrumb
  const getBreadcrumbAndAction = () => {
    if (currentPath.startsWith('/projects/new')) {
      return {
        breadcrumb: 'Projects / New Transcript Project',
        primaryLabel: 'Open Sample Project',
        onPrimaryClick: () => navigate('/projects/proj-sample-01'),
      };
    }
    if (currentPath.startsWith('/projects/')) {
      const projId = currentPath.replace('/projects/', '').split('/')[0];
      const project = state.projects.find((p) => p.project_id === projId);
      return {
        breadcrumb: `Projects / ${project ? project.name : 'Project Studio'}`,
        primaryLabel: 'New Project',
        onPrimaryClick: () => navigate('/projects/new'),
      };
    }
    if (currentPath.startsWith('/memory')) {
      return {
        breadcrumb: 'Memory / Preference Ledger & Rule Evaluation',
        primaryLabel: 'Open Sample Studio',
        onPrimaryClick: () => navigate('/projects/proj-sample-01'),
      };
    }
    if (currentPath.startsWith('/library')) {
      return {
        breadcrumb: 'Library / Approved Clips & Copy Export',
        primaryLabel: 'Review Candidates',
        onPrimaryClick: () =>
          navigate(
            `/projects/${state.projects[0]?.project_id || 'proj-sample-01'}`
          ),
      };
    }
    if (currentPath.startsWith('/settings')) {
      return {
        breadcrumb: 'Profile / Settings & Persistence',
        primaryLabel: 'Back to Projects',
        onPrimaryClick: () => navigate('/projects'),
      };
    }
    if (currentPath.startsWith('/welcome')) {
      return {
        breadcrumb: 'Welcome / Creator Onboarding',
        primaryLabel: 'Open Sample Project',
        onPrimaryClick: () => navigate('/projects/proj-sample-01'),
      };
    }
    return {
      breadcrumb: 'Projects / Workspace Overview',
      primaryLabel: 'New Project',
      onPrimaryClick: () => navigate('/projects/new'),
    };
  };

  const { breadcrumb, primaryLabel, onPrimaryClick } = getBreadcrumbAndAction();

  const isNavActive = (prefix: string) => {
    if (prefix === '/projects') {
      return (
        currentPath === '/' ||
        currentPath === '/projects' ||
        currentPath.startsWith('/projects/')
      );
    }
    return currentPath.startsWith(prefix);
  };

  const handleNav = (path: string) => {
    navigate(path);
    setMobileMenuOpen(false);
    setProfileMenuOpen(false);
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#F8F7F4] text-[#0F172A]">
      {/* Desktop Persistent Sidebar (252px wide) */}
      <aside
        aria-label="Primary Sidebar Navigation"
        className="hidden lg:flex lg:w-[252px] lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r border-slate-200/90 z-30 select-none"
      >
        <div className="h-16 px-5 flex items-center justify-between border-b border-slate-200/80">
          <button
            type="button"
            onClick={() => handleNav('/projects')}
            className="flex items-center gap-2.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] rounded-md"
          >
            <div className="w-7 h-7 rounded-lg bg-[#0F172A] text-white flex items-center justify-center font-mono text-xs font-semibold tracking-tighter">
              LF
            </div>
            <span className="text-base font-bold tracking-tight text-[#0F172A] whitespace-nowrap">
              LOOPFRAME
            </span>
          </button>
        </div>

        <nav
          aria-label="Main sections"
          className="flex-1 px-3 py-5 space-y-1.5"
        >
          <button
            type="button"
            onClick={() => handleNav('/projects')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              isNavActive('/projects')
                ? 'bg-[#0F172A] text-white'
                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <span className="flex items-center gap-3 whitespace-nowrap">
              <FolderKanban className="w-4 h-4 shrink-0" />
              <span>Projects</span>
            </span>
            <span
              className={`font-mono text-xs tabular-nums ${
                isNavActive('/projects') ? 'text-slate-300' : 'text-slate-500'
              }`}
            >
              {state.projects.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleNav('/memory')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              isNavActive('/memory')
                ? 'bg-[#0F172A] text-white'
                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <span className="flex items-center gap-3 whitespace-nowrap">
              <BrainCircuit className="w-4 h-4 shrink-0" />
              <span>Memory</span>
            </span>
            <span
              className={`font-mono text-xs tabular-nums ${
                isNavActive('/memory') ? 'text-slate-300' : 'text-slate-500'
              }`}
            >
              {activeConfirmedRulesCount} active
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleNav('/library')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              isNavActive('/library')
                ? 'bg-[#0F172A] text-white'
                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <span className="flex items-center gap-3 whitespace-nowrap">
              <BookMarked className="w-4 h-4 shrink-0" />
              <span>Library</span>
            </span>
            <span
              className={`font-mono text-xs tabular-nums ${
                isNavActive('/library') ? 'text-slate-300' : 'text-slate-500'
              }`}
            >
              {approvedLibraryCount}
            </span>
          </button>
        </nav>

        {/* Quick Context Footer in Sidebar */}
        <div className="p-4 border-t border-slate-200/80 space-y-3 bg-slate-50/60">
          <div className="text-xs text-slate-600 leading-relaxed">
            <p className="font-semibold text-slate-900 mb-0.5">
              Creator Edit Intelligence
            </p>
            <p className="text-[11px] text-slate-500">
              Explicit preference ledger + deterministic rule tests.
            </p>
          </div>

          {hasSeededData && (
            <div className="pt-2 border-t border-slate-200/70 flex items-center justify-between text-[11px] font-mono text-slate-600">
              <span>DEMO DATA ACTIVE</span>
              <button
                type="button"
                onClick={() => setResetModalOpen(true)}
                className="text-[#0D9488] hover:underline font-sans font-medium"
              >
                Reset
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex-1 lg:pl-[252px] flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-20 h-16 bg-white/95 backdrop-blur border-b border-slate-200/90 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation menu"
              className="lg:hidden p-2 rounded-lg text-slate-700 hover:bg-slate-100"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
            <div className="flex items-center gap-2 text-sm text-slate-600 truncate">
              <span className="font-medium text-slate-900 truncate">
                {breadcrumb}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onPrimaryClick}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-[#0D9488] hover:bg-[#0F766E] transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{primaryLabel}</span>
            </button>

            {/* Profile Menu Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setProfileMenuOpen((o) => !o)}
                aria-expanded={profileMenuOpen}
                aria-label="Open Creator Profile & Settings menu"
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-800 transition-colors cursor-pointer"
              >
                <User className="w-3.5 h-3.5 text-slate-600" />
                <span className="hidden sm:inline max-w-[130px] truncate">
                  {state.profile.creatorName || 'Creator Profile'}
                </span>
              </button>

              {profileMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-60 rounded-xl bg-white border border-slate-200 shadow-lg py-1.5 z-50 text-xs text-slate-700"
                >
                  <div className="px-3.5 py-2 border-b border-slate-100">
                    <p className="font-semibold text-slate-900 truncate">
                      {state.profile.creatorName || 'Creator Studio'}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                      Single-User Local Demo Store
                    </p>
                  </div>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => handleNav('/welcome')}
                    className="w-full px-3.5 py-2 text-left hover:bg-slate-50 flex items-center gap-2.5"
                  >
                    <User className="w-3.5 h-3.5 text-slate-500" />
                    <span>Creator Onboarding / Welcome</span>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => handleNav('/settings')}
                    className="w-full px-3.5 py-2 text-left hover:bg-slate-50 flex items-center gap-2.5"
                  >
                    <Settings className="w-3.5 h-3.5 text-slate-500" />
                    <span>Settings & Profile</span>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      setResetModalOpen(true);
                    }}
                    className="w-full px-3.5 py-2 text-left hover:bg-slate-50 flex items-center gap-2.5 text-amber-700"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Demo Mode / Reset Sample Data</span>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      setAboutModalOpen(true);
                    }}
                    className="w-full px-3.5 py-2 text-left hover:bg-slate-50 flex items-center gap-2.5 border-t border-slate-100"
                  >
                    <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
                    <span>Help / About LOOPFRAME V4</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-white border-b border-slate-200 px-4 py-3 space-y-1.5 z-20">
            <button
              type="button"
              onClick={() => handleNav('/projects')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium ${
                isNavActive('/projects')
                  ? 'bg-[#0F172A] text-white'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <FolderKanban className="w-4 h-4" />
                <span>Projects</span>
              </span>
              <span className="font-mono text-xs">{state.projects.length}</span>
            </button>
            <button
              type="button"
              onClick={() => handleNav('/memory')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium ${
                isNavActive('/memory')
                  ? 'bg-[#0F172A] text-white'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <BrainCircuit className="w-4 h-4" />
                <span>Memory</span>
              </span>
              <span className="font-mono text-xs">
                {activeConfirmedRulesCount} active
              </span>
            </button>
            <button
              type="button"
              onClick={() => handleNav('/library')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium ${
                isNavActive('/library')
                  ? 'bg-[#0F172A] text-white'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <BookMarked className="w-4 h-4" />
                <span>Library</span>
              </span>
              <span className="font-mono text-xs">{approvedLibraryCount}</span>
            </button>
            <button
              type="button"
              onClick={() => handleNav('/settings')}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              <span className="flex items-center gap-2.5">
                <Settings className="w-4 h-4" />
                <span>Settings & Profile</span>
              </span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        )}

        {/* Save Error Banner */}
        {saveError && (
          <div
            role="alert"
            className="bg-red-50 border-b border-red-200 px-6 py-2.5 flex items-center justify-between text-xs text-red-800"
          >
            <span>Persistence error: {saveError}</span>
            <button
              type="button"
              onClick={retrySave}
              className="px-3 py-1 rounded-md bg-red-700 text-white font-medium hover:bg-red-800"
            >
              Retry Save
            </button>
          </div>
        )}

        {/* Main Workspace Content */}
        <main className="flex-1 min-w-0">{children}</main>
      </div>

      {/* Accessible Live Region for Toasts */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-xl border p-3.5 shadow-md bg-white flex items-start justify-between gap-3 transition-all ${
              t.variant === 'error'
                ? 'border-red-300'
                : t.variant === 'warning'
                ? 'border-amber-300'
                : 'border-slate-200'
            }`}
          >
            <div className="flex items-start gap-2.5 min-w-0">
              {t.variant === 'success' && (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              )}
              {t.variant === 'error' && (
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              )}
              {t.variant === 'warning' && (
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              )}
              {t.variant === 'info' && (
                <Info className="w-4 h-4 text-[#0D9488] shrink-0 mt-0.5" />
              )}
              <div className="text-xs min-w-0">
                <p className="font-semibold text-slate-900">{t.title}</p>
                {t.description && (
                  <p className="text-slate-600 mt-0.5 leading-relaxed">
                    {t.description}
                  </p>
                )}
                {t.undoActionLabel && t.onUndo && (
                  <button
                    type="button"
                    onClick={() => {
                      t.onUndo?.();
                      dismissToast(t.id);
                    }}
                    className="mt-2 px-2.5 py-1 rounded-md bg-slate-900 text-white font-medium text-[11px] hover:bg-slate-800"
                  >
                    {t.undoActionLabel}
                  </button>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              aria-label="Dismiss notification"
              className="text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Reset Demo Confirmation Modal */}
      {resetModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-modal-title"
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-start justify-between">
              <h2
                id="reset-modal-title"
                className="text-base font-bold text-slate-900"
              >
                Reset Sample Data & Demo Scenario?
              </h2>
              <button
                type="button"
                onClick={() => setResetModalOpen(false)}
                aria-label="Close reset dialog"
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              This will restore the original seeded podcast project (Dr. Elena
              Rostova), its 3 initial candidates (including the exaggerated hook
              and missing qualification examples), the unconfirmed rule
              proposal, and the initial preference ledger. Any custom projects
              or edits in the local demo store will be replaced.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setResetModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  resetDemoData();
                  setResetModalOpen(false);
                }}
                className="px-4 py-2 rounded-xl bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700"
              >
                Confirm Reset Demo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Help / About Modal */}
      {aboutModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="about-modal-title"
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h2
                  id="about-modal-title"
                  className="text-base font-bold text-slate-900"
                >
                  About LOOPFRAME AI (V4)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Clip review that remembers your corrections and shows its
                  receipts.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAboutModalOpen(false)}
                aria-label="Close about dialog"
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-2.5 leading-relaxed">
              <p>
                <strong>Core Mechanism:</strong> LOOPFRAME does not silently
                retrain or fine-tune a model. It maps creator corrections to a
                closed rule taxonomy, waits for explicit user confirmation,
                stores rules in a visible Preference Ledger, injects active
                rules into generation context, and runs deterministic code tests
                against new hooks and captions.
              </p>
              <p>
                <strong>Source Grounding:</strong> Source excerpts and timecodes
                are assembled strictly by deterministic code from immutable
                transcript segments—never invented or rewritten by an LLM.
              </p>
              <p>
                <strong>Honesty & Scope:</strong> Deterministic checks are
                separated from AI advisory checks. P0 is transcript-first and
                supports Instagram Reels and YouTube Shorts copy & timecode
                export. Video rendering, social auto-publishing, and virality
                scores are intentionally excluded.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setAboutModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
