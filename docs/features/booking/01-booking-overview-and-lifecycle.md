# Booking Overview and Lifecycle

## Purpose

This document explains how an appointment moves through BookMySlot from a
patient selecting a slot to the clinic closing the visit. It describes the
normal path and the exception paths without treating all booking states as one
field.

## Main booking paths

### Public patient booking

The public flow is implemented in `client/src/pages/Book.tsx`.

1. The patient selects a clinic.
2. The patient selects a date and available slot.
3. The patient enters name, phone, email, age, gender, and visit details.
4. The application sends an email OTP.
5. The patient verifies the OTP.
6. Existing patient profiles for the email and clinic may be offered for reuse.
7. The patient either submits for clinic approval or completes the optional
   booking-token payment flow.
8. The server creates or associates the booking with a slot.
9. The patient sees a pending or paid-success result.

The primary endpoints are:

- `POST /api/public/otp/send`
- `POST /api/public/otp/verify`
- `POST /api/public/slot-availability`
- `POST /api/public/bookings`
- `POST /api/public/razorpay/create-order`
- `POST /api/public/razorpay/verify-payment`

The server is the final authority for slot capacity and booking validity.

### Clinic-created booking

Clinic staff can create a booking from the authenticated clinic workflow.
This is separate from a patient-submitted public request and may use
`bookedBy=admin` and an administrator confirmation path.

### Doctor workflow

After assignment, a doctor may need to approve the appointment. The doctor can
then work the active visit from the doctor dashboard. Clinic and doctor actions
are intentionally different even though both render the shared
`AppointmentCard`.

## Normal lifecycle

```text
pending
   │
   ├── clinic confirms
   ▼
confirmed
   │
   ├── patient arrives
   ▼
checked_in
   │
   ├── doctor starts consultation
   ▼
in_consultation
   │
   ├── doctor completes treatment
   ▼
treatment_completed
   │
   ├── clinic closes the visit
   ▼
completed
```

Doctor assignment and approval are independent of the visit steps. A booking
may be assigned while still pending, and a clinic may use `admin_confirmed`
when the clinic confirms the assigned doctor on the doctor's behalf.

## Exception and terminal paths

### Cancellation

Clinic staff can cancel a booking while it is still progressable. The reason
is stored in `cancellationReason`, and the booking becomes terminal.

### No-show

Clinic staff can mark a booking as `no_show` when the patient has not started
the visit. No-show processing can be performed for one booking or as a batch.
Batch candidates are rechecked by the server before being changed.

### Patient left early

The clinic can close an active visit as `patient_left_early`. A reason is
required and the visit record remains available for history.

### Administrative override

Clinic staff can force an unresolved booking to `completed` when an
intermediate step was skipped. The override requires a reason and records it
as an administrative completion note. The UI presents the skipped-stage
condition in the booking progress strip.

### Rebooking

Completed, terminal, and eligible old bookings can be rebooked. Rebooking
uses the existing patient information as a starting point but creates a new
appointment rather than mutating the historical visit into a new visit.

## Related concerns

- Consent is linked to the booking but is not a booking status.
- Clinical records and patient documents remain linked to the visit/booking.
- Billing is independent of confirmation and visit completion.
- Notifications are side effects of selected transitions, not the source of
  the transition.
- The clinic timezone is used when classifying dates such as today, past, and
  past-due.

## Implementation map

| Responsibility | Source |
| --- | --- |
| Public form and submission | `client/src/pages/Book.tsx` |
| Public booking routes | `server/routes.ts` |
| Booking persistence | `server/storage.ts` |
| Status interpretation | `shared/booking-status.ts` |
| Clinic orchestration | `client/src/components/BookingsPanel.tsx` |
| Doctor orchestration | `client/src/pages/DoctorDashboard.tsx` |
| Shared presentation | `client/src/components/AppointmentCard.tsx` |