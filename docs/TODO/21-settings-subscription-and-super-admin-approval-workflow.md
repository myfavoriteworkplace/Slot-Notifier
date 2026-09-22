# Clinic Settings, Subscription Upgrade, and Super Admin Approval Workflow

**Status:** Detailed product, policy, and implementation plan
**Scope:** Clinic registration approval, Trial lifecycle, paid-plan assignment, payment-link delivery, verified offline payment, complimentary access, upgrade requests, renewals, audit history, and the Super Admin Clinics & Access workspace
**Audience:** Product owner, frontend engineers, backend engineers, Super Admin operations, billing operators, and QA

## 1. Purpose

This document is the central reference for clinic subscription approval and
access management. It defines what Super Admin sees, which outcome can be
selected, what access the clinic receives, how payment is recorded, and how
renewal is handled.

The most important rule is:

> A requested or assigned paid plan is not active paid access. Paid access
> starts only after provider confirmation, verified offline payment, or an
> explicitly recorded complimentary/sponsored grant.

For online payment, the confirmed target policy is:

```text
Clinic registers with Growth
  -> Super Admin approves Growth
  -> payment link is sent
  -> clinic remains on Trial
  -> provider confirms payment
  -> clinic becomes active paid Growth
```

The current paid-plan route does not fully follow this target behavior: it
currently writes `pending_payment` and clears Trial dates. That is an
implementation gap documented here for correction; it is not the desired
business policy.

---

## 2. Current published plan catalog

The current catalog is defined in `shared/plan-catalog.ts`.

| Plan key | Display name | Type | Monthly price | Annual price | Trial duration | Grace period | Meaning |
|---|---|---|---:|---:|---:|---:|---|
| `trial` | Trial | Free evaluation | — | — | 14 days | 7 days | Temporary evaluation access |
| `starter` | Starter | Paid | ₹999 | ₹9,990 | — | — | Basic workflow for a small or single-doctor clinic |
| `growth` | Growth | Paid | ₹1,599 | ₹15,990 | — | — | Recommended plan for a growing clinic |
| `pro` | Pro | Paid | ₹2,999 | ₹29,990 | — | — | High-volume plan with fair-use monitoring |

Paid plans currently support:

```text
monthly
annual
```

Trial is an access mode, not a paid billing cycle.

Pricing, limits, and feature entitlements are policy-versioned. Historical
approval and renewal records must retain the policy version that was active at
the time. A later price-policy change must not rewrite historical payment
amounts or plan terms.

---

## 3. Separate subscription dimensions

The system must not use one `plan` field to represent every subscription
concept. These values must remain separate.

| Dimension | Example values | Meaning |
|---|---|---|
| Registration request | `starter`, `growth`, `pro` | What the clinic selected during registration |
| Approved/assigned plan | `starter`, `growth`, `pro` | What Super Admin approved |
| Current access plan | `trial`, `starter`, `growth`, `pro` | Which plan policy is currently used for access |
| Access state | `pending_approval`, `trial`, `trial_grace`, `active_paid`, `sponsored`, `expired`, `cancelled`, `unknown` | What the clinic can use now |
| Payment status | `not_required`, `pending`, `confirmed`, `verified_offline`, `waived`, `failed`, `reversed` | What is known about payment |
| Payment basis | `none`, `provider`, `offline_verified`, `complimentary` | Why the clinic has or does not have paid-level access |
| Renewal mode | `trial_expiry`, `provider_auto`, `manual`, `admin_review` | How the next period is obtained |
| Period dates | `startsAt`, `endsAt`, `nextRenewalAt` | Current access and renewal boundaries |

The following combined state is valid:

```text
access.state = trial
assigned.plan = growth
payment.status = pending
payment.basis = provider
```

It means:

```text
The clinic is using Trial access while Growth payment activation is pending.
```

It must not be displayed as Active Growth.

---

## 4. Current implementation audit

### 4.1 Registration

Registration currently:

- Accepts and validates a requested plan.
- Stores `requestedPlan`.
- Creates the clinic in a pending state.
- Does not grant paid access based only on the submitted request.
- Leaves approval and credential creation to Super Admin.

The registration screen should use:

```text
Requested plan: Growth
```

It should not use:

```text
Current plan: Growth
```

### 4.2 Initial approval

The current approval route is:

```text
PATCH /api/clinics/:id/approve
```

The current screen supports Trial and paid plan selections, billing cycle,
custom Trial dates, grace dates, and an approval reason.

The target approval outcomes are:

1. Trial
2. Paid plan with online payment required
3. Paid plan activated after verified offline payment
4. Paid-level access granted as complimentary/sponsored
5. Rejection

### 4.3 Current paid-plan assignment gap

The current route is:

```text
POST /api/admin/clinics/:id/paid-plan
```

It currently:

- Validates the paid plan and billing cycle.
- Creates a provider subscription when configured.
- Creates an activation token.
- Writes a lifecycle record.
- Writes a plan assignment.
- Sets the clinic to `pending_payment`.
- Clears Trial dates.

The target behavior is different:

```text
currentAccessPlan = trial
assignedPlan = selected paid plan
accessState = trial
paymentStatus = pending
paymentBasis = provider
paidAccess = false
```

After confirmed payment:

```text
currentAccessPlan = assignedPlan
accessState = active_paid
paymentStatus = confirmed
paymentBasis = provider
paidAccess = true
```

The implementation must introduce a separate assignment/payment-intent
representation or extend the response contract so that the current Trial
state is not lost.

### 4.4 Trial lifecycle

The current Trial management route is:

```text
POST /api/admin/clinics/:id/trial
```

It supports starting and extending Trial through an audited operation. Trial
records include:

- Start date
- End date
- Grace end date
- Origin
- Reason
- Actor
- Transition ID
- Lifecycle event

Trial expiry recovery must remain idempotent.

### 4.5 Sponsored access and exceptions

Sponsored access and entitlement exceptions already exist as separate concepts.

Sponsored access:

- Grants temporary access at a selected paid-level plan.
- Has a start date and end date.
- Requires a reason.
- Can be revoked.
- Must not be reported as captured payment.

Entitlement exceptions:

- Override a capability or limit.
- Do not change the clinic's plan.
- Do not create a paid subscription.

### 4.6 Upgrade requests

The clinic can submit an upgrade request during active Trial or Trial grace:

```text
POST /api/auth/clinic/subscription/upgrade-requests
```

Super Admin reviews requests through:

```text
GET  /api/admin/clinic-upgrade-requests
POST /api/admin/clinic-upgrade-requests/:id/approve
POST /api/admin/clinic-upgrade-requests/:id/reject
```

The current approval route directly uses the provider-aware paid-plan
assignment flow. The target flow must allow the Super Admin to choose:

- Online payment required
- Verified offline payment
- Complimentary/sponsored access
- Rejection

### 4.7 Verified offline payment gap

The current implementation does not yet have a dedicated first-class verified
offline-payment record and approval flow.

It must not be implemented by:

- Fabricating a provider subscription ID.
- Fabricating a provider webhook event.
- Reusing a generic “Mark Paid” mutation.
- Treating `manual_override` alone as proof of payment.
- Treating sponsored access as payment.

---

## 5. Centralized approval decision table

Every approval entry point must use the same decision model.

| Decision | When to use | Access immediately after decision | Payment basis | Payment link | Renewal mode |
|---|---|---|---|---|---|
| Approve Trial | Clinic should evaluate before payment | Trial | None | None | Trial expiry/grace |
| Approve paid plan — online payment | Clinic must pay online | Trial remains active | Provider pending | Create, send, track | Provider auto-renewal after confirmation |
| Activate paid plan — verified offline payment | Money has been received outside provider | Active paid | Verified offline | Not required | Manual renewal |
| Grant paid-level access — complimentary | Clinic is intentionally given free access | Sponsored/complimentary | Waived | Not required | Admin review before end date |
| Reject | Clinic should not be approved | No active access | None | None | Not applicable |

The same outcomes must be available from:

1. New registration approval.
2. Upgrade-request approval.
3. Existing-clinic access management where a plan transition is permitted.

---

## 6. Super Admin Pending registration screen

### 6.1 Pending list

The Pending screen should show one card per pending clinic:

```text
Pending registrations

[Search] [Plan filter] [Registration date filter]

Smile Care Dental Clinic
Bengaluru · Clinic #1042
Requested plan: Growth
Requested cycle: Annual
Registered: 22 Sep 2026
Documents: Verified
Trust status: Clear

[Review registration]
```

