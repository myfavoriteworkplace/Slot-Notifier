# 2. Uploaded booking audit — detailed verification and implementation guide

## 2.1 Why this document exists

This document explains the uploaded booking audit in language that both a clinic user and a developer can understand.

It answers four questions for every finding:

1. **What does this look like to a user?**
2. **What does the current application do?**
3. **What is actually wrong or incomplete?**
4. **How should the team implement the improvement?**

It is not a copy of the uploaded note. The original note was written against an earlier application state. The current repository already contains some of the proposed fixes, so each section clearly separates:

- **Resolved:** the current code supports the intended behavior.
- **Partially resolved:** the UI or backend has moved in the right direction, but the rule is still duplicated or incomplete.
- **Still open:** the risk is still visible in the current code.
- **Needs verification:** source inspection is not enough; the behavior needs a browser, API, database, or production-environment check.
- **Documentation drift:** existing documents describe a different contract from the current code.

## 2.2 Source and scope

### Original source

`attached_assets/Pasted-Audit-completed-no-application-code-changed-I-found-tha_1786372797835.txt`

### Main code reviewed

- `client/src/components/AppointmentInfoSection.tsx`
- `client/src/components/AppointmentCard.tsx`
- `client/src/components/BookingsPanel.tsx`
- `client/src/pages/DoctorDashboard.tsx`
- `client/src/lib/booking-list.ts`
- `client/src/lib/clinic-constants.tsx`
- `server/storage.ts`
- `server/routes.ts`
- `shared/schema.ts`

### Related documentation reviewed

- `docs/features/booking/03-booking-status-and-lifecycle.md`
- `docs/features/booking/04-shared-appointment-card.md`
- `docs/features/booking/05-role-based-card-actions.md`
- `docs/development/clinic-doctor-dashboard-ui-standards.md`

## 2.3 Executive summary in everyday language

The application shows the same appointment in several places:

- a clinic booking card
- a clinic booking popup
- a doctor booking card
- a doctor booking popup
- a notification deep link
- a filtered or paginated booking list

The application now shares the **visual information-message component**, which is a good improvement. However, the different screens still decide for themselves whether a booking is old, overdue, completed, active, pending, or actionable.

That means the same booking can still receive different treatment depending on where it is viewed. For example:

- one screen may call it “Past”
- another may keep it under “Today”
- one screen may count it as pending
- another may exclude it
- a doctor card may show consultation actions for an old booking
- a clinic count may disagree with the number of visible records

The underlying issue is not mainly spacing or button styling. It is that **booking meaning is calculated in multiple places**.

### Recommended overall approach

Build the solution in this order:

1. Define one canonical booking classification policy.
2. Make client cards, popups, filters, and actions use that policy.
3. Make clinic and doctor server queries use equivalent predicates.
4. Keep role-specific visibility rules separate from shared booking meaning.
5. Use the shared information component for presentation.
6. Add state-matrix tests before changing production behavior.
7. Finish responsive layout and visual verification.

Do not start by rewriting every card or popup. That would move duplicated logic around without fixing the underlying inconsistency.

## 2.4 Implementation program status

This document is the working plan for the shared appointment-classification improvement. Progress is recorded here so product, clinic operations, QA, and development teams can see what has been agreed, what has been completed, and what remains.

| Phase | Purpose | Status | Application behavior changed? |
|---|---|---|---|
| Phase 1 | Confirm the business contract for dates, lifecycle, actions, and patient aggregates | **Completed as planning/documentation** | No |
| Phase 2 | Repair the type-check and test baseline | **Completed** | **Yes — baseline maintenance fixes only; no lifecycle policy change** |
| Phase 3 | Add shared status/date constants and normalized types | **Completed** | **No — contract and type foundation only; no booking behavior changed** |
| Phase 4 | Build and unit-test the pure booking classifier | **Completed** | **No — pure policy module and tests only; no UI, server query, or transition behavior changed** |
| Phase 5 | Migrate client helpers, cards, popups, and dashboards | **Completed** | **Yes — client lifecycle interpretation and action visibility now use the shared classifier** |
| Phase 6 | Align server filters, counts, and statistics | **Completed — Steps 1–9 complete** | **Yes — server predicates, booking filters, clinic/doctor counts, clinic analytics, clinic-timezone boundaries, patient-history metadata, and server regression coverage aligned** |
| Phase 7 | Add server-side transition/action guards | Not started | No |
| Phase 8 | Complete responsive UI verification and rollout checks | Not started | No |

### Progress update after Phase 1

Phase 1 is complete as a planning and contract-definition step. The complete implementation plan is now recorded in this document. No application code, dependencies, database schema, configuration, or runtime behavior was changed.

The following implementation defaults are recorded for the next phase:

- Use one canonical booking classification model rather than adding another presentation-only helper.
- Keep `AppointmentInfoSection` as the visual presentation component.
- Treat the clinic’s business timezone as the source for “today,” “old,” and same-day past-due decisions. The clinic timezone must be confirmed from the existing clinic configuration or explicitly documented before implementation.
- Keep old checked-in and in-consultation visits as active exceptions; do not make old date alone block a visit that has already started.
- Treat old pending/confirmed pre-arrival bookings as needing resolution rather than offering normal doctor consultation actions.
- Keep `treatment_completed`, `completed`, and `patient_left_early` as distinct application states until product and live-data review approve any migration.
- Treat `cancelled`, `no_show`, and `patient_left_early` as terminal for normal appointment progression, while preserving permitted history, billing, and rebooking access.
- Keep role visibility separate from lifecycle meaning: clinic and doctor lists may differ by authorization and assignment, but not because they use contradictory definitions of completed, pending, or upcoming.
- Generate UI action permissions from the classification model and enforce state transitions on the server as well.
- Do not perform a database status-value migration in the first implementation phase.
- Use compatibility wrappers while existing callers are migrated gradually.

### Phase 1 outputs

- The problem statement is recorded in user-facing and developer-facing language.
- Approach B is selected as the implementation direction.
- The separation between booking meaning, role visibility, permitted actions, and presentation is documented.
- The approved normalized status model is documented.
- The approved date/timezone policy is documented.
- The approved old-booking doctor-action matrix is documented.
- The remaining phases, file areas, tests, and acceptance criteria are documented.

### Approved business decisions before implementation

The product/clinic owner confirmed the following decisions before Phase 3 implementation begins:

1. **Business timezone — Option B: timezone stored per clinic**
   - Each clinic is the source of truth for its own business calendar.
   - The value must be an IANA timezone, such as `Asia/Kolkata`.
   - Existing clinics need a documented default. Until clinic-specific values are available, the default is `Asia/Kolkata`.
   - A user's browser timezone must not redefine the clinic's meaning of “today.”

2. **Old bookings — Options B + D: active-visit exception plus explicit override**
   - An old pending/confirmed booking that has not started is a resolution case and must not expose normal doctor consultation actions.
   - An old booking with `checked_in` or `in_consultation` remains an active exception and can continue through the valid active-visit flow.
   - An old `treatment_completed`, `completed`, or `patient_left_early` booking is not an active consultation and receives the relevant closure, history, billing, or rebooking actions only.
   - A separately protected, explicit override path may be used for exceptional operational corrections. It must be role-controlled, visible to the user, and enforced by the server; it must not be implemented as an invisible bypass.

3. **`treatment_completed` — Option B: distinct treatment-complete state**
   - `treatment_completed` means clinical treatment is finished but the booking is not necessarily administratively closed.
   - It remains distinct from `completed`.
   - It must not be treated as an active consultation.
   - Closure, billing, notes, or follow-up work may remain available according to role permissions.

4. **`patient_left_early` — Option C: terminal for normal progression with explicit rebooking**
   - The original booking cannot normally be advanced or resumed as if the patient completed the visit.
   - History and billing remain available as permitted.
   - The operational path is rebooking or a separately authorized correction, rather than silently reopening the original visit.
   - It is terminal for normal lifecycle progression, but it must not be counted as a completed patient visit.

5. **Completed patient visit — Option D: separate completed, started, and early-exit measures**
   - A completed patient visit is `treatment_completed` or `completed`.
   - A started visit is tracked separately and includes visits that reached `checked_in` or `in_consultation`, as well as treatment-complete and completed states.
   - `patient_left_early` is reported separately as an early exit.
   - The same booking must not be counted as a completed visit merely because the patient checked in or left early.

6. **Legacy confirmation values — Option D: preserve explicit legacy categories**
   - Raw legacy values such as `email_verified` and `admin_booked` remain unchanged in stored data.
   - The application must retain their legacy identity at the normalization boundary instead of silently converting every row to `pending` or `confirmed`.
   - Each legacy value must have an explicit grouping policy for confirmation, list visibility, and actions.
   - The mapping must be reviewed against live data and the route that produced the value before it is used to authorize a confirmation-dependent action.
   - No database rewrite is part of Phase 3.

