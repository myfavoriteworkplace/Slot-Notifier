# Clinic & Doctor Dashboard — UI Standards & Component Reference

> **Scope**: `client/src/pages/ClinicDashboard.tsx` and `client/src/pages/DoctorDashboard.tsx`  
> **Purpose**: Coding standard and knowledge-transfer reference for anyone adding a new component, panel, or section to either dashboard. Every pattern here is already in production — copy it exactly, do not invent new variants.

---

## Table of Contents

1. [Page Shell Structure](#1-page-shell-structure)
2. [Hero Banner (Dark Green Header)](#2-hero-banner-dark-green-header)
3. [Hero Stat Mini-Cards (Inside Banner)](#3-hero-stat-mini-cards-inside-banner)
4. [Sidebar Navigation](#4-sidebar-navigation)
5. [Panel Header — Mandatory Pattern](#5-panel-header--mandatory-pattern)
6. [White Filter Cards (Below Panel Header)](#6-white-filter-cards-below-panel-header)
7. [Dynamic Section Heading (Filtered List Header)](#7-dynamic-section-heading-filtered-list-header)
8. [Booking / Appointment Cards](#8-booking--appointment-cards)
9. [Colour System & Accent Reference](#9-colour-system--accent-reference)
10. [Responsive Patterns](#10-responsive-patterns)
11. [Typography Rules](#11-typography-rules)
12. [Dark Mode Rules](#12-dark-mode-rules)
13. [Data States — Required on Every Fetch](#13-data-states--required-on-every-fetch)
14. [New Component Checklist](#14-new-component-checklist)

---

## 1. Page Shell Structure

Both dashboards share the **same outer wrapper pattern**. Never deviate from this.

```tsx
// Root — sets page background
<div className="min-h-screen bg-muted/30">

  {/* Full-width warning banners (no container) — e.g. temp password, subscription alerts */}
  <div className="bg-gradient-to-r from-amber-500/90 ... text-white px-4 py-2 ...">
    ...
  </div>

  {/* ═══ SINGLE PAGE CONTAINER — wraps EVERYTHING below the warning banner ═══ */}
  <div className="container mx-auto px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:pb-8">

    {/* Hero banner */}
    <div className="rounded-2xl overflow-hidden shadow-2xl mb-6 sm:mb-8 border border-white/10">
      ...
    </div>

    {/* Two-column layout: sidebar + main */}
    <div className="flex flex-col lg:flex-row gap-6 lg:items-start">
      <aside className="hidden lg:flex lg:flex-col lg:w-60 shrink-0 lg:sticky lg:top-[70px] space-y-3">
        ...
      </aside>
      <main className="flex-1 min-w-0">
        ...
      </main>
    </div>

  </div>

  {/* Mobile bottom nav — fixed, outside container */}
  <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden ...">...</nav>

  {/* Sheets and Dialogs — portalled, can live anywhere in the tree */}
  <Sheet>...</Sheet>
  <Dialog>...</Dialog>

</div>
```

### Critical rules

| Rule | Reason |
|---|---|
| **One** `container mx-auto px-4 sm:px-6 lg:px-8` wrapper per page | Prevents sub-pixel misalignment between hero and content |
| Hero banner and two-column layout share the same parent container | Guarantees identical left/right margins |
| `pb-24 lg:pb-0` on container, NOT on inner divs | Gives mobile bottom nav clearance consistently |
| `lg:items-start` on the two-column flex row | Prevents sidebar stretching on long pages |
| Sheets/Dialogs placed outside the two-column layout | Avoids z-index and portal stacking issues |

### ClinicDashboard vs DoctorDashboard shell comparison

| Property | ClinicDashboard | DoctorDashboard |
|---|---|---|
| Container class | `container mx-auto px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:pb-8` | Same |
| Two-column wrapper | `flex flex-col lg:flex-row gap-6 lg:items-start` | Same |
| Sidebar width | `lg:w-56` | `lg:w-60` |
| Sidebar sticky | `lg:sticky lg:top-[70px]` | Same |

---

## 2. Hero Banner (Dark Green Header)

The dark green banner at the top of each dashboard. **Do not create a second banner** — there is exactly one per dashboard.

```tsx
<div className="rounded-2xl overflow-hidden shadow-2xl mb-6 sm:mb-8 border border-white/10">

  {/* Top neon accent line */}
  <div className="h-[3px] bg-gradient-to-r from-accent via-primary to-accent" />

  {/* Main band */}
  <div className="relative bg-gradient-to-br from-[#052B22] via-[#085041] to-[#0A5540] px-5 py-5 sm:px-7 sm:py-6 overflow-hidden">

    {/* Grid texture — decorative only */}
    <div className="absolute inset-0 pointer-events-none opacity-[0.04]"
      style={{
        backgroundImage: "linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)",
        backgroundSize: "32px 32px",
      }}
    />
    {/* Ambient glow orbs */}
    <div className="absolute -top-24 -left-16 w-72 h-72 rounded-full bg-primary/20 blur-[100px] pointer-events-none" />
    <div className="absolute -bottom-16 -right-8 w-60 h-60 rounded-full bg-accent/15 blur-[80px] pointer-events-none" />

    {/* Content */}
    <div className="relative flex items-stretch gap-6">
      {/* LEFT — identity / clinic info */}
      ...
      {/* Vertical divider */}
      <div className="w-px bg-white/10 shrink-0 self-stretch" />
      {/* RIGHT — stat mini-cards grid */}
      ...
    </div>
  </div>

  {/* Bottom accent line */}
  <div className="h-[2px] bg-gradient-to-r from-accent via-primary to-accent opacity-60" />
</div>
```

### Do not hardcode hex values
Use `from-[#052B22]`, `via-[#085041]`, `to-[#0A5540]` only for the banner gradient — these are the dark green brand colours. Everything else must use CSS variable utilities (`bg-primary`, `text-primary`, `bg-accent`, etc.).

---

## 3. Hero Stat Mini-Cards (Inside Banner)

The 4 clickable stat tiles inside the dark green banner. **Both dashboards use exactly the same 4 tiles in the same order with the same colours.**

### Order and colour mapping

| # | Label | subTag | filter key | Text colour | BG | Border |
|---|---|---|---|---|---|---|
| 1 | Confirmed Today | — | `today` / `today-confirmed` | `text-sky-300` | `bg-sky-400/10` | `border-sky-400/20` |
| 2 | Confirmed Bookings | Next 7 Days | `confirmed-7days` | `text-emerald-300` | `bg-emerald-400/10` | `border-emerald-400/20` |
| 3 | Pending Confirmations | Next 7 Days | `pending-7days` | `text-amber-300` | `bg-amber-400/10` | `border-amber-400/20` |
| 4 | All Pending | — | `all-pending` / `awaiting` | `text-rose-300` | `bg-rose-400/10` | `border-rose-400/20` |

### Card template (copy exactly)

```tsx
{[
  {
    label: "Confirmed Bookings Today", shortLabel: "Confirmed Today", subTag: null,
    filter: "today-confirmed" as const,
    tooltip: "Appointments scheduled for today that have been confirmed.",
    value: todayConfirmedCount,
    Icon: CalendarIcon, text: "text-sky-300", bg: "bg-sky-400/10", border: "border-sky-400/20",
  },
  // ... (see colour table above for remaining 3)
].map(({ label, shortLabel, subTag, filter, tooltip, value, Icon, text, bg, border }, i) => (
  <TooltipProvider key={i} delayDuration={700}>
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={`flex items-start gap-2 px-2.5 py-3 rounded-xl border bg-white/[0.04] ${border}
            cursor-pointer transition-all hover:bg-white/[0.09] hover:scale-[1.02] active:scale-[0.98]
            min-h-[44px] ${quickFilter === filter ? 'ring-1 ring-white/50 bg-white/[0.09]' : ''}`}
          onClick={() => { setQuickFilter(filter); }}
          data-testid={`stat-card-${filter}`}
        >
          <div className={`shrink-0 ${text} ${bg} p-1.5 rounded-lg mt-0.5`}>
            <Icon className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-2xl sm:text-lg font-extrabold text-white leading-none tabular-nums">
              {value}
            </p>
            <p className={`text-xs font-semibold mt-1 ${text} leading-snug`}>{shortLabel}</p>
            {subTag && (
              <span className={`inline-block text-xs font-medium ${text} opacity-60 mt-0.5 leading-none`}>
                {subTag}
              </span>
            )}
          </div>
          <Info className={`h-3 w-3 ${text} ${quickFilter === filter ? 'opacity-80' : 'opacity-50'} shrink-0 mt-1`} />
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[200px] text-center text-xs">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
))}
```

### Rules

- `delayDuration={700}` on every `TooltipProvider` — 0ms delay is reserved for sidebar nav only
- `data-testid={`stat-card-${filter}`}` must be present on every card
- `min-h-[44px]` — minimum tap target
- Numbers use `tabular-nums` to prevent layout shift as counts change
- `subTag` renders as a secondary muted line below the shortLabel — use for "Next 7 Days"

### Mobile — 2×2 grid

On mobile the 4 stat cards appear as a 2×2 grid inside the mobile profile card (`grid-cols-2`). They use the same order, labels, and colour tokens as the desktop version.

```tsx
{ label: "Confirmed Today",       filter: "today",           color: "bg-sky-400/20 border-sky-300/30" },
{ label: "Confirmed Bookings",    filter: "confirmed-7days", color: "bg-emerald-400/20 border-emerald-300/30" },
{ label: "Pending Confirmations", filter: "pending-7days",   color: "bg-amber-400/20 border-amber-300/30" },
{ label: "All Pending",           filter: "awaiting",        color: "bg-rose-400/20 border-rose-300/30" },
```

---

## 4. Sidebar Navigation

### Sidebar shell

```tsx
<aside className="hidden lg:flex lg:flex-col lg:w-60 shrink-0 lg:sticky lg:top-[70px] space-y-3">
  {/* Nav card */}
  <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
    <div className="p-2 space-y-0.5">
      {NAV_ITEMS.map(...)}
    </div>
  </div>
  {/* Additional sidebar widgets — QR panel, etc. */}
</aside>
```

### Nav item pattern

```tsx
<button
  onClick={() => setActiveTab(key)}
  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left
    ${isActive
      ? `${activeClass} border border-current/20`
      : "border border-transparent hover:bg-muted/50"}`}
  data-testid={`nav-${key}`}
>
  <div className={`h-8 w-8 rounded-lg border flex items-center justify-center shrink-0
    ${isActive ? iconClass : "bg-muted/50 border-border/50"}`}>
    <Icon className="h-4 w-4" />
  </div>
  <div className="min-w-0 flex-1">
    <p className="text-sm font-semibold leading-tight">{label}</p>
    <p className="text-[10px] text-muted-foreground">{subtitle}</p>
  </div>
  {isActive && <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${dotClass}`} />}
</button>
```

### Doctor Dashboard nav items

| Tab key | Label | Subtitle | Icon | Accent colour |
|---|---|---|---|---|
| `appointments` | Appointments | Today's schedule | `Calendar` | primary |
| `profile` | My Profile | Edit your details | `User` | violet |
| `certifications` | Certifications | Degrees & awards | `Award` | blue |
| `cases` | Case Studies | Patient cases | `BookOpen` | teal |
| `leaves` | Leave Management | Time off & availability | `CalendarOff` | amber |

Active class pattern: `bg-{colour}-500/10 border-{colour}-500/20 text-{colour}-700 dark:text-{colour}-400`

### Clinic Dashboard nav items

| Panel key | Label | Icon | Accent colour |
|---|---|---|---|
| `bookings` | Bookings | `CalendarIcon` | primary |
| `configure-slots` | Configure Slots | `Clock` | blue |
| `manage-doctors` | Manage Doctors | `Stethoscope` | teal |
| `clinic-profile` | Clinic Profile | `Building2` | violet |
| `book-a-slot` | Book a Slot | `Plus` | primary |
| `export-data` | Export Data | `Download` | amber |
| `inventory` | Inventory | `Package` | emerald |
| `website` | Clinic Website | `Globe` | sky |
| `accounts` | Accounts | `IndianRupee` | primary |
| `patients` | Patients | `Users` | rose |
| `analytics` | Analytics | `TrendingUp` | violet |

### Badge on nav item (unread count)

Show a count badge on the right side of a nav item when there are items needing attention (e.g. pending bookings, awaiting approvals):

```tsx
{key === "appointments" && awaitingCount > 0 && !isActive && (
  <span className="text-[10px] font-bold bg-amber-500 text-white rounded-full px-1.5 py-0.5 leading-none shrink-0">
    {awaitingCount}
  </span>
)}
```

---

## 5. Panel Header — Mandatory Pattern

**Every panel section in both dashboards must start with this header.** No exceptions. Never use a plain `<h2>`, a bare div with a title, or any other ad-hoc header style.

```tsx
<div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
  <div className="flex">
    {/* Coloured left accent bar */}
    <div className="w-1.5 bg-[colour]/60 shrink-0" />
    {/* Gradient header row */}
    <div className="flex-1 px-5 py-4 bg-gradient-to-r from-[colour]/[0.06] to-transparent flex items-center gap-3">
      {/* Icon box */}
      <div className="h-9 w-9 rounded-xl bg-[colour]/10 border border-[colour]/20 flex items-center justify-center shrink-0">
        <Icon className="h-[18px] w-[18px] text-[colour] dark:text-[colour]" />
      </div>
      {/* Title + subtitle */}
      <div>
        <h2 className="text-base font-semibold tracking-tight">Panel Title</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Static description of what this panel does.</p>
      </div>
    </div>
  </div>
</div>
```

### With an action button (Add, Export, Download)

Wrap the icon+title in an inner flex div and add `justify-between` to the gradient row:

```tsx
<div className="flex-1 px-5 py-4 bg-gradient-to-r from-[colour]/[0.06] to-transparent flex items-center justify-between gap-3">
  <div className="flex items-center gap-3">
    {/* icon box + title/subtitle (same as above) */}
  </div>
  <Button size="sm" className="shrink-0">Action</Button>
</div>
```

### Accent colour reference

#### Clinic Dashboard panels

| Panel | Left bar | Gradient from | Icon colour |
|---|---|---|---|
| Bookings | `bg-sky-500/60` | `from-sky-500/[0.06]` | `text-sky-600 dark:text-sky-400` |
| Configure Slots | `bg-blue-500/60` | `from-blue-500/[0.06]` | `text-blue-600 dark:text-blue-400` |
| Manage Doctors | `bg-teal-500/60` | `from-teal-500/[0.06]` | `text-teal-600 dark:text-teal-400` |
| Inventory | `bg-emerald-500/60` | `from-emerald-500/[0.06]` | `text-emerald-600 dark:text-emerald-400` |
| Clinic Website | `bg-sky-500/60` | `from-sky-500/[0.06]` | `text-sky-600 dark:text-sky-400` |
| Accounts | `bg-primary/60` | `from-primary/[0.06]` | `text-primary` |
| Patients | `bg-rose-500/60` | `from-rose-500/[0.06]` | `text-rose-500` |
| Analytics | `bg-violet-500/60` | `from-violet-500/[0.06]` | `text-violet-600 dark:text-violet-400` |

#### Doctor Dashboard panels

| Panel | Left bar | Gradient from | Icon colour |
|---|---|---|---|
| Appointments | `bg-primary/60` | `from-primary/[0.06]` | `text-primary` |
| My Profile | `bg-violet-500/60` | `from-violet-500/[0.06]` | `text-violet-600 dark:text-violet-400` |
| Certifications | `bg-blue-500/60` | `from-blue-500/[0.06]` | `text-blue-600 dark:text-blue-400` |
| Case Studies | `bg-teal-500/60` | `from-teal-500/[0.06]` | `text-teal-600 dark:text-teal-400` |
| Leave Management | `bg-amber-500/60` | `from-amber-500/[0.06]` | `text-amber-600 dark:text-amber-400` |

### Rules

- Title: always `text-base font-semibold tracking-tight` — never `text-xl` or `text-2xl`
- Subtitle: always static plain-English description — never dynamic counts ("3 bookings")
- Icon: always `h-[18px] w-[18px]` inside a `h-9 w-9 rounded-xl` box
- Do not add new accent colours — pick the closest unused one from the tables above

---

## 6. White Filter Cards (Below Panel Header)

The row of white clickable cards that filter the list below. Used in both dashboards.

```tsx
<div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 min-w-0">
  <TooltipProvider delayDuration={700}>
    <Tooltip>
      <TooltipTrigger asChild>
        <Card
          className={`shadow-sm overflow-hidden cursor-pointer transition-all hover:shadow-md active:scale-[0.98]
            ${isActive ? 'ring-2 ring-sky-400 border-sky-400/60' : 'border-border/50'}`}
          onClick={() => handleQuickFilter("today")}
          data-testid="filter-card-today"
        >
          {/* 1px top accent stripe — colour matches the filter's semantic status */}
          <div className="h-1 bg-gradient-to-r from-sky-400 to-cyan-400" />
          <CardContent className="p-3 sm:p-4 text-left flex items-center gap-2 sm:gap-3 min-h-[64px]">
            <div className={`h-7 w-7 sm:h-9 sm:w-9 rounded-xl flex items-center justify-center shrink-0
              ${isActive ? 'bg-sky-400/20' : 'bg-sky-400/10'}`}>
              <Calendar className="h-3.5 w-3.5 text-sky-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-muted-foreground leading-tight">All Bookings Today</p>
              <p className="text-base sm:text-xl font-bold text-sky-600 dark:text-sky-400 leading-tight">
                {count}
              </p>
            </div>
            {isActive && (
              <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-wider
                text-sky-500 bg-sky-500/10 px-1.5 py-0.5 rounded-full">
                Active
              </span>
            )}
          </CardContent>
        </Card>
      </TooltipTrigger>
      <TooltipContent>Today's appointments</TooltipContent>
    </Tooltip>
  </TooltipProvider>
</div>
```

### Rules

- `min-h-[64px]` on `CardContent` — prevents height shift when the "Active" badge appears/disappears
- `delayDuration={700}` on `TooltipProvider`
- Top accent stripe colour must semantically match the filter: sky = today, primary/green = upcoming, amber = pending, slate = all
- `data-testid` on every card using pattern `filter-card-{filterKey}`
- "Active" pill uses `hidden sm:inline` — only visible on desktop

---

## 7. Dynamic Section Heading (Filtered List Header)

The green gradient heading that appears above the booking/appointment card grid. Title and subtitle update based on the active filter.

```tsx
<div className="rounded-2xl overflow-hidden border border-border/50 shadow-sm">
  <div className="bg-gradient-to-r from-primary to-accent px-5 py-4 flex items-center justify-between">
    <div>
      <h2 className="text-lg font-bold text-white tracking-tight">
        {quickFilter === 'today'            ? "Today's Bookings"
         : quickFilter === 'upcoming'       ? "Upcoming Bookings"
         : quickFilter === 'awaiting'       ? "All Pending Bookings"
         : quickFilter === 'confirmed-7days'? "Confirmed Bookings (Next 7 Days)"
         : quickFilter === 'pending-7days'  ? "Pending Confirmations (Next 7 Days)"
         : "All Appointments"}
      </h2>
      <p className="text-white/70 text-xs mt-0.5">
        {/* matching subtitle per filter */}
      </p>
    </div>
    {/* Optional right-side element — Download button (clinic) or count (doctor) */}
    <span className="text-white/60 text-sm font-semibold tabular-nums">
      {count} {count === 1 ? "appointment" : "appointments"}
    </span>
  </div>
</div>
```

### Rules

- `from-primary to-accent` gradient — never use a flat colour
- Title is dynamic; subtitle is a plain-English description of what's showing
- Clinic dashboard shows a **Download button** on the right; Doctor dashboard shows a **live count**
- Never use this as the first header in a panel — it sits *below* the panel header and *above* the card grid

---

## 8. Booking / Appointment Cards

Both dashboards render booking records as cards in a `grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3` grid.

### Card shell

```tsx
<div className="rounded-2xl border border-border/50 bg-background shadow-sm shadow-primary/5
  overflow-hidden flex flex-col hover:shadow-md hover:shadow-primary/10
  hover:-translate-y-0.5 transition-all duration-300">

  {/* Card header — dark green gradient with patient name and status badge */}
  <div className="relative bg-gradient-to-r from-primary/90 via-primary to-accent/80 px-4 pt-4 pb-3 overflow-hidden">
    ...
  </div>

  {/* Card body — appointment details */}
  <div className="px-4 py-3 flex-1 space-y-2">
    ...
  </div>

  {/* Card footer — action buttons */}
  <div className="px-4 pb-3 pt-1 flex gap-2">
    ...
  </div>

</div>
```

### Status badge colours (use consistently, never deviate)

| Status | Classes |
|---|---|
| Pending / Awaiting | `bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border-amber-300` |
| Confirmed / Upcoming | `bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-200` |
| Cancelled | `bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border-rose-200` |
| Past / Completed | `bg-slate-50 dark:bg-slate-900/40 text-slate-500 dark:text-slate-400 border-slate-200` |
| Today | `bg-sky-50 dark:bg-sky-950/20 text-sky-600 dark:text-sky-400 border-sky-200` |

### REF number format

```tsx
REF-{String(booking.id).padStart(4, "0")}   // e.g. REF-0023
```

### Cancellation reason display

When `booking.cancellationReason` is set, render it below the Cancelled badge:

```tsx
{booking.verificationStatus === 'cancelled' && (booking as any).cancellationReason && (
  <span className="text-[10px] italic text-muted-foreground/70 truncate max-w-[160px]">
    {(booking as any).cancellationReason}
  </span>
)}
```

---

## 8a. Patient Card — Complete Row Reference

> Source of truth: `client/src/components/AppointmentCard.tsx` (`role="clinic"` and `role="doctor"` branches).  
> All rows use `text-xs`. Icon boxes are `h-4 w-4 rounded-md`. Missing-data fallback is always `italic text-muted-foreground/60`.

### Clinic Admin Card (`role="clinic"`)

| Zone | Row | Always Visible? | Possible Values |
|---|---|---|---|
| **Header** | Patient avatar + name | ✅ Always | First-letter avatar · Full name |
| **Header** | Booking number | ✅ Always | `#01`, `#02` … |
| **Header** | Phone · Age · Gender | ✅ Always | `9876543210 · 34y · Male` — or `· Not available` italic if both missing |
| **Header** | Approval status pill | ✅ Always | 🟡 Pending · 🟡 Awaiting DR (pulsing) · 🟢 Confirmed · 🔴 Cancelled · 🔴 Declined |
| **Body** | Date + time | ✅ Always | `Mon, 9 Jun  10:00 am → 10:30 am` + Today / Tomorrow / in Xd badge |
| **Body** | Patient code | ✅ Always | `PAT-0042` primary mono — or `Not available` italic |
| **Body** | Assigned doctor | ✅ Always (non-past, non-cancelled) | `Dr. Name` + `Awaiting Dr Approval` / `Approved by Dr` / `Confirmed by Admin` / `Declined by Dr` · `Assign doctor` popover if unassigned · `No doctor assigned` italic |
| **Body** | Visit status | ✅ Always (non-cancelled) | `Awaiting confirmation` italic · `Mark Arrived` button · 🟢 In Clinic `· {time}` + undo × · 🔵 With Doctor · ✅ Visit Done `· {time}` |
| **Body** | Consent status | ✅ Always (non-cancelled) | `Not available` italic · `Consent Sent` amber pill · `Consent Signed ✓` emerald pill |
| **Body** | Clinical status | ✅ Always | `Not set` italic · 🟢 First Visit · 🔵 Revisit · 🟡 Follow-up Required · ✅ Case Closed |
| **Body** | Treatment category | ✅ Always | 🩺 `Major Procedure (3 slots)` primary chip — or `Not available` italic |
| **Body** | Visit type | ✅ Always | 🫀 `First Visit` primary chip — or `Not available` italic |
| **Body** | Chief complaints | ✅ Always | Up to 4 chips (e.g. `Tooth Pain`) · `+N` overflow · `No complaints noted` italic |
| **Footer** | Confirm button | Pending + non-past only | Appears until `verificationStatus === 'confirmed'` |
| **Footer** | Bill button | ✅ Always | Opens billing modal |
| **Footer** | Cancel / Book Again | ✅ Always | Cancel (non-completed) · Book Again (visit completed) |

---

### Doctor Admin Card (`role="doctor"`)

| Zone | Row | Always Visible? | Possible Values |
|---|---|---|---|
| **Header** | Patient avatar + name | ✅ Always | First-letter avatar · Full name |
| **Header** | Booking number | ✅ Always | `#01`, `#02` … |
| **Header** | Phone · Age · Gender | ✅ Always | `9876543210 · 34y · Male` — or `· Not available` italic if both missing |
| **Header** | Approval status pill | ✅ Always | 🟡 Pending (pulsing) · 🟡 Awaiting DR · 🟢 Confirmed · 🔴 Cancelled · 🔴 Declined |
| **Body** | Date + time + duration | ✅ Always | `Mon, 9 Jun  10:00 am → 10:30 am` + Today/Tomorrow/in Xd badge + `30m` pill |
| **Body** | Clinic name | ✅ Always | `Smile Dental (Kochi)` — or `Not available` italic |
| **Body** | Visit status | ✅ When approved/admin-confirmed + non-cancelled | `Awaiting arrival` italic · 🟢 In Clinic `· {check-in time}` · 🔵 With Doctor · ✅ Visit Done `· {time}` |
| **Body** | Clinical status | ✅ Always | `Not set` italic · 🟢 First Visit · 🔵 Revisit · 🟡 Follow-up Required · ✅ Case Closed |
| **Body** | Treatment category | ✅ Always | 🩺 `Major Procedure` primary chip — or `Not available` italic |
| **Body** | Visit type | ✅ Always | 🫀 `First Visit` primary chip — or `Not available` italic |
| **Body** | Chief complaints | ✅ Always | Up to 3 chips (Category/Visit lines stripped) · `No complaints noted` italic |
| **Footer** | Accept / Decline | Pending approval only | `doctorApprovalStatus === 'pending'` |
| **Footer** | Approval notice banner | After accepting | 🟡 "Confirmed by clinic admin on your behalf" · 🟢 "You confirmed this appointment" |
| **Footer** | Start Consultation | Patient arrived only | `visitStatus === 'checked_in'` + not pending/declined |
| **Footer** | Done with Patient | In consultation only | `visitStatus === 'in_consultation'` + not pending/declined |
| **Footer** | View Notes | ✅ After accepting | Always shown once `doctorApprovalStatus !== 'pending'/'declined'` |
| **Footer** | Issue Rx / Rec | ✅ After accepting | Always shown once `doctorApprovalStatus !== 'pending'/'declined'` |

---

### Key differences between the two roles

| Aspect | Clinic Admin | Doctor Admin |
|---|---|---|
| 3rd body row | Patient code `PAT-XXXX` | Clinic name + city |
| Doctor assignment row | ✅ Shown (name + approval state) | ✗ Not shown |
| Visit status | Interactive — Mark Arrived button + undo | Read-only status display |
| Consent row | ✅ Shown | ✗ Not shown (clinic concern) |
| Clinical status row | ✅ Shown (set by doctor, visible to clinic) | ✅ Shown |
| Visit status in header | ✗ No secondary badge | ✗ Removed (lives in body row) |
| Duration pill on date row | ✗ Not shown | ✅ Shown (`30m` badge) |
| Max complaint chips | 4 | 3 |
| Footer primary actions | Confirm · Bill · Cancel | Accept/Decline → Start Consultation → Done with Patient |

---

## 9. Colour System & Accent Reference

### Brand palette (CSS variable tokens only — no hardcoded hex)

| Token | Value | Usage |
|---|---|---|
| `bg-primary` | `#0F9B6E` | Buttons, links, active states |
| `bg-accent` | `#1D9E75` | Hover states, gradient ends |
| `from-[#052B22]` | Dark green | Banner gradient start (only allowed hardcoded hex) |
| `via-[#085041]` | Dark green mid | Banner gradient mid (only allowed hardcoded hex) |
| `to-[#0A5540]` | Dark green end | Banner gradient end (only allowed hardcoded hex) |
| `bg-muted/30` | Near-white | Page background |
| `bg-card` | White / dark surface | Card backgrounds |
| `bg-muted` | Subtle fill | Input backgrounds, hover fills |

### Opacity scale for tints

| Usage | Class pattern |
|---|---|
| Panel gradient from | `from-{colour}/[0.06]` |
| Icon box background | `bg-{colour}/10` |
| Icon box border | `border-{colour}/20` |
| Left accent bar | `bg-{colour}/60` |
| Active card ring | `ring-{colour}/50` |
| Stat card background on dark | `bg-white/[0.04]` (rest) / `bg-white/[0.09]` (active/hover) |

---

## 10. Responsive Patterns

### Breakpoints used

| Breakpoint | Value | Usage |
|---|---|---|
| `sm:` | 640px | Stat card grid switches to 4 columns; padding increase |
| `md:` | 768px | Booking card grid: 1 → 2 columns |
| `lg:` | 1024px | Sidebar becomes visible; bottom nav hides; layout switches to flex-row |
| `xl:` | 1280px | Booking card grid: 2 → 3 columns |

### Sidebar hide/show pattern

```tsx
<aside className="hidden lg:flex lg:flex-col ...">  {/* Desktop sidebar */}
<div className="lg:hidden ...">                      {/* Mobile profile card */}
<nav className="fixed bottom-0 ... lg:hidden">      {/* Mobile bottom nav */}
```

### Card grids

```tsx
// Booking / appointment cards
<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">

// Stat filter cards
<div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">

// Hero stat mini-cards (desktop only, inside banner)
<div className="flex-1 grid grid-cols-4 gap-2.5 items-stretch">

// Mobile stats 2×2 grid
<div className="grid grid-cols-2 gap-2">
```

### Mobile-only scrollable filter bar

For filter pill strips on mobile that shouldn't wrap:

```tsx
<div className="flex items-center gap-2 overflow-x-auto sm:hidden -mx-4 px-4 py-2.5
  sticky top-0 z-10 bg-muted/60 backdrop-blur-md border-b border-border/30"
  style={{ scrollbarWidth: "none" }}>
  {/* filter pills */}
</div>
```

### Minimum tap targets

Every tappable element must be at least `min-h-[44px]`. Use `py-2.5` or `min-h-[44px]` explicitly. Icon-only buttons need at least `p-2`.

---

## 11. Typography Rules

| Role | Classes |
|---|---|
| Page/panel title | `text-base font-semibold tracking-tight` |
| Section heading (gradient header) | `text-lg font-bold text-white tracking-tight` |
| Card heading | `text-sm font-semibold` |
| Body text | `text-sm` |
| Secondary / meta | `text-xs text-muted-foreground` |
| Card label (ALL CAPS) | `text-xs font-semibold uppercase tracking-wide text-muted-foreground` |
| Hero stat number | `text-lg font-extrabold text-white leading-none tabular-nums` |
| Filter card number | `text-base sm:text-xl font-bold {colour} leading-tight` |
| SubTag (e.g. "Next 7 Days") | `text-[10px] font-medium {colour} opacity-60 leading-none` |

**Minimum production font size**: `text-xs`. Avoid `text-[10px]` or smaller except for badge/chip labels where space is genuinely constrained.

---

## 12. Dark Mode Rules

- All colour choices must work in both light and dark mode
- Use paired utilities: `bg-amber-50 dark:bg-amber-950/20`, `text-amber-700 dark:text-amber-400`
- Stat card backgrounds on the dark banner (`bg-white/[0.04]`) are already dark-mode safe — they use white opacity, not a specific colour
- Never use `bg-white` alone on a card — use `bg-card` which adapts to dark mode
- Test with the theme toggle before shipping any new panel

---

## 13. Data States — Required on Every Fetch

Every section that calls `useQuery` must handle all three states:

```tsx
const { data, isLoading, isError, refetch } = useQuery({ queryKey: [...] });

// Loading — Skeleton shaped like real content
if (isLoading) return (
  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
    {[...Array(3)].map((_, i) => (
      <Skeleton key={i} className="h-48 rounded-2xl" />
    ))}
  </div>
);

// Error — message + retry button
if (isError) return (
  <div className="flex flex-col items-center gap-3 py-12 text-center">
    <p className="text-sm text-muted-foreground">Something went wrong loading appointments.</p>
    <Button variant="outline" size="sm" onClick={refetch}>Try again</Button>
  </div>
);

// Empty — icon + message + CTA
if (!data?.length) return (
  <div className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
    <Calendar className="h-10 w-10 opacity-30" />
    <p className="text-sm">No appointments found for this filter.</p>
  </div>
);
```

Never use a bare `<Loader2>` spinner as the entire loading state for a section — use `<Skeleton>` shaped like the real content.

---

## 14. New Component Checklist

Run through this before submitting any new panel or section in either dashboard:

- [ ] **Container**: Content is inside the single `container mx-auto px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:pb-8` wrapper — never adding a second container div
- [ ] **Panel header**: Uses the mandatory left-bar + gradient + icon-box + title/subtitle pattern from §5
- [ ] **Accent colour**: Picked from the correct dashboard's table in §5 — no new colours invented
- [ ] **Stat cards**: If adding stat tiles, follow §3 order and colour table exactly
- [ ] **Dark mode**: All colour classes have paired `dark:` variants
- [ ] **Responsive**: Desktop looks correct at 1280px; mobile at 375px with no horizontal scroll
- [ ] **Tap targets**: All interactive elements are `min-h-[44px]`
- [ ] **Data states**: Loading (Skeleton), error (message + retry), empty (icon + message + CTA) — all three handled
- [ ] **Tooltips**: `delayDuration={700}` on every `TooltipProvider` (except sidebar nav which uses `0`)
- [ ] **test-ids**: `data-testid` on every interactive element and every meaningful dynamic value
- [ ] **No hardcoded hex**: Only `from-[#052B22]`, `via-[#085041]`, `to-[#0A5540]` are permitted — everything else uses CSS variable utilities
- [ ] **Typography**: No font size smaller than `text-xs` except badge chips under extreme space constraint
- [ ] **Static subtitle**: Panel header subtitle is always static text, never dynamic counts

---

## 15. Configure Slots Panel — Full Logic Reference

### Overview

The Configure Slots panel lets a clinic admin define how many bookings each time block can accept per day, close specific days or time blocks, and push bulk schedules. It lives at panel key `configure-slots` in `ClinicDashboard.tsx`.

---

### Two-layer configuration model

| Layer | Storage location | Scope | Written by |
|---|---|---|---|
| **Explicit slot rows** | `slots` table (one row per time block per date) | Specific date or date range override | Save button / All Sundays bulk apply |
| **Default slot config** | `clinics.default_slot_config` JSONB | All future dates with no explicit row | "Apply to future days" button |

**Precedence rule (booking page):** When a patient checks availability for a date+time, the backend first looks for an explicit `slots` row for that exact timestamp. If one exists, its `maxBookings` and `isCancelled` values are used. If none exists, the backend reads `clinic.defaultSlotConfig` and resolves the matching section by key (`slotIndex + 1`). If no default is set either, the hardcoded fallback is `maxBookings = 3`, `isCancelled = false`.

---

### Time block definitions

Fixed across the whole app. Section keys `"1"` – `"5"` are the canonical IDs used in DB storage. `slotIndex` (0–4) is the array index used in the public API call — map via `sectionKey = String(slotIndex + 1)`.

| Section key | Label | Start | End | Default max bookings |
|---|---|---|---|---|
| `"1"` | Early Morning | 08:00 | 10:00 | 6 |
| `"2"` | Late Morning | 10:00 | 12:30 | 6 |
| `"3"` | Midday | 12:30 | 14:00 | 4 |
| `"4"` | Afternoon | 14:00 | 17:00 | 4 |
| `"5"` | Evening | 17:00 | 19:30 | 2 |

Defined as `slotTimings` constant in `ClinicDashboard.tsx`. Do not duplicate or redefine elsewhere.

---

### Local state

| Variable | Type | Purpose |
|---|---|---|
| `dayConfigCache` | `Record<string, DayConfig>` | In-memory edits keyed by `"yyyy-MM-dd"`. All UI changes write here first; API is only called on explicit save. |
| `rangeStart` | `Date \| null` | First selected date (defaults to today) |
| `rangeEnd` | `Date \| null` | Last date in a range selection (null = single date) |
| `configDate` | `Date` | Date whose config is shown in the Day Editor — always equals `rangeStart` |
| `weekStart` | `Date` | Monday of the currently visible 7-day grid; navigated by `←`/`→` buttons |
| `isBulkApplying` | `boolean` | Loading flag shared by both bulk-apply buttons |
| `isSavingConfig` | `boolean` | Loading flag for the Save button |

```typescript
type SectionConfig = { maxBookings: number; isCancelled: boolean };
type DayConfig = { isClosed: boolean; sections: Record<string, SectionConfig> };
```

`getConfigForDate(date)` reads from `dayConfigCache` for the formatted date, falling back to a sensible open-day default if the date has never been edited.

---

### UI layout

Two-column layout on `xl:` breakpoint, stacked below:

```
┌──────────────────────────────────────┬────────────────────────────┐
│  LEFT: Date picker + Week grid       │  RIGHT: Day Editor         │
│  (flex-1)                            │  (xl:w-80, sticky)         │
│                                      │                            │
│  [Pick a date or range ▾]  Clear     │  Thu, 29 May 2025          │
│                                      │  Configure time blocks     │
│  ← Mon 26 May – Sun 1 Jun 2025 →     │                            │
│                                      │  Day Closed  [toggle]      │
│  ┌──────┬──────┬──────┬──────┬──────┐│                            │
│  │      │ Mon  │ Tue  │ Wed  │ Thu  ││  Early Morning     [6]  □  │
│  ├──────┼──────┼──────┼──────┼──────┤│  Late Morning      [6]  □  │
│  │Early │  6   │  6   │  6   │  6   ││  Midday            [4]  □  │
│  ├──────┼──────┼──────┼──────┼──────┤│  Afternoon         [4]  □  │
│  │...   │      │      │      │      ││  Evening           [2]  □  │
│  └──────┴──────┴──────┴──────┴──────┘│                            │
│                                      │  Apply this config to:     │
│                                      │  [Apply to future days]    │
│                                      │  [All Sundays this month]  │
│                                      │                            │
│                                      │  [Save Thu 29 May Config]  │
└──────────────────────────────────────┴────────────────────────────┘
```

---

### Date range picker

**Component:** shadcn `Calendar` (`mode="range"`) inside a `Popover`.

**Button label logic:**

| State | Label |
|---|---|
| Single date | `Thursday, 29 May 2025` |
| Range active | `29 May → 4 Jun · 7 days` (rendered in blue) |
| Nothing | `Pick a date or range` (muted placeholder) |

**Interaction:**
1. First click → sets `rangeStart`, `rangeEnd = null`, popover stays open
2. Second click on a different date → sets `rangeEnd`, popover closes automatically
3. "Clear range" link → resets `rangeEnd = null`

---

### Week grid — column highlight rules

When a date column falls within `[rangeStart, rangeEnd]` (inclusive), every cell in that column (header and all 5 section rows) receives a blue tint. Edge columns (the start and end dates of the range) receive a stronger tint.

| State | Header cell classes | Section cell classes |
|---|---|---|
| Edge column (start or end of range) | `bg-blue-500/15 ring-1 ring-inset ring-blue-400/40` | `bg-blue-500/8` |
| Mid-range column | `bg-blue-500/8` | `bg-blue-500/8` |
| Today (not selected) | Normal + `bg-primary` circle on date number | `bg-primary/3` |
| Hovered | `hover:bg-muted/50` | `hover:bg-muted/25` |

Clicking any cell calls `handleSlotDateClick(day)` → sets `rangeStart = day`, `rangeEnd = null`, `configDate = day`.

A small `CLOSED` badge in `text-rose-500` text appears below the date number when `dayCfg.isClosed === true`.

---

### Day Editor — capacity inputs

For each of the 5 time blocks in the Day Editor:
- A numeric `<input type="number" min={0} max={30}>` for `maxBookings`
- A `<Checkbox>` to set `isCancelled = true` for just that block

"Day Closed" toggle at the top sets `isClosed = true` for the whole day — this turns the editor card background rose and marks all blocks as cancelled when saved.

All edits are **purely local** until the user clicks Save. Changes write to `dayConfigCache` via `setDayConfigCache`.

---

### Bulk apply buttons

#### Button 1 — Apply to future days

**What it does:** Saves the current `configDate`'s config as the clinic's **default slot config** — a single JSONB value written to `clinics.default_slot_config`.

**API:** `PATCH /api/auth/clinic/default-config`  
**Body:** `{ isClosed: boolean, sections: Record<string, { maxBookings, isCancelled }> }`  
**DB cost:** 1 `UPDATE` on the `clinics` row. Zero new slot rows.  
**Effect:** Every future date that has no explicit `slots` row falls back to this config when patients check availability. No expiry; no re-application needed.

#### Button 2 — All Sundays this month

**What it does:** Creates explicit slot rows for every Sunday in the current calendar month.

**API:** `POST /api/auth/clinic/slots/configure-bulk`  
**DB cost:** Up to `4 Sundays × 5 blocks = 20 upserts`.  
**Use case:** Clinics with a special Sunday schedule (closed, or reduced hours) that should override the default.

---

### Save button

**API:** `POST /api/auth/clinic/slots/configure-bulk`

For a **single date** → saves 5 slot rows (one per time block).  
For a **range** → saves `N dates × 5 blocks` rows.

The save reads from `dayConfigCache` using the source date (`configDate`) and projects that config across every date in the range.

**Button label:**
- Single date: `Save 29 May Configuration`
- Range: `Save Range (7 days)`

---

### API reference — Configure Slots

#### `POST /api/auth/clinic/slots/configure-bulk`

Creates or updates explicit slot rows for specific dates.

**Auth:** Clinic admin session (`sess.clinicId` required).

**Request body (Zod-validated):**
```json
{
  "slots": [
    { "startTime": "2025-05-29T08:00:00.000Z", "maxBookings": 6, "isCancelled": false }
  ]
}
```
Constraints: `maxBookings` 0–30, `startTime` valid ISO string, array non-empty.

**Response:** `{ "saved": N }` — count of rows inserted or updated.

**Upsert logic:** Finds the `[minTime, maxTime]` window across all incoming slots. Queries existing rows for this clinic in that window. For each incoming slot: if a matching row exists (within ±1 min of the timestamp), `UPDATE` its `maxBookings` and `isCancelled`; otherwise `INSERT` a new row. Runs in a single transaction.

---

#### `GET /api/auth/clinic/slots/configs`

Returns configured slot rows for a date range — used to populate the week grid on panel open.

**Auth:** Clinic admin session required.

**Query params:**

| Param | Type | Default |
|---|---|---|
| `from` | ISO date string | now |
| `to` | ISO date string | now + 32 days |

`to` is clamped to end-of-day (23:59:59). Returns 400 for invalid date strings.

**Response:** Array of `{ startTime, maxBookings, isCancelled }` de-duplicated by timestamp (latest row by ID wins).

---

#### `GET /api/auth/clinic/default-config`

Returns the clinic's saved default slot config.

**Auth:** Clinic admin session required.

**Response:** `{ "defaultSlotConfig": DefaultSlotConfig | null }`

`null` means no default has been saved — the booking page uses hardcoded defaults.

---

#### `PATCH /api/auth/clinic/default-config`

Saves the clinic's default slot config. Single DB row write.

**Auth:** Clinic admin session required.

**Request body (Zod-validated):**
```json
{
  "isClosed": false,
  "sections": {
    "1": { "maxBookings": 6, "isCancelled": false },
    "2": { "maxBookings": 6, "isCancelled": false },
    "3": { "maxBookings": 4, "isCancelled": false },
    "4": { "maxBookings": 4, "isCancelled": false },
    "5": { "maxBookings": 2, "isCancelled": false }
  }
}
```

`maxBookings` must be 0–30. Section keys `"1"`–`"5"` correspond to the 5 time blocks in order.

**Response:** `{ "ok": true }`

---

#### `POST /api/public/slot-availability`

Used by the public booking page to check spots remaining per time block on a given date.

**Auth:** None (public endpoint).

**Request body:**
```json
{
  "clinicId": 12,
  "slots": [
    { "slotIndex": 0, "label": "Early Morning", "startTimeISO": "2025-06-10T08:00:00.000Z" }
  ]
}
```

**Fallback resolution for each requested slot:**

```
1. Query slots table — explicit row for this clinic+timestamp (±1 min)?
   Yes → use configSlot.maxBookings, configSlot.isCancelled
   No  →
2. Read clinic.defaultSlotConfig
   sectionKey = String(slotIndex + 1)    // 0→"1", 1→"2", etc.
   Use defaultSlotConfig.sections[sectionKey].maxBookings / isCancelled
   isCancelled also inherits defaultSlotConfig.isClosed (day-level closure)
   No default set →
3. Hardcoded fallback: maxBookings = 3, isCancelled = false
```

**Response per slot:**
```json
{ "slotIndex": 0, "label": "Early Morning", "startTimeISO": "...", "count": 1, "max": 6, "isCancelled": false, "spotsLeft": 5 }
```

---

### Data flow diagram

```
Clinic admin saves specific date(s) or range
  └─► POST /configure-bulk → INSERT/UPDATE slots rows (N rows)
        └─► Week grid re-reads via GET /slots/configs

Clinic admin clicks "Apply to future days"
  └─► PATCH /default-config → UPDATE clinics.default_slot_config (1 row)
        └─► Zero new slot rows created

Clinic admin clicks "All Sundays this month"
  └─► POST /configure-bulk → INSERT/UPDATE up to 20 slot rows
        └─► These override the default for Sunday dates this month

Patient visits /book, selects a date
  └─► POST /slot-availability (one call, all 5 blocks in parallel)
        ├─► Explicit slot row found for this date+time? → use it
        └─► No row → read clinic.defaultSlotConfig → resolve by sectionKey
              └─► No default → hardcoded fallback (3 max, all open)
```

---

### TypeScript types (defined in `shared/schema.ts`)

```typescript
export type DefaultSlotConfig = {
  isClosed: boolean;
  sections: Record<string, { maxBookings: number; isCancelled: boolean }>;
};
```

Column on clinics table: `defaultSlotConfig: jsonb("default_slot_config").$type<DefaultSlotConfig>()`

DB migration: added as an `IF NOT EXISTS` block in `server/index.ts` alongside the other clinics column migrations.

---

*Document created: 27 May 2026 — update this file whenever a new panel pattern is introduced to either dashboard.*

---

## 15. Performance — Clinic Admin Dashboard

### Background

`GET /api/auth/clinic/bookings` is the heaviest query in the dashboard. It does a three-table JOIN (`bookings ⟶ slots ⟶ clinics ⟶ patients`) and returns every booking the clinic has ever had — no date limit, no pagination.

---

### ✅ Implemented (01 Jun 2026)

#### Fix 1 — Strip clinic object from booking response
**File:** `server/storage.ts` → `getClinicBookings()`

The original query joined `clinics` and embedded the full clinic row (including the large `websiteConfig` JSONB blob) into **every** booking object. For a clinic with 300 bookings this duplicated the same large object 300 times — pushing the response to 2–5 MB.

**Change:** Removed the `clinics` join from `getClinicBookings()`. The clinic data is already available to the frontend via the separate `/api/auth/clinic/me` query.

Before:
```ts
.leftJoin(clinics, eq(slots.clinicId, clinics.id))
// …returned: { ...booking, slot, clinic, patientCode }
```
After:
```ts
// clinics join removed
// …returns: { ...booking, slot, patientCode }
```

#### Fix 2 — Gate bookings fetch on active panel
**File:** `client/src/pages/ClinicDashboard.tsx`

The booking query was `enabled: isAuthenticated` — it fired immediately when the dashboard opened, regardless of which panel was visible. All stats cards and booking list are rendered only inside `{activePanel === 'bookings' && ...}`, so there is no reason to load data until the user visits that panel.

**Change:** `enabled: isAuthenticated && activePanel === 'bookings'`

This matches the already-correct pattern used by `patientDirectory`:
```ts
enabled: isAuthenticated && activePanel === 'patients'  // existing — correct
enabled: isAuthenticated && activePanel === 'bookings'  // now matches
```

#### Fix 3 — Conditional 30-second poll
**File:** `client/src/pages/ClinicDashboard.tsx`

The query previously polled every 30 seconds unconditionally. This meant the large bookings payload was re-fetched every 30 s even when the user was on the Slots, Doctors, or Accounts panel.

**Change:** `refetchInterval: activePanel === 'bookings' ? 30_000 : false`

The poll only runs while the Bookings panel is visible.

#### Fix 4 — Raise staleTime
**File:** `client/src/pages/ClinicDashboard.tsx`

`staleTime: 0` caused a re-fetch every time the component mounted (e.g. navigating away and back within the same session).

**Change:** `staleTime: 30_000`

Data is considered fresh for 30 seconds; switching panels and back within that window uses the cached response.

---

### 📋 Planned (future work)

#### Plan A — Booking summary endpoint (next high-value item)
Add `GET /api/auth/clinic/bookings/summary` returning only:
```json
{ "today": 4, "upcoming": 12, "past": 88, "thisWeek": 7, "nextWeek": 3, "pendingNext7Days": 2, "confirmedNext7Days": 5, "allPending": 9 }
```
The stat cards on the Bookings panel can load instantly from this tiny response while the full booking list loads in the background. Eliminates the loading skeleton on the stats row.

**Scope:** 1 new storage method, 1 new route, update `enabled` logic on the full bookings query to fire after summary is shown.

#### Plan B — Date-windowed default load
Instead of loading all bookings ever, default the API to return bookings within a rolling window (e.g. 90 days back + all future). Older records load only when the user explicitly picks a past date range beyond the window.

**Scope:** Add `?from=` / `?to=` query params to the bookings route. Frontend passes a default window on initial load and widens it on demand.

**Caution:** The `pastBookingsCount` stat card shows the total count of all historical bookings — this would need to come from the summary endpoint (Plan A) rather than the windowed list, so Plan A is a prerequisite.

#### Plan C — Paginated booking list
For clinics with 500+ bookings, render a paginated list (e.g. 50 per page) instead of all at once. The current `filteredBookings?.flatMap(...)` renderer iterates everything in a single render pass.

**Scope:** Add `?page=` / `?limit=` to the route, or implement cursor-based pagination. Requires changes to all 6 `queryClient.invalidateQueries` call sites that flush `['/api/auth/clinic/bookings']`.

#### Plan D — `allBills` panel gate
`useQuery` for `/api/auth/clinic/bills` currently has `enabled: isAuthenticated` with no panel guard. The sidebar Accounts button shows `allBills.length` as a count badge — the only cross-panel dependency.

Options:
1. Add a `GET /api/auth/clinic/bills/count` endpoint → gate full bills list on `activePanel === 'accounts'`, show count from the lightweight endpoint.
2. Accept the current behaviour (bills data is much smaller than bookings — typically tens of rows).

#### Plan E — WebSocket-driven invalidation instead of polling
The app already has a WebSocket server (`/ws/notifications`) with a `clinicSockets` map. When a new booking is created, the server could emit a `bookings:updated` event to the clinic's socket, triggering `queryClient.invalidateQueries` on the client. This would replace the 30-second poll entirely with push-based invalidation.

**Scope:** Emit from `POST /api/public/bookings` and `DELETE /api/auth/clinic/bookings/:id`. Add a `useEffect` listener in `ClinicDashboard` to call `invalidateQueries` on the event.

---

## 16. Patient Card Modal — Standards

> **Updated:** 04 Jun 2026  
> **Applies to:** `ClinicDashboard.tsx` (booking detail dialog) and `DoctorDashboard.tsx` (patient detail dialog)

---

### 16.1 — Dialog dimensions (both dashboards)

Use identical `DialogContent` classes on both dashboards so the modal looks the same regardless of who opens it:

```tsx
<DialogContent className="w-[95vw] sm:max-w-[640px] rounded-2xl p-0 gap-0 overflow-hidden max-h-[90vh] flex flex-col">
```

| Property | Value | Reason |
|---|---|---|
| `w-[95vw]` | 95% viewport width on mobile | Fills the screen without overflow |
| `sm:max-w-[640px]` | 640 px cap on desktop | Consistent readable width |
| `max-h-[90vh]` | Grows to content, caps at 90% viewport | Prevents overshooting on small screens |
| `rounded-2xl` | Matches system card rounding | Visual consistency |
| `p-0 gap-0` | No padding/gap — sections control their own spacing | Clean edge-to-edge header |
| `flex flex-col` | Column layout for header + tab strip + scrollable panel | Enables the scrollable body pattern |
| `overflow-hidden` | Clips the header gradient to the rounded corners | No edge bleed |

**Do not use `h-[90vh]` (fixed height)** — prefer `max-h-[90vh]` so the modal can be shorter when content is sparse.

---

### 16.2 — Tab structure

#### Doctor Dashboard — 3 top-level modal tabs

| Tab key | Label | Icon | Content |
|---|---|---|---|
| `notes` | Notes | `FileText` | Clinical Status dropdown + `BookingNotesThread` |
| `diagnosis` | Diagnosis | `ClipboardList` | `<ClinicalRecordsTab hideTabBar defaultTab="diagnosis">` |
| `prescription` | Prescription | `Pill` | `<ClinicalRecordsTab hideTabBar defaultTab="prescription">` |

The `Prescription / Records` parent tab has been removed. Diagnosis and Prescription are now **first-class top-level tabs**.

#### Clinic Dashboard — 5 top-level modal tabs

| Tab key | Label | Icon | Content |
|---|---|---|---|
| `overview` | Overview | `User` | Patient info, appointment details, chief complaints, clinical status, Clinical Records |
| `notes` | Notes | `FileText` | `BookingNotesThread` (clinic_admin author) |
| `actions` | Actions | `Settings` | Reschedule, consent, assign doctor |
| `billing` | Billing | `IndianRupee` | Billing history panel |

The `clinical` tab in the Clinic Dashboard keeps `<ClinicalRecordsTab>` embedded inside the `overview` tab's "Clinical Records" panel section — the internal Diagnosis/Prescription sub-tabs handle the tab bar in this context.

---

### 16.3 — Tab strip pattern (modal-level)

```tsx
<div className="shrink-0 flex border-b border-border/60 bg-card">
  {([
    { key: 'notes'        as const, label: 'Notes',        icon: <FileText className="h-3.5 w-3.5" /> },
    { key: 'diagnosis'    as const, label: 'Diagnosis',    icon: <ClipboardList className="h-3.5 w-3.5" /> },
    { key: 'prescription' as const, label: 'Prescription', icon: <Pill className="h-3.5 w-3.5" /> },
  ]).map(({ key, label, icon }) => {
    const isActive = modalTab === key;
    return (
      <button
        key={key}
        onClick={() => setModalTab(key)}
        className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5
          py-2.5 min-h-[44px] text-xs font-semibold transition-all border-b-2
          focus-visible:outline-none active:bg-muted/30 ${
          isActive
            ? 'text-primary border-primary'
            : 'text-muted-foreground border-transparent hover:text-foreground hover:border-muted-foreground/30'
        }`}
        data-testid={`modal-tab-${key}-${bookingId}`}
      >
        {icon}
        <span className="text-xs leading-none">{label}</span>
      </button>
    );
  })}
</div>
```

Key rules:
- `min-h-[44px]` — mandatory tap target
- `flex-col sm:flex-row` — icon stacks above label on mobile, inline on sm+
- `border-b-2` active indicator — never use background highlight alone
- `data-testid={`modal-tab-${key}-${bookingId}`}` — required on every tab button

---

### 16.4 — Scrollable body

The content area below the tab strip must be:

```tsx
<div className="overflow-y-auto flex-1">
  {/* tab panel content */}
</div>
```

- `flex-1` — takes all remaining height below the fixed header and tab strip
- `overflow-y-auto` — content scrolls within the modal, not the whole page
- Tab panels add their own padding: `<div className="p-4">…</div>`

---

### 16.5 — ClinicalRecordsTab props (when used inside modal)

`ClinicalRecordsTab` accepts two props that control its behaviour inside a parent tab structure:

| Prop | Type | Default | Purpose |
|---|---|---|---|
| `hideTabBar` | `boolean` | `false` | When `true`, hides the internal Diagnosis/Prescription selector — the parent modal tab controls which content is shown |
| `defaultTab` | `"diagnosis" \| "prescription"` | `"diagnosis"` | The tab whose content is rendered (forced when `hideTabBar=true`, initial value otherwise) |

**Doctor Dashboard usage** (tab bar hidden — parent drives content):
```tsx
{/* Diagnosis tab panel */}
<ClinicalRecordsTab
  bookingId={b.id}
  clinicId={b.clinicId}
  patientName={b.customerName}
  patientPhone={b.customerPhone}
  doctorName={profName || b.assignedDoctor}
  mode="doctor"
  clinicName={modalClinicName}
  hideTabBar
  defaultTab="diagnosis"
/>

{/* Prescription tab panel */}
<ClinicalRecordsTab
  ...same props...
  hideTabBar
  defaultTab="prescription"
/>
```

**Clinic Dashboard usage** (tab bar visible — component manages its own active tab):
```tsx
<ClinicalRecordsTab
  bookingId={booking.id}
  clinicId={clinic?.id}
  patientName={booking.customerName}
  patientPhone={booking.customerPhone}
  doctorName={booking.assignedDoctor}
  mode="admin"
  clinicName={clinic?.name}
/>
```

---

### 16.6 — Add form position (form-on-top pattern)

When the Add or Edit form is open, it renders **above** the latest record box — not below. The order in the DOM is:

```
1. [Add form]         ← visible when showForm === true
2. [Add button]       ← visible when showForm === false
3. [Latest record]    ← always rendered when a record exists
4. [Older history]    ← collapsed behind a toggle link
```

This ensures the user's cursor is always at the top of the scroll area when they start entering data, and the existing record is visible below for reference.

The form animates in with `animate-in slide-in-from-top-2 duration-200`.

---

### 16.7 — Prescription entry grid

The prescription Add/Edit form uses a compact **horizontal grid** — one row per medicine, all fields inline:

```
| Medicine name | Dosage | Qty | Freq | Dur# | Unit | Route | × |
```

Implemented with a CSS grid inside an `overflow-x-auto` container so it scrolls on narrow screens without breaking the layout:

```tsx
<div className="overflow-x-auto">
  <div className="min-w-[560px]">
    {/* Column headers */}
    <div className="grid gap-x-1 mb-1 px-1"
      style={{ gridTemplateColumns: "1fr 62px 40px 58px 40px 66px 70px 22px" }}>
      {["Medicine","Dosage","Qty","Freq","Dur.","Unit","Route",""].map((h,i) => (
        <span key={i} className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/70">{h}</span>
      ))}
    </div>
    {/* Medicine rows */}
    {rxRows.map((row, idx) => (
      <div key={idx} className="grid gap-x-1 items-center"
        style={{ gridTemplateColumns: "1fr 62px 40px 58px 40px 66px 70px 22px" }}>
        {/* inputs for each column — all h-7 text-xs */}
      </div>
    ))}
    <button onClick={addRxRow}>+ Add medicine</button>
  </div>
</div>
```

Rules:
- All inputs and selects in the grid use `h-7 text-xs` — never `h-9` or `h-10`
- `min-w-[560px]` on the inner container ensures columns never collapse on wide screens
- The `×` remove button is `h-7 w-full` in its grid cell, centred
- Remarks field is omitted from the inline grid (space constraint) — it is captured per-row if needed via a future expansion
