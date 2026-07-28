# Appointment Card Footer — Stage Guide

This document defines the complete footer behaviour for the `AppointmentCard` component across both **Clinic** and **Doctor** roles. It covers every lifecycle stage: what info messages appear above the progress strip, what action buttons are shown in the footer, and the rationale behind each decision.

---

## Design Principles

1. **Buttons do exactly one thing.** Every footer button is actionable. Disabled "status" buttons have been removed.
2. **Status lives in the info strip.** Contextual state (e.g. "Consultation in progress") is shown as a coloured info strip above the progress bar — not as a disabled placeholder button.
3. **Progressive disclosure.** Destructive or rare actions (Cancel at active stages, Send Reminder at pending) live in the three-dot overflow menu or are conditionally promoted when most relevant.
4. **Role separation.** Clinic and Doctor footers are completely independent and rendered only for their respective role.

---

## Clinic Role

### Info Strip Messages (above progress bar)

These messages appear as coloured pills between the banners and the progress strip. They replace what were previously disabled "status" buttons in the footer.

| Stage | Condition | Colour | Icon | Message |
|---|---|---|---|---|
| Arrived / Waiting | `isCheckedIn && !isTerminal` | Blue | Clock | "Patient is waiting for the doctor" |
| In Treatment | `isInConsultation` | Violet | Activity | "Consultation is in progress" |

> Existing banners (past-due warning, cancellation reason, visit completion note, unpaid bill alert, delayed check-in) are unchanged and continue to render above the info strip messages.

---

### Footer Buttons — Clinic Role

#### Stage 0 — Pending (future appointment)

| Element | Type | Label | Action | Condition |
|---|---|---|---|---|
| **Confirm** | Primary button (blue, flex-1) | Confirm | Calls `onConfirm` | Always shown when pending + future |
| **Cancel** | Ghost destructive (shrink) | Cancel | Opens cancel dialog | Always shown when pending + future |

**Three-dot menu:** Reassign Doctor · Send Reminder · Mark No Show · Admin Override

---

#### Stage 0 — Pending (past slot)

| Element | Type | Label | Action | Condition |
|---|---|---|---|---|
| **Reschedule** | Primary button (amber, flex-1) | Reschedule | Calls `onOpenActionTab` | Replaces Confirm when `isPast` |
| **Cancel** | Ghost destructive (shrink) | Cancel | Opens cancel dialog | Always shown |

> Previously the button was a disabled grey "Past Appointment" with no action. Now it is an actionable amber "Reschedule" button that opens the reschedule/action tab.

---

#### Stage 1 — Confirmed (not yet arrived)

| Element | Type | Label | Action | Condition |
|---|---|---|---|---|
| **Mark Arrived** | Primary button (sky, flex-1) | Mark Arrived | Calls `onCheckIn` | Always shown |
| **Send Reminder** | Outline (shrink) | Remind | Calls `onSendReminder` | Only when future (`!isPast`) and `onSendReminder` provided |

**Three-dot menu:** Reassign Doctor · Mark No Show · Cancel Booking · Patient Left Early · Admin Override

> Cancel was removed from the footer at this stage — it is now in the three-dot overflow. Send Reminder was promoted from the overflow menu to the footer because the most common time to send a reminder is right after confirmation.

---

#### Stage 2 — Arrived / Waiting for Doctor

| Element | Type | Label | Action | Condition |
|---|---|---|---|---|
| **₹ Bill** | Outline (flex-1) | ₹ Bill | Calls `onBill` | Always shown |

**Info strip:** "Patient is waiting for the doctor" (blue)

**Three-dot menu:** Reassign Doctor · Cancel Booking · Patient Left Early · Admin Override

> Previously this stage had a disabled "Waiting for Doctor" button and a "Cancel" button. The status message is now in the info strip. Cancel moved to the three-dot because cancelling a patient who has already arrived is an unusual action. Billing for advance payment remains available.

---

#### Stage 3 — In Treatment / In Consultation

| Element | Type | Label | Action | Condition |
|---|---|---|---|---|
| **₹ Bill** | Outline (flex-1) | ₹ Bill | Calls `onBill` | Always shown |

**Info strip:** "Consultation is in progress" (violet)

**Three-dot menu:** Reassign Doctor · Cancel Booking · Patient Left Early · Admin Override

> Previously had a disabled "In Treatment" button and a "Cancel" button. The status moved to the info strip. Cancel is in the overflow — cancelling mid-treatment is rare and potentially dangerous as a one-click action.

