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

## Reference website review and proposed next improvements — September 1, 2026

The supplied screenshots show another dental clinic website. This section records what is useful about that website, what our Red Clinical theme already does, and what could be added next.

This is a planning section only. The improvements below are **not approved application changes yet**. No code should be changed from this section until the clinic owner chooses which items to implement.

### Plain-language summary

The reference website is not especially valuable because of its blue colour scheme. Its real strength is that it answers practical patient questions quickly:

- Who are the doctors?
- What treatments are available?
- Where is the clinic?
- Is it easy to reach?
- Is there parking?
- Can the clinic handle emergencies?
- Is the clinic accessible to elderly or differently-abled patients?
- Does the clinic use modern equipment?
- Can patients pay through EMI?
- How can a patient call, WhatsApp, or book?

The Red Clinical theme already provides the main page structure and the red/black visual identity. The most valuable next step is therefore to add more **proof and practical information**, not to copy every visual detail from the screenshots.

### What the reference website does well

#### 1. It explains the clinic's local area clearly

The reference site repeatedly names Kochi, Kadavanthra, nearby neighborhoods, landmarks, and travel distances. This helps a patient understand whether the clinic is convenient for them. It can also help local search visibility.

Useful examples from the screenshots include:

- The clinic's main service area in the hero heading.
- Nearby locations such as Panampilly Nagar, Elamkulam, Vyttila, Thevara, and MG Road.
- A landmark or metro-station reference.
- A dedicated “How to find us” area.
- A direct Google Maps button.

**Possible Red Clinical improvement:**

Add an optional “Location and access” content area where a clinic owner can enter:

- A short location summary.
- Nearby neighborhoods or landmarks.
- Parking information.
- Ground-floor or lift access information.
- Public transport information.
- Emergency or same-day appointment information.

All fields must be optional. A clinic should never show an empty or misleading location section.

#### 2. It uses specific trust points instead of only general marketing language

The reference site uses six clear points that answer real patient concerns:

- Dental specialists under one roof.
- Wheelchair-friendly, ground-floor access.
- Emergency dental care.
- Ample parking space.
- Advanced dental technology.
- Affordable care with EMI options.

These are more useful than vague statements such as “best care” or “trusted professionals” because a patient can immediately understand the benefit.

**Possible Red Clinical improvement:**

Add a Red Clinical-specific “Trust and facilities” section with up to six cards. Each card could contain:

- A title.
- A one- or two-line explanation.
- A simple icon.
- An optional category such as “Accessibility”, “Emergency”, “Technology”, or “Payment”.

The clinic owner must provide the information. The system must not automatically claim that every clinic offers emergency care, EMI, parking, or accessibility.

#### 3. It makes the full dental team visible

One screenshot shows a grid of several dentists, including:

- A photo.
- The doctor's name.
- Specialization.
- Professional role or degree.

This is important because patients often choose a dental clinic based on the doctor's experience and area of expertise.

The current Red Clinical theme has a featured doctor biography, but it does not yet present the complete team as strongly as the reference website.

**Possible Red Clinical improvement:**

Add a complete “Meet our dentists” section using the existing Manage Doctors records. Each doctor card should use real clinic data and may show:

- Profile photo.
- Name.
- Specialization.
- Degree.
- Years of experience.
- Short biography when available.
- A booking action.

Doctors should not be copied into a second unrelated website data store. Manage Doctors must remain the source of truth.

#### 4. It gives services enough explanation to help a patient choose

The reference site uses image-based treatment cards for services such as:

- Cosmetic dentistry.
- Dental check-ups and cleanings.
- Invisalign or clear aligners.
- Laminate veneers.
- Root canal treatment.

Each card includes a title and a longer explanation. This helps a patient understand the service before booking.

The Red Clinical theme already supports image-led services and service descriptions. This part is mostly covered.

**Possible small improvement:**

Make sure service cards remain easy to scan on mobile. Long descriptions should be shortened or expandable rather than creating very tall, uneven cards.

#### 5. It shows certifications and technology as visible proof

The reference website highlights an Invisalign provider badge and mentions technology such as:

- Intraoral scanning.
- Full-mouth X-ray.
- Orthopantomogram.
- B-class autoclave.
- Sterilization practices.

These details can increase confidence, but they must be accurate.

**Possible Red Clinical improvement:**

Add an optional “Credentials and technology” section for manually managed items. Each item could contain:

- Name.
- Short explanation.
- Optional uploaded badge or image.
- Optional link to an official provider or certification page.

Examples may include “Invisalign Provider”, “Digital Scanner”, “Advanced Sterilization”, or a real award. The system must not create, infer, or display a certification automatically.

#### 6. It gives patients several ways to contact the clinic

The reference website repeats contact actions in useful places:

- Call button.
- Book appointment button.
- WhatsApp button.
- Google Maps button.
- Location and working-hours information.

The Red Clinical theme already has booking buttons, phone links, a map, working hours, and a floating WhatsApp action.

**Possible Red Clinical improvement:**

Add a mobile-only bottom action bar with three clearly labelled actions:

- Call.
- WhatsApp.
- Book.

