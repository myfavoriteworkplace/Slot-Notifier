# Super Admin Platform Operations Blueprint

**Status:** Release A implemented and hardened — Release B in progress — Releases C–D remain planned
**Audience:** Product, design, frontend, backend, database, QA, and operations teams  
**Application:** BookMySlot dental clinic platform  
**Primary goal:** Make the Super Admin screen useful for operating the platform services provided to clinics without exposing clinic-private business revenue.

---

## Implementation status

Release A from this blueprint has been implemented.

### Delivered

- Added a new default **Overview** tab to the Super Admin page.
- Added platform KPI cards for:
  - Active tenants
  - Active subscription coverage
  - Tenants needing attention
  - Current-month messaging volume
  - Tracked storage usage
  - Messaging reporting period
- Added operational attention cards for:
  - Non-active subscriptions
  - Storage above 80%
  - Failed messages
- Added a searchable and filterable tenant operations table.
- Added tenant filters for:
  - All
  - Needs attention
  - Active
  - Pending
- Added a tenant detail drawer containing:
  - Subscription plan, cycle, state, and provider-link presence
  - SMS, WhatsApp, and email usage
  - Messaging delivery failures
  - Tracked storage usage and file count
  - Clinic status and configured doctor count
- Added a Super Admin-only storage aggregation endpoint:
  - `GET /api/admin/storage-usage`
- Reused the existing:
  - `GET /api/admin/messaging-usage`
  - `GET /api/clinics`
  - Existing subscription and storage fields
- Kept patient bills, treatment revenue, doctor earnings, clinical records, and patient payment history out of the operations DTO and UI.
- Preserved existing Active, Messaging Usage, Pending, Archived, Smile Deals, and Login Activity tabs.
- Expanded the Admin page container so the operations table can use the available screen width.
- Added a shared subscription-state policy for Super Admin operations views:
  - Maps legacy `unpaid` values to `pending_payment`
  - Preserves supported states such as `active`, `past_due`, `expired`, and `cancelled`
  - Keeps unknown provider values visible as an actionable `Unknown state`
- Added explicit overview loading, error, retry, and empty states.
- Prevented failed messaging or storage requests from appearing as zero usage.
- Added storage measurement timestamp and timezone metadata to the storage summary.
- Added deterministic tests for subscription-state normalization and legacy compatibility.

### Verification completed

- `npm run check` passes.
- `npm run build` passes.
- Build Check workflow passes.
- `git diff --check` passes.
- The admin route remains protected by the existing login flow. An unauthenticated preview correctly shows the System Admin Login screen.

### Not included in Release A

- Subscription provider event history
- Messaging hard/soft quota policies
- Feature flag provisioning
- Unified audit viewer
- Read-only support sessions
- Historical API/provider health instrumentation
- Multi-branch organization support
- Any clinic-private revenue reporting

These remain as planned Releases B–D below.

---

## 1. Product decision and scope boundary

The Super Admin is responsible for the health, access, subscription state, and consumption of the BookMySlot platform. The Super Admin is **not** intended to inspect a clinic's private treatment revenue, patient billing revenue, or clinic-level business performance.

### Super Admin may see

- Which clinics are active, pending, archived, or restricted
- Which subscription plan and billing cycle a clinic has
- Whether a subscription is active, unpaid, pending, failed, or expired
- Subscription renewal and payment-provider status where available
- Platform service usage:
  - SMS
  - WhatsApp
  - Email
  - Cloud/R2 storage
  - X-ray and document storage categories where metadata supports it
- Platform feature access and provisioning state
- System/API/provider health
- Authentication and administrative audit events
- Usage warnings and operational alerts
- Support context needed to resolve a platform issue

### Super Admin must not see in the tenant detail view

- Patient treatment revenue
- Clinic revenue by treatment
- Patient bill totals
- Clinic profit, margin, ARPU, or LTV
- Doctor earnings
- Patient payment history unless required for a specific platform support workflow
- Clinical content as part of routine administration

### Billing distinction

There are two different kinds of billing in the application:

| Billing area | Super Admin visibility |
|---|---|
| Clinic subscription to BookMySlot | Allowed: plan, cycle, state, renewal, payment-provider event status |
| Clinic's patient/treatment bills | Excluded from normal Super Admin screens |

The existing patient billing system remains a clinic-facing operational feature. It must not be accidentally reused as a Super Admin revenue dashboard.

---

## 2. Current implementation baseline

The current Admin page is a large tabbed screen in `client/src/pages/Admin.tsx`. It already contains:

- Active clinics
- Pending registrations
- Archived clinics
- Clinic create/edit flows
- Clinic credentials management
- Storage limit editing
- Subscription plan and billing-cycle selection during approval
- Manual subscription payment override
- Smile Deals administration
- Login activity
- Messaging usage in `AdminMessagingUsagePanel`

The current backend already exposes useful building blocks:

- Superuser session guard through `isAdmin`
- Clinic records with:
  - `plan`
  - `subscriptionStatus`
  - `billingCycle`
  - `razorpaySubscriptionId`
  - `storageLimitBytes`
  - `status`
  - `isArchived`
- Razorpay subscription activation and webhook flow
- Storage quota calculation by plan or clinic override
- Application-wide messaging usage totals and clinic comparisons
- Login events
- PII audit logs
- Billing audit logs

