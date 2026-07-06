import {
  useState, useEffect, useCallback, useMemo,
  useDeferredValue, useTransition, memo,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth }      from "../../context/AuthContext";
import { useRoutes }    from "../../hooks/useRoutes";
import { useProducts }  from "../../hooks/useProducts";
import { bustDashboardCache } from "../../utils/cache";
import { Ic }           from "./icons";
import { cls, PBtn }    from "./ui/primitives";
import { TYPE_OPTS, DATE_OPTS } from "./constants";
import CustomSelect from "../components/CustomSelect";
import {
  isOverdue, isToday, isTomorrow, isFuture, fmtD,
  itemNearestDate, itemContactType,
  dueCls, dueLabel,
} from "./utils";
import { isSqClosed } from "./sqStatus";

import ProspectForm  from "./components/ProspectForm";
import LeadForm      from "./components/LeadForm";
import DetailPanel   from "./components/DetailPanel";
import ListRow       from "./components/ListRow";
import SQFlatRow     from "./components/SQFlatRow";
import OrderRow      from "./components/OrderRow";
import BottomNav     from "./BottomNav";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

// ─── local helper ────────────────────────────────────────────────────────────
function personLabel(p) {
  if (!p) return null;
  const name = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
  return name || p.email || null;
}

// ─── pure builders (defined outside component — never re-created) ─────────────

function buildFlatRows(filtered, rfqMap, nearDateMap, typeFilter, isAdmin, isSP, isSC) {
  const rows = [];
  filtered.forEach(item => {
    const rfqs  = item._type === "lead" ? (rfqMap[item.id] || []) : [];
    const hasSQ = item._type === "lead" && rfqs.some(r => r.sample_required || r.quotation_required);

    // In the "Tasks (all)" view, a lead with a sample/quotation enquiry is
    // represented entirely by its SQ row(s) below — don't also show the
    // generic lead card, or it appears twice. If every SQ row for the lead
    // turns out to be closed (and therefore hidden below), the lead simply
    // disappears from Tasks — it'll show back up under "Leads", ready to be
    // formally converted to an order from its enquiry detail.
    const suppressMainRow = typeFilter === "all" && hasSQ && (isAdmin || isSP || isSC);

    if (!suppressMainRow) {
      rows.push({ _rowType: "main", item, sortKey: nearDateMap[item.id] || "9999" });
    }

    if (item._type === "lead" && typeFilter === "all" && (isAdmin || isSP || isSC)) {
      rfqs.forEach(rfq => {
        const enriched = { ...rfq, _leadItem: item };
        // A sample/quotation row only shows while it's still open (not yet
        // Approved or Rejected) — once closed it no longer needs a follow-up.
        if (rfq.sample_required && !isSqClosed(rfq, true)) {
          const s = (rfq.samples || [])[0];
          rows.push({ _rowType: "sq", rfq: enriched, isSample: true,  sortKey: s?.follow_up_date  || "9999" });
        }
        if (rfq.quotation_required && !isSqClosed(rfq, false)) {
          const qt = (rfq.quotations || [])[0];
          rows.push({ _rowType: "sq", rfq: enriched, isSample: false, sortKey: qt?.follow_up_date || "9999" });
        }
      });
    }
  });
  rows.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  return rows;
}

// ─── Skeleton ────────────────────────────────────────────────────────────────
const ListSkeleton = memo(function ListSkeleton() {
  return (
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
});

const GridSkeleton = memo(function GridSkeleton() {
  return (
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
});

function OrdersEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <Ic.Check className="h-12 w-12 text-slate-200 mb-4" />
      <p className="text-sm font-semibold text-slate-600">No orders yet</p>
      <p className="text-xs text-slate-400 mt-1">Convert an enquiry from its detail view once Sample/Quotation is Approved</p>
    </div>
  );
}

