# Environment categorisation and compatibility plan

**Status:** Planning only — implementation not started  
**Plan date:** 2026-08-27  
**Scope:** Add an explicit `APP_ENV` classification without breaking the
existing `NODE_ENV`, Vite, session, database, email, build, or deployment
behavior.

## 1. Executive decision

The application should use two environment concepts with separate
responsibilities:

| Variable | Responsibility |
|---|---|
| `NODE_ENV` | Technical Node/Vite runtime and build mode |
| `APP_ENV` | Application/deployment identity and local-versus-strict policy |

`NODE_ENV` must not be removed or blindly replaced. The current application
already uses it for production static serving, Vite middleware, session
security, error detail visibility, database SSL behavior, reminder dry-run
behavior, and build-time replacement.

The target mapping is:

| Environment | `APP_ENV` | `NODE_ENV` | Functional policy |
|---|---|---|---|
| Production deployment | `production` | `production` | Strict |
| Development deployment | `development` | `production` | Strict, functionally equivalent to production |
| Local developer workflow | `local` | `development` | Relaxed and debug-friendly |

The central rule is:

```text
APP_ENV=production  -> strict
APP_ENV=development -> strict
APP_ENV=local       -> relaxed
```

Production and Development are intentionally not separate runtime modes. They
are two labels for the same strict runtime policy. Local is the only
environment with intentional functional differences.

## 2. Why both variables are retained

The application has two independent dimensions:

1. Whether it is running as a local development server or a compiled deployed
   server.
2. Which deployment the running application represents.

Those dimensions cannot be represented safely by one overloaded value:

| Scenario | Technical runtime | Deployment identity |
|---|---|---|
| Production | Compiled production runtime | Production |
| Development deployment | Compiled production runtime | Development |
| Local development | Development runtime | Local |

If only `NODE_ENV` is used, Production and Development deployment both become
`NODE_ENV=production` and the application cannot distinguish them in logs or
monitoring.

If only `APP_ENV` is used, every current `NODE_ENV` conditional, package script,
build definition, Vite behavior, and potentially indirect Node-library
behavior must be redesigned. That is possible, but it is not the
compatibility-first approach.

## 3. Current environment controls

`APP_ENV` does not currently exist in the application source or environment
templates. The current behavior is distributed across the following controls.

### 3.1 Direct `NODE_ENV` behavior

| File | Current behavior | Current value used |
|---|---|---|
| `server/index.ts` | Selects production `FRONTEND_URL` versus local Vite URL | `production` |
| `server/index.ts` | Requires `SESSION_SECRET` in production; otherwise permits a fallback | `production` |
| `server/index.ts` | Sets session `secure` cookie flag | `production` |
| `server/index.ts` | Uses `sameSite: "none"` for cross-origin deployment cookies | `production` |
| `server/index.ts` | Serves compiled frontend files or starts Vite middleware | `production` versus non-production |
| `server/index.ts` | Returns error stack details only during development | `development` |
| `server/standalone.ts` | Has its own production session-secret and cookie policy | `production` |
| `server/db.ts` | Disables SSL during development, also honoring `PGSSLMODE=disable` | `development` |
| `server/reminder-digest.ts` | Allows real digest sending only in production with `RESEND_API_KEY` | not `production` |
| `vite.config.ts` | Loads Replit development plugins outside production | not `production` |
| `script/build.ts` | Replaces `process.env.NODE_ENV` with `"production"` in the server bundle | build-time |
| `script/build-standalone.ts` | Replaces `process.env.NODE_ENV` with `"production"` in the standalone bundle | build-time |

### 3.2 Equivalent frontend checks

| File | Check | Current behavior |
|---|---|---|
| `client/src/lib/queryClient.ts` | `import.meta.env.PROD` | Requires `VITE_API_URL` for a production frontend build |
| `client/src/components/ErrorBoundary.tsx` | `import.meta.env.DEV` | Shows detailed error information in development builds |

These are Vite build-mode flags. They should remain tied to the technical
frontend build mode rather than being replaced with a server-only `APP_ENV`.

### 3.3 Other environment-like controls

