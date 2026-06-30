# BookMySlot

## ✅ Pre-Deploy Checklist — Run Before Every Production Deploy

Every agent and developer must work through this list before pushing to Render (or any production host). Each item maps to a real crash that happened in this project.

---

### Step 1 — Run the production build locally / in Replit

```bash
npm run build        # must exit 0
```

Or restart the **"Build Check"** workflow in Replit. `npm run dev` does **not** catch any of the issues below — they only appear in the minified Rollup/Vite output. Do not mark work done until this passes.

---

### Step 2 — Blocked / CJS library imports

Replit's security policy blocks several packages at install time. These packages silently become `undefined` in Replit dev mode but cause a **TDZ crash** (`ReferenceError: Cannot access 'X' before initialization`) in the production Rollup bundle because of how Rollup converts CJS circular internals to ESM.

**Scan for these imports before every deploy:**

```bash
grep -rn "from ['\"]jspdf['\"]" client/src/
grep -rn "from ['\"]jspdf-autotable['\"]" client/src/
grep -rn "import(.*jspdf" client/src/
grep -rn "from ['\"]qr\.js['\"]" client/src/
```

**If any are found:** replace with the project stub:
```ts
import { jsPDF } from "@/lib/jspdf-stub";
import autoTable from "@/lib/jspdf-stub";
```
The stub (`client/src/lib/jspdf-stub.ts`) is a no-op that logs a warning. PDF features silently disable instead of crashing the bundle.

**General rule — before installing any new npm package:**
1. Check if it is a CJS-only package (no `"module"` or `"exports"` field in its `package.json`).
2. If it is CJS, wrap it in a project-level stub (like `jspdf-stub.ts`) that exports no-op implementations.
3. Never import CJS packages with side-effects (auto-table plugin pattern) at the top level of any file that ends up in the ClinicDashboard chunk.

---

### Step 3 — Duplicate exports / TDZ from shared types

Rollup renames symbols when the same export name appears in more than one file inside the same chunk. This causes `ReferenceError: Cannot access 'X' before initialization` at runtime (the symbol name is minified so the error message looks like `Cannot access 'It'`).

**Scan for duplicate exports before every deploy:**

```bash
# Replace TypeName with any type/const you added or moved
grep -rn "export.*BookingWithSlot" client/src/
grep -rn "export.*SlotTiming" client/src/
grep -rn "export.*BillingService" client/src/
# General: check the type/const you just added
grep -rn "export (type |interface |const |function )YourName" client/src/
```

**Rule:** All shared frontend types and constants have exactly one canonical home:
- Types/constants: `client/src/lib/clinic-constants.tsx`
- PDF utilities: `client/src/lib/clinic-pdf.ts`
- PDF stub: `client/src/lib/jspdf-stub.ts`

If a type already exists in one of these files, **import it — never redefine it**.

---

### Step 4 — Deleted imports still referenced in JSX

When removing an import statement (e.g., deduplicating icon imports), verify every symbol in that statement is covered elsewhere **before** deleting it.

```bash
# Before removing an import, grep all symbols for usage
grep -n "Stethoscope\|Trash2\|Upload\|Repeat2" client/src/pages/ClinicDashboard.tsx
# If any appear outside import lines, they must remain imported
```

**Rule:** Never delete an import block in a large file without grepping every symbol in it. "Looks like a duplicate" is not sufficient — two separate `import { ... } from "lucide-react"` blocks in the same file are valid if they cover different icon names.

---

### Step 5 — API URL hygiene

```bash
# Must return 0 results
grep -rn "fetch('/api" client/src/
grep -rn 'fetch("/api' client/src/
grep -rn "localhost" client/src/
grep -rn "127\.0\.0\.1" client/src/
```

All API calls must go through `apiRequest()` from `@/lib/queryClient`. Bare `/api/...` paths break when frontend and backend are on different domains (Render split deploy).

---

### Step 6 — Environment variable prefixes

```bash
# All frontend env vars must start with VITE_
grep -rn "process\.env\." client/src/
grep -rn "import\.meta\.env\." client/src/ | grep -v "VITE_\|MODE\|DEV\|PROD\|BASE_URL"
```

Non-`VITE_` vars are stripped at Vite build time and silently become `undefined` in the browser.

---

### Step 7 — package-lock.json Replit URL contamination

