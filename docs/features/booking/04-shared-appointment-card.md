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
2. Timing accent bar
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

## Visual dimensions

The card deliberately separates two visual dimensions:

- The top accent bar represents timing: past, today, or future.
- The left border/status treatment represents lifecycle state.

Typical state colours are:

| State | Visual treatment |
| --- | --- |
| Pending/action needed | Amber |
| Confirmed/completed | Emerald |
| Checked in/in consultation | Violet/blue active treatment |
| Cancelled | Rose |
| No-show/left early | Slate/amber terminal |
| Past or terminal | Muted opacity/header |

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

### Consent

- Signed timestamp: `Signed`
- Token exists without signature: `Consent Sent` with resend action
- Neither exists: pending/not yet sent presentation

### Billing

The card uses bill counts to explain completion state:

- `noBill`: completed with zero bills; shown as a green dashed/no-invoice
  condition.
- `hasUnpaidBill`: bills exist but at least one is not paid; shown as amber.

## Responsive behaviour

On small screens, detail rows are collapsed behind the date/time or clinic
row. Patient-filtered lists can additionally collapse cards to compact rows.
On larger screens, card details remain visible.

The card remains equal-width within the dashboard grid; responsive behaviour
belongs inside the card rather than changing dashboard card widths.

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