// ─── Memoized mobile list ─────────────────────────────────────────────────────
// Receives already-computed rows — never filters inside, just renders.
// memo() means it only re-renders when its props actually change.
const PipelineList = memo(function PipelineList({
  flatRows, filteredOrders, filtered,
  loading, error,
  typeFilter, hasFilters, scope,
  token, user, nearDateMap, rfqMap,
  onSQUpdated, onOpenDetail, onClearFilters, onOrderReverted,
}) {
  if (loading) return <ListSkeleton />;

  if (error) return (
    <div className="p-5 m-4 rounded-2xl border border-rose-100 bg-rose-50 text-sm text-rose-700">{error}</div>
  );

  // Orders view — backed by the real /api/orders table
  if (typeFilter === "order") {
    if (filteredOrders.length === 0) return <OrdersEmptyState />;
    return (
      <div>
        {filteredOrders.map(order => (
          <OrderRow key={order.id} order={order} token={token} user={user} onReverted={onOrderReverted} />
        ))}
      </div>
    );
  }

  // Main list
  if (filtered.length === 0) return (
    <EmptyState
      icon={<Ic.Radar className="h-12 w-12 text-slate-200" />}
      title={hasFilters ? "No matching records" : scope === "mine" ? "No records assigned to you yet" : "No records yet"}
      subtitle={hasFilters ? "Adjust search or filters" : scope === "mine" ? "Switch to Team to see everyone's work" : "Add a prospect to get started"}
      action={hasFilters ? <button onClick={onClearFilters} className="mt-3 text-xs font-semibold text-indigo-600 hover:underline">Clear filters</button> : null}
    />
  );

  return (
    <div>
      {flatRows.map(row => {
        if (row._rowType === "sq") {
          return (
            <SQFlatRow
              key={`sq-${row.rfq.id}-${row.isSample ? "s" : "q"}`}
              rfq={row.rfq} isSample={row.isSample} token={token} user={user}
              onUpdated={onSQUpdated}
            />
          );
        }
        return (
          <ListRow
            key={`${row.item._type}-${row.item.id}`}
            item={row.item}
            nearDate={nearDateMap[row.item.id]}
            rfqs={row.item._type === "lead" ? (rfqMap[row.item.id] || []) : []}
            onClick={() => onOpenDetail(row.item)}
          />
        );
      })}
    </div>
  );
});

