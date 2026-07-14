import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function exportPendingTasksPdf(rows, selectedUser) {
  const filtered = selectedUser ? rows.filter((r) => r.createdById === selectedUser) : rows;
  const columns = [
    "Company / Enquiry", "Status", "Last Sample Stage", "Last Quotation Stage",
    "New Sample Stage", "New Quotation Stage", "New Follow-up", "Remark",
  ];
  const body = filtered.map((r) => [
    `${r.company}\n${r.enquiryDetail}\n(Due: ${r.dueDateFmt})`,
    r.statusLabel,
    r.lastSampleStage, r.lastQuotationStage,
    r.newSampleStage, r.newQuotationStage,
    r.newFollowup, r.remark,
  ]);
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(30, 41, 59);
  doc.text("Pending Tasks — Today & Overdue", 24, 36);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`Employee filter: ${selectedUser || "All Employees"}`, 24, 54);
  doc.text(`Total tasks: ${filtered.length}`, 771, 54, { align: "right" });

  autoTable(doc, {
    startY: 66,
    margin: { left: 24, right: 24 },
    head: [columns],
    body,
    styles: { font: "helvetica", fontSize: 7.5, cellPadding: 4, overflow: "linebreak", valign: "top", lineColor: [226, 232, 240], lineWidth: 0.5, textColor: [51, 65, 85] },
    headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    theme: "grid",
    tableWidth: 794,
    columnStyles: {
      0: { cellWidth: 150 },
      1: { cellWidth: 55, halign: "center" },
      2: { cellWidth: 85 },
      3: { cellWidth: 85 },
      4: { cellWidth: 110 },
      5: { cellWidth: 110 },
      6: { cellWidth: 120 },
      7: { cellWidth: 79 },
    },
  });

  const stamp = new Date().toISOString().slice(0, 10);
  const userPart = selectedUser ? `-${selectedUser.replace(/\s+/g, "_")}` : "";
  doc.save(`Pending_Tasks${userPart}-${stamp}.pdf`);
}