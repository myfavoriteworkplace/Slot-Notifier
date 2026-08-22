# Booking Footer Policy — Phase Plan and Progress

**Scope:** Clinic/admin and doctor appointment-card footer actions  
**Source recommendation:** `attached_assets/Pasted-Analysis-Past-should-not-determine-one-universal-footer_1786728086567.txt`  
**Status:** Policy model and server transition safeguards are complete; UI parity audit found unresolved card/popup action inconsistencies. Remediation is planned below.
**Last updated:** 2026-08-16

## Overall progress

The original six phases established the pure policy model, migrated the shared
card, added server transition safeguards, and added automated lifecycle
coverage. A later audit found that the clinic popup still renders legacy
stage-specific footer branches alongside the shared model, so the earlier
"card/dialog aligned" conclusion was too broad. The policy model itself is
usable, but the rendered surfaces still need to be consolidated and verified.

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
| 3. Align the clinic detail-dialog footer | [~] Partial | The shared model is rendered, but legacy popup branches still add duplicate and conflicting actions |
| 4. Align the doctor detail/modal experience | [x] Complete and verified | Historical doctor visits receive explicit review actions |
| 5. Reconcile server transition semantics | [x] Complete | Server-side ownership, transition guards, atomic writes, reschedule invariants, and lifecycle audit records added |
| 6. Complete regression coverage and documentation | [~] In progress | Pure policy matrix exists, but UI-level parity and browser verification remain incomplete |

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
10. Clinic cancellation stays in the separate clinic admin action area for
    confirmed or active appointments, not in the main footer.
11. Mark No Show is available only for confirmed, past-due, not-started clinic
    appointments.
12. Reassign Doctor remains hidden until a working doctor-selection flow exists.
13. Cards and popups use distinct canonical labels for No Show, Left Early,
    Treatment Completed, In Consultation, and Declined.

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

The persistent footer in the opened clinic booking dialog was updated to call
the same `getAppointmentFooterModel()` function as the card. Its action targets
are mapped as follows:

- `actions` opens the Actions tab.
- `billing` opens the existing Billing workflow.
- `overview` returns to the booking overview.
- `rebook` preserves the existing rebook form/session handoff.

The existing cancellation dialog and server mutations remain in place.
However, the audit below found that the dialog still contains older
stage-specific branches after the shared model output. Those branches
independently choose additional Confirm, Cancel, Bill, Rebook, Revert No-Show,
and Mark Visit Done controls. This phase is therefore partial until those
branches are removed or deliberately converted into policy-controlled
secondary actions.

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
- [~] Clinic detail-dialog footer calls the same model, but legacy stage branches
  still render additional actions after the model output.
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

### Latest popup layout pass — 2026-08-16

The clinic and doctor booking dialogs were aligned with the documented
card/detail layout contract:

- Normal dialogs now use an approximately `60vw × 60vh` desktop footprint;
  narrow screens retain the viewport-safe near-full-width layout.
- Popup footer actions now use responsive CSS grids rather than flex rows.
  Each rendered action occupies a full-width grid cell, so two- and
  three-action states have equal tracks and single actions fill the footer.
- Clinic popup footer actions continue to come from
  `getAppointmentFooterModel()`; the visual change does not alter action
  eligibility, targets, mutations, or server validation.
- Doctor approval, arrival, consultation, and treatment-completed controls now
  use explicit two-, three-, or four-column responsive grids as appropriate.
- Historical/declined/completed/terminal context is displayed in the doctor
  Overview information section. The persistent footer keeps only the
  actionable Review Visit control.
- The duplicate doctor footer waiting-state control was removed. Waiting
  context remains in `AppointmentInfoSection` within Overview.
- Clinic and doctor Overview content now use a bordered information section
  with consistent internal spacing. The doctor Overview also includes the
  lifecycle progress strip used by the clinic Overview.
- Existing role-specific actions, lifecycle conditions, callbacks, loading
  states, and authorization boundaries remain unchanged.

The `false &&` legacy branches in the shared card remain non-rendering legacy
code. They are not currently visible, but they increase the risk of future
state drift and should be removed only after the active action paths have
regression coverage. The clinic popup's stage-specific branches are different:
they are active and render after the shared model output, so they are part of
the remediation scope below rather than harmless dead code.

### Phase 6 verification note