---

#### Stage 3b — Treatment Completed

| Element | Type | Label | Action | Condition |
|---|---|---|---|---|
| **₹ Bill** | Outline (shrink) | ₹ Bill | Calls `onBill` | Always shown |
| **Mark Visit Done** | Primary (emerald, flex-1) | Mark Visit Done | Opens unpaid-bill warning if bills outstanding, else calls `onCompleteVisit` | Always shown |

> Badge on "Mark Visit Done" shows unpaid bill count when `openBillsCount > 0`. This is the most complete stage design — both the billing and visit-closure CTAs are visible and correctly weighted.

---

#### Stage 5 — Visit Completed

| Sub-state | Element | Type | Label | Action |
|---|---|---|---|---|
| Payment outstanding | **Settle Payment** | Amber outline (flex-1) | Settle Payment | Calls `onBill` |
| Payment outstanding | **Rebook** | Outline (shrink) | Rebook | Calls `onBookAgain` |
| Fully paid | **View Invoice** | Emerald primary (flex-1) | View Invoice | Calls `onBill` (opens bill panel for download) |
| Fully paid | **Rebook** | Outline (shrink) | Rebook | Calls `onBookAgain` |
| No bill raised | **No Dues** | Emerald outline (flex-1, static) | No Dues | Non-interactive status |
| No bill raised | **Rebook** | Outline (shrink) | Rebook | Calls `onBookAgain` |

> "Paid" was renamed "View Invoice" to clarify the action (it opens the bill/receipt panel, not just a confirmation). "Payment Pending" was renamed "Settle Payment" for consistency.

---

#### Terminal — Cancelled

| Element | Type | Label | Action | Condition |
|---|---|---|---|---|
| Status banner | Non-interactive | "Appointment Cancelled" | — | Always shown |
| **View Bill** | Outline (shrink) | View Bill | Calls `onBill` | Only when `totalBillsCount > 0` |
| **Rebook** | Outline (shrink) | Rebook | Calls `onBookAgain` | Always shown |

> "View Bill" is new — a bill may have been raised before cancellation. Previously there was no way to access it from a cancelled card.

---

#### Terminal — No Show

| Element | Type | Label | Action | Condition |
|---|---|---|---|---|
| Status banner | Non-interactive | "Patient Did Not Arrive" | — | Always shown |
| **Rebook** | Outline (shrink) | Rebook | Calls `onBookAgain` | Always shown |

---

#### Terminal — Patient Left Early

| Element | Type | Label | Action | Condition |
|---|---|---|---|---|
| Status banner | Non-interactive | "Patient Left Before Completion" | — | Always shown |
| **View Bill** | Outline (shrink) | View Bill | Calls `onBill` | Only when `totalBillsCount > 0` |
| **Rebook** | Outline (shrink) | Rebook | Calls `onBookAgain` | Always shown |

> Same as Cancelled — bill access was missing for left-early patients who may have been billed before leaving.

---

## Doctor Role

### Info Strip Messages (above progress bar)

| Stage | Condition | Colour | Icon | Message |
|---|---|---|---|---|
| Booked / Confirmed | Not arrived, not pending, not terminal | Blue | Clock | "Waiting for patient to arrive — no action needed" |
| Treatment Completed | `isTreatmentCompleted && !isVisitCompleted` | Amber | Clock | "Consultation done — awaiting clinic to close the visit" |
| Visit Completed | `isVisitCompleted` | Emerald | ShieldCheck | "Visit closed successfully" |

---

### Footer Buttons — Doctor Role

#### Stage 0 — Pending Doctor Approval

| Element | Type | Label | Action |
|---|---|---|---|
| **Accept** | Primary (flex-1) | Accept | Calls `onApprove` |
| **Decline** | Rose outline (flex-1) | Decline | Calls `onDecline` |

---

#### Stage 1 — Booked / Confirmed (patient not yet arrived)

| Element | Notes |
|---|---|
| *(no footer button)* | The info strip above the progress bar shows "Waiting for patient to arrive — no action needed" |

> Previously showed a useless disabled "Booked" button. Removed entirely — the info strip communicates the state cleanly.

---

#### Stage 2 — Arrived (patient in waiting room)

| Element | Type | Label | Action |
|---|---|---|---|
| **Start Consultation** | Primary (blue, flex-1) | Start Consultation | Calls `onStartConsultation` |
| **Add Obs.** | Outline (shrink) | Add Obs. | Calls `onOpenRecords` |

