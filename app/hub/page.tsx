"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Anchor,
  Plus,
  ExternalLink,
  RefreshCw,
  Copy,
  Archive,
  Search,
  AlertCircle,
  ChevronDown,
  Briefcase,
  Building2,
  Handshake,
  Clock,
  BarChart2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SearchSummary {
  id: string;
  prompt: string;
  intent: string | null;
  status: string;
  resultCount: number;
  avgScore: number;
  filters: unknown;
  createdAt: string;
  updatedAt: string;
  actualCount: number;
  sources: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  return `${mo}mo ago`;
}

function statusInfo(s: SearchSummary): { dot: string; label: string; cls: string } {
  if (s.status === "failed") return { dot: "bg-red-500", label: "Failed", cls: "text-red-400" };
  if (s.status === "running") return { dot: "bg-sky-500 animate-pulse", label: "Running", cls: "text-sky-400" };
  const stale = Date.now() - new Date(s.updatedAt).getTime() > 7 * 24 * 60 * 60 * 1000;
  if (stale) return { dot: "bg-amber-400", label: "Stale", cls: "text-amber-400" };
  return { dot: "bg-emerald-500", label: "Active", cls: "text-emerald-400" };
}

function scoreColor(avg: number): string {
  if (avg >= 70) return "text-emerald-400";
  if (avg >= 50) return "text-sky-400";
  if (avg >= 30) return "text-amber-400";
  return "text-slate-500";
}

const INTENT_ICONS: Record<string, React.ReactNode> = {
  business: <Building2 className="w-3 h-3" />,
  job: <Briefcase className="w-3 h-3" />,
  partnership: <Handshake className="w-3 h-3" />,
};

const INTENT_CLS: Record<string, string> = {
  business: "bg-sky-500/10 text-sky-300 border-sky-500/20",
  job: "bg-purple-500/10 text-purple-300 border-purple-500/20",
  partnership: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
};

const SOURCE_LABELS: Record<string, string> = {
  google_places: "G.Places",
  serpapi: "SerpAPI",
  adzuna: "Adzuna",
  hunter: "Hunter",
};

// ── SearchCard ────────────────────────────────────────────────────────────────

interface CardProps {
  search: SearchSummary;
  onArchive: (id: string) => void;
  onRefreshed: (id: string, newCount: number) => void;
}

