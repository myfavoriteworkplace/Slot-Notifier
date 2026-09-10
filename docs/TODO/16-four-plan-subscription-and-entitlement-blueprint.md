# Four-Plan Subscription and Entitlement Blueprint

**Status:** Planning only — implementation roadmap clarified; no application behavior has been changed
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

This document is a policy and implementation blueprint. It does not authorize changing plan prices, Razorpay configuration, database schema, clinic access, or notification behavior until the decisions in this document are approved.

---

## Implementation plan at a glance

This table is the recommended execution order. It separates business decisions from coding work so that the application does not start blocking clinics before the rules are agreed and measured.

| Step | Purpose in common words | Main implementation work | Progress today | Done when |
|---|---|---|---|---|
| **0. Approve the rules** | Decide what each plan includes before anyone builds limits around it. | Confirm Trial duration, limits, grace period, messaging categories, booking counting, WhatsApp packaging, Pro fair use, payment grace, and transaction-fee scope. | **Needs product approval.** The blueprint contains recommendations, but the open decisions are not signed off. | There is one approved four-plan matrix and no route or UI has to guess what a limit means. |
| **1. Record the current baseline** | Take a safe “before” snapshot so new restrictions do not accidentally break existing clinics. | Inventory current plan assignments, subscription states, Razorpay IDs, usage, storage, doctors, deals, bookings, and provider events. Identify clinics that would already be above a proposed Trial or paid limit. | **Foundation exists, audit still needed.** The app already stores several of these values, but there is no complete entitlement baseline report. | Every clinic has a known current plan, access state, usage snapshot, and migration/exception decision. |
| **2. Create one shared plan catalog** | Put the rules in one place instead of copying numbers across screens and routes. | Define `trial`, `starter`, `growth`, and `pro`; centralize limits, feature levels, messaging allowances, warnings, and policy versions; add resolution tests. | **Partial foundation.** Paid plan values and some storage/messaging data exist, but there is no central entitlement catalog. | Pricing, Admin, clinic UI, services, and routes all read the same versioned policy. |
| **3. Add explicit subscription and Trial lifecycle data** | Make “which plan” different from “is this clinic currently allowed to use it?” | Add or normalize Trial start/end/grace dates, Trial origin, previous paid plan, paid-expiry time, conversion history, and transition identity. Keep legacy `unpaid` readable. | **Not started.** The current schema has plan, billing cycle, subscription status, and Razorpay ID, but no Trial lifecycle fields. | The system can explain whether a clinic is Trialing, active, pending payment, expired, or in recovery without reconstructing history manually. |
| **4. Build the effective-entitlement service** | Give every part of the app the same answer about what a clinic may do right now. | Resolve clinic → plan → subscription/Trial state → policy defaults → temporary exception → emergency disablement; return value, source, usage, limit, and stable error code. | **Not started.** The subscription-state normalizer exists, but it does not calculate plan permissions or limits. | A single server-side service answers both “what is included?” and “is this action allowed?” |
| **5. Calculate usage in reporting-only mode** | Measure first, without blocking anyone. | Calculate booking, doctor, Smile Deal, storage, SMS, WhatsApp, email, analytics, and export usage; show used, limit, remaining, reset/expiry date, timezone, and data freshness. | **Partial foundation.** Communication usage, storage tracking, and some Admin/clinic views exist; plan limits are not connected to a unified report. | At least one complete reporting period proves the numbers are accurate and unavailable data is not shown as zero. |
| **6. Implement Trial and paid-expiry recovery** | Give new clinics a safe trial and give expired paid clinics a short, controlled chance to recover. | Start Trial once, calculate expiry/grace dates, warn before expiry, move confirmed paid expiry to recovery Trial, preserve old plan/provider history, and make the transition idempotent. | **Not started.** No `trialing` state or automatic paid-expiry recovery flow exists. | Repeated provider events cannot restart a Trial, and expiry never deletes data or silently leaves paid access active. |
| **7. Add Super Admin plan operations** | Let authorized staff manage plans safely without editing clinic rows directly. | Add policy configuration, Start Trial, Extend Trial, Assign Paid Plan after expiry, reasons, confirmation, role checks, audit events, stale-state protection, and provider-aware activation. | **Partial foundation.** Clinic approval can select Starter/Growth/Pro, but there is no dedicated four-plan management flow or Trial action. | Every manual plan change is authorized, confirmed, explainable, audited, and safe against provider/admin races. |
| **8. Add clinic and Admin visibility** | Make it obvious why a clinic has access, what it has used, and what happens next. | Add plan/state/usage panels, Trial and recovery notices, expiry dates, upgrade/support paths, above-limit warnings, and Super Admin filters/details. | **Partial foundation.** Some storage and messaging usage views exist; there is no complete plan/Trial/entitlement view. | A clinic can understand its plan without technical terms, and Super Admin can find attention cases quickly. |
| **9. Turn on warnings before restrictions** | Give people time to act instead of suddenly stopping work. | Add 80% and 95% warnings, Trial expiry reminders, operational alerts, warning audit records, and upgrade/support guidance. | **Not started as a unified system.** Individual usage displays exist, but shared thresholds and audit events do not. | Warnings are accurate, explainable, timezone-aware, and do not consume the clinic’s own allowance. |
| **10. Enforce limits on the server** | Actually apply the plan rules securely; hiding a button is not enough. | Enforce doctor, booking, deal, storage, analytics, export, and messaging rules in backend routes/services; protect essential clinical/security messages; return structured errors. | **Not started.** Current dashboard modules are generally available independently of plan. | Every restricted operation is checked server-side and gives a clear reason when denied; existing data remains visible. |
| **11. Align Razorpay and plan changes** | Ensure the screen, database, and payment provider never disagree. | Verify plan/cycle mapping, Trial-to-paid conversion, recovery-Trial-to-paid assignment, upgrades, downgrades, payment grace, webhook reconciliation, idempotency, and historical policy references. | **Partial foundation.** Razorpay plan mapping and provider-event history exist; Trial conversion/recovery and safe plan changes do not. | A paid plan is activated only through the approved provider/payment path, and expired provider subscriptions are never reused accidentally. |
| **12. Release gradually and refine** | Learn from real usage before making the limits permanent. | Run policy tests, authorization tests, counting/privacy tests, Build Check, reporting comparison, warning rollout, controlled optional-message enforcement, monitoring, and versioned allowance changes. | **Not started.** The blueprint defines tests and rollout stages, but no four-plan rollout has begun. | Production behavior is measured, support issues are understood, and future plan changes remain explainable through policy versions. |

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