These controls are not aliases for `APP_ENV` and should remain independent:

| Variable | Purpose | Compatibility requirement |
|---|---|---|
| `RESEND` | Selects real email recipients versus the configured test recipient | Do not silently merge into `APP_ENV` |
| `RESEND_API_KEY` | Enables Resend-backed reminder digest delivery | Continue to require it before sending |
| `PGSSLMODE` | Explicit PostgreSQL SSL override | Continue honoring `PGSSLMODE=disable` |
| `VITE_API_URL` | Frontend/backend origin configuration | Continue requiring it for split production builds |
| `REPL_ID` | Identifies Replit for development plugins | Continue using it only for platform behavior |
| `REPLIT_DEV_DOMAIN` | Configures Replit Vite HMR | Continue using it only for local/Replit development |

The separate `RESEND` switch is especially important. A strict Development
deployment should not automatically send real customer email merely because
it has production-like runtime security. Email side effects require a
separate deployment/provider policy.

## 4. Target behavior by environment

### 4.1 Production

Configuration:

```text
APP_ENV=production
NODE_ENV=production
```

Expected behavior:

- Compiled frontend is served.
- Vite development middleware is not started.
- `SESSION_SECRET` is required.
- Session cookies are secure and use `sameSite: "none"`.
- Database SSL is enabled unless an explicit database configuration overrides
  it.
- Detailed server and browser error information is hidden.
- Production integrations may be enabled according to their own credentials
  and flags.
- Production monitoring and alerting use the `production` label.

### 4.2 Development deployment

Configuration:

```text
APP_ENV=development
NODE_ENV=production
```

Expected behavior:

- Uses the same build command and start command as Production.
- Serves the compiled frontend.
- Uses the same strict session and cookie policy.
- Requires `SESSION_SECRET`.
- Uses strict database and error-disclosure behavior.
- Uses the `development` label in startup logs and monitoring metadata.
- Uses separate development infrastructure and credentials where possible.
- Does not automatically receive real-email side effects without an explicit
  email policy.

This environment is intentionally not `NODE_ENV=development`, because that
would activate the local Vite/development-server path and would no longer be
functionally equivalent to Production.

### 4.3 Local

Configuration for the normal local/Replit development workflow:

```text
APP_ENV=local
NODE_ENV=development
```

Expected behavior:

- Vite development middleware and local HMR remain available.
- Replit development plugins remain available when running on Replit.
- Local frontend origins continue to work.
- Detailed errors remain available for debugging.
- Local database SSL behavior remains compatible with the current setup.
- Local reminder/email behavior remains dry-run or test-recipient oriented.
- A fallback session secret may remain available for local development, with a
  clear warning if it is used.

## 5. File-by-file implementation impact

The following is the anticipated implementation scope. These are planned
changes only; this document does not apply them.

### 5.1 New shared environment helper

**Planned location:** `server/environment.ts` or another single canonical
server configuration module.

Planned responsibilities:

- Read `process.env.APP_ENV`.
- Accept only `production`, `development`, and `local`.
- Provide a typed environment union.
- Expose named predicates such as strict versus local rather than repeating
  string comparisons throughout the application.
- Log the resolved `APP_ENV` and `NODE_ENV` without printing secrets.

Backward-compatible resolution should be used during migration:

| `APP_ENV` state | Fallback |
|---|---|
| Valid value supplied | Use the supplied value |
| Missing and `NODE_ENV=development` | Resolve as `local` |
| Missing and `NODE_ENV=production` | Resolve as `production` |
| Unknown value | Fail clearly or reject startup; do not silently treat it as local |

The missing-value fallback prevents existing deployments from breaking before
their environment settings are updated.

### 5.2 `server/index.ts`

Planned changes:

- Import the canonical resolved environment.
- Keep the production-versus-development-server decision based on technical
  `NODE_ENV` or an explicitly named technical-runtime predicate.
- Move strict security decisions to the strict/local policy:
  - session-secret requirement
  - cookie `secure`
  - cookie `sameSite`
  - detailed error response policy
- Review frontend URL selection so Local continues to use local origins while
  both deployed strict environments use deployment configuration.
