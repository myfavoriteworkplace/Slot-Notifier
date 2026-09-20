# Avatar styling and design direction

**Status:** Proposed design brief and uploaded SVG audit — no application code changes made
**Date:** September 20, 2026  
**Scope:** Profile avatars, empty-state illustrations, system-state illustrations, uploaded SVG audit, runtime asset placement, image handoff rules, and performance limits

## 1. Purpose of this document

This document gives the design agent a complete visual and technical brief for
the platform's avatar and illustration system.

It explains:

- What the supplied reference image is doing well.
- The difference between a profile avatar and an empty-state illustration.
- The recommended futuristic healthcare visual style.
- The scenarios that need an avatar or illustration.
- The standard colors, gradients, spacing, and shape rules.
- The required image names, sizes, formats, and file-size targets.
- The folder structure for delivering the finished images.
- Accessibility and performance requirements.
- A ready-to-send design-agent brief.

The goal is to create a small, consistent image system. We should not create a
large collection of almost identical images that makes the application heavier
or creates unnecessary design maintenance.

## 2. Important clarification about the supplied reference

The supplied screenshot shows an **empty-state illustration**, not a person
profile avatar.

It appears in the booking screen when there are no results. The visible
illustration shows a calm healthcare/scheduling idea: a calendar, a search
symbol, and a small clinic-related object. The surrounding screen uses a deep
green platform background, while the illustration sits inside a light neutral
square.

The current booking empty state displays its illustration at approximately:

- **128 × 128 CSS pixels**
- Square aspect ratio
- Contained inside a rounded square wrapper
- `object-contain` behavior
- No user interaction on the image itself

The reference is a good starting direction because it is:

- Easy to understand.
- Not frightening or overly technical.
- Related to appointments.
- Soft enough for an empty screen.
- Suitable for a medical platform.
- More friendly than showing a plain icon or an empty table.

However, this illustration should not be reused as a doctor's profile avatar.

The platform needs two related families:

1. **Profile avatars** — people, doctors, clinics, staff, or system identities.
2. **State illustrations** — no bookings, no patients, no data, offline, locked,
   success, and similar situations.

They should share the same colors and visual language, but each family should
have its own artwork and purpose.

## 2.1 Uploaded SVG suite audit

The custom package supplied for this design direction was reviewed before any
project files were changed.

**Uploaded package:**

```text
attached_assets/bookMySlot-Dental-Asset-Suite_1789893285425.zip
```

### What the package contains

| Group | Count | Contents |
|---|---:|---|
| Avatars | 4 | Doctor, person, clinic, and system fallback avatars |
| Empty states | 8 | Appointments, search, patients, doctors, billing, inventory, analytics, and medical records |
| System states | 3 | Offline, permission, and success |
| Documentation | 1 | Package README |
| Raster files | 0 | No PNG, WebP, JPEG, or AVIF files included |
| Preview sheets | 0 | No light/dark or size comparison sheets included |
| Editable source files | 0 | No Figma, Illustrator, or other source files included |

The package contains **15 SVG assets**. Their combined SVG source size is
approximately **14 KB**, and the ZIP is approximately **20 KB**. This is
excellent for web performance and does not create a meaningful bundle-size
risk.

### Technical findings

The uploaded SVG files:

- Use transparent backgrounds.
- Use responsive `width="100%"` and `height="100%"`.
- Use `viewBox` coordinates instead of fixed pixel dimensions.
- Do not contain hardcoded dark or light rectangular cards.
- Do not reference external images, fonts, stylesheets, or URLs.
- Do not contain JavaScript or embedded event handlers.
- Use the expected teal, mint, pale green, and slate palette.
- Can be processed by Vite as normal imported frontend assets.

The uploaded files are therefore safe to treat as application-owned static
illustrations after copying the approved files into the runtime source folder
described in Section 12.1.

### Actual canvas sizes found

| Asset group | Actual canvas |
|---|---|
| Avatar SVGs | `viewBox="0 0 256 256"` |
| Most empty-state SVGs | `viewBox="0 0 320 320"` |
| `empty-medical-records.svg` | `viewBox="0 0 256 256"` |
| System-state SVGs | `viewBox="0 0 256 256"` |

The mixed 256 and 320 canvases do not cause a rendering problem because SVG
scales correctly. The 320 × 320 canvas remains the preferred standard for
full-size empty-state illustrations. The 256 × 256 canvas is reasonable for
compact medical-record and system-state artwork.

### Visual review of the uploaded suite

The suite successfully follows the recommended “futuristic calm healthcare”
direction:

- The avatar and empty-state families are visually related but not identical.
- Orbit rings, dotted lines, and small digital markers create the futuristic
  feeling without using a robot or a science-fiction character.
- The dental identity is clear through the tooth, shield, medical file, and
  clinic symbols.
- The illustrations remain understandable without explanatory text inside the
  artwork.
- The transparent artwork can sit inside application-provided light and dark
  wrappers.
- `empty-appointments.svg` is the strongest replacement for the current
  booking empty-state image.
- `avatar-clinic-default.svg` is appropriate for a dental clinic fallback.
- `avatar-doctor-default.svg` is appropriate for doctor profiles and dashboard
  identity.
- `empty-patients.svg`, `empty-billing.svg`, and `empty-inventory.svg` have
  immediately understandable meanings.
- `state-permission.svg` and `state-success.svg` are clear at a glance.

### Items to record before final integration

The current suite is suitable for initial use, but the following differences
from the full planned inventory should be documented:

