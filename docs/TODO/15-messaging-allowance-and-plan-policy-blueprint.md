# Messaging Allowance and Plan Policy Blueprint

**Status:** Planning only — no application behavior has been changed  
**Related blueprint:** [Super Admin Platform Operations](14-super-admin-platform-operations-blueprint.md)  
**Audience:** Product, operations, support, finance, frontend, backend, database, and QA teams  
**Primary goal:** Define what each clinic plan includes for messaging, how administrators see usage, and how the platform behaves before and after a limit is reached.

---

## 1. Plain-language summary

BookMySlot already records how many SMS, WhatsApp messages, and emails each clinic sends. It also already has three plan names that administrators can assign to a clinic:

- **Starter** — a small, low-risk plan for clinics trying the platform or sending only essential notifications.
- **Growth** — a normal operating plan for clinics with regular appointment activity.
- **Pro** — a higher-volume plan for established clinics with more patients and communication needs.

What is missing is the rule that connects a plan to a monthly messaging allowance. This blueprint defines that rule before any code changes are made.

The recommended approach is to:

1. Keep the existing three plan names.
2. Give each plan a separate monthly allowance for SMS, WhatsApp, and email.
3. Warn clinics before they reach a limit.
4. Avoid suddenly breaking essential appointment and security notifications.
5. Give Super Admins a clear view of allowance, used amount, remaining amount, reset date, and the reason for every warning.
6. Start in reporting mode, then introduce warnings, and only later decide whether selected non-essential messages should be blocked or require an upgrade.

This makes Starter useful as a genuine entry plan without making the first experience unsafe or confusing.

---

## 2. Current system baseline

### Already available

| Capability | Current state |
|---|---|
| Plan assignment | Super Admin approval flow already offers Starter, Growth, and Pro. |
| Plan identifiers | Existing values are `starter`, `growth`, and `pro`. These should remain stable. |
| Subscription billing setup | Razorpay plan IDs are configured separately for each plan and monthly/annual cycle. |
| Storage limits | Starter: 100 MB; Growth: 500 MB; Pro: 2047 MB. |
| Messaging channels | SMS, WhatsApp, and email are tracked separately. |
| Usage record | Each logical outbound communication records channel, event type, status, provider, billable flag, test flag, and units. |
| Admin usage view | Super Admin can select a month, view totals, filter clinics, and inspect channel breakdown and delivery failures. |
| Clinic usage view | Clinics can view their messaging usage for a selected month. |

### Not yet available

- Monthly allowance values connected to each plan.
- A plan allowance table that can be changed without code changes.
- A defined meaning for “included,” “warning,” and “over limit.”
- A reset date shown to administrators.
- A distinction between essential platform messages and optional messages.
- Server-side quota decisions before a message is sent.
- Upgrade guidance when a clinic is close to or above its allowance.
- A record of quota warnings or blocked messages.

### Important interpretation of current usage

The existing ledger represents one logical outbound communication per row. It can record accepted, failed, and skipped attempts and separately identifies whether a row is billable. The policy must therefore explicitly decide:

- Whether allowance consumption counts requested messages, accepted messages, or billable messages.
- Whether failed and skipped attempts consume allowance.
- Whether test messages consume allowance.
- Whether one message sent to several recipients counts once or once per recipient.

The recommended answer is included below rather than assuming that the current reporting totals automatically equal the future quota total.

---

## 3. Recommended plan structure

### 3.1 Plan names and purpose

| Plan | Plain-language purpose | Intended clinic |
|---|---|---|
| **Starter** | Try the platform with a small but useful amount of messaging. | New, small, or low-volume clinic; demonstration or early adoption. |
| **Growth** | Run normal clinic appointment communication without frequently approaching the limit. | Clinic with regular patient bookings and routine reminders. |
| **Pro** | Support higher patient and communication volume with more operational headroom. | Established or multi-doctor clinic with higher activity. |

Starter is already present in the application and should be treated as a real assignable plan, not a temporary or hidden plan.

### 3.2 Proposed starting allowances

These are recommended starting values for discussion and controlled rollout. They are not to be hard-coded until product and operations approve them against real usage data.

