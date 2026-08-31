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


### Book a Slot patient matching

The clinic **Book a Slot** workflow performs an exact email-or-phone lookup
when **Review Booking** is opened. The lookup is clinic-scoped and returns the
complete union of matching profiles, including duplicate profiles that match
different identifiers. The review dialog shows each patient's name, patient
code, email, phone, and visit count. When one or more matches are found, the
admin must select either an existing profile or **Create New Patient Profile**
before **Confirm & Book** becomes available. The new-profile choice deliberately
allows a separate patient record to use the same email or phone.

The endpoint is:

```text
GET /api/auth/clinic/patients/match?email=...&phone=...
```

Phone matching ignores non-numeric formatting characters, and email matching
is trimmed and case-insensitive. The booking route still validates the
selected patient against the authenticated clinic.

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

### Overview patient-card layout

The Overview tab's patient information card uses a responsive internal grid:

- One column below the small-screen breakpoint.
- Two columns from the small-screen breakpoint upward.
- Email, complaints, clinical status, confirmed-by, and divider rows span the
  full available card width at every breakpoint.
- Normal one-line rows use centered icon/label/value alignment.
- Complaints, assigned-doctor text, and other naturally multi-line content use
  start alignment and may grow vertically.
- Status, visit-type, and treatment pills are intrinsic-width elements. They
  may wrap long values but must not stretch to fill the grid track.
- Phone, email, and consent action groups may wrap while keeping copy, call,
  edit, resend, and save controls at their intended size.

This layout contract applies only to the dialog's patient information card.
The dashboard list still uses the shared `AppointmentCard` sizing rules.

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

### Actions tab — responsive multi-column layout

The Actions tab uses a responsive grid layout that adapts to screen size to minimize scrolling:

**Mobile & Tablet (stacked, full-width)**
- All sections stack vertically in a single column
- Assign Doctor, Digital Consent, Appointment Slot, and Clinical Status appear in order
- Natural vertical scroll on content-heavy sections

**Desktop (md: breakpoint and above — 2-column grid)**
- **Left column**: Assign Doctor (constrained height with scroll)
  - `max-h-[350px] overflow-y-auto` on `md:` breakpoint
  - Contains doctor list and specialist suggestions
  - Scrollable when doctor list is long, preventing entire form overflow
  
- **Right column**: Digital Consent + Appointment Slot (stacked)
  - `space-y-4` for consistent spacing between sections
  - Digital Consent: send/resend status and link management
  - Appointment Slot: reschedule with date/time picker (expandable)
  
- **Full-width below grid**: Clinical Status
  - Positioned below the 2-column grid
  - Tracks case outcome (Follow-up Required / Case Closed)

**Layout CSS**
```
- Grid wrapper: `grid grid-cols-1 md:grid-cols-2 gap-4`
- Left column: `md:max-h-[350px] md:overflow-y-auto space-y-3`
- Right column: `space-y-4`
- Clinical Status: Full-width row below grid
```

**Benefits**
- Reduces vertical scroll on larger screens
- Maintains mobile-first simplicity
- Consistent with dashboard UI standards
- Doctor assignment and consent/slot actions visible side-by-side