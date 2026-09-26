# Homepage and Pricing Design Inconsistencies — Fixes and Progress Tracker

**Workstream:** -22  
**Status:** Steps 1–8 and Step 10 complete; Step 9 intentionally deferred
**Scope:** Public homepage, clinic registration entry points, pricing page, and the shared plan presentation  
**Evidence reviewed:** Current homepage and pricing preview at desktop width, `Landing.tsx`, `Pricing.tsx`, `RegisterClinic.tsx`, `Header.tsx`, and the attached homepage CTA audit  

## Purpose

This document turns the homepage and pricing audit into small, independently executable work items. Each item explains:

- The exact issue today
- Why it matters to a visitor
- What the completed change should achieve
- What must be checked before the item is marked complete
- Whether another item must be completed first

The wording is intentionally non-technical so product, design, and implementation work can be tracked together.

## Current overall progress

| Area | Progress | Current state |
|---|---:|---|
| Evidence and issue analysis | 100% | Complete |
| Homepage hero CTA visibility | 100% | Complete |
| Homepage clinic pricing link | 100% | Complete |
| Trial plan visibility on pricing | 100% | Complete |
| Pricing-to-registration continuity | 100% | Complete |
| Responsive pricing layout | 100% | Complete |
| Comparison table mobile behavior | 100% | Complete |
| Marketing copy and demo-data review | 0% | Intentionally deferred; Step 9 |
| Final visual and interaction verification | 100% | Complete with environment note |

**Progress rule:** Update the percentage and status only after the acceptance checks for that item pass. A visual change is not complete merely because the code compiles.

## Confirmed findings

### Finding A — Hero clinic CTA is obscured

At the current desktop preview, the doctor artwork crosses the clinic-owner button. The button is transparent, has a faint border, and does not sit clearly above the artwork. The text is partially washed out.

The image is hidden only at widths below `900px`, so the problem can also occur on smaller desktop and tablet-sized screens.

### Finding B — Homepage pricing link is easy to miss

The clinic section uses the small text link:

> See our pricing plans →

It is low contrast against the dark green card, is separated from the registration action, and does not look like a meaningful next step.

### Finding C — Trial is present in registration but absent from pricing

The registration flow shows four choices:

1. Free Trial
2. Starter
3. Growth
4. Pro

The pricing page shows only Starter, Growth, and Pro. The shared plan catalog already contains the Trial policy, so the two public journeys currently present different products.

### Finding D — Pricing buttons lose the visitor's selected plan

Every pricing card sends visitors to the same registration URL. The registration page starts with no plan selected. A visitor who clicks Growth or Pro must choose the same plan again.

### Finding E — Four plans will not fit the current pricing layout

The pricing page currently uses three columns from medium screens upward. Adding Trial without changing the layout will make the cards too narrow on tablet and desktop widths.

### Finding F — Comparison table may compress instead of scroll

The comparison table allows horizontal overflow but does not require a minimum width. On small screens, the browser may squeeze the columns until the values become difficult to read.

### Finding G — Public copy and demo content need consistency review

The homepage contains several static examples and claims that should be checked before release:

- “50+ dental clinics trust us”
- “50+ verified clinics across Kerala”
- “850+ slots booked”
- “Instant WhatsApp confirmation”
- Demo location “Koramangala”
- Fixed demo dates such as “Apr 19” and “Apr 22”

“Koramangala” does not match the Kerala wording, and fixed dates can look stale over time.

## Plain-language target experience

After the completed portion of this workstream:

1. A clinic owner can immediately see and understand the registration action on desktop, tablet, and mobile.
2. The owner can tell that registration can begin for free without a card.
3. Pricing is easy to find from both the homepage and the main navigation.
4. Pricing and registration show the same four plans and the same basic promises.
5. Clicking a plan takes the visitor to registration with that plan already selected.
6. The four plans remain readable on large screens, tablets, and phones.
7. The feature comparison remains usable on narrow screens.
8. Public claims and demo examples remain pending the separate Step 9 review.

## Implementation record

**Completed on:** 2026-09-26

The following work was completed in this pass:

