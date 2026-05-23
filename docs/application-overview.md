# BookMySlot — Application Overview
## Context Document for AI Assistants and New Team Members

---

> **How to use this document:**
> Share this file with any AI assistant before asking for feedback, code review, feature suggestions, or architecture analysis. It gives the AI full context about what BookMySlot is, who uses it, what each role can do, and what is not yet built.

---

## 1. What is BookMySlot?

BookMySlot is a **multi-tenant dental clinic appointment management platform** built for the Indian healthcare market. It allows dental clinics to manage their availability, receive patient bookings, and handle the full patient journey — from first booking to digital consent and clinical records — through a single web application.

It is **not** a generic booking tool. It is designed specifically for dental clinics and includes healthcare-specific features such as clinical records, doctor approval workflows, digital consent forms, and prescription management.

**Key characteristics:**
- All pricing is in Indian Rupees (₹)
- The platform charges clinics a monthly or annual subscription (not patients)
- Patients do not need to create an account — they use email OTP verification per booking
- The platform is multi-tenant — one installation serves many independent clinics
- Deployed on Render (backend + frontend) with Supabase PostgreSQL as the database

---

## 2. The Four Roles

| Role | Who they are in real life | How they access the app |
|---|---|---|
| **Super Admin** | The platform operator — the person who runs BookMySlot as a business | Logs in at `/admin` with email + password set in environment variables |
| **Clinic Admin** | A clinic owner, manager, or front-desk receptionist | Logs in at `/clinic-login` → "Clinic Admin" tab, with username + password assigned by Super Admin |
| **Doctor** | A dentist or specialist working at one or more clinics | Logs in at `/clinic-login` → "Doctor" tab, with email + password (set during invite acceptance) |
| **Patient** | Any person booking an appointment | No login — uses email OTP verification per booking session |

Each role sees a completely different interface with different permissions. There is no shared dashboard.

---

## 3. Super Admin — Full Capabilities

The Super Admin manages the entire platform. There is only one Super Admin account (credentials set via environment variables).

### Access
- Login page: `/admin`
- Credentials: `ADMIN_EMAIL` and `ADMIN_PASSWORD` environment variables
- On Replit: uses Replit OIDC authentication instead (first login claims superuser status)

### Clinic Management
The admin dashboard has three tabs:

**Active Clinics tab:**
- View all approved and active clinics
- See each clinic's subscription status badge (Subscribed / Payment Pending) and plan (Starter / Growth / Pro)
- **Archive** a clinic (hides it from operations, clinic can no longer log in)
- **Reset credentials** — set a new username and/or password for any clinic
- **Mark as Paid** — manually activate a clinic's subscription (used when payment is made outside Razorpay, or for testing)
- **Resend activation link** — regenerate and email a new payment activation link

**Pending Registrations tab:**
- View clinics that have self-registered but not yet been approved
- Each pending clinic card shows:
  - Clinic name, city, email, phone
  - Trust Score (0–100) — automatically calculated from what the clinic submitted:
    - Clinic name → +7 points
    - Address/city → +7 points
    - Pincode → +6 points
    - Valid 10-digit Indian phone → +30 points
    - Professional email (non-Gmail/Yahoo) → +15 points; free email → +10 points
    - Medical licence uploaded → +15 points
    - Clinic registration certificate uploaded → +10 points
    - Google Business URL → +15 points
    - GST number → +10 points
  - Which trust checks passed and which flags were raised (duplicate phone, free email, missing documents)
- Admin can **override the plan and billing cycle** before approving
- Three actions: **Approve**, **Flag for Review**, **Reject**
- Approving triggers: auto-generate username + password → create Razorpay subscription → generate activation token → send approval email with credentials and payment link

**Archived Clinics tab:**
- View all archived clinics
- **Restore** an archived clinic back to active status

### Smile Deals Management
- Create, edit, and delete promotional dental deals shown on the public `/smile-deals` page
- Fields per deal: title, description, image, price (₹), original price (for "Save ₹X" badge), booking link, category, subcategory (procedure type), start date, expiry date, YouTube/Vimeo/mp4 video URL
- Toggle a deal as **Featured** (shown as cinematic hero card) or **Flash** (shown in horizontal scroll strip)
- Image upload via Cloudflare R2

---

## 4. Clinic Admin — Full Capabilities

Each clinic has one admin login (username + password). This is typically used by the clinic owner or front-desk staff.

### Access
- Login page: `/clinic-login` → "Clinic Admin" tab
- Dashboard: `/clinic-dashboard`
- Credentials set by Super Admin at approval time; can be reset by Super Admin

