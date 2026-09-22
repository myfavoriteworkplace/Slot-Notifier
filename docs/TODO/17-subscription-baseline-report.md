# Subscription Baseline Report

- Generated: 2026-09-22T18:43:30.097Z
- Environment: development
- Scope: All clinic rows in the configured database, including archived clinics. No patient names, clinic names, emails, phone numbers, or provider identifiers are emitted.

## Summary

- Total clinics: 1
- Active clinics: 1
- Archived clinics: 0
- Clinics with risk/data-quality flags: 1
- Unattributed bookings: 0
- Plan distribution: starter=1
- Subscription states: pending_payment=1
- Inventory classifications: reconciliation_required=1
- Reconciliation queue: 1

## Data availability

| Area | Status |
|---|---|
| clinics | available |
| clinicDoctors | available |
| bookingsAndSlots | available |
| smileDeals | available |
| communicationUsage | unavailable |
| patientDocuments | available |
| subscriptionProviderEvents | unavailable |
| patients | available |
| activationTokens | available |
| lifecycleHistory | unavailable |
| planAssignments | unavailable |
| sponsoredAccess | unavailable |
| manualExceptions | unavailable |
| upgradeRequests | unavailable |
| offlinePaymentEvidence | unavailable: no dedicated offline payment record table exists |
| trialLifecycle | unavailable: Trial snapshot fields are missing |
| policyVersion | unavailable: no versioned plan-policy catalog exists |
| activeDoctorDefinition | partial: clinic_doctors links have no active flag |
| smileDealDraftDefinition | partial: no draft/published status exists |
| bookingAttribution | complete |

## Subscription inventory

| Clinic ID | Account status | Requested plan | Current/legacy plan | Subscription status | Inventory classification | Trial dates | Paid expiry | Provider link | Activation tokens | Sponsored grants | Lifecycle events | Upgrade requests | Flags |
|---:|---|---|---|---|---|---|---|---|---|---|---:|---|---|
| 1 | approved | <null> | starter | unpaid | reconciliation_required | none | none | not_linked | 0 usable / 0 total | unavailable | 0 | unavailable | legacy_unpaid_maps_to_pending_payment, paid_plan_without_provider_link, above_proposed_trial_limit, pending_payment_trial_dates_cleared, paid_plan_without_provider_or_payment_evidence |

## Clinic baseline

| Clinic ID | Status | Archived | Plan | Subscription state | Provider link | Billing | Bookings (month/all) | Doctors | Smile Deals (live/total) | Storage bytes | Messages (SMS/WA/email) | Flags |
|---:|---|---|---|---|---|---|---:|---:|---:|---:|---|---|
| 1 | approved | no | starter | pending_payment | not_linked | monthly | 0/17 | 1 | 0/0 | 0 | 0/0/0 | legacy_unpaid_maps_to_pending_payment, paid_plan_without_provider_link, above_proposed_trial_limit, pending_payment_trial_dates_cleared, paid_plan_without_provider_or_payment_evidence |

## Reconciliation queue

| Clinic ID | Classification | Flags | Recommended actions |
|---:|---|---|---|
| 1 | reconciliation_required | legacy_unpaid_maps_to_pending_payment, paid_plan_without_provider_link, above_proposed_trial_limit, pending_payment_trial_dates_cleared, paid_plan_without_provider_or_payment_evidence | reconcile_pending_payment, reconcile_paid_access_evidence |

## Limitations and migration decisions

- This report classifies existing snapshots and evidence; it does not infer active paid access from a plan, provider subscription ID, payment link, or generic manual override.
- The configured project does not have a production database attached, so a live production baseline cannot be generated here until deployment creates one or an approved production snapshot is supplied.
- Trial dates, Trial origin, previous paid plan, paid-expiry history, exception history, and policy versions may be absent on older clinic rows even when the current schema supports them.
- There is no dedicated offline-payment evidence table, so manual overrides cannot be treated as verified offline payment.
- Active doctor counts are based on clinic_doctors links because the current schema has no active/inactive doctor field.
- Smile Deal live-post counts are a proxy based on is_active and the starts_at/expires_at window because draft and published states are not separate fields.

This report is read-only. It does not assign plans, change subscription state, create exceptions, or enforce limits.

