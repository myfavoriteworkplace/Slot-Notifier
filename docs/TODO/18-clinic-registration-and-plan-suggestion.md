# Clinic Registration and Plan Suggestion

**Status:** Step 5 complete — Clinic registration, approval-plan handling, durable upgrade-request storage, and clinic upgrade-request APIs implemented; Super Admin review APIs remain pending
**Audience:** Product, Super Admin, clinic operations, frontend, backend, database, QA, and release teams  
**Primary goal:** Let a new clinic choose Trial during registration, give Trial clinics a clear path to request a paid upgrade, and give Super Admin one place to review and action those requests.

---

## 1. What this document covers

This is an independently executable implementation plan. A developer should be able to follow the steps in order without needing to reconstruct the original discussion.

The work covers:

1. Adding Trial as a clinic registration choice.
2. Preserving the clinic's selected plan until a Super Admin approves the registration.
3. Starting the correct plan when the clinic is approved.
4. Showing Trial status at the top of the authenticated Clinic Admin dashboard.
5. Allowing a Trial clinic to request Starter, Growth, or Pro.
6. Preventing duplicate upgrade requests.
7. Showing pending upgrade requests to Super Admin.
8. Notifying Super Admin in the Admin screen when requests are waiting.
9. Reusing the existing audited paid-plan and payment workflow.
10. Testing, migrating, releasing, and rolling back the feature safely.

This document does **not** authorize implementation by itself. It is the plan to approve before application changes begin.

---

## 2. Plain-language outcome

After implementation, the flow should work like this:

```text
Clinic opens registration
        ↓
Clinic chooses Trial, Starter, Growth, or Pro
        ↓
The choice is saved as a requested plan
        ↓
Super Admin reviews the registration
        ↓
Super Admin approves the clinic
        ↓
Trial starts, or the selected paid-plan process begins
        ↓
Trial clinic sees a dashboard upgrade banner
        ↓
Clinic chooses a paid plan and billing cycle
        ↓
Clinic submits one upgrade request
        ↓
Super Admin sees a Requests tab and pending count
        ↓
Super Admin approves or rejects the request
        ↓
Approved requests use the existing provider-aware paid-plan workflow
```

The request itself must not silently change the clinic's plan. A request is only a request until Super Admin reviews it and the paid-plan process succeeds.

---

## 3. Current application facts to preserve

Before making changes, confirm these facts in the current source rather than assuming they have not changed:

- `shared/plan-catalog.ts` already contains Trial.
- Trial is currently defined as a 14-day plan with a 7-day grace period.
- The clinic model already has Trial lifecycle fields such as:
  - `trialStartedAt`
  - `trialEndsAt`
  - `trialGraceEndsAt`
  - `trialOrigin`
  - `previousPaidPlan`
- Subscription assignment and lifecycle history tables already exist.
- Registration currently displays Starter, Growth, and Pro.
- Registration already sends a selected plan to the registration endpoint.
- Current clinic approval starts Trial for every approved clinic, regardless of the selected registration plan.
- `ClinicDashboard.tsx` already contains a subscription-payment-pending banner.
- `ClinicEntitlementSettingsPanel.tsx` already understands Trial and Trial grace states.
- Super Admin already has an audited paid-plan assignment route.
- Existing notifications are mainly clinic- and doctor-focused.
- The current notification WebSocket routing does not provide a dedicated Super Admin upgrade-request channel.

These facts mean this feature should extend existing subscription behaviour rather than create a second plan catalogue, a second Trial timer, or a second paid activation workflow.

---

## 4. Product rules to confirm before coding

The following rules are the recommended default. Product or operations should confirm them before implementation begins.

### 4.1 Trial rules

- Trial remains the existing 14-day Trial.
- Trial remains the existing 7-day grace period.
- Trial does not require a payment card.
- Trial is available as an initial registration choice.
- Trial access is controlled by the existing entitlement catalogue.
- Trial dates are created only when the clinic is approved, not when the registration form is submitted.

### 4.2 Paid-plan request rules

- A clinic may request Starter, Growth, or Pro.
- A clinic must choose monthly or annual billing.
- A clinic cannot request Trial as an upgrade.
- Only the clinic's authenticated owner/admin can submit the request.
- A clinic may have only one pending upgrade request.
- Repeated clicks or network retries return the existing pending request instead of creating another one.
- Submitting a request does not activate the paid plan.
- Active paid clinics do not use this Trial upgrade-request flow.

### 4.3 Timing rules

Recommended default:

- Upgrade requests are allowed while Trial is active.
- Upgrade requests are allowed during the Trial grace period.
- After grace ends, the dashboard shows that the Trial has ended and directs the clinic to Super Admin/support review.
- After grace ends, the normal conversion endpoint does not create a new request unless Product explicitly approves that behaviour.

This follows the existing Trial conversion eligibility rules and prevents expired clinics from creating an unlimited recovery path.

### 4.4 Approval rules

- A Trial registration approved by Super Admin starts the existing Trial lifecycle.
- A paid registration choice must not be silently replaced by Trial.
- If a clinic requested a paid plan at registration, Super Admin must confirm the paid plan and billing cycle through the existing paid-plan workflow.
- A paid subscription is not considered active merely because an upgrade request was approved.
- The request is marked approved only after the paid-plan workflow successfully creates the required activation/payment action.
- If payment-provider setup fails, the request remains pending and the failure is visible to Super Admin.

---

## 5. Implementation sequence

Complete the following steps in order. Do not skip the data and permission steps in favour of only changing the screens.

---

## Step 0 — Record the baseline before editing — COMPLETE

**Baseline checked:** 2026-09-19, Asia/Calcutta  
**Scope:** Read-only inspection of the current registration, approval, subscription, Trial, Clinic Admin, Super Admin, notification, schema, migration, and test entry points.

### Purpose

Capture the current behaviour so a later test can distinguish an intentional change from an accidental regression.

### Verified registration behaviour

- **Registration screen:** `client/src/pages/RegisterClinic.tsx`
  - `PLAN_OPTIONS` currently contains only `starter`, `growth`, and `pro`.
  - The selected plan state is typed as `"starter" | "growth" | "pro" | ""`.
  - The plan selector is shown after email verification.
  - The form sends the selected value as `plan` in `POST /api/clinics/register`.
  - The current payment message says a secure payment link for the chosen plan will be sent after approval.
- **Registration route:** `server/routes.ts`, `POST /api/clinics/register`
  - Requires a verified email token.
  - Removes verification and optional document fields from the request body.
  - Creates the clinic with `status: "pending"`.
  - Passes the remaining fields, including the submitted `plan`, into storage.
  - Does not currently run the complete registration body through a dedicated Zod `safeParse()` before storage.
- **Clinic data model:** `shared/schema.ts`
  - `clinics.plan` currently defaults to `"starter"`.
  - There is no separate `requestedPlan` field.
  - The current model already contains `trialStartedAt`, `trialEndsAt`, `trialGraceEndsAt`, `trialOrigin`, `previousPaidPlan`, and `subscriptionPolicyVersion`.

### Verified approval behaviour

- **Approval route:** `server/routes.ts`, `PATCH /api/clinics/:id/approve`
  - Uses `isAuthenticated` and then checks for the `superuser` role.
  - Only pending clinics can be approved.
  - Builds the initial Trial from the shared policy catalogue.
  - Uses the current Trial policy values of 14 days plus 7 grace days.
  - Generates clinic credentials and sends the approval email.
  - Always updates the approved clinic to:
    - `plan: "trial"`
    - `subscriptionStatus: "trialing"`
    - The newly calculated Trial dates and origin
  - Does not currently use the clinic's selected registration plan to choose the approval result.
  - Writes a Trial assignment to `subscriptionPlanAssignments`.
  - Writes a `trial_started` event to `subscriptionLifecycleEvents`.
- **Confirmed mismatch:** A clinic can submit a paid plan value from the registration form, but approval currently replaces that choice with Trial. Adding only a Trial card would not fix the complete workflow.

### Verified Trial and plan policy behaviour

- **Shared catalogue:** `shared/plan-catalog.ts`
  - `PLAN_KEYS` contains `trial`, `starter`, `growth`, and `pro`.
  - `PAID_PLAN_KEYS` contains `starter`, `growth`, and `pro`.
  - Valid billing cycles are `monthly` and `annual`.
  - Trial is a no-card plan with a 14-day duration and 7-day grace period.
  - Trial currently allows 10 lifetime bookings, 1 active doctor, and 50 MB storage.
- **Trial helpers:** `shared/trial-lifecycle.ts`
  - Existing helpers build initial Trial windows.
  - Existing helpers determine Trial phase and conversion eligibility.
  - The current policy treats a Trial as conversion-eligible during the active Trial or grace period, not after grace expiry.
- **Existing tests:**
  - `shared/trial-lifecycle.test.ts`
  - `shared/plan-catalog.test.ts`
  - `shared/subscription-lifecycle.test.ts`
  - `shared/subscription-status.test.ts`
  - `shared/effective-entitlement.test.ts`

### Verified paid-plan activation behaviour

- **Existing route:** `server/routes.ts`, `POST /api/admin/clinics/:id/paid-plan`
  - Requires the Super Admin role.
  - Validates plan, billing cycle, reason, and optional transition ID with Zod.
  - Uses a transition ID to make repeated requests idempotent.
  - Creates a Razorpay subscription when provider configuration is available.
  - Creates an activation token and payment link.
  - Sets the clinic to `pending_payment`, rather than pretending that payment has completed.
  - Writes a `subscriptionPlanAssignments` record.
  - Writes either a `converted` or `plan_assigned` lifecycle event.
  - Returns the activation URL to the Admin client.
- **Implementation consequence:** Upgrade-request approval must reuse this provider-aware workflow instead of creating another paid-plan assignment path.

### Verified Clinic Admin surface

- **Main page:** `client/src/pages/ClinicDashboard.tsx`
  - The current subscription banner only handles `subscriptionStatus === "pending_payment"`.
  - It tells the clinic that payment is pending and provides a support link.
  - There is no Trial-active, Trial-grace, upgrade-request, rejected-request, or Trial-expired banner yet.
- **Existing entitlement panel:** `client/src/components/ClinicEntitlementSettingsPanel.tsx`
  - Loads `/api/auth/clinic/settings/entitlements`.
  - Already displays Trial and Trial grace states.
  - Already displays Trial start, Trial end, and grace end dates.
  - This component is a reusable source for Trial state presentation, but it is not currently the requested top-of-dashboard upgrade flow.

### Verified Super Admin surface

- **Main page:** `client/src/pages/Admin.tsx`
  - Existing Clinic lifecycle tabs are `Clinics & Access`, `Pending`, and `Archived`.
  - Existing Operations tabs are `Platform Operations`, `Tenant Operations`, and `Clinic Monitoring`.
  - Existing Growth/governance tabs include `Smile Deals`, `Plan Policies`, and `Security & Audit`.
  - There is currently no `Requests` tab or upgrade-request count.
  - The Pending registration approval action calls `PATCH /api/clinics/:id/approve` and currently tells the Admin that the clinic has started a 14-day Trial.
- **Existing Admin access pattern:** Super Admin routes use `isAuthenticated` followed by a role check for `superuser`.

### Verified notification and realtime behaviour

- **Notification storage:** `notifications` is user-ID based and currently supports clinic/doctor notification ownership.
- **Notification storage methods:** `server/storage.ts` reads and updates notifications by the scoped `userId`.
- **Role scoping:** Existing notification migrations use `clinic:` and `doctor:` prefixes to prevent numeric-ID collisions.
- **Current result:** There is no dedicated Super Admin upgrade-request notification channel or durable Admin request queue.
- **Implementation consequence:** The first release should use the upgrade-request table as the source of truth, with a Super Admin Requests-tab badge and refresh/toast behaviour. A dedicated Admin WebSocket channel can remain a later enhancement.

### Verified database and migration conventions

- **Schema definitions:** New Drizzle tables and columns belong in `shared/schema.ts`.
- **Startup compatibility SQL:** Existing additive schema checks are also present in `server/index.ts`, using idempotent `IF NOT EXISTS` blocks.
- **Subscription history:** `subscriptionLifecycleEvents` and `subscriptionPlanAssignments` already have clinic indexes and unique transition IDs.
- **Implementation consequence:** Any new requested-plan column or upgrade-request table must follow both the Drizzle schema and startup SQL/migration requirements. Existing subscription history must not be replaced or deleted.

### Verified test and quality commands

The current `package.json` provides these relevant commands:

```text
npm run build
npm run check
npm run test:subscription-entitlements
npm run test:subscription-baseline
npm run test:e2e
```

The existing Build Check workflow runs the production build command. The feature implementation must run the Build Check after code changes; Step 0 itself required no build or application restart because it changed no runtime code.

### Step 0 completion check

- [x] Current registration plan values recorded.
- [x] Registration payload and backend handling recorded.
- [x] Current approval behaviour recorded.
- [x] Existing Trial fields, catalogue, and eligibility helpers recorded.
- [x] Existing paid-plan activation route and idempotency behaviour recorded.
- [x] Clinic Dashboard banner area recorded.
- [x] Super Admin navigation and approval surface recorded.
- [x] Authentication and role-check patterns recorded.
- [x] Existing subscription assignment and lifecycle writes recorded.
- [x] Existing notification limitation recorded.
- [x] Existing test and build commands recorded.
- [x] No application code, database schema, route, or UI was changed.

**Step 0 result:** Complete. The baseline was recorded before implementation.

---

## Step 1 — Add Trial to the registration screen — COMPLETE

### Purpose

Give a new clinic a visible and understandable Trial option.

### UI work

Update the registration plan selector to show:

1. Trial
2. Starter
3. Growth
4. Pro

Keep the current visual language and layout. The Trial card should clearly say:

- Free
- 14 days
- No card required
- What the Trial includes
- What happens after Trial and grace end

The copy must not imply that Trial is a permanent free plan or that every feature is unlimited.

### Form behaviour

- Trial must be a valid selectable value.
- The form must not submit an unknown plan value.
- If the form requires a plan selection, the error message must mention that a plan must be selected.
- The selected plan must remain selected when the user navigates between registration steps or receives a validation error.
- The submission must use the project's shared API request helper, not a bare browser `fetch`.

### Completion checks

- A user can select Trial.
- Trial is visibly different from paid plans without hiding the paid options.
- The registration payload contains `trial` when Trial is selected.
- Existing Starter, Growth, and Pro registration still works.
- The card is usable on a narrow mobile screen.
- Labels, buttons, and selection controls are keyboard accessible.

### Step 1 progress record

Step 1 is complete.

- Added Trial to the registration selector using the shared plan catalogue.
- Trial displays as Free, 14 days, and No card required.
- Trial is visually distinct from paid plans without hiding Starter, Growth,
  or Pro.
- Trial copy explains the seven-day grace period and the next action after
  Trial.
- Paid registration copy now reflects the agreed Trial-first flow: approved
  clinics start with Trial access and the selected paid plan is retained for
  later payment activation.
- The existing shared API request helper remains in use, and selecting Trial
  submits `requestedPlan: "trial"`.
- The selector remains responsive and uses keyboard-accessible buttons with
  pressed-state semantics.

Step 2 must add validated requested-plan storage before the backend can safely
distinguish a registration preference from the clinic's active plan.

---

## Step 2 — Preserve the requested plan during registration — COMPLETE

### Purpose

Separate what a clinic asks for from the plan it currently has.

### Recommended data design

Add a nullable field to the pending clinic record:

```text
requestedPlan
```

The field should accept only:

```text
trial
starter
growth
pro
```

Do not use an unapproved registration choice as if it were an active subscription.

If the current `clinics.plan` field is already explicitly documented as the requested plan for pending clinics, the implementation team may preserve that contract instead of adding a new column. This must be confirmed by inspecting all reads and writes first. Do not mix both meanings silently.

### Backend work

- Add the field to `shared/schema.ts` if a new column is required.
- Add the matching idempotent startup SQL in `server/index.ts`, following the project’s dual-registration rule.
- Update the insert schema and registration route validation.
- Validate the plan with the canonical plan catalogue.
- Save the selected plan to the pending clinic record.
- Do not start Trial during registration.
- Do not create a paid subscription during registration.

### Migration requirements

If a column is added:

- The column must be nullable or have a safe default.
- The SQL must use `IF NOT EXISTS`.
- Existing clinics must keep their current effective plan and subscription state.
- The exact SQL needed for the Render database must be documented.
- No existing migration block should be edited; add an append-only migration/startup block according to project convention.

### Completion checks

- A pending clinic retains the selected plan after registration.
- Existing pending clinics continue to load.
- Registration cannot store arbitrary plan strings.
- No subscription or Trial timer is created before approval.

### Step 2 progress record

Step 2 is complete.

- Added nullable `requestedPlan` storage to the clinic schema.
- Added idempotent `requested_plan` startup SQL to both database startup paths.
- Added the append-only Render migration:
  `ALTER TABLE "clinics" ADD COLUMN IF NOT EXISTS "requested_plan" varchar(20);`
