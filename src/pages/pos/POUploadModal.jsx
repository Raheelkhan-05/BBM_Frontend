// pages/pos/POUploadModal.jsx
import { useState, useRef } from "react";
import { Ic } from "../prospects/icons";
import { cls, PBtn, GBtn, Backdrop, Sheet, SheetHead } from "../prospects/ui/primitives";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function POUploadModal({ token, onClose, onDone }) {
  const [file, setFile]           = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult]       = useState(null);
  const [err, setErr]             = useState("");
  const inputRef = useRef();

  async function submit() {
    if (!file) { setErr("Select an Excel file first"); return; }
    setUploading(true); setErr(""); setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch(`${API}/api/pos/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "Upload failed");
      setResult(d);
      onDone();
    } catch (e) { setErr(e.message); }
    finally { setUploading(false); }
  }

  return (
    <Backdrop onClick={onClose}>
      <Sheet>
        <SheetHead title="Upload Purchase Orders" subtitle="Pending Orders Excel (.xlsx)" onClose={onClose} />
        <div className="flex flex-col px-5 py-5">
          <div className="space-y-4">
            <div
              onClick={() => inputRef.current?.click()}
              className={cls(
                "flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-12 text-center cursor-pointer transition-colors active:scale-[0.99]",
                file ? "border-indigo-300 bg-indigo-50/50" : "border-slate-200 bg-slate-50"
              )}>
              <Ic.Box className="h-9 w-9 text-indigo-400" />
              <p className="text-[14px] font-semibold text-slate-700">{file ? file.name : "Tap to select Excel file"}</p>
              <p className="text-[11px] text-slate-400">.xlsx or .xls</p>
              <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden"
                onChange={e => { setFile(e.target.files?.[0] || null); setResult(null); setErr(""); }} />
            </div>

            <p className="text-[11px] leading-relaxed text-slate-400">
              <span className="block">
                Required columns: Order Date, Order No., Party Name, Product Name, Order Qty, Delivered Qty, Amount.
              </span>
              <span className="mt-1 block">
                This is treated as a live snapshot — re-uploading the same report will sync delivered quantities
                into existing POs (never reduces a quantity already recorded) and add any new orders found.
              </span>
              <i className="mt-1 block">
                Note: Completed or cancelled POs are left untouched even if they still appear in the file.
              </i>
            </p>

            {err && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">{err}</p>}
            {result && (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-700">
                {result.message}
              </p>
            )}
          </div>

          <div className="sticky bottom-0 -mx-5 mt-5 flex gap-2 border-t border-slate-100 bg-white/95 px-5 pt-3 backdrop-blur">
            <GBtn onClick={onClose} className="h-12 flex-1">Close</GBtn>
            <PBtn onClick={submit} disabled={uploading || !file} className="h-12 flex-1">
              {uploading ? <><Ic.Spin className="h-4 w-4 animate-spin" />Uploading…</> : "Upload"}
            </PBtn>
          </div>
        </div>
      </Sheet>
    </Backdrop>
  );
}