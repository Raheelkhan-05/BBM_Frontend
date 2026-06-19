//Leads.jsx
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRoutes } from "../hooks/useRoutes";
import { useAuth } from "../context/AuthContext";
import LocationPicker from "./components/LocationPicker";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

const emptyForm = {
  company_name: "",
  city: "",
  zone: "",
  route: "",
  mobile_number: "",
  contact_name: "",
  nature_of_business: "",
  manufacturing_industry: "",
  email: "",
  designation: "",
  alternate_mobile_number: "",
  whatsapp_same_as_mobile: false,
  whatsapp_number: "",
  company_website: "",
};

const BUSINESS_TYPES = ["Trader", "Wholesaler", "Retailer", "Exporter", "Manufacturer"];

const DESIGNATIONS = [
  "Owner", "Purchase Manager", "Director", "Production Head", "Factory Manager",
  "Plant Head", "Operations Manager", "Procurement Manager", "Technical Manager", "Other",
];

const BUSINESS_ACCENT = {
  Trader: "bg-amber-50 text-amber-700 ring-amber-600/15",
  Wholesaler: "bg-sky-50 text-sky-700 ring-sky-600/15",
  Retailer: "bg-violet-50 text-violet-700 ring-violet-600/15",
  Exporter: "bg-rose-50 text-rose-700 ring-rose-600/15",
  Manufacturer: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
};

