// Prospects.jsx — Matching Leads.jsx design theme
import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { useRoutes } from "../hooks/useRoutes";
import LocationPicker from "./components/LocationPicker";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

const CACHE_KEY = "prospects_cache";
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const INDUSTRIES = [
  "Pharmaceuticals", "Textiles", "Chemicals", "Food & Beverage", "Automotive",
  "Electronics", "Plastics & Rubber", "Paper & Packaging", "Construction",
  "Agriculture", "Metal & Mining", "Oil & Gas", "Paints & Coatings",
  "Adhesives & Sealants", "Water Treatment", "Cosmetics & Personal Care", "Other",
];

const SOURCES = [
  "Cold Call", "Cold Mail", "LinkedIn", "Referral", "Trade Show / Exhibition",
  "Website Inquiry", "Email Campaign", "Walk-in", "Google Search",
  "Industry Directory", "Existing Customer", "Partner / Agent", "Other",
];

const NEXT_ACTIONS = [
  "Call", "Email", "WhatsApp", "Visit", "No Action",
];

const PROSPECT_STATUS = [
  "Interested", "Not Relavent", "Duplicate", "Dormat", "Converted to Lead",
];

const emptyForm = {
  company_name: "",
  industry: "",
  country: "India",
  state: "",
  city: "",
  zone: "",
  route: "",
  source: "",
  next_action: "",
  next_action_date: "",
  feedback: "",
  prospect_status: "", 
};

/* ─── Icons (same set from Leads.jsx + extras) ────────────────── */
const Icon = {
  Plus: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  Search: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
    </svg>
  ),
  X: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  ),
  Edit: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.12 2.12 0 113 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
  Trash: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0l-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6h16z" />
    </svg>
  ),
  MapPin: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
    </svg>
  ),
  Building: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9,22 9,12 15,12 15,22" />
    </svg>
  ),
  Factory: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M2 20h20M4 20V10l5 4v-4l5 4v-4l5 4v6" />
    </svg>
  ),
  ChevronDown: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <polyline points="6,9 12,15 18,9" />
    </svg>
  ),
  Filter: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <polygon points="22,3 2,3 10,12.46 10,19 14,21 14,12.46 22,3" />
    </svg>
  ),
  ArrowRight: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  ),
  Calendar: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  Source: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  ),
  MessageSquare: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  ),
  Zap: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <polygon points="13,2 3,14 12,14 11,22 21,10 12,10 13,2" />
    </svg>
  ),
  User: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  ),
  Clock: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12,6 12,12 16,14" />
    </svg>
  ),
  CheckCircle: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22,4 12,14.01 9,11.01" />
    </svg>
  ),
  Radar: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
    </svg>
  ),
  Activity: (p) => (
    <svg
      {...p}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),

};

/* ─── Source accent colours ───────────────────────────────────── */
const SOURCE_ACCENT = {
  "Cold Call":              "bg-blue-50 text-blue-700 ring-blue-600/20",
  "LinkedIn":               "bg-sky-50 text-sky-700 ring-sky-600/20",
  "Referral":               "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  "Trade Show / Exhibition":"bg-violet-50 text-violet-700 ring-violet-600/20",
  "Website Inquiry":        "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
  "Email Campaign":         "bg-amber-50 text-amber-700 ring-amber-600/20",
  "Walk-in":                "bg-rose-50 text-rose-700 ring-rose-600/20",
  "Google Search":          "bg-orange-50 text-orange-700 ring-orange-600/20",
  "Industry Directory":     "bg-teal-50 text-teal-700 ring-teal-600/20",
  "Existing Customer":      "bg-green-50 text-green-700 ring-green-600/20",
  "Partner / Agent":        "bg-purple-50 text-purple-700 ring-purple-600/20",
};

