// RoutesPage.jsx
import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { useRoutes } from "../hooks/useRoutes";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

const emptyForm = { country: "", state: "", city: "", zone: "", route: "" };

/* ─── tiny design tokens ──────────────────────────────────────────────────── */
const LEVEL_CONFIG = {
  country: { color: "bg-violet-100 text-violet-800 ring-violet-200",  dot: "bg-violet-400", indent: 0  },
  state:   { color: "bg-sky-100 text-sky-800 ring-sky-200",           dot: "bg-sky-400",    indent: 1  },
  city:    { color: "bg-emerald-100 text-emerald-800 ring-emerald-200", dot: "bg-emerald-400", indent: 2 },
  zone:    { color: "bg-amber-100 text-amber-800 ring-amber-200",      dot: "bg-amber-400",   indent: 3 },
  route:   { color: "bg-rose-50 text-rose-700 ring-rose-200",          dot: "bg-rose-400",    indent: 4 },
};

/* ─── primitives ──────────────────────────────────────────────────────────── */
function inputCls(extra = "") {
  return `w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-150 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 ${extra}`;
}
function Label({ children }) {
  return <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">{children}</label>;
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
function Badge({ level, children }) {
  const cfg = LEVEL_CONFIG[level];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${cfg.color}`}>
      {children}
    </span>
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

/* ─── empty state ─────────────────────────────────────────────────────────── */
function EmptyState({ title, subtitle }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-20 text-center">
      <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-white shadow-sm ring-1 ring-slate-100">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-400">
          <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
      </div>
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}
    </div>
  );
}

/* ─── tree node icons ─────────────────────────────────────────────────────── */
const ChevronIcon = ({ open }) => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
    className={`shrink-0 text-slate-400 transition-transform duration-200 ${open ? "rotate-90" : ""}`}>
    <path d="M9 18l6-6-6-6" />
  </svg>
);

const LEVEL_ICONS = {
  country: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
      <circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20" />
    </svg>
  ),
  state: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
      <polygon points="3 11 22 2 13 21 11 13 3 11" />
    </svg>
  ),
  city: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
      <path d="M3 21h18M9 21V9l7-6v18M9 9H3v12" />
    </svg>
  ),
  zone: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
      <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" />
    </svg>
  ),
  route: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
      <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
    </svg>
  ),
};

const INDENT_PX = 20; // px per level

/* ─── TreeNode ────────────────────────────────────────────────────────────── */
function TreeNode({ level, label, children, depth = 0, onEdit, onDelete, route }) {
  const [open, setOpen] = useState(depth < 2);
  const cfg = LEVEL_CONFIG[level];
  const hasChildren = children && children.length > 0;
  const isLeaf = level === "route";

  return (
    <div>
      <div
        className={`group flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors duration-100 cursor-pointer
          ${isLeaf ? "hover:bg-rose-50/60" : "hover:bg-slate-100/70"}`}
        style={{ paddingLeft: `${depth * INDENT_PX + 8}px` }}
        onClick={() => !isLeaf && setOpen((v) => !v)}
      >
        {/* connector lines via border-left – just a left margin visual */}
        {depth > 0 && (
          <div className="absolute" style={{ left: `${(depth - 1) * INDENT_PX + 16}px` }} />
        )}

        {/* chevron or spacer */}
        {!isLeaf ? (
          <span className="shrink-0 w-4 flex items-center justify-center">
            <ChevronIcon open={open} />
          </span>
        ) : (
          <span className="shrink-0 w-4" />
        )}

        {/* icon */}
        <span className={`${cfg.color.split(" ").filter(c => c.startsWith("text-"))[0]}`}>
          {LEVEL_ICONS[level]}
        </span>

        {/* label */}
        <span className={`flex-1 text-sm font-medium ${isLeaf ? "text-slate-600 font-normal" : "text-slate-800"} truncate`}>
          {label}
        </span>

        {/* badge */}
        {!isLeaf && hasChildren && (
          <span className="text-[10px] font-semibold text-slate-400 tabular-nums">
            {children.length}
          </span>
        )}

        {/* actions (leaf only) */}
        {isLeaf && (
          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-100" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => onEdit(route)}
              className="grid h-6 w-6 place-items-center rounded text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.12 2.12 0 113 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            <button onClick={() => onDelete(route.id)}
              className="grid h-6 w-6 place-items-center rounded text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0l-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6h16z" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* children */}
      {!isLeaf && hasChildren && (
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              {children}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

/* ─── stat card ───────────────────────────────────────────────────────────── */
function StatCard({ label, value, color }) {
  return (
    <div className={`rounded-xl border bg-white px-4 py-3 shadow-sm ${color}`}>
      <p className="text-2xl font-bold text-slate-900 tabular-nums">{value}</p>
      <p className="text-xs font-medium text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}

/* ─── main page ───────────────────────────────────────────────────────────── */
export default function RoutesPage() {
  const { token } = useAuth();
  const { routes, loading, refetch, countries, states, cities, zones, routeNames } = useRoutes();

  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editRoute, setEditRoute] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  /* search filter */
  const q = search.toLowerCase();
  const filteredRoutes = q
    ? routes.filter(r =>
        r.country?.toLowerCase().includes(q) ||
        r.state?.toLowerCase().includes(q) ||
        r.city?.toLowerCase().includes(q) ||
        r.zone?.toLowerCase().includes(q) ||
        r.route?.toLowerCase().includes(q)
      )
    : routes;

  /* derive filtered tree keys */
  const filteredCountries = [...new Set(filteredRoutes.map(r => r.country))].sort();

  function filteredStates(country) {
    return [...new Set(filteredRoutes.filter(r => r.country === country).map(r => r.state))].sort();
  }
  function filteredCities(country, state) {
    return [...new Set(filteredRoutes.filter(r => r.country === country && r.state === state).map(r => r.city))].sort();
  }
  function filteredZones(country, state, city) {
    return [...new Set(filteredRoutes.filter(r => r.country === country && r.state === state && r.city === city).map(r => r.zone))].sort();
  }
  function filteredRouteNames(country, state, city, zone) {
    return filteredRoutes.filter(r => r.country === country && r.state === state && r.city === city && r.zone === zone);
  }

  /* stats */
  const totalCountries = [...new Set(routes.map(r => r.country))].length;
  const totalCities    = [...new Set(routes.map(r => `${r.country}__${r.state}__${r.city}`))].length;
  const totalZones     = [...new Set(routes.map(r => `${r.country}__${r.state}__${r.city}__${r.zone}`))].length;

  function openAdd()    { setEditRoute(null); setForm(emptyForm); setFormError(""); setShowModal(true); }
  function openEdit(r)  { setEditRoute(r); setForm({ country: r.country, state: r.state, city: r.city, zone: r.zone, route: r.route }); setFormError(""); setShowModal(true); }

  async function handleSubmit(e) {
    e.preventDefault();
    const fields = ["country", "state", "city", "zone", "route"];
    if (fields.some(f => !form[f]?.trim())) { setFormError("All fields are required"); return; }
    setSaving(true); setFormError("");
    try {
      const url    = editRoute ? `${API}/api/routes/${editRoute.id}` : `${API}/api/routes`;
      const method = editRoute ? "PUT" : "POST";
      const res    = await fetch(url, { method, headers, body: JSON.stringify(form) });
      const data   = await res.json();
      if (!res.ok) throw new Error(data.message);
      setShowModal(false); refetch();
    } catch (err) { setFormError(err.message); }
    finally { setSaving(false); }
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this route?")) return;
    try {
      const res = await fetch(`${API}/api/routes/${id}`, { method: "DELETE", headers });
      if (!res.ok) throw new Error("Delete failed");
      refetch();
    } catch (err) { alert(err.message); }
  }

  const hasSearch = search.trim().length > 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">

        {/* ── Header ── */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Routes</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {routes.length} route{routes.length !== 1 ? "s" : ""} across {totalCountries} countr{totalCountries !== 1 ? "ies" : "y"}
            </p>
          </div>
          <PrimaryBtn onClick={openAdd}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            Add Route
          </PrimaryBtn>
        </div>

        {/* ── Stats row ── */}
        {!loading && routes.length > 0 && (
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Countries" value={totalCountries} color="border-violet-100" />
            <StatCard label="Cities"    value={totalCities}    color="border-emerald-100" />
            <StatCard label="Zones"     value={totalZones}     color="border-amber-100" />
            <StatCard label="Routes"    value={routes.length}  color="border-slate-100" />
          </div>
        )}

        {/* ── Search ── */}
        <div className="mb-4 flex gap-2">
          <div className="relative flex-1">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <path d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
            </svg>
            <input placeholder="Search country, state, city, zone, route…" value={search}
              onChange={(e) => setSearch(e.target.value)} className={inputCls("pl-9")} />
          </div>
          {hasSearch && (
            <button onClick={() => setSearch("")}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 transition-colors">
              Clear
            </button>
          )}
        </div>

        {/* ── Legend ── */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {(["country","state","city","zone","route"]).map(l => (
            <span key={l} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${LEVEL_CONFIG[l].color}`}>
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${LEVEL_CONFIG[l].dot}`} />
              {l.charAt(0).toUpperCase() + l.slice(1)}
            </span>
          ))}
        </div>

        {/* ── Tree ── */}
        {loading && (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-9 animate-pulse rounded-lg bg-slate-100" style={{ marginLeft: `${(i % 4) * 20}px` }} />
            ))}
          </div>
        )}

        {!loading && filteredRoutes.length === 0 && (
          <EmptyState
            title={hasSearch ? "No matches" : "No routes yet"}
            subtitle={hasSearch ? "Try a different search term" : "Click 'Add Route' to create your first route"}
          />
        )}

        {!loading && filteredRoutes.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="p-2">
              {filteredCountries.map((country) => (
                <TreeNode key={country} level="country" label={country} depth={0}
                  children={filteredStates(country).map(state => (
                    <TreeNode key={state} level="state" label={state} depth={1}
                      children={filteredCities(country, state).map(city => (
                        <TreeNode key={city} level="city" label={city} depth={2}
                          children={filteredZones(country, state, city).map(zone => (
                            <TreeNode key={zone} level="zone" label={zone} depth={3}
                              children={filteredRouteNames(country, state, city, zone).map(r => (
                                <TreeNode key={r.id} level="route" label={r.route} depth={4}
                                  route={r} onEdit={openEdit} onDelete={handleDelete}
                                />
                              ))}
                            />
                          ))}
                        />
                      ))}
                    />
                  ))}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Modal ── */}
      <AnimatePresence>
        {showModal && (
          <Backdrop onClick={() => setShowModal(false)}>
            <ModalShell>
              <div className="mb-5 flex items-center justify-between">
                <h3 className="text-lg font-semibold tracking-tight text-slate-900">
                  {editRoute ? "Edit Route" : "Add Route"}
                </h3>
                <button onClick={() => setShowModal(false)}
                  className="grid h-8 w-8 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3.5">
                {[
                  ["Country *", "country"],
                  ["State / Province *", "state"],
                  ["City *", "city"],
                  ["Zone *", "zone"],
                  ["Route Name *", "route"],
                ].map(([lbl, name]) => (
                  <div key={name}>
                    <Label>{lbl}</Label>
                    <input
                      value={form[name]}
                      onChange={(e) => setForm((p) => ({ ...p, [name]: e.target.value }))}
                      className={inputCls()}
                    />
                  </div>
                ))}

                {formError && (
                  <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 ring-1 ring-inset ring-rose-200">
                    {formError}
                  </p>
                )}

                <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-4">
                  <GhostBtn type="button" onClick={() => setShowModal(false)}>Cancel</GhostBtn>
                  <PrimaryBtn type="submit" disabled={saving}>
                    {saving ? "Saving…" : editRoute ? "Update" : "Add Route"}
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