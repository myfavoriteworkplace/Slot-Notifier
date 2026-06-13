# BookMySlot — Database Architecture Reference

> **Purpose of this document**: A complete, senior-developer-ready reference of every table in the system — columns, types, constraints, indexes, foreign keys, design decisions, and known optimization opportunities. Use this as the starting point for any schema review, query optimization, or refactoring work.

---

## Quick Overview

| Area | Tables | Purpose |
|---|---|---|
| Auth & Sessions | `users`, `sessions` | Replit OIDC users, Express session store |
| Clinic & Doctor Identity | `clinics`, `doctors`, `clinic_doctors`, `doctor_invites`, `doctor_leaves` | Service-provider accounts and relationships |
| Scheduling | `slots`, `bookings` | Time-window creation and patient reservations |
| Clinical | `patients`, `booking_notes`, `clinical_records`, `doctor_certifications`, `doctor_cases` | Patient records and clinical data |
| Billing & Inventory | `patient_bills`, `billing_audit_logs`, `pharmacy_stock`, `inventory_categories`, `inventory_items`, `stock_transactions`, `stock_alerts` | Financial transactions and physical stock management |
| Marketplace & System | `smile_deals`, `site_settings`, `activation_tokens`, `email_otps`, `consent_tokens`, `login_events`, `export_history` | Public marketplace, security, audit trails |

**Total: 30 tables**

---

## Section 1 — Auth & Sessions

### `users`
Populated by **Replit OIDC** authentication. Represents admins and customers who log in via the Replit identity layer.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `varchar` | PK, default UUID | Replit OIDC subject ID |
| `email` | `varchar` | Unique | |
| `firstName` | `varchar` | | |
| `lastName` | `varchar` | | |
| `profileImageUrl` | `varchar` | | Replit profile picture |
| `role` | `text` | Not Null, default `'customer'` | Enum-like: `superuser`, `owner`, `customer` |
| `createdAt` | `timestamp` | default now | |
| `updatedAt` | `timestamp` | default now | Not auto-updated on writes — app must set manually |

**Relationships**: Referenced by `slots.ownerId`, `bookings.customerId`. The FK on `notifications.userId` was explicitly dropped (see `notifications` section).

**Design notes**:
- `role` is a plain text column, not a Postgres ENUM. This keeps migrations simple but loses database-level constraint enforcement.
- Only Replit-authenticated users land here. Clinics and doctors have separate login tables (`clinics`, `doctors`) and do **not** appear in `users`.

---

### `sessions`
Standard **connect-pg-simple** session store table. Managed entirely by the session middleware — do not write to this manually.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `sid` | `varchar` | PK | Express session ID |
| `sess` | `jsonb` | Not Null | Full serialised session object (passport user, etc.) |
| `expire` | `timestamp` | Not Null | Session expiry |

**Index**: `IDX_session_expire` on `expire` — used by connect-pg-simple's own cleanup cron to prune expired sessions.

**Design notes**:
- There are **two** session-like tables in the schema: `sessions` (Drizzle model in `shared/models/auth.ts`) and `session` (raw SQL in `server/index.ts`). Both exist to handle the mismatch between the ORM definition and the table name expected by connect-pg-simple. In practice only one is active — the one created by `CREATE TABLE IF NOT EXISTS "session"`.
- **Optimization opportunity**: The `sess` column is `jsonb` which is good for querying nested fields, but connect-pg-simple stores it as a large blob. If session size grows (e.g. large cart state), consider storing only the session ID in the cookie and keeping session data smaller.

---

## Section 2 — Clinic & Doctor Identity

