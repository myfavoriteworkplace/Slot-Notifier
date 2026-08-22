# BookMySlot — API Reference & Integration Guide

> **Purpose of this document:** A complete reference of every API endpoint in the system — what it does, who can call it, and how the frontend invokes it. Read this before adding any new API route or frontend fetch call.

---

## Production Deployment Architecture

BookMySlot is deployed on **Render** as two separate services:

| Service | Render Type | URL |
|---|---|---|
| `Book-My-Slot-1` | Web Service (Node.js backend) | `https://book-my-slot-1.onrender.com` |
| `Book-My-Slot-Client` | Static Site (React frontend CDN) | `https://bookmyslot.dental.mossaic.in` (custom domain) |

Because they are on **different domains**, every API call from the frontend is a cross-origin request. This has two important implications:

1. **`VITE_API_URL` must be set** on the Render Static Site (`Book-My-Slot-Client`) environment variables:
   ```
   VITE_API_URL=https://book-my-slot-1.onrender.com
   ```
   This is baked into the frontend bundle at build time. After changing it, Render automatically rebuilds the frontend. Without it, `API_BASE_URL` is empty and every API call hits the frontend CDN instead of the backend — nothing works.

2. **`FRONTEND_URL` must include the custom domain** on the backend service (`Book-My-Slot-1`) environment variables:
   ```
   FRONTEND_URL=https://book-my-slot-client.onrender.com,https://bookmyslot.dental.mossaic.in
   ```
   The backend uses this for CORS headers. Without it, the browser blocks cross-origin requests.

3. **Cookies require `sameSite: "none"; Secure`** in production because the frontend and backend are on different domains. This is already set in `server/index.ts` based on `NODE_ENV=production`.

### How the Static Site handles routing

`client/public/_redirects` contains:
```
/* /index.html 200
```
This means every path on the frontend CDN — including `/api/*` — returns the React HTML page. If any frontend code makes a bare `fetch("/api/...")` call without `API_BASE_URL`, the CDN catches it and returns HTML instead of JSON, which causes a silent parse failure.

---

## How APIs Are Called From the Frontend

All API calls must go through one of two helpers in `client/src/lib/queryClient.ts`. Never use a bare `fetch()` directly to an `/api/` path.

### `apiRequest(method, path, data?)` — mutations and manual fetches
```ts
import { apiRequest } from "@/lib/queryClient";
const res = await apiRequest("POST", "/api/public/bookings", payload);
const data = await res.json();
```
- Automatically prepends `API_BASE_URL` (set via `VITE_API_URL` on Render)
- Automatically includes `credentials: "include"` (required for cross-origin session cookies)
- Returns a raw `Response` — call `.json()` or `.ok` yourself
- Use for: mutations, one-off fetches, GET calls that are not driven by React Query

### `getQueryFn` via `useQuery` — data fetching with React Query caching
```ts
useQuery({ queryKey: ["/api/auth/clinic/bookings"] })
```
- The `queryKey[0]` string is the path — automatically prepended with `API_BASE_URL`
- Includes `credentials: "include"` automatically
- Use for: any data that should be cached, refetched, or invalidated

### Raw `fetch()` with `API_BASE_URL` — legacy pattern, avoid for new code
```ts
import { API_BASE_URL } from "@/lib/queryClient";
const res = await fetch(`${API_BASE_URL}/api/consent/${token}`);
```
Used in a small number of existing places (ConsentForm, ClinicAbout, Dashboard, Header, NetworkStatusBanner). Must always manually include `credentials: "include"` for authenticated calls. Prefer `apiRequest()` for new code.

### Golden Rule for New Endpoints
> Always use `apiRequest()` or `useQuery`. **Never write `fetch("/api/...")` with a bare relative path.** In production, bare relative paths resolve against the frontend CDN domain, not the backend — the CDN returns HTML and the call silently fails.

---

## Authentication System

### How Sessions Work

BookMySlot uses **Express session-based authentication** (`express-session` + `connect-pg-simple`). No JWT tokens. Session data is stored in the `session` table in PostgreSQL (Supabase).

After a successful login, the server sets flags on `req.session`:

| Session flag | Set by | Meaning |
|---|---|---|
| `sess.adminLoggedIn = true` | Super Admin login OR clinic admin login | User is authenticated |
| `sess.doctorLoggedIn = true` | Doctor login | Doctor is authenticated |
| `sess.role = "superuser"` | Super Admin login | User is super admin |
| `sess.role = "owner"` | Clinic admin login | User is a clinic admin |
| `sess.role = "doctor"` | Doctor login | User is a doctor |
| `sess.clinicId` | Clinic admin login | The clinic this session belongs to |
| `sess.doctorId` / `sess.doctorEmail` | Doctor login | The doctor this session belongs to |

### Auth Middleware

Two middleware functions guard routes:

#### `isAuthenticated`
```ts
// Passes for: super admin, clinic admin, doctor
sess.adminLoggedIn || sess.doctorLoggedIn
```
Used on most protected routes. The route body then further checks `sess.clinicId`, `sess.role`, or `sess.doctorId` to scope data to the right account.

#### `isAdmin`
```ts
// Passes for: super admin only
sess.adminLoggedIn && sess.role === "superuser"
```
Used only on super admin management routes (approve clinic, manage Smile Deals, etc.).

### Internal Session Checks — `clinicSession()` Helper

