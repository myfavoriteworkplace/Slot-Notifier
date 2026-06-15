# Notification Deep-Link Implementation

## Overview

This document records the full notification deep-link implementation for BookMySlot. Clicking any bell notification now navigates the user directly to the relevant booking card, panel, or tab inside the clinic or doctor dashboard — no manual searching required.

---

## What Was Changed and Why

### Problem Before

The `notifications` database table had no `type` or `booking_id` columns, so every notification was an anonymous string message. The bell panel marked notifications as read but did nothing else — there was no way to know which booking triggered the notification or where to navigate. 28 `createNotification` calls across `server/routes.ts` were missing both `type` and `bookingId`. Two of them also had mismatched broadcast type strings.

### Solution

1. Added `type` and `booking_id` columns to the `notifications` table.
2. Wired `type` and `bookingId` into all 28 notification trigger points.
3. Fixed 2 type-string mismatches.
4. Made the notification bell navigate on click based on `type` + `bookingId` + current user role.
5. Made `ClinicDashboard` and `DoctorDashboard` read URL params on mount to open the correct panel and booking card automatically.

---

## Database Changes

### Schema (`shared/schema.ts`)

Added two optional columns to the `notifications` pgTable:

```
type       varchar(80)   — notification category string (e.g. "new_booking", "consent_signed")
booking_id integer       — links back to the bookings table row
```

Both are nullable so existing rows are unaffected and no FK constraint is added (intentional — clinic/doctor IDs are not in the users table; see `notification-service.md`).

### Migration (`server/index.ts`)

Two `ALTER TABLE` statements added to the startup migration block (run every boot via `IF NOT EXISTS`, safe to re-run):

```sql
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type varchar(80);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS booking_id integer;
```

**Render action required:** Run these two statements on the production Render database manually before deploying.

---

## Backend Changes (`server/routes.ts`)

### Type-string bug fixes

| Location | Old type string | Corrected type string |
|---|---|---|
| Paid booking confirmation (~line 1747) | `"paid_booking"` | `"paid_booking_confirmed"` |
| Doctor completes treatment (~line 4405) | `"treatment_completed"` | `"visit_completed"` |

### All 28 notification trigger points updated

Every `storage.createNotification()` call now includes `type` and (where applicable) `bookingId`. Every `broadcastToClinic` / `broadcastToDoctor` call now includes `bookingId` in the broadcast payload.

| # | Route / Event | Recipient | Type string | bookingId |
|---|---|---|---|---|
| 1 | Paid booking confirmed (Razorpay flow) | Clinic admin | `paid_booking_confirmed` | ✓ |
| 2 | New booking (free / direct flow) | Clinic admin | `new_booking` | ✓ |
| 3 | Booking rescheduled → clinic admin | Clinic admin | `booking_rescheduled` | ✓ |
| 4 | Booking rescheduled → assigned doctor | Doctor | `booking_rescheduled` | ✓ |
| 5 | Clinical status changed by clinic admin | Doctor | `clinical_status_updated` or `case_closed_by_clinic` | ✓ |
| 6 | Patient checked in | Doctor | `patient_checked_in` | ✓ |
| 7 | Admin confirmed on doctor's behalf | Doctor | `admin_confirmed` | ✓ |
| 8 | Booking cancelled → clinic admin | Clinic admin | `booking_cancelled` | ✓ |
| 9 | Booking cancelled → assigned doctor | Doctor | `booking_cancelled` | ✓ |
| 10 | Doctor assigned to appointment | Doctor | `doctor_assigned` | ✓ |
| 11 | Doctor approved appointment | Clinic admin | `doctor_approved` | ✓ |
| 12 | Doctor declined appointment | Clinic admin | `doctor_declined` | ✓ |
| 13 | Doctor marked day as leave | Clinic admin | `doctor_on_leave` | — (no booking) |
| 14 | Doctor cancelled leave | Clinic admin | `doctor_leave_cancelled` | — (no booking) |
| 15 | Case closed (doctor notes route) | Clinic admin | `case_closed_by_doctor` | ✓ |
| 16 | Booking note added by doctor | Clinic admin | `booking_note_added` | ✓ |
| 17 | Booking note added by clinic admin | Doctor | `booking_note_added` | ✓ |
| 18 | Case closed (doctor clinical-status route) | Clinic admin | `case_closed_by_doctor` | ✓ |
| 19 | Doctor started consultation | Clinic admin | `consultation_started` | ✓ |
| 20 | Doctor completed treatment (visit) | Clinic admin | `visit_completed` | ✓ |
| 21 | Patient no-show | Doctor | `patient_no_show` | ✓ |
| 22 | Admin force-completed visit | Doctor | `visit_override_completed` | ✓ |
| 23 | Patient left early | Doctor | `patient_left_early` | ✓ |
| 24 | Clinic sent consent form request → doctor | Doctor | `consent_requested` | ✓ |
| 25 | Doctor sent consent form request → clinic | Clinic admin | `consent_requested` | ✓ |
| 26 | Patient signed consent form | Clinic admin | `consent_signed` | ✓ |
| 27 | Clinical record created | Clinic admin | `clinical_record_created` | ✓ |
| 28 | Clinical record updated | Clinic admin | `clinical_record_updated` | ✓ |

---

## Frontend Changes

### `client/src/components/Header.tsx`

**`NotificationBellPanel`** — added `onNavigate?: (n: Notification) => void` prop. The notification row `onClick` now calls `onNavigate?.(n)` in addition to marking the item as read.