- Registration validates the requested plan against the shared catalogue.
- The selected plan is saved as `requestedPlan`, while the active `plan` and
  subscription lifecycle fields remain server-controlled.
- The legacy `plan` input is accepted only as a compatibility input and is
  never written as the active plan during registration.
- Registration rejects missing, unknown, or conflicting plan values.
- No Trial timestamps, Trial lifecycle records, or paid subscription records
  are created during registration.
- Added focused requested-plan validation tests.

---

## Step 3 — Make Super Admin approval honour the requested plan — COMPLETE

### Purpose

Remove the current mismatch where every approved clinic is started on Trial even when the clinic selected a paid plan.

### Trial approval path

When the requested plan is Trial:

- Approve the clinic.
- Start the existing Trial lifecycle.
- Set the existing Trial timestamps and origin.
- Create the existing subscription assignment and lifecycle records.
- Keep the clinic's current access consistent with the shared plan catalogue.
- Send the existing approval notification/credentials.

### Paid approval path

When the requested plan is Starter, Growth, or Pro:

- Show the requested plan to Super Admin.
- Require confirmation of the paid plan and billing cycle.
- Use the existing paid-plan assignment workflow.
- Do not directly mark the clinic as fully paid unless the existing provider-aware process says that is valid.
- Keep provider activation, payment-link creation, lifecycle history, and idempotency in the shared service.

### Failure behaviour

- If paid activation cannot be prepared, do not mark the request or clinic as successfully paid.
- Return a useful error to Super Admin.
- Keep the clinic in a recoverable pending state.
- Do not create duplicate provider subscriptions on retry.

### Completion checks

- [x] Trial selection starts Trial only after approval.
- [x] Paid selection is not silently converted to Trial.
- [x] The existing paid-plan route and the new approval path produce the same lifecycle records.
- [x] Repeating an approval request does not create duplicate assignments or provider subscriptions.

### Step 3 progress record

Step 3 is complete.

- Super Admin approval resolves the stored `requestedPlan` and allows an explicit
  approved-plan choice.
- Trial approval starts the existing Trial lifecycle with default or validated
  custom dates, assignment history, and lifecycle history.
- Paid approval requires a monthly or annual billing cycle and reuses the
  provider-aware paid-plan assignment workflow.
- Paid approval remains `pending_payment` until the existing activation/payment
  process completes; it does not falsely grant paid access.
- Plan overrides require a reason and are recorded in lifecycle metadata.
- Transition IDs make repeated approval requests idempotent.
- Provider setup failure leaves the clinic unchanged and returns a recoverable
  error to Super Admin.
- Added shared approval-selection validation and focused approval tests covering
  Trial defaults, paid-plan preservation, override reasons, billing-cycle rules,
  custom Trial schedule fields, and unknown-plan fallback.
- Verification: focused clinic registration and approval tests passed; `npm run
  build` passed; `git diff --check` passed.

---

## Step 4 — Add the upgrade-request data model — COMPLETE

### Purpose

Keep upgrade requests as a durable business record instead of representing them only as a temporary notification.

### Recommended table

Create a table named according to the project's naming convention, for example:

```text
clinic_upgrade_requests
```

Recommended fields:

| Field | Purpose |
|---|---|
| `id` | Unique request identifier |
| `clinicId` | Clinic that submitted the request |
| `requestedPlan` | Starter, Growth, or Pro |
| `billingCycle` | Monthly or annual |
| `status` | Pending, approved, rejected, or cancelled |
| `clinicReason` | Optional explanation from the clinic |
| `requestedAt` | When the clinic submitted the request |
| `reviewedAt` | When Super Admin completed review |
| `reviewedBy` | Super Admin identity |
| `reviewReason` | Approval or rejection note |
| `createdAt` | Record creation time |
| `updatedAt` | Last record update time |

Use the repository's existing timestamp, foreign-key, and enum conventions rather than introducing a new style.

### Rules

- Keep completed requests; do not delete them after review.
- Add an index for clinic and status.
- Add an index for pending requests ordered by creation time.
- Enforce one pending request per clinic at the database level when supported by the current migration approach.
- Also enforce the rule in storage/application code because database uniqueness alone is not enough for safe retry handling.
- Do not store payment credentials in this table.
- Do not store sensitive clinical or patient information.

### Completion checks

- [x] A request can be listed after the browser is closed.
- [x] Old approved and rejected requests remain available for audit.
- [x] Two simultaneous submissions cannot create two pending requests.

### Step 4 progress record

Step 4 is complete.

- Added the `clinic_upgrade_requests` table to the shared Drizzle schema.
- Added clinic foreign-key, requested plan, billing cycle, status, clinic
  reason, request/review timestamps, reviewer, review reason, and update
  timestamp fields.
- Added `clinic_id + status` and `status + requested_at` indexes.
- Added a PostgreSQL partial unique index so each clinic can have only one
  pending request while preserving completed request history.
- Added the same additive `CREATE TABLE IF NOT EXISTS` and index migration to
  both startup database initialization paths.
- Added storage methods that use conflict-safe insertion and return the
  existing pending row on retry, so application-level retries are idempotent
  in addition to the database uniqueness guard.
- Review-only fields are excluded from the insert schema.
- Added focused model tests for statuses, required creation fields, and
  server-managed review fields.
- Verification: focused approval, registration, and upgrade-request model
  tests passed; `npm run build` passed; `git diff --check` passed.

---

## Step 5 — Add clinic upgrade-request APIs — COMPLETE

### Clinic endpoints

Use the project's existing clinic-authenticated route convention. Recommended endpoints:

```text
POST /api/auth/clinic/subscription/upgrade-requests
GET  /api/auth/clinic/subscription/upgrade-request
```

The exact route name may follow existing subscription naming, but the behaviour must remain the same.

### POST validation

The route must:

- Require an authenticated clinic session.
- Read the clinic ID from the session, not from a browser-supplied clinic ID.
- Validate the body with Zod before storage.
- Accept only Starter, Growth, or Pro.
- Accept only monthly or annual billing.
- Optionally accept a bounded-length reason.
- Confirm the clinic's current effective plan is Trial.
- Confirm the Trial is active or in grace.
- Reject clinics with an existing pending request.
- Return the existing pending request for a safe retry when appropriate.

The route must not:

- Accept Trial as a paid upgrade target.
- Accept provider identifiers or payment credentials.
- Directly change the clinic's effective plan.
- Trust a browser-supplied eligibility flag.

### GET behaviour

Return the clinic's most relevant request:

- Pending request, if one exists.
- Most recent approved or rejected request if there is no pending request.
- Clear empty state if no request exists.

Do not expose another clinic's request by changing a query parameter.

### Super Admin endpoints

Recommended endpoints:

```text
GET  /api/admin/clinic-upgrade-requests
POST /api/admin/clinic-upgrade-requests/:id/approve
POST /api/admin/clinic-upgrade-requests/:id/reject
```

The exact route names may follow current Admin naming conventions.

These routes must:

- Require the existing Super Admin authentication guard.
- Check that the request exists and has the expected current status.
- Validate all mutation bodies with Zod.
- Prevent a second approval or rejection from changing a completed request.
- Record reviewer and timestamp.
- Reuse storage methods and the existing paid-plan service.

### Completion checks

- [x] Clinic users cannot read or mutate another clinic's request.
- [x] Non-admin users cannot review requests.
- [x] Invalid plans, billing cycles, statuses, and IDs receive clean errors.
- [x] Repeated POST requests are safe.

### Step 5 progress record

Step 5 is complete.

- Added `POST /api/auth/clinic/subscription/upgrade-requests`.
- Added `GET /api/auth/clinic/subscription/upgrade-request`.
- Both routes require a clinic owner session and derive the clinic ID from
  the authenticated session.
- POST validates paid plan, billing cycle, and bounded clinic reason with Zod.
  Browser-supplied clinic IDs, Trial targets, provider identifiers, and
  payment credentials are rejected.
- POST confirms the clinic is currently in active Trial or Trial grace using
  the shared lifecycle eligibility policy.
- Existing pending requests are returned as idempotent retries, and no
  clinic subscription state is changed by request submission.
- GET returns the pending request first, otherwise the most recent historical
  request, or a clear empty `null` result.
- Added focused policy tests covering input validation, forbidden fields, and
  active/grace/expired Trial eligibility.
- Verification: focused subscription, approval, registration, and lifecycle
  tests passed; `npm run build` passed; `git diff --check` passed.

---

## Step 6 — Add the Clinic Admin Trial banner

### Purpose

Make the next action obvious without interrupting the clinic's normal work.

### Placement

Place the banner at the top of the authenticated Clinic Admin dashboard, near the existing subscription/payment banner area.

Do not place it on the unauthenticated clinic login page because the clinic's subscription state is not known before login.

### Active Trial state

Show:

- Trial label
- Days remaining or Trial end date
- Short explanation of the Trial
- `Request upgrade` button

### Grace-period state

Show:

- Grace-period label
- Grace-period end date
- Clear warning that the Trial has ended
- `Request upgrade` button

### Pending request state

Show:

- Requested paid plan
- Billing cycle
- Date submitted
- `Upgrade request pending` state
- No duplicate submission button

### Rejected request state

Show:

- Rejection status
- Super Admin reason, if provided
- A way to submit a new request if the clinic is still eligible

### Expired state

Show:

- Trial ended message
- Grace period ended message, when applicable
- Support/admin review direction
- No normal conversion request unless the product rule is changed

### UI quality requirements

- Include loading, error, and empty states.
- Use the existing banner and button components.
- Keep the banner responsive on mobile.
- Keep warning colours consistent with the existing dashboard.
- Give all buttons and controls accessible names.
- Add `data-testid` attributes following project conventions.

---

## Step 7 — Add the upgrade request dialog

### Fields

The dialog should contain:

1. Paid plan:
   - Starter
   - Growth
   - Pro
2. Billing cycle:
   - Monthly
   - Annual
3. Optional reason or note for Super Admin

The dialog should display the selected plan's relevant benefit summary from the shared plan catalogue. It must not duplicate pricing or entitlements in a separate hardcoded ruleset.

### Submission behaviour

- Disable the submit button while saving.
- Show a clear success message.
- Close the dialog only after the server confirms success.
- Keep the form open and show a useful error when submission fails.
- If the server reports an existing pending request, show that request instead of treating it as a new one.
- Refresh the clinic's request query after submission.

### Completion checks

- The clinic can understand what it is requesting.
- The clinic cannot submit without a valid paid plan and billing cycle.
- A request is not submitted twice by double-clicking.
- The modal works on mobile and with keyboard navigation.

---

## Step 8 — Add the Super Admin Requests tab

### Purpose

Give Super Admin a focused queue for clinic upgrade requests.

### Navigation

Add a `Requests` tab to the existing Super Admin clinic/operations navigation. Do not create a second Admin page.

Show a pending-count badge on the tab.

### Request list

Show:

- Clinic name
- Current effective plan
- Requested plan
- Billing cycle
- Trial/grace state
- Request date
- Request age
- Status
- Review action

The list should support:

- Pending filter
- All/history filter
- Loading state
- Empty state
- Error state
- Retry

### Request detail

Show:

- Clinic identity needed for the review
- Requested plan and billing cycle
- Trial dates
- Clinic note
- Previous requests from the same clinic
- Current subscription state

Do not show unrelated patient or clinical information.

### Approve action

The approval confirmation should:

- Show the plan and billing cycle being approved.
- Allow Super Admin to confirm or change them if the product rules permit.
- Explain whether a payment/activation link will be created.
- Call the existing paid-plan workflow.
- Mark the request approved only after the workflow succeeds.

### Reject action

The rejection form should:

- Require a reason.
- Show a confirmation before submitting.
- Keep the request in history.
- Make the reason visible to the clinic.

### Completion checks

- The pending badge equals the server's pending count.
- Approve and reject actions are not shown to unauthorised users.
- A completed request cannot be processed again.
- Provider failures are shown without losing the request.

---

## Step 9 — Notify Super Admin in the Admin screen

### First release recommendation

Use the Requests tab as the authoritative notification surface:

- Pending badge in navigation.
- Visible notice when pending requests exist.
- Refresh the pending count and list periodically while Admin is open.
- Show an in-screen toast when a newly detected request appears.

The request table remains the source of truth if the browser is closed or a toast is missed.

### Why not extend the current notification system immediately

The current notification system is primarily user-ID based for clinic and doctor users, and its WebSocket routing does not currently provide a Super Admin-specific channel. Forcing upgrade requests into that path would add notification complexity without improving the durable request workflow.

### Optional later improvement

After the durable request flow is stable, a separate Super Admin WebSocket event can be added. It must remain a convenience notification only; it must not replace the request table or pending-count query.

---

## Step 10 — Preserve audit and lifecycle history

The implementation must continue using the existing subscription history rules:

- Current subscription fields are current-state snapshots.
- Subscription assignments are append-only.
- Subscription lifecycle history is append-only.
- Trial transitions remain idempotent.
- Paid plan activation remains provider-aware.
- Request history is not deleted after review.

At minimum, record:

- When the clinic requested an upgrade.
- Who reviewed it.
- When it was approved or rejected.
- What plan and billing cycle were requested.
- Any review reason.
- The resulting paid-plan assignment or activation attempt.

Do not treat a request submission as a paid-plan assignment. A request does not grant access.

---

## Step 11 — Add tests before release

### Registration tests

- Trial is displayed.
- Trial can be selected.
- Trial is accepted by backend validation.
- Invalid plan strings are rejected.
- The selected plan survives validation errors.
- Existing paid-plan registration still works.

### Approval tests

- Trial registration starts the existing Trial lifecycle after approval.
- Paid registration is not silently changed to Trial.
- Paid approval uses the existing provider-aware assignment process.
- Repeated approval is idempotent.
- Provider failure leaves a recoverable state.

### Request API tests

- Unauthenticated users are rejected.
- A clinic admin can create a request for their own clinic.
- A clinic cannot create a request for another clinic.
- Starter, Growth, and Pro are accepted.
- Trial is rejected as an upgrade target.
- Monthly and annual billing are accepted.
- Invalid billing cycles are rejected.
- Active Trial requests succeed.
- Grace-period requests succeed.
- Post-grace requests follow the approved product rule.
- Duplicate pending submissions return one request.
- Paid clinics cannot use the Trial conversion flow.

### Super Admin tests

- Only Super Admin can list requests.
- Pending count is accurate.
- Super Admin can approve a pending request.
- Super Admin can reject with a reason.
- Reject without a reason is blocked.
- A completed request cannot be approved or rejected again.
- Request history remains available.

### UI tests

- Active Trial banner appears.
- Grace banner uses the warning state.
- Pending request state prevents duplicate submission.
- Rejected request state shows the review reason.
- Expired state follows the approved rule.
- Requests tab shows pending badge.
- Loading, empty, error, and retry states work.
- Mobile layout remains usable.
- Keyboard and accessible-label checks pass.

---

## Step 12 — Run the project release gates

After all code for this feature is complete:

### Frontend gate

- Run the Build Check workflow.
- Confirm the build exits successfully.
- Scan for duplicate exported frontend types/constants.
- Scan for bare API fetches and hardcoded localhost URLs.
- Check that all new interactive controls have `data-testid`.

### Backend and database gate

- Confirm every new route has the correct auth guard.
- Confirm every mutating route validates request bodies with Zod.
- Confirm new storage methods exist in both `IStorage` and `DatabaseStorage`.
- Confirm schema changes exist in both `shared/schema.ts` and startup/migration SQL.
- Confirm all database changes are idempotent.
- Confirm exact Render SQL is documented.
- Confirm no route imports Drizzle directly when the repository requires storage methods.

### Functional gate

- Run focused registration tests.
- Run focused subscription and Trial tests.
- Run upgrade-request tests.
- Run the existing related test suite.
- Start the application workflow.
- Verify the Clinic Admin and Super Admin screens in the running preview.

Do not declare the feature complete until the Build Check passes.

---

## 6. Rollout plan

### Before deployment

- Confirm the commercial rules in Section 4.
- Take a database backup according to the normal release process.
- Apply the additive schema migration.
- Verify existing clinic plan and Trial fields.
- Verify existing pending clinics still appear in Admin.
- Verify the current paid-plan activation flow independently.

### Staged rollout

Recommended order:

1. Deploy the additive request table/field changes.
2. Deploy backend validation and APIs.
3. Deploy the registration Trial option.
4. Deploy the Clinic Admin banner and request dialog.
5. Deploy the Super Admin Requests tab.
6. Monitor request creation, duplicate handling, and provider activation.

If feature flags are available, keep the banner and request submission disabled until the backend and Admin review surface are ready.

### Monitoring

Watch for:

- Registration failures.
- Clinics approved with the wrong plan.
- Duplicate upgrade requests.
- Requests stuck in pending state.
- Provider activation failures.
- Trial date or grace-date mismatches.
- Incorrect pending counts.
- Unauthorized request access.

