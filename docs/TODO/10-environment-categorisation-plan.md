# Environment categorisation and compatibility plan

**Status:** Implementation complete in code and repository documentation; Render
environment values still require dashboard verification.  
**Plan date:** 2026-08-27  
**Last implementation update:** 2026-08-29  
**Scope:** Add an explicit `APP_ENV` classification without breaking the
existing `NODE_ENV`, Vite, session, database, email, build, or deployment
behavior.

## Implementation progress

This plan has now been implemented with the decisions confirmed during review.
The application uses only two `APP_ENV` values:

- `production` — the live deployed service.
- `development` — local development and the separately deployed Development
  service; `NODE_ENV` distinguishes their technical runtime.

Completed in the repository:

- Added a typed resolver and pure tests for the two-label model.
- Added a pure email-delivery policy and tests for deployed, local, and test
  runtimes.
- Added safe `APP_ENV`/`NODE_ENV` startup identity logging to the active server.
- Configured Replit and the local command contract with
  `APP_ENV=development`.
- Updated the local and Render environment templates.
- Migrated the active server's session, cookie, frontend-origin, and
  error-detail decisions to the resolved runtime policy.
- Made remote database SSL behavior identical for Production and deployed
  Development, while preserving local/internal database exceptions and
  `PGSSLMODE=disable`.
- Made reminder digest delivery require compiled runtime, `RESEND=PRODUCTION`,
  and `RESEND_API_KEY`; deployed Production and Development can therefore send
  to real configured recipients, while Local and tests remain dry-run.
- Preserved `run-local.sh` as a compiled Render-style smoke-test path.
- Audited `server/standalone.ts`; it is not used by the normal project scripts,
  so it was not changed pending confirmation of an external consumer.
- Updated the supporting environment and reminder documentation.

Validation completed:

- Baseline `npm run check`: passed.
- Baseline `npm run build`: passed.
- `npx tsx --test server/environment.test.ts`: 9 tests passed.
- `npx tsx --test server/reminder-digest.test.ts`: 8 tests passed.
- Post-change `npm run check`: passed.
- Post-change `npm run build`: passed.

Remaining operational work:

- Set and verify `APP_ENV=production` on the Render Production backend.
- Set and verify `APP_ENV=development` on the Render Development backend.
- Set `NODE_ENV=production` and `RESEND=PRODUCTION` on both deployed services,
  with the intended Resend credentials.
- Verify the deployed services and run the final compatibility matrix.

## 0. Independent executable implementation steps

The implementation should be delivered as a sequence of small, independently
verifiable checkpoints. Each row below is intended to be one executable step:
it has a bounded change set, a specific verification gate, and a safe rollback
boundary. A later step must not be started until the previous step's check
passes. The application should remain runnable after every step.

