import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { PRODUCT_COLUMNS } from "./produktet";
import { formatKg, formatMoney } from "./format";
import { TABLE_MARGIN, contentBox, drawContinuationBand, drawFooter, drawTitleBand } from "./pdfPage";

// Excel and PDF exports of the products page, with the rows as filtered and sorted on screen.
// The personal version has every column of the table. The version for sharing with others keeps
// only the kilograms: no buying or selling prices and no lekë amounts (`shared` in PRODUCT_COLUMNS).

const TITLE = "PRODUKTET";

const count = n => n.toLocaleString("en-US");
const columnsFor = shared => PRODUCT_COLUMNS.filter(column => !shared || column.shared);
const totalLabel = n => `Totali (${count(n)} ${n === 1 ? "produkt" : "produkte"})`;

// A value as the PDF prints it; kg and lekë say so in their headers, and "—" is nothing to show.
function show(column, value) {
  if (value == null) return "—";
  if (column.format === "text") return String(value);
  return column.format === "kg" ? formatKg(value) : formatMoney(value);
}

// Red where a value is negative, and green for a profit in Totali, as on the page.
const isProfit = (column, value) => column.key === "totali" && value > 0;

/**
 * @param rows    the products as shown on screen
 * @param totals  productTotals(rows)
 * @param meta    { period, filtersText, shared, fileBase }
 */
export function exportProductsPdf(rows, totals, meta) {
  const columns = columnsFor(meta.shared);
  const doc = new jsPDF("l", "mm", "a4");
  const box = contentBox(doc);
  let y = drawTitleBand(doc, TITLE) + 6;

  doc.setTextColor(51, 65, 85);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(`Periudha: ${meta.period}`, box.left, y);
  doc.text(`Produkte: ${count(rows.length)}`, box.left + 135, y);
  doc.text(`Gjeneruar: ${new Date().toLocaleString("sq-AL")}`, box.right, y, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.4);
  const notes = doc.splitTextToSize(meta.filtersText, box.width);
  y += 5;
  doc.text(notes, box.left, y);
  y += notes.length * 3.4 + 2;

  const right = { halign: "right" };
  const style = (column, value) =>
    column.format === "text"
      ? {}
      : value < 0
        ? { ...right, textColor: [185, 28, 28] }
        : isProfit(column, value)
          ? { ...right, textColor: [21, 128, 61] }
          : right;

  // The shared version has few columns, so it gets a table of its own width, not the whole page.
  const columnStyles = Object.fromEntries(
    columns.map((column, i) => [
      i,
      meta.shared ? { cellWidth: i === 0 ? 80 : 30, ...(i === 0 ? {} : right) } : column.format === "text" ? {} : right
    ])
  );

  autoTable(doc, {
    startY: y,
    head: [columns.map(column => column.label)],
    body: rows.map(row =>
      columns.map(column => ({ content: show(column, row[column.key]), styles: style(column, row[column.key]) }))
    ),
    foot: [
      columns.map((column, i) =>
        i === 0
          ? { content: totalLabel(totals.count), styles: { halign: "left" } }
          : { content: show(column, totals[column.key]), styles: style(column, totals[column.key]) }
      )
    ],
    showFoot: "lastPage",
    theme: "grid",
    margin: TABLE_MARGIN,
    tableWidth: meta.shared ? 80 + 30 * (columns.length - 1) : "auto",
    styles: { fontSize: 6.8, cellPadding: 1.3, lineColor: [210, 214, 220], lineWidth: 0.1, overflow: "linebreak" },
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold", halign: "center" },
    footStyles: { fillColor: [219, 233, 246], textColor: [15, 23, 42], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles,
    didDrawPage: data => {
      if (data.pageNumber > 1) drawContinuationBand(doc, TITLE);
      drawFooter(doc, `PROMAN • Faqja ${doc.internal.getNumberOfPages()}`, "");
    }
  });

  doc.save(`${meta.fileBase}.pdf`);
}

/**
 * @param rows    the products as shown on screen
 * @param totals  productTotals(rows)
 * @param meta    as for exportProductsPdf
 */
export async function exportProductsExcel(rows, totals, meta) {
  const columns = columnsFor(meta.shared);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Produktet");
  const border = color => ({
    top: { style: "thin", color: { argb: color } },
    left: { style: "thin", color: { argb: color } },
    bottom: { style: "thin", color: { argb: color } },
    right: { style: "thin", color: { argb: color } }
  });
  // Numbers sit on the right with their format; red where negative, green for a profit in Totali.
  const formatCell = (cell, column, bold) => {
    const color =
      typeof cell.value === "number" && cell.value < 0
        ? "B91C1C"
        : isProfit(column, cell.value)
          ? "15803D"
          : bold
            ? "0F172A"
            : null;
    if (color || bold) cell.font = { bold, ...(color ? { color: { argb: color } } : {}) };
    if (column.format === "text") return;
    cell.numFmt = column.format === "kg" ? "#,##0.00#" : "#,##0.00";
    cell.alignment = { horizontal: "right", vertical: "middle" };
  };

  const info = [
    TITLE,
    `Periudha: ${meta.period}   |   Produkte: ${count(rows.length)}   |   Gjeneruar: ${new Date().toLocaleString("sq-AL")}`,
    meta.filtersText
  ];
  info.forEach((text, i) => {
    const row = sheet.addRow([text]);
    sheet.mergeCells(row.number, 1, row.number, columns.length);
    row.getCell(1).font = i === 0 ? { bold: true, size: 14, color: { argb: "0F172A" } } : { size: 10, color: { argb: "334155" } };
  });
  sheet.addRow([]);

  const header = sheet.addRow(columns.map(column => column.label));
  header.height = 22;
  header.eachCell(cell => {
    cell.font = { bold: true, color: { argb: "FFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "0F172A" } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = border("CBD5E1");
  });
  sheet.views = [{ state: "frozen", ySplit: header.number }];

  for (const product of rows) {
    const row = sheet.addRow(columns.map(column => product[column.key] ?? "—"));
    row.eachCell((cell, col) => {
      cell.border = border("E2E8F0");
      formatCell(cell, columns[col - 1], false);
    });
  }

  sheet.addRow([]);
  const footer = sheet.addRow(columns.map((column, i) => (i === 0 ? totalLabel(totals.count) : totals[column.key] ?? "—")));
  footer.eachCell((cell, col) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "DBE9F6" } };
    cell.border = border("94A3B8");
    formatCell(cell, columns[col - 1], true);
  });

  columns.forEach((column, i) => (sheet.getColumn(i + 1).width = column.format === "text" ? 32 : 18));

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `${meta.fileBase}.xlsx`
  );
}
