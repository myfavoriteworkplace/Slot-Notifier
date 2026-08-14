# Booking Footer Policy — Phase Plan and Progress

**Scope:** Clinic/admin and doctor appointment-card footer actions  
**Source recommendation:** `attached_assets/Pasted-Analysis-Past-should-not-determine-one-universal-footer_1786728086567.txt`  
**Status:** Phases 1–4 complete; Phases 5–6 remain
**Last updated:** 2026-08-15

## Overall progress

There are six planned implementation phases. Phases 1–3 are complete after
adding the pure policy model, migrating the shared card, and aligning the
clinic detail-dialog footer.

```text
Progress: 4 of 6 phases complete — 67%
[██████████░░░░░░]
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
| 5. Reconcile server transition semantics | [ ] Not started | No-show, override, terminal, reschedule, and authorization rules audited together |
| 6. Complete regression coverage and documentation | [ ] Not started | Full lifecycle matrix, responsive checks, and final docs |

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

The following areas remain outside this milestone:

- Full doctor detail/modal parity beyond footer target routing.
- Server transition-semantic audit.
- Full lifecycle regression and responsive test matrix.

The server routes and authorization boundaries were intentionally not changed.
The footer model remains presentation-only; parent mutations and server
validation remain authoritative.

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
- [x] TypeScript check passes.
- [x] Production build / Build Check passes.
- [x] Application workflow restarts and serves successfully.
- [ ] Manual lifecycle matrix verification in both card and dialog.
- [ ] Narrow responsive footer preview verification.

### Planned checks

- [x] Run the shared model tests and Build Check successfully.
- [x] Migrate `AppointmentCard` and verify card-level callback wiring.
- [x] Make the detail dialog consume the same footer model.
- [ ] Verify card/detail-dialog parity for every matrix row manually.
- [ ] Verify mobile footer wrapping at narrow card widths.
- [ ] Verify server authorization and transition behavior.
- [ ] Run the full lifecycle regression matrix.

## Completion criteria for the overall project

This plan is complete only when:

- Cards and detail dialogs use the same footer model.
- Clinic and doctor roles cannot see each other’s mutation workflows.
- Old unresolved bookings preserve an explicit resolution path.
- Rebook never replaces active visit management.
- Billing buttons reflect actual bill/payment state.
- Server-side authorization remains authoritative.
- The full lifecycle matrix is covered by automated tests.