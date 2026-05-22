"use client";

import { createPortal } from "react-dom";
import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Send,
  Loader2,
  ChevronRight,
  Mail,
  Check,
  AlertCircle,
  Eye,
  Edit3,
  Zap,
  TrendingUp,
  Handshake,
  Paperclip,
  Upload,
  Trash2,
  FileText,
} from "lucide-react";
import {
  DEFAULT_TEMPLATES,
  renderTemplate,
  extractVars,
  seedVarsFromResult,
  EmailTemplate,
} from "@/lib/email-templates";
import { DashboardResult } from "@/types";

// ── Template tab config ───────────────────────────────────────────────────────

const TAB_ICONS: Record<string, React.ReactNode> = {
  direct:      <Zap      className="w-3.5 h-3.5" />,
  pas:         <TrendingUp className="w-3.5 h-3.5" />,
  partnership: <Handshake className="w-3.5 h-3.5" />,
  job:         <Zap      className="w-3.5 h-3.5" />,
  custom:      <Zap      className="w-3.5 h-3.5" />,
};

const TAB_COLORS: Record<string, string> = {
  direct:      "text-sky-400 border-sky-500/40 bg-sky-500/10",
  pas:         "text-amber-400 border-amber-500/40 bg-amber-500/10",
  partnership: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10",
  job:         "text-violet-400 border-violet-500/40 bg-violet-500/10",
  custom:      "text-slate-400 border-slate-500/40 bg-slate-500/10",
};

// ── Variable field label ──────────────────────────────────────────────────────

function varLabel(key: string): string {
  const map: Record<string, string> = {
    company: "Company name",
    first_name: "Contact first name",
    company_activity: "What company does",
    target_profile: "Your target profile",
    benefit: "Key benefit you offer",
    my_name: "Your name",
    my_company: "Your company",
    value_prop: "Your value proposition",
    industry: "Their industry",
    pain_point: "Main pain point",
    cost_of_inaction: "Cost of NOT solving it",
    similar_company: "Similar client you helped",
    result: "Result you achieved",
    collaboration_area: "Collaboration opportunity",
  };
  return map[key] ?? key.replace(/_/g, " ");
}

// ── Recipient picker ──────────────────────────────────────────────────────────

function collectEmails(result: DashboardResult): string[] {
  const emails: string[] = [];
  const e = result.enrichment as Record<string, unknown>;

  if (e.email && typeof e.email === "string") emails.push(e.email);
  for (const c of result.contacts ?? []) {
    if (c.email) emails.push(c.email);
  }
  return [...new Set(emails)];
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

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  result: DashboardResult;
  onClose: () => void;
}

