import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth }      from "../../context/AuthContext";
import { useRoutes }    from "../../hooks/useRoutes";
import { useProducts }  from "../../hooks/useProducts";

import { Ic }           from "./icons";
import { cls, PBtn }    from "./ui/primitives";
import {
  TYPE_OPTS, DATE_OPTS, SQ_OPTS,
} from "./constants";
import {
  isOverdue, isToday, isTomorrow, isFuture, fmtD,
  itemNearestDate, itemContactType, isEnquiryClosed,
  latestFU, dueCls, dueLabel,
} from "./utils";

import ProspectForm         from "./components/ProspectForm";
import LeadForm             from "./components/LeadForm";
import DetailPanel          from "./components/DetailPanel";
import ListRow              from "./components/ListRow";
import SQFlatRow            from "./components/SQFlatRow";
import SQListRow            from "./components/SQListRow";
import BottomNav            from "./BottomNav";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

/* ─── Build flat mixed rows for Admin "All" tab only ────────── */
function buildFlatRows(filtered, rfqMap, nearDateMap, contactTypeMap, typeFilter, isAdmin) {
  const rows = [];

  filtered.forEach(item => {
    rows.push({
      _rowType: "main",
      item,
      sortKey: nearDateMap[item.id] || "9999",
    });

    // Only Admin sees SQFlatRow sub-rows in "all" tab
    if (item._type === "lead" && typeFilter === "all" && isAdmin) {
      const rfqs = rfqMap[item.id] || [];
      rfqs.forEach(rfq => {
        const enriched = { ...rfq, _leadItem: item };
        if (rfq.sample_required) {
          const s = (rfq.samples || [])[0];
          rows.push({
            _rowType: "sq",
            rfq: enriched,
            isSample: true,
            sortKey: s?.follow_up_date || "9999",
          });
        }
        if (rfq.quotation_required) {
          const q = (rfq.quotations || [])[0];
          rows.push({
            _rowType: "sq",
            rfq: enriched,
            isSample: false,
            sortKey: q?.follow_up_date || "9999",
          });
        }
      });
    }
  });

  rows.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  return rows;
}

/* ─── Build SC rows: one SQFlatRow per rfq×type ─────────────── */
function buildSCRows(filtered, rfqMap) {
  const rows = [];
  filtered.forEach(item => {
    if (item._type !== "lead") return;
    const rfqs = rfqMap[item.id] || [];
    rfqs.forEach(rfq => {
      const enriched = { ...rfq, _leadItem: item };
      if (rfq.sample_required) {
        const s = (rfq.samples || [])[0];
        rows.push({ rfq: enriched, isSample: true, sortKey: s?.follow_up_date || "9999" });
      }
      if (rfq.quotation_required) {
        const q = (rfq.quotations || [])[0];
        rows.push({ rfq: enriched, isSample: false, sortKey: q?.follow_up_date || "9999" });
      }
    });
  });
  rows.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  return rows;
}

