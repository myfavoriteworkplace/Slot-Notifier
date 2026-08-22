# Reminder Module — Independent Implementation Plan and Progress

**Scope:** Upcoming appointment reminders for clinic admins and doctors, plus a
daily staff email digest  
**Status:** Planning complete; implementation not started  
**Last updated:** 2026-08-22  
**Related documentation:**

- [Booking overview and lifecycle](../features/booking/01-booking-overview-and-lifecycle.md)
- [Booking data model](../features/booking/02-booking-data-model.md)
- [Booking API and server contracts](../features/booking/11-booking-api-and-server-contracts.md)
- [Notification service](../notifications/notification-service.md)
- [Email design system](../notifications/email-design-system.md)

---

## 1. Purpose

The reminder module will help clinic staff and doctors see confirmed
appointments that are coming soon.

It has two separate parts:

1. **In-app reminders:** A calendar/reminder icon and panel in the clinic and
   doctor dashboards.
2. **Staff email digest:** One consistent daily email for the clinic and for
   doctors who have appointments.

This module is not intended to replace the existing notification bell or the
existing manual patient WhatsApp reminder action.

### Existing notification bell

The bell remains for events such as:

- New bookings
- Booking confirmation and approval events
- Cancellations
- Rescheduling
- Consent events
- Clinical updates
- No-show and completion events

### Existing patient reminder action

The clinic already has a manual booking reminder route:

```text
PATCH /api/auth/clinic/bookings/:id/send-reminder
```

That action sends a WhatsApp reminder to the patient. It is separate from this
staff-facing upcoming-appointment module and should not be changed as part of
this plan unless a future feature explicitly adds automated patient reminders.

---

## 2. Confirmed product decisions

These decisions are fixed for implementation.

| Question | Confirmed decision |
|---|---|
| What counts as confirmed by admin? | A booking is confirmed by admin when the admin confirms it. If an admin assigns a doctor and confirms the booking, that is an admin confirmation on behalf of the doctor. |
| Can a doctor confirm a booking? | Yes. A doctor can approve an appointment assigned to them. |
| Should doctor approval be treated as admin confirmation? | No. Doctor approval and admin confirmation are separate lifecycle facts, but both can make a booking eligible for the correct role’s reminder view when the role rules below are satisfied. |
| What does the clinic see? | All active, operationally confirmed appointments belonging to that clinic. |
| What does a doctor see? | Only appointments assigned to that doctor and approved by the doctor or confirmed by admin on that doctor’s behalf. |
| What does “Next 2 Days” mean? | Use the existing calendar-day model: today plus the next two calendar days. The UI should explain this clearly, or use the less ambiguous label “Next 3 Days.” |
| What does “Coming Week” mean? | Calendar days 3 through 7 after today. No appointment may appear in both sections. |
| What timezone is used? | The clinic’s configured timezone. Do not use the browser timezone or server timezone for grouping. |
| Should a clinic receive an email with zero appointments? | Yes. Send the clinic’s daily digest in the morning even when it contains zero appointments, so delivery is consistent. |
| Should a doctor receive an email with one appointment? | Yes. Send the doctor a daily digest consistently when the doctor has at least one appointment. |
| Should multiple doctors receive separate digests? | Yes. Each doctor receives only their own assigned appointments. |
| Should an admin’s personal email receive a digest? | No. Send only to the clinic email for the clinic digest. |
| What if a doctor is assigned after the digest was sent? | The doctor’s existing assignment email is sufficient for that event. The doctor receives the next normal consolidated daily digest as well. |
| What if clinic and doctor email addresses are identical? | Send only one email for that address, even if the recipient would otherwise qualify for both messages. |
| Should archived clinics receive digests? | No. Archived clinics are excluded. |
| Should inactive or expired subscription clinics receive digests? | No. Clinics whose subscription is inactive or expired are excluded. |
| Should patient free-text descriptions be emailed? | No by default. Descriptions may contain sensitive clinical information. The digest should use privacy-safe booking fields only. |
| Should reminders be stored in `notifications`? | No. The bell is event-oriented. Reminders are a live view calculated from current bookings. |