**`Header`** — switched `useLocation` destructuring to `[location, setLocation]`. Added `handleNotifNavigate`:

```
doctor_on_leave / doctor_leave_cancelled  (no bookingId)
  → setLocation("/clinic-dashboard?panel=manage-doctors")

notification with bookingId, user is clinic admin or superuser
  → setLocation(`/clinic-dashboard?openBooking={id}&notifType={type}`)

notification with bookingId, user is doctor
  → setLocation(`/doctor-dashboard?openBooking={id}`)
```

`bellProps` now includes `onNavigate: handleNotifNavigate`.

---

### `client/src/pages/ClinicDashboard.tsx`

Added a one-time `useEffect` (empty deps `[]`) on mount that reads URL search params:

| URL Param | Effect |
|---|---|
| `?panel=X` | `setActivePanel(X)` |
| `?openBooking=N` | `setActivePanel("bookings")` + `setOpenBookingId(N)` |
| `?notifType=X` (with openBooking) | Maps type → modal tab, calls `setModalTab(N, tab)` |

**notifType → modal tab mapping:**

| notifType | Tab opened |
|---|---|
| `clinical_record_created` | `clinical` |
| `clinical_record_updated` | `clinical` |
| `case_closed_by_doctor` | `clinical` |
| `booking_note_added` | `notes` |
| `consent_requested` | `actions` |
| `consent_signed` | `actions` |
| all others | `overview` (default) |

---

### `client/src/pages/DoctorDashboard.tsx`

Added a one-time `useEffect` (empty deps `[]`) on mount that reads URL search params:

| URL Param | Effect |
|---|---|
| `?openBooking=N` | `setActiveTab("appointments")` + `setPatientModalId(N)` |

---

## End-to-End Navigation Flows

### Clinic admin — "New booking" notification
1. Bell badge appears (WebSocket push).
2. Admin clicks the notification row.
3. Row marked read. `handleNotifNavigate` fires.
4. `type = "new_booking"`, `bookingId = 42` → navigates to `/clinic-dashboard?openBooking=42&notifType=new_booking`.
5. Dashboard reads params → `setActivePanel("bookings")` + `setOpenBookingId(42)`.
6. Bookings panel opens, booking card #42 opens on **Overview** tab.

### Clinic admin — "Consent signed" notification
Same flow but `notifType=consent_signed` → modal opens on the **Actions** tab (Digital Consent panel).

### Clinic admin — "Doctor on leave" notification
`handleNotifNavigate` detects `type = "doctor_on_leave"` (no bookingId) → `/clinic-dashboard?panel=manage-doctors`. Manage Doctors panel opens directly.

### Clinic admin — "Clinical record created" notification
`notifType=clinical_record_created` → modal opens on the **Clinical Records** tab.

### Clinic admin — "Booking note added" notification
`notifType=booking_note_added` → modal opens on the **Notes** tab.

### Doctor — "Patient checked in" notification
1. Doctor clicks the notification.
2. `isDoctorAuthenticated` → navigates to `/doctor-dashboard?openBooking=42`.
3. Dashboard reads params → `setActiveTab("appointments")` + `setPatientModalId(42)`.
4. Appointments tab opens, patient card #42 opens.

### Doctor — "Doctor assigned" / "Booking cancelled" / "No-show" notifications
Same as doctor flow above — navigates to `/doctor-dashboard?openBooking={id}`.

---

## Areas and Scenarios Covered

| Area | Scenarios |
|---|---|
| **New bookings** | New booking (free flow), paid booking confirmed (Razorpay) |
| **Booking lifecycle** | Rescheduled, cancelled — notifies both clinic admin and doctor |
| **Doctor workflow** | Assigned, approved, declined, checked-in, consultation started, treatment completed |
| **Admin overrides** | Admin confirmed on doctor's behalf, force-completed visit |
| **Patient events** | No-show, patient left early |
| **Clinical status** | All status changes (first visit, revisit, follow-up, case closed) |
| **Clinical records** | Record created, record updated |
| **Booking notes** | Note added by doctor → clinic, note added by clinic → doctor |
| **Digital consent** | Consent requested (from clinic), consent requested (from doctor), consent signed |
| **Doctor availability** | Doctor marked leave, doctor cancelled leave → panel nav (no booking card) |
| **Deep-link routing** | Clinic admin → ClinicDashboard with panel + booking card + tab auto-open |
| **Deep-link routing** | Doctor → DoctorDashboard with appointments tab + patient card auto-open |

---

## Completeness Checklist

- ✅ All 28 notification triggers carry `type` and `bookingId` (where applicable)
- ✅ 2 type-string mismatches corrected (`paid_booking` → `paid_booking_confirmed`; `treatment_completed` → `visit_completed`)
- ✅ DB columns `type` + `booking_id` added to schema (`shared/schema.ts`) and startup migration (`server/index.ts`)
- ✅ Header bell click navigates to correct route with URL params
- ✅ ClinicDashboard reads URL params and opens correct panel + booking card + modal tab
- ✅ DoctorDashboard reads URL params and opens correct booking card
- ✅ Leave notifications (no bookingId) navigate to the Manage Doctors panel
- ✅ All existing notifications without `type`/`bookingId` still work (nullable columns; click is a no-op navigation-wise for those rows)
- ✅ `express-rate-limit` package installed and lockfile sanitised

---

## Render Production SQL

Run on the Render production database before deploying:

```sql
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type varchar(80);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS booking_id integer;
```
