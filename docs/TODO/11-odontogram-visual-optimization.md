# Odontogram Visual Optimization — Implementation Plan

**Status:** Implementation complete through Step 14 — authenticated clinical review pending
**Audience:** Clinic owners, doctors, product reviewers, and developers
**Primary area:** Doctor Admin → Charts → Odontogram
**Reference material:** `attached_assets/Pasted--Based-on-your-requirements-I-ll-create-optimized-tooth_1788024916171.txt`

## 1. What this plan is intended to do

The odontogram is the dental tooth chart that doctors use to see and record a
condition for each tooth. The current chart works, but the drawings are fairly
generic: most teeth in the same family look alike, and the roots and chewing
surfaces do not yet show much difference between tooth positions.

This plan describes how to make the chart look more natural and easier to
understand without changing the information already saved for patients.

The improvement will focus on:

- Making each tooth type look recognisable at a glance.
- Showing sensible differences between incisors, canines, premolars, and
  molars.
- Showing upper and lower teeth in the correct orientation.
- Making the drawing more useful on laptop screens and narrow popups.
- Keeping existing conditions, history, permissions, save behavior, and
  patient records safe.

The goal is a clearer professional illustration, not a replacement for a
clinical examination, X-ray, or diagnostic record.

## 2. Important current-state findings

Before implementation, the following facts must be treated as the baseline:

1. The current component is `client/src/components/OdontogramTab.tsx`.
2. The chart uses FDI tooth numbers, including teeth 11–18, 21–28, 31–38, and
   41–48.
3. The saved record stores a condition, a note field, and visit history for
   each tooth.
4. The saved chart belongs to a patient and clinic. It is not a separate chart
   for every booking.
5. The server already protects chart access so that only the assigned doctor
   can read or update the chart.
6. The current chart already has selection, condition editing, history, zoom,
   missing-tooth marks, save behavior, and read-only mode.
7. The current chart is tooth-level. It does not record separate surfaces such
   as mesial, distal, buccal, lingual, or occlusal findings.
8. The uploaded proposal contains repeated/generated sections and sample code
   that must be treated as design reference, not copied directly.
9. The current production build and Build Check pass. Existing non-blocking
   environment warnings remain outside this visual-only change.

## 3. Decisions that protect existing patient records

The implementation must follow these rules:

- Do not change the `patient_charts` table.
- Do not change the chart API request or response shape.
- Do not rename existing condition values.
- Do not remove or rewrite existing visit history.
- Do not change which doctor is allowed to access a chart.
- Do not add a new dependency just for tooth drawings.
- Keep tooth anatomy as derived visual information based on the FDI number.
- Keep anatomy marks presentation-only; they must not be stored as diagnoses.
- Keep all existing `data-testid` values used by tests or automation.
- Keep the existing lifecycle rule that completed, cancelled, no-show, and
  early-exit visits cannot be edited.
- If a visual change could make a condition harder to recognise, the
  existing condition color, border, missing mark, or selection state wins over
  visual realism.

## 4. Step-by-step implementation plan

### Step 0 — Record and protect the current baseline

**What will happen**

1. Confirm the current files and chart routes before editing:
   - `client/src/components/OdontogramTab.tsx`
   - `client/src/pages/DoctorDashboard.tsx`
   - `server/routes.ts`
   - `server/storage.ts`
   - `shared/schema.ts`
2. Confirm that the existing chart still loads, selects teeth, edits
   conditions, displays history, and saves changes.
3. Repair the unrelated malformed billing JSX in
   `client/src/components/BillingHistoryPanel.tsx`.
4. Run the Build Check and record a successful production build before starting
   the odontogram work.

**Why this matters**

If the build is already broken, a later failure cannot be reliably attributed
to the odontogram changes.

**What must not change**

- No billing behavior, totals, tax behavior, or payment workflow.
- No chart data or database structure.

### Step 1 — Confirm the tooth numbering and screen layout

**What will happen**

1. Create a written reference table for all 32 FDI teeth.
2. Confirm which teeth appear in each quadrant:
   - Q1: upper right
   - Q2: upper left
   - Q3: lower left
   - Q4: lower right
3. Confirm that the screen order is from the doctor’s viewing perspective.
4. Confirm that upper roots point upward and lower roots point downward.
5. Check the center line and the spacing between neighboring teeth.