After installing any package inside Replit:

```bash
npm run fix-lockfile
```

Then verify:
```bash
grep "package-firewall.replit.local" package-lock.json
# Must return nothing
```

Replit writes its internal proxy URL as `"resolved"` in `package-lock.json`. That hostname is unreachable on Render — the build will fail with `ENOTFOUND package-firewall.replit.local` at `npm install` time.

---

### Step 8 — New database columns/tables

```bash
# List any new tables or columns added since last deploy
grep -n "CREATE TABLE\|ALTER TABLE\|ADD COLUMN" server/index.ts | tail -20
```

The auto-sync in `server/index.ts` only runs on Replit startup. It does **not** run automatically on Render's Postgres. For every new column or table, provide the exact SQL and run it manually against the Render database before deploying.

---

### Step 9 — CORS allowlist for new frontend domains

```bash
grep -n "FRONTEND_ORIGINS\|allowedOrigins" server/index.ts
```

If a new Render frontend URL is introduced, add it to the `FRONTEND_ORIGINS` array or update the `FRONTEND_URL` env var on the Render backend service. Missing CORS entries cause silent 401/403 errors that look like auth failures.

---

### Step 10 — Memory budget for the Vite build

ClinicDashboard.tsx is 400KB+ source. The Vite production build is memory-intensive.

```bash
# If the build OOMs on Render, add this to Render's environment:
NODE_OPTIONS=--max-old-space-size=4096
```

`manualChunks` in `vite.config.ts` already splits `react-core`, `lucide`, `ui-vendor`, and `vendor` into separate chunks. Do not remove or collapse these — it prevents Render's heap from being exhausted during the Lucide icon tree-shake pass.

---

### Quick Checklist Summary

```
[ ] npm run build exits 0 (Build Check workflow passes)
[ ] No real jspdf / jspdf-autotable / qr.js imports — all use @/lib/jspdf-stub
[ ] No duplicate exported type/const names across files in the same Rollup chunk
[ ] No deleted import symbols that are still referenced in JSX
[ ] No bare fetch('/api/...') or hardcoded localhost URLs
[ ] All new frontend env vars have VITE_ prefix
[ ] npm run fix-lockfile run after any package install
[ ] New DB columns/tables have matching SQL queued for Render Postgres
[ ] New frontend domains added to CORS allowlist
[ ] vite.config.ts manualChunks config is intact
```

---

## ⚠️ Mandatory Agent Rules — Read First, Every Session

These rules apply to **every agent** working on this repo, including forks and checkouts.

### 1. Run Build Check after every frontend feature

After completing any frontend change (new component, import added, type changed), run the **"Build Check"** workflow before handing back to the user:

```
restart_workflow("Build Check")   # waits for npm run build to exit 0
```

Do not mark a feature done until the build passes. `npm run dev` does **not** catch production chunk errors — only the full build does. A live production crash was caused by skipping this step (see TDZ Rule section below).

### 2. Never redefine shared types locally

All shared frontend types (`BookingWithSlot`, `SlotTiming`, `SectionConfig`, `DayConfig`, etc.) are canonical in `client/src/lib/clinic-constants.tsx`. Before defining any new exported type in a component file, run:

```
grep -rn "export.*YourTypeName" client/src/
```

If it exists anywhere, import it — never redefine it. Duplicate exports in the same Rollup chunk cause silent TDZ crashes in production.

---

## 🔧 Per-Feature Development Checklist — Run After EVERY Change

This is separate from the pre-deploy checklist above. Every time a feature or fix is completed — even a small one — run through this list before telling the user it is done. No exceptions.

### Step A — Build Check (mandatory gate)

```
restart_workflow("Build Check")   # must reach FINISHED status with exit 0
```

`npm run dev` passing is not enough. The production Rollup build is the only environment that catches TDZ crashes, chunk errors, and bad import paths. Do not hand back to the user until this passes.

### Step B — Duplicate export scan (for any new type or const you added)

```bash
grep -rn "export.*YourNewTypeName" client/src/
# Must return exactly one result — the canonical definition
```

If you added or moved any exported type, interface, or const, verify it exists in exactly one file. Two results = TDZ crash in production.

### Step C — Bare fetch / hardcoded URL scan

