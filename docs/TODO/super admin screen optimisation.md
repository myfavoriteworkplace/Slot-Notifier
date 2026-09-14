# Super Admin Screen Optimisation

**Status:** Planning complete — foundation work completed; independent UI steps defined; UI consolidation remains  
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

### Implementation progress

The first foundation step has now been completed without changing the visible Super Admin layout:

- Added shared admin operations contracts for messaging and storage summaries.
- Added shared data-state interpretation for loading, available, empty, error, and unavailable data.
- Added shared storage warning thresholds.
- Added shared clinic attention reasons for subscription, storage, messaging, and entitlement signals.
- Updated the Operations Overview to use the shared attention and storage policies.
- Updated the Messaging Usage panel to use the shared messaging response types.
- Added pure tests for the shared policies.

The first independent filter step is now also complete:

- Added one shared clinic-filter contract for active, pending, archived, Trial, paid, sponsored, exception, attention, and unknown states.
- Made archived records take precedence over pending or approved lifecycle status.
- Kept sponsored-access and entitlement-exception filters conservative when server-backed access context is unavailable.
- Reused the shared filter rules in the current Operations, Entitlements, and main Admin clinic counts.
- Added pure tests for legacy subscription values, effective access overrides, archived/pending inclusion, attention, unknown, sponsored, and exception states.

The shared reporting-period step is now complete:

- Moved the messaging month state to the Admin page so Operations and Messaging Usage use one selected period.
- Added one shared `YYYY-MM` month helper and a parent-owned refresh action.
- Passed the same month into both messaging query surfaces, including selected-clinic detail queries.
- Replaced the Messaging Usage panel’s hardcoded UTC copy with the API-reported period timezone.
- Added a reporting-month test and verified the shared period behavior through type-checking and Build Check.

**SA-05 through SA-08 are now complete:** the Super Admin surfaces explicitly distinguish loading, unavailable, failed, refreshing, and delayed data for clinic directories, messaging usage, storage usage, entitlement history, and provider history. Real measured zero values remain visible as zero. The former Overview tab is now the Operations workspace with a single header, KPI area, attention area, tenant operations area, reporting-period control, and full operations refresh action. Messaging trend, channel mix, delivery outcomes, and clinic comparison now use the Operations workspace’s shared clinic detail surface without repeating the full Messaging Usage KPI row or opening a second clinic sheet. The Messaging Usage tab remains temporarily available for staged parity review, but its clinic rows open the same Operations detail surface. The shared clinic directory and Active Clinics/Entitlements consolidation have not started. The next independent implementation step is **SA-09: Consolidate clinic directory and entitlements**.

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

1. Operations
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
| Operations | `client/src/components/AdminOperationsOverview.tsx` | Platform KPIs, attention signals, tenant operations table, operations detail sheet |
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

The Operations workspace loads:

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

## 6. Independent implementation steps

The following steps are deliberately separated so each one can be implemented, reviewed, and tested as a standalone change. A step may still have a prerequisite; “independent” means that the step has one clear outcome and does not require an unrelated UI rewrite.

### Step definition

Each row is one reviewable implementation step. The step should be kept small enough to merge and verify on its own. Dependencies identify information or code that must exist first; they do not require the whole optimisation to be delivered in one branch.

