// Quotations.jsx
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import {
  Search, X, User, Phone, MapPin, Calendar, Package,
  ChevronRight, Clock, Inbox, Tag as TagIcon, Layers, FileText
} from "lucide-react";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

const QUOTATION_STATUSES = [
  "Pending",
  "In Preparation",
  "Sent to Customer",
  "Under Review",
  "Accepted",
  "Rejected",
];

const statusTone = {
  "Pending":          ["bg-amber-50",   "text-amber-700",  "ring-amber-600/15"],
  "In Preparation":   ["bg-sky-50",     "text-sky-700",    "ring-sky-600/15"],
  "Sent to Customer": ["bg-violet-50",  "text-violet-700", "ring-violet-600/15"],
  "Under Review":     ["bg-pink-50",    "text-pink-700",   "ring-pink-600/15"],
  "Accepted":         ["bg-emerald-50", "text-emerald-700","ring-emerald-600/15"],
  "Rejected":         ["bg-rose-50",    "text-rose-700",   "ring-rose-600/15"],
};
const defaultTone = ["bg-slate-100", "text-slate-600", "ring-slate-500/10"];

/* ── Atoms ─────────────────────────────────────────────────────────── */

function Tag({ children, tone = defaultTone }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${tone[0]} ${tone[1]} ${tone[2]}`}>
      {children}
    </span>
  );
}

function Label({ children }) {
  return (
    <label className="mb-1.5 block text-xs font-medium text-slate-500 uppercase tracking-wide">
      {children}
    </label>
  );
}

function inputCls(extra = "") {
  return `w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-150 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 ${extra}`;
}

function PrimaryBtn({ children, className = "", ...props }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-violet-200 transition-all duration-150 hover:bg-violet-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  );
}

function GhostBtn({ children, className = "", ...props }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-600 transition-all duration-150 hover:bg-slate-50 active:scale-[0.98] ${className}`}
    >
      {children}
    </button>
  );
}

function Row({ label, val, icon: Icon }) {
  if (!val) return null;
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2.5 last:border-0">
      <span className="flex items-center gap-1.5 text-xs font-medium text-slate-400 shrink-0">
        {Icon && <Icon size={12} className="text-slate-400" />}
        {label}
      </span>
      <span className="text-right text-sm text-slate-700">{val}</span>
    </div>
  );
}

function Backdrop({ onClick, children }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={onClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
    >
      {children}
    </motion.div>
  );
}

function ModalShell({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97, y: 8 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      onClick={(e) => e.stopPropagation()}
      className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-slate-900/5 sm:p-6"
    >
      {children}
    </motion.div>
  );
}

function EmptyState({ title, subtitle }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-20 text-center">
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
        <Inbox size={22} className="text-slate-300" />
      </div>
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-52 animate-pulse rounded-2xl border border-slate-100 bg-white p-4">
          <div className="mb-3 h-5 w-24 rounded-full bg-slate-100" />
          <div className="mb-2 h-4 w-2/3 rounded bg-slate-100" />
          <div className="h-3 w-1/2 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

function StatPill({ count, label }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700 ring-1 ring-inset ring-violet-600/15">
      <span className="text-sm font-bold">{count}</span>
      {label}
    </span>
  );
}

