//RFQs.jsx
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { useProducts } from "../hooks/useProducts";
import ProductPicker from "./components/ProductPicker";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

const emptyRFQ = {
  lead_id: "", company_name: "", product_category: "",
  product_sub_category: "", product_name: "", product_description: "",
  consumption_per_month: "", unit: "", sample_required: false,
  sample_description: "", sample_received_from_customer: false,
  quotation_required: false, quotation_description: "", existing_supplier_brand: "",
};

const emptyFollowup = {
  contact_type: "", sample_status_update: "", quotation_status_update: "",
  next_action: "", notes: "", followup_date: "", target_price: "",
  enquiry_status: "", remark: "",
};

const sampleStatusColor = {
  "Pending":                ["bg-amber-50", "text-amber-700", "ring-amber-600/15"],
  "Sent to Customer":       ["bg-sky-50", "text-sky-700", "ring-sky-600/15"],
  "Received from Customer": ["bg-violet-50", "text-violet-700", "ring-violet-600/15"],
  "Approved":               ["bg-emerald-50", "text-emerald-700", "ring-emerald-600/15"],
  "Rejected":               ["bg-rose-50", "text-rose-700", "ring-rose-600/15"],
};

const quotationStatusColor = {
  "Pending":           ["bg-amber-50", "text-amber-700", "ring-amber-600/15"],
  "In Preparation":    ["bg-sky-50", "text-sky-700", "ring-sky-600/15"],
  "Sent to Customer":  ["bg-violet-50", "text-violet-700", "ring-violet-600/15"],
  "Under Review":      ["bg-pink-50", "text-pink-700", "ring-pink-600/15"],
  "Accepted":          ["bg-emerald-50", "text-emerald-700", "ring-emerald-600/15"],
  "Rejected":          ["bg-rose-50", "text-rose-700", "ring-rose-600/15"],
};

const statusColor = {
  "Open":        ["bg-amber-50", "text-amber-700", "ring-amber-600/15"],
  "In Progress": ["bg-sky-50", "text-sky-700", "ring-sky-600/15"],
  "Quoted":      ["bg-violet-50", "text-violet-700", "ring-violet-600/15"],
  "Sample Sent": ["bg-pink-50", "text-pink-700", "ring-pink-600/15"],
  "Won":         ["bg-emerald-50", "text-emerald-700", "ring-emerald-600/15"],
  "Lost":        ["bg-rose-50", "text-rose-700", "ring-rose-600/15"],
  "On Hold":     ["bg-slate-100", "text-slate-600", "ring-slate-500/10"],
};

const ENQUIRY_STATUSES = ["Open", "In Progress", "Quoted", "Sample Sent", "Won", "Lost", "On Hold"];
const CONTACT_TYPES = ["Call", "Email", "WhatsApp", "Meeting", "Site Visit"];
const SAMPLE_STATUS_OPTIONS = ["Sample to be Submitted", "Sample Submitted", "Sample Under Trial", "Approved", "Rejected"];
const QUOTATION_STATUS_OPTIONS = ["Quotation Submitted", "Quotation to be Negotiated", "Approved", "Rejected"];

const NO_FURTHER_ACTION_REMARKS = [
  "No Response from Customer", "Customer Not Interested", "No Immediate Requirement",
  "Project Cancelled", "Requirement Changed", "Budget Issue", "Other",
];

const CLOSE_ENQUIRY_REMARKS = [
  "Order Won", "Competitor Won the Order", "Price Too High", "Sample Rejected",
  "Quotation Rejected", "Sample & Quotation Rejected", "Technical Specification Not Matched",
  "Product Quality Not Approved", "Customer Purchased from Another Vendor", "Duplicate Enquiry", "Other",
];

const NEXT_ACTION_OPTIONS = [
  "Quotation to be Submitted", "Sample to be Submitted", "Sample to be Tried", "Follow-up",
  "Price Negotiation", "Send Product Details", "Collect Sample Feedback", "Collect Quotation Feedback",
  "Order Confirmation", "Purchase Order Follow-up", "Payment Follow-up", "Dispatch Material",
  "Close Enquiry", "No Further Action", "Other",
];

