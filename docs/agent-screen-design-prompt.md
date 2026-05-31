# BookMySlot — Agent Prompt for New Screens & Components

Paste this at the start of every new screen or component request.

---

## STACK

React 18 + TypeScript · Vite · Wouter (no nested routes, no `<Outlet>`, no loader functions) · TanStack Query v5 · shadcn/ui + Radix UI · Tailwind CSS · Lucide icons · Node / Express / Drizzle ORM / PostgreSQL.

Fonts: **DM Sans** (body, default everywhere) + **Outfit** (`font-display` class, display headings only — sparingly).
Animations: Tailwind `animate-in`, `slide-in-from-*`, `fade-in` utilities only. No Framer Motion. Max 200 ms. Always respect `prefers-reduced-motion`.

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

### Font Size Floor — No Exceptions
- **Minimum font size in any production UI: `text-xs` (12 px).**
- Never use `text-[10px]`, `text-[9px]`, or any sub-xs arbitrary value — including badge labels, sub-labels inside buttons, and tooltip-style text.
- The **only** permitted exception is the bottom-nav bar label (`text-[10px]`) inside the fixed 60 px tab bar where space is structurally constrained — this is explicitly documented in the bottom-nav pattern.

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

- [ ] Desktop layout looks correct at 1280 px
- [ ] Mobile layout works at 375 px with no horizontal scroll
- [ ] All tap targets are at least 44 px tall
- [ ] No hardcoded hex/hsl colours — CSS vars and Tailwind semantic classes only
- [ ] Loading, empty, and error states exist for every data fetch
- [ ] No `hover:`-only states without an `active:` equivalent
- [ ] Dark mode tested — every element is readable and correctly coloured
- [ ] Inputs have correct `type` attribute and `onFocus` scroll-into-view
- [ ] No `backdrop-filter` on structural/functional elements
- [ ] No `position: fixed` inside a scroll container
- [ ] All placeholder text is italic, visually lighter than real input, never acting as the sole label, uses Indian names/formats, and follows the Placeholder Conventions section below

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
