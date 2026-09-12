# Four-Plan Subscription and Entitlement Blueprint

**Status:** Commercial policy approved for implementation planning; sponsored-access and platform-revenue gaps resolved; automatic access enforcement and lifecycle automation remain deferred; reporting-only entitlement snapshots and audited Super Admin subscription operations are now available
**Related blueprints:** [Super Admin Platform Operations](14-super-admin-platform-operations-blueprint.md), [Messaging Allowance and Plan Policy](15-messaging-allowance-and-plan-policy-blueprint.md)  
**Audience:** Product, operations, support, finance, frontend, backend, database, QA, security, and platform teams  
**Application:** BookMySlot dental clinic platform  
**Primary goal:** Define a market-standard four-tier commercial model — Trial, Starter, Growth, and Pro — and provide the policy required to implement plan-based access safely and consistently.

---

## 1. Plain-language summary

BookMySlot already has three paid plan identifiers:

- `starter`
- `growth`
- `pro`

The public pricing page also describes different booking volumes, doctor counts, Smile Deal limits, analytics levels, messaging availability, transaction fees, and support levels.

The application does not yet have one central entitlement policy that enforces all of those differences across the backend and frontend. Most clinic dashboard modules are currently exposed independently of plan. The existing plan information therefore behaves primarily as subscription and presentation data rather than as a complete access-control system.

This blueprint proposes:

1. A **14-day Trial** that is temporary, limited, and does not require payment details.
2. **Starter** as the small-clinic paid plan.
3. **Growth** as the primary recommended plan for normal clinic operations.
4. **Pro** as the higher-volume and premium-visibility plan.
5. One shared entitlement catalog used by pricing, administration, clinic UI, backend authorization, messaging, storage, analytics, and audit records.
6. Server-side enforcement for every commercial limit.
7. A safe initial-Trial and post-paid-expiry recovery process that preserves clinic data and does not silently break essential clinical or security communication.
8. A Super Admin plan-management flow that can configure policies, assign a plan, extend a Trial, and assign a paid plan after a paid subscription expires.
9. A strict separation between paid subscription money, complimentary access, and clinic-private treatment revenue.

This document is a policy and implementation blueprint. The commercial policy in Section 19 is approved for implementation planning, but that approval does not authorize changing plan prices, Razorpay configuration, database schema, clinic access, or notification behavior. Those changes require the staged implementation and release gates described below.

---

## Implementation plan at a glance

This table is the approved high-level execution order. The individually executable tracking ledger follows it. The high-level rows separate the completed commercial decision gate from implementation work so that the application does not start blocking clinics before the rules are measured and the policy is versioned.

| Step | Purpose in common words | Main implementation work | Progress today | Done when |
|---|---|---|---|---|
| **0. Approve the rules** | Decide what each plan includes before anyone builds limits around it. | Confirm Trial duration, limits, grace period, messaging categories, booking counting, WhatsApp packaging, Pro fair use, payment grace, sponsored access, platform-revenue definitions, and transaction-fee scope. | **Complete for implementation planning.** The approved contract is recorded in Section 19. Transaction-fee calculation and exact inventory/pharmacy item-count thresholds are explicitly deferred. Sponsored access and platform subscription reporting are now defined separately from paid access and clinic treatment revenue. | The signed-off four-plan matrix, terminology, message categories, access-exception rules, revenue definitions, and decision log mark every item as Approved or Explicitly deferred. |
| **1. Record the current baseline** | Take a safe “before” snapshot so new restrictions do not accidentally break existing clinics. | Inventory current plan assignments, subscription states, Razorpay IDs, usage, storage, doctors, deals, bookings, and provider events. Identify clinics that would already be above a proposed Trial or paid limit. | **Development validation is complete; the production-clinic baseline was attempted but is blocked because this Repl has no production database attached.** The read-only generator is `scripts/subscription-baseline.ts`; the development report contains one active Starter clinic in pending-payment state, with 17 all-time bookings and an above-proposed-Trial-limit flag. The Render-clinic baseline remains required before production rollout or enforcement. | Development fixtures and the development report prove the calculations and unavailable-data handling; before production rollout, every production clinic has a known current plan, access state, usage snapshot, and migration/exception decision. |
| **2. Create one shared plan catalog** | Put the rules in one place instead of copying numbers across screens and routes. | Define `trial`, `starter`, `growth`, and `pro`; centralize limits, feature levels, messaging allowances, warnings, and policy versions; add resolution tests. | **Development consumer migration complete; policy registry foundation now implemented.** The shared published catalog contains the approved four-plan limits, feature levels, messaging allowances, annual prices, annual-savings calculation, explicit deferrals, and unknown-plan handling. Public pricing, registration, landing-page pricing copy, activation pricing/labels, and storage quota resolution read from the catalog. A separate persistent registry now stores draft/published policy documents; live consumer cutover remains deferred. | Draft and published policies are distinct; historical versions are immutable; annual savings are calculated; all consumers have a migration plan away from hardcoded values. |
| **3. Add subscription, Trial, assignment, and exception history** | Make “which plan” different from “is this clinic currently allowed to use it?” | Add or normalize Trial start/end/grace dates, Trial origin, previous paid plan, paid-expiry time, conversion history, assignment history, policy version references, transition identity, sponsored-access grants, and time-limited exceptions. Keep legacy `unpaid` readable. | **Complete for the lifecycle/history data contract.** Nullable current-lifecycle columns, append-only lifecycle events, plan assignments, sponsored-access grants, and time-limited entitlement exceptions are registered in the shared schema and startup SQL. Storage exposes insert/read methods without enabling transitions or enforcement. | The system can explain initial Trial, paid conversion, renewal, expiry, recovery, extension, downgrade, sponsored access, exception, and later paid assignment without reconstructing history manually. |
| **4. Build the effective-entitlement service** | Give every part of the app the same answer about what a clinic may do right now. | Resolve clinic → plan → subscription/Trial state → policy defaults → temporary exception → emergency disablement; return value, source, usage, limit, and stable error code. | **Complete in reporting-only mode.** `shared/effective-entitlement.ts` resolves the published policy, normalized state, sponsored plan, exceptions, usage, limits, freshness, and reason codes without enforcement. Clinic and Super Admin read-only endpoints use the same server resolver. | A single server-side service answers both “what is included?” and “is this action allowed?” before enforcement is enabled. |
| **5. Calculate usage in reporting-only mode** | Measure first, without blocking anyone. | Calculate booking, doctor, Smile Deal, storage, SMS, WhatsApp, email, analytics, and export usage; show used, limit, remaining, reset/expiry date, timezone, and data freshness. | **Reporting-only foundation complete for booking, doctor, Smile Deal, storage, and messaging.** Analytics/export usage and a dedicated UI remain future work; unknown or unavailable values remain explicit. | At least one complete reporting period proves the numbers are accurate and unavailable data is not shown as zero. |
| **6. Build the read-only Subscription Plans Admin area** | Let operations review the model and its impact before mutations are enabled. | Add separate Plan Policies and Clinic Subscription Management views with published policy, versions, provider mappings, usage impact, affected clinics, Trial history, exceptions, and provider history. | **Complete for the read-only entitlement review stage.** The Admin Entitlements tab lists searchable clinics and loads the shared Super Admin report for the selected clinic, including plan source, policy version, access state, dates, usage, limits, remaining values, feature packaging, exceptions, and sponsored access. The separate Plan Policies panel now provides policy registry review and editing without changing live consumers. | Read-only views are role-protected, responsive, backed by real data, and distinguish catalog price, provider price, policy version, and clinic exception. |
| **7. Add draft → review → validate → publish policy workflow** | Make global commercial changes deliberate and auditable. | Add draft editing, required reasons, validation, calculated savings, provider-mapping checks, impact preview, explicit publish confirmation, immutable versions, and policy audit records. | **Implemented as a safe registry workflow; live cutover remains deferred.** Super Admin-only routes and the Admin Plan Policies tab support draft create/update, server validation, calculated annual savings, provider-mapping readiness, impact preview, explicit confirmation, previous-version links, immutable published history, and audit metadata. Publication is blocked when paid provider mappings are incomplete and does not reprice existing subscriptions. | Invalid or incomplete policies cannot publish, and publishing never changes an existing Razorpay subscription by itself. |
| **8. Implement Trial creation, conversion, expiry, and recovery** | Give new clinics a safe trial and give expired paid clinics a short, controlled chance to recover. | Start Trial once, calculate expiry/grace dates, warn before expiry, move confirmed paid expiry to recovery Trial, preserve old plan/provider history, and make the transition idempotent. | **Partial, upgraded.** Clinic approval now starts the catalog-defined Trial once, and Razorpay completed/expired events move eligible paid clinics into an idempotent recovery Trial while preserving the previous paid plan and provider history. Trial conversion, expiry processing after grace, and clinic-facing lifecycle notices remain outstanding. | Repeated provider events cannot restart a Trial, and expiry never deletes data or silently leaves paid access active. |
| **9. Add safe Super Admin plan operations** | Let authorized staff manage plans safely without editing clinic rows directly. | Add Start Trial, Extend Trial, Assign Paid Plan after expiry, Grant Sponsored Access, reasons, confirmation, role checks, audit events, stale-state protection, and provider-aware activation. | **Partial, upgraded.** Super Admin can Start or Extend Trial, assign paid plans through a provider-aware pending-payment workflow, grant sponsored access, and add entitlement exceptions through audited dedicated routes. | Every manual plan or access change is authorized, confirmed, explainable, audited, time-bounded where applicable, and safe against provider/admin races. |
| **10. Complete provider lifecycle and commercial alignment** | Ensure the screen, database, and payment provider never disagree. | Verify plan/cycle mapping, Trial-to-paid conversion, recovery-Trial-to-paid assignment, upgrades, downgrades, payment grace, webhook reconciliation, idempotency, historical policy references, and payment/refund/chargeback reconciliation. | **Partial, upgraded.** Razorpay plan mapping, provider-event history, paid activation, and completed/expired subscription recovery are present; Trial conversion, upgrades/downgrades, webhook reconciliation beyond recovery, and a financial ledger do not. | A paid plan is activated only through the approved provider/payment path, expired provider subscriptions are never reused accidentally, and platform-revenue reports distinguish captured, refunded, settled, and complimentary amounts. |
| **11. Add clinic and Admin visibility** | Make it obvious why a clinic has access, what it has used, and what happens next. | Add plan/state/usage panels, Trial and recovery notices, expiry dates, upgrade/support paths, above-limit warnings, and Super Admin filters/details. | **Partial foundation.** Super Admin entitlement visibility now includes Start/Extend Trial controls and Trial dates; clinic-facing entitlement visibility, upgrade/support paths, warning records, and full Trial/recovery presentation remain. | A clinic can understand its plan without technical terms, and Super Admin can find attention cases quickly. |
| **12. Turn on warnings before restrictions** | Give people time to act instead of suddenly stopping work. | Add 80% and 95% warnings, Trial expiry reminders, operational alerts, warning audit records, and upgrade/support guidance. | **Not started as a unified system.** Individual usage displays exist, but shared thresholds and audit events do not. | Warnings are accurate, explainable, timezone-aware, and do not consume the clinic’s own allowance. |
| **13. Enforce limits on the server** | Actually apply the plan rules securely; hiding a button is not enough. | Enforce doctor, booking, deal, storage, analytics, export, and messaging rules in backend routes/services; protect essential clinical/security messages; return structured errors. | **Not started.** Current dashboard modules are generally available independently of plan. | Every restricted operation is checked server-side and gives a clear reason when denied; existing data remains visible. |
| **14. Release gradually, monitor, and refine** | Learn from real usage before making the limits permanent. | Run policy tests, authorization tests, counting/privacy tests, Build Check, reporting comparison, warning rollout, controlled optional-message enforcement, monitoring, and versioned allowance changes. | **Not started.** The blueprint defines tests and rollout stages, but no four-plan rollout has begun. | At least one or two complete usage periods are reviewed; release gates pass; support and provider reconciliation procedures exist. |

### Individually executable progress ledger

The high-level table above is useful for communicating the roadmap, but it is too broad for execution tracking. The following ledger was revalidated against the repository on **2026-09-12 (Asia/Calcutta)**. Each row is an independently executable step. A later step must not be reported complete because an earlier step in the same group is only partially complete.

