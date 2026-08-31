# Booking API and Server Contracts

## General rules

The internal reminder digest endpoint is scheduler-only and requires the
`x-reminder-job-secret` header. It is not available through a user session.

Routes are implemented in `server/routes.ts` and persistence is handled by
`server/storage.ts`. Authenticated routes use the current session and must
recheck role/ownership and current booking state.

The route names below are grouped by caller and purpose. The server remains
the source of truth even when the client classifier hides or enables a button.

Booking list and detail responses may include the nullable
`patientVisitClassification` field. It is populated only for new bookings
created by a patient or clinic admin, after the booking is linked to the clinic
patient profile. The server determines the value from earlier non-cancelled,
non-no-show bookings for that patient; clients must display the persisted value
and must not recalculate it from `visitCount`. The `bookedBy` value determines
whether the display prefix is `Booked by Patient` or `Booked by Clinic Admin`.

The clinic booking request may send `patientId: "new"` when the admin selects
Create New Patient Profile. The server then creates a separate clinic patient
record instead of applying the normal email/phone upsert behavior.

## Public patient routes

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/api/public/otp/send` | Send booking email OTP |
| `POST` | `/api/public/otp/verify` | Verify OTP and return booking verification context |
| `GET` | `/api/public/patients-by-email` | Find existing clinic patient profiles after verification |
| `POST` | `/api/public/slot-availability` | Calculate availability for candidate slots |
| `GET` | `/api/public/clinic-availability` | Determine clinic/date availability |
| `POST` | `/api/public/bookings` | Create a public booking request |
| `POST` | `/api/public/razorpay/create-order` | Create optional booking-token payment order |
| `POST` | `/api/public/razorpay/verify-payment` | Verify payment and create/confirm paid booking |

## Clinic routes

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/auth/clinic/bookings` | Paginated filtered booking list |
| `GET` | `/api/auth/clinic/bookings/stats` | Booking counts/statistics |
| `GET` | `/api/auth/clinic/reminders` | Live clinic-scoped upcoming reminders |
| `GET` | `/api/auth/clinic/patients/match?email=...&phone=...` | Match patients by email or phone |
| `GET` | `/api/auth/clinic/bookings/:id` | Fetch one booking for focus/deep link |
| `POST` | `/api/auth/clinic/bookings` | Create clinic/admin booking |
| `PATCH` | `/api/auth/clinic/bookings/:id/confirm` | Confirm booking |
| `DELETE` | `/api/auth/clinic/bookings/:id` | Cancel booking |
| `PATCH` | `/api/auth/clinic/bookings/:id/reschedule` | Move booking to another slot |
| `PATCH` | `/api/clinic/bookings/:id/assign-doctor` | Assign or reassign doctor |
| `PATCH` | `/api/auth/clinic/bookings/:id/clinical-status` | Update case classification |
| `PATCH` | `/api/auth/clinic/bookings/:id/checkin` | Check in or undo check-in |
| `PATCH` | `/api/auth/clinic/bookings/:id/complete-visit` | Close a treatment-completed visit |
| `PATCH` | `/api/auth/clinic/bookings/:id/no-show` | Mark one booking no-show |
| `POST` | `/api/auth/clinic/bookings/mark-no-show-batch` | Recheck and mark multiple candidates |
| `PATCH` | `/api/auth/clinic/bookings/:id/revert-no-show` | Revert an eligible batch no-show |
| `PATCH` | `/api/auth/clinic/bookings/:id/send-reminder` | Send a booking reminder |
| `PATCH` | `/api/auth/clinic/bookings/:id/override-complete` | Force-complete with required reason |
| `PATCH` | `/api/auth/clinic/bookings/:id/patient-info` | Update booking patient snapshot |
| `PATCH` | `/api/auth/clinic/bookings/:id/patient-left-early` | Close an active visit as early exit |
| `POST` | `/api/auth/clinic/bookings/:id/request-consent` | Generate/send consent link |

## Doctor routes

