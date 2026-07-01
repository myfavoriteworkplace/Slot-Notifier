# Billing & Accounting Module

**BookMySlot Dental — Technical Reference**
Last updated: June 2026

---

## Table of Contents

1. [Overview](#overview)
2. [Data Model](#data-model)
3. [Bill Lifecycle](#bill-lifecycle)
4. [Frontend: BillingHistoryPanel](#frontend-billinghistorypanel)
5. [Backend: API Endpoints](#backend-api-endpoints)
6. [Accounting Linkages](#accounting-linkages)
7. [Audit Trail](#audit-trail)
8. [Pharmacy Integration](#pharmacy-integration)
9. [Prescription Auto-Billing](#prescription-auto-billing)
10. [PDF & Receipt Generation](#pdf--receipt-generation)
11. [Known Rules & Guards](#known-rules--guards)
12. [Future Accounting Integrations](#future-accounting-integrations)

---

## Overview

The billing module lets clinic staff create itemised bills against a patient booking, record payment, and generate PDF receipts. It is tightly coupled to three other modules:

| Connected Module | How it links |
|---|---|
| **Bookings** | Every bill has a `bookingId` foreign key. A booking can have multiple bills (e.g. one per visit). |
| **Pharmacy / Stock** | Prescription items are auto-priced by matching drug names against the `pharmacy_stock` catalog. |
| **Clinical Records** | The doctor's prescription (stored as JSON in `clinical_records.prescription`) is the source of truth for pharmacy line items. |
| **Patients** | Bills carry `patientId` FK (links to the `patients` table), plus snapshot fields `patientName`, `patientPhone`, `patientEmail` for receipts. The `patientId` FK is the canonical identifier for grouping, history, and the Accounts ledger. |
| **Notifications** | On payment, a "bill paid" notification is dispatched to the patient via the notification service. |

---

## Data Model

### `patient_bills` table (`shared/schema.ts → patientBills`)

| Column | Type | Description |
|---|---|---|
| `id` | serial PK | Auto-incremented bill ID |
| `bookingId` | integer FK | Links to `bookings.id` |
| `clinicId` | integer FK | Links to `clinics.id` |
| `patientId` | integer FK (nullable) | Links to `patients.id` — **primary patient identifier**; used for grouping in Accounts ledger and patient history lookup. Null only for very old bills migrated before this field was added. |
| `billNumber` | text | Human-readable bill reference (e.g. `DFT-42-1712345678901`) |
| `patientName` | text | Snapshot of patient name at time of billing |
| `patientPhone` | text | Patient phone for lookup and receipts |
| `patientEmail` | text | Patient email for receipt delivery |
| `services` | jsonb | Array of `ServiceItem` objects — the line items |
| `subtotal` | numeric | Sum of all line item amounts before discount/tax |
| `discountPct` | numeric | Discount percentage (0–100) |
| `taxPct` | numeric | Tax percentage (0–100, e.g. GST 18) |
| `total` | numeric | Final amount after discount and tax |
| `paymentStatus` | text | `draft` / `pending` / `partial` / `paid` |
| `paymentMethod` | text | `Cash` / `UPI` / `Card` / `Insurance` / `Online` |
| `amountReceived` | numeric | Actual cash/transfer received |
| `cashierId` | text | Name of staff who recorded the payment |
| `cashierNotes` | text | Free-text notes from the cashier |
| `createdAt` | timestamp | Auto-set on insert |
| `updatedAt` | timestamp | Auto-updated on every change |

#### `ServiceItem` (stored inside `services` JSONB array)

```ts
interface ServiceItem {
  description: string;   // Display name on receipt
  category: string;      // "Consultation" | "Procedure" | "Treatment" | "Pharmacy" | "Consumable" | "Other"
  amount: number;        // Total amount for this line (= qty × unitPrice)
  paid: boolean;         // True once the bill is marked paid
  qty?: number;          // Quantity (optional, shown as "3×₹50")
  unitPrice?: number;    // Price per unit (optional, for qty-based items)
}
```

---

### `billing_audit_logs` table (`shared/schema.ts → billingAuditLogs`)

Immutable log of every significant billing event.

| Column | Type | Description |
|---|---|---|
| `id` | serial PK | Auto-incremented log ID |
| `clinicId` | integer | Clinic context |
| `bookingId` | integer (nullable) | Booking the log entry belongs to |
| `billId` | integer (nullable) | Specific bill affected (nullable for booking-level events) |
| `action` | text | Machine-readable action key (see table below) |
| `details` | jsonb | Arbitrary detail payload (amounts, names, etc.) |
| `performedBy` | text (nullable) | Staff identifier (cashier name, doctor name) |
| `createdAt` | timestamp | Auto-set on insert |

#### Audit action keys

| Action key | Meaning |
|---|---|
| `prescription_loaded` | Rx items imported into a bill from clinical records |
| `item_added` | A manual line item was added |
| `item_removed` | A line item was deleted |
| `item_amount_changed` | An item amount was inline-edited |
| `bill_confirmed` | Draft bill was confirmed to pending/active |
| `bill_paid` | Bill marked fully paid (includes cashier + method) |
| `bill_deleted` | Unpaid bill was deleted |

---

## Bill Lifecycle

```
[No bill]
    │
    ├─ "Load Prescription" or "Add New Entry"
    │
    ▼
[DRAFT]  ──── items can be added/removed/edited freely
    │
    ├─ "Confirm Bill" button
    ▼
[PENDING]  ──── outstanding, items still editable (unpaid only)
    │
    ├─ partial payment recorded
    ▼
[PARTIAL]  ──── some items paid; paid items are locked
    │
    ├─ "Mark Paid" → cashier form submitted
    ▼
[PAID]  ──── fully settled; all items locked; bill cannot be deleted
```

**Key invariants enforced in code:**

- A `paid` bill is **never** modified. `findActiveBill()` skips paid bills entirely.
- Individual line items inside a paid bill have `paid: true` and display a 🔒 lock icon — they cannot be deleted.
- The cashier form pre-fills with the **unpaid items total** (not `bill.total`) so partial payments are handled correctly.
- If all existing bills are paid and new items need to be added (e.g. loading prescription after payment), a **new draft bill** is created automatically.

---

## Frontend: BillingHistoryPanel

**File:** `client/src/components/BillingHistoryPanel.tsx`

The panel is embedded inside the booking card on the Clinic Dashboard (`ClinicDashboard.tsx`). It receives:

```ts
interface BillingHistoryPanelProps {
  bookingId: number;
  clinicId: number;
  patientName: string;
  patientId?: number;        // FK to patients.id — used for history lookup and bill creation
  patientPhone?: string;
  patientEmail?: string;
  patientCode?: string;      // e.g. "PAT-0042" — shown as a badge at the top of the panel
  onGenerateReceipt: (existingBill?: PatientBill) => void;
  onPrintBill: (bill: PatientBill) => void;
  onConsolidatedReceipt?: (bills: PatientBill[]) => void;
}
```

### Sections rendered

| Section | Purpose |
|---|---|
| **Open Invoice (active bill)** | Unified card with a sticky toolbar (Load Prescription, Add Entry, Print, Invoice Preview, Confirm Bill / Mark Paid). Collapsible body via chevron. Consultation & Procedures table, Pharmacy table (medicine name + schedule parsed from description), Other flat rows, Discount %/Tax % inputs, Totals bar. Active bill card has a green-tinted border/background (`border-primary/40`, `bg-primary/10`). |
| **No-bill state** | When no open bill exists, standalone toolbar buttons + Add Entry form are shown directly (no wrapper card). |
| **Unpriced pharmacy warning** | Amber banner when any pharmacy line item has amount = ₹0 (awaiting catalog price). |
| **Add Entry form** | Description, category dropdown (Consultation / Procedure / Treatment / Pharmacy / Consumable / Other), qty, unit price. Collapses after save. |
| **Older bills** | Past bills for the current booking, grouped by date with date-divider labels. Each bill card shows: bill number, status badge, item count, total, expand/collapse, cashier payment form, Confirm / Mark Paid / Print / Delete actions. Items inside are split into the same three category tables (Consultation & Procedures, Pharmacy, Other). |
| **Previous visits** | Past bills for the same patient (by email or phone) across other bookings. Collapsed by default. Shows bill number, status badge, and total per visit. |
| **Past prescriptions** | Prescriptions from earlier visits — each shows date, doctor, and first two medicines. "Load" button re-imports into the current bill. |
| **Audit trail** | Collapsible log of all billing events for this booking (lazy-loaded on first open). Shows action label (colour-coded), optional description, timestamp, cashier name, and amount. |
| **Invoice Preview Modal** | Full-screen printable preview with categorised groups and totals, showing all bills for the visit. |

### Category grouping rules

Line items are split into three display groups in both the open invoice and older bill cards:

| Display group | `category` values included |
|---|---|
| Consultation & Procedures | `Consultation`, `Procedure`, `Treatment`, `Consumable` |
| Pharmacy | `Pharmacy` |
| Other | anything else |

### Pharmacy description parsing (`parsePharmacyDesc`)

Pharmacy items stored as `"MedicineName × qty — schedule"` are parsed into:
- **medicine** — text before `×`
- **schedule** — text after the quantity number (frequency + duration, e.g. `1×/day · 5 days`)

### Patient identity strip

When `patientCode` is provided, a compact rose-tinted badge row is rendered at the top of the billing panel showing the patient name + PAT code (e.g. `PAT-0042`). This confirms which patient profile is linked to the current bill — useful for reception staff who handle multiple walk-ins.

### Patient history query — identifier priority

The "Previous visits" section uses this waterfall to find the right bills:

1. `patientId` → `GET /api/auth/clinic/bills/patient-by-id/:patientId` (most reliable — FK join)
2. `patientEmail` → `GET /api/auth/clinic/bills/patient-by-email/:email`
3. `patientPhone` → `GET /api/auth/clinic/bills/patient/:phone`

This order is intentional: `patientId` is the canonical FK; text-based fallbacks handle legacy bills that predate the `patientId` column.

### New bill creation — `patientId` is always included

Every code path that creates a new `patient_bills` row sends `patientId`:
- **Inline "Add Entry"** (`addChargeMutation`) — includes `patientId` from props
- **"New Bill" button** (`createNewBillMutation`) — includes `patientId` from props
- **"Load Prescription"** when no active bill exists — includes `patientId` from props
- **Legacy PDF receipt modal** (`handleOpenBilling` in `ClinicDashboard.tsx`) — includes `(billingBooking as any).patientId` which is populated from `getClinicBookings`'s LEFT JOIN with the `patients` table

### Data queries (TanStack Query v5)

| Query key | Endpoint | Purpose |
|---|---|---|
| `["/api/auth/clinic/bills/booking", bookingId]` | GET | All bills for current booking |
| `["/api/auth/clinic/bills/patient-history", patientId\|email\|phone]` | GET | Patient history across visits (uses patientId first) |
| `["/api/auth/clinic/pharmacy"]` | GET | Catalog for auto-pricing |
| `["/api/auth/clinic/clinical-records/patient", phone]` | GET | Past prescriptions |
| `["/api/auth/clinic/billing-audit/booking", bookingId]` | GET | Audit trail (lazy) |

---

## Backend: API Endpoints

All billing routes are under `/api/auth/clinic/` and require clinic authentication (`isAuthenticated` middleware).

### Bill CRUD

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/auth/clinic/bills/booking/:bookingId` | All bills for a booking |
| `GET` | `/api/auth/clinic/bills/patient-by-id/:patientId` | All bills for a patient by FK (preferred) |
| `GET` | `/api/auth/clinic/bills/patient-by-email/:email` | All bills for a patient email (fallback) |
| `GET` | `/api/auth/clinic/bills/patient/:phone` | All bills for a patient phone (fallback) |
| `POST` | `/api/auth/clinic/bills` | Create a new bill — body must include `patientId` when available |
| `PATCH` | `/api/auth/clinic/bills/:id` | Update bill (items, status, totals) |
| `DELETE` | `/api/auth/clinic/bills/:id` | Delete a bill (unpaid only) |
| `POST` | `/api/auth/clinic/bills/:id/notify-paid` | Send "paid" notification to patient — fetches single bill by ID directly (not all bills) |

### Audit logs

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/clinic/billing-audit` | Create audit log entry |
| `GET` | `/api/auth/clinic/billing-audit/booking/:bookingId` | Fetch audit trail for a booking |

---

## Accounting Linkages

The billing module does not yet connect to an external accounting system (e.g. Tally, QuickBooks, Zoho Books), but the data structure is designed to support it cleanly.

### How totals are computed

```
subtotal = sum of all service item amounts
discount = subtotal × (discountPct / 100)
tax      = (subtotal − discount) × (taxPct / 100)
total    = subtotal − discount + tax
```

These three figures (`subtotal`, `discountPct`/`taxPct`, `total`) are stored on the bill record, making it trivial to export them to any accounting system.

### Revenue recognition

| Status | Accounting treatment |
|---|---|
| `draft` | Not yet a receivable — do not book |
| `pending` | Recognised as accounts receivable |
| `partial` | Split: `amountReceived` = cash received; `total − amountReceived` = outstanding receivable |
| `paid` | Revenue fully recognised; debit Cash/Bank, credit Revenue |

### Category → Revenue account mapping (recommended)

When exporting to an accounting system, map the `category` field of each service item to a ledger account:

| Category | Suggested ledger account |
|---|---|
| `Consultation` | Professional Fees Income |
| `Procedure` | Procedure Revenue |
| `Treatment` | Treatment Revenue |
| `Pharmacy` | Pharmacy / Drug Sales |
| `Consumable` | Consumables Revenue |
| `Other` | Miscellaneous Income |

### GST / Tax

`taxPct` is stored per-bill. When India GST is applicable:
- Set `taxPct = 18` (standard rate) or `5` (reduced, for certain dental services)
- The computed `tax` amount is the GST collected
- For filing returns: sum `tax` across all `paid` bills for the period

### Daily collection summary (manual query)

```sql
SELECT
  DATE(updated_at)      AS date,
  payment_method,
  COUNT(*)              AS bill_count,
  SUM(amount_received)  AS cash_collected,
  SUM(total)            AS total_billed,
  SUM(total - amount_received) AS outstanding
FROM patient_bills
WHERE clinic_id = <clinic_id>
  AND payment_status = 'paid'
  AND updated_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(updated_at), payment_method
ORDER BY date DESC;
```

---

## Audit Trail

Every material billing event is written to `billing_audit_logs` by the frontend (via `POST /api/auth/clinic/billing-audit`). This is a **non-blocking** call — if it fails, the main operation still succeeds.

The audit trail is surfaced in the panel under the collapsible "Audit Trail" section at the bottom of each booking's billing card. It lazy-loads only when the user expands the section.

**Why non-blocking:** The audit log is supplementary. A network error writing the log should never prevent a payment from being recorded.

**What's captured per entry:**

- Action key (see table above)
- Affected bill ID + booking ID
- Details payload (e.g. `{ description, amount, cashierName, paymentMethod }`)
- Timestamp (auto)
- Clinic ID (for multi-tenant isolation)

---

## Pharmacy Integration

When a doctor saves a prescription in the Clinical Records tab, it is stored as a JSON array in `clinical_records.prescription`:

```json
[
  { "name": "Amoxicillin", "dosage": "500mg", "qty": "14", "frequency": "Twice daily", "duration": "7 days" },
  { "name": "Ibuprofen", "dosage": "400mg", "qty": "10", "frequency": "As needed", "duration": "5 days" }
]
```

When staff click **Load Prescription** in the billing panel:

1. The active clinical record for the booking is fetched.
2. Each drug name is matched (case-insensitive, exact) against `pharmacy_stock.medicineName`.
3. If a match is found, `unitPrice` is pulled from the catalog and `amount = qty × unitPrice`.
4. If no match, `amount = 0` — the item appears with an amber "needs pricing" warning.
5. Duplicate detection: items already on the bill (matched by first word of description + category = Pharmacy) are skipped.
6. Items are added to the active (non-paid) draft bill, or a new draft is created if all existing bills are paid.

### Keeping the catalog current

Prices in `pharmacy_stock` are maintained by the clinic via the **Pharmacy Stock** tab on the dashboard. For auto-pricing to work accurately, medicine names must match exactly (including spelling) between the prescription and the catalog.

---

## Prescription Auto-Billing

The full flow from doctor to billing:

```
Doctor saves prescription (Clinical Records tab)
      │
      ▼
clinical_records.prescription = JSON array
      │
      ▼ (staff clicks "Load Prescription")
BillingHistoryPanel → GET /api/clinical-records/booking/:id
      │
      ▼
Match each drug against pharmacy_stock catalog
      │
      ├─ match found  → amount = qty × catalog unitPrice
      └─ no match     → amount = 0 (amber warning shown)
      │
      ▼
Items appended to active draft bill
(or new draft bill created if all bills are paid)
      │
      ▼
Staff reviews, edits amounts if needed, confirms bill
      │
      ▼
Patient pays → cashier records payment → "Mark Paid"
      │
      ▼
Patient notified + audit log entry written
```

---

## PDF & Receipt Generation

Receipt generation is handled by the parent component (`ClinicDashboard.tsx`) via the callbacks passed into `BillingHistoryPanel`:

| Callback | Triggered by | What it does |
|---|---|---|
| `onGenerateReceipt(bill)` | "Receipt" button on single bill | Opens the receipt PDF generator with that bill's data |
| `onPrintBill(bill)` | "Print" button on expanded bill | Direct print of the individual bill |
| `onConsolidatedReceipt(bills[])` | "Consolidated PDF" button (multi-bill) | Combines all bills for the visit into one PDF |

The panel itself handles the **Invoice Preview Modal** (click "Preview" in the header) which renders a categorised summary inside a `Dialog` — useful for a quick screen-only review before printing.

---

## Known Rules & Guards

These are enforced in code and must be maintained:

1. **Never modify a paid bill.** `findActiveBill()` in `BillingHistoryPanel.tsx` explicitly skips bills with `paymentStatus === "paid"`. Any new prescription load or manual add goes to an unpaid bill or creates a new draft.

2. **Paid line items are locked.** Each `ServiceItem` with `paid: true` (or whose parent bill is paid) renders a 🔒 lock icon instead of a delete button. The delete handler also checks this client-side.

3. **Cashier form pre-fills unpaid total.** The "Amount Received" field is initialised to `services.filter(s => !s.paid).reduce(sum of amounts)`, not `bill.total`. This handles the partial-payment case correctly.

4. **Deduplication on prescription load.** Checked by matching the **first word** of the description (lowercased) within the `Pharmacy` category. This prevents the same drug being double-loaded if "Load Prescription" is clicked twice.

5. **Unique bill numbers.** Generated as `DFT-{bookingId}-{Date.now()}`. The `Date.now()` suffix ensures no two bills for the same booking ever share a number.

6. **Draft bills are not receivables.** The "Confirm Bill" button transitions a bill from `draft` → `pending`/`partial`. Only confirmed bills should appear in any accounts receivable report.

7. **`patientId` must always be sent on bill creation.** All four bill-creation paths (inline Add Entry, New Bill button, Load Prescription, legacy PDF modal) forward the booking's `patientId` to the POST body. Without it, the bill cannot be grouped correctly in the Accounts ledger or linked to the Patients panel. If `patientId` is unavailable (legacy walk-in with no registered patient), pass `null` — text-based fallbacks (email → phone) will still work for history lookup.

8. **Accounts ledger grouping uses `patientId` as primary key.** The Accounts panel groups bills by `patientId` first; falls back to `email`, then `phone`, then name for legacy bills. Never group solely by text fields — phone formatting differences and name variations create duplicate patient groups.

9. **`notify-paid` uses `getPatientBillById` — not `getPatientBillsByClinicId`.** The route fetches one bill by `(id, clinicId)` directly. Do not revert this to loading all clinic bills and filtering in memory.

---

## Future Accounting Integrations

The following integrations are planned or straightforward to add:

| Integration | Approach |
|---|---|
| **Tally ERP** | Export daily paid bills as a CSV in Tally-compatible format (voucher type: Sales, ledger mapping by category) |
| **Zoho Books / QuickBooks** | Use their REST APIs; map `patient_bills` rows to `Invoice` objects; use `paymentMethod` for payment mode |
| **GST e-invoicing (India)** | Add `gstNumber` to clinic profile; populate IRN/QR on PDF receipts using the GST e-Invoice API |
| **Stripe / Razorpay** | Store `paymentGatewayRef` on the bill; webhook updates `paymentStatus` to `paid` automatically |
| **Bank reconciliation** | Aggregate `amountReceived` by `paymentMethod = 'UPI'/'Card'` daily; cross-check against bank statement imports |

To add any of these, the primary extension points are:
- A new column on `patient_bills` for the external reference ID
- A webhook/cron route in `server/routes.ts` that calls the external API after a bill is marked paid
- An export endpoint (e.g. `GET /api/auth/clinic/billing/export?from=&to=&format=csv`) that serialises bills with full ledger mapping
