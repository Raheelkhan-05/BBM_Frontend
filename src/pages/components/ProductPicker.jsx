// ProductPicker.jsx — full replacement
// Added: inline "Product not listed? Add new" flow, mirroring LocationPicker's createRoute pattern.
// All existing cascading-select logic is unchanged.

import { useState } from "react";
import CustomSelect from "./CustomSelect"; // adjust path as needed




export default function ProductPicker({
  category,
  subCategory,
  productName,
  onChange,
  useProductsHook,
  errors = {},
}) {
  const { categories, subCategories, productNames, createProduct, findProductParents } = useProductsHook;

  const [creatingProduct, setCreatingProduct] = useState(false);
  const [newCategory, setNewCategory]         = useState("");
  const [newSubCategory, setNewSubCategory]   = useState("");
  const [newProductName, setNewProductName]   = useState("");
  const [newBrochureUrl, setNewBrochureUrl]   = useState("");
  const [inputMode, setInputMode] = useState("direct");
  const [creating, setCreating]               = useState(false);
  const [createError, setCreateError]         = useState("");

  const filteredSubs     = category ? subCategories(category) : [];
  const filteredProducts = category && subCategory ? productNames(category, subCategory) : [];

  function handleCategory(val) {
    onChange("product_category",     val);
    onChange("product_sub_category", "");
    onChange("product_name",         "");
  }
  function handleSub(val) {
    onChange("product_sub_category", val);
    onChange("product_name",         "");
  }
  function handleProduct(val) {
    if (val && findProductParents) {
      const parents = findProductParents(val);
      if (parents) {
        onChange("product_category",     parents.category);
        onChange("product_sub_category", parents.subCategory);
      }
    }
    onChange("product_name", val);
  }

  async function handleCreateProduct() {
    if (!newCategory.trim() || !newSubCategory.trim() || !newProductName.trim()) {
      setCreateError("Category, Sub-Category and Product Name are required");
      return;
    }
    setCreating(true);
    setCreateError("");
    try {
      await createProduct(
        newCategory.trim(),
        newSubCategory.trim(),
        newProductName.trim(),
        newBrochureUrl.trim()
      );
      onChange("product_category",     newCategory.trim());
      onChange("product_sub_category", newSubCategory.trim());
      onChange("product_name",         newProductName.trim());
      setCreatingProduct(false);
      setNewCategory(""); setNewSubCategory(""); setNewProductName(""); setNewBrochureUrl("");
    } catch (e) {
      setCreateError(e.message);
    } finally {
      setCreating(false);
    }
  }

  const fieldLabel = (text, req) => (
    <label className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
      {text}
      {req && <span className="text-rose-500">*</span>}
    </label>
  );

return (
  <div style={{ gridColumn: "1 / -1" }}>

    {/* Mode toggle */}
    <div className="mb-3 flex items-center justify-between">
      <div className="inline-flex rounded-full bg-slate-100 p-0.5 text-[11px]">
        <button
          type="button"
          onClick={() => { setInputMode("direct"); }}
          className={`rounded-full px-3 py-1 font-semibold transition-all ${
            inputMode === "direct"
              ? "bg-white text-indigo-600 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Search by Name
        </button>
        <button
          type="button"
          onClick={() => { setInputMode("drilldown"); }}
          className={`rounded-full px-3 py-1 font-semibold transition-all ${
            inputMode === "drilldown"
              ? "bg-white text-indigo-600 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Browse by Category
        </button>
      </div>

      {/* Clear selection */}
      {(category || subCategory || productName) && (
        <button
          type="button"
          onClick={() => {
            onChange("product_category",     "");
            onChange("product_sub_category", "");
            onChange("product_name",         "");
          }}
          className="text-[11px] font-semibold text-rose-500 hover:text-rose-600 hover:underline"
        >
          Clear selection
        </button>
      )}
    </div>

    {/* ── DIRECT MODE — search by product name, auto-fills rest ── */}
    {inputMode === "direct" && (
      <div>
        {fieldLabel("Product Name", true)}
        <CustomSelect
          value={productName}
          onChange={handleProduct}
          options={
            categories.flatMap(cat =>
              subCategories(cat).flatMap(sub =>
                productNames(cat, sub).map(p => ({
                  value: p,
                  label: p,
                  description: `${cat} › ${sub}`,
                }))
              )
            )
          }
          placeholder="Search any product…"
          label="Product Name"
          searchable
          error={errors.product_name}
        />

        {/* Show what got auto-filled, as read-only confirmation */}
        
        {productName && category && (
          <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 divide-y divide-slate-100">
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Category</span>
              <span className="text-[12px] font-semibold text-slate-700">{category}</span>
            </div>
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Sub-Category</span>
              <span className="text-[12px] font-semibold text-slate-700">{subCategory}</span>
            </div>
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Product Name</span>
              <span className="text-[12px] font-semibold text-slate-700">{productName}</span>
            </div>
          </div>
        )}

        {productName && (
          <p className="mt-1.5 text-[10px] text-slate-400">
            Category and sub-category auto-filled. Switch to "Browse by Category" to change manually.
          </p>
        )}
      </div>
    )}

    {/* ── DRILLDOWN MODE — category → sub → product ── */}
    {inputMode === "drilldown" && (
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <div>
          {fieldLabel("Product Category", true)}
          <CustomSelect
            value={category}
            onChange={handleCategory}
            options={categories}
            placeholder="Select Category"
            label="Product Category"
            error={errors.product_category}
          />
        </div>
        <div>
          {fieldLabel("Sub Category", true)}
          <CustomSelect
            value={subCategory}
            onChange={handleSub}
            options={filteredSubs}
            placeholder={category ? "Select Sub Category" : "Select Category first"}
            label="Sub Category"
            disabled={!category}
            error={errors.product_sub_category}
          />
        </div>
        <div>
          {fieldLabel("Product Name", true)}
          <CustomSelect
            value={productName}
            onChange={handleProduct}
            options={filteredProducts}
            placeholder={subCategory ? "Select Product" : "Select Sub Category first"}
            label="Product Name"
            disabled={!subCategory}
            error={errors.product_name}
          />
        </div>
      </div>
    )}

    {/* Add new product */}
    {createProduct && (
      !creatingProduct ? (
        <button
          type="button"
          onClick={() => setCreatingProduct(true)}
          className="mt-2.5 text-[12px] font-semibold text-indigo-600 hover:text-indigo-700 hover:underline"
        >
          + Product not listed? Add new
        </button>
      ) : (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="mb-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">
            Add New Product
          </p>
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Category</p>
                <input
                  list="new-categories"
                  placeholder="Category"
                  value={newCategory}
                  onChange={(e) => { setNewCategory(e.target.value); setNewSubCategory(""); setNewProductName(""); }}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
                <datalist id="new-categories">
                  {categories.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Sub-Category</p>
                <input
                  list="new-subcategories"
                  placeholder="Sub-Category"
                  value={newSubCategory}
                  onChange={(e) => { setNewSubCategory(e.target.value); setNewProductName(""); }}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
                <datalist id="new-subcategories">
                  {(newCategory ? subCategories(newCategory) : []).map(s => <option key={s} value={s} />)}
                </datalist>
              </div>
            </div>
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Product Name</p>
              <input
                list="new-productnames"
                placeholder="Product Name"
                value={newProductName}
                onChange={(e) => setNewProductName(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
              <datalist id="new-productnames">
                {(newCategory && newSubCategory ? productNames(newCategory, newSubCategory) : []).map(p => <option key={p} value={p} />)}
              </datalist>
            </div>
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Brochure URL <span className="normal-case font-normal text-slate-300">(optional)</span>
              </p>
              <input
                type="url"
                placeholder="https://…"
                value={newBrochureUrl}
                onChange={(e) => setNewBrochureUrl(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          </div>
          {createError && <p className="mt-1.5 text-[11px] text-rose-500">{createError}</p>}
          <div className="mt-2.5 flex gap-2">
            <button
              type="button"
              onClick={handleCreateProduct}
              disabled={creating}
              className="rounded-lg bg-indigo-600 px-3.5 py-1.5 text-[12px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors"
            >
              {creating ? "Saving…" : "Save Product"}
            </button>
            <button
              type="button"
              onClick={() => { setCreatingProduct(false); setCreateError(""); }}
              className="rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-[12px] text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )
    )}
  </div>
);
}