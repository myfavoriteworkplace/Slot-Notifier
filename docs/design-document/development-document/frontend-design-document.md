# BookMySlot — Frontend Agent Reference

> **Scope:** Frontend UI rules, patterns, and gates. For backend/DB rules see `backend-and-db-checklist.md`. For deployment and env vars see `replit.md`.

---

## ⚠️ CRITICAL: Production Bundle TDZ Rule

**This caused a production `ReferenceError: Cannot access 'X' before initialization` crash — invisible in `npm run dev`.**

Vite+Rollup bundles ClinicDashboard into one minified chunk. If the **same exported name appears in two source files** in that chunk, Rollup renames one during minification and can access it before initialization (TDZ).

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

---

## ✅ Feature Completion Gate

Run every item after **every** UI change — including small edits.

### 1 — Build Check (hard gate)
```
restart_workflow("Build Check")   # must reach FINISHED with exit 0
```

### 2 — Duplicate export scan
```bash
grep -rn "export.*YourNewName" client/src/
# Must return exactly one result
```

### 3 — Bare fetch / URL scan
```bash
grep -rn "fetch('/api" client/src/
grep -rn 'fetch("/api' client/src/
grep -rn "localhost" client/src/
# All three must return zero results
```

### 4 — Responsiveness check
Verify layout at: **mobile 375 px** · **tablet 768 px** · **desktop 1280 px**. No horizontal scroll at any breakpoint.

### 5 — No debug code in committed JSX
```bash
grep -rn "console\.log\|console\.warn\|console\.error\|debugger" client/src/
# Must return zero results in any file you touched
```

### Quick gate summary
```
[ ] Build Check finished with exit 0
[ ] No duplicate exports for any new type/const
[ ] No bare fetch('/api/...') or localhost in client/src/
[ ] No console.log / debugger in files you touched
[ ] Layout verified at mobile · tablet · desktop
[ ] Every new interactive element has data-testid and aria-label (if icon-only)
[ ] Section cards inside detail popups use green two-tier header (NOT bg-muted/bg-border)
```

---

## ICON LIBRARY

| Source | Import | Use for |
|---|---|---|
| **Lucide** | `lucide-react` | All UI chrome: nav, close, search, chevrons, status, action buttons |
| **Line Awesome (LIA)** | `react-icons/lia` | Domain icons: dental categories, body parts, medical, health |
| **Material Design (MD)** | `react-icons/md` | Fallback where LIA has no match: warnings, build/repair, swap |

Never use emoji strings as icons. Sizes: `h-4 w-4` inline · `h-3.5 w-3.5` compact chrome · `h-5 w-5`+ decorative.

---

## LAYOUT

Design for **1280 px desktop first**. Adapt downward with `sm:` / `lg:` breakpoints.

### Desktop
- Shell: `flex flex-row gap-6`. Sidebar: `w-60 shrink-0 sticky top-[70px]`. Content: `flex-1 min-w-0`.
- Section grids: `grid grid-cols-2 lg:grid-cols-3 gap-4`.
- Page padding: `px-6 py-6`. Max width: `max-w-5xl mx-auto` (data-dense: `max-w-7xl`).
- Cards: `rounded-2xl border border-border/50 bg-background shadow-sm`.

### Mobile (375 px)
- Default: `flex flex-col gap-3`. Multi-column only at `sm:` or `lg:`.
- Page padding: `px-4`. Drop `max-w` constraints.
- **Sidebar**: `hidden lg:flex lg:flex-col`. Replace with sticky bottom nav on mobile:

```jsx
{/* Add pb-24 lg:pb-0 to the page content wrapper */}
<nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-background/95 backdrop-blur-md border-t border-border/50 shadow-[0_-4px_24px_rgba(0,0,0,0.08)]">
  <div className="flex items-stretch">
    {PRIMARY_TABS.map(({ key, label, Icon }) => (
      <button key={key} onClick={() => setActiveTab(key)}
        className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[60px] transition-colors relative">
        <Icon className="h-5 w-5" />
        <span className="text-[10px] font-semibold">{label}</span>
      </button>
    ))}
    <button onClick={() => setMoreDrawerOpen(true)}
      className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[60px]">
      <MoreHorizontal className="h-5 w-5" />
      <span className="text-[10px] font-semibold">More</span>
    </button>
  </div>
</nav>

<Sheet open={moreDrawerOpen} onOpenChange={setMoreDrawerOpen}>
  <SheetContent side="bottom" className="rounded-t-2xl">
    {/* secondary panel links */}
  </SheetContent>
</Sheet>
```

---

## MOBILE PROPORTIONALITY

### Spacing
- Card outer padding: `p-3 sm:p-5` — never flat `p-5`
- Column gap: `space-y-3 sm:space-y-4` — never flat `space-y-4`
- Two-column layout gap: `gap-5` mobile · `lg:gap-6` desktop

### Touch Targets — hard floor
- Every tappable element: `min-h-[44px]`
- Icon-only buttons (prev/next, close, clear): **`h-11 w-11`** — never `h-10 w-10`
- Navigation chevrons inside pickers: also `h-11 w-11`

### Date / Time Pickers
Never stack FROM/TO pickers as two full-width rows on mobile:
```jsx
<div className="grid grid-cols-2 gap-2 sm:flex sm:flex-row sm:flex-wrap sm:items-end sm:gap-3">
  {/* FROM picker */}
  {/* TO picker */}
  {/* conditional badge — col-span-2 sm:col-span-1 */}
</div>
```

### Font Size Floor
**Minimum: `text-xs` (12 px).** Never `text-[10px]` or smaller except:
1. Bottom-nav bar label — structurally constrained to 60 px bar
2. Compact grid ALL-CAPS field labels above `h-9` inputs in `lg:grid-cols-3` settings grids

### Mobile Proportionality Checklist
- [ ] Date pickers: `grid grid-cols-2` mobile, not stacked full-width
- [ ] Icon/nav buttons: `h-11 w-11` minimum
- [ ] Card padding: `p-3 sm:p-5`
- [ ] Section gap: `space-y-3 sm:space-y-4`
- [ ] No `text-[Xpx]` below `text-xs` (except bottom-nav label)
- [ ] Narrow panels (≤ 288 px): `grid-cols-1` only
- [ ] Conditional grid items: `col-span-2` on mobile

---

## TOUCH & INTERACTION

- Every tappable element: `min-h-[44px]`. Icon-only: add `p-2`.
- Every `hover:` state must have a matching `active:`. Primary buttons: `active:scale-[0.98] transition-transform`.
- Use `onClick` for core actions. Never `onMouseEnter` — touch devices have no hover.
- Dropdowns and date pickers: use shadcn `Popover` — touch-compatible out of the box.

---

## COLOUR

**Always use CSS variables — never hardcode hex or hsl inline.**

Core tokens: `var(--primary)` · `var(--accent)` · `var(--background)` · `var(--card)` · `var(--muted)` · `var(--border)` · `var(--foreground)` · `var(--muted-foreground)`

### Brand palette
| Role | Value | Tailwind pattern |
|---|---|---|
| Primary | `#0F9B6E` | `bg-primary/10`, `text-primary`, `border-primary/20` |
| Dark green | `#085041` | Header bg, gradient starts |
| Accent | `#1D9E75` | Hover states, gradient ends |
| Light tint | `#E1F5EE` | Panel fills |
| Page bg | `#F8F8F6` | Near-white surface |

### Semantic status colours
| Status | Classes |
|---|---|
| Pending / Awaiting | `bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border-amber-300` |
| Confirmed / Upcoming | `bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-200` |
| Cancelled / Declined | `bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border-rose-200` |
| Past / Completed | `bg-slate-50 dark:bg-slate-900/40 text-slate-500 dark:text-slate-400 border-slate-200` |
| Today | `bg-sky-50 dark:bg-sky-950/20 text-sky-600 dark:text-sky-400 border-sky-200` |

