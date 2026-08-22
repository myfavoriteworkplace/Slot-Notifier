# 5. Quality and test baseline

## 5.1 Commands run

The following checks were run against the audit baseline:

| Command | Result | Interpretation |
|---|---|---|
| `npm run build` | Passed | Vite client and esbuild server bundle complete |
| `npm run check` | Failed | Existing TypeScript errors remain |
| `npx tsx --test client/src/lib/booking-list.test.ts` | Passed: 4/4 | Narrow booking-list unit suite passes |
| `npm run scan` | Completed with findings | Dependency findings; optional SAST tools unavailable |

No application code was changed during these checks.

## 5.2 Build result

The production build completed successfully:

- client transformed successfully
- static output generated under `dist/public`
- server bundle generated under `dist/index.cjs`

Build warnings include large minified chunks, especially the vendor, clinic dashboard, doctor dashboard, and main application chunks. The project already uses manual chunking for icons, PDF dependencies, and vendor modules, but several chunks remain large.

### Performance TODO

- Measure actual route load and interaction performance before splitting further.
- Lazy-load large clinic/doctor panels by active tab, not only by page.
- Review duplicate or eagerly imported UI packages.
- Keep manual chunk strategy stable until a production build comparison is available.

## 5.3 Type-check result

`npm run check` currently fails in these areas:

- `client/src/components/AppointmentCard.tsx`
  - undefined no-show revert callback/pending symbols
- `client/src/components/BillingHistoryPanel.tsx`
  - undefined optimistic tax state setters
  - invalid `title` prop passed to Lucide `Lock`
- `client/src/components/BookingsPanel.tsx`
  - possibly undefined dates
  - modal tab union mismatch involving Documents
  - missing `patientName` property on booking type
  - Date/string mismatch
- `client/src/components/InventoryPanel.tsx`
  - nullable status callback mismatch
- `client/src/components/MedicalHistoryTab.tsx`
  - untyped/empty object medical history properties
- `client/src/pages/Book.tsx`
  - implicit `any` callback parameter
- `client/src/pages/ClinicDashboard.tsx`
  - `isRead` versus `read`
  - modal tab setter union mismatch
- `client/src/pages/DoctorDashboard.tsx`
  - possibly undefined dates
- `server/routes.ts`
  - implicit `any` callback parameters
  - unsupported `"consent_version"` audit resource value

These errors are pre-existing relative to the clean working tree at audit start. They block treating the type system as a reliable regression gate.

## 5.4 Existing automated tests

The repository currently contains:

- `client/src/lib/booking-list.test.ts`
- `tests/clinic-dashboard.spec.ts`

The booking-list suite covers:

- pending/confirmed ordering
- patient filtering
- display metadata
- booking number generation
- completed action disabling

The Playwright test is a clinic dashboard smoke flow that logs in with demo credentials, loads the dashboard, reloads, and asserts no browser errors.

## 5.5 Missing test coverage

### Booking state matrix

Add unit and integration cases for:

- yesterday pending
- yesterday confirmed
- today past slot
- today future slot
- tomorrow
- old checked-in
- old in-consultation
- old treatment-completed
- old completed
- old cancelled
- old no-show
- old patient-left-early
- null visit status
- no-show with active visit status
- doctor approval pending/declined/admin-confirmed
- local midnight and UTC midnight boundaries

### Surface consistency

Verify the same booking through:

- clinic card
- clinic detail dialog
- doctor card
- doctor detail dialog
- notification deep link
- selected patient filter
- pagination page outside the current loaded list

### Responsive UI

Test narrow dialog and card states with:

- one, two, and three actions
- long patient name
- long confirmation text
- long action labels
- mobile keyboard/vertical overflow
- terminal/rebook footer

### Security and data

Add route tests for:

- clinic ownership isolation
- doctor assignment isolation
- admin-only operations
- over-posting rejection
- expired OTP/consent token
- replayed payment/webhook
- private document download authorization
- audit log attachment to all PII routes

## 5.6 Test tooling TODO

- Make `npm run check` pass before adding new lifecycle behavior.
- Run Playwright in a controlled seeded environment, not only against an assumed running server.
- Add API integration tests for storage predicates and transitions.
- Install/configure the intended SAST tools or document an approved replacement.
- Add a CI command that runs build, type-check, unit tests, and security scan with explicit pass/fail policy.