---

## 3. Reminder eligibility contract

The server must calculate reminder eligibility. The client must not decide
whether a booking is confirmed or visible to a user.

### 3.1 Common requirements

An appointment is eligible for an in-app reminder only when all of these are
true:

- The slot belongs to an existing clinic.
- The slot is not cancelled.
- The booking is operationally confirmed according to the role-specific rules.
- The booking is not cancelled.
- The booking is not a no-show.
- The visit is not completed.
- The visit is not marked `patient_left_early`.
- The appointment falls inside the clinic-local seven-calendar-day window.
- The booking is still assigned and valid for the requested role.

Billing, consent, clinical status, and patient history must not be used as
substitutes for confirmation or visit status.

### 3.2 Clinic reminder eligibility

The clinic reminder list is scoped to the authenticated clinic and includes
bookings that are confirmed by either:

- Admin confirmation; or
- A valid confirmation state already accepted by the clinic’s booking flow.

The implementation must reuse the shared booking predicates rather than
creating a second definition of confirmation.

The clinic list must include the assigned doctor when available and show
“Unassigned” when no doctor is assigned.

### 3.3 Doctor reminder eligibility

The doctor reminder list is scoped to the authenticated doctor and includes
only bookings:

- Assigned to that doctor.
- Belonging to the relevant clinic.
- Approved by that doctor; or
- Confirmed by admin on behalf of that assigned doctor.
- Not awaiting the doctor’s approval.
- Not terminal or completed.

A doctor must never receive another doctor’s appointments.

### 3.4 Date grouping

Use the existing timezone-aware booking boundary helpers.

Recommended response shape:

```text
{
  twoDay: ReminderBooking[],
  comingWeek: ReminderBooking[],
  totalCount: number,
  generatedAt: string
}
```

The actual property name may be changed if a clearer UI label is chosen, but
the two groups must be mutually exclusive.

---

## 4. Proposed user experience

### 4.1 Header control

Add a reminder/calendar icon beside the existing notification bell in:

- Clinic admin dashboard
- Doctor dashboard

The two controls must remain visually distinct:

- Bell badge: unread event notifications
- Reminder badge: active confirmed appointments in the next seven days

The reminder icon remains visible when the count is zero.

### 4.2 Reminder panel contents

Each reminder item should show:

- Patient name
- Date and time
- Treatment category or visit type
- Assigned doctor where relevant
- Clinic name/location where relevant
- A `Confirmed` status badge

Do not show patient email, phone, consent data, clinical records, billing
details, or free-text description unless a separate privacy decision approves
those fields.

### 4.3 Navigation

Clicking an item should open the existing booking detail/card flow. Do not
create a new appointment-detail implementation.

The navigation must work when:

- The booking is not on the current paginated page.
- The current filter would normally hide the booking.
- The booking changed or became ineligible between fetch and click.

In the latter case, refetch the booking and display the current state instead
of trusting stale reminder data.

### 4.4 Responsive behavior

- Desktop: use a popover or equivalent compact panel.
- Mobile: use a drawer/sheet with a safe viewport height.
- Keep each reminder row easy to tap.
- Use existing design tokens and touch-target rules.
- Do not make the reminder panel a second notification center.

---

## 5. Email digest contract

### 5.1 Delivery rules

The digest is a staff email, not a patient email.

| Recipient | When to send | Contents |
|---|---|---|
| Clinic email | Every morning for eligible, non-archived, active clinics, including zero appointments | All eligible clinic appointments for the next seven calendar days |
| Assigned doctor email | Every morning when that doctor has at least one eligible appointment | Only that doctor’s eligible appointments |
| Admin personal email | Never | Not part of the digest |

