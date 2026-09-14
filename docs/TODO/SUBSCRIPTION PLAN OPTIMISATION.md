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

---

## 18. Clinic Admin self-service plan changes

The clinic must also be able to initiate a plan change from:

```text
Clinic Admin
  → Settings
  → Plan & access
  → Manage plan
```

This is a request and payment-management surface, not a direct entitlement-editing surface.

The Clinic Admin may:

- View the current effective plan.
- View the current billing cycle.
- View the payment/access source.
- Compare Starter, Growth, and Pro.
- Request an upgrade.
- Request a downgrade.
- Request a monthly or annual billing-cycle change.
- Start a Razorpay-managed online change when eligible.
- Submit a request for Super Admin handling.
- View pending, scheduled, applied, failed, rejected, and cancelled requests.
- Cancel a pending or scheduled request when cancellation is still allowed.

The Clinic Admin must not be able to:

- Directly edit `clinics.plan`.
- Directly edit `clinics.subscriptionStatus`.
- Change the Razorpay subscription ID.
- Select a provider plan ID supplied by the browser.
- Mark a payment as captured.
- Grant complimentary access to itself.
- Record manual/offline payment verification.
- Bypass a pending provider confirmation.
- Start a second conflicting change while one is unresolved.

The platform Super Admin or delegated billing operator remains responsible for offline approval, manual-payment verification, complimentary access, provider exceptions, and final reconciliation.

### 18.1 Current UI baseline

The existing `ClinicEntitlementSettingsPanel` is a read-only plan and usage panel. It already displays:

- Current effective plan.
- Effective access state.
- Trial dates.
- Paid expiry.
- Access source information.
- Usage measurements.
- Plan comparison.

The self-service work should extend this panel instead of creating a second unrelated billing page.

The current read-only endpoint:

```text
GET /api/auth/clinic/settings/entitlements
```

should remain useful for entitlement reporting. A separate subscription-management response should provide actions and workflow state:

```text
GET /api/auth/clinic/settings/subscription
```

The response should include:

```text
current:
  plan
  billingCycle
  subscriptionStatus
  accessSource
  providerSubscriptionIdPresent
  paidAccessExpiresAt
  renewalAt
  policyVersion

pendingChange:
  requestId
  requestType
  fromPlan
  toPlan
  fromBillingCycle
  toBillingCycle
  status
  effectiveTiming
  effectiveAt
  requestedMode
  createdAt
  cancellable

actions:
  canRequestUpgrade
  canRequestDowngrade
  canChangeBillingCycle
  canUseRazorpay
  canRequestSuperAdmin
  canCancelPendingChange

catalog:
  availablePlans
  availableBillingCycles
  prices
  policyVersion
```

The server must calculate all values. The browser may display a price preview, but the server remains the source of truth at submission time.

### 18.2 Clinic Settings interaction

The panel should show the current subscription in a clear summary:

```text
Current plan: Growth
Billing cycle: Annual
Status: Active paid
Access source: Razorpay
Renewal date: 14 September 2027

[Compare plans] [Manage plan]
```

Selecting **Manage plan** opens a plan-change dialog with:

1. Target plan.
2. Target billing cycle.
3. Effective timing.
4. Payment/approval route.
5. Price and entitlement impact.
6. Confirmation.

Target plan cards should show:

- Plan name.
- Monthly price.
- Annual price.
- Annual savings.
- Included limits.
- Relevant differences from the current plan.
- Upgrade or downgrade label.

The dialog must show the effective date before the final confirmation.

Example upgrade confirmation:

```text
Growth Annual → Pro Annual

Preferred effective timing:
  Immediately, if Razorpay confirms the change
  At the next renewal

Payment route:
  Change automatically with Razorpay
  Request Super Admin assistance

Your current Growth access will remain active until the change is confirmed.
```

Example downgrade confirmation:

```text
Pro Annual → Growth Annual

Default effective date:
  Next renewal: 14 September 2027

Your current Pro access continues until that date.
Existing clinic data will not be deleted.
New activity may be limited by Growth rules after the downgrade becomes effective.
```

