import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, CartesianGrid,
} from "recharts";
import { useAuth } from "../context/AuthContext";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

// ─── Palette ──────────────────────────────────────────────────────────────────
const COLORS = {
  indigo: "#4f46e5",
  sky:    "#0ea5e9",
  violet: "#7c3aed",
  emerald:"#10b981",
  amber:  "#f59e0b",
  rose:   "#f43f5e",
  slate:  "#64748b",
};
const PIE_COLORS = [COLORS.indigo, COLORS.sky, COLORS.emerald, COLORS.amber, COLORS.violet, COLORS.rose];

// ─── Animation variants ───────────────────────────────────────────────────────
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.32, ease: [0.16, 1, 0.3, 1], delay },
});

// ─── Tiny reusable UI ─────────────────────────────────────────────────────────
function Card({ children, className = "", delay = 0 }) {
  return (
    <motion.div {...fadeUp(delay)}
      className={`rounded-2xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-900/[0.04] ${className}`}>
      {children}
    </motion.div>
  );
}

function SectionTitle({ children }) {
  return (
    <h2 className="mb-4 text-[13px] font-semibold uppercase tracking-widest text-slate-400">
      {children}
    </h2>
  );
}

function StatCard({ label, value, sub, icon, color = "indigo", delay = 0, to }) {
  const bg = {
    indigo: "bg-indigo-50 text-indigo-600",
    sky:    "bg-sky-50 text-sky-600",
    emerald:"bg-emerald-50 text-emerald-600",
    amber:  "bg-amber-50 text-amber-600",
    rose:   "bg-rose-50 text-rose-600",
    violet: "bg-violet-50 text-violet-600",
    slate:  "bg-slate-100 text-slate-500",
  };

  const inner = (
    <Card delay={delay} className="flex flex-col gap-3 p-5 hover:shadow-md transition-shadow duration-200">
      <div className={`grid h-9 w-9 place-items-center rounded-xl ${bg[color]}`}>
        {icon}
      </div>
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">{label}</p>
        <p className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900">
          {value ?? <span className="text-slate-300 animate-pulse">—</span>}
        </p>
        {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
      </div>
    </Card>
  );

  return to ? <Link to={to} className="block">{inner}</Link> : inner;
}

function EmptyChart({ label }) {
  return (
    <div className="flex h-48 flex-col items-center justify-center gap-2 text-slate-300">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 3v18h18M8 17V13M12 17V9M16 17V5" strokeLinecap="round" />
      </svg>
      <span className="text-xs">{label}</span>
    </div>
  );
}

function Loading() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-20 animate-pulse rounded-2xl border border-slate-100 bg-white" />
      ))}
    </div>
  );
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-lg text-xs">
      {label && <p className="mb-1 font-medium text-slate-600">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-semibold">
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────
const Icon = {
  leads:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  rfq:     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  sample:  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  quote:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  product: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  route:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  user:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  chart:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" strokeLinecap="round" strokeLinejoin="round"/></svg>,
};

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    pending:  "bg-amber-50 text-amber-700 ring-amber-600/15",
    approved: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
    rejected: "bg-rose-50 text-rose-700 ring-rose-600/15",
    sent:     "bg-sky-50 text-sky-700 ring-sky-600/15",
    received: "bg-violet-50 text-violet-700 ring-violet-600/15",
    dispatched:"bg-indigo-50 text-indigo-700 ring-indigo-600/15",
    won:      "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
    lost:     "bg-rose-50 text-rose-700 ring-rose-600/15",
  };
  const cls = map[(status || "").toLowerCase()] || "bg-slate-100 text-slate-500 ring-slate-300/30";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset capitalize ${cls}`}>
      {status || "—"}
    </span>
  );
}

// ─── Data fetching hook ───────────────────────────────────────────────────────
function useDashboard(token, role) {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);

  const fetchJSON = useCallback(async (path) => {
    const res = await fetch(`${API}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`${path} → ${res.status}`);
    return res.json();
  }, [token]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);

    const all = role === "Admin";
    const isSalesperson = role === "Salesperson";
    const isCoordinator = role === "SalesCoordinator";

    const tasks = [];

    // Leads — Admin + Salesperson
    if (all || isSalesperson) {
      tasks.push(fetchJSON("/api/leads").then(d => ({ leads: d.leads ?? d ?? [] })).catch(() => ({ leads: [] })));
    }
    // RFQs — Admin + Salesperson
    if (all || isSalesperson) {
      tasks.push(fetchJSON("/api/rfqs").then(d => ({ rfqs: d.rfqs ?? d ?? [] })).catch(() => ({ rfqs: [] })));
    }
    // Products — all
    tasks.push(fetchJSON("/api/products").then(d => ({ products: d.products ?? d ?? [] })).catch(() => ({ products: [] })));
    // Routes — Admin + Salesperson
    if (all || isSalesperson) {
      tasks.push(fetchJSON("/api/routes").then(d => ({ routes: d.routes ?? d ?? [] })).catch(() => ({ routes: [] })));
    }
    // Samples — Admin + SalesCoordinator
    if (all || isCoordinator) {
      tasks.push(fetchJSON("/api/samples").then(d => ({ samples: d.samples ?? d ?? [] })).catch(() => ({ samples: [] })));
    }
    // Quotations — Admin + SalesCoordinator
    if (all || isCoordinator) {
      tasks.push(fetchJSON("/api/quotations").then(d => ({ quotations: d.quotations ?? d ?? [] })).catch(() => ({ quotations: [] })));
    }
    // Users — Admin only
    if (all) {
      tasks.push(fetchJSON("/api/auth/users").then(d => ({ users: d.users ?? d ?? [] })).catch(() => ({ users: [] })));
    }

    Promise.all(tasks).then(results => {
      setData(Object.assign({}, ...results));
    }).finally(() => setLoading(false));
  }, [token, role, fetchJSON]);

  return { data, loading };
}