The automated matrix, focused policy tests, and production Build Check pass
after the popup layout pass. A Playwright browser run was attempted, but the workspace
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
- [x] Implement full-width primary and equal-track responsive footer layout for card and dialog.
- [x] Move doctor historical and waiting context into the Overview information section.
- [x] Align normal clinic/doctor dialog sizing and Overview section spacing.
- [ ] Verify mobile footer wrapping at narrow card widths in a browser preview.
- [x] Verify server authorization and transition behavior with focused policy
  tests and compare-and-set writes.
- [x] Run the automated full lifecycle footer matrix.
- [ ] Complete the UI parity audit remediation described below.

## Completion criteria for the overall project

This plan is complete only when:

- Cards and detail dialogs use the same footer model.
- Clinic and doctor roles cannot see each other’s mutation workflows.
- Old unresolved bookings preserve an explicit resolution path.
- Rebook never replaces active visit management.
- Billing buttons reflect actual bill/payment state.
- Server-side authorization remains authoritative.
- The full lifecycle matrix is covered by automated tests.

---

## Audit findings and independent remediation plan

### Why this addendum exists

The original plan treated "the card and dialog call the same footer model" as
equivalent to "the card and dialog show the same actions." Those are not the
same guarantee. The clinic card calls the shared model for its main footer, but
also has a clinic-only overflow menu. The clinic booking dialog calls the
shared model, then renders older manual stage branches in the same persistent
footer. The doctor card and doctor patient dialog use related but not identical
review and lifecycle presentation paths.

The implementation work below is intentionally split into independent
work packages. Each package has a clear boundary, affected files, acceptance
criteria, and a suggested verification command. A package may be completed by
a separate developer, provided its stated dependency is satisfied.

## Consolidated pending-work table

This table is the plain-language summary of what remains. "Independent" means
the work can be assigned and completed as its own package. The dependency column
identifies only the minimum decision or shared result that must be available
first; it does not require one developer to implement every package.

### Progress meanings

- **Complete:** The foundation or related behavior already exists and has
  verification recorded.
- **Partial:** Some code exists, but the complete user-facing result is not
  reliable or consistent yet.
- **Pending:** The work has been identified but has not been implemented and
  verified.
- **Decision needed:** The team must choose the intended behavior before code
  should be changed.

| Independent step | What is still pending | Problem today | What can go wrong if it is not done | Executable work | Minimum dependency | Current progress |
|---|---|---|---|---|---|---|
| 1. Confirm the button rules | Record when Cancel, Mark No Show, Rebook, Resolve Booking, and Reassign Doctor should appear for clinic staff and doctors. | The rules were previously not recorded as one approved contract. | Different screens could make different decisions about the same appointment. | Record the approved rules in this document; align the shared past-due no-show policy; add focused policy tests. | None. This is the starting decision package. | **Complete — approved and recorded** |
| 2. Remove duplicate clinic-popup buttons | Make the opened clinic booking popup render one footer action set only. | The popup renders the shared footer and then renders older stage-specific footer branches as well. Confirm, Bill, Cancel, Rebook, Revert No-Show, and Mark Visit Done can appear twice or conflict. | Clinic staff may click the wrong duplicate button, see contradictory options, or believe an appointment is in a different state than it really is. | Keep the shared footer model and action handlers; remove the active manual `modalIs...` footer branches; keep cancellation/reason dialogs only behind the model action; move any true admin-only controls into a separately controlled Actions area. | Step 1. | **Pending — high risk** |
| 3. Fix clinic-card overflow actions | Make every overflow action either work correctly or disappear. | `Reassign Doctor` is visible but currently has an empty click handler. `Mark No Show` can be offered for a future appointment. | Staff can click a button that does nothing, or mark a future appointment as a no-show. This damages trust and can create incorrect appointment records. | Wire Reassign Doctor to a real doctor-selection flow, or remove it; make Mark No Show past/due-only; keep Patient Left Early limited to active visits; keep Override limited to its approved states; preserve server checks. | Step 1. | **Pending — high risk** |
| 4. Make old and future actions agree | Ensure the card and popup show the same actions for past, future, same-day overdue, and unknown-date bookings. | The shared policy uses Resolve Booking/Rebook for old unresolved records, but the popup's old fallback can still show Cancel. | Staff may cancel a booking that should be resolved or rebooked, or see different instructions depending on whether they opened the popup. | Compare card and popup action IDs for every date category; remove unconditional popup Confirm/Cancel fallbacks; verify same-day overdue and unknown-date behavior. | Steps 1 and 2. | **Pending — high risk** |
| 5. Use the same status words everywhere | Give No Show, Left Early, Treatment Completed, In Consultation, and Doctor Declined one consistent meaning. | The card can show Left Early as No Show and Doctor Declined as Cancelled, while popups use more precise wording. | Staff can misunderstand what happened to a patient, especially when reviewing history, billing, or deciding whether to rebook. | Create one shared lifecycle label map; use it in the card and both popup types; keep short labels only when necessary without merging meanings; add label tests. | Step 1. | **Pending — medium risk** |
| 6. Match the doctor card and patient popup | Make the doctor card and doctor patient popup show the same actions for the same appointment state. | The card uses the shared doctor footer model, while the popup has separate review/context logic. | Doctors may see Accept, Start, Done, Rx, or Review options in one place but not the other. Historical appointments may look actionable when they should be read-only. | Calculate one doctor classification/model; render action IDs once in the popup; keep Overview for explanation/history only; verify approval, consultation, treatment-completed, completed, terminal, and declined states. | Step 1. | **Partial foundation — parity pending** |
| 7. Add final tests and browser checks | Prove that buttons appear once, have the right labels, and work at normal and narrow screen sizes. | Current tests validate the pure policy but do not catch duplicate JSX branches or visual differences between card and popup. Browser verification is also still open. | A future change can reintroduce duplicate buttons or wrong-state actions without failing the existing tests. Layout problems may reach staff before they are noticed. | Add UI/render-level action-count tests; cover all clinic and doctor lifecycle rows; test loading states and labels; run the card/popup browser matrix; run `npm run build` and Build Check; record any browser-environment limitation. | Steps 2–6. | **Pending — final gate** |

