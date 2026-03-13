import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { CATEGORY_IDS } from "../lib/categoryIds";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import "./DitorReport.css";

const VEPRIM_OPTIONS = [
  { id: "Hyrje/Blerje", name: "Hyrje/Blerje" },
  { id: "Shitje/Dalje", name: "Shitje/Dalje" }
];

const FLAT_COLUMNS = [
  { key: "data", label: "Data", type: "text" },
  { key: "opening_sasia", label: "Sasia - Në Hapje", type: "number" },
  { key: "sasia_hyrje", label: "Sasia - Hyrje", type: "number" },
  { key: "sasia_dalje", label: "Sasia - Dalje", type: "number" },
  { key: "sasia_mbetur", label: "Sasia - Në Mbyllje", type: "number" },
  { key: "opening_shuma", label: "Vlera - Në Hapje", type: "number" },
  { key: "shuma_hyrje", label: "Vlera - Hyrje", type: "number" },
  { key: "shuma_dalje", label: "Vlera - Dalje", type: "number" },
  { key: "shuma_mbetur", label: "Vlera - Në Mbyllje", type: "number" }
];

const DEFAULT_COLUMNS = FLAT_COLUMNS.map(x => x.key);

const GROUP_BY_OPTIONS = [
  { key: "", label: "Pa grupim" },
  { key: "kategoria", label: "Grupo sipas Kategorisë" },
  { key: "produkti", label: "Grupo sipas Produktit" },
  { key: "monedha", label: "Grupo sipas Monedhës" },
  { key: "bleresi_shitesi", label: "Grupo sipas Blerësi/Shitësi" },
  { key: "veprimi", label: "Grupo sipas Veprimit" }
];

