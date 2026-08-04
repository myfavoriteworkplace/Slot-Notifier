# BookMySlot — Frontend Design Document v2

> **Replaces:** `frontend-design-document.md` (v1)
> **Scope:** Frontend UI rules, patterns, standards, and completion gates. For backend/DB rules see `backend-and-db-checklist.md`. For deployment and env vars see `replit.md`.
> **Primary device:** Laptop (1280 px – 1440 px). Must be fully functional and visually correct at every breakpoint from 375 px (mobile) to 1920 px+ (large desktop).

---

## TABLE OF CONTENTS

1. [Critical Production Rules](#1-critical-production-rules)
2. [Feature Completion Gate](#2-feature-completion-gate)
3. [Breakpoints & Responsive Strategy](#3-breakpoints--responsive-strategy)
4. [Viewport Units](#4-viewport-units)
5. [Layout System](#5-layout-system)
6. [Safe Area Insets](#6-safe-area-insets)
7. [Z-Index System](#7-z-index-system)
8. [Design Token System](#8-design-token-system)
9. [Colour System](#9-colour-system)
10. [Typography](#10-typography)
11. [Touch & Interaction](#11-touch--interaction)
12. [Animation & Motion](#12-animation--motion)
13. [Accessibility (A11Y)](#13-accessibility-a11y)
14. [Forms & Mobile Keyboard Safety](#14-forms--mobile-keyboard-safety)
15. [Form Architecture](#15-form-architecture)
16. [Form Field Density](#16-form-field-density)
17. [Table Design Standards](#17-table-design-standards)
18. [Data States](#18-data-states)
19. [Skeleton Loading Patterns](#19-skeleton-loading-patterns)
20. [Button & CTA Placement](#20-button--cta-placement)
21. [Info / Warning Banner Strips](#21-info--warning-banner-strips)
22. [Dashboard Panel Header Pattern](#22-dashboard-panel-header-pattern)
23. [Patient Detail Popup — Section Card Pattern](#23-patient-detail-popup--section-card-pattern)
24. [Icon Library](#24-icon-library)
25. [Image & File Upload](#25-image--file-upload)
26. [Scroll Behaviour](#26-scroll-behaviour)
27. [Shadcn Components — Use These, Don't Reinvent](#27-shadcn-components--use-these-dont-reinvent)
28. [Performance](#28-performance)
29. [Core Web Vitals](#29-core-web-vitals)
30. [React Native Parity](#30-react-native-parity)
31. [PWA & Installability](#31-pwa--installability)
32. [Space Efficiency](#32-space-efficiency)
33. [Section Dividers & Visual Weight](#33-section-dividers--visual-weight)
34. [Code Quality & Readability](#34-code-quality--readability)
35. [Input Field Style Standard & Placeholder Conventions](#35-input-field-style-standard--placeholder-conventions)
36. [Print Styles](#36-print-styles)
37. [Master Submission Checklist](#37-master-submission-checklist)

---

## 1. Critical Production Rules

### 1.1 — TDZ / Duplicate Export Rule

**This caused a production `ReferenceError: Cannot access 'X' before initialization` crash — invisible in `npm run dev`.**

Vite + Rollup bundles ClinicDashboard into one minified chunk. If the **same exported name appears in two source files** in that chunk, Rollup renames one during minification and can access it before initialization (Temporal Dead Zone).

**One canonical file for all shared frontend types:** `client/src/lib/clinic-constants.tsx`

| ✅ Correct | ❌ Wrong |
|---|---|
| `import type { BookingWithSlot } from "@/lib/clinic-constants"` | `interface BookingWithSlot { ... }` defined locally in a component |
| Adding new shared types to `clinic-constants.tsx` | Copy-pasting a type from `clinic-constants` into a component file |

Before adding any new exported type or const:
```bash
grep -rn "export.*YourTypeName" client/src/
# Must return exactly ONE result
```

**`npm run dev` will NOT reveal TDZ bugs.** Always run the Build Check after any non-trivial component change.

### 1.2 — CJS Library Rule

Replit blocks jspdf, jspdf-autotable, qr.js at install time — they silently become `undefined` in dev but cause TDZ crashes in production bundles. Use the project stub:
```ts
import { jsPDF } from "@/lib/jspdf-stub";
```
Before installing any new npm package, check for a `"module"` or `"exports"` field. If absent, wrap it in a stub.

### 1.3 — No Bare Fetch / Hardcoded URLs

Never use bare `/api/...` fetch paths — they break across origins. Use `apiRequest()` from `@/lib/queryClient`. Never hardcode `localhost`, `127.0.0.1`, or port numbers.

---

## 2. Feature Completion Gate

Run every item after **every** UI change — including small edits.

### Step A — Build Check (hard gate)
```
restart_workflow("Build Check")   # must reach FINISHED with exit 0
```
`npm run dev` passing is not enough. TDZ crashes, chunk errors, and bad import paths only appear in the production Rollup build.

### Step B — Duplicate export scan
```bash
grep -rn "export.*YourNewName" client/src/
# Must return exactly one result
```

### Step C — Bare fetch / URL scan
```bash
grep -rn "fetch('/api" client/src/
grep -rn 'fetch("/api' client/src/
grep -rn "localhost" client/src/
# All three must return zero results
```

### Step D — Responsiveness check
Verify layout at: **375 px (mobile)** · **768 px (tablet)** · **1024 px (iPad/small laptop)** · **1280 px (laptop)** · **1440 px (wide laptop)**. No horizontal scroll at any breakpoint.

### Step E — Accessibility spot-check
```
[ ] All interactive elements reachable by Tab key
[ ] Focus ring visible on every focused element
[ ] No color-only status indicators — each has an icon too
[ ] All inputs have visible labels or aria-label
```

### Step F — Debug code scan
```bash
grep -rn "console\.log\|console\.warn\|console\.error\|debugger" client/src/
# Must return zero results in any file you touched
```

### Step G — Panel import audit (for new panels)
```bash
python3 script/audit-panel-imports.py
# All panels must report ✅ OK
```

### Quick gate summary
```
[ ] Build Check finished with exit 0
[ ] No duplicate exports for any new type/const
[ ] No bare fetch('/api/...') or localhost in client/src/
[ ] No console.log / debugger in files you touched
[ ] Layout verified at 375 · 768 · 1024 · 1280 · 1440 px
[ ] Every new interactive element has data-testid and aria-label (if icon-only)
[ ] Section cards inside detail popups use the green two-tier header
[ ] Accessibility spot-check passed
[ ] Panel import audit passes (if new panel added)
```

---

## 3. Breakpoints & Responsive Strategy

### Primary device: Laptop

The primary design target is a **laptop screen (1280 px – 1440 px)**. Design and prototype at 1280 px first. The UI must also be fully functional and visually correct at all breakpoints below and above.

This is **not** mobile-first or desktop-first — it is **laptop-first with full bidirectional responsiveness**. Write styles for 1280 px, then test and adjust both downward (tablet → mobile) and upward (large desktop) using Tailwind modifiers.

### Breakpoint table

| Name | Min width | Target device | Tailwind prefix |
|---|---|---|---|
| `xs` | 375 px | Small phone (iPhone SE) | *(default, no prefix)* |
| `sm` | 640 px | Large phone / small tablet | `sm:` |
| `md` | 768 px | Tablet portrait | `md:` |
| `lg` | 1024 px | iPad landscape / small laptop | `lg:` |
| `xl` | 1280 px | **Laptop — primary target** | `xl:` |
| `2xl` | 1440 px | Wide laptop / external monitor | `2xl:` |

> **Phone sizes to test:** 375 px (iPhone SE / standard Android) · 390 px (iPhone 14/15) · 430 px (iPhone 14 Plus/15 Pro Max).

### Rules

1. Write base styles for the primary use case (1280 px laptop).
2. Add `lg:` / `md:` / `sm:` modifiers to adapt **downward** — never fight Tailwind's cascading direction.
3. Add `xl:` / `2xl:` modifiers to expand gracefully on wide screens.
4. At no breakpoint should there be horizontal scrolling at the page level.
5. At no breakpoint should font size drop below `text-xs` (12 px) — except the two permitted exceptions (bottom-nav label, compact grid ALL-CAPS label).
6. Test at actual device widths, not just the named Tailwind breakpoints.

---

## 4. Viewport Units

### Problem: `100vh` breaks on mobile

On iOS Safari and most mobile browsers, `100vh` equals the viewport height **including** the URL bar. When the URL bar auto-hides, content reflows and jumps.

### Correct units

| Use case | Unit | Notes |
|---|---|---|
| Full-height app shell | `min-h-[100dvh]` | Dynamic: tracks the current visible viewport |
| Stable minimum height | `min-h-[100svh]` | Small: viewport with URL bar always visible — safe minimum |
| Maximum available height | `max-h-[100lvh]` | Large: viewport with URL bar hidden — for calculations |
| Modal / sheet max-height | `max-h-[85dvh]` | Leaves room for OS chrome and keyboard |
| **Never** | `100vh` on mobile-facing elements | Causes layout jump on iOS |

### Tailwind setup (already in project via arbitrary values)
```tsx
// Correct — use these
className="min-h-[100dvh]"    // app shell
className="max-h-[85dvh]"     // dialogs, sheets
className="h-[100dvh]"        // full-screen overlays

// Wrong — avoid on any mobile-visible element
className="min-h-screen"      // = 100vh — breaks on iOS
className="h-screen"          // same issue
```

---

## 5. Layout System

### Shell structure (laptop)

```tsx
<div className="flex flex-row gap-6 min-h-[100dvh]">
  {/* Sidebar — hidden below lg: */}
  <aside className="hidden lg:flex lg:flex-col w-60 shrink-0 sticky top-[70px] self-start" />
  {/* Content */}
  <main className="flex-1 min-w-0 px-6 py-6" />
</div>
```

### Section grids

| Context | Grid class |
|---|---|
| Standard panels | `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4` |
| Data-dense panels | `grid grid-cols-2 lg:grid-cols-4 gap-3` |
| Settings / profile | `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3` |
| Full-width content | `max-w-5xl mx-auto` |
| Data-dense | `max-w-7xl mx-auto` |

### Page padding

| Breakpoint | Padding |
|---|---|
| Mobile | `px-4 py-4` |
| Tablet | `px-5 py-5` |
| Laptop+ | `px-6 py-6` |

### Mobile sidebar replacement

When `lg:` sidebar is hidden, replace with sticky bottom nav:

```tsx
{/* Add pb-24 lg:pb-0 to the page content wrapper */}
<nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-background/95 backdrop-blur-md border-t border-border/50 shadow-[0_-4px_24px_rgba(0,0,0,0.08)]"
     style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
  <div className="flex items-stretch">
    {PRIMARY_TABS.map(({ key, label, Icon }) => (
      <button key={key} onClick={() => setActiveTab(key)}
        className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[60px] transition-colors relative"
        aria-label={label}>
        <Icon className="h-5 w-5" />
        <span className="text-[10px] font-semibold">{label}</span>
      </button>
    ))}
    <button onClick={() => setMoreDrawerOpen(true)}
      className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[60px]"
      aria-label="More options">
      <MoreHorizontal className="h-5 w-5" />
      <span className="text-[10px] font-semibold">More</span>
    </button>
  </div>
</nav>
```

### Cards

```tsx
className="rounded-2xl border border-border/50 bg-background shadow-sm"
```

---

## 6. Safe Area Insets

Systematic coverage of all safe area zones. Required on any element that touches the device edge.

```html
<!-- In index.html — required for safe area to work on iPhone -->
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
```

| Zone | CSS variable | Where to apply |
|---|---|---|
| **Top** — status bar / notch | `env(safe-area-inset-top)` | Fixed headers on full-screen pages |
| **Bottom** — home indicator | `env(safe-area-inset-bottom)` | Bottom nav, sticky submit buttons, Sheets |
| **Left / Right** — landscape notch | `env(safe-area-inset-left/right)` | Full-width horizontal bars in landscape |

### Tailwind patterns

```tsx
// Bottom nav — always
style={{ paddingBottom: "env(safe-area-inset-bottom)" }}

// Sticky submit button in forms — always
className="sticky bottom-0 pb-[env(safe-area-inset-bottom)] bg-background/95 backdrop-blur-sm pt-3 border-t border-border/40"

// Full-screen dialog/sheet — always
className="pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]"
```

---

## 7. Z-Index System

Define layers here before writing any new overlay. Never use arbitrary z-index values outside this table.

| Layer | z-index | Elements |
|---|---|---|
| Base content | `z-0` | Page content, cards |
| Sticky header | `z-30` | Top navigation bar |
| Sticky sidebar | `z-30` | Desktop sidebar |
| Bottom nav | `z-50` | Mobile bottom navigation |
| Sheet / Drawer | `z-50` | Vaul / shadcn Sheet |
| Dialog / Modal | `z-50` | shadcn Dialog |
| Dropdown / Popover | `z-[55]` | shadcn Popover, DropdownMenu |
| Toast notifications | `z-[60]` | Toaster |
| Tooltip | `z-[70]` | shadcn Tooltip |

Tailwind classes: `z-0` · `z-30` · `z-50` · `z-[55]` · `z-[60]` · `z-[70]`.

> **Rule:** never set a z-index outside this table without adding a row here first and explaining why.

---

## 8. Design Token System

### Border radius scale

| Token | Value | Use for |
|---|---|---|
| `rounded-full` | 9999 px | Badges, chips, avatar, pill buttons |
| `rounded-2xl` | 16 px | Top-level cards, panels, dialogs |
| `rounded-xl` | 12 px | Inner section cards, image containers |
| `rounded-lg` | 8 px | Buttons, inputs, dropdowns |
| `rounded-md` | 6 px | Small action buttons, icon buttons |
| `rounded` | 4 px | Inline chips, table row highlights |

### Spacing scale (4 px base grid)

| Token | px | Use for |
|---|---|---|
| `gap-1` / `space-y-1` | 4 px | Tight inline grouping (icon + label) |
| `gap-1.5` | 6 px | Dense compact rows |
| `gap-2` / `p-2` | 8 px | Icon button padding, compact chip gap |
| `gap-3` / `p-3` | 12 px | Card inner padding (mobile), field gap |
| `gap-4` / `p-4` | 16 px | Standard section gap, card padding (tablet) |
| `gap-5` / `p-5` | 20 px | Card inner padding (desktop) |
| `gap-6` / `p-6` | 24 px | Page horizontal padding, major section gap |
| `gap-8` | 32 px | Between major page sections only |

### Shadow / elevation scale

| Level | Class | Use for |
|---|---|---|
| 0 — flush | *(none)* | Inline elements, list items |
| 1 — subtle | `shadow-sm` | Cards, panels, inputs |
| 2 — raised | `shadow-md` | Floating dropdowns, date pickers |
| 3 — overlay | `shadow-xl` | Dialogs, sheets, toasts |
| 4 — max | `shadow-2xl` | Overlaid modals with backdrop |

---

## 9. Colour System

**Always use CSS variables — never hardcode hex or hsl inline.**

Core tokens: `var(--primary)` · `var(--accent)` · `var(--background)` · `var(--card)` · `var(--muted)` · `var(--border)` · `var(--foreground)` · `var(--muted-foreground)`

### Brand palette

| Role | Value | Tailwind pattern |
|---|---|---|
| Primary | `#0F9B6E` | `bg-primary/10`, `text-primary`, `border-primary/20` |
| Dark green | `#085041` | Header bg, gradient starts, section card headers |
| Accent | `#1D9E75` | Hover states, gradient ends |
| Light tint | `#E1F5EE` | Panel fills |
| Page bg | `#F8F8F6` | Near-white surface |

### Semantic status colours (light + dark)

| Status | Light classes | Dark additions |
|---|---|---|
| Pending / Awaiting | `bg-amber-50 text-amber-700 border-amber-300` | `dark:bg-amber-950/20 dark:text-amber-400` |
| Confirmed / Upcoming | `bg-emerald-50 text-emerald-700 border-emerald-200` | `dark:bg-emerald-950/20 dark:text-emerald-400` |
| Cancelled / Declined | `bg-rose-50 text-rose-600 border-rose-200` | `dark:bg-rose-950/20 dark:text-rose-400` |
| Past / Completed | `bg-slate-50 text-slate-500 border-slate-200` | `dark:bg-slate-900/40 dark:text-slate-400` |
| Today | `bg-sky-50 text-sky-600 border-sky-200` | `dark:bg-sky-950/20 dark:text-sky-400` |

### Colour contrast requirements (WCAG 2.1 AA)

| Pairing | Required ratio | Check |
|---|---|---|
| Normal text on background | 4.5 : 1 minimum | Use [Colour Contrast Checker](https://webaim.org/resources/contrastchecker/) |
| Large text (18 px+ or 14 px bold) | 3 : 1 minimum | — |
| UI components and icons | 3 : 1 minimum | — |
| `#0F9B6E` primary on white | ~3.3 : 1 | **Fails AA for small text** — never put small body text as primary-coloured on white |
| White on `#085041` dark green | Passes | Safe for headers |

> **Rule:** never use `text-primary` for body/paragraph text on a light background. Use it only for large bold headings, interactive labels, and icon fills where the 3:1 large-text threshold applies.

### Colour is never the only indicator

Status must always use **icon + colour**, never colour alone (colorblind users):

```tsx
// ✅ Correct — icon + colour + label
<Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
  <CheckCircle className="h-3 w-3 mr-1" /> Confirmed
</Badge>

// ❌ Wrong — colour only
<Badge className="bg-emerald-50 text-emerald-700">Confirmed</Badge>
```

### Dark mode rule

Every colour choice must look correct in light and dark mode. Test by toggling the theme before finishing. Add `dark:` variants to every `bg-*`, `text-*`, `border-*` class that uses a non-semantic colour.

---

## 10. Typography

### Scale

| Role | Classes | Notes |
|---|---|---|
| Page title | `text-xl lg:text-2xl font-semibold` | Fluid between breakpoints |
| Hero / display | `text-[clamp(1.5rem,3vw,2.5rem)] font-display` | Landing page only; uses `font-display` (Outfit) |
| Section heading | `text-base lg:text-lg font-semibold` | |
| Card heading | `text-sm font-semibold` | |
| Body text | `text-sm` | |
| Secondary / meta | `text-xs text-muted-foreground` | |
| Card label (ALL CAPS) | `text-xs font-semibold uppercase tracking-wide text-muted-foreground` | |
| Data value | `text-base font-semibold` | |

### Rules

1. **Minimum size: `text-xs` (12 px)** in any production UI.
   - Permitted below-12px exceptions: bottom-nav bar label (structurally constrained) · compact grid ALL-CAPS field labels.
2. **Fluid hero text** — use `clamp()` for anything `text-2xl`+ on public-facing pages so it scales between mobile and desktop without a jarring jump.
3. **Maximum line length** — prose paragraphs and descriptions: `max-w-prose` (65 ch) or `max-w-[65ch]`. Never let a paragraph stretch across a full 1440 px screen.
4. **Font families:** DM Sans (body, default) · Outfit (`font-display`) · Sora (Smile Deals only). Do not add new families.
5. **Font loading** — always use `font-display: swap` (already configured) to prevent invisible text flash (FOIT) on slow connections.

---

## 11. Touch & Interaction

### Touch targets — hard floor

| Element | Minimum size |
|---|---|
| Any tappable element | `min-h-[44px]` |
| Icon-only buttons (close, prev/next, clear) | `h-11 w-11` — never `h-10 w-10` |
| Navigation chevrons inside pickers | `h-11 w-11` |
| Bottom-nav items | `min-h-[60px]` |

### Interaction states

Every interactive element must have **all three states** — never hover-only:

```tsx
// ✅ Correct — hover + active + focus-visible
className="hover:bg-primary/90 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-primary/50 transition-all"

// ❌ Wrong — hover only, no active feedback
className="hover:bg-primary/90"
```

| State | Purpose |
|---|---|
| `hover:` | Mouse users — visual affordance |
| `active:scale-[0.98]` | All users — tactile press feedback |
| `focus-visible:ring-2 focus-visible:ring-primary/50` | Keyboard users — must be visible |
| `transition-all duration-150` | Smooths all state transitions |

### Event binding rule

Use `onClick` for core actions. Never `onMouseEnter` — touch devices have no hover. Dropdowns and date pickers: use shadcn `Popover` — touch-compatible out of the box.

### Mobile proportionality

| Property | Mobile | Tablet+ |
|---|---|---|
| Card outer padding | `p-3` | `sm:p-5` |
| Column gap | `space-y-3` | `sm:space-y-4` |
| Two-column gap | `gap-3` | `lg:gap-5` |

### Date / time pickers on mobile

Never stack FROM/TO pickers as two full-width rows:
```tsx
<div className="grid grid-cols-2 gap-2 sm:flex sm:flex-row sm:flex-wrap sm:items-end sm:gap-3">
  {/* FROM picker */}
  {/* TO picker */}
  {/* conditional badge — col-span-2 sm:col-span-1 */}
</div>
```

---

## 12. Animation & Motion

### Duration scale

| Name | Duration | Use for |
|---|---|---|
| Instant | `duration-100` | Icon swaps, checkbox checks, toggle states |
| Quick | `duration-150` | Button press, hover bg, opacity |
| Standard | `duration-200` | Panel open/close, dropdown, tab switch |
| Elaborate | `duration-300` | Dialog enter/exit, sheet slide |
| Slow | `duration-500` | Page-level transitions, skeleton shimmer |

### Easing rules

| Direction | Easing | Tailwind |
|---|---|---|
| **Entering** (appearing) | `ease-out` | `ease-out` |
| **Exiting** (disappearing) | `ease-in` | `ease-in` |
| **Reversible** (expand/collapse) | `ease-in-out` | `ease-in-out` |
| **Spring** (feedback) | `ease-out` + slight overshoot via `scale` | Custom |

### What to animate (and what not to)

| ✅ Animate | ❌ Never animate |
|---|---|
| `opacity`, `transform` (translate, scale, rotate) | `width`, `height` — triggers layout reflow |
| `color`, `background-color` | `top`, `left`, `margin`, `padding` |
| `box-shadow` (with `will-change: box-shadow`) | `border-width` |

### `prefers-reduced-motion` — mandatory

Every animation must respect the OS reduce-motion setting. Add `motion-reduce:` modifiers:

```tsx
// ✅ Correct — disables transform + transition for users who request it
className="transition-transform duration-200 ease-out motion-reduce:transition-none motion-reduce:transform-none"

// ✅ For spinners — use opacity pulse instead of spin
className="animate-pulse motion-reduce:animate-none"
```

Global CSS in `index.css` (already present, verify it exists):
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Micro-interaction patterns

| Trigger | Pattern |
|---|---|
| Button saving | Swap label to `<Loader2 className="animate-spin" />` + "Saving…" while `isPending` |
| Mutation success | Brief `scale-[1.02]` on the affected row/card + green border flash |
| Form validation error | `shake` animation on the input group (use `animate-[shake_0.3s_ease]`) |
| Row added to list | Fade-in + slide-down via `animate-in slide-in-from-top-1 duration-200` |
| Row deleted | Fade-out + slide-up before removal |

---

## 13. Accessibility (A11Y)

### Compliance target: WCAG 2.1 Level AA

This is a healthcare booking application — a11y is not optional.

### Colour contrast

See [Section 9](#9-colour-system) for contrast ratios. Run contrast checks before shipping any new colour pairing.

### Keyboard navigation

| Requirement | Implementation |
|---|---|
| All interactive elements reachable by `Tab` | Never use `tabIndex={-1}` on anything the user needs to activate |
| Logical tab order follows visual order | Never use `tabIndex` with values > 0 to re-order |
| Dialog / Sheet traps focus | shadcn `Dialog` and `Sheet` handle this — do not override `onOpenAutoFocus` unless you have an explicit reason |
| `Escape` closes dialogs, sheets, dropdowns | shadcn components handle this — verify it works after any portal customisation |
| Skip links | Add `<a href="#main-content" className="sr-only focus:not-sr-only">Skip to main</a>` to the app shell |

### Focus rings — mandatory pattern

```tsx
// Every interactive element that lacks a browser-native focus ring
className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
```

Never use `outline-none` alone without replacing it with a `ring` or custom focus style.

### ARIA

| Situation | Pattern |
|---|---|
| Icon-only button | `aria-label="Close dialog"` |
| Status that changes dynamically | `role="status" aria-live="polite"` |
| Error alerts | `role="alert" aria-live="assertive"` |
| Loading region | `aria-busy={isLoading}` on the container |
| Modal dialog | shadcn `Dialog` sets `role="dialog"` and `aria-modal` automatically |
| Decorative images | `alt=""` — empty string, not omitted |
| Informational images | Descriptive `alt` text |

### Screen reader text

For elements visible to sighted users but needing extra context for screen readers:
```tsx
<span className="sr-only">Loading bookings</span>
```

For elements hidden visually but needed by screen readers (e.g. form context, count announcements):
```tsx
<span className="sr-only" aria-live="polite">{count} results found</span>
```

### `data-testid` — required on every interactive element

Pattern: `{action}-{target}` for actions · `{type}-{content}` for display · `{type}-{description}-{id}` for dynamic lists.

```tsx
<button data-testid="button-confirm-booking" aria-label="Confirm booking">
<input data-testid="input-patient-name" />
<div data-testid={`card-booking-${booking.id}`}>
```

---

## 14. Forms & Mobile Keyboard Safety

### Input font size — iOS zoom prevention

**iOS Safari auto-zooms any input with `font-size < 16px`.** This breaks the entire layout on iPhones.

```tsx
// ✅ Correct — 16px base on mobile, scales down on tablet+
className="text-base sm:text-sm"

// ❌ Wrong — triggers iOS zoom on any iPhone
className="text-xs"  // on an input
className="text-sm"  // also triggers zoom (14px < 16px)
```

**Rule:** every `<input>`, `<textarea>`, `<select>` must have `text-base` at mobile viewport width. Use `sm:text-sm` to scale back down on tablet.

### Other keyboard safety rules

- All inputs: `w-full` — never a fixed pixel width.
- Correct `type` attributes: `type="email"` · `type="tel"` · `type="search"` · `inputMode="numeric"`.
- Scroll-into-view on focus (prevents iOS keyboard covering input):
  ```tsx
  onFocus={(e) => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' })}
  ```
- No critical CTA within 80 px of the bottom edge on mobile.
- Sticky submit button:
  ```tsx
  <div className="sticky bottom-0 pb-[env(safe-area-inset-bottom)] bg-background/95 backdrop-blur-sm pt-3 border-t border-border/40">
    <Button className="w-full" data-testid="button-submit">Submit</Button>
  </div>
  ```

---

## 15. Form Architecture

### Choose the right pattern first

| Situation | Correct pattern |
|---|---|
| Adding a row to a table (≤ 6 fields, fields map to table columns) | **Inline table row** — inputs as first `<tbody>` row; toggled by "Add X" in panel header |
| Editing an existing table row (≤ 6 fields) | **Inline row edit** — row's display cells swap to input cells in-place |
| 7+ fields, file uploads, or nested data | **Dialog / Modal** — `w-[95vw] sm:max-w-lg max-h-[85dvh] overflow-y-auto` |
| Settings, profile, configuration | **Compact grid inside card** — `grid grid-cols-2 lg:grid-cols-3 gap-3` |
| Multi-step flow or destructive action | **Full-page step or `Sheet` drawer from bottom** |
| **NEVER** | Expand-panel / accordion that pushes content down below a list |

### Inline table row — standard implementation

```tsx
<tr className="bg-[accent]/5 border-b border-[accent]/20">
  <td className="px-3 py-2">
    <Input autoFocus value={form.field} onChange={...}
      onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') cancel(); }}
      placeholder="e.g. Value"
      className="h-7 text-base sm:text-xs px-2"
      data-testid="input-add-field" />
  </td>
  <td className="px-2 py-2">
    <div className="flex items-center gap-1 justify-end">
      <button onClick={handleSave} aria-label="Save"
        className="p-1.5 rounded-md bg-[accent] text-white focus-visible:ring-2 focus-visible:ring-[accent]/50">
        {isPending ? <Loader2 className="h-3 w-3 animate-spin motion-reduce:animate-none" /> : <Check className="h-3 w-3" />}
      </button>
      <button onClick={cancel} aria-label="Cancel"
        className="p-1.5 rounded-md hover:bg-muted/60 text-muted-foreground focus-visible:ring-2 focus-visible:ring-border">
        <X className="h-3 w-3" />
      </button>
    </div>
  </td>
</tr>
```

**Rules:** `autoFocus` on first input · `Enter` = save · `Escape` = cancel · while editing, all other rows stay read-only · header toggle button swaps `Plus + "Add X"` → `X + "Cancel"` with muted style.

### Toggle button (Add ↔ Cancel)

```tsx
<Button size="sm" onClick={() => setShowAddRow(v => !v)}
  data-testid="button-toggle-add-row"
  className={showAddRow
    ? "bg-muted text-foreground hover:bg-muted/80 border-0"
    : "bg-[accent] text-white hover:bg-[accent]/90 border-0"
  }
>
  {showAddRow ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
  {showAddRow ? "Cancel" : "Add X"}
</Button>
```

---

## 16. Form Field Density

| Context | Label style | Input height | iOS-safe input size | Max cols/row |
|---|---|---|---|---|
| Inline table row | No labels — `"e.g. "` placeholder only | `h-7` | `text-base sm:text-xs` | Match table cols |
| Modal form | `<Label>` above, `text-xs font-semibold uppercase tracking-wide text-muted-foreground` | `h-10` | `text-base sm:text-sm` | 2 on `sm:`, 1 mobile |
| Settings / profile grid | `text-[10px] font-semibold uppercase tracking-widest text-muted-foreground` | `h-9` | `text-base sm:text-sm` | 3 on `lg:`, 2 on `sm:`, 1 mobile |
| Search / filter bar | No label — placeholder + search icon | `h-8` | `text-base sm:text-sm` | Inline flex row |

**Column grouping:** max 3 fields/row desktop · max 2 on `sm:` · group related fields (Phone + Email · City + Pincode) · long fields (`col-span-full`) · file/image upload always its own full-width row.

---

## 17. Table Design Standards

### Required structure

```tsx
<div className="overflow-x-auto">
  <table className="w-full text-xs">
    <thead>
      <tr className="border-b border-border/40 bg-muted/20">
        <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">Name</th>
        <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground">Amount</th>
        <th className="px-3 py-2.5" />
      </tr>
    </thead>
    <tbody className="divide-y divide-border/30">{rows}</tbody>
  </table>
</div>
```

### Column alignment

| Column type | Alignment |
|---|---|
| Names, labels, descriptions, status text | `text-left` |
| Numbers (₹, qty, count, %) | `text-right` |
| Dates | `text-left` |
| Actions column | No heading; cells use `justify-end` flex |

### Spacing and readability

- Use consistent cell padding across a table. The default dashboard pattern is
  approximately `px-4 py-2.5` for headers and body cells; reduce to `px-3 py-2`
  only when the table must fit a constrained mobile viewport.
- Give normal data rows a minimum visual target of approximately `44px` when they
  contain interactive controls or are read frequently. This is a readability and
  touch-target baseline, not a requirement to force every dense, non-interactive
  table row to exactly 44px.
- Keep horizontal padding at the outer table edges so text does not touch the
  border. Do not compensate for missing edge padding with arbitrary nested
  wrappers.
- Use `min-w-0`, truncation, wrapping, or an internal `overflow-x-auto` wrapper
  deliberately. Do not squeeze readable text into extremely narrow columns.
- For related metadata that would create large empty columns (for example,
  medicine dosage, frequency, and duration), combine it under the primary label
  as a secondary line such as `500 mg · OD · 20 days`.

### Section tables and summary rows

- Section banners should use consistent vertical/horizontal padding (normally
  `px-4 py-2.5`), a subtle divider, and a flat background. Avoid rounded cards
  nested inside the same document or record.
- Prefer a full-width section footer with a left-aligned count and right-aligned
  subtotal over a pseudo-row that repeats table columns solely to display a
  summary.
- Financial summaries should align labels and values to the same right-side
  measure as the table's financial columns. Use a consistent vertical rhythm
  such as `mt-4` with `gap-2`, and separate the final total with a divider.
- Do not place decorative status icons inside currency values. Represent paid or
  settled state with an explicit status label/badge and, where useful, an icon
  in the status or action area.
- Historical/read-only table content must apply its neutral state to rows,
  section footers, totals, and nested status text; active green/brand accents
  must not leak into historical descendants.
- Clinical and billing history sections should share the same flat document-flow
  treatment: remove decorative left/right inset wrappers and rounded inner
  record borders, using section dividers and row separators instead.
- Keep only a minimal radius, or no radius, on the outer historical record
  boundary. Rounded corners remain appropriate for controls, inputs, badges, and
  active editable panels.

### Row action visibility

```tsx
<tr className="group ...">
  <td>
    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity justify-end">
```

Max **2 icon actions** in hover zone. For 3+, use `DropdownMenu` with `MoreHorizontal`. **Delete always wrapped in `<AlertDialog>`.**

> Note: add `focus-within:opacity-100` so keyboard users can also see the actions.

### Empty state inside table

```tsx
{data.length === 0 && (
  <tr><td colSpan={columnCount}>
    <div className="py-12 text-center">
      <div className="p-3 bg-muted/40 rounded-full w-fit mx-auto mb-3">
        <Icon className="h-6 w-6 text-muted-foreground/40" />
      </div>
      <p className="text-sm font-medium text-muted-foreground">Nothing here yet</p>
      <p className="text-xs text-muted-foreground/60 mt-1">Hint or CTA sentence.</p>
    </div>
  </td></tr>
)}
```

### Font size by context

| Context | Cell size |
|---|---|
| Clinic / Doctor dashboard tables | `text-xs` |
| Admin panel tables | `text-sm` |
| Never | `text-base` or larger |

---

## 18. Data States

Every `useQuery` section must handle all three states before it can be marked done:

```tsx
const { data, isLoading, isError, refetch } = useQuery({ queryKey: [...] });

if (isLoading) return <SkeletonLayout />;
if (isError)   return <ErrorState onRetry={refetch} />;
if (!data?.length) return <EmptyState />;
```

| State | UI requirement |
|---|---|
| **Loading** | `<Skeleton>` shaped like real content with matching height. Never a bare spinner for a full section. |
| **Empty** | Icon + human-readable sentence + primary CTA (e.g. "Create your first slot"). |
| **Error** | Short plain-language message + `<Button onClick={refetch}>Try again</Button>`. Never just "An error occurred." |
| **Partial / stale** | Show stale data with a subtle indicator rather than a full loading replace. |

---

## 19. Skeleton Loading Patterns

Skeleton heights **must match the rendered content height exactly** to avoid CLS (layout shift when content loads).

### Card skeleton

```tsx
<div className="rounded-2xl border border-border/50 bg-background shadow-sm p-5 space-y-3">
  <div className="flex items-center gap-3">
    <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
    <div className="space-y-1.5 flex-1">
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-3 w-1/3" />
    </div>
  </div>
  <Skeleton className="h-3 w-full" />
  <Skeleton className="h-3 w-4/5" />
</div>
```

### List row skeleton

```tsx
<div className="flex items-center gap-3 px-4 py-3 border-b border-border/30">
  <Skeleton className="h-8 w-8 rounded-full shrink-0" />
  <div className="space-y-1.5 flex-1">
    <Skeleton className="h-3.5 w-1/3" />
    <Skeleton className="h-3 w-1/4" />
  </div>
  <Skeleton className="h-6 w-16 rounded-full" />
</div>
```

### Stat number skeleton

```tsx
<div className="space-y-1">
  <Skeleton className="h-7 w-16" />   {/* matches data-value text-2xl */}
  <Skeleton className="h-3 w-20" />   {/* matches label text-xs */}
</div>
```

### Rules

1. Match height precisely — measure the rendered real content and use exact `h-*` values.
2. `animate-pulse` is the default shimmer — respect `motion-reduce:animate-none`.
3. Show the same number of skeleton rows as you expect real rows (or use a fixed count of 3–5).
4. Never show a full-page spinner for a section that could show a skeleton.

---

## 20. Button & CTA Placement

| Context | Correct placement |
|---|---|
| Table / inline add row | End of inline row — `justify-end` in actions cell |
| Modal / Dialog | `DialogFooter` — Cancel left, primary right |
| Settings / profile card | Footer bar: `border-t border-border/40 bg-muted/20 px-4 py-3 flex justify-end` |
| Panel header action (Add, Export, Filter) | Right side of gradient header row — `shrink-0` button |
| Mobile / full-screen long form | `sticky bottom-0 pb-[env(safe-area-inset-bottom)] bg-background/95` |

### Destructive buttons

- Always `variant="destructive"` or `bg-destructive text-destructive-foreground`
- Always requires `<AlertDialog>` — no single-click deletes
- Never the primary/default action in a form

---

## 21. Info / Warning Banner Strips

Single-line notification rows inside a card — **never grow to two lines**.

```tsx
<TooltipProvider delayDuration={600}>
  <Tooltip>
    <TooltipTrigger asChild>
      <div className="flex items-center gap-1.5 text-[10px] font-semibold rounded-lg px-2.5 py-1 overflow-hidden cursor-default border {colour classes}">
        <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span className="truncate min-w-0">{message}</span>
      </div>
    </TooltipTrigger>
    <TooltipContent side="top" align="start" className="max-w-[220px] text-xs font-medium whitespace-normal">
      {message}
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```

### Colour tokens

| Intent | Text | Background | Border | Icon |
|---|---|---|---|---|
| Warning / past-due | `text-amber-600 dark:text-amber-400` | `bg-amber-50 dark:bg-amber-950/20` | `border-amber-200 dark:border-amber-800` | `AlertTriangle` |
| No-show / absent | `text-slate-600 dark:text-slate-400` | `bg-slate-50 dark:bg-slate-950/20` | `border-slate-200 dark:border-slate-700` | `AlertCircle` |
| Cancelled / error | `text-rose-600 dark:text-rose-400` | `bg-rose-50 dark:bg-rose-950/20` | `border-rose-200 dark:border-rose-800` | `AlertCircle` |
| Info / neutral | `text-sky-600 dark:text-sky-400` | `bg-sky-50 dark:bg-sky-950/20` | `border-sky-200 dark:border-sky-800` | `Info` |

**Rules:** always `truncate min-w-0` on text · always `TooltipProvider` · `overflow-hidden` on container · `shrink-0` on icon · `aria-hidden="true"` on decorative icon · never `italic` inside a banner.

---

## 22. Dashboard Panel Header Pattern

Every panel in the Clinic Dashboard and Doctor Dashboard **must** use this header. Never a plain `<div>` heading or bare `<h2>`.

### Structure

```tsx
<div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
  <div className="flex">
    <div className="w-1.5 bg-[colour]/60 shrink-0" aria-hidden="true" />
    <div className="flex-1 px-5 py-4 bg-gradient-to-r from-[colour]/[0.06] to-transparent flex items-center gap-3">
      <div className="h-9 w-9 rounded-xl bg-[colour]/10 border border-[colour]/20 flex items-center justify-center shrink-0" aria-hidden="true">
        <Icon className="h-[18px] w-[18px] text-[colour] dark:text-[colour]" />
      </div>
      <div>
        <h2 className="text-base font-semibold tracking-tight">Panel Title</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Static description.</p>
      </div>
    </div>
  </div>
</div>
```

### Accent colour reference — do NOT deviate

#### Clinic Dashboard

| Panel | Accent | Left bar | Gradient from | Icon colour |
|---|---|---|---|---|
| Bookings | sky | `bg-sky-500/60` | `from-sky-500/[0.06]` | `text-sky-600 dark:text-sky-400` |
| Configure Slots | blue | `bg-blue-500/60` | `from-blue-500/[0.06]` | `text-blue-600 dark:text-blue-400` |
| Manage Doctors | teal | `bg-teal-500/60` | `from-teal-500/[0.06]` | `text-teal-600 dark:text-teal-400` |
| Inventory | emerald | `bg-emerald-500/60` | `from-emerald-500/[0.06]` | `text-emerald-600 dark:text-emerald-400` |
| Pharmacy | orange | `bg-orange-500/60` | `from-orange-500/[0.06]` | `text-orange-600 dark:text-orange-400` |
| Clinic Website | sky | `bg-sky-500/60` | `from-sky-500/[0.06]` | `text-sky-600 dark:text-sky-400` |
| Accounts | primary | `bg-primary/60` | `from-primary/[0.06]` | `text-primary` |
| Patients | rose | `bg-rose-500/60` | `from-rose-500/[0.06]` | `text-rose-500` |
| Analytics | violet | `bg-violet-500/60` | `from-violet-500/[0.06]` | `text-violet-600 dark:text-violet-400` |

#### Doctor Dashboard

| Panel | Accent | Left bar | Gradient from | Icon colour |
|---|---|---|---|---|
| Appointments | primary | `bg-primary/60` | `from-primary/[0.06]` | `text-primary` |
| My Profile | violet | `bg-violet-500/60` | `from-violet-500/[0.06]` | `text-violet-600 dark:text-violet-400` |
| Certifications | blue | `bg-blue-500/60` | `from-blue-500/[0.06]` | `text-blue-600 dark:text-blue-400` |
| Case Studies | teal | `bg-teal-500/60` | `from-teal-500/[0.06]` | `text-teal-600 dark:text-teal-400` |
| Leave Management | amber | `bg-amber-500/60` | `from-amber-500/[0.06]` | `text-amber-600 dark:text-amber-400` |

### Rules

1. Title: always `text-base font-semibold tracking-tight` — never `text-xl` / `text-2xl`
2. Subtitle: static plain-English description — never dynamic counts
3. Icon: always `h-[18px] w-[18px]` inside `h-9 w-9 rounded-xl` — `aria-hidden="true"`
4. No new accent colours — pick the closest from the table above
5. New panels: add a row to the correct table above before writing code

---

## 23. Patient Detail Popup — Section Card Pattern

Applies exclusively to **section cards inside patient/booking detail popups and dialogs**.

### Two-tier header hierarchy

| Tier | Use for | Header bg | Text + icon |
|---|---|---|---|
| **Primary** | Highest-emphasis block — actionable status/decision | `bg-green-800` | `text-white` + white icon |
| **Secondary** | Content/records block — data lists, nested records | `bg-green-50 dark:bg-green-900/30` | `text-green-800 dark:text-green-300` + green icon |

### Card container (both tiers)

```tsx
<div className="rounded-xl border border-green-800/30 bg-white dark:bg-card shadow-sm overflow-hidden">
```

### Primary header (dark green — light + dark)

```tsx
<div className="px-3 py-2.5 bg-green-800 border-b border-green-900/20 flex items-center gap-1.5">
  <Icon className="h-3 w-3 text-white" aria-hidden="true" />
  <span className="text-xs font-semibold uppercase tracking-wide text-white">Section Title</span>
</div>
```

### Secondary header (mint — light + dark)

```tsx
<div className="px-3 py-2.5 bg-green-50 dark:bg-green-900/30 border-b border-green-800/30 dark:border-green-700/50 flex items-center gap-1.5">
  <Icon className="h-3 w-3 text-green-800 dark:text-green-300" aria-hidden="true" />
  <span className="text-xs font-semibold uppercase tracking-wide text-green-800 dark:text-green-300">Section Title</span>
</div>
```

### Content chips / tag badges (light + dark)

```tsx
<Badge variant="outline"
  className="text-xs px-2 py-0.5 rounded-full border-green-800/30 dark:border-green-700/50 bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-300 font-semibold">
  Tag Label
</Badge>
```

### Section header expand/collapse buttons (light + dark)

```tsx
<button className="w-full px-3 py-2 bg-green-50 dark:bg-green-900/30 flex items-center gap-1.5 hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors text-left">
  <Icon className="h-3 w-3 text-green-800 dark:text-green-300 shrink-0" aria-hidden="true" />
  <span className="text-xs font-semibold uppercase tracking-wider text-green-800 dark:text-green-300 flex-1">Section</span>
  <ChevronDown className="h-3 w-3 text-green-800 dark:text-green-300 shrink-0" aria-hidden="true" />
</button>
```

### What NOT to use

| Old (wrong) | Replace with |
|---|---|
| `bg-muted/40` header | `bg-green-800` (primary) or `bg-green-50 dark:bg-green-900/30` (secondary) |
| `border-border/60` card border | `border-green-800/30` |
| `bg-muted/20` card body | `bg-white dark:bg-card` |
| No shadow | `shadow-sm` |
| Missing dark variants | Always include `dark:` variants — see patterns above |

### Rules

1. **One primary, any number of secondary** — at most one dark-green header per popup
2. **Never** use this pattern for top-level dashboard panel headers
3. **`green-800` is the exception to the no-hardcode rule** — it is a semantic clinical domain token
4. **Dark mode is fully implemented** — always write both light and dark variants as shown above

---

## 24. Icon Library

| Source | Import | Use for |
|---|---|---|
| **Lucide** | `lucide-react` | All UI chrome: nav, close, search, chevrons, status, action buttons |
| **Line Awesome (LIA)** | `react-icons/lia` | Domain icons: dental categories, body parts, medical, health |
| **Material Design (MD)** | `react-icons/md` | Fallback where LIA has no match: warnings, build/repair, swap |

**Sizes:** `h-4 w-4` inline · `h-3.5 w-3.5` compact chrome · `h-5 w-5`+ decorative.

**Never use emoji strings as icons.** Never use SVG inline without a wrapper component.

**Accessibility:**
- Icons that convey meaning (not purely decorative): add `aria-label` or an adjacent `<span className="sr-only">`.
- Pure decorative icons: `aria-hidden="true"`.

---

## 25. Image & File Upload

### Shared upload component

```tsx
import { ImageUpload } from "@/components/ImageUpload";

<ImageUpload
  currentImage={existingUrl || undefined}
  onImageUploaded={(url) => save(url)}
  folder="clinics"                           // "clinics" | "doctors" | "users"
  fallbackText="Clinic Name"
  allowedTypes={["image/png", "image/jpeg"]}
  maxSizeKb={500}
/>
```

**Prop pitfalls:** `currentImage` not `currentImageUrl` · `onImageUploaded` not `onUploadComplete` · `folder` must be exactly `"clinics"` · `"doctors"` · `"users"`.

### All `<img>` tags — required attributes

```tsx
<img
  src={url}
  alt="Descriptive alt text"          // never empty unless truly decorative
  loading="lazy"                       // always, unless above-the-fold hero
  width={400}                          // explicit dimensions prevent CLS
  height={300}
  className="aspect-[4/3] object-cover w-full"   // aspect-ratio prevents CLS
/>
```

**Rule:** every `<img>` must have explicit `width` + `height` attributes OR a fixed `aspect-ratio` CSS class. This is a Core Web Vitals (CLS) requirement.

### Upload zone phases

| Phase | UI |
|---|---|
| Idle — no file | Dashed border zone, Upload icon, helper text |
| Idle — file set | Thumbnail preview, "Change" + "Remove" buttons |
| Optimising | `<Sparkles className="animate-pulse motion-reduce:animate-none" />` + "Optimising…" |
| Uploading | `<Loader2 className="animate-spin motion-reduce:animate-none" />` + "Uploading…" |
| Error | `<AlertCircle />` + plain-language message + retry button |

### Image format rule

Convert to WebP before committing. Use `loading="lazy"` unless above the fold on the landing page.

---

## 26. Scroll Behaviour

### `overscroll-behavior` — prevent scroll bleed

When a user reaches the end of a scrollable area inside a dialog/sheet/panel, the browser scrolls the page behind it. Prevent this:

```tsx
// On every scrollable interior region
className="overflow-y-auto overscroll-contain"

// On modal inner body
className="overflow-y-auto overscroll-y-contain"
```

### CSS Scroll Snap — for horizontal strips

Date strips, tab bars, card carousels:

```tsx
// Container
className="flex overflow-x-auto scroll-snap-x mandatory gap-2 pb-1"
style={{ scrollSnapType: 'x mandatory' }}

// Each item
style={{ scrollSnapAlign: 'start' }}
```

### Scrollbar gutter — prevent layout shift

For panels that conditionally show a scrollbar:
```tsx
className="overflow-y-auto"
style={{ scrollbarGutter: 'stable' }}
```

### `-webkit-overflow-scrolling`

Not needed in 2025+ — momentum scrolling is enabled by default on all modern mobile browsers.

---

## 27. Shadcn Components — Use These, Don't Reinvent

| Need | Component |
|---|---|
| Slide-in panels, mobile drawers | `Sheet` + `SheetContent` |
| Modals / dialogs | `Dialog` — always `w-[95vw] sm:max-w-[Xpx] max-h-[85dvh]` |
| Scrollable regions | `ScrollArea` |
| Dropdown pickers | `Popover` |
| Loading placeholders | `Skeleton` (shaped like real content) |
| Tab bars | `Tabs` + `TabsList` with `overflow-x-auto whitespace-nowrap` |
| Status chips | `Badge` |
| User avatars / initials | `Avatar` + `AvatarFallback` |
| Confirmation for destructive actions | `AlertDialog` |
| Contextual menus with 3+ actions | `DropdownMenu` |

Import path: `@/components/ui/[component]`

---

## 28. Performance

### Frontend

#### 1. Never load unused fonts

`client/index.html` loads exactly three families: **DM Sans** (body) · **Outfit** (`font-display`) · **Sora** (Smile Deals only). Do not add a new `<link>`. Consolidate into the existing one if a new family is genuinely needed.

#### 2. New heavy pages must be lazy-loaded

```tsx
// WRONG
import NewAdminPanel from "@/pages/NewAdminPanel";

// CORRECT
const NewAdminPanel = lazy(() => import("@/pages/NewAdminPanel"));
```

Already lazy: `ClinicDashboard` · `DoctorDashboard` · `Admin` · `Book` · `SmileDeals`.
Already eager (acceptable — small, shown early): `Landing` · `ClinicLogin` · `ConsentForm`.

#### 3. Gate queries on active panel / auth state

```tsx
// WRONG — fires on every page load
const { data } = useQuery({ queryKey: ['/api/auth/clinic/bookings'] });

// CORRECT
const { data } = useQuery({
  queryKey: ['/api/auth/clinic/bookings'],
  enabled: isAuthenticated && activePanel === 'bookings',
});
```

Every new `useQuery` in a dashboard panel **must** have an `enabled:` guard.

#### 4. No speculative memoization

Add `useMemo` / `useCallback` / `React.memo` only when: computation is measurably slow (sorting/filtering 500+ records) · callback identity causes visible re-renders · add a comment explaining why.

#### 5. New images: WebP + lazy + explicit dimensions

```tsx
<img src={heroImg} alt="Hero" loading="lazy" width={800} height={450}
  className="aspect-[16/9] object-cover" />
```

#### 6. Panel import audit (for new panels)

```bash
python3 script/audit-panel-imports.py
```

#### 7. Virtual scrolling for long lists

If a list exceeds **200 items**, use TanStack Virtual (`@tanstack/react-virtual`) to avoid rendering off-screen rows. Booking lists, patient directories, and inventory tables are candidates.

### Backend performance

See `backend-and-db-checklist.md` for: rate limiters · DB indexes · unbounded query prevention · Render SQL requirements.

### Performance checklist (frontend)

```
[ ] No new font family in index.html unless actively used
[ ] New page-level components use React.lazy() in App.tsx
[ ] Every new useQuery has an enabled: guard
[ ] No speculative useMemo/useCallback without documented reason
[ ] New images are WebP + loading="lazy" + explicit width/height or aspect-ratio
[ ] Lists > 200 items use virtual scrolling
[ ] Panel import audit passes
```

---

## 29. Core Web Vitals

These are the three metrics Google (and users) measure for page quality. Design decisions directly affect all three.

| Metric | Target | What affects it |
|---|---|---|
| **LCP** — Largest Contentful Paint | < 2.5 s | Hero image size, font loading, lazy-loading above-fold images |
| **CLS** — Cumulative Layout Shift | < 0.1 | Images without explicit dimensions, skeleton heights not matching content, late-loading fonts |
| **INP** — Interaction to Next Paint | < 200 ms | Heavy JS on click handlers, synchronous state updates, large re-renders |

### Rules tied to Core Web Vitals

1. **LCP image** (hero, clinic logo above fold): never `loading="lazy"` — load eagerly. Add `fetchpriority="high"`.
2. **CLS prevention**: every `<img>` needs explicit `width`/`height` or a CSS `aspect-ratio`. Every skeleton must match real content height.
3. **INP**: mutations must show pending state immediately (`isPending` spinner) — never wait for the server round-trip before giving user feedback.
4. **Font CLS**: `font-display: swap` is already set. Ensure `<link rel="preload">` is present for the above-fold font weight.

---

## 30. React Native Parity

Write these patterns correctly now to minimise rewrite effort for a future React Native / Expo port.

### Patterns to avoid

| Avoid | Use instead | RN reason |
|---|---|---|
| `backdrop-filter` on functional elements | Decorative overlays only | Not supported in RN |
| `position: fixed` inside scroll containers | `absolute`, or use `Sheet` / `Dialog` | RN has no fixed positioning |
| CSS `box-shadow` via arbitrary values | Tailwind `shadow-*` or `ring-*` | RN uses `elevation` (Android) / `shadowColor` (iOS) |
| Transitions on layout properties (width, height, padding) | Transition `opacity` and `transform` only | RN `Animated` only supports these |
| `::before` / `::after` for real layout content | Real DOM elements | No pseudo-elements in RN |
| `onMouseEnter` for core actions | `onClick` always | Touch devices have no hover |
| Complex CSS Grid with `grid-template-areas` | `flex flex-wrap` or simple `grid-cols-2/3` | RN flexbox has no grid |
| `100vh` / `100vw` | `100dvh` / window dimensions | RN uses `useWindowDimensions()` |

### React Native flexbox differences

| Web default | RN default | Action needed |
|---|---|---|
| `flexDirection: row` | `flexDirection: column` | Always explicitly set `flex-row` / `flex-col` — never rely on default |
| `flexWrap: nowrap` | `flexWrap: nowrap` | Same — fine |
| `alignItems: stretch` | `alignItems: stretch` | Same — fine |

> **Rule:** always explicitly write `flex-row` or `flex-col`. Never write just `flex` and rely on the web default.

### Navigation pattern compatibility

Structure routing and navigation in ways that map cleanly to React Navigation:

| Web (Wouter) | RN (React Navigation) | Design rule |
|---|---|---|
| `useLocation` + `<Route>` | Stack Navigator | Each "page" should be self-contained with no shared mutable state |
| Tab-based panels via `activePanel` state | Tab Navigator | Panel switcher should be isolated so it can become a `TabBar` |
| Bottom nav strip | Bottom Tab Navigator | Bottom nav is already the correct pattern — keep it |

### Gesture patterns

Document and implement gesture patterns now so they are expected on mobile web and portable to RN:

| Gesture | Web implementation | RN equivalent |
|---|---|---|
| Swipe to dismiss sheet | `vaul` Drawer (already used) | `react-navigation` modal |
| Pull to refresh | Add `onScroll` threshold + spinner at top | `RefreshControl` |
| Long press for context menu | `onContextMenu` + `DropdownMenu` | `onLongPress` |
| Swipe-to-delete row | Drag via CSS + threshold | `Swipeable` from `react-native-gesture-handler` |

---

## 31. PWA & Installability

Even before a React Native port, a Progressive Web App makes BookMySlot installable on Android and iOS home screens — a critical bridge step.

### Required additions (when implementing)

1. **Web App Manifest** (`public/manifest.json`):
```json
{
  "name": "BookMySlot",
  "short_name": "BookMySlot",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#0F9B6E",
  "background_color": "#F8F8F6",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

2. **`color-scheme` meta tag** (prevents white flash in dark mode on load):
```html
<meta name="color-scheme" content="light dark" />
```

3. **`theme-color` meta tag** (styles the browser chrome):
```html
<meta name="theme-color" content="#0F9B6E" />
```

4. **Offline fallback screen** — when the network is unavailable, show a branded offline screen rather than a browser error page.

### Offline state UI pattern

```tsx
// Detect offline
const isOnline = useNetworkState();   // from a simple hook using navigator.onLine

if (!isOnline) return (
  <div className="flex flex-col items-center justify-center min-h-[100dvh] gap-4 px-6 text-center">
    <WifiOff className="h-12 w-12 text-muted-foreground/40" />
    <h2 className="text-base font-semibold">You're offline</h2>
    <p className="text-sm text-muted-foreground">Check your connection and try again.</p>
    <Button onClick={() => window.location.reload()} variant="outline">Retry</Button>
  </div>
);
```

---

## 32. Space Efficiency

**Rule: never let a form consume vertical real estate that a table row or compact grid can handle.**

1. **Can it be an inline row?** If data maps to table columns → inline row, not an expand-panel.
2. **Can 2–3 fields share one row?** Phone + Email + Website → one grid row.
3. **Does this section need a `<Separator />`?** Only at genuine category boundaries. Never between fields of the same logical group.
4. **Save button placement** → footer bar at bottom of card: `px-4 py-3 border-t border-border/40 bg-muted/20 flex items-center justify-end gap-2`. Never floating mid-content.
5. **"Add" trigger** → panel header right side. Never an accordion at the bottom of a list.
6. **"Add" form position** → above the existing list, immediately after the panel header.
7. **Field gaps** → `space-y-3` / `space-y-4` between fields. `space-y-6` only between major sub-sections. Never `space-y-8`+.

---

## 33. Section Dividers & Visual Weight

| Divider type | When to use |
|---|---|
| `<Separator />` | Genuine category change within a card. Max **2 per card**. Never between fields of the same group. |
| `border-b border-border/40` | Card header → body · card body → footer |
| `space-y-3` / `space-y-4` | Between field groups — the default |
| `space-y-6` | Only between major sub-sections (e.g. Contact block vs. Address block) |
| **Never** | `space-y-8`+ inside any form or panel body |

### Sub-section header (inside a card)

```tsx
<p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
  Section Label
</p>
```

Promote to full icon + heading treatment only when the sub-section has ≥ 4 fields or a complex widget like a map or chart.

---

## 34. Historical / Older Data States

Historical records include older bills, past clinical records, previous visits, and any
read-only record that is no longer the active/current item in a patient detail view.
Historical styling must communicate “reference information” without making the record
look deleted, invalid, or unavailable.

### 34.1 Visual treatment

- Use a neutral slate surface for historical cards: `bg-slate-50` or the semantic
  equivalent, with a thin `border-slate-200` border and no heavy shadow.
- Use muted slate typography for record IDs, dates, quantities, prices, and section labels.
- Keep active/current records in the normal application hierarchy; do not mute the latest
  bill or the current clinical record.
- Paid historical billing status uses a neutral badge with an icon and text, not a bright
  success-green badge. Payment meaning must remain explicit.
- Historical totals use dark slate text. Do not use green as a decorative accent for a
  settled historical total.
- Historical action icons remain usable when they are safe and supported (for example,
  Preview, Print, and Download). Use muted gray with hover and focus-visible states;
  do not imply that a usable action is disabled.

### 34.2 Section dividers and accordions

- Use a subtle slate divider and an uppercase `text-xs` label for sections such as
  “Older Bills & History” and “Past Records”.
- Keep related history accordions consistent within a patient card: use one
  clickable slate header containing the history icon, uppercase label, inline
  count, and chevron, followed by a matching slate content surface.
- Historical bill boundaries should be distinguishable from their surrounding
  surface with a visible muted-slate border (for example, `border-slate-300`);
  do not rely on nearly identical background tones alone.
- The toggle must have a minimum 44px touch target, a visible chevron, and
  `aria-expanded` when it controls an expanded region.
- Historical accordions may use slate headers and borders, while active/actionable
  popup sections retain the established two-tier green section-card pattern.
- Do not introduce a separate global historical component or replace the popup layout
  with standalone HTML; apply the state to the existing component structure.

### 34.3 Read-only detail content

- Expanded historical tables use muted slate headers, white or very light slate rows,
  and subtle slate dividers.
- Historical section titles such as Consultation & Procedures and Pharmacy use neutral
  slate text and icons.
- Historical presentation must not change permissions, editability, payment mutations,
  calculations, invoice generation, print output, or audit behavior.
- Settled status and processor metadata should remain a single inline status group
  where space permits (for example, “Fully settled · Processed by Admin”), with
  wrapping only as a narrow-screen fallback.
- Historical state must propagate through nested descendants: section headers, paid
  line-item rows, status badges, table totals, sub-section labels, and history wrappers.
  A muted outer card is incomplete if bright active-record accents remain inside it.
- Genuine warnings and meaningful clinical classifications may retain semantic color,
  but decorative success/brand accents must not leak into historical read-only content.
- Expanded billing documents use one outer bill boundary. Do not nest rounded cards
  around Consultation, Pharmacy, Other, or totals sections; use flat dividers and
  section headers within the bill flow instead.
- Preserve only structural overflow wrappers for responsive tables. Avoid duplicate
  padding, inner shadows, and rounded borders that make one bill appear as multiple
  unrelated cards.
- If a role is still allowed to edit a record, historical styling must not hide or
  disable that role-appropriate edit action.

### 34.4 Responsive and accessibility requirements

- Historical headers and metadata must wrap at 375px without page-level horizontal
  scrolling. Tables may scroll within their own overflow wrapper when necessary.
- Maintain at least `text-xs` for production labels and a minimum 44px target for
  toggles and interactive utilities.
- Never communicate historical, paid, or read-only state through color alone; pair
  status color with text and an icon where applicable.
- Include dark-mode variants, visible keyboard focus, accessible labels for icon-only
  actions, and preserved `data-testid` attributes.

## 35. Code Quality & Readability

### Naming conventions

| Construct | Convention | Example |
|---|---|---|
| React component | `PascalCase` | `BookingCard`, `PatientDirectoryPanel` |
| Custom hook | `useXxx` | `useClinicAuth`, `useBookingStatus` |
| Event handler | `handleXxx` | `handleSave`, `handleCancelBooking` |
| Boolean state/prop | `isXxx` / `hasXxx` / `canXxx` | `isLoading`, `hasUnpaidBill` |
| Query key | Exact API path string | `['/api/auth/clinic/bookings']` |
| Magic number | Named constant at file top with unit comment | `const MAX_VISIBLE_COMPLAINTS = 4 // items` |
| Loop variable | Descriptive, never single-letter | `(booking, idx)` not `(b, i)` |

**Never abbreviate** variable names. `pat` is not `patient`. `bk` is not `booking`.

### Component architecture

- Extract components when a JSX block exceeds ~60 lines or appears in 2+ places
- Panel components: `client/src/components/XxxPanel.tsx` — one file per panel
- `App.tsx` is a router only — no business logic, no data fetching
- `useMutation` handlers live in the component that owns the action — never prop-drilled more than one level
- Local state (`useState`) stays local — never lift state to a parent speculatively

### Debug-friendly code

- **No nested ternaries** deeper than one level — extract to named variables or `if/else`
- **No boolean contortions** — extract complex boolean expressions to a named `const isXxx`
- **Backend error responses** always include `{ message: "..." }` — never bare `res.status(400).end()`
- **Server console logs** use `[TAG]` prefix: `console.log("[WHATSAPP] Sending to", phone)`

### Inline comments

Add a comment when: working around a known quirk · a state machine transition is non-obvious · intentionally NOT doing something expected · dual-auth diverges (mark OIDC vs email/password branch).

---

## 35. Input Field Style Standard & Placeholder Conventions

### 35.0 Form field label standard

#### `.label-field` — the single canonical class for all clinic-facing field labels

Defined in `client/src/index.css` `@layer utilities`:

```css
.label-field {
  @apply text-xs font-semibold uppercase tracking-wide text-muted-foreground;
}
```

**Use it on every `<Label>`, `<label>`, or `<p>` that sits directly above or beside an input in a clinic/admin-facing form.** Add contextual spacing at the usage site — never bake spacing into the class.

```tsx
// ✅ Correct — spacing is contextual
<Label className="label-field mb-1 block">Street Address</Label>
<Label className="label-field mb-1.5 block">Tagline Line 1</Label>

// ✅ Extra classes compose fine — specificity of Tailwind utilities means
//    the last declaration wins for the same property
<Label className="label-field leading-none">Total Patients</Label>

// ❌ Never do this — kills the single source of truth
<Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1 block">
  Street Address
</Label>
```

#### Exceptions — do NOT use `.label-field` for:

| Case | Instead use |
|---|---|
| Patient-facing labels (`Book.tsx` intake form) | `text-xs font-semibold text-muted-foreground` — sentence case, no uppercase |
| Threshold / alert labels in Inventory ("Reorder At", "Critical At") | `text-xs font-semibold uppercase tracking-wide mb-1 block text-yellow-600` — inline so the accent colour takes precedence cleanly |
| Panel section group dividers (not field labels) | Inline Tailwind — no single pattern since colours vary per section |

#### Tag choice

Prefer `<Label htmlFor="...">` (shadcn) for all real form fields — it wires the click-to-focus behaviour for free. Use raw `<label>` when the shadcn component is unavailable in context. Only use `<p>` for visual-only section labels that have no associated input (e.g. card section titles in ConsentFormPanel).

#### Audit command

```bash
# Should return ZERO results — every field label uses .label-field
grep -rn 'className="text-xs font-semibold uppercase tracking-wide\|text-xs font-bold.*uppercase\|text-\[1[01]px\].*font-semibold.*uppercase\|text-\[1[01]px\].*font-bold.*uppercase' client/src/

# Verify the class is defined exactly once
grep -rn '\.label-field' client/src/index.css   # must return exactly 1 result
```

---

### 35.1 Input field visual standard

#### `index.css` is the single source of truth for placeholder styling

`client/src/index.css` sets placeholder colour, opacity, and italic for **every** input surface in one place:

```css
/* @layer base — do not remove or move */
::placeholder {
  color: hsl(var(--muted-foreground) / 0.55);   /* muted green-gray at 55% */
  font-style: italic;
}

/* Radix <Select> — SelectValue renders a <span>, not a real input,
   so ::placeholder does not fire. Target the span directly. */
button[data-placeholder] > span:first-of-type {
  color: hsl(var(--muted-foreground) / 0.55);
  font-style: italic;
}
```

This covers every surface automatically:

| Surface | How it gets ghost text |
|---|---|
| Shadcn `<Input>` / `<Textarea>` | `::placeholder` global rule |
| Raw `<input>` / `<textarea>` | `::placeholder` global rule |
| Raw element with `style={}` (JS palette) | `::placeholder` global rule — pseudo-elements are reachable from CSS even when the element has inline styles |
| Shadcn `<Select>` trigger | `button[data-placeholder] > span` global rule |

#### What NOT to do

```tsx
// ❌ Never add these — they fight the global rule and double-apply opacity
className="placeholder:text-muted-foreground/55"
className="data-[placeholder]:text-muted-foreground/55 data-[placeholder]:italic"
```

Adding `placeholder:text-muted-foreground/55` on top of the global `::placeholder` rule compounds the opacity (0.55 × 0.55 ≈ 30%) and makes ghost text nearly invisible. Adding `data-[placeholder]:*` Tailwind classes on a `<SelectTrigger>` duplicates the global span rule with no benefit.

#### Focus ring — shadcn components

Baked into `client/src/components/ui/input.tsx` and `textarea.tsx`. Do not override without editing those files:

```
focus-visible:border-primary/60
focus-visible:ring-2
focus-visible:ring-ring/20
```

#### Focus ring — raw `<input>` elements

There is one intentional exception: `BookingsPanel.tsx` contains a raw `<input>` at the patient-search combobox. It uses `outline-none border-none focus:ring-0` because the focus ring is handled by the **parent container div** via a `patientSearchFocused` state flag. This is the correct pattern for a combobox — do not swap it for shadcn `<Input>` (which would add an unwanted border and background inside the already-styled container).

Any other raw `<input>` that is NOT embedded in a custom container must apply the focus ring manually:

```tsx
className="focus-visible:outline-none focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-ring/20"
```

#### Colour reference

| Token | HSL | Hex approx | Effect |
|---|---|---|---|
| `--muted-foreground` | `160 12% 45%` | `#6A7F74` | Muted green-gray |
| `/ 0.55` alpha | 55% opacity | — | Soft, clearly secondary |

#### Consistency audit commands

```bash
# Should return ZERO — no manual placeholder colour classes anywhere
grep -rn 'placeholder:text-muted-foreground\|data-\[placeholder\]:text-muted\|data-\[placeholder\]:italic' client/src/

# Should return exactly ONE file (index.css) — the global rule lives here only
grep -rn 'muted-foreground.*0\.55\|0\.55.*muted-foreground' client/src/
```

---

### 35.2 Ghost text content rules

**Rule 1 — Never use a placeholder as the only label.** Use `"e.g. "` prefix when no `<Label>` is visible:

| Wrong | Right |
|---|---|
| `placeholder="Clinic Name"` | `placeholder="e.g. Bright Smiles Dental"` |

**Rule 2 — No Western names. Indian examples only.**

| Wrong | Right |
|---|---|
| `placeholder="John Doe"` | `placeholder="e.g. Rahul Verma"` |
| `placeholder="Dr. John Smith"` | `placeholder="e.g. Dr. Ananya Krishnan"` |

**Rule 3 — No imperative / label-style instructions.**

| Wrong | Right |
|---|---|
| `placeholder="Enter reason…"` | `placeholder="e.g. Patient requested cancellation"` |

**Rule 4 — Phone numbers use Indian format:** `+91 98765 43210`

**Rule 5 — Format-shaped hints need no `"e.g. "` prefix:** `placeholder="••••••••"` · `placeholder="+91 98765 43210"`

### Approved placeholder quick reference

| Field | Placeholder |
|---|---|
| Patient / person name | `e.g. Rahul Verma` |
| Doctor name | `e.g. Dr. Ananya Krishnan` |
| Lead / profile doctor | `e.g. Dr. Arun Menon` |
| Walk-in patient name | `e.g. Ravi Kumar` |
| Admin-added doctor | `e.g. Dr. Suresh Iyer` |
| Email (with label) | `e.g. clinic@example.com` |
| Email (no label) | `e.g. doctor@clinic.com` |
| Phone (with label) | `+91 98765 43210` |
| Phone (no label) | `e.g. +91 98765 43210` |
| Password (new) | `Min. 8 characters` |
| Password (confirm) | `Re-enter to confirm` |
| Password (current, with label) | `Current password` |
| Search input | `Search by name, email…` |
| Address | `e.g. 12 MG Road, Ernakulam` |
| Receipt / ID | `e.g. RCP-001` |
| Date (text input) | `e.g. 27 May 2026` |
| Service description | `e.g. Scaling & Polishing` |
| Amount ₹ | `e.g. 800` |
| Payment method | `e.g. UPI / Cash` |
| Cancel reason | `e.g. Patient requested cancellation` |
| Alt cancel reason | `e.g. Emergency, personal reasons` |
| Medical complaint | `e.g. Toothache, sensitivity to cold` |
| Clinic name | `e.g. Bright Smiles Dental` |
| Hospital | `e.g. Apollo Hospital, Chennai` |
| Specialization | `e.g. General Dentist` |
| Degree | `e.g. BDS, MDS` |
| Profile URL slug | `e.g. dr-ananya-krishnan` |

---

## 36. Print Styles

The billing / invoice flow is a core feature. The app must print cleanly without browser chrome or navigation UI.

### Required `@media print` rules (add to `index.css`)

```css
@media print {
  /* Hide all navigation and chrome */
  header, nav, aside, .bottom-nav, .no-print {
    display: none !important;
  }

  /* Full-width content */
  main, .print-full-width {
    width: 100% !important;
    max-width: none !important;
    padding: 0 !important;
    margin: 0 !important;
  }

  /* Force white background — saves ink, ensures readability */
  * {
    background: white !important;
    color: black !important;
    box-shadow: none !important;
  }

  /* Avoid breaking billing tables across pages */
  table { page-break-inside: avoid; }
  tr { page-break-inside: avoid; }
  thead { display: table-header-group; }

  /* Page size */
  @page { size: A4; margin: 1.5cm; }
}
```

### Rules

- Add `className="no-print"` to any element that should never appear in print (action buttons, navigation, filters).
- Add `className="print-full-width"` to the billing detail card so it fills the page.
- Test print layout before shipping the billing feature — use browser print preview.

---

## 37. Master Submission Checklist

Before marking any screen or component done, run every item:

### Layout & Responsiveness
- [ ] Layout verified at 375 · 768 · 1024 · 1280 · 1440 px — no horizontal scroll
- [ ] Primary device (1280 px laptop) looks correct and well-proportioned
- [ ] `min-h-[100dvh]` used for app shell — not `min-h-screen`
- [ ] All tap targets `min-h-[44px]`; icon-only buttons `h-11 w-11`
- [ ] Bottom nav has `padding-bottom: env(safe-area-inset-bottom)`
- [ ] Sticky submit buttons have `pb-[env(safe-area-inset-bottom)]`
- [ ] No hardcoded hex/hsl — CSS vars and Tailwind semantic classes only
- [ ] Dark mode tested — every element readable and correctly coloured, dark variants present
- [ ] Date/time pickers use `grid grid-cols-2` on mobile, not stacked full-width

### Accessibility
- [ ] All interactive elements reachable by Tab key
- [ ] Every focused element has a visible focus ring (`focus-visible:ring-2`)
- [ ] Icon-only buttons have `aria-label`
- [ ] Decorative icons have `aria-hidden="true"`
- [ ] Status indicators use icon + colour — never colour alone
- [ ] Dynamic content regions use `role="status"` or `aria-live`

### Animation
- [ ] Every animation has `motion-reduce:` variant to disable for reduced-motion users
- [ ] No layout-property transitions (width, height, padding) — only opacity + transform

### Data States
- [ ] Loading, empty, and error states exist for every `useQuery` section
- [ ] Skeleton heights match real content heights
- [ ] Empty state inside tables uses `<tr><td colSpan={N}>` pattern

### Forms & Inputs
- [ ] All inputs use `text-base sm:text-sm` (never bare `text-xs` or `text-sm` on mobile — iOS zoom)
- [ ] Correct form pattern chosen from the Form Architecture table
- [ ] "Add" button is in the panel header, not an accordion at the bottom
- [ ] "Add" form appears **above** the existing list
- [ ] Input heights: `h-7` inline · `h-9` compact grid · `h-10` modal — no mixing
- [ ] Max 3 fields/row desktop; max 2 on `sm:`
- [ ] All inputs: correct `type` + `onFocus` scroll-into-view
- [ ] Inline rows: Enter = save, Escape = cancel `onKeyDown` handlers

### Tables
- [ ] Numbers/prices right-aligned; names/labels left-aligned
- [ ] Row actions `opacity-0 group-hover:opacity-100 focus-within:opacity-100`
- [ ] Max 2 icon actions in hover zone; 3+ use `DropdownMenu`
- [ ] Delete/destructive actions wrapped in `AlertDialog`

### Images
- [ ] Every `<img>` has `alt`, explicit `width`/`height` or `aspect-ratio` class (prevents CLS)
- [ ] Non-hero images use `loading="lazy"`
- [ ] Hero / above-fold images use `fetchpriority="high"` and no `loading="lazy"`
- [ ] Format is WebP

### Architecture
- [ ] No `backdrop-filter` on structural/functional elements
- [ ] No `position: fixed` inside a scroll container
- [ ] Every `flex` container explicitly sets `flex-row` or `flex-col`
- [ ] No nested ternaries deeper than one level
- [ ] Complex boolean expressions extracted to named `const isXxx`
- [ ] New shared types/constants imported from canonical files — never redefined locally
- [ ] Every new `useQuery` has an `enabled:` guard
- [ ] Z-index values only from the defined scale in Section 7
- [ ] Scrollable inner regions use `overscroll-contain`

### Build & Quality
- [ ] Build Check finished with exit 0
- [ ] No duplicate exports for any new type/const
- [ ] No bare fetch('/api/...') or localhost in client/src/
- [ ] No console.log / debugger in files you touched
- [ ] Every new interactive element has `data-testid`
- [ ] Panel import audit passes (if new panel added)

---

*v2 — July 2026. Primary target: Laptop 1280–1440 px. Fully responsive: 375 px → 1920 px+.*
