// Products.jsx
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { useProducts } from "../hooks/useProducts";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";
const emptyForm = { category: "", sub_category: "", product_name: "" };

/* ─── level design tokens ─────────────────────────────────────────────────── */
const LEVEL_CONFIG = {
  category:     { color: "bg-sky-100 text-sky-800 ring-sky-200",         dot: "bg-sky-400"     },
  sub_category: { color: "bg-violet-100 text-violet-800 ring-violet-200", dot: "bg-violet-400"  },
  product:      { color: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-400" },
};

const INDENT_PX = 22;

/* ─── primitives ──────────────────────────────────────────────────────────── */
function inputCls(extra = "") {
  return `w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-150 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 ${extra}`;
}
function Label({ children }) {
  return <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">{children}</label>;
}
function PrimaryBtn({ children, className = "", ...props }) {
  return (
    <button {...props} className={`inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-200 transition-all duration-150 hover:bg-indigo-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${className}`}>
      {children}
    </button>
  );
}
function GhostBtn({ children, className = "", ...props }) {
  return (
    <button {...props} className={`inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition-all duration-150 hover:bg-slate-50 active:scale-[0.98] ${className}`}>
      {children}
    </button>
  );
}
function Backdrop({ onClick, children }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
      onClick={onClick} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      {children}
    </motion.div>
  );
}
function ModalShell({ children }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 8 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }} onClick={(e) => e.stopPropagation()}
      className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-slate-900/5 sm:p-6">
      {children}
    </motion.div>
  );
}
function EmptyState({ title, subtitle }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-20 text-center">
      <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-white shadow-sm ring-1 ring-slate-100">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-400">
          <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      </div>
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}
    </div>
  );
}

/* ─── icons ───────────────────────────────────────────────────────────────── */
const ChevronIcon = ({ open }) => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
    className={`shrink-0 text-slate-400 transition-transform duration-200 ${open ? "rotate-90" : ""}`}>
    <path d="M9 18l6-6-6-6" />
  </svg>
);

const LEVEL_ICONS = {
  category: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
      <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
    </svg>
  ),
  sub_category: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
    </svg>
  ),
  product: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
      <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  ),
};

