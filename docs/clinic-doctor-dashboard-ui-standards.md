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

*Document created: 27 May 2026 — update this file whenever a new panel pattern is introduced to either dashboard.*
