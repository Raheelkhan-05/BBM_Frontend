// Leads.jsx — Enhanced UI with new fields
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRoutes } from "../hooks/useRoutes";
import { useAuth } from "../context/AuthContext";
import LocationPicker from "./components/LocationPicker";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

const emptyForm = {
  company_name: "",
  country: "India",
  state: "",
  city: "",
  zone: "",
  route: "",
  nature_of_business: "",
  manufacturing_industry: "",
  company_website: "",
  gst_number: "",
  linkedin_profile: "",
  // Primary contact
  primary_contact_name: "",
  primary_designation: "",
  primary_phone: "",
  primary_email: "",
  whatsapp_same_as_mobile: false,
  whatsapp_number: "",
  // Secondary contact
  secondary_contact_name: "",
  secondary_designation: "",
  secondary_phone: "",
  secondary_email: "",
  // Potential product
  potential_product_category: "",
  potential_product_sub_category: "",
  potential_product_name: "",
};

const BUSINESS_TYPES = ["Trader", "Wholesaler", "Retailer", "Exporter", "Manufacturer"];

const DESIGNATIONS = [
  "Owner","Purchase Manager","Director","Production Head","Factory Manager",
  "Plant Head","Operations Manager","Procurement Manager","Technical Manager","Other",
];

const INDIAN_STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat",
  "Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh",
  "Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan",
  "Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal",
  "Andaman & Nicobar Islands","Chandigarh","Dadra & Nagar Haveli","Daman & Diu",
  "Delhi","Jammu & Kashmir","Ladakh","Lakshadweep","Puducherry",
];

const BUSINESS_ACCENT = {
  Trader:       "bg-amber-50 text-amber-700 ring-amber-600/20",
  Wholesaler:   "bg-sky-50 text-sky-700 ring-sky-600/20",
  Retailer:     "bg-violet-50 text-violet-700 ring-violet-600/20",
  Exporter:     "bg-rose-50 text-rose-700 ring-rose-600/20",
  Manufacturer: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
};

const BUSINESS_GRADIENT = {
  Trader:       "from-amber-500 to-orange-500",
  Wholesaler:   "from-sky-500 to-blue-600",
  Retailer:     "from-violet-500 to-purple-600",
  Exporter:     "from-rose-500 to-pink-600",
  Manufacturer: "from-emerald-500 to-teal-600",
};

/* ─── Icons ───────────────────────────────────────────────────── */
const Icon = {
  Plus: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
      <path d="M12 5v14M5 12h14"/>
    </svg>
  ),
  Search: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
    </svg>
  ),
  X: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M6 6l12 12M18 6L6 18"/>
    </svg>
  ),
  Edit: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.12 2.12 0 113 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  ),
  Trash: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0l-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6h16z"/>
    </svg>
  ),
  Phone: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
    </svg>
  ),
  Mail: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
    </svg>
  ),
  Factory: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M2 20h20M4 20V10l5 4v-4l5 4v-4l5 4v6"/>
    </svg>
  ),
  Globe: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
    </svg>
  ),
  MapPin: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
    </svg>
  ),
  User: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  Building: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/>
    </svg>
  ),
  Tag: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>
    </svg>
  ),
  ChevronDown: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <polyline points="6,9 12,15 18,9"/>
    </svg>
  ),
  Filter: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <polygon points="22,3 2,3 10,12.46 10,19 14,21 14,12.46 22,3"/>
    </svg>
  ),
  ArrowRight: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M5 12h14M12 5l7 7-7 7"/>
    </svg>
  ),
  Linkedin: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/>
    </svg>
  ),
  Receipt: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1z"/><path d="M9 7h6M9 11h6M9 15h4"/>
    </svg>
  ),
  Package: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27,6.96 12,12.01 20.73,6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>
  ),
};

/* ─── Primitives ──────────────────────────────────────────────── */
function Label({ children, required }) {
  return (
    <label className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
      {children}
      {required && <span className="text-rose-500">*</span>}
    </label>
  );
}