Several route groups (inventory, billing, patients, analytics, clinical records) use a `clinicSession()` helper instead of `isAuthenticated` middleware. This is **intentional** — not a bug:

```ts
function clinicSession(req) {
  const loggedIn = !!(sess?.adminLoggedIn || (sess?.clinicId && sess?.role === 'owner'));
  return { clinicId, loggedIn };
}
```

This helper deliberately **excludes doctors** — a doctor session would be rejected. This is the correct behaviour because doctors should not be able to see a clinic's billing data, inventory, or patient list. The `isAuthenticated` middleware would pass doctors through, which would be wrong for these routes.

Clinical record write routes (POST/PATCH/DELETE) go further — they only allow `doctorLoggedIn`, blocking clinic admins from writing clinical records directly.

In short: these routes are protected and correctly scoped. They just use a more granular check than the general `isAuthenticated` middleware.

### Cookie Requirements in Production
Cookies are `sameSite: "none"; Secure` in production (when `NODE_ENV=production`) because the frontend and backend are on different Render domains. This requires HTTPS on both sides. The `FRONTEND_URL` env var on the backend must list all frontend origins for CORS to allow credentials.

---

## Route Categories

| Prefix | Who uses it |
|---|---|
| `/api/public/*` | Anyone — no login required |
| `/api/auth/clinic/*` | Clinic admin (session-based) |
| `/api/auth/doctor/*` | Doctor (session-based) |
| `/api/auth/admin/*` | Super admin (session-based) |
| `/api/auth/*` (shared) | Login/logout/reset — no prior auth needed |
| `/api/admin/*` | Super admin only (`isAdmin`) |
| `/api/clinic/*` | Clinic admin — `clinicSession()` check inside handler |
| `/api/doctor/*` | Doctor — session checked inside handler |
| `/api/clinics/*` | Mixed — some public, some `isAdmin` |
| `/api/consent/*` | Public — token-based, no session |
| `/api/clinical-records/*` | Clinic/doctor — session checked inside handler |
| `/api/booking/*` | Clinic/doctor — `isAuthenticated` |
| `/api/smile-deals/*` | Public reads, `isAdmin` writes |
| `/api/health/*` | Public — infrastructure checks |
| `/api/webhooks/*` | External services — no session auth |

---

## Complete API Endpoint List

---

### 1. Public — No Authentication Required

These endpoints are open to anyone. No session or token needed.

---

#### `GET /api/public/clinics`
**Purpose:** Returns the list of all active, approved clinics for the public booking page.
**Auth:** None
**Called by:** `Book.tsx` — clinic picker dropdown
**Returns:** Array of `{ id, name, city, ... }`

---

#### `POST /api/public/otp/send`
**Purpose:** Sends a 6-digit OTP email to a patient before they can see slots or book.
**Auth:** None
**Body:** `{ email, purpose }` — purpose is `"booking"` or `"supplier-listing"`
**Called by:** `Book.tsx` → `apiRequest`, `SmileDeals.tsx` → `apiRequest`
**Note:** OTP stored in `email_otps` table with expiry. Delivery via Resend.

---

#### `POST /api/public/otp/verify`
**Purpose:** Verifies the 6-digit OTP. Returns a short-lived token used to authorise the booking submission.
**Auth:** None
**Body:** `{ email, code, purpose }`
**Called by:** `Book.tsx` → `apiRequest`, `SmileDeals.tsx` → `apiRequest`
**Returns:** `{ verified: true, token }` — token is consumed on booking submit

---

#### `POST /api/public/bookings`
**Purpose:** Submits a new patient booking. OTP-verified token from above must be included.
**Auth:** None (OTP token required in body)
**Body:** `{ slotId, clinicId, name, phone, email, description, otpToken, ... }`
**Called by:** `Book.tsx` → `apiRequest`
**Side effects:** Sends confirmation email (Resend), WhatsApp notification (Twilio), creates in-app notification for clinic

---

#### `GET /api/public/patients-by-email`
**Purpose:** Looks up existing patient profiles for a given email at a specific clinic. Used to pre-fill the booking form with previously saved details.
**Auth:** None
**Query params:** `email`, `clinicId`
**Called by:** `Book.tsx` → `apiRequest` (after OTP verified)
**Returns:** Array of patient profile objects

---

#### `GET /api/public/patient-lookup`
**Purpose:** Legacy patient lookup by email across all clinics.
**Auth:** None
**Query params:** `email`
**Called by:** Not actively used in current frontend — kept for backwards compatibility

---

#### `POST /api/public/slot-availability`
**Purpose:** Returns which slots are available (not fully booked) for a clinic given a list of slot IDs.
**Auth:** None
**Body:** `{ clinicId, slots: slotId[] }`
**Called by:** `Book.tsx` → `apiRequest`, `ClinicDashboard.tsx` → `apiRequest`

---

#### `GET /api/public/clinic-availability`
**Purpose:** Returns all open slots for a clinic on a given date.
**Auth:** None
**Query params:** `clinicId`, `date`
**Called by:** `Book.tsx` → `apiRequest`
**Returns:** Array of available slot windows with times and remaining capacity

---

#### `GET /api/public/doctor/:id`
**Purpose:** Returns a doctor's full public profile (bio, specialization, certifications, case studies, languages).
**Auth:** None
**Called by:** `DoctorPublicProfile.tsx` → `useQuery`

---

