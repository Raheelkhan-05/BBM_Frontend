// RFQs.jsx — Enhanced with all requested features
import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { useProducts } from "../hooks/useProducts";
import ProductPicker from "./components/ProductPicker";
import LeadPicker from "./components/LeadPicker";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

const emptyRFQ = {
  lead_id: "", company_name: "", product_category: "",
  product_sub_category: "", product_name: "", product_description: "",
  consumption_per_month: "", unit: "", sample_required: false,
  sample_description: "", sample_received_from_customer: false,
  quotation_required: false, quotation_description: "", existing_supplier_brand: "",
  notes: "", target_price: "", tds_available: false,
};

const emptyFollowup = {
  contact_type: "", sample_status_update: "", quotation_status_update: "",
  next_action: "", notes: "", followup_date: "", target_price: "",
  enquiry_status: "", remark: "",
};

/* ── Colour maps ─────────────────────────────────────────────── */
const sampleStatusColor = {
  "Pending":                ["bg-amber-50","text-amber-700","ring-amber-600/15"],
  "Sent to Customer":       ["bg-sky-50","text-sky-700","ring-sky-600/15"],
  "Received from Customer": ["bg-violet-50","text-violet-700","ring-violet-600/15"],
  "Approved":               ["bg-emerald-50","text-emerald-700","ring-emerald-600/15"],
  "Rejected":               ["bg-rose-50","text-rose-700","ring-rose-600/15"],
};

const UNITS = ["kg", "g", "mg", "L", "mL", "pcs", "boxes", "bags", "drums", "tons", "MT"];

const quotationStatusColor = {
  "Pending":          ["bg-amber-50","text-amber-700","ring-amber-600/15"],
  "In Preparation":   ["bg-sky-50","text-sky-700","ring-sky-600/15"],
  "Sent to Customer": ["bg-violet-50","text-violet-700","ring-violet-600/15"],
  "Under Review":     ["bg-pink-50","text-pink-700","ring-pink-600/15"],
  "Accepted":         ["bg-emerald-50","text-emerald-700","ring-emerald-600/15"],
  "Rejected":         ["bg-rose-50","text-rose-700","ring-rose-600/15"],
};

const statusColor = {
  "Open":        ["bg-amber-50","text-amber-700","ring-amber-600/15"],
  "In Progress": ["bg-sky-50","text-sky-700","ring-sky-600/15"],
  "Quoted":      ["bg-violet-50","text-violet-700","ring-violet-600/15"],
  "Sample Sent": ["bg-pink-50","text-pink-700","ring-pink-600/15"],
  "Won":         ["bg-emerald-50","text-emerald-700","ring-emerald-600/15"],
  "Lost":        ["bg-rose-50","text-rose-700","ring-rose-600/15"],
  "On Hold":     ["bg-slate-100","text-slate-600","ring-slate-500/10"],
};

const COMPLETED_ACTIONS = ["Close Enquiry", "No Further Action"];
const ENQUIRY_STATUSES    = ["Open","In Progress","Quoted","Sample Sent","Won","Lost","On Hold"];
const CONTACT_TYPES       = ["Call","Email","WhatsApp","Meeting","Site Visit"];
const SAMPLE_STATUS_OPTIONS    = ["Sample to be Submitted","Sample Submitted","Sample Under Trial","Approved","Rejected"];
const QUOTATION_STATUS_OPTIONS = ["Quotation Submitted","Quotation to be Negotiated","Approved","Rejected"];
const NO_FURTHER_ACTION_REMARKS = [
  "No Response from Customer","Customer Not Interested","No Immediate Requirement",
  "Project Cancelled","Requirement Changed","Budget Issue","Other",
];
const CLOSE_ENQUIRY_REMARKS = [
  "Order Won","Competitor Won the Order","Price Too High","Sample Rejected",
  "Quotation Rejected","Sample & Quotation Rejected","Technical Specification Not Matched",
  "Product Quality Not Approved","Customer Purchased from Another Vendor","Duplicate Enquiry","Other",
];
const NEXT_ACTION_OPTIONS = [
  "Quotation to be Submitted","Sample to be Submitted","Sample to be Tried","Follow-up",
  "Price Negotiation","Send Product Details","Collect Sample Feedback","Collect Quotation Feedback",
  "Order Confirmation","Purchase Order Follow-up","Payment Follow-up","Dispatch Material",
  "Close Enquiry","No Further Action","Other",
];

function deriveEnquiryStatus(form) {
  const { next_action, sample_status_update, quotation_status_update } = form;

  if (next_action === "Close Enquiry") {
    // remark will tell us Won vs Lost
    return "Won"; // will be overridden below if needed
  }
  if (next_action === "No Further Action") return "Lost";
  if (sample_status_update === "Sample Submitted" || next_action === "Sample to be Submitted") return "Sample Sent";
  if (quotation_status_update === "Quotation Submitted" || next_action === "Quotation to be Submitted") return "Quoted";
  if (next_action === "Follow-up" || next_action === "Price Negotiation" || next_action === "Collect Sample Feedback" || next_action === "Collect Quotation Feedback" || next_action === "Purchase Order Follow-up" || next_action === "Order Confirmation") return "In Progress";

  return form.enquiry_status; // fallback: keep current
}

