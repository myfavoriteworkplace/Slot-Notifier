# BookMySlot — Booking Status & Workflow Guide
## How Every Status Works, What It Means, and What Triggers It

---

> **Who is this for?**
> Developers, AI assistants, and team members who need to understand exactly how a patient booking moves through the system — from the moment a patient clicks "Book" to the moment the case is closed.

---

## Overview — Five Independent Status Tracks

A booking in BookMySlot does not have a single "status" field. It has **five separate status fields** that track different aspects of the appointment independently. Understanding this is critical to understanding the system.

| Field (DB column) | What it tracks | Who sets it |
|---|---|---|
| `verification_status` | Appointment confirmation state | Clinic admin or doctor approval |
| `doctor_approval_status` | Doctor's response to being assigned | Doctor (approve/decline) or admin override |
| `visit_status` | Physical arrival at the clinic on the day | Clinic admin (front desk) |
| `clinical_status` | Medical/treatment progress | Clinic admin or Doctor |
| `payment_status` | Online payment for this booking | Razorpay webhook (automatic) |

Additionally:
- `confirmed_by` — records whether the confirmation was done by `admin` or `doctor`
- `checked_in_at` — timestamp of when the patient physically arrived

---

## Track 1 — Appointment Confirmation (`verification_status`)

This is the primary booking status visible to the patient and the most prominent status shown in the clinic dashboard.

### Values

| Value | Label shown in UI | What it means |
|---|---|---|
| `email_verified` | **Pending** | Patient submitted the booking and verified their email via OTP. Booking exists in the system but has not yet been confirmed by the clinic or doctor. This is the default state for all new patient bookings. |
| `admin_booked` | **Pending** | Booking was created directly by the clinic admin from the dashboard (not by a patient). Treated identically to `email_verified` for confirmation purposes. |
| `confirmed` | **Confirmed** | Clinic admin or doctor has confirmed the appointment. Confirmation email and WhatsApp message sent to patient. |
| `cancelled` | **Cancelled** | The booking was cancelled. Record is kept in the database (soft cancel — never deleted). Cancellation email sent to patient. |

### How the UI determines "Pending"

The dashboard checks two fields together:
```
isConfirmed = (verificationStatus === 'confirmed') OR (confirmedBy is set)
isCancelled = (verificationStatus === 'cancelled')
```
If neither is true, the booking shows as **Pending**.

### Transitions

```
[Patient books]
       ↓
email_verified (Pending)
       │
       ├──── Clinic admin clicks "Confirm"  →  confirmed  (email + WhatsApp sent to patient)
       │
       ├──── Doctor approves assignment     →  confirmed  (email + WhatsApp sent to patient)
       │       (verificationStatus stays email_verified until admin or doctor acts)
       │
       └──── Clinic admin clicks "Cancel"  →  cancelled  (cancellation email sent)
```

### Who can change it

| Action | Who | Result |
|---|---|---|
| Confirm booking | Clinic admin | `confirmed`, `confirmedBy = 'admin'` |
| Doctor approves their assignment | Doctor | `confirmed`, `confirmedBy = 'doctor'` |
| Admin confirms over doctor's pending approval | Clinic admin | `confirmed`, `confirmedBy = 'admin'`, `doctorApprovalStatus = 'admin_confirmed'` |
| Cancel | Clinic admin | `cancelled` |

### Special case — Admin override of doctor

If a doctor has been assigned and their `doctorApprovalStatus` is still `pending`, the clinic admin can still click "Confirm". This is an override. The system:
1. Sets `verificationStatus = 'confirmed'` and `confirmedBy = 'admin'`
2. Sets `doctorApprovalStatus = 'admin_confirmed'`
3. Sends a notification email to the doctor saying "Admin confirmed on your behalf"
4. Sends an in-app notification to the doctor

### Cancellation reasons

When cancelling, the clinic admin can select a reason from a dropdown:
- Patient requested cancellation
- Doctor unavailable
- Clinic closure / emergency
- Patient no-show
- Rescheduled to another slot
- Other

The reason is stored and appears in the cancellation email sent to the patient.

---

## Track 2 — Doctor Assignment & Approval (`doctor_approval_status`)

This track is only active when a clinic admin assigns a doctor to a booking. If no doctor is assigned, this field is `null` and irrelevant.

### Values