### `clinics`
The primary **service-provider account** table. Each row is one dental clinic with its own login, branding, and subscription state.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `serial` | PK | Auto-increment integer |
| `name` | `varchar(255)` | Not Null | Display name |
| `address` | `varchar(500)` | | Street address |
| `city` | `varchar(255)` | | |
| `pincode` | `varchar(20)` | | |
| `email` | `varchar(255)` | Not Null | Contact email (not login) |
| `phone` | `varchar(50)` | Not Null | |
| `username` | `varchar(100)` | Unique | Login credential |
| `passwordHash` | `varchar(255)` | | bcrypt hash |
| `website` | `varchar(255)` | | |
| `doctorName` | `varchar(255)` | | Legacy quick-reference field |
| `doctorSpecialization` | `varchar(255)` | | Legacy — see `doctors` table |
| `doctorDegree` | `varchar(255)` | | Legacy — see `doctors` table |
| `doctors` | `jsonb` | default `[]` | **Legacy** denormalized doctor list; superseded by `clinic_doctors` join table |
| `logoUrl` | `varchar(1000)` | | Cloudflare R2 URL |
| `status` | `varchar(20)` | Not Null, default `'approved'` | `pending`, `approved`, `rejected` |
| `registeredBy` | `varchar(255)` | | Who created this record |
| `isArchived` | `boolean` | Not Null, default `false` | Soft delete flag |
| `createdAt` | `timestamp` | default now | |
| `latitude` | `real` | | GPS — for map/geo search |
| `longitude` | `real` | | GPS |
| `googleBusinessUrl` | `varchar(1000)` | | Google Maps link |
| `gstNumber` | `varchar(50)` | | Tax registration |
| `medicalLicenseUrl` | `varchar(1000)` | | Document stored in R2 |
| `clinicRegCertUrl` | `varchar(1000)` | | Registration certificate |
| `trustScore` | `integer` | default `0` | Manually set by superadmin |
| `plan` | `varchar(20)` | default `'starter'` | `starter`, `growth`, `pro` |
| `subscriptionStatus` | `varchar(20)` | default `'unpaid'` | `unpaid`, `active`, `paused`, `cancelled` |
| `billingCycle` | `varchar(10)` | default `'monthly'` | `monthly`, `annual` |
| `razorpaySubscriptionId` | `varchar(255)` | | Razorpay recurring subscription reference |
| `websiteConfig` | `jsonb` | | Per-clinic website customisation blob |
| `defaultSlotConfig` | `jsonb` | | Default slot duration/cost settings blob |

**Relationships**: Referenced as FK by `slots.clinicId`, `patients.clinicId`, `clinic_doctors.clinicId`, `doctor_invites.clinicId`, `consent_tokens.clinicId`, `patient_bills.clinicId`, `clinical_records.clinicId`, `inventory_*`, `smile_deals.clinicId`, `activation_tokens.clinicId`, `export_history.clinicId`.

**Design notes**:
- `doctors` (jsonb array) is a **legacy field** that predates the `doctors` and `clinic_doctors` tables. It is still read in some places for backward compatibility. Long-term it should be removed once all reads are migrated to the join table.
- `doctorName`, `doctorSpecialization`, `doctorDegree` are similarly legacy single-doctor fields from before multi-doctor support.
- **No unique constraint on `email`** — a clinic could register twice with the same email. Consider adding a unique index if email is used as a login identifier anywhere.
- `status` and `isArchived` overlap in meaning — `isArchived = true` is the soft-delete path; `status = 'rejected'` means the application was denied. They serve different purposes but a developer reviewing the code needs to check both.

---

### `doctors`
Separate **doctor accounts** with their own login credentials, profile, and media.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `serial` | PK | |
| `name` | `varchar(255)` | Not Null | |
| `email` | `varchar(255)` | Not Null, Unique | Login identifier |
| `passwordHash` | `varchar(255)` | Not Null | bcrypt hash |
| `isTemporaryPassword` | `boolean` | Not Null, default `true` | Forces password change on first login |
| `username` | `varchar(100)` | Unique | Optional alternative login |
| `specialization` | `varchar(255)` | | |
| `degree` | `varchar(255)` | | e.g. BDS, MDS |
| `college` | `varchar(255)` | | Graduation institution |
| `bio` | `text` | | Public profile bio |
| `phone` | `varchar(50)` | | |
| `imageUrl` | `varchar(1000)` | | R2 profile photo |
| `yearsOfExperience` | `integer` | | |
| `languages` | `text[]` | | Multi-value; e.g. `['English','Malayalam']` |
| `treatments` | `text[]` | | Procedures offered |
| `introVideoUrl` | `varchar(1000)` | | YouTube/Vimeo/R2 |
| `createdAt` | `timestamp` | default now | |

**Relationships**: Referenced by `clinic_doctors.doctorId`, `doctor_certifications.doctorId`, `doctor_cases.doctorId`, `doctor_leaves.doctorId`, `patients.doctorId`.

**Design notes**:
- `languages` and `treatments` are stored as **Postgres text arrays**. Good for simple multi-value storage, but not queryable with standard indexes. If filtering doctors by language or treatment becomes a feature, consider a normalised join table or a GIN index.
- `isTemporaryPassword` is a boolean gate — the app should redirect the doctor to change their password before allowing access. Ensure this is enforced server-side, not just client-side.

---

### `clinic_doctors`
**Many-to-many** join table linking clinics to doctors. A doctor can belong to multiple clinics; a clinic can have multiple doctors.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `serial` | PK | |
| `clinicId` | `integer` | Not Null, FK → `clinics.id` | |
| `doctorId` | `integer` | Not Null, FK → `doctors.id` | |
| `createdAt` | `timestamp` | default now | |