### Important current limitations

The current data is sufficient for a first operational dashboard, but not for every proposed metric.

| Requirement | Current feasibility | Notes |
|---|---|---|
| Active/pending/archived tenant list | Ready | Existing clinic data and Admin queries |
| Plan and billing cycle | Ready | Already stored on clinics |
| Subscription state | Shared interpretation implemented | Legacy values are mapped in one policy; provider event history and persistent migration remain |
| Renewal date | Partial | Provider data or subscription dates need to be stored reliably |
| Subscription invoice history | Partial | Provider event/invoice records need normalization |
| SMS/WhatsApp/email usage | Ready | Existing admin messaging usage endpoint |
| Messaging quota and caps | Partial | Usage exists; policy/allowance model does not |
| Storage usage | Summary hardened | Tracked summary now includes measurement freshness; exact object scan is optional and expensive |
| Feature provisioning | Partial | Feature flags need a dedicated model rather than ad-hoc UI toggles |
| Tenant health score | New | Requires explicit, explainable scoring inputs |
| API and webhook health | Partial | Basic application health exists; historical per-provider metrics need instrumentation |
| Unified audit viewer | Partial | Login, PII, and billing logs exist but need a common admin presentation |
| Read-only support access | New | Requires dedicated, time-limited impersonation sessions |
| Multi-branch organizations | New | Requires an organization/branch model |
| Clinic revenue analytics | Out of scope | Do not add to this console |

---

## 3. Target information architecture

The Super Admin should be organized around platform operations rather than a long list of unrelated administrative tabs.

### Recommended primary navigation

1. **Overview**
2. **Tenants**
3. **Subscriptions**
4. **Service Usage**
5. **System Health**
6. **Security & Audit**

### Secondary or separate areas

- Pending registrations
- Archived tenants
- Smile Deals
- Platform configuration
- Support sessions

These can remain available, but they should not compete with operational KPIs on the landing screen.

### Overview screen

The first screen should answer:

1. Is the platform healthy?
2. Are any clinics unable to use a service?
3. Are subscriptions or payment-provider events failing?
4. Is storage or messaging approaching a limit?
5. Which tenants need attention?

It should not answer:

- Which clinic earns the most?
- Which treatment produces the most revenue?
- Which doctor has the highest bill total?

---

## 4. Overview screen specification

### 4.1 KPI row

Recommended cards:

| Card | Value | Supporting detail |
|---|---|---|
| Active tenants | Count | Approved and non-archived |
| Subscription coverage | Count and percentage | Active subscriptions / approved tenants |
| Pending attention | Count | Combined operational alerts |
| Messages this period | Count | SMS + WhatsApp + email, with channel breakdown |
| Storage used | Used / limit | Tenant aggregate, with warning count |
| Platform health | Status | Provider and application checks |

Do not show MRR, ARR, ARPU, LTV, clinic revenue, or treatment revenue in the tenant overview.

If platform leadership later requires financial reporting, it should be a separate restricted finance report, not part of the day-to-day Super Admin tenant console.

### 4.2 Alert strip

Alerts should be actionable and deduplicated:

- Subscription payment pending
- Subscription provider webhook delayed
- Messaging delivery failure rate above threshold
- Clinic message quota above 80% or 95%
- Clinic storage above 80% or 95%
- Repeated authentication failures
- Provider/API degraded
- Feature provisioning mismatch

Every alert should include:

- Severity
- Affected scope
- First detected time
- Last updated time
- Suggested action
- Link to the relevant tenant or service panel

### 4.3 Tenant attention list

The default list should prioritize operational risk:

1. Critical service failure
2. Subscription access problem
3. Hard quota reached
4. Provider delivery failure
5. Repeated security events
6. Warning thresholds

Sort order must not be based on clinic revenue.

---

## 5. Tenant directory specification

The current large clinic cards should evolve into a filterable table with a detail drawer.

### Recommended columns

| Column | Meaning |
|---|---|
| Tenant | Clinic name and location |
| Status | Approved, pending, archived, restricted |
| Subscription | Plan, cycle, and subscription state |
| Last activity | Last meaningful owner/doctor platform activity |
| Service health | Number of active warnings |
| Messages | Current-period usage and delivery status |
| Storage | Used, limit, and percentage |
| Features | Provisioned feature count or summary |
| Actions | Open details, support actions, audit |

### Recommended filters

- Tenant status
- Subscription state
- Plan
- Billing cycle
- Message usage band
- Storage usage band
- Service warning state
- Last activity range
- City/region
- Archived/non-archived

### Tenant detail drawer

The drawer should contain these sections:

#### Summary

- Tenant identity
- Status
- Plan and billing cycle
- Subscription state
- Last activity
- Open alerts

#### Subscription

- Plan
- Monthly or annual cycle
- Activation date
- Renewal date, if known
- Provider subscription ID in a copy-safe format
- Last provider event
- Payment state
- Link to subscription event history

Do not show clinic treatment revenue or patient billing totals here.

#### Platform services

- SMS usage
- WhatsApp usage
- Email usage
- Delivery success/failure
- Storage usage
- Storage threshold
- Feature access

#### Security and support

