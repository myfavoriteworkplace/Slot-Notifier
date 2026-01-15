# BookMySlot - Application Functionality Document

## Overview
BookMySlot is a comprehensive clinic appointment booking system designed to bridge the gap between healthcare providers and patients. It provides a seamless interface for managing availability, booking appointments, and handling medical billing.

---

## User Roles & Permissions

### 1. Superuser (Platform Administrator)
The Superuser has the highest level of authority and manages the entire platform.
- **Clinic Management**: 
  - Create new clinic accounts with unique credentials.
  - View a list of all clinics registered on the platform.
  - Archive/Deactivate clinics (soft delete).
  - Unarchive/Reactivate clinics.
- **Admin Panel**: Dedicated dashboard for system-wide oversight.
- **Demo Mode**: Can log in as a "Demo Super Admin" to manage persistent local demo clinics without affecting the production database.

### 2. Clinic Owner / Staff
Each clinic has its own secure portal to manage daily operations.
- **Dashboard**: Real-time overview of future, past, and today's bookings.
- **Slot Management**:
  - Configure availability slots for specific dates.
  - Set maximum booking capacity per slot (default is 3).
  - Cancel specific slots (mark as unavailable).
- **Booking Management**:
  - View all appointments booked for the clinic.
  - Filter bookings by date range.
  - Manually create bookings for patients (walk-ins or phone bookings).
  - Cancel existing appointments (triggers automated notification).
- **Billing & Exports**:
  - Generate professional PDF medical bills for patients.
  - Export booking data to CSV (Excel compatible) for offline records.

### 3. Customer / Patient
Patients can book appointments without needing to create an account.
- **Clinic Discovery**: Browse available clinics.
- **Appointment Booking**:
  - Select a clinic, date, and time slot.
  - Provide basic details (Name, Phone, Email).
  - Indian mobile number validation (10 digits starting with 6-9).
- **Real-time Availability**: See which slots are "Full" or "Unavailable" instantly.
- **Notifications**: Receive automated email confirmations and cancellation alerts.

---

## Key Features

### 1. Public Booking System
- **No Login Required**: Lowering the barrier for patients to book.
- **Capacity Enforcement**: System automatically prevents overbooking (enforced at 3 bookings per slot unless configured otherwise).
- **Instant Feedback**: Clear success/error states with visual cues.

### 2. Dual-Mode Authentication
- **Production Mode**: Uses environment-based `ADMIN_EMAIL` and `ADMIN_PASSWORD` for secure superuser access.
- **Replit Integration**: Supports Replit OIDC for seamless development on the platform.
- **Clinic Auth**: Unique username/password per clinic.

### 3. Demo Experience
- **Demo Smile Clinic**: A pre-seeded clinic with test data for immediate exploration.
- **Local Persistence**: Demo actions (like creating demo clinics or bookings) are saved to the browser's `localStorage`, allowing users to test functionalities safely.
- **Mock Notifications**: Demo bookings trigger console-logged email previews to simulate the notification flow.

### 4. Automated Notifications (Resend Integration)
- **Booking Confirmations**: Sent to the patient immediately upon successful booking.
- **Cancellation Alerts**: Sent to the patient if a clinic administrator cancels their appointment.
- **Clinic Alerts**: Clinics receive an email notification when a new booking is made (if a clinic email is configured).

### 5. Data & Reporting
- **PDF Invoicing**: Customizable billing details including service descriptions and amounts.
- **CSV Exports**: Allows clinics to maintain historical records of patient visits.

---

## Technical Architecture (Summary)
- **Frontend**: React 18, Tailwind CSS, shadcn/ui.
- **Backend**: Node.js, Express.js.
- **Database**: PostgreSQL (Neon/Drizzle ORM).
- **Email Service**: Resend API.
- **Routing**: Wouter (Client) & Express (Server).
