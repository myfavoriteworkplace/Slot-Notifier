# Accounts & Patient Flow — Full Analysis

> Document created: June 2026. Covers the **Accounts** and **Patients** panels in the Clinic Dashboard, the patient identity model, patient-bill linkage, and all known inconsistencies.

---

## 1. Two Related But Separate Panels

| Panel | Nav label | `activePanel` value | Purpose |
|---|---|---|---|
| **Patient Directory** | Patients | `'patients'` | View and search all patient profiles; see full visit/billing history per patient |
| **Accounts** | Accounts | `'accounts'` | View all bills in two modes: Patient Ledger (grouped) and Transaction Register (flat) |

Both panels are in `client/src/pages/ClinicDashboard.tsx`.

---

## 2. Patient Identity Model

### DB Table: `patients`

| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | Internal DB ID — not shown to clinic staff |
| `patientCode` | varchar(20) | Human-readable ID: `PAT-0001`, `PAT-0042`, etc. Unique per clinic |
| `name` | varchar(255) | Full name |
| `email` | varchar(255) | Normalised to lowercase on write |
| `phone` | varchar(50) | |
| `clinicId` | integer FK → clinics | Every patient is scoped to one clinic |
| `visitCount` | integer | Incremented on each booking |
| `lastVisitAt` | timestamp | Updated on each booking |
| `createdAt` | timestamp | Auto |
| `age`, `gender`, `doctorId` | optional | Not used in main booking flow |

### `patientCode` Generation

```
seq  =  COUNT(patients WHERE clinicId = X) + 1
code =  `PAT-${seq.toString().padStart(4, '0')}`
```

Generated at **new record creation only** — never re-generated for existing patients.

**Risk:** If two patients are created simultaneously (race condition), they could receive the same `seq` and therefore the same `patientCode`. There is no database UNIQUE constraint on `patientCode`.

---

## 3. Patient Creation Paths

There are **four code paths** that create or find a patient record.

### 3a. `upsertPatientByEmail(clinicId, email, name, phone)`
- Looks up an existing patient by `(clinicId, email)`.
- If found: increments `visitCount`, updates `lastVisitAt`, updates name/phone if longer.
- If not found: creates a new patient with a new `patientCode`.

### 3b. `upsertPatientByPhone(clinicId, phone, name)`
- Same logic but matches on `(clinicId, phone)` instead.
- Used when a booking is created without an email address (admin walk-in, phone-only).

### 3c. `createNewPatient(clinicId, email, name, phone)`
- Always inserts a brand-new patient row (forced new profile — even if a record with the same email exists).
- Used when the patient explicitly selects "New Profile" during the public booking flow.

### 3d. `incrementPatientVisit(patientId)`
- Only increments `visitCount` / `lastVisitAt`. No create.
- Used when the patient selects an existing profile by `patientId` during public booking.

---

## 4. When a Patient Record Is Created

### 4a. Public Booking (OTP-verified patient, `POST /api/public/book`)

```
req.body.patientId = <existing id>   →  getPatientById → (found) incrementPatientVisit
                                                        → (not found) upsertPatientByEmail
req.body.patientId = 'new'           →  createNewPatient
req.body.patientId = (absent)        →  upsertPatientByEmail
```

After patient is resolved → `bookings.patient_id = patient.id` is written.

### 4b. Admin-Created Booking (clinic staff, `POST /api/auth/clinic/bookings/create`)

```
has email  →  upsertPatientByEmail  →  bookings.patient_id = patient.id
no email   →  upsertPatientByPhone  →  bookings.patient_id = patient.id
```

### 4c. Walk-in Booking (same route, phone-only)

Same as 4b — `upsertPatientByPhone` is called when no email is provided.

---

## 5. Booking → Patient Linkage

- `bookings.patient_id` (integer, nullable) → FK to `patients.id`
- `storage.getClinicBookings()` does a LEFT JOIN on patients and returns `patientCode` alongside each booking.
- The bookings panel shows the PAT code as a small badge on each booking card when `booking.patientCode` is set.

---

## 6. Patient Directory Panel (Patients)

**API:** `GET /api/auth/clinic/patients`

**Storage query (`getPatientsByClinic`):**
- Selects all patients for the clinic **where `patientCode IS NOT NULL`**.
- LEFT JOINs `patient_bills` and computes `totalBilled = SUM(total WHERE paymentStatus = 'paid')`.
- Ordered by `lastVisitAt DESC`.

