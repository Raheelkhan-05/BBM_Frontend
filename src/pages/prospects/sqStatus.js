//sqStatus.js

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