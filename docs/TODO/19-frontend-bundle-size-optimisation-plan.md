# Frontend bundle-size optimisation plan

**Status:** Proposed — documentation only; no application code changes made  
**Date:** September 20, 2026  
**Scope:** React/Vite frontend loading speed, JavaScript bundle size, route-level loading, and dashboard feature loading  
**Related backlog item:** [06-prioritized-todo.md — P2-3 Reduce large authenticated bundles](./06-prioritized-todo.md)

## 1. Why this document exists

The production build succeeds, but Vite reports that several JavaScript chunks are
large after minification. This is not currently a deployment failure. It is a
performance warning that tells us the browser is receiving and processing more
code than necessary for the page the user is viewing.

This document explains:

- What the warning means in everyday language.
- The current bundle sizes observed in this repository.
- The actual root causes in the current import structure and Vite configuration.
- Which parts affect a public visitor, clinic staff member, doctor, or super admin.
- Which optimisations are safe first steps and which need more careful design.
- A set of independently executable implementation steps.
- Validation, acceptance criteria, risks, and rollback guidance for every step.

The recommended work is intentionally split into small pieces. Route splitting,
panel splitting, heavy-library loading, and chunk-policy changes should not be
combined into one large change because a single regression would be difficult to
locate and undo.

## 2. Plain-language explanation

Think of the frontend as a toolbox.

The application currently sends a large toolbox to the browser, even when the
user only needs one tool:

- A public visitor may receive code used by clinic dashboards.
- A clinic user may receive code for pharmacy, analytics, storage, website
  settings, exports, and billing even when they only open bookings.
- A doctor may receive code for X-rays, odontograms, medical history, and other
  tabs before opening any of those tabs.
- The shared vendor file contains third-party libraries used across many
  different parts of the product.

The browser can reuse downloaded files from its cache, so this is not equally
bad on every visit. However, the first visit still pays the cost, and the
browser must still parse and prepare cached JavaScript when it is needed.

The goal is not to remove functionality. The goal is to send each piece of
functionality when it is needed:

1. Load the small application shell first.
2. Load the selected route next.
3. Load an individual dashboard panel when the user opens it.
4. Load expensive libraries only when the feature requiring them is used.

## 3. Current evidence

The baseline was measured with the repository's existing production command:

```bash
npm run build
```

The build completed successfully. The warning is based on the minified,
uncompressed JavaScript size. The compressed size is included below because
that is closer to the network transfer cost.

| Output file | Minified size | Approx. gzip size | What it contains |
|---|---:|---:|---|
| `vendor-*.js` | 2.37 MB | 596 KB | Most third-party packages used anywhere in the frontend |
| `ClinicDashboard-*.js` | 1.75 MB | 213 KB | Clinic dashboard and many statically imported panels |
| `index-*.js` | 1.01 MB | 135 KB | Main application entry and statically imported routes |
| `Admin-*.js` | 770 KB | 98 KB | Admin page and its admin panels |
| `DoctorDashboard-*.js` | 517 KB | 68 KB | Doctor dashboard and its clinical tabs |
| `booking-list-*.js` | 371 KB | 51 KB | Shared booking and appointment-list code |
| `Book-*.js` | 214 KB | 29 KB | Public booking flow |
| `SmileDeals-*.js` | 112 KB | 16 KB | Deals page |
| `icons-*.js` | 42 KB | 12 KB | Shared Lucide icon code |
| Main CSS | 238 KB | 34 KB | Application styles |

The total JavaScript output is roughly 6 MB before compression. A user does not
necessarily download every file on every visit, but the current shared vendor
arrangement makes a large third-party file available to almost every route.

### What the build warning does and does not mean

It does mean:

- Some route or shared files are large enough to slow first use.
- The browser may spend noticeable time parsing and compiling JavaScript.
- Mobile devices and slower networks are more likely to feel the delay.
- A future dependency change could make the problem worse without failing CI.

It does not mean:

- The application is broken.
- Render will reject the deployment.
- Every user downloads every output file.
- The raw size is the exact download size.
- All large code must be deleted.