export function OutreachPanel({ result, onClose }: Props) {
  const availableEmails = useMemo(() => collectEmails(result), [result]);
  const seedVars = useMemo(
    () =>
      seedVarsFromResult({
        title: result.title,
        enrichment: result.enrichment as Record<string, unknown>,
        contacts: result.contacts ?? [],
      }),
    [result]
  );

  // Template selection
  const [activeIdx, setActiveIdx] = useState(0);
  const template: EmailTemplate = DEFAULT_TEMPLATES[activeIdx];

  // Variable values (auto-seeded + user-editable)
  const [vars, setVars] = useState<Record<string, string>>(seedVars);

  // Recipient
  const [toEmail, setToEmail] = useState(availableEmails[0] ?? "");
  const [customEmail, setCustomEmail] = useState("");
  const useCustom = toEmail === "__custom__";
  const effectiveTo = useCustom ? customEmail : toEmail;

  // Preview mode toggle
  const [preview, setPreview] = useState(false);

  // Doc attachments
  const [savedDocs, setSavedDocs] = useState<OutreachDoc[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState(false);
  const [showDocs, setShowDocs] = useState(true);

  // Send state
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState("");

  // Re-seed auto vars when template changes (keep user-edited values)
  useEffect(() => {
    setVars((prev) => ({ ...seedVars, ...prev }));
    setSent(false);
    setSendError("");
  }, [activeIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  // ESC to close
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  // Prevent body scroll
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
      setShowDocs(true);
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

  const renderedSubject = renderTemplate(template.subject, vars);
  const renderedBody = renderTemplate(template.body, vars);

  // Detect unfilled vars (still show {{...}})
  const unfilledVars = extractVars(renderedSubject + " " + renderedBody);

  const canSend = effectiveTo && effectiveTo.includes("@") && !sending && !sent;

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
          subject: renderedSubject,
          body: renderedBody,
          approachType: template.approachType,
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

  const panel = (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
      />

      {/* Slide-over panel */}
      <motion.aside
        key="panel"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className="fixed right-0 top-0 bottom-0 w-full sm:w-[520px] bg-[#0d1525] border-l border-slate-700/60 z-50 flex flex-col shadow-2xl overflow-hidden"
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/60 shrink-0">
          <div>
            <h2 className="text-slate-50 font-semibold text-base">Send Outreach</h2>
            <p className="text-slate-500 text-xs mt-0.5 truncate max-w-[340px]">{result.title}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-200 transition-colors p-1 rounded-lg hover:bg-slate-800/60"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Template tabs ── */}
        <div className="flex gap-2 px-6 pt-4 pb-2 shrink-0">
          {DEFAULT_TEMPLATES.map((t, i) => (
            <button
              key={t.approachType}
              onClick={() => setActiveIdx(i)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                activeIdx === i
                  ? TAB_COLORS[t.approachType]
                  : "text-slate-500 border-slate-700/40 hover:border-slate-600/40 hover:text-slate-400"
              }`}
            >
              {TAB_ICONS[t.approachType]}
              {t.name}
            </button>
          ))}
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-5">
          {/* Recipient */}
          <div>
            <label className="block text-xs text-slate-400 mb-1.5 font-medium">To</label>
            {availableEmails.length > 0 ? (
              <select
                value={toEmail}
                onChange={(e) => setToEmail(e.target.value)}
                className="w-full bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
              >
                {availableEmails.map((em) => (
                  <option key={em} value={em}>{em}</option>
                ))}
                <option value="__custom__">Enter manually…</option>
              </select>
            ) : (
              <p className="text-xs text-amber-400/80 bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2">
                No email found — enrich first or enter manually below
              </p>
            )}
            {(useCustom || availableEmails.length === 0) && (
              <input
                type="email"
                value={customEmail}
                onChange={(e) => setCustomEmail(e.target.value)}
                placeholder="contact@company.com"
                className="mt-2 w-full bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm rounded-lg px-3 py-2 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
              />
            )}
          </div>

          {/* Attachments */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={() => setShowDocs((p) => !p)}
                className="flex items-center gap-1.5 text-xs text-slate-400 font-medium hover:text-slate-200 transition-colors"
              >
                <Paperclip className="w-3.5 h-3.5" />
                Attachments
                {selectedDocIds.size > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 text-[10px] font-semibold">
                    {selectedDocIds.size}
                  </span>
                )}
              </button>
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

            {showDocs && (
              <div className="flex flex-col gap-1">
                {savedDocs.length === 0 ? (
                  <p className="text-[11px] text-slate-600 italic py-1">
                    No saved docs — upload one above
                  </p>
                ) : (
                  savedDocs.map((doc) => {
                    const selected = selectedDocIds.has(doc.id);
                    return (
                      <div
                        key={doc.id}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all cursor-pointer group ${
                          selected
                            ? "bg-sky-500/10 border-sky-500/30"
                            : "bg-slate-800/30 border-slate-700/40 hover:border-slate-600/60"
                        }`}
                        onClick={() => toggleDoc(doc.id)}
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                          selected ? "bg-sky-500 border-sky-500" : "border-slate-600"
                        }`}>
                          {selected && <Check className="w-2.5 h-2.5 text-white" />}
                        </div>
                        <FileText className={`w-3.5 h-3.5 shrink-0 ${selected ? "text-sky-400" : "text-slate-500"}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-slate-300 truncate">{doc.name}</p>
                          <p className="text-[10px] text-slate-600">{fmtSize(doc.size)}</p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteDoc(doc.id); }}
                          className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-red-400 transition-all shrink-0"
                          title="Delete saved doc"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Variable fields */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-slate-400 font-medium">Variables</label>
              <button
                onClick={() => setPreview(!preview)}
                className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border transition-all ${
                  preview
                    ? "text-sky-300 border-sky-500/30 bg-sky-500/10"
                    : "text-slate-500 border-slate-700/40 hover:text-slate-300"
                }`}
              >
                {preview ? <Edit3 className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                {preview ? "Edit" : "Preview"}
              </button>
            </div>

            {!preview ? (
              <div className="grid grid-cols-1 gap-2">
                {template.variables.map((key) => (
                  <div key={key}>
                    <label className="block text-xs text-slate-500 mb-0.5">{varLabel(key)}</label>
                    <input
                      type="text"
                      value={vars[key] ?? ""}
                      onChange={(e) => setVars((p) => ({ ...p, [key]: e.target.value }))}
                      placeholder={`{{${key}}}`}
                      className={`w-full bg-slate-800/60 border text-slate-200 text-xs rounded-lg px-3 py-2 placeholder:text-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-500/40 transition-colors ${
                        vars[key]
                          ? "border-slate-700/40"
                          : "border-amber-500/30 focus:ring-amber-500/30"
                      }`}
                    />
                  </div>
                ))}
              </div>
            ) : (
              /* Preview */
              <div className="bg-slate-800/40 rounded-xl border border-slate-700/40 overflow-hidden">
                {/* Subject line */}
                <div className="px-4 py-2.5 border-b border-slate-700/40">
                  <span className="text-slate-500 text-xs mr-2">Subject:</span>
                  <span className="text-slate-200 text-xs font-medium">{renderedSubject}</span>
                </div>
                {/* Body */}
                <pre className="px-4 py-3 text-slate-300 text-xs leading-relaxed whitespace-pre-wrap font-sans">
                  {renderedBody}
                </pre>
              </div>
            )}

            {/* Unfilled var warning */}
            {unfilledVars.length > 0 && (
              <p className="text-xs text-amber-400/70 mt-2 flex items-center gap-1.5">
                <AlertCircle className="w-3 h-3 shrink-0" />
                Unfilled: {unfilledVars.map(v => `{{${v}}}`).join(", ")}
              </p>
            )}
          </div>

          {/* Outreach history hint */}
          {sent && (
            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-emerald-300 text-sm">Email sent to {effectiveTo}</span>
            </div>
          )}
          {sendError && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span className="text-red-300 text-sm">{sendError}</span>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="border-t border-slate-800/60 px-6 py-4 flex items-center gap-3 shrink-0">
          <div className="flex-1 min-w-0 flex flex-col gap-0.5">
            <p className="text-xs text-slate-500 truncate">
              <Mail className="w-3 h-3 inline mr-1" />
              {effectiveTo || "No recipient set"}
            </p>
            {selectedDocIds.size > 0 && (
              <p className="text-[10px] text-sky-400 flex items-center gap-1">
                <Paperclip className="w-2.5 h-2.5" />
                {selectedDocIds.size} attachment{selectedDocIds.size !== 1 ? "s" : ""}
              </p>
            )}
          </div>

          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 text-sm transition-colors"
          >
            Cancel
          </button>

          {sent ? (
            <button
              onClick={() => { setSent(false); setActiveIdx((p) => (p + 1) % 3); }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-700/60 text-slate-300 text-sm font-medium"
            >
              <ChevronRight className="w-4 h-4" /> Try another
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!canSend}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
            >
              {sending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
              ) : (
                <><Send className="w-4 h-4" /> Send Email</>
              )}
            </button>
          )}
        </div>
      </motion.aside>
    </AnimatePresence>
  );

  if (typeof window === "undefined") return null;
  return createPortal(panel, document.body);
}
