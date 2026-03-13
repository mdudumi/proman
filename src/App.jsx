import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "./lib/supabaseClient";
import AppLayout from "./layout/AppLayout.jsx";
import ProtectedRoute from "./auth/ProtectedRoute.jsx";
import KategoriaAdmin from "./pages/KategoriaAdmin.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import DitorReport from "./components/DitorReport";

function GlobalLogoutButton() {
  const navigate = useNavigate();
  const location = useLocation();

  if (location.pathname === "/login") return null;

  async function handleLogout() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Logout error:", error);
      return;
    }

    navigate("/login", { replace: true });
  }

  return (
    <button
      onClick={handleLogout}
      style={{
        position: "fixed",
        top: "14px",
        right: "16px",
        zIndex: 9999,
        padding: "10px 16px",
        borderRadius: "10px",
        border: "none",
        background: "#0f172a",
        color: "#fff",
        fontWeight: 600,
        cursor: "pointer",
        boxShadow: "0 8px 20px rgba(0,0,0,0.18)"
      }}
    >
      Logout
    </button>
  );
}

export default function App() {
  return (
    <>
      <GlobalLogoutButton />

      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/admin/kategoria" element={<KategoriaAdmin />} />
          <Route path="/ditor-report" element={<DitorReport />} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </>
  );
}
