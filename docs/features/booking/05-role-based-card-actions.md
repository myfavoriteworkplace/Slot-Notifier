# Role-Based Appointment Card Actions

## Shared component, different policies

Clinic administrators and doctors use the same `AppointmentCard`, but they do
not receive the same callbacks or action policy. The card's `role` prop and
the callbacks supplied by the parent dashboard determine the visible workflow.

The client policy has two layers:

1. `classifyBooking()` in `shared/booking-status.ts` normalizes lifecycle,
   timing, terminal precedence, and low-level eligibility.
2. `getAppointmentFooterModel()` in
   `client/src/lib/appointment-footer-model.ts` converts that classification
   into one primary action, secondary actions, target-tab metadata, and
   read-only intent.

`getBookingActionState()` remains a compatibility helper for boolean clinic
action checks; it is not the canonical footer policy. The server validates
every mutation again.

## Clinic/admin workflow

Clinic actions are wired in `BookingsPanel.tsx`.

| Situation | Footer policy and typical clinic actions |
| --- | --- |
| Future pending | **Confirm**; Cancel is secondary. |
| Future confirmed | **Mark Arrived**; Remind is secondary when eligible. |
| Same-day past due | **Review Booking** → Actions; do not offer Rebook by default. |
| Old unresolved | **Review Booking** → Actions; Rebook is secondary. |
| Old active | **Manage Visit** → Actions; billing remains reachable. |
| Treatment completed | **Mark Visit Done**; Open Billing remains reachable even when the first bill has not been created. |
| Completed | Settle Payment, View Invoice, or Review Visit according to bill state; Rebook is secondary. |
| Cancelled/no-show/early exit | Rebook when eligible; show billing when bills exist; allow Revert No-Show only for eligible batch-admin no-shows. |

The clinic overflow menu contains actions whose dialogs need reasons or
confirmation, including no-show, early exit, override completion, and visit
closure.

Historical past bookings intentionally use a muted grey border and accent bar so
staff can distinguish archived records from active operational work. The footer
and overflow actions remain available only when the record is still actionable;
read-only historical cards do not regain active operational buttons just because
there are bills or notes attached.

### Clinic-specific rules

- Marking a patient left early requires a reason.
- Override completion requires a reason.
- Visit completion may record `visitCompletionNote`.
- The doctor completes treatment to `treatment_completed`; clinic final closure
  moves it to `completed`. These are separate transitions.
- `Review Booking` is the explicit administrative path for old, same-day
  past-due, and unknown-date records. It must not silently become Rebook.
- Billing is an entry point for active and treatment-completed visits even when
  no bill exists yet; completed records use bill/payment state to choose the
  billing action.
- Unpaid bills are warnings, not an automatic replacement for visit state.
- Assigning a doctor can leave the booking awaiting doctor approval.
- Clinic cancellation and no-show routes are separate transitions.

## Doctor workflow

Doctor actions are wired in `DoctorDashboard.tsx`.

| Situation | Footer policy and typical doctor actions |
| --- | --- |
| Assigned and awaiting approval | Approve or decline |
| Doctor declined | Review Visit, read-only |
| Approved/upcoming | Review appointment and patient context |
| Checked in | Start consultation |
| In consultation | Update clinical status and clinical records |
| Treatment completed | View/Edit Rx; the clinic still performs final closure |
| Old unresolved | Review Visit, read-only |
| Completed/history | Review Visit, read-only |
| Cancelled/no-show/early exit | Review Visit, read-only |

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

The footer model's `target` metadata is interpreted by the parent. For example,
`actions` opens the administrative Actions tab, `billing` opens billing,
`overview` opens the review overview, and `prescription` opens the doctor
prescription tab. Callbacks should remain thin: they should call parent
mutations rather than implementing API requests inside `AppointmentCard`.

## Authorization reminder

The card may hide an action because the client classifier says it is not
available. This is not security enforcement. The server route must still
verify:

- Authenticated session
- Clinic or doctor ownership
- Current booking state
- Valid transition
- Required reason/body fields.