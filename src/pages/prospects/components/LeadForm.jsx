// pages/Pipeline/components/LeadForm.jsx
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import LocationPicker from "../../components/LocationPicker";
import { BIZ_TYPES, DESIGNATIONS, SOURCES, PROSPECT_ACTIONS, LEAD_STAGE_STATUSES } from "../constants";
import {
  emptyEnqForm, validateEnqForm, missingLeadFormFields, validateLeadForm,
  encodeTimeInNotes, encodeTimeInFeedback, extractTimeFromFeedback, cleanFeedback,
} from "../utils";
import { Ic } from "../icons";
import { Backdrop, Sheet, SheetHead, SecDiv, FldInput, SelInput, TArea, Lbl, FErr, PBtn, GBtn, inp, cls } from "../ui/primitives";
import { CollapsibleSection } from "../ui/CollapsibleSection";
import InlineEnquiryBlock from "./InlineEnquiryBlock";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

const emptyLead = {
  company_name: "", country: "India", state: "", city: "", zone: "", route: "",
  nature_of_business: "", manufacturing_industry: "", company_website: "", gst_number: "", linkedin_profile: "",
  primary_contact_name: "", primary_designation: "", primary_phone: "", primary_email: "",
  whatsapp_same_as_mobile: false, whatsapp_number: "",
  secondary_contact_name: "", secondary_designation: "", secondary_phone: "", secondary_email: "",
  // prospect-stage fields — all optional, live on `leads` now
  source: "", next_action: "", next_action_date: "", feedback: "", next_action_time: "",
  status: "Active",
};

