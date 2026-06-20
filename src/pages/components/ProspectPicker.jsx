// components/ProspectPicker.jsx
// Renders a search-and-select combo for picking an existing Prospect record.
// When a prospect is selected, it fires onSelect(prospect) with the full object.
// When cleared, it fires onSelect(null).

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

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
  Radar: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
    </svg>
  ),
  MapPin: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
    </svg>
  ),
  Factory: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M2 20h20M4 20V10l5 4v-4l5 4v-4l5 4v6" />
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
};

export default function ProspectPicker({ selectedProspect, onSelect, error }) {
  const { token } = useAuth();
  const [prospects, setProspects] = useState([]);
  const [loading, setLoading]     = useState(false);
  const [query, setQuery]         = useState("");
  const [open, setOpen]           = useState(false);
  const wrapRef                   = useRef(null);

  /* ── Fetch the current user's prospects once ──────────────────── */
  const fetchProspects = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${API}/api/prospects/mine`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setProspects(data.prospects || []);
    } catch (_) { /* silent */ }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { fetchProspects(); }, [fetchProspects]);

  /* ── Close dropdown on outside click ─────────────────────────── */
  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  /* ── Filter by query ──────────────────────────────────────────── */
  const q = query.toLowerCase().trim();
  const filtered = prospects.filter((p) =>
    !q ||
    p.company_name?.toLowerCase().includes(q) ||
    p.industry?.toLowerCase().includes(q) ||
    p.city?.toLowerCase().includes(q)
  );

  function handleSelect(prospect) {
    onSelect(prospect);
    setQuery("");
    setOpen(false);
  }

  function handleClear(e) {
    e.stopPropagation();
    onSelect(null);
    setQuery("");
  }

  /* ── Selected state ───────────────────────────────────────────── */
  if (selectedProspect) {
    return (
      <div className={`relative rounded-xl border-2 border-indigo-200 bg-indigo-50/60 px-4 py-3 ${error ? "!border-rose-300 !bg-rose-50/40" : ""}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-100">
              <Icon.Radar className="h-4 w-4 text-indigo-600" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-indigo-900">{selectedProspect.company_name}</p>
              <p className="truncate text-xs text-indigo-600">
                {[selectedProspect.industry, selectedProspect.city].filter(Boolean).join(" · ")}
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
              title="Remove prospect link"
            >
              <Icon.X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Read-only summary of prefilled fields */}
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-indigo-100 pt-2.5 sm:grid-cols-3">
          {[
            { label: "Industry",  value: selectedProspect.industry },
            { label: "Country",   value: selectedProspect.country },
            { label: "State",     value: selectedProspect.state },
            { label: "City",      value: selectedProspect.city },
            { label: "Zone",      value: selectedProspect.zone },
            { label: "Route",     value: selectedProspect.route },
            { label: "Source",    value: selectedProspect.source },
          ].filter((f) => f.value).map((f) => (
            <div key={f.label} className="flex flex-col py-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-indigo-400">{f.label}</span>
              <span className="text-xs text-indigo-800">{f.value}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-indigo-400">
          Fields prefilled from prospect · Some fields are locked to maintain data consistency
        </p>
      </div>
    );
  }

  /* ── Picker state ─────────────────────────────────────────────── */
  return (
    <div ref={wrapRef} className="relative">
      <div
        className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3.5 py-2.5 transition-all duration-150 ${
          open
            ? "border-indigo-400 ring-3 ring-indigo-100"
            : error
            ? "border-rose-400 ring-3 ring-rose-100"
            : "border-slate-200 hover:border-slate-300"
        } bg-white`}
        onClick={() => { setOpen((v) => !v); }}
      >
        <Icon.Search className="h-4 w-4 flex-shrink-0 text-slate-400" />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onClick={(e) => { e.stopPropagation(); setOpen(true); }}
          placeholder="Search by company name, industry, or city…"
          className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none"
        />
        <Icon.ChevronDown className={`h-4 w-4 flex-shrink-0 text-slate-400 transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl ring-1 ring-slate-900/5">
          {loading && (
            <div className="flex items-center justify-center py-6 text-xs text-slate-400">
              Loading prospects…
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
              <Icon.Radar className="mb-2 h-7 w-7 text-slate-300" />
              <p className="text-sm font-medium text-slate-500">
                {q ? "No matching prospects" : "No prospects yet"}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">
                {q ? "Try a different search" : "Add prospects first, then link them here"}
              </p>
            </div>
          )}
          {!loading && filtered.map((prospect) => (
            <button
              key={prospect.id}
              type="button"
              onClick={() => handleSelect(prospect)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-indigo-50 border-b border-slate-50 last:border-0"
            >
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100">
                <Icon.Radar className="h-4 w-4 text-slate-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">{prospect.company_name}</p>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                  {prospect.industry && (
                    <span className="flex items-center gap-1">
                      <Icon.Factory className="h-3 w-3" /> {prospect.industry}
                    </span>
                  )}
                  {prospect.city && (
                    <span className="flex items-center gap-1">
                      <Icon.MapPin className="h-3 w-3" /> {prospect.city}
                    </span>
                  )}
                </div>
              </div>
              {prospect.source && (
                <span className="flex-shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                  {prospect.source}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
      {error && <p className="mt-1 text-[11px] text-rose-500">{error}</p>}
    </div>
  );
}