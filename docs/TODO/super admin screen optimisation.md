# Super Admin Screen Optimisation

**Status:** Planning document — no application UI or behaviour is changed by this document  
**Audience:** Product, design, frontend, backend, database, QA, support, and operations teams  
**Application:** BookMySlot dental clinic platform  
**Primary goal:** Make the Super Admin area easier to understand and faster to operate without removing existing administrative capabilities or exposing clinic-private treatment revenue.

---

## 1. What this document is for

The Super Admin screen has grown to cover several different jobs:

- Checking whether the platform and clinics need attention.
- Comparing messaging and storage usage.
- Managing active clinics.
- Reviewing plans, subscriptions, and temporary access.
- Approving new clinic registrations.
- Managing archived clinics.
- Managing Smile Deals and clinic-facing advertisements.
- Reviewing login activity.

These jobs are all valid, but they are currently presented as nine equal top-level tabs. Some tabs also show different versions of the same clinic list and clinic detail information.

This document breaks the optimisation into small implementation steps. Each step explains:

- What the change means in everyday language.
- Why the change is useful.
- What technical work is required.
- Which existing files are likely to be involved.
- What must be true before the step is considered complete.
- Whether the step can be worked on independently or has a dependency.

The document is intended to be used as an implementation reference. It is not a request to complete every step immediately.

---

## 2. Plain-language outcome

The improved Super Admin area should have two main operational workspaces:

```text
Operations
├── Platform summary
├── Attention required
├── Messaging and service usage
└── Tenant operations

Clinics & Access
├── One clinic directory
├── Profile and operational actions
├── Subscription and access
├── Usage and limits
└── History
```

Other workflows should remain separate:

```text
Plans & Policies
Pending Review
Smile Deals
Security & Audit
```

Archived clinics should be available through the clinic directory as a status filter or secondary view rather than competing with the main operational areas as a primary tab.

The goal is not to hide functionality. The goal is to put related work together and stop showing the same clinic information in several different places.

---

## 3. Current screen summary

The current page contains these top-level tabs:

1. Overview
2. Plan Policies
3. Entitlements
4. Active Clinics
5. Messaging Usage
6. Pending
7. Archived
8. Smile Deals
9. Login Activity

### Current component ownership

| Area | Current implementation | Main responsibility |
|---|---|---|
| Overview | `client/src/components/AdminOperationsOverview.tsx` | Platform KPIs, attention signals, tenant operations table, operations detail sheet |
| Messaging Usage | `client/src/components/AdminMessagingUsagePanel.tsx` | Monthly messaging totals, trend, channel mix, clinic comparison, messaging detail sheet |
| Entitlements | `client/src/components/AdminEntitlementReview.tsx` | Plan access, Trial, paid-plan assignment, sponsored access, exceptions, limits, features, subscription history |
| Plan Policies | `client/src/components/AdminPlanPolicies.tsx` | Versioned plan catalog editing, validation, draft, impact preview, publishing |
| Active Clinics | `client/src/pages/Admin.tsx` | Active clinic cards, contact details, doctors, URLs, edit, credentials, archive |
| Pending | `client/src/pages/Admin.tsx` | Registration verification, document review, approval, flagging, rejection |
| Archived | `client/src/pages/Admin.tsx` | Archived clinic listing and restoration |
| Smile Deals | `client/src/pages/Admin.tsx` | Deal and advertisement creation, editing, scheduling, media, and targeting |
| Login Activity | `client/src/pages/Admin.tsx` | Login event history and filters |

### Current shared data

The main Admin page loads clinics through:

```text
GET /api/clinics
```

The Operations Overview loads:

```text
GET /api/admin/messaging-usage?month=YYYY-MM
GET /api/admin/storage-usage
GET /api/admin/subscription-events?clinicId=<id>
```

The Messaging Usage panel loads the messaging endpoint again for its selected month and loads a clinic-specific version when a clinic is opened.

The Entitlement Review loads selected-clinic reports and history:

```text
GET /api/admin/clinics/<id>/entitlements
GET /api/admin/clinics/<id>/subscription-history
```

The existing React Query cache prevents some unnecessary repeat requests while data is fresh, but the components still maintain separate selection state, display rules, month state, filtering rules, and clinic detail layouts.

---

## 4. Design rules that must not change

The optimisation must preserve these boundaries.