// ─── Memoized desktop grid ────────────────────────────────────────────────────
const PipelineGrid = memo(function PipelineGrid({
  filtered, filteredOrders, flatRows,
  loading, error,
  typeFilter, hasFilters, scope,
  token, user, nearDateMap, rfqMap, contactTypeMap,
  isSearchStale,
  onSQUpdated, onOpenDetail, onClearFilters, onSetScope, onOrderReverted,
}) {
  if (loading) return <GridSkeleton />;

  if (error) return (
    <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-4 text-sm text-rose-700">{error}</div>
  );

  // Orders view
  if (typeFilter === "order") {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {filteredOrders.length === 0
          ? <OrdersEmptyState />
          : filteredOrders.map(order => (
            <OrderRow key={order.id} order={order} token={token} user={user} onReverted={onOrderReverted} />
          ))}
      </div>
    );
  }

  // Main card grid — no framer layout/AnimatePresence during search (too expensive)
  if (filtered.length === 0) return (
    <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white/50 px-6 py-20 text-center">
      <Ic.Radar className="h-10 w-10 text-slate-300 mb-3" />
      <p className="text-sm font-semibold text-slate-600">
        {hasFilters ? "No matching records" : scope === "mine" ? "No records assigned to you yet" : "No records yet"}
      </p>
      {hasFilters
        ? <button onClick={onClearFilters} className="mt-2 text-xs font-semibold text-indigo-600 hover:underline">Clear filters</button>
        : scope === "mine"
        ? <button onClick={() => onSetScope("team")} className="mt-2 text-xs font-semibold text-indigo-600 hover:underline">Switch to Team</button>
        : null}
    </div>
  );

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {filtered.map((item) => {
        const isLead      = item._type === "lead";
        const nd          = nearDateMap[item.id];
        const ov          = isOverdue(nd);
        const td          = isToday(nd);
        const tm          = isTomorrow(nd);
        const rfqs        = rfqMap[item.id] || [];
        const hasSample   = rfqs.some(r => r.sample_required);
        const hasQuote    = rfqs.some(r => r.quotation_required);
        const contactType = contactTypeMap[item.id];
        const creatorName = personLabel(item.creator);
        const updaterName = personLabel(item.updater);
        const showUpdater = updaterName && updaterName !== creatorName;

        return (
          <article
            key={`${item._type}-${item.id}`}
            onClick={() => onOpenDetail(item)}
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

              {(creatorName || showUpdater) && (
                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 border-t border-slate-100 pt-2">
                  {creatorName && (
                    <span className="text-[10px] text-slate-400">
                      By <span className="font-semibold text-slate-500">{creatorName}</span>
                    </span>
                  )}
                  {showUpdater && (
                    <span className="text-[10px] text-slate-400">
                      · Updated by <span className="font-semibold text-slate-500">{updaterName}</span>
                    </span>
                  )}
                </div>
              )}

              <div className="mt-3 flex items-center justify-end border-t border-slate-100 pt-3">
                <span className="flex items-center gap-1 text-[12px] font-semibold text-indigo-500 opacity-0 transition-opacity group-hover:opacity-100">
                  View details <Ic.ChevR className="h-3 w-3" />
                </span>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
});

// ─── small shared empty state ─────────────────────────────────────────────────
function EmptyState({ icon, title, subtitle, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      {icon && <div className="mb-4">{icon}</div>}
      {title    && <p className="text-sm font-semibold text-slate-600">{title}</p>}
      {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
      {action}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Pipeline() {
  const { user, token } = useAuth();
  const isAdmin = user?.role === "Admin";
  const isSC    = user?.role === "SalesCoordinator";
  const isSP    = !isAdmin && !isSC;

  // useTransition: marks filter/scope state updates as non-urgent so React
  // always finishes the input keystroke first before re-rendering the list.
  const [isPending, startTransition] = useTransition();

  const initialType = useMemo(() => {
    if (isSC) return "all";
    const params = new URLSearchParams(window.location.search);
    const t = params.get("type") || "all";
    if (t === "sample" || t === "quotation") return "lead";
    return t;
  }, []); // eslint-disable-line

  const routesHook   = useRoutes();
  const productsHook = useProducts();

  const [prospects, setProspects] = useState([]);
  const [leads,     setLeads]     = useState([]);
  const [rfqMap,    setRFQMap]    = useState({});
  const [orders,    setOrders]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");

  // ── CRITICAL: search has TWO states ──────────────────────────────────────
  // `search`         → bound directly to the input (updates every keystroke, zero delay)
  // `deferredSearch` → what the filter useMemo reads (React defers this update;
  //                    if a new keystroke arrives before the filter finishes rendering,
  //                    React throws away the stale render and starts fresh)
  //
  // This means the input is NEVER blocked by filtering work.
  const [search, setSearch] = useState("");
  const deferredSearch      = useDeferredValue(search);
  // true while the deferred value is catching up — use for visual hint only
  const isSearchStale       = search !== deferredSearch;

  // Filter toggles go through startTransition so React treats them as
  // interruptible low-priority work, same as deferredSearch.
  const [typeFilter,   setTypeFilter]   = useState(initialType);
  const [dateFilter,   setDateFilter]   = useState("all");
  const [scope,        setScope]        = useState("mine");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [selectedItem, setSelectedItem] = useState(null);
  const [showAddProspect, setShowAddProspect] = useState(false);
  const [editItem,     setEditItem]     = useState(null);


  // ── Data fetch ──────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [pRes, lRes, rRes, oRes] = await Promise.all([
        fetch(`${API}/api/prospects`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/leads`,     { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/rfqs`,      { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/orders`,    { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const [pJ, lJ, rJ, oJ] = await Promise.all([pRes.json(), lRes.json(), rRes.json(), oRes.json()]);
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
      // Orders endpoint is additive — don't fail the whole page load if it's
      // missing/erroring on an older backend that hasn't been migrated yet.
      setOrders(oJ?.success ? (oJ.orders || []) : []);
    } catch (e) {
      console.error("fetchAll error:", e);
      setError(e.message);
    } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Derived data (stable, only recomputes on actual data changes) ────────
  const mergedList = useMemo(() => {
    const linkedIds = new Set(leads.filter(l => l.prospect_id).map(l => l.prospect_id));
    const pItems    = prospects.filter(p => !linkedIds.has(p.id)).map(p => ({ ...p, _type: "prospect" }));
    const lItems    = leads.map(l => ({ ...l, _type: "lead" }));
    const all       = [...pItems, ...lItems];
    if (scope === "mine") return all.filter(i => i.created_by === user?.id || i.updated_by === user?.id);
    return all;
  }, [prospects, leads, scope, user?.id]);

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

  // rfq_id -> order record, for hiding/labeling already-converted enquiries
  // in the Detail panel (see DetailPanel/EnquiryCard).
  const ordersByRfq = useMemo(() => {
    const m = {};
    orders.forEach(o => { m[o.rfq_id] = o; });
    return m;
  }, [orders]);

  const teamMembers = useMemo(() => {
    const seen = new Map();
    mergedList.forEach(i => {
      if (i.creator) seen.set(i.creator.id, i.creator);
      if (i.updater) seen.set(i.updater.id, i.updater);
    });
    return [...seen.values()].sort((a, b) => {
      const an = [a.first_name, a.last_name].filter(Boolean).join(" ");
      const bn = [b.first_name, b.last_name].filter(Boolean).join(" ");
      return an.localeCompare(bn);
    });
  }, [mergedList]);

  const teamMemberOptions = useMemo(() => [
    { value: "all", label: "All Members" },
    ...teamMembers.map(u => ({
      value: String(u.id),
      label: [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email || "Unknown",
      description: u.email || undefined,
    })),
  ], [teamMembers]);

  // ── FILTERING — reads deferredSearch, NOT search ─────────────────────────
  // This useMemo only re-runs AFTER React has finished painting the new
  // input character. The user never waits for this to finish before seeing
  // their keystroke appear in the box.
  const filtered = useMemo(() => {
    if (typeFilter === "order") return []; // Orders tab reads from `orders` directly, not this list
    let list = mergedList;

    // Type filter (Tasks / Prospects / Leads)
    if (typeFilter === "all") {
      list = list.filter(i => i._type !== "lead" || (rfqMap[i.id] || []).length > 0);
    } else {
      list = list.filter(i => i._type === typeFilter);
    }

    // Date filter
    if (dateFilter !== "all") {
      list = list.filter(i => {
        const d = nearDateMap[i.id];
        if (dateFilter === "overdue")  return isOverdue(d);
        if (dateFilter === "today")    return isToday(d);
        if (dateFilter === "tomorrow") return isTomorrow(d);
        if (dateFilter === "future")   return d && isFuture(d);
        return true;
      });
    }

    // Assignee filter
    if (scope === "team" && assigneeFilter !== "all") {
      list = list.filter(i =>
        String(i.created_by) === assigneeFilter || String(i.updated_by) === assigneeFilter
      );
    }


    // Search — uses deferredSearch so this never blocks keystrokes
    if (deferredSearch.trim()) {
      const q = deferredSearch.toLowerCase();
      list = list.filter(i => {
        const creatorMatch = i.creator && (
          [i.creator.first_name, i.creator.last_name].filter(Boolean).join(" ").toLowerCase().includes(q) ||
          i.creator.email?.toLowerCase().includes(q)
        );
        const updaterMatch = i.updater && (
          [i.updater.first_name, i.updater.last_name].filter(Boolean).join(" ").toLowerCase().includes(q) ||
          i.updater.email?.toLowerCase().includes(q)
        );
        const basicMatch =
          i.company_name?.toLowerCase().includes(q) ||
          i.nature_of_business?.toLowerCase().includes(q) ||
          i.city?.toLowerCase().includes(q) ||
          i.state?.toLowerCase().includes(q) ||
          i.zone?.toLowerCase().includes(q) ||
          i.source?.toLowerCase().includes(q) ||
          i.primary_contact_name?.toLowerCase().includes(q) ||
          i.primary_phone?.includes(q) ||
          creatorMatch || updaterMatch;
        if (basicMatch) return true;
        if (i._type === "lead") {
          return (rfqMap[i.id] || []).some(rfq =>
            (rfq.samples    || []).some(s  => s.sample_code?.toLowerCase().includes(q)) ||
            (rfq.quotations || []).some(qt => qt.quotation_code?.toLowerCase().includes(q))
          );
        }
        return false;
      });
    }

    return [...list].sort((a, b) => {
      const ad = nearDateMap[a.id] || "9999";
      const bd = nearDateMap[b.id] || "9999";
      return ad.localeCompare(bd);
    });
   }, [mergedList, typeFilter, dateFilter, assigneeFilter, scope, deferredSearch, nearDateMap, rfqMap]);

  // ── Orders tab data — sourced straight from the backend, filtered by the
  // same search box for consistency with the other tabs. ───────────────────
  const filteredOrders = useMemo(() => {
    if (!deferredSearch.trim()) return orders;
    const q = deferredSearch.toLowerCase();
    return orders.filter(o => {
      const rfq  = o.rfqs  || {};
      const lead = rfq.leads || {};
      return (
        lead.company_name?.toLowerCase().includes(q) ||
        rfq.product_name?.toLowerCase().includes(q) ||
        rfq.product_category?.toLowerCase().includes(q) ||
        lead.primary_contact_name?.toLowerCase().includes(q) ||
        lead.city?.toLowerCase().includes(q)
      );
    });
  }, [orders, deferredSearch]);

  // ── Pre-built row arrays (memoized so child components receive stable refs) ─
  const flatRows = useMemo(
    () => buildFlatRows(filtered, rfqMap, nearDateMap, typeFilter, isAdmin, isSP, isSC),
    [filtered, rfqMap, nearDateMap, typeFilter, isAdmin, isSP, isSC]
  );

  // ── Derived counts ────────────────────────────────────────────────────────
  const pCount       = useMemo(() => filtered.filter(i => i._type === "prospect").length, [filtered]);
  const lCount       = useMemo(() => filtered.filter(i => i._type === "lead").length,     [filtered]);
  const overdueCount = useMemo(() => filtered.filter(i => isOverdue(nearDateMap[i.id])).length, [filtered, nearDateMap]);
  const hasFilters = typeFilter !== "all" || dateFilter !== "all" || Boolean(deferredSearch.trim()) || assigneeFilter !== "all";

  // ── Handlers (stable references via useCallback) ──────────────────────────
  const openDetail = useCallback((item) => setSelectedItem(item), []);
  const clearFilters = useCallback(() => {
    setSearch("");
    startTransition(() => {
      setTypeFilter("all");
      setDateFilter("all");
      setAssigneeFilter("all");
    });
  }, [startTransition]);

  const selectTypeFilter = useCallback((v) => {
    startTransition(() => {
      setTypeFilter(v);
    });
  }, [startTransition]);

  const handleSetScope = useCallback((v) => {
    startTransition(() => {
    setScope(v);
    if (v === "mine") setAssigneeFilter("all");
    });
  }, [startTransition]);

  // Stable SQ update handler — doesn't change identity on re-renders
  const handleSQUpdated = useCallback((rfqId, type, data) => {
    setRFQMap(p => {
      const leadId = Object.keys(p).find(k => p[k].some(r => r.id === rfqId));
      if (!leadId || !p[leadId]) return p;
      return {
        ...p,
        [leadId]: p[leadId].map(r => {
          if (r.id !== rfqId) return r;
          if (type === "sample")            return { ...r, samples:    [data.sample,    ...(r.samples    || []).slice(1)] };
          if (type === "quotation")         return { ...r, quotations: [data.quotation, ...(r.quotations || []).slice(1)] };
          if (type === "sample-deleted")    return { ...r, samples: [] };
          if (type === "quotation-deleted") return { ...r, quotations: [] };
          return r;
        }),
      };
    });
  }, []);

  const handleDelete = useCallback(async (item) => {
    if (!window.confirm(`Delete "${item.company_name}"?`)) return;
    const url = item._type === "lead"
      ? `${API}/api/leads/${item.id}`
      : `${API}/api/prospects/${item.id}`;
    try {
      const r = await fetch(url, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error("Delete failed");
      bustDashboardCache();
      if (item._type === "lead") setLeads(p => p.filter(l => l.id !== item.id));
      else setProspects(p => p.filter(pr => pr.id !== item.id));
      setSelectedItem(null);
    } catch (e) { alert(e.message); }
  }, [token]);

  const openEdit = useCallback((item) => { setEditItem(item); setSelectedItem(null); }, []);

  const onProspectSaved = useCallback((prospect, isEdit) => {
    bustDashboardCache();
    if (isEdit) setProspects(p => p.map(pr => pr.id === prospect.id ? { ...pr, ...prospect } : pr));
    else        setProspects(p => [prospect, ...p]);
  }, []);

  const onLeadSaved = useCallback((lead, isEdit) => {
    bustDashboardCache();
    if (isEdit) setLeads(p => p.map(l => l.id === lead.id ? { ...l, ...lead } : l));
    else        setLeads(p => [lead, ...p]);
  }, []);

  const onConverted = useCallback((lead) => {
    bustDashboardCache();
    setLeads(p => [lead, ...p]);
    fetchAll();
  }, [fetchAll]);

  const onEnquirySaved = useCallback((newRFQ) => {
    bustDashboardCache();
    setRFQMap(p => ({ ...p, [newRFQ.lead_id]: [newRFQ, ...(p[newRFQ.lead_id] || [])] }));
  }, []);

  const onEnquiryUpdated = useCallback((mode, rfqId, data) => {
    if (mode === "purge") {
      setRFQMap(p => {
        const leadId = Object.keys(p).find(k => p[k].some(r => r.id === rfqId));
        if (!leadId) return p;
        return { ...p, [leadId]: p[leadId].filter(r => r.id !== rfqId) };
      });
      return;
    }
    // Sample/quotation status updates (from EnquiryCard's inline SQLPanel)
    // and their deletes need to patch the rfq's samples/quotations arrays,
    // same as Pipeline's own handleSQUpdated does for SQFlatRow.
    if (mode === "sample" || mode === "quotation" || mode === "sample-deleted" || mode === "quotation-deleted") {
      setRFQMap(p => {
        const leadId = Object.keys(p).find(k => p[k].some(r => r.id === rfqId));
        if (!leadId) return p;
        return {
          ...p,
          [leadId]: p[leadId].map(r => {
            if (r.id !== rfqId) return r;
            if (mode === "sample")            return { ...r, samples:    [data.sample,    ...(r.samples    || []).slice(1)] };
            if (mode === "quotation")         return { ...r, quotations: [data.quotation, ...(r.quotations || []).slice(1)] };
            if (mode === "sample-deleted")    return { ...r, samples: [] };
            if (mode === "quotation-deleted") return { ...r, quotations: [] };
            return r;
          }),
        };
      });
      return;
    }
    // A real, backend-persisted order was just created from EnquiryCard's
    // "Convert to Order" button — add it (or replace a stale copy of it).
    if (mode === "order-created") {
      setOrders(p => [data, ...p.filter(o => o.rfq_id !== rfqId)]);
      return;
    }
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
  }, []);

  const onOrderReverted = useCallback((orderId) => {
    setOrders(p => p.filter(o => o.id !== orderId));
  }, []);

  const onPurged = useCallback((item) => {
    bustDashboardCache();
    if (item._type === "lead") {
      setLeads(p => p.filter(l => l.id !== item.id));
      setRFQMap(p => { const { [item.id]: _drop, ...rest } = p; return rest; });
    } else {
      setProspects(p => p.filter(pr => pr.id !== item.id));
      setLeads(p => p.filter(l => l.prospect_id !== item.id));
    }
  }, []);

  useEffect(() => {
    if (selectedItem && selectedItem._type === "lead") {
      const fresh = rfqMap[selectedItem.id];
      if (fresh) setSelectedItem(p => p ? { ...p, _rfqs: fresh } : p);
    }
  }, [rfqMap]); // eslint-disable-line

  // ── Scope toggle (inline component — stable since it only closes over setScope) ──
  // Defined as a memo component OUTSIDE render so it doesn't re-mount on each render
  const ScopeToggleEl = useCallback(({ size = "md" }) => (
    <div className={cls("inline-flex rounded-full bg-slate-100 p-0.5", size === "sm" ? "text-[11px]" : "text-[12px]")}>
      {["mine", "team"].map(v => (
        <button
          key={v}
          onClick={() => handleSetScope(v)}
          className={cls(
            "rounded-full px-3 py-1 font-semibold capitalize transition-all",
            scope === v ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          {v === "mine" ? "Mine" : "Team"}
        </button>
      ))}
    </div>
  ), [scope, handleSetScope]);

  // ── Shared props for both list and grid ───────────────────────────────────
  const sharedListProps = {
    flatRows, filteredOrders, filtered,
    loading, error,
    typeFilter, hasFilters, scope,
    token, user, nearDateMap, rfqMap, contactTypeMap,
    isSearchStale,
    onSQUpdated: handleSQUpdated,
    onOpenDetail: openDetail,
    onClearFilters: clearFilters,
    onSetScope: handleSetScope,
    onOrderReverted,
  };

  // ── Search input handler — ONLY updates search state, nothing else ────────
  // The filtering work happens separately via deferredSearch + useMemo.
  const handleSearchChange = useCallback((e) => setSearch(e.target.value), []);
  const handleSearchClear  = useCallback(() => setSearch(""), []);

  return (
    <div className="min-h-screen bg-slate-50 lg:bg-gradient-to-br lg:from-slate-50 lg:via-white lg:to-indigo-50/30">

      {/* ══ MOBILE / TABLET ══════════════════════════════════════════════════ */}
      <div className="lg:hidden flex flex-col h-screen pb-20">

        <div className="sticky top-0 z-30 bg-white border-b border-slate-100 shadow-sm">
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-slate-900">Pipeline</h1>
              <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                <span className="text-[11px] text-teal-600 font-semibold">{pCount} prospects</span>
                <span className="text-slate-300">·</span>
                <span className="text-[11px] text-indigo-600 font-semibold">{lCount} leads</span>
                <span className="text-slate-300">·</span>
                <span className="text-[11px] text-emerald-600 font-semibold">{orders.length} orders</span>
                {overdueCount > 0 && (
                  <>
                    <span className="text-slate-300">·</span>
                    <span className="text-[11px] text-rose-500 font-semibold animate-pulse">{overdueCount} overdue</span>
                  </>
                )}
              </div>
            </div>
            <ScopeToggleEl size="sm" />
            </div>

          {/* Search bar — deliberately minimal onChange: just setSearch */}
          <div className="px-4 pb-2 flex items-center gap-2">
  <div className="relative flex-1">
    {isSearchStale || isPending
      ? <Ic.Spin className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-indigo-400 animate-spin" />
      : <Ic.Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    }
    <input
      value={search}
      onChange={handleSearchChange}
      placeholder="Search company, city, product…"
      className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-10 text-sm placeholder:text-slate-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:bg-white transition-colors"
    />
    {search && (
      <button
        onClick={handleSearchClear}
        className="absolute right-3 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-slate-500 hover:bg-slate-300"
      >
        <Ic.X className="h-3 w-3" />
      </button>
    )}
  </div>
  {hasFilters && (
    <button
      onClick={clearFilters}
      className="shrink-0 flex items-center justify-center gap-1 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-slate-500 hover:bg-slate-50 active:bg-slate-100 transition-colors"
    >
      <Ic.X className="h-4 w-4" />
      <span className="text-[11px] font-semibold">Clear</span>
    </button>
  )}
          </div>

          {/* Member filter — only shown in team scope */}
          {scope === "team" && teamMemberOptions.length > 1 && (
            <div className="px-4 pb-2">
              <CustomSelect
                value={assigneeFilter}
                onChange={(v) => startTransition(() => setAssigneeFilter(v))}
                options={teamMemberOptions}
                placeholder="Filter by member…"
                label="Team Member"
                searchable
                compact
              />
            </div>
          )}

          <div className="px-4 pb-3">
            <div
              className="flex gap-1.5 overflow-x-auto no-scrollbar"
              style={{ WebkitOverflowScrolling: "touch", overscrollBehaviorX: "contain" }}
            >
              {TYPE_OPTS.map(f => (
                <button key={f.v} onClick={() => selectTypeFilter(f.v)}
                  className={cls(
                    "shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-all",
                    typeFilter === f.v ? "bg-indigo-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  )}>
                  {f.l}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* List — wrapped in a div that fades slightly while stale */}
        <div
          className={cls(
            "flex-1 overflow-y-auto bg-white transition-opacity duration-150",
            isSearchStale ? "opacity-70" : "opacity-100"
          )}
        >
          <PipelineList {...sharedListProps} />
        </div>

        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={() => setShowAddProspect(true)}
          className="fixed bottom-20 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-xl shadow-indigo-300/60 hover:bg-indigo-700"
        >
          <Ic.Plus className="h-6 w-6" />
        </motion.button>
      </div>

      {/* ══ DESKTOP ══════════════════════════════════════════════════════════ */}
      <div className="hidden lg:block">
        <div className="relative mx-auto max-w-6xl px-5 py-7 lg:px-8 lg:py-9">

          <div className="pointer-events-none fixed inset-0 overflow-hidden">
            <div className="absolute -right-32 -top-32 h-80 w-80 rounded-full bg-indigo-100/40 blur-3xl" />
            <div className="absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-violet-100/30 blur-3xl" />
          </div>

          <div className="relative mb-6 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Pipeline</h1>
              <p className="mt-1 text-sm text-slate-500">
                {scope === "mine" ? "Your records" : isAdmin ? "All prospects & leads" : "Team prospects, leads & tasks"}
                <span className="mx-1.5 text-slate-300">·</span>
                <span className="font-semibold text-teal-600">{pCount} prospects</span>
                <span className="mx-1.5 text-slate-300">·</span>
                <span className="font-semibold text-indigo-600">{lCount} leads</span>
                <span className="mx-1.5 text-slate-300">·</span>
                <span className="font-semibold text-emerald-600">{orders.length} orders</span>
                {overdueCount > 0 && (
                  <><span className="mx-1.5 text-slate-300">·</span><span className="font-semibold text-rose-500">{overdueCount} overdue</span></>
                )}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <ScopeToggleEl />
              <PBtn onClick={() => setShowAddProspect(true)}>
                <Ic.Plus className="h-4 w-4" /> Add Prospect
              </PBtn>
            </div>
          </div>

          <div className="mb-6 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
              <div className="relative flex-1">
                {isSearchStale || isPending
                  ? <Ic.Spin className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-indigo-400 animate-spin" />
                  : <Ic.Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                }
                <input
                  value={search}
                  onChange={handleSearchChange}
                  placeholder="Search company, contact, city, product, source, created/updated by…"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-9 text-sm placeholder:text-slate-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:bg-white transition-colors"
                />
                {search && (
                  <button
                    onClick={handleSearchClear}
                    className="absolute right-3 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-slate-500 hover:bg-slate-300 transition-colors"
                  >
                    <Ic.X className="h-3 w-3" />
                  </button>
                )}
              </div>
              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className="shrink-0 flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  <Ic.X className="h-3.5 w-3.5" /> Clear
                </button>
              )}
            </div>

            <div className="flex items-center gap-4 px-4 py-2.5 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Type</span>
                {TYPE_OPTS.map(f => (
                  <button key={f.v} onClick={() => selectTypeFilter(f.v)}
                    className={cls(
                      "rounded-full px-3 py-1.5 text-[12px] font-semibold transition-all",
                      typeFilter === f.v ? "bg-indigo-600 text-white" : "text-slate-500 hover:bg-slate-100"
                    )}>
                    {f.l}
                  </button>
                ))}
              </div>
              {typeFilter !== "order" && (
                <>
                  <div className="h-4 w-px bg-slate-200 hidden sm:block" />
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
                </>
              )}
              {/* Member filter */}
              {typeFilter !== "order" && scope === "team" && teamMemberOptions.length > 1 && (
                <>
                  <div className="h-4 w-px bg-slate-200 hidden sm:block" />
                  <div className="flex items-center gap-2 min-w-[160px]">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 shrink-0">Member</span>
                    <CustomSelect
                      value={assigneeFilter}
                      onChange={(v) => startTransition(() => setAssigneeFilter(v))}
                      options={teamMemberOptions}
                      placeholder="All members…"
                      label="Team Member"
                      searchable
                      compact
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Grid — fades while filtering so user sees immediate feedback */}
          <div className={cls("transition-opacity duration-150", isSearchStale ? "opacity-70" : "opacity-100")}>
            <PipelineGrid {...sharedListProps} />
          </div>
        </div>
      </div>

      <BottomNav />

      <AnimatePresence>
        {selectedItem && (
          <DetailPanel
            item={selectedItem} user={user} token={token}
            rfqsForLead={selectedItem._type === "lead" ? (rfqMap[selectedItem.id] || []) : []}
            ordersByRfq={ordersByRfq}
            onClose={() => setSelectedItem(null)} onEdit={openEdit} onDelete={handleDelete}
            onConverted={onConverted} onEnquirySaved={onEnquirySaved}
            onEnquiryUpdated={onEnquiryUpdated} onPurged={onPurged} productsHook={productsHook}
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