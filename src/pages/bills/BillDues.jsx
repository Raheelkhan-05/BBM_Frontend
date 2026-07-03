// pages/bills/BillDues.jsx
import { useState, useEffect, useMemo, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import { useAuth } from "../../context/AuthContext";
import { Ic } from "../prospects/icons";
import { cls } from "../prospects/ui/primitives";
import BottomNav from "../prospects/BottomNav";
import BillUploadModal from "./BillUploadModal";
import AddBillModal from "./AddBillModal";
import BillDetailPanel from "./BillDetailPanel";
import { fmtDate, fmtMoney, billDueStatus, dialable, personLabel } from "./utils";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

const VIEW_ALLOWED   = new Set(["info@bbmpvtltd.com", "communication@bbmpvtltd.com", "jay@bbmpvtltd.com", "account@bbmpvtltd.com"]);
const UPLOAD_ALLOWED = new Set(["communication@bbmpvtltd.com"]);
const ADD_ALLOWED    = new Set(["communication@bbmpvtltd.com", "account@bbmpvtltd.com"]);

const TONE_CLS = {
  rose:  "text-rose-600 bg-rose-50 ring-rose-200",
  amber: "text-amber-600 bg-amber-50 ring-amber-200",
  sky:   "text-sky-600 bg-sky-50 ring-sky-200",
  slate: "text-slate-500 bg-slate-100 ring-slate-200",
};

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
  const [filter, setFilter]     = useState("remaining");
  const [showUpload, setShowUpload] = useState(false);
  const [showAdd, setShowAdd]       = useState(false);
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

  const filtered = useMemo(() => {
    let list = bills.filter(b => b.status === filter);
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
      const da = billDueStatus(a.bill_date), db = billDueStatus(b.bill_date);
      const va = da.state === "upcoming" ? -da.days : da.days;
      const vb = db.state === "upcoming" ? -db.days : db.days;
      return vb - va;
    });
  }, [bills, filter, search]);

  const remainingCount = bills.filter(b => b.status === "remaining").length;
  const completedCount = bills.filter(b => b.status === "completed").length;
  const overdueCount   = bills.filter(b => b.status === "remaining" && billDueStatus(b.bill_date).state === "overdue").length;
  const dueTodayCount  = bills.filter(b => b.status === "remaining" && billDueStatus(b.bill_date).state === "today").length;
  const remainingTotal = bills.filter(b => b.status === "remaining").reduce((s, b) => s + Number(b.balance_amount || 0), 0);

  function onUpdated(updated) { setBills(p => p.map(b => b.id === updated.id ? updated : b)); }
  function onAdded(bill)      { setBills(p => [bill, ...p]); }

  if (!canView) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <div className="text-center">
          <Ic.Lock className="mx-auto h-10 w-10 text-slate-300 mb-3" />
          <p className="text-sm font-semibold text-slate-600">You don't have access to this page</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 lg:bg-gradient-to-br lg:from-slate-50 lg:via-white lg:to-indigo-50/30">
      <div className="pb-20 lg:pb-8">
        <div className="mx-auto max-w-3xl px-0 lg:px-6 lg:py-7">

          {/* Header */}
          <div className="sticky top-0 z-30 bg-white border-b border-slate-100 shadow-sm lg:static lg:rounded-2xl lg:border lg:shadow-none">
            <div className="flex items-center justify-between px-4 pt-4 pb-2 lg:px-5 lg:pt-5">
              <div>
                <h1 className="text-xl font-extrabold tracking-tight text-slate-900 lg:text-2xl">Bill Dues</h1>
                <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                  <span className="text-[11px] text-rose-500 font-semibold">{remainingCount} remaining</span>
                  <span className="text-slate-300">·</span>
                  <span className="text-[11px] text-emerald-600 font-semibold">{completedCount} completed</span>
                  {overdueCount > 0 && (
                    <><span className="text-slate-300">·</span><span className="text-[11px] text-rose-600 font-bold animate-pulse">{overdueCount} overdue</span></>
                  )}
                  {dueTodayCount > 0 && (
                    <><span className="text-slate-300">·</span><span className="text-[11px] text-amber-600 font-bold">{dueTodayCount} due today</span></>
                  )}
                </div>
              </div>
              {(canUpload || canAdd) && (
                <div className="flex items-center gap-2">
                  {canAdd && (
                    <button onClick={() => setShowAdd(true)}
                      className="flex items-center gap-1.5 rounded-full border border-indigo-200 bg-white px-3 py-2 text-[12px] font-semibold text-indigo-600 shadow-sm hover:bg-indigo-50">
                      <Ic.Plus className="h-4 w-4" /> Add
                    </button>
                  )}
                  {canUpload && (
                    <button onClick={() => setShowUpload(true)}
                      className="flex items-center gap-1.5 rounded-full bg-indigo-600 px-3 py-2 text-[12px] font-semibold text-white shadow-sm hover:bg-indigo-700">
                      <Ic.Box className="h-4 w-4" /> Upload
                    </button>
                  )}
                </div>
              )}
            </div>

            {remainingCount > 0 && (
              <div className="px-4 pb-2 lg:px-5">
                <p className="text-[11px] text-slate-400">
                  Outstanding balance: <span className="font-bold text-rose-600">{fmtMoney(remainingTotal)}</span>
                </p>
              </div>
            )}

            <div className="px-4 pb-2 lg:px-5">
              <div className="relative">
                <Ic.Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search party, bill no, mobile…"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm placeholder:text-slate-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:bg-white transition-all"
                />
              </div>
            </div>

            <div className="px-4 pb-3 lg:px-5">
              <div className="inline-flex rounded-full bg-slate-100 p-0.5">
                {["remaining", "completed"].map(v => (
                  <button key={v} onClick={() => setFilter(v)}
                    className={cls(
                      "rounded-full px-4 py-1.5 text-[12px] font-semibold capitalize transition-all",
                      filter === v
                        ? v === "remaining" ? "bg-rose-500 text-white shadow-sm" : "bg-emerald-500 text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    )}>
                    {v} {v === "remaining" ? `(${remainingCount})` : `(${completedCount})`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* List */}
          <div className="bg-white lg:mt-4 lg:rounded-2xl lg:border lg:border-slate-200 lg:shadow-sm overflow-hidden">
            {loading ? (
              <div className="divide-y divide-slate-100">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
                    <div className="h-10 w-10 rounded-full bg-slate-100 shrink-0" />
                    <div className="flex-1"><div className="h-3.5 w-1/2 rounded-full bg-slate-100 mb-2" /><div className="h-3 w-1/3 rounded-full bg-slate-100" /></div>
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="p-5 m-4 rounded-2xl border border-rose-100 bg-rose-50 text-sm text-rose-700">{error}</div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                <Ic.Radar className="h-12 w-12 text-slate-200 mb-4" />
                <p className="text-sm font-semibold text-slate-600">No {filter} bills</p>
                <p className="text-xs text-slate-400 mt-1">{filter === "remaining" ? "All caught up!" : "Nothing marked completed yet"}</p>
              </div>
            ) : (
              <div>
                {filtered.map(bill => {
                    const status = billDueStatus(bill.bill_date);
                    const isUrgent = bill.status === "remaining" && (status.state === "overdue" || status.state === "today");
                    const displayDate = bill.next_followup_date || bill.bill_date;

                    return (
                        <div
                        key={bill.id}
                        className={cls(
                            "flex items-center gap-2.5 px-4 py-2.5 border-b border-slate-100 last:border-0 transition-colors",
                            isUrgent && status.state === "overdue" ? "bg-rose-50/40" : isUrgent ? "bg-amber-50/40" : ""
                        )}
                        >
                        <button onClick={() => setSelected(bill)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                            <div className="relative shrink-0">
                            <div className={cls(
                                "flex h-8 w-8 items-center justify-center rounded-full text-white text-[10px] font-bold shadow-sm",
                                bill.status === "completed" ? "bg-gradient-to-br from-emerald-400 to-teal-500"
                                : status.state === "overdue" ? "bg-gradient-to-br from-rose-500 to-orange-500"
                                : status.state === "today" ? "bg-gradient-to-br from-amber-400 to-orange-400"
                                : "bg-gradient-to-br from-slate-400 to-slate-500"
                            )}>
                                {bill.party_name.slice(0, 2).toUpperCase()}
                            </div>
                            {isUrgent && (
                                <span className={cls("absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full border-2 border-white",
                                status.state === "overdue" ? "bg-rose-500 animate-pulse" : "bg-amber-400")} />
                            )}
                            </div>

                            <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                                <span className="truncate text-[13.5px] font-bold text-slate-900 leading-tight">{bill.party_name}</span>
                                <span className={cls("shrink-0 rounded-full px-1.5 py-0.5 text-[9.5px] font-bold ring-1 ring-inset leading-none",
                                bill.status === "completed" ? "bg-emerald-50 text-emerald-600 ring-emerald-200" : TONE_CLS[status.tone]
                                )}>
                                {bill.status === "completed" ? "Paid" : status.label}
                                </span>
                            </div>
                            <div className="mt-0.5 flex items-center justify-between gap-2">
                                <span className="truncate text-[11px] text-slate-400 leading-tight">
                                #{bill.bill_no} · {fmtDate(displayDate)}
                                </span>
                                <span className="shrink-0 text-[12.5px] font-bold text-slate-700 leading-tight">
                                {fmtMoney(bill.balance_amount)}
                                </span>
                            </div>
                            </div>
                        </button>

                        {bill.mobile_1 && (
                            <div className="flex shrink-0 gap-1" onClick={e => e.stopPropagation()}>
                            <a href={`tel:${bill.mobile_1}`} title={`Call ${bill.mobile_1}`}
                                className="flex h-6.5 w-6.5 h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-emerald-600 hover:bg-emerald-50 active:scale-95">
                                <Ic.Phone className="h-3 w-3" />
                            </a>
                            <a href={`https://wa.me/${dialable(bill.mobile_1)}`} target="_blank" rel="noopener noreferrer" title={`WhatsApp ${bill.mobile_1}`}
                                className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-green-600 hover:bg-green-50 active:scale-95">
                                <WaIcon className="h-3 w-3" />
                            </a>
                            </div>
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