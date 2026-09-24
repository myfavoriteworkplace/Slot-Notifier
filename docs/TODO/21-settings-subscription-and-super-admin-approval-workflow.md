# Clinic Settings, Subscription Upgrade, and Super Admin Approval Workflow

**Status:** Detailed product, policy, and implementation plan
**Scope:** Clinic registration approval, Trial lifecycle, paid-plan assignment, payment-link delivery, verified offline payment, complimentary access, upgrade requests, renewals, audit history, and the Super Admin Clinics & Access workspace
**Audience:** Product owner, frontend engineers, backend engineers, Super Admin operations, billing operators, and QA

## Implementation status and pending work — audited 2026-09-24

The application is still in development mode and is deployed to Render for
development, acceptance, and integration testing. A Render deployment does not
mean that this workflow is release-complete or that production data has been
reconciled.

The following foundations are already present:

- The shared approval contract and development schema exist.
- `applySubscriptionApproval()` handles the main shared transition logic.
- Online, offline-payment, complimentary-access, provider, and Clinics & Access
  foundations exist.
- The development baseline report and focused transition tests exist.

The table below lists the remaining work as **independent executable steps**.
Each step has one clear purpose, a dependency, and a concrete completion check.
“Partial” means that a foundation exists but the documented behavior is not
complete. “Not started” means the work should be treated as a separate
implementation task.

| ID | Independent step | Status now | Depends on | Why this matters in plain language | Done when |
|---|---|---|---|---|---|
| **R1** | Freeze the five registration outcomes and message rules | **Complete** | — | Everyone must agree what happens when a clinic requests Trial, pays online, pays offline, receives complimentary access, or is rejected. | The registration policy below is the source of truth for the outcome, final Admin selection, access state, payment meaning, and message sent for every registration decision. |
| **R2** | Add a separate registration outcome selector | **Complete** | R1 | The Admin must choose an outcome separately from the plan. Selecting `Growth` should not automatically mean online payment. | The registration dialog has a separate five-outcome selector, shows only the relevant plan, cycle, Trial, offline, complimentary, or rejection fields, and prevents unsupported outcomes from submitting through the legacy API. |
| **R3** | Extend the registration approval API to all five outcomes | **Partial** | R1 | The server must receive the complete Admin decision instead of inferring it from `approvedPlan`. | `PATCH /api/clinics/:id/approve` accepts and validates all five outcomes, preserves requested and approved values, and calls the shared transition operation for every outcome. |
| **R4** | Complete Trial registration and credentials delivery | **Partial** | R3 | A Trial clinic should be able to start using the application without receiving a payment request. | Trial approval creates Trial and grace dates, sends username/password only, creates no payment link or provider subscription, and does not resend or rotate credentials on retry. |
| **R5** | Complete online paid registration and Admin overrides | **Partial** | R3 | The clinic must receive a payment link for the plan and cycle the Admin actually approved, not the original request. | An override from Growth Annual to Starter Monthly creates a Starter Monthly provider link, records both requested and approved values, requires an override reason, preserves Trial access, and keeps paid access false until provider confirmation. |
| **R6** | Add verified offline payment to registration approval | **Not started for registration** | R3 and existing offline-payment foundation | Admins need to approve a clinic whose payment was received outside Razorpay without pretending it was an online payment. | Registration collects evidence and verification details, creates an immutable offline record, activates the approved paid plan only after verification, and creates no provider subscription or webhook event. |
| **R7** | Add complimentary access to registration approval | **Not started for registration** | R3 and existing complimentary-access foundation | Free paid-level access must be deliberate and must not look like captured revenue. | Registration creates a finite sponsored grant with reason and dates, records waived payment, creates no payment evidence, and never auto-renews. |
| **R8** | Move registration rejection into the shared decision history | **Partial** | R3 | Rejection should be recorded with the same actor, reason, and transition history as approval. | Rejection from the registration dialog requires a reason, creates a shared rejection decision, sends no credentials or payment link, and leaves the clinic without active access. |
| **R9** | Retire or guard the legacy paid-plan mutation | **Not complete** | R3 and R5 | There must not be a second route that can erase Trial dates or create a paid assignment with different rules. | The legacy paid-plan route is removed, disabled, or reduced to a thin adapter over the shared operation, and its Admin UI caller is replaced. |
| **R10** | Fix Razorpay webhook verification and event evidence | **Not complete** | R5 | Only an authentic provider confirmation may activate paid access. | HMAC uses the original request bytes, missing production configuration fails closed, signatures are compared safely, the full event is retained, and duplicate/retry behavior is tested. |
| **R11** | Finish provider confirmation for overridden plans | **Partial** | R5 and R10 | A payment confirmation must activate the final approved plan, even when it differs from the clinic request. | Provider events match the activation token, provider subscription, approved plan, and billing cycle before moving Trial access to active paid access. |
| **R12** | Complete offline amount and reversal rules | **Partial** | R6 | A partial or reversed payment must not accidentally grant or preserve paid access. | The server enforces the full plan price or defines a non-activating partial-payment state; reversal has an effective date; duplicate, rejected, partial, and reversed cases are tested. |
| **R13** | Align Admin result cards and subscription history | **Partial** | R4–R8 | Admins need to see exactly what happened after each registration decision. | Result cards show requested plan, approved plan, current access, payment status, payment basis, dates, link status, actor, and next action without calling pending payment “Active paid”. |
| **R14** | Define safe boundaries for remaining lifecycle actions | **Partial** | R9–R12 | Trial extensions, grant expiry, reversals, provider recovery, and entitlement exceptions may remain specialized, but they must not be unsafe bypasses. | Every remaining mutation has documented authorization, locking/re-checking, idempotency, audit history, and a shared result or clearly documented lifecycle result. |
| **R15** | Run the registration and payment acceptance matrix in Render development | **Not started** | R2–R14 | The application is deployed to Render for testing, so the real deployed development flow must be checked before calling the work complete. | All five registration outcomes, Admin overrides, emails, provider confirmation, offline evidence, retries, permissions, and access enforcement pass in the Render development environment. |
| **R16** | Prepare production rollout and data reconciliation | **Not started** | R9–R15 and an approved production data source | Development data and Render acceptance data must not be treated as production clinic history. | A production database or approved production snapshot is classified read-only first; ambiguous clinics enter a review queue; approved backfills and rollout monitoring are documented before production release. |

