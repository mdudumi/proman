import { useEffect, useState, useMemo } from "react";
import { supabase } from "../lib/supabaseClient";
import { CATEGORY_IDS } from "../lib/categoryIds";
import "./DitorReport.css";

export default function DitorReport() {
  const [rows, setRows] = useState([]);

  /* ================= FILTER STATE ================= */

  const [filters, setFilters] = useState({
    fromDate: "",
    toDate: "",
    produkti_id: "",
    monedha_id: "",
    bleresi_id: ""
  });

  /* ================= LOOKUPS ================= */

  const [produkte, setProdukte] = useState([]);

  /* ================= LOAD LOOKUPS ================= */

  useEffect(() => {
    supabase
      .from("kategoria_list")
      .select("id,name,kategoria_id")
      .eq("is_active", true)
      .not(
        "kategoria_id",
        "in",
        `(${CATEGORY_IDS.MONEDHA},${CATEGORY_IDS.BLERESI_SHITESI},${CATEGORY_IDS.TJETER})`
      )
      .order("name")
      .then(({ data }) => setProdukte(data || []));
  }, []);

  /* ================= LOAD REPORT ================= */

  async function load() {
    const { data, error } = await supabase.rpc("rpc_ditor_daily_report", {
      p_from_date: filters.fromDate || null,
      p_to_date: filters.toDate || null,
      p_produkti_id: filters.produkti_id || null,
      p_monedha_id: filters.monedha_id || null,
      p_bleresi_id: filters.bleresi_id || null
    });

    if (error) {
      console.error(error);
      return;
    }

    setRows(data || []);
  }

  useEffect(() => {
    load();
  }, [filters]);

  /* ================= PRODUCT NAME ================= */

  const selectedProductName = useMemo(() => {
    if (!filters.produkti_id) return "—";
    const found = produkte.find(p => String(p.id) === String(filters.produkti_id));
    return found ? found.name : "—";
  }, [filters.produkti_id, produkte]);

  /* ================= GROUP BY DATE ================= */

  const groupedByDate = useMemo(() => {
    return rows.reduce((acc, r) => {
      acc[r.data] = acc[r.data] || [];
      acc[r.data].push(r);
      return acc;
    }, {});
  }, [rows]);

  /* ================= PERIOD ================= */

  function getReportPeriod(data) {
    if (!data.length) return { from: "—", to: "—" };
    const dates = data.map(r => r.data).sort();
    return { from: dates[0], to: dates[dates.length - 1] };
  }

  /* ================= TOTALS (ACCOUNTING CORRECT) ================= */

  function calculateTotals(data) {
    if (!data.length) {
      return {
        opening_sasia: 0,
        sasia_hyrje: 0,
        sasia_dalje: 0,
        sasia_mbetur: 0,
        opening_shuma: 0,
        shuma_hyrje: 0,
        shuma_dalje: 0,
        shuma_mbetur: 0
      };
    }

    const sorted = [...data].sort((a, b) =>
      a.data.localeCompare(b.data)
    );

    const first = sorted[0];
    const last = sorted[sorted.length - 1];

    return {
      // Opening balances = FIRST record
      opening_sasia: first.opening_sasia ?? 0,
      opening_shuma: first.opening_shuma ?? 0,

      // Movements = SUM
      sasia_hyrje: sorted.reduce((s, r) => s + (r.sasia_hyrje ?? 0), 0),
      sasia_dalje: sorted.reduce((s, r) => s + (r.sasia_dalje ?? 0), 0),
      shuma_hyrje: sorted.reduce((s, r) => s + (r.shuma_hyrje ?? 0), 0),
      shuma_dalje: sorted.reduce((s, r) => s + (r.shuma_dalje ?? 0), 0),

      // Closing balances = LAST record
      sasia_mbetur: last.sasia_mbetur ?? 0,
      shuma_mbetur: last.shuma_mbetur ?? 0
    };
  }

  /* ================= PRINT ================= */

  function printReport() {
    if (!rows.length) return;

    const totals = calculateTotals(rows);
    const period = getReportPeriod(rows);
    const win = window.open("", "_blank");

    win.document.write(`
<!DOCTYPE html>
<html>
<head>
<title>Raporti i Bilancit te Produktit</title>

<style>
@page { size: A4 portrait; margin: 12mm; }

* {
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
}

body {
  margin: 0;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 11px;
  color: #000;
}

.print-page {
  width: 190mm;
  margin: 0 auto;
}

h1 {
  text-align: center;
  font-size: 17px;
  margin: 0 0 6px 0;
}

.meta {
  text-align: center;
  font-size: 11px;
  margin-bottom: 16px;
  line-height: 1.35;
}

table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

th, td {
  border: 1px solid #777;
  padding: 6px 4px;
  text-align: center;
  vertical-align: middle;
}

thead th {
  background-color: #d9d9d9 !important;
  font-weight: 700;
}

tfoot td {
  background-color: #dbe9f6 !important;
  font-weight: 700;
  border-top: 2px solid #000;
  border-bottom: 2px solid #000;
}
</style>
</head>

<body>
<div class="print-page">

<h1>Raporti i Bilancit te Produktit</h1>

<div class="meta">
  <div><b>Produkti:</b> ${selectedProductName}</div>
  <div><b>Periudha:</b> ${period.from} → ${period.to}</div>
  <div>Printuar me: ${new Date().toLocaleString()}</div>
</div>

<table>
<colgroup>
  <col style="width:12%">
  <col style="width:11%">
  <col style="width:11%">
  <col style="width:11%">
  <col style="width:11%">
  <col style="width:11%">
  <col style="width:11%">
  <col style="width:11%">
  <col style="width:11%">
</colgroup>

<thead>
<tr>
  <th>Date</th>
  <th>Sasia<br/>ne Hapje</th>
  <th>Hyrje<br/>/ Blerje</th>
  <th>Dalje<br/>/ Shitje</th>
  <th>Sasia<br/>ne Mbyllje</th>
  <th>Vlera<br/>ne Hapje</th>
  <th>Hyrje<br/>/ Blerje</th>
  <th>Dalje<br/>/ Shitje</th>
  <th>Vlera<br/>ne Mbyllje</th>
</tr>
</thead>

<tbody>
${Object.entries(groupedByDate).map(([date, rs]) =>
  rs.map(r => `
<tr>
  <td>${date}</td>
  <td>${r.opening_sasia ?? 0}</td>
  <td>${r.sasia_hyrje ?? 0}</td>
  <td>${r.sasia_dalje ?? 0}</td>
  <td>${r.sasia_mbetur ?? 0}</td>
  <td>${r.opening_shuma ?? 0}</td>
  <td>${r.shuma_hyrje ?? 0}</td>
  <td>${r.shuma_dalje ?? 0}</td>
  <td>${r.shuma_mbetur ?? 0}</td>
</tr>`).join("")
).join("")}
</tbody>

<tfoot>
<tr>
  <td>TOTAL</td>
  <td>${totals.opening_sasia}</td>
  <td>${totals.sasia_hyrje}</td>
  <td>${totals.sasia_dalje}</td>
  <td>${totals.sasia_mbetur}</td>
  <td>${totals.opening_shuma}</td>
  <td>${totals.shuma_hyrje}</td>
  <td>${totals.shuma_dalje}</td>
  <td>${totals.shuma_mbetur}</td>
</tr>
</tfoot>

</table>
</div>
</body>
</html>
    `);

    win.document.close();
    win.print();
  }

  /* ================= UI ================= */

  return (
    <div className="report-card">
      <h3>Raporti i Bilancit te Produktit</h3>

      <div className="report-filters">
        <input
          type="date"
          value={filters.fromDate}
          onChange={e => setFilters({ ...filters, fromDate: e.target.value })}
        />

        <input
          type="date"
          value={filters.toDate}
          onChange={e => setFilters({ ...filters, toDate: e.target.value })}
        />

        <select
          value={filters.produkti_id}
          onChange={e => setFilters({ ...filters, produkti_id: e.target.value })}
        >
          <option value="">Select Produkt</option>
          {produkte.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <button
          onClick={() =>
            setFilters({
              fromDate: "",
              toDate: "",
              produkti_id: "",
              monedha_id: "",
              bleresi_id: ""
            })
          }
        >
          Rifresko
        </button>
      </div>

<div className="report-actions">
  <button disabled={!filters.produkti_id} onClick={printReport}>
    🖨️ Printo Raportin per Produktin
  </button>

  <button
    style={{ marginLeft: "auto" }}
    onClick={() => window.location.href = "/dashboard"}
  >
    ⬅️ Kthehu tek Hyrja
  </button>
</div>

      {/* ================= SCREEN TABLE ================= */}

      <table className="report-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Sasia ne Hapje</th>
            <th>Hyrje / Blerje</th>
            <th>Dalje / Shitje</th>
            <th>Sasia ne Mbyllje</th>
            <th>Vlera ne Hapje</th>
            <th>Hyrje / Blerje</th>
            <th>Dalje / Shitje</th>
            <th>Vlera ne Mbyllje</th>
          </tr>
        </thead>

        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan="9" style={{ textAlign: "center" }}>
                No data
              </td>
            </tr>
          )}

          {Object.entries(groupedByDate).map(([date, rs]) =>
            rs.map((r, i) => (
              <tr key={`${date}-${i}`}>
                <td>{date}</td>
                <td>{r.opening_sasia ?? 0}</td>
                <td>{r.sasia_hyrje ?? 0}</td>
                <td>{r.sasia_dalje ?? 0}</td>
                <td><b>{r.sasia_mbetur ?? 0}</b></td>
                <td>{r.opening_shuma ?? 0}</td>
                <td>{r.shuma_hyrje ?? 0}</td>
                <td>{r.shuma_dalje ?? 0}</td>
                <td><b>{r.shuma_mbetur ?? 0}</b></td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
