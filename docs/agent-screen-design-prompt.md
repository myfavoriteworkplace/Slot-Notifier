# BookMySlot — Agent Prompt for New Screens & Components

Paste this at the start of every new screen or component request.

---

## STACK

React 18 + TypeScript · Vite · Wouter (no nested routes, no `<Outlet>`, no loader functions) · TanStack Query v5 · shadcn/ui + Radix UI · Tailwind CSS · Lucide icons · react-icons · Node / Express / Drizzle ORM / PostgreSQL.

Fonts: **DM Sans** (body, default everywhere) + **Outfit** (`font-display` class, display headings only — sparingly).
Animations: Tailwind `animate-in`, `slide-in-from-*`, `fade-in` utilities only. No Framer Motion. Max 200 ms. Always respect `prefers-reduced-motion`.

### Icon Library Convention

Three icon sources — use each for its designated role:

| Source | Import path | Use for |
|--------|-------------|---------|
| **Lucide** | `lucide-react` | All UI chrome: navigation, close/back, search, chevrons, status indicators, action buttons |
| **Line Awesome (LIA)** | `react-icons/lia` | Domain/content icons: dental categories, body parts, medical conditions, smiley/health/child/bone icons |
| **Material Design (MD)** | `react-icons/md` | Fallback where LIA has no match: warnings, build/repair, swap, remove, medical services |

**Never** use emoji strings (`cat.emoji`, `"🦷"`) as icons in production components — always use a React icon component. Size all icons consistently: `h-4 w-4` for inline content icons, `h-3.5 w-3.5` for compact UI chrome, `h-5 w-5` or larger for standalone decorative icons.

---

## PRIORITY ORDER

1. **Desktop** — the primary surface. Design for a 1280 px canvas first. Every layout, spacing, and typographic decision starts here.
2. **Mobile** — must work perfectly on 375 px screens without a separate design. Use responsive Tailwind breakpoints (`sm:`, `lg:`) to adapt the desktop layout downward. No horizontal scroll. No broken overflow.
3. **Future React Native port** — write patterns today that will not need rewriting later. See the RN Parity section below.

---

## LAYOUT

### Desktop (primary)
- Two-column shell: `flex flex-row gap-6`. Sidebar `w-60 shrink-0 sticky top-[70px]`. Main content `flex-1 min-w-0`.
- Section grids: `grid grid-cols-2 lg:grid-cols-3 gap-4` for card lists.
- Page padding: `px-6 py-6`. Max width: `max-w-5xl mx-auto` (use `max-w-7xl` for data-dense dashboards).
- Cards: `rounded-2xl border border-border/50 bg-background shadow-sm`.

### Mobile (responsive adaptation)
- Default stack: `flex flex-col gap-3`. Multi-column only at `sm:` or `lg:` breakpoints.
- Page padding collapses to `px-4`. Drop `max-w` constraints (let it fill the screen).
- **Sidebar**: `hidden lg:flex lg:flex-col` on desktop. On mobile (`lg:hidden`) replace with a **sticky bottom nav bar** — the standard mobile dashboard pattern.
  - Show the 4 most-used panels as labelled icon buttons; overflow panels go behind a "More" button that opens a `Sheet` drawer from the bottom.
  - Add `pb-24` to the page content wrapper so content is never hidden behind the nav bar.
  - Pattern:
  ```jsx
  {/* Add pb-24 lg:pb-0 to the page content wrapper */}
  <div className="... pb-24 lg:pb-0">...</div>

  {/* Bottom nav — mobile only */}
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

  {/* More drawer */}
  <Sheet open={moreDrawerOpen} onOpenChange={setMoreDrawerOpen}>
    <SheetContent side="bottom" className="rounded-t-2xl">
      {/* secondary panel links */}
    </SheetContent>
  </Sheet>
  ```
- No fixed widths on inputs or buttons. Use `w-full` with `sm:w-auto` where needed.
- No element should require horizontal scrolling to reach.

---

## MOBILE PROPORTIONALITY

Apply every rule in this section whenever building or editing any screen that appears on mobile.

