"use client";

import { createPortal } from "react-dom";
import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Send,
  Loader2,
  Sparkles,
  AlertCircle,
  Check,
  Eye,
  Edit3,
  TrendingUp,
  Handshake,
  Briefcase,
  Puzzle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  User,
  Mail,
  Phone,
  Link2,
  Calendar,
  Building2,
  Thermometer,
  Shuffle,
  Paperclip,
  Upload,
  FileText,
  Trash2,
} from "lucide-react";
import { DEFAULT_TEMPLATES, EmailTemplate, renderTemplate, extractVars } from "@/lib/email-templates";
import { DashboardResult } from "@/types";

// ── Constants ──────────────────────────────────────────────────────────────────

const SPAM_WORDS = [
  "guaranteed","free","act now","limited time","no obligation",
  "winner","click here","earn money","urgent","special offer",
];

const SEG_ICONS: Record<string, React.ReactNode> = {
  pas:         <TrendingUp className="w-3.5 h-3.5" />,
  partnership: <Handshake  className="w-3.5 h-3.5" />,
  job:         <Briefcase  className="w-3.5 h-3.5" />,
  custom:      <Puzzle     className="w-3.5 h-3.5" />,
};

const SEG_COLORS: Record<string, string> = {
  pas:         "text-amber-400 border-amber-500/40 bg-amber-500/10",
  partnership: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10",
  job:         "text-violet-400 border-violet-500/40 bg-violet-500/10",
  custom:      "text-slate-400 border-slate-500/40 bg-slate-500/10",
};

const VARIANT_LABELS = ["A", "B", "C"];

// ── Spam highlighter ──────────────────────────────────────────────────────────

function spamFlags(text: string): string[] {
  const lower = text.toLowerCase();
  return SPAM_WORDS.filter((w) => lower.includes(w));
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// ── Collect emails from result ────────────────────────────────────────────────

function collectEmails(result: DashboardResult): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (e?: string | null) => {
    if (e && !seen.has(e)) { seen.add(e); out.push(e); }
  };
  const enrichment = result.enrichment as Record<string, unknown>;
  push(enrichment.email as string);
  for (const c of result.contacts ?? []) push(c.email);
  return out;
}

// ── Auto-seed company facts from result ───────────────────────────────────────

function seedCompanyFacts(result: DashboardResult): string {
  const e = result.enrichment as Record<string, any>;
  const parts: string[] = [];
  if (e.category)        parts.push(`Industry: ${e.category}`);
  if (e.businessStatus)  parts.push(`Status: ${e.businessStatus}`);
  if (e.rating)          parts.push(`Rating: ${e.rating}/5 (${e.userRatingCount ?? 0} reviews)`);
  if (e.employees)       parts.push(`Employees: ${e.employees}`);
  if (e.founded)         parts.push(`Founded: ${e.founded}`);
  if (e.revenue)         parts.push(`Revenue: ${e.revenue}`);
  if (e.techStack)       parts.push(`Tech stack: ${e.techStack}`);
  if (e.fundingStage)    parts.push(`Funding: ${e.fundingStage}`);
  if (e.address)         parts.push(`Location: ${e.address}`);
  if (result.description) parts.push(`Description: ${result.description}`);
  return parts.join("\n");
}

// ── Sender profile (localStorage) ────────────────────────────────────────────

interface SenderProfile {
  fullName: string;
  title: string;
  phone: string;
  linkedinUrl: string;
  calendarUrl: string;
  senderCompany: string;
}

function loadProfile(): SenderProfile {
  try {
    return JSON.parse(localStorage.getItem("outreach_sender_profile") ?? "{}");
  } catch { return {} as SenderProfile; }
}

function saveProfile(p: SenderProfile) {
  localStorage.setItem("outreach_sender_profile", JSON.stringify(p));
}

// ── Doc types ─────────────────────────────────────────────────────────────────

