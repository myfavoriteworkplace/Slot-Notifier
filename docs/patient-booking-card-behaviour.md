# Patient Booking Card — Complete Behaviour Reference

This document describes every visual element, button, tooltip, banner, and progress state on the appointment card as it appears in both the **Clinic Admin** dashboard and the **Doctor Admin** dashboard, at every stage of the booking lifecycle.

---

## 1. Lifecycle Stages — Overview

The booking moves through these stages in order. Some stages can be skipped via the Override path.

| # | Stage Key | What it means | Set by |
|---|---|---|---|
| 0 | `booked` | Patient submitted the booking; awaiting clinic confirmation | Patient / system |
| 1 | `confirmed` | Clinic has confirmed the appointment | Clinic admin |
| 2 | `checked_in` | Patient has physically arrived at the clinic | Clinic admin |
| 3a | `in_consultation` | Patient is currently with the doctor | Doctor |
| 3b | `treatment_completed` | Doctor marked consultation done; admin has not yet closed | Doctor |
| 4 | `visit_completed` | Clinic admin closed the visit; billing finalisable | Clinic admin |

**Terminal states** (not sequential — can happen at any stage):

| Key | What it means | Set by |
|---|---|---|
| `cancelled` | Booking cancelled by clinic or patient | Clinic admin |
| `no_show` | Patient did not arrive | Clinic admin |
| `left_early` | Patient walked out mid-consultation | Clinic admin |

**Override / Force-complete:** Clinic admin can use "Mark Visit Complete ↗" from the three-dot menu to jump directly from any stage to `visit_completed`, skipping intermediate stages. Stages 1–3 are then shown in strikethrough orange on the progress strip.

---

## 2. Card Structure — Anatomy

```
┌─────────────────────────────────────────────┐
│ [3 px accent bar — colour = lifecycle state] │
├─────────────────────────────────────────────┤
│ HEADER                                       │
│  Avatar | Name  #BookingNo  PAT-XXXX         │
│  Phone · Age · Gender        [Status Badge]  │
│  [⋮ three-dot menu — clinic only]            │
├─────────────────────────────────────────────┤
│ INFO ROWS                                    │
│  Date · Time  [Today / Tomorrow / in Nd]     │
│  Visit Type                                  │
│  Treatment Category  · N slots               │
│  Assigned Doctor  · approval status          │
│  Consent status                              │
│  Clinical Status (if set)                    │
│  Doctor Notes indicator (doctor view)        │
│  Chief Complaints chips                      │
├─────────────────────────────────────────────┤
│ BANNERS (conditional)                        │
│  Past-due warning | Reason banner            │
│  Visit completion note | Unpaid bill alert   │
│  Late check-in notice                        │
├─────────────────────────────────────────────┤
│ PROGRESS STRIP                               │
│  ○ Booked — ○ Confmd. — ○ Arrived — ○ In Tmt. — ○ Visit Done │
├─────────────────────────────────────────────┤
│ FOOTER — CLINIC or DOCTOR (separate logic)  │
│  [Primary button — full width]               │
│  [Secondary button row]                      │
└─────────────────────────────────────────────┘
```

---

## 3. Top Accent Bar (3 px coloured stripe)

Shown at the very top of every card. Pulses when patient is actively with the doctor.

| Condition | Colour |
|---|---|
| No Show | Slate gradient |
| Cancelled | Rose gradient |
| Left Early | Amber → Orange gradient |
| Visit Completed | Emerald → Teal gradient |
| Treatment Completed (waiting for admin close) | Amber → Yellow gradient |
| Today's appointment (any active state) | Sky → Cyan gradient |
| Past day appointment | Slate light gradient |
| Default (future booking) | Primary green → Accent gradient |

**Pulse animation:** Active when `in_consultation` (both views) or when doctor view shows a patient who has arrived (`checked_in`).

---

## 4. Card Left Border

A coloured left-side border visually groups cards by state at a glance.

| State | Border |
|---|---|
| In Consultation | Full 2 px teal border + subtle teal shadow |
| Doctor view, patient Arrived | Full 2 px primary green border + shadow |
| Cancelled | 3 px solid rose left border |
| No Show | 3 px solid slate left border |
| Left Early | 3 px solid amber left border |
| Visit Completed | 3 px solid emerald left border |
| Treatment Completed | 3 px solid amber left border |
| Confirmed | 3 px solid emerald left border |
| Pending (booked, unconfirmed) | 3 px solid amber left border |

Cards in a past or terminal state also get `opacity-80` to visually de-emphasise them.

---

## 5. Header Background Tint

The name/avatar area has a subtle gradient wash:

| State | Background |
|---|---|
| No Show / Cancelled / Left Early | Neutral muted/30 |
| Visit Completed | Emerald/5 → Teal/5 |
| Treatment Completed | Amber/5 → Yellow/5 |
| Today's appointment | Sky/10 → Cyan/5 |
| All other states | Primary/5 → Accent/5 |

---

## 6. Status Badge (top-right of card header)

Shown on hover with a descriptive tooltip. Priority order (highest wins):

| Badge | Colour | Icon | Tooltip |
|---|---|---|---|
| **Cancelled** | Red | ✕ | "Appointment cancelled" |
| **Declined** (doctor view only) | Red | ✕ | "Appointment declined" |
| **No Show** | Slate | UserX | "Patient did not arrive" |
| **Left Early** | Amber | LogOut | "Patient left before the visit was completed" |
| **Visit Done** | Emerald | ShieldCheck | "Visit completed successfully" |
| **Tmt. Done** (pulsing dot) | Amber | Animated dot | "Doctor completed consultation — awaiting admin closure" |
| **With Doctor** | Teal | Dot | "Patient currently with doctor" |
| **Arrived** (pulsing dot) | Blue | Animated dot | "Patient checked in — waiting for doctor" |
| **Confirmed** | Emerald | CheckCircle | "Appointment confirmed" |
| **Awaiting Dr** (pulsing dot) | Amber | Animated dot | "Appointment awaiting confirmation" |
| **Pending** (pulsing dot) | Amber | Animated dot | "Appointment awaiting confirmation" |

"Awaiting Dr" appears only when a doctor has been assigned but their `doctorApprovalStatus` is still `"pending"`.

---

## 7. Three-Dot Menu (⋮) — Clinic View Only

Visible when: `role === "clinic"` AND booking is **not** cancelled, no-show, or left-early.

| Menu Item | Visible when | What it does |
|---|---|---|
| **Send Reminder** | Not visit_completed, not treatment_completed, not past slot | Sends SMS/email reminder to patient |
| **Mark No Show** | Not yet checked_in, not in_consultation, not treatment_completed, not visit_completed | Opens no-show dialog with predefined reasons; sets `verificationStatus = "no_show"` |
| **Patient Left Early** | Currently `in_consultation` only | Opens dialog with reason; sets `visitStatus = "patient_left_early"` |
| **Mark Visit Complete ↗** | Not yet visit_completed AND not treatment_completed | Force-closes the visit from any stage; shows skipped stages in strikethrough orange on progress strip |

