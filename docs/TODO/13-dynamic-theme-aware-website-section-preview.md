# Dynamic Theme-Aware Clinic Website Section Preview — Implementation Plan

**Status:** Sections 1–19 implemented; Release Group A safety gate implemented;
Release Groups B–E remain separate planned work
**Audience:** Clinic owners, clinic staff, product reviewers, and developers  
**Primary area:** Clinic Admin → Clinic Website  
**Related files:** `client/src/components/WebsiteConfigPanel.tsx`, `client/src/components/clinic-themes/ClinicThemes.tsx`, `client/src/pages/ClinicAbout.tsx`  
**Reference material:** Clinic Website editor screenshots supplied on September 2, 2026

## 1. What this plan is intended to do

The Clinic Website editor currently shows a small visual area above the form
for the selected section. It is meant to help a clinic owner understand what
the section will look like, but it currently looks like a small card
illustration. Several users may therefore mistake it for another form
control, a status card, or a decorative element.

This plan describes how to turn that area into a clear and useful **Live
section preview**. The preview should:

- Be visually prominent enough that users understand its purpose.
- Clearly say that it is a preview of the public clinic website.
- Update while the clinic owner edits the current section.
- Use the selected website theme.
- Look as close as reasonably possible to the corresponding public section.
- Use the same content fallbacks and visibility rules as the public page.
- Explain when a section is hidden, automatic, optional, or not used by the
  selected theme.
- Keep the existing editor, Save Website action, full-screen saved preview,
  permissions, and stored website configuration safe.

The goal is not to create a second page builder. The goal is to make the
existing section preview understandable and trustworthy.

## 2. Important current-state findings

The following facts are the baseline for implementation:

1. The website editor is implemented in
   `client/src/components/WebsiteConfigPanel.tsx`.
2. The editor uses a two-pane structure:
   - A section menu on the left.
   - A preview strip and edit form on the right.
3. The current preview strip is approximately 208 pixels high and is named
   `PreviewPane`.
4. `PreviewPane` contains a separate hand-built rendering branch for each
   section.
5. Those preview branches use compact approximations of the public page
   rather than the actual public theme sections.
6. Many preview branches contain hard-coded colors and layouts. This means a
   preview can look green or white even when the selected public theme is Red
   Clinical.
7. The public theme implementations are in
   `client/src/components/clinic-themes/ClinicThemes.tsx`.
8. The public page is selected in
   `client/src/pages/ClinicAbout.tsx`.
9. The public theme file already contains shared visual pieces, including
   service cards, statistics, galleries, testimonials, doctors, and some
   theme-specific sections.
10. The four public themes are:
    - Classic
    - Warm
    - Modern
    - Red Clinical
11. Some public sections only appear when content exists. Gallery,
    testimonials, and social gallery content are examples of conditional
    sections.
12. Doctors and Footer are generated from other clinic data and are not
    edited as ordinary website content sections.
13. The editor keeps most website values in local React state until the user
    clicks Save Website.
14. The full-screen preview currently represents the saved public website,
    based on the previously agreed behavior. This plan does not change that
    behavior.
15. No database migration is needed for this work. The existing
    `clinics.website_config` JSON configuration remains the source of saved
    website content.

## 3. User experience we want

When a clinic owner selects a section, the right side of the editor should
communicate three things immediately:

1. **What is being previewed?**
2. **Which theme is being used?**
3. **Will the preview change when the user edits the form?**

The preview area should have a clear header similar to:

```text
Live section preview                         Updates as you edit
Why Choose Us · Section 4 of 17              Red Clinical
```

The area below the header should show a larger, scrollable representation of
the selected public section. The preview should show the section’s real
visual character rather than a generic card.

For example, when Red Clinical is selected:

- A stats preview should use the dark/red presentation used by Red Clinical.
- A treatment-group preview should use the red treatment cards.
- A specialty preview should use the Red Clinical typography and spacing.
- A gallery preview should use the dark gallery presentation.

When a section is not rendered by the selected theme, the preview should say
so clearly instead of showing a misleading approximation:

```text
This section is not used by the selected website style.
Choose another style to see how it is presented, or continue editing the
content for styles that support it.
```

## 4. Preview terminology

The editor should use simple, consistent language:

| Term | Meaning |
|---|---|
| **Live section preview** | The selected section as it looks while the user edits it |
| **Updates as you edit** | The preview uses the current unsaved form values |
| **Saved website preview** | The existing full-screen preview showing the saved public page |
| **Hidden until content is added** | The public theme will not show the section yet |
| **Automatic section** | The content comes from Clinic Profile or Manage Doctors |
| **Not used by this style** | The selected public theme does not render this section |

The word “live” in the section preview means “updates immediately in this
editor.” It must not imply that changes have already been published.

## 5. Section-by-section preview behavior

The following table defines what the dynamic preview should show.

| Editor section | Preview behavior |
|---|---|
| Theme | A compact but recognizable hero/navigation snapshot of the selected theme, not only color swatches |
| Hero | The selected theme’s real hero composition using the current tagline, description, and image values |
| About & Values | The selected theme’s About layout using the current story, vision, values, and image fallback |
| Why Choose Us | The public theme’s feature/benefit presentation with the current feature titles and icons |
| Stats Bar | The public theme’s actual stats treatment with current numbers and labels |
| Services | The public theme’s service-card presentation using current names, descriptions, and images |
| Trust & Facilities | The corresponding public trust or benefit section, including the same fallback behavior used by that theme |
| Specialties | The theme-specific specialty section when supported; otherwise an explicit “not used by this style” state |
| Treatment Groups | The theme-specific treatment-group presentation when supported; otherwise an explicit “not used by this style” state |
| Doctors | An automatic preview using the same Manage Doctors data and visual treatment as the public page |
| Photo Gallery | The actual theme gallery treatment when photos exist; otherwise a hidden-state explanation |
| Patient Reviews | The actual theme review cards when reviews exist; otherwise a hidden-state explanation |
| FAQ | The selected theme’s FAQ presentation using the current questions and answers |
| Clinic Hours | The selected theme’s hours layout, including closed-day styling |
| Social Links | The selected theme’s contact/footer social-link treatment |
| Social Gallery | The actual social-gallery treatment when supported and populated; otherwise a hidden or not-used state |
| Footer | An automatic preview using the same clinic profile information as the public footer |

The preview should show the same number of representative items that fit the
available area. It should not invent content that would appear on the public
page.

## 6. What “close to a duplicate” means

The preview does not need to reproduce the entire public page at full page
length. It does need to preserve the parts users rely on to judge the design:

- Theme colors
- Font family and heading style
- Section background
- Section heading and eyebrow label
- Card shape and borders
- Number of columns at the current preview width
- Image treatment
- Button and badge appearance
- Spacing between the main elements
- Empty and fallback states
- Theme-specific visual details such as Red Clinical’s dark/red treatment

The following items do not need to be fully interactive in the editor
preview:

- Navigation links
- Booking buttons
- Carousel movement
- FAQ expansion
- Map dragging
- WhatsApp links
- External social links