### 18.3 Trial restrictions in Clinic Settings

Trial must not appear as a normal downgrade option.

The panel may display Trial information, but a clinic cannot use self-service settings to:

- Restart an expired initial Trial.
- Convert a paid subscription into a new acquisition Trial.
- Extend Trial indefinitely.
- Replace a paid downgrade with Trial.

The only allowed Trial-related self-service action is:

```text
Trial or recovery Trial clinic → request or start a paid-plan conversion
```

Admin-granted Trial, recovery Trial, and Trial extensions remain Super Admin actions.

---

## 19. Two self-service change routes

Every Clinic Admin plan change must use one of two explicit routes.

### Route A — Razorpay-managed online change

Use this route when the current subscription is provider-managed and the requested operation is supported.

```text
Clinic selects a target plan
  ↓
Server validates the current subscription
  ↓
Server calculates the current price and target price
  ↓
Clinic confirms the effective timing and payment impact
  ↓
System creates an internal change request
  ↓
System calls the Razorpay provider adapter
  ↓
Provider operation is recorded
  ↓
Razorpay confirms or schedules the change
  ↓
Razorpay webhook is received
  ↓
Internal effective access is changed transactionally
  ↓
Clinic and Super Admin receive the result
```

Before provider confirmation:

```text
Current effective plan remains unchanged.
Current entitlements remain unchanged.
Target plan is stored as pending or scheduled.
```

The system must never treat a successful browser response from a provider preparation call as proof that access changed.

### Route B — Super Admin request

Use this route when the clinic wants offline handling or when the provider path is not eligible.

```text
Clinic selects a target plan
  ↓
Clinic chooses Request Super Admin
  ↓
Clinic provides a reason or optional context
  ↓
Server stores the request
  ↓
Authorized Super Admins receive a notification
  ↓
Request appears in the Admin subscription queue
  ↓
Super Admin approves, rejects, or requests information
  ↓
Approved change is applied or scheduled
  ↓
Clinic receives the result
```

This route is required for:

- Complimentary access.
- Verified offline payment.
- Sponsored access.
- Manual price negotiations.
- Provider failures.
- Unsupported provider operations.
- Clinics without a valid Razorpay subscription.
- Custom effective dates.
- Immediate changes requiring human approval.
- Trial exceptions.

The clinic should not have to contact support by email for a normal plan request. The request should be visible, trackable, and auditable in the application.

---

## 20. Razorpay automation policy

### 20.1 Provider eligibility

The server may expose the Razorpay option only when:

- The clinic has a valid provider subscription.
- The current provider subscription is mapped to the clinic.
- The provider subscription state is eligible for change.
- The target plan and billing cycle have a configured provider mapping.
- There is no unresolved provider operation.
- There is no unresolved change request.
- The requested transition is supported by the provider integration.
- The local subscription data does not require reconciliation.

If any condition fails, the UI should show:

> Online plan change is not available for this subscription. You can request the change from Super Admin.

The server must enforce the same rule even if the browser manually submits `requestedMode: "razorpay"`.

### 20.2 Provider adapter

Razorpay-specific behavior should be isolated behind a provider adapter with operations equivalent to:

```text
validateSubscriptionForChange()
createPaidConversionSubscription()
changePlanImmediately()
schedulePlanChangeAtCycleEnd()
cancelScheduledPlanChange()
getSubscriptionStatus()
```

The route handler should not contain provider-specific plan-change logic.

The adapter must verify the exact capability supported by the configured Razorpay account and subscription. The application must not assume that every Razorpay subscription supports immediate plan replacement, proration, or cycle changes.

If the provider cannot safely perform the requested operation:

```text
Do not change local access.
Mark the provider operation as unsupported or failed.
Offer Super Admin request handling.
Notify the clinic with a clear next step.
```

### 20.3 Upgrade timing

An upgrade may be:

```text
Immediate
Next renewal
```

Immediate upgrade is allowed only when:

- The provider supports the change.
- The amount due is known.
- Proration or the first charge is understood.
- The Clinic Admin confirms the displayed amount.
- Provider confirmation is received.

Next-renewal upgrade is the safer default when:

- Proration is uncertain.
- The current annual period should remain intact.
- The provider only supports cycle-end changes.
- The business does not want an immediate additional charge.

The UI must not promise an immediate upgrade when the provider operation is only scheduled.

### 20.4 Downgrade timing

Downgrades default to the next renewal.

```text
Current access: Pro
Requested target: Growth
Current access remains Pro until renewal
Growth becomes effective after renewal confirmation
```

Immediate downgrade requires:

- Explicit Clinic Admin confirmation.
- Clear financial and entitlement impact.
- Provider confirmation or Super Admin approval.
- Data-preservation validation.

An immediate downgrade must not delete or silently hide:

- Doctors.
- Bookings.
- Patients.
- Documents.
- Messages.
- Clinical records.
- Billing records.

New activity may be restricted only after the effective downgrade and only after enforcement gates are enabled.

### 20.5 Billing-cycle changes

Treat monthly and annual changes as subscription changes.

Recommended defaults:

```text
Monthly → Annual:
  Next renewal unless an immediate charge and credit are explicit.

Annual → Monthly:
  End of current annual period.
```

The application must show:

- Current period end.
- New cycle.
- New recurring amount.
- Any immediate amount.
- Any credit or adjustment.
- The exact date when the new cycle begins.

No cycle change should be inferred from a plan change without an explicit user selection.

---

## 21. Upgrade and downgrade state transitions

### 21.1 Provider-paid upgrade

Before the request:

```text
plan = starter
subscriptionStatus = active
pendingChange = null
```

After Clinic Admin submission:

```text
plan = starter
subscriptionStatus = active
pendingChange = starter → growth
requestStatus = provider_pending
```

After Razorpay confirmation:

```text
plan = growth
subscriptionStatus = active
pendingChange = null
requestStatus = applied
```

The lifecycle history should contain separate records for:

```text
upgrade_requested
provider_change_confirmed
upgrade_applied
```

### 21.2 Scheduled provider downgrade

After the clinic submits:

```text
plan = pro
subscriptionStatus = active
pendingChange = pro → growth
effectiveAt = current renewal date
requestStatus = scheduled
```

At renewal confirmation:

```text
plan = growth
subscriptionStatus = active
pendingChange = null
requestStatus = applied
```

If the provider fails to apply the scheduled change:

```text
plan remains pro
requestStatus = failed
provider reconciliation required
clinic is notified
Super Admin is notified
```

### 21.3 Paid conversion from Trial

The clinic may choose a paid plan while Trial is active.

Recommended transition:

```text
Trial access remains effective
Paid conversion request becomes provider_pending
Razorpay subscription is prepared
Clinic completes payment
Razorpay webhook confirms activation
Paid plan becomes effective
Trial dates are cleared
```

If the payment link expires or payment fails:

```text
Paid conversion request becomes failed or expired.
The current Trial or grace state remains authoritative.
No paid access is activated.
```

This prevents an abandoned upgrade from removing valid Trial access.

### 21.4 Complimentary or manual-payment change

A Super Admin-approved offline change must be represented separately:

```text
assignmentMode = complimentary_offline
```

or:

```text
assignmentMode = manual_payment_offline
```

It must not be reported as a Razorpay-paid subscription.

---

## 22. Super Admin request queue and notifications

### 22.1 Request queue

Add a Super Admin subscription-change queue with filters for:

- Awaiting review.
- Provider pending.
- Scheduled.
- Failed.
- Upgrade.
- Downgrade.
- Billing-cycle change.
- Complimentary.
- Manual payment.
- Immediate action.
- Next-renewal action.
- Trial conversion.
- Reconciliation required.

Each queue row should show:

```text
Clinic
Current plan
Target plan
Current cycle
Target cycle
Requested by
Requested at
Requested timing
Requested mode
Current payment source
Request status
```

### 22.2 Request detail

The detail view should show:

- Clinic identity.
- Requesting Clinic Admin.
- Current effective entitlement.
- Current provider state.
- Current billing cycle.
- Target plan and cycle.
- Price comparison.
- Effective-date proposal.
- Reason.
- Usage impact.
- Previous requests.
- Provider operations.
- Lifecycle history.
- Existing pending changes.

Super Admin actions:

```text
Approve with Razorpay
Approve as complimentary offline
Approve after verified offline payment
Schedule at renewal
Approve immediate change
Reject
Request more information
Cancel provider operation
Mark for reconciliation
```

The action must require a reason whenever it differs from the clinic’s requested route or timing.

### 22.3 Notifications

The existing notification table is currently centered on `userId`, `type`, message, and booking references. Subscription requests should use generic resource targeting rather than pretending to be booking notifications.

Recommended notification fields:

```text
resourceType
resourceId
actionUrl
```

Recommended notification types:

```text
subscription_change_requested
subscription_change_provider_pending
subscription_change_scheduled
subscription_change_approved
subscription_change_rejected
subscription_change_more_information
subscription_change_applied
subscription_change_failed
subscription_change_cancelled
subscription_reconciliation_required
```

Super Admin notification example:

> Green Dental Clinic requested a change from Growth Annual to Pro Annual at the next renewal.

Clinic notification example:

> Your request to change from Growth Annual to Pro Annual was approved and scheduled for your next renewal.

Every notification send must be deduplicated by request ID and notification type.

---

## 23. Data model for Clinic Admin changes

### 23.1 Subscription change requests

Create a dedicated table for intent and workflow state:

```text
subscription_change_requests
----------------------------
id
clinicId
requestedByUserId
requestType
currentPlan
currentBillingCycle
targetPlan
targetBillingCycle
requestedMode
effectiveTiming
requestedEffectiveAt
status
reason
currentSubscriptionSnapshot
policyVersion
providerSubscriptionId
providerOperationId
transitionId
reviewedBy
reviewedAt
resolutionReason
resolvedAt
createdAt
updatedAt
```

Recommended values:

```text
requestType:
  upgrade
  downgrade
  plan_change
  billing_cycle_change
  trial_conversion

requestedMode:
  razorpay
  superadmin_offline

effectiveTiming:
  immediate
  next_renewal
  custom

status:
  submitted
  validating
  awaiting_admin
  provider_pending
  scheduled
  awaiting_payment
  approved
  rejected
  cancelled
  applied
  failed
  expired
  superseded
```

The request record must snapshot the current plan and billing cycle at submission time. This prevents an old request from silently applying against a different current subscription.

### 23.2 Provider operations

Inbound provider events are already stored in `subscription_provider_events`. Outbound change attempts should be recorded separately:

```text
subscription_provider_operations
---------------------------------
id
clinicId
requestId
provider
operationType
providerSubscriptionId
providerPlanId
providerOperationReference
idempotencyKey
status
requestSummary
responseSummary
failureCode
failureMessage
requestedAt
completedAt
```

This distinguishes:

```text
Clinic requested a change.
Application asked Razorpay to change it.
Razorpay accepted or scheduled it.
Razorpay later confirmed it by webhook.
```

### 23.3 Scheduled changes

For renewal-based operations:

```text
subscription_scheduled_changes
-------------------------------
id
clinicId
requestId
fromPlan
fromBillingCycle
toPlan
toBillingCycle
effectiveAt
providerScheduleReference
status
createdBy
appliedAt
cancelledAt
```

The scheduled record should be cancelled or superseded when:

- The clinic cancels the request.
- A newer request replaces it.
- The subscription is cancelled.
- Provider state changes independently.
- The Super Admin rejects the operation.

---

## 24. API blueprint

### 24.1 Clinic endpoints

