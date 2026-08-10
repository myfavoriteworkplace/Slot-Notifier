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

- `docs/features/booking-status-guide.md`
- `docs/features/appointment-card-footer.md`
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

The existing `docs/features/appointment-card-footer.md` gives a detailed lifecycle button policy, but it does not prove that every rendered footer is responsive at every breakpoint.

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
| Patient left early | Left early | Rebook, billing, and history access as permitted |

### Important rule

Old date alone should not override a visit that has already started. The system must distinguish:

- **old pre-arrival appointment:** stale operational work
- **old active visit:** legitimate in-progress exception
- **old completed visit:** historical record

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
- `docs/features/booking-status-guide.md` and `docs/development/clinic-doctor-dashboard-ui-standards.md` do not describe exactly the same visit-status set or transition behavior.

### Recommended canonical model

Keep the database fields separate, but define one canonical interpretation:

#### Confirmation track

```text
pending
confirmed
cancelled
no_show
```

Legacy values such as `email_verified` and `admin_booked` can remain stored if needed, but the application should map them to the user-facing `pending` meaning.

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

Start with **Approach B**, then consider Approach C only after the live data has been inventoried.

### Done criteria

- One document and one code-level contract list every supported value.
- Unknown values are handled deliberately.
- `NULL` is represented consistently in application logic.
- Terminal/active/completed decisions use named helpers.
- Tests and docs no longer use unsupported `"scheduled"` values unless explicitly marked as legacy.

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

## Phase 0 — Confirm the contract

Before editing behavior, agree on:

1. Which timezone defines a clinic’s business day.
2. Whether old checked-in visits remain actionable.
3. Whether `treatment_completed` is read-only or still requires clinic action.
4. Whether `patient_left_early` is terminal for every list and count.
5. What counts as a patient visit.
6. Whether `email_verified` and `pending` remain separate internally.

Write these decisions into the status guide before implementation begins.

## Phase 1 — Repair the type and test baseline

Run:

```bash
npm run check
npx tsx --test client/src/lib/booking-list.test.ts
npm run build
```

Fix the existing TypeScript errors first. A lifecycle refactor should not be built on an already-failing type-check.

## Phase 2 — Introduce canonical status definitions

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

## Phase 3 — Build the classifier

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

## Phase 4 — Replace local frontend decisions

Update:

- `AppointmentCard.tsx`
- `BookingsPanel.tsx`
- `DoctorDashboard.tsx`
- `booking-list.ts`

The existing `AppointmentInfoSection` should receive the classifier result. Card and popup footer actions should use the same action policy.

## Phase 5 — Align server filters and statistics

Update:

- `getClinicBookingsPaged()`
- `getDoctorBookingsPaged()`
- clinic stats
- doctor stats
- patient history metadata

Use SQL predicate helpers for pagination and counts. Do not fetch the entire clinic dataset merely to reuse a JavaScript classifier.

## Phase 6 — Add server-side transition guards

Every state-changing endpoint should reject invalid transitions, including direct requests that bypass the UI.

Examples:

- Start consultation requires a valid assigned doctor, accepted assignment, checked-in visit, and allowed date policy.
- Complete visit requires the correct active state or an explicit admin override.
- No-show cannot be marked after consultation starts.
- Cancel cannot silently erase an active or completed visit.

## Phase 7 — Finish layout and visual verification

After the state behavior is stable:

- apply the dialog spacing contract
- standardize responsive footers
- test mobile/tablet/desktop
- test long labels and long patient names
- check keyboard focus and screen-reader labels

---

# 5. State matrix that should become automated tests

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

Add tests for:

- local midnight
- UTC midnight
- daylight-saving timezone if the product later supports it
- missing slot dates
- unknown legacy status values
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

- `docs/features/booking-status-guide.md`
- `docs/features/appointment-card-footer.md`
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