| Group | Step | Independently executable work | Dependency | Current status | Completion evidence |
|---|---|---|---|---|---|
| Policy and verification | **0. Approve the rules** | Confirm the four-plan matrix, Trial duration and grace, message categories, counting rules, WhatsApp packaging, Pro fair use, payment grace, sponsored access, platform-revenue definitions, and explicit deferrals. | None | **Complete for implementation planning.** Section 19 records the approved contract. Transaction-fee calculation and exact inventory/pharmacy item-count thresholds remain deferred. | Every policy item is marked Approved or Explicitly deferred in Section 19. |
| Policy and verification | **1. Repair and run policy-impact verification** | Repair the baseline-policy fixture test, run the catalog and fixture suites, and record the result. Do not connect to or mutate production data. | Step 0 | **Complete.** The missing test closure was repaired; all 9 baseline-policy tests pass, all 7 catalog tests pass, TypeScript checking passes, and Build Check finished successfully. | `npm run test:subscription-baseline`, catalog tests, `npm run check`, and Build Check pass; results are recorded in Section 22. |
| Policy and verification | **2. Validate representative development data** | Exercise Trial, Starter, Growth, Pro, legacy `unpaid`, unknown-plan, below/at/above-limit, and unavailable-data cases using fixtures or populated development data. | Step 1 | **Complete for development validation.** The fixture suite passes and the read-only generator now reports one active development Starter clinic in pending-payment state. The production-clinic baseline remains deferred. | Fixtures cover every required boundary, the development report is privacy-safe, and missing data is not treated as zero. |
| Policy and verification | **3. Complete the production baseline gate** | Run the read-only baseline against Render PostgreSQL or an approved populated snapshot, then record each clinic’s plan, state, usage, and migration/exception decision. | Steps 1–2; before production rollout or enforcement only | **Deferred by design.** Not required for development catalog work, mandatory before production enforcement. | Every production clinic has a migration decision and the report contains no credentials, patient data, or unnecessary PII. |
| Shared policy foundation | **4. Publish the shared plan catalog** | Maintain stable plan keys, versioned policy metadata, limits, feature levels, allowances, annual savings, explicit deferrals, and unknown-plan handling. | Step 0 | **Complete for the current development stage.** `shared/plan-catalog.ts` contains Trial, Starter, Growth, and Pro. | Catalog tests pass and unknown plans do not silently become Starter. |
| Shared policy foundation | **5. Migrate plan-value consumers** | Make pricing, registration, landing-page copy, activation labels/prices, storage quota resolution, and Admin storage reporting consume the catalog. | Step 4 | **Complete for the current development stage.** Deferred transaction-fee percentages were removed from public comparison. | Consumer migration and focused build evidence are recorded in Section 22. |
| Subscription lifecycle | **6. Add lifecycle and history data** | Add Trial dates, Trial origin, previous paid plan, paid-expiry time, conversion/assignment history, policy references, transition identity, sponsored-access grants, and time-limited exceptions while keeping legacy `unpaid` readable. | Steps 1–5 | **Complete for the lifecycle/history data contract.** Current lifecycle columns, append-only history tables, storage contracts, and startup SQL are present; automatic transitions remain deferred. | Schema, idempotent migration, storage contract, audit model, and Render SQL exist; historical transitions are explainable. |
| Subscription lifecycle | **7. Build the Trial and recovery state machine** | Implement initial Trial, seven-day read-only grace, confirmed paid-expiry recovery Trial, conversion, expiry, origin, previous-plan preservation, timezone boundaries, and provider-expiry idempotency. | Step 6 | **Partial.** Initial Trial creation on clinic approval and Razorpay completed/expired recovery are implemented with append-only history and transition IDs. Conversion, post-grace expiry processing, and clinic-facing notices remain. | Boundary and provider-race tests pass; data is preserved and no endless free loop is possible. |
| Entitlement foundation | **8. Build the effective-entitlement service** | Resolve clinic → plan → subscription/Trial state → policy → exception → emergency disablement, returning capability, value, source, usage, limit, freshness, and stable reason/error code. | Steps 6–7 | **Complete in reporting-only mode.** The shared resolver and database-backed usage aggregator are implemented; lifecycle transitions and enforcement remain disabled. | One server-side service is used by reporting and future authorization; unknown state and unavailable usage are explicit. |
| Reporting | **9. Add reporting-only usage and entitlement views** | Calculate booking, doctor, Smile Deal, storage, messaging, and feature usage; expose used, limit, remaining, period, timezone, freshness, and above-limit status without blocking actions. | Step 8 | **Partial, upgraded.** Clinic and Super Admin read-only endpoints now expose the cross-capability report; dedicated UI, analytics/export measurements, and full production-period validation remain. | Clinic and Super Admin reports agree with the entitlement service and remain non-enforcing. |
| Super Admin operations | **10. Add dedicated plan policy and assignment operations** | Add policy configuration, Start Trial, Extend Trial, Assign Paid Plan after expiry, Sponsored Access, mandatory reasons, confirmation, role checks, one-active-grant rules, stale-state protection, audit events, and provider-aware activation. Remove unrestricted plan mutation from generic clinic editing. | Steps 6–9 | **Partial, upgraded.** Dedicated audited Trial operations, paid-plan assignment preparation, sponsored-access, entitlement-exception routes, Admin filters, lifecycle history, and the separate versioned Plan Policies registry are implemented. Policy revocation, provider reconciliation, live policy cutover, and removal of the legacy approval mutation remain outstanding. | Every action has a dedicated validated route, authorization, audit record, confirmation, race protection, and provider-state behavior. |
| Provider and finance | **11. Align provider lifecycle and subscription finance** | Complete Trial conversion, recovery-to-paid assignment, upgrades, downgrades, payment grace, webhook reconciliation/idempotency, policy references, and the restricted captured/refunded/chargeback/settlement/manual-payment ledger. | Steps 6–10 | **Partial foundation.** Razorpay mapping, subscription creation, activation handling, and provider-event history exist; lifecycle reconciliation and financial ledger do not. | Provider and database states reconcile; complimentary access is separate from captured cash and clinic treatment revenue. |
| Product visibility | **12. Add clinic and Admin access visibility** | Show plan, effective state, usage, Trial/recovery dates, expiry, upgrade/support paths, above-limit warnings, active exceptions, and Super Admin attention filters/details. | Steps 8–10 | **Partial, upgraded.** The Super Admin Entitlements tab now provides the effective report, attention/trial/paid filters, important dates, capability usage/limits, feature values, sources, exceptions, sponsored access, and append-only lifecycle history. Clinic-facing visibility and warning guidance remain. | Clinic users can explain their access; Super Admin can find every attention state. |
| Warning mode | **13. Add pre-enforcement warnings** | Add 80% and 95% warnings, Trial expiry reminders, operational alerts, upgrade/support guidance, warning audit records, timezone-aware copy, and unavailable-data handling. | Steps 9 and 12 | **Not started as a unified system.** Individual usage displays exist, but shared thresholds and warning records do not. | Warning tests pass and warnings do not consume the clinic’s own allowance. |
| Enforcement | **14. Enforce limits selectively on the server** | Enforce doctor, booking, Smile Deal, storage, analytics, export, and optional/promotional messaging rules; protect essential messages; return structured errors; preserve existing data and approved exceptions. | Steps 3, 8, 9, 13 | **Not started.** Dashboard modules remain generally available independently of plan. | Direct API calls receive the same authorization result as the UI; protected clinical/security workflows remain available. |
| Release and refinement | **15. Release gradually and monitor** | Compare reporting with current behavior, run policy/authorization/counting/privacy tests, deploy warning mode, enable selected enforcement, monitor support/provider reconciliation, and version allowance changes. | Steps 3, 9, 11, 13, 14 | **Not started.** No four-plan enforcement rollout has begun. | One or two complete usage periods are reviewed and all release gates pass. |
| Release and refinement | **16. Commercial refinement** | After real usage, review conversion, support burden, quota failures, messaging cost, and provider behavior; change allowances only through a versioned policy decision. | Step 15 | **Deferred.** This cannot begin before real usage periods are available. | Any change has measured evidence, an approved policy version, migration handling, and updated public copy/tests. |

### What this means in common-man terms

Think of a plan as a membership package and an entitlement as the rule that checks whether a particular action is included in that package.

- **Trial** is a short test period, not a permanent free plan.
- **Starter, Growth, and Pro** are paid packages with different amounts of usage and different advanced features.
- **Plan** answers “what package does this clinic have?”
- **Subscription state** answers “is that package currently active, waiting for payment, expired, or in a recovery period?”
- **Usage** answers “how much of the package has the clinic already used?”
- **Entitlement checking** is the security guard that checks every important action on the server. It must work even if someone bypasses the screen and calls the API directly.
- **Reporting mode** means we measure what would happen without blocking anyone yet.
- **Warning mode** means we tell the clinic it is getting close to a limit.
- **Enforcement mode** means selected actions are finally stopped when the approved limit is reached.
- **Recovery Trial** means an expired paid clinic keeps a smaller, temporary level of access while it renews or contacts support. It does not keep its old paid limits forever.
- **Existing data is never deleted** just because a clinic downgrades or expires. New restricted activity is controlled instead.

The safest order is therefore: **agree the rules → measure current usage → build one shared policy → add Trial states → show reports → warn → enforce carefully → connect payment changes → refine using real data**.

---

## 2. Current system baseline

### 2.1 Current paid pricing

The current public pricing baseline is:

| Plan | Monthly | Annual | Current advertised purpose |
|---|---:|---:|---|
| Starter | ₹999/month | ₹9,990/year | Small clinic with low booking volume |
| Growth | ₹1,599/month | ₹15,990/year | Regular clinic activity |
| Pro | ₹2,999/month | ₹29,990/year | High-volume or premium clinic |

The annual prices are approximately ten months of monthly pricing, giving an effective two-month annual discount.

The corresponding annual savings are:

| Plan | Annual price | Saving versus twelve monthly payments |
|---|---:|---:|
| Starter | ₹9,990/year | ₹1,998 |
| Growth | ₹15,990/year | ₹3,198 |
| Pro | ₹29,990/year | ₹5,998 |

These savings should be shown clearly when the annual billing option is selected. The Pro saving is ₹5,998, calculated as ₹35,988 in monthly payments minus ₹29,990 annually.

This blueprint recommends keeping these prices initially. Packaging and enforcement should be corrected before price optimization is attempted.

### 2.2 Current advertised differences

The current pricing page describes:

| Capability | Starter | Growth | Pro |
|---|---|---|---|
| Bookings | Up to 30/month | Up to 150/month | Unlimited |
| Doctors | 1 | Up to 3 | Unlimited |
| Smile Deals | 1 post | 3 posts | Unlimited |
| Transaction fee | 5% | 3% | 1.5% |
| WhatsApp notifications | Not advertised | Included | Included |
| Analytics | Basic | Advanced | Full |
| Verified badge | No | No | Included |
| Featured deal placement | No | No | Included |
| Support | No support tier shown | Email | Email and phone |

These are current marketing values, not yet a complete, centrally enforced entitlement contract.

### 2.3 Existing infrastructure

The repository already contains useful pieces:

- Clinic plan and subscription fields.
- Monthly and annual Razorpay configuration for Starter, Growth, and Pro.
- Shared subscription-state normalization.
- Subscription provider event history.
- Per-message usage recording for SMS, WhatsApp, and email.
- Storage quotas:
  - Starter: 100 MB
  - Growth: 500 MB
  - Pro: approximately 2 GB
- Super Admin messaging and storage usage views.
- Clinic-facing messaging and storage settings.
- Audit logging for several clinic operations.
- Public pricing presentation for the three paid plans.

### 2.4 Current gaps

The following gaps must be treated as part of the four-plan work:

- No Trial lifecycle or trial expiry state.
- No default transition from an expired paid plan into a controlled Trial/recovery state.
- No Super Admin action for assigning or extending Trial on an existing clinic.
- No dedicated, provider-safe action for assigning a paid plan after paid expiry.
- No central plan entitlement catalog.
- No complete server-side enforcement for advertised booking, doctor, deal, analytics, or messaging differences.
- No consistent plan-aware access response for every clinic route.
- No unified distinction between:
  - plan entitlement,
  - subscription state,
  - temporary support exception,
  - feature emergency disablement.
- No approved trial-expiry behavior.
- No approved rule for which messages are essential, routine, optional, or test.
- No complete audit trail for entitlement decisions and quota blocks.
- No final decision on whether essential WhatsApp notifications should be available on Starter.
- The public pricing page does not show Trial as the primary low-friction entry point.
- The public pricing page does not clearly show messaging allowances, storage limits, annual savings, or the units for volume limits.
- The public pricing page does not provide a consistent upgrade explanation from Starter to Growth or Pro.

---

### 2.5 Pricing page alignment requirements

The public pricing page is a presentation layer for the shared plan catalog. It must not become a separate source of plan rules or make commercial promises that the entitlement system cannot explain.

The updated pricing experience should:

- Show **Trial** as the primary entry point for a new clinic.
- Present Trial as a free, temporary evaluation option rather than as a Razorpay-paid plan.
- State that Trial requires no payment card unless the approved commercial policy changes.
- Describe Trial as access to the **core clinic workflow with controlled limits**, not as an unrestricted full-feature plan.
- Keep Growth visually recommended without implying that Starter is unsafe or unusable.
- Use unambiguous units such as “Up to 30 bookings per month” rather than “Up to 30 / mo.”
- Show separate SMS, WhatsApp, and email allowances, including whether each allowance is Trial-lifetime or calendar-month based.
- Show storage limits because clinic files may include X-rays, consent documents, and clinical photos.
- Show the annual price and the saving against twelve monthly payments:
  - Starter: ₹9,990/year, save ₹1,998.
  - Growth: ₹15,990/year, save ₹3,198.
  - Pro: ₹29,990/year, save ₹5,998.
- Explain what a clinic gains when moving from Starter to Growth or Pro, including booking capacity, doctor capacity, messaging allowances, storage, analytics, and advanced workflows.
- Use Starter WhatsApp wording that distinguishes essential appointment notifications from advanced, bulk, or promotional workflows. This wording must remain conditional until the Starter WhatsApp decision is approved and the capability is available.
- Either omit transaction-fee percentages or label them clearly as planned/unfinalized until the fee scope, calculation, reconciliation, and enforcement policy are approved.

The pricing page should read these values from the shared versioned plan catalog when implementation begins. Hardcoded marketing values must not drift from the entitlement policy.

---

## 3. Product principles

The following principles govern the plan model.

### 3.1 Trial is temporary, not a permanent free plan

Trial should help a clinic understand the product and complete a realistic workflow. It should not become an unrestricted free operating tier.

The same Trial entitlement can be used for two controlled purposes:

1. **Initial Trial:** the clinic evaluates BookMySlot before subscribing.
2. **Post-paid-expiry recovery Trial:** a previously paid clinic gets a temporary, capped recovery period after its paid subscription expires so the platform does not abruptly remove all operational access while the clinic is being reactivated.

The post-paid-expiry recovery Trial is not a reset of the clinic’s original acquisition Trial. It must have an explicit origin and must not create an endless free loop.

### 3.2 Core healthcare workflows remain available

Patient data, clinical history, consent, billing records, basic appointment management, and data portability should not be artificially removed from lower paid plans.

Commercial differentiation should focus on:

- Volume.
- Messaging allowance.
- Storage allowance.
- Analytics depth.
- Automation.
- Public visibility.
- Premium support.
- Advanced operational features.

### 3.3 Server-side enforcement is mandatory

Hiding a navigation item or disabling a button is not plan enforcement. Every restricted operation must be checked on the server using the effective entitlement for the clinic.

### 3.4 Data must never disappear at expiry or downgrade

When an initial Trial expires, a paid subscription expires, or a clinic downgrades:

- Existing data remains preserved.
- The clinic receives a clear explanation.
- New restricted activity is controlled explicitly.
- Export and data-access rights remain available.
- No records are silently deleted.
- A paid subscription expiry first moves the clinic into the controlled Trial/recovery state defined in this document.
- A later Trial/recovery expiry changes access state explicitly; it does not silently reactivate a paid plan.

### 3.5 Essential communication must be protected

OTP, security, consent, booking confirmation, and other essential platform messages must not be silently blocked because a commercial allowance was reached.

### 3.6 Plan limits must be explainable

Every limit should have:

- A plain-language name.
- A current value.
- Used amount.
- Remaining amount.
- Reset or expiry date.
- Timezone where relevant.
- An explanation of what counts.
- A path to upgrade or contact support.

### 3.7 Existing paid plan identifiers remain stable

The existing identifiers `starter`, `growth`, and `pro` should not be renamed. Existing clinics and provider configuration depend on their stability.