---

## 7. Rollback plan

If the release must be rolled back:

- Do not delete upgrade-request records.
- Do not reset Trial dates.
- Do not reverse a completed paid assignment automatically.
- Disable new request creation first.
- Keep Super Admin history readable.
- Keep already-approved payment/activation records consistent.
- Roll back UI separately from data if necessary.
- Only remove an additive schema element after confirming no deployed code still reads it.

If the problem is severe or risks corrupting subscription state, use the project's checkpoint rollback process rather than manually deleting subscription history.

---

## 8. Definition of done

The feature is complete only when all of the following are true:

- [x] Trial is visible and selectable during clinic registration.
- [x] The selected registration plan is preserved until approval.
- [x] Trial approval starts the existing Trial lifecycle.
- [x] Paid registration choices are not silently overwritten.
- [ ] Trial and grace status appear at the top of the authenticated Clinic Admin dashboard.
- [ ] Eligible clinics can select a paid plan and billing cycle.
- [ ] Upgrade requests are stored as durable records.
- [ ] Duplicate pending requests are prevented.
- [ ] Clinics can see their request status.
- [ ] Super Admin has a Requests tab with a pending count.
- [ ] Super Admin can approve or reject requests with proper permissions.
- [x] Approval reuses the existing paid-plan workflow.
- [ ] Rejection requires a reason.
- [ ] Request and subscription history are preserved.
- [ ] Super Admin receives an in-screen notification through the Requests tab/badge flow.
- [ ] Active, grace, pending, rejected, and expired states are tested.
- [ ] Build Check passes.
- [ ] Database and backend checklist gates pass.
- [x] No application implementation was started before this plan was approved.

---

## 9. Decisions that must be answered before implementation

The implementation can use the recommended defaults above, but these decisions should be explicitly confirmed:

1. Should a paid plan selected during registration go directly through paid activation after approval, or should the clinic first start Trial and use the selected paid plan only as a preference?
2. Should clinics be allowed to submit an upgrade request after the grace period ends?
3. Should Super Admin be allowed to change the requested plan or billing cycle during review?
4. Should the first release use polling and a Requests-tab badge, or is real-time Super Admin WebSocket delivery required immediately?
5. Should the clinic's optional request note be included in the first release?

Recommended answers:

1. Use the existing paid activation process for a paid registration selection; do not silently replace it with Trial.
2. Do not allow the normal request flow after grace; use support/admin review.
3. Allow Super Admin to confirm or adjust the plan and billing cycle only if that action is recorded in the review history.
4. Use polling and the pending badge first; add real-time delivery later.
5. Include an optional, length-limited note because it gives Super Admin useful context without changing subscription state.

---

## 10. Approval gate

No application code should be changed for this feature until the product owner confirms:

- The rules in Section 4.
- The answers in Section 9.
- The requested-plan data design in Step 2.
- The approval behaviour in Step 3.

Once approved, implementation should proceed from Step 0 through Step 12 in order.# Clinic Registration and Plan Suggestion

**Status:** Step 5 complete — Clinic registration, approval-plan handling, durable upgrade-request storage, and clinic upgrade-request APIs implemented; Super Admin review APIs remain pending
**Audience:** Product, Super Admin, clinic operations, frontend, backend, database, QA, and release teams  
**Primary goal:** Let a new clinic choose Trial during registration, give Trial clinics a clear path to request a paid upgrade, and give Super Admin one place to review and action those requests.

---

## 1. What this document covers

This is an independently executable implementation plan. A developer should be able to follow the steps in order without needing to reconstruct the original discussion.

The work covers:

1. Adding Trial as a clinic registration choice.
2. Preserving the clinic's selected plan until a Super Admin approves the registration.
3. Starting the correct plan when the clinic is approved.
4. Showing Trial status at the top of the authenticated Clinic Admin dashboard.
5. Allowing a Trial clinic to request Starter, Growth, or Pro.
6. Preventing duplicate upgrade requests.
7. Showing pending upgrade requests to Super Admin.
8. Notifying Super Admin in the Admin screen when requests are waiting.
9. Reusing the existing audited paid-plan and payment workflow.
10. Testing, migrating, releasing, and rolling back the feature safely.

This document does **not** authorize implementation by itself. It is the plan to approve before application changes begin.

---

## 2. Plain-language outcome

After implementation, the flow should work like this:

```text
Clinic opens registration
        ↓
Clinic chooses Trial, Starter, Growth, or Pro
        ↓
The choice is saved as a requested plan
        ↓
Super Admin reviews the registration
        ↓
Super Admin approves the clinic
        ↓
Trial starts, or the selected paid-plan process begins
        ↓
Trial clinic sees a dashboard upgrade banner
        ↓
Clinic chooses a paid plan and billing cycle
        ↓
Clinic submits one upgrade request
        ↓
Super Admin sees a Requests tab and pending count
        ↓
Super Admin approves or rejects the request
        ↓
Approved requests use the existing provider-aware paid-plan workflow
```

The request itself must not silently change the clinic's plan. A request is only a request until Super Admin reviews it and the paid-plan process succeeds.

---

## 3. Current application facts to preserve

Before making changes, confirm these facts in the current source rather than assuming they have not changed:

- `shared/plan-catalog.ts` already contains Trial.
- Trial is currently defined as a 14-day plan with a 7-day grace period.
- The clinic model already has Trial lifecycle fields such as:
  - `trialStartedAt`
  - `trialEndsAt`
  - `trialGraceEndsAt`
  - `trialOrigin`
  - `previousPaidPlan`
- Subscription assignment and lifecycle history tables already exist.
- Registration currently displays Starter, Growth, and Pro.
- Registration already sends a selected plan to the registration endpoint.
- Current clinic approval starts Trial for every approved clinic, regardless of the selected registration plan.
- `ClinicDashboard.tsx` already contains a subscription-payment-pending banner.
- `ClinicEntitlementSettingsPanel.tsx` already understands Trial and Trial grace states.
- Super Admin already has an audited paid-plan assignment route.
- Existing notifications are mainly clinic- and doctor-focused.
- The current notification WebSocket routing does not provide a dedicated Super Admin upgrade-request channel.

These facts mean this feature should extend existing subscription behaviour rather than create a second plan catalogue, a second Trial timer, or a second paid activation workflow.

---

## 4. Product rules to confirm before coding

The following rules are the recommended default. Product or operations should confirm them before implementation begins.

### 4.1 Trial rules

- Trial remains the existing 14-day Trial.
- Trial remains the existing 7-day grace period.
- Trial does not require a payment card.
- Trial is available as an initial registration choice.
- Trial access is controlled by the existing entitlement catalogue.
- Trial dates are created only when the clinic is approved, not when the registration form is submitted.

### 4.2 Paid-plan request rules

- A clinic may request Starter, Growth, or Pro.
- A clinic must choose monthly or annual billing.
- A clinic cannot request Trial as an upgrade.
- Only the clinic's authenticated owner/admin can submit the request.
- A clinic may have only one pending upgrade request.
- Repeated clicks or network retries return the existing pending request instead of creating another one.
- Submitting a request does not activate the paid plan.
- Active paid clinics do not use this Trial upgrade-request flow.

### 4.3 Timing rules

Recommended default:

- Upgrade requests are allowed while Trial is active.
- Upgrade requests are allowed during the Trial grace period.
- After grace ends, the dashboard shows that the Trial has ended and directs the clinic to Super Admin/support review.
- After grace ends, the normal conversion endpoint does not create a new request unless Product explicitly approves that behaviour.

This follows the existing Trial conversion eligibility rules and prevents expired clinics from creating an unlimited recovery path.

### 4.4 Approval rules

- A Trial registration approved by Super Admin starts the existing Trial lifecycle.
- A paid registration choice must not be silently replaced by Trial.
- If a clinic requested a paid plan at registration, Super Admin must confirm the paid plan and billing cycle through the existing paid-plan workflow.
- A paid subscription is not considered active merely because an upgrade request was approved.
- The request is marked approved only after the paid-plan workflow successfully creates the required activation/payment action.
- If payment-provider setup fails, the request remains pending and the failure is visible to Super Admin.

---

## 5. Implementation sequence

Complete the following steps in order. Do not skip the data and permission steps in favour of only changing the screens.

---

## Step 0 — Record the baseline before editing — COMPLETE

**Baseline checked:** 2026-09-19, Asia/Calcutta  
**Scope:** Read-only inspection of the current registration, approval, subscription, Trial, Clinic Admin, Super Admin, notification, schema, migration, and test entry points.

### Purpose

Capture the current behaviour so a later test can distinguish an intentional change from an accidental regression.

### Verified registration behaviour

- **Registration screen:** `client/src/pages/RegisterClinic.tsx`
  - `PLAN_OPTIONS` currently contains only `starter`, `growth`, and `pro`.
  - The selected plan state is typed as `"starter" | "growth" | "pro" | ""`.
  - The plan selector is shown after email verification.
  - The form sends the selected value as `plan` in `POST /api/clinics/register`.
  - The current payment message says a secure payment link for the chosen plan will be sent after approval.
- **Registration route:** `server/routes.ts`, `POST /api/clinics/register`
  - Requires a verified email token.
  - Removes verification and optional document fields from the request body.
  - Creates the clinic with `status: "pending"`.
  - Passes the remaining fields, including the submitted `plan`, into storage.
  - Does not currently run the complete registration body through a dedicated Zod `safeParse()` before storage.
- **Clinic data model:** `shared/schema.ts`
  - `clinics.plan` currently defaults to `"starter"`.
  - There is no separate `requestedPlan` field.
  - The current model already contains `trialStartedAt`, `trialEndsAt`, `trialGraceEndsAt`, `trialOrigin`, `previousPaidPlan`, and `subscriptionPolicyVersion`.

### Verified approval behaviour

- **Approval route:** `server/routes.ts`, `PATCH /api/clinics/:id/approve`
  - Uses `isAuthenticated` and then checks for the `superuser` role.
  - Only pending clinics can be approved.
  - Builds the initial Trial from the shared policy catalogue.
  - Uses the current Trial policy values of 14 days plus 7 grace days.
  - Generates clinic credentials and sends the approval email.
  - Always updates the approved clinic to:
    - `plan: "trial"`
    - `subscriptionStatus: "trialing"`
    - The newly calculated Trial dates and origin
  - Does not currently use the clinic's selected registration plan to choose the approval result.
  - Writes a Trial assignment to `subscriptionPlanAssignments`.
  - Writes a `trial_started` event to `subscriptionLifecycleEvents`.
- **Confirmed mismatch:** A clinic can submit a paid plan value from the registration form, but approval currently replaces that choice with Trial. Adding only a Trial card would not fix the complete workflow.

### Verified Trial and plan policy behaviour

- **Shared catalogue:** `shared/plan-catalog.ts`
  - `PLAN_KEYS` contains `trial`, `starter`, `growth`, and `pro`.
  - `PAID_PLAN_KEYS` contains `starter`, `growth`, and `pro`.
  - Valid billing cycles are `monthly` and `annual`.
  - Trial is a no-card plan with a 14-day duration and 7-day grace period.
  - Trial currently allows 10 lifetime bookings, 1 active doctor, and 50 MB storage.
- **Trial helpers:** `shared/trial-lifecycle.ts`
  - Existing helpers build initial Trial windows.
  - Existing helpers determine Trial phase and conversion eligibility.
  - The current policy treats a Trial as conversion-eligible during the active Trial or grace period, not after grace expiry.
- **Existing tests:**
  - `shared/trial-lifecycle.test.ts`
  - `shared/plan-catalog.test.ts`
  - `shared/subscription-lifecycle.test.ts`
  - `shared/subscription-status.test.ts`
  - `shared/effective-entitlement.test.ts`

### Verified paid-plan activation behaviour

- **Existing route:** `server/routes.ts`, `POST /api/admin/clinics/:id/paid-plan`
  - Requires the Super Admin role.
  - Validates plan, billing cycle, reason, and optional transition ID with Zod.
  - Uses a transition ID to make repeated requests idempotent.
  - Creates a Razorpay subscription when provider configuration is available.
  - Creates an activation token and payment link.
  - Sets the clinic to `pending_payment`, rather than pretending that payment has completed.
  - Writes a `subscriptionPlanAssignments` record.
  - Writes either a `converted` or `plan_assigned` lifecycle event.
  - Returns the activation URL to the Admin client.
- **Implementation consequence:** Upgrade-request approval must reuse this provider-aware workflow instead of creating another paid-plan assignment path.

### Verified Clinic Admin surface

- **Main page:** `client/src/pages/ClinicDashboard.tsx`
  - The current subscription banner only handles `subscriptionStatus === "pending_payment"`.
  - It tells the clinic that payment is pending and provides a support link.
  - There is no Trial-active, Trial-grace, upgrade-request, rejected-request, or Trial-expired banner yet.
- **Existing entitlement panel:** `client/src/components/ClinicEntitlementSettingsPanel.tsx`
  - Loads `/api/auth/clinic/settings/entitlements`.
  - Already displays Trial and Trial grace states.
  - Already displays Trial start, Trial end, and grace end dates.
  - This component is a reusable source for Trial state presentation, but it is not currently the requested top-of-dashboard upgrade flow.

### Verified Super Admin surface

- **Main page:** `client/src/pages/Admin.tsx`
  - Existing Clinic lifecycle tabs are `Clinics & Access`, `Pending`, and `Archived`.
  - Existing Operations tabs are `Platform Operations`, `Tenant Operations`, and `Clinic Monitoring`.
  - Existing Growth/governance tabs include `Smile Deals`, `Plan Policies`, and `Security & Audit`.
  - There is currently no `Requests` tab or upgrade-request count.
  - The Pending registration approval action calls `PATCH /api/clinics/:id/approve` and currently tells the Admin that the clinic has started a 14-day Trial.
- **Existing Admin access pattern:** Super Admin routes use `isAuthenticated` followed by a role check for `superuser`.

### Verified notification and realtime behaviour

- **Notification storage:** `notifications` is user-ID based and currently supports clinic/doctor notification ownership.
- **Notification storage methods:** `server/storage.ts` reads and updates notifications by the scoped `userId`.
- **Role scoping:** Existing notification migrations use `clinic:` and `doctor:` prefixes to prevent numeric-ID collisions.
- **Current result:** There is no dedicated Super Admin upgrade-request notification channel or durable Admin request queue.
- **Implementation consequence:** The first release should use the upgrade-request table as the source of truth, with a Super Admin Requests-tab badge and refresh/toast behaviour. A dedicated Admin WebSocket channel can remain a later enhancement.

### Verified database and migration conventions

- **Schema definitions:** New Drizzle tables and columns belong in `shared/schema.ts`.
- **Startup compatibility SQL:** Existing additive schema checks are also present in `server/index.ts`, using idempotent `IF NOT EXISTS` blocks.
- **Subscription history:** `subscriptionLifecycleEvents` and `subscriptionPlanAssignments` already have clinic indexes and unique transition IDs.
- **Implementation consequence:** Any new requested-plan column or upgrade-request table must follow both the Drizzle schema and startup SQL/migration requirements. Existing subscription history must not be replaced or deleted.

### Verified test and quality commands

The current `package.json` provides these relevant commands:

```text
npm run build
npm run check
npm run test:subscription-entitlements
npm run test:subscription-baseline
npm run test:e2e
```

The existing Build Check workflow runs the production build command. The feature implementation must run the Build Check after code changes; Step 0 itself required no build or application restart because it changed no runtime code.

### Step 0 completion check

- [x] Current registration plan values recorded.
- [x] Registration payload and backend handling recorded.
- [x] Current approval behaviour recorded.
- [x] Existing Trial fields, catalogue, and eligibility helpers recorded.
- [x] Existing paid-plan activation route and idempotency behaviour recorded.
- [x] Clinic Dashboard banner area recorded.
- [x] Super Admin navigation and approval surface recorded.
- [x] Authentication and role-check patterns recorded.
- [x] Existing subscription assignment and lifecycle writes recorded.
- [x] Existing notification limitation recorded.
- [x] Existing test and build commands recorded.
- [x] No application code, database schema, route, or UI was changed.

**Step 0 result:** Complete. The baseline was recorded before implementation.

---

## Step 1 — Add Trial to the registration screen — COMPLETE

### Purpose

Give a new clinic a visible and understandable Trial option.

### UI work

Update the registration plan selector to show:

1. Trial
2. Starter
3. Growth
4. Pro

Keep the current visual language and layout. The Trial card should clearly say:

- Free
- 14 days
- No card required
- What the Trial includes
- What happens after Trial and grace end

The copy must not imply that Trial is a permanent free plan or that every feature is unlimited.

### Form behaviour

- Trial must be a valid selectable value.
- The form must not submit an unknown plan value.
- If the form requires a plan selection, the error message must mention that a plan must be selected.
- The selected plan must remain selected when the user navigates between registration steps or receives a validation error.
- The submission must use the project's shared API request helper, not a bare browser `fetch`.

### Completion checks

