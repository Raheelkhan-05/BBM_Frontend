// pages/repeatOrders/AssignModal.jsx
import { useState, useEffect } from "react";
import { Ic } from "../prospects/icons";
import { cls, PBtn, GBtn, Backdrop, Sheet, SheetHead } from "../prospects/ui/primitives";
import { personLabel } from "./utils";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

// Manager-only. Lets jay@/communication@ assign an unassigned record, or
// reassign one that's already owned by someone else — this is the single
// place that prevents two salespeople chasing the same company.
export default function AssignModal({ record, token, onClose, onAssigned }) {
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked]   = useState(record.assigned_to || "");
  const [saving, setSaving]   = useState(false);
  const [err, setErr]         = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await fetch(`${API}/api/repeat-orders/assignable-users`, { headers: { Authorization: `Bearer ${token}` } });
        const d = await r.json();
        if (d.success) setUsers(d.users || []);
      } finally { setLoading(false); }
    })();
  }, [token]);

  async function submit(assignedTo) {
    setSaving(true); setErr("");
    try {
      const r = await fetch(`${API}/api/repeat-orders/${record.id}/assign`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ assigned_to: assignedTo || null }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "Failed to assign");
      onAssigned(d.repeatOrder);
      onClose();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  return (
    <Backdrop onClick={onClose}>
      <Sheet>
        <SheetHead title="Assign Record" subtitle={record.party_name} onClose={onClose} />
        <div className="flex flex-col px-5 py-4">
          <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
            {loading ? (
              <div className="py-8 text-center text-[12px] text-slate-400">Loading team…</div>
            ) : users.length === 0 ? (
              <div className="py-8 text-center text-[12px] text-slate-400">No users found</div>
            ) : (
              users.map(u => (
                <button key={u.id} type="button" onClick={() => setPicked(u.id)}
                  className={cls("flex w-full items-center justify-between gap-2 rounded-xl border px-3.5 py-3 text-left transition-colors active:scale-[0.99]",
                    picked === u.id ? "border-indigo-300 bg-indigo-50" : "border-slate-100 bg-slate-50")}>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-bold text-slate-800">{personLabel(u)}</span>
                    <span className="block truncate text-[11px] text-slate-400">{u.email}</span>
                  </span>
                  {picked === u.id && <Ic.Check className="h-4 w-4 shrink-0 text-indigo-600" />}
                </button>
              ))
            )}
          </div>

          {err && <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">{err}</p>}

          <div className="sticky bottom-0 -mx-5 mt-4 flex gap-2 border-t border-slate-100 bg-white/95 px-5 pt-3 backdrop-blur">
            {record.assigned_to && (
              <GBtn type="button" onClick={() => submit(null)} disabled={saving} className="h-12 flex-1 !text-rose-600">
                Unassign
              </GBtn>
            )}
            <PBtn type="button" onClick={() => submit(picked)} disabled={saving || !picked} className="h-12 flex-1">
              {saving ? <><Ic.Spin className="h-4 w-4 animate-spin" />Saving…</> : "Assign"}
            </PBtn>
          </div>
        </div>
      </Sheet>
    </Backdrop>
  );
}