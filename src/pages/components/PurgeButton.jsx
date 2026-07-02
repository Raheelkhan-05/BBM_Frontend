import { useState } from "react";
import { Ic } from "../prospects/icons";
import { cls } from "../prospects/ui/primitives";

const HEAD_EMAIL = "communication@bbmpvtltd.com";

// Renders nothing unless the logged-in user is exactly communication@bbmpvtltd.com.
// This is a UI convenience only — the backend independently re-checks the
// same email on every purge endpoint, so hiding this button is not the
// actual security boundary, just keeps the option out of everyone else's way.
export default function PurgeButton({
  user, token, endpoint, itemLabel, confirmMessage, onDeleted, size = "md",
}) {
  const [busy, setBusy] = useState(false);

  if (user?.email !== HEAD_EMAIL) return null;

  async function handleClick(e) {
    e.stopPropagation();
    const msg = confirmMessage ||
      `Permanently delete this ${itemLabel || "record"}? This cannot be undone — all related records and history will be removed.`;
    if (!window.confirm(msg)) return;

    setBusy(true);
    try {
      const res = await fetch(endpoint, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const raw = await res.text();
      let data = null;
      try { data = raw ? JSON.parse(raw) : null; } catch { /* non-JSON error body */ }
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || `Delete failed (${res.status})`);
      }
      onDeleted?.(data);
    } catch (err) {
      alert(err.message || "Permanent delete failed");
    } finally {
      setBusy(false);
    }
  }

  const isSm = size === "sm";

  return (
    <button
      onClick={handleClick}
      disabled={busy}
      title={`Permanently delete this ${itemLabel || "record"} (visible only to ${HEAD_EMAIL})`}
      className={cls(
        "inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 font-bold text-rose-600 transition-colors hover:bg-rose-100 disabled:opacity-50",
        isSm ? "px-2 py-1 text-[10px]" : "px-3 py-1.5 text-[12px]"
      )}
    >
      {busy ? (
        <Ic.Spin className={cls("animate-spin", isSm ? "h-3 w-3" : "h-3.5 w-3.5")} />
      ) : (
        <Ic.Trash className={isSm ? "h-3 w-3" : "h-3.5 w-3.5"} />
      )}
      {busy ? "Deleting…" : "Delete Permanently"}
    </button>
  );
}