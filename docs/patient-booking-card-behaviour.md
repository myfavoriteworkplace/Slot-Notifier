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

*Last updated: June 2026 — reflects AppointmentCard.tsx v1691 and BookingProgressStrip.tsx v317.*
