import { CLOSED_STATUSES, CLOSED_ACTIONS } from "./constants";

/* ─── Enquiry closed check ───────────────────────────────────── */
export function isEnquiryClosed(rfq) {
  if (rfq.is_dead) return true;
  const fups = (rfq.rfq_followups || []).filter(f => !f.deleted_at);
  if (!fups.length) return false;
  const latest = [...fups].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
  return CLOSED_STATUSES.has(latest.enquiry_status) || CLOSED_ACTIONS.has(latest.next_action);
}

/* ─── Date helpers ───────────────────────────────────────────── */
export function todayMidnight() { const d = new Date(); d.setHours(0,0,0,0); return d; }
export function parseDate(d)    { if (!d) return null; return new Date(d.split("T")[0]); }
export function isOverdue(d)    { const p = parseDate(d); return p && p < todayMidnight(); }
export function isToday(d)      { const p = parseDate(d); return p && p.toDateString() === todayMidnight().toDateString(); }
export function isTomorrow(d) {
  if (!d) return false;
  const t = new Date(todayMidnight()); t.setDate(t.getDate() + 1);
  return parseDate(d)?.toDateString() === t.toDateString();
}
export function isFuture(d) { return d && !isOverdue(d) && !isToday(d) && !isTomorrow(d); }
export function fmtD(d)  { if (!d) return null; return new Date(d).toLocaleDateString("en-IN", {day:"numeric",month:"short",year:"numeric"}); }
export function fmtDT(d) {
  if (!d) return null;
  const iso = String(d).replace(" ","T").replace(/(\+00(:00)?)?$/, "Z");
  return new Date(iso).toLocaleString("en-IN", {day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:true,timeZone:"Asia/Kolkata"});
}
export function relTime(d) {
  if (!d) return "";
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return fmtD(d);
}
export function todayStr() { return new Date().toISOString().slice(0, 10); }
export function dueCls(d)   { return isOverdue(d) ? "text-rose-500 font-semibold" : isToday(d) ? "text-amber-500 font-semibold" : isTomorrow(d) ? "text-sky-600 font-medium" : "text-slate-500"; }
export function dueLabel(d) { return isOverdue(d) ? "Overdue" : isToday(d) ? "Today" : isTomorrow(d) ? "Tomorrow" : fmtD(d) || "—"; }

/* ─── Notes / time encoding ──────────────────────────────────── */
export function encodeTimeInNotes(time, notes) {
  const base = (notes || "").replace(/^\[Time: \d{2}:\d{2}\]\s*/, "").trim();
  if (!time) return base || null;
  return `[Time: ${time}]${base ? " " + base : ""}`;
}
export function extractTimeFromNotes(notes) {
  const m = (notes || "").match(/^\[Time: (\d{2}:\d{2})\]/);
  return m ? m[1] : null;
}
export function cleanNotes(notes) {
  return (notes || "").replace(/^\[Time: \d{2}:\d{2}\]\s*/, "").trim() || null;
}
export function encodeTimeInFeedback(time, feedback) {
  const base = (feedback || "").replace(/\n\[Time: \d{2}:\d{2}\]$/, "").trim();
  if (!time) return base || null;
  return base ? `${base}\n[Time: ${time}]` : `[Time: ${time}]`;
}
export function extractTimeFromFeedback(feedback) {
  const m = (feedback || "").match(/\n?\[Time: (\d{2}:\d{2})\]$/);
  return m ? m[1] : null;
}
export function cleanFeedback(feedback) {
  return (feedback || "").replace(/\n?\[Time: \d{2}:\d{2}\]$/, "").trim() || null;
}

/* ─── Follow-up helpers ──────────────────────────────────────── */
// NOTE: moved above the RFQ date helpers since rfqNearestDate/itemContactType
// depend on latestFU — must be defined before use in module evaluation order
// for clarity (function declarations are hoisted either way, but keeping
// dependency order readable avoids future foot-guns).
export function sortFupsByCreated(fups) { return [...fups].filter(f => !f.deleted_at).sort((a,b) => new Date(b.created_at) - new Date(a.created_at)); }
export function latestFU(rfq)          { return sortFupsByCreated(rfq.rfq_followups || [])[0] || null; }
export function latestStatus(rfq)      { return latestFU(rfq)?.enquiry_status || "Open"; }

/* ─── RFQ date helpers ───────────────────────────────────────── */

