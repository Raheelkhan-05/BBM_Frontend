// pages/pos/PODues.jsx
import { useState, useEffect, useMemo, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "../../context/AuthContext";
import { Ic } from "../prospects/icons";
import { cls } from "../prospects/ui/primitives";
import BottomNav from "../prospects/BottomNav";
import POUploadModal from "./POUploadModal";
import AddPOModal from "./AddPOModal";
import PODetailPanel from "./PODetailPanel";
import { fmtDate, fmtMoney, poDueStatus, dialable, deliveryProgress, buildPoWaMessage } from "./utils";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

const VIEW_ALLOWED   = new Set(["info@bbmpvtltd.com", "communication@bbmpvtltd.com", "jay@bbmpvtltd.com", "account@bbmpvtltd.com"]);
const UPLOAD_ALLOWED = new Set(["communication@bbmpvtltd.com", "account@bbmpvtltd.com"]);
const ADD_ALLOWED    = new Set(["communication@bbmpvtltd.com", "account@bbmpvtltd.com"]);

const TONE_CLS = {
  rose:  "text-rose-600 bg-rose-50 ring-rose-200",
  amber: "text-amber-600 bg-amber-50 ring-amber-200",
  sky:   "text-sky-600 bg-sky-50 ring-sky-200",
  slate: "text-slate-500 bg-slate-100 ring-slate-200",
};

const STATUS_TABS = [
  { id: "pending",   label: "Pending" },
  { id: "completed", label: "Completed" },
];

function fmtCompact(n) {
  const num = Number(n) || 0;
  const abs = Math.abs(num);
  if (abs >= 1e7) return "₹" + (num / 1e7).toFixed(abs % 1e7 === 0 ? 0 : 1) + "Cr";
  if (abs >= 1e5) return "₹" + (num / 1e5).toFixed(abs % 1e5 === 0 ? 0 : 1) + "L";
  if (abs >= 1e3) return "₹" + (num / 1e3).toFixed(abs % 1e3 === 0 ? 0 : 1) + "K";
  return "₹" + num.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function TruckIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="6" width="15" height="12" rx="1" />
      <path d="M16 10h4l3 3v5h-7z" />
      <circle cx="6" cy="19" r="2" />
      <circle cx="17.5" cy="19" r="2" />
    </svg>
  );
}

function WaIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