interface OutreachDoc {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  path: string;
  createdAt: string;
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Variant type ──────────────────────────────────────────────────────────────

interface Variant {
  subject: string;
  body: string;
  spamFlags: string[];
  wordCount: number;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  result: DashboardResult;
  onClose: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function OutreachEngine({ result, onClose }: Props) {
  const enrichment = result.enrichment as Record<string, any>;
  const companyName =
    (enrichment.company as string) ||
    result.title ||
    "Company";

  // ── Segment ──
  const [segIdx, setSegIdx] = useState(0);
  const template: EmailTemplate = DEFAULT_TEMPLATES[segIdx];

  // ── AI generation ──
  const [companyFacts, setCompanyFacts] = useState(() => seedCompanyFacts(result));
  const [extraContext, setExtraContext] = useState("");
  const [temperature, setTemperature] = useState(template.defaultTemperature);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [variants, setVariants] = useState<Variant[]>([]);
  const [activeVariant, setActiveVariant] = useState(0);
  const [editedBody, setEditedBody] = useState("");
  const [editedSubject, setEditedSubject] = useState("");
  const [previewMode, setPreviewMode] = useState(false);

  // ── Receiver ──
  const availableEmails = collectEmails(result);
  const [toEmail, setToEmail] = useState(availableEmails[0] ?? "");
  const [customEmail, setCustomEmail] = useState("");
  const useCustom = toEmail === "__custom__";
  const effectiveTo = useCustom ? customEmail : toEmail;

  // ── CC ──
  const [ccSelected, setCcSelected] = useState<Set<string>>(new Set());
  const [ccInput, setCcInput] = useState("");
  const [ccManual, setCcManual] = useState<string[]>([]);

  const toggleCc = (email: string) =>
    setCcSelected((prev) => {
      const s = new Set(prev);
      if (s.has(email)) s.delete(email); else s.add(email);
      return s;
    });

  const addCcManual = () => {
    const val = ccInput.trim().toLowerCase();
    if (!val.includes("@") || ccManual.includes(val) || ccSelected.has(val)) return;
    setCcManual((prev) => [...prev, val]);
    setCcInput("");
  };

  const removeCcManual = (email: string) =>
    setCcManual((prev) => prev.filter((e) => e !== email));

  const allCc = [...ccSelected, ...ccManual];

  // ── Sender profile ──
  const [profile, setProfile] = useState<SenderProfile>(loadProfile);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileOverride, setProfileOverride] = useState(false);
  const [overrideProfile, setOverrideProfile] = useState<SenderProfile>({ ...loadProfile() });

  // ── Send state ──
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState("");