- Change startup logs from only `NODE_ENV` to a safe pair such as:

  ```text
  NODE_ENV=production APP_ENV=development
  ```

- Do not print `SESSION_SECRET`, API keys, database URLs, or other secret
  values.

### 5.3 `server/standalone.ts`

Planned changes:

- Use the same canonical environment policy as `server/index.ts`.
- Keep its current session-secret validation and cookie behavior.
- Avoid creating a second independent interpretation of `APP_ENV`.
- Confirm whether this legacy/standalone entry point is still supported before
  changing it; if it remains buildable, it must follow the same policy.

### 5.4 `server/db.ts`

Planned changes:

- Treat `APP_ENV=local` as the relaxed local database policy.
- Keep `PGSSLMODE=disable` as an explicit override.
- Ensure `APP_ENV=development` uses strict deployed database behavior even
  though the deployment is called Development.
- Confirm that local socket/internal database detection still takes precedence
  where currently intended.

### 5.5 `server/reminder-digest.ts`

Planned changes:

- Decide whether dry-run is a Local-only policy or remains controlled by
  `NODE_ENV` plus `RESEND_API_KEY`.
- Preserve the existing safety condition that missing `RESEND_API_KEY` cannot
  create a real sender.
- Add tests for all three `APP_ENV` values.
- Explicitly document whether Development deployment may deliver real email.

Recommended policy:

| Environment | Digest default |
|---|---|
| Production | Real delivery only with production email configuration |
| Development deployment | Separate development provider/account or explicit test-recipient configuration |
| Local | Dry-run or test recipient |

### 5.6 `server/routes.ts`

Planned changes:

- No broad replacement of `RESEND_MODE` with `APP_ENV`.
- Keep `RESEND=PRODUCTION` as an explicit email recipient/delivery control.
- Review any future environment logging to ensure no recipient addresses or
  secrets are exposed unnecessarily.

### 5.7 `vite.config.ts` and `server/vite.ts`

Planned changes:

- Keep Vite development-plugin and HMR behavior based on technical development
  mode and Replit variables.
- `APP_ENV=development` on a deployed Development service must not activate
  Vite development middleware or Replit-only plugins.
- `server/vite.ts` should continue to use `REPLIT_DEV_DOMAIN` only when the
  development server path is active.

### 5.8 Frontend files

Planned changes:

- Keep `import.meta.env.DEV` and `import.meta.env.PROD` for build-mode behavior.
- Do not expose server-side `APP_ENV` automatically.
- If the UI needs to display an environment label, introduce an explicit
  non-secret build variable:

  ```text
  VITE_APP_ENV=production
  VITE_APP_ENV=development
  VITE_APP_ENV=local
  ```

- Only add `VITE_APP_ENV` if there is a product or operations requirement for
  the browser to display the label. It is not needed for backend logs.

### 5.9 Build scripts

**Files:**

- `script/build.ts`
- `script/build-standalone.ts`

Planned changes:

- Keep production replacement of technical `NODE_ENV` in deployed bundles.
- Do not replace it with a literal `APP_ENV=production`, because a strict
  Development deployment must still be labelled `APP_ENV=development`.
- If client-side `VITE_APP_ENV` is introduced, ensure the value comes from the
  deployment build environment and does not get confused with Vite's
  `DEV`/`PROD` flags.

### 5.10 `package.json` and `run-local.sh`

Planned changes:

- Keep `npm run dev` setting `NODE_ENV=development`.
- Keep `npm start` setting `NODE_ENV=production`.
- Add `APP_ENV=local` to the normal local workflow without changing the
  current technical runtime.
- Review `run-local.sh` separately. It currently builds and starts the
  compiled server with `NODE_ENV=production`; it may be intentionally serving
  as a local production-style smoke test.
- Do not silently change `run-local.sh` to Vite development behavior.

Recommended compatibility approach:

- Preserve `run-local.sh`'s current compiled-server purpose.
- Use `npm run dev` for relaxed local iteration.
- If a relaxed compiled local run is needed, add a clearly named separate
  command rather than changing the existing script's meaning.

### 5.11 Environment templates and Replit configuration