These controls may be displayed as disabled or non-navigating visual
elements. Their real behavior remains on the public website and in the
existing full-screen saved preview.

## 7. Recommended technical approach

### 7.1 Build one draft configuration object

Create a single derived website configuration object from the editor’s local
state. It should contain the same shape used by the public theme components,
including:

- Current theme
- Current hero and About values
- Current features and stats
- Current services
- Current trust points and specialties
- Current treatment groups
- Current gallery and testimonials
- Current FAQ entries
- Current hours and social links
- Current social posts
- Current image values

This object is for rendering only. It must not be saved automatically.

The Save Website action should continue to use the existing explicit save
flow.

### 7.2 Reuse public theme building blocks

The preferred approach is to reuse or extract the visual section components
already used by the public themes in `ClinicThemes.tsx`.

Where a section is currently embedded inside a complete theme component,
extract it into a reusable component that can be rendered in both places:

- The public full-page theme.
- The editor’s Live section preview.

The extracted component should accept the same data and theme styling
parameters as the public version. If a compact preview is needed, add a
clearly named preview or density option rather than creating a second
visually unrelated implementation.

### 7.3 Do not render the full public page inside the editor

The full public theme should not simply be rendered inside a clipped iframe or
container for every section. That approach would bring unwanted behavior into
the editor, including:

- Sticky navigation
- Mobile menu state
- Fixed mobile booking bars
- Full-page scroll behavior
- Carousel state
- FAQ state
- Map behavior
- Owner-only display hints

It would also make it difficult to show the current unsaved editor values.

Using shared section components gives a closer visual match with less risk.

### 7.4 Define theme availability explicitly

Add a small theme/section availability mapping so the preview knows whether a
section is:

- Supported and visible.
- Supported only when content exists.
- Automatic.
- Not part of the selected theme.

This mapping should reflect the public theme implementation, not assumptions
made only from the editor menu.

### 7.5 Add a dedicated preview component

Prefer moving the growing preview logic out of the large editor component
into a focused component such as:

```text
client/src/components/website-preview/LiveSectionPreview.tsx
```

Possible supporting files:

```text
client/src/components/website-preview/website-preview-data.ts
client/src/components/website-preview/website-preview-theme.ts
```

The exact filenames may change if the repository’s conventions suggest a
better location.

The component should receive:

- The active section.
- The current draft configuration.
- The clinic profile data.
- The selected theme.
- The section’s status and availability.

## 8. Preview layout and sizing

The current preview strip is too short to communicate its purpose. The new
preview area should:

- Be visibly larger than the current compact strip.
- Have an explicit Live section preview header.
- Use a responsive minimum height rather than a single fixed height.
- Allow the preview content to scroll internally when necessary.
- Keep the form below it usable without making the entire page unwieldy.
- Avoid horizontal overflow on narrow screens.

A practical starting point is:

- Desktop: approximately 320–440 pixels tall depending on the available pane
  height.
- Mobile: a shorter but still prominent preview, approximately 260–360 pixels
  tall, with internal scrolling.

These values should be verified in the running application rather than
treated as final design tokens.

The preview should use the available right-pane width. It should not be
scaled so aggressively that headings and content become unreadable.

## 9. Draft content and saved content rules

There are two different preview experiences and they must remain clear:

### Live section preview

- Uses the current local editor values.
- Updates when the user changes a field.
- Does not publish or save anything.
- Shows a small “Updates as you edit” label.

### Full-screen Preview button

- Continues to show the saved public configuration, as previously agreed.
- Keeps its current reload, close, and open-in-new-tab controls.
- Shows “Saved version” so users understand why it may differ from the
  unsaved section preview.

If the user has unsaved changes, the editor should not silently replace the
saved full-screen preview with draft content unless that behavior is
separately approved.

## 10. Empty, fallback, and automatic states

The preview must follow the public page’s real rules.

### Empty optional sections

When an optional section has no usable content, show:

```text
This section is currently hidden
Add content below to show it on your public page.
```

The message should identify the relevant action where possible, such as
“Upload photos below.”

### Theme fallback content

When the public theme uses fallback content, the preview should use the same
fallback. It should not show a blank editor-only state when the public page
will show default content.

### Automatic sections

For Doctors and Footer, explain the source of the content:

```text
Automatically built from Manage Doctors
```

or:

```text
Automatically built from your Clinic Profile
```

### Unsupported sections

When the selected theme does not render a section, show a calm explanatory
state instead of an empty or misleading mockup.

## 11. Visual consistency requirements

The new preview must follow the existing clinic dashboard design language:

- Use the existing border radius scale.
- Use the existing muted surfaces and primary accent.
- Keep the preview header visually distinct from the public theme content.
- Use the selected public theme inside the preview stage.
- Avoid adding heavy shadows solely to make the preview prominent.
- Keep the green/amber/grey status meanings consistent with the section menu.
- Preserve Georgia, Space Grotesk, and other theme-specific typography where
  the public theme uses them.
- Avoid applying editor typography rules to the public theme preview.

The preview’s outer frame may be neutral, but the content inside it should
look like the selected public website.

## 12. Accessibility requirements

The implementation must:

- Use a real heading for “Live section preview.”
- Provide a useful accessible label for the preview region.
- Ensure the current section and selected theme are understandable without
  relying only on color.
- Preserve keyboard access to the section menu and editor controls.
- Ensure disabled preview controls are not misleadingly interactive.
- Provide meaningful alt text for content images.
- Use empty alt text for decorative images.
- Maintain readable text contrast in all four themes.
- Avoid hover-only explanations.
- Ensure internal preview scrolling is keyboard accessible.
- Announce important hidden/not-used states through normal readable text.

## 13. Performance and safety requirements

- Do not add a new dependency solely for the preview.
- Do not add a database table or migration.
- Do not send a save request when the preview updates.
- Avoid duplicating large arrays or expensive image processing on every keystroke.
- Use stable keys for repeated preview cards.
- Keep uploaded image URLs on the existing upload path.
- Do not expose private image data beyond the same access rules already used by
  the editor and public page.
- Preserve all existing `data-testid` values unless a replacement is
  deliberately added for new preview behavior.

## 14. Recommended implementation order

### Step 0 — Protect the current baseline

Before application changes:

1. Confirm the current public output for Classic, Warm, Modern, and Red
   Clinical.
2. Confirm the current editor save flow and full-screen saved preview.
3. Record the current `PreviewPane` section list and existing test IDs.
4. Run the current Build Check.

### Step 1 — Document public section ownership

Create a small reference map showing:

- Which public component renders each section.
- Which themes use that component.
- Which sections are conditional.
- Which sections are automatic.
- Which fallback content is used.

This map should be derived from `ClinicThemes.tsx` and
`ClinicAbout.tsx`.

### Step 2 — Create the draft configuration adapter

Build the current draft configuration from the editor state. Confirm that
changing a field changes the derived draft value without calling the save API.

### Step 3 — Extract shared theme sections

Extract only the components needed by the editor preview. Keep the public
theme output unchanged while making the components reusable.

