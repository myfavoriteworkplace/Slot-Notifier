# PII Compliance — BookMySlot Dental SaaS

**Document owner:** Engineering & Operations  
**Last updated:** June 2026  
**Applicable laws:** India Digital Personal Data Protection Act 2023 (DPDP), MCI Regulations, general healthcare data best practices  
**Scope:** All patient, clinic, and doctor data stored, processed, or transmitted by the BookMySlot platform

---

## 1. What Is PII and Why Does It Matter Here?

**PII (Personally Identifiable Information)** is any piece of data that can be used — on its own or combined with other data — to identify a real person.

For a dental booking platform like BookMySlot, this covers two layers:

- **General identifiers** — name, phone number, email address, age, gender. These identify *who* the person is.
- **Sensitive health data** — diagnosis, prescriptions, clinical notes, X-rays, consent signatures, IP addresses linked to medical events. These reveal *what medical care* the person received.

Both layers carry legal responsibilities. Under India's **DPDP Act 2023**, any company that collects, stores, or processes personal data of Indian citizens must handle it responsibly — collect only what's needed, protect it from unauthorised access, respect the person's right to delete their data, and be transparent about how it's used.

A dental SaaS platform handles some of the most sensitive personal data that exists. A patient's diagnosis or prescription, if leaked, can affect their insurance, employment, and personal relationships. **Getting this right is not optional — it's a baseline responsibility.**

---

## 2. What Personal Data Does BookMySlot Currently Store?

Below is a complete inventory of every database table that holds personal data, what fields are sensitive, and what they are used for.

### 2.1 Patient Data

#### `patients` table
Stores a master record for each unique patient at a clinic.

| Field | What it is | Sensitivity |
|---|---|---|
| `name` | Patient's full name | 🟡 Medium — general identifier |
| `email` | Patient's email address | 🟡 Medium — general identifier |
| `phone` | Patient's mobile number | 🟡 Medium — general identifier |
| `age` | Patient's age | 🟡 Medium — general identifier |
| `gender` | Patient's gender | 🟡 Medium — general identifier |
| `patient_code` | Internal clinic reference number | 🟢 Low — no direct identity link |
| `visit_count` | How many times they've visited | 🟢 Low |
| `last_visit_at` | Date of most recent visit | 🟢 Low |

#### `bookings` table
Created every time a patient books an appointment. This table carries the most PII in the system.

| Field | What it is | Sensitivity |
|---|---|---|
| `customer_name` | Patient's name at time of booking | 🟡 Medium — general identifier |
| `customer_phone` | Patient's phone at time of booking | 🟡 Medium — general identifier |
| `customer_email` | Patient's email at time of booking | 🟡 Medium — general identifier |
| `customer_age` | Patient's age at time of booking | 🟡 Medium — general identifier |
| `customer_gender` | Patient's gender at time of booking | 🟡 Medium — general identifier |
| `description` | Reason for visit, typed by patient | 🔴 High — health information |
| `doctor_notes` | Notes added by assigned doctor | 🔴 High — clinical health data |
| `clinical_status` | e.g. "Under treatment", "Completed" | 🔴 High — health information |
| `consent_signature` | Base64 image of patient's handwritten signature | 🔴 High — biometric-adjacent |
| `consent_ip` | IP address of device used to sign consent | 🔴 High — location-linked PII |
| `cancellation_reason` | Why an appointment was cancelled | 🟡 Medium |
| `visit_completion_note` | Clinic's summary note after visit | 🔴 High — clinical health data |
| `treatment_category` | Type of treatment received | 🔴 High — health information |

#### `clinical_records` table
Stores the formal medical record created by a doctor after a visit.

| Field | What it is | Sensitivity |
|---|---|---|
| `patient_name` | Patient's name (duplicated from booking) | 🟡 Medium |
| `patient_phone` | Patient's phone (duplicated from booking) | 🟡 Medium |
| `diagnosis` | Diagnosed dental condition(s) | 🔴 High — sensitive health data |
| `prescription` | Medications prescribed | 🔴 High — sensitive health data |
| `notes` | Doctor's free-text notes | 🔴 High — sensitive health data |