### 4.1 Super Admin privacy boundary

The Super Admin operations area may show platform service information, subscription access, plan state, storage, messaging, and safe support context.

It must not become a clinic revenue or treatment-performance dashboard. Do not add:

- Patient treatment revenue.
- Clinic revenue by treatment.
- Patient bill totals.
- Clinic profit, margin, ARPU, or LTV.
- Doctor earnings.
- Routine patient payment history.
- Clinical records as part of routine administration.

### 4.2 Server authority

The browser must not decide whether a clinic is entitled to a plan, feature, allowance, or temporary exception. The browser may display the server response and submit an administrator action, but authorization and effective access remain server-side.

### 4.3 Subscription and access distinction

These concepts must remain separate in the UI and data model:

- Paid subscription.
- Trial access.
- Sponsored or complimentary access.
- Temporary entitlement exception.
- Provider payment status.
- Effective entitlement state.

Granting sponsored access or an exception must not silently rewrite paid subscription history.

### 4.4 Unavailable is not zero

If messaging, storage, entitlement, or provider data cannot be measured, the UI must show an unavailable or delayed state. It must not display zero and imply that no usage exists.

### 4.5 Existing lifecycle and audit rules

Actions such as Trial assignment, paid-plan assignment, sponsored access, exceptions, and revocation must continue to:

- Require a reason where the current policy requires one.
- Use server-side authorization.
- Be idempotent where transition identifiers are required.
- Write append-only lifecycle or audit records.

### 4.6 Existing business behaviour

The optimisation is primarily an information architecture and presentation change. It must not change:

- Booking lifecycle behaviour.
- Clinic approval rules.
- Subscription provider behaviour.
- Messaging sending behaviour.
- Entitlement calculation rules.
- Smile Deal publishing behaviour.
- Login audit recording.

---

## 5. Target information architecture

### 5.1 Recommended navigation

| New area | Contains | Why it belongs together |
|---|---|---|
| **Operations** | Current Overview plus messaging and service-usage summaries | Answers whether the platform or a clinic needs attention |
| **Clinics & Access** | Active Clinics plus Entitlements, with one clinic directory | Finds a clinic and manages its platform access from one place |
| **Plans & Policies** | Current Plan Policies | Changes the catalog and policy registry, not one clinic |
| **Pending Review** | Current Pending registration workflow | A review queue with verification and approval actions |
| **Smile Deals** | Current Smile Deals workflow | Content and marketplace administration |
| **Security & Audit** | Current Login Activity, with future audit views | Security and administrative history |

### 5.2 Archived clinics

Archived clinics should be available from **Clinics & Access** through one of these approaches:

1. A status filter in the shared clinic directory.
2. A secondary “Archived” view inside the clinic workspace.
3. A less prominent overflow or secondary navigation item.

The implementation should not delete the existing restore behaviour.

### 5.3 Naming guidance

Recommended user-facing labels:

- Replace **Overview** with **Operations**.
- Replace **Entitlements** with **Clinics & Access** when it becomes a shared workspace.
- Keep **Plan Policies** as a separate configuration area.
- Prefer **Pending Review** over only **Pending**, because the tab contains a review decision workflow.
- Prefer **Security & Audit** over only **Login Activity** if the area will later include more administrative audit sources.

---

## 6. Independent implementation workstreams

The following workstreams are deliberately separated so they can be planned, reviewed, and tested independently.

### Dependency legend

- **Independent:** Can be developed without waiting for another UI workstream, provided existing API contracts remain unchanged.
- **Prerequisite:** Should be completed before another workstream to avoid duplicated implementation.
- **Follow-on:** Can start independently, but its final integration depends on an earlier workstream.

### Detailed workstream table

