# BookMySlot — API Reference & Integration Guide

> **Purpose of this document:** A complete reference of every API endpoint in the system — what it does, who can call it, and how the frontend invokes it. Read this before adding any new API route or frontend fetch call.

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
- Use for: mutations, one-off fetches, anything not driven by React Query

### `getQueryFn` via `useQuery` — data fetching with React Query caching
```ts
useQuery({ queryKey: ["/api/auth/clinic/bookings"] })
```
- The `queryKey[0]` string is the path — it is also prepended with `API_BASE_URL` automatically
- Includes `credentials: "include"` automatically
- Use for: any data that should be cached, refetched, or invalidated

### Raw `fetch()` with `API_BASE_URL` — when needed
```ts
import { API_BASE_URL } from "@/lib/queryClient";
const res = await fetch(`${API_BASE_URL}/api/consent/${token}`);
```
- Used in a few places (ConsentForm, ClinicAbout, Dashboard, Header, NetworkStatusBanner)
- Must always manually include `credentials: "include"` for any authenticated call
- Do **not** use a bare `fetch("/api/...")` without the prefix — this will hit the frontend CDN in production instead of the backend

### Golden Rule for New Endpoints
> Always use `apiRequest()` or `useQuery`. Never write `fetch("/api/...")` with a hardcoded relative path.

---

## Authentication System

### How Sessions Work

BookMySlot uses **Express session-based authentication** (`express-session` + `connect-pg-simple`). No JWT tokens. Session data is stored in the `session` table in PostgreSQL.

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
Used on most protected routes. Clinic admins, doctors, and super admins all pass this check. The route body then further checks `sess.clinicId`, `sess.role`, or `sess.doctorId` to scope data to the right account.

#### `isAdmin`
```ts
// Passes for: super admin only
sess.adminLoggedIn && sess.role === "superuser"
```
Used only on super admin management routes (approve clinic, manage Smile Deals, etc.).

### Internal Session Checks (No Middleware)

Several routes — inventory, billing, clinical records, analytics — do **not** use `isAuthenticated` middleware. Instead they read `req.session` directly inside the handler to get `clinicId` or `doctorId`. This is a known inconsistency in the codebase. These routes are effectively still protected (they return an error if the session value is missing), but they are not guarded by a standard middleware function.

### Cookie Requirements in Production
Cookies are `sameSite: "none"; Secure` in production because the frontend and backend are on different Render domains. This requires HTTPS. The `FRONTEND_URL` env var on the backend must list all frontend origins for CORS to allow credentials.

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
| `/api/clinic/*` | Clinic admin — session checked inside handler |
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
**Called by:** `Book.tsx` → `apiRequest`, `SmileDeals.tsx` → raw `fetch`
**Note:** OTP is stored in `email_otps` table with expiry. Delivery via Resend.

---

#### `POST /api/public/otp/verify`
**Purpose:** Verifies the 6-digit OTP. Returns a short-lived token used to authorise the booking submission.
**Auth:** None
**Body:** `{ email, code, purpose }`
**Called by:** `Book.tsx` → `apiRequest`, `SmileDeals.tsx` → raw `fetch`
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
**Returns:** Doctor profile data including certifications and cases

---

#### `POST /api/public/supplier-listing-request/submit`
**Purpose:** Submits a supplier listing enquiry from the Smile Deals page (requires email OTP verification first).
**Auth:** None (OTP token required in body)
**Body:** `{ email, businessName, phone, category, notes, otpToken }`
**Called by:** `SmileDeals.tsx` → raw `fetch`

---

#### `POST /api/public/uploads/signed-url`
**Purpose:** Generates a Cloudflare R2 signed upload URL for public-facing uploads (e.g. supplier listing images). Separate from the authenticated clinic upload endpoint.
**Auth:** None
**Body:** `{ folder, fileName, contentType }`
**Called by:** Not yet connected to frontend — available for future use

---

#### `POST /api/public/razorpay/create-order`
**Purpose:** Creates a Razorpay payment order for a patient-to-clinic booking payment.
**Auth:** None
**Body:** `{ clinicId, amount, currency, bookingId }`
**Called by:** `Book.tsx` → `apiRequest` (if clinic has payment enabled)

