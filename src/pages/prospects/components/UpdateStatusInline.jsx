import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LEAD_STAGE_STATUSES, PROSPECT_ACTIONS } from "../constants";
import { encodeTimeInFeedback, todayStr } from "../utils";
import { Ic } from "../icons";
import { Lbl, inp, cls } from "../ui/primitives";
import CustomSelect from "../../components/CustomSelect"; // adjust path

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function UpdateStatusInline({ prospect, token, onSaved, hasAnyEnquiry, onAddEnquiry }) {
  const [remark,     setRemark]     = useState("");
  const [status,     setStatus]     = useState(prospect.status || "");
  const [addNext,    setAddNext]    = useState(false);
  const [nextAction, setNextAction] = useState("");
  const [nextDate,   setNextDate]   = useState("");
  const [nextTime,   setNextTime]   = useState("");
  const [saving,     setSaving]     = useState(false);
  const [err,        setErr]        = useState("");
  const [saved,      setSaved]      = useState(false);
  const [markingDead, setMarkingDead] = useState(false);

  const isDead = prospect.status === "Dead";

  useEffect(() => {
    setRemark("");
    setStatus(prospect.status || "");
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
        status,
        feedback: encodeTimeInFeedback(nextTime, remark),
        ...(addNext && { next_action: nextAction, next_action_date: nextDate }),
      };
      const res = await fetch(`${API}/api/leads/${prospect.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed");
      onSaved(data.lead, true);
      setRemark("");
      setStatus(data.lead.status || "");
      setAddNext(false);
      setNextAction(""); setNextDate(""); setNextTime("");
      setErr("");
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  // Quick, dedicated action — separate from the generic Status dropdown so
  // it's a single tap instead of "open dropdown, find Dead, hit Save".
  // Also clears any scheduled next action/date: a dead record has nothing
  // left to follow up on, and ListRow relies on status === "Dead" (not on
  // the date being empty) to hide the date and show the marker, so
  // clearing it here just keeps the record itself clean too.
  async function handleMarkDead() {
    if (isDead) return;
    if (!window.confirm(`Mark "${prospect.company_name}" as Dead? It'll stop showing a follow-up date and move to the bottom of your list. You can still reopen it later by changing its status.`)) return;
    setMarkingDead(true); setErr("");
    try {
      const body = {
        ...prospect,
        status: "Dead",
        next_action: null,
        next_action_date: null,
      };
      const res = await fetch(`${API}/api/leads/${prospect.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to mark as Dead");
      onSaved(data.lead, true);
      setStatus("Dead");
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setErr(e.message);
    } finally {
      setMarkingDead(false);
    }
  }

  return (
    <form onSubmit={submit} className="px-4 py-3 space-y-2.5">

      <textarea
        value={remark} onChange={e => setRemark(e.target.value)}
        placeholder="What happened? Add a remark for this action…"
        rows={2} className={inp("resize-none text-[13px]")}
      />

      <div className="grid grid-cols-2 gap-2">
        {/* Status */}
        <div>
          <Lbl>Status</Lbl>
          <CustomSelect
            value={status}
            onChange={setStatus}
            options={[
              { value: "", label: "Keep current" },
              ...LEAD_STAGE_STATUSES.map(s => ({ value: s, label: s })),
            ]}
            placeholder="Keep current"
            label="Status"
            compact
            searchable={false}
          />
        </div>

        {/* Schedule toggle */}
        <div className="flex flex-col">
          <Lbl>Next Action</Lbl>
          <button
            type="button"
            onClick={() => setAddNext(v => !v)}
            className={cls(
              "flex flex-1 items-center justify-center gap-1.5 rounded-xl border text-[12px] font-semibold transition-colors",
              addNext
                ? "border-indigo-300 bg-indigo-50 text-indigo-600"
                : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
            )}
          >
            <div className={cls(
              "flex h-4 w-4 items-center justify-center rounded-full border-2 transition-colors shrink-0",
              addNext ? "border-indigo-600 bg-indigo-600" : "border-slate-300"
            )}>
              {addNext && <Ic.Check className="h-2.5 w-2.5 text-white" />}
            </div>
            Schedule
          </button>
        </div>
      </div>

      {/* Expanded schedule panel */}
      <AnimatePresence initial={false}>
        {addNext && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/30 px-3 py-2.5 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                {/* Next Action Type */}
                <div>
                  <Lbl required>Type</Lbl>
                  <CustomSelect
                    value={nextAction}
                    onChange={setNextAction}
                    options={PROSPECT_ACTIONS}
                    placeholder="Select…"
                    label="Action Type"
                    compact
                    searchable={false}
                  />
                </div>
                <div>
                  <Lbl required>Date</Lbl>
                  <input
                    type="date"
                    value={nextDate}
                    onChange={e => setNextDate(e.target.value)}
                    min={todayStr()}
                    className={inp("text-[12px] py-2 h-7")}
                  />
                </div>
              </div>
              <div>
                <Lbl>Time <span className="normal-case font-normal text-slate-400">(optional)</span></Lbl>
                <input
                  type="time"
                  value={nextTime}
                  onChange={e => setNextTime(e.target.value)}
                  className={inp("text-[12px] py-2")}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {err && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] text-rose-700">{err}</p>
      )}

      <button
        type="submit"
        disabled={saving || markingDead}
        className={cls(
          "w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-bold transition-all active:scale-[0.98] disabled:opacity-60",
          saved
            ? "bg-emerald-500 text-white"
            : "bg-amber-500 text-white hover:bg-amber-600 shadow-sm shadow-amber-200"
        )}
      >
        {saving ? <><Ic.Spin className="h-4 w-4 animate-spin" />Saving…</>
         : saved  ? <><Ic.Check className="h-4 w-4" />Saved!</>
         : <><Ic.Zap className="h-4 w-4" />Save Update</>}
      </button>

      {/* {!hasAnyEnquiry && (
        <button
          type="button"
          onClick={onAddEnquiry}
          className="mt-0 w-full rounded-lg bg-indigo-600 px-3 py-2.5 text-[12px] font-bold text-white hover:bg-indigo-700 transition-colors"
        >
          Add Enquiry — marks this as a Lead
        </button>
      )} */}

      <button
        type="button"
        onClick={handleMarkDead}
        disabled={isDead || markingDead || saving}
        title={isDead ? "Already marked Dead" : "Mark as Dead"}
        className={cls(
          "w-full inline-flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-2.5 text-[13px] font-bold transition-all active:scale-[0.98] disabled:opacity-50",
          isDead
            ? "border-slate-200 bg-slate-50 text-slate-400"
            : "border-rose-200 bg-rose-50/50 text-rose-700 hover:bg-rose-100 hover:border-rose-300"
        )}
      >
        {markingDead
          ? <><Ic.Spin className="h-4 w-4 animate-spin" />Marking…</>
          : isDead
          ? <><Ic.X className="h-4 w-4" />Marked Dead</>
          : <><Ic.X className="h-4 w-4" />Mark as Dead</>}
      </button>
    </form>
  );
}