# Subscription Plan Optimisation

**Status:** Proposed blueprint — analysis and planning only  
**Date:** 2026-09-14  
**Related blueprint:** [16-four-plan-subscription-and-entitlement-blueprint.md](./16-four-plan-subscription-and-entitlement-blueprint.md)
**Source comparison:** Market-standard review supplied for this analysis

## 1. Executive decision

The registration page should show all four plans:

```text
Trial
Starter
Growth
Pro
```

A clinic may select Trial during registration. That selection creates an **initial Trial request**, not an unlimited right to receive another Trial.

The Super Admin approval step must explicitly choose the assignment mode:

```text
1. Trial approval
   No payment; starts the one-time initial Trial.

2. Paid plan through Razorpay
   Creates an online payment/subscription activation flow.
   Access becomes paid only after Razorpay confirmation.

3. Complimentary offline plan
   No payment is taken. Super Admin grants fixed-term access with
   a reason and audit history.

4. Verified offline payment
   Payment was received outside Razorpay. Access requires evidence
   and authorized verification; it must never fabricate a Razorpay event.
```

This gives the clinic the choice it expects while keeping the business in control of activation and preventing repeated self-selected Trials.

The recommended lifecycle is:

```text
Registration
  → Clinic selects Trial or a paid plan
  → Server checks Trial eligibility
  → Registration remains pending
  → Super Admin reviews the selected plan
  → Super Admin chooses assignment mode
  → Approval creates the selected auditable access state
  → Provider or manual reconciliation completes the lifecycle
```

No plan should be activated only because a clinic selected it in the public registration form.

---

## 2. What the current application does

### 2.1 Registration

The current registration screen:

- Shows Starter, Growth, and Pro.
- Does not show Trial as a selectable plan.
- Displays monthly and annual paid pricing.
- Sends the selected paid plan to registration.
- Does not provide a complete billing-cycle selection flow.

The current server approval flow then starts Trial for every approved clinic. This creates a mismatch:

```text
Public UI:
  Clinic selected a paid plan.

Approval result:
  Clinic receives Trial.
```

The application should make the intended behavior explicit instead of silently replacing the registration choice.

### 2.2 Approval

Current approval:

- Verifies that the clinic is pending.
- Creates credentials.
- Starts the catalog-defined 14-day Trial.
- Applies the seven-day Trial grace period.
- Does not create a Razorpay subscription.
- Does not take payment.

This is safe, but the approval dialog needs an explicit assignment decision.

### 2.3 Existing Super Admin operations

The current Admin area supports:

- Starting a Trial.
- Extending a Trial.
- Assigning a paid plan through a provider-aware pending-payment flow.
- Selecting monthly or annual billing for paid assignment.
- Sponsored access.
- Temporary entitlement exceptions.
- Revoking temporary access.
- Subscription history and entitlement reporting.

The old broad “Mark Paid” operation is disabled, which should remain the case.

### 2.4 Existing lifecycle foundation

The application already contains:

- Shared Trial, Starter, Growth, and Pro catalog data.
- Trial dates and grace dates.
- Subscription state normalization.
- Provider event history.
- Append-only lifecycle history.
- Plan assignment history.
- Sponsored access records.
- Temporary entitlement exceptions.
- Provider activation handling.
- Paid-expiry recovery Trial.
- Post-grace Trial expiry reconciliation.

The main missing pieces are:

- Trial as a registration-time choice.
- Server-side prevention of repeated acquisition Trials.
- Approval-time selection of assignment mode.
- Offline complimentary assignment for every plan.
- Verified offline-payment assignment, if required.
- Scheduled upgrade and downgrade records.
- Renewal reminder tracking and delivery.
- Clear Admin visibility of requested plan versus active access.

---

## 3. Terms and state separation

The system must keep these concepts separate:

```text
Requested plan
  What the clinic selected during registration.

Assignment decision
  What the Super Admin approved and by which mode.

Effective plan
  The plan whose entitlements apply now.

Subscription state
  Trialing, pending payment, active, expired, and so on.

Payment state
  Provider-confirmed, pending, complimentary, or manually verified.

Access source
  System Trial, Razorpay, complimentary, or manual payment.
```

These statements are not equivalent:

```text
The clinic requested Growth.
The clinic was approved for Growth.
The clinic has Growth access.
The clinic paid for Growth.
The clinic has complimentary Growth access.
```

