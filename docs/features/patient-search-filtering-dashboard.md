# Patient Search & Filtering — Clinic and Doctor Admin Bookings

> **Where this applies:**
> - **Clinic admin**: Bookings panel in the clinic dashboard (`BookingsPanel.tsx`)
> - **Doctor admin**: Appointments section in the doctor dashboard (`DoctorDashboard.tsx`)
> - **Shared helper**: `client/src/lib/booking-list.ts` (empty-state messages, group helpers)

---

## In plain English

Think of the bookings screen as a stack of sieves. Each sieve narrows the list a little more. You can use one sieve, or several at once:

1. **Pick a tab** — e.g., Today, Upcoming, Awaiting, All Appointments
2. **Pick a patient** — search and select a specific person
3. **Pick a date range** — only show bookings between two dates
4. **Pick a clinic** — doctor only: only show bookings from one clinic

The results are always the appointments that pass **every** sieve you have turned on. If you turn on too many sieves at once, the list can become empty even though the patient or clinic has bookings elsewhere.

---

## How the filters stack (additive filtering)

Filters are **additive** (AND logic). This means each new filter makes the list smaller, not bigger.

### Example

| What you select | What the screen shows |
|---|---|
| Tab = **Today** | Only today's appointments |
| Tab = **Today** + Patient = **Alice** | Only Alice's appointments that are today |
| Tab = **Today** + Patient = **Alice** + Date = **Jun 20 – Jun 25** | Only Alice's appointments that fall inside Jun 20–25 **and** are today. Usually this will be empty unless today is inside that range. |
| Tab = **All Appointments** + Patient = **Alice** | Every appointment Alice has, across all dates and statuses |
| Tab = **Upcoming** + Patient = **Alice** | Alice's future appointments only |

### Important rule

- **Tab + Patient + Date + Clinic** are all active at the same time.
- If the list is empty, it means the combination is too narrow, not that there are no bookings at all.
- To search across everything, use **All Appointments** with no date filter.

---

## Sort order — how appointments are ordered within each filter

Sort order is **consistent and context-aware**. The SQL `ORDER BY` changes based on the active tab so the most relevant appointments always appear first.

### Clinic admin — sort rules

| Tab | Sort order |
|---|---|
| **All Bookings** | Future/today first (ascending by time), then past (ascending by time) |
| **All Pending** | Future/today first (ascending by time), then past (ascending by time) |
| **Today** | Ascending by slot start time (earliest first) |
| **Today Confirmed** | Ascending by slot start time |
| **Upcoming** | Ascending by slot start time (nearest next) |
| **This Week** | Ascending by slot start time |
| **Next Week** | Ascending by slot start time |
| **Pending 7 Days** | Ascending by slot start time |
| **Confirmed 7 Days** | Ascending by slot start time |
| **Past** | Descending by slot start time (most recent past first) |

### Doctor admin — sort rules

| Tab | Sort order |
|---|---|
| **All Appointments** | Future/today first (ascending by time), then past (ascending by time) |
| **All Owned** | Future/today first (ascending by time), then past (ascending by time) |
| **Today** | Ascending by slot start time |
| **Upcoming** | Ascending by slot start time |
| **Awaiting** | Ascending by slot start time (all awaiting items are today or future) |
| **Pending 7 Days** | Ascending by slot start time |
| **Confirmed 7 Days** | Ascending by slot start time |
| **Past** | Descending by slot start time (most recent past first) |

### How the mixed sort works (All / All Pending / All Appointments / All Owned)

These filters span both future and past dates. To keep the most actionable appointments at the top, the server uses a SQL `CASE WHEN` expression as the primary sort key:

```sql
CASE WHEN slots.startTime >= todayStart THEN 0 ELSE 1 END ASC,
slots.startTime ASC,
bookings.id ASC
```

This means:
- All **future and today** appointments sort first (group 0), ordered by earliest time.
- All **past** appointments sort second (group 1), ordered by oldest-to-newest within the past.

The sort is **server-side only** — it applies to every page of paginated results. There is no client-side re-sorting.

---

## Section headers — Future / Today and Past groups

When a mixed-date filter is active **without a date-range override**, the booking list is visually split into two labelled sections:

| Section header | When it appears |
|---|---|
| **Future / Today** | At least one upcoming or today appointment is in the result set |
| **Past** | At least one past appointment is in the result set |

Each header shows the count of appointments in that group. Clinic admin headers also include a **collapse/expand** toggle so staff can hide the past group.

