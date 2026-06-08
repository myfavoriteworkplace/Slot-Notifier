import { format } from "date-fns";

function openPrintWindow(html: string) {
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) { alert("Please allow pop-ups to print."); return; }
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); }, 400);
}

const BASE_STYLE = `
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Inter, sans-serif; font-size: 12px; color: #0a2820; background: #fff; }
    .header-bar { height: 7px; background: linear-gradient(90deg, #085041 55%, #0f9b6e 55%); }
    .footer-bar { height: 7px; background: linear-gradient(90deg, #085041 55%, #0f9b6e 55%); margin-top: 20px; }
    .footer-text { text-align: center; font-size: 8px; color: #fff; margin-top: -14px; padding-bottom: 3px; }
    .container { padding: 14px 18px; }
    h1 { font-size: 15px; font-weight: 700; }
    h2 { font-size: 11px; font-weight: 600; color: #085041; text-transform: uppercase; letter-spacing: 0.05em; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0; }
    th { background: #0f9b6e; color: #fff; padding: 5px 7px; text-align: left; font-size: 10px; }
    td { padding: 4px 7px; font-size: 11px; border-bottom: 1px solid #e1f5ee; }
    tr:nth-child(even) td { background: #f0fbf7; }
    .meta-box { background: #e1f5ee; border-radius: 6px; padding: 8px 10px; margin: 6px 0; }
    .row { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
    .col { flex: 1; }
    .label { font-size: 9px; color: #4a8070; text-transform: uppercase; letter-spacing: 0.04em; }
    .value { font-size: 11px; font-weight: 600; }
    .badge-paid    { color: #16a34a; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 4px; padding: 1px 6px; font-size: 10px; font-weight: 700; display: inline-block; }
    .badge-partial { color: #2563eb; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 4px; padding: 1px 6px; font-size: 10px; font-weight: 700; display: inline-block; }
    .badge-pending { color: #d97706; background: #fffbeb; border: 1px solid #fde68a; border-radius: 4px; padding: 1px 6px; font-size: 10px; font-weight: 700; display: inline-block; }
    .total-row td  { font-weight: 700; background: #c1e5d7 !important; font-size: 12px; }
    .divider { border: none; border-top: 1px solid #c8e8de; margin: 8px 0; }
    .sig-box { border: 1px solid #0f9b6e; border-radius: 6px; height: 80px; display: flex; align-items: center; justify-content: center; overflow: hidden; }
    .sig-box img { max-height: 76px; max-width: 100%; object-fit: contain; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
`;

export interface PrintBillingInput {
  clinicName: string;
  clinicAddress?: string;
  clinicPhone?: string;
  clinicEmail?: string;
  patientName: string;
  patientPhone?: string;
  patientEmail?: string;
  receiptNumber: string;
  date: string;
  doctorName?: string;
  visitId?: string;
  paymentMethod?: string;
  paymentStatus?: "paid" | "partial" | "pending";
  transactionId?: string;
  discount?: string | number;
  tax?: string | number;
  remarks?: string;
  services: { description: string; amount: string | number; category?: string; dosage?: string; frequency?: string; duration?: string; qty?: number; unitPrice?: number; }[];
}