### R1 completion record — frozen registration policy

R1 is complete as a product and documentation decision. The following rules
are the source of truth for registration approval. Later implementation steps
must follow these rules; they must not infer a different outcome from a plan
dropdown or from the clinic snapshot.

#### Common rules

1. A clinic's submitted plan and billing cycle are a **request**, not an active
   subscription.
2. Super Admin selects the registration outcome and, for paid outcomes, the
   final approved plan and billing cycle.
3. The requested and approved values are both retained:

   ```text
   Requested plan/cycle -> what the clinic asked for
   Approved plan/cycle  -> what Super Admin finally selected
   ```

4. If the approved paid plan or billing cycle differs from the request, the
   Admin must provide an override reason.
5. Any online payment link, provider plan ID, activation token, email wording,
   approval result, and audit record must use the **approved** plan and cycle,
   not the original request.
6. Trial access is not paid access. A payment link, provider subscription
   record, or assigned paid plan is not proof that paid access has started.

#### Registration outcome and message rules

| Registration outcome | What the Admin selects | Access after the decision | Message sent to the clinic | Payment meaning |
|---|---|---|---|---|
| **Approve with Trial** | Trial and optional Trial schedule | Trial access, followed by the documented grace period | Username and password only; no payment link | No payment is required at approval |
| **Approve paid plan — online payment** | Final paid plan and monthly/annual cycle | Trial remains active while payment is pending | Payment link for the final approved plan and cycle | Paid access starts only after provider confirmation |
| **Activate paid plan — verified offline payment** | Final paid plan, cycle, payment amount, and evidence | Active paid access after verification | Offline-payment confirmation with paid-period dates | Payment was received outside the provider and verified by Super Admin |
| **Grant paid-level access — complimentary** | Paid-level plan, start date, end date, reason, and optional sponsor reference | Finite sponsored/complimentary access | Complimentary-access confirmation with the end date | No payment is recorded; access does not auto-renew |
| **Reject registration** | Rejection reason | No active access | Rejection message; no credentials or payment link | No payment and no access |

#### Online payment override example

If the clinic requests:

```text
Growth · Annual
```

and Super Admin approves:

```text
Starter · Monthly
```

the system must create and send a **Starter Monthly** payment link. It must
not create a Growth Annual link. The approval history must show both values and
the reason for the override.

#### Registration result vocabulary

Every registration result must expose these separate dimensions:

```text
requestedPlan
requestedBillingCycle
approvedPlan
approvedBillingCycle
approvalOutcome
currentAccessPlan
accessState
paymentStatus
paymentBasis
renewalMode
nextAction
```

The online-payment result must therefore be representable as:

```text
approvalOutcome = online_payment_required
approvedPlan = the final Admin-selected paid plan
approvedBillingCycle = the final Admin-selected cycle
currentAccessPlan = trial
accessState = trial
paymentStatus = pending
paymentBasis = provider
paidAccess = false
```

### R2 completion record — separate registration outcome selector

R2 is complete for the registration review UI:

- The dialog now has a dedicated approval-outcome selector independent of the
  approved plan selector.
- The selector offers Trial, online payment, verified offline payment,
  complimentary access, and rejection.
- Trial shows Trial scheduling controls and the credentials-only message rule.
- Online payment shows the final approved plan, billing cycle, Trial-pending
  explanation, and payment-link rule.
- Verified offline payment shows amount, date, method, external reference, and
  evidence-reference fields.
- Complimentary access shows paid-level plan, start/end dates, and sponsor or
  internal reference fields.
- Rejection shows the rejection state and reason field.
- The UI does not submit offline, complimentary, or rejection choices through
  the older Trial/online approval payload. Those choices remain visibly blocked
  until R3 adds the complete registration API contract.

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

The registration review dialog now has a separate approval-outcome selector,
final approved plan selector, billing-cycle selector, custom Trial controls,
and outcome-specific fields. Trial and online-payment choices use the current
approval API. Offline, complimentary, and rejection choices are represented in
the UI but are blocked from submission until the registration API migration in
R3. This is an implementation description, not a change to the frozen policy.

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

## 5. Centralized approval process and decision table

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

### 5.1 Implementation objective

The approval workflow must have one server-side decision model, one state
transition contract, and one audit shape. The registration screen, upgrade
request screen, provider renewal handlers, offline renewal actions, and Clinics
& Access controls may have different entry points, but they must not implement
different meanings for approval or payment.