| Value | What it means |
|---|---|
| `null` | No doctor has been assigned to this booking |
| `pending` | A doctor has been assigned, but they have not yet approved or declined |
| `approved` | The doctor has accepted responsibility for this appointment |
| `declined` | The doctor has declined — assignment is removed, clinic must reassign |
| `admin_confirmed` | Admin bypassed the doctor's pending approval and confirmed the booking directly |

### Transitions

```
[Clinic admin assigns a doctor]
          ↓
   doctorApprovalStatus = 'pending'
   (email + in-app notification sent to doctor)
          │
          ├── Doctor approves  →  'approved'
          │     (booking becomes confirmed, email + WhatsApp to patient, in-app to clinic)
          │
          ├── Doctor declines  →  'declined'
          │     (email to clinic admin, in-app notification, doctor assignment cleared)
          │     → Clinic must assign a different doctor
          │
          └── Admin confirms instead  →  'admin_confirmed'
                (admin bypassed doctor, email to doctor, in-app to doctor)
```

### How the doctor sees their assignments

In the Doctor Dashboard, bookings are split into two groups:

- **Awaiting** — `doctorApprovalStatus === 'pending'` — needs the doctor's action
- **Confirmed** — all other statuses (`approved`, `admin_confirmed`, anything not `pending` or `declined`)

Declined bookings disappear from the doctor's dashboard once declined (the assignment is cleared).

### What happens when a doctor is assigned without an email

If the clinic admin types a doctor name that does not match any doctor account in the system (i.e., no email can be resolved), the assignment is stored as a display-only name. In this case:
- `doctorApprovalStatus` is set to `null` (not `pending`)
- No email or notification is sent
- No approval is required
- The booking can be confirmed by the clinic admin directly

---

## Track 3 — Physical Visit Status (`visit_status`)

This is the real-time "where is the patient right now?" status, used by front desk staff on the day of the appointment. It is completely separate from the appointment confirmation status.

### Values

| Value | Label in UI | What it means |
|---|---|---|
| `null` | *(no badge)* | Patient has not yet arrived. Default state. |
| `checked_in` | **Arrived** | Clinic front desk has marked the patient as physically present in the waiting room. The assigned doctor receives an in-app notification. |
| `completed` | **Visit Complete** | The visit has been marked as done via the complete-visit action. |

### Transitions

```
Appointment day arrives
        ↓
Patient walks into the clinic
        ↓
Clinic admin clicks "Mark Arrived"
        → visit_status = 'checked_in'
        → checked_in_at = current timestamp
        → In-app notification sent to assigned doctor:
          "Patient Name is in the waiting room — 10:30 AM slot"
        ↓
Visit completes
        ↓
Clinic admin clicks "Complete Visit" (if used)
        → visit_status = 'completed'
```

### Undo check-in

The clinic admin can undo a check-in (for instance, if they marked the wrong patient). Undo sets:
- `visit_status = null`
- `checked_in_at = null`

---

## Track 4 — Clinical Status (`clinical_status`)

This is the medical/treatment progress field. It is set by either the clinic admin or the doctor and tracks the **treatment outcome** rather than the logistics of the visit. It is free-form but the UI provides predefined values.

### Values available in the Clinic Dashboard

| Value | What it means |
|---|---|
| `case_closed` | The case is complete — all treatment done, no further action required |
| *(clear)* | Clinic admin can clear the clinical status by setting it to null |

> **Note:** The clinic dashboard only exposes `case_closed` as a clickable button. The doctor dashboard exposes a richer dropdown.

### Values available in the Doctor Dashboard

| Value | Label shown | What it means |
|---|---|---|
| `first_visit` | First Visit | Patient is visiting for the first time for this condition |
| `revisit` | Revisit | Patient is returning for the same issue |
| `follow_up_required` | Follow-up Required | Treatment is in progress; patient needs to come back |
| `case_closed` | Case Closed | Treatment is complete; no further visits expected |

### Who can set it and when

| Actor | Can set clinical status? | Where |
|---|---|---|
| Clinic admin | Yes | Clinic dashboard — booking card |
| Doctor | Yes | Doctor dashboard — notes/records modal |

Both roles can set it independently. The last one to update wins.

### What happens when `case_closed` is set

Setting `case_closed` triggers a **cross-role notification**:
- If set by the **clinic admin**: an in-app notification is sent to the assigned doctor — "Clinic admin marked [patient name]'s case as closed"
- If set by the **doctor**: an in-app notification is sent to the clinic admin — "Dr. [name] marked [patient name]'s case as closed"

This cross-notification ensures both parties are aware the case is complete.

---

## Track 5 — Payment Status (`payment_status`)

