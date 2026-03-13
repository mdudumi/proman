import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "./lib/supabaseClient";
import AppLayout from "./layout/AppLayout.jsx";
import ProtectedRoute from "./auth/ProtectedRoute.jsx";
import KategoriaAdmin from "./pages/KategoriaAdmin.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import DitorReport from "./components/DitorReport";

function GlobalLogoutBar() {
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
    <div
      style={{
        width: "100%",
        display: "flex",
        justifyContent: "flex-end",
        padding: "10px 16px 0 16px",
        boxSizing: "border-box",
        background: "transparent"
      }}
    >
      <button
        onClick={handleLogout}
        style={{
          padding: "10px 16px",
          borderRadius: "10px",
          border: "1px solid rgba(255,255,255,0.12)",
          background: "#111827",
          color: "#fff",
          fontWeight: 600,
          cursor: "pointer"
        }}
      >
        Logout
      </button>
    </div>
  );
}

export default function App() {
  return (
    <>
      <GlobalLogoutBar />

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