### 5.2 Trial duration

Recommended policy:

- 14 calendar days.
- Trial starts when the clinic is activated or completes its first authenticated onboarding session.
- The start event must be recorded once and must not reset merely because the clinic logs out.
- The exact start and end timestamps should be stored.
- The clinic timezone should be used for the human-facing expiry date.
- The server should use unambiguous timestamps for access decisions.

The product should not offer repeated automatic trials to the same clinic without an explicit, audited administrator decision.

### 5.3 Trial payment details

Recommended policy: do not require a payment card or Razorpay payment method to start the Trial.

Reasons:

- Reduces onboarding friction.
- Avoids charging or authorization confusion.
- Makes the Trial genuinely useful for clinics evaluating the workflow.
- Keeps the paid conversion decision explicit.

The platform may request billing details when the clinic chooses a paid plan, not before the Trial begins.

### 5.4 Trial limits

Recommended initial limits:

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

Recommended expiry sequence:

1. Seven days before expiry:
   - Show an in-product notice.
   - Show the expiry date.
   - Explain the Starter, Growth, and Pro options.
2. Two days before expiry:
   - Show a higher-priority reminder.
3. At expiry:
   - Preserve all data.
   - Stop new Trial-only activity that exceeds the Trial limits.
   - Stop new public bookings after the grace policy is applied.
   - Do not silently delete the public profile, patient data, or clinical records.
4. Grace period:
   - Provide a short read-only grace period, recommended as seven days.
   - Permit login, viewing, support contact, and data export.
   - Do not continue unrestricted Trial messaging.
5. After grace period:
   - Keep the account and data available for upgrade or support.
   - Keep protected data access and export behavior explicit.
   - Do not treat an expired Trial as an active paid subscription.

The exact grace-period duration is a product decision, but it must be stored and displayed rather than inferred only from UI state.

### 5.6 Trial conversion

When the clinic selects a paid plan:

- The chosen paid plan becomes effective according to the approved billing policy.
- Previously used Trial usage should not be erased from historical reporting.
- Current-period paid allowances should be calculated using the approved upgrade rule.
- The conversion event should be audited.
- The clinic should not be charged twice because of a Trial-to-paid transition.

Recommended initial conversion rule: the paid plan becomes effective immediately after successful subscription activation, and usage already consumed is retained in the period rather than reset.

### 5.7 Paid-plan expiry automatically enters Trial/recovery

The recommended default behavior is:

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
7. The recommended recovery duration is 14 calendar days.
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

The exact post-recovery read-only behavior must be consistent with initial Trial expiry, but it must never delete clinic data.

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

### 8.1 Recommended allowances

| Plan | SMS | WhatsApp | Email | Period |
|---|---:|---:|---:|---|
| Trial | 25 | 25 | 50 | Trial lifetime |
| Starter | 100 | 100 | 300 | Calendar month |
| Growth | 500 | 500 | 1,500 | Calendar month |
| Pro | 2,000 | 2,000 | 6,000 | Calendar month |

The three channels remain separate. Unused email allowance must not silently convert into SMS or WhatsApp.

### 8.2 WhatsApp packaging decision

The current public pricing page does not advertise WhatsApp for Starter. This blueprint recommends:

- Essential appointment WhatsApp notifications: available in Trial, Starter, Growth, and Pro within each plan’s allowance.
- Bulk, promotional, or advanced WhatsApp workflows: Growth and Pro only.

This provides a coherent Trial-to-Starter experience while still preserving meaningful Growth and Pro differentiation.

If the business instead wants WhatsApp to remain Growth/Pro-only, the Trial must not advertise or rely on WhatsApp as part of its complete workflow. That alternative should be explicitly approved rather than left as an accidental downgrade.

### 8.3 Counting rules

The recommended starting rule is:

- Count accepted or provider-billable production messages.
- Do not count failed messages unless the provider charged for them.
- Do not count intentionally skipped messages.
- Do not count messages marked as test.
- Count one unit per recipient when the provider charges per recipient.
- Keep attempted, accepted, failed, skipped, billable, and test counts separately visible.

The event-purpose mapping must classify messages as:

| Category | Examples | Recommended behavior |
|---|---|---|
| Essential service | OTP, booking confirmation, security, consent links | Do not silently block |
| Routine clinic operations | Appointment reminders and routine clinic alerts | Warn, then apply approved policy |
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

### 9.1 Recommended limits

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

Recommended starting values:

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

Recommended starting rule: count successfully created production bookings once, excluding rejected or atomic-conflict attempts. Preserve all lifecycle changes in reporting without counting every status transition as a new booking.

### 10.2 Doctor limits

Recommended starting values:

| Plan | Active doctor limit |
|---|---:|
| Trial | 1 |
| Starter | 1 |
| Growth | 3 |
| Pro | Unlimited with fair-use monitoring |

The limit should apply to active configured doctors, not historical doctors who have been deactivated. Existing appointments and clinical records must remain associated with historical doctors.

### 10.3 Smile Deal limits

Recommended starting values:

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

Whether drafts count toward a limit must be explicit. Recommended policy: only active published posts count against the live-post allowance; Trial may have one temporary draft or post for evaluation.

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

Recommended policy:

- Trial: one export.
- Starter: standard export with reasonable rate limits.
- Growth: advanced filters and scheduled export.
- Pro: full export options and priority processing.

All export operations must remain audited. A plan limit must not prevent a clinic from retrieving its own data during account closure, support, or legally required access.

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

For paid plans, access decisions must use the shared subscription-state policy. The policy must define:

- Whether a payment grace period exists.
- Whether messaging continues during payment grace.
- Whether new bookings continue during payment review.
- Whether existing data remains readable.
- Which actions require reactivation.
- How provider errors differ from confirmed cancellation.
- When confirmed expiry triggers the default Trial/recovery transition.
- How provider expiry events are reconciled before changing the clinic’s effective plan.

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

Recommended initial policy:

- Take effect after successful paid subscription activation.
- Do not erase usage already consumed.
- Use the new plan’s limits for the remaining period.
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