/* ─── stat card ───────────────────────────────────────────────────────────── */
function StatCard({ label, value, borderColor }) {
  return (
    <div className={`rounded-xl border bg-white px-4 py-3 shadow-sm ${borderColor}`}>
      <p className="text-2xl font-bold text-slate-900 tabular-nums">{value}</p>
      <p className="text-xs font-medium text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}

/* ─── TreeNode ────────────────────────────────────────────────────────────── */
function TreeNode({ level, label, depth = 0, children, product, canManage, onEdit, onDelete }) {
  const [open, setOpen] = useState(depth < 1);
  const isLeaf = level === "product";
  const cfg = LEVEL_CONFIG[level];
  const hasChildren = children && children.length > 0;

  return (
    <div>
      <div
        className={`group flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors duration-100
          ${isLeaf ? "hover:bg-emerald-50/60 cursor-default" : "hover:bg-slate-100/70 cursor-pointer"}`}
        style={{ paddingLeft: `${depth * INDENT_PX + 8}px` }}
        onClick={() => !isLeaf && setOpen((v) => !v)}
      >
        {/* chevron / spacer */}
        {!isLeaf ? (
          <span className="shrink-0 w-4 flex items-center justify-center">
            <ChevronIcon open={open} />
          </span>
        ) : (
          <span className="shrink-0 w-4" />
        )}

        {/* level icon */}
        <span className={cfg.color.split(" ").find(c => c.startsWith("text-"))}>
          {LEVEL_ICONS[level]}
        </span>

        {/* label */}
        <span className={`flex-1 truncate text-sm ${isLeaf ? "font-normal text-slate-600" : "font-semibold text-slate-800"}`}>
          {label}
        </span>

        {/* child count badge */}
        {!isLeaf && hasChildren && (
          <span className="shrink-0 text-[10px] font-semibold tabular-nums text-slate-400">
            {children.length}
          </span>
        )}

        {/* leaf actions */}
        {isLeaf && canManage && (
          <div
            className="flex shrink-0 gap-0.5 opacity-0 transition-opacity duration-100 group-hover:opacity-100"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => onEdit(product)}
              className="grid h-6 w-6 place-items-center rounded text-slate-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.12 2.12 0 113 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            <button
              onClick={() => onDelete(product.id)}
              className="grid h-6 w-6 place-items-center rounded text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0l-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6h16z" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* animated children */}
      {!isLeaf && hasChildren && (
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              {children}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

/* ─── main page ───────────────────────────────────────────────────────────── */
export default function Products() {
  const { user, token } = useAuth();
  const canManage = ["Admin", "SalesCoordinator"].includes(user?.role);
  const { products, loading, refetch, categories, subCategories } = useProducts();

  const [search, setSearch]         = useState("");
  const [showModal, setShowModal]   = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [form, setForm]             = useState(emptyForm);
  const [saving, setSaving]         = useState(false);
  const [formError, setFormError]   = useState("");

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  /* filtered flat list */
  const q = search.toLowerCase();
  const filtered = q
    ? products.filter(p =>
        p.product_name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.sub_category.toLowerCase().includes(q)
      )
    : products;

  /* derive tree from filtered list */
  const filteredCategories = [...new Set(filtered.map(p => p.category))].sort();
  function filteredSubs(cat) {
    return [...new Set(filtered.filter(p => p.category === cat).map(p => p.sub_category))].sort();
  }
  function filteredProducts(cat, sub) {
    return filtered.filter(p => p.category === cat && p.sub_category === sub);
  }

  /* stats */
  const totalCats = [...new Set(products.map(p => p.category))].length;
  const totalSubs = [...new Set(products.map(p => `${p.category}__${p.sub_category}`))].length;

  function openAdd() { setEditProduct(null); setForm(emptyForm); setFormError(""); setShowModal(true); }
  function openEdit(p) {
    setEditProduct(p);
    setForm({ category: p.category, sub_category: p.sub_category, product_name: p.product_name });
    setFormError(""); setShowModal(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.category.trim() || !form.sub_category.trim() || !form.product_name.trim()) {
      setFormError("All fields are required"); return;
    }
    setSaving(true); setFormError("");
    try {
      const url    = editProduct ? `${API}/api/products/${editProduct.id}` : `${API}/api/products`;
      const method = editProduct ? "PUT" : "POST";
      const res    = await fetch(url, { method, headers, body: JSON.stringify(form) });
      const data   = await res.json();
      if (!res.ok) throw new Error(data.message);
      setShowModal(false); refetch();
    } catch (err) { setFormError(err.message); }
    finally { setSaving(false); }
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this product?")) return;
    try {
      const res = await fetch(`${API}/api/products/${id}`, { method: "DELETE", headers });
      if (!res.ok) throw new Error("Delete failed");
      refetch();
    } catch (err) { alert(err.message); }
  }

  const hasSearch = search.trim().length > 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">

        {/* ── Header ── */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Products</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {products.length} product{products.length !== 1 ? "s" : ""} across {totalCats} categor{totalCats !== 1 ? "ies" : "y"}
            </p>
          </div>
          {canManage && (
            <PrimaryBtn onClick={openAdd}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add Product
            </PrimaryBtn>
          )}
        </div>

        {/* ── Stats ── */}
        {!loading && products.length > 0 && (
          <div className="mb-5 grid grid-cols-3 gap-3">
            <StatCard label="Products"        value={products.length} borderColor="border-slate-100" />
            <StatCard label="Categories"      value={totalCats}       borderColor="border-sky-100" />
            <StatCard label="Sub-Categories"  value={totalSubs}       borderColor="border-violet-100" />
          </div>
        )}

        {/* ── Search ── */}
        <div className="mb-4 flex gap-2">
          <div className="relative flex-1">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <path d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
            </svg>
            <input
              placeholder="Search category, sub-category, or product…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={inputCls("pl-9")}
            />
          </div>
          {hasSearch && (
            <button
              onClick={() => setSearch("")}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {/* ── Legend ── */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {[
            ["category",     "Category"],
            ["sub_category", "Sub-Category"],
            ["product",      "Product"],
          ].map(([key, lbl]) => (
            <span key={key} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${LEVEL_CONFIG[key].color}`}>
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${LEVEL_CONFIG[key].dot}`} />
              {lbl}
            </span>
          ))}
        </div>

        {/* ── Loading skeleton ── */}
        {loading && (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-9 animate-pulse rounded-lg bg-slate-100"
                style={{ marginLeft: `${(i % 3) * INDENT_PX}px` }} />
            ))}
          </div>
        )}

        {/* ── Empty ── */}
        {!loading && filtered.length === 0 && (
          <EmptyState
            title={hasSearch ? "No matches" : "No products yet"}
            subtitle={hasSearch ? "Try a different search term" : canManage ? "Click 'Add Product' to get started" : "No products have been added yet"}
          />
        )}

        {/* ── Tree ── */}
        {!loading && filtered.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="p-2">
              {filteredCategories.map((cat) => (
                <TreeNode key={cat} level="category" label={cat} depth={0}
                  children={filteredSubs(cat).map((sub) => (
                    <TreeNode key={sub} level="sub_category" label={sub} depth={1}
                      children={filteredProducts(cat, sub).map((p) => (
                        <TreeNode key={p.id} level="product" label={p.product_name} depth={2}
                          product={p} canManage={canManage} onEdit={openEdit} onDelete={handleDelete}
                        />
                      ))}
                    />
                  ))}
                />
              ))}
            </div>
          </div>
        )}

      </div>

      {/* ── Modal ── */}
      <AnimatePresence>
        {showModal && (
          <Backdrop onClick={() => setShowModal(false)}>
            <ModalShell>
              <div className="mb-5 flex items-center justify-between">
                <h3 className="text-lg font-semibold tracking-tight text-slate-900">
                  {editProduct ? "Edit Product" : "Add Product"}
                </h3>
                <button onClick={() => setShowModal(false)}
                  className="grid h-8 w-8 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3.5">
                {[
                  ["Category *",      "category"],
                  ["Sub-Category *",  "sub_category"],
                  ["Product Name *",  "product_name"],
                ].map(([lbl, name]) => (
                  <div key={name}>
                    <Label>{lbl}</Label>
                    <input
                      value={form[name]}
                      onChange={(e) => setForm((p) => ({ ...p, [name]: e.target.value }))}
                      className={inputCls()}
                    />
                  </div>
                ))}

                {formError && (
                  <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 ring-1 ring-inset ring-rose-200">
                    {formError}
                  </p>
                )}

                <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-4">
                  <GhostBtn type="button" onClick={() => setShowModal(false)}>Cancel</GhostBtn>
                  <PrimaryBtn type="submit" disabled={saving}>
                    {saving ? "Saving…" : editProduct ? "Update" : "Add Product"}
                  </PrimaryBtn>
                </div>
              </form>
            </ModalShell>
          </Backdrop>
        )}
      </AnimatePresence>
    </div>
  );
}