// ─── Chart helpers ────────────────────────────────────────────────────────────
function countBy(arr = [], key) {
  return arr.reduce((acc, item) => {
    const k = item[key] || "Unknown";
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
}
function toChartData(obj) {
  return Object.entries(obj).map(([name, value]) => ({ name, value }));
}
function last7Months() {
  const months = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    months.push(d.toLocaleString("default", { month: "short" }));
  }
  return months;
}
function groupByMonth(arr = [], dateKey = "created_at") {
  const months = last7Months();
  const counts = Object.fromEntries(months.map(m => [m, 0]));
  arr.forEach(item => {
    if (!item[dateKey]) return;
    const m = new Date(item[dateKey]).toLocaleString("default", { month: "short" });
    if (m in counts) counts[m]++;
  });
  return months.map(m => ({ name: m, value: counts[m] }));
}

// ─── Greeting ─────────────────────────────────────────────────────────────────
function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Dashboard
// ─────────────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user, token } = useAuth();
  const role = user?.role;
  const { data, loading } = useDashboard(token, role);

  const isAdmin       = role === "Admin";
  const isSalesperson = role === "Salesperson";
  const isCoordinator = role === "SalesCoordinator";

  const { leads = [], rfqs = [], products = [], routes = [], samples = [], quotations = [], users = [] } = data;

  // Derived chart data
  const leadsByCity    = toChartData(countBy(leads, "city")).slice(0, 8);
  const leadsByNature  = toChartData(countBy(leads, "nature_of_business")).slice(0, 6);
  const rfqsByCategory = toChartData(countBy(rfqs, "product_category")).slice(0, 6);
  const rfqsByMonth    = groupByMonth(rfqs);
  const leadsByMonth   = groupByMonth(leads);
  const sampleByStatus = toChartData(countBy(samples, "sample_status")).slice(0, 6);
  const quoteByStatus  = toChartData(countBy(quotations, "quotation_status")).slice(0, 6);
  const productsByCat  = toChartData(countBy(products, "category")).slice(0, 8);
  const usersByRole    = toChartData(countBy(users, "role"));
  const routesByCity   = toChartData(countBy(routes, "city")).slice(0, 8);

  // Recent items
  const recentLeads      = [...leads].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);
  const recentRfqs       = [...rfqs].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);
  const recentSamples    = [...samples].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);
  const recentQuotations = [...quotations].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);

  // Pending follow-ups
  const today = new Date().toISOString().slice(0, 10);
  const pendingSamples    = samples.filter(s => s.follow_up_date && s.follow_up_date <= today && s.sample_status !== "received");
  const pendingQuotations = quotations.filter(q => q.follow_up_date && q.follow_up_date <= today && q.quotation_status !== "won" && q.quotation_status !== "lost");

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-8 h-10 w-64 animate-pulse rounded-xl bg-slate-200" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-white border border-slate-100" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 space-y-8">

        {/* ── Header ── */}
        <motion.div {...fadeUp(0)} className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-indigo-500">{greeting()}</p>
            <h1 className="mt-0.5 text-2xl capitalize font-bold tracking-tight text-slate-900 sm:text-3xl">
              {user?.email?.split("@")[0]}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Here's what's happening across your{" "}
              <span className="font-medium text-slate-700">
                {role === "Admin" ? "entire BBM Organization" : role === "Salesperson" ? "sales pipeline" : "operations"}
              </span>{" "}today.
            </p>
          </div>
          <span className="inline-flex items-center rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-600/10">
            {role}
          </span>
        </motion.div>

        {/* ══════════════════════════════════════════════
            STAT CARDS — role-gated
        ══════════════════════════════════════════════ */}
        <section>
          <SectionTitle>Overview</SectionTitle>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 sm:gap-4">
            {/* Leads */}
            {(isAdmin || isSalesperson) && (
              <StatCard delay={0.04} to="/leads" label="Total Leads" value={leads.length} sub={`${leads.filter(l => l.city).length} with city data`} color="indigo" icon={Icon.leads} />
            )}
            {/* RFQs */}
            {(isAdmin || isSalesperson) && (
              <StatCard delay={0.08} to="/rfqs" label="RFQs Raised" value={rfqs.length} sub={`${rfqs.filter(r => r.sample_required).length} with samples`} color="sky" icon={Icon.rfq} />
            )}
            {/* Samples */}
            {(isAdmin || isCoordinator) && (
              <StatCard delay={0.12} to="/samples" label="Samples" value={samples.length} sub={`${pendingSamples.length} follow-up due`} color={pendingSamples.length > 0 ? "amber" : "emerald"} icon={Icon.sample} />
            )}
            {/* Quotations */}
            {(isAdmin || isCoordinator) && (
              <StatCard delay={0.16} to="/quotations" label="Quotations" value={quotations.length} sub={`${pendingQuotations.length} follow-up due`} color={pendingQuotations.length > 0 ? "rose" : "violet"} icon={Icon.quote} />
            )}
            {/* Products */}
            <StatCard delay={0.20} to="/products" label="Products" value={products.length} sub={`${[...new Set(products.map(p => p.category))].length} categories`} color="violet" icon={Icon.product} />
            {/* Routes — Admin + Salesperson */}
            {(isAdmin || isSalesperson) && (
              <StatCard delay={0.24} to="/routes" label="Routes" value={routes.length} sub={`${[...new Set(routes.map(r => r.city))].length} cities`} color="slate" icon={Icon.route} />
            )}
            {/* Users — Admin only */}
            {isAdmin && (
              <StatCard delay={0.28} to="/users" label="Users" value={users.length} sub={`${users.filter(u => u.role === "Salesperson").length} salespersons`} color="emerald" icon={Icon.user} />
            )}
            {/* Win rate — Admin + Coordinator */}
            {(isAdmin || isCoordinator) && quotations.length > 0 && (
              <StatCard delay={0.32} label="Win Rate" value={`${Math.round((quotations.filter(q => q.quotation_status === "won").length / quotations.length) * 100)}%`} sub="quotations won" color="emerald" icon={Icon.chart} />
            )}
          </div>
        </section>

        {/* ══════════════════════════════════════════════
            CHARTS SECTION
        ══════════════════════════════════════════════ */}

        {/* Admin / Salesperson charts */}
        {(isAdmin || isSalesperson) && leads.length > 0 && (
          <section>
            <SectionTitle>Lead Intelligence</SectionTitle>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* Leads by month */}
              <Card delay={0.1} className="p-5">
                <p className="mb-1 text-sm font-semibold text-slate-800">Leads over time</p>
                <p className="mb-4 text-xs text-slate-400">New leads added per month</p>
                {leadsByMonth.some(d => d.value > 0) ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={leadsByMonth} barSize={22}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f1f5f9" }} />
                      <Bar dataKey="value" name="Leads" fill={COLORS.indigo} radius={[5, 5, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyChart label="No leads this period" />}
              </Card>

              {/* Leads by city */}
              <Card delay={0.14} className="p-5">
                <p className="mb-1 text-sm font-semibold text-slate-800">Leads by city</p>
                <p className="mb-4 text-xs text-slate-400">Geographic distribution</p>
                {leadsByCity.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={leadsByCity} layout="vertical" barSize={14}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} width={80} />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f1f5f9" }} />
                      <Bar dataKey="value" name="Leads" fill={COLORS.sky} radius={[0, 5, 5, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyChart label="No city data" />}
              </Card>

              {/* Nature of business */}
              {leadsByNature.length > 0 && (
                <Card delay={0.18} className="p-5">
                  <p className="mb-1 text-sm font-semibold text-slate-800">Nature of business</p>
                  <p className="mb-4 text-xs text-slate-400">Lead segments by business type</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={leadsByNature} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={45} paddingAngle={3}>
                        {leadsByNature.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "11px" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </Card>
              )}

              {/* RFQs by month */}
              {rfqs.length > 0 && (
                <Card delay={0.22} className="p-5">
                  <p className="mb-1 text-sm font-semibold text-slate-800">RFQ activity</p>
                  <p className="mb-4 text-xs text-slate-400">Enquiries received per month</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={rfqsByMonth}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip content={<ChartTooltip />} />
                      <Line type="monotone" dataKey="value" name="RFQs" stroke={COLORS.violet} strokeWidth={2.5} dot={{ r: 4, fill: COLORS.violet, strokeWidth: 0 }} activeDot={{ r: 6, strokeWidth: 0 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>
              )}
            </div>
          </section>
        )}

        {/* Admin / SalesCoordinator charts */}
        {(isAdmin || isCoordinator) && (samples.length > 0 || quotations.length > 0) && (
          <section>
            <SectionTitle>Operations</SectionTitle>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* Sample status */}
              {samples.length > 0 && (
                <Card delay={0.1} className="p-5">
                  <p className="mb-1 text-sm font-semibold text-slate-800">Sample pipeline</p>
                  <p className="mb-4 text-xs text-slate-400">Samples by current status</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={sampleByStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={45} paddingAngle={3}>
                        {sampleByStatus.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "11px" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </Card>
              )}

              {/* Quotation status */}
              {quotations.length > 0 && (
                <Card delay={0.14} className="p-5">
                  <p className="mb-1 text-sm font-semibold text-slate-800">Quotation funnel</p>
                  <p className="mb-4 text-xs text-slate-400">Quotations by outcome</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={quoteByStatus} barSize={28}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f1f5f9" }} />
                      <Bar dataKey="value" name="Quotations" radius={[5, 5, 0, 0]}>
                        {quoteByStatus.map((entry, i) => (
                          <Cell key={i} fill={
                            entry.name === "won" ? COLORS.emerald :
                            entry.name === "lost" ? COLORS.rose :
                            PIE_COLORS[i % PIE_COLORS.length]
                          } />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              )}
            </div>
          </section>
        )}

        {/* Products chart — all roles */}
        {products.length > 0 && (
          <section>
            <SectionTitle>Catalog</SectionTitle>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card delay={0.1} className="p-5">
                <p className="mb-1 text-sm font-semibold text-slate-800">Products by category</p>
                <p className="mb-4 text-xs text-slate-400">Distribution across your catalog</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={productsByCat} barSize={22}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f1f5f9" }} />
                    <Bar dataKey="value" name="Products" fill={COLORS.violet} radius={[5, 5, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              {/* RFQs by category — Admin + Salesperson */}
              {(isAdmin || isSalesperson) && rfqsByCategory.length > 0 && (
                <Card delay={0.14} className="p-5">
                  <p className="mb-1 text-sm font-semibold text-slate-800">RFQs by product category</p>
                  <p className="mb-4 text-xs text-slate-400">Where demand is coming from</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={rfqsByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={45} paddingAngle={3}>
                        {rfqsByCategory.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "11px" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </Card>
              )}
            </div>
          </section>
        )}

        {/* Admin-only: users + routes */}
        {isAdmin && (users.length > 0 || routes.length > 0) && (
          <section>
            <SectionTitle>BBM Organization</SectionTitle>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {users.length > 0 && (
                <Card delay={0.1} className="p-5">
                  <p className="mb-1 text-sm font-semibold text-slate-800">Team by role</p>
                  <p className="mb-4 text-xs text-slate-400">Your user distribution</p>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={usersByRole} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={72} innerRadius={38} paddingAngle={3}>
                        {usersByRole.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "11px" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </Card>
              )}
              {routes.length > 0 && (
                <Card delay={0.14} className="p-5">
                  <p className="mb-1 text-sm font-semibold text-slate-800">Routes by city</p>
                  <p className="mb-4 text-xs text-slate-400">Coverage across territories</p>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={routesByCity} barSize={18}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f1f5f9" }} />
                      <Bar dataKey="value" name="Routes" fill={COLORS.amber} radius={[5, 5, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              )}
            </div>
          </section>
        )}

        {/* ══════════════════════════════════════════════
            RECENT ACTIVITY TABLES
        ══════════════════════════════════════════════ */}
        <section>
          <SectionTitle>Recent Activity</SectionTitle>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

            {/* Recent Leads */}
            {(isAdmin || isSalesperson) && recentLeads.length > 0 && (
              <Card delay={0.08} className="overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                  <p className="text-sm font-semibold text-slate-800">Recent leads</p>
                  <Link to="/leads" className="text-xs font-medium text-indigo-600 hover:underline">View all →</Link>
                </div>
                <div className="divide-y divide-slate-50">
                  {recentLeads.map((l, i) => (
                    <motion.div key={l.id} {...fadeUp(0.04 * i)} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/70 transition-colors">
                      <div className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full bg-indigo-50 text-[11px] font-bold text-indigo-700">
                        {(l.company_name || "?").slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-800">{l.company_name}</p>
                        <p className="text-xs text-slate-400">{l.city || "—"} · {l.nature_of_business || "—"}</p>
                      </div>
                      <span className="text-[10px] text-slate-300 flex-shrink-0">
                        {l.created_at ? new Date(l.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : ""}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </Card>
            )}

            {/* Recent RFQs */}
            {(isAdmin || isSalesperson) && recentRfqs.length > 0 && (
              <Card delay={0.1} className="overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                  <p className="text-sm font-semibold text-slate-800">Recent RFQs</p>
                  <Link to="/rfqs" className="text-xs font-medium text-indigo-600 hover:underline">View all →</Link>
                </div>
                <div className="divide-y divide-slate-50">
                  {recentRfqs.map((r, i) => (
                    <motion.div key={r.id} {...fadeUp(0.04 * i)} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/70 transition-colors">
                      <div className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full bg-sky-50 text-[11px] font-bold text-sky-700">
                        {(r.company_name || r.product_name || "?").slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-800">{r.company_name || "—"}</p>
                        <p className="truncate text-xs text-slate-400">{r.product_name || r.product_category || "—"}</p>
                      </div>
                      <span className="text-[10px] text-slate-300 flex-shrink-0">
                        {r.created_at ? new Date(r.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : ""}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </Card>
            )}

            {/* Recent Samples */}
            {(isAdmin || isCoordinator) && recentSamples.length > 0 && (
              <Card delay={0.12} className="overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                  <p className="text-sm font-semibold text-slate-800">Recent samples</p>
                  <Link to="/samples" className="text-xs font-medium text-indigo-600 hover:underline">View all →</Link>
                </div>
                <div className="divide-y divide-slate-50">
                  {recentSamples.map((s, i) => (
                    <motion.div key={s.id} {...fadeUp(0.04 * i)} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/70 transition-colors">
                      <div className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full bg-emerald-50 text-[11px] font-bold text-emerald-700">
                        SA
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-800">Sample #{s.id?.slice(0, 8)}</p>
                        <p className="text-xs text-slate-400">
                          Follow-up: {s.follow_up_date ? new Date(s.follow_up_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"}
                        </p>
                      </div>
                      <StatusBadge status={s.sample_status} />
                    </motion.div>
                  ))}
                </div>
              </Card>
            )}

            {/* Recent Quotations */}
            {(isAdmin || isCoordinator) && recentQuotations.length > 0 && (
              <Card delay={0.14} className="overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                  <p className="text-sm font-semibold text-slate-800">Recent quotations</p>
                  <Link to="/quotations" className="text-xs font-medium text-indigo-600 hover:underline">View all →</Link>
                </div>
                <div className="divide-y divide-slate-50">
                  {recentQuotations.map((q, i) => (
                    <motion.div key={q.id} {...fadeUp(0.04 * i)} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/70 transition-colors">
                      <div className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full bg-violet-50 text-[11px] font-bold text-violet-700">
                        QT
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-800">Quote #{q.id?.slice(0, 8)}</p>
                        <p className="text-xs text-slate-400">
                          Follow-up: {q.follow_up_date ? new Date(q.follow_up_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"}
                        </p>
                      </div>
                      <StatusBadge status={q.quotation_status} />
                    </motion.div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </section>

        {/* ══════════════════════════════════════════════
            FOLLOW-UP ALERTS — coordinator / admin
        ══════════════════════════════════════════════ */}
        {(isAdmin || isCoordinator) && (pendingSamples.length > 0 || pendingQuotations.length > 0) && (
          <section>
            <SectionTitle>Action Required</SectionTitle>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {pendingSamples.length > 0 && (
                <Card delay={0.06} className="border-amber-200 bg-amber-50/40 p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-amber-100 text-amber-600">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </span>
                    <p className="text-sm font-semibold text-amber-800">{pendingSamples.length} sample follow-up{pendingSamples.length > 1 ? "s" : ""} overdue</p>
                  </div>
                  <p className="text-xs text-amber-700">These samples have passed their follow-up date and need attention.</p>
                  <Link to="/samples" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:underline">
                    Review samples →
                  </Link>
                </Card>
              )}
              {pendingQuotations.length > 0 && (
                <Card delay={0.1} className="border-rose-200 bg-rose-50/40 p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-rose-100 text-rose-600">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </span>
                    <p className="text-sm font-semibold text-rose-800">{pendingQuotations.length} quotation follow-up{pendingQuotations.length > 1 ? "s" : ""} overdue</p>
                  </div>
                  <p className="text-xs text-rose-700">These quotations have open statuses past their follow-up date.</p>
                  <Link to="/quotations" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-rose-700 hover:underline">
                    Review quotations →
                  </Link>
                </Card>
              )}
            </div>
          </section>
        )}

      </div>
    </div>
  );
}