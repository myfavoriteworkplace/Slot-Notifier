# Subscription Plan Optimisation

**Status:** Proposed blueprint — edge-case review incorporated; implementation not started
**Date:** 2026-09-14  
**Related blueprint:** [16-four-plan-subscription-and-entitlement-blueprint.md](./16-four-plan-subscription-and-entitlement-blueprint.md)
**Source comparison:** Market-standard review supplied for this analysis

## Common-man takeaway: how the subscription works

This is the short version for a clinic owner, Clinic Admin, or support team.
The detailed rules later in this document exist to make these simple promises
safe and auditable.

1. **The clinic chooses a plan.** During registration, the clinic selects
   Trial, Starter, Growth, or Pro. Paid plans also require Monthly or Annual
   billing. Choosing a plan does not activate access or take payment.
2. **Super Admin approves the clinic.** Super Admin decides whether the clinic
   receives Trial, pays through Razorpay, receives complimentary access, or
   provides verified offline-payment evidence.
3. **The system records the real access source.** Trial, Razorpay, complimentary
   access, and verified offline payment are separate states. A plan name alone
   does not prove payment or entitlement.
4. **Current access stays active until a valid change is confirmed.** A browser
   response, request, or Admin selection does not change the effective plan.
   Razorpay must confirm online changes, or Super Admin must approve offline or
   exceptional changes.
5. **Clinic Admin can upgrade.** Clinic Admin can request or start an eligible
   upgrade. The existing plan remains active until the provider or Super Admin
   confirms the upgrade.
6. **Clinic Admin cannot cancel an active plan mid-period.** Clinic Admin
   cannot directly cancel, downgrade, disable renewal, change billing cycle, or
   revoke access. The clinic may submit a request for Super Admin review.
7. **Super Admin handles offline and exceptional requests.** Super Admin can
   approve or reject a downgrade, cancellation-at-period-end, immediate
   exception, complimentary plan, verified offline payment, billing-cycle
   change, or provider-failure resolution.
8. **Cancellation normally means “do not renew.”** Access normally continues
   until the paid period ends. A cancellation request does not automatically
   remove access immediately and does not automatically create a refund.
9. **Access sources cannot overlap silently.** A complimentary or offline
   assignment must begin after current coverage ends, or an authorized Super
   Admin decision must explicitly close or replace the current assignment.
10. **Payment failure does not erase valid current access by itself.** While a
    payment or provider result is pending, the system keeps the last
    authoritative access state unless a confirmed lifecycle event says it has
    ended.
11. **Downgrades never delete clinic data.** Doctors, patients, bookings,
    documents, clinical records, messages, and billing history remain
    preserved. New activity may be limited only after the downgrade becomes
    effective and the capability rules are enabled.
12. **Every decision is recorded.** Requests, approvals, withdrawals,
    cancellations, provider events, payments, reasons, actors, dates, and
    effective access remain separately auditable.

## Execution tracker

This table is a delivery queue, not a list of broad themes. Each row has one
primary owner boundary, one main deliverable, and one completion check. A step
may be investigated independently, but its listed dependencies must be complete
before the step is enabled in production. No step may directly edit effective
subscription state outside the approved lifecycle transition rules.