Every colour choice must look correct in **light and dark mode**. Test by toggling the theme before finishing.

---

## IMAGE & FILE UPLOAD

### Shared component — use for every single-image avatar/logo/photo slot

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

**Provided automatically:** circular Avatar + initials fallback · hover camera overlay · sparkle animation during optimise · spinner during upload · ✕ remove button · uploads via `POST /api/uploads/signed-url` → PUT to R2.

**Use `ImageUpload` for:** single circular image attached to a record (clinic logo, doctor photo).
**Do NOT use for:** rectangular hero/banner images · multi-file uploads · case media.

**Prop pitfalls:**
- `currentImage` not `currentImageUrl`
- `onImageUploaded` not `onUploadComplete`
- `folder` must be exactly: `"clinics"` · `"doctors"` · `"users"`

**Required states for any bespoke upload zone:**

| Phase | UI |
|---|---|
| Idle — no file | Dashed border zone, Upload icon, helper text |
| Idle — file set | Thumbnail preview, "Change" + "Remove" buttons |
| Optimising | `<Sparkles className="animate-pulse" />` + "Optimising…" |
| Uploading | `<Loader2 className="animate-spin" />` + "Uploading…" |
| Error | `<AlertCircle />` + plain-language message + retry button |

---

## SHADCN COMPONENTS — USE THESE, DON'T REINVENT

| Need | Component |
|---|---|
| Slide-in panels, mobile drawers | `Sheet` + `SheetContent` |
| Modals / dialogs | `Dialog` — always `w-[95vw] sm:max-w-[Xpx] max-h-[85vh]` |
| Scrollable regions | `ScrollArea` |
| Dropdown pickers | `Popover` |
| Loading placeholders | `Skeleton` (shaped like real content) |
| Tab bars | `Tabs` + `TabsList` with `overflow-x-auto whitespace-nowrap` |
| Status chips | `Badge` |
| User avatars / initials | `Avatar` + `AvatarFallback` |

Import path: `@/components/ui/[component]`

---

## DATA STATES — REQUIRED ON EVERY FETCHING SECTION

Every `useQuery` section must handle all three states:

```tsx
const { data, isLoading, isError, refetch } = useQuery({ queryKey: [...] });

if (isLoading) return <SkeletonLayout />;
if (isError)   return <ErrorState onRetry={refetch} />;
if (!data?.length) return <EmptyState />;
```

- **Loading:** `<Skeleton>` shaped like real content. Never a bare spinner for a full section.
- **Empty:** Icon + human-readable sentence + primary CTA (e.g. "Create your first slot").
- **Error:** Short plain-language message + `<Button onClick={refetch}>Try again</Button>`.

---

## TYPOGRAPHY

| Role | Classes |
|---|---|
| Page title | `text-xl md:text-2xl font-semibold` |
| Section heading | `text-base md:text-lg font-semibold` |
| Card heading | `text-sm font-semibold` |
| Body text | `text-sm` |
| Secondary / meta | `text-xs text-muted-foreground` |
| Card label (ALL CAPS) | `text-xs font-semibold uppercase tracking-wide text-muted-foreground` |
| Data value | `text-base font-semibold` |
| Display / hero | Add `font-display` (Outfit). All other text defaults to DM Sans. |

**Minimum size in any production UI: `text-xs`.** Permitted sub-xs exceptions: bottom-nav label · compact grid ALL-CAPS field label (see Mobile Proportionality).

---

