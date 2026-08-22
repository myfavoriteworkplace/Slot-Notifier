# 6. Prioritized TODO backlog

This backlog is ordered by risk and dependency. It is a recommendation from the audit, not an implementation record.

## P0 — protect correctness and release confidence

### P0-1 — Make the project type-check cleanly

**Why:** The production bundle succeeds, but `npm run check` fails across booking, billing, inventory, medical history, dashboard, and server route code. This makes regressions easy to miss.

**Relevant files:** all files listed in [05-quality-and-test-baseline.md](./05-quality-and-test-baseline.md), especially `AppointmentCard.tsx`, `BillingHistoryPanel.tsx`, `BookingsPanel.tsx`, `ClinicDashboard.tsx`, `DoctorDashboard.tsx`, `MedicalHistoryTab.tsx`, and `server/routes.ts`.

**Done looks like:**

- `npm run check` exits 0.
- No `any` is introduced merely to silence the existing errors.
- Shared unions/types are updated at their canonical source.
- The existing booking-list unit suite still passes.

### P0-2 — Centralize booking classification and lifecycle policy

**Why:** The same booking can still be classified by different rules in client helpers, clinic storage, doctor storage, card components, dialogs, and stats.

**Relevant files:** `client/src/lib/booking-list.ts`, `client/src/components/AppointmentCard.tsx`, `client/src/components/BookingsPanel.tsx`, `client/src/pages/DoctorDashboard.tsx`, `server/storage.ts`, `shared/schema.ts`.

**Done looks like:**

- One documented local-date policy: old means appointment calendar date before local today.
- Same-day past-due is a separate state.
- Terminal, active, treatment-completed, and read-only states are named and tested.
- Null `visitStatus` behavior is explicit.
- Clinic and doctor list counts use the same base classification with role visibility applied afterward.

### P0-3 — Prevent invalid doctor actions on old pre-arrival bookings

**Why:** The uploaded audit identified a user-visible correctness risk: stale appointments may expose consultation/treatment actions.

**Relevant files:** `client/src/lib/booking-list.ts`, `client/src/components/AppointmentCard.tsx`, `client/src/pages/DoctorDashboard.tsx`.

**Done looks like:**

- Old pending/confirmed pre-arrival bookings show resolution/expired state only.
- Old checked-in and in-consultation records follow the documented active exception.
- Old completed/treatment-completed records are read-only as appropriate.
- The same guards apply to cards, popups, notification deep links, and bookings outside the current page.

### P0-4 — Require production encryption configuration if compliance requires encryption

**Why:** `server/encryption.ts` intentionally falls back to plaintext when `ENCRYPTION_KEY` is missing or invalid.

**Relevant files:** `server/encryption.ts`, `server/index.ts`, `.env.render.backend.example`, compliance documentation.

**Done looks like:**

- Production startup fails clearly when the key is absent/invalid.
- A documented key rotation and migration process exists.
- Deferred fields are either encrypted or explicitly accepted as a documented exception.
- No secret value is committed or printed.

## P1 — remove data and authorization risk

### P1-1 — Add route-specific Zod validation to every mutation

**Why:** Broad `req.body` destructuring/spreading creates over-posting and invalid-state risk.

**Relevant files:** `server/routes.ts`, `shared/schema.ts`, `shared/routes.ts`.

**Done looks like:**

- Every POST/PATCH/PUT parses a route-specific schema before storage or side effects.
- PATCH schemas allow only intended fields.
- Invalid dates, enums, IDs, quantities, file metadata, and payment fields are rejected consistently.
- Error responses are stable enough for frontend handling.

### P1-2 — Standardize authorization middleware and ownership checks

**Why:** Authentication is present in many places, but the mix of middleware and inline session checks makes omissions difficult to detect.

**Relevant files:** `server/routes.ts`, `server/storage.ts`, `server/auditLog.middleware.ts`.

**Done looks like:**

- Common guards exist for superuser, clinic owner, doctor, and authenticated staff.
- Clinic ID and doctor assignment checks are performed in storage/domain methods, not only in route branches.
- An automated route inventory flags unguarded private mutations.

### P1-3 — Make sensitive documents private end-to-end

**Why:** Patient document uploads use private key paths, but the signed URL service returns a public URL shape and the general upload route accepts broad folder metadata.

**Relevant files:** `server/signedUrl.service.ts`, `server/routes.ts`, `client/src/components/PatientDocumentsTab.tsx`, `server/r2Client.ts`, `docs/r2-storage.md`.

**Done looks like:**

- Patient documents never require a public URL.
- Downloads use authorization-aware short-lived signed URLs.
- General uploads have role/folder allowlists.
- Orphan objects, deletion, and quota reconciliation are operationally visible.

### P1-4 — Harden public lookup, payment, and webhook endpoints

