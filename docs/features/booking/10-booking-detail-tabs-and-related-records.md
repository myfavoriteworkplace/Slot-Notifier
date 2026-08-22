# Booking Detail Tabs and Related Records

## Detail view purpose

Opening an appointment card provides a booking-focused detail view. The
clinic and doctor views expose different tabs, but both use the booking ID as
the visit context.

## Clinic tabs

The clinic booking dialog supports:

- **Overview**: booking identity, appointment time, patient, doctor,
  consent, clinical status, and lifecycle.
- **Clinical**: clinical information and related records.
- **Documents**: patient/visit documents.
- **Notes**: shared booking note thread.
- **Actions**: administrative actions such as assignment or state changes.
- **Billing**: bills, payment status, receipts, and billing history.

## Doctor tabs

Doctor detail content can include:

- Overview
- Notes
- Diagnosis
- Prescription
- Chart/odontogram
- Medical history
- Documents
- Visit timeline

The exact tab selection can be driven by a notification type. Notes and
clinical context should open for the referenced booking rather than only for
the patient generally.

## Booking notes

Booking notes are shared conversation records with:

- Booking ID
- Author type
- Author name
- Content
- Creation time

The notes thread is distinct from structured clinical records and from
doctor-specific notes stored on the booking.

## Clinical records

Clinical records may contain diagnoses, prescription information, and notes.
The clinic billing flow can use current clinical record information as a
starting point when preparing a bill, but billing remains a separate record.

## Patient documents

Patient documents are booking/visit-scoped uploads. Storage ownership and
private paths are derived on the server from the booking, clinic, and patient;
the browser does not choose the final private storage key.

## Visit timeline and medical history

The visit timeline places the current booking alongside previous visits. The
medical history tab provides the patient's longer-running clinical history.
Both use booking IDs to establish authorization and current visit context.

## Consent

Consent state is displayed on the card and in detail views:

- No token/signature: not yet signed/sent
- Token present: consent link sent/generated
- Signature timestamp present: signed

Consent is independent from confirmation and visit completion.

## Billing

Bills are attached to the booking and can include:

- Services
- Subtotal
- Discount
- Tax
- Total
- Payment method
- Payment status
- Notes

Completing a visit does not automatically imply that billing is paid. The
card's progress tooltip and billing tab communicate unresolved billing.

## Deep linking

Notification navigation carries both a booking ID and a target type/tab when
possible. Clinic dashboards can fetch a focus booking even when it is outside
the current filter. Doctor dashboards open the patient/booking detail view
from notification context.