**Design notes**:
- **No unique composite index** on `(clinicId, doctorId)`. A doctor could theoretically be added to the same clinic twice. A unique constraint on `(clinicId, doctorId)` would prevent duplicates at the database level.
- **Optimization opportunity**: Add `UNIQUE (clinic_id, doctor_id)` index.

---

### `doctor_invites`
Tracks **email invitations** sent from a clinic to a doctor to join the platform.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `serial` | PK | |
| `clinicId` | `integer` | Not Null, FK → `clinics.id` | Inviting clinic |
| `email` | `varchar(255)` | Not Null | Invitee email |
| `token` | `varchar(255)` | Not Null, Unique | One-time invite link token |
| `status` | `varchar(20)` | Not Null, default `'pending'` | `pending`, `accepted`, `expired` |
| `expiresAt` | `timestamp` | Not Null | |
| `createdAt` | `timestamp` | default now | |

**Design notes**:
- Expired tokens are not automatically purged. A periodic cleanup job or a partial index filtering `status = 'pending' AND expires_at > now()` would keep this table lean.

---

### `doctor_leaves`
Records **days a doctor is unavailable** (leave, holiday, etc.) per clinic.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `serial` | PK | |
| `doctorId` | `integer` | FK → `doctors.id` | |
| `leaveDate` | `varchar` | | Stored as a string (e.g. `'2026-06-15'`) not a date type |
| `reason` | `varchar` | | Optional |
| `createdAt` | `timestamp` | default now | |

**Design notes**:
- `leaveDate` is stored as `varchar` instead of `date`. This means no date-range queries or comparisons can use index range scans. **Optimization opportunity**: Change to `date` type and add an index on `(doctor_id, leave_date)`.

---

## Section 3 — Scheduling

### `slots`
A **slot** is a bookable time window created by a clinic owner. Multiple patients can book into the same slot up to `maxBookings`.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `serial` | PK | |
| `ownerId` | `varchar` | FK → `users.id` | The `users` row who created this slot |
| `clinicId` | `integer` | FK → `clinics.id` | The clinic this slot belongs to |
| `clinicName` | `varchar(255)` | | Denormalized — copied from `clinics.name` at creation |
| `startTime` | `timestamp` | Not Null | UTC |
| `endTime` | `timestamp` | Not Null | UTC |
| `isBooked` | `boolean` | Not Null, default `false` | True when ALL sub-slots are filled (i.e. bookings count ≥ maxBookings) |
| `isCancelled` | `boolean` | Not Null, default `false` | Soft cancel by the clinic |
| `maxBookings` | `integer` | Not Null, default `3` | Max concurrent patients |

**Relationships**: Referenced by `bookings.slotId`.

**Design notes**:
- `clinicName` is **denormalized** — if a clinic renames itself, old slots will show the old name. Consider joining to `clinics` at query time instead.
- `isBooked` is a derived boolean that the app updates manually. It can get out of sync if a booking is cancelled and the flag is not flipped back. **Optimization opportunity**: Replace with a computed check: `(SELECT COUNT(*) FROM bookings WHERE slot_id = slots.id AND verification_status != 'cancelled') >= max_bookings`.
- **No index** on `(clinic_id, start_time)` — the most common query pattern is "give me all slots for clinic X on date Y". This should have a composite index.

---

### `bookings`
The **central hub table** of the entire application. Every patient appointment flows through this table from initial booking to final billing.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `serial` | PK | |
| `slotId` | `integer` | Not Null, FK → `slots.id` | |
| `customerId` | `varchar` | FK → `users.id` | Set if a logged-in Replit user booked; null for guest patients |
| `patientId` | `integer` | FK → `patients.id` | Set post-booking when patient is matched/created |
| `customerName` | `varchar(255)` | Not Null | Submitted by patient at booking time |
| `customerPhone` | `varchar(50)` | Not Null | |
| `customerEmail` | `varchar(255)` | | |
| `customerAge` | `integer` | | |
| `customerGender` | `varchar(20)` | | |
| `verificationCode` | `varchar(10)` | | OTP code (hashed or plain depending on flow) |
| `verificationStatus` | `varchar(20)` | Not Null, default `'pending'` | `pending`, `confirmed`, `cancelled`, `no_show` |
| `verificationExpiresAt` | `timestamp` | | OTP expiry |
| `description` | `text` | | Patient's stated reason for visit |
| `assignedDoctor` | `varchar(255)` | | Doctor name (denormalized) |
| `assignedDoctorEmail` | `varchar(255)` | | Doctor email for lookup |
| `doctorApprovalStatus` | `varchar(20)` | | `pending`, `approved`, `rejected` by doctor |
| `doctorNotes` | `text` | | Doctor's private notes on this booking |
| `clinicalStatus` | `varchar(50)` | | Doctor-set clinical label (e.g. "requires x-ray") |
| `visitStatus` | `varchar(50)` | | `null` → `checked_in` → `in_consultation` → `treatment_completed` → `completed` / `patient_left_early` |
| `checkedInAt` | `timestamp` | | When patient arrived |
| `completedAt` | `timestamp` | | When visit was marked done |
| `confirmedBy` | `varchar(20)` | | Who confirmed: `clinic`, `system`, `doctor` |
| `paymentStatus` | `varchar(20)` | | **Booking-level** payment flag (separate from `patient_bills`) |
| `razorpayOrderId` | `varchar(255)` | | Online payment ref |
| `razorpayPaymentId` | `varchar(255)` | | |
| `consentSignature` | `text` | | Base64 PNG of patient signature |
| `consentSignedAt` | `timestamp` | | |
| `consentIp` | `varchar(45)` | | Patient's IP at time of signing (supports IPv6) |
| `consentToken` | `varchar(255)` | | Token used for the consent form URL |
| `paymentAmount` | `integer` | | Amount paid in paise (×100 of ₹) |
| `cancellationReason` | `text` | | Set on cancellation or no-show |
| `visitCompletionNote` | `text` | | Staff note recorded when marking visit complete |
| `slotCost` | `integer` | default `1` | Cost in ₹ for this booking's slot |
| `createdAt` | `timestamp` | default now | |

