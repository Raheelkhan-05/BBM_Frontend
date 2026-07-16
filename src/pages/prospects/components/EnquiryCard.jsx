import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ENQ_STATUS_CLS, UNITS } from "../constants";
import {
  isEnquiryClosed, latestFU, sortFupsByCreated, extractTimeFromNotes, cleanNotes,
  fmtD, dueCls, dueLabel,
} from "../utils";
import { missingForOrder } from "../utils";

import { isSqApproved, isSqClosed } from "../sqStatus";
import { Ic, contactCls, ContactIcon } from "../icons";
import { Tag, cls, FldInput, TArea, SelInput, Lbl } from "../ui/primitives";
import { AddFollowupModal, EditFollowupModal } from "./FollowupModals";
import { SQLPanel, STAGE_CLS, SQCombinedPanel } from "./SQFlatRow";
import MarkDeadModal from "../../components/MarkDeadModal";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

function fmtDateTime(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}
function personLabel(p) {
  if (!p) return null;
  const name = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
  return name || p.email || null;
}

function isEmptyVal(v) {
  return v === null || v === undefined || v === "";
}

// Every field a user might have skipped when the enquiry was first created.
// `showIf` restricts sample/quotation descriptions to enquiries that
// actually need a sample/quotation. Sample/Quotation "required" toggles
// themselves are intentionally NOT here — they're always true by default.
const EDITABLE_FIELD_DEFS = [
  { key: "product_category",     label: "Product Category",     type: "text",     placeholder: "e.g. Adhesives" },
  { key: "product_sub_category", label: "Product Sub-category", type: "text",     placeholder: "e.g. Epoxy" },
  { key: "product_name",         label: "Product Name",         type: "text",     placeholder: "e.g. XYZ-200" },
  { key: "product_description",  label: "Description",          type: "textarea", placeholder: "Grade, application, specs…" },
  { key: "consumption_per_month",label: "Qty / Month",          type: "number",   placeholder: "500" },
  { key: "unit",                 label: "Unit",                 type: "select",   options: UNITS },
  { key: "target_price",         label: "Target Price (₹)",     type: "number",   placeholder: "2500" },
  { key: "existing_supplier_brand", label: "Existing Supplier", type: "text",     placeholder: "Brand / competitor" },
  { key: "sample_description",   label: "Sample Description",    type: "textarea", placeholder: "Sample grade, quantity needed, packaging…", showIf: (r) => r.sample_required },
  { key: "quotation_description",label: "Quotation Description", type: "textarea", placeholder: "Pricing basis, volume tiers, delivery terms…", showIf: (r) => r.quotation_required },
];