### Spacing & Padding
- **Card outer padding:** `p-3 sm:p-5` — never a flat `p-5` across all breakpoints for dashboard cards.
- **Column / section gap:** `space-y-3 sm:space-y-4` — never a flat `space-y-4` inside left/right columns on mobile.
- **Two-column layout gap:** keep `gap-5` on mobile (used as the vertical gap when columns stack) and `lg:gap-6` on desktop.

### Touch Targets — Hard Floor
- Every tappable element (button, toggle, icon button, date picker trigger): `min-h-[44px]`.
- Icon-only buttons (prev/next, close, clear): **`h-11 w-11`** — never `h-10 w-10` (40 px is 4 px below the floor).
- Navigation chevrons inside date or week pickers must also be `h-11 w-11`.

### Date / Time Pickers on Mobile
- **Never** stack FROM and TO date pickers as two full-width rows on mobile — the visual weight is disproportionate.
- Use a **2-column grid on mobile, flex-row on sm+**:
  ```jsx
  <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-row sm:flex-wrap sm:items-end sm:gap-3">
    {/* FROM picker wrapper */}
    {/* TO picker wrapper */}
    {/* conditional badge — must be col-span-2 sm:col-span-1 */}
  </div>
  ```
- Any conditional item (e.g. "N days selected" badge) that follows the pickers in the grid needs `col-span-2 sm:col-span-1` so it spans the full row on mobile but flows inline on sm+.
- Button widths inside the grid cells: `w-full` (fills its half-width cell on mobile) + `sm:min-w-[155px]` (enforces a readable minimum on desktop).

### Font Size Floor
- **Minimum font size in any production UI: `text-xs` (12 px).**
- Never use `text-[10px]`, `text-[9px]`, or any sub-xs arbitrary value — including badge labels, sub-labels inside buttons, and tooltip-style text.
- **Permitted exceptions (two only):**
  1. Bottom-nav bar label (`text-[10px]`) — inside the fixed 60 px tab bar where space is structurally constrained.
  2. Compact grid field labels (`text-[10px] font-semibold uppercase tracking-widest text-muted-foreground`) — the ALL-CAPS label sitting immediately above an `h-9` input in a `lg:grid-cols-3` settings/profile grid. This is the only context where this size is acceptable.

### Text Size Reference for Buttons & Compact Components
| Element | Class |
|---|---|
| Primary/secondary button label | `text-sm` |
| Sub-label inside an action button | `text-xs` |
| Badge / status chip | `text-xs` |
| Card heading | `text-sm font-semibold` |
| ALL-CAPS section label | `text-xs font-semibold uppercase tracking-wide text-muted-foreground` |
| Secondary / meta text | `text-xs text-muted-foreground` |
| Tooltip / help text | `text-xs text-muted-foreground` |

### Narrow Panels (e.g. Day Editor, 288 px right column)
- Multi-column grids inside narrow panels must use `grid-cols-1`, **not** `sm:grid-cols-2`. The panel is already narrow at the `sm` breakpoint when stacked on mobile.
- Prefer `space-y-2.5` or `space-y-3` inside narrow panels; never `space-y-5`.

### Mobile Proportionality Checklist
Before finishing any mobile layout change, verify:
- [ ] Date/time pickers use `grid grid-cols-2` on mobile, not stacked full-width
- [ ] All icon/nav buttons are `h-11 w-11` minimum
- [ ] Card outer padding is `p-3 sm:p-5`, not flat `p-5`
- [ ] Section gap is `space-y-3 sm:space-y-4`, not flat `space-y-4`
- [ ] No `text-[Xpx]` below `text-xs` anywhere (except bottom-nav label)
- [ ] Narrow panels (≤ 288 px) use `grid-cols-1` for any internal multi-column layout
- [ ] Conditional spanning items in a CSS grid have `col-span-2` on mobile

---

## TOUCH & INTERACTION