**UI features:**
- Table columns: **PAT Code** (rose badge), Name, Email, Phone, Visits, Last Visit, Billed
- Search by: `patientCode`, name, email, phone
- Sort by: most recent, most visits, highest billed
- Click a row → `selectedPatientId` is set → history drawer/modal loads

**Patient History (`GET /api/auth/clinic/patients/:patientId/history`):**
Returns three arrays for that patient:
1. `bookings` — all bookings with slot data
2. `bills` — all bills linked by `patientId`
3. `clinicalRecords` — all clinical records linked by `patientId`

---

## 7. Accounts Panel (Billing)

**API:** `GET /api/auth/clinic/bills`

Returns all `patient_bills` rows for the clinic, ordered by `createdAt DESC`.

**Loaded when:** `activePanel === 'accounts'` OR `activePanel === 'bookings'` (so the bookings panel can show billing status).

### DB Table: `patient_bills`

| Column | Notes |
|---|---|
| `id` | PK |
| `clinicId` | Scoped to clinic |
| `bookingId` | FK to bookings (optional — bills can exist without a booking) |
| `patientId` | FK to patients.id (optional — may be null for old bills) |
| `billNumber` | Receipt number, e.g. `RCP-{bookingId}-{date}` |
| `patientName`, `patientPhone`, `patientEmail` | **Denormalised** — copied from booking at bill creation time |
| `services` | JSONB array of `{description, amount}` |
| `subtotal`, `discountPct`, `taxPct`, `total` | Amounts in INR |
| `paymentMethod` | Cash / UPI / Card etc. |
| `paymentStatus` | `paid` / `pending` / `partial` |
| `notes` | Free text |
| `createdAt`, `updatedAt` | |

### Two Views

**Patient Ledger (grouped):**
Bills are grouped in the frontend by a string key:
```
key = bill.patientEmail?.toLowerCase() || bill.patientPhone || bill.patientName.toLowerCase()
```
Each group shows: avatar initials, name, email, phone, billed total, collected total, outstanding balance, visit count, aging badge.

**Transaction Register (flat):**
All bills in a flat list with status filter (All / Paid / Pending / Partial / Overdue).

### Overdue Logic

A bill is "overdue" if:
- `paymentStatus` is `'pending'` or `'partial'`
- AND `createdAt` is more than 3 days ago

### Auto-Complete on Full Payment

When a bill is updated to `paid` via `PATCH /api/auth/clinic/bills/:id`, the server checks if **all** bills for the same booking are now paid. If yes, and the booking `visitStatus` is `treatment_completed` or `in_consultation`, the booking is automatically set to `completed`.

---

## 8. Inconsistencies & Issues Found

### ❌ I1 — Accounts Ledger Does Not Show PAT Code

**✅ Fixed (verified in code, `server/storage.ts` → `getPatientBillGroupsByClinicIdPaged`).** The Patient Ledger now joins the `patients` table and returns `patientCode` alongside each group. The PAT code is displayed as a badge in `AccountsPanel.tsx`, so cross-referencing between the Accounts and Patients panels is now possible.

### ✅ I2 (Fixed) — Accounts Search Now Includes PAT Code

The search in the Accounts panel now checks:
```
patientName | patientEmail | patientPhone | billNumber | patientCode
```
`patientCode` matching is implemented in `getPatientBillGroupsByClinicIdPaged` (`server/storage.ts`, the `g.patientCode` check in the search filter). A clinic using PAT codes can now find bills by code directly.

### ✅ I3 (Fixed) — Ledger Now Groups by `patientId` First, Falls Back to Denormalised Strings

The Patient Ledger's grouping key now prioritizes the `patientId` FK: `key = bill.patientId ? "pid:" + bill.patientId : (email || phone || name)` (`server/storage.ts`, `getPatientBillGroupsByClinicIdPaged`). This means:
- Any bill with a linked `patientId` groups correctly regardless of which contact detail (email vs. phone) was used at booking time.
- The string-based fallback (email → phone → name) is only used for legacy bills with no `patientId` set — this remaining edge case is lower impact than before but not fully eliminated for very old records.

**Remaining impact:** Low — only affects pre-`patientId` legacy bills without a linked patient record.

### ❌ I4 — `totalBilled` in Patient Directory Is Actually `totalCollected`

