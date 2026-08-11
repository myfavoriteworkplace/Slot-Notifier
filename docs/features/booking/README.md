# Booking Documentation

This folder is the source of truth for the BookMySlot booking and appointment
domain. It documents the patient booking journey, the booking data model, the
shared appointment card, clinic and doctor workflows, status policy, filtering,
slot capacity, related visit records, and the booking API.

## Start here

| Document | Use it when you need to understand |
| --- | --- |
| [Booking overview and lifecycle](01-booking-overview-and-lifecycle.md) | The complete booking journey from public booking to visit closure |
| [Booking data model](02-booking-data-model.md) | Booking fields, related tables, and ownership boundaries |
| [Status and lifecycle policy](03-booking-status-and-lifecycle.md) | Status tracks, transitions, terminal states, and action rules |
| [Shared appointment card](04-shared-appointment-card.md) | The reusable `AppointmentCard` component and its visual contract |
| [Role-based card actions](05-role-based-card-actions.md) | The difference between clinic/admin and doctor actions |
| [Clinic bookings panel](06-clinic-admin-bookings-panel.md) | Clinic dashboard lists, mutations, dialogs, and deep links |
| [Doctor appointments](07-doctor-appointments.md) | Doctor dashboard appointment behaviour |
| [Search, filters, and history](08-booking-search-filters-and-history.md) | Patient search, filters, grouping, pagination, and visit numbering |
| [Slots and capacity](09-slot-configuration-and-capacity.md) | Slot setup, availability, rescheduling, and double-booking protection |
| [Booking detail records](10-booking-detail-tabs-and-related-records.md) | Notes, records, documents, consent, timeline, and billing |
| [Booking API and server contracts](11-booking-api-and-server-contracts.md) | Route inventory, callers, request purpose, and state changes |

## Booking architecture at a glance

```text
Public patient UI (Book.tsx)
        │
        ├── OTP verification
        ├── slot availability
        ├── optional booking-token payment
        └── public booking creation
                    │
                    ▼
              bookings + slots
                    │
       ┌────────────┴────────────┐
       ▼                         ▼
ClinicDashboard              DoctorDashboard
BookingsPanel                AppointmentCard
AppointmentCard              role="doctor"
role="clinic"                       │
       │                            ├── approve / decline
       ├── confirm / assign         ├── start consultation
       ├── check in / complete      ├── clinical work
       ├── no-show / override       └── treatment completion
       └── records and billing
```

## Source-of-truth files

- Database model: `shared/schema.ts`
- Status vocabulary and classifier: `shared/booking-status.ts`
- Client classifier boundary: `client/src/lib/booking-classification.ts`
- List and action helpers: `client/src/lib/booking-list.ts`
- Shared card: `client/src/components/AppointmentCard.tsx`
- Lifecycle strip: `client/src/components/BookingProgressStrip.tsx`
- Clinic list and mutations: `client/src/components/BookingsPanel.tsx`
- Doctor list and mutations: `client/src/pages/DoctorDashboard.tsx`
- Public booking flow: `client/src/pages/Book.tsx`
- Server routes: `server/routes.ts`
- Persistence and booking queries: `server/storage.ts`

## Terminology

- **Slot**: A clinic-defined time interval that can hold one or more bookings.
- **Booking**: The database record connecting a patient/request to a slot.
- **Appointment card**: The reusable clinic/doctor UI representation of a booking.
- **Visit**: The in-person clinical lifecycle represented by `visitStatus`.
- **Confirmation**: The clinic-facing booking track represented by
  `verificationStatus`.
- **Doctor approval**: The separate track used when a doctor must accept an
  assigned booking.
- **Clinical status**: Case classification such as first visit or follow-up;
  it is not the visit lifecycle.
- **Terminal state**: Cancelled, no-show, or patient-left-early. These stop
  normal active-visit actions.

## Related documentation

Billing, notification, storage, authentication, and clinic dashboard design
documents remain in their existing folders. The booking documents link to those
systems where they participate in a booking, but do not duplicate their
complete implementation documentation.