### Appointment Management (Bookings)

The main dashboard shows all bookings for the clinic, with filters by date and status.

Each booking card shows:
- Patient name, phone, email, reason for visit
- Assigned doctor (if any) and their approval status
- Current clinical status
- Payment status and amount (if applicable)
- Digital consent status

**Actions available on each booking:**
- **Confirm** — mark a pending booking as confirmed (triggers confirmation email to patient)
- **Cancel** — cancel a booking (triggers cancellation email)
- **Reschedule** — move a booking to a different time slot
- **Assign Doctor** — assign one of the clinic's doctors to a booking
- **Update Clinical Status** — set the patient's visit status (e.g. Attended, No-Show, Completed)
- **Add Internal Notes** — write notes visible only to clinic staff and the assigned doctor
- **Request Digital Consent** — sends a WhatsApp link to the patient's phone; shows "Signed ✓" badge once the patient signs

### Slot Configuration
- Create available appointment slots with:
  - Start time and end time
  - Maximum number of simultaneous bookings per slot (default: 3)
- Slots appear on the public booking page for patients to choose from
- Cancelled slots are hidden from patients

### Doctor Roster Management
- **Invite a doctor** by email — sends a tokenised invitation link (valid 72 hours) to the doctor's email
- The doctor clicks the link, sets their password, and their account is created
- **Remove a doctor** from the clinic roster
- View all doctors currently linked to the clinic

### Clinical Records
- Create a clinical record linked to any booking
- Fields: patient name, phone, treating doctor, diagnosis (multiple entries), prescription text, clinical notes
- Edit or soft-delete existing records
- Records are linked to the booking they belong to

### Digital Consent Forms
- Click "Request →" on any booking card
- The system generates a 72-hour token and sends a WhatsApp message (via Twilio) to the patient with a signing link
- The clinic sees the consent URL and can copy it or open it directly
- Once the patient signs, the booking card shows a green "Signed ✓" badge
- The signature (drawn on a canvas), timestamp, and patient's IP address are all stored

### Data Export
- Export bookings as an **XLSX spreadsheet** with customisable scope (date range, booking status)
- Export history is logged — clinic can see previous exports with filename, format, date, and record count

### Inventory Management
A full stock management system for dental supplies and equipment:

**Categories:** Group items by department (e.g. Sterilisation, Restorative, Equipment)

**Items** have three tracking types:
- **Consumable** — tracked by quantity, with reorder level and critical level thresholds
- **Equipment** — tracked with warranty expiry and next service date
- **Asset** — tracked with purchase and depreciation records

**Stock transactions:** Record every stock movement (received, used, adjusted, disposed) with reason and performer name

**Alerts:**
- Reorder alert — when quantity falls to or below the reorder level
- Critical alert — when quantity falls to or below the critical level
- Expiry alert — when an item is approaching its expiry date
- Alerts can be dismissed individually

### Subscription Status
- If subscription is unpaid (payment not yet completed), an amber warning banner appears at the top of the dashboard
- Clinic can still access the dashboard — they are not locked out while pending payment
- Banner disappears once the subscription is activated

### Profile Management
- Update clinic name, address, city, pincode, phone, website
- Upload clinic logo (via Cloudflare R2 signed URL)
- Add/remove doctors from the quick-reference doctor list (legacy JSONB field, separate from full doctor accounts)
- View Google Business URL, GST number, and uploaded documents

---

## 5. Doctor — Full Capabilities

Each doctor has an independent account (email + password) that can be linked to one or more clinics. They log in through the same login page as clinic admins but on a separate tab.

### Access
- Login page: `/clinic-login` → "Doctor" tab
- Dashboard: `/doctor-dashboard`
- Account created via clinic invitation email (tokenised link)
- Forgot password: email-based reset

### Appointment View
- Sees only bookings that have been **assigned to them** by a clinic admin
- Bookings are grouped by clinic (a doctor can work at multiple clinics)
- Filters by date and status

### Booking Actions
- **Approve** an assigned booking — marks the doctor as ready to see the patient
- **Decline** an assigned booking — removes the assignment (clinic admin is notified)
- **Add clinical notes** — internal notes visible to the clinic
- **Update clinical status** — mark as Completed, No-Show, etc.

### Profile Management
Doctors have a detailed public-facing profile:

| Field | Notes |
|---|---|
| Full name | Required |
| Specialization | e.g. Orthodontics, Periodontics |
| Degree(s) | e.g. BDS, MDS |
| College | Where they studied |
| Years of experience | Integer |
| Languages spoken | Multi-select: English, Malayalam, Tamil, Hindi, Kannada |
| Bio | Free text |
| Profile photo | Uploaded via Cloudflare R2 |

A **profile completeness bar** (0–100%) is shown to encourage doctors to fill in all fields.

### Certifications
Doctors can add multiple certifications, each with:
- Title
- Issuing organisation
- Year
- Description
- Certificate image (optional)

### Case Studies
Doctors can add patient case studies (anonymised) to showcase their work:
- Title
- Description
- Tags (e.g. Braces, Implants, Whitening)
- Media images (uploaded via R2)

### Leave Management
- Mark specific dates as leave days
- Patients cannot be assigned to a doctor who is on leave for that date
- The clinic admin can view all leave dates across all their doctors

### Public Profile
- Each doctor has a public profile page at `/doctor/:id`
- Visible to anyone — no login required
- Shows: photo, bio, specialization, degree, college, experience, languages, certifications, case studies

---

## 6. Patient / Public — Full Capabilities

Patients do not have accounts. Every booking session starts fresh with an email OTP verification. This prevents spam and fake bookings while keeping the flow frictionless.

### Booking Flow (Step by Step)

1. **Visit `/book`** — the public booking page
2. **Choose a clinic** from the list of available clinics
3. **Enter email address** — a 6-digit OTP is sent to that email
4. **Verify OTP** — must be entered before available slots are shown
5. **Select a time slot** — available slots are shown for the chosen clinic
6. **Fill in booking details:**
   - Full name (required)
   - Phone number (required)
   - Reason for visit / description (optional)
7. **Optional: Pay online** — if the clinic has payment enabled, a Razorpay payment popup opens before confirming the booking
8. **Booking confirmed** — a confirmation email is sent; a WhatsApp message is also sent if Twilio is configured

### After Booking
- Receives a **confirmation email** with appointment details (via Resend)
- Receives a **WhatsApp notification** (via Twilio, if enabled)
- May receive a **digital consent request** via WhatsApp — a link to sign a consent form on their phone
  - Visits `/consent/:token` (no login required)
  - Reads the consent declaration text
  - Signs using finger (touchscreen) or mouse on a signature canvas
  - Submits — signature, timestamp, and IP address are stored; clinic sees "Signed ✓"

### Email OTP Details
- OTP is valid for a limited time window
- Once verified, the verified session is held via a short-lived token
- The token is consumed when the booking is submitted — cannot be reused

---

## 7. Public Pages (No Login Required)

These pages are accessible to anyone without any authentication.

| Page | URL | Description |
|---|---|---|
| Landing | `/` | Homepage with product overview |
| Book an Appointment | `/book` | Choose a clinic and book a slot (OTP required) |
| Clinic About | `/clinic/:id` | Public profile page for a specific clinic |
| Doctor Profile | `/doctor/:id` | Public profile for a specific doctor |
| Smile Deals | `/smile-deals` | Promotional dental deals gallery |
| Pricing | `/pricing` | Subscription plans and feature comparison |
| Register Clinic | `/register-clinic` | Self-registration form for clinics |
| Consent Form | `/consent/:token` | Digital consent signing page (accessed via WhatsApp link) |
| Activate Subscription | `/activate/:token` | Clinic payment page (accessed via approval email link) |

---

## 8. Smile Deals — Public Gallery

The Smile Deals page (`/smile-deals`) is a standalone promotional gallery managed entirely by the Super Admin.

**Design:** Full dark theme, animated ambient orbs, Sora font.

**Layout sections:**
- **Stats row:** Active deals count, average patient saving (computed from original price − current price), total views
- **Featured hero card:** Cinematic side-by-side layout; supports autoplay video (YouTube/Vimeo/mp4)
- **Flash Deals strip:** Horizontal scroll for deals marked as "flash" — time-sensitive offers
- **Countdown timer card:** Auto-shown for any deal expiring within 72 hours
- **Main grid:** 3-column tilt cards with magnetic hover effect
- **Filter pills:** Filter by procedure type (Cleaning, Whitening, Braces, Implants, etc.) — driven by the `subcategory` field
- **Bottom promo:** "Refer a Clinic" section + "Loyalty Rewards — Coming Soon"

**Analytics:** Every deal tracks `viewCount` (page impressions) and `clickCount` (booking link clicks) automatically.

---

## 9. Booking Lifecycle

A booking passes through these states from creation to completion:

