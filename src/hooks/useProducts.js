import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "../context/AuthContext";

const API       = import.meta.env.VITE_API_URL || "http://localhost:5000";
const CACHE_KEY = "products_cache";
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function useProducts() {
  const { token } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading]   = useState(true);

  const invalidateCache = () => {
    try { sessionStorage.removeItem(CACHE_KEY); } catch (_) {}
  };

  const fetch_ = async ({ skipCache = false } = {}) => {
    if (!skipCache) {
      try {
        const raw = sessionStorage.getItem(CACHE_KEY);
        if (raw) {
          const { ts, data } = JSON.parse(raw);
          if (Date.now() - ts < CACHE_TTL) {
            setProducts(data);
            setLoading(false);
            return;
          }
        }
      } catch (_) {}
    }

    setLoading(true);
    try {
      const res  = await fetch(`${API}/api/products`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        const list = data.products || [];
        setProducts(list);
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: list }));
        } catch (_) {}
      }
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { if (token) fetch_(); }, [token]);

  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category))].sort(),
    [products]
  );

  const subCategories = useCallback(
    (category) =>
      [...new Set(products.filter((p) => p.category === category).map((p) => p.sub_category))].sort(),
    [products]
  );

  const productNames = useCallback(
    (category, subCategory) =>
      products
        .filter((p) => p.category === category && p.sub_category === subCategory)
        .map((p) => p.product_name)
        .sort(),
    [products]
  );

  return {
    products,
    setProducts,
    loading,
    refetch:         fetch_,
    invalidateCache,
    categories,
    subCategories,
    productNames,
  };
}