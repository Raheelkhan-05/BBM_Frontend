// Dashboard.jsx — optimised version
//
// Changes vs original:
//  1. useDashboard now makes ONE fetch to /api/dashboard instead of 8
//  2. sessionStorage cache — revisiting the tab within 2 min is instant
//  3. rfq_followups come back flat from the server (no flatMap needed)
//  4. Everything else (charts, cards, skeletons) is unchanged

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend, CartesianGrid,
} from "recharts";
import { useAuth } from "../context/AuthContext";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

// How long (ms) the cached dashboard payload stays fresh.
// 2 minutes is fine — user can hard-refresh if they need live data.
const CACHE_TTL = 2 * 60 * 1000;
const CACHE_KEY = "dashboard_cache";

/* ─── Palette ─────────────────────────────────────────────────────────────── */
const C = {
  indigo:  "#6366f1",
  sky:     "#38bdf8",
  violet:  "#a78bfa",
  emerald: "#34d399",
  amber:   "#fbbf24",
  rose:    "#fb7185",
  teal:    "#2dd4bf",
};
const PIE_COLORS = ["#6366f1","#38bdf8","#34d399","#fbbf24","#a78bfa","#fb7185","#94a3b8"];


/* ─── Animation ───────────────────────────────────────────────────────────── */
const fadeUp = (delay = 0) => ({
  initial:    { opacity: 0, y: 10 },
  animate:    { opacity: 1, y: 0 },
  transition: { duration: 0.32, ease: [0.16, 1, 0.3, 1], delay },
});

/* ─── CountUp ─────────────────────────────────────────────────────────────── */
function CountUp({ target, duration = 900 }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const n = parseInt(String(target), 10);
    if (isNaN(n)) { setVal(target); return; }
    let start = null;
    const step = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      setVal(Math.round(n * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration]);
  return <>{val}</>;
}