```
Slot created by clinic
        ↓
Patient verifies email via OTP
        ↓
Patient submits booking → status: PENDING
        ↓
[Optional] Patient pays online → paymentStatus: PAID
        ↓
Clinic admin confirms booking → status: CONFIRMED
  (confirmation email sent to patient)
        ↓
Clinic admin assigns a doctor → assignedDoctor set
        ↓
Doctor approves booking → doctorApprovalStatus: APPROVED
   OR
Doctor declines → doctor assignment removed, back to unassigned
        ↓
[Optional] Clinic requests digital consent → WhatsApp sent
Patient signs consent form → consentSignature saved
        ↓
Patient attends appointment → clinicalStatus: COMPLETED
        ↓
[Optional] Clinic creates clinical record → diagnosis, prescription, notes stored
```

**Booking status values:** `pending`, `confirmed`, `cancelled`
**Doctor approval status values:** `pending`, `approved`, `declined`
**Clinical status values:** Set as free text by clinic/doctor (e.g. Completed, No-Show, Rescheduled)
**Payment status values:** `pending`, `paid`, `failed`

---

## 10. Subscription & Billing Model

Clinics pay a recurring subscription to use the platform. Patients are not charged by the platform (though clinics can optionally charge patients per booking via Razorpay).

### Plans

| Plan | Monthly | Annual | Monthly bookings | Doctors |
|---|---|---|---|---|
| **Starter** | ₹999/mo | ₹9,990/yr | Up to 30 | 1 doctor |
| **Growth** | ₹1,599/mo | ₹15,990/yr | Up to 150 | Up to 3 doctors |
| **Pro** | ₹2,999/mo | ₹29,990/yr | Unlimited | Unlimited |

### Subscription States

| State | Meaning |
|---|---|
| `unpaid` | Clinic approved but payment not yet completed. Amber banner shown on their dashboard. Access not blocked. |
| `active` | Payment received via Razorpay or manually marked by admin. Full access, no banner. |
| `expired` | Placeholder — subscription lapsed. Not yet enforced (reserved for future). |

### Payment Flow
1. Super Admin approves clinic → Razorpay subscription created → activation token generated (7-day expiry)
2. Clinic receives approval email with credentials + "Activate Now & Pay" link
3. Clinic visits `/activate/:token` → Razorpay payment popup opens on the page
4. On successful payment → Razorpay sends webhook → subscription status set to `active`
5. Admin can also use "Mark as Paid" button to manually activate without going through Razorpay

---

## 11. Notifications

### Email (via Resend)
| Trigger | Recipient |
|---|---|
| Patient books a slot | Patient (confirmation) |
| Clinic confirms a booking | Patient (confirmation update) |
| Clinic cancels a booking | Patient (cancellation) |
| Super Admin approves a clinic | Clinic (credentials + payment link) |
| Clinic invites a doctor | Doctor (invitation link) |

In `DEV` mode (default): all emails are redirected to the admin's test inbox regardless of recipient.
In `PRODUCTION` mode: emails go to the actual recipient.

### WhatsApp (via Twilio)
| Trigger | Recipient |
|---|---|
| Patient books a slot | Patient (booking confirmation) |
| Clinic requests digital consent | Patient (consent signing link) |

### In-App Notifications (Real-Time WebSocket)
- A notification bell icon is shown in the header to Clinic Admins, Doctors, and the Super Admin
- When a patient makes a booking, a notification is instantly pushed to the clinic admin's browser via WebSocket — no page refresh needed
- Notifications are also stored in the `notifications` database table for persistence (survives page reloads)
- Each notification can be marked as read individually
- A 30-second polling fallback runs alongside the WebSocket in case the connection drops
- A toast alert also appears when a new booking arrives, even if the bell dropdown is closed
- For full technical details see `docs/notification-service.md`

---

## 12. Integrations

| Service | Provider | Purpose | Required? |
|---|---|---|---|
| **PostgreSQL Database** | Supabase | All application data storage | Required |
| **Email** | Resend | Booking confirmations, clinic approvals, doctor invitations | Optional (app works without it, but no emails sent) |
| **WhatsApp Messaging** | Twilio | Booking notifications, digital consent links | Optional |
| **Payments** | Razorpay | Patient-to-clinic booking payments, clinic subscription billing | Optional (app works without it) |
| **Image Storage** | Cloudflare R2 | Clinic logos, doctor photos, certifications, deal images | Optional (image upload disabled if not set) |
| **Auth (Replit only)** | Replit OIDC | Super Admin authentication when running on Replit | Automatic on Replit |

