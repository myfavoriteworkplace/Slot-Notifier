# BookMySlot application audit and TODO dossier

**Audit baseline:** August 10, 2026  
**Scope:** Current repository state, including the uploaded audit observation at `attached_assets/Pasted-Audit-completed-no-application-code-changed-I-found-tha_1786372797835.txt`.

This folder contains an evidence-based review of the application and a prioritized TODO backlog. It is intentionally separate from the product and developer documentation already under `docs/`.

## Documents

| Document | Purpose |
|---|---|
| [01-application-inventory.md](./01-application-inventory.md) | Product surface, roles, routes, runtime architecture, integrations, and source map |
| [02-uploaded-audit-verification.md](./02-uploaded-audit-verification.md) | Verification of every major observation in the uploaded audit |
| [03-data-and-domain-audit.md](./03-data-and-domain-audit.md) | Booking lifecycle, database model, filters, patient identity, billing, inventory, and storage findings |
| [04-security-and-operations-audit.md](./04-security-and-operations-audit.md) | Authentication, authorization, PII, uploads, integrations, configuration, deployment, and dependency findings |
| [05-quality-and-test-baseline.md](./05-quality-and-test-baseline.md) | Build/type-check/test/scan results and test coverage gaps |
| [06-prioritized-todo.md](./06-prioritized-todo.md) | Recommended implementation order with acceptance criteria |
| [07-booking-footer-policy-plan.md](./07-booking-footer-policy-plan.md) | Phase tracker for the role- and lifecycle-aware appointment footer |
| [08-ui-optimisation.md](./08-ui-optimisation.md) | Patient-card spacing, pill sizing, warning-banner alignment, and responsive header decisions |
| [09-reminder-module-plan.md](./09-reminder-module-plan.md) | Independent implementation plan for in-app appointment reminders and daily staff email digests |
| [10-environment-categorisation-plan.md](./10-environment-categorisation-plan.md) | Compatibility-first plan for separating `APP_ENV` labels from `NODE_ENV` runtime behavior |

## Executive summary

The application is a feature-rich dental clinic platform with a React/Vite frontend, Express/TypeScript backend, PostgreSQL/Drizzle data layer, session authentication, and integrations for email, messaging, payments, AI analysis, and Cloudflare R2 storage.

The highest-risk themes are:

1. **Booking state is still classified in several places.** The shared information-message component exists and is used by clinic and doctor surfaces, but date boundaries, terminal states, counts, and action eligibility are still implemented independently in client helpers, clinic storage queries, doctor storage queries, and dashboard branches.
2. **Old-booking action rules are not fully centralized.** The client action helper does not use calendar age, and doctor action branches still need a verified state matrix for old pre-arrival bookings versus active/completed exceptions.
3. **Mutation validation is uneven.** The repository has route-level `safeParse` usage, but many mutating routes destructure or spread `req.body` directly into storage operations.
4. **The quality baseline is mixed.** `npm run build` succeeds; the booking-list unit tests pass; `npm run check` currently fails with pre-existing TypeScript errors across nine source files.
5. **Dependency risk is material.** `npm run scan` reports 15 high and 8 medium dependency findings, plus unavailable optional SAST tools.

No application code was changed during this audit. Only this documentation dossier was added.

## Evidence conventions

- **Confirmed:** directly supported by current source inspection or a command result.
- **Partially resolved:** the uploaded observation described a real issue, but current code contains a partial fix.
- **Still open:** current code still demonstrates the risk or does not provide enough evidence of a complete fix.
- **Needs runtime verification:** source inspection alone cannot establish the production behavior.
- File and line references are intentionally approximate where code is large; search by the cited symbol or route if line numbers move.