- Every tappable element (button, link, toggle, icon button): `min-h-[44px]`. Icon-only buttons: add at least `p-2`.
- Every `hover:` state must have a matching `active:` state. Primary buttons: `active:scale-[0.98] transition-transform`.
- Always use `onClick` for core actions. Never use `onMouseEnter` — touch devices have no hover.
- Dropdowns and date pickers: use shadcn `Popover` — touch-compatible out of the box.
- Avoid `:hover`-only visual feedback on anything a user must tap to complete an action.

---

## COLOUR

### Always use CSS variables — never hardcode hex or hsl values inline.

Core tokens: `var(--primary)` · `var(--accent)` · `var(--background)` · `var(--card)` · `var(--muted)` · `var(--border)` · `var(--foreground)` · `var(--muted-foreground)`.

### Green brand palette (Tailwind opacity utilities preferred)
| Role | Value | Usage |
|---|---|---|
| Primary | `#0F9B6E` | Buttons, links, active states |
| Dark green | `#085041` | Header bg, gradient starts |
| Accent | `#1D9E75` | Hover states, gradient ends |
| Light tint | `#E1F5EE` | Panel fills, secondary bg |
| Page bg | `#F8F8F6` | Near-white surface |

Use Tailwind's `bg-primary/10`, `text-primary`, `border-primary/20` etc. rather than arbitrary hex values.

### Semantic status colours (use consistently across all screens)
| Status | Classes |
|---|---|
| Pending / Awaiting | `bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border-amber-300` |
| Confirmed / Upcoming | `bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-200` |
| Cancelled / Declined | `bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border-rose-200` |
| Past / Completed | `bg-slate-50 dark:bg-slate-900/40 text-slate-500 dark:text-slate-400 border-slate-200` |
| Today | `bg-sky-50 dark:bg-sky-950/20 text-sky-600 dark:text-sky-400 border-sky-200` |

Every colour choice must look correct in both **light mode** and **dark mode**. Test by toggling the theme before finishing.

---

## IMAGE & FILE UPLOAD

### Shared component — use for every single-image avatar/logo/photo slot

```tsx
import { ImageUpload } from "@/components/ImageUpload";

<ImageUpload
  currentImage={existingUrl || undefined}   // string | undefined — pre-populates preview
  onImageUploaded={(url) => save(url)}       // called with the R2 key after upload
  folder="clinics"                           // "clinics" | "doctors" | "users"
  fallbackText="Clinic Name"                 // initials derived from first+last word
  allowedTypes={["image/png", "image/jpeg"]} // optional; defaults to all images
  maxSizeKb={500}                            // optional; client-side compression target
/>
```

**What the component provides automatically:**
- Circular `Avatar` with `AvatarFallback` initials (1 word → first letter; 2+ words → first + last initial)
- Hover overlay: camera icon + "Upload" / "Change" label (desktop); tappable on mobile
- Sparkles animation during client-side optimise phase
- Spinner during R2 upload
- ✕ remove button once an image is set (calls `onImageUploaded("")`)
- Uploads via `POST /api/uploads/signed-url` → direct PUT to R2

**When to use `ImageUpload`:**
- Single circular image attached to a record (clinic logo, doctor profile photo, add-doctor avatar)
- Any place that shows initials as a fallback when no image exists

**When NOT to use `ImageUpload`:**
- Rectangular hero/banner images — build a custom zone but follow the same state pattern below
- Multi-file or bulk uploads — hidden `<input type="file" multiple>` with its own handler
- Case media / clinical attachments — use a hidden input triggered by a button

**Required states for any bespoke upload zone (when not using `ImageUpload`):**

| Phase | UI |
|---|---|
| Idle — no file | Dashed border zone, `Upload` icon, helper text |
| Idle — file set | Thumbnail preview, "Change" + "Remove" buttons |
| Optimising | `<Sparkles className="animate-pulse" />` + "Optimising…" label |
| Uploading | `<Loader2 className="animate-spin" />` + "Uploading…" label |
| Error | `<AlertCircle />` + plain-language message + retry button |

**Prop pitfalls — do not get these wrong:**
- `currentImage` not `currentImageUrl`
- `onImageUploaded` not `onUploadComplete` or `onChange`
- `folder` must be one of the exact string literals: `"clinics"` · `"doctors"` · `"users"`
- No `label` prop exists — use a `<Label>` element above the component instead

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