The "Mark No Show" and "Patient Left Early" flows collect a reason (predefined + "Other" free text), which is saved as `cancellationReason` and shown as a red/amber banner on the card.

---

## 8. Info Row Details

### Date & Time
- Always shown. Format: `Mon, 25 May · 9:00 AM → 12:00 PM`
- Relative badge shown when NOT past and NOT terminal:
  - **Today** — sky blue pill
  - **Tomorrow** — amber pill
  - **In Nd** — muted pill

### Visit Type
- Shown always. Displays as a sky-blue badge (e.g. "First Visit", "Follow Up", "Emergency").
- Falls back to parsing the `description` field if `visitType` column is empty.
- Shows `–` if not set.

### Treatment Category
- Violet badge. Shows slot count (`· N slots`) if > 1 slot consumed.
- Shows `–` if not set.

### Assigned Doctor (Clinic view)
Displays doctor name in primary green, plus an approval status indicator:

| `doctorApprovalStatus` | What shows |
|---|---|
| `null` / not assigned | "Assign Doctor →" link (only if not past, not terminal, not visit_completed) |
| `"pending"` | Dr. Name · **Awaiting approval** (amber) |
| `"approved"` | Dr. Name · **Approved ✓** (green) |
| `"admin_confirmed"` | Dr. Name · **Admin confirmed ✓** (green) |
| `"declined"` | Dr. Name · **Declined ✗** (red) |
| Any, but `isCancelled` | Dr. Name (no status suffix) |

### Consent Status
Shown in both clinic and doctor views.

| State | Display |
|---|---|
| `consentSignedAt` is set | Green "Signed ✓" badge |
| Token exists but not signed | Amber "Consent Sent" badge + Resend icon + Copy link icon |
| No token, `onRequestConsent` available | "Send Link →" button |
| No token, no handler | `–` |

Resend icon has tooltip: "Resend consent link". Copy icon toggles to "Copied!" for 2 seconds.

### Clinical Status
Only shown if `clinicalStatus` is set. Four possible values:

| Value | Badge |
|---|---|
| `first_visit` | Sky — "First Visit" |
| `revisit` | Violet — "Revisit" |
| `follow_up_required` | Amber — "Follow-up Required" |
| `case_closed` | Emerald — "Case Closed" |

### Doctor Notes Indicator (Doctor view only)
Shows a small italic "Notes added" line if `booking.doctorNotes` is set.

### Chief Complaints
Always shown. Up to 3 complaints as green chip badges. If more exist, shows `+N` overflow count.

---

## 9. Banners (between info body and progress strip)

### Past-Due Warning
- Condition: Slot time passed more than 2 hours ago AND booking is not in any active/terminal state
- Amber warning: "Slot time has passed — please action this booking"
- Clinic view includes a "Reschedule" link

### Cancellation / No-Show / Left-Early Reason
- Shown when terminal AND `cancellationReason` is set
- Colour: Rose (cancelled), Slate (no-show), Amber (left-early)
- Text truncates; full text shown in tooltip on hover

### Visit Completion Note
- Shown when `isVisitCompleted` AND `visitCompletionNote` is set
- Emerald banner, text truncates with hover tooltip

### Unpaid Bill Alert
- Shown when `isVisitCompleted` AND `openBillsCount > 0`
- Amber banner: "N unpaid bill(s) — tap to settle"
- Tapping this banner opens the billing panel directly

### Late Check-In Notice
- Shown when patient arrived after the slot's end time
- Orange banner: "Arrived after scheduled slot time"

---

## 10. Progress Strip — All States

Five dots: **Booked · Confmd. · Arrived · In Tmt. · Visit Done**

### Normal (non-terminal) progression

| Step state | Dot | Label colour |
|---|---|---|
| Completed (behind current) | Emerald circle with checkmark | Emerald bold |
| Current active step | Sky circle with pulsing blue inner dot | Sky bold |
| Future (not yet reached) | Muted grey dot | Muted/40 |

**Visit Done dot variations** (when `visit_completed` is current):

| Condition | Dot border | Icon | Label |
|---|---|---|---|
| Unpaid bills exist | Amber | CheckCircle amber | Amber bold |
| No invoice at all | Dashed emerald | CheckCircle green | Emerald bold |
| Normal (paid / settled) | Solid emerald | CheckCircle green | Emerald bold |

**Tooltips on specific steps:**
- **Confmd. step** (when completed): "Confirmed by Doctor" / "Confirmed by Clinic Admin" / "Confirmed by {name}"
- **Visit Done step**: Shows visit completion note, or "Bill pending — invoice not yet settled", or "No invoice generated for this visit", or "Visit force-completed by admin — some stages were skipped"

### Override (force-completed)
Stages 1–3 (Confmd., Arrived, In Tmt.) are shown in **strikethrough orange** to indicate they were skipped.

### Terminal states (cancelled / no-show / left-early)

All dots up to and including the last-reached step are shown in the terminal colour. Future steps are muted grey.

| Terminal type | Colour palette |
|---|---|
| Cancelled | Rose |
| Left Early | Amber |
| No Show | Slate |

The **last completed dot** has a tooltip with the cancellation reason (or default text: "Appointment cancelled" / "Patient did not arrive" / "Patient left before the visit was completed").

---

## 11. Clinic Footer — Stage-by-Stage

### Primary Button (full-width)

| Stage | Button | Colour | Active? |
|---|---|---|---|
| Cancelled (terminal) | "Appointment Cancelled" | Rose (read-only) | No |
| No Show (terminal) | "Patient Did Not Arrive" | Slate (read-only) | No |
| Left Early (terminal) | "Patient Left Before Completion" | Amber (read-only) | No |
| Stage 0 — Pending (future slot) | **Confirm Appointment** | Blue | Yes |
| Stage 0 — Pending (past day) | **Past Appointment** (disabled) | Blue, disabled | No — tooltip: "This appointment was on a past day. Use Reschedule to move it to a new slot." |
| Stage 1 — Confirmed, not arrived | **Mark Arrived** | Sky | Yes |
| Stage 2 — Arrived / Checked In | **Waiting for Doctor** | Slate (read-only) | No |
| Stage 3a — In Consultation | **In Treatment** | Teal tint (read-only) | No |
| Stage 3b — Treatment Completed | **Mark Visit Done** | Emerald | Yes — if unpaid bills exist, shows badge "N unpaid" on the button |
| Stage 4 — Visit Completed, no invoice | **No Dues** (read-only) | Emerald outline | No |
| Stage 4 — Visit Completed, invoice exists | **Download Bill ↓** | Emerald solid | Yes |
| Stage 4 — Visit Completed, unpaid bills | **N Unpaid Bills ↓** | Emerald solid | Yes |

**Mark Visit Done with unpaid bills:** Triggers a confirmation dialog before proceeding. Options: "Bills to be settled separately", "Patient deferred payment", "Waived / Pro bono", "Error in billing". Admin can also click "Go to Billing" to settle first.

### Secondary Button Row