- Recent login events
- Recent admin actions
- Read-only support session action
- Link to tenant-scoped audit history

---

## 6. Subscription operations

The subscription area is about access to BookMySlot, not clinic revenue.

### Subscription states

The system should document and consistently represent:

```text
pending_payment
active
past_due
expired
cancelled
provider_error
manual_override
```

Existing values such as `unpaid` should be mapped deliberately rather than silently renamed. The migration plan must include compatibility with existing clinic records.

### Subscription list columns

- Tenant
- Plan
- Billing cycle
- Subscription state
- Renewal date
- Last provider event
- Payment-provider health
- Attention status

### Subscription actions

Allowed actions should be explicit and audited:

- Refresh provider status
- Resend activation/payment link
- Mark subscription active manually
- Place subscription into review
- View provider event history

Potentially destructive or financially meaningful actions should require:

- Confirmation dialog
- Reason
- Current user identity
- Audit event

### Subscription data to add later

A normalized provider-event model is recommended:

```text
subscription_events
  id
  clinic_id
  provider
  provider_subscription_id
  event_type
  event_status
  occurred_at
  received_at
  provider_event_id
  payload_reference
  processing_error
```

Do not store provider secrets or sensitive payment credentials in this model.

---

## 7. Platform service usage

### 7.1 Messaging

The current messaging usage endpoint is a strong starting point. It already supports:

- SMS
- WhatsApp
- Email
- Total messages
- Billable units
- Accepted messages
- Failed messages
- Skipped messages
- Six-month trend
- Clinic comparison
- Event-purpose breakdown

The operational dashboard should add:

- Current allowance
- Soft limit
- Hard limit
- Percentage consumed
- Remaining units
- Reset date
- Over-limit behavior
- Provider delivery status

### 7.2 Storage

The storage panel should show platform storage consumption only:

- Used bytes
- Allowed bytes
- Percentage used
- Threshold state
- Number of documents/files
- Last measured time
- Whether the value is tracked metadata or an exact bucket scan

The UI must distinguish:

```text
Tracked usage
Exact storage scan
Scan unavailable
```

It must not claim that DICOM storage is supported until upload validation, storage metadata, and preview/download handling support DICOM. Current project documentation states that DICOM is not currently enabled.

### 7.3 Service availability

Service cards may cover:

- Application API
- Database
- SMS provider
- WhatsApp provider
- Email provider
- R2 storage
- Razorpay subscription webhooks

Each card needs a timestamp and status source. “Operational” should not be hard-coded as a decorative badge.

---

## 8. Feature provisioning

Feature flags are useful, but they should be treated as platform access controls rather than visual toggles.

### Examples

- WhatsApp reminders
- Advanced analytics
- Custom clinic website
- X-ray/document storage
- Inventory
- Odontogram
- AI-assisted analysis

### Required flag fields

```text
feature_key
display_name
description
enabled
source: plan | tenant_override | emergency_disabled
enabled_at
enabled_by
expires_at, optional
```

### Rules

- Feature flags must be enforced server-side.
- Client-side switches are not access control.
- Every override must be audited.
- Destructive or high-cost features should require a reason.
- Feature state should be visible in the tenant drawer.

---

## 9. Health score and alerts

A health score may be useful for prioritization, but it must be explainable and must not be a proxy for clinic revenue.

### Suggested inputs

- Owner/doctor login recency
- Booking activity
- Completed appointment activity
- Patient records created
- Messaging activity
- Subscription state
- Storage risk
- Support or platform error count

### Suggested output

```text
Healthy     80–100
Stable      60–79
At risk     40–59
Critical    0–39
```

Each score should expose reasons:

```text
Health score: 64

- Subscription active
- Owner logged in 2 days ago
- Messaging activity down 35% over 30 days
- Storage at 91% of limit
```

The score should be treated as an operational hint, not an automated decision-maker.

---

## 10. Security, audit, and support access

### 10.1 Unified audit view

The existing login, PII, and billing audit sources should be presented in one Super Admin view with filters:

- Date range
- Tenant
- Actor
- Actor role
- Action
- Resource
- Success/failure
- IP address
- Impersonation/support session

The normal view should show metadata, not clinical content.

### 10.2 Read-only support session

“Log in as clinic” should initially mean **time-limited, read-only support access**.

Required safeguards:

- Explicit reason
- Short expiration
- Dedicated session record
- Visible support-session banner
- Exit action
- No credential access
- No super-admin impersonation
- Audit every session start, sensitive view, and exit
- Server-side authorization on every request

Write-enabled impersonation should not be included in the first implementation.

### 10.3 Two-person approval

For high-impact actions such as disabling a tenant, changing a hard quota, or granting a sensitive feature, support an approval workflow later rather than a hidden unrestricted override.

---

## 11. Multi-branch support

Multi-branch grouping is a useful future feature, but it is not required for the first dashboard release.

Recommended model:

```text
organization
  ├── branch / clinic
  ├── branch / clinic
  └── branch / clinic
```

Before implementation, decide:

- Whether billing is at organization or branch level
- Whether quotas are shared
- Whether administrators are organization-wide
- Whether doctors can work across branches
- Whether service usage is reported by branch, group, or both

