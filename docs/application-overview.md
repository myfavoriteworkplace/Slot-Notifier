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

### In-App Notifications
- A notification bell is shown to authenticated Replit users (superusers)
- Notifications are stored in the `notifications` database table
- Can be marked as read individually

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

*Last updated: May 2026*
*This document reflects the current state of the application. For setup instructions, see `docs/local-development-setup.md`. For deployment, see `docs/render-environment-setup.md`.*
