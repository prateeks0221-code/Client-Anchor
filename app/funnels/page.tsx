"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Plus, Trash2, Loader2, Anchor,
  Import, ChevronDown, ChevronRight, Check,
  FolderOpen, Search, X, GripVertical,
  ExternalLink, Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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

// ── Type colours ──────────────────────────────────────────────────────────────

const TYPE_META: Record<string, { bg: string; border: string; text: string; dot: string; badge: string }> = {
  investor: { bg: "bg-yellow-500/5", border: "border-yellow-500/20", text: "text-yellow-300", dot: "bg-yellow-400", badge: "bg-yellow-500/10 text-yellow-300 border-yellow-500/20" },
  job:      { bg: "bg-purple-500/5", border: "border-purple-500/20", text: "text-purple-300", dot: "bg-purple-400", badge: "bg-purple-500/10 text-purple-300 border-purple-500/20" },
  partner:  { bg: "bg-teal-500/5",   border: "border-teal-500/20",   text: "text-teal-300",   dot: "bg-teal-400",   badge: "bg-teal-500/10 text-teal-300 border-teal-500/20" },
  custom:   { bg: "bg-slate-500/5",  border: "border-slate-600/20",  text: "text-slate-400",  dot: "bg-slate-500",  badge: "bg-slate-700/30 text-slate-400 border-slate-600/20" },
};

function typeMeta(type: string) { return TYPE_META[type] ?? TYPE_META.custom; }

// ── Import modal ──────────────────────────────────────────────────────────────