  // ── Doc attachments ──
  const [savedDocs, setSavedDocs] = useState<OutreachDoc[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState(false);

  // ── History ──
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Reset on segment change
  useEffect(() => {
    setVariants([]);
    setEditedBody("");
    setEditedSubject("");
    setTemperature(template.defaultTemperature);
    setSent(false);
    setSendError("");
    setGenError("");
  }, [segIdx]);

  // Sync edited fields when variant changes
  useEffect(() => {
    if (variants[activeVariant]) {
      setEditedBody(variants[activeVariant].body);
      setEditedSubject(variants[activeVariant].subject);
    }
  }, [activeVariant, variants]);

  // Keyboard shortcuts
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "G") {
        e.preventDefault();
        handleGenerate();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        if (!sending && !sent && effectiveTo) handleSend();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  // Fetch saved docs on mount
  useEffect(() => {
    fetch("/api/docs")
      .then((r) => r.json())
      .then((d) => setSavedDocs(d.docs ?? []))
      .catch(() => {});
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/docs", { method: "POST", body: fd });
      if (!res.ok) throw new Error((await res.json()).error || "Upload failed");
      const doc: OutreachDoc = await res.json();
      setSavedDocs((prev) => [doc, ...prev]);
      setSelectedDocIds((prev) => new Set([...prev, doc.id]));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDoc = async (id: string) => {
    await fetch(`/api/docs/${id}`, { method: "DELETE" });
    setSavedDocs((prev) => prev.filter((d) => d.id !== id));
    setSelectedDocIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
  };

  const toggleDoc = (id: string) => {
    setSelectedDocIds((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  };

  const activeSender = profileOverride ? overrideProfile : profile;

  // ── Generate ──
  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setGenError("");
    try {
      const res = await fetch("/api/outreach/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          segment: template.approachType,
          companyName,
          companyFacts,
          senderName: activeSender.fullName || "Sender",
          senderRole: activeSender.title,
          senderCompany: activeSender.senderCompany,
          targetFirstName: result.contacts?.[0]?.name?.split(" ")[0] || "",
          temperature,
          extraContext,
          seed: Date.now(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Surface real provider error message, not just "all failed"
        const detail = data?.details?.[0] ?? data?.error ?? `Error ${res.status}`;
        throw new Error(detail);
      }
      setVariants(data.variants);
      setActiveVariant(0);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }, [template, companyName, companyFacts, activeSender, temperature, extraContext, result.contacts]);

  // ── Send ──
  const handleSend = async () => {
    setSending(true);
    setSendError("");
    try {
      const res = await fetch("/api/outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resultId: result.id,
          toEmail: effectiveTo,
          toEmails: [effectiveTo],
          cc: allCc,
          subject: editedSubject || template.subject,
          body: editedBody || template.body,
          approachType: template.approachType,
          segment: template.approachType,
          variantIndex: activeVariant,
          templateName: template.name,
          docIds: [...selectedDocIds],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);
      setSent(true);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  };

  // ── Load history ──
  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/outreach?resultId=${result.id}`);
      const data = await res.json();
      setHistory(data.events ?? []);
    } catch {
      // silent
    } finally {
      setHistoryLoading(false);
    }
  };

  const currentBody = variants[activeVariant]?.body ?? "";
  const currentSubject = variants[activeVariant]?.subject ?? "";
  const finalBody = editedBody || currentBody;
  const finalSubject = editedSubject || currentSubject;
  const flags = spamFlags(finalBody + " " + finalSubject);
  const wc = wordCount(finalBody);
  const wcColor = wc < 50 ? "text-red-400" : wc <= 125 ? "text-emerald-400" : "text-amber-400";

  const canGenerate = !generating;
  const canSend = effectiveTo.includes("@") && (finalBody.length > 0) && !sending && !sent;

  // ── Prompt engineering spec display ──────────────────────────────────────────

  const panel = (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
      />

      {/* Engine Panel */}
      <motion.aside
        key="engine"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className="fixed right-0 top-0 bottom-0 w-full sm:w-[580px] bg-[#0a1120] border-l border-slate-700/50 z-50 flex flex-col shadow-2xl overflow-hidden"
      >
        {/* ── HEADER ── */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800/60 shrink-0">
          <div className="min-w-0">
            <h2 className="text-slate-50 font-bold text-sm">Outreach Engine</h2>
            <p className="text-slate-500 text-xs truncate max-w-[200px] sm:max-w-[400px]">{result.title}</p>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="hidden sm:inline text-[10px] text-slate-600 bg-slate-800/60 border border-slate-700/40 rounded px-1.5 py-0.5">
              Ctrl+Shift+G = generate
            </kbd>
            <button onClick={onClose} className="text-slate-500 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800/60 transition-colors">
              <X className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>

        {/* ── SEGMENT SELECTOR ── */}
        <div className="px-5 pt-3 pb-2 shrink-0">
          <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-2">Segment</p>
          <div className="flex gap-1.5 flex-wrap">
            {DEFAULT_TEMPLATES.map((t, i) => (
              <button
                key={t.approachType}
                onClick={() => setSegIdx(i)}
                title={t.description}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  segIdx === i
                    ? SEG_COLORS[t.approachType]
                    : "text-slate-500 border-slate-700/40 hover:border-slate-600/40 hover:text-slate-300"
                }`}
              >
                {SEG_ICONS[t.approachType]}
                {t.name}
              </button>
            ))}
          </div>
          {/* Segment description */}
          <p className="text-[11px] text-slate-600 mt-1.5 flex items-center gap-1.5">
            <span className={`font-medium ${SEG_COLORS[template.approachType].split(" ")[0]}`}>{template.toneLabel}</span>
            <span>·</span>
            <span>{template.description}</span>
          </p>
        </div>

        {/* ── SCROLLABLE BODY ── */}
        <div className="flex-1 overflow-y-auto px-5 pb-4 flex flex-col gap-4">

          {/* ═══ HOLDER 1: Identity & Routing ═══ */}
          <section>
            <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-2">Holder 1 — Routing</p>
            <div className="bg-slate-900/50 rounded-xl border border-slate-800/60 divide-y divide-slate-800/60">

              {/* Receiver */}
              <div className="p-3 flex flex-col gap-2">
                <label className="text-xs text-slate-400 font-medium">To</label>
                <select
                  value={toEmail}
                  onChange={(e) => setToEmail(e.target.value)}
                  className="w-full bg-slate-800/60 border border-slate-700/50 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-500/40"
                >
                  {availableEmails.map((em) => (
                    <option key={em} value={em}>{em}</option>
                  ))}
                  <option value="__custom__">Enter manually…</option>
                </select>
                {(useCustom || availableEmails.length === 0) && (
                  <input
                    type="email"
                    value={customEmail}
                    onChange={(e) => setCustomEmail(e.target.value)}
                    placeholder="contact@company.com"
                    className="w-full bg-slate-800/60 border border-slate-700/50 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 placeholder:text-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-500/40"
                  />
                )}
                {/* CC */}
                <div className="flex flex-col gap-1.5 pt-1 border-t border-slate-800/60">
                  <label className="text-xs text-slate-400 font-medium">CC</label>

                  {/* Known contact chips */}
                  {availableEmails.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {availableEmails.map((em) => {
                        const active = ccSelected.has(em);
                        return (
                          <button
                            key={em}
                            type="button"
                            onClick={() => toggleCc(em)}
                            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border transition-all ${
                              active
                                ? "bg-sky-500/15 border-sky-500/40 text-sky-300"
                                : "bg-slate-800/60 border-slate-700/40 text-slate-500 hover:border-slate-600/60 hover:text-slate-300"
                            }`}
                          >
                            {active && <Check className="w-2.5 h-2.5" />}
                            {em}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Manual CC input */}
                  <div className="flex gap-1.5">
                    <input
                      type="email"
                      value={ccInput}
                      onChange={(e) => setCcInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addCcManual(); }
                      }}
                      placeholder="Add email and press Enter…"
                      className="flex-1 bg-slate-800/60 border border-slate-700/50 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 placeholder:text-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-500/40"
                    />
                    <button
                      type="button"
                      onClick={addCcManual}
                      disabled={!ccInput.includes("@")}
                      className="px-2.5 py-1 rounded-lg border border-slate-700/50 text-slate-400 hover:text-sky-300 hover:border-sky-500/30 text-xs disabled:opacity-30 transition-all"
                    >
                      Add
                    </button>
                  </div>

                  {/* Manually added CC tags */}
                  {ccManual.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {ccManual.map((em) => (
                        <span
                          key={em}
                          className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-slate-700/40 border border-slate-600/40 text-slate-300"
                        >
                          {em}
                          <button
                            type="button"
                            onClick={() => removeCcManual(em)}
                            className="text-slate-500 hover:text-red-400 transition-colors"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Attachments */}
              <div className="p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                    <Paperclip className="w-3.5 h-3.5" />
                    Attachments
                    {selectedDocIds.size > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 text-[10px] font-semibold">
                        {selectedDocIds.size}
                      </span>
                    )}
                  </span>
                  <label className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border cursor-pointer transition-all ${
                    uploading
                      ? "border-slate-700/40 text-slate-600"
                      : "border-slate-700/40 text-slate-500 hover:text-sky-300 hover:border-sky-500/30"
                  }`}>
                    {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                    {uploading ? "Uploading…" : "Upload"}
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.pptx,.xlsx"
                      className="hidden"
                      disabled={uploading}
                      onChange={handleUpload}
                    />
                  </label>
                </div>

                {savedDocs.length === 0 ? (
                  <p className="text-[10px] text-slate-600 italic">No saved docs — upload one above</p>
                ) : (
                  <div className="flex flex-col gap-1">
                    {savedDocs.map((doc) => {
                      const selected = selectedDocIds.has(doc.id);
                      return (
                        <div
                          key={doc.id}
                          onClick={() => toggleDoc(doc.id)}
                          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border cursor-pointer transition-all group ${
                            selected
                              ? "bg-sky-500/10 border-sky-500/30"
                              : "bg-slate-800/30 border-slate-700/40 hover:border-slate-600/60"
                          }`}
                        >
                          <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                            selected ? "bg-sky-500 border-sky-500" : "border-slate-600"
                          }`}>
                            {selected && <Check className="w-2 h-2 text-white" />}
                          </div>
                          <FileText className={`w-3 h-3 shrink-0 ${selected ? "text-sky-400" : "text-slate-500"}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] text-slate-300 truncate">{doc.name}</p>
                            <p className="text-[9px] text-slate-600">{fmtSize(doc.size)}</p>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteDoc(doc.id); }}
                            className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-red-400 transition-all shrink-0"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Sender profile */}
              <div className="p-3">
                <button
                  onClick={() => setProfileOpen((p) => !p)}
                  className="flex items-center justify-between w-full text-xs text-slate-400"
                >
                  <span className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-600" />
                    Sender: <span className="text-slate-300 ml-1">{activeSender.fullName || "Not set"}</span>
                  </span>
                  {profileOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                <AnimatePresence>
                  {profileOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 flex flex-col gap-2">
                        {/* Override toggle */}
                        <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={profileOverride}
                            onChange={(e) => setProfileOverride(e.target.checked)}
                            className="rounded border-slate-600 bg-slate-800"
                          />
                          Edit for this send only (don't save)
                        </label>

                        {(
                          [
                            { key: "fullName", label: "Full name", icon: <User className="w-3 h-3" /> },
                            { key: "title", label: "Title / Role", icon: <Briefcase className="w-3 h-3" /> },
                            { key: "senderCompany", label: "Your company", icon: <Building2 className="w-3 h-3" /> },
                            { key: "phone", label: "Phone", icon: <Phone className="w-3 h-3" /> },
                            { key: "linkedinUrl", label: "LinkedIn URL", icon: <Link2 className="w-3 h-3" /> },
                            { key: "calendarUrl", label: "Calendly / Booking link", icon: <Calendar className="w-3 h-3" /> },
                          ] as const
                        ).map(({ key, label, icon }) => (
                          <div key={key} className="flex items-center gap-2">
                            <span className="text-slate-600 shrink-0">{icon}</span>
                            <input
                              type="text"
                              value={(profileOverride ? overrideProfile : profile)[key] ?? ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (profileOverride) {
                                  setOverrideProfile((p) => ({ ...p, [key]: val }));
                                } else {
                                  const next = { ...profile, [key]: val };
                                  setProfile(next);
                                  saveProfile(next);
                                }
                              }}
                              placeholder={label}
                              className="flex-1 bg-slate-800/60 border border-slate-700/50 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 placeholder:text-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-500/40"
                            />
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </section>

          {/* ═══ HOLDER 2: AI Mail Generator ═══ */}
          <section>
            <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-2">Holder 2 — AI Generator</p>
            <div className="bg-slate-900/50 rounded-xl border border-slate-800/60 p-3 flex flex-col gap-3">

              {/* Company intel */}
              <div>
                <label className="block text-xs text-slate-400 mb-1.5 font-medium">Company intelligence</label>
                <textarea
                  value={companyFacts}
                  onChange={(e) => setCompanyFacts(e.target.value)}
                  rows={3}
                  placeholder="Industry, recent news, tech stack, hiring, funding stage…"
                  className="w-full bg-slate-800/60 border border-slate-700/50 text-slate-200 text-xs rounded-lg px-2.5 py-2 placeholder:text-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-500/40 resize-none"
                />
              </div>

              {/* Extra context */}
              <div>
                <input
                  type="text"
                  value={extraContext}
                  onChange={(e) => setExtraContext(e.target.value)}
                  placeholder="Extra context for AI (pain point angle, metric to cite…)"
                  className="w-full bg-slate-800/60 border border-slate-700/50 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 placeholder:text-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-500/40"
                />
              </div>

              {/* Controls row */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 flex-1">
                  <Thermometer className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                  <input
                    type="range"
                    min="0.3" max="0.7" step="0.05"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className="flex-1 accent-sky-500"
                  />
                  <span className="text-[10px] text-slate-500 w-7">{temperature.toFixed(2)}</span>
                </div>
                <button
                  onClick={handleGenerate}
                  disabled={!canGenerate}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors"
                >
                  {generating ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating…</>
                  ) : (
                    <><Sparkles className="w-3.5 h-3.5" /> Generate 3 Variants</>
                  )}
                </button>
              </div>

              {genError && (
                <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-red-300 text-xs">{genError}</p>
                    <p className="text-red-400/60 text-[10px] mt-0.5">
                      Set GROQ_API_KEY or OPENROUTER_API_KEY in .env.local — both have free tiers.
                    </p>
                  </div>
                </div>
              )}

              {/* Variant tabs */}
              {variants.length > 0 && (
                <div>
                  <div className="flex gap-1 mb-2">
                    {variants.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setActiveVariant(i)}
                        className={`px-2.5 py-1 rounded-md text-xs font-mono font-semibold border transition-all ${
                          activeVariant === i
                            ? "text-sky-300 border-sky-500/40 bg-sky-500/10"
                            : "text-slate-500 border-slate-700/40 hover:text-slate-300"
                        }`}
                      >
                        Variant {VARIANT_LABELS[i]}
                      </button>
                    ))}
                    <button
                      onClick={handleGenerate}
                      disabled={generating}
                      title="Regenerate all variants"
                      className="ml-auto p-1 rounded-md text-slate-600 hover:text-slate-300 border border-transparent hover:border-slate-700/40 transition-all"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Preview / Edit toggle */}
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[10px] text-slate-600">
                      <span className={wcColor}>{wc}w</span>
                      {wc < 50 && " — too short"}{wc > 125 && " — aim for ≤125"}
                    </p>
                    <button
                      onClick={() => setPreviewMode((p) => !p)}
                      className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      {previewMode ? <Edit3 className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      {previewMode ? "Edit" : "Preview"}
                    </button>
                  </div>

                  {previewMode ? (
                    <div className="bg-slate-800/40 rounded-lg border border-slate-700/40 overflow-hidden">
                      <div className="px-3 py-2 border-b border-slate-700/40">
                        <span className="text-slate-600 text-[10px] mr-1">Subject:</span>
                        <span className="text-slate-200 text-xs">{finalSubject}</span>
                      </div>
                      <pre className="px-3 py-2.5 text-slate-300 text-xs leading-relaxed whitespace-pre-wrap font-sans">
                        {finalBody}
                      </pre>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      <input
                        type="text"
                        value={editedSubject || currentSubject}
                        onChange={(e) => setEditedSubject(e.target.value)}
                        placeholder="Subject"
                        className="w-full bg-slate-800/60 border border-slate-700/50 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-500/40 font-medium"
                      />
                      <textarea
                        value={editedBody || currentBody}
                        onChange={(e) => setEditedBody(e.target.value)}
                        rows={8}
                        className="w-full bg-slate-800/60 border border-slate-700/50 text-slate-200 text-xs rounded-lg px-2.5 py-2 placeholder:text-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-500/40 resize-none font-mono leading-relaxed"
                      />
                    </div>
                  )}

                  {/* Spam flags */}
                  {flags.length > 0 && (
                    <div className="flex items-start gap-1.5 mt-1.5 bg-amber-500/5 border border-amber-500/20 rounded-lg px-2.5 py-1.5">
                      <AlertCircle className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                      <p className="text-[10px] text-amber-400/80">
                        Spam risk: <span className="font-mono">{flags.join(", ")}</span>
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* No variants yet — show template preview */}
              {variants.length === 0 && !generating && (
                <div className="bg-slate-800/30 rounded-lg border border-dashed border-slate-700/40 p-3">
                  <p className="text-[10px] text-slate-600 mb-2">Default template (click Generate for AI variants):</p>
                  <pre className="text-slate-500 text-[10px] leading-relaxed whitespace-pre-wrap font-sans line-clamp-6">
                    {template.body}
                  </pre>
                </div>
              )}
            </div>
          </section>

          {/* ═══ HOLDER 3: Regards & Contact ═══ */}
          <section>
            <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-2">Holder 3 — Signature Preview</p>
            <div className="bg-slate-900/50 rounded-xl border border-slate-800/60 px-3 py-2.5">
              <div className="text-xs text-slate-400 leading-relaxed">
                <p className="font-medium text-slate-300">{activeSender.fullName || "—"}</p>
                {activeSender.title && <p className="text-slate-500">{activeSender.title}</p>}
                {activeSender.senderCompany && <p className="text-slate-500">{activeSender.senderCompany}</p>}
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  {activeSender.phone && (
                    <span className="flex items-center gap-1 text-[10px] text-slate-600">
                      <Phone className="w-3 h-3" /> {activeSender.phone}
                    </span>
                  )}
                  {activeSender.linkedinUrl && (
                    <span className="flex items-center gap-1 text-[10px] text-sky-500">
                      <Link2 className="w-3 h-3" /> LinkedIn
                    </span>
                  )}
                  {activeSender.calendarUrl && (
                    <span className="flex items-center gap-1 text-[10px] text-emerald-500">
                      <Calendar className="w-3 h-3" /> Book a call
                    </span>
                  )}
                </div>
              </div>
              {!activeSender.fullName && (
                <p className="text-[10px] text-slate-600 mt-1">
                  ↑ Fill sender name in Holder 1 to preview signature
                </p>
              )}
            </div>
          </section>

          {/* ═══ HOLDER 4: Campaign History ═══ */}
          <section>
            <button
              onClick={() => {
                setHistoryOpen((p) => !p);
                if (!historyOpen) loadHistory();
              }}
              className="flex items-center justify-between w-full text-[10px] text-slate-600 uppercase tracking-wider"
            >
              <span>Holder 4 — Campaign History</span>
              {historyOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            <AnimatePresence>
              {historyOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden mt-2"
                >
                  <div className="bg-slate-900/50 rounded-xl border border-slate-800/60 p-3">
                    {historyLoading ? (
                      <div className="flex items-center gap-2 text-slate-600 text-xs">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
                      </div>
                    ) : history.length === 0 ? (
                      <p className="text-slate-600 text-xs">No outreach sent to this company yet.</p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {history.map((ev: any) => (
                          <div key={ev.id} className="flex items-start gap-2.5 text-xs">
                            <div className={`w-2 h-2 rounded-full mt-1 shrink-0 ${
                              ev.status === "sent" ? "bg-sky-500" :
                              ev.status === "replied" ? "bg-emerald-500" :
                              ev.status === "meeting_booked" ? "bg-violet-500" :
                              "bg-slate-600"
                            }`} />
                            <div className="min-w-0">
                              <p className="text-slate-300 truncate">{ev.subject}</p>
                              <p className="text-slate-600 text-[10px]">
                                {ev.segment} · {ev.status}
                                {ev.sentAt && ` · ${new Date(ev.sentAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          {/* Send feedback */}
          {sent && (
            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-emerald-300 text-sm">Sent to {effectiveTo}</span>
            </div>
          )}
          {sendError && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
              <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <span className="text-red-300 text-xs">{sendError}</span>
            </div>
          )}
        </div>

        {/* ── FOOTER ── */}
        <div className="border-t border-slate-800/60 px-5 py-3.5 flex items-center gap-3 shrink-0">
          <div className="flex-1 min-w-0 flex flex-col gap-0.5">
            <p className="text-xs text-slate-600 truncate flex items-center gap-1">
              <Mail className="w-3 h-3" />
              {effectiveTo || "No recipient"}
              {allCc.length > 0 && (
                <span className="text-slate-700">· CC {allCc.length}</span>
              )}
            </p>
            {selectedDocIds.size > 0 && (
              <p className="text-[10px] text-sky-400 flex items-center gap-1">
                <Paperclip className="w-2.5 h-2.5" />
                {selectedDocIds.size} attachment{selectedDocIds.size !== 1 ? "s" : ""}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xs transition-colors shrink-0">
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={!canSend}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors shrink-0"
          >
            {sending ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending…</>
            ) : (
              <><Send className="w-3.5 h-3.5" /> Send <kbd className="ml-1 text-[9px] opacity-60">⌘↵</kbd></>
            )}
          </button>
        </div>
      </motion.aside>
    </AnimatePresence>
  );

  if (typeof window === "undefined") return null;
  return createPortal(panel, document.body);
}