---

#### `POST /api/public/razorpay/verify-payment`
**Purpose:** Verifies the Razorpay payment signature after the patient completes payment.
**Auth:** None
**Body:** `{ razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingId }`
**Called by:** `Book.tsx` → `apiRequest` (inside Razorpay callback)

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
**Returns:** Array of deals with title, image, price, category, subcategory, video, flash/featured flags

---

#### `POST /api/smile-deals/:id/view`
**Purpose:** Increments the `viewCount` analytics counter for a deal.
**Auth:** None
**Called by:** `SmileDeals.tsx` → `apiRequest` (silently, on card render)

---

#### `POST /api/smile-deals/:id/click`
**Purpose:** Increments the `clickCount` analytics counter for a deal.
**Auth:** None
**Called by:** `SmileDeals.tsx` → `apiRequest` (silently, on booking link click)

---

#### `GET /api/consent/:token`
**Purpose:** Returns the consent form data for a patient to review and sign. Token is sent to patient via WhatsApp.
**Auth:** None (token-based, 72-hour expiry)
**Called by:** `ConsentForm.tsx` → raw `fetch` with `API_BASE_URL`
**Returns:** Booking details, clinic name, consent declaration text

---

#### `POST /api/consent/:token/sign`
**Purpose:** Submits the patient's signature. Stores signature image, timestamp, and patient IP in the booking record.
**Auth:** None (token-based)
**Body:** `{ signature }` — base64 canvas image
**Called by:** `ConsentForm.tsx` → raw `fetch` with `API_BASE_URL`

---

#### `GET /api/activate/:token`
**Purpose:** Validates a clinic's subscription activation token and loads the Razorpay payment page. Token is emailed to clinics after Super Admin approval.
**Auth:** None (token-based, 7-day expiry)
**Called by:** `Activate.tsx` → raw `fetch` with bare relative path ⚠️ (should use `API_BASE_URL`)

---

#### `GET /api/site-settings/:key`
**Purpose:** Returns a single platform-level setting value (e.g. feature flags).
**Auth:** None
**Called by:** Not actively used in current frontend

---

#### `GET /api/health`
`GET /api/health/backend`
`GET /api/health/database`
**Purpose:** Infrastructure health checks. Render uses `/api/health` to verify the server is alive.
**Auth:** None
**Called by:** `Header.tsx` and `NetworkStatusBanner.tsx` → raw `fetch` with `API_BASE_URL`

---

#### `GET /api/notifications` and `PATCH /api/notifications/read-all`
**Purpose:** Returns notifications list / marks all as read. Uses session internally but has no middleware guard — returns empty array if no valid session.
**Auth:** None enforced at middleware level; session-scoped inside handler
**Called by:** `use-notifications.ts` → raw `fetch` with `API_BASE_URL`

---

#### `GET /api/clinics/register` → `POST /api/clinics/register`
**Purpose:** Self-registration form for new clinics. Accepts all clinic profile fields plus uploaded document URLs.
**Auth:** None
**Body:** Full clinic registration object including trust-score fields
**Called by:** `RegisterClinic.tsx` → `apiRequest`
**Side effects:** Creates clinic in `pending` state; Super Admin sees it in Pending tab

---

### 2. Authentication — Login / Logout / Password

These endpoints establish or destroy sessions. No prior auth needed.

---

#### `POST /api/auth/clinic/login`
**Purpose:** Logs in a clinic admin with username + password. Creates a server session.
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
**Body:** `{ email, password }`
**Called by:** `use-auth.ts` → raw `fetch` with `API_BASE_URL`

---

#### `POST /api/auth/admin/verify-otp`
**Purpose:** Second step of Super Admin login — submits the 6-digit OTP to complete authentication.
**Auth:** None (OTP in body)
**Body:** `{ otp }`
**Called by:** `use-auth.ts` → raw `fetch` with `API_BASE_URL`
**Session set:** `adminLoggedIn=true`, `role="superuser"`

---