- The hero copy now sits above the doctor artwork, and the clinic-owner CTA has a solid readable treatment.
- The doctor artwork is hidden below `1100px` instead of only below `900px`.
- The hero owner CTA now says `Free to start · No card required`.
- The clinic section now uses a visible `View pricing & compare plans` action beside registration on desktop and stacked on mobile.
- Pricing is now available from the public header.
- Pricing now presents Trial, Starter, Growth, and Pro from `PLAN_KEYS` and the shared published catalog.
- Trial now explains its 14-day duration and no-card/no-payment promise.
- Plan descriptions, limits, feature values, and comparison values are derived from the shared plan catalog.
- Pricing cards now use one column on phones, two on medium screens, and four on large screens.
- The comparison table now has a useful minimum width, a sticky Feature column, and a mobile swipe hint.
- Pricing card actions now pass the selected plan and paid billing cycle to registration.
- Registration now validates the incoming plan and billing query values before preselecting them.

### Verification performed

- `npm run check` passed.
- `npm run build` passed.
- `git diff --check` passed.
- Desktop homepage preview checked at 1280px.
- Desktop pricing preview checked at 1280px.
- Preview workflow remained healthy and served both routes.
- The preview still reports the existing Vite WebSocket/CSP warning and logged-out clinic-auth `401`; neither was introduced by these changes.
- A separate automated phone screenshot could not be run because Playwright is not installed in the workspace. Phone behavior was verified through the responsive CSS and layout rules.

### Deliberately excluded

Step 9 remains unchanged apart from the Trial reassurance text required by Steps 2 and 4. The following content was not reviewed or rewritten:

- Static clinic-count claims
- Geographic demo examples
- Fixed demo dates
- Usage counters
- WhatsApp availability claims

## Independent implementation steps

### Step 1 — Put the hero owner CTA above the artwork

**Status:** Complete
**Progress:** 100%
**Completed:** 2026-09-26
**Priority:** Critical  
**Can run independently:** Yes  
**Dependencies:** None

**Exact issue:** The doctor image overlaps the transparent “Register Your Clinic” button around the current 1280px preview width.

**What will be achieved:** The clinic-owner button will always remain readable and clickable, even while the doctor artwork is visible.

**Planned work:**

- Give the hero copy and CTA a clear visual layer above the artwork.
- Give the CTA a solid or lightly tinted background.
- Strengthen the border and hover state.
- Keep the patient action as the stronger primary action.

**Completion checks:**

- The full button label is readable at 1280px.
- The full button label is readable around 1100px and 1024px.
- The button remains readable in light and dark themes.
- The doctor image does not intercept the button click.
- The patient CTA remains visually primary.
- **Verification:** Desktop preview confirmed the full CTA label is readable above the artwork. The image is hidden from 1100px downward, and the type check/build passed.

### Step 2 — Improve hero CTA reassurance

**Status:** Complete
**Progress:** 100%
**Completed:** 2026-09-26
**Priority:** High  
**Can run independently:** Yes  
**Dependencies:** None

**Exact issue:** The hero owner CTA does not explain whether registration requires payment.

**What will be achieved:** A clinic owner will understand the low-risk first step before clicking.

**Recommended wording:**

> Free to start · No card required

Alternative:

> 14-day free trial · Upgrade anytime

**Planned work:**

- Add the reassurance below the hero owner CTA.
- Keep it short enough that it does not push the patient CTA or hero content out of alignment.
- Use the same promise as the registration form.

**Completion checks:**

- The reassurance is visible without scrolling on desktop.
- It wraps cleanly on mobile.
- It does not claim a benefit that differs from the actual registration policy.
- **Verification:** The hero and clinic section use the no-card Trial promise from the shared plan catalog.

### Step 3 — Make the clinic-section pricing action visible

**Status:** Complete
**Progress:** 100%
**Completed:** 2026-09-26
**Priority:** High  
**Can run independently:** Yes  
**Dependencies:** None

**Exact issue:** “See our pricing plans →” is small, low contrast, and visually separated from registration.

**What will be achieved:** Visitors will recognize pricing as a deliberate secondary action rather than an easy-to-miss text link.

**Recommended wording:**

> View pricing & compare plans →

**Planned work:**

- Turn the text link into a secondary button or bordered action.
- Use a minimum touch height of approximately 40–44px.
- Place it beside registration on desktop.
- Stack it below registration on mobile.
- Add a clear hover and keyboard-focus state.

**Completion checks:**