### Step 4 — Create the theme-aware preview component

Implement the new Live section preview header, theme label, availability
states, and section renderer.

### Step 5 — Replace the current compact PreviewPane

Replace the hand-built approximation branches with the new preview component.
Keep the current section selection and edit form behavior intact.

### Step 6 — Tune responsive layout

Verify:

- Desktop two-pane layout.
- Tablet widths.
- Mobile horizontal section tabs.
- Long text and long section names.
- Sections with images.
- Empty sections.
- Dark and light theme combinations.

### Step 7 — Verify saved versus draft preview wording

Confirm that:

- Live section preview changes before Save Website.
- Full-screen Preview still represents the saved version.
- The two labels make the distinction understandable.

### Step 8 — Run full verification

Run:

- `git diff --check`
- `npm run build`
- The configured Build Check workflow
- The application workflow
- Authenticated visual review at desktop and mobile widths

## 15. Acceptance checklist

### User understanding

- [ ] The preview area is clearly titled “Live section preview.”
- [ ] The preview states that it updates while the user edits.
- [ ] The selected theme is visible in the preview header.
- [ ] A non-technical clinic user can tell the preview apart from the form.

### Theme accuracy

- [ ] Classic previews use Classic styling.
- [ ] Warm previews use Warm styling.
- [ ] Modern previews use Modern styling.
- [ ] Red Clinical previews use Red Clinical styling.
- [ ] Theme typography is preserved.
- [ ] Theme-specific backgrounds, cards, spacing, and headings are
      recognizable.

### Section accuracy

- [ ] Hero preview reflects the current hero fields.
- [ ] About preview reflects the current story and values.
- [ ] Why Choose Us preview reflects the current feature cards.
- [ ] Stats preview reflects current values and labels.
- [ ] Services preview reflects current service content.
- [ ] Trust, specialties, and treatment previews follow each theme’s actual
      availability.
- [ ] Doctors preview uses Manage Doctors data.
- [ ] Gallery and social gallery previews follow their real visibility rules.
- [ ] Reviews preview follows its real visibility rules.
- [ ] FAQ preview reflects current questions and answers.
- [ ] Hours preview reflects current hours and closed days.
- [ ] Footer and other automatic previews use the correct source data.

### Draft and saved behavior

- [ ] Editing a field updates the section preview without saving.
- [ ] Preview updates do not send a mutation.
- [ ] Save Website behavior remains unchanged.
- [ ] Full-screen Preview continues to show the saved version.
- [ ] The saved-versus-unsaved distinction is visible in the UI.

### Responsive behavior

- [ ] Desktop preview has enough height to be useful.
- [ ] Mobile preview remains readable and scrollable.
- [ ] No horizontal overflow is introduced.
- [ ] The edit form remains accessible after expanding the preview.

### Quality

- [ ] Existing public theme output is unchanged unless an extracted shared
      component is intentionally identical.
- [ ] Existing website configuration data remains compatible.
- [ ] Existing upload behavior remains unchanged.
- [ ] Existing `data-testid` values continue to work.
- [ ] `git diff --check` passes.
- [ ] `npm run build` passes.
- [ ] Build Check passes.
- [ ] Authenticated desktop and mobile visual review is completed.

## 16. Files likely to be involved

### Primary implementation files

- `client/src/components/WebsiteConfigPanel.tsx`
- `client/src/components/clinic-themes/ClinicThemes.tsx`

### Possible new files

- `client/src/components/website-preview/LiveSectionPreview.tsx`
- `client/src/components/website-preview/website-preview-data.ts`
- `client/src/components/website-preview/website-preview-theme.ts`

### Verification context

- `client/src/pages/ClinicAbout.tsx`
- `client/src/pages/ClinicDashboard.tsx`
- `shared/schema.ts` only if a type clarification is necessary

No server route or database change is expected.

## 17. Intentionally out of scope

- A drag-and-drop website builder.
- Reordering sections.
- Editing the public page directly inside an iframe.
- Automatically saving every field change.
- Changing the existing saved full-screen Preview behavior.
- Adding live Instagram, Google Reviews, or other third-party feeds.
- Adding new website content fields unrelated to preview accuracy.
- Rewriting the public themes from scratch.
- Making the editor preview pixel-perfect at every browser width.
- Replacing the public page’s actual responsive behavior with a separate
  editor-only design.

## 18. Risks and mitigations

### Risk: Public theme and editor preview drift apart again

**Mitigation:** Reuse extracted public section components instead of copying
their markup into the editor.

### Risk: Extracting components changes the public website

**Mitigation:** Preserve the current public props and class combinations, then
compare each theme before and after extraction.

### Risk: Full public themes bring unwanted interactions into the editor

**Mitigation:** Render individual shared sections, not the full theme page.

### Risk: Users confuse draft preview with published preview

**Mitigation:** Use explicit labels: “Updates as you edit” for the section
preview and “Saved version” for the full-screen preview.

### Risk: A large preview pushes the form too far down

**Mitigation:** Use a bounded preview area with internal scrolling and verify
long sections on mobile.

### Risk: Unsupported sections look broken

**Mitigation:** Show an intentional “not used by this style” message based on
the public theme availability map.

## 19. Completion notes

Sections 1–19 are implemented. The editor now has a bounded, keyboard-focusable
Live section preview that uses the current unsaved draft configuration and
selected theme without changing the explicit Save Website flow.

### Final component structure

- `client/src/components/website-preview/LiveSectionPreview.tsx` owns the
  preview header, status states, draft rendering, theme tokens, and responsive
  preview-only compositions.
- Shared public sections such as services, doctors, galleries, testimonials,
  and the footer are reused from `ClinicThemes.tsx`.
- Public theme constants and reusable Red Clinical sections are exported from
  `ClinicThemes.tsx` without changing the full-page theme entry points.
- `WebsiteConfigPanel.tsx` derives a filtered, render-only draft configuration
  from local form state and continues to save only through the existing
  explicit mutation.

### Deliberate preview behavior

- The preview uses public fallback content for features, statistics, and
  services when the draft has no complete entries.
- Gallery, testimonials, and Red Clinical social-gallery sections show an
  intentional hidden state until usable content exists.
- Trust & Facilities, Specialties, Treatment Groups, FAQ, and Social Gallery
  explicitly show a not-used state for themes that do not render them.
- Doctors and Footer are selectable automatic previews. They do not become
  editable form sections.
- Full public-page interactions are intentionally not embedded in the editor;
  controls are visual or limited to local preview presentation.

### Verification

- `git diff --check` passes.
- `npm run build` passes.
- The configured Build Check workflow passes.
- The application workflow starts successfully and serves the app.
- The public landing page was visually checked at desktop width. Authenticated
  clinic-editor visual review requires an authenticated clinic session and was
  not available in the preview browser.

### Deferred improvements

- The SEO, public-data allowlist, indexing, metadata, structured-data, and
  server-rendering roadmap beginning at section 20 remains intentionally
  deferred.
- Authenticated desktop/mobile screenshots and browser-level draft-edit
  interaction tests should be added when an authenticated review session is
  available.