Planned files:

- `.replit`
- `.env.example`
- `.env.render.backend.example`
- `.env.render.frontend.example`, only if a frontend label is required
- `client/.env.local`

Planned configuration:

| File/service | Planned value |
|---|---|
| Replit development environment | `APP_ENV=local`, `NODE_ENV=development` |
| Render production backend | `APP_ENV=production`, `NODE_ENV=production` |
| Render Development backend | `APP_ENV=development`, `NODE_ENV=production` |
| Local frontend, if used | `VITE_APP_ENV=local`, only if browser labelling is required |
| Render frontend, if used | Matching `VITE_APP_ENV`, only if browser labelling is required |

Existing secret handling must remain unchanged. `APP_ENV` is not a secret and
must not be used to store, derive, or print credentials.

### 5.12 Documentation

The following documentation will need a follow-up consistency review:

- `replit.md`
- `replit-specific-setup.md`
- `docs/deployment configuration/environment-variables-inventory.md`
- `docs/development/local-development-setup.md`
- `docs/development/render-environment-setup.md`
- `docs/deployment configuration/reminder-deployment-configuration.md`
- `docs/features/booking/12-reminder-module.md`
- `docs/migration/migration-check-list.md`
- Any operational or domain deployment checklist that currently describes
  `NODE_ENV` as the complete environment identity

Documentation should describe `NODE_ENV` as the technical runtime mode and
`APP_ENV` as the application environment label. Existing `NODE_ENV` references
must not be removed until the corresponding code and deployment migration is
complete.

## 6. Deployment and CI/CD impact

The repository contains Replit workflow configuration and Render deployment
documentation, but no committed CI/CD workflow that currently consumes
`APP_ENV`.

Adding the variable to application code will not automatically make Render or
an external CI/CD system use it. The deployment environments must be updated
explicitly:

| Consumer | Required change |
|---|---|
| Replit | Add `APP_ENV=local` to the development environment |
| Render Production backend | Add `APP_ENV=production` |
| Render Development backend | Add `APP_ENV=development` |
| CI/CD | Add the appropriate value if jobs use environment labels |
| Monitoring | Include the resolved `APP_ENV` as a non-secret service/resource label |
| Frontend static build | Add `VITE_APP_ENV` only if the browser needs the label |

Both Render backend environments should continue to use the existing build and
start flow:

```text
npm install --include=dev && npm run db:push && npm run build
npm start
```

The Development deployment must not use `npm run dev` if functional parity with
Production is required.

## 7. Migration sequence

Implementation should be staged so each step can be verified independently.

### Phase 1 — Add the classifier without changing behavior

- Add the typed environment resolver.
- Add backward-compatible fallback behavior.
- Log `APP_ENV` and `NODE_ENV` safely.
- Add unit tests for valid, missing, and invalid values.
- Do not change existing runtime conditionals yet.

### Phase 2 — Add environment configuration

- Add `APP_ENV=local` to Replit/local development configuration.
- Add `APP_ENV=production` to the production deployment.
- Add `APP_ENV=development` to the Development deployment.
- Leave `NODE_ENV` values unchanged.
- Verify startup and authentication before policy changes.

### Phase 3 — Move strict/local policy decisions

- Move security and debug decisions from raw `NODE_ENV` checks to named
  strict/local predicates.
- Preserve technical `NODE_ENV` for Vite middleware, static serving, and
  build-mode decisions.
- Update both `server/index.ts` and `server/standalone.ts`.
- Update database SSL and error-detail behavior.

### Phase 4 — Resolve email policy

- Decide how Development email delivery is isolated.
- Add tests for reminder digest behavior under all environment labels.
- Keep `RESEND` and `RESEND_API_KEY` as independent safeguards.

### Phase 5 — Update build, deployment, and documentation

- Update environment examples and deployment instructions.
- Update monitoring/logging instructions.
- Add `VITE_APP_ENV` only if a frontend label is required.
- Confirm `run-local.sh` behavior has not changed unintentionally.

### Phase 6 — Verify compatibility

- Run the full build and type checks.
- Start the Replit workflow.
- Test local authentication, cookies, API calls, Vite HMR, and database
  connectivity.