Do not add a visual “group” badge without a real ownership model behind it.

---

## 12. HTML reference snippets

These snippets are visual and semantic references for the implementation team. The production UI should use the existing React, Tailwind, shadcn/ui, and Radix conventions rather than copying these snippets literally.

### 12.1 Admin shell

```html
<main class="admin-shell">
  <header class="admin-topbar">
    <div class="admin-brand">
      <div class="admin-brand-mark" aria-hidden="true">A</div>
      <div>
        <h1>BookMySlot Admin</h1>
        <p>Platform operations</p>
      </div>
    </div>

    <button class="global-search" type="button" aria-label="Open global search">
      <span aria-hidden="true">⌕</span>
      <span>Search tenants, subscriptions, services</span>
      <kbd>⌘ K</kbd>
    </button>

    <div class="admin-topbar-actions">
      <span class="health-pill health-pill--good">
        <span class="status-dot" aria-hidden="true"></span>
        Platform operational
      </span>
      <button class="button button--primary" type="button">Onboard clinic</button>
    </div>
  </header>

  <nav class="admin-nav" aria-label="Super Admin sections">
    <a class="admin-nav__item admin-nav__item--active" href="#overview">Overview</a>
    <a class="admin-nav__item" href="#tenants">Tenants</a>
    <a class="admin-nav__item" href="#subscriptions">Subscriptions</a>
    <a class="admin-nav__item" href="#usage">Service usage</a>
    <a class="admin-nav__item" href="#health">System health</a>
    <a class="admin-nav__item" href="#audit">Security &amp; audit</a>
  </nav>
</main>
```

### 12.2 KPI cards

```html
<section class="metric-grid" aria-label="Platform summary">
  <article class="metric-card">
    <div class="metric-card__header">
      <span class="metric-card__label">Active tenants</span>
      <span class="metric-card__trend metric-card__trend--positive">+4 this month</span>
    </div>
    <strong class="metric-card__value">42</strong>
    <p class="metric-card__hint">39 with active subscriptions</p>
  </article>

  <article class="metric-card metric-card--warning">
    <div class="metric-card__header">
      <span class="metric-card__label">Storage attention</span>
      <span class="metric-card__trend">6 tenants</span>
    </div>
    <strong class="metric-card__value">82%</strong>
    <p class="metric-card__hint">Aggregate tracked usage</p>
  </article>

  <article class="metric-card">
    <div class="metric-card__header">
      <span class="metric-card__label">Messages this period</span>
      <span class="metric-card__trend metric-card__trend--positive">98.2% delivered</span>
    </div>
    <strong class="metric-card__value">14,290</strong>
    <p class="metric-card__hint">SMS · WhatsApp · email</p>
  </article>

  <article class="metric-card metric-card--good">
    <div class="metric-card__header">
      <span class="metric-card__label">Platform health</span>
      <span class="metric-card__trend">Last checked 20s ago</span>
    </div>
    <strong class="metric-card__value">Operational</strong>
    <p class="metric-card__hint">API, database, providers</p>
  </article>
</section>
```

### 12.3 Actionable alerts

```html
<section class="panel" aria-labelledby="attention-title">
  <div class="panel__header">
    <div>
      <h2 id="attention-title">Needs attention</h2>
      <p>Operational issues affecting platform service delivery.</p>
    </div>
    <button class="button button--quiet" type="button">View all alerts</button>
  </div>

  <ul class="alert-list">
    <li class="alert-row alert-row--critical">
      <span class="alert-row__icon" aria-hidden="true">!</span>
      <div class="alert-row__body">
        <strong>Messaging provider failures increased</strong>
        <span>WhatsApp delivery is below the configured threshold.</span>
      </div>
      <span class="alert-row__meta">8 min ago</span>
      <button class="button button--quiet" type="button">Inspect</button>
    </li>
    <li class="alert-row alert-row--warning">
      <span class="alert-row__icon" aria-hidden="true">!</span>
      <div class="alert-row__body">
        <strong>Six tenants are above 90% storage</strong>
        <span>Review quotas or contact affected clinics.</span>
      </div>
      <span class="alert-row__meta">Today</span>
      <button class="button button--quiet" type="button">Review</button>
    </li>
  </ul>
</section>
```

### 12.4 Tenant operations table

```html
<section class="panel" id="tenants" aria-labelledby="tenants-title">
  <div class="panel__header panel__header--stack-mobile">
    <div>
      <h2 id="tenants-title">Tenants</h2>
      <p>Subscription and platform-service status only.</p>
    </div>
    <div class="filter-row">
      <label class="sr-only" for="tenant-search">Search tenants</label>
      <input id="tenant-search" class="field" type="search" placeholder="Search tenants">
      <button class="button button--secondary" type="button">Filters</button>
    </div>
  </div>

  <div class="table-scroll">
    <table class="operations-table">
      <caption class="sr-only">Tenant platform operations</caption>
      <thead>
        <tr>
          <th scope="col">Tenant</th>
          <th scope="col">Subscription</th>
          <th scope="col">Messages</th>
          <th scope="col">Storage</th>
          <th scope="col">Service alerts</th>
          <th scope="col"><span class="sr-only">Actions</span></th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <th scope="row">
            <div class="tenant-cell">
              <span class="tenant-avatar" aria-hidden="true">DS</span>
              <span>
                <strong>Demo Smile Clinic</strong>
                <small>Kochi · active</small>
              </span>
            </div>
          </th>
          <td>
            <span class="badge badge--good">Active</span>
            <small>Growth · monthly</small>
          </td>
          <td>
            <strong>2,400 / 5,000</strong>
            <div class="progress"><span style="width: 48%"></span></div>
          </td>
          <td>
            <strong>124 GB / 250 GB</strong>
            <div class="progress"><span style="width: 49.6%"></span></div>
          </td>
          <td><span class="badge badge--good">None</span></td>
          <td><button class="button button--quiet" type="button">Open</button></td>
        </tr>
      </tbody>
    </table>
  </div>
</section>
```