| Step | Independently executable deliverable | Depends on | Current status | Implementation boundary | Done when |
|---:|---|---|---|---|---|
| 1 | Approve the three remaining policy decisions | None | **Decision required.** Trial/grace timing, over-limit downgrade behavior, and duplicate-registration identity matching remain open. | Record the exact business decisions and policy version. Do not implement silent defaults. | The three decisions are written, versioned, and referenced by the affected workflows. |
| 2 | Define the registration request contract | 1 | **Not complete.** Registration does not preserve the selected paid plan as a dedicated request. | Add `requestedPlan`, `requestedBillingCycle`, request status, actor, policy version, and timestamps. Keep these separate from effective subscription fields. | Registration preserves the clinic’s selection without activating payment or access. |
| 3 | Implement server-side Trial eligibility | 1, 2 | **Partially prepared.** Trial history helpers exist, but identity matching and registration-level protection are incomplete. | Add clinic-scoped eligibility evaluation, duplicate-registration review state, and one idempotent initial-Trial transition. | Repeated registration cannot create a second acquisition Trial, and ambiguous identity matches go to review. |
| 4 | Define the approval decision contract | 2, 3 | **Partially implemented.** Trial and provider-paid approval paths exist separately. | Add one approval record containing selected/overridden plan, billing cycle, assignment mode, dates, reason, actor, policy version, and transition ID. | Super Admin can explicitly choose Trial, Razorpay, complimentary, or verified offline payment and reproduce the decision from history. |
| 5 | Separate lifecycle transitions from compatibility snapshots | 4 | **Partially prepared.** Snapshot fields exist, but the complete transition/assignment boundary is not implemented. | Make lifecycle history and assignment records authoritative; update `clinics.plan` and `clinics.subscriptionStatus` only through audited transitions. | Every effective access change has one idempotent transition, assignment source, actor, effective time, and policy version. |
| 6 | Add the clinic subscription summary contract | 5 | **Not implemented.** Entitlement reporting is read-only and does not expose subscription workflow actions. | Add `GET /api/auth/clinic/settings/subscription` with current state, access source, pending change, allowed actions, catalog, and policy version. | The server—not the browser—determines whether the clinic may request an upgrade or Super Admin review. |
| 7 | Add Clinic Admin upgrade submission | 6 | **Not implemented.** `ClinicEntitlementSettingsPanel` has no change request flow. | Add the upgrade-only Settings UI and request endpoint. Support Trial-to-paid conversion and eligible higher-plan upgrades without direct snapshot mutation. | A Clinic Admin can submit one idempotent upgrade request and current access remains unchanged until confirmation. |
| 8 | Add upgrade withdrawal | 7 | **Not implemented.** No restricted withdrawal route exists. | Add `POST /api/auth/clinic/subscription-change-requests/:id/withdraw`; allow it only before a provider operation is committed. | Withdrawal marks the request withdrawn, stops related work, and does not cancel the active subscription or disable renewal. |
| 9 | Add the Super Admin review-request path | 6 | **Not implemented.** Non-upgrade needs are not represented as explicit review requests. | Support cancellation review, downgrade review, billing-cycle review, offline assignment, provider exception, and other approved request types. | A Clinic Admin can submit a non-upgrade request without changing access, and Super Admin can see its current state. |
| 10 | Build the Super Admin request queue | 9 | **Partially prepared.** Notification primitives exist, but there is no subscription request queue. | Add tenant-safe list/detail views, filters, request information, approve, reject, supersede, and audit-history views. | Super Admin can process every pending request without relying on email or hidden database changes. |
| 11 | Add the manual-payment ledger | 4, 5, 9 | **Partially prepared.** Manual-payment state exists without a complete evidence and verification ledger. | Add payment evidence, coverage period, verifier, approval threshold, reconciliation state, and separate financial history. | Verified offline payment is distinguishable from complimentary access and Razorpay revenue at every reporting point. |
| 12 | Complete complimentary-access lifecycle | 4, 5, 9 | **Partially prepared.** Grant and revocation foundations exist, but overlap and replacement rules are incomplete. | Implement fixed-term grants, no-overlap validation, scheduling/replacement, append-only extensions, and Super Admin-only early revocation. | Complimentary access never silently overlaps paid/manual coverage, and unused time is lost and audited when replaced or revoked. |
| 13 | Add outbound provider-operation records | 5, 7, 9 | **Not complete.** Inbound provider events exist; outbound operations are not separately tracked. | Add provider operation type, request/transition correlation, idempotency key, provider reference, status, and failure details. | Every provider call can be correlated to one internal request and transition without relying on browser state. |
| 14 | Implement the Razorpay upgrade adapter | 13 | **Partially implemented.** Subscription creation and activation exist; upgrade operations do not. | Support only eligible provider-managed upgrades and Trial-to-paid conversion. Keep provider-specific behavior behind an adapter. | Provider preparation, confirmation, and failure paths are recorded without changing local access before confirmation. |
| 15 | Implement provider webhook reconciliation | 13, 14 | **Partially implemented.** Confirmation webhooks exist, but full request/transition matching is incomplete. | Match clinic, request, transition, provider subscription, target plan, billing cycle, and expected status; quarantine unmatched or stale events. | Duplicate, late, failed, or mismatched webhooks cannot change a newer or unrelated assignment. |
| 16 | Add scheduled changes and renewal application | 5, 12, 15 | **Not implemented.** Scheduled-change storage and renewal application are absent. | Add scheduled records, provider schedule references, cancellation-at-period-end state, superseding rules, and an idempotent renewal job. | Approved changes apply once at the correct timestamp while current access remains active until then. |
| 17 | Add Super Admin downgrade and billing-cycle controls | 9, 10, 16 | **Not implemented.** The policy exists, but the authorized workflows do not. | Add next-renewal downgrade, supported cycle changes, exceptional immediate downgrade, and provider-failure fallback. Clinic Admin may request but cannot apply these. | Every downgrade or cycle change has Super Admin approval or provider confirmation, preserves data, and records its effective date. |
| 18 | Add cancellation controls | 9, 10, 15, 16 | **Not implemented.** Cancellation meanings are documented but not implemented as separate operations. | Add cancellation-at-period-end, provider-operation cancellation, and Super Admin-only immediate cancellation with reason, refund, access-end, and audit decisions. | Request withdrawal, non-renewal, provider cancellation, immediate cancellation, complimentary revocation, and expiry remain distinct states. |
| 19 | Add reminder and notification delivery tracking | 10, 12, 16, 18 | **Not implemented.** Reminder policy exists without delivery records and scheduler integration. | Add deduplicated delivery records, templates, retries, failure visibility, and messages for expiry, pending changes, cancellation, revocation, and extensions. | Clinics and Super Admins receive accurate messages that reflect current and pending access states. |
| 20 | Add enforcement warnings and data-preservation checks | 5, 12, 16, 17 | **Not complete.** Downgrade limits and over-limit behavior still need capability-specific enforcement decisions. | Add warnings, read-preservation checks, and capability-specific restrictions only after effective downgrade. Never delete clinic data. | Existing data remains readable and new restrictions cannot activate before the approved effective time. |
| 21 | Run reporting-only verification and release gates | 1–20 | **Baseline only.** Existing checks cover current code, not the complete proposed workflow. | Add contract, authorization, overlap, withdrawal, cancellation, provider-race, idempotency, notification, scheduled-change, and data-preservation tests. | All tests and Build Check pass; reporting-only reconciliation is clean; enforcement is enabled only after the release gates pass. |

### Edge-case review status

The edge cases in this document have now been added to the blueprint. They are
not optional polish. They protect clinic access, payment records, and audit
history.

Before coding starts, the team must still make a final business decision on:

1. Whether Trial and grace periods use exact timestamps or clinic-local calendar
   days.
2. Which capabilities are blocked when a clinic is already over a lower plan’s
   limit after a downgrade.
3. The exact identity-matching rules for detecting repeated Trial registrations.

The complimentary-access decisions are approved and are no longer open:

```text
No overlap with active paid or verified manual-payment coverage.
Replace current access or schedule after it ends.
Unused complimentary time is lost.
Exact timestamps are stored; clinic timezone is used for display and local
calendar reporting.
Only a Super Admin can revoke early, with a reason and audit event.
Extensions are separate append-only grants.
```

Until these choices are approved, the affected workflow must remain reporting
only. It must not silently guess.

### Tracker status definitions

```text
Not implemented:
  The policy is defined, but the required production capability is absent.

Partially implemented:
  Some underlying routes, tables, helpers, or UI exist, but the complete
  workflow and its audit/payment/state guarantees are not complete.

Baseline only:
  Existing checks cover the current implementation, not the proposed workflow.
```

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

3. Complimentary offline plan for Starter, Growth, or Pro
   No payment is taken. Super Admin grants fixed-term access with
   a reason and audit history. It cannot overlap active paid coverage.

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
- Offline complimentary assignment for paid plans.
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

Allowed for Starter, Growth, or Pro when the business is granting access
without payment.

Trial is not a normal complimentary grant. If a Super Admin wants to give a
clinic extra Trial access, use the separate Admin Trial workflow in §11.3.
This keeps initial Trial, Recovery Trial, and Admin-granted Trial easy to
understand and prevents a complimentary grant from resetting Trial eligibility.

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
- Fixed exact start and end timestamps.
- Dates displayed in the clinic timezone.
- Mandatory reason.
- Actor and policy version.
- Optional campaign or partner reference.
- Waived list value reported separately from revenue.
- Must not overlap active provider-paid or verified manual-payment coverage.
- If current coverage exists, either schedule the grant after it ends or
  explicitly replace/revoke the current assignment.
- Unused complimentary time is lost if the grant is replaced or revoked early.
- Only a Super Admin may revoke the grant early, with a reason and audit event.
- Extensions are separate append-only grants, not edits to this record.
- Expiry or revocation returns to the clearly defined underlying state. The
  precedence rules in §8.4 must be applied; the system must not guess from the
  current `clinics.plan` snapshot.

This is the correct way to assign a plan offline without taking payment.

The application should not label complimentary access as provider-paid
`active`. It should show the access source and exact end timestamp clearly.

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

The paid plans can be assigned through the following controlled modes. Trial
uses its own Trial lifecycle, not the paid-plan assignment modes:

| Plan | Trial mode | Complimentary offline | Razorpay online | Verified offline payment |
|---|---:|---:|---:|---:|
| Trial | Yes | No generic grant; use Admin Trial | No | No |
| Starter | No acquisition Trial | Yes | Yes | Yes |
| Growth | No acquisition Trial | Yes | Yes | Yes |
| Pro | No acquisition Trial | Yes | Yes | Yes |

Trial is not a Razorpay plan.

Trial is also not an ordinary sponsored plan. An Admin-granted Trial must use
the Trial lifecycle route, have its own origin, reason, dates, actor, and
transition record.

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
replacesAssignmentId
supersedesAssignmentId
revokedAt
revocationReason
extensionOfAssignmentId
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

Scheduled changes are also required for complimentary access when a clinic has
active paid or verified manual-payment coverage. A complimentary grant may be
created in advance, but its effective start must be after the current coverage
ends unless the current assignment is explicitly replaced or revoked by an
authorized Super Admin.

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
cancel_at_period_end
provider_cancel_pending
provider_cancelled
applied
cancelled
failed
superseded
```

### 8.4 Temporary access and underlying-state rules

When a temporary grant ends, the application must decide what access remains.
It must not simply look at the latest value in `clinics.plan`, because that
field is only a compatibility snapshot.

Use this order when more than one record exists:

```text
1. Active provider-paid subscription
2. Active verified manual-payment assignment
3. Active complimentary paid-plan grant
4. Active initial or Admin Trial
5. Trial grace period
6. Expired or read-only state
7. Reconciliation required
```

Complimentary access must never be effective at the same time as active
provider-paid or verified manual-payment coverage. The system must either:

```text
Replace:
  Explicitly close or revoke the current assignment, then start the
  complimentary grant at the approved effective timestamp.

Schedule:
  Keep current access active until its recorded end timestamp, then start the
  complimentary grant.
```

Creating a complimentary record in advance is allowed. Activating it before
the current paid or verified coverage ends is not.

If a complimentary grant is ended early, all unused complimentary time is
lost. It is not transferred, credited, or added to a later plan.

Examples:

```text
Complimentary Growth ends
  → Restore the valid underlying paid, manual, Trial, or expired state
  → Do not restore a stale or superseded plan

Manual-payment Growth ends
  → Do not create a Razorpay-paid state automatically
  → Return to the recorded underlying state or reconciliation

Trial conversion is pending
  → Keep Trial effective
  → Store the paid target separately
```

Each access source must have its own assignment, start/end dates, reason,
origin, policy version, and transition ID. Expiring, revoking, or replacing
one source must not delete the history of another source.

Complimentary grants use the existing application time convention:

```text
Store startsAt and endsAt as exact timestamp instants.
Use the existing duration/timestamp arithmetic for calculating windows.
Display dates and times in the clinic timezone.
Use clinic-local calendar boundaries only for features that already use them,
such as monthly usage reports and local scheduling.
```

Only a Super Admin may revoke a complimentary grant before `endsAt`. Early
revocation requires a reason, actor identity, revocation timestamp, and
append-only lifecycle event. A grant that has already expired cannot be
revoked retroactively.

An extension is never an edit to the original grant. It is a new append-only
grant with its own grant ID, dates, reason, actor, policy version, transition
ID, and `extensionOfAssignmentId`.

### 8.5 Renewal reminder records

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
- If the clinic already has an active paid plan, never replace it in place.
  Keep the old assignment, create a new request, and wait for confirmation or
  an approved effective date.
- If a complimentary or manual-payment period is being replaced, explicitly
  close or schedule the old period. Do not create overlapping effective access
  by accident.

### 9.3 Downgrade

Clinic Admin cannot apply or directly schedule a downgrade. A Clinic Admin may
submit a downgrade request to Super Admin, but the current plan remains
effective until an authorized decision is approved and applied.

Super Admin-approved downgrades should default to the next renewal:

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
- Use a capability-specific enforcement table. “Read-only” alone is not
  specific enough for clinical software.

Immediate downgrade is Super Admin-only and should be limited to:

- Fraud or abuse.
- Contractual termination.
- A Clinic Admin request that has been reviewed and approved by Super Admin.
- Administrative correction.
- Complimentary access expiry.

A Clinic Admin request does not by itself authorize any downgrade. The request
still needs provider confirmation or authorized Super Admin approval, plus a
clear effective time.

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
Approved cancellation-at-period-end at the paid period boundary
Provider-confirmed cancellation or non-renewal
Super Admin-approved immediate cancellation exception
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
Ending active access because a Clinic Admin merely requested cancellation
Disabling renewal without recording the effective period-end state
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
14 days from the exact start timestamp
7 days of read-only grace from the Trial end timestamp
No payment details
One acquisition transition per clinic lifecycle
```

The first Trial must be created only once.

The application must use one timing rule everywhere. The recommended rule is
exact timestamp arithmetic:

```text
Trial starts at an exact timestamp.
Trial ends after the published number of full days.
Grace ends after the published grace duration.
Dates shown to people use the clinic timezone.
```

Do not describe a Trial as “14 calendar days” in one place and calculate it as
14 × 24 hours somewhere else. If the business chooses clinic-local calendar
days instead, that choice must replace this rule everywhere, including
Recovery Trial, complimentary access, expiry, and reminder scheduling.

### 11.2 Recovery Trial

Recovery Trial is allowed only after:

- A paid subscription existed.
- The provider confirmed that paid access actually ended.
- The recorded paid-access expiry timestamp is reached.
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

Cancellation is not the same as expiry. A cancellation request, a disabled
auto-renewal flag, or an unclear provider status must keep the current paid
access unchanged and enter reconciliation if necessary. Only confirmed paid
access expiry can start Recovery Trial.

The Recovery Trial transition ID must be based on the provider subscription
instance:

```text
recovery:{provider}:{providerSubscriptionId}
```

The provider event ID and event type are stored as metadata. They must not be
the only idempotency key, because two different expiry-related events may
refer to the same provider subscription.

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
- Separate operation type from initial signup and paid-expiry recovery.

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
- Approve cancellation-at-period-end.
- Approve exceptional immediate cancellation.
- Cancel or supersede a pending provider operation when supported.
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

### 14.1 How policy changes affect existing clinics

Saving a policy version is not enough. The entitlement resolver must also know
which policy version applies to the current access.

Use these defaults unless the business approves a different rule:

| Access type | Policy used for limits |
|---|---|
| Initial Trial | Policy saved when the Trial starts |
| Recovery Trial | Policy saved when Recovery Trial starts |
| Admin-granted Trial | Policy saved when the grant starts |
| Complimentary access | Policy saved when the grant starts |
| Verified manual payment | Policy saved when the payment is verified |
| Paid provider subscription | The policy agreed for the current paid period, unless the contract says otherwise |