- Test a compiled strict runtime.
- Test the Development deployment configuration in an isolated service or
  equivalent environment before production rollout.

## 8. Main risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Replacing every `NODE_ENV` check with `APP_ENV` | Vite, static serving, builds, or cookies may change unexpectedly | Keep `NODE_ENV` for technical mode; migrate policy checks selectively |
| Missing `APP_ENV` in an existing deployment | Startup or behavior regression | Use a documented backward-compatible fallback |
| Unknown `APP_ENV` value treated as local | Security regression | Validate and reject unknown values |
| Development deployment sends real email | Customer/provider side effects | Keep email controls independent and use isolated credentials/recipients |
| `run-local.sh` changes from compiled to Vite behavior | Local verification workflow changes | Preserve the existing script and add a separate command if needed |
| Server-side `APP_ENV` expected in browser | Frontend label is missing or undefined | Use `VITE_APP_ENV` explicitly when required |
| `APP_ENV` is logged with sensitive environment data | Secret disclosure | Log only the two mode labels; never dump environment objects |
| Standalone server diverges from main server | Different security policy depending on entry point | Share the resolver and test both entry points |

## 9. Validation checklist

### Configuration

- [ ] Only `production`, `development`, and `local` are accepted.
- [ ] Existing deployments without `APP_ENV` continue to start during migration.
- [ ] Unknown values fail clearly and do not activate relaxed behavior.
- [ ] No secret values are included in logs or documentation.

### Production

- [ ] `APP_ENV=production`, `NODE_ENV=production`.
- [ ] Missing `SESSION_SECRET` prevents startup.
- [ ] Secure cross-origin cookies work.
- [ ] Compiled frontend is served.
- [ ] Detailed error stacks are hidden.
- [ ] Database SSL behavior is unchanged.

### Development deployment

- [ ] `APP_ENV=development`, `NODE_ENV=production`.
- [ ] Same build and start commands as Production.
- [ ] Same strict cookie, secret, database, and error behavior.
- [ ] Logs and monitoring identify the service as Development.
- [ ] Email side effects follow the explicit Development email policy.

### Local

- [ ] `APP_ENV=local`, `NODE_ENV=development`.
- [ ] Vite middleware and HMR still work.
- [ ] Replit development plugins still work where applicable.
- [ ] Detailed errors remain available locally.
- [ ] Local database connections still work.
- [ ] Reminder/email behavior remains safe for local use.

### Quality gates

- [ ] `npm run build` succeeds.
- [ ] `npm run check` is run and any pre-existing failures are distinguished
  from new failures.
- [ ] Existing reminder digest tests pass.
- [ ] New environment resolver tests pass.
- [ ] Main and standalone server startup paths are checked.
- [ ] Browser checks cover Replit/local and compiled strict behavior.
- [ ] Documentation and deployment templates agree with the final mapping.

## 10. Acceptance criteria

The categorisation is ready for implementation completion when:

1. Production and Development deployments have different `APP_ENV` labels but
   identical strict application behavior.
2. Local remains the only intentionally relaxed environment.
3. Existing `NODE_ENV`-dependent technical behavior is preserved where it is
   about Vite, builds, or serving mode.
4. No existing deployment fails because `APP_ENV` is initially absent during
   migration.
5. Session security, database connectivity, API behavior, frontend serving,
   reminder safety, and email policy are verified in each applicable mode.
6. Startup logs can distinguish:

   ```text
   NODE_ENV=production APP_ENV=production
   NODE_ENV=production APP_ENV=development
   NODE_ENV=development APP_ENV=local
   ```

7. The final environment contract is documented for developers, Render
   operators, monitoring, and CI/CD.

## 11. Open decision before implementation

The architecture is ready, but one operational policy must be confirmed before
the email-related changes are made:

> Should the Development deployment be allowed to send real emails, or should
> it always use a development provider/test recipients even though the rest of
> its runtime behavior is identical to Production?

Until that decision is made, the implementation should preserve the current
`RESEND` and `RESEND_API_KEY` controls rather than infer email behavior from
`APP_ENV`.
