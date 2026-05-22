"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Loader2, Anchor, MapPin, DollarSign, SlidersHorizontal, History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DndContext, DragOverlay, closestCenter } from "@dnd-kit/core";
import FunnelPanel from "@/components/FunnelPanel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

type OpportunityType = "business" | "job" | "partnership" | "";

interface SearchFilters {
  location: string;
  budgetMin: string;
  budgetMax: string;
  opportunityType: OpportunityType;
  // business
  industries: string;
  // job
  workType: string;
  roleLevel: string;
  // partnership
  companySize: string;
}

const DEFAULT_FILTERS: SearchFilters = {
  location: "",
  budgetMin: "",
  budgetMax: "",
  opportunityType: "",
  industries: "",
  workType: "",
  roleLevel: "",
  companySize: "",
};

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [prompt, setPrompt] = useState(searchParams.get("q") ?? "");
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [loading, setLoading] = useState(false);
  const [funnels, setFunnels] = useState<Funnel[]>([]);

  const setFilter = <K extends keyof SearchFilters>(
    key: K,
    value: SearchFilters[K]
  ) => setFilters((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    fetch("/api/funnels")
      .then((r) => r.json())
      .then((d) => setFunnels(d.funnels ?? []))
      .catch((err) => console.error("Failed to fetch funnels:", err));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!prompt.trim()) {
      toast.error("Describe what you're looking for first.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        prompt: prompt.trim(),
        filters: {
          location: filters.location || undefined,
          budgetMin: filters.budgetMin ? Number(filters.budgetMin) : undefined,
          budgetMax: filters.budgetMax ? Number(filters.budgetMax) : undefined,
          opportunityType: filters.opportunityType || undefined,
          industries:
            filters.opportunityType === "business"
              ? filters.industries
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
              : undefined,
          workType:
            filters.opportunityType === "job" ? filters.workType || undefined : undefined,
          roleLevel:
            filters.opportunityType === "job" ? filters.roleLevel || undefined : undefined,
          companySize:
            filters.opportunityType === "partnership"
              ? filters.companySize || undefined
              : undefined,
        },
      };

      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || `Server error ${res.status}`);
      }

      const data = await res.json();
      router.push(`/dashboard/${data.id}`);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Something went wrong.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const labelCls = "block text-xs font-medium text-slate-400 mb-1.5 tracking-wide";

  const activeFiltersCount = [
    filters.location,
    filters.budgetMin,
    filters.budgetMax,
    filters.opportunityType,
    filters.industries,
    filters.workType,
    filters.roleLevel,
    filters.companySize,
  ].filter(Boolean).length;

  return (
    <DndContext collisionDetection={closestCenter}>
      <main className="relative min-h-screen flex flex-col items-center justify-center px-4 py-16 overflow-hidden bg-[#020817] pr-80">
      {/* Multi-layer atmospheric glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-sky-600/8 blur-[120px]" />
        <div className="absolute top-1/3 left-1/3 h-[300px] w-[400px] rounded-full bg-cyan-500/6 blur-[80px]" />
        <div className="absolute bottom-1/4 right-1/4 h-[200px] w-[300px] rounded-full bg-blue-600/5 blur-[60px]" />
      </div>

      {/* Subtle grid overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `linear-gradient(rgba(148,163,184,1) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,1) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      <div className="relative w-full max-w-2xl">
        {/* Logo / brand */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center gap-2.5 mb-10 justify-center"
        >
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20">
            <Anchor className="text-sky-400 w-4 h-4" />
          </div>
          <span className="text-slate-400 text-xs font-bold tracking-[0.2em] uppercase">
            ClientAnchor
          </span>
          <button
            onClick={() => router.push("/hub")}
            className="ml-4 flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-700/60 text-slate-500 hover:text-slate-300 hover:border-slate-600/40 text-xs transition-colors"
          >
            <History className="w-3.5 h-3.5" />
            History
          </button>
        </motion.div>

        {/* Hero heading */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <h1 className="text-4xl sm:text-5xl font-bold text-center tracking-tight mb-4 leading-tight">
            <span className="text-slate-50">Anchor Your </span>
            <span className="bg-gradient-to-r from-sky-400 via-cyan-300 to-blue-400 bg-clip-text text-transparent">
              Next Opportunity
            </span>
          </h1>
          <p className="text-center text-slate-500 text-sm mb-10 max-w-md mx-auto leading-relaxed">
            Describe what you need. AI finds matching businesses, roles, and
            partners — scored and enriched with contact data.
          </p>
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          onSubmit={handleSubmit}
          className="flex flex-col gap-4"
        >
          {/* Main prompt — gradient border on focus via ring */}
          <div className="relative">
            <Textarea
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the business, role, or partnership you're looking for..."
              className="w-full resize-none bg-slate-900/80 border-slate-700/80 text-slate-100 placeholder:text-slate-600 focus-visible:ring-sky-500/50 focus-visible:border-sky-500/50 text-sm leading-relaxed py-4 px-5 rounded-xl"
              disabled={loading}
            />
            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-sky-500/5 to-cyan-500/5 pointer-events-none" />
          </div>

          {/* Filter Card */}
          <Card className="border-slate-700/60 bg-slate-900/50 backdrop-blur-sm rounded-xl">
            <CardHeader className="pb-3 pt-4 px-5">
              <CardTitle className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-widest">
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Filters
                {activeFiltersCount > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-auto text-xs bg-sky-500/10 text-sky-400 border-sky-500/20 font-mono"
                  >
                    {activeFiltersCount} active
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 flex flex-col gap-4">
              {/* Row 1: Location */}
              <div>
                <label className={labelCls}>
                  <MapPin className="inline w-3 h-3 mr-1 opacity-70" />
                  Location
                </label>
                <Input
                  type="text"
                  value={filters.location}
                  onChange={(e) => setFilter("location", e.target.value)}
                  placeholder="City, Country or Remote"
                  className="bg-slate-800/60 border-slate-700/60 text-slate-100 placeholder:text-slate-600 focus-visible:ring-sky-500/40 focus-visible:border-sky-500/40"
                  disabled={loading}
                />
              </div>

              {/* Row 2: Budget */}
              <div>
                <label className={labelCls}>
                  <DollarSign className="inline w-3 h-3 mr-1 opacity-70" />
                  Budget (USD)
                </label>
                <div className="flex gap-3">
                  <Input
                    type="number"
                    value={filters.budgetMin}
                    onChange={(e) => setFilter("budgetMin", e.target.value)}
                    placeholder="Min"
                    min={0}
                    className="bg-slate-800/60 border-slate-700/60 text-slate-100 placeholder:text-slate-600 focus-visible:ring-sky-500/40"
                    disabled={loading}
                  />
                  <Input
                    type="number"
                    value={filters.budgetMax}
                    onChange={(e) => setFilter("budgetMax", e.target.value)}
                    placeholder="Max"
                    min={0}
                    className="bg-slate-800/60 border-slate-700/60 text-slate-100 placeholder:text-slate-600 focus-visible:ring-sky-500/40"
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Row 3: Opportunity type */}
              <div>
                <label className={labelCls}>Opportunity Type</label>
                <Select
                  value={filters.opportunityType}
                  onValueChange={(v) =>
                    setFilter("opportunityType", v as OpportunityType)
                  }
                  disabled={loading}
                >
                  <SelectTrigger className="bg-slate-800/60 border-slate-700/60 text-slate-100 focus:ring-sky-500/40">
                    <SelectValue placeholder="— Select type —" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700">
                    <SelectItem value="business" className="text-slate-200 focus:bg-slate-800 focus:text-sky-400">
                      Business Lead
                    </SelectItem>
                    <SelectItem value="job" className="text-slate-200 focus:bg-slate-800 focus:text-sky-400">
                      Job Search
                    </SelectItem>
                    <SelectItem value="partnership" className="text-slate-200 focus:bg-slate-800 focus:text-sky-400">
                      Partnership
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Conditional: Business */}
              {filters.opportunityType === "business" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <label className={labelCls}>Industries (comma separated)</label>
                  <Input
                    type="text"
                    value={filters.industries}
                    onChange={(e) => setFilter("industries", e.target.value)}
                    placeholder="e.g. SaaS, Fintech, Healthcare"
                    className="bg-slate-800/60 border-slate-700/60 text-slate-100 placeholder:text-slate-600 focus-visible:ring-sky-500/40"
                    disabled={loading}
                  />
                  {filters.industries && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {filters.industries
                        .split(",")
                        .map((t) => t.trim())
                        .filter(Boolean)
                        .map((tag) => (
                          <Badge
                            key={tag}
                            variant="secondary"
                            className="text-xs bg-sky-500/10 text-sky-300 border-sky-500/20"
                          >
                            {tag}
                          </Badge>
                        ))}
                    </div>
                  )}
                </motion.div>
              )}

              {/* Conditional: Job */}
              {filters.opportunityType === "job" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="flex gap-3"
                >
                  <div className="flex-1">
                    <label className={labelCls}>Work Type</label>
                    <Select
                      value={filters.workType}
                      onValueChange={(v) => setFilter("workType", v)}
                      disabled={loading}
                    >
                      <SelectTrigger className="bg-slate-800/60 border-slate-700/60 text-slate-100 focus:ring-sky-500/40">
                        <SelectValue placeholder="Any" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-700">
                        {["remote", "hybrid", "onsite"].map((v) => (
                          <SelectItem key={v} value={v} className="text-slate-200 focus:bg-slate-800 focus:text-sky-400 capitalize">
                            {v.charAt(0).toUpperCase() + v.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1">
                    <label className={labelCls}>Role Level</label>
                    <Select
                      value={filters.roleLevel}
                      onValueChange={(v) => setFilter("roleLevel", v)}
                      disabled={loading}
                    >
                      <SelectTrigger className="bg-slate-800/60 border-slate-700/60 text-slate-100 focus:ring-sky-500/40">
                        <SelectValue placeholder="Any" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-700">
                        {["junior", "mid", "senior", "lead", "executive"].map((v) => (
                          <SelectItem key={v} value={v} className="text-slate-200 focus:bg-slate-800 focus:text-sky-400 capitalize">
                            {v.charAt(0).toUpperCase() + v.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </motion.div>
              )}

              {/* Conditional: Partnership */}
              {filters.opportunityType === "partnership" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                >
                  <label className={labelCls}>Company Size</label>
                  <Select
                    value={filters.companySize}
                    onValueChange={(v) => setFilter("companySize", v)}
                    disabled={loading}
                  >
                    <SelectTrigger className="bg-slate-800/60 border-slate-700/60 text-slate-100 focus:ring-sky-500/40">
                      <SelectValue placeholder="Any size" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-700">
                      {[
                        { value: "startup", label: "Startup" },
                        { value: "smb", label: "SMB" },
                        { value: "enterprise", label: "Enterprise" },
                      ].map(({ value, label }) => (
                        <SelectItem key={value} value={value} className="text-slate-200 focus:bg-slate-800 focus:text-sky-400">
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </motion.div>
              )}
            </CardContent>
          </Card>

          {/* Submit — gradient bg, framer scale */}
          <motion.div
            whileHover={{ scale: loading ? 1 : 1.015 }}
            whileTap={{ scale: loading ? 1 : 0.985 }}
          >
            <Button
              type="submit"
              disabled={loading}
              className="w-full py-6 rounded-xl text-base font-semibold tracking-wide bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-500 hover:to-cyan-500 text-white border-0 shadow-lg shadow-sky-900/30 transition-all"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin mr-2.5" />
                  Anchoring search...
                </>
              ) : (
                <>
                  <Anchor className="w-5 h-5 mr-2.5" />
                  ANCHOR SEARCH
                </>
              )}
            </Button>
          </motion.div>
        </motion.form>

        {/* Footer trust line */}
        <p className="text-center text-slate-700 text-xs mt-8">
          Powered by AI · Real-world data · Enriched contacts
        </p>
      </div>
      <FunnelPanel
        funnels={funnels}
        onFunnelsChange={setFunnels}
        onAddToFunnel={() => {}}
        onRemoveFromFunnel={() => {}}
        topOffset="top-0"
      />
      <DragOverlay />
    </main>
    </DndContext>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <HomeContent />
    </Suspense>
  );
}