- A user can select Trial.
- Trial is visibly different from paid plans without hiding the paid options.
- The registration payload contains `trial` when Trial is selected.
- Existing Starter, Growth, and Pro registration still works.
- The card is usable on a narrow mobile screen.
- Labels, buttons, and selection controls are keyboard accessible.

### Step 1 progress record

Step 1 is complete.

- Added Trial to the registration selector using the shared plan catalogue.
- Trial displays as Free, 14 days, and No card required.
- Trial is visually distinct from paid plans without hiding Starter, Growth,
  or Pro.
- Trial copy explains the seven-day grace period and the next action after
  Trial.
- Paid registration copy now reflects the agreed Trial-first flow: approved
  clinics start with Trial access and the selected paid plan is retained for
  later payment activation.
- The existing shared API request helper remains in use, and selecting Trial
  submits `requestedPlan: "trial"`.
- The selector remains responsive and uses keyboard-accessible buttons with
  pressed-state semantics.

Step 2 must add validated requested-plan storage before the backend can safely
distinguish a registration preference from the clinic's active plan.

---

## Step 2 — Preserve the requested plan during registration — COMPLETE

### Purpose

Separate what a clinic asks for from the plan it currently has.

### Recommended data design

Add a nullable field to the pending clinic record:

```text
requestedPlan
```

The field should accept only:

```text
trial
starter
growth
pro
```

Do not use an unapproved registration choice as if it were an active subscription.

If the current `clinics.plan` field is already explicitly documented as the requested plan for pending clinics, the implementation team may preserve that contract instead of adding a new column. This must be confirmed by inspecting all reads and writes first. Do not mix both meanings silently.

### Backend work

- Add the field to `shared/schema.ts` if a new column is required.
- Add the matching idempotent startup SQL in `server/index.ts`, following the project’s dual-registration rule.
- Update the insert schema and registration route validation.
- Validate the plan with the canonical plan catalogue.
- Save the selected plan to the pending clinic record.
- Do not start Trial during registration.
- Do not create a paid subscription during registration.

### Migration requirements

If a column is added:

- The column must be nullable or have a safe default.
- The SQL must use `IF NOT EXISTS`.
- Existing clinics must keep their current effective plan and subscription state.
- The exact SQL needed for the Render database must be documented.
- No existing migration block should be edited; add an append-only migration/startup block according to project convention.

### Completion checks

- A pending clinic retains the selected plan after registration.
- Existing pending clinics continue to load.
- Registration cannot store arbitrary plan strings.
- No subscription or Trial timer is created before approval.

---

## Step 3 — Make Super Admin approval honour the requested plan — COMPLETE

### Purpose

Remove the current mismatch where every approved clinic is started on Trial even when the clinic selected a paid plan.

### Trial approval path

When the requested plan is Trial:

- Approve the clinic.
- Start the existing Trial lifecycle.
- Set the existing Trial timestamps and origin.
- Create the existing subscription assignment and lifecycle records.
- Keep the clinic's current access consistent with the shared plan catalogue.
- Send the existing approval notification/credentials.

### Paid approval path

When the requested plan is Starter, Growth, or Pro:

- Show the requested plan to Super Admin.
- Require confirmation of the paid plan and billing cycle.
- Use the existing paid-plan assignment workflow.
- Do not directly mark the clinic as fully paid unless the existing provider-aware process says that is valid.
- Keep provider activation, payment-link creation, lifecycle history, and idempotency in the shared service.

### Failure behaviour

- If paid activation cannot be prepared, do not mark the request or clinic as successfully paid.
- Return a useful error to Super Admin.
- Keep the clinic in a recoverable pending state.
- Do not create duplicate provider subscriptions on retry.

### Completion checks

- Trial selection starts Trial only after approval.
- Paid selection is not silently converted to Trial.
- The existing paid-plan route and the new approval path produce the same lifecycle records.
- Repeating an approval request does not create duplicate assignments or provider subscriptions.

---

## Step 4 — Add the upgrade-request data model — COMPLETE

### Purpose

Keep upgrade requests as a durable business record instead of representing them only as a temporary notification.

### Recommended table

Create a table named according to the project's naming convention, for example:

```text
clinic_upgrade_requests
```

Recommended fields:

| Field | Purpose |
|---|---|
| `id` | Unique request identifier |
| `clinicId` | Clinic that submitted the request |
| `requestedPlan` | Starter, Growth, or Pro |
| `billingCycle` | Monthly or annual |
| `status` | Pending, approved, rejected, or cancelled |
| `clinicReason` | Optional explanation from the clinic |
| `requestedAt` | When the clinic submitted the request |
| `reviewedAt` | When Super Admin completed review |
| `reviewedBy` | Super Admin identity |
| `reviewReason` | Approval or rejection note |
| `createdAt` | Record creation time |
| `updatedAt` | Last record update time |

Use the repository's existing timestamp, foreign-key, and enum conventions rather than introducing a new style.

### Rules

- Keep completed requests; do not delete them after review.
- Add an index for clinic and status.
- Add an index for pending requests ordered by creation time.
- Enforce one pending request per clinic at the database level when supported by the current migration approach.
- Also enforce the rule in storage/application code because database uniqueness alone is not enough for safe retry handling.
- Do not store payment credentials in this table.
- Do not store sensitive clinical or patient information.

### Completion checks

- [x] A request can be listed after the browser is closed.
- [x] Old approved and rejected requests remain available for audit.
- [x] Two simultaneous submissions cannot create two pending requests.

---

## Step 5 — Add clinic upgrade-request APIs — COMPLETE

### Clinic endpoints

Use the project's existing clinic-authenticated route convention. Recommended endpoints:

```text
POST /api/auth/clinic/subscription/upgrade-requests
GET  /api/auth/clinic/subscription/upgrade-request
```

The exact route name may follow existing subscription naming, but the behaviour must remain the same.

### POST validation

The route must:

- Require an authenticated clinic session.
- Read the clinic ID from the session, not from a browser-supplied clinic ID.
- Validate the body with Zod before storage.
- Accept only Starter, Growth, or Pro.
- Accept only monthly or annual billing.
- Optionally accept a bounded-length reason.
- Confirm the clinic's current effective plan is Trial.
- Confirm the Trial is active or in grace.
- Reject clinics with an existing pending request.
- Return the existing pending request for a safe retry when appropriate.

The route must not:

- Accept Trial as a paid upgrade target.
- Accept provider identifiers or payment credentials.
- Directly change the clinic's effective plan.
- Trust a browser-supplied eligibility flag.

### GET behaviour

Return the clinic's most relevant request:

- Pending request, if one exists.
- Most recent approved or rejected request if there is no pending request.
- Clear empty state if no request exists.

Do not expose another clinic's request by changing a query parameter.

### Super Admin endpoints

Recommended endpoints:

```text
GET  /api/admin/clinic-upgrade-requests
POST /api/admin/clinic-upgrade-requests/:id/approve
POST /api/admin/clinic-upgrade-requests/:id/reject
```

The exact route names may follow current Admin naming conventions.

These routes must:

- Require the existing Super Admin authentication guard.
- Check that the request exists and has the expected current status.
- Validate all mutation bodies with Zod.
- Prevent a second approval or rejection from changing a completed request.
- Record reviewer and timestamp.
- Reuse storage methods and the existing paid-plan service.

### Completion checks

- [x] Clinic users cannot read or mutate another clinic's request.
- [x] Non-admin users cannot review requests.
- [x] Invalid plans, billing cycles, statuses, and IDs receive clean errors.
- [x] Repeated POST requests are safe.

---

## Step 6 — Add the Clinic Admin Trial banner

### Purpose

Make the next action obvious without interrupting the clinic's normal work.

### Placement

Place the banner at the top of the authenticated Clinic Admin dashboard, near the existing subscription/payment banner area.

Do not place it on the unauthenticated clinic login page because the clinic's subscription state is not known before login.

### Active Trial state

Show:

- Trial label
- Days remaining or Trial end date
- Short explanation of the Trial
- `Request upgrade` button

### Grace-period state

Show:

- Grace-period label
- Grace-period end date
- Clear warning that the Trial has ended
- `Request upgrade` button

### Pending request state

Show:

- Requested paid plan
- Billing cycle
- Date submitted
- `Upgrade request pending` state
- No duplicate submission button

### Rejected request state

Show:

- Rejection status
- Super Admin reason, if provided
- A way to submit a new request if the clinic is still eligible

### Expired state

Show:

- Trial ended message
- Grace period ended message, when applicable
- Support/admin review direction
- No normal conversion request unless the product rule is changed

### UI quality requirements

- Include loading, error, and empty states.
- Use the existing banner and button components.
- Keep the banner responsive on mobile.
- Keep warning colours consistent with the existing dashboard.
- Give all buttons and controls accessible names.
- Add `data-testid` attributes following project conventions.

---

## Step 7 — Add the upgrade request dialog

### Fields

The dialog should contain:

1. Paid plan:
   - Starter
   - Growth
   - Pro
2. Billing cycle:
   - Monthly
   - Annual
3. Optional reason or note for Super Admin

The dialog should display the selected plan's relevant benefit summary from the shared plan catalogue. It must not duplicate pricing or entitlements in a separate hardcoded ruleset.

### Submission behaviour

- Disable the submit button while saving.
- Show a clear success message.
- Close the dialog only after the server confirms success.
- Keep the form open and show a useful error when submission fails.
- If the server reports an existing pending request, show that request instead of treating it as a new one.
- Refresh the clinic's request query after submission.

### Completion checks

- The clinic can understand what it is requesting.
- The clinic cannot submit without a valid paid plan and billing cycle.
- A request is not submitted twice by double-clicking.
- The modal works on mobile and with keyboard navigation.

---

## Step 8 — Add the Super Admin Requests tab

### Purpose

Give Super Admin a focused queue for clinic upgrade requests.

### Navigation

Add a `Requests` tab to the existing Super Admin clinic/operations navigation. Do not create a second Admin page.

Show a pending-count badge on the tab.

### Request list

Show:

- Clinic name
- Current effective plan
- Requested plan
- Billing cycle
- Trial/grace state
- Request date
- Request age
- Status
- Review action

The list should support:

- Pending filter
- All/history filter
- Loading state
- Empty state
- Error state
- Retry

### Request detail

Show:

- Clinic identity needed for the review
- Requested plan and billing cycle
- Trial dates
- Clinic note
- Previous requests from the same clinic
- Current subscription state

Do not show unrelated patient or clinical information.

### Approve action

The approval confirmation should:

- Show the plan and billing cycle being approved.
- Allow Super Admin to confirm or change them if the product rules permit.
- Explain whether a payment/activation link will be created.
- Call the existing paid-plan workflow.
- Mark the request approved only after the workflow succeeds.

### Reject action

The rejection form should:

- Require a reason.
- Show a confirmation before submitting.
- Keep the request in history.
- Make the reason visible to the clinic.

### Completion checks

- The pending badge equals the server's pending count.
- Approve and reject actions are not shown to unauthorised users.
- A completed request cannot be processed again.
- Provider failures are shown without losing the request.

---

## Step 9 — Notify Super Admin in the Admin screen

### First release recommendation

Use the Requests tab as the authoritative notification surface:

- Pending badge in navigation.
- Visible notice when pending requests exist.
- Refresh the pending count and list periodically while Admin is open.
- Show an in-screen toast when a newly detected request appears.

The request table remains the source of truth if the browser is closed or a toast is missed.

### Why not extend the current notification system immediately

The current notification system is primarily user-ID based for clinic and doctor users, and its WebSocket routing does not currently provide a Super Admin-specific channel. Forcing upgrade requests into that path would add notification complexity without improving the durable request workflow.

### Optional later improvement

After the durable request flow is stable, a separate Super Admin WebSocket event can be added. It must remain a convenience notification only; it must not replace the request table or pending-count query.

---

## Step 10 — Preserve audit and lifecycle history

The implementation must continue using the existing subscription history rules:

- Current subscription fields are current-state snapshots.
- Subscription assignments are append-only.
- Subscription lifecycle history is append-only.
- Trial transitions remain idempotent.
- Paid plan activation remains provider-aware.
- Request history is not deleted after review.

At minimum, record:

- When the clinic requested an upgrade.
- Who reviewed it.
- When it was approved or rejected.
- What plan and billing cycle were requested.
- Any review reason.
- The resulting paid-plan assignment or activation attempt.

Do not treat a request submission as a paid-plan assignment. A request does not grant access.

---

## Step 11 — Add tests before release

### Registration tests

- Trial is displayed.
- Trial can be selected.
- Trial is accepted by backend validation.
- Invalid plan strings are rejected.
- The selected plan survives validation errors.
- Existing paid-plan registration still works.

### Approval tests

- Trial registration starts the existing Trial lifecycle after approval.
- Paid registration is not silently changed to Trial.
- Paid approval uses the existing provider-aware assignment process.
- Repeated approval is idempotent.
- Provider failure leaves a recoverable state.

### Request API tests

- Unauthenticated users are rejected.
- A clinic admin can create a request for their own clinic.
- A clinic cannot create a request for another clinic.
- Starter, Growth, and Pro are accepted.
- Trial is rejected as an upgrade target.
- Monthly and annual billing are accepted.
- Invalid billing cycles are rejected.
- Active Trial requests succeed.
- Grace-period requests succeed.
- Post-grace requests follow the approved product rule.
- Duplicate pending submissions return one request.
- Paid clinics cannot use the Trial conversion flow.

### Super Admin tests

- Only Super Admin can list requests.
- Pending count is accurate.
- Super Admin can approve a pending request.
- Super Admin can reject with a reason.
- Reject without a reason is blocked.
- A completed request cannot be approved or rejected again.
- Request history remains available.

### UI tests

- Active Trial banner appears.
- Grace banner uses the warning state.
- Pending request state prevents duplicate submission.
- Rejected request state shows the review reason.
- Expired state follows the approved rule.
- Requests tab shows pending badge.
- Loading, empty, error, and retry states work.
- Mobile layout remains usable.
- Keyboard and accessible-label checks pass.

---

## Step 12 — Run the project release gates

After all code for this feature is complete:

### Frontend gate

- Run the Build Check workflow.
- Confirm the build exits successfully.
- Scan for duplicate exported frontend types/constants.
- Scan for bare API fetches and hardcoded localhost URLs.
- Check that all new interactive controls have `data-testid`.

### Backend and database gate

- Confirm every new route has the correct auth guard.
- Confirm every mutating route validates request bodies with Zod.
- Confirm new storage methods exist in both `IStorage` and `DatabaseStorage`.
- Confirm schema changes exist in both `shared/schema.ts` and startup/migration SQL.
- Confirm all database changes are idempotent.
- Confirm exact Render SQL is documented.
- Confirm no route imports Drizzle directly when the repository requires storage methods.

### Functional gate

- Run focused registration tests.
- Run focused subscription and Trial tests.
- Run upgrade-request tests.
- Run the existing related test suite.
- Start the application workflow.
- Verify the Clinic Admin and Super Admin screens in the running preview.

Do not declare the feature complete until the Build Check passes.

---

## 6. Rollout plan

### Before deployment

- Confirm the commercial rules in Section 4.
- Take a database backup according to the normal release process.
- Apply the additive schema migration.
- Verify existing clinic plan and Trial fields.
- Verify existing pending clinics still appear in Admin.
- Verify the current paid-plan activation flow independently.

### Staged rollout

Recommended order:

1. Deploy the additive request table/field changes.
2. Deploy backend validation and APIs.
3. Deploy the registration Trial option.
4. Deploy the Clinic Admin banner and request dialog.
5. Deploy the Super Admin Requests tab.
6. Monitor request creation, duplicate handling, and provider activation.

If feature flags are available, keep the banner and request submission disabled until the backend and Admin review surface are ready.

### Monitoring

Watch for:

- Registration failures.
- Clinics approved with the wrong plan.
- Duplicate upgrade requests.
- Requests stuck in pending state.
- Provider activation failures.
- Trial date or grace-date mismatches.
- Incorrect pending counts.
- Unauthorized request access.

---

## 7. Rollback plan

If the release must be rolled back:

- Do not delete upgrade-request records.
- Do not reset Trial dates.
- Do not reverse a completed paid assignment automatically.
- Disable new request creation first.
- Keep Super Admin history readable.
- Keep already-approved payment/activation records consistent.
- Roll back UI separately from data if necessary.
- Only remove an additive schema element after confirming no deployed code still reads it.

If the problem is severe or risks corrupting subscription state, use the project's checkpoint rollback process rather than manually deleting subscription history.

---

## 8. Definition of done

The feature is complete only when all of the following are true:

- [x] Trial is visible and selectable during clinic registration.
- [x] The selected registration plan is preserved until approval.
- [x] Trial approval starts the existing Trial lifecycle.
- [x] Paid registration choices are not silently overwritten.
- [ ] Trial and grace status appear at the top of the authenticated Clinic Admin dashboard.
- [ ] Eligible clinics can select a paid plan and billing cycle.
- [ ] Upgrade requests are stored as durable records.
- [ ] Duplicate pending requests are prevented.
- [ ] Clinics can see their request status.
- [ ] Super Admin has a Requests tab with a pending count.
- [ ] Super Admin can approve or reject requests with proper permissions.
- [x] Approval reuses the existing paid-plan workflow.
- [ ] Rejection requires a reason.
- [ ] Request and subscription history are preserved.
- [ ] Super Admin receives an in-screen notification through the Requests tab/badge flow.
- [ ] Active, grace, pending, rejected, and expired states are tested.
- [ ] Build Check passes.
- [ ] Database and backend checklist gates pass.
- [x] No application implementation was started before this plan was approved.

---

## 9. Decisions that must be answered before implementation

The implementation can use the recommended defaults above, but these decisions should be explicitly confirmed:

1. Should a paid plan selected during registration go directly through paid activation after approval, or should the clinic first start Trial and use the selected paid plan only as a preference?
2. Should clinics be allowed to submit an upgrade request after the grace period ends?
3. Should Super Admin be allowed to change the requested plan or billing cycle during review?
4. Should the first release use polling and a Requests-tab badge, or is real-time Super Admin WebSocket delivery required immediately?
5. Should the clinic's optional request note be included in the first release?

Recommended answers:

1. Use the existing paid activation process for a paid registration selection; do not silently replace it with Trial.
2. Do not allow the normal request flow after grace; use support/admin review.
3. Allow Super Admin to confirm or adjust the plan and billing cycle only if that action is recorded in the review history.
4. Use polling and the pending badge first; add real-time delivery later.
5. Include an optional, length-limited note because it gives Super Admin useful context without changing subscription state.

---

## 10. Approval gate

No application code should be changed for this feature until the product owner confirms:

- The rules in Section 4.
- The answers in Section 9.
- The requested-plan data design in Step 2.
- The approval behaviour in Step 3.

Once approved, implementation should proceed from Step 0 through Step 12 in order.# Clinic Registration and Plan Suggestion

**Status:** Step 5 complete — Clinic registration, approval-plan handling, durable upgrade-request storage, and clinic upgrade-request APIs implemented; Super Admin review APIs remain pending
**Audience:** Product, Super Admin, clinic operations, frontend, backend, database, QA, and release teams  
**Primary goal:** Let a new clinic choose Trial during registration, give Trial clinics a clear path to request a paid upgrade, and give Super Admin one place to review and action those requests.

---

## 1. What this document covers

This is an independently executable implementation plan. A developer should be able to follow the steps in order without needing to reconstruct the original discussion.

The work covers:

1. Adding Trial as a clinic registration choice.
2. Preserving the clinic's selected plan until a Super Admin approves the registration.
3. Starting the correct plan when the clinic is approved.
4. Showing Trial status at the top of the authenticated Clinic Admin dashboard.
5. Allowing a Trial clinic to request Starter, Growth, or Pro.
6. Preventing duplicate upgrade requests.
7. Showing pending upgrade requests to Super Admin.
8. Notifying Super Admin in the Admin screen when requests are waiting.
9. Reusing the existing audited paid-plan and payment workflow.
10. Testing, migrating, releasing, and rolling back the feature safely.

This document does **not** authorize implementation by itself. It is the plan to approve before application changes begin.

---

## 2. Plain-language outcome

After implementation, the flow should work like this:

```text
Clinic opens registration
        ↓
Clinic chooses Trial, Starter, Growth, or Pro
        ↓
The choice is saved as a requested plan
        ↓
Super Admin reviews the registration
        ↓
Super Admin approves the clinic
        ↓
Trial starts, or the selected paid-plan process begins
        ↓
Trial clinic sees a dashboard upgrade banner
        ↓
Clinic chooses a paid plan and billing cycle
        ↓
Clinic submits one upgrade request
        ↓
Super Admin sees a Requests tab and pending count
        ↓
Super Admin approves or rejects the request
        ↓
Approved requests use the existing provider-aware paid-plan workflow
```

The request itself must not silently change the clinic's plan. A request is only a request until Super Admin reviews it and the paid-plan process succeeds.

---

## 3. Current application facts to preserve

Before making changes, confirm these facts in the current source rather than assuming they have not changed:

- `shared/plan-catalog.ts` already contains Trial.
- Trial is currently defined as a 14-day plan with a 7-day grace period.
- The clinic model already has Trial lifecycle fields such as:
  - `trialStartedAt`
  - `trialEndsAt`
  - `trialGraceEndsAt`
  - `trialOrigin`
  - `previousPaidPlan`
- Subscription assignment and lifecycle history tables already exist.
- Registration currently displays Starter, Growth, and Pro.
- Registration already sends a selected plan to the registration endpoint.
- Current clinic approval starts Trial for every approved clinic, regardless of the selected registration plan.
- `ClinicDashboard.tsx` already contains a subscription-payment-pending banner.
- `ClinicEntitlementSettingsPanel.tsx` already understands Trial and Trial grace states.
- Super Admin already has an audited paid-plan assignment route.
- Existing notifications are mainly clinic- and doctor-focused.
- The current notification WebSocket routing does not provide a dedicated Super Admin upgrade-request channel.

These facts mean this feature should extend existing subscription behaviour rather than create a second plan catalogue, a second Trial timer, or a second paid activation workflow.

---

## 4. Product rules to confirm before coding

The following rules are the recommended default. Product or operations should confirm them before implementation begins.

### 4.1 Trial rules

- Trial remains the existing 14-day Trial.
- Trial remains the existing 7-day grace period.
- Trial does not require a payment card.
- Trial is available as an initial registration choice.
- Trial access is controlled by the existing entitlement catalogue.
- Trial dates are created only when the clinic is approved, not when the registration form is submitted.

### 4.2 Paid-plan request rules

- A clinic may request Starter, Growth, or Pro.
- A clinic must choose monthly or annual billing.
- A clinic cannot request Trial as an upgrade.
- Only the clinic's authenticated owner/admin can submit the request.
- A clinic may have only one pending upgrade request.
- Repeated clicks or network retries return the existing pending request instead of creating another one.
- Submitting a request does not activate the paid plan.
- Active paid clinics do not use this Trial upgrade-request flow.

### 4.3 Timing rules

Recommended default:

- Upgrade requests are allowed while Trial is active.
- Upgrade requests are allowed during the Trial grace period.
- After grace ends, the dashboard shows that the Trial has ended and directs the clinic to Super Admin/support review.
- After grace ends, the normal conversion endpoint does not create a new request unless Product explicitly approves that behaviour.

This follows the existing Trial conversion eligibility rules and prevents expired clinics from creating an unlimited recovery path.

### 4.4 Approval rules

- A Trial registration approved by Super Admin starts the existing Trial lifecycle.
- A paid registration choice must not be silently replaced by Trial.
- If a clinic requested a paid plan at registration, Super Admin must confirm the paid plan and billing cycle through the existing paid-plan workflow.
- A paid subscription is not considered active merely because an upgrade request was approved.
- The request is marked approved only after the paid-plan workflow successfully creates the required activation/payment action.
- If payment-provider setup fails, the request remains pending and the failure is visible to Super Admin.

---

## 5. Implementation sequence

Complete the following steps in order. Do not skip the data and permission steps in favour of only changing the screens.

---

## Step 0 — Record the baseline before editing — COMPLETE

**Baseline checked:** 2026-09-19, Asia/Calcutta  
**Scope:** Read-only inspection of the current registration, approval, subscription, Trial, Clinic Admin, Super Admin, notification, schema, migration, and test entry points.

### Purpose

Capture the current behaviour so a later test can distinguish an intentional change from an accidental regression.

### Verified registration behaviour

- **Registration screen:** `client/src/pages/RegisterClinic.tsx`
  - `PLAN_OPTIONS` currently contains only `starter`, `growth`, and `pro`.
  - The selected plan state is typed as `"starter" | "growth" | "pro" | ""`.
  - The plan selector is shown after email verification.
  - The form sends the selected value as `plan` in `POST /api/clinics/register`.
  - The current payment message says a secure payment link for the chosen plan will be sent after approval.
- **Registration route:** `server/routes.ts`, `POST /api/clinics/register`
  - Requires a verified email token.
  - Removes verification and optional document fields from the request body.
  - Creates the clinic with `status: "pending"`.
  - Passes the remaining fields, including the submitted `plan`, into storage.
  - Does not currently run the complete registration body through a dedicated Zod `safeParse()` before storage.
- **Clinic data model:** `shared/schema.ts`
  - `clinics.plan` currently defaults to `"starter"`.
  - There is no separate `requestedPlan` field.
  - The current model already contains `trialStartedAt`, `trialEndsAt`, `trialGraceEndsAt`, `trialOrigin`, `previousPaidPlan`, and `subscriptionPolicyVersion`.

### Verified approval behaviour

- **Approval route:** `server/routes.ts`, `PATCH /api/clinics/:id/approve`
  - Uses `isAuthenticated` and then checks for the `superuser` role.
  - Only pending clinics can be approved.
  - Builds the initial Trial from the shared policy catalogue.
  - Uses the current Trial policy values of 14 days plus 7 grace days.
  - Generates clinic credentials and sends the approval email.
  - Always updates the approved clinic to:
    - `plan: "trial"`
    - `subscriptionStatus: "trialing"`
    - The newly calculated Trial dates and origin
  - Does not currently use the clinic's selected registration plan to choose the approval result.
  - Writes a Trial assignment to `subscriptionPlanAssignments`.
  - Writes a `trial_started` event to `subscriptionLifecycleEvents`.
- **Confirmed mismatch:** A clinic can submit a paid plan value from the registration form, but approval currently replaces that choice with Trial. Adding only a Trial card would not fix the complete workflow.

### Verified Trial and plan policy behaviour

- **Shared catalogue:** `shared/plan-catalog.ts`
  - `PLAN_KEYS` contains `trial`, `starter`, `growth`, and `pro`.
  - `PAID_PLAN_KEYS` contains `starter`, `growth`, and `pro`.
  - Valid billing cycles are `monthly` and `annual`.
  - Trial is a no-card plan with a 14-day duration and 7-day grace period.
  - Trial currently allows 10 lifetime bookings, 1 active doctor, and 50 MB storage.
- **Trial helpers:** `shared/trial-lifecycle.ts`
  - Existing helpers build initial Trial windows.
  - Existing helpers determine Trial phase and conversion eligibility.
  - The current policy treats a Trial as conversion-eligible during the active Trial or grace period, not after grace expiry.
- **Existing tests:**
  - `shared/trial-lifecycle.test.ts`
  - `shared/plan-catalog.test.ts`
  - `shared/subscription-lifecycle.test.ts`
  - `shared/subscription-status.test.ts`
  - `shared/effective-entitlement.test.ts`

### Verified paid-plan activation behaviour

- **Existing route:** `server/routes.ts`, `POST /api/admin/clinics/:id/paid-plan`
  - Requires the Super Admin role.
  - Validates plan, billing cycle, reason, and optional transition ID with Zod.
  - Uses a transition ID to make repeated requests idempotent.
  - Creates a Razorpay subscription when provider configuration is available.
  - Creates an activation token and payment link.
  - Sets the clinic to `pending_payment`, rather than pretending that payment has completed.
  - Writes a `subscriptionPlanAssignments` record.
  - Writes either a `converted` or `plan_assigned` lifecycle event.
  - Returns the activation URL to the Admin client.
- **Implementation consequence:** Upgrade-request approval must reuse this provider-aware workflow instead of creating another paid-plan assignment path.

### Verified Clinic Admin surface

- **Main page:** `client/src/pages/ClinicDashboard.tsx`
  - The current subscription banner only handles `subscriptionStatus === "pending_payment"`.
  - It tells the clinic that payment is pending and provides a support link.
  - There is no Trial-active, Trial-grace, upgrade-request, rejected-request, or Trial-expired banner yet.
- **Existing entitlement panel:** `client/src/components/ClinicEntitlementSettingsPanel.tsx`
  - Loads `/api/auth/clinic/settings/entitlements`.
  - Already displays Trial and Trial grace states.
  - Already displays Trial start, Trial end, and grace end dates.
  - This component is a reusable source for Trial state presentation, but it is not currently the requested top-of-dashboard upgrade flow.

### Verified Super Admin surface

- **Main page:** `client/src/pages/Admin.tsx`
  - Existing Clinic lifecycle tabs are `Clinics & Access`, `Pending`, and `Archived`.
  - Existing Operations tabs are `Platform Operations`, `Tenant Operations`, and `Clinic Monitoring`.
  - Existing Growth/governance tabs include `Smile Deals`, `Plan Policies`, and `Security & Audit`.
  - There is currently no `Requests` tab or upgrade-request count.
  - The Pending registration approval action calls `PATCH /api/clinics/:id/approve` and currently tells the Admin that the clinic has started a 14-day Trial.
- **Existing Admin access pattern:** Super Admin routes use `isAuthenticated` followed by a role check for `superuser`.

### Verified notification and realtime behaviour

- **Notification storage:** `notifications` is user-ID based and currently supports clinic/doctor notification ownership.
- **Notification storage methods:** `server/storage.ts` reads and updates notifications by the scoped `userId`.
- **Role scoping:** Existing notification migrations use `clinic:` and `doctor:` prefixes to prevent numeric-ID collisions.
- **Current result:** There is no dedicated Super Admin upgrade-request notification channel or durable Admin request queue.
- **Implementation consequence:** The first release should use the upgrade-request table as the source of truth, with a Super Admin Requests-tab badge and refresh/toast behaviour. A dedicated Admin WebSocket channel can remain a later enhancement.

### Verified database and migration conventions

- **Schema definitions:** New Drizzle tables and columns belong in `shared/schema.ts`.
- **Startup compatibility SQL:** Existing additive schema checks are also present in `server/index.ts`, using idempotent `IF NOT EXISTS` blocks.
- **Subscription history:** `subscriptionLifecycleEvents` and `subscriptionPlanAssignments` already have clinic indexes and unique transition IDs.
- **Implementation consequence:** Any new requested-plan column or upgrade-request table must follow both the Drizzle schema and startup SQL/migration requirements. Existing subscription history must not be replaced or deleted.

### Verified test and quality commands

The current `package.json` provides these relevant commands:

```text
npm run build
npm run check
npm run test:subscription-entitlements
npm run test:subscription-baseline
npm run test:e2e
```

The existing Build Check workflow runs the production build command. The feature implementation must run the Build Check after code changes; Step 0 itself required no build or application restart because it changed no runtime code.

### Step 0 completion check

- [x] Current registration plan values recorded.
- [x] Registration payload and backend handling recorded.
- [x] Current approval behaviour recorded.
- [x] Existing Trial fields, catalogue, and eligibility helpers recorded.
- [x] Existing paid-plan activation route and idempotency behaviour recorded.
- [x] Clinic Dashboard banner area recorded.
- [x] Super Admin navigation and approval surface recorded.
- [x] Authentication and role-check patterns recorded.
- [x] Existing subscription assignment and lifecycle writes recorded.
- [x] Existing notification limitation recorded.
- [x] Existing test and build commands recorded.
- [x] No application code, database schema, route, or UI was changed.

**Step 0 result:** Complete. The baseline was recorded before implementation.

---

## Step 1 — Add Trial to the registration screen — COMPLETE

### Purpose

Give a new clinic a visible and understandable Trial option.

### UI work

Update the registration plan selector to show:

1. Trial
2. Starter
3. Growth
4. Pro

Keep the current visual language and layout. The Trial card should clearly say:

- Free
- 14 days
- No card required
- What the Trial includes
- What happens after Trial and grace end

The copy must not imply that Trial is a permanent free plan or that every feature is unlimited.

### Form behaviour

- Trial must be a valid selectable value.
- The form must not submit an unknown plan value.
- If the form requires a plan selection, the error message must mention that a plan must be selected.
- The selected plan must remain selected when the user navigates between registration steps or receives a validation error.
- The submission must use the project's shared API request helper, not a bare browser `fetch`.

### Completion checks

- A user can select Trial.
- Trial is visibly different from paid plans without hiding the paid options.
- The registration payload contains `trial` when Trial is selected.
- Existing Starter, Growth, and Pro registration still works.
- The card is usable on a narrow mobile screen.
- Labels, buttons, and selection controls are keyboard accessible.

### Step 1 progress record

Step 1 is complete.

- Added Trial to the registration selector using the shared plan catalogue.
- Trial displays as Free, 14 days, and No card required.
- Trial is visually distinct from paid plans without hiding Starter, Growth,
  or Pro.
- Trial copy explains the seven-day grace period and the next action after
  Trial.
- Paid registration copy now reflects the agreed Trial-first flow: approved
  clinics start with Trial access and the selected paid plan is retained for
  later payment activation.
- The existing shared API request helper remains in use, and selecting Trial
  submits `requestedPlan: "trial"`.
- The selector remains responsive and uses keyboard-accessible buttons with
  pressed-state semantics.