When a new catalog is published, do not silently change the limits of an
existing assignment unless that is the approved commercial policy. The Admin
view should show both the assignment policy version and the currently
published catalog version when they differ.

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
3. Add the dedicated complimentary offline assignment path for Starter, Growth, and Pro.
4. Reject overlap with active provider-paid or verified manual-payment coverage.
5. Support replacement or scheduling after current coverage ends.
6. Keep Razorpay online assignment pending until provider confirmation.
7. Add verified offline payment assignment only after the manual-payment ledger and evidence flow are approved.
8. Preserve a lifecycle and assignment event for every outcome.
9. Record policy version, exact timestamps, replacement links, and extension links.

### Phase 3 — Admin Trial controls

1. Keep initial Trial one-time and idempotent.
2. Distinguish initial, recovery, and Admin-granted Trial origins.
3. Add configurable Admin-grant repetition limits.
4. Require reasons and fixed dates.
5. Prevent Admin Trial from resetting acquisition eligibility.

### Phase 4 — Upgrade, downgrade, and billing cycle

1. Add scheduled subscription changes.
2. Add provider-aware upgrade processing.
3. Route downgrade requests through Super Admin and schedule approved
   downgrades for renewal by default.
4. Route billing-cycle changes through Super Admin unless a separately approved
   provider operation handles them.
5. Add cancellation-at-period-end and exceptional immediate-cancellation
   states.
6. Add provider-authority, withdrawal, cancellation, and superseding rules.
7. Add stale-state protection.
8. Apply complimentary grants only after current paid/manual coverage ends unless
   an authorized replacement closes it.
9. Preserve old and new assignments and policy versions.
10. Treat unused complimentary time as lost when replaced or revoked.
11. Create extensions as separate append-only assignments.

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
- Complimentary access never overlaps active provider-paid or verified manual-payment coverage.
- Complimentary access is replaced or scheduled after current coverage, never silently layered on top.
- Unused complimentary time is lost when the grant is replaced or revoked.
- Exact access timestamps are stored and displayed in the clinic timezone.
- Only a Super Admin can revoke complimentary access early, with a reason and audit event.
- Complimentary extensions are separate append-only assignments.
- Razorpay-paid assignment activates only after provider confirmation.
- Manual offline payment requires evidence and authorization.
- No workflow fabricates provider events.
- Initial, recovery, and Admin-granted Trial origins are distinct.
- Upgrades and downgrades are idempotent.
- Downgrades default to the correct renewal date.
- Clinic Admin cannot directly cancel, downgrade, disable renewal, or change
  billing cycle.
- Clinic Admin can withdraw only an uncommitted upgrade request.
- Cancellation-at-period-end preserves access until the paid period ends.
- Immediate cancellation requires Super Admin authorization and an explicit
  financial/access decision.
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
  Fixed-term complimentary access for Starter, Growth, or Pro.
  It replaces current paid/manual coverage or starts after it ends.
  Unused time is lost if it is revoked or replaced.
  Only a Super Admin can revoke it early.
  Extensions are separate append-only assignments.
  Never label it as captured paid revenue.

Paid plan through offline payment:
  Manual override with evidence, verification, and financial ledger.
  Never fabricate a Razorpay event.

Upgrade:
  Immediate after provider confirmation, or scheduled.
  No usage-based surprise upgrade.

Downgrade:
  Clinic Admin may request it, but only Super Admin can approve it.
  Next renewal by default.
  Immediate only for explicit Super Admin-approved exceptions.

Cancellation:
  Clinic Admin may submit a review request but cannot cancel the active plan.
  Cancellation normally disables renewal at period end.
  Immediate cancellation is a Super Admin-only exception.

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
- Start a Razorpay-managed online change when eligible.
- Submit a request for Super Admin handling when the clinic needs a
  cancellation, downgrade, billing-cycle change, offline assignment, manual
  payment, or other exception.
- View pending, scheduled, applied, failed, rejected, withdrawn, and cancelled
  requests.
- Withdraw an upgrade request only while it has not become a committed provider
  operation. Withdrawal is not subscription cancellation.

The Clinic Admin must not be able to:

- Directly edit `clinics.plan`.
- Directly edit `clinics.subscriptionStatus`.
- Cancel an active plan mid-period.
- Disable renewal directly.
- Directly downgrade the current plan.
- Directly change monthly billing to annual or annual billing to monthly.
- Cancel a provider operation after it has been committed.
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
  withdrawable
  providerOperationCommitted
  cancellationAuthority

actions:
  canRequestUpgrade
  canUseRazorpay
  canRequestSuperAdmin
  canWithdrawUpgradeRequest
  canRequestCancellationReview
  canRequestDowngradeReview
  canRequestBillingCycleReview

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

1. Target plan for an upgrade.
2. Target billing cycle, where the upgrade requires it.
3. Effective timing.
4. Payment/approval route.
5. Price and entitlement impact.
6. Confirmation.

The Clinic Admin interface must not present direct downgrade, cancellation,
renewal-disable, or billing-cycle-change actions. It should present a clear
Super Admin request route for those needs:

```text
Need to cancel, downgrade, change billing cycle, or arrange offline access?
Submit a request to Super Admin.
Your current access will remain unchanged while the request is reviewed.
```

Target plan cards should show:

- Plan name.
- Monthly price.
- Annual price.
- Annual savings.
- Included limits.
- Relevant differences from the current plan.
- Upgrade label for plans above the current plan.
- Super Admin request label for unsupported or non-upgrade changes.

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

Example Super Admin review request:

```text
Pro Annual → Growth Annual

Request type:
  Downgrade at next renewal

Your request will be sent to Super Admin.
Your current Pro access continues until an approved effective date.
No data will be deleted.
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

## 19. Two Clinic Admin-initiated request routes

Every Clinic Admin-initiated subscription request must use one of two explicit
routes. Only the upgrade route can directly begin an eligible provider
operation; all non-upgrade requests are review requests.

### Route A — Razorpay-managed online upgrade

Use this route only for a Clinic Admin upgrade or Trial-to-paid conversion when
the current subscription is provider-managed and the requested operation is
supported. Downgrades, cancellation, renewal changes, and billing-cycle
changes do not use this direct Clinic Admin route.

```text
Clinic selects a higher target plan
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

Use this route for any offline handling, non-upgrade request, or provider path
that is not eligible. A Clinic Admin may submit the request, but submission
does not change effective access.

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
- Cancellation-at-period-end.
- Immediate cancellation exceptions.
- Downgrades.
- Billing-cycle changes.
- Withdrawal or cancellation of a committed provider operation.

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

Before applying a provider result, the server must match all of these:

```text
Internal clinic ID
Internal request ID
Internal transition ID
Expected provider subscription ID
Target plan
Target billing cycle
Expected request status
```

If the result belongs to an old, cancelled, superseded, unmatched, or
reconciliation-required request, do not change effective access. Store the
provider event for investigation instead.

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

