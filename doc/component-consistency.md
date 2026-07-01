# Component Consistency Tracker

This document lists every UI pattern that appears in **more than one place** in the codebase.
Whenever you change a pattern in one file, check every other file listed under the same section
and apply the same change there too.

---

## 1. Quick-filter Chip Strip

A row of pill-shaped toggle buttons (Today / Upcoming / Past or Awaiting / All Bookings), each
showing an icon, a label, and a live count badge. Clicking a chip filters the booking list.

| File | Location | Chips |
|---|---|---|
| `client/src/components/BookingsPanel.tsx` | Line ~731 | Today · Upcoming · Past · All Bookings |
| `client/src/pages/DoctorDashboard.tsx` | Line ~920 | Today · Upcoming · Awaiting · All Bookings |

**Rules to keep consistent:**
- Chip shape: `rounded-xl border text-xs font-medium min-h-[44px] px-3 py-2`
- Active state colours: Today = sky-500, Upcoming = primary, Past = slate-500, Awaiting = amber-500, All = primary
- Count badge: `rounded-full px-1.5 py-0.5 leading-none min-w-[20px]`
- Toggle behaviour: clicking an already-active chip deactivates it (returns to `"all"`)
- `handleQuickFilter()` must clear `filterDate` and `filterEndDate` when called

---

## 2. Collapsible Date-range Filter Row

A card-style row that contains a Start → End calendar popover pair plus "This Week" and "Next
Week" shortcut chips. A close (X) button collapses the row; a SlidersHorizontal icon in the
chips strip reopens it.

| File | Location |
|---|---|
| `client/src/components/BookingsPanel.tsx` | Line ~998 |
| `client/src/pages/DoctorDashboard.tsx` | Line ~1023 |

**Rules to keep consistent:**
- Container: `bg-card border border-border/50 rounded-xl px-3 py-2 shadow-sm`
- Enter animation: `animate-in fade-in slide-in-from-top-1 duration-150`
- "Date range:" label hidden on mobile (`hidden sm:inline`)
- Start/End buttons use shadcn `<CalendarPicker>` inside `<Popover>` — NOT native `<input type="date">`
- Clear button: only visible when `filterDate || filterEndDate` — uses X icon + "Clear" text
- This Week chip: `rounded-full bg-violet-500` when active
- Next Week chip: `rounded-full bg-indigo-500` when active
- Week clear button: only visible when `quickFilter === "this-week" || "next-week"`
- Close button: `ml-auto h-11 w-11 rounded-xl`, sets `filterRowOpen = false`
- Default open: `filterRowOpen` initialised to `true`
- Toggle icon: `SlidersHorizontal` appears in chips row only when `!filterRowOpen`

---

## 3. Section Heading Card (Bookings / Appointments)

A card with a coloured left border stripe, a gradient background, an icon badge, a title, a
subtitle, and a right-aligned count.

| File | Location |
|---|---|
| `client/src/components/BookingsPanel.tsx` | Line ~1138 |
| `client/src/pages/DoctorDashboard.tsx` | Line ~1160 |

**Rules to keep consistent:**
- Container: `rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden`
- Left stripe: `w-1.5 shrink-0` — colour matches section theme
- Gradient: `bg-gradient-to-r from-{color}/[0.06] to-transparent`
- Icon badge: `h-9 w-9 rounded-xl bg-{color}/10 border border-{color}/20`
- Title: `text-base font-semibold tracking-tight`
- Subtitle: `text-xs text-muted-foreground mt-0.5`
- Count: `text-xs font-semibold text-muted-foreground tabular-nums shrink-0`

---

## 4. Sidebar Navigation Items

Vertical nav items with an icon, a label, and a subtitle. Active item gets a coloured background.

| File | Location |
|---|---|
| `client/src/pages/DoctorDashboard.tsx` | `NAV_ITEMS` array, line ~640 |
| `client/src/pages/ClinicDashboard.tsx` | Sidebar nav section |

**Colour coding:**
- Appointments / Bookings → primary green
- Configure Slots → blue
- Manage Doctors → teal
- Doctor Profile / Certifications → violet
- Leave Management → amber

---

## 5. Booking Card Colour Coding (left accent bar)

Each booking card gets a colour based on its date and status.

| Condition | Colour |
|---|---|
| Today | Emerald (`bg-emerald-500`) |
| Confirmed + Upcoming (future date) | Blue (`bg-blue-500`) |
| Past | Slate (`bg-slate-400`) |
| Pending | Amber (`bg-amber-400`) |
| Cancelled | Rose (`bg-rose-500`) |

**Files:**
- `client/src/components/BookingsPanel.tsx` (clinic)
- `client/src/pages/DoctorDashboard.tsx` → `AppointmentCard` component

---

## 6. Bill / Billing Cards

| File | Purpose |
|---|---|
| `client/src/components/BillingHistoryPanel.tsx` | Full billing history with date grouping |
| `client/src/pages/DoctorDashboard.tsx` | Simplified bill view inside appointment card |

**Rules:**
- All prices in ₹ (Indian Rupees) — never `$`
- Category grouping by date header when multiple billing dates exist
- `paymentStatus === 'paid'` = green badge; `'unpaid'` = amber badge; `'waived'` = slate badge
- Minimum font size: `text-xs` — never smaller

---

## 7. API Calls (mandatory rule)

All API calls **everywhere** must use `apiRequest()` from `@/lib/queryClient`.
Never use bare `fetch('/api/...')` — it breaks on Render where frontend and backend are on
different domains.

| Pattern | Files to check |
|---|---|
| `fetch('/api/...')` | Search whole codebase — any match is a bug |
| `apiRequest(...)` | `@/lib/queryClient` — correct pattern |

---

## 8. Patient Search Inline (search slot in chips row)

A search slot that sits at the right end of the quick-filter chips row. Shows a magnifier icon
at rest; expands to a text input on click; shows a patient-result dropdown; collapses to an
active-patient chip when a patient is selected.

| File | Location |
|---|---|
| `client/src/components/BookingsPanel.tsx` | Line ~808 |

Currently clinic-only. If a similar patient search is added to the Doctor Dashboard, follow the
same expand/collapse pattern and active-chip style.

---

## Change Checklist

When you edit **any** component listed above, run through this checklist:

1. Find every other file in the same section above.
2. Apply the same visual/behavioural change to each linked file.
3. Update this document if the pattern itself changes (add new files, update rules).
4. If the change involves a colour token, check `client/src/index.css` and `tailwind.config.ts`.
5. If the change involves a shared component (e.g. `AppointmentCard`, `BillingHistoryPanel`),
   check every page that imports it.
