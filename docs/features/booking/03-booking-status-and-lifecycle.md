# Booking Status and Lifecycle Policy

## Status tracks are independent

BookMySlot does not use one generic booking `status` field. It uses separate
tracks:

1. Confirmation: `verificationStatus`
2. Doctor assignment/approval: `doctorApprovalStatus`
3. Visit lifecycle: `visitStatus`
4. Clinical classification: `clinicalStatus`
5. Payment: `paymentStatus`

The canonical vocabulary and classifier are implemented in
`shared/booking-status.ts`.

## Confirmation status

Canonical values:

| Value | Meaning |
| --- | --- |
| `pending` | Booking is awaiting confirmation |
| `confirmed` | Booking is confirmed |
| `cancelled` | Booking is cancelled and terminal |
| `no_show` | Patient did not attend and the booking is terminal |

The code also recognizes legacy values such as `email_verified`,
`admin_booked`, and older `verified` data in compatibility paths. These should
not be documented as the preferred new workflow.

`confirmedBy` records whether confirmation was made by a clinic/admin or
doctor-side path. A populated `confirmedBy` also contributes to the
classifier's confirmed interpretation.

## Doctor approval status

| Value | Meaning |
| --- | --- |
| `unassigned` | No doctor approval workflow is active |
| `pending` | Doctor has been assigned and must respond |
| `approved` | Assigned doctor accepted |
| `declined` | Assigned doctor declined |
| `admin_confirmed` | Clinic confirmed the assignment administratively |

Doctor approval does not itself mean that the patient has arrived or that the
visit has started.

## Visit status

| Value | Meaning |
| --- | --- |
| `not_started` | No visit stage has begun; null/empty values normalize here |
| `checked_in` | Patient arrived and is waiting/ready |
| `in_consultation` | Doctor is actively consulting |
| `treatment_completed` | Doctor completed treatment; clinic may still need to close |
| `completed` | Visit is closed |
| `patient_left_early` | Patient left before normal completion; terminal |

The normal active path is:

```text
not_started → checked_in → in_consultation
             → treatment_completed → completed
```

## Clinical status

Clinical status is case metadata, not a lifecycle state. Current dashboard
values include:

- `first_visit`
- `revisit`
- `follow_up_required`
- `case_closed`

It can change independently of confirmation and visit progress.

## Payment status

Payment status is also independent. A completed visit may have:

- no bill,
- an unpaid bill,
- a partially paid bill, or
- a paid bill.

The card and progress strip communicate these conditions but do not redefine
the visit lifecycle.

## Classifier precedence

`classifyBooking()` produces normalized lifecycle and operational state from
the separate fields plus the booking's slot time and clinic timezone.

Terminal confirmation and early-exit states take precedence over active visit
states. If an inconsistent record says both terminal and active, normal
consultation actions are suppressed.

Important derived states include:

- `awaiting_doctor_approval`
- `today_upcoming`
- `same_day_past_due`
- `old_needs_resolution`
- `old_active`
- `old_treatment_completed`
- `historical_completed`
- `cancelled`
- `no_show`
- `early_exit`

Date classification uses the clinic's IANA timezone, defaulting to
`Asia/Kolkata` for missing or invalid legacy values.

## Action policy

The classifier exposes action policy for the UI. Examples:

- Clinic roles can confirm, cancel, check in, mark no-show, assign doctors,
  request consent, and reschedule when the booking is progressable.
- Doctors can approve or decline an awaiting assignment.
- Doctors can continue active visits and update clinical status.
- Clinic roles can use an override for unresolved old, past-due, or
  date-unknown bookings.
- Completed and terminal bookings can be rebooked and viewed historically.

The action policy is a presentation aid. Server routes must re-check the
current state and authorization.

## Progress strip mapping

`BookingProgressStrip` renders the compact visual sequence:

```text
Booked → Confirmed → Arrived → In Tmt. → Visit Done
```

`in_consultation` and `treatment_completed` both map to the in-treatment
stage. `completed` maps to Visit Done. Terminal states retain the stages
reached before cancellation, no-show, or early exit.

Tooltips can explain confirmation actor, terminal reason, completion note,
unpaid billing, missing invoice, and override completion.

## Status rules

- A booking cannot be safely treated as confirmed merely because an email was
  verified.
- A doctor assignment can exist while approval is pending.
- A clinical status change does not complete a visit.
- A paid bill does not automatically confirm a booking.
- A completed visit does not imply that a bill exists.
- A no-show can only be reverted through the server's permitted restoration
  path.
- The server, not the card, is the final authorization boundary.