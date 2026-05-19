"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ExternalLink,
  Mail,
  Phone,
  MapPin,
  Globe,
  Star,
  Users,
  Briefcase,
  Building2,
  User,
  DollarSign,
  Clock,
  Calendar,
  Link2,
  Navigation,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Tag,
  Sparkles,
  Loader2,
  Send,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DashboardContact, DashboardResult } from "@/types";
import { OutreachEngine } from "@/components/OutreachEngine";

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatSalary(min?: number, max?: number, predicted?: boolean): string | null {
  if (!min && !max) return null;
  const fmt = (n: number) =>
    n >= 1000 ? `£${(n / 1000).toFixed(0)}k` : `£${n}`;
  const range = min && max ? `${fmt(min)} – ${fmt(max)}` : min ? `from ${fmt(min)}` : `up to ${fmt(max!)}`;
  return predicted ? `~${range} (est.)` : range;
}

function mapsUrlFromEnrichment(enrichment: DashboardResult["enrichment"], title: string): string | null {
  const { placeId, lat, lng, mapsUrl } = enrichment as Record<string, any>;
  if (mapsUrl) return mapsUrl as string;
  if (placeId) return `https://www.google.com/maps/place/?q=place_id:${placeId}`;
  if (lat && lng) return `https://maps.google.com/?q=${lat},${lng}`;
  const addr = enrichment.address as string | undefined;
  if (addr) return `https://maps.google.com/?q=${encodeURIComponent(addr)}`;
  return null;
}

function statusIcon(status?: string) {
  if (!status) return null;
  if (status === "OPERATIONAL") return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
  if (status === "CLOSED_TEMPORARILY") return <AlertCircle className="w-3.5 h-3.5 text-amber-400" />;
  if (status === "CLOSED_PERMANENTLY") return <XCircle className="w-3.5 h-3.5 text-red-400" />;
  return null;
}

function statusLabel(status?: string) {
  const map: Record<string, string> = {
    OPERATIONAL: "Open",
    CLOSED_TEMPORARILY: "Temporarily closed",
    CLOSED_PERMANENTLY: "Permanently closed",
  };
  return status ? (map[status] ?? status) : null;
}

// ── KPI blocks ───────────────────────────────────────────────────────────────

function KpiRow({ icon, label, value, href, mono }: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  href?: string;
  mono?: boolean;
}) {
  const valueEl = (
    <span className={`text-slate-200 text-sm ${mono ? "font-mono" : ""}`}>{value}</span>
  );
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-slate-800/60 last:border-0">
      <span className="text-slate-600 mt-0.5 shrink-0">{icon}</span>
      <span className="text-slate-500 text-xs w-24 shrink-0 mt-0.5">{label}</span>
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer"
          className="text-sky-400 hover:text-sky-300 text-sm truncate transition-colors flex items-center gap-1">
          {value} <ExternalLink className="w-3 h-3 shrink-0" />
        </a>
      ) : valueEl}
    </div>
  );
}

// ── Business / Corp KPIs ─────────────────────────────────────────────────────

function BusinessKpis({ enrichment, url }: { enrichment: DashboardResult["enrichment"]; url: string }) {
  const e = enrichment as Record<string, any>;
  const rating = e.rating as number | undefined;
  const reviewCount = e.userRatingCount as number | undefined;
  const status = e.businessStatus as string | undefined;
  const category = e.category as string | undefined;
  const mapsUrl = mapsUrlFromEnrichment(enrichment, "");

  return (
    <div className="bg-slate-800/30 rounded-xl px-4 py-1">
      {rating !== undefined && (
        <KpiRow
          icon={<Star className="w-4 h-4" />}
          label="Rating"
          value={
            <span className="flex items-center gap-1.5">
              <span className="text-amber-400 font-semibold">{rating.toFixed(1)}</span>
              <span className="text-slate-500 text-xs">/ 5</span>
              {reviewCount && (
                <span className="text-slate-500 text-xs">({reviewCount.toLocaleString()} reviews)</span>
              )}
            </span>
          }
        />
      )}
      {status && (
        <KpiRow
          icon={statusIcon(status)}
          label="Status"
          value={<span className={status === "OPERATIONAL" ? "text-emerald-400" : "text-amber-400"}>{statusLabel(status)}</span>}
        />
      )}
      {category && (
        <KpiRow icon={<Tag className="w-4 h-4" />} label="Category" value={category} />
      )}
      {url && (
        <KpiRow icon={<Globe className="w-4 h-4" />} label="Website" value={url} href={url} />
      )}
      {e.phone && (
        <KpiRow icon={<Phone className="w-4 h-4" />} label="Phone" value={e.phone as string} href={`tel:${e.phone}`} />
      )}
      {e.address && (
        <KpiRow icon={<MapPin className="w-4 h-4" />} label="Address" value={e.address as string} />
      )}
      {mapsUrl && (
        <KpiRow
          icon={<Navigation className="w-4 h-4" />}
          label="Maps"
          value="Open in Google Maps"
          href={mapsUrl}
        />
      )}
    </div>
  );
}

