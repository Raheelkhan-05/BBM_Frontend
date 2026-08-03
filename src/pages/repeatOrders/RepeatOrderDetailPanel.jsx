// pages/repeatOrders/RepeatOrderDetailPanel.jsx
import { useState, useMemo } from "react";
import { Ic } from "../prospects/icons";
import EditRepeatOrderModal from "./EditRepeatOrderModal";
import AssignModal from "./AssignModal";
import { cls, Lbl, inp, PBtn, Backdrop, Sheet, SheetHead, DRow, GBtn } from "../prospects/ui/primitives";
import {
  fmtDate, fmtDateTime, fmtMoney, fmtQty, followupStatus, STATUS_META, MATCH_STATUS_META,
  dialable, personLabel, buildRepeatOrderWaMessage,
} from "./utils";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

const TONE_CLS = {
  rose: "text-rose-600 bg-rose-50 ring-rose-200",
  amber: "text-amber-600 bg-amber-50 ring-amber-200",
  sky: "text-sky-600 bg-sky-50 ring-sky-200",
  slate: "text-slate-500 bg-slate-100 ring-slate-200",
  emerald: "text-emerald-600 bg-emerald-50 ring-emerald-200",
};

// Static so Tailwind's JIT scanner can see them — a template-literal
// class name (`text-${tone}-600`) would get purged from the build.
const TEXT_TONE_CLS = {
  rose: "text-rose-600",
  amber: "text-amber-600",
  sky: "text-sky-600",
  slate: "text-slate-500",
};

const REASON_OPTS = [
  "Not reachable", "Asked to call back later", "Considering — needs follow-up",
  "Comparing with other vendor", "Budget on hold", "Confirmed will reorder soon",
  "No response", "Other",
];

function todayStr() { return new Date().toISOString().slice(0, 10); }
function emptyOrderRow() { return { key: Math.random().toString(36).slice(2), order_item: "", quantity: "", price_discussed: "" }; }

function FormFooter({ children }) {
  return (
    <div className="sticky bottom-0 -mx-4 mt-1 border-t border-slate-100 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-5 sm:px-5">
      {children}
    </div>
  );
}

