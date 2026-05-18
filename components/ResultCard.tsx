"use client";

import { useState } from "react";
import { motion } from "framer-motion";
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
} from "lucide-react";
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

// ── ResultCard ───────────────────────────────────────────────────────────────

interface Props {
  result: DashboardResult;
  index: number;
}

export function ResultCard({ result, index }: Props) {
  const [detailOpen, setDetailOpen] = useState(false);

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

  // Contact from Contact model
  const primaryContact =
    result.contacts?.find((c) => c.isPrimary) ?? result.contacts?.[0] ?? null;

  // Action URL: website for business, apply for job
  const primaryUrl = type === "job" ? (applyUrl || result.url) : result.url;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.5) }}
        className="h-full"
      >
        <Card className="bg-slate-900/60 border-slate-700/60 hover:border-sky-500/30 transition-all duration-200 group h-full flex flex-col">
          <CardContent className="pt-5 pb-4 px-5 flex flex-col gap-3 flex-1">
            {/* Header: title + score */}
            <div className="flex items-start justify-between gap-3">
              <button
                onClick={() => setDetailOpen(true)}
                className="flex-1 text-left text-slate-50 font-semibold text-sm leading-snug line-clamp-2 group-hover:text-sky-300 transition-colors hover:text-sky-300"
              >
                {result.title}
              </button>
              {result.score > 0 && <ScoreBadge score={result.score} />}
            </div>

            {/* Type + source */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <TypeBadge type={type} />
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border bg-slate-800/60 text-slate-500 border-slate-700/40 font-mono">
                <Globe className="w-3 h-3" />
                {result.source}
              </span>
            </div>

            {/* Job: company + salary snippet */}
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

            {/* Business: rating snippet */}
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

            {/* Quick contact row */}
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

            {/* Primary contact (Contact model) */}
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

            {/* Footer actions */}
            <div className="mt-auto pt-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {/* Maps pin — business only */}
                {mapsUrl && type !== "job" && (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Open in Google Maps"
                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-sky-300 transition-colors"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                  </a>
                )}

                {/* Primary link */}
                {primaryUrl ? (
                  <a
                    href={primaryUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 transition-colors font-medium"
                  >
                    {type === "job" ? (
                      <><Briefcase className="w-3 h-3" /> Apply</>
                    ) : (
                      <><ExternalLink className="w-3 h-3" /> Visit</>
                    )}
                  </a>
                ) : null}
              </div>

              {/* Expand button */}
              <button
                onClick={() => setDetailOpen(true)}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-sky-300 transition-colors ml-auto"
              >
                Details <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Detail modal */}
      {detailOpen && (
        <ResultDetail result={result} onClose={() => setDetailOpen(false)} />
      )}
    </>
  );
}