---

#### Stage 3 — In Consultation / In Treatment

| Element | Type | Label | Action |
|---|---|---|---|
| **Add Observation** (icon) | Square outline | *(icon: ClipboardList)* | Calls `onOpenRecords` |
| **Notes** (icon) | Square outline | *(icon: FileText)* | Calls `onOpenNotes` |
| **Done** | Primary (teal, flex-1) | Done | Calls `onDoctorCompleteVisit` |
| **Issue Rx** | Primary-tinted (shrink) | Issue Rx | Calls `onOpenRecords` |

> "Issue Rx" was previously icon-only (Stethoscope icon, no label). It now has a visible label "Issue Rx" because issuing a prescription is a core doctor action, not an afterthought. The icon + label are both shown.

---

#### Stage 4 — Treatment Completed (awaiting clinic closure)

| Element | Type | Label | Action |
|---|---|---|---|
| **View / Edit Rx** | Outline (flex-1) | View / Edit Rx | Calls `onOpenRecords` |

**Info strip:** "Consultation done — awaiting clinic to close the visit" (amber)

> Previously had a disabled "Consult. Done" button (full-width) alongside a small "View Rx" button. The disabled button is gone — its message is now in the info strip. "View Rx" is now full-width since it's the only actionable button, and relabelled "View / Edit Rx" to communicate that editing is also possible.

---

#### Stage 5 — Visit Completed

| Element | Notes |
|---|---|
| *(no footer button)* | The info strip above the progress bar shows "Visit closed successfully" |

> Previously showed a disabled "Visit Completed" button. Removed — the info strip communicates the state cleanly.

---

#### Terminal States (all)

| Element | Type |
|---|---|
| Status info strip | Non-interactive text label ("Patient did not arrive" / "Appointment cancelled" / "Patient left before completion") |

---

## Three-dot Overflow Menu — Clinic Role

The three-dot menu (`canShowMoreMenu`) is available for all non-terminal, non-completed bookings in the clinic role.

| Menu Item | Condition | Action |
|---|---|---|
| **Reassign Doctor** | Before treatment completion, doctors available | Opens assign-doctor flow |
| **Send Reminder** | Stage 0 (Pending) only — not confirmed, not past | Calls `onSendReminder` |
| **Mark No Show** | Before patient arrives (`!isCheckedIn && !isInConsultation`) | Opens no-show confirmation dialog |
| **Cancel Booking** | Stage 2 (Arrived) or Stage 3 (In Treatment) only | Opens cancel dialog |
| **Patient Left Early** | Stage 2 or 3 (`isCheckedIn \|\| isInConsultation`) | Opens left-early dialog |
| **Mark Visit Done** | Stage 3b (Treatment Completed) | Opens visit-done dialog (with note) |
| **Admin Override — Force Complete** | Stages 0–3 (pre-treatment completion) | Opens override dialog with reason |

> Send Reminder was removed from the three-dot at Stage 1 (Confirmed) since it was promoted to the footer at that stage. It remains in the overflow only at Stage 0 (Pending).

---

## Summary — What Changed

| Item | Before | After |
|---|---|---|
| "Waiting for Doctor" disabled btn | Footer at Stage 2 | → Info strip message |
| "In Treatment" disabled btn | Footer at Stage 3 | → Info strip message |
| "Booked" disabled btn (doctor) | Doctor footer, Stage 1 | → Info strip message |
| "Consult. Done" disabled btn (doctor) | Doctor footer, Stage 4 | → Info strip message |
| "Visit Completed" disabled btn (doctor) | Doctor footer, Stage 5 | → Info strip message |
| "Paid" button label | Stage 5, visit completed + paid | → "View Invoice" |
| "Send Reminder" | Three-dot only (all stages) | → Footer at Stage 1 (Confirmed); three-dot at Stage 0 only |
| "Cancel" at Stage 2 & 3 | Footer button | → Three-dot overflow only |
| "Past Appointment" disabled btn | Stage 0 pending + past | → Active "Reschedule" button (amber) |
| "Issue Rx" label (doctor) | Icon-only (no label) | → Icon + "Issue Rx" label |
| "View Rx" (doctor Stage 4) | Small shrink button beside disabled Consult. Done | → Full-width "View / Edit Rx" |
| "View Bill" (terminal + bill exists) | Missing | → New button on Cancelled and Left Early terminal cards |
| "Cancel Booking" in overflow (Stage 2/3) | Missing | → New overflow item when Cancel removed from footer |