- Only authorized Super Admins can change plan policies.
- Each change requires a reason.
- Changes are versioned with effective timestamps.
- Existing historical usage remains tied to the policy that was active at the time.
- A policy change must not silently reset clinic usage.
- High-impact paid-plan or messaging changes should require an explicit confirmation step.
- Plan policy configuration is different from a tenant-specific exception.

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

### 15.2 Tenant table

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

### 15.3 Tenant detail

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

### 16.3 Privacy and security

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
6. Keep current behavior unchanged until enforcement is intentionally enabled.

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
5. Add provider-aware activation and payment-pending states.
6. Add confirmation and stale-state protection.
7. Add previous-plan, Trial-origin, and transition history to the tenant detail view.
8. Prevent direct unrestricted plan mutation through the general clinic-edit route.

**Output:** Administrators can safely configure Trial policy, extend a Trial, and assign a paid plan after paid expiry.

### Phase 5 — Warning mode

1. Add 80% and 95% warnings where applicable.
2. Add Trial expiry warnings.
3. Add upgrade prompts.
4. Add operational alerts.
5. Add audit records for warnings.
6. Verify unavailable data is not displayed as zero.

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

## 19. Open decisions requiring product approval

The following decisions must be confirmed before implementation:

1. Is the Trial exactly 14 days?
2. Does the Trial start at clinic activation or first authenticated use?
3. Is the Trial grace period exactly seven days?
4. Are payment details required before a clinic can start a Trial?
5. Are Trial messaging allowances lifetime limits or period limits?
6. Should essential WhatsApp notifications be included in Starter?
7. Which messages are classified as essential?
8. Do provider-billable failures consume allowance?
9. Are booking limits based on created bookings or completed appointments?
10. Do cancelled or no-show bookings count?
11. Do Smile Deal drafts count toward a plan limit?
12. What is Pro fair use?
13. What happens to public booking after Trial expiry?
14. What export access remains after expiry or downgrade?
15. What exactly does the transaction fee apply to?
16. Will inventory and pharmacy limits be volume-based or feature-based?
17. Which advanced website controls belong to Growth versus Pro?
18. Should Starter have standard email support from launch?
19. Is an allowance prorated during the first paid month?
20. What payment grace period applies to paid subscriptions?
21. Is the recovery Trial duration exactly 14 days?
22. Should the automatic recovery Trial be available once per paid provider subscription instance?
23. What read-only and public-booking behavior applies after the recovery Trial ends?
24. Which Super Admin roles can configure plan policies?
25. Which Super Admin roles can assign or extend a Trial?
26. Does assigning a paid plan after expiry require successful payment before access changes?
27. Which paid-plan changes are effective immediately versus at the next renewal?

No code should infer answers to these questions from current UI text.

---

## 20. Acceptance criteria

The four-plan policy is ready for implementation when:

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

## 22. Recommended next decision

Approve or revise the proposed matrix before implementation:

| Plan | Bookings | Doctors | Storage | SMS | WhatsApp | Email |
|---|---:|---:|---:|---:|---:|---:|
| Trial | 10 total / 14 days | 1 | 50 MB | 25 | 25 | 50 |
| Starter | 30/month | 1 | 100 MB | 100 | 100 | 300 |
| Growth | 150/month | 3 | 500 MB | 500 | 500 | 1,500 |
| Pro | Unlimited with fair use | Unlimited with fair use | 2,047 MB | 2,000 | 2,000 | 6,000 |

The recommended commercial position is:

- Keep current paid prices.
- Add a 14-day no-card Trial.
- Make Growth the recommended plan.
- Keep core clinical workflows available on all tiers.
- Use volume, messaging, analytics, visibility, and support for differentiation.
- Include essential WhatsApp notifications in Starter, while reserving advanced promotional WhatsApp for Growth and Pro.
- Start with reporting, then warnings, then controlled enforcement.
- On confirmed paid expiry, move the clinic by default to a 14-day Trial/recovery state using Trial limits.
- Preserve the previous paid plan and provider history.
- Let Super Admin later assign Starter, Growth, or Pro through a provider-aware, audited action.

After approval, the next document update should reconcile the messaging blueprint with the Trial and recovery-Trial tiers and record the final decisions. Only after that should the shared entitlement catalog, expiry fallback, and Super Admin plan-management flow be implemented.