Every section that calls `useQuery` must handle all three states. No exceptions.

```tsx
const { data, isLoading, isError, refetch } = useQuery({ queryKey: [...], ... });

if (isLoading) return <SkeletonLayout />;           // Skeleton shaped like real content
if (isError)   return <ErrorState onRetry={refetch} />;  // Message + retry button
if (!data?.length) return <EmptyState />;           // Icon + human message + CTA
```

- **Loading**: `<Skeleton>` matching the shape of the real content. Never a bare `<Loader2>` spinner for a full section.
- **Empty**: An icon, a human-readable sentence explaining why it's empty, and a primary CTA (e.g., "Create your first slot").
- **Error**: A short plain-language message and a `<Button onClick={refetch}>Try again</Button>`.

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

**Minimum size in any production UI: `text-xs`.** Nothing smaller (`text-[10px]` etc.) except internal badge/chip labels where space is genuinely constrained.

---

## FORMS & MOBILE KEYBOARD SAFETY

- All inputs: `w-full` — never a fixed pixel width.
- Use correct `type` attributes: `type="email"` · `type="tel"` · `type="search"` · `inputMode="numeric"` for number-only fields.
- Add scroll-into-view on all inputs so the iOS keyboard does not cover them:
  ```tsx
  onFocus={(e) => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' })}
  ```
- No critical CTA within 80 px of the bottom edge on mobile.
- Sticky submit button pattern:
  ```tsx
  <div className="sticky bottom-0 pb-[env(safe-area-inset-bottom)] bg-background/95 backdrop-blur-sm pt-3 border-t border-border/40">
    <Button className="w-full">Submit</Button>
  </div>
  ```

---

## FORM ARCHITECTURE — CHOOSE THE RIGHT PATTERN FIRST

Before writing a single `<Input>`, pick the correct pattern from this table. Using the wrong one is the #1 source of wasted real estate.

| Situation | Correct pattern |
|---|---|
| Adding a row to a table (≤ 6 fields, fields map to table columns) | **Inline table row** — inputs appear as the first `<tbody>` row; toggled by an "Add X" button in the panel header |
| Editing an existing table row (≤ 6 fields) | **Inline row edit** — the row's display cells swap to input cells in-place |
| Adding/editing a record with 7+ fields, file uploads, or nested data | **Dialog / Modal** — `Dialog` from shadcn, `w-[95vw] sm:max-w-lg max-h-[85vh] overflow-y-auto` |
| Settings, profile, configuration (not table-adjacent) | **Compact grid inside card** — `grid grid-cols-2 lg:grid-cols-3 gap-3` with `space-y-1` label+input stacks |
| Multi-step flow or destructive action with lasting consequence | **Full-page step or `Sheet` drawer from bottom** |
| **NEVER use** | An expand-panel / accordion that pushes content down below a list — this is the worst pattern for real estate |

### Inline table row — standard implementation

