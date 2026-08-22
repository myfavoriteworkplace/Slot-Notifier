# BookMySlot — Receipt PDF Template Reference

This document describes the visual structure, colour palette, and section conventions used in all BookMySlot receipt PDFs. Follow this guide whenever adding new sections or generating additional PDF types.

---

## 1. Colour Palette

All colours are defined as `[r, g, b]` tuples for jsPDF.

| Token | RGB | Hex | Usage |
|---|---|---|---|
| `indigoDark` | `[8, 80, 65]` | `#085041` | Header/footer gradient start, divider lines, table headers |
| `magenta` | `[29, 158, 117]` | `#1D9E75` | Header/footer gradient end |
| `indigoMid` | `[15, 155, 110]` | `#0F9B6E` | Medical cross, clinic name accent, section labels |
| `lightBg` | `[225, 245, 238]` | `#E1F5EE` | Alternating row fills, payment box background |
| `metaBg` | `[209, 237, 226]` | `#D1EDE2` | Meta band background (date/receipt row) |
| `totalRowBg` | `[193, 229, 215]` | `#C1E5D7` | "Total Amount Due" highlighted row background |
| `textDark` | `[8, 40, 32]` | `#082820` | Primary text (clinic name, totals, bold values) |
| `textMid` | `[50, 100, 80]` | `#326450` | Secondary text (labels, table body) |
| `textLight` | `[150, 148, 180]` | `#9694B4` | Disclaimer / fine print |
| `white` | `[255, 255, 255]` | `#FFFFFF` | Table headers, gradient bar text |

**Status colours (Payment Status badge):**
| Status | RGB |
|---|---|
| Paid | `[22, 163, 74]` (green-600) |
| Partial | `[37, 99, 235]` (blue-600) |
| Pending | `[217, 119, 6]` (amber-600) |

---

## 2. Page Layout Constants

```
pageWidth  = 210mm  (A4 portrait)
pageHeight = 297mm
margin     = 14mm   (left and right)
```

---

## 3. Section Structure (top to bottom)

### 3.1 Top Gradient Bar (y=0, h=7mm)
```
[indigoDark ─── 55% of width ───][magenta ─── 45% ───]
```
- Left half: `indigoDark`  
- Right half: `magenta`  
- No text in this bar.

### 3.2 Clinic Header (y=7–33mm)

**Left side:**
- Medical cross icon: drawn with two `doc.rect()` calls at `x=margin, y=12`
  - Vertical arm: `x + (cs−cw)/2, y, cw, cs` where `cs=4.5`, `cw=1.4`
  - Horizontal arm: `x, y + (cs−cw)/2, cs, cw`
- Clinic name: `fontSize=19, font=bold, textColor=textDark`, at `nameX=margin+cs+3, y=20`
- Tagline: `fontSize=8, font=normal, textColor=indigoMid`, at same x, `y=27`  
  Default tagline: `"Caring for Your Smile"`

**Right side (right-aligned at `pageWidth − margin`):**
- Phone, email, address in `fontSize=7.5, textColor=textMid`
- Each line `+4.2mm` vertical spacing, starting at `y=11`

**Divider:** `doc.line(margin, 33, pageWidth−margin, 33)`, `lineWidth=0.5, drawColor=indigoDark`

### 3.3 Meta Band (y=34, h=17mm)
Background: `metaBg` rectangle spanning `margin → pageWidth−margin`.

Two rows of text:
- **Row 1** (`y=metaY+5.5`): `Receipt # … | Visit ID: … | Dr. … | Date: …`
  - Receipt # — left aligned, `textMid`
  - Visit ID + Doctor — centred, `textMid`
  - Date — right aligned, `bold, indigoDark`
- **Row 2** (`y=metaY+12.5`): `Payment Mode: Cash` (left) | `✓ Paid` (right, status colour)

### 3.4 Patient Information Table (autoTable)
```
startY = metaY + 17 + 5
theme  = "grid"
head   = [["Patient Information", ""]]
body   = Name | Phone | Email | Appointment Date | Doctor (if present)
```
- Header: `fillColor=indigoDark, textColor=white, fontSize=9`
- Col 0 (label): `fontStyle=bold, cellWidth=48, fillColor=lightBg, fontSize=8`
- Col 1 (value): `textColor=textMid, fontSize=8`
- Cell padding: `{top:2.5, bottom:2.5, left:5, right:5}`

### 3.5 Prescription Summary Table (autoTable) — pharmacy items only
Shown only when services with `category === "Pharmacy"` exist.

```
theme = "grid"
head  = [["Prescription Summary", "Dosage", "Qty", "Freq.", "Duration", "Price"]]
body  = [[medicine, dosage, qty, frequency, duration, "₹X.XX"], ...]
```
- Header: same style as Patient Info header
- Column widths: `[auto, 20, 12, 16, 18, 22]`
- Col 2 (Qty), Col 3 (Freq.), Col 4 (Duration): `halign="center"`
- Col 5 (Price): `halign="right"`
- Alternate row fill: `[240, 250, 246]`
- Cell padding: `{top:2, bottom:2, left:4, right:4}`

### 3.6 Service Summary Table (autoTable) — non-pharmacy items
Shown only when services with `category !== "Pharmacy"` exist.