---

## 13. Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui (Radix UI), TanStack Query v5 |
| Routing | Wouter (lightweight React router) |
| Backend | Node.js, Express.js, TypeScript |
| ORM | Drizzle ORM |
| Database | PostgreSQL (Supabase hosted, Singapore region) |
| Session store | PostgreSQL via `connect-pg-simple` |
| Auth | Passport.js Local strategy (external) or Replit OIDC |
| Build | Vite (frontend), esbuild (backend) |
| Deployment | Render (backend Web Service + frontend Static Site) |

---

## 14. Database Tables

A quick reference for AI analysis of the data model:

| Table | Purpose |
|---|---|
| `clinics` | Clinic profiles, credentials, subscription status, trust score |
| `doctors` | Doctor accounts, profile, credentials |
| `clinic_doctors` | Join table — which doctors belong to which clinics |
| `doctor_invites` | Tokenised invitation links sent to doctors (72h expiry) |
| `doctor_certifications` | Certifications linked to a doctor |
| `doctor_cases` | Case studies linked to a doctor |
| `doctor_leaves` | Leave dates marked by doctors |
| `slots` | Available appointment time windows created by clinics |
| `bookings` | Patient appointment records linked to slots |
| `booking_notes` | Internal notes on bookings (by clinic or doctor) |
| `clinical_records` | Post-visit records: diagnosis, prescription, notes |
| `consent_tokens` | Digital consent tokens linked to bookings (72h expiry) |
| `activation_tokens` | Subscription activation tokens sent in approval emails (7-day expiry) |
| `email_otps` | Email OTP tokens for patient identity verification |
| `notifications` | In-app notification records for Replit users |
| `smile_deals` | Promotional deals managed by Super Admin |
| `inventory_categories` | Inventory groupings per clinic |
| `inventory_items` | Stock items (consumables, equipment, assets) |
| `stock_transactions` | Every stock movement log |
| `stock_alerts` | Low-stock and expiry alerts |
| `export_history` | Log of XLSX exports by clinic |
| `patients` | Patient records linked to doctors/clinics |
| `site_settings` | Key-value settings for the platform |
| `session` | Server-side session store (managed by express-session) |

---

## 15. What is NOT Yet Built

These are features that are **planned or partially stubbed** but not yet functional. An AI assistant should not assume they exist.

| Feature | Status |
|---|---|
| Subscription expiry enforcement | Schema has `expired` status but it is never set automatically |
| Advanced analytics dashboard | Basic plan includes "Basic analytics" but no analytics UI is built |
| Patient login / patient portal | Patients have no account — no history, no login |
| SMS notifications | Only WhatsApp via Twilio; no plain SMS |
| Multi-language interface | App is English-only; doctor profiles support multiple spoken languages |
| Clinic-to-clinic referrals | Mentioned in Smile Deals promo section but not built |
| Loyalty rewards | "Coming Soon" placeholder in Smile Deals page |
| Doctor availability calendar | Doctors can mark leave, but there is no visual calendar for patients |
| Slot booking via clinic's own website (widget) | Not built |
| Mobile app | Web only — no React Native or mobile app exists |

---

## 16. URL Reference

| URL | Who uses it | What it is |
|---|---|---|
| `/` | Anyone | Landing page |
| `/admin` | Super Admin | Admin dashboard (manage clinics, Smile Deals) |
| `/clinic-login` | Clinic Admin, Doctor | Login page with two tabs |
| `/clinic-dashboard` | Clinic Admin | Main clinic management dashboard |
| `/doctor-dashboard` | Doctor | Doctor's appointment and profile dashboard |
| `/book` | Patient | Public booking flow |
| `/smile-deals` | Anyone | Promotional deals gallery |
| `/pricing` | Anyone | Subscription plans |
| `/register-clinic` | New clinics | Self-registration form |
| `/clinic/:id` | Anyone | Public clinic profile |
| `/doctor/:id` | Anyone | Public doctor profile |
| `/consent/:token` | Patient | Digital consent signing (via WhatsApp link) |
| `/activate/:token` | Clinic | Subscription payment (via approval email link) |
| `/reset-password` | Clinic Admin, Doctor | Password reset (via email link) |

---

---

## 17. API Architecture & Frontend Integration

This section is specifically for AI agents and developers who need to write, modify, or debug code. It explains how APIs are structured and how the frontend communicates with the backend.

### The Shared Contract (`shared/routes.ts`)

