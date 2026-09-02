# Dynamic Theme-Aware Clinic Website Section Preview — Implementation Plan

**Status:** Plan documented; application implementation not started  
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

Implementation should begin only after this plan has been reviewed and
approved. At completion, update this document with:

- The final component structure.
- Any sections that needed a deliberate approximation.
- Any theme-specific behavior that differs from the initial plan.
- Desktop and mobile verification results.
- Any intentionally deferred improvements.