// pages/Pipeline/components/LeadForm.jsx
import { useState, useEffect, useRef  } from "react";
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

export default function LeadForm({
  initial, token, user, routesHook, productsHook, onClose, onSaved, onEnquirySaved,
  autoAddEnquiry = false,   // ← used when opened from "Add Enquiry" in DetailPanel
}) {
  const isEdit = !!initial?.id;

  // Only the creator, Admin, or SalesCoordinator can edit a lead's own details.
  // Anyone else opening it (e.g. to add an enquiry to someone else's lead)
  // gets the restricted "enquiry only" view instead.
  const canEditFully =
    !isEdit ||
    user?.role === "Admin" ||
    initial?.created_by === user?.id;

  console.log("DEBUG ownership check:", {
    initial_created_by: initial?.created_by,
    initial_created_by_type: typeof initial?.created_by,
    user_id: user?.id,
    user_id_type: typeof user?.id,
    user_role: user?.role,
    match: initial?.created_by === user?.id,
  });

  const foreignLead = isEdit && !canEditFully;

  const [form, setForm] = useState(() => {
    if (!initial) return { ...emptyLead };
    const sanitized = Object.fromEntries(
      Object.entries(initial).map(([k, v]) => [k, v === null || v === undefined ? "" : v])
    );

    return {
      ...emptyLead, ...sanitized,
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

  const [suggestedLeads, setSuggestedLeads] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isDuplicateExact, setIsDuplicateExact] = useState(false);
  const searchTimeoutRef = useRef(null);
  const [selectedExistingLeadId, setSelectedExistingLeadId] = useState(null);
  const [existingLeadMatch, setExistingLeadMatch] = useState(null); // full lead object incl. creator

  // `restricted` covers two situations that render identically —
  // company-name-search matched an existing lead (existingLeadMatch), or
  // this is someone else's lead being opened just to add an enquiry
  // (foreignLead). `restrictedInfo` is whichever record backs the banner.
  const restricted     = !!existingLeadMatch || foreignLead;
  const restrictedInfo = existingLeadMatch || (foreignLead ? initial : null);

  function hc(e) {
    const { name, value, type, checked } = e.target;
    setErrors(p => ({ ...p, [name]: undefined }));
    setMissingLeadFields([]);

    if (name === "company_name") {
      setIsDuplicateExact(false);
      setSelectedExistingLeadId(null);
      setExistingLeadMatch(null);              // typing invalidates a prior match
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      if (value.trim().length >= 2) {
        searchTimeoutRef.current = setTimeout(async () => {
          try {
            const searchUrl = new URL(`${API}/api/leads/search`);
            searchUrl.searchParams.set("query", value.trim());
            const res = await fetch(searchUrl, {
              headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
              setSuggestedLeads(data.leads);
              const exactMatch = data.leads.find(
                lead => lead.company_name.toLowerCase() === value.trim().toLowerCase()
              );
              if (exactMatch && !isEdit) {
                selectSuggestedLead(exactMatch);   // exact match = auto-resolve, same as clicking it
              } else {
                setIsDuplicateExact(false);
              }
            } else {
              throw new Error(data.message || "Search failed");
            }
          } catch (err) {
            console.error("Company search error:", err);
            setSuggestedLeads([]);
          }
        }, 300);
      } else {
        setSuggestedLeads([]);
      }
    }

    setForm(p => {
      const u = { ...p, [name]: type === "checkbox" ? checked : value };
      if (name === "whatsapp_same_as_mobile" && checked) u.whatsapp_number = p.primary_phone;
      if (name === "primary_phone" && p.whatsapp_same_as_mobile) u.whatsapp_number = value;
      return u;
    });
  }

  function hLoc(f, v) { setMissingLeadFields([]); setForm(p => ({ ...p, [f]: v })); }

  function selectSuggestedLead(lead) {
    const sanitized = Object.fromEntries(
      Object.entries(lead).map(([k, v]) => [k, v === null || v === undefined ? "" : v])
    );

    setForm({
      ...emptyLead,
      ...sanitized,
      whatsapp_same_as_mobile: lead.whatsapp_same_as_mobile || false,
      next_action_date: lead.next_action_date?.split("T")[0] || "",
      next_action_time: extractTimeFromFeedback(lead.feedback) || "",
      feedback: cleanFeedback(lead.feedback) || "",
    });
    setSuggestedLeads([]);
    setShowSuggestions(false);
    setSelectedExistingLeadId(lead.id);
    setExistingLeadMatch(lead);              // keep full record (incl. creator) for the banner
    setIsDuplicateExact(false);
    setErrors(p => ({ ...p, company_name: undefined }));
    setMissingLeadFields([]);
    if (enquiryForms.length === 0) setEnquiryForms([emptyEnqForm()]);  // jump straight to enquiry
  }

  function clearExistingLeadMatch() {
    setExistingLeadMatch(null);
    setSelectedExistingLeadId(null);
    setForm(p => ({ ...emptyLead, company_name: p.company_name }));
    setEnquiryForms([]);
    setSuggestedLeads([]);
  }

  function addEnquiryForm() {
    if (!restricted) {
      const missing = missingLeadFormFields(form);
      if (missing.length) { setMissingLeadFields(missing); return; }
    }
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

  useEffect(() => {
    if ((autoAddEnquiry || foreignLead) && isEdit && enquiryForms.length === 0) {
      setEnquiryForms([emptyEnqForm()]);
    }
    // Cleanup search timeout on unmount
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []); // eslint-disable-line

  async function submit(e) {
    e.preventDefault();
    setGenErr("");

    const effectiveIsEdit = isEdit || !!selectedExistingLeadId;
    // Never write to a lead you don't own — even values that look unchanged
    // would still stamp updated_by/updated_at on someone else's record.
    const skipLeadWrite = foreignLead;

    if (!skipLeadWrite) {
      const errs = validateLeadForm(form);

      if (!effectiveIsEdit) {
        const raceMatch = suggestedLeads.find(
          l => l.company_name.toLowerCase() === form.company_name.trim().toLowerCase()
        );
        if (raceMatch) {
          window.alert(`A lead named "${raceMatch.company_name}" already exists. Please select it from the suggestions instead of creating a new one.`);
          setErrors({ company_name: "This lead already exists. Please select it from the suggestions above." });
          return;
        }
      }

      // Only block when they typed an exact match but did NOT select it
      if (!effectiveIsEdit && isDuplicateExact) {
        errs.company_name = "This lead already exists in the system. Please select it from the suggestions above to edit.";
        setErrors(errs);
        return;
      }

      if (Object.keys(errs).length) { setErrors(errs); return; }
    }

    setSaving(true);
    try {
      let savedLead;

      if (skipLeadWrite) {
        savedLead = initial; // untouched — we're only adding enquiries below
      } else {
        const body = {
          ...form,
          feedback: encodeTimeInFeedback(form.next_action_time, form.feedback),
        };
        delete body.next_action_time;

        const targetId = initial?.id || selectedExistingLeadId;
        const url = effectiveIsEdit ? `${API}/api/leads/${targetId}` : `${API}/api/leads`;
        const res = await fetch(url, {
          method: effectiveIsEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) {
          if (res.status === 409) {
            window.alert(data.message || "This lead already exists.");
          }
          throw new Error(data.message || "Failed");
        }
        savedLead = data.lead;
      }

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
          onSaved(savedLead, effectiveIsEdit);
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
        onSaved(savedLead, effectiveIsEdit);
        createdRFQs.forEach(rfq => onEnquirySaved && onEnquirySaved(rfq));
      } else {
        onSaved(savedLead, effectiveIsEdit);
      }
      onClose();
    } catch (err) { setGenErr(err.message); }
    finally { setSaving(false); }
  }

 return (
    <Backdrop>
      <Sheet wide={false} onClick={(e) => e.stopPropagation()}>
        <SheetHead
          title={foreignLead ? "Add Enquiry" : isEdit ? (autoAddEnquiry ? "Add Enquiry" : "Edit Record") : "Add New Record"}
          subtitle={form.company_name || "New Lead / Prospect"}
          onClose={onClose}
          accent="bg-gradient-to-r from-white to-indigo-50/30"
        />
        <form id="lead-form-compact" onSubmit={submit} className="px-4 pt-3 space-y-3">

          <SecDiv title="Company Information" icon={Ic.Building} accent="indigo"/>
          <div className="rounded-xl border border-slate-200 bg-slate-50/40 px-4 py-3 space-y-3 relative">
            {/* Company Name field + suggestions dropdown — always visible */}
            <div>
              <FldInput label="Company Name" name="company_name" value={form.company_name} onChange={hc}
                required icon={Ic.Building} errors={errors} disabled={!!existingLeadMatch || foreignLead}/>

              {/* Exact duplicate warning */}
              <AnimatePresence>
                {isDuplicateExact && !isEdit && !errors.company_name && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2"
                  >
                    <p className="text-sm text-amber-700 flex items-center gap-2">
                      <Ic.Alert className="h-4 w-4 shrink-0"/>
                      This lead already exists in the system. Please select it from the suggestions below to prefill details.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Suggestions dropdown */}
              <AnimatePresence>
                {suggestedLeads.length > 0 && !isEdit && !existingLeadMatch && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="absolute z-50 left-4 right-4 top-[68px] mt-1 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg"
                  >
                    <p className="sticky top-0 bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 border-b border-slate-100">
                      Existing matches ({suggestedLeads.length})
                    </p>
                    {suggestedLeads.map(lead => (
                      <button
                        key={lead.id}
                        type="button"
                        onClick={() => selectSuggestedLead(lead)}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-indigo-50 border-b border-slate-50 last:border-b-0"
                      >
                        <div className="font-medium text-slate-800">{lead.company_name}</div>
                        <div className="text-[11px] text-slate-500">
                          {[lead.city, lead.state].filter(Boolean).join(", ")}
                          {lead.primary_contact_name ? ` • Contact: ${lead.primary_contact_name}` : ""}
                        </div>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {restricted ? null : (
              <>
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
              </>
            )}
          </div>

          {restricted ? (
            <>
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <div className="flex items-start gap-2">
                  <Ic.Alert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5"/>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-amber-800">
                      {existingLeadMatch
                        ? `"${restrictedInfo.company_name}" already exists in the system`
                        : `"${restrictedInfo.company_name}" belongs to another team member`}
                    </p>
                    <p className="mt-0.5 text-[12px] text-amber-700">
                      {existingLeadMatch ? "Created by" : "Owned by"}{" "}
                      <span className="font-medium">
                        {restrictedInfo?.creator
                          ? (restrictedInfo.creator.email ||
                             `${restrictedInfo.creator.first_name || ""} ${restrictedInfo.creator.last_name || ""}`.trim())
                          : "unknown"}
                      </span>
                      . You can add a new enquiry to this lead below{foreignLead ? ", but can't edit its details" : ""}.
                    </p>
                    {existingLeadMatch && (
                      <button
                        type="button"
                        onClick={clearExistingLeadMatch}
                        className="mt-2 text-[11px] font-medium text-amber-700 underline underline-offset-2 hover:text-amber-900"
                      >
                        Not the right company? Search again
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <SecDiv title="Add Enquiry" icon={Ic.FileT} accent="indigo"/>
              <div className="mb-2 space-y-3">
                <AnimatePresence initial={false}>
                  {enquiryForms.map((enq, i) => (
                    <InlineEnquiryBlock key={i} enq={enq} index={i} onUpdate={updateEnquiryForm} onRemove={removeEnquiryForm} productsHook={productsHook}/>
                  ))}
                </AnimatePresence>
                <button type="button" onClick={addEnquiryForm}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-indigo-200 px-4 py-3 text-sm font-medium text-indigo-500 hover:border-indigo-400 hover:bg-indigo-50/40 hover:text-indigo-600 transition-all">
                  <Ic.Plus className="h-4 w-4"/> Add Another Enquiry
                </button>
              </div>
            </>
          ) : (
            <>
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
            </>
          )}

          {genErr && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{genErr}</div>}
        </form>

        <div className="sticky bottom-0 z-10 flex gap-2.5 border-t border-slate-100 bg-white px-4 py-3">
          <GBtn type="button" onClick={onClose} className="flex-1">Cancel</GBtn>
          <PBtn type="submit" form="lead-form-compact" disabled={saving} className="flex-1">
            {saving ? "Saving…" : foreignLead ? "Add Enquiry" : isEdit ? "Update Record" : "Save Record"}
          </PBtn>
        </div>
      </Sheet>
    </Backdrop>
  );
}