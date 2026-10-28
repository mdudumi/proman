import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { entryTotals, isTjeterEntry, totalsLines } from "./ditorEntries";
import { TABLE_MARGIN, contentBox, drawContinuationBand, drawFooter, drawTitleBand } from "./pdfPage";

// Excel and PDF exports of the dashboard entries that match the filters.
// Excel always gets every row. A PDF prints at most PDF_ROW_LIMIT rows (about 35 pages), the
// latest ones, but its totals always cover every matching row, and it says so on the page.
export const PDF_ROW_LIMIT = 1000;

const TITLE = "TË DHËNA TË REGJISTRUARA";
const HEADERS = ["Data", "Kategoria", "Produkti", "Monedha", "Blerësi/Shitësi", "Veprimi", "Sasia (kg)", "Shuma (lekë)", "Kosto/kg"];
const TJETER_NOTE =
  "Regjistrimet e kategorisë Tjetër (lëvizje parash) llogariten me shumën në lekë, pa sasi (kg) dhe pa kosto për kg.";
// Without a product filter the totals mix products, so they have no cost per kg (totalsLines).
const AVERAGE_NOTE = "Kosto/kg në totale shfaqet vetëm kur filtrohet sipas një produkti.";

const count = n => n.toLocaleString("en-US");
const money = v => Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const kg = v => Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 3 });

function formatDate(value) {
  const [y, m, d] = String(value || "").split("-");
  return y && m && d ? `${d}.${m}.${y}` : value || "";
}

function textCells(row) {
  return [
    formatDate(row.data),
    row.kategoria?.name || "",
    row.produkti?.name || "",
    row.monedha?.name || "",
    row.bleresi?.name || "",
    row.veprimi || ""
  ];
}

/**
 * @param rows  every entry matching the filters, oldest first
 * @param meta  { period, filtersText, filters, fileBase }
 */
export function exportEntriesPdf(rows, meta) {
  const capped = rows.length > PDF_ROW_LIMIT;
  const printed = capped ? rows.slice(-PDF_ROW_LIMIT) : rows;
  const lines = totalsLines(entryTotals(rows), meta.filters);

  const doc = new jsPDF("l", "mm", "a4");
  const box = contentBox(doc);
  let y = drawTitleBand(doc, TITLE) + 6;

  doc.setTextColor(51, 65, 85);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(`Periudha: ${meta.period}`, box.left, y);
  doc.text(
    capped ? `Rreshta: ${count(PDF_ROW_LIMIT)} nga ${count(rows.length)}` : `Rreshta: ${count(rows.length)}`,
    box.left + 135,
    y
  );
  doc.text(`Gjeneruar: ${new Date().toLocaleString("sq-AL")}`, box.right, y, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.4);
  const notes = [meta.filtersText, rows.some(isTjeterEntry) ? TJETER_NOTE : "", meta.filters.produkti_id ? "" : AVERAGE_NOTE]
    .filter(Boolean)
    .flatMap(text => doc.splitTextToSize(text, box.width));
  y += 5;
  doc.text(notes, box.left, y);
  y += notes.length * 3.4;

  if (capped) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    const notice = doc.splitTextToSize(
      `Kujdes: tabela tregon ${count(PDF_ROW_LIMIT)} regjistrimet më të fundit nga ${count(rows.length)} që përputhen me filtrat. ` +
        `Totalet në fund të raportit llogariten për të gjitha ${count(rows.length)} regjistrimet. ` +
        "Të gjitha regjistrimet janë në eksportin Excel.",
      box.width - 8
    );
    const height = notice.length * 3.8 + 3;
    doc.setFillColor(254, 243, 199);
    doc.setDrawColor(217, 119, 6);
    doc.roundedRect(box.left, y, box.width, height, 1.5, 1.5, "FD");
    doc.setTextColor(146, 64, 14);
    doc.text(notice, box.left + 4, y + 4.5);
    y += height + 4;
  } else {
    y += 2;
  }

  const right = { halign: "right" };
  // The Diferenca line is red where Dalje is larger.
  const total = value => (value < 0 ? { ...right, textColor: [185, 28, 28] } : right);
  autoTable(doc, {
    startY: y,
    head: [HEADERS],
    body: printed.map(row => {
      const tjeter = isTjeterEntry(row);
      return [
        ...textCells(row),
        tjeter ? "—" : kg(row.sasia),
        money(row.shuma_leke),
        tjeter ? "—" : money(row.kosto_per_njesi)
      ];
    }),
    foot: [
      ...(capped
        ? [[{
            content: `Totalet për të gjitha ${count(rows.length)} regjistrimet që përputhen me filtrat, jo vetëm për ${count(PDF_ROW_LIMIT)} e printuara:`,
            colSpan: HEADERS.length,
            styles: { halign: "left", fontStyle: "bolditalic" }
          }]]
        : []),
      ...lines.map(line => [
        { content: line.label, colSpan: 6, styles: { halign: "left" } },
        { content: kg(line.sasia), styles: total(line.sasia) },
        { content: money(line.shuma), styles: total(line.shuma) },
        { content: line.average == null ? "—" : money(line.average), styles: right }
      ])
    ],
    showFoot: "lastPage",
    theme: "grid",
    margin: TABLE_MARGIN,
    styles: { fontSize: 6.8, cellPadding: 1.3, lineColor: [210, 214, 220], lineWidth: 0.1, overflow: "linebreak" },
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold", halign: "center" },
    footStyles: { fillColor: [219, 233, 246], textColor: [15, 23, 42], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 0: { cellWidth: 18 }, 6: right, 7: right, 8: right },
    didDrawPage: data => {
      if (data.pageNumber > 1) drawContinuationBand(doc, TITLE);
      // Every page repeats the limit, so a loose page still says it's not the full list.
      drawFooter(
        doc,
        `PROMAN • Faqja ${doc.internal.getNumberOfPages()}`,
        capped ? `${count(PDF_ROW_LIMIT)} regjistrimet më të fundit nga ${count(rows.length)}; totalet për të gjitha` : ""
      );
    }
  });

  doc.save(`${meta.fileBase}.pdf`);
}