export function printBillingReceipt(d: PrintBillingInput) {
  const discPct = parseFloat(String(d.discount ?? 0)) || 0;
  const taxPct  = parseFloat(String(d.tax ?? 0)) || 0;
  const subtotal = d.services.reduce((s, r) => s + (parseFloat(String(r.amount)) || 0), 0);
  const discAmt  = subtotal * (discPct / 100);
  const taxAmt   = (subtotal - discAmt) * (taxPct / 100);
  const total    = subtotal - discAmt + taxAmt;

  const statusLabel = d.paymentStatus === "paid" ? "Paid" : d.paymentStatus === "partial" ? "Partial" : "Pending";
  const badgeClass  = `badge-${d.paymentStatus ?? "pending"}`;

  const pharmItems   = d.services.filter(s => s.category === "Pharmacy");
  const serviceItems = d.services.filter(s => s.category !== "Pharmacy");

  const serviceRows = serviceItems.map(s =>
    `<tr><td>${s.description}</td><td style="text-align:right">₹${parseFloat(String(s.amount)).toFixed(2)}</td></tr>`
  ).join("");

  const pharmRows = pharmItems.map(s =>
    `<tr><td>${s.description}${s.dosage ? ` (${s.dosage})` : ""}${s.qty ? ` × ${s.qty}` : ""}</td>
     <td style="text-align:right">₹${parseFloat(String(s.amount)).toFixed(2)}</td></tr>`
  ).join("");

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Receipt - ${d.receiptNumber}</title>${BASE_STYLE}</head><body>
    <div class="header-bar"></div>
    <div class="container">
      <div class="row" style="margin-bottom:10px">
        <div>
          <h1 style="color:#085041">🦷 ${d.clinicName}</h1>
          <div style="font-size:10px;color:#4a8070;margin-top:2px">Medical Services Receipt</div>
        </div>
        <div style="text-align:right">
          ${d.clinicPhone ? `<div style="font-size:10px">📞 ${d.clinicPhone}</div>` : ""}
          ${d.clinicEmail ? `<div style="font-size:10px">✉ ${d.clinicEmail}</div>` : ""}
          ${d.clinicAddress ? `<div style="font-size:10px;max-width:180px;text-align:right">${d.clinicAddress}</div>` : ""}
        </div>
      </div>
      <hr class="divider">
      <div class="meta-box row">
        <div><div class="label">Receipt #</div><div class="value">${d.receiptNumber}</div></div>
        <div><div class="label">Date</div><div class="value">${d.date}</div></div>
        <div><div class="label">Payment</div><div class="value">${d.paymentMethod || "Cash"} &nbsp;<span class="${badgeClass}">${statusLabel}</span></div></div>
        ${d.doctorName ? `<div><div class="label">Doctor</div><div class="value">Dr. ${d.doctorName}</div></div>` : ""}
      </div>
      <div class="meta-box" style="margin-top:6px">
        <div class="row">
          <div><div class="label">Patient</div><div class="value">${d.patientName}</div></div>
          ${d.patientPhone ? `<div><div class="label">Phone</div><div class="value">${d.patientPhone}</div></div>` : ""}
          ${d.patientEmail ? `<div><div class="label">Email</div><div class="value">${d.patientEmail}</div></div>` : ""}
        </div>
      </div>

      ${serviceItems.length ? `
      <h2 style="margin-top:10px">Dental Services</h2>
      <table><thead><tr><th>Description</th><th style="text-align:right">Amount</th></tr></thead>
      <tbody>${serviceRows}</tbody></table>` : ""}

      ${pharmItems.length ? `
      <h2 style="margin-top:8px">Pharmacy / Medication</h2>
      <table><thead><tr><th>Item</th><th style="text-align:right">Amount</th></tr></thead>
      <tbody>${pharmRows}</tbody></table>` : ""}

      <table style="margin-top:6px;width:260px;margin-left:auto">
        <tbody>
          <tr><td>Subtotal</td><td style="text-align:right">₹${subtotal.toFixed(2)}</td></tr>
          ${discPct > 0 ? `<tr><td>Discount (${discPct}%)</td><td style="text-align:right">-₹${discAmt.toFixed(2)}</td></tr>` : ""}
          ${taxPct  > 0 ? `<tr><td>GST / Tax (${taxPct}%)</td><td style="text-align:right">+₹${taxAmt.toFixed(2)}</td></tr>` : ""}
          <tr class="total-row"><td>Total</td><td style="text-align:right">₹${total.toFixed(2)}</td></tr>
        </tbody>
      </table>

      ${d.transactionId ? `<div style="font-size:10px;margin-top:6px;color:#4a8070">TXN: ${d.transactionId}</div>` : ""}
      ${d.remarks ? `<div style="font-size:10px;margin-top:4px;color:#4a8070">Notes: ${d.remarks}</div>` : ""}
      <div style="text-align:center;margin-top:14px;font-size:10px;color:#4a8070">Thank you for choosing ${d.clinicName}!</div>
      <div style="text-align:center;font-size:9px;color:#9ab8b0;margin-top:2px">This is a computer-generated receipt and does not require a physical signature.</div>
    </div>
    <div class="footer-bar"></div>
    <div class="footer-text">Powered by BookMySlot</div>
  </body></html>`;
  openPrintWindow(html);
}

export function printPatientBill(bill: {
  billNumber?: string | null;
  patientName: string;
  patientPhone?: string | null;
  patientEmail?: string | null;
  services?: any[];
  subtotal?: number | null;
  discountPct?: number | null;
  taxPct?: number | null;
  total?: number | null;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  notes?: string | null;
  createdAt?: Date | string | null;
}, clinicName: string) {
  const svcs: any[] = Array.isArray(bill.services) ? bill.services : [];
  const discPct = bill.discountPct ?? 0;
  const taxPct  = bill.taxPct ?? 0;
  const subtotal = bill.subtotal ?? svcs.reduce((s: number, r: any) => s + (r.amount || 0), 0);
  const discAmt  = subtotal * (discPct / 100);
  const taxAmt   = (subtotal - discAmt) * (taxPct / 100);
  const total    = bill.total ?? (subtotal - discAmt + taxAmt);

  const status = bill.paymentStatus ?? "pending";
  const statusLabel = status === "paid" ? "Paid" : status === "partial" ? "Partial" : "Pending";
  const dateStr = bill.createdAt ? format(new Date(bill.createdAt), "dd MMM yyyy") : format(new Date(), "dd MMM yyyy");

  const pharmItems   = svcs.filter((s: any) => s.category === "Pharmacy");
  const serviceItems = svcs.filter((s: any) => s.category !== "Pharmacy");

  const svcRows = serviceItems.map((s: any) =>
    `<tr><td>${s.description || ""}</td><td style="text-align:right">₹${(s.amount || 0).toFixed(2)}</td></tr>`
  ).join("");
  const pharmRows = pharmItems.map((s: any) =>
    `<tr><td>${s.description || ""}${s.dosage ? ` (${s.dosage})` : ""}${s.qty ? ` × ${s.qty}` : ""}</td>
     <td style="text-align:right">₹${(s.amount || 0).toFixed(2)}</td></tr>`
  ).join("");

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Receipt - ${bill.billNumber || ""}</title>${BASE_STYLE}</head><body>
    <div class="header-bar"></div>
    <div class="container">
      <div class="row" style="margin-bottom:10px">
        <div><h1 style="color:#085041">🦷 ${clinicName}</h1><div style="font-size:10px;color:#4a8070">Medical Services Receipt</div></div>
        <div style="text-align:right"><div style="font-size:10px">Receipt # ${bill.billNumber || "—"}</div><div style="font-size:10px">Date: ${dateStr}</div></div>
      </div>
      <hr class="divider">
      <div class="meta-box row">
        <div><div class="label">Patient</div><div class="value">${bill.patientName}</div></div>
        ${bill.patientPhone ? `<div><div class="label">Phone</div><div class="value">${bill.patientPhone}</div></div>` : ""}
        ${bill.patientEmail ? `<div><div class="label">Email</div><div class="value">${bill.patientEmail}</div></div>` : ""}
        <div><div class="label">Payment</div><div class="value">${bill.paymentMethod || "Cash"} &nbsp;<span class="badge-${status}">${statusLabel}</span></div></div>
      </div>

      ${serviceItems.length ? `<h2 style="margin-top:10px">Dental Services</h2>
      <table><thead><tr><th>Description</th><th style="text-align:right">Amount</th></tr></thead>
      <tbody>${svcRows}</tbody></table>` : ""}

      ${pharmItems.length ? `<h2 style="margin-top:8px">Pharmacy / Medication</h2>
      <table><thead><tr><th>Item</th><th style="text-align:right">Amount</th></tr></thead>
      <tbody>${pharmRows}</tbody></table>` : ""}

      <table style="margin-top:6px;width:260px;margin-left:auto">
        <tbody>
          <tr><td>Subtotal</td><td style="text-align:right">₹${subtotal.toFixed(2)}</td></tr>
          ${discPct > 0 ? `<tr><td>Discount (${discPct}%)</td><td style="text-align:right">-₹${discAmt.toFixed(2)}</td></tr>` : ""}
          ${taxPct  > 0 ? `<tr><td>Tax (${taxPct}%)</td><td style="text-align:right">+₹${taxAmt.toFixed(2)}</td></tr>` : ""}
          <tr class="total-row"><td>Total</td><td style="text-align:right">₹${total.toFixed(2)}</td></tr>
        </tbody>
      </table>

      ${bill.notes ? `<div style="font-size:10px;margin-top:6px;color:#4a8070">Notes: ${bill.notes}</div>` : ""}
      <div style="text-align:center;margin-top:14px;font-size:10px;color:#4a8070">Thank you for choosing ${clinicName}!</div>
    </div>
    <div class="footer-bar"></div>
    <div class="footer-text">Powered by BookMySlot</div>
  </body></html>`;
  openPrintWindow(html);
}