This tracks online payment by the patient at the time of booking. It is only relevant when the clinic has payment enabled via Razorpay.

### Values

| Value | What it means |
|---|---|
| `null` | No payment was required or attempted (booking was free) |
| `pending` | Razorpay payment was initiated but not yet confirmed |
| `paid` | Payment verified and confirmed by Razorpay webhook |
| `failed` | Payment attempt failed |

### In billing context (clinic accounts tab)

The billing module within the clinic dashboard also uses a `payment_status` field on individual bill line items:

| Value | What it means |
|---|---|
| `paid` | Bill has been fully paid |
| `partial` | Partial payment received |
| `pending` | Bill is outstanding |

> This is separate from the booking-level payment status. The billing module is a financial record-keeping tool for the clinic; the booking payment status is about the Razorpay online payment at booking time.

---

## The Full Lifecycle — Combined View

This shows how all five tracks interact across the typical journey of a booking.

```
──────────────────────────────────────────────────────────────────────────────
PHASE 1: BOOKING CREATED (by patient or clinic admin)
──────────────────────────────────────────────────────────────────────────────
Patient verifies email OTP → submits booking form

  verificationStatus   = 'email_verified'   ← Pending
  doctorApprovalStatus = null               ← No doctor assigned yet
  visitStatus          = null               ← Not arrived
  clinicalStatus       = null               ← No treatment yet
  paymentStatus        = null (or 'paid')   ← Paid at booking if payment enabled


──────────────────────────────────────────────────────────────────────────────
PHASE 2: ADMIN REVIEWS BOOKING (clinic dashboard)
──────────────────────────────────────────────────────────────────────────────
Option A — Admin confirms without assigning a doctor:

  verificationStatus   = 'confirmed'        ← Confirmed
  confirmedBy          = 'admin'
  doctorApprovalStatus = null               ← Still no doctor

Option B — Admin assigns a doctor first:

  doctorApprovalStatus = 'pending'          ← Awaiting doctor
  (email + in-app notification → doctor)

  Then doctor approves:
    verificationStatus   = 'confirmed'      ← Confirmed by doctor
    confirmedBy          = 'doctor'
    doctorApprovalStatus = 'approved'

  Or doctor declines:
    doctorApprovalStatus = 'declined'       ← Assignment cleared
    (clinic must reassign)

  Or admin overrides:
    verificationStatus   = 'confirmed'      ← Admin bypassed doctor
    confirmedBy          = 'admin'
    doctorApprovalStatus = 'admin_confirmed'


──────────────────────────────────────────────────────────────────────────────
PHASE 3: DAY OF APPOINTMENT (front desk)
──────────────────────────────────────────────────────────────────────────────
Patient arrives at the clinic:

  visitStatus   = 'checked_in'             ← Arrived
  checkedInAt   = [timestamp]
  (in-app notification → assigned doctor: "Patient is in the waiting room")


──────────────────────────────────────────────────────────────────────────────
PHASE 4: DURING / AFTER CONSULTATION (doctor or clinic)
──────────────────────────────────────────────────────────────────────────────
Doctor sets clinical status:

  clinicalStatus = 'first_visit'           ← Or revisit / follow_up_required

If follow-up needed:
  clinicalStatus = 'follow_up_required'    ← Next visit expected

When all done:
  clinicalStatus = 'case_closed'           ← Treatment complete
  visitStatus    = 'completed'             ← (optional — visit done)
  (cross-notification to other role)


──────────────────────────────────────────────────────────────────────────────
PHASE 5: IF CANCELLED AT ANY POINT
──────────────────────────────────────────────────────────────────────────────
Clinic admin cancels:

  verificationStatus = 'cancelled'         ← Cancelled (cannot be undone)
  (cancellation email sent to patient with reason)
  Record is kept in database — never deleted.
──────────────────────────────────────────────────────────────────────────────
```

---

## Notifications Triggered by Status Changes

Every status transition that is externally visible triggers one or more notifications.

| Status change | Notification sent | To whom |
|---|---|---|
| Booking created (patient) | Confirmation email + WhatsApp | Patient |
| Clinic admin confirms | Confirmation email + WhatsApp | Patient |
| Doctor approves | Confirmation email + WhatsApp | Patient |
| Doctor assigned | Assignment email + in-app | Doctor |
| Doctor approves | In-app: "Dr. X confirmed appointment" | Clinic admin |
| Doctor declines | Email + in-app: "Dr. X declined — reassign needed" | Clinic admin |
| Admin overrides doctor | Email + in-app: "Admin confirmed on your behalf" | Doctor |
| Patient checks in | In-app: "Patient is in the waiting room" | Assigned doctor |
| Clinic sets `case_closed` | In-app: "Clinic marked case as closed" | Assigned doctor |
| Doctor sets `case_closed` | In-app: "Dr. X marked case as closed" | Clinic admin |
| Booking cancelled | Cancellation email with reason | Patient |

