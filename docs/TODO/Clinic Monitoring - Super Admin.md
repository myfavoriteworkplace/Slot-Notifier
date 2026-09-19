# Clinic Monitoring — Super Admin

## Purpose

Clinic Monitoring gives Super Admin a privacy-safe view of how clinics use BookMySlot operationally.

The screen shows aggregate clinic activity. It does not show patients, individual appointments, clinical information, bills, treatment revenue, or raw audit records.

## Stage 1 implemented

### Super Admin screen

Added a new tab under:

```text
Super Admin
└── Operations
    ├── Platform Operations
    ├── Tenant Operations
    └── Clinic Monitoring
```

The screen includes:

- Last 7 days, last 30 days, last 90 days, and custom date ranges.
- Overall summary cards for:
  - Active clinics
  - Public bookings
  - Clinic-created bookings
  - Scheduled appointment hours
  - Observed visit hours
- Daily aggregate booking trend.
- Clinic activity table.
- Search by clinic name.
- Plan filter.
- Active/inactive filter.
- Sort by booking count, active days, public-booking share, or period change.
- Aggregate-only clinic detail drawer.
- Loading, error, refresh, and empty states.

The monitoring table does not expose contact details, patient details, booking IDs, or clinical details.

### Backend endpoint

Added:

```text
GET /api/admin/clinic-monitoring
```

Supported query parameters:

- `from=YYYY-MM-DD`
- `to=YYYY-MM-DD`
- `clinicId=<approved clinic id>`
- `plan=<plan name>`

The endpoint:

- Requires a Super Admin session on the backend.
- Validates the requested date range.
- Limits a report to 366 days.
- Aggregates data on the server.
- Returns aggregate clinic rows and trends only.
- Does not return raw booking rows.
- Does not select patient, doctor, clinical, billing, payment-provider, messaging-provider, IP, user-agent, or free-text fields.
- Records the monitoring view through the existing audit mechanism without recording the metric payload.

### Implemented metric definitions

- **Public booking:** booking with `bookedBy = patient`.
- **Clinic-created booking:** booking with `bookedBy = admin`.
- **Unclassified booking:** legacy or incomplete booking source. These are included in the total and shown separately so the total is not silently understated.
- **Active day:** a local clinic calendar day with at least one booking.
- **Scheduled hours:** non-cancelled slot duration, counted once per slot even when a slot has multiple bookings.
- **Observed visit duration:** positive time between `checkedInAt` and `completedAt`.
- **Observed visit duration limit:** durations longer than 24 hours are excluded from the average and counted as anomalous data.
- **Cancellation rate:** cancelled bookings divided by all bookings in the selected period.
- **No-show rate:** no-show bookings divided by all bookings in the selected period.
- **Usage change:** current-period total bookings compared with the immediately preceding period of the same length.
- **Dates:** each clinic’s configured timezone is used for local-day grouping.

Observed visit duration is intentionally labelled as an estimate. The application does not have a guaranteed consultation-start timestamp, and visits may be completed automatically as part of another workflow.

### Tests

Added coverage for:

- Public and clinic-created booking aggregation.
- Slot de-duplication when multiple bookings use the same slot.
- Cancelled-slot exclusion from scheduled hours.
- Extreme visit-duration exclusion.
- Cancellation rate calculation.
- Previous-period comparison.
- Aggregate response privacy shape.

## Future enhancements

### Stage 2 — Public booking funnel

The current application can measure completed public bookings, but it cannot measure people who view a public booking page and leave without booking.

Future aggregate tracking could record daily counts for:

- Public clinic page viewed.
- Availability checked.
- Booking started.
- OTP requested.
- External booking completed.
- Booking failed.

Store daily totals by clinic and event type only. Do not store email addresses, phone numbers, IP addresses, user agents, raw URLs, query parameters, referrers, or individual session histories.

Public conversion should be hidden when the number of relevant events is too small to be meaningful or privacy-safe.

### Stage 3 — Estimated platform active time

If the product needs to measure how much clinic staff use BookMySlot, add privacy-safe aggregate activity buckets rather than employee monitoring.

Possible future metrics:

- Active clinic days.
- Active 15-minute time buckets.
- Estimated aggregate platform active minutes.
- Usage decline indicators.

Do not record individual staff timelines, exact route histories, page contents, or employee-level performance.

### Optional future improvements

- Aggregate-only CSV export.
- Saved monitoring date ranges.
- Configurable alert thresholds for sustained booking decline.
- A platform-wide trend timezone decision if clinics operate across multiple timezones.
- Scheduled retention cleanup for any future daily telemetry table.

## Intentionally excluded from Stage 1

- Patient names, IDs, emails, or phone numbers.
- Individual appointment details.
- Doctor names or doctor performance metrics.
- Diagnoses, treatment categories, notes, prescriptions, documents, or X-rays.
- Bills, payments, treatment revenue, or clinic-private financial data.
- Public-page visitor counts.
- Public booking conversion.
- Staff session duration or employee activity histories.
- Raw audit-event browsing.