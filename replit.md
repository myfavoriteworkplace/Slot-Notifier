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

## Color Palette (Green Theme)
- **Primary**: `#0F9B6E` (HSL 161 82% 33%) — main buttons, links, active states
- **Dark Green**: `#085041` — header backgrounds, gradient starts, PDF accent
- **Accent**: `#1D9E75` (HSL 161 69% 37%) — highlights, hover states, gradient ends
- **Light Tint**: `#E1F5EE` — panel backgrounds, secondary fills
- **Neutral**: `#F8F8F6` — near-white page background

Sidebar nav color coding: Bookings = primary green, Configure Slots = blue, Manage Doctors = teal, Book a Slot = primary green.

## Smile DEALS — Schema Fields
- `title`, `description`, `imageUrl`, `bookingLink` — core fields
- `price` — deal price (₹), optional
- `originalPrice` — was-price for strike-through + "Save ₹X" badge
- `category` — broad business category (Clinic Deals, Advertisements, etc.)
- `subcategory` — procedure type (Cleaning, Whitening, Braces, etc.) — drives public filter pills
- `isFlash` — boolean; appears in horizontal "Flash Deals" scroll strip
- `isFeatured` — boolean; appears as cinematic hero card
- `startsAt`, `expiresAt` — scheduling timestamps
- `videoUrl` — YouTube/Vimeo/mp4; autoplay on hover in cards and as hero background
- `viewCount`, `clickCount` — analytics counters

## Smile DEALS — Public Page Design
- Full dark theme (`#080D0B` background, Sora font)
- Animated ambient orbs behind content
- Stats row: Active Deals count, Avg Saving (computed from originalPrice − price), Total Views
- Filter pills from `subcategory` field
- Featured hero card (cinematic side-by-side layout with video support)
- Flash Deals horizontal scroll strip
- Countdown timer card (auto-shown for deals expiring within 72h)
- 3-column tilt cards grid with magnetic hover
- Bottom promo: Refer a Clinic (exclusive deals) + Loyalty Rewards (coming soon)

## Digital Consent Form
- **Flow**: Clinic clicks "Request →" in booking card → backend generates a 72-hour token → WhatsApp link sent to patient via Twilio → patient visits `/consent/:token` → signs with finger/mouse on canvas → signature saved to `bookings.consent_signature` with timestamp and IP.
- **Clinic UI**: "Digital Consent" panel in each booking card. Shows "Request →" / "Resend →" button and the consent URL (copy + open). Shows green "Signed ✓" badge once patient has signed.
- **Patient UI**: `/consent/:token` — public page (no login), shows clinic info, appointment summary, consent declaration text, signature pad (using `signature_pad`), and submit button.
- **API**: `POST /api/auth/clinic/bookings/:id/request-consent` (clinic-auth), `GET /api/consent/:token` (public), `POST /api/consent/:token/sign` (public).

## Recent Changes
- **2026-04-06**: Full digital consent form implementation: 3 API routes, storage methods, patient signing page (`/consent/:token`), clinic dashboard panel with "Request Consent" button and signed status.
- **2026-04-06**: Fixed missing DB columns (`assigned_doctor_email`, `doctor_notes`, `clinical_status`, etc.) via isolated migration blocks in `db.ts`.
- **2026-03-30**: Doctor profile: replaced URL input with file upload (R2), added completeness bar, years of experience field, languages multi-select (English/Malayalam/Tamil/Hindi/Kannada), Preview Profile button. New `years_of_experience` and `languages TEXT[]` columns added to doctors table. Public profile page updated to display both new fields.
- **2026-03-05**: Added Smile DEALS system with admin CRUD and public gallery.
- **2026-03-05**: Integrated Resend API for booking and invitation emails.
- **2026-03-05**: Fixed doctor patient/clinic lookup to handle session email strings.
- **2026-03-05**: Updated Admin Panel with tabbed navigation and deal configuration.
- **2026-03-05**: Ensured all pricing uses Indian Rupee (₹) symbol.
- **2026-03-05**: Improved Header with discrete Admin access for superusers.
- **2026-03-06**: Fixed Smile Deals image upload by allowing "smile-deals" folder.
- **2026-03-08**: Added `/api/auth/user` endpoint; fixed superadmin logout.
- **2026-03-08**: Expanded pending clinics tab with full card layout.
- **2026-03-29**: Added `originalPrice`, `subcategory`, `isFlash` to smile_deals schema.
- **2026-03-29**: Full dark redesign of Smile Deals public page (Sora font, ambient orbs, flash strip, countdown, tilt cards, promo section).
- **2026-03-29**: Admin deal form: added Procedure/Type dropdown, Original Price field, Flash Deal toggle, Start Date field, updated categories.
