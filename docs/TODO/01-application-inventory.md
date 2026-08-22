# 1. Application inventory

## 1.1 Product purpose

BookMySlot is a multi-role dental clinic appointment and practice-management platform. The repository describes these primary capabilities:

- Public clinic discovery and clinic profile pages
- Patient slot discovery, OTP verification, booking, and online payment
- Clinic-owner booking operations, slot configuration, doctor assignment, consent, billing, patient directory, inventory, pharmacy, exports, analytics, and website configuration
- Doctor schedule, approval, consultation, clinical records, prescriptions, patient charting, medical history, documents, and leave management
- Superuser clinic approval, subscription administration, login-event review, and Smile DEALS management
- Digital consent through expiring tokens and WhatsApp delivery
- Email, SMS, WhatsApp, Razorpay, Cloudflare R2, and remote X-ray analysis integrations

## 1.2 Runtime architecture

| Layer | Current implementation | Primary files |
|---|---|---|
| Browser app | React 18 + TypeScript + Vite | `client/src/App.tsx`, `client/src/pages/`, `client/src/components/` |
| Styling/UI | Tailwind CSS, Radix/shadcn-style primitives, Lucide icons | `client/src/index.css`, `client/src/components/ui/` |
| Client state/data | TanStack Query v5, Wouter routing | `client/src/lib/queryClient.ts`, `client/src/hooks/` |
| HTTP server | Node.js + Express + TypeScript ESM | `server/index.ts`, `server/routes.ts` |
| Persistence | PostgreSQL through Drizzle ORM | `server/db.ts`, `server/storage.ts`, `shared/schema.ts` |
| Sessions | `express-session` with PostgreSQL session store | `server/index.ts` |
| Build | Vite client build followed by esbuild server bundle | `script/build.ts`, `vite.config.ts` |
| Replit workflow | Development on port 5000; build workflow runs `npm run build` | `.replit` |
| Deployment shape | Autoscale deployment using `npm start`; project docs describe Render frontend/backend deployment | `.replit`, `README.md` |

### Boot sequence

The documented server boot sequence is:

1. Load environment variables.
2. Create Express and HTTP server.
3. Configure proxy trust, compression, session, CORS, body parsing, and request logging.
4. Run startup database synchronization/backfill blocks.
5. Seed demo data where applicable.
6. Register API routes.
7. Install API 404 and global error handling.
8. Serve Vite in development or static files in production.
9. Listen on `PORT` (the Replit workflow uses 5000).

The startup schema synchronization in `server/index.ts` is an important operational dependency and should be treated as migration code, not as incidental application initialization.

## 1.3 Browser routes

Routes are declared in `client/src/App.tsx` using Wouter:

| Route | Surface |
|---|---|
| `/` | Landing page |
| `/getting-started` | Getting started |
| `/pricing` | Pricing |
| `/register-clinic` | Clinic registration |
| `/dashboard` | General authenticated dashboard |
| `/book`, `/book/:clinicId` | Patient booking flow |
| `/admin` | Superuser administration |
| `/clinic-login` | Clinic and doctor login entry |
| `/clinic-dashboard` | Clinic owner dashboard |
| `/clinic/:slug`, `/about` | Public clinic information |
| `/setup-password`, `/reset-password` | Credential setup/recovery |
| `/deals` | Public Smile DEALS gallery |
| `/doctor-dashboard` | Doctor dashboard |
| `/doctor/:id` | Public doctor profile |
| `/consent/:token` | Public digital consent form |
| `/activate/:token` | Clinic activation |
| fallback | Not-found page |

Large authenticated pages are lazy-loaded: `Book`, `Admin`, `ClinicDashboard`, `SmileDeals`, and `DoctorDashboard`.

## 1.4 Roles and authentication modes

The repository uses session state for multiple roles:

- `superuser`: platform administration
- `owner`: clinic staff/clinic owner
- `doctor`: doctor workspace
- `customer`: general patient/user model in shared auth types

The current server has separate login/session paths for admin, clinic, doctor, and general user behavior. The common `isAuthenticated` middleware accepts an authenticated admin or doctor session; many routes additionally inspect `role`, `clinicId`, `doctorLoggedIn`, or `doctorEmail`.