This would keep the most important actions available while a patient scrolls through a long page. It should only show actions when the relevant phone number or booking route is available.

#### 7. It uses FAQs to answer common patient questions

The reference site has detailed answers about:

- Available treatments.
- Clinic location.
- Same-day or emergency appointments.
- Appointment booking.
- Affordability and EMI.

The Red Clinical theme already includes an expandable FAQ section. The main improvement would be content quality and discoverability.

**Possible small improvement:**

- Add “FAQ” to the Red Clinical navigation.
- Give the FAQ section a stable page anchor.
- Encourage clinic owners to answer local, booking, emergency, and payment questions.

#### 8. Its footer contains more practical information

The reference footer includes:

- Quick links.
- Facilities.
- Working hours.
- Detailed contact information.
- Multiple branch addresses.
- Social links.

The Red Clinical footer already contains clinic information, navigation, contact links, social links, and booking access.

**Possible future improvement:**

Add optional footer link groups or branch information only if clinics need it. Multiple branches should not be added as a quick text field because branch names, addresses, phone numbers, coordinates, and booking routes may eventually need their own data model.

### What the Red Clinical theme already covers

The first implementation already includes the most important structural ideas from the screenshots:

- Red announcement strip.
- Dark navigation.
- Responsive mobile navigation.
- Large image-based hero.
- Red booking calls to action.
- Trust highlight band.
- About section with checklist styling.
- Featured doctor biography.
- Speciality cards.
- Red treatment-category cards.
- Image-led treatment/service cards.
- Clinic gallery.
- Manually managed social gallery.
- Clinic hours and contact area.
- Testimonials.
- Expandable FAQs.
- Map and directions.
- Schedule/contact conversion block.
- Dark footer.
- Floating WhatsApp button.

Because these sections are already available, the next work should focus on making the page more trustworthy and useful rather than adding more decorative sections.

### Recommended work order

#### Phase 1 — highest patient value

These changes should be considered first:

1. **Complete dentist team grid**
   - Use the existing Manage Doctors data.
   - Show all active clinic doctors.
   - Keep the featured biography as an optional lead section.

2. **Six-card trust and facilities section**
   - Add descriptions, not just titles.
   - Support accessibility, emergency care, parking, technology, specialist care, and payment information.
   - Display only information entered by the clinic.

3. **Mobile Call / WhatsApp / Book bar**
   - Keep it fixed at the bottom on small screens.
   - Avoid covering important page content.
   - Add bottom padding to the page when the bar is visible.

4. **FAQ navigation link**
   - Add FAQ to the main navigation.
   - Ensure the link works on both desktop and mobile.

#### Phase 2 — stronger proof and local conversion

5. **Credentials and technology cards**
   - Support real provider badges, certifications, equipment, and safety information.
   - Allow image uploads through the existing clinic image flow.

6. **Location and convenience details**
   - Add optional nearby-area, landmark, parking, accessibility, and transport text.
   - Keep the existing map and directions behavior.

7. **Local clinic introduction**
   - Allow a clinic-specific local paragraph.
   - Avoid automatically writing unsupported claims such as “best clinic”.

#### Phase 3 — only if there is a real business need

8. **Richer footer link groups**
   - Facilities.
   - Popular treatments.
   - Policies.
   - Additional clinic information.

9. **Multiple branch support**
   - Only after confirming how branches should share doctors, hours, map coordinates, booking routes, and contact details.

10. **Blog or educational content**
   - Only after a real content management workflow exists.
   - Do not add a “Blog” navigation item that leads nowhere.

### Things we should not copy from the reference website

The following should not be copied without a clear product reason:

- Its blue colour scheme, because Red Clinical has a deliberate red and charcoal identity.
- Repeated long SEO paragraphs that make pages harder to scan.
- “Best clinic” or similar claims unless the clinic owner explicitly provides and accepts them.
- Live Instagram feeds or live review imports in this phase.
- Certification badges without real clinic verification.
- Multiple branch text blocks without structured branch support.
- Navigation links for pages that do not exist.
- Large fixed elements that cover content on mobile.

### Suggested content rules for clinic owners

If these improvements are approved, the editor should guide the clinic owner to provide useful and honest information:

- Use short, specific titles.
- Explain the patient benefit in one or two sentences.
- Use real clinic facilities only.
- Do not promise emergency care if it is not available.
- Do not claim a certification unless the clinic has it.
- Use real doctor information from Manage Doctors.
- Keep location and parking information current.
- Use readable language instead of keyword-heavy paragraphs.

### Proposed data additions, if Phase 1 is approved

The first phase could be implemented with optional JSON fields in the existing `website_config` field, consistent with the current theme approach. A possible shape would include:

- `trustPoints`: title, description, icon, and optional category.
- `mobileActions`: optional labels or visibility settings if the default labels are not enough.

The full team grid should continue to use existing doctor records instead of duplicating doctors in website configuration.

Location details and credentials should be added only after deciding whether they belong in the general clinic profile or only in the Red Clinical website configuration.

### Approval boundary

No application changes should be made from this addendum until the clinic owner approves a specific phase or selects specific improvements. This keeps the current working Red Clinical implementation safe and avoids adding editor fields that the clinic may not need.
