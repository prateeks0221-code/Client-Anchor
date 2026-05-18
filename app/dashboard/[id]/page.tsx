"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useRef } from "react";
import {
  ArrowLeft,
  Download,
  RefreshCw,
  SlidersHorizontal,
  X,
  Anchor,
  Search,
  AlertCircle,
  LayoutGrid,
  FileSpreadsheet,
  FileText,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ResultCard } from "@/components/ResultCard";
import { DashboardData } from "@/types";

// ── Source label map ─────────────────────────────────────────────────────────

const SOURCE_LABELS: Record<string, string> = {
  google_places: "Google Places",
  serpapi: "SerpAPI",
  adzuna: "Adzuna",
  hunter: "Hunter.io",
};

// ── Skeleton card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-slate-900/60 border border-slate-800/60 rounded-xl p-5 animate-pulse flex flex-col gap-3 h-[220px]">
      <div className="flex justify-between gap-3">
        <div className="h-4 bg-slate-800 rounded w-3/4" />
        <div className="h-5 w-12 bg-slate-800 rounded-full" />
      </div>
      <div className="flex gap-1.5">
        <div className="h-4 w-16 bg-slate-800/60 rounded-full" />
        <div className="h-4 w-20 bg-slate-800/40 rounded-full" />
      </div>
      <div className="h-3 bg-slate-800/60 rounded w-full" />
      <div className="h-3 bg-slate-800/60 rounded w-5/6" />
      <div className="h-3 bg-slate-800/40 rounded w-2/3" />
      <div className="mt-auto h-3 bg-slate-800/40 rounded w-1/4" />
    </div>
  );
}

// ── Filter sidebar ───────────────────────────────────────────────────────────

interface FilterSidebarProps {
  scoreMin: number;
  onScoreMin: (v: number) => void;
  selectedTypes: string[];
  onToggleType: (t: string) => void;
  selectedSources: string[];
  onToggleSource: (s: string) => void;
  hasEmail: boolean;
  onHasEmail: () => void;
  hasPhone: boolean;
  onHasPhone: () => void;
  sortBy: "score" | "name" | "newest";
  onSortBy: (s: "score" | "name" | "newest") => void;
  availableSources: string[];
  activeFilterCount: number;
  onReset: () => void;
}

