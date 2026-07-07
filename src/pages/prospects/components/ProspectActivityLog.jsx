import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { fmtDT, relTime } from "../utils";
import { Ic } from "../icons";
import { cls } from "../ui/primitives";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

// Matches DIFF_FIELDS.lead_logs on the backend (dailyReport.service.js) —
// keep these two lists in sync if you add/remove a tracked field.
const LOG_FIELD_LABELS = {
  company_name: "Company",
  country: "Country", state: "State", city: "City", zone: "Zone", route: "Route",
  primary_contact_name: "Contact", primary_designation: "Designation",
  primary_phone: "Phone", primary_email: "Email",
  secondary_contact_name: "Secondary Contact", secondary_designation: "Secondary Designation",
  secondary_phone: "Secondary Phone", secondary_email: "Secondary Email",
  nature_of_business: "Nature of Business", manufacturing_industry: "Industry",
  company_website: "Website", gst_number: "GST Number", linkedin_profile: "LinkedIn",
  potential_product_category: "Product Category", potential_product_sub_category: "Product Sub-Category",
  potential_product_name: "Product Name",
  source: "Source", next_action: "Next Action", next_action_date: "Next Action Date",
  feedback: "Notes/Remark", status: "Status",
};

function diffSnapshots(prev, curr) {
  const changes = [];
  for (const [field, label] of Object.entries(LOG_FIELD_LABELS)) {
    const a = prev ? (prev[field] ?? null) : null;
    const b = curr[field] ?? null;
    const norm = v => (v === null || v === undefined || v === "" ? null : String(v));
    if (norm(a) !== norm(b)) changes.push({ field, label, from: a, to: b });
  }
  return changes;
}

function personLabel(u) {
  if (!u) return "Unknown";
  const name = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
  return name || u.email || "Unknown";
}

const ACTION_DOT   = { created: "bg-emerald-500", updated: "bg-amber-400", deleted: "bg-rose-500", migrated: "bg-violet-500" };
const ACTION_BADGE = {
  created: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  updated: "bg-amber-50 text-amber-700 ring-amber-200",
  deleted: "bg-rose-50 text-rose-700 ring-rose-200",
  migrated: "bg-violet-50 text-violet-700 ring-violet-200",
};

// Normalizes "migrated_created" → base action "created" (for dot/badge
// color and diff behavior) while keeping the full label ("Migrated") for
// display, so backfilled prospect history renders sensibly instead of
// falling through to the generic "updated" styling.
function classifyAction(rawAction) {
  const action = rawAction || "updated";
  if (action.startsWith("migrated_")) {
    return { base: action.replace("migrated_", ""), display: "migrated" };
  }
  return { base: action, display: action };
}

