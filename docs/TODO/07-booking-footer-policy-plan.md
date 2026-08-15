# Booking Footer Policy — Phase Plan and Progress

**Scope:** Clinic/admin and doctor appointment-card footer actions  
**Source recommendation:** `attached_assets/Pasted-Analysis-Past-should-not-determine-one-universal-footer_1786728086567.txt`  
**Status:** Phases 1–5 complete; Phase 6 in progress — automated coverage is complete, browser-level visual verification remains
**Last updated:** 2026-08-15

## Overall progress

There are six planned implementation phases. Phases 1–5 are complete after
adding the pure policy model, migrating the shared card, aligning the clinic
and doctor detail experiences, and reconciling server transition semantics.
Phase 6 now has the full role/lifecycle matrix under automated test and the
responsive footer layout implemented; only browser-level card/dialog inspection
is still outstanding.

```text
Progress: 5 of 6 phases complete — 83%
[█████████████░░░]
```

### Status legend

- `[x]` Complete and verified
- `[~]` In progress
- `[ ]` Not started
- `Decision needed` Product or policy choice required before implementation

## Phase tracker

| Phase | Status | Result |
|---|---|---|
| 1. Define shared footer presentation policy | [x] Complete | Pure role/lifecycle model added and tested |
| 2. Migrate the shared `AppointmentCard` | [x] Complete | Clinic and doctor card footers consume the shared model |
| 3. Align the clinic detail-dialog footer | [x] Complete | Card and opened booking dialog consume the same action policy |
| 4. Align the doctor detail/modal experience | [x] Complete and verified | Historical doctor visits receive explicit review actions |
| 5. Reconcile server transition semantics | [x] Complete | Server-side ownership, transition guards, atomic writes, reschedule invariants, and lifecycle audit records added |
| 6. Complete regression coverage and documentation | [~] In progress | Automated lifecycle matrix and responsive footer structure complete; browser-level card/dialog inspection remains |

## Phase 1 — Define the presentation policy

### What changed

Added:

- `client/src/lib/appointment-footer-model.ts`
- `client/src/lib/appointment-footer-model.test.ts`

The new model:

- Consumes the existing `BookingClassification`.
- Separates clinic and doctor footer policy.
- Returns one primary action and zero or more secondary actions.
- Includes optional target-tab metadata.
- Includes a `readOnly` flag for historical doctor records.
- Uses bill counts to distinguish payment actions.
- Prevents Rebook from replacing active or treatment-completed workflows.
- Does not perform mutations, navigation, authorization, or billing operations.

### Reconciled policy decisions

The following decisions are now fixed for the next implementation phases:

1. Same-day past-due bookings expose **Resolve Booking** only by default.
2. Old active clinic visits use **Manage Visit** and open the Actions tab.
3. Terminal records show billing when bills exist; batch-admin no-shows may also
   expose Revert No-Show.
4. `patient_left_early` is terminal and is not eligible for administrative
   completion override.
5. **Review Visit** and **Review Appointment** are distinct labels with the
   same overview target for now.
6. Doctor **Done** remains the primary in-consultation action.
7. Unknown-date bookings have an explicit `unknown_date` policy state and
   resolve through the Actions tab.
8. Active and treatment-completed clinic visits retain an Open Billing action
   even when no bill exists yet.
9. Doctor-declined assignments are explicit read-only Review Visit states.

### Current Phase 1 policy output

#### Clinic/admin

| Classified state | Primary | Secondary |
|---|---|---|
| Future pending | Confirm | Cancel |
| Future confirmed | Mark Arrived | Remind |
| Same-day past due | Resolve Booking | Only actions explicitly eligible by classifier |
| Old unresolved | Resolve Booking | Rebook |
| Unknown date | Resolve Booking | — |
| Old active | Manage Visit | Open Billing |
| Treatment completed | Mark Visit Done | Open Billing |
| Completed with unpaid bills | Settle Payment | Rebook |
| Completed with paid bills | View Invoice | Rebook |
| Completed with no bill | Review Visit | Rebook |
| Terminal | Rebook when eligible | Revert no-show and/or View Billing when eligible |

#### Doctor

| Classified state | Primary | Secondary |
|---|---|---|
| Awaiting approval | Accept | Decline |
| Checked in | Start Consultation | Add Observation |
| In consultation | Done | Add Observation, Notes, View/Edit Rx |
| Treatment completed | View/Edit Rx | — |
| Completed | Review Visit | — |
| Old unresolved | Review Visit | — |
| Doctor declined | Review Visit | — |
| Terminal | Review Visit | — |
| Other non-terminal records | Review Appointment | — |