Step 2 must add validated requested-plan storage before the backend can safely
distinguish a registration preference from the clinic's active plan.

---

## Step 2 — Preserve the requested plan during registration — COMPLETE

### Purpose

Separate what a clinic asks for from the plan it currently has.

### Recommended data design

Add a nullable field to the pending clinic record:

```text
requestedPlan
```

The field should accept only:

```text
trial
starter
growth
pro
```

Do not use an unapproved registration choice as if it were an active subscription.

If the current `clinics.plan` field is already explicitly documented as the requested plan for pending clinics, the implementation team may preserve that contract instead of adding a new column. This must be confirmed by inspecting all reads and writes first. Do not mix both meanings silently.

### Backend work

- Add the field to `shared/schema.ts` if a new column is required.
- Add the matching idempotent startup SQL in `server/index.ts`, following the project’s dual-registration rule.
- Update the insert schema and registration route validation.
- Validate the plan with the canonical plan catalogue.
- Save the selected plan to the pending clinic record.
- Do not start Trial during registration.
- Do not create a paid subscription during registration.

### Migration requirements

If a column is added:

- The column must be nullable or have a safe default.
- The SQL must use `IF NOT EXISTS`.
- Existing clinics must keep their current effective plan and subscription state.
- The exact SQL needed for the Render database must be documented.
- No existing migration block should be edited; add an append-only migration/startup block according to project convention.

### Completion checks

- A pending clinic retains the selected plan after registration.
- Existing pending clinics continue to load.
- Registration cannot store arbitrary plan strings.
- No subscription or Trial timer is created before approval.

---

## Step 3 — Make Super Admin approval honour the requested plan — COMPLETE

### Purpose

Remove the current mismatch where every approved clinic is started on Trial even when the clinic selected a paid plan.

### Trial approval path

When the requested plan is Trial:

- Approve the clinic.
- Start the existing Trial lifecycle.
- Set the existing Trial timestamps and origin.
- Create the existing subscription assignment and lifecycle records.
- Keep the clinic's current access consistent with the shared plan catalogue.
- Send the existing approval notification/credentials.

### Paid approval path

When the requested plan is Starter, Growth, or Pro:

- Show the requested plan to Super Admin.
- Require confirmation of the paid plan and billing cycle.
- Use the existing paid-plan assignment workflow.
- Do not directly mark the clinic as fully paid unless the existing provider-aware process says that is valid.
- Keep provider activation, payment-link creation, lifecycle history, and idempotency in the shared service.

### Failure behaviour

- If paid activation cannot be prepared, do not mark the request or clinic as successfully paid.
- Return a useful error to Super Admin.
- Keep the clinic in a recoverable pending state.
- Do not create duplicate provider subscriptions on retry.

### Completion checks

- Trial selection starts Trial only after approval.
- Paid selection is not silently converted to Trial.
- The existing paid-plan route and the new approval path produce the same lifecycle records.
- Repeating an approval request does not create duplicate assignments or provider subscriptions.

---

## Step 4 — Add the upgrade-request data model — COMPLETE

### Purpose

Keep upgrade requests as a durable business record instead of representing them only as a temporary notification.

### Recommended table

Create a table named according to the project's naming convention, for example:

```text
clinic_upgrade_requests
```

Recommended fields:

| Field | Purpose |
|---|---|
| `id` | Unique request identifier |
| `clinicId` | Clinic that submitted the request |
| `requestedPlan` | Starter, Growth, or Pro |
| `billingCycle` | Monthly or annual |
| `status` | Pending, approved, rejected, or cancelled |
| `clinicReason` | Optional explanation from the clinic |
| `requestedAt` | When the clinic submitted the request |
| `reviewedAt` | When Super Admin completed review |
| `reviewedBy` | Super Admin identity |
| `reviewReason` | Approval or rejection note |
| `createdAt` | Record creation time |
| `updatedAt` | Last record update time |

Use the repository's existing timestamp, foreign-key, and enum conventions rather than introducing a new style.

### Rules

- Keep completed requests; do not delete them after review.
- Add an index for clinic and status.
- Add an index for pending requests ordered by creation time.
- Enforce one pending request per clinic at the database level when supported by the current migration approach.
- Also enforce the rule in storage/application code because database uniqueness alone is not enough for safe retry handling.
- Do not store payment credentials in this table.
- Do not store sensitive clinical or patient information.

### Completion checks

- [x] A request can be listed after the browser is closed.
- [x] Old approved and rejected requests remain available for audit.
- [x] Two simultaneous submissions cannot create two pending requests.

---

## Step 5 — Add clinic upgrade-request APIs — COMPLETE

### Clinic endpoints

Use the project's existing clinic-authenticated route convention. Recommended endpoints:

```text
POST /api/auth/clinic/subscription/upgrade-requests
GET  /api/auth/clinic/subscription/upgrade-request
```

The exact route name may follow existing subscription naming, but the behaviour must remain the same.

### POST validation

The route must:

- Require an authenticated clinic session.
- Read the clinic ID from the session, not from a browser-supplied clinic ID.
- Validate the body with Zod before storage.
- Accept only Starter, Growth, or Pro.
- Accept only monthly or annual billing.
- Optionally accept a bounded-length reason.
- Confirm the clinic's current effective plan is Trial.
- Confirm the Trial is active or in grace.
- Reject clinics with an existing pending request.
- Return the existing pending request for a safe retry when appropriate.

The route must not:

- Accept Trial as a paid upgrade target.
- Accept provider identifiers or payment credentials.
- Directly change the clinic's effective plan.
- Trust a browser-supplied eligibility flag.

### GET behaviour

Return the clinic's most relevant request:

- Pending request, if one exists.
- Most recent approved or rejected request if there is no pending request.
- Clear empty state if no request exists.

Do not expose another clinic's request by changing a query parameter.

### Super Admin endpoints

Recommended endpoints:

```text
GET  /api/admin/clinic-upgrade-requests
POST /api/admin/clinic-upgrade-requests/:id/approve
POST /api/admin/clinic-upgrade-requests/:id/reject
```

The exact route names may follow current Admin naming conventions.

These routes must:

- Require the existing Super Admin authentication guard.
- Check that the request exists and has the expected current status.
- Validate all mutation bodies with Zod.
- Prevent a second approval or rejection from changing a completed request.
- Record reviewer and timestamp.
- Reuse storage methods and the existing paid-plan service.

### Completion checks

- [x] Clinic users cannot read or mutate another clinic's request.
- [x] Non-admin users cannot review requests.
- [x] Invalid plans, billing cycles, statuses, and IDs receive clean errors.
- [x] Repeated POST requests are safe.

---

## Step 6 — Add the Clinic Admin Trial banner

### Purpose

Make the next action obvious without interrupting the clinic's normal work.

### Placement

Place the banner at the top of the authenticated Clinic Admin dashboard, near the existing subscription/payment banner area.

Do not place it on the unauthenticated clinic login page because the clinic's subscription state is not known before login.

### Active Trial state

Show:

- Trial label
- Days remaining or Trial end date
- Short explanation of the Trial
- `Request upgrade` button

### Grace-period state

Show:

- Grace-period label
- Grace-period end date
- Clear warning that the Trial has ended
- `Request upgrade` button

### Pending request state

Show:

- Requested paid plan
- Billing cycle
- Date submitted
- `Upgrade request pending` state
- No duplicate submission button

### Rejected request state

Show:

- Rejection status
- Super Admin reason, if provided
- A way to submit a new request if the clinic is still eligible

### Expired state

Show:

- Trial ended message
- Grace period ended message, when applicable
- Support/admin review direction
- No normal conversion request unless the product rule is changed

### UI quality requirements

- Include loading, error, and empty states.
- Use the existing banner and button components.
- Keep the banner responsive on mobile.
- Keep warning colours consistent with the existing dashboard.
- Give all buttons and controls accessible names.
- Add `data-testid` attributes following project conventions.

---

## Step 7 — Add the upgrade request dialog

### Fields

The dialog should contain:

1. Paid plan:
   - Starter
   - Growth
   - Pro
2. Billing cycle:
   - Monthly
   - Annual
3. Optional reason or note for Super Admin

The dialog should display the selected plan's relevant benefit summary from the shared plan catalogue. It must not duplicate pricing or entitlements in a separate hardcoded ruleset.

### Submission behaviour

- Disable the submit button while saving.
- Show a clear success message.
- Close the dialog only after the server confirms success.
- Keep the form open and show a useful error when submission fails.
- If the server reports an existing pending request, show that request instead of treating it as a new one.
- Refresh the clinic's request query after submission.

### Completion checks

- The clinic can understand what it is requesting.
- The clinic cannot submit without a valid paid plan and billing cycle.
- A request is not submitted twice by double-clicking.
- The modal works on mobile and with keyboard navigation.

---

## Step 8 — Add the Super Admin Requests tab

### Purpose

Give Super Admin a focused queue for clinic upgrade requests.

### Navigation

Add a `Requests` tab to the existing Super Admin clinic/operations navigation. Do not create a second Admin page.

Show a pending-count badge on the tab.

### Request list

Show:

- Clinic name
- Current effective plan
- Requested plan
- Billing cycle
- Trial/grace state
- Request date
- Request age
- Status
- Review action

The list should support:

- Pending filter
- All/history filter
- Loading state
- Empty state
- Error state
- Retry

### Request detail

Show:

- Clinic identity needed for the review
- Requested plan and billing cycle
- Trial dates
- Clinic note
- Previous requests from the same clinic
- Current subscription state

Do not show unrelated patient or clinical information.

### Approve action

The approval confirmation should:

- Show the plan and billing cycle being approved.
- Allow Super Admin to confirm or change them if the product rules permit.
- Explain whether a payment/activation link will be created.
- Call the existing paid-plan workflow.
- Mark the request approved only after the workflow succeeds.

### Reject action

The rejection form should:

- Require a reason.
- Show a confirmation before submitting.
- Keep the request in history.
- Make the reason visible to the clinic.

### Completion checks

- The pending badge equals the server's pending count.
- Approve and reject actions are not shown to unauthorised users.
- A completed request cannot be processed again.
- Provider failures are shown without losing the request.

---

## Step 9 — Notify Super Admin in the Admin screen

### First release recommendation

Use the Requests tab as the authoritative notification surface:

- Pending badge in navigation.
- Visible notice when pending requests exist.
- Refresh the pending count and list periodically while Admin is open.
- Show an in-screen toast when a newly detected request appears.

The request table remains the source of truth if the browser is closed or a toast is missed.

### Why not extend the current notification system immediately

The current notification system is primarily user-ID based for clinic and doctor users, and its WebSocket routing does not currently provide a Super Admin-specific channel. Forcing upgrade requests into that path would add notification complexity without improving the durable request workflow.

### Optional later improvement

After the durable request flow is stable, a separate Super Admin WebSocket event can be added. It must remain a convenience notification only; it must not replace the request table or pending-count query.

---

## Step 10 — Preserve audit and lifecycle history

The implementation must continue using the existing subscription history rules:

- Current subscription fields are current-state snapshots.
- Subscription assignments are append-only.
- Subscription lifecycle history is append-only.
- Trial transitions remain idempotent.
- Paid plan activation remains provider-aware.
- Request history is not deleted after review.

At minimum, record:

- When the clinic requested an upgrade.
- Who reviewed it.
- When it was approved or rejected.
- What plan and billing cycle were requested.
- Any review reason.
- The resulting paid-plan assignment or activation attempt.

Do not treat a request submission as a paid-plan assignment. A request does not grant access.

---

## Step 11 — Add tests before release

### Registration tests

- Trial is displayed.
- Trial can be selected.
- Trial is accepted by backend validation.
- Invalid plan strings are rejected.
- The selected plan survives validation errors.
- Existing paid-plan registration still works.

### Approval tests

- Trial registration starts the existing Trial lifecycle after approval.
- Paid registration is not silently changed to Trial.
- Paid approval uses the existing provider-aware assignment process.
- Repeated approval is idempotent.
- Provider failure leaves a recoverable state.

### Request API tests

- Unauthenticated users are rejected.
- A clinic admin can create a request for their own clinic.
- A clinic cannot create a request for another clinic.
- Starter, Growth, and Pro are accepted.
- Trial is rejected as an upgrade target.
- Monthly and annual billing are accepted.
- Invalid billing cycles are rejected.
- Active Trial requests succeed.
- Grace-period requests succeed.
- Post-grace requests follow the approved product rule.
- Duplicate pending submissions return one request.
- Paid clinics cannot use the Trial conversion flow.

### Super Admin tests

- Only Super Admin can list requests.
- Pending count is accurate.
- Super Admin can approve a pending request.
- Super Admin can reject with a reason.
- Reject without a reason is blocked.
- A completed request cannot be approved or rejected again.
- Request history remains available.

### UI tests

- Active Trial banner appears.
- Grace banner uses the warning state.
- Pending request state prevents duplicate submission.
- Rejected request state shows the review reason.
- Expired state follows the approved rule.
- Requests tab shows pending badge.
- Loading, empty, error, and retry states work.
- Mobile layout remains usable.
- Keyboard and accessible-label checks pass.

---

## Step 12 — Run the project release gates

After all code for this feature is complete:

### Frontend gate

- Run the Build Check workflow.
- Confirm the build exits successfully.
- Scan for duplicate exported frontend types/constants.
- Scan for bare API fetches and hardcoded localhost URLs.
- Check that all new interactive controls have `data-testid`.

### Backend and database gate

- Confirm every new route has the correct auth guard.
- Confirm every mutating route validates request bodies with Zod.
- Confirm new storage methods exist in both `IStorage` and `DatabaseStorage`.
- Confirm schema changes exist in both `shared/schema.ts` and startup/migration SQL.
- Confirm all database changes are idempotent.
- Confirm exact Render SQL is documented.
- Confirm no route imports Drizzle directly when the repository requires storage methods.

### Functional gate

- Run focused registration tests.
- Run focused subscription and Trial tests.
- Run upgrade-request tests.
- Run the existing related test suite.
- Start the application workflow.
- Verify the Clinic Admin and Super Admin screens in the running preview.

Do not declare the feature complete until the Build Check passes.

---

## 6. Rollout plan

### Before deployment

- Confirm the commercial rules in Section 4.
- Take a database backup according to the normal release process.
- Apply the additive schema migration.
- Verify existing clinic plan and Trial fields.
- Verify existing pending clinics still appear in Admin.
- Verify the current paid-plan activation flow independently.

### Staged rollout

Recommended order:

1. Deploy the additive request table/field changes.
2. Deploy backend validation and APIs.
3. Deploy the registration Trial option.
4. Deploy the Clinic Admin banner and request dialog.
5. Deploy the Super Admin Requests tab.
6. Monitor request creation, duplicate handling, and provider activation.

If feature flags are available, keep the banner and request submission disabled until the backend and Admin review surface are ready.

### Monitoring

Watch for:

- Registration failures.
- Clinics approved with the wrong plan.
- Duplicate upgrade requests.
- Requests stuck in pending state.
- Provider activation failures.
- Trial date or grace-date mismatches.
- Incorrect pending counts.
- Unauthorized request access.

---

## 7. Rollback plan

If the release must be rolled back:

- Do not delete upgrade-request records.
- Do not reset Trial dates.
- Do not reverse a completed paid assignment automatically.
- Disable new request creation first.
- Keep Super Admin history readable.
- Keep already-approved payment/activation records consistent.
- Roll back UI separately from data if necessary.
- Only remove an additive schema element after confirming no deployed code still reads it.

If the problem is severe or risks corrupting subscription state, use the project's checkpoint rollback process rather than manually deleting subscription history.

---

## 8. Definition of done

The feature is complete only when all of the following are true:

- [x] Trial is visible and selectable during clinic registration.
- [x] The selected registration plan is preserved until approval.
- [x] Trial approval starts the existing Trial lifecycle.
- [x] Paid registration choices are not silently overwritten.
- [ ] Trial and grace status appear at the top of the authenticated Clinic Admin dashboard.
- [ ] Eligible clinics can select a paid plan and billing cycle.
- [ ] Upgrade requests are stored as durable records.
- [ ] Duplicate pending requests are prevented.
- [ ] Clinics can see their request status.
- [ ] Super Admin has a Requests tab with a pending count.
- [ ] Super Admin can approve or reject requests with proper permissions.
- [x] Approval reuses the existing paid-plan workflow.
- [ ] Rejection requires a reason.
- [ ] Request and subscription history are preserved.
- [ ] Super Admin receives an in-screen notification through the Requests tab/badge flow.
- [ ] Active, grace, pending, rejected, and expired states are tested.
- [ ] Build Check passes.
- [ ] Database and backend checklist gates pass.
- [x] No application implementation was started before this plan was approved.

---

## 9. Decisions that must be answered before implementation

The implementation can use the recommended defaults above, but these decisions should be explicitly confirmed:

