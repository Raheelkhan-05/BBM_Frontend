// pages/ReportsPage.jsx — v2
//
// Fixes in this version:
//  • Today tab: diff lines always auto-expand; null/empty "from" values
//    rendered properly (shows "—" in strikethrough, not a blank field label);
//    employee name no longer shows email twice when first_name is missing.
//  • Employee filter: chip-bar + search on Today, Lifetime, and Status tabs
//    so admin can drill down to one person instantly.
//  • Lifetime log: card-based layout (mobile-first) instead of wide table;
//    each card is clickable to expand and shows type + action badges.
//  • Status tab: within each employee, entries are grouped by status value
//    then sorted by next-action date (overdue → today → upcoming → no date).
//  • All tabs: useAuth() token instead of prop.

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useAuth } from "../context/AuthContext"; // adjust path if needed

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";
const AUTO_REFRESH_MS = 5 * 60 * 1000;

/* ─── formatting ────────────────────────────────────────────────── */
function toIso(d) {
  if (!d) return null;
  return String(d).replace(" ", "T").replace(/(\+00(:00)?)?$/, "Z");
}
function fmtDateTime(d) {
  if (!d) return "—";
  return new Date(toIso(d)).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
    timeZone: "Asia/Kolkata",
  });
}
function fmtDateOnly(d) {
  if (!d) return "—";
  // date-only strings (YYYY-MM-DD) — treat as IST midnight to avoid off-by-one
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(String(d).trim());
  const dt = isDateOnly
    ? new Date(String(d) + "T00:00:00+05:30")
    : new Date(toIso(d));
  return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
}
function relTime(d) {
  if (!d) return "";
  const diff = Date.now() - new Date(toIso(d)).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
function fmtINR(n) {
  const num = Number(n) || 0;
  return `₹ ${num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/* ─── next-action date sort key: overdue < today < future < no-date ─ */
function dateSort(dateStr) {
  if (!dateStr) return 99999999;
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(String(dateStr).trim());
  const d = isDateOnly ? new Date(String(dateStr) + "T00:00:00+05:30") : new Date(toIso(dateStr));
  if (isNaN(d.getTime())) return 99999999;
  // days from today (negative = overdue)
  const nowIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const todayIST = new Date(nowIST.getFullYear(), nowIST.getMonth(), nowIST.getDate());
  return Math.round((d - todayIST) / 86400000);
}

/* ─── idle-gap rule ─────────────────────────────────────────────── */
function istHourDecimal(ts) {
  const d = new Date(toIso(ts));
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d);
  const h = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
  const m = parseInt(parts.find((p) => p.type === "minute")?.value || "0", 10);
  return h + m / 60;
}
function hasIdleGapBefore(entries, idx) {
  const cur = entries[idx];
  const older = entries[idx + 1];
  if (!older) return false;
  const hd = istHourDecimal(cur.timestamp);
  if (hd < 8 || hd >= 18) return false;
  return Math.abs(new Date(cur.timestamp) - new Date(older.timestamp)) / 60000 > 20;
}

/* ─── icons ─────────────────────────────────────────────────────── */
const Ic = {
  Refresh:  (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>,
  Activity: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/></svg>,
  Clock:    (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>,
  User:     (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  Users:    (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  Building: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>,
  Msg:      (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  Flask:    (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round"><path d="M9 3h6m-3 0v6l-4 8h10l-4-8V3"/></svg>,
  File:     (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>,
  Rupee:    (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M6 3h12M6 8h12M6 13l8.5 8M6 13h3c5 0 5-10 0-10"/></svg>,
  Spin:     (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>,
  Alert:    (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  ChevD:    (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><polyline points="6,9 12,15 18,9"/></svg>,
  ChevR:    (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><polyline points="9,18 15,12 9,6"/></svg>,
  Moon:     (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
  Search:   (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  X:        (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>,
  Tag:      (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
};

/* ─── badges ────────────────────────────────────────────────────── */
const TYPE_BADGE = {
  Lead:        "bg-indigo-100 text-indigo-700",
  Prospect:    "bg-violet-100 text-violet-700",
  RFQ:         "bg-purple-100 text-purple-700",
  "Follow-up": "bg-teal-100 text-teal-700",
  Sample:      "bg-rose-100 text-rose-700",
  Quotation:   "bg-emerald-100 text-emerald-700",
};
const CHANGE_BADGE = {
  Created:    "bg-emerald-100 text-emerald-800",
  Updated:    "bg-blue-100 text-blue-800",
  Deleted:    "bg-red-100 text-red-800",
  Payment:    "bg-teal-100 text-teal-800",
  Edited:     "bg-blue-100 text-blue-800",
  "Follow-up":"bg-amber-100 text-amber-800",
};
function Bdg({ label, map, size = "sm" }) {
  const cls = size === "xs"
    ? "px-1.5 py-0.5 text-[9px]"
    : "px-2 py-0.5 text-[10px]";
  return (
    <span className={`inline-flex items-center rounded-full font-bold uppercase tracking-wide ring-1 ring-inset ring-black/5 ${cls} ${(map || {})[label] || "bg-slate-100 text-slate-600"}`}>
      {label}
    </span>
  );
}

/* ─── section shell ─────────────────────────────────────────────── */
const ST = {
  slate:   { rail: "bg-slate-400",   ib: "bg-slate-100",   it: "text-slate-500",   hb: "bg-white",         hd: "border-slate-200",  t: "text-slate-700"  },
  indigo:  { rail: "bg-indigo-500",  ib: "bg-indigo-100",  it: "text-indigo-600",  hb: "bg-indigo-50/70",  hd: "border-indigo-200", t: "text-indigo-800" },
  violet:  { rail: "bg-violet-500",  ib: "bg-violet-100",  it: "text-violet-600",  hb: "bg-violet-50/70",  hd: "border-violet-200", t: "text-violet-800" },
  amber:   { rail: "bg-amber-500",   ib: "bg-amber-100",   it: "text-amber-600",   hb: "bg-amber-50/70",   hd: "border-amber-200",  t: "text-amber-800"  },
  teal:    { rail: "bg-teal-500",    ib: "bg-teal-100",    it: "text-teal-600",    hb: "bg-teal-50/70",    hd: "border-teal-200",   t: "text-teal-800"   },
  emerald: { rail: "bg-emerald-500", ib: "bg-emerald-100", it: "text-emerald-600", hb: "bg-emerald-50/70", hd: "border-emerald-200",t: "text-emerald-800"},
  rose:    { rail: "bg-rose-500",    ib: "bg-rose-100",    it: "text-rose-600",    hb: "bg-rose-50/70",    hd: "border-rose-200",   t: "text-rose-800"   },
};

function Section({ title, icon: Icon, count, accent = "slate", defaultOpen = true, subtitle, children }) {
  const [open, setOpen] = useState(defaultOpen);
  const th = ST[accent] || ST.slate;
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden mb-3 shadow-sm bg-white">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center gap-3 px-4 py-3 border-b transition-colors ${th.hb} ${open ? th.hd : "border-transparent"}`}>
        <div className={`w-1 self-stretch rounded-full flex-shrink-0 ${th.rail}`} />
        {Icon && <span className={`flex h-7 w-7 items-center justify-center rounded-lg flex-shrink-0 ${th.ib}`}><Icon className={`h-3.5 w-3.5 ${th.it}`} /></span>}
        <span className={`flex-1 text-left text-[11px] font-bold uppercase tracking-widest ${th.t}`}>
          {title}
          {subtitle && <span className="ml-2 normal-case tracking-normal font-medium text-slate-400">{subtitle}</span>}
        </span>
        {count !== undefined && <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold tabular-nums ${th.ib} ${th.it}`}>{count}</span>}
        <span className={`opacity-40 ${th.t}`}>{open ? <Ic.ChevD className="h-4 w-4" /> : <Ic.ChevR className="h-4 w-4" />}</span>
      </button>
      {open && <div className="bg-white p-4">{children}</div>}
    </div>
  );
}

/* ─── utility components ────────────────────────────────────────── */
function Empty({ text }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-3 text-slate-400">
      <div className="h-12 w-12 rounded-xl bg-slate-100 flex items-center justify-center">
        <Ic.Activity className="h-5 w-5 opacity-30" />
      </div>
      <p className="text-xs font-medium">{text}</p>
    </div>
  );
}
function LoadingSpinner({ text = "Loading…" }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
      <Ic.Spin className="h-7 w-7 animate-spin" />
      <p className="text-sm font-medium">{text}</p>
    </div>
  );
}
function ErrorBox({ message, onRetry }) {
  return (
    <div className="m-2 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-4">
      <Ic.Alert className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold text-red-800">Failed to load report data</p>
        <p className="text-xs text-red-600 mt-0.5">{message}</p>
        {onRetry && <button onClick={onRetry} className="mt-2 text-xs font-semibold text-red-700 underline">Retry</button>}
      </div>
    </div>
  );
}

/* ─── stat card ─────────────────────────────────────────────────── */
function StatCard({ label, value, Icon, tone = "indigo" }) {
  const tones = {
    indigo:  "from-indigo-500/10 to-indigo-500/25 text-indigo-600",
    emerald: "from-emerald-500/10 to-emerald-500/25 text-emerald-600",
    amber:   "from-amber-500/10 to-amber-500/25 text-amber-600",
    rose:    "from-rose-500/10 to-rose-500/25 text-rose-600",
    teal:    "from-teal-500/10 to-teal-500/25 text-teal-600",
    slate:   "from-slate-400/10 to-slate-400/25 text-slate-500",
  };
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white px-3 py-3 shadow-sm">
      <span className={`flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br flex-shrink-0 ${tones[tone] || tones.indigo}`}>
        {Icon && <Icon className="h-4 w-4" />}
      </span>
      <div className="min-w-0">
        <div className="text-lg font-black leading-none tracking-tight tabular-nums text-slate-800 truncate">{value}</div>
        <div className="text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400 mt-1 leading-none">{label}</div>
      </div>
    </div>
  );
}

/* ─── generic scrollable table ──────────────────────────────────── */
function DataTable({ columns, rows, rowClass }) {
  if (!rows.length) return <Empty text="No rows." />;
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 -mx-1">
      <table className="w-full text-left min-w-[480px]">
        <thead>
          <tr className="bg-indigo-600">
            {columns.map((c) => (
              <th key={c.key} className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white whitespace-nowrap">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={`border-t border-slate-100 ${rowClass?.(row, i) || (i % 2 ? "bg-slate-50" : "bg-white")}`}>
              {columns.map((c) => (
                <td key={c.key} className={`px-3 py-2 text-[12px] text-slate-700 ${c.bold ? "font-semibold text-slate-900" : ""}`}>
                  {c.render ? c.render(row) : String(row[c.key] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── employee filter bar ───────────────────────────────────────── */
// employeeList: [{ id, name, email }]
// selected: string id or "all"
function EmployeeFilter({ employeeList, selected, onSelect }) {
  const [search, setSearch] = useState("");
  if (employeeList.length <= 1) return null;
  const filtered = search
    ? employeeList.filter((e) => (e.name + e.email).toLowerCase().includes(search.toLowerCase()))
    : employeeList;
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="relative flex-1 max-w-xs">
          <Ic.Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Filter by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-[12px] rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <Ic.X className="h-3 w-3" />
            </button>
          )}
        </div>
        {selected !== "all" && (
          <button onClick={() => onSelect("all")} className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 underline">
            Show all
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => onSelect("all")}
          className={`rounded-full px-3 py-1 text-[11px] font-bold transition-colors ${selected === "all" ? "bg-indigo-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600"}`}
        >
          All
        </button>
        {filtered.map((e) => (
          <button
            key={e.id}
            onClick={() => onSelect(e.id)}
            className={`rounded-full px-3 py-1 text-[11px] font-bold transition-colors ${selected === e.id ? "bg-indigo-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600"}`}
          >
            {e.name}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── per-employee accordion ────────────────────────────────────── */
function EmployeeGroup({ name, email, meta, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  // guard: if name equals email (happens when first_name is null), don't show email again
  const showEmail = email && email !== name;
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden mb-2 bg-white shadow-sm">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 text-[11px] font-black flex-shrink-0">
          {String(name || "?").trim().charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0 text-left flex-1">
          <span className="block text-[13px] font-bold text-slate-800 truncate">{name}</span>
          {showEmail && <span className="block text-[10px] text-slate-400 truncate">{email}</span>}
        </span>
        {meta && <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 tabular-nums flex-shrink-0">{meta}</span>}
        <span className="text-slate-300">{open ? <Ic.ChevD className="h-4 w-4" /> : <Ic.ChevR className="h-4 w-4" />}</span>
      </button>
      {open && <div className="border-t border-slate-100 p-3 bg-slate-50/50">{children}</div>}
    </div>
  );
}

/* ─── diff lines ────────────────────────────────────────────────── */
// Handles null/empty "from" cleanly — shows "—" in muted text (not bold)
// so it's clear the field was previously empty, not that data is missing.
function DiffLine({ label, from, to }) {
  // from == null means "created" (field didn't exist before)
  // to == null means "deleted" (field removed)
  // both present means "updated"
  const isAdd = from == null && to != null;
  const isRemove = from != null && to == null;
  const fromEmpty = from === null || from === undefined || from === "" || from === "—";
  const toEmpty   = to   === null || to   === undefined || to   === "" || to   === "—";
  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-slate-100 last:border-0">
      <span className="w-32 sm:w-40 flex-shrink-0 text-[11px] text-slate-400 pt-0.5 leading-snug">{label}</span>
      <div className="flex-1 min-w-0">
        {isAdd ? (
          <span className="text-[12px] text-emerald-700 font-semibold break-words">{toEmpty ? <span className="italic text-slate-400">set (empty)</span> : String(to)}</span>
        ) : isRemove ? (
          <span className="text-[12px] text-red-600 line-through break-words">{fromEmpty ? <span className="not-italic text-slate-400">was empty</span> : String(from)}</span>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`text-[12px] break-words ${fromEmpty ? "text-slate-400 italic" : "text-red-600 line-through"}`}>
              {fromEmpty ? "empty" : String(from)}
            </span>
            <span className="text-slate-300 text-xs flex-shrink-0">→</span>
            <span className={`text-[12px] break-words ${toEmpty ? "text-slate-400 italic" : "text-emerald-700 font-semibold"}`}>
              {toEmpty ? "empty" : String(to)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── activity entry card (Today + Bills tabs) ──────────────────── */
function ActivityEntry({ entry, idleGap, showTypeBadge = true }) {
  const changes = entry.changes || [];
  const lines = entry.lines || [];
  const hasDetail = changes.length > 0 || lines.length > 0;
  // Always open if few fields; auto-collapse only for large diffs
  const [open, setOpen] = useState(hasDetail && changes.length + lines.length <= 8);

  return (
    <div className={`rounded-lg border mb-2 overflow-hidden ${idleGap ? "border-red-200" : "border-slate-200"}`}>
      {/* header row */}
      <div className={`px-3 py-2.5 ${idleGap ? "bg-red-50/70" : "bg-white"}`}>
        <div className="flex flex-wrap items-center gap-1.5">
          {showTypeBadge && entry.type && <Bdg label={entry.type} map={TYPE_BADGE} />}
          <Bdg label={entry.changeType} map={CHANGE_BADGE} />
          <span className="text-[12px] font-semibold text-slate-800 flex-1 truncate min-w-0">{entry.company}</span>
          <span className="flex items-center gap-1 text-[10px] text-slate-400 flex-shrink-0 ml-auto">
            <Ic.Clock className="h-3 w-3 flex-shrink-0" />
            <span className="hidden sm:inline">{entry.timeLabel || fmtDateTime(entry.timestamp)}</span>
            <span className="sm:hidden">{relTime(entry.timestamp)}</span>
            <span className="hidden sm:inline text-slate-300">· {relTime(entry.timestamp)}</span>
          </span>
        </div>
        {idleGap && (
          <p className="mt-1 text-[10px] font-semibold text-red-500 flex items-center gap-1">
            <span>⏱</span> 20+ min gap since previous action (business hours)
          </p>
        )}
      </div>

      {/* detail panel */}
      {hasDetail && (
        <>
          <button type="button" onClick={() => setOpen((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-semibold text-slate-500 bg-slate-50 border-t border-slate-100 hover:bg-slate-100 transition-colors">
            <span>
              {open ? "Hide" : "Show"} {changes.length > 0 ? `${changes.length} field change${changes.length !== 1 ? "s" : ""}` : `${lines.length} detail${lines.length !== 1 ? "s" : ""}`}
            </span>
            {open ? <Ic.ChevD className="h-3.5 w-3.5" /> : <Ic.ChevR className="h-3.5 w-3.5" />}
          </button>
          {open && (
            <div className="px-3 py-2 bg-slate-50 border-t border-slate-100">
              {changes.map((c, i) => <DiffLine key={i} label={c.label} from={c.from} to={c.to} />)}
              {lines.map((l, i) => (
                <div key={`ln-${i}`} className="py-1.5 border-b border-slate-100 last:border-0 text-[12px] text-slate-700">
                  <span className="text-slate-400">•</span> {l}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   TAB: OVERVIEW
══════════════════════════════════════════════════════════════════ */
function OverviewTab({ data }) {
  const lifetimeCols = [
    { key: "name", label: "Employee", bold: true },
    { key: "Leads", label: "Leads", render: (r) => r.Leads || 0 },
    { key: "Prospects", label: "Prospects", render: (r) => r.Prospects || 0 },
    { key: "RFQs", label: "RFQs", render: (r) => r.RFQs || 0 },
    { key: "Follow-ups", label: "Follow-ups", render: (r) => r["Follow-ups"] || 0 },
    { key: "Samples", label: "Samples", render: (r) => r.Samples || 0 },
    { key: "Quotations", label: "Quotations", render: (r) => r.Quotations || 0 },
    { key: "total", label: "Total", bold: true },
  ];
  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
        <StatCard label="Actions today" value={data.totalActions} Icon={Ic.Activity} tone="indigo" />
        <StatCard label="Active employees" value={data.activeTodayCount} Icon={Ic.Users} tone="emerald" />
        <StatCard label="No activity today" value={data.noActivityToday.length} Icon={Ic.Moon} tone="slate" />
      </div>

      <Section title="Active Today" icon={Ic.Users} accent="emerald" count={data.activeToday.length}>
        {data.activeToday.length === 0 ? <Empty text="No activity yet today." /> : (
          <div className="space-y-1.5">
            {data.activeToday.map((e) => (
              <div key={e.email} className="rounded-lg border border-slate-200 bg-white px-3 py-2 flex flex-wrap items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 text-[10px] font-black flex-shrink-0">
                  {String(e.name || "?").charAt(0).toUpperCase()}
                </span>
                <span className="text-[12px] font-bold text-slate-800">{e.name}</span>
                <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 tabular-nums">{e.actionCount} action(s)</span>
                {e.lastActionLabel && (
                  <span className="ml-auto text-[11px] text-slate-500 truncate max-w-[200px] sm:max-w-[300px]">
                    {e.lastActionLabel} · <span className="text-slate-400">{relTime(e.lastActionAt)}</span>
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      {data.noActivityToday.length > 0 && (
        <Section title="No Activity Today" icon={Ic.Moon} accent="slate" count={data.noActivityToday.length} defaultOpen={false}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {data.noActivityToday.map((e) => (
              <div key={e.email} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-600">
                <span className="font-semibold text-slate-700">{e.name}</span>
                {e.email !== e.name && <span className="text-slate-400 ml-1.5 text-[10px]">{e.email}</span>}
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Lifetime Contribution Summary" icon={Ic.Building} accent="indigo" count={data.lifetimeSummary.length} subtitle="distinct live records per employee">
        <DataTable columns={lifetimeCols} rows={data.lifetimeSummary} />
      </Section>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   TAB: TODAY'S ACTIVITY
══════════════════════════════════════════════════════════════════ */
function TodayTab({ data }) {
  const { activeToday = [] } = data;
  const [selected, setSelected] = useState("all");

  const employeeList = useMemo(() =>
    activeToday.map((e) => ({ id: e.email, name: e.name, email: e.email })),
    [activeToday]
  );

  const visible = selected === "all" ? activeToday : activeToday.filter((e) => e.email === selected);

  if (!activeToday.length) return <Empty text="No activity recorded yet today." />;

  return (
    <div>
      <EmployeeFilter employeeList={employeeList} selected={selected} onSelect={setSelected} />
      <p className="text-[10px] text-slate-400 mb-3 italic">
        ⏱ Red border = 20+ minute gap since previous action during business hours (8am–6pm IST)
      </p>
      {visible.map((emp, i) => (
        <EmployeeGroup
          key={emp.email}
          name={emp.name}
          email={emp.email}
          meta={`${emp.entries.length} action(s)`}
          defaultOpen={i === 0 || selected !== "all"}
        >
          {emp.entries.map((entry, idx) => (
            <ActivityEntry
              key={`${entry.timestamp}-${idx}`}
              entry={entry}
              idleGap={hasIdleGapBefore(emp.entries, idx)}
            />
          ))}
        </EmployeeGroup>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   TAB: LIFETIME ACTIVITY LOG — mobile-first cards
══════════════════════════════════════════════════════════════════ */
function LifetimeEntryCard({ entry, idleGap }) {
  return (
    <div className={`rounded-lg border mb-2 px-3 py-2.5 ${idleGap ? "border-red-200 bg-red-50/60" : "border-slate-200 bg-white"}`}>
      <div className="flex flex-wrap items-center gap-1.5">
        <Bdg label={entry.type} map={TYPE_BADGE} />
        <Bdg label={entry.changeType} map={CHANGE_BADGE} />
        <span className="flex-1 min-w-0 text-[12px] font-semibold text-slate-800 truncate">{entry.company}</span>
      </div>
      <div className="mt-1.5 flex items-center gap-3 text-[10px] text-slate-400">
        <span className="flex items-center gap-1">
          <Ic.Clock className="h-3 w-3 flex-shrink-0" />
          {entry.dateLabel} · {entry.timeLabel}
        </span>
        {idleGap && <span className="text-red-500 font-semibold">⏱ gap</span>}
      </div>
    </div>
  );
}

function LifetimeTab({ data }) {
  const employees = data || [];
  const [selected, setSelected] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const employeeList = useMemo(() =>
    employees.map((e) => ({ id: e.email, name: e.name, email: e.email })),
    [employees]
  );

  const allTypes = useMemo(() => {
    const set = new Set();
    employees.forEach((e) => e.entries.forEach((r) => set.add(r.type)));
    return [...set].sort();
  }, [employees]);

  const visible = useMemo(() => {
    let list = selected === "all" ? employees : employees.filter((e) => e.email === selected);
    if (typeFilter !== "all") {
      list = list.map((e) => ({
        ...e,
        entries: e.entries.filter((r) => r.type === typeFilter),
      })).filter((e) => e.entries.length > 0);
    }
    return list;
  }, [employees, selected, typeFilter]);

  if (!employees.length) return <Empty text="No activity history found." />;

  return (
    <div>
      <EmployeeFilter employeeList={employeeList} selected={selected} onSelect={setSelected} />

      {/* type filter chips */}
      {allTypes.length > 1 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {["all", ...allTypes].map((t) => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors ${typeFilter === t
                ? "bg-indigo-600 text-white"
                : "bg-white border border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600"}`}>
              {t === "all" ? "All types" : t}
            </button>
          ))}
        </div>
      )}

      <p className="text-[10px] text-slate-400 mb-3 italic">⏱ Red border = 20+ min gap during business hours</p>

      {visible.map((emp) => (
        <EmployeeGroup
          key={emp.email}
          name={emp.name}
          email={emp.email}
          meta={emp.truncated ? `${emp.entries.length} of ${emp.totalCount}` : `${emp.totalCount}`}
          defaultOpen={selected !== "all"}
        >
          {emp.entries.map((entry, idx) => (
            <LifetimeEntryCard
              key={`${entry.timestamp}-${idx}`}
              entry={entry}
              idleGap={hasIdleGapBefore(emp.entries, idx)}
            />
          ))}
          {emp.truncated && (
            <p className="mt-2 text-[11px] italic text-slate-400 text-center">
              …{emp.totalCount - emp.entries.length} earlier entries not shown (most recent {emp.entries.length} displayed)
            </p>
          )}
        </EmployeeGroup>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   TAB: STATUS UPDATES
   Groups by employee → by status value → sorts entries by date
   (overdue first, today, upcoming, no-date last)
══════════════════════════════════════════════════════════════════ */
// Extract the "action date" from a status entry for sorting
function entryActionDate(entry) {
  return entry.nextActionDate || entry.followUp?.split(" at ")[0] || null;
}

function dateLabel(days) {
  if (days === null || days === undefined) return null;
  if (days < 0) return { text: `${Math.abs(days)}d overdue`, cls: "bg-red-100 text-red-700" };
  if (days === 0) return { text: "Today", cls: "bg-amber-100 text-amber-700" };
  return { text: `in ${days}d`, cls: "bg-slate-100 text-slate-500" };
}

function StatusEntryCard({ entry, lines }) {
  const [open, setOpen] = useState(false);
  const raw = entryActionDate(entry);
  const days = raw ? dateSort(raw) : null;
  const dl = dateLabel(days);

  return (
    <div className="rounded-lg border border-slate-200 bg-white mb-2 overflow-hidden">
      <div className="px-3 py-2.5">
        <div className="flex flex-wrap items-start gap-2">
          <span className="flex-1 min-w-0 text-[12px] font-semibold text-slate-800 break-words leading-snug">{entry.company}</span>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {dl && <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${dl.cls}`}>{dl.text}</span>}
            <span className="text-[10px] text-slate-400">{entry.dateLabel} {entry.timeLabel}</span>
          </div>
        </div>
        {/* always-visible quick summary */}
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5">
          {lines.slice(0, 2).map((l, i) => (
            <span key={i} className="text-[11px] text-slate-500">
              <span className="text-slate-400">{l.label}:</span>{" "}
              <span className={l.strong ? "font-semibold text-slate-700" : ""}>{l.value}</span>
            </span>
          ))}
        </div>
      </div>
      {lines.length > 2 && (
        <>
          <button type="button" onClick={() => setOpen((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-semibold text-slate-500 bg-slate-50 border-t border-slate-100 hover:bg-slate-100 transition-colors">
            <span>{open ? "Hide" : "Show"} all {lines.length} fields</span>
            {open ? <Ic.ChevD className="h-3.5 w-3.5" /> : <Ic.ChevR className="h-3.5 w-3.5" />}
          </button>
          {open && (
            <div className="px-3 py-2 bg-slate-50 border-t border-slate-100 space-y-1">
              {lines.map((l, i) => (
                <div key={i} className="flex gap-2 text-[12px]">
                  <span className="w-32 flex-shrink-0 text-slate-400">{l.label}</span>
                  <span className={l.strong ? "font-semibold text-slate-800" : "text-slate-700"}>{l.value}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Group entries by status, sort groups and within groups by date
function groupByStatus(entries, getStatus, getDate) {
  const map = new Map();
  entries.forEach((e) => {
    const s = getStatus(e) || "—";
    if (!map.has(s)) map.set(s, []);
    map.get(s).push(e);
  });
  // Sort each group by date asc (overdue first, no-date last)
  map.forEach((arr) => arr.sort((a, b) => {
    const da = dateSort(getDate(a));
    const db = dateSort(getDate(b));
    return da - db;
  }));
  // Sort groups by their soonest/most-overdue entry
  return [...map.entries()].sort(([, a], [, b]) => {
    const da = dateSort(getDate(a[0]));
    const db = dateSort(getDate(b[0]));
    return da - db;
  });
}

function StatusGroupedEmployee({ group, buildLines, getStatus, getDate }) {
  const grouped = groupByStatus(group.entries, getStatus, getDate);
  return (
    <EmployeeGroup name={group.name} meta={`${group.entries.length} update(s)`}>
      {grouped.map(([status, entries]) => {
        const bestDays = dateSort(getDate(entries[0]));
        const dl = dateLabel(bestDays < 99999 ? bestDays : null);
        return (
          <div key={status} className="mb-3">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{status}</span>
              {dl && <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${dl.cls}`}>{dl.text}</span>}
              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500 tabular-nums">{entries.length}</span>
            </div>
            {entries.map((entry, i) => (
              <StatusEntryCard key={i} entry={entry} lines={buildLines(entry)} />
            ))}
          </div>
        );
      })}
    </EmployeeGroup>
  );
}

