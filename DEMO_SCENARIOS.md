# Demo Scenarios and Credentials

This document outlines the demo scenarios and credentials available in the BookMySlot application.

## 1. Demo Super Admin
The Super Admin has full access to manage clinics and oversee the system.

- **Email**: `demo_super_admin@bookmyslot.com`
- **Password**: Any password (Bypassed in code)
- **Role**: `superuser`
- **Capabilities**: 
  - Manage all clinics
  - Archive/Unarchive clinics
  - View all slots and bookings
  - Bypass clinic login to access clinic-specific dashboards

## 2. Demo Clinic
A pre-configured clinic for testing the clinic-side management.

- **Username**: `demo_clinic`
- **Password**: `demo_password123`
- **Role**: `clinic`
- **Clinic Name**: `Demo Smile Clinic`
- **Capabilities**:
  - Manage clinic slots
  - View bookings for the clinic
  - Configure slot availability and booking limits

## 3. General Demo User (OIDC/Replit Auth)
Users can sign in via Replit Auth (OIDC) to book slots.

- **Role**: `user`
- **Capabilities**:
  - Browse clinics
  - Book available slots
  - Receive notifications and emails

## Implementation Details
- The `demo_super_admin@bookmyslot.com` user is automatically authenticated and granted `superuser` claims if they attempt to login with that email.
- The `demo_clinic` is seeded automatically if it doesn't exist during server startup.
- Authentication checks in `server/routes.ts` have been updated to grant persistent access to the demo super admin.