| ID | Independent step | Scope | Likely files or areas | Direct prerequisite | Done when |
|---|---|---|---|---|---|
| SA-01 | Confirm the target navigation | Approve the names, order, and ownership of Operations, Clinics & Access, Plans & Policies, Pending Review, Smile Deals, and Security & Audit. Decide that Archived is a clinic-directory state. | `client/src/pages/Admin.tsx`, this document, product/design review | None | A signed-off navigation map exists and no implementation step needs to reinterpret the information architecture. |
| SA-02 | **Completed:** Keep shared admin policies authoritative | Retain the completed status, attention, storage, messaging, entitlement, and data-state helpers. Add any missing pure policy needed by later filters. Do not move authorization into the browser. | `shared/admin-operations.ts`, `shared/admin-operations.test.ts` | None; foundation is completed | Shared helpers define normal, warning, critical, unknown, unavailable, delayed, pending, archived, Trial, paid, sponsored, and exception interpretations with pure tests. |
| SA-03 | **Completed:** Define one clinic filter contract | Document and implement the inclusion rules for active, pending, archived, Trial, paid, sponsored, exception, attention, and unknown clinics. | `shared/admin-operations.ts`, `shared/admin-operations.test.ts`, `AdminOperationsOverview.tsx`, `AdminEntitlementReview.tsx`, `Admin.tsx` | SA-02 | Operations, Entitlements, and the main Admin lifecycle counts use the shared filter contract; sponsored and exception filters do not guess without server-backed access context. |
| SA-04 | **Completed:** Define the shared reporting-period state | Establish one owner for month, API timezone, refresh, query keys, and freshness. Preserve existing endpoint shapes. | `AdminOperationsOverview.tsx`, `AdminMessagingUsagePanel.tsx`, `Admin.tsx`, `shared/admin-operations.ts` | SA-02 | Admin owns one month and refresh action; both messaging panels, trends, comparisons, and selected-clinic details use that period and display the API-reported timezone. |
| SA-05 | **Completed:** Add explicit unavailable and delayed rendering | Replace remaining zero fallbacks for missing messaging, storage, entitlement, and provider data with unavailable, delayed, or error states. | `AdminOperationsOverview.tsx`, `AdminMessagingUsagePanel.tsx`, `AdminEntitlementReview.tsx`, `Admin.tsx` | SA-02 | A real measured zero is displayed as zero; missing or failed data never appears as a successful zero; failed reads offer retry and previous successful data is identified as delayed while refreshing. |
| SA-06 | **Completed:** Build the Operations workspace shell | Rename Overview as Operations and provide one header, KPI area, attention area, usage area, tenant area, period control, and refresh action. | `AdminOperationsOverview.tsx`, `Admin.tsx` | SA-01, SA-04, SA-05 | Operations clearly answers what is healthy, what needs attention, and which clinic should be opened next; the default Admin workspace is Operations and its refresh action covers clinic, messaging, and storage data. |
| SA-07 | **Completed:** Move messaging summary into Operations | Bring messaging totals, trend, channel mix, and failure information into Operations. Remove duplicate KPI groups while preserving useful detail. | `AdminMessagingUsagePanel.tsx`, `AdminOperationsOverview.tsx` | SA-04, SA-06 | Operations shows the shared reporting-period messaging trend, channel mix, accepted/skipped/failed outcomes, and existing error/delayed states without repeating the full Messaging Usage KPI row; the legacy tab retains clinic comparison/detail during staged parity review. |
| SA-08 | **Completed:** Create one Operations clinic detail surface | Replace separate Operations and Messaging Usage clinic sheets with one selected-clinic context containing operational, messaging, storage, and provider information. | `AdminOperationsOverview.tsx`, `AdminMessagingUsagePanel.tsx`, `Admin.tsx` | SA-04, SA-07 | A clinic opened from an attention card, tenant table, embedded messaging comparison, or legacy Messaging Usage comparison uses the same controlled detail sheet; the legacy tab remains available without owning a duplicate clinic sheet, and list state is preserved. |
| SA-09 | Define the Clinics & Access directory contract | Specify the directory columns, search fields, selection model, URL/state behavior, filters, archived handling, and mobile representation. | `Admin.tsx`, `AdminEntitlementReview.tsx`, `AdminOperationsOverview.tsx`, new shared directory types | SA-01, SA-03 | One clinic can be searched and selected without silently excluding a valid lifecycle or access state. |
| SA-10 | Build the Clinics & Access shell | Combine the directory and selected-clinic detail layout. Use a split layout on large screens and stacked layout on narrow screens. | New focused admin workspace component; `Admin.tsx`; `AdminEntitlementReview.tsx` | SA-09 | A selected clinic can be reviewed without switching between Active Clinics and Entitlements tabs. |
| SA-11 | Move clinic profile actions | Preserve edit clinic, credentials, booking/About URLs, archive, and restore actions in the shared detail view. | `Admin.tsx`, clinic mutation handlers, shared detail components | SA-10 | All current Active Clinics actions remain available with the same mutations, confirmations, and error handling. |
| SA-12 | Move effective access and entitlement details | Show the server-derived plan, access source, subscription state, important dates, limits, features, grants, exceptions, and unknown states. | `AdminEntitlementReview.tsx`, new detail components | SA-10; existing entitlement endpoints remain authoritative | The selected clinic view explains why access is active, Trial, paid, sponsored, exceptional, expired, pending, or unavailable. |
| SA-13 | Combine clinic history | Present lifecycle events, plan assignments, sponsored grants, entitlement exceptions, revocations, and provider events in one consistent history view. | `AdminOperationsOverview.tsx`, `AdminEntitlementReview.tsx`, admin subscription routes | SA-12 | A support user can understand access history in one place, and no history record is rewritten or removed. |
| SA-14 | Connect Pending Review to the selected clinic | Keep Pending Review as a queue, but link approval results directly to the same Clinics & Access view. Do not merge approval with paid activation. | Pending section in `Admin.tsx`, `AdminEntitlementReview.tsx` | SA-10; approved lifecycle policy | After approval, the administrator can open the clinic’s Access view and see the resulting Trial or access state. |
| SA-15 | Move Archived into the shared directory | Add archived filtering and restore actions to the shared directory. Keep archived clinics out of active counts according to the shared filter contract. | `Admin.tsx`, shared clinic directory | SA-03, SA-10 | Archived clinics remain reachable and restorable, and Pending, Active, and Archived counts use documented rules everywhere. |
| SA-16 | Keep Plan Policies separate and link effective versions | Leave draft/publish policy editing as a separate high-risk workflow. Show the effective policy version in clinic access details without embedding an editable policy document. | `AdminPlanPolicies.tsx`, `AdminEntitlementReview.tsx` | SA-12 | Policy editing remains separate, and a clinic detail can safely link to the relevant policy information. |
| SA-17 | Audit admin route authorization consistency | Review the repeated superuser checks and the narrower `isAdmin` middleware. Do not broaden access or change the server-authoritative model; make protection consistent only where safe. | `server/routes.ts`, admin route tests | None; independent backend safety review | Every Super Admin endpoint has an explicit, tested server-side authorization path, with no new browser-only permission assumption. |
| SA-18 | Redesign primary navigation responsively | Replace the nine-item equal-weight layout with grouped or compact navigation. Keep active state, keyboard access, focus visibility, and readable labels. | `Admin.tsx`, shared navigation styles | SA-01 | The primary navigation is usable on narrow screens and every workflow remains reachable. |
| SA-19 | Make clinic directory and detail responsive | Use compact cards or a stacked list on phones. Keep identity, access state, attention state, and primary action visible. | New directory/detail components; `AdminEntitlementReview.tsx`; shared styles if needed | SA-10 | No critical clinic action is hidden off-screen and detail sections stack predictably. |
| SA-20 | Make Operations tables and charts responsive | Keep clear scroll boundaries for genuinely tabular data and ensure charts have readable labels and stable dimensions. | `AdminOperationsOverview.tsx`, `AdminMessagingUsagePanel.tsx` | SA-06, SA-07 | Tables do not create page-level overflow and charts are readable at representative desktop and mobile widths. |
| SA-21 | Extract stable Admin workflow components | Split the large page at stable workflow boundaries without changing business rules. Suggested boundaries are `AdminShell`, `AdminOperations`, `AdminClinicsAccess`, `AdminPendingReview`, `AdminPlansPolicies`, `AdminGrowthContent`, and `AdminSecurity`. | `client/src/pages/Admin.tsx`, new components | SA-01; may proceed incrementally | `Admin.tsx` owns composition/authentication while each workflow owns its presentation and local state. |
| SA-22 | Add focused automated tests | Test policy helpers, clinic filters, period formatting, selection behavior, unavailable data, action visibility, and archived/pending inclusion rules. | Existing tests; new admin policy/filter/component tests | SA-02, SA-03; add alongside each UI step | Tests cover normal, empty, loading, error, unknown, unavailable, delayed, archived, pending, Trial, paid, sponsored, and exception states. |
| SA-23 | Complete accessibility review | Check headings, tab semantics, labels, focus order, dialogs/sheets, live regions, table headers, and contrast. Do not communicate status by colour alone. | All changed admin components | Review each UI step; final pass after SA-18 to SA-20 | Keyboard and assistive-technology users can navigate, understand, and complete every workflow. |
| SA-24 | Run final verification and release review | Run type check, production build, Build Check, application workflow, API smoke checks, responsive review, authorization checks, and privacy review. | Project workflows, admin routes, changed files | All applicable implementation steps | Workflows start, checks pass, admin protection remains intact, and no clinic-private revenue or clinical data appears. |

### Steps that can proceed in parallel

The steps below are independent once their direct prerequisites are satisfied:

- **Policy and contract track:** SA-02, SA-03, SA-05, and SA-22.
- **Operations track:** SA-04 through SA-08.
- **Clinics & Access track:** SA-09 through SA-16.
- **Safety track:** SA-17 and SA-23.
- **Responsive and maintainability track:** SA-18 through SA-21.

Parallel work must not create competing definitions for clinic filters, reporting periods, data availability, or effective access. Those concepts must remain shared.

### Recommended order for the complete delivery

The steps are independent deliverables, but this order minimizes rework:

1. **SA-01 to SA-05:** Confirm the destination and establish shared rules before building new screens.
2. **SA-06 to SA-08:** Consolidate Operations and messaging.
3. **SA-09 to SA-13:** Build the shared clinic directory, detail view, access sections, and history.
4. **SA-14 to SA-17:** Connect Pending, Archived, Plan Policies, and route authorization review.
5. **SA-18 to SA-21:** Finish navigation, responsive layouts, and component extraction.
6. **SA-22 to SA-24:** Complete tests, accessibility, build verification, and release review.

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