## 20. SEO, search visibility, and content safety roadmap

This section records the related SEO and security work requested for the
clinic websites. It is intentionally written in plain language so a clinic
owner or non-technical reviewer can understand what will happen.

This work is related to the website editor, but it is not the same feature as
the Live section preview. The Live section preview helps a clinic owner see
draft changes. The phases below help search engines find, understand, and
safely display the saved public clinic website.

### 20.1 Important expectation about Google rankings

The application can give every clinic a strong SEO foundation, but it cannot
promise that every clinic will appear first on Google.

Google decides local results using several factors, including:

- How closely the page matches what the person searched for.
- How close the clinic is to the person searching.
- How well-known and trusted the clinic is online.
- The quality and usefulness of the clinic’s content.
- The clinic’s real reviews, links, and business information.

Two clinics may target the same city and treatment. Both can be technically
well-built, but Google still has to decide which result best matches each
search. No application can guarantee the first position.

The correct promise is:

> BookMySlot will provide a safe, fast, locally focused, search-friendly
> website for each eligible clinic, and will give clinic owners the tools and
> guidance needed to improve their real local visibility.

### 20.2 Priority overview

The priorities below are ordered by risk and dependency, not only by how
visible the feature is.

| Priority | Work | Why it comes at this priority |
|---|---|---|
| **P0 — Must fix first** | Protect public data and block unsafe content | A privacy or script-injection problem is more serious than a ranking problem |
| **P1 — Search foundation** | Canonical URLs, robots rules, sitemap, page eligibility, and correct 404 behavior | Search engines must be allowed to find the right pages and ignore incomplete ones |
| **P2 — Page SEO** | Unique titles, descriptions, headings, local content, links, and image text | This tells Google and patients what each clinic page is about |
| **P3 — Technical quality** | Server-rendered public content, structured data, image performance, and mobile speed | A page must be understandable and pleasant to use, not merely present |
| **P4 — Local growth** | Google Business Profile, genuine reviews, local links, and clinic guidance | These signals are largely created by the clinic in the real world |
| **P5 — Measurement and improvement** | Search Console, reporting, audits, and ongoing content review | SEO is measured over time; it is not a one-time switch |

P0 and P1 should be completed before intentionally submitting clinic pages for
indexing. P2 and P3 form the first useful SEO release. P4 and P5 continue after
launch.

### 20.3 SEO implementation tracking table

This table is the executable tracker for the SEO and content-safety work below.
It intentionally separates discovery, decisions, implementation, and
verification so each row can be completed and reviewed independently. “Not
started” means no application change has been made for that step. The current
progress reflects the code audit performed while preparing this plan, not a
claim that the feature is implemented.