---

## 4. Recommended four-tier model

### 4.1 High-level structure

| Tier | Commercial role | Recommended duration or price |
|---|---|---|
| **Trial** | Temporary evaluation tier with a complete but capped experience | Free for 14 days |
| **Starter** | Small or single-doctor clinic | ₹999/month or ₹9,990/year |
| **Growth** | Normal operating clinic and recommended plan | ₹1,599/month or ₹15,990/year |
| **Pro** | Established, high-volume, or premium-visibility clinic | ₹2,999/month or ₹29,990/year |

Trial is a lifecycle tier rather than a Razorpay-paid plan. It should not require a Razorpay plan ID.

### 4.2 Recommended complete matrix

| Capability | Trial | Starter | Growth | Pro |
|---|---:|---:|---:|---:|
| Duration | 14 days | Ongoing while active | Ongoing while active | Ongoing while active |
| Bookings | 10 total during trial | 30/month | 150/month | Unlimited, subject to fair use |
| Doctors | 1 | 1 | 3 | Unlimited, subject to fair use |
| Smile Deal posts | 1 trial post or draft | 1 live post | 3 live posts | Unlimited |
| Storage | 50 MB | 100 MB | 500 MB | Approximately 2 GB |
| SMS allowance | 25/month-equivalent trial allowance | 100/month | 500/month | 2,000/month |
| WhatsApp allowance | 25/month-equivalent trial allowance | 100/month | 500/month | 2,000/month |
| Email allowance | 50/month-equivalent trial allowance | 300/month | 1,500/month | 6,000/month |
| Analytics | Basic snapshot | Basic | Advanced | Full |
| Data export | One export during trial | Standard export | Advanced or scheduled export | Full export and priority processing |
| Public clinic profile | Yes, with Trial branding | Yes | Yes | Yes |
| Premium verified badge | No | No | No | Yes |
| Featured deal placement | No | No | No | Yes |
| Support | Help center and onboarding guidance | Standard email | Priority email | Priority email and phone |

“Unlimited” must not mean that the platform has no abuse protection. Pro should have a documented fair-use safeguard, operational monitoring, and a support path rather than an undisclosed arbitrary cap.

---

## 5. Trial policy

### 5.1 Trial purpose

The Trial should answer a clinic’s practical questions:

- Can staff configure slots?
- Can the clinic add a doctor?
- Can a patient book?
- Can the clinic manage the appointment?
- Can staff view patient history?
- Can staff create a bill?
- Can staff use consent forms?
- Can staff try inventory and pharmacy workflows?
- Can staff see analytics?
- Can the clinic receive appointment communication?
- Can the clinic understand the public website and Smile Deal experience?

The Trial should not be an artificial brochure. It should allow the clinic to complete the main workflow with controlled volume.

For public-facing copy, “core clinic workflow” means the clinic can test the central booking, appointment, patient, consent, billing, communication, and basic operational experience within Trial limits. It does not mean that every advanced Growth or Pro capability is included.

### 5.2 Trial duration

Approved policy:

- 14 calendar days.
- An initial Trial starts when the clinic is activated by the platform. The first authenticated session does not delay the start.
- An administrator-granted Trial starts when the grant is recorded.
- A paid-expiry recovery Trial starts at the confirmed paid-expiry timestamp.
- The start event must be recorded once and must not reset merely because the clinic logs out.
- The exact start and end timestamps should be stored.
- The clinic timezone should be used for the human-facing expiry date.
- The server should use unambiguous timestamps for access decisions.

The product should not offer repeated automatic trials to the same clinic without an explicit, audited administrator decision.

### 5.3 Trial payment details

Approved policy: do not require a payment card or Razorpay payment method to start the Trial.

Reasons:

- Reduces onboarding friction.
- Avoids charging or authorization confusion.
- Makes the Trial genuinely useful for clinics evaluating the workflow.
- Keeps the paid conversion decision explicit.

The platform may request billing details when the clinic chooses a paid plan, not before the Trial begins.

### 5.4 Trial limits

Approved initial limits:

| Limit | Trial policy |
|---|---|
| Bookings | 10 total during the trial, not 10 per calendar month |
| Doctors | 1 configured doctor |
| Smile Deals | 1 trial post or draft |
| Storage | 50 MB |
| SMS | 25 accepted or billable messages during the trial |
| WhatsApp | 25 accepted or billable messages during the trial |
| Email | 50 accepted or billable messages during the trial |
| Analytics | Basic snapshot |
| Export | One export |
| Premium visibility | Not available |

The messaging values are trial allowances, not a promise of unlimited free messaging. Essential service messages still require a separate protection rule.

### 5.5 Trial expiry

Approved expiry sequence:

1. Seven days before expiry:
   - Show an in-product notice.
   - Show the expiry date.
   - Explain the Starter, Growth, and Pro options.
2. Two days before expiry:
   - Show a higher-priority reminder.
3. At expiry:
   - Preserve all data.
   - Stop new Trial-only activity that exceeds the Trial limits.
   - Stop new public bookings immediately, including during grace.
   - Keep the public clinic profile visible with a clear booking-unavailable or upgrade message.
   - Do not silently delete the public profile, patient data, or clinical records.
4. Grace period:
   - Provide exactly seven calendar days of read-only grace, ending at `trial_grace_ends_at`.
   - Permit login, viewing existing records, support contact, security/account-recovery messages, and one standard data export.
   - Do not permit new bookings, new public bookings, new restricted records, uploads, or unrestricted Trial messaging.
5. After grace period:
   - Keep the account and data available for upgrade, support, and standard authenticated export.
   - Keep required appointment, security, and consent notifications for already-created records protected and auditable.
   - Do not treat an expired Trial as an active paid subscription.

The seven-day grace period must be stored and displayed rather than inferred only from UI state. The same read-only and non-bookable behavior applies after a recovery Trial ends, while preserving the previous paid-plan history.

### 5.6 Trial conversion

When the clinic selects a paid plan:

- The chosen paid plan becomes effective according to the approved billing policy.
- Previously used Trial usage should not be erased from historical reporting.
- Current-period paid allowances should be calculated using the approved upgrade rule.
- The conversion event should be audited.
- The clinic should not be charged twice because of a Trial-to-paid transition.

Approved conversion rule: the paid plan becomes effective immediately after successful subscription activation. Usage already consumed during the Trial remains in historical reporting but does not consume the paid plan’s first calendar-month allowance. A duplicate activation event must not reset the allowance again in the same local calendar month.

### 5.7 Paid-plan expiry automatically enters Trial/recovery

The approved default behavior is:

> When an active paid Starter, Growth, or Pro subscription reaches a confirmed expiry, the clinic automatically moves to the Trial plan with `trialing` access for a controlled recovery period.

This is a deliberate access-preservation policy. It gives the clinic a clear opportunity to contact the platform or be assigned a new paid plan by an application administrator, while applying the smaller Trial limits instead of silently continuing the expired paid entitlements.

#### Trigger conditions

The fallback must occur only when the paid subscription is genuinely expired:

- A verified provider event confirms expiry, cancellation at the end of the paid term, or non-renewal.
- The stored paid subscription period has ended and the provider status has been reconciled.
- A Super Admin explicitly confirms expiry through an audited administrative action.

The following should not immediately trigger the recovery Trial:

- A temporary provider outage.
- An unprocessed or unmatched webhook.
- A short payment retry period.
- A `past_due` state that still has an approved payment grace period.
- An unknown provider value.

Those states remain visible as attention states until reconciled.

#### Recovery Trial behavior

When the transition is applied:

1. The effective plan becomes `trial`.
2. The access state becomes `trialing`.
3. The Trial origin is recorded as `paid_expiry`.
4. The previous paid plan is preserved.
5. The previous paid subscription/provider identifier remains historical and is not reused as an active Trial subscription.
6. The recovery Trial starts at the confirmed expiry time.
7. The recovery duration is exactly 14 calendar days.
8. The Trial limits in Section 5.4 apply immediately.
9. Essential security, OTP, consent, and appointment messages remain protected.
10. The clinic sees the Trial end date and a clear option to contact support or request a paid plan.

The clinic must not silently retain the old Growth or Pro limits after paid expiry.

#### Existing usage above Trial limits

A previously paid clinic may already exceed Trial limits when it enters recovery. The system must not delete or deactivate existing data merely to fit the smaller limits.

Instead:

- Existing doctors, deals, files, appointments, patient records, and clinical records remain visible according to authorization.
- New activity that would increase a restricted count beyond the Trial limit is blocked with an explainable message.
- Existing storage above the Trial limit is preserved, but new uploads are blocked until the clinic upgrades, removes files, or receives an approved exception.
- Existing public content is not silently deleted; publication behavior after the recovery period must be explicit.
- Messaging uses the Trial allowance for new accepted/billable activity, with essential-message protection.
- Super Admin sees an “above Trial limit” warning for each affected entitlement.

#### No repeated automatic reset loophole

The recovery Trial must not restart repeatedly because the same paid subscription produces multiple provider events.

Required safeguards:

- Make the expiry transition idempotent using the provider subscription/event identity and an internal transition record.
- Allow one automatic recovery Trial per paid subscription instance.
- Do not reset Trial dates when the same expiry event is received again.
- A new paid subscription may receive its own recovery Trial if it later genuinely expires.
- Any additional Trial extension or recovery period requires an explicit, audited Super Admin action.

#### Recovery Trial expiry

When the 14-day recovery Trial ends:

- The clinic remains on the `trial` plan for historical clarity.
- The access state becomes `expired` or the project’s approved equivalent.
- The clinic does not silently return to Starter, Growth, or Pro.
- The clinic cannot use expired paid entitlements.
- The clinic retains approved read-only access, support contact, and data export behavior.
- A Super Admin may later assign Starter, Growth, or Pro through the dedicated plan-assignment flow.

The post-recovery behavior is the same read-only, non-bookable state as initial Trial expiry. Standard authenticated export and support remain available, protected notifications for existing records continue through the audited protected-message path, and clinic data is never deleted.

---

## 6. Paid plan policy

### 6.1 Starter

Starter is for a small clinic or a clinic with one primary doctor.

Starter should provide a complete basic clinic workflow:

- Appointment booking and management.
- One doctor.
- Patient directory and history.
- Basic billing and accounts.
- Consent forms.
- Basic inventory and pharmacy operations.
- Basic clinic website.
- Basic analytics.
- Standard data export.
- Basic appointment communication.

Starter should have meaningful limits, but it should not feel like a disabled demo.

### 6.2 Growth

Growth should be the recommended plan for most actively operating clinics.

Its value should come from:

- Five times the Starter booking capacity.
- Up to three doctors.
- Higher messaging allowances.
- Advanced analytics.
- More Smile Deal posts.
- Advanced or scheduled exports.
- Priority support.
- More storage.
- More automation and operational headroom.

The public pricing page should clearly identify Growth as the recommended plan without implying that Starter is unsafe or unusable.

The pricing page should also provide a simple upgrade story. A Starter clinic approaching its limit should be able to understand that Growth provides five times the booking capacity, up to three doctors, higher messaging allowances, more storage, advanced analytics, and additional operational headroom. This guidance is explanatory; it must not replace server-side entitlement checks.

### 6.3 Pro

Pro is for established or high-volume clinics and clinics that value public visibility and faster support.

Its value should come from:

- High operational headroom.
- Unlimited doctors subject to fair-use safeguards.
- Unlimited Smile Deals subject to anti-abuse rules.
- Full analytics.
- Approximately 2 GB storage.
- Premium verified badge.
- Featured deal placement.
- Priority email and phone support.
- Highest messaging allowances.

Premium visibility must still follow content, moderation, and eligibility rules. A Pro subscription should not automatically override platform safety or quality review.

### 6.4 Transaction fees

The current advertised transaction fees are:

| Plan | Advertised transaction fee |
|---|---:|
| Starter | 5% |
| Growth | 3% |
| Pro | 1.5% |

These percentages should not be presented as an enforceable commercial promise until the application has a single, audited definition of:

- Which payment events are subject to the fee.
- Whether the fee applies to all patient payments or only platform-mediated payments.
- Whether refunds, failed payments, taxes, discounts, and manual bills are included.
- Which currency and rounding rules apply.
- Whether the fee is charged, deducted, or merely reported.
- How the clinic can reconcile the fee.

Until that policy and implementation exist, the safer option is either:

1. Keep the percentages clearly marked as planned pricing policy, or
2. Remove the fee comparison from public marketing until it is enforceable.

The patient billing system must not be confused with the clinic’s BookMySlot subscription billing.

---

## 7. Feature entitlement matrix

### 7.1 Core clinical and operational capabilities

The following should be available to all paid plans and available in limited form during Trial:

| Capability | Trial | Starter | Growth | Pro | Commercial restriction |
|---|---|---|---|---|---|
| Appointment management | Yes, capped | Yes | Yes | Yes | Booking volume |
| Slot configuration | Yes | Yes | Yes | Yes | Doctor and booking limits |
| Patient directory | Yes | Yes | Yes | Yes | Data volume or storage, not basic access |
| Patient history | Yes | Yes | Yes | Yes | Data volume or storage, not basic access |
| Clinical records | Yes | Yes | Yes | Yes | Storage, retention, and security controls |
| Consent forms | Yes | Yes | Yes | Yes | Storage and volume safeguards |
| Billing/accounts | Yes | Yes | Yes | Yes | Export and volume safeguards |
| Inventory | Limited volume | Basic | Advanced | Full | Item, automation, or reporting limits |
| Pharmacy stock | Limited volume | Basic | Advanced | Full | Item, automation, or reporting limits |
| Clinic profile | Yes | Yes | Yes | Yes | Branding and visibility options |
| Clinic website | Yes | Yes | Yes | Yes | Premium customization options |
| Analytics | Basic snapshot | Basic | Advanced | Full | Reporting depth |
| Data export | One export | Standard | Advanced/scheduled | Full/priority | Export volume and scheduling |

### 7.2 Features that should not be hidden solely by plan

These are patient, safety, privacy, or portability functions and should not be removed merely because a clinic is on Starter:

- Viewing existing patient records.
- Viewing existing clinical history.
- Viewing consent records.
- Viewing existing billing records.
- Correcting data according to existing authorization rules.
- Exporting data within the approved policy.
- Security and account recovery.
- Required appointment and security notifications.

If storage or volume limits are reached, the system should control new uploads or new records explicitly rather than making existing data disappear.

### 7.3 Features appropriate for differentiation