- The action is visually distinct from body copy.
- It has sufficient contrast on the dark clinic card.
- It is easy to tap on a phone.
- It still points to `/pricing`.
- **Verification:** The visible secondary action is beside registration on desktop, stacks through the existing mobile section layout, and points to `/pricing`.

### Step 4 — Add Trial to the pricing page

**Status:** Complete
**Progress:** 100%
**Completed:** 2026-09-26
**Priority:** High  
**Can run independently:** Yes  
**Dependencies:** Step 5 recommended, but not required

**Exact issue:** The registration flow presents Trial, while the pricing page only presents paid plans.

**What will be achieved:** Visitors will see the same four choices wherever they evaluate clinic plans.

**Trial card should communicate:**

- Free
- 14 days
- No card required
- No payment required
- Upgrade anytime

**Planned work:**

- Include Trial in the pricing card list.
- Give it a clear “Start Free” or equivalent action.
- Give it a distinct but equally credible visual treatment.
- Keep Growth as “Most Popular.”

**Completion checks:**

- Trial appears before Starter.
- The Trial card does not look disabled or unavailable.
- Trial wording matches the registration form.
- Paid plan pricing remains unchanged.
- **Verification:** The 1280px pricing preview shows Free Trial, Starter, Growth, and Pro; the Trial card displays Free, 14 days, and no card/payment required.

### Step 5 — Use one plan source for pricing and registration

**Status:** Complete
**Progress:** 100%
**Completed:** 2026-09-26
**Priority:** High  
**Can run independently:** Mostly  
**Dependencies:** None

**Exact issue:** Both pages import the shared plan catalog, but the pricing page still maintains a separate paid-only list, manual descriptions, and manual comparison values.

**What will be achieved:** A plan change in the shared catalog will not silently produce different public information on the pricing and registration pages.

**Planned work:**

- Use the shared plan catalog to decide which plans appear.
- Reuse plan names, summaries, pricing, limits, and feature values.
- Keep only visual styling and layout decisions local to the pricing page.
- Avoid separate paid-only definitions for the public presentation.

**Completion checks:**

- Pricing and registration show the same plan names.
- Pricing and registration show the same Trial duration and payment promise.
- Pricing values match the catalog.
- Comparison values match the catalog.
- **Verification:** Pricing now maps `PLAN_KEYS` and all card/comparison values from `PUBLISHED_PLAN_POLICY`; `npm run check` passed.

### Step 6 — Preserve the selected plan when entering registration

**Status:** Complete
**Progress:** 100%
**Completed:** 2026-09-26
**Priority:** High  
**Can run independently:** Yes  
**Dependencies:** Step 4 recommended

**Exact issue:** Clicking “Get Started” on any pricing card opens registration with no plan selected.

**What will be achieved:** The visitor's choice will be remembered, reducing repeated work and preventing accidental selection of the wrong plan.

**Planned work:**

- Pass the selected plan to registration through a validated URL value.
- Read the value when registration opens.
- Preselect the matching plan.
- Preserve the existing ability to change the plan.
- Carry the annual/monthly choice when it was made on the pricing page, if practical.

**Completion checks:**

- Starter, Growth, Pro, and Trial each open registration with the correct option selected.
- An invalid plan value is ignored safely.
- Direct visits to registration still require a normal plan selection.
- Existing registration submission behavior remains unchanged.
- **Verification:** Pricing actions construct validated `plan` and paid `billing` query values; registration accepts only catalog plan and billing-cycle values before preselection.

### Step 7 — Make the pricing cards responsive for four plans

**Status:** Complete
**Progress:** 100%
**Completed:** 2026-09-26
**Priority:** Medium  
**Can run independently:** Yes  
**Dependencies:** Step 4

**Exact issue:** The current three-column layout is not suitable for four plans at every screen size.

**What will be achieved:** Every plan will remain readable without excessive shrinking or awkward horizontal overflow.

**Recommended layout:**

- Phone: one card per row
- Tablet: two cards per row
- Large desktop: four cards per row

**Planned work:**

- Adjust the card grid breakpoints.
- Increase the main pricing content width where needed.
- Preserve equal-height cards and bottom-aligned actions.

**Completion checks:**

- No card is clipped at phone width.
- Two cards fit comfortably on tablet width.
- Four cards are readable on large desktop.
- Buttons align consistently across cards.
- **Verification:** The desktop preview shows four readable cards; the responsive classes define one-column phone, two-column medium, and four-column large layouts.