/* ─── Tooltip ─────────────────────────────────────────────────────────────── */
function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-100 bg-white px-3 py-2 shadow-lg text-xs">
      {label && <p className="mb-1 font-semibold text-slate-600">{label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-400">{p.name}:</span>
          <span className="font-bold text-slate-800">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── Gradient defs ───────────────────────────────────────────────────────── */
function GradDefs() {
  const stops = [
    ["indigo","#6366f1"],["sky","#38bdf8"],["violet","#a78bfa"],
    ["emerald","#34d399"],["amber","#fbbf24"],["rose","#fb7185"],
    ["teal","#2dd4bf"],
  ];
  return (
    <defs>
      {stops.map(([id, color]) => (
        <linearGradient key={id} id={`area-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity={0.16} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      ))}
      {stops.map(([id, color]) => (
        <linearGradient key={`b${id}`} id={`bar-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity={0.85} />
          <stop offset="100%" stopColor={color} stopOpacity={0.5} />
        </linearGradient>
      ))}
    </defs>
  );
}

/* ─── Empty chart ─────────────────────────────────────────────────────────── */
function EmptyChart({ label = "No data yet" }) {
  return (
    <div className="flex h-44 flex-col items-center justify-center gap-2">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-slate-200">
        <path d="M3 3v18h18M8 17V13M12 17V9M16 17V5" strokeLinecap="round" />
      </svg>
      <span className="text-xs text-slate-300">{label}</span>
    </div>
  );
}

/* ─── Status badge ────────────────────────────────────────────────────────── */
function StatusBadge({ status }) {
  const map = {
    pending:"bg-amber-50 text-amber-700 ring-amber-200",
    approved:"bg-emerald-50 text-emerald-700 ring-emerald-200",
    rejected:"bg-rose-50 text-rose-700 ring-rose-200",
    sent:"bg-sky-50 text-sky-700 ring-sky-200",
    received:"bg-violet-50 text-violet-700 ring-violet-200",
    dispatched:"bg-indigo-50 text-indigo-700 ring-indigo-200",
    won:"bg-emerald-50 text-emerald-700 ring-emerald-200",
    lost:"bg-rose-50 text-rose-700 ring-rose-200",
  };
  const cls = map[(status||"").toLowerCase()] || "bg-slate-100 text-slate-500 ring-slate-200";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ring-1 ring-inset ${cls}`}>
      {status || "—"}
    </span>
  );
}

/* ─── Data helpers ────────────────────────────────────────────────────────── */
function countBy(arr = [], key) {
  return arr.reduce((acc, item) => { const k = item[key]||"Unknown"; acc[k]=(acc[k]||0)+1; return acc; }, {});
}
function toChart(obj) { return Object.entries(obj).map(([name, value]) => ({ name, value })); }
function last7Months() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setMonth(d.getMonth()-(6-i));
    return d.toLocaleString("default", { month: "short" });
  });
}
function byMonth(arr = [], key = "created_at") {
  const months = last7Months();
  const counts = Object.fromEntries(months.map(m => [m, 0]));
  arr.forEach(item => {
    if (!item[key]) return;
    const m = new Date(item[key]).toLocaleString("default", { month: "short" });
    if (m in counts) counts[m]++;
  });
  return months.map(m => ({ name: m, value: counts[m] }));
}
function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

/* ─── Data hook — single fetch with sessionStorage cache ─────────────────── */
function useDashboard(token, role) {
  const [data, setData]       = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token || !role) return;

    // 1. Try cache first — makes tab revisits feel instant
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (raw) {
        const { ts, payload, cachedRole } = JSON.parse(raw);
        if (cachedRole === role && Date.now() - ts < CACHE_TTL) {
          setData(payload);
          setLoading(false);
          return; // serve from cache; background refresh not needed for 2-min TTL
        }
      }
    } catch (_) { /* ignore parse errors */ }

    // 2. Single API call
    setLoading(true);
    fetch(`${API}/api/dashboard`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(json => {
        if (!json.success) throw new Error(json.message);
        const payload = { ...json };
        delete payload.success;

        // Normalise arrays (server returns undefined for roles that don't get a key)
        const defaults = {
          leads: [], rfqs: [], rfq_followups: [], products: [],
          routes: [], samples: [], quotations: [], users: [], prospects: [],
        };
        const merged = { ...defaults, ...payload };

        setData(merged);

        // Save to cache
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), payload: merged, cachedRole: role }));
        } catch (_) { /* storage quota, ignore */ }
      })
      .catch(err => {
        console.error("Dashboard fetch failed:", err);
      })
      .finally(() => setLoading(false));
  }, [token, role]);

  // Expose a manual refresh so the user can bust the cache if needed
  const refresh = useCallback(() => {
    try { sessionStorage.removeItem(CACHE_KEY); } catch (_) {}
    // Re-trigger the effect by… well, we can't without a state bump.
    // Easiest: reload. Or lift a refreshKey counter into the parent.
    window.location.reload();
  }, []);

  return { data, loading, refresh };
}

/* ═══════════════════════════════════════
   SKELETON COMPONENTS
═══════════════════════════════════════ */
function Sk({ w = "w-full", h = "h-4", rounded = "rounded-lg", extra = "" }) {
  return <div className={`animate-pulse bg-slate-100 ${w} ${h} ${rounded} ${extra}`} />;
}
function SkStatCard() {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-3">
        <Sk w="w-9" h="h-9" rounded="rounded-xl" />
        <div className="flex-1 space-y-2">
          <Sk w="w-20" h="h-3" />
          <Sk w="w-12" h="h-7" />
        </div>
      </div>
      <Sk w="w-32" h="h-3" />
    </div>
  );
}
function SkChartCard() {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <Sk w="w-40" h="h-4" extra="mb-1.5" />
      <Sk w="w-52" h="h-3" extra="mb-5" />
      <Sk w="w-full" h="h-48" rounded="rounded-xl" />
    </div>
  );
}
function SkActivityCard() {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-2">
          <Sk w="w-2" h="h-2" rounded="rounded-full" />
          <Sk w="w-28" h="h-4" />
        </div>
        <Sk w="w-12" h="h-3" />
      </div>
      <div className="px-5 py-2 space-y-0 divide-y divide-slate-50">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-2.5">
            <Sk w="w-8" h="h-8" rounded="rounded-full" extra="shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Sk w="w-36" h="h-3.5" />
              <Sk w="w-24" h="h-3" />
            </div>
            <Sk w="w-12" h="h-3" />
          </div>
        ))}
      </div>
    </div>
  );
}
function SkSectionHeading() {
  return (
    <div className="mb-5 space-y-1.5">
      <Sk w="w-44" h="h-5" />
      <Sk w="w-64" h="h-3" />
    </div>
  );
}
function LoadingSkeleton({ role }) {
  const all=role==="Admin", sp=role==="Salesperson";
  const statCount = all ? 8 : sp ? 6 : 4;
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-3 py-5 sm:px-6 sm:py-8 lg:px-8 space-y-8">
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm sm:p-8">
          <Sk w="w-28" h="h-3" extra="mb-2" />
          <Sk w="w-48 sm:w-64" h="h-8 sm:h-9" extra="mb-3" />
          <Sk w="w-72" h="h-4" extra="mb-4" />
          <div className="flex gap-2">
            <Sk w="w-16" h="h-6" rounded="rounded-full" />
            <Sk w="w-28" h="h-6" rounded="rounded-full" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 sm:gap-4">
          {Array.from({ length: statCount }).map((_, i) => <SkStatCard key={i} />)}
        </div>
        <div><SkSectionHeading /><div className="grid grid-cols-1 gap-4 lg:grid-cols-2"><SkChartCard /><SkChartCard /><SkChartCard /><SkChartCard /></div></div>
        <div><SkSectionHeading /><div className="grid grid-cols-1 gap-4 lg:grid-cols-2"><SkChartCard /><SkChartCard /></div></div>
        <div><SkSectionHeading /><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><SkActivityCard /><SkActivityCard /></div></div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   BOTTOM NAV
═══════════════════════════════════════════════════════════════ */
/* ─── Icons ──────────────────────────────────────────────────── */
const Ic = {
  Cal:    p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  Clock:  p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>,
  User:   p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  Phone:  p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>,
  Pin:    p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  Check:  p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><polyline points="20,6 9,17 4,12"/></svg>,
  X:      p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>,
  Trophy: p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0V4z"/><path d="M7 5H4a2 2 0 002 4M17 5h3a2 2 0 01-2 4"/></svg>,
  Flag:   p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M4 22V4a1 1 0 011-1c2 0 3 1 6 1s4-1 6-1a1 1 0 011 1v10c0 1-1 1-3 1s-4-1-6-1-4 1-6 1"/></svg>,
  ArrR:   p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>,
  Box:    p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>,
  Receipt:p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1z"/><path d="M9 7h6M9 11h6M9 15h4"/></svg>,
  Empty:  p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6v6H9z"/></svg>,
  Search: p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>,
  Layers: p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><polygon points="12,2 2,7 12,12 22,7 12,2"/><polyline points="2,17 12,22 22,17"/><polyline points="2,12 12,17 22,12"/></svg>,
  Home:   p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>,
  Bell:   p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg>,
  ChevD:  p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><polyline points="6,9 12,15 18,9"/></svg>,
  Refresh:p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><polyline points="23,4 23,10 17,10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>,
};
function clsn(...a){ return a.filter(Boolean).join(" "); }
function BottomNav(){
  const items=[
    {id:"pipeline",  label:"Pipeline",   I:Ic.Layers, to:"/prospects"},
    {id:"products",  label:"Products",   I:Ic.Box,    to:"/products"},
    {id:"dashboard", label:"Dashboard",  I:Ic.Home,   to:"/dashboard"},
  ];
  const pathname=typeof window!=="undefined"?window.location.pathname:"";
  return(
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex lg:hidden border-t border-slate-200 bg-white/95 backdrop-blur-md safe-area-inset-bottom">
      {items.map(item=>{
        const I=item.I;
        const active=pathname===item.to||(item.to!=="/"&&pathname.startsWith(item.to));
        return(
          <Link key={item.id} to={item.to}
            className={clsn("relative flex flex-1 flex-col items-center justify-center py-3 gap-0.5 transition-colors duration-200",
              active?"text-indigo-600":"text-slate-400 hover:text-slate-600")}>
            {active && (
              <span className="absolute top-0 left-1/4 right-1/4 h-0.5 rounded-full bg-indigo-600"/>
            )}
            <I className={clsn("h-5 w-5 transition-transform duration-200",active?"text-indigo-600 scale-110":"")}/>
            <span className={clsn("text-[10px] font-medium transition-colors duration-200",active?"text-indigo-600":"text-slate-400")}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/* ═══════════════════════════════════════
   STAT CARD
═══════════════════════════════════════ */
function StatCard({ label, value, sub, icon, iconBg, delay = 0, to, alert = false }) {
  const inner = (
    <motion.div {...fadeUp(delay)}
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
      className="relative rounded-2xl border border-slate-100 bg-white p-5 shadow-sm hover:shadow-md transition-shadow duration-200"
    >
      {alert && (
        <span className="absolute right-3 top-3 flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
        </span>
      )}
      <div className="mb-3 flex items-center gap-3">
        <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${iconBg}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium uppercase tracking-wider text-slate-400">{label}</p>
          <p className="text-2xl font-bold tabular-nums text-slate-900">
            {value != null
              ? (typeof value === "string" && value.endsWith("%")
                  ? <><CountUp target={parseInt(value)} />%</>
                  : <CountUp target={value} />)
              : <span className="text-slate-200 animate-pulse">—</span>}
          </p>
        </div>
      </div>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </motion.div>
  );
  return to ? <Link to={to} className="block">{inner}</Link> : inner;
}

/* ═══════════════════════════════════════
   CHART CARD
═══════════════════════════════════════ */
function ChartCard({ title, sub, children, delay = 0 }) {
  return (
    <motion.div {...fadeUp(delay)} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      {sub && <p className="mt-0.5 mb-4 text-xs text-slate-400">{sub}</p>}
      {!sub && <div className="mb-4" />}
      {children}
    </motion.div>
  );
}

/* ═══════════════════════════════════════
   SECTION HEADING
═══════════════════════════════════════ */
function SectionHeading({ children, sub }) {
  return (
    <div className="mb-5">
      <h2 className="text-base font-bold text-slate-900 sm:text-[17px]">{children}</h2>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

/* ═══════════════════════════════════════
   ACTIVITY ROW
═══════════════════════════════════════ */
function ActivityRow({ avatar, avatarBg, avatarText, name, sub, right, delay = 0 }) {
  return (
    <motion.div {...fadeUp(delay)}
      className="flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-lg hover:bg-slate-50/80 transition-colors duration-100"
    >
      <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[10px] font-bold ${avatarBg} ${avatarText}`}>
        {avatar}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-800">{name}</p>
        <p className="truncate text-xs text-slate-400">{sub}</p>
      </div>
      <div className="shrink-0">{right}</div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════
   MAIN DASHBOARD
═══════════════════════════════════════ */
export default function Dashboard() {
  const { user, token } = useAuth();
  const role = user?.role;
  const { data, loading, refresh } = useDashboard(token, role);

  const isAdmin = role === "Admin";
  const sp      = role === "Salesperson";
  const sc      = role === "SalesCoordinator";

  if (loading) return <LoadingSkeleton role={role} />;

  const {
    leads = [], rfqs = [], rfq_followups = [], products = [],
    routes = [], samples = [], quotations = [], users = [], prospects = [],
  } = data;

  const leadsByMonth   = byMonth(leads);
  const rfqsByMonth    = byMonth(rfqs);
  const leadsByCity    = toChart(countBy(leads,"city")).slice(0,8);
  const leadsByNature  = toChart(countBy(leads,"nature_of_business")).slice(0,6);
  const rfqsByCat      = toChart(countBy(rfqs,"product_category")).slice(0,6);
  const sampleStatus   = toChart(countBy(samples,"sample_status")).slice(0,6);
  const quoteStatus    = toChart(countBy(quotations,"quotation_status")).slice(0,6);
  const productsByCat  = toChart(countBy(products,"category")).slice(0,8);
  const usersByRole    = toChart(countBy(users,"role"));
  const routesByCity   = toChart(countBy(routes,"city")).slice(0,8);

  const prospectsByMonth    = byMonth(prospects);
  const prospectsByCity     = toChart(countBy(prospects,"city")).slice(0,8);
  const prospectsByIndustry = toChart(countBy(prospects,"industry")).slice(0,6);
  const prospectsBySource   = toChart(countBy(prospects,"source")).slice(0,6);

  const today = new Date().toISOString().slice(0,10);

  const dueProspects = prospects.filter(p => p.next_action_date && p.next_action_date <= today);

  const sort = (arr) => [...arr].sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
  const recentLeads     = sort(leads).slice(0,5);
  const recentRfqs      = sort(rfqs).slice(0,5);
  const recentSamples   = sort(samples).slice(0,5);
  const recentQuotes    = sort(quotations).slice(0,5);
  const recentProspects = sort(prospects).slice(0,5);

  const dueSamples = samples.filter(s => s.follow_up_date && s.follow_up_date <= today && s.sample_status !== "received");
  const dueQuotes  = quotations.filter(q => q.follow_up_date && q.follow_up_date <= today && !["won","lost"].includes(q.quotation_status));

  // Win rate from flat rfq_followups array (server sends these separately now)
  const latestFollowupByRfq = rfq_followups.reduce((acc, f) => {
    if (!f.rfq_id) return acc;
    if (!acc[f.rfq_id] || new Date(f.created_at) > new Date(acc[f.rfq_id].created_at)) {
      acc[f.rfq_id] = f;
    }
    return acc;
  }, {});
  const rfqsWithFollowup = rfqs.filter(r => latestFollowupByRfq[r.id]);
  const winRate = rfqs.length
    ? Math.round(
        rfqsWithFollowup.filter(r => latestFollowupByRfq[r.id]?.enquiry_status === "Won").length
        / rfqs.length * 100
      )
    : 0;

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-IN",{day:"numeric",month:"short"}) : "—";

  const Ico = ({ d }) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-3 py-5 sm:px-6 sm:py-8 lg:px-8 space-y-8 pb-20 lg:pb-8">

        {/* ── HEADER ── */}
        <motion.div {...fadeUp(0)} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">{greeting()}</p>
              <h1 className="mt-1 text-2xl font-extrabold capitalize tracking-tight text-slate-900 sm:text-3xl">
                {user?.email?.split("@")[0]}
              </h1>
              <p className="mt-1 max-w-md text-sm text-slate-400">
                {isAdmin ? "Full organization overview — leads, prospects, operations, team & catalog."
                 : sp ? "Your sales pipeline — leads, prospects in flight, RFQs, and territory coverage."
                 : "Operations overview — samples, quotations, and follow-ups due."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                {role}
              </span>
              <span className="rounded-full border border-slate-100 bg-slate-50 px-3 py-1.5 text-xs text-slate-400">
                {new Date().toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"long"})}
              </span>
              {/* Manual refresh button — busts the 2-min cache */}
              <button
                onClick={refresh}
                title="Refresh dashboard data"
                className="rounded-full border border-slate-100 bg-slate-50 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                ↻ Refresh
              </button>
            </div>
          </div>
        </motion.div>

        {/* ── STAT CARDS ── */}
        <section>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 sm:gap-4">
            {(isAdmin||sp) && (
              <StatCard delay={0.10} to="/prospects?type=prospect" label="Prospects" value={prospects.length}
                sub={dueProspects.length > 0 ? `${dueProspects.length} action overdue` : `${[...new Set(prospects.map(p=>p.industry).filter(Boolean))].length} industries`}
                iconBg="bg-teal-100" alert={dueProspects.length > 0}
                icon={<Ico d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />}
              />
            )}
            {(isAdmin||sp) && <StatCard delay={0.04} to="/prospects?type=lead" label="Total Leads" value={leads.length} sub={`${leads.filter(l=>l.city).length} with city data`} iconBg="bg-indigo-200" icon={<Ico d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />} />}
            {(isAdmin||sp) && <StatCard delay={0.08} to="/prospects" label="RFQs" value={rfqs.length} sub={`${rfqs.filter(r=>r.sample_required).length} need samples`} iconBg="bg-sky-200" icon={<Ico d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />} />}
            {(isAdmin||sc) && <StatCard delay={0.12} to="/prospects?type=sample" label="Samples" value={samples.length} sub={dueSamples.length>0?`${dueSamples.length} follow-up overdue`:"All on track"} iconBg="bg-emerald-200" alert={dueSamples.length>0} icon={<Ico d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />} />}
            {(isAdmin||sc) && <StatCard delay={0.16} to="/prospects?type=quotation" label="Quotations" value={quotations.length} sub={dueQuotes.length>0?`${dueQuotes.length} follow-up overdue`:"All on track"} iconBg="bg-violet-200" alert={dueQuotes.length>0} icon={<Ico d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />} />}
            <StatCard delay={0.20} to="/products" label="Products" value={products.length} sub={`${[...new Set(products.map(p=>p.category))].length} categories`} iconBg="bg-amber-200" icon={<Ico d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />} />
            {(isAdmin||sp) && <StatCard delay={0.24} to="/routes" label="Routes" value={routes.length} sub={`${[...new Set(routes.map(r=>r.city))].length} cities`} iconBg="bg-slate-200" icon={<Ico d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />} />}
            {(isAdmin||sp) && rfqs.length>0 && <StatCard delay={0.32} label="Win Rate" value={`${winRate}%`} sub={`${rfqs.length} RFQs in total`} iconBg="bg-emerald-200" icon={<Ico d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />} />}
          </div>
        </section>

        {/* ── LEAD INTELLIGENCE ── */}
        {(isAdmin||sp) && leads.length>0 && (
          <section>
            <SectionHeading sub="Trend and distribution of your lead pipeline">Lead Intelligence</SectionHeading>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <ChartCard title="Lead momentum" sub="New leads added each month" delay={0.06}>
                {leadsByMonth.some(d=>d.value>0) ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={leadsByMonth} margin={{top:4,right:4,left:-22,bottom:0}}>
                      <GradDefs />
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="name" tick={{fontSize:11,fill:"#94a3b8"}} axisLine={false} tickLine={false} />
                      <YAxis tick={{fontSize:11,fill:"#94a3b8"}} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip content={<ChartTip />} />
                      <Area type="monotone" dataKey="value" name="Leads" stroke={C.indigo} strokeWidth={2} fill="url(#area-indigo)" dot={{r:3,fill:C.indigo,strokeWidth:0}} activeDot={{r:5,strokeWidth:0}} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : <EmptyChart label="No leads this period" />}
              </ChartCard>

              <ChartCard title="Top cities" sub="Where your leads are coming from" delay={0.1}>
                {leadsByCity.length>0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={leadsByCity} layout="vertical" barSize={10} margin={{top:0,right:8,left:0,bottom:0}}>
                      <GradDefs />
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                      <XAxis type="number" tick={{fontSize:11,fill:"#94a3b8"}} axisLine={false} tickLine={false} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" tick={{fontSize:11,fill:"#64748b"}} axisLine={false} tickLine={false} width={70} />
                      <Tooltip content={<ChartTip />} cursor={{fill:"#f8fafc"}} />
                      <Bar dataKey="value" name="Leads" fill="url(#bar-sky)" radius={[0,5,5,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyChart label="No city data" />}
              </ChartCard>

              {leadsByNature.length>0 && (
                <ChartCard title="Business segments" sub="Lead breakdown by business type" delay={0.14}>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={leadsByNature} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={78} innerRadius={46} paddingAngle={3}>
                        {leadsByNature.map((_,i)=><Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip content={<ChartTip />} />
                      <Legend iconType="circle" iconSize={7} wrapperStyle={{fontSize:"11px"}} />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}

              {rfqs.length>0 && (
                <ChartCard title="RFQ activity" sub="Enquiries received per month" delay={0.18}>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={rfqsByMonth} margin={{top:4,right:4,left:-22,bottom:0}}>
                      <GradDefs />
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="name" tick={{fontSize:11,fill:"#94a3b8"}} axisLine={false} tickLine={false} />
                      <YAxis tick={{fontSize:11,fill:"#94a3b8"}} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip content={<ChartTip />} />
                      <Area type="monotone" dataKey="value" name="RFQs" stroke={C.violet} strokeWidth={2} fill="url(#area-violet)" dot={{r:3,fill:C.violet,strokeWidth:0}} activeDot={{r:5,strokeWidth:0}} />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}
            </div>
          </section>
        )}

        {/* ── PROSPECT INTELLIGENCE ── */}
        {(isAdmin||sp) && prospects.length > 0 && (
          <section>
            <SectionHeading sub="Pipeline of warm companies being nurtured toward a lead">
              Prospect Intelligence
            </SectionHeading>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <ChartCard title="Prospect momentum" sub="New prospects added each month" delay={0.06}>
                {prospectsByMonth.some(d=>d.value>0) ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={prospectsByMonth} margin={{top:4,right:4,left:-22,bottom:0}}>
                      <GradDefs />
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="name" tick={{fontSize:11,fill:"#94a3b8"}} axisLine={false} tickLine={false} />
                      <YAxis tick={{fontSize:11,fill:"#94a3b8"}} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip content={<ChartTip />} />
                      <Area type="monotone" dataKey="value" name="Prospects" stroke={C.teal} strokeWidth={2} fill="url(#area-teal)" dot={{r:3,fill:C.teal,strokeWidth:0}} activeDot={{r:5,strokeWidth:0}} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : <EmptyChart label="No prospects this period" />}
              </ChartCard>

              <ChartCard title="Prospects by city" sub="Geographic spread of your pipeline" delay={0.10}>
                {prospectsByCity.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={prospectsByCity} layout="vertical" barSize={10} margin={{top:0,right:8,left:0,bottom:0}}>
                      <GradDefs />
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                      <XAxis type="number" tick={{fontSize:11,fill:"#94a3b8"}} axisLine={false} tickLine={false} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" tick={{fontSize:11,fill:"#64748b"}} axisLine={false} tickLine={false} width={70} />
                      <Tooltip content={<ChartTip />} cursor={{fill:"#f8fafc"}} />
                      <Bar dataKey="value" name="Prospects" fill="url(#bar-teal)" radius={[0,5,5,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyChart label="No city data" />}
              </ChartCard>

              {prospectsByIndustry.length > 0 && (
                <ChartCard title="Industry mix" sub="Sectors your prospects belong to" delay={0.14}>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={prospectsByIndustry} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={78} innerRadius={46} paddingAngle={3}>
                        {prospectsByIndustry.map((_,i)=><Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip content={<ChartTip />} />
                      <Legend iconType="circle" iconSize={7} wrapperStyle={{fontSize:"11px"}} />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}

              {prospectsBySource.length > 0 && (
                <ChartCard title="Prospect sources" sub="How prospects are being discovered" delay={0.18}>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={prospectsBySource} barSize={26} margin={{top:0,right:4,left:-22,bottom:0}}>
                      <GradDefs />
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="name" tick={{fontSize:10,fill:"#94a3b8"}} axisLine={false} tickLine={false} />
                      <YAxis tick={{fontSize:11,fill:"#94a3b8"}} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip content={<ChartTip />} cursor={{fill:"#f8fafc"}} />
                      <Bar dataKey="value" name="Prospects" fill="url(#bar-emerald)" radius={[5,5,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}
            </div>
          </section>
        )}

        {/* ── OPERATIONS ── */}
        {(isAdmin||sc) && (samples.length>0||quotations.length>0) && (
          <section>
            <SectionHeading sub="Sample pipeline and quotation funnel">Operations</SectionHeading>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {samples.length>0 && (
                <ChartCard title="Sample pipeline" sub="Current status distribution" delay={0.08}>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={sampleStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={78} innerRadius={46} paddingAngle={3}>
                        {sampleStatus.map((_,i)=><Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip content={<ChartTip />} />
                      <Legend iconType="circle" iconSize={7} wrapperStyle={{fontSize:"11px"}} />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}
              {quotations.length>0 && (
                <ChartCard title="Quotation funnel" sub="Outcomes across all quotations" delay={0.12}>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={quoteStatus} barSize={26} margin={{top:0,right:4,left:-22,bottom:0}}>
                      <GradDefs />
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="name" tick={{fontSize:11,fill:"#94a3b8"}} axisLine={false} tickLine={false} />
                      <YAxis tick={{fontSize:11,fill:"#94a3b8"}} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip content={<ChartTip />} cursor={{fill:"#f8fafc"}} />
                      <Bar dataKey="value" name="Quotations" radius={[5,5,0,0]}>
                        {quoteStatus.map((e,i)=><Cell key={i} fill={e.name==="won"?C.emerald:e.name==="lost"?C.rose:PIE_COLORS[i%PIE_COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}
            </div>
          </section>
        )}

        {/* ── CATALOG ── */}
        {products.length>0 && (
          <section>
            <SectionHeading sub="Product spread and demand signals">Catalog & Demand</SectionHeading>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <ChartCard title="Products by category" sub="How your catalog is distributed" delay={0.06}>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={productsByCat} barSize={18} margin={{top:0,right:4,left:-22,bottom:0}}>
                    <GradDefs />
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="name" tick={{fontSize:10,fill:"#94a3b8"}} axisLine={false} tickLine={false} />
                    <YAxis tick={{fontSize:11,fill:"#94a3b8"}} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<ChartTip />} cursor={{fill:"#f8fafc"}} />
                    <Bar dataKey="value" name="Products" fill="url(#bar-violet)" radius={[5,5,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
              {(isAdmin||sp) && rfqsByCat.length>0 && (
                <ChartCard title="RFQs by product category" sub="Where demand is concentrated" delay={0.1}>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={rfqsByCat} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={78} innerRadius={46} paddingAngle={3}>
                        {rfqsByCat.map((_,i)=><Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip content={<ChartTip />} />
                      <Legend iconType="circle" iconSize={7} wrapperStyle={{fontSize:"11px"}} />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}
            </div>
          </section>
        )}

        {/* ── ORGANIZATION ── */}
        {isAdmin && (users.length>0||routes.length>0) && (
          <section>
            <SectionHeading sub="Team composition and territory coverage">Organization</SectionHeading>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {users.length>0 && (
                <ChartCard title="Team by role" sub="User distribution" delay={0.06}>
                  <ResponsiveContainer width="100%" height={190}>
                    <PieChart>
                      <Pie data={usersByRole} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={72} innerRadius={42} paddingAngle={3}>
                        {usersByRole.map((_,i)=><Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip content={<ChartTip />} />
                      <Legend iconType="circle" iconSize={7} wrapperStyle={{fontSize:"11px"}} />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}
              {routes.length>0 && (
                <ChartCard title="Routes by city" sub="Territory coverage" delay={0.1}>
                  <ResponsiveContainer width="100%" height={190}>
                    <BarChart data={routesByCity} barSize={14} margin={{top:0,right:4,left:-22,bottom:0}}>
                      <GradDefs />
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="name" tick={{fontSize:10,fill:"#94a3b8"}} axisLine={false} tickLine={false} />
                      <YAxis tick={{fontSize:11,fill:"#94a3b8"}} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip content={<ChartTip />} cursor={{fill:"#f8fafc"}} />
                      <Bar dataKey="value" name="Routes" fill="url(#bar-amber)" radius={[5,5,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}
            </div>
          </section>
        )}

        {/* ── RECENT ACTIVITY ── */}
        <section>
          <SectionHeading sub="Latest entries across all modules">Recent Activity</SectionHeading>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {(isAdmin||sp) && recentLeads.length>0 && (
              <motion.div {...fadeUp(0.06)} className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                  <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-indigo-400" /><p className="text-sm font-semibold text-slate-800">Recent Leads</p></div>
                  <Link to="/prospects?type=lead" className="text-xs font-medium text-indigo-400 hover:text-indigo-600">View all →</Link>
                </div>
                <div className="px-5 py-2">
                  {recentLeads.map((l,i)=><ActivityRow key={l.id} delay={0.04*i} avatar={(l.company_name||"?").slice(0,2).toUpperCase()} avatarBg="bg-indigo-50" avatarText="text-indigo-600" name={l.company_name||"—"} sub={`${l.city||"—"} · ${l.nature_of_business||"—"}`} right={<span className="text-[10px] text-slate-300">{fmtDate(l.created_at)}</span>} />)}
                </div>
              </motion.div>
            )}

            {(isAdmin||sp) && recentRfqs.length>0 && (
              <motion.div {...fadeUp(0.08)} className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                  <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-sky-400" /><p className="text-sm font-semibold text-slate-800">Recent RFQs</p></div>
                  <Link to="/prospects" className="text-xs font-medium text-indigo-400 hover:text-indigo-600">View all →</Link>
                </div>
                <div className="px-5 py-2">
                  {recentRfqs.map((r,i)=><ActivityRow key={r.id} delay={0.04*i} avatar={(r.company_name||r.product_name||"?").slice(0,2).toUpperCase()} avatarBg="bg-sky-50" avatarText="text-sky-600" name={r.company_name||"—"} sub={r.product_name||r.product_category||"—"} right={<span className="text-[10px] text-slate-300">{fmtDate(r.created_at)}</span>} />)}
                </div>
              </motion.div>
            )}

            {(isAdmin||sp) && recentProspects.length > 0 && (
              <motion.div {...fadeUp(0.10)} className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-teal-400" />
                    <p className="text-sm font-semibold text-slate-800">Recent Prospects</p>
                  </div>
                  <Link to="/prospects?type=prospect" className="text-xs font-medium text-indigo-400 hover:text-indigo-600">View all →</Link>
                </div>
                <div className="px-5 py-2">
                  {recentProspects.map((p,i) => (
                    <ActivityRow key={p.id} delay={0.04*i}
                      avatar={(p.company_name||"?").slice(0,2).toUpperCase()}
                      avatarBg="bg-teal-50" avatarText="text-teal-600"
                      name={p.company_name||"—"}
                      sub={`${p.city||"—"} · ${p.industry||"—"}`}
                      right={
                        p.next_action_date && p.next_action_date <= today
                          ? <span className="inline-flex items-center rounded-full bg-rose-50 px-1.5 py-0.5 text-[9px] font-semibold text-rose-500 ring-1 ring-inset ring-rose-200">Due</span>
                          : <span className="text-[10px] text-slate-300">{fmtDate(p.created_at)}</span>
                      }
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        </section>

        {/* ── FOLLOW-UP ALERTS ── */}
        {(isAdmin||sp||sc) && (dueSamples.length>0||dueQuotes.length>0||dueProspects.length>0) && (
          <section>
            <SectionHeading sub="Items that need your attention today">Action Required</SectionHeading>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(isAdmin||sp) && dueProspects.length > 0 && (
                <motion.div {...fadeUp(0.04)} className="rounded-2xl border border-teal-100 bg-teal-50/50 p-5">
                  <div className="mb-3 flex items-center gap-2.5">
                    <div className="grid h-8 w-8 place-items-center rounded-xl bg-teal-100 text-teal-600">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                    </div>
                    <p className="text-sm font-semibold text-teal-800">{dueProspects.length} prospect action{dueProspects.length > 1 ? "s" : ""} overdue</p>
                  </div>
                  <p className="mb-4 text-xs text-teal-700 leading-relaxed">These prospects have passed their next-action date and are waiting on follow-up.</p>
                  <Link to="/prospects?type=prospect" className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:underline">Review prospects →</Link>
                </motion.div>
              )}
              {(isAdmin||sc) && dueSamples.length>0 && (
                <motion.div {...fadeUp(0.06)} className="rounded-2xl border border-amber-100 bg-amber-50/50 p-5">
                  <div className="mb-3 flex items-center gap-2.5">
                    <div className="grid h-8 w-8 place-items-center rounded-xl bg-amber-100 text-amber-600">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                    </div>
                    <p className="text-sm font-semibold text-amber-800">{dueSamples.length} sample follow-up{dueSamples.length>1?"s":""} overdue</p>
                  </div>
                  <p className="mb-4 text-xs text-amber-700 leading-relaxed">These samples have passed their follow-up date and need attention.</p>
                  <Link to="/prospects?type=sample" className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:underline">Review samples →</Link>
                </motion.div>
              )}
              {(isAdmin||sc) && dueQuotes.length>0 && (
                <motion.div {...fadeUp(0.10)} className="rounded-2xl border border-rose-100 bg-rose-50/50 p-5">
                  <div className="mb-3 flex items-center gap-2.5">
                    <div className="grid h-8 w-8 place-items-center rounded-xl bg-rose-100 text-rose-500">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                    </div>
                    <p className="text-sm font-semibold text-rose-800">{dueQuotes.length} quotation follow-up{dueQuotes.length>1?"s":""} overdue</p>
                  </div>
                  <p className="mb-4 text-xs text-rose-700 leading-relaxed">These quotations have open statuses past their follow-up date.</p>
                  <Link to="/prospects?type=quotation" className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:underline">Review quotations →</Link>
                </motion.div>
              )}
            </div>
          </section>
        )}

      </div>
      {/* Bottom nav */}
      <BottomNav/>
    </div>
  );
}