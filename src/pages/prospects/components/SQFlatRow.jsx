import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cls } from "../ui/primitives";
import { Ic } from "../icons";
import CustomSelect from "../../components/CustomSelect";
import PurgeButton from "../../components/PurgeButton";
import {
  dueCls, dueLabel, relTime, todayStr,
} from "../utils";
import {
  SAMPLE_STAGE_OPTIONS, SAMPLE_RESULT_OPTIONS,
  QUOTATION_STAGE_OPTIONS, QUOTATION_RESULT_OPTIONS,
  PRIORITY_OPTIONS,
} from "../constants";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

// Display name from a creator/updater user object, falling back to email.
function personLabel(p) {
  if (!p) return null;
  const name = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
  return name || p.email || null;
}

/* ─── shared lookup tables (same as SQListRow) ─────────────── */
const STAGE_CLS = {
  "Provided by buyer":          "bg-sky-50 text-sky-700 ring-sky-200",
  "Submitted to office":        "bg-blue-50 text-blue-700 ring-blue-200",
  "Submitted to supplier":      "bg-violet-50 text-violet-700 ring-violet-200",
  "Sample under development":   "bg-amber-50 text-amber-700 ring-amber-200",
  "Received from supplier":     "bg-teal-50 text-teal-700 ring-teal-200",
  "Sample submitted to client": "bg-emerald-50 text-emerald-700 ring-emerald-200",
  "Quotation Submitted":        "bg-violet-50 text-violet-700 ring-violet-200",
  "Quotation to be Negotiated": "bg-amber-50 text-amber-700 ring-amber-200",
  "Approved":                   "bg-emerald-50 text-emerald-700 ring-emerald-200",
  "Rejected":                   "bg-rose-50 text-rose-700 ring-rose-200",
};
const RESULT_CLS = {
  "Trial conducted":             "text-sky-600",
  "Under trial":                 "text-amber-600",
  "Approved":                    "text-emerald-600",
  "Approved with minor changes": "text-teal-600",
  "Rework required":             "text-orange-600",
  "Rejected":                    "text-rose-600",
  "Price accepted":              "text-emerald-600",
  "Price neg. ongoing":          "text-amber-600",
  "Under review":                "text-sky-600",
};
const PRIORITY_COLOR = {
  High:   { stripe: "bg-rose-400",  badge: "bg-rose-100 text-rose-600",   btn: "bg-rose-500  border-rose-500  shadow-rose-200"  },
  Medium: { stripe: "bg-amber-400", badge: "bg-amber-100 text-amber-600", btn: "bg-amber-400 border-amber-400 shadow-amber-200" },
  Low:    { stripe: "bg-slate-300", badge: "bg-slate-100 text-slate-500", btn: "bg-slate-500 border-slate-500"                   },
};

