# Clinic Settings, Subscription Upgrade, and Super Admin Approval Workflow

**Status:** Detailed product and implementation plan  
**Scope:** Clinic-facing Settings, clinic registration approval, Trial lifecycle, paid-plan assignment, payment-link delivery, complimentary access, verified offline payment, and audit history  
**Audience:** Product owner, frontend engineers, backend engineers, Super Admin operations, billing operators, and QA

## 1. Purpose

The clinic-facing Settings page must clearly communicate the clinic's actual access state. It must not present a requested or assigned paid plan as an active paid subscription when payment has not been confirmed.

The platform has several valid subscription situations:

1. A newly approved clinic is using Trial access.
2. A paid plan has been selected or assigned, but provider payment is still pending.
3. A Super Admin grants complimentary or sponsored access without payment.
4. A payment is received outside the provider and verified by an authorized operator.
5. A provider confirms an online payment and the paid plan becomes active.
6. A paid subscription later expires and the clinic enters a controlled recovery Trial.
7. An upgrade request is submitted by a clinic and is waiting for Super Admin review.

These situations must be represented separately in the database, server response, audit trail, and UI.

The central rule is:

> A clinic must only be shown as having an active paid plan when the platform has a valid paid-access basis: provider confirmation, a verified manual/offline payment, or an explicitly documented complimentary/sponsored access grant.

An assigned plan, a requested plan, a generated payment link, or a pending payment is not by itself proof of active paid access.

---

## 2. Current implementation audit

### 2.1 Registration currently stores a request, not an active subscription

The clinic registration route:

- Verifies the registration email.
- Accepts `requestedPlan`.
- Preserves the legacy `plan` field only for compatibility.
- Stores the value as `clinics.requestedPlan`.
- Creates the clinic with `status = pending`.
- Does not trust client-supplied subscription fields such as `plan`, `subscriptionStatus`, trial dates, payment identifiers, or access expiry.
- Leaves username and password creation to approval.

Relevant implementation:

- `server/routes.ts` — `POST /api/clinics/register`
- `shared/clinic-registration.ts` — requested-plan validation
- `shared/schema.ts` — `clinics.requestedPlan`

The registration selection should therefore be displayed to Super Admin as:

```text
Clinic's requested plan
```

It should not be displayed to the clinic as:

```text
Current paid plan
```

### 2.2 Initial approval supports Trial and paid-plan approval

The initial approval route is:

```text
PATCH /api/clinics/:id/approve
```

The Super Admin approval screen allows:

- Trial
- Starter
- Growth
- Pro

It also allows:

- Monthly or annual billing cycle for paid plans
- Optional custom Trial dates
- Optional Trial grace period
- A reason when the approved plan differs from the requested plan

The current approval implementation intentionally supports two broad paths:

#### Trial approval

The clinic is approved with Trial access and receives Trial dates:

```text
plan = trial
subscriptionStatus = trialing
trialStartedAt = populated
trialEndsAt = populated
trialGraceEndsAt = populated
```

This is the normal access state when the clinic should use the platform before choosing or paying for a paid plan.

#### Paid-plan approval

The clinic may also be approved directly into a paid-plan activation workflow:

```text
plan = starter | growth | pro
subscriptionStatus = pending_payment
trialStartedAt = null
trialEndsAt = null
trialGraceEndsAt = null
paidAccessExpiresAt = null
```

This does not mean the clinic has active paid access. It means:

```text
The paid plan has been assigned and payment activation is pending.
```

The current route creates a provider subscription when a configured Razorpay plan mapping is available, creates a seven-day activation token, records an audited plan assignment and lifecycle event, and returns an activation URL when available.

Relevant implementation:

- `server/routes.ts` — `PATCH /api/clinics/:id/approve`
- `server/routes.ts` — `assignPaidPlanForAdmin`
- `client/src/pages/Admin.tsx` — initial approval dialog

### 2.3 Dedicated paid-plan assignment already exists

The dedicated route is:

```text
POST /api/admin/clinics/:id/paid-plan
```

It is available for clinics that do not already have an active paid plan. It:

- Validates the paid plan and billing cycle.
- Rejects replacement of an active paid plan through this path.
- Prepares a provider subscription when configured.
- Creates an activation token.
- Sets the clinic to `pending_payment`.
- Creates a plan-assignment record.
- Creates an append-only lifecycle event.
- Does not mark the clinic as paid before provider confirmation.

The existing broad direct “Mark Paid” action is intentionally disabled. That is correct and must remain disabled unless it is replaced by an auditable workflow.

Relevant implementation:

- `server/routes.ts` — `POST /api/admin/clinics/:id/paid-plan`
- `client/src/components/AdminEntitlementReview.tsx`

### 2.4 Trial lifecycle is already audited

Super Admin can start or extend a Trial through:

```text
POST /api/admin/clinics/:id/trial
```

The Trial lifecycle includes:

- Start or extend action
- Required reason
- Optional transition ID
- Trial start date
- Trial end date
- Grace end date
- Append-only assignment record
- Append-only lifecycle event

Expired Trial recovery is idempotent and must remain idempotent. Trial expiry must not create duplicate transitions or repeatedly rewrite the clinic state.

Relevant implementation:

- `server/routes.ts` — `POST /api/admin/clinics/:id/trial`
- `shared/trial-lifecycle.ts`
- `shared/effective-entitlement.ts`

### 2.5 Sponsored access and entitlement exceptions are separate concepts

The Super Admin entitlement review supports:

- Sponsored access
- Entitlement exceptions

Sponsored access is temporary access granted separately from paid provider billing. It should not be represented as a successful payment.

An entitlement exception changes a particular capability or limit. It should not be represented as a plan change.

Relevant implementation:

- `subscriptionAccessGrants`
- `subscriptionAccessExceptions`
- `AdminEntitlementReview`

### 2.6 Upgrade requests already exist, but are not fully integrated into Settings

Clinic upgrade requests use:

```text
POST /api/auth/clinic/subscription/upgrade-requests
GET  /api/auth/clinic/subscription/upgrade-request
```

The existing request workflow supports:

- Paid plan selection
- Monthly or annual cycle
- Optional clinic reason
- One pending request per clinic
- Pending, approved, rejected, and cancelled states
- Super Admin approval or rejection
- Review reason

The clinic-facing request UI currently lives in `ClinicTrialBanner`, while the Plan & access panel mainly shows comparison and navigation actions. The request flow should be reused inside Plan & access instead of remaining a separate dashboard-level experience.

### 2.7 Verified offline payment is currently a gap

The current code has:

- Provider-aware paid-plan assignment
- Pending-payment state
- Sponsored access
- Entitlement exceptions
- Append-only subscription history

It does not yet have a dedicated first-class verified offline payment record and workflow.

An offline payment must not be implemented by:

- Faking a Razorpay subscription ID
- Marking a provider webhook as received when it was not
- Reusing a generic “Mark Paid” mutation
- Using `manual_override` without recording the payment evidence
- Treating a complimentary grant as payment

Offline payment requires a separate auditable record and a controlled state transition.

---

## 3. Required subscription vocabulary

The following terms must remain distinct in code and UI.

| Term | Meaning | Is it active paid access? |
|---|---|---:|
| Requested plan | Plan selected during registration or requested in an upgrade | No |
| Assigned plan | Plan selected by an authorized Super Admin | Not by itself |
| Effective entitlement plan | Plan whose policy is used to calculate capabilities | Not by itself |
| Trial access | Temporary catalog-defined access | No |
| Pending payment | Paid plan assigned, activation not confirmed | No |
| Active paid | Provider-confirmed or verified manual paid access | Yes |
| Sponsored access | Complimentary access grant with dates | Access yes, payment no |
| Entitlement exception | Temporary capability override | Only within the exception scope |
| Trial grace | Temporary access after Trial end before cutoff | No |
| Expired | Access window ended or subscription expired | No |

The UI must not use “Current plan” as a generic label for all of these states.

Recommended labels:

- `Current access`
- `Requested plan`
- `Assigned paid plan`
- `Active paid plan`
- `Payment status`
- `Access expiry`
- `Trial ends`

---

## 4. Target clinic-facing Settings design