#### `POST /api/public/supplier-listing-request/submit`
**Purpose:** Submits a supplier listing enquiry from the Smile Deals page (requires email OTP verification first).
**Auth:** None (OTP token required in body)
**Body:** `{ email, businessName, phone, category, notes, otpToken }`
**Called by:** `SmileDeals.tsx` → `apiRequest`

---

#### `POST /api/public/uploads/signed-url`
**Purpose:** Generates a Cloudflare R2 signed upload URL for public-facing uploads (e.g. supplier listing images).
**Auth:** None
**Body:** `{ folder, fileName, contentType }`
**Called by:** Not yet connected to frontend — available for future use

---

#### `POST /api/public/razorpay/create-order`
**Purpose:** Creates a Razorpay payment order for a patient-to-clinic booking payment.
**Auth:** None
**Body:** `{ clinicId, amount, currency, bookingId }`
**Called by:** `Book.tsx` → `apiRequest`

---

#### `POST /api/public/razorpay/verify-payment`
**Purpose:** Verifies the Razorpay payment signature after the patient completes payment.
**Auth:** None
**Body:** `{ razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingId }`
**Called by:** `Book.tsx` → `apiRequest`

---

#### `GET /api/clinics/:id/public`
**Purpose:** Returns a clinic's public profile page data (name, address, doctors, about text, logo).
**Auth:** None
**Called by:** `ClinicAbout.tsx` → raw `fetch` with `API_BASE_URL`

---

#### `GET /api/smile-deals`
**Purpose:** Returns all active, published Smile Deals for the public gallery.
**Auth:** None
**Called by:** `SmileDeals.tsx` → `useQuery`

---

#### `POST /api/smile-deals/:id/view`
**Purpose:** Increments the `viewCount` analytics counter for a deal.
**Auth:** None
**Called by:** `SmileDeals.tsx` → `apiRequest` (silently on card render)

---

#### `POST /api/smile-deals/:id/click`
**Purpose:** Increments the `clickCount` analytics counter for a deal.
**Auth:** None
**Called by:** `SmileDeals.tsx` → `apiRequest` (silently on booking link click)

---

#### `GET /api/consent/:token`
**Purpose:** Returns the consent form data for a patient to review and sign. Token sent via WhatsApp.
**Auth:** None (token-based, 72-hour expiry)
**Called by:** `ConsentForm.tsx` → raw `fetch` with `API_BASE_URL`

---

#### `POST /api/consent/:token/sign`
**Purpose:** Submits the patient's drawn signature. Stores base64 image, timestamp, and patient IP in the booking record.
**Auth:** None (token-based)
**Body:** `{ signature }` — base64 canvas image
**Called by:** `ConsentForm.tsx` → raw `fetch` with `API_BASE_URL`

---

#### `GET /api/activate/:token`
**Purpose:** Validates a clinic's subscription activation token and returns Razorpay subscription details to open the payment popup. Token emailed to clinics after Super Admin approval (7-day expiry).
**Auth:** None (token-based)
**Called by:** `Activate.tsx` → `apiRequest`

---

#### `GET /api/site-settings/:key`
**Purpose:** Returns a single platform-level setting value.
**Auth:** None
**Called by:** Not actively used in current frontend

---

#### `GET /api/health` / `GET /api/health/backend` / `GET /api/health/database`
**Purpose:** Infrastructure health checks. Render uses `/api/health` to verify the server is alive.
**Auth:** None
**Called by:** `Header.tsx`, `NetworkStatusBanner.tsx` → raw `fetch` with `API_BASE_URL`

---

#### `GET /api/notifications` and `PATCH /api/notifications/read-all`
**Purpose:** Returns notifications list / marks all as read. Session-scoped inside handler — returns empty array if no valid session.
**Auth:** None enforced at middleware level; session-scoped internally
**Called by:** `use-notifications.ts` → raw `fetch` with `API_BASE_URL`

---

#### `POST /api/clinics/register`
**Purpose:** Self-registration form for new clinics. Creates clinic in `pending` state for Super Admin review.
**Auth:** None
**Body:** Full clinic registration object including trust-score fields and document URLs
**Called by:** `RegisterClinic.tsx` → `apiRequest`

---

### 2. Authentication — Login / Logout / Password

No prior authentication required. These establish or destroy sessions.

---

#### `POST /api/auth/clinic/login`
**Purpose:** Logs in a clinic admin with username + password.
**Auth:** None (credentials in body)
**Body:** `{ username, password }`
**Called by:** `use-clinic-auth.ts` → raw `fetch` with `API_BASE_URL`
**Session set:** `adminLoggedIn=true`, `role="owner"`, `clinicId`

---

#### `POST /api/auth/doctor/login`
**Purpose:** Logs in a doctor with email + password.
**Auth:** None (credentials in body)
**Body:** `{ email, password }`
**Called by:** `use-doctor-auth.ts` → raw `fetch` with `API_BASE_URL`
**Session set:** `doctorLoggedIn=true`, `role="doctor"`, `doctorId`, `doctorEmail`

---

#### `POST /api/auth/admin/login`
**Purpose:** First step of Super Admin login — verifies email + password, sends OTP to admin email.
**Auth:** None (credentials in body)
**Called by:** `use-auth.ts` → raw `fetch` with `API_BASE_URL`

---

#### `POST /api/auth/admin/verify-otp`
**Purpose:** Second step of Super Admin login — submits OTP to complete authentication.
**Auth:** None (OTP in body)
**Session set:** `adminLoggedIn=true`, `role="superuser"`
**Called by:** `use-auth.ts` → raw `fetch` with `API_BASE_URL`