The existing `clinics.plan` and `clinics.subscriptionStatus` fields remain compatibility snapshots. New workflows must write append-only history before changing snapshots.

---

## 4. Registration plan selection

### 4.1 All four plans must be visible

The registration UI should present Trial alongside the paid plans.

| Plan | Registration meaning | Payment at registration |
|---|---|---|
| Trial | Request the initial no-payment Trial | None |
| Starter | Request Starter for approval | None |
| Growth | Request Growth for approval | None |
| Pro | Request Pro for approval | None |

The selected plan is a request. It does not itself create access or payment.

### 4.2 Trial selection

Trial should be clearly presented as:

```text
14-day Trial
No card required
Available once for the clinic registration lifecycle
```

The UI should explain:

> Trial can be selected during registration once. Additional Trial access can only be granted by an authorized Super Admin and is recorded as a separate exception or recovery decision.

### 4.3 Paid plan selection

For Starter, Growth, and Pro, the clinic should select:

```text
Plan
Billing cycle:
  Monthly
  Annual
```

The billing cycle is a request until the Super Admin approves the assignment mode.

The UI must show:

- Monthly price.
- Annual price.
- Annual monthly equivalent.
- Annual savings.
- Whether annual billing is paid upfront.
- “No payment is taken during registration.”

The catalog remains the only source for prices and entitlements.

Current catalog values:

| Plan | Monthly | Annual | Annual saving |
|---|---:|---:|---:|
| Starter | ₹999/month | ₹9,990/year | ₹1,998 |
| Growth | ₹1,599/month | ₹15,990/year | ₹3,198 |
| Pro | ₹2,999/month | ₹29,990/year | ₹5,998 |

---

## 5. Preventing repeated Trial registration

The no-repeat rule must be enforced on the server. Hiding Trial in the UI is not sufficient.

### 5.1 Initial Trial eligibility

A clinic is eligible for the initial self-selected Trial only when all of the following are true:

- It has no previous initial Trial transition.
- It has no previous paid-expiry recovery Trial that makes it ineligible for a new acquisition Trial.
- It has no active or recently completed duplicate registration for the same clinic identity.
- The registration identity has not already consumed the acquisition Trial.

The server must check before accepting the registration:

```text
Verified email
Normalized phone
Normalized clinic name
GST number, when supplied
Medical license number or document identity, when available
Clinic registration certificate identity, when available
Existing clinic and archived-clinic records
Existing Trial lifecycle history
```

The exact identity-matching policy should be approved before production rollout. It should be strict enough to prevent repeated Trial abuse without rejecting legitimate multi-branch or ownership cases.

### 5.2 Registration-time duplicate behavior

If the clinic has already used the initial Trial, the server should reject a new Trial request with a clear message:

> This clinic has already used its registration Trial. Please choose a paid plan or contact Super Admin support.

The UI may still display Trial as part of the catalog, but it must show it as unavailable for that clinic once the server reports ineligibility.

### 5.3 Idempotent first Trial

Approval must use a deterministic transition identity:

```text
initial-trial:{clinicId}
```

Repeated approval requests must not:

- Restart the Trial.
- Extend the Trial.
- Create a second Trial assignment.
- Create a second lifecycle event.
- Reset Trial usage.

The server must also protect this transition with a database uniqueness rule or an equivalent transaction check.

### 5.4 Admin-granted Trial is different

The Super Admin may grant Trial access offline, but this is not a new acquisition Trial.

It must be recorded as:

```text
trialOrigin = admin_granted
```

or:

```text
trialOrigin = recovery
```

It must not reset the initial registration eligibility.

Recommended controls:

- Fixed duration from the published Trial policy.
- Mandatory reason.
- Start and end dates.
- Actor identity.
- Transition ID.
- Policy version.
- Optional second approval for repeated or long extensions.
- A configurable limit on repeated admin grants.

Recommended default policy:

```text
One initial registration Trial.
One controlled Admin-granted Trial or extension within a rolling period.
Recovery Trial only after confirmed paid expiry.
Any further exception requires elevated approval and a separate reason.
```

The final allowance for Admin-granted Trials should be a business-policy decision, but unlimited repeated Admin Trials must not be allowed.

---

## 6. Approval workflow

Approval should show the clinic’s registration selection and require the Super Admin to choose the outcome.

### 6.1 Approval dialog

