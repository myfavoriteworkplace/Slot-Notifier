# Database Architecture and Authentication Documentation

## 1. Database Overview
The application uses **PostgreSQL** with **Drizzle ORM** for data management. It handles a multi-tenant-like structure for Clinics, while maintaining a global administrative layer.

## 2. Table Schema Definitions

### `users`
Central identity table for platform administrators and potentially clinic owners.
- `id`: `varchar` (Primary Key)
- `email`: `varchar` (Unique)
- `role`: `varchar` (e.g., 'superuser', 'owner')
- `username`: `varchar` (Unique)

### `clinics`
Medical facilities registered on the platform.
- `id`: `serial` (Primary Key)
- `name`: `varchar` (255)
- `address`: `varchar` (500)
- `email`: `varchar` (255)
- `username`: `varchar` (100, Unique) - Used for clinic-specific login.
- `password_hash`: `varchar` (255)
- `is_archived`: `boolean` (Default: false)

### `slots`
Time intervals available for patient bookings.
- `id`: `serial` (Primary Key)
- `clinic_id`: `integer` (References `clinics.id`)
- `owner_id`: `varchar` (References `users.id`)
- `start_time`: `timestamp`
- `end_time`: `timestamp`
- `is_booked`: `boolean`
- `max_bookings`: `integer` (Default: 3)
- `is_cancelled`: `boolean`

### `bookings`
Patient appointment records.
- `id`: `serial` (Primary Key)
- `slot_id`: `integer` (References `slots.id`)
- `customer_id`: `varchar` (References `users.id`)
- `customer_name`: `varchar`
- `customer_phone`: `varchar`
- `customer_email`: `varchar`
- `verification_status`: `varchar` (e.g., 'pending', 'verified', 'cancelled')
- `verification_code`: `varchar` (For OTP/Email verification)

### `session`
Managed by `connect-pg-simple` for persistent authentication.
- `sid`: `varchar` (Primary Key)
- `sess`: `json`
- `expire`: `timestamp`

---

## 3. Authentication & Role Management

### Superuser (Platform Admin)
- **Role**: `superuser`
- **Login**: Handled via `ADMIN_EMAIL` and `ADMIN_PASSWORD` environment variables or the `users` table.
- **Capabilities**: Can manage all clinics, view global logs, and configure system-wide settings.

### Clinic Admin
- **Role**: Clinic-specific access.
- **Login**: Clinics use their `username` and `password_hash` from the `clinics` table.
- **Mechanism**: Authenticated sessions mark the clinic ID to restrict data access to only that clinic's slots and bookings.

### Role Enforcement
- **Middleware**: `isAuthenticated` in `server/routes.ts` checks the session for `adminLoggedIn` or specific user claims.
- **Data Isolation**: Most storage methods filter results by `clinicId` or `ownerId` to ensure users only see relevant data.

---

## 4. Deployment Prerequisites
Before the application is fully functional in a new environment:
1. **Schema Sync**: Run `npm run db:push` to create tables.
2. **Session Persistence**: The `session` table must be initialized (the server does this automatically on startup).
3. **Seed Data**: A default clinic and test slots are created automatically via `server/seed-test-clinic.ts` if they don't exist.
4. **Required Env Vars**:
   - `DATABASE_URL`
   - `SESSION_SECRET`
   - `ADMIN_EMAIL` / `ADMIN_PASSWORD`
