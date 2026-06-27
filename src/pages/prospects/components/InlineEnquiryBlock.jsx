import { motion, AnimatePresence } from "framer-motion";
import ProductPicker from "../../components/ProductPicker";
import {
  UNITS, CONTACT_TYPES, NEXT_ACTION_OPTIONS,
} from "../constants";
import { suggestNextAction, todayStr } from "../utils";
import { Ic } from "../icons";
import { TArea, FldInput, SelInput, Lbl, inp, cls } from "../ui/primitives";

export default function InlineEnquiryBlock({ enq, index, onUpdate, onRemove, productsHook }) {
  function hc(e) {
    const { name, value, type, checked } = e.target;
    onUpdate(index, name, type === "checkbox" ? checked : value);
  }
  function hProd(field, value) {
    const k = { product_category: "product_category", product_sub_category: "product_sub_category", product_name: "product_name" };
    onUpdate(index, k[field] || field, value);
  }

  const suggestedAction = suggestNextAction(enq.sample_required, enq.quotation_required, null, null);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-xl border border-indigo-100 bg-indigo-50/20 overflow-hidden">

      <div className="flex items-center justify-between bg-indigo-50/60 px-4 py-2.5 border-b border-indigo-100">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">{index + 1}</span>
          <span className="text-[11px] font-bold uppercase tracking-widest text-indigo-600">Enquiry {index + 1}</span>
        </div>
        <button type="button" onClick={() => onRemove(index)}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-colors">
          <Ic.Trash className="h-3 w-3"/> Remove
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Product Details */}
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-700 text-[10px] font-bold text-white">1</span>
            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-600">Product Details</span>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-3">
            {productsHook && (
              <div>
                <ProductPicker category={enq.product_category} subCategory={enq.product_sub_category} productName={enq.product_name} onChange={hProd} useProductsHook={productsHook}/>
                {enq._errors?.product_category && <p className="mt-1 text-[11px] text-rose-500">{enq._errors.product_category}</p>}
              </div>
            )}
            <TArea label="Description" name="product_description" value={enq.product_description} onChange={hc} placeholder="Grade, application, specs…" rows={2}/>
            <div className="grid grid-cols-2 gap-3">
              <FldInput label="Qty / Month" name="consumption_per_month" type="number" value={enq.consumption_per_month} onChange={hc} placeholder="500" errors={{}}/>
              <div className="flex flex-col">
                <Lbl>Unit</Lbl>
                <div className="relative">
                  <select name="unit" value={enq.unit} onChange={hc} className={inp("appearance-none pr-9")}>
                    <option value="">Select</option>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <Ic.ChevD className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FldInput label="Target Price (₹)" name="target_price" type="number" value={enq.target_price} onChange={hc} placeholder="2500" errors={{}}/>
              <FldInput label="Existing Supplier" name="existing_supplier_brand" value={enq.existing_supplier_brand} onChange={hc} placeholder="Brand / competitor" errors={{}}/>
            </div>
            <div className="flex flex-wrap gap-5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="sample_required" checked={enq.sample_required} onChange={hc} className="h-4 w-4 rounded border-slate-300 text-indigo-600"/>
                <span className="text-sm text-slate-700">Sample Required</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="quotation_required" checked={enq.quotation_required} onChange={hc} className="h-4 w-4 rounded border-slate-300 text-indigo-600"/>
                <span className="text-sm text-slate-700">Quotation Required</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="tds_available" checked={enq.tds_available} onChange={hc} className="h-4 w-4 rounded border-slate-300 text-indigo-600"/>
                <span className="text-sm text-slate-700">TDS Available</span>
              </label>
            </div>

            <AnimatePresence initial={false}>
              {enq.sample_required && (
                <motion.div key="sample-desc" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden">
                  <TArea label="Sample Description" name="sample_description" value={enq.sample_description} onChange={hc} placeholder="Sample grade, quantity needed, packaging, special requirements…" rows={2}/>
                </motion.div>
              )}
            </AnimatePresence>
            <AnimatePresence initial={false}>
              {enq.quotation_required && (
                <motion.div key="quote-desc" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden">
                  <TArea label="Quotation Description" name="quotation_description" value={enq.quotation_description} onChange={hc} placeholder="Pricing basis, volume tiers, delivery terms, validity…" rows={2}/>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* First Follow-up */}
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">2</span>
            <span className="text-[11px] font-bold uppercase tracking-widest text-amber-600">First Follow-up</span>
          </div>
          <div className="rounded-xl border border-amber-100 bg-amber-50/30 p-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Lbl required>Date</Lbl>
                <input type="date" name="fu_date" value={enq.fu_date} onChange={hc} min={todayStr()} className={inp(enq._errors?.fu_date ? "!border-rose-400" : "")}/>
                {enq._errors?.fu_date && <p className="mt-1 text-[11px] text-rose-500">{enq._errors.fu_date}</p>}
              </div>
              <div>
                <Lbl>Time <span className="normal-case font-normal text-slate-400">(optional)</span></Lbl>
                <input type="time" name="fu_time" value={enq.fu_time} onChange={hc} className={inp()}/>
              </div>
            </div>
            <div>
              <Lbl required>Contact Type</Lbl>
              <div className="relative">
                <select name="fu_contact_type" value={enq.fu_contact_type} onChange={hc} className={inp(cls("appearance-none pr-9", enq._errors?.fu_contact_type ? "!border-rose-400" : ""))}>
                  <option value="">Select…</option>
                  {CONTACT_TYPES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <Ic.ChevD className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/>
              </div>
              {enq._errors?.fu_contact_type && <p className="mt-1 text-[11px] text-rose-500">{enq._errors.fu_contact_type}</p>}
            </div>

            <div>
              <Lbl>Next Action</Lbl>
              {suggestedAction && !enq.fu_next_action && (
                <div className="mb-1.5 flex items-center gap-1.5">
                  <Ic.Sparkle className="h-3 w-3 text-indigo-400"/>
                  <span className="text-[10px] text-indigo-500">Suggested:</span>
                  <button type="button" onClick={() => onUpdate(index, "fu_next_action", suggestedAction)}
                    className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 underline underline-offset-2">
                    {suggestedAction}
                  </button>
                </div>
              )}
              <div className="relative">
                <select name="fu_next_action" value={enq.fu_next_action} onChange={hc} className={inp("appearance-none pr-9")}>
                  <option value="">Select…</option>
                  {NEXT_ACTION_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
                <Ic.ChevD className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/>
              </div>
            </div>

            <TArea label="Note (optional)" name="fu_remark" value={enq.fu_remark} onChange={hc} placeholder="Anything to remember before the first call…" rows={2}/>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