The dialog should show:

```text
Clinic: Green Dental Clinic
Registration selection: Growth · Annual
Trial eligibility: Eligible / Already used / Requires review
```

Then require:

```text
Approval outcome:
  Use selected plan
  Choose another plan

Assignment mode:
  Trial
  Complimentary offline
  Razorpay online payment
  Verified offline payment

Reason:
  Required
```

The selected plan and assignment mode must be confirmed together.

### 6.2 Approval with Trial

Allowed when:

- The registration selected Trial, or
- The Super Admin explicitly overrides the requested paid plan to Trial, and
- The clinic is eligible for the initial Trial or the operation is an authorized Admin-granted Trial.

Result:

```text
plan = trial
subscriptionStatus = trialing
accessSource = system_trial or admin_granted
paymentState = no_payment_required
```

No Razorpay subscription is created.

### 6.3 Approval with paid plan through Razorpay

Allowed for Starter, Growth, or Pro.

Flow:

```text
Registration selection
  ↓
Super Admin confirms plan and billing cycle
  ↓
Razorpay subscription/activation flow is created
  ↓
Clinic is pending payment
  ↓
Clinic pays online
  ↓
Razorpay webhook confirms activation
  ↓
Clinic becomes active paid
```

Before confirmation:

```text
subscriptionStatus = pending_payment
accessSource = provider
```

After confirmation:

```text
subscriptionStatus = active
accessSource = provider
paidAccessExpiresAt = provider current period end
```

The Admin UI must never mark the clinic active just because the paid plan was selected.

### 6.4 Approval with complimentary offline access

Allowed for Trial, Starter, Growth, or Pro when the business is granting access without payment.

Flow:

```text
Super Admin selects plan
  ↓
Selects complimentary offline
  ↓
Provides dates and reason
  ↓
System records fixed-term access
  ↓
Clinic receives access without provider payment
```

Rules:

- No Razorpay subscription.
- No payment record.
- No fake provider event.
- Fixed start and end dates.
- Mandatory reason.
- Actor and policy version.
- Optional campaign or partner reference.
- Waived list value reported separately from revenue.
- Expiry returns to the underlying state.

This is the correct way to assign a plan offline without taking payment.

The application should not label complimentary access as provider-paid `active`.

### 6.5 Approval with verified offline payment

This mode is only for cases where payment was actually received outside Razorpay.

Required:

```text
Payment method
Amount
Currency
Payment date
Coverage period
Reference number
Evidence attachment or reference
Verified by
Verification timestamp
Reason
```

Recommended state:

```text
subscriptionStatus = manual_override
accessSource = manual_payment
```

The system must:

- Record `manual_payment_recorded`.
- Store the payment in a separate platform subscription money ledger.
- Keep manual payments separate from Razorpay events.
- Keep platform subscription money separate from clinic treatment billing.
- Never fabricate a Razorpay confirmation.
- Require authorized verification.
- Support two-person approval for high-value or long-duration assignments.

---

## 7. Assignment modes by plan

All four plans can be assigned through the following controlled modes:

| Plan | Trial mode | Complimentary offline | Razorpay online | Verified offline payment |
|---|---:|---:|---:|---:|
| Trial | Yes | Yes, as Admin grant | No | No |
| Starter | No acquisition Trial | Yes | Yes | Yes |
| Growth | No acquisition Trial | Yes | Yes | Yes |
| Pro | No acquisition Trial | Yes | Yes | Yes |

Trial is not a Razorpay plan.

The distinction is:

```text
Trial:
  No payment required and governed by Trial eligibility.

Complimentary paid-plan access:
  No payment taken; fixed-term Admin grant.

Offline-paid plan:
  Payment received and verified; manual-payment state.

Razorpay-paid plan:
  Provider confirms payment; provider-active state.
```

---

## 8. Data model recommendation

### 8.1 Registration plan requests

Do not use the current effective plan columns to store registration intent.

Recommended table:

```text
clinic_plan_requests
--------------------
id
clinicId
requestedPlan
requestedBillingCycle
policyVersion
eligibilityStatus
source
selectedAt
reviewedAt
reviewedBy
supersededAt
```

For Trial:

```text
requestedPlan = trial
requestedBillingCycle = null
```

For paid plans:

```text
requestedPlan = starter | growth | pro
requestedBillingCycle = monthly | annual
```

### 8.2 Assignment decisions