The requested plan must be visually different from an active plan.

### 6.2 Registration review header

```text
Approve clinic registration

Smile Care Dental Clinic
Bengaluru · Clinic #1042
Registration status: Pending
Registered: 22 Sep 2026
```

### 6.3 Registration summary

| Field | Example |
|---|---|
| Clinic name | Smile Care Dental Clinic |
| Email | clinic@example.com |
| City | Bengaluru |
| Requested plan | Growth |
| Requested billing cycle | Annual |
| Registration date | 22 Sep 2026 |
| Documents | Verified / Needs review |
| Trust status | Clear / Review required |

### 6.4 Approval outcome selector

```text
Approval outcome

( ) Approve with Trial
( ) Approve paid plan — online payment required
( ) Activate paid plan — verified offline payment
( ) Grant paid-level access — complimentary/sponsored
( ) Reject registration
```

The selected outcome controls the remaining fields.

### 6.5 Online payment fields

```text
Approved plan: [Starter / Growth / Pro]
Billing cycle: [Monthly / Annual]
Payment provider: Razorpay
Payment link: Will be generated
Trial access: Continues until payment confirmation
Approval reason: [required]
```

Confirmation:

```text
This will approve Growth on an Annual cycle.

The clinic will remain on Trial access until online payment is confirmed.
A payment activation link will be generated and sent.
Paid access will not begin before provider confirmation.
```

### 6.6 Offline payment fields

```text
Approved plan: [Starter / Growth / Pro]
Billing cycle: [Monthly / Annual]
Amount received: [required]
Currency: INR
Payment date: [required]
Payment method: [Bank transfer / Cash / UPI / Other]
External receipt/reference: [required]
Evidence: [upload or evidence reference]
Verification: [confirmed by current operator]
Reason: [required]
Paid access starts: [date]
Paid access ends: [calculated]
```

Confirmation:

```text
This will activate Growth through a verified offline payment.
The payment evidence will be recorded.
No online provider subscription will be created.
Renewal will be manual after this paid period.
```

### 6.7 Complimentary/sponsored fields

```text
Access plan: [Starter / Growth / Pro]
Start date: [required]
End date: [required]
Reason: [required]
Sponsor/internal reference: [optional]
Payment status: Waived
Renewal mode: Super Admin review
```

Confirmation:

```text
This will grant complimentary Growth access until 22 Dec 2026.
No payment will be recorded.
This access will not renew automatically.
```

### 6.8 Rejection fields

```text
Rejection reason: [required]
```

Confirmation:

```text
This will reject the clinic registration.
The clinic will not receive active access.
```

### 6.9 Approval result

After approval, show a clear result card:

| Outcome | Result |
|---|---|
| Trial | Trial active, Trial and grace dates |
| Online payment | Trial active, assigned plan, payment pending, link status |
| Offline payment | Active paid, verified offline, paid dates, renewal mode |
| Complimentary | Sponsored access, waived payment, access end date |
| Rejected | Rejected, reason, actor, timestamp |

---

## 7. Super Admin Requests screen

The Requests screen is for clinics that already exist and submitted an upgrade
request.

### 7.1 Request list

Each request card should show:

```text
Smile Care Dental Clinic
Request status: Pending
Current access: Trial active
Current plan: Trial
Requested plan: Growth
Requested cycle: Annual
Submitted: 22 Sep 2026
Trial ends: 29 Sep 2026
Clinic note: We need additional doctors and analytics.

[Approve] [Reject]
```

The screen should retain:

- Pending tab
- All history tab
- Pending count
- Refresh action
- Request age
- Clinic reason
- Review reason after approval or rejection

### 7.2 Upgrade approval dialog

```text
Upgrade request review

Clinic: Smile Care Dental Clinic
Current access: Trial active
Requested plan: Growth
Requested cycle: Annual
Trial ends: 29 Sep 2026
```

Decision:

```text
( ) Approve with online payment
( ) Approve after verified offline payment
( ) Grant complimentary/sponsored access
( ) Reject request
```

The dialog should show requested and approved values separately:

```text
Requested plan: Growth
Approved plan: [Growth]
Requested cycle: Annual
Approved cycle: [Annual]
```

If the Super Admin changes either value, a reason is required.

### 7.3 Upgrade request: online payment

