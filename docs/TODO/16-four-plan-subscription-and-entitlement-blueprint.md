# Four-Plan Subscription and Entitlement Blueprint

**Status:** Planning only — no application behavior has been changed  
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
7. A safe trial-expiry process that preserves clinic data and does not silently break essential clinical or security communication.

This document is a policy and implementation blueprint. It does not authorize changing plan prices, Razorpay configuration, database schema, clinic access, or notification behavior until the decisions in this document are approved.

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

When a trial expires or a clinic downgrades:

- Existing data remains preserved.
- The clinic receives a clear explanation.
- New restricted activity is controlled explicitly.
- Export and data-access rights remain available.
- No records are silently deleted.

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

### 12.4 Paid subscription states

For paid plans, access decisions must use the shared subscription-state policy. The policy must define:

- Whether a payment grace period exists.
- Whether messaging continues during payment grace.
- Whether new bookings continue during payment review.
- Whether existing data remains readable.
- Which actions require reactivation.
- How provider errors differ from confirmed cancellation.

No route should independently invent its own interpretation of `unpaid`, `expired`, or unknown provider states.

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

---

## 15. Super Admin requirements

The Super Admin operations area should show the subscription model without exposing clinic treatment revenue or routine patient billing details.

### 15.1 Overview

Add or plan for:

- Clinics in Trial.
- Trials expiring within 7 days.
- Expired Trials awaiting conversion.
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
| Trial/renewal date | Relevant expiry or renewal date |
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
- Provider subscription link status.
- Booking usage and limit.
- Active doctor count and limit.
- Smile Deal count and limit.
- Messaging usage and allowance.
- Storage usage and limit.
- Analytics and feature access.
- Active exceptions.
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
5. Add clinic-facing Trial notices.
6. Add Super Admin Trial filters and attention states.
7. Add tests for timezone and boundary behavior.

**Output:** A reliable Trial lifecycle without changing paid clinic access.

### Phase 3 — Reporting-only entitlements

1. Calculate booking, doctor, deal, message, and storage usage.
2. Return current usage, limit, remaining value, and freshness.
3. Add clinic-facing usage panels.
4. Add Super Admin plan and usage summaries.
5. Compare calculated values with current operational data.
6. Do not block actions yet.

**Output:** Measurable plan usage with no sudden production disruption.

### Phase 4 — Warning mode

1. Add 80% and 95% warnings where applicable.
2. Add Trial expiry warnings.
3. Add upgrade prompts.
4. Add operational alerts.
5. Add audit records for warnings.
6. Verify unavailable data is not displayed as zero.

**Output:** Clinics and platform staff can act before limits interrupt work.

### Phase 5 — Controlled server-side enforcement

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

### Phase 6 — Provider and commercial alignment

1. Confirm Razorpay plan mapping remains correct.
2. Add paid-plan upgrade and downgrade flows.
3. Add Trial-to-paid conversion handling.
4. Define transaction-fee calculation only after the fee policy is approved.
5. Add plan-change reconciliation and provider event handling.
6. Add historical policy references to usage reports.

**Output:** Subscription state and entitlements remain aligned with the payment provider.

### Phase 7 — Commercial refinement

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

No code should infer answers to these questions from current UI text.

---

## 20. Acceptance criteria

The four-plan policy is ready for implementation when:

- Trial, Starter, Growth, and Pro have plain-language purposes.
- Trial duration and expiry behavior are approved.
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

After approval, the next document update should reconcile the messaging blueprint with the Trial tier and record the final decisions. Only after that should the shared entitlement catalog and Trial lifecycle be implemented.