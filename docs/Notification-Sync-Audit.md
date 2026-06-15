# Full Cross-Entity Notification & Sync Audit

**BookMySlot Dental — server/routes.ts**
Last updated: June 2026

This document is the single source of truth for every notification event in the system. It covers all four roles (Superadmin, Clinic Admin, Doctor, Patient), all delivery channels (in-app WebSocket push, email via Resend, WhatsApp via Twilio), and every trigger scenario — including newly implemented gaps and already-working flows.

---

## Roles

| Role | Session key | Authenticated via |
|---|---|---|
| **Superadmin** | `req.user.role === 'superuser'` | Replit OIDC / `ADMIN_EMAIL` env |
| **Clinic Admin (Owner)** | `sess.clinicId`, `sess.adminLoggedIn` | Username + password |
| **Doctor** | `sess.doctorEmail`, `sess.role === 'doctor'` | Email + password |
| **Patient** | Anonymous (no session) | OTP email verification before booking |

---

## Delivery Channels

| Channel | Infrastructure | Triggered by | Falls back to |
|---|---|---|---|
| **In-app (WebSocket)** | `broadcastToClinic()` / `broadcastToDoctor()` | `storage.createNotification()` | Notification persisted in DB; WebSocket push fires if client is connected |
| **Email** | Resend API (`RESEND_API_KEY`) | `resend.emails.send()` | If `RESEND_MODE !== 'PRODUCTION'`, all mail redirects to `TEST_EMAIL` |
| **WhatsApp** | Twilio API | `sendWhatsAppMessage()` / `sendWhatsAppBookingNotification()` / etc. | Silent fail (`.catch(() => {})`) — non-blocking |

All notification code is **fire-and-forget** wrapped in try/catch so a notification failure never blocks the HTTP response.

---

## Complete Scenario Matrix

### ENTITY PAIR: Patient → Clinic

| # | Event | Trigger | In-App | Email | WhatsApp | Route |
|---|---|---|---|---|---|---|
| P→C-1 | Patient submits new booking | `POST /api/public/book` | ✅ `broadcastToClinic` | ✅ clinic notified; patient confirmation sent | ✅ Patient gets WA confirmation | `server/routes.ts` ~line 1732 |
| P→C-2 | Patient completes Razorpay payment (paid booking) | `POST /api/public/razorpay/verify-payment` | ✅ `broadcastToClinic` ("paid booking confirmed") | ✅ Booking confirmation to patient | ✅ Patient gets WA | ~line 1738 |
| P→C-3 | Patient signs consent form | `POST /api/consent/:token/sign` | ✅ `broadcastToClinic` ("consent signed") | — | — | ~line 4466 |

---

### ENTITY PAIR: Clinic Admin → Patient

| # | Event | Trigger | In-App | Email | WhatsApp | Route |
|---|---|---|---|---|---|---|
| C→P-1 | Clinic confirms booking | `PATCH /api/auth/clinic/bookings/:id/confirm` | — | ✅ Confirmation email to patient | ✅ WA confirmation | ~line 3611 |
| C→P-2 | Clinic cancels booking | `DELETE /api/auth/clinic/bookings/:id` | ✅ Clinic self-notified | ✅ Cancellation email to patient | — | ~line 3536 |
| C→P-3 | Clinic reschedules booking | `PATCH /api/auth/clinic/bookings/:id/reschedule` | ✅ Clinic self-notified | ✅ Reschedule email to patient | ✅ **[G7 — NEW]** WA reschedule message | ~line 3326 |
| C→P-4 | Bill marked as paid | `PATCH /api/auth/clinic/bills/:id` | — | ✅ **[G13 — NEW]** Auto-sent on `paymentStatus='paid'` | — | ~line 4944 |
| C→P-5 | Manual payment notification | `POST /api/auth/clinic/bills/:id/notify-paid` | — | ✅ Manual trigger (existing) | — | ~line 4978 |
| C→P-6 | Send appointment reminder | `PATCH /api/auth/clinic/bookings/:id/send-reminder` | — | — | ✅ WA reminder message | ~line 4250 |

