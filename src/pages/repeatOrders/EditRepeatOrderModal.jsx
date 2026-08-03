// pages/repeatOrders/EditRepeatOrderModal.jsx
import { useState } from "react";
import { Ic } from "../prospects/icons";
import { Lbl, inp, PBtn, GBtn, Backdrop, Sheet, SheetHead } from "../prospects/ui/primitives";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function EditRepeatOrderModal({ record, token, onClose, onUpdated }) {
  const [form, setForm] = useState({
    party_name: record.party_name || "",
    location: record.location || "",
    gstin: record.gstin || "",
    mobile_1: record.mobile_1 || "",
    mobile_2: record.mobile_2 || "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function submit(e) {
    e.preventDefault();
    if (!form.party_name.trim()) return setErr("Party name is required");

    setSaving(true); setErr("");
    try {
      const r = await fetch(`${API}/api/repeat-orders/${record.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "Failed to update");
      onUpdated(d.repeatOrder);
      onClose();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  return (
    <Backdrop onClick={onClose}>
      <Sheet>
        <SheetHead title="Edit Repeat Order Record" subtitle={record.party_name} onClose={onClose} />
        <form onSubmit={submit} className="flex flex-col px-5 py-4">
          <div className="space-y-3">
            <div>
              <Lbl required>Party Name (Customer)</Lbl>
              <input autoFocus value={form.party_name} onChange={e => set("party_name", e.target.value)} className={inp()} />
            </div>
            <div>
              <Lbl>Location</Lbl>
              <input value={form.location} onChange={e => set("location", e.target.value)} className={inp()} />
            </div>
            <div>
              <Lbl>GSTIN</Lbl>
              <input value={form.gstin} onChange={e => set("gstin", e.target.value)} className={inp()} />
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