---

#### `POST /api/auth/admin/logout`
**Purpose:** Destroys the super admin session.
**Called by:** `use-auth.ts` → raw `fetch` with `API_BASE_URL`

---

#### `POST /api/auth/doctor/logout`
**Purpose:** Destroys the doctor session.
**Called by:** `use-doctor-auth.ts` → raw `fetch` with `API_BASE_URL`

---

#### `POST /api/auth/clinic/forgot-password`
**Purpose:** Sends a password reset email to a clinic admin's registered email.
**Body:** `{ username }` or `{ email }`
**Called by:** `ClinicLogin.tsx` → raw `fetch`

---

#### `POST /api/auth/doctor/forgot-password`
**Purpose:** Sends a password reset email to a doctor.
**Body:** `{ email }`
**Called by:** `ClinicLogin.tsx` → raw `fetch`

---

#### `POST /api/auth/reset-password`
**Purpose:** Resets a password using a token from the forgot-password email.
**Auth:** None (token in body)
**Body:** `{ token, type, newPassword }`
**Called by:** `ResetPassword.tsx` → `apiRequest`

---

#### `GET /api/auth/user`
**Purpose:** Returns the current super admin session user. Returns `null` if not logged in.
**Auth:** None enforced
**Called by:** `use-auth.ts` → `useQuery`

---

#### `GET /api/auth/clinic/me`
**Purpose:** Returns the currently logged-in clinic's details. Returns 401 if no clinic session.
**Auth:** Session checked inside handler
**Called by:** `use-clinic-auth.ts` → raw `fetch` with `API_BASE_URL`

---

#### `GET /api/auth/doctor/me`
**Purpose:** Returns the currently logged-in doctor's profile. Returns 401 if no doctor session.
**Auth:** Session checked inside handler
**Called by:** `use-doctor-auth.ts` → raw `fetch` with `API_BASE_URL`

---

#### `POST /api/auth/doctor/change-password`
**Purpose:** Logged-in doctor changes their own password.
**Auth:** `doctorLoggedIn` session check inside handler
**Body:** `{ currentPassword, newPassword }`
**Called by:** `DoctorDashboard.tsx` → `apiRequest`

---

#### `GET /api/auth/admin/login-events`
**Purpose:** Returns the last 20 super admin login events (timestamp, IP, user-agent).
**Auth:** `isAuthenticated`
**Called by:** `Admin.tsx` → `useQuery`

---

### 3. Super Admin Only (`isAdmin` middleware)

Requires `sess.adminLoggedIn && sess.role === "superuser"`.

---

#### `PATCH /api/clinics/:id/approve`
**Purpose:** Approves a pending clinic. Triggers: generate credentials → create Razorpay subscription → generate activation token → send approval email.
**Auth:** `isAdmin`
**Called by:** `Admin.tsx` → `apiRequest`

---

#### `PATCH /api/clinics/:id/reject`
**Purpose:** Rejects a pending clinic registration.
**Auth:** `isAdmin`
**Called by:** `Admin.tsx` → `apiRequest`

---

#### `PATCH /api/clinics/:id/mark-paid`
**Purpose:** Manually activates a clinic's subscription without Razorpay.
**Auth:** `isAdmin`
**Called by:** `Admin.tsx` → `apiRequest`

---

#### `PATCH /api/clinics/:id/archive` / `PATCH /api/clinics/:id/unarchive`
**Purpose:** Archive or restore a clinic.
**Auth:** `isAdmin`
**Called by:** `Admin.tsx` → `apiRequest`

---

#### `PATCH /api/clinics/:id/credentials`
**Purpose:** Resets a clinic admin's username and/or password.
**Auth:** `isAdmin`
**Body:** `{ username?, password? }`
**Called by:** `Admin.tsx` → `apiRequest`

---

#### `GET /api/clinics/:id/activation-link`
**Purpose:** Regenerates and resends the subscription activation link to a clinic.
**Auth:** `isAdmin`
**Called by:** `Admin.tsx` → `apiRequest`

---

#### `POST /api/admin/smile-deals` / `PATCH /api/admin/smile-deals/:id` / `DELETE /api/admin/smile-deals/:id`
**Purpose:** Create, update, or delete a Smile Deal.
**Auth:** `isAdmin`
**Called by:** `Admin.tsx` → `apiRequest`

---

#### `POST /api/uploads/signed-url`
**Purpose:** Generates a Cloudflare R2 signed upload URL for authenticated users.
**Auth:** `isAuthenticated`
**Body:** `{ folder, fileName, contentType }` — folder must be whitelisted
**Called by:** `ImageUpload.tsx`, `Admin.tsx`, `DoctorDashboard.tsx` → `apiRequest`
**Flow:** Frontend gets signed URL → uploads directly to R2 → saves public URL to DB

---

### 4. Clinic Admin — `isAuthenticated` Middleware

---

#### `GET /api/clinics`
**Purpose:** All clinics list for the Super Admin dashboard.
**Auth:** `isAuthenticated`
**Called by:** `Dashboard.tsx` → raw `fetch` with `API_BASE_URL`, `Admin.tsx` → `useQuery`

---

#### `GET /api/auth/clinic/bookings`
**Purpose:** All bookings for the logged-in clinic with optional date/status filters.
**Auth:** `isAuthenticated` — `sess.clinicId` scopes to the right clinic
**Called by:** `ClinicDashboard.tsx` → `apiRequest`