Result:

```text
requestStatus = approved
currentAccessPlan = trial
assignedPlan = growth
accessState = trial
paymentStatus = pending
paymentBasis = provider
paidAccess = false
```

The request screen should say:

```text
Request: Approved
Assigned plan: Growth
Payment: Pending
Current access: Trial
Payment link: Sent
Paid access: Not active
```

Clinic message:

```text
Your Growth upgrade request was approved.
You remain on Trial access until online payment is confirmed.
Complete the payment link to activate Growth.
```

### 7.4 Upgrade request: offline payment

The approval dialog expands to collect the offline payment record and evidence.
After verification:

```text
requestStatus = approved
approvalOutcome = verified_offline_payment
accessState = active_paid
paymentStatus = verified_offline
paymentBasis = offline_verified
renewalMode = manual
```

### 7.5 Upgrade request: complimentary access

The approval dialog requires:

- Access plan
- Start date
- End date
- Reason
- Optional internal reference

Result:

```text
requestStatus = approved
approvalOutcome = complimentary
accessState = sponsored
paymentStatus = waived
paymentBasis = complimentary
renewalMode = admin_review
```

### 7.6 Upgrade request: rejection

Rejection requires a reason. The clinic's current Trial or grace state remains
unchanged unless a separate lifecycle operation changes it.

---

## 8. Clinics & Access workspace plan

### 8.1 Purpose

The Clinics & Access workspace is the Super Admin operating view for every
clinic. It must answer at a glance:

1. What plan is this clinic using now?
2. Is the access Trial, paid, sponsored, expired, or in an attention state?
3. How was the latest plan/access approved?
4. Was payment online, offline, waived, or not required?
5. Who approved or verified it?
6. When does access end or renew?
7. What action is required next?
8. Is there an outstanding payment, renewal, or reconciliation problem?

The existing workspace currently shows effective plan, subscription status,
billing cycle, timing, policy version, and account status. It should add the
approval/payment basis and latest approval details as first-class information.

### 8.2 Clinic directory row

Each clinic row should show these compact columns:

| Column | Example |
|---|---|
| Clinic | Smile Care Dental Clinic |
| Account status | Active / Pending / Archived |
| Current access | Trial / Active paid / Sponsored / Expired |
| Current plan | Trial / Starter / Growth / Pro |
| Latest approved plan | Growth |
| Approval basis | Online payment / Offline verified / Complimentary / Trial |
| Payment status | Not required / Pending / Confirmed / Waived / Attention |
| Renewal mode | Trial expiry / Provider auto / Manual / Admin review |
| Next important date | Trial ends / Payment link expires / Paid access ends |
| Attention | None / Payment pending / Renewal due / Reconciliation |
| Latest approval | Date and operator |

Recommended row:

```text
Smile Care Dental Clinic
Active · Clinic #1042

Current access: Trial
Current plan: Trial
Assigned plan: Growth
Approval basis: Online payment required
Payment: Pending
Renewal: Provider auto after payment
Next date: Trial ends 29 Sep 2026
Attention: Payment activation pending

Latest approval: 22 Sep 2026 · Admin name
```

### 8.3 Directory filters

The directory should support filters for:

#### Current access

- All
- Pending approval
- Trial active
- Trial grace
- Active paid
- Sponsored/complimentary
- Past due/payment attention
- Expired
- Cancelled
- Unknown/reconciliation required

#### Current plan

- Trial
- Starter
- Growth
- Pro

#### Latest approval/payment basis

- Trial approval
- Online payment pending
- Provider-paid
- Verified offline payment
- Complimentary/sponsored
- Entitlement exception only
- Legacy/unknown basis

#### Renewal mode

- Trial expiry
- Provider auto-renewal
- Manual/offline renewal
- Admin review
- No renewal date

#### Attention

- Payment link expired
- Provider confirmation missing
- Renewal due soon
- Renewal failed
- Offline evidence pending
- Offline payment reversed
- Complimentary access expiring
- Conflicting or unknown state

### 8.4 Directory sorting

Recommended default sort:

1. Clinics requiring attention.
2. Pending registrations.
3. Payment activation pending.
4. Renewals due soon.
5. Complimentary access nearing expiry.
6. Recently approved clinics.
7. Remaining active clinics.

Additional sort options:

- Latest approval date
- Trial expiry date
- Paid access expiry date
- Renewal date
- Plan
- Clinic name

### 8.5 Clinic detail header

When a clinic is selected, show a summary header before detailed controls:

```text
Smile Care Dental Clinic
Clinic #1042 · Bengaluru · Active

Current access
Trial active

Current plan
Trial

Assigned plan
Growth · Annual

Latest approval
Online payment required

Payment
Pending · Link sent

Renewal
Provider auto after payment

Next action
Wait for payment or resend activation link
```

### 8.6 Current status card

The first card should be labelled `Current access`, not only `Effective plan`.

It should show:

- Access state
- Current access plan
- Payment basis
- Payment status
- Assigned plan, when different
- Next action
- Attention badge

Examples:

#### Trial with online payment pending

```text
Current access: Trial active
Assigned plan: Growth
Approval basis: Online payment required
Payment: Pending
Paid access: No
```

#### Online paid

```text
Current access: Active paid
Current plan: Growth
Approval basis: Online payment
Payment: Confirmed
Renewal: Provider auto
```

#### Offline paid

```text
Current access: Active paid
Current plan: Growth
Approval basis: Verified offline payment
Payment: Verified
Renewal: Manual
```

#### Complimentary

```text
Current access: Sponsored access
Plan level: Pro
Approval basis: Complimentary
Payment: Waived
Renewal: Admin review
Ends: 22 Dec 2026
```

### 8.7 Latest approval card

Each selected clinic should have a dedicated `Latest approval` card:

| Field | Example |
|---|---|
| Approval outcome | Paid plan — online payment |
| Approved plan | Growth |
| Billing cycle | Annual |
| Approval basis | Provider payment required |
| Approved by | superadmin@example.com |
| Approved at | 22 Sep 2026, 10:30 AM |
| Reason | Approved after document review |
| Transition ID | Recorded, copy available |
| Previous state | Trial |
| Resulting state | Trial with payment pending |

For offline payment:

| Field | Example |
|---|---|
| Approval outcome | Paid plan — verified offline |
| Payment amount | ₹15,990 |
| Currency | INR |
| Payment method | Bank transfer |
| External reference | UTR-20260922-1042 |
| Evidence | Available |
| Verified by | superadmin@example.com |
| Verified at | 22 Sep 2026, 10:45 AM |
| Renewal mode | Manual |

For complimentary access:

| Field | Example |
|---|---|
| Approval outcome | Paid-level access — complimentary |
| Plan level | Pro |
| Payment | Waived |
| Reason | Strategic partner clinic |
| Start date | 22 Sep 2026 |
| End date | 22 Dec 2026 |
| Approved by | superadmin@example.com |
| Renewal mode | Admin review |

### 8.8 Important dates card

Show only dates relevant to the clinic's current state:

- Trial ends
- Trial grace ends
- Payment link expires
- Paid access starts
- Paid access ends
- Next provider renewal
- Next manual renewal
- Sponsored access ends
- Offline evidence review due

The date label must explain the action:

```text
Trial ends
Payment link expires
Paid access ends
Manual renewal due
Sponsored access ends
```

Avoid a generic `Plan timing` label where possible.

### 8.9 Action controls

Actions must depend on the current state.

| Current state | Allowed actions |
|---|---|
| Pending registration | Review and approve, reject |
| Trial active | Extend Trial, review upgrade request, approve payment path |
| Trial with payment pending | Resend link, inspect provider status, extend Trial, cancel activation |
| Trial grace | Extend/review Trial, approve payment path, reconcile |
| Active provider-paid | View provider details, reconcile, provider-aware plan change |
| Active offline-paid | Record renewal, view evidence, record reversal/refund |
| Sponsored | Extend grant, convert to paid, revoke grant |
| Past due | Reconcile provider, review grace, contact clinic |
| Expired | Start recovery Trial if policy allows, approve payment path |
| Unknown | Reconciliation only; no blind activation |

The generic direct `Mark Paid` action must remain unavailable.

### 8.10 Audit trail

The audit trail should be filterable by:

- All
- Approval/lifecycle
- Plan assignment
- Payment
- Provider events
- Offline payment
- Sponsored access
- Entitlement exception
- Reversal/refund

Every entry should show:

- Event type
- Previous state
- New state
- Plan
- Payment basis
- Actor
- Reason
- Transition ID
- Effective date
- Created date
- Related payment/provider/grant record

---

## 9. Payment and renewal scenarios

### 9.1 Online payment

| Stage | Access | Payment | Next action |
|---|---|---|---|
| Link generated | Trial | Pending | Send link |
| Link sent | Trial | Pending | Wait for clinic |
| Link expired | Trial | Pending/expired link | Reissue only through audited action |
| Payment submitted | Trial | Awaiting confirmation | Wait for provider |
| Payment confirmed | Active paid | Confirmed | Start provider renewal |
| Renewal succeeds | Active paid | Confirmed | Extend paid expiry |
| Renewal fails | Past due/attention | Failed | Apply retry/grace policy |

### 9.2 Offline payment

| Stage | Access | Payment | Next action |
|---|---|---|---|
| Payment reported | Trial or review | Unverified | Collect evidence |
| Evidence submitted | Trial or review | Pending verification | Super Admin verifies |
| Verified | Active paid | Verified offline | Calculate manual renewal |
| Rejected | Previous state | Rejected | Do not activate |
| Reversed/refunded | Reconciliation/revoked | Reversed | Apply access policy |
| Renewal due | Attention | New payment required | Record and verify a new payment |

Required offline fields:

```text
clinicId
plan
billingCycle
amount
currency
receivedAt
paymentMethod
externalReference
evidenceReference
verificationStatus
verifiedBy
verifiedAt
reason
reversalStatus
```

### 9.3 Complimentary access

| Stage | Access | Payment | Next action |
|---|---|---|---|
| Grant created | Sponsored | Waived | Set end date |
| Grant active | Sponsored | Waived | Monitor expiry |
| Nearing expiry | Sponsored | Waived | Admin decides next outcome |
| Extended | Sponsored | Waived | New reason and end date |
| Converted to paid | Trial/review until confirmation or active after offline verification | Provider/offline | New payment transition |
| Expired | Expired/restricted | None | Apply expiry policy |

Complimentary access never auto-renews.

---

## 10. Renewal policy

### 10.1 Provider-paid renewal

- Provider is the source of truth for recurring payment attempts.
- Successful provider confirmation extends `paidAccessExpiresAt`.
- Duplicate provider events must be idempotent.
- Provider subscription existence alone is not proof of payment.
- Cancellation normally leaves access through the already-paid period.
- Failed renewal enters a documented past-due or grace state.

### 10.2 Offline-paid renewal

- Renewal mode is `manual`.
- The next renewal date is calculated from the verified payment date and cycle.
- Reminder notifications should be sent before expiry.
- Each renewal is a new verified payment record.
- Each renewal has a new receipt/reference and transition ID.
- Previous payment records remain immutable.
- No verified renewal means no indefinite active access.

### 10.3 Complimentary renewal

- Every grant has an end date.
- No automatic renewal.
- Super Admin must explicitly extend or convert the grant.
- Extension requires a new reason and end date.
- The clinic must be told whether the next period remains free or requires payment.

---

## 11. Edge-case decision table

| Edge case | Required decision |
|---|---|
| Requested Growth, approved Starter | Preserve the request and record an override reason |
| Requested paid plan, Trial approved | Preserve the request; no payment obligation until a paid outcome is selected |
| Link sent but not used | Keep Trial access |
| Link expires | Do not activate paid access; audited resend may be offered |
| Payment succeeds but webhook is delayed | Reconcile provider state; do not guess |
| Duplicate provider webhook | Process idempotently |
| Provider subscription created but no link returned | Do not tell clinic payment is ready |
| Provider creation fails | Leave clinic unchanged |
| Offline payment reported but unverified | Do not activate paid access |
| Duplicate offline reference | Block or reconcile; do not create two paid periods |
| Partial offline payment | Remain pending unless a specific partial-payment policy exists |
| Offline payment refunded | Record reversal and recalculate access |
| Complimentary grant without end date | Reject the grant |
| Complimentary access expires | Expire or explicitly extend |
| Active paid clinic submitted for initial approval again | Reject duplicate approval or use plan-change workflow |
| Sponsored clinic pays later | End/supersede grant and create a real payment transition |
| Trial expires while payment is pending | Apply Trial/grace policy; pending payment alone does not grant paid access |
| Payment confirms after Trial expiry | Activate only after confirmation, with reconciliation history |
| Monthly renewal falls in a short month | Use one documented calendar/provider rule |
| Annual renewal fails | Preserve access through paid expiry, then apply grace/expiry |
| Upgrade mid-cycle | Use separate proration/provider policy; do not overwrite original period |
| Downgrade mid-cycle | Schedule for renewal unless a documented immediate policy exists |
| Unknown status | Reconciliation required; no blind activation |
| Clinic archived | Stop future renewal and follow archive access policy |
| Operator correction required | Append a correction; do not edit original evidence |