| Stage | Buttons |
|---|---|
| Stage 0–1 (pending / confirmed, not arrived) | **View** (opens booking detail) · **Cancel** (opens cancel dialog) |
| Stage 2–3b (arrived / in treatment / tmt. done) | **₹ Bill** (opens billing) · **Cancel** (opens cancel dialog) |
| Stage 4 (visit completed) | **View Summary** · **Rebook** |
| Any terminal state | **Rebook** (full-width) |

### Cancel Dialog
Requires selecting a reason:
- Patient requested cancellation
- Doctor unavailable
- Clinic closure / emergency
- Patient no-show
- Rescheduled to another slot
- Other (free-text input required)

---

## 12. Doctor Footer — Stage-by-Stage

The doctor footer is hidden entirely if the doctor has **Declined** the booking (shows "Appointment Declined" text instead).

### Primary Button (full-width)

| Condition | Button | Colour | Active? | Tooltip |
|---|---|---|---|---|
| `doctorApprovalStatus === "pending"` AND visit not completed/terminal | **Accept** + **Decline** (two buttons side by side) | Green + Rose outline | Yes | — |
| Approved/confirmed, not arrived | **Booked** (read-only) | Grey outline | No | "Waiting for patient to arrive — no action required" |
| `checked_in` | **Start Consultation** | Blue | Yes | — |
| `in_consultation` | **Done with Patient** | Violet | Yes | — |
| `treatment_completed` (not yet closed by clinic) | **Consultation Completed** (read-only) | Amber outline | No | "Your consultation is done — waiting for the clinic to close the visit" |
| `visit_completed` | **Visit Completed** (read-only) | Emerald outline | No | "Visit complete — managed by the clinic" |

**Important:** Accept / Decline are **hidden** if the visit is `treatment_completed`, `visit_completed`, or in any terminal state — even if `doctorApprovalStatus` is still `"pending"` (e.g. after an admin force-complete).

### Secondary Button Row

| Stage | Buttons |
|---|---|
| Approved, not arrived | **View Notes** |
| Patient Arrived (`checked_in`) | **View Notes** · **Add Observation** |
| In Consultation (`in_consultation`) | **Add Obs.** · **Notes** · **Issue Rx** |
| Treatment Completed (`treatment_completed`) | **View Notes** · **View Rx / Rec** |
| Visit Completed | **View Summary** · **Rebook** |

---

## 13. Complete State-by-State Card Snapshot

### Stage 0 — Booked (unconfirmed)

| Element | Clinic view | Doctor view |
|---|---|---|
| Accent bar | Primary green gradient | Primary green gradient |
| Left border | Amber 3 px | Amber 3 px |
| Status badge | Pending (amber pulsing) or Awaiting Dr (if doctor assigned) | Pending (amber pulsing) |
| Progress strip | **Booked** active (sky), rest muted | Same |
| Primary button | **Confirm Appointment** (blue) | **Accept / Decline** if assigned & pending |
| Secondary buttons | View · Cancel | View Notes |
| Three-dot menu | Send Reminder · Mark No Show · Mark Visit Complete ↗ | N/A |
| Banners | Past-due warning if slot > 2 h ago | Same indicator |

---

### Stage 1 — Confirmed

| Element | Clinic view | Doctor view |
|---|---|---|
| Accent bar | Primary green (future) or Sky (today) | Same |
| Left border | Emerald 3 px | Emerald 3 px |
| Status badge | **Confirmed** (green) | **Confirmed** (green) |
| Progress strip | Booked ✓, **Confmd.** active, rest muted | Same |
| Confmd. tooltip | "Confirmed by Clinic Admin" or "Confirmed by Doctor" | Same |
| Primary button | **Mark Arrived** (sky blue) | **Booked** (read-only grey) |
| Secondary buttons | View · Cancel | View Notes |
| Three-dot menu | Send Reminder · Mark No Show · Mark Visit Complete ↗ | N/A |

---

### Stage 2 — Patient Arrived (Checked In)

| Element | Clinic view | Doctor view |
|---|---|---|
| Accent bar | Sky/Cyan (today) | Sky/Cyan (today), pulsing |
| Left border | Emerald 3 px | Full primary green border (pulsing shadow) |
| Status badge | **Arrived** (blue pulsing) | **Arrived** (blue pulsing) |
| Progress strip | Booked ✓, Confmd. ✓, **Arrived** active, rest muted | Same |
| Late check-in banner | Shows if arrived after slot end time | Same |
| Primary button | **Waiting for Doctor** (grey, disabled) | **Start Consultation** (blue, active) |
| Secondary buttons | ₹ Bill · Cancel | View Notes · Add Observation |
| Three-dot menu | Mark No Show · Patient Left Early · Mark Visit Complete ↗ | N/A |

---

### Stage 3a — In Consultation

| Element | Clinic view | Doctor view |
|---|---|---|
| Accent bar | Teal (pulsing) | Teal (pulsing) |
| Left border | Full 2 px teal border + teal shadow | Full 2 px teal border |
| Status badge | **With Doctor** (teal) | **With Doctor** (teal) |
| Progress strip | Booked ✓, Confmd. ✓, Arrived ✓, **In Tmt.** active | Same |
| Primary button | **In Treatment** (teal tint, disabled) | **Done with Patient** (violet, active) |
| Secondary buttons | ₹ Bill · Cancel | Add Obs. · Notes · Issue Rx |
| Three-dot menu | Patient Left Early · Mark Visit Complete ↗ | N/A |

---

### Stage 3b — Treatment Completed (Doctor done, admin pending)

| Element | Clinic view | Doctor view |
|---|---|---|
| Accent bar | Amber → Yellow gradient | Amber → Yellow gradient |
| Left border | Amber 3 px | Amber 3 px |
| Status badge | **Tmt. Done** (amber pulsing) | **Tmt. Done** (amber pulsing) |
| Progress strip | Booked ✓, Confmd. ✓, Arrived ✓, **In Tmt.** active (same index as in_consultation) | Same |
| Primary button | **Mark Visit Done** (emerald, active) — shows unpaid badge if bills open | **Consultation Completed** (amber, disabled) |
| Tooltip on doctor button | — | "Your consultation is done — waiting for the clinic to close the visit" |
| Secondary buttons | ₹ Bill · Cancel | View Notes · View Rx / Rec |
| Three-dot menu | Mark Visit Complete ↗ (still available) | N/A |

---

### Stage 4 — Visit Completed

