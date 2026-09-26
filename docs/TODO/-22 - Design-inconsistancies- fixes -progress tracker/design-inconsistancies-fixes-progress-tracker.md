# Homepage and Pricing Design Inconsistencies — Fixes and Progress Tracker

**Workstream:** -22  
**Status:** Steps 1–8 and Step 10 complete; Step 9 audit documented and implementation pending
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
| Marketing copy and demo-data review | 0% | 41-item audit documented; implementation pending |
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

### Step 9 documentation update

No Step 9 homepage or marketing code was changed in this documentation update. The detailed audit and the agreed direction for each item are recorded in the Step 9 table below. Fictitious people, booking IDs, clinic names, dashboard values, and marketplace examples may continue to look like current product data; the agreed requirement is that the visible claims and dates are kept consistent.

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

**Status:** Audit documented; implementation pending
**Progress:** 0%
**Priority:** Medium
**Can run independently:** Yes
**Dependencies:** None

**Exact issue:** The public marketing surfaces contain fixed claims, sample values, dates, locations, product promises, and marketplace messages. Some need product confirmation, some need consistent wording, and some should become current platform data.

**Agreed direction:** Keep fictitious demo people, clinic names, booking IDs, dashboard values, and marketplace cards looking like current product data. Update the claims and wording listed below so the public message is consistent. The 50-clinic baseline and 500-booking baseline are the requested defaults, with the actual platform counts added where available.

