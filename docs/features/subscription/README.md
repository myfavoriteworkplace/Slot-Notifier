# BookMySlot Subscription Guide

> **Who is this for?**  
> Clinic owners, clinic administrators, support staff, Super Admins, billing operators, and anyone who wants to understand how BookMySlot subscriptions work without reading technical documents.

> **In simple words:**  
> A subscription plan is a package of BookMySlot services. Each package gives a clinic a different amount of usage and access to different advanced features. The clinic's subscription state tells us whether that package is currently being used, waiting for payment, in a Trial, or needs attention.

**Last reviewed:** September 14, 2026  
**Source of truth:** [Four-Plan Subscription and Entitlement Blueprint](../../TODO/16-four-plan-subscription-and-entitlement-blueprint.md)

---

## 1. The short version

BookMySlot has four plan choices:

1. **Trial** — a temporary, no-card introduction to the core clinic workflow.
2. **Starter** — for a small or single-doctor clinic.
3. **Growth** — the recommended plan for a regularly operating clinic.
4. **Pro** — for a high-volume clinic that needs higher allowances and premium visibility.

There are two different ideas:

- **Plan:** What package has the clinic been assigned?
- **Subscription state:** Is that package active, waiting for payment, in a Trial, expired, sponsored, or in need of review?

For example:

> A clinic can have the **Growth plan** but be in **payment pending** state.  
> It has selected Growth, but paid access should not be treated as confirmed until payment is confirmed.

The system also measures usage:

- How many bookings were created.
- How many active doctors are attached.
- How many Smile Deals are active.
- How much storage is used.
- How many SMS, WhatsApp, and email messages were used.

The current application is still in the safe reporting stage. The plan and usage can be shown and reviewed, but most plan limits are not yet blocking normal clinic actions.

---

## 2. The four plans in everyday language

### 2.1 Trial

Trial is for a clinic that wants to try BookMySlot before paying.

- Lasts **14 calendar days**.
- Does **not** require a card or Razorpay payment method.
- Does **not** create a paid Razorpay subscription.
- Has controlled limits.
- Is intended for testing the core clinic workflow, not for unlimited free use.
- Has a **7-calendar-day grace period** after the Trial period ends.

There are two kinds of Trial:

- **Initial Trial:** the clinic is trying BookMySlot for the first time.
- **Recovery Trial:** a clinic that previously had a paid plan gets a short recovery period after confirmed paid access expiry.

A Recovery Trial is not a brand-new unlimited free Trial. It is a controlled opportunity to renew, choose a plan, or contact support.

### 2.2 Starter

Starter is for a small clinic or a clinic with one main doctor.

It provides the basic clinic workflow at the lowest paid-plan price. It includes essential appointment and security WhatsApp notifications, but not the more advanced routine, bulk, promotional, or advanced WhatsApp workflows.

### 2.3 Growth

Growth is the recommended plan for a normally operating clinic.

It provides more bookings, more doctors, more storage, larger messaging allowances, advanced analytics, scheduled exports, and additional WhatsApp workflows.

### 2.4 Pro

Pro is for a high-volume clinic.

It provides the highest published allowances, full analytics and exports, full inventory and pharmacy features, phone support, premium visibility, a verified badge, and featured Smile Deal placement.

“Unlimited” on Pro means **fair use**, not unlimited use without review. Very high activity can lead to a support review rather than an automatic immediate block.

---

## 3. Prices and allowances

### 3.1 Paid plan prices

| Plan | Monthly price | Annual price | Saving with annual billing | Best suited for |
|---|---:|---:|---:|---|
| Starter | ₹999/month | ₹9,990/year | ₹1,998/year | Small or single-doctor clinic |
| Growth | ₹1,599/month | ₹15,990/year | ₹3,198/year | Regularly operating clinic |
| Pro | ₹2,999/month | ₹29,990/year | ₹5,998/year | High-volume or premium clinic |

Annual savings are calculated as:

> Twelve monthly payments minus one annual payment.

For example:

> Growth: ₹1,599 × 12 = ₹19,188.  
> Annual price: ₹15,990.  
> Saving: ₹3,198.

Trial has no monthly or annual price.

### 3.2 Usage allowances

