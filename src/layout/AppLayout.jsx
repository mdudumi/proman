import { Outlet, useNavigate } from "react-router-dom";

export default function MainLayout() {
  const navigate = useNavigate();

  return (
    <div style={styles.wrapper}>
      {/* Sidebar */}
      <aside style={styles.sidebar}>
        <div style={styles.logo}>PROMAN</div>

        <button style={styles.navBtn} onClick={() => navigate("/dashboard")}>
          📊 Forma Hyrëse
        </button>

        <button
          style={styles.navBtn}
          onClick={() => navigate("/admin/kategoria")}
        >
          🗂️ Organizim
        </button>
      </aside>

      {/* Main content */}
      <main style={styles.content}>
        <Outlet />
      </main>
    </div>
  );
}

const styles = {
  wrapper: {
    display: "grid",
    gridTemplateColumns: "220px 1fr",
    minHeight: "100vh",
  },
  sidebar: {
    background: "#0b0f1e",
    borderRight: "1px solid var(--border)",
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  logo: {
    fontWeight: 900,
    fontSize: 20,
    marginBottom: 20,
    color: "var(--accent)",
  },
  navBtn: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "none",
    background: "transparent",
    color: "var(--text)",
    textAlign: "left",
    cursor: "pointer",
    fontWeight: 600,
  },
  content: {
    padding: 24,
  },
};