| ID | Workstream | Plain-language change | Technical work required | Likely files or areas | Dependency | Completion criteria |
|---|---|---|---|---|---|---|
| SA-01 | Confirm the target navigation | Agree on the new names and section order before changing layout. | Record the final navigation map and which current tab moves into which workspace. Keep existing route and permission behaviour unchanged. | `client/src/pages/Admin.tsx`, this document, product/design review | Independent | A signed-off map exists for Operations, Clinics & Access, Plans & Policies, Pending Review, Smile Deals, and Security & Audit. |
| SA-02 | Create shared admin display policies | Make status, attention, freshness, and availability labels consistent. | Extract pure helpers or shared modules for subscription status, operational attention reasons, data availability, and display labels. Do not move authorization into the browser. | Existing shared subscription policy; `AdminOperationsOverview.tsx`; `AdminEntitlementReview.tsx`; shared types | Independent; recommended prerequisite | The same clinic receives the same subscription and attention label in Operations, Clinics & Access, and detail views. Pure unit tests cover supported, legacy, unknown, and unavailable states. |
| SA-03 | Define shared admin data contracts | Give the frontend one predictable shape for shared clinic operations data. | Document or type the combined clinic summary fields: clinic identity, lifecycle status, subscription state, plan, messaging summary, storage summary, attention reasons, and data freshness. Preserve existing endpoint compatibility unless a deliberate API change is approved. | Shared TypeScript types; existing admin route DTOs; `AdminOperationsOverview.tsx` | Independent; can run in parallel with SA-02 | The required fields and unavailable states are explicit. No component relies on undocumented `any` fields for the shared workspace. |
| SA-04 | Share the messaging period and query state | Ensure Operations and detailed messaging information use the same month and timezone. | Create a shared hook or parent-owned state for selected month, refresh state, query key, period label, and freshness. Reuse the existing React Query key shape where possible. | `AdminOperationsOverview.tsx`, `AdminMessagingUsagePanel.tsx`, `Admin.tsx` | SA-03 recommended | Changing the month updates all messaging sections in the workspace. There is one clear reporting-period label and no contradictory UTC/clinic-timezone copy. |
| SA-05 | Build the Operations shell | Rename and restructure Overview as the main platform operations workspace. | Add a workspace header, period control, refresh action, KPI area, attention area, usage area, and tenant operations area. Keep loading, retry, empty, and unavailable states. | `AdminOperationsOverview.tsx`, `Admin.tsx` | SA-01; SA-02 and SA-04 recommended | The workspace answers: what is healthy, what needs attention, how much service usage exists, and which clinic should be opened next. |
| SA-06 | Add the compact messaging section to Operations | Bring the useful parts of Messaging Usage into Operations without duplicating the entire page. | Reuse or extract channel mix, six-month trend, outcome totals, and period context. Keep a detailed clinic comparison available through the Operations tenant table or an explicit detail mode. | `AdminMessagingUsagePanel.tsx`, `AdminOperationsOverview.tsx` | SA-04; can start independently as a component extraction | Operations shows messaging totals and trends once. The detailed messaging view remains available and uses the same month and selected clinic. |
| SA-07 | Remove duplicate Operations metrics | Avoid showing the same messages, accepted, failed, and clinic counts in several cards. | Decide which values are page-level KPIs and which belong in the messaging detail section. Remove or demote repeated cards while preserving important supporting information. | `AdminOperationsOverview.tsx`, `AdminMessagingUsagePanel.tsx` | SA-05 and SA-06 | There is one authoritative KPI row. A reviewer can identify the current period, total volume, failures, and channel breakdown without reading two competing metric groups. |
| SA-08 | Unify Operations and messaging clinic details | Stop opening two different sheets for the same clinic. | Use one selected-clinic context. Add Usage as a section or tab within the clinic detail sheet. Preserve subscription provider history, storage information, messaging detail, and operational context. | `AdminOperationsOverview.tsx`, `AdminMessagingUsagePanel.tsx` | SA-04 and SA-06 | Selecting a clinic from Operations opens one detail surface. Messaging, storage, subscription, and operational context are available without losing the current list or filter. |
| SA-09 | Define the shared clinic directory | Create one source of truth for finding and selecting clinics. | Decide list columns, search fields, filters, selected state, archived handling, and desktop/mobile rendering. Include active, pending, attention, Trial, paid, and archived states as appropriate. | `Admin.tsx`, `AdminEntitlementReview.tsx`, `AdminOperationsOverview.tsx` | SA-01 and SA-03 | A clinic can be found by one search and selected once. The directory has a documented filter contract and does not silently exclude a valid state. |
| SA-10 | Build Clinics & Access workspace shell | Combine Active Clinics and Entitlements around one directory and one selected clinic. | Create the workspace layout with a left directory/list and a right detail panel on large screens. Stack the areas on small screens. Keep the clinic selection in the URL or controlled state if the existing routing pattern supports it. | New focused admin workspace component; `Admin.tsx`; `AdminEntitlementReview.tsx` | SA-09; SA-02 recommended | A selected clinic can be reviewed without switching between separate Active Clinics and Entitlements tabs. |
| SA-11 | Move active-clinic operational actions into the shared detail view | Keep existing clinic management capabilities available after consolidation. | Preserve edit clinic, manage credentials, copy booking URL, copy About URL, archive, and restore actions. Keep destructive actions visibly distinct and retain existing confirmation or mutation behaviour. | `Admin.tsx`, clinic mutation handlers | SA-10 | Every action currently available from Active Clinics remains available from Clinics & Access, with the same server mutation and success/error handling. |
| SA-12 | Add access and entitlement sections to the selected clinic | Make subscription and effective access understandable without a separate entitlement directory. | Move or extract effective plan, subscription state, policy version, access source, important dates, limits, features, temporary grants, exceptions, and lifecycle history into the selected clinic detail. | `AdminEntitlementReview.tsx`, new detail components | SA-10; existing entitlement endpoints remain authoritative | The selected clinic view explains why access is active, pending, Trial, sponsored, exceptional, expired, or unknown. |
| SA-13 | Combine subscription and provider history | Give administrators one chronological access history. | Present lifecycle events, plan assignments, sponsored grants, entitlement exceptions, revocations, and provider events in a consistent timeline or grouped history view. Keep provider event processing status visible. | `AdminOperationsOverview.tsx`, `AdminEntitlementReview.tsx`, admin subscription routes | SA-12; API review may be required | A support user can understand what happened to a clinic’s access without opening multiple unrelated history cards. No history record is deleted or rewritten. |
| SA-14 | Connect pending review to Clinics & Access | Remove the confusing instruction to switch tabs to assign access after approval. | Keep Pending Review as a queue, but link the approved clinic directly to its access section. Decide whether approval continues to start Trial only or offers a clearly documented next action. Do not change the approved lifecycle policy without product approval. | Pending section in `Admin.tsx`; `AdminEntitlementReview.tsx` | SA-10; policy decision required before changing approval actions | After approval, the administrator can reach the same clinic’s Access view directly. The UI does not imply that approval and paid activation are the same operation. |
| SA-15 | Move archived clinics into the shared directory | Reduce top-level navigation while preserving archived management. | Add archived filtering and restore actions to the shared clinic workspace, or provide a secondary archived view using the same directory component. Exclude archived clinics consistently from active counts. | `Admin.tsx`, shared clinic directory | SA-09 and SA-10 | Archived records are reachable, restorable, and not counted as active. Pending and archived filters use the same inclusion rules everywhere. |
| SA-16 | Keep Plan Policies separate but connect it clearly | Prevent catalog editing from being confused with per-clinic access management. | Keep the draft/publish policy editor separate. Add clear links or references to the policy version shown in clinic access details. Preserve validation, impact preview, reason requirements, and publish confirmation. | `AdminPlanPolicies.tsx`, `AdminEntitlementReview.tsx` | Independent; integration after SA-12 | Policy editing remains a separate high-risk workflow. A clinic detail can show which policy version is effective without embedding the editor. |
| SA-17 | Reclassify low-frequency navigation | Make the navigation reflect how often and why each area is used. | Move Archived into Clinics & Access. Keep Smile Deals and Login Activity separate. Decide whether labels become Growth & Content and Security & Audit without changing their underlying functions. | `Admin.tsx` | SA-01 | The main navigation no longer presents nine unrelated items with equal visual weight. All existing workflows remain reachable. |
| SA-18 | Responsive navigation redesign | Make the navigation usable on narrow screens. | Replace the nine-item grid with grouped navigation, a scrollable primary tab row, or a compact selector. Ensure active state, keyboard access, focus visibility, and readable labels. | `Admin.tsx`, shared tab/navigation styles | SA-17 | The navigation does not become an excessively tall grid on mobile. Every workspace remains reachable by keyboard and touch. |
| SA-19 | Responsive clinic directory and detail layout | Make the combined clinic workflow usable on phones. | Use compact cards or a stacked list on narrow screens. Keep the clinic name, access state, attention state, and primary action visible. Make detail sections stack predictably. Preserve horizontal scrolling only for genuinely tabular data. | New directory/detail components; `AdminEntitlementReview.tsx`; `index.css` only if shared styles are needed | SA-10 | No critical action is hidden off-screen. The selected clinic, status, and main action remain understandable at narrow widths. |
| SA-20 | Responsive Operations tables and charts | Prevent wide data from becoming unusable on mobile. | Keep a scrollable table where comparison requires columns, but provide a clear scroll boundary and preserve the first identity column if possible. Give charts minimum heights and readable legends. | `AdminOperationsOverview.tsx`, `AdminMessagingUsagePanel.tsx` | SA-05 and SA-06 | Tables do not overflow the page itself. Charts render without clipped labels or zero-height containers at representative widths. |
| SA-21 | Accessibility and interaction audit | Make the reorganised screen usable for keyboard and assistive-technology users. | Check heading hierarchy, tab semantics, button labels, form labels, focus order, dialogs/sheets, live regions for loading/error states, table headers, and colour contrast. | All changed admin components | After each UI workstream; final audit after SA-18 to SA-20 | Keyboard users can navigate, open, close, and act on every workspace. Status meaning is not communicated by colour alone. |
| SA-22 | Extract reusable implementation components | Reduce the risk of future changes in the large Admin page. | Split code at stable workflow boundaries rather than rewriting the page. Suggested boundaries: `AdminShell`, `AdminOperations`, `AdminClinicsAccess`, `AdminPendingReview`, `AdminPlansPolicies`, `AdminGrowthContent`, and `AdminSecurity`. | `client/src/pages/Admin.tsx` and new components | After navigation decisions; can happen incrementally | `Admin.tsx` remains responsible for composition and authentication state, while each workflow owns its presentation and local state. No business rule is changed during extraction. |
| SA-23 | Add focused automated tests | Protect the shared behaviour while the UI is reorganised. | Add pure tests for status normalization, attention classification, clinic filters, archived/pending inclusion rules, period formatting, and unavailable-data handling. Add component tests for selection and action visibility where the project test setup supports them. | Existing test files; new admin policy/filter tests | SA-02, SA-03, SA-09 | Tests cover normal, empty, error, unknown, unavailable, archived, pending, Trial, paid, sponsored, and exception states. |
| SA-24 | Run full verification and release review | Confirm that the screen still works as a complete system. | Run type check, production build, Build Check workflow, application workflow, API smoke checks, and representative desktop/mobile review. Confirm admin route protection and no privacy-boundary regression. | Project workflows; admin route; changed files | All implementation workstreams | The build and checks pass, workflows start, admin authentication remains protected, and no clinic-private revenue data appears in the operations UI. |