1. `empty-admin-requests.svg` is not included.
2. `state-welcome.svg` is not included.
3. No raster fallbacks or preview sheets are included.
4. `empty-medical-records.svg` uses a 256 × 256 viewBox instead of 320 × 320.
5. The system-state assets also use 256 × 256 viewBoxes, which is acceptable
   for their normally smaller display size.
6. `state-offline.svg` uses a cloud and downward arrow. This may be understood
   as downloading or syncing rather than being offline. Confirm its meaning
   during UI review before using it for a network failure screen.
7. Some avatar artwork contains orbit and dotted details that may be visually
   busy at 28 px. The person and system avatars are better candidates for very
   small sizes; the doctor avatar should preferably start at 40 px.

These are design-review items, not blockers for copying the approved SVGs into
the runtime asset folder.

### Accessibility finding

The SVGs do not need embedded `<title>` or ARIA metadata if they are rendered
through an HTML image element. The application must provide the correct
accessible text:

```tsx
<img src={emptyAppointments} alt="No appointments" />
```

If the artwork is decorative and the surrounding heading already explains the
state, use:

```tsx
<img src={emptyAppointments} alt="" />
```

If an SVG is rendered inline as markup rather than through `<img>`, the
component must provide the appropriate `aria-hidden`, `role`, or accessible
label behavior.

## 3. Recommended visual direction

## 3.1 Design concept: futuristic calm healthcare

The recommended direction is:

> A clean, calm, futuristic healthcare illustration system using rounded
> geometry, soft teal and mint colors, light digital details, and very clear
> visual meaning.

The design should feel:

- Trustworthy.
- Professional.
- Modern.
- Friendly.
- Calm.
- Simple.
- Suitable for both clinic staff and patients.

The futuristic feeling should come from:

- Thin orbit rings.
- Small glowing dots.
- Subtle digital grid lines.
- Rounded interface cards.
- Clean geometric outlines.
- A small amount of soft light.

It should not come from:

- Robots.
- Complicated 3D scenes.
- Sci-fi helmets.
- Neon cyberpunk colors.
- Excessive glowing effects.
- Cartoon faces with exaggerated expressions.
- Large text drawn inside the image.

The artwork should still look appropriate if all glow and gradient effects are
removed.

## 3.2 Recommended illustration style

Use a style that is between a polished vector illustration and a very soft
editorial medical illustration:

- Rounded line work.
- Low visual noise.
- Few major shapes.
- Soft transparent fills.
- Limited color palette.
- Slight depth, but not heavy 3D.
- No unnecessary background objects.

The most important object should be understandable in less than one second.

For example:

- Calendar means appointments.
- People means patients or doctors.
- Receipt means billing.
- Box or bottle means inventory.
- Chart means analytics.
- Shield means permissions or security.
- Cloud connection means offline state.

## 3.3 Profile-avatar style

Profile avatars should be more restrained than empty-state illustrations.

Recommended characteristics:

- Head-and-shoulders composition.
- Neutral, non-stereotyped appearance.
- Simple facial structure or silhouette.
- No small text.
- No complex background scene.
- Clear outline at 40–64 px.
- Transparent or soft single-color background.

For the default doctor avatar, an understated coat collar or stethoscope can be
used. It should not look like a caricature or identify one specific gender,
age, race, hairstyle, or nationality.

For a general person avatar, use a neutral head-and-shoulders silhouette.

For a clinic avatar, use a simple clinic, shield, smile, or medical mark rather
than a person.

## 3.4 Empty-state style

Empty-state illustrations can include a small scene, but the scene should
remain compact.

Recommended structure:

1. One main object.
2. One supporting object.
3. One small futuristic detail.
4. Soft background or transparent canvas.

For the booking example:

- Main object: calendar.
- Supporting object: search glass.
- Small detail: plant, dot, glow, or schedule card.

Do not place the explanatory sentence inside the image. The application should
render the heading and description as real text below the image.

## 4. Platform locations and scenarios

The following sections describe where the image system may be used in the
current product and how each case should behave.

## 4.1 Doctor profile avatar

Used in:

- Doctor dashboard header.
- Doctor profile editing screen.
- Public doctor profile.
- Clinic doctor list.
- Clinic information sheet.
- Public clinic doctor cards.
- Website preview.

Recommended behavior:

- Use the doctor's uploaded photo when available.
- Use `avatar-doctor-default.svg` when no photo exists.
- Keep the same source image across all surfaces.
- Let the surrounding component decide whether it is circular or rounded
  square.
- Do not create separate artwork for every component size.

## 4.2 General user or staff avatar

Used in:

- Staff lists.
- Future staff management.
- System activity or notification rows.
- Any user identity that is not a doctor.

Recommended behavior:

- Use the user's photo if the product later supports one.
- Use initials if a name is available and that is the existing component
  convention.
- Use `avatar-person-default.svg` when no initials or image are available.

## 4.3 Clinic avatar or logo fallback

Used in:

- Clinic header.
- Clinic selection.
- Clinic public profile.
- Booking flow.
- Notifications.

Recommended behavior:

- Use the clinic's uploaded logo first.
- Use a simple clinic fallback when no logo exists.
- Do not use a person's avatar as a clinic logo.
- Do not rely on tiny words inside the logo.

## 4.4 System or automated-message avatar

Used in:

- Automated notification rows.
- System activity feed.
- Platform-generated messages.
- Operational events.

Recommended behavior:

- Use an abstract system mark, not a human face.
- Keep it visually distinct from doctors and patients.
- Use a small shield, pulse, orbit, or platform symbol.

## 4.5 No bookings or no appointments

Used in:

- No bookings today.
- No upcoming appointments.
- No past appointments.
- No appointments for the selected doctor.
- No appointments after a date filter.
- No appointments after a status filter.
- No appointments for a selected patient.

Use one reusable illustration:

```text
empty-appointments.svg
```

Change the surrounding text, not the artwork:

```text
No bookings today
No slots are booked for today. Check Upcoming for future appointments.
```

```text
No upcoming appointments
There are no future appointments for the selected filters.
```

```text
No appointments match these filters
Try clearing one or more filters.
```

This is the most important empty-state asset because it directly matches the
provided reference image.

## 4.6 No search results

Used in:

- Patient search.
- Doctor search.
- Clinic search.
- Booking search.
- Admin filters.

Recommended visual:

- Magnifying glass.
- Small document, person, or card.
- One small neutral question mark or empty result indicator.

Do not make it look like an error. Search returning zero results is a normal
state.

## 4.7 No patients

Used in:

- A new clinic with no patient records.
- Patient directory with no matching filters.
- Patient search returning zero results.

Recommended visual:

- Two or three simple person shapes.
- Optional plus sign for the “no patients yet” version.
- Softer and more welcoming than a warning illustration.

## 4.8 No doctors

Used in:

- Clinic has not added a doctor.
- No doctor matches a filter.
- Public clinic page has no configured doctor profiles.

Recommended visual:

- Neutral doctor silhouette.
- Small clinic or medical badge.
- Optional plus sign for the setup state.

## 4.9 No billing records

Used in:

- No patient bills.
- No receipts.
- No transactions.
- No billing history for a selected patient or visit.

Recommended visual:

- Receipt or invoice.
- A few empty line items.
- Optional small rupee symbol.
- No red color unless the state is genuinely a failed payment.

## 4.10 No inventory or pharmacy stock

Used in:

- No inventory items.
- No pharmacy stock.
- No medicine search results.

Recommended visual:

- Empty box.
- Medicine bottle or package.
- Simple shelf or storage shape.

Do not include realistic medicine brands or detailed labels.

## 4.11 No analytics data

Used in:

- New clinic with no reporting history.
- Analytics filters returning no records.
- Chart with insufficient data.

Recommended visual:

- Simple chart.
- A few incomplete bars or dots.
- Small data card.

Do not use a downward red trend because it suggests that the business is doing
badly. The message should explain that more data is needed.

## 4.12 No medical history or clinical records

Used in:

- Empty patient medical history.
- No clinical records for a visit.
- No documents in a clinical tab.

Recommended visual:

- Medical file.
- Tooth or health record.
- Simple checklist.

For a very small tab view, a normal icon may be better than a full illustration.

## 4.13 No admin requests

Used in:

- No clinic upgrade requests.
- No pending plan changes.
- No operational requests.

Recommended visual:

- Empty task tray.
- Clipboard.
- Soft checkmark.

Do not use a warning triangle for a normal empty queue.

## 4.14 Offline or temporary connection problem

Used in:

- Network disconnected.
- Temporary API failure.
- Retryable connection issue.

Use a separate asset:

```text
state-offline.svg
```

Do not reuse `empty-appointments.svg`, because users may believe their data is
missing rather than temporarily unavailable.

## 4.15 Permission or locked state

Used in:

- User does not have permission to open a feature.
- Feature requires a different plan.
- A clinic section is restricted.

Use a separate asset:

```text
state-permission.svg
```

Recommended visual:

- Shield.
- Lock.
- Small clinic or user symbol.

## 4.16 Success or completed state

Used in:

- Booking completed.
- Profile saved.
- Setup completed.
- Export finished.

Use a separate asset:

```text
state-success.svg
```

Recommended visual:

- Checkmark.
- Completed calendar.
- Soft glow.

## 5. Current application size references

The current code already uses several different display sizes. The design
system should support them without creating a different image for each one.

| Current or expected placement | Approximate display size | Recommended source |
|---|---:|---|
| Small navigation/profile avatar | 28 × 28 px | SVG or 128–256 px raster |
| Doctor dashboard compact avatar | 40 × 40 px | SVG or 256 × 256 raster |
| Clinic information doctor row | 40 × 40 px | SVG or 256 × 256 raster |
| Manage Doctors list | 40–48 × 40–48 px | SVG or 256 × 256 raster |
| Image upload preview | 64 × 64 px | SVG or 256 × 256 raster |
| Public clinic doctor card | 64 × 64 px | SVG or 256 × 256 raster |
| Website preview doctor card | 64 × 64 px | SVG or 256 × 256 raster |
| Doctor dashboard desktop header | 64 × 64 px | SVG or 256 × 256 raster |
| Public doctor profile | 110–130 × 110–130 px | SVG or 320 × 320 raster |
| Standard empty-state artwork | 112–160 × 112–160 px | SVG or 320 × 320 raster |
| Larger onboarding empty state | 180–240 × 180–240 px | SVG or 480–512 px raster |

The preferred approach is to use SVG for designed assets. One SVG can work at
28 px, 64 px, and 160 px without creating multiple copies.

## 6. Image inventory table

The following table is the required design-agent inventory.

### 6.1 Profile and identity assets

