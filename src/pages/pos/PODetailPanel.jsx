// pages/pos/PODetailPanel.jsx
import { useState } from "react";
import { Ic } from "../prospects/icons";
import EditPOModal from "./EditPOModal";
import { cls, Lbl, inp, PBtn, Backdrop, Sheet, SheetHead, DRow, GBtn } from "../prospects/ui/primitives";
import { fmtDate, fmtMoney, fmtQty, poDueStatus, dialable, personLabel, buildPoWaMessage, deliveryProgress } from "./utils";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

const TONE_CLS = {
    rose: "text-rose-600 bg-rose-50 ring-rose-200",
    amber: "text-amber-600 bg-amber-50 ring-amber-200",
    sky: "text-sky-600 bg-sky-50 ring-sky-200",
    slate: "text-slate-500 bg-slate-100 ring-slate-200",
};

const EDIT_DELETE_ALLOWED = new Set(["communication@bbmpvtltd.com", "account@bbmpvtltd.com"]);
const TOGGLE_ALLOWED = new Set(["account@bbmpvtltd.com", "communication@bbmpvtltd.com"]);

const REASON_OPTS = [
    "Vendor delayed production", "Awaiting dispatch confirmation", "Transport delay",
    "Quality/spec dispute", "Requested extension", "Partial dispatch expected", "No response", "Other",
];

function todayStr() { return new Date().toISOString().slice(0, 10); }

function ToggleSwitch({ checked, onChange, disabled, label }) {
    return (
        <button type="button" disabled={disabled} onClick={() => onChange(!checked)}
            className={cls("shrink-0 rounded-full p-1 transition-colors", disabled && "opacity-60 cursor-not-allowed")} title={label}>
            <span className={cls("relative inline-flex h-6 w-11 items-center rounded-full transition-colors", checked ? "bg-emerald-500" : "bg-slate-300")}>
                <span className={cls("inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform", checked ? "translate-x-[22px]" : "translate-x-0.5")} />
            </span>
        </button>
    );
}

function FormFooter({ children }) {
    return (
        <div className="sticky bottom-0 -mx-5 mt-1 border-t border-slate-100 bg-white/95 px-5 py-3 backdrop-blur">
            {children}
        </div>
    );
}