---

#### `POST /api/auth/clinic/bookings`
**Purpose:** Create a booking on behalf of a patient (clinic admin flow).
**Auth:** `isAuthenticated`
**Called by:** `ClinicDashboard.tsx` → `apiRequest`

---

#### `PATCH /api/auth/clinic/bookings/:id/confirm`
**Purpose:** Confirms a pending booking. Triggers confirmation email to patient.
**Auth:** `isAuthenticated`
**Called by:** `ClinicDashboard.tsx` → `apiRequest`

---

#### `PATCH /api/auth/clinic/bookings/:id/reschedule`
**Purpose:** Moves a booking to a different slot.
**Auth:** `isAuthenticated`
**Body:** `{ newSlotId }`
**Called by:** `ClinicDashboard.tsx` → `apiRequest`

---

#### `PATCH /api/auth/clinic/bookings/:id/clinical-status`
**Purpose:** Updates the clinical status of a booking (e.g. Completed, No-Show).
**Auth:** `isAuthenticated`
**Called by:** `ClinicDashboard.tsx` → `apiRequest`

---

#### `DELETE /api/auth/clinic/bookings/:id`
**Purpose:** Cancels a booking. Triggers cancellation email to patient.
**Auth:** `isAuthenticated`
**Called by:** `ClinicDashboard.tsx` → `apiRequest`

---

#### `POST /api/auth/clinic/bookings/:id/request-consent`
**Purpose:** Generates a 72-hour consent token and sends WhatsApp link to patient for digital consent signing.
**Auth:** `sess.clinicId` check inside handler
**Called by:** `ClinicDashboard.tsx` → `apiRequest`

---

#### `GET /api/auth/clinic/patients/search`
**Purpose:** Search patients by name or phone.
**Auth:** `isAuthenticated`
**Query params:** `q`
**Called by:** `ClinicDashboard.tsx` → `apiRequest`

---

#### `POST /api/auth/clinic/slots/configure-bulk`
**Purpose:** Creates or updates multiple time slots for the clinic in one call.
**Auth:** `isAuthenticated`
**Called by:** `ClinicDashboard.tsx` → `apiRequest`

---

#### `GET /api/auth/clinic/slots/configs`
**Purpose:** Returns the clinic's slot configuration for a date range.
**Auth:** `isAuthenticated`
**Query params:** `from`, `to`
**Called by:** `ClinicDashboard.tsx` → `apiRequest`

---

#### `GET /api/auth/clinic/default-config` / `PATCH /api/auth/clinic/default-config`
**Purpose:** Get or update the clinic's default slot configuration.
**Auth:** `isAuthenticated`
**Called by:** `ClinicDashboard.tsx` → `apiRequest`

---

#### `PATCH /api/auth/clinic/me`
**Purpose:** Updates the clinic's own profile (name, address, city, logo URL, etc.).
**Auth:** `isAuthenticated`
**Called by:** `ClinicDashboard.tsx` → `apiRequest`

---

#### `PATCH /api/auth/clinic/website-config`
**Purpose:** Updates the clinic's public-facing website configuration.
**Auth:** `isAuthenticated`
**Called by:** `WebsiteConfigPanel.tsx` → `apiRequest`

---

#### `POST /api/auth/clinic/doctors` / `GET /api/auth/clinic/linked-doctors`
**Purpose:** Add doctor to clinic's roster (legacy JSONB list) / get all formally linked doctors.
**Auth:** `isAuthenticated`
**Called by:** `ClinicDashboard.tsx` → `apiRequest`

---

#### `POST /api/auth/clinic/doctors/:doctorId/reset-password`
**Purpose:** Reset a linked doctor's password.
**Auth:** `isAuthenticated`
**Called by:** `ClinicDashboard.tsx` → `apiRequest`

---

#### `DELETE /api/auth/clinic/doctors/:index`
**Purpose:** Remove a doctor from the clinic's legacy JSONB list.
**Auth:** `isAuthenticated`
**Called by:** `ClinicDashboard.tsx` → `apiRequest`

---

#### `GET /api/auth/clinic/export-history` / `POST /api/auth/clinic/export-log` / `POST /api/auth/clinic/export/xlsx`
**Purpose:** View export history / log an export / generate and download bookings as Excel.
**Auth:** `isAuthenticated`
**Called by:** `ExportDataPanel.tsx` → `apiRequest`

---

#### `PATCH /api/clinic/bookings/:id/assign-doctor`
**Purpose:** Assigns a doctor to a booking. Sends assignment notification email to doctor.
**Auth:** `isAuthenticated`
**Called by:** `ClinicDashboard.tsx` → `apiRequest`

---

#### `GET /api/booking/:id/notes` / `POST /api/booking/:id/notes`
**Purpose:** Read or add internal notes on a booking.
**Auth:** `isAuthenticated`
**Called by:** `BookingNotesThread.tsx` → `apiRequest`

---

#### `PATCH /api/notifications/:id/read`
**Purpose:** Marks a specific notification as read.
**Auth:** `isAuthenticated`
**Called by:** `use-notifications.ts` → `apiRequest`

---

### 5. Doctor — Session Checked Inside Handler (`isAuthenticated`)

---

#### `GET /api/doctor/clinics`
**Purpose:** All clinics this doctor is linked to.
**Auth:** `isAuthenticated`
**Called by:** `DoctorDashboard.tsx` → `apiRequest`

---

