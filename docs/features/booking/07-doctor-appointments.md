# Doctor Appointments

## Responsibility

Doctor appointment management lives in:

```text
client/src/pages/DoctorDashboard.tsx
```

The page fetches appointment data and renders the shared
`AppointmentCard` with `role="doctor"`.

## Loading and filtering

The doctor dashboard uses the authenticated booking endpoint with filters for:

- Today
- Upcoming
- Owned/assigned appointments
- Awaiting approval
- Pending and confirmed windows
- This week and next week
- Date range
- Clinic
- Status
- Patient.

Queries are enabled for the appointments tab and use infinite pagination.

## Doctor-specific lifecycle

1. The clinic assigns a doctor.
2. The booking appears as awaiting approval when approval is required.
3. The doctor approves or declines.
4. For an approved appointment, the doctor reviews patient and clinic context.
5. After check-in, the doctor starts consultation.
6. The doctor records clinical work and can update clinical status.
7. The doctor completes the treatment stage.
8. The clinic may perform the final visit closure.

The doctor dashboard may show completed or historical visits for context, but
does not become the clinic's administrative booking authority.

### Historical and declined behaviour

The doctor footer is read-only for:

- Doctor-declined assignments
- Old unresolved records
- Completed records
- Cancelled records
- No-show records
- Patient-left-early records

These records use **Review Visit** and open the overview/review context. They do
not expose clinic-owned no-show, reschedule, reassignment, or administrative
override actions. A `treatment_completed` visit is different: the doctor may
still use **View/Edit Rx**, while the clinic owns final closure to
`completed`.

## Doctor card behaviour

The shared card provides:

- Appointment and clinic information
- Patient identity and history number
- Approval actions
- Start consultation
- Doctor completion
- Notes and records entry points
- Consent request
- Progress strip

During consultation, **Done** remains the primary doctor action. Observation,
Notes, and Prescription remain compact clinical controls rather than becoming
equal-width administrative buttons. The prescription control must target the
Prescription tab, not only the general records view.

Clinic-only controls such as assignment, no-show management, rescheduling, and
administrative override are not supplied by the doctor parent.

## Patient detail and records

The doctor detail view can expose:

- Overview
- Notes
- Diagnosis
- Prescription
- Chart/odontogram
- Medical history
- Documents
- Visit timeline

Notification deep links map event types to the appropriate appointment or
notes view. A booking ID is required to open the correct patient visit.

### Patient detail dialog sizing

The doctor patient detail dialog follows the same responsive sizing contract as
the clinic dialog:

- On tablet and desktop widths, normal mode uses approximately `60vw × 60vh`,
  leaving about 20% of the screen around the centered dialog.
- The existing maximize/minimize control remains available for wider review
  layouts.
- On small screens, the dialog preserves a near-full-screen width and a
  viewport-safe maximum height.

The tab content area scrolls within the dialog as needed. This is a visual
layout rule only; it does not alter doctor permissions, booking lifecycle, or
clinical record behavior.

### Overview patient-card layout

The doctor's Overview patient information card follows the same responsive
layout contract as the clinic dialog:

- One column on narrow screens and two columns from the small-screen
  breakpoint upward.
- Complaints, clinical status, and confirmed-by remain full-width rows.
- Phone value and copy/call controls are grouped together so the controls do
  not become implicit grid rows at narrow widths.
- Consent actions wrap as a group when space is limited.
- Visit-type, treatment, and clinical-status pills remain intrinsic-width with
  `max-width` constraints and natural wrapping for long values.
- Simple rows align icon, label, and value centrally; complaints and other
  multi-line content align from the top.

The shared `AppointmentCard` remains the list-level representation. These rules
describe the separate patient detail dialog rendered by
`DoctorDashboard.tsx`.

## Server boundary

Doctor routes verify the authenticated doctor and the booking's assignment
before approving, declining, starting consultation, completing treatment, or
editing doctor-owned clinical information.