| Allowance | Trial | Starter | Growth | Pro |
|---|---:|---:|---:|---:|
| Bookings | 10 total during the Trial | 30 per calendar month | 150 per calendar month | Fair use |
| Active doctors | 1 | 1 | 3 | Fair use |
| Smile Deals | 1 temporary post or draft | 1 active post | 3 active posts | Fair use |
| Storage | 50 MB | 100 MB | 500 MB | 2,047 MB |
| SMS | 25 for the Trial | 100 per calendar month | 500 per calendar month | 2,000 per calendar month |
| WhatsApp | 25 for the Trial | 100 per calendar month | 500 per calendar month | 2,000 per calendar month |
| Email | 50 for the Trial | 300 per calendar month | 1,500 per calendar month | 6,000 per calendar month |

### 3.3 What “total” and “per month” mean

- Trial bookings and Trial messages are counted across that Trial transition.
- Paid bookings and paid messages reset at the beginning of each calendar month in the clinic's local timezone.
- A successfully created booking counts once, whether the appointment later happens, is cancelled, or becomes a no-show.
- A reschedule does not count as a second booking.
- Duplicate, test, rejected, and failed atomic booking attempts do not count.
- A clinic-created booking and a patient-created booking count in the same way.

### 3.4 Pro fair use

Pro does not show a normal advertised numeric cap for bookings, active doctors, or live Smile Deals.

The approved review thresholds are:

- 1,000 monthly bookings.
- 25 active doctors.
- 100 live Smile Deals.

Crossing a review threshold should cause a notice and support review. It is not designed to create an automatic hard block by itself.

---

## 4. What is included in each plan

### 4.1 Feature comparison

| Feature | Trial | Starter | Growth | Pro |
|---|---|---|---|---|
| Core clinic workflow | Limited Trial access | Basic | Advanced operating package | Full high-volume package |
| Analytics | Basic snapshot | Basic | Advanced | Full |
| Data export | One export | Standard export | Advanced and scheduled | Full and priority |
| Inventory | Limited volume | Basic | Advanced | Full |
| Pharmacy | Limited volume | Basic | Advanced | Full |
| Clinic website | Trial branding | Basic | Sections and themes | Custom and premium |
| Public profile | Trial branding | Standard | Standard | Premium visibility |
| Support | Help centre and onboarding | Standard email | Priority email | Priority email and phone |
| Verified badge | No | No | No | Yes |
| Featured Smile Deal placement | No | No | No | Yes |

### 4.2 WhatsApp differences

The approved wording is:

> Starter includes essential WhatsApp appointment and security notifications within the monthly allowance. Growth and Pro add higher allowances plus routine reminder, bulk, promotional, and advanced WhatsApp workflows.

Essential messages include things such as:

- One-time passwords.
- Account recovery.
- Security notices.
- Booking confirmations.
- Booking cancellations and reschedules.
- Consent links.
- Required service notices for existing records.

Routine reminders, bulk campaigns, promotional messages, and advanced workflows are separate from essential service messages.

### 4.3 Transaction fees

Older pricing material may show transaction-fee percentages. Those percentages are **not an approved enforceable part of the current subscription contract**.

They must be omitted from new commercial promises or clearly marked as unfinalized until a separate policy defines:

- What transaction the fee applies to.
- How the fee is calculated.
- How refunds, taxes, discounts, and rounding work.
- How the fee is collected and reconciled.

### 4.4 Inventory and pharmacy limits

The plan differences are currently feature-based:

- Trial: limited volume.
- Starter: basic.
- Growth: advanced.
- Pro: full.

Exact item-count thresholds for inventory and pharmacy are deliberately deferred. No one should invent a number for them in a screen, email, or support response.

---

## 5. How a clinic enters the system

### 5.1 Clinic registration

A clinic submits its registration information and waits for review.

The registration may include a paid-plan preference, but a pending clinic approval now normally starts the clinic on the no-card Trial path.

The clinic does not need to provide card details to start Trial.

### 5.2 Review and approval

An authorized administrator reviews the clinic and chooses one of the approved paths:

#### Trial approval

The system:

1. Approves the clinic.
2. Starts the 14-day Trial.
3. Records the Trial start, end, grace dates, and Trial origin.
4. Does not create a Razorpay subscription.
5. Does not create a paid activation link.