---

### ENTITY PAIR: Clinic Admin → Doctor

| # | Event | Trigger | In-App | Email | WhatsApp | Route |
|---|---|---|---|---|---|---|
| C→D-1 | Doctor assigned to booking | `PATCH /api/clinic/bookings/:id/assign-doctor` | ✅ `broadcastToDoctor` ("assigned to booking") | ✅ Doctor assignment email | — | ~line 3611 |
| C→D-2 | Patient checked in (arrived) | `PATCH /api/auth/clinic/bookings/:id/checkin` | ✅ `broadcastToDoctor` ("patient is in waiting room") | — | — | ~line 3397 |
| C→D-3 | Booking cancelled | `DELETE /api/auth/clinic/bookings/:id` | ✅ **[G3 — NEW]** `broadcastToDoctor` | — | — | ~line 3536 |
| C→D-4 | Booking rescheduled | `PATCH /api/auth/clinic/bookings/:id/reschedule` | ✅ **[G6 — NEW]** `broadcastToDoctor` | — | — | ~line 3326 |
| C→D-5 | Clinical status updated (any value) | `PATCH /api/auth/clinic/bookings/:id/clinical-status` | ✅ **[G10 — NEW]** `broadcastToDoctor` for ALL status changes | — | — | ~line 3404 |
| C→D-6 | Patient marked no-show | `PATCH /api/auth/clinic/bookings/:id/no-show` | ✅ **[G11 — NEW]** `broadcastToDoctor` | — | — | ~line 4340 |
| C→D-7 | Admin force-completed visit | `PATCH /api/auth/clinic/bookings/:id/override-complete` | ✅ **[G12 — NEW]** `broadcastToDoctor` | — | — | ~line 4425 |
| C→D-8 | Patient left early | `PATCH /api/auth/clinic/bookings/:id/patient-left-early` | ✅ **[G12b — NEW]** `broadcastToDoctor` | — | — | ~line 4468 |
| C→D-9 | Booking note added by clinic admin | `POST /api/booking/:id/notes` (authorType=clinic_admin) | ✅ **[G8 — NEW]** `broadcastToDoctor` | — | — | ~line 4210 |
| C→D-10 | Consent form sent to patient by clinic | `POST /api/auth/clinic/bookings/:id/request-consent` | ✅ **[G15 — NEW]** `broadcastToDoctor` | — | — | ~line 4542 |

---

### ENTITY PAIR: Doctor → Clinic Admin

| # | Event | Trigger | In-App | Email | WhatsApp | Route |
|---|---|---|---|---|---|---|
| D→C-1 | Doctor approves assignment | `PATCH /api/doctor/bookings/:id/approve` | ✅ `broadcastToClinic` ("confirmed appointment") | — | — | ~line 3706 |
| D→C-2 | Doctor declines assignment | `PATCH /api/doctor/bookings/:id/decline` | ✅ `broadcastToClinic` ("declined — reassignment needed") | ✅ Email to clinic admin | — | ~line 3731 |
| D→C-3 | Doctor starts consultation | `PATCH /api/doctor/bookings/:id/start-consultation` | ✅ `broadcastToClinic` | — | — | ~line 4268 |
| D→C-4 | Doctor completes visit | `PATCH /api/doctor/bookings/:id/complete-visit` | ✅ `broadcastToClinic` | — | — | ~line 4295 |
| D→C-5 | Doctor marks case closed (clinical status) | `PATCH /api/doctor/bookings/:id/clinical-status` (case_closed) | ✅ `broadcastToClinic` | — | — | ~line 4290 |
| D→C-6 | Doctor takes leave | `POST /api/doctor/leaves` | ✅ **[G5 — NEW]** `broadcastToClinic` to all linked clinics | — | — | ~line 4060 |
| D→C-7 | Doctor cancels leave | `DELETE /api/doctor/leaves/:id` | ✅ **[G20 — NEW]** `broadcastToClinic` to all linked clinics | — | — | ~line 4093 |
| D→C-8 | Doctor creates clinical record | `POST /api/clinical-records` | ✅ **[G9 — NEW]** `broadcastToClinic` | — | — | ~line 4649 |
| D→C-9 | Doctor updates clinical record | `PATCH /api/clinical-records/:id` | ✅ **[G9b — NEW]** `broadcastToClinic` | — | — | ~line 4700 |
| D→C-10 | Doctor requests consent | `POST /api/doctor/bookings/:id/request-consent` | ✅ **[G14 — NEW]** `broadcastToClinic` | — | — | ~line 4596 |
| D→C-11 | Booking note added by doctor | `POST /api/booking/:id/notes` (authorType=doctor) | ✅ **[G8 — NEW]** `broadcastToClinic` | — | — | ~line 4210 |