The following are suitable for plan-based differentiation:

- Number of bookings.
- Number of active doctors.
- Number of Smile Deals.
- Storage capacity.
- Messaging allowances.
- Analytics depth.
- Scheduled or advanced exports.
- Advanced inventory automation.
- Website customization.
- Premium verification and featured placement.
- Support priority.
- Bulk or promotional messaging.

---

## 8. Messaging entitlement policy

The detailed operational messaging policy remains in [15-messaging-allowance-and-plan-policy-blueprint](15-messaging-allowance-and-plan-policy-blueprint.md). This four-plan blueprint adds the Trial tier and places messaging in the broader entitlement model.

### 8.1 Approved allowances

| Plan | SMS | WhatsApp | Email | Period |
|---|---:|---:|---:|---|
| Trial | 25 | 25 | 50 | Trial lifetime |
| Starter | 100 | 100 | 300 | Calendar month |
| Growth | 500 | 500 | 1,500 | Calendar month |
| Pro | 2,000 | 2,000 | 6,000 | Calendar month |

The three channels remain separate. Unused email allowance must not silently convert into SMS or WhatsApp.

### 8.2 WhatsApp packaging decision

The current public pricing page does not advertise WhatsApp for Starter. The approved packaging is:

- Essential appointment WhatsApp notifications: available in Trial, Starter, Growth, and Pro within each plan’s allowance.
- Routine reminder, bulk, promotional, and advanced WhatsApp workflows: Growth and Pro only.

This provides a coherent Trial-to-Starter experience while still preserving meaningful Growth and Pro differentiation.

The approved public wording is: “Starter includes essential WhatsApp appointment and security notifications within the monthly allowance. Growth and Pro add higher allowances plus routine reminder, bulk, promotional, and advanced WhatsApp workflows.” Trial wording is: “Trial includes a limited allowance for the core clinic workflow, including essential appointment and security notifications.”

### 8.3 Counting rules

The approved starting rule is:

- Count accepted production messages and any failed production message for which the provider charged.
- Do not count intentionally skipped messages.
- Do not count messages marked as test.
- Count one unit per recipient when the provider charges per recipient.
- Keep attempted, accepted, failed, skipped, billable, and test counts separately visible.

The event-purpose mapping must classify messages as:

| Category | Examples | Approved behavior |
|---|---|---|
| Essential service | OTP, booking confirmation, security, consent links | Do not silently block |
| Routine clinic operations | Appointment reminders and routine clinic alerts | Included in paid plans according to channel allowance; routine WhatsApp workflows require Growth or Pro |
| Optional/promotional | Campaigns and bulk announcements | First candidate for hard blocking |
| Test/development | Provider verification and admin tests | Exclude from clinic allowance |

### 8.4 Rollout

Messaging enforcement must follow the staged rollout already proposed:

1. Reporting only.
2. Warning thresholds at 80% and 95%.
3. Controlled enforcement for optional/promotional messages.
4. Later decision on routine messages.

No messaging behavior should change merely because this document is created.

---

## 9. Storage entitlement policy

### 9.1 Approved starting limits

| Plan | Storage limit |
|---|---:|
| Trial | 50 MB |
| Starter | 100 MB |
| Growth | 500 MB |
| Pro | 2,047 MB, approximately 2 GB |

The existing paid limits should remain stable unless a separate commercial decision changes them.

### 9.2 Storage behavior

Storage enforcement should:

- Use server-side checks before new uploads.
- Show tracked usage, limit, percentage, and measurement time.
- Distinguish tracked metadata from an exact bucket scan.
- Show unavailable data as unavailable, not zero.
- Warn at 80% and 95%.
- Prevent new uploads at the approved hard limit.
- Preserve existing files.
- Provide an upgrade, cleanup, or support path.

Storage limits apply to platform-managed storage. They must not expose private object keys or unrelated clinics’ metadata.

---

## 10. Booking, doctor, and Smile Deal limits

### 10.1 Booking limits

Approved starting values:

| Plan | Booking limit |
|---|---:|
| Trial | 10 total during Trial |
| Starter | 30 per calendar month |
| Growth | 150 per calendar month |
| Pro | Unlimited with fair-use monitoring |

The system must define what counts as a booking:

- Whether cancelled bookings count.
- Whether no-shows count.
- Whether rescheduled bookings count once or more than once.
- Whether clinic-created bookings and patient-created bookings count equally.
- Whether a duplicate prevented by the booking-protection layer counts.
- Whether test or internal bookings are excluded.

Approved starting rule: count successfully created production bookings once, excluding rejected, duplicate, test, internal, or atomic-conflict attempts. Cancelled and no-show bookings count because they were successfully created. A reschedule updates the same booking and does not count again. Clinic-created and patient-created production bookings count equally. Preserve all lifecycle changes in reporting without counting every status transition as a new booking.

### 10.2 Doctor limits

Approved starting values:

| Plan | Active doctor limit |
|---|---:|
| Trial | 1 |
| Starter | 1 |
| Growth | 3 |
| Pro | Unlimited with fair-use monitoring |

The limit should apply to active configured doctors, not historical doctors who have been deactivated. Existing appointments and clinical records must remain associated with historical doctors.

### 10.3 Smile Deal limits

Approved starting values:

| Plan | Deal limit |
|---|---:|
| Trial | 1 trial post or draft |
| Starter | 1 live post |
| Growth | 3 live posts |
| Pro | Unlimited, subject to moderation and fair use |

The system should distinguish:

- Draft.
- Published.
- Expired.
- Archived.
- Rejected or removed for policy reasons.

Approved policy: only active published posts count against the paid live-post allowance; Trial may have one temporary draft or post for evaluation. Drafts, expired, archived, and rejected/removed posts do not consume paid live-post capacity.

---

## 11. Analytics, export, and website policy

### 11.1 Analytics

| Plan | Recommended analytics access |
|---|---|
| Trial | Basic snapshot using a short recent period |
| Starter | Basic operational analytics |
| Growth | Advanced comparisons, trends, and breakdowns |
| Pro | Full analytics, deeper comparisons, and priority reporting |

Analytics differences should be based on depth and history, not on hiding essential operational information.

### 11.2 Data export

Approved policy:

- Trial: one export.
- Starter: standard export with reasonable rate limits.
- Growth: advanced filters and scheduled export.
- Pro: full export options and priority processing.

All export operations must remain audited. After Trial or recovery expiry, and after downgrade, authenticated standard export remains available with reasonable rate limits. Scheduled, advanced, or priority export features follow the effective plan; account closure, support, and legally required access cannot be blocked by a plan limit.

### 11.3 Clinic website

All tiers should be able to publish a basic clinic presence:

- Clinic identity.
- Contact details.
- Core services.
- Booking entry point.

Higher-tier differentiation may include:

- More theme controls.
- More website sections.
- Custom branding.
- Advanced content blocks.
- Premium visibility.

Trial websites should carry clear Trial or platform branding and should be unpublished or restricted according to the approved expiry policy, without deleting the clinic’s draft content.

---

## 12. Subscription lifecycle and state model

### 12.1 Separate plan from subscription state

The effective access decision must combine at least:

1. The assigned plan.
2. The subscription or Trial state.
3. The effective dates.
4. Any approved temporary exception.
5. Any emergency platform disablement.

Plan is not the same as access state.

Examples:

- A clinic can be on Growth but have a pending payment state.
- A clinic can be on Trial but be within its active trial dates.
- A clinic can be on Pro but have an emergency-disabled messaging feature.
- A clinic can have a temporary support allowance without changing its plan.

### 12.2 Recommended states

The shared state policy should support:

```text
trialing
active
pending_payment
past_due
expired
cancelled
provider_error
manual_override
unknown
```

Existing legacy `unpaid` values should continue to map to `pending_payment` for interpretation and migration compatibility.

Unknown values must remain visible as an actionable “Unknown state” rather than silently becoming active or expired.

### 12.3 Trial-specific dates

Trial lifecycle data should be distinct from general subscription status. Recommended fields or equivalent domain values:

```text
trial_started_at
trial_ends_at
trial_grace_ends_at
trial_converted_at
trial_converted_plan
trial_expiry_reason
```

The final storage shape should follow the project’s existing schema conventions. The important requirement is that Trial dates and conversion history are explicit and auditable.

Recommended additional lifecycle values are:

```text
trial_origin
  initial_signup
  paid_expiry
  admin_granted

previous_paid_plan
paid_expired_at
recovery_trial_transition_id
```

`previous_paid_plan` is required for clear support and Super Admin display when the clinic’s current `plan` has changed to `trial`. The historical provider subscription identifier should remain in provider-event history rather than being overwritten or reused.

The implementation may use separate normalized tables instead of adding every value directly to `clinics`, but the effective state must be queryable without reconstructing it from an unbounded event log.

### 12.4 Paid subscription states

For paid plans, the approved subscription-state policy is:

- A verified renewal-payment failure enters `past_due` with exactly seven calendar days of payment grace. The grace clock starts at the provider-confirmed failure timestamp and is not extended by an outage, unmatched webhook, or repeated copy of the same event.
- During payment grace, the clinic keeps its current paid plan limits for existing clinical operations, new production bookings, and all message categories, with warnings shown. Essential messages remain protected.
- Initial paid activation grants no paid access until the provider confirms successful activation/payment, unless an explicitly audited manual support override is used.
- Existing data remains readable throughout `past_due`, expired, cancelled, and unknown states according to normal authorization. New restricted activity after confirmed expiry uses the recovery-Trial rules.
- A provider outage, unmatched webhook, unknown provider value, or unconfirmed `past_due` state does not trigger recovery. Those states remain visible for reconciliation.
- At the end of payment grace, provider-confirmed non-renewal or expiry triggers the default 14-day recovery Trial. Successful payment returns the clinic to `active` without erasing usage or restarting a Trial.
- Provider expiry events must be reconciled and applied idempotently before changing the clinic’s effective plan.

No route should independently invent its own interpretation of `unpaid`, `expired`, or unknown provider states.

### 12.5 State transition policy

The intended high-level transitions are:

```text
initial_signup
  -> trialing / plan=trial
  -> active / plan=starter|growth|pro

active paid plan
  -> past_due
  -> active paid plan              (payment succeeds)
  -> trialing / plan=trial         (confirmed paid expiry)

trialing / plan=trial
  -> active / plan=starter|growth|pro  (admin or approved paid conversion)
  -> expired / plan=trial              (Trial or recovery Trial ends)

expired / plan=trial
  -> active / plan=starter|growth|pro  (Super Admin assigns and activates a paid plan)
```

The `active paid plan -> trialing / plan=trial` transition is the required default for a confirmed paid subscription expiry. It must not be implemented as a client-only display change; it is a server-side, audited lifecycle transition.

---

## 13. Entitlement architecture

### 13.1 Single source of truth

Plan values must be defined in one shared policy catalog rather than duplicated across:

- Pricing components.
- Admin forms.
- Clinic dashboard components.
- Route handlers.
- Storage helpers.
- Messaging helpers.
- Analytics routes.
- Upgrade prompts.
- Public pricing copy and comparison tables.

The catalog should describe both limits and feature access.

### 13.2 Entitlement categories

The catalog should support at least:

```text
booking_monthly_limit
booking_trial_total_limit
trial_duration_days
trial_origin
active_doctor_limit
smile_deal_live_limit
storage_bytes_limit
messaging_sms_limit
messaging_whatsapp_limit
messaging_email_limit
analytics_level
export_level
website_level
inventory_level
pharmacy_level
essential_whatsapp_enabled
promotional_whatsapp_enabled
premium_verified_badge
featured_deal_placement
support_level
```

### 13.3 Effective entitlement calculation

The effective entitlement should be calculated in a predictable order:

1. Resolve the clinic.
2. Resolve the assigned plan.
3. Resolve Trial or paid subscription state.
4. Apply plan defaults.
5. Apply approved, time-limited tenant exceptions.
6. Apply emergency platform disablement where required.
7. Return the effective value and its source.

Every entitlement response should be able to explain whether its value came from:

- Plan default.
- Tenant override.
- Trial state.
- Trial origin and previous paid plan.
- Subscription state.
- Emergency disablement.

### 13.4 Client and server responsibilities

The client may use entitlement data to:

- Hide or disable unavailable actions.
- Explain limits.
- Show upgrade prompts.
- Display usage and expiry.

The server must:

- Enforce the operation.
- Return a stable, explainable error.
- Record relevant audit or quota events.
- Avoid leaking unrelated tenant information.

Client-only gating is not sufficient.

### 13.5 Stable error contract

When an action is denied because of a plan or limit, the API should return a structured response containing:

- Stable error code.
- Human-readable explanation.
- Entitlement key.
- Current value.
- Limit or required value.
- Reset or expiry time where applicable.
- Upgrade or support action.

Example categories:

```text
TRIAL_EXPIRED
BOOKING_LIMIT_REACHED
DOCTOR_LIMIT_REACHED
STORAGE_LIMIT_REACHED
MESSAGING_ALLOWANCE_REACHED
FEATURE_NOT_INCLUDED
SUBSCRIPTION_REQUIRES_ATTENTION
UNKNOWN_SUBSCRIPTION_STATE
```

---

## 14. Plan changes, upgrades, downgrades, and exceptions

### 14.1 Upgrades

Approved initial policy:

- Take effect after successful paid subscription activation.
- Do not erase usage already consumed.
- Use the new plan’s limits for the remaining period. The clinic receives the full new plan allowance for the current local calendar month; repeated provider events must not reset it.
- Preserve an audit event showing the previous and new plan.
- Explain whether the billing provider charged immediately or at the next renewal.

### 14.2 Downgrades

Downgrades require special handling:

- Do not delete doctors, deals, files, or patient records.
- Allow the clinic to view existing data.
- Prevent creation beyond the lower limit.
- Identify which existing items exceed the new limit.
- Give the clinic a clear resolution path.
- Do not silently deactivate a doctor or unpublish a deal without an approved policy.
- A paid downgrade requested by a clinic or administrator takes effect at the next provider renewal, after provider confirmation. The current plan remains effective until that renewal; above-limit existing items remain visible and current-period usage is not reset.

### 14.3 Manual administrator changes

Every manual plan assignment or override must record:

- Clinic.
- Previous plan or entitlement.
- New plan or entitlement.
- Administrator identity.
- Reason.
- Start time.
- End time if temporary.
- Provider synchronization status.

### 14.4 Temporary exceptions

Temporary support exceptions should be distinct from plan defaults:

- Start and end timestamps.
- Affected entitlement.
- Added limit or enabled feature.
- Reason.
- Administrator.
- Audit event.

Permanent undocumented overrides should not be introduced.

#### 14.4.1 Sponsored or complimentary access

An administrator may grant either:

1. A selected-feature or selected-limit exception, which is the default for support cases; or
2. A full-plan sponsored assignment, where the clinic receives the effective entitlements of Trial, Starter, Growth, or Pro for a fixed period without a provider charge.

A full-plan grant is allowed only through the dedicated sponsored-access workflow. It must not mutate a paid provider subscription or make a clinic appear to have completed payment. The effective entitlement response must identify the grant as `sponsored` or `manual_override`, include its expiry, and retain the underlying plan and provider state.

Sponsored access rules:

- It must have a fixed start and end timestamp.
- It must not overlap an active paid subscription by default. The normal operation is to schedule it after the paid period, or grant a narrowly scoped support exception without changing paid billing.
- It never pauses, extends, cancels, or rewrites the paid provider subscription.
- There may be only one effective sponsored-access grant per clinic. A new grant must extend or explicitly replace the existing grant; additive stacking is not allowed.
- At expiry, the override is removed and the underlying entitlement state is recalculated. An active paid subscription resumes as paid access; an expired paid subscription follows the recovery/expired rules; a pending or unknown state remains pending/unknown.
- Extensions and replacements preserve the original history and create a new audit event.
- A reason is mandatory. The record should also capture the offer/campaign identifier when one exists, the granting administrator, the previous effective state, the new effective state, and the policy/catalog version used to calculate any list value.
- The clinic-facing label must say **Sponsored access**, **Complimentary access**, or an equivalent non-payment term. It must not say “Paid,” “Payment received,” or imply a provider renewal.

Sponsored access has no cash value in the revenue ledger. A reporting-only list value may be stored as a waived amount, but it must never be included in captured, settled, or accounting revenue.

#### 14.4.2 Authority for sponsored access

- The platform owner and delegated billing operator may grant or extend full-plan sponsored access and any exception with financial or commercial impact.
- A delegated clinic-operations operator may grant selected operational features within an approved duration and scope policy, but may not grant a full paid plan or record a payment.
- Ordinary Super Admins may view sponsored-access status and history but may not create, extend, replace, revoke, or publish it.
- A future approval workflow may add two-person approval for unusually long, high-value, or Pro-level grants; until then, the dedicated roles, confirmation, mandatory reason, and audit record are required.

### 14.5 Super Admin plan configuration

The application Admin should have a dedicated **Subscription Plans** or **Plan Policies** area rather than requiring administrators to edit clinic records directly.

The configuration view should show all four plans and support controlled policy configuration for:

- Trial duration.
- Booking limits.
- Active doctor limits.
- Smile Deal limits.
- Storage limits.
- SMS, WhatsApp, and email allowances.
- Analytics level.
- Export level.
- Website level.
- Inventory and pharmacy level.
- Support level.
- Premium badge and featured-placement eligibility.

Configuration rules:

- Only the platform owner role, or a named Super Admin delegated the separate billing-operator permission, can create, validate, or publish plan policies. Ordinary Super Admins may view operational policy data but cannot publish it.
- Each change requires a reason.
- Changes are versioned with effective timestamps.
- Existing historical usage remains tied to the policy that was active at the time.
- A policy change must not silently reset clinic usage.
- High-impact paid-plan or messaging changes should require an explicit confirmation step.
- Plan policy configuration is different from a tenant-specific exception.

The billing-operator permission does not grant patient-data access, treatment-revenue access, or impersonation access.

### 14.6 Super Admin plan assignment and Trial extension

The Admin clinic detail view should provide a dedicated plan-management action with:

- Current plan and effective state.
- Previous paid plan, when the clinic is in a recovery Trial.
- Trial origin.
- Trial start, expiry, and grace dates.
- Current usage against Trial or paid limits.
- Provider subscription status.
- Target plan selector.
- Billing-cycle selector for paid plans only.
- Effective-date explanation.
- Required administrator reason.
- Confirmation before submission.

Supported actions:

#### Start or assign Trial

For a clinic without an active paid subscription:

- Set plan to `trial`.
- Set state to `trialing`.
- Create Trial dates.
- Record the Trial origin as `admin_granted` or `initial_signup`.
- Do not create a Razorpay subscription.
- Do not create a paid activation link.

#### Extend Trial

For a clinic already in initial or recovery Trial:

- Offer approved durations such as 7 days and 14 days, plus a controlled custom-date option if needed.
- Require a reason.
- Show the current and new expiry dates.
- Record the administrator, previous expiry, new expiry, origin, and reason.
- Do not reset usage unless a separate policy explicitly approves it.

#### Assign a paid plan after paid expiry

For a clinic in recovery Trial or expired Trial:

- Allow the administrator to select Starter, Growth, or Pro.
- Require monthly or annual billing cycle.
- Create or initiate the correct new paid subscription flow.
- Do not reuse the expired provider subscription identifier.
- Keep the old provider event history intact.
- Set the clinic to a payment-pending state until the approved activation/payment event succeeds, unless a documented manual override is used.
- On successful activation, set the effective plan and paid active state.
- Record the previous Trial state and the new paid plan.

This action must not be implemented by exposing the general clinic-edit endpoint to arbitrary `plan` updates.

#### Change an active paid plan

Changing Starter, Growth, or Pro for an already-paid clinic requires a separate provider-aware upgrade/downgrade policy. The administrator must see whether the change is effective immediately or at renewal. A direct database change must not leave Razorpay billing on the old plan.

#### Assigning Trial to an active paid clinic

This should be blocked by default. A paid-to-Trial move is only safe after the paid provider subscription is cancelled or otherwise reconciled, with an explicit reason and audit record. It must not create a clinic that is simultaneously billed as paid and entitled as Trial.

### 14.7 Provider and admin race protection

Plan assignment and expiry fallback must be safe if an administrator action and a provider webhook arrive close together.

The implementation should:

- Re-read the clinic and provider state inside the final transaction or guarded update.
- Use provider subscription/event identities for idempotency.
- Reject stale admin updates when the clinic’s subscription state has changed.
- Record whether the final state came from a provider event, admin action, or manual override.
- Never allow a late provider event for an expired subscription to reactivate the old paid plan without reconciliation.

---

## 15. Super Admin requirements

The Super Admin operations area should show the subscription model without exposing clinic treatment revenue or routine patient billing details.

### 15.1 Overview

Add or plan for:

- Clinics in Trial.
- Trials expiring within 7 days.
- Expired Trials awaiting conversion.
- Clinics automatically moved from an expired paid plan into recovery Trial.
- Recovery Trials that are above one or more Trial limits.
- Clinics awaiting Super Admin paid-plan assignment.
- Active clinics by plan.
- Clinics approaching booking, doctor, storage, or messaging limits.
- Clinics with unknown or provider-error subscription states.
- Clinics with entitlement mismatches.
- Paid plan conversion rate once analytics is approved.

Financial metrics such as MRR, ARR, ARPU, LTV, treatment revenue, and clinic patient-bill totals remain outside the normal tenant operations view.

### 15.2 Restricted platform subscription finance report

Platform subscription money may be reported in a separate, role-protected finance/reconciliation view. This is not clinic treatment revenue and must not be embedded in the normal tenant overview or patient billing screens.

For the first implementation, **payments received** means provider-confirmed captured subscription payments on a cash basis. The report must show the related measures separately rather than using an ambiguous single “revenue” number:

- Gross captured payment amount.
- Refunds and chargebacks as negative adjustments.
- Provider fees, if supplied by the provider.
- Provider tax amounts, if supplied by the provider.
- Net captured amount after refunds, chargebacks, and fees.
- Settled amount and settlement date when provider settlement data is available.
- Complimentary/sponsored list value waived, always with zero cash received.
- Verified manual/offline payments, separately identified from provider-captured payments.
- Failed, declined, pending, duplicate, unmatched, and unreconciled payment events.

The report must not call gross captured payments “accounting revenue” unless a separate finance/accounting policy approves revenue-recognition rules. Accounting revenue, tax liability, and settlement reconciliation are distinct concepts.

The authoritative order for provider money is:

1. Provider-confirmed captured payment for captured cash reporting.
2. Provider refund or chargeback record for negative adjustments.
3. Provider fee and tax fields where available.
4. Provider settlement records for bank-settled reporting.
5. Manual records only when verified under the offline-payment policy.

Provider webhook history alone is not a complete financial ledger. Financial records need provider payment/charge identity, amount, currency, occurrence time, capture state, linked clinic/subscription, and reconciliation status. Duplicate provider events must not duplicate money.

Access to this report is restricted to the platform owner and delegated finance/billing operators. Ordinary Super Admins and clinic-operations operators may see operational subscription state, but not platform-wide financial totals or payment amounts unless separately delegated. Clinic-private treatment revenue and patient billing remain excluded for every role in this platform report.

The approved action boundary is:

- The platform owner may publish plan policies and perform approved billing-policy operations.
- A named billing operator or clinic-operations operator may receive only the delegated permissions needed for approved Trial or billing actions.
- Ordinary Super Admins may view operational policy and entitlement data but may not publish policies, use generic clinic editing to mutate plans, or bypass provider confirmation.
- No role may use unrestricted impersonation or a broad “Mark Paid” mutation to bypass these permissions.

### 15.3 Tenant table

Recommended columns:

| Column | Meaning |
|---|---|
| Tenant | Clinic identity |
| Plan | Trial, Starter, Growth, or Pro |
| Access state | Trialing, active, pending payment, expired, or other state |
| Trial origin | Initial signup, paid expiry, or admin granted |
| Trial/renewal date | Relevant expiry, recovery expiry, or renewal date |
| Previous paid plan | Paid plan before recovery Trial, if applicable |
| Booking usage | Used / limit |
| Doctor usage | Active / limit |
| Messaging usage | Per-channel used / limit |
| Storage usage | Used / limit |
| Feature health | Entitlement warnings or mismatches |
| Support status | Open operational issue count |
| Actions | Open details, audit, or approved support action |

### 15.4 Tenant detail

The tenant detail drawer should explain:

- Current plan.
- Effective access state.
- Billing cycle.
- Trial dates or paid renewal date.
- Whether the Trial is initial or post-paid-expiry recovery.
- Previous paid plan and paid expiry timestamp, if applicable.
- Provider subscription link status.
- Booking usage and limit.
- Active doctor count and limit.
- Smile Deal count and limit.
- Messaging usage and allowance.
- Storage usage and limit.
- Analytics and feature access.
- Active exceptions.
- Pending paid-plan assignment or activation.
- Pending warnings.
- Last entitlement calculation time.
- Relevant audit events.

It must not become a clinic revenue or patient billing dashboard.

---

## 16. Data and audit requirements

### 16.1 Required policy data

The implementation should support versioned policy values:

- Plan key.
- Entitlement key.
- Value.
- Channel where applicable.
- Effective start date.
- Effective end date, optional.
- Policy version.
- Whether the value is active.
- Source or override type.

Historical usage should remain interpretable under the policy that was active at that time.

### 16.2 Required entitlement audit events

Record at least:

- Trial started.
- Trial warning shown or sent.
- Trial expired.
- Trial converted.
- Trial extension granted.
- Plan assigned.
- Plan changed.
- Subscription state changed.
- Entitlement override created.
- Entitlement override ended.
- Limit warning generated.
- Limit reached.
- Action blocked by entitlement.
- Action allowed during a grace or support exception.
- Emergency feature disablement.

### 16.3 Required platform subscription money records

The subscription money model must be separate from entitlement and clinic treatment billing records. It should support a normalized financial record or ledger with, at minimum:

- Clinic and provider.
- Provider payment, charge, invoice, refund, chargeback, and settlement identities where available.
- Provider subscription identity where applicable.
- Record type: captured payment, refund, chargeback, fee, tax, settlement, manual payment, complimentary grant, or adjustment.
- Amount and currency.
- Occurred, captured, refunded, charged-back, or settled timestamp as applicable.
- Capture/payment status.
- Source: provider, verified manual entry, or sponsored-access workflow.
- Reconciliation status and last reconciliation time.
- Link to the originating provider event without treating the event itself as the financial amount.
- Actor and reason for manual records or adjustments.

Rules:

- A failed or declined payment has zero captured amount and must not be counted as money received.
- A refund or chargeback is a negative adjustment linked to the original captured payment.
- Provider fees and taxes are displayed as separate fields; they must not be silently netted into gross captured payments.
- A sponsored grant may record a waived catalog/list value and zero cash received, but must never create a captured-payment record.
- Manual/offline payments are allowed only as verified records, never as fabricated provider events or fake Razorpay identifiers.
- Duplicate provider events and repeated reconciliation runs must be idempotent.

### 16.4 Privacy and security

Entitlement and usage endpoints must:

- Be scoped to the authenticated clinic or authorized Super Admin.
- Avoid exposing other clinics’ usage.
- Avoid exposing provider secrets.
- Avoid exposing clinical content in operational summaries.
- Preserve auditability without copying unnecessary patient data.
- Use server-side authorization on every restricted action.

---

## 17. Implementation roadmap

### Phase 0 — Policy approval

Approve:

1. Trial duration.
2. Trial booking, doctor, deal, storage, and messaging limits.
3. Trial payment-details policy.
4. Trial expiry and grace-period behavior.
5. Starter, Growth, and Pro limits.
6. Starter WhatsApp packaging.
7. Messaging counting and protected-message rules.
8. Booking-counting rules.
9. Transaction-fee scope.
10. Pro fair-use policy.

**Output:** Approved commercial and entitlement contract.

### Phase 1 — Shared plan catalog

1. Define stable plan keys.
2. Define entitlement keys.
3. Move plan descriptions and limits into one shared source.
4. Add policy versioning.
5. Add tests for plan resolution.
6. Define the pricing-page view model for plan names, units, allowances, annual savings, and upgrade copy.
7. Keep current behavior unchanged until enforcement is intentionally enabled.

**Output:** One explainable plan policy used by presentation and future enforcement.

### Phase 2 — Trial lifecycle

1. Add explicit Trial dates and state.
2. Record the Trial start event once.
3. Add expiry and grace-period calculations.
4. Add conversion tracking.
5. Add Trial origin and previous paid-plan tracking.
6. Add the confirmed paid-expiry -> Trial/recovery transition.
7. Add idempotency for provider expiry events.
8. Add clinic-facing Trial and recovery-Trial notices.
9. Add Super Admin Trial filters and attention states.
10. Add tests for timezone and boundary behavior.