```tsx
// "Add X" button in panel header toggles showAddRow
// When true, render this as the FIRST row in <tbody>:
<tr className="bg-[accent]/5 border-b border-[accent]/20">
  <td className="px-3 py-2">
    <Input autoFocus value={form.field} onChange={...}
      onKeyDown={e => e.key === 'Enter' && handleSave()}
      placeholder="e.g. Value" className="h-7 text-xs px-2" />
  </td>
  {/* one <td> per column */}
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

**Rules:**
- `autoFocus` on the first input
- **Enter** = save · **Escape** = cancel (always add both `onKeyDown` handlers)
- While a row is in edit mode, all other rows remain read-only — no nested concurrent edits
- The toggle button in the header swaps: `Plus + "Add X"` → `X + "Cancel"` with muted style when active

### Inline row edit — standard implementation

```tsx
// editingId state tracks which row is being edited
// In the row map:
if (editingId === item.id) {
  return <tr className="bg-[accent]/5 ...">
    {/* input cells — same structure as add row */}
  </tr>;
}
// Otherwise render the normal display row
```

---

## FORM FIELD DENSITY

| Context | Label style | Input height | Max cols per row |
|---|---|---|---|
| Inline table row | No labels — `placeholder` only (use `"e.g. "` prefix) | `h-7` | Match table column count |
| Modal form (standard) | `<Label>` above, `text-xs font-semibold uppercase tracking-wide text-muted-foreground` | `h-10` (shadcn default) | 2 on `sm:`, 1 on mobile |
| Settings / profile compact grid | `text-[10px] font-semibold uppercase tracking-widest text-muted-foreground` + `space-y-1` | `h-9` | 3 on `lg:`, 2 on `sm:`, 1 mobile |
| Search / filter bar | No label — placeholder with search icon | `h-8` | Inline flex row |

**Standardised input heights (use only these three values):**
- `h-7` — inline table row cells only
- `h-9` — compact settings/profile grids
- `h-10` — modals and standard forms (shadcn default)

**Column grouping rules:**
- Max **3 fields per grid row** on desktop (`lg:grid-cols-3`). Never 4+.
- Max **2 fields per row** on `sm:` breakpoint.
- Group related fields in the **same row**: Phone + Email · City + Pincode · Start Date + End Date.
- Long fields (Address, Description, Notes) always `col-span-full` or `sm:col-span-2`.
- File/image upload always gets its **own full-width row** — never shares a grid cell.
- Primary practitioner / lead doctor field: treat as a regular text field, place in the same grid as other profile fields.

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
        <th className="px-3 py-2.5" /> {/* actions column — no heading */}
      </tr>
    </thead>
    <tbody className="divide-y divide-border/30">
      {rows}
    </tbody>
  </table>
</div>
```

### Column alignment — non-negotiable

| Column type | Alignment | `<th>` + `<td>` class |
|---|---|---|
| Names, labels, descriptions, status text | Left | `text-left` |
| Numbers (price ₹, qty, count, %) | Right | `text-right` |
| Dates | Left | `text-left` |
| Badges / chips | Left or centre | `text-left` |
| Actions column | No heading | `<th />` — empty; cells use `justify-end` flex |

### Row action visibility

- Row actions (Edit, Delete, View) are **always hidden by default** and revealed on hover:
  ```tsx
  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
  ```
- The `<tr>` must have `className="group ..."` for this to work.
- **Max 2 icon actions** in the hover zone. If you need 3+, use a `DropdownMenu` triggered by a `MoreHorizontal` icon.
- **Delete** is always wrapped in `<AlertDialog>` — never a bare `onClick` that destroys data immediately.

### Empty state inside table

```tsx
{data.length === 0 && (
  <tr>
    <td colSpan={columnCount}>
      <div className="py-12 text-center">
        <div className="p-3 bg-muted/40 rounded-full w-fit mx-auto mb-3">
          <Icon className="h-6 w-6 text-muted-foreground/40" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">Nothing here yet</p>
        <p className="text-xs text-muted-foreground/60 mt-1">Hint or CTA sentence.</p>
      </div>
    </td>
  </tr>
)}
```

### Font size by table context

| Dashboard context | Cell font size |
|---|---|
| Clinic / Doctor dashboard tables | `text-xs` — high density, small cells |
| Admin panel tables | `text-sm` — wider rows, less density |
| Never | `text-base` or larger in table cells |

---

## SPACE EFFICIENCY DOCTRINE

> **Rule: Never let a form consume vertical real estate that a table row or compact grid can handle.**

Apply this mental checklist before building any data-entry UI:

1. **Can it be an inline row?**
   If the data maps directly to an existing table's columns → use an inline table row, not a separate expand-panel below the header.

2. **Can 2–3 fields share one row?**
   Phone + Email + Website → one grid row. Never three stacked full-width rows.

3. **Does this section need a `<Separator />`?**
   Use it only at a genuine category boundary (e.g. Contact info → Map location). Never between fields of the same logical group, and never between a form body and its save button.

4. **Does the save button need its own section?**
   Move it to a **footer bar** at the bottom of the card:
   ```tsx
   <div className="px-4 py-3 border-t border-border/40 bg-muted/20 flex items-center justify-end gap-2">
     <Button ...>Save</Button>
   </div>
   ```
   Never float a save button in the middle of a content card.