| Step | Independent change | Files or systems in scope | Environment impact | Verification before proceeding | Rollback boundary | Depends on |
|---|---|---|---|---|---|---|
| 0 | Capture the current behavior as a baseline | Existing build/check commands, startup logs, local workflow, deployment templates; no source change | None | `npm run check` and `npm run build` passed before changes; deployment and browser checks remain operational follow-up | Discard only the baseline notes; no application rollback required | None |
| 1 | Add a typed `APP_ENV` resolver without changing any existing behavior | `server/environment.ts`, `server/environment.test.ts` | Only `production` and `development` are accepted; `NODE_ENV=test` is test-only and maps to the Development label when needed | 7 pure resolver tests passed | Remove the new module and tests; existing runtime behavior is unchanged | Step 0 |
| 2 | Add safe environment identity logging | Active `server/index.ts` and shared resolver | Active startup logs show both labels without secrets; standalone remains unchanged because support is unconfirmed | Main server logging is implemented; standalone support audit is recorded as pending | Revert only the active-server logging changes | Step 1 |
| 3 | Add explicit environment values to configuration | `.replit`, `.env.example`, `.env.render.backend.example`, local scripts; Render dashboard values remain pending | Local uses `APP_ENV=development`; Render Production/Development use `production`/`development` respectively | Repository configuration updated; Render verification remains pending | Remove the new assignments; fallback behavior keeps existing services startable | Step 2 |
| 4 | Move the main server's strict-versus-local policy to the active runtime pair | `server/index.ts` and shared environment predicates | Deployed Production and Development are strict because both use `NODE_ENV=production`; local development remains relaxed | Type check, build, and resolver tests passed; startup/auth/browser matrix remains follow-up | Revert the policy call-site changes while retaining the resolver and labels | Step 3 |
| 5 | Confirm standalone support before changing it | `server/standalone.ts`, `script/build-standalone.ts`, scripts and documentation audit | No active project script uses standalone; no code change made | Audit completed; external deployment confirmation remains pending | No rollback required because the file was not changed | Step 4 |
| 6 | Align database SSL policy for deployed environments | `server/db.ts` and environment policy | Production and deployed Development have identical SSL preference; local/internal topology and `PGSSLMODE=disable` remain supported | Type check and build passed; live database matrix remains follow-up | Revert only database policy migration | Step 4 |
| 7 | Apply the approved reminder/email policy | `server/reminder-digest.ts`, email documentation, reminder tests | Production and deployed Development can send to real recipients with explicit `RESEND=PRODUCTION` and a key; local/tests remain dry-run | Existing reminder tests passed; deployed delivery verification remains pending | Revert email-policy changes without affecting authentication, serving, or database behavior | Step 4 |
| 8 | Preserve the build and script contracts while assigning labels | `package.json`, `run-local.sh`, `.replit` | `npm run dev` uses Development + technical development; `npm start` remains technical production; compiled local smoke test remains production-shaped | Build passed; workflow and compiled smoke-test runtime remain follow-up | Revert script/config changes independently of server policy code | Steps 3–7 |
| 9 | Keep frontend build labels separate | Frontend build configuration | No `VITE_APP_ENV` was added because the browser does not need an environment label; Vite `DEV`/`PROD` behavior is unchanged | Production build passed | No frontend rollback required | Step 8 |
| 10 | Complete the documentation and operational contract | `replit.md`, environment/deployment docs, reminder docs, migration checklist, and this plan | Repository documentation now describes the two-label contract; external Render settings remain operational work | Documentation updated; stale-reference audit and deployment verification remain follow-up | Revert documentation independently | Steps 3–9 |
| 11 | Run the full compatibility matrix and release review | Build Check, type checks, server startup paths, browser checks, deployment smoke test, monitoring/log review | Final confirmation that Production and deployed Development are strict and equivalent while local remains relaxed | In progress: automated checks passed; workflow and deployed checks remain | Stop rollout or restore the last checkpoint; do not make unrelated fixes inside this verification step | Steps 0–10 |

### 0.1 Required environment matrix for every applicable step

The following matrix is the contract used throughout the table. “Development”
in the second row means a deployed Development service, not a local Vite
session:

| Target | `APP_ENV` | `NODE_ENV` | Command contract | Frontend/server mode | Policy |
|---|---|---|---|---|---|
| Production deployment | `production` | `production` | Build, then `npm start` | Compiled frontend and compiled server | Strict |
| Development deployment | `development` | `production` | Same build and start commands as Production | Compiled frontend and compiled server | Strict, with a different deployment label |
| Local developer workflow on Replit, Codespaces, a local machine, or another supported host | `development` | `development` | `npm run dev` | Vite middleware, HMR, and development tooling | Relaxed and debug-friendly |
| Local compiled smoke test | `development` | `production` | `run-local.sh` | Compiled frontend and compiled server | Production-shaped Development runtime |

The table deliberately separates **deployment parity** from **local
development tooling**. Production and deployed Development must share the
compiled build/start contract on Render. Local `npm run dev` must remain
different because it is the interactive Vite/HMR workflow, regardless of
whether the developer uses Replit, Codespaces, a local machine, or another
supported host. `APP_ENV=development` must never be interpreted as permission
to activate `NODE_ENV=development`.

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
| Local developer workflow | `development` | `development` | Relaxed and debug-friendly |

The central rule is:

`APP_ENV` identifies the application as Production or Development. The
technical `NODE_ENV` then distinguishes the deployed Development service from
local Development:

```text
APP_ENV=production,  NODE_ENV=production  -> strict Production
APP_ENV=development, NODE_ENV=production  -> strict Development deployment
APP_ENV=development, NODE_ENV=development -> relaxed local development
APP_ENV=development, NODE_ENV=test        -> test execution; no real email
```

Production and deployed Development are intentionally functionally equivalent.
Local Development is the only normal workflow with relaxed, debug-friendly
behavior.

### 1.1 Deployment parity versus local development tooling

The word **Development** is used here for a deployed Development service. It
does not mean that the service should run the local Vite development server.
This distinction is essential:

| Context | Meaning | Build and run path | Technical runtime |
|---|---|---|---|
| Production deployment | The live production service | Build the application, then run the compiled server | `NODE_ENV=production` |
| Development deployment | A separately deployed, production-shaped service used for development or acceptance testing | The same build and start commands as Production | `NODE_ENV=production` |
| Local development | A developer's interactive workflow on Replit, Codespaces, a local machine, or another supported host | Run the Vite development server directly | `NODE_ENV=development` |

