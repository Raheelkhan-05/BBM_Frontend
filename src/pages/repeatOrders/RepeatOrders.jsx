// pages/repeatOrders/RepeatOrders.jsx
import { useState, useEffect, useMemo, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "../../context/AuthContext";
import { Ic } from "../prospects/icons";
import { cls } from "../prospects/ui/primitives";
import BottomNav from "../prospects/BottomNav";
import RepeatOrderUploadModal from "./RepeatOrderUploadModal";
import AddRepeatOrderModal from "./AddRepeatOrderModal";
import AssignModal from "./AssignModal";
import RepeatOrderDetailPanel from "./RepeatOrderDetailPanel";
import {
  fmtDate, fmtMoney, followupStatus, activeSortWeight, reopenSortWeight,
  STATUS_META, dialable, personLabel, buildRepeatOrderWaMessage,
} from "./utils";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

const TONE_CLS = {
  rose: "text-rose-600 bg-rose-50 ring-rose-200",
  amber: "text-amber-600 bg-amber-50 ring-amber-200",
  sky: "text-sky-600 bg-sky-50 ring-sky-200",
  slate: "text-slate-500 bg-slate-100 ring-slate-200",
  emerald: "text-emerald-600 bg-emerald-50 ring-emerald-200",
};

function WaIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

export default function RepeatOrders() {
  const { user, token } = useAuth();

  const [records, setRecords]     = useState([]);
  const [manager, setManager]     = useState(false);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [search, setSearch]       = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [filter, setFilter]       = useState("active"); // active | unassigned | order_placed | not_interested

  const [showUpload, setShowUpload] = useState(false);
  const [showAdd, setShowAdd]       = useState(false);
  const [assignTarget, setAssignTarget] = useState(null);
  const [fabOpen, setFabOpen]       = useState(false);
  const [selected, setSelected]     = useState(null);

  const fetchRecords = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const r = await fetch(`${API}/api/repeat-orders`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (!d.success) throw new Error(d.message || "Failed to load");
      setRecords(d.repeatOrders || []);
      setManager(!!d.manager);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const TABS = manager
    ? [
        { id: "active",         label: "Active" },
        { id: "unassigned",     label: "Unassigned" },
        { id: "order_placed",   label: "Order Placed" },
        { id: "not_interested", label: "Not Interested" },
      ]
    : [
        { id: "active",         label: "My Follow-ups" },
        { id: "order_placed",   label: "Order Placed" },
        { id: "not_interested", label: "Not Interested" },
      ];

  const countFor = useMemo(() => ({
    active:         records.filter(r => r.status === "assigned").length,
    unassigned:     records.filter(r => r.status === "unassigned").length,
    order_placed:   records.filter(r => r.status === "order_placed").length,
    not_interested: records.filter(r => r.status === "not_interested").length,
  }), [records]);

  const noFollowupCount = useMemo(() =>
    records.filter(r => r.status === "assigned" && !r.next_followup_at).length,
  [records]);

  const overdueCount = useMemo(() =>
    records.filter(r => r.status === "assigned" && followupStatus(r.next_followup_at).state === "overdue").length,
  [records]);

  const totalLifetimeValue = useMemo(() =>
    records.reduce((s, r) => s + (Number(r.total_lifetime_value) || 0), 0),
  [records]);

  const filtered = useMemo(() => {
    let list = filter === "active"
      ? records.filter(r => r.status === "assigned")
      : records.filter(r => r.status === filter);

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        r.party_name?.toLowerCase().includes(q) ||
        r.location?.toLowerCase().includes(q) ||
        r.mobile_1?.includes(q) || r.mobile_2?.includes(q) ||
        (r.history || []).some(h => h.product_name?.toLowerCase().includes(q))
      );
    }

    if (filter === "active") {
      // Unscheduled records first (nobody's even planned a next step),
      // then earliest-due onward — see utils.activeSortWeight.
      return [...list].sort((a, b) => activeSortWeight(a) - activeSortWeight(b));
    }
    if (filter === "order_placed" || filter === "not_interested") {
      // Soonest-to-auto-reopen first, so you can see what's about to
      // land back in the active list.
      return [...list].sort((a, b) => reopenSortWeight(a) - reopenSortWeight(b));
    }
    return [...list].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  }, [records, filter, search]);

  function onUpdated(updated) {
    setRecords(list => list.map(x => x.id === updated.id ? updated : x));
    setSelected(prev => (prev && prev.id === updated.id ? updated : prev));
  }
  function onAdded(rec) { setRecords(list => [rec, ...list]); }

  return (
    <div className="min-h-screen bg-slate-50 lg:bg-gradient-to-br lg:from-slate-50 lg:via-white lg:to-indigo-50/30">
      <div className="pb-24 lg:pb-8">
        <div className="mx-auto max-w-3xl px-0 lg:px-6 lg:py-7">

          {/* Header */}
          <div className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-100 lg:static lg:rounded-2xl lg:border lg:shadow-none lg:bg-white lg:backdrop-blur-none">

            {!searchOpen ? (
              <div className="flex items-center justify-between gap-2 px-3.5 pt-3.5 pb-2 lg:px-5 lg:pt-5">
                <div className="min-w-0">
                  <h1 className="text-[16px] font-extrabold tracking-tight text-slate-900 lg:text-xl">Repeat Orders</h1>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    {manager && totalLifetimeValue > 0 && (
                      <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-extrabold text-indigo-600 ring-1 ring-inset ring-indigo-200">
                        {fmtMoney(totalLifetimeValue)} lifetime
                      </span>
                    )}
                    {overdueCount > 0 && (
                      <span className="shrink-0 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-extrabold text-rose-600 ring-1 ring-inset ring-rose-200">
                        {overdueCount} overdue
                      </span>
                    )}
                    {noFollowupCount > 0 && (
                      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-extrabold text-slate-500 ring-1 ring-inset ring-slate-200">
                        {noFollowupCount} unscheduled
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button onClick={() => setSearchOpen(true)} aria-label="Search"
                    className="grid h-9 w-9 place-items-center rounded-full text-slate-500 hover:bg-slate-100 active:scale-90 transition-transform">
                    <Ic.Search className="h-[17px] w-[17px]" />
                  </button>

                  {manager && (
                    <div className="hidden lg:flex items-center gap-2 pl-1">
                      <button onClick={() => setShowAdd(true)}
                        className="flex items-center gap-1.5 rounded-full border border-indigo-200 bg-white px-3 py-2 text-[11px] font-semibold text-indigo-600 shadow-sm hover:bg-indigo-50">
                        <Ic.Plus className="h-4 w-4" /> Add
                      </button>
                      <button onClick={() => setShowUpload(true)}
                        className="flex items-center gap-1.5 rounded-full bg-indigo-600 px-3 py-2 text-[11px] font-semibold text-white shadow-sm hover:bg-indigo-700">
                        <Ic.Box className="h-4 w-4" /> Upload
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3.5 py-3">
                <Ic.Search className="h-4 w-4 shrink-0 text-slate-400" />
                <input
                  autoFocus
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search company, location, product, mobile…"
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
            <div className="px-3.5 pb-2.5 lg:px-5">
              <div className="flex gap-1 overflow-x-auto scrollbar-none">
                {TABS.map(t => (
                  <button key={t.id} onClick={() => setFilter(t.id)}
                    className={cls(
                      "relative flex shrink-0 items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-[11px] font-bold transition-all active:scale-[0.97]",
                      filter === t.id ? "bg-indigo-600 text-white shadow-sm" : "bg-slate-100 text-slate-500"
                    )}>
                    {t.label}
                    {countFor[t.id] > 0 && (
                      <span className={cls("grid h-4 min-w-[16px] place-items-center rounded-full px-1 text-[9px] font-extrabold leading-none",
                        filter === t.id ? "bg-white/25 text-white" : "bg-white text-slate-500")}>
                        {countFor[t.id]}
                      </span>
                    )}
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
                  <div key={i} className="flex items-center gap-3 px-3.5 py-3 animate-pulse">
                    <div className="h-10 w-10 rounded-full bg-slate-100 shrink-0" />
                    <div className="flex-1"><div className="h-3.5 w-1/2 rounded-full bg-slate-100 mb-2" /><div className="h-3 w-1/3 rounded-full bg-slate-100" /></div>
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="p-4 m-3.5 rounded-2xl border border-rose-100 bg-rose-50 text-[13px] text-rose-700">{error}</div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <Ic.Radar className="h-11 w-11 text-slate-200 mb-3" />
                <p className="text-[13px] font-semibold text-slate-600">
                  {search ? "No matches" : "Nothing here"}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  {search ? "Try a different company, location, product, or mobile number"
                    : filter === "active" ? (manager ? "Nobody's in active follow-up" : "You're all caught up!")
                    : filter === "unassigned" ? "Nothing waiting to be assigned"
                    : filter === "order_placed" ? "No repeat orders taken yet"
                    : "Nothing marked not-interested"}
                </p>
              </div>
            ) : (
              <div>
                {filtered.map(rec => {
                  const fu = followupStatus(rec.next_followup_at);
                  const meta = STATUS_META[rec.status] || STATUS_META.unassigned;
                  const isUrgent = rec.status === "assigned" && (fu.state === "overdue" || fu.state === "today");
                  const noFollowup = rec.status === "assigned" && fu.state === "none";

                  return (
                    <div key={rec.id}
                      className={cls(
                        "border-b border-slate-100 px-3.5 py-2.5 last:border-0 transition-colors active:bg-slate-50",
                        isUrgent && fu.state === "overdue" ? "bg-rose-50/40" : isUrgent ? "bg-amber-50/40" : noFollowup ? "bg-slate-50/70" : ""
                      )}>
                      <div className="flex items-start gap-2.5">
                        <div className="relative shrink-0">
                          <button onClick={() => setSelected(rec)}
                            className={cls(
                              "flex h-10 w-10 items-center justify-center rounded-full text-white text-[10px] font-bold shadow-sm",
                              rec.status === "order_placed" ? "bg-gradient-to-br from-emerald-400 to-teal-500"
                              : rec.status === "not_interested" ? "bg-gradient-to-br from-slate-400 to-slate-500"
                              : rec.status === "unassigned" ? "bg-gradient-to-br from-slate-300 to-slate-400"
                              : noFollowup ? "bg-gradient-to-br from-slate-300 to-slate-400"
                              : fu.state === "overdue" ? "bg-gradient-to-br from-rose-500 to-orange-500"
                              : fu.state === "today" ? "bg-gradient-to-br from-amber-400 to-orange-400"
                              : "bg-gradient-to-br from-indigo-400 to-indigo-500"
                            )}>
                            {rec.party_name.slice(0, 2).toUpperCase()}
                          </button>
                          {isUrgent && (
                            <span className={cls("absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white",
                              fu.state === "overdue" ? "bg-rose-500 animate-pulse" : "bg-amber-400")} />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <button onClick={() => setSelected(rec)} className="flex w-full min-w-0 items-start justify-between gap-2 text-left">
                            <span className="min-w-0 truncate text-[13px] font-bold text-slate-900 leading-snug">{rec.party_name}</span>
                            <span className="shrink-0 whitespace-nowrap text-[12px] font-extrabold text-slate-800 leading-tight">
                              {fmtMoney(rec.total_lifetime_value)}
                            </span>
                          </button>

                          <button onClick={() => setSelected(rec)} className="mt-0.5 block w-full text-left">
                            <span className="text-[10px] text-slate-400">
                              {rec.location || "No location"} · {rec.total_bills_count || 0} bill{(rec.total_bills_count || 0) === 1 ? "" : "s"}
                              {manager && rec.assignee ? ` · ${personLabel(rec.assignee)}` : ""}
                            </span>
                          </button>

                          <div className="mt-1.5 flex items-center justify-between gap-2">
                            <span className={cls("shrink-0 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[9px] font-bold ring-1 ring-inset leading-none", TONE_CLS[meta.tone])}>
                              {meta.label}
                            </span>

                            <div className="flex shrink-0 items-center gap-1">
                              {manager && (
                                <button onClick={() => setAssignTarget(rec)} title="Assign"
                                  className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-indigo-600 hover:bg-indigo-50 active:scale-90 transition-transform">
                                  <Ic.Zap className="h-3.5 w-3.5" />
                                </button>
                              )}
                              {rec.mobile_1 && (
                                <>
                                  <a href={`tel:${rec.mobile_1}`} title={`Call ${rec.mobile_1}`}
                                    className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-emerald-600 hover:bg-emerald-50 active:scale-90 transition-transform">
                                    <Ic.Phone className="h-3.5 w-3.5" />
                                  </a>
                                  <a href={`https://wa.me/${dialable(rec.mobile_1)}?text=${encodeURIComponent(buildRepeatOrderWaMessage(rec))}`} target="_blank" rel="noopener noreferrer" title={`WhatsApp ${rec.mobile_1}`}
                                    className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-green-600 hover:bg-green-50 active:scale-90 transition-transform">
                                    <WaIcon className="h-3.5 w-3.5" />
                                  </a>
                                </>
                              )}
                            </div>
                          </div>

                          {rec.status === "assigned" && (
                            <button onClick={() => setSelected(rec)} className="mt-1 block text-left">
                              {rec.next_followup_at ? (
                                <span className="text-[10.5px] font-medium text-indigo-600">
                                  Next: {fmtDate(rec.next_followup_at)} · {fu.label}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[9.5px] font-bold text-slate-500 ring-1 ring-inset ring-slate-200">
                                  <Ic.Cal className="h-2.5 w-2.5" /> No follow-up set
                                </span>
                              )}
                            </button>
                          )}

                          {(rec.status === "order_placed" || rec.status === "not_interested") && rec.reopen_at && (
                            <button onClick={() => setSelected(rec)} className="mt-1 block text-left text-[10.5px] font-medium text-slate-400">
                              Reopens {fmtDate(rec.reopen_at)}
                            </button>
                          )}

                          {rec.last_reason && (
                            <button onClick={() => setSelected(rec)} className="mt-1 block w-full text-left text-[10.5px] font-medium leading-relaxed text-slate-700 break-words line-clamp-2">
                              <span className="text-[10.5px] text-slate-400">Reason: </span>{rec.last_reason}
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

      {manager && (
        <div className="fixed right-4 z-30 flex flex-col items-end gap-2.5 lg:hidden"
          style={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom))" }}>
          <AnimatePresence>
            {fabOpen && (
              <motion.div initial={{ opacity: 0, y: 12, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.9 }}
                transition={{ duration: 0.15 }} className="flex flex-col items-end gap-2.5">
                <button onClick={() => { setShowUpload(true); setFabOpen(false); }}
                  className="flex items-center gap-2.5 rounded-full bg-white py-1.5 pl-4 pr-1.5 shadow-lg ring-1 ring-slate-200 active:scale-95 transition-transform">
                  <span className="text-[12px] font-semibold text-slate-700">Upload Sales Dump</span>
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-600"><Ic.Box className="h-4 w-4" /></span>
                </button>
                <button onClick={() => { setShowAdd(true); setFabOpen(false); }}
                  className="flex items-center gap-2.5 rounded-full bg-white py-1.5 pl-4 pr-1.5 shadow-lg ring-1 ring-slate-200 active:scale-95 transition-transform">
                  <span className="text-[12px] font-semibold text-slate-700">Add Record</span>
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-indigo-50 text-indigo-600"><Ic.Plus className="h-4 w-4" /></span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
          <button
            onClick={() => setFabOpen(v => !v)}
            aria-label="Add or upload repeat order records"
            className={cls("grid h-14 w-14 place-items-center rounded-full bg-indigo-600 text-white shadow-xl shadow-indigo-600/30 transition-transform active:scale-90", fabOpen && "rotate-45")}>
            <Ic.Plus className="h-6 w-6" />
          </button>
        </div>
      )}

      <AnimatePresence>
        {showUpload && manager && <RepeatOrderUploadModal token={token} onClose={() => setShowUpload(false)} onDone={fetchRecords} />}
        {showAdd && manager && <AddRepeatOrderModal token={token} onClose={() => setShowAdd(false)} onAdded={onAdded} />}
        {assignTarget && manager && (
          <AssignModal record={assignTarget} token={token} onClose={() => setAssignTarget(null)}
            onAssigned={(updated) => { onUpdated(updated); setAssignTarget(null); }} />
        )}
        {selected &&
          <RepeatOrderDetailPanel
            record={selected}
            token={token}
            user={user}
            manager={manager}
            onClose={() => setSelected(null)}
            onUpdated={onUpdated}
            onDeleted={(id) => setRecords(list => list.filter(x => x.id !== id))}
          />
        }
      </AnimatePresence>
    </div>
  );
}