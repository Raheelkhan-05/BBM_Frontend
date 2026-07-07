import React from "react";
import { cls } from "../ui/primitives";
import { Ic, ContactIcon } from "../icons";
import {
  isOverdue, isToday, isTomorrow, fmtD,
  latestFU, extractTimeFromNotes, extractTimeFromFeedback,
  dueCls, dueLabel,
} from "../utils";
import { isEnquiryClosed } from "../utils";

/* ─── helpers ──────────────────────────────────────────────── */
function fmt12(t) {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}
function dialable(phone) {
  const digits = (phone || "").replace(/\D/g, "");
  return digits.startsWith("91") && digits.length > 10 ? digits : `91${digits}`;
}
// Display name from a creator/updater user object, falling back to email.
function personLabel(p) {
  if (!p) return null;
  const name = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
  return name || p.email || null;
}

function WaIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

const CHIP_TYPES = new Set(["Call", "Email", "WhatsApp", "Visit", "Meeting"]);
const CT_CLS = {
  Call:     "bg-emerald-50 text-emerald-700 ring-emerald-200",
  WhatsApp: "bg-green-50   text-green-700   ring-green-200",
  Email:    "bg-sky-50     text-sky-700     ring-sky-200",
  Visit:    "bg-violet-50  text-violet-700  ring-violet-200",
  Meeting:  "bg-indigo-50  text-indigo-700  ring-indigo-200",
};
function chipHref(type, phone, email) {
  const t = (type || "").toLowerCase();
  if (t === "call"     && phone) return { href: `tel:${phone}`,                     target: "_self"  };
  if (t === "whatsapp" && phone) return { href: `https://wa.me/${dialable(phone)}`, target: "_blank" };
  if (t === "email"    && email) return { href: `mailto:${email}`,                  target: "_self"  };
  return null;
}

function IconBtn({ href, target, title, children, onClick }) {
  return (
    <a href={href} target={target} rel="noopener noreferrer" title={title} onClick={onClick}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 active:scale-95">
      {children}
    </a>
  );
}

