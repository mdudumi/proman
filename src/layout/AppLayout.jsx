import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { Spinner } from "../components/Loading";
import "./AppLayout.css";

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const go = (path) => navigate(path);
  const isActive = (path) => location.pathname === path;

  const [openAddModal, setOpenAddModal] = useState(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const outletContext = useMemo(() => ({ setOpenAddModal }), []);

  const showAddButton = isActive("/dashboard");

  async function handleLogout() {
    setLoggingOut(true);
    const { error } = await supabase.auth.signOut();
    setLoggingOut(false);
    if (error) {
      console.error("Logout error:", error);
      return;
    }
    navigate("/login", { replace: true });
  }

  return (
    <div className="app-shell">
      <header className="app-bar">
        <div className="app-brand" onClick={() => go("/dashboard")}>
          PROMAN
        </div>

        <nav className="app-nav">
          <NavLink to="/dashboard" className="app-link">
            Forma Hyrëse
          </NavLink>

          <NavLink to="/admin/kategoria" className="app-link">
            Organizim
          </NavLink>

          <NavLink to="/ditor-report" className="app-link">
            Hap Raportin
          </NavLink>
        </nav>

        <div className="app-actions">
          {showAddButton && (
            <button
              type="button"
              className="app-btn app-btn--primary"
              onClick={() => openAddModal?.()}
              disabled={!openAddModal}
            >
              Shto të dhënë
            </button>
          )}

          <button type="button" className="app-btn" onClick={handleLogout} disabled={loggingOut}>
            {loggingOut && <Spinner />}
            Logout
          </button>
        </div>
      </header>

      <main className="app-content">
        <Outlet context={outletContext} />
      </main>
    </div>
  );
}
