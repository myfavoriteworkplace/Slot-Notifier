import { jsPDF } from "@/lib/jspdf-stub";
import autoTable from "@/lib/jspdf-stub";
import { format } from "date-fns";
import type { PatientBill } from "@shared/schema";
import type { BookingWithSlot } from "./clinic-constants";
import { notify } from "@/lib/notify";

// ── Shared types ──────────────────────────────────────────────────────────────

export type BillingService = {
  description: string;
  amount: string;
  category?: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  qty?: number;
  unitPrice?: number;
};

export type BillingDetails = {
  patientName: string; patientPhone: string; patientEmail: string;
  clinicName: string; clinicAddress: string; clinicPhone: string; clinicEmail: string;
  receiptNumber: string; date: string; discount: string; tax: string;
  paymentMethod: string; transactionId: string; remarks: string;
  paymentStatus: "paid" | "pending" | "partial";
  existingBillId: number | undefined; printOnly: boolean;
  visitId: string; doctorName: string;
  services: BillingService[];
};

export type ClinicInfo = {
  name?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
};

// ── Shared palette ────────────────────────────────────────────────────────────

const indigoDark: [number, number, number]  = [8,   80,  65];
const magenta:    [number, number, number]  = [29,  158, 117];
const indigoMid:  [number, number, number]  = [15,  155, 110];
const lightBg:    [number, number, number]  = [225, 245, 238];
const metaBg:     [number, number, number]  = [209, 237, 226];
const totalRowBg: [number, number, number]  = [193, 229, 215];
const textDark:   [number, number, number]  = [8,   40,  32];
const textMid:    [number, number, number]  = [50,  100, 80];
const textLight:  [number, number, number]  = [150, 148, 180];
const white:      [number, number, number]  = [255, 255, 255];

// ── Shared helpers ────────────────────────────────────────────────────────────

function drawHeader(doc: jsPDF, pageWidth: number) {
  doc.setFillColor(...indigoDark);
  doc.rect(0, 0, pageWidth * 0.55, 7, "F");
  doc.setFillColor(...magenta);
  doc.rect(pageWidth * 0.55, 0, pageWidth * 0.45, 7, "F");
}

function drawFooter(doc: jsPDF, pageWidth: number, pageHeight: number) {
  doc.setFillColor(...indigoDark);
  doc.rect(0, pageHeight - 8, pageWidth * 0.55, 8, "F");
  doc.setFillColor(...magenta);
  doc.rect(pageWidth * 0.55, pageHeight - 8, pageWidth * 0.45, 8, "F");
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...white);
  doc.text("Powered by BookMySlot", pageWidth / 2, pageHeight - 3, { align: "center" });
}

function drawMedicalCross(doc: jsPDF, x: number, y: number) {
  const cs = 4.5, cw = 1.4;
  doc.setFillColor(...indigoMid);
  doc.rect(x + (cs - cw) / 2, y,                  cw, cs, "F");
  doc.rect(x,                  y + (cs - cw) / 2,  cs, cw, "F");
}

// ── Public: QR util ───────────────────────────────────────────────────────────

export function buildQRDataUrl(_text: string): string {
  return "";
}

// ── Public: receipt PDF (booking flow) ───────────────────────────────────────

