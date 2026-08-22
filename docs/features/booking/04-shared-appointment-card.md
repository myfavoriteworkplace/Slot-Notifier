# Shared Appointment Card

## Component contract

The reusable component is:

```text
client/src/components/AppointmentCard.tsx
```

It is rendered by both:

- `BookingsPanel` with `role="clinic"`
- `DoctorDashboard` with `role="doctor"`

The card receives a `BookingWithSlot`, a booking reference, a classification,
optional history metadata, role-specific callbacks, and loading states.

## Card anatomy

From top to bottom, the card contains:

1. Optional latest-booking pill
2. Lifecycle status accent bar
3. Patient identity header
4. Status badge and tooltip
5. Optional doctor visit badge
6. Date and time
7. Clinic name in doctor view
8. Visit type
9. Treatment category and slot cost
10. Doctor assignment in clinic view
11. Consent state
12. Billing/visit information
13. Lifecycle progress strip
14. Role-specific footer actions
15. Clinic overflow menu

The card body opens the appointment detail view. Keyboard Enter and Space
activate the same card action.

## Footer policy contract

Footer actions are policy output, not ad hoc timing branches. The canonical
sequence is:

```text
classifyBooking()
  → getAppointmentFooterModel()
  → role-specific rendering and parent callback
```

The model returns one primary action, optional secondary actions, optional
target-tab metadata, and a read-only flag. The card must use the operational
state from the classification for action decisions:

- `same_day_past_due`, `old_needs_resolution`, and `unknown_date` resolve
  administratively before any Rebook action.
- `old_active` keeps visit management ahead of Rebook.
- `treatment_completed` keeps clinic final closure ahead of Rebook.
- Completed billing actions depend on bill/payment state.
- Active and treatment-completed clinic visits retain an Open Billing entry
  point even when no bill exists yet, so the first bill can be created.

The relative date badge may describe timing, but timing alone must not choose
the footer action. The visible card remains unchanged until the planned card
migration phase.

## Visual dimensions

The card deliberately separates two visual dimensions:

- The top accent bar and left border use the lifecycle/status colour.
- The relative date badge represents timing: past, today, or future.
- Timing is no longer represented by the card's top border.

For historical, read-only past cards, the accent bar and left border are intentionally muted to a neutral grey so they read as record history instead of active operational workflow. This override applies only to genuinely historical cards, not to unresolved, action-required, or active visits. Status badges still preserve the event outcome (Completed, Cancelled, No Show, Left Early) even when the border is greyed.

Timing badges use a separate colour system from lifecycle status:

| Timing label | Visual treatment |
| --- | --- |
| Today | Sky blue |
| Tomorrow / `in Nd` | Emerald/teal |
| Past | Slate grey |

Typical lifecycle state colours are:

| State | Visual treatment |
| --- | --- |
| Pending | Amber |
| Confirmed | Emerald |
| In Consult (checked in, in consultation, or treatment completed) | Violet |
| Completed | Emerald |
| Cancelled/doctor declined | Rose |
| No Show/patient left early | Slate |
| Past or terminal | Muted opacity/header |

The card's standard visible booking-status vocabulary is:

```text
Pending · Confirmed · In Consult · Completed · Cancelled · No Show
```

Checked-in, in-consultation, and treatment-completed records are intentionally
grouped under `In Consult` for a concise admin-facing presentation. The exact
underlying lifecycle remains available in the progress strip and status tooltip.

The status badge is derived from the normalized classification rather than
reading only one raw database field.

## Display rules

### Patient identity

The header shows patient name, stable booking reference, patient code when
available, phone, age, and gender. Visit history may show `Visit X/Y` and a
latest-booking label.

### Visit type and treatment

The card prefers dedicated `visitType` and `treatmentCategory` fields. For
legacy data it parses the booking description and can fall back to
`bookedBy` to show “Booked by Patient” or “Admin booked”.

For new patient-origin or clinic-admin bookings, `patientVisitClassification`
takes precedence over the generic origin fallback. It displays the matching
origin prefix with `(First Visit)` or `(Existing Patient)`. A null value is
expected for historical bookings and bookings that could not be linked to a
patient profile.

### Consent

- Signed timestamp: `Signed`
- Token exists without signature: `Consent Sent` with resend action
- Neither exists: pending/not yet sent presentation

### Billing

The card uses bill counts to explain completion state:

- `noBill`: completed with zero bills; shown as a green dashed/no-invoice
  condition.
- `hasUnpaidBill`: bills exist but at least one is not paid; shown as amber.

Opening billing from an active or treatment-completed visit is valid even when
`totalBillsCount` is zero. A completed visit with no bill is not presented as
`View Invoice`; it remains a review state until a bill exists.

## Responsive behaviour

On small screens, detail rows are collapsed behind the date/time or clinic
row. Patient-filtered lists can additionally collapse cards to compact rows.
On larger screens, card details remain visible.

The card remains equal-width within the dashboard grid; responsive behaviour
belongs inside the card rather than changing dashboard card widths.

The outer card keeps `overflow-visible` so the optional latest-booking pill can
float above the top edge. Its clipped inner shell uses an 11px radius while the
outer card uses the standard 12px radius; the one-pixel adjustment accounts for
the outer border and keeps the header/background curves aligned at every
status-colour corner.

## Separation of responsibilities

`AppointmentCard` owns:

- Presentation
- Local dialog state for reason prompts
- Status display
- Callback invocation
- Loading presentation
- Responsive/collapsed card state

The parent dashboard owns:

- Queries and pagination
- Mutation calls
- Authentication and role context
- Cache invalidation
- Notifications
- Detail dialogs and tab state

The server owns:

- Authorization
- Ownership checks
- State transition validation
- Persistence
- Audit and notification side effects.