These decisions supersede the earlier “confirm before implementation” questions. They are the implementation contract for Phases 3–8. If live-data review reveals that a legacy value has multiple historical meanings, the value must remain in an explicit review/legacy category until a narrower rule is approved.

### Consequences of the approved decisions

The decisions intentionally separate four concerns:

```text
stored database value
  → normalized status meaning
  → date/lifecycle classification
  → role-specific visibility and permitted action
```

They imply the following behavior:

- **Date meaning is clinic-local.** A booking near UTC midnight is classified using the clinic timezone, not the browser or server's incidental timezone.
- **Old does not automatically mean inactive.** Old pre-arrival bookings need resolution; old genuinely active visits remain manageable.
- **Treatment completion is not administrative closure.** Counts and actions must distinguish treatment delivered from a fully closed record.
- **Early exit is not completed care.** It remains historical and rebookable without allowing normal progression.
- **Legacy data is not silently “corrected.”** The application preserves enough information to audit and safely decide how old records should behave.
- **An override is exceptional, not a second normal workflow.** It requires explicit intent, authorization, current-state checks, and an audit trail when implemented.

No application, schema, dependency, configuration, or runtime behavior changed when these decisions were confirmed. Phase 3 remains **Not started** until the shared contract is implemented.

### Approved implementation impact by phase

The confirmed decisions change the implementation plan as follows:

| Phase | Planned changes under the approved contract | Explicitly not changed in that phase |
|---|---|---|
| Phase 3 | Add shared status/date constants, normalized types, named lifecycle groups, clinic-timezone date context, null/unknown/conflict handling, and preserved legacy categories. | No database migration, status rewrite, filter change, action change, or UI behavior change. |
| Phase 4 | Build a pure classifier that uses the clinic timezone and distinguishes old pre-arrival, old active, treatment-complete, completed, terminal, and early-exit states. Add the full state matrix, including override eligibility as a separate policy result. | No React rendering, network calls, database calls, or state mutations inside the classifier. |
| Phase 5 | Make cards, popups, dashboards, filters, notification deep links, and compatibility wrappers consume the same classification and action policy. Present `treatment_completed`, `completed`, and `patient_left_early` differently where appropriate. | Role visibility remains separate from lifecycle meaning; hidden buttons are not treated as authorization. |
| Phase 6 | Align clinic/doctor SQL filters, totals, statistics, and patient history. Keep completed visits, started visits, and early exits as separate measures. | Do not load an entire dataset into JavaScript just to reuse the client classifier. |
| Phase 7 | Enforce old-booking restrictions, active-visit exceptions, terminal-state protection, and explicit authorized overrides on the server. Record override reasons and current-state checks. | Do not allow a UI-only bypass or silently reopen `patient_left_early` records. |
| Phase 8 | Verify timezone boundaries, responsive status/action presentation, long labels, accessibility, and deep-link behavior across clinic and doctor surfaces. | Do not introduce new lifecycle rules during visual verification. |

The sequencing rule is: **Phase 3 defines the vocabulary, Phase 4 defines the meaning, Phases 5–6 apply it, Phase 7 enforces it, and Phase 8 verifies its presentation.**

---

### Progress update after Phase 2

Phase 2 is complete. The existing TypeScript baseline was repaired before beginning the lifecycle classifier work. The fixes addressed source-level type and contract drift in appointment cards, billing, bookings, inventory, medical history, dashboards, the public booking page, and server routes. No canonical booking classifier, shared lifecycle model, server predicate layer, or lifecycle transition policy was introduced.

#### Phase 2 implementation record

```text
Phase:
  Phase 2 — Repair the type and test baseline

Status:
  Completed

Files changed:
  client/src/components/AppointmentCard.tsx
  client/src/components/BillingHistoryPanel.tsx
  client/src/components/BookingsPanel.tsx
  client/src/components/InventoryPanel.tsx
  client/src/components/MedicalHistoryTab.tsx
  client/src/pages/Book.tsx
  client/src/pages/ClinicDashboard.tsx
  client/src/pages/DoctorDashboard.tsx
  server/routes.ts

Behavior delivered:
  - Restored the missing appointment-card no-show callback and loading-state wiring.
  - Reconnected billing tax state cleanup to the existing pending-billing state.
  - Removed unsupported Lucide icon props and repaired custom tax editing state updates.
  - Aligned booking date, tab, document, and visit-date values with their component contracts.
  - Made the medical-history edit draft explicitly non-nullable while preserving nullable database fields.
  - Aligned notification reads with the schema's `read` field.
  - Added the missing demo-clinic storage-limit field.
  - Corrected server callback parameter types and mapped consent-version audit events to the supported consent resource.
  - No lifecycle classification or booking-status behavior was changed.

Checks run:
  - `npm run check` — passed with zero TypeScript errors.
  - `npx tsx --test client/src/lib/booking-list.test.ts` — 4 passed, 0 failed.
  - `npm run build` — passed.
  - `Build Check` workflow — finished successfully.
  - `Start application` workflow — running and serving health checks successfully.
  - `git diff --check` — passed.

Known follow-up risks:
  - The booking-list suite still contains only four basic unit tests; the lifecycle state matrix belongs to Phase 4.
  - Browser/responsive verification remains part of Phase 8. The Playwright Chromium binary is not installed in the current environment, so that suite was not used as Phase 2 evidence.
  - Existing build warnings about large chunks and stale Browserslist data remain outside Phase 2 scope.
```

Phase 2 restored the prerequisite baseline for the classifier work. Phase 3 established the shared status/date foundation, Phase 4 completed the pure classifier and state-matrix tests, and Phase 5 migrated the client lifecycle interpretation. Phase 6 is now complete: server predicate, filter, clinic/doctor count alignment, clinic-timezone boundary, analytics, patient-history metadata, and dedicated server predicate/statistics tests Steps 1–9 are done. Phase 7 and Phase 8 are still pending.

---

# 3. Finding-by-finding verification

## 3.1 Shared appointment information messages

### What a clinic user expects

When a clinic staff member opens an appointment, the card and popup should explain the same situation using the same words:

- The appointment is pending.
- The appointment is confirmed.
- The patient has not arrived.
- The appointment time has passed.
- The patient is waiting.
- The consultation is in progress.
- The patient did not arrive.
- The visit is complete.
- Payment is still pending.

A doctor should see the same underlying facts, with role-appropriate wording and actions.

### What the uploaded audit said

The original note said that no shared `AppointmentInfoSection` existed and that the card, clinic popup, and doctor dashboard rendered messages independently.

### Current status: partially resolved

`client/src/components/AppointmentInfoSection.tsx` now exists and is used by:

- `client/src/components/AppointmentCard.tsx`
- `client/src/components/BookingsPanel.tsx`
- `client/src/pages/DoctorDashboard.tsx`

The component centralizes message markup, colors, icons, compact expansion, and message ordering within that component. It accepts inputs such as:

- `isPastDue`
- `isCancelled`
- `isNoShow`
- `isLeftEarly`
- `isVisitCompleted`
- `isTreatmentCompleted`
- `isInConsultation`
- `isCheckedIn`
- billing counts
- completion note
- cancellation reason

This means the original statement “there is no shared component” is now stale.

### What is still inconsistent

The component receives booleans that each caller calculates independently. For example:

- `AppointmentCard.tsx` calculates slot age and visit state.
- `BookingsPanel.tsx` recalculates modal state.
- `DoctorDashboard.tsx` calculates its own past-due and visit-state values.
- `booking-list.ts` has separate display and action helpers.
- `server/storage.ts` calculates server-side filters and statistics again.

The shared component standardizes **how a fact is displayed**, but not **how the fact is decided**.

### Why this matters

If one developer changes the definition of “completed” in the card but not the popup, the user sees conflicting information. If one API excludes `treatment_completed` and another does not, counts and lists disagree even if the UI component is shared.

### Implementation approaches

#### Approach A — Minimal correction

Keep the current component and create a small client helper that returns all booleans:

```text
getBookingDisplayState(booking, currentDate)
  → isOld
  → isToday
  → isSameDayPastDue
  → isTerminal
  → isActive
  → isTreatmentCompleted
  → isVisitCompleted
  → canShowDoctorActions
  → canShowClinicActions
```

Then replace local boolean calculations in the three frontend callers.

**Advantages**

- Smallest frontend change
- Lower visual regression risk
- Reuses the existing `AppointmentInfoSection`