```bash
grep -rn "fetch('/api" client/src/
grep -rn 'fetch("/api' client/src/
grep -rn "localhost" client/src/
```

All three must return zero results. Every API call must use `apiRequest()` from `@/lib/queryClient`.

### Step D — Deleted import verification

If you removed or reorganised any `import { ... }` statement, grep every symbol you dropped before finishing:

```bash
grep -n "SymbolName" path/to/the/file.tsx
# Symbol must not appear outside the import line
```

Never assume "it looked like a duplicate" — two import blocks from the same package in one file are valid if they cover different names.

### Step E — Lockfile hygiene (if any package was installed)

```bash
npm run fix-lockfile
grep "package-firewall.replit.local" package-lock.json
# Second command must return nothing
```

Only needed when `npm install` was run during this session. Always safe to run even if not needed.

### Quick gate summary

```
[ ] Build Check workflow finished with exit 0
[ ] No duplicate exports for any new type/const
[ ] No bare fetch('/api/...') or localhost in client/src/
[ ] No deleted import symbol still used in JSX
[ ] fix-lockfile run if any package was installed this session
[ ] No console.log or debug statements left in committed code
```

---

## 💡 Senior Developer Standard — Code Quality Bar

Every agent working in this repo must write code to this standard. The goal is code that a senior developer could read, maintain, and trust in production — not code that merely passes a task description.

### Mindset

- **Write for the next person, not the task.** Code will be read far more than it is written. Clarity is not optional.
- **Treat Replit dev as a scratch pad.** The real target is always Render production. If it only works in `npm run dev`, it does not work.
- **Prefer boring over clever.** Use the existing stack. Do not reach for a new library when a native API or an already-installed package can do it.

### Code rules

1. **Errors must be explicit.** Never use an empty `catch {}`, never swallow an error silently, never use `|| undefined` as a fallback to hide a missing value. If something failed, the user must know.
2. **No `console.log` in committed code.** Debug logs are for a local branch. If a log is needed permanently, use a named logger with a severity level.
3. **One function does one thing.** If a function is doing two things (e.g. fetching data AND formatting it AND mutating state), split it.
4. **Types come from the canonical files.** `shared/schema.ts` for DB models, `client/src/lib/clinic-constants.tsx` for shared frontend types. Never redefine inline in a component.
5. **No magic numbers or hardcoded strings.** Timeouts, limits, status values — name them as constants with a comment explaining the unit.
6. **API routes stay thin.** Routes validate input (Zod), call storage, and return a response. Business logic belongs in storage or a dedicated service function — not inside the route handler.
7. **Every UI loading state is intentional.** Show a real skeleton or spinner while data is fetching — not a blank screen. Every error state shows a message — not just nothing. Every empty list has an empty-state UI.
8. **Every interactive element is accessible.** Icon-only buttons must have `aria-label`. Form inputs must have a label or `aria-label`. Focus rings must be visible.
9. **Every interactive element has a `data-testid`.** Use `{action}-{target}` for buttons/inputs, `{type}-{content}` for display elements.

### Before marking any feature done, ask

- Would a developer new to this codebase understand what this code does without reading a comment?
- Does every failure path show the user something useful?
- Is every new value named, typed, and coming from a canonical source?
- Does the Build Check pass?

If any answer is no, fix it first.

---

## Overview

BookMySlot is a full-stack appointment booking application that enables service owners to manage availability slots and customers to book appointments. The application features role-based access control (owner vs customer), real-time notifications, and a modern responsive UI.

## User Preferences

- Preferred communication style: Simple, everyday language.
- All prices displayed in Indian Rupees (₹).
- Email notifications via Resend API.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight alternative to React Router)
- **State Management**: TanStack React Query for server state caching and synchronization
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens and CSS variables for theming
- **Build Tool**: Vite with hot module replacement

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ESM modules
- **API Design**: RESTful endpoints defined in shared route contracts (`shared/routes.ts`)
- **Validation**: Zod schemas for request/response validation with drizzle-zod integration
- **Session Management**: Express sessions with PostgreSQL-backed session store (connect-pg-simple)

### Data Storage
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with type-safe schema definitions
- **Schema Location**: `shared/schema.ts` for all database models
- **Manual Sync**: Schema is also manually synced via SQL commands in `server/index.ts` to handle environment constraints.