The correct response is measured loading and splitting, not blindly reducing
functionality or creating many tiny chunks.

## 4. Root causes

### 4.1 One broad vendor rule captures almost every dependency

`vite.config.ts` currently contains a broad rule equivalent to:

```ts
if (id.includes("node_modules/")) {
  return "vendor";
}
```

This places almost all third-party modules in one shared vendor file.

That choice has one benefit: common code can be cached and reused between
routes. Its major cost is that route-specific libraries become part of the same
large shared file. Splitting a library into the vendor file does not make it
free; it only changes where the bytes live.

The current configuration already separates Lucide icons. It also has a rule
intended to separate PDF libraries, but the current build output does not show a
distinct `pdf-*.js` asset. That rule should be verified with a bundle report
before relying on it.

### 4.2 Several routes are still imported eagerly

`client/src/App.tsx` lazy-loads the main Book, Admin, Clinic Dashboard, Deals,
and Doctor Dashboard routes. However, several other pages are imported at the
top level:

- Landing
- Dashboard
- Clinic login
- Clinic public/about page
- Setup password
- Public doctor profile
- Getting started
- Clinic registration
- Consent form
- Pricing
- Activation
- Password reset

Those pages and their dependency graphs contribute to the main `index-*.js`
file. A user visiting the landing page does not need every authenticated,
registration, consent, map, or password-reset module immediately.

### 4.3 ClinicDashboard imports many panels before the active panel is known

`client/src/pages/ClinicDashboard.tsx` imports a broad set of panels, including
bookings, billing, inventory, pharmacy, analytics, exports, storage, website
configuration, messaging, reminders, settings, doctors, patients, and slots.

The user normally sees one active panel at a time, but static imports make the
code for many other panels available in the same route chunk.

The clinic dashboard route is the largest route-specific output at about
1.75 MB minified, or approximately 213 KB gzip.

### 4.4 Admin and Doctor dashboards import all major tabs together

The admin page imports several operations and entitlement panels even when the
user opens only one admin section.

The doctor page imports several clinical tabs and tools, including X-ray,
odontogram, medical history, visit timeline, records, appointment UI, and
notification-related code.

This makes the first dashboard visit pay for less frequently used areas.

### 4.5 Expensive feature libraries are not consistently demand-loaded

The repository uses feature libraries such as:

- Leaflet and React Leaflet for maps.
- Recharts for analytics and chart components.
- jsPDF and jsPDF AutoTable for receipts and documents.
- Framer Motion for animated public surfaces.
- QR code rendering.

Some of these are used only on specific pages or after a user action. They
should be checked for demand loading rather than assumed to be harmless because
they are in a shared vendor chunk.

### 4.6 Large source files make safe splitting harder

Several source files are large, particularly:

- `client/src/components/BookingsPanel.tsx`
- `client/src/pages/DoctorDashboard.tsx`
- `client/src/pages/Admin.tsx`
- `client/src/pages/Book.tsx`
- `client/src/components/BillingHistoryPanel.tsx`
- `client/src/components/InventoryPanel.tsx`

Large source files are not automatically large browser output files, but they
make it harder to identify which code is needed for the first screen and which
code belongs to secondary dialogs, tabs, exports, or actions.

## 5. User impact by role

### Public visitor

The main entry can include more static route code and shared dependencies than
the landing page needs. This can increase:

- Time until the first page becomes interactive.
- Mobile data usage.
- JavaScript parsing and memory usage.
- The cost of opening the site on a slower device.

Public visitors are especially sensitive because they may never visit a clinic,
doctor, or admin route during that session.

### Clinic staff

The clinic dashboard is feature-rich and therefore the most important
authenticated optimisation target. A staff member opening bookings may not need
analytics, pharmacy, storage, website configuration, or entitlement settings
until later.

The current booking notification behavior needs special care. The application
intentionally keeps booking-related UI available in hidden states so a
notification can open a booking dialog over the current panel. Any change that
lazy-loads `BookingsPanel` must preserve that behavior.