| Element | Clinic view | Doctor view |
|---|---|---|
| Accent bar | Emerald → Teal gradient | Emerald → Teal gradient |
| Left border | Emerald 3 px | Emerald 3 px |
| Status badge | **Visit Done** (green, ShieldCheck) | **Visit Done** (green, ShieldCheck) |
| Status tooltip | "Visit completed successfully" | Same |
| Progress strip | All ✓ green. Visit Done dot: solid green (paid), dashed green (no invoice), amber (unpaid bill) | Same |
| Visit Done tooltip | Visit completion note (if any), or bill status message | Same |
| Completion note banner | Shown if `visitCompletionNote` is set (emerald) | — |
| Unpaid bill banner | Shown if `openBillsCount > 0` (amber, tappable) | — |
| Primary button (no invoice) | **No Dues** (green outline, read-only) | **Visit Completed** (green outline, read-only) |
| Primary button (invoice exists) | **Download Bill ↓** (green solid, opens billing) | **Visit Completed** (green outline, read-only) |
| Primary button (unpaid) | **N Unpaid Bills ↓** (green solid) | **Visit Completed** (green outline, read-only) |
| Secondary buttons | View Summary · Rebook | View Summary · Rebook |
| Three-dot menu | Not shown (terminal-like for menu) | N/A |

---

### Terminal — Cancelled

| Element | Clinic view | Doctor view |
|---|---|---|
| Accent bar | Rose gradient | Rose gradient |
| Left border | Rose 3 px | Rose 3 px |
| Card opacity | 80% | 80% |
| Status badge | **Cancelled** (red ✕) | **Cancelled** (red ✕) |
| Status tooltip | "Appointment cancelled" | Same |
| Cancellation reason banner | Rose banner with reason text (truncated; full text in hover tooltip) | Same |
| Progress strip | Completed steps in rose colour; last reached dot has tooltip with reason | Same |
| Primary button | "Appointment Cancelled" (rose, read-only) | "Appointment Declined" footer text (if doctor also declined) |
| Secondary buttons | **Rebook** (full-width) | — |
| Three-dot menu | Not shown | N/A |

---

### Terminal — No Show

| Element | Clinic view | Doctor view |
|---|---|---|
| Accent bar | Slate gradient | Slate gradient |
| Left border | Slate 3 px | Slate 3 px |
| Status badge | **No Show** (slate, UserX) | **No Show** (slate) |
| Status tooltip | "Patient did not arrive" | Same |
| Reason banner | Slate banner with no-show reason | Same |
| Progress strip | Completed steps in slate; tooltip on last dot | Same |
| Primary button | "Patient Did Not Arrive" (slate, read-only) | No action buttons shown |
| Secondary buttons | **Rebook** (full-width) | — |

---

### Terminal — Left Early

| Element | Clinic view | Doctor view |
|---|---|---|
| Accent bar | Amber → Orange gradient | Same |
| Left border | Amber 3 px | Amber 3 px |
| Status badge | **Left Early** (amber, LogOut) | Same |
| Status tooltip | "Patient left before the visit was completed" | Same |
| Reason banner | Amber banner with reason | Same |
| Progress strip | Steps up to "In Tmt." (index 3) in amber; tooltip on last dot | Same |
| Primary button | "Patient Left Before Completion" (amber, read-only) | No action buttons |
| Secondary buttons | **Rebook** (full-width) | — |

---

### Override / Force-Completed

| Element | Value |
|---|---|
| Stage stored | `visit_completed` |
| `isOverrideCompleted` flag | True — `isVisitCompleted = true` AND `checkedInAt` is null |
| Accent bar | Emerald → Teal gradient |
| Progress strip | Visit Done dot ✓ green; steps 1–3 (Confmd., Arrived, In Tmt.) shown in **strikethrough orange** |
| Visit Done tooltip | "Visit force-completed by admin — some stages were skipped" |
| Buttons | Same as Stage 4 (Visit Completed) |

---

## 14. Doctor Approval vs Clinic Lifecycle — Interaction Rules

| Scenario | Clinic card shows | Doctor card shows |
|---|---|---|
| Booking new; doctor not yet assigned | "Assign Doctor →" link | Not relevant |
| Doctor assigned; not yet responded | "Awaiting approval" (amber) | **Accept / Decline** buttons |
| Doctor approved | "Approved ✓" (green) | "Booked" (read-only) |
| Doctor declined | "Declined ✗" (red) | "Appointment Declined" footer |
| Clinic force-completes; doctor still pending | "Visit Done" state | **No Accept/Decline** — shows "Visit Completed" (read-only) |
| Doctor marks Done with Patient; admin not closed | "Mark Visit Done" primary button (green) | "Consultation Completed" (amber, read-only) |
| Admin marks visit done | "Visit Done" state, billing buttons | "Visit Completed" (read-only) |

---

## 15. Colour Reference Summary

| Colour | Represents |
|---|---|
| **Blue** | Confirm Appointment action |
| **Sky/Cyan** | Mark Arrived action; today's appointment tint |
| **Teal** | Active consultation (in_consultation) state |
| **Violet** | Doctor "Done with Patient" action |
| **Amber/Orange** | Treatment completed, left-early, override, past-due |
| **Emerald/Green** | Confirmed, arrived (border), visit completed, Accept button |
| **Rose/Red** | Cancelled, declined, destructive actions |
| **Slate/Grey** | No-show, read-only / waiting states |

---

## 16. Inconsistency & Bug Audit — June 2026

This section documents a systematic review of 17 inconsistencies and edge cases found across the card components. For each item: the original problem, what was changed, and whether it was fixed or intentionally left alone.

---

### A — Genuine Logic Bugs

---

#### A1 — Patient who arrives then leaves waiting room had no exit path