---

## 12. Required audit and accounting rules

1. Never call a requested plan an active plan.
2. Never call an assigned paid plan active before payment confirmation or an authorized complimentary/offline outcome.
3. Never call pending payment paid.
4. Never treat complimentary access as captured revenue.
5. Never treat offline payment as a provider webhook.
6. Never fabricate provider IDs or events.
7. Never let frontend state determine access authorization.
8. Never approve a paid transition without a reason and actor.
9. Never overwrite lifecycle history when correcting a snapshot.
10. Every state change must have a unique transition ID.
11. Every offline payment must have verification evidence.
12. Every complimentary grant must have an end date.
13. Every paid period must have a renewal or expiry date.
14. Activation tokens must only be exposed to the activation flow.
15. Unknown or conflicting states must be sent to reconciliation.

---

## 13. Recommended data/API contract

The clinic-facing and Super Admin responses should expose separate objects:

```ts
type SubscriptionApprovalSummary = {
  requestedPlan: PlanKey | null;
  assignedPlan: PaidPlanKey | null;
  currentAccessPlan: PlanKey | null;
  accessState:
    | "pending_approval"
    | "trial"
    | "trial_grace"
    | "active_paid"
    | "sponsored"
    | "expired"
    | "cancelled"
    | "unknown";
  paymentStatus:
    | "not_required"
    | "pending"
    | "confirmed"
    | "verified_offline"
    | "waived"
    | "failed"
    | "reversed";
  paymentBasis:
    | "none"
    | "provider"
    | "offline_verified"
    | "complimentary";
  renewalMode:
    | "trial_expiry"
    | "provider_auto"
    | "manual"
    | "admin_review";
  billingCycle: "monthly" | "annual" | null;
  latestApproval: {
    outcome: string;
    approvedAt: string | null;
    approvedBy: string | null;
    reason: string | null;
    transitionId: string | null;
  };
  dates: {
    trialEndsAt: string | null;
    trialGraceEndsAt: string | null;
    paymentLinkExpiresAt: string | null;
    paidAccessStartsAt: string | null;
    paidAccessExpiresAt: string | null;
    nextRenewalAt: string | null;
    sponsoredAccessEndsAt: string | null;
  };
  nextAction: string;
};
```

The existing clinic snapshot fields can remain for compatibility, but new
workflow logic must not infer all of these dimensions from `plan` or
`subscriptionStatus` alone.

---

## 14. Implementation plan

### Phase 1: Shared approval model

- Define the shared approval outcomes.
- Define access state, payment status, payment basis, and renewal mode.
- Use the same vocabulary for registration, upgrade requests, and Clinics &
  Access.
- Preserve requested plan separately from assigned plan.

### Phase 2: Registration approval screen

- Add the five explicit approval outcomes.
- Add conditional fields for online, offline, and complimentary outcomes.
- Add confirmation summaries.
- Show payment-link preparation status.
- Show exact resulting access state before confirmation.

### Phase 3: Correct online payment behavior

- Keep Trial access active while payment is pending.
- Store the assigned paid plan separately.
- Track link generation, sending, expiry, and resend.
- Activate paid access only after provider confirmation.
- Reconcile delayed and duplicate provider events.

### Phase 4: Verified offline payment

- Add an offline payment record.
- Add evidence and verification UI.
- Add external receipt/reference validation.
- Add verification and reversal statuses.
- Add a dedicated audited transition.
- Never create provider identifiers for offline payments.

### Phase 5: Complimentary access outcome

- Add complimentary access as an explicit approval choice.
- Require reason, actor, start date, and end date.
- Mark payment as waived.
- Keep access separate from revenue and provider billing.
- Add expiry and extension actions.