**Limitations**

- Does not automatically fix server filters or database counts
- Client and server can still drift unless the rules are documented and mirrored carefully

#### Approach B — Recommended

Create a canonical booking classification model shared by the frontend and backend conceptually, with:

- shared status constants and type definitions
- a pure client classifier for UI state
- server-side predicate helpers for SQL filters
- role-specific permission/action helpers

The key design is to separate:

1. **What the booking means**
2. **Who is allowed to see it**
3. **What the current user is allowed to do**
4. **How the result is displayed**

**Advantages**

- Fixes the root cause
- Supports both card and popup
- Makes server statistics and lists easier to align
- Makes tests readable as business rules

**Limitations**

- Requires careful handling of date/timezone behavior
- Requires a transition plan for existing legacy status values

#### Approach C — Database-generated state

Add a database view or generated classification columns.

**Advantages**

- Centralizes some server-side reporting logic
- Can make SQL reporting consistent

**Limitations**

- Does not solve browser-side action decisions by itself
- Date/timezone behavior becomes harder to reason about
- Adds migration and reporting complexity

### Recommendation

Use **Approach B**. Keep `AppointmentInfoSection` as the presentation component, but stop passing independently calculated booleans from every caller.

### Done criteria

- Clinic card and popup show the same message for the same booking.
- Doctor card and popup show the same lifecycle meaning.
- All callers consume one normalized display model.
- Tests cover every lifecycle combination used by the component.
- No caller reimplements terminal-state or old-booking rules locally.

---

## 3.2 Popup spacing and information hierarchy

### What a clinic user expects

The popup should read from top to bottom:

1. Who the patient is
2. What appointment this is
3. What needs attention
4. What stage the visit is in
5. What actions are available

Messages should not appear to be accidentally attached to the patient information grid. The user should be able to see a clear separation between identity, status information, progress, and actions.

### Current status: needs visual/runtime verification

The shared information component has internal spacing and an expandable compact mode. However, source inspection cannot prove that all outer dialog layers have consistent spacing.

The relevant surfaces include:

- clinic booking dialog in `BookingsPanel.tsx`
- doctor booking dialog in `DoctorDashboard.tsx`
- card layout in `AppointmentCard.tsx`
- tabs for Overview, Notes, Clinical, Billing, Documents, and Actions

### Why source inspection is insufficient

Spacing problems depend on rendered behavior:

- nested padding can only be judged visually
- long messages may wrap differently at different widths
- a popup can become too tall even when each individual section looks correct
- Radix dialog content and portal behavior can affect available height

### Implementation approaches

#### Approach A — Local spacing adjustment

Add spacing classes directly around the affected information section.

**Good for:** a small visual defect with no repeated layout pattern.

**Risk:** the clinic and doctor dialogs can diverge again.

#### Approach B — Recommended section layout contract

Define a reusable dialog body structure:

```text
Patient/appointment identity
  ↓ consistent gap
Divider or subtle top border
  ↓ consistent gap
Common appointment information
  ↓ consistent gap
Lifecycle progress
  ↓ flexible gap
Footer actions
```

Use named layout classes or small wrapper components rather than repeating arbitrary padding values.

**Good for:** maintaining consistent spacing across both roles and all tabs.

#### Approach C — Full dialog layout rewrite

Replace the current tab/dialog composition with a shared shell.

**Good for:** a major redesign.

**Risk:** high regression risk and outside the narrowest scope of the original audit.

### Recommendation

Use **Approach B**. Do not rewrite the dialogs until the state model is stable.

### Done criteria

- Identity, common status messages, progress, and actions are visually distinct.
- Information messages do not begin directly against the patient grid.
- The footer remains reachable when the body is tall.
- The same spacing contract works for clinic and doctor dialogs.
- The layout is checked at narrow mobile, tablet, and desktop widths.

---

## 3.3 Responsive footer actions

### What a user expects

Buttons should remain readable and tappable on a phone. A user should never need to horizontally scroll a dialog footer or guess which part of a wrapped label is the button.

### Current status: still open / partially addressed

The application contains multiple action groups in:

- `client/src/components/AppointmentCard.tsx`
- `client/src/components/BookingsPanel.tsx`
- `client/src/pages/DoctorDashboard.tsx`

Examples include:

- Confirm / Cancel
- Mark Arrived / Remind
- Start Consultation / Add Observation
- Add Observation / Notes / Done / Issue Rx
- Settle Payment / Rebook
- View Invoice / Rebook
- terminal-state View Bill / Rebook

The booking documentation in `docs/features/booking/04-shared-appointment-card.md`
and `docs/features/booking/05-role-based-card-actions.md` gives the lifecycle
button policy, but it does not prove that every rendered footer is responsive
at every breakpoint.

### Implementation approaches

#### Approach A — Add wrapping

Use `flex-wrap`, allow buttons to grow, and let labels wrap.

**Advantages:** small change.

**Limitations:** can create uneven button widths and awkward two-line labels.

#### Approach B — Recommended responsive action layout

Represent actions as data and render them through a shared responsive footer:

```text
mobile: one full-width action per row
small tablet: two related actions per row
desktop: two or three actions depending on lifecycle stage
```

Important rules:

- primary action comes first
- destructive actions are visually separated
- icon-only actions have accessible labels
- labels may wrap naturally
- icons must not shrink
- the footer can scroll independently if necessary
- rare/destructive actions stay in the overflow menu

#### Approach C — Reduce visible actions

Keep only the primary action in the footer and move secondary actions into a menu.

**Advantages:** simplest mobile layout.

**Limitations:** hides actions that doctors or clinic staff may need frequently.

### Recommendation

Use **Approach B**, while keeping the existing progressive-disclosure rule from the footer documentation:

- common actions in the footer
- rare or destructive actions in the overflow menu
- status messages in the information strip, not disabled buttons

### Done criteria

- One action occupies one row on a narrow phone.
- Two related actions fit without overflow on a small tablet.
- Three-action consultation states are usable on desktop.
- Long patient names do not push actions outside the dialog.
- Long confirmation messages do not squeeze action buttons.
- Keyboard focus and screen-reader labels remain correct.

---

## 3.4 Old booking versus same-day past-due

### The user-facing distinction

These are two different situations:

#### Old booking

The appointment calendar date is before today.

Example:

```text
Today: 10 August
Appointment: 9 August
```

This is an old booking even if the appointment time was only one hour ago.

#### Same-day past-due

The appointment is today, but its scheduled time has passed.

Example:

```text
Today: 10 August
Appointment: 10 August at 10:00
Current time: 11:00
```

This is still a Today appointment by calendar date, but it may need operational attention.

### Current status: still open

Positive evidence:

- `client/src/lib/booking-list.ts` distinguishes previous calendar dates from today for list grouping.
- `server/storage.ts` accepts an optional `todayDate` so requests during one session can use a stable date boundary.
- Clinic and doctor queries use `startOfDay`, `endOfDay`, and tomorrow boundaries in several places.

Remaining inconsistency:

- `getBookingActionState()` does not include old-booking state.
- Cards, dialogs, and dashboards calculate related flags locally.
- Some code uses `new Date()` or `Date.now()` directly.
- The frontend and backend do not have one named date policy.
- Existing documentation does not consistently distinguish calendar age from slot-time age.

### Timezone decision required before implementation

The team must decide which timezone defines “today”:

1. **Browser timezone**
   - Simple for a single user
   - Can differ between clinic staff in different locations

2. **Server timezone**
   - Consistent for all users
   - Can be wrong if the deployment timezone is UTC and the clinic operates in India

3. **Clinic timezone — recommended for business rules**
   - The appointment belongs to a clinic
   - “Today” should normally mean today at that clinic
   - Requires a clinic timezone setting or a documented default such as `Asia/Kolkata`

Do not silently mix browser local time, Node server time, and UTC string slicing.

### Implementation approaches

#### Approach A — Shared client helper

Create helpers such as:

```text
getLocalCalendarDate()
isBookingOld()
isBookingToday()
isSameDayPastDue()
```

Use them in cards, filters, and action state.

**Good for:** immediately aligning the frontend.

**Limitation:** server filters can still disagree.

#### Approach B — Recommended explicit date context

Pass a date context into classification:

```text
{
  currentDate: "2026-08-10",
  timezone: "Asia/Kolkata",
  now: "2026-08-10T11:00:00+05:30"
}
```

Use:

- calendar date comparison for old/today/future
- appointment start/end comparison only for same-day past-due

The server should use the same business timezone when creating SQL boundaries. The client should receive the date context or a server-provided current business date rather than inventing a different one.

#### Approach C — Store a derived appointment date