/* ── Shared primitives ───────────────────────────────────────── */
function Label({ children }) {
  return <label className="mb-1.5 block text-xs font-medium text-slate-600">{children}</label>;
}
function inputCls(extra = "") {
  return `w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-150 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 ${extra}`;
}
function Field({ label, name, value, onChange, type = "text", placeholder }) {
  return (
    <div className="mb-3.5">
      <Label>{label}</Label>
      <input name={name} type={type} value={value} onChange={onChange} placeholder={placeholder} className={inputCls()} />
    </div>
  );
}
function SelectField({ label, name, value, onChange, options }) {
  return (
    <div className="mb-3.5">
      <Label>{label}</Label>
      <select name={name} value={value} onChange={onChange} className={inputCls("appearance-none")}>
        <option value="">Select {label}</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </div>
  );
}
function CheckField({ id, name, checked, onChange, label }) {
  return (
    <div className="mb-3.5 flex items-center gap-2">
      <input type="checkbox" id={id} name={name} checked={checked} onChange={onChange} className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-200" />
      <label htmlFor={id} className="cursor-pointer text-sm text-slate-600">{label}</label>
    </div>
  );
}
function Section({ title, children }) {
  return (
    <div className="mb-6">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{title}</p>
      <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}
function Tag({ children, tone }) {
  const classes = tone ? `${tone[0]} ${tone[1]} ring-1 ring-inset ${tone[2]}` : "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-500/10";
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${classes}`}>{children}</span>;
}
function Badge({ children, tone = ["bg-amber-50", "text-amber-700", "ring-amber-600/15"] }) {
  return <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ${tone[0]} ${tone[1]} ring-1 ring-inset ${tone[2]}`}>{children}</span>;
}
function PrimaryBtn({ children, className = "", tone = "indigo", ...props }) {
  const tones = {
    indigo: "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200",
    teal: "bg-teal-600 hover:bg-teal-700 shadow-teal-200",
  };
  return (
    <button {...props} className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${tones[tone]} ${className}`}>
      {children}
    </button>
  );
}
function GhostBtn({ children, className = "", ...props }) {
  return (
    <button {...props} className={`inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition-all duration-150 hover:bg-slate-50 active:scale-[0.98] ${className}`}>
      {children}
    </button>
  );
}
function IconBtn({ children, tone = "slate", ...props }) {
  const tones = {
    slate: "text-slate-400 hover:bg-slate-100 hover:text-slate-700",
    indigo: "text-slate-400 hover:bg-indigo-50 hover:text-indigo-600",
    rose: "text-slate-400 hover:bg-rose-50 hover:text-rose-600",
  };
  return (
    <button {...props} onClick={(e) => { e.stopPropagation(); props.onClick?.(e); }} className={`grid h-8 w-8 place-items-center rounded-md transition-colors duration-150 ${tones[tone]}`}>
      {children}
    </button>
  );
}
function DetailRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2.5 last:border-0">
      <span className="text-xs font-medium text-slate-400">{label}</span>
      <span className="text-right text-sm text-slate-700">{value}</span>
    </div>
  );
}
function Backdrop({ onClick, children }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
      onClick={onClick} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      {children}
    </motion.div>
  );
}
function ModalShell({ children, maxWidth = "max-w-2xl" }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 8 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }} onClick={(e) => e.stopPropagation()}
      className={`max-h-[88vh] w-full overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-slate-900/5 sm:p-7 ${maxWidth}`}>
      {children}
    </motion.div>
  );
}
function ModalHeader({ title, subtitle, onClose }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h3 className="truncate text-lg font-semibold tracking-tight text-slate-900">{title}</h3>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      <button onClick={onClose} className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
    </div>
  );
}
function EmptyState({ title, subtitle }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-16 text-center">
      <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-white shadow-sm ring-1 ring-slate-100">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-400"><path d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" /></svg>
      </div>
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}
    </div>
  );
}
function Skeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-52 animate-pulse rounded-2xl border border-slate-100 bg-white p-4">
          <div className="mb-3 h-4 w-2/3 rounded bg-slate-100" />
          <div className="mb-2 h-3 w-1/2 rounded bg-slate-100" />
          <div className="mt-6 flex gap-2"><div className="h-5 w-16 rounded-full bg-slate-100" /><div className="h-5 w-16 rounded-full bg-slate-100" /></div>
        </div>
      ))}
    </div>
  );
}

/* ── Main page ────────────────────────────────────────────────── */
export default function RFQs() {
  const { user, token } = useAuth();
  const isAdmin = user?.role === "Admin";
  const productsHook = useProducts();

  const [rfqs, setRFQs] = useState([]);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [showRFQModal, setShowRFQModal] = useState(false);
  const [editRFQ, setEditRFQ] = useState(null);
  const [rfqForm, setRFQForm] = useState(emptyRFQ);
  const [rfqSaving, setRFQSaving] = useState(false);
  const [rfqError, setRFQError] = useState("");

  const [detailRFQ, setDetailRFQ] = useState(null);

  const [showFollowupModal, setShowFollowupModal] = useState(false);
  const [activeRFQ, setActiveRFQ] = useState(null);
  const [followups, setFollowups] = useState([]);
  const [followupsLoading, setFollowupsLoading] = useState(false);
  const [editFollowup, setEditFollowup] = useState(null);
  const [followupForm, setFollowupForm] = useState(emptyFollowup);
  const [followupSaving, setFollowupSaving] = useState(false);
  const [followupError, setFollowupError] = useState("");
  const [showFollowupForm, setShowFollowupForm] = useState(false);

  const remarkOptions =
    followupForm.next_action === "Close Enquiry" ? CLOSE_ENQUIRY_REMARKS
    : followupForm.next_action === "No Further Action" ? NO_FURTHER_ACTION_REMARKS
    : [];

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

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

  const getLatestStatus = (rfq) => {
    const fups = rfq.rfq_followups || [];
    if (!fups.length) return null;
    return [...fups].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]?.enquiry_status;
  };

  const filtered = rfqs.filter((r) => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      r.company_name?.toLowerCase().includes(q) ||
      r.product_name?.toLowerCase().includes(q) ||
      r.product_category?.toLowerCase().includes(q) ||
      r.leads?.company_name?.toLowerCase().includes(q);
    const matchCat = !categoryFilter || r.product_category === categoryFilter;
    const matchStatus = !statusFilter || getLatestStatus(r) === statusFilter;
    return matchSearch && matchCat && matchStatus;
  });

  function openAddRFQ() { setEditRFQ(null); setRFQForm(emptyRFQ); setRFQError(""); setShowRFQModal(true); }
  function openEditRFQ(rfq) {
    setEditRFQ(rfq);
    setRFQForm({
      lead_id: rfq.lead_id || "", company_name: rfq.company_name || "",
      product_category: rfq.product_category || "", product_sub_category: rfq.product_sub_category || "",
      product_name: rfq.product_name || "", product_description: rfq.product_description || "",
      consumption_per_month: rfq.consumption_per_month || "", unit: rfq.unit || "",
      sample_required: rfq.sample_required || false, sample_description: rfq.sample_description || "",
      sample_received_from_customer: rfq.sample_received_from_customer || false,
      quotation_required: rfq.quotation_required || false, quotation_description: rfq.quotation_description || "",
      existing_supplier_brand: rfq.existing_supplier_brand || "",
    });
    setRFQError(""); setShowRFQModal(true);
  }

  function handleRFQChange(e) {
    const { name, value, type, checked } = e.target;
    setRFQForm((p) => ({ ...p, [name]: type === "checkbox" ? checked : value }));
  }
  function handleProductChange(field, value) { setRFQForm((p) => ({ ...p, [field]: value })); }
  function handleLeadSelect(e) {
    const leadId = e.target.value;
    const lead = leads.find((l) => l.id === leadId);
    setRFQForm((p) => ({ ...p, lead_id: leadId, company_name: lead?.company_name || p.company_name }));
  }

  async function handleRFQSubmit(e) {
    e.preventDefault();
    if (!rfqForm.lead_id) { setRFQError("Please select a lead"); return; }
    if (!rfqForm.product_name?.trim()) { setRFQError("Product name is required"); return; }
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
      setDetailRFQ(null);
      fetchRFQs();
    } catch (e) { alert(e.message); }
  }

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

  function openAddFollowup() { setEditFollowup(null); setFollowupForm(emptyFollowup); setFollowupError(""); setShowFollowupForm(true); }
  function openEditFollowup(f) {
    setEditFollowup(f);
    setFollowupForm({
      contact_type: f.contact_type || "", sample_status_update: f.sample_status_update || "",
      quotation_status_update: f.quotation_status_update || "", next_action: f.next_action || "",
      notes: f.notes || "", followup_date: f.followup_date || "", target_price: f.target_price || "",
      enquiry_status: f.enquiry_status || "", remark: f.remark || "",
    });
    setFollowupError(""); setShowFollowupForm(true);
  }
  function handleFollowupChange(e) {
    const { name, value } = e.target;
    setFollowupForm((p) => ({ ...p, [name]: value }));
  }

  async function handleFollowupSubmit(e) {
    e.preventDefault();
    setFollowupSaving(true); setFollowupError("");
    try {
      const url = editFollowup ? `${API}/api/rfqs/followups/${editFollowup.id}` : `${API}/api/rfqs/${activeRFQ.id}/followups`;
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

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-[26px]">Enquiries</h1>
            <p className="mt-1 text-sm text-slate-500">
              {isAdmin ? "All enquiries across your BBM Organization" : "Enquiries you've added"} ·{" "}
              <span className="font-medium text-slate-700">{filtered.length}</span> record{filtered.length !== 1 ? "s" : ""}
            </p>
          </div>
          <PrimaryBtn onClick={openAddRFQ}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            Add Enquiry
          </PrimaryBtn>
        </div>

        {/* Filters */}
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        {/* Desktop */}
        <div className="hidden lg:grid gap-3 lg:grid-cols-[minmax(320px,1fr)_180px_170px_auto]">
            {/* Search */}
            <div className="relative">
            <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            >
                <path d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
            </svg>

            <input
                placeholder="Search product, company, category…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={inputCls("pl-9")}
            />
            </div>

            {/* Category */}
            <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className={inputCls()}
            >
            <option value="">All Categories</option>
            {categories.map((c) => (
                <option key={c}>{c}</option>
            ))}
            </select>

            {/* Status */}
            <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={inputCls()}
            >
            <option value="">All Statuses</option>
            {ENQUIRY_STATUSES.map((s) => (
                <option key={s}>{s}</option>
            ))}
            </select>

            {hasActiveFilters && (
            <button
                onClick={() => {
                setSearch("");
                setCategoryFilter("");
                setStatusFilter("");
                }}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100"
            >
                Clear
            </button>
            )}
        </div>

        {/* Mobile */}
        <div className="space-y-3 lg:hidden">
            {/* Search + Category */}
            <div className="flex gap-2">
            <div className="relative flex-1">
                <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                >
                <path d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
                </svg>

                <input
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={inputCls("pl-9")}
                />
            </div>

            <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className={`${inputCls()} w-36`}
            >
                <option value="">Category</option>
                {categories.map((c) => (
                <option key={c}>{c}</option>
                ))}
            </select>
            </div>

            {/* Buttons */}
            <div className="flex gap-2">
            <button
                onClick={() => setShowMoreFilters((v) => !v)}
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50"
            >
                {showMoreFilters ? "Hide Filters" : "More Filters"}
            </button>

            {hasActiveFilters && (
                <button
                onClick={() => {
                    setSearch("");
                    setCategoryFilter("");
                    setStatusFilter("");
                }}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50"
                >
                Clear
                </button>
            )}
            </div>

            {/* Expandable */}
            {showMoreFilters && (
            <div className="border-t border-slate-100 pt-3">
                <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={inputCls()}
                >
                <option value="">All Statuses</option>
                {ENQUIRY_STATUSES.map((s) => (
                    <option key={s}>{s}</option>
                ))}
                </select>
            </div>
            )}
        </div>
        </div>

        {loading && <Skeleton />}
        {!loading && error && <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div>}
        {!loading && !error && filtered.length === 0 && (
          <EmptyState title="No RFQs found" subtitle={hasActiveFilters ? "Try adjusting your filters" : "Add your first RFQ to get started"} />
        )}

        {/* Grid */}
        {!loading && !error && filtered.length > 0 && (
          <motion.div layout className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {filtered.map((rfq, i) => {
                const latestStatus = getLatestStatus(rfq);
                const tone = statusColor[latestStatus];
                const followupCount = rfq.rfq_followups?.length || 0;
                const canEdit = isAdmin || rfq.created_by === user?.id;

                return (
                  <motion.div
                    key={rfq.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.2, delay: i * 0.02 }}
                    onClick={() => setDetailRFQ(rfq)}
                    className="group relative cursor-pointer overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-lg hover:shadow-slate-200/60"
                  >
                    <span className="absolute inset-y-0 left-0 w-[3px] bg-indigo-500/0 transition-colors duration-200 group-hover:bg-indigo-500" />

                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-[15px] font-semibold text-slate-900">{rfq.product_name || "Unnamed Product"}</h3>
                        <p className="mt-0.5 truncate text-[13px] text-slate-500">{rfq.company_name || rfq.leads?.company_name}</p>
                      </div>
                      {canEdit && (
                        <div className="flex flex-shrink-0 gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                          <IconBtn tone="indigo" onClick={() => openEditRFQ(rfq)}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.12 2.12 0 113 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                          </IconBtn>
                          <IconBtn tone="rose" onClick={() => handleDeleteRFQ(rfq.id)}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0l-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6h16z" /></svg>
                          </IconBtn>
                        </div>
                      )}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {rfq.product_category && <Tag>{rfq.product_category}</Tag>}
                      {latestStatus && <Tag tone={tone}>{latestStatus}</Tag>}
                    </div>

                    <div className="mt-3.5 space-y-1.5 border-t border-slate-100 pt-3 text-[13px] text-slate-600">
                      {rfq.consumption_per_month && (
                        <div className="flex items-center gap-2">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 text-slate-400"><path d="M21 8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16V8z" /></svg>
                          <span className="truncate">{rfq.consumption_per_month} {rfq.unit || ""}/month</span>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {rfq.sample_required && <Badge tone={["bg-violet-50", "text-violet-700", "ring-violet-600/15"]}>Sample</Badge>}
                        {rfq.quotation_required && <Badge tone={["bg-sky-50", "text-sky-700", "ring-sky-600/15"]}>Quotation</Badge>}
                      </div>
                    </div>

                    <div className="mt-3.5 flex items-center justify-between border-t border-slate-100 pt-3">
                      <span className="text-xs text-slate-400">{followupCount} follow-up{followupCount !== 1 ? "s" : ""}</span>
                      <span className="text-[12px] font-medium text-indigo-500 opacity-0 transition-opacity duration-150 group-hover:opacity-100">View details →</span>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* ── Detail Modal ─────────────────────────────────────────── */}
      <AnimatePresence>
        {detailRFQ && (
          <Backdrop onClick={() => setDetailRFQ(null)}>
            <ModalShell maxWidth="max-w-lg">
              <ModalHeader
                title={detailRFQ.product_name || "Unnamed Product"}
                subtitle={detailRFQ.company_name || detailRFQ.leads?.company_name}
                onClose={() => setDetailRFQ(null)}
              />
              <div className="mb-4 flex flex-wrap gap-1.5">
                {detailRFQ.product_category && <Tag>{detailRFQ.product_category}</Tag>}
                {detailRFQ.product_sub_category && <Tag tone={["bg-violet-50", "text-violet-700", "ring-violet-600/15"]}>{detailRFQ.product_sub_category}</Tag>}
                {getLatestStatus(detailRFQ) && <Tag tone={statusColor[getLatestStatus(detailRFQ)]}>{getLatestStatus(detailRFQ)}</Tag>}
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-4">
                <DetailRow label="Description" value={detailRFQ.product_description} />
                <DetailRow label="Existing Supplier" value={detailRFQ.existing_supplier_brand} />
                <DetailRow label="Consumption" value={detailRFQ.consumption_per_month ? `${detailRFQ.consumption_per_month} ${detailRFQ.unit || ""}/month` : null} />
                {isAdmin && <DetailRow label="Owner" value={detailRFQ.users?.email} />}
                <DetailRow label="Created" value={new Date(detailRFQ.created_at).toLocaleDateString()} />
              </div>

              {detailRFQ.sample_required && (
                <div className="mt-3 rounded-xl border border-violet-100 bg-violet-50/50 p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-violet-700">🧪 Sample</span>
                    {detailRFQ.samples?.[0]?.sample_status ? (
                      <Tag tone={sampleStatusColor[detailRFQ.samples[0].sample_status]}>{detailRFQ.samples[0].sample_status}</Tag>
                    ) : (
                      <span className="text-[11px] text-slate-400">Awaiting status</span>
                    )}
                  </div>
                  {detailRFQ.sample_description && <p className="mt-1.5 text-xs text-slate-600">{detailRFQ.sample_description}</p>}
                  {detailRFQ.samples?.[0]?.follow_up_date && (
                    <p className="mt-1.5 text-[11px] text-slate-500">📅 Follow-up: {new Date(detailRFQ.samples[0].follow_up_date).toLocaleDateString()}</p>
                  )}
                </div>
              )}

              {detailRFQ.quotation_required && (
                <div className="mt-3 rounded-xl border border-sky-100 bg-sky-50/50 p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-sky-700">📄 Quotation</span>
                    {detailRFQ.quotations?.[0]?.quotation_status ? (
                      <Tag tone={quotationStatusColor[detailRFQ.quotations[0].quotation_status]}>{detailRFQ.quotations[0].quotation_status}</Tag>
                    ) : (
                      <span className="text-[11px] text-slate-400">Awaiting status</span>
                    )}
                  </div>
                  {detailRFQ.quotation_description && <p className="mt-1.5 text-xs text-slate-600">{detailRFQ.quotation_description}</p>}
                  {detailRFQ.quotations?.[0]?.follow_up_date && (
                    <p className="mt-1.5 text-[11px] text-slate-500">📅 Follow-up: {new Date(detailRFQ.quotations[0].follow_up_date).toLocaleDateString()}</p>
                  )}
                </div>
              )}

              <div className="mt-5 flex flex-wrap justify-end gap-2.5 border-t border-slate-100 pt-4">
                <GhostBtn onClick={() => { openFollowups(detailRFQ); setDetailRFQ(null); }}>📋 Follow-ups ({detailRFQ.rfq_followups?.length || 0})</GhostBtn>
                {(isAdmin || detailRFQ.created_by === user?.id) && (
                  <>
                    <GhostBtn className="border-rose-200 text-rose-600 hover:bg-rose-50" onClick={() => handleDeleteRFQ(detailRFQ.id)}>Delete</GhostBtn>
                    <PrimaryBtn onClick={() => { openEditRFQ(detailRFQ); setDetailRFQ(null); }}>Edit RFQ</PrimaryBtn>
                  </>
                )}
              </div>
            </ModalShell>
          </Backdrop>
        )}
      </AnimatePresence>

      {/* ── RFQ Add/Edit Modal ───────────────────────────────────── */}
      <AnimatePresence>
        {showRFQModal && (
          <Backdrop onClick={() => setShowRFQModal(false)}>
            <ModalShell>
              <ModalHeader title={editRFQ ? "Edit Enquiry" : "Add New Enquiry"} onClose={() => setShowRFQModal(false)} />
              <form onSubmit={handleRFQSubmit}>
                <Section title="Lead">
                  <div className="col-span-1 mb-3.5 sm:col-span-2">
                    <Label>Select Lead *</Label>
                    <select name="lead_id" value={rfqForm.lead_id} onChange={handleLeadSelect} className={inputCls("appearance-none")}>
                      <option value="">— Select a lead —</option>
                      {leads.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.company_name}{l.contact_name ? ` · ${l.contact_name}` : ""}{l.city ? ` (${l.city})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Field label="Company Name" name="company_name" value={rfqForm.company_name} onChange={handleRFQChange} />
                </Section>

                <Section title="Product Details">
                  <ProductPicker
                    category={rfqForm.product_category}
                    subCategory={rfqForm.product_sub_category}
                    productName={rfqForm.product_name}
                    onChange={handleProductChange}
                    useProductsHook={productsHook}
                  />
                  <Field label="Existing Supplier / Brand" name="existing_supplier_brand" value={rfqForm.existing_supplier_brand} onChange={handleRFQChange} />
                  <div className="col-span-1 sm:col-span-2">
                    <Field label="Product Description" name="product_description" value={rfqForm.product_description} onChange={handleRFQChange} />
                  </div>
                </Section>

                <Section title="Consumption">
                  <Field label="Consumption / Month" name="consumption_per_month" type="number" value={rfqForm.consumption_per_month} onChange={handleRFQChange} />
                  <Field label="Unit (kg / pcs / ltr…)" name="unit" value={rfqForm.unit} onChange={handleRFQChange} />
                </Section>

                <Section title="Sample & Quotation">
                  <CheckField id="sampleReq" name="sample_required" checked={rfqForm.sample_required} onChange={handleRFQChange} label="Sample Required" />
                  <CheckField id="sampleRec" name="sample_received_from_customer" checked={rfqForm.sample_received_from_customer} onChange={handleRFQChange} label="Sample Received from Customer" />
                  {rfqForm.sample_required && (
                    <div className="col-span-1 sm:col-span-2">
                      <Field label="Sample Description" name="sample_description" value={rfqForm.sample_description} onChange={handleRFQChange} />
                    </div>
                  )}
                  <CheckField id="quotReq" name="quotation_required" checked={rfqForm.quotation_required} onChange={handleRFQChange} label="Quotation Required" />
                  {rfqForm.quotation_required && (
                    <div className="col-span-1 sm:col-span-2">
                      <Field label="Quotation Description" name="quotation_description" value={rfqForm.quotation_description} onChange={handleRFQChange} />
                    </div>
                  )}
                </Section>

                {rfqError && <p className="mb-3 text-sm text-rose-600">{rfqError}</p>}
                <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-4">
                  <GhostBtn type="button" onClick={() => setShowRFQModal(false)}>Cancel</GhostBtn>
                  <PrimaryBtn type="submit" disabled={rfqSaving}>{rfqSaving ? "Saving…" : editRFQ ? "Update RFQ" : "Add RFQ"}</PrimaryBtn>
                </div>
              </form>
            </ModalShell>
          </Backdrop>
        )}
      </AnimatePresence>

      {/* ── Follow-ups Modal ─────────────────────────────────────── */}
      <AnimatePresence>
        {showFollowupModal && activeRFQ && (
          <Backdrop onClick={() => setShowFollowupModal(false)}>
            <ModalShell maxWidth="max-w-2xl">
              <ModalHeader
                title={`Follow-ups — ${activeRFQ.product_name || "RFQ"}`}
                subtitle={activeRFQ.company_name || activeRFQ.leads?.company_name}
                onClose={() => setShowFollowupModal(false)}
              />

              {!showFollowupForm && (
                <PrimaryBtn tone="teal" className="mb-4" onClick={openAddFollowup}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                  Add Follow-up
                </PrimaryBtn>
              )}

              <AnimatePresence>
                {showFollowupForm && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="mb-5 overflow-hidden rounded-xl border border-slate-200 bg-slate-50/70 p-4"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-700">{editFollowup ? "Edit Follow-up" : "New Follow-up"}</p>
                      <button onClick={() => { setShowFollowupForm(false); setEditFollowup(null); }} className="grid h-7 w-7 place-items-center rounded-md text-slate-400 hover:bg-slate-200/60 hover:text-slate-600">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                      </button>
                    </div>
                    <form onSubmit={handleFollowupSubmit}>
                      <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
                        <SelectField label="Contact Type" name="contact_type" value={followupForm.contact_type} onChange={handleFollowupChange} options={CONTACT_TYPES} />
                        <SelectField label="Enquiry Status" name="enquiry_status" value={followupForm.enquiry_status} onChange={handleFollowupChange} options={ENQUIRY_STATUSES} />
                        <Field label="Follow-up Date" name="followup_date" type="date" value={followupForm.followup_date} onChange={handleFollowupChange} />
                        <Field label="Target Price" name="target_price" type="number" value={followupForm.target_price} onChange={handleFollowupChange} placeholder="₹" />
                        <SelectField label="Sample Status Update" name="sample_status_update" value={followupForm.sample_status_update} onChange={handleFollowupChange} options={SAMPLE_STATUS_OPTIONS} />
                        <SelectField label="Quotation Status Update" name="quotation_status_update" value={followupForm.quotation_status_update} onChange={handleFollowupChange} options={QUOTATION_STATUS_OPTIONS} />
                        <SelectField label="Next Step" name="next_action" value={followupForm.next_action} onChange={handleFollowupChange} options={NEXT_ACTION_OPTIONS} />
                        {remarkOptions.length > 0 && (
                          <SelectField label="Remark" name="remark" value={followupForm.remark} onChange={handleFollowupChange} options={remarkOptions} />
                        )}
                        <div className="col-span-1 sm:col-span-2">
                          <Field label="Notes" name="notes" value={followupForm.notes} onChange={handleFollowupChange} />
                        </div>
                      </div>
                      {followupError && <p className="mb-2 text-sm text-rose-600">{followupError}</p>}
                      <div className="flex justify-end gap-2.5">
                        <GhostBtn type="button" onClick={() => { setShowFollowupForm(false); setEditFollowup(null); }}>Cancel</GhostBtn>
                        <PrimaryBtn tone="teal" type="submit" disabled={followupSaving}>{followupSaving ? "Saving…" : editFollowup ? "Update" : "Add Follow-up"}</PrimaryBtn>
                      </div>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>

              {followupsLoading && <p className="py-6 text-center text-sm text-slate-400">Loading follow-ups…</p>}
              {!followupsLoading && followups.length === 0 && (
                <EmptyState title="No follow-ups yet" subtitle="Add the first one to start tracking this enquiry" />
              )}

              <div className="flex flex-col gap-3">
                <AnimatePresence>
                  {[...followups].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map((f) => (
                    <motion.div
                      key={f.id}
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="rounded-xl border border-slate-200 bg-white p-3.5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {f.contact_type && <Tag>{f.contact_type}</Tag>}
                          {f.enquiry_status && <Tag tone={statusColor[f.enquiry_status]}>{f.enquiry_status}</Tag>}
                          {f.followup_date && <span className="text-xs text-slate-400">📅 {new Date(f.followup_date).toLocaleDateString()}</span>}
                        </div>
                        <div className="flex flex-shrink-0 gap-0.5">
                          <IconBtn tone="indigo" onClick={() => openEditFollowup(f)}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.12 2.12 0 113 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                          </IconBtn>
                          <IconBtn tone="rose" onClick={() => handleDeleteFollowup(f.id)}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0l-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6h16z" /></svg>
                          </IconBtn>
                        </div>
                      </div>
                      <div className="mt-2.5 space-y-1 text-[13px] text-slate-600">
                        {f.sample_status_update && <p>🧪 {f.sample_status_update}</p>}
                        {f.quotation_status_update && <p>📄 {f.quotation_status_update}</p>}
                        {f.target_price && <p>💰 Target: ₹{f.target_price}</p>}
                        {f.next_action && <p>⏭️ {f.next_action}</p>}
                        {f.notes && <p>📝 {f.notes}</p>}
                        {f.remark && <p>💬 {f.remark}</p>}
                      </div>
                      <p className="mt-2 text-[11px] text-slate-400">Added {new Date(f.created_at).toLocaleString()}</p>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </ModalShell>
          </Backdrop>
        )}
      </AnimatePresence>
    </div>
  );
}