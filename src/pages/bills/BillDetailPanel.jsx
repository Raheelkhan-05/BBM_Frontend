// pages/bills/BillDetailPanel.jsx
import { useState } from "react";
import { Ic } from "../prospects/icons";
import EditBillModal from "./EditBillModal";
import { cls, Lbl, inp, PBtn, Backdrop, Sheet, SheetHead, DRow, GBtn } from "../prospects/ui/primitives";
import { fmtDate, fmtMoney, billDueStatus, dialable, personLabel, buildWaMessage } from "./utils";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

const TONE_CLS = {
  rose: "text-rose-600 bg-rose-50 ring-rose-200",
  amber: "text-amber-600 bg-amber-50 ring-amber-200",
  sky: "text-sky-600 bg-sky-50 ring-sky-200",
  slate: "text-slate-500 bg-slate-100 ring-slate-200",
};


const EDIT_DELETE_ALLOWED = new Set(["communication@bbmpvtltd.com","account@bbmpvtltd.com"]);

// Same set as the backend's requireBillToggleAccess — can override the
// Collection Active toggle and resolve pending cheques.
const TOGGLE_ALLOWED = new Set(["account@bbmpvtltd.com", "communication@bbmpvtltd.com"]);

const REASON_OPTS = [
  "Party not available", "Payment promised - awaiting", "Dispute on amount",
  "Cheque bounced", "Requested extension", "Partial payment expected", "No response", "Other",
];

const PAYMENT_MODES = [
  { id: "cash", label: "Cash", icon: "💵" },
  { id: "upi", label: "UPI", icon: "📱" },
  { id: "bank_transfer", label: "Bank", icon: "🏦" },
  { id: "cheque", label: "Cheque", icon: "🧾" },
];

function todayStr() { return new Date().toISOString().slice(0, 10); }

// Small pill switch — no new icon dependency, just a styled button.
function ToggleSwitch({ checked, onChange, disabled, label }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cls("shrink-0 rounded-full p-1 transition-colors", disabled && "opacity-60 cursor-not-allowed")}
      title={label}
    >
      <span className={cls(
        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
        checked ? "bg-emerald-500" : "bg-slate-300"
      )}>
        <span className={cls(
          "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-[22px]" : "translate-x-0.5"
        )} />
      </span>
    </button>
  );
}

// Sticky footer wrapper for primary form CTAs — keeps the button thumb-reachable
// on tall mobile screens instead of requiring a scroll to the bottom of the form.
function FormFooter({ children }) {
  return (
    <div className="sticky bottom-0 -mx-5 mt-1 border-t border-slate-100 bg-white/95 px-5 py-3 backdrop-blur">
      {children}
    </div>
  );
}

