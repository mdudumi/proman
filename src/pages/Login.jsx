import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

const { data, error } = await supabase.auth.signInWithPassword({
  email,
  password,
});

console.log("AUTH RESULT:", data, error);

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    navigate("/dashboard", { replace: true });
  }

  return (
    <div style={styles.page}>
      <form onSubmit={handleSubmit} style={styles.card}>
        {/* Branding */}
        <div style={styles.brand}>
          <div style={styles.logo}>P</div>
          <div>
            <div style={styles.title}>PROMAN</div>
            <div style={styles.subtitle}>Production Management System</div>
          </div>
        </div>

        {/* Email */}
        <div style={styles.field}>
          <label>Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@company.com"
            style={styles.input}
          />
        </div>

        {/* Password */}
        <div style={styles.field}>
          <label>Password</label>

          <div style={styles.passwordWrapper}>
            <input
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{ ...styles.input, paddingRight: 56 }}
            />

            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              style={styles.toggle}
              aria-label="Toggle password visibility"
            >
              {showPassword ? "HIDE" : "SHOW"}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && <div style={styles.error}>{error}</div>}

        {/* Submit */}
        <button type="submit" disabled={loading} style={styles.button}>
          {loading ? "Signing in…" : "Sign in"}
        </button>

        {/* Footer */}
        <div style={styles.footer}>Authorized users only</div>
      </form>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: 24,
  },
  card: {
    width: 380,
    padding: 24,
    borderRadius: 16,
    background: "var(--panel)",
    border: "1px solid var(--border)",
    boxShadow: "0 20px 40px rgba(0,0,0,0.35)",
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 22,
  },
  logo: {
    width: 42,
    height: 42,
    borderRadius: 12,
    background: "rgba(79,124,255,0.18)",
    color: "var(--accent)",
    fontWeight: 800,
    fontSize: 20,
    display: "grid",
    placeItems: "center",
    border: "1px solid rgba(79,124,255,0.35)",
  },
  title: {
    fontSize: 22,
    fontWeight: 800,
    letterSpacing: 0.4,
  },
  subtitle: {
    fontSize: 13,
    color: "var(--muted)",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    marginBottom: 12,
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "#0f1325",
    color: "var(--text)",
    outline: "none",
    fontSize: 14,
  },
  passwordWrapper: {
    position: "relative",
    display: "flex",
    alignItems: "center",
  },
  toggle: {
    position: "absolute",
    right: 10,
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.5,
    color: "var(--accent)",
  },
  error: {
    marginTop: 6,
    marginBottom: 10,
    color: "var(--danger)",
    fontSize: 13,
  },
  button: {
    marginTop: 10,
    width: "100%",
    padding: "12px 14px",
    borderRadius: 12,
    border: "none",
    background: "linear-gradient(180deg, #5b84ff, #4f7cff)",
    color: "#fff",
    fontWeight: 800,
    letterSpacing: 0.4,
    cursor: "pointer",
  },
  footer: {
    marginTop: 18,
    fontSize: 12,
    color: "var(--muted)",
    textAlign: "center",
  },
};
