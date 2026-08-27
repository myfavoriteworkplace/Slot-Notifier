# BookMySlot

## User Preferences
- Preferred communication style: Simple, everyday language.
- All prices displayed in Indian Rupees (₹).
- Email notifications via Resend API.

---

## 🔧 Per-Feature Development Checklist — Run After EVERY Change

Every time a feature or fix is completed — even a small one — run through this before telling the user it is done. No exceptions.

### Step A — Build Check (hard gate)
```
restart_workflow("Build Check")   # must reach FINISHED with exit 0
```
`npm run dev` passing is not enough. TDZ crashes, chunk errors, and bad import paths only appear in the production Rollup build.

### Step B — Duplicate export scan (for any new type or const you added)
```bash
grep -rn "export.*YourNewTypeName" client/src/
# Must return exactly one result — the canonical definition
```
Two results = TDZ crash in production. All shared frontend types live in `client/src/lib/clinic-constants.tsx`.

### Step C — Bare fetch / hardcoded URL scan
```bash
grep -rn "fetch('/api" client/src/
grep -rn 'fetch("/api' client/src/
grep -rn "localhost" client/src/
# All three must return zero results
```

### Step D — Deleted import verification
If you removed any `import { ... }` statement, grep every symbol you dropped:
```bash
grep -n "SymbolName" path/to/file.tsx
# Must not appear outside the import line
```

### Step E — Lockfile hygiene (if any package was installed)
```bash
npm run fix-lockfile
grep "package-firewall.replit.local" package-lock.json   # must return nothing
```

### Step F — Backend & schema changes (if server/ or shared/schema.ts touched)
Full rules: `docs/design-document/development-document/backend-and-db-checklist.md`

Non-negotiable minimum:
- **Auth guard** — every new route has `isAuthenticated`, clinic session check, or doctor session check.
- **Zod validation** — every `POST`/`PATCH`/`PUT` calls `.safeParse()` on `req.body` before passing to storage.
- **Dual registration** — new column/table in `shared/schema.ts` AND matching `ALTER TABLE … ADD COLUMN IF NOT EXISTS` in `server/index.ts`.
- **Migration safety** — new columns on existing tables are nullable OR have `.default()`.
- **IStorage** — new method declared in `IStorage` interface AND implemented in `DatabaseStorage`.
- **Render SQL** — exact SQL documented for developer to run manually on Render Postgres.

```bash
# Verify dual registration
grep -rn "new_field" shared/schema.ts server/index.ts   # must appear in both
```

### Quick gate summary
```
[ ] Build Check workflow finished with exit 0
[ ] No duplicate exports for any new type/const
[ ] No bare fetch('/api/...') or localhost in client/src/
[ ] No deleted import symbol still used in JSX
[ ] fix-lockfile run if any package was installed this session
[ ] No console.log or debug statements left in committed code
[ ] (backend) Every new route has correct auth guard
[ ] (backend) Every POST/PATCH/PUT validates req.body with Zod .safeParse()
[ ] (schema) New column/table in schema.ts AND in server/index.ts migration block
[ ] (schema) New column is nullable or has DEFAULT
[ ] (schema) Render Postgres SQL documented for developer to run manually
```

---

## ✅ Pre-Deploy Checklist — Run Before Every Production Deploy

Run `npm run build` locally or restart **"Build Check"** workflow. `npm run dev` catches none of the issues below.

```
[ ] npm run build exits 0
[ ] No real jspdf / jspdf-autotable / qr.js imports — all use @/lib/jspdf-stub
[ ] No duplicate exported type/const names across files in the same Rollup chunk
[ ] No deleted import symbols still referenced in JSX
[ ] No bare fetch('/api/...') or hardcoded localhost URLs
[ ] All new frontend env vars have VITE_ prefix
[ ] npm run fix-lockfile run after any package install
[ ] New DB columns/tables have matching SQL queued for Render Postgres
[ ] New frontend domains added to CORS allowlist
[ ] vite.config.ts manualChunks config intact (react-core, lucide, ui-vendor, vendor)
```

**CJS library rule:** Replit blocks jspdf, jspdf-autotable, qr.js at install time — they silently become `undefined` in dev but cause TDZ crashes in production bundles. Use the project stub:
```ts
import { jsPDF } from "@/lib/jspdf-stub";   // no-op, logs a warning
```
Before installing any new npm package, check if it is CJS-only (no `"module"` or `"exports"` field). If yes, wrap it in a stub.

