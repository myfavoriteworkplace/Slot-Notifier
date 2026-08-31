# Bell Notification → Booking Detail Tab Mapping

## Notification improvement progress

The following table tracks the notification-bell improvements proposed for the
clinic and doctor admin experience. It separates completed UX/security work from
changes that still require a product or data-retention decision.

| Improvement | Progress | What changed or is proposed | Why it matters | Scope / follow-up |
|---|---|---|---|---|
| Grouped message readability | **Implemented** | Grouped booking previews now use a controlled two-line layout instead of a one-line `truncate` rule. The full stored preview remains available as a tooltip and in the expanded group. | Users can understand more of a note or booking update without making the notification panel unbounded. | UI-only in the shared notification feed. The server’s existing 60-character note-preview policy remains unchanged. |
| Shared mobile notification feed | **Implemented** | Clinic and doctor mobile notification sheets now reuse the same grouped feed as the desktop bell, including date sections, icons, unread styling, navigation, and read controls. | Mobile users now see the same event-oriented notification history instead of a clinic-only static list or a doctor-only approval list. | Uses existing booking deep links and tab mappings. |
| Mobile notification actions | **Implemented** | Mobile rows are clickable, booking-linked rows open the correct booking/tab, grouped rows expand, and unread rows support individual or all-read actions. | A notification becomes an actionable shortcut rather than a passive message. | Doctor approval counts are no longer used as the mobile bell’s unread badge; the badge now reflects stored unread notifications. |
| Individual read authorization | **Implemented** | `PATCH /api/notifications/:id/read` now updates only a notification belonging to the authenticated clinic, doctor, or superuser identity. | Prevents one authenticated user from marking another user’s notification as read by guessing its ID. | A notification that is not owned by the current session returns not found. |
| Loading and failure feedback | **Implemented** | The shared feed now shows loading and retry states when the notification query is pending or fails. | An empty panel is no longer the only signal when notifications are temporarily unavailable. | Realtime socket reconnect behavior remains unchanged and still operates as a background refresh channel. |
| Full note text in bell messages | **Deferred** | Consider storing or loading the complete booking note instead of the current approximately 60-character preview. | Full text could reduce ambiguity, but it increases message size and may expose more note content in a compact surface. | Requires an explicit product/privacy decision; the current booking Notes tab remains the source for full content. |
| Group read semantics | **Deferred** | Decide whether expanding a group should mark all unread items read, or only mark items read when individually opened. | The current behavior is efficient, but a user may expand a group without reviewing every update. | Existing behavior is preserved until the preferred read policy is confirmed. |
| Notification history size | **Deferred** | Add server-side pagination and/or retention for old notifications. | Prevents the API response and client grouping work from growing indefinitely. | Requires retention duration and pagination UX decisions. |
| Date-bucket timezone | **Deferred** | Decide whether Today/Yesterday/Earlier should use browser time or the clinic’s configured timezone. | Users near midnight or working across timezones may otherwise see surprising sections. | Current browser-local grouping is preserved until the business timezone is defined. |
| Refresh-only lifecycle events | **Deferred** | Decide whether events such as automatic completion and no-show reversal should create persistent bell records or remain realtime refresh-only events. | Clarifies which operational changes users should be able to find later in notification history. | Requires event-policy confirmation before adding new notification records. |

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
- `NotificationPanelContent` in `Header.tsx` is the shared feed used by the desktop popover, the shared mobile drawer, the clinic mobile sheet, and the doctor mobile sheet. Keeping these surfaces on one renderer prevents grouping, read controls, and navigation from diverging by viewport or role.
- Grouped latest messages intentionally use a two-line preview. The `notifications.message` value still contains the server-generated approximately 60-character booking-note preview; the full note remains in the booking Notes tab.
- Individual read requests are ownership-scoped on the server using the current session’s notification user ID. A valid notification ID from another clinic or doctor is treated as not found.
- The shared feed exposes loading and retry states. Empty state should therefore be interpreted only after the notification query has successfully completed.
- `ClinicDashboard.tsx` never force-switches the active side panel when opening a booking-linked notification — the Booking Detail dialog is rendered independent of the active quick-filter/panel so it can always show the popup on the correct tab (see the `BookingsPanel.tsx` fix in `notification-sync-audit.md` history, where the empty-state check was changed from `filteredBookings.length === 0` to `bookingsForDialog.length === 0`).
- Category B (`doctor_on_leave`, `doctor_leave_cancelled`) is handled entirely by the `detail.panel` branch in `applyClinicNotifNav`, which calls `setActivePanel("doctors")` — it never touches `tabMap` since there is no booking/tab to open.
- If a new notification `type` is added to `server/routes.ts` in the future, add its entry to **both** `tabMap` (clinic) and `notifTabMap` (doctor) — or explicitly document why it should fall back to `overview`.