#### `POST /api/auth/admin/logout`
**Purpose:** Destroys the super admin session.
**Auth:** None required (session destroyed regardless)
**Called by:** `use-auth.ts` → raw `fetch` with `API_BASE_URL`

---

#### `POST /api/auth/doctor/logout`
**Purpose:** Destroys the doctor session.
**Auth:** None required
**Called by:** `use-doctor-auth.ts` → raw `fetch` with `API_BASE_URL`

---

#### `POST /api/auth/clinic/forgot-password`
**Purpose:** Sends a password reset email to a clinic admin's registered email.
**Auth:** None
**Body:** `{ username }` or `{ email }`
**Called by:** `ClinicLogin.tsx` → raw `fetch`

---

#### `POST /api/auth/doctor/forgot-password`
**Purpose:** Sends a password reset email to a doctor's email.
**Auth:** None
**Body:** `{ email }`
**Called by:** `ClinicLogin.tsx` → raw `fetch`

---

#### `POST /api/auth/reset-password`
**Purpose:** Resets a password using a token from the forgot-password email link.
**Auth:** None (token in body)
**Body:** `{ token, newPassword }`
**Called by:** `ResetPassword.tsx` → raw `fetch` with bare relative path ⚠️ (should use `API_BASE_URL`)

---

#### `GET /api/auth/user`
**Purpose:** Returns the current super admin session user (used on page load to check if admin is logged in).
**Auth:** None enforced — returns `null` if not logged in
**Called by:** `use-auth.ts` → `useQuery`

---

#### `GET /api/auth/clinic/me`
**Purpose:** Returns the currently logged-in clinic's details. Used on every page load to hydrate the clinic dashboard.
**Auth:** None enforced at middleware — session checked inside, returns 401 if no session
**Called by:** `use-clinic-auth.ts` → raw `fetch` with `API_BASE_URL`

---

#### `GET /api/auth/doctor/me`
**Purpose:** Returns the currently logged-in doctor's profile. Used on every page load to hydrate the doctor dashboard.
**Auth:** None enforced at middleware — session checked inside, returns 401 if no session
**Called by:** `use-doctor-auth.ts` → raw `fetch` with `API_BASE_URL`

---

#### `POST /api/auth/doctor/change-password`
**Purpose:** Allows a logged-in doctor to change their own password.
**Auth:** None at middleware — `doctorLoggedIn` session check inside handler
**Body:** `{ currentPassword, newPassword }`
**Called by:** `DoctorDashboard.tsx` → `apiRequest`

---

#### `POST /api/auth/admin/verify-otp` (admin OTP) and `GET /api/auth/admin/login-events`
**Purpose (login-events):** Returns the last 20 super admin login events (timestamp, IP, user-agent).
**Auth:** `isAuthenticated` (admin session)
**Called by:** `Admin.tsx` → `useQuery`

---

### 3. Super Admin Only (`isAdmin` middleware)

Routes that require `sess.adminLoggedIn && sess.role === "superuser"`.

---

#### `PATCH /api/clinics/:id/approve`
**Purpose:** Approves a pending clinic registration. Triggers: generate username + password → create Razorpay subscription → generate activation token → send approval email.
**Auth:** `isAdmin`
**Body:** Optional `{ plan, billingCycle }` override
**Called by:** `Admin.tsx` → `apiRequest`

---

#### `PATCH /api/clinics/:id/reject`
**Purpose:** Rejects a pending clinic registration.
**Auth:** `isAdmin`
**Called by:** `Admin.tsx` → `apiRequest`

---

#### `PATCH /api/clinics/:id/mark-paid`
**Purpose:** Manually activates a clinic's subscription without going through Razorpay.
**Auth:** `isAdmin`
**Called by:** `Admin.tsx` → `apiRequest`

---

#### `PATCH /api/clinics/:id/archive`
**Purpose:** Archives a clinic (hides from operations; clinic cannot log in).
**Auth:** `isAdmin`
**Called by:** `Admin.tsx` → `apiRequest`

---

#### `PATCH /api/clinics/:id/unarchive`
**Purpose:** Restores an archived clinic.
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