---

### ENTITY PAIR: Doctor → Patient

| # | Event | Trigger | In-App | Email | WhatsApp | Route |
|---|---|---|---|---|---|---|
| D→P-1 | Doctor approves assignment (indirectly confirms appt) | `PATCH /api/doctor/bookings/:id/approve` | — | ✅ Confirmation email to patient | ✅ WA confirmation | ~line 3656 |

> Note: All other doctor→patient interactions go via the clinic. Doctors do not have a direct notification channel to patients outside of the consent flow.

---

### ENTITY PAIR: Patient → Doctor

| # | Event | Trigger | In-App | Email | WhatsApp |
|---|---|---|---|---|---|
| P→D-1 | Patient signs consent | `POST /api/consent/:token/sign` | — | — | — |

> Patients have no direct notification channel to doctors. When a patient signs consent, only the clinic is notified (P→C-3 above). The doctor can observe consent status by checking the booking card.

---

### ENTITY PAIR: Superadmin → Clinic Admin

| # | Event | Trigger | In-App | Email | WhatsApp | Route |
|---|---|---|---|---|---|---|
| SA→C-1 | Clinic registration approved | `PATCH /api/clinics/:id/approve` | — | ✅ Approval email with login credentials | — | ~line 1095 |
| SA→C-2 | Clinic archived (suspended) | `PATCH /api/clinics/:id/archive` | — | ✅ **[G16 — NEW]** Suspension notice email | — | ~line 3886 |
| SA→C-3 | Clinic unarchived (reinstated) | `PATCH /api/clinics/:id/unarchive` | — | ✅ **[G16 — NEW]** Reinstatement email | — | ~line 3906 |
| SA→C-4 | Clinic credentials updated | `PATCH /api/clinics/:id/credentials` | — | ✅ **[G17 — NEW]** New credentials email | — | ~line 3926 |

---

### ENTITY PAIR: Clinic Admin → Doctor (Invitations)

| # | Event | Trigger | In-App | Email | WhatsApp | Route |
|---|---|---|---|---|---|---|
| C→D-INV-1 | Doctor invited to clinic | `POST /api/auth/clinic/doctors/invite` | — | ✅ Invitation email with portal link | — | ~line 3791 |
| C→D-INV-2 | Existing doctor added to clinic | `POST /api/auth/clinic/doctors` | — | ✅ Welcome email with credentials | — | ~line 3760 |

---

## Gap Resolution Summary

