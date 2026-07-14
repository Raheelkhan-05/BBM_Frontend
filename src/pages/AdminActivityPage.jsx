import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { Ic } from "./prospects/icons";
import { cls } from "./prospects/ui/primitives";
import CustomSelect from "./components/CustomSelect";
import { exportStatusBoardPdf } from "../utils/exportStatusBoardPdf";
import { exportStageMatrixPdf } from "../utils/exportStageMatrixPdf";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

/* ── shared helpers ─────────────────────────────────────────────── */
function istHourDecimal(ts) {
  const d = new Date(ts);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d);
  const h = parseInt(parts.find(p => p.type === "hour").value, 10);
  const m = parseInt(parts.find(p => p.type === "minute").value, 10);
  return h + m / 60;
}

// IST "is this timestamp today" — mirrors the IST handling used elsewhere
// in this file (istHourDecimal, timeShort), so "today" means the same
// thing here as it does in the rest of the Activity page.
function istDateKey(ts) {
  const d = new Date(ts);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d); // YYYY-MM-DD
}
function isTodayIST(ts) {
  return istDateKey(ts) === istDateKey(Date.now());
}

function isBusinessHours(ts) { const hd = istHourDecimal(ts); return hd >= 8 && hd < 18; }
// Walks forward from `idx` to find the NEXT entry by the SAME person —
// not just the next row in the array. In LiveFeed the array is merged
// across every employee sorted by time, so "the next row" is frequently
// someone else's action; diffing against that gave meaningless gaps and
// silently never highlighted real idle time. In ByEmployee/Timeline views
// (already single-actor lists) this is equivalent to the old idx+1 check.
function hasIdleGapDesc(entries, idx) {
  const current = entries[idx];
  if (!isBusinessHours(current.timestamp)) return false;
  const key = actorKey(current);
  for (let j = idx + 1; j < entries.length; j++) {
    if (actorKey(entries[j]) === key) {
      const older = entries[j];
      return Math.abs(new Date(current.timestamp) - new Date(older.timestamp)) / 60000 > 20;
    }
  }
  return false;
}

function fmtTimestamp(ts) {
  const d = new Date(ts);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d);
  const get = (t) => parts.find((p) => p.type === t)?.value || "";
  return `${get("day")}-${get("month")}-${get("year")}, ${get("hour")}:${get("minute")}`;
}

// Identifies "who" an entry belongs to, regardless of which tab/view it
// came from — Live Feed entries carry userId/email, Company Timeline
// entries only carry a `by` display name. Falls back gracefully so the
// same function works everywhere hasIdleGapDesc is used.
function actorKey(e) {
  if (e.userId) return `id:${e.userId}`;
  if (e.email)  return `email:${e.email}`;
  if (e.by)     return `by:${e.by}`;
  return `name:${e.name || "unknown"}`;
}