/* ── Main component ─────────────────────────────────────────────────── */
export default function Quotations() {
  const { token } = useAuth();
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");

  const [search, setSearch]         = useState("");
  const [statusFilter, setStatus]   = useState("");

  const [active, setActive]         = useState(null);
  const [logs, setLogs]             = useState([]);
  const [logsLoading, setLL]        = useState(false);
  const [showModal, setShowModal]   = useState(false);
  const [form, setForm]             = useState({ quotation_status: "", follow_up_date: "" });
  const [saving, setSaving]         = useState(false);
  const [formError, setFormError]   = useState("");

  const fetchQuotations = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res  = await fetch(`${API}/api/quotations`, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setQuotations(data.quotations || []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { fetchQuotations(); }, [fetchQuotations]);

  const filtered = quotations.filter((q) => {
    const rfq  = q.rfqs   || {};
    const lead = rfq.leads || {};
    const s    = search.toLowerCase();
    return (
      (!s ||
        rfq.company_name?.toLowerCase().includes(s) ||
        rfq.product_name?.toLowerCase().includes(s) ||
        rfq.product_category?.toLowerCase().includes(s) ||
        lead.primary_contact_name?.toLowerCase().includes(s)) &&
      (!statusFilter || q.quotation_status === statusFilter)
    );
  });

  async function openModal(quotation) {
    setActive(quotation);
    setForm({
      quotation_status: quotation.quotation_status || "",
      follow_up_date:   quotation.follow_up_date   || "",
    });
    setFormError(""); setShowModal(true);
    setLL(true); setLogs([]);
    try {
      const res  = await fetch(`${API}/api/quotations/${quotation.id}/logs`, { headers });
      const data = await res.json();
      if (res.ok) setLogs(data.logs || []);
    } catch {}
    finally { setLL(false); }
  }

  async function handleUpdate(e) {
    e.preventDefault();
    if (!form.quotation_status) { setFormError("Please select a status"); return; }
    setSaving(true); setFormError("");
    try {
      const res  = await fetch(`${API}/api/quotations/${active.id}`, {
        method: "PUT", headers, body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setShowModal(false); fetchQuotations();
    } catch (e) { setFormError(e.message); }
    finally { setSaving(false); }
  }

  const hasActiveFilters = search || statusFilter;
  const pendingCount = quotations.filter((q) => q.quotation_status === "Pending").length;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-[1300px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-violet-500">
              Quotation Coordination
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-[26px]">
              Quotations
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatPill count={filtered.length} label="shown" />
            {pendingCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/15">
                <Clock size={11} />
                {pendingCount} pending
              </span>
            )}
          </div>
        </div>

        {/* ── Filters ────────────────────────────────────────────── */}
        <div className="mb-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm grid-cols-1 lg:grid-cols-[minmax(320px,1fr)_210px_auto]">
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              placeholder="Search company, product, contact…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={inputCls("pl-9")}
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatus(e.target.value)}
            className={inputCls("appearance-none cursor-pointer")}
          >
            <option value="">All Statuses</option>
            {QUOTATION_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>

          {hasActiveFilters && (
            <button
              onClick={() => { setSearch(""); setStatus(""); }}
              className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-100 transition-colors"
            >
              <X size={14} /> Clear
            </button>
          )}
        </div>

        {/* ── States ─────────────────────────────────────────────── */}
        {loading && <Skeleton />}
        {!loading && error && (
          <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-600">
            {error}
          </div>
        )}
        {!loading && !error && filtered.length === 0 && (
          <EmptyState
            title="No quotations found"
            subtitle={hasActiveFilters ? "Try adjusting your filters" : "Quotations linked to RFQs will appear here"}
          />
        )}

        {/* ── Cards grid ─────────────────────────────────────────── */}
        {!loading && !error && filtered.length > 0 && (
          <motion.div layout className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {filtered.map((q, i) => {
                const rfq  = q.rfqs   || {};
                const lead = rfq.leads || {};
                const tone = statusTone[q.quotation_status] || defaultTone;

                return (
                  <motion.div
                    key={q.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.2, delay: i * 0.02 }}
                    onClick={() => openModal(q)}
                    className="group relative cursor-pointer overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-lg hover:shadow-slate-200/60"
                  >
                    {/* Left accent bar */}
                    <span className="absolute inset-y-0 left-0 w-[3px] rounded-l-2xl bg-violet-500/0 transition-colors duration-200 group-hover:bg-violet-500" />

                    {/* Status + date */}
                    <div className="flex items-start justify-between gap-2">
                      <Tag tone={tone}>{q.quotation_status || "Awaiting Status"}</Tag>
                      {q.follow_up_date && (
                        <span className="flex items-center gap-1 text-[11px] text-slate-400">
                          <Calendar size={11} />
                          {new Date(q.follow_up_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>

                    {/* Company + product path */}
                    <h3 className="mt-3.5 truncate text-[15px] font-bold text-slate-900">
                      {rfq.company_name || lead.company_name || "—"}
                    </h3>
                    <p className="mt-0.5 flex items-center gap-1 truncate text-[13px] text-slate-400">
                      <Layers size={11} className="shrink-0 text-slate-300" />
                      {[rfq.product_category, rfq.product_sub_category, rfq.product_name].filter(Boolean).join(" › ") || "—"}
                    </p>

                    {/* Meta rows */}
                    <div className="mt-4 space-y-2 border-t border-slate-100 pt-3.5">
                      {rfq.quotation_description && (
                        <div className="flex items-start gap-2 text-[13px] text-slate-600">
                          <FileText size={13} className="shrink-0 mt-0.5 text-slate-400" />
                          <span className="line-clamp-2">{rfq.quotation_description}</span>
                        </div>
                      )}
                      {lead.primary_contact_name && (
                        <div className="flex items-center gap-2 text-[13px] text-slate-600 truncate">
                          <User size={13} className="shrink-0 text-slate-400" />
                          {lead.primary_contact_name}
                        </div>
                      )}
                      {lead.primary_phone && (
                        <div className="flex items-center gap-2 text-[13px] text-slate-600 truncate">
                          <Phone size={13} className="shrink-0 text-slate-400" />
                          {lead.primary_phone}
                        </div>
                      )}
                      {lead.city && (
                        <div className="flex items-center gap-2 text-[13px] text-slate-600 truncate">
                          <MapPin size={13} className="shrink-0 text-slate-400" />
                          {lead.city}
                        </div>
                      )}
                    </div>

                    {/* Hover CTA */}
                    <div className="mt-4 flex items-center justify-end gap-1 text-[12px] font-semibold text-violet-500 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                      Update status <ChevronRight size={13} />
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* ── Update Modal ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showModal && active && (
          <Backdrop onClick={() => setShowModal(false)}>
            <ModalShell>
              {/* Modal header */}
              <div className="mb-5 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="truncate text-lg font-bold tracking-tight text-slate-900">
                    Update Quotation Status
                  </h3>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {active.rfqs?.company_name} — {active.rfqs?.product_name}
                  </p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                >
                  <X size={16} />
                </button>
              </div>

              {/* RFQ summary */}
              <div className="mb-5 overflow-hidden rounded-xl border border-slate-100 bg-slate-50/60">
                <div className="border-b border-slate-100 px-4 py-2.5">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    RFQ Details
                  </span>
                </div>
                <div className="px-4">
                  <Row label="Category"    val={active.rfqs?.product_category ? `${active.rfqs.product_category} › ${active.rfqs.product_sub_category || ""}` : null} icon={TagIcon} />
                  <Row label="Product"     val={active.rfqs?.product_name} icon={Package} />
                  <Row label="Description" val={active.rfqs?.quotation_description} icon={FileText} />
                  <Row label="Contact"     val={active.rfqs?.leads?.primary_contact_name} icon={User} />
                  <Row label="Mobile"      val={active.rfqs?.leads?.primary_phone} icon={Phone} />
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleUpdate}>
                <div className="mb-4">
                  <Label>Quotation Status *</Label>
                  <select
                    value={form.quotation_status}
                    onChange={(e) => setForm((p) => ({ ...p, quotation_status: e.target.value }))}
                    className={inputCls("appearance-none")}
                  >
                    <option value="">— Select Status —</option>
                    {QUOTATION_STATUSES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="mb-4">
                  <Label>Follow-up Date</Label>
                  <input
                    type="date"
                    value={form.follow_up_date}
                    onChange={(e) => setForm((p) => ({ ...p, follow_up_date: e.target.value }))}
                    className={inputCls()}
                  />
                </div>
                {formError && <p className="mb-3 text-sm text-rose-600">{formError}</p>}
                <div className="flex justify-end gap-2.5">
                  <GhostBtn type="button" onClick={() => setShowModal(false)}>Cancel</GhostBtn>
                  <PrimaryBtn type="submit" disabled={saving}>
                    {saving ? "Saving…" : "Save Changes"}
                  </PrimaryBtn>
                </div>
              </form>

              {/* Logs */}
              <div className="mt-6 border-t border-slate-100 pt-5">
                <p className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  <Clock size={11} /> Status History
                </p>
                {logsLoading && <p className="text-sm text-slate-400">Loading logs…</p>}
                {!logsLoading && logs.length === 0 && (
                  <p className="text-sm text-slate-400">No updates yet.</p>
                )}
                <div className="flex flex-col gap-2">
                  {logs.map((log) => {
                    const tone = statusTone[log.quotation_status] || defaultTone;
                    return (
                      <div
                        key={log.id}
                        className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Tag tone={tone}>{log.quotation_status}</Tag>
                          {log.follow_up_date && (
                            <span className="flex items-center gap-1 text-xs text-slate-500 shrink-0">
                              <Calendar size={11} />
                              {new Date(log.follow_up_date).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        <div className="text-right text-[11px] text-slate-400 shrink-0">
                          <div>{log.users?.email || "—"}</div>
                          <div>{new Date(log.updated_at).toLocaleString()}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </ModalShell>
          </Backdrop>
        )}
      </AnimatePresence>
    </div>
  );
}