### Short version for planning

The policy engine and server safety checks are already in place. The remaining
work is mainly to make the visible screens obey those rules:

1. Agree on the final button rules.
2. Remove the duplicate clinic-popup footer.
3. Fix or remove non-working/incorrect overflow actions.
4. Make old and future appointment actions match between card and popup.
5. Standardize lifecycle words.
6. Finish doctor card/popup parity.
7. Test every state and verify the result in the browser.

### Step 1 completion record

The Step 1 policy decisions were confirmed before implementation:

- Clinic cancellation remains in the separate clinic admin action area for
  confirmed or active appointments.
- Mark No Show is limited to confirmed appointments whose scheduled time has
  passed. The booking must also be not started and non-terminal.
- Reassign Doctor is hidden until a working doctor-selection flow is available.
- Lifecycle labels remain semantically distinct: No Show, Left Early,
  Treatment Completed, In Consultation, and Declined.

The shared classifier now enforces the approved past-due and confirmed
conditions for clinic no-show eligibility, with focused tests covering future,
pending, past-due, and already-started appointments. The visual controls and
popup consolidation remain pending in later steps.

### Current source-of-truth contract

Before changing any button, preserve this division of responsibility:

1. `shared/booking-status.ts`
   - Interprets raw confirmation, doctor approval, visit, date, and terminal
     fields.
   - Produces normalized lifecycle and action eligibility.
   - Does not render controls or perform mutations.

2. `client/src/lib/booking-classification.ts`
   - Adapts the shared classifier for client use.
   - Supplies the clinic timezone context.
   - Must remain the only client boundary that constructs booking
     classifications.

3. `client/src/lib/appointment-footer-model.ts`
   - Converts a classification plus bill counts into a role-specific footer
     model.
   - Chooses one primary action and zero or more secondary actions.
   - May choose a target such as `actions`, `billing`, `overview`, `notes`, or
     `prescription`.
   - Must not mutate, navigate, or authorize.

4. `AppointmentCard.tsx`, `BookingsPanel.tsx`, and `DoctorDashboard.tsx`
   - Render the model.
   - Map action IDs to existing callbacks, tabs, dialogs, and mutations.
   - Must not independently reimplement lifecycle precedence for the same
     footer action.

5. Server transition policy and routes
   - Remain authoritative.
   - UI visibility is not authorization.
   - Any client policy tightening must be checked against server behavior, but
     a button must never be shown merely because a mutation would reject it.

### Finding A — Clinic popup renders two footer policies