The implementation must enforce this distinction:

```text
Requested plan
  -> what the clinic asked for

Assigned plan
  -> what Super Admin selected

Current access plan
  -> the plan currently enforced by entitlements

Payment status and payment basis
  -> whether paid-level access is financially supported

Renewal mode
  -> how the next period will be obtained
```

The central operation must never infer active paid access from the requested
plan, assigned plan, provider subscription existence, generated payment link,
or a generic manual override.

#### Implementation progress — Make registration, upgrades, and renewals use one approval workflow

This table is the implementation tracker for the independent steps below.
“Complete” means the documented exit criteria for that step are implemented;
later steps may still depend on it.

| Step | Workstream | Progress | Current result | Next action |
|---|---|---|---|---|
| 0 | Inventory and freeze current behavior | **Complete** | Development inventory and route/state baseline recorded. A production database snapshot was not available, so production classification remains pending. | Obtain a production snapshot before rollout reconciliation. |
| 1 | Define the shared approval contract | **Complete** | Shared validation covers plans, outcomes, payment bases, renewal modes, actors, overrides, and outcome-specific evidence. | Keep adapters translating into this contract. |
| 2 | Add append-only approval and payment records | **Complete** | Approval decisions, offline payments, lifecycle links, assignments, grants, activation tokens, and idempotency constraints exist in the development schema. | Apply schema changes through the normal production publish flow. |
| 3 | Build the central server-side transition operation | **Complete** | `applySubscriptionApproval()` owns validation, locking/re-checking, idempotency, provider-intent reconciliation, clinic snapshots, assignments, decisions, and lifecycle events. | Migrate every entry point to the operation. |
| 4 | Migrate registration approval | **Complete** | `PATCH /api/clinics/:id/approve` is a thin adapter for Trial and provider-payment registration approvals, including custom Trial schedules and post-commit credentials/email. | Preserve the shared result shape as other adapters migrate. |
| 5 | Migrate upgrade-request approval | **Complete** | Upgrade approval and rejection now use `applySubscriptionApproval()`; online approvals preserve the clinic's current Trial/grace access while payment is pending, and the request is reviewed only after the central decision succeeds. | Add the dedicated verified-offline and complimentary upgrade/access-management entry points in Steps 7–8. |
| 6 | Migrate provider activation and renewal | **Complete** | Razorpay webhook signature/raw-event handling remains at the route boundary, while central provider transition logic now owns confirmation, renewal, past-due handling, expiry recovery, activation-token use, lifecycle history, and provider-event status. | Add dedicated verified-offline and complimentary access flows in Steps 7–8. |
| 7 | Add verified offline payment and renewal | **Complete** | Super Admin can verify an initial offline payment or manual renewal through the centralized approval operation. The workflow stores immutable evidence, rejects duplicate external references, shows payment history, and reverses payments conservatively without deleting evidence. | Add complimentary access and expiry handling in Step 8. |
| 8 | Add complimentary access and expiry | **Complete** | Super Admin grant, extension, revoke, and expiry reconciliation now use central approval/lifecycle services. Grants retain sponsor references, finite dates, no payment records, and no automatic renewal. | Move the broader directory/detail state presentation to the shared result in Step 9. |
| 9 | Update Clinics & Access around the central result | **Complete** | Clinics & Access now consumes a server-backed access summary containing current access, assigned/latest approval, payment, renewal, date, attention, actor, and next-action dimensions. | Reconcile existing data and roll out safely in Step 10. |
| 10 | Reconcile existing data and roll out safely | **Not started** | No production backfill or reconciliation has been run. | Classify legacy clinics, preview changes, backfill only with an approved report, and monitor rollout. |
| 11 | Verify the complete state matrix | **Not started** | Contract and focused transition tests pass; the complete registration/upgrade/renewal matrix is not yet covered. | Add end-to-end checks for every outcome, retry, provider failure, expiry, reversal, and authorization path. |

### 5.2 Step 0 — Inventory and freeze the current behavior

Before changing any route or UI, record the current behavior and identify
clinics that would be affected by the new state rules.

#### Current entry points to inventory

```text
PATCH /api/clinics/:id/approve
POST  /api/admin/clinic-upgrade-requests/:id/approve
POST  /api/admin/clinic-upgrade-requests/:id/reject
POST  /api/admin/clinics/:id/paid-plan
POST  /api/admin/clinics/:id/trial
POST  /api/admin/clinics/:id/sponsored-access
POST  /api/admin/clinics/:id/entitlement-exception
Razorpay subscription webhook handlers
Clinics & Access actions
```

#### Current data to classify

Create a read-only report that counts clinics by:

- Account status
- `plan`
- `subscriptionStatus`
- Trial dates
- Paid access expiry
- Provider subscription ID
- Activation-token status
- Sponsored-grant presence
- Lifecycle history
- Upgrade-request status

The report must identify ambiguous records such as:

- `pending_payment` clinics whose Trial dates were cleared.
- `manual_override` clinics without a verified offline record.
- Paid plans without a provider subscription or payment evidence.
- Sponsored access without a valid end date.
- Provider events that were received but not applied.

Do not automatically activate, expire, or downgrade ambiguous clinics during
this step. They must enter a reconciliation queue.

#### Exit criteria

- Current routes and mutations are mapped.
- Existing state counts are available.
- Ambiguous clinics are listed.
- No data has been changed.
- The old paid-plan assignment behavior is documented as a compatibility gap.