| Gap # | Description | Status | Implementation |
|---|---|---|---|
| G1 | Doctor approves → clinic notified | ✅ Was already done | `broadcastToClinic` in approve route |
| G2 | Doctor declines → clinic notified | ✅ Was already done | `broadcastToClinic` + email in decline route |
| G3 | Booking cancelled → assigned doctor notified | ✅ **Implemented** | `broadcastToDoctor` in DELETE booking route |
| G4 | Patient signs consent → clinic notified | ✅ Was already done | `broadcastToClinic` in consent sign route |
| G5 | Doctor takes leave → clinic notified | ✅ **Implemented** | `broadcastToClinic` to all linked clinics in POST leaves |
| G6 | Clinic reschedules → assigned doctor notified | ✅ **Implemented** | `broadcastToDoctor` in reschedule route |
| G7 | Clinic reschedules → patient gets WhatsApp | ✅ **Implemented** | `sendWhatsAppMessage` in reschedule route |
| G8 | Booking note added → other party notified | ✅ **Implemented** | `broadcastToClinic`/`broadcastToDoctor` in POST notes |
| G9 | Doctor creates clinical record → clinic notified | ✅ **Implemented** | `broadcastToClinic` in POST clinical-records |
| G9b | Doctor updates clinical record → clinic notified | ✅ **Implemented** | `broadcastToClinic` in PATCH clinical-records/:id |
| G10 | Clinic changes clinical status → doctor notified | ✅ **Implemented** | Expanded from case_closed-only to ALL status values |
| G11 | Clinic marks no-show → doctor notified | ✅ **Implemented** | `broadcastToDoctor` in no-show route |
| G12 | Clinic force-completes visit → doctor notified | ✅ **Implemented** | `broadcastToDoctor` in override-complete route |
| G12b | Patient left early → doctor notified | ✅ **Implemented** | `broadcastToDoctor` in patient-left-early route |
| G13 | Bill marked paid → patient auto-notified | ✅ **Implemented** | Auto email in PATCH bills when `paymentStatus='paid'` |
| G14 | Doctor requests consent → clinic notified | ✅ **Implemented** | `broadcastToClinic` in doctor request-consent route |
| G15 | Clinic requests consent → assigned doctor notified | ✅ **Implemented** | `broadcastToDoctor` in clinic request-consent route |
| G16 | Superadmin archives/unarchives clinic → email | ✅ **Implemented** | Email in archive + unarchive routes |
| G17 | Superadmin updates credentials → email to clinic | ✅ **Implemented** | Email with new credentials in credentials route |
| G19 | Patient pays via Razorpay → clinic notified | ✅ Was already done | `broadcastToClinic` ("paid booking confirmed") |
| G20 | Doctor cancels leave → clinic notified | ✅ **Implemented** | `broadcastToClinic` to all linked clinics in DELETE leaves |

---

## In-App Notification Event Types

The `type` field on WebSocket broadcasts lets the frontend react to specific events in real time (e.g. invalidate a query cache, show a toast, play a sound).

| `type` value | Sender | Recipient | Description |
|---|---|---|---|
| `new_booking` | Patient | Clinic | New booking submitted |
| `paid_booking_confirmed` | Patient | Clinic | Razorpay payment verified |
| `booking_confirmed` | Clinic | Self | Clinic confirmed a booking |
| `booking_cancelled` | Clinic | Doctor | Clinic cancelled a booking that had a doctor assigned |
| `booking_rescheduled` | Clinic | Doctor | Clinic rescheduled a booking |
| `booking_note_added` | Clinic or Doctor | The other party | A note was added to the shared thread |
| `doctor_approved` | Doctor | Clinic | Doctor confirmed their assignment |
| `doctor_declined` | Doctor | Clinic | Doctor rejected their assignment |
| `doctor_on_leave` | Doctor | Clinic | Doctor marked a date as leave |
| `doctor_leave_cancelled` | Doctor | Clinic | Doctor cancelled a previously-set leave |
| `patient_no_show` | Clinic | Doctor | Patient did not arrive |
| `visit_override_completed` | Clinic | Doctor | Admin force-completed the visit |
| `patient_left_early` | Clinic | Doctor | Patient left before treatment was complete |
| `clinical_status_updated` | Clinic | Doctor | Clinical status changed (non-closed) |
| `case_closed_by_clinic` | Clinic | Doctor | Clinic closed the case |
| `case_closed_by_doctor` | Doctor | Clinic | Doctor closed the case |
| `clinical_record_created` | Doctor | Clinic | New clinical record / prescription created |
| `clinical_record_updated` | Doctor | Clinic | Existing clinical record updated |
| `consent_requested` | Doctor or Clinic | The other party + patient (WA) | Consent form request sent |
| `consent_signed` | Patient | Clinic | Patient signed the digital consent form |
| `admin_confirmed` | Clinic | Doctor | Assigned doctor notified of a pre-existing confirmed booking |
| `visit_auto_completed` | System | Clinic | All bills paid → booking auto-completed |