/* ─── expanded panel — exact clone of SQListRow's panel ────── */
function SQLPanel({ rfq, isSample, token, onUpdated, user }) {
  const sample    = (rfq.samples    || [])[0];
  const quotation = (rfq.quotations || [])[0];
  const activeRecord  = isSample ? sample : quotation;
  const stageOptions  = isSample ? SAMPLE_STAGE_OPTIONS  : QUOTATION_STAGE_OPTIONS;
  const resultOptions = isSample ? SAMPLE_RESULT_OPTIONS : QUOTATION_RESULT_OPTIONS;
  const endpoint      = isSample ? `${API}/api/samples/${sample?.id}` : `${API}/api/quotations/${quotation?.id}`;
  const bodyKey       = isSample ? "sample_status" : "quotation_status";

  const [historyOpen,  setHistoryOpen] = useState(false);
  const [history,      setHistory]     = useState(null);
  const [loadingHist,  setLoadingHist] = useState(false);
  const [stage,        setStage]       = useState("");
  const [result,       setResult]      = useState("");
  const [priority,     setPriority]    = useState("");
  const [description,  setDescription] = useState("");
  const [rejectReason, setRejectReason]= useState("");
  const [fuDate,       setFuDate]      = useState("");
  const [fuTime,       setFuTime]      = useState("");
  const [notes,        setNotes]       = useState("");
  const [saving,       setSaving]      = useState(false);
  const [saved,        setSaved]       = useState(false);
  const [err,          setErr]         = useState("");
  const [errors,       setErrors]      = useState({});

  const needsDescription  = result === "Approved with minor changes";
  const needsRejectReason = result === "Rejected";

  const currentStage    = activeRecord?.[bodyKey]      || null;
  const currentResult   = activeRecord?.result         || null;
  const currentPriority = activeRecord?.priority       || null;
  const currentFuDate   = activeRecord?.follow_up_date || null;
  const currentFuTime   = activeRecord?.follow_up_time || null;
  const currentNotes    = activeRecord?.notes          || null;

  const creatorName = personLabel(activeRecord?.creator);
  const updaterName = personLabel(activeRecord?.updater);
  const showUpdater = updaterName && updaterName !== creatorName;

  const contactName  = rfq._leadItem?.primary_contact_name || "";
  const contactPhone = rfq._leadItem?.primary_phone        || "";
  const contactEmail = rfq._leadItem?.primary_email        || "";
  const city         = rfq._leadItem?.city                 || "";

  async function fetchHistory() {
    if (history !== null) return;
    setLoadingHist(true);
    try {
      const url  = isSample
        ? `${API}/api/samples/${sample?.id}/logs`
        : `${API}/api/quotations/${quotation?.id}/logs`;
      const res  = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setHistory(data.logs || []);
    } catch { setHistory([]); }
    finally { setLoadingHist(false); }
  }

  function toggleHistory() { if (!historyOpen) fetchHistory(); setHistoryOpen(v => !v); }

  function validate() {
    const e = {};
    if (!stage)    e.stage    = "Required";
    if (!result)   e.result   = "Required";
    if (!priority) e.priority = "Required";
    if (needsDescription  && !description.trim())  e.description  = "Describe the changes";
    if (needsRejectReason && !rejectReason.trim())  e.rejectReason = "Provide a reason";
    return e;
  }

  function resetForm() {
    setStage(""); setResult(""); setPriority("");
    setDescription(""); setRejectReason("");
    setFuDate(""); setFuTime(""); setNotes("");
    setErrors({}); setErr("");
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!activeRecord?.id) { setErr("No record found"); return; }
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true); setErr("");
    try {
      const res = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          [bodyKey]: stage, result: result || null, priority: priority || null,
          description: description || null, reject_reason: rejectReason || null,
          notes: notes || null, follow_up_date: fuDate || null, follow_up_time: fuTime || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed");
      setSaved(true);
      setHistory(null);
      onUpdated && onUpdated(rfq.id, isSample ? "sample" : "quotation", data);
      setTimeout(() => { setSaved(false); resetForm(); }, 900);
    } catch (ex) { setErr(ex.message); setSaving(false); }
  }

  const hasStatus = currentStage || currentResult || currentPriority || currentFuDate || currentNotes;

  return (
    <div className="border-t border-slate-100 bg-slate-50/30">
      {/* Record ID + permanent delete */}
      {activeRecord?.id && (
        <div className="mx-3 mt-2 flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-slate-100/80 border border-slate-200">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[8px] font-bold uppercase tracking-widest text-slate-400 shrink-0">
              {isSample ? "Sample ID" : "Quotation ID"}
            </span>
            <span className="font-mono text-[9px] text-slate-500 select-all truncate">{isSample ? activeRecord.sample_code : activeRecord.quotation_code}</span>
          </div>
          <PurgeButton
            user={user}
            token={token}
            endpoint={isSample ? `${API}/api/purge/samples/${activeRecord.id}` : `${API}/api/purge/quotations/${activeRecord.id}`}
            itemLabel={isSample ? "sample" : "quotation"}
            size="sm"
            onDeleted={() => onUpdated && onUpdated(rfq.id, isSample ? "sample-deleted" : "quotation-deleted", null)}
          />
        </div>
      )}

      {/* Created by / last updated by — who on the team owns this record right now */}
      {(creatorName || showUpdater) && (
        <div className="mx-3 mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200">
          <Ic.User className="h-3 w-3 text-slate-400 shrink-0" />
          {creatorName && (
            <span className="text-[10px] text-slate-500">
              Created by <span className="font-semibold text-slate-700">{creatorName}</span>
            </span>
          )}
          {showUpdater && (
            <span className="text-[10px] text-slate-500">
              <span className="text-slate-300 mx-1">·</span>
              Last updated by <span className="font-semibold text-slate-700">{updaterName}</span>
            </span>
          )}
        </div>
      )}

      {/* Current status card */}
      {hasStatus && (
        <div className="mx-3 mt-3 rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-100">
            <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-slate-400">
              <Ic.Clipboard className="h-2.5 w-2.5"/>Current Status
            </span>
            {currentFuDate && (
              <div className="flex items-center gap-1">
                <Ic.Cal className="h-2.5 w-2.5 text-slate-400"/>
                <span className={cls("text-[10px] font-bold", dueCls(currentFuDate))}>{dueLabel(currentFuDate)}</span>
                {currentFuTime && <span className="text-[9px] text-slate-400 font-medium">· {currentFuTime}</span>}
              </div>
            )}
          </div>
          {currentStage && (
            <div className="px-3 pt-2 pb-1.5 border-b border-slate-50">
              <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400">Stage</p>
              <span className="text-[10px] font-semibold leading-tight block text-purple-600">{currentStage}</span>
            </div>
          )}
          {(currentResult || currentPriority) && (
            <div className={cls("grid gap-0 border-b border-slate-50", currentResult && currentPriority ? "grid-cols-2" : "grid-cols-1")}>
              {currentResult && (
                <div className={cls("px-3 py-2", currentPriority ? "border-r border-slate-50" : "")}>
                  <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Result</p>
                  <span className={cls("text-[10px] font-semibold leading-tight block", RESULT_CLS[currentResult] || "text-slate-600")}>{currentResult}</span>
                </div>
              )}
              {currentPriority && (
                <div className="px-3 py-2">
                  <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400">Priority</p>
                  <span className={cls("text-[10px] font-semibold leading-tight block",
                    currentPriority === "High" ? "text-rose-600" : currentPriority === "Medium" ? "text-amber-600" : "text-slate-500")}>{currentPriority}</span>
                </div>
              )}
            </div>
          )}
          {currentNotes && (
            <div className="px-3 py-2">
              <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Notes</p>
              <p className="text-[10px] text-slate-500 leading-snug">{currentNotes}</p>
            </div>
          )}
        </div>
      )}

      {/* Product + Client */}
      <div className="mx-3 mt-2 rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border-b border-slate-100">
          <Ic.Package className="h-2.5 w-2.5 text-slate-400"/>
          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Product & Client</span>
        </div>
        {(rfq.product_name || rfq.product_category) && (
          <div className="px-3 pt-2 pb-1.5 border-b border-slate-50">
            <p className="text-[12px] font-bold text-slate-800 leading-snug">{rfq.product_name || rfq.product_category}</p>
            {rfq.product_name && rfq.product_category && (
              <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                {rfq.product_category}
                {rfq.product_sub_category && <span className="text-slate-300"> · {rfq.product_sub_category}</span>}
              </p>
            )}
          </div>
        )}
        {rfq.product_description && (
          <div className="px-3 pt-1.5 pb-2 border-b border-slate-50">
            <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Description</p>
            <p className="text-[10px] text-slate-500 leading-snug">{rfq.product_description}</p>
          </div>
        )}
        {(rfq.consumption_per_month || rfq.target_price) && (
          <div className={cls("grid border-b border-slate-50", rfq.consumption_per_month && rfq.target_price ? "grid-cols-2" : "grid-cols-1")}>
            {rfq.consumption_per_month && (
              <div className={cls("px-3 py-2", rfq.target_price ? "border-r border-slate-50" : "")}>
                <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Qty / Month</p>
                <p className="text-[11px] font-semibold text-slate-700">
                  {rfq.consumption_per_month}{rfq.unit && <span className="text-[9px] font-normal text-slate-400 ml-0.5">{rfq.unit}</span>}
                </p>
              </div>
            )}
            {rfq.target_price && (
              <div className="px-3 py-2">
                <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Target Price</p>
                <p className="text-[11px] font-semibold text-slate-700">₹{rfq.target_price}</p>
              </div>
            )}
          </div>
        )}
        {(contactName || contactPhone || contactEmail || city) && (
          <div className="px-3 py-2 bg-slate-50/50">
            <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Client</p>
            <div className="flex items-center gap-3 flex-wrap">
              {contactName  && <div className="flex items-center gap-1.5"><Ic.User className="h-2.5 w-2.5 text-slate-400 shrink-0"/><span className="text-[10px] font-semibold text-slate-700 truncate">{contactName}</span></div>}
              {contactPhone && <div className="flex items-center gap-1"><Ic.Phone className="h-2.5 w-2.5 text-slate-400 shrink-0"/><span className="text-[10px] text-slate-600 font-mono">{contactPhone}</span></div>}
              {!contactPhone && contactEmail && <div className="flex items-center gap-1"><Ic.Mail className="h-2.5 w-2.5 text-slate-400 shrink-0"/><span className="text-[10px] text-slate-600 truncate">{contactEmail}</span></div>}
              {city && <div className="flex items-center gap-1"><Ic.Pin className="h-2.5 w-2.5 text-slate-400 shrink-0"/><span className="text-[10px] text-slate-500">{city}</span></div>}
            </div>
          </div>
        )}
      </div>

      {/* Descriptions */}
      {isSample && rfq.sample_description && (
        <div className="mx-3 mt-2 rounded-xl border border-teal-100 bg-teal-50/50 px-3 py-2">
          <p className="text-[8px] font-bold uppercase tracking-widest text-teal-500 mb-0.5">Sample Desc.</p>
          <p className="text-[11px] text-teal-800 leading-snug">{rfq.sample_description}</p>
        </div>
      )}
      {!isSample && rfq.quotation_description && (
        <div className="mx-3 mt-2 rounded-xl border border-violet-100 bg-violet-50/50 px-3 py-2">
          <p className="text-[8px] font-bold uppercase tracking-widest text-violet-500 mb-0.5">Quotation Desc.</p>
          <p className="text-[11px] text-violet-800 leading-snug">{rfq.quotation_description}</p>
        </div>
      )}

      {/* Update history — visible to the whole team now, not just Admin,
          since teammates handing off the same record need to see what
          each other already did. */}
      <div className="mx-3 mt-2 rounded-xl border border-slate-200 overflow-hidden">
        <button type="button" onClick={toggleHistory}
          className="flex w-full items-center justify-between px-3 py-2 hover:bg-slate-50 transition-colors">
          <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-slate-400">
            <Ic.History className="h-3 w-3"/>Update History
            {history !== null && (
              <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[8px] font-bold normal-case tracking-normal">
                {history.length}
              </span>
            )}
          </span>
          <div className={cls("transition-transform duration-200", historyOpen ? "rotate-180" : "")}>
            <Ic.ChevD className="h-3 w-3 text-slate-400"/>
          </div>
        </button>
        <AnimatePresence initial={false}>
          {historyOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden">
              <div className="border-t border-slate-100 max-h-64 overflow-y-auto divide-y divide-slate-50">
                {loadingHist && (
                  <div className="flex items-center gap-2 px-3 py-3 text-[10px] text-slate-400">
                    <Ic.Spin className="h-3 w-3 animate-spin shrink-0"/>Loading…
                  </div>
                )}
                {!loadingHist && history?.length === 0 && (
                  <p className="px-3 py-3 text-[10px] text-slate-400 text-center">No updates yet.</p>
                )}
                {!loadingHist && history?.map((log, i) => {
                  const stg = log.sample_status || log.quotation_status;
                  const logUser = personLabel(log.users) || log.users?.email;
                  return (
                    <div key={log.id || i} className="px-3 py-2 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          {stg
                            ? <span className={cls("inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold ring-1 ring-inset truncate max-w-full", STAGE_CLS[stg] || "bg-slate-100 text-slate-600 ring-slate-200")}>{stg}</span>
                            : <span className="text-[9px] text-slate-300 italic">No stage</span>}
                        </div>
                        <div className="shrink-0">
                          {log.follow_up_date
                            ? <span className={cls("text-[9px] font-semibold whitespace-nowrap", dueCls(log.follow_up_date))}>{dueLabel(log.follow_up_date)}{log.follow_up_time && <span className="font-normal text-slate-400"> · {log.follow_up_time}</span>}</span>
                            : <span className="text-[9px] text-slate-300">—</span>}
                        </div>
                      </div>
                      {(log.result || log.priority) && (
                        <div className="flex items-center justify-between gap-2">
                          <span className={cls("text-[9px] font-semibold truncate", RESULT_CLS[log.result] || "text-slate-400")}>{log.result || "—"}</span>
                          {log.priority && (
                            <span className={cls("shrink-0 inline-flex items-center gap-0.5 text-[8px] font-bold",
                              log.priority === "High" ? "text-rose-500" : log.priority === "Medium" ? "text-amber-500" : "text-slate-400")}>
                              <span className={cls("h-1.5 w-1.5 rounded-full shrink-0",
                                log.priority === "High" ? "bg-rose-400" : log.priority === "Medium" ? "bg-amber-400" : "bg-slate-300")}/>
                              {log.priority}
                            </span>
                          )}
                        </div>
                      )}
                      {log.notes && <p className="text-[9px] text-slate-500 leading-snug bg-slate-50 rounded px-2 py-1">{log.notes}</p>}
                      <div className="flex items-center justify-between gap-2">
                        {logUser
                          ? <span className="text-[8px] text-slate-300 truncate flex items-center gap-0.5"><Ic.User className="h-2 w-2 shrink-0"/>{logUser}</span>
                          : <span/>}
                        <span className="text-[8px] text-slate-300 shrink-0 whitespace-nowrap">{relTime(log.updated_at)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Update form */}
      <form onSubmit={handleSave} className="mx-3 mt-2 mb-3 rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 border-b border-slate-100">
          <Ic.Zap className="h-3 w-3 text-amber-400 shrink-0"/>
          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">New Update</span>
        </div>
        <div className="p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="relative">
                  <CustomSelect
                    value={stage}
                    onChange={(val) => { setStage(val); setErrors(p => ({ ...p, stage: undefined })); }}
                    options={stageOptions}
                    placeholder="Stage…"
                    label="Stage"
                    error={errors.stage}
                  />
              </div>
              {errors.stage && <p className="mt-0.5 text-[9px] text-rose-500">{errors.stage}</p>}
            </div>
            <div>
              <div className="relative">
                  <CustomSelect
                    value={result}
                    onChange={(val) => { setResult(val); setErrors(p => ({ ...p, result: undefined, description: undefined, rejectReason: undefined })); }}
                    options={resultOptions}
                    placeholder="Result…"
                    label="Result"
                    error={errors.result}
                  />
              </div>
              {errors.result && <p className="mt-0.5 text-[9px] text-rose-500">{errors.result}</p>}
            </div>
          </div>

          <AnimatePresence initial={false}>
            {needsDescription && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden">
                <textarea value={description} onChange={e => { setDescription(e.target.value); setErrors(p => ({ ...p, description: undefined })); }}
                  placeholder="Describe minor changes required…" rows={2}
                  className={cls("w-full rounded-lg border px-2.5 py-2 text-[11px] text-slate-900 placeholder:text-slate-400 outline-none resize-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100",
                    errors.description ? "border-rose-400 ring-2 ring-rose-100" : "border-slate-200")}/>
                {errors.description && <p className="mt-0.5 text-[9px] text-rose-500">{errors.description}</p>}
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence initial={false}>
            {needsRejectReason && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden">
                <textarea value={rejectReason} onChange={e => { setRejectReason(e.target.value); setErrors(p => ({ ...p, rejectReason: undefined })); }}
                  placeholder="Reason for rejection…" rows={2}
                  className={cls("w-full rounded-lg border px-2.5 py-2 text-[11px] text-slate-900 placeholder:text-slate-400 outline-none resize-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100",
                    errors.rejectReason ? "border-rose-400 ring-2 ring-rose-100" : "border-slate-200")}/>
                {errors.rejectReason && <p className="mt-0.5 text-[9px] text-rose-500">{errors.rejectReason}</p>}
              </motion.div>
            )}
          </AnimatePresence>

          <div>
            <div className="flex gap-1.5">
              {PRIORITY_OPTIONS.map(p => (
                <button key={p} type="button"
                  onClick={() => { setPriority(p); setErrors(prev => ({ ...prev, priority: undefined })); }}
                  className={cls("flex-1 flex items-center justify-center gap-1 rounded-lg border py-1.5 text-[10px] font-bold transition-all active:scale-95",
                    priority === p
                      ? cls(PRIORITY_COLOR[p]?.btn, "text-white shadow-sm")
                      : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50")}>
                  <span className={cls("h-1.5 w-1.5 rounded-full shrink-0",
                    priority === p ? "bg-white/70" : p === "High" ? "bg-rose-400" : p === "Medium" ? "bg-amber-400" : "bg-slate-300")}/>
                  {p}
                </button>
              ))}
            </div>
            {errors.priority && <p className="mt-0.5 text-[9px] text-rose-500">{errors.priority}</p>}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400 mb-1">Follow-up</p>
              <input type="date" value={fuDate} onChange={e => setFuDate(e.target.value)} min={todayStr()}
                className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-[11px] text-slate-900 outline-none transition-all focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 hover:border-slate-300"/>
            </div>
            <div>
              <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400 mb-1">Time <span className="normal-case font-normal text-slate-300">(opt)</span></p>
              <input type="time" value={fuTime} onChange={e => setFuTime(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-[11px] text-slate-900 outline-none transition-all focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 hover:border-slate-300"/>
            </div>
          </div>

          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Internal notes… (optional)" rows={2}
            className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-[11px] text-slate-900 placeholder:text-slate-400 outline-none resize-none transition-all focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 hover:border-slate-300"/>

          {err && <p className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[10px] text-rose-700">{err}</p>}

          <button type="submit" disabled={saving}
            className={cls("w-full inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-[12px] font-bold transition-all active:scale-[0.98] disabled:opacity-60",
              saved ? "bg-emerald-500 text-white" : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm shadow-indigo-200")}>
            {saving ? <><Ic.Spin className="h-3.5 w-3.5 animate-spin"/>Saving…</>
             : saved  ? <><Ic.Check className="h-3.5 w-3.5"/>Saved!</>
             : <><Ic.Zap className="h-3.5 w-3.5"/>Save Update</>}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ─── SQFlatRow — one independent row per rfq+type ─────────── */
export default function SQFlatRow({ rfq, isSample, token, onUpdated, user }) {
  const record          = isSample ? (rfq.samples || [])[0] : (rfq.quotations || [])[0];
  const currentFuDate   = record?.follow_up_date || null;
  const currentFuTime   = record?.follow_up_time || null;
  const currentPriority = record?.priority       || null;

  const [open, setOpen] = useState(false);

  const companyName = rfq._leadItem?.company_name || "—";
  const initials    = companyName.slice(0, 2).toUpperCase();
  const overdue     = currentFuDate && new Date(currentFuDate) < (() => { const d = new Date(); d.setHours(0,0,0,0); return d; })();
  const stripeColor = PRIORITY_COLOR[currentPriority]?.stripe || "bg-slate-200";

  const rowCreatorName = personLabel(record?.creator);
  const rowUpdaterName = personLabel(record?.updater);
  const rowShowUpdater = rowUpdaterName && rowUpdaterName !== rowCreatorName;

  return (
    <div className="border-b border-slate-100 last:border-0 bg-white">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="flex w-full items-stretch text-left transition-colors hover:bg-slate-50/80 active:bg-slate-100">

        {/* Avatar */}
        <div className="flex items-center pl-3 pr-0 py-3 shrink-0">
          <div className="relative">
            <div className={cls(
              "flex h-10 w-10 items-center justify-center rounded-full text-white text-[12px] font-bold shadow-sm",
              isSample
                ? "bg-gradient-to-br from-rose-500 to-pink-600"
                : "bg-gradient-to-br from-orange-400 to-amber-500"
            )}>
              {initials}
            </div>
            <span className={cls(
              "absolute -bottom-0.5 -right-0.5 flex h-[15px] w-[15px] items-center justify-center rounded-full border-2 border-white text-[7px] font-extrabold text-white",
              isSample ? "bg-rose-500" : "bg-orange-500"
            )}>
              {isSample ? "S" : "Q"}
            </span>
            {overdue && (
              <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-rose-500"/>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 items-center gap-2 px-3 py-3 min-w-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-1.5 min-w-0">
              <span className="truncate text-[14px] font-bold text-slate-900 leading-snug">
                {companyName}
              </span>
              <span className={cls(
                "shrink-0 text-[10px] font-semibold",
                isSample ? "text-rose-500" : "text-orange-500"
              )}>
                {isSample ? "Sample" : "Quotation"}
              </span>
              {currentPriority && (
                <span className={cls("shrink-0 text-[8px] font-bold px-1.5 py-0.5 rounded-full leading-none", PRIORITY_COLOR[currentPriority]?.badge)}>
                  {currentPriority}
                </span>
              )}
            </div>
            <span className="block truncate text-[12px] text-slate-500 mt-0.5 leading-tight">
              {rfq.product_name || rfq.product_category || "Enquiry"}
            </span>
            {(rfq.consumption_per_month || rfq.target_price) && (
              <div className="flex items-center gap-2 mt-0.5">
                {rfq.consumption_per_month && (
                  <span className="inline-flex items-center gap-0.5 text-[11px] text-slate-400">
                    <Ic.Package className="h-2.5 w-2.5"/>
                    {rfq.consumption_per_month}{rfq.unit ? ` ${rfq.unit}` : ""}/mo
                  </span>
                )}
                {rfq.target_price && (
                  <span className="text-[11px] font-semibold text-slate-400">₹{rfq.target_price}</span>
                )}
              </div>
            )}
            {(rowCreatorName || rowShowUpdater) && (
              <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                {rowCreatorName && (
                  <span className="text-[10px] text-slate-400">
                    By <span className="font-semibold text-slate-500">{rowCreatorName}</span>
                  </span>
                )}
                {rowShowUpdater && (
                  <span className="text-[10px] text-slate-400">
                    · Updated <span className="font-semibold text-slate-500">{rowUpdaterName}</span>
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="shrink-0 flex flex-col items-end gap-0.5 ml-1">
            {currentFuDate ? (
              <>
                <span className={cls("text-[11px] font-semibold leading-tight", dueCls(currentFuDate))}>
                  {dueLabel(currentFuDate)}
                </span>
                {currentFuTime && (
                  <span className="text-[10px] text-slate-400 leading-tight">{currentFuTime}</span>
                )}
              </>
            ) : (
              <span className="text-[10px] text-slate-300 font-medium">No date</span>
            )}
            <div className={cls("mt-1 transition-transform duration-200", open ? "rotate-180" : "")}>
              <Ic.ChevD className="h-3.5 w-3.5 text-slate-400"/>
            </div>
          </div>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <SQLPanel rfq={rfq} isSample={isSample} token={token} onUpdated={onUpdated} user={user} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}