---

## Quick Reference — Who Can Do What

| Action | Clinic Admin | Doctor | Patient | Super Admin |
|---|---|---|---|---|
| Create a booking | ✓ (on behalf of patient) | — | ✓ (with OTP) | — |
| Confirm a booking | ✓ | — (implicit via approval) | — | ✓ |
| Cancel a booking | ✓ | — | — | ✓ |
| Assign a doctor | ✓ | — | — | — |
| Approve assignment | — | ✓ | — | — |
| Decline assignment | — | ✓ | — | — |
| Override doctor's pending approval | ✓ | — | — | ✓ |
| Mark patient as arrived (check-in) | ✓ | — | — | — |
| Undo check-in | ✓ | — | — | — |
| Mark visit complete | ✓ | — | — | — |
| Set clinical status | ✓ | ✓ | — | — |
| Set `case_closed` | ✓ | ✓ | — | — |
| Add booking notes | ✓ | ✓ | — | — |
| Reschedule booking | ✓ | — | — | — |
| Request digital consent | ✓ | — | — | — |
| Sign consent form | — | — | ✓ (via WhatsApp link) | — |

---

## Edge Cases and Rules

### A booking cannot be confirmed twice
If `verificationStatus === 'confirmed'`, the confirm endpoint returns `400 Booking already confirmed`. The confirm button disappears from the UI once confirmed.

### A booking cannot be cancelled twice
If `verificationStatus === 'cancelled'`, the cancel endpoint returns `400 Booking is already cancelled`. Cancellation is permanent — there is no "restore booking" flow.

### `clinicalStatus` can be changed multiple times
There is no lock on clinical status. Either the clinic admin or the doctor can change it at any point, even after it was previously set to `case_closed`. The last update wins.

### Doctor assignment can be changed after approval
The clinic admin can reassign a different doctor even after the current doctor has approved. Reassigning clears the previous `doctorApprovalStatus` and sets it back to `pending` for the new doctor.

### Past bookings still show all statuses
There is no automatic status change when a booking's appointment time passes. A booking from last week that was never confirmed still shows as "Pending" — it is up to the clinic to manage this manually.

### Consent form is independent of all status fields
The digital consent (`consentSignature`, `consentSignedAt`, `consentIp`, `consentToken`) is stored separately and is not tied to any of the five status tracks. A booking can be cancelled and still have a signed consent form on record.

### Payment status and confirmation are independent
A patient can pay online at the time of booking, but the booking still starts as `email_verified` (Pending). The clinic admin still needs to confirm it. Payment does not auto-confirm a booking.

---

## Status Values — Complete Reference Card

| Field | All possible values |
|---|---|
| `verificationStatus` | `email_verified`, `admin_booked`, `confirmed`, `cancelled` |
| `doctorApprovalStatus` | `null`, `pending`, `approved`, `declined`, `admin_confirmed` |
| `visitStatus` | `null`, `checked_in`, `completed` |
| `clinicalStatus` | `null`, `first_visit`, `revisit`, `follow_up_required`, `case_closed` *(free text — other values are technically possible but not offered in the UI)* |
| `paymentStatus` | `null`, `pending`, `paid`, `failed` |
| `confirmedBy` | `null`, `admin`, `doctor` |

---

## Where Each Status is Stored in the Database

All status fields live on the `bookings` table (`bookings` in PostgreSQL).

| DB column | Type | Default |
|---|---|---|
| `verification_status` | `varchar(20)` | `'pending'` |
| `doctor_approval_status` | `varchar(20)` | `null` |
| `visit_status` | `varchar(50)` | `null` |
| `checked_in_at` | `timestamp` | `null` |
| `clinical_status` | `varchar(50)` | `null` |
| `payment_status` | `varchar(20)` | `null` |
| `confirmed_by` | `varchar(20)` | `null` |

---

*Last updated: June 2026*
*This document covers the complete status system as implemented. For the full booking API reference, see the routes in `server/routes.ts`. For the data model, see `shared/schema.ts`.*