const SOURCE_GRADIENT = {
  "Cold Call":              "from-blue-400 to-blue-600",
  "LinkedIn":               "from-sky-400 to-sky-600",
  "Referral":               "from-emerald-400 to-teal-500",
  "Trade Show / Exhibition":"from-violet-500 to-purple-600",
  "Website Inquiry":        "from-indigo-400 to-indigo-600",
  "Email Campaign":         "from-amber-400 to-orange-500",
  "Walk-in":                "from-rose-400 to-rose-600",
  "Google Search":          "from-orange-400 to-orange-600",
  "Industry Directory":     "from-teal-400 to-teal-600",
  "Existing Customer":      "from-green-400 to-green-600",
  "Partner / Agent":        "from-purple-400 to-purple-600",
};

const NEXT_ACTION_ACCENT = {
  "Call":           "bg-blue-50 text-blue-700",
  "Email":          "bg-indigo-50 text-indigo-700",
  "WhatsApp":       "bg-green-50 text-green-700",
  "Meeting":        "bg-violet-50 text-violet-700",
  "Send Brochure":  "bg-amber-50 text-amber-700",
  "Send Sample":    "bg-teal-50 text-teal-700",
  "Send Quotation": "bg-rose-50 text-rose-700",
  "Follow-up":      "bg-orange-50 text-orange-700",
  "Demo":           "bg-purple-50 text-purple-700",
  "No Action":      "bg-slate-100 text-slate-600",
};

/* ─── Primitives (identical to Leads.jsx) ─────────────────────── */
function Label({ children, required }) {
  return (
    <label className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
      {children}
      {required && <span className="text-rose-500">*</span>}
    </label>
  );
}

function FieldError({ name, errors }) {
  if (!errors?.[name]) return null;
  return <p className="mt-1 text-[11px] text-rose-500">{errors[name]}</p>;
}

function inputCls(extra = "") {
  return `w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-150 focus:border-indigo-400 focus:ring-3 focus:ring-indigo-100 hover:border-slate-300 ${extra}`;
}

function Field({ label, name, value, onChange, type = "text", placeholder, required, icon: Ic, errors }) {
  const hasError = !!errors?.[name];
  return (
    <div className="flex flex-col">
      {label && <Label required={required}>{label}</Label>}
      <div className="relative">
        {Ic && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
            <Ic className="h-4 w-4 text-slate-400" />
          </span>
        )}
        <input
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={inputCls(`${Ic ? "pl-9" : ""} ${hasError ? "!border-rose-400 !ring-rose-100" : ""}`)}
        />
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
        <select
          name={name}
          value={value}
          onChange={onChange}
          className={inputCls(`appearance-none pr-9 ${hasError ? "!border-rose-400 !ring-rose-100" : ""}`)}
        >
          <option value="">{placeholder || `Select ${label}`}</option>
          {options.map((opt) =>
            typeof opt === "string"
              ? <option key={opt} value={opt}>{opt}</option>
              : <option key={opt.value} value={opt.value}>{opt.label}</option>
          )}
        </select>
        <Icon.ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>
      <FieldError name={name} errors={errors} />
    </div>
  );
}

function TextareaField({ label, name, value, onChange, placeholder, rows = 3, errors }) {
  const hasError = !!errors?.[name];
  return (
    <div className="flex flex-col">
      {label && <Label>{label}</Label>}
      <textarea
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        className={inputCls(`resize-none ${hasError ? "!border-rose-400 !ring-rose-100" : ""}`)}
      />
      <FieldError name={name} errors={errors} />
    </div>
  );
}

function SectionDivider({ title, icon: Ic, accent = "indigo" }) {
  const colors = {
    indigo: "text-indigo-600 bg-indigo-50 border-indigo-100",
    teal:   "text-teal-600 bg-teal-50 border-teal-100",
    violet: "text-violet-600 bg-violet-50 border-violet-100",
    amber:  "text-amber-600 bg-amber-50 border-amber-100",
    rose:   "text-rose-600 bg-rose-50 border-rose-100",
    slate:  "text-slate-600 bg-slate-50 border-slate-200",
    blue: "text-blue-600 bg-blue-50 border-blue-100",
  };
  return (
    <div className={`mb-4 mt-2 flex items-center gap-2.5 rounded-lg border px-3 py-2 ${colors[accent]}`}>
      {Ic && <Ic className="h-3.5 w-3.5 flex-shrink-0" />}
      <span className="text-[11px] font-bold uppercase tracking-widest">{title}</span>
    </div>
  );
}

