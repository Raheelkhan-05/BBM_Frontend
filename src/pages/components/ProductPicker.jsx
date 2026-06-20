export default function ProductPicker({
  category,
  subCategory,
  productName,
  onChange,
  useProductsHook,
}) {
  const { categories, subCategories, productNames } = useProductsHook;

  const filteredSubs = category ? subCategories(category) : [];
  const filteredProducts =
    category && subCategory
      ? productNames(category, subCategory)
      : [];

  function handleCategory(e) {
    onChange("product_category", e.target.value);
    onChange("product_sub_category", "");
    onChange("product_name", "");
  }

  function handleSub(e) {
    onChange("product_sub_category", e.target.value);
    onChange("product_name", "");
  }

  function handleProduct(e) {
    onChange("product_name", e.target.value);
  }

  const sel = (
    value,
    handler,
    options,
    placeholder,
    disabled
  ) => (
    <select
      value={value}
      onChange={handler}
      disabled={disabled}
      required
      style={{
        width: "100%",
        padding: "7px 10px",
        border: "1px solid #cbd5e1",
        borderRadius: 6,
        fontSize: 13,
        boxSizing: "border-box",
        background: disabled ? "#f8fafc" : "#fff",
      }}
    >
      <option value="">{placeholder}</option>

      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );

  return (
    <div style={{ gridColumn: "1 / -1" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 10,
        }}
      >
        <div>
          <label style={lbl}>
            Product Category <span style={star}>*</span>
          </label>
          {sel(
            category,
            handleCategory,
            categories,
            "— Select Category —",
            false
          )}
        </div>

        <div>
          <label style={lbl}>
            Sub Category <span style={star}>*</span>
          </label>
          {sel(
            subCategory,
            handleSub,
            filteredSubs,
            category
              ? "— Select Sub Category —"
              : "— Select Category First —",
            !category
          )}
        </div>

        <div>
          <label style={lbl}>
            Product Name <span style={star}>*</span>
          </label>
          {sel(
            productName,
            handleProduct,
            filteredProducts,
            subCategory
              ? "— Select Product —"
              : "— Select Sub Category First —",
            !subCategory
          )}
        </div>
      </div>
    </div>
  );
}

const lbl = {
  display: "block",
  fontSize: 12,
  color: "#475569",
  marginBottom: 4,
  fontWeight: 500,
};

const star = {
  color: "#dc2626",
  fontWeight: 600,
};