### 4.1 Plan & access must contain clinic-specific subscription information only

The Plan & access section should answer:

1. What access does this clinic have right now?
2. Is the clinic in Trial, waiting for payment, active on a paid plan, sponsored, or blocked?
3. What plan was requested or assigned?
4. What date or action matters next?
5. Can the clinic request an upgrade or complete activation?
6. Is there an existing request waiting for review?

It should not be the primary place for platform telemetry.

### 4.2 Information to remove from the primary Plan & access view

Move the following to Usage & quotas or an internal Super Admin view:

- Policy version
- “Reporting only”
- Last measured timestamp
- Measurement timezone
- Full capability usage grid
- Raw entitlement source
- Internal reason codes
- Exception counts unless they directly affect clinic action

These fields may be useful for diagnostics but distract from the clinic’s subscription status.

### 4.3 Trial state

Primary card:

```text
Current access
Trial access
Trial active
```

Supporting information:

- Trial started
- Trial ends
- Grace period ends
- Days remaining
- Requested plan, only when useful
- Whether a paid plan is currently active: No

Primary action:

```text
Request upgrade
```

Secondary action:

```text
Compare plans
```

Recommended explanatory copy:

```text
Your clinic is currently using Trial access. A paid plan is not active yet. Request an upgrade before the Trial or grace period ends to continue with paid access.
```

### 4.4 Trial grace state

Primary card:

```text
Current access
Trial grace period
Action needed
```

Show:

- Trial end date
- Grace end date
- Remaining grace days
- Whether a request is already pending

Primary action:

```text
Request upgrade
```

Recommended copy:

```text
Your Trial has ended, but access remains available until the grace period ends. Request a paid plan before [date].
```

### 4.5 Pending-payment state

Primary card:

```text
Current access
Paid plan awaiting payment
Payment pending
```

Supporting information:

- Assigned paid plan
- Billing cycle
- Payment status
- Activation-link status
- Activation-link expiry, if exposed safely
- Whether the provider subscription was created
- Whether paid access has started: No

Recommended copy:

```text
[Plan] has been assigned for your clinic, but paid access is not active yet. Complete the activation payment and wait for confirmation before relying on paid-plan limits.
```

Actions:

- `Complete activation` when a valid activation flow is available
- `Contact support` when the link is missing, expired, or provider setup is unavailable
- Do not show `Request upgrade` as though a second upgrade request is allowed

The activation token itself should not be exposed in a general reporting endpoint unless the security model explicitly permits it. Prefer a short-lived signed activation route or a safe “check your email” status with support recovery.

### 4.6 Active paid state

Primary card:

```text
Current access
Starter
Active paid
```

Supporting information:

- Paid plan
- Monthly or annual billing cycle
- Provider or verified-manual payment basis, where appropriate
- Renewal date or paid-access expiry
- Last successful activation date

Recommended copy:

```text
Your clinic has active paid access. Your current allowance is based on the Starter plan.
```

Actions:

- Compare plans
- Request a paid-plan change only when the backend workflow supports it
- Contact support for billing issues

The current Trial-only upgrade request endpoint must not be presented as a general paid-plan change endpoint for active paid clinics.

### 4.7 Sponsored or complimentary state

Primary card:

```text
Current access
Sponsored access
```

Supporting information:

- Sponsored plan or entitlement level
- Start date
- End date
- Whether payment is required after the grant ends
- Access sponsor or internal reference when safe to show

Recommended copy:

```text
Your clinic has temporary sponsored access. This is not a paid subscription. Access is available until [date].
```

Sponsored access must remain separate from captured revenue and paid provider status.

### 4.8 Verified offline payment state

Primary card:

```text
Current access
[Plan]
Active through verified offline payment
```

Supporting information:

- Plan
- Billing cycle
- Payment received date
- Payment method
- External receipt or reference number
- Paid access start and end dates
- Verification status
- Whether the record was verified by a Super Admin or delegated billing operator

The clinic does not necessarily need to see sensitive payment evidence, but it should see an accurate status:

```text
Your paid access was activated after an offline payment was verified.
```

The Super Admin audit view must show the full evidence and verification record.

### 4.9 Expired, cancelled, or unknown state