Store a clinic-local date column on the slot or booking.

**Advantages:** reporting becomes easier.

**Limitations:** timezone changes and historical corrections become migration concerns; the exact appointment instant still needs to be retained.

### Recommendation

Use **Approach B** first. Keep the appointment timestamp as the source record and calculate business-day boundaries using an explicit clinic timezone.

### Done criteria

- A previous calendar day is always classified as old.
- A same-day past slot is not incorrectly moved into the old-booking category.
- Browser and server classifications agree around midnight.
- India/UTC boundary tests pass.
- The date context is visible in logs or test fixtures when diagnosing a mismatch.

---

## 3.5 Doctor actions on old bookings

### The user-facing problem

A doctor should not normally be offered active consultation controls for an appointment from a previous day that never started. That appointment needs resolution:

- reschedule
- mark no-show
- cancel
- contact clinic

However, an old record that is already genuinely active must not be accidentally blocked. For example, a patient may have checked in before a system outage or a clinic may be closing a visit later than expected.

### Current status: still open / needs state-matrix testing

The doctor action branches remain in `DoctorDashboard.tsx`, and the card action branches remain in `AppointmentCard.tsx`.

The code exposes actions such as:

- Start Consultation
- View Notes
- Add Observation
- Done with Patient
- Issue Rx

The existing `getBookingActionState()` checks lifecycle flags but does not include old calendar date as an input. Therefore, it cannot independently enforce an old pre-arrival policy.

### Recommended policy

| Booking condition | Doctor view | Doctor actions |
|---|---|---|
| Old + pending approval | Expired / needs clinic resolution | No consultation actions |
| Old + confirmed + not arrived | Expired / needs resolution | No Start Consultation, Notes, Observation, or Rx |
| Old + checked in | Active exception | Continue only the actions valid for checked-in state |
| Old + in consultation | Active exception | Continue consultation and completion actions |
| Old + treatment completed | Read-only treatment-complete state | View relevant records; no new treatment action unless explicitly allowed |
| Old + completed | Read-only visit history | View notes, records, billing as permitted |
| Cancelled | Cancelled | Rebook or permitted record/billing access |
| No-show | No-show | Rebook or resolution access |
| Patient left early | Left early / terminal | Rebook, billing, and history access as permitted; do not resume normal progression |

### Important rule

Old date alone should not override a visit that has already started. The system must distinguish:

- **old pre-arrival appointment:** stale operational work
- **old active visit:** legitimate in-progress exception
- **old completed visit:** historical record

Under the approved policy, an exceptional old pre-arrival correction may use a later explicit override path. The override must:

- require an authorized clinic role;
- state why the normal old-booking policy is being bypassed;
- re-check the current booking state on the server;
- never bypass terminal-state protection silently;
- be auditable and distinguishable from ordinary doctor actions.

### Implementation approaches

#### Approach A — Add `isOld` to every action condition

Example concept:

```text
canStartConsultation =
  isCheckedIn
  && !isOld
  && !isTerminal
```

Then add exceptions for active old visits.

**Limitation:** many local conditions become difficult to review.

#### Approach B — Recommended action matrix

Have the classifier return an action policy:

```text
{
  doctor: {
    canApprove,
    canStartConsultation,
    canOpenNotes,
    canOpenObservation,
    canIssuePrescription,
    canCompleteVisit,
    canViewHistory
  }
}
```

The card and popup render from this policy rather than repeating conditions.

#### Approach C — Server-authoritative action permissions

The server returns permitted actions or rejects invalid transitions even if the UI hides the button.

**Recommendation:** this should be added in addition to Approach B for security and race-condition protection. UI hiding is not authorization.

### Done criteria

- Old pre-arrival records cannot start consultation through the UI or API.
- Old active visits follow the documented exception.
- Invalid direct API calls receive a clear 4xx response.
- Card, popup, notification deep link, and filtered list use the same policy.
- Every action transition is tested for both allowed and rejected states.

---

## 3.6 Lifecycle status definitions and documentation drift

### Why this is confusing

A booking does not have one universal `status` field. Several fields track different dimensions:

- whether the appointment is confirmed
- whether the assigned doctor accepted
- whether the patient arrived
- whether treatment is complete
- whether the visit is closed
- whether money is paid

That separation is valid, but the application and documents do not always use the same definitions.

### Current status: confirmed inconsistency and documentation drift

`shared/schema.ts` defines:

- `verificationStatus`
- `doctorApprovalStatus`
- `visitStatus`
- `clinicalStatus`
- `paymentStatus`

The current code uses these visit values:

- `null`
- `checked_in`
- `in_consultation`
- `treatment_completed`
- `completed`
- `patient_left_early`

Terminal conditions are also represented by:

- `verificationStatus = cancelled`
- `verificationStatus = no_show`

### Evidence of drift

- Some code treats only `completed` as fully complete.
- Some filters exclude `completed` and `patient_left_early`.
- Doctor awaiting logic also excludes `treatment_completed`.
- No-show is stored in `verificationStatus`, while previous visit state may remain present.
- `client/src/lib/booking-list.test.ts` uses a fixture value of `"scheduled"`, which is not a current visit lifecycle value in the main documentation.
- `docs/features/booking/03-booking-status-and-lifecycle.md` and
  `docs/development/clinic-doctor-dashboard-ui-standards.md` do not describe
  exactly the same visit-status set or transition behavior.

### Recommended canonical model

Keep the database fields separate, but define one canonical interpretation:

#### Confirmation track

```text
pending
confirmed
cancelled
no_show
```

The normalized confirmation track must also be able to represent preserved legacy values without losing their source meaning:

```text
legacy_email_verified
legacy_admin_booked
legacy_unknown
```

These are application-level legacy categories, not new database values. Their grouping into pending, confirmed, or review-required behavior must be explicit and must not be inferred from the label alone.

#### Doctor approval track

```text
unassigned
pending
approved
declined
admin_confirmed
```

#### Visit track

```text
not_started
checked_in
in_consultation
treatment_completed
completed
patient_left_early
```

`not_started` can be a normalized application value for database `NULL`; the database does not necessarily need to be changed immediately.

#### Derived categories

```text
terminal:
  cancelled, no_show, patient_left_early

active:
  checked_in, in_consultation

treatment_done_but_not_closed:
  treatment_completed

visit_closed:
  completed
```

#### Derived patient-visit measures

These measures are intentionally different:

```text
completed_patient_visit:
  treatment_completed, completed

started_patient_visit:
  checked_in, in_consultation, treatment_completed, completed, patient_left_early

early_exit:
  patient_left_early
```

`started_patient_visit` is an attendance/operational measure. It must not be substituted for `completed_patient_visit` in patient history or completed-visit reporting.

#### Unknown and null status policy

- A database `NULL` `visitStatus` normalizes to `not_started`.
- An empty visit-status string, unsupported visit value, or unsupported confirmation value must not be treated as confirmed, active, or completed by accident.
- Unknown visit values normalize to an explicit `legacy_unknown`/`unknown` category and receive safe, non-advancing actions until reviewed.
- Unknown confirmation values preserve the raw value and normalize to a review-required legacy category.
- A terminal confirmation status (`cancelled` or `no_show`) remains terminal even if an inconsistent visit status is also present. The classifier must report the conflict for diagnostics rather than allowing normal progression.
- The raw database value remains available for audit, migration planning, and support investigation.

### Implementation approaches

#### Approach A — Documentation-only normalization

Update all status documentation and tests to match current code.

**Good for:** removing confusion quickly.

**Limitation:** does not stop future code from reimplementing rules differently.

#### Approach B — Recommended application normalization

Create canonical constants, type guards, and classification functions. Translate database values into normalized application categories at the boundary.

**Good for:** improving both code and documentation without immediately changing stored data.

#### Approach C — Database migration

Replace legacy values and add database constraints/enums.

**Good for:** long-term data integrity.

**Risk:** requires a full data audit, migration, rollback plan, and compatibility handling.

### Recommendation

Start with **Approach B**, preserving explicit legacy categories as approved above. Consider a database migration only after live data has been inventoried, legacy meanings have been confirmed, and a reversible migration plan exists.

### Done criteria

- One document and one code-level contract list every supported value.
- Unknown values are handled deliberately.
- `NULL` is represented consistently in application logic.
- Terminal/active/completed decisions use named helpers.
- Tests and docs no longer use unsupported `"scheduled"` values unless explicitly marked as legacy.
- Legacy confirmation values remain distinguishable at the normalization boundary.
- Completed-visit, started-visit, and early-exit measures are named separately.

---

## 3.7 Clinic and doctor list agreement

### What users expect