**Relationships**: `bookings` is referenced by `booking_notes.bookingId`, `consent_tokens.bookingId`, `patient_bills.bookingId`, `clinical_records.bookingId`, `billing_audit_logs.bookingId`.

**Design notes**:
- **Dual payment tracking**: `paymentStatus` + `paymentAmount` on `bookings` tracks the slot booking fee (Razorpay). Separately, `patient_bills` tracks itemised clinical billing. These are two distinct concerns but a developer could confuse them — comment this clearly.
- **Denormalized doctor fields**: `assignedDoctor` (name) and `assignedDoctorEmail` are stored as strings, not a FK to `doctors.id`. If a doctor changes their email, old bookings will not reflect it. Consider adding `assignedDoctorId integer FK → doctors.id`.
- **`consentToken` vs `consent_tokens` table**: The token is stored in both `bookings.consentToken` and the separate `consent_tokens` table. The canonical source of truth should be clarified — currently both are written.
- **No index on `slot_id`** — the most common query is "all bookings for this slot". Add `CREATE INDEX ON bookings(slot_id)`.
- **No index on `customer_email`** — patient lookup by email is common. Add index.
- **`visitStatus` is a free-text column with no DB constraint**. Any typo silently corrupts the state machine. An ENUM or a CHECK constraint would prevent this.
- **Optimization opportunity**: This table will grow fast (one row per appointment). Consider archiving completed bookings older than 2 years to a `bookings_archive` table and adding a partial index: `CREATE INDEX ON bookings(slot_id) WHERE verification_status != 'cancelled'`.

---

## Section 4 — Clinical Data

### `patients`
**Canonical patient identity** records. Created when a patient is first matched to a booking. A patient can have many bookings over time.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `serial` | PK | |
| `clinicId` | `integer` | FK → `clinics.id` | A patient record is clinic-scoped |
| `doctorId` | `integer` | FK → `doctors.id` | Primary doctor for this patient |
| `name` | `varchar(255)` | Not Null | |
| `email` | `varchar(255)` | | |
| `phone` | `varchar(50)` | | |
| `age` | `integer` | | Snapshot age — not recalculated |
| `gender` | `varchar(20)` | | |
| `patientCode` | `varchar(20)` | | Human-readable ID (e.g. `PT-0042`) |
| `visitCount` | `integer` | Not Null, default `0` | Maintained by app logic, not auto-computed |
| `lastVisitAt` | `timestamp` | | Updated on booking completion |
| `createdAt` | `timestamp` | default now | |

**Design notes**:
- `visitCount` is a **manually maintained counter**. If a booking is deleted or cancelled without updating this field, the count will be wrong. **Optimization opportunity**: Replace with `SELECT COUNT(*) FROM bookings WHERE patient_id = ? AND verification_status = 'confirmed'` or use a Postgres trigger.
- **A patient is clinic-scoped**: the same real-world person visiting two clinics will have two separate `patients` rows. There is no cross-clinic patient identity.
- No unique constraint on `(clinic_id, phone)` or `(clinic_id, email)`, so duplicate patient records can accumulate.

---

### `booking_notes`
**Threaded notes** attached to a booking — written by clinic staff or doctors.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `serial` | PK | |
| `bookingId` | `integer` | FK → `bookings.id` | |
| `authorType` | `varchar` | | `clinic`, `doctor`, `system` |
| `authorName` | `varchar` | | Display name of writer |
| `content` | `text` | | Note body |
| `createdAt` | `timestamp` | default now | |