`shared/routes.ts` is the single source of truth for all API paths, HTTP methods, and Zod response schemas. Both the backend and frontend import from it.

```typescript
// Example shape of an entry in shared/routes.ts
api.notifications.list = {
  path: "/api/notifications",
  method: "GET",
  responses: { 200: z.array(notificationSchema) }
}
```

**Why this matters for AI agents:** When adding a new endpoint, define it in `shared/routes.ts` first. The frontend query key should always be `api.<feature>.<action>.path` — this guarantees cache invalidation works correctly.

### Backend Pattern: How Routes Are Written

All API routes live in `server/routes.ts` inside the `registerRoutes(httpServer, app)` function. The pattern is:

```
1. Middleware guard (isAdmin / isClinicAuthenticated / isAuthenticated)
2. Parse and validate request body with Zod schema (from shared/schema.ts via drizzle-zod)
3. Call a method on the `storage` interface (never query the DB directly from a route)
4. Return JSON response
```

The `storage` interface is defined in `server/storage.ts` (`IStorage`) and implemented by `DatabaseStorage`. All database logic lives there, keeping routes thin and testable.

**Three authentication middlewares:**
| Middleware | What it checks | Used for |
|---|---|---|
| `isAuthenticated` | `req.session.adminLoggedIn` OR `req.session.clinicId` OR `req.session.doctorId` OR Replit OIDC | General auth guard |
| `isAdmin` | `sess.adminLoggedIn && sess.role === "superuser"` | Super Admin only routes |
| `isClinicAuthenticated` (inline) | `sess.clinicId` | Clinic Admin only routes |

Session data available after login:
- Clinic Admin: `sess.clinicId` (number), `sess.adminLoggedIn = true`
- Doctor: `sess.doctorId` (number), `sess.doctorEmail` (string), `sess.doctorLoggedIn = true`
- Super Admin: `sess.adminLoggedIn = true`, `sess.role = "superuser"`, `sess.adminEmail`

### Frontend Data Fetching: TanStack Query v5

All data fetching uses TanStack Query. The `queryClient` in `client/src/lib/queryClient.ts` has a default `queryFn` that:
- Prepends `API_BASE_URL` to the query key path
- Automatically includes `credentials: "include"` (sends session cookies)
- Throws on non-2xx responses (triggers React Query error state)

**Fetching data:**
```typescript
// Queries should NOT define their own queryFn — the default handles it
const { data } = useQuery({
  queryKey: [api.notifications.list.path],  // path is the cache key
});
```

**Mutating data:**
```typescript
import { apiRequest, queryClient } from "@/lib/queryClient";

const mutation = useMutation({
  mutationFn: () => apiRequest("POST", "/api/some/endpoint", { body }),
  onSuccess: () => {
    // Always invalidate the affected query key after a mutation
    queryClient.invalidateQueries({ queryKey: ["/api/some/endpoint"] });
  },
});
```

**`API_BASE_URL`:**
- Development: empty string (same-origin, Vite proxies to Express on port 5000)
- Production on Render: the backend URL set via `VITE_API_URL` environment variable
- Never hardcode a port or hostname in frontend API calls — always use relative paths or `API_BASE_URL`

### Forms

All forms use `react-hook-form` via shadcn's `useForm` hook with `zodResolver` for validation. The schema passed to `zodResolver` should come from `shared/schema.ts` (the `insert*Schema` exports). Use `.extend()` to add frontend-only rules (e.g. password confirmation).

### Environment Variables

**Backend (set in Render / `.env` locally):**
| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (Supabase) |
| `SESSION_SECRET` | Signing key for session cookies |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Super Admin credentials |
| `RESEND_API_KEY` | Email sending |
| `RESEND` | `PRODUCTION` or `DEV` (default: DEV, redirects all mail to test inbox) |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_WHATSAPP_FROM` | WhatsApp |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET_NAME` / `R2_ENDPOINT` / `R2_PUBLIC_URL` | Cloudflare R2 image storage |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Payments |
| `PORT` | Server port (Render sets this automatically; default 5000 locally) |

**Frontend (prefix with `VITE_` to expose to browser):**
| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Backend URL in production (leave empty in dev) |
| `VITE_SENTRY_DSN` | Sentry error tracking (production only) |
| `VITE_RAZORPAY_KEY_ID` | Razorpay public key for frontend checkout |

---

## 18. Complete API Endpoint Reference

All endpoints are in `server/routes.ts`. Auth column shows which session field must be present.

