// MyTasks.jsx — v5
// Changes from v4:
//  1. Backend now returns ALL records (including terminal); frontend handles completed tab
//  2. Filter status dropdown renders via fixed-position portal — never clipped
//  3. resolvedEnquiry/resolvedCoord never reset on refresh — completed stays visible
//  4. fetchAll merges new data into existing lists preserving completed records
//  5. Filter pills row uses horizontal scroll, not flex-wrap

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

const NEXT_ACTIONS = [
  "Quotation to be Submitted","Sample to be Submitted","Sample to be Tried","Follow-up",
  "Price Negotiation","Send Product Details","Collect Sample Feedback",
  "Collect Quotation Feedback","Order Confirmation","Purchase Order Follow-up",
  "Payment Follow-up","Dispatch Material","Close Enquiry","No Further Action","Other",
];
const CONTACT_TYPES      = ["Call","Email","WhatsApp","Visit","Meeting"];
const SAMPLE_STATUSES    = ["Pending","Sent to Customer","Received from Customer","Approved","Rejected"];
const QUOTATION_STATUSES = ["Pending","In Preparation","Sent to Customer","Under Review","Accepted","Rejected"];

/* Terminal states — anything here counts as "completed" */
const ENQUIRY_TERMINAL = new Set(["Won","Lost"]);
const SAMPLE_TERMINAL  = new Set(["Approved","Rejected"]);
const QUOTE_TERMINAL   = new Set(["Accepted","Rejected"]);

const STATUS_OPTS = [{v:"all",l:"All"},{v:"pending",l:"Pending"},{v:"completed",l:"Completed"}];
const DUE_OPTS    = [{v:"all",l:"All"},{v:"overdue",l:"Overdue"},{v:"today",l:"Today"},{v:"tomorrow",l:"Tomorrow"},{v:"future",l:"Future"}];

/* Filter options for enquiry section — based on next_action field */
const ENQ_NEXT_ACTION_FILTER_OPTS = [
  {v:"all",                        l:"All"},
  {v:"Follow-up",                  l:"Follow-up"},
  {v:"Sample to be Submitted",     l:"Sample to Submit"},
  {v:"Sample to be Tried",         l:"Sample to Try"},
  {v:"Collect Sample Feedback",    l:"Sample Feedback"},
  {v:"Quotation to be Submitted",  l:"Quote to Submit"},
  {v:"Collect Quotation Feedback", l:"Quote Feedback"},
  {v:"Price Negotiation",          l:"Price Negotiation"},
  {v:"Send Product Details",       l:"Send Details"},
  {v:"Order Confirmation",         l:"Order Confirm"},
  {v:"Purchase Order Follow-up",   l:"PO Follow-up"},
  {v:"Payment Follow-up",          l:"Payment Follow-up"},
  {v:"Dispatch Material",          l:"Dispatch"},
  {v:"Close Enquiry",              l:"Close Enquiry"},
  {v:"No Further Action",          l:"No Further Action"},
  {v:"Other",                      l:"Other"},
];
const SAMPLE_STATUS_FILTER_OPTS = [
  {v:"all",l:"All"},{v:"Pending",l:"Pending"},{v:"Sent to Customer",l:"Sent"},
  {v:"Received from Customer",l:"Received"},{v:"Approved",l:"Approved"},{v:"Rejected",l:"Rejected"},
];
const QUOTE_STATUS_FILTER_OPTS = [
  {v:"all",l:"All"},{v:"Pending",l:"Pending"},{v:"In Preparation",l:"In Prep"},
  {v:"Sent to Customer",l:"Sent"},{v:"Under Review",l:"Under Review"},
  {v:"Accepted",l:"Accepted"},{v:"Rejected",l:"Rejected"},
];

/* ─── Icons ──────────────────────────────────────────────────── */
const Ic = {
  Cal:     p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  Clock:   p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>,
  User:    p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  Phone:   p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>,
  Pin:     p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  Check:   p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><polyline points="20,6 9,17 4,12"/></svg>,
  X:       p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>,
  Trophy:  p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0V4z"/><path d="M7 5H4a2 2 0 002 4M17 5h3a2 2 0 01-2 4"/></svg>,
  Flag:    p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M4 22V4a1 1 0 011-1c2 0 3 1 6 1s4-1 6-1a1 1 0 011 1v10c0 1-1 1-3 1s-4-1-6-1-4 1-6 1"/></svg>,
  ArrR:    p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>,
  Box:     p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>,
  Receipt: p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1z"/><path d="M9 7h6M9 11h6M9 15h4"/></svg>,
  Empty:   p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6v6H9z"/></svg>,
  Search:  p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>,
  Layers:  p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><polygon points="12,2 2,7 12,12 22,7 12,2"/><polyline points="2,17 12,22 22,17"/><polyline points="2,12 12,17 22,12"/></svg>,
  Home:    p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>,
  Bell:    p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg>,
  ChevD:   p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><polyline points="6,9 12,15 18,9"/></svg>,
  Refresh: p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><polyline points="23,4 23,10 17,10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>,
  Zap:     p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><polygon points="13,2 3,14 12,14 11,22 21,10 12,10 13,2"/></svg>,
  MsgSq:   p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  Mail:    p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
  Visit:   p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  Meet:    p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
  Sparkle: p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>,
  Filter:  p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><polygon points="22,3 2,3 10,12.46 10,19 14,21 14,12.46 22,3"/></svg>,
};

/* ─── Helpers ────────────────────────────────────────────────── */
function cls(...a){ return a.filter(Boolean).join(" "); }
function inp(extra=""){
  return cls("w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 hover:border-slate-300",extra);
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

function todayMidnight(){ const d=new Date(); d.setHours(0,0,0,0); return d; }
function parseDate(d){ if(!d) return null; return new Date(d.split("T")[0]); }
function isOverdue(d){ const p=parseDate(d); return p&&p<todayMidnight(); }
function isToday(d){ const p=parseDate(d); return p&&p.toDateString()===todayMidnight().toDateString(); }
function isFuture(d){ const p=parseDate(d); return p&&p>todayMidnight()&&!isToday(d); }
function isTomorrow(d){
  const p=parseDate(d); if(!p) return false;
  const t=new Date(todayMidnight()); t.setDate(t.getDate()+1);
  return p.toDateString()===t.toDateString();
}
function dueBadge(d){
  if(isOverdue(d)) return <Tag className="bg-rose-50 text-rose-700 ring-rose-200">Overdue</Tag>;
  if(isToday(d))   return <Tag className="bg-amber-50 text-amber-700 ring-amber-200">Today</Tag>;
  if(isTomorrow(d))return <Tag className="bg-sky-50 text-sky-700 ring-sky-200">Tomorrow</Tag>;
  if(isFuture(d))  return <Tag className="bg-slate-100 text-slate-500 ring-slate-200">Upcoming</Tag>;
  return null;
}
function fmtD(d){ if(!d) return null; return new Date(d).toLocaleDateString("en-IN",{day:"numeric",month:"short"}); }
function fmtDT(d){ if(!d) return null; return new Date(d).toLocaleString("en-IN",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}); }
function todayStr(){ return new Date().toISOString().slice(0,10); }

function extractTime(notes){
  if(!notes) return null;
  const m=notes.match(/\[Time:\s*(\d{2}:\d{2})\]/);
  return m?m[1]:null;
}
function fmt12(t){
  if(!t) return null;
  const[h,m]=t.split(":").map(Number);
  return `${h%12||12}:${String(m).padStart(2,"0")} ${h>=12?"PM":"AM"}`;
}