export default function LeadForm({ initial, token, routesHook, productsHook, onClose, onSaved, onEnquirySaved }) {
  const isEdit = !!initial?.id;

  const [form, setForm] = useState(() => {
    if (!initial) return { ...emptyLead };
    return {
      ...emptyLead, ...initial,
      whatsapp_same_as_mobile: initial.whatsapp_same_as_mobile || false,
      next_action_date: initial.next_action_date?.split("T")[0] || "",
      next_action_time: extractTimeFromFeedback(initial.feedback) || "",
      feedback: cleanFeedback(initial.feedback) || "",
      status: initial.status || "Active",
    };
  });

  const [errors, setErrors]               = useState({});
  const [saving, setSaving]               = useState(false);
  const [genErr, setGenErr]               = useState("");
  const [enquiryForms, setEnquiryForms]   = useState([]);
  const [missingLeadFields, setMissingLeadFields] = useState([]);

  function hc(e) {
    const { name, value, type, checked } = e.target;
    setErrors(p => ({ ...p, [name]: undefined }));
    setMissingLeadFields([]);
    setForm(p => {
      const u = { ...p, [name]: type === "checkbox" ? checked : value };
      if (name === "whatsapp_same_as_mobile" && checked) u.whatsapp_number = p.primary_phone;
      if (name === "primary_phone" && p.whatsapp_same_as_mobile) u.whatsapp_number = value;
      return u;
    });
  }
  function hLoc(f, v) { setMissingLeadFields([]); setForm(p => ({ ...p, [f]: v })); }

  function addEnquiryForm() {
    const missing = missingLeadFormFields(form);
    if (missing.length) { setMissingLeadFields(missing); return; }
    setMissingLeadFields([]);
    setEnquiryForms(p => [...p, emptyEnqForm()]);
  }
  function removeEnquiryForm(i) { setEnquiryForms(p => p.filter((_, j) => j !== i)); }
  function updateEnquiryForm(i, field, value) {
    setEnquiryForms(p => {
      const arr = [...p];
      arr[i] = { ...arr[i], [field]: value, _errors: { ...arr[i]._errors, [field]: undefined } };
      return arr;
    });
  }

  async function submit(e) {
    e.preventDefault();
    setGenErr("");
    const errs = validateLeadForm(form); // only company_name required
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      const body = {
        ...form,
        feedback: encodeTimeInFeedback(form.next_action_time, form.feedback),
      };
      delete body.next_action_time;

      const url = isEdit ? `${API}/api/leads/${initial.id}` : `${API}/api/leads`;
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed");
      const savedLead = data.lead;

      if (enquiryForms.length > 0) {
        let hasEnqErrors = false;
        const updatedForms = enquiryForms.map(enq => {
          const errs = validateEnqForm(enq);
          if (Object.keys(errs).length) { hasEnqErrors = true; return { ...enq, _errors: errs }; }
          return enq;
        });
        if (hasEnqErrors) {
          setEnquiryForms(updatedForms);
          setSaving(false);
          setGenErr("Saved! Please fix enquiry errors below, or remove them and save again.");
          onSaved(savedLead, isEdit);
          return;
        }
        const createdRFQs = [];
        for (const enq of enquiryForms) {
          const r1 = await fetch(`${API}/api/rfqs`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              lead_id: savedLead.id, company_name: savedLead.company_name,
              product_category: enq.product_category, product_sub_category: enq.product_sub_category || null,
              product_name: enq.product_name || null, product_description: enq.product_description || null,
              consumption_per_month: enq.consumption_per_month || null, unit: enq.unit || null,
              sample_required: enq.sample_required, quotation_required: enq.quotation_required,
              sample_description: enq.sample_description || null, quotation_description: enq.quotation_description || null,
              existing_supplier_brand: enq.existing_supplier_brand || null, target_price: enq.target_price || null,
              tds_available: enq.tds_available || false,
              followup_date: enq.fu_date || null, followup_time: enq.fu_time || null,
            }),
          });
          const d1 = await r1.json();
          if (!r1.ok) continue;
          if (enq.fu_date) {
            const r2 = await fetch(`${API}/api/rfqs/${d1.rfq.id}/followups`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({
                contact_type: enq.fu_contact_type || null, followup_date: enq.fu_date, enquiry_status: "Open",
                next_action: enq.fu_next_action || null, remark: enq.fu_remark || null,
                notes: encodeTimeInNotes(enq.fu_time, null),
              }),
            });
            const d2 = await r2.json();
            if (r2.ok) createdRFQs.push({ ...d1.rfq, rfq_followups: [d2.followup], samples: [], quotations: [] });
          } else {
            createdRFQs.push({ ...d1.rfq, rfq_followups: [], samples: [], quotations: [] });
          }
        }
        onSaved(savedLead, isEdit);
        createdRFQs.forEach(rfq => onEnquirySaved && onEnquirySaved(rfq));
      } else {
        onSaved(savedLead, isEdit);
      }
      onClose();
    } catch (err) { setGenErr(err.message); }
    finally { setSaving(false); }
  }

  return (
    <Backdrop>
      <Sheet wide={false} onClick={(e) => e.stopPropagation()}>
        <SheetHead
          title={isEdit ? "Edit Record" : "Add New Record"}
          subtitle={form.company_name || "New Lead / Prospect"}
          onClose={onClose}
          accent="bg-gradient-to-r from-white to-indigo-50/30"
        />
        <form id="lead-form-compact" onSubmit={submit} className="px-4 pt-3 space-y-3">

          <SecDiv title="Company Information" icon={Ic.Building} accent="indigo"/>
          <div className="rounded-xl border border-slate-200 bg-slate-50/40 px-4 py-3 space-y-3">
            <FldInput label="Company Name" name="company_name" value={form.company_name} onChange={hc}
              required icon={Ic.Building} errors={errors}/>
            <SelInput label="Nature of Business" name="nature_of_business" value={form.nature_of_business}
              onChange={hc} options={BIZ_TYPES} errors={{}}/>
            {form.nature_of_business === "Manufacturer" && (
              <FldInput label="Manufacturing Industry" name="manufacturing_industry"
                value={form.manufacturing_industry} onChange={hc} icon={Ic.Factory} errors={{}}/>
            )}
            <FldInput label="Website" name="company_website" value={form.company_website} onChange={hc}
              placeholder="https://…" icon={Ic.Globe} errors={{}}
              onBlur={e => { const t = e.target.value.trim(); if (t && !t.startsWith("http")) setForm(p => ({ ...p, company_website: "https://" + t })); }}/>
            <FldInput label="GST Number" name="gst_number" value={form.gst_number} onChange={hc}
              placeholder="22AAAAA0000A1Z5" icon={Ic.FileT} errors={{}}/>
            <FldInput label="LinkedIn Profile" name="linkedin_profile" value={form.linkedin_profile} onChange={hc}
              placeholder="https://linkedin.com/company/…" icon={Ic.Globe} errors={{}}/>
            <SelInput label="Source" name="source" value={form.source} onChange={hc} options={SOURCES} errors={{}}/>
          </div>

          {/* Primary Contact */}
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/30 px-4 py-3 space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">Primary Contact</p>
            <FldInput label="Name" name="primary_contact_name" value={form.primary_contact_name}
              onChange={hc} icon={Ic.User} placeholder="Rajesh Mehta" errors={{}}/>
            <SelInput label="Designation" name="primary_designation" value={form.primary_designation}
              onChange={hc} options={DESIGNATIONS} errors={{}} placeholder="Select designation"/>
            <FldInput label="Phone" name="primary_phone" value={form.primary_phone} onChange={hc}
              icon={Ic.Phone} placeholder="+91 98765 43210" errors={{}}/>
            <FldInput label="Email" name="primary_email" type="email" value={form.primary_email}
              onChange={hc} icon={Ic.Mail} placeholder="rajesh@company.com" errors={{}}/>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" name="whatsapp_same_as_mobile" checked={form.whatsapp_same_as_mobile}
                onChange={hc} className="h-4 w-4 rounded border-slate-300 text-indigo-600"/>
              <span className="text-sm text-slate-700">WhatsApp same as mobile</span>
            </label>
            {!form.whatsapp_same_as_mobile && (
              <FldInput label="WhatsApp" name="whatsapp_number" value={form.whatsapp_number}
                onChange={hc} icon={Ic.Phone} placeholder="+91 98765 43210" errors={{}}/>
            )}
          </div>

          {/* Secondary Contact */}
          <CollapsibleSection title="Secondary Contact (Optional)" defaultOpen={!!(initial?.secondary_contact_name)}>
            <FldInput label="Name" name="secondary_contact_name" value={form.secondary_contact_name}
              onChange={hc} icon={Ic.User} placeholder="Priya Shah" errors={{}}/>
            <SelInput label="Designation" name="secondary_designation" value={form.secondary_designation}
              onChange={hc} options={DESIGNATIONS} errors={{}} placeholder="Select designation"/>
            <FldInput label="Phone" name="secondary_phone" value={form.secondary_phone}
              onChange={hc} icon={Ic.Phone} placeholder="+91 87654 32100" errors={{}}/>
            <FldInput label="Email" name="secondary_email" type="email" value={form.secondary_email}
              onChange={hc} icon={Ic.Mail} placeholder="priya@company.com" errors={{}}/>
          </CollapsibleSection>

          <div className="mb-2">
            <LocationPicker country={form.country} state={form.state} city={form.city} zone={form.zone} route={form.route} onChange={hLoc} useRoutesHook={routesHook} errors={{}}/>
          </div>

          {/* Prospect-stage tracking — optional, useful before any enquiry exists */}
          <CollapsibleSection title="Follow-up / Stage (Optional)" defaultOpen={!isEdit || !initial?.next_action}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <SelInput label="Next Action" name="next_action" value={form.next_action} onChange={hc} options={PROSPECT_ACTIONS} errors={{}}/>
              <div>
                <Lbl>Next Action Date</Lbl>
                <input type="date" name="next_action_date" value={form.next_action_date} onChange={hc}
                  min={new Date().toISOString().split("T")[0]} className={inp()}/>
              </div>
              <div>
                <Lbl>Preferred Time <span className="normal-case font-normal text-slate-400">(optional)</span></Lbl>
                <input type="time" name="next_action_time" value={form.next_action_time} onChange={hc} className={inp()}/>
              </div>
              <SelInput label="Stage Status" name="status" value={form.status} onChange={hc} options={LEAD_STAGE_STATUSES} errors={{}}/>
            </div>
            <div className="mt-3">
              <TArea label="Feedback / Notes" name="feedback" value={form.feedback} onChange={hc} placeholder="Observations, context…" rows={2}/>
            </div>
          </CollapsibleSection>

          <SecDiv title="Enquiries" icon={Ic.FileT} accent="indigo"/>
          <div className="mb-2 space-y-3">
            <AnimatePresence initial={false}>
              {enquiryForms.map((enq, i) => (
                <InlineEnquiryBlock key={i} enq={enq} index={i} onUpdate={updateEnquiryForm} onRemove={removeEnquiryForm} productsHook={productsHook}/>
              ))}
            </AnimatePresence>

            <AnimatePresence>
              {missingLeadFields.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.97 }} transition={{ duration: 0.18 }}
                  className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <div className="flex items-start gap-2">
                    <Ic.Alert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5"/>
                    <div>
                      <p className="text-[12px] font-semibold text-amber-700 mb-1">Fill in these fields before adding an enquiry:</p>
                      <ul className="list-disc list-inside space-y-0.5">{missingLeadFields.map(f => <li key={f} className="text-[11px] text-amber-700">{f}</li>)}</ul>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <button type="button" onClick={addEnquiryForm}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-indigo-200 px-4 py-3 text-sm font-medium text-indigo-500 hover:border-indigo-400 hover:bg-indigo-50/40 hover:text-indigo-600 transition-all">
              <Ic.Plus className="h-4 w-4"/> Add Enquiry
            </button>
            <p className="text-[11px] text-slate-400 text-center">
              Adding an enquiry here will mark this record as a <b>Lead</b> — no enquiry means it stays a <b>Prospect</b>.
            </p>
          </div>

          {genErr && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{genErr}</div>}
        </form>

        <div className="sticky bottom-0 z-10 flex gap-2.5 border-t border-slate-100 bg-white px-4 py-3">
          <GBtn type="button" onClick={onClose} className="flex-1">Cancel</GBtn>
          <PBtn type="submit" form="lead-form-compact" disabled={saving} className="flex-1">
            {saving ? "Saving…" : isEdit ? "Update Record" : "Save Record"}
          </PBtn>
        </div>
      </Sheet>
    </Backdrop>
  );
}