```text
GET /api/auth/clinic/settings/subscription
```

Returns the current subscription, allowed actions, catalog options, and any pending request.

```text
POST /api/auth/clinic/subscription-change-requests
```

Creates a request:

```json
{
  "targetPlan": "growth",
  "targetBillingCycle": "annual",
  "requestedMode": "razorpay",
  "effectiveTiming": "next_renewal",
  "reason": "Need additional capacity for the new doctors"
}
```

The server must derive:

- Price.
- Currency.
- Provider plan ID.
- Current effective plan.
- Current billing cycle.
- Current provider subscription.
- Effective date.
- Policy version.
- Transition ID.

The server must reject a request when:

- The target plan is invalid.
- The target plan is the same without a cycle change.
- Another unresolved request exists.
- The clinic is not authorized.
- Provider state is inconsistent.
- A downgrade would create an unsupported immediate entitlement state.

```text
GET /api/auth/clinic/subscription-change-requests
```

Returns the clinic’s request history.

```text
POST /api/auth/clinic/subscription-change-requests/:id/cancel
```

Cancels a request if it has not yet been applied and the provider operation can still be cancelled.

### 24.2 Super Admin endpoints

```text
GET /api/admin/subscription-change-requests
GET /api/admin/subscription-change-requests/:id
POST /api/admin/subscription-change-requests/:id/approve
POST /api/admin/subscription-change-requests/:id/reject
POST /api/admin/subscription-change-requests/:id/request-information
POST /api/admin/subscription-change-requests/:id/cancel
```

Approval should accept:

```text
assignmentMode:
  provider_online
  complimentary_offline
  manual_payment_offline

effectiveTiming:
  immediate
  next_renewal

reason
paymentReference
evidenceReference
startsAt
endsAt
```

Payment references and evidence are required only for verified offline payment, but the exact requirements must be enforced server-side.

---

## 25. Idempotency and race protection

The change workflow must be safe when:

- The Clinic Admin double-clicks Submit.
- The browser retries after a timeout.
- Two Clinic Admin tabs submit at the same time.
- Razorpay sends the same webhook more than once.
- A webhook arrives while the Admin is reviewing the request.
- A scheduled change job runs twice.
- A Super Admin clicks Approve twice.
- A newer request supersedes an older request.

Use:

```text
Client request ID
Clinic-scoped request uniqueness
Clinic-scoped transition ID
Provider operation idempotency key
Provider event ID uniqueness
Conditional status updates
Transactional lifecycle writes
```

A repeated submission must return the existing request rather than create another request.

A repeated provider event must not:

- Apply the plan twice.
- Create duplicate lifecycle events.
- Send duplicate notifications.
- Change the expiry date incorrectly.

The provider operation must be created outside the database transaction that applies effective entitlements. The correct order is:

```text
Create internal request
  → Call provider
  → Store provider operation result
  → Wait for webhook
  → Apply effective state in a transaction
```

If the provider call fails, the clinic’s current access remains unchanged.

---

## 26. Data preservation and entitlement behavior

The effective entitlement resolver must understand a pending change separately from the current plan.

While an upgrade or downgrade is pending:

```text
effectivePlan = currentPlan
pendingPlan = targetPlan
```

The target plan must not affect current entitlements before its effective time.

At application time:

1. Confirm the request is still valid.
2. Confirm the current plan matches the request snapshot.
3. Confirm provider or Super Admin approval.
4. Write lifecycle history.
5. Write plan assignment history.
6. Update the clinic compatibility snapshot.
7. Mark the request applied.
8. Send clinic and Admin notifications.

Downgrade behavior:

- Do not delete data.
- Do not delete doctors.
- Do not delete patients.
- Do not delete appointments.
- Do not delete clinical records.
- Do not delete billing history.
- Keep existing data readable.
- Apply new-plan limits only to new activity after enforcement is enabled.

If existing usage exceeds the target plan, show a migration warning and prevent new over-limit activity only after the published enforcement gates are enabled.

---

