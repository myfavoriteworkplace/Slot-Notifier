# 3. Data and domain audit

## 3.1 Data model inventory

The primary Drizzle schema is `shared/schema.ts`. The application currently defines these major tables:

| Domain | Tables |
|---|---|
| Clinics and booking | `clinics`, `slots`, `bookings` |
| Identity and access | auth tables from `shared/models/auth.ts`, `session`, `doctors`, `doctorInvites`, `clinicDoctors`, `doctorLeaves` |
| Patients | `patients`, `patientCharts`, `patientMedicalHistory`, `patientDocuments` |
| Clinical | `clinicalRecords`, `bookingNotes`, `consentTextVersions`, `consentTokens` |
| Billing | `patientBills`, `billingAuditLogs` |
| Inventory | `inventoryCategories`, `inventoryItems`, `stockTransactions`, `stockAlerts`, `pharmacyStock` |
| Platform/content | `siteSettings`, `smileDeals`, `notifications` |
| Compliance/operations | `auditLogs`, `loginEvents`, `exportHistory`, `activationTokens`, `emailOtps` |

## 3.2 Booking domain

The `bookings` table is the central aggregate. It combines:

- slot and clinic association
- patient/customer snapshots
- verification/confirmation state
- assigned doctor and doctor approval
- clinical status and visit status
- consent and payment fields
- cancellation/no-show metadata
- completion note and booking origin

This is practical for the current product, but it creates a high coupling surface. A change to booking lifecycle can affect cards, filters, stats, notifications, billing, consent, reports, and patient aggregates.

### State fields needing a canonical policy

| Field | Current role | Risk |
|---|---|---|
| `verificationStatus` | patient/clinic confirmation and terminal no-show/cancelled state | no-show can coexist with a visit status that appears active |
| `doctorApprovalStatus` | doctor assignment response | different role views apply different approval filters |
| `visitStatus` | visit lifecycle; nullable | `NULL` behavior differs between SQL predicates and in-memory logic |
| `clinicalStatus` | clinical progress/category data | not consistently part of lifecycle decisions |
| `confirmedBy` | additional confirmation signal | many paths treat it as an alternative to `verificationStatus = confirmed` |

### Recommended domain abstraction

Create a server/client-compatible classification result containing at least:

- local appointment date
- `isOld`, `isToday`, `isFuture`
- `isSameDayPastDue`
- verification state
- doctor approval state
- normalized visit lifecycle
- terminal/read-only/active flags
- doctor action eligibility
- clinic action eligibility
- billing state

The classifier should be pure and table-driven. SQL filters should use equivalent named predicates rather than reimplementing the rules independently.

## 3.3 Query and statistics consistency

`server/storage.ts` computes clinic and doctor list results and stats in separate blocks. This creates several drift points:

- upcoming is tomorrow onward in paged filters, while older paths and client filters use different boundaries
- clinic upcoming requires confirmation; doctor upcoming primarily uses doctor approval
- `completed`, `patient_left_early`, and `treatment_completed` are not excluded identically
- pending logic excludes cancelled but can include other terminal/invalid states
- list filters and stats are maintained by separate loops

### TODO

- Build shared predicate factories for role visibility, date group, terminal lifecycle, and approval.
- Make stats derive from the same classification definition as list rows.
- Add a “classification reason” field or debug-only fixture output for test diagnostics.
- Decide whether same-day past-due belongs in Today, Past, or a separate operational queue.

## 3.4 Nullability and legacy values

`visitStatus` is nullable in the schema. `server/storage.ts` correctly documents and sometimes handles SQL three-valued logic with `isNull(...) OR ne(...)`. This pattern must be applied consistently.

The client unit fixture uses `visitStatus: "scheduled"`, while current code prominently uses `null`, `checked_in`, `in_consultation`, `treatment_completed`, `completed`, and `patient_left_early`. This suggests either a legacy value or a test-only value that should be resolved.

### TODO

- Enumerate all values written to `visitStatus`, `verificationStatus`, and `doctorApprovalStatus`.
- Decide whether to use database enums, validated string unions, or a compatibility layer.
- Backfill or normalize legacy rows before tightening constraints.
- Add explicit tests for null, no-show + active visit status, and unknown legacy values.

## 3.5 Patient identity and aggregates