#### `booking_notes` table
Free-text notes added by clinic staff or doctors during or after a visit.

| Field | What it is | Sensitivity |
|---|---|---|
| `content` | Free-text note — may contain clinical observations | 🔴 High — potentially sensitive health data |
| `author_name` | Name of the staff member who wrote the note | 🟡 Medium |

#### `consent_tokens` table
Tracks the short-lived links sent to patients for signing the digital consent form.

| Field | What it is | Sensitivity |
|---|---|---|
| `token` | One-time URL token sent via WhatsApp | 🟡 Medium — if intercepted, could expose consent form |

#### `email_otps` table
Stores one-time passwords sent to patients for booking verification.

| Field | What it is | Sensitivity |
|---|---|---|
| `email` | Patient's email address | 🟡 Medium |
| `otp_hash` | Hashed OTP code (safe — not plain text) | 🟢 Low |

---

### 2.2 Clinic & Staff Data

#### `clinics` table

| Field | What it is | Sensitivity |
|---|---|---|
| `email` | Clinic's contact/login email | 🟡 Medium |
| `phone` | Clinic's phone number | 🟡 Medium |
| `address` | Physical clinic address | 🟡 Medium |
| `gst_number` | Tax registration number | 🟡 Medium — financial identifier |
| `medical_license_url` | Link to uploaded medical licence document | 🔴 High — regulatory document |
| `clinic_reg_cert_url` | Link to uploaded registration certificate | 🔴 High — regulatory document |
| `password_hash` | Login password (bcrypt hashed) | 🟢 Low — correctly protected |

#### `doctors` table

| Field | What it is | Sensitivity |
|---|---|---|
| `name` | Doctor's full name | 🟡 Medium |
| `email` | Doctor's login email | 🟡 Medium |
| `phone` | Doctor's phone number | 🟡 Medium |
| `bio` | Professional biography | 🟢 Low — intended to be public |
| `password_hash` | Login password (bcrypt hashed) | 🟢 Low — correctly protected |

---

### 2.3 System / Auth Data

#### `users` table (Replit OIDC users — superadmins and customers)

| Field | What it is | Sensitivity |
|---|---|---|
| `email` | User's email from Replit login | 🟡 Medium |
| `first_name` / `last_name` | User's name | 🟡 Medium |
| `profile_image_url` | Profile photo URL | 🟢 Low |

#### `session` table

| Field | What it is | Sensitivity |
|---|---|---|
| `sess` | Full session JSON — may contain user identity + auth tokens | 🔴 High — must not be exposed |

---

## 3. Who Can See What — Current Access Model

BookMySlot uses four roles. Here is what each role can currently access:

| Role | Who they are | What they can see today |
|---|---|---|
| **Superuser** | BookMySlot platform admin | Everything — all clinics, all data, all settings |
| **Clinic Owner / Receptionist** | Clinic staff logging in with clinic credentials | All bookings, patients, clinical records, billing for their own clinic |
| **Doctor** | Individual doctor logging in with doctor credentials | Bookings assigned to them, clinical records they can write, their own profile |
| **Customer** | Patient who booked using Replit login | Their own bookings only |
| **Public / Guest** | Unauthenticated patient booking via OTP | Can book a slot and sign a consent form — nothing else |

**Current gap:** Clinic owners can currently see ALL bookings and patient records for their clinic, regardless of which doctor handled the patient. Ideally, receptionists should see appointment logistics (name, time, phone) but not clinical notes (diagnosis, prescriptions). Doctors should only see patients assigned to them.

---

## 4. Third-Party Services That Handle Patient Data

Every time a booking is made or a notification is sent, patient data travels outside our database and into third-party systems. Here is a complete picture of what each service receives.

