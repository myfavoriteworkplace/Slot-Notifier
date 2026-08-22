# Booking Search, Filters, Grouping, and Patient History

## Patient search

Clinic search is implemented in `BookingsPanel.tsx`; doctor search is
implemented in `DoctorDashboard.tsx`.

The shared interaction pattern is:

1. User types at least two characters.
2. The client waits briefly before searching.
3. Results are fetched from the role-appropriate patient search endpoint.
4. User selects a patient result.
5. The booking query receives `patientId`.
6. The selected patient appears as an active filter.
7. Clearing the filter restores the normal booking list.

Search results are not the booking list. Selecting a patient changes the
booking query and lets the server return that patient's appointments.

## Filters

### Quick filters

Clinic quick filters include all, today, upcoming, past, this week, next week,
pending windows, and confirmed windows. The doctor dashboard adds doctor
ownership and awaiting-approval concepts.

### Date filters

The list supports a start date and optional end date. Date classification must
use the clinic business timezone rather than assuming the browser's local
timezone.

### Status filters

The dashboard status filter groups operational views such as:

- In clinic
- Completed
- Cancelled
- No-show

These are display filters over the normalized status tracks, not new database
states.

### Doctor filter

The clinic can restrict bookings to a doctor email. Doctor users can filter by
clinic and assignment context.

## Pagination and empty states

Booking lists use server-side pagination with page size 20 and infinite
loading. Empty states distinguish:

- No bookings at all
- No bookings matching the current date/filter
- A selected patient with no bookings in the current filter
- A selected patient with bookings outside the current filter.

This prevents the UI from implying that a patient record does not exist just
because a restrictive filter returned no rows.

## Grouping

Mixed lists are ordered and grouped into:

1. Future/Today
2. Past

The list helper derives grouping from the shared booking classifier. Past
bookings are not necessarily completed; an old booking may still require
resolution, may be active, or may have treatment completed.

## Visit numbering

The server provides visit metadata for the patient's complete history. The
card may display:

```text
Visit 2/4
```

This means the booking is the second chronological visit out of four known
visits. It is not a duplicate counter for the current list.

The latest booking label identifies the newest relevant booking in the
patient's history. It should remain stable when the user changes list filters.

## Collapsed cards

When a patient filter returns multiple appointments, cards initially collapse
to make history scanning practical. Users can expand individual cards. The
collapsed state is rebuilt when the actual booking ID set changes, not merely
when the number of bookings changes.

On mobile, card detail rows are also collapsed until the user expands the
date/time or clinic row.

## Troubleshooting interpretation

- A patient search result with no cards can mean the current date/status filter
  excludes the patient's bookings.
- A past appointment appearing below future appointments is expected grouping.
- Visit numbers come from complete patient history, not only loaded page one.
- Tab counts and server stats may represent the full result set rather than
  the currently visible page.