#### `POST /api/admin/smile-deals`
**Purpose:** Creates a new Smile Deal (promotional offer).
**Auth:** `isAdmin`
**Body:** Full deal object — title, description, imageUrl, price, originalPrice, bookingLink, category, subcategory, isFlash, isFeatured, startsAt, expiresAt, videoUrl
**Called by:** `Admin.tsx` → `apiRequest`

---

#### `PATCH /api/admin/smile-deals/:id`
**Purpose:** Updates an existing Smile Deal.
**Auth:** `isAdmin`
**Called by:** `Admin.tsx` → `apiRequest`

---

#### `DELETE /api/admin/smile-deals/:id`
**Purpose:** Deletes a Smile Deal.
**Auth:** `isAdmin`
**Called by:** `Admin.tsx` → `apiRequest`

---

#### `POST /api/admin/upload`
**Purpose:** Direct upload endpoint for admin (legacy — R2 signed URL flow is preferred).
**Auth:** `isAdmin`
**Called by:** Not used in current frontend; R2 signed URL used instead

---

### 4. Clinic Admin — `isAuthenticated` Middleware

Routes using the `isAuthenticated` middleware guard — passes for clinic admin, doctor, and superuser sessions.

---

#### `POST /api/uploads/signed-url`
**Purpose:** Generates a Cloudflare R2 signed upload URL for authenticated users (clinic logo, doctor photo, certification images, case study media, deal images).
**Auth:** `isAuthenticated`
**Body:** `{ folder, fileName, contentType }` — folder must be whitelisted (`clinic-logos`, `doctor-photos`, `certifications`, `cases`, `smile-deals`, `medical-documents`)
**Called by:** `ImageUpload.tsx` → `apiRequest`, `Admin.tsx` → `apiRequest`, `DoctorDashboard.tsx` → `apiRequest`
**Flow:** Frontend gets signed URL → uploads directly to R2 → sends public URL back to save in DB

---

#### `POST /api/clinics/:id/doctors`
**Purpose:** Invites a doctor to a clinic by email. Sends tokenised invitation link (72h expiry).
**Auth:** `isAuthenticated` (Super Admin only in practice)
**Body:** `{ email, name }`
**Called by:** `Admin.tsx` → `apiRequest`

---

#### `GET /api/clinics`
**Purpose:** Returns all clinics (active + archived) for the Super Admin dashboard.
**Auth:** `isAuthenticated` (scoped to superuser in practice)
**Called by:** `Dashboard.tsx` → raw `fetch` with `API_BASE_URL`, `Admin.tsx` → `useQuery`

---

#### `POST /api/clinics`
**Purpose:** Creates a clinic record directly (admin flow, not self-registration).
**Auth:** `isAuthenticated`
**Called by:** `Admin.tsx` → `apiRequest`

---

#### `PATCH /api/clinics/:id`
**Purpose:** Updates a clinic's profile fields.
**Auth:** `isAuthenticated`
**Called by:** `Admin.tsx` → `apiRequest`

---

#### `GET /api/auth/clinic/bookings`
**Purpose:** Returns all bookings for the logged-in clinic with optional filters (date, status).
**Auth:** `isAuthenticated` — `sess.clinicId` scopes to the right clinic
**Called by:** `ClinicDashboard.tsx` → `apiRequest`

---

#### `POST /api/auth/clinic/bookings`
**Purpose:** Creates a booking on behalf of a patient (clinic admin flow, not the public booking flow).
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
**Body:** `{ clinicalStatus }`
**Called by:** `ClinicDashboard.tsx` → `apiRequest`

---

#### `DELETE /api/auth/clinic/bookings/:id`
**Purpose:** Cancels a booking. Triggers cancellation email to patient.
**Auth:** `isAuthenticated`
**Body:** `{ reason? }`
**Called by:** `ClinicDashboard.tsx` → `apiRequest`

---

#### `POST /api/auth/clinic/bookings/:id/request-consent`
**Purpose:** Generates a 72-hour consent token and sends WhatsApp link to the patient's phone for digital consent signing.
**Auth:** None at middleware level — `sess.clinicId` checked inside handler ⚠️ (inconsistency)
**Called by:** `ClinicDashboard.tsx` → `apiRequest`