export function generateReceiptPDF(details: BillingDetails): void {
  const doc = new jsPDF();
  const pageWidth  = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  drawHeader(doc, pageWidth);
  drawMedicalCross(doc, margin, 12);

  // Clinic name + subtitle
  const nameX = margin + 4.5 + 3;
  doc.setFontSize(19); doc.setFont("helvetica", "bold"); doc.setTextColor(...textDark);
  doc.text(details.clinicName || "Clinic", nameX, 20);
  doc.setFontSize(8.5); doc.setFont("helvetica", "normal"); doc.setTextColor(...indigoMid);
  doc.text("Medical Services Receipt", nameX, 27);

  // Header right: address / phone / email
  const rightX = pageWidth - margin;
  const rightColWidth = pageWidth * 0.42;
  let contactY = 11;
  doc.setFontSize(7.5); doc.setFont("helvetica", "normal"); doc.setTextColor(...textMid);
  if (details.clinicAddress) {
    doc.splitTextToSize(details.clinicAddress, rightColWidth).forEach((line: string) => {
      doc.text(line, rightX, contactY, { align: "right" }); contactY += 4.2;
    });
  }
  if (details.clinicPhone) { doc.text(`Tel: ${details.clinicPhone}`, rightX, contactY, { align: "right" }); contactY += 4.2; }
  if (details.clinicEmail) { doc.text(details.clinicEmail, rightX, contactY, { align: "right" }); }

  // Divider
  doc.setDrawColor(...indigoDark); doc.setLineWidth(0.5);
  doc.line(margin, 33, pageWidth - margin, 33);

  // 2-row meta band
  const metaY = 34, metaH = 17;
  doc.setFillColor(...metaBg);
  doc.rect(margin, metaY, pageWidth - margin * 2, metaH, "F");

  const metaRow1Y = metaY + 5.5;
  doc.setFontSize(7.5); doc.setFont("helvetica", "normal"); doc.setTextColor(...textMid);
  doc.text(`Receipt #  ${details.receiptNumber}`, margin + 4, metaRow1Y);
  const midParts = [
    details.visitId   ? `Visit ID: ${details.visitId}` : "",
    details.doctorName ? `Dr. ${details.doctorName}`   : "",
  ].filter(Boolean);
  if (midParts.length) doc.text(midParts.join("   |   "), pageWidth / 2, metaRow1Y, { align: "center" });
  doc.setFont("helvetica", "bold"); doc.setTextColor(...indigoDark);
  doc.text(`Date: ${details.date}`, rightX - 4, metaRow1Y, { align: "right" });

  const metaRow2Y = metaY + 12.5;
  doc.setFont("helvetica", "normal"); doc.setTextColor(...textMid);
  doc.text(`Payment Mode:  ${details.paymentMethod || "Cash"}`, margin + 4, metaRow2Y);
  const statusRgb: [number, number, number] =
    details.paymentStatus === "paid"    ? [22, 163, 74]  :
    details.paymentStatus === "partial" ? [37,  99, 235] : [217, 119, 6];
  const statusLabel =
    details.paymentStatus === "paid"    ? "Paid" :
    details.paymentStatus === "partial" ? "Partial" : "Pending";
  doc.setFont("helvetica", "bold"); doc.setTextColor(...statusRgb);
  doc.text(`Status: ${statusLabel}`, rightX - 4, metaRow2Y, { align: "right" });

  // Patient information table
  const patientBody: string[][] = [
    ["Name",             details.patientName],
    ["Phone",            details.patientPhone],
    ["Email",            details.patientEmail || "—"],
    ["Appointment Date", details.date],
  ];
  if (details.doctorName) patientBody.push(["Doctor", details.doctorName]);
  autoTable(doc, {
    startY: metaY + metaH + 4,
    head: [["Patient Information", ""]],
    body: patientBody,
    theme: "grid",
    headStyles: { fillColor: indigoDark, textColor: white, fontStyle: "bold", fontSize: 9, halign: "left",
                  cellPadding: { top: 2.5, bottom: 2.5, left: 5, right: 5 } },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 48, textColor: textDark, fillColor: lightBg, fontSize: 8,
           cellPadding: { top: 2.5, bottom: 2.5, left: 5, right: 5 } },
      1: { textColor: textMid, fontSize: 8, cellPadding: { top: 2.5, bottom: 2.5, left: 5, right: 5 } },
    },
    bodyStyles: { cellPadding: 2.5 },
    margin: { left: margin, right: margin },
  });

  // Split services: pharmacy vs. others
  const pharmItems   = details.services.filter(s => s.category === "Pharmacy");
  const serviceItems = details.services.filter(s => s.category !== "Pharmacy");
  let currentY = (doc as any).lastAutoTable.finalY + 5;

  if (pharmItems.length > 0) {
    autoTable(doc, {
      startY: currentY,
      head: [["Prescription Summary", "Dosage", "Qty", "Freq.", "Duration", "Price"]],
      body: pharmItems.map(s => [
        s.description, s.dosage || "—", String(s.qty ?? 1), s.frequency || "—", s.duration || "—",
        `₹${parseFloat(s.amount || "0").toFixed(2)}`,
      ]),
      theme: "grid",
      headStyles: { fillColor: indigoDark, textColor: white, fontStyle: "bold", fontSize: 8.5,
                    cellPadding: { top: 2.5, bottom: 2.5, left: 4, right: 4 } },
      columnStyles: {
        0: { textColor: textDark, fontSize: 8 },
        1: { textColor: textMid, fontSize: 8, cellWidth: 20 },
        2: { textColor: textMid, fontSize: 8, cellWidth: 12, halign: "center" },
        3: { textColor: textMid, fontSize: 8, cellWidth: 16, halign: "center" },
        4: { textColor: textMid, fontSize: 8, cellWidth: 18, halign: "center" },
        5: { halign: "right", textColor: textDark, fontSize: 8, cellWidth: 22 },
      },
      alternateRowStyles: { fillColor: [240, 250, 246] as [number, number, number] },
      bodyStyles: { cellPadding: { top: 2, bottom: 2, left: 4, right: 4 } },
      margin: { left: margin, right: margin },
    });
    currentY = (doc as any).lastAutoTable.finalY + 5;
  }

  if (serviceItems.length > 0) {
    autoTable(doc, {
      startY: currentY,
      head: [["Service Summary", "Category", "Amount"]],
      body: serviceItems.map(s => [s.description, s.category || "Consultation", `₹${parseFloat(s.amount || "0").toFixed(2)}`]),
      theme: "striped",
      headStyles: { fillColor: indigoDark, textColor: white, fontStyle: "bold", fontSize: 8.5,
                    cellPadding: { top: 2.5, bottom: 2.5, left: 5, right: 5 } },
      columnStyles: {
        0: { textColor: textDark, fontSize: 8, cellPadding: { top: 2.5, bottom: 2.5, left: 5, right: 5 } },
        1: { textColor: textMid,  fontSize: 8, cellWidth: 38, cellPadding: { top: 2.5, bottom: 2.5, left: 5, right: 5 } },
        2: { halign: "right", textColor: textDark, fontSize: 8, cellWidth: 32,
             cellPadding: { top: 2.5, bottom: 2.5, left: 5, right: 5 } },
      },
      alternateRowStyles: { fillColor: [248, 251, 249] as [number, number, number] },
      bodyStyles: { cellPadding: 2.5 },
      margin: { left: margin, right: margin },
    });
    currentY = (doc as any).lastAutoTable.finalY + 5;
  }

  // Totals
  const subtotal    = details.services.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const discountPct = parseFloat(details.discount) || 0;
  const taxPct      = parseFloat(details.tax) || 0;
  const discountAmt = subtotal * (discountPct / 100);
  const taxAmt      = (subtotal - discountAmt) * (taxPct / 100);
  const total       = subtotal - discountAmt + taxAmt;

  autoTable(doc, {
    startY: currentY,
    head: [],
    body: [
      ["Subtotal",                    `₹${subtotal.toFixed(2)}`],
      [`Discount (${discountPct}%)`,  `− ₹${discountAmt.toFixed(2)}`],
      [`Tax / GST (${taxPct}%)`,      `+ ₹${taxAmt.toFixed(2)}`],
      ["Total Amount Due",            `₹${total.toFixed(2)}`],
    ],
    theme: "grid",
    columnStyles: {
      0: { halign: "right", textColor: textMid,  fontSize: 8, cellWidth: 50,
           cellPadding: { top: 2.5, bottom: 2.5, left: 5, right: 5 } },
      1: { halign: "right", textColor: textDark, fontSize: 8, cellWidth: 36,
           cellPadding: { top: 2.5, bottom: 2.5, left: 5, right: 5 } },
    },
    bodyStyles: { cellPadding: 2.5 },
    willDrawCell: (data: any) => { if (data.row.index === 3 && data.section === "body") doc.setFillColor(...totalRowBg); },
    didDrawCell:  (data: any) => { if (data.row.index === 3 && data.section === "body") { doc.setFont("helvetica", "bold"); doc.setTextColor(...indigoDark); } },
    margin: { left: pageWidth / 2 + 3, right: margin },
  });

  // Payment details box
  const totalsEndY = (doc as any).lastAutoTable.finalY;
  const pmtBoxY = totalsEndY + 6;
  const pmtBoxW = pageWidth - margin * 2;
  const pmtBoxH = details.remarks ? 30 : 26;
  const qrSize  = pmtBoxH - 4;

  const qrPayload = `Receipt:${details.receiptNumber}|Clinic:${details.clinicName}|Patient:${details.patientName}|Total:${total.toFixed(2)}`;
  const qrDataUrl = buildQRDataUrl(qrPayload);

  doc.setFillColor(...lightBg);
  doc.setDrawColor(...indigoMid); doc.setLineWidth(0.3);
  doc.roundedRect(margin, pmtBoxY, pmtBoxW, pmtBoxH, 2.5, 2.5, "FD");

  doc.setFontSize(7);   doc.setFont("helvetica", "bold");   doc.setTextColor(...indigoMid);
  doc.text("PAYMENT DETAILS", margin + 5, pmtBoxY + 6);
  doc.setFontSize(10);  doc.setFont("helvetica", "bold");   doc.setTextColor(...textDark);
  doc.text(details.paymentMethod || "Cash", margin + 5, pmtBoxY + 14);

  if (details.transactionId) {
    doc.setFontSize(7.5); doc.setFont("helvetica", "normal"); doc.setTextColor(...textMid);
    doc.text(`TXN: ${details.transactionId}`, margin + 5, pmtBoxY + 21);
  }
  if (details.remarks) {
    doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(...textMid);
    const rl: string[] = doc.splitTextToSize(`Note: ${details.remarks}`, pmtBoxW - qrSize - 16);
    doc.text(rl, margin + 5, pmtBoxY + (details.transactionId ? 26 : 21));
  }

  doc.setFontSize(8.5); doc.setFont("helvetica", "bold"); doc.setTextColor(...statusRgb);
  doc.text(`✓ ${statusLabel}`, pageWidth / 2, pmtBoxY + 14, { align: "center" });

  if (qrDataUrl) {
    doc.addImage(qrDataUrl, "PNG", margin + pmtBoxW - qrSize - 2, pmtBoxY + (pmtBoxH - qrSize) / 2, qrSize, qrSize);
  }

  // Thank-you footer
  const finalY = pmtBoxY + pmtBoxH + 10;
  doc.setDrawColor(...indigoMid); doc.setLineWidth(0.3);
  doc.line(margin, finalY - 4, pageWidth - margin, finalY - 4);
  doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(...indigoMid);
  doc.text(`Thank you for choosing ${details.clinicName || "us"}!`, pageWidth / 2, finalY, { align: "center" });
  doc.setFontSize(6.5); doc.setFont("helvetica", "normal"); doc.setTextColor(...textLight);
  doc.text("This is a computer generated receipt and does not require a physical signature.", pageWidth / 2, finalY + 6, { align: "center" });

  drawFooter(doc, pageWidth, pageHeight);
  doc.save(`receipt_${details.patientName.replace(/\s+/g, "_")}_${format(new Date(), "yyyyMMdd")}.pdf`);
}

