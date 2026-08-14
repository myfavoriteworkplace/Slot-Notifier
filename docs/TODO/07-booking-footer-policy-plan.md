# Booking Footer Policy — Phase Plan and Progress

**Scope:** Clinic/admin and doctor appointment-card footer actions  
**Source recommendation:** `attached_assets/Pasted-Analysis-Past-should-not-determine-one-universal-footer_1786728086567.txt`  
**Status:** Phase 1 complete; later phases intentionally not started  
**Last updated:** 2026-08-14

## Overall progress

There are six planned implementation phases. Phase 1 is complete after adding
the pure presentation model and its unit coverage.

```text
Progress: 1 of 6 phases complete — 17%
[███░░░░░░░░░░░░░]
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
| 2. Migrate the shared `AppointmentCard` | [ ] Not started | Visible clinic and doctor card footers will consume the model |
| 3. Align the clinic detail-dialog footer | [ ] Not started | Card and opened booking dialog will use the same action policy |
| 4. Align the doctor detail/modal experience | [ ] Not started | Historical doctor visits will receive explicit review actions |
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

### Current Phase 1 policy output

#### Clinic/admin

| Classified state | Primary | Secondary |
|---|---|---|
| Future pending | Confirm | Cancel |
| Future confirmed | Mark Arrived | Remind |
| Same-day past due | Resolve Booking | Only actions explicitly eligible by classifier |
| Old unresolved | Resolve Booking | Rebook |
| Old active | Manage Visit | View Billing when bills exist |
| Treatment completed | Mark Visit Done | View Billing when bills exist |
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
| Terminal | Review Visit | — |
| Other non-terminal records | Review Appointment | — |

## Important boundaries

Phase 1 does **not** change what users see yet. The following files remain
behaviorally unchanged until later phases:

- `client/src/components/AppointmentCard.tsx`
- `client/src/components/BookingsPanel.tsx`
- `client/src/pages/DoctorDashboard.tsx`
- `server/routes.ts`

This is intentional. The model is being tested before it becomes the source of
visible UI behavior.

## Decisions still needed before Phase 2

These choices affect user-visible behavior and should be confirmed before the
card migration:

1. Whether same-day past-due bookings should also show Rebook as a secondary
   action. The current classifier does not mark them `canRebook`, so Phase 1
   conservatively exposes Resolve Booking only.
2. Whether “Manage Visit” for old active clinic visits should open the Actions
   tab, the Overview tab, or remain represented by the existing card overflow.
3. Whether terminal no-show records should show View Billing when bills exist.
4. Whether `patient_left_early` may ever be changed through an administrative
   completion override.
5. Whether “Review Visit” and “Review Appointment” should use distinct visual
   labels only, or distinct detail-dialog tabs.
6. Whether the doctor’s “Done” action should remain the primary in-consultation
   action, or whether Add Observation should be primary in the next UI pass.

## Verification record

### Phase 1 checks

- [x] Model is pure and has no API, mutation, navigation, or DOM dependency.
- [x] Old unresolved clinic bookings resolve before rebooking.
- [x] Active/treatment-completed bookings cannot be reduced to Rebook.
- [x] Completed clinic billing states are represented separately.
- [x] Historical doctor records are review-only.
- [x] Unit tests cover old, active, completed, terminal, approval, and clinical states.

### Planned checks

- [ ] Run the shared model tests in the Build Check workflow.
- [ ] Migrate `AppointmentCard` and verify card-level action callbacks.
- [ ] Verify card/detail-dialog parity for every matrix row.
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