function SearchCard({ search, onArchive, onRefreshed }: CardProps) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState("");
  const st = statusInfo(search);

  const handleRefresh = async () => {
    setRefreshing(true);
    setRefreshMsg("");
    try {
      const res = await fetch(`/api/refresh/${search.id}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Refresh failed");
      setRefreshMsg(`+${data.newResults} new`);
      onRefreshed(search.id, data.totalCount);
    } catch (e) {
      setRefreshMsg("Failed");
    } finally {
      setRefreshing(false);
      setTimeout(() => setRefreshMsg(""), 3000);
    }
  };

  const handleDuplicate = () => {
    const q = encodeURIComponent(search.prompt);
    router.push(`/?q=${q}`);
  };

  const handleArchive = async () => {
    await fetch(`/api/searches/${search.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "archived" }),
    });
    onArchive(search.id);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.25 }}
      className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-5 flex flex-col gap-3 hover:border-sky-500/25 transition-colors"
    >
      {/* Status dot + intent + time */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full shrink-0 ${st.dot}`} title={st.label} />
          {search.intent && (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border font-medium ${INTENT_CLS[search.intent] ?? "bg-slate-700/20 text-slate-400 border-slate-600/20"}`}>
              {INTENT_ICONS[search.intent]}
              {search.intent}
            </span>
          )}
        </div>
        <span className="text-slate-600 text-xs flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {timeAgo(search.createdAt)}
        </span>
      </div>

      {/* Prompt excerpt */}
      <p className="text-slate-200 text-sm font-medium leading-snug line-clamp-2">
        {search.prompt.length > 80 ? search.prompt.slice(0, 80) + "…" : search.prompt}
      </p>

      {/* Stats row */}
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1 text-xs text-slate-400">
          <BarChart2 className="w-3.5 h-3.5 text-slate-600" />
          <span className="font-mono font-semibold">{search.resultCount}</span>
          <span className="text-slate-600">results</span>
        </span>
        {search.avgScore > 0 && (
          <span className={`text-xs font-mono font-semibold ${scoreColor(search.avgScore)}`}>
            avg {Math.round(search.avgScore)}%
          </span>
        )}
      </div>

      {/* Source chips */}
      {search.sources.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {search.sources.map((s) => (
            <span
              key={s}
              className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800/60 text-slate-500 border border-slate-700/40"
            >
              {SOURCE_LABELS[s] ?? s}
            </span>
          ))}
        </div>
      )}

      {/* Refresh feedback */}
      {refreshMsg && (
        <p className={`text-xs font-medium ${refreshMsg.startsWith("+") ? "text-emerald-400" : "text-red-400"}`}>
          {refreshMsg}
        </p>
      )}

      {/* Action row */}
      <div className="flex items-center gap-1.5 mt-auto pt-1 border-t border-slate-800/60">
        <button
          onClick={() => router.push(`/dashboard/${search.id}`)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition-colors"
        >
          Open <ExternalLink className="w-3 h-3" />
        </button>

        <button
          onClick={handleRefresh}
          disabled={refreshing || search.status === "running"}
          title="Refresh — fetch new results"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-700/60 text-slate-400 hover:text-sky-300 hover:border-sky-500/30 text-xs transition-colors disabled:opacity-40"
        >
          {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
        </button>

        <button
          onClick={handleDuplicate}
          title="Duplicate — re-run same query"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-700/60 text-slate-400 hover:text-slate-200 hover:border-slate-600/60 text-xs transition-colors"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={handleArchive}
          title="Archive"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-700/60 text-slate-500 hover:text-red-400 hover:border-red-500/30 text-xs transition-colors ml-auto"
        >
          <Archive className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-slate-900/60 border border-slate-800/60 rounded-xl p-5 animate-pulse flex flex-col gap-3 h-[200px]">
      <div className="flex justify-between">
        <div className="h-4 w-20 bg-slate-800 rounded-full" />
        <div className="h-3 w-14 bg-slate-800/60 rounded" />
      </div>
      <div className="h-4 bg-slate-800 rounded w-full" />
      <div className="h-4 bg-slate-800/60 rounded w-4/5" />
      <div className="flex gap-2 mt-1">
        <div className="h-3 w-12 bg-slate-800/40 rounded-full" />
        <div className="h-3 w-16 bg-slate-800/40 rounded-full" />
      </div>
      <div className="flex gap-1.5 mt-auto pt-3 border-t border-slate-800/40">
        <div className="h-7 w-16 bg-slate-800/60 rounded-lg" />
        <div className="h-7 w-8 bg-slate-800/40 rounded-lg" />
        <div className="h-7 w-8 bg-slate-800/40 rounded-lg" />
      </div>
    </div>
  );
}

// ── Hub page ──────────────────────────────────────────────────────────────────

type SortKey = "newest" | "score" | "results";
type IntentFilter = "all" | "business" | "job" | "partnership";
type StatusFilter = "all" | "active" | "stale" | "failed";

