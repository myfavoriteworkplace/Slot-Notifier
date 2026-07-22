# Patient Search & Filtering — Clinic/Doctor Admin Bookings

**Component**: `client/src/components/BookingsPanel.tsx`  
**Library**: `client/src/lib/booking-list.ts`

---

## Overview

The bookings panel has two independent filter layers that can be combined:

```
All clinic bookings
  → [Tab filter: Today / Upcoming / Past / This Week / Next Week / Date Range / All]
  → [Patient filter: specific patient selected from search]
  → Displayed results
```

When both filters are active, results must satisfy **both** simultaneously. This can produce zero results even when the patient has bookings — e.g. selecting "Upcoming" for a patient whose only bookings are in the past.

---

## Tab Filter Counts — Always Clinic-Wide

The badge counts shown on each tab chip (Today, Upcoming, Awaiting, Past, All Bookings) are **always clinic-wide totals**. They are computed server-side in `storage.getClinicBookingsPaged` using only `clinicId` as the scope — the `patientId` param is intentionally excluded from the stats query.

This means:
- Tab counts **never change** when a patient is selected or a date filter is applied
- They reflect the full clinic's appointment volume at all times
- Filtering is visible only in the content area below the filter bar

---

## Patient Filter — Search & Selection

The patient search input (magnifier icon in the filter bar) accepts name, PAT code, phone, or email. Selecting a result sets `activePatientFilter = { id, name, patientCode }`.

### Patient filter chip
Once a patient is selected, the search input is replaced by a chip showing:
```
[avatar] Richi  PAT-0015  · 54 visits total  [×]
```
- The **"X visits total"** count comes from a dedicated secondary query (`filter=all&patientId=X`) that fetches all of that patient's bookings across all tabs — independent of whatever tab filter is currently active.
- When a tab filter further narrows the results, the content banner updates to: **"Showing 3 of 54 visits"**
- Clicking `×` clears the patient filter and returns to the full clinic view

---

## Content Area — Results Count

### With patient filter active (results found)
A banner appears above the cards:
```
👥 Richi  PAT-0015  · Showing 3 of 54 visits          [Collapse all]
```
or when the tab shows all of the patient's bookings:
```
👥 Richi  PAT-0015  · 54 visits total                 [Collapse all]
```

### With date/week filter active only (no patient selected)
A subtle pill above the cards shows:
```
⊞ Showing 7 results for Jun 20 – Jun 25
```
This pill only appears for This Week, Next Week, or custom date range filters (not for Today / Upcoming / Past / All which are the main navigation tabs).

---

## Empty State — Context-Aware Messaging

### No patient filter active
The headline and detail line are tailored to the active tab:

| Active tab | Headline | Detail |
|---|---|---|
| Today | "No bookings today" | "No slots are booked for today. Check Upcoming for future appointments." |
| Upcoming | "No upcoming appointments" | "There are no future appointments. Past bookings may be in the Past filter." |
| Past | "No past appointments" | "No appointment history yet — your clinic is just getting started!" |
| This Week | "Nothing scheduled this week" | "No appointments fall within Mon–Sun of this week. Try Next Week or All Bookings." |
| Next Week | "Nothing booked next week" | "No appointments are scheduled for next week yet." |
| Date range | "No appointments in this range" | "No bookings fall in the selected date range. Clear the date filter to see all." |
| All (no filter) | "No bookings yet" | "Once patients book a slot, their appointments will appear here." |

### Patient filter active + no results
The generic headline/detail is **replaced entirely** by a smart hint panel (amber, blue, or slate) — the two layers never stack on top of each other.

---

## Smart Patient Hint Panel

When a patient is selected but the current tab+filter combination returns zero results, a contextual hint panel appears instead of the generic empty state.

### How patient total is known
A secondary query (`/api/auth/clinic/bookings?filter=all&patientId=X&pageSize=500`) runs whenever a patient filter is active. This gives the complete patient history independent of the active tab. The hint logic uses this data — not the tab-filtered list — to determine what to say.

### Group A — Time filter conflict (amber panel)

| Scenario | Headline | Actions shown |
|---|---|---|
| Patient + Today — no booking today | "{Name} has no booking today" | "View Past Bookings" and/or "View Upcoming" |
| Patient + Upcoming — all bookings are past | "{Name} has no upcoming appointments" | "View Today" + "View Past Bookings" |
| Patient + Past — all bookings are future | "{Name} has no past appointments" | "View Today" + "View Upcoming" |
| Patient + This Week — booking is next week | "{Name} has no appointment this week" | "Check Next Week" + "View Upcoming" |
| Patient + Next Week — booking is this week | "{Name} has no appointment next week" | "Check This Week" + "View Upcoming" |
| Patient + Date range — outside range | "No appointment for {Name} on Jun 20–25" | "Clear date filter" |
| Patient + Single date — no booking that day | "No appointment for {Name} on Jun 25" | "Clear date filter" |

Each amber hint includes a context line with the patient's last visit date and/or next appointment date where known.

### Group B — Status filter conflict (blue panel)