---

### `clinical_records`
**Clinical encounter records** — the doctor's formal diagnosis and prescription for a visit.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `serial` | PK | |
| `bookingId` | `integer` | FK → `bookings.id` | |
| `clinicId` | `integer` | FK → `clinics.id` | |
| `patientId` | `integer` | FK → `patients.id` | |
| `patientName` | `varchar` | | Denormalized |
| `patientPhone` | `varchar` | | Denormalized |
| `doctorName` | `varchar` | | Denormalized |
| `diagnosis` | `jsonb` | | Structured diagnosis object |
| `prescription` | `text` | | Free-text or structured |
| `notes` | `text` | | Additional clinical notes |
| `isDeleted` | `boolean` | | Soft delete |
| `createdAt` | `timestamp` | default now | |
| `updatedAt` | `timestamp` | | |

**Design notes**:
- `diagnosis` is stored as **jsonb** — flexible but unvalidated. Ensure the application layer enforces a consistent shape before writing; otherwise querying specific diagnosis fields becomes brittle.

---

### `doctor_certifications`
Stores a doctor's **professional certificates** for their public profile.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `serial` | PK | |
| `doctorId` | `integer` | FK → `doctors.id` | |
| `title` | `varchar` | | Certificate name |
| `issuer` | `varchar` | | Issuing body |
| `year` | `integer` | | Year awarded |
| `description` | `text` | | |
| `imageUrl` | `varchar` | | R2 URL of certificate image |
| `createdAt` | `timestamp` | default now | |

---

### `doctor_cases`
**Portfolio case studies** — before/after evidence a doctor can display on their public profile.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `serial` | PK | |
| `doctorId` | `integer` | FK → `doctors.id` | |
| `title` | `varchar` | | |
| `description` | `text` | | |
| `tags` | `jsonb` | | Array of tag strings |
| `mediaUrls` | `jsonb` | | Array of R2 image URLs |
| `createdAt` | `timestamp` | default now | |

---

## Section 5 — Billing & Inventory

### `patient_bills`
**Itemised invoices** for clinical services. One booking can have multiple bills (e.g. initial consultation + follow-up billing).

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `serial` | PK | |
| `clinicId` | `integer` | FK → `clinics.id` | |
| `bookingId` | `integer` | FK → `bookings.id` | |
| `patientId` | `integer` | FK → `patients.id` | |
| `billNumber` | `varchar` | | Human-readable e.g. `BILL-2026-0042` |
| `patientName` | `varchar` | | Denormalized |
| `patientPhone` | `varchar` | | Denormalized |
| `patientEmail` | `varchar` | | Denormalized |
| `services` | `jsonb` | | Array of `{ name, qty, unitPrice, total }` objects |
| `subtotal` | `integer` | | In paise (×100) |
| `discountPct` | `integer` | | Percentage discount (0–100) |
| `taxPct` | `integer` | | GST percentage |
| `total` | `integer` | | Final amount in paise after discount + tax |
| `paymentMethod` | `varchar` | | `cash`, `upi`, `card`, `insurance`, `online` |
| `paymentStatus` | `varchar` | | `pending`, `paid`, `partial`, `waived` |
| `notes` | `text` | | |
| `cashierId` | `varchar` | | Staff member who processed |
| `cashierNotes` | `varchar` | | Internal note at payment |
| `amountReceived` | `integer` | | Actual amount collected (for partial payments) |
| `createdAt` | `timestamp` | default now | |
| `updatedAt` | `timestamp` | | |

**Design notes**:
- All monetary values are in **paise (integer × 100 of ₹)**. This avoids floating-point rounding issues. When displaying to users, divide by 100.
- `services` is a **jsonb array**. This means individual line items are not queryable at the row level — you cannot do `WHERE services->>'name' = 'X-Ray'` efficiently without a GIN index. If service-level analytics are needed later, normalise to a `bill_line_items` table.
- `billNumber` has no unique constraint — duplicates are theoretically possible if the generation logic has a race condition.

---

### `billing_audit_logs`
**Immutable append-only log** of every action taken on a bill. Never update or delete rows here.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `serial` | PK | |
| `clinicId` | `integer` | | |
| `bookingId` | `integer` | | |
| `billId` | `integer` | | |
| `action` | `varchar` | | e.g. `created`, `paid`, `voided`, `edited` |
| `details` | `jsonb` | | Before/after snapshot or metadata |
| `performedBy` | `varchar` | | Staff ID or name |
| `createdAt` | `timestamp` | default now | |

