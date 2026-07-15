// pages/pos/EditPOModal.jsx
import { useState } from "react";
import { Ic } from "../prospects/icons";
import { Lbl, inp, PBtn, GBtn, Backdrop, Sheet, SheetHead } from "../prospects/ui/primitives";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

// Edits header fields only — product/qty/amount changes go through the
// Delivery tab (recordDelivery) so quantity history stays auditable.
export default function EditPOModal({ po, token, onClose, onUpdated }) {
  const [form, setForm] = useState({
    party_name: po.party_name || "",
    order_no: po.order_no || "",
    order_date: po.order_date || "",
    lead_days: po.lead_days ?? 0,
    location: po.location || "",
    mobile_1: po.mobile_1 || "",
    mobile_2: po.mobile_2 || "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function submit(e) {
    e.preventDefault();
    if (!form.party_name.trim()) return setErr("Party name is required");
    if (!form.order_no.trim())   return setErr("Order No is required");
    if (!form.order_date)        return setErr("Order date is required");

    setSaving(true); setErr("");
    try {
      const r = await fetch(`${API}/api/pos/${po.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "Failed to update PO");
      onUpdated(d.po);
      onClose();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  return (
    <Backdrop onClick={onClose}>
      <Sheet>
        <SheetHead title="Edit Purchase Order" subtitle={`Order #${po.order_no}`} onClose={onClose} />
        <form onSubmit={submit} className="flex flex-col px-5 py-4">
          <div className="space-y-3">
            <div>
              <Lbl required>Party Name (Vendor)</Lbl>
              <input autoFocus value={form.party_name} onChange={e => set("party_name", e.target.value)} className={inp()} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Lbl required>Order No</Lbl>
                <input value={form.order_no} onChange={e => set("order_no", e.target.value)} className={inp()} />
              </div>
              <div>
                <Lbl required>Order Date</Lbl>
                <input type="date" value={form.order_date} onChange={e => set("order_date", e.target.value)} className={inp()} />
              </div>
            </div>
            <div>
              <Lbl>Lead Days <span className="normal-case font-normal text-slate-400">(days after Order Date before it's expected)</span></Lbl>
              <input type="number" inputMode="numeric" min="0" value={form.lead_days} onChange={e => set("lead_days", e.target.value)} className={inp()} />
            </div>
            <div>
              <Lbl>Location</Lbl>
              <input value={form.location} onChange={e => set("location", e.target.value)} placeholder="Optional" className={inp()} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Lbl>Mobile-1</Lbl>
                <input type="tel" inputMode="tel" value={form.mobile_1} onChange={e => set("mobile_1", e.target.value)} className={inp()} />
              </div>
              <div>
                <Lbl>Mobile-2</Lbl>
                <input type="tel" inputMode="tel" value={form.mobile_2} onChange={e => set("mobile_2", e.target.value)} className={inp()} />
              </div>
            </div>

            <p className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
              Product line items and quantities are managed from the Delivery tab in the PO detail view, so every
              quantity change stays in the audit history.
            </p>

            {err && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">{err}</p>}
          </div>

          <div className="sticky bottom-0 -mx-5 mt-4 flex gap-2 border-t border-slate-100 bg-white/95 px-5 pt-3 backdrop-blur">
            <GBtn type="button" onClick={onClose} className="h-12 flex-1">Cancel</GBtn>
            <PBtn type="submit" disabled={saving} className="h-12 flex-1">
              {saving ? <><Ic.Spin className="h-4 w-4 animate-spin" />Saving…</> : "Save Changes"}
            </PBtn>
          </div>
        </form>
      </Sheet>
    </Backdrop>
  );
}