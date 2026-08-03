export function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// Date + time together, e.g. "02 Aug 2026, 3:30 pm"
export function fmtDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  const datePart = d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const timePart = d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${datePart}, ${timePart}`;
}

export function fmtMoney(n) {
  const num = Number(n) || 0;
  return "₹" + num.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

export function fmtCompact(n) {
  const num = Number(n) || 0;
  const abs = Math.abs(num);
  if (abs >= 1e7) return "₹" + (num / 1e7).toFixed(abs % 1e7 === 0 ? 0 : 1) + "Cr";
  if (abs >= 1e5) return "₹" + (num / 1e5).toFixed(abs % 1e5 === 0 ? 0 : 1) + "L";
  if (abs >= 1e3) return "₹" + (num / 1e3).toFixed(abs % 1e3 === 0 ? 0 : 1) + "K";
  return "₹" + num.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

export function fmtQty(n) {
  if (n === null || n === undefined || n === "") return "—";
  const num = Number(n) || 0;
  return num.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

// Calendar-day diff (ignores time-of-day) — used only for the coarse
// overdue/today/upcoming bucket label, so "3:30pm today" still reads as
// "Due today" rather than switching to overdue at 3:31pm.
function calendarDaysDiff(iso) {
  const d = new Date(iso);
  const dayOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const today = new Date();
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((todayOnly - dayOnly) / (1000 * 60 * 60 * 24));
}

// next_followup_at is a full ISO datetime (or null/undefined — "no
// follow-up scheduled" is its own state, distinct from "upcoming").
export function followupStatus(nextFollowupAt) {
  if (!nextFollowupAt) return { state: "none", days: 0, label: "No follow-up set", tone: "slate" };
  const d = calendarDaysDiff(nextFollowupAt);
  const time = new Date(nextFollowupAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
  if (d > 0)   return { state: "overdue",  days: d, label: `${d} day${d === 1 ? "" : "s"} overdue`, tone: "rose" };
  if (d === 0) return { state: "today",    days: 0, label: `Due today, ${time}`, tone: "amber" };
  return          { state: "upcoming", days: Math.abs(d), label: `Due in ${Math.abs(d)} day${Math.abs(d) === 1 ? "" : "s"}`, tone: "sky" };
}

// Sort priority for the Active tab: unscheduled records surface first
// (nobody's even planned a next step for them — that's the most
// urgent kind of neglect), then earliest-due records next, on down to
// the furthest-out upcoming ones. Returns a number; sort ascending.
export function activeSortWeight(record) {
  if (!record.next_followup_at) return -Infinity;
  return new Date(record.next_followup_at).getTime();
}

// For tabs where "urgency" doesn't apply the same way — order_placed /
// not_interested sort by how soon they're due to automatically reopen,
// so you can see what's about to land back in your lap.
export function reopenSortWeight(record) {
  if (!record.reopen_at) return Infinity;
  return new Date(record.reopen_at).getTime();
}

export const STATUS_META = {
  unassigned:     { label: "Unassigned",     tone: "slate" },
  assigned:       { label: "In Follow-up",   tone: "sky"   },
  order_placed:   { label: "Order Placed",   tone: "emerald" },
  not_interested: { label: "Not Interested", tone: "rose"  },
};

export const MATCH_STATUS_META = {
  unmatched: { label: "Awaiting invoice",     tone: "slate"   },
  suggested: { label: "Possible match",       tone: "amber"   },
  confirmed: { label: "Confirmed on invoice", tone: "emerald" },
  rejected:  { label: "Not this bill",        tone: "rose"    },
};

export function dialable(phone) {
  const digits = (phone || "").replace(/\D/g, "");
  return digits.startsWith("91") && digits.length > 10 ? digits : `91${digits}`;
}

export function personLabel(p) {
  if (!p) return null;
  const name = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
  return name || p.email || null;
}

const COMPANY_NAME = "Brand Brigade Marketing Pvt Ltd"; // adjust to your registered/trade name if different

export function buildRepeatOrderWaMessage(customer) {
  const name = customer.party_name;
  const products = [...new Set((customer.history || []).map((h) => h.product_name).filter(Boolean))];
  const lastDate = customer.last_purchase_date ? fmtDate(customer.last_purchase_date) : null;

  const productLine = products.length
    ? `We noticed you last ordered ${products.slice(0, 3).join(", ")}${products.length > 3 ? " (and more)" : ""} from us${lastDate ? ` around ${lastDate}` : ""}.`
    : `We noticed it's been a while since your last order with us${lastDate ? ` (around ${lastDate})` : ""}.`;

  return `Dear ${name},\n\nGreetings from ${COMPANY_NAME}.\n\n${productLine} Just checking in to see if you'd like to place a repeat order — happy to share current pricing and availability.\n\nPlease let us know what works for you.\n\nRegards,\n${COMPANY_NAME}`;
}

export function creatorUpdaterFromActivity(activity) {
  if (!activity || !activity.length) return { creator: null, updater: null };
  const created = [...activity].reverse().find((a) => a.action === "created" || a.action === "uploaded");
  const creator = created?.user || null;
  const updater = activity[0]?.user || null;
  return { creator, updater };
}