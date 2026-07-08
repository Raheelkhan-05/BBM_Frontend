// pages/bills/AddBillModal.jsx
import { useState } from "react";
import { Ic } from "../prospects/icons";
import { Lbl, inp, PBtn, GBtn, Backdrop, Sheet, SheetHead } from "../prospects/ui/primitives";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

const EMPTY = {
  party_name: "", bill_no: "", bill_date: "", credit_days: "",
  bill_amount: "", balance_amount: "", location: "", mobile_1: "", mobile_2: "",
};

export default function AddBillModal({ token, onClose, onAdded }) {
  const [form, setForm]     = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState("");

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function submit(e) {
    e.preventDefault();
    if (!form.party_name.trim()) return setErr("Party name is required");
    if (!form.bill_no.trim())    return setErr("Bill No is required");
    if (!form.bill_date)         return setErr("Bill date is required");

    setSaving(true); setErr("");
    try {
      const r = await fetch(`${API}/api/bills`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "Failed to add bill");
      onAdded(d.bill);
      onClose();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  return (
    <Backdrop onClick={onClose}>
      <Sheet>
        <SheetHead title="Add Bill" subtitle="Enter a single bill record manually" onClose={onClose} />
        <form onSubmit={submit} className="flex flex-col px-5 py-4">
          <div className="space-y-3">
            <div>
              <Lbl required>Party Name</Lbl>
              <input autoFocus value={form.party_name} onChange={e => set("party_name", e.target.value)}
                placeholder="e.g. Shree Traders" className={inp()} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Lbl required>Bill No</Lbl>
                <input value={form.bill_no} onChange={e => set("bill_no", e.target.value)}
                  placeholder="e.g. INV-1042" className={inp()} />
              </div>
              <div>
                <Lbl required>Bill Date</Lbl>
                <input type="date" value={form.bill_date} onChange={e => set("bill_date", e.target.value)} className={inp()} />
              </div>
            </div>

            <div>
              <Lbl>Credit Days <span className="normal-case font-normal text-slate-400">(days after Bill Date before it's due for collection)</span></Lbl>
              <input type="number" inputMode="numeric" min="0" value={form.credit_days} onChange={e => set("credit_days", e.target.value)}
                placeholder="0" className={inp()} />
            </div>

            <div>
              <Lbl required>Bill Amount</Lbl>
              <input type="number" inputMode="decimal" value={form.bill_amount} onChange={e => set("bill_amount", e.target.value)}
                  placeholder="₹" className={inp()} />
            </div>

            <div>
              <Lbl>Balance Amt. (Cumulative)</Lbl>
              <input type="number" inputMode="decimal" value={form.balance_amount} onChange={e => set("balance_amount", e.target.value)}
                placeholder="Defaults to bill amount if left blank" className={inp()} />
            </div>

            <div>
              <Lbl>Location</Lbl>
              <input value={form.location} onChange={e => set("location", e.target.value)}
                placeholder="e.g. Rajkot (optional)" className={inp()} />
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

            {err && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">{err}</p>}
          </div>

          <div className="sticky bottom-0 -mx-5 mt-4 flex gap-2 border-t border-slate-100 bg-white/95 px-5 pt-3 backdrop-blur">
            <GBtn type="button" onClick={onClose} className="h-12 flex-1">Cancel</GBtn>
            <PBtn type="submit" disabled={saving} className="h-12 flex-1">
              {saving ? <><Ic.Spin className="h-4 w-4 animate-spin" />Saving…</> : "Add Bill"}
            </PBtn>
          </div>
        </form>
      </Sheet>
    </Backdrop>
  );
}