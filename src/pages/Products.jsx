//Products.jsx
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { useProducts } from "../hooks/useProducts";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";
const emptyForm = { category: "", sub_category: "", product_name: "" };

function Label({ children }) {
  return <label className="mb-1.5 block text-xs font-medium text-slate-600">{children}</label>;
}
function inputCls(extra = "") {
  return `w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-150 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 ${extra}`;
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
function IconBtn({ children, tone = "slate", ...props }) {
  const tones = {
    slate: "text-slate-400 hover:bg-slate-100 hover:text-slate-700",
    indigo: "text-slate-400 hover:bg-indigo-50 hover:text-indigo-600",
    rose: "text-slate-400 hover:bg-rose-50 hover:text-rose-600",
  };
  return (
    <button {...props} className={`grid h-8 w-8 place-items-center rounded-md transition-colors duration-150 ${tones[tone]}`}>
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
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-16 text-center">
      <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-white shadow-sm ring-1 ring-slate-100">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-400"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
      </div>
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}
    </div>
  );
}

export default function Products() {
  const { user, token } = useAuth();
  const canManage = ["Admin", "SalesCoordinator"].includes(user?.role);
  const { products, loading, refetch, categories, subCategories } = useProducts();

  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [subFilter, setSubFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const filteredSubs = catFilter ? subCategories(catFilter) : [];
  const filtered = products.filter((p) => {
    const q = search.toLowerCase();
    return (
      (!q || p.product_name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || p.sub_category.toLowerCase().includes(q)) &&
      (!catFilter || p.category === catFilter) &&
      (!subFilter || p.sub_category === subFilter)
    );
  });

  const grouped = filtered.reduce((acc, p) => {
    const key = `${p.category}__${p.sub_category}`;
    if (!acc[key]) acc[key] = { category: p.category, sub_category: p.sub_category, items: [] };
    acc[key].items.push(p);
    return acc;
  }, {});

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
      const url = editProduct ? `${API}/api/products/${editProduct.id}` : `${API}/api/products`;
      const res = await fetch(url, { method: editProduct ? "PUT" : "POST", headers, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setShowModal(false); refetch();
    } catch (e) { setFormError(e.message); }
    finally { setSaving(false); }
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this product?")) return;
    try {
      const res = await fetch(`${API}/api/products/${id}`, { method: "DELETE", headers });
      if (!res.ok) throw new Error("Delete failed");
      refetch();
    } catch (e) { alert(e.message); }
  }

  const hasActiveFilters = search || catFilter || subFilter;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-[1100px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-[26px]">Products</h1>
            <p className="mt-1 text-sm text-slate-500">
              <span className="font-medium text-slate-700">{filtered.length}</span> product{filtered.length !== 1 ? "s" : ""} in catalog
            </p>
          </div>
          {canManage && (
            <PrimaryBtn onClick={openAdd}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
              Add Product
            </PrimaryBtn>
          )}
        </div>

        {/* Filters */}
<div
  className="mb-6 grid gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm
             grid-cols-1
             lg:grid-cols-[minmax(320px,1fr)_180px_200px_auto]"
>
  {/* Search */}
  <div className="relative">
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
    >
      <path d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
    </svg>

    <input
      placeholder="Search products…"
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      className={inputCls("pl-9")}
    />
  </div>

  {/* Category */}
  <select
    value={catFilter}
    onChange={(e) => {
      setCatFilter(e.target.value);
      setSubFilter("");
    }}
    className={inputCls()}
  >
    <option value="">All Categories</option>
    {categories.map((c) => (
      <option key={c}>{c}</option>
    ))}
  </select>

  {/* Sub Category */}
  <select
    value={subFilter}
    onChange={(e) => setSubFilter(e.target.value)}
    disabled={!catFilter}
    className={inputCls(
      "disabled:cursor-not-allowed disabled:opacity-50"
    )}
  >
    <option value="">All Sub-Categories</option>
    {filteredSubs.map((s) => (
      <option key={s}>{s}</option>
    ))}
  </select>

  {/* Clear */}
  {hasActiveFilters && (
    <button
      onClick={() => {
        setSearch("");
        setCatFilter("");
        setSubFilter("");
      }}
      className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100"
    >
      Clear
    </button>
  )}
</div>

        {loading && (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl border border-slate-100 bg-white" />
            ))}
          </div>
        )}

        {!loading && (
          <motion.div layout className="space-y-5">
            <AnimatePresence>
              {Object.values(grouped).map((group) => (
                <motion.div
                  key={`${group.category}__${group.sub_category}`}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="mb-2.5 flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700 ring-1 ring-inset ring-sky-600/15">{group.category}</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-slate-300"><path d="M9 18l6-6-6-6" /></svg>
                    <span className="inline-flex items-center rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700 ring-1 ring-inset ring-violet-600/15">{group.sub_category}</span>
                    <span className="ml-auto text-xs text-slate-400">{group.items.length} item{group.items.length !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                    {group.items.map((p, i) => (
                      <div key={p.id} className={`flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-slate-50/80 ${i > 0 ? "border-t border-slate-100" : ""}`}>
                        <span className="text-sm text-slate-700">{p.product_name}</span>
                        {canManage && (
                          <div className="flex flex-shrink-0 gap-0.5">
                            <IconBtn tone="indigo" onClick={() => openEdit(p)}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.12 2.12 0 113 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                            </IconBtn>
                            <IconBtn tone="rose" onClick={() => handleDelete(p.id)}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0l-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6h16z" /></svg>
                            </IconBtn>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}

        {!loading && filtered.length === 0 && (
          <EmptyState title="No products found" subtitle={hasActiveFilters ? "Try adjusting your filters" : "Add your first product to get started"} />
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <Backdrop onClick={() => setShowModal(false)}>
            <ModalShell>
              <div className="mb-5 flex items-center justify-between">
                <h3 className="text-lg font-semibold tracking-tight text-slate-900">{editProduct ? "Edit Product" : "Add Product"}</h3>
                <button onClick={() => setShowModal(false)} className="grid h-8 w-8 place-items-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                </button>
              </div>
              <form onSubmit={handleSubmit}>
                {[["Category *", "category"], ["Sub-Category *", "sub_category"], ["Product Name *", "product_name"]].map(([label, name]) => (
                  <div key={name} className="mb-3.5">
                    <Label>{label}</Label>
                    <input name={name} value={form[name]} onChange={(e) => setForm((p) => ({ ...p, [name]: e.target.value }))} className={inputCls()} />
                  </div>
                ))}
                {formError && <p className="mb-3 text-sm text-rose-600">{formError}</p>}
                <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-4">
                  <GhostBtn type="button" onClick={() => setShowModal(false)}>Cancel</GhostBtn>
                  <PrimaryBtn type="submit" disabled={saving}>{saving ? "Saving…" : editProduct ? "Update" : "Add"}</PrimaryBtn>
                </div>
              </form>
            </ModalShell>
          </Backdrop>
        )}
      </AnimatePresence>
    </div>
  );
}