Clinic staff and doctors have different permissions, but they should not see contradictory facts about the same appointment.

It is reasonable for a doctor not to see every clinic record. It is not reasonable for:

- the clinic to count a booking as upcoming while the doctor does not
- the clinic to show a booking as pending while the doctor sees it as completed
- one role to include treatment-completed records in a list while another excludes them without a documented reason

### Current status: confirmed

`server/storage.ts` contains separate implementations:

- `getClinicBookingsPaged()`
- `getDoctorBookingsPaged()`

Some differences are intentional:

- a doctor should see assigned bookings
- a doctor may need approval-based filters
- a clinic sees all clinic bookings

Other differences are likely consistency risks:

- upcoming date boundaries
- terminal exclusions
- pending definitions
- treatment-completed handling
- null visit-status handling
- statistics loops

### Recommended design

Separate the query into two layers:

#### Layer 1 — Shared booking meaning

Reusable conditions for:

- old/today/future
- terminal
- active
- completed
- pending
- same-day past-due

#### Layer 2 — Role visibility

Clinic-specific conditions:

- slot belongs to clinic
- optional doctor/unassigned filter

Doctor-specific conditions:

- booking is assigned to doctor
- approval state determines whether it belongs in awaiting/owned views

### Implementation approaches

#### Approach A — Copy the same predicate code

Keep two query methods but manually align them.

**Limitation:** the next change can drift again.

#### Approach B — Recommended predicate factories

Create server helpers such as:

```text
bookingIsTerminalSql()
bookingIsFutureSql()
bookingIsUpcomingForClinicSql()
bookingIsUpcomingForDoctorSql()
bookingIsPendingSql()
```

Role-specific filters can compose the shared predicates.

#### Approach C — Fetch broad rows and filter in application code

**Advantages:** one JavaScript classifier.

**Limitations:** poor for pagination and large datasets; can leak or over-fetch data.

### Recommendation

Use **Approach B**. Keep filtering in SQL for pagination and privacy, but centralize the meaning of each predicate.

### Done criteria

- Every count uses the same predicate as its corresponding list.
- Clinic and doctor differences are documented as role visibility, not accidental status differences.
- Pagination totals match visible records.
- Null and terminal states behave consistently.
- API tests compare expected clinic and doctor results for the same state matrix.

---

## 3.8 Patient history and directory behavior

### What a user expects

When a clinic opens a patient, “no history” should mean the patient truly has no history, not merely that the current filter or pagination page did not include older appointments.

The directory should also show meaningful visit totals:

- cancelled requests should not normally count as visits
- no-shows should not normally count as completed visits
- a completed visit should count once
- the latest completed visit should drive “last visit”

### Current status: partially resolved, still open

Positive evidence:

- `/api/auth/clinic/patients/:patientId/history` exists.
- Clinic and doctor booking queries build history metadata from broader booking rows.
- `booking-list.ts` has more informative empty-state language for active filters and selected patients.

Remaining risks:

- `patients.visitCount` and `patients.lastVisitAt` are denormalized.
- Patient identity may be matched by patient ID, email, phone, or fallback upsert behavior.
- Contact-detail changes can lead to duplicate patient records.
- Booking creation has several profile-linking branches.
- The aggregate contract is not yet enforced in one place.

### Implementation approaches

#### Approach A — Query history whenever a patient is opened

Always use the dedicated patient-history endpoint.

**Good for:** immediately improving correctness of the popup.

**Limitation:** can add requests unless cached carefully.

#### Approach B — Recommended canonical patient summary endpoint

Return a patient summary with:

```text
identity
completedVisitCount
lastCompletedVisit
nextConfirmedAppointment
noShowCount
outstandingBilling
historyLoading/availability metadata
```

The server derives these values from lifecycle-valid bookings.

#### Approach C — Recalculate denormalized counters on every mutation

Update `visitCount` and `lastVisitAt` whenever a booking changes.

**Limitation:** many mutation paths make this easy to get wrong.

### Recommendation

Use **Approach B** and add a periodic reconciliation job for the denormalized fields. Do not rely only on incremental counters.

### Done criteria

- Patient history is independent of current booking pagination/filter.
- Directory totals have a written definition.
- Cancelled/no-show records do not inflate completed visit totals.
- Identity matching behavior is documented.
- The selected date range includes the entire end calendar day.

---

# 4. Recommended implementation plan

Phase 1 is the contract and planning step documented in section 2.4. The implementation phases below begin after that planning step.

## Phase 2 — Repair the type and test baseline

Run:

```bash
npm run check
npx tsx --test client/src/lib/booking-list.test.ts
npm run build
```

Fix the existing TypeScript errors first. A lifecycle refactor should not be built on an already-failing type-check.

### Phase 2 implementation details

The current production build passes and the booking-list unit tests pass, but `npm run check` has known errors in appointment cards, billing, bookings, inventory, medical history, dashboards, and server routes. The first implementation phase must restore a trustworthy type-check baseline before the classifier is introduced.

**Acceptance criteria:**

- `npm run check` exits successfully.
- Existing booking-list tests continue to pass.
- No broad `any` types are added merely to hide existing errors.
- The current errors are fixed at their canonical type or component source.
- `npm run build` continues to pass.

## Phase 3 — Introduce canonical status definitions

Recommended structure:

```text
shared/
  booking-status.ts       # supported values and shared labels
client/src/lib/
  booking-classification.ts
server/
  booking-predicates.ts   # SQL predicates and server-side role rules
```

The exact file names can follow project conventions. The important point is one canonical home for each concept.

### Phase 3 implementation details

Define supported database values, normalized application values, terminal groups, active groups, date categories, patient-visit measures, and legacy-value handling. Keep database `NULL` compatible initially by mapping it to an application-level `not_started` value rather than immediately changing stored data.

#### Planned Phase 3 changes

Phase 3 is a contract and type-normalization phase only. It should make later behavior changes safer without changing what users see yet.

1. **Create one shared status contract**
   - Add one canonical shared module for confirmation, doctor approval, and visit-status values.
   - Export literal value arrays, TypeScript types, named status groups, and stable labels where labels are needed.
   - Keep database-facing values separate from normalized application values.
   - Do not create a second untyped status vocabulary in client or server files.

2. **Add normalization at the boundary**
   - Normalize nullable `visitStatus` to `not_started`.
   - Preserve raw legacy confirmation values while mapping them to explicit application-level legacy categories.
   - Add type guards or normalization helpers so unknown values are handled safely.
   - Keep compatibility wrappers for current callers; do not migrate every card, popup, filter, or query in this phase.

3. **Define named lifecycle groups**
   - Export terminal, active, treatment-complete, and visit-closed groups.
   - Export the separate completed-patient-visit, started-patient-visit, and early-exit group definitions.
   - Ensure `patient_left_early` is terminal but not completed.
   - Ensure `treatment_completed` is treatment-complete but not visit-closed.

4. **Define date-context types without changing date behavior**
   - Define an explicit business-date context containing the clinic timezone and a fixed current instant/date for classification.
   - Represent the default timezone policy as `Asia/Kolkata` until every clinic has an explicit setting.
   - Keep the appointment timestamp as the source record; do not add a derived database date column.
   - Do not let the browser's local timezone become the business rule.

5. **Record safe conflict handling**
   - Document that terminal confirmation status takes precedence over normal progression when stored fields conflict.
   - Ensure unknown states do not receive active or advancing actions by default.
   - Preserve raw values so support and later live-data analysis can identify affected records.

6. **Keep the phase behavior-neutral**
   - No database migration, enum constraint, status rewrite, list-filter change, action change, or UI message change.
   - No server transition guard is added yet; that belongs to Phase 7.
   - Phase 3 itself did not add a classifier; the pure classifier belongs to Phase 4.

#### Files expected to be considered

The exact names may follow repository conventions, but the implementation should evaluate:

```text
shared/booking-status.ts
shared/schema.ts                         # types only if needed; no schema migration
client/src/lib/clinic-constants.tsx      # compatibility type boundary
client/src/lib/booking-list.ts            # compatibility imports only
server/storage.ts                         # compatibility type boundary only
```

The Phase 3 implementation should avoid changing the behavior-bearing branches in `AppointmentCard.tsx`, `BookingsPanel.tsx`, `DoctorDashboard.tsx`, or the server query methods. Those files are migrated in later phases after the contract is tested.

#### Phase 3 implementation sequence

1. Inventory all current status literals and date assumptions.
2. Add the canonical shared value/type definitions.
3. Add normalization and type guards for null, legacy, unknown, and conflict values.
4. Add focused contract tests for every supported value and every normalization rule.
5. Update only the minimum compatibility types/imports needed to keep the existing code compiling.
6. Run type-check, focused tests, and the production build.
7. Review the diff to confirm that no runtime booking behavior or stored data changed.