export default function Pipeline() {
  const { user, token } = useAuth();
  const isAdmin = user?.role === "Admin";
  const isSC    = user?.role === "SalesCoordinator";
  const isSP    = !isAdmin && !isSC; // SalesPerson

  const initialType = useMemo(() => {
    if (isSC) return "all";
    const params = new URLSearchParams(window.location.search);
    return params.get("type") || "all";
  }, []); // eslint-disable-line

  const routesHook   = useRoutes();
  const productsHook = useProducts();

  const [prospects, setProspects] = useState([]);
  const [leads,     setLeads]     = useState([]);
  const [rfqMap,    setRFQMap]    = useState({});
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");

  const [search,       setSearch]       = useState("");
  const [typeFilter,   setTypeFilter]   = useState(initialType);
  const [dateFilter,   setDateFilter]   = useState("all");
  const [sqFilter,     setSqFilter]     = useState("all");
  const [selectedItem, setSelectedItem] = useState(null);
  const [showAddProspect, setShowAddProspect] = useState(false);
  const [editItem,     setEditItem]     = useState(null);

  /* ── Data fetch ── */
  const fetchAll = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [pRes, lRes, rRes] = await Promise.all([
        fetch(`${API}/api/prospects`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/leads`,     { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/rfqs`,      { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      const [pJ, lJ, rJ] = await Promise.all([pRes.json(), lRes.json(), rRes.json()]);

      if (!pJ.success) throw new Error("Prospects failed: " + (pJ.message || JSON.stringify(pJ)));
      if (!lJ.success) throw new Error("Leads failed: "     + (lJ.message || JSON.stringify(lJ)));

      setProspects(pJ.prospects || []);
      setLeads(lJ.leads || []);
      const map = {};
      (rJ.rfqs || []).forEach(rfq => {
        if (!rfq.lead_id || rfq.deleted_at) return;
        if (!map[rfq.lead_id]) map[rfq.lead_id] = [];
        map[rfq.lead_id].push(rfq);
      });
      setRFQMap(map);
    } catch (e) {
      console.error("fetchAll error:", e);
      setError(e.message);
    } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /* ── Merged list ── */
  const mergedList = useMemo(() => {
    const linkedIds = new Set(leads.filter(l => l.prospect_id).map(l => l.prospect_id));
    const pItems    = prospects.filter(p => !linkedIds.has(p.id)).map(p => ({ ...p, _type: "prospect" }));
    const lItems    = leads.map(l => ({ ...l, _type: "lead" }));
    return [...pItems, ...lItems];
  }, [prospects, leads]);

  const nearDateMap = useMemo(() => {
    const m = {};
    mergedList.forEach(item => {
      m[item.id] = itemNearestDate(item, item._type === "lead" ? (rfqMap[item.id] || []) : []);
    });
    return m;
  }, [mergedList, rfqMap]);

  const contactTypeMap = useMemo(() => {
    const m = {};
    mergedList.forEach(item => {
      m[item.id] = itemContactType(item, item._type === "lead" ? (rfqMap[item.id] || []) : []);
    });
    return m;
  }, [mergedList, rfqMap]);

  /* ── Filtering ── */
  const filtered = useMemo(() => {
    let list = mergedList;

    if (isSC) {
      // SC: only leads that have sample_required or quotation_required
      list = list.filter(i => {
        if (i._type !== "lead") return false;
        const rfqs = rfqMap[i.id] || [];
        return rfqs.some(r => r.sample_required || r.quotation_required);
      });
    } else if (isSP) {
      // SalesPerson: hide leads with no RFQs in "All" tab; no prospect filtering needed
      if (typeFilter === "all") {
        list = list.filter(i => {
          if (i._type !== "lead") return true;
          return (rfqMap[i.id] || []).length > 0;
        });
      } else {
        list = list.filter(i => i._type === typeFilter);
      }
    } else {
      // Admin
      if (typeFilter !== "all") {
        list = list.filter(i => i._type === typeFilter);
      } else {
        // Admin "All": hide leads with no enquiries
        list = list.filter(i => {
          if (i._type !== "lead") return true;
          return (rfqMap[i.id] || []).length > 0;
        });
      }
    }

    if (dateFilter !== "all") list = list.filter(i => {
      const d = nearDateMap[i.id];
      if (dateFilter === "overdue")  return isOverdue(d);
      if (dateFilter === "today")    return isToday(d);
      if (dateFilter === "tomorrow") return isTomorrow(d);
      if (dateFilter === "future")   return d && isFuture(d);
      return true;
    });

    // sqFilter sub-filter (Admin + SC only, SP never sees these pills)
    if (sqFilter !== "all") list = list.filter(i => {
      if (i._type !== "lead") return false;
      const rfqs = rfqMap[i.id] || [];
      if (sqFilter === "sample")   return rfqs.some(r => r.sample_required);
      if (sqFilter === "quote")    return rfqs.some(r => r.quotation_required);
      if (sqFilter === "customer") return rfqs.some(r => r.sample_required && r.quotation_required);
      return true;
    });

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(i =>
        i.company_name?.toLowerCase().includes(q) ||
        i.nature_of_business?.toLowerCase().includes(q) ||
        i.city?.toLowerCase().includes(q) ||
        i.state?.toLowerCase().includes(q) ||
        i.zone?.toLowerCase().includes(q) ||
        i.source?.toLowerCase().includes(q) ||
        i.primary_contact_name?.toLowerCase().includes(q) ||
        i.primary_phone?.includes(q)
      );
    }

    return [...list].sort((a, b) => {
      const ad = nearDateMap[a.id] || "9999";
      const bd = nearDateMap[b.id] || "9999";
      return ad.localeCompare(bd);
    });
  }, [mergedList, typeFilter, dateFilter, sqFilter, search, nearDateMap, rfqMap, isSC, isSP]);

  /* ── Handlers ── */
  function openDetail(item) { setSelectedItem(item); }

  async function handleDelete(item) {
    if (!window.confirm(`Delete "${item.company_name}"?`)) return;
    const url = item._type === "lead"
      ? `${API}/api/leads/${item.id}`
      : `${API}/api/prospects/${item.id}`;
    try {
      const r = await fetch(url, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error("Delete failed");
      if (item._type === "lead") setLeads(p => p.filter(l => l.id !== item.id));
      else setProspects(p => p.filter(pr => pr.id !== item.id));
      setSelectedItem(null);
    } catch (e) { alert(e.message); }
  }

  function openEdit(item) { setEditItem(item); setSelectedItem(null); }

  function onProspectSaved(prospect, isEdit) {
    if (isEdit) setProspects(p => p.map(pr => pr.id === prospect.id ? { ...pr, ...prospect } : pr));
    else        setProspects(p => [prospect, ...p]);
  }
  function onLeadSaved(lead, isEdit) {
    if (isEdit) setLeads(p => p.map(l => l.id === lead.id ? { ...l, ...lead } : l));
    else        setLeads(p => [lead, ...p]);
  }
  function onConverted(lead) {
    setLeads(p => [lead, ...p]);
    fetchAll();
  }
  function onEnquirySaved(newRFQ) {
    setRFQMap(p => ({ ...p, [newRFQ.lead_id]: [newRFQ, ...(p[newRFQ.lead_id] || [])] }));
  }
  function onEnquiryUpdated(mode, rfqId, data) {
    setRFQMap(p => {
      const leadId = Object.keys(p).find(k => p[k].some(r => r.id === rfqId));
      if (!leadId) return p;
      const arr = p[leadId].map(rfq => {
        if (rfq.id !== rfqId) return rfq;
        let fups = [...(rfq.rfq_followups || [])];
        if (mode === "new")            fups = [data, ...fups];
        else if (mode === "edit")      fups = fups.map(f => f.id === data.id ? data : f);
        else if (mode === "deleteFup") fups = fups.filter(f => f.id !== data);
        return { ...rfq, rfq_followups: fups };
      });
      return { ...p, [leadId]: arr };
    });
  }

  // Keep selectedItem rfqs in sync
  useEffect(() => {
    if (selectedItem && selectedItem._type === "lead") {
      const fresh = rfqMap[selectedItem.id];
      if (fresh) setSelectedItem(p => p ? { ...p, _rfqs: fresh } : p);
    }
  }, [rfqMap]); // eslint-disable-line

  function clearFilters() {
    setSearch(""); setTypeFilter("all"); setDateFilter("all"); setSqFilter("all");
  }
  function selectSqFilter(v) {
    setSqFilter(v);
    if (v !== "all") setTypeFilter("lead");
  }
  function selectTypeFilter(v) {
    setTypeFilter(v);
    // Switching to prospect or all clears the SQ sub-filter
    if (v === "prospect" || v === "all") setSqFilter("all");
  }

  function handleSQUpdated(rfq) {
    return (rfqId, type, data) => {
      setRFQMap(p => {
        const leadId = rfq.lead_id;
        if (!leadId || !p[leadId]) return p;
        return {
          ...p,
          [leadId]: p[leadId].map(r => {
            if (r.id !== rfqId) return r;
            if (type === "sample")    return { ...r, samples:    [data.sample,    ...(r.samples    || []).slice(1)] };
            return                           { ...r, quotations: [data.quotation, ...(r.quotations || []).slice(1)] };
          }),
        };
      });
    };
  }

  /* ── Derived counts ── */
  const pCount       = mergedList.filter(i => i._type === "prospect").length;
  const lCount       = mergedList.filter(i => i._type === "lead").length;
  const overdueCount = mergedList.filter(i => isOverdue(nearDateMap[i.id])).length;
  const hasFilters   = (!isSC && typeFilter !== "all") || dateFilter !== "all" || sqFilter !== "all" || search.trim();

  // Type pills: SC hides "Prospect"; SP and Admin see all
  const visibleTypeOpts = isSC
    ? TYPE_OPTS.filter(f => f.v !== "prospect")
    : TYPE_OPTS;

  /* ── SC rows (SQFlatRow one per rfq×type) ─────────────────── */
  const scRows = useMemo(() => isSC ? buildSCRows(filtered, rfqMap) : [], [isSC, filtered, rfqMap]);

  /* ── SQ list rows for sqFilter !== "all" (Admin + SC) ──────── */
  function buildSQLRows() {
    const sqRFQs = [];
    filtered.forEach(item => {
      if (item._type !== "lead") return;
      const rfqs = rfqMap[item.id] || [];
      const matching =
        sqFilter === "sample"   ? rfqs.filter(r => r.sample_required)
        : sqFilter === "quote"  ? rfqs.filter(r => r.quotation_required)
        : rfqs.filter(r => r.sample_required && r.quotation_required); // "customer"
      matching.forEach(rfq => sqRFQs.push({ ...rfq, _leadItem: item }));
    });

    function bestDate(rfq) {
      const s = (rfq.samples    || [])[0];
      const q = (rfq.quotations || [])[0];
      return [s?.follow_up_date, q?.follow_up_date].filter(Boolean).sort()[0] || null;
    }
    function bestTime(rfq) {
      const s = (rfq.samples    || [])[0];
      const q = (rfq.quotations || [])[0];
      const sd = s?.follow_up_date || null, qd = q?.follow_up_date || null;
      if (sd && qd) return sd <= qd ? (s?.follow_up_time || "00:00") : (q?.follow_up_time || "00:00");
      if (sd) return s?.follow_up_time || "00:00";
      if (qd) return q?.follow_up_time || "00:00";
      return "00:00";
    }
    return sqRFQs.sort((a, b) => {
      const ad = bestDate(a), bd = bestDate(b);
      if (ad && !bd) return -1; if (!ad && bd) return 1; if (!ad && !bd) return 0;
      const dc = ad.localeCompare(bd);
      return dc !== 0 ? dc : bestTime(a).localeCompare(bestTime(b));
    });
  }

  /* ─────────────────────────────────────────────────────────────
     SHARED RENDER HELPERS
  ───────────────────────────────────────────────────────────── */

  // What to show in the list area
  function renderListContent() {
    if (loading) return (
      <div className="divide-y divide-slate-100">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
            <div className="h-11 w-11 rounded-full bg-slate-100 shrink-0" />
            <div className="flex-1">
              <div className="h-3.5 w-1/2 rounded-full bg-slate-100 mb-2" />
              <div className="h-3 w-1/3 rounded-full bg-slate-100" />
            </div>
            <div className="h-3 w-14 rounded-full bg-slate-100" />
          </div>
        ))}
      </div>
    );

    if (error) return (
      <div className="p-5 m-4 rounded-2xl border border-rose-100 bg-rose-50 text-sm text-rose-700">{error}</div>
    );

    // ── SalesCoordinator: always SQFlatRows (one per rfq×type) ──
    if (isSC) {
      if (scRows.length === 0) return (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <Ic.Radar className="h-12 w-12 text-slate-200 mb-4" />
          <p className="text-sm font-semibold text-slate-600">No S/Q tasks</p>
          <p className="text-xs text-slate-400 mt-1">No sample or quotation tasks assigned yet</p>
        </div>
      );
      return (
        <div>
          {scRows.map(row => (
            <SQFlatRow
              key={`sc-${row.rfq.id}-${row.isSample ? "s" : "q"}`}
              rfq={row.rfq}
              isSample={row.isSample}
              token={token}
              onUpdated={(rfqId, type, data) => handleSQUpdated({ lead_id: row.rfq.lead_id })(rfqId, type, data)}
            />
          ))}
        </div>
      );
    }

    // ── sqFilter active (Admin only — SP never sees these pills) ──
    if (sqFilter !== "all") {
      const sqRFQs = buildSQLRows();
      if (sqRFQs.length === 0) return (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <Ic.Radar className="h-12 w-12 text-slate-200 mb-4" />
          <p className="text-sm font-semibold text-slate-600">No matching enquiries</p>
          <p className="text-xs text-slate-400 mt-1">Adjust filters to see results</p>
        </div>
      );
      return (
        <div>
          {sqRFQs.map(rfq => (
            <SQListRow
              key={`sq-${rfq.id}`}
              rfq={rfq}
              sqFilter={sqFilter}
              token={token}
              onUpdated={handleSQUpdated(rfq)}
            />
          ))}
        </div>
      );
    }

    // ── Admin / SalesPerson: normal mixed ListRow + SQFlatRow (admin all-tab only) ──
    if (filtered.length === 0) return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
        <Ic.Radar className="h-12 w-12 text-slate-200 mb-4" />
        <p className="text-sm font-semibold text-slate-600">{hasFilters ? "No matching records" : "No records yet"}</p>
        <p className="text-xs text-slate-400 mt-1">{hasFilters ? "Adjust search or filters" : "Add a prospect to get started"}</p>
        {hasFilters && (
          <button onClick={clearFilters} className="mt-3 text-xs font-semibold text-indigo-600 hover:underline">
            Clear filters
          </button>
        )}
      </div>
    );

    const rows = buildFlatRows(filtered, rfqMap, nearDateMap, contactTypeMap, typeFilter, isAdmin);
    return (
      <div>
        {rows.map(row => {
          if (row._rowType === "sq") {
            return (
              <SQFlatRow
                key={`sq-${row.rfq.id}-${row.isSample ? "s" : "q"}`}
                rfq={row.rfq}
                isSample={row.isSample}
                token={token}
                onUpdated={(rfqId, type, data) => handleSQUpdated({ lead_id: row.rfq.lead_id })(rfqId, type, data)}
              />
            );
          }
          return (
            <ListRow
              key={`${row.item._type}-${row.item.id}`}
              item={row.item}
              nearDate={nearDateMap[row.item.id]}
              contactType={contactTypeMap[row.item.id]}
              rfqs={row.item._type === "lead" ? (rfqMap[row.item.id] || []) : []}
              onClick={() => openDetail(row.item)}
            />
          );
        })}
      </div>
    );
  }

  /* ─────────────────────────────────────────────────────────────
     DESKTOP CARD GRID (Admin / SalesPerson only)
  ───────────────────────────────────────────────────────────── */
  function renderDesktopGrid() {
    if (loading) return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-52 animate-pulse rounded-2xl border border-slate-100 bg-white p-4">
            <div className="mb-2 h-4 w-1/2 rounded-lg bg-slate-100" />
            <div className="mb-4 h-3 w-1/3 rounded-lg bg-slate-100" />
            <div className="mt-3 flex gap-2">
              <div className="h-5 w-16 rounded-full bg-slate-100" />
              <div className="h-5 w-14 rounded-full bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
    );
    if (error) return (
      <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-4 text-sm text-rose-700">{error}</div>
    );

    // SC desktop: SQFlatRow list
    if (isSC) {
      return (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {scRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Ic.Radar className="h-10 w-10 text-slate-300 mb-3" />
              <p className="text-sm font-semibold text-slate-600">No S/Q tasks</p>
              <p className="text-sm text-slate-400 mt-1">No sample or quotation tasks assigned yet</p>
            </div>
          ) : scRows.map(row => (
            <SQFlatRow
              key={`sc-${row.rfq.id}-${row.isSample ? "s" : "q"}`}
              rfq={row.rfq}
              isSample={row.isSample}
              token={token}
              onUpdated={(rfqId, type, data) => handleSQUpdated({ lead_id: row.rfq.lead_id })(rfqId, type, data)}
            />
          ))}
        </div>
      );
    }

    // sqFilter active (Admin only)
    if (sqFilter !== "all") {
      const sqRFQs = buildSQLRows();
      return (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {sqRFQs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Ic.Radar className="h-10 w-10 text-slate-300 mb-3" />
              <p className="text-sm font-semibold text-slate-600">No matching enquiries</p>
              {hasFilters && (
                <button onClick={clearFilters} className="mt-2 text-xs font-semibold text-indigo-600 hover:underline">Clear filters</button>
              )}
            </div>
          ) : sqRFQs.map(rfq => (
            <SQListRow
              key={`sq-${rfq.id}`}
              rfq={rfq}
              sqFilter={sqFilter}
              token={token}
              onUpdated={handleSQUpdated(rfq)}
            />
          ))}
        </div>
      );
    }

    // Normal card grid
    return (
      <motion.div layout className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <AnimatePresence mode="popLayout">
          {filtered.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white/50 px-6 py-20 text-center">
              <Ic.Radar className="h-10 w-10 text-slate-300 mb-3" />
              <p className="text-sm font-semibold text-slate-600">{hasFilters ? "No matching records" : "No records yet"}</p>
              {hasFilters && (
                <button onClick={clearFilters} className="mt-2 text-xs font-semibold text-indigo-600 hover:underline">Clear filters</button>
              )}
            </div>
          ) : filtered.map((item, i) => {
            const isLead      = item._type === "lead";
            const nd          = nearDateMap[item.id];
            const ov          = isOverdue(nd);
            const td          = isToday(nd);
            const tm          = isTomorrow(nd);
            const rfqs        = rfqMap[item.id] || [];
            const hasSample   = rfqs.some(r => r.sample_required);
            const hasQuote    = rfqs.some(r => r.quotation_required);
            const contactType = contactTypeMap[item.id];

            return (
              <motion.article
                key={`${item._type}-${item.id}`}
                layout
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.22, delay: Math.min(i * 0.025, 0.3) }}
                onClick={() => openDetail(item)}
                className="group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-100/40"
              >
                <div className={cls("h-1 w-full", isLead
                  ? "bg-gradient-to-r from-indigo-500 to-violet-600"
                  : "bg-gradient-to-r from-teal-400 to-emerald-500"
                )} />
                <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-start gap-2 mb-2">
                    <div className="min-w-0 flex-1">
                      <span className={cls(
                        "text-[9px] font-bold uppercase px-1.5 py-px rounded-full ring-1 ring-inset",
                        isLead ? "bg-indigo-50 text-indigo-600 ring-indigo-200" : "bg-teal-50 text-teal-600 ring-teal-200"
                      )}>
                        {isLead ? "Lead" : "Prospect"}
                      </span>
                      <h3 className="mt-1 truncate text-[15px] font-bold text-slate-900">{item.company_name}</h3>
                      <p className="truncate text-[12px] text-slate-400">{item.industry || item.nature_of_business || ""}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {item.city && (
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset bg-slate-100 text-slate-600 ring-slate-500/15">
                        <Ic.Pin className="mr-1 inline h-2.5 w-2.5" />{item.city}
                      </span>
                    )}
                    {item.source && (
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset bg-violet-50 text-violet-700 ring-violet-200">
                        {item.source}
                      </span>
                    )}
                    {contactType && (
                      <span className={cls("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset", contactType)}>
                        {contactType}
                      </span>
                    )}
                    {isLead && hasSample && (
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset bg-teal-50 text-teal-700 ring-teal-200">Sample</span>
                    )}
                    {isLead && hasQuote && (
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset bg-violet-50 text-violet-700 ring-violet-200">Quote</span>
                    )}
                  </div>
                  <div className="flex-1 space-y-1.5 border-t border-slate-100 pt-3">
                    {nd && (
                      <div className="flex items-center gap-1.5">
                        <Ic.Cal className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className={cls("text-[12px] font-medium",
                          ov ? "text-rose-500" : td ? "text-amber-500" : tm ? "text-sky-600" : "text-slate-500"
                        )}>
                          {ov ? "Overdue" : td ? "Today" : tm ? "Tomorrow" : fmtD(nd)}
                        </span>
                      </div>
                    )}
                    {item.primary_contact_name && (
                      <div className="flex items-center gap-1.5">
                        <Ic.User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="text-[12px] text-slate-500 truncate">{item.primary_contact_name}</span>
                      </div>
                    )}
                    {item.next_action && (
                      <div className="flex items-center gap-1.5">
                        <Ic.Zap className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                        <span className="text-[12px] text-slate-500 truncate">{item.next_action}</span>
                      </div>
                    )}
                  </div>
                  <div className="mt-3 flex items-center justify-end border-t border-slate-100 pt-3">
                    <span className="flex items-center gap-1 text-[12px] font-semibold text-indigo-500 opacity-0 transition-opacity group-hover:opacity-100">
                      View details <Ic.ChevR className="h-3 w-3" />
                    </span>
                  </div>
                </div>
              </motion.article>
            );
          })}
        </AnimatePresence>
      </motion.div>
    );
  }

  /* ─────────────────────────────────────────────────────────────
     RENDER
  ───────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-slate-50 lg:bg-gradient-to-br lg:from-slate-50 lg:via-white lg:to-indigo-50/30">

      {/* ══ MOBILE / TABLET ══ */}
      <div className="lg:hidden flex flex-col h-screen pb-20">

        {/* Sticky header */}
        <div className="sticky top-0 z-30 bg-white border-b border-slate-100 shadow-sm">
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-slate-900">Pipeline</h1>
              <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                {!isSC && <span className="text-[11px] text-teal-600 font-semibold">{pCount} prospects</span>}
                {!isSC && <span className="text-slate-300">·</span>}
                <span className="text-[11px] text-indigo-600 font-semibold">{lCount} leads</span>
                {overdueCount > 0 && (
                  <>
                    <span className="text-slate-300">·</span>
                    <span className="text-[11px] text-rose-500 font-semibold animate-pulse">{overdueCount} overdue</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="px-4 pb-2 flex items-center gap-2">
            <div className="relative flex-1">
              <Ic.Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search company, city, product…"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-10 text-sm placeholder:text-slate-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:bg-white transition-all"
              />
              {search && (
                <button onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-slate-500 hover:bg-slate-300">
                  <Ic.X className="h-3 w-3" />
                </button>
              )}
            </div>
            {hasFilters && (
              <button onClick={clearFilters}
                className="shrink-0 flex items-center justify-center gap-1 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-slate-500 hover:bg-slate-50 active:bg-slate-100 transition-colors">
                <Ic.X className="h-4 w-4" />
                <span className="text-[11px] font-semibold">Clear</span>
              </button>
            )}
          </div>

          {/* Filter pills */}
          <div className="px-4 pb-3">
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar"
              style={{ WebkitOverflowScrolling: "touch", overscrollBehaviorX: "contain" }}>
              {/* Type pills — SC only sees locked "Tasks"/"Leads"; SP sees all; Admin sees all */}
              {visibleTypeOpts.map(f => (
                <button key={f.v} onClick={() => selectTypeFilter(f.v)}
                  className={cls(
                    "shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-all",
                    typeFilter === f.v ? "bg-indigo-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  )}>
                  {f.l}
                </button>
              ))}
              {/* SQ pills — Admin and SC only; SP never sees these */}
              {(isSC || isAdmin) && SQ_OPTS.map(f => (
                <button key={f.v} onClick={() => selectSqFilter(f.v)}
                  className={cls(
                    "shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-all",
                    sqFilter === f.v ? "bg-teal-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  )}>
                  {f.l}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto bg-white">
          {renderListContent()}
        </div>

        {/* FAB — SC cannot add prospects */}
        {!isSC && (
          <motion.button whileTap={{ scale: 0.92 }} onClick={() => setShowAddProspect(true)}
            className="fixed bottom-20 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-xl shadow-indigo-300/60 hover:bg-indigo-700">
            <Ic.Plus className="h-6 w-6" />
          </motion.button>
        )}
      </div>

      {/* ══ DESKTOP ══ */}
      <div className="hidden lg:block">
        <div className="relative mx-auto max-w-6xl px-5 py-7 lg:px-8 lg:py-9">

          <div className="pointer-events-none fixed inset-0 overflow-hidden">
            <div className="absolute -right-32 -top-32 h-80 w-80 rounded-full bg-indigo-100/40 blur-3xl" />
            <div className="absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-violet-100/30 blur-3xl" />
          </div>

          {/* Page header */}
          <div className="relative mb-6 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Pipeline</h1>
              <p className="mt-1 text-sm text-slate-500">
                {isAdmin ? "All prospects & leads" : isSC ? "Sample & Quotation tasks" : "Your pipeline"}
                <span className="mx-1.5 text-slate-300">·</span>
                {!isSC && <><span className="font-semibold text-teal-600">{pCount} prospects</span><span className="mx-1.5 text-slate-300">·</span></>}
                <span className="font-semibold text-indigo-600">{lCount} leads</span>
                {overdueCount > 0 && (
                  <><span className="mx-1.5 text-slate-300">·</span><span className="font-semibold text-rose-500">{overdueCount} overdue</span></>
                )}
              </p>
            </div>
            {!isSC && (
              <PBtn onClick={() => setShowAddProspect(true)}>
                <Ic.Plus className="h-4 w-4" /> Add Prospect
              </PBtn>
            )}
          </div>

          {/* Filter bar */}
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
              <div className="relative flex-1">
                <Ic.Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search company, contact, city, product, source…"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-9 text-sm placeholder:text-slate-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:bg-white transition-all"
                />
                {search && (
                  <button onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-slate-500 hover:bg-slate-300 transition-colors">
                    <Ic.X className="h-3 w-3" />
                  </button>
                )}
              </div>
              {hasFilters && (
                <button onClick={clearFilters}
                  className="shrink-0 flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 transition-colors">
                  <Ic.X className="h-3.5 w-3.5" /> Clear
                </button>
              )}
            </div>
            <div className="flex items-center gap-4 px-4 py-2.5 flex-wrap">
              {/* Type */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Type</span>
                {visibleTypeOpts.map(f => (
                  <button key={f.v} onClick={() => selectTypeFilter(f.v)}
                    className={cls(
                      "rounded-full px-3 py-1.5 text-[12px] font-semibold transition-all",
                      typeFilter === f.v ? "bg-indigo-600 text-white" : "text-slate-500 hover:bg-slate-100"
                    )}>
                    {f.l}
                  </button>
                ))}
              </div>
              {/* S/Q — Admin and SC only */}
              {(isSC || isAdmin) && (
                <>
                  <div className="h-4 w-px bg-slate-200 hidden sm:block" />
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">S/Q</span>
                    {SQ_OPTS.map(f => (
                      <button key={f.v} onClick={() => selectSqFilter(f.v)}
                        className={cls(
                          "rounded-full px-3 py-1.5 text-[12px] font-semibold transition-all",
                          sqFilter === f.v ? "bg-teal-500 text-white" : "text-slate-500 hover:bg-slate-100"
                        )}>
                        {f.l}
                      </button>
                    ))}
                  </div>
                </>
              )}
              <div className="h-4 w-px bg-slate-200 hidden sm:block" />
              {/* Due */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Due</span>
                {DATE_OPTS.map(f => (
                  <button key={f.v} onClick={() => setDateFilter(f.v)}
                    className={cls(
                      "rounded-full px-3 py-1.5 text-[12px] font-semibold transition-all",
                      dateFilter === f.v
                        ? f.v === "overdue"  ? "bg-rose-500 text-white"
                        : f.v === "today"    ? "bg-amber-500 text-white"
                        : f.v === "tomorrow" ? "bg-sky-500 text-white"
                                             : "bg-indigo-600 text-white"
                        : "text-slate-500 hover:bg-slate-100"
                    )}>
                    {f.l}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {renderDesktopGrid()}
        </div>
      </div>

      <BottomNav />

      {/* Modals */}
      <AnimatePresence>
        {selectedItem && (
          <DetailPanel
            item={selectedItem} user={user} token={token} sqFilter={sqFilter}
            rfqsForLead={selectedItem._type === "lead" ? (rfqMap[selectedItem.id] || []) : []}
            onClose={() => setSelectedItem(null)} onEdit={openEdit} onDelete={handleDelete}
            onConverted={onConverted} onEnquirySaved={onEnquirySaved}
            onEnquiryUpdated={onEnquiryUpdated} productsHook={productsHook}
          />
        )}
        {showAddProspect && (
          <ProspectForm token={token} routesHook={routesHook}
            onClose={() => setShowAddProspect(false)} onSaved={onProspectSaved} />
        )}
        {editItem && editItem._type === "prospect" && (
          <ProspectForm initial={editItem} token={token} routesHook={routesHook}
            onClose={() => setEditItem(null)}
            onSaved={(p, isEdit) => { onProspectSaved(p, isEdit); setEditItem(null); }} />
        )}
        {editItem && editItem._type === "lead" && (
          <LeadForm initial={editItem} token={token} routesHook={routesHook}
            productsHook={productsHook} onClose={() => setEditItem(null)}
            onSaved={(l, isEdit) => { onLeadSaved(l, isEdit); setEditItem(null); }}
            onEnquirySaved={onEnquirySaved} />
        )}
      </AnimatePresence>
    </div>
  );
}