// ── Public: reprint PDF from existing bill record ─────────────────────────────

export function printBillFromRecord(
  bill: PatientBill,
  clinic: ClinicInfo,
  bookings: BookingWithSlot[],
): void {
  const doc = new jsPDF();
  const pageWidth  = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const clinicName = clinic?.name || "Clinic";
  const rightX = pageWidth - margin;
  const rightColWidth = pageWidth * 0.42;
  const billDate = bill.createdAt ? format(new Date(bill.createdAt), "PPP") : format(new Date(), "PPP");
  const linkedBooking = bookings?.find(b => b.id === (bill as any).bookingId);
  const doctorName = (linkedBooking as any)?.assignedDoctor || "";

  drawHeader(doc, pageWidth);
  drawMedicalCross(doc, margin, 12);

  const nameX = margin + 4.5 + 3;
  doc.setFontSize(19); doc.setFont("helvetica", "bold"); doc.setTextColor(...textDark);
  doc.text(clinicName, nameX, 20);
  doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(...indigoMid);
  doc.text("Caring for Your Smile", nameX, 27);

  let contactY = 11;
  doc.setFontSize(7.5); doc.setFont("helvetica", "normal"); doc.setTextColor(...textMid);
  if (clinic?.phone)   { doc.text(clinic.phone,   rightX, contactY, { align: "right" }); contactY += 4.2; }
  if (clinic?.email)   { doc.text(clinic.email,   rightX, contactY, { align: "right" }); contactY += 4.2; }
  if (clinic?.address) {
    doc.splitTextToSize(clinic.address, rightColWidth).forEach((l: string) => {
      doc.text(l, rightX, contactY, { align: "right" }); contactY += 4.2;
    });
  }

  doc.setDrawColor(...indigoDark); doc.setLineWidth(0.5);
  doc.line(margin, 33, pageWidth - margin, 33);

  const metaY = 34, metaH = 17;
  doc.setFillColor(...metaBg);
  doc.rect(margin, metaY, pageWidth - margin * 2, metaH, "F");

  const metaRow1Y = metaY + 5.5;
  doc.setFontSize(7.5); doc.setFont("helvetica", "normal"); doc.setTextColor(...textMid);
  doc.text(`Receipt #  ${bill.billNumber}`, margin + 4, metaRow1Y);
  const bMidParts = [`Visit ID: ${(bill as any).bookingId || "—"}`, doctorName ? `Dr. ${doctorName}` : ""].filter(Boolean);
  doc.text(bMidParts.join("   |   "), pageWidth / 2, metaRow1Y, { align: "center" });
  doc.setFont("helvetica", "bold"); doc.setTextColor(...indigoDark);
  doc.text(`Date: ${billDate}`, rightX - 4, metaRow1Y, { align: "right" });

  const metaRow2Y = metaY + 12.5;
  doc.setFont("helvetica", "normal"); doc.setTextColor(...textMid);
  doc.text(`Payment Mode:  ${bill.paymentMethod || "Cash"}`, margin + 4, metaRow2Y);
  const bStatusRgb: [number, number, number] =
    bill.paymentStatus === "paid"    ? [22, 163, 74]  :
    bill.paymentStatus === "partial" ? [37,  99, 235] : [217, 119, 6];
  const bStatusLabel = bill.paymentStatus === "paid" ? "Paid" : bill.paymentStatus === "partial" ? "Partial" : "Pending";
  doc.setFont("helvetica", "bold"); doc.setTextColor(...bStatusRgb);
  doc.text(`Status: ${bStatusLabel}`, rightX - 4, metaRow2Y, { align: "right" });

  const patientRows: string[][] = [
    ["Name",  bill.patientName],
    ["Phone", bill.patientPhone || "—"],
    ["Email", bill.patientEmail || "—"],
    ["Date",  billDate],
  ];
  if (doctorName) patientRows.push(["Doctor", doctorName]);
  autoTable(doc, {
    startY: metaY + metaH + 4,
    head: [["Patient Information", ""]],
    body: patientRows,
    theme: "grid",
    headStyles: { fillColor: indigoDark, textColor: white, fontStyle: "bold", fontSize: 9, halign: "left",
                  cellPadding: { top: 2.5, bottom: 2.5, left: 5, right: 5 } },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 48, textColor: textDark, fillColor: lightBg, fontSize: 8,
           cellPadding: { top: 2.5, bottom: 2.5, left: 5, right: 5 } },
      1: { textColor: textMid, fontSize: 8, cellPadding: { top: 2.5, bottom: 2.5, left: 5, right: 5 } },
    },
    bodyStyles: { cellPadding: 2.5 },
    margin: { left: margin, right: margin },
  });

  const allSvcs = (bill.services as any[]) || [];
  const bPharmItems   = allSvcs.filter(s => s.category === "Pharmacy");
  const bServiceItems = allSvcs.filter(s => s.category !== "Pharmacy");
  let currentY = (doc as any).lastAutoTable.finalY + 5;

  if (bPharmItems.length > 0) {
    autoTable(doc, {
      startY: currentY,
      head: [["Prescription Summary", "Dosage", "Qty", "Freq.", "Duration", "Price"]],
      body: bPharmItems.map((s: any) => [
        s.medicine || s.description || "—", s.dosage || "—", String(s.qty ?? 1),
        s.frequency || "—", s.duration || "—", `₹${(s.amount || 0).toFixed(2)}`,
      ]),
      theme: "grid",
      headStyles: { fillColor: indigoDark, textColor: white, fontStyle: "bold", fontSize: 8.5,
                    cellPadding: { top: 2.5, bottom: 2.5, left: 4, right: 4 } },
      columnStyles: {
        0: { textColor: textDark, fontSize: 8 },
        1: { textColor: textMid, fontSize: 8, cellWidth: 20 },
        2: { textColor: textMid, fontSize: 8, cellWidth: 12, halign: "center" },
        3: { textColor: textMid, fontSize: 8, cellWidth: 16, halign: "center" },
        4: { textColor: textMid, fontSize: 8, cellWidth: 18, halign: "center" },
        5: { halign: "right", textColor: textDark, fontSize: 8, cellWidth: 22 },
      },
      alternateRowStyles: { fillColor: [240, 250, 246] as [number, number, number] },
      bodyStyles: { cellPadding: { top: 2, bottom: 2, left: 4, right: 4 } },
      margin: { left: margin, right: margin },
    });
    currentY = (doc as any).lastAutoTable.finalY + 5;
  }

  if (bServiceItems.length > 0) {
    autoTable(doc, {
      startY: currentY,
      head: [["Service Summary", "Category", "Amount"]],
      body: bServiceItems.map((s: any) => [s.description || "—", s.category || "Consultation", `₹${(s.amount || 0).toFixed(2)}`]),
      theme: "striped",
      headStyles: { fillColor: indigoDark, textColor: white, fontStyle: "bold", fontSize: 8.5,
                    cellPadding: { top: 2.5, bottom: 2.5, left: 5, right: 5 } },
      columnStyles: {
        0: { textColor: textDark, fontSize: 8, cellPadding: { top: 2.5, bottom: 2.5, left: 5, right: 5 } },
        1: { textColor: textMid,  fontSize: 8, cellWidth: 38, cellPadding: { top: 2.5, bottom: 2.5, left: 5, right: 5 } },
        2: { halign: "right", textColor: textDark, fontSize: 8, cellWidth: 32,
             cellPadding: { top: 2.5, bottom: 2.5, left: 5, right: 5 } },
      },
      alternateRowStyles: { fillColor: [248, 251, 249] as [number, number, number] },
      bodyStyles: { cellPadding: 2.5 },
      margin: { left: margin, right: margin },
    });
    currentY = (doc as any).lastAutoTable.finalY + 5;
  }

  if (allSvcs.length === 0) {
    autoTable(doc, {
      startY: currentY,
      head: [["Service Summary", "Amount"]],
      body: [["—", "₹0.00"]],
      theme: "striped",
      headStyles: { fillColor: indigoDark, textColor: white, fontStyle: "bold", fontSize: 9 },
      margin: { left: margin, right: margin },
    });
    currentY = (doc as any).lastAutoTable.finalY + 5;
  }

  const discountAmt = (bill.subtotal || 0) * ((bill.discountPct || 0) / 100);
  const taxAmt      = ((bill.subtotal || 0) - discountAmt) * ((bill.taxPct || 0) / 100);
  autoTable(doc, {
    startY: currentY,
    head: [],
    body: [
      ["Subtotal",                              `₹${(bill.subtotal || 0).toFixed(2)}`],
      [`Discount (${bill.discountPct || 0}%)`,  `− ₹${discountAmt.toFixed(2)}`],
      [`Tax / GST (${bill.taxPct || 0}%)`,      `+ ₹${taxAmt.toFixed(2)}`],
      ["Total Amount Due",                      `₹${(bill.total || 0).toFixed(2)}`],
    ],
    theme: "grid",
    columnStyles: {
      0: { halign: "right", textColor: textMid,  fontSize: 8, cellWidth: 50,
           cellPadding: { top: 2.5, bottom: 2.5, left: 5, right: 5 } },
      1: { halign: "right", textColor: textDark, fontSize: 8, cellWidth: 36,
           cellPadding: { top: 2.5, bottom: 2.5, left: 5, right: 5 } },
    },
    bodyStyles: { cellPadding: 2.5 },
    willDrawCell: (data: any) => { if (data.row.index === 3 && data.section === "body") doc.setFillColor(...totalRowBg); },
    didDrawCell:  (data: any) => { if (data.row.index === 3 && data.section === "body") { doc.setFont("helvetica", "bold"); doc.setTextColor(...indigoDark); } },
    margin: { left: pageWidth / 2 + 3, right: margin },
  });

  const totalsEndY = (doc as any).lastAutoTable.finalY;
  const pmtBoxY = totalsEndY + 6;
  const pmtBoxW = pageWidth - margin * 2;
  const pmtBoxH = 26;
  const qrSize  = pmtBoxH - 4;
  const qrPayload = `Receipt:${bill.billNumber}|Clinic:${clinicName}|Patient:${bill.patientName}|Total:${(bill.total || 0).toFixed(2)}`;
  const qrDataUrl = buildQRDataUrl(qrPayload);

  doc.setFillColor(...lightBg);
  doc.setDrawColor(...indigoMid); doc.setLineWidth(0.3);
  doc.roundedRect(margin, pmtBoxY, pmtBoxW, pmtBoxH, 2.5, 2.5, "FD");
  doc.setFontSize(7);   doc.setFont("helvetica", "bold");   doc.setTextColor(...indigoMid);
  doc.text("PAYMENT DETAILS", margin + 5, pmtBoxY + 6);
  doc.setFontSize(10);  doc.setFont("helvetica", "bold");   doc.setTextColor(...textDark);
  doc.text(bill.paymentMethod || "Cash", margin + 5, pmtBoxY + 14);
  doc.setFontSize(8.5); doc.setFont("helvetica", "bold");   doc.setTextColor(...bStatusRgb);
  doc.text(`✓ ${bStatusLabel}`, pageWidth / 2, pmtBoxY + 14, { align: "center" });
  if (qrDataUrl) {
    doc.addImage(qrDataUrl, "PNG", margin + pmtBoxW - qrSize - 2, pmtBoxY + (pmtBoxH - qrSize) / 2, qrSize, qrSize);
  }

  const finalY = pmtBoxY + pmtBoxH + 10;
  doc.setDrawColor(...indigoMid); doc.setLineWidth(0.3);
  doc.line(margin, finalY - 4, pageWidth - margin, finalY - 4);
  doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(...indigoMid);
  doc.text(`Thank you for choosing ${clinicName}!`, pageWidth / 2, finalY, { align: "center" });
  doc.setFontSize(6.5); doc.setFont("helvetica", "normal"); doc.setTextColor(...textLight);
  doc.text("This is a computer generated receipt and does not require a physical signature.", pageWidth / 2, finalY + 6, { align: "center" });

  drawFooter(doc, pageWidth, pageHeight);
  doc.save(`receipt_${bill.patientName.replace(/\s+/g, "_")}_${format(new Date(), "yyyyMMdd")}.pdf`);
  notify.success("Receipt Printed", { description: `${bill.billNumber} downloaded.` });
}