function ImportModal({
  funnelId, funnelName, existingResultIds, onImported, onClose,
}: {
  funnelId: string;
  funnelName: string;
  existingResultIds: Set<string>;
  onImported: (item: FunnelItem) => void;
  onClose: () => void;
}) {
  const [searches, setSearches] = useState<SearchSummary[]>([]);
  const [selectedSearch, setSelectedSearch] = useState("");
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
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">Import into &ldquo;{funnelName}&rdquo;</h2>
            <p className="text-xs text-slate-500 mt-0.5">Pick results from past searches</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors"><X className="w-4 h-4" /></button>
        </div>
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
        <div className="flex-1 overflow-y-auto">
          {!selectedSearch && (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <Search className="w-8 h-8 text-slate-700" />
              <p className="text-sm text-slate-600">Select a past search above</p>
            </div>
          )}
          {selectedSearch && loadingResults && (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-slate-600" /></div>
          )}
          {selectedSearch && !loadingResults && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-2"><p className="text-sm text-slate-600">No results found</p></div>
          )}
          {filtered.map((result) => {
            const added = addedIds.has(result.id);
            const isAdding = adding.has(result.id);
            return (
              <div key={result.id} className="flex items-center gap-3 px-5 py-3 border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200 font-medium truncate">{result.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {result.enrichment.email && <span className="text-xs text-slate-500 truncate">{String(result.enrichment.email)}</span>}
                    <span className="text-xs text-slate-700 font-mono">{result.source}</span>
                    <span className="text-xs text-sky-400 font-mono">{result.score}%</span>
                  </div>
                </div>
                <button onClick={() => handleAdd(result)} disabled={added || isAdding}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${added ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 cursor-default" : "bg-sky-600 hover:bg-sky-500 text-white"}`}>
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

// ── Funnel column (Kanban lane) ──────────────────────────────────────────────

function FunnelColumn({
  funnel, onDelete, onItemRemoved, onItemImported,
}: {
  funnel: Funnel;
  onDelete: () => void;
  onItemRemoved: (itemId: string) => void;
  onItemImported: (item: FunnelItem) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const meta = typeMeta(funnel.type);
  const existingIds = new Set(funnel.items.map((i) => i.resultId));

  return (
    <>
      <div className={`flex flex-col rounded-xl border ${meta.border} ${meta.bg} backdrop-blur-sm
                        w-[85vw] sm:w-80 shrink-0 snap-center max-h-[calc(100vh-10rem)] overflow-hidden
                        transition-all duration-300`}>
        {/* Column header — tap to expand/collapse */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full px-4 py-3 flex items-center gap-3 text-left group hover:bg-white/[0.02] transition-colors"
        >
          <div className={`w-2 h-2 rounded-full ${meta.dot} shrink-0`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-100 truncate">{funnel.name}</h3>
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] border font-medium capitalize ${meta.badge}`}>
                {funnel.type}
              </span>
            </div>
            {funnel.description && (
              <p className="text-[11px] text-slate-500 truncate mt-0.5">{funnel.description}</p>
            )}
          </div>
          <span className="text-[11px] text-slate-600 tabular-nums font-medium shrink-0">
            {funnel.items.length}
          </span>
          <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}
            className="text-slate-600 group-hover:text-slate-400 transition-colors">
            <ChevronDown className="w-4 h-4" />
          </motion.div>
        </button>

        {/* Action bar */}
        <div className="px-3 pb-2 flex items-center gap-1.5">
          <button onClick={() => setShowImport(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 text-[11px] font-medium transition-colors">
            <Import className="w-3 h-3" /> Import
          </button>
          <div className="flex-1" />
          <button onClick={onDelete}
            className="p-1.5 rounded-lg text-slate-700 hover:text-red-400 hover:bg-red-500/10 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Items */}
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="border-t border-slate-800/40 overflow-y-auto flex-1 px-2 pb-2 pt-2 space-y-1.5"
                   style={{ maxHeight: "calc(100vh - 18rem)" }}>
                {funnel.items.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-xs text-slate-600 mb-2">No leads yet</p>
                    <button onClick={() => setShowImport(true)}
                      className="text-xs text-sky-400 hover:text-sky-300 transition-colors">
                      Import from a search →
                    </button>
                  </div>
                ) : (
                  funnel.items.map((item) => (
                    <motion.div key={item.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="group bg-slate-900/60 hover:bg-slate-800/60 border border-slate-800/60 hover:border-slate-700/60
                                 rounded-lg px-3 py-2.5 transition-all cursor-default"
                    >
                      <div className="flex items-start gap-2">
                        <GripVertical className="w-3.5 h-3.5 text-slate-700 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] text-slate-200 font-medium truncate leading-tight">
                            {item.result.name}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            {item.result.email && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 truncate">
                                <Mail className="w-2.5 h-2.5" />{item.result.email}
                              </span>
                            )}
                            {item.result.website && (
                              <a href={item.result.website} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-0.5 text-[10px] text-sky-500 hover:text-sky-400 truncate">
                                <ExternalLink className="w-2.5 h-2.5" />site
                              </a>
                            )}
                          </div>
                        </div>
                        <button onClick={() => onItemRemoved(item.id)}
                          className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-red-400 transition-all shrink-0">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showImport && (
          <ImportModal
            funnelId={funnel.id} funnelName={funnel.name}
            existingResultIds={existingIds}
            onImported={onItemImported}
            onClose={() => setShowImport(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ── Pill navigator (mobile) ──────────────────────────────────────────────────

function PillNav({
  funnels, activeIndex, onSelect,
}: {
  funnels: Funnel[];
  activeIndex: number;
  onSelect: (i: number) => void;
}) {
  if (funnels.length <= 1) return null;
  return (
    <div className="sm:hidden fixed bottom-4 left-1/2 -translate-x-1/2 z-30
                    flex items-center gap-1.5 px-3 py-2 rounded-full
                    bg-slate-900/90 backdrop-blur-md border border-slate-700/60 shadow-xl">
      {funnels.map((f, i) => {
        const meta = typeMeta(f.type);
        return (
          <button key={f.id} onClick={() => onSelect(i)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all
              ${i === activeIndex
                ? `${meta.badge} ring-1 ring-white/10`
                : "text-slate-600 hover:text-slate-400"
              }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${meta.dot} ${i === activeIndex ? "opacity-100" : "opacity-40"}`} />
            <span className="truncate max-w-[4rem]">{f.name}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── New funnel form ──────────────────────────────────────────────────────────

const FUNNEL_TYPES = [
  { value: "investor", label: "Investor Search" },
  { value: "job", label: "Job Search" },
  { value: "partner", label: "Partnership" },
  { value: "custom", label: "Custom" },
];

function NewFunnelForm({ onCreated, onClose }: { onCreated: (f: Funnel) => void; onClose: () => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("custom");
  const [desc, setDesc] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) { toast.error("Name required"); return; }
    setCreating(true);
    try {
      const res = await fetch("/api/funnels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, type, description: desc || null }),
      });
      if (!res.ok) throw new Error();
      const funnel = await res.json();
      onCreated(funnel);
      toast.success("Funnel created");
    } catch {
      toast.error("Failed to create funnel");
    } finally {
      setCreating(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
      <div className="mx-4 sm:mx-0 mb-4 p-4 bg-slate-900/60 border border-slate-700/60 rounded-xl flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-slate-200">Create New Funnel</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Funnel name"
            className="bg-slate-800/60 border-slate-700/60 text-slate-200"
            onKeyDown={(e) => e.key === "Enter" && handleCreate()} />
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="bg-slate-800/60 border-slate-700/60 text-slate-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-700">
              {FUNNEL_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description (optional)"
          className="bg-slate-800/60 border-slate-700/60 text-slate-200" />
        <div className="flex gap-2">
          <Button onClick={handleCreate} disabled={creating} size="sm" className="bg-sky-600 hover:bg-sky-500 text-white">
            {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Create"}
          </Button>
          <Button variant="outline" size="sm" onClick={onClose} className="border-slate-700/60 text-slate-400">Cancel</Button>
        </div>
      </div>
    </motion.div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function FunnelsPage() {
  const router = useRouter();
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/funnels")
      .then((r) => r.json())
      .then((d) => setFunnels(d.funnels ?? []))
      .catch(() => toast.error("Failed to load funnels"))
      .finally(() => setLoading(false));
  }, []);

  // Track active column on scroll (mobile snap)
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || funnels.length === 0) return;
    const scrollLeft = el.scrollLeft;
    const colWidth = el.firstElementChild
      ? (el.firstElementChild as HTMLElement).offsetWidth + 12
      : 300;
    const idx = Math.round(scrollLeft / colWidth);
    setActiveIndex(Math.min(idx, funnels.length - 1));
  }, [funnels.length]);

  const scrollToIndex = useCallback((i: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const child = el.children[i] as HTMLElement | undefined;
    child?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    setActiveIndex(i);
  }, []);

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
    <div className="min-h-screen bg-[#020817] flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#020817]/95 backdrop-blur border-b border-slate-800/60 shrink-0">
        <div className="max-w-[1400px] mx-auto flex items-center gap-3 h-14 px-4 sm:px-6">
          <Button variant="ghost" size="sm" onClick={() => router.back()}
            className="text-slate-400 hover:text-slate-200 gap-1.5 -ml-2 px-2">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline text-xs">Back</span>
          </Button>
          <div className="flex items-center gap-1.5 border-l border-slate-800/60 pl-3">
            <Anchor className="text-sky-400 w-3.5 h-3.5" />
            <span className="text-slate-400 text-xs font-bold tracking-widest uppercase">Funnels</span>
          </div>
          <span className="text-slate-700 text-xs hidden sm:inline">
            {funnels.length} funnel{funnels.length !== 1 ? "s" : ""} · {funnels.reduce((s, f) => s + f.items.length, 0)} leads
          </span>
          <div className="flex-1" />
          <Button size="sm" onClick={() => setShowNew(true)}
            className="bg-sky-600 hover:bg-sky-500 text-white gap-1.5 text-xs">
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Funnel</span>
            <span className="sm:hidden">New</span>
          </Button>
        </div>
      </header>

      {/* New funnel form */}
      <AnimatePresence>
        {showNew && (
          <NewFunnelForm
            onCreated={(f) => { setFunnels((p) => [...p, f]); setShowNew(false); }}
            onClose={() => setShowNew(false)}
          />
        )}
      </AnimatePresence>

      {/* Loading */}
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-slate-600" />
        </div>
      )}

      {/* Empty state */}
      {!loading && funnels.length === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
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

      {/* Kanban board — horizontal scroll + snap on mobile */}
      {!loading && funnels.length > 0 && (
        <div className="flex-1 min-h-0">
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex gap-3 px-4 sm:px-6 py-4 overflow-x-auto
                       snap-x snap-mandatory sm:snap-none
                       scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-800
                       max-w-[1400px] mx-auto h-full pb-20 sm:pb-4"
          >
            {funnels.map((funnel) => (
              <motion.div key={funnel.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2 }}>
                <FunnelColumn
                  funnel={funnel}
                  onDelete={() => handleDelete(funnel.id)}
                  onItemRemoved={(itemId) => handleItemRemoved(funnel.id, itemId)}
                  onItemImported={(item) => handleItemImported(funnel.id, item)}
                />
              </motion.div>
            ))}

            {/* Add column placeholder */}
            <button
              onClick={() => setShowNew(true)}
              className="w-[85vw] sm:w-80 shrink-0 snap-center rounded-xl border-2 border-dashed border-slate-800/60
                         hover:border-slate-700/60 hover:bg-slate-900/30
                         flex flex-col items-center justify-center gap-2 min-h-[12rem] transition-all"
            >
              <Plus className="w-5 h-5 text-slate-700" />
              <span className="text-xs text-slate-600 font-medium">Add funnel</span>
            </button>
          </div>
        </div>
      )}

      {/* Mobile pill navigation */}
      <PillNav funnels={funnels} activeIndex={activeIndex} onSelect={scrollToIndex} />
    </div>
  );
}
