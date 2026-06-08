# Email Templates Reference

All emails are sent via the **Resend** API from `server/routes.ts`. Every email uses a shared `emailShell()` HTML wrapper (a white card with a coloured header band, a details table, optional CTA buttons, and a footer). The email `from` address is set by the `EMAIL_FROM` environment variable (default: `BookMySlot <onboarding@resend.dev>`).

**Mode switch:** When `RESEND=PRODUCTION` is set, emails go to real addresses. Otherwise ALL emails are redirected to `itsmyfavoriteworkplace@gmail.com` for testing.

---

## Quick Reference Table

| # | Email | Recipient | Trigger |
|---|-------|-----------|---------|
| 1 | [Email OTP — Booking Verification](#1-email-otp--booking-verification) | Patient | Patient requests OTP before booking |
| 2 | [Email OTP — Supplier Listing Verification](#2-email-otp--supplier-listing-verification) | Supplier | Supplier requests OTP before submitting listing |
| 3 | [Booking Received — Patient](#3-booking-received--patient) | Patient | Patient successfully books a slot |
| 4 | [New Booking Request — Clinic](#4-new-booking-request--clinic) | Clinic Admin | Same booking event as #3 |
| 5 | [Appointment Confirmed — Patient](#5-appointment-confirmed--patient) | Patient | Clinic/doctor confirms the booking |
| 6 | [Appointment Cancelled — Patient](#6-appointment-cancelled--patient) | Patient | Clinic or patient cancels a booking |
| 7 | [Appointment Rescheduled — Patient](#7-appointment-rescheduled--patient) | Patient | Clinic moves booking to a new time slot |
| 8 | [New Appointment Assigned — Doctor](#8-new-appointment-assigned--doctor) | Doctor | Clinic assigns a doctor to a booking |
| 9 | [Admin Confirmed on Your Behalf — Doctor](#9-admin-confirmed-on-your-behalf--doctor) | Doctor | Clinic admin confirms without waiting for doctor approval |
| 10 | [Doctor Declined — Clinic Admin](#10-doctor-declined--clinic-admin) | Clinic Admin | Doctor declines an assigned appointment |
| 11 | [Doctor Invite](#11-doctor-invite) | Doctor | Clinic invites a new doctor by email |
| 12 | [Doctor Welcome / Credentials](#12-doctor-welcome--credentials) | Doctor | Doctor account is created (auto-provisioned) |
| 13 | [Clinic Approved / Credentials](#13-clinic-approved--credentials) | Clinic Admin | Superadmin approves a clinic registration |
| 14 | [Password Reset](#14-password-reset) | Clinic Admin or Doctor | User clicks "Forgot Password" |
| 15 | [Password Changed](#15-password-changed) | Clinic Admin or Doctor | User successfully resets their password |
| 16 | [Admin Login OTP (2FA)](#16-admin-login-otp-2fa) | Superadmin | Superadmin enters correct password |
| 17 | [Supplier Listing Request — Admin](#17-supplier-listing-request--admin) | Superadmin | Supplier submits a marketplace listing request |
| 18 | [Supplier Listing Request — Supplier](#18-supplier-listing-request--supplier) | Supplier | Same event as #17 |

---

## Patient / Customer Emails

### 1. Email OTP — Booking Verification

**Recipient:** Patient (person booking)  
**Trigger:** Patient clicks "Send Verification Code" on the public booking page  
**Subject:** `Your BookMySlot verification code`  
**Header colour:** `#3e34b4` (indigo solid)  
**Header title:** Your Verification Code  
**Header subtitle:** Use this code to verify your email and complete your booking

**Body:**
> Enter the code below in the booking form. It is valid for **5 minutes** and can only be used once.
>
> ┌ - - - - - - - - - - - - - ┐  
> YOUR VERIFICATION CODE  
> **`XXXXXX`** ← 6-digit code, 44px monospace  
> └ - - - - - - - - - - - - - ┘
>
> *If you did not request this, you can safely ignore this email.*

**CTA:** None  
**Notes:** Same HTML function (`sendOtpEmail`) is reused for supplier listing OTP (email #2). Code expires after 5 minutes.

---

### 3. Booking Received — Patient

**Recipient:** Patient  
**Trigger:** Patient books a slot (via any booking route — public slot booking, Razorpay flow, or walk-in via clinic portal)  
**Subject:** `Booking Received at {Clinic Name} — Pending Confirmation`  
**Header colour:** `linear-gradient(90deg, #3e34b4 → #a83cd2)` (indigo to purple)  
**Header title:** Booking Received ✓  
**Header subtitle:** Your request has been sent to **{Clinic Name}**.

**Body:**
> Hi **{Patient Name}**,
>
> Thanks for booking with us! Your appointment request is now **pending clinic confirmation**. You will receive another email as soon as the clinic approves it.

**Details table:**
| Field | Value |
|-------|-------|
| Clinic | {Clinic Name} |
| Date & Time | e.g. Monday, 26 May 2025, 10:30 AM |
| Clinic Phone | {phone} *(only shown if clinic has a phone number)* |
| Reference | BMS-{bookingId} *(only shown if booking ID available)* |

**CTA:** `Add to Google Calendar` (indigo button → Google Calendar link, 30-min block)  
**Notes:** Sends simultaneously alongside email #4 (the clinic copy).

---

### 5. Appointment Confirmed — Patient

**Recipient:** Patient  
**Trigger:** Clinic confirms the booking, or doctor accepts the assigned appointment  
**Subject:** `Appointment Confirmed at {Clinic Name} — {Full Date & Time}`  
**Header colour:** `linear-gradient(90deg, #3e34b4 → #a83cd2)` (indigo to purple)  
**Header title:** Appointment Confirmed ✓  
**Header subtitle:** Your booking at **{Clinic Name}** has been confirmed.

**Body:**
> Hi **{Patient Name}**,
>
> Great news — your appointment has been confirmed. Find the details below and please arrive a few minutes early.

**Details table (Appointment Details):**
| Field | Value |
|-------|-------|
| Date & Time | e.g. Monday, 26 May 2025, 10:30 AM |
| Clinic | {Clinic Name} |
| Doctor | {Doctor Name} *(only shown if a doctor is assigned)* |
| Reference | BMS-{bookingId} |

**Clinic Contact section** (shown only if any contact info is present):
| Field | Value |
|-------|-------|
| Phone | {Clinic Phone} |
| Address | {Address} with Google Maps link ↗ |
| Email | {Clinic Email} |

**CTA buttons:** `Add to Google Calendar` + `Get Directions ↗` (only if lat/lng or address is available)  
**Notes:** Triggered from the booking confirmation flow and from the doctor-acceptance flow.

---

### 6. Appointment Cancelled — Patient

**Recipient:** Patient  
**Trigger:** Clinic or patient cancels a booking  
**Subject:** `Appointment Cancelled at {Clinic Name}`  
**Header colour:** `linear-gradient(90deg, #7c3aed → #c026d3)` (violet to fuchsia)  
**Header title:** Appointment Cancelled  
**Header subtitle:** Your booking at **{Clinic Name}** has been cancelled.

**Body:**
> Hi **{Patient Name}**,
>
> Your appointment has been cancelled. If this was unexpected, please contact the clinic directly to rebook.

**Details table:**
| Field | Value |
|-------|-------|
| Clinic | {Clinic Name} |
| Date & Time | {Original appointment time} |

**CTA:** None  
**Notes:** Simple, no rebook link — patient is told to contact the clinic directly.

---

### 7. Appointment Rescheduled — Patient

**Recipient:** Patient  
**Trigger:** Clinic moves an existing booking to a different time slot  
**Subject:** `Your Appointment Has Been Rescheduled — {Clinic Name}`  
**Header colour:** `linear-gradient(90deg, #085041 → #0F9B6E)` (app brand dark green to primary green)  
**Header title:** Appointment Rescheduled  
**Header subtitle:** Your appointment at **{Clinic Name}** has been moved to a new time.

**Body:**
> Hi **{Patient Name}**,
>
> Your appointment has been rescheduled by the clinic. Please see the updated details below. If this does not suit you, please contact the clinic directly.

**Details table:**
| Field | Value |
|-------|-------|
| Previous Time | {Old date & time} |
| New Time | **{New date & time}** (highlighted in dark green) |
| Clinic | {Clinic Name} |
| Clinic Phone | {phone} *(only shown if available)* |
| Reference | BMS-{bookingId} |

**CTA:** `Add to Google Calendar` (green button, links to the **new** time)

---

## Clinic Admin Emails

### 4. New Booking Request — Clinic

**Recipient:** Clinic Admin (the clinic's registered email address)  
**Trigger:** Patient books a slot — fires together with email #3  
**Subject:** `New Booking Request: {Patient Name} — {Date & Time}`  
**Header colour:** `linear-gradient(90deg, #1e1c3c → #3e34b4)` (deep navy to indigo)  
**Header title:** New Booking Request  
**Header subtitle:** A patient has requested an appointment at **{Clinic Name}**.

**Body:**
> A new appointment request is waiting for your review. Log in to your Clinic Portal to confirm or manage this booking.

**Details table:**
| Field | Value |
|-------|-------|
| Patient | {Patient Name} |
| Phone | {Patient Phone} *(only shown if provided)* |
| Email | {Patient Email} *(only shown if provided)* |
| Date & Time | {Date & Time} |
| Reference | BMS-{bookingId} |

**CTA:** None  
**Notes:** No action button — clinic staff are expected to log in to the portal.

---

### 10. Doctor Declined — Clinic Admin

**Recipient:** Clinic Admin  
**Trigger:** Assigned doctor clicks "Decline" on an appointment in their Doctor Portal  
**Subject:** `⚠ Doctor Declined: {Patient Name}'s appointment at {Clinic Name} — action needed`  
**Header colour:** `linear-gradient(90deg, #991b1b → #b45309)` (dark red to amber — urgency)  
**Header title:** Doctor Declined — Action Needed  
**Header subtitle:** A doctor has declined an assignment at **{Clinic Name}**.

**Body:**
> Hi,
>
> **{Doctor Name}** has declined the appointment below. Please log in to your Clinic Portal to reassign a doctor or take further action before the patient's slot time.

**Details table:**
| Field | Value |
|-------|-------|
| Patient | {Patient Name} |
| Doctor | {Doctor Name} |
| Date & Time | {Date & Time} |
| Reference | BMS-{bookingId} |

**CTA:** `Manage in Clinic Portal →` (dark red button, href currently `#` — placeholder)  
**Notes:** ⚠ The CTA href is hardcoded as `'#'` — it does not link to the actual booking. This is a known gap.

---

## Doctor Emails

### 8. New Appointment Assigned — Doctor

**Recipient:** Doctor  
**Trigger:** Clinic assigns a doctor to a booking  
**Subject:** `Action Required: New appointment assigned to you at {Clinic Name}`  
**Header colour:** `linear-gradient(90deg, #1e1c3c → #3e34b4)` (navy to indigo)  
**Header title:** New Appointment — Action Required  
**Header subtitle:** You have been assigned a patient at **{Clinic Name}**.

**Body:**
> Hi **{Doctor Name}**,
>
> A new appointment has been assigned to you and is **awaiting your approval**. Please log in to your Doctor Portal to accept or decline.

**Details table:**
| Field | Value |
|-------|-------|
| Patient | {Patient Name} |
| Clinic | {Clinic Name} |
| Date & Time | {Date & Time} |
| Reference | BMS-{bookingId} |

**CTA:** `View in Doctor Portal →` (indigo button, href currently `'#'` — placeholder)  
**Notes:** ⚠ The CTA href is hardcoded as `'#'`. Doctor must log in manually to the portal. Known gap.

---

### 9. Admin Confirmed on Your Behalf — Doctor

**Recipient:** Doctor  
**Trigger:** Clinic admin confirms a booking without waiting for doctor approval (overrides pending status)  
**Subject:** `FYI: Clinic admin confirmed an appointment on your behalf at {Clinic Name}`  
**Header colour:** `linear-gradient(90deg, #b45309 → #d97706)` (amber tones — informational)  
**Header title:** Appointment Confirmed by Admin  
**Header subtitle:** The clinic admin confirmed a booking on your behalf at **{Clinic Name}**.

**Body:**
> Hi **{Doctor Name}**,
>
> The clinic admin confirmed the appointment below on your behalf without waiting for your approval. This appointment is now active on your schedule.

**Details table:**
| Field | Value |
|-------|-------|
| Patient | {Patient Name} |
| Clinic | {Clinic Name} |
| Date & Time | {Date & Time} |
| Reference | BMS-{bookingId} |

**CTA:** `Add to Google Calendar` (amber button)

---

### 11. Doctor Invite

**Recipient:** Doctor (email address typed in by clinic admin)  
**Trigger:** Clinic admin invites a new doctor from the Manage Doctors panel  
**Subject:** `You've been invited to join {Clinic Name} on BookMySlot`  
**Header colour:** `linear-gradient(90deg, #3e34b4 → #a83cd2)` (indigo to purple)  
**Header title:** You've Been Invited  
**Header subtitle:** **{Clinic Name}** has added you as a doctor on BookMySlot.

**Body:**
> Hi there,
>
> You have been invited to join **{Clinic Name}** on BookMySlot. Click the button below to set up your Doctor Portal account and start managing your appointments.
>
> ┌────────────────────────────────────────┐  
> This invitation link will expire. If you did not expect this email, you can safely ignore it.  
> └────────────────────────────────────────┘

**CTA:** `Set Up My Account →` (indigo button → invite link with token)  
**Notes:** This is the "invite before account exists" flow. The doctor sets their own password via the link. Email #12 (Doctor Welcome) is the "account already created" flow.

---

### 12. Doctor Welcome / Credentials

**Recipient:** Doctor  
**Trigger:** Clinic admin creates a doctor account directly (auto-provisioned with a temp password, no invite link)  
**Subject:** `Welcome to {Clinic Name} — Your Doctor Portal credentials`  
**Header colour:** `linear-gradient(90deg, #059669 → #10b981)` (emerald green)  
**Header title:** Welcome to BookMySlot  
**Header subtitle:** You've been added as a doctor at **{Clinic Name}**

**Body:**
> Hi Dr. {Doctor Name},
>
> You've been added to **{Clinic Name}** on BookMySlot. Use the credentials below to sign in to your Doctor Portal.
>
> | | |
> |---|---|
> | Login ID (Email) | `doctor@example.com` |
> | Temporary Password | `Bms@XXXXXXXX` |
>
> ⚠ Please change your password after your first login for security.

**CTA:** `Sign In to Doctor Portal →` (emerald button → `{FRONTEND_URL}/clinic-login`)  
**Notes:** Temp password format is always `Bms@` + 8 random alphanumeric characters.

---

## Clinic Onboarding Emails

### 13. Clinic Approved / Credentials

**Recipient:** Clinic Admin (the email used during registration)  
**Trigger:** Superadmin approves a pending clinic in the Admin Panel  
**Subject:** `Your clinic "{Clinic Name}" has been approved on BookMySlot`  
**Header colour:** `linear-gradient(90deg, #3e34b4 → #1ab97c)` (indigo to teal — celebratory)  
**Header title:** 🎉 Your Clinic is Approved!  
**Header subtitle:** Welcome to BookMySlot, **{Clinic Name}**

**Body:**
> Congratulations! Your clinic registration has been reviewed and approved by our team.
>
> Here are your login credentials. We recommend changing your password after your first login.
>
> | Your Login Credentials | |
> |---|---|
> | Username | `{username}` |
> | Password | `{plainPassword}` |
>
> *Keep this email safe. Do not share your credentials with anyone.*

**Activation section** (shown only if `activationUrl` is set — i.e. a paid plan):
> ┌── gradient banner (indigo→teal) ──┐  
> **Next Step — Activate Your Subscription — {Plan Name}**  
> Complete your payment to unlock all dashboard features. Your activation link expires in 7 days.  
> `[ Activate Now & Pay → ]`  
> └────────────────────────────────────┘

**CTA (always shown):** `Go to Clinic Dashboard →` (teal button → `{FRONTEND_URL}/clinic-login`)

---

## Account & Security Emails

### 14. Password Reset

**Recipient:** Clinic Admin or Doctor (depending on who requested it)  
**Trigger:** User submits "Forgot Password" form  
**Subject:** `Reset your BookMySlot {Clinic Account / Doctor Account} password`  
**Header colour:** `linear-gradient(90deg, #3e34b4 → #1ab97c)` (indigo to teal)  
**Header title:** 🔐 Reset Your Password  
**Header subtitle:** Password reset request for your **{Clinic Account / Doctor Account}**

**Body:**
> We received a request to reset the password for your BookMySlot {Clinic Account / Doctor Account}. Click the button below to choose a new password.
>
> This link expires in **30 minutes**. If you did not request a password reset, you can safely ignore this email — your password will not change.

**CTA:** `Reset My Password →` (indigo button → reset URL with token)  
**Notes:** The label (`Clinic Account` / `Doctor Account`) is derived from the `userType` parameter. The reset URL contains a one-time token stored in the `activation_tokens` table.

---

### 15. Password Changed

**Recipient:** Clinic Admin or Doctor  
**Trigger:** User successfully sets a new password via the reset link  
**Subject:** `Your BookMySlot {Clinic Account / Doctor Account} password was changed`  
**Header colour:** `linear-gradient(90deg, #1ab97c → #3e34b4)` (teal to indigo — reversed from #14)  
**Header title:** ✅ Password Changed  
**Header subtitle:** Your **{Clinic Account / Doctor Account}** password was updated

**Body:**
> Your BookMySlot {Clinic Account / Doctor Account} password was successfully changed.
>
> If you did not make this change, please contact support immediately at [bookmyslot@mail.mossaic.in](mailto:bookmyslot@mail.mossaic.in).

**CTA:** None

---

## Admin / Internal Emails

### 16. Admin Login OTP (2FA)

**Recipient:** Superadmin (the `ADMIN_EMAIL` environment variable)  
**Trigger:** Superadmin enters their correct password — second-factor OTP is sent  
**Subject:** `BookMySlot Admin — Your Login OTP`  
**Template style:** Custom HTML (does **not** use `emailShell` — has its own branded box)  
**Header:** Green-badged `bookMySlot` logo mark on `#f9fafb` background  

**Body:**
> **Admin Login Verification**
>
> Use the code below to complete your login. It expires in **10 minutes**.
>
> ┌────────────────────────────┐  
> **XXXXXX** ← 6-digit OTP, 38px, letter-spacing 10px, colour `#0F9B6E`  
> └────────────────────────────┘
>
> *If you did not request this, your password may be compromised. Please change it immediately.*

**CTA:** None  
**Notes:** OTP stored in-memory in `adminOtpStore` (not in the database). Valid for 10 minutes. Only one active OTP at a time — requesting a new one overwrites the old one.

---

## Supplier Marketplace Emails

These two emails fire together when a supplier submits a listing request on the Smile Deals public page.

### 17. Supplier Listing Request — Admin

**Recipient:** Superadmin (`ADMIN_EMAIL` env var)  
**Trigger:** Supplier completes OTP verification and submits their listing form  
**Subject:** `New Supplier Listing Request — {Company Name}`  
**Template style:** Custom HTML (does **not** use `emailShell` — has its own layout)  
**Header:** Dark gradient banner (`#085041 → #0F9B6E`) with label "BookMySlot — Supplier Marketplace"  

**Body:** Plain table of all submitted fields:
| Field | Value |
|-------|-------|
| Company / Brand | {companyName} |
| Business Email | {email} ✓ Verified (green badge) |
| Phone | {phone} |
| Category | {category} |
| Description | {description} *(only shown if provided)* |
| Website | {website as link} *(only shown if provided)* |
| Submitted At | IST timestamp |

Green info box: *"Log in to the admin panel to approve, create a deal, or contact this supplier."*  
**CTA:** None

---

### 18. Supplier Listing Request — Supplier

**Recipient:** Supplier (the email they verified via OTP)  
**Trigger:** Same event as #17  
**Subject:** `We received your listing request — BookMySlot`  
**Template style:** Custom HTML (same style as #17)  
**Header:** Same dark gradient banner (`#085041 → #0F9B6E`)

**Body:**
> Hi **{Company Name}**,
>
> Thank you for applying to list on **BookMySlot Smile Deals**. Our team will review your request and get back to you within **2 working days**.

**Details box:**
| Field | Value |
|-------|-------|
| Company | {companyName} |
| Category | {category} |
| Website | {website} *(only shown if provided)* |

> If you have questions in the meantime, reply to this email or write to [hello@bookmyslot.in](mailto:hello@bookmyslot.in).

**CTA:** None

---

### 2. Email OTP — Supplier Listing Verification

**Recipient:** Supplier  
**Trigger:** Supplier clicks "Send Code" on the Smile Deals supplier listing form (before submission)  
**Subject:** `Your BookMySlot verification code`  
**Template:** Identical to email #1 (Patient Booking OTP) — same `sendOtpEmail()` function  
**Code validity:** 5 minutes  
**Notes:** OTP stored in `email_otps` table with `purpose = 'supplier-listing'`. After verification the row is marked `verified = true` and a `verifiedToken` UUID is returned to the frontend to use during the actual submission request.

---

## Known Gaps & Observations

| Issue | Detail |
|-------|--------|
| Doctor Portal CTA links are broken | Emails #8 and #10 have `href="#"` as the button link — doctors cannot click through to the portal from the email |
| No patient cancellation email from the patient side | Email #6 fires when the clinic cancels. There is no separate email for when the patient cancels their own booking |
| No email when a clinic self-registers | Clinic gets nothing until a superadmin approves them (email #13). No acknowledgement email is sent at registration time |
| Supplier OTP email uses booking OTP template | The purple/indigo colour scheme in the OTP email looks unrelated to the green Smile Deals branding — minor but noticeable |
| Admin OTP uses a different visual style | Email #16 does not use the shared `emailShell` wrapper, so it looks different from all other emails |
| `support@bookmyslot.in` in email #15 | This address is hardcoded — verify that it is a real, monitored inbox |
| `hello@bookmyslot.in` in email #18 | Same as above — verify this inbox exists and is monitored |