Every approval or Admin assignment should preserve:

```text
clinicId
plan
billingCycle
assignmentMode
source
policyVersion
startsAt
endsAt
reason
actorType
actorId
transitionId
providerSubscriptionId
paymentReference
```

Recommended assignment modes:

```text
system_trial
admin_trial
provider_online
complimentary_offline
manual_payment_offline
recovery_trial
```

### 8.3 Scheduled changes

Recommended table:

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
changeType
assignmentMode
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

### 8.4 Renewal reminder records

Add a delivery record so reminders are not sent repeatedly:

```text
subscription_reminder_deliveries
--------------------------------
id
clinicId
reminderType
scheduledFor
sentAt
channel
deliveryStatus
templateVersion
transitionId
providerMessageId
errorCode
```

Recommended reminder types:

```text
trial_ending
trial_grace_ending
paid_expiring_30_days
paid_expiring_7_days
paid_expired
complimentary_expiring
manual_payment_expiring
scheduled_change_pending
```

---

## 9. Upgrade and downgrade policy

### 9.1 No surprise usage-based upgrade

Usage should create a warning and recommendation, not a paid plan change.

```text
Clinic approaches limit
  → Show warning
  → Recommend upgrade
  → Notify clinic and/or Admin
  → Do not charge or upgrade automatically
```

Automatic upgrades are allowed only when the clinic has explicitly opted into a documented rule.

### 9.2 Upgrade

Admin upgrade controls should include:

```text
Current plan
Target plan
Current cycle
Target cycle
Effective date
Assignment mode
Reason
Confirmation
```

Recommended behavior:

- Provider-paid upgrade: apply only after provider confirmation.
- Complimentary upgrade: create fixed-term complimentary access.
- Verified offline upgrade: require payment verification.
- Immediate upgrade: allowed when provider confirmation, proration, or complimentary terms are clear.
- Otherwise: schedule at the next renewal.

### 9.3 Downgrade

Downgrades should default to the next renewal:

```text
Growth Annual → Starter Annual
  Current Growth access continues until paid period ends
  Pending downgrade is visible
  Starter becomes effective at renewal
```

Rules:

- Do not remove paid access early by default.
- Do not delete existing data.
- Do not delete doctors, bookings, deals, documents, or messages.
- Keep existing data readable.
- Warn about target-plan limits.
- Restrict only new activity after enforcement is enabled.
- Preserve old and new policy versions.

Immediate downgrade requires explicit confirmation and should be limited to:

- Fraud or abuse.
- Contractual termination.
- Explicit clinic request.
- Administrative correction.
- Complimentary access expiry.

---

## 10. Automatic lifecycle rules

### 10.1 Allowed automatic transitions

```text
Eligible initial Trial on approval
Trial expiry after grace
Confirmed paid-expiry recovery Trial
Razorpay-confirmed activation
Razorpay-confirmed renewal
Approved scheduled change at effective time
Complimentary access expiry
Manual-payment coverage expiry
```

### 10.2 Disallowed automatic transitions

```text
Upgrade solely because usage crossed a limit
Downgrade solely because usage exceeded a limit
Paid activation from Admin selection alone
Paid activation from an unmatched webhook
Paid activation from an unavailable provider
Repeated acquisition Trial after Trial history exists
Free paid access without a complimentary assignment record
```

All automatic processing must be idempotent at both levels:

```text
Provider event idempotency
Lifecycle transition idempotency
Reminder delivery idempotency
Scheduled-change application idempotency
```

---

## 11. Trial lifecycle and anti-abuse rules

### 11.1 Initial Trial

The initial Trial is:

```text
14 calendar days
7 calendar days of read-only grace
No payment details
One acquisition transition per clinic lifecycle
```

The first Trial must be created only once.

### 11.2 Recovery Trial

Recovery Trial is allowed only after:

- A paid subscription existed.
- Razorpay confirmed expiry or completion.
- Provider event processing succeeded.
- The recovery transition has not already been applied.

Recovery Trial must preserve:

```text
previousPaidPlan
provider subscription history
paid expiry timestamp
recovery transition ID
```

Recovery Trial is not a new acquisition Trial.

### 11.3 Admin Trial

Admin Trial is a controlled exception:

- Super Admin only.
- Mandatory reason.
- Fixed duration.
- No Razorpay subscription.
- No reset of acquisition eligibility.
- Separate `admin_granted` origin.
- Separate lifecycle event.
- Configurable repetition limit.