#### `GET /api/doctor/patients`
**Purpose:** Patients from bookings assigned to this doctor.
**Auth:** `isAuthenticated`
**Called by:** `DoctorDashboard.tsx` → `apiRequest`

---

#### `PATCH /api/doctor/profile`
**Purpose:** Update doctor's own profile (bio, photo, specialization, languages, experience).
**Auth:** `isAuthenticated`
**Called by:** `DoctorDashboard.tsx` → `apiRequest`

---

#### `GET/POST/PATCH/DELETE /api/doctor/certifications` and `/api/doctor/certifications/:id`
**Purpose:** Full CRUD for a doctor's certifications.
**Auth:** `isAuthenticated`
**Called by:** `DoctorDashboard.tsx` → `apiRequest`

---

#### `GET/POST/PATCH/DELETE /api/doctor/cases` and `/api/doctor/cases/:id`
**Purpose:** Full CRUD for a doctor's case studies.
**Auth:** `isAuthenticated`
**Called by:** `DoctorDashboard.tsx` → `apiRequest`

---

#### `GET/POST/DELETE /api/doctor/leaves` and `/api/doctor/leaves/:id`
**Purpose:** Doctor leave management — mark and delete leave dates.
**Auth:** `isAuthenticated`
**Called by:** `DoctorDashboard.tsx` → `apiRequest`

---

#### `PATCH /api/doctor/bookings/:id/approve` / `PATCH /api/doctor/bookings/:id/decline`
**Purpose:** Doctor approves or declines an assigned booking.
**Auth:** `isAuthenticated`
**Called by:** `DoctorDashboard.tsx` → `apiRequest`

---

#### `PATCH /api/doctor/bookings/:id/notes`
**Purpose:** Doctor adds clinical notes to a booking.
**Auth:** `isAuthenticated`
**Called by:** `DoctorDashboard.tsx` → `apiRequest`

---

#### `PATCH /api/doctor/bookings/:id/clinical-status`
**Purpose:** Doctor updates the clinical status of a booking.
**Auth:** `isAuthenticated`
**Called by:** `DoctorDashboard.tsx` → `apiRequest`

---

#### `GET /api/clinic/doctor-leaves` / `GET /api/clinic/doctor-leaves/all`
**Purpose:** Clinic admin views leave dates for one or all linked doctors.
**Auth:** `isAuthenticated`
**Called by:** `ClinicDashboard.tsx` → `apiRequest`

---

### 6. Clinical Records — `clinicSession` / Doctor Session Check

Write operations (POST/PATCH/DELETE) are doctor-only. Read (GET) allows clinic admin or doctor.

---

#### `GET /api/clinical-records/booking/:bookingId`
**Purpose:** All clinical records for a specific booking.
**Auth:** `doctorLoggedIn || adminLoggedIn` check inside handler
**Called by:** `ClinicalRecordsTab.tsx`, `ClinicDashboard.tsx` → `apiRequest`

---

#### `POST /api/clinical-records`
**Purpose:** Creates a clinical record (diagnosis, prescription, notes). Doctor only.
**Auth:** `doctorLoggedIn` check inside handler
**Called by:** `ClinicalRecordsTab.tsx` → `apiRequest`

---

#### `PATCH /api/clinical-records/:id` / `DELETE /api/clinical-records/:id`
**Purpose:** Update or soft-delete a clinical record. Doctor only.
**Auth:** `doctorLoggedIn` check inside handler
**Called by:** `ClinicalRecordsTab.tsx` → `apiRequest`

---

### 7. Inventory — `clinicSession()` Check (Clinic Admin Only)

All inventory routes use `clinicSession()` — clinic admins only, doctors excluded.

---

#### `GET/POST /api/clinic/inventory/categories`
**Purpose:** List or create inventory categories per clinic.
**Auth:** `clinicSession()` — clinic admin only
**Called by:** `InventoryPanel.tsx` → `apiRequest`

---

#### `GET/POST/PATCH/DELETE /api/clinic/inventory/items` and `/:id`
**Purpose:** Full CRUD for inventory items (consumables, equipment, assets).
**Auth:** `clinicSession()` — clinic admin only
**Called by:** `InventoryPanel.tsx` → `apiRequest`

---

#### `GET/POST /api/clinic/inventory/transactions`
**Purpose:** List or record a stock movement.
**Auth:** `clinicSession()` — clinic admin only
**Called by:** `InventoryPanel.tsx` → `apiRequest`

---

#### `GET /api/clinic/inventory/alerts` / `PATCH /api/clinic/inventory/alerts/:id/dismiss`
**Purpose:** List or dismiss low-stock / expiry alerts.
**Auth:** `clinicSession()` — clinic admin only
**Called by:** `InventoryPanel.tsx` → `apiRequest`

---

### 8. Billing — `clinicSession()` Check (Clinic Admin Only)

---

#### `GET /api/auth/clinic/bills`
**Purpose:** All patient bills for the clinic.
**Auth:** `clinicSession()`
**Called by:** `ClinicDashboard.tsx` → `apiRequest`

---

#### `GET /api/auth/clinic/bills/booking/:bookingId`
**Purpose:** Bill linked to a specific booking.
**Auth:** `clinicSession()`
**Called by:** `BillingHistoryPanel.tsx` → `apiRequest`

---

#### `GET /api/auth/clinic/bills/patient/:phone` / `GET /api/auth/clinic/bills/patient-by-email/:email`
**Purpose:** All bills for a patient identified by phone or email.
**Auth:** `clinicSession()`
**Called by:** `BillingHistoryPanel.tsx` → `apiRequest`

