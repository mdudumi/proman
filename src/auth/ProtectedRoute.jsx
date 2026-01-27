import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthProvider";

export default function ProtectedRoute({ children }) {
  const { session, profile, loading } = useAuth();

  // Still resolving auth or profile → WAIT
  if (loading) {
    return <div style={{ padding: 24 }}>Checking session…</div>;
  }

  // Not logged in
  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // Logged in but profile still loading or blocked → WAIT
  if (!profile) {
    return <div style={{ padding: 24 }}>Loading profile…</div>;
  }

  // Fully authorized
  return children;
}