**Severity:** High
**Current area:** `client/src/components/BookingsPanel.tsx`, persistent
footer around the `getAppointmentFooterModel()` call and the later manual
`modalIs...` branches.

The popup first renders the shared model in a responsive grid. After that
output, it still renders manual branches for:

- completed visits;
- treatment-completed visits;
- in-consultation visits;
- checked-in visits;
- terminal records;
- pending/confirmed pre-arrival records.

This can produce duplicate controls or controls that contradict the selected
policy. Examples:

| Lifecycle | Shared model output | Additional manual output |
|---|---|---|
| Future pending | Confirm, Cancel | Confirm, Cancel |
| Checked in | Manage Visit, Open Billing | ₹ Bill, Cancel |
| In consultation | Manage Visit, Open Billing | ₹ Bill, Cancel |
| Treatment completed | Mark Visit Done, Open Billing | Mark Visit Done, ₹ Bill, Cancel |
| Terminal | Review/Rebook/Billing as eligible | Rebook and/or Revert No-Show again |

#### Required result

The clinic popup must render each policy action exactly once. The manual stage
branches must either be removed or converted into a separate, explicitly
policy-controlled administrative-actions area. They must not remain as a second
footer implementation.

### Finding B — Past bookings receive inconsistent popup actions

**Severity:** High
**Current areas:** `client/src/components/BookingsPanel.tsx`,
`client/src/lib/appointment-footer-model.ts`.

The shared clinic model intentionally handles past unresolved bookings with
`Resolve Booking` and, where eligible, `Rebook`. The old popup fallback can
still show a `Cancel` control for those same records because it uses a broad
pre-arrival fallback instead of the model's policy state.

The card and popup therefore disagree about whether an old booking should be
resolved/rebooked or cancelled like a future booking.

#### Required result

For every past, same-day-past-due, unknown-date, old-active, and
old-treatment-completed state, the popup must use the same primary/secondary
action IDs as the card model. No legacy fallback may add Confirm or Cancel
unless the model explicitly returns that action.

### Finding C — No-show visibility is broader than the documented policy

**Severity:** High
**Current areas:** `client/src/components/AppointmentCard.tsx`,
`client/src/lib/appointment-footer-model.ts`, `client/src/lib/booking-list.ts`.

The card overflow condition for `Mark No Show` checks that the visit has not
started, but does not independently require the booking to be past or due.
The client classifier action policy is also broad enough to make no-show
eligible for a current future booking. The server transition policy is more
restrictive and documents manual no-show as confirmed, past, and
not-started.

This creates a client/server policy mismatch and can expose an inappropriate
future `Mark No Show` control.

#### Required decision

Confirm and retain the existing server rule:

- clinic-owned booking;
- confirmed;
- appointment time/date is past;
- visit has not started;
- not terminal;
- required reason is supplied.

If that is the intended product rule, update the client classifier/model and
all card/menu renderers to use the same rule. Do not solve this only with a
visual condition in `AppointmentCard`.

### Finding D — Reassign Doctor is visible but has a no-op handler

**Severity:** High
**Current area:** `client/src/components/AppointmentCard.tsx`.

The clinic overflow menu displays `Reassign Doctor` when doctors are available,
but its handler is currently an empty function. `BookingsPanel` passes an
`onAssignDoctor` callback, but the menu does not invoke it.

#### Required result

Choose exactly one of these outcomes before implementation:

1. Wire the menu item to the existing assignment flow and provide the required
   doctor-selection UI; or
2. Remove/hide the menu item until the selection flow is available.

A visible action must never silently do nothing. If wired, preserve
`canAssignDoctor`, loading state, clinic ownership, and server authorization.

### Finding E — Lifecycle labels differ between card and popup

**Severity:** Medium
**Current area:** `client/src/components/AppointmentCard.tsx`,
`client/src/components/BookingsPanel.tsx`, `client/src/pages/DoctorDashboard.tsx`.

The same lifecycle is labelled differently by surface:

| State | Card | Clinic popup | Doctor popup |
|---|---|---|---|
| Doctor declined | Cancelled | Declined context in some areas | Appointment declined |
| Patient left early | No Show | Left Early | Patient left before completion |
| Treatment completed | In Consult | Tmt. Done | Treatment completed |
| In consultation | In Consult | With Doctor | In consultation |

The most important semantic defect is that `patient_left_early` is displayed
as `No Show` on the card even though it is a distinct terminal lifecycle.