5. **Does the "Add New" trigger need its own panel section?**
   No. Place the "Add" button in the **panel header** (right side of the gradient row). Never create an accordion/toggle at the bottom of a list just to show an add form.

6. **Is the "Add" form an accordion below the list?**
   Move the add-form (or inline row) to **above** the list, immediately after the panel header. Users must see the add form before they scroll through all existing items.

7. **Are there `space-y-6` or larger gaps between fields?**
   Replace with `space-y-3` or `space-y-4`. `space-y-6` is reserved for separating major card sections, not individual fields.

---

## BUTTON / CTA PLACEMENT

| Context | Correct placement |
|---|---|
| Table / inline add row | End of the inline row — `justify-end` flex in the actions cell |
| Modal / Dialog | `DialogFooter` — Cancel on left, primary action on right |
| Settings / profile card | **Footer bar** pinned to bottom of card: `border-t border-border/40 bg-muted/20 px-4 py-3 flex justify-end` |
| Panel header action (Add, Export, Filter toggle) | Right side of the panel header gradient row (`justify-between` + `shrink-0` button) — never below the header |
| Mobile / full-screen long form | `sticky bottom-0 pb-[env(safe-area-inset-bottom)] bg-background/95 backdrop-blur-sm border-t border-border/40` |

### Toggle button (Add ↔ Cancel) standard

When an "Add" button controls the visibility of an inline add row or form, it must visually change state:

```tsx
<Button
  size="sm"
  onClick={() => setShowAddRow(v => !v)}
  className={showAddRow
    ? "bg-muted text-foreground hover:bg-muted/80 border-0"   // Cancel state — muted
    : "bg-[accent] text-white hover:bg-[accent]/90 border-0"   // Add state — accent colour
  }
>
  {showAddRow ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
  {showAddRow ? "Cancel" : "Add X"}
</Button>
```

### Destructive button rules

- Always `variant="destructive"` or explicit `bg-destructive text-destructive-foreground`
- Always requires an `AlertDialog` confirmation — no single-click deletes
- Never place a destructive button as the primary/default action — it must require an extra step

---

## SECTION DIVIDERS & VISUAL WEIGHT

| Divider type | When to use |
|---|---|
| `<Separator />` | Genuine category change within a card. Max **2 separators per card**. Never between fields of the same group. |
| `border-b border-border/40` | Between card header and card body. Between card body and card footer. Standard structural boundary. |
| `space-y-3` or `space-y-4` | Between field groups within the same section. The default. |
| `space-y-6` | Only between major sub-sections inside a large card (e.g. Contact block vs. Address block). |
| **Never** | `space-y-8` or larger inside any form or panel body. |

### Sub-section header (inside a card, below the main panel header)

When a card body needs a labelled sub-section, use a minimal pill label — not a full section-header row:

```tsx
<p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
  Section Label
</p>
```

Only promote to the full icon + heading treatment (the `h-6 w-6` rounded icon box with text) when the sub-section is large enough to need a visual anchor (≥ 4 fields, or a complex widget like a map).

---

## REACT NATIVE PARITY

Write these patterns correctly now so the port requires minimal rewriting.

| Avoid | Use instead |
|---|---|
| `backdrop-filter` / `backdrop-blur` on functional elements | Decorative overlays only |
| `position: fixed` inside scroll containers | `absolute`, or use `Sheet` / `Dialog` |
| CSS `box-shadow` via arbitrary values | Tailwind `shadow-*` or `ring-*` (maps to RN `elevation`) |
| CSS transitions on layout properties (width, height, padding) | Transition only `opacity` and `transform` |
| `::before` / `::after` for real layout content | Real DOM elements |
| `onMouseEnter` for core actions | `onClick` always |
| Complex CSS Grid layouts | `flex flex-wrap` for RN-portable grids |
| Sidebar as a persistent fixed panel | Isolate sidebar state so it can become a native `TabBar` |
| Animation logic mixed into render | Isolate in a `useEntryAnimation()` hook for future Reanimated swap |

