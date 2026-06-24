// components/ProspectHistoryModal.jsx
import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

/* ─── date helpers ─────────────────────────────────────────────── */
function fmtDateTime(d) {
  if (!d) return null;
  // Supabase sometimes returns "2024-06-15 09:32:11+00" or "2024-06-15 09:32:11"
  // Normalize to a proper ISO string so JS always parses it as UTC
  const iso = String(d)
    .replace(" ", "T")          // replace space separator with T
    .replace(/(\+00(:00)?)?$/, "Z"); // ensure it ends with Z if no offset present
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
    timeZone: "Asia/Kolkata",   // explicit IST — never rely on browser timezone
  });
}

function fmtDate(d) {
  if (!d) return null;
  const iso = String(d)
    .replace(" ", "T")
    .replace(/(\+00(:00)?)?$/, "Z");
  // date-only strings should not get the Z treatment — check first
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(String(d).trim());
  const dt = isDateOnly
    ? new Date(String(d) + "T00:00:00+05:30") // treat as IST midnight
    : new Date(iso);
  return dt.toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}
function relTime(d) {
  if (!d) return "";
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/* ─── field-level diff ─────────────────────────────────────────── */
function diffSnapshots(prev, curr, fieldLabels) {
  const changes = [];
  for (const [field, label] of Object.entries(fieldLabels)) {
    const a = prev ? (prev[field] ?? null) : null;
    const b = curr[field] ?? null;
    const norm = (v) => (v === null || v === undefined || v === "" ? null : String(v));
    if (norm(a) !== norm(b)) changes.push({ field, label, from: a, to: b });
  }
  return changes;
}

/* ─── field label maps ─────────────────────────────────────────── */
const PROSPECT_FIELDS = {
  company_name: "Company Name", industry: "Industry", country: "Country",
  state: "State", city: "City", zone: "Zone", route: "Route", source: "Source",
  next_action: "Next Action", next_action_date: "Action Date",
  feedback: "Feedback", prospect_status: "Status",
};
const LEAD_FIELDS = {
  company_name: "Company Name", country: "Country", state: "State", city: "City",
  zone: "Zone", route: "Route", primary_contact_name: "Contact Name",
  primary_designation: "Designation", primary_phone: "Phone", primary_email: "Email",
  secondary_contact_name: "2nd Contact", secondary_designation: "2nd Designation",
  secondary_phone: "2nd Phone", secondary_email: "2nd Email",
  nature_of_business: "Business Type", manufacturing_industry: "Mfg. Industry",
  company_website: "Website", gst_number: "GST", linkedin_profile: "LinkedIn",
  potential_product_category: "Product Category",
  potential_product_sub_category: "Sub Category", potential_product_name: "Product",
};
const RFQ_FIELDS = {
  product_category: "Category", product_sub_category: "Sub Category",
  product_name: "Product", product_description: "Description",
  consumption_per_month: "Consumption/Month", unit: "Unit",
  target_price: "Target Price", existing_supplier_brand: "Existing Supplier",
  sample_required: "Sample Required", sample_description: "Sample Desc.",
  sample_received_from_customer: "Sample Received",
  quotation_required: "Quotation Required", quotation_description: "Quotation Desc.",
  notes: "Notes", tds_available: "TDS Available",
};
const FOLLOWUP_FIELDS = {
  contact_type: "Contact Type", followup_date: "Follow-up Date",
  enquiry_status: "Enquiry Status", next_action: "Next Action",
  target_price: "Target Price", sample_status_update: "Sample Update",
  quotation_status_update: "Quotation Update", notes: "Notes", remark: "Remark",
};

/* ─── icons ────────────────────────────────────────────────────── */
const Ic = {
  X:        (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>,
  User:     (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  Building: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>,
  Briefcase:(p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>,
  Package:  (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27,6.96 12,12.01 20.73,6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  Msg:      (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  Flask:    (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round"><path d="M9 3h6m-3 0v6l-4 8h10l-4-8V3"/></svg>,
  File:     (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>,
  Activity: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/></svg>,
  Clock:    (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>,
  Plus:     (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>,
  Edit:     (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  Trash:    (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>,
  MapPin:   (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  Spin:     (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>,
  Alert:    (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  ChevD:    (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><polyline points="6,9 12,15 18,9"/></svg>,
  ChevR:    (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><polyline points="9,18 15,12 9,6"/></svg>,
  Logs:     (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
  ArrowR:   (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>,
};

/* ─── action badge ─────────────────────────────────────────────── */
const ACTION_STYLE = {
  created: { bg: "bg-emerald-100 text-emerald-800", dot: "bg-emerald-500", Icon: Ic.Plus },
  updated: { bg: "bg-amber-100 text-amber-800",     dot: "bg-amber-500",   Icon: Ic.Edit },
  deleted: { bg: "bg-red-100 text-red-800",         dot: "bg-red-500",     Icon: Ic.Trash },
};

function ActionBadge({ action }) {
  const s = ACTION_STYLE[action] || ACTION_STYLE.updated;
  const Icon = s.Icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-semibold px-1.5 py-0.5 text-[10px] ring-1 ring-inset ring-black/5 ${s.bg}`}>
      <Icon className="h-2.5 w-2.5 flex-shrink-0" />{action}
    </span>
  );
}

/* ─── diff row ─────────────────────────────────────────────────── */
function DiffRow({ label, from, to, action }) {
  if (action === "created") {
    if (to === null || to === undefined || to === "") return null;
    return (
      <div className="flex items-start gap-2 py-1 border-b border-slate-100 last:border-0">
        <span className="w-36 flex-shrink-0 text-[11px] text-slate-400 pt-0.5">{label}</span>
        <span className="text-[12px] text-emerald-700 font-medium break-all">{String(to)}</span>
      </div>
    );
  }
  if (action === "deleted") {
    if (from === null || from === undefined || from === "") return null;
    return (
      <div className="flex items-start gap-2 py-1 border-b border-slate-100 last:border-0">
        <span className="w-36 flex-shrink-0 text-[11px] text-slate-400 pt-0.5">{label}</span>
        <span className="text-[12px] text-red-600 line-through break-all">{String(from)}</span>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2 py-1 border-b border-slate-100 last:border-0">
      <span className="w-36 flex-shrink-0 text-[11px] text-slate-400 pt-0.5">{label}</span>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[12px] text-slate-400 line-through break-all">
          {from !== null && from !== undefined && from !== "" ? String(from) : <span className="italic">empty</span>}
        </span>
        <span className="text-slate-300 text-xs">→</span>
        <span className="text-[12px] text-slate-800 font-medium break-all">
          {to !== null && to !== undefined && to !== "" ? String(to) : <span className="italic text-slate-400">empty</span>}
        </span>
      </div>
    </div>
  );
}

/* ─── timeline event ───────────────────────────────────────────── */
function TimelineEvent({ action, ts, byEmail, diffs = [], entityLabel, entityType, isLast }) {
  const [open, setOpen] = useState(diffs.length <= 4);
  const s = ACTION_STYLE[action] || ACTION_STYLE.updated;
  const TYPE_COLOR = {
    Prospect:    "bg-indigo-100 text-indigo-700",
    Lead:        "bg-teal-100 text-teal-700",
    Enquiry:     "bg-violet-100 text-violet-700",
    "Follow-up": "bg-amber-100 text-amber-700",
    Sample:      "bg-emerald-100 text-emerald-700",
    Quotation:   "bg-rose-100 text-rose-700",
  };
  return (
    <div className="relative flex gap-3">
      <div className="flex flex-col items-center flex-shrink-0 w-5">
        <div className={`mt-1 h-3 w-3 rounded-full ring-2 ring-white ${s.dot}`} />
        {!isLast && <div className="flex-1 w-0.5 bg-slate-200 mt-1" />}
      </div>
      <div className="flex-1 min-w-0 pb-5">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <ActionBadge action={action} />
          {entityType && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ring-black/5 ${TYPE_COLOR[entityType] || "bg-slate-100 text-slate-600"}`}>
              {entityType}
            </span>
          )}
          {entityLabel && <span className="text-[12px] text-slate-700 font-medium truncate max-w-[180px]">{entityLabel}</span>}
        </div>
        <div className="flex flex-wrap items-center gap-3 mb-2 text-[11px] text-slate-400">
          <span className="flex items-center gap-1"><Ic.Clock className="h-3 w-3" />{fmtDateTime(ts)}</span>
          {byEmail && <span className="flex items-center gap-1"><Ic.User className="h-3 w-3" />{byEmail}</span>}
          <span className="text-slate-300">{relTime(ts)}</span>
        </div>
        {diffs.length > 0 && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 overflow-hidden">
            <button type="button" onClick={() => setOpen(v => !v)}
              className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 transition-colors">
              <span>{diffs.length} field{diffs.length !== 1 ? "s" : ""} {action === "created" ? "set" : action === "deleted" ? "cleared" : "changed"}</span>
              {open ? <Ic.ChevD className="h-3.5 w-3.5" /> : <Ic.ChevR className="h-3.5 w-3.5" />}
            </button>
            <AnimatePresence initial={false}>
              {open && (
                <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden">
                  <div className="px-3 pb-2">
                    {diffs.map(({ field, label, from, to }) => (
                      <DiffRow key={field} label={label} from={from} to={to} action={action} />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   SECTION — premium header: colored left-rail + icon bubble
══════════════════════════════════════════════════════════════════ */
const SECTION_THEME = {
  slate:   { rail: "bg-slate-400",   iconBg: "bg-slate-100",    iconTxt: "text-slate-500",   hdrBg: "bg-white",        hdrBdr: "border-slate-200",  txt: "text-slate-700"  },
  indigo:  { rail: "bg-indigo-500",  iconBg: "bg-indigo-100",   iconTxt: "text-indigo-600",  hdrBg: "bg-indigo-50/70", hdrBdr: "border-indigo-200", txt: "text-indigo-800" },
  teal:    { rail: "bg-teal-500",    iconBg: "bg-teal-100",     iconTxt: "text-teal-600",    hdrBg: "bg-teal-50/70",   hdrBdr: "border-teal-200",   txt: "text-teal-800"   },
  violet:  { rail: "bg-violet-500",  iconBg: "bg-violet-100",   iconTxt: "text-violet-600",  hdrBg: "bg-violet-50/70", hdrBdr: "border-violet-200", txt: "text-violet-800" },
  amber:   { rail: "bg-amber-500",   iconBg: "bg-amber-100",    iconTxt: "text-amber-600",   hdrBg: "bg-amber-50/70",  hdrBdr: "border-amber-200",  txt: "text-amber-800"  },
  emerald: { rail: "bg-emerald-500", iconBg: "bg-emerald-100",  iconTxt: "text-emerald-600", hdrBg: "bg-emerald-50/70",hdrBdr:"border-emerald-200", txt: "text-emerald-800"},
  rose:    { rail: "bg-rose-500",    iconBg: "bg-rose-100",     iconTxt: "text-rose-600",    hdrBg: "bg-rose-50/70",   hdrBdr: "border-rose-200",   txt: "text-rose-800"   },
};

function Section({ id, title, icon: Icon, count, accent = "slate", defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  const th = SECTION_THEME[accent] || SECTION_THEME.slate;
  return (
    <div id={id} className="rounded-xl border border-slate-200 overflow-hidden mb-3 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`w-full flex items-center gap-3 px-4 py-3 border-b transition-colors ${th.hdrBg} ${open ? th.hdrBdr : "border-transparent"}`}
      >
        <div className={`w-1 self-stretch rounded-full flex-shrink-0 ${th.rail}`} />
        {Icon && (
          <span className={`flex h-7 w-7 items-center justify-center rounded-lg flex-shrink-0 ${th.iconBg}`}>
            <Icon className={`h-3.5 w-3.5 ${th.iconTxt}`} />
          </span>
        )}
        <span className={`flex-1 text-left text-[11px] font-bold uppercase tracking-widest ${th.txt}`}>{title}</span>
        {count !== undefined && (
          <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold tabular-nums ${th.iconBg} ${th.iconTxt}`}>{count}</span>
        )}
        <span className={`opacity-40 ${th.txt}`}>
          {open ? <Ic.ChevD className="h-4 w-4" /> : <Ic.ChevR className="h-4 w-4" />}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden">
            <div className="bg-white p-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── key-value pair ───────────────────────────────────────────── */
function KV({ label, value, mono }) {
  const v = value === true ? "Yes" : value === false ? "No" : value;
  if (!v && v !== 0) return null;
  return (
    <div className="flex gap-2 py-1.5 border-b border-slate-100 last:border-0">
      <span className="w-36 flex-shrink-0 text-[11px] text-slate-400 font-medium">{label}</span>
      <span className={`text-[12px] text-slate-800 break-all ${mono ? "font-mono" : ""}`}>{String(v)}</span>
    </div>
  );
}

function Tag({ children, cls }) {
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${cls || "bg-slate-100 text-slate-700"}`}>
      {children}
    </span>
  );
}

function Empty({ text }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400">
      <div className="h-12 w-12 rounded-xl bg-slate-100 flex items-center justify-center">
        <Ic.Activity className="h-5 w-5 opacity-30" />
      </div>
      <p className="text-xs font-medium text-slate-400">{text}</p>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   STATS BAR — premium card design with icon bubble + progress track
══════════════════════════════════════════════════════════════════ */
const STAT_CONFIG = [
  {
    key: "leads",      label: "Leads",      Icon: Ic.Briefcase, sectionId: "section-leads",
    from: "#4f46e5", to: "#818cf8",
    ringClr: "hover:ring-indigo-300/60", shadowClr: "hover:shadow-indigo-100",
    trackBg: "bg-indigo-100", trackFill: "bg-indigo-500",
    numClr: "text-indigo-700", iconClr: "text-indigo-500",
  },
  {
    key: "enquiries",  label: "Enquiries",  Icon: Ic.Package,   sectionId: "section-enquiries",
    from: "#6d28d9", to: "#a78bfa",
    ringClr: "hover:ring-violet-300/60", shadowClr: "hover:shadow-violet-100",
    trackBg: "bg-violet-100", trackFill: "bg-violet-500",
    numClr: "text-violet-700", iconClr: "text-violet-500",
  },
  {
    key: "followups",  label: "Follow-ups", Icon: Ic.Msg,        sectionId: "section-followups",
    from: "#b45309", to: "#fbbf24",
    ringClr: "hover:ring-amber-300/60",  shadowClr: "hover:shadow-amber-100",
    trackBg: "bg-amber-100", trackFill: "bg-amber-500",
    numClr: "text-amber-700", iconClr: "text-amber-500",
  },
  {
    key: "samples",    label: "Samples",    Icon: Ic.Flask,      sectionId: "section-samples",
    from: "#0f766e", to: "#2dd4bf",
    ringClr: "hover:ring-teal-300/60",   shadowClr: "hover:shadow-teal-100",
    trackBg: "bg-teal-100", trackFill: "bg-teal-500",
    numClr: "text-teal-700", iconClr: "text-teal-500",
  },
  {
    key: "quotations", label: "Quotations", Icon: Ic.File,       sectionId: "section-quotations",
    from: "#9f1239", to: "#fb7185",
    ringClr: "hover:ring-rose-300/60",   shadowClr: "hover:shadow-rose-100",
    trackBg: "bg-rose-100", trackFill: "bg-rose-500",
    numClr: "text-rose-700", iconClr: "text-rose-500",
  },
];

function StatsBar({ data, scrollContainerRef }) {
  const leads     = data.leads || [];
  const rfqs      = leads.flatMap(l => l.rfqs || []);
  const followups = rfqs.flatMap(r => r.followups || []);
  const samples   = rfqs.flatMap(r => r.samples || []);
  const quotes    = rfqs.flatMap(r => r.quotations || []);
  const total     = leads.length + rfqs.length + followups.length + samples.length + quotes.length;

  const counts = {
    leads: leads.length, enquiries: rfqs.length,
    followups: followups.length, samples: samples.length, quotations: quotes.length,
  };

  function scrollToSection(sectionId) {
    const container = scrollContainerRef?.current;
    const target = document.getElementById(sectionId);
    if (!target) return;
    if (container) {
      const offset =
        target.getBoundingClientRect().top -
        container.getBoundingClientRect().top +
        container.scrollTop - 16;
      container.scrollTo({ top: offset, behavior: "smooth" });
    } else {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">At a Glance</p>
        <p className="text-[10px] text-slate-400 font-medium tabular-nums">{total} records total</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
        {STAT_CONFIG.map((s) => {
          const count   = counts[s.key] ?? 0;
          const isEmpty = count === 0;
          const Icon    = s.Icon;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => !isEmpty && scrollToSection(s.sectionId)}
              disabled={isEmpty}
              className={[
                "group relative flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 text-left",
                "border border-slate-200/80 ring-2 ring-transparent",
                "transition-all duration-200 ease-out overflow-hidden",
                isEmpty
                  ? "cursor-default opacity-40"
                  : [
                      "cursor-pointer",
                      "hover:-translate-y-0.5",
                      `hover:shadow-lg ${s.shadowClr}`,
                      s.ringClr,
                      "active:translate-y-0 active:shadow-md active:scale-[0.99]",
                    ].join(" "),
              ].join(" ")}
            >
              {/* ambient glow on hover */}
              {!isEmpty && (
                <div
                  className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-xl"
                  style={{ background: `radial-gradient(ellipse at top left, ${s.from}12, transparent 65%)` }}
                />
              )}

              {/* icon bubble */}
              <span
                className="relative z-10 flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-110"
                style={isEmpty ? { background: "#f1f5f9" } : { background: `linear-gradient(135deg, ${s.from}22, ${s.to}40)` }}
              >
                <Icon className={`h-4 w-4 ${isEmpty ? "text-slate-300" : s.iconClr}`} />
              </span>

              {/* count + label stacked */}
              <div className="relative z-10 min-w-0">
                <div className={`text-xl font-black leading-none tracking-tight tabular-nums ${isEmpty ? "text-slate-200" : "text-slate-700"}`}>
                  {count}
                </div>
                <div className="text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400 mt-0.5 leading-none">
                  {s.label}
                </div>
              </div>

              {/* arrow indicator */}
              {!isEmpty && (
                <Ic.ArrowR className={`relative z-10 ml-auto h-3 w-3 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all duration-200 group-hover:translate-x-0.5 ${s.iconClr}`} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   CARD HEADER — replaces flat gradient headers on entity cards
══════════════════════════════════════════════════════════════════ */
function CardHeader({ eyebrow, title, subtitle, badges = [], accentFrom, accentTo }) {
  return (
    <div className="px-4 py-3.5 relative overflow-hidden"
      style={{ background: `linear-gradient(135deg, ${accentFrom}, ${accentTo})` }}
    >
      {/* subtle grid texture overlay */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg,transparent,transparent 15px,white 15px,white 16px)," +
            "repeating-linear-gradient(90deg,transparent,transparent 15px,white 15px,white 16px)",
        }}
      />
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && <p className="text-[9px] font-black uppercase tracking-[0.15em] text-white/50 mb-0.5">{eyebrow}</p>}
          <h4 className="text-[13px] font-bold text-white leading-snug">{title}</h4>
          {subtitle && <p className="text-[11px] text-white/55 mt-0.5">{subtitle}</p>}
        </div>
        {badges.length > 0 && (
          <div className="flex flex-wrap gap-1 justify-end flex-shrink-0">
            {badges.map((b, i) => (
              <span key={i} className="rounded-md bg-white/15 text-white text-[10px] font-semibold px-2 py-0.5 ring-1 ring-white/20">
                {b}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   TAB: OVERVIEW
══════════════════════════════════════════════════════════════════ */
function OverviewTab({ data }) {
  const { prospect, leads } = data;
  const rfqs      = leads.flatMap(l => (l.rfqs || []).map(r => ({ ...r, _leadName: l.company_name })));
  const followups = leads.flatMap(l =>
    (l.rfqs || []).flatMap(r =>
      (r.followups || []).map(f => ({
        ...f,
        _product: r.product_name || r.product_category || "RFQ",
        _leadName: l.company_name,
      }))
    )
  ).sort((a, b) => new Date(b.followup_date || b.created_at) - new Date(a.followup_date || a.created_at));
  const samples    = rfqs.flatMap(r => (r.samples    || []).map(s => ({ ...s, _product: r.product_name || r.product_category })));
  const quotations = rfqs.flatMap(r => (r.quotations || []).map(q => ({ ...q, _product: r.product_name || r.product_category })));

  return (
    <div className="space-y-3">

      {/* Prospect Details */}
      <Section icon={Ic.Building} title="Prospect Details" accent="indigo" defaultOpen>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
          <KV label="Company"      value={prospect.company_name} />
          <KV label="Industry"     value={prospect.industry} />
          <KV label="Status"       value={prospect.prospect_status} />
          <KV label="Source"       value={prospect.source} />
          <KV label="Country"      value={prospect.country} />
          <KV label="State"        value={prospect.state} />
          <KV label="City"         value={prospect.city} />
          <KV label="Zone"         value={prospect.zone} />
          <KV label="Route"        value={prospect.route} />
          <KV label="Next Action"  value={prospect.next_action} />
          <KV label="Action Date"  value={fmtDate(prospect.next_action_date)} />
          <KV label="Created By"   value={prospect.users?.email} />
          <KV label="Created"      value={fmtDateTime(prospect.created_at)} />
          <KV label="Last Updated" value={fmtDateTime(prospect.updated_at)} />
        </div>
        {prospect.feedback && (
          <div className="mt-3 rounded-lg bg-indigo-50 border border-indigo-100 p-3">
            <p className="text-[9px] font-black uppercase tracking-[0.12em] text-indigo-400 mb-1.5">Feedback / Notes</p>
            <p className="text-[12px] text-slate-700 leading-relaxed">{prospect.feedback}</p>
          </div>
        )}
      </Section>

      {/* Leads */}
      {leads.length > 0 && (
        <Section id="section-leads" icon={Ic.Briefcase} title="Leads" accent="teal" count={leads.length} defaultOpen>
          <div className="space-y-3">
            {leads.map((lead, idx) => (
              <div key={lead.id} className="rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <CardHeader
                  eyebrow={`Lead ${idx + 1}`}
                  title={lead.company_name}
                  subtitle={[lead.city, lead.state, lead.country].filter(Boolean).join(" · ")}
                  badges={[lead.nature_of_business, lead.deleted_at ? "Deleted" : null].filter(Boolean)}
                  accentFrom="#0f766e" accentTo="#6d28d9"
                />
                <div className="p-4 space-y-3">
                  <Section icon={Ic.User} title="Primary Contact" accent="teal" defaultOpen>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                      <KV label="Name"        value={lead.primary_contact_name} />
                      <KV label="Designation" value={lead.primary_designation} />
                      <KV label="Phone"       value={lead.primary_phone} mono />
                      <KV label="Email"       value={lead.primary_email} mono />
                    </div>
                  </Section>
                  {lead.secondary_contact_name && (
                    <Section icon={Ic.User} title="Secondary Contact" accent="teal" defaultOpen={false}>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                        <KV label="Name"        value={lead.secondary_contact_name} />
                        <KV label="Designation" value={lead.secondary_designation} />
                        <KV label="Phone"       value={lead.secondary_phone} mono />
                        <KV label="Email"       value={lead.secondary_email} mono />
                      </div>
                    </Section>
                  )}
                  <Section icon={Ic.Building} title="Company & Product Info" accent="indigo" defaultOpen={false}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                      <KV label="Business Type"    value={lead.nature_of_business} />
                      <KV label="Mfg. Industry"    value={lead.manufacturing_industry} />
                      <KV label="Website"          value={lead.company_website} mono />
                      <KV label="GST"              value={lead.gst_number} mono />
                      <KV label="LinkedIn"         value={lead.linkedin_profile} mono />
                      <KV label="Product Category" value={lead.potential_product_category} />
                      <KV label="Sub Category"     value={lead.potential_product_sub_category} />
                      <KV label="Product"          value={lead.potential_product_name} />
                      <KV label="Created By"       value={lead.users?.email} />
                      <KV label="Created"          value={fmtDateTime(lead.created_at)} />
                      <KV label="Last Updated"     value={fmtDateTime(lead.updated_at)} />
                    </div>
                  </Section>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Enquiries */}
      {rfqs.length > 0 && (
        <Section id="section-enquiries" icon={Ic.Package} title="Enquiries (RFQs)" accent="violet" count={rfqs.length} defaultOpen>
          <div className="space-y-3">
            {rfqs.map((rfq, idx) => (
              <div key={rfq.id} className="rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <CardHeader
                  eyebrow={`Enquiry ${idx + 1} · ${rfq._leadName}`}
                  title={rfq.product_name || rfq.product_category || "—"}
                  subtitle={[rfq.product_category, rfq.product_sub_category].filter(Boolean).join(" › ")}
                  badges={[
                    rfq.sample_required ? "Sample" : null,
                    rfq.quotation_required ? "Quotation" : null,
                    rfq.deleted_at ? "Deleted" : null,
                  ].filter(Boolean)}
                  accentFrom="#5b21b6" accentTo="#7c3aed"
                />
                <div className="p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                    <KV label="Product"           value={rfq.product_name} />
                    <KV label="Category"          value={rfq.product_category} />
                    <KV label="Sub Category"      value={rfq.product_sub_category} />
                    <KV label="Description"       value={rfq.product_description} />
                    <KV label="Consumption/Mo"    value={rfq.consumption_per_month != null ? `${rfq.consumption_per_month} ${rfq.unit || ""}`.trim() : null} />
                    <KV label="Target Price"      value={rfq.target_price != null ? `₹ ${rfq.target_price}` : null} />
                    <KV label="Existing Supplier" value={rfq.existing_supplier_brand} />
                    <KV label="TDS Available"     value={rfq.tds_available} />
                    <KV label="Sample Required"   value={rfq.sample_required} />
                    <KV label="Sample Desc."      value={rfq.sample_description} />
                    <KV label="Quotation Req."    value={rfq.quotation_required} />
                    <KV label="Notes"             value={rfq.notes} />
                    <KV label="Created By"        value={rfq.users?.email} />
                    <KV label="Created"           value={fmtDateTime(rfq.created_at)} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Follow-ups */}
      {followups.length > 0 && (
        <Section id="section-followups" icon={Ic.Msg} title="Follow-ups" accent="amber" count={followups.length} defaultOpen>
          <div className="space-y-3">
            {followups.map((f, idx) => (
              <div key={f.id} className="rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <CardHeader
                  eyebrow={`Follow-up ${idx + 1} · ${f._product}`}
                  title={`${fmtDate(f.followup_date) || "No date"} · ${f.contact_type || "Contact"}`}
                  badges={[f.enquiry_status, f.deleted_at ? "Deleted" : null].filter(Boolean)}
                  accentFrom="#92400e" accentTo="#d97706"
                />
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                    <KV label="Date"             value={fmtDate(f.followup_date)} />
                    <KV label="Contact Type"     value={f.contact_type} />
                    <KV label="Enquiry Status"   value={f.enquiry_status} />
                    <KV label="Next Action"      value={f.next_action} />
                    <KV label="Target Price"     value={f.target_price != null ? `₹ ${f.target_price}` : null} />
                    <KV label="Sample Update"    value={f.sample_status_update} />
                    <KV label="Quotation Update" value={f.quotation_status_update} />
                    <KV label="Created By"       value={f.users?.email} />
                    <KV label="Created"          value={fmtDateTime(f.created_at)} />
                  </div>
                  {f.notes && (
                    <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
                      <p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-400 mb-1.5">Notes</p>
                      <p className="text-[12px] text-slate-700 leading-relaxed">{f.notes}</p>
                    </div>
                  )}
                  {f.remark && (
                    <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                      <p className="text-[9px] font-black uppercase tracking-[0.12em] text-amber-500 mb-1.5">Remark</p>
                      <p className="text-[12px] text-slate-800 leading-relaxed">{f.remark}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Samples */}
      {samples.length > 0 && (
        <Section id="section-samples" icon={Ic.Flask} title="Samples" accent="emerald" count={samples.length} defaultOpen>
          <div className="space-y-3">
            {samples.map((s, idx) => (
              <div key={s.id} className="rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <CardHeader
                  eyebrow={`Sample ${idx + 1} · ${s._product}`}
                  title={s.sample_status || "Status not set"}
                  badges={[s.deleted_at ? "Deleted" : null].filter(Boolean)}
                  accentFrom="#0f766e" accentTo="#059669"
                />
                <div className="p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                    <KV label="Status"     value={s.sample_status} />
                    <KV label="Follow-up"  value={fmtDate(s.follow_up_date)} />
                    <KV label="Created By" value={s.users?.email} />
                    <KV label="Created"    value={fmtDateTime(s.created_at)} />
                    <KV label="Updated"    value={fmtDateTime(s.updated_at)} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Quotations */}
      {quotations.length > 0 && (
        <Section id="section-quotations" icon={Ic.File} title="Quotations" accent="rose" count={quotations.length} defaultOpen>
          <div className="space-y-3">
            {quotations.map((q, idx) => (
              <div key={q.id} className="rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <CardHeader
                  eyebrow={`Quotation ${idx + 1} · ${q._product}`}
                  title={q.quotation_status || "Status not set"}
                  badges={[q.deleted_at ? "Deleted" : null].filter(Boolean)}
                  accentFrom="#881337" accentTo="#e11d48"
                />
                <div className="p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                    <KV label="Status"     value={q.quotation_status} />
                    <KV label="Follow-up"  value={fmtDate(q.follow_up_date)} />
                    <KV label="Created By" value={q.users?.email} />
                    <KV label="Created"    value={fmtDateTime(q.created_at)} />
                    <KV label="Updated"    value={fmtDateTime(q.updated_at)} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {leads.length === 0 && <Empty text="No leads, enquiries or follow-ups linked to this prospect yet." />}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   TAB: LOGS
══════════════════════════════════════════════════════════════════ */
const LOG_FILTERS = [
  { key: "all",       label: "All"       },
  { key: "Prospect",  label: "Prospect"  },
  { key: "Lead",      label: "Lead"      },
  { key: "Enquiry",   label: "Enquiry"   },
  { key: "Follow-up", label: "Follow-up" },
  { key: "Sample",    label: "Sample"    },
  { key: "Quotation", label: "Quotation" },
];

function buildAllEvents(data) {
  const { prospect, prospectLogs, leads } = data;
  const events = [];
  const chronoLogs = [...(prospectLogs || [])].reverse();
  chronoLogs.forEach((log, i) => {
    events.push({
      id: `p-${log.id}`, action: log.action || "updated",
      ts: log.changed_at, byEmail: log.users?.email,
      entityType: "Prospect", entityLabel: prospect.company_name,
      diffs: diffSnapshots(i > 0 ? chronoLogs[i - 1] : null, log, PROSPECT_FIELDS),
    });
  });
  (leads || []).forEach(lead => {
    const lc = [...(lead.logs || [])].reverse();
    lc.forEach((log, i) => {
      events.push({
        id: `l-${log.id}`, action: log.action || "updated",
        ts: log.changed_at, byEmail: log.users?.email,
        entityType: "Lead", entityLabel: lead.company_name,
        diffs: diffSnapshots(i > 0 ? lc[i - 1] : null, log, LEAD_FIELDS),
      });
    });
    (lead.rfqs || []).forEach(rfq => {
      const rc = [...(rfq.logs || [])].reverse();
      rc.forEach((log, i) => {
        events.push({
          id: `r-${log.id}`, action: log.action || "updated",
          ts: log.changed_at, byEmail: log.users?.email,
          entityType: "Enquiry", entityLabel: rfq.product_name || rfq.product_category,
          diffs: diffSnapshots(i > 0 ? rc[i - 1] : null, log, RFQ_FIELDS),
        });
      });
      (rfq.followups || []).forEach(f => {
        const fc = [...(f.logs || [])].reverse();
        fc.forEach((log, i) => {
          events.push({
            id: `f-${log.id}`, action: log.action || "updated",
            ts: log.changed_at, byEmail: log.users?.email,
            entityType: "Follow-up", entityLabel: fmtDate(f.followup_date) || "Follow-up",
            diffs: diffSnapshots(i > 0 ? fc[i - 1] : null, log, FOLLOWUP_FIELDS),
          });
        });
      });
      (rfq.samples || []).forEach(s => {
        const sa = [...(s.logs || [])];
        sa.forEach((log, i) => {
          const prev = i < sa.length - 1 ? sa[i + 1] : null;
          events.push({
            id: `sl-${log.id}`, action: "updated",
            ts: log.updated_at, byEmail: log.users?.email,
            entityType: "Sample", entityLabel: rfq.product_name || "Sample",
            diffs: [
              { field: "sample_status",  label: "Status",    from: prev?.sample_status ?? null,           to: log.sample_status },
              { field: "follow_up_date", label: "Follow-up", from: fmtDate(prev?.follow_up_date) ?? null, to: fmtDate(log.follow_up_date) },
            ].filter(d => String(d.from) !== String(d.to)),
          });
        });
      });
      (rfq.quotations || []).forEach(q => {
        const qa = [...(q.logs || [])];
        qa.forEach((log, i) => {
          const prev = i < qa.length - 1 ? qa[i + 1] : null;
          events.push({
            id: `ql-${log.id}`, action: "updated",
            ts: log.updated_at, byEmail: log.users?.email,
            entityType: "Quotation", entityLabel: rfq.product_name || "Quotation",
            diffs: [
              { field: "quotation_status", label: "Status",    from: prev?.quotation_status ?? null,        to: log.quotation_status },
              { field: "follow_up_date",   label: "Follow-up", from: fmtDate(prev?.follow_up_date) ?? null, to: fmtDate(log.follow_up_date) },
            ].filter(d => String(d.from) !== String(d.to)),
          });
        });
      });
    });
  });
  return events.sort((a, b) => new Date(b.ts) - new Date(a.ts));
}

const FILTER_ACTIVE_CLS = {
  all:        "bg-slate-800 text-white shadow-sm shadow-slate-400/20",
  Prospect:   "bg-indigo-600 text-white shadow-sm shadow-indigo-400/20",
  Lead:       "bg-teal-600 text-white shadow-sm shadow-teal-400/20",
  Enquiry:    "bg-violet-600 text-white shadow-sm shadow-violet-400/20",
  "Follow-up":"bg-amber-500 text-white shadow-sm shadow-amber-400/20",
  Sample:     "bg-emerald-600 text-white shadow-sm shadow-emerald-400/20",
  Quotation:  "bg-rose-600 text-white shadow-sm shadow-rose-400/20",
};

function LogsTab({ data, logsLoading }) {
  const [activeFilter, setActiveFilter] = useState("all");
  const allEvents = buildAllEvents(data);
  const filtered  = activeFilter === "all" ? allEvents : allEvents.filter(e => e.entityType === activeFilter);
  const countFor  = (key) => key === "all" ? allEvents.length : allEvents.filter(e => e.entityType === key).length;

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-5">
        {LOG_FILTERS.map(f => {
          const cnt = countFor(f.key);
          if (f.key !== "all" && cnt === 0) return null;
          const isActive = activeFilter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={[
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-all duration-150",
                isActive
                  ? FILTER_ACTIVE_CLS[f.key]
                  : "bg-white border border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700 hover:bg-slate-50",
              ].join(" ")}
            >
              {f.label}
              <span className={[
                "rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                isActive ? "bg-white/20 text-current" : "bg-slate-100 text-slate-500",
              ].join(" ")}>{cnt}</span>
            </button>
          );
        })}
      </div>
      {logsLoading && (
        <div className="flex items-center gap-2 text-[12px] text-slate-400 mb-4 px-1">
          <Ic.Spin className="h-3.5 w-3.5 animate-spin" />Loading logs…
        </div>
      )}
      {!logsLoading && filtered.length === 0 && (
        <Empty text={activeFilter === "all" ? "No activity recorded yet." : `No ${activeFilter} logs found.`} />
      )}
      {filtered.map((ev, i) => (
        <TimelineEvent
          key={ev.id} action={ev.action} ts={ev.ts} byEmail={ev.byEmail}
          diffs={ev.diffs} entityType={ev.entityType} entityLabel={ev.entityLabel}
          isLast={i === filtered.length - 1}
        />
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MAIN MODAL
══════════════════════════════════════════════════════════════════ */
const TABS = [
  { id: "overview", label: "Overview", Icon: Ic.Building },
  { id: "logs",     label: "Logs",     Icon: Ic.Logs     },
];

export default function ProspectHistoryModal({ prospect, token, onClose }) {
  const [activeTab,   setActiveTab]   = useState("overview");
  const [coreData,    setCoreData]    = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);
  const [error,       setError]       = useState("");
  const abortRef       = useRef(null);
  const scrollPanelRef = useRef(null);

  const loadData = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;
    setLoading(true); setError(""); setCoreData(null);
    try {
      const res1  = await window.fetch(`${API}/api/prospects/${prospect.id}/history?include=core`, { headers: { Authorization: `Bearer ${token}` }, signal });
      const json1 = await res1.json();
      if (!res1.ok) throw new Error(json1.message || "Failed to load");
      setCoreData(json1.data);
      setLoading(false);
      setLogsLoading(true);
      const res2  = await window.fetch(`${API}/api/prospects/${prospect.id}/history?include=logs`, { headers: { Authorization: `Bearer ${token}` }, signal });
      const json2 = await res2.json();
      if (!res2.ok) throw new Error(json2.message || "Failed to load logs");
      setCoreData(json2.data);
    } catch (e) {
      if (e.name === "AbortError") return;
      if (!coreData) setError(e.message);
    } finally {
      setLogsLoading(false);
    }
  }, [prospect.id, token]);

  useEffect(() => { loadData(); return () => abortRef.current?.abort(); }, [loadData]);

  const totalLogs = coreData
    ? [
        ...(coreData.prospectLogs || []),
        ...(coreData.leads || []).flatMap(l => [
          ...(l.logs || []),
          ...(l.rfqs || []).flatMap(r => [
            ...(r.logs || []),
            ...(r.followups  || []).flatMap(f => f.logs || []),
            ...(r.samples    || []).flatMap(s => s.logs || []),
            ...(r.quotations || []).flatMap(q => q.logs || []),
          ]),
        ]),
      ].length
    : 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          onClick={e => e.stopPropagation()}
          className="ml-auto flex h-full w-full max-w-3xl flex-col bg-slate-50 shadow-2xl"
        >
          {/* Header */}
          <div className="flex-shrink-0 bg-white border-b border-slate-200 px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-white">
                    <Ic.Activity className="h-2.5 w-2.5" /> Admin · Company History
                  </span>
                </div>
                <h2 className="text-[17px] font-black text-slate-900 truncate tracking-tight">{prospect.company_name}</h2>
                <p className="text-[11px] text-slate-400 mt-0.5 font-medium">
                  {[prospect.industry, prospect.city].filter(Boolean).join(" · ")}
                </p>
              </div>
              <button onClick={onClose}
                className="flex-shrink-0 h-8 w-8 grid place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors">
                <Ic.X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex-shrink-0 bg-white border-b border-slate-200">
            <nav className="flex px-3 gap-1">
              {TABS.map(tab => {
                const active = activeTab === tab.id;
                const badge  = tab.id === "logs" && totalLogs > 0 ? totalLogs : null;
                return (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    className={[
                      "flex items-center gap-1.5 px-3.5 py-3 text-[12px] font-semibold border-b-2 whitespace-nowrap transition-all duration-150",
                      active ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300",
                    ].join(" ")}
                  >
                    <tab.Icon className="h-3.5 w-3.5 flex-shrink-0" />
                    {tab.label}
                    {badge != null && (
                      <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${active ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-500"}`}>
                        {badge}
                      </span>
                    )}
                    {tab.id === "logs" && logsLoading && (
                      <Ic.Spin className="h-3 w-3 animate-spin text-slate-400" />
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Content */}
          <div ref={scrollPanelRef} className="flex-1 overflow-y-auto">
            {loading && (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
                <Ic.Spin className="h-8 w-8 animate-spin" />
                <p className="text-sm font-medium">Loading…</p>
              </div>
            )}
            {!loading && error && (
              <div className="m-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-4">
                <Ic.Alert className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-800">Failed to load history</p>
                  <p className="text-xs text-red-600 mt-0.5">{error}</p>
                  <button onClick={loadData} className="mt-2 text-xs font-semibold text-red-700 underline">Retry</button>
                </div>
              </div>
            )}
            {!loading && !error && coreData && (
              <div className="p-4 sm:p-5">
                {activeTab === "overview" && <StatsBar data={coreData} scrollContainerRef={scrollPanelRef} />}
                {activeTab === "overview" && <OverviewTab data={coreData} />}
                {activeTab === "logs"     && <LogsTab data={coreData} logsLoading={logsLoading} />}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}