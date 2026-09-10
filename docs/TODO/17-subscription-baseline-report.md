# Subscription Baseline Report

- Generated: 2026-09-10T19:04:26.117Z
- Environment: development
- Scope: All clinic rows in the configured database, including archived clinics. No patient names, clinic names, emails, phone numbers, or provider identifiers are emitted.

## Summary

- Total clinics: 0
- Active clinics: 0
- Archived clinics: 0
- Clinics with risk/data-quality flags: 0
- Unattributed bookings: 0
- Plan distribution: none
- Subscription states: none

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
| policyVersion | unavailable: no versioned plan-policy catalog exists |
| activeDoctorDefinition | partial: clinic_doctors links have no active flag |
| smileDealDraftDefinition | partial: no draft/published status exists |
| bookingAttribution | complete |

## Clinic baseline

| Clinic ID | Status | Archived | Plan | Subscription state | Provider link | Billing | Bookings (month/all) | Doctors | Smile Deals (live/total) | Storage bytes | Messages (SMS/WA/email) | Flags |
|---:|---|---|---|---|---|---|---:|---:|---:|---:|---|---|
| — | No clinic rows are present in the configured database | — | — | — | — | — | — | — | — | — | — |

## Limitations and migration decisions

- The configured development database currently has no clinic rows.
- This project has no production database attached, so a live production baseline cannot be generated here until deployment creates one.
- Trial dates, Trial origin, previous paid plan, paid-expiry history, exception history, and policy versions are not currently stored.
- Active doctor counts are based on clinic_doctors links because the current schema has no active/inactive doctor field.
- Smile Deal live-post counts are a proxy based on is_active and the starts_at/expires_at window because draft and published states are not separate fields.

This report is read-only. It does not assign plans, change subscription state, create exceptions, or enforce limits.