// ── Job KPIs ─────────────────────────────────────────────────────────────────

function JobKpis({ enrichment, title }: { enrichment: DashboardResult["enrichment"]; title: string }) {
  const e = enrichment as Record<string, any>;
  const salary = formatSalary(e.salaryMin, e.salaryMax, e.salaryIsPredicted);
  const applyUrl = (e.applyUrl || e.apply_url) as string | undefined;
  const posted = e.posted as string | undefined;
  const contractType = e.contractType as string | undefined;
  const contractTime = e.contractTime as string | undefined;
  const company = e.company as string | undefined;
  const category = e.category as string | undefined;

  return (
    <div className="bg-slate-800/30 rounded-xl px-4 py-1">
      {company && (
        <KpiRow icon={<Building2 className="w-4 h-4" />} label="Company" value={company} />
      )}
      {salary && (
        <KpiRow icon={<DollarSign className="w-4 h-4" />} label="Salary" value={salary} mono />
      )}
      {contractTime && (
        <KpiRow icon={<Clock className="w-4 h-4" />} label="Contract" value={
          [
            contractTime === "full_time" ? "Full-time" : contractTime === "part_time" ? "Part-time" : contractTime,
            contractType === "permanent" ? "Permanent" : contractType === "contract" ? "Contract" : contractType,
          ].filter(Boolean).join(" · ")
        } />
      )}
      {category && (
        <KpiRow icon={<Tag className="w-4 h-4" />} label="Category" value={category} />
      )}
      {e.address && (
        <KpiRow icon={<MapPin className="w-4 h-4" />} label="Location" value={e.address as string} />
      )}
      {posted && (
        <KpiRow icon={<Calendar className="w-4 h-4" />} label="Posted" value={
          new Date(posted).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
        } />
      )}
      {applyUrl && (
        <div className="py-3">
          <a
            href={applyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold transition-colors"
          >
            <Briefcase className="w-4 h-4" />
            Apply Now
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      )}
    </div>
  );
}

// ── Person KPIs ───────────────────────────────────────────────────────────────

function PersonKpis({ enrichment, url }: { enrichment: DashboardResult["enrichment"]; url: string }) {
  const e = enrichment as Record<string, any>;
  const kgEntityType = e.kgEntityType as string | undefined;
  return (
    <div className="bg-slate-800/30 rounded-xl px-4 py-1">
      {kgEntityType && (
        <KpiRow icon={<User className="w-4 h-4" />} label="Type" value={kgEntityType} />
      )}
      {e.email && (
        <KpiRow icon={<Mail className="w-4 h-4" />} label="Email" value={e.email as string} href={`mailto:${e.email}`} />
      )}
      {e.phone && (
        <KpiRow icon={<Phone className="w-4 h-4" />} label="Phone" value={e.phone as string} href={`tel:${e.phone}`} />
      )}
      {url && (
        <KpiRow icon={<Globe className="w-4 h-4" />} label="Profile" value={url} href={url} />
      )}
      {e.address && (
        <KpiRow icon={<MapPin className="w-4 h-4" />} label="Location" value={e.address as string} />
      )}
    </div>
  );
}

// ── Corp KPIs (knowledge graph enriched) ─────────────────────────────────────

function CorporationKpis({ enrichment, url }: { enrichment: DashboardResult["enrichment"]; url: string }) {
  const e = enrichment as Record<string, any>;
  const mapsUrl = mapsUrlFromEnrichment(enrichment, "");
  return (
    <div className="bg-slate-800/30 rounded-xl px-4 py-1">
      {e.headquarters && (
        <KpiRow icon={<MapPin className="w-4 h-4" />} label="HQ" value={e.headquarters as string} />
      )}
      {e.founded && (
        <KpiRow icon={<Calendar className="w-4 h-4" />} label="Founded" value={e.founded as string} />
      )}
      {e.employees && (
        <KpiRow icon={<Users className="w-4 h-4" />} label="Employees" value={e.employees as string} />
      )}
      {e.ceo && (
        <KpiRow icon={<User className="w-4 h-4" />} label="CEO" value={e.ceo as string} />
      )}
      {e.revenue && (
        <KpiRow icon={<DollarSign className="w-4 h-4" />} label="Revenue" value={e.revenue as string} />
      )}
      {url && (
        <KpiRow icon={<Globe className="w-4 h-4" />} label="Website" value={url} href={url} />
      )}
      {e.phone && (
        <KpiRow icon={<Phone className="w-4 h-4" />} label="Phone" value={e.phone as string} href={`tel:${e.phone}`} />
      )}
      {mapsUrl && (
        <KpiRow icon={<Navigation className="w-4 h-4" />} label="Maps" value="Open in Google Maps" href={mapsUrl} />
      )}
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

interface Props {
  result: DashboardResult;
  onClose: () => void;
}

export function ResultDetail({ result, onClose }: Props) {
  const e = result.enrichment as Record<string, any>;
  const type = (e.type as string | undefined)?.toLowerCase() ?? "";
  const mapsUrl = mapsUrlFromEnrichment(result.enrichment, result.title);

  // Outreach panel
  const [outreachOpen, setOutreachOpen] = useState(false);

  // Enrichment state — live contacts override result.contacts after enrich
  const [enriching, setEnriching] = useState(false);
  const [enriched, setEnriched] = useState(result.enrichment?.enriched === true);
  const [liveEmail, setLiveEmail] = useState(e.email as string | undefined);
  const [livePhone, setLivePhone] = useState(e.phone as string | undefined);
  const [liveContacts, setLiveContacts] = useState<DashboardContact[]>(result.contacts ?? []);
  const [enrichError, setEnrichError] = useState("");

  const hasWebsite = !!(result.url);
  const canEnrich = hasWebsite && !enriched && !enriching;

  const handleEnrich = async () => {
    setEnriching(true);
    setEnrichError("");
    try {
      const res = await fetch(`/api/enrich/${result.id}`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `Error ${res.status}`);
      }
      const data = await res.json();
      if (data.email) setLiveEmail(data.email);
      if (data.phone) setLivePhone(data.phone);
      if (data.contacts) setLiveContacts(data.contacts as DashboardContact[]);
      setEnriched(true);
    } catch (err) {
      setEnrichError(err instanceof Error ? err.message : "Enrichment failed");
    } finally {
      setEnriching(false);
    }
  };

  // Close on Escape
  useEffect(() => {
    const handler = (ev: KeyboardEvent) => { if (ev.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const modal = (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      >
        <motion.div
          key="panel"
          initial={{ opacity: 0, scale: 0.96, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 16 }}
          transition={{ type: "spring", stiffness: 350, damping: 30 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-2xl bg-[#0d1525] border border-slate-700/60 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-start gap-4 p-6 border-b border-slate-800/60 shrink-0">
            <div className="flex-1 min-w-0">
              <h2 className="text-slate-50 font-bold text-lg leading-snug mb-2">
                {result.title}
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                {/* Type badge */}
                {type && (
                  <Badge variant="secondary" className="bg-sky-500/10 text-sky-300 border-sky-500/20 text-xs capitalize">
                    {type}
                  </Badge>
                )}
                {/* Source badge */}
                <Badge variant="secondary" className="bg-slate-700/40 text-slate-400 border-slate-600/20 text-xs font-mono">
                  {result.source}
                </Badge>
                {/* Score */}
                {result.score > 0 && (
                  <Badge variant="secondary" className={`text-xs font-mono ${
                    result.score >= 80 ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/25" :
                    result.score >= 60 ? "bg-sky-500/15 text-sky-300 border-sky-500/25" :
                    "bg-amber-500/15 text-amber-300 border-amber-500/25"
                  }`}>
                    {result.score}% match
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setOutreachOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                Outreach
              </button>
              <button
                onClick={onClose}
                className="text-slate-500 hover:text-slate-200 transition-colors p-1 rounded-lg hover:bg-slate-800/60"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Scrollable body */}
          <div className="overflow-y-auto flex-1 p-6 flex flex-col gap-5">
            {/* Description */}
            {result.description && (
              <p className="text-slate-400 text-sm leading-relaxed">
                {result.description}
              </p>
            )}

            {/* Type-specific KPIs */}
            {(type === "business") && (
              <section>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
                  Business Details
                </h3>
                <BusinessKpis enrichment={{ ...result.enrichment, email: liveEmail, phone: livePhone }} url={result.url} />
              </section>
            )}

            {(type === "corporation") && (
              <section>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
                  Company Details
                </h3>
                <CorporationKpis enrichment={{ ...result.enrichment, email: liveEmail, phone: livePhone }} url={result.url} />
              </section>
            )}

            {(type === "job") && (
              <section>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
                  Job Details
                </h3>
                <JobKpis enrichment={{ ...result.enrichment, email: liveEmail, phone: livePhone }} title={result.title} />
              </section>
            )}

            {(type === "person") && (
              <section>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
                  Contact Details
                </h3>
                <PersonKpis enrichment={{ ...result.enrichment, email: liveEmail, phone: livePhone }} url={result.url} />
              </section>
            )}

            {/* Enrich CTA */}
            {!enriched && (
              <div className={`flex items-center gap-3 rounded-xl px-4 py-3 border ${
                enrichError
                  ? "bg-red-500/5 border-red-500/20"
                  : "bg-sky-500/5 border-sky-500/15"
              }`}>
                <Sparkles className="w-4 h-4 text-sky-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-slate-300 text-xs font-medium">
                    {enrichError ? enrichError : hasWebsite ? "Find more emails, phone & contacts" : "No website — enrichment unavailable"}
                  </p>
                </div>
                {canEnrich && (
                  <button
                    onClick={handleEnrich}
                    disabled={enriching}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition-colors shrink-0 disabled:opacity-60"
                  >
                    {enriching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    {enriching ? "Enriching…" : "Enrich"}
                  </button>
                )}
              </div>
            )}
            {enriched && !enriching && (
              <div className="flex items-center gap-2 text-xs text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" /> Enrichment complete
              </div>
            )}

            {/* Contacts from Contact model */}
            {liveContacts && liveContacts.length > 0 && (
              <section>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
                  Key Contacts
                </h3>
                <div className="flex flex-col gap-2">
                  {liveContacts.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-start gap-3 bg-slate-800/30 rounded-xl p-3"
                    >
                      <div className="w-8 h-8 rounded-full bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-sky-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-200 text-sm font-medium">{c.name}</span>
                          {c.isPrimary && (
                            <Badge variant="secondary" className="text-[10px] bg-sky-500/10 text-sky-400 border-sky-500/20 py-0">
                              Primary
                            </Badge>
                          )}
                        </div>
                        {c.title && <p className="text-slate-500 text-xs">{c.title}</p>}
                        <div className="flex items-center gap-3 mt-1">
                          {c.email && (
                            <a href={`mailto:${c.email}`} className="text-sky-400 text-xs hover:text-sky-300 flex items-center gap-1">
                              <Mail className="w-3 h-3" /> {c.email}
                            </a>
                          )}
                          {c.linkedin && (
                            <a href={c.linkedin} target="_blank" rel="noopener noreferrer"
                              className="text-blue-400 text-xs hover:text-blue-300 flex items-center gap-1">
                              <Link2 className="w-3 h-3" /> LinkedIn
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Match reason */}
            {result.matchReason && (
              <section>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">
                  Why This Result
                </h3>
                <p className="text-slate-500 text-sm leading-relaxed bg-slate-800/20 rounded-xl px-4 py-3">
                  {result.matchReason}
                </p>
              </section>
            )}
          </div>

          {/* Footer actions */}
          <div className="border-t border-slate-800/60 p-4 flex items-center gap-3 shrink-0">
            {/* Maps button — only for non-job types */}
            {mapsUrl && type !== "job" && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-300 hover:text-sky-300 hover:border-sky-500/30 text-sm transition-all"
              >
                <Navigation className="w-4 h-4" /> Maps
              </a>
            )}

            {/* Primary CTA */}
            {result.url && (
              <a
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold transition-colors ml-auto"
              >
                {type === "job" ? (
                  <><Briefcase className="w-4 h-4" /> Apply</>
                ) : (
                  <><Globe className="w-4 h-4" /> Visit Site</>
                )}
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-slate-500 hover:text-slate-300 ml-auto"
            >
              Close
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  if (typeof window === "undefined") return null;
  return (
    <>
      {createPortal(modal, document.body)}
      {outreachOpen && (
        <OutreachEngine
          result={{ ...result, contacts: liveContacts }}
          onClose={() => setOutreachOpen(false)}
        />
      )}
    </>
  );
}