**Why this matters**

The chart must never make a correct tooth number appear on the wrong side or
in the wrong quadrant.

**Approval check**

A reviewer should be able to point to any number and identify its quadrant
without relying only on the color of the tooth.

### Step 2 — Create a simple tooth reference guide

**What will happen**

For each FDI tooth, record only the visual information needed to draw it:

- Tooth family: incisor, canine, premolar, or molar
- Relative crown width
- Relative crown height
- Relative root length
- Number of visible roots
- Whether the tooth has a pointed cusp
- Whether it has two cusps
- Whether it has four or five molar cusps
- Whether an upper-molar ridge should be shown
- Whether the tooth should be slightly narrower or wider than its neighbor
- Gentle natural curvature direction where appropriate

This information should live in one clearly named anatomy configuration rather
than being repeated in many drawing functions.

**Why this matters**

The drawing can become more detailed without filling the main component with
many unrelated numbers and special cases.

**Important limitation**

These values are relative illustration settings. They are not intended to
represent a patient’s measured tooth dimensions.

### Step 3 — Agree on the visual language before drawing every tooth

**What will happen**

Define how each visual element should communicate:

- Healthy tooth: light neutral fill with a clear outline
- Caries: existing red condition treatment
- Filled: existing blue condition treatment
- Crown: existing gold/yellow condition treatment
- Missing: existing grey treatment and cross mark
- Implant: existing green condition treatment
- Bridge: existing purple condition treatment
- RCT: existing orange condition treatment
- Sealant: existing cyan condition treatment
- Selected tooth: existing green selection ring
- Recently edited tooth: existing visit indicator
- Historical tooth: existing history indicator

The anatomical grooves and cusps should use a subtle line treatment that does
not overpower the condition color.

**Why this matters**

Doctors should be able to identify the recorded condition before noticing the
decorative anatomical details.

**Accessibility rule**

No condition may be communicated by color alone. The legend and selected
tooth panel must continue to include text labels, and any new visual marker
must have a corresponding accessible description.

### Step 4 — Improve the crown shape by tooth family

**What will happen**

Update the crown drawing helpers so that:

1. **Incisors**
   - Have a softly tapered shape instead of a plain rectangle.
   - Use a slightly wider central incisor and a slightly narrower lateral
     incisor.
   - Have a gently curved incisal edge.

2. **Canines**
   - Have a distinct central cusp.
   - Show two gentle slopes from the cusp.
   - Be taller and more tapered than premolars.

3. **Premolars**
   - Show two controlled cusps.
   - Include a small central groove.
   - Allow the first premolar to have a stronger buccal cusp than the second.

4. **Upper molars**
   - Show four main cusp areas.
   - Include a restrained oblique ridge.
   - Keep the first molar visibly broader than the second and third molars.

5. **Lower molars**
   - Show the characteristic lower-molar cross or cruciate groove pattern.
   - Allow the first lower molar to look slightly broader and more complex than
     the second molar.

6. **Third molars**
   - Look smaller and less regular.
   - Avoid making them look like exact copies of second molars.

**What must be checked**

- No groove or cusp line may spill outside its crown.
- A condition fill must remain readable underneath the anatomy.
- The tooth number must remain visually attached to the correct tooth.
- The anatomy must remain understandable at the smallest supported width.

### Step 5 — Improve the roots carefully

**What will happen**

1. Keep one root for incisors and canines.
2. Keep selected premolars as one root unless a two-root illustration clearly
   improves recognition.
3. Show two separated roots for lower molars.
4. Show three roots for upper molars where the drawing has enough room:
   two narrower buccal roots and one wider palatal root.
5. Add gentle, limited root curvature rather than perfectly straight,
   identical roots.
6. Keep the furcation visible under every condition color.
7. Keep root lengths balanced so roots do not collide with the chart border,
   center line, quadrant labels, or neighboring teeth.

**Why this matters**

The uploaded plan correctly identifies root variation as one of the biggest
visual differences between tooth families, but excessive detail could make the
chart crowded or misleading.

**Safety rule**

Root drawings are illustrative only. They must not be presented as a finding
about the patient’s actual root anatomy.