Therefore, “Production and Development have the same build and deployment”
means:

```text
Production deployment:  npm run build -> npm start
Development deployment: npm run build -> npm start
```

The two deployed services have different `APP_ENV` labels so that logs,
monitoring, URLs, credentials, and operational ownership can distinguish them.
They still use `NODE_ENV=production` because both are compiled deployments and
must use the same strict serving, cookie, security, and error-disclosure path.

`npm run dev` is intentionally retained as a different path:

```text
Local development: npm run dev
```

It starts Vite middleware and HMR, supports rapid source-code iteration, and
keeps local debugging behavior. Changing this script to
`NODE_ENV=production` would make local work behave like a compiled deployment;
changing a deployed Development service to `NODE_ENV=development` would make
that service use Vite development middleware instead of the compiled frontend.
Neither change is compatible with the required deployment parity.

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

The first dimension is represented primarily by `NODE_ENV` and the command
being run. The second dimension is represented by `APP_ENV`. In particular,
`APP_ENV=development` identifies the deployed Development service but does
**not** imply `NODE_ENV=development`.

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
- Sends to configured real recipients when `RESEND=PRODUCTION` and
  `RESEND_API_KEY` are present, just like Production.

This environment is intentionally not `NODE_ENV=development`, because that
would activate the local Vite/development-server path and would no longer be
functionally equivalent to Production.

### 4.3 Local development on any supported host

Configuration for the normal interactive development workflow. The host may be
Replit, Codespaces, a local machine, or another supported third-party
environment:

```text
APP_ENV=development
NODE_ENV=development
```

Expected behavior:

- Vite development middleware and local HMR remain available.
- Replit development plugins remain available only when running on Replit;
  Codespaces, local machines, and other hosts use their own platform tooling.
- Local frontend origins continue to work.
- Detailed errors remain available for debugging.
- Local database SSL behavior remains compatible with the current setup.
- Local reminder/email behavior remains dry-run or test-recipient oriented.
- A fallback session secret may remain available for local development, with a
  clear warning if it is used.

## 5. File-by-file implementation impact

The following records the implementation scope and the resulting behavior.
Repository changes are complete unless marked as operational follow-up.

### 5.1 New shared environment helper

**Planned location:** `server/environment.ts` or another single canonical
server configuration module.

Planned responsibilities:

- Read `process.env.APP_ENV`.
- Accept only `production` and `development`.
- Provide a typed environment union.
- Expose named predicates such as strict versus local rather than repeating
  string comparisons throughout the application.
- Log the resolved `APP_ENV` and `NODE_ENV` without printing secrets.

Backward-compatible resolution should be used during migration:

| `APP_ENV` state | Fallback |
|---|---|
| Valid value supplied | Use the supplied value |
| Missing and `NODE_ENV=development` | Resolve as `development` |
| Missing and `NODE_ENV=test` | Resolve as `development` for test execution |
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

- Treat `NODE_ENV=development` as the relaxed local database policy.
- Keep `PGSSLMODE=disable` as an explicit override.
- Ensure deployed Production and deployed Development both use the same strict
  database behavior because both run with `NODE_ENV=production`.
- Confirm that local socket/internal database detection still takes precedence
  where currently intended.

### 5.5 `server/reminder-digest.ts`

Planned changes:

- Require compiled runtime, `RESEND=PRODUCTION`, and `RESEND_API_KEY` for real
  digest delivery.
- Preserve the existing safety condition that missing `RESEND_API_KEY` cannot
  create a real sender.
- Keep local development and tests dry-run.
- Allow deployed Development to deliver to configured real recipients, matching
  Production.

Recommended policy:

| Environment | Digest default |
|---|---|
| Production | Real delivery only with production email configuration |
| Development deployment | Real delivery to configured recipients, matching Production |
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

The scripts represent different execution contracts and must not be conflated:

| Command | Intended context | `APP_ENV` | `NODE_ENV` | Expected server behavior |
|---|---|---|---|---|
| `npm run dev` | Normal local iteration | `development` | `development` | Vite middleware, HMR, local debugging |
| `npm start` after `npm run build` | Production or Development deployment | Set by deployment | `production` | Compiled frontend, strict deployed runtime |
| `run-local.sh` | Local compiled-server smoke test | `development` | `production` | Compiled frontend with strict deployed-style policy |

Specifically:

- Keep `npm run dev` setting `NODE_ENV=development`. This is the local
  development-server contract and is required for Vite middleware, HMR,
  development plugins, and detailed local errors.
- Keep `npm start` setting `NODE_ENV=production`. This is the compiled-server
  contract used by both deployed environments after the same build step.
- Add `APP_ENV=development` to the normal local workflow without changing the
  technical runtime selected by `npm run dev`.
- Ensure the Production deployment runs `npm run build` followed by `npm
  start` with `APP_ENV=production` and `NODE_ENV=production`.
- Ensure the Development deployment runs the same build and start sequence with
  `APP_ENV=development` and `NODE_ENV=production`.
- `run-local.sh` remains a compiled Render-style smoke test and explicitly uses
  `APP_ENV=development` with `NODE_ENV=production`, matching the deployed
  Development runtime.
- Do not silently change `run-local.sh` to Vite development behavior. If a
  relaxed compiled local run is not desired, keep it as a clearly documented
  smoke-test command or introduce a separately named command.

Recommended compatibility approach:

- Preserve `run-local.sh`'s current compiled-server purpose unless the project
  explicitly decides to remove that smoke-test workflow.
- Use `npm run dev` for relaxed local iteration.
- Treat `npm start` as the shared deployed start command, not as the local
  development command.
- If a relaxed compiled local run is ever needed, it requires a separately
  named technical mode; do not change the meaning of `npm run dev`,
  `npm start`, or the two-value `APP_ENV` contract.

### 5.11 Environment templates and platform configuration

Planned files:

- `.replit`
- `.env.example`
- `.env.render.backend.example`
- `.env.render.frontend.example`, only if a frontend label is required
- `client/.env.local`
- Codespaces, local-machine, or third-party host environment configuration,
  where those platforms manage variables outside repository files

Planned configuration:

| File/service | Planned value |
|---|---|
| Replit local development | `APP_ENV=development`, `NODE_ENV=development` |
| Codespaces/local machine/other local host | `APP_ENV=development`, `NODE_ENV=development` |
| Render Production backend | `APP_ENV=production`, `NODE_ENV=production` |
| Render Development backend | `APP_ENV=development`, `NODE_ENV=production` |
| Render Production frontend, if labelled | `VITE_APP_ENV=production`, with a production Vite build |
| Render Development frontend, if labelled | `VITE_APP_ENV=development`, with a production Vite build |
| Local frontend, if labelled | `VITE_APP_ENV=development`, only if browser labelling is required |

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
| Replit | Add `APP_ENV=development` to the local development environment |
| Codespaces/local machine/other local host | Document the platform-appropriate way to provide `APP_ENV=development` |
| Render Production backend | Add `APP_ENV=production` |
| Render Development backend | Add `APP_ENV=development` |
| Render Production frontend, if labelled | Add `VITE_APP_ENV=production` during the frontend build |
| Render Development frontend, if labelled | Add `VITE_APP_ENV=development` during the frontend build |
| CI/CD | Add the appropriate value if jobs use environment labels |
| Monitoring | Include the resolved `APP_ENV` as a non-secret service/resource label |
| Frontend static build | Add `VITE_APP_ENV` only if the browser needs the label |

Both Render backend environments should continue to use the existing build and
start flow:

```text
npm install --include=dev && npm run db:push && npm run build
npm start
```

The Production and Development deployments must both use this compiled build
and start flow. Their only environment-label difference in this plan is:

```text
Production deployment:  APP_ENV=production  NODE_ENV=production
Development deployment: APP_ENV=development NODE_ENV=production
```

The Development deployment must not use `npm run dev`. That command is reserved
for local iteration because it selects `NODE_ENV=development`, activates the
Vite development-server path, and would break the required compiled-runtime
parity with Production.

## 7. Migration sequence

Implementation should be staged so each step can be verified independently.

### Phase 1 — Add the classifier without changing behavior

- Add the typed environment resolver.
- Add backward-compatible fallback behavior.
- Log `APP_ENV` and `NODE_ENV` safely.
- Add unit tests for valid, missing, and invalid values.
- Do not change existing runtime conditionals yet.

### Phase 2 — Add environment configuration

- Add `APP_ENV=development` to Replit/local development configuration.
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

- Configure Development email delivery to use real configured recipients,
  matching Production.
- Add tests for reminder digest behavior in deployed, local, and test modes.
- Keep `RESEND` and `RESEND_API_KEY` as independent safeguards.

### Phase 5 — Update build, deployment, and documentation