Provider preparation failure, expired activation links, and unmatched webhook
results must have visible failure states. They must not leave a clinic
permanently stuck in `pending_payment`, and they must not activate paid access.
The clinic should return to its previous authoritative state when safe; if the
previous state cannot be proven, use `reconciliation_required`.

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

- A Clinic Admin request or a documented administrative reason.
- Super Admin approval.
- Clear financial and entitlement impact.
- Provider confirmation where the provider controls the subscription.
- Data-preservation validation.

Clinic Admin confirmation records intent only. It is not authorization to
remove access or apply a downgrade.

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

Clinic Admin does not directly apply a billing-cycle change. The clinic may
submit a review request, and Super Admin may approve the change or authorize a
provider-managed operation when the provider supports it.

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

After the Clinic Admin submits a Super Admin review request and Super Admin
approves the scheduled downgrade:

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

For a complimentary change:

```text
Current paid/manual coverage exists:
  Schedule the complimentary grant after its end timestamp, or explicitly
  replace/revoke the current assignment before the grant starts.

Current complimentary grant exists:
  Schedule the next grant after it ends, or have a Super Admin revoke it.
  Unused time is lost.

Extension requested:
  Create a separate append-only grant.
  Do not edit the original grant dates.
```

The grant must store exact timestamp instants. The UI displays those timestamps
in the clinic timezone. Only a Super Admin can revoke the grant early, and the
revocation must record the reason, actor, timestamp, and lifecycle event.

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
  billing_cycle_change
  trial_conversion
  cancellation_review
  renewal_disable_review
  offline_assignment
  provider_operation_review

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
  withdrawn_by_clinic
  cancelled_by_admin
  cancellation_requested
  cancel_at_period_end
  provider_cancel_pending
  provider_cancelled
  cancelled
  applied
  failed
  expired
  superseded
```

The request record must snapshot the current plan and billing cycle at submission time. This prevents an old request from silently applying against a different current subscription.

For conflict handling, use these separate but clinic-scoped limits:

```text
One active provider operation
One active scheduled change
One active manual-review request
```

The request must also identify the subscription instance or assignment it was
created against. A request for an old provider subscription must not change a
newer subscription after a renewal, cancellation, manual assignment, or
superseding request.

When a new request is submitted, the server must choose one clear result. A
Clinic Admin may withdraw only an uncommitted upgrade request. Cancellation of
an active subscription or a committed provider operation is never implied by a
Clinic Admin request:

```text
Wait:
  Keep the old request active and reject the new conflicting request.

Supersede:
  Mark the old request and any scheduled change as superseded,
  record the reason, then create the new request.

Cancel:
  Super Admin or the provider adapter cancels the old request only when the
  provider operation can still be cancelled, then create the new request.

Withdraw:
  Clinic Admin withdraws an upgrade request only before a provider operation is
  committed. The current subscription remains unchanged.
```

Never silently overwrite an unresolved request.

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

- Super Admin cancels or supersedes the request.
- The provider confirms cancellation of its schedule.
- A newer request replaces it.
- The subscription is cancelled.
- Provider state changes independently.
- The Super Admin rejects the operation.

If a Clinic Admin no longer wants the scheduled change, the Clinic Admin may
submit a withdrawal or review request. The scheduled change remains effective
until an authorized cancellation or superseding action is confirmed.

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
  "requestType": "upgrade",
  "targetPlan": "growth",
  "targetBillingCycle": "annual",
  "requestedMode": "razorpay",
  "effectiveTiming": "next_renewal",
  "reason": "Need additional capacity for the new doctors"
}
```

For a Clinic Admin, `requestType: "upgrade"` or `"trial_conversion"` is the
only request type that may enter the direct Razorpay route. A cancellation,
renewal-disable, downgrade, billing-cycle, offline, or exceptional request
must use a review request type and remain pending Super Admin action:

```json
{
  "requestType": "cancellation_review",
  "effectiveTiming": "next_renewal",
  "reason": "Please stop renewal after the current paid period"
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
- A Clinic Admin submits a direct downgrade, cancellation, renewal-disable, or
  billing-cycle mutation instead of a Super Admin review request.

```text
GET /api/auth/clinic/subscription-change-requests
```

Returns the clinic’s request history.

```text
POST /api/auth/clinic/subscription-change-requests/:id/withdraw
```

Withdraws a Clinic Admin upgrade request only when it has not become a
committed provider operation. This does not cancel the active subscription or
disable renewal.

### 24.2 Super Admin endpoints

```text
GET /api/admin/subscription-change-requests
GET /api/admin/subscription-change-requests/:id
POST /api/admin/subscription-change-requests/:id/approve
POST /api/admin/subscription-change-requests/:id/reject
POST /api/admin/subscription-change-requests/:id/request-information
POST /api/admin/subscription-change-requests/:id/cancel
POST /api/admin/subscriptions/:id/cancel-at-period-end
POST /api/admin/subscriptions/:id/cancel-immediately
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

The Super Admin cancellation endpoints must require:

```text
reason
effectiveAt
providerOperationReference, when applicable
refundDecision
accessEndDecision
transitionId
```

`cancel-at-period-end` keeps current access until the recorded paid period end.
`cancel-immediately` is exceptional and must not be treated as ordinary
non-renewal.

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
2. Add Clinic Admin upgrade submission and Super Admin review-request
   submission for non-upgrade needs.
3. Add request history and upgrade-withdrawal rules.
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
2. Add Super Admin-approved next-renewal downgrade requests.
3. Add provider cycle-end scheduling where supported.
4. Add monthly-to-annual handling.
5. Add annual-to-monthly handling.
6. Add cancellation-at-period-end and exceptional immediate-cancellation
   behavior.
7. Add provider-authority, withdrawal, and superseding behavior.
8. Add renewal-time application jobs.

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
- Clinic Admin can submit upgrades but cannot directly cancel, downgrade,
  disable renewal, or change billing cycle.
- Clinic Admin can withdraw only an upgrade request before provider commitment.
- Downgrades and monthly/annual changes require Super Admin approval or an
  explicitly supported provider operation.
- Cancellation-at-period-end preserves access until the paid period ends.
- Immediate cancellation requires Super Admin authorization and an explicit
  refund/access decision.
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
- Withdrawal, cancellation, superseding, and cancellation-at-period-end actions
  are audited with actor and reason.
- Lifecycle history explains request, provider, approval, and application stages.
- Type checking, Build Check, provider-race tests, request-idempotency tests, authorization tests, transition tests, and downgrade data-preservation tests pass.

The final operating rule is:

```text
Clinic Admin:
  May request and track upgrades from Settings.
  May submit a Super Admin review request for cancellation, downgrade,
  billing-cycle, offline, or exceptional needs.
  May withdraw only an uncommitted upgrade request.

Razorpay:
  May execute eligible provider-managed changes after explicit confirmation.

Super Admin:
  Handles cancellation, downgrade, billing-cycle, offline, complimentary,
  manual-payment, unsupported, exceptional, and failed-provider changes.

Effective access:
  Changes only after provider confirmation or authorized Admin approval.

Downgrade:
  Applies at renewal by default after Super Admin approval and never deletes
  existing data.

Cancellation:
  Normally disables renewal at period end.
  Immediate cancellation is a Super Admin-only exception.
```

---

## 29. Plain-language edge-case playbook

This section turns the policy into simple rules for the people implementing the
feature. When two rules appear to conflict, the safer rule wins:

```text
Do not remove valid access early.
Do not activate paid access without proof.
Do not overwrite history.
Do not trust a browser response or an unmatched provider event.
Do not let two access sources overlap silently.
```

### 29.1 An active paid clinic asks for an upgrade

Example:

```text
Current: Growth Annual, active until 14 September 2027
Request: Pro Annual
```

Rules:

1. Keep Growth active while the request is being checked.
2. Create a change request instead of editing `clinics.plan` directly.
3. If Razorpay supports the change, wait for provider confirmation.
4. If the provider cannot safely change it, schedule it for renewal or send it
   to Super Admin.
5. If the upgrade is complimentary or manually paid, create a separate
   assignment with its own dates and audit record.
6. Preserve the old Growth assignment forever in history.
7. Never charge twice and never show Pro access before the approved effective
   time.

### 29.2 A clinic asks to downgrade before its paid period ends

Example:

```text
Current: Pro Annual
Request: Growth Annual
Paid access ends: 14 September 2027
```

Clinic Admin behavior:

```text
Clinic Admin submits a downgrade request for Super Admin review.
The current Pro access remains active.
No downgrade is applied by the request itself.
```

If Super Admin approves the request, the default behavior is:

```text
Keep Pro access until 14 September 2027.
Show “Downgrade to Growth scheduled”.
Apply Growth at the renewal/effective date.
```

Do not delete or hide existing:

- Doctors
- Patients
- Bookings
- Clinical records
- Documents
- Messages
- Billing history

After the downgrade becomes effective, restrictions apply only to new
activity, and only after the capability-specific enforcement rules are enabled.

An immediate downgrade requires Super Admin approval, provider confirmation when
the provider controls the subscription, explicit financial and entitlement
decisions, and data-preservation validation. “The clinic clicked downgrade” is
never enough to remove paid access.

### 29.3 Complimentary access changes to paid access

Complimentary access is free access granted by the business. It is not revenue
and must not look like a Razorpay payment.

The complimentary grant cannot overlap with the paid plan. There are two safe
choices:

```text
Scheduled change:
  Keep complimentary access active until its recorded end timestamp.
  The paid request is prepared separately.
  Paid access begins only after provider confirmation and after the
  complimentary grant ends.

Immediate change:
  A Super Admin explicitly revokes/closes the complimentary grant.
  The unused complimentary time is lost.
  The revocation reason and audit event are recorded.
  The paid plan becomes effective only after provider confirmation.
```

Do not keep both sources effective at the same time. If payment fails during
an immediate conversion, the system must return to the authoritative
post-revocation state; it must not silently recreate or extend the lost
complimentary period.

When the complimentary grant ends, is revoked, or is replaced, restore the
correct underlying state from the precedence rules in §8.4, not from an old
plan snapshot.

An extension is not an edit to the original grant. It is a new append-only
grant with its own dates, reason, Super Admin actor, policy version, and
transition ID.

### 29.4 Manual/offline payment changes to Razorpay

Manual payment and Razorpay payment are different financial records.

When a clinic with verified offline coverage requests Razorpay:

1. Keep the offline payment record unchanged.
2. Record the offline coverage end date.
3. Create a separate Razorpay provider operation.
4. Do not mark the clinic provider-paid until Razorpay confirms.
5. Decide whether the provider plan begins immediately after closing the
   offline period or at its scheduled end.
6. If the provider attempt fails, keep the manual-payment state when it is still
   valid.
7. If the records cannot be reconciled, stop automatic access changes and mark
   the clinic for reconciliation.

Never create a fake Razorpay event to make the records look consistent.

### 29.5 A clinic submits several changes at once

Examples:

- Upgrade Growth to Pro and change monthly to annual
- Submit two upgrade requests from two browser tabs
- Submit an upgrade while a Super Admin-approved downgrade is already scheduled
- Submit a cancellation request while an upgrade is provider-pending

The system must not create competing active operations. Keep these limits:

```text
One active provider operation
One active scheduled change
One active manual-review request
```

For every new request, choose one result:

```text
Wait:
  Reject the new conflicting request and keep the old one.

Supersede:
  Mark the old request as superseded, record why, then create the new one.

Cancel:
  Super Admin or the provider adapter cancels the old request only when the
  provider operation can still be cancelled, then create the new one.

Withdraw:
  Clinic Admin withdraws only an uncommitted upgrade request. This does not
  cancel the active subscription or disable renewal.
```

Repeated submission of the same request must return the existing request rather
than creating a second one.

### 29.6 A scheduled downgrade is followed by an upgrade

Example:

```text
Scheduled: Pro → Growth at renewal
New request: Pro → Growth → Pro, or Pro → Starter → Growth
```

The newer request must be handled by Super Admin and explicitly supersede or
cancel the old scheduled change.
If Razorpay already has a provider-side schedule, the server must first check
whether that schedule can be cancelled.

If the provider schedule cannot be safely changed:

```text
Keep current access.
Do not pretend the new request is applied.
Record the provider conflict.
Send the request to reconciliation or Super Admin.
```

Both the old and new requests remain visible in history.

### 29.7 A renewal reminder overlaps with a pending change

The reminder must show the current plan and the pending plan together.

Good message:

```text
Your Growth Annual access ends on 14 September 2027.
Your pending downgrade to Starter Annual is scheduled for renewal.
```

Bad message:

```text
Your Growth plan expires. Renew now.
```

The second message is misleading when the clinic already has a valid scheduled
downgrade. Reminder generation must read the current effective assignment and
the pending scheduled change before choosing the message.

If a cancellation-at-period-end exists, the reminder should explain that access
continues until the paid end date and that renewal is not currently scheduled.

### 29.8 Trial misuse and repeated registration

Trial selection during registration is allowed once for the clinic lifecycle.
The server, not the browser, decides whether the clinic is eligible.

The check may use:

- Verified email
- Normalized phone
- Clinic name
- GST number
- Medical license identity
- Registration-certificate identity
- Existing active and archived clinic records
- Previous Trial lifecycle events
- Existing or recently completed registrations

Do not use one field alone as an automatic rejection rule. A legitimate
multi-branch clinic or ownership transfer may share some identity details.
Cases with conflicting evidence should go to review.

These Trial origins remain separate:

```text
initial_signup
recovery_paid_expiry
admin_granted
admin_extension
```

