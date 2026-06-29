import CustomSelect from "./CustomSelect"; // adjust path as needed

export default function ProductPicker({
  category,
  subCategory,
  productName,
  onChange,
  useProductsHook,
  errors = {},
}) {
  const { categories, subCategories, productNames } = useProductsHook;

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
    </div>
  );
}