import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PROSPECT_STATUSES, PROSPECT_ACTIONS } from "../constants";
import { encodeTimeInFeedback, todayStr } from "../utils";
import { Ic } from "../icons";
import { Lbl, inp, cls } from "../ui/primitives";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function UpdateStatusInline({ prospect, token, onSaved, onConvertToLead }) {
  const [remark, setRemark]         = useState("");
  const [status, setStatus]         = useState(prospect.prospect_status || "");
  const [addNext, setAddNext]       = useState(false);
  const [nextAction, setNextAction] = useState("");
  const [nextDate, setNextDate]     = useState("");
  const [nextTime, setNextTime]     = useState("");
  const [saving, setSaving]         = useState(false);
  const [err, setErr]               = useState("");
  const [saved, setSaved]           = useState(false);

  useEffect(() => {
    setRemark("");
    setStatus(prospect.prospect_status || "");
    setAddNext(false);
    setNextAction(""); setNextDate(""); setNextTime("");
    setSaved(false); setErr("");
  }, [prospect.id]);

  async function submit(e) {
    e.preventDefault();
    if (addNext && !nextAction) { setErr("Select a next action type"); return; }
    if (addNext && !nextDate)   { setErr("Select a next action date");  return; }
    setSaving(true); setErr("");
    try {
      const body = {
        ...prospect,
        prospect_status: status,
        feedback: encodeTimeInFeedback(nextTime, remark),
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
      setRemark("");
      setStatus(data.prospect.prospect_status || "");
      setAddNext(false);
      setNextAction(""); setNextDate(""); setNextTime("");
      setErr("");
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  return (
    <form onSubmit={submit} className="px-4 py-3 space-y-2.5">

      <textarea
        value={remark} onChange={e => setRemark(e.target.value)}
        placeholder="What happened? Add a remark for this action…"
        rows={2} className={inp("resize-none text-[13px]")}
      />

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Lbl>Status</Lbl>
          <div className="relative">
            <select value={status} onChange={e => setStatus(e.target.value)} className={inp("appearance-none pr-8 text-[12px] py-2")}>
              <option value="">Keep current</option>
              {PROSPECT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <Ic.ChevD className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"/>
          </div>
        </div>

        <div className="flex flex-col">
          <Lbl>Next Action</Lbl>
          <button type="button" onClick={() => setAddNext(v => !v)}
            className={cls(
              "flex flex-1 items-center justify-center gap-1.5 rounded-xl border text-[12px] font-semibold transition-colors",
              addNext ? "border-indigo-300 bg-indigo-50 text-indigo-600" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
            )}>
            <div className={cls("flex h-4 w-4 items-center justify-center rounded-full border-2 transition-colors shrink-0", addNext ? "border-indigo-600 bg-indigo-600" : "border-slate-300")}>
              {addNext && <Ic.Check className="h-2.5 w-2.5 text-white"/>}
            </div>
            Schedule
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {addNext && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden">
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/30 px-3 py-2.5 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Lbl required>Type</Lbl>
                  <div className="relative">
                    <select value={nextAction} onChange={e => setNextAction(e.target.value)} className={inp("appearance-none pr-8 text-[12px] py-2")}>
                      <option value="">Select…</option>
                      {PROSPECT_ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                    <Ic.ChevD className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"/>
                  </div>
                </div>
                <div>
                  <Lbl required>Date</Lbl>
                  <input type="date" value={nextDate} onChange={e => setNextDate(e.target.value)} min={todayStr()} className={inp("text-[12px] py-2")}/>
                </div>
              </div>
              <div>
                <Lbl>Time <span className="normal-case font-normal text-slate-400">(optional)</span></Lbl>
                <input type="time" value={nextTime} onChange={e => setNextTime(e.target.value)} className={inp("text-[12px] py-2")}/>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {err && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] text-rose-700">{err}</p>}

      <button type="submit" disabled={saving}
        className={cls(
          "w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-bold transition-all active:scale-[0.98] disabled:opacity-60",
          saved ? "bg-emerald-500 text-white" : "bg-amber-500 text-white hover:bg-amber-600 shadow-sm shadow-amber-200"
        )}>
        {saving ? <><Ic.Spin className="h-4 w-4 animate-spin"/>Saving…</>
         : saved ? <><Ic.Check className="h-4 w-4"/>Saved!</>
         : <><Ic.Zap className="h-4 w-4"/>Save Update</>}
      </button>

      <button type="button" onClick={onConvertToLead}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl border-2 border-teal-200 bg-teal-50/50 px-4 py-2.5 text-[13px] font-bold text-teal-700 hover:bg-teal-100 hover:border-teal-300 transition-all active:scale-[0.98]">
        <Ic.ArrR className="h-4 w-4"/> Convert to Lead
      </button>
    </form>
  );
}