| ID | Priority / phase | Independent executable step | Concrete deliverable | Dependencies | Primary files / surfaces | Definition of done and verification | Progress |
|---|---|---|---|---|---|---|---|
| SEO-01 | P0 / Phase 0 | Record the public URL and identifier rules. Confirm `/clinic/:slug`, legacy `/about`, `?clinicId=`, numeric IDs, username slugs, and booking URLs. Decide that `/clinic/:slug` is canonical and document redirect/noindex treatment for every duplicate. | A short URL decision record plus a route matrix covering success, duplicate, invalid, archived, and missing clinics. | None; decision required before indexing work. | `client/src/App.tsx`, `client/src/pages/ClinicAbout.tsx`, `server/routes.ts`, this document. | Every public-looking URL has one deliberate outcome: canonical, redirect, noindex, or 404. Reviewer approves the matrix. | **Implemented 2026-09-03 — canonical decision and route matrix recorded in section 20.4.** |
| SEO-02 | P0 / Phase 0 | Inventory all clinic fields returned by the public endpoint and all fields consumed by the four public themes. Classify each field as public, private, optional, derived, or forbidden. | Reviewed public-field matrix with an explicit allowlist and a list of fields that must never cross the public boundary. | SEO-01 can run in parallel, but the final allowlist must agree with the canonical public page. | `shared/schema.ts`, `server/routes.ts`, `client/src/pages/ClinicAbout.tsx`, `client/src/components/clinic-themes/ClinicThemes.tsx`. | Matrix accounts for response fields, nested doctor objects, website configuration, images, map data, and social links. No unclassified field remains. | **Implemented 2026-09-03 — reviewed matrix recorded in section 20.4.** |
| SEO-03 | P0 / Phase 1 | Replace the broad public response with an explicit, tested public DTO/allowlist. Include only patient-facing clinic profile data, approved website content, public doctors, hours, approved images, and intended map data. | A server-side public response mapper and tests proving operational fields are excluded. | SEO-02 approved field matrix. | `server/routes.ts`, `shared/schema.ts`, storage/types, public API tests. | Public API snapshots contain only approved fields; billing, subscription, storage, verification, credentials, archive state, and internal trust data are absent. | **Implemented 2026-09-03 — `toPublicClinic()`/`toPublicClinicListItem()` and `server/public-clinic.test.ts`.** |
| SEO-04 | P0 / Phase 1 | Define and enforce a plain-text content contract for every editable website field. Reject or safely normalize HTML, script tags, event handlers, template expressions, and arbitrary CSS/iframes at the server boundary. | Shared validation rules with field-specific length and content limits plus rejection tests. | SEO-02; should be agreed before editor changes. | Website save schema in `server/routes.ts`, `shared/schema.ts`, editor inputs, validation tests. | The documented XSS payloads are rejected or rendered only as inert text; valid existing website content still saves. | **Implemented 2026-09-03 — strict bounded schemas, control-character rejection, and XSS tests.** |
| SEO-05 | P0 / Phase 1 | Define URL validation by purpose and apply it to website, social, image, phone, email, map, and booking links. Reject `javascript:`, `data:`, `vbscript:`, unsafe redirects, and unapproved image sources. | Reusable purpose-specific URL validators and negative/positive test cases. | SEO-02 and SEO-04. | Website save validation, public URL builders, `ClinicAbout.tsx`, image/link components. | Dangerous schemes never reach rendered `href`, `src`, redirect, or JSON-LD contexts; valid HTTPS, phone, and email values continue working. | **Implemented 2026-09-03 — shared HTTPS/relative URL policy with positive/negative tests.** |
| SEO-06 | P0 / Phase 1 | Audit and harden website image uploads. Check actual file type, extension, size, dimensions, generated object names, content type, and private/public storage boundaries. Explicitly decide whether SVG is rejected or sanitized. | Upload policy, server-side checks, representative file fixtures, and storage-path review. | SEO-02; coordinate with existing R2 storage rules. | Upload routes, storage helpers, `client/src/components/WebsiteConfigPanel.tsx`, R2 configuration. | JPEG/PNG/WebP policy is enforced using file content, oversized or disguised files fail, and approved public images still render. | **Implemented 2026-09-03 — SVG rejected; R2 images verified for signature, size, and dimensions; upload tests added.** |
| SEO-07 | P0 / Phase 1 | Protect the website update action with explicit field allowlisting, request rate limiting, CSRF or strict origin checks, audit logging, and clear owner-facing validation errors. | Threat-reviewed save endpoint with abuse/error tests and an audit event for important website changes. | SEO-03 through SEO-05; existing authentication remains in place. | Website save route in `server/routes.ts`, auth/session middleware, audit logging, editor error handling. | Unauthenticated, cross-origin, over-rate, unknown-field, and invalid-content requests fail safely; valid clinic-owner saves remain functional. | **Implemented 2026-09-03 — owner guard, strict origin, rate limit, strict schemas, audit events, and unknown-field tests.** |
| SEO-08 | P0 / Phase 1 | Add browser safety headers in report-only mode, then review legitimate dependencies before enforcement. Cover CSP, content-type sniffing, referrer policy, permissions policy, HSTS, and frame/embed behavior. | Environment-appropriate header policy, report-only findings log, and an enforcement decision. | SEO-03 through SEO-06; must account for fonts, maps, image storage, and API origins. | Express/server middleware, deployment configuration, public theme dependencies. | Headers appear on public and authenticated responses as intended; report-only violations are understood; no required booking or map flow is silently blocked. | **Implemented 2026-09-03 — report-only CSP and baseline headers added; build and application workflows pass. Enforcement remains a later review.** |
| SEO-09 | P1 / Phase 2 | Implement one shared index-readiness predicate using the approved rule: approved status, valid slug, name, location, contact information, meaningful description or real service content, and a working public page. Decide how missing optional values affect readiness. | Pure readiness function with documented reasons for eligible/ineligible results. | SEO-01 and SEO-02; decision required before sitemap/noindex work. | Server eligibility helper, clinic storage model, public route tests. | The same predicate is used by public metadata, sitemap, and noindex behavior; boundary cases have tests. | **Not started — readiness threshold is documented but not implemented or approved.** |
| SEO-10 | P1 / Phase 2 | Make missing and ineligible clinic pages return deliberate status behavior. Return a real 404 for missing/invalid clinics and a noindex response/page for known but unfinished clinics when appropriate. | Status/response matrix and route behavior for missing, archived, rejected, pending, and incomplete clinics. | SEO-09 and SEO-01. | `server/routes.ts`, `client/src/pages/ClinicAbout.tsx`, router/not-found handling. | `curl` or equivalent checks receive the intended HTTP status and metadata; no missing clinic is presented as a successful indexable page. | **Not started — API currently returns 404 for missing/archived records, but page-level status and ineligible behavior are not complete.** |
| SEO-11 | P1 / Phase 2 | Add a real `/robots.txt` route. Permit eligible public clinic pages, disallow dashboards/authenticated routes and irrelevant query paths, and include the authoritative sitemap URL. | Plain-text robots response with production-safe host handling. | SEO-01 and SEO-09. | Express routes, deployment/public-host configuration. | `GET /robots.txt` returns 200 text beginning with `User-agent:` and contains no accidental private route exposure. | **Not started — route was not found in the current code audit.** |
| SEO-12 | P1 / Phase 2 | Add a dynamic `/sitemap.xml` generated from approved, non-archived, index-ready clinics using canonical URLs. Exclude invalid, duplicate, private, pending, rejected, archived, and incomplete records. | Valid XML sitemap route with deterministic URL and last-modified rules. | SEO-01 and SEO-09; SEO-10 for exclusion semantics. | Express route, storage query, sitemap tests. | XML validates; only eligible canonical clinic URLs appear; empty and database-error behavior is deliberate; no private/dashboard URL appears. | **Not started — route was not found in the current code audit.** |
| SEO-13 | P2 / Phase 3 | Add safe optional `seoTitle` and `seoDescription` fields to the approved website configuration, with bounded validation and useful clinic-specific fallbacks. | Schema/editor fields, validation, save/load behavior, and fallback copy rules. | SEO-04 and SEO-09; requires content policy agreement. | `shared/schema.ts`, website save schema, `WebsiteConfigPanel.tsx`, public metadata builder. | Two clinics with different data receive different metadata; empty SEO fields use safe fallbacks without repeated keyword stuffing. | **Not started — fields are not present in `ClinicWebsiteConfig`.** |
| SEO-14 | P2 / Phase 3 | Generate page title, meta description, canonical link, Open Graph, and Twitter metadata from saved eligible clinic data. Use one clear H1 and logical H2/H3 structure. | Metadata builder and theme-safe head integration for public clinic pages. | SEO-09, SEO-10, and SEO-13. | `ClinicAbout.tsx`, public route/template, metadata utilities, theme components. | Initial/public output contains one unique title, useful description, canonical URL, social metadata, and a clear heading structure for each eligible clinic. | **Not started — current public page is client-fetched and no metadata implementation was found.** |
| SEO-15 | P2 / Phase 3 | Review visible local content, internal links, and image alt text across all four themes. Add only truthful city, area, services, specialties, hours, doctors, booking, contact, and location references. | Theme-by-theme content/heading/link/alt-text checklist and targeted fixes. | SEO-02, SEO-04, SEO-13, and SEO-14. | `ClinicThemes.tsx`, `ClinicAbout.tsx`, website editor labels/help text. | Each theme has useful visible local content, meaningful image alt text, booking/contact/location links, and no hidden or repetitive keywords. | **Not started — current themes exist, but the SEO review has not been performed.** |
| SEO-16 | P3 / Phase 4 | Prototype the safest crawler-visible rendering approach: server-injected public data, a focused server-rendered route, or controlled pre-rendering. Compare complexity, theme drift, hydration, booking, maps, and social previews. | Small prototype and written decision with rollback/compatibility notes. | SEO-03, SEO-09, and SEO-14 provide the content contract and metadata requirements. | `server/routes.ts`, `client/src/pages/ClinicAbout.tsx`, build/deployment setup. | A no-JavaScript request contains clinic name, heading, description, location, key services, public links, metadata, and canonical URL without breaking hydration. | **Not started — current public page fetches data in the browser.** |
| SEO-17 | P3 / Phase 5 | Add safe JSON-LD for eligible pages using only visible, approved clinic data. Choose `MedicalClinic` or an appropriate `LocalBusiness` subtype and omit unsupported claims, hidden content, and invented ratings. | Escaped JSON-LD builder integrated with the public page and fixture tests. | SEO-03, SEO-05, SEO-09, SEO-14, and SEO-16. | Public route/template, structured-data utility, theme data mapping. | JSON-LD parses, matches visible content, contains no private data, and passes structured-data validation for representative clinics. | **Not started — no public JSON-LD implementation was found.** |
| SEO-18 | P3 / Phase 6 | Improve public image and mobile performance. Add responsive dimensions/formats, eager loading for the main hero, lazy loading below the fold, reserved space, tap-friendly controls, and horizontal-overflow checks. | Theme performance pass with measured before/after results and image policy. | SEO-06, SEO-15, and preferably SEO-16. | `ClinicThemes.tsx`, public CSS, image/upload path, performance test fixtures. | Four themes work at mobile widths without horizontal overflow; main content appears quickly; image layout shifts and Core Web Vitals are measured rather than assumed. | **Not started — no SEO performance pass.** |
| SEO-19 | P4 / Phase 7 | Add a clinic-owner local SEO checklist and truthful content guidance. Include Google Business Profile, consistent NAP, hours, real photos, genuine reviews, accurate categories, legitimate local links, and prohibited automation. | In-product checklist or linked guidance with completion state only if persistence is justified. | SEO-13 and SEO-15; copy/legal review. | Clinic website editor/settings, documentation, optional analytics surface. | A clinic owner can follow the checklist without being encouraged to fabricate reviews, backlinks, claims, or keywords. | **Not started — guidance exists only in this TODO document.** |
| SEO-20 | P5 / Phase 8 | Define measurement and reporting for search impressions, clicks, CTR, positions, indexed/excluded pages, sitemap/crawl errors, structured-data errors, Core Web Vitals, and organic booking completion. | Measurement specification, privacy review, event/attribution plan, and owner-facing reporting scope. | SEO-09 through SEO-18; requires analytics/privacy decisions. | Analytics/reporting surfaces, public booking flow, Search Console setup guidance. | The team can distinguish indexed, excluded, and error states and connect organic visits to completed bookings without promising rankings or collecting unnecessary data. | **Not started — no SEO measurement implementation is included in this work.** |
| SEO-21 | Release gates / all phases | Run the release verification for each group: security payload tests, public DTO tests, status checks, robots, sitemap XML validation, metadata snapshots, no-JS checks, structured-data validation, mobile performance, and regression checks for booking/themes. | Repeatable verification checklist attached to Release groups A–E, with evidence and sign-off. | Each release group’s implementation rows; do not skip P0/P1 gates. | Test suite, `docs/TODO/13-dynamic-theme-aware-website-section-preview.md`, Build Check and application workflows. | `git diff --check`, `npm run build`, Build Check, application workflow, automated tests, and required external validators pass before publishing a release group. | **Not started — only the preview feature’s build/workflow checks have been run.** |