#### Paid-plan approval

The system:

1. Approves the clinic.
2. Selects Starter, Growth, or Pro.
3. Selects monthly or annual billing.
4. Creates the correct Razorpay subscription flow when provider configuration is available.
5. Places the clinic in a payment-pending state until payment or activation is confirmed.
6. Records the provider subscription and lifecycle history.

An authorized administrator may explicitly approve a paid plan rather than starting Trial when that is the intended onboarding decision.

---

## 6. How paid billing works

Paid plans use Razorpay Subscriptions.

There are six paid provider plans:

| BookMySlot plan | Billing cycle | Razorpay plan |
|---|---|---|
| Starter | Monthly | Starter monthly |
| Starter | Annual | Starter annual |
| Growth | Monthly | Growth monthly |
| Growth | Annual | Growth annual |
| Pro | Monthly | Pro monthly |
| Pro | Annual | Pro annual |

Trial is not a Razorpay plan.

### 6.1 Paid activation in simple terms

When a paid plan is approved:

1. BookMySlot chooses the provider plan matching the selected BookMySlot plan and billing cycle.
2. Razorpay creates a subscription reference and payment link.
3. The clinic receives the activation instructions.
4. The clinic completes payment through the approved payment flow.
5. Razorpay sends a confirmation to BookMySlot.
6. BookMySlot records the payment confirmation and paid access.

The clinic should not be treated as having confirmed paid access merely because a plan was selected or a payment link was created.

### 6.2 What happens if payment is pending

The clinic can see that payment confirmation is pending.

The application should explain:

> Complete or confirm the payment process and wait for provider confirmation before relying on paid access.

The system must not silently change a pending payment into active paid access without the approved confirmation path.

### 6.3 Payment provider configuration

The payment setup uses configuration values stored as protected environment secrets, not in normal source files.

The six provider plan references are configured through:

- `RAZORPAY_PLAN_ID_STARTER_MONTHLY`
- `RAZORPAY_PLAN_ID_STARTER_ANNUAL`
- `RAZORPAY_PLAN_ID_GROWTH_MONTHLY`
- `RAZORPAY_PLAN_ID_GROWTH_ANNUAL`
- `RAZORPAY_PLAN_ID_PRO_MONTHLY`
- `RAZORPAY_PLAN_ID_PRO_ANNUAL`

The provider connection also requires protected credentials and webhook verification settings. Actual secret values must never be placed in this guide, source code, chat, or screenshots.

Provider setup should be performed by the platform owner or an authorized billing operator. A clinic administrator cannot configure Razorpay for the platform.

---

## 7. Subscription states explained

The plan and the subscription state are deliberately kept separate.

| State in everyday language | What it means |
|---|---|
| Trial active | The clinic is inside its 14-day Trial |
| Trial grace period | The Trial period ended, but the approved seven-day grace period is still running |
| Active paid | Provider-confirmed paid access is active |
| Payment confirmation pending | The clinic was approved for a paid plan, but provider confirmation has not completed |
| Recovery Trial | A previously paid clinic is temporarily recovering after confirmed paid expiry |
| Sponsored access | Temporary access was granted separately from paid provider billing |
| Requires attention | The subscription or access state needs review |
| State unavailable | The system could not safely confirm the current state |
| Expired | Access has ended or is waiting for the next approved action, depending on the lifecycle stage |

### 7.1 Legacy “unpaid” value

Older records may use `unpaid`.

The current interpretation is usually **payment confirmation pending**, not a separate new plan. The system keeps this legacy value readable while newer flows use clearer normalized states.

### 7.2 Unknown values

An unknown plan or subscription state must remain visible as unknown.

It must not silently become Starter, active, or any other safe-looking value.

---

## 8. What happens when a Trial ends

### 8.1 Initial Trial

The approved lifecycle is:

1. Trial runs for 14 calendar days.
2. The clinic receives or can view the Trial end date.
3. A seven-day grace period follows.
4. The clinic can review plans, renew, or contact support.
5. Existing clinic data is preserved.
6. Public booking is disabled after initial Trial expiry, including during grace, when enforcement is enabled.
7. Standard authenticated export remains available with reasonable limits.

The current application is still in reporting-only mode, so not every approved restriction is active yet.