function LogEventRow({ event }) {
  const [expanded, setExpanded] = useState(false);
  const { display, ts, by, diffs } = event;
  const badge = ACTION_BADGE[display] || ACTION_BADGE.updated;
  const dot   = ACTION_DOT[display]   || ACTION_DOT.updated;

  const statusChange = diffs.find(d => d.field === "status");
  const remarkChange = diffs.find(d => d.field === "feedback");
  const actionChange = diffs.find(d => d.field === "next_action");
  const previewDiff  = statusChange || actionChange || remarkChange || diffs[0];

  return (
    <div className="px-4 py-2.5">
      <div className="flex items-start gap-2.5">
        <div className="mt-1.5 flex-shrink-0">
          <div className={cls("h-2 w-2 rounded-full", dot)}/>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <span className={cls("rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase ring-1 ring-inset", badge)}>{display}</span>
            <span className="text-[11px] font-medium text-slate-600 truncate max-w-[120px]">{by}</span>
            <span className="text-[11px] text-slate-400">·</span>
            <span className="text-[11px] text-slate-400" title={fmtDT(ts)}>{relTime(ts)}</span>
            {ts && <span className="hidden sm:inline text-[10px] text-slate-300">{fmtDT(ts)}</span>}
          </div>

          {previewDiff && !expanded && (
            <p className="text-[11px] text-slate-500 leading-snug">
              <span className="font-medium text-slate-600">{previewDiff.label}:</span>{" "}
              {previewDiff.from !== null && previewDiff.from !== "" && (
                <><span className="line-through text-slate-400 mr-1">{String(previewDiff.from).slice(0, 40)}{String(previewDiff.from).length > 40 ? "…" : ""}</span>→{" "}</>
              )}
              <span className="text-slate-700">
                {previewDiff.to !== null && previewDiff.to !== ""
                  ? String(previewDiff.to).slice(0, 60) + (String(previewDiff.to).length > 60 ? "…" : "")
                  : <span className="italic text-slate-300">empty</span>}
              </span>
              {diffs.length > 1 && <span className="ml-1 text-[10px] text-slate-400">+{diffs.length - 1} more</span>}
            </p>
          )}

          {expanded && (
            <div className="mt-1.5 rounded-lg border border-slate-100 bg-slate-50/70 divide-y divide-slate-100">
              {diffs.map(({ field, label, from, to }) => (
                <div key={field} className="flex items-start gap-2 px-3 py-1.5">
                  <span className="w-28 flex-shrink-0 text-[10px] font-semibold text-slate-400 pt-0.5">{label}</span>
                  <div className="flex flex-wrap items-center gap-1 min-w-0">
                    {from !== null && from !== "" && (
                      <><span className="text-[11px] text-slate-400 line-through break-all">{String(from).slice(0, 80)}</span>
                      <span className="text-slate-300 text-[10px]">→</span></>
                    )}
                    <span className="text-[11px] text-slate-700 font-medium break-all">
                      {to !== null && to !== "" ? String(to).slice(0, 80) : <span className="italic text-slate-300">cleared</span>}
                    </span>
                  </div>
                </div>
              ))}
              {diffs.length === 0 && (
                <p className="px-3 py-2 text-[11px] text-slate-400 italic">No tracked fields changed on this event.</p>
              )}
            </div>
          )}

          <button type="button" onClick={() => setExpanded(v => !v)}
            className="mt-1 text-[10px] font-semibold text-indigo-500 hover:text-indigo-700">
            {expanded ? "Hide details" : diffs.length ? "Show all changes" : "Show details"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProspectActivityLog({ prospectId, token }) {
  const [logs, setLogs]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState("");
  const [open, setOpen]       = useState(false);
  const fetched               = useRef(false);

  async function fetchLogs() {
    if (fetched.current) return;
    fetched.current = true;
    setLoading(true); setErr("");
    try {
      const res  = await fetch(`${API}/api/leads/${prospectId}/logs`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed");
      const raw = data.logs || []; // already ascending (oldest → newest) from the backend
      const events = raw.map((log, i) => {
        const { base, display } = classifyAction(log.action);
        return {
          id: log.id,
          action: base,
          display,
          ts: log.changed_at,
          by: personLabel(log.changer),
          diffs: diffSnapshots(i > 0 ? raw[i - 1] : null, log),
        };
      }).reverse(); // newest first for display
      setLogs(events);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }

  function toggle() {
    if (!open && !fetched.current) fetchLogs();
    setOpen(v => !v);
  }

  return (
    <div className="mt-3 mb-3 rounded-xl border border-slate-200 overflow-hidden">
      <button type="button" onClick={toggle}
        className="flex w-full items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition-colors">
        <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-slate-500">
          <Ic.Activity className="h-3.5 w-3.5"/>Activity Log
        </span>
        <div className="flex items-center gap-2">
          {logs !== null && <span className="text-[10px] font-semibold text-slate-400">{logs.length} events</span>}
          {open ? <Ic.ChevU className="h-3.5 w-3.5 text-slate-400"/> : <Ic.ChevD className="h-3.5 w-3.5 text-slate-400"/>}
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="border-t border-slate-100">
              {loading && (
                <div className="flex items-center gap-2 px-4 py-4 text-[12px] text-slate-400">
                  <Ic.Spin className="h-3.5 w-3.5 animate-spin"/>Loading…
                </div>
              )}
              {err && <p className="px-4 py-3 text-[12px] text-rose-500">{err}</p>}
              {logs !== null && logs.length === 0 && (
                <p className="px-4 py-4 text-[12px] text-slate-400">No history recorded yet.</p>
              )}
              {logs !== null && logs.length > 0 && (
                <div className="divide-y divide-slate-50">
                  {logs.map((ev, idx) => (
                    <LogEventRow key={ev.id || idx} event={ev} isLast={idx === logs.length - 1}/>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}