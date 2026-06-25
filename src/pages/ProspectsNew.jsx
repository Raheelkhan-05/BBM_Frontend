// ProspectsNew.jsx  v9
// Changes from v8:
//  1. DetailPanel (Prospect): Edit icon moved to header beside close button.
//     Bottom bar loses "Edit Prospect" — replaced with "Update Status" button.
//  2. New UpdateStatusModal: shows current action info, lets user add remark
//     to it, and optionally create a next action. Saves via PUT /api/prospects/:id.
//  3. New ProspectActivityLog: compact timeline of prospect history fetched from
//     /api/prospects/:id/history?include=logs — shows who did what and when.

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence }  from "framer-motion";
import { Link }                     from "react-router-dom";
import { useAuth }                  from "../context/AuthContext";
import { useRoutes }                from "../hooks/useRoutes";
import { useProducts }              from "../hooks/useProducts";
import LocationPicker               from "./components/LocationPicker";
import ProductPicker                from "./components/ProductPicker";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

/* ─── Static options ─────────────────────────────────────────── */
const INDUSTRIES = [
  "Pharmaceuticals","Textiles","Chemicals","Food & Beverage","Automotive",
  "Electronics","Plastics & Rubber","Paper & Packaging","Construction",
  "Agriculture","Metal & Mining","Oil & Gas","Paints & Coatings",
  "Adhesives & Sealants","Water Treatment","Cosmetics & Personal Care","Other",
];
const SOURCES = [
  "Cold Call","Cold Mail","LinkedIn","Referral","Trade Show / Exhibition",
  "Website Inquiry","Email Campaign","Walk-in","Google Search",
  "Industry Directory","Existing Customer","Partner / Agent","Other",
];
const PROSPECT_ACTIONS  = ["Call","Email","WhatsApp","Visit","No Action"];
const PROSPECT_STATUSES = ["Interested","Not Relavent","Duplicate","Dormat","Converted to Lead"];
const BIZ_TYPES   = ["Trader","Wholesaler","Retailer","Exporter","Manufacturer"];
const DESIGNATIONS = [
  "Owner","Purchase Manager","Director","Production Head","Factory Manager",
  "Plant Head","Operations Manager","Procurement Manager","Technical Manager","Other",
];
const CONTACT_TYPES = ["Call","Email","WhatsApp","Visit","Meeting"];
const ENQ_STATUSES  = ["Open","In Progress","Quoted","Sample Sent","Won","Lost","On Hold"];
const NEXT_ACTION_OPTIONS = [
  "Quotation to be Submitted","Sample to be Submitted","Sample to be Tried","Follow-up",
  "Price Negotiation","Send Product Details","Collect Sample Feedback","Collect Quotation Feedback",
  "Order Confirmation","Purchase Order Follow-up","Payment Follow-up","Dispatch Material",
  "Close Enquiry","No Further Action","Other",
];
const SAMPLE_STATUS_OPTIONS    = ["Sample to be Submitted","Sample Submitted","Sample Under Trial","Approved","Rejected"];
const QUOTATION_STATUS_OPTIONS = ["Quotation Submitted","Quotation to be Negotiated","Approved","Rejected"];
const UNITS = ["kg","g","mg","L","mL","MT","Ton","Pcs","Box","Drum","Bag","Other"];

const CLOSED_STATUSES = new Set(["Won","Lost"]);
const CLOSED_ACTIONS  = new Set(["Close Enquiry","No Further Action"]);
function isEnquiryClosed(rfq){
  const fups=(rfq.rfq_followups||[]).filter(f=>!f.deleted_at);
  if(!fups.length) return false;
  const latest=[...fups].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))[0];
  return CLOSED_STATUSES.has(latest.enquiry_status)||CLOSED_ACTIONS.has(latest.next_action);
}

/* ═══════════════════════════════════════════════════════════════
   ICONS
═══════════════════════════════════════════════════════════════ */
const Ic = {
  Search:   p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>,
  X:        p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>,
  ChevR:    p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><polyline points="9,18 15,12 9,6"/></svg>,
  ChevD:    p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><polyline points="6,9 12,15 18,9"/></svg>,
  ChevU:    p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><polyline points="18,15 12,9 6,15"/></svg>,
  Plus:     p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>,
  Edit:     p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.12 2.12 0 113 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  Trash:    p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0l-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6h16z"/></svg>,
  Cal:      p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  Clock:    p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>,
  Pin:      p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  Building: p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>,
  User:     p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  Phone:    p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>,
  Mail:     p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
  Package:  p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27,6.96 12,12.01 20.73,6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  FileT:    p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  Zap:      p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><polygon points="13,2 3,14 12,14 11,22 21,10 12,10 13,2"/></svg>,
  ArrR:     p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>,
  Home:     p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>,
  Layers:   p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><polygon points="12,2 2,7 12,12 22,7 12,2"/><polyline points="2,17 12,22 22,17"/><polyline points="2,12 12,17 22,12"/></svg>,
  Bell:     p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg>,
  Box:      p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>,
  Globe:    p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>,
  Receipt:  p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1z"/><path d="M9 7h6M9 11h6M9 15h4"/></svg>,
  LinkedIn: p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>,
  Factory:  p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M2 20h20M4 20V10l5 4v-4l5 4v-4l5 4v6"/></svg>,
  MsgSq:    p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  Alert:    p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  Radar:    p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>,
  Check:    p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><polyline points="20,6 9,17 4,12"/></svg>,
  Clipboard:p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>,
  History:  p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><polyline points="1,4 1,10 7,10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>,
  Sparkle:  p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>,
  Lock:     p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>,
  Activity: p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/></svg>,
  Refresh:  p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><polyline points="23,4 23,10 17,10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>,
  Spin:     p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>,
  Visit:    p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>,
  Meet:     p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="9" cy="7" r="3"/><circle cx="17" cy="7" r="3"/><path d="M2 21v-2a5 5 0 015-5h0M14 21v-2a5 5 0 015-5h0"/></svg>,
};

function contactCls(type){
  switch((type||"").toLowerCase()){
    case "call":     return "bg-blue-50 text-blue-700 ring-blue-200";
    case "email":    return "bg-violet-50 text-violet-700 ring-violet-200";
    case "whatsapp": return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    case "visit":    return "bg-amber-50 text-amber-700 ring-amber-200";
    case "meeting":  return "bg-indigo-50 text-indigo-700 ring-indigo-200";
    default:         return "bg-slate-100 text-slate-600 ring-slate-200";
  }
}



function ContactIcon({type,className="h-3 w-3"}){
  switch((type||"").toLowerCase()){
    case "call":     return <Ic.Phone   className={className}/>;
    case "email":    return <Ic.Mail    className={className}/>;
    case "whatsapp": return <Ic.MsgSq   className={className}/>;
    case "visit":    return <Ic.Visit   className={className}/>;   // ← Ic.Visit doesn't exist!
    case "meeting":  return <Ic.Meet    className={className}/>;   // ← Ic.Meet doesn't exist!
    default:         return <Ic.Phone   className={className}/>;
  }
}

function suggestNextAction(sampleRequired, quotationRequired, sampleStatus, quotationStatus) {
  if (sampleRequired && sampleStatus) {
    if (sampleStatus === "Sample to be Submitted") return "Sample to be Submitted";
    if (sampleStatus === "Sample Submitted")       return "Sample to be Tried";
    if (sampleStatus === "Sample Under Trial")     return "Collect Sample Feedback";
    if (sampleStatus === "Approved")               return quotationRequired ? "Quotation to be Submitted" : "Order Confirmation";
    if (sampleStatus === "Rejected")               return "Follow-up";
  }
  if (quotationRequired && quotationStatus) {
    if (quotationStatus === "Quotation Submitted")           return "Collect Quotation Feedback";
    if (quotationStatus === "Quotation to be Negotiated")    return "Price Negotiation";
    if (quotationStatus === "Approved")                      return "Order Confirmation";
    if (quotationStatus === "Rejected")                      return "Follow-up";
  }
  if (sampleRequired && !sampleStatus)    return "Sample to be Submitted";
  if (quotationRequired && !quotationStatus) return "Quotation to be Submitted";
  return "Follow-up";
}

/* ─── Colour maps ────────────────────────────────────────────── */
const PROSPECT_STATUS_CLS = {
  Interested:          "bg-emerald-50 text-emerald-700 ring-emerald-200",
  "Not Relavent":      "bg-slate-100  text-slate-500  ring-slate-200",
  Duplicate:           "bg-amber-50   text-amber-700  ring-amber-200",
  Dormat:              "bg-orange-50  text-orange-700 ring-orange-200",
  "Converted to Lead": "bg-indigo-50  text-indigo-700 ring-indigo-200",
};
const ENQ_STATUS_CLS = {
  Open:          "bg-amber-50   text-amber-700  ring-amber-200",
  "In Progress": "bg-sky-50     text-sky-700    ring-sky-200",
  Quoted:        "bg-violet-50  text-violet-700 ring-violet-200",
  "Sample Sent": "bg-pink-50    text-pink-700   ring-pink-200",
  Won:           "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Lost:          "bg-rose-50    text-rose-700   ring-rose-200",
  "On Hold":     "bg-slate-100  text-slate-600  ring-slate-200",
};
const SAMPLE_CLS = {
  "Sample to be Submitted": "bg-amber-50 text-amber-700",
  "Sample Submitted":       "bg-sky-50   text-sky-700",
  "Sample Under Trial":     "bg-violet-50 text-violet-700",
  "Approved":               "bg-emerald-50 text-emerald-700",
  "Rejected":               "bg-rose-50  text-rose-700",
};


