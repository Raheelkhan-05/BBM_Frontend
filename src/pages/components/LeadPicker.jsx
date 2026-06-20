// components/LeadPicker.jsx
// Search-and-select for picking a Lead inside the RFQ form.
// Mirrors the ProspectPicker UX exactly.
// Props:
//   selectedLead  — full lead object or null
//   onSelect(lead | null) — fired when user picks or clears
//   leads         — array of lead objects (already fetched by RFQs.jsx)
//   error         — optional field-error string

import { useState, useEffect, useRef } from "react";

function inputCls(extra = "") {
  return `w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-150 focus:border-indigo-400 focus:ring-3 focus:ring-indigo-100 hover:border-slate-300 ${extra}`;
}

const Icon = {
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
  Building: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9,22 9,12 15,12 15,22" />
    </svg>
  ),
  MapPin: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
    </svg>
  ),
  Package: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
      <polyline points="3.27,6.96 12,12.01 20.73,6.96" /><line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  ),
  User: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  ),
  CheckCircle: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22,4 12,14.01 9,11.01" />
    </svg>
  ),
  ChevronDown: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <polyline points="6,9 12,15 18,9" />
    </svg>
  ),
  Tag: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  ),
};

const BUSINESS_ACCENT = {
  Trader:       "bg-amber-50 text-amber-700",
  Wholesaler:   "bg-sky-50 text-sky-700",
  Retailer:     "bg-violet-50 text-violet-700",
  Exporter:     "bg-rose-50 text-rose-700",
  Manufacturer: "bg-emerald-50 text-emerald-700",
};

export default function LeadPicker({ selectedLead, onSelect, leads = [], error }) {
  const [query, setQuery]   = useState("");
  const [open, setOpen]     = useState(false);
  const wrapRef             = useRef(null);

  /* Close on outside click */
  useEffect(() => {
    function handle(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  /* Filter leads by query across company name, product name, city */
  const q = query.toLowerCase().trim();
  const filtered = leads.filter((l) => {
    if (!q) return true;
    return (
      l.company_name?.toLowerCase().includes(q) ||
      l.potential_product_name?.toLowerCase().includes(q) ||
      l.potential_product_category?.toLowerCase().includes(q) ||
      l.city?.toLowerCase().includes(q) ||
      l.state?.toLowerCase().includes(q) ||
      (l.primary_contact_name || l.contact_name)?.toLowerCase().includes(q)
    );
  });

  function handleSelect(lead) {
    onSelect(lead);
    setQuery("");
    setOpen(false);
  }

  function handleClear(e) {
    e.stopPropagation();
    onSelect(null);
    setQuery("");
  }

  /* ── Selected state ─────────────────────────────────────────── */
  if (selectedLead) {
    const contactName = selectedLead.primary_contact_name || selectedLead.contact_name;
    const bizAccent   = BUSINESS_ACCENT[selectedLead.nature_of_business] || "bg-slate-50 text-slate-600";

    return (
      <div className={`relative rounded-xl border-2 border-indigo-200 bg-indigo-50/60 px-4 py-3 ${error ? "!border-rose-300 !bg-rose-50/40" : ""}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-100">
              <Icon.Building className="h-4 w-4 text-indigo-600" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-indigo-900">{selectedLead.company_name}</p>
              <p className="truncate text-xs text-indigo-600">
                {[contactName, selectedLead.city, selectedLead.state].filter(Boolean).join(" · ")}
              </p>
            </div>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-600">
              <Icon.CheckCircle className="h-3 w-3" /> Linked
            </span>
            <button
              type="button"
              onClick={handleClear}
              className="grid h-6 w-6 place-items-center rounded-lg text-indigo-400 hover:bg-indigo-100 hover:text-indigo-700 transition-colors"
              title="Change lead"
            >
              <Icon.X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Read-only prefilled summary */}
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-indigo-100 pt-2.5 sm:grid-cols-3">
          {[
            { label: "Contact",   value: contactName,                              icon: Icon.User     },
            { label: "City",      value: selectedLead.city,                        icon: Icon.MapPin   },
            { label: "State",     value: selectedLead.state,                       icon: Icon.MapPin   },
            { label: "Product",   value: selectedLead.potential_product_name,      icon: Icon.Package  },
            { label: "Category",  value: selectedLead.potential_product_category,  icon: Icon.Tag      },
            { label: "Business",  value: selectedLead.nature_of_business,          icon: Icon.Building },
          ].filter((f) => f.value).map((f) => (
            <div key={f.label} className="flex flex-col py-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-indigo-400">{f.label}</span>
              <span className="text-xs text-indigo-800">{f.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ── Picker state ───────────────────────────────────────────── */
  return (
    <div ref={wrapRef} className="relative">
      <div
        className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3.5 py-2.5 transition-all duration-150 bg-white ${
          open
            ? "border-indigo-400 ring-3 ring-indigo-100"
            : error
            ? "border-rose-400 ring-3 ring-rose-100"
            : "border-slate-200 hover:border-slate-300"
        }`}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon.Search className="h-4 w-4 flex-shrink-0 text-slate-400" />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onClick={(e) => { e.stopPropagation(); setOpen(true); }}
          placeholder="Search by company, product, or city…"
          className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none"
        />
        <Icon.ChevronDown className={`h-4 w-4 flex-shrink-0 text-slate-400 transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl ring-1 ring-slate-900/5">
          {leads.length === 0 && (
            <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
              <Icon.Building className="mb-2 h-7 w-7 text-slate-300" />
              <p className="text-sm font-medium text-slate-500">No leads available</p>
              <p className="mt-0.5 text-xs text-slate-400">Add leads first, then create enquiries from them</p>
            </div>
          )}

          {leads.length > 0 && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
              <Icon.Search className="mb-2 h-7 w-7 text-slate-300" />
              <p className="text-sm font-medium text-slate-500">No matching leads</p>
              <p className="mt-0.5 text-xs text-slate-400">Try company name, product, or city</p>
            </div>
          )}

          {filtered.map((lead) => {
            const contactName = lead.primary_contact_name || lead.contact_name;
            const bizAccent   = BUSINESS_ACCENT[lead.nature_of_business] || "bg-slate-100 text-slate-600";

            return (
              <button
                key={lead.id}
                type="button"
                onClick={() => handleSelect(lead)}
                className="flex w-full items-center gap-3 border-b border-slate-50 px-4 py-3 text-left transition-colors hover:bg-indigo-50 last:border-0"
              >
                {/* Left icon */}
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100">
                  <Icon.Building className="h-4 w-4 text-slate-500" />
                </div>

                {/* Middle content */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">{lead.company_name}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                    {contactName && (
                      <span className="flex items-center gap-1">
                        <Icon.User className="h-3 w-3" /> {contactName}
                      </span>
                    )}
                    {lead.city && (
                      <span className="flex items-center gap-1">
                        <Icon.MapPin className="h-3 w-3" /> {lead.city}{lead.state ? `, ${lead.state}` : ""}
                      </span>
                    )}
                    {lead.potential_product_name && (
                      <span className="flex items-center gap-1">
                        <Icon.Package className="h-3 w-3" /> {lead.potential_product_name}
                      </span>
                    )}
                  </div>
                </div>

                {/* Right badge */}
                {lead.nature_of_business && (
                  <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${bizAccent}`}>
                    {lead.nature_of_business}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {error && <p className="mt-1 text-[11px] text-rose-500">{error}</p>}
    </div>
  );
}