### Step 6 — Add position-specific variation without duplicating code

**What will happen**

The anatomy guide will provide the differences needed for all 32 teeth while
sharing the same drawing logic. For example:

- 11 and 21 use similar central-incisor proportions.
- 12 and 22 are slightly narrower laterals.
- 13 and 23 are longer canines.
- 16 and 26 are broad first molars.
- 18 and 28 are smaller, more variable third molars.
- The lower first molars 36 and 46 are broader than 37 and 47.

The left and right sides should be mirrored or direction-aware where needed,
rather than maintaining separate copies of the same drawing code.

**Why this matters**

One shared drawing system is easier to maintain and reduces the chance that
one side of the mouth behaves differently from the other.

### Step 7 — Preserve condition and history behavior

**What will happen**

After the drawings are updated, verify each existing state:

- Healthy
- Caries
- Filled
- Crown
- Missing
- Implant
- Bridge
- RCT
- Sealant
- Selected
- Recently edited
- Has history

The missing-tooth cross must remain visible. The condition picker must still
change only the condition, and Save Chart must continue to append the same
kind of visit history.

**What must not change**

- Existing condition names
- Existing chart JSON keys
- Existing history entries
- Existing save endpoint
- Existing success and error feedback

### Step 8 — Allow read-only doctors to inspect a tooth

**What will happen**

Read-only visits should still allow a doctor to select a tooth and see:

- Tooth number
- Tooth name
- Current recorded condition
- Visit history
- Existing notes, when present

Read-only visits must not show usable editing controls or allow Save Chart.
Active visits should keep the current editing flow.

**Why this matters**

A completed or otherwise read-only visit should prevent editing, but it should
not prevent a doctor from reviewing the patient’s chart.

### Step 9 — Improve touch and keyboard use

**What will happen**

1. Keep each tooth selectable with mouse, touch, and keyboard.
2. Increase small zoom and close controls to the project’s minimum touch size.
3. Make selected condition buttons expose their selected state to assistive
   technology.
4. Keep a visible focus ring for every interactive element.
5. Ensure the chart does not require color vision to understand its state.
6. Retain accessible labels such as “Tooth 16, upper right first molar.”

**Why this matters**

Doctors may use the chart on a touch device, and keyboard users must be able
to move through the same workflow.

### Step 10 — Make the layout responsive

**What will happen**

Review the chart at the required widths:

- 375px phone
- 390px phone
- 430px large phone
- 768px tablet
- 1024px small laptop or landscape tablet
- 1280px primary laptop target
- 1440px wide laptop

At narrow widths:

- The page itself must not scroll horizontally.
- Only the chart’s own bounded area may scroll if the tooth labels need more
  room.
- The condition picker must wrap without clipping.
- The save footer must remain visible when editing.
- The legend must wrap into readable rows.

At laptop widths:

- The chart should use the available space without looking too small.
- Quadrant labels, midlines, teeth, legend, and picker should feel like one
  organized panel.

### Step 11 — Check color and dark-mode behavior

**What will happen**

Review the chart in light and dark modes. Condition colors must remain
distinguishable, and text must remain readable.

New colors should use the project’s existing semantic design tokens wherever
possible. If SVG-specific colors are required, they should be centralized in
one place and checked for contrast rather than scattered throughout the
component.

**Why this matters**

Adding more isolated color values would make future theme changes harder and
could create unreadable condition states.

### Step 12 — Confirm the server and data boundary remains unchanged

**What will happen**

Confirm that the following continue to work without new routes or migrations:

1. Doctor authentication is required.
2. The doctor must be assigned to the booking.
3. The chart is read from the correct patient and clinic.
4. The chart is saved to the same patient and clinic.
5. A chart opened from another booking for the same patient still shows the
   same patient-level chart.
6. The server continues to reject invalid access.

Only if a future requirement introduces surface-level findings should the data
model be reconsidered. That would be a separate project and must not be mixed
into this visual-only upgrade.

### Step 13 — Run focused functional checks

**What will happen**

Test the complete doctor workflow:

1. Open an active appointment.
2. Open Charts → Odontogram.
3. Select every tooth family at least once.
4. Set a condition.
5. Change a condition back to healthy.
6. Edit several teeth before saving.
7. Save the chart.
8. Reload the chart and verify the conditions remain.
9. Open the history for a changed tooth.
10. Open the same patient through another booking and verify the chart remains
    patient-level.