---

#### `GET /api/auth/clinic/patients/search`
**Purpose:** Searches patients by name or phone for the clinic admin's patient lookup.
**Auth:** `isAuthenticated`
**Query params:** `q` (search string)
**Called by:** `ClinicDashboard.tsx` → `apiRequest`

---

#### `POST /api/auth/clinic/slots/configure-bulk`
**Purpose:** Creates or updates multiple time slots for a clinic in one call.
**Auth:** `isAuthenticated`
**Body:** `{ slots: [{ startTime, endTime, maxBookings, ... }] }`
**Called by:** `ClinicDashboard.tsx` → `apiRequest`

---

#### `GET /api/auth/clinic/slots/configs`
**Purpose:** Returns the clinic's slot configuration for a date range.
**Auth:** `isAuthenticated`
**Query params:** `from`, `to` (date strings)
**Called by:** `ClinicDashboard.tsx` → `apiRequest`

---

#### `GET /api/auth/clinic/default-config`
`PATCH /api/auth/clinic/default-config`
**Purpose:** Get/update the clinic's default slot configuration (hours, capacity defaults).
**Auth:** `isAuthenticated`
**Called by:** `ClinicDashboard.tsx` → `apiRequest`

---

#### `PATCH /api/auth/clinic/me`
**Purpose:** Updates the clinic's own profile (name, address, city, logo URL, etc.).
**Auth:** `isAuthenticated`
**Called by:** `ClinicDashboard.tsx` → `apiRequest`

---

#### `PATCH /api/auth/clinic/website-config`
**Purpose:** Updates the clinic's public-facing website configuration fields.
**Auth:** `isAuthenticated`
**Called by:** `WebsiteConfigPanel.tsx` → `apiRequest`

---

#### `POST /api/auth/clinic/doctors`
**Purpose:** Adds a doctor to the clinic's quick-reference list (legacy JSONB field). Separate from the full doctor invite flow.
**Auth:** `isAuthenticated`
**Called by:** `ClinicDashboard.tsx` → `apiRequest`

---

#### `GET /api/auth/clinic/linked-doctors`
**Purpose:** Returns all doctors formally linked to the clinic (via `clinic_doctors` join table).
**Auth:** `isAuthenticated`
**Called by:** `ClinicDashboard.tsx` → `useQuery`

---

#### `POST /api/auth/clinic/doctors/:doctorId/reset-password`
**Purpose:** Resets a linked doctor's password (clinic admin can do this).
**Auth:** `isAuthenticated`
**Body:** `{ newPassword }`
**Called by:** `ClinicDashboard.tsx` → `apiRequest`

---

#### `DELETE /api/auth/clinic/doctors/:index`
**Purpose:** Removes a doctor from the clinic's quick-reference list (legacy JSONB, index-based).
**Auth:** `isAuthenticated`
**Called by:** `ClinicDashboard.tsx` → `apiRequest`

---

#### `GET /api/auth/clinic/export-history`
**Purpose:** Returns the clinic's past data export records.
**Auth:** `isAuthenticated`
**Called by:** `ExportDataPanel.tsx` → `useQuery`

---

#### `POST /api/auth/clinic/export-log`
**Purpose:** Logs an export action to the export history.
**Auth:** `isAuthenticated`
**Called by:** `ExportDataPanel.tsx` → `apiRequest`

---

#### `POST /api/auth/clinic/export/xlsx`
**Purpose:** Generates and downloads a booking data export as an Excel file.
**Auth:** `isAuthenticated`
**Body:** `{ scope }` — date range and filter options
**Called by:** `ExportDataPanel.tsx` → `apiRequest`

---

#### `PATCH /api/clinic/bookings/:id/assign-doctor`
**Purpose:** Assigns a doctor to a specific booking. Sends assignment notification email to the doctor.
**Auth:** `isAuthenticated`
**Body:** `{ doctorName, doctorEmail }`
**Called by:** `ClinicDashboard.tsx` → `apiRequest`