1. Should a paid plan selected during registration go directly through paid activation after approval, or should the clinic first start Trial and use the selected paid plan only as a preference?
2. Should clinics be allowed to submit an upgrade request after the grace period ends?
3. Should Super Admin be allowed to change the requested plan or billing cycle during review?
4. Should the first release use polling and a Requests-tab badge, or is real-time Super Admin WebSocket delivery required immediately?
5. Should the clinic's optional request note be included in the first release?

Recommended answers:

1. Use the existing paid activation process for a paid registration selection; do not silently replace it with Trial.
2. Do not allow the normal request flow after grace; use support/admin review.
3. Allow Super Admin to confirm or adjust the plan and billing cycle only if that action is recorded in the review history.
4. Use polling and the pending badge first; add real-time delivery later.
5. Include an optional, length-limited note because it gives Super Admin useful context without changing subscription state.

---

## 10. Approval gate

No application code should be changed for this feature until the product owner confirms:

- The rules in Section 4.
- The answers in Section 9.
- The requested-plan data design in Step 2.
- The approval behaviour in Step 3.

Once approved, implementation should proceed from Step 0 through Step 12 in order.# Clinic Registration and Plan Suggestion

**Status:** Step 5 complete — Clinic registration, approval-plan handling, durable upgrade-request storage, and clinic upgrade-request APIs implemented; Super Admin review APIs remain pending
**Audience:** Product, Super Admin, clinic operations, frontend, backend, database, QA, and release teams  
**Primary goal:** Let a new clinic choose Trial during registration, give Trial clinics a clear path to request a paid upgrade, and give Super Admin one place to review and action those requests.

---

## 1. What this document covers

This is an independently executable implementation plan. A developer should be able to follow the steps in order without needing to reconstruct the original discussion.

The work covers:

1. Adding Trial as a clinic registration choice.
2. Preserving the clinic's selected plan until a Super Admin approves the registration.
3. Starting the correct plan when the clinic is approved.
4. Showing Trial status at the top of the authenticated Clinic Admin dashboard.
5. Allowing a Trial clinic to request Starter, Growth, or Pro.
6. Preventing duplicate upgrade requests.
7. Showing pending upgrade requests to Super Admin.
8. Notifying Super Admin in the Admin screen when requests are waiting.
9. Reusing the existing audited paid-plan and payment workflow.
10. Testing, migrating, releasing, and rolling back the feature safely.

This document does **not** authorize implementation by itself. It is the plan to approve before application changes begin.

---

## 2. Plain-language outcome

After implementation, the flow should work like this:

```text
Clinic opens registration
        ↓
Clinic chooses Trial, Starter, Growth, or Pro
        ↓
The choice is saved as a requested plan
        ↓
Super Admin reviews the registration
        ↓
Super Admin approves the clinic
        ↓
Trial starts, or the selected paid-plan process begins
        ↓
Trial clinic sees a dashboard upgrade banner
        ↓
Clinic chooses a paid plan and billing cycle
        ↓
Clinic submits one upgrade request
        ↓
Super Admin sees a Requests tab and pending count
        ↓
Super Admin approves or rejects the request
        ↓
Approved requests use the existing provider-aware paid-plan workflow
```

The request itself must not silently change the clinic's plan. A request is only a request until Super Admin reviews it and the paid-plan process succeeds.

---

## 3. Current application facts to preserve

Before making changes, confirm these facts in the current source rather than assuming they have not changed:

- `shared/plan-catalog.ts` already contains Trial.
- Trial is currently defined as a 14-day plan with a 7-day grace period.
- The clinic model already has Trial lifecycle fields such as:
  - `trialStartedAt`
  - `trialEndsAt`
  - `trialGraceEndsAt`
  - `trialOrigin`
  - `previousPaidPlan`
- Subscription assignment and lifecycle history tables already exist.
- Registration currently displays Starter, Growth, and Pro.
- Registration already sends a selected plan to the registration endpoint.
- Current clinic approval starts Trial for every approved clinic, regardless of the selected registration plan.
- `ClinicDashboard.tsx` already contains a subscription-payment-pending banner.
- `ClinicEntitlementSettingsPanel.tsx` already understands Trial and Trial grace states.
- Super Admin already has an audited paid-plan assignment route.
- Existing notifications are mainly clinic- and doctor-focused.
- The current notification WebSocket routing does not provide a dedicated Super Admin upgrade-request channel.

These facts mean this feature should extend existing subscription behaviour rather than create a second plan catalogue, a second Trial timer, or a second paid activation workflow.

---

## 4. Product rules to confirm before coding

The following rules are the recommended default. Product or operations should confirm them before implementation begins.

### 4.1 Trial rules

- Trial remains the existing 14-day Trial.
- Trial remains the existing 7-day grace period.
- Trial does not require a payment card.
- Trial is available as an initial registration choice.
- Trial access is controlled by the existing entitlement catalogue.
- Trial dates are created only when the clinic is approved, not when the registration form is submitted.

### 4.2 Paid-plan request rules

- A clinic may request Starter, Growth, or Pro.
- A clinic must choose monthly or annual billing.
- A clinic cannot request Trial as an upgrade.
- Only the clinic's authenticated owner/admin can submit the request.
- A clinic may have only one pending upgrade request.
- Repeated clicks or network retries return the existing pending request instead of creating another one.
- Submitting a request does not activate the paid plan.
- Active paid clinics do not use this Trial upgrade-request flow.

### 4.3 Timing rules

Recommended default:

- Upgrade requests are allowed while Trial is active.
- Upgrade requests are allowed during the Trial grace period.
- After grace ends, the dashboard shows that the Trial has ended and directs the clinic to Super Admin/support review.
- After grace ends, the normal conversion endpoint does not create a new request unless Product explicitly approves that behaviour.

This follows the existing Trial conversion eligibility rules and prevents expired clinics from creating an unlimited recovery path.

### 4.4 Approval rules

- A Trial registration approved by Super Admin starts the existing Trial lifecycle.
- A paid registration choice must not be silently replaced by Trial.
- If a clinic requested a paid plan at registration, Super Admin must confirm the paid plan and billing cycle through the existing paid-plan workflow.
- A paid subscription is not considered active merely because an upgrade request was approved.
- The request is marked approved only after the paid-plan workflow successfully creates the required activation/payment action.
- If payment-provider setup fails, the request remains pending and the failure is visible to Super Admin.

---

## 5. Implementation sequence

Complete the following steps in order. Do not skip the data and permission steps in favour of only changing the screens.

---

## Step 0 — Record the baseline before editing — COMPLETE

**Baseline checked:** 2026-09-19, Asia/Calcutta  
**Scope:** Read-only inspection of the current registration, approval, subscription, Trial, Clinic Admin, Super Admin, notification, schema, migration, and test entry points.

### Purpose

Capture the current behaviour so a later test can distinguish an intentional change from an accidental regression.

### Verified registration behaviour

- **Registration screen:** `client/src/pages/RegisterClinic.tsx`
  - `PLAN_OPTIONS` currently contains only `starter`, `growth`, and `pro`.
  - The selected plan state is typed as `"starter" | "growth" | "pro" | ""`.
  - The plan selector is shown after email verification.
  - The form sends the selected value as `plan` in `POST /api/clinics/register`.
  - The current payment message says a secure payment link for the chosen plan will be sent after approval.
- **Registration route:** `server/routes.ts`, `POST /api/clinics/register`
  - Requires a verified email token.
  - Removes verification and optional document fields from the request body.
  - Creates the clinic with `status: "pending"`.
  - Passes the remaining fields, including the submitted `plan`, into storage.
  - Does not currently run the complete registration body through a dedicated Zod `safeParse()` before storage.
- **Clinic data model:** `shared/schema.ts`
  - `clinics.plan` currently defaults to `"starter"`.
  - There is no separate `requestedPlan` field.
  - The current model already contains `trialStartedAt`, `trialEndsAt`, `trialGraceEndsAt`, `trialOrigin`, `previousPaidPlan`, and `subscriptionPolicyVersion`.

### Verified approval behaviour

- **Approval route:** `server/routes.ts`, `PATCH /api/clinics/:id/approve`
  - Uses `isAuthenticated` and then checks for the `superuser` role.
  - Only pending clinics can be approved.
  - Builds the initial Trial from the shared policy catalogue.
  - Uses the current Trial policy values of 14 days plus 7 grace days.
  - Generates clinic credentials and sends the approval email.
  - Always updates the approved clinic to:
    - `plan: "trial"`
    - `subscriptionStatus: "trialing"`
    - The newly calculated Trial dates and origin
  - Does not currently use the clinic's selected registration plan to choose the approval result.
  - Writes a Trial assignment to `subscriptionPlanAssignments`.
  - Writes a `trial_started` event to `subscriptionLifecycleEvents`.
- **Confirmed mismatch:** A clinic can submit a paid plan value from the registration form, but approval currently replaces that choice with Trial. Adding only a Trial card would not fix the complete workflow.

### Verified Trial and plan policy behaviour

- **Shared catalogue:** `shared/plan-catalog.ts`
  - `PLAN_KEYS` contains `trial`, `starter`, `growth`, and `pro`.
  - `PAID_PLAN_KEYS` contains `starter`, `growth`, and `pro`.
  - Valid billing cycles are `monthly` and `annual`.
  - Trial is a no-card plan with a 14-day duration and 7-day grace period.
  - Trial currently allows 10 lifetime bookings, 1 active doctor, and 50 MB storage.
- **Trial helpers:** `shared/trial-lifecycle.ts`
  - Existing helpers build initial Trial windows.
  - Existing helpers determine Trial phase and conversion eligibility.
  - The current policy treats a Trial as conversion-eligible during the active Trial or grace period, not after grace expiry.
- **Existing tests:**
  - `shared/trial-lifecycle.test.ts`
  - `shared/plan-catalog.test.ts`
  - `shared/subscription-lifecycle.test.ts`
  - `shared/subscription-status.test.ts`
  - `shared/effective-entitlement.test.ts`

### Verified paid-plan activation behaviour

- **Existing route:** `server/routes.ts`, `POST /api/admin/clinics/:id/paid-plan`
  - Requires the Super Admin role.
  - Validates plan, billing cycle, reason, and optional transition ID with Zod.
  - Uses a transition ID to make repeated requests idempotent.
  - Creates a Razorpay subscription when provider configuration is available.
  - Creates an activation token and payment link.
  - Sets the clinic to `pending_payment`, rather than pretending that payment has completed.
  - Writes a `subscriptionPlanAssignments` record.
  - Writes either a `converted` or `plan_assigned` lifecycle event.
  - Returns the activation URL to the Admin client.
- **Implementation consequence:** Upgrade-request approval must reuse this provider-aware workflow instead of creating another paid-plan assignment path.

### Verified Clinic Admin surface

- **Main page:** `client/src/pages/ClinicDashboard.tsx`
  - The current subscription banner only handles `subscriptionStatus === "pending_payment"`.
  - It tells the clinic that payment is pending and provides a support link.
  - There is no Trial-active, Trial-grace, upgrade-request, rejected-request, or Trial-expired banner yet.
- **Existing entitlement panel:** `client/src/components/ClinicEntitlementSettingsPanel.tsx`
  - Loads `/api/auth/clinic/settings/entitlements`.
  - Already displays Trial and Trial grace states.
  - Already displays Trial start, Trial end, and grace end dates.
  - This component is a reusable source for Trial state presentation, but it is not currently the requested top-of-dashboard upgrade flow.

### Verified Super Admin surface

- **Main page:** `client/src/pages/Admin.tsx`
  - Existing Clinic lifecycle tabs are `Clinics & Access`, `Pending`, and `Archived`.
  - Existing Operations tabs are `Platform Operations`, `Tenant Operations`, and `Clinic Monitoring`.
  - Existing Growth/governance tabs include `Smile Deals`, `Plan Policies`, and `Security & Audit`.
  - There is currently no `Requests` tab or upgrade-request count.
  - The Pending registration approval action calls `PATCH /api/clinics/:id/approve` and currently tells the Admin that the clinic has started a 14-day Trial.
- **Existing Admin access pattern:** Super Admin routes use `isAuthenticated` followed by a role check for `superuser`.

### Verified notification and realtime behaviour

- **Notification storage:** `notifications` is user-ID based and currently supports clinic/doctor notification ownership.
- **Notification storage methods:** `server/storage.ts` reads and updates notifications by the scoped `userId`.
- **Role scoping:** Existing notification migrations use `clinic:` and `doctor:` prefixes to prevent numeric-ID collisions.
- **Current result:** There is no dedicated Super Admin upgrade-request notification channel or durable Admin request queue.
- **Implementation consequence:** The first release should use the upgrade-request table as the source of truth, with a Super Admin Requests-tab badge and refresh/toast behaviour. A dedicated Admin WebSocket channel can remain a later enhancement.

### Verified database and migration conventions

- **Schema definitions:** New Drizzle tables and columns belong in `shared/schema.ts`.
- **Startup compatibility SQL:** Existing additive schema checks are also present in `server/index.ts`, using idempotent `IF NOT EXISTS` blocks.
- **Subscription history:** `subscriptionLifecycleEvents` and `subscriptionPlanAssignments` already have clinic indexes and unique transition IDs.
- **Implementation consequence:** Any new requested-plan column or upgrade-request table must follow both the Drizzle schema and startup SQL/migration requirements. Existing subscription history must not be replaced or deleted.

### Verified test and quality commands

The current `package.json` provides these relevant commands:

```text
npm run build
npm run check
npm run test:subscription-entitlements
npm run test:subscription-baseline
npm run test:e2e
```

The existing Build Check workflow runs the production build command. The feature implementation must run the Build Check after code changes; Step 0 itself required no build or application restart because it changed no runtime code.

### Step 0 completion check

- [x] Current registration plan values recorded.
- [x] Registration payload and backend handling recorded.
- [x] Current approval behaviour recorded.
- [x] Existing Trial fields, catalogue, and eligibility helpers recorded.
- [x] Existing paid-plan activation route and idempotency behaviour recorded.
- [x] Clinic Dashboard banner area recorded.
- [x] Super Admin navigation and approval surface recorded.
- [x] Authentication and role-check patterns recorded.
- [x] Existing subscription assignment and lifecycle writes recorded.
- [x] Existing notification limitation recorded.
- [x] Existing test and build commands recorded.
- [x] No application code, database schema, route, or UI was changed.

**Step 0 result:** Complete. The baseline was recorded before implementation.

---

## Step 1 — Add Trial to the registration screen — COMPLETE

### Purpose

Give a new clinic a visible and understandable Trial option.

### UI work

Update the registration plan selector to show:

1. Trial
2. Starter
3. Growth
4. Pro

Keep the current visual language and layout. The Trial card should clearly say:

- Free
- 14 days
- No card required
- What the Trial includes
- What happens after Trial and grace end

The copy must not imply that Trial is a permanent free plan or that every feature is unlimited.

### Form behaviour

- Trial must be a valid selectable value.
- The form must not submit an unknown plan value.
- If the form requires a plan selection, the error message must mention that a plan must be selected.
- The selected plan must remain selected when the user navigates between registration steps or receives a validation error.
- The submission must use the project's shared API request helper, not a bare browser `fetch`.

### Completion checks

- A user can select Trial.
- Trial is visibly different from paid plans without hiding the paid options.
- The registration payload contains `trial` when Trial is selected.
- Existing Starter, Growth, and Pro registration still works.
- The card is usable on a narrow mobile screen.
- Labels, buttons, and selection controls are keyboard accessible.

### Step 1 progress record

Step 1 is complete.

- Added Trial to the registration selector using the shared plan catalogue.
- Trial displays as Free, 14 days, and No card required.
- Trial is visually distinct from paid plans without hiding Starter, Growth,
  or Pro.
- Trial copy explains the seven-day grace period and the next action after
  Trial.
- Paid registration copy now reflects the agreed Trial-first flow: approved
  clinics start with Trial access and the selected paid plan is retained for
  later payment activation.
- The existing shared API request helper remains in use, and selecting Trial
  submits `requestedPlan: "trial"`.
- The selector remains responsive and uses keyboard-accessible buttons with
  pressed-state semantics.

Step 2 must add validated requested-plan storage before the backend can safely
distinguish a registration preference from the clinic's active plan.

---

## Step 2 — Preserve the requested plan during registration — COMPLETE

### Purpose

Separate what a clinic asks for from the plan it currently has.

### Recommended data design

Add a nullable field to the pending clinic record:

```text
requestedPlan
```

The field should accept only:

```text
trial
starter
growth
pro
```

Do not use an unapproved registration choice as if it were an active subscription.

If the current `clinics.plan` field is already explicitly documented as the requested plan for pending clinics, the implementation team may preserve that contract instead of adding a new column. This must be confirmed by inspecting all reads and writes first. Do not mix both meanings silently.

### Backend work

- Add the field to `shared/schema.ts` if a new column is required.
- Add the matching idempotent startup SQL in `server/index.ts`, following the project’s dual-registration rule.
- Update the insert schema and registration route validation.
- Validate the plan with the canonical plan catalogue.
- Save the selected plan to the pending clinic record.
- Do not start Trial during registration.
- Do not create a paid subscription during registration.