### Authentication
- **Dual Mode Support**: 
  - Replit OIDC (when running on Replit)
  - Environment-based email/password (when `ADMIN_EMAIL` and `ADMIN_PASSWORD` are set)
- **Strategy**: Passport.js with OpenID Client (Replit) or session-based auth (external)
- **User Roles**: `superuser` (admin), `owner` (clinic staff), `customer` (can book slots), `doctor` (view schedule)

### Key Data Models
- **Users**: Authentication and role management
- **Clinics**: Clinic details including a `doctors` JSONB field for legacy/quick reference.
- **Doctors**: Separate table for doctor profiles and login.
- **ClinicDoctors**: Join table linking clinics and doctors.
- **Slots**: Time windows created by owners for booking.
- **Bookings**: Customer reservations linked to slots.
- **SmileDeals**: Promotional dental offers managed by super admins.
- **Notifications**: In-app notification system.

## External Integrations

### Email (Resend)
- **Configuration**: Requires `RESEND_API_KEY`.
- **Modes**: `RESEND=PRODUCTION` sends to actual emails; `DEV` redirects all mail to a test address.
- **Features**: Booking confirmations, cancellations, and doctor invitations.

### Storage (Cloudflare R2)
- **Configuration**: Requires R2 credentials (`R2_ACCESS_KEY_ID`, etc.).
- **Usage**: Clinic logos and Smile Deal images.
- **Flow**: Frontend requests signed URL from `/api/uploads/signed-url`, then uploads directly to R2.

## Admin Features
- **Clinic Management**: Approve self-registered clinics, archive/restore clinics, manage credentials.
- **Smile DEALS**: Create and manage promotional offers with images, descriptions, and pricing in ₹.
- **Dashboard**: Tabbed interface for Active, Pending, Archived clinics, and Smile Deals.

## Color Palette (Green Theme)
- **Primary**: `#0F9B6E` (HSL 161 82% 33%) — main buttons, links, active states
- **Dark Green**: `#085041` — header backgrounds, gradient starts, PDF accent
- **Accent**: `#1D9E75` (HSL 161 69% 37%) — highlights, hover states, gradient ends
- **Light Tint**: `#E1F5EE` — panel backgrounds, secondary fills
- **Neutral**: `#F8F8F6` — near-white page background

Sidebar nav color coding: Bookings = primary green, Configure Slots = blue, Manage Doctors = teal, Book a Slot = primary green.

## Smile DEALS — Schema Fields
- `title`, `description`, `imageUrl`, `bookingLink` — core fields
- `price` — deal price (₹), optional
- `originalPrice` — was-price for strike-through + "Save ₹X" badge
- `category` — broad business category (Clinic Deals, Advertisements, etc.)
- `subcategory` — procedure type (Cleaning, Whitening, Braces, etc.) — drives public filter pills
- `isFlash` — boolean; appears in horizontal "Flash Deals" scroll strip
- `isFeatured` — boolean; appears as cinematic hero card
- `startsAt`, `expiresAt` — scheduling timestamps
- `videoUrl` — YouTube/Vimeo/mp4; autoplay on hover in cards and as hero background
- `viewCount`, `clickCount` — analytics counters

## Smile DEALS — Public Page Design
- Full dark theme (`#080D0B` background, Sora font)
- Animated ambient orbs behind content
- Stats row: Active Deals count, Avg Saving (computed from originalPrice − price), Total Views
- Filter pills from `subcategory` field
- Featured hero card (cinematic side-by-side layout with video support)
- Flash Deals horizontal scroll strip
- Countdown timer card (auto-shown for deals expiring within 72h)
- 3-column tilt cards grid with magnetic hover
- Bottom promo: Refer a Clinic (exclusive deals) + Loyalty Rewards (coming soon)

## Digital Consent Form
- **Flow**: Clinic clicks "Request →" in booking card → backend generates a 72-hour token → WhatsApp link sent to patient via Twilio → patient visits `/consent/:token` → signs with finger/mouse on canvas → signature saved to `bookings.consent_signature` with timestamp and IP.
- **Clinic UI**: "Digital Consent" panel in each booking card. Shows "Request →" / "Resend →" button and the consent URL (copy + open). Shows green "Signed ✓" badge once patient has signed.
- **Patient UI**: `/consent/:token` — public page (no login), shows clinic info, appointment summary, consent declaration text, signature pad (using `signature_pad`), and submit button.
- **API**: `POST /api/auth/clinic/bookings/:id/request-consent` (clinic-auth), `GET /api/consent/:token` (public), `POST /api/consent/:token/sign` (public).