---

## 7. Work that can happen in parallel

The work can be divided into independent tracks to reduce delivery time.

### Track A — Shared rules and contracts

Can start immediately:

- SA-02 Shared admin display policies
- SA-03 Shared admin data contracts
- SA-23 Test planning and pure policy tests

These tasks should be reviewed before the final Operations and Clinics & Access screens are connected.

### Track B — Operations and messaging

Can start after the target layout is agreed:

- SA-04 Shared messaging period state
- SA-05 Operations shell
- SA-06 Compact messaging section
- SA-07 Remove duplicate metrics
- SA-08 Unified clinic detail

### Track C — Clinics and access

Can start independently from Track B after the navigation decision:

- SA-09 Shared clinic directory definition
- SA-10 Clinics & Access shell
- SA-11 Active-clinic actions
- SA-12 Access and entitlement sections
- SA-13 Unified history

### Track D — Navigation and low-frequency areas

Can proceed independently:

- SA-14 Pending Review handoff
- SA-15 Archived view
- SA-16 Plan Policies boundary
- SA-17 Navigation classification
- SA-18 Responsive navigation

### Track E — Responsive and quality work

Should begin once representative layouts exist, but does not need to wait for all business logic:

- SA-19 Responsive clinic directory
- SA-20 Responsive Operations tables and charts
- SA-21 Accessibility audit
- SA-22 Component extraction
- SA-24 Final verification

