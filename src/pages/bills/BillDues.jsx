// pages/bills/BillDues.jsx
import { useState, useEffect, useMemo, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "../../context/AuthContext";
import { Ic } from "../prospects/icons";
import { cls } from "../prospects/ui/primitives";
import BottomNav from "../prospects/BottomNav";
import BillUploadModal from "./BillUploadModal";
import AddBillModal from "./AddBillModal";
import BillDetailPanel from "./BillDetailPanel";
import { fmtDate, fmtMoney, billDueStatus, dialable, personLabel, buildWaMessage } from "./utils";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

const VIEW_ALLOWED   = new Set(["info@bbmpvtltd.com", "communication@bbmpvtltd.com", "jay@bbmpvtltd.com", "account@bbmpvtltd.com"]);
const UPLOAD_ALLOWED = new Set(["communication@bbmpvtltd.com","account@bbmpvtltd.com"]);
const ADD_ALLOWED    = new Set(["communication@bbmpvtltd.com", "account@bbmpvtltd.com"]);

const TONE_CLS = {
  rose:  "text-rose-600 bg-rose-50 ring-rose-200",
  amber: "text-amber-600 bg-amber-50 ring-amber-200",
  sky:   "text-sky-600 bg-sky-50 ring-sky-200",
  slate: "text-slate-500 bg-slate-100 ring-slate-200",
};

const STATUS_TABS = [
  { id: "remaining",      label: "Remaining" },
  { id: "cheque_pending", label: "Cheque" },
  { id: "completed",      label: "Completed" },
];

// Compact Indian-notation currency for tight row widths — full precision
// (fmtMoney) is reserved for the detail panel where there's room for it.
function fmtCompact(n) {
  const num = Number(n) || 0;
  const abs = Math.abs(num);
  if (abs >= 1e7) return "₹" + (num / 1e7).toFixed(abs % 1e7 === 0 ? 0 : 1) + "Cr";
  if (abs >= 1e5) return "₹" + (num / 1e5).toFixed(abs % 1e5 === 0 ? 0 : 1) + "L";
  if (abs >= 1e3) return "₹" + (num / 1e3).toFixed(abs % 1e3 === 0 ? 0 : 1) + "K";
  return "₹" + num.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function WaIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

export default function BillDues() {
  const { user, token } = useAuth();
  const email = (user?.email || "").toLowerCase();
  const canView   = VIEW_ALLOWED.has(email);
  const canUpload = UPLOAD_ALLOWED.has(email);
  const canAdd    = ADD_ALLOWED.has(email);

  const [bills, setBills]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [search, setSearch]     = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [filter, setFilter]     = useState("remaining");
  const [urgency, setUrgency]   = useState("all"); // all | overdue | today | upcoming
  const [showUpload, setShowUpload] = useState(false);
  const [showAdd, setShowAdd]       = useState(false);
  const [fabOpen, setFabOpen]       = useState(false);
  const [selected, setSelected]     = useState(null);

  const fetchBills = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const r = await fetch(`${API}/api/bills`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (!d.success) throw new Error(d.message || "Failed to load");
      setBills(d.bills || []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { if (canView) fetchBills(); }, [canView, fetchBills]);

  function changeFilter(id) {
    setFilter(id);
    setUrgency("all");
  }

  const remainingCount      = bills.filter(b => b.status === "remaining").length;
  const chequePendingCount  = bills.filter(b => b.status === "cheque_pending").length;
  const completedCount      = bills.filter(b => b.status === "completed").length;
  const overdueCount   = bills.filter(b => b.status === "remaining" && b.collection_active && billDueStatus(b.due_date || b.bill_date).state === "overdue").length;
  const dueTodayCount  = bills.filter(b => b.status === "remaining" && b.collection_active && billDueStatus(b.due_date || b.bill_date).state === "today").length;
  const notYetActiveCount = bills.filter(b => b.status === "remaining" && !b.collection_active).length;
  const remainingTotal = bills.filter(b => b.status === "remaining").reduce((s, b) => s + Number(b.balance_amount || 0), 0);
  const overdueTotal = bills
    .filter(b => b.status === "remaining" && b.collection_active && billDueStatus(b.due_date || b.bill_date).state === "overdue")
    .reduce((s, b) => s + Number(b.balance_amount || 0), 0);

  const countFor = { remaining: remainingCount, cheque_pending: chequePendingCount, completed: completedCount };

  const URGENCY_CHIPS = [
    { id: "all",      label: "All",          count: remainingCount },
    { id: "overdue",  label: "Overdue",      count: overdueCount,      tone: "rose"  },
    { id: "today",    label: "Due today",    count: dueTodayCount,     tone: "amber" },
    { id: "upcoming", label: "Not due yet",  count: notYetActiveCount, tone: "slate" },
  ];

  const filtered = useMemo(() => {
    let list = bills.filter(b => b.status === filter);

    if (filter === "remaining" && urgency !== "all") {
      list = list.filter(b => {
        const st = billDueStatus(b.due_date || b.bill_date).state;
        if (urgency === "overdue")  return b.collection_active && st === "overdue";
        if (urgency === "today")    return b.collection_active && st === "today";
        if (urgency === "upcoming") return !b.collection_active;
        return true;
      });
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(b =>
        b.party_name?.toLowerCase().includes(q) ||
        b.bill_no?.toLowerCase().includes(q) ||
        b.mobile_1?.includes(q) || b.mobile_2?.includes(q)
      );
    }

    // Most overdue first: highest signed days-diff first (overdue > today > upcoming)
    return [...list].sort((a, b) => {
      const da = billDueStatus(a.due_date || a.bill_date), db = billDueStatus(b.due_date || b.bill_date);
      const va = da.state === "upcoming" ? -da.days : da.days;
      const vb = db.state === "upcoming" ? -db.days : db.days;
      return vb - va;
    });
  }, [bills, filter, urgency, search]);

  function onUpdated(updated) {
    setBills(p => p.map(b => b.id === updated.id ? updated : b));
    // Keep the open detail sheet in sync too — without this, actions that
    // update a bill but deliberately leave the sheet open (like the
    // Collection Active toggle) would appear to do nothing until you
    // closed and reopened it.
    setSelected(prev => (prev && prev.id === updated.id ? updated : prev));
  }
  function onAdded(bill) { setBills(p => [bill, ...p]); }

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
                    <h1 className="text-[17px] font-extrabold tracking-tight text-slate-900 lg:text-xl">Bill Dues</h1>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {remainingTotal > 0 && (
                      <span className="shrink-0 rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-extrabold text-indigo-600 ring-1 ring-inset ring-indigo-200">
                        {fmtMoney(remainingTotal)} to collect
                      </span>
                    )}
                    {overdueTotal > 0 && (
                      <span className="shrink-0 rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-extrabold text-rose-600 ring-1 ring-inset ring-rose-200">
                        {fmtMoney(overdueTotal)} overdue
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-[10.5px] text-slate-400">
                    {remainingCount} to collect
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
                  placeholder="Search party, bill no, mobile…"
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
              <div className="grid grid-cols-3 gap-1.5">
                {STATUS_TABS.map(t => (
                  <button key={t.id} onClick={() => changeFilter(t.id)}
                    className={cls(
                      "relative flex items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-[11.5px] font-bold transition-all active:scale-[0.97]",
                      filter === t.id
                        ? t.id === "remaining" ? "bg-rose-500 text-white shadow-sm"
                          : t.id === "cheque_pending" ? "bg-sky-500 text-white shadow-sm"
                          : "bg-emerald-500 text-white shadow-sm"
                        : "bg-slate-100 text-slate-500"
                    )}>
                    {t.label}
                    {countFor[t.id] > 0 && (
                      <span className={cls(
                        "grid h-4.5 min-w-[18px] place-items-center rounded-full px-1 text-[9px] font-extrabold leading-none",
                        filter === t.id ? "bg-white/25 text-white" : "bg-white text-slate-500"
                      )}>
                        {countFor[t.id]}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Urgency chips — only meaningful within "remaining" */}
            {filter === "remaining" && (
              <div className="scrollbar-none flex gap-1.5 overflow-x-auto px-4 pb-3 lg:px-5">
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
              </div>
            )}
            {filter !== "remaining" && <div className="pb-1" />}
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
                  {search ? "No matches" : `No ${filter.replace("_", " ")} bills`}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  {search ? "Try a different party, bill no, or mobile number"
                    : filter === "remaining" ? "All caught up!"
                    : filter === "cheque_pending" ? "No cheques awaiting clearance"
                    : "Nothing marked completed yet"}
                </p>
              </div>
            ) : (
              <div>
                {filtered.map(bill => {
                    const dueDate = bill.due_date || bill.bill_date;
                    const status = billDueStatus(dueDate);
                    const isChequePending = bill.status === "cheque_pending";
                    const isNotYetActive = bill.status === "remaining" && !bill.collection_active;
                    const isUrgent = bill.status === "remaining" && bill.collection_active && (status.state === "overdue" || status.state === "today");
                    const displayDate = bill.next_followup_date || dueDate;

                    const badgeLabel = bill.status === "completed"
                      ? "Paid"
                      : isChequePending
                      ? "Cheque"
                      : isNotYetActive
                      ? "In credit period"
                      : status.label;

                    return (
                        <div
                        key={bill.id}
                        className={cls(
                            "border-b border-slate-100 px-4 py-3 last:border-0 transition-colors active:bg-slate-50",
                            isUrgent && status.state === "overdue" ? "bg-rose-50/40" : isUrgent ? "bg-amber-50/40" : ""
                        )}
                        >
                        {/* Line 1: party name (left) · amount (right) */}
                        <button onClick={() => setSelected(bill)} className="flex w-full min-w-0 items-start justify-between gap-2 text-left">
                          <span className="min-w-0 break-words text-[13px] font-bold text-slate-900 leading-snug">
                            {bill.party_name}
                          </span>
                          <span className="shrink-0 whitespace-nowrap text-[12.5px] font-extrabold text-slate-800 leading-tight">
                            {fmtMoney(bill.balance_amount)}
                          </span>
                        </button>

                        {/* Line 2: invoice no/date (left) · status badge + call/WhatsApp (right) */}
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <button onClick={() => setSelected(bill)} className="min-w-0 flex-1 text-left">
                            <span className="text-[10.5px] text-slate-400">
                              #{bill.bill_no} • {fmtDate(bill.bill_date)}
                            </span>
                          </button>

                          <div className="flex shrink-0 items-center gap-1.5">
                            <span
                              className={cls(
                                "whitespace-nowrap rounded-full px-1.5 py-0.5 text-[9px] font-bold ring-1 ring-inset leading-none",
                                bill.status === "completed"
                                  ? "bg-emerald-50 text-emerald-600 ring-emerald-200"
                                  : isChequePending
                                  ? "bg-sky-50 text-sky-600 ring-sky-200"
                                  : isNotYetActive
                                  ? "bg-slate-100 text-slate-500 ring-slate-200"
                                  : TONE_CLS[status.tone]
                              )}
                            >
                              {badgeLabel}
                            </span>

                            {bill.mobile_1 && (
                              <>
                                <a href={`tel:${bill.mobile_1}`} title={`Call ${bill.mobile_1}`}
                                  className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-emerald-600 hover:bg-emerald-50 active:scale-90 transition-transform">
                                  <Ic.Phone className="h-3.5 w-3.5" />
                                </a>
                                <a href={`https://wa.me/${dialable(bill.mobile_1)}?text=${encodeURIComponent(buildWaMessage(bill))}`} target="_blank" rel="noopener noreferrer" title={`WhatsApp ${bill.mobile_1}`}
                                  className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-green-600 hover:bg-green-50 active:scale-90 transition-transform">
                                  <WaIcon className="h-3.5 w-3.5" />
                                </a>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Next follow-up (kept, shown under line 2 when present) */}
                        {bill.next_followup_date && (
                          
                          <button onClick={() => setSelected(bill)} className="mt-0.5 block text-left text-[10.5px] font-medium text-indigo-600">
                            Next Follow-up: {fmtDate(bill.next_followup_date)}
                          </button>
                        )}

                        {/* Line 3: last_reason */}
                        {bill.last_reason && (
                          <>
                          
                          <button onClick={() => setSelected(bill)} className="mt-1 block w-full text-left text-[10.5px] font-medium leading-relaxed text-slate-700 break-words whitespace-pre-wrap">
                          <span className="text-[10.5px] text-slate-400">
                              Reason: 
                            </span>  {bill.last_reason}
                          </button>
                          </>
                        )}

                        {/* Line 4: last_remark */}
                        {bill.last_remark && (
                          <button onClick={() => setSelected(bill)} className="mt-0.5 block w-full text-left text-[10.5px] leading-relaxed text-slate-500 break-words whitespace-pre-wrap">
                            <span className="text-[10.5px] text-slate-400 font-medium">
                              Remark:  
                            </span> {bill.last_remark}
                          </button>
                        )}
                        </div>
                    );
                    })}
              </div>
            )}
          </div>
        </div>
      </div>

      <BottomNav />

      {/* Floating action button — mobile only; desktop uses the header buttons */}
      {(canAdd || canUpload) && (
        <div
          className="fixed right-4 z-30 flex flex-col items-end gap-2.5 lg:hidden"
          style={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom))" }}
        >
          <AnimatePresence>
            {fabOpen && canAdd && canUpload && (
              <motion.div
                initial={{ opacity: 0, y: 12, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.9 }}
                transition={{ duration: 0.15 }}
                className="flex flex-col items-end gap-2.5"
              >
                <button onClick={() => { setShowUpload(true); setFabOpen(false); }}
                  className="flex items-center gap-2.5 rounded-full bg-white py-1.5 pl-4 pr-1.5 shadow-lg ring-1 ring-slate-200 active:scale-95 transition-transform">
                  <span className="text-[12px] font-semibold text-slate-700">Upload Excel</span>
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-600"><Ic.Box className="h-4 w-4" /></span>
                </button>
                <button onClick={() => { setShowAdd(true); setFabOpen(false); }}
                  className="flex items-center gap-2.5 rounded-full bg-white py-1.5 pl-4 pr-1.5 shadow-lg ring-1 ring-slate-200 active:scale-95 transition-transform">
                  <span className="text-[12px] font-semibold text-slate-700">Add Bill</span>
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-indigo-50 text-indigo-600"><Ic.Plus className="h-4 w-4" /></span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
          <button
            onClick={() => {
              if (canAdd && canUpload) setFabOpen(v => !v);
              else if (canAdd) setShowAdd(true);
              else setShowUpload(true);
            }}
            aria-label="Add or upload bills"
            className={cls(
              "grid h-14 w-14 place-items-center rounded-full bg-indigo-600 text-white shadow-xl shadow-indigo-600/30 transition-transform active:scale-90",
              fabOpen && "rotate-45"
            )}
          >
            <Ic.Plus className="h-6 w-6" />
          </button>
        </div>
      )}

      <AnimatePresence>
        {showUpload && canUpload && <BillUploadModal token={token} onClose={() => setShowUpload(false)} onDone={fetchBills} />}
        {showAdd && canAdd && <AddBillModal token={token} onClose={() => setShowAdd(false)} onAdded={onAdded} />}
        {selected && // pass user through to the panel, and handle deletion locally
            <BillDetailPanel
            bill={selected}
            token={token}
            user={user}
            onClose={() => setSelected(null)}
            onUpdated={onUpdated}
            onDeleted={(id) => setBills(p => p.filter(b => b.id !== id))}
            />
        }
      </AnimatePresence>
    </div>
  );
}