### Doctor

The first appointment view should not need every clinical tool. X-ray,
odontogram, timeline, and medical-history code can usually load when their tabs
are selected, provided notification and deep-link flows continue to work.

### Super admin

Admin panels can be loaded as selected. This is a good isolated optimisation
because the admin area already has clear panel boundaries.

### Returning users

Caching reduces repeated network downloads, especially for the shared vendor
file. It does not remove:

- First-visit cost.
- JavaScript parse and execution cost.
- Cache invalidation cost when the vendor hash changes.
- Memory used by code loaded but not yet used.

## 6. Optimisation principles

The implementation should follow these rules:

1. **Measure before and after.** A smaller raw file is not automatically a
   faster page if it creates too many requests or causes duplicate downloads.
2. **Split at real user boundaries.** Routes, dashboard tabs, dialogs, maps,
   charts, and exports are better boundaries than arbitrary file-size cuts.
3. **Keep the first screen fast.** The active screen and its loading state should
   remain usable without waiting for unrelated features.
4. **Preserve deep links.** Notification links and direct URLs must still load
   the correct panel or booking.
5. **Do not hide errors.** Lazy imports need an error boundary or a visible
   retry state; a failed secondary chunk must not silently leave a blank panel.
6. **Avoid excessive chunking.** Ten useful chunks are better than dozens of
   tiny chunks with overhead and complicated caching.
7. **Keep shared code genuinely shared.** Small stable dependencies can remain
   shared. Large feature-specific code should not be forced into the initial
   vendor download.
8. **Preserve external deployment compatibility.** Do not add Replit-only
   packages to production dependencies just to inspect bundles.

## 7. Proposed fixes as independent implementation steps

Each step below is intended to be independently executable. A step should be
implemented, tested, and reviewed as its own change. Steps marked as
parallel-safe can be worked on independently once the baseline measurement is
available.

### Step 0 — Record a repeatable bundle and route baseline

**Type:** Measurement and tooling  
**Parallel status:** Should happen first  
**Application behavior changed:** No

#### Scope

Record the current sizes and the files loaded for the following routes:

- `/`
- `/book`
- `/clinic-dashboard`
- `/doctor-dashboard`
- `/admin`

Use the existing `npm run build` command and a bundle inspection method that
can show which modules contribute to each chunk. The inspection method may be
temporary development tooling and must not become a runtime dependency unless
there is a clear reason.

#### Done looks like

- Raw and gzip sizes are recorded for the main output files.
- The initial request set is recorded for the landing page.
- The first navigation request set is recorded for clinic, doctor, and admin
  dashboards.
- The largest modules or dependency groups in each route are identified.
- The report can be repeated after every later optimisation step.

#### Validation

```bash
npm run build
git diff --check
```

No application behavior should change in this step.

### Step 1 — Lazy-load remaining top-level routes

**Type:** Route loading  
**Parallel status:** Independent after Step 0  
**Primary file:** `client/src/App.tsx`

#### Scope

Convert suitable top-level page imports from normal imports to
`React.lazy(() => import(...))`, while keeping a consistent loading fallback.

Candidates include:

- Dashboard
- ClinicAbout
- DoctorPublicProfile
- RegisterClinic
- ConsentForm
- SetupPassword
- GettingStarted
- Activate
- ResetPassword

Small pages such as `NotFound`, `Pricing`, or `ClinicLogin` can remain static if
measurement shows that keeping them in the main entry is better for the public
navigation experience.

#### Safety requirements

- Direct navigation to every route must still work.
- Browser refresh on every route must still work.
- The fallback must not flash indefinitely on failed imports.
- Public clinic pages must retain their current SEO and content behavior.
- Authentication redirects must happen after the route module loads, not before
  the app has a chance to render its loading state.

#### Done looks like

- The initial `index-*.js` file is smaller.
- Map code is not loaded by routes that do not render a map.
- The landing page still renders correctly.
- All affected route smoke tests pass.

#### Rollback

Revert only the route import changes in `App.tsx`. No data or server changes
are involved.