export default function BillDetailPanel({ bill, token, user, onClose, onUpdated, onDeleted }) {
  const [tab, setTab] = useState("followup");
  const [logs, setLogs] = useState(null);
  const [logsLoading, setLogsLoading] = useState(false);

  const [showRevertConfirm, setShowRevertConfirm] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [revertErr, setRevertErr] = useState("");


  const [remark, setRemark]     = useState("");
  const [reason, setReason]     = useState("");
  const [customReason, setCustomReason] = useState("");
  const [nextDate, setNextDate] = useState(bill.next_followup_date || "");
  const [savingF, setSavingF]   = useState(false);
  const [errF, setErrF]         = useState("");

  const [amount, setAmount]         = useState("");
  const [isFullPayment, setIsFullPayment] = useState(false);
  const [paymentMode, setPaymentMode]     = useState("bank_transfer");
  const [chequeDate, setChequeDate]       = useState("");
  const [chequeNo, setChequeNo]           = useState("");
  const [bankName, setBankName]           = useState("");
  const [payFollowup, setPayFollowup]     = useState("");
  const [pRemark, setPRemark]             = useState("");
  const [savingP, setSavingP]             = useState(false);
  const [errP, setErrP]                   = useState("");

  const [savingToggle, setSavingToggle]   = useState(false);
  const [toggleErr, setToggleErr]         = useState("");
  const [pendingActive, setPendingActive] = useState(null); // optimistic value while a toggle request is in flight
  const [chequeActionErr, setChequeActionErr] = useState("");
  const [chequeActioning, setChequeActioning] = useState(null); // "clear" | "bounce" | null
  const [chequeResolveDate, setChequeResolveDate] = useState("");

  const dueDate = bill.due_date || bill.bill_date;
  const status = billDueStatus(dueDate);
  const isCompleted = bill.status === "completed";
  const isChequePending = bill.status === "cheque_pending";
  const balance = Number(bill.balance_amount || 0);
  const pendingCheque = (bill.cheques || []).find(c => c.status === "pending");

  const finalReason = reason === "Other" ? customReason.trim() : reason;
  const enteredAmount = isFullPayment ? balance : Number(amount);
  const remainingAfter = Math.max(0, balance - (enteredAmount || 0));
  const willBeComplete = enteredAmount >= balance && enteredAmount > 0;
  const isFuturePostDatedCheque = paymentMode === "cheque" && chequeDate && chequeDate > todayStr();

  const [showEdit, setShowEdit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [delErr, setDelErr] = useState("");


  const canEditDelete = EDIT_DELETE_ALLOWED.has((user?.email || "").toLowerCase());
  const canToggle = TOGGLE_ALLOWED.has((user?.email || "").toLowerCase());

  async function handleRevert() {
    setReverting(true); setRevertErr("");
    try {
      const r = await fetch(`${API}/api/bills/${bill.id}/revert-last`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "Failed to revert");
      onUpdated(d.bill);
      setShowRevertConfirm(false);
    } catch (e) { setRevertErr(e.message); }
    finally { setReverting(false); }
  }

  async function handleDelete() {
    setDeleting(true); setDelErr("");
    try {
      const r = await fetch(`${API}/api/bills/${bill.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "Failed to delete");
      onDeleted(bill.id);
      onClose();
    } catch (e) { setDelErr(e.message); }
    finally { setDeleting(false); }
  }

  async function loadLogs() {
    setLogsLoading(true);
    try {
      const r = await fetch(`${API}/api/bills/${bill.id}/logs`, { headers: { Authorization: `Bearer ${token}` } });
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
      const r = await fetch(`${API}/api/bills/${bill.id}/followup`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ remark, reason: finalReason, next_followup_date: nextDate }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "Failed");
      onUpdated(d.bill);
      onClose();
    } catch (e) { setErrF(e.message); }
    finally { setSavingF(false); }
  }

  async function submitPayment(e) {
    e.preventDefault();
    const amt = isFullPayment ? balance : Number(amount);
    if (!amt || amt <= 0) { setErrP("Enter a valid amount"); return; }
    if (amt > balance) { setErrP(`Cannot exceed balance of ${fmtMoney(balance)}`); return; }
    if (paymentMode === "cheque" && !chequeDate) { setErrP("Enter the cheque date"); return; }

    const willComplete = amt >= balance;
    if (!isFuturePostDatedCheque && !willComplete && !payFollowup) {
      setErrP("Partial payment — next follow-up date is required to chase the remaining balance");
      return;
    }

    setSavingP(true); setErrP("");
    try {
      const r = await fetch(`${API}/api/bills/${bill.id}/payment`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          amount: amt,
          remark: pRemark,
          next_followup_date: willComplete ? null : payFollowup,
          payment_mode: paymentMode,
          cheque_date: paymentMode === "cheque" ? chequeDate : null,
          cheque_no: paymentMode === "cheque" ? chequeNo : null,
          bank_name: paymentMode === "cheque" ? bankName : null,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "Failed");
      onUpdated(d.bill);
      onClose();
    } catch (e) { setErrP(e.message); }
    finally { setSavingP(false); }
  }

  async function toggleCollectionActive(nextVal) {
    setToggleErr("");
    setPendingActive(nextVal); // flip the switch immediately, don't wait on the network
    setSavingToggle(true);
    try {
      const r = await fetch(`${API}/api/bills/${bill.id}/collection-toggle`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ active: nextVal }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "Failed to update");
      onUpdated(d.bill);
    } catch (e) {
      setToggleErr(e.message); // pendingActive clears in finally, snapping the switch back
    } finally {
      setSavingToggle(false);
      setPendingActive(null);
    }
  }

  async function resolveCheque(action) {
    if (!pendingCheque) return;
    setChequeActionErr("");
    const wouldRemain = action === "bounce" || Number(pendingCheque.amount) < balance;
    if (wouldRemain && !chequeResolveDate) {
      setChequeActionErr("Next follow-up date is required");
      return;
    }
    setChequeActioning(action);
    try {
      const r = await fetch(`${API}/api/bills/${bill.id}/cheque/${pendingCheque.id}/${action}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ next_followup_date: chequeResolveDate || null }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "Failed");
      onUpdated(d.bill);
      onClose();
    } catch (e) { setChequeActionErr(e.message); }
    finally { setChequeActioning(null); }
  }

  return (
    <Backdrop onClick={onClose}>
      <Sheet>
        <SheetHead
            title={bill.party_name}
            subtitle={`Bill ${bill.bill_no} · ${fmtDate(bill.bill_date)}`}
            onClose={onClose}
            extraActions={
                <>
                <span className={cls("rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset",
                  isCompleted ? "bg-emerald-50 text-emerald-600 ring-emerald-200"
                  : isChequePending ? "bg-sky-50 text-sky-600 ring-sky-200"
                  : TONE_CLS[status.tone])}>
                    {isCompleted ? "Completed" : isChequePending ? "Cheque Pending" : status.label}
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

        {/* Full identity block — never truncated, shown in full regardless of
            how SheetHead renders the title/subtitle above */}
        <div className="px-5 pt-3">
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-3">
            <p className="break-words text-[16px] font-extrabold leading-snug text-slate-900">{bill.party_name}</p>
            <p className="mt-1 break-words text-[12px] text-slate-500">
              Bill #{bill.bill_no} · {fmtDate(bill.bill_date)}
            </p>
            {bill.updated_at && (
              <p className="mt-0.5 text-[10.5px] text-slate-400">
                Last updated {new Date(bill.updated_at).toLocaleString("en-IN", {
                  day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                })}
              </p>
            )}
          </div>
        </div>

        {/* Quick-call bar — one thumb-reach away from the header, WhatsApp-style */}
        {bill.mobile_1 && (
          <div className="flex gap-2 px-5 pt-3">
            <a href={`tel:${bill.mobile_1}`}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 text-[13px] font-bold text-emerald-700 active:scale-[0.97] transition-transform">
              <Ic.Phone className="h-4 w-4" /> Call
            </a>
            <a href={`https://wa.me/${dialable(bill.mobile_1)}?text=${encodeURIComponent(buildWaMessage(bill))}`} target="_blank" rel="noopener noreferrer"
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-green-200 bg-green-50 text-[13px] font-bold text-green-700 active:scale-[0.97] transition-transform">
              WhatsApp
            </a>
          </div>
        )}

        <div className="px-5 pt-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Bill Amount</p>
              <p className="mt-0.5 text-[15px] font-extrabold text-slate-800">{fmtMoney(bill.bill_amount)}</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Balance</p>
              <p className={cls("mt-0.5 text-[15px] font-extrabold", isCompleted ? "text-emerald-600" : "text-rose-600")}>{fmtMoney(balance)}</p>
            </div>
          </div>

          {/* Collection Active toggle */}
          <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Collection Active</p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {savingToggle
                    ? "Saving…"
                    : bill.is_snoozed
                      ? `Snoozed — reactivates on ${fmtDate(bill.snoozed_until)}`
                      : bill.collection_active_is_manual
                      ? `Manually turned ${bill.collection_active ? "ON" : "OFF"}`
                      : bill.collection_active
                        ? "Auto — due date reached"
                        : "Auto — waiting for credit period to end"}
                </p>
              </div>
              <div className={cls("shrink-0 transition-opacity", savingToggle && "opacity-60")}>
                <ToggleSwitch
                  checked={pendingActive !== null ? pendingActive : !!bill.collection_active}
                  disabled={!canToggle || savingToggle}
                  onChange={toggleCollectionActive}
                  label={canToggle ? "Toggle collection active" : "Only Account/Communication team can override this"}
                />
              </div>
            </div>
            {toggleErr && (
              <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] text-rose-700">{toggleErr}</p>
            )}
          </div>

          {canToggle && (
            <div className="mt-3">
              <button onClick={() => { setShowRevertConfirm(true); setRevertErr(""); }}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[12px] font-bold text-amber-700 active:scale-[0.99] transition-transform">
                <Ic.Zap className="h-3.5 w-3.5" /> Revert Last Action
              </button>
            </div>
          )}

          <div className="mt-3 space-y-0.5">
            <DRow label="Bill Date" value={fmtDate(bill.bill_date)} />
            <DRow label="Credit Days" value={`${bill.credit_days ?? 0} day(s)`} />
            <DRow label="Due Date" value={fmtDate(dueDate)} />
            {bill.location && <DRow label="Location" value={bill.location} />}
            {bill.mobile_1 && <DRow label="Contact Number" value={bill.mobile_1} />}
            {bill.mobile_2 && <DRow label="Contact Number" value={bill.mobile_2} />}
            <DRow label="Days Outstanding" value={status.label} />
            {bill.is_snoozed && bill.snoozed_until && (
              <DRow label="Snoozed until" value={
                <span className="font-semibold text-sky-600">{fmtDate(bill.snoozed_until)}</span>
              } />
            )}
            <DRow label="Collected so far" value={fmtMoney(bill.payment_collected)} />
            {bill.last_reason && <DRow label="Last reason" value={bill.last_reason} />}
            {bill.next_followup_date && bill.status !== "completed" && <DRow label="Next follow-up" value={fmtDate(bill.next_followup_date)} />}
          </div>
        </div>

        {/* Pending cheque banner + resolve actions */}
        {isChequePending && pendingCheque && (
          <div className="mx-5 mt-4 rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-sky-700">Cheque Pending</p>
            <p className="mt-1 text-[13px] font-semibold text-sky-800">
              {fmtMoney(pendingCheque.amount)} · dated {fmtDate(pendingCheque.cheque_date)}
              {pendingCheque.cheque_no ? ` · #${pendingCheque.cheque_no}` : ""}
            </p>
            {pendingCheque.bank_name && <p className="text-[11px] text-sky-600">{pendingCheque.bank_name}</p>}
            {pendingCheque.remark && <p className="mt-1 text-[11px] text-sky-600">{pendingCheque.remark}</p>}

            {canToggle ? (
              <div className="mt-2.5 space-y-2">
                <div>
                  <Lbl>Next Follow-up Date <span className="normal-case font-normal text-slate-400">(used only if balance remains, or on bounce)</span></Lbl>
                  <input type="date" value={chequeResolveDate} min={todayStr()} onChange={e => setChequeResolveDate(e.target.value)} className={inp()} />
                </div>
                {chequeActionErr && <p className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] text-rose-700">{chequeActionErr}</p>}
                <div className="flex gap-2">
                  <PBtn type="button" onClick={() => resolveCheque("clear")} disabled={chequeActioning !== null} className="h-11 flex-1 !bg-emerald-600 hover:!bg-emerald-700">
                    {chequeActioning === "clear" ? <><Ic.Spin className="h-4 w-4 animate-spin" />Marking…</> : <><Ic.Check className="h-4 w-4" />Mark Received</>}
                  </PBtn>
                  <GBtn type="button" onClick={() => resolveCheque("bounce")} disabled={chequeActioning !== null} className="h-11 flex-1 !border-rose-200 !text-rose-600 hover:!bg-rose-50">
                    {chequeActioning === "bounce" ? <><Ic.Spin className="h-4 w-4 animate-spin" />Marking…</> : "Mark Bounced"}
                  </GBtn>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-[11px] text-sky-600">Only Account/Communication team can resolve this cheque.</p>
            )}
          </div>
        )}

        <div className="mt-4 flex gap-1 border-b border-slate-100 bg-white px-5 pt-1">
          {[
            { id: "followup", label: "Follow-up", icon: Ic.Zap },
            { id: "payment",  label: "Payment",    icon: Ic.Check },
            { id: "history",  label: "History",    icon: Ic.Cal },
          ].map(t => (
            <button key={t.id} onClick={t.id === "history" ? openHistory : () => setTab(t.id)}
              className={cls("flex flex-1 items-center justify-center gap-1.5 border-b-2 py-3 text-[12.5px] font-semibold transition-colors active:opacity-70",
                tab === t.id ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-400")}>
              <t.icon className="h-3.5 w-3.5" />{t.label}
            </button>
          ))}
        </div>

        {tab === "followup" && (
          <form onSubmit={submitFollowup} className="flex flex-col px-5 py-4">
            <div className="space-y-3">
              <div>
                <Lbl required>Reason payment wasn't collected</Lbl>
                <div className="flex flex-wrap gap-1.5">
                  {REASON_OPTS.map(r => (
                    <button key={r} type="button" onClick={() => setReason(r)}
                      className={cls(
                        "rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors active:scale-95",
                        reason === r ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-500"
                      )}>
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

        {tab === "payment" && (
          <form onSubmit={submitPayment} className="flex flex-col px-5 py-4">
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => { setIsFullPayment(v => !v); setAmount(""); setErrP(""); }}
                className={cls(
                  "flex w-full items-center justify-between rounded-xl border-2 px-3.5 py-3 text-[13px] font-bold transition-colors active:scale-[0.99]",
                  isFullPayment ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-600"
                )}
              >
                <span className="flex items-center gap-2">
                  <div className={cls("flex h-4 w-4 items-center justify-center rounded-full border-2 shrink-0", isFullPayment ? "border-emerald-600 bg-emerald-600" : "border-slate-300")}>
                    {isFullPayment && <Ic.Check className="h-2.5 w-2.5 text-white" />}
                  </div>
                  Full payment received ({fmtMoney(balance)})
                </span>
              </button>

              {!isFullPayment && (
                <div>
                  <Lbl required>Amount Collected</Lbl>
                  <input type="number" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder={`Max ${fmtMoney(balance)}`} className={inp()} />
                </div>
              )}

              <div>
                <Lbl required>Payment Mode</Lbl>
                <div className="grid grid-cols-4 gap-1.5">
                  {PAYMENT_MODES.map(m => (
                    <button key={m.id} type="button" onClick={() => { setPaymentMode(m.id); setErrP(""); }}
                      className={cls(
                        "flex flex-col items-center gap-1 rounded-xl border py-2.5 text-[11px] font-semibold transition-colors active:scale-95",
                        paymentMode === m.id ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-500"
                      )}>
                      <span className="text-[16px] leading-none">{m.icon}</span>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {paymentMode === "cheque" && (
                <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
                  <div>
                    <Lbl required>Cheque Date</Lbl>
                    <input type="date" value={chequeDate} onChange={e => setChequeDate(e.target.value)} className={inp()} />
                    {isFuturePostDatedCheque && (
                      <p className="mt-1.5 text-[11px] text-sky-600">
                        Post-dated — this bill will move to "Cheque Pending" and won't count as collected until you mark it received on/after this date.
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Lbl>Cheque No.</Lbl>
                      <input value={chequeNo} onChange={e => setChequeNo(e.target.value)} className={inp()} />
                    </div>
                    <div>
                      <Lbl>Bank Name</Lbl>
                      <input value={bankName} onChange={e => setBankName(e.target.value)} className={inp()} />
                    </div>
                  </div>
                </div>
              )}

              {!isFuturePostDatedCheque && !willBeComplete && (
                <div>
                  <Lbl required>Next Follow-up Date <span className="normal-case font-normal text-slate-400">(for remaining {fmtMoney(remainingAfter)})</span></Lbl>
                  <input type="date" value={payFollowup} min={todayStr()} onChange={e => setPayFollowup(e.target.value)} className={inp()} />
                </div>
              )}

              <div>
                <Lbl>Remark</Lbl>
                <textarea value={pRemark} onChange={e => setPRemark(e.target.value)} rows={2} placeholder="Reference no., notes, etc." className={inp("resize-none text-[13px]")} />
              </div>

              {errP && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] text-rose-700">{errP}</p>}
            </div>
            <FormFooter>
              <PBtn type="submit" disabled={savingP} className="h-12 w-full !bg-emerald-600 hover:!bg-emerald-700">
                {savingP
                  ? <><Ic.Spin className="h-4 w-4 animate-spin" />Saving…</>
                  : isFuturePostDatedCheque
                    ? <><Ic.Check className="h-4 w-4" />Record Cheque</>
                    : <><Ic.Check className="h-4 w-4" />Record Payment</>}
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
                    {l.payment_collected != null && (
                      <p className="mt-0.5 text-[12px] font-semibold text-emerald-600">
                        {l.action === "cheque_recorded" ? "Cheque " : "Collected "}
                        {fmtMoney(l.payment_collected)}
                        {l.balance_after != null && ` · Balance ${fmtMoney(l.balance_after)}`}
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
            <p className="text-sm font-bold text-slate-800">Delete this bill permanently?</p>
            <p className="mt-1 text-[12px] text-slate-500">
                This removes {bill.party_name}'s bill #{bill.bill_no} and its entire follow-up history. This cannot be undone.
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
              <p className="text-sm font-bold text-slate-800">Revert the last action on this bill?</p>
              <p className="mt-1 text-[12px] text-slate-500">
                Undoes the most recent follow-up, payment, cheque action, or collection-status
                change, restoring the bill to how it was right before that action.
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
        <EditBillModal bill={bill} token={token} onClose={() => setShowEdit(false)}
            onUpdated={(updated) => { onUpdated(updated); setShowEdit(false); }} />
        )}
    </Backdrop>
  );
}