### Which filters show section headers

| Dashboard | Filters that show Future/Past headers |
|---|---|
| **Clinic admin** | All Bookings, All Pending (only when no date-range override is active) |
| **Doctor admin** | All Appointments, Awaiting, All Owned (only when no date-range override is active) |

> **Note — Doctor Awaiting:** The `awaiting` server filter already limits results to slots on or after today (`slots.startTime >= todayStart`), so the **Past** header will never appear for this tab. Only the **Future / Today** header will show when awaiting bookings exist.

### When headers are hidden

Headers are suppressed when:
- A date-range filter is active (start or end date picked) — the date picker implies an intentional scope, so grouping adds no value.
- A patient filter is active — the list may be too small to benefit from section breaks.
- The active tab is not a mixed-date filter (e.g., Today, Upcoming, Past — these already have a fixed time scope).

---

## Clinic admin dashboard

### Tabs available

| Tab | Shows |
|---|---|
| **All Bookings** | Every booking in the clinic |
| **Today** | Bookings scheduled for today |
| **Today Confirmed** | Today's bookings that are already confirmed |
| **Upcoming** | Confirmed future bookings (not completed) |
| **Past** | Bookings that happened before today |
| **This Week** | Bookings from Monday to Sunday of this week |
| **Next Week** | Bookings from Monday to Sunday of next week |
| **Pending 7 Days** | Unconfirmed bookings in the next 7 days |
| **Confirmed 7 Days** | Confirmed bookings in the next 7 days |
| **All Pending** | Every unconfirmed booking in the clinic |

### Patient search

- Click the magnifier icon or the patient search box.
- Type a name, PAT code, phone number, or email.
- Matching patients appear in a dropdown.
- Select a patient to filter the list to that person only.
- The search box turns into a chip showing the patient's name and PAT code.
- Click the **×** on the chip to clear the patient filter.

### Date range filter

- Click the **filter** icon (sliders) to open the date row.
- Pick a **Start** date and an optional **End** date.
- The tab filter stays active. The date range works **on top of** the tab.
- For example, if you pick **Upcoming** and a date range of **Jun 20–Jun 25**, you see future bookings that also fall inside Jun 20–25.

---

## Doctor admin dashboard

### Tabs available

| Tab | Shows |
|---|---|
| **Today** | Your appointments scheduled for today (approved by you) |
| **Upcoming** | Your approved future appointments |
| **Awaiting** | Appointments waiting for your approval (today and future only) |
| **All Appointments** | Every booking assigned to you, regardless of status or date |
| **All Owned** | Every booking you have accepted or that is admin-confirmed on your behalf |
| **Pending 7 Days** | Unconfirmed bookings assigned to you in the next 7 days |
| **Confirmed 7 Days** | Confirmed bookings assigned to you in the next 7 days |

### Patient search

Works exactly like the clinic dashboard:
- Type in the search box to find a patient by name, PAT code, phone, or email.
- Select a patient to filter the list to that person's appointments only.
- The patient filter respects the currently selected tab.
- To do a broad search for a patient, select **All Appointments** first.

### Date range filter

- Open the date filter row and pick a start/end date.
- The selected tab stays active. The date range is applied together with the tab.
- Example: **Today** + date range **Jun 20–Jun 25** shows today's appointments only if today falls inside Jun 20–25.

### Clinic filter (doctor only)

- If you work at more than one clinic, a dropdown lets you narrow the list to one clinic.
- This filter works together with the tab, patient, and date filters.

---

## Tab badge counts — why they never change

The small numbers on the tab chips are **clinic-wide totals** (or, for the doctor, **doctor-wide totals**). They are calculated independently of the patient, date, and clinic filters.

### What this means

- Selecting a patient does **not** shrink the badge numbers.
- Selecting a date range does **not** shrink the badge numbers.
- Selecting a clinic does **not** shrink the badge numbers.
- The numbers always show the big picture: how many appointments exist in total for each tab.

### Why this matters

The badge counts are navigation hints. They tell you where the work is. If you need to see only one patient's numbers, look at the results list and the patient chip, not the tab badges.

---

## Patient chip and results count

When a patient is selected, a chip appears:

```
[avatar] Alice  PAT-0015  · 8 visits total  [×]
```