**Design notes**:
- None of the FK columns (`clinicId`, `bookingId`, `billId`) have actual FK constraints declared. This is intentional to allow audit logs to survive even if the referenced rows are deleted.

---

### `pharmacy_stock`
Tracks **medicines and consumables** stocked by the clinic's in-house pharmacy.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `serial` | PK | |
| `clinicId` | `integer` | FK → `clinics.id` | |
| `medicineName` | `varchar` | | |
| `dosage` | `varchar` | | e.g. `500mg`, `10ml` |
| `unitPrice` | `integer` | | In paise |
| `availableQty` | `integer` | | Current stock count |
| `expiryDate` | `varchar` | | Stored as string — see note |
| `createdAt` | `timestamp` | default now | |
| `updatedAt` | `timestamp` | | |

**Design notes**:
- `expiryDate` is `varchar` (same problem as `doctor_leaves.leaveDate`). Should be `date` type for proper range queries and expiry alerts.
- **No low-stock alert trigger** — the application layer polls and generates `stock_alerts` manually.

---

### `inventory_categories`
Groups inventory items into logical departments (e.g. "Instruments", "PPE", "Radiology").

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `serial` | PK | |
| `clinicId` | `integer` | FK → `clinics.id` | Categories are clinic-scoped |
| `name` | `varchar` | | |
| `department` | `varchar` | | Broad grouping |
| `createdAt` | `timestamp` | default now | |

---

### `inventory_items`
Individual **trackable items** (equipment, consumables, instruments) per clinic.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `serial` | PK | |
| `clinicId` | `integer` | FK → `clinics.id` | |
| `categoryId` | `integer` | FK → `inventory_categories.id` | |
| `name` | `varchar` | | |
| `trackingType` | `varchar` | | `quantity`, `presence` (binary in/out) |
| `unit` | `varchar` | | e.g. `pieces`, `boxes`, `ml` |
| `currentQty` | `integer` | | |
| `reorderLevel` | `integer` | | Triggers a low-stock alert |
| `criticalLevel` | `integer` | | Triggers a critical alert |
| `expiryDate` | `varchar` | | See note — should be `date` |
| `warrantyExpiry` | `varchar` | | For equipment |
| `nextServiceDate` | `varchar` | | Scheduled maintenance |
| `notes` | `text` | | |
| `createdAt` | `timestamp` | default now | |

---

### `stock_transactions`
**Ledger of every stock movement** — adds, uses, adjustments. Append-only by intent.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `serial` | PK | |
| `itemId` | `integer` | FK → `inventory_items.id` | |
| `clinicId` | `integer` | FK → `clinics.id` | Denormalized for faster clinic-level queries |
| `type` | `varchar` | | `add`, `use`, `adjust`, `expired`, `lost` |
| `qtyBefore` | `integer` | | Snapshot before transaction |
| `qtyChange` | `integer` | | Positive = added, negative = used |
| `qtyAfter` | `integer` | | Snapshot after transaction |
| `reason` | `varchar` | | |
| `performedBy` | `varchar` | | Staff name or ID |
| `performedAt` | `timestamp` | | |

**Design notes**:
- `qtyBefore` + `qtyChange` = `qtyAfter` — this redundancy is intentional for audit integrity but must be enforced at the application layer (or via a CHECK constraint).

---

### `stock_alerts`
**Generated alerts** when an item hits reorder or critical threshold.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `serial` | PK | |
| `itemId` | `integer` | FK → `inventory_items.id` | |
| `clinicId` | `integer` | FK → `clinics.id` | |
| `alertType` | `varchar` | | `low_stock`, `critical`, `expiring_soon` |
| `isDismissed` | `boolean` | | Cleared by staff |
| `createdAt` | `timestamp` | default now | |

---

## Section 6 — Marketplace & System

### `smile_deals`
**Promotional dental offers** displayed on the public Dental Marketplace page.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `serial` | PK | |
| `clinicId` | `integer` | FK → `clinics.id` | Null = platform-wide deal |
| `title` | `varchar` | | |
| `description` | `text` | | |
| `imageUrl` | `varchar` | | R2 image |
| `videoUrl` | `varchar` | | YouTube/Vimeo/mp4 — autoplays in cards |
| `bookingLink` | `varchar` | | External or internal booking URL |
| `price` | `integer` | | Deal price in paise |
| `originalPrice` | `integer` | | Was-price for "Save ₹X" badge |
| `isActive` | `boolean` | | Only active deals show publicly |
| `isFeatured` | `boolean` | | Shows as hero card |
| `isFlash` | `boolean` | | Shows in horizontal flash-deals strip |
| `category` | `varchar` | | Broad: `Clinic Deals`, `Advertisements` |
| `subcategory` | `varchar` | | Procedure type: `Cleaning`, `Braces`, etc. |
| `startsAt` | `timestamp` | | Scheduled visibility start |
| `expiresAt` | `timestamp` | | Auto-hides after this |
| `viewCount` | `integer` | | Incremented on page view |
| `clickCount` | `integer` | | Incremented on "Book Now" click |
| `contactInfo` | `jsonb` | | Phone/WhatsApp for direct contact |
| `targetAudience` | `varchar` | | e.g. `new_patients`, `all` |
| `createdAt` | `timestamp` | default now | |