#### Step 0 completion record

**Status:** Complete for the configured development database; production execution remains blocked by the missing production database/snapshot.

The read-only inventory is implemented by:

```text
npm run audit:subscription-baseline
```

The generator now reports:

- Account status, requested/current plan, subscription status, Trial dates,
  paid-access expiry, provider-link presence, and billing cycle.
- Activation-token totals and usable/used/expired status.
- Lifecycle-event, plan-assignment, sponsored-grant, entitlement-exception,
  upgrade-request, and provider-event availability and counts.
- Inventory classifications and a reconciliation queue without inferring active
  paid access from a plan, provider subscription ID, payment link, or generic
  manual override.
- The required ambiguity flags:
  `pending_payment_trial_dates_cleared`,
  `manual_override_without_verified_offline_record`,
  `paid_plan_without_provider_or_payment_evidence`,
  `sponsored_access_without_valid_end_date`, and
  `provider_events_received_but_not_applied`.

The latest development report is recorded in
`docs/TODO/17-subscription-baseline-report.md`. It found one active development
clinic in `reconciliation_required` with a legacy unpaid/pending-payment state,
cleared Trial dates, no provider link, and no offline-payment evidence table.
No clinic, subscription, payment, grant, or lifecycle data was changed.

The latest production read-only gate attempt was made on **2026-09-23
(Asia/Calcutta)**. The platform returned
`PRODUCTION_DATABASE_ERROR` because this Repl does not have a production
database; deployment is required to create one. No production records were
read or changed. Until an approved production database or populated production
snapshot is available, the development report must not be treated as the
production-clinic baseline.

### 5.3 Step 1 — Define the shared approval contract

Add shared types and validation for the central operation. The exact file
names may follow the existing project structure, but the contract should
contain these concepts:

```ts
type ApprovalContext =
  | "registration"
  | "upgrade_request"
  | "renewal"
  | "access_management";

type ApprovalOutcome =
  | "trial"
  | "online_payment_required"
  | "verified_offline_payment"
  | "complimentary"
  | "reject";

type PaymentBasis =
  | "none"
  | "provider"
  | "offline_verified"
  | "complimentary";

type RenewalMode =
  | "trial_expiry"
  | "provider_auto"
  | "manual"
  | "admin_review";
```

The input contract should include:

```text
clinicId
approvalContext
outcome
requestedPlan
approvedPlan
requestedBillingCycle
approvedBillingCycle
reason
actor
transitionId
sourceRequestId
effectiveAt
```

Outcome-specific input must be explicit:

```text
online_payment_required:
  provider
  payment-link metadata

verified_offline_payment:
  amount
  currency
  receivedAt
  paymentMethod
  externalReference
  evidenceReference
  verifiedBy
  verifiedAt

complimentary:
  startsAt
  endsAt
  sponsorReference
```

Validation rules:

1. Paid plans require a valid monthly or annual billing cycle.
2. Trial approval cannot include a paid billing cycle.
3. Offline activation requires complete payment evidence and verification.
4. Complimentary access requires a reason, start date, and end date.
5. The end date must be after the start date.
6. A plan or cycle override requires a reason.
7. Rejection requires a reason.
8. Online payment never produces active paid access at approval time.
9. A provider subscription ID is not valid offline evidence.
10. The same transition ID must be idempotent.

#### Exit criteria

- All entry points can express their decision using the same contract.
- Invalid combinations fail before any database write.
- The contract distinguishes approval outcome from current access state.

#### Step 1 completion record

**Status:** Complete as a pure shared validation boundary for development.

Implemented in `shared/subscription-approval.ts` with tests in
`shared/subscription-approval.test.ts` and the dedicated command:

```text
npm run test:subscription-approval
```

The contract now defines and validates:

- Approval context, outcome, payment basis, renewal mode, actor, transition
  ID, source request, effective date, requested plan, approved plan, and
  billing-cycle fields.
- Trial, online-payment-required, verified-offline-payment, complimentary,
  and rejection outcomes.
- Provider/payment-link metadata for online payment.
- Complete offline-payment evidence with verification timing; a provider
  subscription ID cannot be used as offline evidence.
- Bounded complimentary-access dates and sponsor reference.
- Paid-plan billing cycles, Trial/billing incompatibility, reason requirements
  for overrides and rejection, and strict unknown-field rejection.

The schema is pure and does not write clinic or subscription data. Transition
ID uniqueness and replay handling will be enforced when the append-only
approval records are added in Step 2. The production baseline remains
intentionally deferred while the application is in development mode.

### 5.4 Step 2 — Add append-only approval and payment records

Add durable records rather than placing all meaning in the clinic snapshot.
Existing lifecycle, assignment, provider-event, access-grant, and upgrade
request records should remain available for compatibility and history.

#### Approval decision record

The approval decision record should contain:

```text
clinicId
approvalContext
approvalOutcome
requestedPlan
approvedPlan
requestedBillingCycle
approvedBillingCycle
paymentBasis
renewalMode
fromAccessState
toAccessState
reason
actorType
actorId
sourceRequestId
transitionId
effectiveAt
createdAt
```

Use a unique constraint that prevents the same clinic and transition ID from
creating duplicate approval decisions.

#### Offline payment record

Use a first-class record for money received outside the provider:

```text
clinicId
approvalDecisionId
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
reversedAt
reversalReason
createdAt
```

Offline records are immutable financial evidence. Corrections and reversals
must append new events or status records; they must not erase the original
receipt or change its amount.

#### Online payment intent

The existing activation-token/provider flow may be reused, but it must be
linked to the central approval decision. The intent should expose:

```text
approvalDecisionId
provider
providerSubscriptionId
activationTokenId
linkStatus
linkCreatedAt
linkSentAt
linkExpiresAt
providerConfirmationStatus
```

#### Complimentary grant link

The access grant should reference the approval decision and retain:

```text
approvalDecisionId
startsAt
endsAt
reason
sponsorReference
revokedAt
revokedBy
```

#### Exit criteria

- Latest approval basis can be queried without parsing free-form metadata.
- Offline payment can be audited without provider records.
- Online payment and complimentary access remain separate.
- Historical records are append-only.

#### Step 2 completion record

**Status:** Complete for the append-only development schema boundary. Route
adapters and the central transition service remain intentionally deferred to
Steps 3–8.

Implemented in `shared/schema.ts`, with idempotent development schema checks in
`server/index.ts` and `server/db.ts`:

- `subscription_approval_decisions` stores the approval context, outcome,
  requested and approved plan/cycle, payment basis, renewal mode, policy
  version, access-state transition, actor, reason, source request, effective
  date, and transition ID.
- `subscription_offline_payments` stores independent offline evidence,
  verification and reversal status, and links to exactly one approval decision.
- Unique clinic/transition and external-reference constraints protect
  idempotency and duplicate offline receipts.
- Activation tokens, lifecycle events, plan assignments, upgrade requests, and
  sponsored grants now have nullable `approvalDecisionId` links so existing
  history remains compatible while new central decisions can be connected.
- Existing records were not backfilled or changed. Production schema changes
  remain subject to the normal publish flow.

### 5.5 Step 3 — Build the central server-side transition operation

Implement one transactional service, conceptually:

```text
applySubscriptionApproval(input)
```

The service must run these steps in order:

1. Authenticate and authorize the actor at the route boundary.
2. Load the clinic and lock or re-check its current state.
3. Resolve the requested and approved plans.
4. Validate the outcome-specific fields.
5. Reject illegal state transitions.
6. Check the transition ID for an existing result.
7. Create any provider intent, offline payment record, or grant record.
8. Create the approval decision.
9. Update the clinic snapshot with the resulting current access state.
10. Create or update the plan assignment.
11. Create the lifecycle event.
12. Create notification/outbox work if required.
13. Commit the transaction.
14. Return the decision, resulting access summary, next action, and audit IDs.

Provider API calls should be handled so a provider failure leaves the clinic
unchanged. If provider creation must occur before the database transaction,
the implementation must record and reconcile provider-created-but-unlinked
subscriptions rather than silently losing them.

The service must return a state such as:

```ts
{
  requestedPlan,
  assignedPlan,
  currentAccessPlan,
  accessState,
  paymentStatus,
  paymentBasis,
  renewalMode,
  dates,
  nextAction,
  approvalDecisionId,
  transitionId,
}
```

#### Idempotency rules

- Repeating a completed transition returns the original result.
- Repeating an online approval must not create a second provider subscription.
- Repeating an offline approval must not create a second paid period.
- Repeating a complimentary grant must not extend it silently.
- A reused transition ID with different input must fail.

#### Exit criteria

- One operation owns state changes for all approval outcomes.
- Every write has an audit decision and transition ID.
- Failure and retry behavior is defined.

#### Step 3 completion record

**Status:** Complete as a reusable server-side operation. The existing upgrade
and renewal routes remain legacy adapters until their respective migration
steps.

Implemented in `server/subscription-approval.ts`:

- `applySubscriptionApproval(input)` validates the shared approval contract,
  re-checks the clinic inside a row-locking transaction, rejects illegal Trial
  replacement, and writes the decision, evidence/grant, clinic snapshot,
  assignment, lifecycle event, and applicable upgrade-request link together.
- Trial approvals create the default Trial window. Online payment approvals
  preserve active Trial or paid access while leaving payment pending. Verified
  offline approvals activate the paid plan with a cycle-based expiry.
  Complimentary approvals create a separate sponsored grant, and rejection
  records an explicit rejected decision.
- Online provider creation is injected through
  `createOnlinePaymentIntent`; provider failures leave the clinic unchanged.
  A provider intent created before a later database failure is recorded as an
  unlinked provider event for reconciliation.
- Replays return the original decision result. A SHA-256 input fingerprint
  rejects reuse of a transition ID with different approval or payment input.
- `server/subscription-approval.test.ts` covers the central access-state
  interpretation and route-facing error contract.

### 5.6 Step 4 — Migrate registration approval

Update `PATCH /api/clinics/:id/approve` to become a thin adapter over the
central operation.

#### Registration adapter responsibilities

1. Validate the pending clinic and registration permissions.
2. Resolve the clinic's requested plan.
3. Translate the selected UI option into an approval outcome.
4. Pass Trial, online, offline, complimentary, or rejection data to the
   central operation.
5. Return the shared result shape.

#### Result by outcome

Trial:

```text
status = approved
currentAccessPlan = trial
accessState = trial
paymentStatus = not_required
```

Online:

```text
status = approved
currentAccessPlan = trial
assignedPlan = selected paid plan
accessState = trial
paymentStatus = pending
paymentBasis = provider
paidAccess = false
```