/**
 * @param rows  every entry matching the filters, oldest first
 * @param meta  { period, filtersText, filters, fileBase }
 */
export async function exportEntriesExcel(rows, meta) {
  const lines = totalsLines(entryTotals(rows), meta.filters);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Të dhëna");
  const columns = HEADERS.length;
  const border = color => ({
    top: { style: "thin", color: { argb: color } },
    left: { style: "thin", color: { argb: color } },
    bottom: { style: "thin", color: { argb: color } },
    right: { style: "thin", color: { argb: color } }
  });
  const formatNumbers = row => {
    [7, 8, 9].forEach(col => {
      const cell = row.getCell(col);
      cell.numFmt = col === 7 ? "#,##0.00#" : "#,##0.00";
      cell.alignment = { horizontal: "right", vertical: "middle" };
    });
  };

  const info = [
    TITLE,
    `Periudha: ${meta.period}   |   Rreshta: ${count(rows.length)}   |   Gjeneruar: ${new Date().toLocaleString("sq-AL")}`,
    meta.filtersText,
    ...(rows.some(isTjeterEntry) ? [TJETER_NOTE] : []),
    ...(meta.filters.produkti_id ? [] : [AVERAGE_NOTE])
  ];
  info.forEach((text, i) => {
    const row = sheet.addRow([text]);
    sheet.mergeCells(row.number, 1, row.number, columns);
    row.getCell(1).font = i === 0 ? { bold: true, size: 14, color: { argb: "0F172A" } } : { size: 10, color: { argb: "334155" } };
  });
  sheet.addRow([]);

  const header = sheet.addRow(HEADERS);
  header.height = 22;
  header.eachCell(cell => {
    cell.font = { bold: true, color: { argb: "FFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "0F172A" } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = border("CBD5E1");
  });
  sheet.views = [{ state: "frozen", ySplit: header.number }];

  for (const entry of rows) {
    const tjeter = isTjeterEntry(entry);
    const row = sheet.addRow([
      ...textCells(entry),
      tjeter ? "—" : Number(entry.sasia || 0),
      Number(entry.shuma_leke || 0),
      tjeter ? "—" : Number(entry.kosto_per_njesi || 0)
    ]);
    row.eachCell(cell => (cell.border = border("E2E8F0")));
    formatNumbers(row);
  }

  sheet.addRow([]);
  for (const line of lines) {
    const row = sheet.addRow([line.label, "", "", "", "", "", line.sasia, line.shuma, line.average ?? "—"]);
    sheet.mergeCells(row.number, 1, row.number, 6);
    row.eachCell(cell => {
      // The Diferenca line is red where Dalje is larger.
      const negative = typeof cell.value === "number" && cell.value < 0;
      cell.font = { bold: true, color: { argb: negative ? "B91C1C" : "0F172A" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "DBE9F6" } };
      cell.border = border("94A3B8");
    });
    formatNumbers(row);
  }

  [12, 16, 28, 14, 26, 14, 14, 18, 12].forEach((width, i) => (sheet.getColumn(i + 1).width = width));

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `${meta.fileBase}.xlsx`
  );
}
