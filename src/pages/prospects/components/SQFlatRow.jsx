import React from "react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cls, Tag } from "../ui/primitives";
import { Ic } from "../icons";
import CustomSelect from "../../components/CustomSelect";
import PurgeButton, {HEAD_EMAIL} from "../../components/PurgeButton";
import {
  dueCls, dueLabel, relTime, todayStr, latestFU, extractTimeFromNotes, fmtDT
} from "../utils";
import { isSqClosed } from "../sqStatus";
import {
  SAMPLE_STAGES, QUOTATION_STAGES, REJECTED_STAGE,
  PRIORITY_OPTIONS,
} from "../constants";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

function personLabel(p) {
  if (!p) return null;
  const name = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
  return name || p.email || null;
}

export const STAGE_CLS = {
  "Provided by buyer":          "bg-sky-50 text-sky-700 ring-sky-200",
  "Submitted to office":        "bg-blue-50 text-blue-700 ring-blue-200",
  "Submitted to supplier":      "bg-violet-50 text-violet-700 ring-violet-200",
  "Sample under development":   "bg-amber-50 text-amber-700 ring-amber-200",
  "Received from supplier":     "bg-teal-50 text-teal-700 ring-teal-200",
  "Sample submitted to client": "bg-indigo-50 text-indigo-700 ring-indigo-200",
  "Under trial":                "bg-amber-50 text-amber-700 ring-amber-200",
  "Approved with minor changes":"bg-teal-50 text-teal-700 ring-teal-200",

  "Quotation to be Submitted":  "bg-slate-100 text-slate-600 ring-slate-200",
  "Quotation Submitted":        "bg-violet-50 text-violet-700 ring-violet-200",
  "Under review":               "bg-sky-50 text-sky-700 ring-sky-200",
  "Quotation to be Negotiated": "bg-amber-50 text-amber-700 ring-amber-200",
  "Price accepted":             "bg-teal-50 text-teal-700 ring-teal-200",

  "Approved":                   "bg-emerald-50 text-emerald-700 ring-emerald-200",
  "Rejected":                   "bg-rose-50 text-rose-700 ring-rose-200",
};
const PRIORITY_COLOR = {
  High:   { stripe: "bg-rose-400",  badge: "bg-rose-100 text-rose-600",   btn: "bg-rose-500  border-rose-500  shadow-rose-200"  },
  Medium: { stripe: "bg-amber-400", badge: "bg-amber-100 text-amber-600", btn: "bg-amber-400 border-amber-400 shadow-amber-200" },
  Low:    { stripe: "bg-slate-300", badge: "bg-slate-100 text-slate-500", btn: "bg-slate-500 border-slate-500"                   },
};

function WaIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

export const PlainEnquiryRow = React.memo(function PlainEnquiryRow({ item, rfq, onOpenEnquiry }) {
  const fu = latestFU(rfq);
  const fuDate = fu?.followup_date || null;
  const fuTime = fu ? extractTimeFromNotes(fu.notes) : null;

  const companyName = item.company_name || "—";
  const initials = companyName.slice(0, 2).toUpperCase();
  const overdue = fuDate && new Date(fuDate) < (() => { const d = new Date(); d.setHours(0,0,0,0); return d; })();

  const contactName = item.primary_contact_name || "";
  const phone       = item.primary_phone        || "";
  const email       = item.primary_email        || "";
  const nextAction  = fu?.next_action || null;
  const contactType = fu?.contact_type || null;
  const remark      = fu?.remark || null;

  const creatorName = personLabel(rfq.creator);
  const updaterName = personLabel(rfq.updater);
  const showUpdater = updaterName && updaterName !== creatorName;

  function dialable(p) {
    const digits = (p || "").replace(/\D/g, "");
    return digits.startsWith("91") && digits.length > 10 ? digits : `91${digits}`;
  }
  function stop(e) { e.stopPropagation(); }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpenEnquiry(item, rfq)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onOpenEnquiry(item, rfq); }}
      className="flex w-full items-stretch text-left border-b border-slate-100 last:border-0 bg-white transition-colors cursor-pointer hover:bg-slate-50/80 active:bg-slate-100"
    >
      <div className="flex  pl-3 pr-0 py-3 shrink-0">
        <div className="relative">
          <div className="flex h-10 w-10 items-center justify-center rounded-full text-white text-[12px] font-bold shadow-sm bg-gradient-to-br from-indigo-500 to-violet-600">
            {initials}
          </div>
          {overdue && <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-rose-500"/>}
        </div>
      </div>

      <div className="flex-1 px-3 py-3 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[14px] font-bold text-slate-900 leading-snug">{companyName}</span>
          <div className="shrink-0 flex items-baseline gap-1">
            {fuDate ? (
              <>
                <span className={cls("text-[11px] font-semibold", dueCls(fuDate))}>{dueLabel(fuDate)}</span>
                {fuTime && <span className="text-[10px] text-slate-400">{fuTime}</span>}
              </>
            ) : (
              <span className="text-[10px] text-slate-300 font-medium">No date</span>
            )}
          </div>
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2 leading-none">
          <span className="flex items-center truncate text-[12px] leading-none text-slate-500">
            <Ic.User className="h-3 w-3 text-slate-400 shrink-0" />
            <span className="ml-1 truncate">{contactName || "—"}</span>
          </span>

          <div className="shrink-0 flex items-center gap-1">
            {nextAction && (
              <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold leading-none ring-1 ring-inset bg-indigo-50 text-indigo-600 ring-indigo-200">
                {nextAction}
              </span>
            )}

            {contactType && (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none ring-1 ring-inset bg-slate-50 text-slate-500 ring-slate-200">
                {contactType}
              </span>
            )}
          </div>
        </div>

        <div className="mt-0.5 text-[10px] leading-loose text-slate-400">
          Enquiry: <span className="font-semibold text-slate-500">{rfq.product_name || rfq.product_sub_category || rfq.product_category}</span>
        </div>
        {(phone || email) && (
          <div className="mt-1.5 flex items-center gap-1.5">
            {phone && (
              <a href={`tel:${phone}`} onClick={stop} title={`Call ${phone}`}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm hover:border-slate-300 hover:text-slate-700">
                <Ic.Phone className="h-3.5 w-3.5"/>
              </a>
            )}
            {phone && (
              <a href={`https://wa.me/${dialable(phone)}`} target="_blank" rel="noopener noreferrer" onClick={stop} title={`WhatsApp ${phone}`}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm hover:border-slate-300 hover:text-slate-700">
                <WaIcon className="h-3.5 w-3.5"/>
              </a>
            )}
            {email && (
              <a href={`mailto:${email}`} onClick={stop} title={email}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm hover:border-slate-300 hover:text-slate-700">
                <Ic.Mail className="h-3.5 w-3.5"/>
              </a>
            )}
          </div>
        )}

        {(creatorName || showUpdater) && (
          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            {creatorName && (
              <span className="text-[10px] text-slate-400">
                By <span className="font-semibold text-slate-500">{creatorName}</span>
              </span>
            )}
            {showUpdater && (
              <span className="text-[10px] text-slate-400">
                · Updated <span className="font-semibold text-slate-500">{updaterName}</span>
              </span>
            )}
          </div>
        )}

        {remark && (
          <p className="mt-0.5 text-[11px] text-slate-500 leading-snug">
            <span className="text-[10px] text-slate-400">Remarks: </span>{remark}
          </p>
        )}

        {rfq.created_at && (
          <div className="mt-1 flex items-center gap-1">
            <Ic.Cal className="h-3 w-3 text-slate-300 shrink-0" />
            <span className="text-[10px] text-slate-400">Created {fmtDT(rfq.created_at)}</span>
          </div>
        )}
      </div>
    </div>
  );
});

