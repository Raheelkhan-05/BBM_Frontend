// pages/bills/BillDetailPanel.jsx
import { useState } from "react";
import { Ic } from "../prospects/icons";
import EditBillModal from "./EditBillModal";
import { cls, Lbl, inp, PBtn, Backdrop, Sheet, SheetHead, DRow, GBtn } from "../prospects/ui/primitives";
import { fmtDate, fmtMoney, billDueStatus, dialable, personLabel } from "./utils";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

const TONE_CLS = {
  rose: "text-rose-600 bg-rose-50 ring-rose-200",
  amber: "text-amber-600 bg-amber-50 ring-amber-200",
  sky: "text-sky-600 bg-sky-50 ring-sky-200",
  slate: "text-slate-500 bg-slate-100 ring-slate-200",
};


const EDIT_DELETE_ALLOWED = new Set(["communication@bbmpvtltd.com"]);

const REASON_OPTS = [
  "Party not available", "Payment promised - awaiting", "Dispute on amount",
  "Cheque bounced", "Requested extension", "Partial payment expected", "No response", "Other",
];

function todayStr() { return new Date().toISOString().slice(0, 10); }

export default function BillDetailPanel({ bill, token, user, onClose, onUpdated, onDeleted }) {
  const [tab, setTab] = useState("followup");
  const [logs, setLogs] = useState(null);
  const [logsLoading, setLogsLoading] = useState(false);

  const [remark, setRemark]     = useState("");
  const [reason, setReason]     = useState("");
  const [nextDate, setNextDate] = useState(bill.next_followup_date || "");
  const [savingF, setSavingF]   = useState(false);
  const [errF, setErrF]         = useState("");

  const [amount, setAmount]         = useState("");
  const [isFullPayment, setIsFullPayment] = useState(false);
  const [payFollowup, setPayFollowup]     = useState("");
  const [pRemark, setPRemark]             = useState("");
  const [savingP, setSavingP]             = useState(false);
  const [errP, setErrP]                   = useState("");

  const status = billDueStatus(bill.bill_date);
  const isCompleted = bill.status === "completed";
  const balance = Number(bill.balance_amount || 0);

  const enteredAmount = isFullPayment ? balance : Number(amount);
  const remainingAfter = Math.max(0, balance - (enteredAmount || 0));
  const willBeComplete = enteredAmount >= balance && enteredAmount > 0;

  const [showEdit, setShowEdit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [delErr, setDelErr] = useState("");


  const canEditDelete = EDIT_DELETE_ALLOWED.has((user?.email || "").toLowerCase());

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
    if (!reason.trim()) { setErrF("Select or enter a reason"); return; }
    if (!nextDate) { setErrF("Next follow-up date is required"); return; }
    setSavingF(true); setErrF("");
    try {
      const r = await fetch(`${API}/api/bills/${bill.id}/followup`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ remark, reason, next_followup_date: nextDate }),
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
    const willComplete = amt >= balance;
    if (!willComplete && !payFollowup) {
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
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "Failed");
      onUpdated(d.bill);
      onClose();
    } catch (e) { setErrP(e.message); }
    finally { setSavingP(false); }
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
                <span className={cls("rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset", isCompleted ? "bg-emerald-50 text-emerald-600 ring-emerald-200" : TONE_CLS[status.tone])}>
                    {isCompleted ? "Completed" : status.label}
                </span>
                {canEditDelete && (
                    <>
                    <button onClick={() => setShowEdit(true)} title="Edit"
                        className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-indigo-600">
                        <Ic.Edit className="h-4 w-4" />
                    </button>
                    <button onClick={() => setConfirmDelete(true)} title="Delete"
                        className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                        <Ic.Trash className="h-4 w-4" />
                    </button>
                    </>
                )}
                </>
            }
            />

        <div className="px-5 pt-4">
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

          <div className="mt-3 space-y-0.5">
            <DRow label="Bill Date" value={fmtDate(bill.bill_date)} />
            <DRow label="Days Outstanding" value={status.label} />
            <DRow label="Collected so far" value={fmtMoney(bill.payment_collected)} />
            {bill.last_reason && <DRow label="Last reason" value={bill.last_reason} />}
            {bill.next_followup_date && bill.status === "remaining" && <DRow label="Next follow-up" value={fmtDate(bill.next_followup_date)} />}
          </div>
        </div>

        <div className="mt-4 flex gap-1.5 border-b border-slate-100 px-5">
          {[
            { id: "followup", label: "Follow-up", icon: Ic.Zap },
            { id: "payment",  label: "Payment",    icon: Ic.Check },
            { id: "history",  label: "History",    icon: Ic.Cal, onClick: openHistory },
          ].map(t => (
            <button key={t.id} onClick={t.onClick || (() => setTab(t.id))}
              className={cls("flex items-center gap-1.5 border-b-2 px-2 pb-2.5 text-[12px] font-semibold transition-colors",
                tab === t.id ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-400 hover:text-slate-600")}>
              <t.icon className="h-3.5 w-3.5" />{t.label}
            </button>
          ))}
        </div>

        {tab === "followup" && (
          <form onSubmit={submitFollowup} className="px-5 py-4 space-y-3">
            <div>
              <Lbl required>Reason payment wasn't collected</Lbl>
              <select value={reason} onChange={e => setReason(e.target.value)} className={inp("appearance-none")}>
                <option value="">Select a reason…</option>
                {REASON_OPTS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
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
            <PBtn type="submit" disabled={savingF} className="w-full">
              {savingF ? <><Ic.Spin className="h-4 w-4 animate-spin" />Saving…</> : "Save Follow-up"}
            </PBtn>
          </form>
        )}

        {tab === "payment" && (
          <form onSubmit={submitPayment} className="px-5 py-4 space-y-3">
            <button
              type="button"
              onClick={() => { setIsFullPayment(v => !v); setAmount(""); setErrP(""); }}
              className={cls(
                "flex w-full items-center justify-between rounded-xl border-2 px-3.5 py-2.5 text-[13px] font-bold transition-colors",
                isFullPayment ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
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
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder={`Max ${fmtMoney(balance)}`} className={inp()} />
              </div>
            )}

            {!willBeComplete && (
              <div>
                <Lbl required>Next Follow-up Date <span className="normal-case font-normal text-slate-400">(for remaining {fmtMoney(remainingAfter)})</span></Lbl>
                <input type="date" value={payFollowup} min={todayStr()} onChange={e => setPayFollowup(e.target.value)} className={inp()} />
              </div>
            )}

            <div>
              <Lbl>Remark</Lbl>
              <textarea value={pRemark} onChange={e => setPRemark(e.target.value)} rows={2} placeholder="Mode of payment, reference no. etc." className={inp("resize-none text-[13px]")} />
            </div>

            {errP && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] text-rose-700">{errP}</p>}
            <PBtn type="submit" disabled={savingP} className="w-full !bg-emerald-600 hover:!bg-emerald-700">
              {savingP ? <><Ic.Spin className="h-4 w-4 animate-spin" />Saving…</> : <><Ic.Check className="h-4 w-4" />Record Payment</>}
            </PBtn>
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
                      <span className="text-[11px] font-bold uppercase tracking-wide text-indigo-600">{l.action.replace("_", " ")}</span>
                      <span className="text-[10px] text-slate-400">{new Date(l.changed_at).toLocaleString("en-IN")}</span>
                    </div>
                    {l.reason && <p className="mt-1 text-[12px] text-slate-600">Reason: {l.reason}</p>}
                    {l.remark && <p className="mt-0.5 text-[12px] text-slate-500">{l.remark}</p>}
                    {l.next_followup_date && <p className="mt-0.5 text-[11px] text-sky-600">Next follow-up: {fmtDate(l.next_followup_date)}</p>}
                    {l.payment_collected != null && (
                      <p className="mt-0.5 text-[12px] font-semibold text-emerald-600">Collected {fmtMoney(l.payment_collected)} · Balance {fmtMoney(l.balance_after)}</p>
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
                <GBtn onClick={() => setConfirmDelete(false)} className="flex-1">Cancel</GBtn>
                <PBtn onClick={handleDelete} disabled={deleting} className="flex-1 !bg-rose-600 hover:!bg-rose-700">
                {deleting ? <><Ic.Spin className="h-4 w-4 animate-spin" />Deleting…</> : "Delete"}
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