export default function DitorReport() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const [filters, setFilters] = useState({
    fromDate: "",
    toDate: "",
    kategoria_id: "",
    produkti_id: "",
    monedha_id: "",
    bleresi_id: "",
    veprimi: "",
    groupBy: ""
  });

  const [selectedColumns, setSelectedColumns] = useState(DEFAULT_COLUMNS);
  const [showColumnPicker, setShowColumnPicker] = useState(false);

  const [kategori, setKategori] = useState([]);
  const [produkte, setProdukte] = useState([]);
  const [monedhat, setMonedhat] = useState([]);
  const [bleresit, setBleresit] = useState([]);

  useEffect(() => {
    loadLookups();
  }, []);

  useEffect(() => {
    loadReport();
  }, [
    filters.fromDate,
    filters.toDate,
    filters.kategoria_id,
    filters.produkti_id,
    filters.monedha_id,
    filters.bleresi_id,
    filters.veprimi
  ]);

  async function loadLookups() {
    try {
      const [kategoriRes, produkteRes, monedhaRes, bleresiRes] = await Promise.all([
        supabase.from("kategoria").select("id,name").order("name"),
        supabase
          .from("kategoria_list")
          .select("id,name,kategoria_id")
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("kategoria_list")
          .select("id,name")
          .eq("is_active", true)
          .eq("kategoria_id", CATEGORY_IDS.MONEDHA)
          .order("name"),
        supabase
          .from("kategoria_list")
          .select("id,name")
          .eq("is_active", true)
          .eq("kategoria_id", CATEGORY_IDS.BLERESI_SHITESI)
          .order("name")
      ]);

      if (kategoriRes.error) console.error(kategoriRes.error);
      if (produkteRes.error) console.error(produkteRes.error);
      if (monedhaRes.error) console.error(monedhaRes.error);
      if (bleresiRes.error) console.error(bleresiRes.error);

      setKategori(kategoriRes.data || []);

      const allProdukte = produkteRes.data || [];
      const filteredProdukteBase = allProdukte.filter(
        x =>
          ![
            CATEGORY_IDS.MONEDHA,
            CATEGORY_IDS.BLERESI_SHITESI,
            CATEGORY_IDS.TJETER
          ].includes(x.kategoria_id)
      );

      setProdukte(filteredProdukteBase);
      setMonedhat(monedhaRes.data || []);
      setBleresit(bleresiRes.data || []);
    } catch (err) {
      console.error("Lookup load error:", err);
    }
  }

  async function loadReport() {
    setLoading(true);

    const params = {
      p_from_date: filters.fromDate || null,
      p_to_date: filters.toDate || null,
      p_kategoria_id: filters.kategoria_id || null,
      p_produkti_id: filters.produkti_id || null,
      p_monedha_id: filters.monedha_id || null,
      p_bleresi_id: filters.bleresi_id || null,
      p_veprimi: filters.veprimi || null
    };

    try {
      const { data, error } = await supabase.rpc("rpc_ditor_daily_report", params);

      if (error) {
        console.error("RPC error:", error);
        setRows([]);
        return;
      }

      const sorted = [...(data || [])].sort((a, b) => {
        const byDate = String(a.data ?? "").localeCompare(String(b.data ?? ""));
        if (byDate !== 0) return byDate;
        return String(a.id ?? "").localeCompare(String(b.id ?? ""));
      });

      setRows(sorted);
    } catch (err) {
      console.error("Report load exception:", err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  const visibleColumns = useMemo(() => {
    return FLAT_COLUMNS.filter(col => selectedColumns.includes(col.key));
  }, [selectedColumns]);

  const filteredProdukte = useMemo(() => {
    if (!filters.kategoria_id) return [];
    return produkte.filter(
      p => String(p.kategoria_id) === String(filters.kategoria_id)
    );
  }, [produkte, filters.kategoria_id]);

  const reportPeriod = useMemo(() => {
    if (!rows.length) {
      return {
        from: filters.fromDate || "—",
        to: filters.toDate || "—"
      };
    }

    const dates = rows.map(r => r.data).filter(Boolean).sort();
    return {
      from: dates[0] || filters.fromDate || "—",
      to: dates[dates.length - 1] || filters.toDate || "—"
    };
  }, [rows, filters.fromDate, filters.toDate]);

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

    const sorted = [...data].sort((a, b) => {
      const byDate = String(a.data ?? "").localeCompare(String(b.data ?? ""));
      if (byDate !== 0) return byDate;
      return String(a.id ?? "").localeCompare(String(b.id ?? ""));
    });

    const first = sorted[0];
    const last = sorted[sorted.length - 1];

    return {
      opening_sasia: Number(first.opening_sasia ?? 0),
      opening_shuma: Number(first.opening_shuma ?? 0),
      sasia_hyrje: sorted.reduce((s, r) => s + Number(r.sasia_hyrje ?? 0), 0),
      sasia_dalje: sorted.reduce((s, r) => s + Number(r.sasia_dalje ?? 0), 0),
      shuma_hyrje: sorted.reduce((s, r) => s + Number(r.shuma_hyrje ?? 0), 0),
      shuma_dalje: sorted.reduce((s, r) => s + Number(r.shuma_dalje ?? 0), 0),
      sasia_mbetur: Number(last.sasia_mbetur ?? 0),
      shuma_mbetur: Number(last.shuma_mbetur ?? 0)
    };
  }

  const totals = useMemo(() => calculateTotals(rows), [rows]);

  const topSummary = useMemo(() => {
    return {
      openingQty: totals.opening_sasia || 0,
      inQty: totals.sasia_hyrje || 0,
      outQty: totals.sasia_dalje || 0,
      closingQty: totals.sasia_mbetur || 0,
      openingValue: totals.opening_shuma || 0,
      inValue: totals.shuma_hyrje || 0,
      outValue: totals.shuma_dalje || 0,
      closingValue: totals.shuma_mbetur || 0
    };
  }, [totals]);

  function formatNumber(value) {
    const num = Number(value ?? 0);
    return num.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function isNegative(value) {
    return Number(value ?? 0) < 0;
  }

  function getColumnValue(row, key) {
    if (key === "data") return row[key] ?? "";
    return Number(row[key] ?? 0);
  }

  function getGroupValueFromRow(row, groupBy) {
    if (!groupBy) return "__all__";
    return row[groupBy] ?? "";
  }

  function getGroupLabelFromRow(row, groupBy) {
    if (!groupBy) return "Të gjitha";
    return row[groupBy] || "Pa emër";
  }

  const groupedRows = useMemo(() => {
    if (!filters.groupBy) {
      return [
        {
          groupKey: "__all__",
          groupLabel: "Të gjitha",
          rows,
          totals: calculateTotals(rows)
        }
      ];
    }

    const map = new Map();

    for (const row of rows) {
      const groupKey = String(getGroupValueFromRow(row, filters.groupBy) || "__empty__");
      const groupLabel = getGroupLabelFromRow(row, filters.groupBy);

      if (!map.has(groupKey)) {
        map.set(groupKey, {
          groupKey,
          groupLabel,
          rows: []
        });
      }

      map.get(groupKey).rows.push(row);
    }

    return Array.from(map.values()).map(group => ({
      ...group,
      totals: calculateTotals(group.rows)
    }));
  }, [rows, filters.groupBy]);

  function resetFilters() {
    setFilters({
      fromDate: "",
      toDate: "",
      kategoria_id: "",
      produkti_id: "",
      monedha_id: "",
      bleresi_id: "",
      veprimi: "",
      groupBy: ""
    });
  }

  function toggleColumn(colKey) {
    setSelectedColumns(prev => {
      if (prev.includes(colKey)) {
        if (prev.length === 1) return prev;
        return prev.filter(c => c !== colKey);
      }
      return [...prev, colKey];
    });
  }

  function selectAllColumns() {
    setSelectedColumns(FLAT_COLUMNS.map(c => c.key));
  }

  function resetDefaultColumns() {
    setSelectedColumns(DEFAULT_COLUMNS);
  }

  function sanitizeFileName(value) {
    return String(value || "raport")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "_");
  }

  function buildExportTitle() {
    return "Raporti Ultra Premium i Bilancit";
  }

  function buildExportFileName(ext) {
    return `${sanitizeFileName(buildExportTitle())}_${sanitizeFileName(reportPeriod.from)}_${sanitizeFileName(reportPeriod.to)}.${ext}`;
  }

  function getFilterSummaryText() {
    return [
      `Kategoria: ${kategori.find(x => String(x.id) === String(filters.kategoria_id))?.name || "All"}`,
      `Produkti: ${produkte.find(x => String(x.id) === String(filters.produkti_id))?.name || "All"}`,
      `Monedha: ${monedhat.find(x => String(x.id) === String(filters.monedha_id))?.name || "All"}`,
      `Blerësi/Shitësi: ${bleresit.find(x => String(x.id) === String(filters.bleresi_id))?.name || "All"}`,
      `Veprimi: ${VEPRIM_OPTIONS.find(x => x.id === filters.veprimi)?.name || "All"}`,
      `Grupimi: ${GROUP_BY_OPTIONS.find(x => x.key === filters.groupBy)?.label || "Pa grupim"}`
    ].join(" | ");
  }

  function exportPDF() {
    if (!rows.length) return;

    const doc = new jsPDF("l", "mm", "a4");

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 297, 24, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(buildExportTitle(), 14, 15);

    doc.setTextColor(40, 40, 40);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Periudha: ${reportPeriod.from} - ${reportPeriod.to}`, 14, 31);
    doc.text(`Rreshta: ${rows.length}`, 110, 31);
    doc.text(`Gjeneruar: ${new Date().toLocaleString()}`, 165, 31);

    doc.setFontSize(8.2);
    doc.text(getFilterSummaryText(), 14, 37);

    const head = [visibleColumns.map(c => c.label)];
    const body = [];

    groupedRows.forEach(group => {
      if (filters.groupBy) {
        body.push([
          {
            content: `GRUPI: ${group.groupLabel} (${group.rows.length} rreshta)`,
            colSpan: visibleColumns.length,
            styles: {
              fontStyle: "bold",
              fillColor: [226, 232, 240],
              textColor: [15, 23, 42],
              halign: "left"
            }
          }
        ]);
      }

      group.rows.forEach(r => {
        body.push(
          visibleColumns.map(col =>
            col.key === "data" ? (r.data ?? "") : formatNumber(r[col.key] ?? 0)
          )
        );
      });

      if (filters.groupBy) {
        body.push(
          visibleColumns.map((col, idx) =>
            idx === 0
              ? {
                  content: `Subtotal - ${group.groupLabel}`,
                  styles: {
                    fontStyle: "bold",
                    fillColor: [241, 245, 249],
                    textColor: [15, 23, 42],
                    halign: "left"
                  }
                }
              : {
                  content: formatNumber(group.totals[col.key] ?? 0),
                  styles: {
                    fontStyle: "bold",
                    fillColor: [241, 245, 249],
                    textColor: [15, 23, 42],
                    halign: col.type === "number" ? "right" : "left"
                  }
                }
          )
        );
      }
    });

    const foot = [
      visibleColumns.map((col, idx) =>
        idx === 0
          ? {
              content: "GRAND TOTAL",
              styles: {
                fontStyle: "bold",
                fillColor: [219, 233, 246],
                textColor: [0, 0, 0],
                halign: "left"
              }
            }
          : {
              content: formatNumber(totals[col.key] ?? 0),
              styles: {
                fontStyle: "bold",
                fillColor: [219, 233, 246],
                textColor: [0, 0, 0],
                halign: col.type === "number" ? "right" : "left"
              }
            }
      )
    ];

    autoTable(doc, {
      startY: 43,
      head,
      body,
      foot,
      showFoot: "lastPage",
      theme: "grid",
      styles: {
        fontSize: 8,
        cellPadding: 2.4,
        lineColor: [210, 214, 220],
        lineWidth: 0.1,
        overflow: "linebreak"
      },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        halign: "center"
      },
      bodyStyles: {
        textColor: [30, 41, 59]
      },
      columnStyles: visibleColumns.reduce((acc, col, idx) => {
        acc[idx] = {
          halign: col.type === "number" ? "right" : "left"
        };
        return acc;
      }, {})
    });

    doc.save(buildExportFileName("pdf"));
  }

  async function exportExcel() {
    if (!rows.length) return;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Bilanci", {
      views: [{ state: "frozen", ySplit: 6 }]
    });

    const totalCols = visibleColumns.length;

    function mergeAcross(rowNumber) {
      if (totalCols > 1) {
        worksheet.mergeCells(rowNumber, 1, rowNumber, totalCols);
      }
    }

    function addBorder(cell, color = "CBD5E1") {
      cell.border = {
        top: { style: "thin", color: { argb: color } },
        left: { style: "thin", color: { argb: color } },
        bottom: { style: "thin", color: { argb: color } },
        right: { style: "thin", color: { argb: color } }
      };
    }

    worksheet.addRow([buildExportTitle()]);
    mergeAcross(1);
    worksheet.getCell("A1").font = { bold: true, size: 16, color: { argb: "0F172A" } };
    worksheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };

    worksheet.addRow([`Periudha: ${reportPeriod.from} - ${reportPeriod.to}`]);
    mergeAcross(2);
    worksheet.getCell("A2").font = { bold: true, size: 11, color: { argb: "334155" } };

    worksheet.addRow([`Gjeneruar: ${new Date().toLocaleString()}`]);
    mergeAcross(3);
    worksheet.getCell("A3").font = { bold: true, size: 11, color: { argb: "334155" } };

    worksheet.addRow([getFilterSummaryText()]);
    mergeAcross(4);
    worksheet.getCell("A4").font = { bold: true, size: 11, color: { argb: "334155" } };

    worksheet.addRow([]);

    const headerRow = worksheet.addRow(visibleColumns.map(c => c.label));
    headerRow.height = 22;

    headerRow.eachCell(cell => {
      cell.font = { bold: true, color: { argb: "FFFFFF" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "0F172A" }
      };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      addBorder(cell);
    });

    groupedRows.forEach(group => {
      if (filters.groupBy) {
        const row = worksheet.addRow([`GRUPI: ${group.groupLabel} (${group.rows.length} rreshta)`]);
        if (totalCols > 1) {
          worksheet.mergeCells(row.number, 1, row.number, totalCols);
        }

        const cell = worksheet.getCell(row.number, 1);
        cell.font = { bold: true, color: { argb: "0F172A" } };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "E2E8F0" }
        };
        cell.alignment = { horizontal: "left", vertical: "middle" };
        addBorder(cell);
      }

      group.rows.forEach(r => {
        const rowValues = visibleColumns.map(col =>
          col.key === "data" ? (r.data ?? "") : Number(r[col.key] ?? 0)
        );

        const row = worksheet.addRow(rowValues);

        row.eachCell((cell, colNumber) => {
          const col = visibleColumns[colNumber - 1];
          addBorder(cell, "E2E8F0");

          if (col.type === "number") {
            cell.numFmt = "#,##0.00";
            cell.alignment = { horizontal: "right", vertical: "middle" };
          } else {
            cell.alignment = { horizontal: "left", vertical: "middle" };
          }
        });
      });

      if (filters.groupBy) {
        const subtotalRow = worksheet.addRow(
          visibleColumns.map((col, idx) =>
            idx === 0
              ? `Subtotal - ${group.groupLabel}`
              : Number(group.totals[col.key] ?? 0)
          )
        );

        subtotalRow.eachCell((cell, colNumber) => {
          const col = visibleColumns[colNumber - 1];
          cell.font = { bold: true, color: { argb: "0F172A" } };
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "F1F5F9" }
          };
          addBorder(cell);

          if (col.type === "number") {
            cell.numFmt = "#,##0.00";
            cell.alignment = { horizontal: "right", vertical: "middle" };
          } else {
            cell.alignment = { horizontal: "left", vertical: "middle" };
          }
        });
      }
    });

    const grandTotalRow = worksheet.addRow(
      visibleColumns.map((col, idx) =>
        idx === 0 ? "GRAND TOTAL" : Number(totals[col.key] ?? 0)
      )
    );

    grandTotalRow.eachCell((cell, colNumber) => {
      const col = visibleColumns[colNumber - 1];
      cell.font = { bold: true, color: { argb: "000000" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "DBE9F6" }
      };
      addBorder(cell, "94A3B8");

      if (col.type === "number") {
        cell.numFmt = "#,##0.00";
        cell.alignment = { horizontal: "right", vertical: "middle" };
      } else {
        cell.alignment = { horizontal: "left", vertical: "middle" };
      }
    });

    worksheet.columns = visibleColumns.map(col => ({
      width: col.key === "data" ? 16 : 18
    }));

    worksheet.autoFilter = {
      from: { row: 6, column: 1 },
      to: { row: 6, column: totalCols }
    };

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(
      new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      }),
      buildExportFileName("xlsx")
    );
  }

  return (
    <div className="dr-page">
      <div className="dr-shell">
        <div className="dr-hero ultra">
          <div>
            <div className="dr-overline">Finance / Accounting / Inventory</div>
            <h1>Raporti Ultra Premium i Bilancit</h1>
            <p>
              Tabelë e thjeshtë me kolona normale, grupim sipas filtrit të zgjedhur,
              subtotal për grup dhe total final.
            </p>
          </div>

          <div className="dr-hero-actions">
            <button className="dr-btn dr-btn-light" onClick={() => setShowColumnPicker(v => !v)}>
              Zgjidh Kolonat
            </button>
            <button className="dr-btn dr-btn-light" onClick={resetFilters}>
              Rifresko
            </button>
          </div>
        </div>

        <div className="dr-card">
          <div className="dr-section-title">Filtra</div>

          <div className="dr-filters">
            <div className="dr-field">
              <label>Nga</label>
              <input
                type="date"
                value={filters.fromDate}
                onChange={e => setFilters({ ...filters, fromDate: e.target.value })}
              />
            </div>

            <div className="dr-field">
              <label>Në</label>
              <input
                type="date"
                value={filters.toDate}
                onChange={e => setFilters({ ...filters, toDate: e.target.value })}
              />
            </div>

            <div className="dr-field">
              <label>Kategoria</label>
              <select
                value={filters.kategoria_id}
                onChange={e =>
                  setFilters(prev => ({
                    ...prev,
                    kategoria_id: e.target.value,
                    produkti_id: ""
                  }))
                }
              >
                <option value="">All</option>
                {kategori.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="dr-field">
              <label>Produkti</label>
              <select
                value={filters.produkti_id}
                disabled={!filters.kategoria_id || !filteredProdukte.length}
                onChange={e => setFilters(prev => ({ ...prev, produkti_id: e.target.value }))}
              >
                <option value="">All</option>
                {filteredProdukte.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="dr-field">
              <label>Monedha</label>
              <select
                value={filters.monedha_id}
                onChange={e => setFilters({ ...filters, monedha_id: e.target.value })}
              >
                <option value="">All</option>
                {monedhat.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="dr-field">
              <label>Blerësi/Shitësi</label>
              <select
                value={filters.bleresi_id}
                onChange={e => setFilters({ ...filters, bleresi_id: e.target.value })}
              >
                <option value="">All</option>
                {bleresit.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="dr-field">
              <label>Veprimi</label>
              <select
                value={filters.veprimi}
                onChange={e => setFilters({ ...filters, veprimi: e.target.value })}
              >
                <option value="">All</option>
                {VEPRIM_OPTIONS.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="dr-field">
              <label>Grupo sipas</label>
              <select
                value={filters.groupBy}
                onChange={e => setFilters({ ...filters, groupBy: e.target.value })}
              >
                {GROUP_BY_OPTIONS.map(item => (
                  <option key={item.key} value={item.key}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {showColumnPicker && (
          <div className="dr-card">
            <div className="dr-column-header">
              <div className="dr-section-title">Konfigurimi i kolonave</div>
              <div className="dr-inline-actions">
                <button className="dr-btn dr-btn-secondary" onClick={selectAllColumns}>
                  Select All
                </button>
                <button className="dr-btn dr-btn-secondary" onClick={resetDefaultColumns}>
                  Default
                </button>
              </div>
            </div>

            <div className="dr-column-grid">
              {FLAT_COLUMNS.map(col => (
                <label key={col.key} className="dr-check-item">
                  <input
                    type="checkbox"
                    checked={selectedColumns.includes(col.key)}
                    onChange={() => toggleColumn(col.key)}
                  />
                  <span>{col.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="dr-summary-grid ultra">
          <div className="dr-summary-card">
            <div className="dr-summary-label">Sasia në Hapje</div>
            <div className="dr-summary-value">{formatNumber(topSummary.openingQty)}</div>
          </div>
          <div className="dr-summary-card">
            <div className="dr-summary-label">Hyrje Totale</div>
            <div className="dr-summary-value">{formatNumber(topSummary.inQty)}</div>
          </div>
          <div className="dr-summary-card">
            <div className="dr-summary-label">Dalje Totale</div>
            <div className="dr-summary-value">{formatNumber(topSummary.outQty)}</div>
          </div>
          <div className="dr-summary-card">
            <div className="dr-summary-label">Sasia në Mbyllje</div>
            <div className={`dr-summary-value ${isNegative(topSummary.closingQty) ? "neg" : ""}`}>
              {formatNumber(topSummary.closingQty)}
            </div>
          </div>
          <div className="dr-summary-card">
            <div className="dr-summary-label">Vlera në Hapje</div>
            <div className={`dr-summary-value ${isNegative(topSummary.openingValue) ? "neg" : ""}`}>
              {formatNumber(topSummary.openingValue)}
            </div>
          </div>
          <div className="dr-summary-card">
            <div className="dr-summary-label">Vlera Hyrje</div>
            <div className="dr-summary-value">{formatNumber(topSummary.inValue)}</div>
          </div>
          <div className="dr-summary-card">
            <div className="dr-summary-label">Vlera Dalje</div>
            <div className="dr-summary-value">{formatNumber(topSummary.outValue)}</div>
          </div>
          <div className="dr-summary-card">
            <div className={`dr-summary-value ${isNegative(topSummary.closingValue) ? "neg" : ""}`}>
              {formatNumber(topSummary.closingValue)}
            </div>
            <div className="dr-summary-label bottom">Vlera në Mbyllje</div>
          </div>
        </div>

        <div className="dr-card">
          <div className="dr-toolbar">
            <div className="dr-toolbar-left">
              <div className="dr-section-title">Rezultatet</div>
              <div className="dr-meta">
                <span><b>Periudha:</b> {reportPeriod.from} - {reportPeriod.to}</span>
                <span><b>Rreshta:</b> {rows.length}</span>
                <span><b>Grupe:</b> {groupedRows.length}</span>
              </div>
            </div>

            <div className="dr-toolbar-actions">
              <button className="dr-btn dr-btn-primary" disabled={!rows.length} onClick={exportPDF}>
                Download PDF
              </button>
              <button className="dr-btn dr-btn-primary" disabled={!rows.length} onClick={exportExcel}>
                Export Excel
              </button>
              <button
                className="dr-btn dr-btn-dark"
                onClick={() => (window.location.href = "/dashboard")}
              >
                Kthehu tek Hyrja
              </button>
            </div>
          </div>

          <div className="dr-filter-line">{getFilterSummaryText()}</div>

          <div className="dr-table-wrap ultra">
            <table className="dr-table ultra">
              <colgroup>
                {visibleColumns.map(col => (
                  <col
                    key={col.key}
                    style={{ width: col.key === "data" ? "130px" : "160px" }}
                  />
                ))}
              </colgroup>

              <thead>
                <tr>
                  {visibleColumns.map(col => (
                    <th key={col.key} className={col.type === "number" ? "right" : "left"}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={visibleColumns.length} className="dr-empty">
                      Duke ngarkuar...
                    </td>
                  </tr>
                )}

                {!loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={visibleColumns.length} className="dr-empty">
                      Nuk ka të dhëna për filtrat e zgjedhur.
                    </td>
                  </tr>
                )}

                {!loading &&
                  groupedRows.map(group => (
                    <React.Fragment key={group.groupKey}>
                      {filters.groupBy && (
                        <tr className="dr-group-row">
                          <td colSpan={visibleColumns.length}>
                            <b>{group.groupLabel}</b> ({group.rows.length} rreshta)
                          </td>
                        </tr>
                      )}

                      {group.rows.map((row, idx) => (
                        <tr key={`${group.groupKey}-${row.id || idx}-${row.data || idx}`}>
                          {visibleColumns.map(col => {
                            const raw = getColumnValue(row, col.key);
                            const isNum = col.type === "number";

                            return (
                              <td
                                key={col.key}
                                className={`${isNum ? "right" : "left"} ${
                                  isNum && isNegative(raw) ? "neg" : ""
                                }`}
                              >
                                {isNum ? formatNumber(raw) : raw}
                              </td>
                            );
                          })}
                        </tr>
                      ))}

                      {filters.groupBy && (
                        <tr className="dr-subtotal-row">
                          {visibleColumns.map(col => (
                            <td
                              key={col.key}
                              className={`${col.type === "number" ? "right" : "left"} ${
                                col.type === "number" && isNegative(group.totals[col.key] ?? 0)
                                  ? "neg"
                                  : ""
                              }`}
                            >
                              {col.key === "data"
                                ? `Subtotal - ${group.groupLabel}`
                                : formatNumber(group.totals[col.key] ?? 0)}
                            </td>
                          ))}
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
              </tbody>

              {!loading && rows.length > 0 && (
                <tfoot>
                  <tr>
                    {visibleColumns.map(col => (
                      <td
                        key={col.key}
                        className={`${col.type === "number" ? "right" : "left"} ${
                          col.type === "number" && isNegative(totals[col.key] ?? 0) ? "neg" : ""
                        }`}
                      >
                        {col.key === "data"
                          ? "GRAND TOTAL"
                          : formatNumber(totals[col.key] ?? 0)}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}