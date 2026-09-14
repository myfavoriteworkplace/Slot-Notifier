# BookMySlot — Timezone Architecture and Feature Contract

**Status:** Canonical guidance for new features; current implementation has
known legacy exceptions  
**Date:** 2026-09-14  
**Related code:** `shared/booking-status.ts`,
`server/booking-predicates.ts`, `server/reminder-policy.ts`,
`shared/effective-entitlement.ts`  
**Related docs:** `docs/architecture/db-architecture.md`,
`docs/TODO/09-reminder-module-plan.md`,
`docs/TODO/15-messaging-allowance-and-plan-policy-blueprint.md`

---

## 1. Purpose

BookMySlot is a multi-tenant clinic application. Each clinic can operate in a
different IANA timezone, while the backend, database, browser, scheduler, and
external providers may run somewhere else.

This document defines the timezone rules that future features must follow for:

- Appointments and slots
- Booking filters and lifecycle decisions
- Reminders and digest emails
- Subscriptions, Trial periods, and access grants
- Messaging allowances and usage reports
- Billing, exports, PDFs, notifications, and audit records
- Scheduler jobs and provider events

The goal is to prevent the same timestamp from being interpreted differently
by the server, browser, database, or a clinic.

---

## 2. The short version

Use these rules unless a feature has an explicitly approved exception:

```text
An instant:
  Store and transmit it as an ISO 8601 instant with Z or an explicit offset.
  Compare it as an instant.

A clinic calendar date:
  Derive it in the clinic's validated IANA timezone.
  Examples: today, tomorrow, local month, local week, leave date.

A display:
  Format the instant with an explicit timeZone.
  Never rely on the browser or server process timezone.

A cross-clinic platform report:
  Use UTC when that is the report's declared basis.
  Display “UTC” in the response and UI.

A scheduler:
  Run from a reliable UTC/server schedule.
  Decide eligibility separately for each clinic's local timezone.
```

The browser timezone is not the application's business timezone. The server
process timezone is not the application's business timezone. A phone number,
email address, or user location is not a clinic timezone.

---

## 3. The three concepts every feature must separate

### 3.1 Instant

An instant identifies one point on the global timeline.

Examples:

- Appointment start and end
- Trial start and expiry
- Paid subscription expiry
- Complimentary grant start and end
- Payment, webhook, OTP, consent, audit, and notification timestamps

Instants must be:

- Created from a known instant.
- Stored as UTC-equivalent values.
- Sent through APIs as ISO 8601 strings with `Z` or an explicit offset.
- Compared using timestamps, not formatted strings.

`2026-09-14T08:00:00.000Z` and
`2026-09-14T13:30:00+05:30` represent the same instant.

### 3.2 Clinic-local civil date

A civil date is a calendar date in a particular clinic timezone. It does not
identify a global instant by itself.

Examples:

- “The appointment is today.”
- “Next three calendar days.”
- “October messaging allowance.”
- “Doctor leave on 2026-09-18.”
- “The clinic's local morning digest.”

The same instant can have different civil dates in different clinics. A civil
date must always be paired with the timezone that gives it meaning.

### 3.3 Display formatting

Formatting changes how an instant is shown. It must not change the instant or
be used to decide access, eligibility, grouping, expiry, or scheduling.

Every user-facing date/time formatter must receive an explicit timezone:

```ts
new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: clinicTimezone,
}).format(instant);
```

The locale (`en-IN`) controls language and number/date presentation. It does
not select the timezone.

---

## 4. Timezone source of truth

### 4.1 Clinic timezone

The clinic's `clinics.timezone` value is the source of truth for clinic
operations.

It must be:

- An IANA timezone identifier such as `Asia/Kolkata`,
  `Asia/Dubai`, or `Europe/London`.
- Validated with the shared resolver before use.
- Carried with booking, reminder, report, and entitlement context where the
  consumer needs to interpret a local date or display an instant.

Do not store a fixed numeric offset such as `+05:30` as the clinic timezone.
Offsets do not describe daylight-saving changes and cannot reliably represent a
future local calendar.

