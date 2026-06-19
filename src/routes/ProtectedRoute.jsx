import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function FullPageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" />
        <p className="text-sm font-medium text-slate-500">
          Loading...
        </p>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { token, loading } = useAuth();

  if (loading) {
    return <FullPageLoader />;
  }

  if (!token) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default ProtectedRoute;