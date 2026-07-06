import React from "react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cls } from "../ui/primitives";
import { Ic } from "../icons";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

function personLabel(p) {
  if (!p) return null;
  const name = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
  return name || p.email || null;
}

function fmtDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}
function fmtDateShort(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

// A single compact info cell used throughout the expanded panel.
function Cell({ label, value, mono, span2 }) {
  if (!value) return null;
  return (
    <div className={cls("px-3 py-2", span2 && "col-span-2")}>
      <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">{label}</p>
      <p className={cls("text-[11px] font-semibold text-slate-700 leading-snug", mono && "font-mono")}>{value}</p>
    </div>
  );
}

const OrderRow = React.memo(function OrderRow({ order, token, user, onReverted }) {
  const [open, setOpen] = useState(false);
  const [reverting, setReverting] = useState(false);

  const rfq        = order.rfqs  || {};
  const lead        = rfq.leads   || {};
  const sample      = (rfq.samples    || [])[0];
  const quotation   = (rfq.quotations || [])[0];
  const converter   = personLabel(order.converter);
  const initials    = (lead.company_name || "?").slice(0, 2).toUpperCase();

  const canRevert = user?.role === "Admin";

  async function handleRevert() {
    if (!window.confirm(`Revert "${lead.company_name}" back to Tasks? It'll stop appearing under Orders until re-converted.`)) return;
    setReverting(true);
    try {
      const res = await fetch(`${API}/api/orders/${order.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to revert");
      onReverted && onReverted(order.id);
    } catch (e) {
      alert(e.message);
      setReverting(false);
    }
  }

  return (
    <div className="border-b border-slate-100 last:border-0 bg-white">
      {/* Collapsed row — compact, matches SQFlatRow's density */}
      <button type="button" onClick={() => setOpen(v => !v)}
        className="flex w-full items-stretch text-left transition-colors hover:bg-slate-50/80 active:bg-slate-100">
        <div className="flex items-center pl-3 pr-0 py-2.5 shrink-0">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-[11px] font-bold shadow-sm">
            {initials}
            <span className="absolute -bottom-0.5 -right-0.5 flex h-[14px] w-[14px] items-center justify-center rounded-full border-2 border-white bg-emerald-500 text-white">
              <Ic.Check className="h-2 w-2" />
            </span>
          </div>
        </div>
        <div className="flex flex-1 items-center gap-2 px-3 py-2.5 min-w-0">
          <div className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-bold text-slate-900 leading-snug">
              {lead.company_name || "—"}
            </span>
            <span className="block truncate text-[11px] text-slate-500 leading-tight mt-0.5">
              {rfq.product_name || rfq.product_category || "Enquiry"}
            </span>
          </div>
          <div className="shrink-0 flex flex-col items-end gap-0.5">
            <span className="text-[10px] font-semibold text-emerald-600 leading-tight">{fmtDateShort(order.converted_at)}</span>
            <div className={cls("transition-transform duration-200", open ? "rotate-180" : "")}>
              <Ic.ChevD className="h-3.5 w-3.5 text-slate-400" />
            </div>
          </div>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden">
            <div className="border-t border-slate-100 bg-slate-50/30 px-3 py-2 space-y-2">

              {/* Converted-at banner */}
              <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Ic.Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-emerald-700 leading-tight">Converted to Order</p>
                    <p className="text-[9px] text-emerald-600 leading-tight truncate">
                      {fmtDateTime(order.converted_at)}{converter && ` · by ${converter}`}
                    </p>
                  </div>
                </div>
                {canRevert && (
                  <button type="button" onClick={handleRevert} disabled={reverting}
                    className="shrink-0 text-[9px] font-semibold text-slate-500 hover:text-rose-600 underline disabled:opacity-50">
                    {reverting ? "Reverting…" : "Revert"}
                  </button>
                )}
              </div>

              {/* Company */}
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border-b border-slate-100">
                  <Ic.Building className="h-2.5 w-2.5 text-slate-400" />
                  <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Company</span>
                </div>
                <div className="grid grid-cols-2 divide-x divide-y divide-slate-50">
                  <Cell label="Industry"  value={lead.nature_of_business || lead.manufacturing_industry} />
                  <Cell label="GST"       value={lead.gst_number} mono />
                  <Cell label="City"      value={lead.city} />
                  <Cell label="State"     value={lead.state} />
                  <Cell label="Zone"      value={lead.zone} />
                  <Cell label="Route"     value={lead.route} />
                </div>
                {lead.company_website && (
                  <div className="px-3 py-2 border-t border-slate-50">
                    <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Website</p>
                    <a href={lead.company_website} target="_blank" rel="noreferrer" className="text-[11px] text-indigo-600 hover:underline break-all">{lead.company_website}</a>
                  </div>
                )}
              </div>

              {/* Contacts */}
              {(lead.primary_contact_name || lead.primary_phone || lead.secondary_contact_name) && (
                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border-b border-slate-100">
                    <Ic.User className="h-2.5 w-2.5 text-slate-400" />
                    <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Contacts</span>
                  </div>
                  {(lead.primary_contact_name || lead.primary_phone || lead.primary_email) && (
                    <div className="px-3 py-2 border-b border-slate-50">
                      <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400 mb-1">Primary{lead.primary_designation && ` · ${lead.primary_designation}`}</p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                        {lead.primary_contact_name && <span className="text-[11px] font-semibold text-slate-700">{lead.primary_contact_name}</span>}
                        {lead.primary_phone        && <span className="text-[11px] text-slate-500 font-mono">{lead.primary_phone}</span>}
                        {lead.primary_email        && <span className="text-[11px] text-slate-500 truncate">{lead.primary_email}</span>}
                      </div>
                    </div>
                  )}
                  {lead.secondary_contact_name && (
                    <div className="px-3 py-2">
                      <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400 mb-1">Secondary{lead.secondary_designation && ` · ${lead.secondary_designation}`}</p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                        <span className="text-[11px] font-semibold text-slate-700">{lead.secondary_contact_name}</span>
                        {lead.secondary_phone && <span className="text-[11px] text-slate-500 font-mono">{lead.secondary_phone}</span>}
                        {lead.secondary_email && <span className="text-[11px] text-slate-500 truncate">{lead.secondary_email}</span>}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Product / Enquiry */}
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border-b border-slate-100">
                  <Ic.Package className="h-2.5 w-2.5 text-slate-400" />
                  <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Product</span>
                </div>
                <div className="px-3 py-2 border-b border-slate-50">
                  <p className="text-[12px] font-bold text-slate-800 leading-snug">{rfq.product_name || "—"}</p>
                  {(rfq.product_category || rfq.product_sub_category) && (
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {rfq.product_category}{rfq.product_sub_category && <span> · {rfq.product_sub_category}</span>}
                    </p>
                  )}
                </div>
                {rfq.product_description && (
                  <div className="px-3 py-2 border-b border-slate-50">
                    <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Description</p>
                    <p className="text-[10px] text-slate-500 leading-snug">{rfq.product_description}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 divide-x divide-y divide-slate-50">
                  <Cell label="Qty / Month" value={rfq.consumption_per_month ? `${rfq.consumption_per_month} ${rfq.unit || ""}` : null} />
                  <Cell label="Target Price" value={rfq.target_price ? `₹${rfq.target_price}` : null} />
                  <Cell label="Existing Supplier" value={rfq.existing_supplier_brand} span2 />
                </div>
              </div>

              {/* Sample */}
              {rfq.sample_required && (
                <div className="rounded-xl border border-rose-100 bg-rose-50/30 overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-1.5 bg-rose-50 border-b border-rose-100">
                    <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-rose-500">
                      <Ic.Package className="h-2.5 w-2.5" />Sample
                    </span>
                    <span className="font-mono text-[9px] text-rose-400">{sample?.sample_code}</span>
                  </div>
                  <div className="px-3 py-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-[11px] font-semibold text-emerald-600">{sample?.result || "Approved"}</span>
                    {sample?.notes && <span className="text-[10px] text-slate-500">{sample.notes}</span>}
                  </div>
                </div>
              )}

              {/* Quotation */}
              {rfq.quotation_required && (
                <div className="rounded-xl border border-orange-100 bg-orange-50/30 overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-1.5 bg-orange-50 border-b border-orange-100">
                    <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-orange-500">
                      <Ic.FileT className="h-2.5 w-2.5" />Quotation
                    </span>
                    <span className="font-mono text-[9px] text-orange-400">{quotation?.quotation_code}</span>
                  </div>
                  <div className="px-3 py-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-[11px] font-semibold text-emerald-600">{quotation?.result || "Approved"}</span>
                    {quotation?.notes && <span className="text-[10px] text-slate-500">{quotation.notes}</span>}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

export default OrderRow;