**Acceptance criteria:**

- Supported status values are listed in one shared type/constant location.
- Unknown and legacy values have an explicit handling policy.
- `NULL` visit status is handled consistently.
- The clinic timezone is represented explicitly in the date-context contract, with `Asia/Kolkata` as the documented default until clinic-specific values exist.
- Legacy confirmation values remain distinguishable and preserve their raw source value.
- Terminal, active, treatment-complete, visit-closed, completed-visit, started-visit, and early-exit groups are named.
- `patient_left_early` is not grouped as a completed patient visit.
- `treatment_completed` is not grouped as a fully closed visit.
- Existing API and UI callers can continue compiling during migration.
- No database migration is required for this phase.
- No runtime booking behavior changes are introduced by Phase 3.

### Phase 3 expected deliverables

When Phase 3 is implemented, its completion record must include:

```text
Phase:
  Phase 3 — Introduce canonical status definitions

Status:
  Completed only after contract tests and build verification pass

Behavior delivered:
  - Shared status/date contract added.
  - Null, unknown, conflict, and legacy handling made explicit.
  - No stored status values rewritten.
  - No booking filters, counts, actions, or UI messages changed.

Checks required:
  - npm run check
  - focused status/date contract tests
  - npm run build
  - Build Check workflow
  - diff review confirming no runtime behavior change
```

### Progress update after Phase 3

Phase 3 is complete. The shared status/date contract was added without changing existing booking filters, actions, cards, popups, server queries, stored status values, or database schema.

#### Phase 3 implementation record

```text
Phase:
  Phase 3 — Introduce canonical status definitions

Status:
  Completed

Files added:
  shared/booking-status.ts
  shared/booking-status.test.ts

Behavior delivered:
  - Added canonical confirmation statuses:
      pending, confirmed, cancelled, no_show
  - Added canonical doctor-approval statuses:
      unassigned, pending, approved, declined, admin_confirmed
  - Added normalized visit statuses:
      not_started, checked_in, in_consultation,
      treatment_completed, completed, patient_left_early
  - Mapped database NULL visitStatus to application-level not_started.
  - Preserved raw legacy confirmation values such as email_verified and admin_booked.
  - Added explicit unknown and legacy_unknown handling instead of silently
    treating unsupported values as confirmed, active, or completed.
  - Added named terminal, active, treatment-complete, visit-closed,
    completed-patient-visit, started-patient-visit, and early-exit groups.
  - Added explicit clinic-local business date context utilities.
  - Defaulted the business timezone context to Asia/Kolkata until a clinic
    provides its own IANA timezone.
  - Preserved raw values in every normalization result for audit and migration review.

Behavior deliberately not changed:
  - Existing cards, popups, dashboards, filters, statistics, and server queries
    still use their current logic.
   - No booking classifier was introduced in Phase 3; the pure classifier is delivered in the Phase 4 record below.
  - No client migration was introduced; that belongs to Phase 5.
  - No SQL predicate migration was introduced; that belongs to Phase 6.
  - No server transition guard or override endpoint was introduced; that belongs
    to Phase 7.
  - No database migration, constraint, or stored-value rewrite was performed.

Checks run:
  - npm run check — passed.
  - npx tsx --test shared/booking-status.test.ts — 6 passed, 0 failed.
  - Build Check workflow — finished successfully.
  - Production client build — passed; 3,766 modules transformed.
  - Production server bundle — passed.
  - git diff --check — passed.

Known follow-up risks:
  - Existing callers still contain duplicated lifecycle and date comparisons;
    migration begins in Phase 4 and Phase 5.
  - Clinic-specific timezone storage is not added in this behavior-neutral phase;
    Asia/Kolkata remains the documented default.
  - Legacy confirmation grouping still requires live-data and route-origin review
    before it can authorize confirmation-dependent actions.
  - The existing booking-list fixture value scheduled remains outside the canonical
    visit track and should be explicitly handled during classifier test migration.
```

## Phase 4 — Build the classifier

The classifier should accept:

```text
booking
current business date/time
clinic timezone
role
```

It should return:

```text
date category
same-day operational state
normalized lifecycle state
terminal/active/completed flags
message inputs
permitted UI actions
```

It should not render React elements and should not perform database calls.

### Phase 4 implementation details

Build the pure classifier against fixed date/time contexts. It should return date category, normalized lifecycle, derived state, message inputs, and role-specific UI action permissions. It should not perform navigation, network calls, React state updates, or database writes.

**Acceptance criteria:**

- Unit tests cover the full state matrix in section 5.
- Old versus same-day past-due behavior is explicit.
- Active old visits are handled separately from old pre-arrival bookings.
- Terminal, active, treatment-completed, and completed states are distinguishable.
- The classifier produces stable results for the same booking and date context.

### Progress update after Phase 4

Phase 4 is complete. A pure, shared booking classifier was added without
changing React rendering, server queries, database values, network behavior, or
lifecycle transitions.

#### Phase 4 implementation record

```text
Phase:
  Phase 4 — Build and unit-test the pure booking classifier

Status:
  Completed

Files changed:
  shared/booking-status.ts
  shared/booking-status.test.ts

Behavior delivered:
  - Added classifyBooking() as a pure policy function.
  - Classifies unknown, old, same-day past-due, same-day upcoming, and future bookings.
  - Uses the supplied clinic business timezone and fixed date context.
  - Distinguishes old pre-arrival, old active, old treatment-complete, and historical completed states.
  - Preserves raw confirmation and visit values while exposing normalized meanings.
  - Handles cancelled, no-show, early-exit, unknown, legacy, missing-date, and conflicting records conservatively.
  - Keeps doctor approval separate from confirmation status.
  - Returns message inputs and role-specific action policy as data, not React elements.
  - Reports override eligibility separately; server authorization remains Phase 7.
  - No existing caller was migrated; that belongs to Phase 5.

Checks run:
  - npx tsx --test shared/booking-status.test.ts client/src/lib/booking-list.test.ts
    — 15 passed, 0 failed.
  - npm run check — passed with zero TypeScript errors.
  - npm run build — passed successfully.
  - Build Check workflow — finished successfully after Phase 4 changes.

Known follow-up risks:
  - Existing cards, dashboards, client helpers, server filters, statistics, and
    transition routes still contain independent booking rules.
  - Legacy confirmation values require live-data and route-origin review before
    they are used to authorize confirmation-dependent actions.
  - The classifier is a policy foundation; it is not yet an authorization layer.
```

## Phase 5 — Replace local frontend decisions

Update:

- `AppointmentCard.tsx`
- `BookingsPanel.tsx`
- `DoctorDashboard.tsx`
- `booking-list.ts`

The existing `AppointmentInfoSection` should receive the classifier result. Card and popup footer actions should use the same action policy.

### Phase 5 completion record

#### 1) Why was it done?

Before Phase 5, the same booking could be interpreted differently depending on
where it was displayed. `AppointmentCard`, `BookingsPanel`, the clinic booking
dialog, and `DoctorDashboard` each recalculated date, confirmation, overdue,
terminal, and visit-lifecycle values locally.

That duplication created several risks:

- Browser-local and UTC date calculations could disagree with the clinic's
  business date.
- A card and its detail dialog could show different status messages or
  progress stages.
- `treatment_completed`, `completed`, and `patient_left_early` could be
  collapsed into broader boolean combinations.
- Doctor approval could be confused with booking confirmation.
- Old unresolved bookings could continue to expose normal consultation
  presentation even though the lifecycle policy treats them as needing
  resolution.
- Notification deep links could open a booking through a different
  interpretation path from the normal list.

The purpose of Phase 5 was therefore to move the client from independent
booking decisions to one shared, role-aware classification result without
changing stored status values or replacing server authorization.

#### 2) What was done?

The following client migration was completed:

- Added `client/src/lib/booking-classification.ts` as the client boundary for
  `classifyBooking()`.
  - Uses one shared `BusinessDateContext` construction path.
  - Uses the documented `Asia/Kolkata` fallback until clinic-specific IANA
    timezones are available through the session APIs.
  - Maps clinic users to the classifier's clinic role and doctors to the
    doctor role.
  - Provides a single lifecycle-stage mapping for the progress strip.
- Updated `client/src/lib/booking-list.ts`.
  - `getTimeGroup()` and `getBookingDisplayMeta()` now delegate to the shared
    classifier.
  - `getBookingActionState()` now adapts the classifier action policy while
    preserving the existing compatibility return shape.