export function printConsentDocument(booking: {
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  customerAge?: number | null;
  customerGender?: string | null;
  consentSignature?: string | null;
  consentSignedAt?: Date | string | null;
  slot?: { startTime: Date | string; endTime: Date | string };
}, clinicName: string) {
  const aptDate = booking.slot ? format(new Date(booking.slot.startTime), "EEEE, dd MMMM yyyy 'at' hh:mm a") : "—";
  const signedAt = booking.consentSignedAt ? format(new Date(booking.consentSignedAt), "dd MMMM yyyy 'at' hh:mm a") : "";

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Digital Consent - ${booking.customerName}</title>${BASE_STYLE}</head><body>
    <div class="header-bar"></div>
    <div class="container">
      <div style="text-align:center;margin-bottom:12px">
        <h1 style="color:#085041;font-size:16px">🦷 ${clinicName}</h1>
        <div style="font-size:11px;color:#4a8070;margin-top:2px">Digital Informed Consent Form</div>
      </div>
      <hr class="divider">
      <h2 style="margin-bottom:6px">Patient Details</h2>
      <table>
        <tbody>
          <tr><td class="label">Name</td><td>${booking.customerName}</td></tr>
          ${booking.customerPhone ? `<tr><td class="label">Phone</td><td>${booking.customerPhone}</td></tr>` : ""}
          ${booking.customerEmail ? `<tr><td class="label">Email</td><td>${booking.customerEmail}</td></tr>` : ""}
          ${booking.customerAge ? `<tr><td class="label">Age</td><td>${booking.customerAge}</td></tr>` : ""}
          ${booking.customerGender ? `<tr><td class="label">Gender</td><td style="text-transform:capitalize">${booking.customerGender}</td></tr>` : ""}
          <tr><td class="label">Appointment</td><td>${aptDate}</td></tr>
        </tbody>
      </table>

      <h2 style="margin:12px 0 6px">Consent Declaration</h2>
      <div class="meta-box" style="font-size:11px;line-height:1.6">
        <p>I, <strong>${booking.customerName}</strong>, hereby give my informed consent to <strong>${clinicName}</strong> to perform dental examination and any necessary dental treatment deemed appropriate by the treating dentist.</p>
        <p style="margin-top:8px">I understand and acknowledge the following:</p>
        <ul style="margin:6px 0 0 16px">
          <li>The nature of the proposed treatment has been explained to me.</li>
          <li>No guarantee has been made regarding the outcome of treatment.</li>
          <li>I have been informed of the risks and alternatives.</li>
          <li>I have the right to withdraw consent at any time before treatment begins.</li>
        </ul>
        <p style="margin-top:8px">By signing below, I confirm that I have read and understood the above and voluntarily consent to the dental care at <strong>${clinicName}</strong>.</p>
      </div>

      <h2 style="margin:12px 0 6px">Patient Signature</h2>
      <div style="display:flex;gap:16px;align-items:flex-end">
        <div style="flex:1">
          <div class="sig-box">
            ${booking.consentSignature
              ? `<img src="${booking.consentSignature}" alt="Signature" />`
              : `<div style="color:#9ab8b0;font-size:10px">Signed digitally</div>`}
          </div>
          ${signedAt ? `<div style="font-size:9px;color:#4a8070;margin-top:4px">Signed digitally on: ${signedAt}</div>` : ""}
        </div>
      </div>

      <div style="margin-top:10px;font-size:9px;color:#9ab8b0">IP address recorded for audit purposes. This is a legally binding digital consent.</div>
      <hr class="divider" style="margin-top:12px">
      <div style="text-align:center;font-size:10px;color:#4a8070">Thank you for choosing ${clinicName}!</div>
      <div style="text-align:center;font-size:9px;color:#9ab8b0;margin-top:2px">This document was generated by BookMySlot and serves as the official digital consent record.</div>
    </div>
    <div class="footer-bar"></div>
    <div class="footer-text">Powered by BookMySlot</div>
  </body></html>`;
  openPrintWindow(html);
}

export function printClinicalRecord(record: {
  patientName: string;
  patientPhone?: string | null;
  doctorName?: string | null;
  bookingId?: number | null;
  diagnosis?: string[] | null;
  notes?: string | null;
  prescription?: string | null;
  createdAt?: Date | string | null;
}, clinicName?: string) {
  const dateStr = record.createdAt ? format(new Date(record.createdAt), "MMMM d, yyyy · h:mm a") : format(new Date(), "MMMM d, yyyy");
  const docType = record.prescription ? "Prescription" : "Diagnosis Record";
  const diagArr: string[] = Array.isArray(record.diagnosis) ? record.diagnosis : [];

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${docType} - ${record.patientName}</title>${BASE_STYLE}</head><body>
    <div class="header-bar"></div>
    <div class="container">
      <div class="row" style="margin-bottom:10px">
        <div>
          <h1 style="color:#085041">🦷 ${clinicName || "Clinic"}</h1>
          <div style="font-size:10px;color:#4a8070">Caring for Your Smile</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:10px;color:#085041;font-weight:600">${docType}</div>
          <div style="font-size:10px;color:#4a8070">Date: ${format(record.createdAt ? new Date(record.createdAt) : new Date(), "MMM d, yyyy")}</div>
        </div>
      </div>
      <hr class="divider">
      <h2 style="margin-bottom:6px">Patient Information</h2>
      <table>
        <tbody>
          <tr><td class="label" style="width:120px">Name</td><td>${record.patientName}</td></tr>
          ${record.patientPhone ? `<tr><td class="label">Phone</td><td>${record.patientPhone}</td></tr>` : ""}
          ${record.doctorName ? `<tr><td class="label">Attending Doctor</td><td>Dr. ${record.doctorName}</td></tr>` : ""}
          <tr><td class="label">Record Date</td><td>${dateStr}</td></tr>
          ${record.bookingId ? `<tr><td class="label">Ref #</td><td>${String(record.bookingId).padStart(4, "0")}</td></tr>` : ""}
        </tbody>
      </table>

      ${diagArr.length > 0 ? `
      <h2 style="margin:10px 0 6px">Diagnosis</h2>
      <table>
        <tbody>
          <tr><td class="label" style="width:120px">Findings</td><td>${diagArr.join(" · ")}</td></tr>
          ${record.notes ? `<tr><td class="label">Notes</td><td>${record.notes}</td></tr>` : ""}
        </tbody>
      </table>` : ""}

      ${record.prescription ? `
      <h2 style="margin:10px 0 6px">Prescription</h2>
      <div class="meta-box" style="font-size:11px;white-space:pre-wrap;line-height:1.7">${record.prescription}</div>` : ""}

      <div style="text-align:center;margin-top:16px;font-size:10px;color:#4a8070">Thank you for choosing ${clinicName || "us"}!</div>
      <div style="text-align:center;font-size:9px;color:#9ab8b0;margin-top:2px">This is a computer generated clinical record. Generated by BookMySlot.</div>
    </div>
    <div class="footer-bar"></div>
    <div class="footer-text">Powered by BookMySlot</div>
  </body></html>`;
  openPrintWindow(html);
}
