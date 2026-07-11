// sqStatus.js
import { SAMPLE_STAGES, QUOTATION_STAGES, REJECTED_STAGE } from "./constants";

export function sqRecord(rfq, isSample) {
  return isSample ? (rfq.samples || [])[0] : (rfq.quotations || [])[0];
}

export function sqStage(rfq, isSample) {
  const rec = sqRecord(rfq, isSample);
  return (isSample ? rec?.sample_status : rec?.quotation_status) || null;
}

export function stageList(isSample) {
  return isSample ? SAMPLE_STAGES : QUOTATION_STAGES;
}

export function stageIndex(stage, isSample) {
  return stageList(isSample).indexOf(stage);
}

export function isSqApproved(rfq, isSample) {
  return sqStage(rfq, isSample) === "Approved";
}
export function isSqRejected(rfq, isSample) {
  return sqStage(rfq, isSample) === REJECTED_STAGE;
}
export function isSqClosed(rfq, isSample) {
  return isSqApproved(rfq, isSample) || isSqRejected(rfq, isSample);
}
export function isOrderReady(rfq) {
  if (!rfq.sample_required && !rfq.quotation_required) return false;
  const sampleOk = !rfq.sample_required    || isSqApproved(rfq, true);
  const quoteOk  = !rfq.quotation_required || isSqApproved(rfq, false);
  return sampleOk && quoteOk;
}