import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ENQ_STATUS_CLS, SAMPLE_CLS } from "../constants";
import {
  isEnquiryClosed, latestFU, sortFupsByCreated, extractTimeFromNotes, cleanNotes,
  fmtD, dueCls, dueLabel,
} from "../utils";
import { isSqApproved, isSqClosed } from "../sqStatus";
import { Ic, contactCls, ContactIcon } from "../icons";
import { Tag, cls } from "../ui/primitives";
import { AddFollowupModal, EditFollowupModal } from "./FollowupModals";
import { SQLPanel } from "./SQFlatRow";

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

export default function EnquiryCard({ rfq, token, canEdit, onUpdated, user, order }) {
  const isOrder = !!order;
  // Converting to an order doesn't itself create a new general follow-up, so
  // relying on the latest rfq_followup's enquiry_status alone would keep
  // showing a stale "In Progress"/"Open" badge forever. Once it's an order,
  // treat the enquiry as closed/Won regardless of what that last follow-up said.
  const closed = isEnquiryClosed(rfq) || isOrder;

  const [showLogs,    setShowLogs]    = useState(false);
  const [fullFups,    setFullFups]    = useState(null);
  const [loadingFups, setLoadingFups] = useState(false);
  const [showAddFup,  setShowAddFup]  = useState(false);
  const [editFup,     setEditFup]     = useState(null);
  const [deletingId,  setDeletingId]  = useState(null);
  const [collapsed, setCollapsed] = useState(true);
  const [converting, setConverting] = useState(false);

  // ── Sample / Quotation / TDS edit — the only fields users can fix after
  // an enquiry is created (e.g. it was made without Sample by mistake).
  const [editingToggles, setEditingToggles] = useState(false);
  const [editSample,     setEditSample]     = useState(!!rfq.sample_required);
  const [editQuote,      setEditQuote]      = useState(!!rfq.quotation_required);
  const [editTds,        setEditTds]        = useState(!!rfq.tds_available);
  const [savingToggles,  setSavingToggles]  = useState(false);
  const [toggleErr,      setToggleErr]      = useState("");

  function openEditToggles() {
    setEditSample(!!rfq.sample_required);
    setEditQuote(!!rfq.quotation_required);
    setEditTds(!!rfq.tds_available);
    setToggleErr("");
    setEditingToggles(true);
  }

  async function handleSaveToggles() {
    setSavingToggles(true);
    setToggleErr("");
    try {
      const res = await fetch(`${API}/api/rfqs/${rfq.id}/toggles`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          sample_required: editSample,
          quotation_required: editQuote,
          tds_available: editTds,
        }),
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

  // Accordion: only one of Sample / Quotation can be expanded at a time.
  // Both start collapsed — the user opens whichever one they want to look at.
  const [openPanel, setOpenPanel] = useState(null);

  function togglePanel(which) {
    setOpenPanel(p => (p === which ? null : which));
  }

  const hasSampleOrQuote = (rfq.sample_required && (rfq.samples || []).length > 0) || (rfq.quotation_required && (rfq.quotations || []).length > 0);

  async function openLogs() {
    setShowLogs(true);
    if (fullFups !== null) return;
    setLoadingFups(true);
    try {
      const r = await fetch(`${API}/api/rfqs/${rfq.id}/followups`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (r.ok) setFullFups([...(d.followups || [])].filter(f => !f.deleted_at));
    } catch (_) {}
    finally { setLoadingFups(false); }
  }

  const allFups = (fullFups !== null ? fullFups : [...(rfq.rfq_followups || [])].filter(f => !f.deleted_at))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const latestFup  = allFups[0] || null;
  const olderFups  = allFups.slice(1);
  // Once converted to an order, the enquiry is Won — show that instead of
  // whatever the last general follow-up happened to say (e.g. "In Progress").
  const status     = isOrder ? "Won" : (latestFup?.enquiry_status || "Open");
  const sample     = sampleRec;
  const quotation  = quoteRec;
  const cardTime   = extractTimeFromNotes(latestFup?.notes);

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

  // Real, backend-persisted conversion — records who did it and exactly when.
  // Doesn't require Sample/Quotation to already be Approved: converting IS
  // the approval action, the backend marks whichever part isn't Approved
  // yet as part of this same call.
  async function handleConvertToOrder() {
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
        className={cls("w-full flex items-center gap-2 px-4 py-3 text-left transition-colors", closed ? "bg-slate-50/60 hover:bg-slate-100/60" : "bg-indigo-50/40 hover:bg-indigo-50/70")}>
        <button type="button" onClick={() => setCollapsed(v => !v)} className="min-w-0 flex-1 flex items-center gap-3 text-left">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 flex-wrap">
              {isOrder ? (
                <Tag className="ring-1 ring-inset bg-emerald-50 text-emerald-700 ring-emerald-200">
                  <Ic.Check className="mr-1 h-2.5 w-2.5"/>Order
                </Tag>
              ) : (
                <Tag className={cls(ENQ_STATUS_CLS[status] || "bg-slate-100 text-slate-500 ring-slate-200", "ring-1 ring-inset")}>
                  {closed && <Ic.Check className="mr-1 h-2.5 w-2.5"/>}{status}
                </Tag>
              )}
              {sample    && <Tag className={cls(SAMPLE_CLS[sample.sample_status] || "bg-slate-100 text-slate-500", "ring-0 text-[9px]")}>{sample.sample_status?.split(" ")[0] || "Sample"}</Tag>}
              {quotation && <Tag className="ring-0 text-[9px] bg-violet-50 text-violet-700">{quotation.quotation_status?.split(" ")[0] || "Quote"}</Tag>}
            </div>
            <span className="text-[13px] font-semibold text-slate-800 truncate block mt-0.5">
              {rfq.product_name || rfq.product_category || "Enquiry"}
            </span>
            {collapsed && (
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {rfq.consumption_per_month && <span className="text-[11px] text-slate-400">{rfq.consumption_per_month} {rfq.unit || ""}/mo</span>}
                {(latestFup?.target_price || rfq.target_price) && <span className="text-[11px] text-slate-400">· ₹{latestFup?.target_price || rfq.target_price}</span>}
                {latestFup?.followup_date && !closed && (
                  <span className={cls("text-[11px] font-semibold", dueCls(latestFup.followup_date))}>· {dueLabel(latestFup.followup_date)}</span>
                )}
              </div>
            )}
          </div>
        </button>
        <div className="flex items-center gap-1.5 shrink-0">
          {canEdit && !isOrder && (
            <button type="button"
              onClick={(e) => { e.stopPropagation(); setCollapsed(false); openEditToggles(); }}
              title="Edit Sample / Quotation / TDS"
              className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-semibold text-indigo-500 hover:text-indigo-700 hover:bg-indigo-100/70 transition-colors">
              <Ic.Edit className="h-3.5 w-3.5"/>
            </button>
          )}
          <button type="button" onClick={() => setCollapsed(v => !v)} className="flex items-center">
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

              {/* Inline Sample / Quotation / TDS editor — the only fields
                  users are allowed to fix after the enquiry was created
                  (e.g. it was made without Sample by mistake). Everything
                  else about the enquiry stays edit-only via the full form. */}
              <AnimatePresence initial={false}>
                {editingToggles && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden">
                    <div className="mt-2 rounded-xl border border-indigo-200 bg-indigo-50/40 px-3 py-3 space-y-2.5">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-indigo-500">Edit Sample / Quotation / TDS</p>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={editSample} onChange={e => setEditSample(e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400"/>
                        <span className="text-[12px] font-medium text-slate-700">Sample Required</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={editQuote} onChange={e => setEditQuote(e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400"/>
                        <span className="text-[12px] font-medium text-slate-700">Quotation Required</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={editTds} onChange={e => setEditTds(e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400"/>
                        <span className="text-[12px] font-medium text-slate-700">TDS Available</span>
                      </label>

                      {(rfq.sample_required && !editSample) || (rfq.quotation_required && !editQuote) ? (
                        <p className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                          Unchecking removes its {(!editSample && !editQuote) ? "sample and quotation records" : !editSample ? "sample record" : "quotation record"} and any history for it — this can't be undone.
                        </p>
                      ) : null}

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
            {latestFup && (
              <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/40">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    {!closed && latestFup.followup_date && (
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
            {allFups.length > 1 && (
              <div className="border-t border-slate-100">
                <button type="button" onClick={() => showLogs ? setShowLogs(false) : openLogs()}
                  className="flex w-full items-center justify-between px-4 py-2 text-left hover:bg-slate-50 transition-colors">
                  <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                    <Ic.History className="h-3.5 w-3.5"/> Activity log ({olderFups.length} older)
                  </span>
                  {showLogs ? <Ic.ChevU className="h-3.5 w-3.5 text-slate-400"/> : <Ic.ChevD className="h-3.5 w-3.5 text-slate-400"/>}
                </button>
                <AnimatePresence>
                  {showLogs && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden">
                      <div className="px-4 pb-3 space-y-2">
                        {loadingFups ? <p className="text-[12px] text-slate-400 py-2">Loading…</p>
                          : olderFups.map((fu, i) => {
                            const time  = extractTimeFromNotes(fu.notes);
                            const notes = cleanNotes(fu.notes);
                            return (
                              <div key={fu.id || i} className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="text-[11px] text-slate-500 font-medium">{fmtD(fu.followup_date)}{time && ` · ${time}`}</span>
                                    {fu.contact_type    && <Tag className="bg-slate-100 text-slate-600 ring-slate-200 text-[9px]">{fu.contact_type}</Tag>}
                                    {fu.enquiry_status  && <Tag className={cls(ENQ_STATUS_CLS[fu.enquiry_status] || "", "ring-1 ring-inset text-[9px]")}>{fu.enquiry_status}</Tag>}
                                  </div>
                                  {canEdit && (
                                    <div className="flex gap-0.5 shrink-0">
                                      <button type="button" onClick={() => setEditFup(fu)} className="grid h-6 w-6 place-items-center rounded text-slate-400 hover:text-indigo-600"><Ic.Edit className="h-3 w-3"/></button>
                                      <button type="button" onClick={() => deleteFup(fu.id)} disabled={deletingId === fu.id} className="grid h-6 w-6 place-items-center rounded text-slate-400 hover:text-rose-600 disabled:opacity-40"><Ic.Trash className="h-3 w-3"/></button>
                                    </div>
                                  )}
                                </div>
                                {fu.next_action && <p className="mt-0.5 text-[11px] text-indigo-600">→ {fu.next_action}</p>}
                                {fu.remark      && <p className="mt-0.5 text-[11px] text-slate-600">{fu.remark}</p>}
                                {notes          && <p className="mt-0.5 text-[10px] text-slate-400">{notes}</p>}
                                <p className="mt-1 text-[10px] text-slate-300">{new Date(fu.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
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
                        <span className="text-[11px] font-bold text-emerald-600 shrink-0">{sample?.result || "Approved"}</span>
                      </div>
                    )}
                    {hasQuote && (
                      <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-orange-100 text-orange-600 text-[9px] font-extrabold">Q</span>
                          <span className="text-[12px] font-semibold text-slate-700">Quotation</span>
                        </div>
                        <span className="text-[11px] font-bold text-emerald-600 shrink-0">{quotation?.result || "Approved"}</span>
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
                    {hasSample && (
                      <div className="border-t border-slate-100">
                        <button type="button" onClick={() => togglePanel("sample")}
                          className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-slate-50 transition-colors">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-rose-100 text-rose-600 text-[9px] font-extrabold">S</span>
                            <span className="text-[12px] font-semibold text-slate-700">Sample</span>
                            {sample?.result && <Tag className="ring-0 text-[9px] bg-slate-100 text-slate-500">{sample.result}</Tag>}
                            {!sampleClosed && sample?.follow_up_date && (
                              <span className={cls("text-[11px] font-medium", dueCls(sample.follow_up_date))}>{dueLabel(sample.follow_up_date)}</span>
                            )}
                          </div>
                          {openPanel === "sample" ? <Ic.ChevU className="h-3.5 w-3.5 text-slate-400 shrink-0"/> : <Ic.ChevD className="h-3.5 w-3.5 text-slate-400 shrink-0"/>}
                        </button>
                        <AnimatePresence initial={false}>
                          {openPanel === "sample" && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                              <SQLPanel rfq={rfq} isSample={true} token={token} user={user} onUpdated={onUpdated ? (id, type, data) => onUpdated(type, id, data) : undefined} />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}

                    {hasQuote && (
                      <div className="border-t border-slate-100">
                        <button type="button" onClick={() => togglePanel("quotation")}
                          className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-slate-50 transition-colors">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-orange-100 text-orange-600 text-[9px] font-extrabold">Q</span>
                            <span className="text-[12px] font-semibold text-slate-700">Quotation</span>
                            {quotation?.result && <Tag className="ring-0 text-[9px] bg-slate-100 text-slate-500">{quotation.result}</Tag>}
                            {!quoteClosed && quotation?.follow_up_date && (
                              <span className={cls("text-[11px] font-medium", dueCls(quotation.follow_up_date))}>{dueLabel(quotation.follow_up_date)}</span>
                            )}
                          </div>
                          {openPanel === "quotation" ? <Ic.ChevU className="h-3.5 w-3.5 text-slate-400 shrink-0"/> : <Ic.ChevD className="h-3.5 w-3.5 text-slate-400 shrink-0"/>}
                        </button>
                        <AnimatePresence initial={false}>
                          {openPanel === "quotation" && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                              <SQLPanel rfq={rfq} isSample={false} token={token} user={user} onUpdated={onUpdated ? (id, type, data) => onUpdated(type, id, data) : undefined} />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}

                    {/* Convert to Order */}
                    <div className="px-4 py-3 border-t border-slate-100">
                      <button type="button" onClick={handleConvertToOrder} disabled={converting}
                        className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-[12px] font-bold transition-all active:scale-[0.98] bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-200 disabled:opacity-60">
                        {converting
                          ? <><Ic.Spin className="h-3.5 w-3.5 animate-spin"/>Converting…</>
                          : <><Ic.Check className="h-3.5 w-3.5"/>Convert to Order</>}
                      </button>
                      <p className="mt-1.5 text-[10px] text-slate-400 text-center">
                        {[hasSample && "Sample", hasQuote && "Quotation"].filter(Boolean).join(" & ")} will be marked Approved automatically if not already
                      </p>
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
      </AnimatePresence>
    </div>
  );
}