export default function RepeatOrderDetailPanel({ record, token, user, manager, onClose, onUpdated, onDeleted }) {
  const [tab, setTab] = useState("overview");
  const [logs, setLogs] = useState(null);
  const [logsLoading, setLogsLoading] = useState(false);

  const [showEdit, setShowEdit] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [delErr, setDelErr] = useState("");

  const [showRevertConfirm, setShowRevertConfirm] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [revertErr, setRevertErr] = useState("");

  // Follow-up form (date + time separately, combined on submit)
  const [remark, setRemark] = useState("");
  const [reason, setReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [nextDate, setNextDate] = useState(record.next_followup_at ? record.next_followup_at.slice(0, 10) : "");
  const [nextTime, setNextTime] = useState(record.next_followup_at ? record.next_followup_at.slice(11, 16) : "10:00");
  const [savingF, setSavingF] = useState(false);
  const [errF, setErrF] = useState("");

  // Take-order form — multiple line items in one go, like the PO add-item flow
  const [orderRows, setOrderRows] = useState([emptyOrderRow()]);
  const [orderRemark, setOrderRemark] = useState("");
  const [savingO, setSavingO] = useState(false);
  const [errO, setErrO] = useState("");

  const [niSaving, setNiSaving] = useState(false);
  const [niErr, setNiErr] = useState("");
  const [reopenSaving, setReopenSaving] = useState(false);
  const [reopenErr, setReopenErr] = useState("");
  const [matchBusy, setMatchBusy] = useState(null);

  const isUnassigned = record.status === "unassigned";
  const isOrderPlaced = record.status === "order_placed";
  const isNotInterested = record.status === "not_interested";
  const isActive = record.status === "assigned";

  const meta = STATUS_META[record.status] || STATUS_META.unassigned;
  const fu = followupStatus(record.next_followup_at);

  const isOwner = record.assigned_to && user?.id === record.assigned_to;
  const canAct = manager || isOwner;

  const finalReason = reason === "Other" ? customReason.trim() : reason;

  const history = record.history || [];
  const ordersTaken = [...(record.orders_taken || [])].sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at));

  // Bill IDs that some taken order has been matched/confirmed against —
  // used to cross-link the Purchases list instead of showing the two
  // lists as if they're unrelated facts about the same company.
  const matchedHistoryIds = useMemo(() => {
    const map = new Map(); // history_id -> order (best/most relevant)
    ordersTaken.forEach(o => {
      if (o.matched_history_id && (o.match_status === "confirmed" || o.match_status === "suggested")) {
        map.set(o.matched_history_id, o);
      }
    });
    return map;
  }, [ordersTaken]);

  const sortedHistory = [...history].sort((a, b) => (b.bill_date || "").localeCompare(a.bill_date || ""));

  // Group order-taken rows by batch_id so a multi-item "take order"
  // submission renders as one card instead of N duplicate-looking ones.
  const orderBatches = useMemo(() => {
    const byBatch = new Map();
    ordersTaken.forEach(o => {
      const key = o.batch_id || o.id;
      if (!byBatch.has(key)) byBatch.set(key, { batch_id: key, recorded_at: o.recorded_at, remark: o.remark, items: [] });
      byBatch.get(key).items.push(o);
    });
    return [...byBatch.values()].sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at));
  }, [ordersTaken]);

  async function loadLogs() {
    setLogsLoading(true);
    try {
      const r = await fetch(`${API}/api/repeat-orders/${record.id}/logs`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (d.success) setLogs(d.logs);
    } finally { setLogsLoading(false); }
  }
  function openHistory() { setTab("activity"); if (!logs) loadLogs(); }

  async function submitFollowup(e) {
    e.preventDefault();
    if (!finalReason) { setErrF("Select or enter a reason"); return; }
    if (!nextDate) { setErrF("Next follow-up date is required"); return; }
    setSavingF(true); setErrF("");
    try {
      const next_followup_at = new Date(`${nextDate}T${nextTime || "10:00"}:00`).toISOString();
      const r = await fetch(`${API}/api/repeat-orders/${record.id}/followup`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ remark, reason: finalReason, next_followup_at }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "Failed");
      onUpdated(d.repeatOrder);
      onClose();
    } catch (e) { setErrF(e.message); }
    finally { setSavingF(false); }
  }

  function setOrderRow(key, field, value) {
    setOrderRows(rows => rows.map(r => r.key === key ? { ...r, [field]: value } : r));
  }
  function addOrderRow() { setOrderRows(rows => [...rows, emptyOrderRow()]); }
  function removeOrderRow(key) { setOrderRows(rows => rows.length > 1 ? rows.filter(r => r.key !== key) : rows); }

  async function submitOrder(e) {
    e.preventDefault();
    const cleanItems = orderRows.filter(r => r.order_item.trim());
    if (cleanItems.length === 0) { setErrO("Add at least one order item"); return; }
    setSavingO(true); setErrO("");
    try {
      const r = await fetch(`${API}/api/repeat-orders/${record.id}/take-order`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          items: cleanItems.map(it => ({ order_item: it.order_item, quantity: it.quantity, price_discussed: it.price_discussed })),
          remark: orderRemark,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "Failed");
      onUpdated(d.repeatOrder);
      setOrderRows([emptyOrderRow()]); setOrderRemark("");
      onClose();
    } catch (e) { setErrO(e.message); }
    finally { setSavingO(false); }
  }

  async function resolveMatch(orderId, action) {
    setMatchBusy(orderId);
    try {
      const r = await fetch(`${API}/api/repeat-orders/${record.id}/orders/${orderId}/match`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action }),
      });
      const d = await r.json();
      if (r.ok) onUpdated(d.repeatOrder);
    } finally { setMatchBusy(null); }
  }

  async function markNotInterested() {
    setNiSaving(true); setNiErr("");
    try {
      const r = await fetch(`${API}/api/repeat-orders/${record.id}/not-interested`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ remark: "Marked not interested" }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "Failed");
      onUpdated(d.repeatOrder);
      onClose();
    } catch (e) { setNiErr(e.message); }
    finally { setNiSaving(false); }
  }

  async function reopenForNextCycle() {
    setReopenSaving(true); setReopenErr("");
    try {
      const r = await fetch(`${API}/api/repeat-orders/${record.id}/reopen`, {
        method: "PUT", headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "Failed");
      onUpdated(d.repeatOrder);
    } catch (e) { setReopenErr(e.message); }
    finally { setReopenSaving(false); }
  }

  async function handleRevert() {
    setReverting(true); setRevertErr("");
    try {
      const r = await fetch(`${API}/api/repeat-orders/${record.id}/revert-last`, { method: "PUT", headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "Failed to revert");
      onUpdated(d.repeatOrder);
      setShowRevertConfirm(false);
    } catch (e) { setRevertErr(e.message); }
    finally { setReverting(false); }
  }

  async function handleDelete() {
    setDeleting(true); setDelErr("");
    try {
      const r = await fetch(`${API}/api/repeat-orders/${record.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "Failed to delete");
      onDeleted(record.id);
      onClose();
    } catch (e) { setDelErr(e.message); }
    finally { setDeleting(false); }
  }

  return (
    <Backdrop onClick={onClose}>
      <Sheet>
        <SheetHead
          title={record.party_name}
          subtitle={record.location || "No location on file"}
          onClose={onClose}
          extraActions={
            <>
              <span className={cls("rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset", TONE_CLS[meta.tone])}>
                {meta.label}
              </span>
              {manager && (
                <>
                  <button onClick={() => setShowEdit(true)} title="Edit"
                    className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-indigo-600 active:scale-90 transition-transform">
                    <Ic.Edit className="h-4 w-4" />
                  </button>
                  <button onClick={() => setConfirmDelete(true)} title="Delete"
                    className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 active:scale-90 transition-transform">
                    <Ic.Trash className="h-4 w-4" />
                  </button>
                </>
              )}
            </>
          }
        />

        <div className="px-4 pt-3 sm:px-5">
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-3">
            <p className="break-words text-[15px] font-extrabold leading-snug text-slate-900">{record.party_name}</p>
            {record.gstin && <p className="mt-1 break-words text-[11.5px] text-slate-500">GSTIN: {record.gstin}</p>}
            <p className="mt-0.5 text-[11px] text-slate-500">
              Assigned to: <span className="font-semibold text-slate-700">{record.assignee ? personLabel(record.assignee) : "Nobody yet"}</span>
            </p>
          </div>
        </div>

        {/* Terminal-state banner — explains the auto-reopen so it never
            feels like the record just vanished from Active. */}
        {(isOrderPlaced || isNotInterested) && (
          <div className="mx-4 mt-3 rounded-xl border border-sky-100 bg-sky-50/60 px-3.5 py-3 sm:mx-5">
            <p className="text-[12px] font-semibold text-sky-800">
              {isOrderPlaced ? "Order placed this cycle." : "Marked not interested this cycle."}
            </p>
            <p className="mt-0.5 text-[11.5px] text-sky-700">
              {record.reopen_at
                ? <>Automatically returns to Active on <b>{fmtDate(record.reopen_at)}</b> for the next follow-up.</>
                : "Will return to Active automatically for the next cycle."}
            </p>
            {canAct && (
              <button onClick={reopenForNextCycle} disabled={reopenSaving}
                className="mt-2 flex items-center gap-1.5 rounded-lg border border-sky-300 bg-white px-2.5 py-1.5 text-[11px] font-bold text-sky-700 active:scale-95 transition-transform disabled:opacity-60">
                {reopenSaving ? <Ic.Spin className="h-3.5 w-3.5 animate-spin" /> : <Ic.Zap className="h-3.5 w-3.5" />}
                Reopen now instead
              </button>
            )}
            {reopenErr && <p className="mt-2 text-[11px] text-rose-600">{reopenErr}</p>}
          </div>
        )}

        {record.mobile_1 && (
          <div className="flex gap-2 px-4 pt-3 sm:px-5">
            <a href={`tel:${record.mobile_1}`}
              className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 text-[12.5px] font-bold text-emerald-700 active:scale-[0.97] transition-transform">
              <Ic.Phone className="h-4 w-4" /> Call
            </a>
            <a href={`https://wa.me/${dialable(record.mobile_1)}?text=${encodeURIComponent(buildRepeatOrderWaMessage(record))}`} target="_blank" rel="noopener noreferrer"
              className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-green-200 bg-green-50 text-[12.5px] font-bold text-green-700 active:scale-[0.97] transition-transform">
              WhatsApp
            </a>
          </div>
        )}

        <div className="px-4 pt-3 sm:px-5">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
              <p className="text-[9.5px] font-bold uppercase tracking-wide text-slate-400">Lifetime Value</p>
              <p className="mt-0.5 text-[14px] font-extrabold text-slate-800">{fmtMoney(record.total_lifetime_value)}</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
              <p className="text-[9.5px] font-bold uppercase tracking-wide text-slate-400">Bills On File</p>
              <p className="mt-0.5 text-[14px] font-extrabold text-slate-800">{record.total_bills_count || 0}</p>
            </div>
          </div>

          {manager && (
            <div className="mt-2.5">
              <button onClick={() => setShowAssign(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2.5 text-[12px] font-bold text-indigo-700 active:scale-[0.99] transition-transform">
                <Ic.Zap className="h-3.5 w-3.5" /> {record.assigned_to ? "Reassign" : "Assign"} Record
              </button>
            </div>
          )}

          {canAct && !isUnassigned && (
            <div className="mt-2.5 flex gap-2">
              <button onClick={() => { setShowRevertConfirm(true); setRevertErr(""); }}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[12px] font-bold text-amber-700 active:scale-[0.99] transition-transform">
                <Ic.Zap className="h-3.5 w-3.5" /> Revert Last Action
              </button>
              {isActive && (
                <button onClick={markNotInterested} disabled={niSaving}
                  className="flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[12px] font-bold text-rose-700 active:scale-[0.99] transition-transform disabled:opacity-60">
                  {niSaving ? <Ic.Spin className="h-3.5 w-3.5 animate-spin" /> : "Not Interested"}
                </button>
              )}
            </div>
          )}
          {niErr && <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] text-rose-700">{niErr}</p>}

          <div className="mt-2.5 space-y-0.5">
            {record.location && <DRow label="Location" value={record.location} />}
            {record.mobile_1 && <DRow label="Contact Number" value={record.mobile_1} />}
            {record.mobile_2 && <DRow label="Contact Number" value={record.mobile_2} />}
            {record.last_purchase_date && <DRow label="Last Purchase" value={fmtDate(record.last_purchase_date)} />}
            {record.last_sales_man && <DRow label="Last Handled By (historical)" value={record.last_sales_man} />}
            {isActive && (
              <DRow label="Follow-up Status" value={
                record.next_followup_at
                  ? <span className={cls("font-semibold", TEXT_TONE_CLS[fu.tone])}>{fmtDateTime(record.next_followup_at)} · {fu.label}</span>
                  : <span className="font-semibold text-slate-500">Not scheduled yet</span>
              } />
            )}
            {record.last_reason && <DRow label="Last reason" value={record.last_reason} />}
            {record.last_remark && <DRow label="Last remark" value={record.last_remark} />}
          </div>
        </div>

        {isUnassigned && !manager && (
          <p className="mx-4 mt-4 rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-4 text-center text-[12px] text-slate-500 sm:mx-5">
            This record hasn't been assigned yet.
          </p>
        )}

        <div className="mt-4 flex gap-0.5 border-b border-slate-100 bg-white px-4 pt-1 overflow-x-auto scrollbar-none sm:px-5">
          {[
            { id: "overview", label: "Purchases", icon: Ic.Box },
            { id: "followup", label: "Follow-up", icon: Ic.Zap },
            { id: "order", label: "Take Order", icon: Ic.Check },
            { id: "activity", label: "History", icon: Ic.Cal },
          ].map(t => (
            <button key={t.id} onClick={t.id === "activity" ? openHistory : () => setTab(t.id)}
              className={cls("flex flex-1 shrink-0 items-center justify-center gap-1 border-b-2 py-2.5 text-[11.5px] font-semibold transition-colors active:opacity-70",
                tab === t.id ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-400")}>
              <t.icon className="h-3.5 w-3.5" />{t.label}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          <div className="px-4 py-4 sm:px-5">
            {orderBatches.length > 0 && (
              <div className="mb-5">
                <p className="mb-2 text-[9.5px] font-bold uppercase tracking-wide text-slate-400">Repeat Orders Taken</p>
                <div className="space-y-2.5">
                  {orderBatches.map(batch => (
                    <div key={batch.batch_id} className="rounded-xl border border-emerald-100 bg-emerald-50/40 px-3.5 py-3">
                      <div className="space-y-2">
                        {batch.items.map(o => {
                          const mm = MATCH_STATUS_META[o.match_status] || MATCH_STATUS_META.unmatched;
                          const matchedBill = o.matched_history_id ? history.find(h => h.id === o.matched_history_id) : null;
                          return (
                            <div key={o.id} className="border-b border-emerald-100/70 pb-2 last:border-0 last:pb-0">
                              <div className="flex items-start justify-between gap-2">
                                <p className="min-w-0 break-words text-[13px] font-bold text-slate-800">{o.order_item}</p>
                                <span className={cls("shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold ring-1 ring-inset leading-none", TONE_CLS[mm.tone])}>
                                  {mm.label}
                                </span>
                              </div>
                              <p className="mt-0.5 text-[11px] text-slate-500">
                                {o.quantity ? `Qty ${fmtQty(o.quantity)}` : ""}{o.quantity && o.price_discussed ? " · " : ""}
                                {o.price_discussed ? `${fmtMoney(o.price_discussed)} discussed` : ""}
                              </p>
                              {matchedBill && (o.match_status === "confirmed" || o.match_status === "suggested") && (
                                <p className="mt-0.5 text-[10.5px] text-emerald-700">
                                  🔗 Bill #{(matchedBill.bill_no || "").trim()} — "{matchedBill.product_name}" ({fmtDate(matchedBill.bill_date)}){o.match_score ? ` · ${Math.round(o.match_score * 100)}% match` : ""}
                                </p>
                              )}
                              {o.match_status === "suggested" && canAct && (
                                <div className="mt-1.5 flex gap-1.5">
                                  <button onClick={() => resolveMatch(o.id, "confirm")} disabled={matchBusy === o.id}
                                    className="rounded-full border border-emerald-300 bg-white px-2.5 py-1 text-[10px] font-bold text-emerald-700 active:scale-95 transition-transform disabled:opacity-60">
                                    {matchBusy === o.id ? "…" : "Yes, that's it"}
                                  </button>
                                  <button onClick={() => resolveMatch(o.id, "reject")} disabled={matchBusy === o.id}
                                    className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-600 active:scale-95 transition-transform disabled:opacity-60">
                                    Not this bill
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {batch.remark && <p className="mt-2 text-[11px] text-slate-500">{batch.remark}</p>}
                      <p className="mt-1.5 text-[10px] text-slate-400">{fmtDateTime(batch.recorded_at)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="mb-2 text-[9.5px] font-bold uppercase tracking-wide text-slate-400">Purchase History (from sales dump)</p>
            {sortedHistory.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-400">No purchase history on file</div>
            ) : (
              <div className="space-y-2">
                {sortedHistory.map(h => {
                  const linkedOrder = matchedHistoryIds.get(h.id);
                  return (
                    <div key={h.id} className="rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="break-words text-[13px] font-bold text-slate-800">{h.product_name}</p>
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            {h.product_group}{h.product_category ? ` · ${h.product_category}` : ""}
                          </p>
                        </div>
                        <span className="shrink-0 text-[12px] font-extrabold text-slate-800">{fmtMoney(h.bill_amount)}</span>
                      </div>
                      <p className="mt-1.5 text-[10.5px] text-slate-400">
                        Bill #{(h.bill_no || "").trim()} · {fmtDate(h.bill_date)}{h.sales_man ? ` · ${h.sales_man}` : ""}
                      </p>
                      {linkedOrder && (
                        <p className="mt-1 text-[10.5px] font-semibold text-emerald-600">
                          🔗 Fulfilled a repeat order taken {fmtDate(linkedOrder.recorded_at)}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === "followup" && (
          <>
            {!canAct ? (
              <p className="px-4 py-8 text-center text-[12px] text-slate-400 sm:px-5">This record isn't assigned to you.</p>
            ) : isUnassigned ? (
              <p className="px-4 py-8 text-center text-[12px] text-slate-400 sm:px-5">Assign this record before logging a follow-up.</p>
            ) : !isActive ? (
              <p className="px-4 py-8 text-center text-[12px] text-slate-400 sm:px-5">
                This record is currently marked "{record.status.replace("_", " ")}". Reopen it (above) to log a new follow-up.
              </p>
            ) : (
              <form onSubmit={submitFollowup} className="flex flex-col px-4 py-4 sm:px-5">
                <div className="space-y-3">
                  <div>
                    <Lbl required>Reason / Status of this call</Lbl>
                    <div className="flex flex-wrap gap-1.5">
                      {REASON_OPTS.map(r => (
                        <button key={r} type="button" onClick={() => setReason(r)}
                          className={cls("rounded-full border px-2.5 py-1.5 text-[11.5px] font-semibold transition-colors active:scale-95",
                            reason === r ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-500")}>
                          {r}
                        </button>
                      ))}
                    </div>
                    {reason === "Other" && (
                      <input value={customReason} onChange={e => setCustomReason(e.target.value)}
                        placeholder="Describe the reason…" className={cls(inp(), "mt-2")} />
                    )}
                  </div>
                  <div>
                    <Lbl>Remark</Lbl>
                    <textarea value={remark} onChange={e => setRemark(e.target.value)} rows={2} placeholder="Any additional notes…" className={inp("resize-none text-[13px]")} />
                  </div>
                  <div>
                    <Lbl required>Next Follow-up Date &amp; Time</Lbl>
                    <div className="grid grid-cols-2 gap-2">
                      <input type="date" value={nextDate} min={todayStr()} onChange={e => setNextDate(e.target.value)} className={inp()} />
                      <input type="time" value={nextTime} onChange={e => setNextTime(e.target.value)} className={inp()} />
                    </div>
                  </div>
                  {errF && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] text-rose-700">{errF}</p>}
                </div>
                <FormFooter>
                  <PBtn type="submit" disabled={savingF} className="h-11 w-full">
                    {savingF ? <><Ic.Spin className="h-4 w-4 animate-spin" />Saving…</> : "Save Follow-up"}
                  </PBtn>
                </FormFooter>
              </form>
            )}
          </>
        )}

        {tab === "order" && (
          <>
            {!canAct ? (
              <p className="px-4 py-8 text-center text-[12px] text-slate-400 sm:px-5">This record isn't assigned to you.</p>
            ) : isUnassigned ? (
              <p className="px-4 py-8 text-center text-[12px] text-slate-400 sm:px-5">Assign this record before recording an order.</p>
            ) : isNotInterested ? (
              <p className="px-4 py-8 text-center text-[12px] text-slate-400 sm:px-5">
                This record is marked "not interested". Reopen it (above) before recording a new order.
              </p>
            ) : (
              <form onSubmit={submitOrder} className="flex flex-col px-4 py-4 sm:px-5">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <Lbl required>Order Items</Lbl>
                    <button type="button" onClick={addOrderRow}
                      className="flex items-center gap-1 rounded-full border border-indigo-200 bg-white px-2.5 py-1 text-[10.5px] font-semibold text-indigo-600 active:scale-95">
                      <Ic.Plus className="h-3 w-3" /> Add item
                    </button>
                  </div>

                  <div className="space-y-2">
                    {orderRows.map((row, idx) => (
                      <div key={row.key} className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                        <div className="flex items-center gap-2">
                          <input value={row.order_item} onChange={e => setOrderRow(row.key, "order_item", e.target.value)}
                            placeholder={`Order item ${idx + 1}`} className={inp("flex-1 text-[13px]")} />
                          {orderRows.length > 1 && (
                            <button type="button" onClick={() => removeOrderRow(row.key)}
                              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                              <Ic.Trash className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <input type="number" inputMode="decimal" value={row.quantity} onChange={e => setOrderRow(row.key, "quantity", e.target.value)}
                            placeholder="Quantity" className={inp("text-[13px]")} />
                          <input type="number" inputMode="decimal" value={row.price_discussed} onChange={e => setOrderRow(row.key, "price_discussed", e.target.value)}
                            placeholder="Price ₹" className={inp("text-[13px]")} />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div>
                    <Lbl>Remark</Lbl>
                    <textarea value={orderRemark} onChange={e => setOrderRemark(e.target.value)} rows={2}
                      placeholder="Delivery preference, PO to follow, etc…" className={inp("resize-none text-[13px]")} />
                  </div>
                  {errO && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] text-rose-700">{errO}</p>}
                </div>
                <FormFooter>
                  <PBtn type="submit" disabled={savingO} className="h-11 w-full !bg-emerald-600 hover:!bg-emerald-700">
                    {savingO ? <><Ic.Spin className="h-4 w-4 animate-spin" />Saving…</> : `Record ${orderRows.filter(r => r.order_item.trim()).length > 1 ? "Repeat Orders" : "Repeat Order"}`}
                  </PBtn>
                </FormFooter>
              </form>
            )}
          </>
        )}

        {tab === "activity" && (
          <div className="px-4 py-4 sm:px-5">
            {logsLoading ? (
              <div className="py-8 text-center text-sm text-slate-400">Loading…</div>
            ) : !logs || logs.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-400">No history yet</div>
            ) : (
              <div className="space-y-3">
                {logs.map(l => (
                  <div key={l.id} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wide text-indigo-600">{l.action.replace(/_/g, " ")}</span>
                      <span className="text-[10px] text-slate-400">{fmtDateTime(l.changed_at)}</span>
                    </div>
                    {l.reason && <p className="mt-1 text-[12px] text-slate-600">Reason: {l.reason}</p>}
                    {l.remark && <p className="mt-0.5 text-[12px] text-slate-500">{l.remark}</p>}
                    {l.next_followup_at && <p className="mt-0.5 text-[11px] text-sky-600">Next follow-up: {fmtDateTime(l.next_followup_at)}</p>}
                    <p className="mt-1 text-[10px] text-slate-400">by {personLabel(l.user) || "Unknown"}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Sheet>

      {confirmDelete && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/95 backdrop-blur-sm px-6">
          <div className="w-full max-w-xs rounded-2xl border border-rose-100 bg-white p-5 text-center shadow-xl">
            <Ic.Trash className="mx-auto h-8 w-8 text-rose-400 mb-2" />
            <p className="text-sm font-bold text-slate-800">Delete this record permanently?</p>
            <p className="mt-1 text-[12px] text-slate-500">
              This removes {record.party_name}'s purchase history, orders taken, and follow-up history. This cannot be undone.
            </p>
            {delErr && <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1.5 text-[11px] text-rose-700">{delErr}</p>}
            <div className="mt-4 flex gap-2">
              <GBtn onClick={() => setConfirmDelete(false)} className="h-11 flex-1">Cancel</GBtn>
              <PBtn onClick={handleDelete} disabled={deleting} className="h-11 flex-1 !bg-rose-600 hover:!bg-rose-700">
                {deleting ? <><Ic.Spin className="h-4 w-4 animate-spin" />Deleting…</> : "Delete"}
              </PBtn>
            </div>
          </div>
        </div>
      )}

      {showRevertConfirm && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/95 backdrop-blur-sm px-6">
          <div className="w-full max-w-xs rounded-2xl border border-amber-100 bg-white p-5 text-center shadow-xl">
            <Ic.Zap className="mx-auto h-8 w-8 text-amber-400 mb-2" />
            <p className="text-sm font-bold text-slate-800">Revert the last action on this record?</p>
            <p className="mt-1 text-[12px] text-slate-500">
              Undoes the most recent assignment, follow-up, or order taken (all line items from that submission),
              restoring the record to how it was right before that action.
            </p>
            {revertErr && <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1.5 text-[11px] text-rose-700">{revertErr}</p>}
            <div className="mt-4 flex gap-2">
              <GBtn onClick={() => { setShowRevertConfirm(false); setRevertErr(""); }} className="h-11 flex-1">Cancel</GBtn>
              <PBtn onClick={handleRevert} disabled={reverting} className="h-11 flex-1 !bg-amber-600 hover:!bg-amber-700">
                {reverting ? <><Ic.Spin className="h-4 w-4 animate-spin" />Reverting…</> : "Revert"}
              </PBtn>
            </div>
          </div>
        </div>
      )}

      {showEdit && (
        <EditRepeatOrderModal record={record} token={token} onClose={() => setShowEdit(false)}
          onUpdated={(updated) => { onUpdated(updated); setShowEdit(false); }} />
      )}
      {showAssign && (
        <AssignModal record={record} token={token} onClose={() => setShowAssign(false)}
          onAssigned={(updated) => { onUpdated(updated); setShowAssign(false); }} />
      )}
    </Backdrop>
  );
}