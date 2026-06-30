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
  const { categories, subCategories, productNames, createProduct } = useProductsHook;

  const [creatingProduct, setCreatingProduct] = useState(false);
  const [newCategory, setNewCategory]         = useState("");
  const [newSubCategory, setNewSubCategory]   = useState("");
  const [newProductName, setNewProductName]   = useState("");
  const [newBrochureUrl, setNewBrochureUrl]   = useState("");
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
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>

        {/* Category */}
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

        {/* Sub Category */}
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

        {/* Product Name */}
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
                <input
                  placeholder="Category"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
                <input
                  placeholder="Sub-Category"
                  value={newSubCategory}
                  onChange={(e) => setNewSubCategory(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
              <input
                placeholder="Product Name"
                value={newProductName}
                onChange={(e) => setNewProductName(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
              <input
                type="url"
                placeholder="Brochure URL (optional)"
                value={newBrochureUrl}
                onChange={(e) => setNewBrochureUrl(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
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