- Update environment examples and deployment instructions.
- Update monitoring/logging instructions.
- Add `VITE_APP_ENV` only if a frontend label is required.
- Confirm `run-local.sh` behavior has not changed unintentionally.

### Phase 6 — Verify compatibility

- Run the full build and type checks.
- Start the Replit workflow and verify the platform-specific preview path.
- Test local authentication, cookies, API calls, Vite HMR, and database
  connectivity on a representative non-Replit host where supported.
- Test a compiled strict runtime.
- Test the Development deployment configuration in an isolated service or
  equivalent environment before production rollout.

## 8. Main risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Replacing every `NODE_ENV` check with `APP_ENV` | Vite, static serving, builds, or cookies may change unexpectedly | Keep `NODE_ENV` for technical mode; migrate policy checks selectively |
| Missing `APP_ENV` in an existing deployment | Startup or behavior regression | Use a documented backward-compatible fallback |
| Unknown `APP_ENV` value treated as local | Security regression | Validate and reject unknown values |
| Development deployment sends real email | Customer/provider side effects | Require explicit `RESEND=PRODUCTION` and `RESEND_API_KEY`; configure the intended recipients deliberately |
| `run-local.sh` changes from compiled to Vite behavior | Local verification workflow changes | Preserve the existing script and add a separate command if needed |
| Server-side `APP_ENV` expected in browser | Frontend label is missing or undefined | Use `VITE_APP_ENV` explicitly when required |
| `APP_ENV` is logged with sensitive environment data | Secret disclosure | Log only the two mode labels; never dump environment objects |
| Standalone server diverges from main server | Different security policy depending on entry point | Share the resolver and test both entry points |

## 9. Validation checklist

### Configuration

- [x] Only `production` and `development` are accepted.
- [x] Existing deployments without `APP_ENV` continue to start during migration.
- [x] Unknown values fail clearly and do not activate relaxed behavior.
- [x] No secret values are included in logs or documentation.

### Production

- [ ] `APP_ENV=production`, `NODE_ENV=production` (Render operational verification pending).
- [ ] Missing `SESSION_SECRET` prevents startup.
- [ ] Secure cross-origin cookies work.
- [ ] Compiled frontend is served.
- [ ] Detailed error stacks are hidden.
- [ ] Database SSL behavior is unchanged.

### Development deployment

- [ ] `APP_ENV=development`, `NODE_ENV=production` (Render operational verification pending).
- [ ] Same build and start commands as Production.
- [ ] Same strict cookie, secret, database, and error behavior.
- [ ] Logs and monitoring identify the service as Development.
- [ ] Email side effects follow the explicit Development email policy.

### Local development on any supported host

- [x] `APP_ENV=development`, `NODE_ENV=development` on Replit, Codespaces, local
  machines, and any other supported local host.
- [x] Vite middleware serves the local preview; the existing Replit HMR
  WebSocket handshake warning remains in the verification logs.
- [ ] Replit development plugins still work where applicable.
- [x] Detailed errors remain available locally.
- [x] Local database health checks return 200.
- [x] Reminder/email behavior remains safe for local use.

### Quality gates

- [x] `npm run build` succeeds.
- [x] `npm run check` is run and any pre-existing failures are distinguished
  from new failures.
- [x] Existing reminder digest tests pass.
- [x] New environment resolver tests pass.
- [x] Main server startup path is checked; standalone was audited and remains
  unchanged because no active repository consumer was found.
- [ ] Browser checks cover Replit/local and compiled strict behavior.
- [x] Documentation and deployment templates agree with the final mapping.

## 10. Acceptance criteria

The repository implementation is complete. Full rollout is ready when:

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
   NODE_ENV=development APP_ENV=development
   ```

7. The final environment contract is documented for developers on all supported
   local hosts, Render operators, monitoring, and CI/CD.

## 11. Decisions resolved during implementation

The following decisions are now confirmed:

- `APP_ENV` accepts only `production` and `development`.
- Local development uses `APP_ENV=development` and `NODE_ENV=development`.
- Production and deployed Development both use `NODE_ENV=production` and the
  same strict application policy.
- Deployed Development sends to configured real recipients, matching
  Production, when `RESEND=PRODUCTION` and `RESEND_API_KEY` are configured.
- Local development and automated tests remain dry-run/test-recipient oriented.
- `NODE_ENV=test` is an internal test runtime, not a third application label.
- Standalone support remains unconfirmed; the standalone entry point was audited
  but not changed.

The remaining work is operational rather than a code-design decision: configure
the two Render services, confirm the intended email credentials and recipients,
and run the deployed compatibility checks.