#### Current tracking rule

Release Group A is complete, but Release Group B must not begin indexing work
until SEO-09 (the shared readiness predicate) is reviewed and approved. No
indexing, sitemap, metadata, noindex, or structured-data change should be
treated as release-ready based only on a successful build. When a row is
implemented, update only its **Progress** cell with the date, evidence link or
command, and reviewer note.

### 20.4 Release Group A decision record

Release Group A is approved and implemented on **September 3, 2026**. The
decisions below are the boundary for the later indexing work.

#### Canonical URL and route matrix

| Surface | Decision |
|---|---|
| `/clinic/:slug` | Canonical public clinic page. The slug is the clinic username and must be a valid bounded slug. |
| `/about` | Legacy compatibility route. It is not canonical and must be redirected or marked `noindex` when Release Group B adds page-level metadata. |
| `/about?clinicId=<id>` | Legacy compatibility lookup. It must resolve to `/clinic/:slug` or become a deliberate not-found/noindex response; it is never canonical. |
| `/api/clinics/:identifier/public` | Non-indexable data API. It may resolve a username or numeric ID for application compatibility, but it is not a public page URL. |
| `/book/:clinicId` and `/book` | Booking transaction surfaces. They are not clinic landing pages and must not be included in the clinic sitemap. |
| Invalid, missing, archived, rejected, or pending clinic | Not eligible for indexing. The API currently returns 404 for missing/archived/non-approved records; page-level 404/noindex behavior is Release Group B work. |

#### Public-field matrix

The public mapper in `server/public-clinic.ts` is the only response boundary for
the public clinic API.

| Category | Allowed fields |
|---|---|
| Clinic identity | `id`, `username`, `name` |
| Contact and location | `address`, `city`, `pincode`, `email`, `phone`, `website`, `latitude`, `longitude` |
| Public doctor summary | `doctorName`, `doctorSpecialization`, `doctorDegree` |
| Public doctors | `name`, `specialization`, `degree`, `imageUrl`, `bio`, `yearsOfExperience` |
| Public website content | Validated `websiteConfig` only: theme, plain-text sections, approved links/images, hours, services, features, FAQs, testimonials, and display settings |
| Public list response | `id`, `name`, `address`, `username`, `city`, `pincode` only |

The following remain forbidden at the public boundary: passwords and
credentials, registration and verification documents, archive/status flags,
subscription and billing fields, storage quotas, trust scores, internal audit
data, patient/booking data, staff session data, and unreviewed nested object
properties.

#### Release Group A implementation and evidence

- `server/public-clinic.ts` provides explicit public DTO mappers.
- `server/website-security.ts` provides strict schemas, bounded plain-text
  validation, purpose-specific URL validation, upload request validation, and
  valid clinic-slug validation.
- Website/profile saves require a clinic-owner session, trusted request origin,
  rate limiting, strict request bodies, and audit events.
- Authenticated image uploads are folder-scoped and verified after the R2 PUT
  using file signature, byte length, and dimensions. JPEG, PNG, and WebP are
  supported; SVG is rejected.
- Public signed uploads are limited to clinic registration documents and are
  rate limited.
- `server/website-security.test.ts`, `server/public-clinic.test.ts`, and
  `server/signedUrl.service.test.ts` provide focused regression coverage.
- Verification commands: `npm run check`, `npm run test:security`, `git diff
  --check`, `npm run build`, and the configured Build Check workflow.

The CSP is intentionally report-only for this release group. Enforcement
requires reviewing legitimate fonts, maps, image hosts, booking requests, and
other dependencies before it is enabled.

## 21. Detailed phase plan

### Phase 0 — Confirm the baseline and protect existing behavior

**Priority:** P0
**Purpose:** Understand what exists before changing the public website.

#### In common language

Before adding SEO or security controls, we will make a list of the current
public pages, the information each page shows, and the ways clinic owners can
edit that information.

This prevents a well-intended SEO improvement from accidentally hiding a
clinic, changing a public theme, breaking booking, or exposing information
that should remain private.

#### Planned work

1. Review the public clinic URL:

   ```text
   /clinic/:slug
   ```

2. Review the legacy and booking URLs and decide which one should be the main
   public page.
3. Record the current behavior of Classic, Warm, Modern, and Red Clinical.
4. List every field that a clinic owner can edit.
5. List every place that field is displayed:
   - Visible text
   - Headings
   - Links
   - Images
   - Social cards
   - Structured data
   - Metadata
6. Check the current public API response and remove fields that are not
   needed by a public visitor.
7. Check the current image upload path and file restrictions.
8. Check whether any clinic-controlled value reaches an HTML, script, style,
   URL, redirect, or JSON-LD context.
9. Save a clean desktop and mobile baseline for all four themes.

#### Why this must happen first

Search optimization increases the number of people who can discover a page.
It should not be done before confirming that the page exposes only intended
information and safely handles clinic-provided content.

#### Completion condition

We should be able to answer:

- Which URL is the official clinic page?
- Which fields are public?
- Which fields are private?
- Which fields are optional?
- Which pages are ready for indexing?
- Which fields can contain links or uploaded images?