#### Required result

Define one canonical user-facing label map for lifecycle status. Surfaces may
use short labels where space is limited, but they must not merge distinct
meanings:

- `no_show` → No Show;
- `patient_left_early` → Left Early;
- `treatment_completed` → Treatment Completed;
- `in_consultation` → In Consultation;
- `doctorApprovalStatus = declined` → Declined, not Cancelled.

Tooltips and explanatory text may be more detailed, but must use the same
semantic state.

### Finding F — Doctor card and doctor patient popup have partial parity

**Severity:** Medium
**Current areas:** `client/src/components/AppointmentCard.tsx`,
`client/src/pages/DoctorDashboard.tsx`.

The doctor card uses the shared footer model for approval, consultation,
prescription, notes, and review actions. The patient popup derives a related
review action and separately renders historical/terminal context. This is
closer to the intended design than the clinic popup, but it still creates two
places where doctor lifecycle presentation can drift.

#### Required result

The doctor popup must consume the same doctor footer model for action IDs and
read-only state. Its Overview tab may contain explanatory status context, but
the persistent actionable footer must not create a separate lifecycle matrix.

### Finding G — Existing tests do not detect duplicate rendered controls

**Severity:** Medium
**Current areas:** `client/src/lib/appointment-footer-model.matrix.test.ts`,
`client/src/components/AppointmentCard.tsx`,
`client/src/components/BookingsPanel.tsx`,
`client/src/pages/DoctorDashboard.tsx`.

The pure model matrix tests verify the expected action IDs returned by the
policy. They cannot detect that a component renders the model output and then
adds a second manual branch with the same action.

#### Required result

Add component-level or render-model-level coverage that verifies:

- each expected action appears exactly once;
- no action outside the model appears in the persistent footer;
- past records do not receive future confirmation/cancellation controls;
- patient-left-early is not labelled as no-show;
- doctor-declined records are read-only and do not expose approval controls.

---

## Independent implementation work packages

### Work package 1 — Freeze the intended lifecycle/action contract

**Goal:** Make the policy decisions explicit before changing JSX.

**Depends on:** None.

**Files:**

- `shared/booking-status.ts`
- `client/src/lib/appointment-footer-model.ts`
- `client/src/lib/appointment-footer-model.matrix.test.ts`
- this document

**Steps:**

1. Review each row in the clinic and doctor policy tables above.
2. Confirm whether cancellation is a persistent-footer action or an overflow/
   secondary administrative action for each active state.
3. Confirm that manual no-show is past-only.
4. Confirm the intended action for old unresolved and same-day past-due
   bookings.
5. Confirm whether Reassign Doctor is in scope for this pass.
6. Add or update pure matrix cases for any decision that is not already tested.
7. Keep the policy output expressed as stable action IDs, not UI copy.

**Acceptance criteria:**

- Every lifecycle row has one unambiguous action set per role.
- No policy decision is left encoded only in a component condition.
- Any intentional difference between card overflow and popup secondary actions
  is documented.

**Verification:**

```bash
npm test -- client/src/lib/appointment-footer-model.matrix.test.ts
```

### Work package 2 — Consolidate the clinic popup footer

**Goal:** Remove the second active footer implementation.

**Depends on:** Work package 1.

**Files:**

- `client/src/components/BookingsPanel.tsx`
- `client/src/lib/appointment-footer-model.ts`

**Steps:**

1. Keep the existing `getAppointmentFooterModel()` calculation.
2. Keep the existing action-to-mutation mapping, including:
   - Confirm;
   - Mark Arrived;
   - Remind;
   - Resolve Booking;
   - Manage Visit;
   - Mark Visit Done;
   - Billing;
   - Review;
   - Rebook;
   - Revert No-Show.
3. Remove the active manual `modalIsVisitCompleted`,
   `modalIsTreatmentCompleted`, `modalIsInConsultation`,
   `modalIsCheckedIn`, `modalIsTerminal`, and pre-arrival footer branches
   from the persistent footer.
4. Retain the existing cancellation dialog as the renderer for the `cancel`
   action rather than rendering a separate unconditional cancel button.
5. If active administrative actions such as Patient Left Early or Admin
   Override must remain available, render them in a separate Actions-tab
   section or add explicit action IDs and policy rules. Do not append them
   directly through lifecycle conditionals.