---

## 8. Suggested delivery sequence

The workstreams are independent, but the safest delivery sequence is:

| Phase | Work | Reason |
|---|---|---|
| Phase 0 | SA-01, SA-02, SA-03 | Agree on the destination and remove inconsistent display rules before duplicating them in new components. |
| Phase 1 | SA-04, SA-05, SA-06, SA-07 | Consolidate Operations and messaging first because their metrics currently overlap most directly. |
| Phase 2 | SA-09, SA-10, SA-11, SA-12 | Build one clinic directory and selected-clinic workspace. |
| Phase 3 | SA-08, SA-13, SA-14, SA-15, SA-16, SA-17 | Join detail views, connect history, and reduce navigation duplication. |
| Phase 4 | SA-18, SA-19, SA-20, SA-21 | Finish narrow-screen and accessibility behaviour after the information architecture is stable. |
| Phase 5 | SA-22, SA-23, SA-24 | Extract remaining code, add regression protection, and perform full release verification. |

---

## 9. Detailed technical guidance

### 9.1 Keep server responses authoritative

The frontend should not calculate effective access from raw plan fields when an entitlement report is available. It may calculate simple presentation values such as a percentage or a formatted date, but these rules must remain server-authoritative:

- Whether a clinic has access.
- Which plan is effective.
- Whether Trial is available or already consumed.
- Whether a paid plan is active, pending payment, expired, or cancelled.
- Whether sponsored access or an exception is active.
- Whether a feature or usage limit is included.
- Whether an administrator is allowed to perform an action.