The page should not show a stale paid plan as if it is active.

Show:

- Current access: Expired, Cancelled, or Unavailable
- Last known plan
- Last access expiry
- Reason or next step
- Contact support

If a recovery Trial is active after a paid subscription expires, the primary state must be Recovery Trial, not the old paid plan.

---

## 5. Clinic upgrade request workflow

### 5.1 Eligibility

The current request policy allows upgrade requests during:

- Active Trial
- Trial grace period

The request endpoint must continue to enforce eligibility server-side. The UI may hide the action for ineligible states, but hiding is not authorization.

### 5.2 Request form

The clinic-facing form should contain:

- Requested paid plan: Starter, Growth, or Pro
- Billing cycle: Monthly or Annual
- Optional clinic reason
- Clear explanation that the request is reviewed by Super Admin

Recommended explanation:

```text
Submitting this request does not activate a paid plan immediately. A Super Admin will review it. If approved, payment activation instructions will be provided or an authorized operator will record the selected payment basis.
```

### 5.3 Pending request

When a request is pending, replace the request button with:

```text
Upgrade request under review
Requested plan: Growth
Billing cycle: Monthly
Submitted: [date]
```

Do not allow multiple pending requests. The existing unique pending-clinic constraint should remain authoritative.

### 5.4 Approved request

Approval should not silently imply that payment is complete.

The clinic should see one of:

```text
Upgrade approved — payment activation required
```

or:

```text
Upgrade approved — active paid access
```

depending on the payment basis chosen by Super Admin.

### 5.5 Rejected request

Show:

- Rejected status
- Review reason
- Date reviewed
- Option to submit a new request if Trial/grace eligibility remains

### 5.6 Request approval outcomes

An upgrade request may result in:

1. Provider payment activation required
2. Complimentary/sponsored access
3. Verified offline payment activation
4. Rejection
5. A plan or billing-cycle override with an explanation

Each outcome must use a distinct workflow and audit record.

---

## 6. Super Admin registration approval workflow

### 6.1 Step 1: Registration arrives

The system stores:

- Clinic information
- Registration documents
- Requested plan
- Registration timestamp
- Trust score
- Pending clinic status

No paid access is granted at this point.

Super Admin sees:

```text
Requested plan: Growth
```

not:

```text
Current plan: Growth
```

### 6.2 Step 2: Super Admin reviews the clinic

Review should include:

- Clinic identity
- Contact information
- Registration documents
- Requested plan
- Any trust or verification flags
- Existing subscription history, if this is a returning clinic
- Whether the clinic already has an active paid state

The approval action must be protected against stale state. Only pending clinics can be approved through the initial approval route.

### 6.3 Step 3: Super Admin chooses an approval basis

The approval dialog should make the commercial/access outcome explicit.

Recommended options:

#### Option A: Approve with Trial

Use when the clinic should start or continue a Trial.

Required:

- Trial start date
- Trial end date
- Grace period
- Reason for custom dates, when applicable

Result:

```text
plan = trial
subscriptionStatus = trialing
trial dates = active
paid access = false
```

Clinic communication:

```text
Your clinic has been approved and Trial access is active.
```

#### Option B: Assign paid plan — payment required

Use when the clinic should receive a paid plan but has not paid yet.

Required:

- Paid plan
- Billing cycle
- Approval reason
- Provider/payment-link basis

Result:

```text
plan = selected paid plan
subscriptionStatus = pending_payment
paid access = false
activation workflow = pending
```

The system must:

1. Create a provider subscription when configured.
2. Create a short-lived activation token.
3. Store provider and transition references.
4. Record a plan assignment.
5. Record a lifecycle event.
6. Send credentials and payment activation instructions.
7. Tell Super Admin whether an activation URL was actually generated.
8. Show the clinic “Paid plan awaiting payment,” not “Active paid.”

If provider setup is missing, the system must not imply that an online payment link exists. The result should clearly say:

```text
The paid plan was assigned, but payment activation could not be prepared. Contact the clinic or configure the payment provider before treating this as payable.
```

#### Option C: Grant complimentary or sponsored access

Use when the clinic is allowed to use a paid-level plan without payment.