/* ═══════════════════════════════════════════════════════════════
   UI PRIMITIVES
═══════════════════════════════════════════════════════════════ */
function cls(...a){ return a.filter(Boolean).join(" "); }
function inp(extra=""){
  return cls("w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 hover:border-slate-300",extra);
}
function Lbl({children,required}){
  return <label className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{children}{required&&<span className="text-rose-500">*</span>}</label>;
}
function FErr({name,errors}){
  if(!errors?.[name]) return null;
  return <p className="mt-1 text-[11px] text-rose-500">{errors[name]}</p>;
}
function FldInput({label,name,value,onChange,type="text",placeholder,required,icon:Icon_,errors,disabled=false,onBlur,min}){
  return(
    <div className="flex flex-col">
      {label&&<Lbl required={required}>{label}{disabled&&<Ic.Lock className="ml-1 h-2.5 w-2.5 text-slate-300 inline"/>}</Lbl>}
      <div className="relative">
        {Icon_&&<span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"><Icon_ className={cls("h-4 w-4",disabled?"text-slate-300":"text-slate-400")}/></span>}
        <input name={name} type={type} value={value} onChange={onChange} onBlur={onBlur} placeholder={placeholder} disabled={disabled} min={min}
          className={inp(cls(Icon_?"pl-9":"",errors?.[name]?"!border-rose-400 !ring-rose-100":"",disabled?"bg-slate-50 cursor-not-allowed opacity-70 select-none":""))}/>
      </div>
      <FErr name={name} errors={errors}/>
    </div>
  );
}
function SelInput({label,name,value,onChange,options,required,placeholder,errors}){
  return(
    <div className="flex flex-col">
      {label&&<Lbl required={required}>{label}</Lbl>}
      <div className="relative">
        <select name={name} value={value} onChange={onChange} className={inp(cls("appearance-none pr-9",errors?.[name]?"!border-rose-400 !ring-rose-100":""))}>
          <option value="">{placeholder||`Select ${label}`}</option>
          {options.map(o=>typeof o==="string"?<option key={o} value={o}>{o}</option>:<option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <Ic.ChevD className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/>
      </div>
      <FErr name={name} errors={errors}/>
    </div>
  );
}
function TArea({label,name,value,onChange,placeholder,rows=3,errors}){
  return(
    <div className="flex flex-col">
      {label&&<Lbl>{label}</Lbl>}
      <textarea name={name} value={value} onChange={onChange} placeholder={placeholder} rows={rows}
        className={inp(cls("resize-none",errors?.[name]?"!border-rose-400 !ring-rose-100":""))}/>
      <FErr name={name} errors={errors}/>
    </div>
  );
}
function SecDiv({title,icon:I,accent="indigo"}){
  const c={indigo:"text-indigo-600 bg-indigo-50 border-indigo-100",teal:"text-teal-600 bg-teal-50 border-teal-100",
    violet:"text-violet-600 bg-violet-50 border-violet-100",amber:"text-amber-600 bg-amber-50 border-amber-100",
    rose:"text-rose-600 bg-rose-50 border-rose-100",slate:"text-slate-600 bg-slate-50 border-slate-200",
    blue:"text-blue-600 bg-blue-50 border-blue-100",sky:"text-sky-600 bg-sky-50 border-sky-100"};
  return(
    <div className={cls("mb-4 mt-2 flex items-center gap-2.5 rounded-lg border px-3 py-2",c[accent])}>
      {I&&<I className="h-3.5 w-3.5 shrink-0"/>}
      <span className="text-[11px] font-bold uppercase tracking-widest">{title}</span>
    </div>
  );
}
function Tag({children,className=""}){
  return <span className={cls("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset",className||"bg-slate-100 text-slate-600 ring-slate-500/15")}>{children}</span>;
}
function PBtn({children,className="",...props}){
  return <button {...props} className={cls("inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60",className)}>{children}</button>;
}
function GBtn({children,className="",...props}){
  return <button {...props} className={cls("inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition-all hover:bg-slate-50 active:scale-[0.98]",className)}>{children}</button>;
}
function DRow({label,value,mono=false}){
  if(!value) return null;
  return(
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2 last:border-0">
      <span className="text-xs font-medium text-slate-400 whitespace-nowrap shrink-0">{label}</span>
      <span className={cls("text-right text-sm text-slate-700 break-all",mono?"font-mono":"")}>{value}</span>
    </div>
  );
}
function Backdrop({onClick,children}){
  return(
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:0.15}}
      onClick={onClick}
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 backdrop-blur-sm sm:items-center sm:p-4">
      {children}
    </motion.div>
  );
}
function Sheet({children,wide=false}){
  return(
    <motion.div initial={{opacity:0,scale:0.97,y:24}} animate={{opacity:1,scale:1,y:0}}
      exit={{opacity:0,scale:0.97,y:16}} transition={{duration:0.2,ease:[0.16,1,0.3,1]}}
      onClick={e=>e.stopPropagation()}
      className={cls("max-h-[94vh] w-full overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/8",wide?"max-w-3xl":"max-w-xl")}>
      {children}
    </motion.div>
  );
}

/* ─── SheetHead: now accepts extraActions slot ──────────────── */
function SheetHead({title,subtitle,onClose,accent="",extraActions}){
  return(
    <div className={cls("sticky top-0 z-10 flex items-start justify-between gap-4 rounded-t-2xl px-5 py-4 border-b border-slate-100",accent||"bg-white")}>
      <div className="min-w-0 flex-1">
        <h3 className="text-base font-bold tracking-tight text-slate-900 truncate">{title}</h3>
        {subtitle&&<p className="mt-0.5 text-xs text-slate-500 truncate">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {extraActions}
        <button onClick={onClose} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"><Ic.X className="h-4 w-4"/></button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DATE / TIME HELPERS
═══════════════════════════════════════════════════════════════ */
function todayMidnight(){ const d=new Date(); d.setHours(0,0,0,0); return d; }
function parseDate(d){ if(!d) return null; return new Date(d.split("T")[0]); }
function isOverdue(d){ const p=parseDate(d); return p&&p<todayMidnight(); }
function isToday(d){ const p=parseDate(d); return p&&p.toDateString()===todayMidnight().toDateString(); }
function isTomorrow(d){
  if(!d) return false;
  const t=new Date(todayMidnight()); t.setDate(t.getDate()+1);
  return parseDate(d)?.toDateString()===t.toDateString();
}
function isFuture(d){ return d&&!isOverdue(d)&&!isToday(d)&&!isTomorrow(d); }
function fmtD(d){ if(!d) return null; return new Date(d).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"}); }
function fmtDT(d){
  if(!d) return null;
  const iso=String(d).replace(" ","T").replace(/(\+00(:00)?)?$/,"Z");
  return new Date(iso).toLocaleString("en-IN",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:true,timeZone:"Asia/Kolkata"});
}
function relTime(d){
  if(!d) return "";
  const diff=Date.now()-new Date(d).getTime();
  const m=Math.floor(diff/60000);
  if(m<1) return "just now";
  if(m<60) return `${m}m ago`;
  const h=Math.floor(m/60);
  if(h<24) return `${h}h ago`;
  const days=Math.floor(h/24);
  if(days<30) return `${days}d ago`;
  return fmtD(d);
}
function todayStr(){ return new Date().toISOString().slice(0,10); }
function dueCls(d){ return isOverdue(d)?"text-rose-500 font-semibold":isToday(d)?"text-amber-500 font-semibold":isTomorrow(d)?"text-sky-600 font-medium":"text-slate-500"; }
function dueLabel(d){ return isOverdue(d)?"Overdue":isToday(d)?"Today":isTomorrow(d)?"Tomorrow":fmtD(d)||"—"; }

function encodeTimeInNotes(time, notes){
  const base=(notes||"").replace(/^\[Time: \d{2}:\d{2}\]\s*/,"").trim();
  if(!time) return base||null;
  return `[Time: ${time}]${base?" "+base:""}`;
}
function extractTimeFromNotes(notes){
  const m=(notes||"").match(/^\[Time: (\d{2}:\d{2})\]/);
  return m?m[1]:null;
}
function cleanNotes(notes){
  return (notes||"").replace(/^\[Time: \d{2}:\d{2}\]\s*/,"").trim()||null;
}
function encodeTimeInFeedback(time, feedback){
  const base=(feedback||"").replace(/\n\[Time: \d{2}:\d{2}\]$/,"").trim();
  if(!time) return base||null;
  return base?`${base}\n[Time: ${time}]`:`[Time: ${time}]`;
}
function extractTimeFromFeedback(feedback){
  const m=(feedback||"").match(/\n?\[Time: (\d{2}:\d{2})\]$/);
  return m?m[1]:null;
}
function cleanFeedback(feedback){
  return (feedback||"").replace(/\n?\[Time: \d{2}:\d{2}\]$/,"").trim()||null;
}

function rfqNearestActiveDate(rfqs){
  const dates=[];
  (rfqs||[]).forEach(r=>{
    if(isEnquiryClosed(r)) return;
    (r.rfq_followups||[]).filter(f=>!f.deleted_at).forEach(f=>{if(f.followup_date) dates.push(f.followup_date);});
    (r.samples||[]).forEach(s=>{if(s.follow_up_date) dates.push(s.follow_up_date);});
    (r.quotations||[]).forEach(q=>{if(q.follow_up_date) dates.push(q.follow_up_date);});
  });
  return dates.sort()[0]||null;
}
function itemNearestDate(item,rfqs){
  const dates=[];
  if(item.next_action_date) dates.push(item.next_action_date.split("T")[0]);
  const d=rfqNearestActiveDate(rfqs);
  if(d) dates.push(d);
  return dates.sort()[0]||null;
}

// Returns the most relevant "contact type" label for a list row.
// Prospects: their own next_action (Call/Email/WhatsApp/Visit/No Action)
// Leads: contact_type from the nearest *active* RFQ follow-up, if any
function itemContactType(item, rfqs) {
  if (item._type === "prospect") {
    return item.next_action || null;
  }
  // lead — look through open RFQs for the nearest upcoming follow-up's contact_type
  let best = null, bestDate = null;
  (rfqs || []).forEach(r => {
    if (isEnquiryClosed(r)) return;
    const fup = latestFU(r);
    if (fup?.contact_type && fup?.followup_date) {
      if (!bestDate || fup.followup_date < bestDate) {
        bestDate = fup.followup_date;
        best = fup.contact_type;
      }
    }
  });
  return best;
}

function sortFupsByCreated(fups){ return [...fups].filter(f=>!f.deleted_at).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)); }
function latestFU(rfq){ return sortFupsByCreated(rfq.rfq_followups||[])[0]||null; }
function latestStatus(rfq){ return latestFU(rfq)?.enquiry_status||"Open"; }

function missingForEnquiry(lead){
  const m=[];
  if(!lead.nature_of_business)   m.push("Nature of Business");
  if(!lead.state)                m.push("State");
  if(!lead.city)                 m.push("City");
  if(!lead.zone)                 m.push("Zone");
  if(!lead.route)                m.push("Route");
  if(!lead.primary_contact_name) m.push("Primary Contact Name");
  if(!lead.primary_designation)  m.push("Primary Designation");
  if(!lead.primary_phone&&!lead.primary_email) m.push("Primary Phone or Email");
  return m;
}

function missingLeadFormFields(form){
  const m=[];
  if(!form.nature_of_business)   m.push("Nature of Business");
  if(!form.state)                m.push("State");
  if(!form.city)                 m.push("City");
  if(!form.zone)                 m.push("Zone");
  if(!form.route)                m.push("Route");
  if(!form.primary_contact_name) m.push("Primary Contact Name");
  if(!form.primary_designation)  m.push("Primary Designation");
  if(!form.primary_phone&&!form.primary_email) m.push("Primary Phone or Email");
  return m;
}

/* ═══════════════════════════════════════════════════════════════
   PROSPECT FORM
═══════════════════════════════════════════════════════════════ */
const emptyProspect={
  company_name:"",industry:"",country:"India",state:"",city:"",zone:"",route:"",
  source:"",next_action:"",next_action_date:"",next_action_time:"",feedback:"",prospect_status:"",
  contact_name:"",contact_designation:"",contact_email:"",contact_phone:"",
};

function valProspect(f){
  const e={};
  if(!f.company_name.trim()) e.company_name="Required";
  if(!f.industry)            e.industry="Required";
  if(!f.country.trim())      e.country="Required";
  if(!f.state.trim())        e.state="Required";
  if(!f.city.trim())         e.city="Required";
  if(!f.source)              e.source="Required";
  if(!f.next_action)         e.next_action="Required";
  if(!f.next_action_date)    e.next_action_date="Required";
  if(!f.prospect_status)     e.prospect_status="Required";
  return e;
}

function ProspectForm({initial,token,routesHook,onClose,onSaved}){
  const isEdit=!!initial?.id;
  const[form,setForm]=useState(()=>{
    if(!initial) return{...emptyProspect};
    return{
      ...emptyProspect,...initial,
      contact_name:        initial.contact_name||"",
      contact_designation: initial.contact_designation||"",
      contact_email:       initial.contact_email||"",
      contact_phone:       initial.contact_phone||"",
      next_action_date: initial.next_action_date?.split("T")[0]||"",
      next_action_time: extractTimeFromFeedback(initial.feedback)||"",
      feedback: cleanFeedback(initial.feedback)||"",
    };
  });
  const[errors,setErrors]=useState({});
  const[saving,setSaving]=useState(false);

  function hc(e){const{name,value}=e.target;setErrors(p=>({...p,[name]:undefined}));setForm(p=>({...p,[name]:value}));}
  function hLoc(f,v){setForm(p=>({...p,[f]:v}));}

  async function submit(e){
    e.preventDefault();
    const errs=valProspect(form);
    if(Object.keys(errs).length){setErrors(errs);return;}
    setSaving(true);
    try{
      const body={
        ...form,
        feedback: encodeTimeInFeedback(form.next_action_time, form.feedback),
      };
      delete body.next_action_time;
      const url=isEdit?`${API}/api/prospects/${initial.id}`:`${API}/api/prospects`;
      const res=await fetch(url,{method:isEdit?"PUT":"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify(body)});
      const data=await res.json();
      if(!res.ok) throw new Error(data.message||"Failed");
      onSaved(data.prospect,isEdit);
      onClose();
    }catch(err){setErrors({_g:err.message});}
    finally{setSaving(false);}
  }

  return(
    <Backdrop onClick={onClose}>
      <Sheet wide>
        <SheetHead title={isEdit?"Edit Prospect":"Add New Prospect"} subtitle={isEdit?initial.company_name:"Capture early-stage interest"} onClose={onClose} accent="bg-gradient-to-r from-white to-teal-50/30"/>
        <form onSubmit={submit} className="px-5 pb-6 pt-4">
          <SecDiv title="Company Information" icon={Ic.Building} accent="teal"/>
          <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><FldInput label="Company Name" name="company_name" value={form.company_name} onChange={hc} required icon={Ic.Building} errors={errors}/></div>
            <SelInput label="Industry" name="industry" value={form.industry} onChange={hc} options={INDUSTRIES} required errors={errors}/>
            <SelInput label="Source" name="source" value={form.source} onChange={hc} options={SOURCES} required errors={errors}/>
          </div>

          <SecDiv title="Contact Details" icon={Ic.Phone} accent="sky"/>
          <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FldInput label="Contact Name" name="contact_name" value={form.contact_name} onChange={hc} icon={Ic.User} placeholder="Rajesh Mehta" errors={errors}/>
            <SelInput label="Designation" name="contact_designation" value={form.contact_designation} onChange={hc} options={DESIGNATIONS} errors={errors} placeholder="Select designation"/>
            <FldInput label="Phone" name="contact_phone" value={form.contact_phone} onChange={hc} icon={Ic.Phone} placeholder="+91 98765 43210" errors={errors}/>
            <FldInput label="Email" name="contact_email" type="email" value={form.contact_email} onChange={hc} icon={Ic.Mail} placeholder="rajesh@company.com" errors={errors}/>
          </div>

          <SecDiv title="Location" icon={Ic.Pin} accent="slate"/>
          <div className="mb-5"><LocationPicker country={form.country} state={form.state} city={form.city} zone={form.zone} route={form.route} onChange={hLoc} useRoutesHook={routesHook} errors={errors}/></div>

          <SecDiv title="Follow-up Plan" icon={Ic.Zap} accent="amber"/>
          <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelInput label="Next Action" name="next_action" value={form.next_action} onChange={hc} options={PROSPECT_ACTIONS} required errors={errors}/>
            <div>
              <Lbl required>Next Action Date</Lbl>
              <input type="date" name="next_action_date" value={form.next_action_date} onChange={hc} className={inp(errors.next_action_date?"!border-rose-400":"")}/>
              <FErr name="next_action_date" errors={errors}/>
            </div>
            <div>
              <Lbl>Preferred Time <span className="normal-case font-normal text-slate-400">(optional)</span></Lbl>
              <input type="time" name="next_action_time" value={form.next_action_time} onChange={hc} className={inp()}/>
              <p className="mt-1 text-[10px] text-slate-400">Saved with notes · reminder reference only</p>
            </div>
            <div className="sm:col-span-2">
              <TArea label="Feedback / Notes" name="feedback" value={form.feedback} onChange={hc} placeholder="Observations, context…" rows={3}/>
            </div>
          </div>

          <SecDiv title="Status" icon={Ic.Clipboard} accent="blue"/>
          <div className="mb-5"><SelInput label="Prospect Status" name="prospect_status" value={form.prospect_status} onChange={hc} options={PROSPECT_STATUSES} required errors={errors}/></div>

          {errors._g&&<div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errors._g}</div>}
          <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-4">
            <GBtn type="button" onClick={onClose}>Cancel</GBtn>
            <PBtn type="submit" disabled={saving}>{saving?"Saving…":isEdit?"Update Prospect":"Add Prospect"}</PBtn>
          </div>
        </form>
      </Sheet>
    </Backdrop>
  );
}

/* ═══════════════════════════════════════════════════════════════
   UPDATE STATUS MODAL  (prospect-specific)
   Shows current action summary, lets user add remark + create
   a new next action, then saves via PUT /api/prospects/:id
═══════════════════════════════════════════════════════════════ */
function UpdateStatusModal({prospect,token,onClose,onSaved}){
  const currentRemark  = cleanFeedback(prospect.feedback)||"";
  const currentTime    = extractTimeFromFeedback(prospect.feedback)||"";

  const[remark,setRemark]          = useState(currentRemark);
  const[status,setStatus]          = useState(prospect.prospect_status||"");
  const[addNext,setAddNext]        = useState(false);
  const[nextAction,setNextAction]  = useState("");
  const[nextDate,setNextDate]      = useState("");
  const[nextTime,setNextTime]      = useState("");
  const[saving,setSaving]          = useState(false);
  const[err,setErr]                = useState("");

  async function submit(e){
    e.preventDefault();
    if(addNext&&!nextAction)   { setErr("Select a next action type"); return; }
    if(addNext&&!nextDate)     { setErr("Select a next action date");  return; }
    setSaving(true);setErr("");
    try{
      const body={
        ...prospect,
        prospect_status: status,
        feedback: encodeTimeInFeedback(nextTime||currentTime, remark),
        ...(addNext && {
          next_action:      nextAction,
          next_action_date: nextDate,
        }),
      };
      const res=await fetch(`${API}/api/prospects/${prospect.id}`,{
        method:"PUT",
        headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},
        body:JSON.stringify(body),
      });
      const data=await res.json();
      if(!res.ok) throw new Error(data.message||"Failed");
      onSaved(data.prospect,true);
      onClose();
    }catch(e){setErr(e.message);}
    finally{setSaving(false);}
  }

  const prospectTime = extractTimeFromFeedback(prospect.feedback);

  return(
    <Backdrop onClick={onClose}>
      <Sheet>
        <SheetHead title="Update Status" subtitle={prospect.company_name} onClose={onClose} accent="bg-gradient-to-r from-white to-amber-50/30"/>
        <form onSubmit={submit} className="px-5 pb-6 pt-4 space-y-4">

          {/* Current Action Summary */}
          {(prospect.next_action||prospect.next_action_date)&&(
            <div className="rounded-xl border border-amber-100 bg-amber-50/60 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600 mb-2">Current Scheduled Action</p>
              <div className="flex flex-wrap items-center gap-2">
                {prospect.next_action&&(
                  <span className="inline-flex items-center gap-1 rounded-lg bg-amber-100 px-2.5 py-1 text-[12px] font-semibold text-amber-700">
                    <Ic.Zap className="h-3 w-3"/>{prospect.next_action}
                  </span>
                )}
                {prospect.next_action_date&&(
                  <span className={cls("text-[12px] font-semibold",dueCls(prospect.next_action_date))}>
                    {dueLabel(prospect.next_action_date)}
                    {prospectTime&&<span className="font-normal text-slate-400"> · {prospectTime}</span>}
                  </span>
                )}
              </div>
              {prospect.users?.email&&(
                <p className="mt-1.5 text-[10px] text-slate-400">
                  Set by <span className="font-medium text-slate-500">{prospect.users.email}</span>
                </p>
              )}
            </div>
          )}

          {/* Remark for this action */}
          <div>
            <Lbl>What happened? <span className="normal-case font-normal text-slate-400">(remark for this action)</span></Lbl>
            <textarea
              value={remark} onChange={e=>setRemark(e.target.value)}
              placeholder="e.g. Called Rajesh — asked to call back next week. Interested in pricing details."
              rows={3}
              className={inp("resize-none")}
            />
          </div>

          {/* Status update */}
          <div>
            <Lbl>Update Prospect Status</Lbl>
            <div className="relative">
              <select value={status} onChange={e=>setStatus(e.target.value)} className={inp("appearance-none pr-9")}>
                <option value="">Keep current</option>
                {PROSPECT_STATUSES.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
              <Ic.ChevD className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/>
            </div>
          </div>

          {/* Toggle: add next action */}
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <button type="button" onClick={()=>setAddNext(v=>!v)}
              className="flex w-full items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-2">
                <div className={cls("flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors",
                  addNext?"border-indigo-600 bg-indigo-600":"border-slate-300")}>
                  {addNext&&<Ic.Check className="h-3 w-3 text-white"/>}
                </div>
                <span className="text-[13px] font-semibold text-slate-700">Schedule next action</span>
              </div>
              {addNext?<Ic.ChevU className="h-4 w-4 text-slate-400"/>:<Ic.ChevD className="h-4 w-4 text-slate-400"/>}
            </button>

            <AnimatePresence initial={false}>
              {addNext&&(
                <motion.div initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}} transition={{duration:0.18}} className="overflow-hidden">
                  <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <Lbl required>Action Type</Lbl>
                        <div className="relative">
                          <select value={nextAction} onChange={e=>setNextAction(e.target.value)} className={inp("appearance-none pr-9")}>
                            <option value="">Select…</option>
                            {PROSPECT_ACTIONS.map(a=><option key={a} value={a}>{a}</option>)}
                          </select>
                          <Ic.ChevD className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/>
                        </div>
                      </div>
                      <div>
                        <Lbl required>Date</Lbl>
                        <input type="date" value={nextDate} onChange={e=>setNextDate(e.target.value)} min={todayStr()} className={inp()}/>
                      </div>
                    </div>
                    <div>
                      <Lbl>Preferred Time <span className="normal-case font-normal text-slate-400">(optional)</span></Lbl>
                      <input type="time" value={nextTime} onChange={e=>setNextTime(e.target.value)} className={inp()}/>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {err&&<div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{err}</div>}
          <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-4">
            <GBtn type="button" onClick={onClose}>Cancel</GBtn>
            <PBtn type="submit" disabled={saving}>{saving?"Saving…":"Save Update"}</PBtn>
          </div>
        </form>
      </Sheet>
    </Backdrop>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PROSPECT ACTIVITY LOG
   Compact timeline fetched from history endpoint — shows what
   changed, who did it, and when.
═══════════════════════════════════════════════════════════════ */
const LOG_FIELD_LABELS = {
  company_name:"Company",industry:"Industry",country:"Country",
  state:"State",city:"City",zone:"Zone",route:"Route",source:"Source",
  next_action:"Action",next_action_date:"Action Date",
  feedback:"Notes/Remark",prospect_status:"Status",
  contact_name:"Contact",contact_designation:"Designation",
  contact_phone:"Phone",contact_email:"Email",
};

function diffSnapshots(prev,curr){
  const changes=[];
  for(const [field,label] of Object.entries(LOG_FIELD_LABELS)){
    const a=prev?(prev[field]??null):null;
    const b=curr[field]??null;
    const norm=(v)=>(v===null||v===undefined||v===""?null:String(v));
    if(norm(a)!==norm(b)) changes.push({field,label,from:a,to:b});
  }
  return changes;
}

const ACTION_DOT={
  created:"bg-emerald-500",
  updated:"bg-amber-400",
  deleted:"bg-rose-500",
};
const ACTION_BADGE={
  created:"bg-emerald-50 text-emerald-700 ring-emerald-200",
  updated:"bg-amber-50 text-amber-700 ring-amber-200",
  deleted:"bg-rose-50 text-rose-700 ring-rose-200",
};

function ProspectActivityLog({prospectId,token}){
  const[logs,setLogs]       = useState(null);
  const[loading,setLoading] = useState(false);
  const[err,setErr]         = useState("");
  const[open,setOpen]       = useState(false);
  const fetched             = useRef(false);

  async function fetchLogs(){
    if(fetched.current) return;
    fetched.current=true;
    setLoading(true);setErr("");
    try{
      const res=await fetch(`${API}/api/prospects/${prospectId}/history?include=logs`,{headers:{Authorization:`Bearer ${token}`}});
      const data=await res.json();
      if(!res.ok) throw new Error(data.message||"Failed");
      // Build timeline from prospect logs only (no leads/rfqs — those are separate)
      const raw=[...(data.data?.prospectLogs||[])].reverse();
      const events=raw.map((log,i)=>({
        id:log.id,
        action:log.action||"updated",
        ts:log.changed_at,
        by:log.users?.email||"Unknown",
        diffs:diffSnapshots(i>0?raw[i-1]:null,log),
      })).reverse(); // show newest first
      setLogs(events);
    }catch(e){setErr(e.message);}
    finally{setLoading(false);}
  }

  function toggle(){
    if(!open&&!fetched.current) fetchLogs();
    setOpen(v=>!v);
  }

  return(
    <div className="mt-3 rounded-xl border border-slate-200 overflow-hidden">
      <button type="button" onClick={toggle}
        className="flex w-full items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition-colors">
        <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-slate-500">
          <Ic.Activity className="h-3.5 w-3.5"/>
          Activity Log
        </span>
        <div className="flex items-center gap-2">
          {logs!==null&&<span className="text-[10px] font-semibold text-slate-400">{logs.length} events</span>}
          {open?<Ic.ChevU className="h-3.5 w-3.5 text-slate-400"/>:<Ic.ChevD className="h-3.5 w-3.5 text-slate-400"/>}
        </div>
      </button>

      <AnimatePresence>
        {open&&(
          <motion.div initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}} transition={{duration:0.2}} className="overflow-hidden">
            <div className="border-t border-slate-100">
              {loading&&(
                <div className="flex items-center gap-2 px-4 py-4 text-[12px] text-slate-400">
                  <Ic.Spin className="h-3.5 w-3.5 animate-spin"/>Loading…
                </div>
              )}
              {err&&<p className="px-4 py-3 text-[12px] text-rose-500">{err}</p>}
              {logs!==null&&logs.length===0&&(
                <p className="px-4 py-4 text-[12px] text-slate-400">No history recorded yet.</p>
              )}
              {logs!==null&&logs.length>0&&(
                <div className="divide-y divide-slate-50">
                  {logs.map((ev,idx)=>(
                    <LogEventRow key={ev.id||idx} event={ev} isLast={idx===logs.length-1}/>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function LogEventRow({event}){
  const[expanded,setExpanded] = useState(false);
  const{action,ts,by,diffs}=event;
  const badge=ACTION_BADGE[action]||ACTION_BADGE.updated;
  const dot=ACTION_DOT[action]||ACTION_DOT.updated;

  // Find the most meaningful change to show as preview
  const statusChange=diffs.find(d=>d.field==="prospect_status");
  const remarkChange=diffs.find(d=>d.field==="feedback");
  const actionChange=diffs.find(d=>d.field==="next_action");
  const previewDiff=statusChange||actionChange||remarkChange||diffs[0];

  return(
    <div className="px-4 py-2.5">
      <div className="flex items-start gap-2.5">
        {/* dot */}
        <div className="mt-1.5 flex-shrink-0">
          <div className={cls("h-2 w-2 rounded-full",dot)}/>
        </div>
        <div className="min-w-0 flex-1">
          {/* top row: badge + who + when */}
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <span className={cls("rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase ring-1 ring-inset",badge)}>{action}</span>
            <span className="text-[11px] font-medium text-slate-600 truncate max-w-[120px]">{by}</span>
            <span className="text-[11px] text-slate-400">·</span>
            <span className="text-[11px] text-slate-400" title={fmtDT(ts)}>{relTime(ts)}</span>
            {ts&&<span className="hidden sm:inline text-[10px] text-slate-300">{fmtDT(ts)}</span>}
          </div>

          {/* preview of most notable change */}
          {previewDiff&&!expanded&&(
            <p className="text-[11px] text-slate-500 leading-snug">
              <span className="font-medium text-slate-600">{previewDiff.label}:</span>{" "}
              {previewDiff.from!==null&&previewDiff.from!==""&&(
                <><span className="line-through text-slate-400 mr-1">{String(previewDiff.from).slice(0,40)}{String(previewDiff.from).length>40?"…":""}</span>→{" "}</>
              )}
              <span className="text-slate-700">{previewDiff.to!==null&&previewDiff.to!==""?String(previewDiff.to).slice(0,60)+(String(previewDiff.to).length>60?"…":""):<span className="italic text-slate-300">empty</span>}</span>
              {diffs.length>1&&<span className="ml-1 text-[10px] text-slate-400">+{diffs.length-1} more</span>}
            </p>
          )}

          {/* expanded diff list */}
          {expanded&&(
            <div className="mt-1.5 rounded-lg border border-slate-100 bg-slate-50/70 divide-y divide-slate-100">
              {diffs.map(({field,label,from,to})=>(
                <div key={field} className="flex items-start gap-2 px-3 py-1.5">
                  <span className="w-24 flex-shrink-0 text-[10px] font-semibold text-slate-400 pt-0.5">{label}</span>
                  <div className="flex flex-wrap items-center gap-1 min-w-0">
                    {from!==null&&from!==""&&(
                      <><span className="text-[11px] text-slate-400 line-through break-all">{String(from).slice(0,80)}</span>
                      <span className="text-slate-300 text-[10px]">→</span></>
                    )}
                    <span className="text-[11px] text-slate-700 font-medium break-all">
                      {to!==null&&to!==""?String(to).slice(0,80):<span className="italic text-slate-300">cleared</span>}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* expand/collapse link */}
          {diffs.length>0&&(
            <button type="button" onClick={()=>setExpanded(v=>!v)}
              className="mt-1 text-[10px] font-semibold text-indigo-500 hover:text-indigo-700">
              {expanded?"Hide details":"Show all changes"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   INLINE ENQUIRY FORM BLOCK (used inside LeadForm)
═══════════════════════════════════════════════════════════════ */
function emptyEnqForm(){
  return{
    product_category:"",product_sub_category:"",product_name:"",
    product_description:"",consumption_per_month:"",unit:"",
    sample_required:false,quotation_required:false,
    sample_description:"",quotation_description:"",
    existing_supplier_brand:"",target_price:"",
    tds_available:false,
    fu_date:"",fu_time:"",fu_contact_type:"",fu_remark:"",fu_next_action:"",
    _errors:{},
  };
}

function validateEnqForm(enq){
  const errs={};
  if(!enq.product_category)  errs.product_category="Required";
  if(!enq.fu_date)           errs.fu_date="Required";
  if(!enq.fu_contact_type)   errs.fu_contact_type="Required";
  return errs;
}

function InlineEnquiryBlock({enq,index,onUpdate,onRemove,productsHook}){
  function hc(e){
    const{name,value,type,checked}=e.target;
    onUpdate(index,name,type==="checkbox"?checked:value);
  }
  function hProd(field,value){
    const k={product_category:"product_category",product_sub_category:"product_sub_category",product_name:"product_name"};
    onUpdate(index,k[field]||field,value);
  }

  const suggestedAction = suggestNextAction(
    enq.sample_required, enq.quotation_required,
    null, null
  );

  return(
    <motion.div
      initial={{opacity:0,y:12,scale:0.98}}
      animate={{opacity:1,y:0,scale:1}}
      exit={{opacity:0,y:-8,scale:0.97}}
      transition={{duration:0.2,ease:[0.16,1,0.3,1]}}
      className="rounded-xl border border-indigo-100 bg-indigo-50/20 overflow-hidden"
    >
      <div className="flex items-center justify-between bg-indigo-50/60 px-4 py-2.5 border-b border-indigo-100">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">{index+1}</span>
          <span className="text-[11px] font-bold uppercase tracking-widest text-indigo-600">Enquiry {index+1}</span>
        </div>
        <button type="button" onClick={()=>onRemove(index)}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-colors">
          <Ic.Trash className="h-3 w-3"/> Remove
        </button>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-700 text-[10px] font-bold text-white">1</span>
            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-600">Product Details</span>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-3">
            {productsHook&&(
              <div>
                <ProductPicker
                  category={enq.product_category}
                  subCategory={enq.product_sub_category}
                  productName={enq.product_name}
                  onChange={hProd}
                  useProductsHook={productsHook}
                />
                {enq._errors?.product_category&&<p className="mt-1 text-[11px] text-rose-500">{enq._errors.product_category}</p>}
              </div>
            )}
            <TArea label="Description" name="product_description" value={enq.product_description}
              onChange={hc} placeholder="Grade, application, specs…" rows={2}/>
            <div className="grid grid-cols-2 gap-3">
              <FldInput label="Qty / Month" name="consumption_per_month" type="number"
                value={enq.consumption_per_month} onChange={hc} placeholder="500" errors={{}}/>
              <div className="flex flex-col">
                <Lbl>Unit</Lbl>
                <div className="relative">
                  <select name="unit" value={enq.unit} onChange={hc} className={inp("appearance-none pr-9")}>
                    <option value="">Select</option>
                    {UNITS.map(u=><option key={u} value={u}>{u}</option>)}
                  </select>
                  <Ic.ChevD className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FldInput label="Target Price (₹)" name="target_price" type="number"
                value={enq.target_price} onChange={hc} placeholder="2500" errors={{}}/>
              <FldInput label="Existing Supplier" name="existing_supplier_brand"
                value={enq.existing_supplier_brand} onChange={hc} placeholder="Brand / competitor" errors={{}}/>
            </div>
            <div className="flex flex-wrap gap-5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="sample_required" checked={enq.sample_required} onChange={hc}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600"/>
                <span className="text-sm text-slate-700">Sample Required</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="quotation_required" checked={enq.quotation_required} onChange={hc}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600"/>
                <span className="text-sm text-slate-700">Quotation Required</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="tds_available" checked={enq.tds_available} onChange={hc}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600"/>
                <span className="text-sm text-slate-700">TDS Available</span>
              </label>
            </div>

            <AnimatePresence initial={false}>
              {enq.sample_required&&(
                <motion.div key="sample-desc"
                  initial={{opacity:0,height:0}} animate={{opacity:1,height:"auto"}} exit={{opacity:0,height:0}}
                  transition={{duration:0.18}} className="overflow-hidden">
                  <TArea label="Sample Description" name="sample_description" value={enq.sample_description}
                    onChange={hc} placeholder="Sample grade, quantity needed, packaging, special requirements…" rows={2}/>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence initial={false}>
              {enq.quotation_required&&(
                <motion.div key="quote-desc"
                  initial={{opacity:0,height:0}} animate={{opacity:1,height:"auto"}} exit={{opacity:0,height:0}}
                  transition={{duration:0.18}} className="overflow-hidden">
                  <TArea label="Quotation Description" name="quotation_description" value={enq.quotation_description}
                    onChange={hc} placeholder="Pricing basis, volume tiers, delivery terms, validity…" rows={2}/>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">2</span>
            <span className="text-[11px] font-bold uppercase tracking-widest text-amber-600">First Follow-up</span>
          </div>
          <div className="rounded-xl border border-amber-100 bg-amber-50/30 p-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Lbl required>Date</Lbl>
                <input type="date" name="fu_date" value={enq.fu_date} onChange={hc} min={todayStr()}
                  className={inp(enq._errors?.fu_date?"!border-rose-400":"")}/>
                {enq._errors?.fu_date&&<p className="mt-1 text-[11px] text-rose-500">{enq._errors.fu_date}</p>}
              </div>
              <div>
                <Lbl>Time <span className="normal-case font-normal text-slate-400">(optional)</span></Lbl>
                <input type="time" name="fu_time" value={enq.fu_time} onChange={hc} className={inp()}/>
              </div>
            </div>
            <div>
              <Lbl required>Contact Type</Lbl>
              <div className="relative">
                <select name="fu_contact_type" value={enq.fu_contact_type} onChange={hc}
                  className={inp(cls("appearance-none pr-9",enq._errors?.fu_contact_type?"!border-rose-400":""))}>
                  <option value="">Select…</option>
                  {CONTACT_TYPES.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
                <Ic.ChevD className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/>
              </div>
              {enq._errors?.fu_contact_type&&<p className="mt-1 text-[11px] text-rose-500">{enq._errors.fu_contact_type}</p>}
            </div>

            <div>
              <Lbl>Next Action</Lbl>
              {suggestedAction&&!enq.fu_next_action&&(
                <div className="mb-1.5 flex items-center gap-1.5">
                  <Ic.Sparkle className="h-3 w-3 text-indigo-400"/>
                  <span className="text-[10px] text-indigo-500">Suggested:</span>
                  <button type="button" onClick={()=>onUpdate(index,"fu_next_action",suggestedAction)}
                    className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 underline underline-offset-2">
                    {suggestedAction}
                  </button>
                </div>
              )}
              <div className="relative">
                <select name="fu_next_action" value={enq.fu_next_action} onChange={hc} className={inp("appearance-none pr-9")}>
                  <option value="">Select…</option>
                  {NEXT_ACTION_OPTIONS.map(a=><option key={a} value={a}>{a}</option>)}
                </select>
                <Ic.ChevD className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/>
              </div>
            </div>

            <TArea label="Note (optional)" name="fu_remark" value={enq.fu_remark}
              onChange={hc} placeholder="Anything to remember before the first call…" rows={2}/>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   LEAD FORM
═══════════════════════════════════════════════════════════════ */
const emptyLead={
  prospect_id:"",company_name:"",country:"India",state:"",city:"",zone:"",route:"",
  nature_of_business:"",manufacturing_industry:"",company_website:"",gst_number:"",linkedin_profile:"",
  primary_contact_name:"",primary_designation:"",primary_phone:"",primary_email:"",
  whatsapp_same_as_mobile:false,whatsapp_number:"",
  secondary_contact_name:"",secondary_designation:"",secondary_phone:"",secondary_email:"",
};

function LeadForm({initial,prospect,token,routesHook,productsHook,onClose,onSaved,onEnquirySaved}){
  const isEdit=!!initial?.id;

  const prospectLockedFields = useMemo(()=>{
    if(isEdit||!prospect) return {};
    return {
      primary_contact_name: !!(prospect.contact_name),
      primary_designation:  !!(prospect.contact_designation),
      primary_phone:        !!(prospect.contact_phone),
      primary_email:        !!(prospect.contact_email),
    };
  },[isEdit,prospect]);

  const[form,setForm]=useState(()=>{
    if(initial){
      return{
        ...emptyLead,...initial,
        whatsapp_same_as_mobile: initial.whatsapp_same_as_mobile||false,
        primary_phone: initial.primary_phone||"",
        primary_email: initial.primary_email||"",
        primary_contact_name: initial.primary_contact_name||"",
        primary_designation: initial.primary_designation||"",
        whatsapp_number: initial.whatsapp_number||"",
        secondary_contact_name: initial.secondary_contact_name||"",
        secondary_designation: initial.secondary_designation||"",
        secondary_phone: initial.secondary_phone||"",
        secondary_email: initial.secondary_email||"",
        nature_of_business: initial.nature_of_business||"",
        manufacturing_industry: initial.manufacturing_industry||"",
        company_website: initial.company_website||"",
        gst_number: initial.gst_number||"",
        linkedin_profile: initial.linkedin_profile||"",
        country: initial.country||"India",
        state: initial.state||"",
        city: initial.city||"",
        zone: initial.zone||"",
        route: initial.route||"",
      };
    }
    if(prospect){
      return{
        ...emptyLead,
        prospect_id: prospect.id,
        company_name: prospect.company_name||"",
        country: prospect.country||"India",
        state: prospect.state||"",
        city: prospect.city||"",
        zone: prospect.zone||"",
        route: prospect.route||"",
        primary_contact_name: prospect.contact_name||"",
        primary_designation:  prospect.contact_designation||"",
        primary_phone:        prospect.contact_phone||"",
        primary_email:        prospect.contact_email||"",
      };
    }
    return{...emptyLead};
  });

  const[saving,setSaving]=useState(false);
  const[genErr,setGenErr]=useState("");
  const[enquiryForms,setEnquiryForms]=useState([]);
  const[missingLeadFields,setMissingLeadFields]=useState([]);

  function hc(e){
    const{name,value,type,checked}=e.target;
    setMissingLeadFields([]);
    setForm(p=>{
      const u={...p,[name]:type==="checkbox"?checked:value};
      if(name==="whatsapp_same_as_mobile"&&checked) u.whatsapp_number=p.primary_phone;
      if(name==="primary_phone"&&p.whatsapp_same_as_mobile) u.whatsapp_number=value;
      return u;
    });
  }
  function hLoc(f,v){setMissingLeadFields([]);setForm(p=>({...p,[f]:v}));}

  function addEnquiryForm(){
    const missing=missingLeadFormFields(form);
    if(missing.length){ setMissingLeadFields(missing); return; }
    setMissingLeadFields([]);
    setEnquiryForms(p=>[...p,emptyEnqForm()]);
  }
  function removeEnquiryForm(i){ setEnquiryForms(p=>p.filter((_,j)=>j!==i)); }
  function updateEnquiryForm(i,field,value){
    setEnquiryForms(p=>{
      const arr=[...p];
      arr[i]={...arr[i],[field]:value,_errors:{...arr[i]._errors,[field]:undefined}};
      return arr;
    });
  }

  async function submit(e){
    e.preventDefault();
    setGenErr("");
    setSaving(true);
    try{
      const body={...form};
      const url=isEdit?`${API}/api/leads/${initial.id}`:`${API}/api/leads`;
      const res=await fetch(url,{method:isEdit?"PUT":"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify(body)});
      const data=await res.json();
      if(!res.ok) throw new Error(data.message||"Failed");
      const savedLead=data.lead;

      if(enquiryForms.length>0){
        let hasEnqErrors=false;
        const updatedForms=enquiryForms.map(enq=>{
          const errs=validateEnqForm(enq);
          if(Object.keys(errs).length){hasEnqErrors=true;return{...enq,_errors:errs};}
          return enq;
        });
        if(hasEnqErrors){
          setEnquiryForms(updatedForms);
          setSaving(false);
          setGenErr("Lead saved! Please fix enquiry errors below and save again, or remove incomplete enquiries.");
          onSaved(savedLead,isEdit);
          return;
        }

        const createdRFQs=[];
        for(let idx=0;idx<enquiryForms.length;idx++){
          const enq=enquiryForms[idx];
          const r1=await fetch(`${API}/api/rfqs`,{method:"POST",
            headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},
            body:JSON.stringify({
              lead_id:savedLead.id,company_name:savedLead.company_name,
              product_category:enq.product_category,
              product_sub_category:enq.product_sub_category||null,
              product_name:enq.product_name||null,
              product_description:enq.product_description||null,
              consumption_per_month:enq.consumption_per_month||null,
              unit:enq.unit||null,
              sample_required:enq.sample_required,
              quotation_required:enq.quotation_required,
              sample_description:enq.sample_description||null,
              quotation_description:enq.quotation_description||null,
              existing_supplier_brand:enq.existing_supplier_brand||null,
              target_price:enq.target_price||null,
              tds_available:enq.tds_available||false,
            })});
          const d1=await r1.json();
          if(!r1.ok){
            setEnquiryForms(p=>p.map((f,j)=>j===idx?{...f,_errors:{_g:d1.message||"RFQ failed"}}:f));
            continue;
          }
          const r2=await fetch(`${API}/api/rfqs/${d1.rfq.id}/followups`,{method:"POST",
            headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},
            body:JSON.stringify({
              contact_type:enq.fu_contact_type,
              followup_date:enq.fu_date,
              enquiry_status:"Open",
              next_action:enq.fu_next_action||null,
              remark:enq.fu_remark||null,
              notes:encodeTimeInNotes(enq.fu_time,null),
            })});
          const d2=await r2.json();
          if(r2.ok){
            createdRFQs.push({...d1.rfq,rfq_followups:[d2.followup],samples:[],quotations:[]});
          }
        }
        onSaved(savedLead,isEdit);
        createdRFQs.forEach(rfq=>onEnquirySaved&&onEnquirySaved(rfq));
      }else{
        onSaved(savedLead,isEdit);
      }
      onClose();
    }catch(err){setGenErr(err.message);}
    finally{setSaving(false);}
  }

  return(
    <Backdrop onClick={onClose}>
      <Sheet wide>
        <SheetHead title={isEdit?"Edit Lead":"Convert to Lead"} subtitle={form.company_name||"New Lead"} onClose={onClose} accent="bg-gradient-to-r from-white to-indigo-50/30"/>
        <form onSubmit={submit} className="px-5 pb-6 pt-4">
          <SecDiv title="Company Information" icon={Ic.Building} accent="indigo"/>
          <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><FldInput label="Company Name" name="company_name" value={form.company_name} onChange={hc} required icon={Ic.Building} errors={{}} disabled={!!prospect&&!isEdit}/></div>
            <SelInput label="Nature of Business" name="nature_of_business" value={form.nature_of_business} onChange={hc} options={BIZ_TYPES} errors={{}}/>
            {form.nature_of_business==="Manufacturer"&&<FldInput label="Manufacturing Industry" name="manufacturing_industry" value={form.manufacturing_industry} onChange={hc} icon={Ic.Factory} errors={{}}/>}
            <FldInput label="GST Number" name="gst_number" value={form.gst_number} onChange={hc} placeholder="27AAAAA0000A1Z5" icon={Ic.Receipt} errors={{}}/>
            <FldInput label="Website" name="company_website" value={form.company_website} onChange={hc} placeholder="https://…" icon={Ic.Globe} errors={{}}
              onBlur={e=>{const t=e.target.value.trim();if(t&&!t.startsWith("http"))setForm(p=>({...p,company_website:"https://"+t}));}}/>
            <div className="sm:col-span-2"><FldInput label="LinkedIn" name="linkedin_profile" value={form.linkedin_profile} onChange={hc} placeholder="https://linkedin.com/…" icon={Ic.LinkedIn} errors={{}}/></div>
          </div>

          <SecDiv title="Location" icon={Ic.Pin} accent="teal"/>
          <div className="mb-5"><LocationPicker country={form.country} state={form.state} city={form.city} zone={form.zone} route={form.route} onChange={hLoc} useRoutesHook={routesHook} errors={{}}/></div>

          <SecDiv title="Primary Contact" icon={Ic.User} accent="indigo"/>
          {!isEdit&&(prospectLockedFields.primary_contact_name||prospectLockedFields.primary_phone||prospectLockedFields.primary_email)&&(
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50/60 px-3 py-2">
              <Ic.Lock className="h-3.5 w-3.5 text-indigo-400 shrink-0"/>
              <p className="text-[11px] text-indigo-600">Contact details pre-filled from prospect record and locked. You can edit them after creation via the Lead edit form.</p>
            </div>
          )}
          <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FldInput label="Contact Name" name="primary_contact_name" value={form.primary_contact_name} onChange={hc} icon={Ic.User} placeholder="Rajesh Mehta" errors={{}}
              disabled={!isEdit&&prospectLockedFields.primary_contact_name}/>
            <SelInput label="Designation" name="primary_designation" value={form.primary_designation} onChange={hc} options={DESIGNATIONS} errors={{}} placeholder="Select designation"/>
            <FldInput label="Phone" name="primary_phone" value={form.primary_phone} onChange={hc} icon={Ic.Phone} placeholder="+91 98765 43210" errors={{}}
              disabled={!isEdit&&prospectLockedFields.primary_phone}/>
            <FldInput label="Email" name="primary_email" type="email" value={form.primary_email} onChange={hc} icon={Ic.Mail} placeholder="rajesh@company.com" errors={{}}
              disabled={!isEdit&&prospectLockedFields.primary_email}/>
            <div className="sm:col-span-2 space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="whatsapp_same_as_mobile" checked={form.whatsapp_same_as_mobile} onChange={hc} className="h-4 w-4 rounded border-slate-300 text-indigo-600"/>
                <span className="text-sm text-slate-700">WhatsApp same as mobile</span>
              </label>
              {!form.whatsapp_same_as_mobile&&<FldInput label="WhatsApp" name="whatsapp_number" value={form.whatsapp_number} onChange={hc} icon={Ic.Phone} placeholder="+91 98765 43210" errors={{}}/>}
            </div>
          </div>

          <SecDiv title="Secondary Contact (Optional)" icon={Ic.User} accent="violet"/>
          <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FldInput label="Contact Name" name="secondary_contact_name" value={form.secondary_contact_name} onChange={hc} icon={Ic.User} placeholder="Priya Shah" errors={{}}/>
            <SelInput label="Designation" name="secondary_designation" value={form.secondary_designation} onChange={hc} options={DESIGNATIONS} errors={{}} placeholder="Select designation"/>
            <FldInput label="Phone" name="secondary_phone" value={form.secondary_phone} onChange={hc} icon={Ic.Phone} placeholder="+91 87654 32100" errors={{}}/>
            <FldInput label="Email" name="secondary_email" type="email" value={form.secondary_email} onChange={hc} icon={Ic.Mail} placeholder="priya@company.com" errors={{}}/>
          </div>

          <SecDiv title="Enquiries" icon={Ic.FileT} accent="indigo"/>
          <div className="mb-5 space-y-3">
            <AnimatePresence initial={false}>
              {enquiryForms.map((enq,i)=>(
                <InlineEnquiryBlock key={i} enq={enq} index={i} onUpdate={updateEnquiryForm} onRemove={removeEnquiryForm} productsHook={productsHook}/>
              ))}
            </AnimatePresence>

            <AnimatePresence>
              {missingLeadFields.length>0&&(
                <motion.div
                  initial={{opacity:0,y:-6,scale:0.98}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:-4,scale:0.97}} transition={{duration:0.18}}
                  className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <div className="flex items-start gap-2">
                    <Ic.Alert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5"/>
                    <div>
                      <p className="text-[12px] font-semibold text-amber-700 mb-1">Fill in these lead fields before adding an enquiry:</p>
                      <ul className="list-disc list-inside space-y-0.5">{missingLeadFields.map(f=><li key={f} className="text-[11px] text-amber-700">{f}</li>)}</ul>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <button type="button" onClick={addEnquiryForm}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-indigo-200 px-4 py-3 text-sm font-medium text-indigo-500 hover:border-indigo-400 hover:bg-indigo-50/40 hover:text-indigo-600 transition-all">
              <Ic.Plus className="h-4 w-4"/> Add Enquiry
            </button>
            {enquiryForms.length>0&&(
              <p className="text-[11px] text-slate-400 text-center">Enquiries will be created when you save the lead</p>
            )}
          </div>

          {genErr&&<div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{genErr}</div>}
          <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-4">
            <GBtn type="button" onClick={onClose}>Cancel</GBtn>
            <PBtn type="submit" disabled={saving}>{saving?"Saving…":isEdit?"Update Lead":"Save as Lead"}</PBtn>
          </div>
        </form>
      </Sheet>
    </Backdrop>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ADD ENQUIRY FORM (standalone modal from detail panel)
═══════════════════════════════════════════════════════════════ */
function AddEnquiryForm({lead,token,productsHook,onClose,onSaved}){
  const[form,setForm]=useState({
    product_category:"",product_sub_category:"",product_name:"",product_description:"",
    consumption_per_month:"",unit:"",sample_required:false,quotation_required:false,
    sample_description:"",quotation_description:"",
    existing_supplier_brand:"",target_price:"",tds_available:false,
    fu_date:"",fu_time:"",fu_contact_type:"",fu_remark:"",fu_next_action:"",
  });
  const[errors,setErrors]=useState({});
  const[saving,setSaving]=useState(false);

  function hc(e){const{name,value,type,checked}=e.target;setErrors(p=>({...p,[name]:undefined}));setForm(p=>({...p,[name]:type==="checkbox"?checked:value}));}
  function hProd(field,value){
    const k={product_category:"product_category",product_sub_category:"product_sub_category",product_name:"product_name"};
    setErrors(p=>({...p,[k[field]||field]:undefined}));
    setForm(p=>({...p,[k[field]||field]:value}));
  }

  const suggestedAction = suggestNextAction(form.sample_required, form.quotation_required, null, null);

  async function submit(e){
    e.preventDefault();
    const errs=validateEnqForm(form);
    if(Object.keys(errs).length){setErrors(errs);return;}
    setSaving(true);
    try{
      const r1=await fetch(`${API}/api/rfqs`,{method:"POST",
        headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},
        body:JSON.stringify({
          lead_id:lead.id,company_name:lead.company_name,
          product_category:form.product_category,product_sub_category:form.product_sub_category||null,
          product_name:form.product_name||null,product_description:form.product_description||null,
          consumption_per_month:form.consumption_per_month||null,unit:form.unit||null,
          sample_required:form.sample_required,quotation_required:form.quotation_required,
          sample_description:form.sample_description||null,
          quotation_description:form.quotation_description||null,
          existing_supplier_brand:form.existing_supplier_brand||null,
          target_price:form.target_price||null,
          tds_available:form.tds_available||false,
        })});
      const d1=await r1.json();
      if(!r1.ok) throw new Error(d1.message||"RFQ failed");

      const r2=await fetch(`${API}/api/rfqs/${d1.rfq.id}/followups`,{method:"POST",
        headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},
        body:JSON.stringify({
          contact_type:form.fu_contact_type,
          followup_date:form.fu_date,
          enquiry_status:"Open",
          next_action:form.fu_next_action||null,
          remark:form.fu_remark||null,
          notes:encodeTimeInNotes(form.fu_time,null),
          target_price:form.target_price||null,
        })});
      const d2=await r2.json();
      if(!r2.ok) throw new Error(d2.message||"Follow-up failed");

      onSaved({...d1.rfq,rfq_followups:[d2.followup],samples:[],quotations:[]});
      onClose();
    }catch(err){setErrors({_g:err.message});}
    finally{setSaving(false);}
  }

  return(
    <Backdrop onClick={onClose}>
      <Sheet wide>
        <SheetHead title="Add New Enquiry" subtitle={lead.company_name} onClose={onClose} accent="bg-gradient-to-r from-white to-sky-50/30"/>
        <form onSubmit={submit} className="px-5 pb-6 pt-4">
          <div className="mb-1 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">1</span>
            <span className="text-[11px] font-bold uppercase tracking-widest text-indigo-600">Product Details</span>
          </div>
          <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50/40 p-4 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                {productsHook&&<ProductPicker category={form.product_category} subCategory={form.product_sub_category} productName={form.product_name} onChange={hProd} useProductsHook={productsHook}/>}
                <FErr name="product_category" errors={errors}/>
              </div>
              <div className="sm:col-span-2"><TArea label="Description" name="product_description" value={form.product_description} onChange={hc} placeholder="Grade, application, specs…" rows={2}/></div>
              <div className="grid grid-cols-2 gap-2 sm:col-span-2 sm:grid-cols-4">
                <div className="col-span-2"><FldInput label="Qty/Month" name="consumption_per_month" type="number" value={form.consumption_per_month} onChange={hc} placeholder="500"/></div>
                <div className="col-span-2"><SelInput label="Unit" name="unit" value={form.unit} onChange={hc} options={UNITS}/></div>
              </div>
              <FldInput label="Target Price (₹)" name="target_price" type="number" value={form.target_price} onChange={hc} placeholder="2500"/>
              <FldInput label="Existing Supplier" name="existing_supplier_brand" value={form.existing_supplier_brand} onChange={hc} placeholder="Brand / competitor"/>
            </div>
            <div className="flex flex-wrap gap-5 pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="sample_required" checked={form.sample_required} onChange={hc} className="h-4 w-4 rounded border-slate-300 text-indigo-600"/>
                <span className="text-sm text-slate-700">Sample Required</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="quotation_required" checked={form.quotation_required} onChange={hc} className="h-4 w-4 rounded border-slate-300 text-indigo-600"/>
                <span className="text-sm text-slate-700">Quotation Required</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="tds_available" checked={form.tds_available} onChange={hc} className="h-4 w-4 rounded border-slate-300 text-indigo-600"/>
                <span className="text-sm text-slate-700">TDS Available</span>
              </label>
            </div>
            <AnimatePresence initial={false}>
              {form.sample_required&&(
                <motion.div key="sample-desc" initial={{opacity:0,height:0}} animate={{opacity:1,height:"auto"}} exit={{opacity:0,height:0}} transition={{duration:0.18}} className="overflow-hidden">
                  <div className="rounded-xl border border-teal-100 bg-teal-50/40 p-3">
                    <TArea label="Sample Description" name="sample_description" value={form.sample_description} onChange={hc} placeholder="Sample grade, quantity needed, packaging, special requirements…" rows={2}/>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <AnimatePresence initial={false}>
              {form.quotation_required&&(
                <motion.div key="quote-desc" initial={{opacity:0,height:0}} animate={{opacity:1,height:"auto"}} exit={{opacity:0,height:0}} transition={{duration:0.18}} className="overflow-hidden">
                  <div className="rounded-xl border border-violet-100 bg-violet-50/40 p-3">
                    <TArea label="Quotation Description" name="quotation_description" value={form.quotation_description} onChange={hc} placeholder="Pricing basis, volume tiers, delivery terms, validity…" rows={2}/>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="mb-1 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">2</span>
            <span className="text-[11px] font-bold uppercase tracking-widest text-amber-600">Schedule First Follow-up</span>
          </div>
          <div className="mb-6 rounded-xl border border-amber-100 bg-amber-50/30 p-4 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Lbl required>Follow-up Date</Lbl>
                <input type="date" name="fu_date" value={form.fu_date} onChange={hc} min={todayStr()} className={inp(errors.fu_date?"!border-rose-400":"")}/>
                <FErr name="fu_date" errors={errors}/>
              </div>
              <div>
                <Lbl>Time <span className="normal-case font-normal text-slate-400">(optional)</span></Lbl>
                <input type="time" name="fu_time" value={form.fu_time} onChange={hc} className={inp()}/>
              </div>
              <div className="sm:col-span-2">
                <SelInput label="How would you contact?" name="fu_contact_type" value={form.fu_contact_type} onChange={hc} options={CONTACT_TYPES} required errors={{fu_contact_type:errors.fu_contact_type}}/>
              </div>
              <div className="sm:col-span-2">
                <Lbl>Next Action</Lbl>
                {suggestedAction&&!form.fu_next_action&&(
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <Ic.Sparkle className="h-3 w-3 text-indigo-400"/>
                    <span className="text-[10px] text-indigo-500">Suggested:</span>
                    <button type="button" onClick={()=>setForm(p=>({...p,fu_next_action:suggestedAction}))}
                      className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 underline underline-offset-2">{suggestedAction}</button>
                  </div>
                )}
                <div className="relative">
                  <select name="fu_next_action" value={form.fu_next_action} onChange={hc} className={inp("appearance-none pr-9")}>
                    <option value="">Select…</option>
                    {NEXT_ACTION_OPTIONS.map(a=><option key={a} value={a}>{a}</option>)}
                  </select>
                  <Ic.ChevD className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/>
                </div>
              </div>
              <div className="sm:col-span-2">
                <TArea label="Note (optional)" name="fu_remark" value={form.fu_remark} onChange={hc} placeholder="Anything to remember before the first call…" rows={2}/>
              </div>
            </div>
          </div>

          {errors._g&&<div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errors._g}</div>}
          <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-4">
            <GBtn type="button" onClick={onClose}>Cancel</GBtn>
            <PBtn type="submit" disabled={saving}>{saving?"Adding…":"Add Enquiry"}</PBtn>
          </div>
        </form>
      </Sheet>
    </Backdrop>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ADD FOLLOW-UP MODAL
═══════════════════════════════════════════════════════════════ */
function AddFollowupModal({rfq,token,onClose,onSaved}){
  const prevStatus=latestFU(rfq)?.enquiry_status||"Open";
  const sample   =(rfq.samples||[])[0];
  const quotation=(rfq.quotations||[])[0];
  const autoSuggested = suggestNextAction(rfq.sample_required,rfq.quotation_required,sample?.sample_status||null,quotation?.quotation_status||null);

  const[form,setForm]=useState({contact_type:"",followup_date:"",followup_time:"",remark:"",next_action:autoSuggested||""});
  const[saving,setSaving]=useState(false);
  const[errors,setErrors]=useState({});

  function hc(e){const{name,value}=e.target;setErrors(p=>({...p,[name]:undefined}));setForm(p=>({...p,[name]:value}));}

  async function submit(e){
    e.preventDefault();
    const errs={};
    if(!form.contact_type)  errs.contact_type="Required";
    if(!form.followup_date) errs.followup_date="Required";
    if(new Date(form.followup_date)<todayMidnight()) errs.followup_date="Must be today or future";
    if(Object.keys(errs).length){setErrors(errs);return;}
    setSaving(true);
    try{
      const res=await fetch(`${API}/api/rfqs/${rfq.id}/followups`,{method:"POST",
        headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},
        body:JSON.stringify({
          contact_type:form.contact_type,enquiry_status:prevStatus,
          followup_date:form.followup_date,next_action:form.next_action||null,
          remark:form.remark||null,notes:encodeTimeInNotes(form.followup_time,null),
        })});
      const data=await res.json();
      if(!res.ok) throw new Error(data.message||"Failed");
      onSaved(data.followup);onClose();
    }catch(e){setErrors({_g:e.message});}
    finally{setSaving(false);}
  }

  return(
    <Backdrop onClick={onClose}>
      <Sheet>
        <SheetHead title="Schedule Follow-up" subtitle={rfq.product_name||rfq.product_category} onClose={onClose} accent="bg-gradient-to-r from-white to-sky-50/30"/>
        <form onSubmit={submit} className="px-5 pb-6 pt-4 space-y-4">
          <div className="rounded-xl border border-sky-100 bg-sky-50/40 px-4 py-3">
            <p className="text-[11px] font-semibold text-sky-700 mb-1">Plan your next touchpoint</p>
            <p className="text-[11px] text-sky-600">This schedules the follow-up. You'll record the outcome from the Follow-ups menu on the day it's due.</p>
          </div>
          <SelInput label="How will you contact them?" name="contact_type" value={form.contact_type} onChange={hc} options={CONTACT_TYPES} required errors={errors}/>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Lbl required>Follow-up Date</Lbl>
              <input type="date" name="followup_date" value={form.followup_date} onChange={hc} min={todayStr()} className={inp(errors.followup_date?"!border-rose-400":"")}/>
              <FErr name="followup_date" errors={errors}/>
            </div>
            <div>
              <Lbl>Time <span className="normal-case font-normal text-slate-400">(optional)</span></Lbl>
              <input type="time" name="followup_time" value={form.followup_time} onChange={hc} className={inp()}/>
            </div>
          </div>
          <div>
            <Lbl>Next Action</Lbl>
            {autoSuggested&&form.next_action!==autoSuggested&&(
              <div className="mb-1.5 flex items-center gap-1.5">
                <Ic.Sparkle className="h-3 w-3 text-indigo-400"/>
                <span className="text-[10px] text-indigo-500">Suggested based on current status:</span>
                <button type="button" onClick={()=>setForm(p=>({...p,next_action:autoSuggested}))}
                  className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 underline underline-offset-2">{autoSuggested}</button>
              </div>
            )}
            {autoSuggested&&form.next_action===autoSuggested&&(
              <div className="mb-1.5 flex items-center gap-1.5">
                <Ic.Sparkle className="h-3 w-3 text-emerald-400"/>
                <span className="text-[10px] text-emerald-600 font-medium">Auto-filled from current sample/quotation status</span>
              </div>
            )}
            <div className="relative">
              <select name="next_action" value={form.next_action} onChange={hc} className={inp("appearance-none pr-9")}>
                <option value="">Select…</option>
                {NEXT_ACTION_OPTIONS.map(a=><option key={a} value={a}>{a}</option>)}
              </select>
              <Ic.ChevD className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/>
            </div>
          </div>
          <TArea label="Note (optional)" name="remark" value={form.remark} onChange={hc} placeholder="Anything to remember before the next call…" rows={2}/>
          {errors._g&&<div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errors._g}</div>}
          <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-3">
            <GBtn type="button" onClick={onClose}>Cancel</GBtn>
            <PBtn type="submit" disabled={saving}>{saving?"Saving…":"Schedule"}</PBtn>
          </div>
        </form>
      </Sheet>
    </Backdrop>
  );
}

/* ═══════════════════════════════════════════════════════════════
   EDIT FOLLOW-UP MODAL
═══════════════════════════════════════════════════════════════ */
function EditFollowupModal({rfq,followup,token,onClose,onSaved}){
  const sample   =(rfq.samples||[])[0];
  const quotation=(rfq.quotations||[])[0];
  const autoSuggested = suggestNextAction(rfq.sample_required,rfq.quotation_required,sample?.sample_status||null,quotation?.quotation_status||null);

  const[form,setForm]=useState({
    contact_type:followup.contact_type||"",enquiry_status:followup.enquiry_status||"Open",
    followup_date:followup.followup_date||"",followup_time:extractTimeFromNotes(followup.notes)||"",
    next_action:followup.next_action||"",remark:followup.remark||"",notes:cleanNotes(followup.notes)||"",
  });
  const[saving,setSaving]=useState(false);
  const[errors,setErrors]=useState({});

  function hc(e){const{name,value}=e.target;setErrors(p=>({...p,[name]:undefined}));setForm(p=>({...p,[name]:value}));}

  async function submit(e){
    e.preventDefault();
    const errs={};
    if(!form.contact_type)   errs.contact_type="Required";
    if(!form.enquiry_status) errs.enquiry_status="Required";
    if(!form.followup_date)  errs.followup_date="Required";
    if(Object.keys(errs).length){setErrors(errs);return;}
    setSaving(true);
    try{
      const res=await fetch(`${API}/api/rfqs/followups/${followup.id}`,{method:"PUT",
        headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},
        body:JSON.stringify({
          contact_type:form.contact_type,enquiry_status:form.enquiry_status,
          followup_date:form.followup_date,next_action:form.next_action||null,
          remark:form.remark||null,notes:encodeTimeInNotes(form.followup_time,form.notes),
        })});
      const data=await res.json();
      if(!res.ok) throw new Error(data.message||"Failed");
      onSaved(data.followup);onClose();
    }catch(e){setErrors({_g:e.message});}
    finally{setSaving(false);}
  }

  return(
    <Backdrop onClick={onClose}>
      <Sheet>
        <SheetHead title="Edit Follow-up" subtitle={rfq.product_name||rfq.product_category} onClose={onClose} accent="bg-gradient-to-r from-white to-indigo-50/30"/>
        <form onSubmit={submit} className="px-5 pb-6 pt-4 space-y-4">
          <SelInput label="Contact Type" name="contact_type" value={form.contact_type} onChange={hc} options={CONTACT_TYPES} required errors={errors}/>
          <SelInput label="Enquiry Status" name="enquiry_status" value={form.enquiry_status} onChange={hc} options={ENQ_STATUSES} required errors={errors}/>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Lbl required>Follow-up Date</Lbl>
              <input type="date" name="followup_date" value={form.followup_date} onChange={hc} className={inp(errors.followup_date?"!border-rose-400":"")}/>
              <FErr name="followup_date" errors={errors}/>
            </div>
            <div>
              <Lbl>Time</Lbl>
              <input type="time" name="followup_time" value={form.followup_time} onChange={hc} className={inp()}/>
            </div>
          </div>
          <div>
            <Lbl>Next Action</Lbl>
            {autoSuggested&&form.next_action!==autoSuggested&&(
              <div className="mb-1.5 flex items-center gap-1.5">
                <Ic.Sparkle className="h-3 w-3 text-indigo-400"/>
                <span className="text-[10px] text-indigo-500">Suggested:</span>
                <button type="button" onClick={()=>setForm(p=>({...p,next_action:autoSuggested}))}
                  className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 underline underline-offset-2">{autoSuggested}</button>
              </div>
            )}
            <div className="relative">
              <select name="next_action" value={form.next_action} onChange={hc} className={inp("appearance-none pr-9")}>
                <option value="">Select…</option>
                {NEXT_ACTION_OPTIONS.map(a=><option key={a} value={a}>{a}</option>)}
              </select>
              <Ic.ChevD className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/>
            </div>
          </div>
          <TArea label="Remarks" name="remark" value={form.remark} onChange={hc} rows={3}/>
          <TArea label="Notes" name="notes" value={form.notes} onChange={hc} rows={2}/>
          {errors._g&&<div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errors._g}</div>}
          <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-3">
            <GBtn type="button" onClick={onClose}>Cancel</GBtn>
            <PBtn type="submit" disabled={saving}>{saving?"Saving…":"Update"}</PBtn>
          </div>
        </form>
      </Sheet>
    </Backdrop>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ENQUIRY CARD
═══════════════════════════════════════════════════════════════ */
function EnquiryCard({rfq,token,canEdit,onUpdated}){
  const closed=isEnquiryClosed(rfq);

  const[showLogs,setShowLogs]           =useState(false);
  const[fullFups,setFullFups]           =useState(null);
  const[loadingFups,setLoadingFups]     =useState(false);
  const[showAddFup,setShowAddFup]       =useState(false);
  const[editFup,setEditFup]             =useState(null);
  const[deletingId,setDeletingId]       =useState(null);
  const[showCoordLogs,setShowCoordLogs] =useState(false);
  const[coordLogs,setCoordLogs]         =useState(null);
  const[loadingCoordLogs,setLoadingCoordLogs]=useState(false);

  async function openCoordLogs(){
    setShowCoordLogs(true);
    if(coordLogs!==null) return;
    setLoadingCoordLogs(true);
    try{
      const sample=(rfq.samples||[])[0];
      const quotation=(rfq.quotations||[])[0];
      const calls=[];
      calls.push(sample?fetch(`${API}/api/samples/${sample.id}/logs`,{headers:{Authorization:`Bearer ${token}`}}).then(r=>r.json()):Promise.resolve({logs:[]}));
      calls.push(quotation?fetch(`${API}/api/quotations/${quotation.id}/logs`,{headers:{Authorization:`Bearer ${token}`}}).then(r=>r.json()):Promise.resolve({logs:[]}));
      const[sJ,qJ]=await Promise.all(calls);
      setCoordLogs({sample:sJ.logs||[],quotation:qJ.logs||[]});
    }catch(_){setCoordLogs({sample:[],quotation:[]});}
    finally{setLoadingCoordLogs(false);}
  }

  const hasSampleOrQuote=(rfq.sample_required&&(rfq.samples||[]).length>0)||(rfq.quotation_required&&(rfq.quotations||[]).length>0);

  async function openLogs(){
    setShowLogs(true);
    if(fullFups!==null) return;
    setLoadingFups(true);
    try{
      const r=await fetch(`${API}/api/rfqs/${rfq.id}/followups`,{headers:{Authorization:`Bearer ${token}`}});
      const d=await r.json();
      if(r.ok) setFullFups([...(d.followups||[])].filter(f=>!f.deleted_at));
    }catch(_){}
    finally{setLoadingFups(false);}
  }

  const allFups=(fullFups!==null?fullFups:[...(rfq.rfq_followups||[])].filter(f=>!f.deleted_at))
    .sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  const latestFup=allFups[0]||null;
  const olderFups=allFups.slice(1);
  const status=latestFup?.enquiry_status||"Open";
  const sample   =(rfq.samples||[])[0];
  const quotation=(rfq.quotations||[])[0];
  const cardTime=extractTimeFromNotes(latestFup?.notes);

  function handleFupSaved(saved){
    setFullFups(p=>[saved,...(p||allFups)]);
    onUpdated("new",rfq.id,saved);
  }
  function handleFupEdited(saved){
    setFullFups(p=>(p||allFups).map(f=>f.id===saved.id?saved:f));
    onUpdated("edit",rfq.id,saved);
  }
  async function deleteFup(id){
    if(!window.confirm("Delete this follow-up?")) return;
    setDeletingId(id);
    try{
      const r=await fetch(`${API}/api/rfqs/followups/${id}`,{method:"DELETE",headers:{Authorization:`Bearer ${token}`}});
      if(!r.ok) throw new Error("Delete failed");
      setFullFups(p=>(p||allFups).filter(f=>f.id!==id));
      onUpdated("deleteFup",rfq.id,id);
    }catch(e){alert(e.message);}
    finally{setDeletingId(null);}
  }

  return(
    <div className={cls("rounded-xl border overflow-hidden mb-3 last:mb-0 transition-opacity",
      closed?"border-slate-200 bg-white/70 opacity-75 hover:opacity-100":"border-slate-200 bg-white")}>
      <div className={cls("flex items-center gap-3 px-4 py-3",closed?"bg-slate-50/60":"bg-slate-50/80")}>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Tag className={cls(ENQ_STATUS_CLS[status]||"bg-slate-100 text-slate-500 ring-slate-200","ring-1 ring-inset")}>
              {closed&&<Ic.Check className="mr-1 h-2.5 w-2.5"/>}{status}
            </Tag>
            <span className="text-[13px] font-semibold text-slate-800 truncate">{rfq.product_name||rfq.product_category||"Enquiry"}</span>
            {rfq.product_sub_category&&<span className="hidden sm:inline text-[11px] text-slate-400">{rfq.product_sub_category}</span>}
          </div>
          <div className="flex flex-wrap gap-x-3 mt-0.5">
            {rfq.product_category&&<span className="text-[11px] text-slate-400">{rfq.product_category}</span>}
            {rfq.consumption_per_month&&<span className="text-[11px] text-slate-400">{rfq.consumption_per_month} {rfq.unit}/mo</span>}
            {(latestFup?.target_price||rfq.target_price)&&<span className="text-[11px] text-slate-400">₹{latestFup?.target_price||rfq.target_price}</span>}
            {rfq.tds_available&&<Tag className="bg-green-50 text-green-700 ring-green-200">TDS</Tag>}
          </div>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1">
          {(sample||quotation)&&(
            <div className="flex gap-1">
              {sample&&<Tag className={cls(SAMPLE_CLS[sample.sample_status]||"bg-slate-100 text-slate-500","ring-0 text-[9px]")}>{sample.sample_status?.split(" ")[0]||"Sample"}</Tag>}
              {quotation&&<Tag className="ring-0 text-[9px] bg-violet-50 text-violet-700">{quotation.quotation_status?.split(" ")[0]||"Quote"}</Tag>}
            </div>
          )}
          {canEdit&&!closed&&(
            <button type="button" onClick={()=>setShowAddFup(true)}
              className="flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-indigo-700 transition-colors">
              <Ic.Plus className="h-3 w-3"/> Follow-up
            </button>
          )}
        </div>
      </div>

      {latestFup&&(
        <div className={cls("px-4 py-3 border-t",closed?"border-slate-100":"border-slate-100")}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              {!closed&&latestFup.followup_date&&(
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Ic.Cal className="h-3.5 w-3.5 text-slate-400 shrink-0"/>
                  <span className={cls("text-[12px] font-semibold",dueCls(latestFup.followup_date))}>
                    {dueLabel(latestFup.followup_date)}{cardTime&&<span className="ml-1.5 text-slate-400 font-normal">· {cardTime}</span>}
                  </span>
                  {latestFup.contact_type&&<Tag className="bg-slate-100 text-slate-600 ring-slate-200">{latestFup.contact_type}</Tag>}
                </div>
              )}
              {closed&&latestFup.followup_date&&(
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Ic.Check className="h-3.5 w-3.5 text-emerald-500 shrink-0"/>
                  <span className="text-[12px] text-slate-500">{fmtD(latestFup.followup_date)} · {latestFup.contact_type}</span>
                </div>
              )}
              {latestFup.next_action&&!closed&&<p className="text-[12px] text-indigo-600 font-medium mb-1">→ {latestFup.next_action}</p>}
              {latestFup.remark&&<p className="text-[12px] text-slate-600 line-clamp-2">{latestFup.remark}</p>}
              {(latestFup.sample_status_update||latestFup.quotation_status_update)&&(
                <div className="mt-1 flex flex-wrap gap-2">
                  {latestFup.sample_status_update&&<span className="text-[11px] font-medium text-teal-600">Sample: {latestFup.sample_status_update}</span>}
                  {latestFup.quotation_status_update&&<span className="text-[11px] font-medium text-violet-600">Quote: {latestFup.quotation_status_update}</span>}
                </div>
              )}
            </div>
            {canEdit&&(
              <div className="flex gap-1 shrink-0">
                <button type="button" onClick={()=>setEditFup(latestFup)}
                  className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors">
                  <Ic.Edit className="h-3.5 w-3.5"/>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {!latestFup&&<div className="px-4 py-3 border-t border-slate-100"><p className="text-[12px] text-slate-400">No follow-ups yet.</p></div>}

      {allFups.length>1&&(
        <div className="border-t border-slate-100">
          <button type="button" onClick={()=>showLogs?setShowLogs(false):openLogs()}
            className="flex w-full items-center justify-between px-4 py-2 text-left hover:bg-slate-50 transition-colors">
            <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
              <Ic.History className="h-3.5 w-3.5"/> Activity log ({olderFups.length} older)
            </span>
            {showLogs?<Ic.ChevU className="h-3.5 w-3.5 text-slate-400"/>:<Ic.ChevD className="h-3.5 w-3.5 text-slate-400"/>}
          </button>
          <AnimatePresence>
            {showLogs&&(
              <motion.div initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}} transition={{duration:0.18}} className="overflow-hidden">
                <div className="px-4 pb-3 space-y-2">
                  {loadingFups?<p className="text-[12px] text-slate-400 py-2">Loading…</p>
                  :olderFups.map((fu,i)=>{
                    const time=extractTimeFromNotes(fu.notes);
                    const notes=cleanNotes(fu.notes);
                    return(
                      <div key={fu.id||i} className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[11px] text-slate-500 font-medium">{fmtD(fu.followup_date)}{time&&` · ${time}`}</span>
                            {fu.contact_type&&<Tag className="bg-slate-100 text-slate-600 ring-slate-200 text-[9px]">{fu.contact_type}</Tag>}
                            {fu.enquiry_status&&<Tag className={cls(ENQ_STATUS_CLS[fu.enquiry_status]||"","ring-1 ring-inset text-[9px]")}>{fu.enquiry_status}</Tag>}
                          </div>
                          {canEdit&&(
                            <div className="flex gap-0.5 shrink-0">
                              <button type="button" onClick={()=>setEditFup(fu)} className="grid h-6 w-6 place-items-center rounded text-slate-400 hover:text-indigo-600"><Ic.Edit className="h-3 w-3"/></button>
                              <button type="button" onClick={()=>deleteFup(fu.id)} disabled={deletingId===fu.id} className="grid h-6 w-6 place-items-center rounded text-slate-400 hover:text-rose-600 disabled:opacity-40"><Ic.Trash className="h-3 w-3"/></button>
                            </div>
                          )}
                        </div>
                        {fu.next_action&&<p className="mt-0.5 text-[11px] text-indigo-600">→ {fu.next_action}</p>}
                        {fu.remark&&<p className="mt-0.5 text-[11px] text-slate-600">{fu.remark}</p>}
                        {notes&&<p className="mt-0.5 text-[10px] text-slate-400">{notes}</p>}
                        <p className="mt-1 text-[10px] text-slate-300">{new Date(fu.created_at).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}</p>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {hasSampleOrQuote&&(
        <div className="border-t border-slate-100">
          <button type="button" onClick={()=>showCoordLogs?setShowCoordLogs(false):openCoordLogs()}
            className="flex w-full items-center justify-between px-4 py-2 text-left hover:bg-slate-50 transition-colors">
            <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
              <Ic.Package className="h-3.5 w-3.5"/> Sample &amp; Quotation Updates
            </span>
            {showCoordLogs?<Ic.ChevU className="h-3.5 w-3.5 text-slate-400"/>:<Ic.ChevD className="h-3.5 w-3.5 text-slate-400"/>}
          </button>
          <AnimatePresence>
            {showCoordLogs&&(
              <motion.div initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}} transition={{duration:0.18}} className="overflow-hidden">
                <div className="px-4 pb-3 space-y-2">
                  {loadingCoordLogs?<p className="text-[12px] text-slate-400 py-2">Loading…</p>:(
                    <>
                      {(coordLogs?.sample||[]).map((log,i)=>(
                        <div key={`s-${log.id||i}`} className="rounded-lg border border-teal-100 bg-teal-50/40 px-3 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <Tag className="bg-teal-50 text-teal-700 ring-teal-200 text-[9px]">Sample: {log.sample_status}</Tag>
                            {log.follow_up_date&&<span className="text-[10px] text-slate-400">{fmtD(log.follow_up_date)}</span>}
                          </div>
                          <p className="mt-1 text-[10px] text-slate-400">{log.users?.email||"—"} · {new Date(log.updated_at).toLocaleString("en-IN",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}</p>
                        </div>
                      ))}
                      {(coordLogs?.quotation||[]).map((log,i)=>(
                        <div key={`q-${log.id||i}`} className="rounded-lg border border-violet-100 bg-violet-50/40 px-3 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <Tag className="bg-violet-50 text-violet-700 ring-violet-200 text-[9px]">Quote: {log.quotation_status}</Tag>
                            {log.follow_up_date&&<span className="text-[10px] text-slate-400">{fmtD(log.follow_up_date)}</span>}
                          </div>
                          <p className="mt-1 text-[10px] text-slate-400">{log.users?.email||"—"} · {new Date(log.updated_at).toLocaleString("en-IN",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}</p>
                        </div>
                      ))}
                      {(coordLogs?.sample||[]).length===0&&(coordLogs?.quotation||[]).length===0&&<p className="text-[12px] text-slate-400 py-1">No updates yet.</p>}
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {showAddFup&&<AddFollowupModal rfq={rfq} token={token} onClose={()=>setShowAddFup(false)} onSaved={handleFupSaved}/>}
        {editFup&&<EditFollowupModal rfq={rfq} followup={editFup} token={token} onClose={()=>setEditFup(null)} onSaved={(saved)=>{handleFupEdited(saved);setEditFup(null);}}/>}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DETAIL PANEL
   — Prospect view: Edit icon in header, "Update Status" + Activity Log in body
   — Lead view: unchanged
═══════════════════════════════════════════════════════════════ */
function DetailPanel({item,user,token,rfqsForLead,onClose,onEdit,onDelete,onConverted,onEnquirySaved,onEnquiryUpdated,productsHook}){
  const isLead  = item._type==="lead";
  const isAdmin = user?.role==="Admin";
  const canEdit = isAdmin||item.created_by===user?.id;
  const routesHook=useRoutes();

  const[missingFields,setMissingFields]=useState([]);
  const[showAddEnq,setShowAddEnq]      =useState(false);
  const[showLeadForm,setShowLeadForm]  =useState(false);
  const[showUpdateStatus,setShowUpdateStatus]=useState(false);
  const[localItem,setLocalItem]        =useState(item);

  // Keep localItem in sync if parent item changes
  useEffect(()=>{ setLocalItem(item); },[item]);

  function handleAddEnquiry(){
    const m=missingForEnquiry(item);
    if(m.length){setMissingFields(m);return;}
    setMissingFields([]);
    setShowAddEnq(true);
  }

  const openRFQs=[...(rfqsForLead||[])].filter(r=>!isEnquiryClosed(r)).sort((a,b)=>{
    const aD=(a.rfq_followups||[]).filter(f=>!f.deleted_at).sort((x,y)=>new Date(x.followup_date)-new Date(y.followup_date))[0]?.followup_date||"9999";
    const bD=(b.rfq_followups||[]).filter(f=>!f.deleted_at).sort((x,y)=>new Date(x.followup_date)-new Date(y.followup_date))[0]?.followup_date||"9999";
    return aD.localeCompare(bD);
  });
  const closedRFQs=[...(rfqsForLead||[])].filter(r=>isEnquiryClosed(r));
  const sortedRFQs=[...openRFQs,...closedRFQs];

  const prospectTime  =!isLead?extractTimeFromFeedback(localItem.feedback):null;
  const prospectRemark=!isLead?cleanFeedback(localItem.feedback):null;

  // Edit icon shown in header for prospect (canEdit only)
  const headerExtra = !isLead&&canEdit ? (
    <button
      onClick={()=>{onEdit(localItem);onClose();}}
      title="Edit prospect"
      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-indigo-600 transition-colors">
      <Ic.Edit className="h-4 w-4"/>
    </button>
  ) : null;

  return(
    <Backdrop onClick={onClose}>
      <Sheet wide>
        <SheetHead
          title={localItem.company_name}
          subtitle={localItem.industry||localItem.nature_of_business||""}
          onClose={onClose}
          accent="bg-gradient-to-r from-white to-indigo-50/30"
          extraActions={headerExtra}
        />

        <div className="p-5 pb-4">
          {/* Tags row */}
          <div className="mb-4 flex flex-wrap gap-1.5">
            <Tag className={cls("ring-1 ring-inset",isLead?"bg-indigo-50 text-indigo-600 ring-indigo-200":"bg-teal-50 text-teal-600 ring-teal-200")}>{isLead?"Lead":"Prospect"}</Tag>
            {localItem.zone&&<Tag className="bg-sky-50 text-sky-700 ring-sky-200">{localItem.zone}</Tag>}
            {localItem.city&&<Tag>{localItem.city}</Tag>}
            {localItem.state&&<Tag className="bg-teal-50 text-teal-700 ring-teal-200">{localItem.state}</Tag>}
            {localItem.source&&<Tag className="bg-violet-50 text-violet-700 ring-violet-200">{localItem.source}</Tag>}
            {localItem.prospect_status&&<Tag className={cls(PROSPECT_STATUS_CLS[localItem.prospect_status]||"bg-slate-100 text-slate-500 ring-slate-200","ring-1 ring-inset")}>{localItem.prospect_status}</Tag>}
          </div>

          {/* Company info */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 mb-3">
            <DRow label="Industry / Type" value={localItem.industry||localItem.nature_of_business}/>
            <DRow label="Country"  value={localItem.country}/>
            <DRow label="State"    value={localItem.state}/>
            <DRow label="City"     value={localItem.city}/>
            <DRow label="Zone"     value={localItem.zone}/>
            <DRow label="Route"    value={localItem.route}/>
            {localItem.gst_number&&<DRow label="GST" value={localItem.gst_number} mono/>}
            {localItem.company_website&&<DRow label="Website" value={<a href={localItem.company_website} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline text-sm">{localItem.company_website}</a>}/>}
            {localItem.linkedin_profile&&<DRow label="LinkedIn" value={<a href={localItem.linkedin_profile} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline text-sm">View →</a>}/>}
            {isAdmin&&<DRow label="Added by" value={localItem.users?.email}/>}
            <DRow label="Created"  value={fmtD(localItem.created_at)}/>
          </div>

          {/* Prospect contact card */}
          {!isLead&&(localItem.contact_name||localItem.contact_phone||localItem.contact_email||localItem.contact_designation)&&(
            <div className="rounded-xl border border-sky-100 bg-sky-50/40 px-4 mb-3">
              <div className="flex items-center gap-2 border-b border-sky-100 py-2">
                <Ic.User className="h-3.5 w-3.5 text-sky-500"/>
                <span className="text-[11px] font-bold uppercase tracking-widest text-sky-600">Contact</span>
              </div>
              <DRow label="Name"        value={localItem.contact_name}/>
              <DRow label="Designation" value={localItem.contact_designation}/>
              <DRow label="Phone"       value={localItem.contact_phone} mono/>
              <DRow label="Email"       value={localItem.contact_email}/>
            </div>
          )}

          {/* Current action card (prospect only) */}
          {!isLead&&(localItem.next_action||localItem.next_action_date)&&(
            <div className="rounded-xl border border-amber-100 bg-amber-50/40 px-4 mb-3">
              <div className="flex items-center gap-2 border-b border-amber-100 py-2">
                <Ic.Zap className="h-3.5 w-3.5 text-amber-500"/>
                <span className="text-[11px] font-bold uppercase tracking-widest text-amber-600">Scheduled Action</span>
              </div>
              <DRow label="Action" value={localItem.next_action}/>
              {localItem.next_action_date&&(
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2 last:border-0">
                  <span className="text-xs font-medium text-slate-400 shrink-0">Due</span>
                  <span className={cls("text-right text-sm",dueCls(localItem.next_action_date))}>
                    {dueLabel(localItem.next_action_date)}{prospectTime&&<span className="font-normal text-slate-400"> · {prospectTime}</span>}
                  </span>
                </div>
              )}
              {prospectRemark&&<DRow label="Notes" value={prospectRemark}/>}
              {localItem.users?.email&&(
                <div className="flex items-center gap-1.5 py-2 border-t border-amber-50">
                  <Ic.User className="h-3 w-3 text-slate-300"/>
                  <span className="text-[10px] text-slate-400">Set by <span className="font-medium">{localItem.users.email}</span></span>
                </div>
              )}
            </div>
          )}

          {/* Activity log (prospect only) */}
          {!isLead&&(
            <ProspectActivityLog prospectId={localItem.id} token={token}/>
          )}

          {/* Lead sections */}
          {isLead&&(localItem.primary_contact_name||localItem.primary_phone)&&(
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 px-4 mb-3">
              <div className="flex items-center gap-2 border-b border-indigo-100 py-2"><Ic.User className="h-3.5 w-3.5 text-indigo-500"/><span className="text-[11px] font-bold uppercase tracking-widest text-indigo-600">Primary Contact</span></div>
              <DRow label="Name"        value={localItem.primary_contact_name}/>
              <DRow label="Designation" value={localItem.primary_designation}/>
              <DRow label="Phone"       value={localItem.primary_phone} mono/>
              <DRow label="Email"       value={localItem.primary_email}/>
            </div>
          )}
          {isLead&&localItem.secondary_contact_name&&(
            <div className="rounded-xl border border-violet-100 bg-violet-50/40 px-4 mb-3">
              <div className="flex items-center gap-2 border-b border-violet-100 py-2"><Ic.User className="h-3.5 w-3.5 text-violet-500"/><span className="text-[11px] font-bold uppercase tracking-widest text-violet-600">Secondary Contact</span></div>
              <DRow label="Name"        value={localItem.secondary_contact_name}/>
              <DRow label="Designation" value={localItem.secondary_designation}/>
              <DRow label="Phone"       value={localItem.secondary_phone} mono/>
              <DRow label="Email"       value={localItem.secondary_email}/>
            </div>
          )}

          {isLead&&(
            <div className="mt-1">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Enquiries ({sortedRFQs.length})</p>
                  {openRFQs.length>0&&<p className="text-[10px] text-slate-400">{openRFQs.length} active · {closedRFQs.length} closed</p>}
                </div>
                {canEdit&&(
                  <button type="button" onClick={handleAddEnquiry}
                    className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors">
                    <Ic.Plus className="h-3.5 w-3.5"/> Add Enquiry
                  </button>
                )}
              </div>

              {missingFields.length>0&&(
                <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <div className="flex items-start gap-2">
                    <Ic.Alert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5"/>
                    <div>
                      <p className="text-sm font-semibold text-amber-700 mb-1">Complete these fields first:</p>
                      <ul className="list-disc list-inside text-xs text-amber-700 space-y-0.5">{missingFields.map(f=><li key={f}>{f}</li>)}</ul>
                      <button onClick={()=>{onEdit(localItem);onClose();}} className="mt-2 text-xs font-semibold text-amber-700 underline flex items-center gap-1">Open Edit Form <Ic.ChevR className="h-3 w-3"/></button>
                    </div>
                  </div>
                </div>
              )}

              {sortedRFQs.length===0?(
                <div className="py-8 text-center rounded-xl border-2 border-dashed border-slate-200">
                  <Ic.FileT className="h-8 w-8 text-slate-200 mx-auto mb-2"/>
                  <p className="text-sm text-slate-400">No enquiries yet</p>
                </div>
              ):(
                sortedRFQs.map(rfq=>(
                  <EnquiryCard key={rfq.id} rfq={rfq} token={token} canEdit={canEdit}
                    onUpdated={(mode,rfqId,data)=>onEnquiryUpdated(mode,rfqId,data)}/>
                ))
              )}
            </div>
          )}

          {/* Bottom action bar */}
          {canEdit&&(
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4 mt-4">
              <button onClick={()=>onDelete(localItem)} className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors">
                <Ic.Trash className="h-3.5 w-3.5"/> Delete
              </button>
              <div className="flex-1"/>
              {!isLead&&(
                <>
                  <button onClick={()=>setShowLeadForm(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-teal-200 bg-white px-3 py-2 text-xs font-semibold text-teal-700 hover:bg-teal-50 transition-colors">
                    <Ic.ArrR className="h-3.5 w-3.5"/> Convert to Lead
                  </button>
                  <button onClick={()=>setShowUpdateStatus(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-600 transition-colors">
                    <Ic.Zap className="h-3.5 w-3.5"/> Update Status
                  </button>
                </>
              )}
              {isLead&&(
                <PBtn className="px-3 py-2 text-xs" onClick={()=>{onEdit(localItem);onClose();}}>
                  <Ic.Edit className="h-3.5 w-3.5"/> Edit Lead
                </PBtn>
              )}
            </div>
          )}
        </div>
      </Sheet>

      <AnimatePresence>
        {showAddEnq&&<AddEnquiryForm lead={localItem} token={token} productsHook={productsHook} onClose={()=>setShowAddEnq(false)} onSaved={onEnquirySaved}/>}
        {showLeadForm&&<LeadForm prospect={localItem} token={token} routesHook={routesHook} productsHook={productsHook}
          onClose={()=>setShowLeadForm(false)}
          onSaved={(lead)=>{onConverted(lead);onClose();}}
          onEnquirySaved={onEnquirySaved}
        />}
        {showUpdateStatus&&(
          <UpdateStatusModal
            prospect={localItem}
            token={token}
            onClose={()=>setShowUpdateStatus(false)}
            onSaved={(updated)=>{
              setLocalItem(p=>({...p,...updated}));
              // also bubble up so list row updates
              if(typeof onEdit==="function") {/* list update handled via onProspectSaved */}
            }}
          />
        )}
      </AnimatePresence>
    </Backdrop>
  );
}

/* ═══════════════════════════════════════════════════════════════
   LIST ROW
═══════════════════════════════════════════════════════════════ */
function ListRow({item,nearDate,contactType,onClick}){
  const isLead  = item._type==="lead";
  const overdue = isOverdue(nearDate);
  const today   = isToday(nearDate);
  const tomorrow= isTomorrow(nearDate);
  const initials= (item.company_name||"?").slice(0,2).toUpperCase();
  const avatarBg= isLead?"bg-gradient-to-br from-indigo-500 to-violet-600":"bg-gradient-to-br from-teal-400 to-emerald-500";
  const industry= item.industry||item.nature_of_business||"";
  const dateLabel= nearDate?(overdue?"Overdue":today?"Today":tomorrow?"Tomorrow":fmtD(nearDate)):null;
  const dateCls = overdue?"text-rose-500 font-bold":today?"text-amber-500 font-bold":tomorrow?"text-sky-600 font-medium":"text-slate-400";

  return(
    <button onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 active:bg-slate-100 border-b border-slate-100 last:border-0">
      <div className="relative shrink-0">
        <div className={cls("flex h-11 w-11 items-center justify-center rounded-full text-white text-[13px] font-bold shadow-sm",avatarBg)}>
          {initials}
        </div>
        <span
          title={isLead?"Lead":"Prospect"}
          className={cls(
            "absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white text-[7px] font-extrabold text-white",
            isLead?"bg-indigo-600":"bg-teal-500"
          )}>
          {isLead?"L":"P"}
        </span>
        {(overdue||today)&&<span className={cls("absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white",overdue?"bg-rose-500":"bg-amber-400")}/>}
      </div>

      <div className="min-w-0 flex-1">
        <span className="truncate block text-[14px] font-semibold text-slate-900 leading-snug">{item.company_name}</span>
        {/* line 2: industry + contact type tag, side by side, wraps gracefully */}
        <div className="mt-0.5 flex items-center gap-1.5 min-w-0">
          {industry&&<span className="truncate text-[11.5px] text-slate-400 shrink-0 max-w-[55%]">{industry}</span>}
          {industry&&contactType&&<span className="text-slate-300 text-[10px] shrink-0">•</span>}
          {contactType&&(
            <Tag className={cls(contactCls(contactType),"shrink-0")}>
              <ContactIcon type={contactType} className="mr-1 h-2.5 w-2.5"/>{contactType}
            </Tag>
          )}
        </div>
      </div>

      <div className="shrink-0 flex flex-col items-end gap-0.5">
        {dateLabel&&<span className={cls("text-[11px]",dateCls)}>{dateLabel}</span>}
        <Ic.ChevR className="h-3.5 w-3.5 text-slate-300"/>
      </div>
    </button>
  );
}


/* ═══════════════════════════════════════════════════════════════
   BOTTOM NAV
═══════════════════════════════════════════════════════════════ */
function BottomNav(){
  const items=[
    {id:"pipeline",  label:"Pipeline",   I:Ic.Layers, to:"/prospects"},
    {id:"followups", label:"Follow-ups", I:Ic.Bell,   to:"/followups"},
    {id:"products",  label:"Products",   I:Ic.Box,    to:"/products"},
    {id:"dashboard", label:"Dashboard",  I:Ic.Home,   to:"/dashboard"},
  ];
  const pathname=typeof window!=="undefined"?window.location.pathname:"";
  return(
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex lg:hidden border-t border-slate-200 bg-white/95 backdrop-blur-md safe-area-inset-bottom">
      {items.map(item=>{
        const I=item.I;
        const active=pathname===item.to||(item.to!=="/"&&pathname.startsWith(item.to));
        return(
          <Link key={item.id} to={item.to}
            className={cls("relative flex flex-1 flex-col items-center justify-center py-3 gap-0.5 transition-colors duration-200",
              active?"text-indigo-600":"text-slate-400 hover:text-slate-600")}>
            {active && <span className="absolute top-0 left-1/4 right-1/4 h-0.5 rounded-full bg-indigo-600"/>}
            <I className={cls("h-5 w-5 transition-transform duration-200",active?"text-indigo-600 scale-110":"")}/>
            <span className={cls("text-[10px] font-medium transition-colors duration-200",active?"text-indigo-600":"text-slate-400")}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/* ─── Filter pill constants ─────────────────────────────────── */
const TYPE_OPTS=[{v:"all",l:"All"},{v:"prospect",l:"Prospects"},{v:"lead",l:"Leads"}];
const DATE_OPTS=[{v:"all",l:"All"},{v:"overdue",l:"Overdue"},{v:"today",l:"Today"},{v:"tomorrow",l:"Tomorrow"},{v:"future",l:"Future"}];
const SQ_OPTS=[
  {v:"sample",l:"Sample"},
  {v:"quote",l:"Quotation"},
  {v:"customer",l:"Customer"},
];

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════ */
export default function ProspectsNew(){
  const{user,token}=useAuth();
  const isAdmin=user?.role==="Admin";
  const isSC = user?.role==="SalesCoordinator";

  const initialType = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("type") || "all";
  }, []);

  const routesHook  =useRoutes();
  const productsHook=useProducts();

  const[prospects,setProspects]=useState([]);
  const[leads,setLeads]        =useState([]);
  const[rfqMap,setRFQMap]      =useState({});
  const[loading,setLoading]    =useState(true);
  const[error,setError]        =useState("");

  const[search,setSearch]            =useState("");
  const[typeFilter,setTypeFilter]    =useState(initialType);
  const[dateFilter,setDateFilter]    =useState("all");
  const[sqFilter,setSqFilter]        =useState("all");
  const[selectedItem,setSelectedItem]=useState(null);
  const[showAddProspect,setShowAddProspect]=useState(false);
  const[editItem,setEditItem]        =useState(null);

  const fetchAll=useCallback(async()=>{
    setLoading(true);setError("");
    try{
      const[pJ,lJ,rJ]=await Promise.all([
        fetch(`${API}/api/prospects`,{headers:{Authorization:`Bearer ${token}`}}).then(r=>r.json()),
        fetch(`${API}/api/leads`,    {headers:{Authorization:`Bearer ${token}`}}).then(r=>r.json()),
        fetch(`${API}/api/rfqs`,     {headers:{Authorization:`Bearer ${token}`}}).then(r=>r.json()),
      ]);
      if(!pJ.success) throw new Error(pJ.message||"Prospects failed");
      if(!lJ.success) throw new Error(lJ.message||"Leads failed");
      setProspects(pJ.prospects||[]);
      setLeads(lJ.leads||[]);
      const map={};
      (rJ.rfqs||[]).forEach(rfq=>{
        if(!rfq.lead_id||rfq.deleted_at) return;
        if(!map[rfq.lead_id]) map[rfq.lead_id]=[];
        map[rfq.lead_id].push(rfq);
      });
      setRFQMap(map);
    }catch(e){setError(e.message);}
    finally{setLoading(false);}
  },[token]);

  useEffect(()=>{fetchAll();},[fetchAll]);

  const mergedList=useMemo(()=>{
    const linkedIds=new Set(leads.filter(l=>l.prospect_id).map(l=>l.prospect_id));
    const pItems=prospects.filter(p=>!linkedIds.has(p.id)).map(p=>({...p,_type:"prospect"}));
    const lItems=leads.map(l=>({...l,_type:"lead"}));
    return[...pItems,...lItems];
  },[prospects,leads]);

  const nearDateMap=useMemo(()=>{
    const m={};
    mergedList.forEach(item=>{
      m[item.id]=itemNearestDate(item,item._type==="lead"?(rfqMap[item.id]||[]):[]);
    });
    return m;
  },[mergedList,rfqMap]);

  const contactTypeMap = useMemo(() => {
  const m = {};
  mergedList.forEach(item => {
    m[item.id] = itemContactType(item, item._type === "lead" ? (rfqMap[item.id] || []) : []);
  });
  return m;
}, [mergedList, rfqMap]);

  const filtered=useMemo(()=>{
    let list=mergedList;
    if(typeFilter!=="all") list=list.filter(i=>i._type===typeFilter);
    if(dateFilter!=="all") list=list.filter(i=>{
      const d=nearDateMap[i.id];
      if(dateFilter==="overdue")  return isOverdue(d);
      if(dateFilter==="today")    return isToday(d);
      if(dateFilter==="tomorrow") return isTomorrow(d);
      if(dateFilter==="future")   return d&&isFuture(d);
      return true;
    });
    if(sqFilter!=="all") list=list.filter(i=>{
      if(i._type!=="lead") return false;
      const rfqs=rfqMap[i.id]||[];
      const hasSample=rfqs.some(r=>r.sample_required);
      const hasQuote =rfqs.some(r=>r.quotation_required);
      if(sqFilter==="sample")   return hasSample;
      if(sqFilter==="quote")    return hasQuote;
      if(sqFilter==="customer") return hasSample&&hasQuote;
      return true;
    });
    if(isSC) {
      list = list.filter(i => {
        if(i._type !== "lead") return false;
        const rfqs = rfqMap[i.id] || [];
        return rfqs.some(r => r.sample_required || r.quotation_required);
      });
    }
    if(search.trim()){
      const q=search.toLowerCase();
      list=list.filter(i=>
        i.company_name?.toLowerCase().includes(q)||
        i.industry?.toLowerCase().includes(q)||
        i.nature_of_business?.toLowerCase().includes(q)||
        i.city?.toLowerCase().includes(q)||
        i.state?.toLowerCase().includes(q)||
        i.zone?.toLowerCase().includes(q)||
        i.source?.toLowerCase().includes(q)||
        i.primary_contact_name?.toLowerCase().includes(q)||
        i.primary_phone?.includes(q)
      );
    }
    return [...list].sort((a,b)=>{
      const ad=nearDateMap[a.id]||"9999"; const bd=nearDateMap[b.id]||"9999";
      return ad.localeCompare(bd);
    });
  },[mergedList,typeFilter,dateFilter,sqFilter,search,nearDateMap,rfqMap]);

  function openDetail(item){ setSelectedItem(item); }

  async function handleDelete(item){
    if(!window.confirm(`Delete "${item.company_name}"?`)) return;
    const url=item._type==="lead"?`${API}/api/leads/${item.id}`:`${API}/api/prospects/${item.id}`;
    try{
      const r=await fetch(url,{method:"DELETE",headers:{Authorization:`Bearer ${token}`}});
      if(!r.ok) throw new Error("Delete failed");
      if(item._type==="lead") setLeads(p=>p.filter(l=>l.id!==item.id));
      else setProspects(p=>p.filter(pr=>pr.id!==item.id));
      setSelectedItem(null);
    }catch(e){alert(e.message);}
  }

  function openEdit(item){ setEditItem(item); setSelectedItem(null); }

  function onProspectSaved(prospect,isEdit){
    if(isEdit) setProspects(p=>p.map(pr=>pr.id===prospect.id?{...pr,...prospect}:pr));
    else setProspects(p=>[prospect,...p]);
  }
  function onLeadSaved(lead,isEdit){
    if(isEdit) setLeads(p=>p.map(l=>l.id===lead.id?{...l,...lead}:l));
    else setLeads(p=>[lead,...p]);
  }
  function onConverted(lead){
    setLeads(p=>[lead,...p]);
    fetchAll();
  }
  function onEnquirySaved(newRFQ){
    setRFQMap(p=>({...p,[newRFQ.lead_id]:[newRFQ,...(p[newRFQ.lead_id]||[])]}));
  }
  function onEnquiryUpdated(mode,rfqId,data){
    setRFQMap(p=>{
      const leadId=Object.keys(p).find(k=>p[k].some(r=>r.id===rfqId));
      if(!leadId) return p;
      const arr=p[leadId].map(rfq=>{
        if(rfq.id!==rfqId) return rfq;
        let fups=[...(rfq.rfq_followups||[])];
        if(mode==="new") fups=[data,...fups];
        else if(mode==="edit") fups=fups.map(f=>f.id===data.id?data:f);
        else if(mode==="deleteFup") fups=fups.filter(f=>f.id!==data);
        return{...rfq,rfq_followups:fups};
      });
      return{...p,[leadId]:arr};
    });
  }

  useEffect(()=>{
    if(selectedItem&&selectedItem._type==="lead"){
      const fresh=rfqMap[selectedItem.id];
      if(fresh) setSelectedItem(p=>p?{...p,_rfqs:fresh}:p);
    }
  },[rfqMap]);// eslint-disable-line

  const pCount      =mergedList.filter(i=>i._type==="prospect").length;
  const lCount      =mergedList.filter(i=>i._type==="lead").length;
  const overdueCount=mergedList.filter(i=>isOverdue(nearDateMap[i.id])).length;
  const hasFilters  =typeFilter!=="all"||dateFilter!=="all"||sqFilter!=="all"||search.trim();

  function clearFilters(){ setSearch(""); setTypeFilter("all"); setDateFilter("all"); setSqFilter("all"); }

  return(
    <div className="min-h-screen bg-slate-50 lg:bg-gradient-to-br lg:from-slate-50 lg:via-white lg:to-indigo-50/30">

      {/* ══ MOBILE/TABLET ══ */}
      <div className="lg:hidden flex flex-col h-screen pb-20">
        <div className="sticky top-0 z-30 bg-white border-b border-slate-100 shadow-sm">
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-slate-900">Pipeline</h1>
              <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                <span className="text-[11px] text-teal-600 font-semibold">{pCount} prospects</span>
                <span className="text-slate-300">·</span>
                <span className="text-[11px] text-indigo-600 font-semibold">{lCount} leads</span>
                {overdueCount>0&&<><span className="text-slate-300">·</span><span className="text-[11px] text-rose-500 font-semibold animate-pulse">{overdueCount} overdue</span></>}
              </div>
            </div>
          </div>
          <div className="px-4 pb-2">
            <div className="relative">
              <Ic.Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search company, city, product…"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-10 text-sm placeholder:text-slate-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:bg-white transition-all"/>
              {search&&<button onClick={()=>setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-slate-500 hover:bg-slate-300"><Ic.X className="h-3 w-3"/></button>}
            </div>
          </div>
          <div className="px-4 pb-3 space-y-2">
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar" style={{
                WebkitOverflowScrolling: "touch",
                overscrollBehaviorX: "contain",
              }}
>
              {TYPE_OPTS.map(f=>(
                <button key={f.v} onClick={()=>setTypeFilter(f.v)}
                  className={cls("shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-all",typeFilter===f.v?"bg-indigo-600 text-white shadow-sm":"bg-slate-100 text-slate-600 hover:bg-slate-200")}>
                  {f.l}
                </button>
              ))}
              {SQ_OPTS.map(f=>(
                <button key={f.v} onClick={()=>setSqFilter(f.v)}
                  className={cls("shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-all",
                    sqFilter===f.v?"bg-teal-500 text-white":"bg-slate-100 text-slate-600 hover:bg-slate-200")}>
                  {f.l}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
              {DATE_OPTS.map(f=>(
                <button key={f.v} onClick={()=>setDateFilter(f.v)}
                  className={cls("shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-all",
                    dateFilter===f.v?f.v==="overdue"?"bg-rose-500 text-white":f.v==="today"?"bg-amber-500 text-white":f.v==="tomorrow"?"bg-sky-500 text-white":"bg-indigo-600 text-white"
                    :"bg-slate-100 text-slate-600 hover:bg-slate-200")}>
                  {f.l}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-white">
          {loading?(
            <div className="divide-y divide-slate-100">{Array.from({length:12}).map((_,i)=>(
              <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
                <div className="h-11 w-11 rounded-full bg-slate-100 shrink-0"/>
                <div className="flex-1"><div className="h-3.5 w-1/2 rounded-full bg-slate-100 mb-2"/><div className="h-3 w-1/3 rounded-full bg-slate-100"/></div>
                <div className="h-3 w-14 rounded-full bg-slate-100"/>
              </div>
            ))}</div>
          ):error?(
            <div className="p-5 m-4 rounded-2xl border border-rose-100 bg-rose-50 text-sm text-rose-700">{error}</div>
          ):filtered.length===0?(
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
              <Ic.Radar className="h-12 w-12 text-slate-200 mb-4"/>
              <p className="text-sm font-semibold text-slate-600">{hasFilters?"No matching records":"No records yet"}</p>
              <p className="text-xs text-slate-400 mt-1">{hasFilters?"Adjust search or filters":"Add a prospect to get started"}</p>
              {hasFilters&&<button onClick={clearFilters} className="mt-3 text-xs font-semibold text-indigo-600 hover:underline">Clear filters</button>}
            </div>
          ):(
            <div>{filtered.map(item=>
              <ListRow
                key={`${item._type}-${item.id}`}
                item={item}
                nearDate={nearDateMap[item.id]}
                contactType={contactTypeMap[item.id]}
                onClick={()=>openDetail(item)}
              />
            )}</div>
          )}
        </div>

        {!isSC && (
        <motion.button whileTap={{scale:0.92}} onClick={()=>setShowAddProspect(true)}
          className="fixed bottom-20 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-xl shadow-indigo-300/60 hover:bg-indigo-700">
          <Ic.Plus className="h-6 w-6"/>
        </motion.button>
        )}
      </div>

      {/* ══ DESKTOP ══ */}
      <div className="hidden lg:block">
        <div className="relative mx-auto max-w-6xl px-5 py-7 lg:px-8 lg:py-9">
          <div className="pointer-events-none fixed inset-0 overflow-hidden">
            <div className="absolute -right-32 -top-32 h-80 w-80 rounded-full bg-indigo-100/40 blur-3xl"/>
            <div className="absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-violet-100/30 blur-3xl"/>
          </div>
          <div className="relative mb-6 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Pipeline</h1>
              <p className="mt-1 text-sm text-slate-500">
                {isAdmin?"All prospects & leads":"Your pipeline"}
                <span className="mx-1.5 text-slate-300">·</span>
                <span className="font-semibold text-teal-600">{pCount} prospects</span>
                <span className="mx-1.5 text-slate-300">·</span>
                <span className="font-semibold text-indigo-600">{lCount} leads</span>
                {overdueCount>0&&<><span className="mx-1.5 text-slate-300">·</span><span className="font-semibold text-rose-500">{overdueCount} overdue</span></>}
              </p>
            </div>
            <PBtn onClick={()=>setShowAddProspect(true)}><Ic.Plus className="h-4 w-4"/> Add Prospect</PBtn>
          </div>

          <div className="mb-6 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
              <div className="relative flex-1">
                <Ic.Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search company, contact, city, product, source…"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-9 text-sm placeholder:text-slate-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:bg-white transition-all"/>
                {search&&<button onClick={()=>setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-slate-500 hover:bg-slate-300 transition-colors"><Ic.X className="h-3 w-3"/></button>}
              </div>
              {hasFilters&&<button onClick={clearFilters} className="shrink-0 flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 transition-colors"><Ic.X className="h-3.5 w-3.5"/> Clear</button>}
            </div>
            <div className="flex items-center gap-4 px-4 py-2.5 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Type</span>
                {TYPE_OPTS.map(f=>(
                  <button key={f.v} onClick={()=>setTypeFilter(f.v)}
                    className={cls("rounded-full px-3 py-1.5 text-[12px] font-semibold transition-all",typeFilter===f.v?"bg-indigo-600 text-white":"text-slate-500 hover:bg-slate-100")}>
                    {f.l}
                  </button>
                ))}
              </div>
              <div className="h-4 w-px bg-slate-200 hidden sm:block"/>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Due</span>
                {DATE_OPTS.map(f=>(
                  <button key={f.v} onClick={()=>setDateFilter(f.v)}
                    className={cls("rounded-full px-3 py-1.5 text-[12px] font-semibold transition-all",
                      dateFilter===f.v?f.v==="overdue"?"bg-rose-500 text-white":f.v==="today"?"bg-amber-500 text-white":f.v==="tomorrow"?"bg-sky-500 text-white":"bg-indigo-600 text-white"
                      :"text-slate-500 hover:bg-slate-100")}>
                    {f.l}
                  </button>
                ))}
              </div>
              <div className="h-4 w-px bg-slate-200 hidden sm:block"/>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">S/Q</span>
                {SQ_OPTS.map(f=>(
                  <button key={f.v} onClick={()=>setSqFilter(f.v)}
                    className={cls("rounded-full px-3 py-1.5 text-[12px] font-semibold transition-all",
                      sqFilter===f.v?"bg-teal-500 text-white":"text-slate-500 hover:bg-slate-100")}>
                    {f.l}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {loading?(
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({length:8}).map((_,i)=>(
                <div key={i} className="h-52 animate-pulse rounded-2xl border border-slate-100 bg-white p-4">
                  <div className="mb-2 h-4 w-1/2 rounded-lg bg-slate-100"/><div className="mb-4 h-3 w-1/3 rounded-lg bg-slate-100"/>
                  <div className="mt-3 flex gap-2"><div className="h-5 w-16 rounded-full bg-slate-100"/><div className="h-5 w-14 rounded-full bg-slate-100"/></div>
                </div>
              ))}
            </div>
          ):error?(
            <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-4 text-sm text-rose-700">{error}</div>
          ):(
            <motion.div layout className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <AnimatePresence mode="popLayout">
                {filtered.length===0?(
                  <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white/50 px-6 py-20 text-center">
                    <Ic.Radar className="h-10 w-10 text-slate-300 mb-3"/>
                    <p className="text-sm font-semibold text-slate-600">{hasFilters?"No matching records":"No records yet"}</p>
                    {hasFilters&&<button onClick={clearFilters} className="mt-2 text-xs font-semibold text-indigo-600 hover:underline">Clear filters</button>}
                  </div>
                ):filtered.map((item,i)=>{
                  const isLead=item._type==="lead";
                  const nd=nearDateMap[item.id];
                  const ov=isOverdue(nd);const td=isToday(nd);const tm=isTomorrow(nd);
                  const rfqs=rfqMap[item.id]||[];
                  const hasSample=rfqs.some(r=>r.sample_required);
                  const hasQuote=rfqs.some(r=>r.quotation_required);
                  const contactType=contactTypeMap[item.id];   // ← add this line
                  return(
                    <motion.article key={`${item._type}-${item.id}`} layout
                      initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} exit={{opacity:0,scale:0.95}}
                      transition={{duration:0.22,delay:Math.min(i*0.025,0.3)}}
                      onClick={()=>openDetail(item)}
                      className="group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-100/40">
                      <div className={cls("h-1 w-full",isLead?"bg-gradient-to-r from-indigo-500 to-violet-600":"bg-gradient-to-r from-teal-400 to-emerald-500")}/>
                      <div className="flex flex-1 flex-col p-4">
                        <div className="flex items-start gap-2 mb-2">
                          <div className="min-w-0 flex-1">
                            <span className={cls("text-[9px] font-bold uppercase px-1.5 py-px rounded-full ring-1 ring-inset",isLead?"bg-indigo-50 text-indigo-600 ring-indigo-200":"bg-teal-50 text-teal-600 ring-teal-200")}>{isLead?"Lead":"Prospect"}</span>
                            <h3 className="mt-1 truncate text-[15px] font-bold text-slate-900">{item.company_name}</h3>
                            <p className="truncate text-[12px] text-slate-400">{item.industry||item.nature_of_business||""}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {item.city&&<Tag><Ic.Pin className="mr-1 inline h-2.5 w-2.5"/>{item.city}</Tag>}
                          {item.source&&<Tag className="bg-violet-50 text-violet-700 ring-violet-200">{item.source}</Tag>}
                          {contactType&&(
                            <Tag className={contactCls(contactType)}>
                              <ContactIcon type={contactType} className="mr-1 inline h-2.5 w-2.5"/>{contactType}
                            </Tag>
                          )}
                          {isLead&&hasSample&&<Tag className="bg-teal-50 text-teal-700 ring-teal-200">Sample</Tag>}
                          {isLead&&hasQuote&&<Tag className="bg-violet-50 text-violet-700 ring-violet-200">Quote</Tag>}
                        </div>
                        <div className="flex-1 space-y-1.5 border-t border-slate-100 pt-3">
                          {nd&&<div className="flex items-center gap-1.5"><Ic.Cal className="h-3.5 w-3.5 text-slate-400 shrink-0"/><span className={cls("text-[12px] font-medium",ov?"text-rose-500":td?"text-amber-500":tm?"text-sky-600":"text-slate-500")}>{ov?"Overdue":td?"Today":tm?"Tomorrow":fmtD(nd)}</span></div>}
                          {item.primary_contact_name&&<div className="flex items-center gap-1.5"><Ic.User className="h-3.5 w-3.5 text-slate-400 shrink-0"/><span className="text-[12px] text-slate-500 truncate">{item.primary_contact_name}</span></div>}
                          {item.next_action&&<div className="flex items-center gap-1.5"><Ic.Zap className="h-3.5 w-3.5 text-amber-400 shrink-0"/><span className="text-[12px] text-slate-500 truncate">{item.next_action}</span></div>}
                        </div>
                        <div className="mt-3 flex items-center justify-end border-t border-slate-100 pt-3">
                          <span className="flex items-center gap-1 text-[12px] font-semibold text-indigo-500 opacity-0 transition-opacity group-hover:opacity-100">View details <Ic.ChevR className="h-3 w-3"/></span>
                        </div>
                      </div>
                    </motion.article>
                  );
                })}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
      </div>

      <BottomNav/>

      <AnimatePresence>
        {selectedItem&&(
          <DetailPanel
            item={selectedItem} user={user} token={token}
            rfqsForLead={selectedItem._type==="lead"?(rfqMap[selectedItem.id]||[]):[]}
            onClose={()=>setSelectedItem(null)}
            onEdit={openEdit}
            onDelete={handleDelete}
            onConverted={onConverted}
            onEnquirySaved={onEnquirySaved}
            onEnquiryUpdated={onEnquiryUpdated}
            productsHook={productsHook}
          />
        )}
        {showAddProspect&&(
          <ProspectForm token={token} routesHook={routesHook}
            onClose={()=>setShowAddProspect(false)} onSaved={onProspectSaved}/>
        )}
        {editItem&&editItem._type==="prospect"&&(
          <ProspectForm initial={editItem} token={token} routesHook={routesHook}
            onClose={()=>setEditItem(null)}
            onSaved={(p,isEdit)=>{onProspectSaved(p,isEdit);setEditItem(null);}}/>
        )}
        {editItem&&editItem._type==="lead"&&(
          <LeadForm initial={editItem} token={token} routesHook={routesHook} productsHook={productsHook}
            onClose={()=>setEditItem(null)}
            onSaved={(l,isEdit)=>{onLeadSaved(l,isEdit);setEditItem(null);}}
            onEnquirySaved={onEnquirySaved}
          />
        )}
      </AnimatePresence>
    </div>
  );
}