## Recent Changes
- **2026-06-08**: Added `.node-version` file pinning Node to 20.20.0 — prevents Render from auto-selecting Node 22 + npm 11 which caused `npm install` to fail with "Exit handler never called".
- **2026-06-08**: `vite.config.ts` — set `sourcemap: false` and added `manualChunks` vendor splitting to prevent OOM crash during Render production build.
- **2026-04-13**: Completed patient booking email OTP verification UI and safeguards: patients must send and verify a 6-digit email code before viewing slots or booking, OTP tokens expire with the code window, and the `email_otps` table is created during startup.
- **2026-04-13**: Migrated app startup for Replit preview: installed missing runtime dependency, configured the app workflow on port 5000, added root health and notifications API endpoints requested by the frontend, and ignored local `.env` files.
- **2026-04-06**: Full digital consent form implementation: 3 API routes, storage methods, patient signing page (`/consent/:token`), clinic dashboard panel with "Request Consent" button and signed status.
- **2026-04-06**: Fixed missing DB columns (`assigned_doctor_email`, `doctor_notes`, `clinical_status`, etc.) via isolated migration blocks in `db.ts`.
- **2026-03-30**: Doctor profile: replaced URL input with file upload (R2), added completeness bar, years of experience field, languages multi-select (English/Malayalam/Tamil/Hindi/Kannada), Preview Profile button. New `years_of_experience` and `languages TEXT[]` columns added to doctors table. Public profile page updated to display both new fields.
- **2026-03-05**: Added Smile DEALS system with admin CRUD and public gallery.
- **2026-03-05**: Integrated Resend API for booking and invitation emails.
- **2026-03-05**: Fixed doctor patient/clinic lookup to handle session email strings.
- **2026-03-05**: Updated Admin Panel with tabbed navigation and deal configuration.
- **2026-03-05**: Ensured all pricing uses Indian Rupee (₹) symbol.
- **2026-03-05**: Improved Header with discrete Admin access for superusers.
- **2026-03-06**: Fixed Smile Deals image upload by allowing "smile-deals" folder.
- **2026-03-08**: Added `/api/auth/user` endpoint; fixed superadmin logout.
- **2026-03-08**: Expanded pending clinics tab with full card layout.
- **2026-03-29**: Added `originalPrice`, `subcategory`, `isFlash` to smile_deals schema.
- **2026-03-29**: Full dark redesign of Smile Deals public page (Sora font, ambient orbs, flash strip, countdown, tilt cards, promo section).
- **2026-03-29**: Admin deal form: added Procedure/Type dropdown, Original Price field, Flash Deal toggle, Start Date field, updated categories.

---

## Developer Workflow & Environments

> **Replit is AI development only.** The human developer uses Replit to write and preview code with the AI agent. Actual running, testing, and deploying are done on the developer's local machine (pre-deploy testing) and Render (production). **All code must work in all three environments — Replit, local, and Render.** The Replit workflow (`npm run dev`) is just a convenience for the AI agent; the real target is the Render split-frontend + Render backend.

This project uses **three separate environments** with distinct purposes. Every agent working in this repo must understand this before writing any code.

### Environment Map

| Environment | Purpose | How it runs |
|---|---|---|
| **Replit** | AI-assisted development only — agent writes and previews code here | `npm run dev` — Express + Vite on the same origin (port 5000) |
| **Local machine** | Developer testing before deploying to Render | Vite dev server (`localhost:5173`) + Express backend (`localhost:PORT`) as two separate processes |
| **Render (production)** | Live production deployment | Frontend and backend as **two separate Render services** with different domains |

### What this means for agents
- **Write code for Render + Local** — Replit is just a preview. The code you write must work in both the Render split environment (different domains) and the developer's local machine (two separate processes).
- **The Replit preview proves nothing** — just because it works in `npm run dev` on Replit does not mean it will work on Render or locally. Always verify against the coding rules.
- **Never add Replit-only hacks** — don't add `process.env.REPL_ID` checks, Replit-specific middleware, or hardcoded `replit.dev` URLs. Use `NODE_ENV` or `VITE_API_URL` instead.
- **Always test auth with both paths** — Replit uses OIDC. Local and Render use `ADMIN_EMAIL`/`ADMIN_PASSWORD`. Both must work.