### Migration requirements

If a column is added:

- The column must be nullable or have a safe default.
- The SQL must use `IF NOT EXISTS`.
- Existing clinics must keep their current effective plan and subscription state.
- The exact SQL needed for the Render database must be documented.
- No existing migration block should be edited; add an append-only migration/startup block according to project convention.

### Completion checks

- A pending clinic retains the selected plan after registration.
- Existing pending clinics continue to load.
- Registration cannot store arbitrary plan strings.
- No subscription or Trial timer is created before approval.

---

## Step 3 — Make Super Admin approval honour the requested plan — COMPLETE

### Purpose

Remove the current mismatch where every approved clinic is started on Trial even when the clinic selected a paid plan.

### Trial approval path

When the requested plan is Trial:

- Approve the clinic.
- Start the existing Trial lifecycle.
- Set the existing Trial timestamps and origin.
- Create the existing subscription assignment and lifecycle records.
- Keep the clinic's current access consistent with the shared plan catalogue.
- Send the existing approval notification/credentials.

### Paid approval path

When the requested plan is Starter, Growth, or Pro:

- Show the requested plan to Super Admin.
- Require confirmation of the paid plan and billing cycle.
- Use the existing paid-plan assignment workflow.
- Do not directly mark the clinic as fully paid unless the existing provider-aware process says that is valid.
- Keep provider activation, payment-link creation, lifecycle history, and idempotency in the shared service.

### Failure behaviour

- If paid activation cannot be prepared, do not mark the request or clinic as successfully paid.
- Return a useful error to Super Admin.
- Keep the clinic in a recoverable pending state.
- Do not create duplicate provider subscriptions on retry.

### Completion checks

- Trial selection starts Trial only after approval.
- Paid selection is not silently converted to Trial.
- The existing paid-plan route and the new approval path produce the same lifecycle records.
- Repeating an approval request does not create duplicate assignments or provider subscriptions.

---

## Step 4 — Add the upgrade-request data model — COMPLETE

### Purpose

Keep upgrade requests as a durable business record instead of representing them only as a temporary notification.

### Recommended table

Create a table named according to the project's naming convention, for example:

```text
clinic_upgrade_requests
```

Recommended fields:

| Field | Purpose |
|---|---|
| `id` | Unique request identifier |
| `clinicId` | Clinic that submitted the request |
| `requestedPlan` | Starter, Growth, or Pro |
| `billingCycle` | Monthly or annual |
| `status` | Pending, approved, rejected, or cancelled |
| `clinicReason` | Optional explanation from the clinic |
| `requestedAt` | When the clinic submitted the request |
| `reviewedAt` | When Super Admin completed review |
| `reviewedBy` | Super Admin identity |
| `reviewReason` | Approval or rejection note |
| `createdAt` | Record creation time |
| `updatedAt` | Last record update time |

Use the repository's existing timestamp, foreign-key, and enum conventions rather than introducing a new style.

### Rules

- Keep completed requests; do not delete them after review.
- Add an index for clinic and status.
- Add an index for pending requests ordered by creation time.
- Enforce one pending request per clinic at the database level when supported by the current migration approach.
- Also enforce the rule in storage/application code because database uniqueness alone is not enough for safe retry handling.
- Do not store payment credentials in this table.
- Do not store sensitive clinical or patient information.

### Completion checks

- [x] A request can be listed after the browser is closed.
- [x] Old approved and rejected requests remain available for audit.
- [x] Two simultaneous submissions cannot create two pending requests.

---

## Step 5 — Add clinic upgrade-request APIs — COMPLETE

### Clinic endpoints

Use the project's existing clinic-authenticated route convention. Recommended endpoints:

```text
POST /api/auth/clinic/subscription/upgrade-requests
GET  /api/auth/clinic/subscription/upgrade-request
```

The exact route name may follow existing subscription naming, but the behaviour must remain the same.

### POST validation

The route must:

- Require an authenticated clinic session.
- Read the clinic ID from the session, not from a browser-supplied clinic ID.
- Validate the body with Zod before storage.
- Accept only Starter, Growth, or Pro.
- Accept only monthly or annual billing.
- Optionally accept a bounded-length reason.
- Confirm the clinic's current effective plan is Trial.
- Confirm the Trial is active or in grace.
- Reject clinics with an existing pending request.
- Return the existing pending request for a safe retry when appropriate.

The route must not:

- Accept Trial as a paid upgrade target.
- Accept provider identifiers or payment credentials.
- Directly change the clinic's effective plan.
- Trust a browser-supplied eligibility flag.

### GET behaviour

Return the clinic's most relevant request:

- Pending request, if one exists.
- Most recent approved or rejected request if there is no pending request.
- Clear empty state if no request exists.

Do not expose another clinic's request by changing a query parameter.

### Super Admin endpoints

Recommended endpoints:

```text
GET  /api/admin/clinic-upgrade-requests
POST /api/admin/clinic-upgrade-requests/:id/approve
POST /api/admin/clinic-upgrade-requests/:id/reject
```

The exact route names may follow current Admin naming conventions.

These routes must:

- Require the existing Super Admin authentication guard.
- Check that the request exists and has the expected current status.
- Validate all mutation bodies with Zod.
- Prevent a second approval or rejection from changing a completed request.
- Record reviewer and timestamp.
- Reuse storage methods and the existing paid-plan service.

### Completion checks

- [x] Clinic users cannot read or mutate another clinic's request.
- [x] Non-admin users cannot review requests.
- [x] Invalid plans, billing cycles, statuses, and IDs receive clean errors.
- [x] Repeated POST requests are safe.

---

## Step 6 — Add the Clinic Admin Trial banner

### Purpose

Make the next action obvious without interrupting the clinic's normal work.

### Placement

Place the banner at the top of the authenticated Clinic Admin dashboard, near the existing subscription/payment banner area.

Do not place it on the unauthenticated clinic login page because the clinic's subscription state is not known before login.

### Active Trial state

Show:

- Trial label
- Days remaining or Trial end date
- Short explanation of the Trial
- `Request upgrade` button

### Grace-period state

Show:

- Grace-period label
- Grace-period end date
- Clear warning that the Trial has ended
- `Request upgrade` button

### Pending request state

Show:

- Requested paid plan
- Billing cycle
- Date submitted
- `Upgrade request pending` state
- No duplicate submission button

### Rejected request state

Show:

- Rejection status
- Super Admin reason, if provided
- A way to submit a new request if the clinic is still eligible

### Expired state

Show:

- Trial ended message
- Grace period ended message, when applicable
- Support/admin review direction
- No normal conversion request unless the product rule is changed

### UI quality requirements

- Include loading, error, and empty states.
- Use the existing banner and button components.
- Keep the banner responsive on mobile.
- Keep warning colours consistent with the existing dashboard.
- Give all buttons and controls accessible names.
- Add `data-testid` attributes following project conventions.

---

## Step 7 — Add the upgrade request dialog

### Fields

The dialog should contain:

1. Paid plan:
   - Starter
   - Growth
   - Pro
2. Billing cycle:
   - Monthly
   - Annual
3. Optional reason or note for Super Admin

The dialog should display the selected plan's relevant benefit summary from the shared plan catalogue. It must not duplicate pricing or entitlements in a separate hardcoded ruleset.

### Submission behaviour

- Disable the submit button while saving.
- Show a clear success message.
- Close the dialog only after the server confirms success.
- Keep the form open and show a useful error when submission fails.
- If the server reports an existing pending request, show that request instead of treating it as a new one.
- Refresh the clinic's request query after submission.

### Completion checks

- The clinic can understand what it is requesting.
- The clinic cannot submit without a valid paid plan and billing cycle.
- A request is not submitted twice by double-clicking.
- The modal works on mobile and with keyboard navigation.

---

## Step 8 — Add the Super Admin Requests tab

### Purpose

Give Super Admin a focused queue for clinic upgrade requests.

### Navigation

Add a `Requests` tab to the existing Super Admin clinic/operations navigation. Do not create a second Admin page.

Show a pending-count badge on the tab.

### Request list

Show:

- Clinic name
- Current effective plan
- Requested plan
- Billing cycle
- Trial/grace state
- Request date
- Request age
- Status
- Review action

The list should support:

- Pending filter
- All/history filter
- Loading state
- Empty state
- Error state
- Retry

### Request detail

Show:

- Clinic identity needed for the review
- Requested plan and billing cycle
- Trial dates
- Clinic note
- Previous requests from the same clinic
- Current subscription state

Do not show unrelated patient or clinical information.

### Approve action

The approval confirmation should:

- Show the plan and billing cycle being approved.
- Allow Super Admin to confirm or change them if the product rules permit.
- Explain whether a payment/activation link will be created.
- Call the existing paid-plan workflow.
- Mark the request approved only after the workflow succeeds.

### Reject action

The rejection form should:

- Require a reason.
- Show a confirmation before submitting.
- Keep the request in history.
- Make the reason visible to the clinic.

### Completion checks

- The pending badge equals the server's pending count.
- Approve and reject actions are not shown to unauthorised users.
- A completed request cannot be processed again.
- Provider failures are shown without losing the request.

---

## Step 9 — Notify Super Admin in the Admin screen

### First release recommendation

Use the Requests tab as the authoritative notification surface:

- Pending badge in navigation.
- Visible notice when pending requests exist.
- Refresh the pending count and list periodically while Admin is open.
- Show an in-screen toast when a newly detected request appears.

The request table remains the source of truth if the browser is closed or a toast is missed.

### Why not extend the current notification system immediately

The current notification system is primarily user-ID based for clinic and doctor users, and its WebSocket routing does not currently provide a Super Admin-specific channel. Forcing upgrade requests into that path would add notification complexity without improving the durable request workflow.

### Optional later improvement

After the durable request flow is stable, a separate Super Admin WebSocket event can be added. It must remain a convenience notification only; it must not replace the request table or pending-count query.

---

## Step 10 — Preserve audit and lifecycle history

The implementation must continue using the existing subscription history rules:

- Current subscription fields are current-state snapshots.
- Subscription assignments are append-only.
- Subscription lifecycle history is append-only.
- Trial transitions remain idempotent.
- Paid plan activation remains provider-aware.
- Request history is not deleted after review.

At minimum, record:

- When the clinic requested an upgrade.
- Who reviewed it.
- When it was approved or rejected.
- What plan and billing cycle were requested.
- Any review reason.
- The resulting paid-plan assignment or activation attempt.

Do not treat a request submission as a paid-plan assignment. A request does not grant access.

---

## Step 11 — Add tests before release

### Registration tests

- Trial is displayed.
- Trial can be selected.
- Trial is accepted by backend validation.
- Invalid plan strings are rejected.
- The selected plan survives validation errors.
- Existing paid-plan registration still works.

### Approval tests

- Trial registration starts the existing Trial lifecycle after approval.
- Paid registration is not silently changed to Trial.
- Paid approval uses the existing provider-aware assignment process.
- Repeated approval is idempotent.
- Provider failure leaves a recoverable state.

### Request API tests

- Unauthenticated users are rejected.
- A clinic admin can create a request for their own clinic.
- A clinic cannot create a request for another clinic.
- Starter, Growth, and Pro are accepted.
- Trial is rejected as an upgrade target.
- Monthly and annual billing are accepted.
- Invalid billing cycles are rejected.
- Active Trial requests succeed.
- Grace-period requests succeed.
- Post-grace requests follow the approved product rule.
- Duplicate pending submissions return one request.
- Paid clinics cannot use the Trial conversion flow.

### Super Admin tests

- Only Super Admin can list requests.
- Pending count is accurate.
- Super Admin can approve a pending request.
- Super Admin can reject with a reason.
- Reject without a reason is blocked.
- A completed request cannot be approved or rejected again.
- Request history remains available.

### UI tests

- Active Trial banner appears.
- Grace banner uses the warning state.
- Pending request state prevents duplicate submission.
- Rejected request state shows the review reason.
- Expired state follows the approved rule.
- Requests tab shows pending badge.
- Loading, empty, error, and retry states work.
- Mobile layout remains usable.
- Keyboard and accessible-label checks pass.

---

## Step 12 — Run the project release gates

After all code for this feature is complete:

### Frontend gate

- Run the Build Check workflow.
- Confirm the build exits successfully.
- Scan for duplicate exported frontend types/constants.
- Scan for bare API fetches and hardcoded localhost URLs.
- Check that all new interactive controls have `data-testid`.

### Backend and database gate

- Confirm every new route has the correct auth guard.
- Confirm every mutating route validates request bodies with Zod.
- Confirm new storage methods exist in both `IStorage` and `DatabaseStorage`.
- Confirm schema changes exist in both `shared/schema.ts` and startup/migration SQL.
- Confirm all database changes are idempotent.
- Confirm exact Render SQL is documented.
- Confirm no route imports Drizzle directly when the repository requires storage methods.

### Functional gate

- Run focused registration tests.
- Run focused subscription and Trial tests.
- Run upgrade-request tests.
- Run the existing related test suite.
- Start the application workflow.
- Verify the Clinic Admin and Super Admin screens in the running preview.

Do not declare the feature complete until the Build Check passes.

---

## 6. Rollout plan

### Before deployment

- Confirm the commercial rules in Section 4.
- Take a database backup according to the normal release process.
- Apply the additive schema migration.
- Verify existing clinic plan and Trial fields.
- Verify existing pending clinics still appear in Admin.
- Verify the current paid-plan activation flow independently.

### Staged rollout

Recommended order:

1. Deploy the additive request table/field changes.
2. Deploy backend validation and APIs.
3. Deploy the registration Trial option.
4. Deploy the Clinic Admin banner and request dialog.
5. Deploy the Super Admin Requests tab.
6. Monitor request creation, duplicate handling, and provider activation.

If feature flags are available, keep the banner and request submission disabled until the backend and Admin review surface are ready.

### Monitoring

Watch for:

- Registration failures.
- Clinics approved with the wrong plan.
- Duplicate upgrade requests.
- Requests stuck in pending state.
- Provider activation failures.
- Trial date or grace-date mismatches.
- Incorrect pending counts.
- Unauthorized request access.

---

## 7. Rollback plan

If the release must be rolled back:

- Do not delete upgrade-request records.
- Do not reset Trial dates.
- Do not reverse a completed paid assignment automatically.
- Disable new request creation first.
- Keep Super Admin history readable.
- Keep already-approved payment/activation records consistent.
- Roll back UI separately from data if necessary.
- Only remove an additive schema element after confirming no deployed code still reads it.

If the problem is severe or risks corrupting subscription state, use the project's checkpoint rollback process rather than manually deleting subscription history.

---

## 8. Definition of done

The feature is complete only when all of the following are true:

- [x] Trial is visible and selectable during clinic registration.
- [x] The selected registration plan is preserved until approval.
- [x] Trial approval starts the existing Trial lifecycle.
- [x] Paid registration choices are not silently overwritten.
- [ ] Trial and grace status appear at the top of the authenticated Clinic Admin dashboard.
- [ ] Eligible clinics can select a paid plan and billing cycle.
- [ ] Upgrade requests are stored as durable records.
- [ ] Duplicate pending requests are prevented.
- [ ] Clinics can see their request status.
- [ ] Super Admin has a Requests tab with a pending count.
- [ ] Super Admin can approve or reject requests with proper permissions.
- [x] Approval reuses the existing paid-plan workflow.
- [ ] Rejection requires a reason.
- [ ] Request and subscription history are preserved.
- [ ] Super Admin receives an in-screen notification through the Requests tab/badge flow.
- [ ] Active, grace, pending, rejected, and expired states are tested.
- [ ] Build Check passes.
- [ ] Database and backend checklist gates pass.
- [x] No application implementation was started before this plan was approved.

---

## 9. Decisions that must be answered before implementation

The implementation can use the recommended defaults above, but these decisions should be explicitly confirmed:

1. Should a paid plan selected during registration go directly through paid activation after approval, or should the clinic first start Trial and use the selected paid plan only as a preference?
2. Should clinics be allowed to submit an upgrade request after the grace period ends?
3. Should Super Admin be allowed to change the requested plan or billing cycle during review?
4. Should the first release use polling and a Requests-tab badge, or is real-time Super Admin WebSocket delivery required immediately?
5. Should the clinic's optional request note be included in the first release?

Recommended answers:

1. Use the existing paid activation process for a paid registration selection; do not silently replace it with Trial.
2. Do not allow the normal request flow after grace; use support/admin review.
3. Allow Super Admin to confirm or adjust the plan and billing cycle only if that action is recorded in the review history.
4. Use polling and the pending badge first; add real-time delivery later.
5. Include an optional, length-limited note because it gives Super Admin useful context without changing subscription state.

---

## 10. Approval gate

No application code should be changed for this feature until the product owner confirms:

- The rules in Section 4.
- The answers in Section 9.
- The requested-plan data design in Step 2.
- The approval behaviour in Step 3.

Once approved, implementation should proceed from Step 0 through Step 12 in order.