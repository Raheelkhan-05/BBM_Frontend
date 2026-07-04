import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PROSPECT_STATUSES, PROSPECT_ACTIONS } from "../constants";
import { encodeTimeInFeedback, extractTimeFromFeedback, cleanFeedback, dueCls, dueLabel, todayStr } from "../utils";
import { Ic } from "../icons";
import { Backdrop, Sheet, SheetHead, Lbl, PBtn, GBtn, inp, cls } from "../ui/primitives";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function UpdateStatusModal({ prospect, token, onClose, onSaved }) {
  const currentRemark = cleanFeedback(prospect.feedback) || "";
  const currentTime   = extractTimeFromFeedback(prospect.feedback) || "";

  const [remark, setRemark]        = useState(currentRemark);
  const [status, setStatus]        = useState(prospect.prospect_status || "");
  const [addNext, setAddNext]      = useState(false);
  const [nextAction, setNextAction]= useState("");
  const [nextDate, setNextDate]    = useState("");
  const [nextTime, setNextTime]    = useState("");
  const [saving, setSaving]        = useState(false);
  const [err, setErr]              = useState("");

  async function submit(e) {
    e.preventDefault();
    if (addNext && !nextAction) { setErr("Select a next action type"); return; }
    if (addNext && !nextDate)   { setErr("Select a next action date");  return; }
    setSaving(true); setErr("");
    try {
      const body = {
        ...prospect,
        prospect_status: status,
        feedback: encodeTimeInFeedback(nextTime || currentTime, remark),
        ...(addNext && { next_action: nextAction, next_action_date: nextDate }),
      };
      const res = await fetch(`${API}/api/prospects/${prospect.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed");
      onSaved(data.prospect, true);
      onClose();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  const prospectTime = extractTimeFromFeedback(prospect.feedback);

  return (
    <Backdrop>
      <Sheet onClick={(e) => e.stopPropagation()}>
        <SheetHead title="Update Status" subtitle={prospect.company_name} onClose={onClose} accent="bg-gradient-to-r from-white to-amber-50/30"/>
        <form onSubmit={submit} className="px-5 pb-6 pt-4 space-y-4">

          {(prospect.next_action || prospect.next_action_date) && (
            <div className="rounded-xl border border-amber-100 bg-amber-50/60 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600 mb-2">Current Scheduled Action</p>
              <div className="flex flex-wrap items-center gap-2">
                {prospect.next_action && (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-amber-100 px-2.5 py-1 text-[12px] font-semibold text-amber-700">
                    <Ic.Zap className="h-3 w-3"/>{prospect.next_action}
                  </span>
                )}
                {prospect.next_action_date && (
                  <span className={cls("text-[12px] font-semibold", dueCls(prospect.next_action_date))}>
                    {dueLabel(prospect.next_action_date)}
                    {prospectTime && <span className="font-normal text-slate-400"> · {prospectTime}</span>}
                  </span>
                )}
              </div>
              {prospect.users?.email && (
                <p className="mt-1.5 text-[10px] text-slate-400">
                  Set by <span className="font-medium text-slate-500">{prospect.users.email}</span>
                </p>
              )}
            </div>
          )}

          <div>
            <Lbl>What happened? <span className="normal-case font-normal text-slate-400">(remark for this action)</span></Lbl>
            <textarea
              value={remark} onChange={e => setRemark(e.target.value)}
              placeholder="e.g. Called Rajesh — asked to call back next week. Interested in pricing details."
              rows={3} className={inp("resize-none")}
            />
          </div>

          <div>
            <Lbl>Update Prospect Status</Lbl>
            <div className="relative">
              <select value={status} onChange={e => setStatus(e.target.value)} className={inp("appearance-none pr-9")}>
                <option value="">Keep current</option>
                {PROSPECT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <Ic.ChevD className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <button type="button" onClick={() => setAddNext(v => !v)}
              className="flex w-full items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-2">
                <div className={cls("flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors", addNext ? "border-indigo-600 bg-indigo-600" : "border-slate-300")}>
                  {addNext && <Ic.Check className="h-3 w-3 text-white"/>}
                </div>
                <span className="text-[13px] font-semibold text-slate-700">Schedule next action</span>
              </div>
              {addNext ? <Ic.ChevU className="h-4 w-4 text-slate-400"/> : <Ic.ChevD className="h-4 w-4 text-slate-400"/>}
            </button>
            <AnimatePresence initial={false}>
              {addNext && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden">
                  <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <Lbl required>Action Type</Lbl>
                        <div className="relative">
                          <select value={nextAction} onChange={e => setNextAction(e.target.value)} className={inp("appearance-none pr-9")}>
                            <option value="">Select…</option>
                            {PROSPECT_ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                          </select>
                          <Ic.ChevD className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/>
                        </div>
                      </div>
                      <div>
                        <Lbl required>Date</Lbl>
                        <input type="date" value={nextDate} onChange={e => setNextDate(e.target.value)} min={todayStr()} className={inp()}/>
                      </div>
                    </div>
                    <div>
                      <Lbl>Preferred Time <span className="normal-case font-normal text-slate-400">(optional)</span></Lbl>
                      <input type="time" value={nextTime} onChange={e => setNextTime(e.target.value)} className={inp()}/>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {err && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{err}</div>}
          <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-4">
            <GBtn type="button" onClick={onClose}>Cancel</GBtn>
            <PBtn type="submit" disabled={saving}>{saving ? "Saving…" : "Save Update"}</PBtn>
          </div>
        </form>
      </Sheet>
    </Backdrop>
  );
}