### Public / Patient (no login required)

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/clinics/register` | None | Clinic self-registration with trust score calculation |
| `POST` | `/api/public/otp/send` | None | Send 6-digit email OTP to patient or clinic |
| `POST` | `/api/public/otp/verify` | None | Verify OTP and return a short-lived `verifiedToken` |
| `GET` | `/api/public/clinics` | None | List all active, approved clinics |
| `GET` | `/api/public/clinic/:id` | None | Single clinic profile (public fields only) |
| `POST` | `/api/public/slot-availability` | None | Check how many bookings exist for each requested time slot |
| `POST` | `/api/public/bookings` | `verifiedToken` in body | Create a patient booking (consumes OTP token) |
| `GET` | `/api/public/doctors/:id` | None | Public doctor profile |
| `POST` | `/api/public/razorpay/create-order` | None | Create Razorpay order for a booking payment |
| `POST` | `/api/public/razorpay/verify-payment` | None | Verify Razorpay payment signature and confirm booking |
| `GET` | `/api/consent/:token` | None | Fetch consent form data for patient signing page |
| `POST` | `/api/consent/:token/sign` | None | Submit patient signature and store it |
| `GET` | `/api/activate/:token` | None | Fetch activation details for subscription payment page |
| `POST` | `/api/activate/:token/pay` | None | Process Razorpay subscription payment |
| `GET` | `/api/health` | None | Backend health check (used by header status indicator) |
| `GET` | `/api/health/backend` | None | Backend-only liveness probe |
| `GET` | `/api/health/database` | None | Database connectivity probe |

### Clinic Admin

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/clinic/login` | None | Clinic admin login (username + password) |
| `POST` | `/api/auth/clinic/logout` | `clinicId` | Log out clinic admin session |
| `GET` | `/api/auth/clinic/me` | `clinicId` | Current clinic admin session info |
| `PATCH` | `/api/auth/clinic/profile` | `clinicId` | Update clinic profile (name, address, logo, etc.) |
| `PATCH` | `/api/auth/clinic/website-config` | `clinicId` | Update clinic's public page theme and content |
| `GET` | `/api/auth/clinic/bookings` | `clinicId` | List all bookings for the clinic |
| `PATCH` | `/api/auth/clinic/bookings/:id/confirm` | `clinicId` | Confirm a pending booking |
| `PATCH` | `/api/auth/clinic/bookings/:id/cancel` | `clinicId` | Cancel a booking |
| `PATCH` | `/api/auth/clinic/bookings/:id/assign-doctor` | `clinicId` | Assign a doctor to a booking |
| `PATCH` | `/api/auth/clinic/bookings/:id/clinical-status` | `clinicId` | Update clinical status (Completed, No-Show, etc.) |
| `POST` | `/api/auth/clinic/bookings/:id/request-consent` | `clinicId` | Generate consent token and send WhatsApp link |
| `GET` | `/api/auth/clinic/slots` | `clinicId` | List clinic's appointment slots |
| `POST` | `/api/auth/clinic/slots` | `clinicId` | Create a new appointment slot |
| `DELETE` | `/api/auth/clinic/slots/:id` | `clinicId` | Delete a slot |
| `GET` | `/api/auth/clinic/doctors` | `clinicId` | List doctors linked to the clinic |
| `POST` | `/api/auth/clinic/invite-doctor` | `clinicId` | Send doctor invitation email |
| `DELETE` | `/api/auth/clinic/doctors/:id` | `clinicId` | Remove a doctor from the clinic |
| `GET` | `/api/auth/clinic/clinical-records` | `clinicId` | List clinical records |
| `POST` | `/api/auth/clinic/clinical-records` | `clinicId` | Create a clinical record |
| `PATCH` | `/api/auth/clinic/clinical-records/:id` | `clinicId` | Update a clinical record |
| `DELETE` | `/api/auth/clinic/clinical-records/:id` | `clinicId` | Soft-delete a clinical record |
| `GET` | `/api/auth/clinic/export` | `clinicId` | Export bookings as XLSX |
| `GET` | `/api/clinic/inventory/categories` | `clinicId` | List inventory categories |
| `POST` | `/api/clinic/inventory/categories` | `clinicId` | Create inventory category |
| `GET` | `/api/clinic/inventory/items` | `clinicId` | List inventory items |
| `POST` | `/api/clinic/inventory/items` | `clinicId` | Create inventory item |
| `PATCH` | `/api/clinic/inventory/items/:id` | `clinicId` | Update inventory item |
| `POST` | `/api/clinic/inventory/transactions` | `clinicId` | Record a stock movement |
| `GET` | `/api/clinic/inventory/alerts` | `clinicId` | List stock and expiry alerts |
| `PATCH` | `/api/clinic/inventory/alerts/:id/dismiss` | `clinicId` | Dismiss an alert |
| `GET` | `/api/auth/clinic/patients` | `clinicId` | List patients linked to the clinic |