**TDZ / duplicate export rule:** If the same exported name appears in two files in the same Rollup chunk, Rollup renames one during minification → `ReferenceError: Cannot access 'X' before initialization` at runtime. Canonical homes:
- Shared frontend types: `client/src/lib/clinic-constants.tsx`
- PDF utilities: `client/src/lib/clinic-pdf.ts`

**Lockfile contamination:** After any `npm install` inside Replit, run `npm run fix-lockfile`. Replit writes `package-firewall.replit.local` as the resolved URL — that host is unreachable on Render.

**Memory budget:** If Render build OOMs, add `NODE_OPTIONS=--max-old-space-size=4096` to Render environment. The `manualChunks` config in `vite.config.ts` must remain intact.

---

## 💡 Senior Developer Standard — Code Quality Bar

Write code that a senior developer could read, maintain, and trust in production — not code that merely satisfies a task description.

### Mindset
- **Write for the next person, not the task.** Clarity is not optional.
- **Treat Replit dev as a scratch pad.** The real target is always Render production.
- **Prefer boring over clever.** Use the existing stack before reaching for a new package.

### General code rules
1. **Errors must be explicit.** No empty `catch {}`, no swallowed errors, no `|| undefined` fallbacks.
2. **No bare `console.log` in committed code.** Backend logs must use `[LABEL]` prefix (e.g. `[BILLING] invoice confirmed`). Frontend logs must not exist.
3. **One function does one thing.** Fetching, formatting, and mutating state are three separate concerns.
4. **Types come from canonical files.** `shared/schema.ts` for DB models, `client/src/lib/clinic-constants.tsx` for shared frontend types. Never redefine inline in a component.
5. **No magic numbers or hardcoded strings.** Name them as constants with a unit comment.
6. **Routes stay thin.** Validate (Zod) → call storage → return response. Business logic belongs in storage or a service function.
7. **Every UI state is intentional.** Loading → real skeleton/spinner. Error → message + optional retry. Empty → empty-state UI, not a blank list.
8. **Every interactive element is accessible.** Icon-only buttons need `aria-label`. Form inputs need a label.
9. **Every interactive element has `data-testid`.** Pattern: `{action}-{target}` (buttons/inputs), `{type}-{content}-{id}` (dynamic list items).

### Backend-specific rules
1. **No `db` imports in route files.** All Drizzle queries live in `server/storage.ts`.
2. **No raw `req.body` to storage.** Always parse through Zod `.safeParse()` first.
3. **No `any` types in storage methods.** Derive from `shared/schema.ts` types.
4. **Migrations are append-only.** Never edit existing blocks in `server/index.ts` — add new blocks below.
5. **Idempotent migrations.** Every `CREATE TABLE` and `ALTER TABLE ADD COLUMN` uses `IF NOT EXISTS`.

### Before marking any feature done, ask
- Can a new developer understand this code without reading a comment?
- Does every failure path show the user something useful?
- Is every value named, typed, and coming from a canonical source?
- Does the Build Check pass?
- (backend) Does every new route have an auth guard? Does every mutating route validate with Zod?
- (schema) Is the new column in both `shared/schema.ts` AND `server/index.ts`?

> Full backend & DB checklist: `docs/design-document/development-document/backend-and-db-checklist.md`
> Full UI component checklist: `docs/design-document/development-document/frontend-design-document.md` → Feature Completion Gate

---

## Development Platforms and Deployment Environments

Local development is platform-independent. Developers may use Replit,
Codespaces, a local machine, or another supported third-party environment.
These are all the same application category: **Local**.

Production and Development deployments are separate deployed environments on
Render. They use the same compiled build and start process, but different
`APP_ENV` labels.

| Environment | Hosting platform | Purpose | Environment values | How it runs |
|---|---|---|---|---|
| **Local development** | Replit | AI-assisted development + preview | `APP_ENV=local`, `NODE_ENV=development` | `npm run dev` — Express + Vite, same origin, port 5000 |
| **Local development** | Codespaces, local machine, or another supported host | Developer testing and iteration | `APP_ENV=local`, `NODE_ENV=development` | `npm run dev`, using the host's own port/preview configuration |
| **Development deployment** | Render frontend Static Site + backend Web Service | Deployed development, acceptance, and integration testing | `APP_ENV=development`, `NODE_ENV=production` | Same compiled build and `npm start` flow as Production |
| **Production deployment** | Render frontend Static Site + backend Web Service | Live production application | `APP_ENV=production`, `NODE_ENV=production` | Compiled build and `npm start` |