If clinic and doctor recipients resolve to the same normalized email address,
send only one email for that address.

An assignment email may notify a doctor immediately when a new assignment is
made. That event email is separate from the next daily consolidated digest.

### 5.2 Digest content

Use the existing email shell and design system:

1. BookMySlot header and logo.
2. Recipient-appropriate greeting.
3. Summary count.
4. Next 2/3 days section.
5. Coming Week section.
6. Appointment cards containing:
   - Patient name
   - Date and time
   - Treatment category or visit type
   - Assigned doctor
   - Clinic name and contact details where appropriate
7. “Open dashboard” button.
8. Existing automated-email footer.

Do not include free-text patient descriptions by default.

### 5.3 Zero-appointment clinic email

The clinic email must still be sent in the morning when there are no eligible
appointments. It should contain a clear empty state, for example:

> You have no confirmed appointments scheduled in the next seven days.

The clinic email should not include a fake appointment count or empty section
that looks broken.

Doctors do not need a zero-appointment digest unless a later product decision
requires that behavior.

---

## 6. Duplicate prevention and scheduling

### 6.1 Digest log

Email delivery needs a persistent database record. The planned record should
contain enough information to answer:

- Who was the recipient?
- Which role and clinic/doctor did the recipient represent?
- Which local digest date was sent?
- Which appointment IDs were included?
- Which digest version/template was used?
- When was it attempted and sent?
- Did delivery succeed or fail?

Recommended additional protection:

- A normalized recipient email.
- A digest content hash or stable appointment-ID set.
- A unique constraint or database lock for the same recipient/date/content.

### 6.2 Idempotency behavior

The digest job must be safe to run more than once.

- A server restart must not send a duplicate digest.
- Two scheduler invocations at the same time must not send duplicate digests.
- A changed appointment set may justify a new send only when the product rule
  allows it.
- A failed delivery must be recorded and retryable.
- A successful delivery must be recorded before the job reports completion.

### 6.3 Scheduler

The current application has event-triggered emails but no confirmed durable
recurring scheduler/worker suitable for production digest delivery.

Before implementing Phase 2, choose one:

1. An authenticated endpoint invoked by a managed scheduled job.
2. A single controlled worker process for a one-instance deployment.
3. Another durable scheduler approved for the deployment environment.

Do not rely on an unprotected in-process `setInterval` for production email
delivery.

The execution endpoint/job must authenticate the caller and must not be
available as an unauthenticated public send-email endpoint.

---

## 7. Independent implementation steps

Each step below is intended to be executable as a separate work package. A
developer should update this document’s progress row and verification record
after completing a step.

### Step 1 — Freeze and test the reminder policy

**Purpose:** Turn the decisions in this document into one testable contract.

**Work:**

- Confirm the clinic and doctor eligibility rules.
- Reuse `shared/booking-status.ts` and the server booking predicates.
- Add pure policy tests for:
  - Admin-confirmed booking.
  - Doctor-approved booking.
  - Admin confirmation on behalf of an assigned doctor.
  - Awaiting doctor approval.
  - Cancelled, no-show, completed, and early-exit bookings.
  - Unassigned doctor.
  - Today and seven-day boundary cases.
  - Clinic timezone differences.
  - Archived and inactive/expired clinics.

**Expected result:** Later API and UI work has one clear definition to follow.

**Depends on:** None.

**Acceptance criteria:**

- Every confirmed product decision has a testable rule.
- No reminder test uses browser or server local time accidentally.
- Clinic and doctor visibility rules are tested separately.

### Step 2 — Add the server reminder query/service

**Purpose:** Provide one secure, live source of upcoming reminder data.

**Work:**

- Add clinic and doctor reminder retrieval methods to the storage interface.
- Join bookings to slots and clinics as needed.
- Apply role ownership on the server.
- Apply the common terminal/completed filters.
- Apply the clinic timezone date window.
- Return grouped reminder data and a total count.
- Avoid writing reminder rows into `notifications`.

