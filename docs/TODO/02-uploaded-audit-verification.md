# 2. Verification of uploaded audit observation

## Source

`attached_assets/Pasted-Audit-completed-no-application-code-changed-I-found-tha_1786372797835.txt`

The uploaded note identified a consistency problem around booking messages, date classification, lifecycle states, dashboard filters, doctor actions, patient history, and responsive footers. The current codebase has evolved since that note was written, so the findings below classify the current status.

## 2.1 Shared appointment information messages

**Uploaded claim:** no shared `AppointmentInfoSection` existed; card and popup messages were implemented separately.

**Current status: Partially resolved / stale as written.**

`client/src/components/AppointmentInfoSection.tsx` now exists and is imported by:

- `client/src/components/AppointmentCard.tsx`
- `client/src/components/BookingsPanel.tsx`
- `client/src/pages/DoctorDashboard.tsx`

The shared component receives normalized-looking booleans such as `isPastDue`, `isCancelled`, `isNoShow`, `isVisitCompleted`, `isTreatmentCompleted`, `isInConsultation`, and billing counts. It renders common banners and has an expandable compact presentation.

The centralization is not complete because callers still calculate those booleans independently. A shared presentation component prevents message markup drift, but it does not yet guarantee shared classification semantics.

**Remaining TODO:** introduce a canonical booking view-model/classification helper and make all three callers consume it.

## 2.2 Popup spacing

**Uploaded claim:** clinic popup spacing had nested padding and weak separation before the information area.

**Current status: Needs visual/runtime verification.**

The shared information section has consistent internal spacing and a compact/expanded state. Source inspection alone does not prove that the clinic and doctor dialogs have equivalent outer spacing across Overview, Notes, Clinical, Billing, and Documents tabs. The current type-check failure also prevents treating the UI baseline as clean.

**Remaining TODO:** perform a responsive visual pass at narrow mobile, tablet, and desktop widths after the type-check baseline is repaired.

## 2.3 Responsive footers

**Uploaded claim:** fixed horizontal groups could become cramped or overflow.

**Current status: Still open / partially addressed.**

The codebase contains several multi-action doctor and clinic footer branches. The audit source identified long labels and three-action consultation states as risk cases. Search results still show explicit action groups in `AppointmentCard.tsx`, `BookingsPanel.tsx`, and `DoctorDashboard.tsx`; source inspection does not establish that every group uses a consistent responsive grid/wrap policy.

**Remaining TODO:** define one footer layout policy and test:

- one action on narrow mobile
- two actions at small tablet
- three actions only at a safe desktop breakpoint
- long patient names and long confirmation text
- terminal/rebook states

## 2.4 Old-booking logic

**Uploaded claim:** old means previous calendar date; same-day past-due is separate.

**Current status: Still open.**

Positive evidence:

- `client/src/lib/booking-list.ts` distinguishes previous calendar dates from today for list grouping.
- `server/storage.ts` uses a client-supplied `todayDate` to keep a session’s date boundary stable across requests.
- Clinic and doctor server filters use `startOfDay`, `endOfDay`, and explicit tomorrow boundaries.

Remaining inconsistency:

- `getBookingActionState()` in `client/src/lib/booking-list.ts` does not accept or calculate old-booking state.
- `AppointmentCard.tsx`, `BookingsPanel.tsx`, and `DoctorDashboard.tsx` calculate related state locally.
- Some calculations use `new Date()` or `Date.now()` directly.
- `DoctorDashboard.tsx` has historically used UTC date derivation in parts of its logic; every current call site should be rechecked against the local-date policy.
- Same-day past-due and previous-day old states are not represented by one canonical type.

**Remaining TODO:** define canonical local calendar helpers and use them in client filters, cards, dialogs, stats, and action guards.

## 2.5 Old checked-in doctor booking actions

**Uploaded claim:** old checked-in records could expose active doctor controls; recommended policy preserves active/completed exceptions.

