// pages/pos/utils.js
export function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtMoney(n) {
  const num = Number(n) || 0;
  return "₹" + num.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

export function fmtQty(n) {
  const num = Number(n) || 0;
  return num.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

// Raw signed diff: positive = overdue, 0 = due today, negative = not yet due.
export function daysDiff(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((today - d) / (1000 * 60 * 60 * 24));
}

// Single source of truth for PO delivery-timing status — pass in
// po.expected_delivery_date (order_date + lead_days).
export function poDueStatus(expectedDate) {
  const d = daysDiff(expectedDate);
  if (d === null) return { state: "unknown", days: 0, label: "—", tone: "slate" };
  if (d > 0)   return { state: "overdue",  days: d,          label: `${d} day${d === 1 ? "" : "s"} overdue`,        tone: "rose"  };
  if (d === 0) return { state: "today",    days: 0,          label: "Due today",                                    tone: "amber" };
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

// Fraction of the order delivered so far, 0–1.
export function deliveryProgress(po) {
  const total = Number(po.total_order_qty) || 0;
  const delivered = Number(po.total_delivered_qty) || 0;
  if (total <= 0) return 0;
  return Math.min(1, delivered / total);
}

const COMPANY_NAME = "Brand Brigade Marketing Pvt Ltd"; // adjust to your registered/trade name if different

// Builds a personalized, status-aware WhatsApp message to chase a vendor
// for a pending/overdue/partially-delivered PO.
export function buildPoWaMessage(po) {
  const status = poDueStatus(po.expected_delivery_date);
  const name = po.party_name;
  const pendingQty = (Number(po.total_order_qty) || 0) - (Number(po.total_delivered_qty) || 0);
  const itemList = (po.items || [])
    .filter(it => Number(it.delivered_qty) < Number(it.order_qty))
    .map(it => `- ${it.product_name}: ${fmtQty(it.order_qty - it.delivered_qty)} pending`)
    .join("\n");

  if (po.status === "partial") {
    return `Dear ${name},\n\nGreetings from ${COMPANY_NAME}.\n\nAs per our records, PO #${po.order_no} (dated ${fmtDate(po.order_date)}) has been partially delivered. The following item(s) are still pending:\n\n${itemList}\n\nKindly arrange to dispatch the remaining quantity at the earliest. Please share the expected dispatch date at your convenience.\n\nThank you for your continued partnership.\n\nRegards,\n${COMPANY_NAME}`;
  }

  if (status.state === "overdue") {
    return `Dear ${name},\n\nGreetings from ${COMPANY_NAME}.\n\nThis is to inform you that PO #${po.order_no} (dated ${fmtDate(po.order_date)}) was expected to be delivered by ${fmtDate(po.expected_delivery_date)} and is currently overdue by ${status.days} day${status.days === 1 ? "" : "s"}.\n\nWe would appreciate an update on the dispatch status at the earliest, as this is holding up our downstream schedule. If the order has already been dispatched, kindly share the tracking/transport details.\n\nThank you for your prompt attention to this matter.\n\nRegards,\n${COMPANY_NAME}`;
  }

  if (status.state === "today") {
    return `Dear ${name},\n\nGreetings from ${COMPANY_NAME}.\n\nThis is a reminder that PO #${po.order_no} (dated ${fmtDate(po.order_date)}) is due for delivery today.\n\nKindly confirm the dispatch status and expected arrival at your earliest convenience.\n\nRegards,\n${COMPANY_NAME}`;
  }

  return `Dear ${name},\n\nGreetings from ${COMPANY_NAME}.\n\nThis is a gentle note that PO #${po.order_no} (dated ${fmtDate(po.order_date)}) is scheduled for delivery on ${fmtDate(po.expected_delivery_date)}.\n\nPlease plan accordingly and let us know if there's any change to this timeline.\n\nRegards,\n${COMPANY_NAME}`;
}

export function creatorUpdaterFromActivity(activity) {
  if (!activity || !activity.length) return { creator: null, updater: null };
  const created = [...activity].reverse().find(a => a.action === "created");
  const creator = created?.user || null;
  const updater = activity[0]?.user || null;
  return { creator, updater };
}