6. Keep billing as a target action so opening billing continues to use the
   existing billing panel.
7. Ensure an action is rendered once even when its target opens another tab.

**Acceptance criteria:**

- The popup contains one persistent footer action renderer.
- A treatment-completed booking has one Mark Visit Done action, not two.
- A checked-in/in-consultation booking has no duplicate billing action.
- A terminal booking has no duplicate Rebook or Revert No-Show action.
- Past unresolved bookings do not show Confirm or unconditional Cancel.
- Existing mutation callbacks, pending states, and dialogs still work.

**Verification:**

```bash
rg -n "modalIsVisitCompleted|modalIsTreatmentCompleted|modalIsInConsultation|modalIsCheckedIn|modalIsTerminal" client/src/components/BookingsPanel.tsx
```

The result may still contain Overview status variables, but the persistent
footer must not use them to create a second action matrix.

### Work package 3 — Make clinic-card overflow actions policy-controlled

**Goal:** Keep non-footer administrative actions intentional and functional.

**Depends on:** Work package 1. Can be developed independently of Work package
2 if the shared policy decisions are already accepted.

**Files:**

- `client/src/components/AppointmentCard.tsx`
- `client/src/components/BookingsPanel.tsx`
- `client/src/lib/booking-list.ts`
- `shared/booking-status.ts`

**Steps:**

1. Decide whether `Mark No Show` is represented by the shared
   `BookingActionPolicy` or by a dedicated administrative-action model.
2. Require the same past/due and not-started conditions used by the server.
3. Prevent `Mark No Show` from appearing on future appointments.
4. Keep `Patient Left Early` limited to active visits.
5. Keep completion override limited to unresolved old/past-due/unknown-date
   bookings, excluding treatment-completed and terminal states.
6. Ensure the overflow menu does not appear for states where no valid overflow
   action remains.
7. Replace the no-op Reassign Doctor handler with a real selection flow, or
   remove the menu item until that flow exists.
8. Preserve pending/disabled behavior for every mutation.
9. Keep server authorization as the final guard.

**Acceptance criteria:**

- No visible menu item is a no-op.
- Future appointments do not show Mark No Show.
- Patient Left Early is shown only for checked-in or in-consultation visits.
- Override is not shown after treatment completion or terminal closure.
- Card overflow actions are explainable as intentional actions outside the
  primary/secondary footer model.

### Work package 4 — Centralize lifecycle labels

**Goal:** Prevent different surfaces from assigning different meanings to the
same booking state.

**Depends on:** Work package 1. Independent of the popup cleanup.

**Files:**

- `client/src/lib/appointment-footer-model.ts`, or a new small policy label
  module if that is more appropriate
- `client/src/components/AppointmentCard.tsx`
- `client/src/components/BookingsPanel.tsx`
- `client/src/pages/DoctorDashboard.tsx`
- tests for the shared label function

**Steps:**

1. Define labels by normalized lifecycle and doctor approval state.
2. Use `patient_left_early` before generic no-show fallback.
3. Use doctor declined before generic cancelled/pending labels.
4. Replace card-local status label branches with the shared result.
5. Replace popup-local status label branches with the shared result where the
   same lifecycle is being displayed.
6. Keep short responsive labels only where necessary, but document any
   shortening.
7. Add tooltip text from the same semantic state rather than reclassifying the
   booking inside JSX.

**Acceptance criteria:**

- Left Early is never displayed as No Show.
- Doctor declined is never displayed as Cancelled.
- Completed, treatment-completed, and in-consultation states have consistent
  meaning across card and popup.

### Work package 5 — Align the doctor patient popup with the doctor footer model

**Goal:** Ensure doctor actions and read-only review behavior are identical in
the card and popup.

**Depends on:** Work package 1. Can run in parallel with Work package 2.

**Files:**

- `client/src/pages/DoctorDashboard.tsx`
- `client/src/components/AppointmentCard.tsx`
- `client/src/lib/appointment-footer-model.ts`

**Steps:**

1. Calculate one doctor classification for the selected booking.
2. Calculate one doctor footer model from that classification.
3. Render the model's action IDs once in the persistent modal footer.
4. Keep Overview content responsible for status explanation and history, not
   for creating alternate footer actions.
5. Route:
   - Add Observation to Diagnosis/records;
   - Notes to Notes;
   - View/Edit Rx to Prescription;
   - Review Visit/Appointment to Overview;
   - Start Consultation and Done to their existing mutations.