## Important boundaries

The following areas remain outside the completed Phases 1–5 and are reserved
for Phase 6:

- Full doctor detail/modal parity beyond footer target routing.
- Full lifecycle regression and responsive test matrix.

The footer model remains presentation-only; parent mutations and server
validation remain authoritative. The server transition and authorization audit
is documented in Phase 5 above.

## Phase 2 — Migrate the shared `AppointmentCard`

### What changed

The shared appointment card now derives its visible footer from:

```text
classifyClientBooking()
  → getAppointmentFooterModel()
  → action-specific callback or existing reason dialog
```

The migration:

- Uses the same clinic and doctor policy model for primary and secondary actions.
- Routes administrative actions to the existing Actions tab callback.
- Keeps Billing available for active and treatment-completed clinic visits even
  when no bill exists.
- Preserves the existing cancel, unpaid-bill, and visit-completion reason dialogs.
- Preserves existing loading states and mutation callbacks.
- Keeps the clinic overflow menu separate for no-show, early-exit, override, and
  other administrative controls.
- Makes historical and doctor-declined records review-only according to policy.

## Phase 3 — Align the clinic detail-dialog footer

### What changed

The persistent footer in the opened clinic booking dialog now uses the same
`getAppointmentFooterModel()` result as the card. Its action targets are mapped
as follows:

- `actions` opens the Actions tab.
- `billing` opens the existing Billing workflow.
- `overview` returns to the booking overview.
- `rebook` preserves the existing rebook form/session handoff.

The existing cancellation dialog and server mutations remain in place. The
dialog no longer independently chooses between Resolve Booking, Manage Visit,
Rebook, billing, and final-closure actions.

### Doctor target routing

The doctor dashboard now keeps the footer targets distinct:

- Clinical records/observations open the Diagnosis/records context.
- Notes open the Notes tab.
- View/Edit Rx and Issue Rx open the Prescription tab.
- Review actions open the Overview tab.

## Phase 4 — Align the doctor detail/modal experience

### What changed

The doctor detail modal now derives its historical review action from the same
doctor footer model used by `AppointmentCard`.

- Completed, terminal, doctor-declined, old unresolved, same-day past-due, and
  unknown-date records expose an explicit read-only **Review Visit** action.
- Other non-terminal review states expose **Review Appointment**.
- Review actions route to the modal Overview tab instead of silently opening
  Notes or showing only a terminal status message.
- Treatment-completed records keep their clinical history controls, and
  **View / Edit Rx** now opens the Prescription tab.
- Active approval and consultation controls remain unchanged.
- No server transition, authorization, or mutation behavior was changed.

## Phase 5 — Reconcile server transition semantics

### What changed

Added:

- `server/booking-transition-policy.ts`
- `server/booking-transition-policy.test.ts`

The server now re-checks lifecycle meaning immediately before protected
mutations instead of trusting footer visibility. The policy enforces:

- Clinic ownership for clinic booking mutations, with an explicit superuser
  exception.
- Terminal protection for `cancelled`, `no_show`, and `patient_left_early`.
- Confirming only current, not-started, date-known bookings.
- Check-in only for confirmed, not-started bookings; check-out only reverses a
  checked-in visit.
- Closing only active or treatment-completed visits.
- Manual no-show only for confirmed, past, not-started bookings, with a reason.
- Override completion only for unresolved old/past-due/unknown-date records,
  with a reason; treatment-completed and early-exit records cannot be reopened.
- Patient-left-early only for active visits, with a reason.
- Doctor consultation sequencing: checked-in → in-consultation →
  treatment-completed.
- Doctor approval actions only for current, non-terminal, non-old pending
  assignments.

### Atomic mutation and slot safeguards

Transition-specific storage methods now use expected-current-state predicates so
stale or racing requests fail with a conflict instead of overwriting a newer
state. This covers:

- visit status changes;
- confirmation;
- cancellation;
- manual no-show;
- doctor approval/decline;
- rescheduling.

Rescheduling now also checks that the target slot belongs to the same clinic,
is not cancelled, and has capacity. Cancellation releases the slot in the same
transaction as the booking update.

### Audit behavior

Protected lifecycle transitions now write a normalized `booking_state_log`
record with the previous state, target state, actor role/name, and reason where
applicable. Batch no-show reversal is also recorded distinctly from manual
no-show.