Offline:

```text
status = approved
currentAccessPlan = selected paid plan
accessState = active_paid
paymentStatus = verified_offline
paymentBasis = offline_verified
renewalMode = manual
```

Complimentary:

```text
status = approved
currentAccessPlan = selected paid plan
accessState = sponsored
paymentStatus = waived
paymentBasis = complimentary
renewalMode = admin_review
```

Reject:

```text
status = rejected
accessState = no_access
```

The UI must display the resulting state in the confirmation and result card.
It must never label online approval as Active paid.

#### Exit criteria

- Registration approval no longer directly mutates subscription state.
- Online approval preserves Trial dates.
- All five outcomes use the same server operation.

#### Step 4 completion record

**Status:** Complete for `PATCH /api/clinics/:id/approve`.

- The route remains responsible for Super Admin authorization, pending-clinic
  input validation, requested-plan resolution, and clinic-timezone conversion
  of custom Trial dates.
- Trial registration approvals and paid registration approvals now translate
  to `applySubscriptionApproval()` as `trial` and
  `online_payment_required`. The central service owns the approval decision,
  clinic snapshot, assignment, activation token, and lifecycle event.
- Razorpay subscription creation is supplied through the service's injected
  `createOnlinePaymentIntent` callback. Missing provider configuration returns
  a provider error without changing the clinic.
- Credentials and the approval email are sent only after the central
  transition commits. Replayed transition IDs return the original result
  without rotating credentials or sending a second email, and the activation
  token is not exposed as a raw database row in the response.
- Custom Trial schedules are passed through the shared approval contract and
  remain timezone-aware. The route does not directly write subscription
  tables anymore.

The registration UI currently exposes Trial and provider-payment choices.
Offline, complimentary, and rejection outcomes are supported by the central
operation and remain available for the later access-management and
upgrade/rejection adapters.

### 5.7 Step 5 — Migrate upgrade-request approval

Update `POST /api/admin/clinic-upgrade-requests/:id/approve` to use the
central operation rather than calling the old paid-plan assignment behavior
directly.

#### Upgrade adapter responsibilities

1. Load the upgrade request and clinic.
2. Confirm the request is still pending.
3. Show current access, requested plan, and requested billing cycle.
4. Accept an approved plan and cycle separately from the request.
5. Require a reason when either value changes.
6. Translate the selected outcome to the central operation.
7. Link the approval decision to the upgrade request.
8. Mark the request approved only after the central operation succeeds.
9. Return the shared resulting access summary.

Rejection should use the same decision record and must leave the clinic's
current Trial, grace, sponsored, or paid state unchanged.

#### Exit criteria

- Registration and upgrade approvals produce the same state shape.
- Pending requests cannot be approved twice.
- Request history displays payment basis and resulting access state.

#### Step 5 completion record

**Status:** Complete for the online-payment and rejection upgrade-request
adapters.

- `POST /api/admin/clinic-upgrade-requests/:id/approve` now translates the
  approved plan and billing cycle into the shared
  `online_payment_required` decision and uses the same provider-intent
  callback as registration approval.
- `POST /api/admin/clinic-upgrade-requests/:id/reject` now records a central
  `reject` decision before marking the request rejected.
- Both decisions link `sourceRequestId` to the upgrade request and return the
  shared approval result, activation URL, payment basis, access state, and
  next action without exposing the raw activation token.
- The central transaction locks the source upgrade request and rejects a
  second decision for the same pending request. A request is marked reviewed
  only after the central transition commits.
- Verified-offline and complimentary outcomes remain intentionally deferred to
  the dedicated entry points in Steps 7 and 8, while the central operation
  already validates those outcome contracts.

### 5.8 Step 6 — Migrate provider activation and renewal

Provider webhook handlers must become event adapters, not independent
subscription state machines.

#### Activation event

For a confirmed provider payment:

```text
trial -> active_paid
paymentStatus: pending -> confirmed
paymentBasis: provider
renewalMode: provider_auto
```

The handler should call a central confirmation operation that:

1. Deduplicates the provider event.
2. Finds the linked approval/payment intent.
3. Verifies the clinic and plan match the provider record.
4. Sets paid access dates from the confirmed provider period.
5. Marks the activation token used.
6. Writes a provider-backed lifecycle event.
7. Updates the approval/payment intent status.

Provider subscription existence without a successful confirmation event must
not activate access.

#### Renewal event

For a successful recurring payment:

1. Deduplicate by provider event ID.
2. Verify the provider subscription and clinic match.
3. Extend the paid period.
4. Keep the current plan unchanged unless a separate plan change exists.
5. Write a `renewal` lifecycle event.
6. Update the next provider renewal date.

#### Failure and expiry

Provider failure should move the clinic to the documented past-due or grace
state. Provider completion/expiry should use the existing recovery policy
through the central transition operation. Recovery must preserve:

- Previous paid plan
- Previous paid expiry
- Provider event reference
- New Trial dates
- Recovery reason

#### Exit criteria

- Provider activation and renewal are idempotent.
- Webhooks no longer bypass approval history.
- Delayed, duplicate, and out-of-order events have defined behavior.

#### Step 6 completion record

**Status:** Complete for the Razorpay provider adapter.

Implemented in `server/subscription-approval.ts`:

- `applyProviderSubscriptionEvent()` is the central provider transition
  operation. The webhook route only validates the Razorpay signature, stores
  the raw provider event, resolves the linked clinic, and delegates.
- Confirmed `subscription.charged` and `subscription.activated` events lock
  the clinic, validate the provider subscription against the clinic or linked
  activation token, move the approved paid plan from pending payment to active,
  set the confirmed paid-period end, clear Trial dates, mark the activation
  token used, and write a provider-backed lifecycle event linked to the central
  approval decision.
- Recurring confirmations keep the current paid plan and write a `renewed`
  lifecycle event. Provider event IDs and lifecycle transition IDs make
  retries idempotent.
- Provider pending, halted, cancelled, completed, and expired events now move
  an unexpired paid subscription to `past_due` with lifecycle history, or use
  the central recovery policy after the paid period ends. Recovery preserves
  the prior paid plan, prior expiry, provider event metadata, Trial window, and
  recovery reason.
- Provider subscription existence alone cannot activate access; a confirmation
  event is required. A mismatched provider subscription is recorded and
  ignored without changing clinic access.

The shared lifecycle policy now treats `subscription.expired` as a valid
provider recovery trigger. Focused provider/lifecycle, approval, and upgrade
policy tests pass.

### 5.9 Step 7 — Add verified offline payment and renewal

Add an explicit offline-payment route and UI flow. It must not reuse a generic
manual override or provider activation mutation.

#### Initial offline activation

1. Super Admin chooses verified offline payment.
2. The server validates the plan and billing cycle.
3. The operator enters amount, currency, date, method, and external reference.
4. Evidence is attached or referenced.
5. The operator confirms verification.
6. The central operation creates the offline payment record.
7. The central operation activates paid access.
8. The next manual renewal date is calculated.
9. The approval decision and lifecycle event are written.

#### Offline renewal

1. Show renewal due or expiry attention in Clinics & Access.
2. Open the same verified-payment form.
3. Create a new offline payment record.
4. Reject duplicate external references.
5. Extend access only after verification.
6. Create a new renewal decision and transition.
7. Preserve all prior payment records.

#### Reversal/refund

1. Restrict the action to authorized Super Admin operators.
2. Require reversal/refund reason and effective date.
3. Append the reversal event.
4. Recalculate access according to policy.
5. Mark the payment record reversed.
6. Do not delete the original evidence.

#### Exit criteria

- Offline payment is visible as verified offline, not provider-paid.
- Offline renewal is manual and auditable.
- Duplicate, partial, rejected, and reversed payments are handled safely.

### 5.10 Step 8 — Add complimentary access and expiry

Use the central operation for a paid-level grant without payment.

Grant flow:

1. Super Admin selects complimentary/sponsored.
2. Selects the paid-level access plan.
3. Enters start date, end date, reason, and optional sponsor reference.
4. Reviews the “no payment / no auto-renewal” confirmation.
5. Creates the grant and approval decision.
6. Sets access state to `sponsored`.
7. Schedules an expiry reminder.

Extension flow:

1. Show the existing grant and end date.
2. Require a new reason and new end date.
3. Create a new approval decision.
4. Extend the grant without creating payment history.

Conversion flow:

1. End or supersede the sponsored grant.
2. Choose online payment or verified offline payment.
3. Keep the transition visible as a new basis.
4. Do not rewrite the original complimentary decision.

#### Exit criteria

- Complimentary access always has a finite end date.
- Complimentary access never auto-renews.
- Sponsored access is excluded from payment/revenue reporting.

#### Step 8 completion record

**Status:** Complete for the Super Admin access-management flow and lifecycle
reconciliation.

- `POST /api/admin/clinics/:id/sponsored-access` now translates grants and
  extensions into the central `complimentary` approval outcome. It records a
  sponsor reference, approval decision, plan assignment, sponsored grant, and
  lifecycle event without creating payment evidence.
- Grant validation is centralized and rejects overlapping sponsored grants or
  overlap with active paid access. The transition ID makes retries idempotent.
- The Clinics & Access dialog now shows the no-payment/no-auto-renewal
  confirmation, accepts an optional sponsor reference, and can extend an
  existing grant by creating a new complimentary decision from the prior end
  date.
- Sponsored revocation now uses the transactional central revocation service.
  It retains the original grant and approval decision and appends a separate
  revocation lifecycle event.
- The scheduler-only subscription lifecycle reconciliation endpoint now records
  idempotent `sponsored_access_expired` events for grants past their finite end
  date. Expiry does not rewrite or delete the original grant.
- The development schema now stores `sponsor_reference` on
  `subscription_access_grants`. Existing databases receive the column through
  the normal idempotent startup schema check.

### 5.11 Step 9 — Update Clinics & Access around the central result

The directory and detail view should consume the shared access summary rather
than independently deriving status from `plan` and `subscriptionStatus`.

#### Directory fields

Expose:

- Current access state
- Current access plan
- Assigned plan
- Latest approval outcome
- Payment basis
- Payment status
- Renewal mode
- Next important date
- Attention code
- Latest approval date and actor

#### Detail actions

Actions should call the central operation or a central provider/offline
confirmation operation:

| State | Action |
|---|---|
| Pending registration | Approve or reject |
| Trial | Extend Trial, approve payment path |
| Trial with payment pending | Resend link, reconcile, cancel activation |
| Active provider-paid | Reconcile or provider-aware plan change |
| Active offline-paid | Record verified renewal or reversal |
| Sponsored | Extend, convert, or revoke |
| Past due | Reconcile or apply grace policy |
| Expired | Recovery Trial or new payment path |
| Unknown | Reconciliation only |

