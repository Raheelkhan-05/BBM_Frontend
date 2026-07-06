// useProducts.js — added createProduct (mirrors useRoutes.createRoute)

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

  const findProductParents = useCallback(
    (productName) => {
      for (const cat of categories) {
        const subs = subCategories(cat);
        for (const sub of subs) {
          const names = productNames(cat, sub);
          if (names.includes(productName)) {
            return { category: cat, subCategory: sub };
          }
        }
      }
      return null;
    },
    [categories, subCategories, productNames]
  );

  // ── createProduct — optimistic update, no refetch (mirrors useRoutes.createRoute) ──
  const createProduct = async (category, subCategory, productName, brochureUrl) => {
    const res  = await fetch(`${API}/api/products`, {
      method:  "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body:    JSON.stringify({
        category:     category,
        sub_category: subCategory,
        product_name: productName,
        brochure_url: brochureUrl || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);

    const newProduct = data.product;

    // Update local state immediately — no refetch needed
    setProducts(prev => {
      const already = prev.some(p => p.id === newProduct.id);
      const updated = already ? prev : [...prev, newProduct];
      // Keep cache in sync
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: updated }));
      } catch (_) {}
      return updated;
    });

    return newProduct;
  };

  return {
    products,
    setProducts,
    loading,
    refetch:         fetch_,
    invalidateCache,
    categories,
    subCategories,
    productNames,
    createProduct,   // ← new export
    findProductParents,
  };
}