`getPatientsByClinic` computes:
```sql
SUM(CASE WHEN paymentStatus = 'paid' THEN total ELSE 0 END)
```
This is the **paid/collected** amount, not the full billed amount. The UI column header says "Billed" but the value only counts paid bills. Outstanding amounts are not included.

**Impact:** Low-medium (misleading label). Could cause confusion when a patient has unpaid bills.

### ❌ I5 — Old Patients Without `patientCode` Are Excluded from Directory

`getPatientsByClinic` has `WHERE patientCode IS NOT NULL`. Patients created before the `patientCode` column was added (or via an edge-case that skipped code generation) are invisible in the Patients panel.

**Impact:** Low for most clinics, but could cause confusion if a patient appears in bookings but not in the directory.

### ❌ I6 — `patientCode` Has No Uniqueness Constraint

The code is generated as `COUNT(patients) + 1`. Under concurrent inserts (two bookings at exactly the same millisecond), two patients could get the same PAT code.

**Impact:** Low probability but high confusion if it occurs.

### ❌ I7 — No Link from Accounts Ledger to Patient Profile

There is no "View Profile →" action in the Accounts Patient Ledger to jump to that patient's full profile in the Patients panel. Staff must navigate to Patients and re-search.

**Impact:** Low (UX friction).

### ⚠️ I8 — Design Guide Violations in Accounts

Violations of `docs/agent-screen-design-prompt.md` found in the Accounts panel:
| Location | Issue |
|---|---|
| Stats card labels | `text-[10px]` — below `text-xs` minimum |
| Overdue sub-line | `text-[10px]` — below minimum |
| Aging badge | `text-[9px]` — below minimum |
| Aging badge clock icon | `h-2 w-2` — very small |
| Ledger column headers | `text-[9px]` — below minimum |
| Register date/receipt text | `text-[10px]` — below minimum |

---

## 9. Data Flow Diagram

```
PUBLIC BOOKING FLOW
───────────────────
Patient enters email
  → OTP sent & verified
  → Patient selects profile (existing / new)
      → upsertPatientByEmail / createNewPatient
      → booking.patient_id = patient.id
  → Clinic sees booking with PAT code badge

ADMIN BOOKING FLOW
──────────────────
Clinic creates booking for patient
  → if email provided → upsertPatientByEmail
  → if phone only     → upsertPatientByPhone
  → booking.patient_id = patient.id

BILLING FLOW
────────────
Clinic opens booking card
  → Adds charges (services + amounts)
  → Creates bill via POST /api/auth/clinic/bills
    → bill.patientId = booking.patientId (if set)
    → bill.patientName/Phone/Email = copied from booking (denormalised)
  → bill appears in Accounts panel
  → if all bills paid + booking in treatment_completed/in_consultation
    → booking auto-set to 'completed'

ACCOUNTS PANEL
──────────────
allBills loaded from GET /api/auth/clinic/bills
  Patient Ledger: groups by email → phone → name (text, not patientId)
  Transaction Register: flat list by date

PATIENTS PANEL
──────────────
patientDirectory loaded from GET /api/auth/clinic/patients
  → patients WHERE patientCode IS NOT NULL
  → LEFT JOIN patient_bills (paid only) for totalBilled
  Click patient → GET /api/auth/clinic/patients/:id/history
    → bookings, bills, clinicalRecords for that patient
```

---

## 10. Recommended Fixes (Priority Order)

| # | Fix | Effort |
|---|---|---|
| 1 | ✅ **Done** — `patientCode` shown in Accounts Ledger as a PAT badge on each patient group header | Small |
| 2 | ✅ **Done** — PAT code included in Accounts search filter | Small |
| 3 | **Fix "Billed" label in Patient Directory** — rename to "Collected" or compute true total billed | Small |
| 4 | **Add UNIQUE constraint on `patientCode` per clinic** — `ALTER TABLE patients ADD UNIQUE (clinic_id, patient_code)` | Small |
| 5 | ✅ **Done** — Ledger grouping now uses `patientId` where available, falls back to text for nulls | Medium |
| 6 | **Add "View Profile →" link** in Accounts Ledger to jump to Patients panel | Small |
| 7 | **Fix design guide text sizes** — bump all `text-[9px]` / `text-[10px]` to `text-xs` in Accounts panel | Small |
| 8 | **Backfill `patientCode` for legacy patients** — run a migration to assign PAT codes to patients where `patientCode IS NULL` | Small |
