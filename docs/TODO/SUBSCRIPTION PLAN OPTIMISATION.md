# Subscription Plan Optimisation

**Status:** Proposed blueprint — analysis and planning only  
**Date:** 2026-09-14  
**Related blueprint:** [16-four-plan-subscription-and-entitlement-blueprint.md](./16-four-plan-subscription-and-entitlement-blueprint.md)

## 1. Purpose

This document defines the recommended operating model for:

- Plan selection during clinic registration.
- Trial-first clinic approval.
- Manual plan assignment by Super Admin.
- Complimentary access without payment.
- Verified offline payment, if the business accepts it later.
- Monthly and annual billing cycles.
- Manual and automatic upgrades.
- Manual and automatic downgrades.
- Scheduled subscription changes.
- Provider reconciliation and audit history.

This is a design and implementation blueprint. It does not authorize changing application code, database schema, payment-provider configuration, clinic access, or enforcement behavior by itself.

The four-plan catalog remains the source of truth:

```text
Trial
Starter
Growth
Pro
```

The current application remains reporting-only until the release gates in the main subscription blueprint are completed.

---

## 2. Current application analysis

### 2.1 Clinic registration

The registration page currently:

- Requires a clinic to select Starter, Growth, or Pro.
- Displays monthly and annual pricing.
- Sends the selected plan to the registration endpoint.
- Does not provide a complete monthly/annual selection workflow.
- Uses wording that suggests payment will happen after approval.

The server does not activate the selected paid plan during registration. Clinic approval starts the catalog-defined 14-day Trial instead.

The current behavior is therefore conceptually close to a Trial-first model, but the UI and stored state can make the selected paid plan appear more authoritative than it is.

### 2.2 Clinic approval

Approval currently:

1. Verifies that the clinic is pending.
2. Creates clinic credentials.
3. Changes the clinic to approved.
4. Starts the 14-day Trial.
5. Applies the seven-day Trial grace period.
6. Does not create a Razorpay subscription.
7. Does not take payment.

This should remain the default approval behavior.

### 2.3 Super Admin subscription operations

The current Admin subscription area supports:

- Starting a Trial.
- Extending a Trial.
- Assigning a paid plan.
- Selecting monthly or annual billing for paid assignment.
- Granting sponsored access.
- Granting temporary entitlement exceptions.
- Revoking temporary access.
- Viewing subscription history.
- Filtering clinics by subscription attention, Trial, and active paid state.

The current paid-plan flow is provider-aware:

- It creates a Razorpay subscription when configured.
- It moves the clinic to `pending_payment`.
- It does not mark the clinic paid before provider confirmation.
- It records lifecycle and assignment history.
- It blocks changing an already-active paid plan through the initial assignment route.

The old broad “Mark Paid” mutation is disabled, which is correct.

### 2.4 Provider lifecycle

The application currently records:

- Razorpay provider events.
- Duplicate provider events.
- Provider activation.
- Trial-to-paid lifecycle transitions.
- Paid-expiry recovery Trial transitions.
- Post-grace Trial expiry reconciliation.
- Append-only lifecycle history.

The main remaining commercial-management gaps are:

- Registration preference storage separate from effective subscription state.
- A clear complimentary-access assignment mode.
- A verified manual-payment mode if offline payment is accepted.
- Upgrade and downgrade scheduling.
- Billing-cycle changes.
- Automatic scheduled-change processing.
- Full provider and finance reconciliation.

---

## 3. Core design principle

The application must keep these concepts separate:

```text
Plan preference
  What the clinic requested or prefers.

Effective access
  The plan and temporary access the clinic may use now.

Payment state
  Whether payment has been confirmed, is pending, has failed, or was verified manually.
```

The following must never be treated as equivalent:

```text
Clinic requested Growth
Clinic currently has Growth access
Clinic paid for Growth
Clinic has complimentary Growth access
```

---

## 4. Recommended registration model

### 4.1 Trial-first registration

The registration flow should make the Trial the primary entry point:

```text
Clinic submits registration
        ↓
Clinic chooses Trial-first registration
        ↓
Clinic may optionally choose a preferred paid plan
        ↓
Super Admin reviews the registration
        ↓
Approval starts the 14-day Trial
        ↓
Clinic later converts to paid or receives complimentary access
```

The registration page should state:

> Your clinic starts with a 14-day Trial after approval. You may choose a preferred paid plan for later conversion. No payment is taken during registration.

The registration page must not create a paid provider subscription.

### 4.2 Registration selections

The recommended registration controls are:

#### Required or default selection

```text
Start with the 14-day Trial
No card required
```

This should be selected by default.

#### Optional paid preference

```text
Preferred plan after Trial:
  Starter
  Growth
  Pro

Preferred billing cycle:
  Monthly
  Annual
```

The preference should be optional. If the clinic does not select one, the Super Admin can choose later.

### 4.3 Monthly and annual presentation

The registration and pricing screens should show:

- Monthly price.
- Annual price.
- Monthly equivalent of annual pricing.
- Annual savings.
- Whether the annual price is billed upfront.
- A clear statement that selecting a plan does not take payment.

The current catalog values are:

| Plan | Monthly | Annual | Annual saving |
|---|---:|---:|---:|
| Starter | ₹999/month | ₹9,990/year | ₹1,998 |
| Growth | ₹1,599/month | ₹15,990/year | ₹3,198 |
| Pro | ₹2,999/month | ₹29,990/year | ₹5,998 |

All displayed values must continue to come from the shared plan catalog.

---

## 5. Registration preference data model

The selected plan during registration should not be stored as the clinic’s effective subscription state.

### 5.1 Recommended approach: separate preference table

Use an append-only or supersedable preference record:

```text
clinic_plan_preferences
-----------------------
id
clinicId
plan
billingCycle
policyVersion
source
selectedAt
supersededAt
```

Recommended `source` values:

```text
registration
admin
clinic_conversion
```

This allows the Admin to see:

```text
Requested at registration:
Growth · Annual

Policy version:
2026-09-11.v1

Selected:
14 Sep 2026
```

### 5.2 Why the preference should be separate

This prevents the following problems:

- A pending clinic appearing to have an active paid plan.
- A registration preference being mistaken for a payment commitment.
- A later preference change overwriting historical intent.
- A policy-price change making the original selection unclear.
- The effective entitlement resolver using an unapproved plan.

The existing `clinics.plan` field should remain the compatibility snapshot of current effective plan state, not the registration preference.

---

## 6. Super Admin assignment modes

The Admin should provide separate workflows rather than one generic “Assign Plan” operation.

### 6.1 Provider-billed paid plan

Use this when the clinic should pay through Razorpay:

```text
Assign paid plan
  ↓
Choose Starter, Growth, or Pro
  ↓
Choose Monthly or Annual
  ↓
Create provider subscription
  ↓
Send activation link
  ↓
pending_payment
  ↓
Provider confirms payment
  ↓
active
```

Rules:

- Do not grant paid access before provider confirmation.
- Do not mark the clinic active from the Admin interface alone.
- Do not fabricate provider events.
- Preserve the provider subscription ID.
- Store plan, cycle, policy version, transition ID, and reason.
- Record provider activation separately from the Admin assignment.
- Preserve provider-event history even after later plan changes.

This is the current paid-assignment direction and should be retained.

### 6.2 Complimentary access without payment

When the Super Admin wants to give a clinic access without taking payment, use:

```text
Complimentary access
```

or the existing term:

```text
Sponsored access
```

Example:

```text
Grant complimentary access
  Plan: Growth
  Billing-cycle reference: Annual
  Starts: 15 Sep 2026
  Ends: 15 Dec 2026
  Reason: Partner clinic onboarding
```

Rules:

- No payment is recorded.
- No Razorpay subscription is created.
- No provider event is fabricated.
- The selected plan becomes the effective temporary entitlement.
- The underlying paid subscription remains separate.
- Access has a fixed end date.
- Expiry returns the clinic to the underlying Trial, expired, or paid state.
- The waived list value is reported separately from captured revenue.

The existing sponsored-access tables and effective-entitlement resolver are suitable for this mode.

This is the recommended solution for:

> Assigning a plan offline without taking payment.

The system should not label this state as paid `active`.

### 6.3 Verified offline payment

Offline payment is a separate case from complimentary access.

If the business accepts bank transfer, cheque, cash, or another offline method, it should use a dedicated verified-payment workflow.

Required information should include:

```text
Payment method
Amount
Currency
Payment date
Coverage start date
Coverage end date
External reference number
Payment evidence
Notes
Verified by
Verified at
```

Recommended state:

```text
subscriptionStatus = manual_override
accessSource = manual_payment
```

The workflow must:

- Record an audited `manual_payment_recorded` lifecycle event.
- Store the payment in a platform subscription money ledger.
- Keep manual payment records separate from Razorpay provider events.
- Keep platform subscription money separate from clinic treatment billing.
- Never create a fake Razorpay event.
- Require authorized verification.
- Require evidence for financial reconciliation.
- Support a second-person approval rule for high-value or long-duration assignments.

The current blueprint already requires evidence and authorization for manual/offline payments.

---

## 7. Recommended subscription state model

The application should continue separating plan from subscription state.

### 7.1 Effective plan

```text
trial
starter
growth
pro
```

### 7.2 Subscription state

```text
trialing
pending_payment
active
past_due
expired
cancelled
manual_override
provider_error
unknown
```

### 7.3 Access source

The system should add or derive an explicit access source:

```text
provider
complimentary
manual_payment
temporary_exception
system_trial
unknown
```

Examples:

| Situation | Plan | State | Source |
|---|---|---|---|
| Initial Trial | Trial | `trialing` | `system_trial` |
| Razorpay paid access | Growth | `active` | `provider` |
| Complimentary access | Growth | sponsored/effective grant | `complimentary` |
| Verified offline payment | Growth | `manual_override` | `manual_payment` |
| Payment not completed | Growth | `pending_payment` | `provider` |

The effective entitlement service should remain the single reporting and future authorization decision point.

---

## 8. Upgrade policy

### 8.1 Do not upgrade purely by usage

Usage should generate a recommendation, not an unexpected commercial commitment.

Recommended behavior:

```text
Clinic approaches or exceeds Starter usage
        ↓
Show warning
        ↓
Recommend Growth
        ↓
Notify clinic or Super Admin
        ↓
Do not charge or change plan automatically
```

Automatic usage-based upgrades should only be enabled if the clinic explicitly opts into a documented rule.

### 8.2 Manual upgrade

The Admin upgrade dialog should include:

```text
Current plan
Target plan
Current billing cycle
Target billing cycle
Effective date
Access/payment mode
Reason
Confirmation
```

Supported modes:

```text
Provider billed
Complimentary
Verified offline payment
```

Provider-billed upgrades should wait for provider confirmation.

Complimentary upgrades should create a temporary sponsored grant.

Offline-paid upgrades should require verified payment evidence before access is changed.

### 8.3 Immediate versus next-renewal upgrade

An upgrade may be immediate when:

- The provider confirms the change.
- Proration or credit is understood.
- The Admin confirms the effective date.
- The resulting lifecycle event is recorded.

Otherwise, schedule the upgrade for the next renewal.

---

## 9. Downgrade policy

### 9.1 Default downgrade timing

Downgrades should normally take effect at the next renewal:

```text
Growth Annual → Starter Annual
        ↓
Current Growth access remains until paid period ends
        ↓
Pending downgrade is displayed
        ↓
Starter becomes effective at renewal
```

This avoids removing paid features before the paid period has ended.

### 9.2 Downgrade rules

When a downgrade is scheduled:

- Keep the current plan active until the effective date.
- Warn about limits in the target plan.
- Do not delete data.
- Do not delete doctors, bookings, deals, documents, or messages.
- Keep existing data readable.
- Restrict only new activity after enforcement is enabled.
- Make unsupported features read-only or unavailable after the effective date.
- Preserve the old plan and policy version in history.

### 9.3 Immediate downgrade

An immediate downgrade should require explicit confirmation:

> This will reduce access immediately. Existing data will not be deleted. New activity may be restricted once enforcement is enabled.

