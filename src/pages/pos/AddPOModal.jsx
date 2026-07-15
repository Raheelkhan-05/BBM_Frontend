// pages/pos/AddPOModal.jsx
import { useState } from "react";
import { Ic } from "../prospects/icons";
import { Lbl, inp, PBtn, GBtn, Backdrop, Sheet, SheetHead } from "../prospects/ui/primitives";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

const EMPTY_FORM = { party_name: "", order_no: "", order_date: "", lead_days: "", location: "", mobile_1: "", mobile_2: "" };
const EMPTY_ITEM = () => ({ key: Math.random().toString(36).slice(2), product_name: "", order_qty: "", amount: "" });

export default function AddPOModal({ token, onClose, onAdded }) {
  const [form, setForm]     = useState(EMPTY_FORM);
  const [items, setItems]   = useState([EMPTY_ITEM()]);
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState("");

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }
  function setItem(key, k, v) { setItems(list => list.map(it => it.key === key ? { ...it, [k]: v } : it)); }
  function addItem() { setItems(list => [...list, EMPTY_ITEM()]); }
  function removeItem(key) { setItems(list => list.length > 1 ? list.filter(it => it.key !== key) : list); }

  const itemsTotal = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);

  async function submit(e) {
    e.preventDefault();
    if (!form.party_name.trim()) return setErr("Party name is required");
    if (!form.order_no.trim())   return setErr("Order No is required");
    if (!form.order_date)        return setErr("Order date is required");
    const cleanItems = items.filter(it => it.product_name.trim());
    if (cleanItems.length === 0) return setErr("Add at least one product line item");
    if (cleanItems.some(it => !Number(it.order_qty) || Number(it.order_qty) <= 0)) return setErr("Every line item needs a valid order quantity");

    setSaving(true); setErr("");
    try {
      const r = await fetch(`${API}/api/pos`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...form,
          items: cleanItems.map(it => ({ product_name: it.product_name, order_qty: it.order_qty, amount: it.amount })),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "Failed to add PO");
      onAdded(d.po);
      onClose();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  return (
    <Backdrop onClick={onClose}>
      <Sheet>
        <SheetHead title="Add Purchase Order" subtitle="Enter a single PO manually" onClose={onClose} />
        <form onSubmit={submit} className="flex flex-col px-5 py-4">
          <div className="space-y-3">
            <div>
              <Lbl required>Party Name (Vendor)</Lbl>
              <input autoFocus value={form.party_name} onChange={e => set("party_name", e.target.value)}
                placeholder="e.g. Aditya Packaging Pvt Ltd" className={inp()} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Lbl required>Order No</Lbl>
                <input value={form.order_no} onChange={e => set("order_no", e.target.value)}
                  placeholder="e.g. 60" className={inp()} />
              </div>
              <div>
                <Lbl required>Order Date</Lbl>
                <input type="date" value={form.order_date} onChange={e => set("order_date", e.target.value)} className={inp()} />
              </div>
            </div>

            <div>
              <Lbl>Lead Days <span className="normal-case font-normal text-slate-400">(days after Order Date before it's expected)</span></Lbl>
              <input type="number" inputMode="numeric" min="0" value={form.lead_days} onChange={e => set("lead_days", e.target.value)}
                placeholder="0" className={inp()} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Lbl>Mobile-1</Lbl>
                <input type="tel" inputMode="tel" value={form.mobile_1} onChange={e => set("mobile_1", e.target.value)}
                  placeholder="10-digit mobile" className={inp()} />
              </div>
              <div>
                <Lbl>Mobile-2</Lbl>
                <input type="tel" inputMode="tel" value={form.mobile_2} onChange={e => set("mobile_2", e.target.value)}
                  placeholder="Optional" className={inp()} />
              </div>
            </div>

            <div>
              <Lbl>Location</Lbl>
              <input value={form.location} onChange={e => set("location", e.target.value)}
                placeholder="Optional" className={inp()} />
            </div>

            {/* Line items */}
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <Lbl required>Product Line Items</Lbl>
                <button type="button" onClick={addItem}
                  className="flex items-center gap-1 rounded-full border border-indigo-200 bg-white px-2.5 py-1 text-[10.5px] font-semibold text-indigo-600 active:scale-95">
                  <Ic.Plus className="h-3 w-3" /> Add item
                </button>
              </div>
              <div className="space-y-2">
                {items.map((it, idx) => (
                  <div key={it.key} className="rounded-lg border border-slate-200 bg-white p-2.5">
                    <div className="flex items-center gap-2">
                      <input value={it.product_name} onChange={e => setItem(it.key, "product_name", e.target.value)}
                        placeholder={`Product ${idx + 1}`} className={inp("flex-1 text-[13px]")} />
                      {items.length > 1 && (
                        <button type="button" onClick={() => removeItem(it.key)}
                          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                          <Ic.Trash className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <input type="number" inputMode="decimal" value={it.order_qty} onChange={e => setItem(it.key, "order_qty", e.target.value)}
                        placeholder="Order Qty" className={inp("text-[13px]")} />
                      <input type="number" inputMode="decimal" value={it.amount} onChange={e => setItem(it.key, "amount", e.target.value)}
                        placeholder="Amount ₹" className={inp("text-[13px]")} />
                    </div>
                  </div>
                ))}
              </div>
              {itemsTotal > 0 && (
                <p className="mt-2 text-right text-[11px] font-semibold text-slate-500">
                  Total: ₹{itemsTotal.toLocaleString("en-IN")}
                </p>
              )}
            </div>

            {err && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">{err}</p>}
          </div>

          <div className="sticky bottom-0 -mx-5 mt-4 flex gap-2 border-t border-slate-100 bg-white/95 px-5 pt-3 backdrop-blur">
            <GBtn type="button" onClick={onClose} className="h-12 flex-1">Cancel</GBtn>
            <PBtn type="submit" disabled={saving} className="h-12 flex-1">
              {saving ? <><Ic.Spin className="h-4 w-4 animate-spin" />Saving…</> : "Add PO"}
            </PBtn>
          </div>
        </form>
      </Sheet>
    </Backdrop>
  );
}