### 4.2 Default and invalid values

The application currently defines:

```ts
DEFAULT_CLINIC_TIMEZONE = "Asia/Kolkata";
```

`resolveClinicTimezone()` validates the IANA identifier and falls back to
`Asia/Kolkata` for missing, blank, or invalid legacy data.

This fallback keeps existing records usable. It does not mean that every future
clinic should silently use Asia/Kolkata. New clinic setup and timezone edits
must validate and save an IANA identifier explicitly.

### 4.3 Other timezone contexts

| Context | Timezone rule |
|---|---|
| Clinic appointment operations | The clinic's validated IANA timezone |
| Doctor working across clinics | The booking's clinic timezone for each booking |
| Patient-facing appointment message | The appointment clinic's timezone unless the product explicitly adds a patient timezone |
| Clinic-local usage allowance | The clinic's timezone |
| Cross-clinic Super Admin report | UTC when the report says UTC |
| Provider webhook/event timestamp | Treat the provider value as an instant; retain provider timezone/offset metadata when supplied |
| Server logs and infrastructure metrics | UTC or the platform's declared operational timezone; never use these for clinic business rules |
| Browser-only personal preference | Allowed only for an explicitly personal, non-clinic display preference |

---

## 5. Canonical shared helpers

Use the shared booking-time helpers instead of writing feature-specific date
math:

| Helper | Use |
|---|---|
| `resolveClinicTimezone()` | Validate a clinic timezone and apply the documented legacy fallback |
| `isValidIanaTimezone()` | Validate an IANA identifier |
| `getCalendarDateInTimezone()` | Convert an instant to `yyyy-MM-dd` in a clinic timezone |
| `getUtcInstantForCalendarDate()` | Convert a clinic-local calendar boundary into a UTC instant |
| `createBusinessDateContext()` | Snapshot `now`, resolved timezone, and the current clinic-local date |
| `createBookingDateBoundaries()` | Build clinic-local today/tomorrow/week boundaries as UTC instants |
| `classifyBooking()` | Apply the shared booking date/lifecycle interpretation |

The main implementation is in `shared/booking-status.ts`, with booking query
boundaries in `server/booking-predicates.ts` and storage methods.

Do not duplicate timezone validation, local-date extraction, or UTC boundary
calculation in a route, component, email template, or scheduler.

---

## 6. Feature contracts

### 6.1 Appointments and slots

Appointment and slot `startTime`/`endTime` values are instants. The database
architecture currently documents them as UTC.

For booking decisions:

1. Parse the incoming value as an instant.
2. Load the booking's clinic timezone.
3. Derive the clinic-local date only for calendar grouping or date filters.
4. Convert local date boundaries back to UTC for database queries.
5. Compare appointment times as instants for past-due and ordering decisions.

Examples:

```text
“Today”:
  Clinic-local midnight through the next clinic-local midnight,
  converted to UTC query boundaries.

“Past due”:
  Appointment instant is earlier than the current instant,
  subject to the booking lifecycle policy.

“Next 7 days”:
  Clinic-local civil dates today through today + 6,
  not an arbitrary 168-hour window.
```

### 6.2 Reminders and digest emails

Reminder eligibility is clinic-local:

- The next-three-days group is local dates 0, 1, and 2.
- The coming-week group is local dates 3, 4, 5, and 6.
- Digest scheduling is evaluated in each clinic's timezone.
- The documented morning digest time is 8:00 AM in the clinic timezone.
- A doctor working with multiple clinics must have each booking classified in
  its own clinic timezone.

The scheduler may run in UTC or at frequent intervals. It must not assume one
global local hour for every clinic.

Digest idempotency must use the relevant local digest date, clinic/doctor
scope, recipient identity, and template/version information. A UTC date alone
is not sufficient.

The server-side reminder projection already returns local-date information and
clinic timezone. Email rendering correctly formats appointment time with the
booking timezone. New reminder UI must preserve that timezone context for both
date and time.

### 6.3 Trial, subscription, and access grants

