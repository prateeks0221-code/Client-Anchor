"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ExternalLink,
  Mail,
  Phone,
  MapPin,
  User,
  Briefcase,
  Building2,
  Globe,
  Navigation,
  ChevronRight,
  DollarSign,
  Link2,
  GripVertical,
  Check,
  ChevronDown,
  Filter,
} from "lucide-react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent } from "@/components/ui/card";
import { DashboardResult } from "@/types";
import { ResultDetail } from "@/components/ResultDetail";

// ── Score badge ──────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  const cls =
    score >= 80
      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/25"
      : score >= 60
      ? "bg-sky-500/15 text-sky-300 border-sky-500/25"
      : score >= 40
      ? "bg-amber-500/15 text-amber-300 border-amber-500/25"
      : "bg-slate-700/30 text-slate-400 border-slate-600/20";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono border font-semibold ${cls}`}>
      {score}%
    </span>
  );
}

// ── Type badge ───────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  job: {
    label: "Job",
    cls: "bg-purple-500/10 text-purple-300 border-purple-500/20",
    icon: <Briefcase className="w-3 h-3" />,
  },
  person: {
    label: "Person",
    cls: "bg-teal-500/10 text-teal-300 border-teal-500/20",
    icon: <User className="w-3 h-3" />,
  },
  business: {
    label: "Business",
    cls: "bg-sky-500/10 text-sky-300 border-sky-500/20",
    icon: <Building2 className="w-3 h-3" />,
  },
  corporation: {
    label: "Corp",
    cls: "bg-blue-500/10 text-blue-300 border-blue-500/20",
    icon: <Building2 className="w-3 h-3" />,
  },
};

function TypeBadge({ type }: { type?: string | null }) {
  if (!type) return null;
  const cfg = TYPE_CONFIG[type.toLowerCase()] ?? {
    label: type,
    cls: "bg-slate-700/20 text-slate-400 border-slate-600/20",
    icon: null,
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border font-medium ${cfg.cls}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

// ── Maps URL ─────────────────────────────────────────────────────────────────

function getMapsUrl(enrichment: Record<string, unknown>): string | null {
  const { placeId, lat, lng, mapsUrl, address } = enrichment as Record<string, any>;
  if (mapsUrl) return mapsUrl as string;
  if (placeId) return `https://www.google.com/maps/place/?q=place_id:${placeId}`;
  if (lat && lng) return `https://maps.google.com/?q=${lat},${lng}`;
  if (address) return `https://maps.google.com/?q=${encodeURIComponent(address as string)}`;
  return null;
}

// ── Funnel selector dropdown ─────────────────────────────────────────────────

interface FunnelSelectorProps {
  funnels: Array<{ id: string; name: string; type: string }>;
  funnelledFunnelIds: string[];
  onAdd: (funnelId: string) => void;
}