### 8.2 Recovery Trial after paid expiry

A paid clinic can enter a Recovery Trial only when all of these are true:

- The clinic had a recognized paid plan and paid subscription state.
- The provider reports an expiry-related event.
- The provider-reported paid end time is in the past.
- The event is confirmed and recognized by the system.

The Recovery Trial:

- Lasts 14 calendar days.
- Records that it came from paid expiry.
- Preserves the previous paid plan.
- Preserves the old provider subscription identifier and history for reference.
- Does not reuse the expired provider subscription for a new paid plan.
- Cannot be restarted or extended by duplicate provider events.

### 8.3 What happens after Recovery Trial

The clinic can:

- Choose a paid plan through the approved paid activation flow.
- Contact support.
- Continue to read existing data and use approved data portability features.

The old paid plan does not remain active forever, and the Recovery Trial does not create an endless free loop.

---

## 9. What happens during upgrades and downgrades

### 9.1 Upgrade

An upgrade is not complete just because an administrator changes a dropdown.

An upgrade becomes effective after the approved provider/payment confirmation. When confirmed:

- The new plan's limits apply.
- Usage already consumed is not erased.
- The clinic does not receive a second allowance reset just because a provider event was repeated.
- The change is recorded in history.

### 9.2 Downgrade

A downgrade needs provider-aware handling.

The approved behavior is:

- The current paid plan remains active until the provider-confirmed renewal boundary.
- Existing doctors, deals, files, bookings, and patient records are not deleted.
- Existing data remains viewable.
- New activity beyond the lower plan's allowance is handled according to the approved enforcement rules.
- The clinic is shown what needs attention.
- A doctor or Smile Deal is not silently deleted or unpublished just because the plan is lower.

The current project still treats full paid upgrade and downgrade workflows as incomplete. Do not promise an immediate paid downgrade from the current screen.

---

## 10. Who can see or change subscription information?

### 10.1 Clinic owner or clinic administrator

The clinic administrator can view their own:

- Current plan.
- Current access state.
- Relevant Trial, grace, recovery, or paid-expiry dates.
- Measured usage.
- Remaining allowance where it can be measured.
- Available plan comparison.
- Plain-language next step.
- Support and plan-review links.

This information appears in the clinic dashboard under **Settings → Plan & access**.

The clinic administrator cannot:

- Change the platform-wide plan prices.
- Publish a plan policy.
- Change another clinic's plan.
- Change Razorpay plan mappings.
- Mark their own account as paid without the approved payment process.
- Create a provider subscription directly from the read-only comparison popup.
- Use the browser to bypass server-side access rules.

### 10.2 Doctor

A doctor does not configure subscriptions.

The doctor may be affected by a clinic's plan limits, but the doctor cannot publish policies, assign paid plans, extend Trial, or change provider billing.

### 10.3 Ordinary Super Admin

An ordinary Super Admin can generally view operational subscription information, depending on the role permissions configured for the platform:

- Clinic plan and access state.
- Trial and recovery dates.
- Usage against plan allowances.
- Provider-state information needed for operations.
- Subscription history.
- Active support exceptions.

An ordinary Super Admin should not use general clinic editing to change plan state or bypass provider confirmation.

### 10.4 Platform owner

The platform owner has the highest approved subscription authority and can:

- Approve the commercial plan policy.
- Publish plan policies.
- Perform approved billing-policy operations.
- Manage provider configuration.
- Grant commercially meaningful sponsored access.
- Review restricted platform subscription finance information.

Platform subscription money is different from clinic treatment revenue and patient billing.

### 10.5 Delegated billing operator

A named billing operator can receive approved billing permissions from the platform owner.

Depending on the delegation, the billing operator may:

- Prepare and publish plan policy changes.
- Perform approved paid-plan operations.
- Manage provider-related subscription work.
- Grant or extend full-plan sponsored access.
- Review restricted platform subscription finance data.

The billing-operator permission does not automatically grant access to patient data, treatment revenue, or unrestricted impersonation.

### 10.6 Delegated clinic-operations operator

A clinic-operations operator may be allowed to perform controlled operational tasks such as:

- Start a Trial.
- Extend a Trial.
- Grant a selected operational exception within an approved scope and duration.

