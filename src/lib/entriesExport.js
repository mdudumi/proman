import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { entryTotals, isMoneyIn, isTjeterEntry, totalsLines } from "./ditorEntries";
import { SIGNED_MONEY_FORMAT, formatKg as kg, formatMoney as money, plus } from "./format";
import { TABLE_MARGIN, contentBox, drawContinuationBand, drawFooter, drawTitleBand } from "./pdfPage";

// Excel and PDF exports of the dashboard entries that match the filters.
// Excel always gets every row. A PDF prints at most PDF_ROW_LIMIT rows (about 35 pages), the
// latest ones, but its totals always cover every matching row, and it says so on the page.
export const PDF_ROW_LIMIT = 1000;

const TITLE = "TË DHËNA TË REGJISTRUARA";
const HEADERS = ["Data", "Kategoria", "Produkti", "Monedha", "Blerësi/Shitësi", "Veprimi", "Sasia (kg)", "Kosto/kg", "Shuma (lekë)"];
const TJETER_NOTE =
  "Regjistrimet e kategorisë Tjetër (lëvizje parash) janë pa sasi (kg) dhe pa kosto për kg. Në totale kanë rreshtin e tyre: " +
  "Hyrje është para e arkëtuar (+), Dalje para e paguar (-).";
// The kg of the Diferenca line in Excel, with its sign, as SIGNED_MONEY_FORMAT is for lekë.
const SIGNED_KG_FORMAT = "+#,##0.00#;-#,##0.00#;0.00";
// Without a product filter the totals mix products, so they have no cost per kg, and the
// difference line no kg (totalsLines).
function productNote(lines, selected) {
  const when = selected ? "të zgjedhurat janë të një produkti" : "filtrohet sipas një produkti";
  return lines.some(line => line.difference)
    ? `Kosto/kg dhe diferenca në kg shfaqen në totale vetëm kur ${when}.`
    : `Kosto/kg në totale shfaqet vetëm kur ${when}.`;
}

const count = n => n.toLocaleString("en-US");

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
 * @param rows  every entry matching the filters, or the selected ones, oldest first
 * @param meta  { period, filtersText, filters, fileBase, selected }: `selected` when the rows are
 *              the ones selected in the table, so the totals say so
 */
export function exportEntriesPdf(rows, meta) {
  const capped = rows.length > PDF_ROW_LIMIT;
  const printed = capped ? rows.slice(-PDF_ROW_LIMIT) : rows;
  const lines = totalsLines(entryTotals(rows), meta.filters, { selected: meta.selected });

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
  const notes = [meta.filtersText, rows.some(isTjeterEntry) ? TJETER_NOTE : "", meta.filters.produkti_id ? "" : productNote(lines, meta.selected)]
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
  // The signed lines (Tjetër, Diferenca) are red where they're negative: lekë where more was
  // spent than earned, kg where more went out than came in.
  const total = value => (value < 0 ? { ...right, textColor: [185, 28, 28] } : right);
  // …and their lekë green for a profit.
  const totalMoney = line => (line.signed && line.shuma > 0 ? { ...right, textColor: [21, 128, 61] } : total(line.shuma));
  // A "+" before the signed lines' gains and before money that came in, as on the page.
  const lineKg = line => (line.signed ? plus(line.sasia) : "") + kg(line.sasia);
  const lineMoney = line => (line.signed || line.moneyIn ? plus(line.shuma) : "") + money(line.shuma);
  autoTable(doc, {
    startY: y,
    head: [HEADERS],
    body: printed.map(row => {
      const tjeter = isTjeterEntry(row);
      return [
        ...textCells(row),
        tjeter ? "—" : kg(row.sasia),
        tjeter ? "—" : money(row.kosto_per_njesi),
        (isMoneyIn(row) ? plus(row.shuma_leke) : "") + money(row.shuma_leke)
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
        { content: line.sasia == null ? "—" : lineKg(line), styles: total(line.sasia) },
        { content: line.average == null ? "—" : money(line.average), styles: right },
        { content: lineMoney(line), styles: totalMoney(line) }
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
 * @param rows  every entry matching the filters, or the selected ones, oldest first
 * @param meta  as for exportEntriesPdf
 */
export async function exportEntriesExcel(rows, meta) {
  const lines = totalsLines(entryTotals(rows), meta.filters, { selected: meta.selected });
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Të dhëna");
  const columns = HEADERS.length;
  const border = color => ({
    top: { style: "thin", color: { argb: color } },
    left: { style: "thin", color: { argb: color } },
    bottom: { style: "thin", color: { argb: color } },
    right: { style: "thin", color: { argb: color } }
  });
  // Sasia, Kosto/kg and Shuma sit on the right. A "+" goes before money that came in and the
  // signed lines' gains, as in the PDF, through the number format, so the cells stay numbers.
  const formatNumbers = (row, { signedKg = false, signedMoney = false } = {}) => {
    [7, 8, 9].forEach(col => {
      const cell = row.getCell(col);
      cell.numFmt =
        col === 7
          ? signedKg ? SIGNED_KG_FORMAT : "#,##0.00#"
          : col === 9 && signedMoney ? SIGNED_MONEY_FORMAT : "#,##0.00";
      cell.alignment = { horizontal: "right", vertical: "middle" };
    });
  };

  const info = [
    TITLE,
    `Periudha: ${meta.period}   |   Rreshta: ${count(rows.length)}   |   Gjeneruar: ${new Date().toLocaleString("sq-AL")}`,
    meta.filtersText,
    ...(rows.some(isTjeterEntry) ? [TJETER_NOTE] : []),
    ...(meta.filters.produkti_id ? [] : [productNote(lines, meta.selected)])
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
      tjeter ? "—" : Number(entry.kosto_per_njesi || 0),
      Number(entry.shuma_leke || 0)
    ]);
    row.eachCell(cell => (cell.border = border("E2E8F0")));
    formatNumbers(row, { signedMoney: isMoneyIn(entry) });
  }

  sheet.addRow([]);
  for (const line of lines) {
    const row = sheet.addRow([line.label, "", "", "", "", "", line.sasia ?? "—", line.average ?? "—", line.shuma]);
    sheet.mergeCells(row.number, 1, row.number, 6);
    row.eachCell(cell => {
      // The signed lines (Tjetër, Diferenca) are red where they're negative (as in the PDF), and
      // their lekë (column 9) green for a profit.
      const negative = typeof cell.value === "number" && cell.value < 0;
      const profit = line.signed && cell.col === 9 && cell.value > 0;
      cell.font = { bold: true, color: { argb: negative ? "B91C1C" : profit ? "15803D" : "0F172A" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "DBE9F6" } };
      cell.border = border("94A3B8");
    });
    formatNumbers(row, { signedKg: line.signed, signedMoney: line.signed || line.moneyIn });
  }

  [12, 16, 28, 14, 26, 14, 14, 12, 18].forEach((width, i) => (sheet.getColumn(i + 1).width = width));

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `${meta.fileBase}.xlsx`
  );
}