function Tag({ children, className = "" }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${className || "bg-slate-100 text-slate-600 ring-slate-500/15"}`}>
      {children}
    </span>
  );
}

function PrimaryBtn({ children, className = "", ...props }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-200 transition-all duration-150 hover:bg-indigo-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  );
}

function GhostBtn({ children, className = "", ...props }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition-all duration-150 hover:bg-slate-50 active:scale-[0.98] ${className}`}
    >
      {children}
    </button>
  );
}

function IconBtn({ children, tone = "slate", title, ...props }) {
  const tones = {
    slate:  "text-slate-400 hover:bg-slate-100 hover:text-slate-700",
    indigo: "text-slate-400 hover:bg-indigo-50 hover:text-indigo-600",
    rose:   "text-slate-400 hover:bg-rose-50 hover:text-rose-600",
  };
  return (
    <button
      {...props}
      title={title}
      onClick={(e) => { e.stopPropagation(); props.onClick?.(e); }}
      className={`grid h-8 w-8 place-items-center rounded-lg transition-colors duration-150 ${tones[tone]}`}
    >
      {children}
    </button>
  );
}

function DetailRow({ label, value, mono = false }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2.5 last:border-0">
      <span className="text-xs font-medium text-slate-400 whitespace-nowrap">{label}</span>
      <span className={`text-right text-sm text-slate-700 ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

function Backdrop({ onClick, children }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={onClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 backdrop-blur-sm sm:p-6"
    >
      {children}
    </motion.div>
  );
}

function ModalShell({ children, maxWidth = "max-w-2xl" }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97, y: 8 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      onClick={(e) => e.stopPropagation()}
      className={`max-h-[92vh] w-full overflow-y-auto rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/8 ${maxWidth}`}
    >
      {children}
    </motion.div>
  );
}

function ModalHeader({ title, subtitle, onClose, accent }) {
  return (
    <div className={`sticky top-0 z-10 flex items-start justify-between gap-4 rounded-t-2xl px-6 py-4 ${accent || "bg-white"} border-b border-slate-100`}>
      <div>
        <h3 className="text-base font-bold tracking-tight text-slate-900">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      </div>
      <button
        onClick={onClose}
        className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
      >
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
          <Icon.Radar className="h-8 w-8 text-indigo-300" />
        </div>
      </div>
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-52 animate-pulse rounded-2xl border border-slate-100 bg-white p-4">
          <div className="mb-2 h-4 w-1/2 rounded-lg bg-slate-100" />
          <div className="mb-4 h-3 w-1/3 rounded-lg bg-slate-100" />
          <div className="mt-3 flex gap-2">
            <div className="h-5 w-16 rounded-full bg-slate-100" />
            <div className="h-5 w-14 rounded-full bg-slate-100" />
          </div>
          <div className="mt-4 space-y-2">
            <div className="h-3 w-3/4 rounded bg-slate-100" />
            <div className="h-3 w-2/3 rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Overdue badge helper ───────────────────────────────────────── */
function isOverdue(dateStr) {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date(new Date().toDateString());
}

function isToday(dateStr) {
  if (!dateStr) return false;
  return new Date(dateStr).toDateString() === new Date().toDateString();
}

function ActionDateBadge({ date }) {
  if (!date) return null;
  const overdue = isOverdue(date);
  const today   = isToday(date);
  const label   = new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  if (overdue)
    return <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-600 ring-1 ring-rose-200"><Icon.Clock className="h-3 w-3" /> {label}</span>;
  if (today)
    return <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-600 ring-1 ring-amber-200"><Icon.Zap className="h-3 w-3" /> Today</span>;
  return <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-500 ring-1 ring-slate-200"><Icon.Calendar className="h-3 w-3" /> {label}</span>;
}

/* ═══════════════════════════════════════════════════════════════
   VALIDATION
═══════════════════════════════════════════════════════════════ */
function validateForm(f) {
  const errors = {};
  if (!f.company_name.trim()) errors.company_name = "Company name is required.";
  if (!f.industry)            errors.industry     = "Industry is required.";
  if (!f.country.trim())      errors.country      = "Country is required.";
  if (!f.state.trim())        errors.state        = "State is required.";
  if (!f.city.trim())         errors.city         = "City is required.";
  if (!f.source)              errors.source       = "Source is required.";
  if (!f.next_action)         errors.next_action  = "Next action is required.";
  if (!f.next_action_date)    errors.next_action_date = "Next action date is required.";
  if (!f.prospect_status)    errors.prospect_status = "Prospect Status is required.";
  return errors;
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════ */
export default function Prospects() {
  const { user, token } = useAuth();
  const isAdmin = user?.role === "Admin";
  const routesHook = useRoutes();

  const [prospects, setProspects] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");

  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [search, setSearch]           = useState("");
  const [cityFilter, setCityFilter]   = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");

  const [showModal, setShowModal]     = useState(false);
  const [editProspect, setEditProspect] = useState(null);
  const [form, setForm]               = useState(emptyForm);
  const [saving, setSaving]           = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  const [detailProspect, setDetailProspect] = useState(null);

  /* ── Fetch ──────────────────────────────────────────────────── */
  // const fetchProspects = useCallback(async () => {
  //   setLoading(true); setError("");
  //   try {
  //     const res  = await fetch(`${API}/api/prospects`, {
  //       headers: { Authorization: `Bearer ${token}` },
  //     });
  //     const data = await res.json();
  //     if (!res.ok) throw new Error(data.message || "Failed to fetch prospects");
  //     setProspects(data.prospects || []);
  //   } catch (e) {
  //     setError(e.message);
  //   } finally {
  //     setLoading(false);
  //   }
  // }, [token]);

  const fetchProspects = useCallback(async ({ skipCache = false } = {}) => {
    // Serve from cache if fresh — makes revisits instant
    if (!skipCache) {
      try {
        const raw = sessionStorage.getItem(CACHE_KEY);
        if (raw) {
          const { ts, data } = JSON.parse(raw);
          if (Date.now() - ts < CACHE_TTL) {
            setProspects(data);
            setLoading(false);
            return;
          }
        }
      } catch (_) {}
    }

    setLoading(true); setError("");
    try {
      const res  = await fetch(`${API}/api/prospects`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to fetch prospects");
      const prospects = data.prospects || [];
      setProspects(prospects);
      // Save to cache
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: prospects }));
      } catch (_) {}
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token]);


  useEffect(() => { fetchProspects(); }, [fetchProspects]);

  /* ── Derived filter options ─────────────────────────────────── */
  const cities  = [...new Set(prospects.map((p) => p.city).filter(Boolean))];
  const sources = [...new Set(prospects.map((p) => p.source).filter(Boolean))];
  const actions = [...new Set(prospects.map((p) => p.next_action).filter(Boolean))];

  // const filtered = prospects.filter((p) => {
  //   const q = search.toLowerCase();
  //   const matchSearch =
  //     !q ||
  //     p.company_name?.toLowerCase().includes(q) ||
  //     p.industry?.toLowerCase().includes(q) ||
  //     p.city?.toLowerCase().includes(q) ||
  //     p.source?.toLowerCase().includes(q);
  //   return (
  //     matchSearch &&
  //     (!cityFilter   || p.city === cityFilter) &&
  //     (!sourceFilter || p.source === sourceFilter) &&
  //     (!actionFilter || p.next_action === actionFilter)
  //   );
  // });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return prospects.filter((p) => {
      const matchSearch =
        !q ||
        p.company_name?.toLowerCase().includes(q) ||
        p.industry?.toLowerCase().includes(q) ||
        p.city?.toLowerCase().includes(q) ||
        p.source?.toLowerCase().includes(q);
      return (
        matchSearch &&
        (!cityFilter   || p.city === cityFilter) &&
        (!sourceFilter || p.source === sourceFilter) &&
        (!actionFilter || p.next_action === actionFilter)
      );
    });
  }, [prospects, search, cityFilter, sourceFilter, actionFilter]);

  /* ── Modal helpers ──────────────────────────────────────────── */
  function openAdd() {
    setEditProspect(null);
    setForm(emptyForm);
    setFieldErrors({});
    setShowModal(true);
  }

  function openEdit(prospect) {
    setEditProspect(prospect);
    setForm({
      company_name:     prospect.company_name || "",
      industry:         prospect.industry || "",
      country:          prospect.country || "India",
      state:            prospect.state || "",
      city:             prospect.city || "",
      zone:             prospect.zone || "",
      route:            prospect.route || "",
      source:           prospect.source || "",
      next_action:      prospect.next_action || "",
      next_action_date: prospect.next_action_date?.split("T")[0] || "",
      feedback:         prospect.feedback || "",
      prospect_status: prospect.prospect_status || "",   
    });
    setFieldErrors({});
    setShowModal(true);
  }

  function handleFormChange(e) {
    const { name, value } = e.target;
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleLocationChange(field, value) {
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errors = validateForm(form);
    if (Object.keys(errors).length) { setFieldErrors(errors); return; }

    setFieldErrors({});
    setSaving(true);
    try {
      const url    = editProspect ? `${API}/api/prospects/${editProspect.id}` : `${API}/api/prospects`;
      const method = editProspect ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to save prospect");

      // Optimistic update — no refetch
      if (editProspect) {
        setProspects(prev => prev.map(p => p.id === editProspect.id ? { ...p, ...data.prospect } : p));
      } else {
        setProspects(prev => [data.prospect, ...prev]);
      }
      // Bust cache so next fresh mount gets updated data
      try { sessionStorage.removeItem(CACHE_KEY); } catch (_) {}

      setShowModal(false);
    } catch (e) {
      setFieldErrors({ _general: e.message });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this prospect?")) return;
    try {
      const res = await fetch(`${API}/api/prospects/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Delete failed");

      // Optimistic update — no refetch
      setProspects(prev => prev.filter(p => p.id !== id));
      try { sessionStorage.removeItem(CACHE_KEY); } catch (_) {}
      setDetailProspect(null);
    } catch (e) {
      alert(e.message);
    }
  }

  const clearFilters = () => {
    setSearch(""); setCityFilter(""); setSourceFilter(""); setActionFilter("");
  };
  const hasActiveFilters = search || cityFilter || sourceFilter || actionFilter;

  /* ───────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      {/* Decorative blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -right-32 -top-32 h-80 w-80 rounded-full bg-indigo-100/40 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-violet-100/30 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-3 py-5 sm:px-5 sm:py-7 lg:px-8 lg:py-9">

        {/* ── Header ──────────────────────────────────────────── */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              Prospects
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {isAdmin ? "All prospects across your organisation" : "Prospects you've added"}
              <span className="mx-1.5 text-slate-300">·</span>
              <span className="font-semibold text-slate-700">{filtered.length}</span>{" "}
              record{filtered.length !== 1 ? "s" : ""}
            </p>
          </div>
          <PrimaryBtn onClick={openAdd} className="mt-1">
            <Icon.Plus className="h-4 w-4" />
            Add Prospect
          </PrimaryBtn>
        </div>

        {/* ── Filter Bar ──────────────────────────────────────── */}
        <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* Desktop */}
          <div className="hidden lg:flex items-center gap-2 p-2.5">
            <div className="relative flex-1">
              <Icon.Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                placeholder="Search company, industry, city, source…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={inputCls("pl-10 !rounded-xl")}
              />
            </div>
            <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} className={inputCls("!rounded-xl !w-36")}>
              <option value="">All Cities</option>
              {cities.map((c) => <option key={c}>{c}</option>)}
            </select>
            <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className={inputCls("!rounded-xl !w-44")}>
              <option value="">All Sources</option>
              {sources.map((s) => <option key={s}>{s}</option>)}
            </select>
            <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className={inputCls("!rounded-xl !w-40")}>
              <option value="">All Actions</option>
              {actions.map((a) => <option key={a}>{a}</option>)}
            </select>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-100">
                <Icon.X className="h-3.5 w-3.5" /> Clear
              </button>
            )}
          </div>

          {/* Mobile */}
          <div className="flex flex-col gap-2.5 p-2.5 lg:hidden">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Icon.Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  placeholder="Search…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={inputCls("pl-9 !rounded-xl")}
                />
              </div>
              <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} className={inputCls("!rounded-xl !w-28")}>
                <option value="">City</option>
                {cities.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowMoreFilters((v) => !v)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                <Icon.Filter className="h-3.5 w-3.5" />
                {showMoreFilters ? "Hide filters" : "More filters"}
              </button>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50">
                  <Icon.X className="h-3.5 w-3.5" /> Clear
                </button>
              )}
            </div>
            <AnimatePresence>
              {showMoreFilters && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden border-t border-slate-100"
                >
                  <div className="flex flex-col gap-2.5 pt-2.5">
                    <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className={inputCls("!rounded-xl")}>
                      <option value="">All Sources</option>
                      {sources.map((s) => <option key={s}>{s}</option>)}
                    </select>
                    <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className={inputCls("!rounded-xl")}>
                      <option value="">All Actions</option>
                      {actions.map((a) => <option key={a}>{a}</option>)}
                    </select>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── States ──────────────────────────────────────────── */}
        {loading && <Skeleton />}
        {!loading && error && (
          <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-4 text-sm text-rose-700">{error}</div>
        )}

        {/* ── Grid ────────────────────────────────────────────── */}
        {!loading && !error && (
          <motion.div layout className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <AnimatePresence mode="popLayout">
              {filtered.length === 0 ? (
                <EmptyState
                  title="No prospects found"
                  subtitle={hasActiveFilters ? "Try adjusting your filters" : "Add your first prospect to get started"}
                />
              ) : filtered.map((prospect, i) => {
                const canEdit = isAdmin || prospect.created_by === user?.id;
                const grad    = SOURCE_GRADIENT[prospect.source] || "from-slate-400 to-slate-500";
                const accent  = SOURCE_ACCENT[prospect.source];
                const actionAccent = NEXT_ACTION_ACCENT[prospect.next_action] || "bg-slate-50 text-slate-600";

                return (
                  <motion.article
                    key={prospect.id}
                    layout
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.22, delay: Math.min(i * 0.025, 0.3) }}
                    onClick={() => setDetailProspect(prospect)}
                    className="group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-100/40"
                  >
                    {/* Coloured top strip */}
                    <div className={`h-1 w-full bg-gradient-to-r ${grad} opacity-80`} />

                    <div className="flex flex-1 flex-col p-4">
                      {/* Title row */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate text-[15px] font-bold text-slate-900 leading-snug">
                            {prospect.company_name}
                          </h3>
                          {prospect.industry && (
                            <p className="mt-0.5 truncate text-[13px] text-slate-500">
                              {prospect.industry}
                            </p>
                          )}
                        </div>
                        {canEdit && (
                          <div className="flex flex-shrink-0 gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                            <IconBtn tone="indigo" title="Edit" onClick={() => openEdit(prospect)}>
                              <Icon.Edit className="h-3.5 w-3.5" />
                            </IconBtn>
                            <IconBtn tone="rose" title="Delete" onClick={() => handleDelete(prospect.id)}>
                              <Icon.Trash className="h-3.5 w-3.5" />
                            </IconBtn>
                          </div>
                        )}
                      </div>

                      {/* Tags */}
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {prospect.city && (
                          <Tag>
                            <Icon.MapPin className="mr-1 inline h-2.5 w-2.5" />{prospect.city}
                          </Tag>
                        )}
                        {prospect.source && (
                          <Tag className={`${accent} ring-1 ring-inset`}>{prospect.source}</Tag>
                        )}
                      </div>

                      {/* Details */}
                      <div className="mt-3.5 flex-1 space-y-1.5 border-t border-slate-100 pt-3 text-[13px] text-slate-600">
                        {prospect.next_action && (
                          <div className="flex items-center gap-2">
                            <Icon.Zap className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                            <span className={`truncate rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${actionAccent}`}>
                              {prospect.next_action}
                            </span>
                          </div>
                        )}
                        {prospect.next_action_date && (
                          <div className="flex items-center gap-2">
                            <ActionDateBadge date={prospect.next_action_date} />
                          </div>
                        )}
                        {prospect.feedback && (
                          <div className="flex items-start gap-2">
                            <Icon.MessageSquare className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-slate-400" />
                            <span className="line-clamp-2 text-slate-500">{prospect.feedback}</span>
                          </div>
                        )}
                      </div>

                      {/* Footer */}
                      <div className="mt-3.5 flex items-center justify-end border-t border-slate-100 pt-3">
                        <span className="flex items-center gap-1 text-[12px] font-semibold text-indigo-500 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                          View details <Icon.ArrowRight className="h-3 w-3" />
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
        {detailProspect && (
          <Backdrop onClick={() => setDetailProspect(null)}>
            <ModalShell maxWidth="max-w-lg">
              <ModalHeader
                title={detailProspect.company_name}
                subtitle={detailProspect.industry}
                onClose={() => setDetailProspect(null)}
                accent="bg-gradient-to-r from-white to-indigo-50/40"
              />
              <div className="p-5">
                {/* Tags */}
                <div className="mb-4 flex flex-wrap gap-1.5">
                  {detailProspect.zone && <Tag className="bg-sky-50 text-sky-700 ring-sky-600/15">{detailProspect.zone}</Tag>}
                  {detailProspect.city && <Tag>{detailProspect.city}</Tag>}
                  {detailProspect.state && <Tag className="bg-teal-50 text-teal-700 ring-teal-600/15">{detailProspect.state}</Tag>}
                  {detailProspect.source && (
                    <Tag className={`${SOURCE_ACCENT[detailProspect.source]} ring-1 ring-inset`}>
                      {detailProspect.source}
                    </Tag>
                  )}
                </div>

                {/* Company info */}
                <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 mb-3">
                  <DetailRow label="Industry" value={detailProspect.industry} />
                  <DetailRow label="Country"  value={detailProspect.country} />
                  <DetailRow label="State"    value={detailProspect.state} />
                  <DetailRow label="City"     value={detailProspect.city} />
                  <DetailRow label="Zone"     value={detailProspect.zone} />
                  <DetailRow label="Route"    value={detailProspect.route} />
                  {isAdmin && <DetailRow label="Added by" value={detailProspect.users?.email} />}
                  <DetailRow label="Created"  value={new Date(detailProspect.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} />
                </div>

                {/* Next Action */}
                <div className="rounded-xl border border-amber-100 bg-amber-50/40 px-4 mb-3">
                  <div className="flex items-center gap-2 border-b border-amber-100 py-2">
                    <Icon.Zap className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-[11px] font-bold uppercase tracking-widest text-amber-600">Next Action</span>
                  </div>
                  <DetailRow label="Action" value={detailProspect.next_action} />
                  <DetailRow label="Date"   value={detailProspect.next_action_date
                    ? new Date(detailProspect.next_action_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                    : null}
                  />
                </div>
                
                {/* Feedback */}
                {detailProspect.feedback && (
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 px-4 mb-3">
                    <div className="flex items-center gap-2 border-b border-indigo-100 py-2">
                      <Icon.MessageSquare className="h-3.5 w-3.5 text-indigo-500" />
                      <span className="text-[11px] font-bold uppercase tracking-widest text-indigo-600">Feedback</span>
                    </div>
                    <p className="py-3 text-sm text-slate-700">{detailProspect.feedback}</p>
                  </div>
                )}

                <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 mb-3">
                  <DetailRow label="Status" value={detailProspect.prospect_status} />
                </div>


                {/* Actions */}
                {(isAdmin || detailProspect.created_by === user?.id) && (
                  <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-4">
                    <GhostBtn
                      className="border-rose-200 text-rose-600 hover:bg-rose-50"
                      onClick={() => handleDelete(detailProspect.id)}
                    >
                      <Icon.Trash className="h-3.5 w-3.5" /> Delete
                    </GhostBtn>
                    <PrimaryBtn onClick={() => { openEdit(detailProspect); setDetailProspect(null); }}>
      <Icon.Edit className="h-3.5 w-3.5" /> Edit Prospect
                    </PrimaryBtn>
                  </div>
                )}
              </div>
            </ModalShell>
          </Backdrop>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════
          ADD / EDIT MODAL
      ══════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showModal && (
          <Backdrop onClick={() => setShowModal(false)}>
            <ModalShell maxWidth="max-w-3xl">
              <ModalHeader
                title={editProspect ? "Edit Prospect" : "Add New Prospect"}
                subtitle={editProspect ? editProspect.company_name : "Capture early-stage interest before converting to a Lead"}
                onClose={() => setShowModal(false)}
                accent="bg-gradient-to-r from-white to-indigo-50/40"
              />

              <form onSubmit={handleSubmit} className="px-5 pb-6 pt-5 sm:px-7">

                {/* ── Company Info ──────────────────────────────── */}
                <SectionDivider title="Company Information" icon={Icon.Building} accent="indigo" />
                <div className="mb-5 grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Field
                      label="Company Name"
                      name="company_name"
                      value={form.company_name}
                      onChange={handleFormChange}
                      placeholder="Acme Industries Pvt. Ltd."
                      required
                      icon={Icon.Building}
                      errors={fieldErrors}
                    />
                  </div>
                  <SelectField
                    label="Industry"
                    name="industry"
                    value={form.industry}
                    onChange={handleFormChange}
                    options={INDUSTRIES}
                    required
                    errors={fieldErrors}
                  />
                  <SelectField
                    label="Source"
                    name="source"
                    value={form.source}
                    onChange={handleFormChange}
                    options={SOURCES}
                    required
                    errors={fieldErrors}
                  />
                </div>

                {/* ── Location ──────────────────────────────────── */}
                <SectionDivider title="Location" icon={Icon.MapPin} accent="teal" />
                <div className="mb-5">
                  <LocationPicker
                    country={form.country}
                    state={form.state}
                    city={form.city}
                    zone={form.zone}
                    route={form.route}
                    onChange={handleLocationChange}
                    useRoutesHook={routesHook}
                    errors={fieldErrors}
                  />
                </div>

                {/* ── Next Action ───────────────────────────────── */}
                <SectionDivider title="Follow-up Plan" icon={Icon.Zap} accent="amber" />
                <div className="mb-5 grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                  <SelectField
                    label="Next Action"
                    name="next_action"
                    value={form.next_action}
                    onChange={handleFormChange}
                    options={NEXT_ACTIONS}
                    required
                    errors={fieldErrors}
                  />
                  <Field
                    label="Next Action Date"
                    name="next_action_date"
                    type="date"
                    value={form.next_action_date}
                    onChange={handleFormChange}
                    required
                    icon={Icon.Calendar}
                    errors={fieldErrors}
                  />
                  <div className="sm:col-span-2">
                    <TextareaField
                      label="Feedback / Notes"
                      name="feedback"
                      value={form.feedback}
                      onChange={handleFormChange}
                      placeholder="Any early feedback, observations, or notes about this prospect…"
                      rows={3}
                      errors={fieldErrors}
                    />
                  </div>
                </div>

                {/* ── Prospect Status ───────────────────────────────── */}
                <SectionDivider title="Prospect Status" icon={Icon.Activity} accent="blue" />
                <div className="mb-5 grid grid-cols-1 gap-x-4 gap-y-4 sm:col-span-2">
                  <SelectField
                    label="Status"
                    name="prospect_status"
                    value={form.prospect_status}
                    onChange={handleFormChange}
                    options={PROSPECT_STATUS}
                    required
                    errors={fieldErrors}
                  />
                </div>

                {/* Error */}
                {fieldErrors._general && (
                  <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {fieldErrors._general}
                  </div>
                )}

                {/* Footer */}
                <div className="flex flex-wrap justify-end gap-2.5 border-t border-slate-100 pt-5">
                  <GhostBtn type="button" onClick={() => setShowModal(false)}>Cancel</GhostBtn>
                  <PrimaryBtn type="submit" disabled={saving}>
                    {saving ? "Saving…" : editProspect ? "Update Prospect" : "Add Prospect"}
                  </PrimaryBtn>
                </div>
              </form>
            </ModalShell>
          </Backdrop>
        )}
      </AnimatePresence>
    </div>
  );
}