### 9.2 Use stable query keys

When Operations and Clinics & Access share data:

- Keep query keys stable where the endpoint contract is unchanged.
- Include the reporting month in messaging query keys.
- Include the selected clinic ID in clinic-specific report keys.
- Invalidate clinic and selected-clinic queries after a successful mutation.
- Avoid creating different query keys for the same data merely because two components use different names.

Example query categories:

```text
["/api/clinics"]
["/api/admin/messaging-usage", month]
["/api/admin/storage-usage"]
["/api/admin/clinics", clinicId, "entitlements"]
["/api/admin/clinics", clinicId, "subscription-history"]
["/api/admin/subscription-events", clinicId]
```

### 9.3 Share the selected clinic carefully

A selected clinic can be held in a parent workspace state or represented in the URL. Whichever approach is chosen:

- Closing the detail view must return to the prior list.
- Search and filter values should not reset unexpectedly.
- Changing the selected clinic must clear or replace old clinic-specific loading and error states.
- Detail queries must be enabled only when a clinic is selected.
- A clinic selected from an attention card must open the same detail view as a clinic selected from the table.

### 9.4 Use one filter definition

The clinic directory should define each filter once. The filter definition should state:

- Which clinic statuses are included.
- Whether archived clinics are included.
- How Trial is detected.
- How active paid access is detected.
- What qualifies as attention.
- Whether unavailable data is treated as attention, unknown, or excluded.

Do not repeat slightly different inline filters in multiple components.

### 9.5 Keep data states explicit

Every operational data source should distinguish at least:

```text
loading
available
empty
error
unavailable
delayed or stale
```

Examples:

- A clinic with zero messages is not the same as messaging data being unavailable.
- A clinic with zero storage is not the same as storage measurement failing.
- A clinic with no active exception is not the same as exception history being unavailable.
- A provider event list with no records is not the same as the provider event endpoint failing.

### 9.6 Preserve action safety

The combined detail view will contain several actions with different consequences. Use clear grouping:

```text
Profile actions
├── Edit clinic
├── Manage credentials
├── Copy URLs
└── Archive or restore

Access actions
├── Start or extend Trial
├── Assign paid plan
├── Grant sponsored access
├── Grant exception
└── Revoke temporary access
```

Do not place archive, revoke, and paid-plan actions beside one another without visual distinction. Preserve reason requirements and confirmation steps.

### 9.7 Avoid a single overloaded detail panel

The selected clinic view will contain a lot of information. It should use sections or sub-tabs rather than one uninterrupted vertical page:

```text
Summary
Access
Usage
History
```

The Summary section should be the default. Access actions should be easy to find but should not overwhelm routine clinic information.

### 9.8 Keep configuration separate from operational review

Plan Policies changes affect multiple clinics and have draft/publish implications. The editor should remain a separate route or tab. The clinic detail should only show:

- Current effective policy version.
- Relevant plan name.
- The limits and features received by that clinic.
- A safe link to review policy configuration if the administrator has permission.

The clinic detail must not silently load an editable policy document.

---

## 10. Proposed Operations layout