function relTime(ts) {
  const diff = (Date.now() - new Date(ts).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
function timeShort(ts) {
  return new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });
}
const AVATAR_HUES = ["from-indigo-500 to-violet-600", "from-teal-400 to-emerald-500", "from-rose-400 to-pink-500", "from-amber-400 to-orange-500", "from-sky-400 to-blue-500", "from-fuchsia-400 to-purple-500"];
function avatarHue(name) {
  let h = 0; for (let i = 0; i < (name || "").length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_HUES[Math.abs(h) % AVATAR_HUES.length];
}
function initials(name) {
  return (name || "?").split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();
}
const TYPE_DOT = { Lead: "bg-indigo-500", RFQ: "bg-violet-500", "Follow-up": "bg-teal-500", Sample: "bg-rose-500", Quotation: "bg-emerald-500" };
const CHANGE_PILL = {
  Created: "bg-emerald-50 text-emerald-700", Updated: "bg-amber-50 text-amber-700",
  Deleted: "bg-rose-50 text-rose-700", Migrated: "bg-violet-50 text-violet-700",
};

/* ── Activity Card — the core visual unit, WhatsApp-message-like ──── */
function ActivityCard({ entry, highlighted, index }) {
  const [open, setOpen] = useState(false);
  const hasChanges = entry.changes && entry.changes.length > 0;
  const name = entry.name || "Unattributed";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.22, delay: Math.min(index * 0.015, 0.15), ease: [0.16, 1, 0.3, 1] }}
      className={cls(
        "rounded-2xl border px-3.5 py-3 transition-colors",
        highlighted ? "border-rose-200 bg-rose-50/70" : "border-slate-100 bg-white"
      )}
    >
      <div className="flex items-start gap-2.5">
        <div className={cls("flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[11px] font-bold text-white shadow-sm", avatarHue(name))}>
          {initials(name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="truncate text-[13px] font-bold text-slate-800">{name}</span>
              <span className={cls("h-1.5 w-1.5 rounded-full shrink-0", TYPE_DOT[entry.type] || "bg-slate-400")} />
              <span className="text-[11px] text-slate-400 shrink-0">{entry.type}</span>
            </div>
            <span className="shrink-0 text-[10px] text-slate-400">{fmtTimestamp(entry.timestamp)}</span>
          </div>

          <div className="mt-1 flex items-center gap-1.5">
            <span className={cls("rounded-full px-2 py-0.5 text-[10px] font-bold", CHANGE_PILL[entry.changeType] || "bg-slate-100 text-slate-500")}>
              {entry.changeType}
            </span>
            <span className="break-words text-[12px] font-semibold text-slate-700">{entry.company}</span>
          </div>

          {hasChanges && (
            <>
              <button
                onClick={() => setOpen(v => !v)}
                className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-indigo-500 active:opacity-60"
              >
                {open ? "Hide details" : `${entry.changes.length} field${entry.changes.length > 1 ? "s" : ""} changed`}
                <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.18 }}>
                  <Ic.ChevD className="h-3 w-3" />
                </motion.span>
              </button>
              <AnimatePresence initial={false}>
                {open && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="mt-2 space-y-1.5 rounded-xl bg-slate-50 p-2.5">
                      {entry.changes.map((c, i) => (
                        <div key={i} className="text-[11.5px] leading-snug">
                          <span className="font-semibold text-slate-500">{c.label}: </span>
                          {c.from != null && <span className="text-rose-400 line-through mr-1">{c.from}</span>}
                          {c.to != null && <span className="font-medium text-emerald-600">{c.to}</span>}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white px-3.5 py-3 animate-pulse">
      <div className="flex items-start gap-2.5">
        <div className="h-9 w-9 rounded-full bg-slate-100 shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-1/3 rounded-full bg-slate-100" />
          <div className="h-3 w-2/3 rounded-full bg-slate-100" />
        </div>
      </div>
    </div>
  );
}

/* ── Tab 1: Live Feed — merged, all employees, all-time, newest first ── */
function LiveFeed({ token }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [err, setErr] = useState("");
  const sentinelRef = useRef(null);

  const load = useCallback(async (offset) => {
    const r = await fetch(`${API}/api/admin/activity/feed?limit=25&offset=${offset}`, { headers: { Authorization: `Bearer ${token}` } });
    const d = await r.json();
    if (!r.ok) throw new Error(d.message);
    return d;
  }, [token]);

  useEffect(() => {
    (async () => {
      setLoading(true); setErr("");
      try {
        const d = await load(0);
        setEntries(d.entries); setHasMore(d.hasMore);
      } catch (e) { setErr(e.message); }
      finally { setLoading(false); }
    })();
  }, [load]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const d = await load(entries.length);
      setEntries(p => [...p, ...d.entries]);
      setHasMore(d.hasMore);
    } catch { /* silent — user can retry via button */ }
    finally { setLoadingMore(false); }
  }, [entries.length, hasMore, loadingMore, load]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver((es) => { if (es[0].isIntersecting) loadMore(); }, { rootMargin: "300px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore]);

  if (loading) return <div className="space-y-2.5">{Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}</div>;
  if (err) return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{err}</div>;

  return (
    <div className="space-y-2.5">
      <AnimatePresence initial={false}>
        {entries.map((e, i) => (
          <ActivityCard key={`${e.type}-${e.timestamp}-${i}`} entry={e} index={i} highlighted={!!e.highlighted} />
        ))}
      </AnimatePresence>
      <div ref={sentinelRef} className="h-8 flex items-center justify-center">
        {loadingMore && <Ic.Spin className="h-4 w-4 animate-spin text-slate-300" />}
        {!hasMore && entries.length > 0 && <span className="text-[11px] text-slate-300">That's everything</span>}
      </div>
    </div>
  );
}

/* ── Tab 2: By Employee — all-time, grouped, smooth accordion ────────── */
function ByEmployee({ token }) {
  const [employees, setEmployees] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true); setErr("");
      try {
        const r = await fetch(`${API}/api/admin/activity/by-employee`, { headers: { Authorization: `Bearer ${token}` } });
        const d = await r.json();
        if (!r.ok) throw new Error(d.message);
        setEmployees(d.employees);
      } catch (e) { setErr(e.message); }
      finally { setLoading(false); }
    })();
  }, [token]);

  if (loading) return <div className="space-y-2.5">{Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}</div>;
  if (err) return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{err}</div>;

  return (
    <LayoutGroup>
      <div className="space-y-2.5">
        {(employees || []).map(emp => {
          const isOpen = openId === emp.userId;
          const todayCount = emp.entries.filter(e => isTodayIST(e.timestamp)).length;
          return (
            <motion.div layout key={emp.userId} className="rounded-2xl border border-slate-100 bg-white overflow-hidden">
              <button
                onClick={() => setOpenId(isOpen ? null : emp.userId)}
                className="flex w-full items-center gap-3 px-3.5 py-3 active:bg-slate-50 transition-colors"
              >
                <div className={cls("flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[12px] font-bold text-white shadow-sm", avatarHue(emp.name))}>
                  {initials(emp.name)}
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <p className="truncate text-[13.5px] font-bold text-slate-800">{emp.name}</p>
                  <p className="text-[11px] text-slate-400">
                    {emp.entries.length} action(s) all-time
                    {todayCount > 0 && (
                      <span className="ml-2 font-medium text-emerald-600">
                        • {todayCount} today
                      </span>
                    )}
                  </p>
                </div>
                <motion.span animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                  <Ic.ChevD className="h-4 w-4 text-slate-400" />
                </motion.span>
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden border-t border-slate-100"
                  >
                    <div className="space-y-2 p-2.5 max-h-[60vh] overflow-y-auto">
                      {emp.entries.map((e, i) => (
                        <ActivityCard key={i} entry={e} index={i} highlighted={!!e.highlighted} />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </LayoutGroup>
  );
}

// Nearest-due-first, then no-due entries sorted by most-recent timestamp —
// mirrors sortByNearestDue on the backend, needed here because flattening
// across employees (statusMap) loses each employee's individual ordering.
function sortByNearestDue(entries) {
  return [...entries].sort((a, b) => {
    if (a.dueDateRaw && b.dueDateRaw) {
      const diff = new Date(a.dueDateRaw) - new Date(b.dueDateRaw);
      if (diff !== 0) return diff;
      return new Date(b.timestamp) - new Date(a.timestamp);
    }
    if (a.dueDateRaw && !b.dueDateRaw) return -1;
    if (!a.dueDateRaw && b.dueDateRaw) return 1;
    return new Date(b.timestamp) - new Date(a.timestamp);
  });
}

/* ── Tab 3: Status Board ──────────────────────────────────────────── */
function StatusBoard({ token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [section, setSection] = useState("leadStageLog");
  const [openGroup, setOpenGroup] = useState(null);   // now keyed by status
  const [selectedUser, setSelectedUser] = useState(null); // null = everyone

  async function handlePdfClick() {
    if (section === "sampleStatusLog" || section === "quotationStatusLog") {
      const r = await fetch(`${API}/api/admin/activity/stage-matrix`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      if (!r.ok) return; // optionally surface an error toast
      exportStageMatrixPdf(d.data.rows, d.data.sampleStageNames, d.data.quotationStageNames, selectedUser);
    } else {
      exportStatusBoardPdf(section, flatStatusGroups, selectedUser);
    }
  }


  useEffect(() => {
    (async () => {
      setLoading(true); setErr("");
      try {
        const r = await fetch(`${API}/api/admin/activity/status`, { headers: { Authorization: `Bearer ${token}` } });
        const d = await r.json();
        if (!r.ok) throw new Error(d.message);
        setData(d.data);
      } catch (e) { setErr(e.message); }
      finally { setLoading(false); }
    })();
  }, [token]);

  const SECTIONS = [
    { v: "leadStageLog", l: "Lead Stage", icon: Ic.User },
    { v: "enquiryStatusLog", l: "Enquiry", icon: Ic.FileT },
    { v: "sampleStatusLog", l: "Sample", icon: Ic.Package },
    { v: "quotationStatusLog", l: "Quotation", icon: Ic.FileT },
  ];

  if (loading) return <div className="space-y-2.5">{Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}</div>;
  if (err) return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{err}</div>;
  if (!data) return null;

  // Underlying data is still grouped by employee (group.name) with
  // per-employee statusGroups. Flatten across employees so the default
  // view is company-wise by status; selectedUser narrows it back down
  // to a single employee's entries without changing the shape.
  const sectionGroups = data[section] || [];
  const userOptions = sectionGroups.map(g => g.name).filter(Boolean);

  const statusMap = new Map(); // status -> entries[]
  for (const g of sectionGroups) {
    if (selectedUser && g.name !== selectedUser) continue;
    for (const sg of g.statusGroups) {
      const bucket = statusMap.get(sg.status) || [];
      bucket.push(...sg.entries);
      statusMap.set(sg.status, bucket);
    }
  }
  const flatStatusGroups = Array.from(statusMap.entries()).map(([status, entries]) => ({
    status,
    entries: sortByNearestDue(entries),   // ← re-sort after merging across employees
    count: entries.length,
  }));

  return (
    <div>
      <div className="mb-3 flex items-center gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
        {SECTIONS.map(s => (
          <button key={s.v} onClick={() => { setSection(s.v); setOpenGroup(null); }}
            className={cls("shrink-0 rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-all",
              section === s.v ? "bg-indigo-600 text-white shadow-sm" : "bg-white border border-slate-200 text-slate-500")}>
            {s.l}
          </button>
        ))}
      </div>

      {/* Employee filter — "All" plus each employee, applied on top of the
          company/status-wise list rather than being the primary grouping */}
      <div className="mb-3 px-4 -mx-4 flex items-center gap-3">
        <div className="flex-1">
          <CustomSelect
            value={selectedUser || ""}
            onChange={(v) => setSelectedUser(v || null)}
            options={[
              { value: "", label: "All Employees" },
              ...userOptions.map((name) => ({ value: name, label: name })),
            ]}
            placeholder="All Employees"
          />
        </div>

        <button
          onClick={handlePdfClick}
          className="shrink-0 flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3.5 py-1.5 text-[12.5px] font-semibold text-indigo-600 hover:bg-indigo-100 transition-colors"
        >
          <Ic.Download className="h-3.5 w-3.5" />
          PDF
        </button>
      </div>

      <LayoutGroup>
        <div className="space-y-2.5">
          {flatStatusGroups.map(sg => {
            const isOpen = openGroup === sg.status;
            return (
              <motion.div layout key={sg.status} className="rounded-2xl border border-slate-100 bg-white overflow-hidden">
                <button onClick={() => setOpenGroup(isOpen ? null : sg.status)}
                  className="flex w-full items-center justify-between px-3.5 py-3 active:bg-slate-50">
                  <span className="font-bold text-[13.5px] text-slate-800">{sg.status}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">{sg.count}</span>
                    <motion.span animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                      <Ic.ChevD className="h-4 w-4 text-slate-400" />
                    </motion.span>
                  </div>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden border-t border-slate-100">
                      {sg.entries.map((e, i) => (
                        <div key={i} className="px-3.5 py-2.5 border-b border-slate-50 last:border-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="break-words text-[12.5px] font-semibold text-slate-800">{e.company}</span>
                            <span className="shrink-0 text-[10.5px] text-slate-400">{e.dateLabel} · {e.timeLabel}</span>
                          </div>
                          {e.productLabel && (
                            <p className="break-words text-[11px] font-medium text-indigo-600 mt-0.5">
                              {e.productLabel}
                            </p>
                          )}
                          <p className="text-[11px] text-slate-400 mt-0.5">by {e.updatedBy}</p>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
          {flatStatusGroups.length === 0 && (
            <p className="text-[12px] text-slate-300 text-center py-10">No entries for this filter.</p>
          )}
        </div>
      </LayoutGroup>
    </div>
  );
}

/* ── Tab 4: Company Timeline ──────────────────────────────────────── */
function CompanyTimeline({ token }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [timeline, setTimeline] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showList, setShowList] = useState(true); // mobile: toggle search vs timeline

  useEffect(() => {
    const t = setTimeout(async () => {
      const r = await fetch(`${API}/api/admin/activity/companies?q=${encodeURIComponent(query)}`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (r.ok) setResults(d.companies || []);
    }, 250);
    return () => clearTimeout(t);
  }, [query, token]);

  async function openCompany(lead) {
    setSelected(lead); setLoading(true); setShowList(false);
    const r = await fetch(`${API}/api/admin/activity/companies/${lead.id}`, { headers: { Authorization: `Bearer ${token}` } });
    const d = await r.json();
    setTimeline(r.ok ? d.data : null);
    setLoading(false);
  }

  const timelineDesc = timeline ? [...timeline.timeline].reverse() : [];

  return (
    <div className="lg:grid lg:grid-cols-3 lg:gap-4">
      {/* Mobile: search panel, toggled */}
      <div className={cls("rounded-2xl border border-slate-100 bg-white p-3.5", !showList && "hidden lg:block")}>
        <div className="relative mb-3">
          <Ic.Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search company…"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-[13.5px] outline-none focus:border-indigo-400 focus:bg-white transition-colors" />
        </div>
        <div className="space-y-1 max-h-[65vh] overflow-y-auto">
          {results.map(l => (
            <button key={l.id} onClick={() => openCompany(l)}
              className={cls("w-full text-left px-3 py-2.5 rounded-xl text-[13px] transition-colors",
                selected?.id === l.id ? "bg-indigo-50 text-indigo-700 font-bold" : "hover:bg-slate-50 text-slate-700")}>
              {l.company_name}
              <span className="block text-[11px] text-slate-400 font-normal">{l.city || "—"} · {l.status}</span>
            </button>
          ))}
          {results.length === 0 && <p className="text-[12px] text-slate-300 text-center py-6">No matches</p>}
        </div>
      </div>

      {/* Timeline panel */}
      <div className={cls("lg:col-span-2 rounded-2xl border border-slate-100 bg-white p-3.5", showList && "hidden lg:block")}>
        {!selected && <p className="text-[13px] text-slate-400 text-center py-16">Select a company to see its full history.</p>}

        {selected && (
          <button onClick={() => setShowList(true)} className="lg:hidden mb-3 flex items-center gap-1 text-[12px] font-semibold text-indigo-600">
            <Ic.ChevR className="h-3.5 w-3.5 rotate-180" /> Back to search
          </button>
        )}

        {loading && <div className="space-y-2.5">{Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}</div>}

        {timeline && !loading && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <div className="min-w-0">
                <h3 className="break-words font-extrabold text-[17px] text-slate-900">{timeline.lead.company_name}</h3>
                <span className={cls("mt-1 inline-block text-[10.5px] font-bold px-2 py-0.5 rounded-full ring-1 ring-inset",
                  timeline.stage === "Lead" ? "bg-indigo-50 text-indigo-600 ring-indigo-200" : "bg-teal-50 text-teal-600 ring-teal-200")}>
                  {timeline.stage}
                </span>
              </div>
              <span className="shrink-0 text-[11px] text-slate-400">{timeline.rfqs.length} enquiry(ies)</span>
            </div>

            {/* Timeline with connecting line — chronological, newest first */}
            <div className="relative pl-5">
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-slate-100" />
              <div className="space-y-3">
                {timelineDesc.map((e, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2, delay: Math.min(idx * 0.02, 0.2) }}
                    className="relative"
                  >
                    <div className={cls("absolute -left-5 top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-white", TYPE_DOT[e.source] || "bg-slate-400")} />
                    <div className={cls("rounded-xl border px-3 py-2.5", hasIdleGapDesc(timelineDesc, idx) ? "border-rose-200 bg-rose-50/70" : "border-slate-100 bg-slate-50/60")}>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-bold uppercase text-indigo-600">{e.source}</span>
                        <span className="text-[10px] text-slate-400">· {e.action}</span>
                        <span className="ml-auto text-[10.5px] text-slate-400">{timeShort(e.timestamp)}</span>
                      </div>
                      <p className="break-words text-[12.5px] font-medium text-slate-700 mt-0.5">{e.summary}</p>
                      {e.detail && <p className="break-words text-[11px] text-slate-500 mt-0.5">{e.detail}</p>}
                      <p className="text-[10.5px] text-slate-400 mt-0.5">by {e.by}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Tab 5: Bills — by party, with full per-bill history ─────────────── */
function BillsTimeline({ token }) {
  const [query, setQuery] = useState("");
  const [parties, setParties] = useState([]);
  const [billMatches, setBillMatches] = useState([]);
  const [selectedParty, setSelectedParty] = useState(null);
  const [partyData, setPartyData] = useState(null);
  const [selectedBillId, setSelectedBillId] = useState(null);
  const [loadingParty, setLoadingParty] = useState(false);
  const [showList, setShowList] = useState(true);

  useEffect(() => {
    const t = setTimeout(async () => {
      const r = await fetch(`${API}/api/admin/activity/bills/parties?q=${encodeURIComponent(query)}`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (r.ok) { setParties(d.parties || []); setBillMatches(d.billMatches || []); }
    }, 250);
    return () => clearTimeout(t);
  }, [query, token]);

  async function openParty(party) {
    setSelectedParty(party); setPartyData(null); setSelectedBillId(null);
    setLoadingParty(true); setShowList(false);
    const r = await fetch(`${API}/api/admin/activity/bills/parties/${encodeURIComponent(party.party_name)}`, { headers: { Authorization: `Bearer ${token}` } });
    const d = await r.json();
    setPartyData(r.ok ? d.data : null);
    setLoadingParty(false);
  }

  // Jump straight to a single bill's history — used when the match came
  // from a bill-number hit, so the admin doesn't have to browse the
  // party's full bill list to find the one they searched for.
  async function openBillDirect(match) {
    setSelectedParty({ party_name: match.party_name });
    setPartyData(null); setSelectedBillId(match.id);
    setLoadingParty(true); setShowList(false);
    const r = await fetch(`${API}/api/admin/activity/bills/parties/${encodeURIComponent(match.party_name)}`, { headers: { Authorization: `Bearer ${token}` } });
    const d = await r.json();
    setPartyData(r.ok ? d.data : null);
    setLoadingParty(false);
  }

  const selectedBill = partyData?.bills.find(b => b.id === selectedBillId) || null;

  const STATUS_PILL = {
    completed: "bg-emerald-50 text-emerald-600 ring-emerald-200",
    cheque_pending: "bg-sky-50 text-sky-600 ring-sky-200",
    remaining: "bg-rose-50 text-rose-600 ring-rose-200",
  };

  return (
    <div className="lg:grid lg:grid-cols-3 lg:gap-4">
      {/* Party search panel */}
      <div className={cls("rounded-2xl border border-slate-100 bg-white p-3.5", !showList && "hidden lg:block")}>
        <div className="relative mb-3">
          <Ic.Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search party or bill no…"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-[13.5px] outline-none focus:border-indigo-400 focus:bg-white transition-colors" />
        </div>

        <div className="space-y-3 max-h-[65vh] overflow-y-auto">
          {/* Bill-number matches — shown first when present, so a bill-no
              search doesn't get buried under every party it belongs to */}
          {billMatches.length > 0 && (
            <div>
              <p className="px-1 pb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Matching bills</p>
              <div className="space-y-1">
                {billMatches.map(m => (
                  <button key={m.id} onClick={() => openBillDirect(m)}
                    className="w-full text-left px-3 py-2.5 rounded-xl text-[13px] hover:bg-slate-50 text-slate-700 flex items-center justify-between gap-2">
                    <span>
                      <span className="font-bold">#{m.bill_no}</span>
                      <span className="block text-[11px] text-slate-400 font-normal">{m.party_name}</span>
                    </span>
                    <span className={cls("shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold ring-1 ring-inset", STATUS_PILL[m.status] || "bg-slate-100 text-slate-500 ring-slate-200")}>
                      {m.status === "completed" ? "Completed" : m.status === "cheque_pending" ? "Cheque" : "Remaining"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {billMatches.length > 0 && parties.length > 0 && (
            <p className="px-1 pt-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Parties</p>
          )}

          <div className="space-y-1">
            {parties.map(p => (
              <button key={p.party_name} onClick={() => openParty(p)}
                className={cls("w-full text-left px-3 py-2.5 rounded-xl text-[13px] transition-colors",
                  selectedParty?.party_name === p.party_name ? "bg-indigo-50 text-indigo-700 font-bold" : "hover:bg-slate-50 text-slate-700")}>
                {p.party_name}
                <span className="block text-[11px] text-slate-400 font-normal">{p.billCount} bill(s)</span>
              </button>
            ))}
          </div>

          {parties.length === 0 && billMatches.length === 0 && (
            <p className="text-[12px] text-slate-300 text-center py-6">No matches</p>
          )}
        </div>
      </div>


      {/* Detail panel */}
      <div className={cls("lg:col-span-2 rounded-2xl border border-slate-100 bg-white p-3.5", showList && "hidden lg:block")}>
        {!selectedParty && <p className="text-[13px] text-slate-400 text-center py-16">Select a party to see their bills.</p>}

        {selectedParty && (
          <button onClick={() => selectedBillId ? setSelectedBillId(null) : setShowList(true)}
            className="mb-3 flex items-center gap-1 text-[12px] font-semibold text-indigo-600">
            <Ic.ChevR className="h-3.5 w-3.5 rotate-180" /> {selectedBillId ? "Back to bills" : "Back to search"}
          </button>
        )}

        {loadingParty && <div className="space-y-2.5">{Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}</div>}

        {/* Bill list for this party */}
        {partyData && !loadingParty && !selectedBillId && (
          <div>
            <div className="mb-4">
              <h3 className="truncate font-extrabold text-[17px] text-slate-900">{partyData.partyName}</h3>
              <span className="text-[11px] text-slate-400">{partyData.billCount} bill(s) on record</span>
            </div>
            <div className="space-y-2">
              {partyData.bills.map(b => (
                <button key={b.id} onClick={() => setSelectedBillId(b.id)}
                  className="w-full text-left rounded-xl border border-slate-100 bg-slate-50/60 px-3.5 py-3 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-bold text-slate-800">#{b.bill_no}</span>
                    <span className={cls("rounded-full px-2 py-0.5 text-[9.5px] font-bold ring-1 ring-inset", STATUS_PILL[b.status] || "bg-slate-100 text-slate-500 ring-slate-200")}>
                      {b.status === "completed" ? "Completed" : b.status === "cheque_pending" ? "Cheque Pending" : "Remaining"}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                    <span>{b.billDateFmt}</span>
                    <span>{b.billAmountFmt} · Bal {b.balanceFmt}</span>
                  </div>
                  <p className="mt-1 text-[10.5px] text-slate-400">{b.history.length} log entr{b.history.length === 1 ? "y" : "ies"} · created by {b.createdBy}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Single bill history */}
        {selectedBill && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <div className="min-w-0">
                <h3 className="truncate font-extrabold text-[17px] text-slate-900">{selectedBill.party_name}</h3>
                <p className="text-[11px] text-slate-400">Bill #{selectedBill.bill_no} · {selectedBill.billDateFmt}</p>
              </div>
              <span className={cls("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset", STATUS_PILL[selectedBill.status] || "bg-slate-100 text-slate-500 ring-slate-200")}>
                {selectedBill.status === "completed" ? "Completed" : selectedBill.status === "cheque_pending" ? "Cheque Pending" : "Remaining"}
              </span>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Bill Amount</p>
                <p className="mt-0.5 text-[14px] font-extrabold text-slate-800">{selectedBill.billAmountFmt}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Balance</p>
                <p className="mt-0.5 text-[14px] font-extrabold text-rose-600">{selectedBill.balanceFmt}</p>
              </div>
            </div>

            <div className="relative pl-5">
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-slate-100" />
              <div className="space-y-3">
                {selectedBill.history.map((h, idx) => (
                  <motion.div key={idx} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2, delay: Math.min(idx * 0.02, 0.2) }} className="relative">
                    <div className="absolute -left-5 top-1.5 h-2.5 w-2.5 rounded-full bg-orange-500 ring-4 ring-white" />
                    <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-bold uppercase text-orange-600">{h.action}</span>
                        <span className="ml-auto text-[10.5px] text-slate-400">{h.timeLabel}</span>
                      </div>
                      {h.lines.map((l, i) => <p key={i} className="text-[12px] text-slate-600 mt-0.5">{l}</p>)}
                      <p className="text-[10.5px] text-slate-400 mt-1">by {h.by}</p>
                    </div>
                  </motion.div>
                ))}
                {selectedBill.history.length === 0 && <p className="text-[12px] text-slate-300 py-4">No log entries yet</p>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PendingTasks({ token }) {
  const [allRows, setAllRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [selectedUserId, setSelectedUserId] = useState(null);

  // Fetch ALL rows once, no server-side user filter — filtering happens
  // client-side below so switching the dropdown is instant, no reload.
  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const r = await fetch(`${API}/api/admin/activity/pending-tasks`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message);
      setAllRows(d.rows);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const userOptions = useMemo(
    () => Array.from(new Map(allRows.map(r => [r.createdById, r.createdBy || "Unknown"])).entries())
      .filter(([id]) => id)
      .map(([id, name]) => ({ value: id, label: name || "Unknown" }))
      .sort((a, b) => (a.label || "").localeCompare(b.label || "")),
    [allRows]
  );

  // Instant, in-memory filter — no fetch on every dropdown change.
  const rows = useMemo(
    () => selectedUserId ? allRows.filter(r => r.createdById === selectedUserId) : allRows,
    [allRows, selectedUserId]
  );

  if (loading) return <div className="space-y-2.5">{Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}</div>;
  if (err) return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{err}</div>;

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <div className="flex-1">
          <CustomSelect
            value={selectedUserId || ""}
            onChange={(v) => setSelectedUserId(v || null)}
            options={[{ value: "", label: "All Employees" }, ...userOptions]}
            placeholder="All Employees"
          />
        </div>
        <button
          onClick={() => import("../utils/exportPendingTasksPdf").then(m => m.exportPendingTasksPdf(rows))}
          className="shrink-0 flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3.5 py-1.5 text-[12.5px] font-semibold text-indigo-600 hover:bg-indigo-100"
        >
          <Ic.Download className="h-3.5 w-3.5" /> PDF
        </button>
      </div>

      <div className="space-y-2.5">
        {rows.map((r) => (
          <div key={r.rfqId} className={cls("rounded-2xl border px-3.5 py-3", r.status === "resolved" ? "border-emerald-100 bg-emerald-50/40" : "border-rose-100 bg-rose-50/40")}>
            <div className="flex items-center justify-between">
              <span className="font-bold text-[13px] text-slate-800">{r.company}</span>
              <span className="text-[10px] text-slate-400">Due {r.dueDateFmt}</span>
            </div>
            <p className="text-[11.5px] text-slate-500">{r.enquiryDetail}</p>
            <div className="mt-1.5 space-y-1 text-[11px] text-slate-600">
              <p className="whitespace-pre-line">Sample: {r.lastSampleStage} → {r.newSampleStage}</p>
              <p className="whitespace-pre-line">Quotation: {r.lastQuotationStage} → {r.newQuotationStage}</p>
              <p className="whitespace-pre-line text-slate-400">Follow-up: {r.newFollowup}</p>
              <p className="whitespace-pre-line text-slate-400">Remark: {r.remark}</p>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              Belongs to: <span className="font-semibold text-slate-600">{r.createdBy}</span> · {r.status}
            </p>
          </div>
        ))}
        {rows.length === 0 && <p className="text-[12px] text-slate-300 text-center py-10">No pending tasks.</p>}
      </div>
    </div>
  );
}

/* ── Root page ─────────────────────────────────────────────────────── */
const TABS = [
  { v: "feed",    l: "Live Feed",   icon: Ic.Zap },
  { v: "byuser",  l: "By Employee", icon: Ic.User },
  { v: "pending", l: "Pending Tasks", icon: Ic.Clock }, 
  { v: "status",  l: "Status",      icon: Ic.Check },
  { v: "company", l: "Company",     icon: Ic.Building },
  { v: "bills",   l: "Bills",       icon: Ic.FileT },
];

const AUTO_REFRESH_MS = 2 * 60 * 1000; // 2 minutes

export default function AdminActivityPage() {
  const { token, user, loading: authLoading } = useAuth();
  const [tab, setTab] = useState("feed");
  const [refreshKey, setRefreshKey] = useState(0);

  // Auto-refresh every 2 minutes — remounts the active tab's data-fetching
  // component by changing its `key`, so each tab's own useEffect re-runs
  // and re-fetches from scratch. Only ticks while the tab is visible, so
  // it doesn't burn requests (or silently go stale) in a background tab.
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        setRefreshKey(k => k + 1);
      }
    }, AUTO_REFRESH_MS);
    return () => clearInterval(interval);
  }, []);

  // Also refresh immediately if the tab regains visibility after being
  // hidden for a while (covers "left it open overnight" case).
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") setRefreshKey(k => k + 1);
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  if (authLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50"><Ic.Spin className="h-6 w-6 animate-spin text-indigo-400" /></div>;
  }
  if (!token || user?.role !== "Admin") {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-[13px] text-slate-500">You don't have access to this page.</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24 lg:pb-8">
      {/* Sticky header */}
      <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-100">
        <div className="mx-auto max-w-4xl px-4 pt-4 pb-2 lg:px-0">
          <h1 className="text-[20px] font-extrabold tracking-tight text-slate-900">Activity</h1>
          <p className="text-[12px] text-slate-400">Live across every employee, every record</p>
        </div>
        {/* Desktop tabs (inline) */}
        <div className="hidden lg:block mx-auto max-w-4xl px-0 pb-3">
          <div className="inline-flex rounded-full bg-slate-100 p-1">
            {TABS.map(t => (
              <button key={t.v} onClick={() => setTab(t.v)}
                className={cls("rounded-full px-4 py-1.5 text-[13px] font-semibold transition-all",
                  tab === t.v ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700")}>
                {t.l}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 pt-4 lg:px-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            {tab === "feed"    && <LiveFeed token={token} />}
            {tab === "byuser"  && <ByEmployee token={token} />}
            {tab === "pending" && <PendingTasks token={token} />}
            {tab === "status"  && <StatusBoard token={token} />}
            {tab === "company" && <CompanyTimeline token={token} />}
            {tab === "bills"   && <BillsTimeline token={token} key={`bills-${refreshKey}`} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Mobile bottom tab bar — thumb-reach, WhatsApp/Instagram style */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-slate-100 bg-white/95 backdrop-blur-md px-2 pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto max-w-4xl flex items-stretch">
          {TABS.map(t => {
            const active = tab === t.v;
            const Icon = t.icon;
            return (
              <button key={t.v} onClick={() => setTab(t.v)} className="relative flex-1 flex flex-col items-center gap-0.5 py-2.5">
                {active && (
                  <motion.div layoutId="tab-pill" className="absolute inset-x-3 -top-0.5 h-0.5 rounded-full bg-indigo-600" transition={{ duration: 0.25 }} />
                )}
                <Icon className={cls("h-5 w-5 transition-colors", active ? "text-indigo-600" : "text-slate-400")} />
                <span className={cls("text-[10px] font-semibold transition-colors", active ? "text-indigo-600" : "text-slate-400")}>{t.l}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}