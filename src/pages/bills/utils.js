// pages/bills/utils.js
export function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtMoney(n) {
  const num = Number(n) || 0;
  return "₹" + num.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

// Raw signed diff: positive = overdue, 0 = due today, negative = not yet due.
// NOT clamped — clamping was the bug that made future-dated bills show "Billed today".
export function daysDiff(billDate) {
  if (!billDate) return null;
  const bill = new Date(billDate + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  bill.setHours(0, 0, 0, 0);
  return Math.round((today - bill) / (1000 * 60 * 60 * 24));
}

// Single source of truth for status — everything else derives from this.
//
// NOTE: with Credit Days now in play, callers should pass the bill's
// DUE DATE (bill_date + credit_days), not the raw bill_date — e.g.
// billDueStatus(bill.due_date || bill.bill_date). The function itself is
// unchanged since it already just takes a generic date string; only the
// call sites in BillDues.jsx / BillDetailPanel.jsx need to switch which
// field they pass in.
export function billDueStatus(billDate) {
  const d = daysDiff(billDate);
  if (d === null) return { state: "unknown", days: 0, label: "—", tone: "slate" };
  if (d > 0)  return { state: "overdue", days: d,        label: `${d} day${d === 1 ? "" : "s"} overdue`, tone: "rose"  };
  if (d === 0) return { state: "today",   days: 0,        label: "Due today",                              tone: "amber" };
  return          { state: "upcoming", days: Math.abs(d), label: `Due in ${Math.abs(d)} day${Math.abs(d) === 1 ? "" : "s"}`, tone: "sky" };
}

export function dialable(phone) {
  const digits = (phone || "").replace(/\D/g, "");
  return digits.startsWith("91") && digits.length > 10 ? digits : `91${digits}`;
}

export function personLabel(p) {
  if (!p) return null;
  const name = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
  return name || p.email || null;
}

// ── NEW: whether a bill's due date (bill_date + credit_days) has arrived.
// The backend computes credit_days/due_date; this just reads it.
export function isPastDue(bill) {
  if (!bill?.due_date) return false;
  const d = daysDiff(bill.due_date);
  return d !== null && d >= 0;
}

// ── NEW: effective Collection Active flag — manual override wins, otherwise
// auto from the due date. The backend already returns this precomputed as
// bill.collection_active / bill.collection_active_is_manual, so you normally
// won't need to call this; it's here for optimistic client-side updates
// before a refetch.
export function collectionActive(bill) {
  if (bill?.collection_active_manual === true) return true;
  if (bill?.collection_active_manual === false) return false;
  return isPastDue(bill);
}