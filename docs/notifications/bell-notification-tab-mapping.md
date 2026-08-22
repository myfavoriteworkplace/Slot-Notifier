# Bell Notification → Booking Detail Tab Mapping

## Overview

Clicking a bell notification that references a booking (`bookingId` present) opens the **Booking Detail popup** for that booking. This document records exactly which sub-tab opens for each notification `type`, for both the Clinic Admin and Doctor Admin dashboards.

This mapping builds on top of the deep-link infrastructure described in `notification-sync-audit.md` (which routes the click to the right booking) and `notification-service.md` (which defines the `type` + `bookingId` fields on the `notifications` table). This document is scoped specifically to **which tab inside the popup** opens once the booking is located.

---

## Notification Category Breakdown

Every notification created by `server/routes.ts` falls into one of three categories:

- **Category A — Booking-linked (`bookingId` present):** clicking the notification opens the Booking Detail popup on a specific tab. This is the mapping documented below.
- **Category B — Doctor-linked, no booking (`doctor_on_leave`, `doctor_leave_cancelled`):** there is no booking to open. Clicking navigates to the **Manage Doctors** panel instead of any popup/tab.
- **Category C — No bell notification created (`visit_auto_completed`):** this event only triggers a toast/system message, not a bell entry, so there is nothing to map.

---

## Clinic Admin Mapping

**File:** `client/src/pages/ClinicDashboard.tsx` — `applyClinicNotifNav`, `tabMap`
**Popup tabs:** `overview` | `clinical` | `notes` | `actions` | `billing`

| Notification `type` | Opens Tab | Reasoning |
|---|---|---|
| `new_booking` | `overview` | New booking — show the booking summary first. |
| `paid_booking_confirmed` | `billing` | Payment event — take the admin straight to the bill/invoice. |
| `booking_rescheduled` | `overview` | Schedule change — summary view shows the new date/time. |
| `booking_cancelled` | `actions` | Cancellation may need a follow-up action (refund, rebook). |
| `doctor_assigned` | `overview` | Doctor assignment is a summary-level fact. |
| `doctor_approved` | `overview` | Doctor confirmation is a summary-level fact. |
| `doctor_declined` | `actions` | A decline needs the admin to act (reassign another doctor). |
| `consultation_started` | `actions` | Visit is live — admin may need to check in / update status. |
| `visit_completed` | `billing` | Completed visit is the trigger to generate/confirm the bill. |
| `case_closed_by_doctor` | `clinical` | Clinical case closure — relevant detail lives on Clinical tab. |
| `clinical_record_created` | `clinical` | Directly clinical — opens where the record itself lives. |
| `clinical_record_updated` | `clinical` | Directly clinical — opens where the record itself lives. |
| `booking_note_added` | `notes` | Note was added — open where notes are shown. |
| `consent_requested` | `actions` | Consent flow needs admin action (send / follow up). |
| `consent_signed` | `actions` | Signed consent is confirmation of a prior action — actions tab surfaces status. |

Any `type` not present in `tabMap` falls back to `overview` (the default tab when the popup opens).

---

## Doctor Admin Mapping

**File:** `client/src/pages/DoctorDashboard.tsx` — `applyDoctorNotifNav`, `notifTabMap`
**Popup tabs:** `overview` | `notes` | `diagnosis` | `prescription` | `chart`

The Doctor Admin popup has no `actions` or `billing` tab (those are clinic-only concerns), so most non-clinical notification types map to `overview`.

| Notification `type` | Opens Tab | Reasoning |
|---|---|---|
| `doctor_assigned` | `overview` | Assignment is a summary-level fact for the doctor. |
| `patient_checked_in` | `overview` | Check-in status is shown on the summary view. |
| `admin_confirmed` | `overview` | Confirmation status is a summary-level fact. |
| `booking_rescheduled` | `overview` | Schedule change — summary view shows the new date/time. |
| `booking_cancelled` | `overview` | Cancellation is informational for the doctor — no doctor-side action tab exists. |
| `patient_no_show` | `overview` | Visit status change shown on the summary view. |
| `visit_override_completed` | `overview` | Visit status change shown on the summary view. |
| `patient_left_early` | `overview` | Visit status change shown on the summary view. |
| `consent_requested` | `overview` | No actions tab for doctors — status is visible on the summary view. |
| `booking_note_added` | `notes` | Note was added — open where notes are shown. |

Any `type` not present in `notifTabMap` falls back to `overview`.

---

## Implementation Notes

- Both dashboards receive the notification's `type` string as `notifType` inside the `detail` object dispatched by `Header.tsx`'s `handleNotifNavigate` (works both for same-page custom events and for cross-page navigation via `sessionStorage.pendingNotifNav`).
- `ClinicDashboard.tsx` never force-switches the active side panel when opening a booking-linked notification — the Booking Detail dialog is rendered independent of the active quick-filter/panel so it can always show the popup on the correct tab (see the `BookingsPanel.tsx` fix in `notification-sync-audit.md` history, where the empty-state check was changed from `filteredBookings.length === 0` to `bookingsForDialog.length === 0`).
- Category B (`doctor_on_leave`, `doctor_leave_cancelled`) is handled entirely by the `detail.panel` branch in `applyClinicNotifNav`, which calls `setActivePanel("doctors")` — it never touches `tabMap` since there is no booking/tab to open.
- If a new notification `type` is added to `server/routes.ts` in the future, add its entry to **both** `tabMap` (clinic) and `notifTabMap` (doctor) — or explicitly document why it should fall back to `overview`.