### Replit (AI Development Only)
- Used **only** for writing and previewing code with the AI agent.
- Runs as a single unified server: Express serves both the API and the Vite frontend on port 5000.
- **Not used for final testing** — the developer tests on their local machine before deploying.
- Replit OIDC authentication is active here. Local and Render use `ADMIN_EMAIL`/`ADMIN_PASSWORD` instead.

### Local Machine (Developer Testing)
- Mirrors the Render split exactly: frontend and backend run as **separate processes**.
- Frontend: Vite dev server on `localhost:5173`
- Backend: Express on `localhost:<PORT>` (set via `PORT` env var)
- All API calls must use the `VITE_API_URL` env var — bare `/api/...` paths will not work across origins.
- Local `.env` files are gitignored — each developer maintains their own.

### Render (Production)
- **Frontend**: Deployed as a Render **Static Site**. Publish directory: `dist/public`.
- **Backend**: Deployed as a Render **Web Service**. Start command: `npm run start`.
- The two services run on **different domains** — all API calls are cross-origin by default.
- Session cookies use `sameSite: "none"` + `secure: true` to work across origins.
- `app.set("trust proxy", 1)` is required for Render's load balancer layer.
- CORS allowlist in `server/index.ts` reads from the `FRONTEND_URL` env var (comma-separated) and has hardcoded entries for known production domains (`bookmyslot.dental.mossaic.in`, `book-my-slot-client.onrender.com`).

### Node Version
- Pinned to **Node 20.20.0** via `.node-version` in the repo root.
- Do not remove or change this file — Render, nvm, and Volta all respect it.
- The `package-lock.json` was generated with npm 10.8.2 (ships with Node 20). Using Node 22+ causes `npm install` to fail on Render with "Exit handler never called".

### Build Notes
- `npm run build` runs `script/build.ts`: (1) Vite build → `dist/public`, (2) esbuild bundles Express → `dist/index.cjs`.
- `sourcemap: false` in `vite.config.ts` — disabled to prevent OOM on Render during the Vite bundle step (ClinicDashboard.tsx alone is 400KB+).
- `manualChunks` in `vite.config.ts` splits vendor libraries into 4 separate chunks (`react-core`, `lucide`, `ui-vendor`, `vendor`) to reduce peak Rollup memory during bundling. Without this, Render's heap is exhausted processing 3800+ lucide-react icon files in a single pass.
- All Replit-specific plugins (`runtimeErrorOverlay`, `cartographer`, `devBanner`) are now guarded by `REPL_ID !== undefined` so they never load on Render's build environment.
- If the Render build still OOMs after these changes, add `NODE_OPTIONS=--max-old-space-size=4096` as an Environment Variable in the Render dashboard (applies to the build command automatically).
- If the Render build fails with "Exit handler never called" during `npm install`, clear the Render build cache: Dashboard → service → Manual Deploy → "Clear build cache & deploy".

### Render Build Commands Reference

| Service | Build Command | Start Command | Publish Directory |
|---|---|---|---|
| **Backend** | `npm install --include=dev && npm run db:push && npm run build` | `npm run start` | N/A |
| **Frontend** | `npm install && npm run build` | N/A | `dist/public` |

> **Note on the backend build:** The existing backend command includes `npm run build` followed by `npx tsx script/build.ts`. Since `npm run build` already runs `tsx script/build.ts`, the second `npx tsx` call rebuilds the same output twice. The first build is sufficient — `npm run build` alone handles both the frontend Vite build and the backend esbuild bundle. This is harmless but adds 25–30 seconds per deploy.

---

## Mandatory Coding Rules

This project runs on **Replit as the AI development environment** but is tested locally and deployed to **Render as a split frontend + backend**. Every agent working in this repo must follow these rules on every change — without being asked.

### 1. Never use bare `/api/...` fetch paths
Always use `apiRequest()` from `@/lib/queryClient` or prefix with the `API_BASE_URL` constant. Bare paths break when frontend and backend are on different domains.