| Service | What patient data it receives | DPA (Data Agreement) available? | Status |
|---|---|---|---|
| **Resend** (email provider) | Patient name, email, appointment date & time, clinic name | Yes — resend.com/dpa | ❌ Not signed yet |
| **Twilio / WhatsApp** | Patient name, phone number, appointment details, consent form link | Yes — twilio.com/legal/dpa | ❌ Not signed yet |
| **Cloudflare R2** (file storage) | Clinic documents, uploaded images (may include patient-facing forms) | Yes — cloudflare.com/gdpr | ❌ Not signed yet |
| **Razorpay** (payments) | Clinic identity, subscription metadata (no direct patient data) | Yes — check Razorpay DPA | ❌ Not signed yet |
| **Hugging Face AI** (X-ray analysis) | X-ray images — actual medical imaging data | ⚠️ Unclear — self-hosted space | ❌ Not verified |
| **Render** (hosting + database) | All data — hosts the entire PostgreSQL database | Yes — render.com/privacy | ❌ Not signed yet |
| **Google Maps** | Clinic addresses only — no patient data | Standard terms | ✅ Acceptable |

> ⚠️ **Hugging Face is the highest-risk vendor.** X-ray images are some of the most sensitive medical data a patient can share. We need to verify whether the HF Space endpoint logs or retains images after analysis. If it does, we need either a DPA or to move the AI service to infrastructure we fully control.

---

## 5. Compliance Checklist — Status & Plan

Each item below maps to the checklist you provided. Every item is explained in plain language, followed by what's already done, what's pending, and a status indicator.

---

### Item 1 — Data Inventory
**What this means in plain English:**  
Know exactly what personal information you hold, where it lives, and how sensitive it is. You cannot protect data you don't know you have. Think of it like taking stock of what's in a pharmacy — you need to know what you have before you can store it safely.

**What's already done:**  
This document is the data inventory. The tables and field-by-field breakdown in Section 2 above is the formal record.

**What's pending:**  
- Keep this document updated whenever a new field or table is added to the schema
- Add a brief entry to this document whenever a new third-party service is integrated

| Status | Owner | Target Date |
|---|---|---|
| ✅ Done (this document) | Engineering | June 2026 |

---

### Item 2 — Data Minimization
**What this means in plain English:**  
Only collect information you actually need. If you ask for a patient's age but never use it for anything clinically meaningful, you shouldn't store it. Every extra field you store is an extra field that can be leaked or misused.

**What's already done:**  
- The app does not collect insurance numbers, home addresses, or government IDs from patients — good
- OTP codes are stored as hashed values, not plain text ✅

**What's pending:**  
- `bookings` table stores `customer_age` and `customer_gender` as duplicates of what's already in the `patients` table — one of these copies should be removed
- `clinical_records` stores `patient_name` and `patient_phone` as copies of what's in `patients` — should reference the `patients` table instead of duplicating
- `consent_signature` (a large base64 image) lives inline in the `bookings` row — this should move to a dedicated table with stricter access control

| Status | Owner | Target Date |
|---|---|---|
| ⚠️ Partial | Engineering | Phase 3 |

---

### Item 3 — Encryption
**What this means in plain English:**  
Data should be scrambled (encrypted) so that even if someone gains unauthorised access to the database files, they cannot read the information. There are two types:
- **Encryption at rest** — the data is scrambled when it's sitting in the database
- **Encryption in transit** — the data is scrambled while it's travelling over the internet between the user's browser and our server

**What's already done:**  
- **Encryption in transit:** Render provides TLS (HTTPS) for all connections — patient data is always encrypted while moving between the browser and the server ✅
- **Password hashing:** All clinic and doctor passwords are stored as bcrypt hashes — even we cannot read them ✅

**What's pending:**  
- **Encryption at rest for sensitive fields:** The highest-risk fields — `clinical_records.diagnosis`, `clinical_records.prescription`, `clinical_records.notes`, `bookings.consent_signature`, `bookings.doctor_notes` — are currently stored as plain readable text in the database. These should be encrypted using PostgreSQL's built-in `pgcrypto` extension (AES-256). Only the application server, using a secret key stored in Render's environment variables, would be able to decrypt them.
- **Verify Render's disk-level encryption:** Render may already encrypt the entire database disk at the infrastructure level. This should be confirmed in the Render dashboard — if confirmed, it covers the basic "encrypt at rest" requirement for DPDP compliance.
- **Key management:** The encryption key should be stored in Render's secure environment variable store (not in the codebase or database). For a higher level of protection, this key could later be moved to a cloud key management service (AWS KMS or similar).

