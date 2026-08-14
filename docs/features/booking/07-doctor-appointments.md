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

## Server boundary

Doctor routes verify the authenticated doctor and the booking's assignment
before approving, declining, starting consultation, completing treatment, or
editing doctor-owned clinical information.