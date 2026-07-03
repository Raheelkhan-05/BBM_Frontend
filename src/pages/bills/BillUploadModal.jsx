// pages/bills/BillUploadModal.jsx
import { useState, useRef } from "react";
import { Ic } from "../prospects/icons";
import { cls, PBtn, GBtn, Backdrop, Sheet, SheetHead } from "../prospects/ui/primitives";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function BillUploadModal({ token, onClose, onDone }) {
  const [file, setFile]       = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult]   = useState(null);
  const [err, setErr]         = useState("");
  const inputRef = useRef();

  async function submit() {
    if (!file) { setErr("Select an Excel file first"); return; }
    setUploading(true); setErr(""); setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch(`${API}/api/bills/upload`, {
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
        <SheetHead title="Upload Bill Dues" subtitle="Excel (.xlsx) with your standard columns" onClose={onClose} />
        <div className="px-5 py-5 space-y-4">
          <div
            onClick={() => inputRef.current?.click()}
            className={cls(
              "flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-10 text-center cursor-pointer transition-colors",
              file ? "border-indigo-300 bg-indigo-50/50" : "border-slate-200 bg-slate-50 hover:border-indigo-300"
            )}
          >
            <Ic.Box className="h-8 w-8 text-indigo-400" />
            <p className="text-sm font-semibold text-slate-700">{file ? file.name : "Tap to select Excel file"}</p>
            <p className="text-[11px] text-slate-400">.xlsx or .xls</p>
            <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden"
              onChange={e => { setFile(e.target.files?.[0] || null); setResult(null); setErr(""); }} />
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed">
            Expected columns: Party Name, Bill No, Bill Date, Due Days, Bill Amount,
            Balance Amt. (Cumulative), Mobile-1, Mobile-2. Re-uploading updates existing
            bills matched by Bill No and keeps their follow-up history.
          </p>

          {err && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">{err}</p>}
          {result && (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-700">
              {result.message}
              {result.skippedRows?.length > 0 && ` (skipped rows: ${result.skippedRows.join(", ")})`}
            </p>
          )}

          <div className="flex gap-2">
            <GBtn onClick={onClose} className="flex-1">Close</GBtn>
            <PBtn onClick={submit} disabled={uploading || !file} className="flex-1">
              {uploading ? <><Ic.Spin className="h-4 w-4 animate-spin" />Uploading…</> : "Upload"}
            </PBtn>
          </div>
        </div>
      </Sheet>
    </Backdrop>
  );
}