/* terminal checks against server data */
function isEnquiryTerminal(task){
  const lf=task.latest_followup||{};
  return ENQUIRY_TERMINAL.has(lf.enquiry_status);
}
function isSampleTerminal(task){ return SAMPLE_TERMINAL.has(task.sample_status); }
function isQuoteTerminal(task) { return QUOTE_TERMINAL.has(task.quotation_status); }

/* next action suggestion */
function suggestNextAction(sampleRequired,quotationRequired,sampleStatus,quotationStatus){
  if(sampleRequired&&sampleStatus){
    if(sampleStatus==="Pending"||sampleStatus==="Sent to Customer") return "Sample to be Tried";
    if(sampleStatus==="Received from Customer") return "Collect Sample Feedback";
    if(sampleStatus==="Approved") return quotationRequired?"Quotation to be Submitted":"Order Confirmation";
    if(sampleStatus==="Rejected") return "Follow-up";
  }
  if(quotationRequired&&quotationStatus){
    if(quotationStatus==="Pending"||quotationStatus==="In Preparation") return "Quotation to be Submitted";
    if(quotationStatus==="Sent to Customer") return "Collect Quotation Feedback";
    if(quotationStatus==="Under Review")     return "Price Negotiation";
    if(quotationStatus==="Accepted")         return "Order Confirmation";
    if(quotationStatus==="Rejected")         return "Follow-up";
  }
  if(sampleRequired&&!sampleStatus)       return "Sample to be Submitted";
  if(quotationRequired&&!quotationStatus) return "Quotation to be Submitted";
  return "Follow-up";
}

function ContactIcon({type,className="h-3 w-3"}){
  switch((type||"").toLowerCase()){
    case "call":     return <Ic.Phone   className={className}/>;
    case "email":    return <Ic.Mail    className={className}/>;
    case "whatsapp": return <Ic.MsgSq   className={className}/>;
    case "visit":    return <Ic.Visit   className={className}/>;
    case "meeting":  return <Ic.Meet    className={className}/>;
    default:         return <Ic.Phone   className={className}/>;
  }
}
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

/* Sort key: pending → asc by date+time, completed → desc by resolvedAt */
function buildSortKey(date,time,isResolved,resolvedAt){
  if(isResolved){
    const ts=resolvedAt?new Date(resolvedAt).getTime():0;
    return `1_${String(9999999999999-ts).padStart(16,"0")}`;
  }
  return `0_${date||"9999-12-31"}_${time||"23:59"}`;
}

/* ─── Animation variants ─────────────────────────────────────── */
const cardVariants={
  hidden:{opacity:0,y:12,scale:0.98},
  visible:{opacity:1,y:0,scale:1,transition:{duration:0.22,ease:[0.16,1,0.3,1]}},
  exit:{opacity:0,y:-6,scale:0.97,transition:{duration:0.16}},
};
const panelVariants={
  hidden:{height:0,opacity:0,y:-4},
  visible:{height:"auto",opacity:1,y:0,transition:{duration:0.22,ease:[0.16,1,0.3,1]}},
  exit:{height:0,opacity:0,y:-4,transition:{duration:0.18}},
};
const slideLeft={hidden:{opacity:0,x:-14},visible:{opacity:1,x:0,transition:{duration:0.18,ease:[0.16,1,0.3,1]}},exit:{opacity:0,x:-14,transition:{duration:0.12}}};
const slideRight={hidden:{opacity:0,x:14},visible:{opacity:1,x:0,transition:{duration:0.18,ease:[0.16,1,0.3,1]}},exit:{opacity:0,x:14,transition:{duration:0.12}}};