**Problem found:**
"Patient Left Early" was only available during `in_consultation`. "Mark No Show" explicitly excluded `isCheckedIn` via `!isCheckedIn` in its condition. If a patient checked in at the front desk and then walked out of the waiting room before seeing the doctor, there was no correct action available:
- Mark No Show — hidden (patient technically did show up)
- Patient Left Early — hidden (was gated on `isInConsultation` only)
- Cancel — semantically wrong (fires a cancellation email; doesn't record that the patient arrived)
- Override complete — produces the wrong outcome (records the visit as "done")
- The booking would be permanently stuck at Stage 2 (Arrived) with no closure path.

The code comment at line 548 even said *"allowed when not yet arrived OR when arrived-but-not-called (checked in)"* — but the condition directly below it (`!isCheckedIn && !isInConsultation`) contradicted the comment.

**Fix applied:**
`Patient Left Early` was expanded to also appear at Stage 2 (`isCheckedIn`). The trigger condition changed from:
```
{isInConsultation && (
```
to:
```
{(isCheckedIn || isInConsultation) && (
```

The dialog title was updated from "Patient Left During Consultation?" to "Patient Left Before Visit Completed?" and the description shortened to remove the reference to clinical notes (which don't yet exist at Stage 2). The code comment was corrected to match.

**Status: ✅ Fixed**

---

#### A2 — "Send Reminder" visible while patient was physically in the building

**Problem found:**
Condition was `!isVisitCompleted && !isTreatmentCompleted && !isPast`. This allowed the Send Reminder menu item to appear at Stage 2 (Arrived — patient is at reception) and Stage 3a (In Consultation — patient is with the doctor). Sending a reminder SMS/email at those moments is nonsensical and risks alarming the patient.

**Fix applied:**
Added `!isCheckedIn && !isInConsultation` to the condition:
```
{!isVisitCompleted && !isTreatmentCompleted && !isPast && !isCheckedIn && !isInConsultation && (
```
Send Reminder now only appears at Stage 0 (booked/pending) and Stage 1 (confirmed, not yet arrived).

**Status: ✅ Fixed**

---

#### A3 — "Reassign Doctor" visible while patient was actively being treated

**Problem found:**
Condition was `!isVisitCompleted && !isTreatmentCompleted`. This showed "Reassign Doctor" at Stage 3a (In Consultation) — while the doctor was in the room treating the patient. Reassigning mid-consultation would create a split record: the treating doctor's consultation notes and clinical entries would be associated with one name, while the booking would be updated to point at another.

Reassigning at Stage 2 (Arrived / waiting room) was left allowed because the doctor may be genuinely unavailable and the patient hasn't been called yet.

**Fix applied:**
Added `!isInConsultation` to the Reassign Doctor condition:
```
{!isVisitCompleted && !isTreatmentCompleted && !isInConsultation && (booking.clinicDoctors ?? []).length > 0 && (
```

**Status: ✅ Fixed**

---

#### A4 — ⋮ Menu button shown on completed visits containing only "No actions available"

**Problem found:**
`canShowMoreMenu` was defined as:
```
role === "clinic" && !isCancelled && !isNoShowState && !isLeftEarlyState
```
It did not exclude `isVisitCompleted`. So on completed cards, the ⋮ button was visible. Clicking it opened a popover containing only a single line: "No actions available" — with no actionable items. A visible control that does nothing is worse than hiding it.

**Fix applied:**
Added `&& !isVisitCompleted` to `canShowMoreMenu`:
```
role === "clinic" && !isCancelled && !isNoShowState && !isLeftEarlyState && !isVisitCompleted
```
The ⋮ button is now hidden on completed visits.

**Status: ✅ Fixed**

---

#### A5 — Cancel button available after doctor had already treated the patient

**Problem found:**
Secondary buttons at Stage 3b (Treatment Completed) included a Cancel button. The condition was:
```
(isCheckedIn || isInConsultation || (isTreatmentCompleted && !isVisitCompleted))
```
All three stages received the same `₹ Bill · Cancel` pair. Cancelling at Stage 3b creates an inconsistent record: `visitStatus = "treatment_completed"` with `verificationStatus = "cancelled"`, recording a treatment that was delivered as if the appointment never happened. The cancel dialog at that stage had no awareness of the treatment already being completed.

**Fix applied:**
Split into two separate conditions:

**Stage 2 and 3a only** — `₹ Bill + Cancel` (patient can still leave without treatment):
```
{!isTerminal && (isCheckedIn || isInConsultation) && (
  <div className="flex gap-2">
    <Button ...>₹ Bill</Button>
    <Button ...>Cancel</Button>
  </div>
)}
```

**Stage 3b only** — `₹ Bill` (full-width, no Cancel):
```
{!isTerminal && isTreatmentCompleted && !isVisitCompleted && (
  <Button className="w-full ...">₹ Bill</Button>
)}
```

After Stage 3b, the admin's only path is "Mark Visit Done" (primary button) or "Mark Visit Done" from the three-dot menu. There is no cancellation path once treatment has been delivered. This is the intended business outcome.

**Status: ✅ Fixed**

---

### B — Visual / UI Inconsistencies

---

#### B1 — Status badge never showed "Awaiting Dr" after confirmation

**Problem found:**
The status badge priority order placed `isConfirmed` before the `assignedDoctor && doctorApprovalStatus === "pending"` check:
```
if (isConfirmed) return "Confirmed"
if (booking.assignedDoctor && doctorApprovalStatus === "pending") return "Awaiting Dr"
```
Once the clinic confirmed a booking (Stage 1+), the badge always showed "Confirmed" (green) regardless of whether the assigned doctor had accepted. The doctor's pending state was only visible in the smaller assignment info row ("Dr. Name · Awaiting approval"). The prominent top-right badge gave a false impression of readiness.

In practice "Awaiting Dr" could only ever appear at Stage 0 — an unusual sequence where a doctor is assigned before the clinic confirms.

**Fix applied (two parts):**

**Part 1 — Badge priority reordered:** Moved the "Awaiting Dr" check to appear before `isConfirmed`:
```
if (booking.assignedDoctor && doctorApprovalStatus === "pending") return "Awaiting Dr"
if (isConfirmed) return "Confirmed"
```
Now when a booking is confirmed but the doctor has not yet accepted, the badge shows "Awaiting Dr" (amber pulsing) instead of "Confirmed" (green). This accurately signals that the booking is not fully ready.

**Part 2 — statusTooltip updated:** Added the matching tooltip case before the `isConfirmed` tooltip:
```
: (booking.assignedDoctor && booking.doctorApprovalStatus === "pending")
? "Doctor assigned — awaiting their confirmation"
: isConfirmed
? "Appointment confirmed"
```

**Status: ✅ Fixed**

---

#### B2 — Clinic view: "Arrived" (Stage 2) and "Confirmed" (Stage 1) looked identical on the card border

**Problem found:**
The `cardBorderClass` logic gave the full 2 px highlight border only to the doctor view for `isCheckedIn`:
```
: role === "doctor" && isCheckedIn
? "border-2 border-primary/60 shadow-sm shadow-primary/10"
```
In clinic view, `isCheckedIn` fell through to `isConfirmed` which is `border-l-[3px] border-l-emerald-400` — the same border as Stage 1 (Confirmed). Clinic admins scanning a busy list could not visually distinguish between a patient who had arrived and one who hadn't yet.

**Fix applied:**
Added a distinct sky-blue left border for `isCheckedIn` in clinic view, inserted immediately after the doctor-view full border:
```
: isCheckedIn
? "border-l-[3px] border-l-sky-400 dark:border-l-sky-500"
```
Stage 2 (Arrived) now shows a sky-blue left border in clinic view, matching the sky colour already used for the accent bar and "Arrived" status badge on today's appointments.

**Status: ✅ Fixed**

---

#### B3 — Progress strip looked identical at Stage 3a (In Consultation) and Stage 3b (Treatment Completed)

**Problem found:**
Both `in_consultation` and `treatment_completed` mapped to step index 3 in `stageToIndex()`. The progress strip rendered the same pulsing blue dot at "In Tmt." for both stages. The only visual difference between the two stages was the accent bar colour and the status badge — the strip itself gave no signal that the doctor had finished.

**Fix applied (`BookingProgressStrip.tsx`):**
Added a branch inside the `isCurrent` rendering block: when `stage === "treatment_completed"` and the current step index is 3, the dot switches from the pulsing blue animation to an **amber static checkmark**:
```
if (stage === "treatment_completed" && i === 3) {
  dotBg     = "bg-amber-50 dark:bg-amber-950/20";
  dotBorder = "border-amber-400 dark:border-amber-600";
  dotInner  = <CheckCircle2 className="h-2.5 w-2.5 text-amber-500 dark:text-amber-400" />;
  labelColor= "text-amber-600 dark:text-amber-400 font-semibold";
}
```

At Stage 3a (`in_consultation`) the dot remains a pulsing blue circle.
At Stage 3b (`treatment_completed`) the dot shows a static amber checkmark — signalling "done by doctor, waiting for admin".

**Status: ✅ Fixed**

---

### C — Documentation Gaps (document-only, no code change needed)

---

#### C1 — "Reassign Doctor" menu item was not documented at all

**Problem found:**
The three-dot menu has five possible items. The original document listed only four. "Reassign Doctor" (visible when `!isVisitCompleted && !isTreatmentCompleted && clinicDoctors.length > 0`) was entirely absent from Section 7.

**Fix applied:**
Section 7 of this document now lists "Reassign Doctor" as the first menu item, with its correct visibility condition. The code fix to A3 (blocking it during `in_consultation`) is also reflected.

**Status: ✅ Documented**

---

#### C2 — "Mark Visit Done" also appears inside the three-dot menu (duplicate of primary button)

**Problem found:**
At Stage 3b (`treatment_completed && !isVisitCompleted`), the three-dot menu renders a "Mark Visit Done" item. This is a different entry point from the large green primary footer button. The menu version opens a "reason" dropdown dialog before calling `handleMarkVisitDone()`; the footer button calls the same handler directly (which checks for unpaid bills). The document did not mention the menu item at all, implying "Mark Visit Done" was footer-only.

**Fix applied:**
Section 7 now documents the "Mark Visit Done" menu item with its condition and the note that it is a second entry point for the same action (with a reason dialog).

**Status: ✅ Documented**

---

#### C3 — "No actions available" fallback text inside the ⋮ menu was undocumented

**Problem found:**
When `isVisitCompleted` (which was previously allowed through `canShowMoreMenu`), the popover body showed a single centred line "No actions available". This was never mentioned in the document.

**Fix applied:**
This state no longer occurs after fix A4 (⋮ menu is now hidden when `isVisitCompleted`). The fallback text in the JSX has been left in place as a defensive guard, but users will never see it in normal flow. Documented here for completeness.

**Status: ✅ Documented (state no longer reachable after A4)**

---

### D — Edge Cases

---

#### D1 — Override option silently disappeared at Stage 3b with no explanation

**Problem found:**
The "Mark Visit Complete ↗" override option has the condition `!isVisitCompleted && !isTreatmentCompleted`. Once the doctor marks "Done with Patient" (`visitStatus = "treatment_completed"`), `isTreatmentCompleted` becomes true and the override disappears from the menu. No UI element explained why it was gone or what the admin should do instead. A clinic admin accustomed to seeing the override option would be confused by its absence at Stage 3b.

**Fix applied:**
Added an informational text line inside the three-dot menu that appears only at Stage 3b:
```
{isTreatmentCompleted && !isVisitCompleted && (
  <p className="text-[10px] text-muted-foreground/50 px-2 pb-1">
    Force-complete not available — use "Mark Visit Done" above.
  </p>
)}
```
This appears below the "Mark Visit Done" menu item (which is the only other item visible at Stage 3b) and directly explains the situation.

**Status: ✅ Fixed**

---

#### D2 — "Patient Left Early" and "Mark Visit Complete ↗" sat side-by-side in the menu at Stage 3a with no context

**Problem found:**
At Stage 3a (`in_consultation`), both "Patient Left Early" (a terminal action — records a bad exit) and "Mark Visit Complete ↗" (an override — marks the visit as successfully done) were visible in the same menu. They were separated only by a plain `<div className="h-px bg-border/40" />` divider line with no label. To an admin, both appeared to be equivalent peer actions. Clicking the wrong one would produce a very different outcome.

**Fix applied:**
Replaced the plain divider with a labelled section header reading "Admin Override" in uppercase muted text:
```
<div className="mt-1 pt-1 border-t border-border/40">
  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 px-2 pb-0.5">
    Admin Override
  </p>
</div>
```
The "Mark Visit Complete ↗" button now clearly sits under an "Admin Override" section heading, distinguishing it from the operational actions above it.

**Status: ✅ Fixed**

---

#### D3 — Doctor view progress strip showed "Booked" even when clinic had confirmed

**Problem found:**
`isConfirmed` was defined as role-dependent:
- Clinic view: `isClinicConfirmed` (verificationStatus === "confirmed")
- Doctor view: `isDoctorConfirmed` (doctorApprovalStatus === "approved" or "admin_confirmed")

The progress strip's `lifecycleStage` used this role-adjusted value. So in doctor view, if the clinic had confirmed the booking but the doctor hadn't approved yet, the strip showed the "Booked" state (all grey except the first dot) — as if the appointment hadn't been confirmed at all. The progress strip was showing the doctor's personal approval state, not the booking's actual lifecycle state.

**Fix applied:**
Changed the `lifecycleStage` computation to always use `isClinicConfirmed` for the "confirmed" step, regardless of role:
```
: isClinicConfirmed ? "confirmed"
: "booked"
```
Both clinic and doctor views now show "Confirmed" on the progress strip when the clinic has confirmed the booking. The doctor's approval state is shown separately via the Accept/Decline buttons and the status badge — not via the progress strip.

**Status: ✅ Fixed**

---

#### D4 — `isOverrideCompleted` detection was fragile

**Problem found:**
Override detection logic:
```
const isOverrideCompleted = isVisitCompleted && !booking.checkedInAt && !isLeftEarlyState
```
This detects an admin force-complete by checking for the *absence* of `checkedInAt`. However, there are legitimate scenarios where `checkedInAt` would be null on a completed visit:
- A very short walk-in where the clinic skipped the check-in step and went straight to treatment.
- A home-visit or phone consultation marked complete without a physical check-in.
- Any future workflow variation that completes a visit without a formal check-in step.

In all these cases, the progress strip would incorrectly show steps 1–3 in orange strikethrough, falsely indicating that stages were force-skipped.

**Fix applied: none — schema change required.**
The proper fix requires a dedicated boolean column (`is_override_complete BOOLEAN DEFAULT FALSE`) on the `bookings` table, set to `true` only when the admin explicitly triggers the force-complete path. This would give an unambiguous signal rather than inferring from the absence of a timestamp. This change requires:
- A new column in the Drizzle schema (`shared/schema.ts`)
- The corresponding `ALTER TABLE bookings ADD COLUMN is_override_complete BOOLEAN DEFAULT FALSE;` SQL on the production database
- The backend override endpoint to set it to `true`
- The card to read `booking.isOverrideComplete` instead of the absence heuristic

This is tracked but deferred. Until it is fixed, the heuristic holds for the current standard workflow — all legitimate completions in the system currently go through check-in first.

**Status: ❌ Not fixed — requires schema change**

---

#### D5 — `isPastDay` was a redundant variable always equal to `isPast`

**Problem found:**
Two variables existed for the same concept:
```
const isPast    = startTime < startOfToday && !isToday;
const isPastDay = isPast && !isToday;
```
`isPast` already excludes `isToday` in its own definition. The `&& !isToday` appended to `isPastDay` was therefore always a no-op — `isPastDay === isPast` in all cases. The variable added confusion about whether a subtle distinction existed between the two.

**Fix applied:**
Removed the `isPastDay` variable declaration and replaced all four usages with `isPast`:
- `onClick={() => !isPastDay && onConfirm?.()}` → `!isPast`
- `disabled={confirmPending || isPastDay}` → `confirmPending || isPast`
- `{isPastDay ? "Past Appointment" : "Confirm Appointment"}` → `{isPast ? ...`
- `{isPastDay && (<TooltipContent...` → `{isPast && ...`

**Status: ✅ Fixed**

---

### Summary Table

| ID | Category | Description | Status |
|---|---|---|---|
| A1 | Logic Bug | Patient arrives and leaves waiting room — no exit action | ✅ Fixed: Patient Left Early now also shows at Stage 2 |
| A2 | Logic Bug | Send Reminder shows while patient is physically in clinic | ✅ Fixed: Blocked at `isCheckedIn` and `isInConsultation` |
| A3 | Logic Bug | Reassign Doctor shown mid-consultation | ✅ Fixed: Blocked at `isInConsultation` |
| A4 | Logic Bug | ⋮ menu shown on completed visits showing only "No actions available" | ✅ Fixed: `canShowMoreMenu` now excludes `isVisitCompleted` |
| A5 | Logic Bug | Cancel button available after doctor already treated patient | ✅ Fixed: Stage 3b now shows `₹ Bill` only; no Cancel |
| B1 | Visual | "Awaiting Dr" badge never shown after confirmation; badge said "Confirmed" even when doctor pending | ✅ Fixed: "Awaiting Dr" now has higher priority than "Confirmed" in badge logic; tooltip updated |
| B2 | Visual | Clinic view: Stage 1 and Stage 2 indistinguishable by left border | ✅ Fixed: Stage 2 (Arrived) now has sky-blue left border |
| B3 | Visual | Progress strip at Stage 3a and Stage 3b looked identical | ✅ Fixed: Stage 3b dot is now amber static checkmark; Stage 3a remains pulsing blue |
| C1 | Doc gap | "Reassign Doctor" menu item missing from document | ✅ Documented in Section 7 |
| C2 | Doc gap | "Mark Visit Done" also exists as a three-dot menu item at Stage 3b | ✅ Documented in Section 7 |
| C3 | Doc gap | "No actions available" fallback text inside ⋮ menu undocumented | ✅ Documented (state no longer reachable after A4) |
| D1 | Edge case | Override option disappears at Stage 3b silently with no explanation | ✅ Fixed: Info text added inside menu at Stage 3b |
| D2 | Edge case | "Patient Left Early" and "Mark Visit Complete ↗" sat side-by-side with only a plain divider | ✅ Fixed: "Admin Override" section label added above override button |
| D3 | Edge case | Doctor view progress strip showed "Booked" even when clinic had confirmed | ✅ Fixed: `lifecycleStage` now always uses `isClinicConfirmed` for the "confirmed" step |
| D4 | Edge case | `isOverrideCompleted` flag misfires for walk-in visits with no check-in | ❌ Not fixed — requires `is_override_complete` column in schema |
| D5 | Code quality | `isPastDay` variable was always identical to `isPast` (redundant) | ✅ Fixed: Variable removed; all usages replaced with `isPast` |

---

*Section added: June 2026. Reflects AppointmentCard.tsx and BookingProgressStrip.tsx after the June 2026 audit.*

---

## 17. Inconsistency & Bug Audit — June 2026 (Batch 2)

This section documents a second round of review covering 5 reported issues plus 1 additional inconsistency found during analysis. All 6 items were fixed.

---

### Issue 1 — Visit-completed bookings appearing in "Upcoming Bookings"

**Problem found:**
Both the Clinic Dashboard and Doctor Dashboard "Upcoming" filters were **purely date-based** — they only checked whether the slot date falls in the future. No check on `visitStatus`. A booking that the clinic had already marked "Visit Complete" (via override or early completion), but whose scheduled slot date was still in the future, would continue to appear in the "Upcoming Bookings" view and inflate the "Upcoming" stat card count.

**Root cause:**
- ClinicDashboard.tsx `quickFilter === 'upcoming'` (line 1088): `bookingDate >= todayStart && format(bookingDate, 'yyyy-MM-dd') !== todayStr`
- DoctorDashboard.tsx `upcomingBookings` (line 529): `d && d >= new Date()`
- DoctorDashboard.tsx `quickFilter === "upcoming"` branch (line 553): `bdt >= new Date()`

None of these conditions checked `visitStatus`.

**Fix applied:**
Added `&& booking.visitStatus !== 'completed'` / `&& b.visitStatus !== 'completed'` to all three filter conditions:

- **ClinicDashboard.tsx**: `bookingDate >= todayStart && format(bookingDate, 'yyyy-MM-dd') !== todayStr && booking.visitStatus !== 'completed'`
- **DoctorDashboard.tsx** `upcomingBookings`: `d && d >= new Date() && b.visitStatus !== 'completed'`
- **DoctorDashboard.tsx** quickFilter branch: `bdt >= new Date() && b.visitStatus !== 'completed'`

Completed visits now only appear in the "All" or "Past" views, not "Upcoming".

**Status: ✅ Fixed**

---

### Issue 2 — Doctor card showed "Waiting for patient to arrive" tooltip on No Show, Cancelled, and Left Early bookings

**Problem found:**
The "Booked" read-only button in the doctor footer (the Stage 1 placeholder shown when the doctor is approved but the patient hasn't arrived yet) had this condition:
```
booking.doctorApprovalStatus !== "pending"
  && !isCheckedIn && !isInConsultation
  && !isTreatmentCompleted && !isVisitCompleted
```
This condition did not exclude terminal states (`isNoShowState`, `isCancelled`, `isLeftEarlyState`). Since none of the "not in active state" checks are true for a terminal booking, the "Booked" button would render with its tooltip saying "Waiting for patient to arrive — no action required". For a No Show booking, this is factually wrong.

Additionally, the entire doctor footer section had **no output for terminal states** — no button, no text, blank footer. The `isDoctorDeclined` path renders "Appointment Declined" text, but cancelled, no-show, and left-early had no equivalent indicator.

**Fix applied (two parts):**

**Part 1 — "Booked" button now excludes terminal states:**
Added `!isTerminal` to the condition:
```
booking.doctorApprovalStatus !== "pending" && !isTerminal && !isCheckedIn && !isInConsultation && !isTreatmentCompleted && !isVisitCompleted
```

**Part 2 — Terminal state indicator added:**
A new block renders after the "Booked" button section (which is now hidden for terminal states) showing a contextual muted message:
```
{isTerminal && (
  <div ... bg-muted/40 border border-border/40>
    {isNoShowState ? "Patient did not arrive"
    : isCancelled ? "Appointment cancelled"
    : "Patient left before completion"}
  </div>
)}
```

**Status: ✅ Fixed**

---

### Issue 3 — Progress strip "Visit Done" dot showed amber when visit was complete but bills were unpaid

**Problem found:**
The `isLast && isCurrent` branch in the normal render of BookingProgressStrip.tsx had three colour paths for the Visit Done dot:
1. `hasUnpaidBill` → **amber** dot + amber line
2. `noBill` → dashed green dot
3. Otherwise → solid green dot

When a visit was marked complete with outstanding bills, the Visit Done dot (step 4) showed amber. The user correctly identified that the visit IS done — the billing status is already communicated separately (primary footer button shows "N Unpaid Bills ↓", the amber billing banner appears on the card). Having the progress strip dot also turn amber created visual confusion about whether the visit was actually complete.

**Fix applied:**
Removed the `hasUnpaidBill` amber branch entirely from the Visit Done dot. The dot now has only two variations:
- `noBill` → dashed green (no invoice was generated)
- Otherwise → solid green (visit done, billed or not)

The billing tooltip (`"Bill pending — invoice not yet settled"`) on the Visit Done dot is preserved — the dot itself is green, but hovering still tells the user about pending bills.

**Status: ✅ Fixed**

---

### Issue 4 — No Show progress strip: completed steps shown in slate instead of green

**Problem found:**
In the terminal render of BookingProgressStrip.tsx, ALL steps that were completed before the terminal event used the same terminal colour palette:
- Cancelled → rose for all completed steps
- No Show → slate for all completed steps
- Left Early → amber for all completed steps

Steps that genuinely happened (the patient booked, the clinic confirmed) were coloured the same as the terminal event itself. This misrepresented the appointment history. For example, a confirmed booking where the patient no-showed should show: Booked (green ✓) → Confirmed (green ✓) → Arrived (slate dot — no-show happened here).

**Fix applied:**
The terminal render now splits `wasDone` steps into two categories:

```
if (wasDone) {
  if (isLastDone) {
    // Terminal event dot — slate/rose/amber in terminal colour
  } else {
    // Steps that genuinely occurred — shown in green (emerald checkmark)
  }
}
```

- Steps 0 to `stageBeforeCancel - 1`: green emerald checkmark (they genuinely happened)
- Step `stageBeforeCancel` (the last reached step): terminal colour dot with the tooltip (reason text)
- Steps after `stageBeforeCancel`: grey (never reached)

This applies equally to all terminal states: No Show (slate terminal dot), Cancelled (rose terminal dot), Left Early (amber terminal dot). The genuinely completed prior steps always show green regardless of which terminal state occurred.

**Status: ✅ Fixed**

---

### Issue 5 — Visit Type and Treatment not displayed for patient-booked appointments

**Problem found (two parts):**

**Part A — Schema mismatch (primary bug):**
`visitType` and `treatmentCategory` were added to the database via raw SQL migrations in `db.ts`, but were **never added to `shared/schema.ts`** (the Drizzle ORM schema definition). As a result:
- Drizzle's `insert().values()` silently ignores these fields even when cast with `as any` — Drizzle only maps columns it knows from the schema.
- Drizzle's `select().from(bookings)` also does not include them in query results.
- The frontend receives `booking.visitType = undefined` for all bookings.
- The card falls back to parsing the `description` field (`Visit: X` pattern), which doesn't match the free-text patient descriptions. Both fields show "–".

**Part B — Wrong hardcoded values:**
Even with the schema fixed, `server/routes.ts` was hardcoding `visitType: 'booked_by_patient'` and `treatmentCategory: 'consultation'` for every patient-booked appointment. Per the existing documentation ("Both are stored on `bookings.visit_type` and `bookings.treatment_category`. They are set by clinic admin when booking — never by the patient."), patients do not and should not choose these fields. The patient booking form has no UI for them. Storing a technical placeholder like `'booked_by_patient'` adds noise without clinical value.

**Fix applied (two parts):**

**Part A — Added to schema:**
`visitType` and `treatmentCategory` added to the `bookings` table definition in `shared/schema.ts`:
```ts
visitType: varchar("visit_type", { length: 50 }),
treatmentCategory: varchar("treatment_category", { length: 255 }),
```
These columns already exist in the database (created by the `db.ts` migration). Adding them to the schema makes Drizzle select them in queries and map them correctly in query results.

**Part B — Removed hardcoded placeholders from patient booking:**
In `server/routes.ts`, the patient booking insert no longer sets these fields. They default to `null` in the database, and the card displays "–" for both. The clinic admin sets the actual visit type and treatment category when reviewing and confirming the booking.

**Status: ✅ Fixed**

> **Note for production deployment:** The `visit_type` and `treatment_category` columns already exist in the Render production database (added by the `db.ts` startup migration). No additional SQL is required for this fix.

---

### Additional finding — Doctor footer blank for terminal states (No Show / Cancelled / Left Early)

**Problem found:**
The doctor footer section (`role === "doctor" && !isDoctorDeclined`) produced a **completely empty footer** for terminal bookings — no button, no text, blank space. The `isDoctorDeclined` path renders "Appointment Declined" text as a clear indicator, but there was no equivalent for the other three terminal states. A doctor looking at a no-show booking in their list would see a normal card with no footer indication of the outcome.

**Fix applied:**
Added a terminal state indicator inside the doctor footer. After the (now terminal-excluded) "Booked" button and before the active Stage 2 button, a muted text block renders whenever `isTerminal`:
```
{isTerminal && (
  <div className="w-full ... bg-muted/40 border border-border/40">
    <span className="text-xs text-muted-foreground">
      {isNoShowState ? "Patient did not arrive"
      : isCancelled ? "Appointment cancelled"
      : "Patient left before completion"}
    </span>
  </div>
)}
```

**Status: ✅ Fixed**

---

### Summary Table

| ID | Issue | Status |
|---|---|---|
| 1 | Visit-completed bookings appeared in "Upcoming Bookings" (Clinic + Doctor dashboards) | ✅ Fixed: `visitStatus !== 'completed'` added to all upcoming filters |
| 2 | Doctor card showed "Waiting for patient to arrive" tooltip on No Show / Cancelled / Left Early | ✅ Fixed: `!isTerminal` added to "Booked" button condition |
| 3 | Progress strip "Visit Done" dot amber when visit complete + unpaid bills | ✅ Fixed: Visit Done dot always green; billing communicated via button/banner only |
| 4 | No Show progress strip: completed steps shown in slate (terminal colour) instead of green | ✅ Fixed: Prior completed steps now show green; only last step shows terminal colour |
| 5 | Visit Type and Treatment not displayed for patient bookings (schema missing + wrong defaults) | ✅ Fixed: Added columns to `shared/schema.ts`; removed hardcoded placeholders from patient booking insert |
| + | Doctor footer blank (no text) for terminal bookings | ✅ Fixed: Terminal state indicator added to doctor footer |

---

*Section added: June 2026 (Batch 2). Reflects AppointmentCard.tsx, BookingProgressStrip.tsx, ClinicDashboard.tsx, DoctorDashboard.tsx, server/routes.ts, and shared/schema.ts.*
