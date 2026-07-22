# Patient Search & Filtering — Clinic and Doctor Admin Bookings

> **Where this applies:**
> - **Clinic admin**: Bookings panel in the clinic dashboard (`BookingsPanel.tsx`)
> - **Doctor admin**: Appointments section in the doctor dashboard (`DoctorDashboard.tsx`)
> - **Shared helper**: `client/src/lib/booking-list.ts` (empty-state messages)

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
| **Awaiting** | Appointments waiting for approval |

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
| **Awaiting** | Appointments waiting for your approval |
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

---

## Implementation summary (for developers)

### Backend

- `storage.getClinicBookingsPaged` and `storage.getDoctorBookingsPaged` build a SQL `WHERE` clause that combines:
  - clinic/doctor scope
  - active tab filter (`filter`)
  - date range (`dateFrom`, `dateTo`)
  - patient filter (`patientId`)
  - optional text search (`search`)
- A separate count called `patientTotalCount` is returned when `patientId` is provided. It ignores tab and date filters but respects clinic/doctor scope, so the UI can say "Alice has 5 bookings but none match this filter."

### Frontend

- `BookingsPanel.tsx` (clinic) and `DoctorDashboard.tsx` (doctor) both send the same filter parameters to the server.
- Date pickers no longer reset the active tab when selected.
- `getBookingEmptyStateMeta` in `client/src/lib/booking-list.ts` builds the patient-aware and tab-aware empty-state messages.
- Both dashboards show a **Clear all filters** button when filters are active and no results are found.

---

## What has not changed

- Booking cards themselves.
- The backend API shape (only the addition of `patientTotalCount` in stats).
- The patient search dropdown experience (debounce, keyboard navigation, PAT code highlight).
- Tab badge counts remain total counts, not filtered counts.
