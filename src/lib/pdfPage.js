// Page layout shared by the PDF exports (A4 landscape).
// Everything is drawn at least MARGIN mm from the paper edge, so printers with wide
// unprintable borders don't cut anything off.
export const MARGIN = 15;

const TITLE_BAND_HEIGHT = 16;
const CONTINUATION_BAND_HEIGHT = 9;

// autoTable margins: on pages after the first the table starts below the continuation band,
// and on every page it stops above the footer.
export const TABLE_MARGIN = {
  top: MARGIN + CONTINUATION_BAND_HEIGHT + 4,
  right: MARGIN,
  bottom: MARGIN + 6,
  left: MARGIN
};

// The printable area inside the margins.
export function contentBox(doc) {
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  return { left: MARGIN, right: width - MARGIN, top: MARGIN, bottom: height - MARGIN, width: width - 2 * MARGIN };
}

// Dark band with "PROMAN" and the report title at the top of the first page.
// Returns the y just below it.
export function drawTitleBand(doc, title) {
  const box = contentBox(doc);
  doc.setFillColor(15, 23, 42);
  doc.rect(box.left, box.top, box.width, TITLE_BAND_HEIGHT, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("PROMAN", box.left + 4, box.top + 6.5);
  doc.setFontSize(10);
  doc.text(title, box.left + 4, box.top + 12.5);
  return box.top + TITLE_BAND_HEIGHT;
}

// Slimmer band at the top of every page after the first.
export function drawContinuationBand(doc, title) {
  const box = contentBox(doc);
  doc.setFillColor(15, 23, 42);
  doc.rect(box.left, box.top, box.width, CONTINUATION_BAND_HEIGHT, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(`PROMAN — ${title}`, box.left + 4, box.top + 6);
}

// Footer line just inside the bottom margin.
export function drawFooter(doc, leftText, rightText) {
  const box = contentBox(doc);
  doc.setTextColor(100, 116, 139);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  if (leftText) doc.text(leftText, box.left, box.bottom - 1);
  if (rightText) doc.text(rightText, box.right, box.bottom - 1, { align: "right" });
}