/* ─── Icons ───────────────────────────────────────────────────── */
const Icon = {
  Plus:       (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>,
  Search:     (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>,
  X:          (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>,
  Edit:       (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.12 2.12 0 113 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  Trash:      (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0l-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6h16z"/></svg>,
  Clipboard:  (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>,
  Package:    (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27,6.96 12,12.01 20.73,6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  ChevronDown:(p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><polyline points="6,9 12,15 18,9"/></svg>,
  Filter:     (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><polygon points="22,3 2,3 10,12.46 10,19 14,21 14,12.46 22,3"/></svg>,
  ArrowRight: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>,
  Calendar:   (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  Check:      (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><polyline points="20,6 9,17 4,12"/></svg>,
  Clock:      (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>,
  AlertCircle:(p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  Building:   (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>,
  DollarSign: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
  FileText:   (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10,9 9,9 8,9"/></svg>,
  Beaker:     (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M9 3h6M9 3v8L5.2 18.8A1 1 0 006 20.4h12a1 1 0 00.8-1.6L15 11V3"/></svg>,
  Zap:        (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><polygon points="13,2 3,14 12,14 11,22 21,10 12,10 13,2"/></svg>,
  User:       (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
};

/* ─── Primitives ──────────────────────────────────────────────── */
function Label({ children, required }) {
  return (
    <label className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
      {children}{required && <span className="text-rose-500">*</span>}
    </label>
  );
}
function inputCls(extra = "") {
  return `w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-150 focus:border-indigo-400 focus:ring-3 focus:ring-indigo-100 hover:border-slate-300 ${extra}`;
}
function Field({ label, name, value, onChange, type = "text", placeholder, required, icon: Ic, rows, errors, readOnly }) {
  const hasError = !!errors?.[name];
  const cls = inputCls(`${Ic ? "pl-9" : ""} ${hasError ? "!border-rose-400 !ring-rose-100" : ""} ${readOnly ? "bg-slate-50 text-slate-500 cursor-not-allowed" : ""}`);
  return (
    <div className="flex flex-col">
      {label && <Label required={required}>{label}</Label>}
      <div className="relative">
        {Ic && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"><Ic className="h-4 w-4 text-slate-400" /></span>}
        {rows
          ? <textarea name={name} value={value} onChange={onChange} placeholder={placeholder} rows={rows} readOnly={readOnly} className={inputCls(`resize-none ${hasError ? "!border-rose-400 !ring-rose-100" : ""}`)} />
          : <input name={name} type={type} value={value} onChange={onChange} placeholder={placeholder} readOnly={readOnly} className={cls} />
        }
      </div>
      <FieldError name={name} errors={errors} />
    </div>
  );
}

function SelectField({ label, name, value, onChange, options, required, placeholder, errors }) {
  const hasError = !!errors?.[name];
  return (
    <div className="flex flex-col">
      {label && <Label required={required}>{label}</Label>}
      <div className="relative">
        <select name={name} value={value} onChange={onChange} className={inputCls(`appearance-none pr-9 ${hasError ? "!border-rose-400 !ring-rose-100" : ""}`)}>
          <option value="">{placeholder || `Select ${label}`}</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <Icon.ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>
      <FieldError name={name} errors={errors} />
    </div>
  );
}
function CheckField({ id, name, checked, onChange, label, subtle }) {
  return (
    <label htmlFor={id} className={`flex cursor-pointer items-center gap-2.5 ${subtle ? "" : "rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 hover:bg-slate-100"} text-sm text-slate-700`}>
      <input type="checkbox" id={id} name={name} checked={checked} onChange={onChange} className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-200" />
      {label}
    </label>
  );
}
function SectionDivider({ title, icon: Ic, accent = "indigo" }) {
  const colors = {
    indigo: "text-indigo-600 bg-indigo-50 border-indigo-100",
    teal:   "text-teal-600 bg-teal-50 border-teal-100",
    violet: "text-violet-600 bg-violet-50 border-violet-100",
    amber:  "text-amber-600 bg-amber-50 border-amber-100",
    slate:  "text-slate-600 bg-slate-50 border-slate-200",
  };
  return (
    <div className={`mb-4 mt-2 flex items-center gap-2.5 rounded-lg border px-3 py-2 ${colors[accent]}`}>
      {Ic && <Ic className="h-3.5 w-3.5 flex-shrink-0" />}
      <span className="text-[11px] font-bold uppercase tracking-widest">{title}</span>
    </div>
  );
}
function Tag({ children, tone }) {
  const cls = tone
    ? `${tone[0]} ${tone[1]} ring-1 ring-inset ${tone[2]}`
    : "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-500/10";
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${cls}`}>{children}</span>;
}
function Badge({ children, tone = ["bg-amber-50","text-amber-700","ring-amber-600/15"] }) {
  return <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${tone[0]} ${tone[1]} ring-1 ring-inset ${tone[2]}`}>{children}</span>;
}
function PrimaryBtn({ children, className = "", tone = "indigo", ...props }) {
  const tones = {
    indigo: "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200",
    teal:   "bg-teal-600 hover:bg-teal-700 shadow-teal-200",
    emerald:"bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200",
  };
  return (
    <button {...props} className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${tones[tone]} ${className}`}>
      {children}
    </button>
  );
}
function GhostBtn({ children, className = "", ...props }) {
  return (
    <button {...props} className={`inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition-all duration-150 hover:bg-slate-50 active:scale-[0.98] ${className}`}>
      {children}
    </button>
  );
}
function IconBtn({ children, tone = "slate", title, ...props }) {
  const tones = {
    slate:  "text-slate-400 hover:bg-slate-100 hover:text-slate-700",
    indigo: "text-slate-400 hover:bg-indigo-50 hover:text-indigo-600",
    rose:   "text-slate-400 hover:bg-rose-50 hover:text-rose-600",
    teal:   "text-slate-400 hover:bg-teal-50 hover:text-teal-600",
  };
  return (
    <button {...props} title={title} onClick={(e) => { e.stopPropagation(); props.onClick?.(e); }}
      className={`grid h-8 w-8 place-items-center rounded-lg transition-colors duration-150 ${tones[tone]}`}>
      {children}
    </button>
  );
}
function DetailRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2.5 last:border-0">
      <span className="text-xs font-medium text-slate-400 whitespace-nowrap">{label}</span>
      <span className="text-right text-sm text-slate-700">{value}</span>
    </div>
  );
}
function Backdrop({ onClick, children }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
      onClick={onClick} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 backdrop-blur-sm sm:p-6">
      {children}
    </motion.div>
  );
}
function ModalShell({ children, maxWidth = "max-w-2xl" }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 8 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }} onClick={(e) => e.stopPropagation()}
      className={`max-h-[92vh] w-full overflow-y-auto rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/8 ${maxWidth}`}>
      {children}
    </motion.div>
  );
}
function ModalHeader({ title, subtitle, onClose, accent }) {
  return (
    <div className={`sticky top-0 z-10 flex items-start justify-between gap-4 rounded-t-2xl border-b border-slate-100 px-6 py-4 ${accent || "bg-white"}`}>
      <div className="min-w-0">
        <h3 className="truncate text-base font-bold tracking-tight text-slate-900">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      </div>
      <button onClick={onClose} className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
        <Icon.X className="h-4 w-4" />
      </button>
    </div>
  );
}
function EmptyState({ title, subtitle }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white/50 px-6 py-20 text-center">
      <div className="relative mb-5 h-20 w-20">
        <div className="absolute inset-0 rounded-2xl bg-indigo-50 rotate-6" />
        <div className="absolute inset-0 rounded-2xl bg-indigo-100 -rotate-3" />
        <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
          <Icon.Search className="h-8 w-8 text-indigo-300" />
        </div>
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
        <div key={i} className="h-64 animate-pulse rounded-2xl border border-slate-100 bg-white p-4">
          <div className="mb-3 h-4 w-2/3 rounded-lg bg-slate-100" />
          <div className="mb-2 h-3 w-1/2 rounded-lg bg-slate-100" />
          <div className="mt-4 flex gap-2"><div className="h-5 w-16 rounded-full bg-slate-100" /><div className="h-5 w-14 rounded-full bg-slate-100" /></div>
          <div className="mt-4 space-y-2"><div className="h-3 w-3/4 rounded bg-slate-100" /><div className="h-3 w-2/3 rounded bg-slate-100" /></div>
        </div>
      ))}
    </div>
  );
}

/* ─── Follow-up status helpers ────────────────────────────────── */
function getLatestFollowup(rfq) {
  const fups = rfq.rfq_followups || [];
  if (!fups.length) return null;
  return [...fups].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
}
function getLatestStatus(rfq) { return getLatestFollowup(rfq)?.enquiry_status || null; }
function isCompleted(rfq) {
  const f = getLatestFollowup(rfq);
  return f && COMPLETED_ACTIONS.includes(f.next_action);
}

const TODAY = new Date(); TODAY.setHours(0,0,0,0);
function getFollowupDate(rfq) {
  const f = getLatestFollowup(rfq);
  if (!f?.followup_date) return null;
  const d = new Date(f.followup_date); d.setHours(0,0,0,0); return d;
}
function getFollowupLabel(rfq) {
  const d = getFollowupDate(rfq);
  if (!d) return null;
  const diff = Math.round((d - TODAY) / 86400000);
  if (diff === 0)  return { text: "Today",              cls: "text-orange-600 font-bold" };
  if (diff < 0)    return { text: `${Math.abs(diff)}d overdue`, cls: "text-rose-600 font-bold" };
  if (diff === 1)  return { text: "Tomorrow",           cls: "text-amber-600 font-semibold" };
  return { text: `In ${diff}d`,                         cls: "text-slate-500" };
}

function FieldError({ name, errors }) {
  if (!errors?.[name]) return null;
  return <p className="mt-1 text-[11px] text-rose-500">{errors[name]}</p>;
}

/* Sort: no-followup first, then pending sorted by followup date asc, then completed last */
function sortRFQs(list) {
  const noFup      = list.filter((r) => !(r.rfq_followups?.length));
  const completed  = list.filter((r) => r.rfq_followups?.length && isCompleted(r));
  const pending    = list.filter((r) => r.rfq_followups?.length && !isCompleted(r));

  pending.sort((a, b) => {
    const da = getFollowupDate(a), db = getFollowupDate(b);
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return da - db;
  });

  return [...noFup, ...pending, ...completed];
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════ */
export default function RFQs() {
  const { user, token } = useAuth();
  const isAdmin = user?.role === "Admin";
  const productsHook = useProducts();

  const [rfqs, setRFQs]   = useState([]);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState("");
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [search, setSearch]           = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter]     = useState("");

  const [showRFQModal, setShowRFQModal] = useState(false);
  const [editRFQ, setEditRFQ]           = useState(null);
  const [rfqForm, setRFQForm]           = useState(emptyRFQ);
  const [rfqSaving, setRFQSaving]       = useState(false);
  const [rfqError, setRFQError]               = useState("");
  const [rfqFieldErrors, setRFQFieldErrors]   = useState({});
  const [followupFieldErrors, setFollowupFieldErrors]     = useState({});

  const [detailRFQ, setDetailRFQ] = useState(null);
  const [selectedLead, setSelectedLead] = useState(null);

  const [showFollowupModal, setShowFollowupModal] = useState(false);
  const [activeRFQ, setActiveRFQ]                 = useState(null);
  const [followups, setFollowups]                 = useState([]);
  const [followupsLoading, setFollowupsLoading]   = useState(false);
  const [editFollowup, setEditFollowup]           = useState(null);
  const [followupForm, setFollowupForm]           = useState(emptyFollowup);
  const [followupSaving, setFollowupSaving]       = useState(false);
  const [followupError, setFollowupError]         = useState("");
  const [showFollowupForm, setShowFollowupForm]   = useState(false);

  const remarkOptions =
    followupForm.next_action === "Close Enquiry"    ? CLOSE_ENQUIRY_REMARKS :
    followupForm.next_action === "No Further Action" ? NO_FURTHER_ACTION_REMARKS : [];

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  /* ── Fetch ─────────────────────────────────────────────────── */
  const fetchRFQs = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API}/api/rfqs`, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setRFQs(data.rfqs || []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [token]);

  const fetchLeads = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/rfqs/leads`, { headers });
      const data = await res.json();
      if (res.ok) setLeads(data.leads || []);
    } catch {}
  }, [token]);

  useEffect(() => { fetchRFQs(); fetchLeads(); }, [fetchRFQs, fetchLeads]);

  const categories = [...new Set(rfqs.map((r) => r.product_category).filter(Boolean))];

  const filtered = useMemo(() => {
    const base = rfqs.filter((r) => {
      const q = search.toLowerCase();
      const matchSearch = !q ||
        r.company_name?.toLowerCase().includes(q) ||
        r.product_name?.toLowerCase().includes(q) ||
        r.product_category?.toLowerCase().includes(q) ||
        r.leads?.company_name?.toLowerCase().includes(q);
      return matchSearch &&
        (!categoryFilter || r.product_category === categoryFilter) &&
        (!statusFilter   || getLatestStatus(r) === statusFilter);
    });
    return sortRFQs(base);
  }, [rfqs, search, categoryFilter, statusFilter]);

  /* ── RFQ Modal ─────────────────────────────────────────────── */
  function openAddRFQ() { setEditRFQ(null); setRFQForm(emptyRFQ); setRFQError(""); setSelectedLead(null); setShowRFQModal(true); }
function openEditRFQ(rfq) {
  setEditRFQ(rfq);
  setRFQForm({
    lead_id: rfq.lead_id || "",
    company_name: rfq.company_name || "",
    product_category: rfq.product_category || "",
    product_sub_category: rfq.product_sub_category || "",
    product_name: rfq.product_name || "",
    product_description: rfq.product_description || "",
    consumption_per_month: rfq.consumption_per_month || "",
    unit: rfq.unit || "",
    sample_required: rfq.sample_required || false,
    sample_description: rfq.sample_description || "",
    sample_received_from_customer: rfq.sample_received_from_customer || false,
    quotation_required: rfq.quotation_required || false,
    quotation_description: rfq.quotation_description || "",
    existing_supplier_brand: rfq.existing_supplier_brand || "",
    notes: rfq.notes || "",
    target_price: rfq.target_price || "",
    tds_available: rfq.tds_available || false,
  });
  // ← ADD: restore lead object so picker shows it as selected
  const existingLead = leads.find((l) => l.id === rfq.lead_id) || rfq.leads || null;
  setSelectedLead(existingLead);
  setRFQError("");
  setRFQFieldErrors({});
  setShowRFQModal(true);
}

  function handleRFQChange(e) {
    const { name, value, type, checked } = e.target;
    setRFQForm((p) => ({ ...p, [name]: type === "checkbox" ? checked : value }));
  }
  function handleRFQChange(e) {
  const { name, value, type, checked } = e.target;
  setRFQFieldErrors((prev) => ({ ...prev, [name]: undefined }));
  setRFQForm((p) => ({ ...p, [name]: type === "checkbox" ? checked : value }));
}
function handleProductChange(field, value) {
  setRFQFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  setRFQForm((p) => ({ ...p, [field]: value }));
}
function handleLeadSelect(lead) {
  setSelectedLead(lead);
  setRFQFieldErrors((prev) => ({ ...prev, lead_id: undefined }));
  if (lead) {
    setRFQForm((p) => ({
      ...p,
      lead_id: lead.id,
      company_name: lead.company_name || p.company_name,
    }));
  } else {
    setRFQForm((p) => ({ ...p, lead_id: "", company_name: "" }));
  }
}

async function handleRFQSubmit(e) {
  e.preventDefault();
  const errors = validateRFQ(rfqForm);
  if (Object.keys(errors).length) { setRFQFieldErrors(errors); return; }
  setRFQFieldErrors({});
  setRFQSaving(true); setRFQError("");
  try {
    const url = editRFQ ? `${API}/api/rfqs/${editRFQ.id}` : `${API}/api/rfqs`;
    const res = await fetch(url, { method: editRFQ ? "PUT" : "POST", headers, body: JSON.stringify(rfqForm) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    setShowRFQModal(false); fetchRFQs();
  } catch (e) { setRFQError(e.message); }
  finally { setRFQSaving(false); }
}

  async function handleDeleteRFQ(id) {
    if (!window.confirm("Delete this RFQ? All follow-ups will also be deleted.")) return;
    try {
      const res = await fetch(`${API}/api/rfqs/${id}`, { method: "DELETE", headers });
      if (!res.ok) throw new Error("Delete failed");
      setDetailRFQ(null); fetchRFQs();
    } catch (e) { alert(e.message); }
  }

  /* ── Follow-up Modal ───────────────────────────────────────── */
  async function openFollowups(rfq) {
    setActiveRFQ(rfq); setFollowups([]); setShowFollowupForm(false);
    setEditFollowup(null); setFollowupForm(emptyFollowup);
    setShowFollowupModal(true); setFollowupsLoading(true);
    try {
      const res = await fetch(`${API}/api/rfqs/${rfq.id}/followups`, { headers });
      const data = await res.json();
      if (res.ok) setFollowups(data.followups || []);
    } catch {}
    finally { setFollowupsLoading(false); }
  }

  function validateRFQ(f) {
  const errors = {};
  if (!f.lead_id)                          errors.lead_id              = "Please select a lead.";
  if (!f.product_category?.trim())         errors.product_category     = "Category is required.";
  if (!f.product_sub_category?.trim())     errors.product_sub_category = "Sub-category is required.";
  if (!f.product_name?.trim())             errors.product_name         = "Product name is required.";
  if (!f.consumption_per_month) {
    errors.consumption_per_month = "Consumption is required.";
  } else if (Number(f.consumption_per_month) <= 0) {
    errors.consumption_per_month = "Consumption must be greater than 0.";
  }
  if (!f.unit?.trim())                     errors.unit                 = "Unit is required.";
  if (!f.target_price) {
    errors.target_price = "Target price is required.";
  } else if (Number(f.target_price) < 0) {
    errors.target_price = "Target price cannot be negative.";
  } else if (Number(f.target_price) === 0) {
    errors.target_price = "Target price must be greater than 0.";
  }
  return errors;
}

function validateFollowup(f) {
  const errors = {};
  if (!f.contact_type)      errors.contact_type    = "Contact type is required.";
  if (!f.enquiry_status)    errors.enquiry_status  = "Enquiry status is required.";
  if (!f.followup_date)     errors.followup_date   = "Follow-up date is required.";
  if (!f.target_price) {
    errors.target_price = "Target price is required.";
  } else if (f.target_price < 0) {
    errors.target_price = "Target price cannot be negative.";
  } else if (f.target_price === 0) {
    errors.target_price = "Target price must be greater than 0.";
  }
  if (!f.next_action)       errors.next_action     = "Next step is required.";
  if (COMPLETED_ACTIONS.includes(f.next_action) && !f.remark)
                            errors.remark          = "Remark is required for this action.";
  return errors;
}

  /* Pre-fill from latest followup + RFQ data */
  function buildPrefill(rfq, latestFup) {
    return {
      contact_type:             latestFup?.contact_type             || "",
      sample_status_update:     latestFup?.sample_status_update     || "",
      quotation_status_update:  latestFup?.quotation_status_update  || "",
      next_action:              latestFup?.next_action              || "",
      notes:                    latestFup?.notes                    || rfq?.notes || "",
      followup_date:            "",
      target_price:             latestFup?.target_price != null ? String(latestFup.target_price) : String(rfq?.target_price || ""),
      enquiry_status:           latestFup?.enquiry_status           || "",
      remark:                   "",
    };
  }

function openAddFollowup() {
  setEditFollowup(null);
  const latest = getLatestFollowup(activeRFQ);
  setFollowupForm({
    ...buildPrefill(activeRFQ, latest),
    contact_type: "",       // always blank for new followup
    followup_date: "",      // always blank for new followup
  });
  setFollowupFieldErrors({});
  setFollowupError("");
  setShowFollowupForm(true);
}

function openEditFollowup(f) {
  setEditFollowup(f);
  setFollowupForm({
    contact_type: f.contact_type || "", sample_status_update: f.sample_status_update || "",
    quotation_status_update: f.quotation_status_update || "", next_action: f.next_action || "",
    notes: f.notes || "", followup_date: f.followup_date || "",
    target_price: f.target_price != null ? String(f.target_price) : "",
    enquiry_status: f.enquiry_status || "", remark: f.remark || "",
  });
  setFollowupFieldErrors({});
  setFollowupError(""); setShowFollowupForm(true);
}

function handleFollowupChange(e) {
  const { name, value } = e.target;
  setFollowupFieldErrors((prev) => ({ ...prev, [name]: undefined }));
  setFollowupForm((prev) => {
    const updated = { ...prev, [name]: value };
    // Auto-derive enquiry status whenever relevant fields change
    if (["next_action", "sample_status_update", "quotation_status_update"].includes(name)) {
      updated.enquiry_status = deriveEnquiryStatus(updated);
    }
    return updated;
  });
}

async function handleFollowupSubmit(e) {
  e.preventDefault();
  const errors = validateFollowup(followupForm);
  if (Object.keys(errors).length) { setFollowupFieldErrors(errors); return; }
  setFollowupFieldErrors({});
  setFollowupSaving(true); setFollowupError("");
  try {
    const url = editFollowup
      ? `${API}/api/rfqs/followups/${editFollowup.id}`
      : `${API}/api/rfqs/${activeRFQ.id}/followups`;
    const res = await fetch(url, { method: editFollowup ? "PUT" : "POST", headers, body: JSON.stringify(followupForm) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    setShowFollowupForm(false); setEditFollowup(null);
    const res2 = await fetch(`${API}/api/rfqs/${activeRFQ.id}/followups`, { headers });
    const data2 = await res2.json();
    if (res2.ok) setFollowups(data2.followups || []);
    fetchRFQs();
  } catch (e) { setFollowupError(e.message); }
  finally { setFollowupSaving(false); }
}

  async function handleDeleteFollowup(id) {
    if (!window.confirm("Delete this follow-up?")) return;
    try {
      const res = await fetch(`${API}/api/rfqs/followups/${id}`, { method: "DELETE", headers });
      if (!res.ok) throw new Error("Delete failed");
      setFollowups((p) => p.filter((f) => f.id !== id));
      fetchRFQs();
    } catch (e) { alert(e.message); }
  }

  const hasActiveFilters = search || categoryFilter || statusFilter;

  /* ───────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      {/* Blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -right-32 -top-32 h-80 w-80 rounded-full bg-indigo-100/40 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-teal-100/30 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-3 py-5 sm:px-5 sm:py-7 lg:px-8 lg:py-9">

        {/* ── Header ──────────────────────────────────────────── */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Enquiries</h1>
            <p className="mt-1 text-sm text-slate-500">
              {isAdmin ? "All enquiries across your organisation" : "Enquiries you've added"}
              <span className="mx-1.5 text-slate-300">·</span>
              <span className="font-semibold text-slate-700">{filtered.length}</span> record{filtered.length !== 1 ? "s" : ""}
            </p>
          </div>
          <PrimaryBtn onClick={openAddRFQ} className="mt-1">
            <Icon.Plus className="h-4 w-4" /> Add Enquiry
          </PrimaryBtn>
        </div>

        {/* ── Filters ─────────────────────────────────────────── */}
        <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* Desktop */}
          <div className="hidden lg:flex items-center gap-2 p-2.5">
            <div className="relative flex-1">
              <Icon.Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input placeholder="Search product, company, category…" value={search} onChange={(e) => setSearch(e.target.value)} className={inputCls("pl-10 !rounded-xl")} />
            </div>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={inputCls("!rounded-xl !w-44")}>
              <option value="">All Categories</option>
              {categories.map((c) => <option key={c}>{c}</option>)}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={inputCls("!rounded-xl !w-40")}>
              <option value="">All Statuses</option>
              {ENQUIRY_STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
            {hasActiveFilters && (
              <button onClick={() => { setSearch(""); setCategoryFilter(""); setStatusFilter(""); }}
                className="flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-100">
                <Icon.X className="h-3.5 w-3.5" /> Clear
              </button>
            )}
          </div>
          {/* Mobile */}
          <div className="flex flex-col gap-2.5 p-2.5 lg:hidden">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Icon.Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className={inputCls("pl-9 !rounded-xl")} />
              </div>
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={inputCls("!rounded-xl !w-32")}>
                <option value="">Category</option>
                {categories.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowMoreFilters((v) => !v)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                <Icon.Filter className="h-3.5 w-3.5" /> {showMoreFilters ? "Hide filters" : "More filters"}
              </button>
              {hasActiveFilters && (
                <button onClick={() => { setSearch(""); setCategoryFilter(""); setStatusFilter(""); }}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50">
                  <Icon.X className="h-3.5 w-3.5" /> Clear
                </button>
              )}
            </div>
            <AnimatePresence>
              {showMoreFilters && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-slate-100">
                  <div className="pt-2.5">
                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={inputCls("!rounded-xl")}>
                      <option value="">All Statuses</option>
                      {ENQUIRY_STATUSES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── States ──────────────────────────────────────────── */}
        {loading && <Skeleton />}
        {!loading && error && <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-4 text-sm text-rose-700">{error}</div>}

        {/* ── Grid ────────────────────────────────────────────── */}
        {!loading && !error && (
          <motion.div layout className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {filtered.length === 0 ? (
                <EmptyState title="No enquiries found" subtitle={hasActiveFilters ? "Try adjusting your filters" : "Add your first enquiry to get started"} />
              ) : filtered.map((rfq, i) => {
                const latestFup    = getLatestFollowup(rfq);
                const latestStatus = latestFup?.enquiry_status;
                const tone         = statusColor[latestStatus];
                const followupCount= rfq.rfq_followups?.length || 0;
                const canEdit      = isAdmin || rfq.created_by === user?.id;
                const done         = isCompleted(rfq);
                const fupLabel     = getFollowupLabel(rfq);
                const fupDate      = getFollowupDate(rfq);
                const isOverdue    = fupDate && fupDate < TODAY;
                const isToday      = fupDate && fupDate.getTime() === TODAY.getTime();

                return (
                  <motion.article
                    key={rfq.id}
                    layout
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.22, delay: Math.min(i * 0.02, 0.3) }}
                    onClick={() => setDetailRFQ(rfq)}
                    className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-xl
                      ${done ? "border-slate-200 opacity-75 hover:opacity-100 hover:border-slate-300"
                        : isOverdue ? "border-rose-200 hover:border-rose-300 hover:shadow-rose-100/50"
                        : isToday  ? "border-orange-200 hover:border-orange-300 hover:shadow-orange-100/50"
                        : "border-slate-200 hover:border-indigo-200 hover:shadow-indigo-100/40"
                      }`}
                  >
                    {/* Top accent strip */}
                    <div className={`h-1 w-full ${done ? "bg-gradient-to-r from-slate-300 to-slate-400" : isOverdue ? "bg-gradient-to-r from-rose-400 to-rose-500" : isToday ? "bg-gradient-to-r from-orange-400 to-amber-500" : "bg-gradient-to-r from-indigo-400 to-violet-500"}`} />

                    {/* Completed badge */}
                    {done && (
                      <div className="absolute right-3 top-4 flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                        <Icon.Check className="h-3 w-3" /> Completed
                      </div>
                    )}

                    <div className="flex flex-1 flex-col p-4">
                      {/* Title row */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate text-[15px] font-bold text-slate-900">{rfq.product_name || "Unnamed Product"}</h3>
                          <p className="mt-0.5 truncate text-[13px] text-slate-500">{rfq.company_name || rfq.leads?.company_name}</p>
                        </div>
                        {canEdit && (
                          <div className="flex flex-shrink-0 gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                            <IconBtn tone="indigo" title="Edit" onClick={() => openEditRFQ(rfq)}><Icon.Edit className="h-3.5 w-3.5" /></IconBtn>
                            <IconBtn tone="rose"   title="Delete" onClick={() => handleDeleteRFQ(rfq.id)}><Icon.Trash className="h-3.5 w-3.5" /></IconBtn>
                          </div>
                        )}
                      </div>

                      {/* Tags */}
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {rfq.product_category && <Tag>{rfq.product_category}</Tag>}
                        {latestStatus && <Tag tone={tone}>{latestStatus}</Tag>}
                      </div>

                      {/* Details */}
                      <div className="mt-3.5 flex-1 space-y-1.5 border-t border-slate-100 pt-3 text-[13px] text-slate-600">
                        {rfq.consumption_per_month && (
                          <div className="flex items-center gap-2">
                            <Icon.Package className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                            <span className="truncate">{rfq.consumption_per_month} {rfq.unit || ""}/month</span>
                          </div>
                        )}
                        {(latestFup?.target_price || rfq?.target_price) && (
                          <div className="flex items-center gap-2">
                            <Icon.DollarSign className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                            <span className="truncate font-medium">
                              Target ₹{latestFup?.target_price || rfq?.target_price}
                            </span>
                          </div>
                        )}
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {rfq.sample_required && <Badge tone={["bg-violet-50","text-violet-700","ring-violet-600/15"]}>Sample</Badge>}
                          {rfq.quotation_required && <Badge tone={["bg-sky-50","text-sky-700","ring-sky-600/15"]}>Quotation</Badge>}
                          {rfq.tds_available && <Badge tone={["bg-teal-50","text-teal-700","ring-teal-600/15"]}>TDS</Badge>}
                        </div>
                      </div>

                      {/* Follow-up date indicator */}
                      {!done && fupLabel && (
                        <div className={`mt-2.5 flex items-center gap-1.5 text-[12px] ${fupLabel.cls}`}>
                          {isOverdue ? <Icon.AlertCircle className="h-3.5 w-3.5" /> : <Icon.Clock className="h-3.5 w-3.5" />}
                          Follow-up {fupLabel.text}
                        </div>
                      )}

                      {/* Card footer */}
                      <div className="mt-3.5 flex items-center justify-between border-t border-slate-100 pt-3">
                        {/* Follow-ups button — visible on card face */}
                        <button
                          onClick={(e) => { e.stopPropagation(); openFollowups(rfq); }}
                          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition-colors ${done ? "bg-slate-100 text-slate-500 hover:bg-slate-200" : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"}`}
                        >
                          <Icon.Clipboard className="h-3.5 w-3.5" />
                          Follow-ups ({followupCount})
                        </button>
                        <span className="flex items-center gap-1 text-[12px] font-semibold text-indigo-500 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                          Details <Icon.ArrowRight className="h-3 w-3" />
                        </span>
                      </div>
                    </div>
                  </motion.article>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════
          DETAIL MODAL
      ══════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {detailRFQ && (
          <Backdrop onClick={() => setDetailRFQ(null)}>
            <ModalShell maxWidth="max-w-lg">
              <ModalHeader
                title={detailRFQ.product_name || "Unnamed Product"}
                subtitle={detailRFQ.company_name || detailRFQ.leads?.company_name}
                onClose={() => setDetailRFQ(null)}
                accent="bg-gradient-to-r from-white to-indigo-50/40"
              />
              <div className="p-5">
                {/* Tags */}
                <div className="mb-4 flex flex-wrap gap-1.5">
                  {detailRFQ.product_category && <Tag>{detailRFQ.product_category}</Tag>}
                  {detailRFQ.product_sub_category && <Tag tone={["bg-violet-50","text-violet-700","ring-violet-600/15"]}>{detailRFQ.product_sub_category}</Tag>}
                  {getLatestStatus(detailRFQ) && <Tag tone={statusColor[getLatestStatus(detailRFQ)]}>{getLatestStatus(detailRFQ)}</Tag>}
                  {isCompleted(detailRFQ) && <Tag tone={["bg-slate-100","text-slate-500","ring-slate-500/10"]}>Completed</Tag>}
                </div>

                {/* Lead reference */}
                {detailRFQ.leads && (
                  <div className="mb-3 rounded-xl border border-indigo-100 bg-indigo-50/40 px-4">
                    <div className="flex items-center gap-2 border-b border-indigo-100 py-2">
                      <Icon.Building className="h-3.5 w-3.5 text-indigo-500" />
                      <span className="text-[11px] font-bold uppercase tracking-widest text-indigo-600">Lead Reference</span>
                    </div>
                    <DetailRow label="Company"  value={detailRFQ.leads.company_name} />
                    <DetailRow label="Contact"  value={detailRFQ.leads.primary_contact_name || detailRFQ.leads.contact_name} />
                    <DetailRow label="City"     value={detailRFQ.leads.city} />
                    <DetailRow label="State"    value={detailRFQ.leads.state} />
                    <DetailRow label="Country"  value={detailRFQ.leads.country} />
                  </div>
                )}

                {/* Product */}
                <div className="mb-3 rounded-xl border border-slate-100 bg-slate-50/60 px-4">
                  <div className="flex items-center gap-2 border-b border-slate-100 py-2">
                    <Icon.Package className="h-3.5 w-3.5 text-slate-500" />
                    <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Product Details</span>
                  </div>
                  <DetailRow label="Description"       value={detailRFQ.product_description} />
                  <DetailRow label="Existing Supplier" value={detailRFQ.existing_supplier_brand} />
                  <DetailRow label="Consumption"       value={detailRFQ.consumption_per_month ? `${detailRFQ.consumption_per_month} ${detailRFQ.unit || ""}/month` : null} />
                  <DetailRow label="Target Price"      value={detailRFQ.target_price ? `₹${detailRFQ.target_price}` : null} />
                  <DetailRow label="TDS Available"     value={detailRFQ.tds_available ? "Yes" : null} />
                  <DetailRow label="Notes"             value={detailRFQ.notes} />
                  {isAdmin && <DetailRow label="Owner" value={detailRFQ.users?.email} />}
                  <DetailRow label="Created"           value={new Date(detailRFQ.created_at).toLocaleDateString()} />
                </div>

                {/* Sample */}
                {detailRFQ.sample_required && (
                  <div className="mb-3 rounded-xl border border-violet-100 bg-violet-50/50 px-4">
                    <div className="flex items-center justify-between border-b border-violet-100 py-2">
                      <div className="flex items-center gap-2">
                        <Icon.Beaker className="h-3.5 w-3.5 text-violet-600" />
                        <span className="text-[11px] font-bold uppercase tracking-widest text-violet-700">Sample</span>
                      </div>
                      {detailRFQ.samples?.[0]?.sample_status
                        ? <Tag tone={sampleStatusColor[detailRFQ.samples[0].sample_status]}>{detailRFQ.samples[0].sample_status}</Tag>
                        : <span className="text-[11px] text-slate-400">Awaiting status</span>}
                    </div>
                    {detailRFQ.sample_description && <DetailRow label="Description" value={detailRFQ.sample_description} />}
                    {detailRFQ.sample_received_from_customer && <DetailRow label="Received" value="Yes — sample received from customer" />}
                    {detailRFQ.samples?.[0]?.follow_up_date && <DetailRow label="Follow-up" value={new Date(detailRFQ.samples[0].follow_up_date).toLocaleDateString()} />}
                  </div>
                )}

                {/* Quotation */}
                {detailRFQ.quotation_required && (
                  <div className="mb-3 rounded-xl border border-sky-100 bg-sky-50/50 px-4">
                    <div className="flex items-center justify-between border-b border-sky-100 py-2">
                      <div className="flex items-center gap-2">
                        <Icon.FileText className="h-3.5 w-3.5 text-sky-600" />
                        <span className="text-[11px] font-bold uppercase tracking-widest text-sky-700">Quotation</span>
                      </div>
                      {detailRFQ.quotations?.[0]?.quotation_status
                        ? <Tag tone={quotationStatusColor[detailRFQ.quotations[0].quotation_status]}>{detailRFQ.quotations[0].quotation_status}</Tag>
                        : <span className="text-[11px] text-slate-400">Awaiting status</span>}
                    </div>
                    {detailRFQ.quotation_description && <DetailRow label="Description" value={detailRFQ.quotation_description} />}
                    {detailRFQ.quotations?.[0]?.follow_up_date && <DetailRow label="Follow-up" value={new Date(detailRFQ.quotations[0].follow_up_date).toLocaleDateString()} />}
                  </div>
                )}

                {/* Latest follow-up summary */}
                {getLatestFollowup(detailRFQ) && (
                  <div className="mb-3 rounded-xl border border-teal-100 bg-teal-50/40 px-4">
                    <div className="flex items-center gap-2 border-b border-teal-100 py-2">
                      <Icon.Clipboard className="h-3.5 w-3.5 text-teal-600" />
                      <span className="text-[11px] font-bold uppercase tracking-widest text-teal-700">Latest Follow-up</span>
                    </div>
                    {(() => {
                      const f = getLatestFollowup(detailRFQ);
                      return (
                        <>
                          <DetailRow label="Contact Type"  value={f.contact_type} />
                          <DetailRow label="Next Step"     value={f.next_action} />
                          <DetailRow label="Follow-up Date" value={f.followup_date ? new Date(f.followup_date).toLocaleDateString() : null} />
                          <DetailRow label="Notes"         value={f.notes} />
                          <DetailRow label="Remark"        value={f.remark} />
                        </>
                      );
                    })()}
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap justify-end gap-2.5 border-t border-slate-100 pt-4">
                  <GhostBtn onClick={() => { openFollowups(detailRFQ); setDetailRFQ(null); }}>
                    <Icon.Clipboard className="h-3.5 w-3.5" /> Follow-ups ({detailRFQ.rfq_followups?.length || 0})
                  </GhostBtn>
                  {(isAdmin || detailRFQ.created_by === user?.id) && (
                    <>
                      <GhostBtn className="border-rose-200 text-rose-600 hover:bg-rose-50" onClick={() => handleDeleteRFQ(detailRFQ.id)}>
                        <Icon.Trash className="h-3.5 w-3.5" /> Delete
                      </GhostBtn>
                      <PrimaryBtn onClick={() => { openEditRFQ(detailRFQ); setDetailRFQ(null); }}>
                        <Icon.Edit className="h-3.5 w-3.5" /> Edit RFQ
                      </PrimaryBtn>
                    </>
                  )}
                </div>
              </div>
            </ModalShell>
          </Backdrop>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════
          RFQ ADD / EDIT MODAL
      ══════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showRFQModal && (
          <Backdrop onClick={() => setShowRFQModal(false)}>
            <ModalShell maxWidth="max-w-2xl">
              <ModalHeader
                title={editRFQ ? "Edit Enquiry" : "Add New Enquiry"}
                subtitle={editRFQ ? (editRFQ.company_name || "") : "Fill in the details below"}
                onClose={() => setShowRFQModal(false)}
                accent="bg-gradient-to-r from-white to-teal-50/40"
              />
<form onSubmit={handleRFQSubmit} className="px-5 pb-6 pt-5 sm:px-7">

{/* ── Lead Selection ── */}
<SectionDivider title="Lead" icon={Icon.Building} accent="indigo" />
<div className="mb-5">
  <label className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
    Select Lead <span className="text-rose-500">*</span>
  </label>
  <LeadPicker
    selectedLead={selectedLead}
    onSelect={handleLeadSelect}
    leads={leads}
    error={rfqFieldErrors.lead_id}
  />
  <p className="mt-2 text-[11px] text-slate-400">
    Search by company name, product interest, or city to find the right lead.
  </p>
</div>

  {/* ── Product Details ── */}
  <SectionDivider title="Product Details" icon={Icon.Package} accent="violet" />
  <div className="mb-5 grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
    <div className="sm:col-span-2">
      <ProductPicker
        category={rfqForm.product_category}
        subCategory={rfqForm.product_sub_category}
        productName={rfqForm.product_name}
        onChange={handleProductChange}
        useProductsHook={productsHook}
        errors={rfqFieldErrors}
      />
    </div>
    <Field label="Existing Supplier / Brand" name="existing_supplier_brand" value={rfqForm.existing_supplier_brand} onChange={handleRFQChange} errors={rfqFieldErrors} />
    <div className="sm:col-span-2">
      <Field label="Product Description" name="product_description" value={rfqForm.product_description} onChange={handleRFQChange} rows={2} errors={rfqFieldErrors} />
    </div>
  </div>

  {/* ── Consumption ── */}
  <SectionDivider title="Consumption" icon={Icon.Package} accent="teal" />
  <div className="mb-5 grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
    <Field label="Consumption / Month" name="consumption_per_month" type="number" value={rfqForm.consumption_per_month} onChange={handleRFQChange} required errors={rfqFieldErrors} />
    <SelectField label="Unit" name="unit" value={rfqForm.unit} onChange={handleRFQChange} options={UNITS} required errors={rfqFieldErrors} />
  </div>

  {/* ── Pricing ── */}
  <SectionDivider title="Pricing" icon={Icon.DollarSign} accent="amber" />
  <div className="mb-5 grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
    <Field label="Target Price (₹)" name="target_price" type="number" value={rfqForm.target_price} onChange={handleRFQChange} icon={Icon.DollarSign} placeholder="0.00" required errors={rfqFieldErrors} />
    <div className="flex items-end pb-0.5">
      <CheckField id="tdsAvail" name="tds_available" checked={rfqForm.tds_available} onChange={handleRFQChange} label="TDS Available" />
    </div>
  </div>

  {/* ── Sample & Quotation ── */}
  <SectionDivider title="Sample & Quotation" icon={Icon.Beaker} accent="violet" />
  <div className="mb-5 grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
    <CheckField id="sampleReq" name="sample_required" checked={rfqForm.sample_required} onChange={handleRFQChange} label="Sample Required" />
    <CheckField id="sampleRec" name="sample_received_from_customer" checked={rfqForm.sample_received_from_customer} onChange={handleRFQChange} label="Sample Received from Customer" />
    {rfqForm.sample_required && (
      <div className="sm:col-span-2">
        <Field label="Sample Description" name="sample_description" value={rfqForm.sample_description} onChange={handleRFQChange} errors={rfqFieldErrors} />
      </div>
    )}
    <CheckField id="quotReq" name="quotation_required" checked={rfqForm.quotation_required} onChange={handleRFQChange} label="Quotation Required" />
    {rfqForm.quotation_required && (
      <div className="sm:col-span-2">
        <Field label="Quotation Description" name="quotation_description" value={rfqForm.quotation_description} onChange={handleRFQChange} errors={rfqFieldErrors} />
      </div>
    )}
  </div>

  {/* ── Notes ── */}
  <SectionDivider title="Notes" icon={Icon.FileText} accent="slate" />
  <div className="mb-5">
    <Field label="Notes / Additional Info" name="notes" value={rfqForm.notes} onChange={handleRFQChange} rows={3} placeholder="Any additional notes, context, or observations…" errors={rfqFieldErrors} />
  </div>

  {rfqError && (
    <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{rfqError}</div>
  )}
  <div className="flex flex-wrap justify-end gap-2.5 border-t border-slate-100 pt-5">
    <GhostBtn type="button" onClick={() => setShowRFQModal(false)}>Cancel</GhostBtn>
    <PrimaryBtn type="submit" disabled={rfqSaving}>{rfqSaving ? "Saving…" : editRFQ ? "Update RFQ" : "Add RFQ"}</PrimaryBtn>
  </div>
</form>
            </ModalShell>
          </Backdrop>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════
          FOLLOW-UPS MODAL
      ══════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showFollowupModal && activeRFQ && (
          <Backdrop onClick={() => setShowFollowupModal(false)}>
            <ModalShell maxWidth="max-w-2xl">
              <ModalHeader
                title={`Follow-ups — ${activeRFQ.product_name || "Enquiry"}`}
                subtitle={activeRFQ.company_name || activeRFQ.leads?.company_name}
                onClose={() => setShowFollowupModal(false)}
                accent="bg-gradient-to-r from-white to-teal-50/40"
              />
              <div className="px-5 pb-6 pt-4 sm:px-7">
                {!showFollowupForm && (
                  <PrimaryBtn tone="teal" className="mb-4" onClick={openAddFollowup}>
                    <Icon.Plus className="h-4 w-4" /> Add Follow-up
                  </PrimaryBtn>
                )}

                {/* Inline form */}
                <AnimatePresence>
                  {showFollowupForm && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="mb-5 overflow-hidden rounded-2xl border border-teal-200 bg-teal-50/40"
                    >
                      <div className="flex items-center justify-between border-b border-teal-100 px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Icon.Clipboard className="h-4 w-4 text-teal-600" />
                          <p className="text-sm font-bold text-teal-800">{editFollowup ? "Edit Follow-up" : "New Follow-up"}</p>
                        </div>
                        <button onClick={() => { setShowFollowupForm(false); setEditFollowup(null); }}
                          className="grid h-7 w-7 place-items-center rounded-lg text-teal-500 hover:bg-teal-100">
                          <Icon.X className="h-4 w-4" />
                        </button>
                      </div>
                      <form onSubmit={handleFollowupSubmit} className="p-4">
                        <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                          <SelectField label="Contact Type"    name="contact_type"   value={followupForm.contact_type}   onChange={handleFollowupChange} options={CONTACT_TYPES}     required errors={followupFieldErrors} />
                          
                          <div className="flex flex-col">
                            <Label>Enquiry Status</Label>
                            <div className={inputCls("bg-slate-50 text-slate-600 cursor-not-allowed")}>
                              {followupForm.enquiry_status || <span className="text-slate-400">Auto-filled from Next Step</span>}
                            </div>
                          </div>
                          <Field label="Follow-up Date" name="followup_date" type="date" value={followupForm.followup_date} onChange={handleFollowupChange} icon={Icon.Calendar} required errors={followupFieldErrors} />
                          <Field label="Target Price (₹)" name="target_price" type="number" value={followupForm.target_price} onChange={handleFollowupChange} icon={Icon.DollarSign} placeholder="0.00" required errors={followupFieldErrors} />
                          <SelectField label="Sample Status Update"    name="sample_status_update"    value={followupForm.sample_status_update}    onChange={handleFollowupChange} options={SAMPLE_STATUS_OPTIONS}    errors={followupFieldErrors} />
                          <SelectField label="Quotation Status Update" name="quotation_status_update" value={followupForm.quotation_status_update} onChange={handleFollowupChange} options={QUOTATION_STATUS_OPTIONS} errors={followupFieldErrors} />
                          <SelectField label="Next Step" name="next_action" value={followupForm.next_action} onChange={handleFollowupChange} options={NEXT_ACTION_OPTIONS} required errors={followupFieldErrors} />
                          {remarkOptions.length > 0 && (
                            <SelectField label="Remark" name="remark" value={followupForm.remark} onChange={handleFollowupChange} options={remarkOptions} required errors={followupFieldErrors} />
                          )}
                          <div className="sm:col-span-2">
                            <Field label="Notes" name="notes" value={followupForm.notes} onChange={handleFollowupChange} rows={3} placeholder="Observations, discussion points, customer feedback…" />
                          </div>
                        </div>
                        {followupError && (
                          <div className="mb-3 mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">{followupError}</div>
                        )}
                        <div className="mt-3 flex justify-end gap-2.5">
                          <GhostBtn type="button" onClick={() => { setShowFollowupForm(false); setEditFollowup(null); }}>Cancel</GhostBtn>
                          <PrimaryBtn tone="teal" type="submit" disabled={followupSaving}>
                            {followupSaving ? "Saving…" : editFollowup ? "Update" : "Add Follow-up"}
                          </PrimaryBtn>
                        </div>
                      </form>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* List */}
                {followupsLoading && (
                  <p className="py-8 text-center text-sm text-slate-400">Loading follow-ups…</p>
                )}
                {!followupsLoading && followups.length === 0 && (
                  <EmptyState title="No follow-ups yet" subtitle="Add the first one to start tracking this enquiry" />
                )}

                <div className="flex flex-col gap-3">
                  <AnimatePresence>
                    {[...followups]
                      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                      .map((f) => {
                        const fDate = f.followup_date ? new Date(f.followup_date) : null;
                        fDate?.setHours(0,0,0,0);
                        const isClosed = ["Won", "Lost"].includes(f.enquiry_status) || COMPLETED_ACTIONS.includes(f.next_action);
                        const isOver  = !isClosed && fDate && fDate < TODAY;
                        const isToday2= !isClosed && fDate && fDate.getTime() === TODAY.getTime();
                        return (
                          <motion.div
                            key={f.id}
                            layout
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className={`overflow-hidden rounded-xl border bg-white ${isToday2 ? "border-orange-200" : isOver ? "border-rose-200" : "border-slate-200"}`}
                          >
                            {/* Strip */}
                            {(isToday2 || isOver) && (
                              <div className={`h-1 w-full ${isToday2 ? "bg-orange-400" : "bg-rose-400"}`} />
                            )}
                            <div className="p-3.5">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {f.contact_type && <Tag>{f.contact_type}</Tag>}
                                  {f.enquiry_status && <Tag tone={statusColor[f.enquiry_status]}>{f.enquiry_status}</Tag>}
                                  {f.remark !== "Order Won" && f.followup_date && (
                                    <span className={`flex items-center gap-1 text-xs ${isToday2 ? "text-orange-600 font-bold" : isOver ? "text-rose-600 font-bold" : "text-slate-400"}`}>
                                      <Icon.Calendar className="h-3 w-3" />
                                      {new Date(f.followup_date).toLocaleDateString()}
                                      {isToday2 && " — Today"}
                                      {isOver && " — Overdue"}
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-shrink-0 gap-0.5">
                                  <IconBtn tone="indigo" title="Edit" onClick={() => openEditFollowup(f)}><Icon.Edit className="h-3.5 w-3.5" /></IconBtn>
                                  <IconBtn tone="rose" title="Delete" onClick={() => handleDeleteFollowup(f.id)}><Icon.Trash className="h-3.5 w-3.5" /></IconBtn>
                                </div>
                              </div>

                              <div className="mt-2.5 grid grid-cols-1 gap-1 text-[13px] text-slate-600 sm:grid-cols-2">
                                {f.sample_status_update && (
                                  <div className="flex items-center gap-1.5">
                                    <Icon.Beaker className="h-3.5 w-3.5 text-violet-400" />
                                    <span>{f.sample_status_update}</span>
                                  </div>
                                )}
                                {f.quotation_status_update && (
                                  <div className="flex items-center gap-1.5">
                                    <Icon.FileText className="h-3.5 w-3.5 text-sky-400" />
                                    <span>{f.quotation_status_update}</span>
                                  </div>
                                )}
                                {f.target_price && (
                                  <div className="flex items-center gap-1.5">
                                    <Icon.DollarSign className="h-3.5 w-3.5 text-teal-400" />
                                    <span>Target ₹{f.target_price}</span>
                                  </div>
                                )}
                                {f.next_action && (
                                  <div className={`flex items-center gap-1.5 ${COMPLETED_ACTIONS.includes(f.next_action) ? "text-slate-400" : ""}`}>
                                    <Icon.ArrowRight className="h-3.5 w-3.5" />
                                    <span className="font-medium">{f.next_action}</span>
                                  </div>
                                )}
                              </div>
                              {f.notes && (
                                <p className="mt-2 text-[13px] text-slate-600 border-t border-slate-100 pt-2">{f.notes}</p>
                              )}
                              {f.remark && (
                                <p className="mt-1 text-[12px] italic text-slate-500">{f.remark}</p>
                              )}
                              <p className="mt-2 text-[11px] text-slate-400">Added {new Date(f.created_at).toLocaleString()}</p>
                            </div>
                          </motion.div>
                        );
                      })}
                  </AnimatePresence>
                </div>
              </div>
            </ModalShell>
          </Backdrop>
        )}
      </AnimatePresence>
    </div>
  );
}