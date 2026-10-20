import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const go = (path) => navigate(path);
  const isActive = (path) => location.pathname === path;

  const [openAddModal, setOpenAddModal] = useState(null);

  const outletContext = useMemo(() => ({ setOpenAddModal }), []);

  const showAddButton = isActive("/dashboard");

  return (
    <div style={styles.shell}>
      <header style={styles.topbar}>
        <div style={styles.brand} onClick={() => go("/dashboard")}>
          PROMAN
        </div>

        <nav style={styles.nav}>
          <NavLink to="/dashboard" style={navLinkStyle}>
            Forma Hyrëse
          </NavLink>

          <NavLink to="/admin/kategoria" style={navLinkStyle}>
            Organizim
          </NavLink>

          <NavLink to="/ditor-report" style={navLinkStyle}>
            Hap Raportin
          </NavLink>

          {showAddButton && (
            <button
              type="button"
              style={{
                ...styles.navBtnPrimary,
                opacity: openAddModal ? 1 : 0.55,
                cursor: openAddModal ? "pointer" : "not-allowed"
              }}
              onClick={() => openAddModal?.()}
              disabled={!openAddModal}
            >
              Shto të dhënë
            </button>
          )}
        </nav>
      </header>

      <main style={styles.content}>
        <Outlet context={outletContext} />
      </main>
    </div>
  );
}

const navLinkStyle = ({ isActive }) => ({
  ...styles.navBtn,
  ...(isActive ? styles.navBtnActive : {})
});

const styles = {
  shell: {
    minHeight: "100vh",
    background: "var(--bg)"
  },

  topbar: {
    position: "sticky",
    top: 0,
    zIndex: 50,
    height: 64,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 18px",
    borderBottom: "1px solid var(--border)",
    background: "rgba(11,18,32,.88)",
    backdropFilter: "blur(12px)"
  },

  brand: {
    fontWeight: 900,
    letterSpacing: "0.08em",
    fontSize: 18,
    cursor: "pointer",
    userSelect: "none",
    color: "var(--text)"
  },

  nav: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap"
  },

  navBtn: {
    display: "inline-flex",
    alignItems: "center",
    boxSizing: "border-box",
    height: 36,
    padding: "0 12px",
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "rgba(255,255,255,.06)",
    color: "var(--text)",
    cursor: "pointer",
    fontSize: 13.33,
    fontWeight: 750,
    textDecoration: "none"
  },

  navBtnActive: {
    background: "rgba(79,124,255,.22)",
    borderColor: "rgba(79,124,255,.55)"
  },

  navBtnPrimary: {
    height: 36,
    padding: "0 12px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,.26)",
    background: "rgba(255,255,255,.12)",
    color: "var(--text)",
    cursor: "pointer",
    fontWeight: 900
  },

  content: {
    padding: 0,
    minHeight: "calc(100vh - 64px)"
  }
};