An Admin-granted Trial must not reset the clinic’s initial-registration Trial
eligibility.

### 29.9 Provider webhook fails, is late, or cannot be matched

The clinic must not become paid-active because an Admin selected a plan or
because a browser received a successful preparation response.

Use visible provider states:

```text
provider_pending
provider_confirmed
provider_failed
provider_unmatched
reconciliation_required
```

When a webhook cannot be matched to the expected clinic, request, provider
subscription, plan, billing cycle, and transition:

1. Store the provider event.
2. Do not change effective access.
3. Retry or query the provider when safe.
4. Mark the clinic for reconciliation if the result remains unclear.
5. Notify the responsible Admin and clinic when action is needed.

An unmatched or old webhook must never change a newer local assignment.

### 29.10 A paid plan expires and Recovery Trial may begin

Recovery Trial starts only when all of these are true:

1. The clinic really had a paid provider subscription.
2. The provider confirms that paid access ended.
3. The recorded paid-access expiry time has arrived.
4. The provider subscription ID is known.
5. The event has been processed successfully.
6. Recovery has not already been applied for that provider subscription.

Cancellation, disabled auto-renewal, or an unclear provider status is not
enough.

Use this transition identity:

```text
recovery:{provider}:{providerSubscriptionId}
```

Store the provider event ID and event type as supporting metadata. If two
different expiry events refer to the same provider subscription, they must
still create only one Recovery Trial.

### 29.11 Trial, grace, expiry, and reminder timing

The document must use one timing model everywhere. The recommended model is:

```text
Start from an exact timestamp.
Add the published duration.
Calculate grace from the Trial end timestamp.
Display the resulting dates in the clinic timezone.
```

For example, do not describe a Trial as 14 calendar days but calculate it as
the end of the fourteenth clinic-local date in one route and as 14 × 24 hours
in another route.

Apply the same decision to:

- Initial Trial
- Recovery Trial
- Trial grace
- Paid expiry
- Complimentary access
- Manual-payment coverage
- Renewal reminders

If the business chooses clinic-local calendar days instead, all of these
workflows must use that rule consistently.

### 29.12 What remains after temporary access ends

The latest value of `clinics.plan` is not enough to decide this. Resolve access
from assignment and lifecycle history.

Because complimentary access cannot overlap paid coverage, a complimentary
assignment must either start after paid/manual coverage ends or explicitly
close that coverage first. An overlapping record should be treated as a
workflow error, not resolved by silently choosing whichever row was written
last.

Recommended precedence:

```text
1. Active provider-paid subscription
2. Active verified manual-payment assignment
3. Active complimentary paid-plan grant
4. Active Trial
5. Trial grace
6. Expired/read-only state
7. Reconciliation required
```

If two records overlap and the system cannot prove which one should win, do not
guess. Preserve access only when it is clearly authorized and send the case to
reconciliation.

### 29.13 Admin Trial must not look like Recovery Trial

Admin Trial is a controlled business exception. It requires:

- Super Admin authorization
- A reason
- Fixed start and end dates
- Actor identity
- Policy version
- A unique transition ID
- A separate lifecycle event
- A repetition limit

The system must not label an Admin Trial as paid-expiry recovery merely because
the clinic currently has an expired, cancelled, or manual subscription state.
Recovery origin requires matching provider-expiry evidence.

### 29.14 Trial conversion to paid access

When a Trial clinic starts paid conversion:

```text
Current effective access: Trial
Pending target: paid plan
Current state: pending payment
```

The Trial remains usable while payment is pending. After provider confirmation:

```text
Effective access: paid plan
State: active
Trial dates: cleared
```

If the payment fails, the link expires, or the clinic abandons the process:

```text
Request: failed or expired
Effective access: previous Trial or grace state
Paid access: not active
```

### 29.15 Pending payment must not become a permanent dead end

For every pending payment, define:

- Activation-link expiry
- Retry behavior
- Whether a new request supersedes the old one
- Maximum outstanding provider attempts
- What happens to an old provider subscription
- How provider and local records are reconciled

Safe default:

```text
Provider preparation fails:
  Keep current access unchanged.

Payment remains pending:
  Keep current access unchanged unless the clinic had no prior access.

Payment fails or expires:
  Return to the previous authoritative state.

Provider result cannot be matched:
  Do not activate access; require reconciliation.
```

### 29.16 Provider webhooks must belong to the correct request

Before applying any provider event, match:

```text
Clinic
Internal request
Internal transition
Provider subscription
Target plan
Billing cycle
Current request status
```

Reject or quarantine the event when:

- The provider subscription ID is old or unexpected.
- The plan does not match the request.
- The billing cycle does not match.
- The request was cancelled or superseded.
- A newer assignment is already effective.
- The provider event has no matching clinic.

The event should remain available for investigation even when it is not applied.

### 29.17 Policy changes must not silently change old access

Each assignment records the policy version used when it was created. The
entitlement resolver must use that version according to the approved policy.

Recommended defaults:

```text
Initial Trial:
  Use the policy saved when Trial started.

Recovery Trial:
  Use the policy saved when Recovery Trial started.

Complimentary or manual access:
  Use the policy saved when the access was granted or verified.

Paid access:
  Use the policy agreed for the current paid period unless the contract says
  that published limits change immediately.
```

When a new catalog is published, show the difference to Super Admin instead of
silently changing existing clinic limits.

### 29.18 Downgrade enforcement must be capability-specific

“Make the clinic read-only” is not detailed enough. Before enforcement, approve
a table like this:

| Capability | Existing data | New activity after downgrade |
|---|---|---|
| Doctors | Keep existing doctors | Block or allow new doctor creation according to target plan |
| Bookings | Keep existing and scheduled bookings | Define whether new bookings are blocked once the limit is reached |
| Smile Deals | Keep existing deals visible | Block new deals when over the target limit |
| Storage | Keep files readable | Define whether uploads are blocked |
| Messaging | Keep history visible | Preserve essential notifications and define other message limits |
| Clinical records | Never delete or hide | Do not block safe clinical access without an approved policy |
| Billing history | Keep all history | Never delete financial records |

Show warnings before enforcing a restriction. Never delete data to make usage
fit the new plan.

### 29.19 Usage measurements need approved definitions

Before limits are enforced, define whether each item counts:

- Cancelled bookings
- No-show bookings
- Imported bookings
- Admin-created bookings
- Deactivated doctors
- Expired Smile Deals
- Files still inside a retention period
- Test messages
- Failed messages
- Essential WhatsApp, SMS, or email messages

The same definition must be used in reports, warnings, and enforcement.

### 29.20 Renewal reminders depend on stable lifecycle states

Renewal and expiry reminders should be implemented only after the following
states are reliable:

- Current effective plan
- Access source
- Paid-access expiry
- Trial end and grace end
- Pending scheduled change
- Cancellation-at-period-end
- Recovery Trial eligibility
- Manual-payment coverage end
- Complimentary-access end

