# 4. Security and operations audit

## 4.1 Authentication and session security

Positive controls found:

- Express sessions use an HTTP-only cookie.
- Production requires `SESSION_SECRET`.
- Production cookies use secure cross-site settings for the documented cross-origin deployment.
- PostgreSQL-backed session storage is configured.
- Login endpoints use rate limiters.
- OTP sending and verification are rate-limited.
- Public booking creation and consent signing are rate-limited.
- Login events are stored.

### Risks and follow-up

1. **Mixed authorization idioms.** Some routes use `isAuthenticated`, others inspect session fields inline, and some use `isAdmin`. This makes the authorization contract difficult to audit.
2. **Role scope is route-specific but not always obvious.** A common authenticated route can accept both admin and doctor sessions; clinic ownership and doctor assignment checks must be verified per operation.
3. **Session regeneration needs consistency review.** Login code regenerates sessions in some flows; all admin, clinic, and doctor login paths should use a consistent fixation-resistant pattern.
4. **Development fallback secret.** The development fallback is intentionally not a production secret, but local environments should be warned clearly when it is used.

## 4.2 Mutating route validation

The repository contains route-level Zod validation, including `safeParse`, but validation coverage is uneven. Current source inspection found many mutating handlers that:

- destructure directly from `req.body`
- spread `req.body` into storage payloads
- pass `req.body` to update methods
- accept broad dynamic update objects

Representative areas include Smile DEALS, uploads, doctor profile/case/certification changes, clinic website settings, clinical records, inventory, pharmacy, bills, and some auth flows.

### Risk

Unvalidated body fields can cause:

- persistence of unsupported columns or values
- type coercion bugs
- over-posting/mass-assignment behavior
- inconsistent error responses
- security-sensitive fields being changed by a client

### TODO

Create one explicit Zod schema per POST/PATCH/PUT route. Parse before:

- calling storage
- constructing DB insert/update objects
- performing external side effects

For PATCH routes, use an allowlisted partial schema, not `z.record(z.unknown())`.

## 4.3 PII and clinical data

The app handles names, phone numbers, emails, consent signatures, clinical notes, prescriptions, diagnosis, patient documents, and X-ray images.

Positive controls found:

- `server/auditLog.middleware.ts` records successful PII access/mutation events for routes where the middleware is attached.
- Sensitive fields are encrypted when `ENCRYPTION_KEY` is present.
- Encryption uses AES-256-GCM with a random IV and authentication tag.
- Patient document keys are server-derived.
- Existing compliance documentation defines retention and anonymization intentions.

### Important gaps

1. **Encryption is optional.** If `ENCRYPTION_KEY` is absent or invalid, `encryptField()` returns plaintext and logs a warning. This is useful for development but must be a hard production startup requirement if at-rest protection is a compliance requirement.
2. **Coverage is partial.** Existing compliance documentation states some fields, including diagnosis and visit completion notes, remain deferred.
3. **Audit logging is opt-in by route.** The middleware is not a universal PII guard. New routes can accidentally omit it.
4. **Audit writes are fire-and-forget.** This avoids slowing requests but means failed audit persistence does not block access and may be lost.
5. **Sensitive download semantics need review.** Returning public R2 URLs for patient documents would weaken the private-storage design.

## 4.4 Public endpoints and data minimization

Public route families include clinic discovery, availability, patient lookup, patient-by-email lookup, public booking, uploads, payment operations, Smile DEALS counters, consent token access, health checks, and webhooks.

### High-priority review

- Confirm that public patient lookup endpoints return only the minimum fields needed for the booking flow.
- Verify OTP/verified-token binding to email, clinic, purpose, and expiration.
- Validate public upload metadata and ensure returned objects cannot expose private data.
- Verify Razorpay signature/order validation and replay handling.
- Verify webhook authenticity using the provider’s signature mechanism, not only payload parsing.
- Verify WhatsApp webhook POST requests are authenticated beyond the GET verification challenge.
- Decide whether database health status should be public in production.

## 4.5 Webhooks and external side effects

External side effects include email, SMS, WhatsApp messages, payment calls, R2 uploads, and AI analysis. These operations can fail after a booking or clinical mutation succeeds.

### TODO

- Add idempotency keys for payment/webhook/notification flows.
- Persist delivery attempts and provider response IDs where business-critical.
- Separate “domain mutation succeeded” from “notification delivery succeeded” in user-visible status.
- Add retry/backoff policy with dead-letter or operator visibility.
- Avoid duplicate notifications when a mutation is retried.

## 4.6 Dependency scan result

`npm run scan` on the audit baseline reported:

- 15 high npm audit findings
- 8 medium npm audit findings
- 2 low npm audit findings
- ESLint security scan unavailable because ESLint was not installed
- Semgrep output could not be parsed
- NodeJsScan unavailable because it was not installed

Notable direct or transitive packages reported include Drizzle ORM, Express/body-parser/path-to-regexp, Vite/Rollup, `ws`, PostCSS, `nanoid`, Axios, brace-expansion, minimatch, picomatch, and others.

This result is a triage signal, not proof that every advisory is exploitable in this application. Each advisory should be mapped to:

- direct versus transitive dependency
- reachable code path
- production versus development exposure
- safe upgrade range
- regression risk

Do not blindly run a bulk major upgrade on this application because build chunking, CJS compatibility, and deployment constraints are documented in `replit.md`.

## 4.7 Configuration and deployment

The repository documents Replit preview and Render production environments. Environment templates are present for backend, frontend, and local use.

Operational risks:

- The application has multiple deployment assumptions: Replit same-origin preview, local split-origin development, and Render split services.
- CORS allowlists include explicit domains plus a permissive Replit origin regex.
- `VITE_API_URL` is required for production frontend builds by `queryClient.ts`.
- Startup schema synchronization can add latency and can fail application startup if the database is unavailable.
- `.replit` contains workspace user-environment metadata; secret values must remain managed through environment secrets and must not be copied into documentation.

## 4.8 Logging and observability

Positive controls:

- API request logs include method, path, status, duration, and redacted JSON response bodies.
- Token-like response fields are redacted recursively.
- Services use labeled logs in most places.
- Health endpoints exist for backend and database.

Risks:

- Some application paths log error objects or identifiers that should be reviewed for PII.
- Request/response logging can still expose non-token patient data if sensitive response fields are returned.
- Health indicator polling is client-visible and may create noise.
- Audit log failure is logged but not surfaced to operations.

### TODO

- Define a structured log schema with correlation/request ID.
- Add explicit PII redaction for names, phone, email, diagnosis, and document URLs.
- Add monitoring for audit-log write failures, webhook failures, email failures, and queue/retry exhaustion.
- Define production alert thresholds and ownership.