```ts
// WRONG — breaks on local and Render where origins differ
fetch('/api/auth/clinic/bookings')

// CORRECT
import { apiRequest } from '@/lib/queryClient';
apiRequest('GET', '/api/auth/clinic/bookings');
```

### 2. Never hardcode `localhost`, `127.0.0.1`, or port numbers
All cross-service URLs must come from environment variables (`VITE_API_URL`, `PORT`, etc.).

### 3. New frontend env vars must be prefixed `VITE_`
Non-`VITE_` vars are stripped at Vite build time and will silently be `undefined` in the browser. Call out every new `VITE_*` var so the developer can add it to Render's **Static Site** environment settings.

### 4. Call out new backend env vars explicitly
The developer must add them manually to the Render **Web Service** environment settings. Never assume they are automatically available.

### 5. Call out new DB tables or columns with the exact SQL
The schema auto-sync in `server/index.ts` runs on Replit startup only — it does **not** run on Render's Postgres automatically. Always provide the exact `ALTER TABLE` or `CREATE TABLE` SQL so the developer can run it on the Render database.

### 6. New allowed frontend domains go in the CORS allowlist
If a new Render frontend URL is introduced, add it to the `FRONTEND_ORIGINS` array in `server/index.ts`, or document that the `FRONTEND_URL` env var on the Render backend service must be updated.

### 7. Auth is dual-mode — both paths must always work
- **Replit**: Replit OIDC (`passport-openidconnect`)
- **Local + Render**: `ADMIN_EMAIL` / `ADMIN_PASSWORD` env vars + session-based auth

Never assume Replit OIDC is the only auth mechanism. Every new auth-gated feature must work with both paths.

### 8. After installing any package in Replit, always run `npm run fix-lockfile`

Replit routes all npm downloads through an internal proxy (`package-firewall.replit.local`) and writes that hostname as the `"resolved"` URL in `package-lock.json`. That host is unreachable outside Replit — Render's `npm install` step will fail with `ENOTFOUND package-firewall.replit.local`.

**Every time any package is installed inside Replit**, run this before finishing:
```bash
npm run fix-lockfile
```

This replaces the Replit-internal URLs with the real public npm registry URL (`https://registry.npmjs.org/`). It is a no-op if no Replit URLs are present, so it is always safe to run.

```bash
# WRONG — commit after npm install without sanitising
npm install some-package
git add package-lock.json  # ← contains replit.local URLs → Render build breaks

# CORRECT
npm install some-package
npm run fix-lockfile        # ← sanitises package-lock.json
git add package-lock.json  # ← safe to commit
```

### CORS & Session Cookie Setup (already configured — do not break)
- `sameSite: "none"` + `secure: true` in production enables cross-origin session cookies between the Render frontend and backend.
- `app.set("trust proxy", 1)` is required for Render's load balancer layer.
- The CORS allowlist in `server/index.ts` reads from the `FRONTEND_URL` env var (comma-separated) and has hardcoded entries for known domains. Keep this pattern when adding domains.

---

## Application Startup & Loading Workflow

### Server Boot Sequence (`server/index.ts`)

```text
1. dotenv.config() — loads env vars
2. Create Express + HTTP server
3. trust proxy = 1 (required for Render)
4. Session setup — PostgreSQL-backed store (connect-pg-simple)
   cookie: sameSite=none, secure=true, maxAge=30 days, rolling=true
5. CORS middleware — FRONTEND_ORIGINS + FRONTEND_URL env var
6. Body parsing — express.json() with rawBody capture
7. Request logging — redacts "token" fields
8. DB schema sync — ~20 CREATE TABLE / ALTER TABLE / column-add checks
   - Also: patient backfill, FK drops, session table check
9. Seed module — creates demo clinic + doctor if not present
10. Register API routes
11. API 404 handler (returns JSON)
12. IF production: serveStatic() — dist/public with SPA fallback
    IF development: setupVite() — Vite dev server in middleware mode
13. Global error handler
14. Listen on port 5000
```

### Client Loading Sequence

```text
1. index.html — loads 40+ Google Fonts in <head> (blocking, only Sora used)
2. main.tsx — createRoot().render(<App />)
3. App.tsx:
   - QueryClientProvider (staleTime: Infinity, no refetch on focus)
   - ThemeProvider (system default)
   - TooltipProvider (700ms delay)
   - ErrorBoundary (single global boundary)
   - AppLayout:
     * Header (auth + notifications)
     * NetworkStatusBanner (online/offline listeners)
     * Router (renders route)
     * HealthIndicator (30s poll)
     * Toaster
```