This role should not create a full paid plan, record a payment, or publish a global pricing policy unless it also has a separate approved billing delegation.

### 10.7 Patients and the public

Patients do not configure or manage clinic subscriptions.

The public may see plan-related effects such as whether public booking is available, but they should not see provider IDs, internal subscription history, platform finance, or another clinic's usage.

---

## 11. How subscription policy is configured

### 11.1 One shared plan catalog

Plan information should come from one shared policy catalog rather than being typed separately into every page.

The catalog is used to describe:

- Plan names.
- Prices.
- Annual savings.
- Booking limits.
- Doctor limits.
- Smile Deal limits.
- Storage limits.
- SMS, WhatsApp, and email allowances.
- Analytics level.
- Export level.
- Website level.
- Inventory and pharmacy level.
- Support level.
- Public visibility.
- Verified badge.
- Featured placement.

This prevents the pricing page, clinic Settings, Admin panel, storage reports, and future server checks from showing different numbers.

### 11.2 Draft and published policy

A safe policy change should follow this order:

1. Create a draft.
2. Enter the proposed plan values.
3. Validate the draft.
4. Preview which clinics may be affected.
5. Check provider mappings and commercial implications.
6. Enter a reason.
7. Confirm the publication.
8. Publish a new version.

Published policy versions are kept as history. A new policy must not silently rewrite the meaning of past usage.

The current project has the Plan Policies registry and review workflow. Live consumer cutover and production enforcement remain controlled release steps.

### 11.3 Policy change versus clinic exception

These are not the same thing:

- **Policy change:** changes the general rule for a plan.
- **Clinic exception:** gives one clinic a temporary change.
- **Sponsored access:** gives one clinic a fixed-term complimentary plan or feature access without creating a paid provider subscription.

A support exception should not be used to permanently hide an undocumented change in the plan rules.

### 11.4 Required record for a manual change

Every manual plan or access change should record:

- The clinic.
- The previous plan or access.
- The new plan or access.
- Who made the change.
- Why it was made.
- When it starts.
- When it ends, if temporary.
- Whether the payment provider needs to be updated.

---

## 12. Trial and paid-plan actions available to administrators

### 12.1 Start Trial

Start Trial is for a clinic without an active paid subscription.

It:

- Assigns the Trial plan.
- Starts the Trial state.
- Creates the Trial dates.
- Records the origin.
- Requires an authorized administrator.
- Requires a reason and confirmation.
- Does not create a Razorpay subscription.

Trial should not be restarted repeatedly for the same clinic just to create endless free access.

### 12.2 Extend Trial

Extend Trial is for an existing initial or recovery Trial.

It should show:

- Current end date.
- New end date.
- Extension length.
- Reason.
- Administrator.

Extending a Trial should not reset already-used allowances unless a separately approved policy says so.

### 12.3 Assign a paid plan after expiry

For an expired or Recovery Trial clinic:

1. Choose Starter, Growth, or Pro.
2. Choose monthly or annual billing.
3. Start a new paid provider flow.
4. Wait for payment confirmation.
5. Make paid access effective only after the approved confirmation.
6. Record the previous Trial and new paid plan.

The expired provider subscription must not be reused.

### 12.4 Sponsored access

Sponsored access is complimentary access, not a payment.

It must:

- Have a fixed start and end time.
- Have a reason.
- Have an administrator record.
- Be clearly labelled Sponsored access or Complimentary access.
- Keep the underlying paid subscription unchanged.
- Not pause, cancel, extend, or rewrite Razorpay billing.
- Not overlap active paid access by default.
- Not stack several active sponsored grants on top of one another.

At the end of sponsored access, the system recalculates the clinic's underlying state.

### 12.5 Entitlement exception

An entitlement exception is a temporary, targeted change such as:

- Allowing one extra doctor for a fixed period.
- Allowing a specific feature while support resolves a problem.
- Temporarily increasing one approved allowance.

It must be narrower than changing the entire plan where possible.

---

## 13. What the clinic administrator sees in Settings

The clinic Settings page has a read-only **Plan & access** section before the detailed Storage, Messaging, and Reminder sections.

It is designed to answer five questions:

1. What plan does the clinic have?
2. Is access healthy?
3. What has been used?
4. What should the clinic do next?
5. What do the available plans include?

