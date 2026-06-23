// Frontend/AuthContext.jsx
//
// Optimisation strategy: "trust then verify"
//
//  BEFORE: Page load → wait 500-800ms for /api/me → then render app
//  AFTER:  Page load → read localStorage instantly → render app immediately
//                    → verify token in background (silent, no spinner)
//                    → only redirect if token is actually invalid
//
// This makes the app feel instant on every revisit.
// The background verify catches expired tokens without blocking the UI.

// Week-long session: JWT expiry set to 604800s (7 days) in Supabase dashboard.
// No refresh token logic needed — the access token itself lasts a week.
//
// Strategy: "trust then verify"
//  - Seed from localStorage synchronously → app renders immediately, no spinner
//  - Verify in background → log out silently if token is expired/invalid
//  - Periodic re-verify every 30 min for long-lived sessions

import { createContext, useContext, useState, useEffect, useRef } from "react";

const AuthContext = createContext();
const API = import.meta.env.VITE_API_URL || "http://localhost:5000";
const VERIFY_INTERVAL_MS = 30 * 60 * 1000; // re-verify every 30 min

// ── JWT expiry check (no library needed) ──────────────────────────────────
function isTokenExpired(token) {
  try {
    const { exp } = JSON.parse(atob(token.split(".")[1]));
    return Date.now() >= exp * 1000;
  } catch {
    return true;
  }
}

export const AuthProvider = ({ children }) => {
  // Seed synchronously from localStorage — zero async wait on revisit
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("user") || "null"); }
    catch { return null; }
  });
  const [token, setToken] = useState(() => localStorage.getItem("token") || null);

  // Show spinner only if there's a token but no cached user
  // (e.g. storage was partially cleared). Normal revisits skip loading entirely.
  const [loading, setLoading] = useState(() => {
    const t = localStorage.getItem("token");
    const u = localStorage.getItem("user");
    return !!t && !u;
  });

  const verifyIntervalRef = useRef(null);

  const clearAuthState = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setToken(null);
    if (verifyIntervalRef.current) clearInterval(verifyIntervalRef.current);
  };

  // Background verify — never blocks rendering
  const verifyToken = async (t, { finallySetLoading = false } = {}) => {
    try {
      const res = await fetch(`${API}/api/me`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (!res.ok) { clearAuthState(); return; }
      const freshUser = await res.json();
      localStorage.setItem("user", JSON.stringify(freshUser));
      setUser(freshUser);
    } catch {
      // Network failure — keep cached state, don't log the user out
    } finally {
      if (finallySetLoading) setLoading(false);
    }
  };

  useEffect(() => {
    const t = localStorage.getItem("token");
    const u = localStorage.getItem("user");

    if (!t) { setLoading(false); return; }

    // Client-side expiry check — no network call needed
    if (isTokenExpired(t)) {
      clearAuthState();
      setLoading(false);
      return;
    }

    if (u) {
      // Happy path: valid token + cached user → render immediately, verify silently
      verifyToken(t);
    } else {
      // Token exists but user cache is missing → need the response before rendering
      verifyToken(t, { finallySetLoading: true });
    }

    // Periodic re-verify to catch role changes or server-side revocation
    verifyIntervalRef.current = setInterval(() => {
      const current = localStorage.getItem("token");
      if (current && !isTokenExpired(current)) verifyToken(current);
      else clearAuthState();
    }, VERIFY_INTERVAL_MS);

    return () => {
      if (verifyIntervalRef.current) clearInterval(verifyIntervalRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const login = (userData, accessToken) => {
    localStorage.setItem("user", JSON.stringify(userData));
    localStorage.setItem("token", accessToken);
    setUser(userData);
    setToken(accessToken);
  };

  const logout  = () => clearAuthState();
  const role    = user?.role || null;
  const hasRole = (allowedRoles = []) => !!role && allowedRoles.includes(role);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading, role, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);