**Why:** These endpoints cross trust boundaries and can expose patient data or trigger side effects.

**Relevant files:** public route sections in `server/routes.ts`, payment and messaging services.

**Done looks like:**

- Public patient lookup returns minimal data.
- OTP/verified tokens are scoped, expiring, and single-purpose.
- Razorpay webhook/order verification is authenticated and idempotent.
- WhatsApp webhook POST authenticity is verified.
- Public health responses do not expose unnecessary infrastructure details.

### P1-5 — Reconcile patient identity and visit aggregates

**Why:** Denormalized counters and mixed identity fallback logic can make the patient directory disagree with booking history.

**Relevant files:** `shared/schema.ts`, patient methods in `server/storage.ts`, public booking routes, `PatientDirectoryPanel.tsx`.

**Done looks like:**

- A canonical identity matching policy is documented.
- Visit count and last visit use lifecycle-valid bookings.
- Reconciliation can detect and repair drift.
- Selected end dates include the full calendar day.

## P2 — improve maintainability and user experience

### P2-1 — Finish shared appointment information view-model

**Why:** `AppointmentInfoSection` now centralizes rendering, but callers still calculate inputs independently.

**Relevant files:** `AppointmentInfoSection.tsx`, `AppointmentCard.tsx`, `BookingsPanel.tsx`, `DoctorDashboard.tsx`.

**Done looks like:**

- Callers pass one normalized booking display model.
- Message ordering and terminology are identical across card and popup.
- Billing, consent, completion note, and lifecycle sections have an intentional order.

### P2-2 — Standardize responsive action footers

**Why:** Fixed action groups remain a likely narrow-screen failure point.

**Relevant files:** `AppointmentCard.tsx`, `BookingsPanel.tsx`, `DoctorDashboard.tsx`, dashboard UI standards docs.

**Done looks like:**

- Shared responsive grid/wrap primitives are used.
- Mobile, tablet, and desktop layouts are tested.
- Long labels do not overflow.
- Footer remains reachable when dialog content grows.

### P2-3 — Reduce large authenticated bundles

**Why:** Build succeeds but several chunks exceed 500 kB after minification.

**Relevant files:** `vite.config.ts`, `client/src/App.tsx`, `ClinicDashboard.tsx`, `DoctorDashboard.tsx`.

**Done looks like:**

- Active-panel code is lazy-loaded where practical.
- Initial public and login bundles do not include full clinic/doctor operations.
- Before/after bundle sizes and route performance are recorded.

### P2-4 — Make migrations canonical and verifiable

**Why:** Drizzle migrations and startup schema sync both exist.

**Relevant files:** `migrations/`, `shared/schema.ts`, `server/index.ts`, `drizzle.config.ts`.

**Done looks like:**

- Production migration ownership is unambiguous.
- Schema drift check runs in CI.
- Startup does not silently become the only path for structural schema changes.

## P3 — dependency and operational hardening

### P3-1 — Triage and remediate dependency advisories

**Why:** The scan reports 15 high, 8 medium, and 2 low npm audit findings.

**Relevant files:** `package.json`, `package-lock.json`, build configuration.

**Done looks like:**

- Each advisory is mapped to reachability and environment.
- Safe upgrades are applied in small batches.
- `npm run build`, `npm run check`, unit tests, and Playwright smoke tests pass after each batch.
- Lockfile hygiene is preserved.

### P3-2 — Restore complete security scanning

**Why:** ESLint security scan, Semgrep parsing, and NodeJsScan are not currently providing a complete signal.

**Relevant files:** `scripts/scan.cjs`, package/dev tooling, CI/workflow configuration.

**Done looks like:**

- The chosen SAST tools are installed or replaced with an approved equivalent.
- Scanner failures are treated as visible failures, not “no findings.”
- Findings are triaged with owners and due dates.

### P3-3 — Add production observability for side effects and audit writes

**Why:** Email, messaging, payments, uploads, AI, and audit writes can fail independently of the originating request.

**Relevant files:** service files under `server/`, `auditLog.middleware.ts`, logging in `server/index.ts`.

**Done looks like:**

- Correlation IDs connect request, domain mutation, notification, and provider events.
- Failed audit writes and external deliveries are measurable.
- Retry/idempotency behavior is documented.
- Operators can distinguish user action failure from notification delivery failure.

## Suggested execution sequence

1. P0-1 type-check cleanup
2. P0-2 canonical lifecycle/date classifier
3. P0-3 doctor action guards and state-matrix tests
4. P1-1 mutation schemas and P1-2 authorization standardization
5. P1-3 private document delivery and P1-4 public/webhook hardening
6. P1-5 patient aggregate reconciliation
7. P2 UI consistency/responsive work
8. P2-4 migration canonicalization
9. P3 dependency/scanner/observability hardening