// Nearest active (not-closed) follow-up date for a single enquiry.
// Prefers the sample/quotation dates when that enquiry actually requires
// them (since those are updated independently and each has its own
// follow-up schedule); falls back to the plain rfq_followups trail for
// enquiries that need neither.
function rfqNearestDate(rfq) {
  if (isEnquiryClosed(rfq)) return null;

  const dates = [];
  if (rfq.sample_required) {
    const s = (rfq.samples || [])[0];
    if (s?.follow_up_date) dates.push(s.follow_up_date);
  }
  if (rfq.quotation_required) {
    const q = (rfq.quotations || [])[0];
    if (q?.follow_up_date) dates.push(q.follow_up_date);
  }
  if (!dates.length) {
    const fu = latestFU(rfq);
    if (fu?.followup_date) dates.push(fu.followup_date);
  }
  return dates.sort()[0] || null; // earliest string = nearest/most overdue
}

// Nearest active date across ALL of a lead's enquiries.
export function rfqNearestActiveDate(rfqs) {
  const dates = (rfqs || []).map(rfqNearestDate).filter(Boolean);
  return dates.sort()[0] || null;
}

export function itemContactType(item, rfqs) {
  if (item._type === "prospect") return item.next_action || null;
  let best = null, bestDate = null;
  (rfqs || []).forEach(r => {
    if (isEnquiryClosed(r)) return;
    const fup = latestFU(r);
    if (fup?.contact_type && fup?.followup_date) {
      if (!bestDate || fup.followup_date < bestDate) { bestDate = fup.followup_date; best = fup.contact_type; }
    }
  });
  return best;
}

// Nearest date for either a prospect or a lead.
// Prospects: their own next_action_date.
// Leads: the nearest active date across all their enquiries — which,
// per enquiry, is the nearest of its sample/quotation follow-up dates
// (each updated independently), or the plain follow-up trail if the
// enquiry needs neither a sample nor a quotation.
export function itemNearestDate(item, rfqs = []) {
  const openRfqs = (rfqs || []).filter(r => !isEnquiryClosed(r));
  const dates = openRfqs.map(rfqNearestDate).filter(Boolean);
  const nearestFromRfqs = dates.sort()[0] || null;

  // Has an active enquiry with its own follow-up date → that takes priority
  if (nearestFromRfqs) return nearestFromRfqs;

  // No open enquiry follow-up (either no enquiries at all yet — still
  // prospect-stage — or every enquiry is closed) → fall back to the
  // record's own prospect-stage next_action_date, if any.
  return item.next_action_date ? item.next_action_date.split("T")[0] : null;
}

/* ─── Lead conversion validation ────────────────────────────── */
export function missingForEnquiry(lead) {
  const m = [];
  if (!lead.nature_of_business)   m.push("Nature of Business");
  if (!lead.state)                m.push("State");
  if (!lead.city)                 m.push("City");
  if (!lead.zone)                 m.push("Zone");
  if (!lead.route)                m.push("Route");
  if (!lead.primary_contact_name) m.push("Primary Contact Name");
  if (!lead.primary_designation)  m.push("Primary Designation");
  if (!lead.primary_phone && !lead.primary_email) m.push("Primary Phone or Email");
  return m;
}
// export function missingLeadFormFields(form) {
//   const m = [];
//   if (!form.nature_of_business)   m.push("Nature of Business");
//   if (!form.state)                m.push("State");
//   if (!form.city)                 m.push("City");
//   if (!form.zone)                 m.push("Zone");
//   if (!form.route)                m.push("Route");
//   if (!form.primary_contact_name) m.push("Primary Contact Name");
//   if (!form.primary_designation)  m.push("Primary Designation");
//   if (!form.primary_phone && !form.primary_email) m.push("Primary Phone or Email");
//   return m;
// }

/* ─── Next action suggestion ─────────────────────────────────── */
export function suggestNextAction(sampleRequired, quotationRequired, sampleStatus, quotationStatus) {
  if (sampleRequired && sampleStatus) {
    if (sampleStatus === "Sample to be Submitted") return "Sample to be Submitted";
    if (sampleStatus === "Sample Submitted")       return "Sample to be Tried";
    if (sampleStatus === "Sample Under Trial")     return "Collect Sample Feedback";
    if (sampleStatus === "Approved")               return quotationRequired ? "Quotation to be Submitted" : "Order Confirmation";
    if (sampleStatus === "Rejected")               return "Follow-up";
  }
  if (quotationRequired && quotationStatus) {
    if (quotationStatus === "Quotation Submitted")        return "Collect Quotation Feedback";
    if (quotationStatus === "Quotation to be Negotiated") return "Price Negotiation";
    if (quotationStatus === "Approved")                   return "Order Confirmation";
    if (quotationStatus === "Rejected")                   return "Follow-up";
  }
  if (sampleRequired && !sampleStatus)      return "Sample to be Submitted";
  if (quotationRequired && !quotationStatus) return "Quotation to be Submitted";
  return "Follow-up";
}