export default function PODues() {
  const { user, token } = useAuth();
  const email = (user?.email || "").toLowerCase();
  const canView   = VIEW_ALLOWED.has(email);
  const canUpload = UPLOAD_ALLOWED.has(email);
  const canAdd    = ADD_ALLOWED.has(email);

  const [pos, setPos]           = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [search, setSearch]     = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [filter, setFilter]     = useState("pending");
  const [urgency, setUrgency]   = useState("all"); // all | overdue | today | upcoming

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo]     = useState("");
  const [dateFilterOpen, setDateFilterOpen] = useState(false);

  const [showUpload, setShowUpload] = useState(false);
  const [showAdd, setShowAdd]       = useState(false);
  const [fabOpen, setFabOpen]       = useState(false);
  const [selected, setSelected]     = useState(null);

  const fetchPOs = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const r = await fetch(`${API}/api/pos`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (!d.success) throw new Error(d.message || "Failed to load");
      setPos(d.pos || []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { if (canView) fetchPOs(); }, [canView, fetchPOs]);

  function changeFilter(id) { setFilter(id); setUrgency("all"); }

  // Pending + Partial both count as "still open" — cancelled is excluded everywhere.
  const openPOs = useMemo(() => pos.filter(p => (p.status === "pending" || p.status === "partial")), [pos]);

  const pendingCount   = pos.filter(p => p.status === "pending").length;
  const partialCount   = pos.filter(p => p.status === "partial").length;
  const completedCount = pos.filter(p => p.status === "completed").length;

  const overdueCount      = openPOs.filter(p => p.tracking_active && poDueStatus(p.expected_delivery_date).state === "overdue").length;
  const dueTodayCount     = openPOs.filter(p => p.tracking_active && poDueStatus(p.expected_delivery_date).state === "today").length;
  const notYetActiveCount = openPOs.filter(p => !p.tracking_active).length;

  const dateRangeOpenPOs = useMemo(() => {
    if (!dateFrom && !dateTo) return [];
    const from = dateFrom ? new Date(dateFrom) : null;
    const to   = dateTo ? new Date(dateTo) : null;
    if (to) to.setHours(23, 59, 59, 999);
    return openPOs.filter(p => {
      const d = new Date(p.next_followup_date || p.expected_delivery_date || p.order_date);
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }, [openPOs, dateFrom, dateTo]);

  const dateRangeActiveCount = dateRangeOpenPOs.length;
  const dateRangeActiveValue = dateRangeOpenPOs.reduce((s, p) => s + (Number(p.total_amount || 0) - Number(p.delivered_amount || 0)), 0);

  const openValue = openPOs.reduce((s, p) => s + (Number(p.total_amount || 0) - Number(p.delivered_amount || 0)), 0);
  const overdueValue = openPOs
    .filter(p => p.tracking_active && poDueStatus(p.expected_delivery_date).state === "overdue")
    .reduce((s, p) => s + (Number(p.total_amount || 0) - Number(p.delivered_amount || 0)), 0);

  const countFor = { pending: pendingCount+partialCount, completed: completedCount };

  const URGENCY_CHIPS = [
    { id: "all",      label: "All",         count: pendingCount + partialCount },
    { id: "overdue",  label: "Overdue",     count: overdueCount,      tone: "rose"  },
    { id: "today",    label: "Due today",   count: dueTodayCount,     tone: "amber" },
    { id: "upcoming", label: "Not due yet", count: notYetActiveCount, tone: "slate" },
  ];

  const filtered = useMemo(() => {
    let list = filter === "pending"
      ? pos.filter(p => p.status === "pending" || p.status === "partial")
      : pos.filter(p => p.status === filter);


    if (filter === "pending" && urgency !== "all") {
      list = list.filter(p => {
        const st = poDueStatus(p.expected_delivery_date).state;
        if (urgency === "overdue")  return p.tracking_active && st === "overdue";
        if (urgency === "today")    return p.tracking_active && st === "today";
        if (urgency === "upcoming") return !p.tracking_active;
        return true;
      });
    }

    if (filter === "pending" && (dateFrom || dateTo)) {
      const from = dateFrom ? new Date(dateFrom) : null;
      const to   = dateTo ? new Date(dateTo) : null;
      if (to) to.setHours(23, 59, 59, 999);
      list = list.filter(p => {
        const d = new Date(p.next_followup_date || p.expected_delivery_date || p.order_date);
        if (from && d < from) return false;
        if (to && d > to) return false;
        return true;
      });
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.party_name?.toLowerCase().includes(q) ||
        String(p.order_no)?.toLowerCase().includes(q) ||
        p.mobile_1?.includes(q) || p.mobile_2?.includes(q) ||
        (p.items || []).some(it => it.product_name?.toLowerCase().includes(q))
      );
    }

    return [...list].sort((a, b) => {
      const da = poDueStatus(a.expected_delivery_date), db = poDueStatus(b.expected_delivery_date);
      const va = da.state === "upcoming" ? -da.days : da.days;
      const vb = db.state === "upcoming" ? -db.days : db.days;
      return vb - va;
    });
  }, [pos, filter, urgency, search, dateFrom, dateTo]);

  function onUpdated(updated) {
    setPos(p => p.map(x => x.id === updated.id ? updated : x));
    setSelected(prev => (prev && prev.id === updated.id ? updated : prev));
  }
  function onAdded(po) { setPos(p => [po, ...p]); }

  if (!canView) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <div className="text-center">
          <Ic.Lock className="mx-auto h-10 w-10 text-slate-300 mb-3" />
          <p className="text-[13px] font-semibold text-slate-600">You don't have access to this page</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 lg:bg-gradient-to-br lg:from-slate-50 lg:via-white lg:to-indigo-50/30">
      <div className="pb-24 lg:pb-8">
        <div className="mx-auto max-w-3xl px-0 lg:px-6 lg:py-7">

          {/* Header */}
          <div className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-100 lg:static lg:rounded-2xl lg:border lg:shadow-none lg:bg-white lg:backdrop-blur-none">

            {!searchOpen ? (
              <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-2 lg:px-5 lg:pt-5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h1 className="text-[17px] font-extrabold tracking-tight text-slate-900 lg:text-xl">PO Tracking</h1>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {openValue > 0 && (
                      <span className="shrink-0 rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-extrabold text-indigo-600 ring-1 ring-inset ring-indigo-200">
                        {fmtMoney(openValue)} in open orders
                      </span>
                    )}
                    {overdueValue > 0 && (
                      <span className="shrink-0 rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-extrabold text-rose-600 ring-1 ring-inset ring-rose-200">
                        {fmtMoney(overdueValue)} overdue
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-[10.5px] text-slate-400">
                    {pendingCount + partialCount} open
                    {overdueCount > 0 && <> · <span className="font-bold text-rose-600 animate-pulse">{overdueCount} overdue</span></>}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button onClick={() => setSearchOpen(true)} aria-label="Search"
                    className="grid h-10 w-10 place-items-center rounded-full text-slate-500 hover:bg-slate-100 active:scale-90 transition-transform">
                    <Ic.Search className="h-[18px] w-[18px]" />
                  </button>

                  {(canUpload || canAdd) && (
                    <div className="hidden lg:flex items-center gap-2 pl-1">
                      {canAdd && (
                        <button onClick={() => setShowAdd(true)}
                          className="flex items-center gap-1.5 rounded-full border border-indigo-200 bg-white px-3 py-2 text-[11px] font-semibold text-indigo-600 shadow-sm hover:bg-indigo-50">
                          <Ic.Plus className="h-4 w-4" /> Add
                        </button>
                      )}
                      {canUpload && (
                        <button onClick={() => setShowUpload(true)}
                          className="flex items-center gap-1.5 rounded-full bg-indigo-600 px-3 py-2 text-[11px] font-semibold text-white shadow-sm hover:bg-indigo-700">
                          <Ic.Box className="h-4 w-4" /> Upload
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2.5 px-4 py-3">
                <Ic.Search className="h-4 w-4 shrink-0 text-slate-400" />
                <input
                  autoFocus
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search vendor, order no, product, mobile…"
                  className="min-w-0 flex-1 bg-transparent text-[16px] text-slate-800 outline-none placeholder:text-slate-400"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="shrink-0 text-slate-400" aria-label="Clear">
                    <Ic.Trash className="h-4 w-4" />
                  </button>
                )}
                <button onClick={() => { setSearchOpen(false); setSearch(""); }}
                  className="shrink-0 text-[12px] font-semibold text-indigo-600 active:opacity-60">
                  Cancel
                </button>
              </div>
            )}

            {/* Status tabs */}
            <div className="px-4 pb-2 lg:px-5">
                <div className="flex gap-1.5">
                    {STATUS_TABS.map((t) => (
                    <button
                        key={t.id}
                        onClick={() => changeFilter(t.id)}
                        className={cls(
                        "relative flex-1 flex items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-[11.5px] font-bold transition-all active:scale-[0.97]",
                        filter === t.id
                            ? t.id === "pending"
                            ? "bg-rose-500 text-white shadow-sm"
                            : t.id === "partial"
                            ? "bg-sky-500 text-white shadow-sm"
                            : "bg-emerald-500 text-white shadow-sm"
                            : "bg-slate-100 text-slate-500"
                        )}
                    >
                        {t.label}

                        {countFor[t.id] > 0 && (
                        <span
                            className={cls(
                            "grid h-4.5 min-w-[18px] place-items-center rounded-full px-1 text-[9px] font-extrabold leading-none",
                            filter === t.id
                                ? "bg-white/25 text-white"
                                : "bg-white text-slate-500"
                            )}
                        >
                            {countFor[t.id]}
                        </span>
                        )}
                    </button>
                    ))}
                </div>
                </div>

            {/* Urgency chips — meaningful within Pending/Partial */}
            {(filter === "pending" || filter === "partial") && (
            <>
              <div className="scrollbar-none flex gap-1.5 overflow-x-auto px-4 pb-2 lg:px-5">
                {URGENCY_CHIPS.map(c => (
                  <button key={c.id} onClick={() => setUrgency(c.id)}
                    className={cls(
                      "shrink-0 rounded-full border px-3 py-1.5 text-[10.5px] font-semibold transition-colors active:scale-95",
                      urgency === c.id
                        ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                        : "border-slate-200 bg-white text-slate-500"
                    )}>
                    {c.label}{c.count > 0 ? ` (${c.count})` : ""}
                  </button>
                ))}
                <button
                  onClick={() => setDateFilterOpen(v => !v)}
                  className={cls(
                    "shrink-0 flex items-center gap-1 rounded-full border px-3 py-1.5 text-[10.5px] font-semibold transition-colors active:scale-95",
                    dateFilterOpen || dateFrom || dateTo
                      ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                      : "border-slate-200 bg-white text-slate-500"
                  )}>
                  <Ic.Cal className="h-3 w-3" />
                  Date range
                  {(dateFrom || dateTo) ? ` (${dateRangeActiveCount})` : ""}
                </button>
              </div>

              <AnimatePresence initial={false}>
                {dateFilterOpen && (
                  <motion.div
                    key="date-filter"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-3 lg:px-5">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="flex gap-2.5 flex-row items-end sm:gap-2">
                          <div className="flex min-w-0 flex-1 flex-col gap-1">
                            <label className="text-[9.5px] font-semibold uppercase tracking-wide text-slate-400">From</label>
                            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[13px] text-slate-700 outline-none transition-colors focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100" />
                          </div>
                          <div className="flex min-w-0 flex-1 flex-col gap-1">
                            <label className="text-[9.5px] font-semibold uppercase tracking-wide text-slate-400">To</label>
                            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[13px] text-slate-700 outline-none transition-colors focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100" />
                          </div>
                          <AnimatePresence>
                            {(dateFrom || dateTo) && (
                              <motion.button
                                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                                transition={{ duration: 0.15 }}
                                onClick={() => { setDateFrom(""); setDateTo(""); }}
                                className="shrink-0 self-start rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-500 active:scale-95 transition-transform sm:self-auto mt-5 sm:mt-0">
                                Clear
                              </motion.button>
                            )}
                          </AnimatePresence>
                        </div>

                        <AnimatePresence>
                          {(dateFrom || dateTo) && (
                            <motion.div
                              initial={{ opacity: 0, y: -6, height: 0, marginTop: 0 }}
                              animate={{ opacity: 1, y: 0, height: "auto", marginTop: 10 }}
                              exit={{ opacity: 0, y: -6, height: 0, marginTop: 0 }}
                              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                              className="overflow-hidden">
                              <div className="flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-[11px] font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-200">
                                <Ic.Radar className="h-3.5 w-3.5 shrink-0" />
                                <span className="min-w-0 flex-1 leading-snug">
                                  {dateRangeActiveCount} PO{dateRangeActiveCount === 1 ? "" : "s"} active for tracking
                                  {!dateFrom && dateTo ? " (up to this date)" : !dateTo && dateFrom ? " (from this date onward)" : ""}
                                  {dateRangeActiveValue > 0 && <> · {fmtMoney(dateRangeActiveValue)} pending value</>}
                                </span>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
            )}
            {filter === "completed" && <div className="pb-1" />}
          </div>

          {/* List */}
          <div className="bg-white lg:mt-4 lg:rounded-2xl lg:border lg:border-slate-200 lg:shadow-sm overflow-hidden">
            {loading ? (
              <div className="divide-y divide-slate-100">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3.5 animate-pulse">
                    <div className="h-11 w-11 rounded-full bg-slate-100 shrink-0" />
                    <div className="flex-1"><div className="h-3.5 w-1/2 rounded-full bg-slate-100 mb-2" /><div className="h-3 w-1/3 rounded-full bg-slate-100" /></div>
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="p-5 m-4 rounded-2xl border border-rose-100 bg-rose-50 text-[13px] text-rose-700">{error}</div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                <Ic.Radar className="h-12 w-12 text-slate-200 mb-4" />
                <p className="text-[13px] font-semibold text-slate-600">
                  {search ? "No matches" : `No ${filter} POs`}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  {search ? "Try a different vendor, order no, product, or mobile number"
                    : filter === "pending" ? "All caught up!"
                    : filter === "partial" ? "No partially-delivered orders"
                    : "Nothing marked completed yet"}
                </p>
              </div>
            ) : (
              <div>
                {filtered.map(po => {
                    const status = poDueStatus(po.expected_delivery_date);
                    // const isPartial = po.status === "partial";
                    const isNotYetActive = (po.status === "pending" || po.status === "partial") && !po.tracking_active;
                    const isUrgent = (po.status === "pending" || po.status === "partial") && po.tracking_active && (status.state === "overdue" || status.state === "today");
                    const displayDate = po.next_followup_date || po.expected_delivery_date;
                    const progress = deliveryProgress(po);
                    const pendingValue = Number(po.total_amount || 0) - Number(po.delivered_amount || 0);

                    const badgeLabel = po.status === "completed"
                      ? "Delivered"
                      : po.status === "cancelled"
                      ? "Cancelled"
                      : isNotYetActive
                      ? `${fmtDate(po.expected_delivery_date)} · In lead time`
                      : `${fmtDate(displayDate)} · ${status.label}`;

                    return (
                        <div key={po.id}
                        className={cls(
                            "border-b border-slate-100 px-4 py-3 last:border-0 transition-colors active:bg-slate-50",
                            isUrgent && status.state === "overdue" ? "bg-rose-50/40" : isUrgent ? "bg-amber-50/40" : ""
                        )}>
                        <div className="flex items-start gap-3">
                          <div className="relative shrink-0">
                            <button onClick={() => setSelected(po)}
                              className={cls(
                                "flex h-11 w-11 items-center justify-center rounded-full text-white text-[10px] font-bold shadow-sm",
                                po.status === "completed" ? "bg-gradient-to-br from-emerald-400 to-teal-500"
                                : po.status === "cancelled" ? "bg-gradient-to-br from-slate-400 to-slate-500"
                                : isNotYetActive ? "bg-gradient-to-br from-slate-300 to-slate-400"
                                : status.state === "overdue" ? "bg-gradient-to-br from-rose-500 to-orange-500"
                                : status.state === "today" ? "bg-gradient-to-br from-amber-400 to-orange-400"
                                : "bg-gradient-to-br from-slate-400 to-slate-500"
                                )}>
                              {po.party_name.slice(0, 2).toUpperCase()}
                            </button>
                            {isUrgent && (
                                <span className={cls("absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white",
                                status.state === "overdue" ? "bg-rose-500 animate-pulse" : "bg-amber-400")} />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <button onClick={() => setSelected(po)} className="flex w-full min-w-0 items-start justify-between gap-2 text-left">
                              <span className="min-w-0 flex flex-wrap items-center gap-1.5">
                                <span className="break-words text-[13px] font-bold text-slate-900 leading-snug">{po.party_name}</span>
                                {po.lead_days != null && (
                                  <span className="shrink-0 whitespace-nowrap rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500 ring-1 ring-inset ring-slate-200 leading-none">
                                    {po.lead_days}d lead
                                  </span>
                                )}
                              </span>
                              <span className="shrink-0 whitespace-nowrap text-[12.5px] font-extrabold text-slate-800 leading-tight">
                                {fmtMoney(pendingValue)}
                              </span>
                            </button>

                            <div className="mt-1 flex items-center justify-between gap-2">
                              <button onClick={() => setSelected(po)} className="min-w-0 flex-1 text-left">
                                <span className="text-[10.5px] text-slate-400">
                                  #{po.order_no} • {fmtDate(po.order_date)} • {(po.items || []).length} item{(po.items || []).length === 1 ? "" : "s"}
                                </span>
                              </button>

                              <div className="flex shrink-0 items-center gap-1.5">
                                <span className={cls("whitespace-nowrap rounded-full px-1.5 py-0.5 text-[9px] font-bold ring-1 ring-inset leading-none",
                                        po.status === "completed" ? "bg-emerald-50 text-emerald-600 ring-emerald-200"
                                        : po.status === "cancelled" ? "bg-slate-100 text-slate-500 ring-slate-200"
                                        : isNotYetActive ? "bg-slate-100 text-slate-500 ring-slate-200"
                                        : TONE_CLS[status.tone]
                                    )}>
                                    {badgeLabel}
                                </span>

                                {po.mobile_1 && (
                                  <>
                                    <a href={`tel:${po.mobile_1}`} title={`Call ${po.mobile_1}`}
                                      className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-emerald-600 hover:bg-emerald-50 active:scale-90 transition-transform">
                                      <Ic.Phone className="h-3.5 w-3.5" />
                                    </a>
                                    <a href={`https://wa.me/${dialable(po.mobile_1)}?text=${encodeURIComponent(buildPoWaMessage(po))}`} target="_blank" rel="noopener noreferrer" title={`WhatsApp ${po.mobile_1}`}
                                      className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-green-600 hover:bg-green-50 active:scale-90 transition-transform">
                                      <WaIcon className="h-3.5 w-3.5" />
                                    </a>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Delivery progress bar — quick visual for partial orders */}
                            {(po.status === "pending" || po.status === "partial") && (
                                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gradient-to-r from-red-500 via-amber-400 to-emerald-500 relative">
                                    <div
                                        className="absolute right-0 top-0 h-full bg-slate-100 transition-all duration-500"
                                        style={{
                                        width: `${100 - progress * 100}%`,
                                        }}
                                    />
                                </div>
                            )}

                            {po.next_followup_date && (
                              <button onClick={() => setSelected(po)} className="mt-0.5 block text-left text-[10.5px] font-medium text-indigo-600">
                                Next Follow-up: {fmtDate(po.next_followup_date)}
                              </button>
                            )}

                            {po.last_reason && (
                              <button onClick={() => setSelected(po)} className="mt-1 block w-full text-left text-[10.5px] font-medium leading-relaxed text-slate-700 break-words whitespace-pre-wrap">
                                <span className="text-[10.5px] text-slate-400">Reason: </span>{po.last_reason}
                              </button>
                            )}

                            {po.last_remark && (
                              <button onClick={() => setSelected(po)} className="mt-0.5 block w-full text-left text-[10.5px] leading-relaxed text-slate-500 break-words whitespace-pre-wrap">
                                <span className="text-[10.5px] text-slate-400 font-medium">Remark: </span>{po.last_remark}
                              </button>
                            )}
                          </div>
                        </div>
                        </div>
                    );
                    })}
              </div>
            )}
          </div>
        </div>
      </div>

      <BottomNav />

      {(canAdd || canUpload) && (
        <div className="fixed right-4 z-30 flex flex-col items-end gap-2.5 lg:hidden"
          style={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom))" }}>
          <AnimatePresence>
            {fabOpen && canAdd && canUpload && (
              <motion.div initial={{ opacity: 0, y: 12, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.9 }}
                transition={{ duration: 0.15 }} className="flex flex-col items-end gap-2.5">
                <button onClick={() => { setShowUpload(true); setFabOpen(false); }}
                  className="flex items-center gap-2.5 rounded-full bg-white py-1.5 pl-4 pr-1.5 shadow-lg ring-1 ring-slate-200 active:scale-95 transition-transform">
                  <span className="text-[12px] font-semibold text-slate-700">Upload Excel</span>
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-600"><Ic.Box className="h-4 w-4" /></span>
                </button>
                <button onClick={() => { setShowAdd(true); setFabOpen(false); }}
                  className="flex items-center gap-2.5 rounded-full bg-white py-1.5 pl-4 pr-1.5 shadow-lg ring-1 ring-slate-200 active:scale-95 transition-transform">
                  <span className="text-[12px] font-semibold text-slate-700">Add PO</span>
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-indigo-50 text-indigo-600"><Ic.Plus className="h-4 w-4" /></span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
          <button
            onClick={() => { if (canAdd && canUpload) setFabOpen(v => !v); else if (canAdd) setShowAdd(true); else setShowUpload(true); }}
            aria-label="Add or upload POs"
            className={cls("grid h-14 w-14 place-items-center rounded-full bg-indigo-600 text-white shadow-xl shadow-indigo-600/30 transition-transform active:scale-90", fabOpen && "rotate-45")}>
            <Ic.Plus className="h-6 w-6" />
          </button>
        </div>
      )}

      <AnimatePresence>
        {showUpload && canUpload && <POUploadModal token={token} onClose={() => setShowUpload(false)} onDone={fetchPOs} />}
        {showAdd && canAdd && <AddPOModal token={token} onClose={() => setShowAdd(false)} onAdded={onAdded} />}
        {selected &&
            <PODetailPanel
            po={selected}
            token={token}
            user={user}
            onClose={() => setSelected(null)}
            onUpdated={onUpdated}
            onDeleted={(id) => setPos(p => p.filter(x => x.id !== id))}
            />
        }
      </AnimatePresence>
    </div>
  );
}