import { useNavigate } from "react-router-dom";
import DitorForm from "../components/DitorForm";
import DitorTable from "../components/DitorTable";

export default function Dashboard() {
  const navigate = useNavigate();

  return (
    <div style={{ padding: "24px" }}>
      <h1>Mirësevjen në PROMAN</h1>

      {/* ACTION BAR */}
      <div style={{ marginBottom: 24, display: "flex", gap: 12 }}>
        <button
          onClick={() => navigate("/ditor-report")}
          style={{
            padding: "10px 16px",
            borderRadius: 6,
            border: "none",
            background: "#2563eb",
            color: "#fff",
            cursor: "pointer",
            fontWeight: 500
          }}
        >
          📊 Hap Raportin e Inventarit
        </button>
      </div>

      {/* DATA ENTRY */}
      <section style={{ marginBottom: 40 }}>
        <DitorForm />
      </section>

      {/* LIVE DATA */}
      <section>
        <h2>📋 Të dhëna të regjistruara</h2>
        <DitorTable />
      </section>
    </div>
  );
}