---

### `consent_tokens`
Manages **digital consent form links** sent to patients via WhatsApp before a procedure.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `serial` | PK | |
| `bookingId` | `integer` | FK → `bookings.id` | |
| `clinicId` | `integer` | FK → `clinics.id` | |
| `token` | `varchar` | Unique | Random token — used in URL `/consent/:token` |
| `status` | `varchar` | | `pending`, `signed`, `expired` |
| `expiresAt` | `timestamp` | | 72 hours from generation |
| `createdAt` | `timestamp` | default now | |

**Design notes**:
- The consent signature itself is stored on `bookings.consentSignature` (base64 PNG), not here. This table is only the token lifecycle.
- Expired tokens are not auto-cleaned. A cron or startup sweep for `status = 'pending' AND expires_at < now()` would help.

---

### `activation_tokens`
**Subscription activation links** generated for Razorpay payment flows. A clinic pays → token generated → clinic activates their plan via the link.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `serial` | PK | |
| `token` | `varchar` | Unique | |
| `clinicId` | `integer` | FK → `clinics.id` | |
| `plan` | `varchar` | | `starter`, `growth`, `pro` |
| `billingCycle` | `varchar` | | `monthly`, `annual` |
| `razorpaySubscriptionId` | `varchar` | | |
| `shortUrl` | `varchar` | | Shortened activation URL |
| `expiresAt` | `timestamp` | | |
| `used` | `boolean` | | Prevents replay |
| `createdAt` | `timestamp` | default now | |

---

### `email_otps`
**OTP tokens** for verifying a patient's email before they can view slots or complete a booking.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `serial` | PK | |
| `email` | `varchar` | | Patient email |
| `otpHash` | `varchar` | | bcrypt hash of the 6-digit code |
| `expiresAt` | `timestamp` | | OTP validity window |
| `verified` | `boolean` | | Has the OTP been successfully entered |
| `verifiedToken` | `varchar` | | Session-like token issued after verification |
| `purpose` | `varchar` | default `'booking'` | Future-proofing for other OTP flows |
| `createdAt` | `timestamp` | default now | |
| `attempts` | `integer` | | Wrong guess counter |
| `lockedUntil` | `timestamp` | | Brute-force lockout expiry |
| `sendCount` | `integer` | | How many times OTP was sent to this email |
| `sendWindowStart` | `timestamp` | | Rate-limit window start |

**Design notes**:
- Good rate-limiting fields (`attempts`, `lockedUntil`, `sendCount`, `sendWindowStart`). Ensure the application checks `lockedUntil` **before** comparing the OTP, not after.
- Old verified/expired rows are not purged. A cleanup job deleting rows where `expires_at < now() - interval '7 days'` would prevent unbounded growth.

---

### `site_settings`
**Global key-value store** for runtime configuration that admins can change without a deploy.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `serial` | PK | |
| `key` | `varchar` | Unique | Setting name |
| `value` | `text` | | Setting value (JSON string for complex values) |
| `updatedAt` | `timestamp` | | |

---

### `login_events`
**Security audit log** of every login attempt across all user types.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `serial` | PK | |
| `role` | `varchar` | | `superuser`, `clinic`, `doctor`, `user` |
| `identifier` | `varchar` | | Username or email used |
| `ipAddress` | `varchar` | | Caller IP |
| `userAgent` | `varchar` | | Browser/client string |
| `success` | `boolean` | | Pass or fail |
| `createdAt` | `timestamp` | default now | |

**Design notes**:
- This table will grow indefinitely. Add a **retention policy**: delete rows older than 90 days, or partition by month.
- **No index on `identifier` or `ip_address`** — any brute-force detection query scanning by email or IP will do a full table scan.

---

### `export_history`
Tracks **data export operations** (CSV/PDF) performed by clinic staff.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `serial` | PK | |
| `clinicId` | `integer` | FK → `clinics.id` | |
| `fileName` | `varchar` | | Generated file name |
| `format` | `varchar` | | `csv`, `pdf` |
| `scope` | `text[]` | | Which data sets were exported |
| `recordCount` | `integer` | | Number of rows exported |
| `createdAt` | `timestamp` | default now | |

---

## Section 7 — Relationships Diagram (Text)