Immediate downgrades should be reserved for:

- Administrative correction.
- Fraud or abuse.
- Contractual termination.
- Explicit clinic request.
- Expiry of complimentary access.

---

## 10. Monthly and annual billing rules

Billing cycle is part of the subscription assignment:

```text
plan + billingCycle + source + effective dates
```

Examples:

```text
Starter · Monthly · Provider billed
Growth · Annual · Complimentary
Pro · Monthly · Manual payment
```

### 10.1 Monthly to annual

- Usually effective at the next renewal.
- Immediate changes require a defined credit or proration rule.
- Provider must confirm the new billing schedule.
- A clinic row must not be changed without provider reconciliation.

### 10.2 Annual to monthly

- Usually effective after the annual paid period ends.
- Do not issue an automatic refund without an approved finance rule.
- Store the scheduled change and show it to Admin.

### 10.3 Annual renewal

- Store `paidAccessExpiresAt`.
- Update the next paid expiry from provider confirmation.
- Preserve the annual cycle until an approved transition changes it.

### 10.4 Complimentary access

The billing cycle may be stored as a reporting reference:

```text
Complimentary Growth · Annual reference
```

It must not be reported as captured or settled revenue.

---

## 11. Scheduled subscription changes

Upgrades, downgrades, and billing-cycle changes need a first-class scheduled-change record.

Recommended structure:

```text
subscription_scheduled_changes
-------------------------------
id
clinicId
fromPlan
fromBillingCycle
toPlan
toBillingCycle
effectiveAt
mode
providerSubscriptionId
status
reason
createdBy
transitionId
appliedAt
cancelledAt
```

Recommended statuses:

```text
pending
provider_pending
scheduled
applied
cancelled
failed
superseded
```

The scheduled-change process should:

1. Validate the current clinic state.
2. Create an idempotent transition.
3. Store the requested future change.
4. Notify the clinic or Admin.
5. Wait for provider confirmation where required.
6. Apply the change at the effective time.
7. Write lifecycle history.
8. Mark the schedule as applied.
9. Reconcile provider and clinic state periodically.

Using a dedicated table is preferable to inferring future changes only from assignment dates.

---

## 12. Super Admin UI recommendation

### 12.1 Clinic list filters

Add filters for:

- Current plan.
- Billing cycle.
- Subscription state.
- Access source.
- Trial ending soon.
- Paid access expiring soon.
- Pending payment.
- Scheduled change.
- Complimentary access.
- Manual payment.
- Needs reconciliation.

### 12.2 Clinic detail header

Show:

```text
Effective access: Growth
Subscription state: Active
Access source: Razorpay
Billing cycle: Annual
Paid access expires: 14 Sep 2027
Requested at registration: Growth · Annual
Pending change: Growth → Pro at renewal
```

### 12.3 Main Admin actions

Use separate actions:

- Convert to paid plan.
- Schedule upgrade.
- Schedule downgrade.
- Change billing cycle.
- Grant complimentary access.
- Record verified offline payment.
- Extend Trial.
- View provider events.
- View complete subscription history.

Every action should require:

- Target plan.
- Billing cycle where applicable.
- Effective date.
- Access or payment mode.
- Reason.
- Confirmation.
- Optional evidence or reference.
- Idempotency key.

### 12.4 Approval screen

The approval dialog should display:

```text
Registration preference:
Growth · Annual

Approval result:
Starts 14-day Trial

Next recommended action:
Review preferred plan after Trial begins
```

Approval must not silently activate the requested paid plan.

---

## 13. Data and audit requirements

Every plan or access transition must preserve:

```text
Clinic
Previous plan
New plan
Previous billing cycle
New billing cycle
Previous state
New state
Access source
Policy version
Actor type
Actor identity
Reason
Effective time
Transition ID
Provider reference, when applicable
Payment reference, when applicable
```

The system must keep these records separate:

```text
Provider event history
Subscription lifecycle history
Plan assignment history
Complimentary access history
Manual payment ledger
Clinic treatment billing
```

No generic clinic-edit route should be allowed to mutate plan state.

---

## 14. Automatic lifecycle processing