The important distinction is:

```text
APP_ENV identifies which application environment is running.
NODE_ENV identifies the technical runtime/build mode.
The hosting platform identifies where that environment runs.
```

Therefore:

- Replit, Codespaces, local machines, and other local hosts all use
  `APP_ENV=local` for interactive development.
- Render Development uses `APP_ENV=development` but still uses
  `NODE_ENV=production`.
- Render Production uses `APP_ENV=production` and `NODE_ENV=production`.
- `APP_ENV=development` must not activate the local Vite development server.
- Replit-specific variables and plugins remain platform-specific and must not
  be used as alternative `APP_ENV` values.

### Key rules for agents
- Never use bare `/api/...` fetch paths — they break across origins. Use `apiRequest()` from `@/lib/queryClient`.
- Never hardcode `localhost`, `127.0.0.1`, or port numbers. Use env vars.
- Frontend env vars must be prefixed `VITE_` — non-prefixed vars are stripped at Vite build time.
- New backend env vars must be called out explicitly for Render and for each
  supported local configuration method.
- New frontend domains must be added to the CORS allowlist in `server/index.ts` or via the `FRONTEND_URL` env var.
- Auth is platform/configuration-specific — Replit uses OIDC, while Local and
  Render use `ADMIN_EMAIL`/`ADMIN_PASSWORD`. `APP_ENV=local` does not erase
  those platform-specific authentication requirements.
- Never add `process.env.REPL_ID` checks or Replit-specific middleware — use `NODE_ENV` instead.
- Session cookies: `sameSite: "none"` + `secure: true` + `trust proxy: 1` — required for cross-origin Render. Do not change these.
- Node pinned to **20.20.0** via `.node-version`. Do not change — Node 22+ breaks `npm install` on Render.

### Render Build Commands

Both Render deployment environments use the same service commands. The
environment label changes, but the compiled build and deployment process does
not:

| Render environment | Service | Build Command | Start Command | Publish Dir |
|---|---|---|---|---|
| **Production** | Backend | `npm install --include=dev && npm run db:push && npm run build` | `npm run start` | N/A |
| **Development** | Backend | `npm install --include=dev && npm run db:push && npm run build` | `npm run start` | N/A |
| **Production** | Frontend | `npm install && npm run build` | N/A | `dist/public` |
| **Development** | Frontend | `npm install && npm run build` | N/A | `dist/public` |

For the backend services:

```text
Render Production:  APP_ENV=production  NODE_ENV=production
Render Development: APP_ENV=development NODE_ENV=production
```

For the frontend services, `NODE_ENV` is represented by the production Vite
build mode. Only add `VITE_APP_ENV` if the browser needs to display the
Production or Development label; do not use it as a replacement for Vite's
`DEV`/`PROD` flags.

`npm run build` runs `script/build.ts`: (1) Vite → `dist/public`, (2) esbuild → `dist/index.cjs`. `sourcemap: false` prevents OOM. `manualChunks` splits react-core / lucide / ui-vendor / vendor — do not collapse these.

---

## Application Architecture

### Auth — Three Independent Systems

| Hook | Endpoint | StaleTime | Fires On |
|---|---|---|---|
| `useAuth` | `GET /api/auth/user` | 5 min | Every page load |
| `useClinicAuth` | `GET /api/auth/clinic/me` | 5 min | Every page load |
| `useDoctorAuth` | `GET /api/auth/doctor/me` | 5 min | Only DoctorDashboard |

User roles: `superuser` (admin), `owner` (clinic staff), `customer` (book slots), `doctor` (view schedule).

### QueryClient Defaults
```ts
{ refetchInterval: false, refetchOnWindowFocus: false, staleTime: Infinity, retry: false }
```
No automatic refetching. Data cached forever until explicitly invalidated. Only `useNotifications` and `HealthIndicator` use `refetchInterval: 30000`.

### Server Boot Sequence (`server/index.ts`)
```
1. dotenv.config()
2. Express + HTTP server
3. trust proxy = 1
4. Session (connect-pg-simple, sameSite=none, secure=true, 30-day rolling)
5. CORS middleware (FRONTEND_ORIGINS + FRONTEND_URL env var)
6. Body parsing (express.json + rawBody capture)
7. Request logging (redacts "token" fields)
8. DB schema sync (~20 CREATE TABLE / ALTER TABLE checks + backfills)
9. Seed (demo clinic + doctor if not present)
10. Register API routes
11. API 404 handler (JSON)
12. Production → serveStatic(dist/public). Development → Vite middleware
13. Global error handler
14. Listen on port 5000
```