### 13.1 Current plan

The clinic sees a plain-language label such as:

- Starter · Payment confirmation pending.
- Growth · Active paid.
- Trial · Trial active.
- Recovery Trial · Requires attention.
- Plan information needs review · State unavailable.

### 13.2 Dates

Only useful dates should be shown:

- Trial started.
- Trial ends.
- Grace period ends.
- Recovery Trial ends.
- Paid access ends.
- Sponsored access ends.
- Last usage measurement.

Provider IDs and internal event IDs are not shown to the clinic.

### 13.3 Usage cards

The Settings page can show:

- Bookings.
- Active doctors.
- Smile Deals.
- Storage.
- SMS.
- WhatsApp.
- Email.

Each measured card should explain:

- Current usage.
- Limit.
- Period.
- Remaining amount, when known.
- Status such as On track, Requires attention, Over limit, or Measurement unavailable.

Unavailable data must never be shown as zero.

### 13.4 Plan comparison

The Compare plans window is read-only.

It can show:

- Trial, Starter, Growth, and Pro.
- Monthly and annual prices.
- Annual savings.
- Usage allowances.
- Messaging allowances.
- Feature packaging.
- Growth as the recommended plan.
- The clinic's current plan, when it is known.

It does not:

- Start a Trial.
- Assign a plan.
- Create a Razorpay subscription.
- Open a payment flow automatically.
- Change subscription state.
- Enforce a limit.

### 13.5 What the clinic should do next

The page may suggest:

- Continue the Trial.
- Review plans before Trial grace ends.
- Wait for payment confirmation.
- Review a Recovery Trial.
- Contact support.
- Refresh because the state could not be confirmed.

These are guidance actions, not hidden subscription mutations.

---

## 14. Where the subscription model is used

The subscription model is shared across the product instead of belonging to one page.

### 14.1 Public pricing

The pricing page uses the plan catalog for:

- Plan names.
- Prices.
- Annual savings.
- Usage units.
- Messaging allowances.
- Storage limits.
- Feature differences.
- Trial wording.

### 14.2 Registration and approval

The model controls:

- Which plan a clinic requested.
- Whether approval starts Trial or a paid activation.
- Whether billing is monthly or annual.
- Which provider plan should be used for a paid approval.

### 14.3 Super Admin operations

The Admin area uses it to:

- Review clinic plan and access state.
- Find Trial and recovery cases.
- Review usage against limits.
- Start or extend Trial.
- Assign a paid plan after expiry.
- Review subscription history.
- Grant or revoke sponsored access.
- Grant or revoke selected exceptions.

### 14.4 Clinic Settings

The clinic dashboard uses it to show:

- Current plan.
- Access state.
- Relevant dates.
- Usage.
- Next steps.
- Read-only plan comparison.

### 14.5 Storage and messaging

Storage and messaging reports use the catalog to compare measured usage with the plan allowance.

Messaging is measured separately for:

- SMS.
- WhatsApp.
- Email.

The system must distinguish essential service messages from optional, promotional, bulk, and advanced messages.

### 14.6 Entitlement calculation

The shared entitlement service works out:

1. Which clinic is asking.
2. Which plan is assigned.
3. Which subscription or Trial state applies.
4. What the plan normally includes.
5. Whether a temporary exception applies.
6. Whether the data is known and current.

The result explains where the answer came from, such as the plan, a sponsored grant, an exception, or an unknown state.

### 14.7 Payment provider events

Razorpay provider events are used to confirm:

- Paid activation.
- Paid renewal activity.
- Paid cancellation or halt.
- Paid expiry and recovery eligibility.

Repeated provider messages must not restart a Trial, create duplicate history, or count the same payment twice.

### 14.8 Audit and history

Subscription history records important events such as:

- Trial started.
- Trial extended.
- Trial converted.
- Paid plan assigned.
- Subscription state changed.
- Paid access expired.
- Recovery Trial started.
- Sponsored access granted or revoked.
- Entitlement exception granted or revoked.

This makes it possible to explain what happened later without guessing from the current clinic row.

### 14.9 Future server-side checks

The model is intended to support future checks for:

- New doctor creation.
- New bookings.
- New Smile Deals.
- Storage uploads.
- Advanced analytics.
- Scheduled or advanced exports.
- Optional and promotional messaging.