- The chip shows the patient's name, PAT code, and the total number of visits they have in the current scope.
- The **total** count is the number of appointments that match the patient filter **ignoring** the active tab and date range, but respecting clinic/doctor scope.
- The list below shows only the appointments that also pass the active tab and date filters.
- If the tab hides some of the patient's appointments, you will see something like:  
  **"Showing 2 of 8 visits"**

---

## Empty-state messages — what they tell you

When the filtered list is empty, the screen shows a message that explains **why** it is empty and what you can do about it.

### No patient selected

| Tab | Message example |
|---|---|
| Today | "No bookings today. No slots are booked for today. Check Upcoming for future appointments." |
| Upcoming | "No upcoming appointments. There are no future appointments. Past bookings may be in the Past filter." |
| Past | "No past appointments. No appointment history yet — your clinic is just getting started!" |
| This Week | "Nothing scheduled this week. No appointments fall within Mon–Sun of this week. Try Next Week or All Bookings." |
| Next Week | "Nothing booked next week. No appointments are scheduled for next week yet." |
| Date range only | "No appointments in this range. No bookings fall in the selected date range. Clear the date filter to see all." |
| All / none | "No bookings yet. Once patients book a slot, their appointments will appear here." |

### Patient selected

The messages become patient-specific and distinguish between two cases:

#### 1. Patient has no bookings at all in this scope

> **No bookings found for Alice**  
> Alice has no bookings matching the active tab. Try switching to All Bookings.

> **No bookings found for Alice**  
> Alice has no bookings on Jun 20. Clear the date filter or switch to All Bookings.

#### 2. Patient has bookings, but the current tab or date is hiding them

> **No matching appointments for Alice**  
> Alice has 5 bookings, but the active tab filter is hiding them. Switching to All Bookings will show Alice's complete schedule.

> **No matching appointments for Alice**  
> Alice has 5 bookings, but none between Jun 20 and Jun 25. Try adjusting the date range or tab.

This is the "smart" part: the system knows whether the patient has bookings elsewhere and tells you exactly how to find them.

---

## How to do a global search

If you want to search without any tab or date restriction:

1. Select the **All Appointments** tab (or **All Bookings** in the clinic).
2. Clear any date range that is active.
3. Select the patient in the search box.

This shows every appointment for that patient across all dates and statuses.

---

## Common mistakes and what to do

### "I searched a patient and got nothing, but I know they have an appointment"

- Check which tab is active. If you are on **Today**, switch to **All Appointments** or **Upcoming**.
- Check if a date range is active. Clear it if necessary.
- Check if a clinic filter is active (doctor dashboard). Switch to **All clinics**.

### "I picked a date range and everything disappeared"

- The date range is applied together with the active tab. If the tab is **Today** and the date range does not include today, the result will be empty.
- Switch to **All Appointments** to see bookings across that date range.

### "The tab numbers didn't change when I selected a patient"

- This is by design. Tab numbers are total counts, not filtered counts. They help you see the overall workload at a glance.

### "Past appointments appear after future ones in the All tab — is that right?"

- Yes, this is intentional. Mixed-date filters (All, All Pending, All Owned) always show **Future / Today** appointments first, then **Past** appointments. The section headers make this explicit.

---

## Implementation summary (for developers)

### Backend — `server/storage.ts`

Both `getClinicBookingsPaged` and `getDoctorBookingsPaged` build a SQL `WHERE` clause from:
- clinic/doctor scope condition
- active tab filter (`filter` param → `filterCond`)
- date range (`dateFrom`, `dateTo` → `dateRangeCond`)
- patient filter (`patientId` → `patientCond`)
- optional text search (`search` → `searchCond`)

All conditions are ANDed together via Drizzle's `and()`.

#### Conditional ORDER BY (added in the sorting update)

The `ORDER BY` clause is chosen dynamically before the paginated `SELECT` runs:

```ts
// Clinic (getClinicBookingsPaged)
const clinicOrderBy: any[] =
  (filter === 'all' || filter === 'all-pending')
    ? [sql`CASE WHEN ${slots.startTime} >= ${todayStart} THEN 0 ELSE 1 END`,
       asc(slots.startTime), asc(bookings.id)]
    : filter === 'past'
    ? [desc(slots.startTime), desc(bookings.id)]
    : [asc(slots.startTime), asc(bookings.id)];

// Doctor (getDoctorBookingsPaged)
const doctorOrderBy: any[] =
  (filter === 'all' || filter === 'owned')
    ? [sql`CASE WHEN ${slots.startTime} >= ${todayStart} THEN 0 ELSE 1 END`,
       asc(slots.startTime), asc(bookings.id)]
    : filter === 'past'
    ? [desc(slots.startTime), desc(bookings.id)]
    : [asc(slots.startTime), asc(bookings.id)];
```