export const SQGroupRow = React.memo(function SQGroupRow({ rfq, showSample, showQuote, token, onUpdated, user }) {
  const sample    = (rfq.samples    || [])[0];
  const quotation = (rfq.quotations || [])[0];

  const sharedFuDate = (showSample && sample?.follow_up_date) || (showQuote && quotation?.follow_up_date) || null;
  const sharedFuTime = (showSample && sample?.follow_up_time) || (showQuote && quotation?.follow_up_time) || null;
  const priority = sample?.priority || quotation?.priority || null;
  const groupCreatorName = personLabel(sample?.creator || quotation?.creator);
  const groupUpdaterName = personLabel(sample?.updater || quotation?.updater);
  const groupShowUpdater = groupUpdaterName && groupUpdaterName !== groupCreatorName;

  const [open, setOpen] = useState(false);

  const companyName = rfq._leadItem?.company_name || "—";
  const initials     = companyName.slice(0, 2).toUpperCase();
  const overdue       = sharedFuDate && new Date(sharedFuDate) < (() => { const d = new Date(); d.setHours(0,0,0,0); return d; })();

  const contactName  = rfq._leadItem?.primary_contact_name || "";
  const city          = rfq._leadItem?.city || "";

  return (
    <div className="border-b border-slate-100 last:border-0 bg-white">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="flex w-full items-stretch text-left transition-colors hover:bg-slate-50/80 active:bg-slate-100">

        <div className="flex pl-3 pr-0 py-3 shrink-0">
          <div className="relative">
            <div className="flex h-10 w-10 items-center justify-center rounded-full text-white text-[12px] font-bold shadow-sm bg-gradient-to-br from-indigo-500 to-violet-600">
              {initials}
            </div>
            <div className="absolute -bottom-1 -right-1 flex gap-0.5">
              
            </div>
            {overdue && <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-rose-500"/>}
          </div>
        </div>

        <div className="flex flex-1 items-center gap-2 px-3 py-3 min-w-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-1.5 min-w-0">
              <span className="truncate text-[14px] font-bold text-slate-900 leading-snug">{companyName}</span>
              {priority && (
                <span className={cls("shrink-0 text-[8px] font-bold px-1.5 py-0.5 rounded-full leading-none", PRIORITY_COLOR[priority]?.badge)}>{priority}</span>
              )}
            </div>

            {(sample?.sample_code || quotation?.quotation_code) && (
              <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-400 font-mono">
                {showSample && sample?.sample_code && <span>S-{sample.sample_code}</span>}
                {showQuote  && quotation?.quotation_code && <span>Q-{quotation.quotation_code}</span>}
              </div>
            )}

            <span className="block truncate text-[12px] text-slate-500 mt-0.5 leading-tight">
              {rfq.product_name || rfq.product_category || "Enquiry"}
            </span>

            {(contactName || city) && (
              <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-500">
                {contactName && (
                  <span className="flex items-center gap-1 truncate">
                    <Ic.User className="h-3 w-3 text-slate-400 shrink-0"/>{contactName}
                  </span>
                )}
                {city && <span className="text-slate-300 shrink-0">· {city}</span>}
              </div>
            )}

            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {showSample && (
                <span className={cls("text-[10px] font-semibold px-1.5 py-0.5 rounded ring-1 ring-inset",
                  sample?.sample_status ? (STAGE_CLS[sample.sample_status] || "bg-slate-100 text-slate-600 ring-slate-200") : "bg-rose-50 text-rose-600 ring-rose-200")}>
                  Sample{sample?.sample_status ? `: ${sample.sample_status}` : ""}
                </span>
              )}
              {showQuote && (
                <span className={cls("text-[10px] font-semibold px-1.5 py-0.5 rounded ring-1 ring-inset",
                  quotation?.quotation_status ? (STAGE_CLS[quotation.quotation_status] || "bg-slate-100 text-slate-600 ring-slate-200") : "bg-orange-50 text-orange-600 ring-orange-200")}>
                  Quote{quotation?.quotation_status ? `: ${quotation.quotation_status}` : ""}
                </span>
              )}
            </div>

            {(groupCreatorName || groupShowUpdater) && (
              <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                {groupCreatorName && (
                  <span className="text-[10px] text-slate-400">
                    By <span className="font-semibold text-slate-500">{groupCreatorName}</span>
                  </span>
                )}
                {groupShowUpdater && (
                  <span className="text-[10px] text-slate-400">
                    · Updated <span className="font-semibold text-slate-500">{groupUpdaterName}</span>
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="shrink-0 flex flex-col items-end gap-0.5 ml-1">
            {sharedFuDate ? (
              <>
                <span className={cls("text-[11px] font-semibold leading-tight", dueCls(sharedFuDate))}>{dueLabel(sharedFuDate)}</span>
                {sharedFuTime && <span className="text-[10px] text-slate-400 leading-tight">{sharedFuTime}</span>}
              </>
            ) : (
              <span className="text-[10px] text-slate-300 font-medium">No date</span>
            )}
            <div className={cls("mt-1 transition-transform duration-200", open ? "rotate-180" : "")}>
              <Ic.ChevD className="h-3.5 w-3.5 text-slate-400"/>
            </div>
          </div>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden">
            <SQCombinedPanel rfq={rfq} showSample={showSample} showQuote={showQuote} token={token} user={user} onUpdated={onUpdated} onClose={() => setOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});


const CLOSED_STAGES = new Set(["Approved", REJECTED_STAGE]);

export function SQCombinedPanel({ rfq, showSample, showQuote, token, user, onUpdated, onClose }) {
  const sample    = (rfq.samples    || [])[0];
  const quotation = (rfq.quotations || [])[0];

  const [sampleStage,   setSampleStage]   = useState(sample?.sample_status || "");
  const [quoteStage,    setQuoteStage]    = useState(quotation?.quotation_status || "");
  const [sampleDesc,    setSampleDesc]    = useState("");
  const [sampleReject,  setSampleReject]  = useState("");
  const [quoteDesc,     setQuoteDesc]     = useState("");
  const [quoteReject,   setQuoteReject]   = useState("");
  const [priority,      setPriority]      = useState(sample?.priority || quotation?.priority || "");
  const [fuDate,        setFuDate]        = useState("");
  const [fuTime,        setFuTime]        = useState("");
  const [notes,         setNotes]         = useState("");
  const [saving,        setSaving]        = useState(false);
  const [saved,         setSaved]         = useState(false);
  const [err,           setErr]           = useState("");
  const [errors,        setErrors]        = useState({});

  const sampleNeedsDesc   = showSample && sampleStage === "Approved with minor changes";
  const sampleNeedsReject = showSample && sampleStage === REJECTED_STAGE;
  const quoteNeedsDesc    = showQuote  && quoteStage  === "Approved with minor changes";
  const quoteNeedsReject  = showQuote  && quoteStage  === REJECTED_STAGE;

  const sampleClosing = !showSample || CLOSED_STAGES.has(sampleStage);
  const quoteClosing  = !showQuote  || CLOSED_STAGES.has(quoteStage);
  const needsFollowUp = !(sampleClosing && quoteClosing);

  function validate() {
    const e = {};
    if (showSample && !sampleStage) e.sampleStage = "Required";
    if (showQuote  && !quoteStage)  e.quoteStage  = "Required";
    if (!priority) e.priority = "Required";
    if (needsFollowUp && !fuDate) e.fuDate = "Follow-up date is required until Approved/Rejected";
    if (sampleNeedsDesc   && !sampleDesc.trim())   e.sampleDesc   = "Describe the changes";
    if (sampleNeedsReject && !sampleReject.trim()) e.sampleReject = "Provide a reason";
    if (quoteNeedsDesc    && !quoteDesc.trim())    e.quoteDesc    = "Describe the changes";
    if (quoteNeedsReject  && !quoteReject.trim())  e.quoteReject  = "Provide a reason";
    return e;
  }

  async function handleSave(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true); setErr("");
    try {
      const calls = [];
      if (showSample && sample?.id) {
        calls.push(fetch(`${API}/api/samples/${sample.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            sample_status: sampleStage, priority: priority || null,
            description: sampleDesc || null, reject_reason: sampleReject || null,
            notes: notes || null,
            follow_up_date: !CLOSED_STAGES.has(sampleStage) ? (fuDate || null) : null,
            follow_up_time: !CLOSED_STAGES.has(sampleStage) ? (fuTime || null) : null,
          }),
        }).then(r => r.json().then(d => ({ ok: r.ok, d }))));
      }
      if (showQuote && quotation?.id) {
        calls.push(fetch(`${API}/api/quotations/${quotation.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            quotation_status: quoteStage, priority: priority || null,
            description: quoteDesc || null, reject_reason: quoteReject || null,
            notes: notes || null,
            follow_up_date: !CLOSED_STAGES.has(quoteStage) ? (fuDate || null) : null,
            follow_up_time: !CLOSED_STAGES.has(quoteStage) ? (fuTime || null) : null,
          }),
        }).then(r => r.json().then(d => ({ ok: r.ok, d, isSample: false }))));
      }

      const results = await Promise.all(calls);
      let i = 0;
      if (showSample && sample?.id) {
        const { ok, d } = results[i++];
        if (!ok) throw new Error(d.message || "Failed to update sample");
        onUpdated && onUpdated(rfq.id, "sample", d);
      }
      if (showQuote && quotation?.id) {
        const { ok, d } = results[i++];
        if (!ok) throw new Error(d.message || "Failed to update quotation");
        onUpdated && onUpdated(rfq.id, "quotation", d);
      }

      setSaved(true); setSaving(false);
      
      setTimeout(() => {
        setSaved(false);
        setSampleDesc(""); setSampleReject(""); setQuoteDesc(""); setQuoteReject("");
        setFuDate(""); setFuTime(""); setNotes(""); setErrors({});
        onClose && onClose();

      }, 900);
    } catch (ex) { setErr(ex.message); setSaving(false); }
  }

  return (
    <form onSubmit={handleSave} className="border-t border-slate-100 bg-slate-50/30 p-3 space-y-3">

      {showSample && (
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1 flex items-center gap-1">
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-rose-100 text-rose-600 text-[8px] font-extrabold">S</span>
            Sample Stage
          </p>
          <CustomSelect
            value={sampleStage}
            onChange={(val) => { setSampleStage(val); setErrors(p => ({ ...p, sampleStage: undefined })); }}
            options={[...SAMPLE_STAGES, REJECTED_STAGE]}
            placeholder="Sample stage…"
            label="Sample Stage"
            error={errors.sampleStage}
          />
          {errors.sampleStage && <p className="mt-0.5 text-[9px] text-rose-500">{errors.sampleStage}</p>}

          <AnimatePresence initial={false}>
            {sampleNeedsDesc && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden mt-1.5">
                <textarea value={sampleDesc} onChange={e => { setSampleDesc(e.target.value); setErrors(p => ({ ...p, sampleDesc: undefined })); }}
                  placeholder="Describe minor changes required (sample)…" rows={2}
                  className={cls("w-full rounded-lg border px-2.5 py-2 text-[11px] text-slate-900 placeholder:text-slate-400 outline-none resize-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100",
                    errors.sampleDesc ? "border-rose-400 ring-2 ring-rose-100" : "border-slate-200")}/>
                {errors.sampleDesc && <p className="mt-0.5 text-[9px] text-rose-500">{errors.sampleDesc}</p>}
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence initial={false}>
            {sampleNeedsReject && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden mt-1.5">
                <textarea value={sampleReject} onChange={e => { setSampleReject(e.target.value); setErrors(p => ({ ...p, sampleReject: undefined })); }}
                  placeholder="Reason for rejection (sample)…" rows={2}
                  className={cls("w-full rounded-lg border px-2.5 py-2 text-[11px] text-slate-900 placeholder:text-slate-400 outline-none resize-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100",
                    errors.sampleReject ? "border-rose-400 ring-2 ring-rose-100" : "border-slate-200")}/>
                {errors.sampleReject && <p className="mt-0.5 text-[9px] text-rose-500">{errors.sampleReject}</p>}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {showQuote && (
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1 flex items-center gap-1">
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-orange-100 text-orange-600 text-[8px] font-extrabold">Q</span>
            Quotation Stage
          </p>
          <CustomSelect
            value={quoteStage}
            onChange={(val) => { setQuoteStage(val); setErrors(p => ({ ...p, quoteStage: undefined })); }}
            options={[...QUOTATION_STAGES, REJECTED_STAGE]}
            placeholder="Quotation stage…"
            label="Quotation Stage"
            error={errors.quoteStage}
          />
          {errors.quoteStage && <p className="mt-0.5 text-[9px] text-rose-500">{errors.quoteStage}</p>}

          <AnimatePresence initial={false}>
            {quoteNeedsDesc && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden mt-1.5">
                <textarea value={quoteDesc} onChange={e => { setQuoteDesc(e.target.value); setErrors(p => ({ ...p, quoteDesc: undefined })); }}
                  placeholder="Describe minor changes required (quotation)…" rows={2}
                  className={cls("w-full rounded-lg border px-2.5 py-2 text-[11px] text-slate-900 placeholder:text-slate-400 outline-none resize-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100",
                    errors.quoteDesc ? "border-rose-400 ring-2 ring-rose-100" : "border-slate-200")}/>
                {errors.quoteDesc && <p className="mt-0.5 text-[9px] text-rose-500">{errors.quoteDesc}</p>}
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence initial={false}>
            {quoteNeedsReject && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden mt-1.5">
                <textarea value={quoteReject} onChange={e => { setQuoteReject(e.target.value); setErrors(p => ({ ...p, quoteReject: undefined })); }}
                  placeholder="Reason for rejection (quotation)…" rows={2}
                  className={cls("w-full rounded-lg border px-2.5 py-2 text-[11px] text-slate-900 placeholder:text-slate-400 outline-none resize-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100",
                    errors.quoteReject ? "border-rose-400 ring-2 ring-rose-100" : "border-slate-200")}/>
                {errors.quoteReject && <p className="mt-0.5 text-[9px] text-rose-500">{errors.quoteReject}</p>}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <div className="pt-2 border-t border-slate-100">
        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Priority</p>
        <div className="flex gap-1.5">
          {PRIORITY_OPTIONS.map(p => (
            <button key={p} type="button"
              onClick={() => { setPriority(p); setErrors(prev => ({ ...prev, priority: undefined })); }}
              className={cls("flex-1 flex items-center justify-center gap-1 rounded-lg border py-1.5 text-[10px] font-bold transition-all active:scale-95",
                priority === p
                  ? cls(PRIORITY_COLOR[p]?.btn, "text-white shadow-sm")
                  : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50")}>
              <span className={cls("h-1.5 w-1.5 rounded-full shrink-0",
                priority === p ? "bg-white/70" : p === "High" ? "bg-rose-400" : p === "Medium" ? "bg-amber-400" : "bg-slate-300")}/>
              {p}
            </button>
          ))}
        </div>
        {errors.priority && <p className="mt-0.5 text-[9px] text-rose-500">{errors.priority}</p>}
      </div>

      <div>
        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
          Follow-up {needsFollowUp && <span className="text-rose-500">*</span>}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <input type="date" value={fuDate}
              onChange={e => { setFuDate(e.target.value); setErrors(p => ({ ...p, fuDate: undefined })); }}
              min={todayStr()}
              className={cls("w-full rounded-lg border px-2.5 py-2 text-[11px] text-slate-900 outline-none transition-all focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 hover:border-slate-300",
                errors.fuDate ? "border-rose-400 ring-2 ring-rose-100" : "border-slate-200")}/>
            {errors.fuDate && <p className="mt-0.5 text-[9px] text-rose-500">{errors.fuDate}</p>}
          </div>
          <input type="time" value={fuTime} onChange={e => setFuTime(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-[11px] text-slate-900 outline-none transition-all focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 hover:border-slate-300"/>
        </div>
      </div>

      <div>
        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Notes</p>
        <textarea value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Internal notes… (optional, shared)" rows={2}
          className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-[11px] text-slate-900 placeholder:text-slate-400 outline-none resize-none transition-all focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 hover:border-slate-300"/>
      </div>

      {err && <p className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[10px] text-rose-700">{err}</p>}

      <button type="submit" disabled={saving}
        className={cls("w-full inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-[12px] font-bold transition-all active:scale-[0.98] disabled:opacity-60",
          saved ? "bg-emerald-500 text-white" : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm shadow-indigo-200")}>
        {saving ? <><Ic.Spin className="h-3.5 w-3.5 animate-spin"/>Saving…</>
        : saved  ? <><Ic.Check className="h-3.5 w-3.5"/>Saved!</>
        : <><Ic.Zap className="h-3.5 w-3.5"/>Save Update</>}
      </button>
    </form>
  );
}

export function SQLPanel({ rfq, isSample, token, onUpdated, user, onClose }) {
  const sample    = (rfq.samples    || [])[0];
  const quotation = (rfq.quotations || [])[0];
  const activeRecord  = isSample ? sample : quotation;
  const stageOptions  = [...(isSample ? SAMPLE_STAGES : QUOTATION_STAGES), REJECTED_STAGE];
  const endpoint      = isSample ? `${API}/api/samples/${activeRecord?.id}` : `${API}/api/quotations/${activeRecord?.id}`;
  const bodyKey       = isSample ? "sample_status" : "quotation_status";
  const logTable      = isSample ? "sample_id" : "quotation_id";

  const [historyOpen,  setHistoryOpen] = useState(false);
  const [creating,      setCreating]    = useState(false);
  const [history,      setHistory]     = useState(null);
  const [loadingHist,  setLoadingHist] = useState(false);
  const [stage,        setStage]       = useState("");
  const [priority,     setPriority]    = useState("");
  const [description,  setDescription] = useState("");
  const [rejectReason, setRejectReason]= useState("");
  const [fuDate,       setFuDate]      = useState("");
  const [fuTime,       setFuTime]      = useState("");
  const [notes,        setNotes]       = useState("");
  const [saving,       setSaving]      = useState(false);
  const [saved,        setSaved]       = useState(false);
  const [err,          setErr]         = useState("");
  const [errors,       setErrors]      = useState({});

  const needsDescription  = stage === "Approved with minor changes";
  const needsRejectReason = stage === REJECTED_STAGE;
  const needsFollowUp     = stage !== "Approved" && stage !== REJECTED_STAGE;

  const currentStage    = activeRecord?.[bodyKey]      || null;
  const currentPriority = activeRecord?.priority       || null;
  const currentFuDate   = activeRecord?.follow_up_date || null;
  const currentFuTime   = activeRecord?.follow_up_time || null;
  const currentNotes    = activeRecord?.notes          || null;
  const closed          = isSqClosed(rfq, isSample);

  const creatorName = personLabel(activeRecord?.creator);
  const updaterName = personLabel(activeRecord?.updater);
  const showUpdater = updaterName && updaterName !== creatorName;

  async function fetchHistory() {
    if (history !== null) return;
    if (!activeRecord?.id) { setHistory([]); return; }
    setLoadingHist(true);
    try {
      const url  = isSample
        ? `${API}/api/samples/${activeRecord.id}/logs`
        : `${API}/api/quotations/${activeRecord.id}/logs`;
      const res  = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setHistory(data.logs || []);
    } catch { setHistory([]); }
    finally { setLoadingHist(false); }
  }

  function toggleHistory() { if (!historyOpen) fetchHistory(); setHistoryOpen(v => !v); }

  async function handleCreateRecord() {
    setCreating(true);
    try {
      const res = await fetch(`${API}/api/rfqs/${rfq.id}/ensure-sq`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to create record");
      if (isSample && data.sample)         onUpdated && onUpdated(rfq.id, "sample", data);
      if (!isSample && data.quotation)     onUpdated && onUpdated(rfq.id, "quotation", data);
    } catch (e) {
      alert(e.message);
    } finally {
      setCreating(false);
    }
  }

  function validate() {
    const e = {};
    if (!stage)    e.stage    = "Required";
    if (!priority) e.priority = "Required";
    if (needsFollowUp && !fuDate) e.fuDate = "Follow-up date is required until Approved/Rejected";
    if (needsDescription  && !description.trim())  e.description  = "Describe the changes";
    if (needsRejectReason && !rejectReason.trim())  e.rejectReason = "Provide a reason";
    return e;
  }

  function resetForm() {
    setStage(""); setPriority("");
    setDescription(""); setRejectReason("");
    setFuDate(""); setFuTime(""); setNotes("");
    setErrors({}); setErr("");
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!activeRecord?.id) { setErr("No record found"); return; }
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true); setErr("");
    try {
      const res = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          [bodyKey]: stage, priority: priority || null,
          description: description || null, reject_reason: rejectReason || null,
          notes: notes || null,
          follow_up_date: needsFollowUp ? (fuDate || null) : null,
          follow_up_time: needsFollowUp ? (fuTime || null) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed");
      setSaved(true);
      setSaving(false);
      setHistory(null);
      onUpdated && onUpdated(rfq.id, isSample ? "sample" : "quotation", data);
      setTimeout(() => { setSaved(false); resetForm(); onClose && onClose(); }, 900);
    } catch (ex) { setErr(ex.message); setSaving(false); }
  }

  return (
    <div className="border-t border-slate-100 bg-slate-50/30">
      {!activeRecord?.id && (
        <div className="mx-3 mt-2 flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <Ic.Alert className="h-3.5 w-3.5 text-amber-600 shrink-0" />
            <p className="text-[10px] text-amber-700 leading-snug">
              No {isSample ? "sample" : "quotation"} record exists for this enquiry yet.
            </p>
          </div>
          <button type="button" onClick={handleCreateRecord} disabled={creating}
            className="shrink-0 text-[10px] font-bold text-amber-700 underline disabled:opacity-50">
            {creating ? "Creating…" : "Create record"}
          </button>
        </div>
      )}

      {activeRecord?.id && user?.email === HEAD_EMAIL && (
        <div className="mx-3 mt-2 flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-slate-100/80 border border-slate-200">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[8px] font-bold uppercase tracking-widest text-slate-400 shrink-0">
              {isSample ? "Sample ID" : "Quotation ID"}
            </span>
            <span className="font-mono text-[9px] text-slate-500 select-all truncate">
              {isSample ? activeRecord.sample_code : activeRecord.quotation_code}
            </span>
          </div>

          <PurgeButton
            user={user}
            token={token}
            endpoint={
              isSample
                ? `${API}/api/purge/samples/${activeRecord.id}`
                : `${API}/api/purge/quotations/${activeRecord.id}`
            }
            itemLabel={isSample ? "sample" : "quotation"}
            size="sm"
            onDeleted={() =>
              onUpdated &&
              onUpdated(
                rfq.id,
                isSample ? "sample-deleted" : "quotation-deleted",
                null
              )
            }
          />
        </div>
      )}

      <div className="mx-3 mt-2 rounded-xl border border-slate-200 overflow-hidden">
        <button type="button" onClick={toggleHistory}
          className="flex w-full items-center justify-between px-3 py-2 hover:bg-slate-50 transition-colors">
          <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-slate-400">
            <Ic.History className="h-3 w-3"/>Update History
            {history !== null && (
              <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[8px] font-bold normal-case tracking-normal">
                {history.length}
              </span>
            )}
          </span>
          <div className={cls("transition-transform duration-200", historyOpen ? "rotate-180" : "")}>
            <Ic.ChevD className="h-3 w-3 text-slate-400"/>
          </div>
        </button>
        <AnimatePresence initial={false}>
          {historyOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden">
              <div className="border-t border-slate-100 max-h-64 overflow-y-auto divide-y divide-slate-50">
                {loadingHist && (
                  <div className="flex items-center gap-2 px-3 py-3 text-[10px] text-slate-400">
                    <Ic.Spin className="h-3 w-3 animate-spin shrink-0"/>Loading…
                  </div>
                )}
                {!loadingHist && history?.length === 0 && (
                  <p className="px-3 py-3 text-[10px] text-slate-400 text-center">No updates yet.</p>
                )}
                {!loadingHist && history?.map((log, i) => {
                  const stg = log.sample_status || log.quotation_status;
                  const logUser = personLabel(log.users) || log.users?.email;
                  return (
                    <div key={log.id || i} className="px-3 py-2 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          {stg
                            ? <span className={cls("inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold ring-1 ring-inset truncate max-w-full", STAGE_CLS[stg] || "bg-slate-100 text-slate-600 ring-slate-200")}>{stg}</span>
                            : <span className="text-[9px] text-slate-300 italic">No stage</span>}
                        </div>
                        <div className="shrink-0">
                          {log.follow_up_date
                            ? <span className={cls("text-[9px] font-semibold whitespace-nowrap", dueCls(log.follow_up_date))}>{dueLabel(log.follow_up_date)}{log.follow_up_time && <span className="font-normal text-slate-400"> · {log.follow_up_time}</span>}</span>
                            : <span className="text-[9px] text-slate-300">—</span>}
                        </div>
                      </div>
                      {log.priority && (
                        <div className="flex items-center justify-end gap-2">
                          <span className={cls("shrink-0 inline-flex items-center gap-0.5 text-[8px] font-bold",
                            log.priority === "High" ? "text-rose-500" : log.priority === "Medium" ? "text-amber-500" : "text-slate-400")}>
                            <span className={cls("h-1.5 w-1.5 rounded-full shrink-0",
                              log.priority === "High" ? "bg-rose-400" : log.priority === "Medium" ? "bg-amber-400" : "bg-slate-300")}/>
                            {log.priority}
                          </span>
                        </div>
                      )}
                      {log.notes && <p className="text-[9px] text-slate-500 leading-snug bg-slate-50 rounded px-2 py-1">{log.notes}</p>}
                      <div className="flex items-center justify-between gap-2">
                        {logUser
                          ? <span className="text-[8px] text-slate-300 truncate flex items-center gap-0.5"><Ic.User className="h-2 w-2 shrink-0"/>{logUser}</span>
                          : <span/>}
                        <span className="text-[8px] text-slate-300 shrink-0 whitespace-nowrap">{relTime(log.updated_at)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <form onSubmit={handleSave} className="mx-3 mt-2 mb-3 rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 border-b border-slate-100">
          <Ic.Zap className="h-3 w-3 text-amber-400 shrink-0"/>
          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">New Update</span>
          {currentStage && (
            <span className="ml-auto text-[9px] text-slate-400">
              Currently: <span className="font-semibold text-slate-600">{currentStage}</span>
              {!closed && currentFuDate && <span> · <span className={dueCls(currentFuDate)}>{dueLabel(currentFuDate)}</span></span>}
            </span>
          )}
        </div>
        <div className="p-3 space-y-2">
          <div>
            <CustomSelect
              value={stage}
              onChange={(val) => { setStage(val); setErrors(p => ({ ...p, stage: undefined })); }}
              options={stageOptions}
              placeholder="Stage…"
              label="Stage"
              error={errors.stage}
            />
            {errors.stage && <p className="mt-0.5 text-[9px] text-rose-500">{errors.stage}</p>}
          </div>

          <AnimatePresence initial={false}>
            {needsDescription && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden">
                <textarea value={description} onChange={e => { setDescription(e.target.value); setErrors(p => ({ ...p, description: undefined })); }}
                  placeholder="Describe minor changes required…" rows={2}
                  className={cls("w-full rounded-lg border px-2.5 py-2 text-[11px] text-slate-900 placeholder:text-slate-400 outline-none resize-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100",
                    errors.description ? "border-rose-400 ring-2 ring-rose-100" : "border-slate-200")}/>
                {errors.description && <p className="mt-0.5 text-[9px] text-rose-500">{errors.description}</p>}
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence initial={false}>
            {needsRejectReason && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden">
                <textarea value={rejectReason} onChange={e => { setRejectReason(e.target.value); setErrors(p => ({ ...p, rejectReason: undefined })); }}
                  placeholder="Reason for rejection…" rows={2}
                  className={cls("w-full rounded-lg border px-2.5 py-2 text-[11px] text-slate-900 placeholder:text-slate-400 outline-none resize-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100",
                    errors.rejectReason ? "border-rose-400 ring-2 ring-rose-100" : "border-slate-200")}/>
                {errors.rejectReason && <p className="mt-0.5 text-[9px] text-rose-500">{errors.rejectReason}</p>}
              </motion.div>
            )}
          </AnimatePresence>

          <div>
            <div className="flex gap-1.5">
              {PRIORITY_OPTIONS.map(p => (
                <button key={p} type="button"
                  onClick={() => { setPriority(p); setErrors(prev => ({ ...prev, priority: undefined })); }}
                  className={cls("flex-1 flex items-center justify-center gap-1 rounded-lg border py-1.5 text-[10px] font-bold transition-all active:scale-95",
                    priority === p
                      ? cls(PRIORITY_COLOR[p]?.btn, "text-white shadow-sm")
                      : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50")}>
                  <span className={cls("h-1.5 w-1.5 rounded-full shrink-0",
                    priority === p ? "bg-white/70" : p === "High" ? "bg-rose-400" : p === "Medium" ? "bg-amber-400" : "bg-slate-300")}/>
                  {p}
                </button>
              ))}
            </div>
            {errors.priority && <p className="mt-0.5 text-[9px] text-rose-500">{errors.priority}</p>}
          </div>

          <AnimatePresence initial={false}>
            {needsFollowUp && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400 mb-1">Follow-up</p>
                    <input type="date" value={fuDate}
                      onChange={e => { setFuDate(e.target.value); setErrors(p => ({ ...p, fuDate: undefined })); }}
                      min={todayStr()}
                      className={cls("w-full rounded-lg border px-2.5 py-2 text-[11px] text-slate-900 outline-none transition-all focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 hover:border-slate-300",
                        errors.fuDate ? "border-rose-400 ring-2 ring-rose-100" : "border-slate-200")}/>
                    {errors.fuDate && <p className="mt-0.5 text-[9px] text-rose-500">{errors.fuDate}</p>}
                  </div>
                  <div>
                    <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400 mb-1">Time <span className="normal-case font-normal text-slate-300">(opt)</span></p>
                    <input type="time" value={fuTime} onChange={e => setFuTime(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-[11px] text-slate-900 outline-none transition-all focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 hover:border-slate-300"/>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Internal notes… (optional)" rows={2}
            className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-[11px] text-slate-900 placeholder:text-slate-400 outline-none resize-none transition-all focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 hover:border-slate-300"/>

          {err && <p className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[10px] text-rose-700">{err}</p>}

          <button type="submit" disabled={saving}
            className={cls("w-full inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-[12px] font-bold transition-all active:scale-[0.98] disabled:opacity-60",
              saved ? "bg-emerald-500 text-white" : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm shadow-indigo-200")}>
            {saving ? <><Ic.Spin className="h-3.5 w-3.5 animate-spin"/>Saving…</>
            : saved  ? <><Ic.Check className="h-3.5 w-3.5"/>Saved!</>
            : <><Ic.Zap className="h-3.5 w-3.5"/>Save Update</>}
          </button>
        </div>
      </form>
    </div>
  );
}

const SQFlatRow = React.memo(function SQFlatRow({ rfq, isSample, token, onUpdated, user }) {
  const record          = isSample ? (rfq.samples || [])[0] : (rfq.quotations || [])[0];
  const closed          = isSqClosed(rfq, isSample);
  const currentFuDate   = !closed ? (record?.follow_up_date || null) : null;
  const currentFuTime   = !closed ? (record?.follow_up_time || null) : null;
  const currentPriority = record?.priority       || null;
  const currentStage  = record?.[isSample ? "sample_status" : "quotation_status"] || null;

  const [open, setOpen] = useState(false);

  const companyName = rfq._leadItem?.company_name || "—";
  const initials    = companyName.slice(0, 2).toUpperCase();
  const overdue     = currentFuDate && new Date(currentFuDate) < (() => { const d = new Date(); d.setHours(0,0,0,0); return d; })();
  const stripeColor = PRIORITY_COLOR[currentPriority]?.stripe || "bg-slate-200";

  const rowCreatorName = personLabel(record?.creator);
  const rowUpdaterName = personLabel(record?.updater);
  const rowShowUpdater = rowUpdaterName && rowUpdaterName !== rowCreatorName;

  return (
    <div className="border-b border-slate-100 last:border-0 bg-white">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="flex w-full items-stretch text-left transition-colors hover:bg-slate-50/80 active:bg-slate-100">

        <div className="flex items-center pl-3 pr-0 py-3 shrink-0">
          <div className="relative">
            <div className={cls(
              "flex h-10 w-10 items-center justify-center rounded-full text-white text-[12px] font-bold shadow-sm",
              isSample
                ? "bg-gradient-to-br from-rose-500 to-pink-600"
                : "bg-gradient-to-br from-orange-400 to-amber-500"
            )}>
              {initials}
            </div>
            <span className={cls(
              "absolute -bottom-0.5 -right-0.5 flex h-[15px] w-[15px] items-center justify-center rounded-full border-2 border-white text-[7px] font-extrabold text-white",
              isSample ? "bg-rose-500" : "bg-orange-500"
            )}>
              {isSample ? "S" : "Q"}
            </span>
            {overdue && (
              <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-rose-500"/>
            )}
          </div>
        </div>

        <div className="flex flex-1 items-center gap-2 px-3 py-3 min-w-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-1.5 min-w-0">
              <span className="truncate text-[14px] font-bold text-slate-900 leading-snug">
                {companyName}
              </span>
              <span className={cls(
                "shrink-0 text-[10px] font-semibold",
                isSample ? "text-rose-500" : "text-orange-500"
              )}>
                {isSample ? "Sample" : "Quotation"}
              </span>
              {currentPriority && (
                <span className={cls("shrink-0 text-[8px] font-bold px-1.5 py-0.5 rounded-full leading-none", PRIORITY_COLOR[currentPriority]?.badge)}>
                  {currentPriority}
                </span>
              )}
            </div>
            {record?.[isSample ? "sample_code" : "quotation_code"] && (
              <span className="block text-[10px] text-slate-400 font-mono mt-0.5">
                {record[isSample ? "sample_code" : "quotation_code"]}
              </span>
            )}
            <span className="block truncate text-[12px] text-slate-500 mt-0.5 leading-tight">
              {rfq.product_name || rfq.product_category || "Enquiry"}
            </span>
            {currentStage && (
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <span className={cls("text-[10px] font-semibold px-1.5 py-0.5 rounded ring-1 ring-inset", STAGE_CLS[currentStage] || "bg-slate-100 text-slate-600 ring-slate-200")}>
                  {currentStage}
                </span>
              </div>
            )}
            {(rfq.consumption_per_month || rfq.target_price) && (
              <div className="flex items-center gap-2 mt-0.5">
                {rfq.consumption_per_month && (
                  <span className="inline-flex items-center gap-0.5 text-[11px] text-slate-400">
                    <Ic.Package className="h-2.5 w-2.5"/>
                    {rfq.consumption_per_month}{rfq.unit ? ` ${rfq.unit}` : ""}/mo
                  </span>
                )}
                {rfq.target_price && (
                  <span className="text-[11px] font-semibold text-slate-400">₹{rfq.target_price}</span>
                )}
              </div>
            )}
            {(rowCreatorName || rowShowUpdater) && (
              <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                {rowCreatorName && (
                  <span className="text-[10px] text-slate-400">
                    By <span className="font-semibold text-slate-500">{rowCreatorName}</span>
                  </span>
                )}
                {rowShowUpdater && (
                  <span className="text-[10px] text-slate-400">
                    · Updated <span className="font-semibold text-slate-500">{rowUpdaterName}</span>
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="shrink-0 flex flex-col items-end gap-0.5 ml-1">
            {currentFuDate ? (
              <>
                <span className={cls("text-[11px] font-semibold leading-tight", dueCls(currentFuDate))}>
                  {dueLabel(currentFuDate)}
                </span>
                {currentFuTime && (
                  <span className="text-[10px] text-slate-400 leading-tight">{currentFuTime}</span>
                )}
              </>
            ) : (
              <span className="text-[10px] text-slate-300 font-medium">{closed ? "Closed" : "No date"}</span>
            )}
            <div className={cls("mt-1 transition-transform duration-200", open ? "rotate-180" : "")}>
              <Ic.ChevD className="h-3.5 w-3.5 text-slate-400"/>
            </div>
          </div>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <SQLPanel rfq={rfq} isSample={isSample} token={token} onUpdated={onUpdated} user={user} onClose={() => setOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

export default SQFlatRow;