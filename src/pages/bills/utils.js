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

// ── NEW: builds a personalized, due-status-aware WhatsApp message.
// Covers overdue / due-today / not-yet-due / cheque-pending phrasing so the
// message always matches what's actually shown on the row.
const COMPANY_NAME = "Brand Brigade Marketing Pvt Ltd"; // adjust to your registered/trade name if different

export function buildWaMessage(bill) {
  const dueDate = bill.due_date || bill.bill_date;
  const status = billDueStatus(dueDate);
  const amount = fmtMoney(bill.balance_amount);
  const name = bill.party_name;

  if (bill.status === "cheque_pending") {
    const pending = (bill.cheques || []).find(c => c.status === "pending");
    const chequeDate = pending ? fmtDate(pending.cheque_date) : fmtDate(bill.next_followup_date);
    return `Dear ${name},\n\nGreetings from ${COMPANY_NAME}.\n\nThis is to confirm that we have on record your cheque of ${fmtMoney(pending?.amount || bill.balance_amount)} dated ${chequeDate}, issued against bill #${bill.bill_no}. We kindly request you to ensure sufficient funds are maintained in the account to enable smooth clearance on presentation.\n\nShould there be any change in the cheque date or amount, please inform us at the earliest.\n\nThank you for your continued business.\n\nRegards,\n${COMPANY_NAME}`;
  }

  if (status.state === "overdue") {
    return `Dear ${name},\n\nGreetings from ${COMPANY_NAME}.\n\nAs per our records, an amount of ${amount} against bill #${bill.bill_no} (dated ${fmtDate(bill.bill_date)}) remains outstanding and is currently overdue by ${status.days} day${status.days === 1 ? "" : "s"}.\n\nWe would appreciate it if you could arrange the payment at the earliest to help us maintain accurate accounts. If the payment has already been made, please share the transaction details for our reference and kindly disregard this reminder.\n\nFor any queries, feel free to reach out to us.\n\nThank you for your prompt attention to this matter.\n\nRegards,\n${COMPANY_NAME}`;
  }

  if (status.state === "today") {
    return `Dear ${name},\n\nGreetings from ${COMPANY_NAME}.\n\nThis is a reminder that payment of ${amount} against bill #${bill.bill_no} (dated ${fmtDate(bill.bill_date)}) is due today.\n\nWe kindly request you to process the payment at your earliest convenience. Should you have already made the payment, please share the transaction details for our records.\n\nWe appreciate your continued partnership and prompt cooperation.\n\nRegards,\n${COMPANY_NAME}`;
  }

  return `Dear ${name},\n\nGreetings from ${COMPANY_NAME}.\n\nThis is a gentle reminder that payment of ${amount} against bill #${bill.bill_no} (dated ${fmtDate(bill.bill_date)}) is scheduled to fall due on ${fmtDate(dueDate)}.\n\nWe request you to plan the payment accordingly to help us maintain a smooth working relationship. Please feel free to reach out should you need any clarification regarding this bill.\n\nThank you for your continued business.\n\nRegards,\n${COMPANY_NAME}`;
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

// Derives "who created it" / "who last touched it" straight from the
// unified activity feed, rather than trusting rfq.creator/rfq.updater —
// those depend on every endpoint remembering to join users correctly,
// while the activity feed is the one place we've already verified is
// accurate.
export function creatorUpdaterFromActivity(activity) {
  if (!activity || !activity.length) return { creator: null, updater: null };
  const created = [...activity].reverse().find(a => a.type === "rfq" && a.action === "created");
  const creator = created?.by || null;
  const updater = activity[0]?.by || null; // newest entry, any type
  return { creator, updater };
}