6. Keep declined, terminal, old, and completed states read-only according to
   the model.
7. Remove any duplicate waiting-state or historical review controls.

**Acceptance criteria:**

- Doctor card and popup expose the same action IDs for the same classification.
- Historical and declined records cannot show Accept, Decline, Start, or Done.
- Treatment-completed records retain View/Edit Rx only unless the policy
  explicitly changes.

### Work package 6 — Add UI-level action parity tests

**Goal:** Catch duplicate and out-of-policy controls that pure policy tests
cannot see.

**Depends on:** Work packages 1 and 2 for final action IDs. Label tests may be
added alongside Work package 4.

**Files:**

- `client/src/lib/appointment-footer-model.matrix.test.ts`
- new component/model tests near `AppointmentCard` and `BookingsPanel`
- `client/src/lib/booking-list.test.ts` where action-state coverage belongs

**Required cases:**

#### Clinic states

- future pending;
- future confirmed;
- same-day past due;
- old unresolved;
- old active;
- checked in;
- in consultation;
- treatment completed;
- completed with no bill;
- completed with unpaid bills;
- completed with paid bills;
- cancelled;
- no-show;
- patient left early;
- unknown date.

#### Doctor states

- awaiting approval;
- checked in;
- in consultation;
- treatment completed;
- completed;
- old unresolved;
- same-day past due;
- doctor declined;
- cancelled/no-show/early-exit terminal;
- unknown date;

#### Assertions

1. Expected action IDs are rendered exactly once.
2. No legacy branch adds an action not returned by the model.
3. Past bookings do not render future-only Confirm controls.
4. Past unresolved bookings do not render unconditional Cancel.
5. Future bookings do not render Mark No Show.
6. Left Early and No Show use different labels.
7. Reassign Doctor is either functional or absent.
8. Pending mutations disable the correct action without disabling unrelated
   review/navigation actions.

**Acceptance criteria:**

- Pure policy tests remain green.
- UI tests fail if a second footer branch is reintroduced.
- Each role/state combination has one expected visible action set.

### Work package 7 — Browser verification and final documentation

**Goal:** Verify the rendered experience after code-level consolidation.

**Depends on:** Work packages 2–6.

**Verification matrix:**

1. Clinic card and popup for future pending.
2. Clinic card and popup for future confirmed.
3. Clinic card and popup for checked in.
4. Clinic card and popup for in consultation.
5. Clinic card and popup for treatment completed with unpaid bills.
6. Clinic card and popup for completed with paid bills.
7. Clinic card and popup for old unresolved.
8. Clinic card and popup for no-show, cancelled, and left early.
9. Doctor card and patient popup for approval, checked-in,
   in-consultation, treatment-completed, completed, and declined.
10. Narrow mobile width where action labels wrap.

For every row, record:

- visible primary action;
- visible secondary actions;
- overflow actions;
- status label;
- whether any action is duplicated;
- whether the action opens the intended tab/dialog;
- pending/loading behavior;
- whether the layout remains usable at narrow width.

Run the project verification gate after implementation:

```bash
npm run build
```

Then restart the configured Build Check workflow and inspect the application
preview. If authenticated browser automation is unavailable because of the
known Chromium native-library limitation, record that limitation explicitly
and do not mark browser verification as complete based only on source review.

**Acceptance criteria:**

- Card and popup parity is verified for all supported lifecycle rows.
- No duplicate footer controls are visible.
- No future-only or past-only action appears in the wrong date state.
- Build Check completes successfully.
- This document's tracker and verification record reflect the actual result.

---

## Remediation completion checklist

- [x] Policy decisions for cancellation, no-show timing, and reassign-doctor
  scope are confirmed.
- [ ] Clinic popup has one active footer action renderer.
- [ ] Clinic card overflow actions are centralized, intentional, and functional.
- [ ] Past bookings no longer receive future confirmation/cancellation controls.
- [ ] Future bookings no longer receive Mark No Show.
- [ ] Reassign Doctor is wired or removed.
- [ ] Lifecycle labels are semantically consistent across card and popup.
- [ ] Doctor card and doctor patient popup use the same doctor action model.
- [ ] UI-level duplicate-action tests pass.
- [ ] Browser parity matrix is complete.
- [ ] Build Check passes after the final implementation.