### Step 2 — Lazy-load Admin panels by selected section

**Type:** Dashboard panel loading  
**Parallel status:** Independent after Step 0  
**Primary file:** `client/src/pages/Admin.tsx`

#### Scope

Replace static imports for lower-frequency admin panels with lazy imports.
Keep the admin shell, navigation, active-section state, and default panel
stable.

Likely candidates:

- Tenant operations
- Clinic monitoring
- Entitlement review
- Plan policies
- Clinic upgrade requests

#### Safety requirements

- Existing tab or section URLs continue to open the same section.
- The selected panel gets a visible loading state.
- A failed panel import shows an actionable error/retry state.
- Admin permissions remain enforced by the existing route and API guards.
- No panel is mounted twice during section changes.

#### Done looks like

- The initial Admin route chunk is smaller than the current 770 KB raw output.
- Opening a secondary admin section loads its code only when selected.
- Switching back to a previously opened section uses the browser/module cache.

#### Rollback

Restore the affected static imports and render branches in `Admin.tsx`.

### Step 3 — Lazy-load Doctor Dashboard clinical tabs

**Type:** Dashboard tab loading  
**Parallel status:** Independent after Step 0  
**Primary file:** `client/src/pages/DoctorDashboard.tsx`

#### Scope

Load specialized doctor features only when the doctor selects the related tab.
Candidates include:

- X-ray analysis
- Odontogram
- Medical history
- Visit timeline
- Clinical records, if it is not part of the first appointment view

The appointment list, notification controls, and first-screen loading state
should remain available immediately.

#### Safety requirements

- Direct tab selection still works.
- Notification links can still open the correct appointment or record.
- The selected tab has a loading state.
- Clinical data requests remain authorized and scoped as before.
- Any browser-only code remains inside the client-loaded module.

#### Done looks like

- The Doctor Dashboard route chunk is smaller than the current 517 KB raw
  output.
- Specialized clinical code is absent from the first doctor-screen request
  when the user does not open those tabs.
- Existing doctor appointment and notification flows pass smoke testing.

#### Rollback

Restore the static tab imports and the original tab render branches.

### Step 4 — Lazy-load low-frequency Clinic Dashboard panels

**Type:** Dashboard panel loading  
**Parallel status:** Independent after Step 0; should follow the panel import audit  
**Primary file:** `client/src/pages/ClinicDashboard.tsx`

#### Scope

Start with panels that are not needed for the first bookings view:

- Clinic storage settings
- Messaging usage
- Reminder digest
- Entitlement settings
- Analytics
- Export data
- Website configuration
- Pharmacy stock
- Inventory
- Consent form
- Manage doctors
- Clinic profile

Keep the initial booking and notification path stable until its deep-link
behavior has been explicitly tested.

#### Important booking constraint

The current application has special booking notification behavior. A hidden
booking panel may remain mounted so a notification can open a booking dialog
even when another clinic panel is active.

Do not lazy-load or unmount `BookingsPanel` without first preserving:

- Notification-to-booking deep links.
- Opening a booking that is outside the current filter.
- Dialog portal and focus behavior.
- Booking refresh and read-state behavior.

#### Safety requirements

- The selected clinic section shows a loading state.
- Existing panel-specific queries run only when their panel is active where
  appropriate.
- Notification navigation still opens the intended booking and tab.
- The existing panel import audit is run after extracting or moving panels.

#### Done looks like

- The clinic route chunk is smaller than the current 1.75 MB raw output.
- Low-frequency settings code is not loaded for a bookings-only session.
- Booking notification behavior remains unchanged.

#### Rollback

Restore only the affected clinic panel imports and render branches.

### Step 5 — Load maps only when a map is displayed

**Type:** Heavy-library loading  
**Parallel status:** Independent after Step 0  
**Likely files:** `ClinicAbout.tsx`, `MapLocationPicker.tsx`,
`clinic-themes/ClinicThemes.tsx`

#### Scope

Review Leaflet and React Leaflet imports. Load map code only when the relevant
map view or map picker is actually rendered.