Simple `grid-cols-2` / `grid-cols-3` grids for card layouts are fine — the concern is complex CSS-only grid systems that have no RN equivalent.

---

## DASHBOARD PANEL HEADER — MANDATORY PATTERN

Every panel in the **Clinic Dashboard** and **Doctor Dashboard** must begin with this card-stripe header. No exceptions. Never use a plain `<div>` heading, a bare `<h2>`, or any other ad-hoc header style inside these dashboards.

### Structure (copy this exactly)

```tsx
<div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
  <div className="flex">
    {/* Coloured left accent bar — matches the panel's accent colour */}
    <div className="w-1.5 bg-[colour]/60 shrink-0" />
    {/* Gradient row — use justify-between when action buttons are present */}
    <div className="flex-1 px-5 py-4 bg-gradient-to-r from-[colour]/[0.06] to-transparent flex items-center gap-3">
      {/* Icon box */}
      <div className="h-9 w-9 rounded-xl bg-[colour]/10 border border-[colour]/20 flex items-center justify-center shrink-0">
        <Icon className="h-[18px] w-[18px] text-[colour] dark:text-[colour]" />
      </div>
      {/* Title + subtitle */}
      <div>
        <h2 className="text-base font-semibold tracking-tight">Panel Title</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Static description — never dynamic counts here.</p>
      </div>
    </div>
  </div>
</div>
```

### When the panel has action buttons (Add, Export, Toggle)

Add `justify-between` to the gradient row and wrap the title+icon in a `flex items-center gap-3` inner div. Place the button(s) on the right side of the same row — never below the header card:

```tsx
<div className="flex-1 px-5 py-4 bg-gradient-to-r from-[colour]/[0.06] to-transparent flex items-center justify-between gap-3">
  <div className="flex items-center gap-3">
    {/* icon box + title/subtitle as above */}
  </div>
  <Button className="shrink-0">Action</Button>
</div>
```

### Accent colour reference — do NOT deviate from this table

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

1. **Title font**: always `text-base font-semibold tracking-tight` — never `text-xl` or `text-2xl`.
2. **Subtitle**: always a static, plain-English description of what the panel does. Never dynamic counts (e.g. "3 patients") — those belong in stat cards below.
3. **Icon size**: always `h-[18px] w-[18px]` inside a `h-9 w-9 rounded-xl` box.
4. **No new accent colours**: pick from the table above. Adding a new panel means picking the closest unused colour and adding a row to the table.
5. **New panels**: add the new panel's row to the correct dashboard table above before writing any code.

---

## QUICK CHECKLIST BEFORE SUBMITTING ANY NEW SCREEN

### Layout & Responsiveness
- [ ] Desktop layout correct at 1280 px; mobile works at 375 px with no horizontal scroll
- [ ] All tap targets are at least `min-h-[44px]`; icon-only buttons are `h-11 w-11`
- [ ] No hardcoded hex/hsl colours — CSS vars and Tailwind semantic classes only
- [ ] Dark mode tested — every element readable and correctly coloured

### Data States
- [ ] Loading, empty, and error states exist for every `useQuery` section
- [ ] Empty state inside tables uses the `<tr><td colSpan={N}>` pattern (not a separate `<div>` below the table)

### Forms & Inputs
- [ ] Correct form pattern chosen (inline row / modal / compact grid / sheet) — never an expand-panel below a list
- [ ] "Add" button is in the panel header, not an accordion at the bottom of a list
- [ ] "Add" form or inline add row appears **above** the existing list, not below it
- [ ] Input heights: `h-7` inline rows · `h-9` compact grids · `h-10` modals — no mixing
- [ ] Max 3 fields per grid row on desktop; max 2 on `sm:`
- [ ] Long fields (Address, Description) span `col-span-full` or `sm:col-span-2`
- [ ] All inputs have correct `type` attribute and `onFocus` scroll-into-view for mobile keyboard
- [ ] Inline add/edit rows have Enter = save and Escape = cancel `onKeyDown` handlers
- [ ] Toggle button (Add ↔ Cancel) changes icon and goes muted when active

