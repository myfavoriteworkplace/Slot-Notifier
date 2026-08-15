# Clinic Admin Bookings Panel

## Responsibility

`client/src/components/BookingsPanel.tsx` is the clinic-facing booking
orchestration layer. It is mounted by `ClinicDashboard.tsx` and uses the
shared `AppointmentCard` with `role="clinic"`.

## Loading the booking list

The panel uses an infinite query against:

```text
GET /api/auth/clinic/bookings
```

The query includes filter state such as:

- Quick filter
- Today date
- Date range
- Patient ID
- Status filter
- Doctor email

Pages contain booking data, totals, pagination metadata, and server-calculated
stats. The client flattens pages into the rendered list.

Today lists refresh periodically; other lists use a longer stale period.

## Filters and list presentation

The panel supports:

- All
- Today
- Upcoming
- Past
- This week
- Next week
- Pending windows
- Confirmed windows
- Status filters
- Doctor filters
- Date ranges
- Patient search

Lists can be grouped into Future/Today and Past sections. Patient-filtered
lists collapse multiple bookings initially so staff can scan a patient's
history quickly.

See [Search, filters, and history](08-booking-search-filters-and-history.md).

## Mutations

The panel owns the clinic mutations and invalidates booking queries after
successful changes. Main operations include:

- Confirm
- Cancel
- Assign doctor
- Reschedule
- Update clinical status
- Check in or undo check-in
- Complete visit
- Mark no-show
- Batch mark no-show
- Revert eligible no-show
- Send reminder
- Override complete
- Update patient information
- Mark patient left early
- Request consent.

The exact route inventory is in
[Booking API and server contracts](11-booking-api-and-server-contracts.md).

## Detail dialog

Opening a card can show a booking detail dialog with tabs for:

- Overview
- Clinical
- Documents
- Notes
- Actions
- Billing

The dialog keeps tab state per booking. Notification deep links can select a
booking and tab.

When a notification references a booking outside the current list filter, the
panel fetches the booking separately using the focus-booking endpoint so the
dialog can still open.

### Footer parity

The card footer and the dialog's persistent footer represent the same booking
policy. They must not independently decide whether to show Resolve Booking,
Rebook, Reschedule, billing, or final closure.

Both surfaces consume the same `getAppointmentFooterModel()` result:

- `actions` opens the Actions tab.
- `billing` opens the Billing tab.
- `overview` opens the review overview.

The dialog may place additional administrative controls inside the Actions tab,
but its persistent footer must preserve the same primary/secondary action
meaning as the card. In particular:

- old and same-day past-due unresolved bookings resolve before Rebook;
- old active visits remain manageable;
- treatment-completed visits remain closable;
- active/treatment-completed visits can open billing to create the first bill;
- completed bookings with no bill do not show View Invoice.

### Patient detail dialog sizing

The clinic patient detail dialog is responsive to the viewport:

- On tablet and desktop widths, normal mode uses approximately `60vw × 60vh`,
  leaving about 20% of the screen around the centered dialog.
- The existing expanded mode remains available and uses the wider dialog layout.
- On small screens, the dialog remains close to full width with a viewport-safe
  maximum height so the tab content and footer remain usable.

The dialog's middle content region scrolls independently when a tab contains
more content than the available height. This sizing is presentation-only and
does not change booking lifecycle, footer eligibility, or tab behavior.

## Related workflows

### Billing

The panel can load booking bills, build billing details, save a bill, and
generate a receipt PDF. Billing data remains linked to the booking but does
not replace visit state.

### No-show review

The panel loads server-generated no-show candidates and supports individual
and batch processing. The server rechecks candidate state before applying a
batch.

### Rescheduling

The panel requests availability for a selected date, displays capacity, and
submits a new slot ID. The server performs the authoritative reschedule.

### Patient search

The patient search endpoint is debounced and selection changes the booking
query to a patient-specific view. Clearing the filter restores the list.

## Mounting and deep links

`ClinicDashboard` keeps the booking panel mounted while a notification-opened
booking dialog needs to remain available. The panel may be visually hidden
while the active dashboard panel is elsewhere because dialog portals render
outside the hidden container.