#### Safety requirements

- The map still displays markers and location controls.
- Map CSS is still available when the map is shown.
- The map does not render during server-side or non-browser evaluation paths.
- A map-loading failure has a visible fallback.
- Public clinic page content remains available even if the map is slow.

#### Done looks like

- Public routes that do not show a map do not request Leaflet code.
- Map-enabled pages still have the same location behavior.
- The vendor or route chunk decreases after the map dependency is deferred.

#### Rollback

Restore the existing static Leaflet imports.

### Step 6 — Load charts only when analytics is opened

**Type:** Heavy-library loading  
**Parallel status:** Independent after Step 0  
**Likely files:** `client/src/components/ui/chart.tsx`,
`ClinicAnalyticsPanel.tsx`, admin analytics surfaces

#### Scope

Review Recharts imports and move chart rendering behind the analytics panel or
chart-specific lazy boundary.

#### Safety requirements

- Analytics data loading and access rules do not change.
- Empty, loading, and error states remain visible.
- Charts remain keyboard and screen-reader usable according to the existing
  component behavior.
- The panel does not fail when chart code is still loading.

#### Done looks like

- Non-analytics pages do not request Recharts code.
- Analytics still renders all existing chart types.
- The shared vendor chunk decreases or the chart code moves to an on-demand
  chunk.

#### Rollback

Restore the static chart imports and original render path.

### Step 7 — Load PDF generation only when a document is requested

**Type:** User-action loading  
**Parallel status:** Independent after Step 0  
**Likely files:** `client/src/lib/clinic-pdf.ts`,
`BookingsPanel.tsx`, billing panels

#### Scope

Review jsPDF and AutoTable imports. Load them only when the user selects a
receipt, consent PDF, invoice, or other document action.

The current Vite configuration has a PDF manual-chunk rule, but no separate
PDF output file was visible in the baseline asset list. The implementation
should first confirm the actual import graph, then use a dynamic import if that
is the correct boundary.

#### Safety requirements

- PDF generation still works for every current document type.
- The download or print button shows progress while the library loads.
- A PDF failure produces a user-visible error.
- Billing data is not changed as part of this performance work.
- No PDF library is imported by the public landing route.

#### Done looks like

- PDF libraries are not part of the initial public or dashboard request set.
- The first PDF action loads the library once.
- Later PDF actions reuse the loaded module.

#### Rollback

Restore the static PDF imports and the previous document action handlers.

### Step 8 — Reassess the vendor chunk policy

**Type:** Build configuration  
**Parallel status:** Should follow Steps 1–7  
**Primary file:** `vite.config.ts`

#### Scope

Compare the current broad `node_modules -> vendor` rule with:

1. Vite/Rollup automatic shared chunking.
2. A small set of intentional groups, such as:
   - Core React/runtime code.
   - Icons.
   - Maps.
   - Charts.
   - PDF generation.
   - Motion.

Do not create a separate chunk for every dependency. The goal is to keep
feature-specific code out of the initial request while retaining useful
browser caching.

#### Safety requirements

- No module is downloaded twice under different chunk names.
- No circular chunk dependency causes a runtime failure.
- Direct route navigation works after a cold cache.
- A cache-busting deployment still loads every route.
- The deployment output remains compatible with Render's static frontend
  serving.

#### Done looks like

- Initial route requests are smaller or more appropriate.
- Shared code remains cached across related routes.
- There are fewer unnecessary feature libraries in the first request set.
- Build output is measured before and after, not judged only by file names.

#### Rollback

Restore the previous `manualChunks` function in `vite.config.ts`.

### Step 9 — Split large source components where it enables loading boundaries

**Type:** Maintainability and future splitting  
**Parallel status:** Optional; after the route/panel plan is agreed  
**Likely files:** `BookingsPanel.tsx`, `DoctorDashboard.tsx`, `Admin.tsx`

#### Scope

Extract cohesive units such as:

- Booking card and booking detail dialog.
- Booking filters and patient search.
- Billing actions.
- Rescheduling dialog.
- Doctor clinical tabs.
- Admin section panels.