| Asset purpose | Preferred filename | Display sizes | Preferred source size | Preferred format | Raster fallback | Target file size | Notes |
|---|---|---:|---:|---|---|---:|---|
| Default doctor profile | `avatar-doctor-default.svg` | 28–130 px | Vector `viewBox="0 0 256 256"` | SVG | `avatar-doctor-default-256.webp` | SVG under 30 KB; WebP under 50 KB | Neutral head-and-shoulders doctor; works in circle and rounded square |
| Default general person | `avatar-person-default.svg` | 28–80 px | Vector `viewBox="0 0 256 256"` | SVG | `avatar-person-default-256.webp` | SVG under 25 KB; WebP under 50 KB | Neutral silhouette; no gender, age, or ethnicity assumptions |
| Default clinic identity | `avatar-clinic-default.svg` | 28–96 px | Vector `viewBox="0 0 256 256"` | SVG | `avatar-clinic-default-256.webp` | SVG under 25 KB; WebP under 50 KB | Clinic, shield, smile, or medical mark; no tiny text |
| Default system identity | `avatar-system-default.svg` | 28–64 px | Vector `viewBox="0 0 256 256"` | SVG | `avatar-system-default-256.webp` | SVG under 25 KB; WebP under 50 KB | Abstract platform/system mark, not a human |
| Doctor photo upload output | `doctor-profile-photo-256.webp` | 40–130 px | 256 × 256 px | WebP | `doctor-profile-photo-256.jpg` only if needed | Prefer under 100 KB | Square crop; face and shoulders; remove metadata |
| Public doctor photo output | `doctor-profile-photo-320.webp` | 110–130 px | 320 × 320 px | WebP | `doctor-profile-photo-320.jpg` only if needed | Prefer under 120 KB | Used only when a larger public profile image needs extra detail |
| Clinic logo fallback source | `clinic-logo-default.svg` | 28–128 px | Vector `viewBox="0 0 512 512"` | SVG | `clinic-logo-default-256.webp` | SVG under 30 KB; WebP under 50 KB | Keep mark centered; do not include unreadable words |

### 6.2 Standard empty-state illustrations

| Scenario | Preferred filename | Display sizes | Preferred source size | Preferred format | Raster fallback | Target file size | Main visual idea |
|---|---|---:|---:|---|---|---:|---|
| No bookings or appointments | `empty-appointments.svg` | 112–160 px | Vector `viewBox="0 0 320 320"` | SVG | `empty-appointments-320.webp` | SVG under 35 KB; WebP under 50 KB | Calendar, search glass, small schedule or clinic detail |
| No search results | `empty-search.svg` | 96–128 px | Vector `viewBox="0 0 320 320"` | SVG | `empty-search-320.webp` | SVG under 30 KB; WebP under 50 KB | Magnifying glass and empty result card |
| No patients | `empty-patients.svg` | 112–144 px | Vector `viewBox="0 0 320 320"` | SVG | `empty-patients-320.webp` | SVG under 35 KB; WebP under 50 KB | Small group of people with optional plus sign |
| No doctors | `empty-doctors.svg` | 96–128 px | Vector `viewBox="0 0 320 320"` | SVG | `empty-doctors-320.webp` | SVG under 35 KB; WebP under 50 KB | Doctor silhouette and clinic/medical badge |
| No billing records | `empty-billing.svg` | 96–128 px | Vector `viewBox="0 0 320 320"` | SVG | `empty-billing-320.webp` | SVG under 30 KB; WebP under 50 KB | Receipt or invoice with empty line items |
| No inventory or pharmacy stock | `empty-inventory.svg` | 96–128 px | Vector `viewBox="0 0 320 320"` | SVG | `empty-inventory-320.webp` | SVG under 30 KB; WebP under 50 KB | Empty box, shelf, medicine bottle, or package |
| No analytics data | `empty-analytics.svg` | 96–128 px | Vector `viewBox="0 0 320 320"` | SVG | `empty-analytics-320.webp` | SVG under 30 KB; WebP under 50 KB | Incomplete chart or data card, not a downward warning chart |
| No medical records | `empty-medical-records.svg` | 80–112 px | Vector `viewBox="0 0 320 320"` | SVG | `empty-medical-records-320.webp` | SVG under 30 KB; WebP under 50 KB | Medical file, tooth, health record, or checklist |
| No admin requests | `empty-admin-requests.svg` | 96–128 px | Vector `viewBox="0 0 320 320"` | SVG | `empty-admin-requests-320.webp` | SVG under 30 KB; WebP under 50 KB | Empty task tray, clipboard, or soft checkmark |

### 6.3 System-state illustrations

| Scenario | Preferred filename | Display sizes | Preferred source size | Preferred format | Raster fallback | Target file size | Main visual idea |
|---|---|---:|---:|---|---|---:|---|
| Offline or retryable connection issue | `state-offline.svg` | 96–144 px | Vector `viewBox="0 0 320 320"` | SVG | `state-offline-320.webp` | SVG under 30 KB; WebP under 50 KB | Cloud, connection line, or retry symbol |
| Permission or locked feature | `state-permission.svg` | 96–144 px | Vector `viewBox="0 0 320 320"` | SVG | `state-permission-320.webp` | SVG under 30 KB; WebP under 50 KB | Shield, lock, and small platform symbol |
| Completed or successful action | `state-success.svg` | 80–144 px | Vector `viewBox="0 0 320 320"` | SVG | `state-success-320.webp` | SVG under 25 KB; WebP under 45 KB | Checkmark, completed calendar, or soft success glow |
| Larger onboarding state | `state-welcome.svg` | 180–240 px | Vector `viewBox="0 0 512 512"` | SVG | `state-welcome-512.webp` | SVG under 45 KB; WebP under 80 KB | Clinic platform welcome or first-setup scene |

### 6.4 Delivery-only previews and documentation

These files are for the design handoff and should not be loaded by the
application.

