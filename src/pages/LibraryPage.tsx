import React, { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  BookMarked,
  Copy,
  Download,
  Search,
} from 'lucide-react';
import { useLoopframe } from '../context/LoopframeContext';
import { DestinationPlatform, LibraryItem } from '../types/loopframe';

export const LibraryPage: React.FC = () => {
  const { state, navigate, addToast } = useLoopframe();

  // Approved content only by default per Section 3 Page 6
  const [statusFilter, setStatusFilter] = useState<
    'Approved' | 'Needs review' | 'Rejected' | 'All'
  >('Approved');
  const [platformFilter, setPlatformFilter] = useState<
    'all' | DestinationPlatform
  >('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Build combined list from libraryItems and project candidates when inspecting non-approved statuses
  const allItems = useMemo<LibraryItem[]>(() => {
    const map = new Map<string, LibraryItem>();
    state.libraryItems.forEach((item) => map.set(item.candidate_id, item));

    state.projects.forEach((proj) => {
      proj.candidates.forEach((cand) => {
        if (!map.has(cand.candidate_id)) {
          map.set(cand.candidate_id, {
            item_id: `lib-cand-${cand.candidate_id}`,
            project_id: proj.project_id,
            project_name: proj.name,
            candidate_id: cand.candidate_id,
            title: cand.title,
            source_excerpt: cand.source_excerpt,
            start_timecode: new Date(cand.start_ms)
              .toISOString()
              .slice(11, 19),
            end_timecode: new Date(cand.end_ms).toISOString().slice(11, 19),
            duration_sec: cand.duration_sec,
            status:
              cand.review_status === 'Approved'
                ? 'Approved'
                : cand.review_status === 'Rejected'
                ? 'Rejected'
                : 'Needs review',
            platform_copy: cand.platform_copy,
            approved_at: proj.updated_at,
            is_demo_data: proj.is_demo_data,
          });
        }
      });
    });

    return Array.from(map.values());
  }, [state.libraryItems, state.projects]);

  const filteredItems = useMemo(() => {
    return allItems.filter((item) => {
      if (statusFilter !== 'All' && item.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesProject = item.project_name.toLowerCase().includes(q);
        const matchesExcerpt = item.source_excerpt.toLowerCase().includes(q);
        if (!matchesTitle && !matchesProject && !matchesExcerpt) return false;
      }
      return true;
    });
  }, [allItems, statusFilter, searchQuery]);

  const handleCopyExport = (
    item: LibraryItem,
    part: 'caption' | 'excerpt' | 'timecodes' | 'full'
  ) => {
    const targetPlatform: DestinationPlatform =
      platformFilter === 'youtube_shorts'
        ? 'youtube_shorts'
        : 'instagram_reels';
    const copy = item.platform_copy[targetPlatform];

    let text = '';
    if (part === 'caption') {
      text = `${copy.hook}\n\n${copy.caption}${
        copy.cta ? `\n\n${copy.cta}` : ''
      }`;
    } else if (part === 'excerpt') {
      text = `"${item.source_excerpt}" [${item.start_timecode}–${item.end_timecode}]`;
    } else if (part === 'timecodes') {
      text = `${item.title} | Start: ${item.start_timecode} | End: ${item.end_timecode} | Duration: ${item.duration_sec}s`;
    } else {
      text = [
        `Project: ${item.project_name}`,
        `Clip: ${item.title}`,
        `Timecodes: ${item.start_timecode} – ${item.end_timecode} (${item.duration_sec}s)`,
        `Instagram Reels Hook: ${item.platform_copy.instagram_reels.hook}`,
        `Instagram Reels Caption: ${item.platform_copy.instagram_reels.caption}`,
        `YouTube Shorts Hook: ${item.platform_copy.youtube_shorts.hook}`,
        `YouTube Shorts Caption: ${item.platform_copy.youtube_shorts.caption}`,
        `Verbatim Source Excerpt: "${item.source_excerpt}"`,
      ].join('\n');
    }

    navigator.clipboard?.writeText(text).catch(() => {});
    addToast({
      title: 'Export ready',
      description: `Copied ${part} for "${item.title}" to clipboard.`,
      variant: 'success',
    });
  };

  const handleDownloadItemTxt = (item: LibraryItem) => {
    const content = [
      `LOOPFRAME AI V4 — APPROVED CONTENT EXPORT`,
      `Project: ${item.project_name}`,
      `Title: ${item.title}`,
      `Status: ${item.status}`,
      `Timecodes: ${item.start_timecode} – ${item.end_timecode} (${item.duration_sec}s)`,
      ``,
      `[INSTAGRAM REELS]`,
      `Hook: ${item.platform_copy.instagram_reels.hook}`,
      `Caption: ${item.platform_copy.instagram_reels.caption}`,
      ``,
      `[YOUTUBE SHORTS]`,
      `Hook: ${item.platform_copy.youtube_shorts.hook}`,
      `Caption: ${item.platform_copy.youtube_shorts.caption}`,
      ``,
      `[VERBATIM SOURCE EXCERPT]`,
      `"${item.source_excerpt}"`,
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${item.candidate_id}-export.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    addToast({
      title: 'Export ready (.txt file downloaded)',
      description: `Saved ${item.candidate_id}-export.txt`,
      variant: 'success',
    });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200/90 pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
            <BookMarked className="w-3.5 h-3.5 text-[#0D9488]" />
            <span>LIBRARY · APPROVED CLIPS & COPY EXPORT</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Library
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 max-w-2xl">
            Approved clip candidates with verified source excerpts, timecodes,
            and platform-ready copy for Instagram Reels and YouTube Shorts.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            navigate(
              `/projects/${state.projects[0]?.project_id || 'proj-sample-01'}`
            )
          }
          className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer shrink-0"
        >
          Open Project Studio
        </button>
      </div>

      {/* Search & Functional Filters */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter (Approved by default) */}
          <div
            role="group"
            aria-label="Filter library items by status"
            className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl"
          >
            {(['Approved', 'Needs review', 'Rejected', 'All'] as const).map(
              (st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    statusFilter === st
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {st}
                </button>
              )
            )}
          </div>

          {/* Platform Preview Filter */}
          <div
            role="group"
            aria-label="Filter copy preview by destination platform"
            className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl"
          >
            {(
              [
                ['all', 'Both Platforms'],
                ['instagram_reels', 'Instagram Reels'],
                ['youtube_shorts', 'YouTube Shorts'],
              ] as const
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setPlatformFilter(val)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  platformFilter === val
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            aria-label="Search library by project or title"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by project or title..."
            className="w-full md:w-64 pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
          />
        </div>
      </div>

      {/* Library Grid / List */}
      {filteredItems.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-3">
          <p className="text-sm font-bold text-slate-900">
            No items match the current Library filter ({statusFilter})
          </p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Approve a candidate in Project Studio or switch the status filter to
            inspect candidates needing review.
          </p>
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => setStatusFilter('All')}
              className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Show All Statuses
            </button>
            <button
              type="button"
              onClick={() => navigate('/projects/proj-sample-01')}
              className="px-4 py-2 rounded-xl bg-[#0D9488] text-white text-xs font-semibold"
            >
              Review Sample Candidates
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredItems.map((item) => (
            <div
              key={item.item_id}
              className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 space-y-4"
            >
              {/* Top Row: Metadata + Open Source Project */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-100 pb-3.5">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-500 tabular-nums">
                    <span
                      className={`font-bold ${
                        item.status === 'Approved'
                          ? 'text-emerald-700'
                          : item.status === 'Rejected'
                          ? 'text-red-700'
                          : 'text-amber-700'
                      }`}
                    >
                      {item.status}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      Timecodes: {item.start_timecode} – {item.end_timecode} (
                      {item.duration_sec}s)
                    </span>
                    {item.is_demo_data && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>DEMO DATA</span>
                      </>
                    )}
                  </div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">
                    {item.title}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Source project: {item.project_name}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => navigate(`/projects/${item.project_id}`)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-800 flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <span>Open Source Project</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Side-by-Side Source Excerpt and Platform Copy */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                  <span className="font-mono text-[11px] text-slate-500">
                    VERBATIM SOURCE EXCERPT [{item.start_timecode}–
                    {item.end_timecode}]
                  </span>
                  <p className="text-slate-800 leading-relaxed italic">
                    &ldquo;{item.source_excerpt}&rdquo;
                  </p>
                </div>

                {(platformFilter === 'all' ||
                  platformFilter === 'instagram_reels') && (
                  <div className="p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                    <span className="font-mono text-[11px] text-slate-500">
                      INSTAGRAM REELS COPY
                    </span>
                    <p className="font-bold text-slate-900">
                      {item.platform_copy.instagram_reels.hook}
                    </p>
                    <p className="text-slate-700 leading-relaxed">
                      {item.platform_copy.instagram_reels.caption}
                    </p>
                  </div>
                )}

                {(platformFilter === 'all' ||
                  platformFilter === 'youtube_shorts') && (
                  <div className="p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                    <span className="font-mono text-[11px] text-slate-500">
                      YOUTUBE SHORTS COPY
                    </span>
                    <p className="font-bold text-slate-900">
                      {item.platform_copy.youtube_shorts.hook}
                    </p>
                    <p className="text-slate-700 leading-relaxed">
                      {item.platform_copy.youtube_shorts.caption}
                    </p>
                  </div>
                )}
              </div>

              {/* Functional Export Actions */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyExport(item, 'caption')}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Caption Text</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCopyExport(item, 'excerpt')}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Source Excerpt</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCopyExport(item, 'timecodes')}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Export Timecodes</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleDownloadItemTxt(item)}
                  className="px-3.5 py-1.5 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Complete Package (.txt)</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