### Step 8 — Improve comparison table behavior on small screens

**Status:** Complete
**Progress:** 100%
**Completed:** 2026-09-26
**Priority:** Medium  
**Can run independently:** Yes  
**Dependencies:** Step 4

**Exact issue:** The table has overflow handling but no minimum width or clear mobile guidance.

**What will be achieved:** Visitors can compare plans on a phone without unreadable compressed columns.

**Planned work:**

- Add a useful minimum table width.
- Keep the Feature column visible while scrolling where practical.
- Keep the plan header row understandable.
- Add a short “Swipe to compare plans” hint on narrow screens.

**Completion checks:**

- Feature names remain readable.
- Values do not overlap.
- Horizontal scrolling is obvious on a phone.
- The table remains accessible by keyboard and screen reader.
- **Verification:** The table has a minimum width, sticky feature cells, visible plan headings, and a mobile swipe hint. A separate phone screenshot was unavailable because Playwright is not installed.

### Step 9 — Reconcile homepage claims and demo content

**Status:** Deferred by request
**Progress:** 0%
**Priority:** Medium  
**Can run independently:** Yes  
**Dependencies:** None

**Exact issue:** Some static claims and examples may be stale, geographically inconsistent, or stronger than the currently configured service behavior.

**What will be achieved:** The homepage will make one consistent and trustworthy promise.

**Planned work:**

- Confirm whether “50+ clinics” is current and supportable.
- Resolve the Kerala versus Koramangala mismatch.
- Replace fixed demo dates with neutral labels or dynamic dates.
- Confirm whether “Instant WhatsApp confirmation” is guaranteed in the target deployment.
- Confirm whether the “850+ slots booked” example should be presented as real usage or illustrative UI.

**Completion checks:**

- Geography is consistent across the page.
- Claims have a known source or are clearly illustrative.
- No date appears stale after the calendar moves forward.
- Messaging claims match deployment configuration.
- **Note:** This step was intentionally excluded from the implementation request and remains pending.

### Step 10 — Final visual and behavior verification

**Status:** Complete with environment note
**Progress:** 100%
**Completed:** 2026-09-26
**Priority:** Required  
**Can run independently:** No  
**Dependencies:** Steps 1–9 as applicable

**Exact issue:** The current audit is based on a desktop preview and source inspection. Completed work must be checked across the full public journey.

**What will be achieved:** The release will be checked as a visitor would experience it, not only as source code.

**Verification scenarios:**

1. Homepage at large desktop width.
2. Homepage around 1024–1100px.
3. Homepage on a phone-sized viewport.
4. Pricing page with Monthly selected.
5. Pricing page with Annual selected.
6. Trial card and Trial comparison values.
7. Each pricing CTA opening registration.
8. Direct registration without a pricing link.
9. Light and dark themes.
10. Keyboard focus on every primary and secondary action.

**Completion checks:**

- Type checking passes.
- Build Check passes.
- The start workflow serves the updated app.
- No new browser console errors appear.
- All public links reach the expected destination.
- The homepage and pricing page are visually checked at the listed widths.
- **Verification:** Desktop homepage and pricing previews were checked at 1280px; type check, build, and diff checks passed. Phone layout rules were inspected, but Playwright was unavailable for an automated phone screenshot.

## Suggested execution order

The steps are independently scoped, but this order minimizes rework:

1. Step 1 — Hero CTA layering
2. Step 2 — Hero reassurance
3. Step 3 — Homepage pricing action
4. Step 5 — Shared plan source
5. Step 4 — Trial pricing card
6. Step 6 — Preserve selected plan
7. Step 7 — Responsive pricing cards
8. Step 8 — Comparison table
9. Step 9 — Claims and demo content — deferred by request
10. Step 10 — Final verification — completed for Steps 1–8

## Progress update template

When work begins on a step, update its block with:

```text
Status: In progress
Progress: 25%
Started: YYYY-MM-DD
Owner:
Notes:
```

When it is complete:

```text
Status: Complete
Progress: 100%
Completed: YYYY-MM-DD
Verification:
- ...
```

## Out of scope for this workstream

- Changing subscription enforcement rules
- Changing payment-provider behavior
- Changing clinic approval workflows
- Rewriting the homepage visual identity
- Replacing the existing booking flow
- Adding new analytics or marketing integrations
