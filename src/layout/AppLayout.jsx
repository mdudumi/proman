import { Outlet, useLocation, useNavigate } from "react-router-dom";
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
          <button
            type="button"
            style={{
              ...styles.navBtn,
              ...(isActive("/dashboard") ? styles.navBtnActive : {})
            }}
            onClick={() => go("/dashboard")}
          >
            Forma Hyrëse
          </button>

          <button
            type="button"
            style={{
              ...styles.navBtn,
              ...(isActive("/admin/kategoria") ? styles.navBtnActive : {})
            }}
            onClick={() => go("/admin/kategoria")}
          >
            Organizim
          </button>

          <button
            type="button"
            style={styles.navBtn}
            onClick={() => go("/ditor-report")}
          >
            Hap Raportin
          </button>

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
    height: 36,
    padding: "0 12px",
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "rgba(255,255,255,.06)",
    color: "var(--text)",
    cursor: "pointer",
    fontWeight: 750
  },

  navBtnActive: {
    background: "rgba(255,255,255,.10)",
    borderColor: "rgba(255,255,255,.26)"
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