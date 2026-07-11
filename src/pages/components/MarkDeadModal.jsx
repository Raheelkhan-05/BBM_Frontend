import { useState } from "react";
import { Backdrop, Sheet, SheetHead, TArea, GBtn, cls } from "../prospects/ui/primitives";
import { Ic } from "../prospects/icons";

export default function MarkDeadModal({ rfq, onClose, onConfirm }) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  async function submit(e) {
    e.preventDefault();
    if (!reason.trim()) { setError("A reason is required"); return; }
    setSaving(true);
    try {
      await onConfirm(reason.trim());
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  }

  return (
    <Backdrop>
      <Sheet onClick={(e) => e.stopPropagation()}>
        <SheetHead
          title="Mark Enquiry Dead"
          subtitle={rfq.product_name || rfq.product_category}
          onClose={onClose}
          accent="bg-gradient-to-r from-white to-rose-50/30"
        />
        <form onSubmit={submit} className="px-5 pb-6 pt-4 space-y-4">
          <div className="rounded-xl border border-rose-100 bg-rose-50/40 px-4 py-3 flex items-start gap-2">
            <Ic.Alert className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
            <p className="text-[11px] text-rose-700 leading-snug">
              This enquiry — and its sample/quotation — will drop out of the Tasks view.
              This can be reversed later, but a reason is required for the record.
            </p>
          </div>

          <TArea
            label="Reason"
            name="dead_reason"
            required
            value={reason}
            onChange={(e) => { setError(""); setReason(e.target.value); }}
            placeholder="e.g. Client went with a competitor, budget cut, no response after 3 follow-ups…"
            rows={3}
          />
          {error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

          <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-3">
            <GBtn type="button" onClick={onClose} disabled={saving}>Cancel</GBtn>
            <button
              type="submit"
              disabled={saving}
              className={cls(
                "inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition-colors disabled:opacity-60",
                "bg-rose-600 hover:bg-rose-700 shadow-sm shadow-rose-200"
              )}
            >
              {saving ? <><Ic.Spin className="h-3.5 w-3.5 animate-spin"/>Marking dead…</> : <><Ic.X className="h-3.5 w-3.5"/>Mark Dead</>}
            </button>
          </div>
        </form>
      </Sheet>
    </Backdrop>
  );
}