| Status | Owner | Target Date |
|---|---|---|
| ⚠️ Partial (transit done, at-rest pending) | Engineering | Phase 4 |

---

### Item 4 — Access Control
**What this means in plain English:**  
Different people should see different things. A receptionist who books appointments should not be able to read a patient's diagnosis. A doctor should only see their own patients. The admin should not be able to casually browse clinical notes they have no reason to see. This principle is called "least privilege" — every person gets access to the minimum they need to do their job.

**What's already done:**  
- Four distinct roles exist (Superuser, Clinic Owner, Doctor, Customer) ✅
- Clinic owners can only see data for their own clinic (enforced in API routes) ✅
- Doctors log in separately from clinic staff ✅
- Patients can only see their own bookings ✅

**What's pending:**  
- **No sub-role within the clinic:** Today all clinic staff log in with a single set of credentials. There is no distinction between a receptionist (should see appointments only) and a clinic admin (should see billing and clinical records). A `staff_roles` system needs to be designed.
- **Doctor scoping is incomplete:** Doctors can currently see all bookings assigned to their clinic. The system should restrict doctors to only see bookings where they are the assigned doctor.
- **No Row-Level Security (RLS) on the database:** Even if application code has bugs, PostgreSQL RLS would act as a backstop — enforcing that a query for clinic A can never accidentally return data for clinic B. This needs to be added to the PII tables.
- **No Multi-Factor Authentication (MFA):** Clinic owners and doctors currently log in with username and password only. Adding a second factor (e.g. a code from Google Authenticator) would significantly reduce the risk of unauthorised access if a password is stolen.

| Status | Owner | Target Date |
|---|---|---|
| ⚠️ Partial | Engineering | Phase 6 |

---

### Item 5 — Audit & Monitoring
**What this means in plain English:**  
Every time someone looks at, changes, or deletes patient data, that action should be recorded — who did it, when, from which device, and what they changed. This is like a CCTV log for your database. If something goes wrong (a data breach, an unauthorised access), you need to be able to go back and see exactly what happened. Most healthcare regulations require this log to be kept for several years.

**What's already done:**  
- Nothing. There is currently no audit trail in the application.

**What's pending:**  
- Create an `audit_logs` table: records the role (clinic, doctor, superuser), their ID, the action (viewed / created / updated / deleted), the type of record (booking, patient, clinical record), the record's ID, the IP address, the device/browser, and a timestamp.
- Add middleware to the Express server that automatically writes to this log whenever an API route touches PII data — no manual logging needed in individual route handlers.
- Audit logs should ideally be stored in a separate, write-only location (separate database or cloud storage bucket) so they cannot be tampered with.
- Set up basic alerting: if the same user downloads an unusually high number of patient records in a short time, flag it for review.

| Status | Owner | Target Date |
|---|---|---|
| ✅ Done — June 2026 | Engineering | — |

---

### Item 6 — Consent Management
**What this means in plain English:**  
Before collecting and using a patient's personal data — especially health data — you must get their clear, informed agreement. That agreement (consent) must be recorded. And importantly, the patient must have the right to withdraw that consent at any time, and when they do, their data must be handled accordingly.

**What's already done:**  
- A digital consent form flow exists: the clinic sends a WhatsApp link to the patient → the patient draws their signature on a mobile-friendly page → the signature is saved ✅
- The consent signature and timestamp are stored with the booking ✅

**What's pending:**  
- **Consent text versioning:** We store the signature but not which version of the consent text the patient agreed to. If the consent wording changes, we cannot prove what the patient actually agreed to. Each signature must be linked to a specific version of the consent text.
- **Consent revocation:** Patients currently have no way to withdraw their consent. An endpoint needs to be created where a patient can request revocation. When processed, their non-treatment-critical PII should be anonymised and a record of the revocation kept.
- **Consent before data collection:** The consent flow currently happens after booking (the clinic sends the link manually). Ideally, basic consent should be captured at the point of booking — before clinical data is stored.
- **Move signature to dedicated table:** The consent signature currently lives as a large text blob in the `bookings` table. It should move to a dedicated `consent_records` table with its own access controls.