```
users ──────────────────────────────────────────────┐
  └─ owns → slots ─────────────────────────────────┐ │
               └─ has many → bookings ◄─────────────┘ │
                                │                       │
                    ┌───────────┼──────────────────┐    │
                    ▼           ▼                  ▼    │
             patients    booking_notes     patient_bills │
                │               │               │       │
                ▼               │               ▼       │
       clinical_records         │       billing_audit_logs
                                │
                    consent_tokens

clinics ─────────────────────────────────────────────────┐
  │─ has many → slots                                     │
  │─ has many → patients                                  │
  │─ has many → patient_bills                             │
  │─ has many → inventory_categories                      │
  │   └─ has many → inventory_items                       │
  │         └─ has many → stock_transactions              │
  │         └─ has many → stock_alerts                    │
  │─ has many → pharmacy_stock                            │
  │─ has many → smile_deals                               │
  │─ has many → doctor_invites                            │
  └─ many-to-many → doctors (via clinic_doctors) ─────────┘
                        │
             ┌──────────┼─────────────┐
             ▼          ▼             ▼
    doctor_certifications  doctor_cases  doctor_leaves
```

---

## Section 8 — Cross-Cutting Optimization Opportunities

This section is a consolidated list for a senior developer to review:

| Priority | Issue | Table(s) | Recommendation |
|---|---|---|---|
| 🔴 High | Missing index on most-queried pattern | `slots` | `CREATE INDEX ON slots(clinic_id, start_time)` |
| 🔴 High | Missing index on booking lookups | `bookings` | `CREATE INDEX ON bookings(slot_id)`, `CREATE INDEX ON bookings(customer_email)` |
| 🔴 High | `visitStatus` has no DB constraint | `bookings` | Add `CHECK (visit_status IN ('checked_in','in_consultation','treatment_completed','completed','patient_left_early'))` or use ENUM |
| 🟡 Medium | `isBooked` can drift out of sync | `slots` | Replace with computed query or Postgres trigger |
| 🟡 Medium | `visitCount` manually maintained | `patients` | Replace with `COUNT(*)` subquery or trigger |
| 🟡 Medium | Date fields stored as varchar | `doctor_leaves`, `inventory_items`, `pharmacy_stock` | Change to `date` type, add indexes |
| 🟡 Medium | No unique composite index | `clinic_doctors` | `UNIQUE(clinic_id, doctor_id)` |
| 🟡 Medium | `billNumber` not unique | `patient_bills` | Add `UNIQUE` constraint |
| 🟡 Medium | `login_events` grows unbounded | `login_events` | Add 90-day retention policy; index on `identifier` |
| 🟡 Medium | `email_otps` not purged | `email_otps` | Cron cleanup of expired rows |
| 🟢 Low | `doctors` jsonb on clinics is legacy | `clinics` | Remove once all reads use `clinic_doctors` join |
| 🟢 Low | Legacy single-doctor columns | `clinics` | `doctorName`, `doctorSpecialization`, `doctorDegree` can be removed |
| 🟢 Low | `services` jsonb on bills not indexable | `patient_bills` | Add GIN index if service-level queries are needed, or normalise to `bill_line_items` |
| 🟢 Low | Dual consent token storage | `bookings` + `consent_tokens` | Designate one as canonical; remove the other |
| 🟢 Low | Denormalized name fields | `bookings`, `patient_bills`, `clinical_records` | Acceptable for performance but should be documented as intentional |

---

## Section 9 — Key Design Decisions & Why

**1. Clinics and Doctors are not in `users`**
The `users` table is Replit OIDC only. Clinics and doctors have email/password credentials managed separately. This allows the platform to run without Replit auth for staff accounts, while still supporting OIDC for public-facing customers.

**2. Notifications FK was dropped**
`notifications.userId` originally had a FK to `users.id`. This was dropped because notifications are sent to clinic staff (identified by clinic ID) and doctors (identified by doctor ID), neither of which are in the `users` table. Without dropping the FK, cross-type notifications would fail.

**3. `bookings.patientId` was added via migration, not original schema**
The `patients` table was introduced after the `bookings` table. The FK column was backfilled via an `ALTER TABLE` in `server/index.ts` to link historical bookings to the new patient identity system.

**4. All monetary values in paise**
Storing money as integers (paise = ₹ × 100) avoids floating-point rounding bugs in calculations. Always divide by 100 before display.

**5. `sessions` table name mismatch**
The Drizzle schema defines the table as `sessions` but connect-pg-simple creates it as `session` (no 's'). The `CREATE TABLE IF NOT EXISTS "session"` block in `server/index.ts` ensures the correct table exists. Both coexist in the schema with the actual session store using `session`.
