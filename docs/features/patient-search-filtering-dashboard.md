# Patient Search & Filtering — Smart Hint System

**Component**: `client/src/components/BookingsPanel.tsx`
**Feature**: Context-aware empty-state messages when a patient search conflicts with an active filter in the clinic admin Bookings section.

---

## Problem

The booking list applies two independent AND-filters in sequence:

```
All bookings  →  [Date/Status window]  →  [Patient match]  →  Shown results
```

The patient filter runs **after** the date/status filter. So if "Kunjappan" is selected and the **Today** chip is active, the result is zero — even if Kunjappan has 10 past or upcoming bookings — because no records survive the Today gate before the patient-match runs.

The original empty state showed a generic "No bookings match this filter / Try adjusting the date range" message in all cases. This gave the user no clue whether the patient has bookings elsewhere or doesn't exist at all.

---

## Solution

Two layers of smart messaging:

### Layer 1 — Filter-specific headlines (no patient selected)
When there is no patient filter, the headline and detail line are now tailored to the active filter instead of generic:

| Active filter | Headline | Detail |
|---|---|---|
| Today | "No bookings today" | "No slots are booked for today. Check Upcoming for future appointments." |
| Upcoming | "No upcoming appointments" | "There are no future appointments. Past bookings may be in the Past filter." |
| Past | "No past appointments" | "No appointment history yet — your clinic is just getting started!" |
| This Week | "Nothing scheduled this week" | "No appointments fall within Mon–Sun of this week. Try Next Week or All Bookings." |
| Next Week | "Nothing booked next week" | "No appointments are scheduled for next week yet." |
| Custom date/range | "No appointments in this range" | "No bookings fall in the selected date range. Clear the date filter to see all." |
| All (no filters) | "No bookings yet" | "Once patients book a slot, their appointments will appear here." |

### Layer 2 — Smart patient hint panel (patient selected + filter conflict)
An amber or blue info banner appears below the headline whenever `filteredBookings.length === 0` AND a patient filter is active. It:
- Names the exact conflict ("Kunjappan has no booking **today**")
- States where the bookings actually are ("Last visit: Jun 10 · Next: Jun 28")
- Provides one-click action buttons that switch the filter directly

---

## All Edge Cases Handled

### Group A — Patient + time filter conflict

| Code | Scenario | Hint color | Headline | Actions |
|---|---|---|---|---|
| A1 | Patient + Today — no booking today | Amber | "{Name} has no booking today" | "View Past Bookings" and/or "View Upcoming" |
| A2 | Patient + Upcoming — all bookings are past | Amber | "{Name} has no upcoming appointments" | "View Today" + "View Past Bookings" |
| A3 | Patient + Past — all bookings are future | Amber | "{Name} has no past appointments" | "View Today" + "View Upcoming" |
| A4 | Patient + This Week — booking is next week | Amber | "{Name} has no appointment this week" | "Check Next Week" + "View Upcoming" |
| A5 | Patient + Next Week — booking is this week | Amber | "{Name} has no appointment next week" | "Check This Week" + "View Upcoming" |
| A6 | Patient + Custom Date Range — outside range | Amber | "No appointment for {Name} on Jun 20–25" | "Clear date filter" |
| A7 | Patient + Single Date — no booking that day | Amber | "No appointment for {Name} on Jun 25" | "Clear date filter" |

### Group B — Patient + status filter conflict

| Code | Scenario | Hint color | Headline | Actions |
|---|---|---|---|---|
| B1 | Patient + Today-Confirmed — patient's today booking is pending | Blue | "{Name} has a booking today but it's not yet confirmed" | "View Today (all statuses)" |
| B2 | Patient + Pending (7 days) — patient's upcoming bookings are already confirmed | Blue | "{Name}'s upcoming bookings are already confirmed" | "View Upcoming" |
| B3 | Patient + Confirmed (7 days) — patient's upcoming bookings are still pending | Blue | "{Name} has no confirmed bookings in the next 7 days" | "View Upcoming" + "View All Bookings" |
| B4 | Patient + All-Pending — patient's bookings are all confirmed | Blue | "{Name}'s bookings are all confirmed" | "View All Bookings" |