function FunnelSelector({ funnels, funnelledFunnelIds, onAdd }: FunnelSelectorProps) {
  const [open, setOpen] = useState(false);

  if (funnels.length === 0) return null;

  const allIn = funnels.every((f) => funnelledFunnelIds.includes(f.id));

  return (
    <div className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        title="Add to funnel"
        className={`flex items-center gap-1 text-xs transition-colors px-1.5 py-0.5 rounded ${
          allIn
            ? "text-emerald-400 bg-emerald-500/10"
            : "text-slate-500 hover:text-sky-300 hover:bg-sky-500/10"
        }`}
      >
        <Filter className="w-3 h-3" />
        {allIn ? <Check className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.97 }}
              transition={{ duration: 0.12 }}
              className="absolute bottom-full right-0 mb-1.5 w-48 bg-slate-900 border border-slate-700/60 rounded-xl shadow-xl z-50 overflow-hidden"
            >
              <p className="px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-widest border-b border-slate-800">
                Add to funnel
              </p>
              {funnels.map((f) => {
                const added = funnelledFunnelIds.includes(f.id);
                return (
                  <button
                    key={f.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!added) onAdd(f.id);
                      setOpen(false);
                    }}
                    disabled={added}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-xs transition-colors ${
                      added
                        ? "text-emerald-400 cursor-default"
                        : "text-slate-300 hover:bg-slate-800/60 hover:text-sky-300"
                    }`}
                  >
                    <span className="truncate">{f.name}</span>
                    {added && <Check className="w-3 h-3 shrink-0" />}
                  </button>
                );
              })}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── ResultCard ───────────────────────────────────────────────────────────────

interface FunnelRef {
  id: string;
  name: string;
  type: string;
  items: Array<{ resultId: string; funnelId?: string }>;
}

interface Props {
  result: DashboardResult;
  index: number;
  funnels?: FunnelRef[];
  onAddToFunnel?: (funnelId: string, resultId: string) => void;
}

export function ResultCard({ result, index, funnels = [], onAddToFunnel }: Props) {
  const [detailOpen, setDetailOpen] = useState(false);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: result.id,
    data: { resultId: result.id, title: result.title },
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  const e = result.enrichment as Record<string, any>;
  const type = (e.type as string | undefined)?.toLowerCase();
  const email = e.email as string | null | undefined;
  const phone = e.phone as string | null | undefined;
  const address = e.address as string | null | undefined;
  const mapsUrl = getMapsUrl(result.enrichment);

  // Job-specific
  const applyUrl = (e.applyUrl || e.apply_url) as string | undefined;
  const salary = e.salaryMin || e.salaryMax
    ? [e.salaryMin && `£${Math.round(e.salaryMin / 1000)}k`, e.salaryMax && `£${Math.round(e.salaryMax / 1000)}k`]
        .filter(Boolean).join(" – ")
    : null;
  const company = e.company as string | undefined;

  // Business-specific
  const rating = e.rating as number | undefined;
  const reviewCount = e.userRatingCount as number | undefined;

  const primaryContact =
    result.contacts?.find((c) => c.isPrimary) ?? result.contacts?.[0] ?? null;
  const primaryUrl = type === "job" ? (applyUrl || result.url) : result.url;

  // Funnel state for this result
  const funnelledFunnelIds = funnels
    .filter((f) => f.items.some((item) => item.resultId === result.id))
    .map((f) => f.id);
  const isFunnelled = funnelledFunnelIds.length > 0;

  return (
    <>
      <motion.div
        ref={setNodeRef}
        style={style}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: isDragging ? 0.4 : 1, y: 0 }}
        transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.5) }}
        className={`h-full ${isDragging ? "z-50" : ""}`}
      >
        <Card className={`bg-slate-900/60 border-slate-700/60 hover:border-sky-500/30 transition-all duration-200 group h-full flex flex-col ${
          isFunnelled ? "ring-1 ring-emerald-500/25 border-emerald-500/20" : ""
        }`}>
          <CardContent className="pt-5 pb-4 px-5 flex flex-col gap-3 flex-1">
            {/* Header: drag handle + title + score */}
            <div className="flex items-start gap-2">
              {/* Drag handle */}
              <button
                {...listeners}
                {...attributes}
                className="mt-0.5 text-slate-700 hover:text-slate-400 cursor-grab active:cursor-grabbing transition-colors shrink-0"
                title="Drag to funnel"
              >
                <GripVertical className="w-3.5 h-3.5" />
              </button>
              <div className="flex items-start justify-between gap-3 flex-1 min-w-0">
                <button
                  onClick={() => setDetailOpen(true)}
                  className="flex-1 text-left text-slate-50 font-semibold text-sm leading-snug line-clamp-2 group-hover:text-sky-300 transition-colors hover:text-sky-300"
                >
                  {result.title}
                </button>
                <div className="flex items-center gap-1.5 shrink-0">
                  {isFunnelled && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                      <Check className="w-2.5 h-2.5" />
                      Funnelled
                    </span>
                  )}
                  {result.score > 0 && <ScoreBadge score={result.score} />}
                </div>
              </div>
            </div>

            {/* Type + source */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <TypeBadge type={type} />
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border bg-slate-800/60 text-slate-500 border-slate-700/40 font-mono">
                <Globe className="w-3 h-3" />
                {result.source}
              </span>
            </div>

            {/* Job: company + salary */}
            {type === "job" && (company || salary) && (
              <div className="flex flex-wrap items-center gap-2">
                {company && (
                  <span className="flex items-center gap-1 text-xs text-slate-400">
                    <Building2 className="w-3 h-3 text-slate-600" />
                    {company}
                  </span>
                )}
                {salary && (
                  <span className="flex items-center gap-1 text-xs text-emerald-400 font-mono font-semibold">
                    <DollarSign className="w-3 h-3" />
                    {salary}
                  </span>
                )}
              </div>
            )}

            {/* Business: rating */}
            {type !== "job" && rating !== undefined && (
              <div className="flex items-center gap-1.5">
                <span className="text-amber-400 text-xs font-semibold">★ {rating.toFixed(1)}</span>
                {reviewCount && (
                  <span className="text-slate-600 text-xs">({reviewCount.toLocaleString()})</span>
                )}
              </div>
            )}

            {/* Description */}
            {result.description && (
              <p className="text-slate-400 text-xs leading-relaxed line-clamp-2">
                {result.description}
              </p>
            )}

            {/* Contact row */}
            <div className="flex flex-col gap-1">
              {email && (
                <a href={`mailto:${email}`} className="flex items-center gap-2 text-xs text-slate-400 hover:text-sky-300 transition-colors min-w-0">
                  <Mail className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                  <span className="truncate">{email}</span>
                </a>
              )}
              {phone && (
                <a href={`tel:${phone}`} className="flex items-center gap-2 text-xs text-slate-400 hover:text-sky-300 transition-colors">
                  <Phone className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                  {phone}
                </a>
              )}
              {address && (
                <span className="flex items-center gap-2 text-xs text-slate-500">
                  <MapPin className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                  <span className="truncate">{address}</span>
                </span>
              )}
            </div>

            {/* Primary contact */}
            {primaryContact && (
              <div className="border-t border-slate-800/60 pt-2.5">
                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 rounded-full bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0">
                    <User className="w-3 h-3 text-sky-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-slate-300 text-xs font-medium truncate">{primaryContact.name}</p>
                    {primaryContact.title && <p className="text-slate-600 text-xs truncate">{primaryContact.title}</p>}
                    <div className="flex items-center gap-2 mt-0.5">
                      {primaryContact.email && (
                        <a href={`mailto:${primaryContact.email}`} className="text-sky-400/80 text-xs hover:text-sky-300 truncate">
                          {primaryContact.email}
                        </a>
                      )}
                      {primaryContact.linkedin && (
                        <a href={primaryContact.linkedin} target="_blank" rel="noopener noreferrer" className="text-blue-400/70 hover:text-blue-300">
                          <Link2 className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="mt-auto pt-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {mapsUrl && type !== "job" && (
                  <a href={mapsUrl} target="_blank" rel="noopener noreferrer" title="Open in Google Maps"
                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-sky-300 transition-colors">
                    <Navigation className="w-3.5 h-3.5" />
                  </a>
                )}
                {primaryUrl ? (
                  <a href={primaryUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 transition-colors font-medium">
                    {type === "job" ? (
                      <><Briefcase className="w-3 h-3" /> Apply</>
                    ) : (
                      <><ExternalLink className="w-3 h-3" /> Visit</>
                    )}
                  </a>
                ) : null}
              </div>

              <div className="flex items-center gap-2 ml-auto">
                {/* Funnel selector */}
                {onAddToFunnel && funnels.length > 0 && (
                  <FunnelSelector
                    funnels={funnels}
                    funnelledFunnelIds={funnelledFunnelIds}
                    onAdd={(funnelId) => onAddToFunnel(funnelId, result.id)}
                  />
                )}
                <button
                  onClick={() => setDetailOpen(true)}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-sky-300 transition-colors"
                >
                  Details <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {detailOpen && (
        <ResultDetail result={result} onClose={() => setDetailOpen(false)} />
      )}
    </>
  );
}