Trial, paid-access expiry, manual-payment coverage, and complimentary access
are lifecycle instants:

```text
startsAt
endsAt
paidAccessExpiresAt
trialStartedAt
trialEndsAt
trialGraceEndsAt
revokedAt
```

Store and compare these as instants. Display them in the clinic timezone.

The current Trial and subscription helpers calculate a “day” as
`24 * 60 * 60 * 1000`. The helper named `addCalendarDays` currently performs
fixed-duration arithmetic, not clinic-local midnight arithmetic. Future
features must not assume that a function name means local-calendar behavior.

If the business later chooses local-calendar Trial windows, that must be a
deliberate lifecycle change with one shared helper and updated tests for
daylight-saving transitions. Do not implement one rule for Trial, another for
grace, and a third for complimentary access.

### 6.4 Messaging allowances and usage

Clinic allowances that reset by month use the clinic-local calendar:

```text
Start: first instant of the first day of the clinic-local month
End: first instant of the next clinic-local month
Query: UTC instants generated from those local boundaries
Display: month label plus the timezone used
```

The clinic messaging report follows this model. A cross-clinic Super Admin
report may intentionally aggregate by UTC, but it must label its response and
UI as UTC and must not be reused to enforce a clinic-local allowance.

Every usage response should identify:

- Period name
- Start and end instants
- Timezone
- Measurement timestamp
- Freshness or unavailable-data state

Unavailable usage must not silently become zero.

### 6.5 Billing, payments, webhooks, and audit

Payment capture, provider webhook, refund, chargeback, invoice, audit, and
security-token times are instants.

Rules:

- Persist the event instant, not a formatted local date.
- Use provider event IDs and provider timestamps as metadata.
- Compare expiry and idempotency windows using instants.
- Format a clinic-facing message in the clinic timezone.
- Format a cross-clinic financial report in its declared report timezone.
- Never infer a clinic timezone from a provider timestamp or server log.

### 6.6 Doctor leave and other date-only data

Some data is intentionally date-only. `doctor_leaves.leaveDate` is currently
stored as a `yyyy-MM-dd` string.

For date-only data:

- Interpret it in the associated clinic timezone.
- Do not convert it through `new Date("yyyy-MM-dd")` and then apply server
  local hours.
- Keep the date-only value separate from an instant.
- When a time is later required, convert the civil date using the clinic
  timezone and the approved local wall-clock rule.

If a date-only field is expected to support range queries or many comparisons,
consider a database `date` column with an appropriate index rather than
continuing to store a string.

### 6.7 Notifications, SMS, WhatsApp, PDFs, and exports

Any communication containing an appointment or clinic deadline must use the
appointment/clinic timezone explicitly.

Required pattern:

```text
Load the relevant clinic timezone.
Keep the stored value as an instant.
Format date and time with that timezone.
Include the timezone or a clearly localised clinic label when ambiguity is possible.
```

For exports:

- Interpret clinic date filters in the clinic timezone.
- Convert filter boundaries to UTC for database queries.
- Format exported timestamps with the clinic timezone.
- Include the report timezone and filter basis in the export metadata or
  heading.

### 6.8 Frontend dashboards

The server is authoritative for date classification, eligibility, filters, and
calendar boundaries.

The frontend may format values, but it must receive and use the relevant
timezone:

```text
Good:
  booking.startTime + booking.clinicTimezone

Unsafe:
  date-fns format(new Date(booking.startTime), ...)
  new Date(...).toLocaleString(...)
  browser startOfDay/startOfWeek for clinic filters
```

The current client booking classifier uses the Asia/Kolkata fallback because
session APIs do not yet expose each clinic's IANA timezone. Future APIs should
include `clinicTimezone` in booking and reminder DTOs so the client does not
have to guess.

---

## 7. Input and API rules

### 7.1 Datetime inputs

For an instant, accept only an ISO 8601 datetime with `Z` or an explicit
offset:

```text
2026-09-14T08:00:00.000Z
2026-09-14T13:30:00+05:30
```

