import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ENQ_STATUS_CLS, SAMPLE_CLS } from "../constants";
import {
  isEnquiryClosed, latestFU, sortFupsByCreated, extractTimeFromNotes, cleanNotes,
  fmtD, dueCls, dueLabel,
} from "../utils";
import { Ic, contactCls, ContactIcon } from "../icons";
import { Tag, cls } from "../ui/primitives";
import { AddFollowupModal, EditFollowupModal } from "./FollowupModals";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function EnquiryCard({ rfq, token, canEdit, onUpdated }) {
  const closed = isEnquiryClosed(rfq);

  const [showLogs,    setShowLogs]    = useState(false);
  const [fullFups,    setFullFups]    = useState(null);
  const [loadingFups, setLoadingFups] = useState(false);
  const [showAddFup,  setShowAddFup]  = useState(false);
  const [editFup,     setEditFup]     = useState(null);
  const [deletingId,  setDeletingId]  = useState(null);
  const [showCoordLogs,    setShowCoordLogs]    = useState(false);
  const [coordLogs,        setCoordLogs]        = useState(null);
  const [loadingCoordLogs, setLoadingCoordLogs] = useState(false);
  const [collapsed, setCollapsed] = useState(true);

  async function openCoordLogs() {
    setShowCoordLogs(true);
    if (coordLogs !== null) return;
    setLoadingCoordLogs(true);
    try {
      const sample    = (rfq.samples    || [])[0];
      const quotation = (rfq.quotations || [])[0];
      const calls = [
        sample    ? fetch(`${API}/api/samples/${sample.id}/logs`,       { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()) : Promise.resolve({ logs: [] }),
        quotation ? fetch(`${API}/api/quotations/${quotation.id}/logs`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()) : Promise.resolve({ logs: [] }),
      ];
      const [sJ, qJ] = await Promise.all(calls);
      setCoordLogs({ sample: sJ.logs || [], quotation: qJ.logs || [] });
    } catch (_) { setCoordLogs({ sample: [], quotation: [] }); }
    finally { setLoadingCoordLogs(false); }
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
  const status     = latestFup?.enquiry_status || "Open";
  const sample     = (rfq.samples    || [])[0];
  const quotation  = (rfq.quotations || [])[0];
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

  return (
    <div className={cls("rounded-xl border overflow-hidden mb-3 last:mb-0 transition-opacity", closed ? "border-slate-200 bg-white/70 opacity-75 hover:opacity-100" : "border-slate-200 bg-white")}>

      {/* Collapsed header */}
      <button type="button" onClick={() => setCollapsed(v => !v)}
        className={cls("w-full flex items-center gap-3 px-4 py-3 text-left transition-colors", closed ? "bg-slate-50/60 hover:bg-slate-100/60" : "bg-indigo-50/40 hover:bg-indigo-50/70")}>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <Tag className={cls(ENQ_STATUS_CLS[status] || "bg-slate-100 text-slate-500 ring-slate-200", "ring-1 ring-inset")}>
              {closed && <Ic.Check className="mr-1 h-2.5 w-2.5"/>}{status}
            </Tag>
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
        <div className="flex items-center gap-1.5 shrink-0">
          {collapsed ? <Ic.ChevD className="h-4 w-4 text-slate-400"/> : <Ic.ChevU className="h-4 w-4 text-slate-400"/>}
        </div>
      </button>

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

              {(rfq.sample_required || rfq.quotation_required) && (
                <div className="flex gap-2 mt-2">
                  {rfq.sample_required    && <span className="inline-flex items-center gap-1 rounded-md bg-teal-50 border border-teal-100 px-2 py-0.5 text-[11px] font-semibold text-teal-700"><Ic.Package className="h-3 w-3"/> Sample Required</span>}
                  {rfq.quotation_required && <span className="inline-flex items-center gap-1 rounded-md bg-violet-50 border border-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700"><Ic.FileT className="h-3 w-3"/> Quotation Required</span>}
                </div>
              )}
            </div>

            {/* Latest follow-up */}
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

            {/* Sample & Quotation updates */}
            {hasSampleOrQuote && (
              <div className="border-t border-slate-100">
                <button type="button" onClick={() => showCoordLogs ? setShowCoordLogs(false) : openCoordLogs()}
                  className="flex w-full items-center justify-between px-4 py-2 text-left hover:bg-slate-50 transition-colors">
                  <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5"><Ic.Package className="h-3.5 w-3.5"/> Sample &amp; Quotation Updates</span>
                  {showCoordLogs ? <Ic.ChevU className="h-3.5 w-3.5 text-slate-400"/> : <Ic.ChevD className="h-3.5 w-3.5 text-slate-400"/>}
                </button>
                <AnimatePresence>
                  {showCoordLogs && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden">
                      <div className="px-4 pb-3 space-y-2">
                        {loadingCoordLogs ? <p className="text-[12px] text-slate-400 py-2">Loading…</p> : (
                          <>
                            {(coordLogs?.sample || []).map((log, i) => (
                              <div key={`s-${log.id || i}`} className="rounded-lg border border-teal-100 bg-teal-50/40 px-3 py-2">
                                <div className="flex items-center justify-between gap-2">
                                  <Tag className="bg-teal-50 text-teal-700 ring-teal-200 text-[9px]">Sample: {log.sample_status}</Tag>
                                  {log.follow_up_date && <span className="text-[10px] text-slate-400">{fmtD(log.follow_up_date)}</span>}
                                </div>
                                <p className="mt-1 text-[10px] text-slate-400">{log.users?.email || "—"} · {new Date(log.updated_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                              </div>
                            ))}
                            {(coordLogs?.quotation || []).map((log, i) => (
                              <div key={`q-${log.id || i}`} className="rounded-lg border border-violet-100 bg-violet-50/40 px-3 py-2">
                                <div className="flex items-center justify-between gap-2">
                                  <Tag className="bg-violet-50 text-violet-700 ring-violet-200 text-[9px]">Quote: {log.quotation_status}</Tag>
                                  {log.follow_up_date && <span className="text-[10px] text-slate-400">{fmtD(log.follow_up_date)}</span>}
                                </div>
                                <p className="mt-1 text-[10px] text-slate-400">{log.users?.email || "—"} · {new Date(log.updated_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                              </div>
                            ))}
                            {(coordLogs?.sample || []).length === 0 && (coordLogs?.quotation || []).length === 0 && (
                              <p className="text-[12px] text-slate-400 py-1">No updates yet.</p>
                            )}
                          </>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
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