```
theme = "striped"
head  = [["Service Summary", "Category", "Amount"]]
body  = [[description, category, "₹X.XX"], ...]
```
- Header: same style
- Col 1 (Category): `cellWidth=38`
- Col 2 (Amount): `halign="right", cellWidth=32`
- Alternate row fill: `[248, 251, 249]`

### 3.7 Totals Block (autoTable, right-aligned)
```
startY     = afterServicesY
marginLeft = pageWidth / 2 + 3
body = [
  ["Subtotal",          "₹X.XX"],
  ["Discount (N%)",     "− ₹X.XX"],
  ["Tax / GST (N%)",    "+ ₹X.XX"],
  ["Total Amount Due",  "₹X.XX"],   ← highlighted row (totalRowBg)
]
```
- Col 0: `halign="right", cellWidth=50, textColor=textMid`
- Col 1: `halign="right", cellWidth=36, textColor=textDark`
- Row 3 fill: `totalRowBg`, text: `bold, indigoDark` (via `willDrawCell`/`didDrawCell`)

### 3.8 Payment Details Box
A rounded rectangle at full width (`margin → pageWidth−margin`), height ~26mm, below totals.

Contents (left side):
- `"PAYMENT DETAILS"` label: `fontSize=7, bold, textColor=indigoMid`
- Payment method: `fontSize=9, bold, textColor=textDark`
- Transaction ID (if set): `fontSize=7.5, normal, textColor=textMid`
- Status: `fontSize=8, bold`, coloured by status

Contents (right side — 22mm × 22mm QR code):
- Generated by `buildQRDataUrl()` helper
- Encodes: `Receipt:{receiptNo}|Clinic:{name}|Patient:{name}|Total:{total}`
- Drawn with `doc.addImage(qrDataUrl, 'PNG', qrX, qrY, 22, 22)`

### 3.9 Thank-You Footer
```
[indigoMid divider line]
"Thank you for choosing {clinicName}!"  ← fontSize=10, bold, indigoMid, centred
"This is a computer generated receipt..."  ← fontSize=6.5, normal, textLight, centred
```

### 3.10 Bottom Gradient Bar (same as top, at pageHeight−8)
```
[indigoDark ─── 55% ───][magenta ─── 45% ───]
"Powered by BookMySlot"  ← centred, white, fontSize=7.5
```

---

## 4. QR Code Helper (`buildQRDataUrl`)

Uses the `qr.js` package (CJS, bundled as a dependency of `react-qr-code`).

```typescript
// @ts-ignore
import QRLib from 'qr.js';

const buildQRDataUrl = (text: string): string => {
  try {
    const qr = (QRLib as any)(text);
    const cells: boolean[][] = qr.modules;
    const sz = 3;          // pixels per QR cell
    const pad = sz * 2;    // quiet zone padding
    const dim = cells.length * sz + pad * 2;
    const canvas = document.createElement('canvas');
    canvas.width = dim; canvas.height = dim;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, dim, dim);
    ctx.fillStyle = '#085041';                     // dark green modules
    cells.forEach((row, r) => row.forEach((on, c) => {
      if (on) ctx.fillRect(pad + c * sz, pad + r * sz, sz, sz);
    }));
    return canvas.toDataURL('image/png');
  } catch { return ''; }                           // graceful fallback
};
```

The returned PNG data-URL is embedded via `doc.addImage(url, 'PNG', x, y, w, h)`.

---

## 5. autoTable Common Conventions

Every `autoTable` call follows these rules:
- `margin: { left: margin, right: margin }` (or `left: pageWidth/2+3` for right-side totals)
- `cellPadding: { top: 2.5, bottom: 2.5, left: 5, right: 5 }` for normal tables
- `cellPadding: { top: 2, bottom: 2, left: 4, right: 4 }` for compact prescription tables
- `fontSize: 9` in headers, `fontSize: 8` in body
- Track the `finalY` position with `(doc as any).lastAutoTable.finalY`

---

## 6. Adding a New Section

1. After the previous `autoTable`, read `currentY = (doc as any).lastAutoTable.finalY + gap`
2. Draw your section starting at `currentY`
3. If using `autoTable`, it will update `lastAutoTable.finalY` — read it for the next section
4. If drawing manually (rect, text), track your own `currentY` variable

Example — adding a "Lab Results" section:
```typescript
if (labResults.length > 0) {
  autoTable(doc, {
    startY: currentY,
    head: [["Lab Results", "Value", "Reference"]],
    body: labResults.map(r => [r.test, r.value, r.reference]),
    theme: "grid",
    headStyles: { fillColor: indigoDark, textColor: white, fontSize: 9, ... },
    columnStyles: { 0: { textColor: textDark, fontSize: 8 }, ... },
    margin: { left: margin, right: margin },
  });
  currentY = (doc as any).lastAutoTable.finalY + 5;
}
```

---

## 7. Two PDF Entry Points

| Function | Source data | Trigger |
|---|---|---|
| `generatePDF()` | `billingDetails` state (from modal) | "Print & Save" / "Print & Download" button in modal |
| `printBillFromRecord(bill)` | `PatientBill` object + `bookings[]` context | Printer icon in individual bill card header |

Both functions use the same colour palette, layout constants, and QR helper. When making layout changes, apply them to **both** functions to keep them in sync.