---

#### `POST /api/auth/clinic/bills` / `PATCH /api/auth/clinic/bills/:id` / `DELETE /api/auth/clinic/bills/:id`
**Purpose:** Create, update, or delete a patient bill.
**Auth:** `clinicSession()`
**Called by:** `ClinicDashboard.tsx`, `BillingHistoryPanel.tsx` → `apiRequest`

---

### 9. Patients — `clinicSession()` Check

---

#### `GET /api/auth/clinic/patients`
**Purpose:** All patient records known to the clinic.
**Auth:** `clinicSession()`
**Called by:** `ClinicDashboard.tsx` → `apiRequest`

---

#### `GET /api/auth/clinic/patients/:patientId/history`
**Purpose:** Full booking and billing history for a specific patient.
**Auth:** `clinicSession()`
**Called by:** `ClinicDashboard.tsx` → `apiRequest`

---

### 10. Analytics — `clinicSession()` Check

---

#### `GET /api/auth/clinic/analytics`
**Purpose:** Booking counts, revenue, patient totals, and booking trends for the clinic dashboard.
**Auth:** `clinicSession()`
**Query params:** `range` — `7d`, `30d`, `90d`
**Called by:** `ClinicAnalyticsPanel.tsx` → `useQuery`

---

### 11. Webhooks — External Services

Not called by the frontend. Receive callbacks from third-party systems.

---

#### `POST /api/webhooks/razorpay-subscription`
**Purpose:** Razorpay posts here when a clinic subscription payment completes. Sets clinic subscription to `active`.
**Auth:** Razorpay webhook signature verification

---

#### `GET /api/whatsapp-webhook` / `POST /api/whatsapp-webhook`
**Purpose:** WhatsApp webhook verification (GET) and inbound message handler (POST).
**Auth:** Webhook token verification

---

## Quick Auth Decision Tree for New Routes

```
Is this data anyone on the internet should see?
  YES → No auth. Use /api/public/* prefix.
  NO  → Continue...

Is this a super-admin-only action (approve clinic, manage deals)?
  YES → Use isAdmin middleware.
  NO  → Continue...

Should doctors be blocked from this? (billing, inventory, patient lists)
  YES → Use clinicSession() helper inside the handler.
        Check: if (!loggedIn || !clinicId) return res.status(401)
  NO  → Continue...

Should only doctors access this? (write clinical records)
  YES → Check sess.doctorLoggedIn inside handler.
  NO  → Continue...

Is this a general clinic admin + doctor + admin action?
  YES → Use isAuthenticated middleware.
        Scope data using sess.clinicId or sess.doctorId inside the handler.

Is this a token-based public action (consent, activation, password reset)?
  YES → No session auth. Validate token from DB, check expiry, act on it.
```

---

## Checklist for Adding a New API Route

- [ ] **Choose the right prefix** per the decision tree above
- [ ] **Add the correct auth guard** — `isAuthenticated`, `isAdmin`, `clinicSession()`, or none
- [ ] **Scope the data to the session** — read `sess.clinicId` or `sess.doctorId`; never trust IDs from the request body without verifying they match the session
- [ ] **Add to `shared/routes.ts`** if the path needs a typed constant shared with the frontend
- [ ] **Call it via `apiRequest()` or `useQuery`** on the frontend — never bare `fetch("/api/...")`
- [ ] **Document it in this file** in the correct section
- [ ] **Update `docs/render-environment-setup.md`** if the route needs a new environment variable

---

---

# Best Practices & Future Improvements

> This section documents known deviations from standard API security practices, areas of technical debt, and recommended improvements for future development. It is not a list of urgent bugs — the app works correctly in production today. It is a roadmap for hardening and scaling the API layer.

---

## Current Vulnerabilities & Non-Standard Approaches

### 1. No CSRF Protection
**What it is:** Cross-Site Request Forgery (CSRF) is an attack where a malicious website tricks a logged-in user's browser into making an authenticated request to your API.

**Current state:** The app relies on `sameSite: "none"` cookies for cross-origin session sharing, but has no CSRF token mechanism. A malicious site could theoretically trigger state-changing actions (confirm bookings, change passwords) on behalf of a logged-in clinic admin.

**Risk level:** Medium — mitigated slightly by CORS policy (`FRONTEND_URL` allowlist), but CORS alone does not prevent CSRF.

**Future fix:** Add CSRF token middleware (e.g. `csurf` or `csrf-csrf` package). Generate a token on login, store it in the session, require it as a header on all state-changing requests (`POST`, `PATCH`, `DELETE`).

---

### 2. Session Secret Fallback in Code
**What it is:** If `SESSION_SECRET` is not set as an environment variable, the app falls back to a hardcoded string `"book-my-slot-secret"` that is visible in the source code.

**Current state:** Anyone with access to the repository could forge valid session cookies if the env var is missing in production.

**Risk level:** High if the env var is ever accidentally removed from Render.

**Future fix:** Remove the fallback entirely — throw a startup error if `SESSION_SECRET` is missing. Make it a hard requirement, not a soft one.

---

### 3. No Rate Limiting on Public Endpoints
**What it is:** Public endpoints (OTP send, booking creation, clinic registration) have no rate limiting. An attacker could spam OTP sends to exhaust the Resend email quota, or flood the booking endpoint.

**Current state:** No rate limiting exists anywhere in the application.

