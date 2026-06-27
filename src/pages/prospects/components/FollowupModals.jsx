import { useState } from "react";
import { CONTACT_TYPES, ENQ_STATUSES, NEXT_ACTION_OPTIONS } from "../constants";
import {
  suggestNextAction, latestFU, encodeTimeInNotes, extractTimeFromNotes, cleanNotes, todayMidnight, todayStr,
} from "../utils";
import { Ic } from "../icons";
import { Backdrop, Sheet, SheetHead, SelInput, TArea, Lbl, FErr, PBtn, GBtn, inp, cls } from "../ui/primitives";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

/* ═══════════════════════════════════════════════════════════════
   ADD FOLLOW-UP MODAL
═══════════════════════════════════════════════════════════════ */
export function AddFollowupModal({ rfq, token, onClose, onSaved }) {
  const prevStatus   = latestFU(rfq)?.enquiry_status || "Open";
  const sample       = (rfq.samples    || [])[0];
  const quotation    = (rfq.quotations || [])[0];
  const autoSuggested = suggestNextAction(rfq.sample_required, rfq.quotation_required, sample?.sample_status || null, quotation?.quotation_status || null);

  const [form, setForm]     = useState({ contact_type:"", followup_date:"", followup_time:"", remark:"", next_action: autoSuggested || "" });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  function hc(e) { const { name, value } = e.target; setErrors(p => ({ ...p, [name]: undefined })); setForm(p => ({ ...p, [name]: value })); }

  async function submit(e) {
    e.preventDefault();
    const errs = {};
    if (!form.contact_type)  errs.contact_type  = "Required";
    if (!form.followup_date) errs.followup_date = "Required";
    if (new Date(form.followup_date) < todayMidnight()) errs.followup_date = "Must be today or future";
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/rfqs/${rfq.id}/followups`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          contact_type: form.contact_type, enquiry_status: prevStatus,
          followup_date: form.followup_date, next_action: form.next_action || null,
          remark: form.remark || null, notes: encodeTimeInNotes(form.followup_time, null),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed");
      onSaved(data.followup); onClose();
    } catch (e) { setErrors({ _g: e.message }); }
    finally { setSaving(false); }
  }

  return (
    <Backdrop onClick={onClose}>
      <Sheet>
        <SheetHead title="Schedule Follow-up" subtitle={rfq.product_name || rfq.product_category} onClose={onClose} accent="bg-gradient-to-r from-white to-sky-50/30"/>
        <form onSubmit={submit} className="px-5 pb-6 pt-4 space-y-4">
          <div className="rounded-xl border border-sky-100 bg-sky-50/40 px-4 py-3">
            <p className="text-[11px] font-semibold text-sky-700 mb-1">Plan your next touchpoint</p>
            <p className="text-[11px] text-sky-600">This schedules the follow-up. You'll record the outcome from the Follow-ups menu on the day it's due.</p>
          </div>
          <SelInput label="How will you contact them?" name="contact_type" value={form.contact_type} onChange={hc} options={CONTACT_TYPES} required errors={errors}/>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Lbl required>Follow-up Date</Lbl>
              <input type="date" name="followup_date" value={form.followup_date} onChange={hc} min={todayStr()} className={inp(errors.followup_date ? "!border-rose-400" : "")}/>
              <FErr name="followup_date" errors={errors}/>
            </div>
            <div>
              <Lbl>Time <span className="normal-case font-normal text-slate-400">(optional)</span></Lbl>
              <input type="time" name="followup_time" value={form.followup_time} onChange={hc} className={inp()}/>
            </div>
          </div>
          <div>
            <Lbl>Next Action</Lbl>
            {autoSuggested && form.next_action !== autoSuggested && (
              <div className="mb-1.5 flex items-center gap-1.5">
                <Ic.Sparkle className="h-3 w-3 text-indigo-400"/>
                <span className="text-[10px] text-indigo-500">Suggested based on current status:</span>
                <button type="button" onClick={() => setForm(p => ({ ...p, next_action: autoSuggested }))}
                  className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 underline underline-offset-2">{autoSuggested}</button>
              </div>
            )}
            {autoSuggested && form.next_action === autoSuggested && (
              <div className="mb-1.5 flex items-center gap-1.5">
                <Ic.Sparkle className="h-3 w-3 text-emerald-400"/>
                <span className="text-[10px] text-emerald-600 font-medium">Auto-filled from current sample/quotation status</span>
              </div>
            )}
            <div className="relative">
              <select name="next_action" value={form.next_action} onChange={hc} className={inp("appearance-none pr-9")}>
                <option value="">Select…</option>
                {NEXT_ACTION_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <Ic.ChevD className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/>
            </div>
          </div>
          <TArea label="Note (optional)" name="remark" value={form.remark} onChange={hc} placeholder="Anything to remember before the next call…" rows={2}/>
          {errors._g && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errors._g}</div>}
          <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-3">
            <GBtn type="button" onClick={onClose}>Cancel</GBtn>
            <PBtn type="submit" disabled={saving}>{saving ? "Saving…" : "Schedule"}</PBtn>
          </div>
        </form>
      </Sheet>
    </Backdrop>
  );
}

/* ═══════════════════════════════════════════════════════════════
   EDIT FOLLOW-UP MODAL
═══════════════════════════════════════════════════════════════ */
export function EditFollowupModal({ rfq, followup, token, onClose, onSaved }) {
  const sample      = (rfq.samples    || [])[0];
  const quotation   = (rfq.quotations || [])[0];
  const autoSuggested = suggestNextAction(rfq.sample_required, rfq.quotation_required, sample?.sample_status || null, quotation?.quotation_status || null);

  const [form, setForm] = useState({
    contact_type:    followup.contact_type    || "",
    enquiry_status:  followup.enquiry_status  || "Open",
    followup_date:   followup.followup_date   || "",
    followup_time:   extractTimeFromNotes(followup.notes) || "",
    next_action:     followup.next_action     || "",
    remark:          followup.remark          || "",
    notes:           cleanNotes(followup.notes) || "",
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  function hc(e) { const { name, value } = e.target; setErrors(p => ({ ...p, [name]: undefined })); setForm(p => ({ ...p, [name]: value })); }

  async function submit(e) {
    e.preventDefault();
    const errs = {};
    if (!form.contact_type)  errs.contact_type  = "Required";
    if (!form.enquiry_status) errs.enquiry_status = "Required";
    if (!form.followup_date) errs.followup_date = "Required";
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/rfqs/followups/${followup.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          contact_type: form.contact_type, enquiry_status: form.enquiry_status,
          followup_date: form.followup_date, next_action: form.next_action || null,
          remark: form.remark || null, notes: encodeTimeInNotes(form.followup_time, form.notes),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed");
      onSaved(data.followup); onClose();
    } catch (e) { setErrors({ _g: e.message }); }
    finally { setSaving(false); }
  }

  return (
    <Backdrop onClick={onClose}>
      <Sheet>
        <SheetHead title="Edit Follow-up" subtitle={rfq.product_name || rfq.product_category} onClose={onClose} accent="bg-gradient-to-r from-white to-indigo-50/30"/>
        <form onSubmit={submit} className="px-5 pb-6 pt-4 space-y-4">
          <SelInput label="Contact Type"   name="contact_type"   value={form.contact_type}   onChange={hc} options={CONTACT_TYPES} required errors={errors}/>
          <SelInput label="Enquiry Status" name="enquiry_status" value={form.enquiry_status} onChange={hc} options={ENQ_STATUSES}  required errors={errors}/>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Lbl required>Follow-up Date</Lbl>
              <input type="date" name="followup_date" value={form.followup_date} onChange={hc} className={inp(errors.followup_date ? "!border-rose-400" : "")}/>
              <FErr name="followup_date" errors={errors}/>
            </div>
            <div>
              <Lbl>Time</Lbl>
              <input type="time" name="followup_time" value={form.followup_time} onChange={hc} className={inp()}/>
            </div>
          </div>
          <div>
            <Lbl>Next Action</Lbl>
            {autoSuggested && form.next_action !== autoSuggested && (
              <div className="mb-1.5 flex items-center gap-1.5">
                <Ic.Sparkle className="h-3 w-3 text-indigo-400"/>
                <span className="text-[10px] text-indigo-500">Suggested:</span>
                <button type="button" onClick={() => setForm(p => ({ ...p, next_action: autoSuggested }))}
                  className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 underline underline-offset-2">{autoSuggested}</button>
              </div>
            )}
            <div className="relative">
              <select name="next_action" value={form.next_action} onChange={hc} className={inp("appearance-none pr-9")}>
                <option value="">Select…</option>
                {NEXT_ACTION_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <Ic.ChevD className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/>
            </div>
          </div>
          <TArea label="Remarks" name="remark" value={form.remark} onChange={hc} rows={3}/>
          <TArea label="Notes"   name="notes"  value={form.notes}  onChange={hc} rows={2}/>
          {errors._g && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errors._g}</div>}
          <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-3">
            <GBtn type="button" onClick={onClose}>Cancel</GBtn>
            <PBtn type="submit" disabled={saving}>{saving ? "Saving…" : "Update"}</PBtn>
          </div>
        </form>
      </Sheet>
    </Backdrop>
  );
}