The `patients` table stores:

- identifying fields
- clinic/doctor association
- `patientCode`
- denormalized `visitCount`
- denormalized `lastVisitAt`

Bookings also contain customer snapshots and optional `patientId`. This is useful for historical rendering but allows identity divergence when contact details change.

### Risks

- email or phone changes can create a new profile
- formatting differences can prevent a match
- missing patient IDs make history dependent on fallback logic
- cancelled/no-show bookings may affect counters unless every update path excludes them
- a booking-linked patient can differ from a directory-created patient

### Recommended aggregate contract

- Visit count: completed visits only
- Last visit: latest completed visit
- Upcoming: confirmed future appointment
- Cancelled/no-show: excluded from visit history aggregates
- Billing total: bills associated with valid clinic bookings

The product owner should confirm this contract before implementation.

## 3.6 Billing

Billing is represented by `patientBills` plus `billingAuditLogs`. Bookings also retain payment-related fields. The UI includes `BillingHistoryPanel`, `AccountsPanel`, and booking-level billing surfaces.

### Risks

- booking payment fields and bill payment fields can represent different concepts
- visit completion banners use bill counts queried separately from booking status
- audit logging for bills is route-dependent
- current type-check failures are in `BillingHistoryPanel.tsx`, including undefined optimistic tax state symbols

### TODO

- Define source of truth for payment status: booking, bill, or derived bill aggregate.
- Ensure paid bills cannot be mutated through any alternate route.
- Add invariants for bill totals, status transitions, and booking linkage.
- Repair the current TypeScript errors before changing billing behavior.

## 3.7 Inventory and pharmacy

Inventory has category, item, transaction, and alert tables. Items now include operational tracking fields such as SKU, barcode, manufacturer, supplier, purchase price, location, batch, thresholds, and expiry/service dates.

The route surface includes inventory categories, items, transactions, and alerts, with clinic authentication middleware. The code should still be reviewed for route-specific validation and clinic ownership on every mutation.

Pharmacy stock is a separate table and feature. It has overlapping concepts such as medicine name, quantity, price, and expiry. This is a product modeling decision:

- keep pharmacy as a distinct medicine-focused stock ledger, or
- unify it under inventory with a typed item category.

Do not merge the models without a migration and reporting plan.

## 3.8 Consent

Consent uses:

- `consentTextVersions`
- `consentTokens`
- booking consent snapshot fields
- public `/api/consent/:token` and sign endpoints

Tokens are unique and expiring. The signing endpoint is rate-limited. The consent model is stronger than a simple boolean because it records text version and signature metadata.

### TODO

- Verify token lookup is constant-time enough for the chosen token entropy.
- Confirm expired and already-signed tokens cannot be replayed.
- Confirm all consent routes receive the intended PII audit record.
- Decide whether consent signatures and IPs must be encrypted at rest in every environment.

## 3.9 Documents and storage

Patient document uploads use a booking-derived key prefix:

`private/clinics/{clinicId}/patients/{patientId}/visits/{bookingId}/documents`

The server derives clinic and patient ownership from the booking rather than trusting browser-supplied ownership. Signed URLs are short-lived, file types are allowlisted, and per-folder size limits exist.

### Remaining storage risks

- General signed upload route accepts a browser-provided `folder` and metadata after authentication; ownership and folder authorization should be explicit per role.
- `publicUrl` is returned for all signed uploads, including folders that may contain sensitive material; patient documents should use private retrieval/signed download semantics rather than public URLs.
- Upload registration and quota tracking are in-memory (`storageQuota.ts`), so process restarts or multiple instances can make quota accounting inconsistent.
- Object deletion and orphan cleanup are documented as future work in existing R2 documentation.

## 3.10 Schema and migration strategy

The repository has:

- one Drizzle migration file under `migrations/`
- schema declarations in `shared/schema.ts`
- many idempotent startup `CREATE TABLE`/`ALTER TABLE` blocks in `server/index.ts`

This dual mechanism is operationally understandable but increases drift risk. A schema change can be present in one place and absent in another.

### TODO

- Make Drizzle migrations the canonical production path.
- Keep startup checks only for safe compatibility/backfill operations.
- Add CI validation that schema tables/columns and migration coverage agree.
- Document the exact production migration procedure and rollback policy for every new data change.