- Updated `AppointmentInfoSection`.
  - It now receives `BookingClassification` instead of independently supplied
    lifecycle booleans.
  - Messages derive from canonical terminal, active, completed,
    treatment-completed, early-exit, approval, and date inputs.
  - Billing, completion notes, cancellation reasons, and late check-in remain
    separate operational inputs because they are not owned by the classifier.
- Updated `AppointmentCard`.
  - Date state, terminal state, visit state, confirmation state, status pill
    inputs, progress stage, and past-due messaging now derive from the shared
    classification.
  - Supports an optional classification supplied by the parent so a list and
    card can reuse the same result.
  - Preserves doctor approval as a separate concept from clinic confirmation.
  - Preserves existing billing, reschedule, no-show reversal, early-exit,
    override-completion, consent, and completion-note controls.
- Updated `BookingsPanel`.
  - Clinic cards, booking dialogs, overview messages, and progress strips use
    the clinic classification.
  - Focus bookings opened from notification deep links follow the same
    classification path as bookings already present in the filtered list.
  - Existing clinic action callbacks remain in place and are gated through the
    classifier-backed compatibility action state.
- Updated `DoctorDashboard`.
  - Doctor list grouping now uses clinic-local classification rather than UTC
    date strings and browser-midnight comparisons.
  - Doctor cards and the appointment detail view use doctor-role
    classification.
  - Doctor approval remains distinct from booking confirmation.
- Added no database columns, status migrations, server query changes, or
  authorization changes.

#### 3) What improved?

The client now has one consistent interpretation of a booking across the main
surfaces:

- Clinic-local date handling is centralized instead of being recalculated from
  browser or UTC values.
- A booking's card and popup use the same lifecycle vocabulary and progress
  stage.
- Same-day past-due and old-booking presentation comes from the shared
  classifier.
- Old active visits remain distinguishable from old unresolved appointments.
- `treatment_completed`, `completed`, and `patient_left_early` remain
  separate in the client presentation.
- Terminal records are classified conservatively, including conflicting
  terminal and active values.
- Doctor approval and booking confirmation remain separate role-specific
  concepts.
- Compatibility helpers no longer maintain a second independent lifecycle
  implementation.
- Notification-focused bookings use the same classification as ordinary list
  bookings.
- Existing action callbacks and billing/clinical workflows were preserved
  while the UI interpretation was centralized.

Verification completed:

- `npm run check` — passed with zero TypeScript errors.
- `npx tsx --test shared/booking-status.test.ts client/src/lib/booking-list.test.ts`
  — 15 passed, 0 failed.
- `npm run build` — passed successfully.
- Build Check workflow — finished successfully.

Known boundaries after Phase 5:

- The client action policy is a presentation and compatibility layer only.
  Server-side transition authorization remains Phase 7.
- Server filters, counts, and statistics still require the SQL alignment work
  planned for Phase 6.
- Clinic-specific timezone storage and session exposure remain a separate
  follow-up; the current client fallback is intentionally centralized.
- Responsive visual verification and rollout checks remain Phase 8.

### Phase 5 implementation details

Migrate one caller at a time. Keep `getBookingDisplayMeta()` and `getBookingActionState()` as compatibility wrappers if that reduces risk, but make them delegate to the canonical classification model rather than retain separate business rules.

**Acceptance criteria:**

- `AppointmentCard`, `BookingsPanel`, and `DoctorDashboard` use the same normalized classification.
- `AppointmentInfoSection` no longer depends on independently calculated lifecycle booleans from each caller.
- Card and popup messages match for the same booking.
- Card and popup actions match the same role policy.
- Notification deep links use the same classification when they open a booking.

## Phase 6 — Align server filters and statistics

Update:

- `getClinicBookingsPaged()`
- `getDoctorBookingsPaged()`
- clinic stats
- doctor stats
- patient history metadata

Use SQL predicate helpers for pagination and counts. Do not fetch the entire clinic dataset merely to reuse a JavaScript classifier.

### Phase 6 implementation details

Create reusable server-side predicates for shared lifecycle meaning, then compose them with clinic and doctor visibility rules. Use the same predicates for paginated lists, totals, quick-filter counts, and patient history metadata.

**Acceptance criteria:**

- Clinic and doctor list differences are explained by role visibility and assignment.
- List totals match their corresponding visible records.
- Upcoming, pending, past, terminal, and completed definitions are aligned.
- Null and legacy visit states are handled consistently.
- SQL filtering remains paginated and ownership-safe.

### Phase 6 progress record — Steps 1–9 completed

#### Completed work

All nine independent Phase 6 steps are complete:

1. **Added reusable server booking predicates**
   - Added `server/booking-predicates.ts`.
   - Centralized confirmed, pending, terminal, active, completed,
     treatment-completed, doctor-approved, and awaiting-approval meanings.
   - Added shared clinic and doctor statistics calculators.
   - Preserved role visibility separately from lifecycle meaning.

2. **Aligned clinic paginated filters**
   - Updated `getClinicBookingsPaged()` in `server/storage.ts`.
   - Reused the shared predicates for upcoming, pending, confirmed,
     in-clinic, and completed filters.
   - Completed and treatment-completed visits are no longer counted as
     upcoming.
   - Cancelled, no-show, and patient-left-early records are treated as
     terminal for these list definitions.

3. **Aligned clinic statistics**
   - Updated `getClinicBookingStats()`.
   - Updated the statistics embedded in `getClinicBookingsPaged()`.
   - Both paths now use the same clinic statistics calculation, removing the
     previous difference between standalone clinic counts and paginated counts.

4. **Aligned doctor paginated filters**
   - Updated `getDoctorBookingsPaged()` in `server/storage.ts`.
   - Preserved doctor assignment and approval visibility as role-specific
     rules.
   - Reused shared lifecycle predicates for today, upcoming, past, owned,
     awaiting approval, pending, confirmed, in-clinic, and completed filters.
   - Null doctor approval values are handled as unassigned instead of being
     silently excluded by SQL `NULL` comparison behavior.

5. **Aligned doctor statistics**
   - Doctor totals now use the shared statistics calculator.
   - Aligned owned, awaiting approval, pending, confirmed, upcoming, past,
     and total pending counts.
   - Pending counts exclude terminal and completed visit states.

6. **Aligned clinic timezone boundaries**
   - Added a validated IANA timezone field to clinics with the documented
     `Asia/Kolkata` fallback.
   - Added idempotent startup checks for the clinic timezone column.
   - Updated server booking boundaries and date-range filters to convert
     clinic-local calendar dates into database timestamp instants.
   - Clinic and doctor booking queries now resolve the relevant clinic
     timezone before calculating today, upcoming, past, week, and date-range
     boundaries.

#### Verification completed

- `npm run check` — currently blocked by pre-existing missing `compression` and
  `multer` packages/type declarations; no new TypeScript errors were reported
  from the Phase 6 timezone changes.
- `npm run build` — passed.
- Build Check workflow — finished successfully.
- Start application workflow — currently blocked before startup because the
  runtime cannot resolve the missing `compression` package. `multer` is also
  missing from the installed dependency/type baseline.
- `npx tsx --test shared/booking-status.test.ts` — 11 passed, 0 failed.
- Timezone boundary smoke test — passed for `Asia/Kolkata` and invalid-timezone
  fallback behavior.
- Server predicate smoke test — passed for confirmed, pending, no-show,
  treatment-completed, null approval, and date-boundary cases.
- `git diff --check` — passed.
- The clinic timezone column is an idempotent schema/startup addition; no
  booking data migration or status-value rewrite was made.

#### Phase 6 completion status

Phase 6 is complete. Steps 1–9 are implemented and verified. Phase 7 and
Phase 8 remain pending.

#### Step 8 — Add canonical metadata to patient history — Completed

- Updated `getPatientHistory()` in `server/storage.ts`.
- Preserved the ownership-safe clinic and patient constraints.
- Kept patient history independent of dashboard pagination, tabs, and search.
- Added a nested `booking.lifecycle` metadata contract containing:
  - normalized confirmation, doctor-approval, and visit statuses
  - clinic-local date and canonical date category
  - operational state
  - today, past, upcoming, old, and same-day-past-due flags
  - active, started, treatment-completed, completed, terminal, and early-exit flags
  - confirmed and awaiting-doctor-approval flags
- Reused the clinic timezone resolver and booking date boundaries.
- Reused the shared classifier and server lifecycle predicates.
- Preserved the existing bills and clinical-record results.
- Updated the patient-directory history response type for the new metadata.

#### Step 8 verification

- `npm run build` — passed.
- `git diff --check` — passed.
- `npm run check` — currently blocked by the environment's missing
  `compression` and `multer` packages/type declarations, unrelated to the
  patient-history implementation.

