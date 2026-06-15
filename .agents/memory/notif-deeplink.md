---
name: Notification deep-link pattern
description: How notification type+bookingId columns work and how dashboards consume them to auto-open booking cards.
---

## Rule
Every `storage.createNotification()` call must include `type` (string) and `bookingId` (number, where applicable). Leave notifications (doctor_on_leave, doctor_leave_cancelled) have no bookingId.

**Why:** Without type+bookingId the bell panel cannot navigate to the right place. This was a gap across all 28 trigger points — fixed June 2026.

## How to apply
- New notification trigger → always pass `type: "your_type_string"` and `bookingId: N` to createNotification + the broadcast call.
- Type strings are free-form but must be consistent across createNotification and broadcastToClinic/broadcastToDoctor.
- Two type bugs fixed: `"paid_booking"` → `"paid_booking_confirmed"`; `"treatment_completed"` → `"visit_completed"`.

## DB columns
`notifications.type varchar(80)` and `notifications.booking_id integer` — both nullable, no FK. Added via startup migration IF NOT EXISTS.

## Navigation logic (Header.tsx handleNotifNavigate)
- `doctor_on_leave` / `doctor_leave_cancelled` → `/clinic-dashboard?panel=manage-doctors`
- bookingId + clinic user → `/clinic-dashboard?openBooking={id}&notifType={type}`
- bookingId + doctor user → `/doctor-dashboard?openBooking={id}`

## Dashboard URL param reading (one-time useEffect on mount)
- ClinicDashboard: reads `?panel`, `?openBooking`, `?notifType` → setActivePanel + setOpenBookingId + setModalTab
- DoctorDashboard: reads `?openBooking` → setActiveTab("appointments") + setPatientModalId
- notifType → tab map: clinical_record_created/updated/case_closed_by_doctor → "clinical"; booking_note_added → "notes"; consent_requested/signed → "actions"; else → "overview"