### Doctor

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/doctor/login` | None | Doctor login (email + password) |
| `POST` | `/api/auth/doctor/logout` | `doctorId` | Log out doctor session |
| `GET` | `/api/auth/doctor/me` | `doctorId` | Current doctor session info |
| `PATCH` | `/api/doctor/profile` | `doctorId` | Update doctor profile (bio, photo, experience, etc.) |
| `GET` | `/api/doctor/bookings` | `doctorId` | List bookings assigned to this doctor |
| `PATCH` | `/api/doctor/bookings/:id/notes` | `doctorId` | Add/update clinical notes on a booking |
| `PATCH` | `/api/doctor/bookings/:id/approve` | `doctorId` | Approve an assigned booking |
| `PATCH` | `/api/doctor/bookings/:id/decline` | `doctorId` | Decline an assigned booking |
| `GET` | `/api/doctor/leaves` | `doctorId` | List leave dates |
| `POST` | `/api/doctor/leaves` | `doctorId` | Add a leave date |
| `DELETE` | `/api/doctor/leaves/:id` | `doctorId` | Remove a leave date |
| `GET` | `/api/doctor/certifications` | `doctorId` | List certifications |
| `POST` | `/api/doctor/certifications` | `doctorId` | Add a certification |
| `DELETE` | `/api/doctor/certifications/:id` | `doctorId` | Remove a certification |
| `GET` | `/api/doctor/cases` | `doctorId` | List case studies |
| `POST` | `/api/doctor/cases` | `doctorId` | Add a case study |
| `DELETE` | `/api/doctor/cases/:id` | `doctorId` | Remove a case study |
| `POST` | `/api/auth/doctor/accept-invite` | None | Accept invite token and set password |
| `POST` | `/api/auth/doctor/forgot-password` | None | Request password reset email |
| `POST` | `/api/auth/doctor/reset-password` | None | Set new password via reset token |

### Super Admin

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/admin/login` | None | Admin login (email + password, triggers OTP) |
| `POST` | `/api/auth/admin/verify-otp` | None | Verify admin OTP and create session |
| `POST` | `/api/auth/admin/logout` | `superuser` | Log out admin session |
| `GET` | `/api/clinics` | `superuser` | List all clinics (active, pending, archived) |
| `PATCH` | `/api/clinics/:id/approve` | `superuser` | Approve a clinic (generate credentials, send email) |
| `PATCH` | `/api/clinics/:id/reject` | `superuser` | Reject a clinic registration |
| `PATCH` | `/api/clinics/:id/archive` | `superuser` | Archive a clinic |
| `PATCH` | `/api/clinics/:id/restore` | `superuser` | Restore an archived clinic |
| `POST` | `/api/clinics/:id/reset-credentials` | `superuser` | Reset clinic username/password |
| `PATCH` | `/api/clinics/:id/mark-paid` | `superuser` | Manually activate a clinic's subscription |
| `POST` | `/api/clinics/:id/resend-activation` | `superuser` | Regenerate and resend activation email |
| `GET` | `/api/auth/admin/login-events` | `superuser` | Audit log of admin logins |
| `GET` | `/api/admin/smile-deals` | `superuser` | List all Smile Deals |
| `POST` | `/api/admin/smile-deals` | `superuser` | Create a new Smile Deal |
| `PATCH` | `/api/admin/smile-deals/:id` | `superuser` | Update a Smile Deal |
| `DELETE` | `/api/admin/smile-deals/:id` | `superuser` | Delete a Smile Deal |

### Notifications & WebSocket

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/notifications` | Session (any role) | List notifications for the current user |
| `PATCH` | `/api/notifications/:id/read` | Session (any role) | Mark a notification as read |
| `WS` | `/ws/notifications` | Client sends `{type:"auth",clinicId:N}` after connect | Real-time push channel for clinic admins |

### File Uploads

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/uploads/signed-url` | Session | Request a pre-signed Cloudflare R2 upload URL |

---

*Last updated: May 2026*
*This document reflects the current state of the application. For setup instructions, see `docs/local-development-setup.md`. For deployment, see `docs/render-environment-setup.md`. For the real-time notification system, see `docs/notification-service.md`.*
