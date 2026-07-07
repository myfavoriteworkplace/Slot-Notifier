# BookMySlot — Features & Functionalities

> **Version**: May 2026  
> **Stack**: React 18 + TypeScript · Vite · Express.js · PostgreSQL · Drizzle ORM · TanStack Query · shadcn/ui · Tailwind CSS  
> **Changelog**: See [§13 Recent Changes](#13-recent-changes)

---

## Table of Contents

1. [Application Overview](#1-application-overview)
2. [User Roles & Access Control](#2-user-roles--access-control)
3. [Public-Facing Pages & Features](#3-public-facing-pages--features)
   - [3.4.1 Chief Complaint Categories & Specialist Mapping](#341-chief-complaint-categories--specialist-mapping)
4. [End-to-End Booking Workflow](#4-end-to-end-booking-workflow)
5. [Clinic Admin Dashboard](#5-clinic-admin-dashboard)
6. [Doctor Dashboard](#6-doctor-dashboard)
7. [Super Admin Dashboard](#7-super-admin-dashboard)
8. [Digital Consent Workflow](#8-digital-consent-workflow)
9. [Notifications & External Integrations](#9-notifications--external-integrations)
10. [Database Schema Reference](#10-database-schema-reference)
11. [API Endpoints Reference](#11-api-endpoints-reference)
12. [Key Design Decisions](#12-key-design-decisions)
13. [Recent Changes](#13-recent-changes)

---

## 1. Application Overview

**BookMySlot** is a full-stack, multi-tenant appointment booking platform built specifically for dental clinics in India. It allows clinic owners to publish their availability, manage staff doctors, handle patient appointments, and maintain clinical and financial records — all from a single dashboard.

Patients interact through a frictionless public booking flow (no account required — OTP email verification only) and can also sign digital consent forms from their phone before treatment.

A super-admin layer governs clinic onboarding, platform-wide promotional deals (Smile Deals), and audit logging.

### Core Capabilities at a Glance

| Area | Summary |
|---|---|
| Patient Booking | Email-OTP verified slot booking — no patient account needed |
| Clinic Management | Full dashboard: slots, bookings, patients, doctors, billing, inventory |
| Doctor Portal | Appointment approval, clinical notes, certifications, leave management |
| Digital Consent | Token-secured signing page with signature canvas, IP logging |
| Smile Deals | Public dental deal marketplace with dark-theme UI |
| Clinic Micro-sites | Custom public profile page per clinic with themes and maps |
| Super Admin | Clinic approval/rejection, deal management, login audit |
| Notifications | Email (Resend) + WhatsApp (Twilio) for all key events |
| File Storage | Cloudflare R2 for logos, doctor photos, medical documents |
| Billing & Export | PDF/Excel invoice generation, patient ledger, revenue tracking |

---

## 2. User Roles & Access Control

Authentication uses session-based auth (express-session + connect-pg-simple). Roles are enforced server-side on every protected route.

### 2.1 Superuser (Platform Admin)

Accessed via `/admin` with `ADMIN_EMAIL` / `ADMIN_PASSWORD` environment credentials or Replit OIDC.

**Permissions:**
- View all registered clinics across Active, Pending, and Archived states
- Approve or reject new clinic registrations
- Archive or restore existing clinics
- Manage platform credentials for any clinic
- Full CRUD on Smile Deals (promotional offers marketplace)
- View login event audit log across all users

### 2.2 Clinic Owner / Admin

Authenticated via `/clinic-login` (username + password). Each clinic has an isolated data scope — no cross-clinic data access.

**Permissions:**
- Configure time slots and daily availability
- View, manage, cancel, and reschedule all bookings for their clinic
- Assign doctors to specific appointments
- Invite and manage doctors linked to the clinic
- Maintain clinic profile (contact, address, logo, map coordinates)
- Generate and manage patient bills (PDF invoices)
- Access patient directory, visit history, and clinical records
- Track inventory (consumables, equipment, stock levels)
- Export booking and billing data to Excel
- Configure clinic micro-site and website theme
- Request and monitor digital consent for procedures

### 2.3 Doctor

Authenticated via the same `/clinic-login` route (Doctor tab) using email and password.

**Permissions:**
- View all appointments assigned to them (across all clinics they are linked to)
- Accept or decline pending appointment assignments
- Write and update clinical notes and diagnoses
- Set clinical status per appointment (First Visit / Revisit / Follow-up / Case Closed)
- Add and manage personal certifications and clinical case portfolio
- Manage leave dates (mark unavailable)
- Maintain their public professional profile (photo, specialisation, bio, languages, experience)
- Share a QR-coded public profile URL

### 2.4 Patient / Customer

No account or login required. Identity is verified per booking via a 6-digit email OTP.

**Capabilities:**
- Browse available slots for a clinic
- Verify identity via email OTP before booking
- Book an appointment with chief complaints
- Sign digital consent forms via a unique secure link
- Receive booking confirmations and reminders by email and WhatsApp

---

## 3. Public-Facing Pages & Features

### 3.1 Landing Page (`/`)

The primary marketing surface for the platform.

- Animated hero section with headline and CTA buttons
- Platform statistics (avg booking time, uptime, slots per clinic)
- Feature highlights (Smart Appointment Management, Inventory Alerts, Clinical Records, Billing)
- Trust indicators and "Live" / "New" feature badges
- Direct links to Clinic Portal login, Booking, and Smile Deals

### 3.2 Pricing Page (`/pricing`)

Displays subscription tiers for clinics:

| Plan | Intended For |
|---|---|
| Starter | Single-doctor, single-location clinics |
| Growth | Multi-doctor clinics with advanced features |
| Pro | Enterprise / chain clinics |

Each plan card lists included features, pricing in ₹, and a sign-up CTA.

### 3.3 Clinic Registration (`/register-clinic`)

Multi-step self-registration form for new clinics:

- **Step 1** — Clinic name, owner name, contact email, phone number
- **Step 2** — Address, city, pincode, Google Maps coordinates
- **Step 3** — Document upload (medical licence, registration certificate) via Cloudflare R2
- **Submission** — Creates a pending clinic record; super admin must approve before activation

After submission the clinic receives an activation email with a token link (`/activate/:token`).

### 3.4 Patient Booking Page (`/book/:clinicId`)

The core patient-facing booking interface. No login required.

**Flow:**
1. Patient lands on the clinic's booking page
2. Enters their email address and clicks "Send Code"
3. A 6-digit OTP is sent to the email (via Resend); expires after a short window
4. Patient verifies the OTP — a `verifiedToken` is issued
5. Patient selects a date, then picks a morning / afternoon / evening slot
6. Patient enters name, phone number, and selects chief complaints via the accordion panel (see §3.4.1 below)
7. Booking is submitted; confirmation email sent immediately

**Features:**
- OTP verification prevents spam and fake bookings
- Slot capacity is enforced (configurable per clinic)
- Fully cancelled / full slots are hidden from the picker
- Accordion complaint picker is fast on mobile — one category open at a time
- Selected sub-issues are stored as a comma-separated string in `bookings.description`
- Free-text "Additional Notes" field remains available for anything not covered by the categories

### 3.4.1 Chief Complaint Categories & Specialist Mapping

The booking form groups complaints into 12 dental categories. Each category expands to reveal plain-language sub-issues. The selected sub-issues drive the **Suggested Specialization** banner shown to clinic staff in the doctor-assignment panel.

| # | Category | Sub-Issues | Recommended Specialist(s) |
|---|---|---|---|
| 1 | 🦷 Tooth Pain or Sensitivity | Sensitivity to hot/cold/sweet · Sharp or throbbing pain · Pain while chewing · Pain at night | Endodontist · General Dentist |
| 2 | 🩸 Gum Problems | Bleeding gums · Swollen or red gums · Receding gums · Bad breath or bad taste | Periodontist · General Dentist |
| 3 | 🕳️ Tooth Decay / Cavities | Visible hole or black spot · Pain when eating or drinking · Food getting stuck | General Dentist · Endodontist |
| 4 | 💔 Broken, Chipped or Cracked Tooth | Chipped or broken tooth · Cracked tooth · Worn down teeth | Prosthodontist · General Dentist |
| 5 | 🔀 Alignment or Bite Issues | Crooked or crowded teeth · Gaps between teeth · Bite feels off or jaw discomfort | Orthodontist |
| 6 | 🫥 Missing Teeth | One tooth missing · Multiple teeth missing · Want replacement options | Prosthodontist · Oral Surgeon |
| 7 | ✨ Cosmetic / Smile Concerns | Yellow or stained teeth · Want a whiter smile · Uneven teeth shape · Gaps I want closed | Cosmetic Dentist · Prosthodontist |
| 8 | 🤒 Swelling or Infection | Swollen face or gum · Pus or abscess · Severe pain with swelling | Endodontist · Oral Surgeon · General Dentist |
| 9 | 👶 Child's Dental Issues | Tooth decay in baby teeth · Child complains of pain · Thumb sucking habits · Delayed tooth eruption | Pedodontist |
| 10 | 🦴 Jaw Pain or Other | Jaw pain or clicking (TMJ) · Dry mouth · Mouth ulcers · Suspicious growth or lump | Oral Medicine Specialist · Oral Surgeon · General Dentist |
| 11 | 😬 Wisdom Tooth Problems | Pain from wisdom tooth · Swelling near wisdom tooth · Difficulty opening mouth | Oral Surgeon · General Dentist |
| 12 | 🧹 Preventive / Routine Care | Regular checkup · Cleaning or scaling · Fluoride treatment | General Dentist · Dental Hygienist |

**How the mapping is used in the clinic dashboard:**
- When a clinic admin opens a booking card and views the doctor-assignment panel, the system reads `booking.description`, matches each sub-issue against the table above, and collects the union of recommended specialists.
- A **💡 Suggested specialization** banner is displayed above the doctor list, showing the matched specialist types as pill tags.
- Any doctor whose recorded `specialization` field matches one of the suggestions is highlighted with a green **"Best match"** badge and a green card background — making the right assignment immediately obvious.

### 3.5 Smile Deals Marketplace (`/deals`)

A curated promotional hub for dental services and packages offered by partner clinics.

**Design:** Full dark theme (`#080D0B` background, Sora font, animated ambient glow orbs)

**Sections:**
- **Stats row** — Live counts: Active Deals, Average Saving (auto-computed from original vs deal price), Total Views
- **Subcategory filter pills** — driven by the `subcategory` field (Cleaning, Whitening, Braces, Implants, Root Canal, X-Ray, etc.)
- **Featured cinematic hero card** — full-width side-by-side layout with video autoplay support
- **⚡ Flash Deals strip** — horizontal scrollable section for time-sensitive offers
- **Countdown timer card** — auto-appears for deals expiring within 72 hours
- **3-column tilt grid** — magnetic hover, strike-through original price, "Save ₹X" badge, Book button
- **Refer a Clinic promo** — unlock exclusive deals via referral
- **Loyalty Rewards** — coming-soon teaser

**Deal fields**: title, description, image, booking link, price (₹), original price (₹), category, subcategory, flash flag, featured flag, start date, expiry date, video URL, view count, click count.

### 3.6 Clinic Public Profile (`/clinic/:slug` and `/about`)

Each clinic gets a hosted micro-site page:

- Clinic name, logo, contact details, address with embedded map
- List of linked doctors with specialisations and photos
- Available treatments / services
- Configurable hero image and theme (set via Website panel in clinic dashboard)
- Direct "Book Now" CTA linking to `/book/:clinicId`
- Copy booking URL button

### 3.7 Doctor Public Profile (`/doctor/:id`)

A standalone professional profile page for each doctor:

- Profile photo, name, specialisation, degree, years of experience
- Languages spoken (English, Malayalam, Tamil, Hindi, Kannada)
- Bio / professional summary
- Certifications list (credential name, issuing body, year)
- Clinical cases gallery (before/after photos or video)
- Completeness progress bar (shown in editor, hidden on public page)
- QR code for direct scan-to-profile
- Shareable profile URL

### 3.8 Digital Consent Form (`/consent/:token`)

A public, no-login page patients visit to sign their procedural consent:

- Displays clinic name, doctor name, and appointment summary
- Full consent declaration text (rights, risks, data privacy)
- Signature pad (finger / stylus / mouse — via `signature_pad` library)
- Submit button — stores the signature image, patient IP address, and timestamp
- Token expires after 72 hours for security
- Once signed, the clinic dashboard shows a green "Signed ✓" badge on the booking

### 3.9 Account Activation (`/activate/:token`)

Clinic owners visit this link (emailed after registration) to activate their account and set their initial password.

### 3.10 Password Reset (`/reset-password`)

Self-service password reset flow for clinic and doctor accounts.

---

## 4. End-to-End Booking Workflow

```
Clinic Admin
   │
   ▼
[1] CONFIGURE SLOTS
    - Set morning / afternoon / evening capacity
    - Optionally mark dates as cancelled / unavailable
    - POST /api/auth/clinic/slots/configure

Patient
   │
   ▼
[2] EMAIL OTP VERIFICATION
    - Patient enters email on /book/:clinicId
    - POST /api/public/otp/send  →  Resend sends 6-digit code
    - POST /api/public/otp/verify  →  Returns verifiedToken (expires with code)

   ▼
[3] SLOT SELECTION & BOOKING
    - Patient picks date + slot + enters details + chief complaints
    - POST /api/public/bookings  (requires verifiedToken)
    - Booking created with status: pending
    - Confirmation email → patient (Resend)
    - WhatsApp notification → patient (Twilio)

Clinic Admin
   │
   ▼
[4] DOCTOR ASSIGNMENT
    - Admin sees booking in Bookings panel
    - Assigns an available doctor from the clinic's staff
    - PATCH /api/auth/clinic/bookings/:id  {assignedDoctor, assignedDoctorEmail}
    - Assignment email → doctor (Resend)

Doctor
   │
   ▼
[5] DOCTOR APPROVAL
    - Doctor sees booking in "Awaiting" stat tile on Doctor Dashboard
    - Reviews patient name, date, time, and chief complaints
    - Clicks Accept  →  PATCH /api/doctor/bookings/:id/approve  {status: "approved"}
    - Clicks Decline  →  {status: "declined"}
    - Approval/decline notification → clinic admin

Clinic Admin
   │
   ▼
[6] DIGITAL CONSENT (Optional)
    - Admin clicks "Request Consent →" on the booking card
    - POST /api/auth/clinic/bookings/:id/request-consent
    - 72-hour token generated; WhatsApp link sent to patient
    - Patient visits /consent/:token, reads declaration, signs
    - POST /api/consent/:token/sign  {signature, ip, timestamp}
    - Dashboard shows "Signed ✓"

During / After Appointment
   │
   ▼
[7] CLINICAL NOTES & STATUS
    - Doctor updates clinical status (First Visit / Revisit / Follow-up / Case Closed)
    - Doctor adds diagnosis notes and shared thread entries
    - PATCH /api/doctor/bookings/:id/clinical-status

Clinic Admin
   │
   ▼
[8] BILLING
    - Admin opens billing panel on the booking
    - Adds services performed with individual prices
    - Sets discount %, tax/GST %, payment method
    - Generates PDF invoice (jsPDF)
    - POST /api/auth/clinic/bills  →  saved to patient_bills table
    - Appears in Accounts panel ledger
```

---

## 5. Clinic Admin Dashboard

Accessed at `/clinic-dashboard` after login. Full sidebar navigation on desktop; horizontal scrollable tab strip on mobile.

### 5.1 Bookings Panel

The default panel on login. Central command for all appointment activity.

**Hero Stat Tiles (dark banner, top row):**

Four clickable mini-cards inside the dark green clinic header. Each one filters the booking list when clicked.

| Tile | Meaning | Colour |
|---|---|---|
| Confirmed Today | Confirmed bookings on today's date | Sky |
| Confirmed Bookings (Next 7 Days) | Confirmed appointments in the next 7 days | Emerald |
| Pending Confirmations (Next 7 Days) | Unconfirmed bookings in the next 7 days — need attention | Amber |
| All Pending | All unconfirmed bookings across all dates | Rose |

**Quick Filter Cards (below the header):**

A second row of white clickable cards provides broader date-range filters:

| Filter | Meaning |
|---|---|
| Today | All bookings on today's date |
| Upcoming | All future bookings beyond today |
| Past | All past / completed bookings |
| This Week | All bookings Mon – Sun of the current week |
| Next Week | All bookings in the following Mon – Sun week |

**Booking List Features:**
- Search by patient name, phone, or reference number
- Filter by date range (date picker), quick filter (Today / Upcoming / Past / This Week / Next Week)
- Each booking card shows: patient name, REF number, date/time, slot, doctor assigned, status badge
- Expandable booking modal with tabs:
  - **Overview** — patient contact, appointment summary
  - **Clinical** — clinical status, diagnosis notes
  - **Notes** — shared clinic↔doctor message thread
  - **Actions** — confirm, cancel, reschedule, assign doctor
  - **Billing** — create and manage invoice

**Actions per booking:**
- Confirm / Cancel booking
  - Cancellation requires selecting a **reason** from a dropdown: Doctor unavailable · Patient request · Slot conflict · Emergency · Other
  - Reason is stored in `bookings.cancellation_reason`, displayed on the booking card beneath the Cancelled badge, and included in the cancellation email sent to the patient
- Reschedule to a different date/slot
- Assign or reassign a doctor — with smart specialist suggestion (see below)
- Request digital consent → generates WhatsApp link
- Generate PDF bill
- Download consent certificate

**Smart Doctor Assignment:**
When a booking has chief complaints selected, the assign-doctor panel automatically shows a **💡 Suggested specialization** banner listing the specialist types derived from the patient's complaints (e.g. Endodontist, Periodontist). Doctors whose recorded specialization matches a suggestion are highlighted with a green **"Best match"** badge. See §3.4.1 for the full category → specialist mapping.

### 5.2 Configure Slots Panel

Controls daily appointment capacity.

- Date picker to select the day to configure
- Toggle between Morning / Afternoon / Evening slot windows
- Set `maxBookings` (default 3) — maximum concurrent bookings per slot
- Mark a date as fully cancelled (out-of-office day)
- Changes take effect immediately for the public booking page

### 5.3 Manage Doctors Panel

Clinic staff management.

- View all doctors currently linked to the clinic (with photo, specialisation, degree)
- **Invite / Add Doctor**: Enter name, email, specialisation, degree, photo upload (R2)
  - System generates a temporary password and sends an invitation email
- **Reset Password**: Generate a new temporary password for any linked doctor
- **Remove Doctor**: Unlink a doctor from the clinic
- Doctor list is synced with the `clinic_doctors` join table

### 5.4 Clinic Profile Panel

Update the clinic's public-facing information.

| Field Group | Fields |
|---|---|
| Contact | Phone, email, website URL |
| Address | Street address, city, pincode |
| Location | Latitude / longitude (map coordinate picker) |
| Branding | Logo upload (Cloudflare R2 signed URL) |
| Doctors list (legacy) | Quick doctor names for public display |

Changes are saved via `PATCH /api/auth/clinic/me`.

### 5.5 Export Data Panel

One-click data export for offline use:

- Download all bookings as an Excel file (`.xlsx`) — includes patient name, phone, date, time, slot, doctor, status, chief complaints
- Uses `ExcelJS` for file generation in the browser
- Filename includes clinic name and export date

### 5.6 Inventory Panel

Track dental consumables and equipment.

- **Item list**: name, category (Consumable / Equipment), quantity on hand, unit (Box / Pack / Piece / Roll), reorder level, expiry date
- **Add item**: full form with all fields
- **Update stock**: increment/decrement quantity
- **Expiry alerts**: items near or past expiry date are highlighted
- Low-stock indicator when quantity drops below reorder level

### 5.7 Website Panel

Configure the clinic's public micro-site appearance:

- Select a colour theme for the public profile page
- Upload a hero/banner image
- Set public display name and tagline
- Toggle which sections are visible (doctors list, treatments, location map)
- Preview URL shown for sharing

### 5.8 Accounts Panel

Financial overview and billing register.

**Two views:**

**Ledger View** — Per-patient financial summary:
- Patient name, PAT code, total billed, total collected, outstanding balance
- Expandable to show all individual bills per patient

**Register View** — Chronological bill log:
- Receipt number, date, patient name, services, subtotal, discount, tax, total, payment method, payment status (Paid / Pending / Partial / Overdue)
- Inline status toggle (change paid/pending)
- Delete bill
- Export all bills to CSV

**Search & Filter:**
- Search by patient name or receipt number
- Filter by payment status

### 5.9 Patients Panel

CRM-style patient directory.

- Full list of all patients who have ever booked at the clinic
- Each patient has a unique **PAT code** (e.g. `PAT-0001`)
- **Patient card** shows: name, phone, email, first visit date, total visits, total billed
- **Expand patient** to see full visit timeline:
  - Each booking with date, doctor, clinical status
  - Clinical records per visit (diagnoses, prescriptions, notes)
  - Bills associated with each visit
- Search by patient name, phone number, or PAT code

---

## 6. Doctor Dashboard

Accessed at `/doctor-dashboard` after login. The doctor's personal workspace for all clinical activity.

### 6.1 Mobile vs Desktop Layout

- **Desktop**: Two-column layout — sidebar (identity card, navigation, QR code) + main content area
- **Mobile**: Compact profile strip + horizontal scrollable tab bar (design-doc compliant)

### 6.2 Appointments Tab

**Stat Section:**

Two distinct sets of clickable stat cards:

*Hero banner mini-cards* (inside the dark green doctor header) — same naming and colour convention as the Clinic Dashboard:

| Card | Meaning | Colour |
|---|---|---|
| Confirmed Today | Confirmed appointments assigned to you today | Sky |
| Confirmed Bookings (Next 7 Days) | Confirmed appointments in the next 7 days | Emerald |
| Pending Confirmations (Next 7 Days) | Bookings awaiting your approval in the next 7 days | Amber |
| All Pending | All bookings awaiting your approval across all dates | Rose |

*Desktop filter cards* (white cards below the Appointments panel header):

| Card | Filter applied |
|---|---|
| All Bookings Today | All appointments on today's date |
| All Upcoming Bookings | Future appointments beyond today |
| Awaiting Approval | Bookings needing doctor accept/decline |
| All Bookings | Complete unfiltered appointment list |

- **Mobile**: Compact 2×2 grid in the profile banner — same order and labels as the hero mini-cards above, 44px tap target per cell

**Dynamic Section Heading:**
A green gradient heading card (`from-primary to-accent`) appears above the appointment card grid and updates its title and subtitle based on the active filter — e.g. "All Pending Bookings", "Confirmed Bookings (Next 7 Days)", "Today's Appointments". A live count of filtered appointments is shown on the right.

**Filters:**
- Date picker (shown only in "Total" / "All" mode)
- Clinic dropdown (for doctors linked to multiple clinics)
- Clear filter button

**Awaiting Approval Banner:**
- Shown prominently when any bookings need the doctor's acceptance
- "Review" button jumps directly to the awaiting list

**Booking Cards:**
- **Mobile**: Collapsed by default — green header (name, ref, status badge, chevron) + compact date/time row. Tap to expand inline.
- **Desktop**: Always fully expanded.
- **Expanded card shows**: date, time, duration, clinic name & address, chief complaints, clinical status chip
- **Action buttons** (in "Awaiting" filter): Accept / Decline
- **After acceptance**: "You confirmed this appointment" notice
- **Notes toggle**: Expands shared clinic↔doctor thread inline
- **Records toggle**: Expands clinical records (diagnosis, prescription, medical images)
- Clinical status dropdown: First Visit / Revisit / Follow-up Required / Case Closed

### 6.3 My Profile Tab

Personal professional profile editor.

| Section | Fields |
|---|---|
| Photo | Upload profile photo (Cloudflare R2) |
| Basic Info | Full name, specialisation, degree, years of experience |
| Bio | Freeform professional summary |
| Languages | Multi-select: English, Malayalam, Tamil, Hindi, Kannada |
| Completeness bar | Visual indicator of profile fill percentage |
| Preview Profile | Opens the public `/doctor/:id` profile in a new tab |
| Change Password | Secure in-dashboard password update form |

### 6.4 Certifications Tab

Manage professional credentials:

- Add certifications: credential name, issuing body, issue year, certificate file upload (R2)
- Edit or delete existing certifications
- Displayed publicly on the doctor's profile page

### 6.5 Cases Tab

Build a clinical portfolio:

- Add case entries: case title, description, procedure type
- Upload before/after photos or video clips (R2)
- Media displayed as a gallery grid on the public profile
- Edit or delete cases

### 6.6 Leave Management

Declare personal unavailability:

- Date range picker for leave periods
- Leave dates are blocked in the clinic's slot view (doctor shown as unavailable for those dates)
- Existing leaves listed with delete option

### 6.7 Sidebar Features (Desktop)

- **Identity card**: Avatar, name, specialisation badge, clinic name
- **QR Code panel**: Live QR code linking to the doctor's public profile
- **Profile URL**: Displayed as `/doctor/:username` with one-click copy

---

## 7. Super Admin Dashboard

Accessed at `/admin`. Superuser credentials required.

### 7.1 Clinic Management Tabs

**Active Clinics:**
- Full card layout per clinic: name, owner, city, contact, approved date
- Actions: Archive clinic, Reset credentials, Copy clinic login link

**Pending Clinics:**
- Clinics registered but awaiting approval
- Same full card layout — shows submitted documents
- Actions: **Approve** (sends activation email + sets status to active), **Reject** (sends rejection email)

**Archived Clinics:**
- Previously archived clinics
- Action: **Restore** (returns to Active status)

### 7.2 Smile Deals Management

Full CRUD interface for the promotional deals marketplace:

**Create / Edit Deal Fields:**
| Field | Purpose |
|---|---|
| Title | Deal headline |
| Description | Full offer details |
| Image | Upload to R2 |
| Booking Link | External URL for the offer |
| Category | Broad type: Clinic Deals, Advertisements, Sponsored, etc. |
| Procedure / Type | Subcategory: Cleaning, Whitening, Braces, Implants, Root Canal, X-Ray, Cosmetic, etc. |
| Price (₹) | Deal price |
| Original Price (₹) | Was-price — drives "Save ₹X" badge and avg-saving stat |
| Featured | Boolean — shows as cinematic hero card |
| Flash Deal | Boolean — appears in horizontal Flash Deals scroll strip |
| Start Date | Deal goes live at this datetime |
| Expiry Date | Deal expires at this datetime |
| Video URL | YouTube / Vimeo / mp4 — autoplay on hover |

**Deal Analytics per card:** View count, Click count (incremented by public page interactions)

### 7.3 Login Audit Log

Table of all authentication events:
- Timestamp, user type (clinic / doctor / admin), username, IP address, success/failure
- Useful for security monitoring

---

## 8. Digital Consent Workflow

A paperless patient consent system delivered via secure time-limited tokens.

### Flow

```
1. Clinic admin opens a booking card in the Bookings panel
2. Clicks "Request →" in the Digital Consent section
3. Backend:
   - Generates a UUID consent token
   - Sets 72-hour expiry
   - Stores token in consent_tokens table linked to the booking
   - Sends WhatsApp message to patient (Twilio) with the consent URL
4. Admin sees the consent URL displayed (copy button + open button)
5. Patient receives WhatsApp message, taps link
6. Patient visits /consent/:token (no login required)
7. Page shows:
   - Clinic name and logo
   - Doctor name
   - Appointment date and time
   - Consent declaration text (5 bullet points covering risks, rights, data privacy)
   - Signature pad (canvas — works with finger on mobile)
8. Patient signs and clicks "Submit Consent"
9. Backend:
   - Saves signature as base64 image to bookings.consent_signature
   - Records consent_signed_at timestamp
   - Records patient IP address
   - Marks token as used
10. Clinic dashboard refreshes:
    - Booking card shows green "Signed ✓" badge
    - "Resend →" button replaces "Request →" if re-sending is needed
```

### Security Notes

- Tokens are single-use and expire after 72 hours
- Patient IP is logged at signing time
- No authentication is required (the token itself is the credential)
- Consent data is immutable once stored

---

## 9. Notifications & External Integrations

### 9.1 Email — Resend

Configured via `RESEND_API_KEY`. Two modes:
- `RESEND=PRODUCTION` — sends to real email addresses
- `RESEND=DEV` — redirects all emails to a test address

| Trigger | Recipient | Content |
|---|---|---|
| Patient books a slot | Patient | Booking confirmation with date, time, clinic, REF number |
| Booking cancelled | Patient | Cancellation notice — includes the cancellation reason when one was recorded |
| Doctor invited to clinic | Doctor | Welcome email with login credentials |
| Clinic registration | Clinic owner | Account activation link |
| OTP verification | Patient | 6-digit code with expiry notice |

### 9.2 WhatsApp — Twilio

Configured via Twilio credentials. Disabled gracefully if credentials are missing.

| Trigger | Recipient | Content |
|---|---|---|
| Booking received | Patient | Confirmation with appointment summary |
| Booking confirmed | Patient | Confirmation + Google Maps directions link |
| Digital consent requested | Patient | Consent form URL with instructions |

### 9.3 File Storage — Cloudflare R2

Configured via `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`.

Upload flow:
1. Frontend requests a signed upload URL: `POST /api/uploads/signed-url`
2. Backend generates a pre-signed PUT URL for the specific R2 path
3. Frontend uploads the file directly to R2 (no backend proxy)
4. The public R2 URL is stored in the database

| Use Case | R2 Folder |
|---|---|
| Clinic logos | `clinics/` |
| Doctor profile photos | `doctors/` |
| Smile Deal images | `smile-deals/` |
| Medical licence / documents | `documents/` |
| Doctor certifications | `certifications/` |
| Clinical case media | `cases/` |

### 9.4 Payments — Razorpay

Used for token fee collection during booking (optional per clinic):

- `POST /api/public/razorpay/create-order` — initialises a Razorpay order
- `POST /api/public/razorpay/verify-payment` — verifies payment signature and creates booking

### 9.5 Document Generation — ExcelJS & jsPDF

- **ExcelJS**: Booking data export to `.xlsx` from the Export Data panel
- **jsPDF + jsPDF-AutoTable**: In-browser PDF invoice generation from the billing panel — includes clinic branding, patient details, services table, totals, and payment summary

---

## 10. Database Schema Reference

All tables are in PostgreSQL managed via Drizzle ORM. Schema lives in `shared/schema.ts`. Runtime migrations are applied via ALTER TABLE blocks in `server/index.ts`.

| Table | Purpose |
|---|---|
| `users` | Platform-level user accounts (superuser) |
| `clinics` | Clinic records — profile, contact, status, website config, subscription |
| `doctors` | Doctor profiles — specialisation, degree, bio, photo, languages, experience |
| `clinic_doctors` | Join table linking clinics to doctors (many-to-many) |
| `slots` | Daily availability windows per clinic (morning / afternoon / evening) |
| `bookings` | Patient appointment records — links slot, clinic, doctor, patient. Key columns: `verification_status`, `cancellation_reason`, `consent_signature`, `consent_signed_at`, `assigned_doctor`, `assigned_doctor_email`, `doctor_notes`, `clinical_status` |
| `patients` | Patient CRM records — name, phone, email, PAT code, identity |
| `clinical_records` | Medical notes, diagnoses (JSONB), prescriptions per visit |
| `patient_bills` | Invoice records — services, subtotal, discount, tax, total, payment status |
| `inventory_items` | Clinic stock — consumables and equipment with quantity and expiry |
| `stock_transactions` | Ledger of inventory changes (add / remove / adjustment) |
| `smile_deals` | Promotional deal listings for the public marketplace |
| `notifications` | In-app notification feed per user |
| `email_otps` | Short-lived OTP tokens for patient email verification |
| `activation_tokens` | Clinic account activation tokens (emailed on registration) |
| `consent_tokens` | 72-hour patient consent signing tokens |
| `doctor_certifications` | Professional credentials per doctor |
| `doctor_cases` | Clinical portfolio cases with media |
| `doctor_leaves` | Doctor unavailability date ranges |
| `booking_notes` | Shared message thread between clinic and doctor per booking |
| `login_events` | Audit log of all authentication events |
| `site_settings` | Platform-wide configuration key-value store |

---

## 11. API Endpoints Reference

### Authentication

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/auth/admin/login` | Public | Superuser login |
| `POST` | `/api/auth/clinic/login` | Public | Clinic or Doctor login |
| `POST` | `/api/auth/clinic/logout` | Clinic | Clinic logout |
| `GET` | `/api/auth/clinic/me` | Clinic | Current clinic/doctor session |
| `GET` | `/api/auth/user` | User | Current superuser session |
| `GET` | `/api/auth/doctor/me` | Doctor | Current doctor session |

### Public Booking

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/public/otp/send` | Public | Send OTP to patient email |
| `POST` | `/api/public/otp/verify` | Public | Verify OTP, return verifiedToken |
| `GET` | `/api/public/slots/:clinicId` | Public | Get available slots for a clinic |
| `POST` | `/api/public/bookings` | Public (OTP) | Create a new booking |
| `POST` | `/api/public/razorpay/create-order` | Public | Initiate Razorpay payment |
| `POST` | `/api/public/razorpay/verify-payment` | Public | Verify payment and create booking |

### Clinic Admin

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/auth/clinic/bookings` | Clinic | List all clinic bookings |
| `PATCH` | `/api/auth/clinic/bookings/:id` | Clinic | Update booking (confirm/cancel/reschedule/assign doctor) |
| `DELETE` | `/api/auth/clinic/bookings/:id` | Clinic | Soft-cancel a booking (sets status to `cancelled`, stores optional cancellation reason, sends cancellation email to patient) |
| `POST` | `/api/auth/clinic/slots/configure` | Clinic | Set slot capacity and availability |
| `GET` | `/api/auth/clinic/linked-doctors` | Clinic | List doctors linked to the clinic |
| `POST` | `/api/auth/clinic/doctors` | Clinic | Invite and add a new doctor |
| `POST` | `/api/auth/clinic/doctors/:id/reset-password` | Clinic | Reset doctor password |
| `DELETE` | `/api/auth/clinic/doctors/:id` | Clinic | Remove doctor from clinic |
| `PATCH` | `/api/auth/clinic/me` | Clinic | Update clinic profile |
| `GET` | `/api/auth/clinic/patients` | Clinic | Patient directory |
| `GET` | `/api/auth/clinic/patients/:id/history` | Clinic | Full patient visit history |
| `GET` | `/api/auth/clinic/bills` | Clinic | List all bills |
| `POST` | `/api/auth/clinic/bills` | Clinic | Create a patient bill |
| `PATCH` | `/api/auth/clinic/bills/:id` | Clinic | Update bill status |
| `DELETE` | `/api/auth/clinic/bills/:id` | Clinic | Delete a bill |
| `POST` | `/api/auth/clinic/bookings/:id/request-consent` | Clinic | Generate and send consent token |

### Doctor

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/doctor/bookings` | Doctor | List assigned appointments |
| `PATCH` | `/api/doctor/bookings/:id/approve` | Doctor | Accept or decline a booking |
| `PATCH` | `/api/doctor/bookings/:id/clinical-status` | Doctor | Update clinical status and notes |
| `GET` | `/api/doctor/profile` | Doctor | Get own profile |
| `PATCH` | `/api/doctor/profile` | Doctor | Update own profile |
| `GET` | `/api/doctor/certifications` | Doctor | List certifications |
| `POST` | `/api/doctor/certifications` | Doctor | Add certification |
| `DELETE` | `/api/doctor/certifications/:id` | Doctor | Remove certification |
| `GET` | `/api/doctor/cases` | Doctor | List cases |
| `POST` | `/api/doctor/cases` | Doctor | Add case |
| `DELETE` | `/api/doctor/cases/:id` | Doctor | Remove case |
| `GET` | `/api/doctor/leaves` | Doctor | List leave dates |
| `POST` | `/api/doctor/leaves` | Doctor | Add leave period |
| `DELETE` | `/api/doctor/leaves/:id` | Doctor | Remove leave |

### Digital Consent

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/consent/:token` | Public | Load consent form data |
| `POST` | `/api/consent/:token/sign` | Public | Submit signed consent |

### Super Admin

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/clinics` | Admin | List all clinics with status |
| `PATCH` | `/api/clinics/:id/approve` | Admin | Approve a pending clinic |
| `PATCH` | `/api/clinics/:id/reject` | Admin | Reject a pending clinic |
| `PATCH` | `/api/clinics/:id/archive` | Admin | Archive a clinic |
| `PATCH` | `/api/clinics/:id/restore` | Admin | Restore an archived clinic |
| `GET` | `/api/smile-deals` | Public | List all published deals |
| `POST` | `/api/smile-deals` | Admin | Create a new deal |
| `PATCH` | `/api/smile-deals/:id` | Admin | Update a deal |
| `DELETE` | `/api/smile-deals/:id` | Admin | Delete a deal |
| `GET` | `/api/login-events` | Admin | View authentication audit log |

### Uploads & Utility

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/uploads/signed-url` | Authenticated | Get a signed R2 upload URL |
| `GET` | `/api/notifications` | Authenticated | Fetch in-app notifications |
| `PATCH` | `/api/notifications/:id/read` | Authenticated | Mark notification as read |
| `GET` | `/api/health` | Public | Application health check |
| `GET` | `/api/inventory` | Clinic | Clinic inventory list |
| `POST` | `/api/inventory` | Clinic | Add inventory item |
| `PATCH` | `/api/inventory/:id` | Clinic | Update inventory item |

---

## 12. Key Design Decisions

### Session-Based Authentication (No JWT)
Sessions are stored in PostgreSQL via `connect-pg-simple`. This avoids token rotation complexity and works naturally with server-rendered redirects. `sameSite: "none"` + `secure: true` + `trust proxy 1` is configured for production deployment behind a reverse proxy.

### OTP-Gated Booking (No Patient Accounts)
Patients do not create accounts. Each booking session is authenticated by a short-lived email OTP. This dramatically reduces friction for first-time patients and eliminates account management overhead. The `verifiedToken` returned after OTP verification is required to submit a booking.

### Dual Authentication Mode
The system supports two authentication strategies simultaneously:
- **Replit OIDC** — when running on Replit (uses Passport.js OpenID Client)
- **Email/password** — when `ADMIN_EMAIL` and `ADMIN_PASSWORD` environment variables are set (for external deployment on Render, etc.)

### Schema-First Development with Drizzle ORM
All data models are defined in `shared/schema.ts` and shared between frontend and backend. Insert/select types are derived automatically from the Drizzle schema using `createInsertSchema` (drizzle-zod) — ensuring end-to-end type safety without duplication.

### Manual Migration Blocks (No Migration Files)
Because the project runs in a constrained environment, schema changes are applied via `DO $$ BEGIN ... EXCEPTION WHEN duplicate_column ... END $$` blocks in `server/index.ts` on every startup. This makes deployments self-healing without requiring a separate migration runner.

### R2 Signed-URL Upload Pattern
Files are never proxied through the backend. The frontend requests a signed PUT URL from the backend, then uploads directly to Cloudflare R2. This keeps the backend stateless and avoids memory/bandwidth overhead for large file uploads.

### Multi-Tenant Data Isolation
All clinic-scoped queries include a `clinicId` filter derived from the authenticated session — never from a request parameter. This prevents cross-clinic data leakage even if a parameter is tampered with.

### Responsive-First UI (Design Doc Compliance)
All screens follow the `docs/agent-screen-design-prompt.md` specification:
- Desktop primary (1280px canvas)
- Mobile-responsive at 375px (no separate designs)
- Sidebar hidden on mobile, replaced by horizontal scrollable tab strip
- Minimum 44px tap targets on all interactive elements
- CSS variables + Tailwind semantic classes only (no hardcoded hex values)
- Loading, empty, and error states on every data-fetching section

---

## 13. Recent Changes

A reverse-chronological log of significant feature additions and changes. Update this section whenever a new feature is shipped or an existing one is materially changed.

---

### 27 May 2026

**Dashboard stat card reorder (Clinic + Doctor)**
- Clinic Dashboard hero stat tiles reordered to: Confirmed Today → Confirmed Bookings (Next 7 Days) → Pending Confirmations (Next 7 Days) → All Pending. Colours: sky / emerald / amber / rose.
- Doctor Dashboard hero banner mini-cards brought into full parity with the Clinic Dashboard — same order, same labels, same `subTag` ("Next 7 Days"), same colour palette. Previously used different labels ("Confirmed · 7 Days", "Pending · 7 Days", "All Pending" in amber).
- Doctor Dashboard mobile 2×2 stat grid updated to match the new order and labels. "All Pending" recoloured from amber to rose for consistency.

**Doctor Dashboard — dynamic appointment section heading**
- Added a `from-primary to-accent` gradient heading card above the appointment grid. Title and subtitle update dynamically based on the active quick filter (e.g. "All Pending Bookings", "Confirmed Bookings (Next 7 Days)", "Today's Appointments"). Live filtered count shown on the right.

**Documentation update**
- `docs/Features-and-Functionalities.md` updated: corrected stat tile tables (§5.1, §6.2), added cancellation reason feature (§5.1), added dynamic section heading (§6.2), corrected DELETE booking endpoint description (§11), expanded `bookings` table column list (§10), added cancellation reason note to email table (§9.1).

---

### 13 May 2026

**Booking cancellation reason**
- Clinic admins must now select a reason when cancelling a booking: Doctor unavailable · Patient request · Slot conflict · Emergency · Other.
- Reason stored in new `bookings.cancellation_reason` column (added via startup migration).
- Displayed on the booking card below the Cancelled badge (badge pill row and booking-status area).
- Included in the cancellation email sent to the patient via Resend.
- `DELETE /api/auth/clinic/bookings/:id` updated to accept optional `{ reason }` in request body.

**Booking cancellation — soft-cancel fix**
- `cancelBooking()` in `server/storage.ts` corrected from hard delete to soft-cancel: sets `verificationStatus` → `'cancelled'` and persists `cancellationReason`. Booking record is preserved for history and billing.

---

### 13 April 2026

**Patient email OTP verification**
- Patients must verify their email via a 6-digit OTP before viewing available slots or submitting a booking.
- OTP is sent via Resend; expires with a short code window.
- `verifiedToken` issued on successful verification — required to call `POST /api/public/bookings`.
- OTP is cleared and re-generated on every resend request.
- New `email_otps` table created at startup to store tokens.

**App startup / workflow fix**
- Installed missing runtime dependency; configured app workflow on port 5000.
- Added `/api/health` and `/api/notifications` root endpoints required by the frontend.
- Local `.env` files excluded from version control.

---

### 6 April 2026

**Digital Consent Workflow (full implementation)**
- Three new API routes: `POST /api/auth/clinic/bookings/:id/request-consent`, `GET /api/consent/:token`, `POST /api/consent/:token/sign`.
- Storage methods added for token generation, retrieval, and signature storage.
- Patient signing page at `/consent/:token` — public, no login required. Shows clinic/doctor info, appointment summary, consent declaration, and signature pad.
- Clinic dashboard panel on each booking card: "Request Consent →" / "Resend →" button, consent URL with copy + open buttons, green "Signed ✓" badge once patient has signed.
- Columns added to `bookings`: `consent_signature`, `consent_signed_at`, `assigned_doctor_email`, `doctor_notes`, `clinical_status` (via isolated migration blocks in `db.ts`).

---

### 30 March 2026

**Doctor profile enhancements**
- Profile photo replaced URL input with direct file upload (Cloudflare R2).
- Added: years of experience field, languages multi-select (English / Malayalam / Tamil / Hindi / Kannada), profile completeness progress bar, Preview Profile button (opens public page in new tab).
- New columns added to `doctors` table: `years_of_experience` (integer), `languages` (TEXT[]).
- Public doctor profile page (`/doctor/:id`) updated to display both new fields.

---

### 8 March 2026

**Auth & admin fixes**
- Added `GET /api/auth/user` endpoint for superuser session checks.
- Fixed superadmin logout flow.
- Expanded Pending Clinics tab in the Super Admin dashboard with full clinic card layout (matching Active tab).

---

### 6 March 2026

**Smile Deals image upload fix**
- Allowed `smile-deals/` as a valid R2 upload folder in the signed-URL endpoint. Previously uploads to the Smile Deals form were being rejected.

---

### 5 March 2026

**Smile Deals marketplace**
- New `smile_deals` table with full schema: title, description, imageUrl, bookingLink, price, originalPrice, category, subcategory, isFlash, isFeatured, startsAt, expiresAt, videoUrl, viewCount, clickCount.
- Super Admin CRUD interface for creating, editing, and deleting deals.
- Public Smile Deals page (`/deals`) — full dark theme, Sora font, ambient glow orbs, stats row, subcategory filter pills, featured hero card, Flash Deals scroll strip, countdown timer, 3-column tilt card grid, referral promo, loyalty teaser.

**Resend email integration**
- Booking confirmation, booking cancellation, and doctor invitation emails wired to Resend API.
- `RESEND=PRODUCTION` / `RESEND=DEV` environment variable controls whether real or test emails are sent.

**Super Admin dashboard — tabbed navigation**
- Admin panel tabbed into Active / Pending / Archived clinic tabs and Smile Deals tab.

**Pricing — Indian Rupee**
- All prices across the platform standardised to ₹ (Indian Rupee).

---

---

## 14. Booking Card Colour System (Clinic Admin — Bookings Panel)

Each booking card encodes two independent dimensions simultaneously using its border colours. The legend in the Bookings panel reflects this two-axis system.

### Two Visual Axes

| Axis | Card element | Shape in legend |
|---|---|---|
| **WHEN** — time of appointment | **Top horizontal bar** (gradient strip across the full card width) | Wide flat horizontal swatch (`h-[5px] w-5`) |
| **STATUS** — verification / visit state | **Left vertical border** (3 px accent stripe); active live states get a **full surrounding border** | Tall thin vertical swatch (`h-4 w-[4px]`); ring swatch for full-border states |

The two axes are always independent: a confirmed booking today shows a sky-blue top bar (Today) **and** an emerald left border (Confirmed) at the same time.

---

### WHEN — Top Bar Colour Reference

| Label | Colour | Tailwind token | Meaning |
|---|---|---|---|
| Today | Sky blue | `bg-sky-400 → cyan-400` | Appointment is today |
| Upcoming | Brand green | `bg-primary → accent` | Future appointment |
| Past | Grey | `bg-slate-300 → slate-200` | Appointment date has passed |

> **Rule:** The top bar always reflects WHEN, regardless of visit or cancellation status. A cancelled past appointment still shows a grey top bar.

---

### STATUS — Left Border Colour Reference

| Legend label | Colour | Tailwind token | Swatch shape | Merged states (shown on hover tooltip) |
|---|---|---|---|---|
| **Confirmed** | Emerald | `emerald-400` | Vertical pip | Confirmed · Visit Completed |
| **Pending** | Amber | `amber-400` | Vertical pip | Awaiting clinic confirmation |
| **Cancelled** | Rose | `rose-400` | Vertical pip | Cancelled by clinic or patient |
| **No Show** | Slate | `slate-400` | Vertical pip | No Show · Left Early |
| **In Consult** | Violet | `violet-500` | **Ring swatch** (full border) | Checked In · In Consult · Treatment in Progress |

#### Merge rationale

| Merged states | Merged into | Reason |
|---|---|---|
| Visit Completed | **Confirmed** (emerald) | Both represent a successfully fulfilled booking; the appointment went to completion |
| Left Early | **No Show** (slate) | Both are unresolved terminal exits — patient did not complete the normal visit flow |
| Checked In | **In Consult** (violet) | Patient is physically present and progressing through the visit lifecycle |
| Treatment Completed | **In Consult** (violet) | Treatment has finished but visit is not yet administratively closed — still an active state |

#### Full-border vs left-border treatment

Cards in the **In Consult** group (Checked In / In Consult / Treatment Completed) render with a **full surrounding border** in violet instead of a left-only stripe. This gives live, actionable visits immediate visual priority over all other states. The legend reflects this with a ring-shaped swatch (hollow square) rather than a vertical pip.

---

### Colour Separation Design Decisions

| Decision | Rationale |
|---|---|
| In Consult changed from teal to **violet** | Emerald (Confirmed) and teal-400 are perceptually similar greens. Violet is clearly distinct on any display. |
| Checked In border changed from sky to **violet** | Sky-400 is the WHEN/Today colour; using it on the STATUS axis caused cross-axis confusion. |
| Treatment Completed merged with In Consult | Both represent an active in-clinic visit; distinguishing them on the card border added noise without clinical value. |
| Top bar for terminal states (Cancelled, No Show, Left Early) is **always WHEN colour** | Previously the top bar turned rose/slate for terminal states, losing WHEN information entirely. Now both axes are always independently readable. |

---

*Document last updated: 3 July 2026 — reflects the current production codebase state.*