### Phase 6: Upgrade-request approval

- Update the Requests approval dialog to use the same outcomes.
- Show requested versus approved plan/cycle.
- Require a reason for overrides.
- Route online, offline, and complimentary outcomes to separate workflows.
- Keep rejected requests unchanged in their current access state.

### Phase 7: Clinics & Access directory

- Add current access state and current access plan.
- Add assigned/latest approved plan.
- Add latest approval outcome.
- Add payment basis and payment status.
- Add renewal mode and next important date.
- Add attention badges and filters.
- Add latest approval and evidence cards to the clinic detail view.

### Phase 8: Renewal operations

- Provider renewal reconciliation.
- Offline renewal reminders.
- Complimentary expiry reminders.
- Past-due and grace handling.
- Refund/reversal handling.
- Unknown-state reconciliation queue.

### Phase 9: Communication and testing

- Align Settings, dashboard banners, emails, and Super Admin labels.
- Add tests for each approval outcome.
- Add idempotency tests for provider and manual transitions.
- Add state-matrix tests for every edge case.
- Run the Build Check workflow after frontend implementation.

---

## 15. Super Admin approval checklist

Before final approval, Super Admin must confirm:

- Clinic identity and documents are acceptable.
- Requested plan and approved plan are shown separately.
- Approval basis is selected.
- Billing cycle is selected for paid plans.
- Trial dates are correct when Trial is involved.
- Payment link is actually available before telling the clinic to pay.
- Offline payment evidence is verified before activating paid access.
- Complimentary access has a reason and end date.
- Renewal mode is visible.
- Next renewal or expiry date is visible.
- Notification wording matches the selected outcome.
- A unique transition ID and audit record will be created.

The confirmation message must make the commercial result explicit:

```text
This will approve Growth, keep the clinic on Trial, and send an online payment link.
Paid access will start only after provider confirmation.
```

```text
This will activate Growth through a verified offline payment.
Record and verify the payment evidence before confirming.
```

```text
This will grant complimentary Growth access until [date].
No payment will be recorded and the grant will not auto-renew.
```

---

## 16. Acceptance criteria

### Registration approval

- Requested and approved plans are displayed separately.
- Super Admin can choose Trial, online payment, verified offline payment,
  complimentary access, or reject.
- Online paid approval keeps Trial access until provider confirmation.
- Offline approval requires evidence and verification.
- Complimentary approval requires an end date and reason.
- Every outcome writes an actor, reason, transition ID, and audit event.

### Upgrade requests

- Pending upgrade requests are visible in the Requests tab.
- Current access and requested plan are visible in every request card.
- Approval supports online payment, verified offline payment, complimentary
  access, and rejection.
- Plan or billing-cycle overrides require a reason.
- Rejection leaves the clinic's existing access state unchanged.

### Clinics & Access

- Every clinic row shows current access state.
- Every clinic row shows current access plan.
- Every clinic row shows assigned/latest approved plan.
- Every clinic row shows the latest approval/payment basis.
- Every clinic row shows payment status.
- Every clinic row shows renewal mode.
- Every clinic row shows the next important date.
- Attention states are filterable.
- Selected clinic details show the full latest approval record.
- Offline evidence and complimentary grant details are available to authorized
  Super Admin operators.

### Renewal

- Provider renewals extend access only after confirmed provider events.
- Offline renewals require a new verified payment.
- Complimentary access never renews automatically.
- Missed renewals enter a documented grace or expired state.
- Refunds and reversals are recorded without deleting history.

---

## 17. Related documents and implementation references

- `docs/TODO/14-super-admin-platform-operations-blueprint.md`
- `docs/TODO/15-messaging-allowance-and-plan-policy-blueprint.md`
- `docs/TODO/16-four-plan-subscription-and-entitlement-blueprint.md`
- `docs/TODO/18-clinic-registration-and-plan-suggestion.md`
- `docs/features/subscription/README.md`
- `docs/features/payment-and-subscription-guide.md`
- `shared/plan-catalog.ts`
- `shared/subscription-status.ts`
- `shared/schema.ts`
- `server/routes.ts`
- `client/src/pages/Admin.tsx`
- `client/src/components/AdminEntitlementReview.tsx`
- `client/src/components/AdminClinicUpgradeRequests.tsx`