An Admin cannot repeatedly use Trial grants as an unbounded replacement for paid access.

---

## 12. Renewal reminders

The market-standard comparison correctly identifies renewal reminders as an explicit missing workflow.

### 12.1 Reminder schedule

For paid, complimentary, and verified manual-payment access:

```text
30 days before expiry:
  Standard renewal reminder.

7 days before expiry:
  Urgent renewal reminder.

On expiry:
  State-change notice and next-step instructions.
```

For Trial:

```text
7 days before Trial end:
  Trial reminder.

1 day before Trial grace end:
  Final grace reminder.

On grace expiry:
  Expiry or recovery-state notice.
```

The exact Trial reminder schedule should be stored in the published policy or notification policy, not hardcoded in multiple routes.

### 12.2 Reminder copy

Example:

> Your Growth Annual plan expires on 14 September 2027. Renew or contact Super Admin to avoid disruption.

Reminder content must state:

- Clinic name.
- Plan.
- Billing cycle.
- Expiry date and timezone.
- Whether access is provider-paid, complimentary, or manual-payment.
- Renewal or support next step.

### 12.3 Reminder channels

Use configured email and SMS channels according to deployment policy.

Rules:

- Essential security and clinical messages remain protected.
- Reminder sends are recorded.
- Repeated scheduler runs do not resend the same reminder.
- Failed sends remain visible for reconciliation.
- Notification templates are versioned.

### 12.4 Admin reminder visibility

Admin lists should show:

```text
Next expiry
Reminder stage
Last reminder sent
Last reminder status
Delivery channel
```

---

## 13. Super Admin UI

### 13.1 Clinic list filters

Add:

- Requested plan.
- Effective plan.
- Billing cycle.
- Subscription state.
- Assignment mode.
- Access source.
- Trial ending soon.
- Paid expiring soon.
- Complimentary expiring soon.
- Manual-payment expiring soon.
- Pending payment.
- Scheduled change.
- Reminder failed.
- Needs reconciliation.

### 13.2 Clinic detail header

Show the distinction clearly:

```text
Registration request: Growth · Annual
Effective access: Growth
Subscription state: Active
Assignment mode: Razorpay online
Access source: Provider
Paid access expires: 14 Sep 2027
Pending change: Growth → Pro at renewal
Next reminder: 7-day reminder pending
```

### 13.3 Approval actions

Use:

```text
Approve with selected plan
Approve with another plan
Approve as Trial
Approve with complimentary offline access
Approve with Razorpay online payment
Approve with verified offline payment
Reject registration
```

Each action must require confirmation and a reason where it changes the requested outcome.

### 13.4 Subscription actions after approval

Use separate actions:

- Convert to paid plan.
- Grant complimentary access.
- Record verified offline payment.
- Schedule upgrade.
- Schedule downgrade.
- Change billing cycle.
- Extend controlled Admin Trial.
- View provider events.
- View reminder history.
- View complete lifecycle history.

---

## 14. Audit and financial boundaries

Every transition must preserve:

```text
Clinic
Requested plan
Previous effective plan
New effective plan
Previous billing cycle
New billing cycle
Previous state
New state
Assignment mode
Access source
Policy version
Actor type
Actor identity
Reason
Effective time
Transition ID
Provider reference
Payment reference
Evidence reference
```

Keep these records separate:

```text
Provider event history
Subscription lifecycle history
Plan assignment history
Registration requests
Complimentary access
Manual payment ledger
Reminder deliveries
Clinic treatment billing
```

Financial reporting must distinguish:

```text
Captured provider payment
Manual/offline verified payment
Refund
Chargeback
Failed payment
Complimentary waived value
Unpaid pending assignment
```

Complimentary list value is not revenue.

No generic clinic-edit endpoint should be able to mutate plan or subscription state.

---

## 15. Implementation order

### Phase 1 — Registration and eligibility

1. Add Trial to the registration plan cards.
2. Add paid billing-cycle selection.
3. Make Trial selection explicit and no-card.
4. Add server-side Trial eligibility checks.
5. Prevent duplicate clinic registration from consuming another Trial.
6. Store registration plan requests separately from effective plan state.
7. Show the requested plan in pending-clinic Admin review.

### Phase 2 — Approval assignment modes