---

## Email Templates

| Template / Subject | Trigger | Recipient | File |
|---|---|---|---|
| Booking Confirmation | New booking / Doctor approval | Patient | Inline in `sendConfirmationEmail()` |
| Reschedule Notice | Clinic reschedules | Patient | Inline in `sendRescheduleEmail()` |
| Cancellation Notice | Clinic cancels | Patient | Inline in `sendCancellationEmail()` |
| Payment Confirmed | Bill marked paid (auto) | Patient | Inline in PATCH bills handler |
| Doctor Assignment | Doctor assigned to booking | Doctor | Inline in assign-doctor route |
| Doctor Decline Alert | Doctor declines assignment | Clinic Admin | Inline in decline route |
| Clinic Approved | Superadmin approves registration | Clinic Admin | Inline in approve route |
| Account Suspended | Superadmin archives clinic | Clinic Admin | Inline in archive route |
| Account Reinstated | Superadmin unarchives clinic | Clinic Admin | Inline in unarchive route |
| Credentials Updated | Superadmin changes credentials | Clinic Admin | Inline in credentials route |
| Doctor Invitation | Clinic invites doctor | Doctor | Inline in invite route |

---

## WhatsApp Messages

| Message | Trigger | Recipient |
|---|---|---|
| Booking confirmation | New booking / doctor approval | Patient |
| Reschedule notice | Clinic reschedules | Patient |
| Appointment reminder | Manual trigger by clinic | Patient |
| Consent form link | Clinic or doctor requests consent | Patient |

---

## Known Limitations & Future Scope

| Area | Current State | Suggested Enhancement |
|---|---|---|
| **Doctor clinical status changes → clinic** | Only notifies on `case_closed`; other status changes (first_visit, revisit, follow_up_required) are silent toward clinic | Add `broadcastToClinic` in `PATCH /api/doctor/bookings/:id/clinical-status` for non-closed statuses |
| **Doctor → Patient direct channel** | No direct channel; all communication goes clinic → patient | Could add doctor-initiated SMS/WA reminders in future |
| **Patient left early → Patient** | Patient is not informed | Could send WA message if a reason/follow-up is needed |
| **Multiple doctors assigned** | Only one `assignedDoctorEmail` per booking; multi-doctor cases won't notify all doctors | Extend `bookings.assignedDoctors` to an array |
| **Superadmin in-app alerts** | Superadmin has no in-app notification feed | Add admin notification feed for new clinic registrations, complaints |
| **Email open/click tracking** | Not tracked | Resend supports webhooks for open/click events |
| **G18 — Doctor profile updated** | No notification to clinic | Low priority; clinic can see doctor profiles on demand |
| **WhatsApp delivery receipts** | Not tracked | Twilio Status Callback URL can be configured |

---

## Code Conventions

All notification blocks follow this pattern to ensure they never block the response:

```ts
// [G-number] — Short description
if (conditionToNotify) {
  try {
    const notif = await storage.createNotification({
      userId: String(recipientId),
      message: `Human-readable message`,
      read: false,
    });
    broadcastToClinic(String(recipientId), { type: "event_type", notification: notif });
    // OR:
    broadcastToDoctor(String(recipientId), { type: "event_type", notification: notif });
  } catch (e: any) {
    console.error('[NOTIFICATION] Description of what failed:', e.message);
  }
}
```

**Rules:**
1. All notification code is inside `try/catch` — a notification failure must never cause a 500 error.
2. Email sends use `.catch(() => {})` — always fire-and-forget.
3. WhatsApp sends use `.catch(() => {})` — always fire-and-forget.
4. `storage.createNotification()` persists to DB first, then WebSocket push follows — so notifications survive page refreshes.
5. The `userId` field on notifications stores **clinic ID** (string) for clinic-scoped notifications and **doctor ID** (string) for doctor-scoped notifications.
