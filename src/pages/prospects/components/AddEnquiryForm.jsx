import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ProductPicker from "../../components/ProductPicker";
import { UNITS, CONTACT_TYPES, NEXT_ACTION_OPTIONS } from "../constants";
import { suggestNextAction, validateEnqForm, encodeTimeInNotes, todayStr } from "../utils";
import { Ic } from "../icons";
import { Backdrop, Sheet, SheetHead, FldInput, SelInput, TArea, Lbl, FErr, PBtn, GBtn, inp } from "../ui/primitives";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function AddEnquiryForm({ lead, token, productsHook, onClose, onSaved }) {
  const [form, setForm] = useState({
    product_category:"", product_sub_category:"", product_name:"", product_description:"",
    consumption_per_month:"", unit:"", sample_required:false, quotation_required:false,
    sample_description:"", quotation_description:"",
    existing_supplier_brand:"", target_price:"", tds_available:false,
    fu_date:"", fu_time:"", fu_contact_type:"", fu_remark:"", fu_next_action:"",
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  function hc(e) { const { name, value, type, checked } = e.target; setErrors(p => ({ ...p, [name]: undefined })); setForm(p => ({ ...p, [name]: type === "checkbox" ? checked : value })); }
  function hProd(field, value) {
    const k = { product_category:"product_category", product_sub_category:"product_sub_category", product_name:"product_name" };
    setErrors(p => ({ ...p, [k[field] || field]: undefined }));
    setForm(p => ({ ...p, [k[field] || field]: value }));
  }

  const suggestedAction = suggestNextAction(form.sample_required, form.quotation_required, null, null);

  async function submit(e) {
    e.preventDefault();
    const errs = validateEnqForm(form);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      const r1 = await fetch(`${API}/api/rfqs`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          lead_id: lead.id, company_name: lead.company_name,
          product_category: form.product_category, product_sub_category: form.product_sub_category || null,
          product_name: form.product_name || null, product_description: form.product_description || null,
          consumption_per_month: form.consumption_per_month || null, unit: form.unit || null,
          sample_required: form.sample_required, quotation_required: form.quotation_required,
          sample_description: form.sample_description || null,
          quotation_description: form.quotation_description || null,
          existing_supplier_brand: form.existing_supplier_brand || null,
          target_price: form.target_price || null,
          tds_available: form.tds_available || false,
        }),
      });
      const d1 = await r1.json();
      if (!r1.ok) throw new Error(d1.message || "RFQ failed");

      const r2 = await fetch(`${API}/api/rfqs/${d1.rfq.id}/followups`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          contact_type: form.fu_contact_type, followup_date: form.fu_date, enquiry_status: "Open",
          next_action: form.fu_next_action || null, remark: form.fu_remark || null,
          notes: encodeTimeInNotes(form.fu_time, null),
          target_price: form.target_price || null,
        }),
      });
      const d2 = await r2.json();
      if (!r2.ok) throw new Error(d2.message || "Follow-up failed");

      onSaved({ ...d1.rfq, rfq_followups: [d2.followup], samples: [], quotations: [] });
      onClose();
    } catch (err) { setErrors({ _g: err.message }); }
    finally { setSaving(false); }
  }

  return (
    <Backdrop onClick={onClose}>
      <Sheet wide>
        <SheetHead title="Add New Enquiry" subtitle={lead.company_name} onClose={onClose} accent="bg-gradient-to-r from-white to-sky-50/30"/>
        <form onSubmit={submit} className="px-5 pb-6 pt-4">
          <div className="mb-1 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">1</span>
            <span className="text-[11px] font-bold uppercase tracking-widest text-indigo-600">Product Details</span>
          </div>
          <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50/40 p-4 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                {productsHook && <ProductPicker category={form.product_category} subCategory={form.product_sub_category} productName={form.product_name} onChange={hProd} useProductsHook={productsHook}/>}
                <FErr name="product_category" errors={errors}/>
              </div>
              <div className="sm:col-span-2"><TArea label="Description" name="product_description" value={form.product_description} onChange={hc} placeholder="Grade, application, specs…" rows={2}/></div>
              <div className="grid grid-cols-2 gap-2 sm:col-span-2 sm:grid-cols-4">
                <div className="col-span-2"><FldInput label="Qty/Month" name="consumption_per_month" type="number" value={form.consumption_per_month} onChange={hc} placeholder="500"/></div>
                <div className="col-span-2"><SelInput label="Unit" name="unit" value={form.unit} onChange={hc} options={UNITS}/></div>
              </div>
              <FldInput label="Target Price (₹)" name="target_price" type="number" value={form.target_price} onChange={hc} placeholder="2500"/>
              <FldInput label="Existing Supplier" name="existing_supplier_brand" value={form.existing_supplier_brand} onChange={hc} placeholder="Brand / competitor"/>
            </div>
            <div className="flex flex-wrap gap-5 pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="sample_required" checked={form.sample_required} onChange={hc} className="h-4 w-4 rounded border-slate-300 text-indigo-600"/>
                <span className="text-sm text-slate-700">Sample Required</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="quotation_required" checked={form.quotation_required} onChange={hc} className="h-4 w-4 rounded border-slate-300 text-indigo-600"/>
                <span className="text-sm text-slate-700">Quotation Required</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="tds_available" checked={form.tds_available} onChange={hc} className="h-4 w-4 rounded border-slate-300 text-indigo-600"/>
                <span className="text-sm text-slate-700">TDS Available</span>
              </label>
            </div>
            <AnimatePresence initial={false}>
              {form.sample_required && (
                <motion.div key="sample-desc" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden">
                  <div className="rounded-xl border border-teal-100 bg-teal-50/40 p-3">
                    <TArea label="Sample Description" name="sample_description" value={form.sample_description} onChange={hc} placeholder="Sample grade, quantity needed, packaging, special requirements…" rows={2}/>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <AnimatePresence initial={false}>
              {form.quotation_required && (
                <motion.div key="quote-desc" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden">
                  <div className="rounded-xl border border-violet-100 bg-violet-50/40 p-3">
                    <TArea label="Quotation Description" name="quotation_description" value={form.quotation_description} onChange={hc} placeholder="Pricing basis, volume tiers, delivery terms, validity…" rows={2}/>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="mb-1 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">2</span>
            <span className="text-[11px] font-bold uppercase tracking-widest text-amber-600">Schedule First Follow-up</span>
          </div>
          <div className="mb-6 rounded-xl border border-amber-100 bg-amber-50/30 p-4 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Lbl required>Follow-up Date</Lbl>
                <input type="date" name="fu_date" value={form.fu_date} onChange={hc} min={todayStr()} className={inp(errors.fu_date ? "!border-rose-400" : "")}/>
                <FErr name="fu_date" errors={errors}/>
              </div>
              <div>
                <Lbl>Time <span className="normal-case font-normal text-slate-400">(optional)</span></Lbl>
                <input type="time" name="fu_time" value={form.fu_time} onChange={hc} className={inp()}/>
              </div>
              <div className="sm:col-span-2">
                <SelInput label="How would you contact?" name="fu_contact_type" value={form.fu_contact_type} onChange={hc} options={CONTACT_TYPES} required errors={{ fu_contact_type: errors.fu_contact_type }}/>
              </div>
              <div className="sm:col-span-2">
                <Lbl>Next Action</Lbl>
                {suggestedAction && !form.fu_next_action && (
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <Ic.Sparkle className="h-3 w-3 text-indigo-400"/>
                    <span className="text-[10px] text-indigo-500">Suggested:</span>
                    <button type="button" onClick={() => setForm(p => ({ ...p, fu_next_action: suggestedAction }))}
                      className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 underline underline-offset-2">{suggestedAction}</button>
                  </div>
                )}
                <div className="relative">
                  <select name="fu_next_action" value={form.fu_next_action} onChange={hc} className={inp("appearance-none pr-9")}>
                    <option value="">Select…</option>
                    {NEXT_ACTION_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                  <Ic.ChevD className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/>
                </div>
              </div>
              <div className="sm:col-span-2">
                <TArea label="Note (optional)" name="fu_remark" value={form.fu_remark} onChange={hc} placeholder="Anything to remember before the first call…" rows={2}/>
              </div>
            </div>
          </div>

          {errors._g && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errors._g}</div>}
          <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-4">
            <GBtn type="button" onClick={onClose}>Cancel</GBtn>
            <PBtn type="submit" disabled={saving}>{saving ? "Adding…" : "Add Enquiry"}</PBtn>
          </div>
        </form>
      </Sheet>
    </Backdrop>
  );
}