| Scenario | Headline | Actions shown |
|---|---|---|
| Today-Confirmed filter — patient's today booking is pending | "{Name} has a booking today but it's not yet confirmed" | "View Today (all statuses)" |
| Pending-7-days filter — patient's upcoming bookings are all confirmed | "{Name}'s upcoming bookings are already confirmed" | "View Upcoming" |
| Confirmed-7-days filter — patient's upcoming bookings are pending | "{Name} has no confirmed bookings in the next 7 days" | "View Upcoming" + "View All Bookings" |
| All-Pending filter — patient's bookings are all confirmed | "{Name}'s bookings are all confirmed" | "View All Bookings" |

### Group C — Patient has zero bookings (slate/muted panel)

| Scenario | Headline |
|---|---|
| Patient registered but never booked at this clinic | "{Name} hasn't booked at this clinic yet" |

No action buttons are shown — there is nothing to navigate to.

### Fallback

If none of the above cases match, a generic amber hint shows:
> "{Name} has {N} booking(s) but none match this filter — View All Bookings →"

---

## Collapsed Card State (Patient Search)

When a patient filter is active and 2 or more bookings are found, all cards start **collapsed** automatically so the admin sees a compact scannable list. Each collapsed card shows:
- Accent bar
- Patient header (name, booking#, PAT code, phone, age/gender, status badge)
- Date + time row with chevron

Tapping the date row or chevron **expands** the card in place (showing visit type, treatment, consent, progress strip, and action buttons). The header remains clickable to open the full booking dialog.

The "Collapse all / Expand all" toggle in the patient banner controls all cards at once.

---

## Implementation Details

### Data flow

```
useInfiniteQuery (filter=quickFilter, patientId?, dateFrom?, dateTo?)
  → bookings[]          — displayed cards (tab+patient filtered)
  → bookingStats        — clinic-wide tab badge counts (server ignores patientId for stats)

useQuery (filter=all, patientId=X)  [only when patient filter active]
  → allPatientBookings[]  — complete patient history for hint logic + chip count
```

### Key derived values

```ts
// All patient bookings across all tabs (for hint logic & chip count)
const allPatientBookings = allPatientBookingsData?.data ?? [];

// Time buckets — computed from allPatientBookings, not from the tab-filtered list
const patientPastBk     = allPatientBookings.filter(b => bookingDate < todayStart);
const patientUpcomingBk = allPatientBookings.filter(b => bookingDate >= todayStart && ...);
const patientTodayBk    = allPatientBookings.filter(b => dateStr === todayStr);
const patientThisWeekBk = allPatientBookings.filter(b => date in thisWeek);
const patientNextWeekBk = allPatientBookings.filter(b => date in nextWeek);
const patientLatestPast  = /* most recent past booking */
const patientNearestNext = /* nearest future booking */

// Tab badge counts — from clinic-wide stats, never patient-scoped
const todaysBookingsCount  = bookingStats?.todayCount ?? 0;
const futureBookingsCount  = bookingStats?.upcomingCount ?? 0;
const pastBookingsCount    = bookingStats?.pastCount ?? 0;

// emptyStateMeta uses allPatientBookings.length (not filteredBookings.length)
// so "hasn't booked yet" only fires when the patient truly has zero history
const emptyStateMeta = getBookingEmptyStateMeta({
  activePatientBookingsCount: allPatientBookings.length,
  ...
});
```

### Empty state rendering rule

```tsx
// Generic headline suppressed when patientHint provides richer context
{!patientHint && <div>{emptyStateMeta.title} / {emptyStateMeta.detail}</div>}
{patientHint && <HintPanel ... />}
```

---

## Known Edge Cases & Limitations

### Upcoming filter excludes completed-future bookings
`filterAndSortBookings` excludes `visitStatus === 'completed'` from the Upcoming tab. A future-dated slot already marked "Visit Done" disappears from Upcoming, Past (date-gated to before today), and This/Next Week — it is only visible under All Bookings. No message warns about this today; noted as a future improvement.

### Walk-in bookings with null patientId
If a booking was created without linking a patient record, the patient filter will not surface it. A future note could flag: "Some walk-in bookings may not be linked to a patient record."

### Infinite scroll and patient total count
The chip count (`allPatientBookings.length`) comes from a `pageSize=500` request. Patients with more than 500 bookings would show an undercount. In practice this is not a concern for clinic volumes.

---

## Design Tokens

| Role | Tailwind classes |
|---|---|
| Patient chip border | `border-primary/40 ring-primary/10` |
| Patient banner bg | `bg-primary/5 border-primary/15` |
| Date-filter results pill | `bg-muted/40 border-border/50 text-muted-foreground` |
| Amber hint bg | `bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700` |
| Amber headline | `text-amber-800 dark:text-amber-200` |
| Blue hint bg | `bg-sky-50 dark:bg-sky-900/20 border-sky-200 dark:border-sky-700` |
| Blue headline | `text-sky-800 dark:text-sky-200` |
| Slate hint bg | `bg-muted/40 border-border/60` |

---

## What Does NOT Change

- Tab chip counts — always clinic-wide, never react to patient or date filter
- Patient search dropdown UX (debounce, keyboard nav, PAT code highlight)
- Booking cards themselves
- Any backend API or database schema — all logic is pure frontend
