# Role-Based Appointment Card Actions

## Shared component, different policies

Clinic administrators and doctors use the same `AppointmentCard`, but they do
not receive the same callbacks or action policy. The card's `role` prop and
the callbacks supplied by the parent dashboard determine the visible workflow.

The client policy is calculated by `classifyBooking()` and exposed through
`getBookingActionState()`. The server validates every mutation again.

## Clinic/admin workflow

Clinic actions are wired in `BookingsPanel.tsx`.

| Situation | Typical clinic actions |
| --- | --- |
| Pending | Confirm, cancel, assign doctor, send reminder |
| Confirmed/not started | Check in, reschedule, cancel, assign/reassign doctor |
| Checked in | Continue visit management, cancel, mark patient left early |
| In consultation | Cancel, mark patient left early, monitor/close workflow |
| Treatment completed | Mark visit done, including completion note |
| Old or past-due unresolved | Mark no-show or use reasoned override completion |
| Completed | View records, billing, documents, history, and rebook |
| Cancelled/no-show/early exit | View history/billing and rebook where allowed |

The clinic overflow menu contains actions whose dialogs need reasons or
confirmation, including no-show, early exit, override completion, and visit
closure.

### Clinic-specific rules

- Marking a patient left early requires a reason.
- Override completion requires a reason.
- Visit completion may record `visitCompletionNote`.
- Unpaid bills are warnings, not an automatic replacement for visit state.
- Assigning a doctor can leave the booking awaiting doctor approval.
- Clinic cancellation and no-show routes are separate transitions.

## Doctor workflow

Doctor actions are wired in `DoctorDashboard.tsx`.

| Situation | Typical doctor actions |
| --- | --- |
| Assigned and awaiting approval | Approve or decline |
| Approved/upcoming | Review appointment and patient context |
| Checked in | Start consultation |
| In consultation | Update clinical status and clinical records |
| Treatment active/completed | Complete the doctor-side treatment workflow |
| Completed/history | Review notes, records, documents, timeline, and history |

Doctors can request consent and open appointment details, but do not receive
the clinic-only no-show, assignment, reschedule, or administrative override
workflow through the shared card.

## Callback boundary

The card exposes callbacks such as:

```tsx
onConfirm
onCancel
onCheckIn
onCompleteVisit
onNoShow
onPatientLeftEarly
onOverrideComplete
onApprove
onDecline
onStartConsultation
onDoctorCompleteVisit
onRequestConsent
```

Callbacks should remain thin. They should call parent mutations rather than
implementing API requests inside `AppointmentCard`.

## Authorization reminder

The card may hide an action because the client classifier says it is not
available. This is not security enforcement. The server route must still
verify:

- Authenticated session
- Clinic or doctor ownership
- Current booking state
- Valid transition
- Required reason/body fields.