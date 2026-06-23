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

import { createContext, useContext, useState, useEffect, useRef } from "react";

const AuthContext = createContext();
const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

// How often to re-verify in the background (30 min).
// Keeps long sessions safe without hammering the server.
const VERIFY_INTERVAL_MS = 30 * 60 * 1000;

export const AuthProvider = ({ children }) => {
  // Seed state directly from localStorage — zero async wait
  const [user,  setUser]  = useState(() => {
    try {
      const raw = localStorage.getItem("user");
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });
  const [token, setToken] = useState(() => localStorage.getItem("token") || null);

  // loading=true only when there's a token but NO cached user
  // (edge case: storage was partially cleared). Otherwise we're ready immediately.
  const [loading, setLoading] = useState(() => {
    const hasToken = !!localStorage.getItem("token");
    const hasUser  = !!localStorage.getItem("user");
    return hasToken && !hasUser; // need to fetch if token exists but user cache is missing
  });

  const verifyIntervalRef = useRef(null);

  // ── Background token verification ─────────────────────────────────────
  // Runs once on mount (and then every VERIFY_INTERVAL_MS).
  // Never blocks rendering — UI is already shown from the localStorage seed.
  const verifyToken = async (currentToken, silent = false) => {
    if (!currentToken) return;
    try {
      const res = await fetch(`${API}/api/me`, {
        headers: { Authorization: `Bearer ${currentToken}` },
      });

      if (!res.ok) {
        // Token is genuinely invalid/expired — clear everything
        clearAuth();
        return;
      }

      const freshUser = await res.json();

      // Refresh localStorage with the latest role/profile from server
      localStorage.setItem("user", JSON.stringify(freshUser));
      setUser(freshUser);
    } catch (err) {
      // Network failure — don't log out, just leave the cached state.
      // User is offline or server is down; we shouldn't punish them for that.
      console.warn("Background auth verify failed (network?):", err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const clearAuth = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    setUser(null);
    setToken(null);
    if (verifyIntervalRef.current) {
      clearInterval(verifyIntervalRef.current);
    }
  };

  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    if (!storedToken) {
      setLoading(false);
      return;
    }

    // If we had a cached user, loading is already false — verify silently.
    // If no cached user, loading=true and we need the response before rendering.
    const hasCache = !!localStorage.getItem("user");
    verifyToken(storedToken, /* silent= */ hasCache);

    // Periodic re-verification for long-lived sessions
    verifyIntervalRef.current = setInterval(
      () => verifyToken(storedToken, true),
      VERIFY_INTERVAL_MS
    );

    return () => {
      if (verifyIntervalRef.current) clearInterval(verifyIntervalRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const login = (userData, accessToken) => {
    localStorage.setItem("user", JSON.stringify(userData));
    localStorage.setItem("token", accessToken);
    setUser(userData);
    setToken(accessToken);

    // Start periodic verification after login
    if (verifyIntervalRef.current) clearInterval(verifyIntervalRef.current);
    verifyIntervalRef.current = setInterval(
      () => verifyToken(accessToken, true),
      VERIFY_INTERVAL_MS
    );
  };

  const logout = () => {
    clearAuth();
  };

  const role    = user?.role || null;
  const hasRole = (allowedRoles = []) => !!role && allowedRoles.includes(role);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading, role, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);