// `isLeadStage` — derived by the parent (Pipeline.jsx) from whether this
// record has any active enquiries (rfqMap[item.id]?.length > 0). There's
// only one entity now (`leads`); Prospect vs Lead is purely a stage badge,
// not a separate type — so this must be passed in rather than inferred
// from item._type (which is always "lead" post-merge).
//
// `completed` = every enquiry this record has has already been converted to
// an order — nothing left to follow up on, so no due date is shown at all;
// a small "Completed" marker sits at the bottom of the row instead.
//
// Dead records (item.status === "Dead") work the same way: no follow-up
// date, a "Dead" marker at the bottom of the row instead, and (handled in
// Pipeline.jsx's sort) they sink to the bottom of the list.
const ListRow = React.memo(function ListRow({ item, nearDate, contactType, rfqs = [], isLeadStage = false, completed = false, onClick }) {
  const isLead  = isLeadStage;
  const isDead  = item.status === "Dead";
  const done    = completed || isDead;

  const overdue = !done && isOverdue(nearDate);
  const today   = !done && isToday(nearDate);
  const tmrw    = !done && isTomorrow(nearDate);

  const initials = (item.company_name || "?").slice(0, 2).toUpperCase();
  const avatarBg = isLead
    ? "bg-gradient-to-br from-indigo-500 to-violet-600"
    : "bg-gradient-to-br from-teal-400 to-emerald-500";

  const dateLabel = !done && nearDate
    ? overdue ? "Overdue" : today ? "Today" : tmrw ? "Tomorrow" : fmtD(nearDate)
    : null;
  const dateLabelCls = overdue ? "text-rose-500 font-semibold"
    : today  ? "text-amber-500 font-semibold"
    : tmrw   ? "text-sky-500 font-medium"
    : "text-slate-400";

  const nearTime = (() => {
    if (done) return null;
    if (isLead) {
      const open = rfqs.filter(r => !isEnquiryClosed(r));
      if (!open.length) return null;
      const sorted = [...open].sort((a, b) =>
        (latestFU(a)?.followup_date || "9999").localeCompare(latestFU(b)?.followup_date || "9999")
      );
      return extractTimeFromNotes(latestFU(sorted[0])?.notes || "") || null;
    }
    return extractTimeFromFeedback(item.feedback || "") || null;
  })();

  // Single entity now — contact fields always live on the record itself
  // (primary_*), regardless of whether it's still prospect-stage or has
  // graduated to lead-stage.
  const contactName = item.primary_contact_name || "";
  const phone       = item.primary_phone        || "";
  const email       = item.primary_email        || "";

  const chipType = CHIP_TYPES.has(contactType) ? contactType : null;
  const link     = chipType ? chipHref(chipType, phone, email) : null;

  const creatorName = personLabel(item.creator);
  const updaterName = personLabel(item.updater);
  const showUpdater = updaterName && updaterName !== creatorName;

  function stop(e) { e.stopPropagation(); }

  return (
    <button
      onClick={onClick}
      className={cls(
        "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors border-b border-slate-100 last:border-0",
        isDead ? "opacity-70 hover:opacity-100 hover:bg-slate-50/80 active:bg-slate-100" : "hover:bg-slate-50/80 active:bg-slate-100"
      )}
    >
      {/* Avatar */}
      <div className="relative mt-0.5 shrink-0">
        <div className={cls("flex h-10 w-10 items-center justify-center rounded-full text-white text-[12px] font-bold shadow-sm", isDead ? "bg-gradient-to-br from-slate-400 to-slate-500" : avatarBg)}>
          {initials}
        </div>
        <span className={cls(
          "absolute -bottom-0.5 -right-0.5 flex h-[15px] w-[15px] items-center justify-center rounded-full border-2 border-white text-[7px] font-extrabold text-white",
          isLead ? "bg-indigo-600" : isDead ? "bg-slate-500" : "bg-teal-500"
        )}>
          {isLead ? "L" : "P"}
        </span>
        {(overdue || today) && (
          <span className={cls("absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white", overdue ? "bg-rose-500" : "bg-amber-400")} />
        )}
      </div>

      {/* Body */}
      <div className="min-w-0 flex-1">
        {/* Line 1: Company · date */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex items-baseline gap-1.5">
            <span className={cls("truncate text-[14px] font-bold leading-snug", isDead ? "text-slate-500" : "text-slate-900")}>{item.company_name}</span>
            <span className={cls("shrink-0 text-[10px] font-semibold", isLead ? "text-indigo-400" : "text-teal-500")}>
              {isLead ? "Lead" : "Prospect"}
            </span>
          </div>
          {isDead ? (
            <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 ring-1 ring-inset ring-slate-200 mt-px">
              <Ic.X className="h-2.5 w-2.5" /> Dead
            </span>
          ) : dateLabel && (
            <div className="shrink-0 flex items-center gap-1 mt-px">
              {nearTime && <><span className={cls("text-[11px] leading-snug", dateLabelCls)}>{fmt12(nearTime)}</span><span className="text-slate-300 text-[10px]">·</span></>}
              <span className={cls("text-[11px] leading-snug", dateLabelCls)}>{dateLabel}</span>
            </div>
          )}
        </div>
        {/* Line 2: Contact name · chip */}
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <div className="min-w-0 flex items-center gap-1">
            <Ic.User className="h-3 w-3 text-slate-400 shrink-0" />
            <span className="truncate text-[12px] text-slate-500 leading-snug">{contactName || "—"}</span>
          </div>
          {chipType && !isDead && (
            link ? (
              <a href={link.href} target={link.target} rel="noopener noreferrer" onClick={stop}
                className={cls("shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset transition-opacity hover:opacity-75 active:scale-95", CT_CLS[chipType] || "bg-slate-100 text-slate-500 ring-slate-200")}>
                <ContactIcon type={chipType} className="h-2.5 w-2.5" />{chipType}
              </a>
            ) : (
              <span className={cls("shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset", CT_CLS[chipType] || "bg-slate-100 text-slate-500 ring-slate-200")}>
                <ContactIcon type={chipType} className="h-2.5 w-2.5" />{chipType}
              </span>
            )
          )}
        </div>
        {/* Line 3: icon buttons */}
        {(phone || email) && (
          <div className="mt-1.5 flex items-center gap-1.5">
            {phone && <IconBtn href={`tel:${phone}`} target="_self" title={`Call ${phone}`} onClick={stop}><Ic.Phone className="h-3.5 w-3.5"/></IconBtn>}
            {phone && <IconBtn href={`https://wa.me/${dialable(phone)}`} target="_blank" title={`WhatsApp ${phone}`} onClick={stop}><WaIcon className="h-3.5 w-3.5"/></IconBtn>}
            {email && <IconBtn href={`mailto:${email}`} target="_self" title={email} onClick={stop}><Ic.Mail className="h-3.5 w-3.5"/></IconBtn>}
          </div>
        )}
        {/* Line 4: created by / last updated by — team visibility */}
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
        {/* Line 5: completed marker */}
        {completed && (
          <div className="mt-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
              <Ic.Check className="h-2.5 w-2.5" /> Completed
            </span>
          </div>
        )}
      </div>
    </button>
  );
});

export default ListRow;