11. Open a completed or read-only visit and verify inspection works but editing
    and saving do not.
12. Test keyboard selection and keyboard condition editing.
13. Test zoom, reset, and narrow-screen scrolling.

### Step 14 — Complete the required quality checks

After every application-code change:

1. Run the Build Check workflow and require exit code 0.
2. Run the TypeScript check.
3. Check for duplicate exported names before introducing any new shared type or
   constant.
4. Check that no bare API fetch or hardcoded localhost URL was introduced.
5. Check that no debug logging remains in touched files.
6. Run `git diff --check`.
7. Review the changed file for accidental changes to API payloads,
   permissions, or test IDs.

Before calling the feature complete:

- Verify all required viewport widths.
- Verify light and dark modes.
- Verify all condition states.
- Verify read-only and editable visits.
- Verify keyboard and touch behavior.
- Verify a production Build Check success.

### Step 15 — Perform a clinical-safety and product review

Before release, a doctor or clinic reviewer should confirm:

- Tooth numbering is correct.
- Upper and lower arches are not confusing.
- Left and right sides are clearly labelled.
- Conditions remain easier to identify than before.
- The chart does not look like an X-ray or claim to show patient-specific
  anatomy.
- The added detail does not slow down selecting a tooth.
- The chart remains usable when many teeth have conditions.

Any detail that causes confusion should be simplified, even if it looks more
anatomically realistic.

## 5. Explicitly out of scope

The following items are not part of this implementation:

- Surface-level diagnosis recording
- Periodontal charting
- X-ray or radiographic rendering
- Automatic diagnosis
- AI-generated dental findings
- A new tooth chart database structure
- A new chart route or authentication system
- New billing, appointment, or patient-record behavior
- Replacing the existing chart with a third-party dental chart library
- Adding a separate “tax,” “diagnosis,” or “anatomy” database field

These may be considered later as separate, clinically reviewed projects.

## 6. Completion criteria in plain language

The work is ready for approval only when all of the following are true:

- The chart still loads for the correct doctor and patient.
- All 32 tooth numbers are in the correct positions.
- Each tooth family looks meaningfully different without becoming busy.
- Existing condition colors and labels remain clear.
- Missing teeth remain obvious.
- Existing history and save behavior still work.
- Read-only doctors can review teeth but cannot edit them.
- Touch and keyboard users can operate the chart.
- The chart works from a small phone-sized popup through a desktop laptop.
- The page does not gain horizontal scrolling.
- No application-code change leaves the Build Check failing.
- A doctor confirms that the drawing is helpful and not misleading.

## 7. Current validation status

The implementation portion of the odontogram optimization is complete. The
remaining approval item is an authenticated doctor/clinical review of the
illustration and full account-backed workflow.

- Step 0, baseline and boundary protection: **complete**
- Step 1, FDI numbering and screen layout: **complete**
- Step 2, centralized tooth reference guide: **complete**
- Step 3, visual language: **complete**
- Step 4, crown shape by tooth family: **complete**
- Step 5, root geometry and mirroring: **complete**
- Step 6, position-specific guide-driven variation: **complete**
- Step 7, condition/history/save preservation: **complete**
- Step 8, read-only tooth inspection: **complete**
- Step 9, touch and keyboard use: **complete**
- Step 10, responsive chart layout: **implemented; authenticated viewport review pending**
- Step 11, light/dark semantic SVG neutrals: **complete; authenticated theme review pending**
- Step 12, server/data boundary: **unchanged and verified by diff review**
- Step 13, focused workflow behavior: **implemented; signed-in workflow review pending**
- Step 14, quality gates: **complete**
- Step 15, clinical-safety/product review: **pending doctor or clinic reviewer**
- Database migration: **not required**
- New dependency: **not added**
- Start application workflow: **running**
- TypeScript check: **passing**
- Production build: **passing with existing non-blocking warnings**
- Reference-table audit: **32 unique FDI teeth, 8 per quadrant**
- Duplicate-export, URL, localhost, and debug-code scans: **passing**
- `git diff --check`: **passing**
- Authenticated doctor visual/clinical review: **pending**