No public behavior should intentionally change during this phase.

### Phase 1 — Secure the public data and content boundary

**Priority:** P0 — Must fix first
**Purpose:** Prevent malicious scripts, dangerous links, unsafe uploads, and
unintended data exposure.

#### In common language

Clinic owners need to customize their websites, but they should not be able
to place a program inside the page or accidentally publish a dangerous link.
The editor should provide safe choices instead of allowing arbitrary website
code.

#### Planned work

1. **Use an explicit public data list**

   The public clinic endpoint should return only information that a patient
   needs to see, such as:

   - Clinic name
   - Public address and city
   - Public phone and email
   - Logo and approved website images
   - Public hours
   - Public doctors
   - Public services and website content
   - Verified map coordinates when intended for display

   It must not return billing, subscription, storage, verification document,
   internal trust, or other operational fields.

2. **Allow plain text, not custom code**

   Website content should remain plain text. The editor should not accept:

   - Script tags
   - Inline JavaScript
   - Custom CSS
   - Arbitrary HTML
   - Event handlers such as `onclick`
   - Unapproved iframes
   - Template expressions

   React currently escapes ordinary text content, which is helpful. The
   server must still validate the content so a future component cannot turn a
   saved text value into executable HTML.

3. **Validate links by their purpose**

   A website link, social link, image URL, phone link, and email link should
   not all use the same loose rule.

   The server should reject dangerous schemes such as:

   ```text
   javascript:
   data:
   vbscript:
   ```

   Social links should normally use HTTPS. Image URLs should use approved
   storage paths or HTTPS sources. Phone and email links should be generated
   from validated values rather than accepted as arbitrary URLs.

4. **Keep uploads image-only**

   Website image uploads should be checked for:

   - Allowed extension
   - Real file type, not only the filename
   - Maximum size
   - Maximum dimensions
   - Safe generated object name
   - Safe content type

   JPEG, PNG, and WebP are the safest first supported set. SVG should not be
   accepted unless it is deliberately sanitized because SVG can contain
   active content.

5. **Protect the website update action**

   The website save route already has authentication, clinic-session checks,
   and Zod validation. It should also receive:

   - A request rate limit
   - CSRF protection or strict request-origin checks
   - Explicit field allowlisting
   - Audit logging for important changes
   - Clear validation errors for the clinic owner

6. **Add browser safety headers**

   Add and test production headers for:

   - Content Security Policy
   - Content type sniffing protection
   - Referrer policy
   - Permissions policy
   - HTTPS transport security
   - Frame/embed restrictions

   CSP should first run in report-only mode so legitimate fonts, map tiles,
   images, and API requests can be identified before enforcement begins.

#### What must not be done

- Do not rely only on a blacklist of suspicious words.
- Do not assume CORS alone prevents CSRF.
- Do not accept arbitrary clinic HTML because it is “only a clinic page.”
- Do not allow uploaded files to be served as executable content.
- Do not expose the entire database clinic object to the browser.

#### Completion condition

Test values such as the following must be displayed or rejected safely, never
executed:

```text
<script>alert(1)</script>
javascript:alert(1)
data:text/html,<script>alert(1)</script>
```

The public API must return only reviewed public fields, and approved image
uploads must still display normally.

### Phase 2 — Make the correct clinic pages discoverable

**Priority:** P1 — Search foundation
**Purpose:** Help search engines find the right page and avoid indexing the
wrong or unfinished page.

#### In common language

Google needs clear directions. We must tell it:

- Which clinic pages exist.
- Which page is the official version.
- Which pages are unfinished.
- Which pages should not be indexed.
- Where the list of eligible clinic pages can be found.

#### Planned work

1. **Choose one canonical clinic URL**

   The recommended public URL is:

   ```text
   /clinic/:slug
   ```

   Numeric, legacy, and duplicate versions should redirect to it or be marked
   as not for indexing.

2. **Add a real robots file**

   Add:

   ```text
   /robots.txt
   ```

   It should permit eligible public clinic pages, protect authenticated
   dashboard routes, and point to the sitemap.

3. **Add a dynamic sitemap**

   Add:

   ```text
   /sitemap.xml
   ```

   The sitemap should automatically list approved, non-archived, index-ready
   clinic pages. It should not list:

   - Pending clinics
   - Rejected clinics
   - Archived clinics
   - Invalid slugs
   - Private dashboard pages
   - Incomplete placeholder pages

4. **Use real 404 responses**

   A missing clinic should not return a successful page that merely says
   “Clinic not found.” Search engines should receive a real 404 or another
   deliberate removal status.

5. **Use a no-index state for unfinished pages**

   A clinic should be excluded from search until it has the minimum useful
   information. This is safer than publishing dozens of empty pages.

6. **Set readiness rules**

   A practical starting rule is that a page needs:

   - Approved clinic status
   - Valid slug
   - Clinic name
   - Location
   - Contact information
   - Meaningful description or real service content
   - A working public page

   The exact threshold should be agreed before implementation.

#### Completion condition

Opening `/robots.txt` returns plain text beginning with `User-agent:`.

Opening `/sitemap.xml` returns valid XML and contains only eligible clinic
URLs. A missing clinic returns a real not-found response.

### Phase 3 — Add unique page-level SEO information

**Priority:** P2 — Page SEO
**Purpose:** Make each clinic page clearly relevant to real searches.

#### In common language

The title and description seen by Google should tell a person exactly what the
clinic does and where it is located. Each clinic should have its own
information rather than receiving the same generic text as every other clinic.

#### Planned work

1. Add a unique title for each clinic page.
2. Add a useful meta description.
3. Keep one clear H1 on the page.
4. Use logical H2 and H3 headings.
5. Include city and area information naturally.
6. Include real services and specialties.
7. Include accurate hours and contact details.
8. Add descriptive image alt text.
9. Use meaningful internal links to:
   - Booking
   - Services
   - Doctors
   - Contact and location sections
10. Add optional editor fields for:

    ```text
    seoTitle
    seoDescription
    ```

    Safe fallbacks should be generated when these fields are empty.

#### Important content rule

Do not copy one generic description to every clinic. A clinic should provide
real differences such as:

- Its actual city and neighborhood
- Its actual treatments
- Its actual doctors
- Its actual hours
- Its actual facilities
- Its actual patient-facing policies

Do not insert hidden keywords or repeat a city name unnaturally.

#### Completion condition

Two different clinics with different names, cities, and services should
produce different titles, descriptions, headings, and visible content.

### Phase 4 — Make public clinic content available to crawlers reliably

**Priority:** P3 — Technical quality
**Purpose:** Ensure the important content is available in the initial page
response, not only after a browser runs JavaScript.

#### In common language

The current public page is a React application that fetches clinic data in
the browser. Google can run JavaScript, but not every search engine,
directory, or social-preview service does this reliably.

The public clinic page should send its important information in a way that
both people and crawlers can understand quickly.

#### Planned work

1. Keep authenticated dashboards client-rendered.
2. Add server-rendered or carefully pre-rendered output for public clinic
   pages.