Required:

- Sponsored plan or access level
- Start date
- End date
- Reason
- Authorized operator
- Optional internal reference

Result:

```text
subscriptionStatus = manual_override or a dedicated sponsored state
sponsored access grant = active
paid provider payment = none
captured revenue = none
```

The preferred long-term model is to keep sponsored access in the access-grant table and not pretend that it is a provider-paid subscription.

Clinic communication:

```text
Your clinic has temporary sponsored access until [date]. This is not a paid subscription.
```

#### Option D: Activate after verified offline payment

Use when payment was received outside the online provider.

Required:

- Plan
- Billing cycle
- Amount
- Currency
- Payment received date
- Payment method
- External receipt or transaction reference
- Evidence attachment or reference, where policy requires it
- Verification status
- Verifying operator
- Reason
- Access start and end or renewal terms

Result:

```text
plan = selected paid plan
subscriptionStatus = active or a separately named verified-manual state
paid access = true
provider subscription ID = null unless one genuinely exists
manual payment record = verified
```

The system must not fabricate:

- Razorpay subscription IDs
- Provider event IDs
- Provider webhook events
- Online payment confirmation

Clinic communication:

```text
Your paid access was activated after an offline payment was verified.
```

#### Option E: Reject registration

Use when the clinic cannot be approved.

Required:

- Rejection reason
- Actor
- Timestamp

The clinic must not receive active access.

### 6.4 Step 4: Approval result and notification

The Super Admin result must state the exact commercial outcome:

| Outcome | Admin result message |
|---|---|
| Trial | Clinic approved. Trial access is active. |
| Provider payment pending | Paid plan assigned. Payment activation is pending. |
| Provider setup unavailable | Paid plan not payable yet. Provider activation was not prepared. |
| Sponsored | Sponsored access granted until [date]. |
| Offline verified | Paid access activated after offline payment verification. |
| Rejected | Clinic registration rejected. |

The clinic email must use the same terminology as the Settings page.

### 6.5 Step 5: Append-only history

Every approval outcome must create a history record containing:

- Clinic ID
- Transition ID
- From plan
- To plan
- From status
- To status
- Policy version
- Actor type
- Actor ID
- Reason
- Payment basis
- Provider reference, if any
- Manual payment reference, if any
- Grant or exception reference, if any
- Effective timestamp

Current snapshot fields on `clinics` are useful for fast reads, but they must not replace lifecycle history.

---

## 7. Payment-link and activation rules

### 7.1 Provider payment

For a provider-backed assignment:

1. Validate the plan and billing cycle.
2. Create the provider subscription.
3. Store the provider subscription ID.
4. Store the activation token with expiry.
5. Set `subscriptionStatus = pending_payment`.
6. Send the activation link through the approved communication channel.
7. Wait for provider confirmation.
8. On confirmed provider activation, set the paid subscription active.
9. Set paid access expiry from provider data.
10. Record the provider event and lifecycle transition.

### 7.2 Activation link expiry

The clinic-facing Settings page should show an actionable recovery path when the activation token has expired:

```text
Your payment link has expired. Contact support to request a new activation link.
```

The system should not expose expired or reusable tokens in a general Settings API.

### 7.3 Provider confirmation

Provider webhooks must be idempotent. Replayed provider events must not:

- Create duplicate lifecycle transitions
- Extend paid access twice
- Create duplicate assignments
- Convert an already active clinic incorrectly

### 7.4 Offline payment

Offline payment must have a dedicated mutation and record. The minimum record should include:

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

The payment record and subscription transition must be created transactionally or reconciled through a durable transition process.

### 7.5 Complimentary access

Complimentary access must be time-bounded and separately reported:

- It is not captured revenue.
- It is not an offline payment.
- It is not a provider subscription.
- It must have a reason and end date.
- It must be revocable through an audited action.

---

## 8. Recommended Settings response contract

The current entitlement report is useful for capability calculation, but it should not be the only clinic-facing subscription contract.

The clinic-facing Settings response should expose distinct fields similar to:

```ts
type ClinicSubscriptionSettings = {
  access: {
    state:
      | "trial"
      | "trial_grace"
      | "pending_payment"
      | "active_paid"
      | "sponsored"
      | "verified_offline"
      | "expired"
      | "cancelled"
      | "unknown";
    label: string;
    description: string;
    nextAction: "request_upgrade" | "complete_payment" | "contact_support" | "none";
  };
  registration: {
    requestedPlan: PlanKey | null;
    requestedAt: string | null;
  };
  assigned: {
    plan: PlanKey | null;
    billingCycle: "monthly" | "annual" | null;
    assignedAt: string | null;
    assignedByType: string | null;
  };
  paid: {
    active: boolean;
    plan: PlanKey | null;
    billingCycle: "monthly" | "annual" | null;
    basis: "provider" | "verified_offline" | null;
    startsAt: string | null;
    expiresAt: string | null;
  };
  trial: {
    startedAt: string | null;
    endsAt: string | null;
    graceEndsAt: string | null;
    previousPaidPlan: PlanKey | null;
  };
  payment: {
    status: "not_required" | "pending" | "confirmed" | "verified_offline" | "not_available";
    activationAvailable: boolean;
    activationExpiresAt: string | null;
  };
  upgradeRequest: {
    status: "none" | "pending" | "approved" | "rejected" | "cancelled";
    requestedPlan: PlanKey | null;
    billingCycle: "monthly" | "annual" | null;
    requestedAt: string | null;
    reviewedAt: string | null;
    reviewReason: string | null;
  };
};
```

The effective entitlement report can remain available for Usage & quotas, but its `plan` object must not be treated as the clinic's payment status.

---

## 9. State precedence rules

The server should calculate the displayed clinic state using explicit precedence, not frontend inference.

Recommended precedence:

1. Active sponsored access, when it intentionally overrides the paid snapshot
2. Active verified offline paid access
3. Provider-confirmed active paid access
4. Active Trial
5. Trial grace period
6. Pending payment
7. Expired or cancelled
8. Unknown/reconciliation required

The exact ordering between sponsored access and active paid access must be explicit in policy. The important rule is that the response must identify both the access basis and the commercial status.

Do not determine access by checking only:

```ts
clinic.plan === "starter"
```

Do not determine paid status by checking only:

```ts
clinic.plan !== "trial"
```

Do not display a paid plan as active based only on:

```ts
subscriptionStatus === "pending_payment"
```

---

## 10. Settings page information architecture

### Plan & access

Clinic-specific subscription information only:

- Current access state
- Trial/payment/paid status
- Trial dates
- Paid plan and billing cycle when applicable
- Requested plan
- Payment basis
- Upgrade request status
- Next action

### Usage & quotas

Platform-calculated limits and clinic consumption:

- Bookings
- Active doctors
- Smile Deals
- Storage
- SMS
- WhatsApp
- Email
- Period
- Remaining amount
- Limit warnings
- Measurement freshness

### Messaging

Operational clinic communication usage:

- Channel totals
- Accepted/failed/skipped/billable distinction
- Period trend
- Event purpose breakdown

### Storage & files

Operational clinic storage:

- Allowance
- Used bytes
- Remaining bytes
- Tracked file count
- Exact scan status
- Untracked file review

### Doctor reminders

Clinic operational reminder actions:

- Digest preview
- Recipients
- Upcoming appointment counts
- Send status
- Manual send action

---

## 11. Acceptance criteria

### Clinic-facing Plan & access

- A Trial clinic sees “Trial access,” not “Starter,” “Growth,” or “Pro” as its primary current plan.
- A Trial clinic sees Trial and grace dates.
- A Trial clinic can submit an upgrade request from Plan & access.
- A clinic with a pending upgrade request sees its request status and cannot create a duplicate request.
- A pending-payment clinic sees “Paid plan awaiting payment.”
- A pending-payment clinic is never labelled “Active paid.”
- An active paid clinic sees its actual paid plan and billing cycle.
- A sponsored clinic sees sponsored access, not paid subscription.
- A verified offline-payment clinic sees active access with offline verification as the basis.
- An expired clinic does not see its old paid plan as active.
- Platform policy metadata is not prominent in the clinic-facing Plan & access section.
- Usage cards are not duplicated between Plan & access and Usage & quotas.

