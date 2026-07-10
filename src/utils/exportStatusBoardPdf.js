import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const SECTION_TITLES = {
  leadStageLog: "Lead Stage Report",
  enquiryStatusLog: "Enquiry Status Report",
  sampleStatusLog: "Sample Status Report",
  quotationStatusLog: "Quotation Status Report",
};

const SECTION_COLUMNS = {
  leadStageLog: [
    { header: "Company", key: "company" },
    { header: "Status", key: "status" },
    { header: "Next Action", key: "nextAction" },
    { header: "Due Date", key: "nextActionDate" },
    { header: "Remark", key: "remark" },
    { header: "Updated By", key: "updatedBy" },
    { header: "Date/Time", key: "when" },
  ],
  enquiryStatusLog: [
    { header: "Company", key: "company" },
    { header: "Product", key: "productLabel" },
    { header: "Status", key: "status" },
    { header: "Contact Type", key: "contactType" },
    { header: "Follow-up Date", key: "nextActionDate" },
    { header: "Note", key: "note" },
    { header: "Updated By", key: "updatedBy" },
    { header: "Date/Time", key: "when" },
  ],
  sampleStatusLog: [
    { header: "Company", key: "company" },
    { header: "Product", key: "productLabel" },
    { header: "Stage", key: "stage" },
    { header: "Result", key: "result" },
    { header: "Priority", key: "priority" },
    { header: "Follow-up", key: "followUp" },
    { header: "Notes", key: "notes" },
    { header: "Updated By", key: "updatedBy" },
    { header: "Date/Time", key: "when" },
  ],
  quotationStatusLog: [
    { header: "Company", key: "company" },
    { header: "Product", key: "productLabel" },
    { header: "Stage", key: "stage" },
    { header: "Result", key: "result" },
    { header: "Priority", key: "priority" },
    { header: "Follow-up", key: "followUp" },
    { header: "Notes", key: "notes" },
    { header: "Updated By", key: "updatedBy" },
    { header: "Date/Time", key: "when" },
  ],
};

function cell(v) {
  return v === null || v === undefined || v === "" ? "—" : String(v);
}

/**
 * @param {string} section        one of leadStageLog/enquiryStatusLog/sampleStatusLog/quotationStatusLog
 * @param {Array}  flatStatusGroups  [{ status, entries, count }] — already filtered by selectedUser
 * @param {string|null} selectedUser
 */
export function exportStatusBoardPdf(section, flatStatusGroups, selectedUser) {
  const title = SECTION_TITLES[section] || "Status Report";
  const columns = SECTION_COLUMNS[section];

  // Flatten grouped-by-status entries into rows. Each row keeps a hidden
  // `__status` tag (not rendered as a column) purely so we can detect,
  // while drawing, when one status group ends and the next begins.
  const rows = [];
  flatStatusGroups.forEach((sg) => {
    sg.entries.forEach((e) => {
      const when = e.dateLabel && e.timeLabel ? `${e.dateLabel} ${e.timeLabel}` : (e.dateLabel || "");
      const row = { __status: sg.status };
      columns.forEach((c) => {
        row[c.key] = c.key === "status" || c.key === "stage" ? sg.status : cell(e[c.key] ?? (c.key === "when" ? when : e[c.key]));
      });
      row.when = when;
      rows.push(row);
    });
  });

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 32;

  // ── Header ──────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(30, 41, 59); // slate-800
  doc.text(title, marginX, 40);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139); // slate-500
  const generatedOn = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
  doc.text(`Generated: ${generatedOn} IST`, marginX, 56);
  doc.text(`Employee filter: ${selectedUser || "All Employees"}`, marginX, 70);
  doc.text(`Total records: ${rows.length}`, pageWidth - marginX, 56, { align: "right" });

  // ── Table ───────────────────────────────────────────────────────────
  autoTable(doc, {
    startY: 84,
    margin: { left: marginX, right: marginX },
    head: [columns.map((c) => c.header)],
    body: rows.map((r) => columns.map((c) => cell(r[c.key]))),
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      cellPadding: 6,
      overflow: "linebreak",
      valign: "top",
      lineColor: [226, 232, 240], // slate-200
      lineWidth: 0.5,
      textColor: [51, 65, 85], // slate-700
    },
    headStyles: {
      fillColor: [79, 70, 229], // indigo-600
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8.5,
    },
    alternateRowStyles: { fillColor: [248, 250, 252] }, // slate-50
    theme: "grid",
    // Manually draw a thick dark-grey line across the full row width
    // whenever a new status group starts. Drawn directly on the canvas
    // (not via cell border styles) so it renders reliably regardless of
    // jspdf-autotable version quirks with per-side border objects.
    didDrawCell: (data) => {
        if (data.section !== "body") return;
        if (data.column.index !== 0) return; // only need to trigger once per row

        const row = rows[data.row.index];
        const prevRow = rows[data.row.index - 1];
        if (!row || !prevRow) return;
        if (prevRow.__status === row.__status) return;

        const y = data.cell.y; // top edge of this row
        if (typeof y !== "number" || Number.isNaN(y)) return;

        doc.setDrawColor(55, 65, 81); // gray-700 — thick dark divider
        doc.setLineWidth(1.75);
        doc.line(marginX, y, pageWidth - marginX, y);
    },
    didDrawPage: () => {
      const pageCount = doc.internal.getNumberOfPages();
      const pageCurrent = doc.internal.getCurrentPageInfo().pageNumber;
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text(
        `Page ${pageCurrent} of ${pageCount}`,
        pageWidth - marginX,
        doc.internal.pageSize.getHeight() - 16,
        { align: "right" }
      );
      doc.text("Confidential — Internal Use Only", marginX, doc.internal.pageSize.getHeight() - 16);
    },
  });

  if (rows.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.setTextColor(148, 163, 184);
    doc.text("No records match the current filter.", marginX, 100);
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const userPart = selectedUser ? `-${selectedUser.replace(/\s+/g, "_")}` : "";
  doc.save(`${title.replace(/\s+/g, "_")}${userPart}-${stamp}.pdf`);
}