**Expected result:** Authenticated dashboards can request current reminders.

**Depends on:** Step 1.

**Acceptance criteria:**

- Clinic users cannot request another clinic’s reminders.
- Doctors cannot request another doctor’s reminders.
- Archived and inactive/expired clinics are excluded from email eligibility and
  from any reminder scope where the product rule requires it.
- Cancelled, no-show, completed, and early-exit bookings are excluded.
- The two response groups do not overlap.
- Boundary tests pass for the clinic timezone.

### Step 3 — Add authenticated reminder API routes

**Purpose:** Expose the server query through the project’s existing route and
session conventions.

**Work:**

- Add a clinic reminder endpoint.
- Add a doctor reminder endpoint, or one role-aware endpoint if that is safer
  and clearer.
- Derive clinic/doctor identity from the authenticated session.
- Do not trust a client-supplied clinic ID or doctor ID for authorization.
- Return predictable loading, empty, and server-error responses.

**Expected result:** The frontend has a documented API contract.

**Depends on:** Step 2.

**Acceptance criteria:**

- Unauthenticated users cannot retrieve staff reminders.
- Role and ownership checks are server-side.
- Response fields contain only approved reminder data.
- Route documentation is added to the booking API reference if route names are
  introduced.

### Step 4 — Build the shared reminder presentation component

**Purpose:** Create one reusable responsive panel for both dashboards.

**Work:**

- Add the calendar/reminder icon and count badge.
- Use a popover on desktop and a drawer/sheet on mobile.
- Render the two non-overlapping groups.
- Add loading, empty, error, and generated-time states.
- Keep the bell notification UI unchanged.
- Add accessible labels and keyboard behavior.
- Use the existing booking deep-link/navigation contract.

**Expected result:** Staff can view upcoming appointments without opening the
booking list first.

**Depends on:** Step 3.

**Acceptance criteria:**

- Clinic and doctor dashboards both expose the control.
- Badge count means active upcoming appointment count, not unread count.
- Every item opens the existing booking detail flow.
- Narrow mobile layouts remain usable without horizontal clipping.
- Zero reminders produce a clear empty state.

### Step 5 — Connect refresh and invalidation behavior

**Purpose:** Keep reminders accurate while appointments change.

**Work:**

- Fetch reminders on initial dashboard load.
- Poll the reminder endpoint every five minutes.
- Invalidate the reminder query after confirmation, assignment, approval,
  cancellation, rescheduling, check-in, completion, no-show, and relevant
  booking events.
- Extend the existing WebSocket invalidation map without creating ordinary
  notification records for each reminder.
- Refetch when the browser reconnects or the reminder panel opens after a
  long idle period.

**Expected result:** The count and list change soon after booking lifecycle
changes and eventually correct themselves after disconnection.

**Depends on:** Step 4.

**Acceptance criteria:**

- Confirmation increases the correct reminder count.
- Cancellation, rescheduling, no-show, and completion remove or move the item.
- A WebSocket event refreshes reminder data without duplicating bell entries.
- Five-minute polling is cleaned up when the dashboard unmounts.

### Step 6 — Choose and implement the digest scheduler foundation

**Purpose:** Establish reliable execution before adding real digest sending.

**Work:**

- Choose the deployment-approved scheduler/worker approach.
- Add authenticated invocation.
- Add a database-backed lock or equivalent concurrency guard.
- Add structured job attempt logging.
- Add a safe dry-run/development mode.
- Define retry and failure behavior.

**Expected result:** The digest operation can run repeatedly without creating
duplicate sends.

**Depends on:** Step 1. Step 6 may proceed in parallel with Steps 2–5 if the
deployment decision is already available.

**Acceptance criteria:**

- The job cannot be triggered by an unauthenticated public request.
- Concurrent invocations are serialized or deduplicated.
- Restarting the application does not reset delivery history.
- Development execution cannot accidentally send to real recipients.