| Method | Route | Purpose |
| --- | --- | --- |
| `PATCH` | `/api/doctor/bookings/:id/approve` | Approve assigned booking |
| `PATCH` | `/api/doctor/bookings/:id/decline` | Decline assigned booking |
| `GET` | `/api/doctor/reminders` | Live doctor-scoped upcoming reminders |
| `PATCH` | `/api/doctor/bookings/:id/notes` | Update doctor booking notes |
| `PATCH` | `/api/doctor/bookings/:id/clinical-status` | Update doctor-side clinical status |
| `PATCH` | `/api/doctor/bookings/:id/start-consultation` | Move visit to consultation |
| `PATCH` | `/api/doctor/bookings/:id/complete-visit` | Move visit to treatment completed |
| `POST` | `/api/doctor/bookings/:id/request-consent` | Request consent from doctor context |
| `GET` | `/api/doctor/bookings/:id/chart` | Load odontogram/chart |
| `PUT` | `/api/doctor/bookings/:id/chart` | Save odontogram/chart |
| `GET` | `/api/doctor/bookings/:id/visit-timeline` | Load visit timeline |
| `GET` | `/api/doctor/bookings/:id/medical-history` | Load medical history |
| `PUT` | `/api/doctor/bookings/:id/medical-history` | Update medical history |

## Related booking routes

These routes are not lifecycle transitions but use booking IDs as context:

- `/api/booking/:id/notes`
- `/api/booking/:id/notes/history`
- `/api/clinical-records/booking/:bookingId`
- `/api/clinical-records/booking/:bookingId/patient-history`
- `/api/patient-documents/booking/:bookingId`
- `/api/auth/clinic/bills/booking/:bookingId`
- `/api/auth/clinic/billing-audit/booking/:bookingId`

## Mutation contract expectations

Mutation callers should:

1. Send the booking ID in the route.
2. Send only the fields required for that transition.
3. Include a reason for no-show, early exit, or override where required.
4. Treat non-2xx responses as failed transitions.
5. Invalidate/refetch relevant booking queries after success.
6. Display server errors without assuming the client state is still current.

## Footer transition mapping

The footer model describes intent; the parent dashboard performs the mutation
through these contracts:

| Footer intent | Route | Request body |
| --- | --- | --- |
| Confirm | `PATCH /api/auth/clinic/bookings/:id/confirm` | none |
| Mark Arrived / undo check-in | `PATCH /api/auth/clinic/bookings/:id/checkin` | `{ undo?: boolean }` |
| Reschedule | `PATCH /api/auth/clinic/bookings/:id/reschedule` | `{ newSlotId: number }` |
| Complete visit | `PATCH /api/auth/clinic/bookings/:id/complete-visit` | `{ note?: string }` |
| Mark no-show | `PATCH /api/auth/clinic/bookings/:id/no-show` | `{ reason?: string }` |
| Batch no-show | `POST /api/auth/clinic/bookings/mark-no-show-batch` | `{ bookingIds: number[] }` |
| Revert batch no-show | `PATCH /api/auth/clinic/bookings/:id/revert-no-show` | none |
| Override complete | `PATCH /api/auth/clinic/bookings/:id/override-complete` | `{ reason: string }` |
| Patient left early | `PATCH /api/auth/clinic/bookings/:id/patient-left-early` | `{ reason: string }` |
| Doctor complete treatment | `PATCH /api/doctor/bookings/:id/complete-visit` | none |

`Resolve Booking` is a presentation intent that opens the clinic Actions tab;
it is not a new server route. The Actions tab selects the permitted transition
after the server rechecks the current booking state. `Open Billing` similarly
opens the billing workflow and is valid for creating the first bill.

The client must not invoke `override-complete` for `patient_left_early`.
Terminal records remain subject to the server's restoration rules.

## Persistence helpers

The storage layer exposes methods for:

- Creating and retrieving bookings
- Updating confirmation/assignment
- Updating doctor approval
- Rescheduling
- Updating visit status and timestamps
- Fetching filtered booking pages and statistics
- Finding no-show candidates
- Batch no-show and restoration
- Booking notes and related records.

When adding a new transition, update the shared status policy, server
validation, storage method, parent dashboard mutation, and this route
reference together.