**Output:** A reliable initial and post-paid-expiry Trial lifecycle without losing clinic data or leaving paid provider state inconsistent.

### Phase 3 — Reporting-only entitlements

1. Calculate booking, doctor, deal, message, and storage usage.
2. Return current usage, limit, remaining value, and freshness.
3. Add clinic-facing usage panels.
4. Add Super Admin plan and usage summaries.
5. Compare calculated values with current operational data.
6. Do not block actions yet.

**Output:** Measurable plan usage with no sudden production disruption.

### Phase 4 — Super Admin plan configuration and assignment

1. Add the four-plan policy configuration view.
2. Add versioned policy updates with audit reasons.
3. Add clinic-level Start Trial and Extend Trial actions.
4. Add Assign Paid Plan for recovery or expired Trial clinics.
5. Add Grant Sponsored Access for selected features/limits and fixed-term full-plan access.
6. Add provider-aware activation and payment-pending states.
7. Add confirmation, role checks, one-active-grant rules, and stale-state protection.
8. Add previous-plan, Trial-origin, sponsored-access, and transition history to the tenant detail view.
9. Prevent direct unrestricted plan or subscription mutation through the general clinic-edit route.

**Output:** Administrators can safely configure Trial policy, extend a Trial, and assign a paid plan after paid expiry.

### Phase 5 — Warning mode

1. Add 80% and 95% warnings where applicable.
2. Add Trial expiry warnings.
3. Add upgrade prompts.
4. Add operational alerts.
5. Add audit records for warnings.
6. Verify unavailable data is not displayed as zero.
7. Verify Trial is presented separately from paid plans and uses core-workflow wording.
8. Verify pricing units, messaging allowances, storage limits, annual prices, and annual savings match the approved catalog.
9. Verify transaction-fee copy is omitted or clearly marked as unfinalized.
10. Verify Starter WhatsApp copy matches the approved essential-notification decision.

**Output:** Clinics and platform staff can act before limits interrupt work.

### Phase 6 — Controlled server-side enforcement

1. Enforce doctor creation limits.
2. Enforce new booking limits.
3. Enforce new Smile Deal limits.
4. Enforce storage upload limits.
5. Enforce analytics depth.
6. Enforce export policy with data-portability exceptions.
7. Enforce optional/promotional messaging limits first.
8. Protect essential messages.
9. Add stable structured errors.
10. Add support exceptions and audit entries.

**Output:** Predictable commercial limits with protected clinical and security workflows.

### Phase 7 — Provider and commercial alignment

1. Confirm Razorpay plan mapping remains correct.
2. Add paid-plan upgrade and downgrade flows.
3. Add Trial-to-paid conversion handling.
4. Add recovery-Trial-to-paid assignment handling.
5. Define transaction-fee calculation only after the fee policy is approved.
6. Add plan-change reconciliation and provider event handling.
7. Add historical policy references to usage reports.
8. Add an idempotent provider-money ledger for captured payments, refunds, chargebacks, fees, taxes, and settlements.
9. Add separately identified verified manual/offline payments and zero-cash sponsored grants.
10. Add the restricted platform subscription finance/reconciliation report.

**Output:** Subscription state and entitlements remain aligned with the payment provider.

### Phase 8 — Commercial refinement

After at least one or two complete usage periods:

1. Review actual usage by plan.
2. Review Trial conversion.
3. Review support burden.
4. Review quota-related failures.
5. Review messaging cost and provider behavior.
6. Adjust allowances through a versioned policy decision.
7. Consider add-ons or overage only if usage supports them.

**Output:** A sustainable model based on real platform behavior rather than assumptions.

---

## 18. Testing and verification requirements

### 18.1 Policy tests

Test:

- Every plan resolves to the expected limits.
- Trial dates use the correct boundary behavior.
- A confirmed paid subscription expiry moves the clinic to `trialing` with `plan=trial`.
- Repeated copies of the same provider expiry event do not restart or extend the recovery Trial.
- A recovery Trial records its previous paid plan and origin.
- A recovery Trial uses Trial limits immediately, without deleting data above those limits.
- Existing Starter, Growth, and Pro identifiers remain valid.
- Unknown plan or state values remain visible and actionable.
- Legacy `unpaid` maps to `pending_payment`.
- Pro unlimited values still pass fair-use checks.

### 18.2 Authorization tests

Test every restricted operation for:

- Trial within limits.
- Trial at the limit.
- Trial expired.
- Trial in grace period.
- Paid plan expired and automatically entered recovery Trial.
- Recovery Trial above Trial limits.
- Recovery Trial expired awaiting Super Admin assignment.
- Super Admin assigned a paid plan after recovery Trial.
- Super Admin extended initial and recovery Trial.
- Active Starter.
- Active Growth.
- Active Pro.
- Pending-payment subscription.
- Expired or cancelled subscription.
- Unknown subscription state.
- Temporary support exception.
- Emergency feature disablement.

### 18.3 Counting tests

Test:

- Cancelled and rescheduled bookings.
- No-shows.
- Duplicate booking attempts.
- Deactivated doctors.
- Draft and expired Smile Deals.
- Accepted, failed, skipped, billable, and test messages.
- Multi-recipient messages.
- Storage metadata and exact-scan differences.
- First-month and plan-change behavior.
- Paid-expiry fallback and repeated provider-event idempotency.
- Late provider event after paid expiry.

### 18.4 Privacy tests

Verify that:

- A clinic cannot read another clinic’s entitlements or usage.
- Super Admin operational responses do not include treatment revenue or routine patient bills.
- Entitlement errors do not reveal unrelated clinic data.
- Provider secrets and payment credentials never enter plan or event responses.

### 18.5 Release checks

Before each enforcement phase:

- Run type checking.
- Run the project test suite.
- Run the Build Check workflow.
- Run route authorization tests.
- Run migration checks if schema changes are introduced.
- Run data-leakage checks.
- Verify responsive clinic, admin, and patient-facing states.
- Verify trial expiry and upgrade copy in the preview.

---

## 19. Phase 0 decision register and open decisions

### 19.1 Phase 0 status

**Status:** Complete for policy approval. All commercial rules are approved or explicitly deferred.

This closes the commercial decision gate, but it does not authorize implementation to skip the roadmap, baseline, reporting, provider, privacy, or release checks. The labels in this section mean:

- **Current baseline:** what the application or public pricing currently says. This is recorded for migration and comparison; it is not automatically an approved future rule.
- **Proposed default:** the recommended starting position before the decision pass.
- **Approved:** confirmed for implementation planning; implementation still follows the roadmap and completion criteria.
- **Explicitly deferred:** deliberately outside the current implementation contract; it must not be inferred or marketed as active.

### 19.2 Resolved decisions

The following decisions override earlier “recommended” wording in this document where that wording was intentionally non-final:

1. **Trial duration:** exactly 14 calendar days.
2. **Trial start:** initial Trial starts at clinic activation; administrator-granted Trial starts when granted; recovery Trial starts at confirmed paid expiry. First authenticated use does not delay an initial Trial.
3. **Initial Trial grace:** exactly seven calendar days of read-only grace.
4. **Payment details:** no card, Razorpay payment method, or paid provider subscription is required before Trial start.
5. **Trial messaging period:** SMS, WhatsApp, and email Trial allowances are lifetime limits for that Trial transition. Paid allowances reset monthly in the clinic timezone.
6. **Starter WhatsApp:** essential service WhatsApp is included; routine reminders, bulk, promotional, and advanced workflows require Growth or Pro.
7. **Essential messages:** OTP, account recovery, security notices, booking confirmation/cancellation/reschedule, consent links, and required service notices for existing records.
8. **Provider-billable failures:** they consume the relevant channel allowance and remain visible as failed/billable.
9. **Booking basis:** successfully created production bookings count once, not completed appointments. Clinic-created and patient-created bookings count equally.
10. **Cancelled/no-show bookings:** both count because they were created. A reschedule does not count a second time; rejected, duplicate, test, internal, and atomic-conflict attempts do not count.
11. **Smile Deal drafts:** paid-plan limits count active published posts only. Trial allows one temporary draft or post; drafts do not consume paid live-post capacity.
12. **Pro fair use:** no advertised numeric cap for bookings, active doctors, or live Smile Deals. Review thresholds are 1,000 monthly bookings, 25 active doctors, or 100 live deals; thresholds trigger notice and support review, not an automatic hard block.
13. **Public booking after initial Trial expiry:** public booking stops at Trial expiry, including during grace. The profile remains visible as non-bookable with an upgrade/support notice.
14. **Export after expiry/downgrade:** authenticated standard export remains available with reasonable rate limits. Scheduled, advanced, and priority export features follow the effective plan; closure, support, and legally required access cannot be blocked.
15. **Inventory and pharmacy:** differentiation is feature-based (Trial limited volume, Starter basic, Growth advanced, Pro full); exact item-count thresholds are deferred and must not be invented during implementation.
16. **Website controls:** Trial and Starter provide the basic profile and booking entry point; Growth adds sections, theme controls, and advanced blocks; Pro adds custom branding and premium visibility eligibility.
17. **Starter support:** Starter includes standard email support and help-center/onboarding guidance from launch; Growth and Pro receive priority support.
18. **First paid month allowance:** no proration. Successful activation receives the full paid allowance for the remainder of the clinic-local calendar month, and it resets on the next month boundary.
19. **Payment grace:** exactly seven calendar days after a provider-confirmed renewal-payment failure. Provider outage, unmatched webhook, unknown state, or unconfirmed retry does not start recovery.
20. **Recovery Trial duration:** exactly 14 calendar days from confirmed paid expiry.
21. **Recovery idempotency:** exactly one automatic recovery Trial per paid provider subscription instance; repeated events cannot restart or extend it.
22. **Post-recovery behavior:** existing data remains readable, standard export and support remain available, public booking is disabled, and only protected notifications for existing records continue through the audited protected-message path.
23. **Policy roles:** the platform owner publishes; a delegated billing operator may configure drafts and perform approved billing operations; ordinary Super Admins may view operational policy data only.
24. **Trial roles:** the platform owner or delegated clinic-operations operator may start or extend Trial with confirmation, reason, expiry, and audit history.
25. **Paid assignment after expiry:** access changes to the paid plan only after provider-confirmed payment/activation, except for an explicitly audited manual support override; an expired provider subscription is never reused.
26. **Plan-change timing:** provider-confirmed upgrades are immediate; provider-confirmed paid downgrades take effect at the next renewal. Usage is never erased or reset.
27. **Trial presentation:** Trial is both the primary no-card entry banner/panel and a clearly labeled comparison-table column.
28. **Public wording:** Starter copy is “Starter includes essential WhatsApp appointment and security notifications within the monthly allowance. Growth and Pro add higher allowances plus routine reminder, bulk, promotional, and advanced WhatsApp workflows.” Trial copy is “Trial includes a limited allowance for the core clinic workflow, including essential appointment and security notifications.”
29. **Sponsored-access scope:** An administrator may grant a selected-feature/selected-limit exception by default. A full-plan sponsored assignment is also allowed, but only through a dedicated, audited workflow with a fixed expiry; it is not a payment and does not create a provider subscription.
30. **Sponsored-access overlap:** Sponsored access must not overlap an active paid subscription by default. It may be scheduled after paid access ends. A narrowly scoped support exception during paid access may be approved without changing the paid provider subscription or billing dates.
31. **Sponsored-access effect on paid billing:** Sponsored access leaves the underlying paid subscription untouched. It does not pause, extend, cancel, renew, or rewrite provider billing.
32. **Sponsored-access expiry:** At the exact end time, the sponsored override ends and the underlying state is recalculated. Paid active access resumes when applicable; expired paid access follows recovery/expired rules; pending and unknown states remain visible as such. Expiry does not create an automatic renewal.
33. **Sponsored-access stacking:** Only one effective sponsored-access grant may exist for a clinic. A later action must extend or explicitly replace it, preserving history; additive stacking is not allowed.
34. **Sponsored-access authority:** The platform owner or delegated billing operator may grant or extend full-plan or commercially meaningful sponsored access. A delegated clinic-operations operator may grant only selected operational exceptions within policy. Ordinary Super Admins are view-only for these actions.
35. **Sponsored-access reason:** A reason is mandatory for every grant, extension, replacement, or revocation. The record also captures the actor, scope, dates, previous and new effective state, and offer/campaign identifier when available.
36. **Sponsored list value:** A sponsored offer may record a snapshot of the catalog/list price that was waived, including currency and policy version, for commercial reporting. This is a waived value, not captured cash, settled cash, net revenue, or accounting revenue.
37. **Meaning of payments received:** Initial platform finance reporting uses provider-confirmed captured subscription payments as the primary cash-basis measure. Refunds and chargebacks reduce it; fees and taxes are displayed separately; settlement amounts are shown separately when provider settlement data is available. The report must not call this accounting revenue without a separate accounting policy.
38. **Refunds, chargebacks, taxes, and failures:** Refunds and chargebacks are linked negative adjustments. Provider fees and taxes are separate fields. Failed, declined, pending, duplicate, or unmatched payment attempts do not count as captured money.
39. **Manual/offline payments:** They are allowed only as exceptional, separately identified, verified records. A platform owner or delegated billing operator must record amount, currency, received date, payment method, external reference/evidence, actor, reason, and verification/reversal status. Manual records must never fabricate a provider event or provider identifier.
40. **Platform-revenue visibility:** A separate restricted subscription-finance/reconciliation view is available to the platform owner and delegated finance/billing operators. Ordinary Super Admins and clinic-operations operators retain operational subscription visibility but not platform financial totals or payment amounts. Clinic treatment revenue remains excluded for every role.

### 19.3 Explicit deferrals

The following items are intentionally not approved for implementation or marketing enforcement:

1. **Transaction-fee policy:** the advertised percentages must be omitted or labeled unfinalized until a separate audited policy defines scope, calculation, collection, refunds, taxes, discounts, rounding, and reconciliation.
2. **Exact inventory item-count thresholds.**
3. **Exact pharmacy item-count thresholds.**

No code may infer a different answer from current UI text. These deferrals must remain visible in the policy catalog and public-copy review until separately approved.

### 19.4 Phase 0 completion evidence

Phase 0 is complete for implementation planning because:

- The four-plan matrix, Trial lifecycle, recovery lifecycle, messaging categories, and counting rules are approved above.
- Upgrade, downgrade, payment-grace, renewal, public-booking, export, support-exception, and post-expiry behaviors are explicit.
- Starter WhatsApp scope and Pro fair-use behavior have approved wording and review thresholds.
- Policy publication, Trial operations, paid assignment, and manual payment authority are role-scoped.
- Sponsored access, expiry, non-overlap, non-stacking, authority, mandatory reasons, and waived-list-value treatment are approved above.
- Captured-payment reporting, refund/chargeback treatment, provider fee/tax separation, manual/offline payment evidence, and restricted finance-report visibility are approved above.
- Transaction-fee calculation and exact inventory/pharmacy item counts are recorded as explicit deferrals, not assumptions.

Before production rollout or enforcement begins, the approved policy must be copied into a versioned catalog and the current-clinic baseline must be completed. During the current development phase, catalog work may proceed using representative development fixtures, provided that no production clinic access or provider state is changed and the deferred production baseline remains an explicit release gate.

---

## 20. Acceptance criteria

The commercial policy phase is complete. Implementation may begin only through the staged roadmap, with each phase meeting its own gate. The policy and implementation baseline must satisfy all of the following:

- Trial, Starter, Growth, and Pro have plain-language purposes.
- Trial duration and expiry behavior are approved.
- Confirmed paid-plan expiry defaults to the controlled Trial/recovery state.
- Recovery Trial duration, limits, origin, and one-transition-per-subscription rule are approved.
- Super Admin can assign a paid plan later without reusing an expired provider subscription.
- Super Admin Trial assignment and extension actions require authorization, confirmation, reason, and audit history.
- Trial does not require payment details unless explicitly approved.
- Booking, doctor, Smile Deal, storage, and messaging limits are approved.
- Starter, Growth, and Pro identifiers remain stable.
- Prices and annual discount treatment are documented.
- Annual pricing shows the correct savings: ₹1,998 for Starter, ₹3,198 for Growth, and ₹5,998 for Pro.
- Public pricing uses clear volume units, including “bookings per month,” rather than ambiguous shorthand.
- Public pricing shows separate messaging allowances and storage limits from the shared plan catalog.
- Trial is presented as a separate, no-card entry path with core-workflow wording rather than an unrestricted full-feature promise.
- Growth has an understandable upgrade story without making Starter appear unusable.
- Core clinical and data-portability features are explicitly protected.
- Feature-based and volume-based entitlements are distinguished.
- WhatsApp packaging is explicitly decided.
- Messaging counting and protected-message rules are approved.
- Subscription state and plan are modeled separately.
- Unknown and legacy subscription values have a defined interpretation.
- Upgrade, downgrade, expiry, and support-exception behavior is documented.
- Paid expiry, recovery Trial, and later paid-plan assignment behavior is documented.
- Transaction-fee scope is either implemented and audited or removed from enforceable marketing claims.
- Server-side enforcement is required for every restricted operation.
- Usage and entitlement warnings have an audit approach.
- Historical policy versions can explain past usage.
- Super Admin visibility remains within the platform-operations boundary.
- A reporting-only period is planned before hard enforcement.
- Draft and published plan policies are separate, and published policy versions are immutable.
- Annual savings are calculated from monthly and annual prices rather than manually entered.
- A policy impact preview identifies affected clinics before publication.
- The current-clinic baseline distinguishes unavailable data from zero and records migration or exception decisions.
- Trial start, expiry, conversion, and recovery transitions are idempotent.
- Late provider events cannot reactivate an expired paid plan without reconciliation.
- Paid upgrades and downgrades follow provider-confirmed timing.
- Standard authenticated export remains available after expiry and downgrade, subject to reasonable rate limits.
- Generic clinic-edit routes cannot mutate plan state or bypass provider confirmation.
- Policy publication and clinic-level support exceptions use separate permissions and audit records.
- Sponsored access can grant selected features or a full plan only through a fixed-term, audited workflow.
- Sponsored access does not pause, extend, cancel, or rewrite an active paid provider subscription.
- Sponsored access does not overlap active paid access by default, cannot stack additively, and expires back to the underlying state.
- A mandatory reason, actor, scope, dates, and optional offer/campaign identifier are recorded for every sponsored-access change.
- Complimentary list value is reported as waived value and never as captured, settled, or accounting revenue.
- Platform subscription finance reporting distinguishes captured payments, refunds, chargebacks, fees, taxes, settlements, manual payments, failed attempts, and sponsored access.
- A provider-money ledger is idempotent and separate from provider webhook history and clinic treatment billing.
- Manual/offline payments require authorized verification and evidence and never fabricate provider events.
- Platform subscription money is visible only in the restricted finance/reconciliation view for the platform owner and delegated finance/billing operators.
- Transaction fees and exact inventory/pharmacy item-count thresholds remain explicitly deferred until separately approved.

---

## 21. Explicit non-goals

This blueprint does not:

- Change application code.
- Change database schema.
- Add a Trial plan to Razorpay.
- Change current plan prices.
- Change existing clinic plan assignments.
- Enforce booking, doctor, deal, storage, analytics, or messaging limits.
- Rewrite the existing messaging blueprint.
- Expose clinic treatment revenue.
- Expose routine patient billing data to Super Admin.
- Add multi-branch organization pricing.
- Promise unlimited messaging or unlimited storage.
- Add write-enabled Super Admin impersonation.
- Delete data at Trial expiry or downgrade.
- Treat a recovery Trial as a new unrestricted acquisition Trial.
- Reactivate an expired paid provider subscription without reconciliation.

---

## 22. Recommended next implementation stage

Phase 0 is complete for policy approval. The following matrix is the approved starting contract for the versioned catalog and reporting work:

| Plan | Bookings | Doctors | Storage | SMS | WhatsApp | Email |
|---|---:|---:|---:|---:|---:|---:|
| Trial | 10 total / 14 days | 1 | 50 MB | 25 | 25 | 50 |
| Starter | 30/month | 1 | 100 MB | 100 | 100 | 300 |
| Growth | 150/month | 3 | 500 MB | 500 | 500 | 1,500 |
| Pro | Unlimited with fair use | Unlimited with fair use | 2,047 MB | 2,000 | 2,000 | 6,000 |

The approved commercial position is:

- Keep current paid prices.
- Add a 14-day no-card Trial.
- Present Trial as the primary low-friction pricing-page entry point, separate from paid Razorpay plans.
- Make Growth the recommended plan.
- Keep core clinical workflows available on all tiers.
- Use volume, messaging, analytics, visibility, and support for differentiation.
- Include essential WhatsApp notifications in Starter, while reserving routine reminder, bulk, promotional, and advanced WhatsApp workflows for Growth and Pro.
- Show separate messaging allowances, storage limits, clear booking units, annual prices, and annual savings on the pricing page.
- Keep transaction-fee percentages out of enforceable marketing claims until their scope is implemented and audited.
- Start with reporting, then warnings, then controlled enforcement.
- On confirmed paid expiry, move the clinic by default to a 14-day Trial/recovery state using Trial limits.
- Preserve the previous paid plan and provider history.
- Let authorized platform owners or delegated billing operators later assign Starter, Growth, or Pro through a provider-aware, audited action.
- Allow fixed-term sponsored access through a separate audited exception workflow, without treating it as paid activation.
- Report platform subscription money separately from sponsored list value and clinic-private treatment revenue.

The current development stage is to validate the versioned shared plan-policy catalog, operate the draft/review/validate/publish registry workflow, and migrate existing plan-value consumers to it. The full current-clinic baseline against Render is deferred until the project is preparing for production rollout or enforcement. The registry workflow is intentionally not the live-consumer cutover: it preserves the approved decisions in Section 19, keeps transaction fees and exact inventory/pharmacy thresholds deferred, and leaves application enforcement unchanged until reporting and release gates are complete.

### 22.1 Step 1 baseline execution evidence

On **2026-09-11 (Asia/Calcutta)**, the first read-only baseline execution was completed against an empty development database. On **2026-09-12 (Asia/Calcutta)**, the baseline was re-run after the development database contained a seeded clinic:

- Command: `npm run audit:subscription-baseline`
- Reproducible generator: `scripts/subscription-baseline.ts`
- Evidence report: [17-subscription-baseline-report.md](17-subscription-baseline-report.md)
- Development schema: initialized successfully with the existing `db:push` workflow.
- Initial development data result: **0 clinics, 0 bookings, 0 communication-usage rows, 0 patient documents, and 0 provider events**.
- Revalidated development data result: **1 active clinic, 17 all-time bookings, 1 linked doctor, 0 live Smile Deals, 0 stored document bytes, 0 SMS/WhatsApp/email usage units, and 1 provider-event row or less depending on the configured database snapshot**. The current clinic is Starter, pending payment, has no provider link, and is flagged as above the proposed Trial booking limit.
- Render data result: intentionally deferred during the current development phase. The application is deployed on Render with a separate PostgreSQL database, but a full Render-clinic migration baseline is a pre-production rollout gate rather than a prerequisite for catalog development.
- Privacy boundary: the report emits clinic IDs and operational metrics only. It does not emit clinic names, emails, phone numbers, patient information, provider IDs, or credentials.

The initial empty-database result remains historical evidence only. The revalidated report plus the passing representative fixtures now provide development-stage evidence for the calculations and unavailable-data handling, but they are **not** a completed every-clinic production migration baseline. The current development clinic is not being treated as within limits; it is explicitly flagged above the proposed Trial booking limit. Before production rollout or enforcement, the same read-only generator must target the Render PostgreSQL database, or an authorized populated snapshot of it, and record per-clinic migration or exception decisions.

### 22.2 Development-phase catalog execution

The development catalog stage now includes the shared policy source, representative resolution tests, and consumer migration:

1. Keep the current Replit and Render development environments non-enforcing.
2. Add representative development fixtures or a populated development snapshot covering Trial, Starter, Growth, Pro, legacy `unpaid`, unknown states, usage below/at/above limits, and unavailable usage data. **Complete for representative fixtures and the current development snapshot.**
3. Create the versioned shared catalog from the approved Section 19 matrix. **Complete for the code-level published catalog.**
4. Add resolution tests for plan limits, annual savings, feature levels, messaging allowances, Trial rules, explicit deferrals, and unknown values. **Complete.**
5. Migrate public pricing, registration, landing-page pricing copy, activation pricing/labels, and storage quota resolution to the catalog without enabling enforcement. **Complete.**
6. Run the read-only baseline generator against representative development data and confirm it never treats unavailable data as zero. **Complete for development validation; the current report contains one clinic and the full Render-clinic baseline remains a pre-production gate.**
7. Keep the full Render-clinic migration baseline as a pre-production gate.
8. Do not assign plans, change subscription state, create Trial records, or enforce limits during this development stage.

The generator is read-only and uses the runtime `DATABASE_URL`; credentials must remain in the environment's secret configuration and must not be copied into the repository or chat. The representative fixture suite is also pure and does not connect to or mutate the database. The future pre-production baseline should run from the Render backend environment or an approved one-off environment against the Render database. The catalog must preserve the approved Section 19 decisions and remain reporting-only until the later warning and enforcement gates are approved.

### 22.3 Shared catalog foundation evidence

The development-stage catalog foundation was started on **2026-09-11 (Asia/Calcutta)**:

- Shared policy source: `shared/plan-catalog.ts`
- Focused policy tests: `shared/plan-catalog.test.ts`
- Catalog state: published code-level policy document, version `2026-09-11.v1`
- Plans represented: `trial`, `starter`, `growth`, and `pro`
- Included policy data:
  - prices and calculated annual savings
  - Trial duration, grace period, and Trial-lifetime allowances
  - booking, active-doctor, Smile Deal, and storage limits
  - SMS, WhatsApp, and email allowances
  - analytics, export, inventory, pharmacy, website, support, and visibility levels
  - essential versus advanced WhatsApp packaging
  - explicit transaction-fee and inventory/pharmacy item-count deferrals
  - unknown-plan handling without a silent Starter fallback
- Representative test coverage includes every plan, legacy `unpaid` separation from plan identity, unknown values, Trial and monthly periods, fair-use unlimited values, annual savings, and feature packaging.

Verification completed:

```text
npx tsx --test shared/plan-catalog.test.ts client/src/lib/booking-list.test.ts
  11 passed, 0 failed

npm run check
  passed

npm run build
  passed
```

### 22.4 Consumer migration evidence

The following plan-value consumers now read from `shared/plan-catalog.ts`:

- `client/src/pages/Pricing.tsx`
  - paid plan prices and annual savings
  - booking, doctor, and Smile Deal limits
  - WhatsApp, analytics, support, badge, and featured-placement values
- `client/src/pages/RegisterClinic.tsx`
  - paid plan prices, annual prices, display names, recommended-plan state, and summary limits
- `client/src/pages/Landing.tsx`
  - the “plans from” Starter price
- `server/storageQuota.ts`
  - Trial and paid storage limits, default Starter storage, and unknown-plan resolution
- `server/routes.ts`
  - activation prices and approval email plan labels
- Admin storage reporting continues to consume the catalog-derived `PLAN_STORAGE_LIMITS` map.

Transaction-fee percentages were removed from public plan comparison and registration copy because their policy remains explicitly deferred. No booking, upload, messaging, subscription, or plan-assignment enforcement was added.

### 22.5 Baseline policy-impact fixture evidence

The baseline generator no longer carries a second hardcoded copy of the plan limits. Its impact calculations now derive booking, doctor, Smile Deal, storage, and messaging values from `shared/plan-catalog.ts` through `shared/subscription-baseline-policy.ts`.

Representative read-only fixtures are defined in `shared/subscription-baseline-fixtures.ts` and are verified by `shared/subscription-baseline-policy.test.ts`. The fixtures cover:

- Trial at its lifetime boundaries, including lifetime messaging
- Starter above booking, doctor, Smile Deal, storage, and messaging limits
- Growth exactly at its configured limits
- Pro fair-use review thresholds
- A legacy `unpaid` subscription state kept separate from plan identity
- An unknown plan that remains unresolved instead of falling back to Starter
- Unavailable usage values represented as `null` without false over-limit findings

Validation:

```text
npm run test:subscription-baseline
  9 passed, 0 failed

npm run audit:subscription-baseline
  passed; 1 active development clinic reported, with no patient or clinic-identifying data emitted
```

Current revalidation also records:

```text
npx tsx --test shared/plan-catalog.test.ts
  7 passed, 0 failed

npm run check
  passed

Build Check
  finished successfully
```

The baseline policy-impact verification gate is complete for development. The remaining catalog-related gates are draft/published persistence, immutable database policy history, Trial lifecycle behavior, dedicated reporting UI, and the Render production baseline. Reporting-only entitlement endpoints are now implemented and covered by focused resolver tests.