### 12.5 Tenant detail drawer

```html
<aside class="detail-drawer" aria-labelledby="tenant-detail-title">
  <div class="detail-drawer__header">
    <div>
      <span class="eyebrow">Tenant details</span>
      <h2 id="tenant-detail-title">Demo Smile Clinic</h2>
      <p>Kochi · active</p>
    </div>
    <button class="icon-button" type="button" aria-label="Close tenant details">×</button>
  </div>

  <section class="detail-section">
    <h3>Subscription</h3>
    <dl class="detail-list">
      <div><dt>Plan</dt><dd>Growth</dd></div>
      <div><dt>Billing cycle</dt><dd>Monthly</dd></div>
      <div><dt>Status</dt><dd><span class="badge badge--good">Active</span></dd></div>
      <div><dt>Next renewal</dt><dd>08 Oct 2026</dd></div>
    </dl>
  </section>

  <section class="detail-section">
    <h3>Platform services</h3>
    <div class="service-meter">
      <div><span>Messaging</span><strong>48%</strong></div>
      <div class="progress"><span style="width: 48%"></span></div>
    </div>
    <div class="service-meter">
      <div><span>Storage</span><strong>49.6%</strong></div>
      <div class="progress"><span style="width: 49.6%"></span></div>
    </div>
  </section>

  <section class="detail-section">
    <h3>Support actions</h3>
    <button class="button button--secondary button--full" type="button">
      Start read-only support session
    </button>
    <button class="button button--quiet button--full" type="button">
      View tenant audit history
    </button>
  </section>
</aside>
```

---

## 13. CSS reference tokens and layout

The existing application uses a green product theme. The Super Admin can use a darker operations shell, but it should preserve readable contrast and reuse the application's semantic colors.