**Current status: Still open / needs matrix testing.**

Doctor action branches are still present in `DoctorDashboard.tsx` and the card action branches in `AppointmentCard.tsx`. The code searches show controls such as Start Consultation, View Notes, Add Observation, Done with Patient, and Issue Rx. The current shared `getBookingActionState()` does not include old date state, so it cannot enforce the recommended policy by itself.

The desired policy should be made explicit:

| Booking state | Recommended behavior |
|---|---|
| Old, pre-arrival | Expired/needs resolution; no consultation controls |
| Old, checked in | Preserve active exception; allow only appropriate continuation |
| Old, in consultation | Preserve active continuation |
| Old, treatment completed | Read-only completion state |
| Old, completed | Read-only history/summary |
| Cancelled/no-show/left early | Terminal state plus allowed rebook/resolution |

**Remaining TODO:** implement and test the matrix at card, popup, notification-opened, and filtered-list entry points.

## 2.6 Lifecycle status definitions

**Uploaded claim:** verification and visit status are independent and terminal definitions differ.

**Current status: Confirmed.**

`shared/schema.ts` defines:

- `verificationStatus`: pending-style states, confirmed, cancelled, no-show
- `visitStatus`: nullable field with checked-in, in-consultation, treatment-completed, completed, and patient-left-early values used in code

Current evidence of divergence:

- Some paths treat only `completed` as completed.
- Some filters also exclude `patient_left_early`.
- Doctor awaiting logic excludes `treatment_completed`, while other paths allow treatment-completed rows to remain visible.
- No-show is stored in `verificationStatus`, while previous visit state may be preserved separately.
- The client test fixture uses `visitStatus: "scheduled"`, a value not declared by the database comments or current lifecycle documentation.

**Remaining TODO:** publish a canonical lifecycle model, normalize legacy values, and use it for list filters, counts, messages, and actions.

## 2.7 Clinic and doctor list agreement

**Uploaded claim:** clinic and doctor APIs use different filters.

**Current status: Confirmed.**

`server/storage.ts` has separate implementations:

- `getClinicBookingsPaged()`
- `getDoctorBookingsPaged()`

They intentionally differ for doctor approval and assignment, but they also differ in upcoming boundaries, terminal exclusions, pending logic, and status filters. Their stats loops duplicate query semantics independently.

**Remaining TODO:** centralize reusable SQL predicates or a server-side booking classification service, while preserving role-specific visibility rules.

## 2.8 Patient history and directory

**Uploaded claim:** booking cards derived history from loaded rows; directory counters and date ranges could diverge.

**Current status: Partially resolved, still open.**

Positive evidence:

- The clinic API exposes `/api/auth/clinic/patients/:patientId/history`.
- `getClinicBookingsPaged()` and `getDoctorBookingsPaged()` build history metadata from broader query results rather than only the returned page.
- Empty-state copy in `booking-list.ts` distinguishes active filter hiding records from a patient having no bookings.

Remaining risks:

- Patient directory stores denormalized `visitCount` and `lastVisitAt`.
- Patient identity is linked through a mixture of patient ID, email, phone, and upsert behavior.
- Booking creation code still contains several fallback paths for profile linking.
- The audit’s recommendation to define valid visit aggregates remains unresolved.

**Remaining TODO:** define canonical patient identity and aggregate rules, then reconcile denormalized fields against lifecycle-valid bookings.

## 2.9 Recommended order from the uploaded audit

The original six-phase order remains sensible, with one addition:

1. Canonical booking state/date/action model
2. Backend filter/stat alignment
3. Shared message/view-model completion
4. Doctor and clinic action guards
5. Responsive footer/layout verification
6. Patient identity and aggregate reconciliation
7. Regression matrix and end-to-end coverage

The security and type-check blockers found in this broader audit should be handled before or alongside phase 1 because they reduce confidence in every lifecycle change.