## 27. Implementation phases for self-service changes

### Phase 7 — Read-only plan-management readiness

1. Extend Clinic Settings with current subscription metadata.
2. Add pending-change display.
3. Add plan and billing-cycle comparison.
4. Show available actions based on server eligibility.
5. Keep the existing effective-entitlement report read-only.

### Phase 8 — Super Admin request workflow

1. Add `subscription_change_requests`.
2. Add Clinic Admin request submission.
3. Add request history and cancellation.
4. Add Super Admin request queue.
5. Add generic subscription notification targeting.
6. Add approve, reject, and request-information actions.
7. Add offline complimentary approval.
8. Add verified manual-payment approval through the separate ledger.

### Phase 9 — Clinic-requested Razorpay conversion and upgrades

1. Add outbound provider-operation tracking.
2. Add a Razorpay provider adapter.
3. Support Trial-to-paid conversion.
4. Support eligible provider-paid upgrades.
5. Keep current access until webhook confirmation.
6. Add provider failure and fallback handling.
7. Add duplicate operation protection.

### Phase 10 — Scheduled downgrades and billing-cycle changes

1. Add scheduled change storage.
2. Add next-renewal downgrade requests.
3. Add provider cycle-end scheduling where supported.
4. Add monthly-to-annual handling.
5. Add annual-to-monthly handling.
6. Add cancellation and superseding behavior.
7. Add renewal-time application jobs.

### Phase 11 — Notifications and reconciliation

1. Notify Super Admin when a request is submitted.
2. Notify the clinic when a request is approved, rejected, scheduled, failed, or applied.
3. Add failed-provider-operation alerts.
4. Add reconciliation filters.
5. Add pending-change reminders.
6. Deduplicate all notification sends.

### Phase 12 — Reporting-only validation

1. Run provider test events against upgrade and downgrade scenarios.
2. Verify repeated webhooks are harmless.
3. Verify failed payments preserve current access.
4. Verify scheduled downgrades apply only at the correct date.
5. Verify manual and complimentary paths never appear as Razorpay revenue.
6. Verify data remains intact after downgrade.
7. Keep enforcement disabled until production baseline and reconciliation gates pass.

---

## 28. Additional release gates for Clinic Admin self-service

Before enabling Clinic Admin plan changes:

- Clinic Admin authorization is tenant-scoped.
- Doctors and non-billing clinic users cannot submit changes.
- Browser-submitted prices and provider plan IDs are ignored.
- The current plan remains effective until confirmation or approved effective time.
- Razorpay conversion does not remove valid Trial access before payment confirmation.
- Immediate upgrades show the exact amount or use next-renewal timing.
- Downgrades default to the next renewal.
- Monthly and annual changes show the exact effective date.
- Only one unresolved request can exist for a clinic and subscription scope.
- Repeated submissions return the original request.
- Provider operations are tracked separately from inbound events.
- Provider webhooks are matched to the request and transition ID.
- Duplicate webhooks are harmless.
- Provider failure leaves current access unchanged.
- Offline approval requires an authorized Super Admin.
- Complimentary access is not reported as captured revenue.
- Manual payment requires evidence and verification.
- Existing data is never deleted by downgrade.
- Pending changes are visible to the Clinic Admin and Super Admin.
- Clinic and Super Admin notifications are deduplicated.
- Cancellation of scheduled changes is audited.
- Lifecycle history explains request, provider, approval, and application stages.
- Type checking, Build Check, provider-race tests, request-idempotency tests, authorization tests, transition tests, and downgrade data-preservation tests pass.

The final operating rule is:

```text
Clinic Admin:
  May request and track plan changes from Settings.

Razorpay:
  May execute eligible provider-managed changes after explicit confirmation.

Super Admin:
  Handles offline, complimentary, manual-payment, unsupported,
  exceptional, and failed-provider changes.

Effective access:
  Changes only after provider confirmation or authorized Admin approval.

Downgrade:
  Applies at renewal by default and never deletes existing data.
```