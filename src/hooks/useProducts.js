import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

export function useProducts() {
  const { token } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch_ = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/products`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setProducts(data.products || []);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { fetch_(); }, [token]);

  // Derived hierarchy
  const categories = [...new Set(products.map((p) => p.category))].sort();

  const subCategories = (category) =>
    [...new Set(products.filter((p) => p.category === category).map((p) => p.sub_category))].sort();

  const productNames = (category, subCategory) =>
    products.filter((p) => p.category === category && p.sub_category === subCategory)
      .map((p) => p.product_name).sort();

  return { products, loading, refetch: fetch_, categories, subCategories, productNames };
}