---

#### `GET /api/booking/:id/notes`
`POST /api/booking/:id/notes`
**Purpose:** Reads or adds internal notes on a booking (visible to clinic and assigned doctor).
**Auth:** `isAuthenticated`
**Called by:** `BookingNotesThread.tsx` → `apiRequest`

---

#### `PATCH /api/notifications/:id/read`
**Purpose:** Marks a specific notification as read.
**Auth:** `isAuthenticated`
**Called by:** `use-notifications.ts` → `apiRequest`

---

#### `GET /api/auth/me`
**Purpose:** Returns the current authenticated user (generic — works for admin or doctor session).
**Auth:** `isAuthenticated`
**Called by:** Not actively used in frontend (internal use)

---

### 5. Doctor — Session Checked Inside Handler

These use `isAuthenticated` middleware or an equivalent internal check.

---

#### `GET /api/doctor/clinics`
**Purpose:** Returns all clinics this doctor is linked to.
**Auth:** `isAuthenticated`
**Called by:** `DoctorDashboard.tsx` → `apiRequest`

---

#### `GET /api/doctor/patients`
**Purpose:** Returns patients from bookings assigned to this doctor.
**Auth:** `isAuthenticated`
**Called by:** `DoctorDashboard.tsx` → `apiRequest`

---

#### `PATCH /api/doctor/profile`
**Purpose:** Updates the doctor's own profile (bio, photo, specialization, languages, experience, etc.).
**Auth:** `isAuthenticated`
**Called by:** `DoctorDashboard.tsx` → `apiRequest`

---

#### `GET /api/doctor/certifications`
`POST /api/doctor/certifications`
`PATCH /api/doctor/certifications/:id`
`DELETE /api/doctor/certifications/:id`
**Purpose:** Full CRUD for a doctor's certifications.
**Auth:** `isAuthenticated`
**Called by:** `DoctorDashboard.tsx` → `apiRequest`

---

#### `GET /api/doctor/cases`
`POST /api/doctor/cases`
`PATCH /api/doctor/cases/:id`
`DELETE /api/doctor/cases/:id`
**Purpose:** Full CRUD for a doctor's case studies.
**Auth:** `isAuthenticated`
**Called by:** `DoctorDashboard.tsx` → `apiRequest`

---

#### `GET /api/doctor/leaves`
`POST /api/doctor/leaves`
`DELETE /api/doctor/leaves/:id`
**Purpose:** Doctor leave management — mark and delete leave dates.
**Auth:** `isAuthenticated`
**Called by:** `DoctorDashboard.tsx` → `apiRequest`

---

#### `PATCH /api/doctor/bookings/:id/approve`
**Purpose:** Doctor approves being assigned to a booking.
**Auth:** `isAuthenticated`
**Called by:** `DoctorDashboard.tsx` → `apiRequest`

---

#### `PATCH /api/doctor/bookings/:id/decline`
**Purpose:** Doctor declines the assignment (removes them from the booking).
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

#### `GET /api/clinic/doctor-leaves`
`GET /api/clinic/doctor-leaves/all`
**Purpose:** Clinic admin views leave dates for a specific doctor or all doctors.
**Auth:** `isAuthenticated`
**Called by:** `ClinicDashboard.tsx` → `apiRequest`

---

### 6. Clinical Records — Session Checked Inside Handler

These routes do **not** use `isAuthenticated` middleware. They check `req.session` directly inside the handler.

---

#### `GET /api/clinical-records/booking/:bookingId`
**Purpose:** Returns all clinical records for a specific booking.
**Auth:** Internal session check (clinic or doctor)
**Called by:** `ClinicalRecordsTab.tsx` → `apiRequest`, `ClinicDashboard.tsx` → `apiRequest`

---

#### `POST /api/clinical-records`
**Purpose:** Creates a new clinical record for a booking (diagnosis, prescription, notes).
**Auth:** Internal session check
**Called by:** `ClinicalRecordsTab.tsx` → `apiRequest`

---