/* ─── Enquiry form helpers ───────────────────────────────────── */
export function emptyEnqForm() {
  return {
    product_category:"", product_sub_category:"", product_name:"",
    product_description:"", consumption_per_month:"", unit:"",
    sample_required:true, quotation_required:true,
    sample_description:"", quotation_description:"",
    existing_supplier_brand:"", target_price:"",
    tds_available:false,
    fu_date:"", fu_time:"", fu_contact_type:"", fu_remark:"", fu_next_action:"",
    _errors:{},
  };
}
export function validateEnqForm(enq) {
  const errs = {};
  if (!enq.product_category) errs.product_category = "Required";
  if (!enq.fu_date)          errs.fu_date = "Required";
  // if (!enq.fu_contact_type)  errs.fu_contact_type = "Required";
  if (enq.fu_date && enq.fu_date < todayStr()) {
    errs.fu_date = "Date cannot be in the past";
  }
  return errs;
}


export function isLeadStage(item, rfqs) {
  return (rfqs || []).length > 0;
}

// Only company_name is required to save at all.
export function validateLeadForm(f) {
  const e = {};
  if (!f.company_name?.trim()) e.company_name = "Required";
  return e;
}

// Relaxed — you can add an enquiry as long as there's a company name.
export function missingLeadFormFields(f) {
  const missing = [];
  if (!f.company_name?.trim()) missing.push("Company Name");
  return missing;
}

// Full validation — only enforced when converting an enquiry to an Order.
export function missingForOrder(lead, rfq) {
  const missing = [];
  if (!lead.company_name?.trim())        missing.push("Company Name");
  if (!lead.country)                     missing.push("Country");
  if (!lead.state)                       missing.push("State");
  if (!lead.city)                        missing.push("City");
  if (!lead.primary_contact_name?.trim()) missing.push("Primary Contact Name");
  if (!lead.primary_phone && !lead.primary_email) missing.push("Primary Phone or Email");
  if (!rfq.product_category)             missing.push("Product Category");
  if (!rfq.product_name?.trim())         missing.push("Product Name");
  if (rfq.sample_required && !isSqApproved(rfq, true))
    missing.push("Sample must be Approved");
  if (rfq.quotation_required && !isSqApproved(rfq, false))
    missing.push("Quotation must be Approved");
  return missing;
}


// Shared helpers for sample / quotation "outcome" logic.
//
// A sample or quotation is considered CLOSED once its `result` field is
// either "Approved" or "Rejected" — at that point it no longer needs a
// follow-up date and drops out of the Tasks (all) view.
//
// An rfq is ORDER READY once every part it actually requires (sample and/or
// quotation) has result === "Approved". Order-ready rfqs disappear from
// Tasks entirely and surface only under the Orders tab.

export function sqRecord(rfq, isSample) {
  return isSample ? (rfq.samples || [])[0] : (rfq.quotations || [])[0];
}

export function sqResult(rfq, isSample) {
  return sqRecord(rfq, isSample)?.result || null;
}

export function isSqApproved(rfq, isSample) {
  return sqResult(rfq, isSample) === "Approved";
}

export function isSqRejected(rfq, isSample) {
  return sqResult(rfq, isSample) === "Rejected";
}

// Closed = no longer needs tracking / a follow-up date.
export function isSqClosed(rfq, isSample) {
  return isSqApproved(rfq, isSample) || isSqRejected(rfq, isSample);
}

// Order-ready = every required part (sample and/or quotation) is Approved.
export function isOrderReady(rfq) {
  if (!rfq.sample_required && !rfq.quotation_required) return false;
  const sampleOk = !rfq.sample_required    || isSqApproved(rfq, true);
  const quoteOk  = !rfq.quotation_required || isSqApproved(rfq, false);
  return sampleOk && quoteOk;
}