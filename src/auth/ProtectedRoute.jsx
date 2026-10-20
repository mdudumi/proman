import { Navigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "./AuthProvider";

export default function ProtectedRoute({ children }) {
  const { session, profileStatus, loading } = useAuth();

  // Still resolving auth → WAIT
  if (loading) {
    return <div style={{ padding: 24 }}>Checking session…</div>;
  }

  // Not logged in
  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // Logged in but profile still loading → WAIT
  if (profileStatus === "loading") {
    return <div style={{ padding: 24 }}>Loading profile…</div>;
  }

  // No proman_users row, or deactivated
  if (profileStatus === "inactive") {
    return (
      <AccessMessage
        title="Llogaria nuk është aktive"
        text="Kjo llogari nuk ka akses në PROMAN. Kontaktoni administratorin."
      />
    );
  }

  // The profile request failed, e.g. no connection
  if (profileStatus === "error") {
    return (
      <AccessMessage
        title="Profili nuk u ngarkua"
        text="Kontrolloni lidhjen me internetin dhe provoni përsëri."
        onRetry={() => window.location.reload()}
      />
    );
  }

  // Fully authorized
  return children;
}

function AccessMessage({ title, text, onRetry }) {
  return (
    <div style={styles.wrap}>
      <h2 style={styles.title}>{title}</h2>
      <p style={styles.text}>{text}</p>

      <div style={styles.actions}>
        {onRetry && (
          <button type="button" style={styles.button} onClick={onRetry}>
            Provo përsëri
          </button>
        )}
        <button type="button" style={styles.button} onClick={() => supabase.auth.signOut()}>
          Dil nga llogaria
        </button>
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    maxWidth: 420,
    margin: "80px auto",
    padding: 24,
    borderRadius: 16,
    background: "var(--panel)",
    border: "1px solid var(--border)",
    textAlign: "center"
  },

  title: {
    margin: "0 0 8px",
    fontSize: 20
  },

  text: {
    margin: "0 0 20px",
    color: "var(--muted)"
  },

  actions: {
    display: "flex",
    gap: 10,
    justifyContent: "center"
  },

  button: {
    height: 38,
    padding: "0 14px",
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "rgba(255,255,255,.08)",
    color: "var(--text)",
    fontWeight: 750,
    cursor: "pointer"
  }
};