export default function HubPage() {
  const router = useRouter();
  const [searches, setSearches] = useState<SearchSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Controls
  const [sort, setSort] = useState<SortKey>("newest");
  const [intentFilter, setIntentFilter] = useState<IntentFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  useEffect(() => {
    fetch("/api/searches")
      .then((r) => r.json())
      .then((d) => setSearches(d.searches ?? []))
      .catch(() => setError("Failed to load searches"))
      .finally(() => setLoading(false));
  }, []);

  const handleArchive = (id: string) =>
    setSearches((prev) => prev.filter((s) => s.id !== id));

  const handleRefreshed = (id: string, newCount: number) =>
    setSearches((prev) =>
      prev.map((s) => (s.id === id ? { ...s, resultCount: newCount, updatedAt: new Date().toISOString() } : s))
    );

  const displayed = useMemo(() => {
    let arr = [...searches];

    // Intent filter
    if (intentFilter !== "all") arr = arr.filter((s) => s.intent === intentFilter);

    // Status filter
    if (statusFilter !== "all") {
      arr = arr.filter((s) => {
        const st = statusInfo(s).label.toLowerCase();
        return st === statusFilter;
      });
    }

    // Sort
    arr.sort((a, b) => {
      if (sort === "score") return b.avgScore - a.avgScore;
      if (sort === "results") return b.resultCount - a.resultCount;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return arr;
  }, [searches, sort, intentFilter, statusFilter]);

  return (
    <div className="min-h-screen bg-[#020817]">
      {/* Atmospheric glow */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[400px] w-[700px] rounded-full bg-sky-600/5 blur-[120px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#020817]/95 backdrop-blur border-b border-slate-800/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center gap-4 h-14">
          <button onClick={() => router.push("/")} className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
              <Anchor className="text-sky-400 w-3.5 h-3.5" />
            </div>
            <span className="text-slate-500 text-xs font-bold tracking-widest uppercase hidden sm:block">
              ClientAnchor
            </span>
          </button>

          <div className="flex-1 text-center">
            <h1 className="text-slate-200 font-semibold text-sm tracking-wide">
              Your Anchor Points
            </h1>
          </div>

          <Button
            onClick={() => router.push("/")}
            size="sm"
            className="bg-sky-600 hover:bg-sky-500 text-white gap-1.5 text-xs"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Search</span>
          </Button>
        </div>
      </header>

      {/* Controls bar */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center gap-3 border-b border-slate-800/40">
        {/* Sort */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-slate-500">Sort:</span>
          {(["newest", "score", "results"] as SortKey[]).map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={`px-2.5 py-1 rounded-lg border transition-all ${
                sort === s
                  ? "bg-sky-500/10 text-sky-300 border-sky-500/25"
                  : "text-slate-500 border-slate-700/40 hover:text-slate-300 hover:border-slate-600/40"
              }`}
            >
              {s === "newest" ? "Newest" : s === "score" ? "Top Score" : "Most Results"}
            </button>
          ))}
        </div>

        {/* Intent filter */}
        <div className="flex items-center gap-1.5 text-xs ml-auto">
          <span className="text-slate-500">Intent:</span>
          {(["all", "business", "job", "partnership"] as IntentFilter[]).map((v) => (
            <button
              key={v}
              onClick={() => setIntentFilter(v)}
              className={`px-2.5 py-1 rounded-lg border capitalize transition-all ${
                intentFilter === v
                  ? "bg-sky-500/10 text-sky-300 border-sky-500/25"
                  : "text-slate-500 border-slate-700/40 hover:text-slate-300 hover:border-slate-600/40"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Count line */}
        {!loading && !error && searches.length > 0 && (
          <p className="text-xs text-slate-600 mb-4">
            {displayed.length} anchor{displayed.length !== 1 ? "s" : ""}
            {displayed.length < searches.length ? ` (filtered from ${searches.length})` : ""}
          </p>
        )}

        {/* Loading */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <AlertCircle className="w-8 h-8 text-red-400/60" />
            <p className="text-slate-400 text-sm">{error}</p>
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
              Retry
            </Button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && searches.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-32 gap-5"
          >
            <div className="w-16 h-16 rounded-2xl bg-slate-800/60 border border-slate-700/40 flex items-center justify-center">
              <Anchor className="w-7 h-7 text-slate-600" />
            </div>
            <div className="text-center">
              <p className="text-slate-300 font-medium mb-1">No anchors yet</p>
              <p className="text-slate-500 text-sm">Start your first search to see it here</p>
            </div>
            <Button
              onClick={() => router.push("/")}
              className="bg-sky-600 hover:bg-sky-500 text-white gap-2"
            >
              <Plus className="w-4 h-4" /> Start searching
            </Button>
          </motion.div>
        )}

        {/* No results after filter */}
        {!loading && !error && searches.length > 0 && displayed.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Search className="w-8 h-8 text-slate-600" />
            <p className="text-slate-400 text-sm">No searches match current filters</p>
            <button
              onClick={() => { setIntentFilter("all"); setStatusFilter("all"); }}
              className="text-sky-400 text-xs hover:text-sky-300"
            >
              Reset filters
            </button>
          </div>
        )}

        {/* Grid */}
        {!loading && !error && displayed.length > 0 && (
          <AnimatePresence mode="popLayout">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayed.map((s) => (
                <SearchCard
                  key={s.id}
                  search={s}
                  onArchive={handleArchive}
                  onRefreshed={handleRefreshed}
                />
              ))}
            </div>
          </AnimatePresence>
        )}
      </main>
    </div>
  );
}