```css
:root {
  --admin-bg: #0b1220;
  --admin-surface: #111b2d;
  --admin-surface-raised: #17243a;
  --admin-border: rgba(255, 255, 255, 0.11);
  --admin-text: #f3f7fb;
  --admin-muted: #a9b6c8;
  --admin-primary: #32c58a;
  --admin-cyan: #38c9df;
  --admin-warning: #f4b740;
  --admin-danger: #f16b6b;
  --admin-radius: 14px;
  --admin-shadow: 0 12px 30px rgba(0, 0, 0, 0.18);
}

.admin-shell {
  min-height: 100vh;
  padding: 24px;
  color: var(--admin-text);
  background:
    radial-gradient(circle at 8% 0%, rgba(56, 201, 223, 0.11), transparent 28rem),
    radial-gradient(circle at 92% 100%, rgba(50, 197, 138, 0.10), transparent 28rem),
    var(--admin-bg);
}

.admin-topbar,
.panel,
.metric-card,
.detail-drawer {
  border: 1px solid var(--admin-border);
  border-radius: var(--admin-radius);
  background: rgba(17, 27, 45, 0.88);
  box-shadow: var(--admin-shadow);
}

.admin-topbar {
  display: grid;
  grid-template-columns: auto minmax(240px, 1fr) auto;
  align-items: center;
  gap: 24px;
  padding: 16px 20px;
}

.admin-brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.admin-brand-mark {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border-radius: 11px;
  color: #07131b;
  font-weight: 800;
  background: linear-gradient(135deg, var(--admin-primary), var(--admin-cyan));
}

.admin-brand h1 {
  margin: 0;
  font-size: 0.98rem;
  letter-spacing: 0.02em;
}

.admin-brand p,
.panel__header p,
.tenant-cell small,
.detail-list dt,
.metric-card__hint {
  color: var(--admin-muted);
}

.global-search {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 40px;
  padding: 0 12px;
  border: 1px solid var(--admin-border);
  border-radius: 10px;
  color: var(--admin-muted);
  background: rgba(0, 0, 0, 0.18);
  text-align: left;
}

.global-search kbd {
  margin-left: auto;
  padding: 2px 6px;
  border: 1px solid var(--admin-border);
  border-radius: 5px;
  font-size: 0.7rem;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  margin: 20px 0;
}

.metric-card {
  min-height: 130px;
  padding: 16px;
}

.metric-card__header,
.service-meter > div:first-child {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.metric-card__label,
.eyebrow {
  color: var(--admin-muted);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.metric-card__value {
  display: block;
  margin-top: 14px;
  font-size: clamp(1.45rem, 2vw, 2rem);
}

.metric-card__hint {
  margin: 7px 0 0;
  font-size: 0.74rem;
}

.metric-card__trend {
  color: var(--admin-muted);
  font-size: 0.7rem;
}

.metric-card__trend--positive,
.metric-card--good .metric-card__value {
  color: var(--admin-primary);
}

.metric-card--warning {
  border-color: rgba(244, 183, 64, 0.38);
}

.admin-nav {
  display: flex;
  gap: 8px;
  margin: 18px 0;
  overflow-x: auto;
}

.admin-nav__item {
  flex: 0 0 auto;
  padding: 9px 13px;
  border: 1px solid var(--admin-border);
  border-radius: 9px;
  color: var(--admin-muted);
  text-decoration: none;
  font-size: 0.82rem;
}

.admin-nav__item--active,
.admin-nav__item:hover {
  border-color: rgba(56, 201, 223, 0.6);
  color: var(--admin-text);
  background: rgba(56, 201, 223, 0.12);
}

.panel {
  margin-top: 16px;
  overflow: hidden;
}

.panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 20px;
  border-bottom: 1px solid var(--admin-border);
}

.panel__header h2,
.detail-drawer h2 {
  margin: 0;
  font-size: 1rem;
}

.panel__header p {
  margin: 5px 0 0;
  font-size: 0.78rem;
}

.alert-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.alert-row {
  display: grid;
  grid-template-columns: auto 1fr auto auto;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
  border-bottom: 1px solid var(--admin-border);
}

.alert-row:last-child {
  border-bottom: 0;
}

.alert-row__icon {
  display: grid;
  width: 25px;
  height: 25px;
  place-items: center;
  border-radius: 50%;
  color: #111;
  font-weight: 800;
  background: var(--admin-warning);
}

.alert-row--critical .alert-row__icon {
  background: var(--admin-danger);
}

.alert-row__body {
  display: grid;
  gap: 3px;
}

.alert-row__body span,
.alert-row__meta {
  color: var(--admin-muted);
  font-size: 0.76rem;
}

.operations-table {
  width: 100%;
  min-width: 850px;
  border-collapse: collapse;
  font-size: 0.78rem;
}

.operations-table th,
.operations-table td {
  padding: 13px 16px;
  border-bottom: 1px solid var(--admin-border);
  text-align: left;
  vertical-align: middle;
}

.operations-table thead th {
  color: var(--admin-muted);
  font-size: 0.68rem;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.tenant-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.tenant-cell span:last-child {
  display: grid;
  gap: 3px;
}

.tenant-avatar {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border: 1px solid rgba(56, 201, 223, 0.35);
  border-radius: 9px;
  color: var(--admin-cyan);
  font-size: 0.7rem;
  font-weight: 800;
}

.progress {
  width: 110px;
  height: 6px;
  margin-top: 5px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.11);
}

.progress span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--admin-cyan), var(--admin-primary));
}

.badge,
.health-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: fit-content;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 700;
}

.badge {
  padding: 4px 8px;
  color: var(--admin-muted);
  background: rgba(255, 255, 255, 0.08);
}

.badge--good,
.health-pill--good {
  color: var(--admin-primary);
  background: rgba(50, 197, 138, 0.13);
}

.health-pill {
  padding: 7px 10px;
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 10px currentColor;
}

.button {
  min-height: 36px;
  padding: 8px 12px;
  border: 1px solid transparent;
  border-radius: 8px;
  font: inherit;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
}

.button--primary {
  color: #06130f;
  background: linear-gradient(135deg, var(--admin-primary), var(--admin-cyan));
}

.button--secondary,
.button--quiet {
  border-color: var(--admin-border);
  color: var(--admin-text);
  background: rgba(255, 255, 255, 0.06);
}

.button--quiet {
  color: var(--admin-cyan);
  background: transparent;
}

.button--full {
  width: 100%;
  margin-top: 8px;
}

.detail-drawer {
  position: fixed;
  inset: 0 0 0 auto;
  z-index: 20;
  width: min(440px, 100%);
  overflow-y: auto;
  padding: 20px;
  border-radius: 16px 0 0 16px;
}

.detail-drawer__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--admin-border);
}

.detail-drawer__header p {
  margin: 5px 0 0;
  color: var(--admin-muted);
  font-size: 0.78rem;
}

.detail-section {
  padding: 18px 0;
  border-bottom: 1px solid var(--admin-border);
}

.detail-section h3 {
  margin: 0 0 12px;
  color: var(--admin-muted);
  font-size: 0.72rem;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.detail-list {
  display: grid;
  gap: 10px;
  margin: 0;
}

.detail-list > div {
  display: flex;
  justify-content: space-between;
  gap: 16px;
}

.detail-list dd {
  margin: 0;
  font-weight: 700;
  text-align: right;
}

.service-meter {
  margin-top: 12px;
}

.service-meter > div:first-child {
  font-size: 0.78rem;
}

@media (max-width: 980px) {
  .admin-topbar {
    grid-template-columns: 1fr auto;
  }

  .global-search {
    grid-column: 1 / -1;
    grid-row: 2;
  }

  .metric-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .admin-shell {
    padding: 12px;
  }

  .admin-topbar {
    grid-template-columns: 1fr;
  }

  .admin-topbar-actions {
    display: flex;
    flex-wrap: wrap;
  }

  .metric-grid {
    grid-template-columns: 1fr;
  }

  .panel__header--stack-mobile {
    align-items: stretch;
    flex-direction: column;
  }

  .alert-row {
    grid-template-columns: auto 1fr;
  }

  .alert-row__meta,
  .alert-row .button {
    grid-column: 2;
    justify-self: start;
  }
}
```

