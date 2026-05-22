"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Plus, Trash2, Loader2, Anchor,
  Import, ChevronDown, ChevronRight, Check,
  FolderOpen, Search, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

interface FunnelItem {
  id: string;
  resultId: string;
  position: number;
  result: {
    id: string;
    name: string;
    type: string;
    email?: string;
    website?: string;
  };
}

interface Funnel {
  id: string;
  name: string;
  type: string;
  description?: string;
  position: number;
  items: FunnelItem[];
}

interface SearchSummary {
  id: string;
  prompt: string;
  resultCount: number;
  createdAt: string;
}

interface SearchResult {
  id: string;
  title: string;
  description: string;
  source: string;
  score: number;
  enrichment: {
    email?: string | null;
    type?: string | null;
    [key: string]: unknown;
  };
}

// ── Type badge ────────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  investor: "bg-yellow-500/10 text-yellow-300 border-yellow-500/20",
  job: "bg-purple-500/10 text-purple-300 border-purple-500/20",
  partner: "bg-teal-500/10 text-teal-300 border-teal-500/20",
  custom: "bg-slate-700/30 text-slate-400 border-slate-600/20",
};

function TypeBadge({ type }: { type: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] border font-medium capitalize ${TYPE_COLORS[type] ?? TYPE_COLORS.custom}`}>
      {type}
    </span>
  );
}

// ── Import modal ──────────────────────────────────────────────────────────────

function ImportModal({
  funnelId,
  funnelName,
  existingResultIds,
  onImported,
  onClose,
}: {
  funnelId: string;
  funnelName: string;
  existingResultIds: Set<string>;
  onImported: (item: FunnelItem) => void;
  onClose: () => void;
}) {
  const [searches, setSearches] = useState<SearchSummary[]>([]);
  const [selectedSearch, setSelectedSearch] = useState<string>("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [adding, setAdding] = useState<Set<string>>(new Set());
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set(existingResultIds));
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch("/api/searches")
      .then((r) => r.json())
      .then((d) => setSearches(d.searches ?? []))
      .catch(() => toast.error("Failed to load searches"));
  }, []);

  useEffect(() => {
    if (!selectedSearch) { setResults([]); return; }
    setLoadingResults(true);
    fetch(`/api/results/${selectedSearch}`)
      .then((r) => r.json())
      .then((d) => setResults(d.results ?? []))
      .catch(() => toast.error("Failed to load results"))
      .finally(() => setLoadingResults(false));
  }, [selectedSearch]);

  const filtered = results.filter((r) =>
    !query || r.title.toLowerCase().includes(query.toLowerCase()) || (r.enrichment.email ?? "").toString().toLowerCase().includes(query.toLowerCase())
  );

  const handleAdd = async (result: SearchResult) => {
    if (addedIds.has(result.id)) return;
    setAdding((prev) => new Set(prev).add(result.id));
    try {
      const res = await fetch(`/api/funnels/${funnelId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resultId: result.id }),
      });
      if (res.status === 409) { toast.info("Already in funnel"); setAddedIds((p) => new Set(p).add(result.id)); return; }
      if (!res.ok) throw new Error();
      const item = await res.json();
      setAddedIds((p) => new Set(p).add(result.id));
      onImported(item);
      toast.success(`Added "${result.title}"`);
    } catch {
      toast.error("Failed to add result");
    } finally {
      setAdding((prev) => { const n = new Set(prev); n.delete(result.id); return n; });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <motion.div initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.2 }}
        className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/60 rounded-2xl shadow-2xl flex flex-col max-h-[80vh]">

        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">Import into "{funnelName}"</h2>
            <p className="text-xs text-slate-500 mt-0.5">Pick results from past searches to add to this funnel</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search picker */}
        <div className="px-5 py-3 border-b border-slate-800 shrink-0 flex flex-col gap-2">
          <Select value={selectedSearch} onValueChange={setSelectedSearch}>
            <SelectTrigger className="bg-slate-800/60 border-slate-700/60 text-slate-200 text-sm">
              <SelectValue placeholder="— Select a past search —" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-700">
              {searches.map((s) => (
                <SelectItem key={s.id} value={s.id} className="text-slate-200">
                  <span className="truncate">{s.prompt.length > 60 ? s.prompt.slice(0, 60) + "…" : s.prompt}</span>
                  <span className="ml-2 text-slate-500 text-xs">({s.resultCount})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedSearch && (
            <Input value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter results..."
              className="h-8 text-xs bg-slate-800/60 border-slate-700/60 text-slate-200" />
          )}
        </div>

        {/* Results list */}
        <div className="flex-1 overflow-y-auto">
          {!selectedSearch && (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <Search className="w-8 h-8 text-slate-700" />
              <p className="text-sm text-slate-600">Select a past search above</p>
            </div>
          )}

          {selectedSearch && loadingResults && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-slate-600" />
            </div>
          )}

          {selectedSearch && !loadingResults && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <p className="text-sm text-slate-600">No results found</p>
            </div>
          )}

          {filtered.map((result) => {
            const added = addedIds.has(result.id);
            const isAdding = adding.has(result.id);
            return (
              <div key={result.id}
                className="flex items-center gap-3 px-5 py-3 border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200 font-medium truncate">{result.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {result.enrichment.email && (
                      <span className="text-xs text-slate-500 truncate">{String(result.enrichment.email)}</span>
                    )}
                    <span className="text-xs text-slate-700 font-mono">{result.source}</span>
                    <span className="text-xs text-sky-400 font-mono">{result.score}%</span>
                  </div>
                </div>
                <button
                  onClick={() => handleAdd(result)}
                  disabled={added || isAdding}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                    added
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 cursor-default"
                      : "bg-sky-600 hover:bg-sky-500 text-white"
                  }`}
                >
                  {isAdding ? <Loader2 className="w-3 h-3 animate-spin" /> : added ? <><Check className="w-3 h-3" /> Added</> : <><Plus className="w-3 h-3" /> Add</>}
                </button>
              </div>
            );
          })}
        </div>

        <div className="px-5 py-3 border-t border-slate-800 shrink-0">
          <button onClick={onClose} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Done</button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Funnel card ───────────────────────────────────────────────────────────────

function FunnelCard({
  funnel,
  onDelete,
  onItemRemoved,
  onItemImported,
}: {
  funnel: Funnel;
  onDelete: () => void;
  onItemRemoved: (itemId: string) => void;
  onItemImported: (item: FunnelItem) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const existingIds = new Set(funnel.items.map((i) => i.resultId));

  return (
    <>
      <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl overflow-hidden hover:border-slate-600/60 transition-all">
        {/* Card header */}
        <div className="px-5 py-4 flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="text-sm font-semibold text-slate-100 truncate">{funnel.name}</h3>
              <TypeBadge type={funnel.type} />
            </div>
            {funnel.description && (
              <p className="text-xs text-slate-500 line-clamp-1">{funnel.description}</p>
            )}
            <p className="text-xs text-slate-600 mt-1">{funnel.items.length} result{funnel.items.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 text-xs font-medium transition-colors"
            >
              <Import className="w-3 h-3" />
              Import
            </button>
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800/60 transition-colors"
            >
              {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            <button
              onClick={onDelete}
              className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Items */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t border-slate-800/60"
            >
              {funnel.items.length === 0 ? (
                <div className="px-5 py-6 text-center">
                  <p className="text-xs text-slate-600">No results yet</p>
                  <button onClick={() => setShowImport(true)}
                    className="mt-2 text-xs text-sky-400 hover:text-sky-300 transition-colors">
                    Import from a search →
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-slate-800/60">
                  {funnel.items.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 px-5 py-3 group hover:bg-slate-800/20 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-300 font-medium truncate">{item.result.name}</p>
                        {item.result.email && <p className="text-xs text-slate-600 truncate">{item.result.email}</p>}
                      </div>
                      <button
                        onClick={() => onItemRemoved(item.id)}
                        className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-red-400 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showImport && (
          <ImportModal
            funnelId={funnel.id}
            funnelName={funnel.name}
            existingResultIds={existingIds}
            onImported={onItemImported}
            onClose={() => setShowImport(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ── Funnels page ──────────────────────────────────────────────────────────────

const FUNNEL_TYPES = [
  { value: "investor", label: "Investor Search" },
  { value: "job", label: "Job Search" },
  { value: "partner", label: "Partnership" },
  { value: "custom", label: "Custom" },
];

export default function FunnelsPage() {
  const router = useRouter();
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("custom");
  const [newDescription, setNewDescription] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch("/api/funnels")
      .then((r) => r.json())
      .then((d) => setFunnels(d.funnels ?? []))
      .catch(() => toast.error("Failed to load funnels"))
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) { toast.error("Name required"); return; }
    setCreating(true);
    try {
      const res = await fetch("/api/funnels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, type: newType, description: newDescription || null }),
      });
      if (!res.ok) throw new Error();
      const funnel = await res.json();
      setFunnels((p) => [...p, funnel]);
      setNewName(""); setNewType("custom"); setNewDescription(""); setShowNew(false);
      toast.success("Funnel created");
    } catch {
      toast.error("Failed to create funnel");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/funnels/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setFunnels((p) => p.filter((f) => f.id !== id));
      toast.success("Funnel deleted");
    } catch {
      toast.error("Failed to delete funnel");
    }
  };

  const handleItemRemoved = (funnelId: string, itemId: string) => {
    fetch(`/api/funnels/${funnelId}/items/${itemId}`, { method: "DELETE" });
    setFunnels((p) => p.map((f) => f.id === funnelId ? { ...f, items: f.items.filter((i) => i.id !== itemId) } : f));
    toast.success("Removed");
  };

  const handleItemImported = (funnelId: string, item: FunnelItem) => {
    setFunnels((p) => p.map((f) => f.id === funnelId ? { ...f, items: [...f.items, item] } : f));
  };

  return (
    <div className="min-h-screen bg-[#020817]">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#020817]/95 backdrop-blur border-b border-slate-800/60">
        <div className="max-w-5xl mx-auto flex items-center gap-3 h-14 px-4 sm:px-6">
          <Button variant="ghost" size="sm" onClick={() => router.back()}
            className="text-slate-400 hover:text-slate-200 gap-1.5 -ml-2 px-2">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline text-xs">Back</span>
          </Button>
          <div className="flex items-center gap-1.5 border-l border-slate-800/60 pl-3">
            <Anchor className="text-sky-400 w-3.5 h-3.5" />
            <span className="text-slate-400 text-xs font-bold tracking-widest uppercase">Funnels</span>
          </div>
          <div className="flex-1" />
          <Button size="sm" onClick={() => setShowNew(true)}
            className="bg-sky-600 hover:bg-sky-500 text-white gap-1.5 text-xs">
            <Plus className="w-3.5 h-3.5" />
            New Funnel
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* New funnel form */}
        <AnimatePresence>
          {showNew && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 p-5 bg-slate-900/60 border border-slate-700/60 rounded-xl flex flex-col gap-3 overflow-hidden">
              <h3 className="text-sm font-semibold text-slate-200">Create New Funnel</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input value={newName} onChange={(e) => setNewName(e.target.value)}
                  placeholder="Funnel name"
                  className="bg-slate-800/60 border-slate-700/60 text-slate-200"
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()} />
                <Select value={newType} onValueChange={setNewType}>
                  <SelectTrigger className="bg-slate-800/60 border-slate-700/60 text-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700">
                    {FUNNEL_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Input value={newDescription} onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Description (optional)"
                className="bg-slate-800/60 border-slate-700/60 text-slate-200" />
              <div className="flex gap-2">
                <Button onClick={handleCreate} disabled={creating} size="sm"
                  className="bg-sky-600 hover:bg-sky-500 text-white">
                  {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Create"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowNew(false)}
                  className="border-slate-700/60 text-slate-400">Cancel</Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 animate-spin text-slate-600" />
          </div>
        )}

        {/* Empty */}
        {!loading && funnels.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-800/60 border border-slate-700/40 flex items-center justify-center">
              <FolderOpen className="w-7 h-7 text-slate-600" />
            </div>
            <div className="text-center">
              <p className="text-slate-300 font-medium mb-1">No funnels yet</p>
              <p className="text-slate-500 text-sm">Create a funnel to start organizing your leads</p>
            </div>
            <Button onClick={() => setShowNew(true)} size="sm"
              className="bg-sky-600 hover:bg-sky-500 text-white gap-1.5">
              <Plus className="w-3.5 h-3.5" />Create your first funnel
            </Button>
          </motion.div>
        )}

        {/* Funnel grid */}
        {!loading && funnels.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {funnels.map((funnel) => (
              <motion.div key={funnel.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}>
                <FunnelCard
                  funnel={funnel}
                  onDelete={() => handleDelete(funnel.id)}
                  onItemRemoved={(itemId) => handleItemRemoved(funnel.id, itemId)}
                  onItemImported={(item) => handleItemImported(funnel.id, item)}
                />
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