// ── Public: consent PDF ───────────────────────────────────────────────────────

export function generateConsentPdf(booking: BookingWithSlot, clinic: ClinicInfo): void {
  const doc = new jsPDF();
  const pageWidth  = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;

  drawHeader(doc, pageWidth);
  drawMedicalCross(doc, margin, 12);

  const nameX = margin + 4.5 + 3;
  doc.setFontSize(19); doc.setFont("helvetica", "bold"); doc.setTextColor(...textDark);
  doc.text(clinic?.name || "Clinic", nameX, 20);
  doc.setFontSize(8.5); doc.setFont("helvetica", "normal"); doc.setTextColor(...indigoMid);
  doc.text("Digital Informed Consent Form", nameX, 27);

  const rightX = pageWidth - margin;
  const rightColWidth = pageWidth * 0.42;
  let contactY = 11;
  doc.setFontSize(7.5); doc.setFont("helvetica", "normal"); doc.setTextColor(...textMid);
  if (clinic?.address) {
    doc.splitTextToSize(clinic.address, rightColWidth).forEach((line: string) => {
      doc.text(line, rightX, contactY, { align: "right" }); contactY += 4.2;
    });
  }
  if (clinic?.phone) { doc.text(`Tel: ${clinic.phone}`, rightX, contactY, { align: "right" }); contactY += 4.2; }
  if (clinic?.email) { doc.text(clinic.email, rightX, contactY, { align: "right" }); }

  doc.setDrawColor(...indigoDark); doc.setLineWidth(0.5);
  doc.line(margin, 33, pageWidth - margin, 33);

  const metaY = 34, metaH = 10;
  doc.setFillColor(...metaBg);
  doc.rect(margin, metaY, pageWidth - margin * 2, metaH, "F");
  doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(...indigoMid);
  doc.text("DIGITAL CONSENT RECORD", pageWidth / 2, metaY + 6.5, { align: "center" });
  doc.setFont("helvetica", "normal"); doc.setTextColor(...textMid);
  doc.text(`Generated: ${format(new Date(), "dd MMM yyyy, hh:mm a")}`, rightX - 4, metaY + 6.5, { align: "right" });

  autoTable(doc, {
    startY: metaY + metaH + 5,
    head: [["Patient & Appointment Details", ""]],
    body: [
      ["Patient Name", booking.customerName],
      ["Phone",        booking.customerPhone],
      ["Appointment",  format(new Date(booking.slot.startTime), "dd MMM yyyy, hh:mm a")],
      ["Clinic",       clinic?.name || ""],
    ],
    theme: "grid",
    headStyles: { fillColor: indigoDark, textColor: white, fontStyle: "bold", fontSize: 9, halign: "left",
                  cellPadding: { top: 3, bottom: 3, left: 5, right: 5 } },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 48, textColor: textDark, fillColor: lightBg, fontSize: 8.5,
           cellPadding: { top: 3, bottom: 3, left: 5, right: 5 } },
      1: { textColor: textMid, fontSize: 8.5, cellPadding: { top: 3, bottom: 3, left: 5, right: 5 } },
    },
    bodyStyles: { cellPadding: 3 },
    margin: { left: margin, right: margin },
  });

  let curY = (doc as any).lastAutoTable.finalY + 9;

  doc.setFillColor(...lightBg);
  doc.rect(margin, curY, pageWidth - margin * 2, 7, "F");
  doc.setFontSize(8.5); doc.setFont("helvetica", "bold"); doc.setTextColor(...indigoDark);
  doc.text("CONSENT DECLARATION", margin + 4, curY + 4.8);
  curY += 11;

  const textW = pageWidth - margin * 2;
  doc.setFontSize(8.5); doc.setFont("helvetica", "normal"); doc.setTextColor(...textDark);

  const para1 = `I, ${booking.customerName}, hereby give my informed consent to ${clinic?.name || "the clinic"} to perform dental examination and any necessary dental treatment deemed appropriate by the treating dentist.`;
  const p1Lines: string[] = doc.splitTextToSize(para1, textW);
  doc.text(p1Lines, margin, curY);
  curY += p1Lines.length * 5 + 4;

  doc.text("I understand and acknowledge the following:", margin, curY);
  curY += 6;

  doc.setTextColor(...textMid);
  const bullets = [
    "The nature of the proposed treatment and its alternatives have been explained to me.",
    "All dental procedures carry certain risks including pain, swelling, and infection.",
    "I am responsible for informing the clinic of any allergies or medical conditions.",
    "My personal and health information will be kept confidential.",
    "I have the right to withdraw consent at any time before treatment begins.",
  ];
  bullets.forEach(b => {
    const bLines: string[] = doc.splitTextToSize(`\u2022  ${b}`, textW - 6);
    doc.text(bLines, margin + 4, curY);
    curY += bLines.length * 5 + 1.5;
  });

  curY += 2;
  doc.setTextColor(...textDark);
  const para3 = `By signing below, I confirm that I have read and understood the above and voluntarily consent to the dental care at ${clinic?.name || "the clinic"}.`;
  const p3Lines: string[] = doc.splitTextToSize(para3, textW);
  doc.text(p3Lines, margin, curY);
  curY += p3Lines.length * 5 + 10;

  doc.setFillColor(...lightBg);
  doc.rect(margin, curY, pageWidth - margin * 2, 7, "F");
  doc.setFontSize(8.5); doc.setFont("helvetica", "bold"); doc.setTextColor(...indigoDark);
  doc.text("PATIENT SIGNATURE", margin + 4, curY + 4.8);
  curY += 10;

  const sigBoxW = 90, sigBoxH = 40;
  doc.setDrawColor(...indigoMid); doc.setLineWidth(0.4);
  doc.roundedRect(margin, curY, sigBoxW, sigBoxH, 2, 2, "D");
  if (booking.consentSignature) {
    try { doc.addImage(booking.consentSignature, "PNG", margin + 2, curY + 2, sigBoxW - 4, sigBoxH - 4); } catch (_) {}
  }
  curY += sigBoxH + 5;

  doc.setFontSize(7.5); doc.setFont("helvetica", "normal"); doc.setTextColor(...textMid);
  if (booking.consentSignedAt) {
    doc.text(`Signed digitally on: ${format(new Date(booking.consentSignedAt), "dd MMMM yyyy 'at' hh:mm a")}`, margin, curY);
    curY += 5;
  }
  doc.text("IP address recorded for audit purposes. This is a legally binding digital consent.", margin, curY);
  curY += 12;

  doc.setDrawColor(...indigoMid); doc.setLineWidth(0.3);
  doc.line(margin, curY - 4, pageWidth - margin, curY - 4);
  doc.setFontSize(7.5); doc.setFont("helvetica", "bold"); doc.setTextColor(...indigoMid);
  doc.text(`Thank you for choosing ${clinic?.name || "us"}!`, pageWidth / 2, curY, { align: "center" });
  doc.setFontSize(6.5); doc.setFont("helvetica", "normal"); doc.setTextColor(...textLight);
  doc.text("This document was generated by BookMySlot and serves as the official digital consent record.", pageWidth / 2, curY + 6, { align: "center" });

  drawFooter(doc, pageWidth, pageHeight);
  const fileName = `consent_${booking.customerName.replace(/\s+/g, "_")}_${format(new Date(booking.slot.startTime), "yyyyMMdd")}.pdf`;
  doc.save(fileName);
  notify.success("Consent PDF Downloaded", { description: `${fileName} saved successfully.` });
}