3. Ensure the initial HTML contains:
   - Clinic name
   - Main heading
   - Location
   - Description
   - Important services
   - Public links
   - Metadata
4. Hydrate the page with React afterward for booking, maps, menus, and other
   interactions.
5. Avoid maintaining a completely separate public design that can drift away
   from the four existing themes.

The safest technical choice should be determined after a small prototype:

- Reuse the existing Express response and inject public page data, or
- Introduce a focused server-rendered public route, or
- Pre-render only the public clinic pages while keeping the dashboard as-is.

#### Completion condition

A request made without a browser running JavaScript contains the clinic’s
important title, description, main heading, and canonical URL.

The browser version must still provide the existing booking and theme
behavior.

### Phase 5 — Add accurate structured data

**Priority:** P3 — Technical quality
**Purpose:** Help search engines understand that the page represents a real
local healthcare clinic.

#### In common language

Structured data is a machine-readable summary of information already shown on
the page. It is not a way to hide extra claims from patients or force a
ranking.

#### Planned work

Add safe JSON-LD for eligible pages using real visible information such as:

- Clinic name
- Address
- City and postal code
- Phone
- Public URL
- Logo or clinic image
- Opening hours
- Verified location coordinates
- Real services
- Verified social links

Use the most appropriate local healthcare business type supported by the
public data model, such as `MedicalClinic` or a suitable `LocalBusiness`
subtype.

#### Rules

- Structured data must match visible page content.
- Do not invent ratings or reviews.
- Do not mark up hidden content.
- Do not claim a service the clinic does not provide.
- Do not expose private data through JSON-LD.
- Escape clinic text safely before placing it inside a JSON script block.
- Validate structured data using Google’s testing tools.

#### Completion condition

Each eligible clinic page has valid structured data that describes that
clinic only, and structured-data errors do not appear in verification.

### Phase 6 — Improve speed, mobile use, and image quality

**Priority:** P3 — Technical quality
**Purpose:** Make the pages pleasant for patients and stronger on mobile
search.

#### In common language

A page that takes too long to load loses patients even if it ranks well.
Most clinic searches happen on phones, so the public site must be fast,
readable, and easy to use with a finger.

#### Planned work

1. Serve appropriately sized images.
2. Prefer WebP or another efficient format where practical.
3. Load the main hero image promptly.
4. Lazy-load images lower on the page.
5. Reserve image space to reduce content movement.
6. Reduce unnecessary JavaScript on public pages.
7. Keep buttons and phone links easy to tap.
8. Prevent horizontal scrolling.
9. Check the page on slow mobile connections.
10. Measure Core Web Vitals rather than assuming the page is fast.

#### Completion condition

The four themes work without horizontal overflow at mobile widths, the main
content appears quickly, and important images do not cause large layout
shifts.

### Phase 7 — Give clinics a local SEO checklist

**Priority:** P4 — Local growth
**Purpose:** Help clinic owners create the real-world signals that software
alone cannot create.

#### In common language

BookMySlot can build the website, but it cannot honestly create a clinic’s
reputation. The clinic must keep its information accurate in the places
where patients search.

#### Planned clinic guidance

Each clinic should be encouraged to:

1. Claim and verify its Google Business Profile.
2. Keep its name, address, and phone number consistent.
3. Keep hours updated.
4. Add real clinic photographs.
5. Link the clinic page from its Business Profile.
6. Ask genuine patients for honest reviews without incentives or pressure.
7. Respond to reviews professionally.
8. Use accurate business categories.
9. Seek legitimate local directory and professional-association listings.
10. Share the clinic page through real social and community channels.

#### What BookMySlot must not automate

- Fake reviews
- Fake patient identities
- Paid or spam backlinks
- Keyword-stuffed pages
- Hundreds of nearly identical doorway pages
- Misleading medical claims
- Hidden text intended only for search engines

These practices can cause ranking penalties and damage the reputation of both
the clinic and the BookMySlot domain.

### Phase 8 — Measure results and improve safely

**Priority:** P5 — Ongoing improvement
**Purpose:** Replace guesswork with real evidence.

#### Planned work

Track:

- Search impressions
- Search clicks
- Click-through rate
- Average position by query
- Indexed and excluded pages
- Sitemap errors
- Crawl errors
- Structured-data errors
- Core Web Vitals
- Organic booking conversions
- Google Business Profile actions where available

The first version should focus on giving clinic owners a clear setup checklist
and reporting reliable measurements. Automatic ranking promises should not be
made.

#### Completion condition

The team can see which clinic pages are indexed, which queries show them,
which pages need better content, and whether organic visitors complete a
booking.

## 22. How the SEO and preview work fit together

The two workstreams should share data but remain separate in responsibility.

### The Live section preview will

- Show the current unsaved editor values.
- Use the selected public theme.
- Help the owner judge visual layout.
- Show hidden, empty, automatic, and unsupported states.
- Never publish or save changes by itself.

### The SEO system will

- Use saved and approved clinic data.
- Decide whether a page is ready for indexing.
- Generate titles, descriptions, canonical URLs, sitemap entries, and
  structured data.
- Keep private or incomplete clinics out of search.
- Protect content and public data from unsafe input.

The live preview should not pretend that unsaved content is already visible to
Google. The saved public page and the search metadata must remain the source
of truth for indexing.

## 23. Suggested release order

The combined work should be released in these controlled groups:

### Release group A — Safety gate

- **Implemented 2026-09-03**
- Public API allowlist
- Safe URL validation
- Upload restrictions
- Website update protection
- XSS and dangerous-scheme tests
- Security-header report-only review

### Release group B — Search foundation

- Canonical clinic URL
- Real robots file
- Dynamic sitemap
- Index-readiness rule
- Correct 404 and noindex behavior

### Release group C — Useful clinic SEO

- Unique title and description
- Server-generated social metadata
- Visible local content guidance
- Heading and alt-text review
- Safe LocalBusiness/MedicalClinic structured data

### Release group D — Reliable public experience

- Server-rendered or pre-rendered public clinic content
- Responsive image improvements
- Mobile performance improvements
- Core Web Vitals review

### Release group E — Growth and reporting

- Clinic local SEO checklist
- Search Console setup guidance
- Indexing and query reporting
- Ongoing content and security reviews

Each release group should pass the existing production build and Build Check
before the next group begins.

## 24. Recorded implementation decisions

The following decisions were approved for the work covered by this document:

1. Keep the four fixed public themes.
2. Keep clinic editing limited to safe, approved fields.
3. Use `/clinic/:slug` as the canonical public page.
4. Index only approved and sufficiently complete clinic pages.
5. Generate metadata and structured data from real clinic information.
6. Start security work with an explicit allowlist and strict schemas, with
   dangerous-content rejection as a secondary defense.
7. Treat Google ranking as an ongoing outcome to measure, not a guaranteed
   feature.

Release Group A has now been implemented and verified. Release Group B remains
blocked until the index-readiness predicate and page eligibility behavior are
reviewed; see SEO-09 and SEO-10.