| Purpose | Preferred filename | Recommended size | Format | Notes |
|---|---|---:|---|---|
| Avatar comparison sheet | `avatar-preview-sheet.png` | 1200 × 800 px | PNG | Show every avatar at 28, 40, 64, and 128 px |
| Empty-state comparison sheet | `empty-state-preview-sheet.png` | 1600 × 1200 px | PNG | Show every illustration with its intended label |
| Light/dark comparison sheet | `light-dark-theme-preview.png` | 1600 × 1000 px | PNG | Show all key assets on light and dark surfaces |
| Asset usage notes | `README.md` | Not applicable | Markdown | Describe purpose, size, format, and theme behavior |

## 7. Standard canvas and composition rules

## 7.1 Avatar canvas

Use a square canvas:

```text
256 × 256
```

For vector artwork:

```xml
viewBox="0 0 256 256"
```

Keep the important subject inside approximately the middle 76–80% of the
canvas. Do not let the head or shoulders touch the edge.

The same avatar should work when clipped as:

- Circle.
- Rounded square.
- Rounded rectangle.

## 7.2 Empty-state canvas

Use a square canvas:

```text
320 × 320
```

For vector artwork:

```xml
viewBox="0 0 320 320"
```

Keep the illustration centered and leave approximately 10–14% empty space
around the subject.

Do not make the artwork so wide that it only works in one dashboard layout.

## 7.3 Larger onboarding canvas

Use a 512 × 512 canvas only for:

- First-time setup.
- Full-page onboarding.
- Large welcome screens.

Do not use 512 px raster assets inside normal 128 px empty states unless there
is a measured reason.

## 7.4 Stroke and detail rules

The artwork must remain clear at small sizes.

Recommended:

- Use rounded stroke caps and joins.
- Use approximately 2–4 px strokes in a 256–320 px vector canvas.
- Avoid very thin 1 px lines for important details.
- Avoid tiny text or micro-labels.
- Use no more than a few major objects.
- Test the asset at 64 px before approving it.

## 8. Color and theme rules

## 8.1 Universal platform palette

Use the following colors as the standard platform-neutral palette:

| Role | Color |
|---|---|
| Main teal | `#0F9B6E` |
| Deep platform green | `#0B2F2A` |
| Secondary teal | `#3CBFA3` |
| Soft mint | `#CDEFE3` |
| Very light mint | `#EAF7F2` |
| Slate outline | `#4D6A66` |
| Dark outline | `#203C38` |
| Soft neutral | `#F2F7F5` |
| White | `#FFFFFF` |

Use the main teal for the important visual signal. Use mint for soft fills and
background shapes. Use slate or dark green for outlines.

## 8.2 Light mode

In light mode, the application can use:

```css
background: linear-gradient(135deg, #EAF7F2 0%, #D8EEE7 100%);
```

The image itself should remain mostly transparent or use very soft fills.

## 8.3 Dark mode

In dark mode, the wrapper can use:

```css
background: linear-gradient(135deg, #0B2F2A 0%, #123E37 100%);
```

The illustration should remain visible without depending on a white rectangle.
Light mint fills and teal outlines can be used to maintain separation.

## 8.4 Different clinic website themes

The platform supports different public clinic themes. The default avatar and
empty-state artwork should remain consistent across those themes.

Do not create one completely different illustration set for every clinic
theme. That increases the asset count and makes the application harder to
maintain.

If theme-specific treatment is required:

- Change the surrounding wrapper color.
- Change the border or ring color.
- Change the button and text color around the image.
- Keep the core artwork neutral.

Only create additional theme variants if a real design review proves that the
universal version is not readable or appropriate.

## 8.5 Avoid strong universal colors

Do not use these as the default platform-wide illustration colors:

- Bright red.
- Neon purple.
- Strong orange.
- Very saturated blue.
- Pure black backgrounds.

Those colors may belong to one public clinic theme but will not work across all
platform surfaces.

## 9. Background, wrapper, and image behavior

The application should provide the image wrapper.

Recommended wrapper behavior:

- `display: flex`
- `align-items: center`
- `justify-content: center`
- `overflow: hidden`
- Rounded corners
- Soft background
- Optional thin border
- Image uses `object-contain`
- No stretching

For the standard empty state:

- Wrapper: approximately 128–160 px.
- Image: approximately 112–144 px inside the wrapper.
- Corner radius: approximately 16–20 px.
- Padding: approximately 8–12 px.

For avatars:

- Let the component choose the final shape.
- The source asset itself should not contain a hard circular crop.
- Keep transparent corners if the asset is intended for both circles and rounded
  squares.

## 10. File-format rules

## 10.1 SVG is preferred for designed artwork

Use SVG for:

- Empty-state illustrations.
- Default avatars.
- System states.
- Clinic fallback symbols.
- Success and permission artwork.

SVG advantages:

- Small file size.
- Sharp at every display size.
- Works on mobile, tablet, and desktop.
- One file can replace many raster copies.

SVG requirements:

- Clean `viewBox`.
- No embedded large raster image.
- No unnecessary design-tool metadata.
- No text converted into hundreds of paths.
- No excessive hidden layers.
- No external font dependency.

## 10.2 WebP is preferred for raster output

Use WebP for:

- Real doctor photos.
- Softly shaded raster fallback artwork.
- Any illustration that cannot be exported cleanly as SVG.

Target sizes:

- Empty-state fallback: under 50 KB.
- Default avatar fallback: under 50 KB.
- Doctor profile photo: ideally under 100 KB.

## 10.3 AVIF is optional

AVIF may be supplied as an optional future optimization, but it should not be
the only delivered format.

