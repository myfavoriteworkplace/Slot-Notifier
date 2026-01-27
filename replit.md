# BookMySlot

## Overview

BookMySlot is a full-stack appointment booking application that enables service owners to manage availability slots and customers to book appointments. The application features role-based access control (owner vs customer), real-time notifications, and a modern responsive UI.

## User Preferences

Preferred communication style: Simple, everyday language.

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
- **Migrations**: Drizzle Kit for schema migrations (`drizzle-kit push`)

### Authentication
- **Dual Mode Support**: 
  - Replit OIDC (when running on Replit)
  - Environment-based email/password (when `ADMIN_EMAIL` and `ADMIN_PASSWORD` are set)
- **Strategy**: Passport.js with OpenID Client (Replit) or session-based auth (external)
- **Session Storage**: PostgreSQL sessions table
- **User Roles**: `superuser` (admin), `owner` (clinic staff), `customer` (can book slots)

### Key Data Models
- **Users**: Authentication and role management
- **Clinics**: Each clinic has a `doctors` JSONB field storing array of {name, specialization, degree}
- **Slots**: Time windows created by owners for booking
- **Bookings**: Customer reservations linked to slots
- **Notifications**: In-app notification system

### Project Structure
```
├── client/           # React frontend
│   └── src/
│       ├── components/   # UI components
│       ├── hooks/        # React Query hooks
│       ├── pages/        # Route pages
│       └── lib/          # Utilities
├── server/           # Express backend
│   ├── replit_integrations/  # Auth integration
│   └── routes.ts     # API endpoints
├── shared/           # Shared types and contracts
│   ├── schema.ts     # Drizzle database schema
│   ├── routes.ts     # API route definitions
│   └── models/       # Model definitions
└── migrations/       # Database migrations
```

## External Dependencies

### Database
- PostgreSQL (required, connection via `DATABASE_URL` environment variable)
- Session storage uses the same PostgreSQL instance

### Authentication
- Replit OIDC provider (`ISSUER_URL` defaults to `https://replit.com/oidc`)
- Requires `REPL_ID` and `SESSION_SECRET` environment variables

### Key NPM Packages
- **drizzle-orm** / **drizzle-kit**: Database ORM and migration tooling
- **@tanstack/react-query**: Server state management
- **passport** / **openid-client**: Authentication
- **zod**: Runtime validation
- **date-fns**: Date manipulation
- **lucide-react**: Icon library

## Public Booking System

The application supports public booking without login:

### Flow
1. Customer selects clinic, date/time, enters name, phone, and email
2. Booking is confirmed immediately (no OTP verification)
3. Confirmation logged to console (email integration not yet configured)

### Email Integration
**Status**: Not configured - Confirmations are logged to server console
**TODO**: Set up Resend or SendGrid integration when ready to send real emails
- Look for `[EMAIL]` in server logs to see what would be sent
- Update `server/routes.ts` to use actual email service

### Capacity
- Maximum 3 bookings per time slot per clinic
- Enforced at booking creation

## Documentation

For detailed setup and deployment instructions, see:
- **README.md** - Complete setup guide for local development and Render deployment
- **RENDER_DEPLOYMENT.md** - Detailed Render.com deployment guide
- **.env.example** - Sample environment variables for local development
- **.env.render.backend.example** - Sample environment variables for Render backend
- **.env.render.frontend.example** - Sample environment variables for Render frontend

## Recent Changes

- **2026-01-27**: Implemented complete doctor onboarding and authentication system
  - Added `doctorInvites` table for tracking invitation tokens
  - Created `/setup-password` page for doctors to complete registration
  - Added email input field to clinic dashboard doctor management
  - Backend endpoints for invitation verification and password setup
  - Added doctor login functionality with email/password authentication
  - Created `/doctor-dashboard` page for logged-in doctors
  - Tabbed login page supporting both clinic and doctor logins
- **2026-01-25**: Integrated Cloudflare R2 for clinic logo uploads.
- **2026-01-24**: Added doctor management feature to clinic dashboard (view, add, remove doctors)
- **2024-01-13**: Added dual authentication support (Replit OIDC + environment-based email/password)
- **2024-01-13**: Added comprehensive deployment documentation for Render.com