1. Add approval-time plan confirmation.
2. Add Trial approval mode.
3. Add complimentary offline assignment.
4. Keep Razorpay online assignment pending until provider confirmation.
5. Add verified offline payment assignment only after the manual-payment ledger and evidence flow are approved.
6. Preserve a lifecycle and assignment event for every outcome.

### Phase 3 — Admin Trial controls

1. Keep initial Trial one-time and idempotent.
2. Distinguish initial, recovery, and Admin-granted Trial origins.
3. Add configurable Admin-grant repetition limits.
4. Require reasons and fixed dates.
5. Prevent Admin Trial from resetting acquisition eligibility.

### Phase 4 — Upgrade, downgrade, and billing cycle

1. Add scheduled subscription changes.
2. Add provider-aware upgrade processing.
3. Schedule downgrades for renewal by default.
4. Add billing-cycle changes.
5. Add stale-state protection.
6. Add cancellation and superseding rules.
7. Preserve old and new assignments and policy versions.

### Phase 5 — Renewal reminders

1. Add reminder delivery records.
2. Add 30-day paid-expiry reminders.
3. Add seven-day urgent reminders.
4. Add Trial and grace reminders.
5. Add complimentary and manual-payment expiry reminders.
6. Add expiry notices.
7. Add Admin reminder status and failed-delivery filters.
8. Make scheduler execution idempotent.

### Phase 6 — Reporting and enforcement gates

1. Complete the production clinic baseline.
2. Reconcile provider and manual-payment records.
3. Validate reminder delivery.
4. Run reporting-only periods.
5. Add warnings before restrictions.
6. Keep enforcement disabled until release gates pass.

---

## 16. Release gates

Before production enforcement or automatic commercial changes:

- Trial is selectable during registration.
- Initial Trial eligibility is checked server-side.
- A clinic cannot repeatedly self-select the acquisition Trial.
- Approval explicitly records the selected plan and assignment mode.
- Offline complimentary assignment is distinct from paid access.
- Razorpay-paid assignment activates only after provider confirmation.
- Manual offline payment requires evidence and authorization.
- No workflow fabricates provider events.
- Initial, recovery, and Admin-granted Trial origins are distinct.
- Upgrades and downgrades are idempotent.
- Downgrades default to the correct renewal date.
- Monthly and annual provider mappings are verified.
- Renewal reminders are scheduled and deduplicated.
- Reminder status is visible to Super Admin.
- Expiry transitions preserve data and history.
- Policy versions explain historical decisions.
- All Admin mutations are role-protected and reason-required.
- Build Check, type checking, lifecycle tests, provider-race tests, eligibility tests, and reminder tests pass.

---

## 17. Final recommended operating model

```text
At registration:
  Clinic chooses Trial, Starter, Growth, or Pro.
  Paid plans also require Monthly or Annual.
  No payment is taken.

Before registration acceptance:
  Server checks whether the clinic is eligible for the initial Trial.
  A previous Trial cannot be consumed again by a new registration.

At approval:
  Super Admin confirms the selected plan or chooses another plan.
  Super Admin selects Trial, Razorpay online, complimentary offline,
  or verified offline payment.

Trial:
  One initial acquisition Trial.
  Recovery Trial only after confirmed paid expiry.
  Admin Trial only as a controlled, audited exception.

Paid plan through Razorpay:
  Pending payment until provider confirmation.
  Active paid access only after confirmation.

Paid plan without payment:
  Fixed-term complimentary access.
  Never label it as captured paid revenue.

Paid plan through offline payment:
  Manual override with evidence, verification, and financial ledger.
  Never fabricate a Razorpay event.

Upgrade:
  Immediate after provider confirmation, or scheduled.
  No usage-based surprise upgrade.

Downgrade:
  Next renewal by default.
  Immediate only for explicit approved exceptions.

Renewal:
  30-day and 7-day reminders.
  Expiry notice.
  Confirmed paid expiry enters recovery Trial.

Audit:
  Requested plan, effective plan, payment state, access source,
  assignment mode, provider history, manual payment history,
  reminder history, and lifecycle events remain separate and explainable.
```

This model aligns with the supplied market-standard comparison while preserving the stronger controls already designed for this application. It gives clinics a clean Trial choice, prevents repeated self-selected Trials, gives Super Admin full offline control, supports Razorpay confirmation, and keeps payment, access, and audit history separate.