- **Count queries, stats queries, and `totalPages` are unchanged** — only the paginated `SELECT`'s `ORDER BY` changes.
- The sort is **deterministic** (startTime + id tie-breaker), so there are no duplicate or skipped rows across pages.

#### patientTotalCount

A separate count is returned when `patientId` is provided. It ignores tab and date filters but respects clinic/doctor scope, so the UI can say "Alice has 5 bookings but none match this filter."

---

### Frontend — shared helper (`client/src/lib/booking-list.ts`)

#### `getTimeGroup(booking, todayStart): 0 | 1`

Returns `0` for Future/Today slots and `1` for Past slots. Used by both dashboards to assign each booking card to a section group, matching the server-side CASE WHEN sort:

```ts
export function getTimeGroup(booking: BookingWithSlot, todayStart: Date): number {
  const d = new Date(booking.slot.startTime);
  const isPast = d < todayStart && format(d, "yyyy-MM-dd") !== format(todayStart, "yyyy-MM-dd");
  return isPast ? 1 : 0;
}
```

#### `getStatusGroup(booking, todayStart, todayStr): 0 | 1 | 2`

Unchanged — returns `0` (Pending), `1` (Confirmed/Upcoming), `2` (Past). Still used internally by `getBookingDisplayMeta`.

#### `getBookingEmptyStateMeta`

Unchanged — builds patient-aware and tab-aware empty-state messages.

---

### Frontend — clinic admin (`client/src/components/BookingsPanel.tsx`)

#### `isGrouped` flag

```ts
const isGrouped = (quickFilter === 'all' || quickFilter === 'all-pending')
  && !filterDate && !filterEndDate;
```

When `true`, `bookingsForDialog.flatMap` emits a section-header divider element before the first card of each new group.

#### Group config (2 groups)

```ts
const groupConfig = [
  { label: 'Future / Today', textColor: 'text-primary',           ... },
  { label: 'Past',           textColor: 'text-muted-foreground',  ... },
];
```

#### Group assignment per card

```ts
const group = isGrouped ? getTimeGroup(booking, todayStart) : -1;
const showDivider = isGrouped && group !== lastGroup;
if (isGrouped) lastGroup = group;
```

The divider counts bookings in the group using `filteredBookings.filter(b => getTimeGroup(b, todayStart) === group).length`.

#### Collapse/expand

Each section header has a chevron button that toggles `collapsedGroups[group]`. Cards in a collapsed group are hidden via `!collapsedGroups[group] && <AppointmentCard ...>`.

---

### Frontend — doctor admin (`client/src/pages/DoctorDashboard.tsx`)

The booking grid uses an IIFE wrapping a `flatMap` to track group state across iterations:

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
  {(() => {
    const isGrouped = (quickFilter === 'all' || quickFilter === 'awaiting' || quickFilter === 'owned')
      && !filterDate && !filterEndDate;
    const drGroupConfig = [
      { label: 'Future / Today', ... },
      { label: 'Past',           ... },
    ];
    let drLastGroup = -1;
    return displayBookings.flatMap((booking) => {
      // ...per-card vars (isApptToday, isApptPast, etc.)...
      const drGroup = isGrouped ? (isApptPast ? 1 : 0) : -1;
      const drShowDivider = isGrouped && drGroup !== drLastGroup;
      if (isGrouped) drLastGroup = drGroup;
      return [
        drShowDivider ? <SectionDivider key={...} ... /> : null,
        <AppointmentCard key={booking.id} ... />,
      ];
    });
  })()}
</div>
```

The section divider spans all grid columns via `col-span-full`. Group card counts are computed inline by filtering `displayBookings`.

---

## What has not changed

- Booking cards themselves (styling, actions, modal behaviour).
- The backend API shape (only the `ORDER BY` in the paginated query changed; no response fields added or removed).
- The patient search dropdown experience (debounce, keyboard navigation, PAT code highlight).
- Tab badge counts — still total counts, not filtered counts.
- Pagination — `total`, `totalPages`, `page`, `pageSize`, and all stats queries are unchanged. Only the paginated `SELECT`'s `ORDER BY` changes.
- The `getStatusGroup` helper — still used internally by `getBookingDisplayMeta`; `getTimeGroup` is an addition, not a replacement.