## FORMS & MOBILE KEYBOARD SAFETY

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
    <Button className="w-full">Submit</Button>
  </div>
  ```

---

## FORM ARCHITECTURE — CHOOSE THE RIGHT PATTERN FIRST

| Situation | Correct pattern |
|---|---|
| Adding a row to a table (≤ 6 fields, fields map to table columns) | **Inline table row** — inputs as first `<tbody>` row; toggled by "Add X" in panel header |
| Editing an existing table row (≤ 6 fields) | **Inline row edit** — row's display cells swap to input cells in-place |
| 7+ fields, file uploads, or nested data | **Dialog / Modal** — `w-[95vw] sm:max-w-lg max-h-[85vh] overflow-y-auto` |
| Settings, profile, configuration | **Compact grid inside card** — `grid grid-cols-2 lg:grid-cols-3 gap-3` |
| Multi-step flow or destructive action | **Full-page step or `Sheet` drawer from bottom** |
| **NEVER** | Expand-panel / accordion that pushes content down below a list |

### Inline table row — standard implementation

```tsx
<tr className="bg-[accent]/5 border-b border-[accent]/20">
  <td className="px-3 py-2">
    <Input autoFocus value={form.field} onChange={...}
      onKeyDown={e => e.key === 'Enter' && handleSave()}
      placeholder="e.g. Value" className="h-7 text-xs px-2" />
  </td>
  <td className="px-2 py-2">
    <div className="flex items-center gap-1 justify-end">
      <button onClick={handleSave} className="p-1.5 rounded-md bg-[accent] text-white">
        {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
      </button>
      <button onClick={cancel} className="p-1.5 rounded-md hover:bg-muted/60 text-muted-foreground">
        <X className="h-3 w-3" />
      </button>
    </div>
  </td>
</tr>
```

**Rules:** `autoFocus` on first input · **Enter** = save · **Escape** = cancel · while editing, all other rows stay read-only · header toggle button swaps `Plus + "Add X"` → `X + "Cancel"` with muted style.

### Inline row edit
```tsx
if (editingId === item.id) {
  return <tr className="bg-[accent]/5 ...">
    {/* input cells — same structure as add row */}
  </tr>;
}
```

---

## FORM FIELD DENSITY

| Context | Label style | Input height | Max cols/row |
|---|---|---|---|
| Inline table row | No labels — placeholder only (`"e.g. "` prefix) | `h-7` | Match table columns |
| Modal form | `<Label>` above, `text-xs font-semibold uppercase tracking-wide text-muted-foreground` | `h-10` | 2 on `sm:`, 1 mobile |
| Settings / profile grid | `text-[10px] font-semibold uppercase tracking-widest text-muted-foreground` | `h-9` | 3 on `lg:`, 2 on `sm:`, 1 mobile |
| Search / filter bar | No label — placeholder + search icon | `h-8` | Inline flex row |

**Column grouping:** max 3 fields/row desktop · max 2 on `sm:` · group related fields (Phone + Email · City + Pincode) · long fields (`col-span-full`) · file/image upload always its own full-width row.

---

## TABLE DESIGN STANDARDS

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

### Row action visibility
```tsx
<tr className="group ...">
  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
```
Max **2 icon actions** in hover zone. For 3+, use `DropdownMenu` with `MoreHorizontal`. **Delete always wrapped in `<AlertDialog>`.**

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

## SPACE EFFICIENCY

**Rule: never let a form consume vertical real estate that a table row or compact grid can handle.**

1. **Can it be an inline row?** If data maps to table columns → inline row, not an expand-panel.
2. **Can 2–3 fields share one row?** Phone + Email + Website → one grid row.
3. **Does this section need a `<Separator />`?** Only at genuine category boundaries. Never between fields of the same logical group.
4. **Save button placement** → footer bar at bottom of card: `px-4 py-3 border-t border-border/40 bg-muted/20 flex items-center justify-end gap-2`. Never floating mid-content.
5. **"Add" trigger** → panel header right side. Never an accordion at the bottom of a list.
6. **"Add" form position** → above the existing list, immediately after the panel header.
7. **Field gaps** → `space-y-3` / `space-y-4` between fields. `space-y-6` only between major sub-sections. Never `space-y-8`+.

---

## BUTTON / CTA PLACEMENT

| Context | Correct placement |
|---|---|
| Table / inline add row | End of inline row — `justify-end` in actions cell |
| Modal / Dialog | `DialogFooter` — Cancel left, primary right |
| Settings / profile card | Footer bar: `border-t border-border/40 bg-muted/20 px-4 py-3 flex justify-end` |
| Panel header action (Add, Export, Filter) | Right side of gradient header row — `shrink-0` button |
| Mobile / full-screen long form | `sticky bottom-0 pb-[env(safe-area-inset-bottom)] bg-background/95` |

### Toggle button (Add ↔ Cancel)
```tsx
<Button size="sm" onClick={() => setShowAddRow(v => !v)}
  className={showAddRow
    ? "bg-muted text-foreground hover:bg-muted/80 border-0"
    : "bg-[accent] text-white hover:bg-[accent]/90 border-0"
  }
>
  {showAddRow ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
  {showAddRow ? "Cancel" : "Add X"}
</Button>
```

### Destructive buttons
- Always `variant="destructive"` or `bg-destructive text-destructive-foreground`
- Always requires `<AlertDialog>` — no single-click deletes
- Never the primary/default action

---

## INFO / WARNING BANNER STRIPS

Single-line notification rows inside a card — **never grow to two lines**.

```tsx
<TooltipProvider delayDuration={600}>
  <Tooltip>
    <TooltipTrigger asChild>
      <div className="flex items-center gap-1.5 text-[10px] font-semibold rounded-lg px-2.5 py-1 overflow-hidden cursor-default border {colour classes}">
        <Icon className="h-3 w-3 shrink-0" />
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

**Rules:** always `truncate min-w-0` on text · always `TooltipProvider` (truncated text must be readable on hover) · `overflow-hidden` on container · `shrink-0` on icon · `TooltipContent` uses `max-w-[220px] whitespace-normal` · never `italic` inside a banner · in card context add `mx-3 sm:mx-4 mb-1`.

---

## SECTION DIVIDERS & VISUAL WEIGHT

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
Promote to full icon + heading treatment only when the sub-section has ≥ 4 fields or a complex widget like a map.

---

## REACT NATIVE PARITY

Write these patterns correctly now to minimise rewrite effort for a future RN port.

| Avoid | Use instead |
|---|---|
| `backdrop-filter` on functional elements | Decorative overlays only |
| `position: fixed` inside scroll containers | `absolute`, or use `Sheet` / `Dialog` |
| CSS `box-shadow` via arbitrary values | Tailwind `shadow-*` or `ring-*` |
| Transitions on layout properties (width, height, padding) | Transition `opacity` and `transform` only |
| `::before` / `::after` for real layout content | Real DOM elements |
| `onMouseEnter` for core actions | `onClick` always |
| Complex CSS Grid systems | `flex flex-wrap` for portability |
| Sidebar as a persistent fixed panel | Isolate sidebar state for future `TabBar` swap |

Simple `grid-cols-2` / `grid-cols-3` card layouts are fine.

---

## DASHBOARD PANEL HEADER — MANDATORY PATTERN

Every panel in the Clinic Dashboard and Doctor Dashboard **must** use this header. Never a plain `<div>` heading or bare `<h2>`.

### Structure
```tsx
<div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
  <div className="flex">
    <div className="w-1.5 bg-[colour]/60 shrink-0" />
    <div className="flex-1 px-5 py-4 bg-gradient-to-r from-[colour]/[0.06] to-transparent flex items-center gap-3">
      <div className="h-9 w-9 rounded-xl bg-[colour]/10 border border-[colour]/20 flex items-center justify-center shrink-0">
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

### With action buttons
Add `justify-between` to the gradient row; wrap icon+title in `flex items-center gap-3`; button with `shrink-0` on the right.

### Accent colour reference — do NOT deviate

#### Clinic Dashboard
| Panel | Accent | Left bar | Gradient from | Icon colour |
|---|---|---|---|---|
| Bookings | sky | `bg-sky-500/60` | `from-sky-500/[0.06]` | `text-sky-600 dark:text-sky-400` |
| Configure Slots | blue | `bg-blue-500/60` | `from-blue-500/[0.06]` | `text-blue-600 dark:text-blue-400` |
| Manage Doctors | teal | `bg-teal-500/60` | `from-teal-500/[0.06]` | `text-teal-600 dark:text-teal-400` |
| Inventory | emerald | `bg-emerald-500/60` | `from-emerald-500/[0.06]` | `text-emerald-600 dark:text-emerald-400` |
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
1. Title: always `text-base font-semibold tracking-tight` — never `text-xl`/`text-2xl`
2. Subtitle: static plain-English description — never dynamic counts (those go in stat cards below)
3. Icon: always `h-[18px] w-[18px]` inside `h-9 w-9 rounded-xl`
4. No new accent colours — pick the closest from the table above
5. New panels: add a row to the correct table above before writing code

---

## PATIENT DETAIL POPUP — SECTION CARD PATTERN

Applies exclusively to **section cards inside patient/booking detail popups and dialogs**. Not for top-level dashboard panel headers (those use the gradient + accent system above).

### Two-tier header hierarchy
| Tier | Use for | Header bg | Text + icon |
|---|---|---|---|
| **Primary** | Highest-emphasis block — actionable status/decision (e.g. "Clinical Status") | `bg-green-800` | `text-white` + white icon |
| **Secondary** | Content/records block — data lists, nested records (e.g. "Clinical Records") | `bg-green-50` | `text-green-800` + green icon |

### Card container (both tiers)
```tsx
<div className="rounded-xl border border-green-800/30 bg-white shadow-sm overflow-hidden">
```

### Primary header (dark green)
```tsx
<div className="px-3 py-2.5 bg-green-800 border-b border-green-900/20 flex items-center gap-1.5">
  <Icon className="h-3 w-3 text-white" />
  <span className="text-xs font-semibold uppercase tracking-wide text-white">Section Title</span>
</div>
```

### Secondary header (mint)
```tsx
<div className="px-3 py-2.5 bg-green-50 border-b border-green-800/30 flex items-center gap-1.5">
  <Icon className="h-3 w-3 text-green-800" />
  <span className="text-xs font-semibold uppercase tracking-wide text-green-800">Section Title</span>
</div>
```

### Content chips / tag badges
```tsx
<Badge variant="outline"
  className="text-xs px-2 py-0.5 rounded-full border-green-800/30 bg-green-50 text-green-800 font-semibold">
  Tag Label
</Badge>
```

### Neutral / "Not set" chip (dropdown trigger)
```tsx
// ✅ Correct — mint tint
'bg-green-50 text-green-800 border-green-800/30'
// ❌ Wrong — invisible grey (old pattern)
'bg-muted/40 text-muted-foreground border-border/60'
```

### What NOT to use
| Old (wrong) | Replace with |
|---|---|
| `bg-muted/40` header | `bg-green-800` (primary) or `bg-green-50` (secondary) |
| `border-border/60` card border | `border-green-800/30` |
| `bg-muted/20` card body | `bg-white` |
| No shadow | `shadow-sm` |

### Rules
1. **One primary, any number of secondary** — at most one dark-green header per popup
2. **Never** use this pattern for top-level dashboard panel headers
3. **`green-800` is the exception to the no-hardcode rule** — it is a semantic clinical domain token. Do not replace with `primary` (`#0F9B6E` is brighter teal, not this forest green)
4. Dark mode: add `dark:bg-green-900` / `dark:bg-green-950/30` variants when dark mode is extended to popup detail views

---

## CODE QUALITY & READABILITY

### Naming conventions
| Construct | Convention | Example |
|---|---|---|
| React component | `PascalCase` | `BookingCard`, `PatientDirectoryPanel` |
| Custom hook | `useXxx` | `useClinicAuth`, `useBookingStatus` |
| Event handler | `handleXxx` | `handleSave`, `handleCancelBooking` |
| Boolean state/prop | `isXxx` / `hasXxx` / `canXxx` | `isLoading`, `hasUnpaidBill` |
| Query key | Exact API path string | `['/api/auth/clinic/bookings']` |
| Magic number | Named constant at file top | `const MAX_VISIBLE_COMPLAINTS = 4` |
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

### Inline comments — explain *why*, not *what*
Add a comment when:
- Working around a known quirk or constraint
- A state machine transition is non-obvious (booking status, visit status)
- Intentionally NOT doing something a reader would expect (e.g. not invalidating a cache key)
- Dual-auth diverges — mark which branch is OIDC and which is email/password

---

## PERFORMANCE

### Frontend

#### 1. Never load unused fonts
`client/index.html` loads exactly three families: **DM Sans** (body) · **Outfit** (`font-display`) · **Sora** (Smile Deals only). Do not add a new `<link>` — consolidate into the existing one if a new family is genuinely needed.

#### 2. New heavy pages must be lazy-loaded
```tsx
// WRONG — loaded in the initial bundle even if user never visits
import NewAdminPanel from "@/pages/NewAdminPanel";

// CORRECT
const NewAdminPanel = lazy(() => import("@/pages/NewAdminPanel"));
```
Already lazy: `ClinicDashboard` · `DoctorDashboard` · `Admin` · `Book` · `SmileDeals`.
Already eager (acceptable — small, shown early): `Landing` · `ClinicLogin` · `ConsentForm`.

#### 3. Gate queries on active panel / auth state
```tsx
// WRONG — fires on every page load, even unauthenticated
const { data } = useQuery({ queryKey: ['/api/auth/clinic/bookings'] });

// CORRECT
const { data } = useQuery({
  queryKey: ['/api/auth/clinic/bookings'],
  enabled: isAuthenticated && activePanel === 'bookings',
});
```
Every new `useQuery` in a dashboard panel must have an `enabled:` guard — at minimum `isAuthenticated`, preferably also `activePanel === 'panelName'`.

#### 4. No speculative memoization
`useMemo`, `useCallback`, `React.memo` add complexity and stale-closure risk. Add only when: a computation is measurably slow (sorting/filtering 500+ records) · a callback is passed to a `React.memo`-wrapped child where identity matters · visible re-render on every keystroke due to parent state change. Add a comment explaining why.

#### 5. New images: WebP + lazy-load
```tsx
<img src={heroImg} alt="Hero" loading="lazy" className="..." />
```
Convert to WebP before committing. Use `loading="lazy"` unless above the fold on the landing page.

#### 6. New panel components must pass the import audit
```bash
python3 script/audit-panel-imports.py
# Add the new panel path to PANELS list first
# All panels must report ✅ OK
```
This catches `ReferenceError: X is not defined` production crashes that Vite's dev server hides.

### Backend performance
See `docs/design-document/development-document/backend-and-db-checklist.md` for: rate limiters on public endpoints · DB indexes on new tables · unbounded query prevention · Render production SQL requirements.

### Performance checklist (frontend)
```
[ ] No new font family in index.html unless actively used
[ ] New page-level components use React.lazy() in App.tsx
[ ] Every new useQuery has an enabled: guard
[ ] No speculative useMemo/useCallback without documented reason
[ ] New images are WebP + loading="lazy"
[ ] Panel import audit passes: python3 script/audit-panel-imports.py
```

---

## PLACEHOLDER CONVENTIONS

### Visual style
All `<Input>` / `<Textarea>`: `placeholder:text-muted-foreground/60 placeholder:italic`. A global rule in `index.css` covers raw `<input>`/`<textarea>`. **Never** override with higher opacity or remove italic.

### Content rules

**Rule 1 — Never use a placeholder as the only label.** If no `<Label>` is visible above the field, use the `"e.g. "` prefix:

| Wrong | Right |
|---|---|
| `placeholder="Clinic Name"` | `placeholder="e.g. Bright Smiles Dental"` |
| `placeholder="Doctor email"` | `placeholder="e.g. doctor@clinic.com"` |

**Rule 2 — No Western names. Use Indian examples with `"e.g. "` prefix.**

| Wrong | Right |
|---|---|
| `placeholder="John Doe"` | `placeholder="e.g. Rahul Verma"` |
| `placeholder="Dr. John Smith"` | `placeholder="e.g. Dr. Ananya Krishnan"` |

**Rule 3 — No imperative / label-style instructions.**

| Wrong | Right |
|---|---|
| `placeholder="Enter reason…"` | `placeholder="e.g. Patient requested cancellation"` |
| `placeholder="Minimum 8 characters"` | `placeholder="Min. 8 characters"` |

**Rule 4 — Phone numbers must use Indian format:** `+91 98765 43210`

**Rule 5 — Format-shaped hints need no `"e.g. "` prefix:** `placeholder="••••••••"` · `placeholder="+91 98765 43210"` (with label) · `placeholder="https://..."`

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

## MASTER SUBMISSION CHECKLIST

Before marking any screen or component done:

### Layout & Responsiveness
- [ ] Desktop correct at 1280 px; mobile works at 375 px — no horizontal scroll
- [ ] All tap targets `min-h-[44px]`; icon-only buttons `h-11 w-11`
- [ ] No hardcoded hex/hsl — CSS vars and Tailwind semantic classes only
- [ ] Dark mode tested — every element readable and correctly coloured
- [ ] Date/time pickers use `grid grid-cols-2` on mobile, not stacked full-width

### Data States
- [ ] Loading, empty, and error states exist for every `useQuery` section
- [ ] Empty state inside tables uses `<tr><td colSpan={N}>` pattern

### Forms & Inputs
- [ ] Correct form pattern chosen from the Form Architecture table
- [ ] "Add" button is in the panel header, not an accordion at the bottom
- [ ] "Add" form appears **above** the existing list
- [ ] Input heights: `h-7` inline · `h-9` compact grid · `h-10` modal — no mixing
- [ ] Max 3 fields/row desktop; max 2 on `sm:`
- [ ] Long fields `col-span-full`
- [ ] All inputs: correct `type` + `onFocus` scroll-into-view
- [ ] Inline rows: Enter = save, Escape = cancel `onKeyDown` handlers
- [ ] Toggle button (Add ↔ Cancel) changes icon and style when active

### Tables
- [ ] Numbers/prices right-aligned; names/labels left-aligned
- [ ] Row actions `opacity-0 group-hover:opacity-100` — never always visible
- [ ] Max 2 icon actions in hover zone; 3+ use `DropdownMenu`
- [ ] Delete/destructive actions wrapped in `AlertDialog`

### Save Buttons & CTAs
- [ ] Settings/profile save in footer bar (`border-t bg-muted/20 px-4 py-3`)
- [ ] Modal save in `DialogFooter` — Cancel left, primary right
- [ ] No `hover:`-only states without matching `active:`

### Typography & Placeholders
- [ ] No font size below `text-xs` (except bottom-nav label and compact grid ALL-CAPS label)
- [ ] All placeholders: italic, `"e.g. "` prefix when no label above, Indian names/formats
- [ ] No placeholder used as the sole label

### Architecture
- [ ] No `backdrop-filter` on structural/functional elements
- [ ] No `position: fixed` inside a scroll container
- [ ] No `any` type without explanatory comment
- [ ] No nested ternaries deeper than one level
- [ ] Complex boolean expressions extracted to named `const isXxx`
- [ ] New shared types/constants imported from canonical files — never redefined locally
- [ ] Every new `useQuery` has an `enabled:` guard
