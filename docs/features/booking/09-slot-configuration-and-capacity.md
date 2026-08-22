# Slot Configuration, Availability, and Capacity

## Slot model

Slots are stored in the `slots` table with:

- Start and end timestamps
- Clinic relationship
- Maximum bookings
- Cancellation flag
- Legacy owner/name fields

Bookings reference a slot through `slotId`.

## Clinic slot configuration

Clinic defaults are stored in `clinics.defaultSlotConfig`. Configuration can
describe closed days and time sections/capacity. The clinic UI uses
`ConfigureSlotsPanel`, `CreateSlotDialog`, and related slot hooks/components.

Slot cost is stored on the booking as `slotCost`. Treatment categories can
consume more than one capacity unit, and the card displays the duration/cost
information when available.

See the source implementation in:

- `client/src/components/ConfigureSlotsPanel.tsx`
- `client/src/components/CreateSlotDialog.tsx`
- `client/src/hooks/use-slots.ts`
- `server/storage.ts`

## Availability flow

The public booking screen:

1. Selects a date and clinic.
2. Builds candidate slot times.
3. Calls `POST /api/public/slot-availability`.
4. Displays count, maximum, cancellation, and spots-left information.
5. Rechecks capacity when the booking is submitted.

The clinic reschedule flow uses the same availability concept for a selected
date before submitting a new slot.

## Capacity and double-booking protection

Availability shown in the browser is advisory. The server must perform the
authoritative capacity check during booking creation.

The public booking path protects against races by consuming the verified OTP
and rechecking capacity inside the transaction that creates the booking. This
prevents two requests from both passing a stale browser availability result.

Cancelled bookings do not represent an active capacity claim when the server
calculates effective availability.

## What the protection covers

- Concurrent public booking attempts for the same capacity
- OTP reuse during booking creation
- Capacity changes between availability display and submit
- Server-side slot cancellation/capacity checks.

## What it does not cover

The current transaction is not a long-lived slot hold. A patient can view a
slot while another patient completes the booking first. The UI must handle a
capacity conflict by asking the patient to select another slot.

A future slot-hold design would need an expiring hold record, cleanup, and
clear rules for abandoned payment/OTP sessions.

## Timezone rules

Slot timestamps are persisted as timestamps, while date filters and
availability dates are interpreted in the clinic's configured IANA timezone.
Invalid or missing legacy clinic timezones use the documented default
`Asia/Kolkata`.

## Rescheduling

Clinic staff select a new available slot and call the authenticated
reschedule route. The server validates:

- Booking access
- New slot existence
- Slot/clinic compatibility
- Capacity
- Current booking state.

The old slot and new slot must not be treated as a simple client-side swap;
the server owns the transition.