### Auth State — Three Independent Systems

| Hook | Endpoint | StaleTime | Fires On |
|---|---|---|---|
| `useAuth` | `GET /api/auth/user` | 5 min | Every page load |
| `useClinicAuth` | `GET /api/auth/clinic/me` | 5 min | Every page load |
| `useDoctorAuth` | `GET /api/auth/doctor/me` | 5 min | Only DoctorDashboard |

### QueryClient Defaults

```ts
{
  refetchInterval: false,
  refetchOnWindowFocus: false,
  staleTime: Infinity,
  retry: false,
}
```

- No automatic refetching. No retry on network errors.
- Data is cached forever unless explicitly invalidated.
- Only `useNotifications` and `HealthIndicator` use `refetchInterval: 30000`.

### What to Consider When Loading

1. **No lazy loading** — `App.tsx` eagerly imports all 15 pages. ClinicDashboard.tsx is 6,699 lines. All imports parse at bundle load.
2. **Google Fonts block first paint** — 40+ families loaded in `<head>`, only Sora is used.
3. **HealthIndicator polls on all routes** — even the landing page, even for non-logged-in users.
4. **Notification polling fires on every page** — `Header` always mounts, always polls.
5. **Dashboard queries are ungated on mount** — ClinicDashboard fires 4+ queries on login regardless of active panel.
6. **No code splitting** — No `React.lazy()`, no preloading, no route splitting. 3MB JS bundle loads on first visit.

### Key Takeaways for Agents

| Concern | What to do |
|---|---|
| Adding a new page | Add `import` in `App.tsx` and `Route` in `Router`. Consider if it needs `React.lazy()`. |
| Adding a new panel to ClinicDashboard | Imports go to the top of the file — another module loaded at parse time. |
| Adding new queries | Gate them on `activePanel` or `activeTab` to avoid firing on every login. |
| Adding new env vars | Frontend → `VITE_` prefix. Backend → call out explicitly. |
| Changing session config | `sameSite: "none"` + `secure: true` + `trust proxy: 1` are required for cross-origin Render. |
| Changing font loading | `Sora` is the primary font. Consider `font-display: swap` if adding more. |

---

## ⚠️ Production Bundle: TDZ (Temporal Dead Zone) Rule

**Background:** Vite/Rollup chunks all ClinicDashboard-related code into a single JS file for production. If the same type or `const` is exported from **more than one file** in that chunk, Rollup must rename one of them during minification. The renaming can produce a `ReferenceError: Cannot access 'X' before initialization` at runtime — even though development (with unminified, individually-loaded modules) works perfectly fine.

**Known instance (fixed):** `BookingWithSlot` was defined in three places simultaneously:
- `client/src/lib/clinic-constants.tsx` ← canonical source of truth
- `client/src/components/AppointmentCard.tsx` ← was a duplicate interface (removed)
- `client/src/components/ExportDataPanel.tsx` ← was a local type alias (removed)

The production symptom was `ReferenceError: Cannot access 'It' before initialization` when opening the patient-search dropdown in the Bookings panel.

### Rules every agent must follow

1. **Single source of truth for shared types.** All shared frontend types (`BookingWithSlot`, `SlotTiming`, `SectionConfig`, `DayConfig`, etc.) live in `client/src/lib/clinic-constants.tsx`. Never redefine them locally in a component file — always `import type { ... } from "@/lib/clinic-constants"`.

2. **No duplicate exports across files in the same chunk.** Before adding a new exported `const` or `interface` to any component under `client/src/components/` or `client/src/pages/`, search the repo first: `grep -rn "export.*YourName" client/src/`. If it already exists elsewhere, import it instead.

3. **Test production builds locally before shipping UI changes.** Run `npm run build` and open `dist/public` to confirm no chunk errors. Development `npm run dev` will NOT catch TDZ issues — they only appear in minified bundles.

4. **`as any` casts on shared types are a smell.** If you find yourself casting a typed booking object with `(b as any).someField`, that field should be added to the canonical `BookingWithSlot` type in `clinic-constants.tsx`, not worked around with a cast.
