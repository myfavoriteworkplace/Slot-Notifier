# Doctor System — Complete Guide

This document explains how doctors work inside BookMySlot: how they are identified, how they relate to clinics and bookings, what they can do in the app, and where the current design has technical debt.

---

## 1. What a doctor is in the app

A doctor is a user who can:

- Log in to a separate doctor dashboard.
- See appointments assigned to them.
- Approve or decline appointments.
- Start consultations, complete visits, request consent, and add notes.
- Manage their profile, certifications, cases, and leave.
- Receive real-time notifications.

Doctors are **not** clinic admins. They have their own authentication flow and their own dashboard.

---

## 2. Doctor identity: email vs. doctor ID

### The doctors table

The `doctors` table in the database has these identifying columns:

| Column | Type | Purpose |
|---|---|---|
| `id` | integer (serial) | Primary key. The real, permanent doctor ID. |
| `email` | varchar, unique, required | Used for login and for linking bookings to doctors. |
| `username` | varchar, unique, optional | Alternative public handle. |
| `name` | varchar | Display name. |

So the app has **two identifiers** for a doctor:

1. **Doctor ID** (`id`) — the integer primary key. This is used for profile data, certifications, cases, leaves, and clinic links.
2. **Doctor email** (`email`) — the string used for login and for booking assignments.

### What the session stores

When a doctor logs in, the session stores both values:

```ts
sess.doctorId    = doctor.id;     // integer
sess.doctorEmail = doctor.email;  // string
sess.role        = 'doctor';
```

The session therefore knows the doctor ID, but most booking-related code still uses the email.

### Where each identifier is used

| Area | Identifier used | Why |
|---|---|---|
| Login, password change, forgot password | `email` | Doctors log in with email + password. |
| Session | `doctorId` + `doctorEmail` | Both are stored. |
| Profile, certifications, cases, leaves | `doctorId` | These are owned by the doctor, so they use the foreign key. |
| Clinic-doctor linking | `doctorId` | The `clinic_doctors` table uses doctor IDs. |
| Bookings | `assignedDoctorEmail` | The `bookings` table does **not** have a `doctorId` column. It stores the doctor’s email. |
| Booking permissions | `assignedDoctorEmail` | Routes check `booking.assignedDoctorEmail !== sess.doctorEmail`. |
| Notifications | `doctorId` | WebSocket user IDs are `doctor:${id}`. |
| Public profile | `id` or `username` | `/api/public/doctor/:id` accepts the doctor ID or username. |

### Important consequence

Because bookings are tied to the doctor’s **email**, not the doctor’s **ID**, a booking belongs to a doctor only as long as the email stays the same. If a doctor’s email is changed in the database, the historical bookings still point to the old email, and the doctor may lose access to those appointments.

This is the biggest design risk in the current doctor system.

---

## 3. Doctor–clinic relationship

A doctor can be linked to one or more clinics. The link is stored in the `clinic_doctors` table.

### How a clinic adds a doctor

Clinic admins add doctors via:

```
POST /api/auth/clinic/doctors
```

The clinic provides:
- `name`
- `specialization`
- `degree`
- `email` (optional)
- `imageUrl` (optional)

What happens:
1. The doctor is added to the clinic’s internal `doctors` JSON list.
2. If an email is provided:
   - A `doctors` table record is created if one does not exist.
   - A temporary password is generated and emailed to the doctor.
   - The doctor is linked to the clinic via `clinic_doctors`.

### How a clinic manages doctors

| Endpoint | What it does |
|---|---|
| `GET /api/auth/clinic/linked-doctors` | List doctors linked to this clinic. |
| `POST /api/auth/clinic/doctors/:doctorId/reset-password` | Reset a linked doctor’s password. |
| `DELETE /api/auth/clinic/doctors/:index` | Remove a doctor from the clinic’s display list. |

### How a doctor sees their clinics

Doctors can see their linked clinics via:

```
GET /api/doctor/clinics
```

A doctor must be linked to at least one clinic to log in.

---

## 4. Doctor–booking relationship

### How a booking gets assigned to a doctor

Clinic admins assign a doctor to a booking via:

```
PATCH /api/clinic/bookings/:id/assign-doctor
```

The request body contains:
- `doctorName` (required) — the doctor’s display name.
- `doctorEmail` (optional) — the doctor’s email.

The route stores two fields on the `bookings` table:
- `assignedDoctor` — the name.
- `assignedDoctorEmail` — the email, looked up from the `doctors` table if not provided.