### Group C — Patient has zero bookings at all

| Code | Scenario | Hint color | Headline |
|---|---|---|---|
| C1 | Patient registered but never booked | Slate/muted | "{Name} hasn't booked at this clinic yet" |

This is distinct from a filter conflict — no action buttons are shown because there is nothing to navigate to.

### Fallback
If no specific case matches (e.g. unusual combination), a generic amber hint shows:
> "{Name} has {N} booking(s) but none match this filter — View All Bookings →"

---

## Implementation Details

### Computed variables (added after `filteredBookings`, before JSX)

```ts
// All patient bookings ignoring all date/status gates
const allPatientBookings = activePatientFilter
  ? (bookings || []).filter(b => (b as any).patientId === activePatientFilter.id)
  : [];

// Categorise across time windows
const patientTodayBk     = allPatientBookings.filter(...)  // today
const patientPastBk      = allPatientBookings.filter(...)  // before today
const patientUpcomingBk  = allPatientBookings.filter(...)  // future (not today)
const patientThisWeekBk  = allPatientBookings.filter(...)  // this Mon–Sun
const patientNextWeekBk  = allPatientBookings.filter(...)  // next Mon–Sun
const patientLatestPast  = /* most recent past booking */
const patientNearestNext = /* nearest future booking */

// IIFE produces the hint object or null
const patientHint: { color, headline, detail, actions[] } | null = (() => { ... })();
```

### Hint panel (in empty state, below headline/detail)

- Only renders when `filteredBookings.length === 0 && activePatientFilter !== null && patientHint !== null`
- **Amber** = date/time window conflict (patient has bookings but they're in a different time slot)
- **Blue** = status filter conflict (patient has bookings but wrong confirmation state)
- **Slate/muted** = patient has zero bookings at this clinic
- Each action button calls `setQuickFilter(...)` or `setFilterDate(undefined)` inline — no page navigation needed
- Each button has `data-testid="button-patient-hint-{label}"` for testing

### Bottom action buttons

- "Clear all filters" button now also calls `clearBookingPatientFilter()` so clicking it truly resets everything
- "Configure Slots →" only appears when there is no patient filter AND the view is unfiltered All Bookings with zero results

---

## Design Tokens Used

| Role | Tailwind classes |
|---|---|
| Amber panel bg | `bg-amber-50 dark:bg-amber-900/20` |
| Amber panel border | `border-amber-200 dark:border-amber-700` |
| Amber headline | `text-amber-800 dark:text-amber-200` |
| Amber detail | `text-amber-700 dark:text-amber-300` |
| Amber action button | `bg-amber-200/80 ... hover:bg-amber-300/80` |
| Blue panel bg | `bg-sky-50 dark:bg-sky-900/20` |
| Blue panel border | `border-sky-200 dark:border-sky-700` |
| Blue headline | `text-sky-800 dark:text-sky-200` |
| Slate panel | `bg-muted/40 border-border/60` |

---

## What Does NOT Change

- The patient search dropdown UX (still debounce + keyboard nav)
- The patient filter pill in the filter bar
- The filter chip states (Today/Upcoming/Past/All etc.)
- The booking cards themselves
- Any backend API or database schema

All smart-hint logic is pure frontend computation from the already-loaded `bookings` array. No extra API calls.

---

## Future Improvements (not yet implemented)

- **Walk-in bookings with null patientId**: If a booking was created without linking a patient record, the patient filter won't find it. A future improvement could show a note: "Some walk-in bookings may not be linked to a patient record."
- **Deep-link to the specific booking**: Action buttons currently switch the filter view; they could also open the specific booking card directly.
- **Completed visits hidden in Upcoming**: The Upcoming filter excludes `visitStatus = 'completed'`. A note could be added: "If today's visit was already completed, it has moved to Past."