export default function PODetailPanel({ po, token, user, onClose, onUpdated, onDeleted }) {
    const [tab, setTab] = useState("delivery");
    const [logs, setLogs] = useState(null);
    const [logsLoading, setLogsLoading] = useState(false);

    const [showRevertConfirm, setShowRevertConfirm] = useState(false);
    const [reverting, setReverting] = useState(false);
    const [revertErr, setRevertErr] = useState("");

    const [remark, setRemark] = useState("");
    const [reason, setReason] = useState("");
    const [customReason, setCustomReason] = useState("");
    const [nextDate, setNextDate] = useState(po.next_followup_date || "");
    const [savingF, setSavingF] = useState(false);
    const [errF, setErrF] = useState("");

    const [deliverQty, setDeliverQty] = useState({}); // { [item_id]: string }
    const [dRemark, setDRemark] = useState("");
    const [dFollowup, setDFollowup] = useState("");
    const [savingAll, setSavingAll] = useState(false);
    const [errD, setErrD] = useState("");

    function tomorrowStr() {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        return d.toISOString().slice(0, 10);
    }



    const [savingToggle, setSavingToggle] = useState(false);
    const [toggleErr, setToggleErr] = useState("");
    const [pendingActive, setPendingActive] = useState(null);

    const [showCancelConfirm, setShowCancelConfirm] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const [cancelErr, setCancelErr] = useState("");

    const dueDate = po.expected_delivery_date;
    const status = poDueStatus(dueDate);
    const isCompleted = po.status === "completed";
    const isCancelled = po.status === "cancelled";
    const isPartial = po.status === "partial";
    const isNotYetActive = !isCompleted && !isCancelled && !po.tracking_active;
    const pendingValue = Number(po.total_amount || 0) - Number(po.delivered_amount || 0);
    const progress = deliveryProgress(po);

    const finalReason = reason === "Other" ? customReason.trim() : reason;

    const [showEdit, setShowEdit] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [delErr, setDelErr] = useState("");

    const canEditDelete = EDIT_DELETE_ALLOWED.has((user?.email || "").toLowerCase());
    const canToggle = TOGGLE_ALLOWED.has((user?.email || "").toLowerCase());

    async function handleRevert() {
        setReverting(true); setRevertErr("");
        try {
            const r = await fetch(`${API}/api/pos/${po.id}/revert-last`, { method: "PUT", headers: { Authorization: `Bearer ${token}` } });
            const d = await r.json();
            if (!r.ok) throw new Error(d.message || "Failed to revert");
            onUpdated(d.po);
            setShowRevertConfirm(false);
        } catch (e) { setRevertErr(e.message); }
        finally { setReverting(false); }
    }

    async function handleDelete() {
        setDeleting(true); setDelErr("");
        try {
            const r = await fetch(`${API}/api/pos/${po.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
            const d = await r.json();
            if (!r.ok) throw new Error(d.message || "Failed to delete");
            onDeleted(po.id);
            onClose();
        } catch (e) { setDelErr(e.message); }
        finally { setDeleting(false); }
    }

    async function handleCancel() {
        setCancelling(true); setCancelErr("");
        try {
            const r = await fetch(`${API}/api/pos/${po.id}/cancel`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ remark: "Cancelled from PO detail view" }),
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d.message || "Failed to cancel");
            onUpdated(d.po);
            setShowCancelConfirm(false);
            onClose();
        } catch (e) { setCancelErr(e.message); }
        finally { setCancelling(false); }
    }

    async function loadLogs() {
        setLogsLoading(true);
        try {
            const r = await fetch(`${API}/api/pos/${po.id}/logs`, { headers: { Authorization: `Bearer ${token}` } });
            const d = await r.json();
            if (d.success) setLogs(d.logs);
        } finally { setLogsLoading(false); }
    }
    function openHistory() { setTab("history"); if (!logs) loadLogs(); }

    async function submitFollowup(e) {
        e.preventDefault();
        if (!finalReason) { setErrF("Select or enter a reason"); return; }
        if (!nextDate) { setErrF("Next follow-up date is required"); return; }
        setSavingF(true); setErrF("");
        try {
            const r = await fetch(`${API}/api/pos/${po.id}/followup`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ remark, reason: finalReason, next_followup_date: nextDate }),
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d.message || "Failed");
            onUpdated(d.bill || d.po);
            onClose();
        } catch (e) { setErrF(e.message); }
        finally { setSavingF(false); }
    }

    // Shared by both the manual "Update Delivery" button and "Mark All Received".
    // qtyMap: { [item_id]: string }, followupOverride: optional explicit date (null = "don't require one, batch completes PO")
    async function runDeliveryUpdate(qtyMap, followupOverride) {
    setErrD("");
    const pendingItems = (po.items || []).filter(
        it => it.status !== "received" && qtyMap[it.id] !== undefined && qtyMap[it.id] !== ""
    );
    if (pendingItems.length === 0) { setErrD("Enter a delivered quantity for at least one item"); return; }

    for (const item of pendingItems) {
        const qty = Number(qtyMap[item.id]);
        if (!Number.isFinite(qty)) { setErrD(`Enter a valid quantity for ${item.product_name}`); return; }
        if (qty < Number(item.delivered_qty)) { setErrD(`Delivered quantity cannot decrease for ${item.product_name} — use Revert Last Action instead`); return; }
        if (qty > Number(item.order_qty)) { setErrD(`Cannot exceed ordered quantity for ${item.product_name}`); return; }
    }

    const willCompletePO = po.items.every(it => {
        const match = pendingItems.find(p => p.id === it.id);
        const finalQty = match ? Number(qtyMap[it.id]) : Number(it.delivered_qty);
        return finalQty >= Number(it.order_qty);
    });

    const followup = followupOverride !== undefined ? followupOverride : dFollowup;
    if (!willCompletePO && !followup) {
        setErrD("Next follow-up date is required unless this update completes the PO");
        return;
    }

    setSavingAll(true);
    try {
        let latestPO = po;
        for (let i = 0; i < pendingItems.length; i++) {
        const item = pendingItems[i];
        const isLast = i === pendingItems.length - 1;
        const qty = Number(qtyMap[item.id]);
        // Every step except the one that actually finishes the PO must carry a
        // real follow-up date — the server rechecks rollup status after each
        // single-item write and rejects "partial" without one. The value is
        // moot for the in-between steps since the next call overwrites it.
        const stepFollowup = (isLast && willCompletePO) ? null : (followup || tomorrowStr());

        const r = await fetch(`${API}/api/pos/${po.id}/delivery`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ item_id: item.id, delivered_qty: qty, remark: dRemark, next_followup_date: stepFollowup }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.message || `Failed to update ${item.product_name}`);
        latestPO = d.po;
        }
        onUpdated(latestPO);
        setDeliverQty({}); setDRemark(""); setDFollowup("");
        onClose();
    } catch (e) { setErrD(e.message); }
    finally { setSavingAll(false); }
    }

    async function submitAllDeliveries() {
    await runDeliveryUpdate(deliverQty);
    }

    async function markAllReceivedAndSave() {
    const qtyMap = {};
    (po.items || []).forEach(it => { if (it.status !== "received") qtyMap[it.id] = String(it.order_qty); });
    setDeliverQty(qtyMap);
    await runDeliveryUpdate(qtyMap, null); // all items → order_qty, so this always completes the PO
    }
    
    async function toggleTrackingActive(nextVal) {
        setToggleErr("");
        setPendingActive(nextVal);
        setSavingToggle(true);
        try {
            const r = await fetch(`${API}/api/pos/${po.id}/tracking-toggle`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ active: nextVal }),
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d.message || "Failed to update");
            onUpdated(d.po);
        } catch (e) { setToggleErr(e.message); }
        finally { setSavingToggle(false); setPendingActive(null); }
    }

    return (
        <Backdrop onClick={onClose}>
            <Sheet>
                <SheetHead
                    title={po.party_name}
                    subtitle={`Order ${po.order_no} · ${fmtDate(po.order_date)}`}
                    onClose={onClose}
                    extraActions={
                        <>
                            <span className={cls("rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset",
                                isCompleted ? "bg-emerald-50 text-emerald-600 ring-emerald-200"
                                : isCancelled ? "bg-slate-100 text-slate-500 ring-slate-200"
                                : isNotYetActive ? "bg-slate-100 text-slate-500 ring-slate-200"
                                : TONE_CLS[status.tone])}>
                                    {isCompleted ? "Delivered" : isCancelled ? "Cancelled" : isPartial ? "Partial" : status.label}
                            </span>
                            {canEditDelete && (
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

                <div className="px-5 pt-3">
                    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-3">
                        <p className="break-words text-[16px] font-extrabold leading-snug text-slate-900">{po.party_name}</p>
                        <p className="mt-1 break-words text-[12px] text-slate-500">Order #{po.order_no} · {fmtDate(po.order_date)}</p>
                        {po.updated_at && (
                            <p className="mt-0.5 text-[10.5px] text-slate-400">
                                Last updated {new Date(po.updated_at).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </p>
                        )}
                    </div>
                </div>

                {po.mobile_1 && (
                    <div className="flex gap-2 px-5 pt-3">
                        <a href={`tel:${po.mobile_1}`}
                            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 text-[13px] font-bold text-emerald-700 active:scale-[0.97] transition-transform">
                            <Ic.Phone className="h-4 w-4" /> Call
                        </a>
                        <a href={`https://wa.me/${dialable(po.mobile_1)}?text=${encodeURIComponent(buildPoWaMessage(po))}`} target="_blank" rel="noopener noreferrer"
                            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-green-200 bg-green-50 text-[13px] font-bold text-green-700 active:scale-[0.97] transition-transform">
                            WhatsApp
                        </a>
                    </div>
                )}

                <div className="px-5 pt-3">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Total Order Value</p>
                            <p className="mt-0.5 text-[15px] font-extrabold text-slate-800">{fmtMoney(po.total_amount)}</p>
                        </div>
                        <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Pending Value</p>
                            <p className={cls("mt-0.5 text-[15px] font-extrabold", isCompleted ? "text-emerald-600" : "text-rose-600")}>{fmtMoney(pendingValue)}</p>
                        </div>
                    </div>

                    {/* Delivery progress */}
                    <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-3">
                        <div className="flex items-center justify-between">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                            Delivery Progress
                            </p>
                            <p className="text-[11px] font-semibold text-slate-600">
                            {fmtQty(po.total_delivered_qty)} / {fmtQty(po.total_order_qty)} units
                            </p>
                        </div>

                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gradient-to-r from-red-500 via-amber-400 to-emerald-500 relative">
                            <div
                                className="absolute right-0 top-0 h-full bg-slate-100 transition-all duration-500"
                                style={{
                                width: `${100 - progress * 100}%`,
                                }}
                            />
                        </div>
                    </div>

                    {!isCompleted && !isCancelled && canToggle && (
                        <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-3">
                            <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Tracking Active</p>
                                    <p className="mt-0.5 text-[11px] text-slate-500">
                                        {savingToggle
                                            ? "Saving…"
                                            : po.is_snoozed
                                                ? `Snoozed — reactivates on ${fmtDate(po.snoozed_until)}`
                                                : po.tracking_active_is_manual
                                                    ? `Manually turned ${po.tracking_active ? "ON" : "OFF"}`
                                                    : po.tracking_active
                                                        ? "Auto — expected delivery date reached"
                                                        : "Auto — waiting for lead time to end"}
                                    </p>
                                </div>
                                <div className={cls("shrink-0 transition-opacity", savingToggle && "opacity-60")}>
                                    <ToggleSwitch
                                        checked={pendingActive !== null ? pendingActive : !!po.tracking_active}
                                        disabled={!canToggle || savingToggle}
                                        onChange={toggleTrackingActive}
                                        label={canToggle ? "Toggle tracking active" : "Only Account team can override this"}
                                    />
                                </div>
                            </div>
                            {toggleErr && <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] text-rose-700">{toggleErr}</p>}
                        </div>
                    )}

                    {canToggle && !isCancelled && (
                        <div className="mt-3 flex gap-2">
                            <button onClick={() => { setShowRevertConfirm(true); setRevertErr(""); }}
                                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[12px] font-bold text-amber-700 active:scale-[0.99] transition-transform">
                                <Ic.Zap className="h-3.5 w-3.5" /> Revert Last Action
                            </button>
                            {/* {!isCompleted && (
                                <button onClick={() => { setShowCancelConfirm(true); setCancelErr(""); }}
                                    className="flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[12px] font-bold text-rose-700 active:scale-[0.99] transition-transform">
                                    Cancel PO
                                </button>
                            )} */}
                        </div>
                    )}

                    <div className="mt-3 space-y-0.5">
                        <DRow label="Order Date" value={fmtDate(po.order_date)} />
                        <DRow label="Lead Days" value={`${po.lead_days ?? 0} day(s)`} />
                        <DRow label="Expected Delivery" value={fmtDate(dueDate)} />
                        {po.location && <DRow label="Location" value={po.location} />}
                        {po.mobile_1 && <DRow label="Contact Number" value={po.mobile_1} />}
                        {po.mobile_2 && <DRow label="Contact Number" value={po.mobile_2} />}
                        {!isCompleted && !isCancelled && <DRow label="Days Outstanding" value={status.label} />}
                        {po.is_snoozed && po.snoozed_until && (
                            <DRow label="Snoozed until" value={<span className="font-semibold text-sky-600">{fmtDate(po.snoozed_until)}</span>} />
                        )}
                        {po.last_reason && <DRow label="Last reason" value={po.last_reason} />}
                        {po.next_followup_date && !isCompleted && <DRow label="Next follow-up" value={fmtDate(po.next_followup_date)} />}
                    </div>
                </div>

                <div className="mt-4 flex gap-1 border-b border-slate-100 bg-white px-5 pt-1">
                    {[
                        { id: "delivery", label: "Delivery", icon: Ic.Check },
                        { id: "followup", label: "Follow-up", icon: Ic.Zap },
                        { id: "history", label: "History", icon: Ic.Cal },
                    ].map(t => (
                        <button key={t.id} onClick={t.id === "history" ? openHistory : () => setTab(t.id)}
                            className={cls("flex flex-1 items-center justify-center gap-1.5 border-b-2 py-3 text-[12.5px] font-semibold transition-colors active:opacity-70",
                                tab === t.id ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-400")}>
                            <t.icon className="h-3.5 w-3.5" />{t.label}
                        </button>
                    ))}
                </div>

                {tab === "delivery" && (
                    <div className="flex flex-col px-5 py-4">
                        {isCancelled ? (
                            <p className="rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-4 text-center text-[12px] text-slate-500">
                                This PO was cancelled — no further deliveries can be recorded.
                            </p>
                        ) : (
                            <>
                                <div className="space-y-3">
                                    {(po.items || []).map(item => {
                                        const itemDone = item.status === "received";
                                        return (
                                            <div key={item.id} className={cls("rounded-xl border px-3.5 py-3", itemDone ? "border-emerald-100 bg-emerald-50/40" : "border-slate-100 bg-slate-50")}>
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <p className="break-words text-[13px] font-bold text-slate-800">{item.product_name}</p>
                                                        <p className="mt-0.5 text-[11px] text-slate-500">
                                                            {fmtQty(item.delivered_qty)} / {fmtQty(item.order_qty)} delivered · {fmtMoney(item.amount)}
                                                        </p>
                                                    </div>
                                                    <span className={cls("shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold ring-1 ring-inset",
                                                        itemDone ? "bg-emerald-50 text-emerald-600 ring-emerald-200"
                                                            : item.status === "partial" ? "bg-sky-50 text-sky-600 ring-sky-200"
                                                                : "bg-slate-100 text-slate-500 ring-slate-200")}>
                                                        {itemDone ? "Received" : item.status === "partial" ? "Partial" : "Pending"}
                                                    </span>
                                                </div>

                                                {!itemDone && canToggle && (
                                                    <div className="mt-2.5 flex items-end gap-2">
                                                        <div className="flex-1">
                                                            <Lbl>Delivered Qty <span className="normal-case font-normal text-slate-400">(cumulative, max {fmtQty(item.order_qty)})</span></Lbl>
                                                            <input type="number" inputMode="decimal" min={item.delivered_qty} max={item.order_qty}
                                                                placeholder={fmtQty(item.delivered_qty)}
                                                                value={deliverQty[item.id] ?? ""}
                                                                onChange={e => setDeliverQty(q => ({ ...q, [item.id]: e.target.value }))}
                                                                className={inp("text-[13px]")} />
                                                        </div>
                                                        <button type="button"
                                                            onClick={() => setDeliverQty(q => ({ ...q, [item.id]: String(item.order_qty) }))}
                                                            className="h-11 shrink-0 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-[11px] font-bold text-emerald-700 active:scale-95 transition-transform">
                                                            Mark Received
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}

                                    {po.items && po.items.some(it => it.status !== "received") && canToggle && (
                                        <div className="rounded-xl border border-slate-100 bg-white px-3.5 py-3 space-y-2.5">
                                            <div>
                                                <Lbl>Remark</Lbl>
                                                <textarea value={dRemark} onChange={e => setDRemark(e.target.value)} rows={2}
                                                    placeholder="Dispatch details, transporter, notes…" className={inp("resize-none text-[13px]")} />
                                            </div>
                                            <div>
                                                <Lbl>Next Follow-up Date <span className="normal-case font-normal text-slate-400">(required unless this update completes the PO)</span></Lbl>
                                                <input type="date" value={dFollowup} min={todayStr()} onChange={e => setDFollowup(e.target.value)} className={inp()} />
                                            </div>
                                        </div>
                                    )}

                                    {!canToggle && (
                                        <p className="text-[11px] text-slate-400">Only Account/Communication team can record deliveries.</p>
                                    )}

                                    {errD && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] text-rose-700">{errD}</p>}
                                </div>

                                {canToggle && po.items && po.items.some(it => it.status !== "received") && (
                                    <FormFooter>
                                        <div className="flex flex-col gap-2">
                                        <PBtn type="button" onClick={submitAllDeliveries} disabled={savingAll} className="h-12 w-full">
                                            {savingAll ? <><Ic.Spin className="h-4 w-4 animate-spin" />Updating…</> : "Update Delivery"}
                                        </PBtn>
                                        <button type="button" onClick={markAllReceivedAndSave} disabled={savingAll}
                                            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 text-[13px] font-bold text-emerald-700 active:scale-[0.99] transition-transform disabled:opacity-60">
                                            {savingAll ? <><Ic.Spin className="h-4 w-4 animate-spin" />Saving…</> : "Mark All Received & Save"}
                                        </button>
                                        </div>
                                    </FormFooter>
                                )}
                            </>
                        )}
                    </div>
                )}

                {tab === "followup" && (
                    <form onSubmit={submitFollowup} className="flex flex-col px-5 py-4">
                        <div className="space-y-3">
                            <div>
                                <Lbl required>Reason order wasn't delivered</Lbl>
                                <div className="flex flex-wrap gap-1.5">
                                    {REASON_OPTS.map(r => (
                                        <button key={r} type="button" onClick={() => setReason(r)}
                                            className={cls("rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors active:scale-95",
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
                                <Lbl required>Next Follow-up Date</Lbl>
                                <input type="date" value={nextDate} min={todayStr()} onChange={e => setNextDate(e.target.value)} className={inp()} />
                            </div>
                            {errF && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] text-rose-700">{errF}</p>}
                        </div>
                        <FormFooter>
                            <PBtn type="submit" disabled={savingF} className="h-12 w-full">
                                {savingF ? <><Ic.Spin className="h-4 w-4 animate-spin" />Saving…</> : "Save Follow-up"}
                            </PBtn>
                        </FormFooter>
                    </form>
                )}

                {tab === "history" && (
                    <div className="px-5 py-4">
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
                                            {l.status?.startsWith("snoozed_until_") && (
                                                <span className="ml-2 rounded-full bg-sky-50 px-2 py-0.5 text-[9px] font-bold text-sky-600 ring-1 ring-inset ring-sky-200">
                                                    snoozed → {fmtDate(l.status.replace("snoozed_until_", ""))}
                                                </span>
                                            )}
                                            <span className="text-[10px] text-slate-400">{new Date(l.changed_at).toLocaleString("en-IN")}</span>
                                        </div>
                                        {l.reason && <p className="mt-1 text-[12px] text-slate-600">Reason: {l.reason}</p>}
                                        {l.remark && <p className="mt-0.5 text-[12px] text-slate-500">{l.remark}</p>}
                                        {l.next_followup_date && <p className="mt-0.5 text-[11px] text-sky-600">Next follow-up: {fmtDate(l.next_followup_date)}</p>}
                                        {l.delivered_qty != null && (
                                            <p className="mt-0.5 text-[12px] font-semibold text-emerald-600">
                                                Delivered qty updated to {fmtQty(l.delivered_qty)}
                                            </p>
                                        )}
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
                        <p className="text-sm font-bold text-slate-800">Delete this PO permanently?</p>
                        <p className="mt-1 text-[12px] text-slate-500">
                            This removes {po.party_name}'s order #{po.order_no}, all line items, and its entire follow-up history. This cannot be undone.
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
                        <p className="text-sm font-bold text-slate-800">Revert the last action on this PO?</p>
                        <p className="mt-1 text-[12px] text-slate-500">
                            Undoes the most recent follow-up, delivery update, or tracking-status change, restoring the PO to how it was right before that action.
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
            {showCancelConfirm && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/95 backdrop-blur-sm px-6">
                    <div className="w-full max-w-xs rounded-2xl border border-rose-100 bg-white p-5 text-center shadow-xl">
                        <Ic.Trash className="mx-auto h-8 w-8 text-rose-400 mb-2" />
                        <p className="text-sm font-bold text-slate-800">Cancel this PO?</p>
                        <p className="mt-1 text-[12px] text-slate-500">
                            Marks order #{po.order_no} as cancelled. It stays in the system for records but drops out of active tracking.
                        </p>
                        {cancelErr && <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1.5 text-[11px] text-rose-700">{cancelErr}</p>}
                        <div className="mt-4 flex gap-2">
                            <GBtn onClick={() => { setShowCancelConfirm(false); setCancelErr(""); }} className="h-11 flex-1">Keep PO</GBtn>
                            <PBtn onClick={handleCancel} disabled={cancelling} className="h-11 flex-1 !bg-rose-600 hover:!bg-rose-700">
                                {cancelling ? <><Ic.Spin className="h-4 w-4 animate-spin" />Cancelling…</> : "Cancel PO"}
                            </PBtn>
                        </div>
                    </div>
                </div>
            )}
            {showEdit && (
                <EditPOModal po={po} token={token} onClose={() => setShowEdit(false)}
                    onUpdated={(updated) => { onUpdated(updated); setShowEdit(false); }} />
            )}
        </Backdrop>
    );
}