function FilterSidebar({
  scoreMin,
  onScoreMin,
  selectedTypes,
  onToggleType,
  selectedSources,
  onToggleSource,
  hasEmail,
  onHasEmail,
  hasPhone,
  onHasPhone,
  sortBy,
  onSortBy,
  availableSources,
  activeFilterCount,
  onReset,
}: FilterSidebarProps) {
  const labelCls = "text-xs text-slate-400 mb-2 block";
  const checkboxCls =
    "w-3.5 h-3.5 rounded border-slate-600 bg-slate-800 accent-sky-500 cursor-pointer shrink-0";

  const TYPES = ["business", "corporation", "job", "person"] as const;
  const SORTS = [
    { value: "score" as const, label: "Match Score" },
    { value: "name" as const, label: "Name A–Z" },
    { value: "newest" as const, label: "Newest First" },
  ];

  return (
    <div className="flex flex-col gap-5 p-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
          Filters
        </span>
        {activeFilterCount > 0 && (
          <button
            onClick={onReset}
            className="text-xs text-sky-400 hover:text-sky-300 transition-colors"
          >
            Reset all
          </button>
        )}
      </div>

      {/* Score slider */}
      <div>
        <label className={labelCls}>
          Min Score:{" "}
          <span className="text-sky-400 font-mono font-semibold">{scoreMin}%</span>
        </label>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={scoreMin}
          onChange={(e) => onScoreMin(Number(e.target.value))}
          className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-sky-500"
        />
        <div className="flex justify-between text-xs text-slate-700 mt-1">
          <span>0%</span>
          <span>100%</span>
        </div>
      </div>

      {/* Type filter */}
      <div>
        <label className={labelCls}>Type</label>
        <div className="flex flex-col gap-2">
          {TYPES.map((t) => (
            <label key={t} className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                className={checkboxCls}
                checked={selectedTypes.includes(t)}
                onChange={() => onToggleType(t)}
              />
              <span className="text-xs text-slate-400 group-hover:text-slate-200 capitalize transition-colors">
                {t}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Source filter */}
      {availableSources.length > 0 && (
        <div>
          <label className={labelCls}>Source</label>
          <div className="flex flex-col gap-2">
            {availableSources.map((s) => (
              <label key={s} className="flex items-center gap-2.5 cursor-pointer group">
                <input
                  type="checkbox"
                  className={checkboxCls}
                  checked={selectedSources.includes(s)}
                  onChange={() => onToggleSource(s)}
                />
                <span className="text-xs text-slate-400 group-hover:text-slate-200 transition-colors">
                  {SOURCE_LABELS[s] ?? s}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Contact toggles */}
      <div>
        <label className={labelCls}>Contact Data</label>
        <div className="flex flex-col gap-2">
          {[
            { label: "Has Email", active: hasEmail, toggle: onHasEmail },
            { label: "Has Phone", active: hasPhone, toggle: onHasPhone },
          ].map(({ label, active, toggle }) => (
            <button
              key={label}
              onClick={toggle}
              className={`flex items-center justify-between w-full px-3 py-2 rounded-lg text-xs transition-all ${
                active
                  ? "bg-sky-500/10 border border-sky-500/25 text-sky-300"
                  : "bg-slate-800/40 border border-slate-700/40 text-slate-500 hover:border-slate-600/40 hover:text-slate-400"
              }`}
            >
              {label}
              {/* toggle track */}
              <span
                className={`relative inline-flex w-7 h-4 rounded-full transition-colors shrink-0 ${
                  active ? "bg-sky-500" : "bg-slate-700"
                }`}
              >
                <span
                  className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${
                    active ? "translate-x-3.5" : "translate-x-0.5"
                  }`}
                />
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Sort by */}
      <div>
        <label className={labelCls}>Sort By</label>
        <div className="flex flex-col gap-1">
          {SORTS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => onSortBy(value)}
              className={`text-left px-3 py-2 rounded-lg text-xs transition-all ${
                sortBy === value
                  ? "bg-sky-500/10 text-sky-300 border border-sky-500/25"
                  : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/40"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Dashboard page ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  // Data
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Mobile sidebar
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Export dropdown
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  // Close export dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Filters
  const [scoreMin, setScoreMin] = useState(0);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [hasEmail, setHasEmail] = useState(false);
  const [hasPhone, setHasPhone] = useState(false);
  const [sortBy, setSortBy] = useState<"score" | "name" | "newest">("score");

  // Fetch
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/results/${id}`);
        if (!res.ok) throw new Error("Failed to load results");
        const json: DashboardData = await res.json();
        setData(json);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Load failed");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  // Derived: unique sources
  const availableSources = useMemo(() => {
    if (!data) return [];
    return Array.from(new Set(data.results.map((r) => r.source)));
  }, [data]);

  // Filter + sort
  const filteredResults = useMemo(() => {
    if (!data) return [];
    let arr = data.results.filter((r) => {
      if (r.score < scoreMin) return false;
      if (
        selectedTypes.length > 0 &&
        !selectedTypes.includes((r.enrichment?.type as string)?.toLowerCase() ?? "")
      )
        return false;
      if (selectedSources.length > 0 && !selectedSources.includes(r.source))
        return false;
      if (hasEmail && !r.enrichment?.email) return false;
      if (hasPhone && !r.enrichment?.phone) return false;
      return true;
    });

    return [...arr].sort((a, b) => {
      if (sortBy === "score") return b.score - a.score;
      if (sortBy === "name") return a.title.localeCompare(b.title);
      return 0; // newest: preserve DB order (already score desc by default)
    });
  }, [data, scoreMin, selectedTypes, selectedSources, hasEmail, hasPhone, sortBy]);

  // Helpers
  const toggleType = (t: string) =>
    setSelectedTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );

  const toggleSource = (s: string) =>
    setSelectedSources((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );

  const resetFilters = () => {
    setScoreMin(0);
    setSelectedTypes([]);
    setSelectedSources([]);
    setHasEmail(false);
    setHasPhone(false);
    setSortBy("score");
  };

  const activeFilterCount = [
    scoreMin > 0,
    selectedTypes.length > 0,
    selectedSources.length > 0,
    hasEmail,
    hasPhone,
  ].filter(Boolean).length;

  const sidebarProps: FilterSidebarProps = {
    scoreMin,
    onScoreMin: setScoreMin,
    selectedTypes,
    onToggleType: toggleType,
    selectedSources,
    onToggleSource: toggleSource,
    hasEmail,
    onHasEmail: () => setHasEmail(!hasEmail),
    hasPhone,
    onHasPhone: () => setHasPhone(!hasPhone),
    sortBy,
    onSortBy: setSortBy,
    availableSources,
    activeFilterCount,
    onReset: resetFilters,
  };

  return (
    <div className="min-h-screen bg-[#020817] flex flex-col">
      {/* ── Sticky top bar ── */}
      <header className="sticky top-0 z-40 bg-[#020817]/95 backdrop-blur border-b border-slate-800/60">
        <div className="max-w-screen-2xl mx-auto flex items-center gap-3 h-14 px-4 sm:px-6">
          {/* Back */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/")}
            className="text-slate-400 hover:text-slate-200 gap-1.5 -ml-2 px-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline text-xs">Back</span>
          </Button>

          {/* Logo divider */}
          <div className="flex items-center gap-1.5 border-l border-slate-800/60 pl-3">
            <Anchor className="text-sky-400 w-3.5 h-3.5" />
            <span className="text-slate-500 text-xs font-bold tracking-widest uppercase hidden md:block">
              ClientAnchor
            </span>
          </div>

          {/* Prompt excerpt */}
          {data && (
            <p className="flex-1 text-slate-500 text-xs truncate hidden sm:block pl-2 border-l border-slate-800/60">
              {data.prompt.length > 70
                ? data.prompt.slice(0, 70) + "…"
                : data.prompt}
            </p>
          )}

          <div className="flex-1 sm:hidden" />

          {/* Badges */}
          {data && (
            <div className="hidden sm:flex items-center gap-2 ml-auto">
              <Badge
                variant="secondary"
                className="bg-slate-800/60 text-slate-300 border-slate-700/40 text-xs font-mono"
              >
                {filteredResults.length}/{data.resultCount} results
              </Badge>
              {data.avgScore > 0 && (
                <Badge
                  variant="secondary"
                  className="bg-sky-500/10 text-sky-300 border-sky-500/20 text-xs font-mono"
                >
                  avg {Math.round(data.avgScore)}%
                </Badge>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 ml-auto sm:ml-0">
            {/* Mobile filter toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(true)}
              className="sm:hidden text-slate-400 hover:text-slate-200 relative"
            >
              <SlidersHorizontal className="w-4 h-4" />
              {activeFilterCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-sky-500 rounded-full text-[9px] text-white flex items-center justify-center font-bold">
                  {activeFilterCount}
                </span>
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              disabled
              className="border-slate-700/60 text-slate-600 gap-1.5 text-xs hidden sm:flex"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </Button>

            {/* Export dropdown */}
            <div className="relative" ref={exportRef}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExportOpen(!exportOpen)}
                disabled={!data || data.resultCount === 0}
                className="border-slate-700/60 text-slate-400 hover:text-slate-200 gap-1.5 text-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Export</span>
                <ChevronDown className="w-3 h-3" />
              </Button>

              <AnimatePresence>
                {exportOpen && data && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-1.5 w-44 bg-slate-900 border border-slate-700/60 rounded-xl shadow-xl z-50 overflow-hidden"
                  >
                    <a
                      href={`/api/export/${data.id}?format=csv`}
                      download
                      onClick={() => setExportOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800/60 hover:text-sky-300 transition-colors"
                    >
                      <FileText className="w-4 h-4 text-slate-500" />
                      Export CSV
                    </a>
                    <a
                      href={`/api/export/${data.id}?format=xlsx`}
                      download
                      onClick={() => setExportOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800/60 hover:text-sky-300 transition-colors"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-emerald-500/70" />
                      Export Excel
                    </a>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1 max-w-screen-2xl mx-auto w-full">
        {/* Desktop sidebar */}
        <aside className="hidden sm:block w-64 shrink-0 border-r border-slate-800/50 sticky top-14 self-start max-h-[calc(100vh-56px)] overflow-y-auto">
          <FilterSidebar {...sidebarProps} />
        </aside>

        {/* Mobile sidebar: overlay drawer */}
        <AnimatePresence>
          {sidebarOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => setSidebarOpen(false)}
                className="fixed inset-0 bg-black/60 z-40 sm:hidden"
              />

              {/* Drawer */}
              <motion.aside
                initial={{ x: -288 }}
                animate={{ x: 0 }}
                exit={{ x: -288 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="fixed left-0 top-0 bottom-0 w-72 bg-[#020817] border-r border-slate-800/60 z-50 sm:hidden overflow-y-auto"
              >
                <div className="flex items-center justify-between px-5 pt-4 pb-0">
                  <span className="text-slate-200 text-sm font-semibold">Filters</span>
                  <button
                    onClick={() => setSidebarOpen(false)}
                    className="text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <FilterSidebar {...sidebarProps} />
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* ── Main content ── */}
        <main className="flex-1 min-w-0 p-4 sm:p-6">
          {/* Loading: skeleton grid */}
          {loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <AlertCircle className="w-10 h-10 text-red-400/60" />
              <p className="text-slate-400 text-sm">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.reload()}
                className="border-slate-700/60 text-slate-400"
              >
                Retry
              </Button>
            </div>
          )}

          {/* Results */}
          {!loading && !error && data && (
            <>
              {/* Mobile meta */}
              <div className="flex items-center gap-2 mb-4 sm:hidden">
                <Badge
                  variant="secondary"
                  className="bg-slate-800/60 text-slate-300 border-slate-700/40 text-xs font-mono"
                >
                  {filteredResults.length}/{data.resultCount}
                </Badge>
                {data.avgScore > 0 && (
                  <Badge
                    variant="secondary"
                    className="bg-sky-500/10 text-sky-300 border-sky-500/20 text-xs font-mono"
                  >
                    avg {Math.round(data.avgScore)}%
                  </Badge>
                )}
              </div>

              {/* Empty state */}
              {filteredResults.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center py-24 gap-4"
                >
                  <div className="w-16 h-16 rounded-2xl bg-slate-800/60 border border-slate-700/40 flex items-center justify-center">
                    <Search className="w-7 h-7 text-slate-600" />
                  </div>
                  <div className="text-center">
                    <p className="text-slate-300 font-medium mb-1">
                      {data.resultCount === 0
                        ? "No results found"
                        : "No matches for current filters"}
                    </p>
                    <p className="text-slate-500 text-sm">
                      {data.resultCount === 0
                        ? "Try a broader search query"
                        : "Adjust or reset filters to see more results"}
                    </p>
                  </div>
                  {activeFilterCount > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={resetFilters}
                      className="border-slate-700/60 text-slate-400"
                    >
                      Reset Filters
                    </Button>
                  )}
                </motion.div>
              ) : (
                <>
                  {/* Count line */}
                  <div className="flex items-center gap-2 mb-4">
                    <LayoutGrid className="w-3.5 h-3.5 text-slate-600" />
                    <span className="text-xs text-slate-600">
                      Showing {filteredResults.length}{" "}
                      {filteredResults.length !== 1 ? "results" : "result"}
                      {activeFilterCount > 0 &&
                        ` (filtered from ${data.resultCount})`}
                    </span>
                  </div>

                  {/* Results grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredResults.map((result, i) => (
                      <ResultCard key={result.id} result={result} index={i} />
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
