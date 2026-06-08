# BookMySlot — Dental Clinic Appointment Booking System

A full-stack appointment booking application for dental clinics. Features role-based access control (admin, clinic, doctor, patient), real-time notifications, WhatsApp messaging, payment integration, and a public Smile Deals gallery.

---

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS + shadcn/ui (Radix UI)
- **State**: TanStack Query v5
- **Routing**: `wouter`
- **Build**: Vite

### Backend
- **Runtime**: Node.js + Express.js (TypeScript)
- **ORM**: Drizzle ORM
- **Auth**: Passport.js (email/password on Render) or Replit OIDC (on Replit)
- **Sessions**: `express-session` with PostgreSQL session store

### Database
- **PostgreSQL** hosted on **Supabase** (migrated from Render PostgreSQL, May 2026)
- Schema managed via Drizzle Kit
- See [`docs/supabase-database-setup.md`](./docs/supabase-database-setup.md)

---

## Quick Start (Local Development)

For the full guide see **[`docs/local-development-setup.md`](./docs/local-development-setup.md)**.

```bash
# 1. Install dependencies
npm install

# 2. Copy environment template and fill in your values
cp .env.example .env

# 3. Push schema to database
NODE_TLS_REJECT_UNAUTHORIZED=0 npm run db:push

# 4. Run in development mode (hot reload)
npm run dev
```

Or to run the compiled production build locally:
```bash
npm run build
node dist/index.cjs
```

---

## Authentication

### On Replit
Replit OIDC handles auth automatically. No configuration needed.

### On Render / Local
Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` environment variables. The app switches to Passport Local strategy automatically when these are present.

---

## Deployment

### Render (Production)
The app is deployed on Render with a custom domain:

| Service | URL |
|---|---|
| Frontend | `https://bookmyslot.dental.mossaic.in` |
| Backend API | `https://api.bookmyslot.dental.mossaic.in` |

- **Build command**: `npm install && npm run build`
- **Start command**: `node dist/index.cjs`
- **Database**: Supabase PostgreSQL via connection pooler (port `6543`)

Full environment variable reference: [`docs/render-environment-setup.md`](./docs/render-environment-setup.md)

---

## Documentation Index

| Document | What it covers |
|---|---|
| [`docs/local-development-setup.md`](./docs/local-development-setup.md) | Running the app locally — all modes, env setup, troubleshooting |
| [`docs/supabase-database-setup.md`](./docs/supabase-database-setup.md) | Supabase setup, SSL configuration, connection pooler, migration from Render |
| [`docs/render-environment-setup.md`](./docs/render-environment-setup.md) | All environment variables for Render production deployment |
| [`docs/domain-migration.md`](./docs/domain-migration.md) | Custom domain setup, DNS records, CORS configuration |
| [`docs/resend-email-production-setup.md`](./docs/resend-email-production-setup.md) | Email setup — sandbox to production via Resend |
| [`docs/payment-and-subscription-guide.md`](./docs/payment-and-subscription-guide.md) | Razorpay subscription plans, clinic billing, admin approval flow |
| [`docs/demo-guide.md`](./docs/demo-guide.md) | Demo accounts, pre-loaded data, what to explore |

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `DATABASE_URL must be set` | Ensure `.env` exists in the project root |
| `SELF_SIGNED_CERT_IN_CHAIN` during db:push | Run with `NODE_TLS_REJECT_UNAUTHORIZED=0 npm run db:push` |
| `ENETUNREACH` on Render | Use Supabase pooler URL (port `6543`) in Render env vars |
| CORS error | Ensure `FRONTEND_URL` in `.env` matches the URL you open in the browser |
| Admin login fails | Check `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env` |
| `tsx not found` | Run `npm install` again |