Those checks must happen on the server, not only by hiding buttons in the browser.

---

## 15. What is implemented today and what is still planned?

### 15.1 Implemented or available in the current development stage

- Four-plan catalog.
- Trial, Starter, Growth, and Pro policy values.
- Annual price and savings calculation.
- Trial dates and Trial origin.
- Recovery Trial lifecycle after eligible paid expiry.
- Provider-event and lifecycle idempotency.
- Reporting-only entitlement calculation.
- Clinic Settings Plan & access panel.
- Usage reporting for booking, doctor, Smile Deal, storage, and messaging areas.
- Super Admin entitlement review.
- Start Trial and Extend Trial operations.
- Provider-aware paid-plan assignment/conversion groundwork.
- Sponsored access and selected entitlement exceptions with audit history.
- Draft and published Plan Policies registry workflow.

### 15.2 Still incomplete or deliberately deferred

- Full authenticated desktop, tablet, and mobile state review.
- Unified 80% and 95% warning delivery.
- Trial-expiry reminder delivery.
- Full server-side enforcement of all plan limits.
- Complete paid upgrade and downgrade flows.
- Full provider reconciliation.
- Complete platform subscription money ledger.
- Sponsored-access expiry automation.
- Production-clinic baseline validation.
- Production rollout and enforcement.
- Exact transaction-fee rules.
- Exact inventory item-count thresholds.
- Exact pharmacy item-count thresholds.

The application must not claim that a deferred feature is already active.

---

## 16. Money, access, and clinic revenue are different

These three subjects must not be mixed:

### Subscription money

Money paid by clinics to use BookMySlot.

### Clinic treatment revenue

Money a clinic receives from patients for dental treatment or other clinic services.

### Entitlement or access

What the clinic is allowed to use according to its plan, state, sponsored grant, or approved exception.

Sponsored access may have a recorded list value that was waived, but it has:

- Zero captured cash.
- No paid provider renewal.
- No accounting revenue by itself.

The normal clinic subscription view should not expose private patient bills or clinic treatment revenue.

---

## 17. Common questions

### Does Trial require a card?

No. The approved Trial is a 14-day no-card Trial.

### Does Trial create a Razorpay subscription?

No. Trial is not a paid Razorpay plan.

### Can a clinic use Trial forever?

No. Trial is temporary. Initial and recovery Trial origins are recorded, and duplicate provider events cannot restart the same recovery Trial.

### Is selecting Growth the same as paying for Growth?

No. The plan selection and provider-confirmed payment are different steps.

### Can a clinic administrator change their own plan?

The clinic administrator can view plans and contact support. Plan assignment and billing changes must use an approved administrator/provider workflow.

### Can an ordinary Super Admin publish a new price?

No. Publishing a global policy requires the platform owner or a separately delegated billing operator.

### Can a support person give a clinic a free Pro plan?

Only through the dedicated sponsored-access workflow and only when the person's role allows it. It must have a fixed expiry, reason, audit record, and no provider charge.

### Does sponsored access mean the clinic paid?

No. Sponsored access is complimentary access and must never be labelled as payment received.

### What happens to clinic data after expiry or downgrade?

Existing data is preserved. Expiry or downgrade must not delete doctors, patient records, bookings, files, bills, or clinical history.

### Does Pro mean there is never a review?

No. Pro uses fair-use monitoring for very high activity. A review threshold is not automatically the same as a hard block.

### Are transaction fees active?

No approved enforceable transaction-fee policy exists yet. Do not promise a percentage as a current rule.

### Why does the clinic see “Measurement unavailable”?

The system could not safely calculate that number. It is intentionally not shown as zero because zero and unavailable mean different things.

### What should support ask for when a clinic reports a subscription problem?

Ask for:

1. Clinic name.
2. The plan and state shown in Settings.
3. The date and time of the problem.
4. The message shown on screen.
5. Whether the problem concerns payment, usage, Trial dates, or a feature.

Do not ask the clinic to send passwords, API keys, provider secrets, or private payment credentials.

---

## 18. Simple glossary