#### `PATCH /api/clinical-records/:id`
**Purpose:** Updates an existing clinical record.
**Auth:** Internal session check
**Called by:** `ClinicalRecordsTab.tsx` → `apiRequest`

---

#### `DELETE /api/clinical-records/:id`
**Purpose:** Soft-deletes a clinical record.
**Auth:** Internal session check
**Called by:** `ClinicalRecordsTab.tsx` → `apiRequest`

---

### 7. Inventory — Session Checked Inside Handler

All inventory routes check `req.session` internally for `clinicId`. No `isAuthenticated` middleware is used.

---

#### `GET /api/clinic/inventory/categories`
`POST /api/clinic/inventory/categories`
**Purpose:** List or create inventory categories (e.g. Sterilisation, Restorative) for the clinic.
**Auth:** Internal session check (`clinicId`)
**Called by:** `InventoryPanel.tsx` → `apiRequest`

---

#### `GET /api/clinic/inventory/items`
`POST /api/clinic/inventory/items`
`PATCH /api/clinic/inventory/items/:id`
`DELETE /api/clinic/inventory/items/:id`
**Purpose:** Full CRUD for inventory items (consumables, equipment, assets).
**Auth:** Internal session check
**Called by:** `InventoryPanel.tsx` → `apiRequest`

---

#### `GET /api/clinic/inventory/transactions`
`POST /api/clinic/inventory/transactions`
**Purpose:** List or record a stock movement (received, used, adjusted, disposed).
**Auth:** Internal session check
**Called by:** `InventoryPanel.tsx` → `apiRequest`

---

#### `GET /api/clinic/inventory/alerts`
`PATCH /api/clinic/inventory/alerts/:id/dismiss`
**Purpose:** List low-stock / expiry alerts; dismiss individual alerts.
**Auth:** Internal session check
**Called by:** `InventoryPanel.tsx` → `apiRequest`

---

### 8. Billing — Session Checked Inside Handler

---

#### `GET /api/auth/clinic/bills`
**Purpose:** Returns all patient bills for the clinic.
**Auth:** Internal session check (`clinicId`)
**Called by:** `ClinicDashboard.tsx` → `apiRequest`

---

#### `GET /api/auth/clinic/bills/booking/:bookingId`
**Purpose:** Returns the bill linked to a specific booking.
**Auth:** Internal session check
**Called by:** `BillingHistoryPanel.tsx` → `apiRequest`

---

#### `GET /api/auth/clinic/bills/patient/:phone`
**Purpose:** Returns all bills for a patient identified by phone number.
**Auth:** Internal session check
**Called by:** `BillingHistoryPanel.tsx` → `apiRequest`

---

#### `GET /api/auth/clinic/bills/patient-by-email/:email`
**Purpose:** Returns all bills for a patient identified by email.
**Auth:** Internal session check
**Called by:** `BillingHistoryPanel.tsx` → `apiRequest`

---

#### `POST /api/auth/clinic/bills`
**Purpose:** Creates a new bill for a patient booking.
**Auth:** Internal session check
**Called by:** `ClinicDashboard.tsx` → `apiRequest`, `BillingHistoryPanel.tsx` → `apiRequest`

---

#### `PATCH /api/auth/clinic/bills/:id`
**Purpose:** Updates a bill (e.g. marks as paid, adjusts amount).
**Auth:** Internal session check
**Called by:** `ClinicDashboard.tsx` → `apiRequest`, `BillingHistoryPanel.tsx` → `apiRequest`

---

#### `DELETE /api/auth/clinic/bills/:id`
**Purpose:** Deletes a bill record.
**Auth:** Internal session check
**Called by:** `BillingHistoryPanel.tsx` → `apiRequest`

---

### 9. Patients — Session Checked Inside Handler

---

#### `GET /api/auth/clinic/patients`
**Purpose:** Returns all patient records known to the clinic (from their bookings).
**Auth:** Internal session check (`clinicId`)
**Called by:** `ClinicDashboard.tsx` → `apiRequest`

---

#### `GET /api/auth/clinic/patients/:patientId/history`
**Purpose:** Returns the full booking and billing history for a specific patient.
**Auth:** Internal session check
**Called by:** `ClinicDashboard.tsx` → `apiRequest`

