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

// ── Public: QR util (stub — kept for API compatibility) ──────────────────────

export function buildQRDataUrl(_text: string): string {
  return "";
}

// ── Private: HTML escape ──────────────────────────────────────────────────────

function esc(s: string | null | undefined): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Private: open a new window, write HTML, and trigger the print dialog ─────

function printHTML(html: string): void {
  const win = window.open("", "_blank");
  if (!win) {
    notify.error("Popup blocked", { description: "Allow popups for this site to print receipts." });
    return;
  }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
    win.close();
  }, 80);
}

// ── Private: shared print styles (A4, green palette) ─────────────────────────

const PRINT_STYLES = `
  @page { size: A4; margin: 12mm 14mm; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #082820; background: #fff; }
  .hbar { display: flex; height: 7px; }
  .hbar-l { background: #085041; flex: 0 0 55%; }
  .hbar-r { background: #0F9B6E; flex: 1; }
  .clinic-hdr { display: flex; justify-content: space-between; align-items: flex-start; padding: 10px 0 8px; border-bottom: 1.5px solid #085041; }
  .clinic-name { font-size: 17px; font-weight: 700; color: #082820; }
  .clinic-sub  { font-size: 8px; color: #0F9B6E; margin-top: 2px; }
  .clinic-contact { text-align: right; font-size: 7.5px; color: #326450; line-height: 1.7; max-width: 45%; }
  .meta { background: #D1EDE2; padding: 5px 10px; display: flex; justify-content: space-between; align-items: center; border-radius: 3px; margin: 8px 0; }
  .meta span { font-size: 7.5px; color: #326450; }
  .meta strong { color: #085041; }
  .sec { font-size: 8.5px; font-weight: 700; color: #0F9B6E; text-transform: uppercase; letter-spacing: 0.7px; margin: 9px 0 3px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
  th { background: #085041; color: #fff; font-size: 8px; font-weight: 700; padding: 4px 7px; text-align: left; }
  td { font-size: 8px; padding: 3.5px 7px; color: #326450; border-bottom: 1px solid #E1F5EE; vertical-align: top; }
  td.lbl { font-weight: 700; background: #E1F5EE; color: #082820; width: 34%; }
  tr:nth-child(even) td:not(.lbl) { background: #F5FCF9; }
  .tr { text-align: right; }
  .totals { background: #E1F5EE; border-radius: 5px; padding: 9px 12px; margin: 8px 0; }
  .trow { display: flex; justify-content: space-between; font-size: 8.5px; padding: 1.5px 0; color: #326450; }
  .trow.grand { border-top: 1.5px solid #0F9B6E; margin-top: 5px; padding-top: 5px; font-size: 11.5px; font-weight: 700; color: #085041; }
  .pbox { border: 1px solid #0F9B6E; border-radius: 5px; padding: 7px 11px; display: flex; gap: 20px; align-items: center; margin: 8px 0; }
  .pbox-lbl { font-size: 6.5px; font-weight: 700; color: #0F9B6E; text-transform: uppercase; letter-spacing: 0.4px; }
  .pbox-val { font-size: 11.5px; font-weight: 700; color: #082820; }
  .paid    { color: #16a34a; }
  .pending { color: #d97706; }
  .partial { color: #2563eb; }
  p { margin-bottom: 7px; font-size: 8.5px; color: #082820; line-height: 1.55; }
  ul { margin: 4px 0 7px 16px; }
  li { font-size: 8.5px; color: #326450; margin-bottom: 3px; line-height: 1.5; }
  .footer-ty   { text-align: center; font-size: 9.5px; font-weight: 700; color: #0F9B6E; margin: 10px 0 3px; }
  .footer-note { text-align: center; font-size: 6.5px; color: #6b9080; }
`;

// ── Private: shared header and footer HTML blocks ─────────────────────────────

function headerHTML(clinicName: string, subtitle: string, clinic: ClinicInfo): string {
  const contactLines = [
    clinic.address ? `<div>${esc(clinic.address)}</div>` : "",
    clinic.phone   ? `<div>Tel: ${esc(clinic.phone)}</div>` : "",
    clinic.email   ? `<div>${esc(clinic.email)}</div>` : "",
  ].join("");
  return `
    <div class="hbar"><div class="hbar-l"></div><div class="hbar-r"></div></div>
    <div class="clinic-hdr">
      <div>
        <div class="clinic-name">&#x271a;&nbsp;${esc(clinicName)}</div>
        <div class="clinic-sub">${esc(subtitle)}</div>
      </div>
      <div class="clinic-contact">${contactLines}</div>
    </div>`;
}

