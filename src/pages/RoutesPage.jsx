//RoutesPage.jsx
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { useRoutes } from "../hooks/useRoutes";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";
const emptyForm = { city: "", zone: "", route: "" };

function Label({ children }) {
  return <label className="mb-1.5 block text-xs font-medium text-slate-600">{children}</label>;
}
function inputCls(extra = "") {
  return `w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-150 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 ${extra}`;
}
function PrimaryBtn({ children, className = "", ...props }) {
  return (
    <button {...props} className={`inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-200 transition-all duration-150 hover:bg-indigo-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${className}`}>
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
    <button {...props} className={`grid h-8 w-8 place-items-center rounded-md transition-colors duration-150 ${tones[tone]}`}>
      {children}
    </button>
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
function ModalShell({ children }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 8 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }} onClick={(e) => e.stopPropagation()}
      className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-slate-900/5 sm:p-6">
      {children}
    </motion.div>
  );
}
function EmptyState({ title, subtitle }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-16 text-center">
      <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-white shadow-sm ring-1 ring-slate-100">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-400"><path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
      </div>
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}
    </div>
  );
}

export default function RoutesPage() {
  const { token } = useAuth();
  const { routes, loading, refetch, cities, zones } = useRoutes();

  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [zoneFilter, setZoneFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editRoute, setEditRoute] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [showMoreFilters, setShowMoreFilters] = useState(false);

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const filteredZones = cityFilter ? zones(cityFilter) : [];

  const filtered = routes.filter((r) => {
    const q = search.toLowerCase();
    return (
      (!q || r.city.toLowerCase().includes(q) || r.zone.toLowerCase().includes(q) || r.route.toLowerCase().includes(q)) &&
      (!cityFilter || r.city === cityFilter) &&
      (!zoneFilter || r.zone === zoneFilter)
    );
  });

  const grouped = filtered.reduce((acc, r) => {
    const key = `${r.city}__${r.zone}`;
    if (!acc[key]) acc[key] = { city: r.city, zone: r.zone, items: [] };
    acc[key].items.push(r);
    return acc;
  }, {});

  function openAdd() { setEditRoute(null); setForm(emptyForm); setFormError(""); setShowModal(true); }
  function openEdit(r) { setEditRoute(r); setForm({ city: r.city, zone: r.zone, route: r.route }); setFormError(""); setShowModal(true); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.city.trim() || !form.zone.trim() || !form.route.trim()) { setFormError("All fields required"); return; }
    setSaving(true); setFormError("");
    try {
      const url = editRoute ? `${API}/api/routes/${editRoute.id}` : `${API}/api/routes`;
      const res = await fetch(url, { method: editRoute ? "PUT" : "POST", headers, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setShowModal(false); refetch();
    } catch (e) { setFormError(e.message); }
    finally { setSaving(false); }
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this route?")) return;
    try {
      const res = await fetch(`${API}/api/routes/${id}`, { method: "DELETE", headers });
      if (!res.ok) throw new Error("Delete failed");
      refetch();
    } catch (e) { alert(e.message); }
  }

  const hasActiveFilters = search || cityFilter || zoneFilter;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-[1000px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-[26px]">Routes</h1>
            <p className="mt-1 text-sm text-slate-500">
              <span className="font-medium text-slate-700">{filtered.length}</span> route{filtered.length !== 1 ? "s" : ""} across {Object.keys(grouped).length} zone{Object.keys(grouped).length !== 1 ? "s" : ""}
            </p>
          </div>
          <PrimaryBtn onClick={openAdd}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            Add Route
          </PrimaryBtn>
        </div>

        {/* Filters */}
<div className="mb-6 grid gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm
                grid-cols-1
                lg:grid-cols-[minmax(320px,1fr)_160px_160px_auto]">

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
      placeholder="Search city, zone, route…"
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      className={inputCls("pl-9")}
    />
  </div>

  {/* City */}
  <select
    value={cityFilter}
    onChange={(e) => {
      setCityFilter(e.target.value);
      setZoneFilter("");
    }}
    className={inputCls()}
  >
    <option value="">All Cities</option>
    {cities.map((c) => (
      <option key={c}>{c}</option>
    ))}
  </select>

  {/* Zone */}
  <select
    value={zoneFilter}
    onChange={(e) => setZoneFilter(e.target.value)}
    disabled={!cityFilter}
    className={inputCls("disabled:cursor-not-allowed disabled:opacity-50")}
  >
    <option value="">All Zones</option>
    {filteredZones.map((z) => (
      <option key={z}>{z}</option>
    ))}
  </select>

  {/* Clear */}
  {hasActiveFilters && (
    <button
      onClick={() => {
        setSearch("");
        setCityFilter("");
        setZoneFilter("");
      }}
      className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100"
    >
      Clear
    </button>
  )}
</div>

        {loading && (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl border border-slate-100 bg-white" />
            ))}
          </div>
        )}

        {!loading && (
          <motion.div layout className="space-y-5">
            <AnimatePresence>
              {Object.values(grouped).map((group) => (
                <motion.div
                  key={`${group.city}__${group.zone}`}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="mb-2.5 flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/15">{group.city}</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-slate-300"><path d="M9 18l6-6-6-6" /></svg>
                    <span className="inline-flex items-center rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700 ring-1 ring-inset ring-sky-600/15">{group.zone}</span>
                    <span className="ml-auto text-xs text-slate-400">{group.items.length} route{group.items.length !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                    {group.items.map((r, i) => (
                      <div key={r.id} className={`flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-slate-50/80 ${i > 0 ? "border-t border-slate-100" : ""}`}>
                        <span className="flex items-center gap-2 text-sm text-slate-700">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 text-slate-400"><path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
                          {r.route}
                        </span>
                        <div className="flex flex-shrink-0 gap-0.5">
                          <IconBtn tone="indigo" onClick={() => openEdit(r)}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.12 2.12 0 113 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                          </IconBtn>
                          <IconBtn tone="rose" onClick={() => handleDelete(r.id)}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0l-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6h16z" /></svg>
                          </IconBtn>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}

        {!loading && filtered.length === 0 && (
          <EmptyState title="No routes found" subtitle={hasActiveFilters ? "Try adjusting your filters" : "Add your first route to get started"} />
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <Backdrop onClick={() => setShowModal(false)}>
            <ModalShell>
              <div className="mb-5 flex items-center justify-between">
                <h3 className="text-lg font-semibold tracking-tight text-slate-900">{editRoute ? "Edit Route" : "Add Route"}</h3>
                <button onClick={() => setShowModal(false)} className="grid h-8 w-8 place-items-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                </button>
              </div>
              <form onSubmit={handleSubmit}>
                {[["City *", "city"], ["Zone *", "zone"], ["Route *", "route"]].map(([label, name]) => (
                  <div key={name} className="mb-3.5">
                    <Label>{label}</Label>
                    <input value={form[name]} onChange={(e) => setForm((p) => ({ ...p, [name]: e.target.value }))} className={inputCls()} />
                  </div>
                ))}
                {formError && <p className="mb-3 text-sm text-rose-600">{formError}</p>}
                <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-4">
                  <GhostBtn type="button" onClick={() => setShowModal(false)}>Cancel</GhostBtn>
                  <PrimaryBtn type="submit" disabled={saving}>{saving ? "Saving…" : editRoute ? "Update" : "Add"}</PrimaryBtn>
                </div>
              </form>
            </ModalShell>
          </Backdrop>
        )}
      </AnimatePresence>
    </div>
  );
}