### Tables
- [ ] Numbers and prices are **right-aligned**; names and labels are **left-aligned**
- [ ] Row actions are `opacity-0 group-hover:opacity-100` — never always visible
- [ ] Max 2 icon actions per row hover zone; 3+ actions use `DropdownMenu`
- [ ] Delete/destructive actions are wrapped in `AlertDialog`

### Save Buttons & CTAs
- [ ] Save button in settings/profile card lives in a **footer bar** (`border-t bg-muted/20 px-4 py-3`), not floating mid-content
- [ ] Modal save is in `DialogFooter` — Cancel left, primary right
- [ ] No `hover:`-only states without a matching `active:` equivalent

### Space Efficiency
- [ ] No `<Separator />` between fields of the same group; max 2 separators per card
- [ ] No `space-y-6` or larger between individual fields (use `space-y-3` or `space-y-4`)
- [ ] No floating save button in the middle of a content area

### Typography & Placeholders
- [ ] No font size below `text-xs` except: bottom-nav labels (`text-[10px]`) and compact grid field labels (`text-[10px] uppercase tracking-widest`)
- [ ] All placeholder text is italic and visually lighter than real input
- [ ] No placeholder used as the sole label — either show a `<Label>` above, or use `"e.g. "` prefix
- [ ] Indian names/formats used in all example placeholders (no Western names, no `+1` phone numbers)

### Architecture
- [ ] No `backdrop-filter` on structural/functional elements
- [ ] No `position: fixed` inside a scroll container
- [ ] All placeholder text follows the Placeholder Conventions section below

---

## PLACEHOLDER CONVENTIONS

### Visual Style (enforced globally)
All `<Input>` and `<Textarea>` base components use `placeholder:text-muted-foreground/60 placeholder:italic`.
A global `::placeholder { font-style: italic; opacity: 0.6; }` rule in `index.css` covers raw `<input>`/`<textarea>` elements that bypass shadcn.

**Never** override with higher opacity or remove italic — the distinction from real input is intentional.

### Content Rules

**Rule 1 — Never use a placeholder as the only label.**
If there is no visible `<Label>` above the field, the placeholder must use the `"e.g. "` prefix so it clearly reads as an example, not a label.

| Wrong | Right |
|---|---|
| `placeholder="Clinic Name"` | `placeholder="e.g. Bright Smiles Dental"` |
| `placeholder="Doctor email"` | `placeholder="e.g. doctor@clinic.com"` |
| `placeholder="Amount"` | `placeholder="e.g. 800"` |

**Rule 2 — No Western fake names. Use Indian example names with `"e.g. "` prefix.**

| Wrong | Right |
|---|---|
| `placeholder="John Doe"` | `placeholder="e.g. Rahul Verma"` |
| `placeholder="Dr. John Smith"` | `placeholder="e.g. Dr. Ananya Krishnan"` |
| `placeholder="Jane Smith"` | `placeholder="e.g. Dr. Arun Menon"` |

**Rule 3 — No imperative / label-style instructions.**
Placeholders describe what a value looks like — not what to do.

| Wrong | Right |
|---|---|
| `placeholder="Enter reason…"` | `placeholder="e.g. Patient requested cancellation"` |
| `placeholder="Describe patient issue..."` | `placeholder="e.g. Toothache, sensitivity to cold"` |
| `placeholder="Your current password"` | `placeholder="Current password"` |
| `placeholder="Minimum 8 characters"` | `placeholder="Min. 8 characters"` |
| `placeholder="Repeat new password"` | `placeholder="Re-enter new password"` |

**Rule 4 — Phone numbers must use Indian format.**

| Wrong | Right |
|---|---|
| `placeholder="+1 (555) 000-0000"` | `placeholder="+91 98765 43210"` |

**Rule 5 — Format-shaped hints need no `"e.g. "` prefix** (already clearly non-data):
`placeholder="••••••••"` · `placeholder="+91 98765 43210"` (with label above) · `placeholder="https://..."`

### Approved Placeholder Quick Reference

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