| Term | Plain meaning |
|---|---|
| Plan | The package assigned to a clinic |
| Subscription state | Whether that package is active, pending, Trial, expired, or needs attention |
| Entitlement | A rule describing what the clinic can use |
| Usage | What the clinic has already used |
| Allowance | How much the plan includes |
| Trial | Temporary no-card access |
| Grace period | Extra time after Trial end to review plans or contact support |
| Recovery Trial | Temporary access after confirmed paid expiry |
| Sponsored access | Complimentary fixed-term access that is not a payment |
| Exception | A temporary change to one feature or allowance |
| Provider | Razorpay, the external payment service |
| Webhook | An automatic message from the provider to BookMySlot |
| Policy catalog | The shared list of plan prices, limits, and features |
| Policy version | A numbered or dated copy of the rules used at a point in time |
| Fair use | High activity is reviewed rather than controlled by a normal advertised cap |
| Reporting-only | The system measures and explains what would apply but does not yet block most actions |
| Server-side enforcement | The server checks the rule even if someone bypasses the screen |

---

## 19. Useful related documents

- [Four-Plan Subscription and Entitlement Blueprint](../../TODO/16-four-plan-subscription-and-entitlement-blueprint.md) — the full approved policy and implementation plan.
- [Payment and Subscription Guide](../payment-and-subscription-guide.md) — detailed provider setup and the earlier payment activation flow. The present guide should be used for the current four-plan and Trial model.
- [Super Admin Platform Operations Blueprint](../../TODO/14-super-admin-platform-operations-blueprint.md) — broader platform administration boundaries.
- [Messaging Allowance and Plan Policy Blueprint](../../TODO/15-messaging-allowance-and-plan-policy-blueprint.md) — detailed message categories and allowance rules.

---

## 20. For maintainers: current implementation reference

The following details are included for people who maintain the application. They are not required for a clinic administrator to understand the subscription model.

### Shared policy and entitlement code

- `shared/plan-catalog.ts` — Trial, Starter, Growth, and Pro policy catalog.
- `shared/effective-entitlement.ts` — reporting-only effective entitlement calculation.
- `shared/subscription-status.ts` — normalized subscription states and legacy `unpaid` handling.
- `shared/subscription-lifecycle.ts` — Trial window and recovery transition rules.
- `shared/schema.ts` — subscription lifecycle and history data contract.

### Main application surfaces

- `client/src/components/ClinicEntitlementSettingsPanel.tsx` — clinic-facing Plan & access panel.
- `client/src/components/PlanComparisonDialog.tsx` — read-only plan comparison.
- `client/src/components/AdminEntitlementReview.tsx` — Super Admin entitlement and access operations.
- `client/src/pages/Admin.tsx` — Plan Policies and Entitlements areas.

### Important current routes

- `GET /api/auth/clinic/settings/entitlements` — clinic's own reporting-only plan and usage view.
- `GET /api/admin/clinics/:id/entitlements` — authorized Super Admin entitlement report.
- `GET /api/admin/plan-policies` — policy registry review.
- `POST /api/admin/plan-policies/validate` — validate a draft policy.
- `POST /api/admin/plan-policies/preview` — preview policy impact.
- `POST /api/admin/plan-policies/:id/publish` — publish an approved policy version.
- `POST /api/admin/clinics/:id/trial` — audited Start Trial or Extend Trial action.
- `POST /api/admin/clinics/:id/paid-plan` — provider-aware paid-plan assignment flow.
- `POST /api/admin/clinics/:id/sponsored-access` — fixed-term sponsored access.
- `POST /api/admin/clinics/:id/entitlement-exceptions` — selected entitlement exception.
- `POST /api/webhooks/razorpay-subscription` — provider lifecycle events.

### Safety rules for future changes

1. Do not duplicate plan numbers in a new screen or route.
2. Do not treat a browser-only disabled button as enforcement.
3. Do not silently convert an unknown plan into Starter.
4. Do not restart a Trial because the same provider event was delivered twice.
5. Do not reuse an expired provider subscription for a new paid plan.
6. Do not use general clinic editing to mutate subscription state.
7. Do not expose provider secrets, internal event IDs, patient data, or clinic treatment revenue in entitlement responses.
8. Do not call sponsored access a payment.
9. Do not delete clinic data at expiry or downgrade.
10. Keep deferred transaction-fee and inventory/pharmacy threshold rules visible as deferred.
