export const INDUSTRIES = [
  "Pharmaceuticals","Casting","Forge","Job Work","Textiles","Chemicals","Food & Beverage","Automotive",
  "Electronics","Plastics & Rubber","Paper & Packaging","Construction",
  "Agriculture","Metal & Mining","Oil & Gas","Paints & Coatings",
  "Adhesives & Sealants","Water Treatment","Cosmetics & Personal Care","Other",
];
export const SOURCES = [
  "Cold Call","Cold Mail","LinkedIn","Referral","Trade Show / Exhibition",
  "Website Inquiry","India Mart","Email Campaign","Walk-in","Google Search",
  "Industry Directory","Existing Customer","Partner / Agent","Other",
];
export const PROSPECT_ACTIONS  = ["Call","Email","WhatsApp","Visit","No Action"];
export const PROSPECT_STATUSES = ["Hot","Warm","Cold","Won","Lost","Dead"];
export const BIZ_TYPES   = ["Trader","Wholesaler","Retailer","Exporter","Manufacturer"];
export const DESIGNATIONS = [
  "Owner","Purchase Manager","Director","Production Head","Factory Manager",
  "Plant Head","Operations Manager","Procurement Manager","Technical Manager","Other",
];
export const CONTACT_TYPES = ["Call","Email","WhatsApp","Visit","Meeting"];
export const ENQ_STATUSES  = ["Open","In Progress","Quoted","Sample Sent","Won","Lost","On Hold"];
export const NEXT_ACTION_OPTIONS = [
  "Quotation to be Submitted","Sample to be Submitted","Sample to be Tried","Follow-up",
  "Price Negotiation","Send Product Details","Collect Sample Feedback","Collect Quotation Feedback",
  "Order Confirmation","Purchase Order Follow-up","Payment Follow-up","Dispatch Material",
  "Close Enquiry","No Further Action","Other",
];
export const SAMPLE_STATUS_OPTIONS    = ["Sample to be Submitted","Sample Submitted","Sample Under Trial","Approved","Rejected"];
export const QUOTATION_STATUS_OPTIONS = ["Quotation Submitted","Quotation to be Negotiated","Approved","Rejected"];

export const SAMPLE_STAGE_OPTIONS = [
  "Provided by buyer",
  "Submitted to office",
  "Submitted to supplier",
  "Sample under development",
  "Received from supplier",
  "Sample submitted to client",
];
export const SAMPLE_RESULT_OPTIONS = [
  "Trial conducted",
  "Under trial",
  "Approved",
  "Approved with minor changes",
  "Rework required",
  "Rejected",
];
export const QUOTATION_STAGE_OPTIONS = [
  "Quotation Submitted",
  "Quotation to be Negotiated",
  "Approved",
  "Rejected",
];
export const QUOTATION_RESULT_OPTIONS = [
  "Under review",
  "Price accepted",
  "Price neg. ongoing",
  "Approved",
  "Rejected",
];
export const PRIORITY_OPTIONS = ["High", "Medium", "Low"];
export const UNITS = ["kg","g","mg","Ltr","mL","MT","Ton","Pcs","Box","Drum","Bag","Other"];

export const PRIORITY_CLS = {
  High:   "bg-rose-50 text-rose-700 ring-rose-200",
  Medium: "bg-amber-50 text-amber-700 ring-amber-200",
  Low:    "bg-slate-100 text-slate-500 ring-slate-200",
};

export const PROSPECT_STATUS_CLS = {
  Interested:          "bg-emerald-50 text-emerald-700 ring-emerald-200",
  "Not Relavent":      "bg-slate-100  text-slate-500  ring-slate-200",
  Duplicate:           "bg-amber-50   text-amber-700  ring-amber-200",
  Dormat:              "bg-orange-50  text-orange-700 ring-orange-200",
  "Converted to Lead": "bg-indigo-50  text-indigo-700 ring-indigo-200",
};
export const ENQ_STATUS_CLS = {
  Open:          "bg-amber-50   text-amber-700  ring-amber-200",
  "In Progress": "bg-sky-50     text-sky-700    ring-sky-200",
  Quoted:        "bg-violet-50  text-violet-700 ring-violet-200",
  "Sample Sent": "bg-pink-50    text-pink-700   ring-pink-200",
  Won:           "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Lost:          "bg-rose-50    text-rose-700   ring-rose-200",
  "On Hold":     "bg-slate-100  text-slate-600  ring-slate-200",
};
export const SAMPLE_CLS = {
  "Sample to be Submitted": "bg-amber-50 text-amber-700",
  "Sample Submitted":       "bg-sky-50   text-sky-700",
  "Sample Under Trial":     "bg-violet-50 text-violet-700",
  "Approved":               "bg-emerald-50 text-emerald-700",
  "Rejected":               "bg-rose-50  text-rose-700",
};

export const CLOSED_STATUSES = new Set(["Won","Lost"]);
export const CLOSED_ACTIONS  = new Set(["Close Enquiry","No Further Action"]);

// Filter pill constants
export const TYPE_OPTS = [{v:"all",l:"Tasks"},{v:"prospect",l:"Prospects"},{v:"lead",l:"Leads"}];
export const DATE_OPTS = [{v:"all",l:"All"},{v:"overdue",l:"Overdue"},{v:"today",l:"Today"},{v:"tomorrow",l:"Tomorrow"},{v:"future",l:"Future"}];
export const SQ_OPTS   = [
  {v:"sample",l:"Sample"},
  {v:"quote",l:"Quotation"},
  {v:"customer",l:"Customer"},
];
