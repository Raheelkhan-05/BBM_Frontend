import { useState, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { useRoutes } from "../../../hooks/useRoutes";
import { PROSPECT_STATUS_CLS } from "../constants";
import {
  isEnquiryClosed, missingForEnquiry, extractTimeFromFeedback, cleanFeedback,
  fmtD, dueCls, dueLabel,
} from "../utils";
import { isOrderReady } from "../sqStatus";
import { Ic, contactCls, ContactIcon } from "../icons";
import { Backdrop, Sheet, SheetHead, Tag, PBtn, DRow, cls } from "../ui/primitives";
import { CollapsibleDetailSection } from "../ui/CollapsibleSection";
import UpdateStatusInline from "./UpdateStatusInline";
import ProspectActivityLog from "./ProspectActivityLog";
import EnquiryCard from "./EnquiryCard";
import AddEnquiryForm from "./AddEnquiryForm";
import LeadForm from "./LeadForm";
import PurgeButton from "../../components/PurgeButton";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

// Display name from a creator/updater user object, falling back to email.
function personLabel(p) {
  if (!p) return null;
  const name = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
  return name || p.email || null;
}

export default function DetailPanel({
  item, user, token, rfqsForLead, ordersByRfq = {},
  onClose, onEdit, onDelete, onConverted, onEnquirySaved, onEnquiryUpdated, onPurged, productsHook,
}) {
  const isLead  = item._type === "lead";
  const isAdmin = user?.role === "Admin";
  // Team model: anyone can edit any record — created_by/updated_by now
  // track authorship for display, not permission.
  const canEdit = true;
  const routesHook = useRoutes();

  const [missingFields, setMissingFields] = useState([]);
  const [showAddEnq,    setShowAddEnq]    = useState(false);
  const [showLeadForm,  setShowLeadForm]  = useState(false);
  const [localItem,     setLocalItem]     = useState(item);

  useEffect(() => { setLocalItem(item); }, [item]);

  function handleAddEnquiry() {
    const m = missingForEnquiry(item);
    if (m.length) { setMissingFields(m); return; }
    setMissingFields([]);
    setShowAddEnq(true);
  }

  const allRFQs = rfqsForLead || [];

  // An rfq counts as "closed" for this panel either because the general
  // enquiry status says so, because it's already been formally converted to
  // an order, or because every required sample/quotation part has been
  // Approved (order-ready, even if not converted yet). Those are shown as
  // completed, sorted to the bottom, without a follow-up date.
  const isDone = (r) => isEnquiryClosed(r) || Boolean(ordersByRfq[r.id]) || isOrderReady(r);

  const openRFQs = allRFQs.filter(r => !isDone(r)).sort((a, b) => {
    const aD = (a.rfq_followups || []).filter(f => !f.deleted_at).sort((x, y) => new Date(x.followup_date) - new Date(y.followup_date))[0]?.followup_date || "9999";
    const bD = (b.rfq_followups || []).filter(f => !f.deleted_at).sort((x, y) => new Date(x.followup_date) - new Date(y.followup_date))[0]?.followup_date || "9999";
    return aD.localeCompare(bD);
  });
  const closedRFQs = allRFQs.filter(isDone);
  const sortedRFQs = [...openRFQs, ...closedRFQs];

  const prospectTime   = !isLead ? extractTimeFromFeedback(localItem.feedback) : null;
  const prospectRemark = !isLead ? cleanFeedback(localItem.feedback) : null;

  const creatorName = personLabel(localItem.creator);
  const updaterName = personLabel(localItem.updater);
  const showUpdater = updaterName && updaterName !== creatorName;

  const purgeEndpoint = isLead
    ? `${API}/api/purge/leads/${localItem.id}`
    : `${API}/api/purge/prospects/${localItem.id}`;
  const purgeLabel = isLead ? "lead" : "prospect";
  const purgeConfirmMessage = isLead
    ? `Permanently delete the lead "${localItem.company_name}" — including ALL its enquiries, samples, quotations, and follow-ups? The originating prospect record (if any) will be kept. This cannot be undone.`
    : `Permanently delete "${localItem.company_name}" and everything linked to it — lead, enquiries, samples, quotations, follow-ups, and all history? This cannot be undone.`;

  const headerExtra = (
    <div className="flex items-center gap-1">
      {canEdit && (
        <button onClick={() => { onEdit(localItem); onClose(); }} title={isLead ? "Edit lead" : "Edit prospect"}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-indigo-600 transition-colors">
          <Ic.Edit className="h-4 w-4"/>
        </button>
      )}
      <PurgeButton
        user={user}
        token={token}
        endpoint={purgeEndpoint}
        itemLabel={purgeLabel}
        confirmMessage={purgeConfirmMessage}
        size="sm"
        onDeleted={(data) => {
          onPurged?.(localItem, data);
          onClose(); // the record itself is gone either way now — close the panel
        }}
      />
    </div>
  );

  // Converting a prospect to a lead should replace this detail panel
  // entirely with the LeadForm — not stack the form on top of a still-open
  // panel. Early-return here so the prospect sheet unmounts the instant
  // "Convert to Lead" is pressed.
  //
  // Importantly, LeadForm's own onClose prop is wired to the *outer*
  // onClose (the one that closes this whole DetailPanel), not a local
  // "go back to prospect detail" setter. LeadForm's submit() always calls
  // onClose() after a successful save (in addition to onSaved()) — if that
  // local onClose just flipped showLeadForm back to false, saving would
  // land the user back on the prospect detail sheet instead of closing.
  // Routing both Cancel and Save through the same outer onClose means the
  // whole flow closes cleanly either way, and never reopens this panel.
  if (showLeadForm) {
    return (
      <LeadForm
        prospect={localItem}
        token={token}
        routesHook={routesHook}
        productsHook={productsHook}
        onClose={onClose}
        onSaved={lead => { onConverted(lead); onClose(); }}
        onEnquirySaved={onEnquirySaved}
      />
    );
  }

  return (
    <Backdrop>
      <Sheet wide onClick={(e) => e.stopPropagation()}>
        <SheetHead
          title={localItem.company_name}
          subtitle={localItem.industry || localItem.nature_of_business || ""}
          onClose={onClose}
          accent="bg-gradient-to-r from-white to-indigo-50/30"
          extraActions={headerExtra}
        />

        <div className="p-5 pb-4">
          {/* Tags row */}
          <div className="mb-4 flex flex-wrap gap-1.5">
            <Tag className={cls("ring-1 ring-inset", isLead ? "bg-indigo-50 text-indigo-600 ring-indigo-200" : "bg-teal-50 text-teal-600 ring-teal-200")}>{isLead ? "Lead" : "Prospect"}</Tag>
            {localItem.zone   && <Tag className="bg-sky-50 text-sky-700 ring-sky-200">{localItem.zone}</Tag>}
            {localItem.city   && <Tag>{localItem.city}</Tag>}
            {localItem.state  && <Tag className="bg-teal-50 text-teal-700 ring-teal-200">{localItem.state}</Tag>}
            {localItem.source && <Tag className="bg-violet-50 text-violet-700 ring-violet-200">{localItem.source}</Tag>}
            {localItem.prospect_status && <Tag className={cls(PROSPECT_STATUS_CLS[localItem.prospect_status] || "bg-slate-100 text-slate-500 ring-slate-200", "ring-1 ring-inset")}>{localItem.prospect_status}</Tag>}
          </div>

          {/* Team attribution — who created it, who last touched it */}
          {(creatorName || showUpdater) && (
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2">
              <Ic.User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              {creatorName && (
                <span className="text-[12px] text-slate-500">
                  Created by <span className="font-semibold text-slate-700">{creatorName}</span>
                </span>
              )}
              {showUpdater && (
                <span className="text-[12px] text-slate-500">
                  <span className="text-slate-300 mx-1">·</span>
                  Last updated by <span className="font-semibold text-slate-700">{updaterName}</span>
                </span>
              )}
            </div>
          )}

          {/* Company info */}
          <CollapsibleDetailSection title="Company Info" icon={Ic.Building} className="mb-3">
            <DRow label="Industry / Type" value={localItem.industry || localItem.nature_of_business}/>
            <DRow label="Country"  value={localItem.country}/>
            <DRow label="State"    value={localItem.state}/>
            <DRow label="City"     value={localItem.city}/>
            <DRow label="Zone"     value={localItem.zone}/>
            <DRow label="Route"    value={localItem.route}/>
            {localItem.company_website && <DRow label="Website" value={<a href={localItem.company_website} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline text-sm">{localItem.company_website}</a>}/>}
            <DRow label="Created"  value={fmtD(localItem.created_at)}/>
          </CollapsibleDetailSection>

          {/* Prospect contact */}
          {!isLead && (localItem.contact_name || localItem.contact_phone || localItem.contact_email || localItem.contact_designation) && (
            <CollapsibleDetailSection title="Contact" icon={Ic.User} accent="sky" className="mb-3">
              <DRow label="Name"        value={localItem.contact_name}/>
              <DRow label="Designation" value={localItem.contact_designation}/>
              <DRow label="Phone"       value={localItem.contact_phone} mono/>
              <DRow label="Email"       value={localItem.contact_email}/>
            </CollapsibleDetailSection>
          )}

          {/* Scheduled action + inline update (prospect only) */}
          {!isLead && (
            <div className="rounded-xl border border-amber-100 bg-amber-50/40 mb-3 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-amber-100 bg-amber-50/80">
                <Ic.Zap className="h-3.5 w-3.5 text-amber-500 shrink-0"/>
                <span className="text-[11px] font-bold uppercase tracking-widest text-amber-600">Scheduled Action</span>
              </div>

              {(localItem.next_action || localItem.next_action_date) ? (
                <div className="px-4 py-2.5 border-b border-amber-100 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    {localItem.next_action && (
                      <span className={cls("inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[12px] font-bold ring-1 ring-inset", contactCls(localItem.next_action))}>
                        <ContactIcon type={localItem.next_action} className="h-3 w-3"/>{localItem.next_action}
                      </span>
                    )}
                    <div className="flex items-center gap-2 ml-auto shrink-0">
                      {prospectTime && (
                        <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-slate-500">
                          <Ic.Clock className="h-3.5 w-3.5 text-slate-400"/>{prospectTime}
                        </span>
                      )}
                      {localItem.next_action_date && (
                        <span className={cls("text-[13px] font-bold", dueCls(localItem.next_action_date))}>
                          {dueLabel(localItem.next_action_date)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    {localItem.next_action_date && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                        <Ic.Cal className="h-3 w-3 shrink-0"/>{fmtD(localItem.next_action_date)}
                      </span>
                    )}
                  </div>
                  {prospectRemark && <p className="text-[11px] text-slate-500 leading-snug pt-0.5">{prospectRemark}</p>}
                </div>
              ) : (
                <p className="px-4 py-2.5 text-[12px] text-slate-400 border-b border-amber-100">No action scheduled yet.</p>
              )}

              {canEdit && (
                <UpdateStatusInline
                  prospect={localItem}
                  token={token}
                  onSaved={updated => setLocalItem(p => ({ ...p, ...updated }))}
                  onConvertToLead={() => setShowLeadForm(true)}
                />
              )}
            </div>
          )}

          {/* Activity log (prospect only) — now meaningful for everyone on
              the team, since multiple people can act on the same prospect */}
          {!isLead && <ProspectActivityLog prospectId={localItem.id} token={token}/>}

          {/* Lead contacts */}
          {isLead && (localItem.primary_contact_name || localItem.primary_phone) && (
            <CollapsibleDetailSection title="Primary Contact" icon={Ic.User} accent="indigo" className="mb-3">
              <DRow label="Name"        value={localItem.primary_contact_name}/>
              <DRow label="Designation" value={localItem.primary_designation}/>
              <DRow label="Phone"       value={localItem.primary_phone} mono/>
              <DRow label="Email"       value={localItem.primary_email}/>
            </CollapsibleDetailSection>
          )}
          {isLead && localItem.secondary_contact_name && (
            <CollapsibleDetailSection title="Secondary Contact" icon={Ic.User} accent="violet" className="mb-3">
              <DRow label="Name"        value={localItem.secondary_contact_name}/>
              <DRow label="Designation" value={localItem.secondary_designation}/>
              <DRow label="Phone"       value={localItem.secondary_phone} mono/>
              <DRow label="Email"       value={localItem.secondary_email}/>
            </CollapsibleDetailSection>
          )}

          {/* Enquiries (lead only) */}
          {isLead && (
            <CollapsibleDetailSection
              title={`Enquiries (${sortedRFQs.length})`}
              icon={Ic.FileT}
              accent="indigo"
              className="mb-3"
              defaultOpen
            >
              <div className="py-3">
                {openRFQs.length > 0 && (
                  <p className="text-[10px] text-slate-400 mb-2">{openRFQs.length} active · {closedRFQs.length} closed</p>
                )}

                {missingFields.length > 0 && (
                  <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                    <div className="flex items-start gap-2">
                      <Ic.Alert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5"/>
                      <div>
                        <p className="text-sm font-semibold text-amber-700 mb-1">Complete these fields first:</p>
                        <ul className="list-disc list-inside text-xs text-amber-700 space-y-0.5">{missingFields.map(f => <li key={f}>{f}</li>)}</ul>
                        <button onClick={() => { onEdit(localItem); onClose(); }} className="mt-2 text-xs font-semibold text-amber-700 underline flex items-center gap-1">Open Edit Form <Ic.ChevR className="h-3 w-3"/></button>
                      </div>
                    </div>
                  </div>
                )}

                {sortedRFQs.length === 0 ? (
                  <div className="py-8 text-center rounded-xl border-2 border-dashed border-slate-200">
                    <Ic.FileT className="h-8 w-8 text-slate-200 mx-auto mb-2"/>
                    <p className="text-sm text-slate-400">No enquiries yet</p>
                  </div>
                ) : (
                  sortedRFQs.map(rfq => (
                    <EnquiryCard
                      key={rfq.id} rfq={rfq} token={token} user={user} canEdit={canEdit}
                      order={ordersByRfq[rfq.id] || null}
                      onUpdated={(mode, rfqId, data) => onEnquiryUpdated(mode, rfqId, data)}
                    />
                  ))
                )}
              </div>
            </CollapsibleDetailSection>
          )}

          {/* Bottom action bar */}
          {canEdit && isLead && (
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4 mt-4">
              <PBtn className="w-full py-2.5 text-sm" onClick={handleAddEnquiry}>
                <Ic.Plus className="h-4 w-4"/> Add Enquiry
              </PBtn>
            </div>
          )}
        </div>
      </Sheet>

      <AnimatePresence>
        {showAddEnq && <AddEnquiryForm lead={localItem} token={token} productsHook={productsHook} onClose={() => setShowAddEnq(false)} onSaved={onEnquirySaved}/>}
      </AnimatePresence>
    </Backdrop>
  );
}