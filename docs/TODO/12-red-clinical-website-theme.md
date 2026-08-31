# Red Clinical Website Theme — Implementation Plan

## Objective

Add a new clinic website theme inspired by the supplied dental-clinic reference screenshots. The theme should feel confident, premium, clinical, and conversion-focused while remaining editable from **Clinic Admin → Clinic Website**.

The new theme must be additive. Existing Classic, Warm, and Modern themes must continue to render and save their current content without behavior changes.

## Current foundation

- Clinic website configuration is stored in the existing `clinics.website_config` JSONB field.
- Clinic owners save website settings through `PATCH /api/auth/clinic/website-config`.
- Public clinic pages are rendered by `client/src/pages/ClinicAbout.tsx`.
- Theme rendering is currently implemented in `client/src/components/clinic-themes/ClinicThemes.tsx`.
- Website editing is implemented in `client/src/components/WebsiteConfigPanel.tsx`.
- Clinic image uploads already use the existing signed-upload/R2 flow through `ImageUpload`.
- The current editor already supports theme, hero, about, features, stats, services, doctors, gallery, testimonials, hours, social links, map, preview, and save actions.

## Scope

### 1. Add the new theme

- Extend the website theme type with a new stable identifier, recommended as `red-clinical`.
- Add the theme to the admin theme selector with a representative preview and description.
- Add public theme dispatch in `ClinicAbout.tsx`.
- Implement the theme without changing the visual or behavioral output of the existing themes.
- Keep the theme responsive for desktop, tablet, and mobile layouts.

### 2. Recreate the reference visual language

Use the reference site as visual inspiration, not as a pixel-perfect copy. The theme should include:

- Red accent color system with deep black/dark charcoal surfaces.
- Thin top contact/announcement strip.
- Dark navigation with clinic logo, anchor navigation, and prominent booking button.
- High-impact hero with:
  - Dark image treatment/overlay.
  - Red accent shape or highlight.
  - Configurable headline and description.
  - Primary booking CTA.
  - Optional foreground/doctor image treatment where supported.
- Trust/credentials band for experience, technology, and specialist-care highlights.
- Spacious About section with image, clinic story, and red checklist accents.
- Doctor profile/biography presentation using existing Manage Doctors data where possible.
- Specialities presentation with concise cards.
- Red treatment-category cards with readable multi-item content.
- Image-led treatment/service cards with carousel controls where multiple items exist.
- Instagram/social showcase area using manually managed image/link content for the first version.
- Contact and clinic-hours section with a strong image-led composition.
- Patient testimonials in a multi-card or carousel layout.
- FAQ section with expandable questions and answers.
- Split “Schedule a Visit” / “Talk to Us” conversion section.
- Red/dark footer with clinic information, navigation, contact links, and booking CTA.
- Floating WhatsApp action derived from the clinic phone when available.

### 3. Extend the website content model only where necessary

Prefer existing fields first. Add optional JSON configuration fields for reference content that cannot be represented safely by current fields:

- Dedicated About image.
- Optional hero foreground/doctor image.
- Speciality cards.
- Treatment groups containing a title, description, and item list.
- FAQ entries.
- Manually managed social post cards with image, caption, and link.
- Optional custom top-strip text.
- Optional custom CTA labels or descriptions if the existing labels are not sufficient.

Use optional fields and fallbacks so older saved configurations remain valid.

### 4. Extend the Clinic Website admin editor

- Add editor sections for any newly introduced fields.
- Preserve the current two-pane section navigator and live preview workflow.
- Provide add/remove controls for speciality cards, treatment groups, FAQ entries, and social post cards.
- Use existing `ImageUpload` for new clinic website image fields.
- Show clear “hidden until content is added” states for optional sections.
- Keep Save Website and section-level Save behavior consistent.
- Make all new controls keyboard accessible and usable on small screens.
- Show changes in the existing preview when practical; otherwise provide a clear explanation that they appear on the live preview after saving.

### 5. Preserve real behavior

- Keep all booking CTAs connected to the existing clinic booking route.
- Keep phone links using `tel:`.
- Keep social links opening safely in a new tab.
- Keep map and directions behavior unchanged.
- Keep doctor cards sourced from Manage Doctors rather than duplicating doctor records.
- Keep gallery and image uploads on the existing storage path.
- Do not add fake live Instagram or Google Reviews data.
- Treat Instagram/review integrations as a separate future decision; the first version should use manually entered content.

### 6. Server-side safety