/* ── Shared field primitives ─────────────────────────────────── */
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
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
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
function Tag({ children, className = "" }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset ${className || "bg-slate-100 text-slate-600 ring-slate-500/10"}`}>
      {children}
    </span>
  );
}
function PrimaryBtn({ children, className = "", ...props }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-200 transition-all duration-150 hover:bg-indigo-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  );
}
function GhostBtn({ children, className = "", ...props }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition-all duration-150 hover:bg-slate-50 active:scale-[0.98] ${className}`}
    >
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
function DetailRow({ label, value, mono = false }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2.5 last:border-0">
      <span className="text-xs font-medium text-slate-400">{label}</span>
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
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
      className={`max-h-[88vh] w-full overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-slate-900/5 sm:p-7 ${maxWidth}`}
    >
      {children}
    </motion.div>
  );
}
function ModalHeader({ title, subtitle, onClose }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        <h3 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h3>
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
        <div key={i} className="h-44 animate-pulse rounded-2xl border border-slate-100 bg-white p-4">
          <div className="mb-3 h-4 w-2/3 rounded bg-slate-100" />
          <div className="mb-2 h-3 w-1/2 rounded bg-slate-100" />
          <div className="mt-6 flex gap-2">
            <div className="h-5 w-16 rounded-full bg-slate-100" />
            <div className="h-5 w-16 rounded-full bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Main page ────────────────────────────────────────────────── */
export default function Leads() {
  const { user, token } = useAuth();
  const isAdmin = user?.role === "Admin";
  const routesHook = useRoutes();

  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showMoreFilters, setShowMoreFilters] = useState(false);

  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [zoneFilter, setZoneFilter] = useState("");
  const [natureFilter, setNatureFilter] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editLead, setEditLead] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [detailLead, setDetailLead] = useState(null);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError("");
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

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const cities = [...new Set(leads.map((l) => l.city).filter(Boolean))];
  const zones = [...new Set(leads.map((l) => l.zone).filter(Boolean))];
  const natures = [...new Set(leads.map((l) => l.nature_of_business).filter(Boolean))];

  const filtered = leads.filter((l) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      l.company_name?.toLowerCase().includes(q) ||
      l.contact_name?.toLowerCase().includes(q) ||
      l.mobile_number?.includes(q) ||
      l.email?.toLowerCase().includes(q) ||
      l.manufacturing_industry?.toLowerCase().includes(q);
    const matchCity = !cityFilter || l.city === cityFilter;
    const matchZone = !zoneFilter || l.zone === zoneFilter;
    const matchNature = !natureFilter || l.nature_of_business === natureFilter;
    return matchSearch && matchCity && matchZone && matchNature;
  });

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
      city: lead.city || "",
      zone: lead.zone || "",
      route: lead.route || "",
      mobile_number: lead.mobile_number || "",
      contact_name: lead.contact_name || "",
      nature_of_business: lead.nature_of_business || "",
      manufacturing_industry: lead.manufacturing_industry || "",
      email: lead.email || "",
      designation: lead.designation || "",
      alternate_mobile_number: lead.alternate_mobile_number || "",
      whatsapp_same_as_mobile: lead.whatsapp_same_as_mobile || false,
      whatsapp_number: lead.whatsapp_number || "",
      company_website: lead.company_website || "",
    });
    setFormError("");
    setShowModal(true);
  }

  function handleFormChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => {
      const updated = { ...prev, [name]: type === "checkbox" ? checked : value };
      if (name === "whatsapp_same_as_mobile" && checked) {
        updated.whatsapp_number = prev.mobile_number;
      }
      if (name === "mobile_number" && prev.whatsapp_same_as_mobile) {
        updated.whatsapp_number = value;
      }
      return updated;
    });
  }

  function handleLocationChange(field, value) {
    setForm((p) => ({ ...p, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.company_name.trim()) {
      setFormError("Company name is required.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const url = editLead ? `${API}/api/leads/${editLead.id}` : `${API}/api/leads`;
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
    setSearch("");
    setCityFilter("");
    setZoneFilter("");
    setNatureFilter("");
  };

  const hasActiveFilters = search || cityFilter || zoneFilter || natureFilter;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-[26px]">Leads</h1>
            <p className="mt-1 text-sm text-slate-500">
              {isAdmin ? "All leads across your BBM Organization" : "Leads you've added"} ·{" "}
              <span className="font-medium text-slate-700">{filtered.length}</span> record{filtered.length !== 1 ? "s" : ""}
            </p>
          </div>
          <PrimaryBtn onClick={openAdd}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            Add Lead
          </PrimaryBtn>
        </div>

        {/* Filters */}
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          {/* Desktop */}
          <div className="hidden lg:grid gap-3 lg:grid-cols-[minmax(320px,1fr)_160px_160px_190px_auto]">
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
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={inputCls("pl-9")}
              />
            </div>

            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className={inputCls()}
            >
              <option value="">All Cities</option>
              {cities.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>

            <select
              value={zoneFilter}
              onChange={(e) => setZoneFilter(e.target.value)}
              className={inputCls()}
            >
              <option value="">All Zones</option>
              {zones.map((z) => (
                <option key={z}>{z}</option>
              ))}
            </select>

            <select
              value={natureFilter}
              onChange={(e) => setNatureFilter(e.target.value)}
              className={inputCls()}
            >
              <option value="">All Business Types</option>
              {natures.map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100"
              >
                Clear
              </button>
            )}
          </div>

          {/* Mobile */}
          <div className="space-y-3 lg:hidden">
            {/* First row */}
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

              
            </div>
            <select
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                className={`${inputCls()} w-32`}
              >
                <option value="">City</option>
                {cities.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>

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
                  onClick={clearFilters}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Expandable Filters */}
            {showMoreFilters && (
              <div className="space-y-3 border-t border-slate-100 pt-3">
                <select
                  value={zoneFilter}
                  onChange={(e) => setZoneFilter(e.target.value)}
                  className={inputCls()}
                >
                  <option value="">All Zones</option>
                  {zones.map((z) => (
                    <option key={z}>{z}</option>
                  ))}
                </select>

                <select
                  value={natureFilter}
                  onChange={(e) => setNatureFilter(e.target.value)}
                  className={inputCls()}
                >
                  <option value="">All Business Types</option>
                  {natures.map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>


        {/* States */}
        {loading && <Skeleton />}
        {!loading && error && (
          <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div>
        )}
        {!loading && !error && filtered.length === 0 && (
          <EmptyState title="No leads found" subtitle={hasActiveFilters ? "Try adjusting your filters" : "Add your first lead to get started"} />
        )}

        {/* Grid */}
        {!loading && !error && filtered.length > 0 && (
          <motion.div layout className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <AnimatePresence mode="popLayout">
              {filtered.map((lead, i) => {
                const canEdit = isAdmin || lead.created_by === user?.id;
                const accent = BUSINESS_ACCENT[lead.nature_of_business] || "bg-slate-100 text-slate-600 ring-slate-500/10";
                return (
                  <motion.div
                    key={lead.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.2, delay: i * 0.02 }}
                    onClick={() => setDetailLead(lead)}
                    className="group relative cursor-pointer overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-lg hover:shadow-slate-200/60"
                  >
                    <span className="absolute inset-y-0 left-0 w-[3px] bg-indigo-500/0 transition-colors duration-200 group-hover:bg-indigo-500" />

                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-[15px] font-semibold text-slate-900">{lead.company_name}</h3>
                        {lead.contact_name && (
                          <p className="mt-0.5 truncate text-[13px] text-slate-500">
                            {lead.contact_name}{lead.designation ? ` · ${lead.designation}` : ""}
                          </p>
                        )}
                      </div>
                      {canEdit && (
                        <div className="flex flex-shrink-0 gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                          <IconBtn tone="indigo" onClick={() => openEdit(lead)}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.12 2.12 0 113 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                          </IconBtn>
                          <IconBtn tone="rose" onClick={() => handleDelete(lead.id)}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0l-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6h16z" /></svg>
                          </IconBtn>
                        </div>
                      )}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {lead.city && <Tag>{lead.city}</Tag>}
                      {lead.nature_of_business && <Tag className={accent}>{lead.nature_of_business}</Tag>}
                    </div>

                    <div className="mt-3.5 space-y-1.5 border-t border-slate-100 pt-3 text-[13px] text-slate-600">
                      {lead.mobile_number && (
                        <div className="flex items-center gap-2">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 text-slate-400"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" /></svg>
                          <span className="truncate">{lead.mobile_number}</span>
                        </div>
                      )}
                      {lead.manufacturing_industry && (
                        <div className="flex items-center gap-2">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 text-slate-400"><path d="M2 20h20M4 20V10l5 4v-4l5 4v-4l5 4v6" /></svg>
                          <span className="truncate">{lead.manufacturing_industry}</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-3 flex items-center justify-end text-[12px] font-medium text-indigo-500 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                      View details →
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {detailLead && (
          <Backdrop onClick={() => setDetailLead(null)}>
            <ModalShell maxWidth="max-w-lg">
              <ModalHeader
                title={detailLead.company_name}
                subtitle={detailLead.contact_name ? `${detailLead.contact_name}${detailLead.designation ? " · " + detailLead.designation : ""}` : undefined}
                onClose={() => setDetailLead(null)}
              />
              <div className="mb-4 flex flex-wrap gap-1.5">
                {detailLead.city && <Tag>{detailLead.city}</Tag>}
                {detailLead.zone && <Tag className="bg-sky-50 text-sky-700 ring-sky-600/15">{detailLead.zone}</Tag>}
                {detailLead.nature_of_business && <Tag className={BUSINESS_ACCENT[detailLead.nature_of_business] || ""}>{detailLead.nature_of_business}</Tag>}
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-4">
                <DetailRow label="Mobile" value={detailLead.mobile_number} />
                <DetailRow label="Alternate Mobile" value={detailLead.alternate_mobile_number} />
                <DetailRow label="WhatsApp" value={detailLead.whatsapp_number} />
                <DetailRow label="Email" value={detailLead.email} />
                <DetailRow label="Route" value={detailLead.route} />
                <DetailRow label="Manufacturing Industry" value={detailLead.manufacturing_industry} />
                <DetailRow
                  label="Website"
                  value={
                    detailLead.company_website ? (
                      <a href={detailLead.company_website} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
                        {detailLead.company_website}
                      </a>
                    ) : null
                  }
                />
                {isAdmin && <DetailRow label="Added by" value={detailLead.created_by_name} />}
                <DetailRow label="Created" value={new Date(detailLead.created_at).toLocaleDateString()} />
              </div>

              {(isAdmin || detailLead.created_by === user?.id) && (
                <div className="mt-5 flex justify-end gap-2.5">
                  <GhostBtn
                    className="border-rose-200 text-rose-600 hover:bg-rose-50"
                    onClick={() => handleDelete(detailLead.id)}
                  >
                    Delete
                  </GhostBtn>
                  <PrimaryBtn
                    onClick={() => {
                      openEdit(detailLead);
                      setDetailLead(null);
                    }}
                  >
                    Edit Lead
                  </PrimaryBtn>
                </div>
              )}
            </ModalShell>
          </Backdrop>
        )}
      </AnimatePresence>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <Backdrop onClick={() => setShowModal(false)}>
            <ModalShell>
              <ModalHeader title={editLead ? "Edit Lead" : "Add New Lead"} onClose={() => setShowModal(false)} />
              <form onSubmit={handleSubmit}>
                <Section title="Company Info">
                  <Field label="Company Name *" name="company_name" value={form.company_name} onChange={handleFormChange} />
                  <SelectField label="Nature of Business" name="nature_of_business" value={form.nature_of_business} onChange={handleFormChange} options={BUSINESS_TYPES} />
                  <Field label="Manufacturing Industry" name="manufacturing_industry" value={form.manufacturing_industry} onChange={handleFormChange} />
                  <Field label="Company Website" name="company_website" value={form.company_website} onChange={handleFormChange} placeholder="https://" />
                </Section>

                <Section title="Location">
                  <div className="col-span-1 sm:col-span-2">
                    <LocationPicker
                      city={form.city}
                      zone={form.zone}
                      route={form.route}
                      onChange={handleLocationChange}
                      useRoutesHook={routesHook}
                    />
                  </div>
                </Section>

                <Section title="Contact Person">
                  <Field label="Contact Name" name="contact_name" value={form.contact_name} onChange={handleFormChange} />
                  <SelectField label="Designation" name="designation" value={form.designation} onChange={handleFormChange} options={DESIGNATIONS} />
                  <Field label="Email" name="email" type="email" value={form.email} onChange={handleFormChange} />
                </Section>

                <Section title="Phone Numbers">
                  <Field label="Mobile Number" name="mobile_number" value={form.mobile_number} onChange={handleFormChange} />
                  <Field label="Alternate Mobile" name="alternate_mobile_number" value={form.alternate_mobile_number} onChange={handleFormChange} />
                  <div className="col-span-1 mb-3.5 flex items-center gap-2 sm:col-span-2">
                    <input type="checkbox" id="waSame" name="whatsapp_same_as_mobile" checked={form.whatsapp_same_as_mobile} onChange={handleFormChange} className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-200" />
                    <label htmlFor="waSame" className="cursor-pointer text-sm text-slate-600">WhatsApp same as Mobile</label>
                  </div>
                  {!form.whatsapp_same_as_mobile && (
                    <Field label="WhatsApp Number" name="whatsapp_number" value={form.whatsapp_number} onChange={handleFormChange} />
                  )}
                </Section>

                {formError && <p className="mb-3 text-sm text-rose-600">{formError}</p>}

                <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-4">
                  <GhostBtn type="button" onClick={() => setShowModal(false)}>Cancel</GhostBtn>
                  <PrimaryBtn type="submit" disabled={saving}>{saving ? "Saving…" : editLead ? "Update Lead" : "Add Lead"}</PrimaryBtn>
                </div>
              </form>
            </ModalShell>
          </Backdrop>
        )}
      </AnimatePresence>
    </div>
  );
}