This is a reference layout, not a final pixel design.

```text
Platform Operations                                      [Month] [Refresh]
Subscription access and BookMySlot service consumption

[Active clinics] [Subscription coverage] [Needs attention]
[Messages this period] [Tracked storage] [Operational signals]

Needs attention
[Clinic A — subscription pending] [Clinic B — storage 86%] [Clinic C — failed messages]

Messaging and service usage
[SMS] [WhatsApp] [Email]        [Accepted / Failed / Skipped]
[Six-month trend chart]         [Channel mix]

Tenant operations                         [Search tenants]
[All] [Needs attention] [Active] [Pending] [Archived]

Clinic | Subscription | Messages | Storage | Signals | Open
```

### Operations layout rules

- Do not show the full Messaging Usage KPI row again below the main KPI row.
- Keep the reporting month visible near the messaging totals.
- Keep attention cards actionable and clickable.
- Make the tenant table the main route into a clinic detail view.
- Retain explicit loading, retry, empty, and unavailable states.
- Do not make the storage or messaging summary look like financial reporting.

---

## 11. Proposed Clinics & Access layout

```text
Clinics & Access                              [Search clinics]

[All] [Active] [Needs attention] [Trial]
[Active paid] [Pending] [Archived]

Clinic directory                         Selected clinic
Clinic A · Active · Growth                Clinic A
Clinic B · Trial · Starter                Active · Growth
Clinic C · Payment pending                [Edit] [Credentials] [Archive]

                                          [Summary] [Access] [Usage] [History]
```

### Summary

- Clinic identity and status.
- City and contact details.
- Doctor count.
- Book URL and About URL actions.
- Storage source and basic operational signals.

### Access

- Effective plan.
- Requested plan.
- Subscription state.
- Billing cycle and provider link.
- Trial and paid-access dates.
- Sponsored access and exception state.
- Start/extend Trial, paid assignment, sponsored access, exception, and revoke actions.

### Usage

- Messaging by channel.
- Storage used and limit.
- Bookings, active doctors, and Smile Deals where available.
- Remaining values and over-limit warnings.
- Data measurement time and timezone.

### History

- Subscription lifecycle events.
- Provider events.
- Sponsored grants.
- Temporary exceptions.
- Revocations.
- Reason and actor for each administrative action.

---

## 12. Acceptance criteria for the complete optimisation

The complete optimisation is ready for release only when all of the following are true.

### Navigation

- The primary navigation no longer presents nine unrelated items with equal importance.
- Operations contains the Overview and useful Messaging Usage information.
- Clinics & Access contains active-clinic management and entitlement review.
- Plan Policies remains a separate catalog configuration workflow.
- Pending Review, Smile Deals, and Security & Audit remain reachable.
- Archived clinics remain reachable and restorable.

### Operations

- There is one shared reporting-month control.
- Messaging totals, trend, channel mix, and failure information are not duplicated unnecessarily.
- Tenant operations can be filtered, searched, and opened.
- Attention reasons are visible in plain language.
- Data errors and unavailable values are not shown as zero.
- The detail view contains subscription, messaging, storage, and provider information for the selected clinic.

### Clinics & Access

- There is one clinic search and selection experience.
- Active-clinic actions remain available.
- Effective access and subscription details remain available.
- Trial, paid-plan, sponsored-access, exception, and revoke actions retain their current safety rules.
- Subscription and provider history are not lost.
- Archived, pending, Trial, paid, and attention filters use documented inclusion rules.

### Responsive behaviour

- The navigation is usable on narrow screens.
- The clinic directory does not force critical actions off-screen.
- The selected-clinic detail sections stack correctly.
- Tables either fit, scroll within a clear boundary, or have an appropriate compact representation.
- Charts render with readable labels on desktop and mobile.

### Privacy and security

- No treatment revenue, patient bills, doctor earnings, or routine patient payment history is introduced.
- Admin route protection remains unchanged.
- Server-side authorization remains authoritative.
- Every mutation continues to record the required reason and lifecycle/audit information.

### Verification

- `npm run check` passes.
- `npm run build` passes.
- The Build Check workflow passes.
- The Start application workflow starts successfully.
- Representative desktop and narrow layouts have been reviewed.
- Empty, loading, error, unavailable, unknown, archived, pending, Trial, paid, sponsored, and exception states have been checked.