Source extraction alone is not a performance fix if every extracted file is
still statically imported into the same route. It becomes a performance fix
only when a real lazy boundary is introduced.

#### Safety requirements

- Each extracted component has explicit imports.
- The panel import audit is run after extraction.
- There are no duplicate exports or accidental free-variable dependencies.
- Booking lifecycle and authorization behavior remain unchanged.

#### Done looks like

- Components have clear ownership and import boundaries.
- Large routes can load lower-frequency features independently.
- Production build catches missing imports before deployment.

#### Rollback

Revert the extraction commit independently from the bundle-policy changes.

## 8. Suggested execution order

The steps can be executed independently, but the safest overall order is:

1. Step 0 — baseline measurement.
2. Step 1 — top-level route lazy loading.
3. Steps 2, 3, and 4 — Admin, Doctor, and Clinic panel loading. These can be
   separate implementation changes.
4. Steps 5, 6, and 7 — maps, charts, and PDF loading. These can be separate
   implementation changes.
5. Step 8 — vendor policy review after the route graph is improved.
6. Step 9 — source extraction where it is needed to support the previous steps.

This order prevents a vendor-policy change from hiding the effect of route and
feature changes.

## 9. Validation plan for every implementation step

Every step that changes application code should run:

```bash
npm run build
git diff --check
```

The Build Check workflow is the release gate. A successful dev server alone is
not enough because production Rollup/Vite output can expose:

- Missing imports.
- Duplicate exports.
- Lazy chunk path mistakes.
- Circular chunk problems.
- Browser-only code being evaluated in the wrong place.

For route and panel changes, also verify:

- Cold-cache direct navigation.
- Hard refresh on the route.
- Back and forward navigation.
- Loading state.
- Failed chunk retry state.
- Authenticated redirect behavior.
- Notification deep links.
- Mobile viewport behavior.

For every bundle change, record:

- Main entry raw and gzip size.
- Route chunk raw and gzip size.
- Initial request count.
- Initial transfer size.
- Time until the first screen is interactive.
- Time until the selected panel is interactive.

## 10. Acceptance criteria for the complete optimisation effort

The work should be considered successful when all of the following are true:

- The application still passes the production Build Check.
- Public pages do not load clinic, doctor, admin, map, chart, or PDF code unless
  required by that page.
- Clinic, doctor, and admin routes load their primary view without loading every
  secondary panel.
- Notification and direct-link behavior remains intact.
- There are visible loading and retry states for deferred modules.
- The initial public JavaScript transfer is measurably smaller.
- Clinic, doctor, and admin route transfer sizes are measurably smaller or
  better aligned with the active feature.
- No dependency is duplicated across chunks without a measured reason.
- The final before/after measurements are recorded in this document or in a
  linked implementation record.

The objective is not an arbitrary number. A smaller file that makes the first
screen slower, duplicates libraries, or breaks a deep link is not an
optimisation.

## 11. Risks and non-goals

### Risks

- Lazy imports can create blank panels if loading and error states are omitted.
- Notification deep links can fail if booking UI is unmounted too aggressively.
- Poor manual chunking can create duplicate dependencies or circular imports.
- Too many small chunks can increase request overhead.
- Moving a map or PDF library can expose browser-only import assumptions.
- A route may appear correct in a warm cache but fail on a cold cache.

### Non-goals

This plan does not propose:

- Removing product features.
- Changing booking, billing, or authorization rules.
- Changing server APIs or database tables.
- Replacing React, Vite, or the current router.
- Adding Replit-only runtime dependencies.
- Optimising backend response size.
- Changing image or video assets, except as a separate measured effort.

## 12. Current recommendation

The first implementation should be Step 1: lazy-load the remaining
top-level routes. It is high value, relatively isolated, and does not require
changing the clinic booking notification behavior.

After that, implement Admin and Doctor panel splitting as separate changes.
Treat ClinicDashboard and BookingsPanel as the most sensitive area because
booking notifications and hidden dialog behavior need explicit regression
testing.