Automatic behavior should be limited to explicit, auditable transitions.

### Appropriate automatic transitions

- Initial Trial start on clinic approval.
- Trial expiry after the approved grace boundary.
- Confirmed paid-expiry recovery Trial.
- Provider-confirmed activation.
- Provider-confirmed renewal.
- Applying an already-approved scheduled plan change.
- Expiring complimentary access.

### Inappropriate automatic transitions

- Upgrade solely because usage crossed a threshold.
- Downgrade solely because a clinic exceeded a new limit.
- Marking a clinic paid because a Super Admin selected a plan.
- Treating an unavailable provider webhook as a confirmed payment.
- Creating a free paid subscription without recording complimentary access.

All automatic processing must be idempotent at both levels:

```text
Provider event idempotency
Lifecycle transition idempotency
```

---

## 15. Recommended implementation phases

### Phase A — Registration preference cleanup

1. Add a separate registration plan-preference record.
2. Add a real monthly/annual selector.
3. Default the clinic to Trial.
4. Change the copy to “preferred plan after Trial”.
5. Show the preference in pending-clinic Admin review.
6. Stop using registration plan data as current subscription state.
7. Preserve policy version and selection timestamp.

### Phase B — Complimentary access

1. Keep paid provider assignment separate.
2. Use a clearly named complimentary or sponsored access flow.
3. Reuse fixed-term sponsored access where appropriate.
4. Add waived list-value reporting.
5. Prevent complimentary access from creating provider events.
6. Add explicit confirmation that no payment was taken.
7. Expire access automatically back to the underlying state.

### Phase C — Verified offline payment

1. Add a platform subscription money ledger.
2. Add payment evidence and external references.
3. Add authorized verification.
4. Use `manual_override` rather than provider `active`.
5. Add finance-only visibility.
6. Add reconciliation reporting.

### Phase D — Upgrade and downgrade scheduling

1. Add scheduled subscription changes.
2. Add provider-aware upgrade processing.
3. Schedule downgrades for renewal by default.
4. Add billing-cycle changes.
5. Add stale-state protection.
6. Add provider webhook reconciliation.
7. Add cancellation and superseding rules.

### Phase E — Automatic lifecycle processing

1. Continue the Trial expiry reconciliation job.
2. Add scheduled-change processing.
3. Process paid expiry only from confirmed provider events.
4. Keep repeated webhook and transition processing idempotent.
5. Add Trial and paid-expiry warning notices.
6. Keep enforcement disabled until the production baseline is complete.

---

## 16. Release gates

Before enabling production enforcement or automatic commercial changes:

- The production clinic baseline is complete.
- Every production clinic has a migration or exception decision.
- Registration preferences are distinct from effective plan state.
- Complimentary access is distinguishable from paid access.
- Manual payment evidence and authorization are implemented if offline payment is accepted.
- Upgrade and downgrade timing is tested.
- Monthly and annual provider mappings are verified.
- Provider events and lifecycle transitions are independently idempotent.
- Paid expiry and recovery Trial behavior is reconciled.
- Existing data remains readable after expiry and downgrade.
- Warnings are available before restrictions.
- Super Admin actions are role-protected and reason-required.
- Policy versions are preserved for historical explanation.
- Build Check, type checking, subscription tests, and provider-race tests pass.

---

## 17. Recommended final operating model

```text
Registration:
  Trial-first + optional preferred paid plan and billing cycle

Super Admin assignment without payment:
  Fixed-term complimentary/sponsored access

Super Admin provider-paid assignment:
  Razorpay subscription + provider confirmation

Super Admin offline-payment assignment:
  Separate verified manual-payment workflow

Upgrade:
  Immediate only with provider confirmation or explicit complimentary/manual mode

Downgrade:
  Scheduled for the next renewal by default

Automatic changes:
  Only scheduled or provider-confirmed transitions

Usage thresholds:
  Recommendations and warnings, not surprise automatic upgrades
```

This model matches the existing four-plan blueprint, preserves the current Trial lifecycle, gives Super Admin a safe no-payment assignment option, and avoids corrupting provider or financial state.