Reject or explicitly interpret datetime strings without an offset. A value such
as `2026-09-14T13:30` is a wall-clock value, not a complete instant.

For an HTML `datetime-local` field:

1. Treat the value as a local wall-clock value.
2. Pair it with the relevant clinic IANA timezone.
3. Convert it to an instant on the server.
4. Store and return the resulting instant.

Do not call `new Date(datetimeLocalValue)` and assume the server timezone is
the clinic timezone.

### 7.2 Date-only inputs

Use `yyyy-MM-dd` only when the field is intentionally a civil date, such as
doctor leave or a clinic-local date filter.

Always carry the associated timezone and use
`getUtcInstantForCalendarDate()` for database boundaries. Do not use
`new Date("yyyy-MM-dd")` followed by `setHours()`.

### 7.3 API responses

An API response containing an instant should use an ISO string with `Z`:

```json
{
  "startTime": "2026-09-14T08:00:00.000Z",
  "clinicTimezone": "Asia/Kolkata",
  "localDate": "2026-09-14"
}
```

When a response contains a local calendar period, include:

```text
timezone
periodStart
periodEnd
periodBasis
```

This makes the meaning of the response clear to every consumer.

---

## 8. Database and runtime contract

### 8.1 Current database limitation

Most Drizzle timestamp columns currently use `timestamp(...)` without
`withTimezone: true`. The codebase and database architecture document
appointment slot timestamps as UTC, but the schema does not itself enforce that
all timestamp columns are timezone-aware.

Until a deliberate schema migration is completed:

- Treat persisted instants as UTC by application contract.
- Write UTC-equivalent `Date` values.
- Read them as instants.
- Never depend on the database session timezone.
- Never mix local wall-clock values into instant columns.
- Add a test when a new timestamp column is introduced.

A future schema hardening project should assess migrating instant columns to
PostgreSQL `timestamptz`, with a data audit and production migration plan. Do
not convert columns casually because a timestamp migration can change the
meaning of existing records.

### 8.2 Server runtime

Backend code must behave the same regardless of the host process timezone.
Avoid:

```ts
date.setHours(0, 0, 0, 0);
date.toLocaleString();
date-fns startOfDay(date);
date.toISOString().slice(0, 10); // for a clinic-local date
```

These operations may be valid only when the feature explicitly declares the
server/UTC basis. For clinic operations, use the shared timezone helpers.

### 8.3 Database queries

For a clinic-local date range:

```text
Receive yyyy-MM-dd and clinic timezone.
Calculate local start/end boundaries.
Convert them to UTC instants.
Query the instant column using those UTC boundaries.
```

Do not filter a clinic's local month with `date_trunc('month', timestamp)`
unless the query explicitly uses the clinic timezone and has been tested at
month boundaries.

---

## 9. Scheduler and background-job contract

Schedulers are allowed to run from UTC or the host runtime. Business decisions
must not depend on the scheduler's local clock.

Every recurring job must:

1. Capture one `now` instant for the run.
2. Load the timezone for each clinic or booking scope.
3. Derive the local date/time from that instant.
4. Decide whether the local window is due.
5. Write an idempotency key that includes the relevant local period when
   applicable.
6. Store the actual run and delivery instants as UTC-equivalent values.

This applies to:

- Morning reminder digests
- Appointment reminder windows
- Trial and subscription expiry
- Complimentary grant expiry
- Monthly allowance resets
- No-show and lifecycle jobs
- Provider reconciliation
- Token cleanup

Do not run one job “at 8:00 server time” and assume it is 8:00 AM for every
clinic.

---

## 10. Current implementation: canonical areas and known exceptions

### 10.1 Canonical or mostly canonical areas

These areas already follow the intended model or provide the shared foundation:

- `shared/booking-status.ts` validates IANA zones and builds local calendar
  boundaries.
- Modern booking predicates and paged storage queries convert clinic-local
  date filters to UTC boundaries.