function GroupedStatusLog({ groups, buildLines, getStatus, getDate }) {
  const [selected, setSelected] = useState("all");
  if (!groups?.length) return <Empty text="No updates recorded." />;
  const employeeList = groups.map((g) => ({ id: g.name, name: g.name, email: "" }));
  const visible = selected === "all" ? groups : groups.filter((g) => g.name === selected);
  return (
    <div>
      <EmployeeFilter employeeList={employeeList} selected={selected} onSelect={setSelected} />
      {visible.map((g) => (
        <StatusGroupedEmployee
          key={g.name}
          group={g}
          buildLines={buildLines}
          getStatus={getStatus}
          getDate={getDate}
        />
      ))}
    </div>
  );
}

function StatusTab({ data }) {
  const nn = (v) => v ?? null;
  const snapshotCols = [
    { key: "company", label: "Company", bold: true },
    { key: "enquiryStatus", label: "Enquiry Status" },
    { key: "sampleStatus", label: "Sample Status" },
    { key: "quotationStatus", label: "Quotation Status" },
    { key: "createdBy", label: "Created By" },
    { key: "updatedBy", label: "Last Updated By" },
  ];
  return (
    <div>
      <Section title="Prospect Status Log" icon={Ic.Building} accent="violet"
        count={data.prospectStatusLog.reduce((s, g) => s + g.entries.length, 0)}>
        <GroupedStatusLog
          groups={data.prospectStatusLog}
          getStatus={(e) => e.status}
          getDate={(e) => e.nextActionDate}
          buildLines={(e) => [
            { label: "Status", value: e.status, strong: true },
            nn(e.nextAction) && { label: "Next Action", value: e.nextAction },
            nn(e.nextActionDate) && { label: "Action Date", value: `${e.nextActionDate}${e.nextActionTime ? ` at ${e.nextActionTime}` : ""}` },
            !e.nextActionDate && nn(e.nextActionTime) && { label: "Action Time", value: e.nextActionTime },
            nn(e.remark) && { label: "Remark", value: e.remark },
          ].filter(Boolean)}
        />
      </Section>

      <Section title="Enquiry Status Log" icon={Ic.Msg} accent="amber" defaultOpen={false}
        count={data.enquiryStatusLog.reduce((s, g) => s + g.entries.length, 0)}>
        <GroupedStatusLog
          groups={data.enquiryStatusLog}
          getStatus={(e) => e.status || e.enquiryStatus}
          getDate={(e) => e.nextActionDate}
          buildLines={(e) => [
            { label: "Status", value: e.status, strong: true },
            nn(e.enquiryStatus) && { label: "Enquiry Result", value: e.enquiryStatus },
            nn(e.contactType) && { label: "Contact Type", value: e.contactType },
            nn(e.nextActionDate) && { label: "Action Date", value: `${e.nextActionDate}${e.nextActionTime ? ` at ${e.nextActionTime}` : ""}` },
            !e.nextActionDate && nn(e.nextActionTime) && { label: "Action Time", value: e.nextActionTime },
            nn(e.note) && { label: "Note", value: e.note },
          ].filter(Boolean)}
        />
      </Section>

      <Section title="Sample Status Log" icon={Ic.Flask} accent="rose" defaultOpen={false}
        count={data.sampleStatusLog.reduce((s, g) => s + g.entries.length, 0)}>
        <GroupedStatusLog
          groups={data.sampleStatusLog}
          getStatus={(e) => e.stage}
          getDate={(e) => e.followUp?.split(" at ")[0] || null}
          buildLines={(e) => [
            { label: "Stage", value: e.stage, strong: true },
            { label: "Result", value: e.result },
            { label: "Priority", value: e.priority },
            nn(e.notes) && { label: "Notes", value: e.notes },
            nn(e.followUp) && { label: "Next Follow-up", value: e.followUp },
          ].filter(Boolean)}
        />
      </Section>

      <Section title="Quotation Status Log" icon={Ic.File} accent="emerald" defaultOpen={false}
        count={data.quotationStatusLog.reduce((s, g) => s + g.entries.length, 0)}>
        <GroupedStatusLog
          groups={data.quotationStatusLog}
          getStatus={(e) => e.stage}
          getDate={(e) => e.followUp?.split(" at ")[0] || null}
          buildLines={(e) => [
            { label: "Stage", value: e.stage, strong: true },
            { label: "Result", value: e.result },
            { label: "Priority", value: e.priority },
            nn(e.notes) && { label: "Notes", value: e.notes },
            nn(e.followUp) && { label: "Next Follow-up", value: e.followUp },
          ].filter(Boolean)}
        />
      </Section>

      <Section title="Current Status Snapshot" icon={Ic.Activity} accent="indigo" count={data.currentStatusTable.length}>
        <DataTable columns={snapshotCols} rows={data.currentStatusTable} />
      </Section>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   TAB: PAYMENTS / BILL DUES
══════════════════════════════════════════════════════════════════ */
function BillsTab({ data }) {
  const lifetimeCols = [
    { key: "name", label: "Employee", bold: true },
    { key: "billsAdded", label: "Bills Added" },
    { key: "totalCollected", label: "Total Collected", bold: true, render: (r) => fmtINR(r.totalCollected) },
  ];
  const snapshotCols = [
    { key: "party", label: "Party", bold: true },
    { key: "billNo", label: "Bill No" },
    { key: "billDate", label: "Bill Date" },
    { key: "location", label: "Location" },
    { key: "balance", label: "Balance", bold: true },
    { key: "due", label: "Due" },
    { key: "nextFollowup", label: "Next Follow-up" },
    { key: "updatedBy", label: "Updated By" },
  ];
  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
        <StatCard label="Outstanding balance" value={fmtINR(data.totalOutstanding)} Icon={Ic.Rupee} tone="rose" />
        <StatCard label="Collected (all-time)" value={fmtINR(data.totalCollectedAllTime)} Icon={Ic.Rupee} tone="emerald" />
        <StatCard label="Bill actions today" value={data.totalActionsToday} Icon={Ic.Activity} tone="indigo" />
        <StatCard label="Remaining bills" value={data.remainingCount} Icon={Ic.File} tone="amber" />
        <StatCard label="Overdue bills" value={data.overdueCount} Icon={Ic.Alert} tone="rose" />
        <StatCard label="Due today" value={data.dueTodayCount} Icon={Ic.Clock} tone="teal" />
      </div>

      <Section title="Today's Bill Activity" icon={Ic.Activity} accent="teal"
        count={data.todayActivity.reduce((s, e) => s + e.entries.length, 0)}>
        {!data.todayActivity.length ? <Empty text="No bill activity yet today." /> : (
          data.todayActivity.map((emp, i) => (
            <EmployeeGroup key={emp.email} name={emp.name} email={emp.email}
              meta={`${emp.entries.length} action(s)`} defaultOpen={i === 0}>
              {emp.entries.map((entry, idx) => (
                <ActivityEntry key={`${entry.timestamp}-${idx}`} entry={entry} idleGap={false} showTypeBadge={false} />
              ))}
            </EmployeeGroup>
          ))
        )}
      </Section>

      <Section title="Lifetime Collection Summary" icon={Ic.Users} accent="indigo" count={data.lifetimeSummary.length}>
        <DataTable columns={lifetimeCols} rows={data.lifetimeSummary} />
      </Section>

      <Section title="Outstanding Bills Snapshot" icon={Ic.File} accent="rose"
        count={data.outstandingSnapshot.length} subtitle="most overdue first">
        <p className="text-[10px] text-slate-400 mb-2 italic">Red-tinted row = overdue (past bill date, unpaid).</p>
        <DataTable
          columns={snapshotCols}
          rows={data.outstandingSnapshot}
          rowClass={(row, i) => row.daysOutstanding > 0 ? "bg-red-50" : i % 2 ? "bg-slate-50" : "bg-white"}
        />
      </Section>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════════ */
const TABS = [
  { id: "overview", label: "Overview",   section: "overview", Icon: Ic.Activity },
  { id: "today",    label: "Today",      section: "today",    Icon: Ic.Clock    },
  { id: "lifetime", label: "All-time",   section: "lifetime", Icon: Ic.Users    },
  { id: "status",   label: "Statuses",   section: "status",   Icon: Ic.Tag      },
  { id: "bills",    label: "Payments",   section: "bills",    Icon: Ic.Rupee    },
];

export default function ReportsPage() {
  const { token } = useAuth();
  const [activeTab, setActiveTab]   = useState("overview");
  const [cache, setCache]           = useState({});
  const [loadingTab, setLoadingTab] = useState(null);
  const [error, setError]           = useState("");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const abortRef = useRef(null);

  const fetchSection = useCallback(async (section, { force = false } = {}) => {
    if (!token) return;
    if (!force && cache[section]) return;
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    setLoadingTab(section);
    setError("");
    try {
      const res  = await window.fetch(`${API}/api/reports/live?section=${section}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: abortRef.current.signal,
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to load");
      const value = json.data[section] ?? json.data;
      setCache((prev) => ({
        ...prev,
        [section]: { data: value, fetchedAt: json.data.generatedAt || new Date().toISOString() },
      }));
    } catch (e) {
      if (e.name === "AbortError") return;
      setError(e.message);
    } finally {
      setLoadingTab(null);
    }
  }, [cache, token]);

  useEffect(() => {
    const tab = TABS.find((t) => t.id === activeTab);
    if (tab && token) fetchSection(tab.section);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, token]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => {
      const tab = TABS.find((t) => t.id === activeTab);
      if (tab) fetchSection(tab.section, { force: true });
    }, AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, [autoRefresh, activeTab, fetchSection]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const currentSection = TABS.find((t) => t.id === activeTab)?.section;
  const current        = cache[currentSection];
  const isLoading      = loadingTab === currentSection && !current;
  const isRefreshing   = loadingTab === currentSection && !!current;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* sticky header */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-sm">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 pt-3 pb-0">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-white">
                  <Ic.Activity className="h-2.5 w-2.5" /> Admin · Live Reports
                </span>
              </div>
              <h1 className="text-[17px] sm:text-[19px] font-black text-slate-900 tracking-tight">Activity Report</h1>
              {current?.fetchedAt && (
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Updated {relTime(current.fetchedAt)} · {fmtDateTime(current.fetchedAt)}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <label className="hidden sm:flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 cursor-pointer select-none">
                <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                Auto (5 min)
              </label>
              <button
                onClick={() => currentSection && fetchSection(currentSection, { force: true })}
                disabled={!!loadingTab}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                <Ic.Refresh className={`h-3.5 w-3.5 ${loadingTab ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>

          {/* tab bar — horizontally scrollable on mobile */}
          <nav className="flex gap-0.5 overflow-x-auto -mb-px scrollbar-none">
            {TABS.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={[
                    "flex items-center gap-1.5 px-3 sm:px-3.5 py-2.5 text-[11px] sm:text-[12px] font-semibold border-b-2 whitespace-nowrap transition-all duration-150 flex-shrink-0",
                    active ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300",
                  ].join(" ")}>
                  <tab.Icon className="h-3.5 w-3.5 flex-shrink-0" />
                  {tab.label}
                  {loadingTab === tab.section && <Ic.Spin className="h-3 w-3 animate-spin text-slate-400" />}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* content area */}
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-4">
        {isRefreshing && (
          <div className="flex items-center gap-2 text-[11px] text-slate-400 mb-3">
            <Ic.Spin className="h-3 w-3 animate-spin" /> Refreshing…
          </div>
        )}
        {error && (
          <ErrorBox message={error} onRetry={() => currentSection && fetchSection(currentSection, { force: true })} />
        )}
        {isLoading && <LoadingSpinner text="Building report from live data…" />}
        {!isLoading && !error && current && (
          <>
            {activeTab === "overview" && <OverviewTab data={current.data} />}
            {activeTab === "today"    && <TodayTab    data={current.data} />}
            {activeTab === "lifetime" && <LifetimeTab data={current.data} />}
            {activeTab === "status"   && <StatusTab   data={current.data} />}
            {activeTab === "bills"    && <BillsTab    data={current.data} />}
          </>
        )}
      </div>
    </div>
  );
}