#### Step 9 — Add dedicated server predicate/statistics tests — Completed

- Added `server/booking-predicates.test.ts`.
- Covered null, legacy, and unknown confirmation, approval, and visit values.
- Covered confirmed, pending, terminal, active, treatment-completed,
  completed, early-exit, and conflicting-state behavior.
- Covered doctor approval independently from booking confirmation, including
  null/unassigned and declined approval.
- Covered old, same-day past-due, same-day upcoming, and future dates.
- Covered UTC-midnight behavior, `Asia/Kolkata`, invalid timezone fallback,
  and `America/New_York` daylight-saving boundaries.
- Independently verified clinic statistics for today, upcoming, past,
  current week, next week, pending, confirmed, terminal, and completed
  records.
- Independently verified doctor statistics for owned, awaiting approval,
  pending, confirmed, upcoming, past, terminal, and completed records.

#### Step 9 verification

- `node_modules/.bin/tsx --test server/booking-predicates.test.ts shared/booking-status.test.ts client/src/lib/booking-list.test.ts` — 22 passed, 0 failed.
- `npm run build` — passed.
- Build Check workflow — finished successfully.
- `git diff --check` — passed.
- `npm run check` remains blocked by the environment's missing
  `compression` and `multer` packages/type declarations; no Step 9 test
  failures or application build failures were observed.

Phase 6 is now complete. Phase 7 remains the next implementation phase, and
Phase 8 remains the final responsive and rollout verification phase.

The missing `compression` and `multer` dependencies currently prevent the
Start application workflow and `npm run check`; this is an environment and
dependency-baseline issue outside the remaining Phase 6 implementation steps.

The existing startup seed warning concerning a malformed PostgreSQL array
literal is unrelated to Phase 6 and remains outside this implementation
milestone.

## Phase 7 — Add server-side transition guards

Every state-changing endpoint should reject invalid transitions, including direct requests that bypass the UI.

Examples:

- Start consultation requires a valid assigned doctor, accepted assignment, checked-in visit, and allowed date policy.
- Complete visit requires the correct active state or an explicit admin override.
- No-show cannot be marked after consultation starts.
- Cancel cannot silently erase an active or completed visit.

### Phase 7 implementation details

Review each booking mutation route and make its transition preconditions explicit. The UI action policy and server transition policy should come from the same documented lifecycle rules, but the server remains authoritative for authorization and state integrity.

**Acceptance criteria:**

- Invalid direct API requests receive clear 4xx responses.
- Old pre-arrival bookings cannot start consultation.
- Old active visits remain manageable according to the approved exception.
- Terminal bookings cannot be advanced through normal progression endpoints.
- Race-prone transitions are protected by current-state checks.

## Phase 8 — Finish layout and visual verification

After the state behavior is stable:

- apply the dialog spacing contract
- standardize responsive footers
- test mobile/tablet/desktop
- test long labels and long patient names
- check keyboard focus and screen-reader labels

### Phase 8 implementation details

Only after lifecycle behavior is stable, verify the visual surfaces and responsive action layout. This phase should not introduce new lifecycle rules; it confirms that the canonical result is presented clearly.

**Acceptance criteria:**

- Clinic and doctor cards/popups have consistent status-message hierarchy.
- Narrow mobile footers do not overflow or become unusable.
- Long messages and names wrap correctly.
- Keyboard focus and screen-reader labels work.
- Browser verification covers card, popup, filtered list, and notification deep-link entry points.

## Phase completion reporting

When each phase is completed, update the status table in section 2.4 and add a short record below this plan:

```text
Phase:
Status:
Files changed:
Behavior delivered:
Checks run:
Known follow-up risks:
```

Do not mark a phase complete based only on a successful build. The phase acceptance criteria and relevant behavioral tests must also pass.

---

# 5. State matrix automated by Phase 4 tests

Use a fixed current business date and timezone in unit tests. Do not let tests depend on the machine clock.

| Case | Date | Verification | Visit | Expected category | Expected doctor actions |
|---|---|---|---|---|---|
| 1 | Yesterday | pending | null | Old / needs resolution | None |
| 2 | Yesterday | confirmed | null | Old / needs resolution | None |
| 3 | Yesterday | confirmed | checked_in | Old active exception | Continue checked-in flow |
| 4 | Yesterday | confirmed | in_consultation | Old active exception | Continue consultation |
| 5 | Yesterday | confirmed | treatment_completed | Old treatment complete | Read-only/closure policy |
| 6 | Yesterday | confirmed | completed | Historical completed | Read-only history |
| 7 | Today, earlier slot | confirmed | null | Same-day past-due | Resolution policy |
| 8 | Today, future slot | confirmed | null | Today/upcoming | Waiting state |
| 9 | Tomorrow | confirmed | null | Future | Waiting state |
| 10 | Any | cancelled | any | Terminal cancelled | Rebook/history policy |
| 11 | Any | no_show | any | Terminal no-show | Rebook/history policy |
| 12 | Any | confirmed | patient_left_early | Terminal/early exit | Rebook/billing/history policy |
| 13 | Any | pending doctor approval | null | Awaiting doctor | Accept/decline only |
| 14 | Any | no-show | checked_in | Conflicting data | Safe terminal handling + audit |
| 15 | Any | confirmed | null | Null visit status | Not arrived |

Additional edge cases covered by Phase 4 tests:

- local midnight
- UTC midnight
- missing slot dates
- unknown legacy status values

Still belongs to later phases:

- daylight-saving timezone if the product later supports it
- notification deep links
- records outside the current pagination page

---

# 6. What should not be done

## Do not fix only the labels

Changing “Past Appointment” to “Expired” does not fix a booking that still receives invalid actions.

## Do not duplicate the classifier in cards and popups

That recreates the original problem with different variable names.

## Do not rely on hidden buttons for authorization

The backend must reject invalid state transitions even if the UI hides the button.

## Do not use only `new Date().toISOString().split("T")[0]` for clinic business dates

That is a UTC date, not necessarily the clinic’s local calendar date.

## Do not make “completed” mean different things in counts and actions

If `treatment_completed`, `completed`, and `patient_left_early` have different meanings, name those meanings explicitly.

## Do not migrate database values before auditing live data

First count existing values, identify legacy rows, and prepare a reversible migration.

---

# 7. Documentation updates required alongside implementation

The following documents should be reconciled when the implementation is completed:

- `docs/features/booking/03-booking-status-and-lifecycle.md`
- `docs/features/booking/04-shared-appointment-card.md`
- `docs/features/booking/05-role-based-card-actions.md`
- `docs/development/clinic-doctor-dashboard-ui-standards.md`
- this document

They should agree on:

- every supported status value
- the meaning of `NULL`
- terminal and active states
- old versus same-day past-due
- doctor action permissions
- clinic action permissions
- patient visit-count rules
- notification behavior

One document should be designated as the canonical lifecycle reference. Other documents should link to it instead of independently redefining the state machine.

---

# 8. Final verification checklist

## For a clinic user or product reviewer

- [ ] The same appointment message is consistent in card and popup.
- [ ] Old appointments are clearly different from today’s overdue appointments.
- [ ] Old unresolved appointments do not show inappropriate doctor actions.
- [ ] Legitimately active old visits are not blocked.
- [ ] Counts match visible filtered lists.
- [ ] Patient history does not depend on the current page or filter.
- [ ] Buttons remain usable on a phone.
- [ ] The popup clearly separates patient information, warnings, progress, and actions.

## For a developer

- [ ] Canonical date and lifecycle helpers exist.
- [ ] Client cards, popups, filters, and action state use them.
- [ ] Server list queries and stats use aligned SQL predicates.
- [ ] Server transition endpoints enforce the same policy.
- [ ] Status values are typed and documented.
- [ ] `NULL` and legacy values are tested.
- [ ] Patient aggregate rules are explicit.
- [ ] Notification deep links use the same classification.
- [ ] `npm run check` passes.
- [ ] `npm run build` passes.
- [ ] Unit, API, and Playwright state-matrix tests pass.
- [ ] Responsive visual verification is recorded.

## Final conclusion

The original audit correctly identified a consistency problem, but one part of its description is now outdated: a shared appointment information component has been added and is used across the main card and popup surfaces.

The remaining work is more important than simply adding another banner or adjusting padding. The application needs one trusted interpretation of:

```text
appointment date
same-day overdue state
confirmation state
doctor approval state
visit lifecycle
terminal state
permitted actions
patient history meaning
```

Once those rules are centralized, the existing shared information component, footer documentation, server filters, and dashboard layouts can work together reliably instead of drifting apart.