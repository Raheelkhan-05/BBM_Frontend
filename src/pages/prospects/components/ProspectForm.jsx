import { useState } from "react";
import LocationPicker from "../../components/LocationPicker";
import { INDUSTRIES, SOURCES, PROSPECT_ACTIONS, PROSPECT_STATUSES, DESIGNATIONS } from "../constants";
import { encodeTimeInFeedback, extractTimeFromFeedback, cleanFeedback } from "../utils";
import { Ic } from "../icons";
import { Backdrop, Sheet, SheetHead, SecDiv, FldInput, SelInput, TArea, Lbl, FErr, PBtn, GBtn, inp, cls } from "../ui/primitives";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

const emptyProspect = {
  company_name:"", industry:"", country:"India", state:"", city:"", zone:"", route:"",
  source:"", next_action:"", next_action_date:"", next_action_time:"", feedback:"", prospect_status:"",
  contact_name:"", contact_designation:"", contact_email:"", contact_phone:"",
};

function valProspect(f) {
  const e = {};
  if (!f.company_name.trim()) e.company_name = "Required";
  if (!f.industry)            e.industry = "Required";
  if (!f.country.trim())      e.country = "Required";
  if (!f.state.trim())        e.state = "Required";
  if (!f.city.trim())         e.city = "Required";
  if (!f.source)              e.source = "Required";
  if (!f.next_action)         e.next_action = "Required";
  if (!f.next_action_date) {
    e.next_action_date = "Required";
  } else if (f.next_action_date < new Date().toISOString().split("T")[0]) {
    e.next_action_date = "Date cannot be in the past";
  }
  if (!f.prospect_status)     e.prospect_status = "Required";
  return e;
}

export default function ProspectForm({ initial, token, routesHook, onClose, onSaved }) {
  const isEdit = !!initial?.id;
  const [form, setForm] = useState(() => {
    if (!initial) return { ...emptyProspect };
    return {
      ...emptyProspect, ...initial,
      contact_name:        initial.contact_name || "",
      contact_designation: initial.contact_designation || "",
      contact_email:       initial.contact_email || "",
      contact_phone:       initial.contact_phone || "",
      next_action_date: initial.next_action_date?.split("T")[0] || "",
      next_action_time: extractTimeFromFeedback(initial.feedback) || "",
      feedback: cleanFeedback(initial.feedback) || "",
    };
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  function hc(e) { const { name, value } = e.target; setErrors(p => ({ ...p, [name]: undefined })); setForm(p => ({ ...p, [name]: value })); }
  function hLoc(f, v) { setForm(p => ({ ...p, [f]: v })); }

  async function submit(e) {
    e.preventDefault();
    const errs = valProspect(form);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      const body = { ...form, feedback: encodeTimeInFeedback(form.next_action_time, form.feedback) };
      delete body.next_action_time;
      const url = isEdit ? `${API}/api/prospects/${initial.id}` : `${API}/api/prospects`;
      const res = await fetch(url, { method: isEdit ? "PUT" : "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed");
      onSaved(data.prospect, isEdit);
      onClose();
    } catch (err) { setErrors({ _g: err.message }); }
    finally { setSaving(false); }
  }

  return (
    <Backdrop onClick={onClose}>
      <Sheet wide>
        <SheetHead title={isEdit ? "Edit Prospect" : "Add New Prospect"} subtitle={isEdit ? initial.company_name : "Capture early-stage interest"} onClose={onClose} accent="bg-gradient-to-r from-white to-teal-50/30"/>
        <form onSubmit={submit} className="px-5 pb-6 pt-4">
          <SecDiv title="Company Information" icon={Ic.Building} accent="teal"/>
          <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><FldInput label="Company Name" name="company_name" value={form.company_name} onChange={hc} required icon={Ic.Building} errors={errors}/></div>
            <SelInput label="Industry" name="industry" value={form.industry} onChange={hc} options={INDUSTRIES} required errors={errors}/>
            <SelInput label="Source" name="source" value={form.source} onChange={hc} options={SOURCES} required errors={errors}/>
          </div>

          <SecDiv title="Contact Details" icon={Ic.Phone} accent="sky"/>
          <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FldInput label="Contact Name" name="contact_name" value={form.contact_name} onChange={hc} icon={Ic.User} placeholder="Rajesh Mehta" errors={errors}/>
            <SelInput label="Designation" name="contact_designation" value={form.contact_designation} onChange={hc} options={DESIGNATIONS} errors={errors} placeholder="Select designation"/>
            <FldInput label="Phone" name="contact_phone" value={form.contact_phone} onChange={hc} icon={Ic.Phone} placeholder="+91 98765 43210" errors={errors}/>
            <FldInput label="Email" name="contact_email" type="email" value={form.contact_email} onChange={hc} icon={Ic.Mail} placeholder="rajesh@company.com" errors={errors}/>
          </div>

          <SecDiv title="Location" icon={Ic.Pin} accent="slate"/>
          <div className="mb-5">
            <LocationPicker country={form.country} state={form.state} city={form.city} zone={form.zone} route={form.route} onChange={hLoc} useRoutesHook={routesHook} errors={errors}/>
          </div>

          <SecDiv title="Follow-up Plan" icon={Ic.Zap} accent="amber"/>
          <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelInput label="Next Action" name="next_action" value={form.next_action} onChange={hc} options={PROSPECT_ACTIONS} required errors={errors}/>
            <div>
              <Lbl required>Next Action Date</Lbl>
              <input 
                type="date" 
                name="next_action_date" 
                value={form.next_action_date} 
                onChange={hc} 
                min={new Date().toISOString().split("T")[0]}
                className={inp(errors.next_action_date ? "!border-rose-400" : "")}
              />
              <FErr name="next_action_date" errors={errors}/>
            </div>
            <div>
              <Lbl>Preferred Time <span className="normal-case font-normal text-slate-400">(optional)</span></Lbl>
              <input type="time" name="next_action_time" value={form.next_action_time} onChange={hc} className={inp()}/>
              <p className="mt-1 text-[10px] text-slate-400">Saved with notes · reminder reference only</p>
            </div>
            <div className="sm:col-span-2">
              <TArea label="Feedback / Notes" name="feedback" value={form.feedback} onChange={hc} placeholder="Observations, context…" rows={3}/>
            </div>
          </div>

          <SecDiv title="Status" icon={Ic.Clipboard} accent="blue"/>
          <div className="mb-5">
            <SelInput label="Prospect Status" name="prospect_status" value={form.prospect_status} onChange={hc} options={PROSPECT_STATUSES} required errors={errors}/>
          </div>

          {errors._g && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errors._g}</div>}
          <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-4">
            <GBtn type="button" onClick={onClose}>Cancel</GBtn>
            <PBtn type="submit" disabled={saving}>{saving ? "Saving…" : isEdit ? "Update Prospect" : "Add Prospect"}</PBtn>
          </div>
        </form>
      </Sheet>
    </Backdrop>
  );
}