The generic `Mark Paid` action remains unavailable.

#### Exit criteria

- Clinics & Access shows latest approval basis without manual interpretation.
- Every action produces the same audit and result shape.
- Unknown states cannot be activated blindly.

#### Step 9 completion record

**Status:** Complete for the shared Clinics & Access directory and detail
presentation.

- `GET /api/admin/clinics/directory` now combines each clinic with the shared
  effective-entitlement resolver and the latest central approval decision. It
  returns current access state and plan, assigned plan, latest outcome, payment
  basis/status, renewal mode, next important date, attention code, latest
  approval actor/date/reason, and next action.
- The directory rows no longer interpret `plan` and `subscriptionStatus`
  independently for access presentation. Trial, paid, sponsored, attention,
  and unknown filters use the server-resolved access state.
- The clinic detail header and latest subscription decision card present the
  same central dimensions separately, including requested/current/assigned
  distinctions, payment evidence basis, renewal mode, date, actor, reason, and
  next action. Directory rows also expose the latest approval timestamp and
  actor.
- Subscription mutations invalidate the directory summary alongside the
  compatibility clinic snapshot, so the directory reflects the committed
  central result after Trial, paid, offline, sponsored, exception, and
  revocation actions.
- The generic `Mark Paid` action remains disabled by the existing `410` route;
  unknown access remains visibly marked for reconciliation instead of being
  inferred as active paid access.

### 5.12 Step 10 — Reconcile existing data and roll out safely

Do not switch all clinics to the new interpretation without a reconciliation
pass.

#### Classification rules

```text
active + provider subscription
  -> provider-paid

pending_payment + usable activation token
  -> online payment pending

pending_payment without Trial dates or usable token
  -> manual reconciliation required

manual_override + sponsored grant
  -> sponsored

manual_override without grant or payment evidence
  -> unknown/reconciliation required

active paid without provider reference
  -> review for legacy/offline evidence
```

For `pending_payment` clinics whose Trial dates were previously cleared, do
not invent dates. A Super Admin must choose a documented recovery action:

- Restore a Trial period using an explicit new approval.
- Confirm provider payment if independently verified.
- Create a verified offline record if evidence exists.
- Cancel the pending activation.
- Mark the clinic for further reconciliation.

#### Rollout order

1. Deploy shared types and read-only state computation.
2. Run the classification report.
3. Add database records and backfill only unambiguous history.
4. Deploy the central service behind route-level guards.
5. Migrate registration approval.
6. Migrate upgrade approval.
7. Migrate provider handlers.
8. Enable offline and complimentary actions.
9. Enable Clinics & Access filters and actions.
10. Review reconciliation queue.
11. Remove or retire the old direct paid-assignment path.

#### Exit criteria

- No clinic is silently granted or removed access.
- Ambiguous records are visible to Super Admin.
- Old and new state reports reconcile for known clinics.
- Rollback can disable new mutations without deleting history.

### 5.13 Step 11 — Verify the complete state matrix

Before release, test every combination that can affect access:

| Context | Trial | Online pending | Offline verified | Complimentary | Reject |
|---|---:|---:|---:|---:|---:|
| Registration | Required | Required | Required | Required | Required |
| Upgrade request | Required | Required | Required | Required | Required |
| Provider activation | — | Required | — | — | — |
| Provider renewal | — | — | — | — | — |
| Offline renewal | — | — | Required | — | — |
| Complimentary extension | — | — | — | Required | — |

Also verify:

- Duplicate transition IDs
- Duplicate provider events
- Delayed provider events
- Provider failure
- Payment-link expiry
- Duplicate offline references
- Partial offline payments
- Payment reversal/refund
- Complimentary expiry
- Concurrent approval attempts
- Permission boundaries
- Notification wording
- Access enforcement after every transition

Run the Build Check workflow after frontend implementation and perform a
browser verification of each approval outcome and result card.

### 5.14 Centralized process completion criteria

The centralized process is complete only when all of the following are true:

- Registration, upgrades, and renewals use the same outcome vocabulary.
- One server-side operation owns approval state transitions.
- Requested, assigned, and current access plans remain separate.
- Online approval keeps Trial access until provider confirmation.
- Offline payment has independent evidence and verification.
- Complimentary access has an end date and no automatic renewal.
- Provider events are idempotent and auditable.
- Clinics & Access shows the latest approval basis and next action.
- Existing ambiguous states are reconciled rather than guessed.
- Every state transition has an actor, reason, effective date, and transition ID.

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
This will approve [the final approved plan] on [the final approved cycle].

The clinic will remain on Trial access until online payment is confirmed.
A payment activation link for the final approved plan and cycle will be
generated and sent.
Paid access will not begin before provider confirmation.
```

The online-payment message is not a credentials-only message. The link must
match the final Admin selection, including any plan or billing-cycle override.
Trial approval is the only registration outcome whose message is defined as
username and password only. The current implementation still includes
credentials in the paid approval email; aligning that behavior with this
policy remains part of R4 and R5.

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

## 14. Implementation phase index

The detailed operational sequence is defined in Section 5. This section is a
short delivery index for tracking implementation work; it must not introduce
a second approval model or a different state interpretation.

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