/* ═══════════════════════════════════════════════════════════════
   PORTAL STATUS DROPDOWN
   Renders into document.body so it's never clipped by any parent
═══════════════════════════════════════════════════════════════ */
function StatusDropdown({opts,value,onChange,label}){
  const [open,setOpen]=useState(false);
  const btnRef=useRef(null);
  const menuRef=useRef(null);
  const [pos,setPos]=useState({top:0,left:0,width:160});

function toggle(){
  if(!open&&btnRef.current){
    const r=btnRef.current.getBoundingClientRect();
    const spaceBelow=window.innerHeight - r.bottom;
    const spaceAbove=r.top;
    const menuH=Math.min(opts.length*40+8, 320);
    const openUp=spaceBelow < menuH && spaceAbove > spaceBelow;
    setPos({
      top:    openUp ? undefined : r.bottom + 4,
      bottom: openUp ? window.innerHeight - r.top + 4 : undefined,
      left:   r.left,
      width:  Math.max(180, r.width),
      maxH:   Math.min(openUp ? spaceAbove - 8 : spaceBelow - 8, 320),
    });
  }
  setOpen(v=>!v);
}
  // Close on click outside — use 'click' (not 'mousedown') so option onClick fires first
  useEffect(()=>{
    if(!open) return;
    function handle(e){
      if(
        btnRef.current && btnRef.current.contains(e.target) ||
        menuRef.current && menuRef.current.contains(e.target)
      ) return;
      setOpen(false);
    }
    // small delay so the toggle click doesn't immediately re-close
    const t=setTimeout(()=>document.addEventListener("click",handle),10);
    return ()=>{ clearTimeout(t); document.removeEventListener("click",handle); };
  },[open]);

  const active=value!=="all";
  const activeLabel=active?(opts.find(o=>o.v===value)?.l||value):label;

  return(
    <>
      <button ref={btnRef} onClick={toggle}
        className={cls(
          "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all duration-150 whitespace-nowrap",
          active?"bg-slate-700 text-white":"text-slate-500 hover:bg-slate-100"
        )}>
        <Ic.Filter className="h-3 w-3 shrink-0"/>
        <span className="truncate max-w-[100px]">{activeLabel}</span>
        <Ic.ChevD className="h-3 w-3 shrink-0"/>
      </button>

      {open&&createPortal(
        <div
          ref={menuRef}
          style={{
            position:"fixed",
            top:pos.top,
            bottom:pos.bottom,
            left:pos.left,
            minWidth:pos.width,
            maxHeight:pos.maxH,
            zIndex:99999,
          }}
          className="rounded-xl border border-slate-200 bg-white shadow-2xl overflow-y-auto">
          {opts.map(o=>(
            <button
              key={o.v}
              onMouseDown={e=>e.preventDefault()} /* prevent blur/close before click */
              onClick={()=>{ onChange(o.v); setOpen(false); }}
              className={cls(
                "flex w-full items-center gap-2 px-3 py-2.5 text-[12px] text-left transition-colors",
                value===o.v?"bg-indigo-50 text-indigo-700 font-semibold":"text-slate-600 hover:bg-slate-50"
              )}>
              {value===o.v
                ?<Ic.Check className="h-3 w-3 shrink-0 text-indigo-600"/>
                :<span className="h-3 w-3 shrink-0"/>}
              {o.l}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   FILTER BAR
═══════════════════════════════════════════════════════════════ */
const DUE_ACCENTS={
  overdue:"bg-rose-500 text-white",today:"bg-amber-500 text-white",
  tomorrow:"bg-sky-500 text-white",future:"bg-indigo-600 text-white",all:"bg-indigo-600 text-white",
};

function FilterBar({
  search,onSearch,status,onStatus,due,onDue,placeholder,
  type,onType,typeOpts,
  statusFilter,onStatusFilter,statusFilterOpts,statusFilterLabel="Status",
}){
  return(
    <div className="mb-3 rounded-2xl border border-slate-200 bg-white shadow-sm">

      {/* Search */}
      <div className="flex items-center gap-3 px-3.5 py-2.5 border-b border-slate-100">
        <div className="relative flex-1">
          <Ic.Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"/>
          <input value={search} onChange={e=>onSearch(e.target.value)} placeholder={placeholder}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-8 text-[13px] placeholder:text-slate-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:bg-white transition-all"/>
          <AnimatePresence>
            {search&&(
              <motion.button initial={{opacity:0,scale:0.7}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:0.7}}
                onClick={()=>onSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 text-slate-500 hover:bg-slate-300">
                <Ic.X className="h-2.5 w-2.5"/>
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Row 1: Pending/Completed + Due date pills */}
      <div className="flex items-center gap-1 px-3.5 py-2 overflow-x-auto no-scrollbar border-b border-slate-100">
        {STATUS_OPTS.map(f=>(
          <button key={f.v} onClick={()=>onStatus(f.v)}
            className={cls("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all duration-150",
              status===f.v?"bg-indigo-600 text-white":"text-slate-500 hover:bg-slate-100")}>
            {f.l}
          </button>
        ))}
      </div>
      
      <div className="flex items-center gap-1 px-3.5 py-2 overflow-x-auto no-scrollbar border-b border-slate-100">
        {DUE_OPTS.map(f=>(
          <button key={f.v} onClick={()=>onDue(f.v)}
            className={cls("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all duration-150",
              due===f.v?(DUE_ACCENTS[f.v]||"bg-indigo-600 text-white"):"text-slate-500 hover:bg-slate-100")}>
            {f.l}
          </button>
        ))}
      </div>

      {/* Row 2: Type pills + Status dropdown (portal-based) */}
      <div className="flex items-center gap-1.5 px-3.5 py-2 overflow-x-auto no-scrollbar">
        {typeOpts&&onType&&(
          <>
            {typeOpts.map(f=>(
              <button key={f.v} onClick={()=>onType(f.v)}
                className={cls("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all duration-150",
                  type===f.v?"bg-violet-600 text-white":"text-slate-500 hover:bg-slate-100")}>
                {f.l}
              </button>
            ))}
            {statusFilterOpts&&<div className="mx-1 h-3.5 w-px bg-slate-200 shrink-0"/>}
          </>
        )}
        {statusFilterOpts&&onStatusFilter&&(
          <StatusDropdown
            opts={statusFilterOpts}
            value={statusFilter}
            onChange={onStatusFilter}
            label={statusFilterLabel}
          />
        )}
      </div>
    </div>
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
            {active&&<span className="absolute top-0 left-1/4 right-1/4 h-0.5 rounded-full bg-indigo-600"/>}
            <I className={cls("h-5 w-5 transition-transform duration-200",active?"text-indigo-600 scale-110":"")}/>
            <span className={cls("text-[10px] font-medium transition-colors duration-200",active?"text-indigo-600":"text-slate-400")}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ENQUIRY TASK CARD
═══════════════════════════════════════════════════════════════ */
function EnquiryTaskCard({task,token,localResolved,onResolved,animDelay=0}){
  const lf         = task.latest_followup||{};
  const serverDone = isEnquiryTerminal(task);
  const isResolved = !!localResolved||serverDone;

  const sampleStatus    = task.sample_status||task.samples?.[0]?.sample_status||null;
  const quotationStatus = task.quotation_status||task.quotations?.[0]?.quotation_status||null;
  const autoNextAction  = suggestNextAction(task.sample_required,task.quotation_required,sampleStatus,quotationStatus);

  const[open,setOpen]      =useState(false);
  const[outcome,setOutcome]=useState(null);
  const[form,setForm]      =useState({contact_type:"",remark:"",next_followup_date:"",next_followup_time:"",manual_next_action:autoNextAction||""});
  const[saving,setSaving]  =useState(false);
  const[err,setErr]        =useState("");

  const lead          = task.leads||{};
  const scheduledTime = extractTime(lf.notes||"");

  const REMARK_COPY={
    Won: {label:"Why was it won?",      placeholder:"Price match, faster delivery, better terms…",           required:true},
    Lost:{label:"Why was it lost?",     placeholder:"Lost to competitor, price too high, project cancelled…",required:true},
    Next:{label:"Note (optional)",      placeholder:"What was discussed, what to prepare…",                  required:false},
  };

  function hc(e){const{name,value}=e.target;setForm(p=>({...p,[name]:value}));}
  function handleOutcome(o){setOutcome(o);setErr("");setForm({contact_type:"",remark:"",next_followup_date:"",next_followup_time:"",manual_next_action:autoNextAction||""});}

  async function submit(e){
    e.preventDefault();
    if(!form.contact_type){setErr("Please select how you contacted them");return;}
    if(outcome==="Next"&&!form.next_followup_date){setErr("Please pick the next follow-up date");return;}
    if((outcome==="Won"||outcome==="Lost")&&!form.remark.trim()){setErr(outcome==="Won"?"Please note why it was won":"Please note why it was lost");return;}
    setErr("");setSaving(true);
    try{
      const res=await fetch(`${API}/api/rfqs/${task.id}/followups/resolve`,{
        method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},
        body:JSON.stringify({outcome,...form}),
      });
      const data=await res.json();
      if(!res.ok) throw new Error(data.message||"Failed to save");
      setOpen(false);
      onResolved(task.id,outcome,data.followup,Date.now());
    }catch(e){setErr(e.message);}
    finally{setSaving(false);}
  }

  const resolvedLabel=
    localResolved?.outcome==="Won"?"Won":
    localResolved?.outcome==="Lost"?"Lost":
    localResolved?.outcome==="Next"?"Rescheduled":
    serverDone?(lf.enquiry_status||"Done"):"";

  const resolvedBadgeCls=
    (localResolved?.outcome==="Won"||lf.enquiry_status==="Won")?"bg-emerald-50 text-emerald-700 ring-emerald-200":
    (localResolved?.outcome==="Lost"||lf.enquiry_status==="Lost")?"bg-rose-50 text-rose-700 ring-rose-200":
    "bg-sky-50 text-sky-700 ring-sky-200";

  return(
    <motion.div layout variants={cardVariants} initial="hidden" animate="visible" exit="exit" transition={{delay:animDelay}}
      className={cls("rounded-2xl border bg-white shadow-sm overflow-hidden",
        isResolved?"border-slate-200 opacity-75 hover:opacity-100 transition-opacity duration-300":"border-slate-200")}>

      <div className="px-4 py-3.5">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">

            <div className="flex items-center gap-2 flex-wrap mb-1">
              {isResolved?(
                <motion.div initial={{scale:0.8,opacity:0}} animate={{scale:1,opacity:1}} transition={{duration:0.2,ease:"backOut"}}>
                  <Tag className={resolvedBadgeCls}><Ic.Check className="mr-1 h-2.5 w-2.5"/>{resolvedLabel}</Tag>
                </motion.div>
              ):dueBadge(lf.followup_date)}
              {lf.enquiry_status&&!isResolved&&<Tag className="bg-slate-100 text-slate-600 ring-slate-200">{lf.enquiry_status}</Tag>}
              <span className="text-[14px] font-bold text-slate-900 truncate">{task.company_name}</span>
            </div>

            <p className="text-[12px] text-slate-500 truncate mb-2">
              {task.product_name||task.product_category}
              {task.product_sub_category?` · ${task.product_sub_category}`:""}
            </p>

            {lf.followup_date&&(
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <div className="flex items-center gap-1 text-[12px] font-semibold">
                  <Ic.Cal className="h-3.5 w-3.5 text-slate-400"/>
                  <span className={cls(
                    isResolved?"text-slate-400":
                    isOverdue(lf.followup_date)?"text-rose-500":
                    isToday(lf.followup_date)?"text-amber-500":
                    isTomorrow(lf.followup_date)?"text-sky-600":"text-slate-600"
                  )}>
                    {isResolved?fmtD(lf.followup_date):
                     isOverdue(lf.followup_date)?"Overdue":
                     isToday(lf.followup_date)?"Today":
                     isTomorrow(lf.followup_date)?"Tomorrow":fmtD(lf.followup_date)}
                  </span>
                  {scheduledTime&&<span className="flex items-center gap-0.5 text-slate-400 font-normal ml-1"><Ic.Clock className="h-3 w-3"/>{fmt12(scheduledTime)}</span>}
                </div>
                {lf.contact_type&&<Tag className={contactCls(lf.contact_type)}><ContactIcon type={lf.contact_type} className="mr-1 h-2.5 w-2.5"/>{lf.contact_type}</Tag>}
              </div>
            )}

            {(sampleStatus||quotationStatus||task.tds_available)&&(
              <div className="flex flex-wrap gap-1.5 mb-2">
                {sampleStatus&&<Tag className="bg-teal-50 text-teal-700 ring-teal-200">Sample: {sampleStatus}</Tag>}
                {quotationStatus&&<Tag className="bg-violet-50 text-violet-700 ring-violet-200">Quote: {quotationStatus}</Tag>}
                {task.tds_available&&<Tag className="bg-emerald-50 text-emerald-700 ring-emerald-200">TDS</Tag>}
              </div>
            )}

            {!isResolved&&lf.next_action&&(
              <div className="flex items-start gap-1.5 mb-1.5">
                <Ic.Zap className="h-3.5 w-3.5 text-indigo-400 shrink-0 mt-0.5"/>
                <p className="text-[12px] font-semibold text-indigo-600">{lf.next_action}</p>
              </div>
            )}

            {lf.remark&&(
              <div className="flex items-start gap-1.5 mb-2">
                <Ic.MsgSq className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5"/>
                <p className="text-[12px] text-slate-500 line-clamp-2">{lf.remark}</p>
              </div>
            )}

            {localResolved?.remark&&(
              <p className="mt-1 text-[12px] text-slate-500">
                <span className="font-semibold text-slate-400">{localResolved.outcome==="Won"?"Won — ":localResolved.outcome==="Lost"?"Lost — ":"Note — "}</span>
                {localResolved.remark}
              </p>
            )}

            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
              {lead.primary_contact_name&&<span className="flex items-center gap-1 text-[11px] text-slate-400"><Ic.User className="h-3 w-3"/>{lead.primary_contact_name}</span>}
              {lead.primary_phone&&<span className="flex items-center gap-1 text-[11px] text-slate-400"><Ic.Phone className="h-3 w-3"/>{lead.primary_phone}</span>}
              {lead.city&&<span className="flex items-center gap-1 text-[11px] text-slate-400"><Ic.Pin className="h-3 w-3"/>{lead.city}</span>}
            </div>

            {isResolved&&localResolved?.resolvedAt&&(
              <p className="mt-1.5 text-[10px] text-slate-300">Resolved {fmtDT(new Date(localResolved.resolvedAt))}</p>
            )}
          </div>

          {!isResolved&&(
            <motion.button whileTap={{scale:0.94}}
              onClick={()=>{setOpen(o=>!o);if(open)setOutcome(null);}}
              className={cls("shrink-0 rounded-lg px-3 py-1.5 text-[12px] font-bold transition-all",
                open?"bg-slate-100 text-slate-600 hover:bg-slate-200":"bg-indigo-50 text-indigo-600 hover:bg-indigo-100")}>
              {open?"Close":"Take Action"}
            </motion.button>
          )}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open&&!isResolved&&(
          <motion.div key="panel" initial="hidden" animate="visible" exit="exit" variants={panelVariants}
            className="overflow-hidden border-t border-slate-100">
            <div className="px-4 py-4">
              <AnimatePresence mode="wait" initial={false}>
                {!outcome?(
                  <motion.div key="choose" variants={slideLeft} initial="hidden" animate="visible" exit="exit" className="grid grid-cols-3 gap-2">
                    <motion.button whileHover={{scale:1.02}} whileTap={{scale:0.97}} onClick={()=>handleOutcome("Won")}
                      className="flex flex-col items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 hover:bg-emerald-100 transition-colors">
                      <Ic.Trophy className="h-5 w-5 text-emerald-600"/><span className="text-[12px] font-bold text-emerald-700">Won</span>
                    </motion.button>
                    <motion.button whileHover={{scale:1.02}} whileTap={{scale:0.97}} onClick={()=>handleOutcome("Lost")}
                      className="flex flex-col items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 hover:bg-rose-100 transition-colors">
                      <Ic.Flag className="h-5 w-5 text-rose-600"/><span className="text-[12px] font-bold text-rose-700">Lost</span>
                    </motion.button>
                    <motion.button whileHover={{scale:1.02}} whileTap={{scale:0.97}} onClick={()=>handleOutcome("Next")}
                      className="flex flex-col items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-3 py-3 hover:bg-sky-100 transition-colors">
                      <Ic.ArrR className="h-5 w-5 text-sky-600"/><span className="text-[12px] font-bold text-sky-700">Next Follow-up</span>
                    </motion.button>
                  </motion.div>
                ):(
                  <motion.form key={`form-${outcome}`} variants={slideRight} initial="hidden" animate="visible" exit="exit"
                    onSubmit={submit} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Tag className={cls(outcome==="Won"?"bg-emerald-50 text-emerald-700 ring-emerald-200":outcome==="Lost"?"bg-rose-50 text-rose-700 ring-rose-200":"bg-sky-50 text-sky-700 ring-sky-200")}>
                        {outcome==="Next"?"Schedule Next Follow-up":outcome}
                      </Tag>
                      <button type="button" onClick={()=>handleOutcome(null)} className="text-[11px] text-slate-400 hover:text-slate-600">← change</button>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">How did you contact them? <span className="text-rose-500">*</span></label>
                      <div className="relative">
                        <select name="contact_type" value={form.contact_type} onChange={hc} className={inp("appearance-none pr-9")}>
                          <option value="">Select…</option>
                          {CONTACT_TYPES.map(c=><option key={c} value={c}>{c}</option>)}
                        </select>
                        <Ic.ChevD className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/>
                      </div>
                    </div>

                    {outcome==="Next"&&(
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Next Date <span className="text-rose-500">*</span></label>
                            <input type="date" name="next_followup_date" value={form.next_followup_date} onChange={hc} min={todayStr()} className={inp()}/>
                          </div>
                          <div>
                            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Time (optional)</label>
                            <input type="time" name="next_followup_time" value={form.next_followup_time} onChange={hc} className={inp()}/>
                          </div>
                        </div>
                        <div>
                          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Next Action</label>
                          {autoNextAction&&(
                            <div className="mb-1.5 flex items-center gap-1.5">
                              <Ic.Sparkle className="h-3 w-3 text-indigo-400"/>
                              <span className="text-[10px] text-indigo-500">
                                {form.manual_next_action===autoNextAction
                                  ?"Auto-suggested from current status"
                                  :<>Suggested: <button type="button" onClick={()=>setForm(p=>({...p,manual_next_action:autoNextAction}))} className="font-semibold text-indigo-600 hover:text-indigo-800 underline underline-offset-2">{autoNextAction}</button></>}
                              </span>
                            </div>
                          )}
                          <div className="relative">
                            <select name="manual_next_action" value={form.manual_next_action} onChange={hc} className={inp("appearance-none pr-9")}>
                              <option value="">Select…</option>
                              {NEXT_ACTIONS.map(a=><option key={a} value={a}>{a}</option>)}
                            </select>
                            <Ic.ChevD className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/>
                          </div>
                        </div>
                      </>
                    )}

                    <div>
                      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        {REMARK_COPY[outcome].label}{REMARK_COPY[outcome].required&&<span className="text-rose-500"> *</span>}
                      </label>
                      <textarea name="remark" value={form.remark} onChange={hc} rows={2} placeholder={REMARK_COPY[outcome].placeholder} className={inp("resize-none")}/>
                    </div>

                    <AnimatePresence>
                      {err&&<motion.p initial={{opacity:0,y:-4}} animate={{opacity:1,y:0}} exit={{opacity:0}} className="text-[12px] text-rose-600">{err}</motion.p>}
                    </AnimatePresence>

                    <div className="flex justify-end gap-2 pt-1">
                      <GBtn type="button" className="px-3 py-2 text-xs" onClick={()=>handleOutcome(null)}>Back</GBtn>
                      <PBtn type="submit" disabled={saving} className="px-3 py-2 text-xs">
                        {saving?<span className="flex items-center gap-1.5"><motion.span animate={{rotate:360}} transition={{repeat:Infinity,duration:0.8,ease:"linear"}} className="block h-3 w-3 rounded-full border-2 border-white/30 border-t-white"/>Saving…</span>:"Confirm"}
                      </PBtn>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   COORD TASK CARD
═══════════════════════════════════════════════════════════════ */
function CoordTaskCard({task,kind,token,localResolved,onResolved,animDelay=0}){
  const isSample    = kind==="sample";
  const statusField = isSample?"sample_status":"quotation_status";
  const STATUSES    = isSample?SAMPLE_STATUSES:QUOTATION_STATUSES;
  const terminalSet = isSample?SAMPLE_TERMINAL:QUOTE_TERMINAL;

  const serverDone = terminalSet.has(task[statusField]);
  const isResolved = !!localResolved||serverDone;

  const rfq  = task.rfqs||{};
  const lead = rfq.leads||{};
  const scheduledTime = extractTime(task.notes||"");
  const autoNextAction = isSample
    ? suggestNextAction(true,rfq.quotation_required||false,task.sample_status,null)
    : suggestNextAction(false,true,null,task.quotation_status);

  const[open,setOpen]            =useState(false);
  const[status,setStatus]        =useState(task[statusField]||"");
  const[followUp,setFollowUp]    =useState(task.follow_up_date||"");
  const[followTime,setFollowTime]=useState("");
  const[remark,setRemark]        =useState("");
  const[saving,setSaving]        =useState(false);
  const[err,setErr]              =useState("");

  async function submit(e){
    e.preventDefault();
    if(!status){setErr("Please select a status");return;}
    setErr("");setSaving(true);
    try{
      const url=`${API}/api/${isSample?"samples":"quotations"}/${task.id}`;
      const res=await fetch(url,{
        method:"PUT",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},
        body:JSON.stringify({[statusField]:status,follow_up_date:followUp||null,notes:followTime?`[Time: ${followTime}]${remark?" "+remark:""}`:remark||null}),
      });
      const data=await res.json();
      if(!res.ok) throw new Error(data.message||"Failed");
      setOpen(false);
      onResolved(task.id,kind,status,followUp||null,Date.now());
    }catch(e){setErr(e.message);}
    finally{setSaving(false);}
  }

  const resolvedStatus=localResolved?.status||task[statusField];
  const resolvedBadgeCls=
    (resolvedStatus==="Approved"||resolvedStatus==="Accepted")?"bg-emerald-50 text-emerald-700 ring-emerald-200":
    resolvedStatus==="Rejected"?"bg-rose-50 text-rose-700 ring-rose-200":
    "bg-sky-50 text-sky-700 ring-sky-200";

  return(
    <motion.div layout variants={cardVariants} initial="hidden" animate="visible" exit="exit" transition={{delay:animDelay}}
      className={cls("rounded-2xl border bg-white shadow-sm overflow-hidden",
        isResolved?"border-slate-200 opacity-75 hover:opacity-100 transition-opacity duration-300":"border-slate-200")}>

      <div className="px-4 py-3.5">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">

            <div className="flex items-center gap-2 flex-wrap mb-1">
              {isResolved?(
                <motion.div initial={{scale:0.8,opacity:0}} animate={{scale:1,opacity:1}} transition={{duration:0.2,ease:"backOut"}}>
                  <Tag className={resolvedBadgeCls}><Ic.Check className="mr-1 h-2.5 w-2.5"/>{resolvedStatus}</Tag>
                </motion.div>
              ):dueBadge(task.follow_up_date)}
              <Tag className={isSample?"bg-teal-50 text-teal-700 ring-teal-200":"bg-violet-50 text-violet-700 ring-violet-200"}>
                {isSample?"Sample":"Quotation"}
              </Tag>
              <span className="text-[14px] font-bold text-slate-900 truncate">{rfq.company_name||lead.company_name}</span>
            </div>

            <p className="text-[12px] text-slate-500 truncate flex items-center gap-1 mb-2">
              {isSample?<Ic.Box className="h-3 w-3 text-slate-400"/>:<Ic.Receipt className="h-3 w-3 text-slate-400"/>}
              {[rfq.product_category,rfq.product_sub_category,rfq.product_name].filter(Boolean).join(" › ")}
            </p>

            {task.follow_up_date&&(
              <div className="flex items-center gap-2 mb-2">
                <div className="flex items-center gap-1 text-[12px] font-semibold">
                  <Ic.Cal className="h-3.5 w-3.5 text-slate-400"/>
                  <span className={cls(
                    isResolved?"text-slate-400":
                    isOverdue(task.follow_up_date)?"text-rose-500":
                    isToday(task.follow_up_date)?"text-amber-500":
                    isTomorrow(task.follow_up_date)?"text-sky-600":"text-slate-600"
                  )}>
                    {isResolved?fmtD(task.follow_up_date):
                     isOverdue(task.follow_up_date)?"Overdue":
                     isToday(task.follow_up_date)?"Today":
                     isTomorrow(task.follow_up_date)?"Tomorrow":fmtD(task.follow_up_date)}
                  </span>
                  {scheduledTime&&<span className="flex items-center gap-0.5 text-slate-400 font-normal ml-1"><Ic.Clock className="h-3 w-3"/>{fmt12(scheduledTime)}</span>}
                </div>
              </div>
            )}



            {!isResolved&&(
              <p className="text-[12px] text-slate-400 mb-1">Status: <span className="font-semibold text-slate-600">{task[statusField]||"—"}</span></p>
            )}
            {isSample&&rfq.sample_description&&(
              <div className="flex items-start gap-1.5 mb-1.5">
                <Ic.MsgSq className="h-3.5 w-3.5 text-teal-400 shrink-0 mt-0.5"/>
                <p className="text-[12px] text-slate-500 line-clamp-2">{rfq.sample_description}</p>
              </div>
            )}
            {!isSample&&rfq.quotation_description&&(
              <div className="flex items-start gap-1.5 mb-1.5">
                <Ic.MsgSq className="h-3.5 w-3.5 text-violet-400 shrink-0 mt-0.5"/>
                <p className="text-[12px] text-slate-500 line-clamp-2">{rfq.quotation_description}</p>
              </div>
            )}

            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
              {lead.primary_contact_name&&<span className="flex items-center gap-1 text-[11px] text-slate-400"><Ic.User className="h-3 w-3"/>{lead.primary_contact_name}</span>}
              {lead.primary_phone&&<span className="flex items-center gap-1 text-[11px] text-slate-400"><Ic.Phone className="h-3 w-3"/>{lead.primary_phone}</span>}
              {lead.city&&<span className="flex items-center gap-1 text-[11px] text-slate-400"><Ic.Pin className="h-3 w-3"/>{lead.city}</span>}
            </div>

            {isResolved&&localResolved?.resolvedAt&&(
              <p className="mt-1.5 text-[10px] text-slate-300">Updated {fmtDT(new Date(localResolved.resolvedAt))}</p>
            )}
          </div>

          {!isResolved&&(
            <motion.button whileTap={{scale:0.94}} onClick={()=>setOpen(o=>!o)}
              className={cls("shrink-0 rounded-lg px-3 py-1.5 text-[12px] font-bold transition-all",
                open?"bg-slate-100 text-slate-600 hover:bg-slate-200":"bg-violet-50 text-violet-600 hover:bg-violet-100")}>
              {open?"Close":"Update"}
            </motion.button>
          )}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open&&!isResolved&&(
          <motion.div key="panel" initial="hidden" animate="visible" exit="exit" variants={panelVariants}
            className="overflow-hidden border-t border-slate-100">
            <motion.form onSubmit={submit} initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.06}} className="px-4 py-4 space-y-3">

              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">{isSample?"Sample":"Quotation"} Status <span className="text-rose-500">*</span></label>
                <div className="relative">
                  <select value={status} onChange={e=>setStatus(e.target.value)} className={inp("appearance-none pr-9")}>
                    <option value="">Select…</option>
                    {STATUSES.map(s=><option key={s} value={s}>{s}</option>)}
                  </select>
                  <Ic.ChevD className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Next Follow-up Date</label>
                  <input type="date" value={followUp} onChange={e=>setFollowUp(e.target.value)} className={inp()}/>
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Time (optional)</label>
                  <input type="time" value={followTime} onChange={e=>setFollowTime(e.target.value)} className={inp()}/>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Note (optional)</label>
                <textarea value={remark} onChange={e=>setRemark(e.target.value)} rows={2} placeholder="Update on progress…" className={inp("resize-none")}/>
              </div>

              <AnimatePresence>
                {err&&<motion.p initial={{opacity:0,y:-4}} animate={{opacity:1,y:0}} exit={{opacity:0}} className="text-[12px] text-rose-600">{err}</motion.p>}
              </AnimatePresence>

              <div className="flex justify-end gap-2 pt-1">
                <GBtn type="button" className="px-3 py-2 text-xs" onClick={()=>setOpen(false)}>Cancel</GBtn>
                <PBtn type="submit" disabled={saving} className="px-3 py-2 text-xs">
                  {saving?<span className="flex items-center gap-1.5"><motion.span animate={{rotate:360}} transition={{repeat:Infinity,duration:0.8,ease:"linear"}} className="block h-3 w-3 rounded-full border-2 border-white/30 border-t-white"/>Saving…</span>:"Save"}
                </PBtn>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SECTION + EMPTY
═══════════════════════════════════════════════════════════════ */
function Section({title,subtitle,count,accent,children,animIndex=0}){
  return(
    <motion.div initial={{opacity:0,y:16}} animate={{opacity:1,y:0}}
      transition={{duration:0.25,delay:animIndex*0.06,ease:[0.16,1,0.3,1]}} className="mb-8">
      <div className="mb-3 flex items-baseline justify-between">
        <div>
          <h2 className={cls("text-base font-bold tracking-tight",accent)}>{title}</h2>
          <p className="text-[12px] text-slate-400">{subtitle}</p>
        </div>
        <span className="text-[12px] font-semibold text-slate-400">{count} {count===1?"task":"tasks"}</span>
      </div>
      <div className="space-y-3">{children}</div>
    </motion.div>
  );
}
function EmptyRow({label}){
  return(
    <motion.div initial={{opacity:0}} animate={{opacity:1}} transition={{duration:0.2,delay:0.1}}
      className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white/60 px-6 py-10 text-center">
      <Ic.Empty className="h-7 w-7 text-slate-200 mb-2"/>
      <p className="text-[13px] font-medium text-slate-500">{label}</p>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════ */
export default function MyTasks(){
  const{user,token}=useAuth();
  const role=user?.role;
  const showEnquiries = role==="Salesperson"||role==="Admin";
  const showCoord     = role==="SalesCoordinator"||role==="Admin";

  const initialCoordType=useMemo(()=>{
    const p=new URLSearchParams(window.location.search);
    return p.get("type")||"all";
  },[]);

  const[enquiryTasks,setEnquiryTasks]=useState([]);
  const[sampleTasks,setSampleTasks]  =useState([]);
  const[quoteTasks,setQuoteTasks]    =useState([]);
  const[loading,setLoading]          =useState(true);
  const[error,setError]              =useState("");

  /* resolved state — NEVER reset on refresh so completed tab stays populated */
  const[resolvedEnquiry,setResolvedEnquiry]=useState({});
  const[resolvedCoord,setResolvedCoord]    =useState({});

  /* enquiry filters */
  const[enquirySearch,setEnquirySearch]        =useState("");
  const[enquiryStatusF,setEnquiryStatusF]      =useState("pending");
  const[enquiryDueF,setEnquiryDueF]            =useState("all");
  const[enquiryEnqStatusF,setEnquiryEnqStatusF]=useState("all");

  /* coord filters */
  const[coordSearch,setCoordSearch]            =useState("");
  const[coordStatusF,setCoordStatusF]          =useState("pending");
  const[coordDueF,setCoordDueF]                =useState("all");
  const[coordTypeF,setCoordTypeF]              =useState(initialCoordType);
  const[coordItemStatusF,setCoordItemStatusF]  =useState("all");

  const isFirstLoad=useRef(true);

  const fetchAll=useCallback(async()=>{
    setLoading(true);setError("");
    try{
      const calls=[];
      if(showEnquiries) calls.push(fetch(`${API}/api/rfqs/followups/due`,{headers:{Authorization:`Bearer ${token}`}}).then(r=>r.json()));
      else calls.push(Promise.resolve({tasks:[]}));
      if(showCoord){
        calls.push(fetch(`${API}/api/samples/due`,   {headers:{Authorization:`Bearer ${token}`}}).then(r=>r.json()));
        calls.push(fetch(`${API}/api/quotations/due`,{headers:{Authorization:`Bearer ${token}`}}).then(r=>r.json()));
      }else{
        calls.push(Promise.resolve({samples:[]}),Promise.resolve({quotations:[]}));
      }
      const[eJ,sJ,qJ]=await Promise.all(calls);

      if(isFirstLoad.current){
        /* First load: set directly */
        setEnquiryTasks(eJ.tasks||[]);
        setSampleTasks(sJ.samples||[]);
        setQuoteTasks(qJ.quotations||[]);
        isFirstLoad.current=false;
      }else{
        /* Subsequent refreshes: merge — keep existing records, update with any new server data */
        setEnquiryTasks(prev=>{
          const map=new Map(prev.map(t=>[t.id,t]));
          (eJ.tasks||[]).forEach(t=>map.set(t.id,t));
          return Array.from(map.values());
        });
        setSampleTasks(prev=>{
          const map=new Map(prev.map(t=>[t.id,t]));
          (sJ.samples||[]).forEach(t=>map.set(t.id,t));
          return Array.from(map.values());
        });
        setQuoteTasks(prev=>{
          const map=new Map(prev.map(t=>[t.id,t]));
          (qJ.quotations||[]).forEach(t=>map.set(t.id,t));
          return Array.from(map.values());
        });
        /* DO NOT reset resolvedEnquiry or resolvedCoord */
      }
    }catch(e){setError(e.message);}
    finally{setLoading(false);}
  },[token,showEnquiries,showCoord]);

  useEffect(()=>{fetchAll();},[fetchAll]);

  /* completion checks */
  const isEnqResolved   =useCallback(t=>!!resolvedEnquiry[t.id]||isEnquiryTerminal(t),[resolvedEnquiry]);
  const isSampleResolved=useCallback(t=>!!resolvedCoord[`sample-${t.id}`]||isSampleTerminal(t),[resolvedCoord]);
  const isQuoteResolved =useCallback(t=>!!resolvedCoord[`quotation-${t.id}`]||isQuoteTerminal(t),[resolvedCoord]);

  function matchesDue(date,dueF){
    if(dueF==="all")      return true;
    if(dueF==="overdue")  return isOverdue(date);
    if(dueF==="today")    return isToday(date);
    if(dueF==="tomorrow") return isTomorrow(date);
    if(dueF==="future")   return isFuture(date)||isTomorrow(date);
    return true;
  }
  function matchesCompletion(resolved,f){
    if(f==="all") return true;
    if(f==="completed") return resolved;
    return !resolved;
  }

  const sortedEnquiryTasks=useMemo(()=>{
    const q=enquirySearch.trim().toLowerCase();
    return enquiryTasks.filter(t=>{
      const resolved=isEnqResolved(t);
      if(!matchesCompletion(resolved,enquiryStatusF)) return false;
      if(!resolved&&!matchesDue(t.latest_followup?.followup_date,enquiryDueF)) return false;
      if(enquiryEnqStatusF!=="all"&&(t.latest_followup?.next_action||"")!==enquiryEnqStatusF) return false;
      if(q){
        const lead=t.leads||{};
        const hay=[t.company_name,t.product_name,t.product_category,lead.primary_contact_name,lead.city].filter(Boolean).join(" ").toLowerCase();
        if(!hay.includes(q)) return false;
      }
      return true;
    }).sort((a,b)=>{
      const aR=isEnqResolved(a),bR=isEnqResolved(b);
      const aKey=buildSortKey(a.latest_followup?.followup_date,extractTime(a.latest_followup?.notes||""),aR,resolvedEnquiry[a.id]?.resolvedAt||a.updated_at);
      const bKey=buildSortKey(b.latest_followup?.followup_date,extractTime(b.latest_followup?.notes||""),bR,resolvedEnquiry[b.id]?.resolvedAt||b.updated_at);
      return aKey.localeCompare(bKey);
    });
  },[enquiryTasks,resolvedEnquiry,enquirySearch,enquiryStatusF,enquiryDueF,enquiryEnqStatusF,isEnqResolved]);

  const sortedSampleTasks=useMemo(()=>{
    if(coordTypeF==="quotation") return [];
    const q=coordSearch.trim().toLowerCase();
    return sampleTasks.filter(t=>{
      const resolved=isSampleResolved(t);
      if(!matchesCompletion(resolved,coordStatusF)) return false;
      if(!resolved&&!matchesDue(t.follow_up_date,coordDueF)) return false;
      if(coordItemStatusF!=="all"&&t.sample_status!==coordItemStatusF) return false;
      if(q){const rfq=t.rfqs||{};const lead=rfq.leads||{};const hay=[rfq.company_name,rfq.product_name,rfq.product_category,lead.primary_contact_name,lead.city].filter(Boolean).join(" ").toLowerCase();if(!hay.includes(q)) return false;}
      return true;
    }).sort((a,b)=>{
      const aR=isSampleResolved(a),bR=isSampleResolved(b);
      const aKey=buildSortKey(a.follow_up_date,extractTime(a.notes||""),aR,resolvedCoord[`sample-${a.id}`]?.resolvedAt||a.updated_at);
      const bKey=buildSortKey(b.follow_up_date,extractTime(b.notes||""),bR,resolvedCoord[`sample-${b.id}`]?.resolvedAt||b.updated_at);
      return aKey.localeCompare(bKey);
    });
  },[sampleTasks,resolvedCoord,coordSearch,coordStatusF,coordDueF,coordTypeF,coordItemStatusF,isSampleResolved]);

  const sortedQuoteTasks=useMemo(()=>{
    if(coordTypeF==="sample") return [];
    const q=coordSearch.trim().toLowerCase();
    return quoteTasks.filter(t=>{
      const resolved=isQuoteResolved(t);
      if(!matchesCompletion(resolved,coordStatusF)) return false;
      if(!resolved&&!matchesDue(t.follow_up_date,coordDueF)) return false;
      if(coordItemStatusF!=="all"&&t.quotation_status!==coordItemStatusF) return false;
      if(q){const rfq=t.rfqs||{};const lead=rfq.leads||{};const hay=[rfq.company_name,rfq.product_name,rfq.product_category,lead.primary_contact_name,lead.city].filter(Boolean).join(" ").toLowerCase();if(!hay.includes(q)) return false;}
      return true;
    }).sort((a,b)=>{
      const aR=isQuoteResolved(a),bR=isQuoteResolved(b);
      const aKey=buildSortKey(a.follow_up_date,extractTime(a.notes||""),aR,resolvedCoord[`quotation-${a.id}`]?.resolvedAt||a.updated_at);
      const bKey=buildSortKey(b.follow_up_date,extractTime(b.notes||""),bR,resolvedCoord[`quotation-${b.id}`]?.resolvedAt||b.updated_at);
      return aKey.localeCompare(bKey);
    });
  },[quoteTasks,resolvedCoord,coordSearch,coordStatusF,coordDueF,coordTypeF,coordItemStatusF,isQuoteResolved]);

  const pendingCount=useMemo(()=>
    enquiryTasks.filter(t=>!isEnqResolved(t)).length+
    sampleTasks.filter(t=>!isSampleResolved(t)).length+
    quoteTasks.filter(t=>!isQuoteResolved(t)).length
  ,[enquiryTasks,sampleTasks,quoteTasks,resolvedEnquiry,resolvedCoord,isEnqResolved,isSampleResolved,isQuoteResolved]);

  const overdueCount=useMemo(()=>{
    let n=0;
    enquiryTasks.forEach(t=>{if(!isEnqResolved(t)&&isOverdue(t.latest_followup?.followup_date))n++;});
    sampleTasks.forEach(t=>{if(!isSampleResolved(t)&&isOverdue(t.follow_up_date))n++;});
    quoteTasks.forEach(t=>{if(!isQuoteResolved(t)&&isOverdue(t.follow_up_date))n++;});
    return n;
  },[enquiryTasks,sampleTasks,quoteTasks,resolvedEnquiry,resolvedCoord,isEnqResolved,isSampleResolved,isQuoteResolved]);

  function handleEnquiryResolved(rfqId,outcome,followup,resolvedAt){
    setResolvedEnquiry(p=>({...p,[rfqId]:{outcome,remark:followup?.remark||null,resolvedAt}}));
  }
  function handleCoordResolved(taskId,kind,status,_fu,resolvedAt){
    setResolvedCoord(p=>({...p,[`${kind}-${taskId}`]:{status,resolvedAt}}));
  }

  const totalTasks=enquiryTasks.length+sampleTasks.length+quoteTasks.length;

  const coordStatusFilterOpts=coordTypeF==="quotation"
    ?QUOTE_STATUS_FILTER_OPTS
    :coordTypeF==="sample"
    ?SAMPLE_STATUS_FILTER_OPTS
    :[...new Map([...SAMPLE_STATUS_FILTER_OPTS,...QUOTE_STATUS_FILTER_OPTS].map(o=>[o.v,o])).values()];

  return(
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">

        <motion.div initial={{opacity:0,y:-10}} animate={{opacity:1,y:0}} transition={{duration:0.25,ease:[0.16,1,0.3,1]}}
          className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-indigo-500">Action Center</p>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">My Tasks</h1>
            <p className="mt-1 text-sm text-slate-500">
              {totalTasks===0?"Nothing on your plate right now.":`${pendingCount} of ${totalTasks} task${totalTasks===1?"":"s"} pending`}
              {overdueCount>0&&<motion.span initial={{opacity:0,x:4}} animate={{opacity:1,x:0}} transition={{delay:0.2}} className="ml-1.5 font-semibold text-rose-500">· {overdueCount} overdue</motion.span>}
            </p>
          </div>
          <motion.button whileHover={{scale:1.04}} whileTap={{scale:0.95}} onClick={fetchAll}
            className="shrink-0 flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] font-medium text-slate-500 hover:bg-slate-50 transition-colors shadow-sm">
            <Ic.Refresh className="h-3.5 w-3.5"/> Refresh
          </motion.button>
        </motion.div>

        <AnimatePresence mode="wait">
          {loading&&(
            <motion.div key="sk" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="space-y-3">
              {Array.from({length:5}).map((_,i)=>(
                <motion.div key={i} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{duration:0.18,delay:i*0.06}}
                  className="h-28 animate-pulse rounded-2xl border border-slate-100 bg-white shadow-sm"/>
              ))}
            </motion.div>
          )}

          {!loading&&error&&(
            <motion.div key="err" initial={{opacity:0,scale:0.97}} animate={{opacity:1,scale:1}} exit={{opacity:0}}
              className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-600">
              <p className="font-semibold mb-1">Something went wrong</p>{error}
              <button onClick={fetchAll} className="mt-2 text-xs font-semibold text-rose-700 underline block">Try again</button>
            </motion.div>
          )}

          {!loading&&!error&&(
            <motion.div key="content" initial={{opacity:0}} animate={{opacity:1}} transition={{duration:0.2}}>

              {showEnquiries&&(
                <Section title="Enquiry Follow-ups" subtitle="Sorted by date & time — earliest first"
                  count={sortedEnquiryTasks.length} accent="text-indigo-600" animIndex={0}>
                  <FilterBar
                    search={enquirySearch} onSearch={setEnquirySearch}
                    status={enquiryStatusF} onStatus={setEnquiryStatusF}
                    due={enquiryDueF} onDue={setEnquiryDueF}
                    placeholder="Search company, contact, city, product…"
                    statusFilter={enquiryEnqStatusF} onStatusFilter={setEnquiryEnqStatusF}
                    statusFilterOpts={ENQ_NEXT_ACTION_FILTER_OPTS} statusFilterLabel="Next Action"
                  />
                  <AnimatePresence initial={false}>
                    {sortedEnquiryTasks.length===0
                      ?<EmptyRow key="empty-e" label="No enquiries match these filters"/>
                      :sortedEnquiryTasks.map((t,i)=>(
                        <EnquiryTaskCard key={t.id} task={t} token={token}
                          localResolved={resolvedEnquiry[t.id]}
                          onResolved={handleEnquiryResolved}
                          animDelay={Math.min(i*0.04,0.25)}/>
                      ))}
                  </AnimatePresence>
                </Section>
              )}

              {showCoord&&(
                <Section title="Sample & Quotation Follow-ups" subtitle="Sorted by date & time — earliest first"
                  count={sortedSampleTasks.length+sortedQuoteTasks.length} accent="text-violet-600"
                  animIndex={showEnquiries?1:0}>
                  <FilterBar
                    search={coordSearch} onSearch={setCoordSearch}
                    status={coordStatusF} onStatus={setCoordStatusF}
                    due={coordDueF} onDue={setCoordDueF}
                    placeholder="Search company, contact, city, product…"
                    type={coordTypeF} onType={v=>{setCoordTypeF(v);setCoordItemStatusF("all");}}
                    typeOpts={[{v:"all",l:"All"},{v:"sample",l:"Sample"},{v:"quotation",l:"Quotation"}]}
                    statusFilter={coordItemStatusF} onStatusFilter={setCoordItemStatusF}
                    statusFilterOpts={coordStatusFilterOpts} statusFilterLabel="Status"
                  />
                  <AnimatePresence initial={false}>
                    {sortedSampleTasks.length===0&&sortedQuoteTasks.length===0
                      ?<EmptyRow key="empty-c" label="No samples or quotations match these filters"/>
                      :<>
                        {sortedSampleTasks.map((t,i)=>(
                          <CoordTaskCard key={`s-${t.id}`} task={t} kind="sample" token={token}
                            localResolved={resolvedCoord[`sample-${t.id}`]}
                            onResolved={handleCoordResolved}
                            animDelay={Math.min(i*0.04,0.25)}/>
                        ))}
                        {sortedQuoteTasks.map((t,i)=>(
                          <CoordTaskCard key={`q-${t.id}`} task={t} kind="quotation" token={token}
                            localResolved={resolvedCoord[`quotation-${t.id}`]}
                            onResolved={handleCoordResolved}
                            animDelay={Math.min((sortedSampleTasks.length+i)*0.04,0.25)}/>
                        ))}
                      </>}
                  </AnimatePresence>
                </Section>
              )}

              {totalTasks===0&&(
                <motion.div initial={{opacity:0,scale:0.96}} animate={{opacity:1,scale:1}}
                  transition={{duration:0.25,ease:[0.16,1,0.3,1]}}
                  className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white px-6 py-16 text-center mt-4">
                  <motion.div initial={{scale:0}} animate={{scale:1}} transition={{duration:0.3,delay:0.1,ease:"backOut"}}
                    className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50 mb-4">
                    <Ic.Check className="h-7 w-7 text-indigo-400"/>
                  </motion.div>
                  <p className="text-[15px] font-bold text-slate-700">You're all caught up!</p>
                  <p className="text-[13px] text-slate-400 mt-1">No follow-ups due right now.</p>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <BottomNav/>
    </div>
  );
}