| Plan | SMS per month | WhatsApp per month | Email per month | Combined reference total | Plain-language explanation |
|---|---:|---:|---:|---:|---|
| **Starter** | 100 | 100 | 300 | 500 | Minimal usage for a small clinic; enough to experience appointment notifications without supporting a large patient volume. |
| **Growth** | 500 | 500 | 1,500 | 2,500 | Regular monthly clinic activity with room for reminders and routine communication. |
| **Pro** | 2,000 | 2,000 | 6,000 | 10,000 | Higher-volume clinic usage with substantially more room before warnings. |

The channel limits are the controlling limits. The combined total is a human-readable summary only and must not allow a clinic to exchange unused email allowance for SMS or WhatsApp unless a later policy explicitly introduces weighted units.

### 3.3 Why Starter should be small but not unusable

Starter should:

- Allow a clinic to complete a real appointment-notification journey.
- Be large enough that a clinic does not hit the limit during its first few normal days.
- Encourage an upgrade when the clinic has regular volume.
- Avoid creating a free or unlimited messaging loophole.
- Make the value of Growth obvious without disabling the product abruptly.

The proposed 100 SMS, 100 WhatsApp, and 300 email allowance is a starting point. It should be reviewed using at least one full month of real usage before becoming a permanent commercial promise.

---

## 4. What counts toward the allowance

### 4.1 Recommended counting rule

Count one unit when an outbound message is accepted by the configured provider or is treated as billable by the application. Keep failed and skipped attempts visible in reporting, but do not consume the clinic’s included allowance unless the provider has charged for them.

This gives the clinic a fair answer to “How much of my included usage have I actually used?” while still allowing the platform team to monitor attempted and failed delivery separately.

### 4.2 Message categories

Every message event should eventually be classified as one of these categories:

| Category | Examples | Recommended limit behavior |
|---|---|---|
| **Essential service** | OTP, booking confirmation, booking received notification, consent/security link | Do not silently block. Show an urgent operational alert and apply a separately approved protection rule. |
| **Routine clinic operations** | Appointment reminders, doctor/clinic notifications, routine status messages | Count toward the channel allowance; warn before the limit. |
| **Optional or promotional** | Campaigns, bulk announcements, marketing messages | First category considered for blocking or requiring an upgrade after the hard limit. |
| **Test or development** | Admin test sends, provider verification messages | Exclude from clinic allowance when clearly marked as test. Keep visible separately. |

The current event names should be audited and mapped into these categories before hard enforcement is enabled.

### 4.3 Failed, skipped, and test messages

| Usage type | Counts toward included allowance? | Still shown to Super Admin? |
|---|---:|---:|
| Accepted production message | Yes | Yes |
| Provider-rejected or failed message | No by default | Yes, as delivery health |
| Intentionally skipped message | No | Yes, as skipped activity |
| Test message marked `isTest` | No | Yes, in a separate test count |
| Provider-billable failed message | Yes, if the provider charged for it | Yes, with a billable explanation |

The final decision must be applied consistently across the clinic view, Super Admin view, quota calculation, and any future billing report.

---

## 5. Warning, limit, and reset policy

### 5.1 Monthly period

The default allowance period should be one calendar month:

- Starts on the first day of the month at 00:00 in the clinic’s configured timezone.
- Ends immediately before the next month starts.
- Resets automatically at the next period start.
- Displays the exact reset date and timezone to the clinic and Super Admin.

If a subscription begins mid-month, the first period should be explicitly chosen:

1. **Recommended:** prorate the allowance for the first partial month only if the commercial billing policy also prorates.
2. Otherwise, give the full allowance but record that the first period is a full introductory allowance.

Do not silently mix these approaches between clinics.

### 5.2 Thresholds

