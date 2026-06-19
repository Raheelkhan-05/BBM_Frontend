import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

export function useRoutes() {
  const { token } = useAuth();
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch_ = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/routes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setRoutes(data.routes || []);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { fetch_(); }, [token]);

  const cities = [...new Set(routes.map((r) => r.city))].sort();
  const zones = (city) => [...new Set(routes.filter((r) => r.city === city).map((r) => r.zone))].sort();
  const routeNames = (city, zone) => routes.filter((r) => r.city === city && r.zone === zone).map((r) => r.route).sort();

  const createRoute = async (city, zone, route) => {
    const res = await fetch(`${API}/api/routes`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ city, zone, route }),
    });
    const data = await res.json();
    if (res.ok || res.status === 200) { await fetch_(); return data.route; }
    throw new Error(data.message);
  };

  return { routes, loading, refetch: fetch_, cities, zones, routeNames, createRoute };
} 