---

### 10. Analytics — Session Checked Inside Handler

---

#### `GET /api/auth/clinic/analytics`
**Purpose:** Returns booking counts, revenue, patient totals, and booking trends for the clinic dashboard analytics panel.
**Auth:** Internal session check (`clinicId`)
**Query params:** `range` — `7d`, `30d`, `90d`
**Called by:** `ClinicAnalyticsPanel.tsx` → `useQuery`

---

### 11. Webhooks — External Services

These receive callbacks from third-party systems. Not called by the frontend.

---

#### `POST /api/webhooks/razorpay-subscription`
**Purpose:** Razorpay posts here when a clinic subscription payment is completed. Sets clinic subscription to `active`.
**Auth:** Razorpay webhook signature verification
**Called by:** Razorpay infrastructure (not frontend)

---

#### `GET /api/whatsapp-webhook`
`POST /api/whatsapp-webhook`
**Purpose:** WhatsApp webhook verification and inbound message handler (Meta / Twilio).
**Auth:** Webhook token verification
**Called by:** WhatsApp / Meta infrastructure (not frontend)

---

## Quick Auth Decision Tree for New Routes

```
Is this data anyone on the internet should see?
  YES → No auth. Use /api/public/* prefix.
  NO  → Continue...

Is this a super-admin-only action (approve clinic, manage deals)?
  YES → Use isAdmin middleware.
  NO  → Continue...

Is this a clinic admin, doctor, or super admin action?
  YES → Use isAuthenticated middleware.
        Inside the handler, use sess.clinicId or sess.doctorId to scope data.
  NO  → Continue...

Is this a token-based public action (consent, activation, password reset)?
  YES → No session auth. Validate token from DB, check expiry, act on it.
```

---

## Known Auth Inconsistencies to Address

These routes are effectively protected but don't use the standard `isAuthenticated` middleware — they do internal session checks instead. A future cleanup should add the middleware guard for consistency:

| Route | Issue |
|---|---|
| `POST /api/auth/clinic/bookings/:id/request-consent` | No middleware — session checked manually |
| `GET/POST/PATCH/DELETE /api/clinical-records/*` | No middleware — session checked manually |
| `GET/POST/PATCH/DELETE /api/clinic/inventory/*` | No middleware — session checked manually |
| `GET/POST/PATCH/DELETE /api/auth/clinic/bills/*` | No middleware — session checked manually |
| `GET /api/auth/clinic/patients*` | No middleware — session checked manually |
| `GET /api/auth/clinic/analytics` | No middleware — session checked manually |

Also, these frontend call-sites use bare `fetch()` without `API_BASE_URL` — they fail in production if `VITE_API_URL` is set:

| File | Path | Issue |
|---|---|---|
| `Activate.tsx` | `/api/activate/:token` | Bare fetch, no `API_BASE_URL` |
| `ResetPassword.tsx` | `/api/auth/reset-password` | Bare fetch, no `API_BASE_URL` |
| `SmileDeals.tsx` | `/api/public/otp/send`, `/api/public/otp/verify`, `/api/public/supplier-listing-request/submit` | Bare fetch, no `API_BASE_URL` |

---

## Checklist for Adding a New API Route

- [ ] **Choose the right prefix** — `/api/public/*` if open, `/api/auth/clinic/*` for clinic admin, `/api/doctor/*` for doctor, `/api/admin/*` for super admin only
- [ ] **Add the correct middleware** — `isAuthenticated` for session users, `isAdmin` for super admin only, nothing for public
- [ ] **Scope the data** — read `sess.clinicId` or `sess.doctorId` inside the handler; never trust a clinicId from the request body/params without verifying it matches the session
- [ ] **Add to `shared/routes.ts`** if it needs a typed path constant shared with the frontend
- [ ] **Call it via `apiRequest()` or `useQuery`** on the frontend — never with a bare `fetch("/api/...")`
- [ ] **Document it here** in the correct section of this file
- [ ] **Update `docs/render-environment-setup.md`** if the route needs a new environment variable