- `server/reminder-policy.ts` groups reminders by clinic-local civil dates.
- Reminder digest selection uses clinic-local digest dates for deduplication.
- Clinic messaging usage derives monthly UTC boundaries from the clinic
  timezone.
- Subscription and entitlement windows compare stored lifecycle instants.
- `docs/architecture/db-architecture.md` documents slot timestamps as UTC.

### 10.2 Known exceptions that must not become templates

These existing paths need future cleanup or explicit scoping:

1. Some storage methods use `new Date()` with `setHours()` for date lookups,
   which uses the server runtime timezone.
2. No-show candidate logic uses server-local `startOfDay`.
3. Availability code uses `toISOString().slice(0, 10)`, which produces a UTC
   date rather than a clinic-local date.
4. Some slot configuration and bulk input paths parse datetimes without
   requiring an offset.
5. Many booking emails, notifications, SMS, and WhatsApp format dates without
   an explicit `timeZone`.
6. XLSX export filtering and formatting include server/browser-local operations.
7. Many frontend components use browser-local `date-fns` formatting.
8. The client booking classifier uses the default Asia/Kolkata timezone because
   clinic timezone is not yet present in all session/API contexts.
9. The reminder panel receives server local-date data but some UI time
   formatting still uses the browser timezone.
10. Super Admin cross-clinic reports intentionally use UTC and must not be
    copied into clinic-local quota or reminder logic.
11. `getUtcInstantForCalendarDate()` validates the date shape but should also
    reject impossible dates rather than allowing JavaScript date normalization.
12. Doctor reminder candidate SQL uses a broad instant window before applying
    per-clinic local filtering; future changes should preserve local-boundary
    correctness at DST and timezone edges.

These paths are documented so a future feature does not copy them accidentally.
They are not alternative architecture standards.

---

## 11. Required feature checklist

Before approving a feature that handles dates or times, confirm:

### Data

- Is each field an instant or a civil date?
- Is the distinction recorded in the schema and API contract?
- Are instants stored and returned as UTC-equivalent values?
- Is an IANA timezone stored or carried with every civil-date context?

### Server logic

- Is the clinic timezone resolved with `resolveClinicTimezone()`?
- Are local calendar boundaries created with shared helpers?
- Are comparisons performed on instants?
- Does the feature behave the same when the server runs in UTC, Asia/Kolkata,
  and another timezone?
- Are DST boundary cases covered where relevant?

### Client and communications

- Does every formatter pass `timeZone` explicitly?
- Does the UI use the booking/report timezone rather than browser timezone?
- Do emails, SMS, WhatsApp, PDFs, and exports use the same timezone as the
  related clinic record?
- Does the UI label UTC when a report intentionally uses UTC?

### Scheduling and idempotency

- Is the scheduler independent of the host local clock?
- Does the idempotency key use the correct local period?
- Can the job run twice without changing the result?
- Are expiry and reminder decisions based on one captured `now` instant?

### Tests

At minimum, test:

- A clinic in `Asia/Kolkata`.
- A clinic in a positive-offset timezone.
- A clinic in a negative-offset timezone.
- A clinic with DST transitions.
- An instant near local midnight.
- A month boundary.
- A year boundary.
- A malformed or missing clinic timezone.
- A browser timezone different from the clinic timezone.
- A server runtime timezone different from every clinic timezone.

---

## 12. Decision record for future features

Unless this document is intentionally amended, the following decisions apply:

1. Clinic operations use the clinic's validated IANA timezone.
2. `Asia/Kolkata` is the compatibility fallback for missing or invalid legacy
   clinic timezone values.
3. Instants are stored and transmitted as UTC-equivalent values.
4. Clinic-local dates are derived from instants, never guessed from strings.
5. Clinic-local period boundaries are converted to UTC before database queries.
6. The browser and backend process timezone are never business-rule defaults.
7. Cross-clinic platform reports may use UTC, but must declare and display UTC.
8. Every future date/time feature must state whether it uses an instant, a
   clinic-local civil date, or a display-only timezone.
9. Existing server-local and browser-local paths are compatibility exceptions,
   not patterns for new code.