function footerHTML(clinicName: string): string {
  return `
    <div class="footer-ty">Thank you for choosing ${esc(clinicName)}!</div>
    <div class="footer-note">Computer-generated document &mdash; no physical signature required. Powered by BookMySlot.</div>
    <div class="hbar" style="margin-top:10px"><div class="hbar-l"></div><div class="hbar-r"></div></div>`;
}

function wrapDoc(title: string, body: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${esc(title)}</title><style>${PRINT_STYLES}</style></head><body>${body}</body></html>`;
}

// ── Private: status helpers ───────────────────────────────────────────────────

function statusClass(status: string): string {
  return status === "paid" ? "paid" : status === "partial" ? "partial" : "pending";
}

function statusLabel(status: string): string {
  return status === "paid" ? "\u2713 Paid" : status === "partial" ? "\u2299 Partial" : "\u23f3 Pending";
}

// ── Public: receipt for the billing-dialog flow (new bill or consolidated) ────

export function generateReceiptPDF(details: BillingDetails): void {
  const clinicName = details.clinicName || "Clinic";
  const cls        = statusClass(details.paymentStatus);
  const lbl        = statusLabel(details.paymentStatus);

  const pharmItems = details.services.filter(s => s.category === "Pharmacy");
  const svcItems   = details.services.filter(s => s.category !== "Pharmacy");
  const subtotal   = details.services.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
  const disc       = parseFloat(details.discount) || 0;
  const tax        = parseFloat(details.tax) || 0;
  const discAmt    = subtotal * (disc / 100);
  const taxAmt     = (subtotal - discAmt) * (tax / 100);
  const total      = subtotal - discAmt + taxAmt;

  const pharmBlock = pharmItems.length > 0 ? `
    <div class="sec">Pharmacy</div>
    <table>
      <thead><tr><th>Medicine</th><th>Dosage</th><th>Freq.</th><th>Duration</th><th class="tr">Qty</th><th class="tr">Amount</th></tr></thead>
      <tbody>${pharmItems.map(s => `
        <tr><td>${esc(s.description)}</td><td>${esc(s.dosage) || "&mdash;"}</td><td>${esc(s.frequency) || "&mdash;"}</td><td>${esc(s.duration) || "&mdash;"}</td><td class="tr">${s.qty ?? 1}</td><td class="tr">&#8377;${(parseFloat(s.amount) || 0).toFixed(0)}</td></tr>`).join("")}
      </tbody>
    </table>` : "";

  const svcBlock = svcItems.length > 0 ? `
    <div class="sec">Services &amp; Procedures</div>
    <table>
      <thead><tr><th>Description</th><th>Category</th><th class="tr">Qty</th><th class="tr">Unit Price</th><th class="tr">Amount</th></tr></thead>
      <tbody>${svcItems.map(s => `
        <tr><td>${esc(s.description)}</td><td>${esc(s.category) || "Consultation"}</td><td class="tr">${s.qty ?? 1}</td><td class="tr">${s.unitPrice ? `&#8377;${Number(s.unitPrice).toFixed(0)}` : "&mdash;"}</td><td class="tr">&#8377;${(parseFloat(s.amount) || 0).toFixed(0)}</td></tr>`).join("")}
      </tbody>
    </table>` : "";

  const body = `
    ${headerHTML(clinicName, "Caring for Your Smile", { address: details.clinicAddress, phone: details.clinicPhone, email: details.clinicEmail })}
    <div class="meta">
      <span><strong>Receipt #</strong> ${esc(details.receiptNumber)}&nbsp;&middot;&nbsp;<strong>Date:</strong> ${esc(details.date)}${details.doctorName ? `&nbsp;&middot;&nbsp;<strong>Dr.</strong> ${esc(details.doctorName)}` : ""}</span>
      <span class="${cls}">${lbl}</span>
    </div>
    <div class="sec">Patient Information</div>
    <table><tbody>
      <tr><td class="lbl">Name</td><td>${esc(details.patientName)}</td><td class="lbl">Phone</td><td>${esc(details.patientPhone)}</td></tr>
      <tr><td class="lbl">Email</td><td colspan="3">${esc(details.patientEmail) || "&mdash;"}</td></tr>
      ${details.remarks ? `<tr><td class="lbl">Remarks</td><td colspan="3">${esc(details.remarks)}</td></tr>` : ""}
    </tbody></table>
    ${pharmBlock}${svcBlock}
    <div class="totals">
      <div class="trow"><span>Subtotal</span><span>&#8377;${subtotal.toFixed(0)}</span></div>
      ${disc > 0 ? `<div class="trow"><span>Discount (${disc}%)</span><span>&minus; &#8377;${discAmt.toFixed(0)}</span></div>` : ""}
      ${tax  > 0 ? `<div class="trow"><span>Tax / GST (${tax}%)</span><span>+ &#8377;${taxAmt.toFixed(0)}</span></div>` : ""}
      <div class="trow grand"><span>Total Amount Due</span><span>&#8377;${total.toFixed(0)}</span></div>
    </div>
    <div class="pbox">
      <div><div class="pbox-lbl">Payment Mode</div><div class="pbox-val">${esc(details.paymentMethod || "Cash")}</div></div>
      <div><div class="pbox-lbl">Status</div><div class="pbox-val ${cls}">${lbl}</div></div>
    </div>
    ${footerHTML(clinicName)}`;

  printHTML(wrapDoc(`Receipt \u2014 ${details.receiptNumber}`, body));
  notify.success("Print ready", { description: `${details.receiptNumber} \u2014 use the print dialog to save as PDF.` });
}

// ── Public: print a single saved bill record ──────────────────────────────────

export function printBillFromRecord(bill: PatientBill, clinic: ClinicInfo, bookings: BookingWithSlot[]): void {
  const clinicName    = clinic?.name || "Clinic";
  const billDate      = bill.createdAt ? format(new Date(bill.createdAt), "dd MMM yyyy") : format(new Date(), "dd MMM yyyy");
  const linkedBooking = bookings.find(b => b.id === (bill as any).bookingId);
  const doctor        = (linkedBooking as any)?.assignedDoctor ?? "";
  const allSvcs       = (bill.services as any[]) ?? [];
  const pharmItems    = allSvcs.filter(s => s.category === "Pharmacy");
  const svcItems      = allSvcs.filter(s => s.category !== "Pharmacy");
  const cls           = statusClass(bill.paymentStatus ?? "pending");
  const lbl           = statusLabel(bill.paymentStatus ?? "pending");
  const discAmt       = (bill.subtotal || 0) * ((bill.discountPct || 0) / 100);
  const taxAmt        = ((bill.subtotal || 0) - discAmt) * ((bill.taxPct || 0) / 100);

  const pharmBlock = pharmItems.length > 0 ? `
    <div class="sec">Pharmacy</div>
    <table>
      <thead><tr><th>Medicine</th><th>Dosage</th><th>Freq.</th><th>Duration</th><th class="tr">Qty</th><th class="tr">Amount</th></tr></thead>
      <tbody>${pharmItems.map((s: any) => `
        <tr><td>${esc(s.medicine || s.description)}</td><td>${esc(s.dosage) || "&mdash;"}</td><td>${esc(s.frequency) || "&mdash;"}</td><td>${esc(s.duration) || "&mdash;"}</td><td class="tr">${s.qty ?? 1}</td><td class="tr">&#8377;${Number(s.amount || 0).toFixed(0)}</td></tr>`).join("")}
      </tbody>
    </table>` : "";

  const svcBlock = svcItems.length > 0 ? `
    <div class="sec">Consultation &amp; Services</div>
    <table>
      <thead><tr><th>Description</th><th class="tr">Qty</th><th class="tr">Unit Price</th><th class="tr">Amount</th></tr></thead>
      <tbody>${svcItems.map((s: any) => `
        <tr><td>${esc(s.description)}</td><td class="tr">${s.qty ?? 1}</td><td class="tr">${s.unitPrice ? `&#8377;${Number(s.unitPrice).toFixed(0)}` : "&mdash;"}</td><td class="tr">&#8377;${Number(s.amount || 0).toFixed(0)}</td></tr>`).join("")}
      </tbody>
    </table>` : "";

  const body = `
    ${headerHTML(clinicName, "Caring for Your Smile", clinic)}
    <div class="meta">
      <span><strong>Receipt #</strong> ${esc(bill.billNumber)}&nbsp;&middot;&nbsp;<strong>Date:</strong> ${esc(billDate)}${doctor ? `&nbsp;&middot;&nbsp;<strong>Dr.</strong> ${esc(doctor)}` : ""}${bill.paymentMethod ? `&nbsp;&middot;&nbsp;<strong>Mode:</strong> ${esc(bill.paymentMethod)}` : ""}</span>
      <span class="${cls}">${lbl}</span>
    </div>
    <div class="sec">Patient Information</div>
    <table><tbody>
      <tr><td class="lbl">Name</td><td>${esc(bill.patientName)}</td><td class="lbl">Phone</td><td>${esc(bill.patientPhone) || "&mdash;"}</td></tr>
      <tr><td class="lbl">Email</td><td colspan="3">${esc(bill.patientEmail) || "&mdash;"}</td></tr>
    </tbody></table>
    ${pharmBlock}${svcBlock}
    <div class="totals">
      <div class="trow"><span>Subtotal</span><span>&#8377;${(bill.subtotal || 0).toFixed(0)}</span></div>
      ${(bill.discountPct || 0) > 0 ? `<div class="trow"><span>Discount (${bill.discountPct}%)</span><span>&minus; &#8377;${discAmt.toFixed(0)}</span></div>` : ""}
      ${(bill.taxPct      || 0) > 0 ? `<div class="trow"><span>Tax / GST (${bill.taxPct}%)</span><span>+ &#8377;${taxAmt.toFixed(0)}</span></div>` : ""}
      <div class="trow grand"><span>Total</span><span>&#8377;${(bill.total || 0).toFixed(0)}</span></div>
    </div>
    <div class="pbox">
      <div><div class="pbox-lbl">Payment Mode</div><div class="pbox-val">${esc(bill.paymentMethod || "Cash")}</div></div>
      <div><div class="pbox-lbl">Status</div><div class="pbox-val ${cls}">${lbl}</div></div>
    </div>
    ${footerHTML(clinicName)}`;

  printHTML(wrapDoc(`Receipt \u2014 ${bill.billNumber}`, body));
  notify.success("Print ready", { description: `${bill.billNumber} \u2014 use the print dialog to save as PDF.` });
}

// ── Public: digital consent document ─────────────────────────────────────────

export function generateConsentPdf(booking: BookingWithSlot, clinic: ClinicInfo): void {
  const clinicName = clinic?.name || "Clinic";
  const apptDate   = format(new Date(booking.slot.startTime), "dd MMM yyyy, hh:mm a");
  const genDate    = format(new Date(), "dd MMM yyyy, hh:mm a");

  const bullets = [
    "The nature of the proposed treatment and its alternatives have been explained to me.",
    "All dental procedures carry certain risks including pain, swelling, and infection.",
    "I am responsible for informing the clinic of any allergies or medical conditions.",
    "My personal and health information will be kept confidential.",
    "I have the right to withdraw consent at any time before treatment begins.",
  ];

  const sigBlock = booking.consentSignature
    ? `<div style="border:1px solid #0F9B6E;border-radius:5px;padding:6px;display:inline-block;margin-top:4px"><img src="${booking.consentSignature}" style="max-width:200px;max-height:80px;display:block" alt="Patient signature" /></div>`
    : `<div style="border:1px dashed #0F9B6E;border-radius:5px;width:220px;height:70px;margin-top:4px"></div>`;

  const body = `
    ${headerHTML(clinicName, "Digital Informed Consent Form", clinic)}
    <div class="meta">
      <span><strong>DIGITAL CONSENT RECORD</strong></span>
      <span>Generated: ${esc(genDate)}</span>
    </div>
    <div class="sec">Patient &amp; Appointment Details</div>
    <table><tbody>
      <tr><td class="lbl">Patient Name</td><td>${esc(booking.customerName)}</td><td class="lbl">Phone</td><td>${esc(booking.customerPhone)}</td></tr>
      <tr><td class="lbl">Appointment</td><td>${esc(apptDate)}</td><td class="lbl">Clinic</td><td>${esc(clinicName)}</td></tr>
    </tbody></table>
    <div class="sec" style="margin-top:10px">Consent Declaration</div>
    <p>I, <strong>${esc(booking.customerName)}</strong>, hereby give my informed consent to <strong>${esc(clinicName)}</strong> to perform dental examination and any necessary dental treatment deemed appropriate by the treating dentist.</p>
    <p>I understand and acknowledge the following:</p>
    <ul>${bullets.map(b => `<li>${esc(b)}</li>`).join("")}</ul>
    <p>By signing below, I confirm that I have read and understood the above and voluntarily consent to the dental care at <strong>${esc(clinicName)}</strong>.</p>
    <div class="sec" style="margin-top:10px">Patient Signature</div>
    ${sigBlock}
    <div style="font-size:7.5px;color:#326450;margin-top:6px">
      ${booking.consentSignedAt ? `Signed digitally on: <strong>${esc(format(new Date(booking.consentSignedAt), "dd MMMM yyyy 'at' hh:mm a"))}</strong><br>` : ""}
      IP address recorded for audit purposes. This is a legally binding digital consent.
    </div>
    ${footerHTML(clinicName)}`;

  printHTML(wrapDoc(`Consent \u2014 ${esc(booking.customerName)}`, body));
  notify.success("Consent ready to print", { description: "Use the print dialog to save as PDF." });
}

// ── Public: print a diagnosis or prescription record (window.open + print) ────

export type PrintableMedicine = {
  name: string; dosage?: string; qty?: string;
  frequency?: string; duration?: string; route?: string; remarks?: string;
};

export function printClinicalRecord(opts: {
  type: "diagnosis" | "prescription";
  clinicName?: string;
  patientName: string;
  patientPhone?: string | null;
  doctorName?: string | null;
  date: string;
  diagnosis?: string[];
  notes?: string | null;
  medicines?: PrintableMedicine[] | null;
  rawPrescription?: string | null;
}): void {
  const clinicName = opts.clinicName || "Clinic";
  const clinicInfo: ClinicInfo = { name: clinicName };
  const title = opts.type === "diagnosis" ? "Diagnosis Record" : "Prescription";

  const dxBlock = opts.diagnosis && opts.diagnosis.length > 0 ? `
    <div class="sec">Diagnosis</div>
    <p>${opts.diagnosis.map(d => esc(d)).join(", ")}</p>
    ${opts.notes ? `<p style="white-space:pre-line">${esc(opts.notes)}</p>` : ""}` : "";

  const rxBlock = opts.medicines && opts.medicines.length > 0 ? `
    <div class="sec">Medicines</div>
    <table>
      <thead><tr><th>Medicine</th><th>Dosage</th><th>Freq.</th><th>Duration</th><th>Route</th></tr></thead>
      <tbody>${opts.medicines.map(m => `
        <tr><td>${esc(m.name)}</td><td>${esc(m.dosage) || "&mdash;"}</td><td>${esc(m.frequency) || "&mdash;"}</td><td>${esc(m.duration) || "&mdash;"}</td><td>${esc(m.route) || "&mdash;"}</td></tr>`).join("")}
      </tbody>
    </table>` : (opts.rawPrescription ? `<div class="sec">Prescription</div><p style="white-space:pre-line">${esc(opts.rawPrescription)}</p>` : "");

  const body = `
    ${headerHTML(clinicName, "Caring for Your Smile", clinicInfo)}
    <div class="meta">
      <span><strong>${esc(title)}</strong>&nbsp;&middot;&nbsp;<strong>Date:</strong> ${esc(opts.date)}${opts.doctorName ? `&nbsp;&middot;&nbsp;<strong>Dr.</strong> ${esc(opts.doctorName)}` : ""}</span>
    </div>
    <div class="sec">Patient Information</div>
    <table><tbody>
      <tr><td class="lbl">Name</td><td>${esc(opts.patientName)}</td><td class="lbl">Phone</td><td>${esc(opts.patientPhone) || "&mdash;"}</td></tr>
    </tbody></table>
    ${dxBlock}${rxBlock}
    ${footerHTML(clinicName)}`;

  printHTML(wrapDoc(title, body));
  notify.success("Print ready", { description: "Use the print dialog to save as PDF." });
}