### Step 7 — Add digest data model and recipient selection

**Purpose:** Persist delivery history and calculate recipient-specific content.

**Work:**

- Add the reminder digest log table and migration/startup compatibility path
  according to the project’s database conventions.
- Select eligible active clinics, excluding archived and inactive/expired
  subscription clinics.
- Create one clinic recipient per clinic email.
- Create one doctor recipient per doctor with at least one eligible
  appointment.
- Deduplicate normalized email addresses.
- Store the exact appointment IDs included in each digest.

**Expected result:** The job knows who should receive which appointment set.

**Depends on:** Steps 1, 2, and 6.

**Acceptance criteria:**

- Clinic email receives all eligible appointments for that clinic.
- Doctor email receives only that doctor’s eligible appointments.
- No admin personal email is selected.
- A doctor with one appointment receives a digest.
- A clinic with zero appointments remains eligible for a morning digest.
- An identical clinic/doctor email receives only one email.

### Step 8 — Build and send the consolidated email digest

**Purpose:** Deliver the daily staff email using the existing email system.

**Work:**

- Add a reminder digest template using the existing email shell.
- Render the two non-overlapping date groups.
- Render a safe zero-appointment clinic state.
- Include only privacy-approved fields.
- Add the dashboard CTA using the project’s approved URL/deployment
  configuration.
- Record success/failure and included appointment IDs.
- Apply the idempotency rule before sending.

**Expected result:** Recipients receive one useful daily digest without inbox
spam or sensitive free-text data.

**Depends on:** Steps 6 and 7.

**Acceptance criteria:**

- Clinic digest sends every morning, including zero appointments.
- Doctor digest sends every morning when the doctor has one or more eligible
  appointments.
- Separate doctors receive separate appointment sets.
- Archived and inactive/expired clinics receive nothing.
- A duplicate scheduler run does not duplicate the same digest.
- Identical clinic/doctor recipient emails receive only one email.
- Development/test mode redirects safely according to current email policy.

### Step 9 — Verify lifecycle, privacy, and responsive behavior

**Purpose:** Prove that the complete feature behaves correctly before release.

**Work:**

- Test confirmation by admin.
- Test admin confirmation on behalf of an assigned doctor.
- Test doctor approval.
- Test assignment after the daily digest.
- Test cancellation, rescheduling, no-show, check-in, treatment completion,
  and final completion.
- Test archived and inactive/expired subscription clinics.
- Test zero, one, and many appointments.
- Test duplicate scheduler invocations.
- Test timezone midnight and seven-day boundary behavior.
- Test clinic versus doctor visibility.
- Test desktop, tablet, and narrow mobile reminder layouts.
- Run the project’s build and relevant test workflows.

**Expected result:** The feature is safe to release and its operational limits
are recorded.

**Depends on:** Steps 1–8.

**Acceptance criteria:**

- No appointment appears in both date groups.
- No unauthorized appointment is visible.
- No reminder item contains unapproved sensitive fields.
- No duplicate digest is sent for the same recipient/content/date.
- UI remains usable at narrow widths.
- Any environment limitation is recorded instead of silently ignored.

---

## 8. Progress tracker

Status meanings:

- **Complete:** Decision or documentation is finished and verified.
- **Ready:** Scope and acceptance criteria are defined; implementation can begin.
- **In progress:** Work has started but acceptance criteria are not complete.
- **Blocked:** A required product, deployment, or infrastructure decision is
  missing.
- **Complete and verified:** Implementation and required checks have passed.