Invalid lifecycle requests return explicit `4xx` responses:

- `403` for ownership or role violations;
- `404` for missing bookings;
- `409` for invalid current-state or race conflicts;
- `400` for missing transition input such as a required reason.

### Phase 5 boundaries

The following are intentionally unchanged:

- Existing legacy, non-transition storage methods used by unrelated flows.
- The presentation-only client classifier and footer model.
- The broader lifecycle regression matrix and responsive verification, which
  remain Phase 6.

## Verification record

### Phase 1 checks

- [x] Model is pure and has no API, mutation, navigation, or DOM dependency.
- [x] Old unresolved clinic bookings resolve before rebooking.
- [x] Active/treatment-completed bookings cannot be reduced to Rebook.
- [x] Completed clinic billing states are represented separately.
- [x] Historical doctor records are review-only.
- [x] Doctor-declined assignments are explicit read-only reviews.
- [x] Unknown-date resolution is represented separately from same-day past due.
- [x] Active/treatment-completed billing remains reachable when no bill exists.
- [x] Unit tests cover old, active, completed, terminal, approval, and clinical states.

### Phase 2–4 checks

- [x] `AppointmentCard` consumes `getAppointmentFooterModel()`.
- [x] Clinic detail-dialog footer consumes the same model.
- [x] Card and dialog action targets route to the existing parent workflows.
- [x] Doctor Notes, Clinical Records, Prescription, and Overview targets are
  routed separately.
- [x] Doctor detail modal historical review actions consume the shared doctor
  footer model.
- [x] Existing reason prompts, loading states, and mutation callbacks remain in
  place.
- [x] Shared footer model tests pass.

### Phase 5 checks

- [x] Server transition policy tests pass.
- [x] Clinic transition routes enforce booking ownership.
- [x] Terminal, old-booking, active-visit, and doctor-sequencing checks are
  server-authoritative.
- [x] Protected writes use expected-current-state checks.
- [x] Rescheduling validates clinic ownership, target availability, and
  capacity.
- [x] Cancellation releases the slot transactionally.
- [x] Lifecycle transition audit records include actor and state direction.
- [x] TypeScript check passes.
- [x] Production build / Build Check passes.
- [x] Application workflow restarts and serves successfully.

### Phase 6 checks remaining

- [ ] Manual lifecycle matrix verification in both card and dialog.
- [ ] Narrow responsive footer preview verification.
- [ ] Final documentation sign-off after browser-level verification.

### Phase 6 implementation completed

- Added `client/src/lib/appointment-footer-model.matrix.test.ts`.
- Added explicit clinic and doctor coverage for every documented footer policy
  row, including approval, active consultation, treatment completion, billing
  states, historical records, terminal records, unknown dates, and declined
  assignments.
- Updated the shared clinic appointment-card footer so the primary action is
  always full width and secondary actions wrap in their own responsive row.
- Updated the clinic detail-dialog footer with the same primary/secondary
  responsive structure and content-wrapping button heights.

### Phase 6 verification note

The automated matrix, focused policy tests, TypeScript check, and production
build all pass. A Playwright browser run was attempted, but the workspace
Chromium runtime is missing a remaining native `libgbm`/`libudev` dependency;
the app preview itself renders successfully, but an authenticated appointment
card/dialog screenshot could not be completed in this environment. The manual
visual checklist therefore remains open rather than being marked as passed.

### Planned checks

- [x] Run the shared model tests and Build Check successfully.
- [x] Migrate `AppointmentCard` and verify card-level callback wiring.
- [x] Make the detail dialog consume the same footer model.
- [ ] Verify card/detail-dialog parity for every matrix row manually.
- [x] Add automated role/lifecycle matrix coverage for clinic and doctor footer actions.
- [x] Implement full-width primary and wrapping secondary footer layout for card and dialog.
- [ ] Verify mobile footer wrapping at narrow card widths in a browser preview.
- [x] Verify server authorization and transition behavior with focused policy
  tests and compare-and-set writes.
- [x] Run the automated full lifecycle footer matrix.

## Completion criteria for the overall project

This plan is complete only when:

- Cards and detail dialogs use the same footer model.
- Clinic and doctor roles cannot see each other’s mutation workflows.
- Old unresolved bookings preserve an explicit resolution path.
- Rebook never replaces active visit management.
- Billing buttons reflect actual bill/payment state.
- Server-side authorization remains authoritative.
- The full lifecycle matrix is covered by automated tests.