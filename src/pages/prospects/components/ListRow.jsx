import { cls, Tag } from "../ui/primitives";
import { Ic, contactCls, ContactIcon } from "../icons";
import { isOverdue, isToday, isTomorrow, fmtD, dueCls, dueLabel, latestFU, extractTimeFromNotes, extractTimeFromFeedback } from "../utils";
import { isEnquiryClosed } from "../utils";

/* ── Format 24h → 12h ── */
function fmt12(t) {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

/* ── Derive next action for a lead from its open RFQs ── */
function getLeadNextAction(rfqs = []) {
  const open = rfqs.filter(r => !isEnquiryClosed(r));
  if (!open.length) return null;
  const sorted = [...open].sort((a, b) => {
    const aD = latestFU(a)?.followup_date || "9999";
    const bD = latestFU(b)?.followup_date || "9999";
    return aD.localeCompare(bD);
  });
  return latestFU(sorted[0])?.next_action || null;
}

/* ── Next action accent colour ── */
function nextActionCls(action = "") {
  const a = action.toLowerCase();
  if (a.includes("sample"))                                        return "text-teal-500";
  if (a.includes("quotation") || a.includes("quote") || a.includes("price")) return "text-violet-500";
  if (a.includes("order") || a.includes("dispatch") || a.includes("payment")) return "text-emerald-600";
  if (a.includes("close") || a.includes("no further"))            return "text-slate-400";
  return "text-amber-500";
}

export default function ListRow({ item, nearDate, contactType, matchingRFQs = [], rfqs = [], onClick }) {
  const isLead   = item._type === "lead";
  const overdue  = isOverdue(nearDate);
  const today    = isToday(nearDate);
  const tomorrow = isTomorrow(nearDate);

  const initials = (item.company_name || "?").slice(0, 2).toUpperCase();
  const avatarBg = isLead
    ? "bg-gradient-to-br from-indigo-500 to-violet-600"
    : "bg-gradient-to-br from-teal-400 to-emerald-500";

  // Subtitle: industry / nature of business, plus city
  const industry = item.industry || item.nature_of_business || "";
  const city     = item.city || "";
  const subtitle = [industry, city].filter(Boolean).join(" · ");

  // Date label & colour
  const dateLabel = nearDate
    ? overdue ? "Overdue" : today ? "Today" : tomorrow ? "Tomorrow" : fmtD(nearDate)
    : null;
  const dateLabelCls = overdue
    ? "text-rose-500 font-semibold"
    : today
    ? "text-amber-500 font-semibold"
    : tomorrow
    ? "text-sky-500 font-medium"
    : "text-slate-400";

  // Time: for leads pull from the nearest open RFQ's latest follow-up notes;
  // for prospects pull from item.feedback
  const nearTime = (() => {
    if (isLead) {
      const open = rfqs.filter(r => !isEnquiryClosed(r));
      if (!open.length) return null;
      const sorted = [...open].sort((a, b) => {
        const aD = latestFU(a)?.followup_date || "9999";
        const bD = latestFU(b)?.followup_date || "9999";
        return aD.localeCompare(bD);
      });
      return extractTimeFromNotes(latestFU(sorted[0])?.notes || "") || null;
    }
    return extractTimeFromFeedback(item.feedback || "") || null;
  })();

  // Next action — leads only
  const nextAction = isLead ? getLeadNextAction(rfqs) : null;

  // S / Q flags — only show when at least one RFQ carries the requirement
  const hasSample = isLead && rfqs.some(r => r.sample_required);
  const hasQuote  = isLead && rfqs.some(r => r.quotation_required);

  return (
    <button
      onClick={onClick}
      className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-slate-50/80 active:bg-slate-100 border-b border-slate-100 last:border-0"
    >
      {/* ── Avatar ── */}
      <div className="relative mt-0.5 shrink-0">
        <div className={cls(
          "flex h-10 w-10 items-center justify-center rounded-full text-white text-[12px] font-bold shadow-sm",
          avatarBg
        )}>
          {initials}
        </div>

        {/* L / P badge */}
        <span className={cls(
          "absolute -bottom-0.5 -right-0.5 flex h-[15px] w-[15px] items-center justify-center rounded-full border-2 border-white text-[7px] font-extrabold text-white",
          isLead ? "bg-indigo-600" : "bg-teal-500"
        )}>
          {isLead ? "L" : "P"}
        </span>

        {/* Urgency dot */}
        {(overdue || today) && (
          <span className={cls(
            "absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white",
            overdue ? "bg-rose-500" : "bg-amber-400"
          )} />
        )}
      </div>

      {/* ── Body ── */}
      <div className="min-w-0 flex-1">

        {/* Line 1 — company name + Lead/Prospect label · date on right */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex items-baseline gap-1.5">
            <span className="truncate text-[14px] font-bold text-slate-900 leading-snug">
              {item.company_name}
            </span>
            <span className={cls(
              "shrink-0 text-[10px] font-semibold",
              isLead ? "text-indigo-400" : "text-teal-500"
            )}>
              {isLead ? "Lead" : "Prospect"}
            </span>
          </div>
          {dateLabel && (
            <div className="shrink-0 flex items-center gap-1 mt-px">
              {nearTime && (
                <>
                  <span className={cls("text-[11px] leading-snug", dateLabelCls)}>
                    {fmt12(nearTime)}
                  </span>
                  <span className="text-slate-300 text-[10px]">·</span>
                </>
              )}
              <span className={cls("text-[11px] leading-snug", dateLabelCls)}>
                {dateLabel}
              </span>
              
            </div>
          )}
        </div>

        {/* Line 2 — industry · city on left, contact type chip on right */}
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p className="truncate text-[12px] text-slate-400 leading-snug">
            {subtitle}
          </p>
          {contactType && (
            <span className={cls(
              "shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset",
              contactCls(contactType)
            )}>
              <ContactIcon type={contactType} className="h-2.5 w-2.5" />
              {contactType}
            </span>
          )}
        </div>

        {/* Line 3 — next action (leads only) */}
        {nextAction && (
          <div className="mt-1 flex items-center gap-1">
            <Ic.Zap className={cls("h-3 w-3 shrink-0", nextActionCls(nextAction))} />
            <span className={cls("truncate text-[12px] font-semibold leading-snug", nextActionCls(nextAction))}>
              {nextAction}
            </span>
          </div>
        )}

        {/* Line 4 — S / Q full-label chips (leads only) */}
        {(hasSample || hasQuote) && (
          <div className="mt-1.5 flex items-center gap-1.5">
            {hasSample && (
              <span className="inline-flex items-center rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-700 ring-1 ring-inset ring-teal-200">
                Sample
              </span>
            )}
            {hasQuote && (
              <span className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700 ring-1 ring-inset ring-violet-200">
                Quotation
              </span>
            )}
          </div>
        )}

        {/* Matching RFQs — only shown in SQ filter mode */}
        {matchingRFQs.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {matchingRFQs.map((rfq, i) => {
              const fups = [...(rfq.rfq_followups || [])]
                .filter(f => !f.deleted_at)
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
              const latestFup = fups[0] || null;
              const closed    = isEnquiryClosed(rfq);
              return (
                <div key={rfq.id || i} className={cls(
                  "rounded-xl border px-3 py-2 space-y-1",
                  closed
                    ? "border-slate-100 bg-slate-50"
                    : "border-indigo-100 bg-white shadow-sm shadow-indigo-50/60"
                )}>
                  <p className="text-[11.5px] font-semibold text-slate-800 truncate leading-snug">
                    {rfq.product_name || rfq.product_category || "Enquiry"}
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {rfq.consumption_per_month && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                          <Ic.Package className="h-2.5 w-2.5" />
                          {rfq.consumption_per_month} {rfq.unit || ""}/mo
                        </span>
                      )}
                      {(latestFup?.target_price || rfq.target_price) && (
                        <span className="text-[10px] font-semibold text-slate-600">
                          ₹{latestFup?.target_price || rfq.target_price}
                        </span>
                      )}
                    </div>
                    {latestFup?.followup_date && !closed && (
                      <span className={cls("text-[10px] font-semibold shrink-0", dueCls(latestFup.followup_date))}>
                        {dueLabel(latestFup.followup_date)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </button>
  );
}