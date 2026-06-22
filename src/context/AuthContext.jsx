//AuthContext.jsx

import { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

useEffect(() => {
  const initializeAuth = async () => {
    const storedToken = localStorage.getItem("token");

    if (!storedToken) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/me`,
        {
          headers: {
            Authorization: `Bearer ${storedToken}`,
          },
        }
      );

      if (!res.ok) {
        throw new Error("Token expired");
      }

      const user = await res.json();

      // Backend says token is valid
      localStorage.setItem("user", JSON.stringify(user));

      setUser(user);
      setToken(storedToken);
    } catch (err) {
      console.log("Auth check failed:", err.message);

      // Backend says token is invalid
      localStorage.removeItem("user");
      localStorage.removeItem("token");

      setUser(null);
      setToken(null);
    } finally {
      setLoading(false);
    }
  };

  initializeAuth();
}, []);

  const login = (userData, accessToken) => {
    localStorage.setItem("user", JSON.stringify(userData));
    localStorage.setItem("token", accessToken);

    setUser(userData);
    setToken(accessToken);
  };

  const logout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");

    setUser(null);
    setToken(null);
  };

  const role = user?.role || null;

  const hasRole = (allowedRoles = []) => {
    if (!role) return false;
    return allowedRoles.includes(role);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        loading,
        role,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);