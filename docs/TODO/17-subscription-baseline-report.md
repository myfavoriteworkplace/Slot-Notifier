# Subscription Baseline Report

- Generated: 2026-09-12T07:40:33.749Z
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

## Data availability

| Area | Status |
|---|---|
| clinics | available |
| clinicDoctors | available |
| bookingsAndSlots | available |
| smileDeals | available |
| communicationUsage | available |
| patientDocuments | available |
| subscriptionProviderEvents | available |
| patients | available |
| trialLifecycle | unavailable: no explicit Trial lifecycle fields or table exist |
| manualExceptions | unavailable: no dedicated exception history table or fields exist |
| policyVersion | unavailable: no persisted versioned plan-policy catalog exists |
| activeDoctorDefinition | partial: clinic_doctors links have no active flag |
| smileDealDraftDefinition | partial: no draft/published status exists |
| bookingAttribution | complete |

## Clinic baseline

| Clinic ID | Status | Archived | Plan | Subscription state | Provider link | Billing | Bookings (month/all) | Doctors | Smile Deals (live/total) | Storage bytes | Messages (SMS/WA/email) | Flags |
|---:|---|---|---|---|---|---|---:|---:|---:|---:|---|---|
| 1 | approved | no | starter | pending_payment | not_linked | monthly | 0/17 | 1 | 0/0 | 0 | 0/0/0 | legacy_unpaid_maps_to_pending_payment, paid_plan_without_provider_link, above_proposed_trial_limit |

## Limitations and migration decisions

- The configured Replit development database contains one active development clinic for this report.
- The application is deployed on Render with a separate PostgreSQL database, but this report was not run against that Render database. That full Render-clinic baseline is intentionally deferred until pre-production rollout preparation.
- The development clinic is a baseline-validation row, not evidence that all production clinics are within limits. It is currently above the proposed Trial booking limit and has a legacy unpaid subscription state mapped to pending payment.
- Trial dates, Trial origin, previous paid plan, paid-expiry history, exception history, and policy versions are not currently stored.
- Active doctor counts are based on clinic_doctors links because the current schema has no active/inactive doctor field.
- Smile Deal live-post counts are a proxy based on is_active and the starts_at/expires_at window because draft and published states are not separate fields.

## Production baseline gate attempt

On **2026-09-12 (Asia/Calcutta)**, the approved production read-only database path was checked before running the baseline. The platform reported that this Repl has no production database attached and that publishing the app is required to create one. The production baseline therefore could not run, and no production records were read or changed.

This report remains development-environment evidence only and must not be treated as the current-clinic Render baseline. The shared catalog and baseline policy have passing representative tests. After an approved production database or populated production snapshot becomes available, the same generator must be run read-only and the report must record each clinic’s migration or exception decision before production rollout or enforcement.

This report is read-only. It does not assign plans, change subscription state, create exceptions, or enforce limits.