### Visual implementation rules

- Use the existing design system primitives in production.
- Preserve visible focus states.
- Keep table content horizontally scrollable on small screens.
- Do not use color as the only status indicator.
- Use skeletons for loading, an explicit error state with retry, and an explicit empty state.
- Add `data-testid` to every interactive element according to project conventions.
- Avoid fake sparklines or “live” values when no real time-series data exists.
- Every timestamp should identify its time basis or timezone.

---

## 14. Suggested API contracts

These are planning contracts. Exact names may change during implementation, but the response boundaries should remain similar.

### Overview

```http
GET /api/admin/operations/overview?period=30d
```

```json
{
  "period": {
    "key": "30d",
    "from": "2026-08-07T00:00:00.000Z",
    "to": "2026-09-06T00:00:00.000Z",
    "timezone": "UTC"
  },
  "tenants": {
    "active": 42,
    "pending": 3,
    "archived": 5,
    "withAttention": 8
  },
  "subscriptions": {
    "active": 39,
    "pendingPayment": 3,
    "pastDue": 0
  },
  "services": {
    "messages": {
      "total": 14290,
      "deliveryRate": 0.982
    },
    "storage": {
      "usedBytes": 1503238553600,
      "limitBytes": 2147483648000,
      "usagePercent": 70
    }
  },
  "health": {
    "status": "operational",
    "checkedAt": "2026-09-06T10:00:20.000Z"
  },
  "attention": []
}
```

### Tenant directory

```http
GET /api/admin/operations/tenants
  ?status=active
  &subscriptionStatus=active
  &storageBand=warning
  &messageBand=normal
  &search=smile
  &cursor=...
```

The endpoint should return paginated data. Do not load every tenant's detailed metrics into the initial page when the tenant count grows.

### Tenant details

```http
GET /api/admin/operations/tenants/:clinicId
```

The response must contain subscription and platform-service data only. Patient billing and clinical data must not be joined into this response.

### Implemented storage summary

```http
GET /api/admin/storage-usage
```

The current implementation returns aggregate tracked document storage by clinic, using active `patient_documents` rows and the existing plan or clinic storage limit. It returns usage bytes, limit bytes, remaining bytes, percentage, file count, and the limit source. It does not return patient, document, or clinical-record details.

### Audit

```http
GET /api/admin/operations/audit
  ?clinicId=12
  &actorType=superuser
  &resourceType=subscription
  &from=...
  &to=...
```

### Support session

```http
POST /api/admin/support-sessions
```

```json
{
  "clinicId": 12,
  "reason": "Investigate messaging delivery issue",
  "mode": "read_only"
}
```

The response should return a short-lived session reference, not clinic credentials.

---

## 15. Data and database work packages

### Minimum first-release data changes

The first release can avoid a large schema redesign if it focuses on read-only operational summaries:

- Normalize subscription status interpretation in one shared service.
- Expose storage quota summaries using existing quota logic.
- Reuse the existing messaging usage aggregation.
- Add a tenant operations DTO that deliberately excludes clinic patient billing data.
- Add alert calculation in a service layer.
- Add a unified audit query/DTO over existing audit sources where practical.

### Recommended follow-up tables

These are not all required before the first UI release:

```text
subscription_events
tenant_message_quota_policies
tenant_usage_snapshots
tenant_feature_flags
tenant_health_snapshots
support_sessions
service_health_checks
```

### Database safety requirements

For any new table or column:

- Declare it in `shared/schema.ts`.
- Add the matching idempotent startup migration in `server/index.ts`.
- Keep new columns nullable or give them safe defaults.
- Add the exact Render SQL to the team handoff.
- Add methods to `IStorage` and `DatabaseStorage`.
- Keep Drizzle and startup schema registration consistent.
- Do not join patient bills into Super Admin operations queries.

---

## 16. Team split

The work can be split into the following tracks. The dependency column is important: teams should not start dependent work against invented data shapes.

