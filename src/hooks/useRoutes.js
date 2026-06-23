import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";

const API       = import.meta.env.VITE_API_URL || "http://localhost:5000";
const CACHE_KEY = "routes_cache";
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export function useRoutes() {
  const { token } = useAuth();
  const [routes, setRoutes]   = useState([]);
  const [loading, setLoading] = useState(true);

  const invalidateCache = () => {
    try { sessionStorage.removeItem(CACHE_KEY); } catch (_) {}
  };

  const fetch_ = async ({ skipCache = false } = {}) => {
    // ── Try cache first ──────────────────────────────────────
    if (!skipCache) {
      try {
        const raw = sessionStorage.getItem(CACHE_KEY);
        if (raw) {
          const { ts, data } = JSON.parse(raw);
          if (Date.now() - ts < CACHE_TTL) {
            setRoutes(data);
            setLoading(false);
            return;
          }
        }
      } catch (_) {}
    }

    // ── Fetch from network ───────────────────────────────────
    setLoading(true);
    try {
      const res  = await fetch(`${API}/api/routes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (res.ok) {
        const data = json.routes || [];
        setRoutes(data);
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
        } catch (_) {}
      }
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { if (token) fetch_(); }, [token]);

  // ── Derived helpers (unchanged) ──────────────────────────
  const countries = [...new Set(routes.map(r => r.country))].sort();

  const states = (country) =>
    [...new Set(routes.filter(r => r.country === country).map(r => r.state))].sort();

  const cities = (country, state) =>
    [...new Set(routes.filter(r => r.country === country && r.state === state).map(r => r.city))].sort();

  const zones = (country, state, city) =>
    [...new Set(routes.filter(r => r.country === country && r.state === state && r.city === city).map(r => r.zone))].sort();

  const routeNames = (country, state, city, zone) =>
    routes.filter(r => r.country === country && r.state === state && r.city === city && r.zone === zone).map(r => r.route).sort();

  // ── createRoute — optimistic update, no refetch ──────────
  const createRoute = async (country, state, city, zone, route) => {
    const res  = await fetch(`${API}/api/routes`, {
      method:  "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body:    JSON.stringify({ country, state, city, zone, route }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);

    const newRoute = data.route;

    // Update local state immediately — no refetch needed
    setRoutes(prev => {
      const already = prev.some(r => r.id === newRoute.id);
      const updated = already ? prev : [...prev, newRoute];
      // Keep cache in sync
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: updated }));
      } catch (_) {}
      return updated;
    });

    return newRoute;
  };

  return {
    routes,
    loading,
    refetch:         fetch_,
    invalidateCache,            // ← new export
    setRoutes,
    countries,
    states,
    cities,
    zones,
    routeNames,
    createRoute,
  };
}