| Level | Trigger | What the clinic sees | What Super Admin sees | Platform behavior |
|---|---:|---|---|---|
| Normal | Below 80% | Remaining allowance | Healthy usage | Continue normally. |
| Early warning | 80% or more | “You are approaching your monthly allowance.” | Warning with channel, used amount, limit, and reset date | Continue normally. |
| Critical warning | 95% or more | “Your allowance is nearly full.” | High-priority warning | Continue essential and routine messages while the policy is in warning-only rollout. |
| At limit | 100% or more | “Your included allowance has been reached.” | Limit alert with affected channel and event category | Do not silently fail essential messages. |
| Over limit | Above 100% | Clear explanation and upgrade/support route | Over-limit amount, first detected time, and affected events | Apply only the approved category-specific rule. |

Thresholds should be evaluated per channel. A clinic that reaches its SMS limit but still has WhatsApp allowance should not be told that all messaging is exhausted.

### 5.3 Recommended first enforcement behavior

The first production version should be **warning-only**:

- Calculate and display quota status.
- Send warnings to the clinic and Super Admin.
- Do not block existing appointment-critical flows.
- Do not change notification behavior for clinics without an approved migration notice.
- Record what would have been blocked so the impact can be measured.

After one or two complete usage periods, the platform team can decide whether optional or promotional messages should be blocked at 100%.

### 5.4 Recommended eventual hard-limit behavior

After observation and approval:

- Essential service messages continue, subject to abuse protection and provider availability.
- Routine messages may continue only if the platform has an approved overage or grace policy.
- Optional/promotional messages are blocked or require an explicit upgrade after the relevant channel reaches 100%.
- Every blocked attempt receives a clear reason and is recorded.
- The clinic is never told that a message was delivered when it was not sent.

---

## 6. Upgrade and exception rules

### Plan changes

- A plan change should take effect immediately for access to the new limit, but the current period treatment must be defined.
- Recommended: do not erase already-used usage when upgrading.
- Recommended: use the new plan’s limit for the remainder of the current period.
- Downgrades should not silently remove current-period usage; the clinic should be warned if its existing usage is already above the new plan limit.

### Manual exceptions

Super Admin may need to grant a temporary allowance or grace period for support. Any exception must have:

- Start and end time.
- Affected channel(s).
- Additional units or percentage.
- Reason.
- Administrator identity.
- Audit record.

Do not implement permanent per-clinic overrides as an undocumented field. Temporary exceptions and plan allowances should be distinguishable.

### Subscription state

Quota access must use the shared subscription-state policy:

- Active clinics can use their plan allowance.
- Pending-payment, expired, cancelled, provider-error, or unknown states should be shown clearly.
- The quota system must not treat an unavailable subscription state as unlimited usage.
- Whether messages continue during a payment grace period is a separate commercial decision and must be explicit.

---

## 7. Super Admin screen requirements

### Overview cards

Add or plan for:

- Clinics approaching a messaging limit.
- Clinics at or above a limit.
- Total included allowance this period.
- Total accepted usage this period.
- Usage by SMS, WhatsApp, and email.
- Clinics with unavailable quota data.

### Tenant table columns

| Column | Meaning |
|---|---|
| Plan | Starter, Growth, or Pro |
| SMS | Used / allowance / percentage |
| WhatsApp | Used / allowance / percentage |
| Email | Used / allowance / percentage |
| Highest warning | Normal, warning, critical, at limit, or over limit |
| Reset date | When the allowance becomes available again |
| Delivery health | Accepted, failed, and skipped counts |
| Data status | Current, delayed, unavailable, or not yet calculated |

### Clinic detail view

The clinic detail view should explain:

- “This clinic is on Starter.”
- “It has used 72 of 100 SMS this month.”
- “It has 28 SMS remaining.”
- “The allowance resets on 1 October in Asia/Kolkata.”
- “WhatsApp is healthy, but SMS is near its limit.”
- “The warning is based on accepted production messages.”
- “Failed messages are shown separately and did not consume the included allowance.”

Avoid technical terms such as “quota ledger,” “threshold breach,” or “provider unit” in the primary clinic-facing explanation.

---

## 8. Data and service design needed before implementation

The implementation should introduce a single source of truth for plan allowances rather than scattering numbers across routes and components.

### Required policy data

- Plan key.
- Channel.
- Monthly included units.
- Warning thresholds.
- Effective date.
- Whether the value is active.
- Optional version or policy revision.

### Required usage calculation

The usage calculation should return, per clinic and channel:

- Period start and end.
- Reset date and timezone.
- Included allowance.
- Accepted/billable usage.
- Failed usage.
- Skipped usage.
- Test usage.
- Remaining allowance.
- Percentage used.
- Warning level.
- Data freshness.

### Required event/audit data

Record:

- Warning generated.
- Warning delivered.
- Limit reached.
- Message allowed during grace/exception.
- Message blocked.
- Manual exception created or ended.
- Plan allowance changed.

These records are needed to explain support cases and avoid a silent change in behavior.

---

## 9. Delivery plan

### Phase 0 — Confirm commercial policy

1. Approve Starter, Growth, and Pro as the only plan keys.
2. Approve or revise the proposed channel allowances.
3. Decide whether the first month is prorated.
4. Decide which event types are essential, routine, optional, and test.
5. Decide whether any provider-billable failure consumes allowance.
6. Decide whether payment grace periods allow messaging.

**Output:** Signed-off policy table and event-category mapping.

### Phase 1 — Reporting-only allowance calculation

1. Add a centralized plan/channel allowance policy.
2. Calculate monthly usage without changing send behavior.
3. Add allowance, remaining amount, warning level, reset date, and freshness to admin reporting.
4. Add clinic-facing read-only usage explanations.
5. Compare calculated results with current messaging usage for at least one complete month.

**Output:** Accurate reporting with no risk of blocking clinic communication.

### Phase 2 — Warnings and operational alerts

1. Show 80% and 95% warnings.
2. Add Super Admin attention filters.
3. Notify clinics using an approved channel without counting warning messages against allowance.
4. Add support-friendly explanations and audit records.
5. Confirm that unavailable data never appears as zero usage.

**Output:** Clinics and platform staff receive early, actionable warnings.

### Phase 3 — Controlled enforcement

1. Start with optional/promotional messages only.
2. Keep essential appointment and security messages protected.
3. Add explicit blocked-message responses and audit records.
4. Add temporary support exceptions.
5. Review real-world impact before enforcing any routine message category.

**Output:** Predictable limits without silently breaking essential clinic operations.

### Phase 4 — Commercial refinement

1. Review actual usage by plan.
2. Adjust allowances only through a versioned policy change.
3. Add upgrade prompts and plan comparison.
4. Add an approved overage or add-on model if needed.
5. Keep historical periods tied to the allowance policy that was active at that time.

**Output:** A sustainable plan structure based on real platform usage.

---

## 10. Acceptance criteria

The plan is ready for implementation only when:

- Starter, Growth, and Pro purposes are documented in plain language.
- Each plan has approved monthly channel allowances.
- The period start, reset date, timezone, and first-month treatment are defined.
- Essential, routine, optional, and test messages are mapped.
- Counting rules for accepted, failed, skipped, test, and billable messages are approved.
- Warning and hard-limit behavior is approved.
- The Super Admin view can distinguish zero, unavailable, and not-yet-calculated data.
- Clinic-facing copy explains used, remaining, limit, and reset date without technical jargon.
- Plan changes and temporary exceptions have an audit approach.
- A reporting-only comparison period is scheduled before enforcement.

---

## 11. Explicit non-goals

This blueprint does not:

- Change plan prices.
- Change Razorpay plan IDs.
- Change clinic plan assignment.
- Implement quota enforcement.
- Expose clinic treatment revenue or patient billing data.
- Treat email, SMS, and WhatsApp as interchangeable without an approved conversion rule.
- Promise unlimited essential messaging.
- Add multi-branch organization pricing.

---

## 12. Recommended next decision

Approve the **Phase 0 policy decisions** first, using the proposed allowances as the starting proposal:

- Starter: 100 SMS, 100 WhatsApp, 300 email per month.
- Growth: 500 SMS, 500 WhatsApp, 1,500 email per month.
- Pro: 2,000 SMS, 2,000 WhatsApp, 6,000 email per month.
- Warnings at 80% and 95%.
- Reporting-only mode before enforcement.
- Essential appointment and security messages protected from sudden blocking.

No application code should be changed until these decisions are accepted and the one-month reporting comparison is planned.