| Work package | Owner | Scope | Dependencies |
|---|---|---|---|
| SA-01 Product and access policy | Product + security | Confirm data boundary, roles, allowed actions, subscription states, support-session rules | None |
| SA-02 Operations data contract | Backend + frontend lead | Define overview, tenant, detail, alert, and audit DTOs | SA-01 |
| SA-03 Admin shell/navigation | Frontend | Build Overview/Tenants/Subscriptions/Usage/Health/Audit information architecture | SA-01 |
| SA-04 Overview UI | Frontend | KPI cards, alerts, health summary, loading/error/empty states | SA-02, SA-03 |
| SA-05 Tenant directory | Frontend | Paginated table, filters, sorting, tenant drawer | SA-02, SA-03 |
| SA-06 Existing data aggregation | Backend | Tenant summaries from clinics, quota logic, messaging usage, login activity | SA-02 |
| SA-07 Subscription operations | Backend + frontend | Subscription state mapping, renewal/provider event view, safe manual actions | SA-01, SA-02 |
| SA-08 Messaging quota policy | Backend + frontend | Allowances, thresholds, reset period, warning state | SA-01, SA-02 |
| SA-09 Storage operations | Backend + frontend | Storage summary, tracked-vs-scan source, threshold alerts | SA-02 |
| SA-10 Feature provisioning | Backend + frontend | Feature registry, tenant overrides, server enforcement, audit | SA-01, SA-02 |
| SA-11 Unified audit | Backend + frontend | Read-only audit query and filters across existing audit sources | SA-01, SA-02 |
| SA-12 Read-only support sessions | Backend + security + frontend | Expiring session, banner, exit, audit, server enforcement | SA-01, SA-11 |
| SA-13 Health instrumentation | Backend + operations | Provider checks, webhook age, latency/error summaries, freshness timestamps | SA-02 |
| SA-14 Accessibility and responsive QA | QA + frontend | Keyboard, contrast, mobile table/drawer, focus, screen-reader labels | SA-03–SA-05 |
| SA-15 Security and authorization QA | Security + backend | Scope checks, data leakage tests, audit verification, session expiry | SA-07, SA-10–SA-12 |
| SA-16 Build and release verification | QA/release | Build Check, type checks, API tests, smoke tests, migration verification | All implementation tracks |

### Recommended parallelization

After SA-01 and SA-02:

- Frontend teams can work on SA-03, SA-04, and SA-05 using mocked DTO fixtures.
- Backend can work on SA-06, SA-07, SA-08, and SA-09.
- Security can prepare SA-11 and SA-12 policy/tests.

SA-10 feature provisioning and SA-13 health instrumentation should follow the first read-only release unless there is an immediate business requirement.

---

## 17. Acceptance criteria for the first release

### Product behavior

- The Overview screen opens with platform-service KPIs.
- No clinic revenue or patient treatment billing totals appear.
- Tenant search and filters work.
- Tenant detail shows subscription, storage, messaging, features, and operational warnings.
- Subscription state is represented consistently.
- Storage and messaging values identify their reporting period and freshness.
- Existing pending, archived, and login-activity workflows remain accessible.
- Existing Smile Deals functionality remains available without crowding the operations overview.

### Security

- All new routes require Super Admin authorization.
- Tenant detail DTOs do not include patient bills, treatment revenue, or clinical records.
- Any manual subscription or quota mutation is validated, authorized, and audited.
- Support access does not reveal clinic credentials.
- Read-only support sessions expire.
- Audit filters cannot be used to retrieve unrelated patient content.

### UX and accessibility

- All loading states use skeletons or explicit progress states.
- All error states include useful retry or recovery actions.
- Empty states explain why no data is present.
- Tables remain usable on narrow screens through horizontal scrolling or a responsive alternative.
- Keyboard focus is visible.
- Icon-only controls have accessible labels.
- Status is communicated with text as well as color.
- The detail drawer can be opened and closed without trapping the user in an inaccessible state.

### Engineering

- New mutations use route-specific Zod schemas.
- New database entities are registered in both Drizzle schema and startup migration.
- Queries live in storage/service layers, not directly in route handlers.
- The Build Check workflow completes successfully.
- No fake operational metrics are committed as production data.
- No secrets or provider credentials are displayed in the UI or logs.

---

## 18. Explicit non-goals

The following must not be included in this Super Admin redesign:

- Clinic revenue ranking
- Treatment revenue charts
- Patient bill totals by clinic
- Doctor earnings
- ARPU or LTV per clinic
- Profit or margin reporting
- Routine access to clinical records
- Routine access to patient payment details
- 3D geographic map before reliable location and health data exist
- AI-generated “quick fixes” that mutate subscription or quota state without review
- Write-enabled impersonation in the first release
- DICOM marketing language before the storage and preview pipeline supports DICOM

---

## 19. Recommended delivery sequence

### Release A — Read-only platform operations — implemented

1. Confirm SA-01 policy.
2. Define SA-02 DTOs.
3. Build the shell and navigation.
4. Add overview KPIs and alerts.
5. Add paginated tenant directory.
6. Add tenant detail drawer.
7. Reuse messaging and storage summaries.
8. Add unified read-only audit entry point.

The current implementation delivers the Overview tab, tenant operations table, tenant detail drawer, messaging summary reuse, storage summary endpoint, operational warnings, and privacy boundary. The unified audit entry point remains deferred because the existing audit sources still need a dedicated normalized read model.

### Release B — Controlled operations

1. Subscription state normalization — **started: shared interpretation and legacy compatibility implemented; provider event history and persistent migration remain.**
2. Provider event history.
3. Messaging quota policies.
4. Storage warning thresholds — **started: storage freshness metadata and explicit unavailable states implemented; threshold policy remains.**
5. Feature provisioning with audit.

### Release C — Secure support and observability

1. Read-only support sessions.
2. Provider/webhook health metrics.
3. Tenant health score with explanations.
4. Incident and alert history.

### Release D — Organization features

1. Multi-branch organization model.
2. Group-level service usage.
3. Shared quota policies where required.
4. Organization-level administrators.

This sequencing keeps the first release useful without requiring every future data model at once.