If AVIF is supplied, also supply SVG or WebP.

## 10.4 PNG is for source or preview use

PNG may be used for:

- Transparent design masters.
- Preview sheets.
- Handoff previews.

Avoid using PNG as the normal runtime format for simple vector-like artwork.

## 10.5 JPEG is for photographs

Use JPEG only when a real profile photograph requires it and WebP is not
available.

Do not use JPEG for illustrations because:

- It does not support transparency.
- It creates compression artifacts around lines.
- It is usually larger than SVG or WebP for this type of artwork.

## 10.6 Formats to avoid

Do not deliver:

- Animated GIFs.
- Large screenshots as runtime artwork.
- 1024 px images for a 128 px display.
- Files with embedded explanatory text.
- Multiple copies with only minor color differences.

## 11. Performance and application-load rules

The images should support the application without increasing the bundle or
network cost unnecessarily.

## 11.1 Keep the asset count small

The recommended first set is:

- Four profile identity assets.
- Nine standard empty-state assets.
- Four system-state assets.

That is enough to cover the current product without creating a separate image
for every filter message.

## 11.2 Prefer one SVG over many size copies

Do not create separate files such as:

```text
empty-appointments-64.png
empty-appointments-96.png
empty-appointments-128.png
empty-appointments-160.png
```

Prefer:

```text
empty-appointments.svg
empty-appointments-320.webp
```

The SVG can serve all sizes. The WebP is a fallback for environments where a
raster asset is useful.

## 11.3 Recommended runtime limits

| Asset type | Preferred target |
|---|---:|
| Simple SVG icon or avatar | Under 25 KB |
| Detailed SVG illustration | Under 35–45 KB |
| Standard empty-state WebP | Under 50 KB |
| Default avatar WebP | Under 50 KB |
| Uploaded doctor photo | Ideally under 100 KB |
| Larger onboarding WebP | Under 80 KB |

## 11.4 Do not load all illustrations at startup

The application should not import every image into the first page bundle if
that can be avoided.

Preferred behavior:

- Load a small asset when the relevant state is rendered.
- Keep normal SVG imports small.
- Do not create a large sprite sheet unless it is measured to be better.
- Do not preload admin-only or analytics-only artwork on public pages.

## 11.5 Uploaded photos

The existing application already treats doctor profile photos as a limited
upload. Design assets should be much smaller than the maximum upload limit.

For uploaded photos:

- Square-crop where possible.
- Remove EXIF metadata.
- Compress to WebP.
- Limit the runtime image to around 256–320 px for avatar use.
- Do not preserve a 2000 px camera image for a 64 px avatar.

## 12. Folder structure for delivery

Ask the design agent to place the final deliverables under:

```text
attached_assets/platform-avatar-system/
```

Use this structure:

```text
attached_assets/
└── platform-avatar-system/
    ├── README.md
    ├── source/
    │   ├── avatar-source-files/
    │   ├── empty-state-source-files/
    │   └── system-state-source-files/
    ├── final/
    │   ├── avatars/
    │   │   ├── avatar-doctor-default.svg
    │   │   ├── avatar-person-default.svg
    │   │   ├── avatar-clinic-default.svg
    │   │   ├── avatar-system-default.svg
    │   │   └── clinic-logo-default.svg
    │   ├── empty-states/
    │   │   ├── empty-appointments.svg
    │   │   ├── empty-search.svg
    │   │   ├── empty-patients.svg
    │   │   ├── empty-doctors.svg
    │   │   ├── empty-billing.svg
    │   │   ├── empty-inventory.svg
    │   │   ├── empty-analytics.svg
    │   │   ├── empty-medical-records.svg
    │   │   └── empty-admin-requests.svg
    │   └── system-states/
    │       ├── state-offline.svg
    │       ├── state-permission.svg
    │       ├── state-success.svg
    │       └── state-welcome.svg
    ├── raster-fallbacks/
    │   ├── avatar-doctor-default-256.webp
    │   ├── avatar-person-default-256.webp
    │   ├── avatar-clinic-default-256.webp
    │   ├── avatar-system-default-256.webp
    │   ├── empty-appointments-320.webp
    │   ├── empty-search-320.webp
    │   ├── empty-patients-320.webp
    │   ├── empty-doctors-320.webp
    │   ├── empty-billing-320.webp
    │   ├── empty-inventory-320.webp
    │   ├── empty-analytics-320.webp
    │   └── empty-medical-records-320.webp
    └── previews/
        ├── avatar-preview-sheet.png
        ├── empty-state-preview-sheet.png
        └── light-dark-theme-preview.png
```

The folder above is the **design handoff and archive location**. It should
remain available for future design review, source files, previews, and the
original supplied package. It is not the preferred runtime source location for
the React application.

```text
attached_assets/platform-avatar-system/final/
```

The `source`, `raster-fallbacks`, `previews`, and ZIP files are handoff
materials. They should not automatically become part of the runtime asset
bundle.

Use lowercase kebab-case names. Avoid names such as:

```text
New Avatar Final 2.png
doctor latest final FINAL.png
image1.png
```

Prefer names such as:

```text
avatar-doctor-default.svg
empty-appointments.svg
state-offline.svg
```

## 12.1 Central runtime location under `client`

The approved application-owned SVGs should be copied into:

```text
client/src/assets/platform-avatar-system/
```

The runtime structure should be:

```text
client/
└── src/
    └── assets/
        └── platform-avatar-system/
            ├── avatars/
            │   ├── avatar-doctor-default.svg
            │   ├── avatar-person-default.svg
            │   ├── avatar-clinic-default.svg
            │   └── avatar-system-default.svg
            ├── empty-states/
            │   ├── empty-appointments.svg
            │   ├── empty-search.svg
            │   ├── empty-patients.svg
            │   ├── empty-doctors.svg
            │   ├── empty-billing.svg
            │   ├── empty-inventory.svg
            │   ├── empty-analytics.svg
            │   └── empty-medical-records.svg
            ├── system-states/
            │   ├── state-offline.svg
            │   ├── state-permission.svg
            │   └── state-success.svg
            └── index.ts
```

The runtime folder is the single source of truth for approved built-in
application artwork. The design handoff folder remains the source of truth for
the original delivery and future design revisions.

### Why `client/src/assets` is preferred

The current frontend uses Vite with `client/` as its root. Imported files under
`client/src/assets` are processed by Vite and emitted into the production
asset directory with hashed filenames.

This gives the application:

- Correct production bundling.
- Cache-safe filenames when an SVG changes.
- No stale long-lived browser cache after an asset replacement.
- TypeScript-compatible imports through the existing `@/` source alias.
- A clear relationship between a component and the asset it uses.
- No need to create fixed public URLs for internal UI illustrations.

The production server serves generated Vite assets from `dist/public/assets`
with a long immutable cache lifetime. Hashed filenames make that long cache
safe: a changed SVG gets a new filename.

### Why these assets should not stay only in `attached_assets`

The repository's `attached_assets/` directory is currently a mixed intake and
handoff location. It contains screenshots, audit files, design references,
large images, and uploaded packages in addition to application images.

Keeping the runtime suite only there would make it difficult to determine:

- Which files are actually used by the application.
- Which files are design references only.
- Which files can be safely removed.
- Which assets should be included in the production build.
- Which asset should be updated when a design revision arrives.

The existing Vite alias also maps `@assets` to the broad `attached_assets`
directory. That alias is useful for existing legacy imports, but it should not
become the convention for new platform artwork. The TypeScript path
configuration already supports `@/*` for `client/src/*`, so new imports should
use `@/assets/...`.

### Why these assets should not go in `client/public`

The application already uses `client/public` for stable root-level files such
as:

```text
client/public/icons/
client/public/ads/
client/public/doctor-hero.png
```

That location is appropriate for:

- Favicons.
- Apple touch icons.
- PWA icons.
- Open Graph images.
- Stable public files referenced directly by HTML.

The avatar and empty-state suite is component-owned application artwork. It
does not need a manually typed URL such as:

```tsx
<img src="/assets/platform-avatar-system/empty-appointments.svg" />
```

Using `client/src/assets` imports lets Vite manage the final URL and cache
identity automatically.

### Central catalog file

All approved built-in artwork should be re-exported from:

```text
client/src/assets/platform-avatar-system/index.ts
```

The catalog should use named exports:

```ts
export { default as avatarDoctorDefault } from "./avatars/avatar-doctor-default.svg";
export { default as avatarPersonDefault } from "./avatars/avatar-person-default.svg";
export { default as avatarClinicDefault } from "./avatars/avatar-clinic-default.svg";
export { default as avatarSystemDefault } from "./avatars/avatar-system-default.svg";

export { default as emptyAppointments } from "./empty-states/empty-appointments.svg";
export { default as emptySearch } from "./empty-states/empty-search.svg";
export { default as emptyPatients } from "./empty-states/empty-patients.svg";
export { default as emptyDoctors } from "./empty-states/empty-doctors.svg";
export { default as emptyBilling } from "./empty-states/empty-billing.svg";
export { default as emptyInventory } from "./empty-states/empty-inventory.svg";
export { default as emptyAnalytics } from "./empty-states/empty-analytics.svg";
export { default as emptyMedicalRecords } from "./empty-states/empty-medical-records.svg";

export { default as stateOffline } from "./system-states/state-offline.svg";
export { default as statePermission } from "./system-states/state-permission.svg";
export { default as stateSuccess } from "./system-states/state-success.svg";
```

Components should import from the catalog:

```tsx
import { emptyAppointments } from "@/assets/platform-avatar-system";
```

The catalog must not be imported globally from `App.tsx` or another always
loaded application-shell file. Each feature should import only the asset it
needs. This keeps asset ownership clear and prevents future artwork additions
from becoming part of every route's initial dependency graph.

### Feature ownership rules

Use the following ownership mapping:

| Feature | Allowed asset import |
|---|---|
| `BookingsPanel.tsx` | `emptyAppointments` |
| `PatientDirectoryPanel.tsx` | `emptyPatients` or `emptySearch` |
| `ManageDoctorsPanel.tsx` | `emptyDoctors` and `avatarDoctorDefault` |
| `ClinicAnalyticsPanel.tsx` | `emptyAnalytics` |
| `AccountsPanel.tsx` or billing views | `emptyBilling` |
| `InventoryPanel.tsx` or `PharmacyStockPanel.tsx` | `emptyInventory` |
| `MedicalHistoryTab.tsx` or clinical record views | `emptyMedicalRecords` |
| `NetworkStatusBanner.tsx` or a retry state | `stateOffline` |
| Restricted feature surfaces | `statePermission` |
| Save/completion feedback | `stateSuccess` |

This mapping is guidance for future implementation. It does not authorize
moving or editing files by itself.

### Keep user-uploaded images separate

The runtime SVG suite is for built-in product artwork only. It must not be used
as a storage location for uploaded content.

Keep these outside `client/src/assets`:

- Doctor-uploaded profile photographs.
- Clinic-uploaded logos.
- Clinic hero images.
- Social gallery images.
- Patient documents.
- Any image whose URL or content is controlled by a clinic user.

Those images should continue to be represented by their stored URL and handled
through the existing upload/storage flow. A component may use a built-in SVG
fallback when the stored URL is missing, but the uploaded image itself does
not become part of the frontend source tree.

### Runtime placement decision

For this suite, the approved decision is:

```text
Design archive:
attached_assets/platform-avatar-system/

Runtime application source:
client/src/assets/platform-avatar-system/

Existing browser/application icons:
client/public/icons/

User-uploaded images:
existing storage/R2 URL flow
```

Do not create a second runtime copy under `client/public/assets/` unless a
future requirement specifically needs a stable URL outside the React bundle.

## 13. Accessibility requirements

The image must not be the only way users understand the state.

For empty states:

- Use a real heading below or beside the artwork.
- Use a short explanation.
- Provide an action when one exists.
- Do not communicate meaning through color alone.
- Use meaningful `alt` text if the image adds information.
- Use `alt=""` if the image is decorative and the text already explains the
  state.

Examples:

```text
No bookings today
No slots are booked for today. Check Upcoming for future appointments.
```

```text
No patients yet
Patients will appear here after their first booking.
```

```text
No results found
Try changing the search term or clearing the filters.
```

For a meaningful default avatar:

```text
alt="Doctor profile placeholder"
```

For a decorative background inside an avatar component:

```text
alt=""
```

The image should not contain important information that cannot be read by
screen readers or understood from the surrounding text.

## 14. Design-agent acceptance checklist

The design handoff is complete when:

- [ ] Profile avatars and empty-state illustrations are separate asset
      families.
- [ ] The supplied booking illustration has an improved reusable replacement.
- [ ] The artwork uses the universal teal/mint platform palette.
- [ ] The artwork works on light and dark surfaces.
- [ ] The artwork does not depend on one clinic's custom theme.
- [ ] The important subject remains visible at 64 px.
- [ ] No artwork contains explanatory text.
- [ ] SVG is supplied for designed assets.
- [ ] WebP fallback is supplied where a raster fallback is useful.
- [ ] File names follow lowercase kebab-case.
- [ ] Standard empty states use a 320 × 320 source canvas.
- [ ] Standard avatars use a 256 × 256 source canvas.
- [ ] Large onboarding artwork uses a 512 × 512 source canvas only when needed.
- [ ] Standard illustrations are preferably under 50 KB.
- [ ] Real profile photos are preferably under 100 KB.
- [ ] Light, dark, and intended-size preview sheets are supplied.
- [ ] The design handoff files are in `attached_assets/platform-avatar-system/final/`.
- [ ] Approved runtime copies are in `client/src/assets/platform-avatar-system/`.
- [ ] The runtime catalog is in `client/src/assets/platform-avatar-system/index.ts`.
- [ ] A `README.md` explains the purpose and intended usage of every file.

## 15. Recommended first delivery

The design agent does not need to design every possible state before the first
review. The best first delivery is:

### Profile assets

```text
avatar-doctor-default.svg
avatar-person-default.svg
avatar-clinic-default.svg
avatar-system-default.svg
```

### Empty-state assets

```text
empty-appointments.svg
empty-search.svg
empty-patients.svg
empty-doctors.svg
empty-billing.svg
empty-inventory.svg
empty-analytics.svg
empty-medical-records.svg
```

### System-state assets

```text
state-offline.svg
state-permission.svg
state-success.svg
```

The most important review item is:

```text
empty-appointments.svg
```

It should be a stronger, cleaner, futuristic version of the supplied calendar
and search illustration.

The second most important review item is:

```text
avatar-doctor-default.svg
```

It should use the same teal/mint language while remaining clear inside a
circular avatar.

## 16. Ready-to-send brief for the design agent

> Design a small, reusable avatar and empty-state illustration system for a
> futuristic healthcare and clinic-management platform.
>
> Use a calm, minimal, rounded visual style with teal, deep green, mint, soft
> neutral, and slate colors. The style should feel modern and slightly
> futuristic through subtle orbit rings, grid details, glowing dots, and clean
> geometry—not through robots, complex 3D scenes, or cartoon characters.
>
> Create two separate families:
>
> 1. Profile fallbacks:
>    - Neutral doctor avatar.
>    - Neutral person avatar.
>    - Clinic avatar.
>    - System/admin avatar.
>
> 2. Empty states:
>    - No appointments.
>    - No search results.
>    - No patients.
>    - No doctors.
>    - No billing records.
>    - No inventory.
>    - No analytics data.
>    - No medical records.
>    - No admin requests.
>
> Also create separate system states for offline, permission denied, success,
> and optional first-time welcome.
>
> Use transparent SVG as the primary format. Provide WebP fallbacks for
> standard illustrations at approximately 320 × 320 and avatar fallbacks at
> approximately 256 × 256. Keep empty-state illustrations under 50 KB and
> avatar fallbacks under 50 KB where possible.
>
> Do not include text inside the artwork. Keep the important subject inside the
> central 76–80% safe area. Make every illustration readable at 64 px and
> visually comfortable at 128–160 px.
>
> Place final deliverables under:
>
> `attached_assets/platform-avatar-system/final/`
>
> Use lowercase kebab-case filenames. Include light-mode and dark-mode
> previews, plus a preview sheet showing the intended sizes.
>
> The assets should work across public clinic pages, clinic dashboards, doctor
> dashboards, admin screens, mobile screens, tablet screens, and desktop
> screens without creating separate theme-specific copies.