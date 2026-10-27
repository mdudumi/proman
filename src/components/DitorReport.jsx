import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { CATEGORY_IDS, NOT_ENTRY_CATEGORY_IDS } from "../lib/categoryIds";
import { TABLE_MARGIN, contentBox, drawContinuationBand, drawFooter, drawTitleBand } from "../lib/pdfPage";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import "./DitorReport.css";
import OperationalReports from "./OperationalReports";
import SearchSelect from "./SearchSelect";
import DatePicker from "./DatePicker";
import ClearableSelect from "./ClearableSelect";

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

const formatDate = value => {
  if (!value) return "";
  const [year, month, day] = String(value).split("-");
  return year && month && day ? `${day}.${month}.${year}` : value;
};

export default function DitorReport() {
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
  const [reportSection, setReportSection] = useState("balance");

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

      // Currencies and buyers/sellers are never an entry's category, so they aren't offered.
      // Tjetër is: its entries show in the report with their amount.
      setKategori((kategoriRes.data || []).filter(x => !NOT_ENTRY_CATEGORY_IDS.includes(x.id)));

      const allProdukte = produkteRes.data || [];
      const filteredProdukteBase = allProdukte.filter(
        x => !NOT_ENTRY_CATEGORY_IDS.includes(x.kategoria_id)
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
    setError("");

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
        setError(error.message);
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
      setError(err.message || String(err));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  const visibleColumns = useMemo(() => {
    return FLAT_COLUMNS.filter(col => selectedColumns.includes(col.key));
  }, [selectedColumns]);

  // Either filter can be picked first: a category narrows the product list, a product fills in its category.
  const filteredProdukte = useMemo(() => {
    if (!filters.kategoria_id) return produkte;
    return produkte.filter(
      p => String(p.kategoria_id) === String(filters.kategoria_id)
    );
  }, [produkte, filters.kategoria_id]);

  function setKategoria(value) {
    setFilters(prev => {
      // Keep the product only if it belongs to the new category.
      const produkti = produkte.find(p => String(p.id) === String(prev.produkti_id));
      const keepProdukti = produkti && String(produkti.kategoria_id) === String(value);
      return { ...prev, kategoria_id: value, produkti_id: keepProdukti ? prev.produkti_id : "" };
    });
  }

  function setProdukti(value) {
    setFilters(prev => {
      const produkti = produkte.find(p => String(p.id) === String(value));
      return { ...prev, produkti_id: value, kategoria_id: produkti?.kategoria_id ?? prev.kategoria_id };
    });
  }

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
    const box = contentBox(doc);
    const pdfTitle = "RAPORTI I GJENDJES DHE BILANCIT";
    const generatedAt = new Date().toLocaleString("sq-AL");
    doc.setFontSize(7.4);
    const filtersText = doc.splitTextToSize(getFilterSummaryText(), box.width);

    const bandBottom = drawTitleBand(doc, pdfTitle);
    doc.setTextColor(51, 65, 85);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(`Periudha: ${formatDate(reportPeriod.from)} – ${formatDate(reportPeriod.to)}`, box.left, bandBottom + 6);
    doc.text(`Rreshta: ${rows.length}`, box.left + 135, bandBottom + 6);
    doc.text(`Gjeneruar: ${generatedAt}`, box.right, bandBottom + 6, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.4);
    const filtersY = bandBottom + 11;
    doc.text(filtersText, box.left, filtersY);

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
            col.key === "data" ? formatDate(r.data) : formatNumber(r[col.key] ?? 0)
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
      startY: filtersY + filtersText.length * 3.4 + 4,
      head,
      body,
      foot,
      showFoot: "lastPage",
      theme: "grid",
      margin: TABLE_MARGIN,
      styles: {
        fontSize: 6.6,
        cellPadding: 1.35,
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
      // The columns share exactly the width inside the margins, however many are shown.
      columnStyles: (() => {
        const hasDate = visibleColumns.some(col => col.key === "data");
        const dateWidth = hasDate ? Math.min(30, box.width / visibleColumns.length) : 0;
        const otherWidth = (box.width - dateWidth) / Math.max(visibleColumns.length - (hasDate ? 1 : 0), 1);
        return visibleColumns.reduce((acc, col, idx) => {
          acc[idx] = {
            halign: col.type === "number" ? "right" : "left",
            cellWidth: col.key === "data" ? dateWidth : otherWidth
          };
          return acc;
        }, {});
      })(),
      didDrawPage: data => {
        if (data.pageNumber > 1) drawContinuationBand(doc, pdfTitle);
        drawFooter(doc, `PROMAN • Faqja ${doc.internal.getNumberOfPages()}`, "Raport i gjeneruar nga sistemi");
      }
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
            <h1>{reportSection === "balance" ? "Raporti i Bilancit" : "Analizat e faturave dhe gjendjes"}</h1>
            <p>
              {reportSection === "balance"
                ? "Gjendja e hapjes, hyrjet, daljet dhe gjendja përfundimtare për periudhën e zgjedhur."
                : "Faturat ditore, gjendja sipas artikullit dhe llogaritë me blerësit/shitësit."}
            </p>
          </div>

          <div className="dr-hero-actions">
            <button className={`dr-btn dr-btn-light ${reportSection === "balance" ? "dr-tab-active" : ""}`} onClick={() => setReportSection("balance")}>
              Bilanci
            </button>
            <button className={`dr-btn dr-btn-light ${reportSection === "analysis" ? "dr-tab-active" : ""}`} onClick={() => setReportSection("analysis")}>
              Analizat
            </button>
            {reportSection === "balance" && <>
              <button className="dr-btn dr-btn-light" onClick={() => setShowColumnPicker(v => !v)}>Zgjidh Kolonat</button>
              <button className="dr-btn dr-btn-light" onClick={resetFilters}>Rifresko</button>
            </>}
          </div>
        </div>

        <div className={`dr-card ${reportSection !== "balance" ? "dr-hidden" : ""}`}>
          <div className="dr-section-title">Filtra</div>

          <div className="dr-filters">
            <div className="dr-field">
              <label>Nga</label>
              <DatePicker
                value={filters.fromDate}
                onChange={value => setFilters(prev => ({ ...prev, fromDate: value }))}
                clearable
              />
            </div>

            <div className="dr-field">
              <label>Në</label>
              <DatePicker
                value={filters.toDate}
                onChange={value => setFilters(prev => ({ ...prev, toDate: value }))}
                clearable
              />
            </div>

            <div className="dr-field">
              <label>Kategoria</label>
              <SearchSelect
                value={filters.kategoria_id}
                onChange={setKategoria}
                options={kategori}
                placeholder="All"
              />
            </div>

            <div className="dr-field">
              <label>Produkti</label>
              <SearchSelect
                value={filters.produkti_id}
                disabled={!filteredProdukte.length}
                onChange={setProdukti}
                options={filteredProdukte}
                placeholder="All"
              />
            </div>

            <div className="dr-field">
              <label>Monedha</label>
              <SearchSelect
                value={filters.monedha_id}
                onChange={value => setFilters(prev => ({ ...prev, monedha_id: value }))}
                options={monedhat}
                placeholder="All"
              />
            </div>

            <div className="dr-field">
              <label>Blerësi/Shitësi</label>
              <SearchSelect
                value={filters.bleresi_id}
                onChange={value => setFilters(prev => ({ ...prev, bleresi_id: value }))}
                options={bleresit}
                placeholder="All"
              />
            </div>

            <div className="dr-field">
              <label>Veprimi</label>
              <ClearableSelect
                value={filters.veprimi}
                onChange={value => setFilters(prev => ({ ...prev, veprimi: value }))}
              >
                <option value="">All</option>
                {VEPRIM_OPTIONS.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </ClearableSelect>
            </div>

            <div className="dr-field">
              <label>Grupo sipas</label>
              <ClearableSelect
                value={filters.groupBy}
                onChange={value => setFilters(prev => ({ ...prev, groupBy: value }))}
              >
                {GROUP_BY_OPTIONS.map(item => (
                  <option key={item.key} value={item.key}>
                    {item.label}
                  </option>
                ))}
              </ClearableSelect>
            </div>
          </div>
        </div>

        <div className={reportSection !== "analysis" ? "dr-hidden" : ""}>
          <OperationalReports />
        </div>

        {reportSection === "balance" && showColumnPicker && (
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

        <div className={`dr-summary-grid ultra ${reportSection !== "balance" ? "dr-hidden" : ""}`}>
          <div className="dr-summary-card">
            <div className="dr-summary-label">Sasia (kg) – Në Hapje</div>
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
            <div className={`dr-summary-value ${isNegative(topSummary.closingQty) ? "neg" : ""}`}>
              {formatNumber(topSummary.closingQty)}
            </div>
            <div className="dr-summary-label bottom">Sasia (kg) – Në Gjendje</div>
          </div>
          <div className="dr-summary-card">
            <div className="dr-summary-label">Vlera (lekë) – Në Hapje</div>
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
            <div className="dr-summary-label bottom">Vlera (lekë) – Në Gjendje</div>
          </div>
        </div>

        <div className={`dr-card ${reportSection !== "balance" ? "dr-hidden" : ""}`}>
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
                onClick={() => navigate("/dashboard")}
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
                    className={col.key === "data" ? "data-col" : "num-col"}
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

                {!loading && error && (
                  <tr>
                    <td colSpan={visibleColumns.length} className="dr-empty dr-error">
                      Raporti nuk u ngarkua: {error}
                      <button className="dr-btn dr-btn-secondary dr-retry" onClick={loadReport}>
                        Provo përsëri
                      </button>
                    </td>
                  </tr>
                )}

                {!loading && !error && rows.length === 0 && (
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