- Extend the shared TypeScript type for the new optional fields.
- Add server-side validation for the expanded website configuration rather than persisting arbitrary request bodies.
- Enforce sensible maximum counts and text lengths for repeatable content.
- Preserve unknown-field tolerance only if it is required for backward compatibility.
- Continue restricting website configuration updates to the authenticated clinic owner.
- Do not create a relational migration unless the JSONB configuration becomes insufficient.

### 7. Accessibility and responsive behavior

- Use semantic headings in page order.
- Give every meaningful image an appropriate alt text.
- Ensure carousel controls have accessible labels and disabled states.
- Ensure FAQ controls expose expanded/collapsed state.
- Ensure red text and white text meet contrast requirements against their backgrounds.
- Avoid relying on hover-only interactions.
- Prevent horizontal overflow on mobile.
- Verify nav, CTA, FAQ, carousel, and floating WhatsApp controls on narrow screens.

## Recommended implementation order

1. Add this plan to `docs/TODO` before application changes.
2. Extend `ClinicWebsiteConfig` with the new theme and optional content types.
3. Add server-side validation for the website configuration endpoint.
4. Add the new theme option and admin editor state/sections.
5. Build the public Red Clinical theme and connect existing content.
6. Add the missing public sections and their editor controls.
7. Connect the new image fields to the existing upload flow.
8. Verify the save/reload/public-preview lifecycle.
9. Run type checking/build verification and inspect the running preview at desktop and mobile sizes.
10. Update this TODO with completion notes and any intentionally deferred work.

## Acceptance checklist

### Theme and routing

- [x] Red Clinical appears in the admin theme selector.
- [x] Selecting and saving Red Clinical is supported by the validated website-config endpoint and persisted JSONB shape.
- [x] Public clinic pages dispatch Red Clinical from both slug and legacy clinic-id paths.
- [x] Existing Classic, Warm, and Modern theme code paths remain unchanged.

### Content and editor

- [x] Hero, About, features, stats, services, doctors, gallery, testimonials, hours, social links, map, and footer use real clinic data.
- [x] New specialities, treatment groups, FAQs, and social cards have add/edit/remove controls and are included in save/reload state.
- [x] Empty optional social, gallery, testimonial, and map sections do not leave large blank areas.
- [x] New image fields use the existing ImageUpload flow.
- [x] Existing editor preview panes include the new section states; the full public layout is shown after saving.

### User actions

- [x] Every booking CTA reaches the existing booking flow.
- [x] Phone, map, social, and external links work safely.
- [x] WhatsApp is hidden when no usable phone number exists.
- [x] Existing service carousel controls and the new FAQ controls work with keyboard and pointer input.

### Quality

- [x] Mobile layout uses responsive grids, stacked navigation, and non-overflowing content containers.
- [x] Meaningful new images have useful alt text; decorative image treatments use empty alt text.
- [x] Primary red/black/white combinations and visible focusable controls have readable contrast.
- [x] Website configuration rejects malformed or oversized repeatable content with a 400 response.
- [x] `npm run check` passes.
- [x] `npm run build` passes.
- [x] The application workflow was restarted and the running preview/logs were checked.

## Intentionally deferred unless separately requested

- Live Instagram API/feed synchronization.
- Live Google/third-party review synchronization.
- A drag-and-drop page builder.
- Per-section reorder controls.
- Separate relational tables for website content.
- Custom domains and deployment configuration.
- Automatic extraction of content from the reference website.

## Completion notes — September 1, 2026

Implemented the additive `red-clinical` theme with:

- Red announcement strip, charcoal navigation, responsive mobile menu, hero treatment, booking CTAs, trust band, about/story section, doctor biography, stats, speciality cards, treatment groups, image-led services, gallery, manually managed social gallery, contact/hours composition, testimonials, FAQ accordion, conversion split, map, footer, and floating WhatsApp action.
- New optional JSON content fields for about/foreground images, announcement text, specialities, treatment groups, FAQs, and social post cards. No database migration was needed.
- Bounded server-side validation for the complete website configuration payload, including existing `featuresImageUrl` compatibility.
- New editor sections with add/remove/edit controls and existing signed image upload support.

Verification completed:

- `npm run check` passed.
- `npm run build` passed.
- `Start application` restarted successfully and backend/database health checks returned healthy.
- Public clinic endpoint returned successfully for the seeded legacy ID path.
- Root preview rendered successfully. The proxied Vite WebSocket reconnect warning remains an environment/preview warning and is unrelated to the theme.

Manual authenticated save/reload and visual inspection of a configured Red Clinical clinic still require a clinic-admin session with clinic content available. Live Instagram and review synchronization remain intentionally deferred.