### Upgrade requests

- Trial and grace eligibility is enforced server-side.
- Paid active clinics cannot use the Trial-only endpoint as a general plan-change workflow.
- Pending, approved, rejected, and cancelled statuses are visible to the clinic.
- Review reasons are shown when appropriate.
- Approval does not imply payment confirmation.
- An approved request can proceed to provider payment, sponsored access, or verified offline payment through distinct workflows.

### Super Admin approval

- Requested plan and approved plan are shown separately.
- Plan overrides require a reason.
- Trial approval creates an audited Trial window.
- Paid approval with payment required creates pending payment, not active paid access.
- Provider subscription preparation failure leaves the clinic unchanged.
- Activation links are time-bounded and their expiry is visible to operators.
- Complimentary access has a reason and end date.
- Offline payment activation requires payment evidence and verification.
- Offline payment never fabricates provider identifiers or provider events.
- Every state change has a transition ID and append-only history.
- Repeated requests with the same transition ID are idempotent.

### Notifications

- Clinic email wording matches the Settings terminology.
- Trial email says Trial access.
- Pending-payment email says payment activation is required.
- Sponsored-access email says access is complimentary/sponsored.
- Offline-payment email says payment was verified offline.
- Active-paid email says paid access is active only after the correct confirmation.

---

## 12. Recommended implementation phases

### Phase 1: Correct the data contract

- Add explicit requested-plan data to the clinic entitlement/settings response.
- Expose billing cycle and assignment details.
- Expose payment basis and activation status.
- Expose upgrade request status.
- Stop using `plan.effective` as a synonym for active paid plan.

### Phase 2: Correct Plan & access UI

- Replace unconditional “Current plan” rendering with access-state-specific content.
- Move usage overview cards to Usage & quotas.
- Remove policy-version and reporting-only text from the primary clinic subscription card.
- Add state-specific actions.
- Integrate the existing upgrade request dialog.

### Phase 3: Consolidate global status messaging

- Reuse the same subscription status copy in the dashboard banner and Settings.
- Avoid showing two competing payment-pending messages.
- Route all upgrade actions to the same request flow.

### Phase 4: Add verified offline payment

- Add a dedicated payment record.
- Add Super Admin verification UI.
- Add evidence and external-reference fields.
- Add a dedicated audited transition.
- Add reversal handling.
- Add clinic-facing “verified offline” status.

### Phase 5: Provider and notification reconciliation

- Confirm provider activation event mapping.
- Confirm paid-access expiry mapping.
- Confirm activation-link expiry handling.
- Add idempotency tests for provider and manual transitions.
- Verify that notifications and Settings use the same state.

### Phase 6: History and reporting

- Add a clinic-facing concise status history if useful.
- Keep full lifecycle, provider, assignment, grant, exception, and payment evidence history in Super Admin views.
- Keep complimentary access and offline payments separate from captured provider revenue.

---

## 13. Non-negotiable safety and accounting rules

1. Never call a requested plan an active plan.
2. Never call an assigned paid plan active before payment confirmation or verified access authorization.
3. Never call pending payment paid.
4. Never treat complimentary access as captured revenue.
5. Never treat a manual/offline payment as a provider webhook.
6. Never create a fake provider identifier to satisfy a paid-state check.
7. Never let the frontend decide whether a clinic has access.
8. Never bypass the server-side eligibility check for an upgrade request.
9. Never overwrite lifecycle history when correcting a current snapshot.
10. Never make a paid state transition without an actor, reason, transition ID, and audit record.
11. Never expose an activation token more broadly than the activation flow requires.
12. Never display stale paid-plan information after Trial recovery or expiry.

---

## 14. Related existing documents

- `docs/TODO/14-super-admin-platform-operations-blueprint.md`
- `docs/TODO/15-messaging-allowance-and-plan-policy-blueprint.md`
- `docs/TODO/16-four-plan-subscription-and-entitlement-blueprint.md`
- `docs/TODO/18-clinic-registration-and-plan-suggestion.md`
- `docs/features/subscription/README.md`
- `docs/features/payment-and-subscription-guide.md`
