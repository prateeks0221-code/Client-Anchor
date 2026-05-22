"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useDroppable } from "@dnd-kit/core";
import {
  ChevronDown,
  Plus,
  Trash2,
  Loader2,
  Maximize2,
  GripVertical,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

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

interface Props {
  funnels: Funnel[];
  onFunnelsChange: (funnels: Funnel[]) => void;
  onAddToFunnel: (funnelId: string, resultId: string) => void;
  onRemoveFromFunnel: (funnelId: string, itemId: string) => void;
  topOffset?: string;
  activeDragId?: string | null;
}

const FUNNEL_TYPES = [
  { value: "investor", label: "Investor Search" },
  { value: "job", label: "Job Search" },
  { value: "partner", label: "Partnership" },
  { value: "custom", label: "Custom" },
];

// ── Per-funnel droppable zone ────────────────────────────────────────────────

function DroppableFunnel({
  funnel,
  expanded,
  onToggle,
  onDelete,
  onRemoveItem,
  activeDragId,
}: {
  funnel: Funnel;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onRemoveItem: (itemId: string) => void;
  activeDragId?: string | null;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: funnel.id });
  const isDragging = !!activeDragId;

  const alreadyInFunnel = activeDragId
    ? funnel.items.some((i) => i.resultId === activeDragId)
    : false;

  return (
    <div
      ref={setNodeRef}
      className={`px-3 py-2.5 flex flex-col gap-2 transition-all rounded-lg mx-1.5 my-1 border ${
        isDragging && !alreadyInFunnel
          ? isOver
            ? "border-sky-500/60 bg-sky-500/10"
            : "border-dashed border-slate-600/60 bg-slate-800/20"
          : alreadyInFunnel && isDragging
          ? "border-dashed border-emerald-500/40 bg-emerald-500/5"
          : "border-transparent"
      }`}
    >
      {/* Funnel header */}
      <button
        onClick={onToggle}
        className="flex items-center justify-between gap-2 group"
      >
        <div className="flex-1 text-left">
          <p className="text-xs font-semibold text-slate-200 group-hover:text-slate-100 truncate">
            {funnel.name}
          </p>
          <p className="text-[10px] text-slate-600 mt-0.5">
            {funnel.type} · {funnel.items.length} item{funnel.items.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isDragging && !alreadyInFunnel && (
            <span className="text-[9px] text-sky-400 font-medium">Drop here</span>
          )}
          {isDragging && alreadyInFunnel && (
            <span className="text-[9px] text-emerald-400 font-medium">Added</span>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-red-400 transition-all"
            title="Delete funnel"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </button>

      {/* Items */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex flex-col gap-1 pt-1 border-t border-slate-700/40"
          >
            {funnel.items.length === 0 ? (
              <p className="text-[10px] text-slate-600 italic py-1">
                {isDragging ? "↓ Drop card here" : "Drag result cards here"}
              </p>
            ) : (
              funnel.items.map((item) => (
                <div
                  key={item.id}
                  className="p-1.5 rounded-lg bg-slate-800/40 border border-slate-700/40 flex items-start justify-between gap-2 group/item"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-medium text-slate-300 truncate">
                      {item.result.name}
                    </p>
                    {item.result.email && (
                      <p className="text-[9px] text-slate-600 truncate">{item.result.email}</p>
                    )}
                  </div>
                  <button
                    onClick={() => onRemoveItem(item.id)}
                    className="p-0.5 rounded opacity-0 group-hover/item:opacity-100 hover:bg-red-500/10 text-red-400 transition-all shrink-0"
                  >
                    <Trash2 className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── FunnelPanel ──────────────────────────────────────────────────────────────

export default function FunnelPanel({
  funnels,
  onFunnelsChange,
  onAddToFunnel,
  onRemoveFromFunnel,
  topOffset = "top-14",
  activeDragId,
}: Props) {
  const router = useRouter();
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("custom");
  const [newDescription, setNewDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [expandedFunnel, setExpandedFunnel] = useState<string | null>(null);

  const heightClass = topOffset === "top-0" ? "h-screen" : "h-[calc(100vh-3.5rem)]";

  const handleCreateFunnel = async () => {
    if (!newName.trim()) {
      toast.error("Funnel name required");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/funnels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, type: newType, description: newDescription || null }),
      });
      if (!res.ok) throw new Error();
      const funnel = await res.json();
      onFunnelsChange([...funnels, funnel]);
      setNewName("");
      setNewType("custom");
      setNewDescription("");
      setShowNewForm(false);
      toast.success("Funnel created");
    } catch {
      toast.error("Failed to create funnel");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteFunnel = async (id: string) => {
    try {
      const res = await fetch(`/api/funnels/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      onFunnelsChange(funnels.filter((f) => f.id !== id));
      toast.success("Funnel deleted");
    } catch {
      toast.error("Failed to delete funnel");
    }
  };

  const handleRemoveItem = async (funnelId: string, itemId: string) => {
    try {
      const res = await fetch(`/api/funnels/${funnelId}/items/${itemId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      onRemoveFromFunnel(funnelId, itemId);
      toast.success("Removed from funnel");
    } catch {
      toast.error("Failed to remove item");
    }
  };

  return (
    <div className={`fixed right-0 ${topOffset} ${heightClass} w-72 bg-slate-900/95 border-l border-slate-700/60 z-20 flex flex-col`}>
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-slate-700/60 flex items-center justify-between shrink-0">
        <span className="text-xs font-semibold text-slate-300">Funnels</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowNewForm(!showNewForm)}
            className="p-1 rounded-lg hover:bg-sky-500/10 text-sky-400 transition-colors"
            title="New funnel"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => router.push("/funnels")}
            className="p-1 rounded-lg hover:bg-slate-700/60 text-slate-500 hover:text-slate-300 transition-colors"
            title="Open full funnels page"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* New funnel form */}
      <AnimatePresence>
        {showNewForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="border-b border-slate-700/60 bg-slate-800/30 flex flex-col gap-2 px-3 py-3 shrink-0 overflow-hidden"
          >
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Funnel name"
              className="h-7 text-xs bg-slate-800/60 border-slate-600/60"
              onKeyDown={(e) => e.key === "Enter" && handleCreateFunnel()}
            />
            <Select value={newType} onValueChange={setNewType}>
              <SelectTrigger className="h-7 text-xs bg-slate-800/60 border-slate-600/60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700">
                {FUNNEL_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Description (optional)"
              className="px-2 py-1 text-xs rounded-lg bg-slate-800/60 border border-slate-600/60 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-sky-500/40"
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreateFunnel}
                disabled={creating}
                className="flex-1 px-2 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition-colors disabled:opacity-50"
              >
                {creating ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : "Create"}
              </button>
              <button
                onClick={() => setShowNewForm(false)}
                className="flex-1 px-2 py-1 rounded-lg border border-slate-600/60 text-slate-400 hover:text-slate-200 text-xs transition-colors"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Drag hint */}
      {activeDragId && (
        <div className="px-3 py-1.5 text-[10px] text-sky-400 bg-sky-500/5 border-b border-sky-500/20 text-center">
          Drop onto a funnel below
        </div>
      )}

      {/* Funnel list */}
      <div className="flex-1 overflow-y-auto">
        {funnels.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-xs text-slate-600 mb-1">No funnels yet</p>
            <p className="text-[10px] text-slate-700">Click + to create one</p>
          </div>
        ) : (
          <div className="py-1">
            {funnels.map((funnel) => (
              <DroppableFunnel
                key={funnel.id}
                funnel={funnel}
                expanded={expandedFunnel === funnel.id}
                onToggle={() => setExpandedFunnel(expandedFunnel === funnel.id ? null : funnel.id)}
                onDelete={() => handleDeleteFunnel(funnel.id)}
                onRemoveItem={(itemId) => handleRemoveItem(funnel.id, itemId)}
                activeDragId={activeDragId}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer link */}
      <div className="px-3 py-2 border-t border-slate-700/60 shrink-0">
        <button
          onClick={() => router.push("/funnels")}
          className="w-full text-center text-[10px] text-slate-600 hover:text-slate-400 transition-colors"
        >
          Manage all funnels →
        </button>
      </div>
    </div>
  );
}