**Risk level:** Medium — Resend quota exhaustion would silently break all email delivery for real users.

**Future fix:** Add `express-rate-limit` middleware to public endpoints. Recommended limits:
- `/api/public/otp/send` — 3 requests per IP per 10 minutes
- `/api/public/bookings` — 10 requests per IP per hour
- `/api/auth/*/login` — 5 requests per IP per 15 minutes (brute force protection)

---

### 4. No Request Body Size Limits
**What it is:** Express accepts request bodies of any size by default. A malicious request with a very large JSON body could exhaust server memory.

**Current state:** `express.json()` is configured without a size limit.

**Future fix:** Add `express.json({ limit: "1mb" })` — sufficient for all legitimate payloads in this app.

---

### 5. Inconsistent Middleware Usage (Style, Not Security)
**What it is:** Some route groups (inventory, billing, patients, analytics) use an internal `clinicSession()` helper instead of a standard middleware function. The protection is equivalent, but the pattern is inconsistent.

**Current state:** Not a security issue — all routes return 401/403 correctly for unauthenticated requests. However, it makes the codebase harder to audit quickly.

**Future fix:** Refactor to create named middleware functions for each role:
```ts
const requireClinicAdmin = (req, res, next) => { ... }
const requireDoctor = (req, res, next) => { ... }
```
Apply these at the route level for clarity. This makes security review instant — you can see the auth guard in the route definition without reading the handler body.

---

### 6. Bare `fetch()` Calls in Frontend (Partially Fixed)
**What it is:** Several frontend files used bare `fetch("/api/...")` without `API_BASE_URL`, causing calls to hit the frontend CDN instead of the backend in production.

**Current state (after fixes applied in this session):**
- ✅ `Book.tsx` — fixed (patients-by-email)
- ✅ `Activate.tsx` — fixed (subscription activation)
- ✅ `ResetPassword.tsx` — fixed (password reset)
- ✅ `SmileDeals.tsx` — fixed (supplier listing OTP + submit)

Remaining raw `fetch` with `API_BASE_URL` (not bare — these are correct but legacy):
- `ConsentForm.tsx`, `ClinicAbout.tsx`, `Dashboard.tsx`, `Header.tsx`, `NetworkStatusBanner.tsx`, `use-notifications.ts`

**Future fix:** Migrate all remaining `fetch(${API_BASE_URL}/...)` calls to `apiRequest()` for a fully consistent codebase.

---

### 7. Admin Credentials Stored as Environment Variables
**What it is:** The Super Admin email and password are stored as plain environment variables (`ADMIN_EMAIL`, `ADMIN_PASSWORD`) and compared directly in the route handler.

**Current state:** The password is compared in plaintext (or with basic hashing — not bcrypt). This means if the env var is leaked, the admin account is immediately compromised.

**Risk level:** Medium — env vars on Render are encrypted at rest, but plaintext comparison is not best practice.

**Future fix:** Hash the admin password with bcrypt at startup, store the hash in memory, and compare with `bcrypt.compare()` on login. Never compare plaintext passwords.

---

### 8. No API Versioning
**What it is:** All routes are at `/api/*` with no version prefix (e.g. `/api/v1/*`). Any breaking change to an existing endpoint immediately breaks all clients.

**Current state:** Acceptable for a single-team product with one frontend, but becomes a problem if a mobile app or third-party integration is added.

**Future fix:** When adding the first external consumer (mobile app, partner API), introduce versioning: `/api/v1/*`. Keep old routes running during a migration window.

---

### 9. Webhook Endpoints Have No Replay Protection
**What it is:** The Razorpay webhook at `/api/webhooks/razorpay-subscription` verifies the signature but does not check for duplicate delivery. If Razorpay delivers the same webhook twice, the subscription could be activated twice (idempotent in this case, but worth hardening).

**Future fix:** Store processed webhook event IDs in a `processed_webhooks` table. Reject duplicates with a 200 response (Razorpay retries on non-200).

---

### 10. No Audit Log for State-Changing Admin Actions
**What it is:** There is a `login_events` table for admin logins, but no audit trail for destructive actions: approving/rejecting clinics, archiving, resetting credentials, deleting deals.

**Current state:** If something goes wrong (e.g. a clinic is accidentally archived), there is no log of who did it or when.

**Future fix:** Add an `admin_audit_log` table. Log every `isAdmin`-guarded action with: timestamp, action type, target clinic/deal ID, and admin session identifier.

---

## Recommended Future Security Additions

| Priority | Improvement | Effort |
|---|---|---|
| 🔴 High | Remove `SESSION_SECRET` fallback — throw on missing | 1 hour |
| 🔴 High | Add bcrypt for admin password comparison | 2 hours |
| 🟡 Medium | Rate limiting on public endpoints (OTP, login, bookings) | 3 hours |
| 🟡 Medium | CSRF protection for state-changing routes | 4 hours |
| 🟡 Medium | Request body size limits | 30 minutes |
| 🟡 Medium | Standardise all route auth to named middleware | 1 day |
| 🟢 Low | Migrate remaining `fetch(${API_BASE_URL}/...)` to `apiRequest()` | 2 hours |
| 🟢 Low | Webhook replay protection | 3 hours |
| 🟢 Low | Admin audit log table | 1 day |
| 🟢 Low | API versioning (`/api/v1/`) when first external consumer added | 2 days |
| 🟢 Low | Structured error response format across all routes | 1 day |