---

## 13. Suggested test matrix

| Scenario | Expected result |
|---|---|
| No clinics exist | Operations and Clinics & Access show clear empty states without errors. |
| Clinics request fails | Retry is available and clinic data is not shown as an empty successful result. |
| Messaging request fails | Messaging values show unavailable, not zero; other clinic data remains usable. |
| Storage request fails | Storage values show unavailable, not zero; attention classification does not claim healthy storage. |
| Clinic has zero messages | Zero is displayed as a real value when the report is available. |
| Clinic has failed messages | The clinic shows a clear delivery-health signal and opens messaging detail. |
| Subscription is legacy `unpaid` | It uses the shared pending-payment interpretation. |
| Subscription state is unknown | It remains visible as unknown and is not treated as active. |
| Clinic is archived | It is excluded from active counts and reachable through Archived. |
| Clinic is pending and archived | It follows one documented rule consistently in every count and filter. |
| Clinic is on Trial | Trial state and dates are shown; paid-plan action remains separate. |
| Clinic has sponsored access | Sponsored access is shown separately from paid subscription state. |
| Clinic has an exception | The entitlement and end date are visible; revocation requires a reason. |
| Provider event is unmatched | The event remains visible with its processing status. |
| Month changes | All Operations messaging sections update to the same period. |
| Selected clinic changes | Previous clinic detail is replaced and stale detail is not displayed. |
| Detail query fails | The clinic remains selected and retry is available. |
| Narrow mobile viewport | Navigation, directory, detail, tables, and charts remain usable. |
| Keyboard-only navigation | Tabs, filters, search, dialogs, sheets, and action buttons are reachable and understandable. |
| Unauthenticated access | The existing System Admin Login screen remains protected. |
| Clinic-private revenue data | It does not appear in the Operations or Clinics & Access workspace. |

---

## 14. Rollout and safety plan

### Recommended rollout order

1. Add shared policies and tests without changing the visible layout.
2. Introduce the Operations workspace while keeping the old Messaging Usage tab temporarily available behind the same data.
3. Verify metric parity between the old and new messaging views.
4. Introduce Clinics & Access while keeping Active Clinics and Entitlements temporarily available if a staged rollout is needed.
5. Verify all mutations and history records against the old workflows.
6. Remove duplicate top-level tabs only after parity and responsive checks pass.
7. Keep a checkpoint before removing the old navigation so rollback is straightforward.

### Important rollout checks

- Compare active, pending, archived, Trial, and paid counts before and after consolidation.
- Compare message totals, accepted counts, failed counts, and channel totals for the same month.
- Confirm storage totals and percentages are unchanged.
- Confirm selected clinic detail shows the same entitlement report and subscription history.
- Confirm mutation responses and invalidation behaviour remain unchanged.
- Confirm no new browser-accessible endpoint bypasses existing admin authorization.

### What should not be done during this optimisation

- Do not redesign the subscription data model as part of the navigation work.
- Do not introduce hard messaging enforcement merely because allowance values are visible.
- Do not merge clinic subscription billing with patient treatment billing.
- Do not add revenue KPIs to the Operations page.
- Do not rewrite the approval lifecycle without a separate policy decision.
- Do not remove audit or lifecycle records to simplify the UI.
- Do not replace unavailable values with zero for visual simplicity.

---

## 15. Final implementation summary

The recommended implementation is a controlled consolidation:

1. Build shared status, attention, data-availability, and clinic-filter rules.
2. Turn Overview and Messaging Usage into one Operations workspace.
3. Keep one page-level KPI row and one messaging detail area.
4. Use one selected-clinic detail surface for subscription, messaging, storage, and provider information.
5. Turn Active Clinics and Entitlements into one Clinics & Access workspace.
6. Keep clinic management actions and access actions together, but visually separated.
7. Keep Plan Policies, Pending Review, Smile Deals, and Security & Audit as separate workflows.
8. Make Archived a secondary clinic state instead of a primary operational tab.
9. Improve mobile navigation and dense data layouts after the information architecture is stable.
10. Verify privacy, authorization, lifecycle history, data availability, accessibility, and build health before release.

This approach reduces duplication without removing capability, keeps technical authority on the server, and gives Super Admins a clearer path from “something needs attention” to “this is the clinic and action involved.”