If an email is provided, the booking’s `doctorApprovalStatus` is set to `pending`, meaning the doctor must approve the appointment before it is confirmed.

### Doctor approval flow

Once a booking is assigned, the doctor can:

| Action | Endpoint | Result |
|---|---|---|
| Approve | `PATCH /api/doctor/bookings/:id/approve` | Booking becomes confirmed. |
| Decline | `PATCH /api/doctor/bookings/:id/decline` | Booking is declined. |

The route verifies that `booking.assignedDoctorEmail === sess.doctorEmail` before allowing either action.

### How the doctor dashboard loads appointments

The doctor dashboard uses:

```
GET /api/auth/clinic/bookings?filter=...&page=...&patientId=...&dateFrom=...&dateTo=...&clinicId=...
```

The server calls `storage.getDoctorBookingsPaged(doctorEmail, params)`, which filters bookings by `assignedDoctorEmail`. The available filters are:

- `today` — appointments today that the doctor has approved.
- `upcoming` — approved appointments from tomorrow onwards.
- `awaiting` — pending doctor approval, not cancelled or completed.
- `pending-7days` — pending approval within the next 7 days.
- `this-week` / `next-week` — approved appointments in those weeks.
- `owned` — all approved appointments assigned to the doctor.
- `all` — every appointment assigned to the doctor, regardless of status.

### Why this matters for patient search

The doctor’s patient search (`GET /api/doctor/patients?q=...`) must find patients who have bookings assigned to that doctor. Because bookings are keyed by email, the search joins `bookings → patients → clinics` and filters by `bookings.assignedDoctorEmail = doctor.email`.

It cannot use `patients.doctorId` because that column is not populated when patients are created.

---

## 5. Doctor authentication

### Login

```
POST /api/auth/doctor/login
```

Body: `email`, `password`.

Checks:
1. Email exists in `doctors` table.
2. Password matches.
3. Doctor is linked to at least one clinic.

If all checks pass, the session is regenerated and stores `doctorId`, `doctorEmail`, and `role`.

### Current user

```
GET /api/auth/doctor/me
```

Returns the doctor’s profile, including their linked clinic.

### Logout

```
POST /api/auth/doctor/logout
```

Destroys the session.

### Change password

```
POST /api/auth/doctor/change-password
```

Doctors can change their own password. If the current password is still the temporary password, the current password check is skipped.

### Forgot password

```
POST /api/auth/doctor/forgot-password
```

Sends a password reset link to the doctor’s email. (Implemented as a neutral response to avoid email enumeration.)

---

## 6. Doctor-owned data

These features are owned by the doctor and use the doctor ID (`doctorId`) as the foreign key.

### Profile

```
PATCH /api/doctor/profile
```

Updates name, specialization, degree, college, bio, phone, image, languages, treatments, etc.

### Certifications

| Endpoint | Purpose |
|---|---|
| `GET /api/doctor/certifications` | List certifications. |
| `POST /api/doctor/certifications` | Add a certification. |
| `PATCH /api/doctor/certifications/:id` | Update a certification. |
| `DELETE /api/doctor/certifications/:id` | Delete a certification. |

Stored in `doctor_certifications`.

### Cases

| Endpoint | Purpose |
|---|---|
| `GET /api/doctor/cases` | List cases. |
| `POST /api/doctor/cases` | Add a case. |
| `PATCH /api/doctor/cases/:id` | Update a case. |
| `DELETE /api/doctor/cases/:id` | Delete a case. |

Stored in `doctor_cases`.

### Leave

| Endpoint | Purpose |
|---|---|
| `GET /api/doctor/leaves` | List my leave dates. |
| `POST /api/doctor/leaves` | Add a leave date. |
| `DELETE /api/doctor/leaves/:id` | Remove a leave date. |

Stored in `doctor_leaves`. Leave dates are used by the public availability checker to block slots when all doctors at a clinic are on leave.

---

## 7. Doctor dashboard features

The doctor dashboard (`client/src/pages/DoctorDashboard.tsx`) is the main workspace for doctors. It contains:

### Appointments section

- **Tab filters**: Today, Upcoming, Awaiting, All Appointments, All Owned, plus date range and clinic filters.
- **Patient search**: Search by name, phone, or PAT code. Selecting a patient filters the appointment list.
- **Awaiting-approval banner**: Shows pending appointments that need the doctor’s action.
- **Appointment cards**: Show patient details, slot time, clinic, visit type, consent status, and actions.

### Appointment actions

From an appointment card, a doctor can:

| Action | Endpoint |
|---|---|
| Approve appointment | `PATCH /api/doctor/bookings/:id/approve` |
| Decline appointment | `PATCH /api/doctor/bookings/:id/decline` |
| Start consultation | `PATCH /api/doctor/bookings/:id/start-consultation` |
| Complete visit | `PATCH /api/doctor/bookings/:id/complete-visit` |
| Update clinical status | `PATCH /api/doctor/bookings/:id/clinical-status` |
| Add notes | `PATCH /api/doctor/bookings/:id/notes` |
| Request consent | `POST /api/doctor/bookings/:id/request-consent` |
| View visit timeline | `GET /api/doctor/bookings/:id/visit-timeline` |
| View medical history | `GET /api/doctor/bookings/:id/medical-history` |
| Add medical history | `POST /api/doctor/bookings/:id/medical-history` |
| View chart | `GET /api/doctor/bookings/:id/chart` |

All of these verify that the booking is assigned to the logged-in doctor by email.

### Side navigation

- Appointments
- Leave Management
- My Profile
- Case Studies
- Certifications
- Analyse X-Ray

---

## 8. Doctor notifications

Doctors receive real-time notifications through a WebSocket connection.

### WebSocket user ID

Doctors are identified on the WebSocket channel by:

```
doctor:${doctorId}
```

For example, doctor ID `42` becomes `doctor:42`. This prefix prevents collisions with clinic IDs, which use `clinic:${clinicId}`.

### Notification types sent to doctors

| Type | When it fires |
|---|---|
| `doctor_assigned` | A clinic admin assigns an appointment to the doctor. |
| `booking_rescheduled` | A booking assigned to the doctor is rescheduled. |
| `patient_checked_in` | A patient for the doctor’s booking checks in. |
| `admin_confirmed` | A clinic admin overrides a pending doctor approval. |
| `booking_cancelled` | A booking assigned to the doctor is cancelled. |
| `booking_note_added` | A clinic admin adds a note on the doctor’s booking. |
| `doctor_approved` | Echo back to the doctor’s own approval action. |
| `doctor_declined` | Echo back to the doctor’s own decline action. |
| `case_closed_by_doctor` | The doctor closes a case. |
| `consultation_started` | The doctor starts a consultation. |
| `visit_completed` | The doctor completes a visit. |
| `consent_requested` | The doctor requests consent from a patient. |
| `consent_signed` | The patient signs consent. |

---

## 9. Public doctor profile

Doctors have a public profile page that patients can view before booking.

```
GET /api/public/doctor/:id
```

The `:id` parameter can be either:
- the doctor’s numeric ID, or
- the doctor’s username.

The response includes:
- doctor profile (without password hash)
- certifications
- cases
- linked clinic

The UI page is `client/src/pages/DoctorPublicProfile.tsx`.

---

## 10. Known design debt

### 1. Bookings are tied to email, not doctor ID

- The `bookings` table has `assignedDoctor` and `assignedDoctorEmail` but no `doctorId` foreign key.
- This makes the doctor↔booking relationship fragile if an email ever changes.
- It also forces many permission checks to compare strings instead of integers.

**Recommended long-term fix:** add a `doctorId` column to `bookings`, populate it whenever a doctor is assigned, migrate existing rows from `assignedDoctorEmail`, and update the booking queries to use `doctorId`.

### 2. `patients.doctorId` is unused

- The `patients` table has a `doctorId` column, but it is never set when patients are created.
- This caused the doctor patient-search bug, because an earlier version of the search tried to filter by `patients.doctorId` and always returned empty.
- The patient-search fix now uses `bookings.assignedDoctorEmail` instead.

**Recommended long-term fix:** either remove the `patients.doctorId` column or document it as deprecated, because it does not reflect the real doctor↔patient relationship.

### 3. `assignedDoctor` name can become stale

- The `bookings` table stores the doctor’s name at assignment time.
- If the doctor later updates their profile name, the booking still shows the old name.

**Recommended long-term fix:** keep `assignedDoctor` only as a display cache, and fetch the current name from the `doctors` table when showing the booking.

---

## 11. Summary for decision-making

- Doctors are identified by **both** `doctorId` (integer) and `email` (string) in the session.
- Doctor-owned data (profile, certifications, cases, leaves) correctly uses `doctorId`.
- The booking layer is the exception: it relies on `assignedDoctorEmail` because `bookings` has no `doctorId` column.
- Adding a `doctorId` safeguard to the booking layer is a **schema change**, not a small code tweak.
- For now, the patient-search fix correctly uses email because that is how the booking layer actually works.
