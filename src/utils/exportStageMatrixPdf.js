import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

function cell(v) {
  return v === null || v === undefined || v === "" ? "—" : String(v);
}

function fmtWhen(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d);
  const get = (t) => parts.find((p) => p.type === t)?.value || "";
  return `${get("day")}-${get("month")}-${get("year")} ${get("hour")}:${get("minute")}`;
}

/**
 * @param {Array} rows              from buildStageMatrixReport
 * @param {string[]} sampleStageNames
 * @param {string[]} quotationStageNames
 * @param {string|null} selectedUser  employee name filter, or null = all
 */
export function exportStageMatrixPdf(rows, sampleStageNames, quotationStageNames, selectedUser) {
  const filteredRows = selectedUser
    ? rows.filter((r) => r.touchedBy.includes(selectedUser))
    : rows;

  const columns = [
    { header: "Company / Enquiry", key: "__enquiry" },
    ...sampleStageNames.map((s) => ({ header: s, key: `sample:${s}` })),
    { header: "Sample Rejected", key: "sample:__rejected" },
    ...quotationStageNames.map((s) => ({ header: s, key: `quotation:${s}` })),
    { header: "Quotation Rejected", key: "quotation:__rejected" },
  ];

  const body = filteredRows.map((r) => {
    const row = [`${r.company}\n${r.enquiryDetail}`];

    sampleStageNames.forEach((s) => {
      const hit = r.sampleStages[s];
      row.push(hit ? `${fmtWhen(hit.timestamp)}\n${hit.by || ""}` : "—");
    });
    row.push(r.sampleRejected ? `${fmtWhen(r.sampleRejected.timestamp)}\n${r.sampleRejected.by || ""}` : "—");

    quotationStageNames.forEach((s) => {
      const hit = r.quotationStages[s];
      row.push(hit ? `${fmtWhen(hit.timestamp)}\n${hit.by || ""}` : "—");
    });
    row.push(r.quotationRejected ? `${fmtWhen(r.quotationRejected.timestamp)}\n${r.quotationRejected.by || ""}` : "—");

    return row;
  });

  // ── Equal-width columns, page sized to fit them ──────────────────────
  // Company/enquiry column gets more room (it holds two lines of prose);
  // every stage/rejected column gets the same fixed width as each other,
  // since they only ever hold a short date/time + a name.
  const FIRST_COL_WIDTH = 150;
  const STAGE_COL_WIDTH = 95;
  const marginX = 24;
  const stageColCount = columns.length - 1; // all except company/enquiry

  const pageWidth = marginX * 2 + FIRST_COL_WIDTH + stageColCount * STAGE_COL_WIDTH;
  const pageHeight = 842; // A4 height in pt — table still paginates vertically as normal

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: [pageWidth, pageHeight],
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(30, 41, 59);
  doc.text("Stage Matrix", marginX, 36);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  const generatedOn = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
  doc.text(`Generated: ${generatedOn} IST`, marginX, 52);
  doc.text(`Employee filter: ${selectedUser || "All Employees"}`, marginX, 66);
  doc.text(`Total enquiries: ${filteredRows.length}`, pageWidth - marginX, 52, { align: "right" });

  // Build columnStyles: col 0 = FIRST_COL_WIDTH, every other index = STAGE_COL_WIDTH
  const columnStyles = { 0: { cellWidth: FIRST_COL_WIDTH, fontStyle: "bold" } };
  for (let i = 1; i < columns.length; i++) {
    columnStyles[i] = { cellWidth: STAGE_COL_WIDTH };
  }

  autoTable(doc, {
    startY: 80,
    margin: { left: marginX, right: marginX },
    head: [columns.map((c) => c.header)],
    body,
    tableWidth: pageWidth - marginX * 2, // pin total width so equal cellWidths aren't rescaled
    styles: {
      font: "helvetica",
      fontSize: 7,
      cellPadding: 4,
      overflow: "linebreak",
      valign: "top",
      halign: "center",
      lineColor: [226, 232, 240],
      lineWidth: 0.5,
      textColor: [51, 65, 85],
    },
    headStyles: {
      fillColor: [79, 70, 229],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 7.5,
      halign: "center",
    },
    columnStyles: {
      ...columnStyles,
      0: { ...columnStyles[0], halign: "left" }, // company/enquiry reads better left-aligned
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    theme: "grid",
    didDrawPage: () => {
      const pageCount = doc.internal.getNumberOfPages();
      const pageCurrent = doc.internal.getCurrentPageInfo().pageNumber;
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(`Page ${pageCurrent} of ${pageCount}`, pageWidth - marginX, pageHeight - 14, { align: "right" });
      doc.text("Confidential — Internal Use Only", marginX, pageHeight - 14);
    },
  });

  if (filteredRows.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.setTextColor(148, 163, 184);
    doc.text("No records match the current filter.", marginX, 100);
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const userPart = selectedUser ? `-${selectedUser.replace(/\s+/g, "_")}` : "";
  doc.save(`Stage_Matrix${userPart}-${stamp}.pdf`);
}