| Step | Exact work | Dependencies | Current status | Completion evidence |
|---|---|---|---|---|
| 1. Freeze and test reminder policy | Convert confirmation, role visibility, lifecycle, timezone, and subscription rules into one tested contract | None | **Ready** | Policy tests cover clinic/admin confirmation, doctor approval, terminal states, and boundaries |
| 2. Server reminder query/service | Calculate live clinic/doctor reminder data with server-side filtering and non-overlapping groups | 1 | **Ready** | Storage tests and query checks pass |
| 3. Authenticated reminder routes | Expose the reminder contract using authenticated clinic/doctor sessions | 2 | **Ready** | Route authorization and response-shape checks pass |
| 4. Shared reminder panel | Add icon, badge, responsive popover/drawer, grouping, empty/error states, and booking navigation | 3 | **Ready** | Clinic and doctor UI render the panel at desktop and mobile widths |
| 5. Refresh/invalidation | Add five-minute polling and WebSocket/lifecycle invalidation without creating bell notifications | 4 | **Ready** | Booking changes update the count/list and timers clean up |
| 6. Scheduler foundation | Choose and implement authenticated, durable, idempotent digest execution | 1; can run parallel with 2–5 | **Blocked — deployment choice required** | Scheduler invocation, lock, retry, and dry-run checks pass |
| 7. Digest log and recipients | Add delivery log, clinic/doctor recipient selection, subscription filtering, and deduplication | 1, 2, 6 | **Ready after Step 6** | Recipient matrix and migration checks pass |
| 8. Consolidated digest email | Add privacy-safe template, zero-state clinic email, daily delivery, and idempotency | 6, 7 | **Ready after Steps 6–7** | Test emails and delivery-log checks pass |
| 9. Full verification | Run lifecycle, authorization, privacy, duplicate-send, timezone, and responsive checks | 1–8 | **Ready after implementation** | Build, tests, UI checks, and operational notes recorded |

**Overall progress:** Planning complete; 0 of 9 implementation steps complete.

```text
Planning: complete
Implementation: 0 of 9 steps complete
Scheduler decision: blocked pending deployment choice
```

---

## 9. Suggested ownership and execution order

The steps can be assigned independently as follows:

### Track A — In-app reminders

```text
Step 1 → Step 2 → Step 3 → Step 4 → Step 5
```

### Track B — Email infrastructure

```text
Step 1 → Step 6 → Step 7 → Step 8
```

Track A and Track B may run in parallel after Step 1. Step 9 is the final
integration and release gate.

---

## 10. Out of scope

The following are intentionally not part of this plan:

- Automatically sending WhatsApp reminders to patients.
- Automatically sending appointment reminders to patients by email.
- Replacing the existing notification bell.
- Storing each upcoming appointment as a persistent notification.
- Creating a new patient appointment-detail page.
- Showing free-text clinical descriptions in staff digest emails.
- Sending digests to an admin’s personal email.
- Sending to archived clinics.
- Sending to inactive or expired subscription clinics.

Any of these should be proposed as a separate product decision and implementation
plan.

---

## 11. Source map for implementers

| Concern | Existing source of truth |
|---|---|
| Booking lifecycle interpretation | `shared/booking-status.ts` |
| Server lifecycle predicates | `server/booking-predicates.ts` |
| Booking persistence and filtered queries | `server/storage.ts` |
| Booking routes and session authorization | `server/routes.ts` |
| Booking schema and clinic timezone | `shared/schema.ts` |
| Clinic dashboard orchestration | `client/src/pages/ClinicDashboard.tsx` |
| Doctor dashboard orchestration | `client/src/pages/DoctorDashboard.tsx` |
| Shared dashboard header | `client/src/components/Header.tsx` |
| Existing notification polling/WebSocket hook | `client/src/hooks/use-notifications.ts` |
| Existing notification persistence | `notifications` table and notification storage methods |
| Existing email shell and Resend integration | `server/routes.ts`, `docs/notifications/email-design-system.md` |
| Existing manual patient reminder | `PATCH /api/auth/clinic/bookings/:id/send-reminder` |

The server remains authoritative. A reminder icon, count, or hidden panel is
only a presentation decision and must never be treated as authorization.
