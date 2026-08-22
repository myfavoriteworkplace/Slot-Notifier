# Booking Data Model

## Core relationship

```text
clinic ──< slots ──< bookings ──> patient
                         │
                         ├── booking notes
                         ├── clinical records
                         ├── patient bills
                         ├── consent token/signature
                         ├── patient documents
                         └── visit timeline/history
```

The booking is the appointment/visit boundary. Patient identity and long-term
history may span many bookings.

## `slots`

Defined in `shared/schema.ts`, a slot contains:

- `id`
- `ownerId`
- `startTime`
- `endTime`
- `isBooked`
- `clinicName`
- `clinicId`
- `maxBookings`
- `isCancelled`

`maxBookings` is the slot capacity. A slot can therefore have multiple
bookings until its effective capacity is reached.

## `bookings`

The `bookings` table contains:

### Identity and slot linkage

- `id`: stable booking reference.
- `slotId`: required slot relationship.
- `customerId`: optional authenticated user relationship.
- `patientId`: optional patient profile relationship.

### Patient snapshot

- `customerName`
- `customerPhone`
- `customerEmail`
- `customerAge`
- `customerGender`

The snapshot allows the booking to retain the submitted appointment details
even when a patient profile is later changed.

### Confirmation and assignment

- `verificationStatus`
- `verificationCode`
- `verificationExpiresAt`
- `confirmedBy`
- `assignedDoctor`
- `assignedDoctorEmail`
- `doctorApprovalStatus`

The database columns use snake_case equivalents such as
`verification_status` and `doctor_approval_status`.

### Visit and clinical fields

- `clinicalStatus`
- `visitStatus`
- `doctorNotes`
- `checkedInAt`
- `completedAt`
- `visitCompletionNote`

Clinical status describes the case. Visit status describes where the patient
is in the operational visit lifecycle.

### Payment and consent

- `paymentStatus`
- `paymentAmount`
- `razorpayOrderId`
- `razorpayPaymentId`
- `consentToken`
- `consentSignature`
- `consentSignedAt`
- `consentIp`

Payment and consent are related booking information, not replacements for
confirmation or visit status.

### Terminal and booking metadata

- `cancellationReason`
- `noShowSource`
- `noShowMarkedAt`
- `noShowPreviousStatus`
- `noShowPreviousConfirmedBy`
- `slotCost`
- `visitType`
- `treatmentCategory`
- `bookedBy`
- `patientVisitClassification`: nullable booking-time snapshot for new patient
  or clinic-admin bookings; values are `first_visit` or `existing_patient`.
- `createdAt`

No-show restoration fields preserve enough information for a permitted
revert operation.

## Related records

### Booking notes

`booking_notes` stores shared conversation notes with author type, author name,
content, and creation time.

### Clinical records

Clinical records store diagnoses, prescription information, notes, and related
clinical material. They can be read for the current booking and patient
history.

### Patient bills

Bills are attached to a booking and can remain unpaid after a visit is marked
completed. The appointment card uses bill counts to explain that state.

### Consent

Consent tokens are booking-scoped and may be sent by clinic or doctor flows.
The signed timestamp indicates completion; the existence of a token indicates
that a link was generated or sent, not that consent was signed.

### Documents, medical history, and timeline

These features use the booking as the visit context while exposing
patient-level history where appropriate. See
[Booking detail records](10-booking-detail-tabs-and-related-records.md).

## Field ownership rules

- The client may display fields and request transitions.
- The server validates role, clinic/doctor ownership, and current state.
- `shared/booking-status.ts` normalizes raw values before UI policy is
  calculated.
- Historical records should not be rewritten to represent a new booking.
- A new appointment should create a new booking linked to the same patient.
- `patientVisitClassification` is assigned by the server after patient linkage
  and is not backfilled for historical bookings. The display prefix comes
  from `bookedBy`.