function inputCls(extra = "") {
  return `w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-150 focus:border-indigo-400 focus:ring-3 focus:ring-indigo-100 hover:border-slate-300 ${extra}`;
}

function Field({ label, name, value, onChange, type = "text", placeholder, required, icon: Ic }) {
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
          className={inputCls(Ic ? "pl-9" : "")}
        />
      </div>
    </div>
  );
}

function SelectField({ label, name, value, onChange, options, required, placeholder }) {
  return (
    <div className="flex flex-col">
      {label && <Label required={required}>{label}</Label>}
      <div className="relative">
        <select
          name={name}
          value={value}
          onChange={onChange}
          className={inputCls("appearance-none pr-9")}
        >
          <option value="">{placeholder || `Select ${label}`}</option>
          {options.map((opt) => (
            typeof opt === "string"
              ? <option key={opt} value={opt}>{opt}</option>
              : <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <Icon.ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>
    </div>
  );
}

function TextareaField({ label, name, value, onChange, placeholder, rows = 3 }) {
  return (
    <div className="flex flex-col">
      {label && <Label>{label}</Label>}
      <textarea
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        className={inputCls("resize-none")}
      />
    </div>
  );
}

/* Divider with title */
function SectionDivider({ title, icon: Ic, accent = "indigo" }) {
  const colors = {
    indigo: "text-indigo-600 bg-indigo-50 border-indigo-100",
    teal:   "text-teal-600 bg-teal-50 border-teal-100",
    violet: "text-violet-600 bg-violet-50 border-violet-100",
    amber:  "text-amber-600 bg-amber-50 border-amber-100",
    rose:   "text-rose-600 bg-rose-50 border-rose-100",
    slate:  "text-slate-600 bg-slate-50 border-slate-200",
  };
  return (
    <div className={`mb-4 mt-2 flex items-center gap-2.5 rounded-lg border px-3 py-2 ${colors[accent]}`}>
      {Ic && <Ic className="h-3.5 w-3.5 flex-shrink-0" />}
      <span className="text-[11px] font-bold uppercase tracking-widest">{title}</span>
    </div>
  );
}

/* Grid wrapper for form fields */
function FormGrid({ children, cols = 2 }) {
  return (
    <div className={`grid grid-cols-1 gap-x-4 gap-y-4 ${cols === 2 ? "sm:grid-cols-2" : cols === 3 ? "sm:grid-cols-3" : ""}`}>
      {children}
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
      {/* Geometric illustration */}
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

/* ─── Contact Block ───────────────────────────────────────────── */
function ContactBlock({ prefix, label, form, onChange, required = false }) {
  const nameKey   = `${prefix}_contact_name`;
  const desigKey  = `${prefix}_designation`;
  const phoneKey  = `${prefix}_phone`;
  const emailKey  = `${prefix}_email`;
  return (
    <FormGrid>
      <div className="col-span-1 sm:col-span-2">
        <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
          <Field
            label={`${label} Name`}
            name={nameKey}
            value={form[nameKey]}
            onChange={onChange}
            placeholder="Full name"
            required={required}
            icon={Icon.User}
          />
          <SelectField
            label="Designation"
            name={desigKey}
            value={form[desigKey]}
            onChange={onChange}
            options={DESIGNATIONS}
            required={required && !!form[nameKey]}
          />
          <Field
            label="Phone"
            name={phoneKey}
            value={form[phoneKey]}
            onChange={onChange}
            placeholder="+91 00000 00000"
            icon={Icon.Phone}
          />
          <Field
            label="Email"
            name={emailKey}
            type="email"
            value={form[emailKey]}
            onChange={onChange}
            placeholder="email@company.com"
            icon={Icon.Mail}
          />
        </div>
      </div>
    </FormGrid>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════ */
export default function Leads() {
  const { user, token } = useAuth();
  const isAdmin = user?.role === "Admin";
  const routesHook = useRoutes();

  const [leads, setLeads]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [search, setSearch]         = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [zoneFilter, setZoneFilter] = useState("");
  const [natureFilter, setNatureFilter] = useState("");

  const [showModal, setShowModal]   = useState(false);
  const [editLead, setEditLead]     = useState(null);
  const [form, setForm]             = useState(emptyForm);
  const [saving, setSaving]         = useState(false);
  const [formError, setFormError]   = useState("");

  const [detailLead, setDetailLead] = useState(null);

  /* ── Fetch ─────────────────────────────────────────────────── */
  const fetchLeads = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API}/api/leads`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to fetch leads");
      setLeads(data.leads || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  /* ── Derived filter options ────────────────────────────────── */
  const cities  = [...new Set(leads.map((l) => l.city).filter(Boolean))];
  const zones   = [...new Set(leads.map((l) => l.zone).filter(Boolean))];
  const natures = [...new Set(leads.map((l) => l.nature_of_business).filter(Boolean))];

  const filtered = leads.filter((l) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      l.company_name?.toLowerCase().includes(q) ||
      (l.primary_contact_name || l.contact_name)?.toLowerCase().includes(q) ||
      (l.primary_phone || l.mobile_number)?.includes(q) ||
      (l.primary_email || l.email)?.toLowerCase().includes(q) ||
      l.manufacturing_industry?.toLowerCase().includes(q);
    return (
      matchSearch &&
      (!cityFilter   || l.city === cityFilter) &&
      (!zoneFilter   || l.zone === zoneFilter) &&
      (!natureFilter || l.nature_of_business === natureFilter)
    );
  });

  /* ── Modal helpers ─────────────────────────────────────────── */
  function openAdd() {
    setEditLead(null);
    setForm(emptyForm);
    setFormError("");
    setShowModal(true);
  }

  function openEdit(lead) {
    setEditLead(lead);
    setForm({
      company_name: lead.company_name || "",
      country: lead.country || "India",
      state: lead.state || "",
      city: lead.city || "",
      zone: lead.zone || "",
      route: lead.route || "",
      nature_of_business: lead.nature_of_business || "",
      manufacturing_industry: lead.manufacturing_industry || "",
      company_website: lead.company_website || "",
      gst_number: lead.gst_number || "",
      linkedin_profile: lead.linkedin_profile || "",
      // Primary (prefer new fields, fall back to legacy)
      primary_contact_name: lead.primary_contact_name || lead.contact_name || "",
      primary_designation:  lead.primary_designation  || lead.designation  || "",
      primary_phone:        lead.primary_phone        || lead.mobile_number || "",
      primary_email:        lead.primary_email        || lead.email         || "",
      whatsapp_same_as_mobile: lead.whatsapp_same_as_mobile || false,
      whatsapp_number:     lead.whatsapp_number || "",
      // Secondary
      secondary_contact_name: lead.secondary_contact_name || "",
      secondary_designation:  lead.secondary_designation  || "",
      secondary_phone:        lead.secondary_phone        || "",
      secondary_email:        lead.secondary_email        || "",
      // Product
      potential_product_category:     lead.potential_product_category     || "",
      potential_product_sub_category: lead.potential_product_sub_category || "",
      potential_product_name:         lead.potential_product_name         || "",
    });
    setFormError("");
    setShowModal(true);
  }

  function handleFormChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => {
      const updated = { ...prev, [name]: type === "checkbox" ? checked : value };
      if (name === "whatsapp_same_as_mobile" && checked) {
        updated.whatsapp_number = prev.primary_phone;
      }
      if (name === "primary_phone" && prev.whatsapp_same_as_mobile) {
        updated.whatsapp_number = value;
      }
      return updated;
    });
  }

  function handleLocationChange(field, value) {
    setForm((p) => ({ ...p, [field]: value }));
  }

  /* Validate secondary contact: if any field filled → designation + (phone or email) required */
  function validateSecondary(f) {
    const hasAny = f.secondary_contact_name || f.secondary_phone || f.secondary_email || f.secondary_designation;
    if (!hasAny) return null;
    if (!f.secondary_designation) return "Secondary contact designation is required.";
    if (!f.secondary_phone && !f.secondary_email) return "Secondary contact requires at least a phone or email.";
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.company_name.trim()) { setFormError("Company name is required."); return; }
    const secErr = validateSecondary(form);
    if (secErr) { setFormError(secErr); return; }

    setSaving(true); setFormError("");
    try {
      const url    = editLead ? `${API}/api/leads/${editLead.id}` : `${API}/api/leads`;
      const method = editLead ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to save lead");
      setShowModal(false);
      fetchLeads();
    } catch (e) {
      setFormError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this lead?")) return;
    try {
      const res = await fetch(`${API}/api/leads/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Delete failed");
      setDetailLead(null);
      fetchLeads();
    } catch (e) {
      alert(e.message);
    }
  }

  const clearFilters = () => {
    setSearch(""); setCityFilter(""); setZoneFilter(""); setNatureFilter("");
  };
  const hasActiveFilters = search || cityFilter || zoneFilter || natureFilter;

  /* helper for display */
  const getContactName  = (l) => l.primary_contact_name || l.contact_name;
  const getPhone        = (l) => l.primary_phone || l.mobile_number;
  const getEmail        = (l) => l.primary_email || l.email;
  const getDesignation  = (l) => l.primary_designation || l.designation;

  /* ───────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      {/* Decorative blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -right-32 -top-32 h-80 w-80 rounded-full bg-indigo-100/40 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-violet-100/30 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-[1440px] px-3 py-5 sm:px-5 sm:py-7 lg:px-8 lg:py-9">

        {/* ── Header ──────────────────────────────────────────── */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            {/* Eyebrow */}
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              Leads
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {isAdmin ? "All leads across your organisation" : "Leads you've added"}
              <span className="mx-1.5 text-slate-300">·</span>
              <span className="font-semibold text-slate-700">{filtered.length}</span>{" "}
              record{filtered.length !== 1 ? "s" : ""}
            </p>
          </div>
          <PrimaryBtn onClick={openAdd} className="mt-1">
            <Icon.Plus className="h-4 w-4" />
            Add Lead
          </PrimaryBtn>
        </div>

        {/* ── Filter Bar ──────────────────────────────────────── */}
        <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* Desktop */}
          <div className="hidden lg:flex items-center gap-2 p-2.5">
            <div className="relative flex-1">
              <Icon.Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                placeholder="Search company, contact, phone, industry…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={inputCls("pl-10 !rounded-xl")}
              />
            </div>
            <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} className={inputCls("!rounded-xl !w-36")}>
              <option value="">All Cities</option>
              {cities.map((c) => <option key={c}>{c}</option>)}
            </select>
            <select value={zoneFilter} onChange={(e) => setZoneFilter(e.target.value)} className={inputCls("!rounded-xl !w-36")}>
              <option value="">All Zones</option>
              {zones.map((z) => <option key={z}>{z}</option>)}
            </select>
            <select value={natureFilter} onChange={(e) => setNatureFilter(e.target.value)} className={inputCls("!rounded-xl !w-44")}>
              <option value="">All Business Types</option>
              {natures.map((n) => <option key={n}>{n}</option>)}
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
                    <select value={zoneFilter} onChange={(e) => setZoneFilter(e.target.value)} className={inputCls("!rounded-xl")}>
                      <option value="">All Zones</option>
                      {zones.map((z) => <option key={z}>{z}</option>)}
                    </select>
                    <select value={natureFilter} onChange={(e) => setNatureFilter(e.target.value)} className={inputCls("!rounded-xl")}>
                      <option value="">All Business Types</option>
                      {natures.map((n) => <option key={n}>{n}</option>)}
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
                  title="No leads found"
                  subtitle={hasActiveFilters ? "Try adjusting your filters" : "Add your first lead to get started"}
                />
              ) : filtered.map((lead, i) => {
                const canEdit = isAdmin || lead.created_by === user?.id;
                const accent  = BUSINESS_ACCENT[lead.nature_of_business];
                const grad    = BUSINESS_GRADIENT[lead.nature_of_business] || "from-slate-400 to-slate-500";
                const name    = getContactName(lead);
                const phone   = getPhone(lead);
                const desig   = getDesignation(lead);

                return (
                  <motion.article
                    key={lead.id}
                    layout
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.22, delay: Math.min(i * 0.025, 0.3) }}
                    onClick={() => setDetailLead(lead)}
                    className="group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-100/40"
                  >
                    {/* Coloured top strip */}
                    <div className={`h-1 w-full bg-gradient-to-r ${grad} opacity-80`} />

                    {/* Decorative circle */}
                    {/* <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br from-indigo-50 to-violet-50 opacity-0 transition-opacity duration-300 group-hover:opacity-100" /> */}

                    <div className="flex flex-1 flex-col p-4">
                      {/* Title row */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate text-[15px] font-bold text-slate-900 leading-snug">
                            {lead.company_name}
                          </h3>
                          {name && (
                            <p className="mt-0.5 truncate text-[13px] text-slate-500">
                              {name}{desig ? ` · ${desig}` : ""}
                            </p>
                          )}
                        </div>
                        {canEdit && (
                          <div className="flex flex-shrink-0 gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                            <IconBtn tone="indigo" title="Edit" onClick={() => openEdit(lead)}>
                              <Icon.Edit className="h-3.5 w-3.5" />
                            </IconBtn>
                            <IconBtn tone="rose" title="Delete" onClick={() => handleDelete(lead.id)}>
                              <Icon.Trash className="h-3.5 w-3.5" />
                            </IconBtn>
                          </div>
                        )}
                      </div>

                      {/* Tags */}
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {lead.city && (
                          <Tag className="bg-slate-100 text-slate-600 ring-slate-500/15">
                            <Icon.MapPin className="mr-1 inline h-2.5 w-2.5" />{lead.city}
                          </Tag>
                        )}
                        {lead.nature_of_business && (
                          <Tag className={`${accent} ring-1 ring-inset`}>{lead.nature_of_business}</Tag>
                        )}
                      </div>

                      {/* Details */}
                      <div className="mt-3.5 flex-1 space-y-1.5 border-t border-slate-100 pt-3 text-[13px] text-slate-600">
                        {phone && (
                          <div className="flex items-center gap-2">
                            <Icon.Phone className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                            <span className="truncate font-mono tracking-tight">{phone}</span>
                          </div>
                        )}
                        {lead.manufacturing_industry && (
                          <div className="flex items-center gap-2">
                            <Icon.Factory className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                            <span className="truncate">{lead.manufacturing_industry}</span>
                          </div>
                        )}
                        {lead.potential_product_name && (
                          <div className="flex items-center gap-2">
                            <Icon.Package className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                            <span className="truncate">{lead.potential_product_name}</span>
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
        {detailLead && (
          <Backdrop onClick={() => setDetailLead(null)}>
            <ModalShell maxWidth="max-w-lg">
              <ModalHeader
                title={detailLead.company_name}
                subtitle={[getContactName(detailLead), getDesignation(detailLead)].filter(Boolean).join(" · ")}
                onClose={() => setDetailLead(null)}
                accent="bg-gradient-to-r from-white to-indigo-50/40"
              />
              <div className="p-5">
                {/* Tags */}
                <div className="mb-4 flex flex-wrap gap-1.5">
                  {detailLead.zone && <Tag className="bg-sky-50 text-sky-700 ring-sky-600/15">{detailLead.zone}</Tag>}
                  {detailLead.city && <Tag>{detailLead.city}</Tag>}
                  {detailLead.state && <Tag className="bg-teal-50 text-teal-700 ring-teal-600/15">{detailLead.state}</Tag>}
                  {detailLead.country && detailLead.country !== "India" && <Tag className="bg-violet-50 text-violet-700 ring-violet-600/15">{detailLead.country}</Tag>}
                  
                  {detailLead.nature_of_business && (
                    <Tag className={`${BUSINESS_ACCENT[detailLead.nature_of_business]} ring-1 ring-inset`}>
                      {detailLead.nature_of_business}
                    </Tag>
                  )}
                </div>

                {/* Company info */}
                <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 mb-3">
                  <DetailRow label="GST Number"   value={detailLead.gst_number} mono />
                  <DetailRow label="Industry"     value={detailLead.manufacturing_industry} />
                  <DetailRow label="Website"      value={detailLead.company_website ? (
                    <a href={detailLead.company_website} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">{detailLead.company_website}</a>
                  ) : null} />
                  <DetailRow label="LinkedIn"     value={detailLead.linkedin_profile ? (
                    <a href={detailLead.linkedin_profile} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">Profile</a>
                  ) : null} />
                  <DetailRow label="Route"        value={detailLead.route} />
                  {isAdmin && <DetailRow label="Added by" value={detailLead.users?.email} />}
                  <DetailRow label="Created"      value={new Date(detailLead.created_at).toLocaleDateString()} />
                </div>

                {/* Primary contact */}
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 px-4 mb-3">
                  <div className="flex items-center gap-2 border-b border-indigo-100 py-2">
                    <Icon.User className="h-3.5 w-3.5 text-indigo-500" />
                    <span className="text-[11px] font-bold uppercase tracking-widest text-indigo-600">Primary Contact</span>
                  </div>
                  <DetailRow label="Name"        value={getContactName(detailLead)} />
                  <DetailRow label="Designation" value={getDesignation(detailLead)} />
                  <DetailRow label="Phone"       value={getPhone(detailLead)} mono />
                  <DetailRow label="Email"       value={getEmail(detailLead)} />
                </div>

                {/* Secondary contact if present */}
                {(detailLead.secondary_contact_name || detailLead.secondary_phone || detailLead.secondary_email) && (
                  <div className="rounded-xl border border-violet-100 bg-violet-50/40 px-4 mb-3">
                    <div className="flex items-center gap-2 border-b border-violet-100 py-2">
                      <Icon.User className="h-3.5 w-3.5 text-violet-500" />
                      <span className="text-[11px] font-bold uppercase tracking-widest text-violet-600">Secondary Contact</span>
                    </div>
                    <DetailRow label="Name"        value={detailLead.secondary_contact_name} />
                    <DetailRow label="Designation" value={detailLead.secondary_designation} />
                    <DetailRow label="Phone"       value={detailLead.secondary_phone} mono />
                    <DetailRow label="Email"       value={detailLead.secondary_email} />
                  </div>
                )}

                {/* Potential product */}
                {(detailLead.potential_product_category || detailLead.potential_product_name) && (
                  <div className="rounded-xl border border-teal-100 bg-teal-50/40 px-4 mb-3">
                    <div className="flex items-center gap-2 border-b border-teal-100 py-2">
                      <Icon.Package className="h-3.5 w-3.5 text-teal-500" />
                      <span className="text-[11px] font-bold uppercase tracking-widest text-teal-600">Potential Product</span>
                    </div>
                    <DetailRow label="Category"    value={detailLead.potential_product_category} />
                    <DetailRow label="Sub-Category" value={detailLead.potential_product_sub_category} />
                    <DetailRow label="Product"     value={detailLead.potential_product_name} />
                  </div>
                )}

                {/* Actions */}
                {(isAdmin || detailLead.created_by === user?.id) && (
                  <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-4">
                    <GhostBtn
                      className="border-rose-200 text-rose-600 hover:bg-rose-50"
                      onClick={() => handleDelete(detailLead.id)}
                    >
                      <Icon.Trash className="h-3.5 w-3.5" /> Delete
                    </GhostBtn>
                    <PrimaryBtn onClick={() => { openEdit(detailLead); setDetailLead(null); }}>
                      <Icon.Edit className="h-3.5 w-3.5" /> Edit Lead
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
                title={editLead ? "Edit Lead" : "Add New Lead"}
                subtitle={editLead ? editLead.company_name : "Fill in the details to create a new lead"}
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
                    />
                  </div>
                  <SelectField
                    label="Nature of Business"
                    name="nature_of_business"
                    value={form.nature_of_business}
                    onChange={handleFormChange}
                    options={BUSINESS_TYPES}
                  />
                  {form.nature_of_business === "Manufacturer" && (
                    <Field
                      label="Manufacturing Industry"
                      name="manufacturing_industry"
                      value={form.manufacturing_industry}
                      onChange={handleFormChange}
                      placeholder="e.g. Pharmaceuticals, Textiles…"
                      icon={Icon.Factory}
                    />
                  )}
                  <Field
                    label="Company Website"
                    name="company_website"
                    value={form.company_website}
                    onChange={handleFormChange}
                    placeholder="https://company.com"
                    icon={Icon.Globe}
                  />
                  <Field
                    label="GST Number"
                    name="gst_number"
                    value={form.gst_number}
                    onChange={handleFormChange}
                    placeholder="27AAAAA0000A1Z5"
                    icon={Icon.Receipt}
                  />
                  <div className="sm:col-span-2">
                    <Field
                      label="LinkedIn Profile"
                      name="linkedin_profile"
                      value={form.linkedin_profile}
                      onChange={handleFormChange}
                      placeholder="https://linkedin.com/company/…"
                      icon={Icon.Linkedin}
                    />
                  </div>
                </div>

                {/* ── Location ──────────────────────────────────── */}
                <SectionDivider title="Location" icon={Icon.MapPin} accent="teal" />
                <div className="mb-5 grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                  <Field
                    label="Country"
                    name="country"
                    value={form.country}
                    onChange={handleFormChange}
                    placeholder="India"
                    icon={Icon.Globe}
                  />
                  <SelectField
                    label="State"
                    name="state"
                    value={form.state}
                    onChange={handleFormChange}
                    options={INDIAN_STATES}
                    placeholder="Select State"
                  />
                  <div className="sm:col-span-2">
                    <LocationPicker
                      city={form.city}
                      zone={form.zone}
                      route={form.route}
                      onChange={handleLocationChange}
                      useRoutesHook={routesHook}
                    />
                  </div>
                </div>

                {/* ── Primary Contact ───────────────────────────── */}
                <SectionDivider title="Primary Contact" icon={Icon.User} accent="indigo" />
                <div className="mb-5">
                  <ContactBlock
                    prefix="primary"
                    label="Contact"
                    form={form}
                    onChange={handleFormChange}
                    required={false}
                  />

                </div>

                {/* ── Secondary Contact ─────────────────────────── */}
                <SectionDivider title="Secondary Contact (Optional)" icon={Icon.User} accent="violet" />
                <div className="mb-5">
                  <ContactBlock
                    prefix="secondary"
                    label="Contact"
                    form={form}
                    onChange={handleFormChange}
                  />
                  <p className="mt-2 text-[11px] text-slate-400">
                    If filled, designation and at least one contact method (phone or email) are required.
                  </p>
                </div>

                {/* ── Potential Product ─────────────────────────── */}
                <SectionDivider title="Potential Product Interest" icon={Icon.Package} accent="amber" />
                <div className="mb-5 grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-3">
                  <Field
                    label="Category"
                    name="potential_product_category"
                    value={form.potential_product_category}
                    onChange={handleFormChange}
                    placeholder="e.g. Chemicals"
                    icon={Icon.Tag}
                  />
                  <Field
                    label="Sub-Category"
                    name="potential_product_sub_category"
                    value={form.potential_product_sub_category}
                    onChange={handleFormChange}
                    placeholder="e.g. Solvents"
                    icon={Icon.Tag}
                  />
                  <Field
                    label="Product Name"
                    name="potential_product_name"
                    value={form.potential_product_name}
                    onChange={handleFormChange}
                    placeholder="e.g. Ethanol 99%"
                    icon={Icon.Package}
                  />
                </div>

                {/* Error */}
                {formError && (
                  <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {formError}
                  </div>
                )}

                {/* Footer */}
                <div className="flex flex-wrap justify-end gap-2.5 border-t border-slate-100 pt-5">
                  <GhostBtn type="button" onClick={() => setShowModal(false)}>Cancel</GhostBtn>
                  <PrimaryBtn type="submit" disabled={saving}>
                    {saving ? "Saving…" : editLead ? "Update Lead" : "Add Lead"}
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