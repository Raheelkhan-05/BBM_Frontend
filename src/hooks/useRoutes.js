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

  useEffect(() => {
  console.log(routes);
}, [routes]);

  const countries = [...new Set(routes.map(r => r.country))].sort();

  const states = (country) =>
    [...new Set(
      routes
        .filter(r => r.country === country)
        .map(r => r.state)
    )].sort();

  const cities = (country, state) =>
    [...new Set(
      routes
        .filter(r => r.country === country && r.state === state)
        .map(r => r.city)
    )].sort();

  const zones = (country, state, city) =>
    [...new Set(
      routes
        .filter(
          r =>
            r.country === country &&
            r.state === state &&
            r.city === city
        )
        .map(r => r.zone)
    )].sort();

  const routeNames = (country, state, city, zone) =>
    routes
      .filter(
        r =>
          r.country === country &&
          r.state === state &&
          r.city === city &&
          r.zone === zone
      )
      .map(r => r.route)
      .sort();

  const createRoute = async (country, state, city, zone, route) => {
    const res = await fetch(`${API}/api/routes`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ country, state, city, zone, route }),
    });
    const data = await res.json();
    if (res.ok || res.status === 200) { await fetch_(); return data.route; }
    throw new Error(data.message);
  };

  return {
    routes,
    loading,
    refetch: fetch_,
    countries,
    states,
    cities,
    zones,
    routeNames,
    createRoute,
  };
} 