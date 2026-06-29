import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function PublicRoute({ children }) {
  const { user } = useAuth();

  // or check token if that's what you store
  if (user) {
    return <Navigate to="/prospects" replace />;
  }

  return children;
}