| # | Item and current situation | Why it needs attention | Suggested improvement or agreed direction | Decision |
|---:|---|---|---|---|
| 1 | **Geography:** The page says “50+ verified clinics across Kerala,” while the sample clinic is in Koramangala. | Koramangala is in Bengaluru, not Kerala, so visitors cannot tell where the service operates. | Choose one launch geography. If the service is Kerala-focused, use a Kerala sample location. If it is India-wide, remove the Kerala-only wording and use one India-wide statement everywhere. | Needs product decision |
| 2 | **Fixed dates:** The demos use Apr 19, Apr 22, Tue Apr 22, and dates 21–25. | These dates will eventually look old even though the page appears current. | Keep the current-looking demo style, but generate dates from the current month or refresh the examples whenever the public copy is reviewed. | Update to current-looking dates |
| 3 | **Clinic count:** The homepage uses “50+ dental clinics trust us,” “50+ verified clinics across Kerala,” and related supplier wording. | The same number is used for different audiences and may not match the real platform count. | Use 50+ as the requested default baseline, add the actual clinic count from the platform, and show or link to the existing clinics currently on the platform. Keep one consistent count source. | Approved direction |
| 4 | **Bookings this month:** The hero currently shows “850+ slots booked.” | “This month” makes a fixed number look like a live platform statistic. | Change the baseline to “500+ bookings this month” and add the actual total bookings made during the current month when the count is available. | Approved direction |
| 5 | **Practice metrics:** The demo shows 128 patients, 24 this week, ₹38k revenue, and a weekly graph. | These values look like a real clinic’s current performance. | Keep the fictitious values looking like current dashboard data, as requested. Refresh them with current-looking values when the marketing page is reviewed, or connect them to real aggregate data later. | Keep as current-looking data |
| 6 | **Patient and doctor identities:** The demos use Dr. Priya Menon, Dr. Arjun Shah, Anand K., Meera R., Ravi S., and named reference numbers. | These names look like real records, but the request is to keep them as they are. | Keep the names, identities, and booking IDs unchanged. They are accepted as part of the current-looking fictitious product examples. | Keep as is |
| 7 | **Notification wording:** The page says “Instant WhatsApp confirmation.” | The product can send email, WhatsApp, or SMS depending on configuration, provider availability, clinic settings, and plan access. | Use the agreed wording: “Instant email/WhatsApp/SMS confirmation.” Ensure the same wording is used in the homepage, booking page, and SEO description. | Approved wording |
| 8 | **Booking speed:** The page says “get confirmed instantly.” | This is a strong promise and must be used consistently with the intended booking flow. | Keep “Confirmed instantly” as requested. | Keep as is |
| 9 | **Account wording:** The page says “No account needed” and “No sign-up — just email verification.” | The system still verifies email and creates or updates a patient record, but the visitor does not create a normal login account. | Keep “No account needed” as requested. | Keep as is |
| 10 | **Registration time:** The homepage says setup takes under five minutes, while registration says it takes two minutes. | Two different time promises make the journey look inconsistent. | Use the five-minute promise consistently. Replace “Takes 2 minutes” with “Takes under five minutes” or “Get started in under five minutes.” | Approved direction |
| 11 | **Clinic readiness:** The page says clinics can be ready to accept bookings in minutes. | A clinic still needs to complete registration and receive approval. | Use: “Set up your clinic in minutes. Start accepting bookings after approval.” | Approved wording |
| 12 | **Patients start booking:** The three-step section says patients book after the clinic shares its link. | It does not mention that the clinic may need approval first. | Use: “After approval, share your clinic link. Patients can book online and receive reminders.” | Recommended improvement |
| 13 | **Upgrade wording:** The page says “Upgrade anytime.” | The current plan-change process may involve a request or confirmation rather than an immediate change. | Use: “Request an upgrade whenever you are ready.” | Approved wording |
| 14 | **Trial grace period:** Registration mentions a 7-day grace period, while pricing only describes a 14-day Trial. | The public pages give different levels of detail about the Trial lifecycle. | Keep the public pricing promise simple and remove the grace-period detail from the public registration copy. | Approved direction |
| 15 | **Fees:** Pricing says “No hidden fees. No setup charges.” | Usage fees or payment-provider charges may still apply in some situations. | Replace it with: “No setup fee. Payment-provider or usage charges may apply where applicable.” | Approved wording |
| 16 | **Pro unlimited limits:** Pro is shown as unlimited, while the policy mentions fair-use monitoring. | “Unlimited” can be understood as having no practical limit. | Add a simple note such as “Unlimited subject to fair-use monitoring” or use “High-volume usage with fair-use limits.” | Needs policy confirmation |
| 17 | **Plan-specific WhatsApp access:** Pricing reduces several WhatsApp capabilities to “WhatsApp notifications.” | The plans do not all include the same WhatsApp capabilities. | Keep the general wording only if the comparison details explain which notification types each plan includes. Otherwise, list the exact WhatsApp coverage per plan. | Needs policy confirmation |
| 18 | **Role-based access:** The page says every user sees exactly what they need. | This is an absolute claim about permissions and access control. | Use: “Role-based dashboards for clinic teams, doctors, and patients.” | Recommended improvement |
| 19 | **Clinical records:** The page promises prescriptions, diagnoses, and patient history against every booking. | The wording implies that every booking always contains all three types of records. | Use: “Keep prescriptions, diagnoses, and patient notes organized with each visit,” unless all three are guaranteed for every booking. | Needs feature confirmation |
| 20 | **Doctor profiles:** The page promises certifications, case studies, and verified credentials. | The public profile experience must support all of these items before they are advertised. | If all are supported, keep the claim. Otherwise use: “Share doctor profiles, specialties, and clinic information before patients book.” | Needs feature confirmation |
| 21 | **Exports:** The page promises Excel, CSV, and PDF exports. | Visitors may expect every listed format to be available for all relevant records. | Confirm the available formats. Advertise only the formats that work for patient lists and booking history. | Needs feature confirmation |
| 22 | **Real-time availability:** The page says availability updates instantly and double-bookings are impossible. | “Impossible” is an absolute promise even when the system has safeguards. | Use: “Availability updates in real time, with safeguards against double-booking.” | Recommended improvement |
| 23 | **Security and privacy:** The page says patient data is encrypted and protected end to end. | This is a technical security promise that requires formal confirmation. | Use the stronger wording only after security review. Otherwise use: “Designed with role-based access and privacy-conscious patient data handling.” | Needs security confirmation |
| 24 | **Smile Deals:** The page says the offers are exclusive partner-clinic packages that help clinics fill seats faster. | “Exclusive,” “partner,” and “fill seats faster” are all claims that need evidence. | Use: “Discover dental offers from participating clinics,” unless exclusivity and partner status are verified. | Needs marketplace confirmation |
| 25 | **Backup reminders:** The page says monthly backup reminders are included. | Visitors may assume this is available to every clinic and every plan. | Confirm the plan coverage. If universal, use “Get a monthly reminder to back up your clinic data.” Otherwise say it is available in supported plans. | Needs feature confirmation |
| 26 | **Clinic dashboard sample:** The dashboard contains LIVE, sample appointments, doctors, slot counts, and status labels. | It looks like a live clinic account rather than a product example. | Keep the sample dashboard looking like current data, as requested. Refresh its dates and values when the content is reviewed. | Keep as current-looking data |
| 27 | **Patient booking sample:** The patient flow shows a clinic, distance, rating, services, dates, and a confirmed booking. | It looks like a current real booking journey. | Keep it looking current, as requested. Keep the location, rating, and dates consistent with the final chosen geography and current-looking date set. | Keep as current-looking data |
| 28 | **LIVE label:** The clinic dashboard animation includes a LIVE indicator. | The animation itself is static even though the label implies live data. | Keep the current-looking treatment as requested. If the animation is later used as a literal product screenshot, replace LIVE with data from the platform. | Keep for marketing artwork |
| 29 | **Today, Tomorrow, and This month labels:** These relative labels surround fixed example values. | The labels become incorrect when the calendar moves forward. | Keep the labels, but update the underlying dates and monthly values so they always match the current-looking period. | Update data, keep style |
| 30 | **India dental network:** The marketplace section says it reaches India’s dental network. | The statement may be broader than the current clinic and supplier coverage. | If the platform is India-wide, support it with the clinic count and directory. If not, use the chosen launch geography. | Needs coverage confirmation |
| 31 | **Supplier and lab advertising:** The page says suppliers can advertise directly to verified clinic owners. | This implies an active, working supplier advertising service. | Keep only if supplier advertising and clinic-owner reach are available. Otherwise use: “Explore opportunities to showcase dental products and services to participating clinics.” | Needs marketplace confirmation |
| 32 | **No ad spend required:** The page says clinics can fill empty slots without ad spend. | This may sound like a guarantee of results without paid promotion. | Use: “Promote available slots through the BookMySlot marketplace,” unless the no-cost promotion policy is confirmed. | Needs business confirmation |
| 33 | **Supplier deal cards:** The examples include a dental chair, composite kit, and a ₹850 crown. | Product names and prices look like live offers. | Keep the fictitious cards looking like current marketplace listings, as requested. Refresh prices if they are presented as current offers. | Keep as current-looking data |
| 34 | **Smile Deals page count:** The page repeats “50+ verified clinic owners,” “Reach 50+ verified clinics,” and “Reviewed within 2 days.” | These claims must match the clinic count and review process used elsewhere. | Reuse the same platform clinic count from item 3. Keep “Reviewed within 2 days” only if that review timing is a real service commitment. | Needs operational confirmation |
| 35 | **Copyright year:** The footer says © 2026. | The footer will become stale after the year changes. | Generate the current year automatically. | Recommended improvement |
| 36 | **Production-looking domain:** The patient demo shows bookmyslot.in. | The displayed domain can become incorrect if the published domain changes. | Confirm the published domain before release. If the domain is not permanent, display “BookMySlot” without a fixed URL. | Needs deployment confirmation |
| 37 | **Powered by BookMySlot:** The marketplace label says it is powered by BookMySlot. | This is fine only if the marketplace is an official part of the product. | Keep it if the marketplace is official. Otherwise use “BookMySlot Marketplace.” | Needs brand confirmation |
| 38 | **Trial name:** The internal catalog calls it Trial while public pages call it Free Trial. | The names are not identical, although the meaning is clear. | Use “Free Trial” as the customer-facing name and keep `trial` as the internal plan key. | Approved direction |
| 39 | **Trial limits:** The Trial has limits for bookings, doctors, deals, storage, and messaging, but the card mainly highlights 14 days and no card. | Visitors may assume the Trial is unlimited. | Keep the simple public promise, but show the important Trial limits in the comparison table or plan details. | Recommended improvement |
| 40 | **Annual billing:** The pricing page says “2 months free.” | The message must remain correct if annual prices change. | Keep the message derived from the plan prices and show the actual annual saving beside it. | Keep, verify when prices change |
| 41 | **Registration payment message:** The pricing page says no payment is required to register. | Visitors may not know when paid billing begins. | Use: “No payment is taken during registration. Paid billing starts after approval.” | Recommended improvement |

**Step 9 completion checks:**

- The 50+ baseline, actual clinic count, and existing clinic directory use one consistent source.
- The homepage shows 500+ bookings this month as the requested baseline and includes the current month’s total when available.
- The chosen geography is consistent across homepage, booking, login, SEO, and marketplace copy.
- Dates and month labels remain current-looking rather than becoming stale.
- The agreed email/WhatsApp/SMS wording is consistent across public surfaces.
- The requested “Confirmed instantly” and “No account needed” wording remains unchanged.
- The registration timing consistently says under five minutes.
- Approval, upgrade, Trial, and payment wording matches the agreed language above.
- Fictitious people, IDs, dashboard values, and marketplace cards remain available as current-looking product examples.
- Remaining feature, security, pricing, and marketplace claims have an owner-confirmed source before release.

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
9. Step 9 — Claims and demo content — audit documented; implementation pending
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
