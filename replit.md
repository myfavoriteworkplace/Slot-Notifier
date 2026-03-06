# BookMySlot

## Overview

BookMySlot is a full-stack appointment booking application that enables service owners to manage availability slots and customers to book appointments. The application features role-based access control (owner vs customer), real-time notifications, and a modern responsive UI.

## User Preferences

- Preferred communication style: Simple, everyday language.
- All prices displayed in Indian Rupees (₹).
- Email notifications via Resend API.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight alternative to React Router)
- **State Management**: TanStack React Query for server state caching and synchronization
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens and CSS variables for theming
- **Build Tool**: Vite with hot module replacement

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ESM modules
- **API Design**: RESTful endpoints defined in shared route contracts (`shared/routes.ts`)
- **Validation**: Zod schemas for request/response validation with drizzle-zod integration
- **Session Management**: Express sessions with PostgreSQL-backed session store (connect-pg-simple)

### Data Storage
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with type-safe schema definitions
- **Schema Location**: `shared/schema.ts` for all database models
- **Manual Sync**: Schema is also manually synced via SQL commands in `server/index.ts` to handle environment constraints.

### Authentication
- **Dual Mode Support**: 
  - Replit OIDC (when running on Replit)
  - Environment-based email/password (when `ADMIN_EMAIL` and `ADMIN_PASSWORD` are set)
- **Strategy**: Passport.js with OpenID Client (Replit) or session-based auth (external)
- **User Roles**: `superuser` (admin), `owner` (clinic staff), `customer` (can book slots), `doctor` (view schedule)

### Key Data Models
- **Users**: Authentication and role management
- **Clinics**: Clinic details including a `doctors` JSONB field for legacy/quick reference.
- **Doctors**: Separate table for doctor profiles and login.
- **ClinicDoctors**: Join table linking clinics and doctors.
- **Slots**: Time windows created by owners for booking.
- **Bookings**: Customer reservations linked to slots.
- **SmileDeals**: Promotional dental offers managed by super admins.
- **Notifications**: In-app notification system.

## External Integrations

### Email (Resend)
- **Configuration**: Requires `RESEND_API_KEY`.
- **Modes**: `RESEND=PRODUCTION` sends to actual emails; `DEV` redirects all mail to a test address.
- **Features**: Booking confirmations, cancellations, and doctor invitations.

### Storage (Cloudflare R2)
- **Configuration**: Requires R2 credentials (`R2_ACCESS_KEY_ID`, etc.).
- **Usage**: Clinic logos and Smile Deal images.
- **Flow**: Frontend requests signed URL from `/api/uploads/signed-url`, then uploads directly to R2.

## Admin Features
- **Clinic Management**: Approve self-registered clinics, archive/restore clinics, manage credentials.
- **Smile DEALS**: Create and manage promotional offers with images, descriptions, and pricing in ₹.
- **Dashboard**: Tabbed interface for Active, Pending, Archived clinics, and Smile Deals.

## Recent Changes
- **2026-03-05**: Added Smile DEALS system with admin CRUD and public gallery.
- **2026-03-05**: Integrated Resend API for booking and invitation emails.
- **2026-03-05**: Fixed doctor patient/clinic lookup to handle session email strings.
- **2026-03-05**: Updated Admin Panel with tabbed navigation and deal configuration.
- **2026-03-05**: Ensured all pricing uses Indian Rupee (₹) symbol.
- **2026-03-05**: Improved Header with discrete Admin access for superusers.
- **2026-03-06**: Fixed Smile Deals image upload by allowing "smile-deals" folder and passing required file metadata to the signed URL service.