### 22.6 Subscription lifecycle/history implementation evidence

Step 6 was implemented on **2026-09-12 (Asia/Calcutta)** as a data-contract migration only:

- `clinics` now has nullable current-lifecycle fields for Trial dates, Trial origin, previous paid plan, paid-access expiry, and the current policy version.
- `subscription_lifecycle_events` records append-only transitions with from/to plan and status, policy version, transition identity, actor, reason, metadata, effective time, and creation time.
- `subscription_plan_assignments` records plan and billing-cycle assignment history with source, actor, policy version, transition identity, and validity dates.
- `subscription_access_grants` records fixed-term sponsored access separately from paid provider subscriptions, including the catalog/list-price snapshot that was waived.
- `subscription_access_exceptions` records fixed-term entitlement overrides separately from sponsored access.
- Duplicate transition, grant, and exception identifiers are rejected by database uniqueness constraints.
- `IStorage` and `DatabaseStorage` expose append-only insert/read methods for all four history records. There are intentionally no update/delete methods.
- Legacy `unpaid` values remain readable through the existing subscription-status normalization; no existing clinic subscription state was changed.
- Startup registration is idempotent in both `server/index.ts` and `server/db.ts`. All new clinic columns are nullable, and no Trial, assignment, grant, or exception rows are created automatically.

The exact SQL to run manually on Render PostgreSQL, if the deployment does not run the startup registration, is:

```sql
ALTER TABLE clinics
  ADD COLUMN IF NOT EXISTS trial_started_at timestamp,
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamp,
  ADD COLUMN IF NOT EXISTS trial_grace_ends_at timestamp,
  ADD COLUMN IF NOT EXISTS trial_origin varchar(40),
  ADD COLUMN IF NOT EXISTS previous_paid_plan varchar(20),
  ADD COLUMN IF NOT EXISTS paid_access_expires_at timestamp,
  ADD COLUMN IF NOT EXISTS subscription_policy_version varchar(40);

CREATE TABLE IF NOT EXISTS subscription_lifecycle_events (
  id serial PRIMARY KEY,
  clinic_id integer NOT NULL REFERENCES clinics(id),
  event_type varchar(50) NOT NULL,
  from_plan varchar(20),
  to_plan varchar(20),
  from_status varchar(30),
  to_status varchar(30),
  policy_version varchar(40),
  transition_id varchar(120) NOT NULL,
  actor_type varchar(30) NOT NULL DEFAULT 'system',
  actor_id varchar(255),
  reason text,
  metadata jsonb DEFAULT '{}'::jsonb,
  effective_at timestamp NOT NULL DEFAULT NOW(),
  created_at timestamp NOT NULL DEFAULT NOW(),
  CONSTRAINT subscription_lifecycle_events_clinic_transition_uidx UNIQUE (clinic_id, transition_id)
);
CREATE INDEX IF NOT EXISTS subscription_lifecycle_events_clinic_effective_idx
  ON subscription_lifecycle_events (clinic_id, effective_at);

CREATE TABLE IF NOT EXISTS subscription_plan_assignments (
  id serial PRIMARY KEY,
  clinic_id integer NOT NULL REFERENCES clinics(id),
  plan varchar(20) NOT NULL,
  billing_cycle varchar(10) NOT NULL DEFAULT 'monthly',
  source varchar(30) NOT NULL,
  policy_version varchar(40),
  transition_id varchar(120) NOT NULL,
  assigned_by_type varchar(30),
  assigned_by_id varchar(255),
  reason text,
  starts_at timestamp NOT NULL DEFAULT NOW(),
  ends_at timestamp,
  created_at timestamp NOT NULL DEFAULT NOW(),
  CONSTRAINT subscription_plan_assignments_clinic_transition_uidx UNIQUE (clinic_id, transition_id)
);
CREATE INDEX IF NOT EXISTS subscription_plan_assignments_clinic_starts_idx
  ON subscription_plan_assignments (clinic_id, starts_at);

CREATE TABLE IF NOT EXISTS subscription_access_grants (
  id serial PRIMARY KEY,
  clinic_id integer NOT NULL REFERENCES clinics(id),
  grant_id varchar(120) NOT NULL UNIQUE,
  plan varchar(20) NOT NULL,
  policy_version varchar(40),
  list_price_minor integer,
  currency varchar(3) NOT NULL DEFAULT 'INR',
  reason text NOT NULL,
  granted_by_type varchar(30) NOT NULL,
  granted_by_id varchar(255),
  starts_at timestamp NOT NULL,
  ends_at timestamp NOT NULL,
  revoked_at timestamp,
  created_at timestamp NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS subscription_access_grants_clinic_dates_idx
  ON subscription_access_grants (clinic_id, starts_at, ends_at);

CREATE TABLE IF NOT EXISTS subscription_access_exceptions (
  id serial PRIMARY KEY,
  clinic_id integer NOT NULL REFERENCES clinics(id),
  exception_id varchar(120) NOT NULL UNIQUE,
  entitlement_key varchar(100) NOT NULL,
  override_value jsonb,
  policy_version varchar(40),
  reason text NOT NULL,
  granted_by_type varchar(30) NOT NULL,
  granted_by_id varchar(255),
  starts_at timestamp NOT NULL,
  ends_at timestamp NOT NULL,
  revoked_at timestamp,
  created_at timestamp NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS subscription_access_exceptions_clinic_dates_idx
  ON subscription_access_exceptions (clinic_id, starts_at, ends_at);
```

This step establishes the durable data contract without automatically assigning plans, changing existing subscription state, calling payment-provider mutations, or enabling entitlement enforcement. Trial behavior and Super Admin assignment actions remain later steps; the reporting-only effective-entitlement service is now implemented separately.

### 22.7 Recommended next executable step

**Completed on 2026-09-12 (Asia/Calcutta): add the effective-entitlement service in reporting-only mode.**

Implemented:

- `shared/effective-entitlement.ts` resolves the current plan, normalized subscription state, published catalog policy, active sponsored access, active time-limited exceptions, capability values, limits, usage, remaining values, freshness, and reason codes.
- `server/effective-entitlement.ts` calculates clinic-scoped booking, active-doctor, live Smile Deal, storage, and SMS/WhatsApp/email usage using clinic timezone boundaries and the approved counting rules.
- `GET /api/auth/clinic/settings/entitlements` exposes the report to the authenticated clinic owner.
- `GET /api/admin/clinics/:id/entitlements` exposes the same report to Super Admin.
- Unknown plans remain unresolved; pending/expired/provider-attention states remain visible; sponsored access and exceptions are reported separately.
- Both endpoints are explicitly reporting-only and do not block actions, assign plans, create Trial records, change subscription state, or call payment providers.
- Focused resolver, catalog, subscription-state, and baseline-policy tests pass; TypeScript checking passes.

The dedicated read-only Subscription Plans Admin UI is now implemented as the Admin Entitlements tab. The next release gate is full reporting-period validation, including the production-clinic baseline. Trial lifecycle automation, policy persistence, warnings, and server-side enforcement remain later stages.

### 22.8 Read-only Admin entitlement review evidence

The read-only Admin visibility stage was implemented on **2026-09-12 (Asia/Calcutta)**:

- `client/src/components/AdminEntitlementReview.tsx` provides a searchable clinic list and selected-clinic report view.
- `client/src/pages/Admin.tsx` exposes the view through the role-protected **Entitlements** tab.
- The view consumes `GET /api/admin/clinics/:id/entitlements`; it does not duplicate entitlement calculations or introduce mutation routes.
- The selected-clinic view shows effective plan and source, normalized subscription state, policy version, timezone, measured time, Trial/paid/sponsored dates, usage and limits, remaining values, feature packaging, exceptions, and unknown/unavailable states.
- The UI explicitly labels itself reporting-only and excludes clinic treatment revenue, patient bills, doctor earnings, and payment-provider mutations.

Verification for this stage:

```text
npm run check
  passed

git diff --check
  passed
```

The remaining release gate is the read-only production-clinic baseline. It was attempted on **2026-09-12 (Asia/Calcutta)** through the production read-only database path, but the platform reported that this Repl has no production database attached and that publishing is required to create one. No production query was executed, and the development database was not substituted. The Admin UI does not authorize plan changes, create Trial records, change subscription state, call payment providers, issue warnings, or enforce limits.

### 22.9 Production baseline gate attempt

The production baseline gate was attempted on **2026-09-12 (Asia/Calcutta)**:

- The approved production read-only database path was used to inspect the production schema before generating the report.
- Result: **blocked before query execution** because the Repl has no production database attached.
- Platform response: publishing the app is required to create the production database.
- No production records were read or changed.
- The development baseline remains valid only for development validation and must not be treated as a production migration decision.

The next operational prerequisite is to publish the app or provide an approved populated production snapshot/database connection. Once available, rerun the read-only baseline and record per-clinic migration or exception decisions before production rollout or enforcement. Development implementation of the first audited Trial operation is recorded below; it does not replace the production baseline gate.

### 22.10 Audited Super Admin Trial operation evidence

The first Phase 4 lifecycle slice was implemented on **2026-09-12 (Asia/Calcutta)**:

- `POST /api/admin/clinics/:id/trial` is a dedicated Super Admin route for `start` and `extend` actions.
- The route requires a non-empty reason, validates extension length, uses a client-supplied transition ID for retry safety, and rejects restarting an existing Trial or replacing an active paid plan.
- Start uses the published Trial policy duration and grace period. Extend adds a bounded 1–30 day period without resetting the original Trial start.
- The clinic compatibility snapshot is updated with `plan=trial`, `subscriptionStatus=trialing`, Trial dates, Trial origin, previous paid plan where known, and the published policy version.
- Each action writes both an append-only `subscription_plan_assignments` record and an append-only `subscription_lifecycle_events` record. No Razorpay subscription is created, changed, or reused.
- `shared/subscription-status.ts` now recognizes `trialing` as a distinct active access state, while legacy `unpaid` remains mapped to `pending_payment`.
- Effective entitlement reporting treats a Trial as active only while its explicit Trial end date is in the future; an expired or undated Trial remains visible as an attention state instead of silently receiving active Trial access.
- `client/src/components/AdminEntitlementReview.tsx` adds responsive Start Trial / Extend Trial controls and a required-reason confirmation dialog. The view refreshes clinic and entitlement data after a successful action.

Verification completed:

```text
npm run check
  passed

npm run test:subscription-entitlements
  24 passed

git diff --check
  passed
```

This slice intentionally does not implement warning mode, server-side enforcement, Trial conversion, or post-grace expiry processing. Automatic initial Trial and paid-expiry recovery are recorded in Section 22.12; the production baseline remains a release gate before enabling lifecycle automation against live clinics.

### 22.11 Dedicated Super Admin subscription operations evidence

The next Admin subscription stage was implemented on **2026-09-12 (Asia/Calcutta)**:

- `GET /api/admin/clinics/:id/subscription-history` exposes lifecycle events, plan assignments, sponsored-access grants, and entitlement exceptions for the selected clinic.
- `POST /api/admin/clinics/:id/paid-plan` provides a dedicated paid-plan assignment path for non-active-paid clinics. It validates plan and billing cycle, prepares a Razorpay subscription when the provider mapping is configured, creates a seven-day activation token, records the clinic as `pending_payment`, and writes append-only assignment and lifecycle records. It never marks the clinic as paid without provider activation.
- `POST /api/admin/clinics/:id/sponsored-access` grants fixed-term Starter, Growth, or Pro access separately from paid subscription state, with list-price snapshot, dates, reason, one-active-grant protection, and lifecycle history.
- `POST /api/admin/clinics/:id/entitlement-exceptions` grants a fixed-term capability override with validation, one-active-exception-per-capability protection, reason, dates, and lifecycle history.
- `AdminEntitlementReview` now provides All, Needs attention, Trial, and Active paid filters, dedicated paid-plan, sponsored-access, and exception dialogs, and an append-only subscription history panel.
- All new actions remain Super Admin-only, require a reason, use transition/grant/exception identifiers for retry safety, and remain reporting/access-record operations rather than server-side enforcement.

The following blueprint boundaries remain intentionally deferred:

- Trial conversion and expiry automation;
- policy draft/review/publish persistence;
- sponsored-access and exception revocation;
- provider webhook reconciliation and subscription finance ledger;
- clinic-facing warnings and upgrade guidance;
- server-side entitlement enforcement;
- removal of the older clinic-approval plan mutation after the dedicated provider workflow is fully reconciled.

Verification completed after this stage:

```text
npm run check
  passed
```

### 22.12 Automatic Trial and paid-expiry recovery evidence

The next Trial lifecycle slice was implemented on **2026-09-12 (Asia/Calcutta)**:

- `shared/trial-lifecycle.ts` centralizes Trial-window calculation, initial-Trial creation, and paid-expiry recovery eligibility. It uses the published Trial duration and grace period instead of duplicating policy values.
- `PATCH /api/clinics/:id/approve` now starts the catalog-defined Trial when a pending clinic is approved. It records `plan=trial`, `subscriptionStatus=trialing`, Trial dates, `trialOrigin=initial_signup`, policy version, and append-only assignment/lifecycle history.
- Clinic approval no longer creates a Razorpay subscription or activation-payment link. Paid plans are assigned through the dedicated audited Admin paid-plan route.
- The Admin approval UI now states that approval starts the 14-day Trial and removes the older plan/cycle selectors that implied payment was required at approval.
- The Razorpay subscription webhook treats `subscription.completed` and `subscription.expired` as paid-expiry signals. Eligible active, past-due, or expired paid clinics move into a 14-day recovery Trial with a seven-day grace period.
- Recovery preserves the prior paid plan, provider subscription reference, paid-expiry date when provided, policy version, and provider/lifecycle history.
- Provider event IDs are ignored on repeat delivery, and recovery transition IDs prevent the same paid-expiry event from restarting a Trial.
- Repeated approval of an already-approved clinic is rejected rather than creating a second initial-Trial record.

Verification completed:

```text
npm run check
  passed

node --import tsx --test shared/trial-lifecycle.test.ts \
  shared/effective-entitlement.test.ts \
  shared/plan-catalog.test.ts \
  shared/subscription-status.test.ts \
  shared/subscription-baseline-policy.test.ts
  28 passed

git diff --check
  passed
```

The remaining lifecycle work is Trial conversion, post-grace expiry processing, clinic-facing Trial/recovery notices, and the production baseline gate before live rollout.