### Key Takeaways for Agents

| Concern | What to do |
|---|---|
| Adding a new page | Import in `App.tsx` + `Route` in Router. Consider `React.lazy()` — bundle is already 3MB. |
| Adding a panel to ClinicDashboard | Imports go to the top — loaded at parse time. Gate queries on `activePanel` to avoid firing on every login. |
| Adding new queries | Gate on `activePanel` / `activeTab` — avoid firing on every login. |
| Adding new env vars | Frontend → `VITE_` prefix. Backend → call out explicitly for Render. |
| Changing session config | `sameSite: "none"` + `secure: true` + `trust proxy: 1` are all required for cross-origin Render. |

---

## Project Overview

**BookMySlot** — full-stack appointment booking platform for dental clinics. Role-based access: clinic owners manage slots and bookings, patients book appointments, doctors view schedules, superusers administer the platform.

### Stack
- **Frontend**: React 18 + TypeScript, Vite, Wouter, TanStack Query v5, shadcn/ui + Radix UI, Tailwind CSS
- **Backend**: Node.js, Express, TypeScript ESM, Passport.js (OIDC + session), Drizzle ORM
- **Database**: PostgreSQL (Drizzle schema in `shared/schema.ts`, manual migration sync in `server/index.ts`)
- **Storage**: Cloudflare R2 — clinic logos, Smile Deal images, doctor profile photos (signed URL upload)
- **Email**: Resend API (`RESEND_API_KEY`). `RESEND=PRODUCTION` sends real email; `DEV` redirects to test address.
- **WhatsApp**: Twilio + Meta + Zavu providers (digital consent links, booking notifications)

### Key Data Models
- **Clinics** — clinic details, status (pending/approved/archived), subscription, default slot config
- **Doctors** — profile, certifications, cases, languages, years of experience
- **ClinicDoctors** — join table linking clinics and doctors
- **Slots** — time windows created by owners
- **Bookings** — patient reservations linked to slots; includes consent, clinical status, visit status, billing
- **PatientBills** — billing records per booking (DFT draft → INV invoice, paid status)
- **SmileDeals** — promotional offers (image, price, originalPrice, subcategory, flash/featured flags, video)
- **Notifications** — in-app notification system
- **email_otps** — OTP verification for patient booking flow
- **consent_tokens** — 72-hour tokens for digital consent signing

### Color Palette (Green Theme)
- **Primary**: `#0F9B6E` — buttons, links, active states
- **Dark Green**: `#085041` — headers, gradient starts, PDF accent
- **Accent**: `#1D9E75` — highlights, hover states, gradient ends
- **Light Tint**: `#E1F5EE` — panel backgrounds
- **Neutral**: `#F8F8F6` — page background

Sidebar nav: Bookings = primary green, Configure Slots = blue, Manage Doctors = teal.

### Key Features
- **Clinic self-registration** — pending → superuser approve → activation email → owner login
- **Slot configuration** — day/section/timing editor with default config support
- **Patient booking flow** — email OTP verification → slot selection → booking
- **Digital Consent** — clinic requests → Twilio WhatsApp → patient signs at `/consent/:token` → saved with timestamp + IP
- **Billing** — per-booking bill panel: draft → confirm & pay → invoice; print PDF
- **Doctor profiles** — R2 photo upload, certifications, cases, public profile page
- **Smile DEALS** — admin-managed promotional offers, public dark-theme gallery with flash strip, countdown, tilt cards
- **Admin panel** — tabbed: Active / Pending / Archived clinics + Smile Deals CRUD

### Smile DEALS Schema Fields
`title`, `description`, `imageUrl`, `bookingLink`, `price` (₹), `originalPrice` (strike-through), `category`, `subcategory` (drives filter pills), `isFlash`, `isFeatured`, `startsAt`, `expiresAt`, `videoUrl` (autoplay hero/hover), `viewCount`, `clickCount`

### Digital Consent API
- `POST /api/auth/clinic/bookings/:id/request-consent` — clinic-auth, generates token, sends WhatsApp
- `GET /api/consent/:token` — public, returns booking + clinic info
- `POST /api/consent/:token/sign` — public, saves signature + timestamp + IP