export default function EnquiryCard({ rfq, token, canEdit, onUpdated, user, order, defaultExpanded = false, autoExpandSQ = false }) {
  const isOrder = !!order;
  const closed = isEnquiryClosed(rfq) || isOrder;
  const [collapsed, setCollapsed] = useState(!defaultExpanded && !autoExpandSQ);
  const [showLogs,    setShowLogs]    = useState(false);
  const [activity,    setActivity]    = useState(null);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [fullFups,    setFullFups]    = useState(null);
  const [loadingFups, setLoadingFups] = useState(false);
  const [showAddFup,  setShowAddFup]  = useState(false);
  const [editFup,     setEditFup]     = useState(null);
  const [deletingId,  setDeletingId]  = useState(null);
  const [converting, setConverting] = useState(false);

  const [showMarkDead, setShowMarkDead] = useState(false);
  const [deletingRFQ, setDeletingRFQ]   = useState(false);

  const canSuperDelete = user?.email === "communication@bbmpvtltd.com";

  // ── Fill-in-the-blanks editor — everything that was left empty when
  // the enquiry was first created, plus TDS (always editable). Sample /
  // Quotation "required" flags are NOT editable here — they default true.
  const missingFields = EDITABLE_FIELD_DEFS.filter(
    (f) => (!f.showIf || f.showIf(rfq)) && isEmptyVal(rfq[f.key])
  );

  const [editingToggles, setEditingToggles] = useState(false);
  const [editValues,     setEditValues]     = useState({});
  const [editTds,        setEditTds]        = useState(!!rfq.tds_available);
  const [savingToggles,  setSavingToggles]  = useState(false);
  const [toggleErr,      setToggleErr]      = useState("");

  function openEditToggles() {
    const init = {};
    missingFields.forEach((f) => { init[f.key] = ""; });
    setEditValues(init);
    setEditTds(!!rfq.tds_available);
    setToggleErr("");
    setEditingToggles(true);
  }

  function hEditField(key, value) {
    setToggleErr("");
    setEditValues((p) => ({ ...p, [key]: value }));
  }

  async function confirmMarkDead(reason) {
    const res = await fetch(`${API}/api/rfqs/${rfq.id}/mark-dead`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ dead_reason: reason }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || "Failed to mark dead");
    onUpdated && onUpdated("rfq-dead", rfq.id, data.rfq);
    setShowMarkDead(false);
  }

  async function handlePurgeRFQ() {
    const ok = window.confirm(
      `Permanently delete this enquiry — its follow-ups, sample, quotation, and ALL logs? This cannot be undone.`
    );
    if (!ok) return;
    setDeletingRFQ(true);
    try {
      const res = await fetch(`${API}/api/rfqs/${rfq.id}/purge`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to delete");
      onUpdated && onUpdated("purge", rfq.id, null);
    } catch (e) {
      alert(e.message);
    } finally {
      setDeletingRFQ(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    setLoadingActivity(true);
    fetch(`${API}/api/rfqs/${rfq.id}/activity`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (!cancelled) setActivity(d.activity || []); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingActivity(false); });
    return () => { cancelled = true; };
  }, [rfq.id, token]);

  // Saves TDS (always) + any of the previously-empty fields the user filled
  // in just now. Blank fields are simply skipped — this never overwrites
  // something that already has a value, and never clears anything.
  async function handleSaveToggles() {
    setSavingToggles(true);
    setToggleErr("");
    try {
      const payload = { tds_available: editTds };
      missingFields.forEach((f) => {
        const v = editValues[f.key];
        if (!isEmptyVal(v)) payload[f.key] = v;
      });

      const res = await fetch(`${API}/api/rfqs/${rfq.id}/details`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to update enquiry");
      onUpdated && onUpdated("toggles", rfq.id, data);
      setEditingToggles(false);
    } catch (e) {
      setToggleErr(e.message);
    } finally {
      setSavingToggles(false);
    }
  }

  const hasSample = !!rfq.sample_required;
  const hasQuote  = !!rfq.quotation_required;
  const sampleRec = (rfq.samples    || [])[0];
  const quoteRec  = (rfq.quotations || [])[0];
  const sampleClosed = isSqClosed(rfq, true);
  const quoteClosed  = isSqClosed(rfq, false);

  const [openPanel, setOpenPanel] = useState(autoExpandSQ ? "sq" : null);
  function togglePanel(which) {
    setOpenPanel(p => (p === which ? null : which));
  }

  const hasSampleOrQuote = (rfq.sample_required && (rfq.samples || []).length > 0) || (rfq.quotation_required && (rfq.quotations || []).length > 0);

  function toggleLogs() {
    setShowLogs(v => !v);
  }

  const allFups = (fullFups !== null ? fullFups : [...(rfq.rfq_followups || [])].filter(f => !f.deleted_at))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const latestFup  = allFups[0] || null;
  const olderFups  = allFups.slice(1);
  const status     = isOrder ? "Won" : (latestFup?.enquiry_status || "Open");
  const sample     = sampleRec;
  const quotation  = quoteRec;
  const cardTime   = extractTimeFromNotes(latestFup?.notes);

  const sqFuDate = (hasSample && !sampleClosed && sample?.follow_up_date)
    || (hasQuote && !quoteClosed && quotation?.follow_up_date)
    || null;
  const sqFuTime = (hasSample && !sampleClosed && sample?.follow_up_time)
    || (hasQuote && !quoteClosed && quotation?.follow_up_time)
    || null;

  const displayFuDate = hasSampleOrQuote ? sqFuDate : latestFup?.followup_date;
  const displayFuTime = hasSampleOrQuote ? sqFuTime : cardTime;

  function handleFupSaved(saved)  { setFullFups(p => [saved, ...(p || allFups)]); onUpdated("new",  rfq.id, saved); }
  function handleFupEdited(saved) { setFullFups(p => (p || allFups).map(f => f.id === saved.id ? saved : f)); onUpdated("edit", rfq.id, saved); }
  async function deleteFup(id) {
    if (!window.confirm("Delete this follow-up?")) return;
    setDeletingId(id);
    try {
      const r = await fetch(`${API}/api/rfqs/followups/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error("Delete failed");
      setFullFups(p => (p || allFups).filter(f => f.id !== id));
      onUpdated("deleteFup", rfq.id, id);
    } catch (e) { alert(e.message); }
    finally { setDeletingId(null); }
  }

  async function handleConvertToOrder() {
    const missing = missingForOrder(rfq._leadItem || rfq.leads || {}, rfq);
    if (missing.length) {
      alert(`Can't convert yet — missing:\n\n${missing.join("\n")}`);
      return;
    }
    const notYetApproved = [];
    if (hasSample && !isSqApproved(rfq, true))  notYetApproved.push("Sample");
    if (hasQuote  && !isSqApproved(rfq, false)) notYetApproved.push("Quotation");
    if (notYetApproved.length) {
      const ok = window.confirm(
        `${notYetApproved.join(" and ")} not yet Approved. Converting to an order will mark ${notYetApproved.length > 1 ? "them" : "it"} Approved automatically. Continue?`
      );
      if (!ok) return;
    }
    setConverting(true);
    try {
      const res = await fetch(`${API}/api/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ rfq_id: rfq.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to convert to order");
      onUpdated && onUpdated("order-created", rfq.id, data.order);
    } catch (e) {
      alert(e.message);
    } finally {
      setConverting(false);
    }
  }

  return (
    <div className={cls("rounded-xl border overflow-hidden mb-3 last:mb-0 transition-opacity", closed ? "border-slate-200 bg-white/70 opacity-75 hover:opacity-100" : "border-slate-200 bg-white")}>

      {/* Collapsed header */}
      <div
        onClick={() => setCollapsed(v => !v)}
        className={cls("w-full flex items-start gap-2 px-4 py-3 text-left transition-colors cursor-pointer", closed ? "bg-slate-50/60 hover:bg-slate-100/60" : "bg-indigo-50/40 hover:bg-indigo-50/70")}>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 flex-wrap min-w-0">
              {!rfq.is_dead && !isOrder && (
                <Tag className={cls(ENQ_STATUS_CLS[status] || "bg-slate-100 text-slate-500 ring-slate-200", "ring-1 ring-inset")}>
                  {closed && <Ic.Check className="mr-1 h-2.5 w-2.5"/>}{status}
                </Tag>
              )}
              {rfq.is_dead && (
                <Tag className="bg-slate-100 text-slate-500 ring-slate-200 ring-1 ring-inset">
                  <Ic.X className="mr-1 h-2.5 w-2.5"/>Dead
                </Tag>
              )}
              {rfq.is_dead && rfq.dead_reason && (
                <p className="px-4 py-2 text-[11px] text-slate-500 bg-slate-50 border-t border-slate-100">
                  <span className="font-semibold text-slate-600">Dead reason:</span> {rfq.dead_reason}
                </p>
              )}

              {!rfq.is_dead && sample    && <Tag className={cls(STAGE_CLS[sample.sample_status] || "bg-slate-100 text-slate-500", "ring-1 ring-inset text-[9px]")}>{sample.sample_status || "Sample"}</Tag>}
              {!rfq.is_dead && quotation && <Tag className={cls(STAGE_CLS[quotation.quotation_status] || "bg-violet-50 text-violet-700", "ring-1 ring-inset text-[9px]")}>{quotation.quotation_status || "Quote"}</Tag>}
            </div>
            {canEdit && !isOrder && (
              <button type="button"
                onClick={(e) => { e.stopPropagation(); setCollapsed(false); openEditToggles(); }}
                title={missingFields.length ? "Fill in missing details" : "Edit TDS"}
                className="shrink-0 flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-semibold text-indigo-500 hover:text-indigo-700 hover:bg-indigo-100/70 transition-colors">
                <Ic.Edit className="h-3.5 w-3.5"/>
                {missingFields.length > 0 && (
                  <span className="flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-indigo-600 px-1 text-[8px] font-bold text-white">
                    {missingFields.length}
                  </span>
                )}
              </button>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 mt-0.5">
            <span className="text-[13px] font-semibold text-slate-800 truncate min-w-0">
              {rfq.product_name || rfq.product_category || "Enquiry"}
            </span>
          </div>

          {collapsed && displayFuDate && !closed && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <Ic.Cal className="h-3 w-3 text-slate-400 shrink-0"/>
              <span className={cls("text-[11px] font-semibold", dueCls(displayFuDate))}>{dueLabel(displayFuDate)}</span>
              {displayFuTime && <span className="text-[11px] text-slate-400">· {displayFuTime}</span>}
            </div>
          )}
          {canEdit && !isOrder && hasSampleOrQuote && (
            <button type="button"
              onClick={(e) => { e.stopPropagation(); handleConvertToOrder(); }}
              disabled={converting}
              className="mt-1.5 w-full flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700 disabled:opacity-60 transition-colors">
              {converting ? <Ic.Spin className="h-3.5 w-3.5 animate-spin"/> : <Ic.Check className="h-3.5 w-3.5"/>}
              {converting ? "Converting…" : "Convert to Order"}
            </button>
          )}
          {!hasSampleOrQuote && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setShowAddFup(true); }}
              className="w-full mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-[12px] font-bold text-indigo-600 hover:bg-indigo-50 transition-colors">
              <Ic.Cal className="h-3.5 w-3.5"/> Schedule Follow-up
            </button>
          )}

          {canEdit && !isOrder && !closed && (
            <button type="button"
              onClick={(e) => { e.stopPropagation(); setShowMarkDead(true); }}
              className="mt-1.5 w-full flex items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-[11px] font-bold text-rose-600 hover:bg-rose-50 transition-colors">
              <Ic.X className="h-3.5 w-3.5"/> Mark Enquiry Dead
            </button>
          )}

          {canSuperDelete && (
            <button type="button"
              onClick={(e) => { e.stopPropagation(); handlePurgeRFQ(); }}
              disabled={deletingRFQ}
              className="mt-1.5 w-full flex items-center justify-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-rose-700 disabled:opacity-60 transition-colors">
              {deletingRFQ ? <Ic.Spin className="h-3.5 w-3.5 animate-spin"/> : <Ic.Trash className="h-3.5 w-3.5"/>}
              {deletingRFQ ? "Deleting…" : "Permanently Delete Enquiry"}
            </button>
          )}

        </div>

        <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
          <button type="button" onClick={(e) => { e.stopPropagation(); setCollapsed(v => !v); }} className="flex items-center">
            {collapsed ? <Ic.ChevD className="h-4 w-4 text-slate-400"/> : <Ic.ChevU className="h-4 w-4 text-slate-400"/>}
          </button>
        </div>
      </div>

      {/* Expandable body */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden">

            {/* Product details */}
            <div className="px-4 py-3 border-t border-slate-100">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-bold text-slate-900 leading-snug truncate">{rfq.product_name || rfq.product_category || "Enquiry"}</p>
                  {rfq.product_name && rfq.product_category && (
                    <p className="text-[11px] text-slate-400 mt-0.5">{rfq.product_category}{rfq.product_sub_category && <span> · {rfq.product_sub_category}</span>}</p>
                  )}
                </div>
                {rfq.tds_available && <Tag className="bg-green-50 text-green-700 ring-green-200 shrink-0">TDS</Tag>}
              </div>

              {(rfq.consumption_per_month || rfq.target_price || latestFup?.target_price || rfq.existing_supplier_brand) && (
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-lg bg-slate-50 border border-slate-100 px-3 py-2 mt-1">
                  {rfq.consumption_per_month && (
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Qty / Month</p>
                      <p className="text-[13px] font-semibold text-slate-700">{rfq.consumption_per_month} <span className="text-[11px] font-normal text-slate-400">{rfq.unit || ""}</span></p>
                    </div>
                  )}
                  {(latestFup?.target_price || rfq.target_price) && (
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Target Price</p>
                      <p className="text-[13px] font-semibold text-slate-700">₹{latestFup?.target_price || rfq.target_price}</p>
                    </div>
                  )}
                  {rfq.existing_supplier_brand && (
                    <div className="col-span-2">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Existing Supplier</p>
                      <p className="text-[12px] text-slate-600">{rfq.existing_supplier_brand}</p>
                    </div>
                  )}
                </div>
              )}

              {rfq.product_description && (
                <div className="mt-2 rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Product Description</p>
                  <p className="text-[12px] text-slate-600 leading-relaxed">{rfq.product_description}</p>
                </div>
              )}

              {(rfq.sample_required || rfq.quotation_required || !editingToggles) && (
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex gap-2 flex-wrap">
                    {rfq.sample_required    && <span className="inline-flex items-center gap-1 rounded-md bg-teal-50 border border-teal-100 px-2 py-0.5 text-[11px] font-semibold text-teal-700"><Ic.Package className="h-3 w-3"/> Sample Required</span>}
                    {rfq.quotation_required && <span className="inline-flex items-center gap-1 rounded-md bg-violet-50 border border-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700"><Ic.FileT className="h-3 w-3"/> Quotation Required</span>}
                    {!rfq.sample_required && !rfq.quotation_required && !editingToggles && (
                      <span className="text-[11px] text-slate-400 italic">No sample or quotation required</span>
                    )}
                  </div>
                </div>
              )}

              {/* Fill-in-missing-details editor — dynamically lists only the
                  fields that were left empty when this enquiry was first
                  created (plus TDS, always editable). Sample/Quotation
                  "required" is intentionally not editable here. */}
              <AnimatePresence initial={false}>
                {editingToggles && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden">
                    <div className="mt-2 rounded-xl border border-indigo-200 bg-indigo-50/40 px-3 py-3 space-y-3">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-indigo-500">
                        {missingFields.length ? "Fill in missing details" : "Edit"}
                      </p>

                      {missingFields.length === 0 && (
                        <p className="text-[11px] text-slate-500">Nothing missing — every field is already filled in. You can still update TDS below.</p>
                      )}

                      {missingFields.map((f) => (
                        <div key={f.key}>
                          {f.type === "textarea" && (
                            <TArea
                              label={f.label}
                              name={f.key}
                              value={editValues[f.key] || ""}
                              onChange={(e) => hEditField(f.key, e.target.value)}
                              placeholder={f.placeholder}
                              rows={2}
                            />
                          )}
                          {f.type === "select" && (
                            <SelInput
                              label={f.label}
                              name={f.key}
                              value={editValues[f.key] || ""}
                              onChange={(e) => hEditField(f.key, e.target.value)}
                              options={f.options}
                            />
                          )}
                          {(f.type === "text" || f.type === "number") && (
                            <FldInput
                              label={f.label}
                              name={f.key}
                              type={f.type}
                              value={editValues[f.key] || ""}
                              onChange={(e) => hEditField(f.key, e.target.value)}
                              placeholder={f.placeholder}
                            />
                          )}
                        </div>
                      ))}

                      <div className="pt-1 border-t border-indigo-100">
                        <label className="flex items-center gap-2 cursor-pointer pt-2">
                          <input type="checkbox" checked={editTds} onChange={e => setEditTds(e.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400"/>
                          <span className="text-[12px] font-medium text-slate-700">TDS Available</span>
                        </label>
                      </div>

                      {toggleErr && <p className="text-[10px] text-rose-600 bg-rose-50 border border-rose-200 rounded px-2 py-1">{toggleErr}</p>}

                      <div className="flex items-center gap-2 pt-1">
                        <button type="button" onClick={handleSaveToggles} disabled={savingToggles}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-bold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors">
                          {savingToggles ? <><Ic.Spin className="h-3 w-3 animate-spin"/>Saving…</> : "Save"}
                        </button>
                        <button type="button" onClick={() => setEditingToggles(false)} disabled={savingToggles}
                          className="rounded-lg px-3 py-2 text-[11px] font-semibold text-slate-500 hover:bg-slate-100 disabled:opacity-60 transition-colors">
                          Cancel
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Latest general follow-up */}
            {latestFup && (!hasSample || !hasQuote) && (
              <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/40">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    {!closed && !hasSampleOrQuote && latestFup.followup_date && (
                      <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                        <Ic.Cal className="h-3.5 w-3.5 text-slate-400 shrink-0"/>
                        <span className={cls("text-[12px] font-bold", dueCls(latestFup.followup_date))}>{dueLabel(latestFup.followup_date)}</span>
                        {cardTime && <span className="inline-flex items-center gap-1 text-[11px] text-slate-400"><Ic.Clock className="h-3 w-3"/>{cardTime}</span>}
                        {latestFup.contact_type && (
                          <Tag className={cls(contactCls(latestFup.contact_type), "ring-1 ring-inset")}>
                            <ContactIcon type={latestFup.contact_type} className="mr-1 h-2.5 w-2.5"/>{latestFup.contact_type}
                          </Tag>
                        )}
                      </div>
                    )}
                    {closed && latestFup.followup_date && (
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Ic.Check className="h-3.5 w-3.5 text-emerald-500 shrink-0"/>
                        <span className="text-[12px] text-slate-500">{fmtD(latestFup.followup_date)}</span>
                        {latestFup.contact_type && <Tag className="bg-slate-100 text-slate-500 ring-slate-200">{latestFup.contact_type}</Tag>}
                      </div>
                    )}
                    {latestFup.next_action && !closed && <p className="text-[12px] text-indigo-600 font-semibold mb-1">→ {latestFup.next_action}</p>}
                    {latestFup.remark && <p className="text-[12px] text-slate-600 line-clamp-2 leading-relaxed">{latestFup.remark}</p>}
                    {(latestFup.sample_status_update || latestFup.quotation_status_update) && (
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        {latestFup.sample_status_update    && <span className="text-[11px] font-semibold text-teal-600 bg-teal-50 rounded px-1.5 py-0.5">Sample: {latestFup.sample_status_update}</span>}
                        {latestFup.quotation_status_update && <span className="text-[11px] font-semibold text-violet-600 bg-violet-50 rounded px-1.5 py-0.5">Quote: {latestFup.quotation_status_update}</span>}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            {!latestFup && <div className="px-4 py-3 border-t border-slate-100"><p className="text-[12px] text-slate-400">No follow-ups yet.</p></div>}
            
            {/* Activity log */}
            {allFups.length  && (
              <div className="border-t border-slate-100">
                <button type="button" onClick={toggleLogs}
                  className="flex w-full items-center justify-between px-4 py-2 text-left hover:bg-slate-50 transition-colors">
                  <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                    <Ic.History className="h-3.5 w-3.5"/> Activity log ({activity ? activity.length : "…"})
                  </span>
                  {showLogs ? <Ic.ChevU className="h-3.5 w-3.5 text-slate-400"/> : <Ic.ChevD className="h-3.5 w-3.5 text-slate-400"/>}
                </button>
                <AnimatePresence>
                  {showLogs && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden">
                      <div className="px-4 pb-3 space-y-2">
                        {loadingActivity ? <p className="text-[12px] text-slate-400 py-2">Loading…</p>
                          : (activity || []).length === 0 ? <p className="text-[12px] text-slate-400 py-2">No activity yet.</p>
                          : activity.map((a, i) => {
                              const who = personLabel(a.by) || "Unknown";
                              const typeLabel = { rfq: "Enquiry", followup: "Follow-up", sample: "Sample", quotation: "Quotation" }[a.type];
                              const typeCls = {
                                rfq: "bg-indigo-100 text-indigo-600",
                                followup: "bg-sky-100 text-sky-600",
                                sample: "bg-rose-100 text-rose-600",
                                quotation: "bg-orange-100 text-orange-600",
                              }[a.type];
                              return (
                                <div key={`${a.type}-${a.snapshot.id}-${i}`} className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <Tag className={cls(typeCls, "text-[9px]")}>{typeLabel}</Tag>
                                      <span className="text-[11px] font-semibold text-slate-600 capitalize">{(a.action || "").replace(/_/g, " ")}</span>
                                      <span className="text-[10px] text-slate-400">by {who}</span>
                                    </div>
                                    <span className="text-[10px] text-slate-300 shrink-0">{fmtDateTime(a.at)}</span>
                                  </div>
                                  {a.type === "followup" && a.snapshot.remark && <p className="mt-0.5 text-[11px] text-slate-600">{a.snapshot.remark}</p>}
                                  {a.type === "followup" && a.snapshot.next_action && <p className="mt-0.5 text-[11px] text-indigo-600">→ {a.snapshot.next_action}</p>}
                                  {(a.type === "sample" || a.type === "quotation") && a.snapshot.notes && <p className="mt-0.5 text-[11px] text-slate-600">{a.snapshot.notes}</p>}
                                  {a.type === "rfq" && a.snapshot.dead_reason && <p className="mt-0.5 text-[11px] text-rose-600">Reason: {a.snapshot.dead_reason}</p>}
                                </div>
                              );
                            })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Sample & Quotation — inline status editing, same UI as the
                Tasks (all) tab's SQFlatRow panel. Only one of the two can be
                expanded at a time. */}
            {hasSampleOrQuote && (
              <div className="border-t border-slate-100">
                <div className="px-4 py-2 flex items-center gap-1.5 bg-slate-50/60">
                  <Ic.Package className="h-3.5 w-3.5 text-slate-400"/>
                  <span className="text-[11px] font-semibold text-slate-400">Sample &amp; Quotation</span>
                </div>

                {isOrder ? (
                  // Converted — read only. No editing sample/quotation status
                  // once it's become an order.
                  <div className="px-4 py-3 space-y-2">
                    {hasSample && (
                      <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-rose-100 text-rose-600 text-[9px] font-extrabold">S</span>
                          <span className="text-[12px] font-semibold text-slate-700">Sample</span>
                        </div>
                        <span className="text-[11px] font-bold text-emerald-600 shrink-0">{sample?.sample_status || "Approved"}</span>
                      </div>
                    )}
                    {hasQuote && (
                      <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-orange-100 text-orange-600 text-[9px] font-extrabold">Q</span>
                          <span className="text-[12px] font-semibold text-slate-700">Quotation</span>
                        </div>
                        <span className="text-[11px] font-bold text-emerald-600 shrink-0">{quotation?.quotation_status || "Approved"}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                      <Ic.Check className="h-4 w-4 text-emerald-600 shrink-0"/>
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold text-emerald-700 leading-tight">Converted to Order</p>
                        <p className="text-[10px] text-emerald-600 leading-tight truncate">
                          {fmtDateTime(order.converted_at)}{personLabel(order.converter) && ` · by ${personLabel(order.converter)}`}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="border-t border-slate-100">
                      <button type="button" onClick={() => togglePanel("sq")}
                        className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-2 min-w-0 flex-wrap">
                          {hasSample && (
                            <span className="flex items-center gap-1.5">
                              <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-rose-100 text-rose-600 text-[9px] font-extrabold">S</span>
                              {sample?.sample_status
                                ? <Tag className={cls("ring-1 ring-inset text-[9px]", STAGE_CLS[sample.sample_status] || "bg-slate-100 text-slate-500")}>{sample.sample_status}</Tag>
                                : <Tag className="bg-rose-50 text-rose-600 ring-rose-200 ring-1 ring-inset text-[9px]">Sample</Tag>}
                            </span>
                          )}
                          {hasQuote && (
                            <span className="flex items-center gap-1.5">
                              <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-orange-100 text-orange-600 text-[9px] font-extrabold">Q</span>
                              {quotation?.quotation_status
                                ? <Tag className={cls("ring-1 ring-inset text-[9px]", STAGE_CLS[quotation.quotation_status] || "bg-slate-100 text-slate-500")}>{quotation.quotation_status}</Tag>
                                : <Tag className="bg-orange-50 text-orange-600 ring-orange-200 ring-1 ring-inset text-[9px]">Quotation</Tag>}
                            </span>
                          )}
                          {displayFuDate && (
                            <span className={cls("text-[11px] font-medium", dueCls(displayFuDate))}>{dueLabel(displayFuDate)}{displayFuTime && ` · ${displayFuTime}`}</span>
                          )}
                        </div>
                        {openPanel === "sq" ? <Ic.ChevU className="h-3.5 w-3.5 text-slate-400 shrink-0"/> : <Ic.ChevD className="h-3.5 w-3.5 text-slate-400 shrink-0"/>}
                      </button>
                      <AnimatePresence initial={false}>
                        {openPanel === "sq" && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                            <SQCombinedPanel
                              rfq={rfq}
                              showSample={hasSample}
                              showQuote={hasQuote}
                              token={token}
                              user={user}
                              onUpdated={onUpdated ? (id, type, data) => onUpdated(type, id, data) : undefined}
                              onClose={() => setOpenPanel(null)}
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </>
                )}
                
              </div>
              
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAddFup && <AddFollowupModal rfq={rfq} token={token} onClose={() => setShowAddFup(false)} onSaved={handleFupSaved}/>}
        {editFup    && <EditFollowupModal rfq={rfq} followup={editFup} token={token} onClose={() => setEditFup(null)} onSaved={saved => { handleFupEdited(saved); setEditFup(null); }}/>}
        {showMarkDead && <MarkDeadModal rfq={rfq} onClose={() => setShowMarkDead(false)} onConfirm={confirmMarkDead}/>}
      </AnimatePresence>
    </div>
  );
}