| Status | Owner | Target Date |
|---|---|---|
| ⚠️ Partial | Engineering | Phase 3 |

---

### Item 7 — Retention & Deletion
**What this means in plain English:**  
You should not keep patient data forever "just in case." There are legal guidelines for how long medical records must be kept, and after that window, data should be deleted or anonymised. Patients also have the legal right to ask you to delete their data (the "right to erasure") — and you must be able to comply.

**What's already done:**  
- Nothing. Records are never automatically deleted or anonymised.

**What's pending:**  
- Define and document retention periods:
  - Clinical records and bookings: **7 years** from date of last visit (aligns with MCI guidance and DPDP's "as long as necessary" principle for medical treatment)
  - General booking data (name, phone, email with no clinical record): **3 years**
  - Audit logs: **7 years**
  - OTP records: **30 days** (already short-lived, just needs cleanup)
- Build a scheduled job (runs monthly) that finds records past their retention window and **anonymises** them — replacing PII fields with `[DATA REMOVED]` or NULL, while keeping the structural record (booking ID, dates, treatment category) for statistical purposes.
- Build a **Right to Erasure endpoint**: when a patient requests deletion of their data, all PII linked to them across all tables is anonymised, a record of the erasure request is kept, and a confirmation is sent to the patient.
- **Note:** We should never hard-delete rows — audit trails and booking structures must be preserved. Only the personal data fields are anonymised.

| Status | Owner | Target Date |
|---|---|---|
| ❌ Not started | Engineering | Phase 5 |

---

### Item 8 — Vendor Compliance
**What this means in plain English:**  
When we share patient data with other companies (email providers, SMS services, payment processors), those companies become responsible for handling that data properly too. We need formal written agreements (called Data Processing Agreements or DPAs) with each of them. Without these agreements, we have no legal assurance that they are protecting the data we share.

**What's already done:**  
- All major vendors (Resend, Twilio, Cloudflare, Render, Razorpay) have DPAs available to sign. We just haven't signed them yet.

**What's pending:**  
- Sign DPAs with: Resend, Twilio, Cloudflare, Render, Razorpay. Store signed copies securely.
- **Hugging Face X-ray AI:** This is the highest-priority vendor risk. X-ray images are sensitive medical data. We need to:
  1. Check whether the HF Space endpoint logs or retains images after analysis
  2. If it does — either obtain a DPA, switch to a self-hosted model, or add explicit patient consent specifically for AI analysis before sending images
- Document all vendor relationships in a **Vendor Risk Register** (a simple spreadsheet: vendor name, data shared, DPA status, last review date).

| Status | Owner | Target Date |
|---|---|---|
| ❌ Not started | Operations / Engineering | Phase 1 (quick win — mostly paperwork) |

---

## 5b. Data Retention — How Long to Keep Each Type of Record

This section explains exactly how long each type of data should be kept before it is deleted or anonymised. These periods are based on India's DPDP Act 2023, Medical Council of India guidelines, and standard dental practice in India.

### The Rule of Thumb for a Dental SaaS in India

| Data type | How long to keep | Why |
|---|---|---|
| **Audit logs** (who accessed patient data, when, from where) | **7 years** | Must match the clinical record window. If a patient disputes access to their record 5 years from now, you need the audit trail to prove who saw it and when. |
| **Clinical records** (diagnosis, prescription, notes) | **7 years from last visit** | Medical Council of India guidance for outpatient dental records. DPDP's "as long as necessary" principle for medical treatment aligns here. |
| **Bookings and appointments** | **7 years** | Linked to clinical records — cannot be anonymised independently. |
| **Consent signatures** | **For the life of the clinical record + 2 years** | You must be able to prove consent existed as long as the medical record can be legally challenged. |
| **Billing records** | **7 years** | GST compliance in India requires financial records for 7 years. |
| **Login events** (`login_events` table) | **3 years** | Security incident investigation rarely looks back further. |
| **OTP records** (`email_otps` table) | **30–60 days** | No compliance value after the booking is confirmed. |
| **Export history** | **3 years** | Useful for auditing bulk data exports — no longer needed after that. |

### What "Retain for 7 years" means in practice

We do **not** hard-delete rows. The booking record (ID, date, slot, treatment category) is kept forever for statistical and audit purposes. What gets removed is the **personal data fields** — name, phone, email, age, diagnosis, prescription, notes — which are replaced with `[DATA REMOVED]`. This is called **anonymisation**, not deletion. The record still exists; the person is no longer identifiable from it.

### Implementation note

The monthly anonymisation job (Phase 5) will handle this automatically. Until Phase 5 is built, records are kept indefinitely — which is acceptable for now since we are still within the retention window for all existing data.

---

## 6. Implementation Roadmap

This is the full plan, broken into phases in recommended priority order. Each phase is self-contained and can be done without disrupting the app.

| Phase | What we're doing | Why this first | Effort | Status |
|---|---|---|---|---|
| **Phase 1** | Sign vendor DPAs (Resend, Twilio, Cloudflare, Render, Razorpay). Verify Render disk-level TDE. Investigate Hugging Face X-ray data retention. Create this compliance document. | Fastest wins — mostly paperwork, no code changes, immediately reduces legal exposure | Low (2–3 days) | ⚠️ In Progress |
| **Phase 2** | Build audit logging: `audit_logs` table + Express middleware that records every PII access automatically | Highest visibility to auditors. Covers all routes without touching individual endpoints. | Medium (3–5 days) | ✅ Done — June 2026 |
| **Phase 3** | Harden consent: move signature to dedicated `consent_records` table, add text versioning, add revocation endpoint | Closes the biggest gap in the existing consent flow | Medium (3–4 days) | ❌ Not started |
| **Phase 4** | Column-level encryption: encrypt `diagnosis`, `prescription`, `notes`, `consent_signature`, `doctor_notes` using PostgreSQL pgcrypto (AES-256) | Protects the most sensitive fields even if the database is compromised | Medium-High (1 week) | ❌ Not started |
| **Phase 5** | Retention & erasure: add monthly anonymisation job + right-to-erasure API endpoint | Legal requirement under DPDP. Protects patients and limits our liability over time. | Medium (1 week) | ❌ Not started |
| **Phase 6** | Access tightening: PostgreSQL Row-Level Security on PII tables, doctor-scoped queries, optional MFA for clinic/doctor login | Strongest protection layer — makes data leaks through bugs structurally impossible | High (2 weeks) | ❌ Not started |

---

## 7. Glossary

| Term | Plain-English meaning |
|---|---|
| **PII** | Any data that identifies a real person — name, phone, email, medical history |
| **Sensitive health data** | A sub-category of PII — diagnosis, prescriptions, clinical notes. Carries higher legal protection. |
| **DPDP Act** | India's Digital Personal Data Protection Act 2023 — the main privacy law that applies to this platform |
| **DPA (Data Processing Agreement)** | A legal contract with a third-party vendor stating how they will protect data we share with them |
| **Encryption at rest** | Data in the database is scrambled — even if someone steals the database file, they cannot read it |
| **Encryption in transit** | Data travelling over the internet is scrambled — cannot be intercepted and read (HTTPS/TLS) |
| **AES-256** | The encryption standard we will use — considered unbreakable with current technology |
| **bcrypt** | The password hashing method we currently use — passwords are stored as irreversible hashes |
| **pgcrypto** | A PostgreSQL extension that lets us encrypt specific columns inside the database |
| **Row-Level Security (RLS)** | A PostgreSQL feature that enforces access rules inside the database itself — a backstop if application code has bugs |
| **MFA** | Multi-Factor Authentication — requiring a second proof of identity (e.g. a code from an app) in addition to a password |
| **Right to Erasure** | A patient's legal right to ask us to delete their personal data |
| **Audit Log** | A permanent, tamper-proof record of who accessed or changed what data and when |
| **Least Privilege** | Security principle: each person or system gets access to only the minimum data they need to do their job |
| **Data Retention** | How long we keep data before deleting or anonymising it |
| **Anonymisation** | Replacing personal data with generic placeholders so the record can be kept without identifying anyone |