The project documentation describes dual deployment authentication:

- Replit/OIDC behavior in the Replit environment
- Passport/local credentials for local or Render-style operation

This dual-mode arrangement should be kept explicit in future changes because authorization bugs can arise when a route assumes one session shape.

## 1.5 Major frontend areas

### Clinic operations

- `ClinicDashboard.tsx`
- `BookingsPanel.tsx`
- `AppointmentCard.tsx`
- `AppointmentFilters.tsx`
- `ConfigureSlotsPanel.tsx`
- `ManageDoctorsPanel.tsx`
- `BookASlotPanel.tsx`
- `PatientDirectoryPanel.tsx`
- `BillingHistoryPanel.tsx`
- `AccountsPanel.tsx`
- `ClinicAnalyticsPanel.tsx`
- `ExportDataPanel.tsx`
- `ConsentFormPanel.tsx`
- `InventoryPanel.tsx`
- `PharmacyStockPanel.tsx`
- `ClinicStorageSettingsPanel.tsx`
- `ClinicProfilePanel.tsx`
- `WebsiteConfigPanel.tsx`

### Doctor operations

- `DoctorDashboard.tsx`
- `ClinicalRecordsTab.tsx`
- `MedicalHistoryTab.tsx`
- `OdontogramTab.tsx`
- `PatientDocumentsTab.tsx`
- `VisitTimelineTab.tsx`
- `BookingNotesThread.tsx`
- `XrayAnalysisTab.tsx`

### Patient/public surfaces

- `Book.tsx`
- `Landing.tsx`
- `ClinicAbout.tsx`
- `DoctorPublicProfile.tsx`
- `SmileDeals.tsx`
- `ConsentForm.tsx`
- `RegisterClinic.tsx`
- `Pricing.tsx`

## 1.6 Major backend areas

| Area | Files |
|---|---|
| HTTP routes and middleware | `server/routes.ts` |
| Database access and domain operations | `server/storage.ts` |
| Startup/configuration/schema sync | `server/index.ts` |
| Database connection | `server/db.ts` |
| Session/static/Vite support | `server/static.ts`, `server/vite.ts`, `server/standalone.ts` |
| Encryption | `server/encryption.ts` |
| PII access logging | `server/auditLog.middleware.ts` |
| R2 upload URLs/quota | `server/r2Client.ts`, `server/signedUrl.service.ts`, `server/storageQuota.ts` |
| Notifications | `server/sms.service.ts`, `server/twilio.service.ts`, `server/whatsapp.service.ts`, `server/meta-whatsapp.service.ts`, `server/zavu-whatsapp.service.ts` |
| AI | `server/aiService.ts` |
| Open Graph rendering | `server/og-inject.ts` |

The route file is large and contains both transport logic and some business decisions. The storage layer contains many domain queries and state transitions, but the boundary is not uniformly thin.

## 1.7 External integrations

Configured integration families include:

- PostgreSQL/Supabase or Render PostgreSQL depending on deployment
- Resend email
- Twilio SMS/WhatsApp
- Meta WhatsApp webhook
- Zavu WhatsApp SDK/service
- Razorpay orders, payment verification, subscriptions, and webhook
- Cloudflare R2 signed uploads and object management
- Remote AI/X-ray analysis service
- Google Calendar links generated in email-related server logic

Integration health and failure behavior should be documented per environment. The app generally degrades by logging or returning a user-visible error, but this behavior is not uniform across all routes.

## 1.8 Operational observations

- TanStack Query defaults disable automatic refetching, window-focus refetching, and retries. Most data remains cached until explicit invalidation.
- Notifications and health checks are exceptions with periodic polling.
- `vite.config.ts` allows hosts broadly in development. This is convenient for proxied previews but should remain development-scoped.
- The project has one Drizzle migration file plus extensive startup schema-sync SQL in `server/index.ts`.
- The current repository contains existing documentation in many domains; this audit dossier is intended to identify drift and unresolved work, not replace those documents.