Every reminder needs a delivery record, template version, channel, status,
retry behavior, and idempotency key. A reminder must not be sent repeatedly
because a scheduler restarted.

### 29.21 Cancellation types and authority

The word “cancellation” must not represent several different operations. The
system should use these separate meanings:

| Operation | Who can start it | What happens to current access | Required result |
|---|---|---|---|
| Withdraw an uncommitted upgrade request | Clinic Admin | Nothing changes | Mark the request `withdrawn_by_clinic`; stop related pending reminders |
| Cancel a pending provider operation | Super Admin or provider adapter when supported | Nothing changes until provider result is confirmed | Record the provider cancellation and keep current access |
| Cancellation-at-period-end | Clinic Admin may request; Super Admin approves | Current paid access continues until `paidAccessExpiresAt` | Set `cancel_at_period_end` or the provider equivalent; do not remove access early |
| Immediate subscription cancellation | Super Admin only | Ends access at an approved exact timestamp | Record reason, provider result, refund decision, access-end decision, and lifecycle transition |
| Revoke complimentary access | Super Admin only | Complimentary access ends at the approved timestamp; unused time is lost | Restore the correct underlying state and record the revocation |
| Provider-side cancellation or non-renewal | Provider event, reconciled by server | Follow the provider-confirmed state; do not infer expiry from a request | Match provider subscription, event, request, and transition before applying |
| Clinic account closure | Separate administrative workflow | Must not be treated as subscription cancellation | Preserve financial, clinical, and lifecycle records under the retention policy |

Rules:

- Clinic Admin cannot directly cancel an active plan mid-period.
- A Clinic Admin cancellation or non-renewal request is intent only.
- A cancellation request does not create a refund automatically.
- `cancel_at_period_end` is not the same as `cancelled` or `expired`.
- Recovery Trial can begin only after confirmed paid expiry, never merely because
  renewal was disabled or cancellation was requested.
- A late provider event must not reopen, extend, or end access without matching
  the current subscription instance and lifecycle transition.

### 29.22 Super Admin offline override or clinic-requested offline change

An offline request may be initiated by the clinic, but only Super Admin can
turn it into an assignment or cancellation. The safe flow is:

```text
Clinic Admin submits offline or exceptional request
  ↓
Current access remains unchanged
  ↓
Super Admin reviews current assignment, provider state, payment evidence,
and requested effective date
  ↓
Super Admin approves, rejects, requests information, or marks reconciliation
  ↓
System creates an append-only assignment or lifecycle transition
  ↓
Snapshot fields are updated only after the transition is recorded
  ↓
Clinic and Admin receive the result
```

For an offline plan update, Super Admin must explicitly choose one of these
outcomes:

```text
Schedule after current coverage ends
Replace current coverage at an approved timestamp
Grant complimentary fixed-term access
Verify offline payment and create manual-payment coverage
Reject the request
```

The system must not:

- Overwrite a provider-paid assignment with an offline snapshot.
- Treat a complimentary grant as captured revenue.
- Treat an offline payment as a Razorpay confirmation.
- Activate overlapping paid, manual, and complimentary sources.
- End current access merely because an offline request was submitted.
- Apply an override without a reason, actor, effective time, and transition ID.

If Super Admin acts while Razorpay has an unresolved operation:

1. Mark the provider operation as pending review.
2. Cancel it with the provider if safely supported, or quarantine the result.
3. Do not apply both the provider and offline decisions.
4. Apply only the approved assignment after conflict resolution.
5. Reconcile any later webhook against the final transition.

### 29.23 Payment, refund, and provider-failure edge cases

The subscription workflow must also define these cases before financial
automation is enabled:

- Annual plan cancellation without an automatic refund.
- Immediate cancellation with a manually approved refund or credit.
- Chargeback or provider reversal after access was granted.
- Payment succeeds after the local request was withdrawn.
- Payment succeeds after Super Admin approved a different offline assignment.
- Provider reports cancellation while a local renewal job is running.
- Provider renewal succeeds but the webhook is delayed.
- Provider subscription is replaced and the old subscription later emits an
  expiry event.

The safe default is:

```text
Do not apply an event that cannot be matched to the current request,
subscription instance, target plan, billing cycle, and transition.
Preserve the event, keep the last authoritative access state where safe,
and mark reconciliation_required.
```

## 30. Known implementation mismatches to fix before rollout

The current code already contains useful lifecycle foundations, but these
specific mismatches must be corrected before enabling commercial automation:

1. **Recovery identity:** The lifecycle helper uses the provider subscription
   ID, but the webhook path still builds an event-based recovery transition.
2. **Cancellation versus expiry:** The webhook and helper do not express one
   single, shared rule for when paid access has truly ended.
3. **Admin Trial origin:** The Admin Trial route can infer a paid-expiry origin
   from the current snapshot. It must require matching provider history.
4. **Trial conversion:** The paid-plan assignment route clears Trial fields
   before provider confirmation. Trial access must remain effective while
   payment is pending.
5. **Complimentary access controls:** The grant table and revocation foundation
   exist, but non-overlap, replacement/scheduling, lost unused time, separate
   extensions, and Super Admin-only early revocation must be enforced as one
   workflow.
6. **Timing language:** Complimentary access should use the existing exact
   timestamp convention and clinic timezone for display. Trial and grace
   wording still needs the final business decision recorded at the top.
7. **Temporary-access precedence:** The entitlement resolver supports active
   sponsored access, but the full replacement and underlying-state rules need
   to be enforced.
8. **Provider correlation:** Future provider changes need request, transition,
   provider-operation, subscription, plan, and billing-cycle correlation.
9. **Usage enforcement:** Current usage measurements are useful for reporting,
   but their commercial meaning must be approved before restrictions are turned
   on.
10. **Baseline wording:** Historical audit findings must be labelled as
   historical. Current code findings and completed lifecycle foundations should
   be refreshed before the execution tracker is used as a release gate.
11. **Clinic cancellation authority:** Earlier self-service rules allowed Clinic
    Admin downgrade, billing-cycle, and cancellation actions. These must be
    restricted to upgrade requests and Super Admin review requests. A Clinic
    Admin must never cancel an active plan mid-period.
12. **Cancellation state separation:** Request withdrawal,
    cancellation-at-period-end, provider cancellation, immediate cancellation,
    complimentary revocation, and account closure must use distinct states and
    transitions.
13. **Offline override correlation:** A Super Admin offline update must not
    overwrite a provider assignment or coexist with an unresolved provider
    operation. It requires an explicit assignment, transition, reason, actor,
    effective time, and reconciliation outcome.

These are implementation gates, not suggestions. A workflow that cannot prove
which access source, provider operation, or lifecycle transition it is applying
must stop safely and request reconciliation.